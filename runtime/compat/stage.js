// Compatibility application source; migrate components incrementally.
import { compactIndicatorWidth } from '../controls/indicator-model';
import { useLivePreview } from '../island/useLivePreview';
import { HolidayEffects } from '../holidays/HolidayEffects';
import { freeLicense } from '../free';
import {
  C as e,
  G as t,
  H as n,
  S as ee,
  b as r,
  d as te,
  g as ne,
  i,
  p as a,
  q as o,
  s,
  u as re,
  w as ie,
  x as ae,
  y as oe,
} from "./shared.js";
import {
  Gt as se,
  a as ce,
  dt as le,
  ft as c,
  i as ue,
  m as de,
  n as fe,
  o as pe,
  p as me,
  pt as he,
  r as ge,
  s as l,
  ut as _e,
  z as u,
} from "./home.js";
import { dt as d, j as f, n as p, ot as m, r as ve, t as ye, x as h, y as be } from "./island-store.js";
var g = o(t(), 1),
  _ = i(),
  v = `data:image/svg+xml;utf8,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2096%2096'%3E%3Cdefs%3E%3ClinearGradient%20id%3D'g'%20x1%3D'0'%20y1%3D'0'%20x2%3D'0'%20y2%3D'1'%3E%3Cstop%20offset%3D'0'%20stop-color%3D'%23ffb067'%2F%3E%3Cstop%20offset%3D'0.55'%20stop-color%3D'%23e0566f'%2F%3E%3Cstop%20offset%3D'1'%20stop-color%3D'%233d2b6e'%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D'96'%20height%3D'96'%20fill%3D'url(%23g)'%2F%3E%3Ccircle%20cx%3D'48'%20cy%3D'56'%20r%3D'17'%20fill%3D'%23ffe0a0'%2F%3E%3Cpath%20d%3D'M0%2064%20Q20%2056%2040%2063%20T80%2062%20T96%2060%20V96%20H0Z'%20fill%3D'%235a3d86'%2F%3E%3Cpath%20d%3D'M0%2076%20Q26%2068%2052%2076%20T96%2074%20V96%20H0Z'%20fill%3D'%232c2156'%2F%3E%3C%2Fsvg%3E`,
  y = `#e5705a`,
  b = { index: 2, count: 2, name: `` },
  x = {
    city: ``,
    units: `metric`,
    lat: 0,
    lon: 0,
    fetchedAt: 0,
    utcOffset: 0,
    now: { temp: 18, feels: 18, code: 1, isDay: !0, wind: 3, windDir: 0, humidity: 50, precip: 0 },
    hours: [],
    days: [],
  },
  S = () => ({
    key: `stage`,
    title: n(`Ранний рейс`, `Early flight`),
    artist: `Northbound`,
    album: n(`Над облаками`, `Above the clouds`),
    app: `stage`,
    appName: n(`Музыка`, `Music`),
    playing: !0,
    positionMs: 74e3,
    durationMs: 203e3,
    updatedAt: Date.now(),
    sources: 1,
  }),
  C = () => ({
    id: 0,
    found: !0,
    instrumental: !1,
    plain: ``,
    synced: [
      { ms: 62e3, text: n(`Сумка у двери, билет в кармане`, `A bag by the door, a ticket in hand`) },
      { ms: 68e3, text: n(`Город ещё не проснулся`, `The town is not awake yet`) },
      { ms: 73e3, text: n(`Мы поднимаемся над облаками`, `We rise above the clouds`) },
      { ms: 8e4, text: n(`И утро догоняет нас`, `And the morning catches up`) },
      { ms: 87e3, text: n(`Внизу остались лужи и фонари`, `Below stay the puddles and the lamps`) },
      { ms: 95e3, text: n(`Впереди только свет`, `Ahead there is only light`) },
    ],
  }),
  w = [428, 244],
  T = 180,
  E = { type: `spring`, stiffness: 300, damping: 26, mass: 1 },
  D = {
    initial: { opacity: 0, filter: `blur(6px)` },
    animate: {
      opacity: 1,
      filter: `blur(0px)`,
      transition: { delay: 0.07, duration: 0.24, ease: [0.2, 0.8, 0.2, 1] },
    },
    exit: { opacity: 0, filter: `blur(4px)`, transition: { duration: 0.1 } },
  },
  O = () => ({
    idle: n(`Свёрнутый остров`, `The folded island`),
    music: n(`Пока играет музыка`, `While music plays`),
    home: n(`Раскрытый остров, «Главная»`, `The open island, Home`),
    through: n(`Сквозной режим`, `Through mode`),
  });
function k({ scene: t, live: stageLive, s: i, license: o = freeLicense, pausable: k = !0, actual = true }) {
  const preview=useLivePreview(actual);
  const realMedia=m(state=>actual?state.media:null),realLive=m(state=>actual?state.mediaLive:false),realBattery=m(state=>actual?state.battery:null),realShelf=m(state=>actual?state.shelf.length:0),realPeripherals=m(state=>actual?state.peripherals:null),realDesktop=m(state=>actual?state.vdesk:null),realLayout=m(state=>actual?state.layoutCode:''),realCaps=m(state=>actual?state.caps:false),realWeather=u(state=>actual?state.data:null),accent=m(state=>actual?state.accent:y);
  let A = i.moduleMedia !== !1,
    j = (t === `music` || t === `home` || t === 'current' && realLive) && A && (!actual || !!realMedia),
    M = t === `home` && A && (!actual || !!realMedia);
  ((0, g.useLayoutEffect)(() => {
    if (actual) {m.setState({settings:i,license:o});s(i.clockFormat);return;}
    (m.setState({
      settings: i,
      license: o,
      asleep: !1,
      caps: !1,
      layoutCode: `RU`,
      vdesk: b,
      battery: { percent: 76, plugged: !1, saver: !1 },
      cover: v,
      accent: y,
      level: 0.55,
    }),
      s(i.clockFormat),
      u.setState({ data: o.pro ? x : null }));
  }, [i, o, actual]),
    (0, g.useLayoutEffect)(() => {
      if (actual) return;
      m.setState({ media: S(), mediaLive: j });
    }, [j, actual]),
    (0, g.useLayoutEffect)(() => {
      if (actual) return;
      let e = C();
      l.setState({ key: `stage`, status: `ready`, lyrics: e, widths: pe(e) });
    }, [actual]));
  let N = l((e) => (e.status === `ready` ? e.lineW : 0)),
    P = f(be({ settings: i, license: o, mediaLive: j, media: j ? actual ? realMedia : { playing: !0 } : null })),
    F = i.characterSize === `large`,
    I = (() => {
      let e = r(i.mediaPill);
      return e === `lyrics` && i.lyrics !== !0 ? `title` : e;
    })(),
    L = {
      compact: compactIndicatorWidth(i,realPeripherals),
      face: P.face === !0,
      character: P.kind === `slot`,
      clock: i.showClock !== !1,
      seconds: i.clockSeconds === !0,
      battery: i.showBattery !== !1 && (!actual || !!realBattery),
      weather: o.pro && i.moduleWeather !== !1 && i.showWeather !== !1 && (!actual || !!realWeather),
      caps: actual && realCaps && i.showCaps !== false,
      layout: i.layoutInPill === !0 && (!actual || !!realLayout),
      desk: i.desktopInPill === !0 ? actual ? realDesktop ? te(realDesktop).length : 0 : te(b).length : 0,
      dots: 0,
      shelf: actual && i.moduleShelf !== false ? realShelf : 0,
    },
    [R, z] = M
      ? w
      : j
        ? I === `player`
          ? ae({ ...L, seekable: !actual || realMedia?.canSeek !== false && realMedia?.durationMs > 0, lyrics: i.lyrics === !0 && i.lyricsInPlayer !== !1 })
          : I === `lyrics`
            ? oe({ ...L, words: N })
            : I === `title`
              ? e(L)
              : ee(L)
        : ne({ ...L, slot: re(P.box, F ? 44 : void 0), big: F }),
    B = d(P.kind, i.liquidWith, o.pro),
    V = i.style === `capsule`,
    H = V && actual && i.garland && i.garland !== 'off' && i.snow !== 'off' ? 16 : V ? 8 : 0,
    U = Math.min(z / 2, M ? 32 : 26),
    W = le(i.theme, i.islandColor, window.matchMedia(`(prefers-color-scheme: light)`).matches),
    G = t === `through` || (i.through === !0 && !M),
    xe = ie(M ? i.opacityOpen : G ? (i.opacityThrough ?? 45) : i.opacityRest),
    K = M ? `expanded` : j ? `liveMedia` : `idle`,
    q = (0, g.useRef)(null),
    [J, Se] = (0, g.useState)(520);
  (0, g.useLayoutEffect)(() => {
    let e = q.current;
    if (!e) return;
    let t = () => Se(e.clientWidth);
    t();
    let n = new ResizeObserver(t);
    return (n.observe(e), () => n.disconnect());
  }, []);
  let Y = M ? 1 : (i.scale ?? 100) / 100,
    Ce = Math.max(0.01, Math.min(Y, (J - 36) / R, (154 - H) / z)),
    we = Math.min(J / 2, ((380 * (i.scale ?? 100)) / 100 / Math.max(window.screen.width, 800)) * J),
    Te = Math.max(-Math.max(0, (J - R * Ce) / 2 - 16),
      Math.min(Math.max(0, (J - R * Ce) / 2 - 16), ((i.offsetX ?? 0) / 100) * Math.max(0, J / 2 - we))),
    [Ee, X] = (0, g.useState)(!0);
  (0, g.useEffect)(() => {
    X(!0);
    let e = setTimeout(() => X(!1), 1600);
    return () => clearTimeout(e);
  }, [t, i, o.pro]);
  let [De, Z] = (0, g.useState)(!1),
    Q = !stageLive && !De && !Ee;
  (0, g.useEffect)(() => {
    if (k) return (h(`still`, Q), () => h(`still`, !1));
  }, [Q, k]);
  let Oe = M ? `home` : j ? `music-${I}` : `idle`,
    ke = M
      ? (0, _.jsx)(`div`, { className: `flex h-full flex-col p-3`, children: (0, _.jsx)(fe, {}) })
      : j
        ? I === `player`
          ? (0, _.jsx)(ue, {})
          : I === `lyrics`
            ? (0, _.jsx)(ge, {})
            : I === `title`
              ? (0, _.jsx)(ce, {})
              : (0, _.jsx)(de, {})
        : (0, _.jsx)(me, {}),
    $ = j && (!actual || realMedia?.playing) ? `music` : `idle`,
    Ae = W.color
      ? { "--color-island": W.color, ...(W.theme === `light` ? { "--color-black": W.color } : {}) }
      : {};
  if (actual && !preview.ready) return _.jsx('div',{'data-live-preview-loading':true,className:'grid h-[180px] place-items-center rounded-2xl bg-[#1c1d22] text-[12px] text-white/50',children:preview.error?n('Не удалось загрузить остров','Could not load the island'):n('Загружаю остров…','Loading the island…')});
  return (0, _.jsxs)(`div`, {
    ref: q,
    "data-stage": t,
    "data-stage-actual": actual || undefined,
    "data-stage-still": Q || void 0,
    onPointerEnter: () => Z(!0),
    onPointerLeave: () => Z(!1),
    className: `relative overflow-hidden rounded-2xl bg-[#1c1d22] ring-1 ring-white/[0.06]`,
    style: { height: T },
    children: [
      (0, _.jsx)(`div`, {
        inert: !0,
        "data-stage-theme": W.theme,
        className: `pointer-events-none absolute inset-x-0 top-0 flex justify-center`,
        style: { ...Ae, paddingTop: H },
        children: (0, _.jsx)(c.div, {
          initial: !1,
          animate: { x: Te, scale: Ce, opacity: xe },
          transition: E,
          style: { transformOrigin: `50% 0` },
          children: (0, _.jsxs)(c.div, {
            "data-island": !0,
            "data-island-style": V ? 'capsule' : 'notch',
            "data-island-theme": W.theme,
            className: `relative text-ink ${B ? `` : `bg-island`}`,
            initial: !1,
            animate: {
              width: R,
              height: z,
              borderBottomLeftRadius: U,
              borderBottomRightRadius: U,
              borderTopLeftRadius: V ? U : 0,
              borderTopRightRadius: V ? U : 0,
              boxShadow: _e(W.theme, !B && M),
            },
            transition: E,
            onUpdate: B ? () => se.postRender(p) : void 0,
            children: [
              B && (0, _.jsx)(ye, { mood: $, accent, ears: !V, round: V, scaled: !0 }),
              actual && _.jsx(HolidayEffects,{settings:i,width:R,height:z,capsule:V,visible:true,readMusicLevel:()=>m.getState().level??0}),
              P.kind === `attach` &&
                (0, _.jsx)(ve, { id: P.id, mood: $, face: a(K) && (K !== `liveMedia` || I === `normal`) }),
              !V &&
                !B &&
                (0, _.jsxs)(_.Fragment, {
                  children: [
                    (0, _.jsx)(`span`, { className: `notch-ear left` }),
                    (0, _.jsx)(`span`, { className: `notch-ear right` }),
                  ],
                }),
              (0, _.jsx)(`div`, {
                "data-liquid-clip": !0,
                className: `absolute inset-0 overflow-hidden`,
                style: { borderRadius: `inherit` },
                children: (0, _.jsx)(`div`, {
                  "data-liquid-squash": !0,
                  className: `absolute inset-0 origin-top`,
                  children: (0, _.jsx)(he, {
                    initial: !1,
                    children: (0, _.jsx)(
                      c.div,
                      {
                        className: `absolute top-0 left-1/2`,
                        style: { width: R, height: z, x: `-50%` },
                        variants: D,
                        initial: `initial`,
                        animate: `animate`,
                        exit: `exit`,
                        children: ke,
                      },
                      Oe,
                    ),
                  }),
                }),
              }),
            ],
          }),
        }),
      }),
      (0, _.jsx)(`div`, {
        className: `pointer-events-none absolute bottom-2 left-3 text-[11px] text-white/35`,
        children: O()[M ? `home` : j ? `music` : G ? `through` : `idle`],
      }),
    ],
  });
}
export { k as default };
