# Runtime Woods Island

Приложение использует готовые JavaScript-модули в frontend,
четыре HTML entrypoint и Rust backend. React-прототип в src запускается
отдельно и не является интерфейсом поставляемого EXE.

pnpm build проверяет четыре окна, UTF-8, синтаксис JS, локальные imports
и регистрацию IPC; копирует runtime в dist и записывает SHA256 ресурсов
в runtime-manifest.json. pnpm dev открывает тот же frontend.
Tauri использует dist при release-сборке.

Изменения frontend делаются по точным якорям с проверкой количества замен.
Читаемые дополнения находятся в assets/woods-extensions.js:
Woods About, значок информации, проверка погодного контракта и Obsidian export.

Нативная приёмка scripts/verify-runtime.cjs использует отдельный временный
профиль, WebView2 и WOODS_ISLAND_PASSIVE_QA=1. Аппаратный ввод, фокус
и глобальные горячие клавиши в приёмке не используются.
