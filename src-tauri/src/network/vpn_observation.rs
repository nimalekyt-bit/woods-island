//! Pure custom-VPN attribution. A completed command alone is not connectivity.
use std::{
    collections::HashSet,
    time::{Duration, Instant},
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Tunnel {
    pub id: String,
    pub name: String,
    pub description: String,
    pub up: bool,
}

#[derive(Clone, Default, PartialEq, Eq)]
pub(super) struct Snapshot {
    pub tunnels: Vec<Tunnel>,
    /// Enabled server/PAC configuration; only held in memory, never exposed.
    pub proxy: Option<String>,
    pub tunnels_valid: bool,
    pub proxy_valid: bool,
}

#[derive(Default)]
pub(super) struct Observation {
    pub requested: Option<bool>,
    pending: Option<(Instant, Snapshot)>,
    owned_tunnels: HashSet<String>,
    owned_proxy: Option<String>,
    established: bool,
    named_established: bool,
}

fn words(value: &str) -> Vec<String> {
    value
        .to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|word| !word.is_empty())
        .map(str::to_owned)
        .collect()
}

pub(super) fn named_tunnel(name: &str, tunnel: &Tunnel) -> bool {
    let name = words(name);
    if name.is_empty()
        || name.iter().map(String::len).sum::<usize>() < 3
        || name.len() == 1
            && ["vpn", "proxy", "tun", "tunnel", "client", "network"].contains(&name[0].as_str())
    {
        return false;
    }
    [&tunnel.name, &tunnel.description].iter().any(|value| {
        words(value)
            .windows(name.len())
            .any(|window| window == name)
    })
}

impl Observation {
    pub fn command_completed(&mut self, on: bool, before: Snapshot, now: Instant) {
        self.requested = Some(on);
        self.pending = on.then_some((now, before));
    }

    pub fn status(&mut self, name: &str, current: &Snapshot, now: Instant) -> Option<bool> {
        if self.pending.as_ref().is_some_and(|(started, _)| {
            now.saturating_duration_since(*started) > Duration::from_secs(8)
        }) {
            self.pending = None;
        }
        if let Some((_, before)) = &self.pending {
            if before.tunnels_valid && current.tunnels_valid {
                let previously_up: HashSet<_> = before
                    .tunnels
                    .iter()
                    .filter(|t| t.up)
                    .map(|t| t.id.as_str())
                    .collect();
                for tunnel in current
                    .tunnels
                    .iter()
                    .filter(|t| t.up && !previously_up.contains(t.id.as_str()))
                {
                    self.owned_tunnels.insert(tunnel.id.clone());
                }
            }
            if before.proxy_valid
                && current.proxy_valid
                && current.proxy != before.proxy
                && current.proxy.is_some()
            {
                self.owned_proxy.clone_from(&current.proxy);
            }
        }
        let named = current
            .tunnels
            .iter()
            .filter(|t| named_tunnel(name, t))
            .collect::<Vec<_>>();
        let named_up = current.tunnels_valid && named.iter().any(|t| t.up);
        let owned_up = current.tunnels_valid
            && current
                .tunnels
                .iter()
                .any(|t| t.up && self.owned_tunnels.contains(&t.id));
        let proxy_up =
            current.proxy_valid && self.owned_proxy.is_some() && current.proxy == self.owned_proxy;
        if named_up || owned_up || proxy_up {
            self.established = true;
            self.named_established |= named_up;
            // The observed delta belongs to this command; don't claim later changes.
            self.pending = None;
            return Some(true);
        }
        let uncertain_tunnel =
            !current.tunnels_valid && (self.named_established || !self.owned_tunnels.is_empty());
        let uncertain_proxy = !current.proxy_valid && self.owned_proxy.is_some();
        if !uncertain_tunnel
            && !uncertain_proxy
            && (self.established || current.tunnels_valid && !named.is_empty())
        {
            return Some(false);
        }
        None
    }
}

pub(super) struct Profile<'a> {
    pub id: &'a str,
    pub ready: bool,
    pub active: Option<bool>,
}

pub(super) fn transition(
    target: &str,
    on: bool,
    profiles: &[Profile<'_>],
    mut execute: impl FnMut(&str, bool) -> Result<(), String>,
) -> Result<(), String> {
    let target_profile = profiles
        .iter()
        .find(|profile| profile.id == target)
        .ok_or("VPN profile is unavailable")?;
    if !target_profile.ready {
        return Err("Open this VPN client to manage its connection".into());
    }
    if on {
        for previous in profiles
            .iter()
            .filter(|profile| profile.id != target && profile.active == Some(true))
        {
            if !previous.ready {
                return Err("Disconnect the active VPN in its client before switching".into());
            }
            execute(previous.id, false)?;
        }
    }
    execute(target, on)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn tunnel(id: &str, name: &str, up: bool) -> Tunnel {
        Tunnel {
            id: id.into(),
            name: name.into(),
            description: "Wintun Userspace Tunnel".into(),
            up,
        }
    }
    fn snapshot(tunnels: Vec<Tunnel>, proxy: Option<&str>) -> Snapshot {
        Snapshot {
            tunnels,
            proxy: proxy.map(str::to_owned),
            tunnels_valid: true,
            proxy_valid: true,
        }
    }
    #[test]
    fn command_success_and_preexisting_other_tunnels_are_not_connectivity() {
        let now = Instant::now();
        let before = snapshot(
            vec![tunnel("other", "Other tunnel", true)],
            Some("other:8080"),
        );
        let mut o = Observation::default();
        o.command_completed(true, before.clone(), now);
        assert_eq!(o.status("My client", &before, now), None);
        o.command_completed(false, before.clone(), now);
        assert_eq!(o.status("My client", &before, now), None);
    }
    #[test]
    fn new_tunnel_is_attributed_then_disconnect_is_observed() {
        let now = Instant::now();
        let before = snapshot(vec![tunnel("other", "Other tunnel", true)], None);
        let mut o = Observation::default();
        o.command_completed(true, before.clone(), now);
        let connected = snapshot(
            vec![
                tunnel("other", "Other tunnel", true),
                tunnel("mine", "Unnamed TUN", true),
            ],
            None,
        );
        assert_eq!(
            o.status("Quattro", &connected, now + Duration::from_secs(2)),
            Some(true)
        );
        o.command_completed(false, connected.clone(), now + Duration::from_secs(3));
        assert_eq!(
            o.status("Quattro", &connected, now + Duration::from_secs(4)),
            Some(true)
        );
        assert_eq!(
            o.status("Quattro", &before, now + Duration::from_secs(5)),
            Some(false)
        );
    }
    #[test]
    fn only_changed_enabled_proxy_is_attributed_and_changes_are_bounded_in_time() {
        let now = Instant::now();
        let before = snapshot(vec![], None);
        let mut o = Observation::default();
        o.command_completed(true, before.clone(), now);
        assert_eq!(
            o.status(
                "Quattro",
                &snapshot(vec![], Some("127.0.0.1:7890")),
                now + Duration::from_secs(2)
            ),
            Some(true)
        );
        assert_eq!(
            o.status(
                "Quattro",
                &snapshot(vec![], Some("other:8080")),
                now + Duration::from_secs(3)
            ),
            Some(false)
        );
        let mut late = Observation::default();
        late.command_completed(true, before, now);
        assert_eq!(
            late.status(
                "Quattro",
                &snapshot(vec![tunnel("new", "Other tunnel", true)], None),
                now + Duration::from_secs(9)
            ),
            None
        );
    }
    #[test]
    fn failed_inventory_never_turns_a_verified_connection_into_off() {
        let now = Instant::now();
        let mut o = Observation::default();
        o.command_completed(true, snapshot(vec![], None), now);
        assert_eq!(
            o.status(
                "Quattro",
                &snapshot(vec![tunnel("new", "Unnamed", true)], None),
                now
            ),
            Some(true)
        );
        assert_eq!(
            o.status(
                "Quattro",
                &Snapshot {
                    tunnels_valid: false,
                    proxy_valid: true,
                    ..Snapshot::default()
                },
                now
            ),
            None
        );
    }
    #[test]
    fn named_detection_is_specific_and_supports_down_adapters() {
        let mut o = Observation::default();
        let now = Instant::now();
        assert_eq!(
            o.status(
                "My Client",
                &snapshot(vec![tunnel("mine", "My Client TUN", true)], None),
                now
            ),
            Some(true)
        );
        assert_eq!(
            o.status(
                "My Client",
                &snapshot(vec![tunnel("mine", "My Client TUN", false)], None),
                now
            ),
            Some(false)
        );
        assert!(!named_tunnel("VPN", &tunnel("other", "Other VPN", true)));
        assert!(!named_tunnel("Mine", &tunnel("other", "OtherMine", true)));
    }
    #[test]
    fn switching_disconnects_the_previous_client_before_connecting_the_selected_client() {
        let profiles = [
            Profile {
                id: "old",
                ready: true,
                active: Some(true),
            },
            Profile {
                id: "new",
                ready: true,
                active: Some(false),
            },
        ];
        let mut calls = vec![];
        transition("new", true, &profiles, |id, on| {
            calls.push((id.to_owned(), on));
            Ok(())
        })
        .unwrap();
        assert_eq!(
            calls,
            vec![("old".to_owned(), false), ("new".to_owned(), true)]
        );
    }
    #[test]
    fn disconnect_failure_or_unmanaged_active_client_never_connects_a_new_client() {
        let mut profiles = [
            Profile {
                id: "old",
                ready: true,
                active: Some(true),
            },
            Profile {
                id: "new",
                ready: true,
                active: Some(false),
            },
        ];
        let mut calls = vec![];
        assert!(transition("new", true, &profiles, |id, on| {
            calls.push((id.to_owned(), on));
            Err("denied".into())
        })
        .is_err());
        assert_eq!(calls, vec![("old".to_owned(), false)]);
        profiles[0].ready = false;
        calls.clear();
        assert!(transition("new", true, &profiles, |id, on| {
            calls.push((id.to_owned(), on));
            Ok(())
        })
        .is_err());
        assert!(calls.is_empty());
    }
    #[test]
    fn selecting_the_current_client_can_disconnect_without_reconnecting_or_affecting_others() {
        let profiles = [
            Profile {
                id: "old",
                ready: true,
                active: Some(true),
            },
            Profile {
                id: "new",
                ready: true,
                active: Some(false),
            },
        ];
        let mut calls = vec![];
        transition("old", false, &profiles, |id, on| {
            calls.push((id.to_owned(), on));
            Ok(())
        })
        .unwrap();
        assert_eq!(calls, vec![("old".to_owned(), false)]);
    }
}
