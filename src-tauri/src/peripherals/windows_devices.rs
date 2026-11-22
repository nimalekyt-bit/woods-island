//! Windows SetupAPI inventory and HID Usage Tables battery descriptors.
use super::compx;
use super::dareu;
use super::dareu_em901x;
use super::dareu_tg;
use super::hyperx;
use super::keyboard_usb;
use super::rongyuan;
use super::schedule::{self, ScanReport};
use super::steelseries;
use super::Device;
use std::collections::BTreeMap;
use std::time::Instant;
use windows::core::{GUID, PCWSTR};
use windows::Win32::Devices::DeviceAndDriverInstallation::*;
use windows::Win32::Devices::HumanInterfaceDevice::*;
use windows::Win32::Devices::Properties::*;
use windows::Win32::Foundation::{CloseHandle, HANDLE, WAIT_OBJECT_0};
use windows::Win32::Storage::FileSystem::*;
use windows::Win32::System::Threading::{
    CreateEventW, OpenProcess, WaitForSingleObject, PROCESS_SYNCHRONIZE,
};
use windows::Win32::System::IO::*;

const BATTERY: DEVPROPKEY = DEVPROPKEY {
    fmtid: GUID::from_u128(0x104ea319_6ee2_4701_bd47_8ddbf425bbe5),
    pid: 2,
};
const CONNECTED: DEVPROPKEY = DEVPROPKEY {
    fmtid: GUID::from_u128(0x83da6326_97a6_4088_9453_a1923f573b29),
    pid: 15,
};
const CLASS_OF_DEVICE: DEVPROPKEY = DEVPROPKEY {
    fmtid: GUID::from_u128(0x2bd67d8b_8beb_48d5_87e0_6cda340a040a),
    pid: 10,
};
const IOCTL_GET_FEATURE: u32 = 0x000b0192;
const IOCTL_SET_FEATURE: u32 = 0x000b0191;
const IOCTL_GET_INPUT: u32 = 0x000b01a2;

struct Info(HDEVINFO);
impl Drop for Info {
    fn drop(&mut self) {
        unsafe {
            let _ = SetupDiDestroyDeviceInfoList(self.0);
        }
    }
}
struct File(HANDLE);
impl Drop for File {
    fn drop(&mut self) {
        unsafe {
            let _ = CloseHandle(self.0);
        }
    }
}
struct Parsed(PHIDP_PREPARSED_DATA);
impl Drop for Parsed {
    fn drop(&mut self) {
        unsafe {
            HidD_FreePreparsedData(self.0);
        }
    }
}

pub(super) fn guard_scanner() -> Result<(), String> {
    let Ok(parent) = std::env::var("WOODS_PERIPHERAL_PARENT_PID") else {
        return Ok(());
    };
    let parent = parent
        .parse::<u32>()
        .ok()
        .filter(|pid| *pid != 0 && *pid != std::process::id())
        .ok_or("Invalid scanner parent")?;
    let handle =
        unsafe { OpenProcess(PROCESS_SYNCHRONIZE, false, parent) }.map_err(|e| e.to_string())?;
    // Transfer this owned process handle to the watchdog thread as an integer;
    // File closes it there. No device or audio handle is shared with the guard.
    let raw = handle.0 as usize;
    if let Err(error) = std::thread::Builder::new()
        .name("scanner-guard".into())
        .spawn(move || {
            let parent = File(HANDLE(raw as *mut _));
            unsafe {
                WaitForSingleObject(parent.0, 8000);
            }
            // Parent exit, timeout or wait failure all end only this scan process.
            std::process::exit(1);
        })
    {
        unsafe {
            let _ = CloseHandle(handle);
        }
        return Err(error.to_string());
    }
    Ok(())
}

unsafe fn property(
    info: &Info,
    item: &SP_DEVINFO_DATA,
    key: &DEVPROPKEY,
) -> Option<(DEVPROPTYPE, Vec<u8>)> {
    let mut kind = DEVPROPTYPE::default();
    let mut bytes = vec![0; 4096];
    let mut used = 0;
    SetupDiGetDevicePropertyW(
        info.0,
        item,
        key,
        &mut kind,
        Some(&mut bytes),
        Some(&mut used),
        0,
    )
    .ok()?;
    bytes.truncate(used as usize);
    Some((kind, bytes))
}
fn utf16(bytes: &[u8]) -> String {
    String::from_utf16_lossy(
        &bytes
            .chunks_exact(2)
            .map(|b| u16::from_le_bytes([b[0], b[1]]))
            .take_while(|v| *v != 0)
            .collect::<Vec<_>>(),
    )
}
unsafe fn text(info: &Info, item: &SP_DEVINFO_DATA, key: &DEVPROPKEY) -> Option<String> {
    let (kind, bytes) = property(info, item, key)?;
    if kind != DEVPROP_TYPE_STRING {
        return None;
    }
    let value = utf16(&bytes);
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}
unsafe fn identity(info: &Info, item: &SP_DEVINFO_DATA, instance: &str) -> String {
    if let Some((kind, bytes)) = property(info, item, &DEVPKEY_Device_ContainerId) {
        if kind == DEVPROP_TYPE_GUID && bytes.len() == 16 && bytes.iter().any(|b| *b != 0) {
            return format!(
                "container:{}",
                bytes.iter().map(|b| format!("{b:02x}")).collect::<String>()
            );
        }
    }
    format!("instance:{}", instance.to_ascii_lowercase())
}
unsafe fn instance(info: &Info, item: &SP_DEVINFO_DATA) -> Option<String> {
    let mut buffer = [0u16; 1024];
    SetupDiGetDeviceInstanceIdW(info.0, item, Some(&mut buffer), None).ok()?;
    Some(String::from_utf16_lossy(
        &buffer[..buffer.iter().position(|v| *v == 0).unwrap_or(buffer.len())],
    ))
}
unsafe fn connection(info: &Info, item: &SP_DEVINFO_DATA) -> Option<bool> {
    let (kind, bytes) = property(info, item, &CONNECTED)?;
    if kind == DEVPROP_TYPE_BOOLEAN {
        bytes.first().map(|b| *b != 0)
    } else {
        None
    }
}
fn class_kind(value: u32) -> &'static str {
    match (value >> 8) & 31 {
        4 => "headset",
        5 if value & 0x40 != 0 => "keyboard",
        5 if value & 0x80 != 0 => "mouse",
        5 if value & 0x0c == 8 => "gamepad",
        _ => "other",
    }
}
fn name_kind(name: &str) -> &'static str {
    let name = name.to_lowercase();
    if name.contains("keyboard") || name.contains("клавиат") {
        "keyboard"
    } else if name.contains("mouse") || name.contains("мыш") {
        "mouse"
    } else if name.contains("head") || name.contains("earbud") || name.contains("науш") {
        "headset"
    } else if name.contains("gamepad") || name.contains("controller") {
        "gamepad"
    } else {
        "other"
    }
}
fn merge(devices: &mut BTreeMap<String, Device>, mut next: Device) {
    let vendor = is_vendor_source(&next.source);
    if next.connected.is_some() {
        next.connection_priority = if vendor {
            3
        } else if next.source == "windows" {
            2
        } else {
            1
        };
    }
    if let Some(previous) = devices.get_mut(&next.id) {
        if previous.kind == "other" && next.kind != "other" {
            previous.kind = next.kind;
        }
        if next.connected.is_some()
            && (previous.connected.is_none()
                || next.connection_priority >= previous.connection_priority)
        {
            previous.connected = next.connected;
            previous.connection_priority = next.connection_priority;
        }
        if next.percent.is_some()
            && (previous.percent.is_none()
                || battery_source_priority(&next.source)
                    > battery_source_priority(&previous.source))
        {
            previous.percent = next.percent;
            previous.source = next.source.clone();
            previous.battery_status = next.battery_status;
            previous.last_read_at = next.last_read_at;
            previous.unavailable_reason = next.unavailable_reason;
        }
        if next.charging_read_at.is_some() {
            previous.charging = next.charging;
            previous.charging_read_at = next.charging_read_at;
        }
        if previous.name.starts_with("HID") || previous.name == "Bluetooth device" || vendor {
            previous.name = next.name;
            previous.reported_name = next.reported_name;
        }
        if previous.transport == "usb" && next.transport != "usb" {
            previous.transport = next.transport;
        }
    } else {
        next.name = next.name.chars().take(256).collect();
        devices.insert(next.id.clone(), next);
    }
}

fn battery_source_priority(source: &str) -> u8 {
    match source {
        "windows" => 3,
        "hid" => 1,
        value if is_vendor_source(value) => 2,
        _ => 0,
    }
}
fn is_vendor_source(source: &str) -> bool {
    matches!(
        source,
        "dareu-jm"
            | "dareu-tg"
            | "dareu-em901x"
            | "sonix"
            | "semico"
            | "rongyuan"
            | "steelseries"
            | "compx"
    )
}

unsafe fn rongyuan_receiver(
    path: PCWSTR,
    attributes: &HIDD_ATTRIBUTES,
    caps: &HIDP_CAPS,
    parsed: &Parsed,
    instance: &str,
    id: &str,
    name: &str,
) -> Option<Vec<Device>> {
    if !rongyuan::receiver(attributes.VendorID, attributes.ProductID)
        || !instance.to_ascii_uppercase().contains("&MI_02")
        || (caps.UsagePage, caps.Usage, caps.FeatureReportByteLength) != (0xffff, 2, 65)
        || !report_ids(
            parsed,
            HidP_Feature,
            caps.NumberFeatureValueCaps,
            caps.NumberFeatureButtonCaps,
        )
        .contains(&0)
    {
        return None;
    }
    let file = File(
        CreateFileW(
            path,
            0xc0000000,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            None,
            OPEN_EXISTING,
            FILE_FLAG_OVERLAPPED,
            None,
        )
        .ok()?,
    );
    for _ in 0..2 {
        set_feature(&file, &rongyuan::request())?;
        std::thread::sleep(std::time::Duration::from_millis(20));
        let bytes = report(&file, 0, rongyuan::REPORT_SIZE, IOCTL_GET_FEATURE)?;
        let Some(slots) = rongyuan::slots(&bytes) else {
            continue;
        };
        let mut parent = Device::new(id.into(), name.into(), "other", "receiver");
        parent.source = "inventory-ry".into();
        let mut result = vec![parent];
        for slot in slots {
            // Unused slots are not devices; the worker retains previously observed endpoints.
            if !slot.connected {
                continue;
            }
            let display = if slot.kind == "mouse"
                && (attributes.VendorID, attributes.ProductID) == (0x3151, 0x402d)
            {
                "Attack Shark R3".into()
            } else {
                format!(
                    "{name} · {}",
                    if slot.kind == "keyboard" {
                        "Keyboard"
                    } else {
                        "Mouse"
                    }
                )
            };
            let mut device = Device::new(
                format!("{id}:ry:{}", slot.kind),
                display,
                slot.kind,
                "receiver",
            );
            device.source = "rongyuan".into();
            device.connected = Some(true);
            device.reported_name = Some(name.into());
            if let Some(percent) = slot.percent {
                device.battery(percent, "rongyuan");
            }
            // Neither cable presence nor percentage jumps prove charging.
            result.push(device);
        }
        return Some(result);
    }
    None
}

unsafe fn hyperx_headset(
    path: PCWSTR,
    attributes: &HIDD_ATTRIBUTES,
    caps: &HIDP_CAPS,
    parsed: &Parsed,
    id: &str,
    name: &str,
) -> Option<Device> {
    let model = hyperx::model(attributes.VendorID, attributes.ProductID)?;
    if !model.accepts(
        caps.UsagePage,
        caps.InputReportByteLength,
        caps.OutputReportByteLength,
    ) || !report_ids(
        parsed,
        HidP_Input,
        caps.NumberInputValueCaps,
        caps.NumberInputButtonCaps,
    )
    .contains(&hyperx::REPORT_ID)
        || !report_ids(
            parsed,
            HidP_Output,
            caps.NumberOutputValueCaps,
            caps.NumberOutputButtonCaps,
        )
        .contains(&hyperx::REPORT_ID)
    {
        return None;
    }
    let file = File(
        CreateFileW(
            path,
            0xc0000000,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            None,
            OPEN_EXISTING,
            FILE_FLAG_OVERLAPPED,
            None,
        )
        .ok()?,
    );
    let query = |command: hyperx::Query| {
        if !HidD_FlushQueue(file.0).as_bool() {
            return None;
        }
        let mut request = command.request(caps.OutputReportByteLength as usize)?;
        transfer(&file, &mut request, true)?;
        let began = Instant::now();
        for _ in 0..3 {
            if began.elapsed().as_millis() >= 800 {
                break;
            }
            let mut reply = vec![0; caps.InputReportByteLength as usize];
            transfer(&file, &mut reply, false)?;
            if let Some(value) = command.value(&reply) {
                return Some(value);
            }
        }
        None
    };
    let mut device = Device::new(id.into(), model.name.into(), "headset", "receiver");
    device.reported_name = Some(name.into());
    device.connected = query(hyperx::Query::Connection).map(|value| value == 1);
    // The receiver may retain a previous battery level while the headset is off.
    // Require a fresh positive radio status before querying charging or battery.
    if device.connected == Some(true) {
        device.charging = query(hyperx::Query::Charging).map(|value| value == 1);
        if device.charging.is_some() {
            device.charging_read_at = Some(crate::media::now_ms());
        }
        if let Some(percent) = query(hyperx::Query::Battery) {
            device.battery(percent, "hyperx-cloud");
        }
    }
    Some(device)
}

unsafe fn compx_mouse(
    path: PCWSTR,
    attributes: &HIDD_ATTRIBUTES,
    caps: &HIDP_CAPS,
    parsed: &Parsed,
    id: &str,
    name: &str,
) -> Option<Device> {
    let model = compx::model(attributes.VendorID, attributes.ProductID)?;
    if caps.UsagePage < 0xff00
        || (caps.InputReportByteLength, caps.OutputReportByteLength) != (17, 17)
        || report_ids(
            parsed,
            HidP_Input,
            caps.NumberInputValueCaps,
            caps.NumberInputButtonCaps,
        ) != [8]
        || report_ids(
            parsed,
            HidP_Output,
            caps.NumberOutputValueCaps,
            caps.NumberOutputButtonCaps,
        ) != [8]
    {
        return None;
    }
    let file = File(
        CreateFileW(
            path,
            0xc0000000,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            None,
            OPEN_EXISTING,
            FILE_FLAG_OVERLAPPED,
            None,
        )
        .ok()?,
    );
    let query = |command: compx::Query| {
        if !HidD_FlushQueue(file.0).as_bool() {
            return None;
        }
        let mut request = command.request();
        transfer(&file, &mut request, true)?;
        for _ in 0..3 {
            let mut reply = [0; compx::REPORT_SIZE];
            transfer(&file, &mut reply, false)?;
            if command.valid(&reply) {
                return Some(reply);
            }
        }
        None
    };
    let connection = query(compx::Query::Connection);
    let connected = connection.as_ref().and_then(|r| compx::connection(r));
    let battery = if connected == Some(false) {
        None
    } else {
        query(compx::Query::Battery).and_then(|r| compx::battery(&r))
    };
    if connection.is_none() && battery.is_none() {
        return None;
    }
    let generic = name.to_ascii_lowercase();
    let display = if (model.name.starts_with("COMPX")
        || model.name.starts_with("ATK/VXE")
        || model.name.starts_with("Pulsar")
        || model.name.starts_with("HECATE"))
        && !generic.contains("receiver")
        && !generic.contains("dongle")
        && !generic.contains("wireless mouse")
    {
        name
    } else {
        model.name
    };
    let mut device = Device::new(
        id.into(),
        display.into(),
        "mouse",
        if model.wired { "usb" } else { "receiver" },
    );
    device.source = "compx".into();
    device.reported_name = Some(name.into());
    device.connected = connected;
    if let Some((percent, charging)) = battery {
        if let Some(percent) = percent {
            device.battery(percent, "compx");
        }
        device.charging = charging;
        if charging.is_some() {
            device.charging_read_at = Some(crate::media::now_ms());
        }
    }
    Some(device)
}

unsafe fn steelseries_mouse(
    path: PCWSTR,
    attributes: &HIDD_ATTRIBUTES,
    caps: &HIDP_CAPS,
    parsed: &Parsed,
    instance: &str,
    id: &str,
    name: &str,
) -> Option<Device> {
    let model = steelseries::model(attributes.VendorID, attributes.ProductID)?;
    let upper = instance.to_ascii_uppercase();
    let interface = u8::from_str_radix(upper.split("&MI_").nth(1)?.get(..2)?, 16).ok()?;
    if !model.accepts(
        interface,
        caps.UsagePage,
        caps.Usage,
        caps.InputReportByteLength,
        caps.OutputReportByteLength,
    ) || report_ids(
        parsed,
        HidP_Input,
        caps.NumberInputValueCaps,
        caps.NumberInputButtonCaps,
    ) != [0]
        || report_ids(
            parsed,
            HidP_Output,
            caps.NumberOutputValueCaps,
            caps.NumberOutputButtonCaps,
        ) != [0]
    {
        return None;
    }
    let file = File(
        CreateFileW(
            path,
            0xc0000000,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            None,
            OPEN_EXISTING,
            FILE_FLAG_OVERLAPPED,
            None,
        )
        .ok()?,
    );
    // Configuration acknowledgements queued by another app are not battery readings.
    if !HidD_FlushQueue(file.0).as_bool() {
        return None;
    }
    let mut request = model.request(caps.OutputReportByteLength as usize)?;
    transfer(&file, &mut request, true)?;
    for _ in 0..3 {
        let mut bytes = vec![0; caps.InputReportByteLength as usize];
        transfer(&file, &mut bytes, false)?;
        if bytes == request {
            continue;
        }
        let Some(reading) = model.reply(&bytes) else {
            continue;
        };
        let mut device = Device::new(
            id.into(),
            format!("SteelSeries {}", model.name),
            "mouse",
            if model.wired { "usb" } else { "receiver" },
        );
        device.source = "steelseries".into();
        device.reported_name = Some(name.into());
        device.connected = reading.connected;
        if let Some(percent) = reading.percent {
            device.battery(percent, "steelseries");
        }
        device.charging = reading.charging;
        if reading.charging.is_some() {
            device.charging_read_at = Some(crate::media::now_ms());
        }
        return Some(device);
    }
    None
}

unsafe fn usb_keyboard(
    path: PCWSTR,
    attributes: &HIDD_ATTRIBUTES,
    caps: &HIDP_CAPS,
    parsed: &Parsed,
    instance: &str,
    id: &str,
    name: &str,
) -> Option<Device> {
    let upper = instance.to_ascii_uppercase();
    let mi = upper.split("&MI_").nth(1)?.get(..2)?;
    let interface = u8::from_str_radix(mi, 16).ok()?;
    let protocol = keyboard_usb::identify(
        attributes.VendorID,
        attributes.ProductID,
        interface,
        caps.UsagePage,
        caps.Usage,
        caps.InputReportByteLength,
        caps.OutputReportByteLength,
    )?;
    if !report_ids(
        parsed,
        HidP_Input,
        caps.NumberInputValueCaps,
        caps.NumberInputButtonCaps,
    )
    .contains(&0)
        || !report_ids(
            parsed,
            HidP_Output,
            caps.NumberOutputValueCaps,
            caps.NumberOutputButtonCaps,
        )
        .contains(&0)
    {
        return None;
    }
    let file = File(
        CreateFileW(
            path,
            0xc0000000,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            None,
            OPEN_EXISTING,
            FILE_FLAG_OVERLAPPED,
            None,
        )
        .ok()?,
    );
    let mut request = protocol.request();
    transfer(&file, &mut request, true)?;
    for _ in 0..2 {
        let mut bytes = vec![0; protocol.size()];
        transfer(&file, &mut bytes, false)?;
        if bytes == request {
            continue;
        }
        let Some(reading) = protocol.reply(&bytes) else {
            continue;
        };
        let wired = attributes.VendorID == 0x1a2c && attributes.ProductID != 0x8fff;
        let display = keyboard_usb::cable_name(attributes.VendorID, attributes.ProductID)
            .unwrap_or_else(|| name.strip_suffix(" 2.4G").unwrap_or(name));
        let mut device = Device::new(
            id.into(),
            display.into(),
            "keyboard",
            if wired { "usb" } else { "receiver" },
        );
        device.source = protocol.source().into();
        device.connected = reading.connected;
        device.reported_name = Some(name.into());
        if let Some(percent) = reading.percent {
            device.battery(percent, protocol.source());
        }
        // These protocols do not establish an unambiguous charging bit.
        return Some(device);
    }
    None
}

pub(super) fn scan() -> Result<Vec<Device>, String> {
    Ok(scan_ordered(&[])?.devices)
}

pub(super) fn scan_ordered(order: &[String]) -> Result<ScanReport, String> {
    let mut devices = BTreeMap::new();
    let mut scan = ScanReport::default();
    unsafe {
        let info = Info(
            SetupDiGetClassDevsW(None, PCWSTR::null(), None, DIGCF_ALLCLASSES | DIGCF_PRESENT)
                .map_err(|e| e.to_string())?,
        );
        let mut index = 0;
        loop {
            let mut item = SP_DEVINFO_DATA {
                cbSize: std::mem::size_of::<SP_DEVINFO_DATA>() as u32,
                ..Default::default()
            };
            if SetupDiEnumDeviceInfo(info.0, index, &mut item).is_err() {
                break;
            }
            index += 1;
            let Some(instance) = instance(&info, &item) else {
                continue;
            };
            let upper = instance.to_ascii_uppercase();
            if !upper.starts_with("BTHENUM\\")
                && !upper.starts_with("BTHLE\\")
                && !upper.starts_with("BTHLEDEVICE\\")
            {
                continue;
            }
            let percent = property(&info, &item, &BATTERY).and_then(|(kind, bytes)| {
                if kind == DEVPROP_TYPE_BYTE {
                    bytes.first().copied().filter(|v| *v <= 100)
                } else {
                    None
                }
            });
            let connected = connection(&info, &item);
            let name = text(&info, &item, &DEVPKEY_Device_FriendlyName)
                .or_else(|| text(&info, &item, &DEVPKEY_Device_DeviceDesc))
                .unwrap_or_default();
            // Service nodes without telemetry or connection data add no physical device.
            if name.is_empty() || (percent.is_none() && connected != Some(true)) {
                continue;
            }
            let mut device = Device::new(
                identity(&info, &item, &instance),
                name.clone(),
                name_kind(&name),
                "bluetooth",
            );
            device.connected = connected;
            if let Some((kind, bytes)) = property(&info, &item, &CLASS_OF_DEVICE) {
                if kind == DEVPROP_TYPE_UINT32 && bytes.len() == 4 {
                    device.kind = class_kind(u32::from_le_bytes(bytes.try_into().unwrap())).into();
                }
            }
            if let Some(percent) = percent {
                device.battery(percent, "windows");
            }
            merge(&mut devices, device);
        }
        hid_devices(&mut devices, true, None, 0, order, &mut scan)?;
    }
    scan.devices = devices.into_values().collect();
    Ok(scan)
}

pub(super) fn descriptors() -> Result<serde_json::Value, String> {
    let mut items = Vec::new();
    unsafe {
        hid_devices(
            &mut BTreeMap::new(),
            false,
            Some(&mut items),
            0,
            &[],
            &mut ScanReport::default(),
        )?;
    }
    Ok(serde_json::json!(items))
}

/// Select only the caller's physical G435 0ACB container; descriptor checks do no I/O.
pub(super) fn g435_path(target: &str) -> Result<Vec<u16>, String> {
    if target.len() > 256 || target.is_empty() { return Err("g435Unsupported".into()); }
    unsafe {
        let guid = HidD_GetHidGuid();
        let info = Info(SetupDiGetClassDevsW(Some(&guid), PCWSTR::null(), None,
            DIGCF_PRESENT | DIGCF_DEVICEINTERFACE).map_err(|_| "g435Io")?);
        let mut found = Vec::new();
        for endpoint in hid_endpoints(&info, &guid)? {
            if endpoint.id != target || !endpoint.instance.to_ascii_lowercase().contains("vid_046d&pid_0acb") { continue; }
            let Ok(handle) = CreateFileW(PCWSTR(endpoint.path.as_ptr()),0,
                FILE_SHARE_READ|FILE_SHARE_WRITE,None,OPEN_EXISTING,FILE_FLAG_OVERLAPPED,None) else { continue; };
            let file=File(handle);
            let mut attr=HIDD_ATTRIBUTES{Size:std::mem::size_of::<HIDD_ATTRIBUTES>() as u32,..Default::default()};
            if !HidD_GetAttributes(file.0,&mut attr).as_bool() || (attr.VendorID,attr.ProductID,attr.VersionNumber)!=(0x046d,0x0acb,8) { continue; }
            let mut ppd=PHIDP_PREPARSED_DATA::default();
            if !HidD_GetPreparsedData(file.0,&mut ppd).as_bool(){continue;}
            let parsed=Parsed(ppd);
            let mut caps=HIDP_CAPS::default();
            if HidP_GetCaps(parsed.0,&mut caps)!=HIDP_STATUS_SUCCESS {continue;}
            if (caps.UsagePage,caps.Usage,caps.InputReportByteLength,caps.OutputReportByteLength,caps.FeatureReportByteLength)==(0xffc0,1,8,515,64)
                && report_ids(&parsed,HidP_Feature,caps.NumberFeatureValueCaps,caps.NumberFeatureButtonCaps)==[6]
                && report_ids(&parsed,HidP_Output,caps.NumberOutputValueCaps,caps.NumberOutputButtonCaps)==[6] {
                found.push(endpoint.path);
            }
        }
        if found.len()!=1 { return Err("g435Unsupported".into()); }
        Ok(found.remove(0))
    }
}

pub(super) fn rongyuan_features() -> Result<serde_json::Value, String> {
    let mut items = Vec::new();
    unsafe {
        hid_devices(
            &mut BTreeMap::new(),
            false,
            Some(&mut items),
            1,
            &[],
            &mut ScanReport::default(),
        )?;
    }
    items.retain(|item| {
        item.get("cachedFeature").is_some() || item.get("cachedVendorInput").is_some()
    });
    Ok(serde_json::json!(items))
}

pub(super) fn rongyuan_status() -> Result<serde_json::Value, String> {
    let mut items = Vec::new();
    unsafe {
        hid_devices(
            &mut BTreeMap::new(),
            false,
            Some(&mut items),
            2,
            &[],
            &mut ScanReport::default(),
        )?;
    }
    items.retain(|item| item.get("statusFeature").is_some());
    Ok(serde_json::json!(items))
}

unsafe fn hid_name(file: &File) -> Option<String> {
    let mut buffer = [0u16; 256];
    if !HidD_GetProductString(
        file.0,
        buffer.as_mut_ptr().cast(),
        (buffer.len() * 2) as u32,
    )
    .as_bool()
    {
        return None;
    }
    let name = String::from_utf16_lossy(
        &buffer[..buffer.iter().position(|v| *v == 0).unwrap_or(buffer.len())],
    );
    if name.trim().is_empty() {
        None
    } else {
        Some(name)
    }
}

unsafe fn manufacturer(file: &File) -> Option<String> {
    let mut buffer = [0u16; 256];
    if !HidD_GetManufacturerString(
        file.0,
        buffer.as_mut_ptr().cast(),
        (buffer.len() * 2) as u32,
    )
    .as_bool()
    {
        return None;
    }
    let value = String::from_utf16_lossy(
        &buffer[..buffer.iter().position(|v| *v == 0).unwrap_or(buffer.len())],
    );
    if value.trim().is_empty() {
        None
    } else {
        Some(value)
    }
}

unsafe fn serial_descriptor(file: &File) -> Option<String> {
    let mut buffer = [0u16; 256];
    if !HidD_GetSerialNumberString(
        file.0,
        buffer.as_mut_ptr().cast(),
        (buffer.len() * 2) as u32,
    )
    .as_bool()
    {
        return None;
    }
    let value = String::from_utf16_lossy(
        &buffer[..buffer.iter().position(|v| *v == 0).unwrap_or(buffer.len())],
    );
    (!value.trim().is_empty()).then_some(value)
}

fn friendly_name(vid: u16, pid: u16, name: &str, maker: Option<&str>, kind: &str) -> String {
    if vid == 0x046d && matches!(pid, 0x0acb | 0x0adf) {
        return "Logitech G435".into();
    }
    let lower = name.to_lowercase();
    let generic =
        lower.starts_with("2.4g wireless") || lower == "wireless device" || lower == "hid device";
    if !generic {
        return name.into();
    }
    let role = match kind {
        "mouse" => "Wireless Mouse",
        "keyboard" => "Wireless Keyboard",
        "headset" => "Wireless Headset",
        "gamepad" => "Wireless Controller",
        _ => "Wireless Device",
    };
    let brand = if vid == 0x260d {
        Some("DAREU")
    } else {
        maker.filter(|value| {
            let lower = value.trim().to_lowercase();
            !lower.is_empty()
                && ![
                    "company",
                    "company name",
                    "manufacturer",
                    "usb",
                    "wireless",
                    "2.4g",
                    "unknown",
                ]
                .contains(&lower.as_str())
        })
    };
    brand
        .map(|value| format!("{} {role}", value.trim()))
        .unwrap_or_else(|| role.into())
}
fn hid_kind(page: u16, usage: u16) -> &'static str {
    match (page, usage) {
        (1, 2) => "mouse",
        (1, 6) => "keyboard",
        (1, 4 | 5) => "gamepad",
        (0xb, 5) => "headset",
        _ => "other",
    }
}

fn interrupts_audio(vid: u16, pid: u16) -> bool {
    // G435 0ACB's battery channel requires a bridge mode that stops both audio
    // streams. Never enter that mode, including on an explicit refresh.
    vid == 0x046d && pid == 0x0acb
}

fn known_legacy_keyboard(vid: u16, pid: u16, maker: Option<&str>, kind: &str) -> bool {
    // The owner's receiver reports RONGYUAN; its wired keyboard reports ROYUAN.
    // Preserve inventory without claiming a model name or battery reading.
    vid == 0x05ac
        && pid == 0x024f
        && maker.is_some_and(|value| {
            value.eq_ignore_ascii_case("RONGYUAN") || value.eq_ignore_ascii_case("ROYUAN")
        })
        && kind == "keyboard"
}

/// Bounded overlapped feature IO. Buffers and OVERLAPPED remain alive through cancellation.
unsafe fn report(file: &File, report_id: u8, size: usize, ioctl: u32) -> Option<Vec<u8>> {
    if !(2..=4096).contains(&size) {
        return None;
    }
    let event = File(CreateEventW(None, true, false, None).ok()?);
    let mut operation = OVERLAPPED {
        hEvent: event.0,
        ..Default::default()
    };
    let mut report = vec![0u8; size];
    report[0] = report_id;
    let mut bytes = 0;
    let result = DeviceIoControl(
        file.0,
        ioctl,
        Some(report.as_ptr().cast()),
        size as u32,
        Some(report.as_mut_ptr().cast()),
        size as u32,
        Some(&mut bytes),
        Some(&mut operation),
    );
    if result.is_err() {
        if windows::Win32::Foundation::GetLastError()
            != windows::Win32::Foundation::ERROR_IO_PENDING
        {
            return None;
        }
        if WaitForSingleObject(event.0, 150) != WAIT_OBJECT_0 {
            let _ = CancelIoEx(file.0, Some(&operation));
            // Cancellation completion owns the operation until acknowledged by the driver.
            let _ = GetOverlappedResult(file.0, &operation, &mut bytes, true);
            return None;
        }
        GetOverlappedResult(file.0, &operation, &mut bytes, false).ok()?;
    }
    if report[0] != report_id || !complete_report_length(report_id, bytes as usize, size) {
        return None;
    }
    Some(report)
}

fn complete_report_length(report_id: u8, transferred: usize, size: usize) -> bool {
    // Windows HID control reads can exclude the dummy zero report-ID byte.
    transferred == size || report_id == 0 && transferred.checked_add(1) == Some(size)
}

unsafe fn transfer(file: &File, bytes: &mut [u8], write: bool) -> Option<()> {
    let event = File(CreateEventW(None, true, false, None).ok()?);
    let mut op = OVERLAPPED {
        hEvent: event.0,
        ..Default::default()
    };
    let mut used = 0;
    let pending = if write {
        WriteFile(file.0, Some(bytes), Some(&mut used), Some(&mut op))
    } else {
        ReadFile(file.0, Some(bytes), Some(&mut used), Some(&mut op))
    };
    if pending.is_err() {
        if windows::Win32::Foundation::GetLastError()
            != windows::Win32::Foundation::ERROR_IO_PENDING
        {
            return None;
        }
        if WaitForSingleObject(event.0, 350) != WAIT_OBJECT_0 {
            let _ = CancelIoEx(file.0, Some(&op));
            let _ = GetOverlappedResult(file.0, &op, &mut used, true);
            return None;
        }
        GetOverlappedResult(file.0, &op, &mut used, false).ok()?;
    }
    (used as usize == bytes.len()).then_some(())
}

unsafe fn set_feature(file: &File, bytes: &[u8]) -> Option<()> {
    let event = File(CreateEventW(None, true, false, None).ok()?);
    let mut op = OVERLAPPED {
        hEvent: event.0,
        ..Default::default()
    };
    let mut used = 0;
    let result = DeviceIoControl(
        file.0,
        IOCTL_SET_FEATURE,
        Some(bytes.as_ptr().cast()),
        bytes.len() as u32,
        None,
        0,
        Some(&mut used),
        Some(&mut op),
    );
    if result.is_err() {
        if windows::Win32::Foundation::GetLastError()
            != windows::Win32::Foundation::ERROR_IO_PENDING
        {
            return None;
        }
        if WaitForSingleObject(event.0, 150) != WAIT_OBJECT_0 {
            let _ = CancelIoEx(file.0, Some(&op));
            let _ = GetOverlappedResult(file.0, &op, &mut used, true);
            return None;
        }
        GetOverlappedResult(file.0, &op, &mut used, false).ok()?;
    }
    Some(())
}

unsafe fn tg_get(
    file: &File,
    report_id: u8,
    target: u8,
    query: dareu_tg::Query,
) -> Option<Vec<u8>> {
    let request = dareu_tg::request(report_id, target, query)?;
    set_feature(file, &request)?;
    for _ in 0..8 {
        std::thread::sleep(std::time::Duration::from_millis(15));
        let bytes = report(file, report_id, dareu_tg::REPORT_SIZE, IOCTL_GET_FEATURE)?;
        if dareu_tg::valid_reply(&bytes, &request) {
            return Some(bytes);
        }
        if !dareu_tg::pending_reply(&bytes, &request) {
            return None;
        }
    }
    None
}

unsafe fn tg_battery(file: &File, model: &dareu_tg::Model, target: u8, device: &mut Device) {
    let Some(bytes) = tg_get(file, model.report_id, target, dareu_tg::Query::Battery) else {
        return;
    };
    let Some(request) = dareu_tg::request(model.report_id, target, dareu_tg::Query::Battery) else {
        return;
    };
    let Some(reading) = dareu_tg::battery(&bytes, &request, target != 0) else {
        return;
    };
    if let Some(percent) = reading.percent {
        device.battery(percent, "dareu-tg");
    }
    device.charging = reading.charging;
    if device.charging.is_some() {
        device.charging_read_at = Some(crate::media::now_ms());
    }
}

unsafe fn dareu_tg(
    path: PCWSTR,
    attributes: &HIDD_ATTRIBUTES,
    caps: &HIDP_CAPS,
    parsed: &Parsed,
    id: &str,
) -> Option<Vec<Device>> {
    if attributes.VendorID != 0x260d
        || (caps.UsagePage, caps.Usage, caps.FeatureReportByteLength) != (12, 1, 65)
    {
        return None;
    }
    let receiver = attributes.ProductID == dareu_tg::RECEIVER_PID;
    let report_id = if receiver {
        10
    } else {
        dareu_tg::model(attributes.ProductID)?.report_id
    };
    if !report_ids(
        parsed,
        HidP_Feature,
        caps.NumberFeatureValueCaps,
        caps.NumberFeatureButtonCaps,
    )
    .contains(&report_id)
    {
        return None;
    }
    let file = File(
        CreateFileW(
            path,
            0xc0000000,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            None,
            OPEN_EXISTING,
            FILE_FLAG_OVERLAPPED,
            None,
        )
        .ok()?,
    );
    if !receiver {
        let model = dareu_tg::model(attributes.ProductID)?;
        let mut device = Device::new(id.into(), format!("DAREU {}", model.name), "mouse", "usb");
        device.source = "dareu-tg".into();
        device.connected = Some(true);
        tg_battery(&file, model, 0, &mut device);
        return Some(vec![device]);
    }
    let bytes = tg_get(&file, 10, 0, dareu_tg::Query::RadioSlots)?;
    let request = dareu_tg::request(10, 0, dareu_tg::Query::RadioSlots)?;
    let mut parent = Device::new(id.into(), "DAREU Receiver".into(), "other", "receiver");
    // The worker consumes this physical inventory marker before producing UI data.
    parent.source = "inventory-tg".into();
    let mut result = vec![parent];
    for slot in dareu_tg::radio_slots(&bytes, &request)? {
        let model = dareu_tg::model(slot.pid)?;
        // A receiver can contain multiple endpoints, including the same model twice.
        let mut device = Device::new(
            format!("{id}:tg:{}:{:04x}", slot.target, slot.pid),
            format!("DAREU {}", model.name),
            "mouse",
            "receiver",
        );
        device.source = "dareu-tg".into();
        device.connected = slot.connected;
        if device.connected == Some(true) {
            tg_battery(&file, model, slot.target, &mut device);
        }
        result.push(device);
    }
    Some(result)
}

unsafe fn jm_get(file: &File, command: u8, selector: u8) -> Option<Vec<u8>> {
    let request = dareu::request(command, selector)?;
    transfer(file, &mut request.clone(), true)?;
    for _ in 0..3 {
        let mut bytes = vec![0; dareu::REPORT_SIZE];
        transfer(file, &mut bytes, false)?;
        if std::env::var("WOODS_PERIPHERAL_DIAGNOSTICS").as_deref() == Ok("1") {
            eprintln!(
                "DAREU GET {command:02x}: {}",
                bytes
                    .iter()
                    .map(|b| format!("{b:02x}"))
                    .collect::<Vec<_>>()
                    .join(" ")
            );
        }
        if dareu::valid_reply(&bytes, &request) {
            return Some(bytes);
        }
    }
    None
}

#[derive(Default)]
struct Em901xInterfaces {
    feature: Vec<Vec<u16>>,
    input: Vec<Vec<u16>>,
    reported_name: String,
}
unsafe fn em901x(id: &str, interfaces: &Em901xInterfaces) -> Option<Device> {
    // Never pair interfaces by VID/PID globally or take the first of an ambiguous set.
    if interfaces.feature.len() != 1 || interfaces.input.len() != 1 {
        return None;
    }
    let open = |path: &[u16]| {
        CreateFileW(
            PCWSTR(path.as_ptr()),
            0xc0000000,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            None,
            OPEN_EXISTING,
            FILE_FLAG_OVERLAPPED,
            None,
        )
        .ok()
        .map(File)
    };
    let feature = open(&interfaces.feature[0])?;
    let input = open(&interfaces.input[0])?;
    set_feature(&feature, &dareu_em901x::request())?;
    for _ in 0..3 {
        let mut bytes = [0; dareu_em901x::REPORT_SIZE];
        transfer(&input, &mut bytes, false)?;
        let Some((percent, charging)) = dareu_em901x::battery(&bytes) else {
            continue;
        };
        let mut device = Device::new(id.into(), "DAREU EM901X".into(), "mouse", "receiver");
        device.source = "dareu-em901x".into();
        device.reported_name = Some(interfaces.reported_name.clone());
        if let Some(percent) = percent {
            device.battery(percent, "dareu-em901x");
        }
        device.charging = charging;
        if charging.is_some() {
            device.charging_read_at = Some(crate::media::now_ms());
        }
        // A receiver can return cached battery after radio loss. Connection stays unknown.
        return Some(device);
    }
    None
}

unsafe fn report_ids(
    parsed: &Parsed,
    kind: HIDP_REPORT_TYPE,
    values: u16,
    buttons: u16,
) -> Vec<u8> {
    let mut ids = Vec::new();
    if values > 512 || buttons > 512 {
        return ids;
    }
    let mut caps = vec![HIDP_VALUE_CAPS::default(); values as usize];
    let mut count = values;
    if values != 0
        && HidP_GetValueCaps(kind, caps.as_mut_ptr(), &mut count, parsed.0) == HIDP_STATUS_SUCCESS
    {
        ids.extend(caps.iter().take(count as usize).map(|c| c.ReportID));
    }
    let mut caps = vec![HIDP_BUTTON_CAPS::default(); buttons as usize];
    let mut count = buttons;
    if buttons != 0
        && HidP_GetButtonCaps(kind, caps.as_mut_ptr(), &mut count, parsed.0) == HIDP_STATUS_SUCCESS
    {
        ids.extend(caps.iter().take(count as usize).map(|c| c.ReportID));
    }
    ids.sort_unstable();
    ids.dedup();
    ids
}

unsafe fn dareu_jm(
    path: PCWSTR,
    attributes: &HIDD_ATTRIBUTES,
    caps: &HIDP_CAPS,
    parsed: &Parsed,
    id: &str,
) -> Option<Device> {
    if attributes.VendorID != 0x260d
        || !dareu::known_pid(attributes.ProductID)
        || (
            caps.UsagePage,
            caps.Usage,
            caps.InputReportByteLength,
            caps.OutputReportByteLength,
        ) != (0xff02, 2, 17, 17)
        || !report_ids(
            parsed,
            HidP_Input,
            caps.NumberInputValueCaps,
            caps.NumberInputButtonCaps,
        )
        .contains(&8)
        || !report_ids(
            parsed,
            HidP_Output,
            caps.NumberOutputValueCaps,
            caps.NumberOutputButtonCaps,
        )
        .contains(&8)
    {
        return None;
    }
    let file = File(
        CreateFileW(
            path,
            0xc0000000,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            None,
            OPEN_EXISTING,
            FILE_FLAG_OVERLAPPED,
            None,
        )
        .ok()?,
    );
    let identity = jm_get(&file, 1, 8)?;
    let model = dareu::model(attributes.ProductID, identity[10], identity[11])?;
    let name = if model.name == "A950 AIR" {
        "A950 Air"
    } else {
        &model.name
    };
    let mut device = Device::new(
        id.into(),
        format!("DAREU {name}"),
        "mouse",
        if model.wireless { "receiver" } else { "usb" },
    );
    device.source = "dareu-jm".into();
    // In this protocol the selector addresses device type, not USB versus radio.
    let selector = 0;
    let active = jm_get(&file, 3, selector)?;
    device.connected = match active[6] {
        0 => Some(false),
        1 => Some(true),
        _ => None,
    };
    if device.connected != Some(true) {
        return Some(device);
    }
    if let Some(battery) = jm_get(&file, 4, selector) {
        if battery[6] <= 100 {
            device.battery(battery[6], "dareu-jm");
        }
        device.charging = dareu::charging(battery[7]);
        if device.charging.is_some() {
            device.charging_read_at = Some(crate::media::now_ms());
        }
    }
    Some(device)
}

fn percent_from_usage(value: u32, min: i32, max: i32, page: u16) -> Option<u8> {
    if min != 0 || value > max as u32 || max <= 0 {
        return None;
    }
    // Battery System Absolute State Of Charge is expressed in percentage points.
    // Generic Device Battery Strength is normalized over the declared logical range.
    if page == 0x85 {
        if max == 100 {
            Some(value as u8)
        } else {
            None
        }
    } else if page == 6 && max >= 100 {
        Some(((value as u64 * 100 + max as u64 / 2) / max as u64) as u8)
    } else {
        None
    }
}

#[derive(Default)]
struct BatteryReading {
    percent: Option<u8>,
    charging: Option<bool>,
}

unsafe fn battery_caps(file: &File, parsed: &Parsed, caps: &HIDP_CAPS) -> BatteryReading {
    let mut result = BatteryReading::default();
    for (report_kind, total, buttons, size, ioctl) in [
        (
            HidP_Feature,
            caps.NumberFeatureValueCaps,
            caps.NumberFeatureButtonCaps,
            caps.FeatureReportByteLength,
            IOCTL_GET_FEATURE,
        ),
        (
            HidP_Input,
            caps.NumberInputValueCaps,
            caps.NumberInputButtonCaps,
            caps.InputReportByteLength,
            IOCTL_GET_INPUT,
        ),
    ] {
        if total > 512 || buttons > 512 {
            continue;
        }
        let mut values = vec![HIDP_VALUE_CAPS::default(); total as usize];
        let mut count = total;
        if total != 0
            && HidP_GetValueCaps(report_kind, values.as_mut_ptr(), &mut count, parsed.0)
                != HIDP_STATUS_SUCCESS
        {
            continue;
        }
        let mut reports = BTreeMap::new();
        for value in values.iter().take(count as usize) {
            let usages: &[u16] = match value.UsagePage {
                6 => &[0x20],
                0x85 => &[0x64, 0x65, 0x44],
                _ => continue,
            };
            for &usage in usages {
                let has = if value.IsRange.as_bool() {
                    value.Anonymous.Range.UsageMin <= usage
                        && value.Anonymous.Range.UsageMax >= usage
                } else {
                    value.Anonymous.NotRange.Usage == usage
                };
                if !has || value.ReportCount > 1 {
                    continue;
                }
                let report = reports
                    .entry(value.ReportID)
                    .or_insert_with(|| report(file, value.ReportID, size as usize, ioctl));
                let Some(report) = report.as_ref() else {
                    continue;
                };
                let mut raw = 0;
                if HidP_GetUsageValue(
                    report_kind,
                    value.UsagePage,
                    value.LinkCollection,
                    usage,
                    &mut raw,
                    parsed.0,
                    report,
                ) != HIDP_STATUS_SUCCESS
                {
                    continue;
                }
                if usage == 0x44 {
                    if value.LogicalMin == 0 && value.LogicalMax == 1 && raw <= 1 {
                        result.charging = Some(raw == 1);
                    }
                } else if result.percent.is_none() {
                    result.percent = percent_from_usage(
                        raw,
                        value.LogicalMin,
                        value.LogicalMax,
                        value.UsagePage,
                    );
                }
            }
        }
        // Battery System Charging is often a Boolean button rather than a value cap.
        let mut button_caps = vec![HIDP_BUTTON_CAPS::default(); buttons as usize];
        let mut count = buttons;
        if buttons != 0
            && HidP_GetButtonCaps(report_kind, button_caps.as_mut_ptr(), &mut count, parsed.0)
                == HIDP_STATUS_SUCCESS
        {
            for value in button_caps.iter().take(count as usize) {
                if value.UsagePage != 0x85 {
                    continue;
                }
                let has = if value.IsRange.as_bool() {
                    value.Anonymous.Range.UsageMin <= 0x44 && value.Anonymous.Range.UsageMax >= 0x44
                } else {
                    value.Anonymous.NotRange.Usage == 0x44
                };
                if !has {
                    continue;
                }
                let bytes = reports
                    .entry(value.ReportID)
                    .or_insert_with(|| report(file, value.ReportID, size as usize, ioctl));
                let Some(bytes) = bytes.as_mut() else {
                    continue;
                };
                let mut usages = [0u16; 512];
                let mut length = usages.len() as u32;
                if HidP_GetUsages(
                    report_kind,
                    0x85,
                    value.LinkCollection,
                    usages.as_mut_ptr(),
                    &mut length,
                    parsed.0,
                    bytes,
                ) == HIDP_STATUS_SUCCESS
                    && length <= usages.len() as u32
                {
                    result.charging = Some(usages[..length as usize].contains(&0x44));
                }
            }
        }
    }
    result
}

struct HidEndpoint {
    path: Vec<u16>,
    item: SP_DEVINFO_DATA,
    instance: String,
    id: String,
}

unsafe fn hid_endpoints(info: &Info, guid: &GUID) -> Result<Vec<HidEndpoint>, String> {
    let mut endpoints = Vec::new();
    for index in 0..4096 {
        let mut interface = SP_DEVICE_INTERFACE_DATA {
            cbSize: std::mem::size_of::<SP_DEVICE_INTERFACE_DATA>() as u32,
            ..Default::default()
        };
        if let Err(error) = SetupDiEnumDeviceInterfaces(info.0, None, guid, index, &mut interface) {
            if error.code() == windows::Win32::Foundation::ERROR_NO_MORE_ITEMS.to_hresult() {
                return Ok(endpoints);
            }
            return Err(error.to_string());
        }
        let mut bytes = 0;
        let _ =
            SetupDiGetDeviceInterfaceDetailW(info.0, &interface, None, 0, Some(&mut bytes), None);
        if !(8..=16384).contains(&bytes) {
            return Err("Invalid HID interface metadata size".into());
        }
        let mut storage = vec![0u64; (bytes as usize + 7) / 8];
        let detail = storage
            .as_mut_ptr()
            .cast::<SP_DEVICE_INTERFACE_DETAIL_DATA_W>();
        (*detail).cbSize = std::mem::size_of::<SP_DEVICE_INTERFACE_DETAIL_DATA_W>() as u32;
        let mut item = SP_DEVINFO_DATA {
            cbSize: std::mem::size_of::<SP_DEVINFO_DATA>() as u32,
            ..Default::default()
        };
        SetupDiGetDeviceInterfaceDetailW(
            info.0,
            &interface,
            Some(detail),
            bytes,
            None,
            Some(&mut item),
        )
        .map_err(|e| e.to_string())?;
        let instance = instance(info, &item).ok_or("HID instance metadata unavailable")?;
        let id = identity(info, &item, &instance);
        let path = PCWSTR((*detail).DevicePath.as_ptr())
            .as_wide()
            .iter()
            .copied()
            .chain(std::iter::once(0))
            .collect();
        endpoints.push(HidEndpoint {
            path,
            item,
            instance,
            id,
        });
    }
    Err("HID inventory exceeds scanner limit".into())
}

unsafe fn hid_devices(
    devices: &mut BTreeMap<String, Device>,
    telemetry: bool,
    mut inventory: Option<&mut Vec<serde_json::Value>>,
    legacy_diagnostic: u8,
    order: &[String],
    scan: &mut ScanReport,
) -> Result<(), String> {
    let guid = HidD_GetHidGuid();
    let info = Info(
        SetupDiGetClassDevsW(
            Some(&guid),
            PCWSTR::null(),
            None,
            DIGCF_PRESENT | DIGCF_DEVICEINTERFACE,
        )
        .map_err(|e| e.to_string())?,
    );
    let began = Instant::now();
    let mut receiver_containers = std::collections::BTreeSet::new();
    let mut em901x_interfaces: BTreeMap<String, Em901xInterfaces> = BTreeMap::new();
    let mut endpoints = hid_endpoints(&info, &guid)?;
    let ranks = schedule::ranks(order);
    endpoints.sort_by(|a, b| {
        ranks
            .get(a.id.as_str())
            .copied()
            .unwrap_or(usize::MAX)
            .cmp(&ranks.get(b.id.as_str()).copied().unwrap_or(usize::MAX))
            .then_with(|| a.id.cmp(&b.id))
    });
    scan.discovered
        .extend(endpoints.iter().map(|endpoint| endpoint.id.clone()));
    if telemetry && std::env::var("WOODS_PERIPHERAL_SCAN_PROGRESS").as_deref() == Ok("1") {
        use std::io::Write;
        // Flush complete discovery before vendor I/O so the parent can rotate
        // even when the very first scan stalls and is terminated.
        let inventory = schedule::ScanInventory {
            discovered: scan.discovered.clone(),
            first: endpoints.first().map(|endpoint| endpoint.id.clone()),
        };
        let mut output = std::io::stdout().lock();
        writeln!(
            output,
            "{}",
            serde_json::to_string(&inventory).map_err(|e| e.to_string())?
        )
        .and_then(|_| output.flush())
        .map_err(|e| e.to_string())?;
    }
    let mut previous_id: Option<String> = None;
    for endpoint in endpoints {
        // EM901X needs a pair of collections. Finish the previous physical
        // receiver here so it shares the same fair order as other adapters.
        if previous_id.as_deref() != Some(endpoint.id.as_str()) {
            if let Some(previous) = previous_id.take() {
                if let Some(interfaces) = em901x_interfaces.remove(&previous) {
                    if began.elapsed().as_secs() < 4 {
                        scan.visited.insert(previous.clone());
                        if let Some(device) = em901x(&previous, &interfaces) {
                            merge(devices, device);
                        }
                    }
                }
            }
            previous_id = Some(endpoint.id.clone());
        }
        let path = PCWSTR(endpoint.path.as_ptr());
        let item = endpoint.item;
        let instance = endpoint.instance;
        let id = endpoint.id;
        let Ok(handle) = CreateFileW(
            path,
            0,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            None,
            OPEN_EXISTING,
            FILE_FLAG_OVERLAPPED,
            None,
        ) else {
            continue;
        };
        let file = File(handle);
        let mut data = PHIDP_PREPARSED_DATA::default();
        if !HidD_GetPreparsedData(file.0, &mut data).as_bool() {
            continue;
        }
        let parsed = Parsed(data);
        let mut caps = HIDP_CAPS::default();
        if HidP_GetCaps(parsed.0, &mut caps) != HIDP_STATUS_SUCCESS {
            continue;
        }
        let name = hid_name(&file)
            .or_else(|| text(&info, &item, &DEVPKEY_Device_BusReportedDeviceDesc))
            .or_else(|| text(&info, &item, &DEVPKEY_Device_FriendlyName))
            .unwrap_or_else(|| "HID device".into());
        let mut attributes = HIDD_ATTRIBUTES {
            Size: std::mem::size_of::<HIDD_ATTRIBUTES>() as u32,
            ..Default::default()
        };
        let _ = HidD_GetAttributes(file.0, &mut attributes);
        let maker = manufacturer(&file);
        if telemetry
            && attributes.VendorID == 0x260d
            && attributes.ProductID == dareu_em901x::RECEIVER_PID
            && instance.to_ascii_uppercase().contains("&MI_01")
        {
            let interfaces = em901x_interfaces.entry(id.clone()).or_default();
            interfaces.reported_name = name.clone();
            if (caps.UsagePage, caps.Usage, caps.FeatureReportByteLength) == (0xff02, 2, 17)
                && report_ids(
                    &parsed,
                    HidP_Feature,
                    caps.NumberFeatureValueCaps,
                    caps.NumberFeatureButtonCaps,
                )
                .contains(&8)
            {
                interfaces.feature.push(
                    path.as_wide()
                        .iter()
                        .copied()
                        .chain(std::iter::once(0))
                        .collect(),
                );
            }
            if (caps.UsagePage, caps.Usage, caps.InputReportByteLength) == (0xff01, 0, 17)
                && report_ids(
                    &parsed,
                    HidP_Input,
                    caps.NumberInputValueCaps,
                    caps.NumberInputButtonCaps,
                )
                .contains(&9)
            {
                interfaces.input.push(
                    path.as_wide()
                        .iter()
                        .copied()
                        .chain(std::iter::once(0))
                        .collect(),
                );
            }
        }
        if let Some(items) = inventory.as_mut() {
            // Diagnostic USB string descriptor only. Generic or receiver serial
            // strings are not assumed to identify the paired radio device.
            let serial = (attributes.VendorID == 0x260d)
                .then(|| serial_descriptor(&file))
                .flatten();
            items.push(serde_json::json!({"vid":format!("{:04X}",attributes.VendorID),"pid":format!("{:04X}",attributes.ProductID),
                "id":id,"instance":instance,"product":name,"manufacturer":maker,"serial":serial,"usagePage":caps.UsagePage,"usage":caps.Usage,
                "inputBytes":caps.InputReportByteLength,"outputBytes":caps.OutputReportByteLength,"featureBytes":caps.FeatureReportByteLength,
                "inputIds":report_ids(&parsed,HidP_Input,caps.NumberInputValueCaps,caps.NumberInputButtonCaps),
                "outputIds":report_ids(&parsed,HidP_Output,caps.NumberOutputValueCaps,caps.NumberOutputButtonCaps),
                "featureIds":report_ids(&parsed,HidP_Feature,caps.NumberFeatureValueCaps,caps.NumberFeatureButtonCaps)}));
            if legacy_diagnostic != 0
                && attributes.VendorID == 0x05ac
                && attributes.ProductID == 0x024f
                && maker.as_deref() == Some("RONGYUAN")
                && (caps.UsagePage, caps.Usage, caps.FeatureReportByteLength) == (1, 6, 65)
                && report_ids(
                    &parsed,
                    HidP_Feature,
                    caps.NumberFeatureValueCaps,
                    caps.NumberFeatureButtonCaps,
                ) == [0]
            {
                let cached = if legacy_diagnostic == 2 {
                    // Official FL Driver 2.1.101: dangle status GET F7, checksum NONE.
                    // Diagnostic only; its bytes are not interpreted as battery telemetry.
                    let request = rongyuan::request();
                    set_feature(&file, &request)
                        .and_then(|_| report(&file, 0, 65, IOCTL_GET_FEATURE))
                } else {
                    report(&file, 0, 65, IOCTL_GET_FEATURE)
                };
                if let Some(item) = items.last_mut() {
                    item[if legacy_diagnostic == 2 {
                        "statusFeature"
                    } else {
                        "cachedFeature"
                    }] = serde_json::json!(cached);
                }
            }
            if legacy_diagnostic == 1
                && attributes.VendorID == 0x05ac
                && attributes.ProductID == 0x024f
                && maker.as_deref() == Some("RONGYUAN")
                && (caps.UsagePage, caps.Usage, caps.InputReportByteLength) == (0xffff, 1, 4)
                && report_ids(
                    &parsed,
                    HidP_Input,
                    caps.NumberInputValueCaps,
                    caps.NumberInputButtonCaps,
                ) == [5]
            {
                // Read only the vendor status collection, never ordinary keyboard input.
                let cached = report(&file, 5, 4, IOCTL_GET_INPUT);
                let unsolicited = CreateFileW(
                    path,
                    0x80000000,
                    FILE_SHARE_READ | FILE_SHARE_WRITE,
                    None,
                    OPEN_EXISTING,
                    FILE_FLAG_OVERLAPPED,
                    None,
                )
                .ok()
                .map(File)
                .and_then(|input| {
                    let mut frame = [0u8; 4];
                    transfer(&input, &mut frame, false)?;
                    (frame[0] == 5).then_some(frame)
                });
                if let Some(item) = items.last_mut() {
                    item["cachedVendorInput"] = serde_json::json!(cached);
                    item["unsolicitedVendorInput"] = serde_json::json!(unsolicited);
                }
            }
        }
        if telemetry && began.elapsed().as_secs() < 4 {
            scan.visited.insert(id.clone());
            if let Some(device) = hyperx_headset(path, &attributes, &caps, &parsed, &id, &name) {
                merge(devices, device);
                continue;
            }
            if let Some(device) = compx_mouse(path, &attributes, &caps, &parsed, &id, &name) {
                merge(devices, device);
                continue;
            }
            if let Some(device) =
                steelseries_mouse(path, &attributes, &caps, &parsed, &instance, &id, &name)
            {
                merge(devices, device);
                continue;
            }
            if let Some(readings) =
                rongyuan_receiver(path, &attributes, &caps, &parsed, &instance, &id, &name)
            {
                receiver_containers.insert(id.clone());
                devices.remove(&id);
                for device in readings {
                    merge(devices, device);
                }
                continue;
            }
            if let Some(device) =
                usb_keyboard(path, &attributes, &caps, &parsed, &instance, &id, &name)
            {
                merge(devices, device);
                continue;
            }
            if let Some(readings) = dareu_tg(path, &attributes, &caps, &parsed, &id) {
                if attributes.ProductID == dareu_tg::RECEIVER_PID {
                    receiver_containers.insert(id.clone());
                    devices.remove(&id);
                }
                for mut device in readings {
                    device.reported_name = Some(name.clone());
                    merge(devices, device);
                }
                continue;
            }
            if let Some(device) = dareu_jm(path, &attributes, &caps, &parsed, &id) {
                // Keep the original receiver description available for diagnostics.
                let mut device = device;
                device.reported_name = Some(name.clone());
                merge(devices, device);
                continue;
            }
        }
        if receiver_containers.contains(&id) {
            continue;
        }
        let lower_name = name.to_lowercase();
        let kind = match (attributes.VendorID, attributes.ProductID) {
            // Composite receivers also expose macro keyboard/mouse collections.
            (0x260d, 0x1154) if lower_name.contains("wireless") => "mouse",
            (0x05ac, 0x024f) | (0x0c45, 0xfefe) if lower_name.contains("wireless") => "keyboard",
            (0x046d, 0x0acb | 0x0adf) => "headset",
            _ => hid_kind(caps.UsagePage, caps.Usage),
        };
        if let Some(device) = devices.get_mut(&id) {
            if device.kind == "other" && kind != "other" {
                device.kind = kind.into();
            }
        }
        // A Bluetooth Windows reading takes precedence over a HID collection's default zero.
        let audio_interruption = interrupts_audio(attributes.VendorID, attributes.ProductID);
        let legacy_keyboard = known_legacy_keyboard(
            attributes.VendorID,
            attributes.ProductID,
            maker.as_deref(),
            kind,
        );
        let reading = if !telemetry || audio_interruption || began.elapsed().as_secs() >= 5 {
            BatteryReading::default()
        } else {
            battery_caps(&file, &parsed, &caps)
        };
        let percent = reading.percent;
        let wireless = name.to_lowercase().contains("wireless")
            || name.to_lowercase().contains("lightspeed")
            || name.to_lowercase().contains("2.4g");
        let tg_receiver = attributes.VendorID == 0x260d
            && attributes.ProductID == dareu_tg::RECEIVER_PID
            || rongyuan::receiver(attributes.VendorID, attributes.ProductID);
        if percent.is_none()
            && reading.charging.is_none()
            && !wireless
            && !tg_receiver
            && !legacy_keyboard
            && !audio_interruption
            && !devices.contains_key(&id)
        {
            continue;
        }
        let transport = if devices.get(&id).is_some_and(|d| d.transport == "bluetooth") {
            "bluetooth"
        } else if tg_receiver
            || audio_interruption
            || lower_name.contains("receiver")
            || lower_name.contains("dongle")
        {
            "receiver"
        } else {
            "usb"
        };
        let named_kind = if kind == "other" {
            name_kind(&name)
        } else {
            kind
        };
        let display = friendly_name(
            attributes.VendorID,
            attributes.ProductID,
            &name,
            maker.as_deref(),
            named_kind,
        );
        let mut device = Device::new(id, display, named_kind, transport);
        if device.name != name {
            device.reported_name = Some(name);
        }
        if audio_interruption {
            device.unavailable_reason = Some("audioInterruption".into());
        } else if percent.is_none()
            && (caps.NumberFeatureValueCaps > 0 || caps.NumberInputValueCaps > 0)
        {
            device.unavailable_reason = Some("readerUnavailable".into());
        }
        if let Some(percent) = percent {
            device.battery(percent, "hid");
        }
        if let Some(charging) = reading.charging {
            device.charging = Some(charging);
            device.charging_read_at = Some(crate::media::now_ms());
            if device.source == "none" {
                device.source = "hid".into();
            }
        }
        // USB receiver presence does not prove the radio endpoint is connected.
        merge(devices, device);
    }
    for (id, interfaces) in em901x_interfaces {
        if began.elapsed().as_secs() >= 5 {
            break;
        }
        scan.visited.insert(id.clone());
        if let Some(device) = em901x(&id, &interfaces) {
            merge(devices, device);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn scanner_guard_child_fixture() {
        if std::env::var("WOODS_SCANNER_GUARD_FIXTURE").as_deref() != Ok("1") {
            return;
        }
        guard_scanner().unwrap();
        use std::io::Write;
        println!("SCANNER_GUARD_READY");
        std::io::stdout().flush().unwrap();
        // No HID calls: imitate a stuck scan and let the real guard terminate it.
        std::thread::sleep(std::time::Duration::from_secs(12));
        panic!("Scanner outlived its parent and guard deadline");
    }

    #[test]
    fn scanner_guard_terminates_the_owned_child_when_its_parent_exits() {
        use std::io::{BufRead, Write};
        use std::os::windows::process::CommandExt;
        use std::process::{Command, Stdio};
        struct OwnedChild(std::process::Child);
        impl Drop for OwnedChild {
            fn drop(&mut self) {
                let _ = self.0.kill();
                let _ = self.0.wait();
            }
        }
        let mut parent = OwnedChild(
            Command::new("powershell.exe")
                .args([
                    "-NoProfile",
                    "-NonInteractive",
                    "-Command",
                    "[Console]::ReadLine() | Out-Null",
                ])
                .creation_flags(0x08000000)
                .stdin(Stdio::piped())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .unwrap(),
        );
        let mut child = OwnedChild(
            Command::new(std::env::current_exe().unwrap())
                .args([
                    "--exact",
                    "peripherals::windows_devices::tests::scanner_guard_child_fixture",
                    "--nocapture",
                ])
                .env("WOODS_SCANNER_GUARD_FIXTURE", "1")
                .env("WOODS_PERIPHERAL_PARENT_PID", parent.0.id().to_string())
                .creation_flags(0x08000000)
                .stdin(Stdio::null())
                .stdout(Stdio::piped())
                .stderr(Stdio::null())
                .spawn()
                .unwrap(),
        );
        let mut output = std::io::BufReader::new(child.0.stdout.take().unwrap());
        let mut line = String::new();
        loop {
            line.clear();
            assert!(
                output.read_line(&mut line).unwrap() > 0,
                "Guard failed before readiness"
            );
            if line.contains("SCANNER_GUARD_READY") {
                break;
            }
        }
        let began = Instant::now();
        writeln!(parent.0.stdin.take().unwrap()).unwrap();
        assert!(parent.0.wait().unwrap().success());
        assert_eq!(child.0.wait().unwrap().code(), Some(1));
        assert!(
            began.elapsed() < std::time::Duration::from_secs(5),
            "Child waited for its deadline instead of parent exit"
        );
    }
    #[test]
    fn feature_io_counts_zero_report_id_without_accepting_truncated_numbered_reports() {
        assert!(complete_report_length(0, 64, 65));
        assert!(complete_report_length(0, 65, 65));
        assert!(!complete_report_length(0, 63, 65));
        assert!(!complete_report_length(10, 64, 65));
        assert!(complete_report_length(10, 65, 65));
        assert!(!complete_report_length(0, usize::MAX, 65));
    }
    #[test]
    fn generic_receivers_get_device_names_without_inventing_models() {
        assert_eq!(
            friendly_name(0x260d, 0x1154, "2.4G Wireless 8K Receiver", None, "mouse"),
            "DAREU Wireless Mouse"
        );
        assert_eq!(
            friendly_name(0x05ac, 0x024f, "2.4G Wireless Device", None, "keyboard"),
            "Wireless Keyboard"
        );
        assert_eq!(
            friendly_name(
                0x046d,
                0x0acb,
                "G435 Wireless Gaming Headset",
                None,
                "headset"
            ),
            "Logitech G435"
        );
        assert_eq!(
            friendly_name(0x05ac, 0x024f, "Apple Keyboard", None, "keyboard"),
            "Apple Keyboard"
        );
    }
    #[test]
    fn g435_audio_bridge_is_excluded_from_battery_queries() {
        assert!(interrupts_audio(0x046d, 0x0acb));
        assert!(!interrupts_audio(0x046d, 0x0adf));
        assert!(!interrupts_audio(0x260d, 0x1154));
    }

    #[test]
    fn legacy_fl680_is_kept_visible_without_inventing_battery_telemetry() {
        assert!(known_legacy_keyboard(
            0x05ac,
            0x024f,
            Some("RONGYUAN"),
            "keyboard"
        ));
        assert!(known_legacy_keyboard(
            0x05ac,
            0x024f,
            Some("ROYUAN"),
            "keyboard"
        ));
        assert!(!known_legacy_keyboard(
            0x05ac,
            0x024f,
            Some("RONGYUAN"),
            "mouse"
        ));
        assert!(!known_legacy_keyboard(
            0x05ac,
            0x024f,
            Some("Apple"),
            "keyboard"
        ));
    }
    #[test]
    fn battery_ranges_do_not_turn_unknown_sentinels_into_full_charge() {
        assert_eq!(percent_from_usage(255, 0, 100, 0x85), None);
        assert_eq!(percent_from_usage(50, 0, 100, 0x85), Some(50));
        assert_eq!(percent_from_usage(0, 0, 100, 0x85), Some(0));
        assert_eq!(percent_from_usage(128, 0, 255, 6), Some(50));
        assert_eq!(percent_from_usage(2, 0, 4, 6), None);
        assert_eq!(percent_from_usage(50, -1, 100, 6), None);
    }
    #[test]
    fn physical_id_not_name_deduplicates_collections() {
        let mut devices = BTreeMap::new();
        let mut windows = Device::new("one".into(), "Keyboard".into(), "other", "bluetooth");
        windows.battery(70, "windows");
        merge(&mut devices, windows);
        let mut hid = Device::new("one".into(), "Keyboard".into(), "keyboard", "usb");
        hid.battery(0, "hid");
        merge(&mut devices, hid);
        merge(
            &mut devices,
            Device::new("two".into(), "Keyboard".into(), "keyboard", "bluetooth"),
        );
        assert_eq!(devices.len(), 2);
        assert_eq!(devices["one"].percent, Some(70));
        assert_eq!(devices["one"].kind, "keyboard");
    }

    #[test]
    fn vendor_telemetry_replaces_generic_values_without_fabricating_radio_presence() {
        let mut devices = BTreeMap::new();
        let mut hid = Device::new("one".into(), "HID device".into(), "mouse", "usb");
        hid.battery(0, "hid");
        merge(&mut devices, hid);
        let mut vendor = Device::new("one".into(), "DAREU A950 Air".into(), "mouse", "receiver");
        vendor.battery(95, "dareu-jm");
        vendor.connected = Some(false);
        merge(&mut devices, vendor);
        let mut generic = Device::new("one".into(), "HID device".into(), "mouse", "usb");
        generic.battery(0, "hid");
        generic.connected = Some(true);
        merge(&mut devices, generic);
        assert_eq!(devices["one"].percent, Some(95));
        assert_eq!(devices["one"].connected, Some(false));
        assert_eq!(devices["one"].name, "DAREU A950 Air");
    }

    #[test]
    fn confirmed_radio_state_is_independent_of_the_percentage_source_and_merge_order() {
        for vendor_first in [true, false] {
            let mut devices = BTreeMap::new();
            let mut vendor =
                Device::new("one".into(), "Wireless mouse".into(), "mouse", "receiver");
            vendor.source = "dareu-jm".into();
            vendor.connected = Some(false);
            let mut windows = Device::new("one".into(), "HID".into(), "mouse", "usb");
            windows.battery(80, "windows");
            windows.connected = Some(true);
            let order = if vendor_first {
                [vendor, windows.clone()]
            } else {
                [windows.clone(), vendor]
            };
            for device in order {
                merge(&mut devices, device);
            }
            merge(&mut devices, windows);
            assert_eq!(devices["one"].connected, Some(false));
            assert_eq!(devices["one"].percent, Some(80));
            assert_eq!(devices["one"].source, "windows");
        }
    }
}
