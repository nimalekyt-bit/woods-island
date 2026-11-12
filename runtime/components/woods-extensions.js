// Compatibility application source; migrate components incrementally.
// Woods-owned additions to the extracted runtime; keep their source readable.
// Reserve the song's lyric width once, so short/long lines do not resize the HUD.
export function songLyricsWidth(widths) {
  const widest = widths.reduce((max, width) => (Number.isFinite(width) ? Math.max(max, width) : max), 0);
  return widest > 0 ? Math.ceil(Math.min(520, Math.max(170, widest)) / 16) * 16 : 0;
}

export const lyricsSizeTransition = {
  type: "spring",
  stiffness: 220,
  damping: 30,
  mass: 1,
};

export function validWeatherForecast(value) {
  return (
    value &&
    typeof value.now?.temp === "number" &&
    typeof value.now?.code === "number" &&
    Array.isArray(value.hours) &&
    value.hours.length > 0 &&
    value.hours.every((hour) => Number.isFinite(hour.time) && hour.time > 0 && hour.time < 1e11) &&
    Array.isArray(value.days) &&
    value.days.length > 0
  );
}
export const woodsInfoIcon = {
  name: "info",
  size: 24,
  node: [
    ["circle", { cx: "12", cy: "12", r: "10", key: "outline" }],
    ["path", { d: "M12 16v-4", key: "stem" }],
    ["path", { d: "M12 8h.01", key: "dot" }],
  ],
};
export function exportNote({ id, title, text }) {
  return window.__TAURI_INTERNALS__.invoke("note_export", { id: id || null, title, text });
}

export function woodsAbout(jsx, t) {
  return jsx.jsxs("section", {
    id: "pro",
    "data-woods-about": true,
    className: "flex flex-col gap-3 rounded-2xl bg-white/[0.045] p-4 ring-1 ring-white/10",
    children: [
      jsx.jsx("h2", { className: "text-[15px] font-semibold", children: "Woods Island" }),
      jsx.jsx("div", {
        className: "text-[12.5px] text-white/70",
        children: t(
          "Бесплатно · Все функции доступны без ключа и подписки",
          "Free · All features available without a key or subscription",
        ),
      }),
      jsx.jsx("div", {
        className: "text-[12px] leading-snug text-white/55",
        children: t(
          "Остров для Windows от Никиты Кузнецова (Woods). Музыка, буфер обмена, заметки, экранные инструменты, OBS и ИИ в одном месте.",
          "A Windows island by Nikita Kuznetsov (Woods). Music, clipboard, notes, screen tools, OBS and AI in one place.",
        ),
      }),
      jsx.jsx("ul", {
        className: "grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-white/70",
        children: [
          t("Все 36 встроенных персонажей", "All 36 built-in characters"),
          t("Заметки и экспорт в Obsidian", "Notes and Obsidian export"),
          t("OBS и статусы ИИ-агентов", "OBS and AI agent status"),
          t("Локальные модели и свои API-ключи", "Local models and your API keys"),
        ].map((text) => jsx.jsx("li", { children: text }, text)),
      }),
      jsx.jsx("div", {
        className: "text-[12px] leading-snug text-white/45",
        children: t(
          "Стоимость внешних ИИ-сервисов зависит от выбранного провайдера. Woods Island не продаёт доступ к ним.",
          "External AI service costs depend on your provider. Woods Island does not sell access to them.",
        ),
      }),
    ],
  });
}

export function woodsContact(jsx, t, open) {
  return jsx.jsxs("section", {
    "data-woods-contact": true,
    className: "flex flex-col gap-3 rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/10",
    children: [
      jsx.jsx("h2", {
        className: "text-[13.5px] font-semibold",
        children: t("Woods Personal Corp", "Woods Personal Corp"),
      }),
      jsx.jsx("div", {
        className: "text-[12px] text-white/55",
        children: t(
          "Идеи и сообщения об ошибках — автору проекта.",
          "Send ideas and bug reports to the project author.",
        ),
      }),
      jsx.jsxs("div", {
        className: "flex gap-2",
        children: [
          jsx.jsx("button", {
            "data-woods-telegram": true,
            className: "press h-9 rounded-lg bg-white/10 px-4 text-[13px] hover:bg-white/15",
            onClick: () => void open("https://t.me/woodskilla"),
            children: "Telegram · @woodskilla",
          }),
          jsx.jsx("button", {
            "data-woods-github": true,
            className: "press h-9 rounded-lg bg-white/10 px-4 text-[13px] hover:bg-white/15",
            onClick: () => void open("https://github.com/nimalekyt-bit"),
            children: "GitHub",
          }),
        ],
      }),
    ],
  });
}

