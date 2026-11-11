# Woods Island — состояние реализации

Задачи: TASK-1413/TASK-1414 в E:/Workspace/00_CORE/TASKS.md.
Сборка использует frontend и локальный Rust backend.

Исправлены прозрачная подложка, caption/DWM, исчезновение при hover,
масштаб/DPI/zoom/clip и restart persistence. Яндекс Музыка Mod подключена
через loopback connector; обложки и прогресс передаются в пилюлю.
About RU/EN адаптирован под Woods, SVG-иконка — информация в круге.
Выбранные аудиоустройства сохраняют системный default; WinRT MTA живёт
всё время приложения, startup/controls access violation устранены.

Погода использует schemaVersion=2, секунды и WMO codes, now/24 hours/до 7 days.
Старый cache отклоняется, initial load/error events защищены в frontend.
Смена города/units обновляет данные, устаревшие ответы отбрасываются.
MET sunrise имеет отдельный timeout, отсутствующие UV/солнце показаны честно.
Известные города получают UTC offset/DST; неизвестные — UTC/ручной offset.

Текущие отчёты: FUNCTIONAL_ACCEPTANCE.md и acceptance-release-20261112.json.
Проверки: pnpm build, Rust/hooks, release и native с exit 0.
Функциональные границы: нет полного geographic timezone resolver,
Яндекс connector v3 без seek, возможен конфликт порта 3003 с OBS Scrobbler.
Все аппаратные действия и внешние ИИ-провайдеры целиком не проверены.

Репозиторий nimalekyt-bit/woods-island остаётся приватным; owner-only история,
CODEOWNERS, CI, issue/PR шаблоны и portable с manifest SHA256.
README содержит реальные снимки runtime RU/EN и галерею функций.
Сайт находится отдельно; актуальные сведения — WEBSITE.md.
