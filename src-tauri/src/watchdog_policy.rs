//! Pure watchdog decisions. All timestamps are active milliseconds, excluding sleep.
use std::collections::VecDeque;

pub const PROBE_INTERVAL_MS: u64 = 2_000;
pub const PROBE_EXPIRES_MS: u64 = 5_000;
const DELAYED_REPLY_MS: u64 = 15_000;
pub const STARTUP_GRACE_MS: u64 = 60_000;
pub const STALE_MS: u64 = 30_000;
pub const AFTER_RECOVERY_MS: u64 = 60_000;
pub const RESUME_GRACE_MS: u64 = 30_000;
pub const BUDGET_WINDOW_MS: u64 = 15 * 60 * 1_000;
pub const MAX_RELOADS: usize = 4;
pub const MAX_RESTARTS: usize = 2;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Recovery {
    Navigate,
    Restart,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Reason {
    Startup,
    Page,
    Window,
}
impl Reason {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Startup => "startup",
            Self::Page => "page",
            Self::Window => "window",
        }
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Action {
    None,
    Probe(u64),
    Recover(Recovery, Reason),
}

pub struct Monitor {
    page_at: u64,
    native_at: u64,
    next_probe: u64,
    sequence: u64,
    pending: Option<(u64, u64)>,
    issued: VecDeque<(u64, u64)>,
    ready: bool,
    navigated: bool,
    recover_after: u64,
    deferred: bool,
    blocked: bool,
    stopped: bool,
}
impl Monitor {
    pub fn new(now: u64) -> Self {
        Self {
            page_at: now,
            native_at: now,
            next_probe: now,
            sequence: 0,
            pending: None,
            issued: VecDeque::new(),
            ready: false,
            navigated: false,
            recover_after: now.saturating_add(STARTUP_GRACE_MS),
            deferred: false,
            blocked: false,
            stopped: false,
        }
    }
    pub fn reply(&mut self, sequence: u64, ready: bool, now: u64) -> bool {
        let Some((expected, at)) = self.pending else {
            return false;
        };
        if sequence != expected || now.saturating_sub(at) > PROBE_EXPIRES_MS {
            return false;
        }
        self.pending = None;
        if ready {
            self.accept_ready(sequence, now);
        }
        true
    }
    fn accept_ready(&mut self, sequence: u64, now: u64) {
        self.issued.retain(|&(issued, _)| issued > sequence);
        self.page_at = now;
        self.ready = true;
        self.navigated = false;
    }
    /// A delayed response can arrive after a newer challenge was sent.
    pub fn reply_tolerant(&mut self, sequence: u64, ready: bool, now: u64) -> bool {
        if self.stopped || self.blocked { return false; }
        if self.reply(sequence, ready, now) { return true; }
        if !self.ready || !ready || !self.issued.iter().any(|&(sent, at)| {
            sent == sequence && now.saturating_sub(at) <= DELAYED_REPLY_MS
        }) { return false; }
        if self.pending.is_some_and(|(pending, _)| pending == sequence) {
            self.pending = None;
        }
        self.accept_ready(sequence, now);
        true
    }
    pub fn resume(&mut self, now: u64) {
        self.page_at = now;
        self.native_at = now;
        self.pending = None;
        self.issued.clear();
        self.recover_after = now.saturating_add(RESUME_GRACE_MS);
        self.next_probe = now;
    }
    pub fn block(&mut self) {
        self.blocked = true;
    }
    pub fn stop(&mut self) {
        self.stopped = true;
        self.pending = None;
        self.issued.clear();
    }
    pub fn status(&self) -> &'static str {
        if self.stopped {
            "stopped"
        } else if self.blocked {
            "limited"
        } else if self.deferred {
            "deferred"
        } else if self.navigated {
            "recovering"
        } else if self.ready {
            "watching"
        } else {
            "starting"
        }
    }
    pub fn is_ready(&self) -> bool {
        self.ready
    }
    pub fn ages(&self, now: u64) -> (u64, u64) {
        (
            now.saturating_sub(self.page_at),
            now.saturating_sub(self.native_at),
        )
    }
    pub fn poll(
        &mut self,
        now: u64,
        native_responsive: bool,
        protected: bool,
        can_probe: bool,
    ) -> Action {
        if self.stopped {
            return Action::None;
        }
        if native_responsive {
            self.native_at = now;
        }
        if protected {
            self.deferred = true;
            self.pending = None;
            self.issued.clear();
            self.page_at = now;
            self.native_at = now;
            self.recover_after = now.saturating_add(RESUME_GRACE_MS);
            return Action::None;
        }
        if self.deferred {
            self.deferred = false;
            self.resume(now);
        }
        let threshold = if self.ready {
            STALE_MS
        } else {
            STARTUP_GRACE_MS
        };
        let page_stale = now.saturating_sub(self.page_at) >= threshold;
        let window_stale = now.saturating_sub(self.native_at) >= threshold;
        if !self.blocked && now >= self.recover_after && (page_stale || window_stale) {
            let reason = if !self.ready {
                Reason::Startup
            } else if window_stale {
                Reason::Window
            } else {
                Reason::Page
            };
            let recovery = if self.navigated || reason == Reason::Window {
                Recovery::Restart
            } else {
                Recovery::Navigate
            };
            self.navigated = true;
            self.recover_after = now.saturating_add(AFTER_RECOVERY_MS);
            self.pending = None;
            self.issued.clear();
            return Action::Recover(recovery, reason);
        }
        if self
            .pending
            .is_some_and(|(_, at)| now.saturating_sub(at) > PROBE_EXPIRES_MS)
        {
            self.pending = None;
        }
        if can_probe && self.pending.is_none() && now >= self.next_probe {
            self.sequence += 1;
            while self.issued.front().is_some_and(|&(_, at)| now.saturating_sub(at) > DELAYED_REPLY_MS) {
                self.issued.pop_front();
            }
            self.issued.push_back((self.sequence, now));
            self.pending = Some((self.sequence, now));
            self.next_probe = now.saturating_add(PROBE_INTERVAL_MS);
            return Action::Probe(self.sequence);
        }
        Action::None
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Attempt {
    pub at: u64,
    pub recovery: Recovery,
}
pub fn within_budget(attempts: &[Attempt], now: u64, recovery: Recovery) -> bool {
    // Future timestamps remain relevant if the system clock moved backwards.
    let count = attempts
        .iter()
        .filter(|entry| {
            entry.recovery == recovery
                && (entry.at > now || now.saturating_sub(entry.at) < BUDGET_WINDOW_MS)
        })
        .count();
    count
        < match recovery {
            Recovery::Navigate => MAX_RELOADS,
            Recovery::Restart => MAX_RESTARTS,
        }
}
pub fn resumed(previous_wall: u64, wall: u64, previous_active: u64, active: u64) -> bool {
    let wall_gap = wall.saturating_sub(previous_wall);
    let active_gap = active.saturating_sub(previous_active);
    wall_gap.saturating_sub(active_gap) > 2_000
        || active_gap > 15_000
        || wall < previous_wall
        || active < previous_active
}

#[cfg(test)]
mod tests {
    use super::*;
    fn reply(m: &mut Monitor, now: u64) -> u64 {
        let Action::Probe(sequence) = m.poll(now, true, false, true) else {
            panic!("Expected one probe");
        };
        assert!(m.reply(sequence, true, now + 100));
        sequence
    }
    #[test]
    fn startup_blank_page_gets_grace_then_navigation_and_bounded_escalation() {
        let mut m = Monitor::new(0);
        assert!(!matches!(
            m.poll(59_999, true, false, false),
            Action::Recover(..)
        ));
        assert_eq!(
            m.poll(60_000, true, false, false),
            Action::Recover(Recovery::Navigate, Reason::Startup)
        );
        assert_eq!(m.poll(119_999, true, false, false), Action::None);
        assert_eq!(
            m.poll(120_000, true, false, false),
            Action::Recover(Recovery::Restart, Reason::Startup)
        );
    }
    #[test]
    fn page_hang_navigates_but_native_window_hang_restarts() {
        let mut page = Monitor::new(0);
        reply(&mut page, 0);
        assert_eq!(
            page.poll(60_000, true, false, false),
            Action::Recover(Recovery::Navigate, Reason::Page)
        );
        let mut window = Monitor::new(0);
        reply(&mut window, 0);
        assert_eq!(
            window.poll(60_000, false, false, false),
            Action::Recover(Recovery::Restart, Reason::Window)
        );
    }
    #[test]
    fn hidden_page_is_healthy_when_native_challenges_are_answered() {
        let mut m = Monitor::new(0);
        for now in (0..120_000).step_by(PROBE_INTERVAL_MS as usize) {
            reply(&mut m, now);
        }
        assert_eq!(m.status(), "watching");
        assert!(m.is_ready());
    }
    #[test]
    fn old_duplicate_or_not_ready_replies_never_mask_a_stalled_page() {
        let mut m = Monitor::new(0);
        let Action::Probe(sequence) = m.poll(0, true, false, true) else {
            panic!()
        };
        assert!(!m.reply(sequence + 1, true, 1));
        assert!(!m.reply(sequence, true, PROBE_EXPIRES_MS + 1));
        let Action::Probe(next) = m.poll(6_000, true, false, true) else {
            panic!()
        };
        assert!(!m.reply(sequence, true, 6_001));
        assert!(m.reply(next, false, 6_001));
        assert!(!m.reply(next, true, 6_002));
        assert_eq!(
            m.poll(60_000, true, false, false),
            Action::Recover(Recovery::Navigate, Reason::Startup)
        );
    }
    #[test]
    fn protected_recording_and_dictation_defer_recovery_and_release_gets_grace() {
        let mut m = Monitor::new(0);
        reply(&mut m, 0);
        for now in [60_000, 120_000, 300_000] {
            assert_eq!(m.poll(now, false, true, true), Action::None);
        }
        assert_eq!(m.status(), "deferred");
        assert_eq!(m.poll(300_001, false, false, false), Action::None);
        assert_eq!(m.poll(330_000, true, false, false), Action::None);
        assert_eq!(
            m.poll(330_001, true, false, false),
            Action::Recover(Recovery::Navigate, Reason::Page)
        );
    }
    #[test]
    fn sleep_elapsed_time_does_not_count_as_hang_and_resume_invalidates_pending_probe() {
        assert!(resumed(100, 120_100, 100, 200));
        assert!(!resumed(100, 2_100, 100, 2_100));
        let mut m = Monitor::new(0);
        let Action::Probe(sequence) = m.poll(0, true, false, true) else {
            panic!()
        };
        m.resume(100);
        assert!(!m.reply(sequence, true, 101));
        assert!(!matches!(
            m.poll(30_000, false, false, false),
            Action::Recover(..)
        ));
        assert!(resumed(10_000, 9_999, 10_000, 11_999));
    }
    #[test]
    fn persisted_budget_blocks_loops_and_survives_backward_clock() {
        let entries = [
            Attempt {
                at: 1_000,
                recovery: Recovery::Restart,
            },
            Attempt {
                at: 2_000,
                recovery: Recovery::Restart,
            },
        ];
        assert!(!within_budget(&entries, 3_000, Recovery::Restart));
        assert!(!within_budget(&entries, 500, Recovery::Restart));
        assert!(within_budget(
            &entries,
            BUDGET_WINDOW_MS + 2_000,
            Recovery::Restart
        ));
        assert!(within_budget(&entries, 3_000, Recovery::Navigate));
        let mut m = Monitor::new(0);
        m.block();
        assert!(!matches!(
            m.poll(600_000, false, false, true),
            Action::Recover(..)
        ));
        m.stop();
        assert_eq!(m.poll(1_000_000, false, false, true), Action::None);
    }
    #[test]
    fn delayed_ready_pong_under_load_prevents_false_restart_while_rejecting_wrong_sequence() {
        let mut m = Monitor::new(0);
        reply(&mut m, 0);
        let Action::Probe(seq) = m.poll(10_000, true, false, true) else {
            panic!("Expected probe");
        };
        assert!(!m.reply_tolerant(seq + 1, true, 17_000));
        assert!(!m.reply_tolerant(seq, false, 17_000));
        let Action::Probe(newer) = m.poll(16_000, true, false, true) else {
            panic!("Expected a newer probe");
        };
        assert!(m.reply_tolerant(seq, true, 17_000));
        assert!(!m.reply_tolerant(seq, true, 17_000), "A duplicate is not fresh evidence");
        assert!(m.reply_tolerant(newer, true, 17_000), "The newer probe is still pending");
        assert_eq!(m.ages(17_000).0, 0);
        assert_eq!(m.status(), "watching");
    }
}
