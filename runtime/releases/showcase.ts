export type ShowcaseClipId = "phone" | "holidays" | "chars" | "notch" | "cities";

export interface ShowcaseSlide {
  id: ShowcaseClipId;
  badge: { ru: string; en: string };
  title: { ru: string; en: string };
  caption: { ru: string; en: string };
  accent: string;
}

export const LATEST_SHOWCASE_SLIDES: ShowcaseSlide[] = [
  {
    id: "phone",
    badge: { ru: "Телефон", en: "Phone" },
    title: { ru: "Передача с телефона по QR", en: "QR transfer from your phone" },
    caption: {
      ru: "Фото, файлы и текст летят напрямую по локальной сети на ступенчатую полку с превью — без облака и приложений.",
      en: "Photos, files and text travel over your local network to a tiered shelf with previews — no cloud or extra apps.",
    },
    accent: "#7fa7ff",
  },
  {
    id: "holidays",
    badge: { ru: "Праздники", en: "Holidays" },
    title: { ru: "Снег, шапка и гирлянда", en: "Snow, cap and garland" },
    caption: {
      ru: "Снежинки из-под пилюли, мягкая шапка, гирлянда в такт музыке и отдельный экранный снег без мигания.",
      en: "Flakes from the pill, a soft snow cap, music-reactive garland and an independent full-screen snow layer.",
    },
    accent: "#88d4ff",
  },
  {
    id: "chars",
    badge: { ru: "Персонажи", en: "Characters" },
    title: { ru: "Пять сезонных персонажей Woods", en: "Five seasonal Woods characters" },
    caption: {
      ru: "Снеговик, Дед Мороз, Снегирь, Пряник и Олень — живые авторские рисунки Woods, бесплатно рядом со всеми питомцами.",
      en: "Snowman, Frost, Bullfinch, Gingerbread and Reindeer — original animated Woods drawings, free alongside every pet.",
    },
    accent: "#f7b267",
  },
  {
    id: "notch",
    badge: { ru: "Вырез", en: "Notch" },
    title: { ru: "Вырез сверху, как на MacBook", en: "MacBook-style top notch strip" },
    caption: {
      ru: "Полоса высотой с пилюлю резервирует место у верха экрана: развёрнутые окна начинаются строго под островом.",
      en: "A pill-height strip reserves the top of the monitor so maximized windows begin cleanly below the island.",
    },
    accent: "#a5b4fc",
  },
  {
    id: "cities",
    badge: { ru: "Погода", en: "Weather" },
    title: { ru: "Несколько городов и плавные цифры", en: "Multi-city weather & smooth numbers" },
    caption: {
      ru: "Переключай до восьми сохранённых городов в один клик — температура, ветер и шкалы плавно подстраиваются.",
      en: "Switch up to eight saved cities with one click — temperatures, wind and gauges glide smoothly into place.",
    },
    accent: "#6ee7b7",
  },
];

export function showcaseForVersion(version: string, index: number): ShowcaseSlide[] {
  if (index !== 0) return [];
  const parts = version.split(".").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return [];
  // Show the full highlight reel on 1.4.0+ (and preview on current worktree builds >= 1.3.1)
  if (parts[0] > 1 || (parts[0] === 1 && parts[1] >= 4)) return LATEST_SHOWCASE_SLIDES;
  return [];
}
