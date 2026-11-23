//! Verified VPN link and command contracts; names are integrations, not branding.
pub(super) struct Protocol {
    pub id: &'static str,
    pub name: &'static str,
    pub scheme: &'static str,
    pub connect: &'static str,
    pub disconnect: &'static str,
    pub executable: &'static str,
}
pub(super) const PROTOCOLS: &[Protocol] = &[
    Protocol {
        id: "app:happ",
        name: "Happ",
        scheme: "happ",
        connect: "happ://connect",
        disconnect: "happ://disconnect",
        executable: "happ.exe",
    },
    Protocol {
        id: "app:v2raytun",
        name: "v2RayTun",
        scheme: "v2raytun",
        connect: "v2raytun://control/start",
        disconnect: "v2raytun://control/stop",
        executable: "v2raytun.exe",
    },
    Protocol {
        id: "app:karing",
        name: "Karing",
        scheme: "karing",
        connect: "karing://connect?background=true",
        disconnect: "karing://disconnect?background=true",
        executable: "karing.exe",
    },
];
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn known_protocols_preserve_the_verified_connect_disconnect_contracts() {
        assert_eq!(PROTOCOLS[0].connect, "happ://connect");
        assert_eq!(PROTOCOLS[0].disconnect, "happ://disconnect");
        assert_eq!(PROTOCOLS[1].connect, "v2raytun://control/start");
        assert_eq!(PROTOCOLS[1].disconnect, "v2raytun://control/stop");
        assert_eq!(PROTOCOLS[2].connect, "karing://connect?background=true");
        assert_eq!(
            PROTOCOLS[2].disconnect,
            "karing://disconnect?background=true"
        );
        for profile in PROTOCOLS {
            assert!(profile.id.starts_with("app:"));
            assert!(!profile.connect.chars().any(char::is_whitespace));
            assert_ne!(profile.connect, profile.disconnect);
        }
    }
}
