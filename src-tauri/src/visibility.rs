use serde_json::Value;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Bounds {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}

/// Tucking animates the native hit rectangle. Visibility must use its unfolded
/// local rectangle or hiding itself would erase the overlap and reveal it again.
pub fn unfolded_bounds(current: Bounds, tucked: bool, previous: &mut Option<Bounds>) -> Bounds {
    if !tucked && current.right > current.left && current.bottom > current.top { *previous = Some(current); }
    if tucked { previous.unwrap_or(current) } else { current }
}
impl Bounds {
    pub fn from_json(value: &Value) -> Option<Self> {
        let values = value.as_array()?;
        if values.len() != 4 {
            return None;
        }
        Some(Self {
            left: i32::try_from(values[0].as_i64()?).ok()?,
            top: i32::try_from(values[1].as_i64()?).ok()?,
            right: i32::try_from(values[2].as_i64()?).ok()?,
            bottom: i32::try_from(values[3].as_i64()?).ok()?,
        })
    }
    pub fn intersects(self, other: Self) -> bool {
        self.left < other.right
            && self.right > other.left
            && self.top < other.bottom
            && self.bottom > other.top
    }
}
pub struct Policy {
    pub fullscreen: bool,
    pub shy: bool,
    pub keep: bool,
    pub desktop: bool,
    pub edge: bool,
}
pub fn resolve(settings: &Value, context: &Value) -> Policy {
    let executable = context["executable"].as_str().unwrap_or_default();
    let matches = |key: &str| {
        settings[key].as_array().is_some_and(|list| {
            list.iter()
                .filter_map(Value::as_str)
                .any(|name| !name.is_empty() && name.eq_ignore_ascii_case(executable))
        })
    };
    let keep = matches("keepForApps");
    let full = context["fullscreen"].as_bool().unwrap_or(false);
    let away = settings["hideOnlyUnder"].as_bool().unwrap_or(false) && context["under"] == false;
    let fullscreen = full && settings["hideInFullscreen"].as_bool().unwrap_or(true) && !keep;
    Policy {
        fullscreen,
        shy: !keep && (fullscreen || (matches("hideForApps") && !away)),
        keep,
        desktop: context["desktop"].as_bool().unwrap_or(false) || away,
        edge: !full || keep || settings["fullscreenEdge"].as_bool().unwrap_or(false),
    }
}
pub fn shortcut_settings(settings: &Value, suspended: bool) -> Value {
    let mut result = settings.clone();
    if settings["showVpn"] == false {
        if let Some(values) = result.as_object_mut() { values.remove("hotkeyVpn"); }
    }
    if suspended {
        if let Some(values) = result.as_object_mut() {
            values.retain(|key, _| {
                !key.starts_with("hotkey")
                    || ["hotkeyToggle", "hotkeyFullscreen"].contains(&key.as_str())
            });
        }
    }
    result
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MonitorDescriptor {
    pub name: String,
    pub left: i32,
    pub top: i32,
    pub width: i32,
    pub height: i32,
    pub primary: bool,
}

impl MonitorDescriptor {
    pub fn bounds(&self) -> Bounds {
        Bounds {
            left: self.left,
            top: self.top,
            right: self.left + self.width.max(1),
            bottom: self.top + self.height.max(1),
        }
    }

    pub fn contains_point(&self, x: i32, y: i32) -> bool {
        let b = self.bounds();
        x >= b.left && x < b.right && y >= b.top && y < b.bottom
    }
}

/// Picks the active monitor index for the island, honoring user preference,
/// optional cursor-following, and automatic evacuation away from a fullscreen
/// game/video onto a free secondary display.
pub fn select_target_monitor(
    monitors: &[MonitorDescriptor],
    preferred_name: &str,
    follow_cursor: bool,
    cursor_pos: Option<(i32, i32)>,
    fullscreen_move: bool,
    fullscreen_monitor: Option<Bounds>,
    island_expanded: bool,
) -> Option<usize> {
    if monitors.is_empty() {
        return None;
    }
    let preferred_idx = (!preferred_name.is_empty())
        .then(|| monitors.iter().position(|m| m.name == preferred_name))
        .flatten()
        .or_else(|| monitors.iter().position(|m| m.primary))
        .unwrap_or(0);

    if monitors.len() == 1 {
        return Some(preferred_idx);
    }

    let mut target = preferred_idx;
    if follow_cursor && !island_expanded {
        if let Some((cx, cy)) = cursor_pos {
            if let Some(cursor_idx) = monitors.iter().position(|m| m.contains_point(cx, cy)) {
                target = cursor_idx;
            }
        }
    }

    if fullscreen_move {
        if let Some(fs_bounds) = fullscreen_monitor {
            if monitors[target].bounds() == fs_bounds {
                // Prefer the user's preferred monitor if it is free, then primary, else any free display.
                if monitors[preferred_idx].bounds() != fs_bounds {
                    target = preferred_idx;
                } else if let Some(primary_idx) = monitors.iter().position(|m| m.primary && m.bounds() != fs_bounds) {
                    target = primary_idx;
                } else if let Some(free_idx) = monitors.iter().position(|m| m.bounds() != fs_bounds) {
                    target = free_idx;
                }
            }
        }
    }

    Some(target)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test] fn tucked_rectangle_does_not_oscillate_under_a_window() {
        let visible=Bounds{left:100,top:8,right:400,bottom:52};let mut previous=None;
        assert_eq!(unfolded_bounds(visible,false,&mut previous),visible);
        let tucked=Bounds{bottom:9,..visible};
        let window=Bounds{left:120,top:25,right:300,bottom:500};
        assert!(unfolded_bounds(tucked,true,&mut previous).intersects(window));
        assert!(unfolded_bounds(tucked,true,&mut previous).intersects(window));
        let moved=Bounds{left:500,right:800,..visible};
        assert!(!unfolded_bounds(moved,false,&mut previous).intersects(window));
    }
    #[test]
    fn recorder_key_names_match_the_native_shortcut_parser() {
        for key in [
            "Ctrl+Numpad1",
            "Ctrl+NumpadAdd",
            "Ctrl+Backquote",
            "Alt+Space",
            "Super+Shift+F8",
        ] {
            assert!(
                key.parse::<tauri_plugin_global_shortcut::Shortcut>()
                    .is_ok(),
                "{key}"
            );
        }
    }
    #[test]
    fn kept_apps_override_fullscreen_and_hide_list() {
        let p = resolve(
            &json!({"keepForApps":["game.exe"],"hideForApps":["game.exe"]}),
            &json!({"executable":"GAME.EXE","fullscreen":true,"under":true}),
        );
        assert!(p.keep && p.edge);
        assert!(!p.fullscreen && !p.shy);
    }
    #[test]
    fn only_under_preserves_an_island_beside_a_window() {
        let s = json!({"hideOnlyUnder":true,"hideForApps":["browser.exe"]});
        let c = json!({"executable":"browser.exe","under":false});
        let p = resolve(&s, &c);
        assert!(p.desktop && !p.shy);
        let mut c = c;
        c["under"] = json!(true);
        let p = resolve(&s, &c);
        assert!(!p.desktop && p.shy);
    }
    #[test]
    fn fullscreen_edge_is_opt_in() {
        let c = json!({"fullscreen":true});
        assert!(!resolve(&json!({}), &c).edge);
        assert!(resolve(&json!({"fullscreenEdge":true}), &c).edge);
        assert!(resolve(&json!({}), &json!({"fullscreen":false})).edge);
    }
    #[test]
    fn overlap_supports_negative_monitor_coordinates() {
        let anchor = Bounds {
            left: -1300,
            top: 0,
            right: -1000,
            bottom: 60,
        };
        assert!(anchor.intersects(Bounds {
            left: -1920,
            top: 0,
            right: 0,
            bottom: 1080
        }));
        assert!(!anchor.intersects(Bounds {
            left: 0,
            top: 0,
            right: 1920,
            bottom: 1080
        }));
        assert!(!anchor.intersects(Bounds {
            left: -1300,
            top: 60,
            right: -1000,
            bottom: 500
        }));
    }
    #[test]
    fn fullscreen_releases_tools_but_keeps_the_way_back() {
        let s = json!({"hotkeyToggle":"Alt+I","hotkeyFullscreen":"Alt+F","hotkeyArea":"PrintScreen","scale":100});
        let filtered = shortcut_settings(&s, true);
        assert!(filtered["hotkeyArea"].is_null());
        assert_eq!(filtered["hotkeyToggle"], "Alt+I");
        assert_eq!(filtered["scale"], 100);
        assert_eq!(shortcut_settings(&s, false), s);
    }
    #[test]
    fn disabled_vpn_releases_its_shortcut_without_erasing_the_saved_binding() {
        let s=json!({"showVpn":false,"hotkeyVpn":"Ctrl+Shift+V","hotkeyToggle":"Alt+I"});
        let filtered=shortcut_settings(&s,false);
        assert!(filtered["hotkeyVpn"].is_null());assert_eq!(filtered["hotkeyToggle"],"Alt+I");
        assert_eq!(s["hotkeyVpn"],"Ctrl+Shift+V");
    }
    #[test]
    fn smart_multimonitor_evacuates_fullscreen_and_returns_when_exited() {
        let monitors = vec![
            MonitorDescriptor { name: "DISPLAY1".into(), left: 0, top: 0, width: 3840, height: 2160, primary: true },
            MonitorDescriptor { name: "DISPLAY2".into(), left: -1920, top: 0, width: 1920, height: 1080, primary: false },
        ];
        let fs_on_main = Some(monitors[0].bounds());
        // Fullscreen on primary evacuates to secondary without oscillation.
        assert_eq!(select_target_monitor(&monitors, "", false, None, true, fs_on_main, false), Some(1));
        assert_eq!(select_target_monitor(&monitors, "DISPLAY1", false, None, true, fs_on_main, false), Some(1));
        // Exiting fullscreen returns smoothly to preferred primary.
        assert_eq!(select_target_monitor(&monitors, "DISPLAY1", false, None, true, None, false), Some(0));
        // Disabled fullscreen_move keeps primary.
        assert_eq!(select_target_monitor(&monitors, "DISPLAY1", false, None, false, fs_on_main, false), Some(0));
    }
    #[test]
    fn smart_multimonitor_follow_cursor_respects_expanded_panel_and_negative_coords() {
        let monitors = vec![
            MonitorDescriptor { name: "DISPLAY1".into(), left: 0, top: 0, width: 1920, height: 1080, primary: true },
            MonitorDescriptor { name: "DISPLAY2".into(), left: -1920, top: 0, width: 1920, height: 1080, primary: false },
        ];
        // Cursor on left negative-coord display moves island there when folded.
        assert_eq!(select_target_monitor(&monitors, "", true, Some((-500, 300)), false, None, false), Some(1));
        // Do not yank away while expanded.
        assert_eq!(select_target_monitor(&monitors, "", true, Some((-500, 300)), false, None, true), Some(0));
        // Fullscreen evacuation overrides cursor if cursor is inside fullscreen monitor.
        let fs_left = Some(monitors[1].bounds());
        assert_eq!(select_target_monitor(&monitors, "", true, Some((-500, 300)), true, fs_left, false), Some(0));
        // Single monitor never fails.
        assert_eq!(select_target_monitor(&monitors[..1], "", true, Some((100, 100)), true, Some(monitors[0].bounds()), false), Some(0));
    }
}
