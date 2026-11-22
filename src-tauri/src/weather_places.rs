use serde_json::{json, Value};

const LIMIT: usize = 8;

fn place(
    name: &Value,
    lat: &Value,
    lon: &Value,
    timezone: &Value,
    offset: &Value,
) -> Option<Value> {
    let name = name.as_str()?.trim();
    let lat = lat.as_f64()?;
    let lon = lon.as_f64()?;
    if name.is_empty()
        || name.len() > 512
        || !lat.is_finite()
        || !lon.is_finite()
        || !(-90.0..=90.0).contains(&lat)
        || !(-180.0..=180.0).contains(&lon)
    {
        return None;
    }
    let zone = timezone.as_str().unwrap_or_default();
    let zone = if zone.is_empty() || zone.parse::<chrono_tz::Tz>().is_ok() {
        zone
    } else {
        ""
    };
    let offset = offset.as_i64().filter(|n| (-86399..=86399).contains(n));
    Some(json!({"name":name,"lat":lat,"lon":lon,"timezone":zone,"utcOffset":offset}))
}

fn current(settings: &Value) -> Option<Value> {
    place(
        &settings["weatherCity"],
        &settings["weatherLat"],
        &settings["weatherLon"],
        &settings["weatherTimezone"],
        &settings["weatherUtcOffset"],
    )
}

fn same(a: &Value, b: &Value) -> bool {
    (a["lat"].as_f64().unwrap() - b["lat"].as_f64().unwrap()).abs() < 0.0001
        && (a["lon"].as_f64().unwrap() - b["lon"].as_f64().unwrap()).abs() < 0.0001
}

/// The settings owner keeps history so both windows and older settings files agree.
pub fn remember(before: &Value, updated: &mut Value) {
    let changed = [
        "weatherCity",
        "weatherLat",
        "weatherLon",
        "weatherTimezone",
        "weatherUtcOffset",
    ]
    .iter()
    .any(|key| before[*key] != updated[*key]);
    let history = if changed {
        &before["weatherPlaces"]
    } else {
        &updated["weatherPlaces"]
    };
    let parsed = history
        .as_str()
        .and_then(|text| {
            if text.len() > 16384 {
                return None;
            }
            serde_json::from_str::<Value>(text).ok()
        })
        .unwrap_or(Value::Null);
    let mut candidates = Vec::new();
    if let Some(value) = current(updated) {
        candidates.push(value);
    }
    if changed {
        if let Some(value) = current(before) {
            candidates.push(value);
        }
    }
    if let Some(entries) = parsed.as_array() {
        candidates.extend(entries.iter().filter_map(|v| {
            place(
                &v["name"],
                &v["lat"],
                &v["lon"],
                &v["timezone"],
                &v["utcOffset"],
            )
        }));
    }
    let mut places = Vec::new();
    for value in candidates {
        if !places.iter().any(|other| same(&value, other)) {
            places.push(value);
        }
        if places.len() == LIMIT {
            break;
        }
    }
    updated["weatherPlaces"] = json!(serde_json::to_string(&places).unwrap());
}

#[cfg(test)]
mod tests {
    use super::*;
    fn city(name: &str, lat: f64, zone: &str) -> Value {
        json!({"weatherCity":name,"weatherLat":lat,"weatherLon":0.,"weatherTimezone":zone,"weatherPlaces":"[]"})
    }
    fn history(value: &Value) -> Vec<Value> {
        serde_json::from_str(value["weatherPlaces"].as_str().unwrap()).unwrap()
    }
    #[test]
    fn migration_and_switch_preserve_city_timezone() {
        let old = city("London", 51.5, "Europe/London");
        let mut next = city("Tokyo", 35.68, "Asia/Tokyo");
        remember(&old, &mut next);
        let places = history(&next);
        assert_eq!(places.len(), 2);
        assert_eq!(places[0]["name"], "Tokyo");
        assert_eq!(places[1]["timezone"], "Europe/London");
        let mut renamed = next.clone();
        renamed["weatherCity"] = json!("東京都");
        renamed["weatherLat"] = json!(35.68001);
        remember(&next, &mut renamed);
        assert_eq!(history(&renamed).len(), 2);
    }
    #[test]
    fn recent_first_limit_and_unrelated_saves() {
        let mut saved = city("Initial", 0., "");
        for n in 1..12 {
            let mut next = city(&format!("City {n}"), n as f64, "");
            remember(&saved, &mut next);
            saved = next;
        }
        let places = history(&saved);
        assert_eq!(places.len(), 8);
        assert_eq!(places[0]["name"], "City 11");
        assert_eq!(places[7]["name"], "City 4");
        let mut next = saved.clone();
        next["weatherUnits"] = json!("imperial");
        remember(&saved, &mut next);
        assert_eq!(history(&next), places);
    }
    #[test]
    fn malformed_history_does_not_break_settings() {
        let mut saved = city("Here", 1., "");
        saved["weatherPlaces"] = json!("not json");
        remember(&saved.clone(), &mut saved);
        assert_eq!(history(&saved).len(), 1);
        saved["weatherPlaces"] = json!(
            r#"[{"name":"Bad","lat":999,"lon":0},{"name":"Good","lat":2,"lon":0,"timezone":"invalid"}]"#
        );
        remember(&saved.clone(), &mut saved);
        let places = history(&saved);
        assert_eq!(places.len(), 2);
        assert_eq!(places[1]["timezone"], "");
    }
}
