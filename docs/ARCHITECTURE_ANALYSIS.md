# Архитектура Woods Island

Windows 10/11 x64, Rust/Tauri, React runtime и Win32/WinRT.
Поставляемый frontend: frontend; React-прототип: src.

## Окна

Main — прозрачная пилюля/панель 760×480 до масштабирования;
settings — настройки; overlay — захват; editor — разметка.
Main использует DirectComposition/noRedirectionBitmap без WS_EX_LAYERED.
Прозрачность и хит-тест следуют DOM-геометрии и DPI/zoom; масштаб 80–200%.
Раскрытие по клику, автоскрытие от верхнего края и сохранение настроек.

## Backend

- win/lib: окна, геометрия, IPC, фоновое состояние, single instance и COM MTA.
- audio/media/music_bridge: WASAPI FFT/RMS, устройства, GSMTC, локальный Яндекс connector.
- storage/clipboard/notes: SQLite, история, заметки, таймер, напоминания и Obsidian Markdown.
- weather: MET, геокодер, schemaVersion=2, now/24 hours/до 7 days, cache и units.
- capture/recorder: PNG, OCR/QR, editor и MP4/GIF через FFmpeg со звуком WASAPI.
- ai/documents/speech: BYOK/local, SSE, вложения, PCM/WAV и распознавание.
- agents/obs/steam/network: локальные CLI hooks, OBS v5, manifests и системные статусы.

## Приёмка

pnpm build проверяет 20 ресурсов/153 IPC. Rust tests проверяют контракты,
hooks — CLI notify. Native приёмка работает в пассивном временном профиле;
реальные устройства/Яндекс/PNG/OCR/MP4 проверяются вместе с protocol fixtures.
Матрица: FUNCTIONAL_ACCEPTANCE.md. Данные владельца и ключи не попадают в Git.
