export interface SettingsSearchEntry {
  section: string;
  groupId?: string;
  ru: string;
  en: string;
  hintRu: string;
  hintEn: string;
  keywords: string;
}

export const SECTION_META: Record<
  string,
  { ru: string; en: string; descRu: string; descEn: string }
> = {
  appearance: {
    ru: 'Внешний вид',
    en: 'Appearance',
    descRu: 'Форма, тема, цвет, размер, прозрачность, монитор и положение острова',
    descEn: 'Shape, theme, color, size, transparency, monitor and island placement',
  },
  general: {
    ru: 'Поведение и система',
    en: 'Behavior & System',
    descRu: 'Язык, автозапуск, скрытие в играх, часы, наведение и оформление плеера',
    descEn: 'Language, startup, fullscreen hiding, clock, hover behavior and player style',
  },
  character: {
    ru: 'Персонаж',
    en: 'Character',
    descRu: 'Питомец в пилюле, реакции на музыку, живой край и импорт каталога',
    descEn: 'Pill companion, music reactions, liquid edge and pet library import',
  },
  holidays: {
    ru: 'Праздники',
    en: 'Holidays',
    descRu: 'Снег на острове и экране, сугробы, гирлянда и сезонное расписание',
    descEn: 'Snow on the island and screen, snow cap, garland and seasonal schedule',
  },
  modules: {
    ru: 'Модули и Главная',
    en: 'Modules & Home',
    descRu: 'Конструктор «Главной», вкладки, датчики, заряд устройств, поиск файлов и Obsidian',
    descEn: 'Home builder, island tabs, system load, device batteries, file search and Obsidian',
  },
  clipboard: {
    ru: 'Захват и буфер',
    en: 'Capture & Clipboard',
    descRu: 'История копирования, скриншоты, разметка, запись экрана (MP4/GIF) и папки',
    descEn: 'Clipboard history, screenshots, markup, screen recording (MP4/GIF) and folders',
  },
  events: {
    ru: 'События и уведомления',
    en: 'Events & Alerts',
    descRu: 'Всплывающие карточки: громкость, загрузки, Steam, OBS, ИИ-агенты, VPN и Windows',
    descEn: 'Pop-up cards: volume, downloads, Steam, OBS, AI agents, VPN and Windows notifications',
  },
  sound: {
    ru: 'Звук и музыка',
    en: 'Sound & Music',
    descRu: 'Устройство вывода для громкости, микрофон для диктовки и оформление плеера',
    descEn: 'Output device for volume controls, microphone for dictation and player styling',
  },
  weather: {
    ru: 'Погода',
    en: 'Weather',
    descRu: 'Город, часовой пояс, единицы измерения, температура в пилюле и оповещения',
    descEn: 'City, timezone, units, pill temperature and precipitation alerts',
  },
  ai: {
    ru: 'ИИ',
    en: 'AI',
    descRu: 'Веб-версии ChatGPT/Gemini/DeepSeek без ключа, API-провайдеры, прокси и разрешения',
    descEn: 'Keyless ChatGPT/Gemini/DeepSeek web tabs, API providers, proxy and site permissions',
  },
  voice: {
    ru: 'Голос в текст',
    en: 'Voice to text',
    descRu: 'Диктовка и голосовые команды: сервис распознавания, язык и автовставка',
    descEn: 'Dictation and voice commands: recognition service, language and auto-paste',
  },
  hotkeys: {
    ru: 'Горячие клавиши',
    en: 'Hotkeys',
    descRu: 'Глобальные сочетания для острова, скриншотов, записи, режимов и ярлыков лаунчера',
    descEn: 'Global shortcuts for the island, screenshots, recording, modes and launcher items',
  },
  connections: {
    ru: 'Подключения',
    en: 'Connections',
    descRu: 'Статус всех интеграций: плеер, буфер, ИИ, запись, агенты, телефон и диагностика',
    descEn: 'Status of all integrations: player, clipboard, AI, recording, agents, phone and diagnostics',
  },
  updates: {
    ru: 'Обновления',
    en: 'Updates',
    descRu: 'Проверка новых версий, автозагрузка и история изменений Woods Island',
    descEn: 'Update checks, automatic downloads and Woods Island release history',
  },
  pro: {
    ru: 'О приложении',
    en: 'About',
    descRu: 'Версия, открытая лицензия, все функции бесплатно и контакты автора',
    descEn: 'Version, open license, all free features and author contacts',
  },
};

export const SETTINGS_SEARCH_INDEX: SettingsSearchEntry[] = [
  // Appearance
  { section: 'appearance', groupId: 'appearance-style', ru: 'Форма острова', en: 'Island shape', hintRu: 'Вырез или капсула', hintEn: 'Notch or capsule', keywords: 'вырез капсула форма стиль notch capsule style pill' },
  { section: 'appearance', groupId: 'appearance-style', ru: 'Тема острова', en: 'Island theme', hintRu: 'Тёмная, светлая или как в Windows', hintEn: 'Dark, light or Windows', keywords: 'тема тёмная светлая цвет dark light theme auto' },
  { section: 'appearance', groupId: 'appearance-style', ru: 'Цвет острова', en: 'Island color', hintRu: 'Собственный цвет фона пилюли', hintEn: 'Custom island background tint', keywords: 'цвет фон палитра оттенок color hex tint' },
  { section: 'appearance', groupId: 'appearance-style', ru: 'Размер острова', en: 'Island size', hintRu: 'Масштаб от 80% до 200% (удобно для 4K)', hintEn: 'Scale 80% to 200% (great for 4K)', keywords: 'размер масштаб крупнее меньше 4k dpi scale zoom' },
  { section: 'appearance', groupId: 'appearance-style', ru: 'Прозрачность свёрнутого острова', en: 'Transparency of the folded island', hintRu: 'Прозрачность пилюли и всплывающих карточек', hintEn: 'Opacity of the folded pill and cards', keywords: 'прозрачность свёрнутый opacity glass alpha' },
  { section: 'appearance', groupId: 'appearance-style', ru: 'Прозрачность раскрытого острова', en: 'Transparency of the open island', hintRu: 'Прозрачность раскрытой панели', hintEn: 'Opacity of the expanded panel', keywords: 'прозрачность раскрытый панель opacity open' },
  { section: 'appearance', groupId: 'appearance-screen', ru: 'Монитор острова', en: "The island's monitor", hintRu: 'Выбор дисплея при нескольких мониторах', hintEn: 'Select display on multi-monitor setups', keywords: 'монитор экран дисплей второй display monitor screen 4k' },
  { section: 'appearance', groupId: 'appearance-screen', ru: 'Переносить на другой монитор в играх', en: 'Move to another monitor in fullscreen', hintRu: 'Автоперенос острова на свободный экран при полноэкранной игре или видео', hintEn: 'Auto-move island to a free monitor during fullscreen games/videos', keywords: 'мультимонитор второй монитор игры полный экран перенос multimonitor fullscreen' },
  { section: 'appearance', groupId: 'appearance-screen', ru: 'Следовать за монитором с курсором', en: "Follow the cursor's monitor", hintRu: 'Остров переходит на активный дисплей за мышью', hintEn: 'Island follows your mouse across displays', keywords: 'курсор мышь второй монитор следовать активный экран cursor follow monitor' },
  { section: 'appearance', groupId: 'appearance-screen', ru: 'Положение вдоль верхнего края', en: 'Place along the top edge', hintRu: 'Сдвиг влево или вправо от центра', hintEn: 'Shift left or right from center', keywords: 'положение сдвиг центр лево право offset position' },
  { section: 'appearance', groupId: 'appearance-screen', ru: 'Под панелью задач сверху', en: 'Under the taskbar when it is at the top', hintRu: 'Не перекрывать верхнюю панель задач', hintEn: 'Stand below a top-aligned taskbar', keywords: 'панель задач сверху taskbar top' },
  { section: 'appearance', groupId: 'appearance-screen', ru: 'Режим выреза, как на MacBook', en: 'Notch mode, like on a MacBook', hintRu: 'Резервирует верхнюю полосу под остров (AppBar)', hintEn: 'Reserves a top strip for the island (AppBar)', keywords: 'вырез macbook полоса appbar notch bar стекло обои' },
  { section: 'appearance', groupId: 'appearance-through', ru: 'Сквозной режим', en: 'Through mode', hintRu: 'Клики проходят сквозь свёрнутый остров', hintEn: 'Clicks pass through the folded island', keywords: 'сквозной клики прозрачность through click-through' },

  // General (Behavior & System)
  { section: 'general', groupId: 'general-system', ru: 'Язык', en: 'Language', hintRu: 'Русский, English или как в Windows', hintEn: 'Russian, English or Windows default', keywords: 'язык русский английский language ru en' },
  { section: 'general', groupId: 'general-system', ru: 'Запускать вместе с Windows', en: 'Start with Windows', hintRu: 'Автозапуск при входе в систему', hintEn: 'Launch automatically on Windows sign-in', keywords: 'автозапуск старт windows startup autostart' },
  { section: 'general', groupId: 'general-system', ru: 'Движение и анимации', en: 'Motion and animations', hintRu: 'Уменьшить постоянные анимации', hintEn: 'Reduce continuous motion', keywords: 'анимация движение плавность reduced motion' },
  { section: 'general', groupId: 'general-system', ru: 'Ускорение видеокартой', en: 'Hardware acceleration', hintRu: 'Отрисовка через GPU (выключи при мерцании)', hintEn: 'GPU rendering (disable if flickering)', keywords: 'видеокарта gpu ускорение тормоза мерцание hardware' },
  { section: 'general', groupId: 'general-system', ru: 'Показывать остров на скриншотах и в записи экрана', en: 'Show the island in screenshots and recordings', hintRu: 'Видимость для OBS, NVIDIA ShadowPlay и скриншотов', hintEn: 'Visibility for OBS, NVIDIA capture and screenshots', keywords: 'скриншот запись nvidia shadowplay obs скрыт захват capture' },
  { section: 'general', groupId: 'general-hide', ru: 'Прятать в полноэкранных приложениях', en: 'Hide in full-screen apps', hintRu: 'Игры, YouTube на весь экран, презентации', hintEn: 'Games, fullscreen video, presentations', keywords: 'игры полный экран видео полноэкранный скрыть fullscreen game' },
  { section: 'general', groupId: 'general-hide', ru: 'Прятать остров, пока он не нужен', en: 'Hide the island until it is needed', hintRu: 'Автоскрытие за верхний край экрана', hintEn: 'Auto-hide behind the top edge', keywords: 'автоскрытие прятать скрывать autohide hide' },
  { section: 'general', groupId: 'general-hide', ru: 'Остров в выбранных программах', en: 'The island in chosen apps', hintRu: 'Списки «Прятать» и «Оставлять» по .exe', hintEn: 'Hide and Keep per-application lists', keywords: 'программы приложения исключения браузеры exe hide keep' },
  { section: 'general', groupId: 'general-hide', ru: 'Отпускать клавиши программе на весь экран', en: 'Release shortcuts to fullscreen apps', hintRu: 'Не перехватывать хоткеи в играх', hintEn: 'Avoid hijacking shortcuts in games', keywords: 'игры клавиши хоткеи полный экран release shortcuts' },
  { section: 'general', groupId: 'general-clock', ru: 'Часы и батарея в свёрнутом острове', en: 'Clock and battery on the folded island', hintRu: 'Время, секунды, формат 12/24 и заряд ноутбука', hintEn: 'Time, seconds, 12/24h format and laptop battery', keywords: 'часы время секунды формат батарея заряд clock time battery' },
  { section: 'general', groupId: 'general-clock', ru: 'Открывать при наведении и задержки', en: 'Open on hover and delays', hintRu: 'Открытие по клику или наведению курсора', hintEn: 'Click vs cursor hover open/close delays', keywords: 'наведение курсор задержка открытие закрытие hover delay' },
  { section: 'general', groupId: 'general-media', ru: 'Видимость плееров и браузеров', en: 'Visible media players and browsers', hintRu: 'Скрыть или показать Яндекс Браузер, Spotify, Chrome и др.', hintEn: 'Hide or restore Yandex Browser, Spotify, Chrome etc.', keywords: 'музыка плеер яндекс браузер chrome spotify скрыть источник media source' },
  { section: 'sound', groupId: 'sound-player', ru: 'Пилюля во время музыки и текст песни', en: 'Music pill style and lyrics', hintRu: 'Обычная, с названием, мини-плеер, с текстом LRCLIB и жидкий спектр', hintEn: 'Normal, title, mini player, LRCLIB lyrics and liquid spectrum', keywords: 'музыка плеер текст песни лирика эквалайзер спектр lyrics music player' },

  // Character & Holidays
  { section: 'character', ru: 'Персонаж и питомцы', en: 'Character & pets', hintRu: 'Выбор персонажа, размер, питомец для музыки и жидкий остров', hintEn: 'Pick companion, size, music pet and liquid island', keywords: 'персонаж питомец кот медуза жидкий маскот codex pet character' },
  { section: 'holidays', ru: 'Снег, сугробы и гирлянда', en: 'Snow, snow cap & garland', hintRu: 'Праздничные эффекты на острове и по всему экрану', hintEn: 'Seasonal effects on the island and across the screen', keywords: 'праздники снег сугроб гирлянда новый год зима snow garland holiday' },

  // Modules
  { section: 'modules', groupId: 'modules-home', ru: 'Что на «Главной» и вкладки острова', en: 'Home widgets and island tabs', hintRu: 'Настройка плиток, плеера, полки, лаунчера и вкладок', hintEn: 'Configure Home cards, player, shelf, launcher and tabs', keywords: 'главная вкладки модули полка лаунчер плитки home tabs modules' },
  { section: 'modules', groupId: 'modules-telemetry', ru: 'Индикаторы CPU / RAM / GPU и заряд устройств', en: 'CPU / RAM / GPU load and device batteries', hintRu: 'Нагрузка системы и батарея Bluetooth/мышей/наушников', hintEn: 'System load strip and peripheral battery alerts', keywords: 'cpu ram gpu сеть нагрузка батарея наушники мышь периферия peripherals' },
  { section: 'modules', groupId: 'modules-search', ru: 'Поиск файлов, Everything и поисковик в Alt+Space', en: 'File search, Everything & web search engine', hintRu: 'Мгновенный поиск через Everything, папки поиска и Яндекс/Google', hintEn: 'Instant Everything PC search, indexed folders and search URL', keywords: 'поиск файлы папки everything браузер яндекс google alt space search диски' },
  { section: 'modules', groupId: 'modules-search', ru: 'Хранилище Obsidian', en: 'Obsidian vault', hintRu: 'Экспорт заметок острова в Markdown-папку Obsidian', hintEn: 'Export island notes into an Obsidian vault', keywords: 'obsidian заметки markdown экспорт notes vault' },
  { section: 'modules', groupId: 'modules-controls', ru: 'Центр управления, Wi-Fi и VPN', en: 'Control center, Wi-Fi and VPN', hintRu: 'Плитки сети, проводной Ethernet и свои команды VPN', hintEn: 'Network tiles, Ethernet and custom VPN commands', keywords: 'центр управления wifi ethernet vpn сеть controls' },

  // Capture & Clipboard
  { section: 'clipboard', groupId: 'clip-history', ru: 'Буфер обмена и исключения', en: 'Clipboard history & exclusions', hintRu: 'Клик вставляет, размер истории и приватные приложения', hintEn: 'Click to paste, history size and excluded apps', keywords: 'буфер история копирование вставка пароли clipboard paste' },
  { section: 'clipboard', groupId: 'clip-record', ru: 'Запись экрана: формат, FPS, качество и звук', en: 'Screen recording: format, FPS, quality & audio', hintRu: 'MP4 или GIF, 30/60 кадров, системный звук и микрофон', hintEn: 'MP4 or GIF, 30/60 FPS, system audio and microphone', keywords: 'запись видео экран mp4 gif fps 60 звук микрофон record video' },
  { section: 'clipboard', groupId: 'clip-shots', ru: 'Скриншоты, разметка и папки сохранения', en: 'Screenshots, markup & output folders', hintRu: 'Рисование перед снимком, папки скриншотов и записей', hintEn: 'Draw before capture, screenshot and recording directories', keywords: 'скриншот папка разметка рисовать lightshot куда сохраняются screenshot folder dir' },
  { section: 'clipboard', groupId: 'clip-shots', ru: 'Ссылка на скриншот (загрузка)', en: 'Screenshot upload link', hintRu: 'Быстрая отправка картинки на фотохостинг по кнопке', hintEn: 'One-click image upload to a hosting service', keywords: 'ссылка загрузить скриншот хостинг upload link imgbb' },

  // Events
  { section: 'events', groupId: 'events-system', ru: 'Длительность карточки, громкость, микрофон, раскладка', en: 'Card duration, volume, mic/cam, layout & Caps Lock', hintRu: 'Базовые системные карточки и индикаторы в пилюле', hintEn: 'Core system cards and pill indicators', keywords: 'карточка время громкость микрофон камера раскладка caps lock стол volume layout' },
  { section: 'events', groupId: 'events-downloads', ru: 'Загрузки браузера, торренты и Steam', en: 'Browser downloads, torrents & Steam', hintRu: 'Прогресс файлов, маски игнора, папка загрузок и игры Steam', hintEn: 'File progress, ignore masks, downloads folder and Steam', keywords: 'загрузки скачивание торрент steam папка downloads torrent' },
  { section: 'events', groupId: 'events-integrations', ru: 'OBS Studio и ИИ-агенты (Claude Code / Codex)', en: 'OBS Studio & terminal AI agents', hintRu: 'Индикатор REC/LIVE в OBS и карточки агентов в терминале', hintEn: 'OBS REC/LIVE badge and Claude Code / Codex cards', keywords: 'obs стрим запись websocket claude codex opencode агент' },
  { section: 'events', groupId: 'events-notifications', ru: 'Уведомления Windows и VPN-карточки', en: 'Windows notifications & VPN cards', hintRu: 'Telegram/Discord на острове, список тихих программ и IP', hintEn: 'App notifications on the island, mute list and VPN IP', keywords: 'уведомления windows telegram discord vpn ip notifications' },

  // Sound & Music
  { section: 'sound', groupId: 'sound-devices', ru: 'Устройства вывода и микрофон', en: 'Audio output & microphone', hintRu: 'Чью громкость крутит остров и какой микрофон глушит/пишет', hintEn: 'Target speaker for volume and microphone for mute/dictation', keywords: 'звук наушники колонки микрофон громкость audio output input mic' },

  // Weather
  { section: 'weather', ru: 'Город, часовой пояс и прогноз погоды', en: 'City, timezone & weather forecast', hintRu: 'Выбор города, °C/°F, температура в пилюле и осадки', hintEn: 'City search, °C/°F, pill temperature and rain/snow alerts', keywords: 'погода город температура дождь снег пояс weather city celsius' },

  // AI & Voice
  { section: 'ai', groupId: 'ai-web', ru: 'ChatGPT, Gemini и DeepSeek без ключа', en: 'Keyless ChatGPT, Gemini & DeepSeek', hintRu: 'Веб-версии прямо во вкладке «Чат» со своим аккаунтом', hintEn: 'Web chats in the Chat tab with your own account', keywords: 'ии чат chatgpt gemini deepseek веб бесплатно ai web' },
  { section: 'ai', groupId: 'ai-api', ru: 'Ключ API, модель и прокси ИИ', en: 'AI API key, model & proxy', hintRu: 'Подключение OpenAI/Groq/OpenRouter, прокси и разрешения', hintEn: 'OpenAI/Groq/OpenRouter key, proxy and site permissions', keywords: 'ключ api модель прокси socks5 http разрешения ai key model proxy' },
  { section: 'voice', ru: 'Голос в текст и голосовые команды', en: 'Voice to text & voice commands', hintRu: 'Whisper/Groq ключ, язык речи и автовставка', hintEn: 'Whisper/Groq key, spoken language and auto-paste', keywords: 'голос диктовка речь whisper groq stt микрофон voice dictate' },

  // Hotkeys & Connections & System
  { section: 'hotkeys', groupId: 'hotkeys-island', ru: 'Горячие клавиши острова и командной строки', en: 'Island & command bar hotkeys', hintRu: 'Открыть остров, Alt+Space, чат, голос', hintEn: 'Toggle island, Alt+Space, chat, voice', keywords: 'клавиши хоткеи шорткаты alt space открыть hotkeys shortcuts' },
  { section: 'hotkeys', groupId: 'hotkeys-capture', ru: 'Клавиши скриншотов, записи, OCR, QR и пипетки', en: 'Screenshot, recording, OCR, QR & color picker keys', hintRu: 'PrtSc, область, экран, пипетка, буфер обмена', hintEn: 'PrtSc, area, screen, color picker, clipboard', keywords: 'скриншот prtsc запись ocr qr пипетка буфер клавиша' },
  { section: 'hotkeys', groupId: 'hotkeys-modes', ru: 'Клавиши режимов: микрофон, сквозной, VPN, тема', en: 'Mode keys: mic, through, VPN, theme & fullscreen', hintRu: 'Быстрые переключатели одной комбинацией', hintEn: 'One-key mode toggles', keywords: 'микрофон сквозной vpn тема музыка полный экран автоскрытие' },
  { section: 'hotkeys', groupId: 'hotkeys-launcher', ru: 'Клавиши ярлыков лаунчера', en: 'Launcher shortcut hotkeys', hintRu: 'Личная горячая клавиша на любую программу из лаунчера', hintEn: 'Custom hotkey for any pinned launcher app', keywords: 'лаунчер ярлык программа запуск клавиша launcher' },
  { section: 'connections', ru: 'Подключения и диагностика модулей', en: 'Connections & module diagnostics', hintRu: 'Проверка готовности всех систем и быстрая справка', hintEn: 'Readiness check for every module and quick guide', keywords: 'подключения статус диагностика отчет соединения connections' },
  { section: 'updates', ru: 'Обновления и история версий', en: 'Updates & changelog', hintRu: 'Проверка релизов, автоскачивание и что нового', hintEn: 'Release check, auto-download and changelog', keywords: 'обновление версия релиз скачать updates changelog' },
  { section: 'pro', ru: 'О приложении Woods Island', en: 'About Woods Island', hintRu: 'Версия, бесплатный статус и контакты автора', hintEn: 'Version, free status and author contacts', keywords: 'о приложении автор версия бесплатно контакты about woods' },
];

export function searchSettings(query: string): SettingsSearchEntry[] {
  const tokens = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return [];
  return SETTINGS_SEARCH_INDEX.filter((item) => {
    const haystack = `${item.ru} ${item.en} ${item.hintRu} ${item.hintEn} ${item.keywords}`.toLowerCase();
    return tokens.every((tok) => haystack.includes(tok));
  });
}
