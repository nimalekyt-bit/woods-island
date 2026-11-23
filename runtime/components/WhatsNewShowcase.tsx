import { React } from "../react";
import { H as t } from "../compat/shared.js";
import { CharacterSprite } from "../characters/CharacterSprite";
import { seasonalDefinitions } from "../characters/seasonal";
import type { CharacterMood } from "../characters/types";
import type { ShowcaseClipId, ShowcaseSlide } from "../releases/showcase";

const clipUrlCache = new Map<string, string>();
const clipInflight = new Map<string, Promise<string | null>>();

function reducedMotionPreferred(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

async function fetchClipUrl(
  version: string,
  id: ShowcaseClipId,
  lang: "ru" | "en",
): Promise<string | null> {
  const key = `${version}/${id}/${lang}`;
  if (clipUrlCache.has(key)) return clipUrlCache.get(key) ?? null;
  const existing = clipInflight.get(key);
  if (existing) return existing;
  const invokeRaw =
    typeof window !== "undefined" ? window.__TAURI_INTERNALS__?.invoke : undefined;
  if (!invokeRaw) return null;
  const fallbackLang: "ru" | "en" = lang === "en" ? "ru" : "en";
  const task = (async () => {
    try {
      const attempt = async (l: "ru" | "en") =>
        (await invokeRaw("whatsnew_clip", { version, name: id, lang: l })) as
          | number[]
          | Uint8Array
          | null;
      let raw: number[] | Uint8Array | null = null;
      try {
        raw = await attempt(lang);
      } catch (err) {
        if (/HTTP 404|not found/i.test(String(err))) {
          raw = await attempt(fallbackLang).catch(() => null);
        }
      }
      if (!raw || raw.length < 16) return null;
      const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
      const url = URL.createObjectURL(
        new Blob([bytes.buffer as ArrayBuffer], { type: "video/mp4" }),
      );
      clipUrlCache.set(key, url);
      return url;
    } catch {
      return null;
    } finally {
      clipInflight.delete(key);
    }
  })();
  clipInflight.set(key, task);
  return task;
}

/** Crisp authentic 3-finder QR glyph for the Phone showcase card */
function ShowcaseQrSvg() {
  return (
    <svg viewBox="0 0 21 21" className="wi-sc-qr-svg" aria-hidden="true">
      <rect width="21" height="21" rx="2" fill="#ffffff" />
      {/* Top-left finder */}
      <rect x="2" y="2" width="6" height="6" rx="1" fill="#111318" />
      <rect x="3.2" y="3.2" width="3.6" height="3.6" rx="0.5" fill="#ffffff" />
      <rect x="4.2" y="4.2" width="1.6" height="1.6" rx="0.3" fill="#111318" />
      {/* Top-right finder */}
      <rect x="13" y="2" width="6" height="6" rx="1" fill="#111318" />
      <rect x="14.2" y="3.2" width="3.6" height="3.6" rx="0.5" fill="#ffffff" />
      <rect x="15.2" y="4.2" width="1.6" height="1.6" rx="0.3" fill="#111318" />
      {/* Bottom-left finder */}
      <rect x="2" y="13" width="6" height="6" rx="1" fill="#111318" />
      <rect x="3.2" y="14.2" width="3.6" height="3.6" rx="0.5" fill="#ffffff" />
      <rect x="4.2" y="15.2" width="1.6" height="1.6" rx="0.3" fill="#111318" />
      {/* Balanced data modules */}
      <g fill="#111318">
        <rect x="9.5" y="2.5" width="1.4" height="1.4" rx="0.25" />
        <rect x="9.5" y="5.1" width="1.4" height="1.4" rx="0.25" />
        <rect x="9.5" y="7.7" width="1.4" height="1.4" rx="0.25" />
        <rect x="2.5" y="9.5" width="1.4" height="1.4" rx="0.25" />
        <rect x="5.1" y="9.5" width="1.4" height="1.4" rx="0.25" />
        <rect x="7.7" y="9.5" width="1.4" height="1.4" rx="0.25" />
        <rect x="10.3" y="10.3" width="1.4" height="1.4" rx="0.25" />
        <rect x="12.9" y="9.5" width="1.4" height="1.4" rx="0.25" />
        <rect x="15.5" y="9.5" width="1.4" height="1.4" rx="0.25" />
        <rect x="17.6" y="11.2" width="1.4" height="1.4" rx="0.25" />
        <rect x="9.5" y="13" width="1.4" height="1.4" rx="0.25" />
        <rect x="12.1" y="13" width="1.4" height="1.4" rx="0.25" />
        <rect x="14.7" y="12.1" width="1.4" height="1.4" rx="0.25" />
        <rect x="14.7" y="14.7" width="1.4" height="1.4" rx="0.25" />
        <rect x="17.3" y="14.7" width="1.4" height="1.4" rx="0.25" />
        <rect x="10.3" y="16.4" width="1.4" height="1.4" rx="0.25" />
        <rect x="12.9" y="17.3" width="1.4" height="1.4" rx="0.25" />
        <rect x="16.4" y="17.3" width="1.4" height="1.4" rx="0.25" />
      </g>
    </svg>
  );
}

function PhoneScene({ lang, still }: { lang: "ru" | "en"; still: boolean }) {
  return (
    <div
      className={`wi-sc-scene wi-sc-phone${still ? " is-still" : ""}`}
      aria-hidden="true"
    >
      <div className="wi-sc-handset">
        <div className="wi-sc-handset-notch" />
        <div className="wi-sc-handset-screen">
          <ShowcaseQrSvg />
          <span className="wi-sc-handset-tag">
            <i />
            {lang === "ru" ? "Wi-Fi · локально" : "Wi-Fi · local"}
          </span>
        </div>
      </div>

      <div className="wi-sc-transfer-flow">
        <span />
        <span />
        <span />
      </div>

      <div className="wi-sc-island-shelf">
        <div className="wi-sc-island-shelf-head">
          <span className="wi-sc-island-dot" />
          <strong>{lang === "ru" ? "Полка Woods Island" : "Woods Island Shelf"}</strong>
          <em>{lang === "ru" ? "на связи" : "linked"}</em>
        </div>
        <div className="wi-sc-shelf-cards">
          <div className="wi-sc-card wi-sc-card-photo">
            <svg viewBox="0 0 88 44" className="wi-sc-photo-art">
              <defs>
                <linearGradient id="wiScSky" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#1e3a8a" />
                  <stop offset="55%" stopColor="#4f46e5" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>
              <rect width="88" height="44" rx="5" fill="url(#wiScSky)" />
              <circle cx="67" cy="14" r="6" fill="#fef08a" opacity="0.92" />
              <path d="M0 44 L26 20 L48 35 L64 24 L88 44 Z" fill="#0f172a" opacity="0.78" />
              <path d="M18 44 L44 24 L74 44 Z" fill="#1e293b" opacity="0.9" />
            </svg>
            <div className="wi-sc-card-foot">
              <span>IMG_4021.jpg</span>
              <em className="is-ok">✓ 3.8 {lang === "ru" ? "МБ" : "MB"}</em>
            </div>
          </div>
          <div className="wi-sc-card wi-sc-card-doc">
            <div className="wi-sc-doc-badge">PDF</div>
            <div className="wi-sc-card-foot">
              <span>Woods-Brief.pdf</span>
              <em>{lang === "ru" ? "в буфере" : "copied"}</em>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HolidaysScene({ lang, still }: { lang: "ru" | "en"; still: boolean }) {
  const bulbs = [
    { cx: 34, cy: 48, color: "#fb7185" },
    { cx: 64, cy: 52, color: "#fbbf24" },
    { cx: 96, cy: 54, color: "#34d399" },
    { cx: 128, cy: 54, color: "#60a5fa" },
    { cx: 160, cy: 52, color: "#c084fc" },
    { cx: 190, cy: 48, color: "#fbbf24" },
  ];
  return (
    <div
      className={`wi-sc-scene wi-sc-holidays${still ? " is-still" : ""}`}
      aria-hidden="true"
    >
      <div className="wi-sc-flakes">
        {Array.from({ length: 18 }, (_, i) => (
          <span
            key={i}
            style={{
              left: `${4 + ((i * 17) % 92)}%`,
              animationDelay: `${(i * 0.31) % 3.6}s`,
              animationDuration: `${3.0 + (i % 4) * 0.75}s`,
              width: `${2 + (i % 3)}px`,
              height: `${2 + (i % 3)}px`,
              opacity: 0.4 + (i % 3) * 0.22,
            }}
          />
        ))}
      </div>

      <div className="wi-sc-desktop-frame">
        <div className="wi-sc-festive-pill-wrap">
          {/* Organic sculpted snowdrift hugging the pill's top curve */}
          <svg
            viewBox="0 0 224 66"
            className="wi-sc-festive-svg"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="wiScSnow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#cbd5e1" />
              </linearGradient>
              <filter id="wiScBulbGlow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="2.4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Authentic dark Woods Island Dynamic Pill */}
            <rect
              x="14"
              y="10"
              width="196"
              height="36"
              rx="18"
              fill="#050609"
              stroke="rgba(255,255,255,0.14)"
              strokeWidth="1"
            />

            {/* Soft snow cap hugging the top rim of the pill */}
            <path
              d="M32 10.5 C52 4.5, 76 6.2, 102 5.4 C128 4.6, 152 6.8, 174 5.8 C186 5.3, 195 7.5, 199 11.2 C192 14.5, 183 12.2, 174 14.2 C161 17.0, 148 12.6, 134 15.0 C120 17.4, 105 12.8, 91 14.8 C76 16.9, 61 12.5, 48 14.4 C40 15.6, 33 13.8, 32 10.5 Z"
              fill="url(#wiScSnow)"
            />

            {/* Inside pill content: artwork dot + track equalizer + clock + temp */}
            <circle cx="34" cy="28" r="7" fill="url(#wiScSky)" opacity="0.95" />
            <rect x="48" y="25" width="2.2" height="6" rx="1" fill="#7dd3fc" />
            <rect x="52" y="22" width="2.2" height="12" rx="1" fill="#93c5fd" />
            <rect x="56" y="24" width="2.2" height="8" rx="1" fill="#60a5fa" />
            <text
              x="114"
              y="32"
              textAnchor="middle"
              fill="#f8fafc"
              fontSize="12"
              fontWeight="600"
              fontFamily="Segoe UI, system-ui, sans-serif"
            >
              00:57
            </text>
            <circle cx="144" cy="28" r="1.6" fill="rgba(255,255,255,0.35)" />
            <text
              x="170"
              y="32"
              textAnchor="middle"
              fill="#93c5fd"
              fontSize="11.5"
              fontWeight="600"
              fontFamily="Segoe UI, system-ui, sans-serif"
            >
              ❄ -4°
            </text>

            {/* Catenary garland cord under the pill */}
            <path
              d="M28 44 Q112 58 196 44"
              fill="none"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="1"
            />
            {bulbs.map((b, idx) => (
              <circle
                key={idx}
                cx={b.cx}
                cy={b.cy}
                r="3.2"
                fill={b.color}
                filter="url(#wiScBulbGlow)"
                className="wi-sc-bulb"
                style={{ animationDelay: `${idx * 0.24}s` }}
              />
            ))}
          </svg>
          <span className="wi-sc-frame-caption">
            {lang === "ru"
              ? "Динамическая пилюля · снег и гирлянда в такт музыке"
              : "Dynamic pill · snow cap & music-reactive garland"}
          </span>
        </div>
      </div>
    </div>
  );
}

function SeasonalCharsScene({ still }: { still: boolean }) {
  const [moodIndex, setMoodIndex] = React.useState(0);
  const moods: CharacterMood[] = ["idle", "happy", "music", "attn"];
  React.useEffect(() => {
    if (still) return;
    const timer = window.setInterval(
      () => setMoodIndex((i) => (i + 1) % moods.length),
      1900,
    );
    return () => window.clearInterval(timer);
  }, [still]);
  const mood = still ? "idle" : moods[moodIndex];
  return (
    <div className="wi-sc-scene wi-sc-chars" aria-hidden="true">
      <div className="wi-sc-chars-dock">
        {seasonalDefinitions.map((def) => (
          <div className="wi-sc-char-chip" key={def.id}>
            <div className="wi-sc-char-stage">
              <CharacterSprite
                definition={def}
                mood={mood}
                width={42}
                height={42}
                level={mood === "music" ? 0.72 : 0}
                still={still}
              />
            </div>
            <span>{def.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotchScene({ lang, still }: { lang: "ru" | "en"; still: boolean }) {
  const looks = [
    { key: "black", ru: "Чёрная", en: "Black" },
    { key: "glass", ru: "Стекло", en: "Glass" },
    { key: "wallpaper", ru: "Обои", en: "Wallpaper" },
  ] as const;
  const [lookIdx, setLookIdx] = React.useState(0);
  React.useEffect(() => {
    if (still) return;
    const timer = window.setInterval(
      () => setLookIdx((i) => (i + 1) % looks.length),
      2100,
    );
    return () => window.clearInterval(timer);
  }, [still]);
  const current = looks[lookIdx];
  return (
    <div
      className={`wi-sc-scene wi-sc-notch is-${current.key}`}
      aria-hidden="true"
    >
      <div className="wi-sc-monitor">
        <div className="wi-sc-notch-strip">
          <div className="wi-sc-notch-pill">
            <i />
            <span>00:57</span>
          </div>
        </div>
        <div className="wi-sc-window">
          <div className="wi-sc-window-bar">
            <span />
            <span />
            <span />
            <em>
              {lang === "ru"
                ? `Полоса выреза: ${current.ru}`
                : `Notch strip: ${current.en}`}
            </em>
          </div>
          <div className="wi-sc-window-body">
            <div className="wi-sc-window-line is-wide" />
            <div className="wi-sc-window-line" />
          </div>
        </div>
      </div>
    </div>
  );
}

function CitiesScene({ lang, still }: { lang: "ru" | "en"; still: boolean }) {
  const cities = [
    {
      ru: "Брянск",
      en: "Bryansk",
      temp: "-2°",
      feels: lang === "ru" ? "Ощущается -6°" : "Feels -6°",
      wind: lang === "ru" ? "4 м/с СЗ" : "4 m/s NW",
      tone: "#93c5fd",
    },
    {
      ru: "Москва",
      en: "Moscow",
      temp: "+14°",
      feels: lang === "ru" ? "Ощущается +13°" : "Feels +13°",
      wind: lang === "ru" ? "3 м/с З" : "3 m/s W",
      tone: "#60a5fa",
    },
    {
      ru: "Токио",
      en: "Tokyo",
      temp: "+22°",
      feels: lang === "ru" ? "Ясно · штиль" : "Clear · calm",
      wind: lang === "ru" ? "6 м/с В" : "6 m/s E",
      tone: "#fbbf24",
    },
  ];
  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => {
    if (still) return;
    const timer = window.setInterval(
      () => setIdx((i) => (i + 1) % cities.length),
      2200,
    );
    return () => window.clearInterval(timer);
  }, [still]);
  const active = cities[idx];
  return (
    <div className="wi-sc-scene wi-sc-cities" aria-hidden="true">
      <div className="wi-sc-city-pills">
        {cities.map((c, i) => (
          <span key={c.en} className={i === idx ? "is-active" : ""}>
            {c[lang]}
          </span>
        ))}
      </div>
      <div
        className="wi-sc-weather-card"
        style={{ borderColor: `${active.tone}38` }}
      >
        <strong style={{ color: active.tone }}>{active.temp}</strong>
        <div className="wi-sc-weather-info">
          <span>{active[lang]}</span>
          <em>
            {active.feels} · {active.wind}
          </em>
        </div>
      </div>
    </div>
  );
}

export function WhatsNewShowcase({
  version,
  slides,
}: {
  version: string;
  slides: ShowcaseSlide[];
}) {
  const lang = t("ru", "en") as "ru" | "en";
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [playing, setPlaying] = React.useState(() => !reducedMotionPreferred());
  const [clipUrls, setClipUrls] = React.useState<Record<string, string | null>>(
    {},
  );

  const slide = slides[activeIndex] ?? slides[0];

  React.useEffect(() => {
    if (!slide) return;
    const key = `${version}/${slide.id}/${lang}`;
    if (key in clipUrls) return;
    let alive = true;
    fetchClipUrl(version, slide.id, lang).then((url) => {
      if (alive) setClipUrls((prev) => ({ ...prev, [key]: url }));
    });
    return () => {
      alive = false;
    };
  }, [version, slide?.id, lang]);

  React.useEffect(() => {
    if (!playing || slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [playing, slides.length]);

  if (!slide) return null;
  const clipUrl = clipUrls[`${version}/${slide.id}/${lang}`] ?? null;
  const still = !playing || reducedMotionPreferred();

  return (
    <div className="wi-showcase" data-whatsnew-showcase={version}>
      <div
        className="wi-showcase-stage"
        style={{ "--wi-sc-accent": slide.accent } as React.CSSProperties}
      >
        {clipUrl ? (
          <video
            key={clipUrl}
            src={clipUrl}
            autoPlay={!still}
            muted
            loop
            playsInline
            className="wi-showcase-video"
          />
        ) : slide.id === "phone" ? (
          <PhoneScene lang={lang} still={still} />
        ) : slide.id === "holidays" ? (
          <HolidaysScene lang={lang} still={still} />
        ) : slide.id === "chars" ? (
          <SeasonalCharsScene still={still} />
        ) : slide.id === "notch" ? (
          <NotchScene lang={lang} still={still} />
        ) : (
          <CitiesScene lang={lang} still={still} />
        )}
        <div className="wi-showcase-overlay">
          <span className="wi-showcase-pill">{slide.badge[lang]}</span>
          <button
            type="button"
            className="wi-showcase-play"
            onClick={() => setPlaying((p) => !p)}
            aria-label={
              playing ? t("Пауза", "Pause") : t("Воспроизвести", "Play")
            }
          >
            {playing ? t("Пауза", "Pause") : t("Играть", "Play")}
          </button>
        </div>
      </div>
      <div className="wi-showcase-meta">
        <strong>{slide.title[lang]}</strong>
        <p>{slide.caption[lang]}</p>
      </div>
      <div
        className="wi-showcase-tabs"
        role="tablist"
        aria-label={t("Главное в обновлении", "Release highlights")}
      >
        {slides.map((item, idx) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={idx === activeIndex}
            data-showcase-tab={item.id}
            className={idx === activeIndex ? "is-active" : ""}
            onClick={() => setActiveIndex(idx)}
          >
            {item.badge[lang]}
          </button>
        ))}
      </div>
    </div>
  );
}
