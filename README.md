<div align="center">

<img src="app-icon.svg" width="88" alt="Woods Island">

# Woods Island

**Dynamic Island для Windows · Woods Personal Corp**

[![Windows](https://img.shields.io/badge/Windows-10%20%7C%2011-18181b)](https://github.com/nimalekyt-bit/woods-island/releases)
[![Version](https://img.shields.io/badge/version-1.1.0-18181b)](https://github.com/nimalekyt-bit/woods-island/releases/tag/v1.1.0)
![RU / EN](https://img.shields.io/badge/interface-RU%20%7C%20EN-18181b)


[**Скачать сборку**](https://github.com/nimalekyt-bit/woods-island/releases/tag/v1.1.0) · [**Сообщить об ошибке**](https://github.com/nimalekyt-bit/woods-island/issues/new/choose) · [**Woods**](https://t.me/woodskilla)

</div>

<details open>
<summary><b>Русский</b></summary>
<br>

Чёрная пилюля у верхнего края экрана. Показывает музыку и события,
а по клику раскрывает инструменты, которыми пользуешься каждый день.

<div align="center">
<img src="assets/readme/ru/home.png" width="860" alt="Woods Island: плеер, громкость, экранные инструменты и лаунчер">
</div>

## Пилюля живая

Музыка, обложка и прогресс трека. Часы, таймер, микрофон, запись экрана,
загрузки и работа ИИ-агентов. Край острова реагирует на реальный звук через
WASAPI: низкие и высокие частоты, цвет обложки и движение жидкости.

GSMTC подключает обычные Windows-плееры. Яндекс Музыка Mod работает через
Woods-коннектор даже когда клиент не публикует медиасессию Windows.
Остров раскрывается по клику. Размер меняется от **80 до 200%**;
автоскрытие возвращает пилюлю от верхнего края. Область вокруг острова
пропускает клики к окнам под ним.

## 36 встроенных персонажей

Жидкий остров, Пиксель, Искра, Глазки, медуза, костёр, хомяк и другие.
Добавлены 11 авторских пиксельных питомцев: Складень, Узелок, Лунный Нокт,
Нуль, Парадокс, Искорка, Кряжик, Нокт, Латунчик, Шурш и Скол. У каждого
восемь анимаций, автоматическое моргание и отдельный нарисованный взгляд на курсор.
Выбирай в **Настройки → Персонаж**. Все встроенные доступны без покупки ключа;
реагируют на музыку, курсор и события. Режим **Без персонажа** считается отдельно.

<div align="center">
<img src="assets/readme/characters.webp" width="812" alt="Прежние персонажи Woods Island">
</div>

Девять дополнительных питомцев Codex подключаются из установленного на этом ПК
приложения. Настройки показывают доступность; кнопка **Импортировать из
установленного Codex** повторяет импорт. Рисунки сохраняются только в локальном
профиле и не входят в релиз или сайт. Без поддерживаемого Codex или ранее
импортированных валидных атласов эти варианты недоступны; 36 встроенных
персонажей работают независимо от него.

## Погода

Сейчас, следующие 24 часа и прогноз до семи дней. Ветер, влажность,
давление, осадки и восход/закат. Город выбираешь сам;
MET Norway не требует ключа. Старый кэш и некорректный ответ больше
не обрушивают панель. Отсутствующие данные показываются как недоступные.

<div align="center">
<img src="assets/readme/ru/weather.png" width="760" alt="Погодная панель Woods Island: часы, неделя и показатели">
</div>

На снимке — пустое состояние до выбора города.
После выбора города прогноз запрашивается по его координатам.

## Что внутри

<table>
<tr>
<td width="50%" valign="top"><img src="assets/readme/ru/clipboard.png" alt="Буфер"><br><b>Буфер.</b> История текста, изображений и файлов, поиск и закрепление. Локальное хранение в SQLite.</td>
<td width="50%" valign="top"><img src="assets/readme/ru/shelf.png" alt="Полка"><br><b>Полка.</b> Перетащи файлы на остров и забери, когда понадобятся. Содержимое переживает перезапуск.</td>
</tr>
<tr>
<td valign="top"><img src="assets/readme/ru/text.png" alt="Текст"><br><b>Текст.</b> Раскладка, регистр, транслитерация, JSON, Base64, URL, QR и действия ИИ.</td>
<td valign="top"><img src="assets/readme/ru/chat.png" alt="Чат"><br><b>ИИ.</b> Документы, изображения и потоковые ответы. Свой API-ключ или локальная модель.</td>
</tr>
<tr>
<td valign="top"><img src="assets/readme/ru/note.png" alt="Заметки и Obsidian"><br><b>Заметки и Obsidian.</b> Форматирование, папки, таймер и напоминания. Кнопка «В Obsidian» сохраняет Markdown в выбранный vault без перезаписи файлов.</td>
<td valign="top"><img src="assets/readme/ru/controls.png" alt="Управление"><br><b>Управление.</b> Звук, микрофон, сеть, тема Windows и системные действия. Выбор устройств виртуального микшера сохраняет системные устройства по умолчанию.</td>
</tr>
</table>

Снимки сделаны в пустом профиле: без города, музыки, устройств, файлов и истории.

### Рабочие инструменты

- Скриншоты области и экрана, редактор с разметкой.
- Windows OCR, распознавание QR и пипетка.
- MP4/GIF и системный звук через WASAPI/FFmpeg.
- Командная строка, поиск, калькулятор, ярлыки и группы лаунчера.
- Диктовка с выбранным микрофоном и своим сервисом распознавания.
- Статусы OBS, Steam и агентов Claude Code / Codex / OpenCode.
- Тема, прозрачность, монитор, масштаб, автоскрытие и горячие клавиши.

### Всё доступно без подписки Woods Island

Персонажи, погода, OCR, запись и ИИ открыты без активации Woods Island.
Оплата внешнего ИИ зависит от твоего провайдера. Встроенных и общих ключей нет.

## Установка

Скачай **Woods-Island-1.1.0-windows-x64.zip** из
[релиза](https://github.com/nimalekyt-bit/woods-island/releases/tag/v1.1.0),
распакуй и запусти `woods-island.exe`. Папка `bin` нужна рядом с EXE
для MP4/GIF. Требуются **Windows 10/11 x64** и WebView2 Runtime.
Переносимый комплект обновляется вручную. Контрольные суммы находятся в выпуске.

В **Настройки → ИИ** укажи свой ключ/адрес или локальную модель;
в настройках заметок — путь к Obsidian. На другом ПК для Яндекс Музыки Mod
потребуется отдельный Woods injector.

### Горячие клавиши

Все сочетания меняются в настройках.

| Действие | Сочетание |
|---|---|
| Открыть / закрыть остров | `Ctrl+Alt+I` |
| Командная строка | `Alt+Space` |
| Чат с ИИ | `Ctrl+Alt+A` |
| Буфер обмена | `Ctrl+Alt+V` |
| Скриншот области / экрана | `Ctrl+Alt+S` / `Ctrl+Alt+Shift+S` |
| Текст с экрана | `Ctrl+Alt+O` |
| Запись экрана | `Ctrl+Alt+R` |

### Приватность и ограничения

Настройки, SQLite и заметки находятся в `%APPDATA%\woods-island`.
Ключи защищает Windows DPAPI. Экспорт в Obsidian запускается кнопкой.
Для Яндекс Музыки Mod нужен отдельный Woods connector; версия 3 не умеет перемотку.
Неизвестные города используют UTC или ручной часовой пояс.

</details>

<details>
<summary><b>English</b> · click to read</summary>
<br>

A black pill at the top of your screen. Music and events stay visible;
a click opens the player, clipboard, files, notes, weather and screen tools.

<div align="center">
<img src="assets/readme/en/home.png" width="860" alt="Woods Island Home: player, volume, screen tools and launcher">
</div>

## A living island

The liquid edge responds to real WASAPI audio and the album colour.
Windows players use GSMTC; Yandex Music Mod uses the Woods loopback connector.
The pill shows artwork and advancing playback time. Resize it from **80 to 200%**,
enable auto-hide and choose from **36 built-in characters**, all available without activation.
The eleven additions are hand-drawn bitmap pets: Foldling, Knotling, Lunar Noct,
Null, Paradox, Iskorka, Kryazhik, Noct, Latunchik, Shursh and Skol. Each has eight
animations, automatic blinking and a separate drawn face that follows the cursor.
The **No character** mode is counted separately.
Nine optional Codex pets can be imported from Codex installed on this computer.
Settings show availability and let you repeat the import. Their artwork remains
in the local profile and is not bundled with Woods Island or its website.
Without a supported Codex installation or previously imported valid atlases,
those options are unavailable; all 36 built-in characters remain usable.

<div align="center">
<img src="assets/readme/characters.webp" width="812" alt="The original 25 Woods Island characters">
</div>

## Weather

Current conditions, 24 hours and up to seven days from MET Norway.
Choose your city; no weather API key is required. Old caches and invalid data
are rejected without crashing the panel. Missing data is marked unavailable.

<div align="center">
<img src="assets/readme/en/weather.png" width="760" alt="Woods Island weather before choosing a city">
</div>

This screenshot shows the empty state before a city is selected.

## Inside

<table>
<tr>
<td width="50%" valign="top"><img src="assets/readme/en/clipboard.png" alt="Clipboard"><br><b>Clipboard.</b> Local history of text, images and files, search and pins.</td>
<td width="50%" valign="top"><img src="assets/readme/en/shelf.png" alt="Shelf"><br><b>Shelf.</b> Keep files nearby and retain them across restarts.</td>
</tr>
<tr>
<td valign="top"><img src="assets/readme/en/text.png" alt="Text tools"><br><b>Text.</b> Layout, case, transliteration, JSON, Base64, URLs, QR and AI actions.</td>
<td valign="top"><img src="assets/readme/en/chat.png" alt="AI chat"><br><b>AI.</b> Streaming chat with images and documents; your key or local model.</td>
</tr>
<tr>
<td valign="top"><img src="assets/readme/en/note.png" alt="Notes and Obsidian"><br><b>Notes.</b> Formatting, folders, timers and explicit Markdown export to Obsidian.</td>
<td valign="top"><img src="assets/readme/en/controls.png" alt="Controls"><br><b>Controls.</b> Audio, microphone, network, Windows theme and system actions.</td>
</tr>
</table>

Screenshots show empty states without location, music, devices, files or history.
Screen tools include PNG capture and markup,
Windows OCR, QR, a colour picker and MP4/GIF with FFmpeg/WASAPI audio.
The launcher, command bar, dictation and OBS/Steam/terminal-agent events are available.

## Install

Download **Woods-Island-1.1.0-windows-x64.zip** from the
[release](https://github.com/nimalekyt-bit/woods-island/releases/tag/v1.1.0).
Extract and run `woods-island.exe`; keep `bin` alongside it for recording.
Requires **Windows 10/11 x64** and WebView2. Install portable updates manually;
checksums are provided in the release. Use your own AI key or local model.

Settings/SQLite stay in `%APPDATA%\woods-island`, keys use Windows DPAPI,
and Obsidian export is explicit. The Yandex connector needs separate installation
on other PCs and v3 has no seek support. Unknown cities use UTC or a manual offset.

</details>

## Разработка / Development

Windows, Node.js 22, pnpm 10.33.0, Rust 1.98.1 и Visual Studio Build Tools
с Desktop development with C++.
Use Windows, Node.js 22, pnpm 10.33.0, Rust 1.98.1 and Visual Studio Build Tools
with Desktop development with C++.

```powershell
pnpm install --frozen-lockfile
pnpm build
cargo build --release --locked --manifest-path src-tauri/Cargo.toml --bin woods-island
```

## Проект и сайт

Автор: Никита Кузнецов / Woods.
Условия использования компонентов: [LICENSE](LICENSE) и
[THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md).

[Сайт Woods Island](https://woods-island.tuz032.workers.dev/).

<div align="center">
<br>
<b>Woods Personal Corp</b><br>
Никита Кузнецов · <a href="https://t.me/woodskilla">@woodskilla</a> · <a href="https://github.com/nimalekyt-bit">GitHub</a>
</div>
