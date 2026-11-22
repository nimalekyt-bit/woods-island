//! Fair ordering across isolated scanner processes. Discovery is complete even
//! when the time budget defers telemetry; a deferred read is never a USB loss.
use super::Device;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ScanReport {
    pub devices: Vec<Device>,
    #[serde(default)]
    pub discovered: BTreeSet<String>,
    #[serde(default)]
    pub visited: BTreeSet<String>,
}

#[derive(Default, Serialize, Deserialize)]
pub(super) struct ScanInventory {
    pub discovered: BTreeSet<String>,
    pub first: Option<String>,
}

#[derive(Default)]
pub(super) struct ScanQueue {
    round: u64,
    last_visit: BTreeMap<String, u64>,
}

impl ScanQueue {
    pub fn order(&self) -> Vec<String> {
        let mut entries: Vec<_> = self.last_visit.iter().collect();
        entries.sort_by(|(a, at), (b, bt)| at.cmp(bt).then_with(|| a.cmp(b)));
        entries.into_iter().map(|(id, _)| id.clone()).collect()
    }

    pub fn update(&mut self, scan: &ScanReport) {
        self.round = self.round.saturating_add(1);
        self.last_visit.retain(|id, _| scan.discovered.contains(id));
        for id in &scan.discovered {
            self.last_visit.entry(id.clone()).or_default();
        }
        for id in &scan.visited {
            if let Some(at) = self.last_visit.get_mut(id) {
                *at = self.round;
            }
        }
    }

    pub fn failed(&mut self, inventory: Option<ScanInventory>) {
        // A driver that stalls until the child is killed must not monopolize
        // every subsequent scan. This is scheduling, not connection evidence.
        let first = inventory.as_ref().and_then(|scan| scan.first.clone());
        if let Some(inventory) = inventory {
            self.update(&ScanReport {
                discovered: inventory.discovered,
                ..Default::default()
            });
        }
        let first = first
            .filter(|id| self.last_visit.contains_key(id))
            .or_else(|| self.order().first().cloned());
        if let Some(first) = first {
            self.round = self.round.saturating_add(1);
            self.last_visit.insert(first, self.round);
        }
    }
}

pub(super) fn ranks(order: &[String]) -> BTreeMap<&str, usize> {
    let mut result = BTreeMap::new();
    for (index, id) in order.iter().enumerate() {
        result.entry(id.as_str()).or_insert(index + 1);
    }
    result
}

pub(super) fn encoded_order(order: &[String]) -> String {
    // Leave ample space in Windows' environment block. Only the oldest entries
    // are sent; omitted entries follow them and cannot monopolize the budget.
    let mut ids = Vec::new();
    let mut size = 2;
    for id in order.iter().take(128) {
        let encoded = serde_json::to_string(id).unwrap();
        if id.len() > 512 || size + encoded.len() + 1 > 16 * 1024 {
            break;
        }
        size += encoded.len() + 1;
        ids.push(id);
    }
    serde_json::to_string(&ids).unwrap()
}

pub(super) fn decoded_order(value: &str) -> Vec<String> {
    if value.len() > 16 * 1024 {
        return Vec::new();
    }
    serde_json::from_str::<Vec<String>>(value)
        .unwrap_or_default()
        .into_iter()
        .filter(|id| !id.is_empty() && id.len() <= 512)
        .take(128)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    fn report(ids: &[&str], visited: &[&str]) -> ScanReport {
        ScanReport {
            discovered: ids.iter().map(|id| (*id).into()).collect(),
            visited: visited.iter().map(|id| (*id).into()).collect(),
            ..Default::default()
        }
    }
    #[test]
    fn slow_devices_cannot_starve_late_or_new_physical_devices() {
        let ids: Vec<_> = (0..20).map(|i| format!("mouse:{i:02}")).collect();
        let mut queue = ScanQueue::default();
        let mut all_visited = BTreeSet::new();
        for _ in 0..10 {
            let mut order = queue.order();
            if order.is_empty() {
                order = ids.clone();
            }
            let visited: BTreeSet<_> = order.into_iter().take(2).collect();
            all_visited.extend(visited.clone());
            queue.update(&ScanReport {
                discovered: ids.iter().cloned().collect(),
                visited,
                ..Default::default()
            });
        }
        assert_eq!(all_visited.len(), ids.len());
        queue.update(&report(&["new", "mouse:00", "mouse:01"], &["mouse:00"]));
        assert_eq!(queue.order().first().unwrap(), "new");
        assert_eq!(queue.order().len(), 3);
    }
    #[test]
    fn a_failed_child_moves_to_the_next_device_without_claiming_a_disconnect() {
        let mut queue = ScanQueue::default();
        queue.update(&report(&["one", "two"], &[]));
        queue.failed(None);
        assert_eq!(queue.order(), ["two", "one"]);
        queue.failed(None);
        assert_eq!(queue.order(), ["one", "two"]);
    }
    #[test]
    fn first_scan_failure_preserves_discovery_and_rotates_the_start() {
        let mut queue = ScanQueue::default();
        queue.failed(Some(ScanInventory {
            discovered: BTreeSet::from(["one".into(), "two".into(), "three".into()]),
            first: Some("one".into()),
        }));
        assert_eq!(queue.order(), ["three", "two", "one"]);
        queue.update(&report(&["one", "two"], &["two"]));
        assert_eq!(queue.order(), ["one", "two"]);
    }
    #[test]
    fn bounded_environment_order_cannot_starve_devices_beyond_the_first_128() {
        let ids: Vec<_> = (0..300).map(|i| format!("mouse:{i:03}")).collect();
        let mut queue = ScanQueue::default();
        let mut all_visited = BTreeSet::new();
        for _ in 0..150 {
            let order = decoded_order(&encoded_order(&queue.order()));
            let ranks = ranks(&order);
            let mut physical = ids.clone();
            physical.sort_by_key(|id| {
                (
                    ranks.get(id.as_str()).copied().unwrap_or(usize::MAX),
                    id.clone(),
                )
            });
            let visited: BTreeSet<_> = physical.into_iter().take(2).collect();
            all_visited.extend(visited.clone());
            queue.update(&ScanReport {
                discovered: ids.iter().cloned().collect(),
                visited,
                ..Default::default()
            });
        }
        assert_eq!(all_visited.len(), ids.len());
    }
    #[test]
    fn missing_and_duplicate_ids_keep_a_deterministic_group_order() {
        let order = vec!["two".into(), "one".into(), "two".into()];
        let ranks = ranks(&order);
        assert_eq!(ranks.get("two"), Some(&1));
        assert_eq!(ranks.get("one"), Some(&2));
        assert_eq!(ranks.get("new").copied().unwrap_or(usize::MAX), usize::MAX);
        let encoded = encoded_order(&order);
        assert_eq!(decoded_order(&encoded), order);
        assert!(decoded_order("[false]").is_empty());
        assert!(decoded_order(&"a".repeat(20 * 1024)).is_empty());
        assert!(encoded_order(&vec!["x".repeat(500); 128]).len() <= 16 * 1024);
    }
}
