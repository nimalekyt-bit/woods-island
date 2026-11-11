# Portable recording dependency

Prepared on 2026-11-11 for Woods Island's screen recorder.

- FFmpeg version: `9.0.2-essentials_build-www.gyan.dev`.
- Official upstream download page: https://ffmpeg.org/download.html
- Upstream Windows build provider linked by that page: https://www.gyan.dev/ffmpeg/builds/
- Downloaded archive: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip
- Published checksum: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip.sha256
- Verified archive SHA-256: `60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba`.
- Extracted portable executables: `ffmpeg.exe`, `ffprobe.exe`; license included as `LICENSE`.
- Validation: `ffmpeg.exe -version` returned code 0.

This essentials build enables GPL components including libx264 and is governed by its included GPLv3 license. It is a separate executable invoked by the application, with no DLL linking. Preserve the license when distributing the executable, and satisfy FFmpeg's applicable source-distribution requirements; the provider publishes release source/build information on the linked download page.

The recorder resolves `WOODS_FFMPEG_PATH`, `bin/ffmpeg.exe` beside the application, `resources/bin/ffmpeg.exe`, this development resource directory, and then PATH. It never downloads or installs software at application startup.

MP4 recordings use real WASAPI system loopback, optionally mixed with the default microphone. GIF is a silent format. Video and audio are streamed to local files and muxed when recording stops. No screen or microphone capture starts until the user explicitly invokes the record/dictation command.
