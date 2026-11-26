use std::time::{Duration, Instant};

/// Two metadata reads for players which publish a thumbnail without a new event.
/// No timer remains after success, exhaustion, or a change to a non-GSMTC source.
pub struct CoverRetry {
    key: String,
    started: Instant,
    next: usize,
    active: bool,
}
const DELAYS: [Duration; 2] = [Duration::from_millis(400), Duration::from_millis(1200)];
impl Default for CoverRetry {
    fn default() -> Self {
        Self {
            key: String::new(),
            started: Instant::now(),
            next: 0,
            active: false,
        }
    }
}
impl CoverRetry {
    pub fn observe(&mut self, key: &str, missing: bool, now: Instant) {
        if self.key != key {
            self.key = key.to_owned();
            self.started = now;
            self.next = 0;
            self.active = !key.is_empty() && missing;
        } else if !missing {
            self.active = false;
        }
    }
    pub fn wait(&self, now: Instant) -> Option<Duration> {
        if !self.active || self.next >= DELAYS.len() {
            return None;
        }
        Some(DELAYS[self.next].saturating_sub(now.saturating_duration_since(self.started)))
    }
    pub fn take_due(&mut self, now: Instant) -> bool {
        if self.wait(now) != Some(Duration::ZERO) {
            return false;
        }
        self.next += 1;
        if self.next == DELAYS.len() {
            self.active = false;
        }
        true
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn retries_twice_then_sleeps_even_if_events_keep_arriving() {
        let now = Instant::now();
        let mut r = CoverRetry::default();
        r.observe("a", true, now);
        assert!(!r.take_due(now + Duration::from_millis(399)));
        assert!(r.take_due(now + DELAYS[0]));
        r.observe("a", true, now + Duration::from_millis(800));
        assert_eq!(
            r.wait(now + Duration::from_millis(800)),
            Some(Duration::from_millis(400))
        );
        assert!(r.take_due(now + DELAYS[1]));
        r.observe("a", true, now + Duration::from_secs(10));
        assert_eq!(r.wait(now + Duration::from_secs(10)), None);
    }
    #[test]
    fn successful_artwork_cancels_and_new_track_gets_its_own_budget() {
        let now = Instant::now();
        let mut r = CoverRetry::default();
        r.observe("a", true, now);
        r.observe("a", false, now);
        assert_eq!(r.wait(now), None);
        r.observe("b", true, now + Duration::from_secs(1));
        assert!(!r.take_due(now + Duration::from_millis(1200)));
        assert!(r.take_due(now + Duration::from_millis(1400)));
        r.observe("", false, now + Duration::from_secs(2));
        assert_eq!(r.wait(now + Duration::from_secs(2)), None);
    }
}
