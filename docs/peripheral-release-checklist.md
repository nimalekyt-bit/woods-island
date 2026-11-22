# Peripheral release checks

This checklist defines the release criteria. Local evidence and private test profiles are kept outside the repository and distribution packages.

## Runtime and state

- Build the production runtime and check generated IPC contracts.
- Run peripheral model, notification, geometry and Rust parser/state tests.
- Verify that unknown percentage, charging and radio states remain independent.
- Check cache expiry, cancellation, errors, concurrent manual attempts and bounded subprocess recovery.
- Ordinary scanning must not enter the G435 diagnostic bridge. Manual measurement requires the interruption confirmation.

## Native UI

- Check the compact row, expanded list, rename/hide/mute settings and notification queue.
- Verify manual confirmation/cancel, approximate percentage, voltage, timestamp and restored history.
- Check DPI 100/150/200%, long labels and small viewports. Home must not scroll horizontally or expose native scrollbar arrows; vertical scrolling must still reach all content.
- Collect frontend errors and verify the executable identity used by each acceptance run. Passive UI fixtures are not hardware evidence.

## Hardware and stability

- Test supported cable/receiver transitions, confirmed power-off/on and reconnection.
- Check application and telemetry recovery after Windows sleep/resume.
- Test G435 powered-off/error behavior and verify audio/microphone recovery after an approved manual measurement.
- Compare full native/WebView2 process-tree CPU and private memory with polling disabled/enabled; record duration and workload. Short runs do not establish daily stability.
- Keep untested models, revs and charging flags explicitly unverified. Low-battery UI simulation does not establish a hardware low-battery reading.

## Distribution

- Match package, Cargo, Tauri, release notes and canonical website editorial versions.
- Build the exact release revision and run the full installer workflow, including installed native smoke, existing/missing WebView2, uninstall, and a real upgrade from the previous public version.
- Verify portable/Setup allowlisted files, icons, executable identity, package hashes and signed updater version.
- Publish the five required payloads only after acceptance; verify their public sizes and SHA256 values.
- Let release metadata finalization and website synchronization consume the stable release. Verify actual metadata, workflow results, displayed version, downloads, RU/EN copy and deployed file hashes.
- Preserve the previous stable release and the existing site's owned rollback mechanism.
