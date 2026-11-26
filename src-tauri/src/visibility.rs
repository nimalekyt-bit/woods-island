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
}
