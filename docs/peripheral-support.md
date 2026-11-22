# Peripheral battery support

Woods Island shows battery telemetry supplied by Windows or a device-specific HID adapter. Support depends on the model, firmware revision and connection. A USB receiver being present does not by itself prove that its wireless device is connected.

## Hardware-validated devices

| Device | Connection | Battery | Charging and radio state |
| --- | --- | --- | --- |
| DAREU A950 Air V3 | 260D:1154 receiver | Device-reported percentage, automatic polling | Charging and wireless connection reported by the device |
| DAREU A950 Air V3 | 260D:1185 USB cable | Device-reported percentage, automatic polling | Charging reported by the device |
| Logitech G435, 046D:0ACB, revision 0008 | LIGHTSPEED receiver | Manual voltage reading with an approximate percentage | This query does not provide a charging flag; connection is checked during the reading |
| FL Esports FL680, legacy 05AC:024F | USB cable or receiver | Unavailable | USB presence only; battery and wireless state are unknown |

The battery percentages of different cable and receiver endpoints are not averaged. Their physical identities remain separate when Windows cannot prove they belong to the same device.

## Logitech G435 manual measurement

Expand the device row on Home and select **Measure battery** for the G435. The first click opens an interruption notice. Only **Measure now** starts the hardware exchange. Audio and microphone may pause briefly; the application never polls G435 battery in the background. Canceling the notice does not send hardware commands.

The measured voltage is converted using a generic Li-Po curve. The estimate is not calibrated to the G435 battery, and charging voltage can make it read high. The UI uses the approximation sign and shows when the reading was taken. Charging is left unknown rather than inferred from voltage. A saved reading expires after 24 hours and is bound to its Windows physical device identity.

The adapter requires the tested VID/PID, revision and HID capabilities. It checks the headset connection and remote mode before querying the battery. It uses a bounded child process, prevents overlapping sessions, and attempts to exit the diagnostic bridge after failures. A reading is rejected if exit is not acknowledged. A timed-out child triggers a separate bounded exit-only recovery. An already-busy bridge is not closed by a rejected measurement.

If a measurement fails, the last valid reading remains visible with its original timestamp. If exit cannot be confirmed, the UI reports the problem and offers reconnection guidance. Do not use an estimated battery percentage as a precise remaining-runtime measurement.

## Other implemented adapters

The code includes Windows Bluetooth/HID telemetry and model-specific DAREU JM/TG/EM901X, SONiX/Semico keyboards, modern RONGYUAN receivers, SteelSeries and COMPX mice, and selected HyperX headsets. Their model registries are in src-tauri/src/peripherals. These implementations have parser and state tests; hardware validation outside the devices listed above is still required. Matching a brand name alone does not enable vendor commands. The legacy FL680 is excluded from modern RONGYUAN routes.

## Display and notifications

Home provides a compact row and an expanded card. Device names, visibility, sort order, list limit and notification preferences can be customized. Unknown levels are displayed explicitly. A failed read is not treated as a confirmed disconnection. Old percentages expire independently of inventory errors.

Automatic charging, low-battery and connection notifications use fresh confirmed telemetry and the configured preferences. A manual G435 estimate does not generate automatic charging or low-battery notifications from its saved voltage.

Enable device notifications and the connection/disconnection switches in **Settings → Modules → Device batteries**. Notifications also appear in the collapsed Island. Ordinary polling runs every 60 seconds; a detected loss triggers a confirmation scan after 15 seconds. A rapid off/on cycle between scans may not be observed. USB receiver attachment/removal has its own wording. DAREU A950 Air V3 power-off/on with the receiver left attached has been checked separately from USB presence.

## Reporting an unsupported device

Use the **Peripheral battery** issue template. Include model, revision, Windows/app version, cable or receiver connection, VID:PID if known, and observed readings. Do not include serial numbers, credentials, full hardware dumps or private profile files.

## Protocol references

Adapters were implemented independently from documented and inspected protocol facts; vendor binaries are not bundled. Reference projects include [Wireless Device Battery Monitor](https://github.com/krisgfx9/Wireless-Device-Battery-Monitor), [OpenMouse](https://github.com/openmouse-project/openmouse), and [HeadsetControl](https://github.com/Sapd/HeadsetControl). A model being listed in another project is not proof of Woods Island hardware compatibility.
