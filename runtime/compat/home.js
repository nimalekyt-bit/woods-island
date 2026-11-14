import { CollapsedTrack, MediaTitle } from '../components/CollapsedTrack';
import { weatherDate } from '../weather/date';
import { NormalMediaPill } from '../components/NormalMediaPill';
import { LyricsMediaPill } from '../components/LyricsMediaPill';
// Compatibility application source; migrate components incrementally.
import {
  O as ReactRuntime,
  D as jsxRuntime,
  ml,
  od,
  Me,
  Fi,
  Kn,
  xa,
  Gi,
  Qi,
  Pr,
  N,
  Mn,
  vr,
  j,
  st,
  _r,
  ei,
  Ir,
  Pi,
  Lr,
  Ne,
  Jn,
  Ca,
  W,
  H,
  Un,
  P,
  Le,
  Ve,
  Pe,
  eo,
  Ta,
  ke,
  Ho,
  pc,
  ui,
  Ni,
  rl,
  Xe,
  Oe,
  Pa,
  aa,
  wa,
  Ea,
  qn,
} from "../vendor/motion.js";
import { validWeatherForecast } from "./../components/woods-extensions.js";
import {
  B as e,
  E as t,
  G as n,
  H as r,
  O as i,
  T as a,
  V as o,
  a as s,
  c,
  d as l,
  i as u,
  l as d,
  m as f,
  n as p,
  o as m,
  q as h,
  t as g,
  u as _,
  z as v,
} from "./shared.js";
import {
  F as y,
  H as b,
  I as x,
  J as S,
  K as C,
  L as ee,
  P as te,
  R as w,
  S as ne,
  T as re,
  V as ie,
  W as ae,
  X as oe,
  Y as se,
  _t as T,
  d as ce,
  dt as le,
  et as ue,
  gt as de,
  h as fe,
  it as pe,
  m as me,
  nt as he,
  ot as useIslandStore,
  p as ge,
  st as _e,
  u as ve,
  v as ye,
  w as be,
  xt as xe,
  yt as Se,
  z as Ce,
} from "./island-store.js";
import { n as we, t as Te } from "./check.js";
import { t as Ee } from "./close.js";
function sd(e) {
  return e && /^#[0-9a-f]{6}$/i.test(e) ? e.toLowerCase() : null;
}
function cd(e) {
  let t = (t) => {
    let n = parseInt(e.slice(t, t + 2), 16) / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * t(1) + 0.7152 * t(3) + 0.0722 * t(5);
}
function ld(e) {
  let t = cd(e);
  return (t + 0.05) / 0.05 > 1.05 / (t + 0.05);
}
function ud(e, t, n) {
  let r = sd(t);
  return r ? { theme: ld(r) ? `light` : `dark`, color: r } : { theme: dd(e, n), color: null };
}
function dd(e, t) {
  return e === `light` || (e === `auto` && t) ? `light` : `dark`;
}
var fd = {
  dark: { y: 12, blur: 34, spread: -10, alpha: 0.55 },
  light: { y: 12, blur: 32, spread: -10, alpha: 0.14 },
};
function pd(e, t) {
  let n = fd[e];
  return `0 ${n.y}px ${n.blur}px ${n.spread}px rgb(0 0 0 / ${t ? n.alpha : 0})`;
}
var Z = 1e3,
  md = 60 * Z,
  hd = 60 * md,
  gd = 5 * md,
  _d = 24 * hd,
  vd = [5, 10, 15, 25, 45],
  yd = (e) => Math.min(_d, Math.max(Z, Math.round(e)));
function bd(e = gd) {
  let t = yd(e);
  return { base: t, total: t, endsAt: null, left: null, doneAt: null };
}
function xd(e) {
  return e.doneAt === null ? (e.endsAt === null ? (e.left === null ? `idle` : `paused`) : `running`) : `done`;
}
function Sd(e, t) {
  return e.doneAt === null ? (e.endsAt === null ? (e.left ?? e.total) : Math.max(0, e.endsAt - t)) : 0;
}
function Cd(e, t, n = e.base) {
  let r = yd(n);
  return { base: r, total: r, endsAt: t + r, left: null, doneAt: null };
}
function wd(e, t) {
  return xd(e) === `running` ? { ...e, endsAt: null, left: Sd(e, t) } : e;
}
function Td(e, t) {
  return xd(e) === `paused` ? { ...e, endsAt: t + (e.left ?? 0), left: null } : e;
}
function Ed(e, t, n) {
  let r = xd(e);
  if (r !== `running` && r !== `paused`) return e;
  let i = Sd(e, t),
    a = Math.min(_d, Math.max(Z, i + n)),
    o = Math.max(a, e.total + (a - i));
  return r === `running` ? { ...e, total: o, endsAt: t + a } : { ...e, total: o, left: a };
}
function Dd(e, t) {
  return e.endsAt !== null && t >= e.endsAt ? { ...e, endsAt: null, left: null, doneAt: e.endsAt } : e;
}
function Od(e, t) {
  return Math.ceil(Sd(e, t) / Z) * Z;
}
function kd(e) {
  try {
    let t = JSON.parse(e || `null`);
    if (!t || typeof t != `object`) return bd();
    let n = (e) => typeof e == `number` && Number.isFinite(e) && e >= Z && e <= 864e5,
      r = (e) => (typeof e == `number` && Number.isFinite(e) && e > 0 ? e : null);
    if (!n(t.base)) return bd();
    let i = t.base,
      a = n(t.total) ? Math.max(t.total, i) : i,
      [o, s] = [r(t.endsAt), r(t.doneAt)],
      c = typeof t.left == `number` && Number.isFinite(t.left) && t.left >= 0 && t.left <= a ? t.left : null;
    return s === null
      ? o === null
        ? { base: i, total: a, endsAt: null, left: c, doneAt: null }
        : { base: i, total: a, endsAt: o, left: null, doneAt: null }
      : { base: i, total: a, endsAt: null, left: null, doneAt: s };
  } catch {
    return bd();
  }
}
var Ad = [
  [/^(с|сек|секунд[аыу]?|s|sec|secs|seconds?)$/, Z],
  [/^(м|мин|минут[аыу]?|m|min|mins|minutes?)$/, md],
  [/^(ч|час|часа|часов|h|hr|hrs|hours?)$/, hd],
];
function jd(e) {
  let t = e.toLowerCase().replace(/ё/g, `е`).replace(/\s+/g, ` `).trim();
  if (!t) return null;
  let n = (e) => (e >= Z && e <= 864e5 ? Math.round(e) : null);
  if (/^(полчаса|half an hour)$/.test(t)) return 30 * md;
  if (/^(час|an hour|hour)$/.test(t)) return hd;
  if (/^(минута|минуту|a minute|minute)$/.test(t)) return md;
  let r = /^(\d{1,3}):(\d{2})(?::(\d{2}))?$/.exec(t);
  if (r) {
    let [e, t, i] = [Number(r[1]), Number(r[2]), r[3] === void 0 ? null : Number(r[3])];
    return t > 59 || (i !== null && i > 59) ? null : n(i === null ? e * md + t * Z : e * hd + t * md + i * Z);
  }
  if (/^\d+(?:[.,]\d+)?$/.test(t)) return n(parseFloat(t.replace(`,`, `.`)) * md);
  let i = /(\d+(?:[.,]\d+)?)\s*([a-zа-я]+)\.?\s*/gy,
    a = 0,
    o = 0;
  for (let e = i.exec(t); e; e = i.exec(t)) {
    let t = Ad.find(([t]) => t.test(e[2]))?.[1];
    if (!t) return null;
    ((a += parseFloat(e[1].replace(`,`, `.`)) * t), (o = i.lastIndex));
  }
  return o === t.length && o > 0 ? n(a) : null;
}
function Md(e) {
  let t = Math.max(0, Math.round(e / Z)),
    [n, i, a] = [Math.floor(t / 3600), Math.floor((t % 3600) / 60), t % 60],
    o = [
      n > 0 && r(`${n} ч`, `${n} h`),
      i > 0 && r(`${i} мин`, `${i} min`),
      a > 0 && (n === 0 || i === 0) && r(`${a} с`, `${a} s`),
    ].filter(Boolean);
  return o.length ? o.join(` `) : r(`0 с`, `0 s`);
}
function Nd(e, t) {
  let n = /^(таймер|timer|засеки|засечь)(?:\s+(?:на\s+|for\s+)?(.+))?$/.exec(
    e.toLowerCase().replace(/ё/g, `е`).replace(/\s+/g, ` `).trim(),
  );
  return n ? (n[2] ? jd(n[2]) : t) : null;
}
var Pd = 216e5,
  Fd = 3,
  Id = 2400,
  Ld,
  Rd;
function zd(e) {
  (Hd.setState({ timer: e }), i.timerSet(JSON.stringify(e)).catch(() => {}), Bd(), Ud());
}
function Bd() {
  clearTimeout(Rd);
  let e = useIslandStore.getState();
  e.peek?.kind === `timer` && e.nextPeek();
}
function Vd(e) {
  (i.chime(),
    clearTimeout(Rd),
    e > 1 && (Rd = setTimeout(() => xd(Hd.getState().timer) === `done` && Vd(e - 1), Id)));
}
var Hd = _e((e, t) => ({
  loaded: !1,
  timer: bd(),
  load: async () => {
    if (t().loaded) return;
    let n = bd();
    try {
      n = kd(await i.timerGet());
    } catch {}
    let r = n.doneAt ?? (n.endsAt !== null && n.endsAt <= Date.now() ? n.endsAt : null);
    (r !== null && Date.now() - r > Pd && (n = bd(n.base)), e({ loaded: !0, timer: n }), Ud());
  },
  start: (e) => zd(Cd(t().timer, Date.now(), e)),
  pause: () => zd(wd(t().timer, Date.now())),
  resume: () => zd(Td(t().timer, Date.now())),
  add: (e) => zd(Ed(t().timer, Date.now(), e)),
  reset: (e) => zd(bd(e ?? t().timer.base)),
  dismiss: () => zd(bd(t().timer.base)),
}));
function Ud() {
  let { loaded: e, timer: t } = Hd.getState();
  if (!e) return;
  clearTimeout(Ld);
  let n = Date.now(),
    r = Dd(t, n);
  if (
    (r !== t && (Hd.setState({ timer: r }), i.timerSet(JSON.stringify(r)).catch(() => {}), Vd(Fd)),
    r.endsAt !== null && (Ld = setTimeout(Ud, Math.min(r.endsAt - n + 15, 6e4))),
    r.doneAt === null)
  )
    return;
  Ld = setTimeout(Ud, 1e3);
  let a = useIslandStore.getState();
  a.expanded ||
    a.palette ||
    a.peek?.kind === `timer` ||
    a.pushPeek({ kind: `timer`, length: r.base, at: r.doneAt });
}
function Wd() {
  return (
    Hd.getState().load().then(Ud),
    () => {
      (clearTimeout(Ld), clearTimeout(Rd));
    }
  );
}
function Gd() {
  let e = Hd((e) => e.timer),
    t = xd(e),
    n = () => (t === `running` || t === `paused` ? T(Od(e, Date.now())).length : 0),
    [r, i] = (0, ReactRuntime.useState)(n);
  return (
    (0, ReactRuntime.useEffect)(() => {
      if ((i(n()), t !== `running`)) return;
      let e = setInterval(() => i(n()), 500);
      return () => clearInterval(e);
    }, [e]),
    r
  );
}
function Kd(e) {
  return e === 0 || e === 1
    ? `clear`
    : e === 2
      ? `partly`
      : e === 3
        ? `cloudy`
        : e === 45 || e === 48
          ? `fog`
          : e >= 51 && e <= 55
            ? `drizzle`
            : e === 56 || e === 57 || e === 66 || e === 67 || e === 68 || e === 69 || e === 83 || e === 84
              ? `sleet`
              : (e >= 61 && e <= 65) || (e >= 80 && e <= 82)
                ? `rain`
                : (e >= 71 && e <= 77) || e === 85 || e === 86
                  ? `snow`
                  : e >= 95
                    ? `storm`
                    : `cloudy`;
}
function qd(e) {
  switch (e) {
    case 0:
      return r(`Ясно`, `Clear`);
    case 1:
      return r(`Малооблачно`, `Mostly clear`);
    case 2:
      return r(`Переменная облачность`, `Partly cloudy`);
    case 3:
      return r(`Пасмурно`, `Overcast`);
    case 45:
    case 48:
      return r(`Туман`, `Fog`);
    case 51:
    case 53:
    case 55:
      return r(`Морось`, `Drizzle`);
    case 56:
    case 57:
      return r(`Ледяная морось`, `Freezing drizzle`);
    case 61:
      return r(`Небольшой дождь`, `Light rain`);
    case 63:
      return r(`Дождь`, `Rain`);
    case 65:
      return r(`Сильный дождь`, `Heavy rain`);
    case 66:
    case 67:
      return r(`Ледяной дождь`, `Freezing rain`);
    case 68:
    case 69:
      return r(`Дождь со снегом`, `Sleet`);
    case 83:
    case 84:
      return r(`Ливень со снегом`, `Sleet showers`);
    case 71:
      return r(`Небольшой снег`, `Light snow`);
    case 73:
      return r(`Снег`, `Snow`);
    case 75:
      return r(`Сильный снег`, `Heavy snow`);
    case 77:
      return r(`Снежная крупа`, `Snow grains`);
    case 80:
      return r(`Небольшой ливень`, `Light showers`);
    case 81:
      return r(`Ливень`, `Showers`);
    case 82:
      return r(`Сильный ливень`, `Heavy showers`);
    case 85:
    case 86:
      return r(`Снегопад`, `Snow showers`);
    case 95:
      return r(`Гроза`, `Thunderstorm`);
    case 96:
    case 99:
      return r(`Гроза с градом`, `Thunderstorm with hail`);
    default:
      return r(`Облачно`, `Cloudy`);
  }
}
function Jd(e) {
  let t = Math.round(e);
  return `${t < 0 ? `−` : ``}${Math.abs(t)}°`;
}
function Yd(e, t, n = !1) {
  let i = t === `imperial`;
  if (e < 0.1) return n ? (i ? `0 in` : r(`0 мм`, `0 mm`)) : ``;
  if (i) return `${(e / 25.4).toFixed(2)} in`;
  let a = e >= 10 ? String(Math.round(e)) : e.toFixed(1);
  return r(`${a.replace(`.`, `,`)} мм`, `${a} mm`);
}
function Xd(e, t) {
  return weatherDate(e, t);
}
function Zd(e, t) {
  return s(Xd(e, t).getUTCHours());
}
function Qd(e, t) {
  let n = Xd(e, t);
  return m(n.getUTCHours(), n.getUTCMinutes());
}
function $d(e, t, n) {
  if (n === 0) return r(`Сегодня`, `Today`);
  let i = Xd(e, t).toLocaleDateString(o(), { weekday: `short`, timeZone: `UTC` });
  return i.charAt(0).toUpperCase() + i.slice(1).replace(/\.$/, ``);
}
var ef = [`drizzle`, `rain`, `sleet`, `snow`, `storm`];
function tf(e, t) {
  if (e.now.precip > 0.05 || ef.includes(Kd(e.now.code))) return null;
  for (let n of e.hours) {
    let e = Math.round((n.time * 1e3 - t) / 6e4);
    if (e <= 0) continue;
    if (e > 90) break;
    let r = Kd(n.code);
    if (ef.includes(r) && n.precip >= 0.3) return { sky: r, at: n.time, minutes: e, temp: n.temp };
  }
  return null;
}
function nf(e) {
  let t =
    e.sky === `snow`
      ? r(`снег`, `snow`)
      : e.sky === `storm`
        ? r(`гроза`, `a thunderstorm`)
        : e.sky === `sleet`
          ? r(`дождь со снегом`, `sleet`)
          : r(`дождь`, `rain`);
  if (e.minutes <= 20) return r(`Скоро ${t}`, `${t.charAt(0).toUpperCase()}${t.slice(1)} soon`);
  if (e.minutes >= 50) return r(`Через час ${t}`, `${t.charAt(0).toUpperCase()}${t.slice(1)} in an hour`);
  let n = Math.round(e.minutes / 10) * 10;
  return r(`Через ${n} минут ${t}`, `${t.charAt(0).toUpperCase()}${t.slice(1)} in ${n} minutes`);
}
function rf(t) {
  return (
    e() === `ru`
      ? [
          `Северный`,
          `Северо-восточный`,
          `Восточный`,
          `Юго-восточный`,
          `Южный`,
          `Юго-западный`,
          `Западный`,
          `Северо-западный`,
        ]
      : [`North`, `Northeast`, `East`, `Southeast`, `South`, `Southwest`, `West`, `Northwest`]
  )[Math.round((((t % 360) + 360) % 360) / 45) % 8];
}
function af(t, n) {
  return t
    ? n === `imperial`
      ? [(t * 0.02953).toFixed(2), `inHg`]
      : e() === `ru`
        ? [String(Math.round(t * 0.750062)), `мм рт. ст.`]
        : [String(Math.round(t)), `hPa`]
    : [`—`, ``];
}
function of(e) {
  let t = e ?? 0;
  return Math.abs(t) < 1
    ? r(`→ держится`, `→ steady`)
    : t < 0
      ? r(`↓ падает`, `↓ falling`)
      : r(`↑ растёт`, `↑ rising`);
}
function sf(e) {
  let t = Math.round(e);
  return t < 3
    ? r(`низкий`, `low`)
    : t < 6
      ? r(`умеренный`, `moderate`)
      : t < 8
        ? r(`высокий`, `high`)
        : t < 11
          ? r(`очень высокий`, `very high`)
          : r(`экстремальный`, `extreme`);
}
function cf(e) {
  return e === `snow`
    ? [r(`Снег`, `Snow`), r(`снег`, `snow`)]
    : e === `sleet`
      ? [r(`Дождь со снегом`, `Sleet`), r(`дождь со снегом`, `sleet`)]
      : e === `storm`
        ? [r(`Гроза`, `The storm`), r(`гроза`, `a thunderstorm`)]
        : [r(`Дождь`, `The rain`), r(`дождь`, `rain`)];
}
function lf(e) {
  return e.precip >= 0.1 || (ef.includes(Kd(e.code)) && e.precip > 0);
}
function uf(e) {
  let t = e.hours,
    n = (n) => Zd(t[n].time, e.timezone || e.utcOffset),
    i = Kd(e.now.code),
    a = e.now.precip >= 0.1 || ef.includes(i),
    o;
  if (a) {
    let [e] = cf(ef.includes(i) ? i : Kd(t.find(lf)?.code ?? 61)),
      a = t.findIndex((e, t) => t > 0 && !lf(e));
    o =
      a === -1
        ? r(`${e} — все ближайшие сутки`, `${e} goes on for the next day`)
        : r(`${e} закончится к ${n(a)}`, `${e} ends by ${n(a)}`);
  } else {
    let e = t.findIndex((e, t) => t > 0 && lf(e));
    if (e === -1) o = r(`Сутки без осадков`, `Dry for the next day`);
    else {
      let [i, a] = cf(Kd(t[e].code));
      o = r(`Около ${n(e)} начнётся ${a}`, `${i} from about ${n(e)}`);
    }
  }
  let s = Xd(Math.floor(e.fetchedAt / 1e3), e.timezone || e.utcOffset).getUTCHours(),
    c = (t) => Xd(t.time, e.timezone || e.utcOffset).getUTCHours(),
    l = s >= 15 || s < 5,
    u = t.filter((e) => (l ? c(e) <= 6 : c(e) >= 12 && c(e) <= 17)).map((e) => e.temp);
  if (!u.length) return o;
  let d = l
    ? r(`ночью до ${Jd(Math.min(...u))}`, `down to ${Jd(Math.min(...u))} at night`)
    : r(`днём до ${Jd(Math.max(...u))}`, `up to ${Jd(Math.max(...u))} this afternoon`);
  return `${o}, ${d}`;
}
function df(e) {
  if (!e) return !1;
  let t = Kd(e.now.code);
  return t === `rain` || t === `drizzle` || t === `storm`;
}
var ff = 0,
  pf = _e((e) => ({
    data: null,
    loading: !1,
    error: null,
    refresh: () => {
      (e({ loading: !0, error: null }),
        i
          .weatherRefresh()
          .then((t) => pf.getState().received(t))
          .catch((t) => e({ loading: !1, error: String(t) })));
    },
    setPlace: (t) => {
      let n = useIslandStore.getState().settings;
      n &&
        (e({ loading: !0, error: null, data: null }),
        i.settingsSet({ ...n, weatherCity: t.name, weatherLat: t.lat, weatherLon: t.lon, weatherTimezone: `` }));
    },
    received: (t) => {
      if (!validWeatherForecast(t))
        return e({
          data: null,
          loading: !1,
          error: r(
            `Некорректные данные прогноза. Обновите погоду.`,
            `Invalid forecast data. Refresh the weather.`,
          ),
        });
      (e({ data: t, loading: !1, error: null }), mf());
    },
    failed: (t) => e((e) => ({ loading: !1, error: e.data ? null : t })),
  }));
function mf() {
  let e = useIslandStore.getState(),
    t = pf.getState().data;
  if (!t || e.settings?.weatherAlerts === !1 || e.settings?.moduleWeather === !1) return;
  let n = tf(t, Date.now());
  n &&
    n.at !== ff &&
    (e.expanded ||
      e.palette ||
      ((ff = n.at),
      e.pushPeek({
        kind: `weather`,
        sky: n.sky,
        title: nf(n),
        sub: r(`с ${Qd(n.at, t.timezone || t.utcOffset)} · ${Jd(n.temp)}`, `from ${Qd(n.at, t.timezone || t.utcOffset)} · ${Jd(n.temp)}`),
      })));
}
function hf() {
  i.weatherGet()
    .then((e) => {
      e && pf.getState().received(e);
    })
    .catch((e) => pf.getState().failed(String(e)));
  let e = setInterval(mf, 6e4);
  return () => clearInterval(e);
}
function gf() {
  let e = useIslandStore((e) => e.settings?.moduleWeather !== !1 && e.settings?.showWeather !== !1),
    t = pf((e) => e.data?.now ?? null);
  return !e || !t ? null : { sky: Kd(t.code), night: !t.isDay, temp: Jd(t.temp) };
}
function _f(e, t = Date.now()) {
  let n = e.playing ? t - e.updatedAt : 0;
  (n < 0 || n > 216e5) && (n = 0);
  let r = e.positionMs + n;
  return e.durationMs > 0 ? Math.min(r, e.durationMs) : r;
}
var vf = 2e3,
  yf = 2500;
function bf(e) {
  return { playing: e.playing, positionMs: e.positionMs, updatedAt: e.updatedAt };
}
function xf(e, t = null, n = Date.now()) {
  let r = { ...e, playing: !e.playing, positionMs: _f(e, n), updatedAt: n },
    i = t !== null && t.key === e.key && t.sought && n < t.until;
  return { media: r, wish: { key: e.key, until: n + vf, playing: r.playing, sought: i, shown: bf(r) } };
}
function Sf(e, t, n = null, r = Date.now()) {
  let i = Math.round(Math.min(Math.max(0, t), e.durationMs > 0 ? e.durationMs : t)),
    a = { ...e, positionMs: i, updatedAt: r },
    o = n !== null && n.key === e.key && r < n.until ? n.playing : void 0;
  return { media: a, wish: { key: e.key, until: r + vf, playing: o, sought: !0, shown: bf(a) } };
}
function Cf(e, t, n = Date.now()) {
  if (!e || n >= e.until || t.key !== e.key) return { media: t, wish: null };
  let r = { ...t, ...e.shown };
  return (e.playing === void 0 || t.playing === e.playing) &&
    (!e.sought || Math.abs(_f(t, n) - _f(r, n)) < yf)
    ? { media: t, wish: null }
    : { media: { ...r, playing: e.playing ?? t.playing }, wish: e };
}
function wf(e, t, n) {
  return n > 0 ? Math.min(1, Math.max(0, (e - t) / n)) : 0;
}
var Tf = null;
function Ef(e) {
  ((Tf = null), e && useIslandStore.getState().media?.key === e.key && useIslandStore.setState({ media: e }));
}
function togglePlayback() {
  let e = useIslandStore.getState().media,
    t;
  if (e) {
    let n = xf(e, Tf);
    ((Tf = n.wish),
      (t = n.media.playing),
      useIslandStore.setState(n.media.playing ? { media: n.media, mediaLive: !0 } : { media: n.media }));
  }
  i.mediaControl(`toggle`, t).catch(() => Ef(e));
}
function seekPlayback(e) {
  let t = useIslandStore.getState().media;
  if (!t || t.durationMs <= 0 || t.canSeek === false) return;
  let n = Sf(t, e, Tf);
  ((Tf = n.wish),
    useIslandStore.setState({ media: n.media }),
    i.mediaSeek(n.media.positionMs).catch(() => Ef(t)));
}
function kf(e) {
  let t = Cf(Tf, e);
  return ((Tf = t.wish), t.media);
}
var Af = {
  name: `arrow-down-to-line`,
  size: 24,
  node: [
    [`path`, { d: `M12 17V3`, key: `1cwfxf` }],
    [`path`, { d: `m6 11 6 6 6-6`, key: `12ii2o` }],
    [`path`, { d: `M19 21H5`, key: `150jfl` }],
  ],
};
Af.node;
var jf = p(Af),
  Mf = {
    name: `arrow-down`,
    size: 24,
    node: [
      [`path`, { d: `M12 5v14`, key: `s699le` }],
      [`path`, { d: `m19 12-7 7-7-7`, key: `1idqje` }],
    ],
  };
Mf.node;
var Nf = p(Mf),
  Pf = { name: `chevron-down`, size: 24, node: [[`path`, { d: `m6 9 6 6 6-6`, key: `qrunsl` }]] };
Pf.node;
var Ff = p(Pf),
  If = { name: `chevron-right`, size: 24, node: [[`path`, { d: `m9 18 6-6-6-6`, key: `mthhwq` }]] };
If.node;
var Lf = p(If),
  Rf = {
    name: `film`,
    size: 24,
    node: [
      [`rect`, { width: `18`, height: `18`, x: `3`, y: `3`, rx: `2`, key: `afitv7` }],
      [`path`, { d: `M7 3v18`, key: `bbkbws` }],
      [`path`, { d: `M3 7.5h4`, key: `zfgn84` }],
      [`path`, { d: `M3 12h18`, key: `1i2n21` }],
      [`path`, { d: `M3 16.5h4`, key: `1230mu` }],
      [`path`, { d: `M17 3v18`, key: `in4fa5` }],
      [`path`, { d: `M17 7.5h4`, key: `myr1c1` }],
      [`path`, { d: `M17 16.5h4`, key: `go4c1d` }],
    ],
  };
Rf.node;
var zf = p(Rf),
  Bf = {
    name: `folder-open`,
    size: 24,
    node: [
      [
        `path`,
        {
          d: `m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2`,
          key: `usdka0`,
        },
      ],
    ],
  };
Bf.node;
var Vf = p(Bf),
  Hf = {
    name: `link-2`,
    size: 24,
    node: [
      [`path`, { d: `M9 17H7A5 5 0 0 1 7 7h2`, key: `8i5ue5` }],
      [`path`, { d: `M15 7h2a5 5 0 1 1 0 10h-2`, key: `1b9ql8` }],
      [`line`, { x1: `8`, x2: `16`, y1: `12`, y2: `12`, key: `1jonct` }],
    ],
  };
Hf.node;
var Uf = p(Hf),
  Wf = {
    name: `link`,
    size: 24,
    node: [
      [`path`, { d: `M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71`, key: `1cjeqo` }],
      [`path`, { d: `M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71`, key: `19qd67` }],
    ],
  };
Wf.node;
var Gf = p(Wf),
  Kf = {
    name: `list-music`,
    size: 24,
    node: [
      [`path`, { d: `M16 5H3`, key: `m91uny` }],
      [`path`, { d: `M11 12H3`, key: `51ecnj` }],
      [`path`, { d: `M11 19H3`, key: `zflm78` }],
      [`path`, { d: `M21 16V5`, key: `yxg4q8` }],
      [`circle`, { cx: `18`, cy: `16`, r: `3`, key: `1hluhg` }],
    ],
  };
Kf.node;
var qf = p(Kf),
  Jf = {
    name: `loader-circle`,
    size: 24,
    node: [[`path`, { d: `M21 12a9 9 0 1 1-6.219-8.56`, key: `13zald` }]],
    aliases: [`loader-2`],
  };
Jf.node;
var Yf = p(Jf),
  Xf = {
    name: `log-out`,
    size: 24,
    node: [
      [`path`, { d: `m16 17 5-5-5-5`, key: `1bji2h` }],
      [`path`, { d: `M21 12H9`, key: `dn1m92` }],
      [`path`, { d: `M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4`, key: `1uf3rs` }],
    ],
  };
Xf.node;
var Zf = p(Xf),
  Qf = {
    name: `maximize-2`,
    size: 24,
    node: [
      [`path`, { d: `M15 3h6v6`, key: `1q9fwt` }],
      [`path`, { d: `m21 3-7 7`, key: `1l2asr` }],
      [`path`, { d: `m3 21 7-7`, key: `tjx5ai` }],
      [`path`, { d: `M9 21H3v-6`, key: `wtvkvv` }],
    ],
  };
Qf.node;
var $f = p(Qf),
  ep = {
    name: `message-square-quote`,
    size: 24,
    node: [
      [`path`, { d: `M14 14a2 2 0 0 0 2-2V8h-2`, key: `1r06pg` }],
      [
        `path`,
        {
          d: `M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z`,
          key: `18887p`,
        },
      ],
      [`path`, { d: `M8 14a2 2 0 0 0 2-2V8H8`, key: `1jzu5j` }],
    ],
  };
ep.node;
var tp = p(ep),
  np = {
    name: `pause`,
    size: 24,
    node: [
      [`rect`, { x: `14`, y: `3`, width: `5`, height: `18`, rx: `1`, key: `kaeet6` }],
      [`rect`, { x: `5`, y: `3`, width: `5`, height: `18`, rx: `1`, key: `1wsw3u` }],
    ],
  };
np.node;
var rp = p(np),
  ip = {
    name: `pin-off`,
    size: 24,
    node: [
      [`path`, { d: `M12 17v5`, key: `bb1du9` }],
      [`path`, { d: `M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89`, key: `znwnzq` }],
      [`path`, { d: `m2 2 20 20`, key: `1ooewy` }],
      [
        `path`,
        { d: `M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11`, key: `c9qhm2` },
      ],
    ],
  };
ip.node;
var ap = p(ip),
  op = {
    name: `pin`,
    size: 24,
    node: [
      [`path`, { d: `M12 17v5`, key: `bb1du9` }],
      [
        `path`,
        {
          d: `M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z`,
          key: `1nkz8b`,
        },
      ],
    ],
  };
op.node;
var sp = p(op),
  cp = {
    name: `play`,
    size: 24,
    node: [
      [
        `path`,
        {
          d: `M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z`,
          key: `10ikf1`,
        },
      ],
    ],
  };
cp.node;
var lp = p(cp),
  up = {
    name: `plus`,
    size: 24,
    node: [
      [`path`, { d: `M5 12h14`, key: `1ays0h` }],
      [`path`, { d: `M12 5v14`, key: `s699le` }],
    ],
  };
up.node;
var dp = p(up),
  fp = {
    name: `skip-back`,
    size: 24,
    node: [
      [
        `path`,
        {
          d: `M17.971 4.285A2 2 0 0 1 21 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z`,
          key: `15892j`,
        },
      ],
      [`path`, { d: `M3 20V4`, key: `1ptbpl` }],
    ],
  };
fp.node;
var pp = p(fp),
  mp = {
    name: `skip-forward`,
    size: 24,
    node: [
      [`path`, { d: `M21 4v16`, key: `7j8fe9` }],
      [
        `path`,
        {
          d: `M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z`,
          key: `zs4d6`,
        },
      ],
    ],
  };
mp.node;
var hp = p(mp),
  gp = {
    name: `speaker`,
    size: 24,
    node: [
      [`rect`, { width: `16`, height: `20`, x: `4`, y: `2`, rx: `2`, key: `1nb95v` }],
      [`path`, { d: `M12 6h.01`, key: `1vi96p` }],
      [`circle`, { cx: `12`, cy: `14`, r: `4`, key: `1jruaj` }],
      [`path`, { d: `M12 14h.01`, key: `1etili` }],
    ],
  };
gp.node;
var _p = p(gp),
  vp = {
    name: `trash`,
    size: 24,
    node: [
      [`path`, { d: `M10 11v6`, key: `nco0om` }],
      [`path`, { d: `M14 11v6`, key: `outv1u` }],
      [`path`, { d: `M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6`, key: `miytrc` }],
      [`path`, { d: `M3 6h18`, key: `d0wm0j` }],
      [`path`, { d: `M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2`, key: `e791ji` }],
    ],
    aliases: [`trash-2`],
  };
vp.node;
var yp = p(vp),
  bp = {
    name: `ungroup`,
    size: 24,
    node: [
      [`rect`, { x: `11`, y: `14`, width: `10`, height: `7`, rx: `2`, key: `nfm8rk` }],
      [`rect`, { x: `3`, y: `3`, width: `10`, height: `7`, rx: `2`, key: `1ljebb` }],
    ],
  };
bp.node;
var xp = p(bp),
  Sp = {
    name: `volume-1`,
    size: 24,
    node: [
      [
        `path`,
        {
          d: `M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z`,
          key: `uqj9uw`,
        },
      ],
      [`path`, { d: `M16 9a5 5 0 0 1 0 6`, key: `1q6k2b` }],
    ],
  };
Sp.node;
var Cp = p(Sp),
  wp = {
    name: `volume-x`,
    size: 24,
    node: [
      [
        `path`,
        {
          d: `M11 4.702a.7.7 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.7.7 0 0 0 11 19.298z`,
          key: `1p7khw`,
        },
      ],
      [`path`, { d: `m16.5 14.5 5-5`, key: `cul3yw` }],
      [`path`, { d: `m16.5 9.5 5 5`, key: `1akey5` }],
    ],
  };
wp.node;
var Tp = p(wp);
function Ep(e) {
  let t = Math.max(e.lastIndexOf(`\\`), e.lastIndexOf(`/`));
  return t < 0 ? e : e.slice(t + 1);
}
function Dp(e) {
  return e.kind === `video` ? e.preview || null : e.kind === `image` ? e.imagePath : null;
}
function Op({ children: e, active: t, className: n = ``, ...r }) {
  return (0, jsxRuntime.jsx)(`button`, {
    ...r,
    className: `press grid size-8 place-items-center rounded-full text-ink-2 hover:bg-tile-hover hover:text-ink ${t ? `bg-tile-hover text-ink` : ``} ${n}`,
    children: e,
  });
}
function kp({ size: e, radius: t, className: n = `` }) {
  let r = useIslandStore((e) => e.cover),
    i = useIslandStore((e) => e.accent);
  return r
    ? (0, jsxRuntime.jsx)(`img`, {
        src: r,
        alt: ``,
        draggable: !1,
        className: `shrink-0 object-cover ${n}`,
        style: { width: e, height: e, borderRadius: t },
      })
    : (0, jsxRuntime.jsx)(`div`, {
        className: `grid shrink-0 place-items-center bg-white/10 ${n}`,
        style: { width: e, height: e, borderRadius: t, color: i ?? `var(--color-ink-2)` },
        children: (0, jsxRuntime.jsx)(S, { size: e * 0.5 }),
      });
}
var Ap = [0.55, 1, 0.72, 0.88];
function jp({ height: e = 16 }) {
  let t = useIslandStore((e) => e.level),
    n = useIslandStore((e) => e.accent),
    r = useIslandStore((e) => e.media?.playing ?? !1),
    i = performance.now() / 1e3,
    a = Math.min(1, t ** 0.6 * 1.6);
  return (0, jsxRuntime.jsx)(`div`, {
    className: `flex items-center gap-[3px]`,
    style: { height: e },
    children: Ap.map((e, t) => {
      let o = 0.55 + 0.45 * Math.abs(Math.sin(i * (5.3 + t * 1.7) + t * 1.3)),
        s = r ? Math.max(0.14, a * e * o) : 0.14;
      return (0, jsxRuntime.jsx)(
        `span`,
        {
          className: `w-[3px] rounded-full transition-[height] duration-100 ease-out`,
          style: { height: `${s * 100}%`, background: n ?? `var(--color-ink)` },
        },
        t,
      );
    }),
  });
}
function Mp(e, t = 500) {
  let [, n] = (0, ReactRuntime.useState)(0);
  (0, ReactRuntime.useEffect)(() => {
    if (!e) return;
    let r = setInterval(() => n((e) => e + 1), t);
    return () => clearInterval(r);
  }, [e, t]);
}
function Np({ icon: e, title: t, hint: n }) {
  return (0, jsxRuntime.jsx)(`div`, {
    className: `grid h-full place-items-center rounded-2xl border border-dashed border-white/12 text-center`,
    children: (0, jsxRuntime.jsxs)(`div`, {
      className: `flex max-w-[320px] flex-col items-center gap-1.5 px-6`,
      children: [
        (0, jsxRuntime.jsx)(`div`, { className: `text-ink-3`, children: e }),
        (0, jsxRuntime.jsx)(`div`, { className: `text-[13px] font-semibold text-ink`, children: t }),
        (0, jsxRuntime.jsx)(`div`, { className: `text-[12px] leading-snug text-ink-3`, children: n }),
      ],
    }),
  });
}
var Pp = `island:clips-changed`;
function Fp(e, t = !1) {
  let n = Dp(e);
  if (!n) return;
  let r = useIslandStore.getState();
  (r.close(), i.openPath(n, t).catch((e) => r.pushPeek({ kind: `error`, message: String(e) })));
}
function Ip(e) {
  let t = useIslandStore.getState();
  (t.pushPeek({ kind: `done`, label: r(`Загружаю картинку…`, `Uploading the picture…`) }),
    i.uploadImage(e).then(
      (e) => {
        let [n, i] = e.split(`
`);
        t.pushPeek({
          kind: `done`,
          label: r(`Ссылка в буфере · ${n} · ${te(i ?? ``)}`, `Link copied · ${n} · ${te(i ?? ``)}`),
        });
      },
      (e) => t.pushPeek({ kind: `error`, message: String(e) }),
    ));
}
function Lp(e, t) {
  let n = useIslandStore.getState();
  (n.close(),
    i.clipPaste(e.id, t).then(
      () => {
        t || n.pushPeek({ kind: `done`, label: r(`Скопировано в буфер`, `Copied`) });
      },
      (e) => n.pushPeek({ kind: `error`, message: String(e) }),
    ));
}
function Rp({ clip: e, className: t }) {
  return e.kind === `text` || !e.thumb
    ? (0, jsxRuntime.jsx)(`span`, {
        className: `grid shrink-0 place-items-center bg-white/6 text-ink-3 ${t}`,
        children:
          e.kind === `video` ? (0, jsxRuntime.jsx)(zf, { size: 15 }) : (0, jsxRuntime.jsx)(g, { size: 15 }),
      })
    : (0, jsxRuntime.jsxs)(`span`, {
        className: `relative shrink-0 overflow-hidden ring-1 ring-white/10 ${t}`,
        children: [
          (0, jsxRuntime.jsx)(`img`, {
            src: e.thumb,
            alt: ``,
            draggable: !1,
            className: `size-full object-cover`,
          }),
          e.kind === `video` &&
            (0, jsxRuntime.jsx)(`span`, {
              className: `absolute inset-0 grid place-items-center`,
              children: (0, jsxRuntime.jsx)(`span`, {
                className: `on-dark grid size-4 place-items-center rounded-full bg-black/60`,
                children: (0, jsxRuntime.jsx)(lp, { size: 8, fill: `white`, className: `ml-px text-white` }),
              }),
            }),
        ],
      });
}
function zp(e) {
  return e.kind === `image`
    ? r(`Изображение ${e.width}×${e.height}`, `Image ${e.width}×${e.height}`)
    : e.kind === `video`
      ? Ep(e.preview)
      : e.preview;
}
function Bp({ clip: e, selected: t, onActivate: n, onChanged: a }) {
  let o = useIslandStore((e) => e.sendToText),
    s = useIslandStore((e) => y(e.settings?.uploadService)),
    c = (0, ReactRuntime.useRef)(null);
  (0, ReactRuntime.useEffect)(() => {
    t && c.current?.scrollIntoView({ block: `nearest` });
  }, [t]);
  let l = [
    e.kind === `video` ? r(`запись экрана`, `screen recording`) : e.source?.replace(/\.exe$/i, ``),
    xe(e.createdAt),
  ];
  e.kind === `text` && e.length > 80 && l.push(r(`${e.length} симв.`, `${e.length} chars`));
  let u = Dp(e);
  return (0, jsxRuntime.jsxs)(`div`, {
    ref: c,
    onClick: (t) => n(e, t),
    className: `group relative flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 ${t ? `bg-tile-hover` : `hover:bg-tile`}`,
    children: [
      (0, jsxRuntime.jsx)(Rp, {
        clip: e,
        className: e.kind !== `text` && e.thumb ? `h-10 w-14 rounded-md` : `size-8 rounded-lg`,
      }),
      (0, jsxRuntime.jsxs)(`div`, {
        className: `min-w-0 flex-1`,
        children: [
          (0, jsxRuntime.jsx)(`div`, {
            className: `line-clamp-2 text-[12.5px] leading-snug break-words text-ink`,
            children: zp(e),
          }),
          (0, jsxRuntime.jsxs)(`div`, {
            className: `mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-ink-3`,
            children: [
              e.pinned &&
                (0, jsxRuntime.jsx)(sp, {
                  size: 10,
                  className: `shrink-0 text-accent`,
                  fill: `currentColor`,
                }),
              l.filter(Boolean).join(` · `),
            ],
          }),
        ],
      }),
      (0, jsxRuntime.jsxs)(`div`, {
        className: `hidden shrink-0 items-center gap-0.5 group-hover:flex`,
        onClick: (e) => e.stopPropagation(),
        children: [
          e.kind === `text` &&
            (0, jsxRuntime.jsx)(`button`, {
              title: r(`В текст-тулзы`, `Open in text tools`),
              className: `press grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-white/10 hover:text-ink`,
              onClick: () => void i.clipPaste(e.id, !1).then(() => o(``)),
              children: (0, jsxRuntime.jsx)(g, { size: 14 }),
            }),
          u &&
            (0, jsxRuntime.jsx)(`button`, {
              "data-clip-open": !0,
              title:
                e.kind === `video`
                  ? r(`Открыть запись`, `Open the recording`)
                  : r(`Открыть картинку`, `Open the picture`),
              className: `press grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-white/10 hover:text-ink`,
              onClick: () => Fp(e),
              children: (0, jsxRuntime.jsx)($f, { size: 14 }),
            }),
          e.kind === `image` &&
            u &&
            s &&
            (0, jsxRuntime.jsx)(`button`, {
              "data-clip-upload": !0,
              title: r(
                `Загрузить на ${s.name} и скопировать ссылку`,
                `Upload to ${s.name} and copy the link`,
              ),
              className: `press grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-white/10 hover:text-ink`,
              onClick: () => Ip(u),
              children: (0, jsxRuntime.jsx)(Gf, { size: 14 }),
            }),
          e.kind === `video` &&
            u &&
            (0, jsxRuntime.jsx)(`button`, {
              "data-clip-folder": !0,
              title: r(`Показать в папке`, `Show in folder`),
              className: `press grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-white/10 hover:text-ink`,
              onClick: () => Fp(e, !0),
              children: (0, jsxRuntime.jsx)(Vf, { size: 14 }),
            }),
          (0, jsxRuntime.jsx)(`button`, {
            title: e.pinned ? r(`Открепить`, `Unpin`) : r(`Закрепить`, `Pin`),
            className: `press grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-white/10 hover:text-ink`,
            onClick: () => void i.clipPin(e.id, !e.pinned).then(a),
            children: e.pinned
              ? (0, jsxRuntime.jsx)(ap, { size: 14 })
              : (0, jsxRuntime.jsx)(sp, { size: 14 }),
          }),
          (0, jsxRuntime.jsx)(`button`, {
            title:
              e.kind === `video`
                ? r(
                    `Убрать из истории (сам файл останется)`,
                    `Remove from the history (the file itself stays)`,
                  )
                : r(`Удалить`, `Delete`),
            className: `press grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-white/10 hover:text-danger`,
            onClick: () => void i.clipDelete(e.id).then(a),
            children: (0, jsxRuntime.jsx)(Ee, { size: 14 }),
          }),
        ],
      }),
    ],
  });
}
function Vp() {
  let e = useIslandStore((e) => e.settings),
    t = useIslandStore((e) => e.openedBy),
    [n, a] = (0, ReactRuntime.useState)(``),
    [o, s] = (0, ReactRuntime.useState)(null),
    [c, l] = (0, ReactRuntime.useState)(0),
    u = (0, ReactRuntime.useRef)(null),
    d = (0, ReactRuntime.useCallback)(() => {
      i.clipList(n).then((e) => {
        (s(e), l((t) => Math.min(t, Math.max(0, e.length - 1))));
      });
    }, [n]);
  ((0, ReactRuntime.useEffect)(d, [d]),
    (0, ReactRuntime.useEffect)(
      () => (window.addEventListener(Pp, d), () => window.removeEventListener(Pp, d)),
      [d],
    ),
    (0, ReactRuntime.useEffect)(() => {
      t === `hotkey` && u.current?.focus();
    }, [t]));
  let f = (t, n) => Lp(t, (e?.pasteOnClick ?? !0) && !n.shiftKey);
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `flex h-full flex-col gap-2`,
    children: [
      (0, jsxRuntime.jsxs)(`div`, {
        className: `flex items-center gap-2`,
        children: [
          (0, jsxRuntime.jsxs)(`label`, {
            className: `flex h-9 flex-1 items-center gap-2 rounded-xl bg-tile px-3 focus-within:bg-tile-hover`,
            children: [
              (0, jsxRuntime.jsx)(ie, { size: 15, className: `text-ink-3` }),
              (0, jsxRuntime.jsx)(`input`, {
                ref: u,
                value: n,
                onChange: (e) => {
                  (a(e.target.value), l(0));
                },
                onMouseDown: () => void i.takeFocus(),
                onKeyDown: (e) => {
                  o?.length &&
                    (e.key === `ArrowDown`
                      ? (e.preventDefault(), l((e) => Math.min(o.length - 1, e + 1)))
                      : e.key === `ArrowUp`
                        ? (e.preventDefault(), l((e) => Math.max(0, e - 1)))
                        : e.key === `Enter` && (e.preventDefault(), f(o[c], e)));
                },
                placeholder: r(`Поиск по истории`, `Search history`),
                spellCheck: !1,
                className: `min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3`,
              }),
            ],
          }),
          (0, jsxRuntime.jsx)(`button`, {
            title: r(`Очистить историю (закреплённое останется)`, `Clear history (pinned items stay)`),
            className: `press grid size-9 place-items-center rounded-xl bg-tile text-ink-3 hover:bg-tile-hover hover:text-danger`,
            onClick: () => void i.clipClear().then(d),
            children: (0, jsxRuntime.jsx)(yp, { size: 15 }),
          }),
        ],
      }),
      o && o.length === 0
        ? (0, jsxRuntime.jsx)(Np, {
            icon: (0, jsxRuntime.jsx)(pe, { size: 22 }),
            title: n ? r(`Ничего не найдено`, `Nothing found`) : r(`История пуста`, `History is empty`),
            hint: n
              ? r(`Попробуй другой запрос`, `Try another search`)
              : r(
                  `Скопируй текст или картинку — они появятся здесь`,
                  `Copy text or an image and it shows up here`,
                ),
          })
        : (0, jsxRuntime.jsx)(`div`, {
            className: `scroll-thin -mr-2 min-h-0 flex-1 overflow-y-auto pr-1.5`,
            children: o?.map((e, t) =>
              (0, jsxRuntime.jsx)(
                `div`,
                {
                  className: `rise-in`,
                  style: { animationDelay: `${Math.min(t, 8) * 18}ms` },
                  children: (0, jsxRuntime.jsx)(Bp, {
                    clip: e,
                    selected: t === c,
                    onActivate: f,
                    onChanged: d,
                  }),
                },
                e.id,
              ),
            ),
          }),
      (0, jsxRuntime.jsxs)(`div`, {
        className: `flex justify-between px-1 text-[10.5px] text-ink-3`,
        children: [
          (0, jsxRuntime.jsx)(`span`, {
            children:
              e?.pasteOnClick === !1
                ? r(`Клик — копировать`, `Click to copy`)
                : r(
                    `Клик — вставить · Shift+клик — только копировать`,
                    `Click to paste · Shift+click to copy only`,
                  ),
          }),
          (0, jsxRuntime.jsx)(`span`, { children: `↑↓ Enter` }),
        ],
      }),
    ],
  });
}
var Hp = `M14 35h20.5a8.2 8.2 0 0 0 1.3-16.3A11.2 11.2 0 0 0 14.6 21.6 6.8 6.8 0 0 0 14 35z`;
function Up({ still: e }) {
  return (0, jsxRuntime.jsxs)(`g`, {
    children: [
      (0, jsxRuntime.jsx)(`g`, {
        className: e ? void 0 : `wx-spin`,
        stroke: `#FFC857`,
        strokeWidth: `2.6`,
        strokeLinecap: `round`,
        children: [0, 45, 90, 135, 180, 225, 270, 315].map((e) =>
          (0, jsxRuntime.jsx)(
            `line`,
            { x1: `24`, y1: `6.5`, x2: `24`, y2: `10.5`, transform: `rotate(${e} 24 24)` },
            e,
          ),
        ),
      }),
      (0, jsxRuntime.jsx)(`circle`, { cx: `24`, cy: `24`, r: `9`, fill: `#FFC857` }),
    ],
  });
}
function Wp({ still: e }) {
  return (0, jsxRuntime.jsxs)(`g`, {
    children: [
      (0, jsxRuntime.jsx)(`path`, {
        d: `M31.5 30.6A12.5 12.5 0 0 1 18.4 13a12.6 12.6 0 1 0 13.1 17.6z`,
        fill: `var(--wx-moon, #D6DEFF)`,
      }),
      (0, jsxRuntime.jsx)(`circle`, {
        cx: `33`,
        cy: `13`,
        r: `1.3`,
        fill: `var(--wx-moon, #D6DEFF)`,
        className: e ? void 0 : `wx-twinkle`,
      }),
      (0, jsxRuntime.jsx)(`circle`, {
        cx: `38`,
        cy: `21`,
        r: `0.9`,
        fill: `var(--wx-moon, #D6DEFF)`,
        className: e ? void 0 : `wx-twinkle`,
        style: { animationDelay: `0.9s` },
      }),
    ],
  });
}
function Gp({ dark: e = !1, still: t, y: n = 0 }) {
  return (0, jsxRuntime.jsx)(`g`, {
    transform: `translate(0 ${n})`,
    children: (0, jsxRuntime.jsx)(`path`, {
      d: Hp,
      fill: e ? `var(--wx-cloud-dark, #8E9AB3)` : `var(--wx-cloud, #E3E9F5)`,
      className: t ? void 0 : `wx-drift`,
    }),
  });
}
function Kp({ xs: e, still: t }) {
  return (0, jsxRuntime.jsx)(`g`, {
    stroke: `#6CB4F5`,
    strokeWidth: `2.4`,
    strokeLinecap: `round`,
    children: e.map((e, n) =>
      (0, jsxRuntime.jsx)(
        `line`,
        {
          x1: e,
          y1: `34`,
          x2: e - 2,
          y2: `39.5`,
          className: t ? void 0 : `wx-drop`,
          style: { animationDelay: `${n * 0.28}s` },
        },
        e,
      ),
    ),
  });
}
function qp({ xs: e, still: t }) {
  return (0, jsxRuntime.jsx)(`g`, {
    fill: `var(--wx-flake, #F4F7FF)`,
    children: e.map((e, n) =>
      (0, jsxRuntime.jsx)(
        `circle`,
        {
          cx: e,
          cy: `37`,
          r: `1.9`,
          className: t ? void 0 : `wx-flake`,
          style: { animationDelay: `${n * 0.45}s` },
        },
        e,
      ),
    ),
  });
}
function Jp({ sky: e, night: t = !1, size: n, still: r = !1, className: i = `` }) {
  let a = t ? (0, jsxRuntime.jsx)(Wp, { still: r }) : (0, jsxRuntime.jsx)(Up, { still: r }),
    o;
  switch (e) {
    case `clear`:
      o = a;
      break;
    case `partly`:
      o = (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
        children: [
          (0, jsxRuntime.jsx)(`g`, { transform: `translate(9 -7) scale(0.72)`, children: a }),
          (0, jsxRuntime.jsx)(Gp, { still: r, y: 3 }),
        ],
      });
      break;
    case `cloudy`:
      o = (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
        children: [
          (0, jsxRuntime.jsx)(`g`, {
            transform: `translate(13 -9) scale(0.62)`,
            opacity: `0.75`,
            children: (0, jsxRuntime.jsx)(`path`, { d: Hp, fill: `var(--wx-cloud-far, #AEB9CE)` }),
          }),
          (0, jsxRuntime.jsx)(Gp, { still: r, y: 2 }),
        ],
      });
      break;
    case `fog`:
      o = (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
        children: [
          (0, jsxRuntime.jsx)(Gp, { still: r, y: -8 }),
          (0, jsxRuntime.jsxs)(`g`, {
            stroke: `var(--wx-fog, #C5CDDB)`,
            strokeWidth: `2.6`,
            strokeLinecap: `round`,
            className: r ? void 0 : `wx-fog`,
            children: [
              (0, jsxRuntime.jsx)(`line`, { x1: `11`, y1: `32`, x2: `37`, y2: `32` }),
              (0, jsxRuntime.jsx)(`line`, { x1: `15`, y1: `37.5`, x2: `33`, y2: `37.5` }),
              (0, jsxRuntime.jsx)(`line`, { x1: `12`, y1: `43`, x2: `30`, y2: `43` }),
            ],
          }),
        ],
      });
      break;
    case `drizzle`:
      o = (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
        children: [
          (0, jsxRuntime.jsx)(Gp, { still: r, y: -6 }),
          (0, jsxRuntime.jsx)(Kp, { xs: [20, 30], still: r }),
        ],
      });
      break;
    case `rain`:
      o = (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
        children: [
          (0, jsxRuntime.jsx)(Gp, { dark: !0, still: r, y: -6 }),
          (0, jsxRuntime.jsx)(Kp, { xs: [17, 25, 33], still: r }),
        ],
      });
      break;
    case `sleet`:
      o = (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
        children: [
          (0, jsxRuntime.jsx)(Gp, { dark: !0, still: r, y: -6 }),
          (0, jsxRuntime.jsx)(Kp, { xs: [18], still: r }),
          (0, jsxRuntime.jsx)(qp, { xs: [26, 33], still: r }),
        ],
      });
      break;
    case `snow`:
      o = (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
        children: [
          (0, jsxRuntime.jsx)(Gp, { still: r, y: -6 }),
          (0, jsxRuntime.jsx)(qp, { xs: [17, 25, 33], still: r }),
        ],
      });
      break;
    case `storm`:
      o = (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
        children: [
          (0, jsxRuntime.jsx)(Gp, { dark: !0, still: r, y: -7 }),
          (0, jsxRuntime.jsx)(`path`, {
            d: `M25.5 27l-6 8.5h4.6l-2 7.5 7.4-10h-4.6l2-6z`,
            fill: `#FFD166`,
            className: r ? void 0 : `wx-flash`,
          }),
          (0, jsxRuntime.jsx)(Kp, { xs: [14, 36], still: r }),
        ],
      });
  }
  return (0, jsxRuntime.jsx)(`svg`, {
    width: n,
    height: n,
    viewBox: `0 0 48 48`,
    className: `shrink-0 ${i}`,
    "aria-hidden": !0,
    children: o,
  });
}
var Yp = {
    clear: [
      `linear-gradient(165deg, #2b7bd6 0%, #5aa9ee 58%, #f0b56a 118%)`,
      `linear-gradient(165deg, #070b24 0%, #18224f 62%, #3a3f7a 120%)`,
    ],
    partly: [
      `linear-gradient(165deg, #3a7fc8 0%, #7fb2e6 62%, #c2cfe0 115%)`,
      `linear-gradient(165deg, #0b1030 0%, #232c55 62%, #4a5078 120%)`,
    ],
    cloudy: [
      `linear-gradient(165deg, #445167 0%, #6c7c94 100%)`,
      `linear-gradient(165deg, #141a29 0%, #2b3447 100%)`,
    ],
    fog: [
      `linear-gradient(165deg, #56606d 0%, #8a94a2 100%)`,
      `linear-gradient(165deg, #1b2028 0%, #3a424e 100%)`,
    ],
    drizzle: [
      `linear-gradient(165deg, #33475f 0%, #557091 100%)`,
      `linear-gradient(165deg, #121b2b 0%, #283a52 100%)`,
    ],
    rain: [
      `linear-gradient(165deg, #263850 0%, #45607f 100%)`,
      `linear-gradient(165deg, #0f1726 0%, #24364e 100%)`,
    ],
    sleet: [
      `linear-gradient(165deg, #33435c 0%, #647a99 100%)`,
      `linear-gradient(165deg, #131b2c 0%, #2e3f5a 100%)`,
    ],
    snow: [
      `linear-gradient(165deg, #51627f 0%, #93a6c3 100%)`,
      `linear-gradient(165deg, #1a2338 0%, #3c4c6c 100%)`,
    ],
    storm: [
      `linear-gradient(165deg, #171b2b 0%, #353052 100%)`,
      `linear-gradient(165deg, #0d0f1b 0%, #2a2644 100%)`,
    ],
  },
  Q = (e, t) => {
    let n = Math.sin(e * 12.9898 + t * 78.233) * 43758.5453;
    return n - Math.floor(n);
  };
function Xp({ sky: e, night: t }) {
  let n = t && (e === `clear` || e === `partly`),
    r = e === `rain` || e === `drizzle` || e === `storm` || e === `sleet`,
    i = e === `snow` || e === `sleet`;
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `on-dark pointer-events-none absolute inset-0 overflow-hidden`,
    style: { background: Yp[e][+!!t] },
    "aria-hidden": !0,
    children: [
      n &&
        Array.from({ length: 16 }, (e, t) =>
          (0, jsxRuntime.jsx)(
            `span`,
            {
              className: `wx-twinkle absolute rounded-full bg-white`,
              style: {
                left: `${6 + Q(t, 1) * 88}%`,
                top: `${4 + Q(t, 2) * 52}%`,
                width: 1.5 + Q(t, 3) * 1.5,
                height: 1.5 + Q(t, 3) * 1.5,
                animationDelay: `${Q(t, 4) * 3}s`,
              },
            },
            t,
          ),
        ),
      r &&
        Array.from({ length: e === `drizzle` ? 10 : 18 }, (e, t) =>
          (0, jsxRuntime.jsx)(
            `span`,
            {
              className: `wx-rain absolute w-px rounded-full bg-white/45`,
              style: {
                left: `${Q(t, 5) * 115}%`,
                top: -24,
                height: 14 + Q(t, 6) * 12,
                animationDelay: `${-Q(t, 7) * 1.1}s`,
                animationDuration: `${0.75 + Q(t, 8) * 0.5}s`,
              },
            },
            t,
          ),
        ),
      i &&
        Array.from({ length: 16 }, (e, t) =>
          (0, jsxRuntime.jsx)(
            `span`,
            {
              className: `wx-snow absolute rounded-full bg-white/80`,
              style: {
                left: `${Q(t, 9) * 100}%`,
                top: -10,
                width: 2.5 + Q(t, 10) * 2.5,
                height: 2.5 + Q(t, 10) * 2.5,
                animationDelay: `${-Q(t, 11) * 6}s`,
                animationDuration: `${5 + Q(t, 12) * 4}s`,
              },
            },
            t,
          ),
        ),
      e === `storm` && (0, jsxRuntime.jsx)(`span`, { className: `wx-lightning absolute inset-0 bg-white` }),
      (0, jsxRuntime.jsx)(`span`, {
        className: `absolute inset-0`,
        style: { background: `linear-gradient(180deg, rgb(0 0 0 / 0.10) 0%, rgb(0 0 0 / 0.32) 100%)` },
      }),
    ],
  });
}
function Zp() {
  let e = useIslandStore((e) => e.recording),
    t = useIslandStore((e) => e.settings?.hotkeyRecord);
  Mp(!0, 500);
  let n = e ? Date.now() - e.startedAt : 0;
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `flex h-full items-center gap-2.5 pr-1 pl-3.5`,
    children: [
      (0, jsxRuntime.jsx)(`span`, {
        className: `size-2.5 animate-pulse rounded-full bg-[#ff453a] shadow-[0_0_8px_rgb(255_69_58/0.9)]`,
      }),
      (0, jsxRuntime.jsx)(`span`, {
        className: `tabular flex-1 text-[12.5px] font-semibold text-ink`,
        children: T(n),
      }),
      (0, jsxRuntime.jsx)(`span`, {
        className: `text-[10.5px] font-semibold text-ink-3 uppercase`,
        children: e?.format,
      }),
      (0, jsxRuntime.jsx)(`button`, {
        "data-record-shot": !0,
        title: r(
          `Скриншот области (запись идёт дальше). Нажми на пилюлю — пипетка, QR-код и остальное`,
          `Screenshot of an area (the recording goes on). Press the pill for the colour picker, the QR code and the rest`,
        ),
        onClick: (e) => {
          (e.stopPropagation(), i.captureStart(`area`));
        },
        className: `press grid size-6 place-items-center rounded-full text-ink-2 hover:bg-white/10 hover:text-ink`,
        children: (0, jsxRuntime.jsx)(w, { size: 13 }),
      }),
      (0, jsxRuntime.jsxs)(`button`, {
        "data-stop-recording": !0,
        title: t
          ? r(`Остановить запись · ${t}`, `Stop recording · ${t}`)
          : r(`Остановить запись`, `Stop recording`),
        onClick: (e) => {
          (e.stopPropagation(), i.recordStop());
        },
        className: `press flex h-6 items-center gap-1.5 rounded-full bg-[#ff453a]/20 pr-2.5 pl-2 text-[11.5px] font-semibold text-stop-ink hover:bg-[#ff453a]/30`,
        children: [
          (0, jsxRuntime.jsx)(`span`, { className: `size-2 rounded-[2px] bg-[#ff453a]` }),
          r(`Стоп`, `Stop`),
        ],
      }),
    ],
  });
}
function Qp(e) {
  let [t, n] = (0, ReactRuntime.useState)(() => new Date());
  return (
    (0, ReactRuntime.useEffect)(() => {
      let t,
        r = e ? 1e3 : 6e4,
        i = () => r - (Date.now() % r) + 40,
        a = () => {
          (n(new Date()), (t = setTimeout(a, i())));
        };
      return (n(new Date()), (t = setTimeout(a, i())), () => clearTimeout(t));
    }, [e]),
    t
  );
}
function $p() {
  let e = useIslandStore((e) => e.settings?.clockSeconds === !0),
    t = Qp(e),
    n = c();
  return (0, jsxRuntime.jsx)(`span`, {
    "data-pill-clock": !0,
    className: `tabular shrink-0 text-[12.5px] font-semibold text-ink`,
    children: a(t, n, e),
  });
}
function em({ battery: e }) {
  let t = e.percent <= 20 && !e.plugged,
    n = e.plugged ? `#34d399` : t ? `#ff453a` : e.saver ? `#fbbf24` : `var(--color-ink)`,
    i = e.plugged
      ? r(`от сети`, `on mains`)
      : e.saver
        ? r(`экономия заряда`, `battery saver`)
        : r(`от батареи`, `on battery`);
  return (0, jsxRuntime.jsxs)(`span`, {
    "data-pill-battery": !0,
    className: `flex shrink-0 items-center gap-1`,
    title: r(`Заряд ${e.percent}% · ${i}`, `Charge ${e.percent}% · ${i}`),
    children: [
      (0, jsxRuntime.jsxs)(`svg`, {
        width: `22`,
        height: `11`,
        viewBox: `0 0 22 11`,
        "aria-hidden": !0,
        children: [
          (0, jsxRuntime.jsx)(`rect`, {
            x: `0.5`,
            y: `0.5`,
            width: `18`,
            height: `10`,
            rx: `3`,
            fill: `none`,
            stroke: `color-mix(in srgb, var(--color-ink) 45%, transparent)`,
          }),
          (0, jsxRuntime.jsx)(`rect`, {
            x: `19.6`,
            y: `3.5`,
            width: `1.9`,
            height: `4`,
            rx: `0.95`,
            fill: `color-mix(in srgb, var(--color-ink) 45%, transparent)`,
          }),
          (0, jsxRuntime.jsx)(`rect`, {
            x: `2`,
            y: `2`,
            width: Math.max(1.5, (15 * e.percent) / 100),
            height: `7`,
            rx: `1.6`,
            fill: n,
          }),
          e.plugged &&
            (0, jsxRuntime.jsx)(`path`, {
              d: `M10.6 1.4 6.9 6.1h2.3l-.8 3.5 3.7-4.7H9.8z`,
              fill: `var(--color-ink)`,
              stroke: `var(--color-island)`,
              strokeWidth: `0.7`,
              strokeLinejoin: `round`,
            }),
        ],
      }),
      (0, jsxRuntime.jsxs)(`span`, {
        className: `tabular text-[11.5px] font-semibold ${t ? `text-stop-ink` : `text-ink`}`,
        children: [e.percent, `%`],
      }),
    ],
  });
}
function tm() {
  let e = useIslandStore((e) => e.dictation),
    t = useIslandStore((e) => e.voice);
  if ((Mp(e?.state === `recording`, 250), !e)) return null;
  if (e.state === `transcribing`)
    return (0, jsxRuntime.jsxs)(`div`, {
      className: `flex h-full items-center justify-center gap-2 px-3.5 text-[12px] font-medium text-ink-2`,
      children: [
        (0, jsxRuntime.jsx)(Yf, { size: 14, className: `animate-spin text-accent` }),
        r(`Распознаю…`, `Recognising…`),
      ],
    });
  let n = [0.45, 0.75, 1, 0.75, 0.45],
    a = Math.min(1, t ** 0.55 * 1.5);
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `flex h-full items-center gap-2 pr-1.5 pl-3`,
    children: [
      (0, jsxRuntime.jsx)(oe, { size: 14, className: `shrink-0 text-[#ff453a]` }),
      (0, jsxRuntime.jsx)(`span`, {
        className: `flex h-4 items-center gap-[3px]`,
        children: n.map((e, t) =>
          (0, jsxRuntime.jsx)(
            `span`,
            {
              className: `w-[3px] rounded-full bg-[#ff453a] transition-[height] duration-75`,
              style: { height: `${Math.round(3 + 13 * a * e)}px` },
            },
            t,
          ),
        ),
      }),
      (0, jsxRuntime.jsx)(`span`, {
        className: `tabular flex-1 text-[12.5px] font-semibold text-ink`,
        children: T(Date.now() - e.startedAt),
      }),
      (0, jsxRuntime.jsx)(`button`, {
        title: r(`Отменить`, `Cancel`),
        onClick: (e) => {
          (e.stopPropagation(), i.dictateCancel());
        },
        className: `press grid size-6 place-items-center rounded-full text-ink-3 hover:bg-white/12 hover:text-ink`,
        children: (0, jsxRuntime.jsx)(Ee, { size: 13 }),
      }),
      (0, jsxRuntime.jsx)(`button`, {
        title: r(`Готово: распознать`, `Done: recognise`),
        onClick: (t) => {
          (t.stopPropagation(), i.dictateToggle(e.target));
        },
        className: `press grid size-6 place-items-center rounded-full bg-white/12 hover:bg-white/20`,
        children: (0, jsxRuntime.jsx)(`span`, { className: `size-2 rounded-[2px] bg-[#ff453a]` }),
      }),
    ],
  });
}
function nm() {
  let e = useIslandStore((e) => (e.settings?.obsStatus === !0 ? e.obs : null));
  if (!e || (!e.recording && !e.streaming)) return null;
  let t = e.paused && !e.streaming;
  return (0, jsxRuntime.jsxs)(`span`, {
    "data-obs-badge": !0,
    title: e.streaming
      ? r(`OBS ведёт трансляцию`, `OBS is streaming`)
      : t
        ? r(`Запись OBS на паузе`, `OBS recording paused`)
        : r(`OBS записывает`, `OBS is recording`),
    className: `flex items-center gap-1`,
    children: [
      (0, jsxRuntime.jsx)(`span`, {
        className: `size-[6px] rounded-full ${t ? `bg-white/40` : `animate-pulse bg-[#ff453a] shadow-[0_0_6px_rgb(255_69_58/0.8)]`}`,
      }),
      (0, jsxRuntime.jsx)(`span`, {
        className: `text-[10px] font-bold tracking-wide text-rec-ink`,
        children: e.streaming ? `LIVE` : `REC`,
      }),
    ],
  });
}
var rm = { claude: `Claude Code`, codex: `Codex`, opencode: `opencode` };
function im() {
  return useIslandStore((e) => e.settings?.agentsStatus !== !1 && e.license.pro && e.agents.length > 0);
}
function am() {
  let e = useIslandStore((e) => e.agents),
    t = [`waiting`, `working`, `done`].find((t) => e.some((e) => e.state === t));
  if (!t) return null;
  let n = e.map((e) => {
    let t =
      e.state === `waiting`
        ? r(`ждёт ответа`, `waits for an answer`)
        : e.state === `working`
          ? r(`работает`, `is working`)
          : r(`закончил`, `is done`);
    return `${rm[e.agent] ?? e.agent} ${t}${e.project ? ` · ${e.project}` : ``}`;
  }).join(`
`);
  return (0, jsxRuntime.jsxs)(`span`, {
    "data-agent-badge": t,
    title: n,
    className: `relative grid size-4 shrink-0 place-items-center`,
    children: [
      t === `working` &&
        (0, jsxRuntime.jsxs)(`svg`, {
          className: `absolute inset-0 animate-spin [animation-duration:1.1s]`,
          viewBox: `0 0 16 16`,
          "aria-hidden": !0,
          children: [
            (0, jsxRuntime.jsx)(`circle`, {
              cx: `8`,
              cy: `8`,
              r: `6`,
              fill: `none`,
              stroke: `color-mix(in srgb, var(--color-ink) 18%, transparent)`,
              strokeWidth: `2`,
            }),
            (0, jsxRuntime.jsx)(`path`, {
              d: `M8 2 A6 6 0 0 1 14 8`,
              fill: `none`,
              stroke: `#c4a7ff`,
              strokeWidth: `2`,
              strokeLinecap: `round`,
            }),
          ],
        }),
      t === `waiting` &&
        (0, jsxRuntime.jsx)(`span`, {
          className: `size-[8px] animate-pulse rounded-full bg-[#ffb340] shadow-[0_0_7px_rgb(255_179_64/0.9)]`,
        }),
      t === `done` &&
        (0, jsxRuntime.jsx)(`span`, {
          className: `grid size-4 animate-[agent-done_0.35s_cubic-bezier(0.3,1.5,0.5,1)] place-items-center rounded-full bg-emerald-400 text-neutral-950`,
          children: (0, jsxRuntime.jsx)(we, { size: 11, strokeWidth: 3 }),
        }),
    ],
  });
}
function om() {
  let e = useIslandStore((e) => e.downloads);
  if (e.length === 0) return null;
  let t = e[0],
    n = t.total ? Math.min(1, t.size / t.total) : null,
    r = 2 * Math.PI * 6,
    i = e.map((e) => `${e.name}${e.total ? ` · ${Math.round((100 * e.size) / e.total)}%` : ``}`).join(`
`);
  return (0, jsxRuntime.jsxs)(`span`, {
    "data-download-badge": !0,
    title: i,
    className: `pop-in relative grid size-4 shrink-0 place-items-center`,
    children: [
      (0, jsxRuntime.jsxs)(`svg`, {
        className: `absolute inset-0 ${n === null ? `animate-spin [animation-duration:1.4s]` : ``}`,
        viewBox: `0 0 16 16`,
        "aria-hidden": !0,
        children: [
          (0, jsxRuntime.jsx)(`circle`, {
            cx: `8`,
            cy: `8`,
            r: `6`,
            fill: `none`,
            stroke: `color-mix(in srgb, var(--color-ink) 18%, transparent)`,
            strokeWidth: `2`,
          }),
          n === null
            ? (0, jsxRuntime.jsx)(`path`, {
                d: `M8 2 A6 6 0 0 1 14 8`,
                fill: `none`,
                stroke: `var(--color-accent-ink, #8ea2ff)`,
                strokeWidth: `2`,
                strokeLinecap: `round`,
              })
            : (0, jsxRuntime.jsx)(`circle`, {
                cx: `8`,
                cy: `8`,
                r: `6`,
                fill: `none`,
                stroke: `var(--color-accent-ink, #8ea2ff)`,
                strokeWidth: `2`,
                strokeLinecap: `round`,
                strokeDasharray: r,
                strokeDashoffset: r * (1 - n),
                transform: `rotate(-90 8 8)`,
                style: { transition: `stroke-dashoffset 0.6s ease-out` },
              }),
        ],
      }),
      (0, jsxRuntime.jsx)(Nf, { size: 8, strokeWidth: 3, className: `text-ink-2` }),
    ],
  });
}
function sm() {
  let e = useIslandStore((e) => e.settings?.showPrivacy !== !1),
    t = useIslandStore((t) => e && t.privacy.mic.length > 0),
    n = useIslandStore((e) => e.audio?.micMuted === !0),
    r = useIslandStore((t) => e && t.privacy.cam.length > 0),
    i = useIslandStore(
      (e) => e.settings?.obsStatus === !0 && !!e.obs && (e.obs.recording || e.obs.streaming),
    ),
    a = im(),
    o = useIslandStore((e) => e.downloads.length > 0 && e.settings?.downloadsInPill === `badge`);
  return !t && !r && !i && !a && !o
    ? null
    : (0, jsxRuntime.jsxs)(`span`, {
        className: `flex items-center gap-1`,
        children: [
          o && (0, jsxRuntime.jsx)(om, {}),
          a && (0, jsxRuntime.jsx)(am, {}),
          i && (0, jsxRuntime.jsx)(nm, {}),
          r &&
            (0, jsxRuntime.jsx)(`span`, {
              className: `size-[7px] rounded-full bg-emerald-400 shadow-[0_0_6px_rgb(52_211_153/0.8)]`,
            }),
          t &&
            (0, jsxRuntime.jsx)(`span`, {
              className: `size-[7px] rounded-full ${n ? `bg-danger` : `bg-orange-400 shadow-[0_0_6px_rgb(251_146_60/0.8)]`}`,
            }),
        ],
      });
}
function cm() {
  let e = Hd((e) => e.timer),
    n = xd(e);
  if ((Mp(n === `running`, 250), n !== `running` && n !== `paused`)) return null;
  let r = Date.now(),
    i = T(Od(e, r)),
    a = e.total > 0 ? Math.min(1, Sd(e, r) / e.total) : 0,
    o = 2 * Math.PI * 5.4;
  return (0, jsxRuntime.jsxs)(`span`, {
    "data-pill-timer": !0,
    className: `pop-in flex shrink-0 items-center gap-[5px] transition-opacity ${n === `paused` ? `opacity-55` : ``}`,
    children: [
      (0, jsxRuntime.jsxs)(`svg`, {
        width: `14`,
        height: `14`,
        viewBox: `0 0 14 14`,
        "aria-hidden": !0,
        children: [
          (0, jsxRuntime.jsx)(`circle`, {
            cx: `7`,
            cy: `7`,
            r: `5.4`,
            fill: `none`,
            stroke: `color-mix(in srgb, var(--color-timer) 28%, transparent)`,
            strokeWidth: `2.4`,
          }),
          (0, jsxRuntime.jsx)(`circle`, {
            cx: `7`,
            cy: `7`,
            r: `5.4`,
            fill: `none`,
            stroke: `var(--color-timer)`,
            strokeWidth: `2.4`,
            strokeLinecap: `round`,
            strokeDasharray: o,
            strokeDashoffset: o * (1 - a),
            transform: `rotate(-90 7 7)`,
          }),
        ],
      }),
      (0, jsxRuntime.jsx)(`span`, {
        className: `tabular text-[12.5px] font-semibold text-timer`,
        style: { width: t(i.length) },
        children: i,
      }),
    ],
  });
}
function lm() {
  return Hd((e) => {
    let t = xd(e.timer);
    return t === `running` || t === `paused`;
  });
}
var um = (e) => (e.settings?.desktopInPill === !0 && e.vdesk && e.vdesk.count > 1 ? l(e.vdesk) : ``);
function dm() {
  let e = useIslandStore((e) => e.caps && e.settings?.showCaps !== !1),
    t = useIslandStore((e) => (e.settings?.layoutInPill === !0 ? e.layoutCode : ``)),
    n = useIslandStore(um);
  return !e && !t && !n
    ? null
    : (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
        children: [
          n &&
            (0, jsxRuntime.jsxs)(`span`, {
              "data-pill-desk": !0,
              className: `flex items-center gap-1 rounded-[5px] bg-white/12 px-1 text-[10px] leading-4 font-bold text-ink`,
              title: r(`Виртуальный рабочий стол`, `Virtual desktop`),
              children: [
                (0, jsxRuntime.jsx)(`span`, {
                  className: `size-1.5 rounded-[2px] border border-current opacity-70`,
                }),
                (0, jsxRuntime.jsx)(`span`, { className: `max-w-[80px] truncate`, children: n }),
              ],
            }),
          t &&
            (0, jsxRuntime.jsx)(`span`, {
              "data-pill-layout": !0,
              className: `rounded-[5px] bg-white/12 px-1 text-[10px] leading-4 font-bold tracking-wide text-ink`,
              children: t.slice(0, 3),
            }),
          e &&
            (0, jsxRuntime.jsx)(`span`, {
              className: `rounded-[5px] bg-amber-300 px-1 text-[10px] leading-4 font-bold text-neutral-950`,
              children: `⇪`,
            }),
        ],
      });
}
function fm() {
  let shelfCount = useIslandStore((e) => (e.settings?.moduleShelf === !1 ? 0 : e.shelf.length)),
    hasCharacter = be(),
    characterHasFace = ne().face === !0,
    accent = useIslandStore((e) => e.accent),
    level = useIslandStore((e) => e.level),
    streaming = re((e) => e.streaming),
    playing = useIslandStore((e) => e.media?.playing === !0),
    clock = useIslandStore((e) => e.settings?.showClock !== !1) && (0, jsxRuntime.jsx)($p, {}),
    battery = useIslandStore((e) => (e.settings?.showBattery === !1 ? null : e.battery)),
    charge = battery && (0, jsxRuntime.jsx)(em, { battery }),
    weather = gf(),
    weatherWidget = weather && (0, jsxRuntime.jsxs)(`span`, {
      className: `flex shrink-0 items-center gap-1`,
      children: [
        (0, jsxRuntime.jsx)(Jp, { sky: weather.sky, night: weather.night, size: 19, still: !0 }),
        (0, jsxRuntime.jsx)(`span`, {
          className: `tabular text-[12.5px] font-semibold text-ink`,
          children: weather.temp,
        }),
      ],
    });
  return (0, jsxRuntime.jsx)(NormalMediaPill, {
    playing,
    hasCharacter,
    characterHasFace,
    cover: (0, jsxRuntime.jsx)(kp, { size: 22, radius: 6 }),
    clock,
    battery: charge,
    weather: weatherWidget,
    inputIndicators: (0, jsxRuntime.jsx)(cm, {}),
    status: (0, jsxRuntime.jsxs)(ReactRuntime.Fragment, {
      children: [
        (0, jsxRuntime.jsx)(dm, {}),
        (0, jsxRuntime.jsx)(sm, {}),
        shelfCount > 0 && (0, jsxRuntime.jsx)(gm, { count: shelfCount }),
      ],
    }),
    character: hasCharacter
      ? (0, jsxRuntime.jsx)(ye, {
          mood: streaming ? `think` : playing ? `music` : void 0,
          accent: streaming ? null : accent,
          level,
          width: 52,
          height: 32,
        })
      : (0, jsxRuntime.jsx)(jp, { height: 15 }),
  });
}
function pm() {
  let e = be(),
    t = ne(),
    n = useIslandStore((e) => e.settings?.characterSize === `large`),
    r = t.face === !0,
    i = re((e) => e.streaming),
    a = gf(),
    o = useIslandStore((e) => e.settings?.showClock !== !1),
    s = useIslandStore((e) => (e.settings?.showBattery === !1 ? null : e.battery)),
    c = useIslandStore(
      (e) =>
        (e.caps && e.settings?.showCaps !== !1) ||
        (e.settings?.layoutInPill === !0 && e.layoutCode !== ``) ||
        um(e) !== ``,
    ),
    l = useIslandStore(
      (e) =>
        (e.settings?.showPrivacy !== !1 && (e.privacy.mic.length > 0 || e.privacy.cam.length > 0)) ||
        (e.settings?.obsStatus === !0 && !!e.obs && (e.obs.recording || e.obs.streaming)) ||
        (e.settings?.agentsStatus !== !1 && e.agents.length > 0) ||
        (e.downloads.length > 0 && e.settings?.downloadsInPill === `badge`),
    ),
    u = useIslandStore((e) => (e.settings?.moduleShelf === !1 ? 0 : e.shelf.length)),
    p = lm() && (0, jsxRuntime.jsx)(cm, {}),
    m = o && (0, jsxRuntime.jsx)($p, {}),
    h = s && (0, jsxRuntime.jsx)(em, { battery: s }),
    g =
      (c || u > 0) &&
      (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
        children: [c && (0, jsxRuntime.jsx)(dm, {}), u > 0 && (0, jsxRuntime.jsx)(gm, { count: u })],
      }),
    v = l && (0, jsxRuntime.jsx)(sm, {}),
    y =
      a &&
      (0, jsxRuntime.jsxs)(`span`, {
        className: `flex shrink-0 items-center gap-1`,
        children: [
          (0, jsxRuntime.jsx)(Jp, { sky: a.sky, night: a.night, size: 19, still: !0 }),
          (0, jsxRuntime.jsx)(`span`, {
            className: `tabular text-[12.5px] font-semibold text-ink`,
            children: a.temp,
          }),
        ],
      });
  if (!e) {
    if (!a && !m && !h && !g && !v && !p) return null;
    if (r && (m || h || g || v || p)) {
      let e = f({ clock: !!m, battery: !!h, weather: !!a }),
        t = (e) =>
          (0, jsxRuntime.jsx)(
            ReactRuntime.Fragment,
            { children: e === `clock` ? m : e === `battery` ? h : y },
            e,
          );
      return (0, jsxRuntime.jsxs)(`div`, {
        className: `grid h-full grid-cols-[1fr_auto_1fr] items-center px-[13px]`,
        children: [
          (0, jsxRuntime.jsxs)(`span`, {
            className: `flex items-center gap-2 justify-self-start`,
            children: [e.left.map(t), p, g],
          }),
          (0, jsxRuntime.jsx)(`span`, { style: { width: 40 } }),
          (0, jsxRuntime.jsxs)(`span`, {
            className: `flex items-center gap-2 justify-self-end`,
            children: [v, e.right.map(t)],
          }),
        ],
      });
    }
    return (0, jsxRuntime.jsxs)(`div`, {
      className: `grid h-full grid-cols-[1fr_auto_1fr] items-center pr-3.5 pl-3`,
      children: [
        (0, jsxRuntime.jsxs)(`span`, {
          className: `flex items-center gap-2 justify-self-start`,
          children: [a && (0, jsxRuntime.jsx)(Jp, { sky: a.sky, night: a.night, size: 20, still: !0 }), g],
        }),
        (0, jsxRuntime.jsxs)(`span`, { className: `flex items-center gap-2`, children: [p, m, h] }),
        (0, jsxRuntime.jsxs)(`span`, {
          className: `flex items-center gap-2 justify-self-end`,
          children: [
            v,
            a &&
              (0, jsxRuntime.jsx)(`span`, {
                className: `tabular text-[12.5px] font-semibold text-ink`,
                children: a.temp,
              }),
          ],
        }),
      ],
    });
  }
  let b =
      (m || h || y || g || v || p) &&
      (0, jsxRuntime.jsxs)(`span`, {
        className: `flex shrink-0 items-center gap-2`,
        children: [g, v, p, m, h, y],
      }),
    x = n ? 44 : 34;
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `flex h-full items-center ${b ? `gap-2 pr-3 pl-2` : `justify-center`}`,
    children: [
      (0, jsxRuntime.jsx)(ye, { mood: i ? `think` : void 0, width: b ? _(t.box, x) : d(n), height: x }),
      b,
    ],
  });
}
function mm() {
  let e = useIslandStore((e) => e.downloads),
    t = e.reduce((e, t) => e + t.size, 0),
    n = e.reduce((e, t) => e + t.speed, 0),
    i = e.length > 1 ? v(e.length, [`файл`, `файла`, `файлов`], [`file`, `files`]) : (e[0]?.name ?? ``),
    a = e.length > 0 && e.every((e) => (e.total ?? 0) > 0) ? e.reduce((e, t) => e + (t.total ?? 0), 0) : 0,
    o = a > 0 ? Math.min(1, t / a) : null,
    s = 2 * Math.PI * 9.5;
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `flex h-full items-center gap-2.5 px-3`,
    children: [
      (0, jsxRuntime.jsxs)(`span`, {
        className: `relative grid size-[22px] shrink-0 place-items-center`,
        children: [
          o === null
            ? (0, jsxRuntime.jsxs)(`svg`, {
                className: `absolute inset-0 animate-spin [animation-duration:1.4s]`,
                viewBox: `0 0 22 22`,
                children: [
                  (0, jsxRuntime.jsx)(`circle`, {
                    cx: `11`,
                    cy: `11`,
                    r: `9.5`,
                    fill: `none`,
                    stroke: `color-mix(in srgb, var(--color-ink) 15%, transparent)`,
                    strokeWidth: `2`,
                  }),
                  (0, jsxRuntime.jsx)(`path`, {
                    d: `M11 1.5 A9.5 9.5 0 0 1 20.5 11`,
                    fill: `none`,
                    stroke: `#8ea2ff`,
                    strokeWidth: `2`,
                    strokeLinecap: `round`,
                  }),
                ],
              })
            : (0, jsxRuntime.jsxs)(`svg`, {
                "data-download-share": !0,
                className: `absolute inset-0 -rotate-90`,
                viewBox: `0 0 22 22`,
                children: [
                  (0, jsxRuntime.jsx)(`circle`, {
                    cx: `11`,
                    cy: `11`,
                    r: `9.5`,
                    fill: `none`,
                    stroke: `color-mix(in srgb, var(--color-ink) 15%, transparent)`,
                    strokeWidth: `2`,
                  }),
                  (0, jsxRuntime.jsx)(`circle`, {
                    cx: `11`,
                    cy: `11`,
                    r: `9.5`,
                    fill: `none`,
                    stroke: `#8ea2ff`,
                    strokeWidth: `2`,
                    strokeLinecap: `round`,
                    strokeDasharray: `${s * o} ${s}`,
                    className: `transition-[stroke-dasharray] duration-500`,
                  }),
                ],
              }),
          (0, jsxRuntime.jsx)(jf, { size: 11, className: `text-ink` }),
        ],
      }),
      (0, jsxRuntime.jsx)(`span`, {
        className: `min-w-0 flex-1 truncate text-[11.5px] font-medium text-ink`,
        children: i,
      }),
      (0, jsxRuntime.jsxs)(`span`, {
        className: `tabular shrink-0 text-[11px] text-ink-3`,
        children: [o === null ? Se(t) : `${Math.floor(o * 100)} %`, n > 0 && ` · ${Se(n)}${r(`/с`, `/s`)}`],
      }),
    ],
  });
}
function hm() {
  let e = useIslandStore((e) => e.updating),
    t = e?.total ? Math.min(1, e.downloaded / e.total) : null;
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `flex h-full items-center gap-2.5 px-3.5`,
    children: [
      (0, jsxRuntime.jsx)(Ce, { size: 14, className: `shrink-0 text-accent` }),
      (0, jsxRuntime.jsx)(`span`, {
        className: `shrink-0 text-[11.5px] font-medium text-ink`,
        children: r(`Обновление`, `Update`),
      }),
      (0, jsxRuntime.jsx)(`div`, {
        className: `h-1 flex-1 overflow-hidden rounded-full bg-white/15`,
        children: (0, jsxRuntime.jsx)(`div`, {
          className: `h-full rounded-full bg-accent transition-[width] duration-200`,
          style: { width: t === null ? `30%` : `${t * 100}%` },
        }),
      }),
    ],
  });
}
function gm({ count: e }) {
  return (0, jsxRuntime.jsxs)(
    `span`,
    {
      className: `pop-in tabular flex h-[18px] min-w-[18px] items-center justify-center gap-0.5 rounded-full bg-white/12 px-1.5 text-[10.5px] font-semibold text-ink`,
      children: [(0, jsxRuntime.jsx)(ue, { size: 10 }), e],
    },
    e,
  );
}
var _m = 2;
function vm(e) {
  if (!e) return [];
  try {
    let t = JSON.parse(e);
    if (!Array.isArray(t)) return [];
    let n = new Set(),
      r = [];
    for (let e of t) {
      if (!e || typeof e.id != `string` || !Array.isArray(e.items)) continue;
      let t = e.items.filter((e) => Number.isInteger(e) && !n.has(e));
      (t.forEach((e) => n.add(e)),
        t.length >= _m && r.push({ id: e.id, name: bm(typeof e.name == `string` ? e.name : ``), items: t }));
    }
    return r;
  } catch {
    return [];
  }
}
function ym(e) {
  return JSON.stringify(e);
}
function bm(e) {
  return e.replace(/\s+/g, ` `).trim().slice(0, 24);
}
function xm(e, t) {
  let n = new Set(t.map((e) => e.id));
  return e.map((e) => ({ ...e, items: e.items.filter((e) => n.has(e)) })).filter((e) => e.items.length >= _m);
}
function Sm(e, t) {
  let n = xm(t, e),
    r = new Map(e.map((e) => [e.id, e])),
    i = new Map();
  n.forEach((e) => e.items.forEach((t) => i.set(t, e)));
  let a = new Set(),
    o = [];
  for (let t of e) {
    let e = i.get(t.id);
    e
      ? a.has(e.id) || (a.add(e.id), o.push({ kind: `group`, group: e, items: e.items.map((e) => r.get(e)) }))
      : o.push({ kind: `item`, item: t });
  }
  return o;
}
function Cm(e, t) {
  return e.map((e) => (e.items.includes(t) ? { ...e, items: e.items.filter((e) => e !== t) } : e));
}
function wm(e, t, n, r, i) {
  if (t === n) return e;
  let a = e.find((e) => e.items.includes(n));
  return a
    ? Tm(e, a.id, t)
    : [...Cm(e, t), { id: i, name: bm(r), items: [n, t] }].filter((e) => e.items.length >= _m);
}
function Tm(e, t, n) {
  return e.some((e) => e.id === t)
    ? Cm(e, n)
        .map((e) => (e.id === t ? { ...e, items: [...e.items, n] } : e))
        .filter((e) => e.items.length >= _m)
    : e;
}
function Em(e, t) {
  return Cm(e, t).filter((e) => e.items.length >= _m);
}
function Dm(e, t) {
  return e.filter((e) => e.id !== t);
}
function Om(e, t, n) {
  let r = bm(n);
  return r ? e.map((e) => (e.id === t ? { ...e, name: r } : e)) : e;
}
function usePlaybackPosition(e) {
  let [t, n] = (0, ReactRuntime.useState)(null),
    r = (0, ReactRuntime.useRef)(!1);
  Mp(e.playing && t === null, 500);
  let i = t === null ? _f(e) : t * e.durationMs,
    a = e.durationMs > 0 ? Math.min(1, Math.max(0, i / e.durationMs)) : 0,
    o = (e) => {
      let t = e.currentTarget.getBoundingClientRect();
      return wf(e.clientX, t.left, t.width);
    },
    s = (e) => {
      ((r.current = e), useIslandStore.getState().setHoldOpen(e));
    };
  return (
    (0, ReactRuntime.useEffect)(
      () => () => {
        r.current && useIslandStore.getState().setHoldOpen(!1);
      },
      [],
    ),
    {
      pos: i,
      frac: a,
      held: t,
      handlers: {
        onPointerDown: (t) => {
          if (!(t.button !== 0 || e.durationMs <= 0 || e.canSeek === false)) {
            t.stopPropagation();
            try {
              t.currentTarget.setPointerCapture(t.pointerId);
            } catch {}
            (s(!0), n(o(t)));
          }
        },
        onPointerMove: (e) => {
          t !== null && n(o(e));
        },
        onPointerUp: (r) => {
          if (t === null) return;
          let i = o(r);
          (n(null), s(!1), seekPlayback(i * e.durationMs));
        },
        onPointerCancel: () => {
          t !== null && (n(null), s(!1));
        },
      },
    }
  );
}
function Am({ seek: e, tint: t, className: n = `` }) {
  let { frac: r, held: i, handlers: a } = e;
  return (0, jsxRuntime.jsxs)(`div`, {
    "data-media-bar": !0,
    "data-held": String(i !== null),
    className: `group relative h-3 cursor-pointer touch-none py-1 ${n}`,
    onClick: (e) => e.stopPropagation(),
    ...a,
    children: [
      (0, jsxRuntime.jsx)(`div`, {
        className: `overflow-hidden rounded-full bg-white/15 transition-[height] ${i === null ? `h-1 group-hover:h-1.5` : `h-1.5`}`,
        children: (0, jsxRuntime.jsx)(`div`, {
          className: `h-full rounded-full`,
          style: { width: `${r * 100}%`, background: t },
        }),
      }),
      (0, jsxRuntime.jsx)(`div`, {
        "data-media-handle": !0,
        className: `pointer-events-none absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow transition-[opacity,transform] duration-150 ${i === null ? `scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100` : `scale-125 opacity-100`}`,
        style: { left: `${r * 100}%` },
      }),
    ],
  });
}
var jm = 6,
  Mm = 650,
  Nm = 2e3;
function Pm(e) {
  let t = useIslandStore.getState();
  if (t.settings?.captureVisible !== !0) {
    setTimeout(e, 120);
    return;
  }
  let n =
      (t.settings?.character ?? `liquid`) === `liquid` || (t.settings?.liquidWith === !0 && t.license.pro),
    r = performance.now(),
    i = ``,
    a = 0,
    o = () => {
      let t = document.querySelector(`[data-island]`)?.getBoundingClientRect(),
        s = t ? `${Math.round(t.width)}x${Math.round(t.height)}` : ``;
      ((a = s === i ? a + 1 : 0), (i = s));
      let c = !useIslandStore.getState().expanded && !!t && t.height < 70 && a >= jm;
      if (c || performance.now() - r > Nm) {
        setTimeout(e, c && n ? Mm : 120);
        return;
      }
      requestAnimationFrame(o);
    };
  requestAnimationFrame(o);
}
function Fm(e, t) {
  let n = 0,
    r = e.length - 1,
    i = -1,
    a = t + 250;
  for (; n <= r; ) {
    let t = (n + r) >> 1;
    e[t].ms <= a ? ((i = t), (n = t + 1)) : (r = t - 1);
  }
  return i;
}
function Im(e) {
  return `${e.artist.trim().toLowerCase()}\n${e.title.trim().toLowerCase()}\n${Math.round(e.durationMs / 1e3)}`;
}
var $ = _e(() => ({ key: null, status: `idle`, lyrics: null, widths: [], lineW: 0, wrap: !1 }));
function Lm(e) {
  if (!e || e.synced.length === 0) return [];
  try {
    let t = document.createElement(`canvas`).getContext(`2d`);
    return t
      ? ((t.font = `600 12.5px ${getComputedStyle(document.body).fontFamily}`),
        e.synced.map((e) => Math.ceil(t.measureText(e.text).width)))
      : [];
  } catch {
    return [];
  }
}
function Rm() {
  let e,
    t = () => {
      let t = useIslandStore.getState(),
        n = t.media;
      if (!t.settings?.lyrics || !n || !n.title.trim()) {
        (clearTimeout(e),
          $.getState().status !== `idle` &&
            $.setState({ key: null, status: `idle`, lyrics: null, widths: [] }));
        return;
      }
      let r = Im(n);
      if ($.getState().key === r) return;
      (clearTimeout(e), $.setState({ key: r, status: `loading`, lyrics: null, widths: [] }));
      let a = (t) => {
        i.lyricsGet(n.artist, n.title, n.album ?? ``, n.durationMs)
          .then((e) => {
            if ($.getState().key !== r) return;
            let t = !!e && e.found && (e.instrumental || e.synced.length > 0 || e.plain.trim() !== ``);
            $.setState({ status: t ? `ready` : `none`, lyrics: e ?? null, widths: t ? Lm(e) : [] });
          })
          .catch(() => {
            $.getState().key === r &&
              (t < 5 ? (e = setTimeout(() => a(t + 1), 2e3)) : $.setState({ status: `error`, lyrics: null }));
          });
      };
      e = setTimeout(() => a(1), 700);
    };
  t();
  let n = useIslandStore.subscribe((e, n) => {
    (e.media !== n.media || e.settings?.lyrics !== n.settings?.lyrics) && t();
  });
  return () => {
    (clearTimeout(e), n());
  };
}
function zm() {
  let e = useIslandStore((e) => e.media),
    { status: t, lyrics: n } = $(),
    r = t === `ready` && n ? n.synced : [],
    i = r.length > 0 && !!e && e.durationMs > 0;
  Mp(i && e?.playing === !0, 120);
  let a = i && e ? Fm(r, _f(e)) : -1;
  return { status: t, lyrics: n, lines: i ? r : [], index: a, synced: i };
}
const Bm = MediaTitle;
function Vm() {
  let e = useIslandStore((e) => (e.settings?.moduleShelf === !1 ? 0 : e.shelf.length)),
    t = useIslandStore((e) => e.settings?.showClock !== !1),
    n = useIslandStore((e) => (e.settings?.showBattery === !1 ? null : e.battery)),
    r = gf(),
    i =
      r &&
      (0, jsxRuntime.jsxs)(`span`, {
        className: `flex shrink-0 items-center gap-1`,
        children: [
          (0, jsxRuntime.jsx)(Jp, { sky: r.sky, night: r.night, size: 19, still: !0 }),
          (0, jsxRuntime.jsx)(`span`, {
            className: `tabular text-[12.5px] font-semibold text-ink`,
            children: r.temp,
          }),
        ],
      });
  return {
    shelf: e,
    time: t && (0, jsxRuntime.jsx)($p, {}),
    charge: n && (0, jsxRuntime.jsx)(em, { battery: n }),
    now: i,
  };
}
var Hm = (e) => (t) => {
  (t.stopPropagation(), e());
};
// Store adapter; the compact media markup is maintained in typed CollapsedTrack.tsx.
function Um() {
  const media = useIslandStore(state => state.media);
  const accent = useIslandStore(state => state.accent);
  const level = useIslandStore(state => state.level);
  const thinking = re(state => state.streaming);
  const hasCharacter = be();
  const { shelf, time, charge, now } = Vm();
  Mp(media?.playing === true && media.durationMs > 0, 1000);
  if (!media) return null;
  return jsxRuntime.jsx(CollapsedTrack, {
    media, accent, positionMs: _f(media),
    cover: jsxRuntime.jsx(kp, { size: 28, radius: 7 }),
    extras: jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [jsxRuntime.jsx(cm, {}), time, charge, now, jsxRuntime.jsx(dm, {}), jsxRuntime.jsx(sm, {}), shelf > 0 && jsxRuntime.jsx(gm, { count: shelf })] }),
    character: hasCharacter ? jsxRuntime.jsx(ye, { mood: thinking ? 'think' : media.playing ? 'music' : undefined, accent: thinking ? null : accent, level, width: 52, height: 32 }) : jsxRuntime.jsx(jp, { height: 15 })
  });
}
function Wm() {
  return useIslandStore((e) => e.media) ? (0, jsxRuntime.jsx)(Gm, {}) : null;
}
function Gm() {
  let e = useIslandStore((e) => e.media),
    t = useIslandStore((e) => e.settings?.lyrics === !0),
    n = useIslandStore((e) => e.settings?.lyrics === !0 && e.settings.lyricsInPlayer !== !1),
    a = useIslandStore((e) => e.accent),
    o = useIslandStore((e) => e.level),
    s = re((e) => e.streaming),
    c = useIslandStore((e) => e.media?.playing === !0),
    l = be(),
    u = ne().kind,
    d = useIslandStore((e) => le(u, e.settings?.liquidWith, e.license.pro)),
    { shelf: f, time: p, charge: m, now: h } = Vm(),
    g = usePlaybackPosition(e),
    _ = a ?? `var(--color-ink)`;
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `relative flex h-full`,
    children: [
      n &&
        a &&
        !d &&
        (0, jsxRuntime.jsx)(`span`, {
          className: `pointer-events-none absolute inset-0`,
          style: {
            background: `linear-gradient(to bottom, transparent 35%, color-mix(in srgb, ${a} 30%, transparent))`,
          },
        }),
      (0, jsxRuntime.jsxs)(`div`, {
        "data-media-pill": `player`,
        className: `relative flex h-full min-w-0 flex-1 flex-col px-3.5 pt-3 pb-3`,
        children: [
          (0, jsxRuntime.jsxs)(`div`, {
            className: `flex h-[52px] items-center gap-3`,
            children: [
              (0, jsxRuntime.jsx)(kp, { size: 52, radius: 10, className: `shadow-md shadow-neutral-950/40` }),
              (0, jsxRuntime.jsx)(`div`, {
                className: `flex min-w-0 flex-1 flex-col justify-center leading-snug`,
                children: (0, jsxRuntime.jsx)(ml, {
                  initial: !1,
                  mode: `popLayout`,
                  children: (0, jsxRuntime.jsxs)(
                    od.div,
                    {
                      className: `min-w-0`,
                      initial: { opacity: 0, y: 6 },
                      animate: { opacity: 1, y: 0 },
                      exit: { opacity: 0, y: -6 },
                      transition: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] },
                      children: [
                        (0, jsxRuntime.jsx)(`div`, {
                          className: `truncate text-[13px] font-semibold text-ink`,
                          children: e.title || r(`Без названия`, `Untitled`),
                        }),
                        e.artist &&
                          (0, jsxRuntime.jsx)(`div`, {
                            className: `truncate text-[12px] text-ink-2`,
                            children: e.artist,
                          }),
                        e.album &&
                          (0, jsxRuntime.jsx)(`div`, {
                            className: `truncate text-[11px] text-ink-3`,
                            children: e.album,
                          }),
                      ],
                    },
                    e.key,
                  ),
                }),
              }),
              (0, jsxRuntime.jsxs)(`div`, {
                className: `flex h-full shrink-0 flex-col items-end justify-center gap-[3px]`,
                children: [
                  (0, jsxRuntime.jsxs)(`span`, {
                    className: `flex h-4 items-center gap-2`,
                    children: [
                      (0, jsxRuntime.jsx)(dm, {}),
                      (0, jsxRuntime.jsx)(sm, {}),
                      f > 0 && (0, jsxRuntime.jsx)(gm, { count: f }),
                      !l && (0, jsxRuntime.jsx)(jp, { height: 14 }),
                    ],
                  }),
                  (0, jsxRuntime.jsxs)(`span`, {
                    className: `flex h-4 items-center gap-2`,
                    children: [(0, jsxRuntime.jsx)(cm, {}), p],
                  }),
                  (0, jsxRuntime.jsxs)(`span`, {
                    className: `flex h-4 items-center gap-2`,
                    children: [h, m],
                  }),
                ],
              }),
            ],
          }),
          e.durationMs > 0 &&
            (0, jsxRuntime.jsxs)(`div`, {
              className: `tabular mt-2.5 flex h-[14px] items-center gap-2 text-[10.5px] text-ink-3`,
              children: [
                (0, jsxRuntime.jsx)(`span`, { className: `w-8 shrink-0`, children: T(g.pos) }),
                (0, jsxRuntime.jsx)(Am, { seek: g, tint: _, className: `flex-1` }),
                (0, jsxRuntime.jsxs)(`span`, {
                  className: `w-8 shrink-0 text-right`,
                  children: [`-`, T(e.durationMs - g.pos)],
                }),
              ],
            }),
          (0, jsxRuntime.jsxs)(`div`, {
            className: `relative mt-auto flex h-8 items-center justify-center gap-6`,
            children: [
              t &&
                (0, jsxRuntime.jsx)(`button`, {
                  "data-pill-lyrics": !0,
                  title: n
                    ? r(`Скрыть текст песни`, `Hide the words`)
                    : r(`Показать текст песни`, `Show the words`),
                  className: `press absolute left-0 grid size-8 place-items-center rounded-full hover:bg-white/8 ${n ? `text-ink` : `text-ink-3 hover:text-ink`}`,
                  onClick: Hm(() => {
                    let e = useIslandStore.getState().settings;
                    e && i.settingsSet({ ...e, lyricsInPlayer: !n });
                  }),
                  children: (0, jsxRuntime.jsx)(tp, { size: 16 }),
                }),
              (0, jsxRuntime.jsx)(`button`, {
                "data-pill-prev": !0,
                title: r(`Предыдущий трек`, `Previous track`),
                className: `press grid size-8 place-items-center rounded-full text-ink-2 hover:bg-white/8 hover:text-ink`,
                onClick: Hm(() => void i.mediaControl(`prev`)),
                children: (0, jsxRuntime.jsx)(pp, { size: 16, fill: `currentColor` }),
              }),
              (0, jsxRuntime.jsx)(`button`, {
                "data-pill-toggle": !0,
                title: e.playing ? r(`Пауза`, `Pause`) : r(`Играть`, `Play`),
                className: `press grid size-8 place-items-center rounded-full bg-white text-black`,
                onClick: Hm(togglePlayback),
                children: (0, jsxRuntime.jsx)(ml, {
                  initial: !1,
                  mode: `popLayout`,
                  children: (0, jsxRuntime.jsx)(
                    od.span,
                    {
                      className: `grid place-items-center`,
                      initial: { opacity: 0, scale: 0.6, rotate: -45 },
                      animate: { opacity: 1, scale: 1, rotate: 0 },
                      exit: { opacity: 0, scale: 0.6, rotate: 45 },
                      transition: { duration: 0.16 },
                      children: e.playing
                        ? (0, jsxRuntime.jsx)(rp, { size: 16, fill: `currentColor` })
                        : (0, jsxRuntime.jsx)(lp, { size: 16, fill: `currentColor`, className: `ml-0.5` }),
                    },
                    e.playing ? `pause` : `play`,
                  ),
                }),
              }),
              (0, jsxRuntime.jsx)(`button`, {
                "data-pill-next": !0,
                title: r(`Следующий трек`, `Next track`),
                className: `press grid size-8 place-items-center rounded-full text-ink-2 hover:bg-white/8 hover:text-ink`,
                onClick: Hm(() => void i.mediaControl(`next`)),
                children: (0, jsxRuntime.jsx)(hp, { size: 16, fill: `currentColor` }),
              }),
              l &&
                (0, jsxRuntime.jsx)(`span`, {
                  className: `absolute right-0 bottom-0`,
                  children: (0, jsxRuntime.jsx)(ye, {
                    mood: s ? `think` : c ? `music` : void 0,
                    accent: s ? null : a,
                    level: o,
                    width: 52,
                    height: 32,
                  }),
                }),
            ],
          }),
        ],
      }),
      n &&
        (0, jsxRuntime.jsx)(`div`, {
          "data-lyrics-column": !0,
          className: `relative w-[256px] shrink-0 py-3 pr-4 pl-1`,
          children: (0, jsxRuntime.jsx)(LyricsPanel, {}),
        }),
    ],
  });
}
function Km({ children: e }) {
  return (0, jsxRuntime.jsx)(`div`, {
    className: `grid h-full place-items-center text-center text-[12px] leading-snug text-ink-3`,
    children: e,
  });
}
function qm() {
  return (0, jsxRuntime.jsx)(`button`, {
    "data-lyrics-credit": !0,
    title: `lrclib.net`,
    onClick: Hm(() => void i.openPath(`https://lrclib.net/`)),
    className: `absolute right-0 bottom-0 h-3 text-[9px] leading-3 font-medium tracking-wide text-ink-3/70 hover:text-ink-2`,
    children: `LRCLIB`,
  });
}
function LyricsPanel() {
  let { status: e, lyrics: t, lines: n, index: i, synced: a } = zm(),
    o = (0, ReactRuntime.useRef)(null),
    s = (0, ReactRuntime.useRef)(null),
    [c, l] = (0, ReactRuntime.useState)(0),
    u = Math.max(0, i);
  return (
    (0, ReactRuntime.useLayoutEffect)(() => {
      let e = o.current,
        t = s.current?.children[u];
      e && t && l(Math.round(e.clientHeight * 0.45 - (t.offsetTop + t.offsetHeight / 2)));
    }, [u, n]),
    e === `loading` || e === `idle`
      ? (0, jsxRuntime.jsx)(Km, { children: r(`Ищу текст песни…`, `Looking for the words…`) })
      : e === `error`
        ? (0, jsxRuntime.jsx)(Km, { children: r(`LRCLIB сейчас не отвечает`, `LRCLIB doesn't answer now`) })
        : e !== `ready` || !t
          ? (0, jsxRuntime.jsx)(Km, { children: r(`Текста для этой песни нет`, `No words for this song`) })
          : t.instrumental
            ? (0, jsxRuntime.jsx)(Km, { children: r(`Песня без слов`, `No words: an instrumental`) })
            : a
              ? (0, jsxRuntime.jsxs)(`div`, {
                  className: `relative h-full`,
                  children: [
                    (0, jsxRuntime.jsx)(`div`, {
                      ref: o,
                      className: `relative h-[calc(100%-14px)] overflow-hidden [mask-image:linear-gradient(transparent,black_24%,black_76%,transparent)]`,
                      children: (0, jsxRuntime.jsx)(`div`, {
                        ref: s,
                        className: `transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none`,
                        style: { transform: `translateY(${c}px)` },
                        children: n.map((e, t) =>
                          (0, jsxRuntime.jsx)(
                            `div`,
                            {
                              "data-lyrics-now": t === i ? `` : void 0,
                              className: `origin-left py-[3px] text-[13px] leading-snug transition-[opacity,transform,color] duration-300 ${t === i ? `font-semibold text-ink` : `scale-[0.94] text-ink-3 opacity-55`}`,
                              children: e.text || `♪`,
                            },
                            t,
                          ),
                        ),
                      }),
                    }),
                    (0, jsxRuntime.jsx)(qm, {}),
                  ],
                })
              : (0, jsxRuntime.jsxs)(`div`, {
                  className: `relative h-full`,
                  children: [
                    (0, jsxRuntime.jsx)(`div`, {
                      className: `scroll-thin h-[calc(100%-14px)] overflow-y-auto pr-1 text-[12px] leading-snug whitespace-pre-line text-ink-2`,
                      onClick: (e) => e.stopPropagation(),
                      children:
                        t.plain ||
                        t.synced.map((e) => e.text).join(`
`),
                    }),
                    (0, jsxRuntime.jsx)(qm, {}),
                  ],
                })
  );
}
function publishLyricsLineWidth(lineW) {
  $.setState({ lineW });
}
function Ym() {
  let media = useIslandStore((e) => e.media),
    accent = useIslandStore((e) => e.accent),
    level = useIslandStore((e) => e.level),
    streaming = re((e) => e.streaming),
    playing = useIslandStore((e) => e.media?.playing === !0),
    hasCharacter = be(),
    { shelf, time, charge, now } = Vm(),
    { lines, index } = zm(),
    widths = $((e) => e.widths);
  return (0, jsxRuntime.jsx)(LyricsMediaPill, {
    media,
    activeIndex: index,
    text: index >= 0 ? (lines[index]?.text ?? ``) : ``,
    widths,
    publishLineWidth: publishLyricsLineWidth,
    cover: (0, jsxRuntime.jsx)(kp, { size: 28, radius: 7 }),
    lineIcon: (0, jsxRuntime.jsx)(S, { size: 12, className: `shrink-0 text-ink-3` }),
    extras: (0, jsxRuntime.jsxs)(ReactRuntime.Fragment, {
      children: [
        (0, jsxRuntime.jsx)(cm, {}), time, charge, now,
        (0, jsxRuntime.jsx)(dm, {}),
        (0, jsxRuntime.jsx)(sm, {}),
        shelf > 0 && (0, jsxRuntime.jsx)(gm, { count: shelf }),
      ],
    }),
    character: hasCharacter
      ? (0, jsxRuntime.jsx)(ye, {
          mood: streaming ? `think` : playing ? `music` : void 0,
          accent: streaming ? null : accent,
          level,
          width: 52,
          height: 32,
        })
      : (0, jsxRuntime.jsx)(jp, { height: 15 }),
  });
}
function Xm(e) {
  let [t, n] = (0, ReactRuntime.useState)(void 0),
    r = useIslandStore((e) => e.media?.app ?? ``);
  return (
    (0, ReactRuntime.useEffect)(() => {
      if (!e) return n(void 0);
      let t = !0,
        r = () =>
          void i
            .playerVolume()
            .then((e) => t && n(e))
            .catch(() => t && n(null));
      r();
      let a = setInterval(r, 2e3);
      return () => {
        ((t = !1), clearInterval(a));
      };
    }, [e, r]),
    [t, n]
  );
}
function Zm() {
  let e = useIslandStore((e) => e.audio),
    t = useIslandStore((e) => e.media !== null),
    [n, a] = (0, ReactRuntime.useState)(`system`),
    o = t && n === `player`,
    [s, c] = Xm(o),
    [l, u] = (0, ReactRuntime.useState)(null),
    [d, f] = (0, ReactRuntime.useState)(null),
    p = (0, ReactRuntime.useRef)(0);
  (0, ReactRuntime.useEffect)(() => u(null), [e?.level, o]);
  let m = o && s === null,
    h = l ?? (o ? s?.level : e?.level) ?? 0,
    g = (o ? s?.muted : e?.muted) ?? !1,
    _ = g || h === 0 ? Tp : h < 0.5 ? Cp : x,
    v = (e) => {
      if (!o) return void i.volumeSet(e);
      i.playerVolumeSet(e).then((t) => c(t ? { level: e, muted: e > 0 ? !1 : (s?.muted ?? !1) } : null));
    },
    y = (e, t = !1) => {
      if (m) return;
      let n = e.currentTarget.getBoundingClientRect(),
        r = Math.min(1, Math.max(0, (e.clientX - n.left) / n.width));
      u(r);
      let i = performance.now();
      (t || i - p.current > (o ? 80 : 30)) && ((p.current = i), v(r));
    },
    b = () => {
      if (!o) return void i.volumeMuteToggle();
      s && (c({ ...s, muted: !s.muted }), i.playerVolumeSet(null, !s.muted));
    },
    C = (e) => {
      if (!o) return void i.volumeStep(e);
      if (!s) return;
      let t = Math.min(1, Math.max(0, s.level + e));
      (c({ ...s, level: t }), i.playerVolumeSet(t));
    };
  return (0, jsxRuntime.jsxs)(`div`, {
    "data-volume-strip": o ? `player` : `system`,
    className: `relative flex h-[38px] shrink-0 items-center gap-2 rounded-xl bg-tile pr-1.5 pl-1`,
    children: [
      t &&
        (0, jsxRuntime.jsxs)(`div`, {
          className: `flex shrink-0 rounded-lg bg-white/6 p-0.5`,
          role: `group`,
          "aria-label": r(`Чью громкость менять`, `Whose volume to change`),
          children: [
            (0, jsxRuntime.jsx)(`button`, {
              "data-volume-target": `system`,
              title: r(`Громкость компьютера`, `The computer's volume`),
              "aria-pressed": !o,
              onClick: () => a(`system`),
              className: `grid size-6 place-items-center rounded-md ${o ? `text-ink-3 hover:text-ink` : `bg-white/15 text-ink`}`,
              children: (0, jsxRuntime.jsx)(_p, { size: 13 }),
            }),
            (0, jsxRuntime.jsx)(`button`, {
              "data-volume-target": `player`,
              title: r(
                `Громкость самого плеера. У браузера — громкость всего браузера`,
                `The player's own volume. For a browser, that of the whole browser`,
              ),
              "aria-pressed": o,
              onClick: () => a(`player`),
              className: `grid size-6 place-items-center rounded-md ${o ? `bg-white/15 text-ink` : `text-ink-3 hover:text-ink`}`,
              children: (0, jsxRuntime.jsx)(S, { size: 13 }),
            }),
          ],
        }),
      (0, jsxRuntime.jsx)(`button`, {
        title: g ? r(`Включить звук`, `Unmute`) : r(`Выключить звук`, `Mute`),
        disabled: m,
        className: `press grid size-8 shrink-0 place-items-center rounded-lg text-ink-2 hover:text-ink disabled:opacity-40`,
        onClick: b,
        children: (0, jsxRuntime.jsx)(_, { size: 16 }),
      }),
      m
        ? (0, jsxRuntime.jsx)(`span`, {
            "data-volume-lost": !0,
            className: `min-w-0 flex-1 truncate text-[11.5px] text-ink-3`,
            children: r(
              `Звук плеера не найден: он сейчас не играет`,
              `The player's sound isn't found: it plays nothing now`,
            ),
          })
        : (0, jsxRuntime.jsx)(`div`, {
            className: `group relative h-6 min-w-0 flex-1 cursor-pointer py-2.5`,
            onWheel: (e) => C(e.deltaY < 0 ? 0.02 : -0.02),
            onPointerDown: (e) => {
              (e.currentTarget.setPointerCapture(e.pointerId), y(e));
            },
            onPointerMove: (e) => e.buttons & 1 && y(e),
            onPointerUp: (e) => y(e, !0),
            children: (0, jsxRuntime.jsx)(`div`, {
              className: `h-1 overflow-hidden rounded-full bg-white/15 transition-[height] group-hover:h-1.5`,
              children: (0, jsxRuntime.jsx)(`div`, {
                className: `h-full rounded-full ${g ? `bg-white/35` : `bg-white`}`,
                style: { width: `${Math.round(h * 100)}%` },
              }),
            }),
          }),
      !m &&
        (0, jsxRuntime.jsx)(`span`, {
          className: `tabular w-7 shrink-0 text-right text-[11px] text-ink-3`,
          children: o && s === void 0 ? `` : Math.round(h * 100),
        }),
      !o &&
        (0, jsxRuntime.jsxs)(`button`, {
          title: e?.chosen
            ? r(
                `Остров работает с этим устройством: оно выбрано в настройках`,
                `The island works with this device: it is picked in the settings`,
              )
            : r(`Куда идёт звук`, `Output device`),
          onClick: () => {
            if (d) return f(null);
            i.audioDevices().then(f);
          },
          className: `press flex h-7 max-w-[132px] shrink-0 items-center gap-1 rounded-lg bg-white/6 px-2 text-[11px] text-ink-2 hover:bg-white/10 hover:text-ink`,
          children: [
            e?.chosen
              ? (0, jsxRuntime.jsx)(sp, { size: 12, className: `shrink-0` })
              : (0, jsxRuntime.jsx)(_p, { size: 12, className: `shrink-0` }),
            (0, jsxRuntime.jsx)(`span`, {
              className: `truncate`,
              children: e?.device || r(`Устройство`, `Device`),
            }),
            (0, jsxRuntime.jsx)(Ff, { size: 12, className: `shrink-0` }),
          ],
        }),
      (0, jsxRuntime.jsx)(ml, {
        children:
          d &&
          (0, jsxRuntime.jsxs)(od.div, {
            initial: { opacity: 0, y: 6, scale: 0.98 },
            animate: { opacity: 1, y: 0, scale: 1 },
            exit: { opacity: 0, y: 6, scale: 0.98 },
            transition: { duration: 0.14 },
            className: `scroll-thin absolute right-0 bottom-[calc(100%+6px)] z-10 max-h-[172px] w-[260px] overflow-y-auto rounded-xl bg-sheet p-1 shadow-2xl ring-1 ring-white/10`,
            children: [
              e?.chosen &&
                (0, jsxRuntime.jsx)(`div`, {
                  "data-device-note": !0,
                  className: `px-2.5 pt-1.5 pb-1 text-[11px] leading-snug text-ink-3`,
                  children: r(
                    `Громкость острова — у устройства из настроек. Этот список меняет, куда идёт звук в Windows.`,
                    `The island's volume belongs to the device picked in the settings. This list changes where Windows sends sound.`,
                  ),
                }),
              d.map((e) =>
                (0, jsxRuntime.jsxs)(
                  `button`,
                  {
                    className: `flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] text-ink hover:bg-white/8`,
                    onClick: () => {
                      (f(null), i.audioSetDefault(e.id));
                    },
                    children: [
                      (0, jsxRuntime.jsx)(`span`, {
                        className: `grid size-4 shrink-0 place-items-center`,
                        children:
                          e.default && (0, jsxRuntime.jsx)(we, { size: 13, className: `text-accent` }),
                      }),
                      (0, jsxRuntime.jsx)(`span`, { className: `min-w-0 flex-1 truncate`, children: e.name }),
                      e.chosen && (0, jsxRuntime.jsx)(sp, { size: 12, className: `shrink-0 text-ink-3` }),
                    ],
                  },
                  e.id,
                ),
              ),
              d.length === 0 &&
                (0, jsxRuntime.jsx)(`div`, {
                  className: `px-2.5 py-2 text-[12px] text-ink-3`,
                  children: r(`Устройства не найдены`, `No devices found`),
                }),
            ],
          }),
      }),
    ],
  });
}
function Qm() {
  let [e, t] = (0, ReactRuntime.useState)([]),
    n = useIslandStore((e) => e.setTab),
    a = useIslandStore((e) => e.settings?.pasteOnClick ?? !0);
  (0, ReactRuntime.useEffect)(() => {
    let e = () => void i.clipList(``).then((e) => t(e.slice(0, 3)));
    return (e(), window.addEventListener(Pp, e), () => window.removeEventListener(Pp, e));
  }, []);
  let o = (e, t) => Lp(e, a && !t.shiftKey);
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl bg-tile p-2`,
    children: [
      (0, jsxRuntime.jsxs)(`button`, {
        onClick: () => n(`clipboard`),
        className: `flex items-center justify-between px-1.5 pt-0.5 pb-1.5 text-[11px] font-semibold tracking-wider text-ink-3 uppercase hover:text-ink-2`,
        children: [r(`Недавно скопировано`, `Recently copied`), (0, jsxRuntime.jsx)(Lf, { size: 14 })],
      }),
      e.length === 0 &&
        (0, jsxRuntime.jsx)(`div`, {
          className: `grid flex-1 place-items-center px-6 text-center text-[12px] text-ink-3`,
          children: r(
            `Скопируй что-нибудь — здесь появятся последние записи, а сверху будет плеер, когда включишь музыку`,
            `Copy something and your latest items show up here; the player appears above once music is playing`,
          ),
        }),
      e.map((e) =>
        (0, jsxRuntime.jsxs)(
          `div`,
          {
            role: `button`,
            onClick: (t) => o(e, t),
            className: `press group flex h-[42px] cursor-pointer items-center gap-2.5 rounded-xl px-2 text-left hover:bg-tile-hover`,
            children: [
              (0, jsxRuntime.jsx)(Rp, { clip: e, className: `h-7 w-10 rounded-md` }),
              (0, jsxRuntime.jsx)(`span`, {
                className: `min-w-0 flex-1 truncate text-[12.5px] text-ink`,
                children: zp(e).replace(/\s+/g, ` `),
              }),
              (0, jsxRuntime.jsx)(`span`, {
                className: `shrink-0 text-[10.5px] text-ink-3 ${Dp(e) ? `group-hover:hidden` : ``}`,
                children: xe(e.createdAt),
              }),
              Dp(e) &&
                (0, jsxRuntime.jsx)(`button`, {
                  "data-clip-open": !0,
                  title:
                    e.kind === `video`
                      ? r(`Открыть запись`, `Open the recording`)
                      : r(`Открыть картинку`, `Open the picture`),
                  onClick: (t) => {
                    (t.stopPropagation(), Fp(e));
                  },
                  className: `press hidden size-7 shrink-0 place-items-center rounded-lg text-ink-3 group-hover:grid hover:bg-white/10 hover:text-ink`,
                  children: (0, jsxRuntime.jsx)($f, { size: 14 }),
                }),
            ],
          },
          e.id,
        ),
      ),
    ],
  });
}
function $m({ appId: e, name: t }) {
  let [n, a] = (0, ReactRuntime.useState)(!1),
    [o, s] = (0, ReactRuntime.useState)(t);
  if (!n)
    return (0, jsxRuntime.jsx)(`button`, {
      title: r(`Переименовать плеер`, `Rename the player`),
      onClick: () => {
        (s(t), a(!0), i.takeFocus());
      },
      className: `max-w-full truncate text-left text-[10.5px] font-semibold tracking-wider text-ink-3 uppercase hover:text-ink-2`,
      children: t,
    });
  let c = () => {
    (a(!1), o.trim() !== t && i.mediaRename(e, o.trim()));
  };
  return (0, jsxRuntime.jsx)(`input`, {
    autoFocus: !0,
    value: o,
    onChange: (e) => s(e.target.value),
    onBlur: c,
    onKeyDown: (e) => {
      (e.key === `Enter` && c(), e.key === `Escape` && a(!1));
    },
    placeholder: r(`Название плеера`, `Player name`),
    className: `h-5 w-full rounded bg-white/10 px-1.5 text-[11px] font-semibold text-ink outline-none`,
  });
}
function eh({ onClose: e }) {
  let [t, n] = (0, ReactRuntime.useState)(null),
    a = (0, ReactRuntime.useRef)(null);
  ((0, ReactRuntime.useEffect)(() => {
    i.mediaSources()
      .then(n)
      .catch(() => n([]));
  }, []),
    (0, ReactRuntime.useEffect)(() => {
      let t = (t) => {
          a.current && !a.current.contains(t.target) && e();
        },
        n = (t) => t.key === `Escape` && e();
      return (
        window.addEventListener(`pointerdown`, t, !0),
        window.addEventListener(`keydown`, n),
        () => {
          (window.removeEventListener(`pointerdown`, t, !0), window.removeEventListener(`keydown`, n));
        }
      );
    }, [e]));
  let o = (t) => {
      (i.mediaPick(t), e());
    },
    s = `press flex h-8 w-full shrink-0 items-center gap-2 rounded-lg px-2 text-left hover:bg-white/8`;
  return (0, jsxRuntime.jsxs)(`div`, {
    ref: a,
    "data-media-sources": !0,
    className: `scroll-thin absolute inset-1.5 z-20 flex flex-col gap-0.5 overflow-y-auto rounded-xl bg-sheet p-1 ring-1 ring-white/10`,
    children: [
      (t ?? []).map((e, t) =>
        (0, jsxRuntime.jsxs)(
          `button`,
          {
            className: s,
            onClick: () => o(e.id),
            children: [
              (0, jsxRuntime.jsx)(`span`, {
                className: `grid size-4 shrink-0 place-items-center`,
                children: e.shown && (0, jsxRuntime.jsx)(we, { size: 13, className: `text-accent` }),
              }),
              (0, jsxRuntime.jsx)(`span`, {
                className: `max-w-[40%] shrink-0 truncate text-[10.5px] font-semibold tracking-wider text-ink-3 uppercase`,
                children: e.name || de(e.id),
              }),
              (0, jsxRuntime.jsx)(`span`, {
                className: `min-w-0 flex-1 truncate text-[12px] text-ink`,
                children: e.title || r(`Без названия`, `Untitled`),
              }),
              e.playing &&
                (0, jsxRuntime.jsx)(lp, { size: 10, fill: `currentColor`, className: `shrink-0 text-ink-3` }),
            ],
          },
          `${e.id}:${t}`,
        ),
      ),
      t?.some((e) => e.picked) &&
        (0, jsxRuntime.jsxs)(`button`, {
          className: `${s} text-[12px] text-ink-2`,
          onClick: () => o(null),
          children: [
            (0, jsxRuntime.jsx)(`span`, { className: `size-4 shrink-0` }),
            r(`Пусть остров выбирает сам`, `Let the island choose`),
          ],
        }),
      t?.length === 0 &&
        (0, jsxRuntime.jsx)(`div`, {
          className: `px-2 py-2 text-[12px] text-ink-3`,
          children: r(`Плееров не найдено`, `No players found`),
        }),
    ],
  });
}
function th() {
  let e = useIslandStore((e) => e.settings?.homePlayer ?? `soft`);
  return e === `compact` ? (0, jsxRuntime.jsx)(HomePlayer, {}) : (0, jsxRuntime.jsx)(rh, { look: e });
}
function nh({ cover: e, narrow: t }) {
  let n = `radial-gradient(closest-side, #000 22%, rgba(0,0,0,0.6) 50%, transparent 86%)`,
    [r, i, a] = t ? [360, 92, 104] : [560, 112, 124],
    o = (t) =>
      (0, jsxRuntime.jsx)(`img`, {
        src: e,
        alt: ``,
        draggable: !1,
        className: `absolute top-1/2 left-1/2 max-w-none -scale-x-100 object-cover`,
        style: {
          width: a,
          height: a,
          translate: `calc(-50% + ${t}px) -50%`,
          filter: `blur(20px) saturate(1.6) brightness(1.1)`,
        },
      });
  return (0, jsxRuntime.jsxs)(`div`, {
    "data-home-mirror": !0,
    className: `pointer-events-none absolute -top-[25px] left-1/2 -z-10 h-[170px] -translate-x-1/2`,
    style: { width: r, maskImage: n, WebkitMaskImage: n },
    children: [o(-i), o(i)],
  });
}
function rh({ look: e }) {
  let t = useIslandStore((e) => e.media),
    n = useIslandStore((e) => e.cover),
    i = useIslandStore((e) => e.accent),
    [a, o] = (0, ReactRuntime.useState)(!1),
    s = usePlaybackPosition(t),
    { pos: c } = s,
    l = i ?? `var(--color-ink)`,
    u = useIslandStore((e) => e.settings?.lyrics === !0 && e.settings.lyricsInHome !== !1),
    d = $((e) => e.status === `ready` && !!e.lyrics && !e.lyrics.instrumental),
    f = u && d,
    p = e === `fill` && !!n,
    m = e === `soft` && !!n,
    h =
      m && i
        ? `0 8px 30px color-mix(in srgb, ${i} 55%, transparent)`
        : `0 14px 34px rgba(0,0,0,0.5), 0 3px 10px rgba(0,0,0,0.3)`;
  return (0, jsxRuntime.jsxs)(`div`, {
    "data-home-player": e,
    className: `relative flex min-h-0 flex-1 overflow-hidden rounded-2xl bg-tile`,
    children: [
      p
        ? (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
            children: [
              (0, jsxRuntime.jsx)(`img`, {
                src: n,
                alt: ``,
                draggable: !1,
                className: `pointer-events-none absolute -inset-10 size-[calc(100%+80px)] max-w-none object-cover opacity-85 blur-2xl saturate-150`,
              }),
              (0, jsxRuntime.jsx)(`div`, {
                className: `pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 to-black/55`,
              }),
            ],
          })
        : m
          ? null
          : (0, jsxRuntime.jsx)(`div`, {
              className: `pointer-events-none absolute -top-16 -left-10 size-56 rounded-full opacity-30 blur-3xl transition-colors duration-700`,
              style: { background: l },
            }),
      (0, jsxRuntime.jsxs)(`div`, {
        className: `relative isolate flex min-w-0 flex-1 flex-col px-3.5 pt-3 pb-2.5`,
        children: [
          m && (0, jsxRuntime.jsx)(nh, { cover: n, narrow: f }),
          t.sources > 1 &&
            !a &&
            (0, jsxRuntime.jsxs)(`button`, {
              "data-media-choose": !0,
              title: r(
                `Играет не один плеер: выбрать, какой показывать`,
                `More than one player: choose which to show`,
              ),
              onClick: () => o(!0),
              className: `press tabular absolute top-2 right-2 z-10 flex h-6 items-center gap-1 rounded-full bg-white/10 px-2 text-[10.5px] font-semibold text-ink-2 hover:bg-white/16 hover:text-ink`,
              children: [(0, jsxRuntime.jsx)(qf, { size: 12 }), t.sources],
            }),
          (0, jsxRuntime.jsx)(`div`, {
            className: `relative flex h-[96px] shrink-0 items-center justify-center`,
            children: (0, jsxRuntime.jsx)(`div`, {
              className: `relative rounded-[14px]`,
              style: { boxShadow: h },
              children: (0, jsxRuntime.jsx)(kp, { size: 96, radius: 14 }),
            }),
          }),
          (0, jsxRuntime.jsx)(`div`, {
            className: `mt-2 truncate text-center text-[15px] leading-tight font-semibold text-ink`,
            children: t.title || r(`Без названия`, `Untitled`),
          }),
          (0, jsxRuntime.jsx)(`div`, {
            className: `truncate text-center text-[12.5px] text-ink-2`,
            children: t.artist,
          }),
          (0, jsxRuntime.jsxs)(`div`, {
            className: `mt-auto`,
            children: [
              t.durationMs > 0 && (0, jsxRuntime.jsx)(Am, { seek: s, tint: p ? `var(--color-ink)` : l }),
              (0, jsxRuntime.jsxs)(`div`, {
                className: `flex items-center`,
                children: [
                  (0, jsxRuntime.jsx)(`span`, {
                    className: `tabular w-10 text-[10.5px] text-ink-3`,
                    children: t.durationMs > 0 ? T(c) : ``,
                  }),
                  (0, jsxRuntime.jsx)(`div`, {
                    className: `flex flex-1 items-center justify-center gap-5`,
                    children: (0, jsxRuntime.jsx)(ih, { playing: t.playing }),
                  }),
                  (0, jsxRuntime.jsx)(`span`, {
                    className: `tabular w-10 text-right text-[10.5px] text-ink-3`,
                    children: t.durationMs > 0 ? T(t.durationMs) : ``,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      f &&
        (0, jsxRuntime.jsx)(`div`, {
          "data-home-lyrics": !0,
          className: `rise-in relative my-2 w-[150px] shrink-0 border-l border-white/[0.08] pr-2 pl-3`,
          children: (0, jsxRuntime.jsx)(LyricsPanel, {}),
        }),
      a && (0, jsxRuntime.jsx)(eh, { onClose: () => o(!1) }),
    ],
  });
}
function ih({ playing: e }) {
  return (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
    children: [
      (0, jsxRuntime.jsx)(`button`, {
        className: `press text-ink-2 hover:text-ink`,
        onClick: () => void i.mediaControl(`prev`),
        children: (0, jsxRuntime.jsx)(pp, { size: 18, fill: `currentColor` }),
      }),
      (0, jsxRuntime.jsx)(`button`, {
        "data-media-toggle": !0,
        className: `press grid size-9 place-items-center rounded-full bg-white text-black`,
        onClick: togglePlayback,
        children: e
          ? (0, jsxRuntime.jsx)(rp, { size: 18, fill: `currentColor` })
          : (0, jsxRuntime.jsx)(lp, { size: 18, fill: `currentColor`, className: `ml-0.5` }),
      }),
      (0, jsxRuntime.jsx)(`button`, {
        className: `press text-ink-2 hover:text-ink`,
        onClick: () => void i.mediaControl(`next`),
        children: (0, jsxRuntime.jsx)(hp, { size: 18, fill: `currentColor` }),
      }),
    ],
  });
}
function HomePlayer() {
  let e = useIslandStore((e) => e.media),
    t = useIslandStore((e) => e.accent),
    [n, a] = (0, ReactRuntime.useState)(!1),
    o = usePlaybackPosition(e),
    { pos: s } = o,
    c = t ?? `var(--color-ink)`,
    l = useIslandStore((e) => e.settings?.lyrics === !0 && e.settings.lyricsInHome !== !1),
    u = $((e) => e.status === `ready` && !!e.lyrics && !e.lyrics.instrumental),
    d = l && u;
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `relative flex min-h-0 flex-1 gap-3.5 overflow-hidden rounded-2xl bg-tile p-3`,
    children: [
      (0, jsxRuntime.jsx)(`div`, {
        className: `pointer-events-none absolute -top-16 -left-10 size-56 rounded-full opacity-30 blur-3xl transition-colors duration-700`,
        style: { background: c },
      }),
      n && (0, jsxRuntime.jsx)(eh, { onClose: () => a(!1) }),
      (0, jsxRuntime.jsx)(kp, {
        size: d ? 64 : 88,
        radius: d ? 12 : 14,
        className: `relative shadow-lg shadow-neutral-950/40`,
      }),
      (0, jsxRuntime.jsxs)(`div`, {
        className: `relative flex min-w-0 flex-1 flex-col`,
        children: [
          (0, jsxRuntime.jsxs)(`div`, {
            className: `flex min-w-0 items-center gap-1`,
            children: [
              (0, jsxRuntime.jsx)(`div`, {
                className: `min-w-0 flex-1`,
                children: (0, jsxRuntime.jsx)($m, { appId: e.app, name: e.appName || de(e.app) }),
              }),
              e.sources > 1 &&
                (0, jsxRuntime.jsxs)(`button`, {
                  "data-media-choose": !0,
                  title: r(
                    `Играет не один плеер: выбрать, какой показывать`,
                    `More than one player: choose which to show`,
                  ),
                  onClick: () => a(!0),
                  className: `press tabular -mt-1 -mr-1 flex h-6 shrink-0 items-center gap-1 rounded-full bg-white/8 px-2 text-[10.5px] font-semibold text-ink-2 hover:bg-white/14 hover:text-ink`,
                  children: [(0, jsxRuntime.jsx)(qf, { size: 12 }), e.sources],
                }),
            ],
          }),
          (0, jsxRuntime.jsx)(`div`, {
            className: `truncate text-[15px] leading-tight font-semibold text-ink`,
            children: e.title || r(`Без названия`, `Untitled`),
          }),
          (0, jsxRuntime.jsx)(`div`, { className: `truncate text-[12.5px] text-ink-2`, children: e.artist }),
          (0, jsxRuntime.jsxs)(`div`, {
            className: `mt-auto`,
            children: [
              e.durationMs > 0 &&
                (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
                  children: [
                    (0, jsxRuntime.jsx)(Am, { seek: o, tint: c }),
                    (0, jsxRuntime.jsxs)(`div`, {
                      className: `tabular flex justify-between text-[10.5px] text-ink-3`,
                      children: [
                        (0, jsxRuntime.jsx)(`span`, { children: T(s) }),
                        (0, jsxRuntime.jsxs)(`span`, { children: [`-`, T(e.durationMs - s)] }),
                      ],
                    }),
                  ],
                }),
              (0, jsxRuntime.jsxs)(`div`, {
                className: `mt-0.5 flex items-center justify-center gap-5`,
                children: [
                  (0, jsxRuntime.jsx)(`button`, {
                    className: `press text-ink-2 hover:text-ink`,
                    onClick: () => void i.mediaControl(`prev`),
                    children: (0, jsxRuntime.jsx)(pp, { size: 18, fill: `currentColor` }),
                  }),
                  (0, jsxRuntime.jsx)(`button`, {
                    "data-media-toggle": !0,
                    className: `press grid size-9 place-items-center rounded-full bg-white text-black`,
                    onClick: togglePlayback,
                    children: e.playing
                      ? (0, jsxRuntime.jsx)(rp, { size: 18, fill: `currentColor` })
                      : (0, jsxRuntime.jsx)(lp, { size: 18, fill: `currentColor`, className: `ml-0.5` }),
                  }),
                  (0, jsxRuntime.jsx)(`button`, {
                    className: `press text-ink-2 hover:text-ink`,
                    onClick: () => void i.mediaControl(`next`),
                    children: (0, jsxRuntime.jsx)(hp, { size: 18, fill: `currentColor` }),
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      d &&
        (0, jsxRuntime.jsx)(`div`, {
          "data-home-lyrics": !0,
          className: `rise-in relative -my-1 w-[150px] shrink-0 border-l border-white/[0.08] pl-3`,
          children: (0, jsxRuntime.jsx)(LyricsPanel, {}),
        }),
    ],
  });
}
function oh({
  icon: e,
  label: t,
  accel: n,
  onClick: r,
  pro: a = !1,
  folder: o,
  tall: s = !1,
  mark: c,
  span: l = 1,
}) {
  let u = useIslandStore((e) => a && !e.license.pro);
  return (0, jsxRuntime.jsxs)(`button`, {
    "data-home-tile": c,
    style: l > 1 ? { gridColumn: `span ${l}` } : void 0,
    onClick: r,
    title: n ? `${t} · ${n}` : t,
    className: `press group relative flex min-h-0 rounded-xl bg-tile hover:bg-tile-hover ${s ? `flex-col items-center justify-center gap-2 px-2 text-center` : `items-center gap-2 px-2.5 text-left`}`,
    children: [
      o &&
        !u &&
        (0, jsxRuntime.jsx)(`span`, {
          role: `button`,
          title: o.title,
          onClick: (e) => {
            (e.stopPropagation(), useIslandStore.getState().close(), i.openCaptures(o.kind));
          },
          className: `absolute -top-1.5 -right-1.5 grid size-[18px] place-items-center rounded-full bg-island text-ink-2 opacity-0 ring-1 ring-line transition-opacity group-hover:opacity-100 hover:text-ink`,
          children: (0, jsxRuntime.jsx)(Vf, { size: 10 }),
        }),
      (0, jsxRuntime.jsx)(`span`, {
        className: `shrink-0 text-ink-2 ${s ? `[&>svg]:size-[22px]` : ``}`,
        children: e,
      }),
      (0, jsxRuntime.jsx)(`span`, {
        className: `line-clamp-2 leading-tight font-medium text-ink ${s ? `text-[12.5px]` : `text-[11.5px]`}`,
        children: t,
      }),
      u &&
        (0, jsxRuntime.jsx)(`span`, {
          className: `absolute top-1 right-1.5 rounded bg-[#8ea2ff]/20 px-1 text-[9px] leading-[13px] font-semibold text-accent-ink`,
          children: `Pro`,
        }),
    ],
  });
}
function sh({ tall: e = !1, span: t = 1 }) {
  let n = useIslandStore((e) => e.settings?.hotkeyRecord),
    a = useIslandStore((e) => e.recording);
  if ((Mp(a !== null, 500), !a))
    return (0, jsxRuntime.jsx)(oh, {
      mark: `record`,
      tall: e,
      span: t,
      icon: (0, jsxRuntime.jsx)(ee, { size: 17 }),
      label: r(`Запись экрана`, `Record screen`),
      accel: n,
      pro: !0,
      folder: { title: r(`Папка с записями экрана`, `Screen recordings folder`), kind: `recordings` },
      onClick: () => {
        (useIslandStore.getState().close(), Pm(() => void i.recordStart()));
      },
    });
  let o = r(`Остановить запись`, `Stop recording`);
  return (0, jsxRuntime.jsxs)(`button`, {
    "data-record-stop": !0,
    onClick: () => {
      (useIslandStore.getState().close(), i.recordStop());
    },
    title: n ? `${o} · ${n}` : o,
    style: t > 1 ? { gridColumn: `span ${t}` } : void 0,
    className: `press relative flex min-h-0 items-center gap-2 rounded-xl bg-[#ff453a]/20 px-2.5 text-left hover:bg-[#ff453a]/30 ${e ? `justify-center` : ``}`,
    children: [
      (0, jsxRuntime.jsx)(`span`, {
        className: `shrink-0 text-[#ff453a]`,
        children: (0, jsxRuntime.jsx)(Te, { size: 15, fill: `currentColor` }),
      }),
      (0, jsxRuntime.jsxs)(`span`, {
        className: `text-[11.5px] leading-tight font-medium text-ink`,
        children: [
          r(`Стоп`, `Stop`),
          (0, jsxRuntime.jsx)(`span`, {
            className: `tabular block text-[10.5px] text-rec-ink`,
            children: T(Date.now() - a.startedAt),
          }),
        ],
      }),
    ],
  });
}
function ch() {
  let e = useIslandStore.getState();
  (i.clipCurrentText().then((t) => {
    if (!t)
      return e.pushPeek({
        kind: `error`,
        message: r(`В буфере нет текста`, `There's no text on the clipboard`),
      });
    i.clipSetText(t).then(() =>
      e.pushPeek({
        kind: `done`,
        label: r(`Оформление убрано, в буфере чистый текст`, `Formatting removed, plain text copied`),
      }),
    );
  }),
    e.close());
}
function lh({ item: e, small: t = !1 }) {
  return e.icon
    ? (0, jsxRuntime.jsx)(`img`, {
        src: e.icon,
        alt: ``,
        draggable: !1,
        className: t ? `size-[15px]` : `size-8`,
      })
    : fe(e.path)
      ? (0, jsxRuntime.jsx)(Uf, { size: t ? 11 : 20, className: `text-accent-ink` })
      : (0, jsxRuntime.jsx)(`span`, {
          className: `font-semibold text-ink-2 ${t ? `text-[9px]` : `text-[15px]`}`,
          children: e.name.slice(0, 1),
        });
}
function uh(e, t) {
  (i
    .launcherLaunch(e.id)
    .catch((e) => useIslandStore.getState().pushPeek({ kind: `error`, message: String(e) })),
    t && !matchMedia(`(prefers-reduced-motion: reduce)`).matches
      ? (t.animate(
          [
            { transform: `scale(1)` },
            { transform: `scale(0.84)` },
            { transform: `scale(1.07)` },
            { transform: `scale(1)` },
          ],
          { duration: 300, easing: `cubic-bezier(0.3, 1.4, 0.5, 1)` },
        ),
        setTimeout(() => useIslandStore.getState().close(), 170))
      : useIslandStore.getState().close());
}
function dh(e) {
  if (!fe(e)) return !1;
  let t = /^https?:\/\/([^/?#:@]+)/i.exec(e);
  return t ? t[1] === `localhost` || /\.[\p{L}]{2,}$/u.test(t[1]) : !/^https?:/i.test(e);
}
var fh = 6;
function Launcher() {
  let e = useIslandStore((e) => e.launcher),
    [t, n] = (0, ReactRuntime.useState)([]),
    [a, o] = (0, ReactRuntime.useState)(null),
    [s, c] = (0, ReactRuntime.useState)(null),
    [l, u] = (0, ReactRuntime.useState)(null),
    [d, f] = (0, ReactRuntime.useState)(null),
    [p, m] = (0, ReactRuntime.useState)(null),
    h = (0, ReactRuntime.useRef)(null),
    g = (0, ReactRuntime.useRef)(!1),
    _ = (0, ReactRuntime.useRef)(!1),
    v = (0, ReactRuntime.useRef)(null),
    y = (0, ReactRuntime.useRef)(null),
    b = (0, ReactRuntime.useRef)(null),
    x = () => {
      let e = v.current;
      if (!e) return;
      let t = (t, n) => {
          if (!t || !n) return;
          let [r, i] = [e.getBoundingClientRect(), n.getBoundingClientRect()],
            a = Math.min(
              Math.max(i.left + i.width / 2 - r.left - t.offsetWidth / 2, 0),
              Math.max(r.width - t.offsetWidth, 0),
            );
          t.style.left = `${Math.round(a)}px`;
        },
        n = y.current;
      n &&
        t(
          n,
          [...e.querySelectorAll(`[data-launcher-slot]`)].find(
            (e) => e.dataset.launcherSlot === `group:${n.dataset.launcherGroup}`,
          ),
        );
      let r = b.current?.dataset.launcherEdit;
      t(
        b.current,
        (r && e.querySelector(`[data-launcher-slot="item:${r}"]`)) || e.querySelector(`[data-launcher-plus]`),
      );
    };
  (0, ReactRuntime.useLayoutEffect)(x);
  let S = p?.auto ? p.link.trim() : ``;
  ((0, ReactRuntime.useEffect)(() => {
    if (!S || !dh(S)) {
      m((e) => (e?.looking ? { ...e, looking: !1 } : e));
      return;
    }
    let e = !1;
    m((e) => e && { ...e, looking: !0 });
    let t = setTimeout(() => {
      i.launcherLinkIcon(S)
        .catch(() => null)
        .then((t) => {
          e || m((e) => (e && e.auto && e.link.trim() === S ? { ...e, picture: t, looking: !1 } : e));
        });
    }, 700);
    return () => {
      ((e = !0), clearTimeout(t));
    };
  }, [S]),
    (0, ReactRuntime.useEffect)(
      () => (
        i
          .launcherGroupsGet()
          .then((e) => n(vm(e)))
          .catch(() => {})
          .finally(() => {
            _.current = !0;
          }),
        () => useIslandStore.getState().setHoldOpen(!1)
      ),
      [],
    ));
  let C = (e) => {
      if (!_.current) return;
      let t = xm(e, useIslandStore.getState().launcher);
      (n(t), i.launcherGroupsSet(ym(t)).catch(() => {}));
    },
    ee = Sm(e, t),
    te = a === null ? null : ee.find((e) => e.kind === `group` && e.group.id === a),
    w = te && te.kind === `group` ? te : null,
    ne = (e, t, n) => {
      for (let r of document.elementsFromPoint(e, t)) {
        let e = r.dataset?.launcherSlot;
        if (e && e !== `item:${n}`) return e;
      }
      return null;
    },
    re = (e, t) => {
      if (e.button === 0) {
        ((g.current = !1), (h.current = { item: t, x: e.clientX, y: e.clientY }));
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
      }
    },
    ie = (e) => {
      let t = h.current;
      if (t) {
        if (!g.current) {
          if (Math.hypot(e.clientX - t.x, e.clientY - t.y) < fh) return;
          ((g.current = !0), useIslandStore.getState().setHoldOpen(!0));
        }
        c({ item: t.item, x: e.clientX, y: e.clientY, over: ne(e.clientX, e.clientY, t.item.id) });
      }
    },
    ae = (e) => {
      let n = h.current;
      if (((h.current = null), !n || !g.current)) return;
      (useIslandStore.getState().setHoldOpen(!1), c(null));
      let i = ne(e.clientX, e.clientY, n.item.id);
      if (!i) return;
      let [a, o] = [i.slice(0, i.indexOf(`:`)), i.slice(i.indexOf(`:`) + 1)];
      a === `group`
        ? C(Tm(t, o, n.item.id))
        : a === `item`
          ? C(wm(t, n.item.id, Number(o), r(`Группа`, `Group`), `g${Date.now().toString(36)}`))
          : a === `row` && C(Em(t, n.item.id));
    },
    oe = () => {
      ((h.current = null), g.current && useIslandStore.getState().setHoldOpen(!1), c(null));
    },
    se = (e, t) => {
      g.current || uh(e, t);
    },
    T = (e) => ({
      onPointerDown: (t) => re(t, e),
      onPointerMove: ie,
      onPointerUp: ae,
      onPointerCancel: oe,
      onClick: (t) => se(e, t.currentTarget),
    }),
    ce = () => {
      (m(null), useIslandStore.getState().setHoldOpen(!1));
    },
    le = () => {
      if (!p || !p.link.trim() || p.saving) return;
      let e = p,
        t = e.auto
          ? e.picture && !e.looking
            ? { kind: `picture`, data: e.picture }
            : { kind: `auto` }
          : e.picture === null
            ? { kind: `plain` }
            : e.picture === e.had
              ? { kind: `keep` }
              : { kind: `picture`, data: e.picture };
      (m({ ...e, saving: !0, bad: null }),
        (e.id === null ? i.launcherAddLink(e.link, e.name, t) : i.launcherEditLink(e.id, e.link, e.name, t))
          .then((e) => {
            (useIslandStore.setState({ launcher: e }), ce());
          })
          .catch((e) => m((t) => t && { ...t, saving: !1, bad: String(e) })));
    },
    ue = () => ({
      id: null,
      link: ``,
      name: ``,
      bad: null,
      auto: !0,
      picture: null,
      had: null,
      looking: !1,
      saving: !1,
    }),
    de = (e, t) => {
      fe(t.path) &&
        (e.preventDefault(),
        i.takeFocus(),
        useIslandStore.getState().setHoldOpen(!0),
        o(null),
        m({
          id: t.id,
          link: t.path,
          name: t.name,
          bad: null,
          auto: !1,
          picture: t.icon,
          had: t.icon,
          looking: !1,
          saving: !1,
        }));
    },
    pe = () => {
      (useIslandStore.setState({ asking: !0 }),
        i
          .launcherPickIcon()
          .then((e) => {
            e && m((t) => t && { ...t, auto: !1, picture: e, bad: null });
          })
          .catch((e) => m((t) => t && { ...t, bad: String(e) }))
          .finally(() => useIslandStore.setState({ asking: !1 })));
    },
    me = (e) => {
      (e.key === `Enter` && le(), e.key === `Escape` && (e.stopPropagation(), ce()));
    },
    he = `h-8 rounded-lg bg-white/[0.07] px-2.5 text-[12px] text-ink outline-none placeholder:text-ink-3 focus:bg-white/[0.11]`,
    ge = `press grid size-[46px] shrink-0 touch-none place-items-center rounded-xl hover:bg-tile-hover`,
    _e = `bg-white/16 ring-1 ring-white/40`;
  return (0, jsxRuntime.jsxs)(`div`, {
    ref: v,
    "data-launcher": !0,
    className: `relative col-span-2`,
    children: [
      w &&
        (0, jsxRuntime.jsxs)(`div`, {
          ref: y,
          "data-launcher-group": w.group.id,
          className: `absolute bottom-[calc(100%+6px)] z-10 max-w-full rounded-2xl bg-sheet p-2 shadow-2xl ring-1 ring-white/10`,
          children: [
            (0, jsxRuntime.jsxs)(`div`, {
              className: `flex items-center gap-1 pb-1 pl-1.5`,
              children: [
                d === w.group.id
                  ? (0, jsxRuntime.jsx)(`input`, {
                      autoFocus: !0,
                      defaultValue: w.group.name,
                      maxLength: 24,
                      spellCheck: !1,
                      onBlur: (e) => {
                        (C(Om(t, w.group.id, e.target.value)), f(null));
                      },
                      onKeyDown: (e) => {
                        (e.key === `Enter` || e.key === `Escape`) &&
                          (e.stopPropagation(), e.currentTarget.blur());
                      },
                      className: `h-6 min-w-0 flex-1 rounded-md bg-white/[0.08] px-1.5 text-[12px] font-semibold text-ink outline-none`,
                    })
                  : (0, jsxRuntime.jsx)(`button`, {
                      title: r(`Переименовать группу`, `Rename the group`),
                      onClick: () => {
                        (i.takeFocus(), f(w.group.id));
                      },
                      className: `min-w-0 flex-1 truncate rounded-md px-0 text-left text-[12px] font-semibold text-ink-2 hover:text-ink`,
                      children: w.group.name || r(`Группа`, `Group`),
                    }),
                (0, jsxRuntime.jsx)(`button`, {
                  title: r(
                    `Разгруппировать: ярлыки вернутся в ряд`,
                    `Ungroup: the shortcuts go back into the row`,
                  ),
                  onClick: () => {
                    (C(Dm(t, w.group.id)), o(null));
                  },
                  className: `press grid size-6 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-white/8 hover:text-ink`,
                  children: (0, jsxRuntime.jsx)(xp, { size: 13 }),
                }),
                (0, jsxRuntime.jsx)(`button`, {
                  title: r(`Закрыть`, `Close`),
                  onClick: () => o(null),
                  className: `press grid size-6 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-white/8 hover:text-ink`,
                  children: (0, jsxRuntime.jsx)(Ee, { size: 13 }),
                }),
              ],
            }),
            (0, jsxRuntime.jsx)(`div`, {
              className: `scroll-thin flex max-h-[154px] max-w-[420px] flex-wrap gap-1 overflow-y-auto pt-1 pr-1`,
              children: w.items.map((e) =>
                (0, jsxRuntime.jsxs)(
                  `div`,
                  {
                    className: `relative`,
                    onMouseEnter: () => u(e.id),
                    onMouseLeave: () => u(null),
                    children: [
                      (0, jsxRuntime.jsx)(`button`, {
                        title: e.name,
                        className: ge,
                        onClick: (t) => uh(e, t.currentTarget),
                        onContextMenu: (t) => de(t, e),
                        children: (0, jsxRuntime.jsx)(lh, { item: e }),
                      }),
                      l === e.id &&
                        (0, jsxRuntime.jsx)(`button`, {
                          title: r(`Вынуть из группы`, `Take out of the group`),
                          className: `press absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-neutral-700 text-[#fff] hover:bg-accent`,
                          onClick: () => C(Em(t, e.id)),
                          children: (0, jsxRuntime.jsx)(Zf, { size: 9, strokeWidth: 3 }),
                        }),
                    ],
                  },
                  e.id,
                ),
              ),
            }),
          ],
        }),
      p &&
        (0, jsxRuntime.jsxs)(`div`, {
          ref: b,
          "data-launcher-add": !0,
          "data-launcher-edit": p.id ?? void 0,
          className: `absolute bottom-[calc(100%+6px)] left-0 z-10 flex w-[300px] flex-col gap-1.5 rounded-2xl bg-sheet p-2.5 shadow-2xl ring-1 ring-white/10`,
          children: [
            (0, jsxRuntime.jsx)(`div`, {
              className: `px-0.5 text-[12px] font-semibold text-ink-2`,
              children:
                p.id === null
                  ? r(`Ссылка в лаунчер`, `A link for the launcher`)
                  : r(`Изменить ссылку`, `Change the link`),
            }),
            (0, jsxRuntime.jsx)(`input`, {
              autoFocus: !0,
              value: p.link,
              onChange: (e) =>
                m({ ...p, link: e.target.value, bad: null, picture: p.auto ? null : p.picture }),
              onMouseDown: () => void i.takeFocus(),
              onKeyDown: me,
              spellCheck: !1,
              placeholder: `https://…, steam://run/730`,
              className: `${he} ${p.bad ? `ring-1 ring-danger/70` : ``}`,
            }),
            (0, jsxRuntime.jsx)(`input`, {
              value: p.name,
              maxLength: 40,
              onChange: (e) => m({ ...p, name: e.target.value }),
              onMouseDown: () => void i.takeFocus(),
              onKeyDown: me,
              placeholder: r(`Название (необязательно)`, `Name (optional)`),
              className: he,
            }),
            (0, jsxRuntime.jsxs)(`div`, {
              className: `flex items-center gap-2 pt-0.5`,
              children: [
                (0, jsxRuntime.jsx)(`span`, {
                  "data-launcher-add-icon": !0,
                  className: `grid size-9 shrink-0 place-items-center rounded-lg bg-white/[0.07]`,
                  children: p.looking
                    ? (0, jsxRuntime.jsx)(Yf, { size: 15, className: `animate-spin text-ink-3` })
                    : p.picture
                      ? (0, jsxRuntime.jsx)(`img`, {
                          src: p.picture,
                          alt: ``,
                          draggable: !1,
                          className: `size-7`,
                        })
                      : (0, jsxRuntime.jsx)(Uf, { size: 17, className: `text-accent-ink` }),
                }),
                (0, jsxRuntime.jsxs)(`div`, {
                  className: `flex min-w-0 flex-1 flex-col gap-1`,
                  children: [
                    (0, jsxRuntime.jsxs)(`button`, {
                      role: `switch`,
                      "aria-checked": p.auto,
                      "data-launcher-add-auto": !0,
                      onClick: () => m({ ...p, auto: !p.auto, picture: p.auto ? p.had : null, bad: null }),
                      className: `flex items-center justify-between gap-2 text-left text-[11.5px] text-ink-2 hover:text-ink`,
                      children: [
                        r(`Значок сам: сайта или программы`, `The icon by itself: the site's or the app's`),
                        (0, jsxRuntime.jsx)(`span`, {
                          className: `relative h-[16px] w-[28px] shrink-0 rounded-full transition-colors ${p.auto ? `bg-accent` : `bg-white/20`}`,
                          children: (0, jsxRuntime.jsx)(`span`, {
                            className: `absolute top-[2px] size-3 rounded-full bg-[#fff] transition-[left] ${p.auto ? `left-[14px]` : `left-[2px]`}`,
                          }),
                        }),
                      ],
                    }),
                    (0, jsxRuntime.jsxs)(`div`, {
                      className: `flex items-center gap-1 ${p.auto ? `pointer-events-none opacity-40` : ``}`,
                      children: [
                        (0, jsxRuntime.jsx)(`button`, {
                          "data-launcher-add-pick": !0,
                          disabled: p.auto,
                          onClick: pe,
                          className: `press h-6 min-w-0 flex-1 truncate rounded-md bg-white/[0.07] px-2 text-left text-[11px] text-ink-2 hover:bg-white/[0.11] hover:text-ink`,
                          children: r(`Выбрать картинку или программу…`, `Choose a picture or an app…`),
                        }),
                        !p.auto &&
                          p.picture &&
                          (0, jsxRuntime.jsx)(`button`, {
                            title: r(`Без значка`, `No icon`),
                            onClick: () => m({ ...p, picture: null }),
                            className: `press grid size-6 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-white/8 hover:text-ink`,
                            children: (0, jsxRuntime.jsx)(Ee, { size: 12 }),
                          }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            (0, jsxRuntime.jsx)(`span`, {
              "data-launcher-add-note": !0,
              className: `px-0.5 text-[10.5px] leading-snug ${p.bad ? `text-danger` : `text-ink-3`}`,
              children:
                p.bad ?? r(`Сайт или команда другой программы`, `A site, or a command of another program`),
            }),
            (0, jsxRuntime.jsxs)(`div`, {
              className: `flex items-center justify-end gap-1.5`,
              children: [
                (0, jsxRuntime.jsx)(`button`, {
                  onClick: ce,
                  className: `press h-7 shrink-0 rounded-full px-2.5 text-[11.5px] font-medium text-ink-2 hover:bg-white/8 hover:text-ink`,
                  children: r(`Отмена`, `Cancel`),
                }),
                (0, jsxRuntime.jsx)(`button`, {
                  "data-launcher-add-ok": !0,
                  onClick: le,
                  disabled: p.saving,
                  className: `press h-7 shrink-0 rounded-full bg-white px-3 text-[11.5px] font-semibold text-black ${p.saving ? `opacity-60` : ``}`,
                  children: p.saving
                    ? r(`Сохраняю…`, `Saving…`)
                    : p.id === null
                      ? r(`Добавить`, `Add`)
                      : r(`Сохранить`, `Save`),
                }),
              ],
            }),
          ],
        }),
      (0, jsxRuntime.jsxs)(`div`, {
        "data-launcher-slot": `row:`,
        onScroll: x,
        className: `scroll-thin flex h-[54px] items-center gap-1 overflow-x-auto rounded-2xl bg-tile px-1.5`,
        children: [
          ee.map((e) =>
            e.kind === `group`
              ? (0, jsxRuntime.jsx)(
                  `button`,
                  {
                    "data-launcher-slot": `group:${e.group.id}`,
                    title: `${e.group.name || r(`Группа`, `Group`)}: ${e.items.map((e) => e.name).join(`, `)}`,
                    onClick: () => o(a === e.group.id ? null : e.group.id),
                    className: `${ge} ${a === e.group.id ? `bg-tile-hover` : ``} ${s?.over === `group:${e.group.id}` ? _e : ``}`,
                    children: (0, jsxRuntime.jsx)(`span`, {
                      className: `grid size-9 grid-cols-2 place-items-center gap-0.5 rounded-[10px] bg-white/10 p-1`,
                      children: e.items
                        .slice(0, 4)
                        .map((e) => (0, jsxRuntime.jsx)(lh, { item: e, small: !0 }, e.id)),
                    }),
                  },
                  `g:${e.group.id}`,
                )
              : (0, jsxRuntime.jsxs)(
                  `div`,
                  {
                    className: `relative shrink-0`,
                    onMouseEnter: () => u(e.item.id),
                    onMouseLeave: () => u(null),
                    children: [
                      (0, jsxRuntime.jsx)(`button`, {
                        "data-launcher-slot": `item:${e.item.id}`,
                        title: e.item.name,
                        className: `${ge} ${s?.item.id === e.item.id ? `opacity-35` : ``} ${s?.over === `item:${e.item.id}` ? _e : ``}`,
                        ...T(e.item),
                        onContextMenu: (t) => de(t, e.item),
                        children: (0, jsxRuntime.jsx)(lh, { item: e.item }),
                      }),
                      l === e.item.id &&
                        !s &&
                        (0, jsxRuntime.jsx)(`button`, {
                          title: r(`Убрать из лаунчера`, `Remove from the launcher`),
                          className: `press absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-neutral-700 text-[#fff] hover:bg-danger`,
                          onClick: () =>
                            void i.launcherRemove(e.item.id).then((e) => {
                              (useIslandStore.setState({ launcher: e }), C(t));
                            }),
                          children: (0, jsxRuntime.jsx)(Ee, { size: 10, strokeWidth: 3 }),
                        }),
                    ],
                  },
                  e.item.id,
                ),
          ),
          (0, jsxRuntime.jsx)(`button`, {
            "data-launcher-plus": !0,
            title: r(
              `Нажми, чтобы добавить ссылку (изменить её потом — правым кликом). Ярлык, программу или папку перетащи на остров, в правую половину; ярлык, перетащенный на другой ярлык, объединяется с ним в группу`,
              `Press to add a link (to change it later, right-click it). Drag a shortcut, app or folder onto the right half of the island; a shortcut dragged onto another one makes a group with it`,
            ),
            onClick: () => {
              if (p) return ce();
              (i.takeFocus(), useIslandStore.getState().setHoldOpen(!0), o(null), m(ue()));
            },
            className: `press grid size-[46px] shrink-0 place-items-center rounded-xl border border-dashed border-white/15 text-ink-3 hover:border-white/30 hover:text-ink-2 ${p ? `border-white/30 text-ink-2` : ``}`,
            children: (0, jsxRuntime.jsx)(dp, { size: 18 }),
          }),
          e.length === 0 &&
            (0, jsxRuntime.jsx)(`span`, {
              className: `pl-2 text-[12px] text-ink-3`,
              children: r(
                `Перетащи сюда ярлыки программ, папки или файлы`,
                `Drop app shortcuts, folders or files here`,
              ),
            }),
        ],
      }),
      s &&
        (0, jsxRuntime.jsx)(`div`, {
          "data-launcher-ghost": !0,
          className: `pointer-events-none fixed z-20 grid size-[46px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl bg-white/10`,
          style: { left: s.x, top: s.y },
          children: (0, jsxRuntime.jsx)(lh, { item: s.item }),
        }),
    ],
  });
}
function mh(e) {
  (useIslandStore.getState().close(), Pm(() => void i.captureStart(e)));
}
function hh() {
  return (0, jsxRuntime.jsxs)(`div`, {
    "data-home-quiet": !0,
    className: `flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-2xl bg-tile text-ink-3`,
    children: [
      (0, jsxRuntime.jsx)(S, { size: 22 }),
      (0, jsxRuntime.jsx)(`span`, {
        className: `text-[12px]`,
        children: r(`Сейчас ничего не играет`, `Nothing plays right now`),
      }),
    ],
  });
}
function gh({ id: e, tall: t, span: n }) {
  let i = useIslandStore((e) => e.settings),
    a = { mark: e, tall: t, span: n };
  switch (e) {
    case `area`:
      return (0, jsxRuntime.jsx)(oh, {
        ...a,
        icon: (0, jsxRuntime.jsx)(w, { size: 17 }),
        label: r(`Область`, `Area`),
        accel: i?.hotkeyArea,
        onClick: () => mh(`area`),
      });
    case `screen`:
      return (0, jsxRuntime.jsx)(oh, {
        ...a,
        icon: (0, jsxRuntime.jsx)(se, { size: 17 }),
        label: r(`Весь экран`, `Full screen`),
        accel: i?.hotkeyScreen,
        onClick: () => mh(`screen`),
        folder: { title: r(`Папка со скриншотами`, `Screenshots folder`), kind: `screenshots` },
      });
    case `ocr`:
      return (0, jsxRuntime.jsx)(oh, {
        ...a,
        icon: (0, jsxRuntime.jsx)(b, { size: 17 }),
        label: r(`Текст с экрана`, `Screen text`),
        accel: i?.hotkeyOcr,
        onClick: () => mh(`ocr`),
        pro: !0,
      });
    case `qr`:
      return (0, jsxRuntime.jsx)(oh, {
        ...a,
        icon: (0, jsxRuntime.jsx)(ae, { size: 17 }),
        label: r(`QR-код`, `QR code`),
        accel: i?.hotkeyQr,
        onClick: () => mh(`qr`),
      });
    case `color`:
      return (0, jsxRuntime.jsx)(oh, {
        ...a,
        icon: (0, jsxRuntime.jsx)(C, { size: 17 }),
        label: r(`Пипетка`, `Color picker`),
        accel: i?.hotkeyColor,
        onClick: () => mh(`color`),
      });
    case `plain`:
      return (0, jsxRuntime.jsx)(oh, {
        ...a,
        icon: (0, jsxRuntime.jsx)(he, { size: 17 }),
        label: r(`Чистый текст`, `Plain text`),
        accel: i?.hotkeyPlainPaste,
        onClick: ch,
      });
    case `record`:
      return (0, jsxRuntime.jsx)(sh, { tall: t, span: n });
    case `command`:
      return (0, jsxRuntime.jsx)(oh, {
        ...a,
        icon: (0, jsxRuntime.jsx)(ie, { size: 17 }),
        label: r(`Команда`, `Command`),
        accel: i?.hotkeyPalette,
        onClick: () => useIslandStore.getState().openPalette(),
      });
  }
}
function Home() {
  let e = useIslandStore((e) => e.settings),
    t = useIslandStore((e) => e.media !== null),
    n = ce(e?.homeHidden, {
      media: t,
      mediaModule: e?.moduleMedia !== !1,
      launcherModule: e?.moduleLauncher !== !1,
    });
  if (n.empty)
    return (0, jsxRuntime.jsxs)(`div`, {
      "data-home-empty": !0,
      className: `flex h-full flex-col items-center justify-center gap-3 text-center text-[12.5px] text-ink-3`,
      children: [
        r(`На «Главной» ничего не оставлено`, `Nothing is kept on Home`),
        (0, jsxRuntime.jsx)(`button`, {
          className: `press rounded-lg bg-white/10 px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-white/15`,
          onClick: () => void i.openSettings(`modules`),
          children: r(`Выбрать в настройках`, `Choose in the settings`),
        }),
      ],
    });
  let a = me(n, (e?.homePlayer ?? `soft`) !== `compact`),
    o = ge(n),
    s =
      n.cols > 0 &&
      (0, jsxRuntime.jsx)(`div`, {
        "data-home-tiles": !0,
        className: `grid h-full min-h-0 gap-1.5`,
        style: {
          gridTemplateColumns: `repeat(${n.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${n.rows}, minmax(0, 1fr))`,
        },
        children: n.tiles.map((e, t) =>
          (0, jsxRuntime.jsx)(gh, { id: e, tall: a, span: t === n.tiles.length - 1 ? o : 1 }, e),
        ),
      }),
    c =
      n.main === `player`
        ? (0, jsxRuntime.jsx)(th, {})
        : n.main === `clips`
          ? (0, jsxRuntime.jsx)(Qm, {})
          : n.main === `quiet`
            ? (0, jsxRuntime.jsx)(hh, {})
            : null;
  return (0, jsxRuntime.jsxs)(`div`, {
    "data-home": n.main ? (n.aside ? `aside` : `main`) : `tiles`,
    className: `flex h-full min-h-0 flex-col gap-2.5`,
    children: [
      n.main
        ? (0, jsxRuntime.jsxs)(`div`, {
            className: `flex min-h-0 flex-1 gap-2.5`,
            children: [
              (0, jsxRuntime.jsxs)(`div`, {
                className: `flex min-h-0 min-w-0 flex-1 flex-col gap-2`,
                children: [c, n.volume && (0, jsxRuntime.jsx)(Zm, {})],
              }),
              s &&
                (0, jsxRuntime.jsx)(`div`, {
                  className: `min-h-0 shrink-0`,
                  style: { width: n.cols === 2 ? ve.aside2 : ve.aside1 },
                  children: s,
                }),
            ],
          })
        : (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
            children: [
              s && (0, jsxRuntime.jsx)(`div`, { className: `min-h-0 flex-1`, children: s }),
              n.volumeRow && (0, jsxRuntime.jsx)(Zm, {}),
            ],
          }),
      n.launcher && (0, jsxRuntime.jsx)(Launcher, {}),
    ],
  });
}
export {
  rf as $,
  Me as $t,
  sp as A,
  Fi as At,
  hf as B,
  Kn as Bt,
  Op as C,
  xa as Ct,
  yp as D,
  Gi as Dt,
  Cp as E,
  Qi as Et,
  Vf as F,
  Pr as Ft,
  Zd as G,
  N as Gt,
  qd as H,
  Mn as Ht,
  jf as I,
  vr as It,
  of as J,
  j as Jt,
  Yd as K,
  st as Kt,
  kf as L,
  _r as Lt,
  $f as M,
  ei as Mt,
  Yf as N,
  Ir as Nt,
  dp as O,
  Pi as Ot,
  Gf as P,
  Lr as Pt,
  sf as Q,
  Ne as Qt,
  gf as R,
  Jn as Rt,
  Np as S,
  Ca as St,
  Tp as T,
  W as Tt,
  $d as U,
  H as Ut,
  Qd as V,
  Un as Vt,
  Jd as W,
  P as Wt,
  Kd as X,
  Le as Xt,
  df as Y,
  Ve as Yt,
  uf as Z,
  Pe as Zt,
  Xp as _,
  eo as _t,
  Um as a,
  Md as at,
  Vp as b,
  Ta as bt,
  Rm as c,
  Od as ct,
  tm as d,
  ud as dt,
  ke as en,
  Hd as et,
  mm as f,
  od as ft,
  hm as g,
  Ho as gt,
  Zp as h,
  pc as ht,
  Wm as i,
  Sd as it,
  rp as j,
  ui as jt,
  lp as k,
  Ni as kt,
  Pm as l,
  Nd as lt,
  fm as m,
  rl as mt,
  th as n,
  Wd as nt,
  Lm as o,
  jd as ot,
  pm as p,
  ml as pt,
  af as q,
  Xe as qt,
  Ym as r,
  vd as rt,
  $ as s,
  xd as st,
  Home as t,
  Oe as tn,
  Gd as tt,
  em as u,
  pd as ut,
  Jp as v,
  Pa as vt,
  Mp as w,
  aa as wt,
  Ip as x,
  wa as xt,
  Pp as y,
  Ea as yt,
  pf as z,
  qn as zt,
};
