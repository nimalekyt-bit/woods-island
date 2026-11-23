# Phone and shelf contract

The module starts a LAN listener only after `phone_start`. A one-use QR code
expires after ten minutes; every phone needs approval of its exact pending ID.
The link expires after one hour or twenty minutes of inactivity. Stop and Renew
revoke capabilities and shut down active sockets. Maximums: four connections,
64 outgoing offers, 256 MiB per file, 1 GiB / 200 received files per session,
512 MiB free disk reserve. Private physical IPv4 Ethernet/Wi-Fi only.

## Native integration

`pub mod phone;`, `phone::initialize(handle, state)` in setup, and
`phone::shutdown()` during orderly restart/quit. Thin `lib.rs` IPC wrappers:
`phone_start`, `phone_state`, `phone_stop`, `phone_renew`, `phone_allow(id)`,
`phone_deny(id)`, `phone_send(paths)`, `phone_unsend(id)`, `phone_firewall`.
All return `Result<PhoneState, String>`; wrappers serialize to JSON Value.

`phone:state` has running/url/network/public/connected/device/problem/pending/
expiresAt/offered. Pending is `{id,device,expiresAt}`; offers are
`{id,name,size,taken}`. `phone:got` is `{kind,path?,name?,size?,text?,added,clipboard?}`.
**`phone:taken` payload is a string: the full filename.**

`phone::shelf_item(&Path) -> Value` returns path/name (full filename)/isDir/kind/
icon/preview/exists/size. Preserve id/added/fromPhone around this helper in
shelf snapshot and addition. Launcher `system::item` is intentionally separate.
Call the helper from a blocking worker: native shell icons and photo decoding
perform I/O. PNG/JPEG/WebP previews are genuine 192 px thumbnails. File reading
is buffered; bounds are 32 MiB file, 16M pixels and 64 MiB decoder allocation.
The 64-entry cache validates size/modified/directory. Other formats use native
shell icons. `preview:true` identifies a genuine photo even below 64 px.

## Runtime integration

`PhonePanel({state,onState,makeQr,onFocus?,onWaiting?})`: pass stable callbacks.
Existing QR renderer accepts `toDataURL(url,{margin:1,width:240,errorCorrectionLevel:'M'})`.
Protect an initial async state snapshot against newer `phone:state` events.
Panel RPC responses are checked for component lifetime and superseding actions.

`ShelfObject({item,linked,dragProps,onOpen,onReveal,onRemove,onSend?})` receives
callbacks; it never starts native file operations on its own. `ShelfRow`
receives children/linked/empty. It owns the floor line, 116 px artwork stage,
28 px reflection clearance, scroll mask, empty state and footer. Vertical wheel
scrolls the row through a native non-passive listener and stops propagation to
the island's volume handler. Keep Drag all and clear controls outside the row.
Missing files are faded and cannot open/send. Directories cannot send. Toolbar
events do not start native drag; keyboard Enter opens and Delete removes.

## Evidence and remaining acceptance

- `node --test scripts/phone-state.test.cjs scripts/shelf-state.test.cjs`: five tests.
- Three native shelf tests prove Unicode filename, actual 192x96 PNG bytes, cache,
  missing file, malformed image, a valid PNG IHDR with excessive dimensions, and
  a camera JPEG with EXIF rotation correctly applied to its preview.
- `phone/core.rs`: four isolated auth/filename/HTTP tests.
- Whole phone module metadata compiled against the real dependency rlibs after
  socket/lifecycle/thumbnail changes; integrated full build belongs to root.
- `scripts/phone-browser-acceptance.cjs`: real desktop components and mobile
  assets; RU/EN, light/dark, 320 px mobile, controls, keyboard, material artwork,
  XSS escaping, text/file, download acknowledgment retry, cancellation, and wheel.
- `verifyPhoneTransport({invoke,directory,profile})` in
  `scripts/phone-native-acceptance.cjs` runs real isolated local HTTP with
  approval, path rejection, Unicode byte equality, bidirectional files, ACK,
  cancellation staging cleanup, changed-file rejection, revocation and restart.

Native transport must run on a passive QA process with `WOODS_PHONE_QA_LOOPBACK=1`.
Text is written to `<profile>/phone-qa-text.txt` via atomic write and never changes
the owner's clipboard. Pass `profile` to verify its contents. This fixture cannot
prove real Wi-Fi reachability, physical-phone download/selection behavior,
Windows clipboard ownership or UAC/firewall behavior. Those remain manual
acceptance, and firewall changes require the dedicated owner's button.

Real image preview support currently covers PNG/JPEG/WebP; HEIC/HEIF/AVIF/GIF/BMP
and TIFF use native shell icons. Browser fixture photos are deterministic
generated SVG patterns; actual raster decoding is proven by native PNG tests.
