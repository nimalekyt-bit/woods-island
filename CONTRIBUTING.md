# Работа с Woods Island

Идеи и сообщения об ошибках принимаются в [Issues](https://github.com/nimalekyt-bit/woods-island/issues).
Для ошибки укажи версию приложения, версию Windows, шаги воспроизведения
и ожидаемый результат. Сначала проверь, нет ли похожего открытого обсуждения.

Для сборки нужны Windows 10/11 x64, Node.js 22, pnpm 10.33.0, Rust 1.98.1
и Visual Studio Build Tools с компонентом Desktop development with C++.

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm test:hooks
pnpm test:runtime-state
pnpm test:ipc
pnpm test:characters
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

Основной интерфейс находится в `runtime`, системные функции — в `src-tauri/src`.
Перед изменением поведения добавь описание воспроизведения и выполни проверки
затронутой функции. Не включай в изменения пользовательские настройки, ключи,
базы, логи, записи экрана, готовые EXE, `target`, `node_modules` и `.env`.

Условия использования исходников указаны в [LICENSE](LICENSE).
Публичный доступ к репозиторию сам по себе не меняет эти условия.
