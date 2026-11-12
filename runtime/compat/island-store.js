import { createCharacterCatalog } from "../characters/catalog";
import {
  isFreeCharacter as y,
  resolveCharacter as b,
  hasLiquidIsland as x,
  selectCharacter as S,
} from "../characters/selection";
// Compatibility application source; migrate components incrementally.
import { B as e, G as t, H as n, O as r, V as i, i as a, k as o, n as s, q as c } from "./shared.js";
function l(e, t = Date.now()) {
  let r = Math.max(0, Math.round((t - e) / 1e3));
  if (r < 45) return n(`сейчас`, `now`);
  let a = Math.round(r / 60);
  if (a < 60) return n(`${a} мин`, `${a} min`);
  let o = Math.round(a / 60);
  if (o < 24) return n(`${o} ч`, `${o} h`);
  let s = Math.round(o / 24);
  return s < 7
    ? n(`${s} дн`, `${s} d`)
    : new Date(e).toLocaleDateString(i(), { day: `numeric`, month: `short` });
}
function u(t) {
  if (t <= 0) return ``;
  let n = e() === `ru` ? [`Б`, `КБ`, `МБ`, `ГБ`] : [`B`, `KB`, `MB`, `GB`],
    r = t,
    i = 0;
  for (; r >= 1024 && i < n.length - 1; ) ((r /= 1024), i++);
  return `${r < 10 && i > 0 ? r.toFixed(1) : Math.round(r)} ${n[i]}`;
}
function d(e) {
  let t = Math.max(0, Math.floor(e / 1e3)),
    n = Math.floor(t / 3600),
    r = Math.floor((t % 3600) / 60),
    i = t % 60,
    a = String(i).padStart(2, `0`);
  return n > 0 ? `${n}:${String(r).padStart(2, `0`)}:${a}` : `${r}:${a}`;
}
function f(e) {
  let t = e.toLowerCase(),
    r = [
      [`spotify`, `Spotify`],
      [`yandex`, n(`Яндекс`, `Yandex`)],
      [`chrome`, `Chrome`],
      [`msedge`, `Edge`],
      [`firefox`, `Firefox`],
      [`opera`, `Opera`],
      [`zunemusic`, n(`Медиаплеер`, `Media Player`)],
      [`vlc`, `VLC`],
      [`telegram`, `Telegram`],
      [`discord`, `Discord`],
    ];
  for (let [e, n] of r) if (t.includes(e)) return n;
  return (e.split(/[\\/!]/).pop() ?? e).replace(/\.exe$/i, ``).replace(/_.*$/, ``);
}
async function p(e) {
  let t = new Image();
  t.crossOrigin = "anonymous";
  t.src = e;
  try {
    await t.decode();
  } catch {
    return null;
  }
  let n = document.createElement(`canvas`);
  ((n.width = 24), (n.height = 24));
  let r = n.getContext(`2d`, { willReadFrequently: !0 });
  if (!r) return null;
  let i;
  try {
    r.drawImage(t, 0, 0, 24, 24);
    i = r.getImageData(0, 0, 24, 24).data;
  } catch {
    return null;
  }
  let a = 0,
    o = 0,
    s = 0,
    c = 0;
  for (let e = 0; e < i.length; e += 4) {
    let [t, n, r] = [i[e], i[e + 1], i[e + 2]],
      l = Math.max(t, n, r),
      u = l === 0 ? 0 : (l - Math.min(t, n, r)) / l,
      d = l / 255,
      f = 0.05 + u * u * d;
    ((a += t * f), (o += n * f), (s += r * f), (c += f));
  }
  if (c === 0) return null;
  let [l, u, d] = [a / c, o / c, s / c],
    f = 0.2126 * l + 0.7152 * u + 0.0722 * d;
  if (f < 110) {
    let e = 110 / Math.max(f, 1);
    [l, u, d] = [Math.min(255, l * e), Math.min(255, u * e), Math.min(255, d * e)];
  }
  return `rgb(${Math.round(l)} ${Math.round(u)} ${Math.round(d)})`;
}
function m(e) {
  return e
    .split(`+`)
    .map((e) => e.trim())
    .filter(Boolean)
    .map((e) => (e === `Shift` ? `⇧` : e === `Space` ? `Space` : e));
}
var ReactRuntime = c(t(), 1),
  jsxRuntime = a(),
  _ = () => n(`399 ₽`, `$4.99`),
  v = `https://github.com/nimalekyt-bit/woods-island`,
  ee = () => `https://github.com/nimalekyt-bit/woods-island/?lang=${e() === `ru` ? `ru` : `en`}#isl-pro`;
function ne(e) {
  switch (e) {
    case `weather`:
      return n(`Погода входит в Woods Island`, `Weather is part of Woods Island`);
    case `ai`:
      return n(`Чат с ИИ входит в Woods Island`, `AI chat is part of Woods Island`);
    case `dictation`:
      return n(`Голос в текст входит в Woods Island`, `Voice to text is part of Woods Island`);
    case `record`:
      return n(`Запись экрана входит в Woods Island`, `Screen recording is part of Woods Island`);
    case `ocr`:
      return n(`Текст с экрана входит в Woods Island`, `Screen text is part of Woods Island`);
    case `characters`:
      return n(`Этот персонаж входит в Woods Island`, `This character is part of Woods Island`);
    case `agents`:
      return n(`Статус ИИ-агентов входит в Woods Island`, `The status of AI agents is part of Woods Island`);
    case `trial`:
      return n(`Проба Woods Island закончилась`, `The Woods Island trial is over`);
  }
}
var re = () => [
  n(`Все 25 персонажей`, `All 25 characters`),
  n(
    `Погода: прогноз, температура на острове, предупреждения`,
    `Weather: the forecast, the temperature on the island, warnings`,
  ),
  n(`Чат с ИИ и голос в текст`, `AI chat and voice to text`),
  n(`Запись экрана и текст с экрана`, `Screen recording and screen text`),
  n(
    `Статус ИИ-агентов: Claude Code, Codex и opencode на острове`,
    `The status of AI agents: Claude Code, Codex and opencode on the island`,
  ),
];
function ie(e) {
  let t =
    e % 10 == 1 && e % 100 != 11
      ? `день`
      : e % 10 >= 2 && e % 10 <= 4 && (e % 100 < 12 || e % 100 > 14)
        ? `дня`
        : `дней`;
  return n(`${e} ${t}`, `${e} ${e === 1 ? `day` : `days`}`);
}
var ae = (e) => {
    let t,
      n = new Set(),
      r = (e, r) => {
        let i = typeof e == `function` ? e(t) : e;
        if (!Object.is(i, t)) {
          let e = t;
          ((t = (r ?? (typeof i != `object` || !i)) ? i : Object.assign({}, t, i)),
            n.forEach((n) => n(t, e)));
        }
      },
      i = () => t,
      a = {
        setState: r,
        getState: i,
        getInitialState: () => o,
        subscribe: (e) => (n.add(e), () => n.delete(e)),
      },
      o = (t = e(r, i, a));
    return a;
  },
  C = (e) => (e ? ae(e) : ae),
  oe = (e) => e;
function w(e, t = oe) {
  let n = ReactRuntime.useSyncExternalStore(
    e.subscribe,
    ReactRuntime.useCallback(() => t(e.getState()), [e, t]),
    ReactRuntime.useCallback(() => t(e.getInitialState()), [e, t]),
  );
  return (ReactRuntime.useDebugValue(n), n);
}
var se = (e) => {
    let t = C(e),
      n = (e) => w(t, e);
    return (Object.assign(n, t), n);
  },
  ce = (e) => (e ? se(e) : se),
  le = new Set([`volume`, `micMuted`, `device`, `layout`, `caps`]);
function T(e, t, n) {
  return e && e.kind === t && le.has(t) ? e.id : n;
}
var E = { short: 0.6, normal: 1, long: 2 };
function D(e, t, n) {
  return n ? e : Math.round(e * (E[t ?? `normal`] ?? 1));
}
function ue() {
  try {
    let e = localStorage.getItem(`island-chat-service`);
    return e === `gemini` || e === `deepseek` ? e : `island`;
  } catch {
    return `island`;
  }
}
var O = {
    copied: 1800,
    screenshot: 5e3,
    ocr: 3500,
    qr: 6e3,
    color: 5e3,
    shelf: 2200,
    launcher: 2200,
    volume: 1500,
    device: 2200,
    layout: 900,
    caps: 1400,
    mic: 3500,
    micMuted: 1600,
    cam: 3e3,
    vpn: 3500,
    download: 6e3,
    update: 12e3,
    recorded: 8e3,
    chat: 6e3,
    reminder: 6e5,
    timer: 6e5,
    dictated: 5e3,
    weather: 7e3,
    pro: 7e3,
    news: 9e3,
    notification: 7e3,
    agent: 9e3,
    agentAsk: 13e4,
    done: 1500,
    error: 4e3,
  },
  k = new Set([`volume`, `layout`, `caps`, `micMuted`, `device`]),
  A = new Set([`reminder`, `timer`, `agentAsk`]);
function j(e, t, n = O[e]) {
  return D(n, t().settings?.cardTime, A.has(e));
}
var M = 0,
  N;
function P(e, t, n) {
  (clearTimeout(N),
    (N = setTimeout(function n() {
      let r = e();
      if (r.peek?.id === t) {
        if (r.hovered || r.draggingOut) {
          N = setTimeout(n, 600);
          return;
        }
        r.nextPeek();
      }
    }, n)));
}
var useIslandStore = ce((e, t) => ({
    settings: null,
    version: ``,
    license: { pro: !0, source: `trial`, trialDaysLeft: 14, serial: null },
    expanded: !1,
    pinned: !1,
    holdOpen: !1,
    tall: !1,
    openedBy: null,
    enteredSinceOpen: !1,
    tab: `home`,
    hovered: !1,
    atEdge: !1,
    shy: !1,
    desktop: !1,
    keep: !1,
    look: 0,
    asleep: !1,
    peek: null,
    queue: [],
    media: null,
    mediaLive: !1,
    cover: null,
    accent: null,
    level: 0,
    bands: [],
    bandsAt: 0,
    audio: null,
    privacy: { mic: [], cam: [] },
    vpn: null,
    downloads: [],
    caps: !1,
    layoutCode: ``,
    vdesk: null,
    battery: null,
    update: null,
    updating: null,
    shelf: [],
    launcher: [],
    palette: !1,
    recording: null,
    dictation: null,
    voice: 0,
    dragOver: null,
    draggingOut: !1,
    asking: !1,
    vpnAsk: 0,
    obs: null,
    agents: [],
    textSeed: null,
    chatService: ue(),
    webAiActive: !1,
    webAiWantsKeys: !1,
    webAiPopped: null,
    headerMin: 0,
    open: (t, n) => {
      (clearTimeout(N),
        e((e) => ({
          expanded: !0,
          openedBy: t,
          enteredSinceOpen: e.hovered,
          tab: n ?? e.tab,
          peek: null,
          queue: [],
        })),
        t === `hotkey` && r.takeFocus());
    },
    close: () => {
      t().expanded &&
        (e({ expanded: !1, pinned: !1, holdOpen: !1, tall: !1, openedBy: null }), r.releaseFocus());
    },
    setTab: (t) => e({ tab: t }),
    togglePin: () => e((e) => ({ pinned: !e.pinned })),
    setHoldOpen: (t) => e({ holdOpen: t }),
    pushPeek: (n) => {
      let r = t();
      if (n.kind === `agentAsk`) {
        let i = { ...n, id: ++M };
        if (r.peek?.kind === `agentAsk`) {
          e({ queue: [...r.queue, i] });
          return;
        }
        (e({ peek: i, queue: r.peek && !k.has(r.peek.kind) ? [r.peek, ...r.queue] : r.queue }),
          P(t, i.id, j(`agentAsk`, t)),
          r.expanded && !r.holdOpen && !r.pinned && t().close());
        return;
      }
      if (r.expanded || r.palette) return;
      let i = { ...n, id: T(r.peek, n.kind, ++M) };
      !r.peek || r.peek.kind === i.kind
        ? (e({ peek: i }), P(t, i.id, j(i.kind, t)))
        : k.has(i.kind) || A.has(i.kind) || A.has(r.peek.kind)
          ? (e({
              peek: i,
              queue: [...(k.has(r.peek.kind) ? [] : [r.peek]), ...r.queue.filter((e) => e.kind !== i.kind)],
            }),
            P(t, i.id, j(i.kind, t)))
          : e({ queue: [...r.queue.filter((e) => e.kind !== i.kind), i] });
    },
    nextPeek: () => {
      let [n, ...r] = t().queue;
      e({ peek: n ?? null, queue: r });
      let i = n?.kind === `update` || n?.kind === `news` ? 12e3 : n && A.has(n.kind) ? O[n.kind] : 2500;
      n && P(t, n.id, j(n.kind, t, Math.min(O[n.kind], i)));
    },
    dropAsk: (n) => {
      let r = t();
      r.peek?.kind === `agentAsk` && r.peek.ask.id === n
        ? r.nextPeek()
        : e({ queue: r.queue.filter((e) => e.kind !== `agentAsk` || e.ask.id !== n) });
    },
    sendToText: (t, n) =>
      e((e) => ({ textSeed: { text: t, n: (e.textSeed?.n ?? 0) + 1, then: n }, tab: `text` })),
    openPalette: () => {
      (clearTimeout(N), e({ palette: !0, expanded: !1, peek: null, queue: [] }), r.takeFocus());
    },
    closePalette: () => {
      t().palette && (e({ palette: !1 }), r.releaseFocus());
    },
    installUpdate: () => {
      t().updating ||
        (e({ peek: null }),
        t().close(),
        r.updateInstall().catch((r) => {
          (e({ updating: null }),
            t().pushPeek({
              kind: `error`,
              message: n(`Обновление не удалось: ${String(r)}`, `Update failed: ${String(r)}`),
            }));
        }));
    },
  })),
  I = {
    name: `bot`,
    size: 24,
    node: [
      [`path`, { d: `M12 8V4H8`, key: `hb8ula` }],
      [`rect`, { width: `16`, height: `12`, x: `4`, y: `8`, rx: `2`, key: `enze0r` }],
      [`path`, { d: `M2 14h2`, key: `vft8re` }],
      [`path`, { d: `M20 14h2`, key: `4cs60a` }],
      [`path`, { d: `M15 13v2`, key: `1xurst` }],
      [`path`, { d: `M9 13v2`, key: `rq6x2g` }],
    ],
  };
I.node;
var de = s(I),
  L = {
    name: `clipboard-list`,
    size: 24,
    node: [
      [`rect`, { width: `8`, height: `4`, x: `8`, y: `2`, rx: `1`, ry: `1`, key: `tgr4d6` }],
      [
        `path`,
        { d: `M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2`, key: `116196` },
      ],
      [`path`, { d: `M12 11h4`, key: `1jrz19` }],
      [`path`, { d: `M12 16h4`, key: `n85exb` }],
      [`path`, { d: `M8 11h.01`, key: `1dfujw` }],
      [`path`, { d: `M8 16h.01`, key: `18s6g9` }],
    ],
  };
L.node;
var R = s(L),
  fe = {
    name: `cloud-sun`,
    size: 24,
    node: [
      [`path`, { d: `M12 2v2`, key: `tus03m` }],
      [`path`, { d: `m4.93 4.93 1.41 1.41`, key: `149t6j` }],
      [`path`, { d: `M20 12h2`, key: `1q8mjw` }],
      [`path`, { d: `m19.07 4.93-1.41 1.41`, key: `1shlcs` }],
      [`path`, { d: `M15.947 12.65a4 4 0 0 0-5.925-4.128`, key: `dpwdj0` }],
      [`path`, { d: `M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z`, key: `s09mg5` }],
    ],
  };
fe.node;
var pe = s(fe),
  me = {
    name: `eraser`,
    size: 24,
    node: [
      [
        `path`,
        {
          d: `M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21`,
          key: `g5wo59`,
        },
      ],
      [`path`, { d: `m5.082 11.09 8.828 8.828`, key: `1wx5vj` }],
    ],
  };
me.node;
var he = s(me),
  ge = {
    name: `face-slightly-smiling`,
    size: 24,
    node: [
      [`path`, { d: `M15 10V9`, key: `4dkmfx` }],
      [`path`, { d: `M16.472 15a6 6 0 01-8.943 0`, key: `7qomzy` }],
      [`path`, { d: `M9 10V9`, key: `1lazqi` }],
      [`circle`, { cx: `12`, cy: `12`, r: `10`, key: `1mglay` }],
    ],
    aliases: [`smile`],
  };
ge.node;
var _e = s(ge),
  ve = {
    name: `inbox`,
    size: 24,
    node: [
      [`polyline`, { points: `22 12 16 12 14 15 10 15 8 12 2 12`, key: `o97t9d` }],
      [
        `path`,
        {
          d: `M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z`,
          key: `oot6mr`,
        },
      ],
    ],
  };
ve.node;
var ye = s(ve),
  be = {
    name: `keyboard`,
    size: 24,
    node: [
      [`path`, { d: `M10 8h.01`, key: `1r9ogq` }],
      [`path`, { d: `M12 12h.01`, key: `1mp3jc` }],
      [`path`, { d: `M14 8h.01`, key: `1primd` }],
      [`path`, { d: `M16 12h.01`, key: `1l6xoz` }],
      [`path`, { d: `M18 8h.01`, key: `emo2bl` }],
      [`path`, { d: `M6 8h.01`, key: `x9i8wu` }],
      [`path`, { d: `M7 16h10`, key: `wp8him` }],
      [`path`, { d: `M8 12h.01`, key: `czm47f` }],
      [`rect`, { width: `20`, height: `16`, x: `2`, y: `4`, rx: `2`, key: `18n3k1` }],
    ],
  };
be.node;
var xe = s(be),
  Se = {
    name: `map-pin`,
    size: 24,
    node: [
      [
        `path`,
        {
          d: `M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0`,
          key: `1r0f0z`,
        },
      ],
      [`circle`, { cx: `12`, cy: `10`, r: `3`, key: `ilqhr7` }],
    ],
  };
Se.node;
var Ce = s(Se),
  we = {
    name: `message-circle`,
    size: 24,
    node: [
      [
        `path`,
        {
          d: `M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719`,
          key: `1sd12s`,
        },
      ],
    ],
  };
we.node;
var Te = s(we),
  Ee = {
    name: `mic`,
    size: 24,
    node: [
      [`path`, { d: `M12 19v3`, key: `npa21l` }],
      [`path`, { d: `M19 10v2a7 7 0 0 1-14 0v-2`, key: `1vc78b` }],
      [`rect`, { x: `9`, y: `2`, width: `6`, height: `13`, rx: `3`, key: `s6n7sd` }],
    ],
  };
Ee.node;
var De = s(Ee),
  Oe = {
    name: `monitor`,
    size: 24,
    node: [
      [`rect`, { width: `20`, height: `14`, x: `2`, y: `3`, rx: `2`, key: `48i651` }],
      [`line`, { x1: `8`, x2: `16`, y1: `21`, y2: `21`, key: `1svkeh` }],
      [`line`, { x1: `12`, x2: `12`, y1: `17`, y2: `21`, key: `vw1qmm` }],
    ],
  };
Oe.node;
var ke = s(Oe),
  Ae = {
    name: `music-2`,
    size: 24,
    node: [
      [`circle`, { cx: `8`, cy: `18`, r: `4`, key: `1fc0mg` }],
      [`path`, { d: `M12 18V2l7 4`, key: `g04rme` }],
    ],
  };
Ae.node;
var je = s(Ae),
  Me = {
    name: `notebook-pen`,
    size: 24,
    node: [
      [`path`, { d: `M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4`, key: `re6nr2` }],
      [`path`, { d: `M2 6h4`, key: `aawbzj` }],
      [`path`, { d: `M2 10h4`, key: `l0bgd4` }],
      [`path`, { d: `M2 14h4`, key: `1gsvsf` }],
      [`path`, { d: `M2 18h4`, key: `1bu2t1` }],
      [
        `path`,
        {
          d: `M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z`,
          key: `pqwjuv`,
        },
      ],
    ],
  };
Me.node;
var Ne = s(Me),
  Pe = {
    name: `pipette`,
    size: 24,
    node: [
      [
        `path`,
        {
          d: `m12 9-8.414 8.414A2 2 0 0 0 3 18.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 3.828 21h1.344a2 2 0 0 0 1.414-.586L15 12`,
          key: `1y3wsu`,
        },
      ],
      [
        `path`,
        { d: `m18 9 .4.4a1 1 0 1 1-3 3l-3.8-3.8a1 1 0 1 1 3-3l.4.4 3.4-3.4a1 1 0 1 1 3 3z`, key: `110lr1` },
      ],
      [`path`, { d: `m2 22 .414-.414`, key: `jhxm08` }],
    ],
  };
Pe.node;
var Fe = s(Pe),
  Ie = {
    name: `power`,
    size: 24,
    node: [
      [`path`, { d: `M12 2v10`, key: `mnfbl` }],
      [`path`, { d: `M18.4 6.6a9 9 0 1 1-12.77.04`, key: `obofu9` }],
    ],
  };
Ie.node;
var Le = s(Ie),
  Re = {
    name: `qr-code`,
    size: 24,
    node: [
      [`rect`, { width: `5`, height: `5`, x: `3`, y: `3`, rx: `1`, key: `1tu5fj` }],
      [`rect`, { width: `5`, height: `5`, x: `16`, y: `3`, rx: `1`, key: `1v8r4q` }],
      [`rect`, { width: `5`, height: `5`, x: `3`, y: `16`, rx: `1`, key: `1x03jg` }],
      [`path`, { d: `M21 16h-3a2 2 0 0 0-2 2v3`, key: `177gqh` }],
      [`path`, { d: `M21 21v.01`, key: `ents32` }],
      [`path`, { d: `M12 7v3a2 2 0 0 1-2 2H7`, key: `8crl2c` }],
      [`path`, { d: `M3 12h.01`, key: `nlz23k` }],
      [`path`, { d: `M12 3h.01`, key: `n36tog` }],
      [`path`, { d: `M12 16v.01`, key: `133mhm` }],
      [`path`, { d: `M16 12h1`, key: `1slzba` }],
      [`path`, { d: `M21 12v.01`, key: `1lwtk9` }],
      [`path`, { d: `M12 21v-1`, key: `1880an` }],
    ],
  };
Re.node;
var ze = s(Re),
  Be = {
    name: `refresh-cw`,
    size: 24,
    node: [
      [`path`, { d: `M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8`, key: `v9h5vc` }],
      [`path`, { d: `M21 3v5h-5`, key: `1q7to0` }],
      [`path`, { d: `M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16`, key: `3uifl3` }],
      [`path`, { d: `M8 16H3v5`, key: `1cv678` }],
    ],
  };
Be.node;
var Ve = s(Be),
  He = {
    name: `scan-text`,
    size: 24,
    node: [
      [`path`, { d: `M3 7V5a2 2 0 0 1 2-2h2`, key: `aa7l1z` }],
      [`path`, { d: `M17 3h2a2 2 0 0 1 2 2v2`, key: `4qcy5o` }],
      [`path`, { d: `M21 17v2a2 2 0 0 1-2 2h-2`, key: `6vwrx8` }],
      [`path`, { d: `M7 21H5a2 2 0 0 1-2-2v-2`, key: `ioqczr` }],
      [`path`, { d: `M7 8h8`, key: `1jbsf9` }],
      [`path`, { d: `M7 12h10`, key: `b7w52i` }],
      [`path`, { d: `M7 16h6`, key: `1vyc9m` }],
    ],
  };
He.node;
var Ue = s(He),
  We = {
    name: `search`,
    size: 24,
    node: [
      [`path`, { d: `m21 21-4.34-4.34`, key: `14j7rj` }],
      [`circle`, { cx: `11`, cy: `11`, r: `8`, key: `4ej97u` }],
    ],
  };
We.node;
var Ge = s(We),
  Ke = {
    name: `sliders-horizontal`,
    size: 24,
    node: [
      [`path`, { d: `M10 5H3`, key: `1qgfaw` }],
      [`path`, { d: `M12 19H3`, key: `yhmn1j` }],
      [`path`, { d: `M14 3v4`, key: `1sua03` }],
      [`path`, { d: `M16 17v4`, key: `1q0r14` }],
      [`path`, { d: `M21 12h-9`, key: `1o4lsq` }],
      [`path`, { d: `M21 19h-5`, key: `1rlt1p` }],
      [`path`, { d: `M21 5h-7`, key: `1oszz2` }],
      [`path`, { d: `M8 10v4`, key: `tgpxqk` }],
      [`path`, { d: `M8 12H3`, key: `a7s4jb` }],
    ],
  };
Ke.node;
var qe = s(Ke),
  Je = {
    name: `sparkles`,
    size: 24,
    node: [
      [
        `path`,
        {
          d: `M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z`,
          key: `1s2grr`,
        },
      ],
      [`path`, { d: `M20 2v4`, key: `1rf3ol` }],
      [`path`, { d: `M22 4h-4`, key: `gwowj6` }],
      [`circle`, { cx: `4`, cy: `20`, r: `2`, key: `6kqj1y` }],
    ],
    aliases: [`stars`],
  };
Je.node;
var Ye = s(Je),
  Xe = {
    name: `square-dashed-mouse-pointer`,
    size: 24,
    node: [
      [
        `path`,
        {
          d: `M12.034 12.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.943l-3.444 1.068a1 1 0 0 0-.66.66l-1.067 3.443a.5.5 0 0 1-.943.033z`,
          key: `xwnzip`,
        },
      ],
      [`path`, { d: `M5 3a2 2 0 0 0-2 2`, key: `y57alp` }],
      [`path`, { d: `M19 3a2 2 0 0 1 2 2`, key: `18rm91` }],
      [`path`, { d: `M5 21a2 2 0 0 1-2-2`, key: `sbafld` }],
      [`path`, { d: `M9 3h1`, key: `1yesri` }],
      [`path`, { d: `M9 21h2`, key: `1qve2z` }],
      [`path`, { d: `M14 3h1`, key: `1ec4yj` }],
      [`path`, { d: `M3 9v1`, key: `1r0deq` }],
      [`path`, { d: `M21 9v2`, key: `p14lih` }],
      [`path`, { d: `M3 14v1`, key: `vnatye` }],
    ],
    aliases: [`mouse-pointer-square-dashed`],
  };
Xe.node;
var Ze = s(Xe),
  Qe = {
    name: `video`,
    size: 24,
    node: [
      [
        `path`,
        { d: `m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5`, key: `ftymec` },
      ],
      [`rect`, { x: `2`, y: `6`, width: `14`, height: `12`, rx: `2`, key: `158x01` }],
    ],
  };
Qe.node;
var $e = s(Qe),
  et = {
    name: `volume-2`,
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
      [`path`, { d: `M19.364 18.364a9 9 0 0 0 0-12.728`, key: `ijwkga` }],
    ],
  };
et.node;
var tt = s(et),
  nt = [
    {
      id: `imgur`,
      name: `Imgur`,
      needsKey: !0,
      keyName: `Client-ID`,
      keyUrl: `https://api.imgur.com/oauth2/addclient`,
      note: () =>
        n(
          `Нужен свой Client-ID: Imgur даёт его при регистрации приложения (тип — без входа пользователя).`,
          `Needs a Client-ID of your own: Imgur gives one when an application is registered (the kind without a user's sign-in).`,
        ),
    },
    {
      id: `imgbb`,
      name: `ImgBB`,
      needsKey: !0,
      keyName: n(`ключ API`, `API key`),
      keyUrl: `https://api.imgbb.com/`,
      note: () =>
        n(
          `Нужен свой ключ API: ImgBB даёт его бесплатно после входа.`,
          `Needs an API key of your own: ImgBB gives one for free after signing in.`,
        ),
    },
  ];
function rt(e) {
  return nt.find((t) => t.id === (e ?? ``).trim().toLowerCase()) ?? null;
}
function it(e) {
  return e.replace(/^https?:\/\//i, ``);
}
var z = `http://www.w3.org/2000/svg`,
  at = {
    idle: `#F1EFE8`,
    music: `#F0997B`,
    think: `#AFA9EC`,
    done: `#97C459`,
    attn: `#EF9F27`,
    sleep: `#5F5E5A`,
  };
function B(e, t, n) {
  let r = document.createElementNS(z, e);
  for (let e in t) r.setAttribute(e, String(t[e]));
  return (n && n.appendChild(r), r);
}
function V(e, t, n, r) {
  let i = Math.min(n, r) / 2,
    a = e - n / 2,
    o = t - r / 2,
    s = n - 2 * i,
    c = r - 2 * i;
  return `M${a + i},${o}h${s}a${i},${i} 0 0 1 ${i},${i}v${c}a${i},${i} 0 0 1 -${i},${i}h-${s}a${i},${i} 0 0 1 -${i},-${i}v-${c}a${i},${i} 0 0 1 ${i},-${i}z`;
}
function H(e, t, n, r, i, a, o, s) {
  let c = (t) => {
    (e.setAttribute(`d`, t),
      e.setAttribute(`fill`, `none`),
      e.setAttribute(`stroke`, a),
      e.setAttribute(`stroke-width`, String(Math.max(1.4, o * 0.42))),
      e.setAttribute(`stroke-linecap`, `round`));
  };
  if (r === `happy`) return c(`M${t - o * 0.8},${n + 1.2} Q${t},${n - o} ${t + o * 0.8},${n + 1.2}`);
  if (r === `closed`) return c(`M${t - o * 0.8},${n} Q${t},${n + o * 0.6} ${t + o * 0.8},${n}`);
  (e.setAttribute(`fill`, a), e.setAttribute(`stroke`, `none`));
  let l = r === `wide` ? 1.25 : 1;
  e.setAttribute(`d`, V(t, n, o * l, Math.max(1.2, s * l * i)));
}
var U = (e) =>
  e === `music` || e === `done` ? `happy` : e === `sleep` ? `closed` : e === `attn` ? `wide` : `open`;
function W(e, t) {
  let n = (t * Math.PI) / 180;
  return [e * Math.cos(n), e * Math.sin(n)];
}
function ot(e) {
  return [0, 1, 2].map(() => B(`circle`, { r: 2, fill: `#AFA9EC` }, e));
}
function st(e, t, n, r, i) {
  e.forEach((e, a) => {
    ((e.style.display = t ? `` : `none`),
      e.setAttribute(`cx`, String(n + a * 7)),
      e.setAttribute(`cy`, (r - Math.max(0, Math.sin(i / 180 - a * 0.9)) * 3).toFixed(1)));
  });
}
function G(e) {
  let t = B(`text`, { "font-size": 10, "font-family": `sans-serif`, fill: `#888780` }, e);
  return ((t.textContent = `z`), t);
}
function K(e, t, n, r, i) {
  e.style.display = t ? `` : `none`;
  let a = (i / 1800) % 1;
  (e.setAttribute(`x`, (n + a * 8).toFixed(1)),
    e.setAttribute(`y`, (r - a * 18).toFixed(1)),
    e.setAttribute(`opacity`, (1 - a).toFixed(2)));
}
function q(e) {
  let t = B(`g`, {}, e);
  return (
    B(`circle`, { r: 7, fill: `#EF9F27` }, t),
    B(`rect`, { x: -1.2, y: -4.6, width: 2.4, height: 5.6, rx: 1.2, fill: `#412402` }, t),
    B(`circle`, { cy: 3.3, r: 1.3, fill: `#412402` }, t),
    t
  );
}
function J(e, t, n, r) {
  ((e.style.display = t ? `` : `none`), e.setAttribute(`transform`, `translate(${n},${r})`));
}
var Y = `#2C2C2A`,
  ct = {
    build(e) {
      ((this.body = B(`circle`, { r: 24 }, e)),
        B(`circle`, { cx: -9, cy: -11, r: 4, fill: `#FFFFFF`, opacity: 0.55 }, e),
        (this.l = B(`path`, {}, e)),
        (this.r = B(`path`, {}, e)));
    },
    draw(e) {
      (this.body.setAttribute(`fill`, e.s === `idle` ? `#F1EFE8` : e.c),
        H(this.l, -9 + e.lx, -2 + e.ly, U(e.s), e.blink, Y, 7, 12),
        H(this.r, 9 + e.lx, -2 + e.ly, U(e.s), e.blink, Y, 7, 12));
    },
  },
  lt = {
    build(e) {
      ((this.l = B(`path`, {}, e)),
        (this.r = B(`path`, {}, e)),
        (this.m = B(`path`, { fill: `none`, "stroke-width": 2.6, "stroke-linecap": `round` }, e)));
    },
    draw(e) {
      let t = e.s === `idle` ? `#F1EFE8` : e.c,
        n = U(e.s);
      (H(this.l, -15 + e.lx * 1.4, -4 + e.ly, n, e.blink, t, 13, 22),
        H(this.r, 15 + e.lx * 1.4, -4 + e.ly, n, e.blink, t, 13, 22),
        this.m.setAttribute(`stroke`, t),
        this.m.setAttribute(
          `d`,
          n === `happy` ? `M-7,16 Q0,23 7,16` : n === `wide` ? `M-3,18 a3,3 0 1,0 6,0 a3,3 0 1,0 -6,0` : ``,
        ));
    },
  },
  ut = {
    build(e) {
      (B(`path`, { d: `M0,-22 V-31`, stroke: `#B4B2A9`, "stroke-width": 2.5, "stroke-linecap": `round` }, e),
        (this.ant = B(`circle`, { cy: -34, r: 4 }, e)),
        B(`path`, { d: V(0, 0, 58, 44), fill: `#D3D1C7` }, e),
        B(`path`, { d: V(-31, 0, 6, 14), fill: `#B4B2A9` }, e),
        B(`path`, { d: V(31, 0, 6, 14), fill: `#B4B2A9` }, e),
        B(`path`, { d: V(0, 1, 44, 30), fill: Y }, e),
        (this.l = B(`path`, {}, e)),
        (this.r = B(`path`, {}, e)));
    },
    draw(e, t) {
      let n = e.s === `idle` ? `#5DCAA5` : e.c;
      (this.ant.setAttribute(`fill`, n),
        this.ant.setAttribute(
          `opacity`,
          e.s === `think` ? (0.4 + 0.6 * Math.abs(Math.sin(t / 200))).toFixed(2) : `1`,
        ),
        H(this.l, -9 + e.lx * 0.8, 1 + e.ly * 0.6, U(e.s), e.blink, n, 6, 11),
        H(this.r, 9 + e.lx * 0.8, 1 + e.ly * 0.6, U(e.s), e.blink, n, 6, 11));
    },
  },
  dt = {
    build(e) {
      ((this.earL = B(`g`, {}, e)),
        B(`path`, { d: `M-24,-8 L-19,-34 L-4,-21 Z`, fill: `#F1EFE8` }, this.earL),
        B(`path`, { d: `M-20,-12 L-17,-27 L-9,-19 Z`, fill: `#F4C0D1` }, this.earL),
        (this.earR = B(`g`, {}, e)),
        B(`path`, { d: `M24,-8 L19,-34 L4,-21 Z`, fill: `#F1EFE8` }, this.earR),
        B(`path`, { d: `M20,-12 L17,-27 L9,-19 Z`, fill: `#F4C0D1` }, this.earR),
        B(`ellipse`, { rx: 27, ry: 23, fill: `#F1EFE8` }, e),
        (this.l = B(`path`, {}, e)),
        (this.r = B(`path`, {}, e)),
        B(`path`, { d: `M-2.5,4 h5 l-2.5,3 z`, fill: `#ED93B1` }, e),
        B(
          `path`,
          {
            d: `M-5,9 q2.5,3 5,0 q2.5,3 5,0`,
            fill: `none`,
            stroke: Y,
            "stroke-width": 1.6,
            "stroke-linecap": `round`,
          },
          e,
        ),
        B(
          `path`,
          {
            d: `M-12,5 L-30,2 M-12,8 L-29,10 M12,5 L30,2 M12,8 L29,10`,
            stroke: `#888780`,
            "stroke-width": 1.2,
            "stroke-linecap": `round`,
          },
          e,
        ),
        (this.bell = B(`circle`, { cy: 24, r: 4.5 }, e)));
    },
    draw(e, t) {
      this.bell.setAttribute(`fill`, e.s === `idle` ? `#EF9F27` : e.c);
      let n = e.s === `attn` ? Math.sin(t / 60) * 8 : e.blink < 1 ? -6 : 0;
      (this.earL.setAttribute(`transform`, `rotate(${n},-14,-10)`),
        this.earR.setAttribute(`transform`, `rotate(${-n * 0.6},14,-10)`),
        H(this.l, -10 + e.lx, -4 + e.ly, U(e.s), e.blink, Y, 7, 11),
        H(this.r, 10 + e.lx, -4 + e.ly, U(e.s), e.blink, Y, 7, 11));
    },
  },
  ft = {
    build(e) {
      ((this.body = B(`path`, {}, e)),
        B(`ellipse`, { cx: -10, cy: -10, rx: 5, ry: 3.5, fill: `#FFFFFF`, opacity: 0.5 }, e),
        B(`ellipse`, { cx: -15, cy: 7, rx: 4, ry: 2.5, fill: `#ED93B1`, opacity: 0.7 }, e),
        B(`ellipse`, { cx: 15, cy: 7, rx: 4, ry: 2.5, fill: `#ED93B1`, opacity: 0.7 }, e),
        (this.l = B(`path`, {}, e)),
        (this.r = B(`path`, {}, e)));
    },
    draw(e, t) {
      let n = [],
        r = e.s === `music` ? 0.07 : 0.035;
      for (let e = 0; e < 24; e++) {
        let i = (e / 24) * Math.PI * 2,
          a = 1 + r * Math.sin(i * 3 + t / 260),
          o = Math.cos(i) * 28 * a,
          s = Math.sin(i) * 24 * a;
        (s > 16 && (s = 16 + (s - 16) * 0.25), n.push([o, s]));
      }
      let i = ``;
      for (let e = 0; e < 24; e++) {
        let t = n[e],
          r = n[(e + 1) % 24],
          a = [(t[0] + r[0]) / 2, (t[1] + r[1]) / 2];
        i +=
          (e ? `` : `M${((n[23][0] + t[0]) / 2).toFixed(1)},${((n[23][1] + t[1]) / 2).toFixed(1)}`) +
          `Q${t[0].toFixed(1)},${t[1].toFixed(1)} ${a[0].toFixed(1)},${a[1].toFixed(1)}`;
      }
      (this.body.setAttribute(`d`, i + `Z`),
        this.body.setAttribute(`fill`, e.s === `idle` ? `#F5C4B3` : e.c),
        H(this.l, -8 + e.lx, -1 + e.ly, U(e.s), e.blink, Y, 6, 10),
        H(this.r, 8 + e.lx, -1 + e.ly, U(e.s), e.blink, Y, 6, 10));
    },
  },
  pt = `#1b1b1a`,
  mt = (e) => ({ idle: 2600, music: 545, think: 1500, done: 700, attn: 900, sleep: 4200 })[e],
  ht = {
    build(e) {
      ((this.t = [0, 1, 2, 3].map(() =>
        B(`path`, { fill: `none`, "stroke-width": 2.4, "stroke-linecap": `round`, opacity: 0.85 }, e),
      )),
        (this.bell = B(`path`, {}, e)),
        (this.hl = B(
          `path`,
          { fill: `none`, stroke: `#FFFFFF`, "stroke-width": 3, "stroke-linecap": `round`, opacity: 0.25 },
          e,
        )),
        (this.l = B(`path`, {}, e)),
        (this.r = B(`path`, {}, e)),
        (this.z = G(e)));
    },
    draw(e, t) {
      let n = mt(e.s),
        r = (t % n) / n,
        i = r < 0.28 ? Math.sin((r / 0.28) * Math.PI) : 0,
        a = 46 * (1 - 0.13 * i),
        o = 30 * (1 + 0.1 * i),
        s = (e.s === `sleep` ? 4 : 0) - 5 * i + Math.sin(t / 1100) * 1.5 - e.poke * 6,
        c = e.s === `idle` ? `#5DCAA5` : e.c;
      (this.bell.setAttribute(
        `d`,
        `M${-a / 2},${4 + s} Q${-a / 2},${-o + 4 + s} 0,${-o + 4 + s} Q${a / 2},${-o + 4 + s} ${a / 2},${4 + s} Q${a / 4},${8 + s} 0,${5 + s} Q${-a / 4},${8 + s} ${-a / 2},${4 + s}Z`,
      ),
        this.bell.setAttribute(`fill`, c),
        this.hl.setAttribute(
          `d`,
          `M${-a * 0.32},${-o * 0.45 + 4 + s} Q${-a * 0.28},${-o * 0.85 + 4 + s} ${-a * 0.05},${-o * 0.88 + 4 + s}`,
        ));
      let l = (e.s === `sleep` ? 27 : 24) * (1 - 0.15 * i),
        u = e.s === `attn` ? 1.6 : 1;
      (this.t.forEach((n, r) => {
        let a = (-15 + r * 10) * u * (1 + 0.15 * i),
          o = e.s === `sleep` ? 1.5 : 5,
          d = t / (e.s === `music` ? 160 : 330);
        (n.setAttribute(
          `d`,
          `M${(-15 + r * 10) * 0.85},${6 + s} Q${a + Math.sin(d + r) * o},${6 + s + l / 2} ${a * 1.1 + Math.sin(d + r + 1.5) * o * 0.8},${6 + s + l}`,
        ),
          n.setAttribute(`stroke`, c));
      }),
        H(this.l, -8 + e.lx * 0.7, -9 + s + e.ly * 0.5, U(e.s), e.blink, pt, 4.5, 7),
        H(this.r, 8 + e.lx * 0.7, -9 + s + e.ly * 0.5, U(e.s), e.blink, pt, 4.5, 7),
        K(this.z, e.s === `sleep`, 22, -12, t));
    },
  },
  gt = {
    build(e) {
      this.sw = B(`g`, {}, e);
      let t = this.sw;
      (B(
        `path`,
        {
          d: `M-11,-56 Q-16,-34 -14,-14`,
          fill: `none`,
          stroke: `#8A6A52`,
          "stroke-width": 7,
          "stroke-linecap": `round`,
        },
        t,
      ),
        B(
          `path`,
          {
            d: `M11,-56 Q16,-34 14,-14`,
            fill: `none`,
            stroke: `#8A6A52`,
            "stroke-width": 7,
            "stroke-linecap": `round`,
          },
          t,
        ),
        B(
          `path`,
          {
            d: `M-14,-55 v4 M-11,-55 v4 M-8,-55 v4 M8,-55 v4 M11,-55 v4 M14,-55 v4`,
            stroke: `#D3D1C7`,
            "stroke-width": 1.3,
            "stroke-linecap": `round`,
          },
          t,
        ),
        B(`ellipse`, { cx: 0, cy: 0, rx: 22, ry: 20, fill: `#8A6A52` }, t),
        B(`ellipse`, { cx: 0, cy: 3, rx: 15.5, ry: 12.5, fill: `#E8D9C0` }, t),
        B(`ellipse`, { cx: -7, cy: 0, rx: 6.5, ry: 4, fill: `#5B3F2E`, transform: `rotate(-22,-7,0)` }, t),
        B(`ellipse`, { cx: 7, cy: 0, rx: 6.5, ry: 4, fill: `#5B3F2E`, transform: `rotate(22,7,0)` }, t),
        (this.l = B(`path`, {}, t)),
        (this.r = B(`path`, {}, t)),
        B(`ellipse`, { cx: 0, cy: 6, rx: 3, ry: 2, fill: `#3D2B20` }, t),
        (this.m = B(
          `path`,
          { fill: `none`, stroke: `#3D2B20`, "stroke-width": 1.4, "stroke-linecap": `round` },
          t,
        )),
        (this.fl = B(`g`, { transform: `translate(11,-17)` }, t)),
        (this.pet = [0, 1, 2, 3, 4].map((e) =>
          B(
            `circle`,
            {
              cx: (Math.cos(e * 1.257) * 3.6).toFixed(1),
              cy: (Math.sin(e * 1.257) * 3.6).toFixed(1),
              r: 2.8,
            },
            this.fl,
          ),
        )),
        B(`circle`, { r: 2, fill: `#FAC775` }, this.fl),
        (this.z = G(e)));
    },
    draw(e, t, n) {
      let r = Math.sin(t / 1400) * 4;
      (e.s === `music` && (r = Math.sin((t / 545) * Math.PI) * 10),
        e.s === `done` && (r = Math.sin(n / 260) * 16 * Math.exp(-n / 2200) + Math.sin(t / 1400) * 3),
        e.s === `attn` && (r = 0),
        e.s === `sleep` && (r = Math.sin(t / 2600) * 2),
        e.s === `think` && (r = Math.sin(t / 2200) * 2),
        (r += e.poke * 12),
        this.sw.setAttribute(`transform`, `rotate(${r.toFixed(2)},0,-56)`),
        this.pet.forEach((t) => t.setAttribute(`fill`, e.s === `idle` ? `#ED93B1` : e.c)));
      let i = U(e.s);
      (H(this.l, -7 + e.lx * 0.5, e.ly * 0.4, i, e.blink, `#111`, 3.4, 4.2),
        H(this.r, 7 + e.lx * 0.5, e.ly * 0.4, i, e.blink, `#111`, 3.4, 4.2),
        this.m.setAttribute(
          `d`,
          e.s === `attn` ? `M-2,10 a2,2 0 1,0 4,0 a2,2 0 1,0 -4,0` : `M-4,9 Q0,12 4,9`,
        ),
        K(this.z, e.s === `sleep`, 22, -10, t));
    },
  },
  _t = {
    build(e) {
      ((this.stars = [
        [-40, -30],
        [38, -26],
        [-34, 20],
        [42, 18],
        [0, -40],
      ].map(([t, n]) => B(`circle`, { cx: t, cy: n, r: 1.2, fill: `#FFFFFF` }, e))),
        (this.b = B(`g`, {}, e)));
      let t = this.b;
      (B(`path`, { d: V(0, 4, 34, 30), fill: `#B4B2A9` }, t),
        B(`path`, { d: V(0, 16, 24, 20), fill: `#F1EFE8` }, t),
        (this.al = B(`path`, { d: V(0, 0, 7, 16), fill: `#F1EFE8` }, t)),
        (this.ar = B(`path`, { d: V(0, 0, 7, 16), fill: `#F1EFE8` }, t)),
        B(`circle`, { cx: 0, cy: -4, r: 21, fill: `#F1EFE8` }, t),
        (this.vis = B(`ellipse`, { cx: 0, cy: -3, rx: 15, ry: 11 }, t)),
        B(`ellipse`, { cx: -7, cy: -8, rx: 4, ry: 2.2, fill: `#FFFFFF`, opacity: 0.55 }, t),
        B(
          `path`,
          { d: `M13,-20 L17,-29`, stroke: `#B4B2A9`, "stroke-width": 2, "stroke-linecap": `round` },
          t,
        ),
        (this.tip = B(`circle`, { cx: 17.5, cy: -30.5, r: 2.6 }, t)),
        (this.l = B(`path`, {}, t)),
        (this.r = B(`path`, {}, t)),
        (this.z = G(e)));
    },
    draw(e, t, n) {
      let r = Math.sin(t / 1300) * 4,
        i = Math.sin(t / 2100) * 9;
      (e.s === `music` &&
        ((i = Math.sin((t / 545) * Math.PI) * 12), (r = -Math.abs(Math.sin((t / 545) * Math.PI)) * 5)),
        e.s === `done` && (i = n < 900 ? (n / 900) * 360 : Math.sin(t / 1300) * 6),
        e.s === `attn` && (i = n % 1400 < 300 ? Math.sin(n / 25) * 6 : 0),
        e.s === `sleep` && ((i = Math.sin(t / 3200) * 14), (r = Math.sin(t / 2400) * 3 + 4)),
        (r -= e.poke * 10),
        this.b.setAttribute(`transform`, `translate(0,${r.toFixed(2)}) rotate(${i.toFixed(2)})`));
      let a = e.s === `idle` ? `#85B7EB` : e.c;
      (this.vis.setAttribute(`fill`, a),
        this.tip.setAttribute(`fill`, a),
        this.tip.setAttribute(
          `opacity`,
          e.s === `think` ? (0.3 + 0.7 * Math.abs(Math.sin(t / 180))).toFixed(2) : `1`,
        ));
      let o = e.s === `done` && n > 900 ? Math.sin(t / 120) * 35 : 0;
      (this.al.setAttribute(`transform`, `translate(-15,14) rotate(30)`),
        this.ar.setAttribute(`transform`, `translate(15,14) rotate(${-30 - o})`));
      let s = U(e.s),
        c = e.s === `think` ? -3 : 0;
      (H(this.l, -5 + e.lx * 0.8, -3 + e.ly * 0.6 + c, s, e.blink, pt, 3.6, 5.5),
        H(this.r, 5 + e.lx * 0.8, -3 + e.ly * 0.6 + c, s, e.blink, pt, 3.6, 5.5),
        this.stars.forEach((e, n) =>
          e.setAttribute(`opacity`, (0.25 + 0.6 * Math.abs(Math.sin(t / (700 + n * 230) + n))).toFixed(2)),
        ),
        K(this.z, e.s === `sleep`, 22, -18, t));
    },
  },
  vt = {
    build(e) {
      ((this.stem = B(
        `path`,
        { fill: `none`, stroke: `#639922`, "stroke-width": 3, "stroke-linecap": `round` },
        e,
      )),
        (this.lf1 = B(`path`, { d: `M0,0 Q-9,-8 -18,-2 Q-9,4 0,0Z`, fill: `#97C459` }, e)),
        (this.lf2 = B(`path`, { d: `M0,0 Q9,-8 18,-2 Q9,4 0,0Z`, fill: `#97C459` }, e)),
        (this.fl = B(`g`, {}, e)),
        (this.pet = [0, 1, 2, 3, 4, 5].map((e) =>
          B(`ellipse`, { cx: 0, cy: -5, rx: 2.8, ry: 5, transform: `rotate(${e * 60})` }, this.fl),
        )),
        (this.bud = B(`circle`, { r: 3.6 }, this.fl)),
        B(`path`, { d: `M-15,6 L15,6 L11,30 L-11,30Z`, fill: `#D85A30` }, e),
        B(`path`, { d: V(0, 6, 36, 8), fill: `#F0997B` }, e),
        (this.l = B(`path`, {}, e)),
        (this.r = B(`path`, {}, e)),
        (this.m = B(
          `path`,
          { fill: `none`, stroke: `#4A1B0C`, "stroke-width": 1.6, "stroke-linecap": `round` },
          e,
        )),
        (this.z = G(e)));
    },
    draw(e, t, n) {
      let r = 0,
        i = Math.sin(t / 1500) * 6,
        a = -10,
        o = 10,
        s = 0;
      if (e.s === `music`) {
        let e = (t % 545) / 545;
        ((r = -Math.abs(Math.sin(e * Math.PI)) * 4), (i = Math.sin((t / 545) * Math.PI) * 16), (s = 0.55));
      }
      (e.s === `think` && ((i = Math.sin(t / 2600) * 3), (a = 8), (o = -8)),
        e.s === `done` && ((s = Math.min(1, n / 600)), (i = Math.sin(t / 700) * 8)),
        e.s === `attn` && ((a = -45), (o = 45), (i = 0)),
        e.s === `sleep` && ((a = 40), (o = -40), (i = Math.sin(t / 3e3) * 2)),
        (r -= e.poke * 8));
      let c = -30 + (e.s === `sleep` ? 6 : 0);
      (this.stem.setAttribute(`d`, `M0,${6 + r} Q${i * 0.4},${-10 + r} ${i},${c + r}`),
        this.lf1.setAttribute(`transform`, `translate(${i * 0.35},${-8 + r}) rotate(${a + i})`),
        this.lf2.setAttribute(`transform`, `translate(${i * 0.6},${-17 + r}) rotate(${o + i})`),
        this.fl.setAttribute(`transform`, `translate(${i},${c + r})`));
      let l = e.s === `done` ? `#ED93B1` : e.c;
      (this.pet.forEach((e) => {
        (e.setAttribute(`fill`, l),
          e.setAttribute(`ry`, (5 * s).toFixed(2)),
          e.setAttribute(`cy`, (-5 * s).toFixed(2)));
      }),
        this.bud.setAttribute(`fill`, s > 0.1 ? `#FAC775` : `#639922`));
      let u = U(e.s);
      (H(this.l, -5 + e.lx * 0.6, 17 + r + e.ly * 0.4, u, e.blink, `#4A1B0C`, 3.2, 4.5),
        H(this.r, 5 + e.lx * 0.6, 17 + r + e.ly * 0.4, u, e.blink, `#4A1B0C`, 3.2, 4.5),
        this.m.setAttribute(
          `d`,
          e.s === `attn`
            ? `M-1.8,${23 + r} a1.8,1.8 0 1,0 3.6,0 a1.8,1.8 0 1,0 -3.6,0`
            : e.s === `sleep`
              ? `M-3,${23 + r} H3`
              : `M-3.5,${22 + r} Q0,${25 + r} 3.5,${22 + r}`,
        ),
        K(this.z, e.s === `sleep`, 20, -16, t));
    },
  },
  yt = {
    build(e) {
      ((this.N = 40), (this.d = []));
      for (let t = 0; t < this.N; t++) {
        let n = (t / this.N) * Math.PI * 2;
        this.d.push({ x: Math.cos(n) * 16, y: Math.sin(n) * 16, vx: 0, vy: 0, e: B(`circle`, { r: 2 }, e) });
      }
    },
    target(e, t, n, r) {
      if (e === `music`) {
        let e = (t / (n - 1) - 0.5) * 92,
          i = 4 + 10 * Math.abs(Math.sin((r / 545) * Math.PI));
        return [e, Math.sin(t * 0.55 + r / 170) * i];
      }
      if (e === `think`) {
        let e = (t / n) * Math.PI * 2 + r / 420;
        return [Math.cos(e) * 19, Math.sin(e) * 19];
      }
      if (e === `done`) {
        let e = t / (n - 1),
          r = [
            [-20, 0],
            [-7, 13],
            [22, -16],
          ],
          i = e < 0.3 ? 0 : 1,
          a = i ? (e - 0.3) / 0.7 : e / 0.3,
          o = r[i],
          s = r[i + 1];
        return [o[0] + (s[0] - o[0]) * a, o[1] + (s[1] - o[1]) * a];
      }
      if (e === `attn`) {
        if (t < n - 6) {
          let e = t / (n - 7);
          return [Math.sin(t) * 1.5, -24 + e * 28];
        }
        let e = (t / 6) * Math.PI * 2;
        return [Math.cos(e) * 2.5, 15 + Math.sin(e) * 2.5];
      }
      if (e === `sleep`) {
        let e = t * 2.4 + r / 6e3,
          n = 3 + (t % 7) * 1.4;
        return [Math.cos(e) * n * 1.4, 14 + Math.sin(e) * n * 0.6];
      }
      let i = (t / n) * Math.PI * 2 + r / 5200,
        a = 15 + 3 * Math.sin(r / 900 + t * 1.7);
      return [Math.cos(i) * a * 1.25, Math.sin(i) * a * 0.9];
    },
    draw(e, t, n, r) {
      let i = e.s === `idle` ? `#85B7EB` : e.c;
      this.d.forEach((n, a) => {
        let [o, s] = this.target(e.s, a, this.N, t),
          c = e.s === `think` ? 140 : 60,
          l = e.s === `think` ? 16 : 9;
        ((n.vx += (-c * (n.x - o) - l * n.vx) * r),
          (n.vy += (-c * (n.y - s + e.poke * 14) - l * n.vy) * r),
          (n.x += n.vx * r),
          (n.y += n.vy * r),
          n.e.setAttribute(`cx`, n.x.toFixed(1)),
          n.e.setAttribute(`cy`, n.y.toFixed(1)),
          n.e.setAttribute(`fill`, i),
          n.e.setAttribute(
            `opacity`,
            e.s === `think`
              ? (0.25 + 0.75 * ((a / this.N + t / 2600) % 1)).toFixed(2)
              : e.s === `sleep`
                ? `0.5`
                : `0.9`,
          ));
      });
    },
  },
  bt = {
    build(e) {
      ((this.f = B(
        `text`,
        {
          "text-anchor": `middle`,
          "dominant-baseline": `central`,
          "font-size": 19,
          "font-family": `'Segoe UI Symbol','Meiryo','Yu Gothic',sans-serif`,
        },
        e,
      )),
        (this.x = B(
          `text`,
          {
            "text-anchor": `middle`,
            "font-size": 11,
            "font-family": `'Segoe UI Symbol',sans-serif`,
            fill: `#888780`,
          },
          e,
        )));
    },
    draw(e, t, n) {
      let r = `(・ω・)`,
        i = ``,
        a = 0,
        o = 0;
      (e.s === `idle` &&
        (r = e.blink < 0.5 ? `(－ω－)` : e.lx < -1.5 ? `(・ω・ )` : e.lx > 1.5 ? `( ・ω・)` : `(・ω・)`),
        e.s === `music` &&
          ((r = Math.floor(t / 545) % 2 ? `~(˘▾˘~)` : `(~˘▾˘)~`),
          (i = `♪   ♫`),
          (o = -Math.abs(Math.sin((t / 545) * Math.PI)) * 4)),
        e.s === `think` && ((r = `(・_・ )`), (i = `.`.repeat(Math.floor(t / 350) % 4))),
        e.s === `done` &&
          ((r = Math.floor(t / 300) % 2 ? `\\(^o^)/` : `ヽ(^o^)ノ`),
          (o = -Math.abs(Math.sin(n / 260)) * 6 * Math.exp(-n / 2500))),
        e.s === `attn` && ((r = `(°ロ°) !`), (a = n % 1400 < 300 ? Math.sin(n / 25) * 3 : 0)),
        e.s === `sleep` && ((r = `(－_－)`), (i = `z z Z`)),
        (o -= e.poke * 8),
        (this.f.textContent = r),
        this.f.setAttribute(`x`, a.toFixed(1)),
        this.f.setAttribute(`y`, o.toFixed(1)),
        this.f.setAttribute(`fill`, e.s === `idle` ? `#F1EFE8` : e.c),
        (this.x.textContent = i),
        this.x.setAttribute(`x`, `0`),
        this.x.setAttribute(`y`, (-20 + o).toFixed(1)));
    },
  },
  xt = [
    {
      id: `hamster`,
      name: `Хомяк в колесе`,
      desc: `Бежит в колесе: чем больше дел, тем быстрее. Под музыку несётся, когда тебя нет, спит прямо в колесе.`,
      build(e) {
        (B(
          `path`,
          {
            d: `M-15,40 L0,0 L15,40`,
            fill: `none`,
            stroke: `#5F5E5A`,
            "stroke-width": 3,
            "stroke-linecap": `round`,
          },
          e,
        ),
          (this.sp = B(`g`, {}, e)));
        for (let e = 0; e < 8; e++) {
          let [t, n] = W(30, e * 45);
          B(
            `path`,
            { d: `M0,0 L${t.toFixed(1)},${n.toFixed(1)}`, stroke: `#444441`, "stroke-width": 1.2 },
            this.sp,
          );
        }
        ((this.rim = B(`circle`, { r: 30, fill: `none`, "stroke-width": 3 }, e)),
          B(`circle`, { r: 3, fill: `#888780` }, e),
          (this.h = B(`g`, {}, e)));
        let t = this.h;
        ((this.f1 = B(`ellipse`, { rx: 2.6, ry: 1.8, fill: `#F4C0D1` }, t)),
          (this.f2 = B(`ellipse`, { rx: 2.6, ry: 1.8, fill: `#F4C0D1` }, t)),
          B(`ellipse`, { cx: 0, cy: 0, rx: 13, ry: 10, fill: `#E8B47A` }, t),
          B(`ellipse`, { cx: 2, cy: 3.5, rx: 8, ry: 5.5, fill: `#F7E7D0` }, t),
          B(`circle`, { cx: 7, cy: -8.5, r: 3.4, fill: `#E8B47A` }, t),
          B(`circle`, { cx: 7, cy: -8.5, r: 1.9, fill: `#F4C0D1` }, t),
          (this.e = B(`path`, {}, t)),
          B(`circle`, { cx: 13.2, cy: 0, r: 1.5, fill: `#ED93B1` }, t),
          (this.ang = 0),
          (this.z = G(e)),
          (this.d = ot(e)),
          (this.b = q(e)));
      },
      draw(e, t, n, r) {
        let i = {
          idle: 0.9,
          music: 5.5,
          think: 2,
          done: n < 600 ? 0 : Math.max(0, 7 * Math.exp(-(n - 600) / 900)),
          attn: 0,
          sleep: 0,
        }[e.s];
        ((this.ang -= i * r * 57.3),
          this.sp.setAttribute(`transform`, `rotate(${this.ang.toFixed(1)})`),
          this.rim.setAttribute(`stroke`, e.s === `idle` ? `#B4B2A9` : e.c));
        let a = e.s === `idle` || e.s === `music` || e.s === `think`,
          o = (this.ang / 57.3) * (e.s === `music` ? 2.4 : 3),
          s = 17 - (a ? Math.abs(Math.sin(o)) * 2 : 0),
          c = 1,
          l = 0;
        (e.s === `done` && n < 1400 && (s -= Math.abs(Math.sin(n / 230)) * 14 * Math.exp(-n / 700)),
          e.s === `attn` && ((s = 14), (l = -18)),
          e.s === `sleep` && ((s = 19), (c = 0.82)),
          (s -= e.poke * 10),
          this.h.setAttribute(`transform`, `translate(0,${s.toFixed(1)}) rotate(${l}) scale(1,${c})`));
        let u = a ? Math.sin(o * 2) * 4 : 0;
        (this.f1.setAttribute(`cx`, (-6 + u).toFixed(1)),
          this.f1.setAttribute(`cy`, 9),
          this.f2.setAttribute(`cx`, (6 - u).toFixed(1)),
          this.f2.setAttribute(`cy`, 9),
          (this.f1.style.display = this.f2.style.display = e.s === `sleep` ? `none` : ``),
          H(this.e, 8 + e.lx * 0.3, -2 + e.ly * 0.3, U(e.s), e.blink, `#1b1b1a`, 2.6, 3.4),
          K(this.z, e.s === `sleep`, 18, -14, t),
          st(this.d, e.s === `think`, -7, -40, t),
          J(this.b, e.s === `attn`, 22, -24));
      },
    },
    {
      id: `stick`,
      name: `Человечек`,
      desc: `Нарисован одной линией и показывает всё телом: танцует, чешет подбородок, машет руками, дремлет сидя.`,
      build(e) {
        let t = { fill: `none`, "stroke-width": 3, "stroke-linecap": `round`, "stroke-linejoin": `round` };
        ((this.body = B(`path`, t, e)),
          (this.head = B(`circle`, { r: 6.5, fill: `#000`, "stroke-width": 3 }, e)),
          (this.e1 = B(`circle`, { r: 1.3 }, e)),
          (this.e2 = B(`circle`, { r: 1.3 }, e)),
          (this.q = {
            tor: 0,
            la1: -12,
            la2: -4,
            ra1: 12,
            ra2: 4,
            ll1: -8,
            ll2: -2,
            rl1: 8,
            rl2: 2,
            hy: 0,
            hx: 0,
            tilt: 0,
          }),
          (this.d = ot(e)),
          (this.z = G(e)),
          (this.b = q(e)));
      },
      draw(e, t, n, r) {
        let i = Math.sin((t / 545) * Math.PI),
          a = {
            tor: Math.sin(t / 1500) * 1.5,
            la1: -12,
            la2: -4,
            ra1: 12,
            ra2: 4,
            ll1: -8,
            ll2: -2,
            rl1: 8,
            rl2: 2,
            hy: 0,
            hx: 0,
            tilt: Math.sin(t / 2300) * 6,
          };
        if (
          (e.s === `music` &&
            Object.assign(a, {
              tor: i * 8,
              la1: -150 + 40 * i,
              la2: -150 + 40 * i,
              ra1: 150 + 40 * i,
              ra2: 150 + 40 * i,
              ll1: -14 - 10 * i,
              ll2: 6,
              rl1: 14 - 10 * i,
              rl2: -6,
              hy: -Math.abs(i) * 3,
              hx: i * 3,
              tilt: i * 10,
            }),
          e.s === `think` &&
            Object.assign(a, {
              tor: 4,
              la1: -25,
              la2: -110,
              ra1: 150,
              ra2: -150,
              ll1: -6,
              ll2: 0,
              rl1: 12,
              rl2: 4,
              tilt: -12,
            }),
          e.s === `done`)
        ) {
          let e = Math.abs(Math.sin(n / 260)) * Math.exp(-n / 2600);
          Object.assign(a, {
            la1: -155,
            la2: -160,
            ra1: 155,
            ra2: 160,
            ll1: -25 * e,
            ll2: 50 * e,
            rl1: 25 * e,
            rl2: -50 * e,
            hy: -e * 14,
          });
        }
        if (e.s === `attn`) {
          let e = Math.sin(t / 90);
          Object.assign(a, { la1: -140, la2: -140 + 45 * e, ra1: 140, ra2: 140 - 45 * e });
        }
        (e.s === `sleep` &&
          Object.assign(a, {
            tor: 18,
            la1: 20,
            la2: 30,
            ra1: 35,
            ra2: 50,
            ll1: 80,
            ll2: 85,
            rl1: 76,
            rl2: 90,
            hy: 14,
            tilt: 30,
          }),
          (a.hy -= e.poke * 10));
        let o = this.q,
          s = Math.min(1, r * (e.s === `music` || e.s === `attn` ? 20 : 8));
        for (let e in a) o[e] += (a[e] - o[e]) * s;
        let c = (e) => [Math.sin((e * Math.PI) / 180), Math.cos((e * Math.PI) / 180)],
          l = [o.hx, 12 + o.hy],
          u = [Math.sin((o.tor * Math.PI) / 180), -Math.cos((o.tor * Math.PI) / 180)],
          d = [l[0] + u[0] * 17, l[1] + u[1] * 17],
          f = [l[0] + u[0] * 14, l[1] + u[1] * 14],
          p = [d[0] + u[0] * 7, d[1] + u[1] * 7],
          m = (e, t, n, r, i) => {
            let a = c(t),
              o = [e[0] + a[0] * r, e[1] + a[1] * r],
              s = c(n);
            return [o, [o[0] + s[0] * i, o[1] + s[1] * i]];
          },
          [h, g] = m(f, o.la1, o.la2, 9, 8),
          [_, v] = m(f, o.ra1, o.ra2, 9, 8),
          [ee, te] = m(l, o.ll1, o.ll2, 11, 11),
          [y, b] = m(l, o.rl1, o.rl2, 11, 11),
          x = (e) => e.map((e) => e.toFixed(1)).join(`,`);
        this.body.setAttribute(
          `d`,
          `M${x(l)} L${x(d)} M${x(g)} L${x(h)} L${x(f)} L${x(_)} L${x(v)} M${x(te)} L${x(ee)} L${x(l)} L${x(y)} L${x(b)}`,
        );
        let S = e.c;
        (this.body.setAttribute(`stroke`, S),
          this.head.setAttribute(`stroke`, S),
          this.head.setAttribute(`cx`, p[0].toFixed(1)),
          this.head.setAttribute(`cy`, p[1].toFixed(1)));
        let ne = e.s !== `sleep` && e.blink > 0.5;
        ([this.e1, this.e2].forEach((t, n) => {
          (t.setAttribute(`cx`, (p[0] + (n ? 2.4 : -2.4) + e.lx * 0.4).toFixed(1)),
            t.setAttribute(`cy`, (p[1] - 0.5 + e.ly * 0.3).toFixed(1)),
            t.setAttribute(`fill`, S),
            (t.style.display = ne ? `` : `none`));
        }),
          st(this.d, e.s === `think`, p[0] + 9, p[1] - 8, t),
          K(this.z, e.s === `sleep`, p[0] + 8, p[1] - 6, t),
          J(this.b, e.s === `attn`, p[0] + 16, p[1] - 6));
      },
    },
    {
      id: `koi`,
      name: `Рыбка-кои`,
      desc: `Плавает из края в край острова. Под музыку выписывает волны, от радости выпрыгивает, спит на дне.`,
      pillScale: 0.42,
      build(e) {
        ((this.bub = [0, 1, 2].map(() =>
          B(`circle`, { r: 2, fill: `none`, stroke: `#85B7EB`, "stroke-width": 1.2 }, e),
        )),
          (this.f = B(`g`, {}, e)));
        let t = this.f;
        ((this.tail = B(`path`, { d: `M0,0 L-10,-8 Q-6,0 -10,8 Z` }, t)),
          B(`ellipse`, { cx: 1, cy: 6, rx: 4, ry: 2, fill: `#D3D1C7`, transform: `rotate(30,1,6)` }, t),
          B(`path`, { d: `M20,0 C14,-9 -4,-9 -12,-3 L-17,0 L-12,3 C-4,9 14,9 20,0 Z`, fill: `#F1EFE8` }, t),
          (this.p1 = B(`ellipse`, { cx: 5, cy: -3, rx: 6, ry: 3.6 }, t)),
          (this.p2 = B(`ellipse`, { cx: -6, cy: 2, rx: 4.5, ry: 2.6 }, t)),
          (this.e = B(`path`, {}, t)),
          (this.x = -30),
          (this.dir = 1),
          (this.fx = 1),
          (this.z = G(e)),
          (this.b = q(e)));
      },
      draw(e, t, n, r) {
        let i = { idle: 16, music: 42, think: 0, done: 0, attn: 0, sleep: 0 }[e.s];
        ((this.x += i * this.dir * r),
          this.x > 58 && (this.dir = -1),
          this.x < -58 && (this.dir = 1),
          (this.fx += (this.dir - this.fx) * Math.min(1, r * 4)));
        let a = Math.sin(t / 1700) * 5,
          o = 0;
        if (
          (e.s === `music` &&
            ((a = Math.sin((t / 545) * Math.PI) * 8), (o = Math.cos((t / 545) * Math.PI) * 20)),
          e.s === `done` && n < 1600)
        ) {
          let e = n / 1600;
          ((a = -Math.sin(e * Math.PI) * 28), (o = -Math.cos(e * Math.PI) * 45));
        }
        (e.s === `sleep` && (a = 12), (a -= e.poke * 8));
        let s =
          Math.sin(t / (e.s === `music` ? 110 : e.s === `sleep` ? 900 : 280)) * (e.s === `sleep` ? 6 : 22);
        (this.tail.setAttribute(`transform`, `translate(-16,0) rotate(${s.toFixed(1)})`),
          this.f.setAttribute(
            `transform`,
            `translate(${this.x.toFixed(1)},${a.toFixed(1)}) scale(${this.fx.toFixed(3)},1) rotate(${(o * this.dir).toFixed(1)})`,
          ));
        let c = e.s === `idle` ? `#D85A30` : e.c;
        ([this.tail, this.p1, this.p2].forEach((e) => e.setAttribute(`fill`, c)),
          H(this.e, 14, -2, U(e.s), e.blink, `#1b1b1a`, 2.4, 2.8));
        let l = e.s === `think` || e.s === `idle` || e.s === `sleep`;
        (this.bub.forEach((n, r) => {
          let i = (t / (e.s === `think` ? 900 : 2600) + r / 3) % 1;
          ((n.style.display = l ? `` : `none`),
            n.setAttribute(`cx`, (this.x + this.fx * 20 + Math.sin(i * 9) * 2).toFixed(1)),
            n.setAttribute(`cy`, (a - 2 - i * 16).toFixed(1)),
            n.setAttribute(`r`, (1.2 + i * 1.8).toFixed(1)),
            n.setAttribute(`opacity`, (1 - i).toFixed(2)));
        }),
          K(this.z, e.s === `sleep`, this.x + 14, a - 8, t),
          J(this.b, e.s === `attn`, this.x + this.fx * 26, a - 10));
      },
    },
    {
      id: `snail`,
      name: `Улитка`,
      desc: `Медленно ползёт по острову. Рожки вытягиваются от любопытства, а когда никого нет, прячется в домик.`,
      build(e) {
        this.w = B(`g`, {}, e);
        let t = this.w;
        this.bd = B(`g`, {}, t);
        let n = this.bd;
        (B(
          `path`,
          {
            d: `M-24,30 Q-24,24 -12,24 L10,24 Q17,22 19,13 Q21,6 26,8 Q30,14 26,24 Q23,30 14,30 Z`,
            fill: `#D3C3A8`,
          },
          n,
        ),
          (this.s1 = B(
            `path`,
            { fill: `none`, stroke: `#D3C3A8`, "stroke-width": 2.2, "stroke-linecap": `round` },
            n,
          )),
          (this.s2 = B(
            `path`,
            { fill: `none`, stroke: `#D3C3A8`, "stroke-width": 2.2, "stroke-linecap": `round` },
            n,
          )),
          (this.e1 = B(`path`, {}, n)),
          (this.e2 = B(`path`, {}, n)),
          (this.m = B(
            `path`,
            { fill: `none`, stroke: `#5B3F2E`, "stroke-width": 1.3, "stroke-linecap": `round` },
            n,
          )),
          (this.sh = B(`g`, {}, t)),
          (this.shc = B(`circle`, { cx: 0, cy: 0, r: 15 }, this.sh)),
          B(
            `path`,
            {
              d: `M0,0 m-2,1 a3,3 0 1,1 5,-2 a6,6 0 1,1 -9,6 a9.5,9.5 0 1,1 15,-9`,
              fill: `none`,
              stroke: `#5B3F2E`,
              "stroke-width": 1.8,
              "stroke-linecap": `round`,
              opacity: 0.55,
            },
            this.sh,
          ),
          (this.x = -10),
          (this.dir = 1),
          (this.fx = 1),
          (this.ext = 1),
          (this.d = ot(e)),
          (this.z = G(e)),
          (this.b = q(e)));
      },
      draw(e, t, n, r) {
        let i = e.s === `idle` ? 5 : 0;
        ((this.x += i * this.dir * r),
          this.x > 30 && (this.dir = -1),
          this.x < -30 && (this.dir = 1),
          (this.fx += (this.dir - this.fx) * Math.min(1, r * 3)));
        let a = e.s === `sleep` ? 0 : e.s === `attn` ? 1.35 : 1;
        this.ext += (a - this.ext) * Math.min(1, r * (e.s === `sleep` ? 2 : 6));
        let o = 0,
          s = Math.sin(t / 1600) * 2;
        (e.s === `music` &&
          ((o = -Math.abs(Math.sin((t / 545) * Math.PI)) * 4), (s = Math.sin((t / 545) * Math.PI) * 9)),
          e.s === `done` && (o = -Math.abs(Math.sin(n / 250)) * 8 * Math.exp(-n / 2e3)),
          (o -= e.poke * 6),
          this.w.setAttribute(
            `transform`,
            `translate(${this.x.toFixed(1)},${o.toFixed(1)}) scale(${this.fx.toFixed(3)},1)`,
          ),
          this.bd.setAttribute(
            `transform`,
            `translate(${(-14 * (1 - Math.min(1, this.ext))).toFixed(1)},0) scale(${(0.5 + 0.5 * Math.min(1, this.ext)).toFixed(3)},1)`,
          ),
          (this.bd.style.opacity = this.ext < 0.15 ? 0 : 1));
        let c =
            e.s === `music`
              ? Math.sin((t / 545) * Math.PI) * 14
              : e.s === `think`
                ? -18
                : Math.sin(t / 900) * 6,
          l = 13 * this.ext,
          u = (e, t, n) => {
            let r = ((n - 90) * Math.PI) / 180;
            return [e + Math.cos(r) * l, t + Math.sin(r) * l];
          },
          [d, f] = u(21, 10, 8 + c),
          [p, m] = u(25, 10, 28 + c * (e.s === `think` ? 0 : 0.7));
        (this.s1.setAttribute(`d`, `M21,10 L${d.toFixed(1)},${f.toFixed(1)}`),
          this.s2.setAttribute(`d`, `M25,10 L${p.toFixed(1)},${m.toFixed(1)}`));
        let h = U(e.s);
        (H(this.e1, d, f, h === `open` ? `open` : h, e.blink, `#1b1b1a`, 3, 3.2),
          H(this.e2, p, m, h === `open` ? `open` : h, e.blink, `#1b1b1a`, 3, 3.2),
          this.m.setAttribute(`d`, `M22,18 Q24.5,20 27,18`),
          this.sh.setAttribute(`transform`, `translate(-2,11) rotate(${s.toFixed(1)})`),
          this.shc.setAttribute(`fill`, e.s === `idle` ? `#D85A30` : e.c),
          st(this.d, e.s === `think`, this.x + 12, -14, t),
          K(this.z, e.s === `sleep`, this.x + 12, -6, t),
          J(this.b, e.s === `attn`, this.x + this.fx * 34, -16));
      },
    },
    {
      id: `tail`,
      name: `Хвост`,
      outside: !0,
      desc: `В острове кто-то живёт, но видно только хвост. Виляет под музыку, сворачивается вопросом, распушается от тревоги.`,
      build(e) {
        ((this.t = B(`path`, { fill: `none`, stroke: `#E8A65A`, "stroke-linecap": `round` }, e)),
          (this.tip = B(`circle`, {}, e)),
          (this.z = G(e)),
          (this.q = null));
      },
      draw(e, t, n) {
        let r = Math.sin(t / 1300) * 8,
          i = 9,
          a = 0,
          o = 0;
        (e.s === `music` && (r = Math.sin((t / 545) * Math.PI * 2) * 18),
          e.s === `done` && (r = Math.sin(t / 70) * 20 * (n < 2400 ? 1 : 0.4)),
          e.s === `think` && ((a = 1), (r = Math.sin(t / 1600) * 3)),
          e.s === `attn` && ((i = 16), (r = Math.sin(t / 40) * 1.5)),
          e.s === `sleep` && ((o = 1), (r = Math.sin(t / 2400) * 3)),
          (r += e.poke * 20));
        let s = { sw: r, cu: a, dr: o, wi: i };
        this.q ||= { ...s };
        for (let e in s) this.q[e] += (s[e] - this.q[e]) * 0.12;
        let c = this.q,
          l = 74 + c.sw * 0.8 - c.dr * 12 - c.cu * 12,
          u = 74 - c.dr * 2 - c.cu * 30,
          d = 24 + c.dr * 16,
          f = 82 + c.sw * 0.5 + c.cu * 14,
          p = 50 - c.cu * 6,
          m =
            c.cu > 0.05
              ? ` Q${(l - 10 * c.cu).toFixed(1)},${(u - 18 * c.cu).toFixed(1)} ${(l - 20 * c.cu).toFixed(1)},${(u - 4 * c.cu).toFixed(1)}`
              : ``;
        (this.t.setAttribute(
          `d`,
          `M56,20 C74,${d.toFixed(1)} ${f.toFixed(1)},${p.toFixed(1)} ${l.toFixed(1)},${u.toFixed(1)}${m}`,
        ),
          this.t.setAttribute(`stroke-width`, c.wi.toFixed(1)));
        let h = c.cu > 0.05 ? l - 20 * c.cu : l,
          g = c.cu > 0.05 ? u - 4 * c.cu : u;
        (this.tip.setAttribute(`cx`, h.toFixed(1)),
          this.tip.setAttribute(`cy`, g.toFixed(1)),
          this.tip.setAttribute(`r`, (c.wi * 0.62).toFixed(1)),
          this.tip.setAttribute(`fill`, e.s === `idle` ? `#F7E7D0` : e.c),
          K(this.z, e.s === `sleep`, 68, 30, t));
      },
    },
    {
      id: `legs`,
      name: `Остров на ножках`,
      outside: !0,
      face: !0,
      desc: `Персонаж это сам остров: глаза внутри, ножки свисают снизу. Болтает ими, отбивает ритм, подпрыгивает.`,
      build(e) {
        ((this.g2 = B(`g`, {}, e)),
          (this.legs = [0, 1].map(() =>
            B(
              `path`,
              {
                fill: `none`,
                stroke: `#000`,
                "stroke-width": 4.5,
                "stroke-linecap": `round`,
                "stroke-linejoin": `round`,
              },
              e,
            ),
          )),
          (this.shoes = [0, 1].map(() => B(`path`, {}, e))),
          (this.e1 = B(`path`, {}, e)),
          (this.e2 = B(`path`, {}, e)),
          (this.z = G(e)),
          (this.q = null));
      },
      draw(e, t, n) {
        let r = Math.sin(t / 950),
          i = { a1: 18 * r, b1: 12, a2: -18 * r, b2: 12, jump: 0 };
        if (e.s === `music`) {
          let e = Math.sin((t / 545) * Math.PI);
          i = {
            a1: Math.max(0, e) * 45,
            b1: -Math.max(0, e) * 30 + 10,
            a2: Math.max(0, -e) * -45,
            b2: Math.max(0, -e) * 30 - 10,
            jump: 0,
          };
        }
        if (
          (e.s === `think` &&
            (i = { a1: 30, b1: -40, a2: -10, b2: 30 + Math.max(0, Math.sin(t / 200)) * 20, jump: 0 }),
          e.s === `done` &&
            (i = {
              a1: -20,
              b1: 60,
              a2: 20,
              b2: -60,
              jump: Math.abs(Math.sin(n / 240)) * 14 * Math.exp(-n / 1800),
            }),
          e.s === `attn`)
        ) {
          let e = Math.sin(t / 70);
          i = { a1: 2, b1: Math.max(0, e) * 25, a2: -2, b2: -Math.max(0, -e) * 25, jump: 0 };
        }
        (e.s === `sleep` &&
          (i = { a1: 6 * Math.sin(t / 2600), b1: 4, a2: -6 * Math.sin(t / 2600), b2: -4, jump: 0 }),
          (i.jump += e.poke * 10),
          (this.q ||= { ...i }));
        for (let e in i) this.q[e] += (i[e] - this.q[e]) * 0.2;
        let a = this.q,
          o = -a.jump;
        this.g2.setAttribute(`transform`, `translate(0,${o})`);
        let s = (e, t, n) => {
          let r = (t * Math.PI) / 180,
            i = ((t + n) * Math.PI) / 180,
            a = [e + Math.sin(r) * 13, 30 + Math.cos(r) * 13 + o];
          return [a, [a[0] + Math.sin(i) * 13, a[1] + Math.cos(i) * 13], i];
        };
        [
          [-18, a.a1, a.b1],
          [18, a.a2, a.b2],
        ].forEach(([t, n, r], i) => {
          let [a, c, l] = s(t, n, r);
          this.legs[i].setAttribute(
            `d`,
            `M${t},${28 + o} L${a[0].toFixed(1)},${a[1].toFixed(1)} L${c[0].toFixed(1)},${c[1].toFixed(1)}`,
          );
          let u = i ? 1 : -1;
          (this.shoes[i].setAttribute(`d`, V(c[0] + u * 2.5, c[1] + 1.5, 11, 6.5)),
            this.shoes[i].setAttribute(`fill`, e.s === `idle` ? `#D85A30` : e.c),
            this.shoes[i].setAttribute(
              `transform`,
              `rotate(${(-l * 57.3 * 0.3).toFixed(1)},${c[0].toFixed(1)},${c[1].toFixed(1)})`,
            ));
        });
        let c = U(e.s);
        if ((e.h || 30) > 40 || e.face === !1) (this.e1.setAttribute(`d`, ``), this.e2.setAttribute(`d`, ``));
        else {
          let t = Math.max(8, 13 + o * 0.45 + e.ly * 0.6);
          (H(this.e1, -12 + e.lx * 1.2, t, c, e.blink, `#F1EFE8`, 6.5, 11),
            H(this.e2, 12 + e.lx * 1.2, t, c, e.blink, `#F1EFE8`, 6.5, 11));
        }
        K(this.z, e.s === `sleep`, 20, 22, t);
      },
    },
  ],
  St = [
    {
      id: `fire`,
      name: `Костёр`,
      desc: `Маленький огонёк с глазами. Пляшет под музыку, вспыхивает от радости, думает колечками дыма, на ночь тлеет углями.`,
      build(e) {
        ((this.smoke = [0, 1, 2].map(() =>
          B(`circle`, { fill: `none`, stroke: `#888780`, "stroke-width": 1.6 }, e),
        )),
          (this.sparks = [0, 1, 2, 3, 4, 5].map(() => B(`circle`, { r: 1.3, fill: `#FAC775` }, e))),
          B(`path`, { d: V(0, 30, 46, 7), fill: `#7A4E2D`, transform: `rotate(14,0,30)` }, e),
          B(`path`, { d: V(0, 30, 46, 7), fill: `#8E5C36`, transform: `rotate(-14,0,30)` }, e),
          (this.f1 = B(`path`, {}, e)),
          (this.f2 = B(`path`, { fill: `#FAC775` }, e)),
          (this.f3 = B(`path`, { fill: `#FFF4D6` }, e)),
          (this.l = B(`path`, {}, e)),
          (this.r = B(`path`, {}, e)),
          (this.h = 1));
      },
      flame(e, t, n, r) {
        let i = Math.sin(n / 130 + r) * e * 0.16,
          a = Math.sin(n / 170 + r + 1) * e * 0.2,
          o = Math.sin(n / 110 + r + 2) * e * 0.12;
        return `M${-e / 2},26 C${-e / 2},${26 - t * 0.45} ${-e * 0.2 + i},${26 - t * 0.7} ${a},${26 - t} C${e * 0.2 + o},${26 - t * 0.7} ${e / 2},${26 - t * 0.45} ${e / 2},26 Z`;
      },
      draw(e, t, n, r) {
        let i = {
          idle: 1,
          music: 1 + 0.45 * Math.abs(Math.sin((t / 545) * Math.PI)),
          think: 0.6,
          done: 1 + 0.6 * Math.exp(-n / 700),
          attn: 1.35 + 0.1 * Math.sin(t / 50),
          sleep: 0.22,
        }[e.s];
        ((i = Math.min(1.7, i + e.poke * 0.5)),
          (this.h += (i - this.h) * Math.min(1, r * (e.s === `music` ? 18 : 6))));
        let a = this.h;
        (this.f1.setAttribute(`d`, this.flame(30, 40 * a, t, 0)),
          this.f2.setAttribute(`d`, this.flame(20, 28 * a, t, 1.3)),
          this.f3.setAttribute(`d`, this.flame(10, 15 * a, t, 2.1)),
          this.f1.setAttribute(`fill`, e.s === `idle` ? `#D85A30` : e.c),
          (this.f3.style.display = e.s === `sleep` ? `none` : ``),
          this.f2.setAttribute(`opacity`, e.s === `sleep` ? (0.5 + 0.4 * Math.sin(t / 600)).toFixed(2) : 1));
        let o = 26 - 40 * a * 0.42,
          s = U(e.s);
        [this.l, this.r].forEach((t, n) => {
          ((t.style.display = a < 0.4 ? `none` : ``),
            H(t, (n ? 5 : -5) + e.lx * 0.6, o + e.ly * 0.4, s, e.blink, `#4A1B0C`, 3, 4.4));
        });
        let c = e.s === `music` || e.s === `done`;
        (this.sparks.forEach((n, r) => {
          let i = (t / (c ? 700 : 1600) + r / 6) % 1;
          ((n.style.display = e.s === `sleep` || e.s === `think` ? `none` : ``),
            n.setAttribute(`cx`, (Math.sin(r * 2.1 + i * 3) * 10).toFixed(1)),
            n.setAttribute(`cy`, (20 - i * (c ? 60 : 40) * a).toFixed(1)),
            n.setAttribute(`opacity`, (1 - i).toFixed(2)));
        }),
          this.smoke.forEach((n, r) => {
            let i = (t / 1500 + r / 3) % 1;
            ((n.style.display = e.s === `think` ? `` : `none`),
              n.setAttribute(`cx`, (Math.sin(i * 4 + r) * 4).toFixed(1)),
              n.setAttribute(`cy`, (4 - i * 40).toFixed(1)),
              n.setAttribute(`r`, (2 + i * 5).toFixed(1)),
              n.setAttribute(`opacity`, (1 - i).toFixed(2)));
          }));
      },
    },
    {
      id: `lava`,
      name: `Лава-лампа`,
      desc: `Капли лавы всплывают и сливаются в стекле. Без лица, но гипнотизирует. Цвет лавы по настроению.`,
      build(e, t) {
        let n = B(`clipPath`, { id: `lava-glass` + t }, B(`defs`, {}, e)),
          r = `M-11,-30 L11,-30 L18,18 L-18,18 Z`;
        (B(`path`, { d: r }, n),
          B(`path`, { d: r, fill: `#1d1b1a`, stroke: `#5F5E5A`, "stroke-width": 1.2 }, e),
          (this.bl = B(`g`, { "clip-path": `url(#lava-glass${t})` }, e)),
          (this.blobs = [0, 1, 2, 3, 4].map(() => B(`circle`, {}, this.bl))),
          (this.pool = B(`ellipse`, { cx: 0, cy: 18, rx: 20, ry: 6 }, this.bl)),
          B(`path`, { d: `M-9,-40 L9,-40 L11,-30 L-11,-30 Z`, fill: `#888780` }, e),
          B(`path`, { d: `M-18,18 L18,18 L22,38 L-22,38 Z`, fill: `#888780` }, e),
          B(`path`, { d: V(0, 38, 46, 4), fill: `#5F5E5A` }, e),
          (this.ph = [0, 1.7, 3.1, 4.4, 5.6]),
          (this.y = [0, 0, 0, 0, 0]),
          (this.x = [0, 0, 0, 0, 0]),
          (this.r = [0, 0, 0, 0, 0]));
      },
      draw(e, t, n, r) {
        let i = e.s === `idle` ? `#D85A30` : e.c,
          a = { idle: 1, music: 2.6, think: 1.4, done: 1, attn: 0, sleep: 0.25 }[e.s];
        ((this.t = (this.t || 0) + r * a),
          this.blobs.forEach((a, o) => {
            let s = -6 + Math.sin(this.t * 0.9 + this.ph[o]) * 18,
              c = Math.sin(this.t * 0.6 + this.ph[o] * 2) * 5,
              l = 4 + (o % 3) * 1.6;
            if (e.s === `think`) {
              let e = (this.t * 0.35 + o / 5) % 1;
              ((s = 14 - e * 42), (c = Math.sin(e * 6 + o) * 3), (l = 3 + (o % 2)));
            }
            if (e.s === `done`) {
              let e = Math.min(1, n / 700) * (n < 2200 ? 1 : Math.max(0, 1 - (n - 2200) / 700));
              ((s = s * (1 - e) + -6 * e), (c *= 1 - e), (l = l * (1 - e) + 8 * e));
            }
            (e.s === `music` && (s += Math.sin((t / 545) * Math.PI) * 4),
              e.s === `sleep` && ((s = 12), (l = 3 + (o % 3))),
              (s -= e.poke * 10));
            let u = Math.min(1, r * (e.s === `attn` ? 0 : 4));
            ((this.y[o] += (s - this.y[o]) * u),
              (this.x[o] += (c - this.x[o]) * u),
              (this.r[o] += (l - this.r[o]) * Math.min(1, r * 4)),
              a.setAttribute(`cx`, this.x[o].toFixed(1)),
              a.setAttribute(`cy`, this.y[o].toFixed(1)),
              a.setAttribute(`r`, Math.max(0.5, this.r[o]).toFixed(1)),
              a.setAttribute(`fill`, i));
          }),
          this.pool.setAttribute(`fill`, i),
          this.bl.setAttribute(
            `opacity`,
            e.s === `sleep`
              ? 0.55
              : e.s === `attn`
                ? (0.6 + 0.4 * Math.abs(Math.sin(t / 150))).toFixed(2)
                : 1,
          ));
      },
    },
    {
      id: `iris`,
      name: `Объектив`,
      desc: `Живой глаз-объектив: шторки диафрагмы сужаются и раскрываются, моргают, крутятся, пока ИИ думает.`,
      build(e, t) {
        (B(`circle`, { r: 31, fill: `#2C2C2A` }, e),
          B(`circle`, { r: 28, fill: `none`, stroke: `#5F5E5A`, "stroke-width": 2 }, e),
          B(`circle`, { r: 23 }, B(`clipPath`, { id: `iris-c` + t }, B(`defs`, {}, e))),
          B(`circle`, { r: 23, fill: `#0b0b0b` }, e),
          (this.iw = B(`g`, { "clip-path": `url(#iris-c${t})` }, e)),
          (this.pu = B(`circle`, {}, this.iw)),
          (this.hl = B(`circle`, { r: 2.2, fill: `#FFFFFF`, opacity: 0.7 }, this.iw)),
          (this.blades = [0, 1, 2, 3, 4, 5].map(() =>
            B(`path`, { fill: `#3a3a38`, stroke: `#1b1b1a`, "stroke-width": 0.8 }, this.iw),
          )),
          B(`circle`, { cx: -9, cy: -12, r: 3, fill: `#FFFFFF`, opacity: 0.12 }, e),
          (this.a = 12),
          (this.spin = 0),
          (this.nextBlink = performance.now() + 3e3),
          (this.b = q(e)));
      },
      draw(e, t, n, r) {
        let i = {
          idle: 12 + 2 * Math.sin(t / 1200),
          music: 8 + 8 * Math.abs(Math.sin((t / 545) * Math.PI)),
          think: 9,
          done: n < 500 ? 18 : n < 650 ? 2 : n < 900 ? 18 : 15,
          attn: 4.5,
          sleep: 0.5,
        }[e.s];
        if (e.s !== `sleep` && e.s !== `think` && t > this.nextBlink) {
          let e = t - this.nextBlink;
          e < 220
            ? (i = Math.max(0.5, i * Math.abs(1 - e / 110)))
            : (this.nextBlink = t + 2800 + Math.random() * 3500);
        }
        ((i += e.poke * -10), (this.a += (i - this.a) * Math.min(1, r * (e.s === `music` ? 20 : 9))));
        let a = Math.max(0.5, this.a);
        this.spin += r * (e.s === `think` ? 260 : 6);
        let o = e.lx * 1.6,
          s = e.ly * 1.6;
        (this.iw.setAttribute(`transform`, `translate(${o.toFixed(1)},${s.toFixed(1)})`),
          this.blades.forEach((e, t) => {
            let n = t * 60 + this.spin,
              r = W(a, n),
              i = W(a, n + 60),
              o = W(40, n + 75),
              s = W(40, n - 15);
            e.setAttribute(
              `d`,
              `M${r[0].toFixed(1)},${r[1].toFixed(1)} L${i[0].toFixed(1)},${i[1].toFixed(1)} L${o[0].toFixed(1)},${o[1].toFixed(1)} L${s[0].toFixed(1)},${s[1].toFixed(1)}Z`,
            );
          }),
          this.pu.setAttribute(`r`, Math.max(0.5, a * 0.7).toFixed(1)),
          this.pu.setAttribute(`fill`, e.s === `idle` ? `#5DCAA5` : e.c),
          this.hl.setAttribute(`cx`, (-a * 0.25).toFixed(1)),
          this.hl.setAttribute(`cy`, (-a * 0.3).toFixed(1)),
          (this.hl.style.display = a > 4 ? `` : `none`),
          J(this.b, e.s === `attn`, 28, -26));
      },
    },
    {
      id: `coffee`,
      name: `Кофе`,
      desc: `Кружка с характером. Пар танцует под музыку, складывается в сердечко от радости, кипит от тревоги, остывает во сне.`,
      build(e) {
        ((this.st = [0, 1, 2].map(() =>
          B(`path`, { fill: `none`, stroke: `#B4B2A9`, "stroke-width": 2.4, "stroke-linecap": `round` }, e),
        )),
          (this.heart = B(
            `path`,
            {
              d: `M0,6 C-9,0 -9,-8 -3.5,-8 C-1.5,-8 0,-6.5 0,-5 C0,-6.5 1.5,-8 3.5,-8 C9,-8 9,0 0,6Z`,
              fill: `#ED93B1`,
            },
            e,
          )),
          (this.mug = B(`g`, {}, e)));
        let t = this.mug;
        (B(`path`, { d: `M16,4 a8,8 0 1,1 0,14`, fill: `none`, stroke: `#F1EFE8`, "stroke-width": 4.5 }, t),
          B(`path`, { d: `M-16,-2 L16,-2 L14,24 Q14,28 10,28 L-10,28 Q-14,28 -14,24 Z`, fill: `#F1EFE8` }, t),
          B(`ellipse`, { cx: 0, cy: -2, rx: 16, ry: 3.6, fill: `#5B3F2E` }, t),
          (this.band = B(`rect`, { x: -15, y: 17, width: 30, height: 4 }, t)),
          (this.l = B(`path`, {}, t)),
          (this.r = B(`path`, {}, t)),
          (this.mo = B(
            `path`,
            { fill: `none`, stroke: `#5B3F2E`, "stroke-width": 1.5, "stroke-linecap": `round` },
            t,
          )),
          (this.z = G(e)),
          (this.b = q(e)));
      },
      draw(e, t, n) {
        let r = 0,
          i = 0;
        (e.s === `music` &&
          ((r = -Math.abs(Math.sin((t / 545) * Math.PI)) * 4), (i = Math.sin((t / 545) * Math.PI) * 5)),
          e.s === `attn` && (i = Math.sin(t / 35) * 2.5),
          (r -= e.poke * 8),
          this.mug.setAttribute(`transform`, `translate(0,${r.toFixed(1)}) rotate(${i.toFixed(1)},0,26)`),
          this.band.setAttribute(`fill`, e.s === `idle` ? `#D85A30` : e.c));
        let a = U(e.s);
        (H(this.l, -6 + e.lx * 0.6, 7 + e.ly * 0.4, a, e.blink, `#5B3F2E`, 3, 4.2),
          H(this.r, 6 + e.lx * 0.6, 7 + e.ly * 0.4, a, e.blink, `#5B3F2E`, 3, 4.2),
          this.mo.setAttribute(
            `d`,
            e.s === `attn`
              ? `M-2,13 a2,2 0 1,0 4,0 a2,2 0 1,0 -4,0`
              : e.s === `sleep`
                ? `M-3,13 H3`
                : `M-3.5,12 Q0,15 3.5,12`,
          ));
        let o = e.s !== `sleep` && !(e.s === `done` && n < 2600);
        this.st.forEach((n, i) => {
          n.style.display = o ? `` : `none`;
          let a = -7 + i * 7,
            s = e.s === `music` || e.s === `attn`,
            c = e.s === `attn` ? 46 : e.s === `think` ? 20 : 34,
            l = `M${a},${-6 + r}`;
          for (let n = 1; n <= 6; n++) {
            let o = -6 + r - (n * c) / 6,
              u = e.s === `attn` ? 0.8 : 2.6,
              d = a + Math.sin(n * 0.9 + t / (s ? 120 : 420) + i * 1.7) * u * (n / 6 + 0.3);
            l += ` L${d.toFixed(1)},${o.toFixed(1)}`;
          }
          (n.setAttribute(`d`, l),
            n.setAttribute(`opacity`, (0.35 + 0.25 * Math.sin(t / 500 + i)).toFixed(2)));
        });
        let s = e.s === `done` ? Math.min(1, n / 400) * +(n < 2600) : 0;
        ((this.heart.style.display = s > 0 ? `` : `none`),
          this.heart.setAttribute(
            `transform`,
            `translate(0,${(-26 - Math.min(1, n / 2600) * 8).toFixed(1)}) scale(${(s * 1.6).toFixed(2)})`,
          ),
          K(this.z, e.s === `sleep`, 18, -8, t),
          J(this.b, e.s === `attn`, 24, -30));
      },
    },
    {
      id: `cradle`,
      name: `Маятник Ньютона`,
      desc: `Офисная игрушка вместо персонажа. Шарики щёлкают в такт музыке, бегут волной, пока ИИ думает. Средний шарик всё видит.`,
      build(e) {
        (B(`path`, { d: `M-38,-34 H38`, stroke: `#888780`, "stroke-width": 3, "stroke-linecap": `round` }, e),
          B(`path`, { d: `M-38,-34 V30 M38,-34 V30`, stroke: `#5F5E5A`, "stroke-width": 2 }, e),
          B(`path`, { d: `M-44,31 H44`, stroke: `#888780`, "stroke-width": 3, "stroke-linecap": `round` }, e),
          (this.s = []),
          (this.b = []),
          (this.h = []));
        for (let t = 0; t < 5; t++) {
          this.s.push(B(`path`, { stroke: `#888780`, "stroke-width": 1 }, e));
          let t = B(`g`, {}, e);
          (this.b.push(B(`circle`, { r: 6.4 }, t)),
            B(`circle`, { cx: -2, cy: -2.2, r: 1.6, fill: `#FFFFFF`, opacity: 0.7 }, t),
            this.h.push(t));
        }
        ((this.l = B(`path`, {}, e)), (this.r = B(`path`, {}, e)));
      },
      draw(e, t, n) {
        let r = [0, 0, 0, 0, 0],
          i = (e, n) => {
            let i = Math.sin((t / n) * Math.PI * 2);
            ((r[0] = -e * Math.max(0, -i)), (r[4] = e * Math.max(0, i)));
          };
        (e.s === `idle` && i(16, 1700),
          e.s === `music` && i(28, 1090),
          e.s === `done` && i(38 * (n < 3e3 ? 1 : 0.6), 800),
          e.s === `think` && (r = r.map((e, n) => 9 * Math.sin(t / 260 - n * 0.75))),
          e.s === `attn` && (r[0] = -38 + Math.sin(t / 40) * 2),
          (r[0] -= e.poke * 25));
        for (let t = 0; t < 5; t++) {
          let n = -24 + t * 12,
            i = (r[t] * Math.PI) / 180,
            a = n + Math.sin(i) * 40,
            o = -34 + Math.cos(i) * 40;
          (this.s[t].setAttribute(`d`, `M${n},-34 L${a.toFixed(1)},${o.toFixed(1)}`),
            this.h[t].setAttribute(`transform`, `translate(${a.toFixed(1)},${o.toFixed(1)})`),
            this.b[t].setAttribute(`fill`, e.s === `idle` ? `#D3D1C7` : e.c),
            this.b[t].setAttribute(`opacity`, e.s === `sleep` ? 0.55 : 1));
        }
        let a = Math.abs(r[0]) > Math.abs(r[4]) ? -1 : 1,
          o = e.s === `think` ? 0 : a * 1.5,
          s = U(e.s);
        (H(this.l, -2.2 + o, 6.5, s, e.blink, `#1b1b1a`, 1.8, 2.6),
          H(this.r, 2.2 + o, 6.5, s, e.blink, `#1b1b1a`, 1.8, 2.6));
      },
    },
    {
      id: `pulse`,
      name: `Пульс`,
      desc: `Кардиомонитор острова. Сердце бьётся в такт музыке, учащается от тревоги, во сне линия почти ровная, пока ИИ думает, бегут мозговые волны.`,
      pillScale: 0.34,
      build(e) {
        ((this.grid = B(
          `path`,
          { d: `M-84,-20 H62 M-84,0 H62 M-84,20 H62`, stroke: `#1f3a32`, "stroke-width": 0.6 },
          e,
        )),
          (this.line = B(
            `path`,
            { fill: `none`, "stroke-width": 2.2, "stroke-linejoin": `round`, "stroke-linecap": `round` },
            e,
          )),
          (this.dot = B(`circle`, { r: 2.6 }, e)),
          (this.heart = B(
            `path`,
            { d: `M0,6 C-9,0 -9,-8 -3.5,-8 C-1.5,-8 0,-6.5 0,-5 C0,-6.5 1.5,-8 3.5,-8 C9,-8 9,0 0,6Z` },
            e,
          )),
          (this.pk = -1e9));
      },
      ecg(e) {
        return e < 0.1
          ? 0
          : e < 0.18
            ? 0.12 * Math.sin(((e - 0.1) / 0.08) * Math.PI)
            : e < 0.22
              ? 0
              : e < 0.24
                ? -0.18
                : e < 0.27
                  ? 1
                  : e < 0.3
                    ? -0.35
                    : e < 0.4
                      ? 0
                      : e < 0.55
                        ? 0.22 * Math.sin(((e - 0.4) / 0.15) * Math.PI)
                        : 0;
      },
      val(e, t) {
        if (e === `think`)
          return 0.22 * Math.sin(t / 80) + 0.14 * Math.sin(t / 33 + 1) + 0.08 * Math.sin(t / 13);
        let n = { idle: 857, music: 545, done: 600, attn: 380, sleep: 1500 }[e],
          r = e === `sleep` ? 0.35 : e === `attn` ? 1.1 : 1;
        return this.ecg((t % n) / n) * r;
      },
      draw(e, t) {
        let n = e.s === `idle` ? `#5DCAA5` : e.c,
          r = ``;
        for (let n = -84; n <= 62; n += 2) {
          let i = t - (62 - n) * 3.2,
            a = this.val(e.s, i),
            o = i - this.pkT;
          (this.pkT && o > 0 && o < 200 && (a += 1.4 * Math.sin((o / 200) * Math.PI)),
            (r += (n === -84 ? `M` : ` L`) + n + `,` + (-a * 18).toFixed(1)));
        }
        (e.poke > 0.95 && (this.pkT = t),
          this.line.setAttribute(`d`, r),
          this.line.setAttribute(`stroke`, n));
        let i = -this.val(e.s, t) * 18;
        (this.dot.setAttribute(`cx`, 62),
          this.dot.setAttribute(`cy`, i.toFixed(1)),
          this.dot.setAttribute(`fill`, n));
        let a = { idle: 857, music: 545, done: 600, attn: 380, sleep: 1500, think: 1200 }[e.s],
          o = (t % a) / a,
          s = o > 0.24 && o < 0.45 ? Math.sin(((o - 0.24) / 0.21) * Math.PI) : 0;
        (this.heart.setAttribute(`fill`, n),
          this.heart.setAttribute(
            `transform`,
            `translate(76,0) scale(${(1.35 + s * 0.35 * (e.s === `sleep` ? 0.3 : 1) + (e.s === `done` ? 0.3 : 0)).toFixed(2)})`,
          ),
          this.heart.setAttribute(`opacity`, e.s === `think` ? 0.45 : 1));
      },
    },
  ],
  {
    catalog: Et,
    describe: Ot,
    find: At,
  } = createCharacterCatalog({
    creatures: xt,
    things: St,
    renderers: {
      spark: ct,
      eyes: lt,
      bot: ut,
      cat: dt,
      blob: ft,
      jelly: ht,
      sloth: gt,
      astro: _t,
      sprout: vt,
      swarm: yt,
      kao: bt,
    },
    language: e,
  });
var jt = [4, 3],
  Mt = [120, 75];
function Nt(e, t) {
  let n = e / Mt[0],
    r = t / Mt[1],
    i = Math.hypot(n, r),
    a = i > 1 ? 1 / i : 1;
  return [n * a * jt[0], r * a * jt[1]];
}
var Pt = null,
  Ft = 0;
typeof window < `u` &&
  window.addEventListener(`mousemove`, (e) => {
    ((Pt = { x: e.clientX, y: e.clientY }), (Ft = performance.now()));
  });
function It(e) {
  performance.now() - Ft < 250 || (Pt = e ? { x: window.innerWidth / 2 + e[0], y: e[1] } : null);
}
function Lt() {
  return Pt;
}
var Rt = {
    idle: `#D97757`,
    eat: `#D97757`,
    sleep: `#9A5642`,
    music: `#F0997B`,
    think: `#8ea2ff`,
    happy: `#5fe0a0`,
    attn: `#fcd34d`,
    sad: `#ff6b6b`,
  },
  zt = [
    `..XXXXXXX..`,
    `.XXXXXXXXX.`,
    `XXXXXXXXXXX`,
    `XXXXXXXXXXX`,
    `XXXXXXXXXXX`,
    `XXXXXXXXXXX`,
    `XXXXXXXXXXX`,
  ],
  Bt = [`X.XX.X.XX.X`, `XX.X.X.X.XX`],
  Vt = (e, t, n, r) => {
    let i = [];
    for (let a = n; a <= r; a++) for (let n = e; n <= t; n++) i.push([n, a]);
    return i;
  };
function Ht(e, t) {
  let n = e === `idle` || e === `attn` ? t.look : 0,
    r = [],
    i = (e) => r.push(...e(2 + n), ...e(7 + n));
  if (e === `happy` || e === `music` || e === `eat`) r.push([1, 4], [2, 3], [3, 4], [7, 4], [8, 3], [9, 4]);
  else if (e === `sleep` || t.blink) i((e) => Vt(e, e + 1, 4, 4));
  else if (e === `sad`) r.push([2, 3], [3, 4], [7, 4], [8, 3]);
  else if (e === `attn`) i((e) => Vt(e, e + 1, 2, 4));
  else {
    let t = e === `think` ? 2 : 3;
    i((e) => Vt(e, e + 1, t, t + 1));
  }
  return (
    e === `eat` && r.push(...(t.step % 2 == 0 ? Vt(4, 6, 5, 6) : Vt(4, 6, 6, 6))),
    e === `sad` && r.push([4, 6], [5, 5], [6, 6]),
    r
  );
}
var Ut = [
  [0, 0],
  [1, 0],
  [2, 0],
  [3, 0],
  [2, 1],
  [1, 2],
  [0, 3],
  [1, 3],
  [2, 3],
  [3, 3],
];
function Wt(e, t) {
  let n = new Set(Ht(e, t).map(([e, t]) => `${e},${t}`)),
    r = e === `music` || e === `think` || e === `happy` ? Bt[t.step % 2] : Bt[0],
    i = [...zt, r],
    a = [];
  i.forEach((e, t) => {
    for (let r = 0; r < e.length; r++) e[r] === `X` && !n.has(`${r},${t}`) && a.push([r, t]);
  });
  let o = [];
  if (e === `think`) [3, 5, 7].slice(0, t.step % 4).forEach((e) => o.push([e, -2]));
  else if (e === `attn`) o.push([12, 0], [12, 1], [12, 2], [12, 4]);
  else if (e === `sleep`) {
    let e = (t.step % 3) * 0.5;
    Ut.forEach(([t, n]) => o.push([10 + t * 0.5, -1 + n * 0.5 - e, 0.5]));
  }
  return { body: a, extra: o };
}
function Gt(e, t, n) {
  return e === `happy` ? [0, 1, 2, 1][t % 4] : e === `music` ? Math.round(Math.min(1, n * 2.2) * 2) : 0;
}
function Kt(e) {
  return e.map(([e, t, n = 1]) => `M${e},${t}h${n}v${n}h-${n}z`).join(``);
}
var qt = { idle: 0, attn: 0, sad: 0, music: 380, think: 320, eat: 180, happy: 220, sleep: 900 },
  Jt = { attn: `#fcd34d`, sleep: `var(--color-ink-3)` };
function Yt({ mood: e, px: t = 2, color: n, level: r = 0, look: i = 0, still: a = !1, className: o = `` }) {
  let [s, c] = (0, ReactRuntime.useState)(!1),
    [l, u] = (0, ReactRuntime.useState)(0);
  ((0, ReactRuntime.useEffect)(() => {
    if (a || e === `sleep` || e === `happy` || e === `music` || e === `eat`) return;
    let t,
      n = () => {
        t = setTimeout(
          () => {
            (c(!0),
              (t = setTimeout(() => {
                (c(!1), n());
              }, 130)));
          },
          2400 + Math.random() * 3800,
        );
      };
    return (
      n(),
      () => {
        (clearTimeout(t), c(!1));
      }
    );
  }, [e, a]),
    (0, ReactRuntime.useEffect)(() => {
      u(0);
      let t = a ? 0 : qt[e];
      if (!t) return;
      let n = setInterval(() => u((e) => e + 1), t);
      return () => clearInterval(n);
    }, [e, a]));
  let { body: d, extra: f } = (0, ReactRuntime.useMemo)(
      () => Wt(e, { step: l, blink: s, look: i }),
      [e, l, s, i],
    ),
    p = Gt(e, l, r),
    m = n || Rt[e];
  return (0, jsxRuntime.jsxs)(`svg`, {
    width: 16 * t,
    height: 13 * t,
    viewBox: `-3 -3 16 13`,
    shapeRendering: `crispEdges`,
    "aria-hidden": !0,
    className: `shrink-0 ${o}`,
    style: { transform: p ? `translateY(${-p * t}px)` : void 0 },
    children: [
      (0, jsxRuntime.jsx)(`path`, { d: Kt(d), fill: m }),
      f.length > 0 && (0, jsxRuntime.jsx)(`path`, { d: Kt(f), fill: Jt[e] ?? m }),
    ],
  });
}
var Xt = 0;
function Zt(e, t, n) {
  return $t((n) => r.aiRun(n, e, t), n);
}
function Qt(e, t) {
  return $t((t) => r.aiChat(t, e), t);
}
function $t(e, t) {
  let n = Date.now() * 1e3 + (++Xt % 1e3),
    i = !1,
    a = [
      o(`ai:chunk`, (e) => e.id === n && !i && t.onChunk(e.text)),
      o(`ai:done`, (e) => {
        e !== n || i || ((i = !0), s(), t.onDone());
      }),
      o(`ai:error`, (e) => {
        e.id !== n || i || ((i = !0), s(), t.onError(e.message));
      }),
    ],
    s = () => a.forEach((e) => void e.then((e) => e()));
  return (
    Promise.all(a).then(() => e(n)),
    () => {
      i || ((i = !0), s(), r.aiCancel(n));
    }
  );
}
var en = [
  {
    id: `translate`,
    get label() {
      return n(`Перевести`, `Translate`);
    },
    get system() {
      return n(
        `Переведи текст. Если он на русском, переведи на английский, иначе на русский. Сохрани форматирование и тон. Верни только перевод, без пояснений.`,
        `Translate the text. If it is not in English, translate it into English; if it is in English, translate it into Russian. Keep the formatting and tone. Return only the translation, no comments.`,
      );
    },
  },
  {
    id: `fix`,
    get label() {
      return n(`Исправить`, `Fix`);
    },
    get system() {
      return n(
        `Исправь орфографию, пунктуацию и грамматику, сохрани смысл, стиль и язык оригинала. Верни только исправленный текст, без пояснений.`,
        `Fix spelling, punctuation and grammar, keeping the meaning, style and language of the original. Return only the corrected text, no comments.`,
      );
    },
  },
  {
    id: `short`,
    get label() {
      return n(`Короче`, `Shorter`);
    },
    get system() {
      return n(
        `Сократи текст примерно вдвое, сохранив главное и язык оригинала. Верни только результат.`,
        `Cut the text to about half, keeping what matters and the original language. Return only the result.`,
      );
    },
  },
  {
    id: `explain`,
    get label() {
      return n(`Объяснить`, `Explain`);
    },
    get system() {
      return n(
        `Объясни простыми словами, о чём этот текст и что в нём главное. Коротко, по-русски, без вступлений.`,
        `Explain in plain words what this text is about and what matters in it. Briefly, in English, no preamble.`,
      );
    },
  },
  {
    id: `reply`,
    get label() {
      return n(`Ответить`, `Reply`);
    },
    get system() {
      return n(
        `Это сообщение, на которое нужно ответить. Напиши вежливый, короткий и естественный ответ на том же языке. Верни только текст ответа.`,
        `This is a message that needs a reply. Write a polite, short and natural reply in the same language. Return only the reply.`,
      );
    },
  },
  {
    id: `polite`,
    get label() {
      return n(`Вежливее`, `Politer`);
    },
    get system() {
      return n(
        `Перепиши текст вежливее и мягче, сохранив смысл и язык. Верни только результат.`,
        `Rewrite the text more politely and softly, keeping the meaning and language. Return only the result.`,
      );
    },
  },
];
function tn() {
  return n(
    "Ты ИИ-помощник в Island, панели быстрого доступа на компьютере с Windows. Общайся естественно, как в обычном чате. Отвечай на языке собеседника, по умолчанию по-русски. Пиши по делу, без длинных вступлений и повторов вопроса. Код и команды оформляй блоками ```, перечисления списками.",
    "You are the AI assistant in Island, a quick-access panel on a Windows computer. Talk naturally, like in an ordinary chat. Reply in the user's language, English by default. Be to the point, without long intros or restating the question. Format code and commands as ``` blocks and enumerations as lists.",
  );
}
function nn() {
  return n(
    `Ты помощник в панели быстрого доступа на компьютере. Отвечай по-русски, коротко и по делу, без вступлений. Если просят код или команду, дай его сразу.`,
    `You are the assistant in a quick-access panel on a computer. Reply in the language of the question, briefly and to the point, no preamble. If asked for code or a command, give it right away.`,
  );
}
var rn = 4e4,
  an = 6,
  X = null,
  on = null,
  sn,
  cn = Date.now(),
  ln = () => ++cn;
function un(e) {
  let t = [],
    n = 0;
  for (let r = e.length - 1; r >= 0; r--) {
    let i = e[r],
      a = i.attachments ?? [];
    if (!(i.error || (!i.text.trim() && a.length === 0))) {
      if (((n += i.text.length + a.reduce((e, t) => e + (t.chars ?? 2e3), 0)), n > rn && t.length > 0)) break;
      t.unshift(
        a.length
          ? { role: i.role, content: i.text, attachments: a.map((e) => e.id) }
          : { role: i.role, content: i.text },
      );
    }
  }
  return [{ role: `system`, content: tn() }, ...t];
}
async function dn() {
  try {
    let e = await r.chatGet();
    return e ? JSON.parse(e).filter((e) => e && (e.role === `user` || e.role === `assistant`)) : [];
  } catch {
    return [];
  }
}
var fn = (e) => e.filter((e) => !e.error && (e.text.trim() || e.attachments?.length)).slice(-120);
function Z(e) {
  r.chatSet(JSON.stringify(fn(e))).catch(() => {});
}
function pn() {
  let e = hn.getState(),
    t = [...fn(e.messages).flatMap((e) => e.attachments ?? []), ...e.pending].map((e) => e.id);
  r.attachmentsPrune(t).catch(() => {});
}
function mn(e) {
  let t = useIslandStore.getState();
  if (t.expanded && t.tab === `chat`) return;
  let n = e
    .replace(/[`*_#>]/g, ``)
    .replace(/\s+/g, ` `)
    .trim();
  t.pushPeek({ kind: `chat`, text: n });
}
var hn = ce((e, t) => {
  let i = () => {
      X?.();
      let n = t().messages,
        r = ln();
      e({ messages: [...n, { id: r, role: `assistant`, text: `` }], streaming: !0 });
      let i = (t) => e((e) => ({ messages: e.messages.map((e) => (e.id === r ? t(e) : e)) }));
      X = Qt(un(n), {
        onChunk: (e) => i((t) => ({ ...t, text: t.text + e })),
        onDone: () => {
          ((X = null), e({ streaming: !1 }), Z(t().messages));
          let n = t().messages.find((e) => e.id === r);
          n && mn(n.text);
        },
        onError: (n) => {
          X = null;
          let i = t().messages.find((e) => e.id === r)?.text ?? ``;
          (e((e) => ({
            streaming: !1,
            messages: i
              ? [...e.messages, { id: ln(), role: `assistant`, text: n, error: !0 }]
              : e.messages.map((e) => (e.id === r ? { ...e, text: n, error: !0 } : e)),
          })),
            Z(t().messages));
        },
      });
    },
    a = (r) => (
      e((e) => ({ attaching: e.attaching + 1 })),
      r
        .then((r) => {
          let i = t().pending,
            a = (e, t) =>
              t.length < an && (e.kind !== `image` || t.filter((e) => e.kind === `image`).length < 3),
            o = [...i],
            s = [...r.errors];
          for (let e of r.items)
            a(e, o)
              ? o.push(e)
              : s.push(
                  e.kind === `image`
                    ? n(
                        `${e.name}: не больше 3 картинок в сообщении`,
                        `${e.name}: up to 3 pictures per message`,
                      )
                    : n(`${e.name}: слишком много файлов`, `${e.name}: too many files`),
                );
          let c = r.items.find((e) => e.truncated && o.includes(e));
          (c &&
            s.push(
              n(
                `${c.name}: документ длинный, в чат попало начало`,
                `${c.name}: the document is long, only its beginning was taken`,
              ),
            ),
            e({ pending: o }),
            s.length && t().say(s.join(` · `)),
            o.length !== i.length + r.items.length && pn());
        })
        .catch((e) => t().say(String(e)))
        .finally(() => e((e) => ({ attaching: e.attaching - 1 })))
    );
  return {
    loaded: !1,
    messages: [],
    streaming: !1,
    draft: ``,
    pending: [],
    attaching: 0,
    notice: null,
    load: () => (
      (on ??= dn().then((t) => {
        (e((e) => ({ loaded: !0, messages: [...t, ...e.messages] })), pn());
      })),
      on
    ),
    setDraft: (t) => e({ draft: t }),
    send: (n) => {
      let r = n.trim(),
        a = t().pending;
      (!r && a.length === 0) ||
        t().streaming ||
        t().attaching > 0 ||
        (e({ draft: ``, pending: [], notice: null }),
        t()
          .load()
          .then(() => {
            let n = { id: ln(), role: `user`, text: r };
            (a.length && (n.attachments = a),
              e((e) => ({ messages: [...e.messages, n] })),
              Z(t().messages),
              i());
          }));
    },
    retry: () => {
      if (t().streaming) return;
      let n = t().messages,
        r = -1;
      for (let e = n.length - 1; e >= 0; e--)
        if (n[e].role === `user`) {
          r = e;
          break;
        }
      r < 0 || (e({ messages: n.slice(0, r + 1) }), i());
    },
    stop: () => {
      (X?.(),
        (X = null),
        e((e) => ({
          streaming: !1,
          messages: e.messages.filter((e) => !(e.role === `assistant` && !e.text.trim())),
        })),
        Z(t().messages));
    },
    reset: () => {
      (X?.(),
        (X = null),
        t()
          .load()
          .then(() => {
            (e({ messages: [], streaming: !1, pending: [], notice: null }), Z([]), pn());
          }));
    },
    continueFrom: (n, r) => {
      (t().streaming && t().stop(),
        t()
          .load()
          .then(() => {
            (e((e) => ({
              messages: [
                ...e.messages,
                { id: ln(), role: `user`, text: n },
                { id: ln(), role: `assistant`, text: r },
              ],
            })),
              Z(t().messages));
          }));
    },
    attachPick: () => a(r.attachPick()),
    attachPaths: (e) => void a(r.attachPaths(e)),
    attachData: (e, t) =>
      void a(
        r.attachData(e, t).then(
          (e) => ({ items: [e], errors: [] }),
          (t) => ({ items: [], errors: [`${e}: ${String(t)}`] }),
        ),
      ),
    unattach: (t) => {
      (e((e) => ({ pending: e.pending.filter((e) => e.id !== t) })), pn());
    },
    say: (t) => {
      (clearTimeout(sn), e({ notice: t }), t && (sn = setTimeout(() => e({ notice: null }), 7e3)));
    },
  };
});
function gn(e) {
  return e === `happy` || e === `eat` ? `done` : e === `sad` ? `attn` : e;
}
var _n = new Set(),
  vn = 0,
  yn = new Set();
function bn() {
  !vn && yn.size === 0 && _n.size > 0 && (vn = requestAnimationFrame(xn));
}
function xn(e) {
  ((vn = 0),
    !document.hidden &&
      (_n.forEach((t) => {
        e - t.last >= t.every() - 2 && ((t.last = e), t.fn(e));
      }),
      bn()));
}
typeof document < `u` && document.addEventListener(`visibilitychange`, bn);
function Sn(e, t) {
  let n = { fn: e, every: t, last: 0 };
  return (_n.add(n), bn(), () => _n.delete(n));
}
function Cn(e, t) {
  (t ? yn.add(e) : yn.delete(e), bn());
}
function wn(e, t = !1) {
  return t ? 1e9 : e === `sleep` ? 66 : e === `idle` ? 16 : 0;
}
var Tn = (e) => e.settings?.moduleMedia !== !1 && e.mediaLive && e.media?.playing === !0,
  En = (e) => S(e.settings, e.license.pro, Tn(e));
function Dn() {
  return useIslandStore((e) => At(e.settings ? En(e) : null));
}
function On() {
  return Dn().kind === `slot`;
}
var kn = 0,
  An = [-40, -45, 80, 85],
  jn = 0.86,
  Mn = (e, t, n) => Math.max(t, Math.min(n, e));
function Nn(e) {
  let t = { mood: null, since: 0, poke: -1e9, blinkAt: 0, lx: 0, ly: 0, sy: 1, vsy: 0, last: 0 };
  return {
    st: t,
    pose(n, r, i, a, o) {
      let s = Math.min(0.05, t.last ? (n - t.last) / 1e3 : 0.016);
      ((t.last = n),
        t.mood !== r && (t.mood !== null && ((t.poke = n), (t.vsy -= 3.4)), (t.mood = r), (t.since = n)));
      let c = gn(r),
        l = i * 3,
        u = 0,
        d = Lt();
      if (d && o && !e()) {
        let e = o.getBoundingClientRect();
        [l, u] = Nt(d.x - (e.left + e.width / 2), d.y - (e.top + e.height / 2));
      }
      (c === `think` && ((l = 0), (u = -2)),
        (t.lx += (l - t.lx) * Math.min(1, s * 10)),
        (t.ly += (u - t.ly) * Math.min(1, s * 10)));
      let f = 1;
      if (((t.blinkAt ||= n + 1200 + Math.random() * 2500), n > t.blinkAt)) {
        let e = n - t.blinkAt;
        ((f = e < 70 ? 1 - e / 70 : e < 140 ? (e - 70) / 70 : 1),
          e > 140 && (t.blinkAt = n + 2500 + Math.random() * 3500));
      }
      let p = (n - t.poke) / 1e3,
        m = p < 0.6 ? Math.sin((p / 0.6) * Math.PI) : 0;
      ((t.vsy += (-190 * (t.sy - 1) - 11 * t.vsy) * s), (t.sy += t.vsy * s));
      let h = Mn(t.sy, 0.7, 1.3);
      return {
        pose: {
          s: c,
          c: r === `sad` ? `#ff6b6b` : c === `music` && a ? a : at[c],
          lx: t.lx,
          ly: t.ly,
          blink: f,
          poke: m,
        },
        t: n - t.since,
        dt: s,
        pop: [1 + (1 - h) * 0.8, h],
      };
    },
  };
}
var Pn = 9;
function Fn(e, t, n) {
  let r = Math.sin(t / 900) * 2,
    i = 1,
    a = 1,
    o = 0;
  if (e === `music`) {
    let e = (t % 545) / 545,
      n = Math.max(0, 1 - e * 4);
    ((r = -Math.abs(Math.sin(e * Math.PI)) * 6),
      (a = 1 - 0.1 * n),
      (i = 1 + 0.08 * n),
      (o = Math.sin((t / 545) * Math.PI) * 5));
  }
  if (e === `done`) {
    let e = n / 1e3,
      t = Math.exp(-e * 1.4),
      o = Math.abs(Math.sin(e * Math.PI * 1.7));
    r = -o * Pn * t;
    let s = (1 - o) ** 8 * t;
    ((a = 1 - 0.2 * s), (i = 1 + 0.15 * s));
  }
  return (
    e === `attn` && (o = n % 1400 < 300 ? Math.sin(n / 25) * 6 : 0),
    e === `sleep` && ((r = 3), (a = 1 + 0.035 * Math.sin(t / 1100)), (i = 1 - 0.02 * Math.sin(t / 1100))),
    { y: r, sx: i, sy: a, rot: o }
  );
}
var In = 0.94;
function Ln({
  id: e,
  mood: t,
  width: n,
  height: r,
  look: i = 0,
  accent: a,
  level: o = 0,
  still: s = !1,
  className: c = ``,
}) {
  let l = At(e),
    u = (0, ReactRuntime.useRef)(null),
    d = (0, ReactRuntime.useRef)({ mood: t, look: i, accent: a, still: s });
  d.current = { mood: t, look: i, accent: a, still: s };
  let f = l.box ?? An;
  if (
    ((0, ReactRuntime.useEffect)(() => {
      let e = u.current;
      if (!e || l.kind !== `slot` || !l.puppet) return;
      let t = f[1],
        n = f[0] + f[2],
        r = B(`g`, {}, e),
        i = B(`g`, {}, r),
        a = B(`g`, {}, i),
        o = Object.create(l.puppet);
      o.build(a, ++kn);
      let s = l.generic ? { dots: ot(r), z: G(r), bang: q(r) } : null,
        c = Nn(() => d.current.still),
        p = (a) => {
          let u = d.current,
            {
              pose: f,
              t: p,
              dt: m,
              pop: [h, g],
            } = c.pose(a, u.mood, u.look, u.accent, e);
          if (
            (r.setAttribute(
              `transform`,
              `translate(0,30) scale(${h.toFixed(3)},${g.toFixed(3)}) translate(0,-30)`,
            ),
            l.generic && s)
          ) {
            let e = Fn(f.s, a, p),
              r = Math.max(-Pn, e.y - f.poke * 5);
            (i.setAttribute(
              `transform`,
              `translate(0,${(r + 22 * (1 - e.sy)).toFixed(2)}) rotate(${e.rot.toFixed(2)}) scale(${e.sx.toFixed(3)},${e.sy.toFixed(3)})`,
            ),
              st(s.dots, f.s === `think`, -7, t + 6, a),
              K(s.z, f.s === `sleep`, n - 15, t + 25, a),
              J(s.bang, f.s === `attn`, n - 8, t + 9));
          }
          try {
            o.draw(f, a, p, m);
          } catch {}
        };
      p(performance.now());
      let m = Sn(p, () => wn(d.current.mood, d.current.still));
      return () => {
        (m(), e.replaceChildren());
      };
    }, [l, f]),
    l.id === `pixel`)
  ) {
    let e = Math.max(1, Math.min(6, Math.floor((r * jn) / 8), Math.floor((n * 0.92) / 11)));
    return (0, jsxRuntime.jsx)(`div`, {
      className: `grid shrink-0 place-items-center ${c}`,
      style: { width: n, height: r },
      children: (0, jsxRuntime.jsx)(Yt, {
        mood: t,
        px: e,
        color: t === `music` ? a : void 0,
        level: o,
        look: i,
        still: s,
      }),
    });
  }
  if (l.kind !== `slot`) return null;
  let p = Math.min(r / f[3], n / f[2]) * In,
    m = f[0] + f[2] / 2,
    _ = f[1] + f[3] / 2,
    v = [m - n / 2 / p, _ - r / 2 / p, n / p, r / p];
  return (0, jsxRuntime.jsx)(`svg`, {
    ref: u,
    "data-ink-art": !0,
    width: n,
    height: r,
    viewBox: v.map((e) => e.toFixed(2)).join(` `),
    className: `shrink-0 ${c}`,
    "aria-hidden": !0,
  });
}
function Rn() {
  let e = hn((e) => e.streaming),
    t = useIslandStore((e) => e.settings?.moduleMedia !== !1 && e.mediaLive && e.media?.playing === !0),
    n = useIslandStore((e) => e.asleep);
  return e ? `think` : t ? `music` : n ? `sleep` : `idle`;
}
function zn(e) {
  switch (e) {
    case `done`:
    case `news`:
    case `chat`:
    case `copied`:
    case `screenshot`:
    case `recorded`:
    case `launcher`:
    case `download`:
    case `ocr`:
    case `qr`:
    case `color`:
    case `dictated`:
      return `happy`;
    case `shelf`:
      return `eat`;
    case `update`:
    case `mic`:
    case `cam`:
    case `reminder`:
    case `timer`:
    case `notification`:
    case `agent`:
    case `agentAsk`:
      return `attn`;
    case `error`:
      return `sad`;
    default:
      return null;
  }
}
function Bn({ mood: e, accent: t, level: n, width: r = 60, height: i = 30 }) {
  let a = Dn(),
    o = useIslandStore((e) => e.look),
    s = useIslandStore((e) => e.asleep);
  return a.kind === `slot`
    ? (0, jsxRuntime.jsx)(Ln, {
        id: a.id,
        mood: e ?? (s ? `sleep` : `idle`),
        width: r,
        height: i,
        look: o,
        accent: t,
        level: n,
      })
    : null;
}
function Vn(e) {
  return e.some((e) => (e ?? ``).trim().toLowerCase() === `printscreen`);
}
function Hn(e) {
  return /^[a-z][a-z0-9+.-]+:/i.test(e.trim()) && !/^shell:/i.test(e.trim());
}
var Un = [`area`, `screen`, `ocr`, `qr`, `color`, `plain`, `record`, `command`];
function Wn(e, t) {
  let n = new Set(e ?? []),
    r = Un.filter((e) => !n.has(e)),
    i = t.mediaModule && !n.has(`player`),
    a = i && t.media ? `player` : n.has(`clips`) ? (i ? `quiet` : null) : `clips`,
    o = !n.has(`volume`),
    s = r.length,
    c = s === 0 ? 0 : a ? (s > 4 ? 2 : 1) : s <= 4 ? s : Math.ceil(s / 2),
    l = c ? Math.ceil(s / c) : 0,
    u = t.launcherModule && !n.has(`launcher`);
  return {
    main: a,
    volume: o,
    volumeRow: !a && o,
    tiles: r,
    cols: c,
    rows: l,
    aside: a !== null && s > 0,
    launcher: u,
    empty: !a && s === 0 && !o && !u,
  };
}
function Gn(e) {
  let t = e.tiles.length;
  return e.cols && t % e.cols ? e.cols - (t % e.cols) + 1 : 1;
}
var Q = {
  top: 60,
  bottom: 16,
  side: 32,
  gap: 10,
  volume: 38,
  volumeGap: 8,
  launcher: 54,
  tileGap: 6,
  tileMin: 44,
  tile: 84,
  tileOne: 96,
  tileWidth: 150,
  playerBig: 220,
  card: 150,
  wide: 680,
  aside1: 112,
  aside2: 226,
};
function Kn(e, t) {
  let n = Math.max(t.header, 0);
  if (e.empty) return [Math.min(Q.wide, Math.max(n, 420)), 200];
  let r = e.tiles.length,
    i,
    a;
  if (e.main) {
    let n = (e.main === `player` && t.big ? Q.playerBig : Q.card) + (e.volume ? Q.volumeGap + Q.volume : 0),
      o = r ? e.rows * Q.tileMin + (e.rows - 1) * Q.tileGap : 0;
    ((i = Math.max(n, o)), (a = r ? Q.wide : e.main === `player` && t.big ? (t.words ? 600 : 480) : 520));
  } else {
    let t = r ? (e.rows === 1 ? Q.tileOne : e.rows * Q.tile + (e.rows - 1) * Q.tileGap) : 0;
    ((i = t + (e.volumeRow ? (t ? Q.gap : 0) + Q.volume : 0)),
      (a = r ? e.cols * Q.tileWidth + (e.cols - 1) * Q.tileGap + Q.side : 0));
  }
  return (
    e.launcher && (i += (i ? Q.gap : 0) + Q.launcher),
    [Math.min(Q.wide, Math.max(a, n)), Q.top + i + Q.bottom]
  );
}
function qn(e, t) {
  return e.rows
    ? !e.main ||
        ((e.main === `player` && t ? Q.playerBig : Q.card) +
          (e.volume ? Q.volumeGap + Q.volume : 0) -
          (e.rows - 1) * Q.tileGap) /
          e.rows >=
          70
    : !1;
}
function Jn({ onPick: e, autoFocus: t = !1, onFocusInput: i }) {
  let [a, o] = (0, ReactRuntime.useState)(``),
    [s, c] = (0, ReactRuntime.useState)(null),
    [l, u] = (0, ReactRuntime.useState)(null),
    [d, f] = (0, ReactRuntime.useState)(!1),
    [p, m] = (0, ReactRuntime.useState)(``),
    _ = (0, ReactRuntime.useRef)(0),
    v = () => {
      let e = a.trim();
      if (e.length < 2 || d) return;
      let t = ++_.current;
      (f(!0),
        r
          .weatherSearch(e)
          .then((n) => {
            t === _.current && (c(n), m(e), u(null));
          })
          .catch((e) => {
            t === _.current && (c(null), u(String(e)));
          })
          .finally(() => {
            t === _.current && f(!1);
          }));
    };
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `flex min-h-0 flex-col gap-1.5`,
    children: [
      (0, jsxRuntime.jsxs)(`label`, {
        className: `flex h-9 shrink-0 items-center gap-2 rounded-xl bg-white/[0.08] px-3 focus-within:bg-white/[0.12]`,
        children: [
          (0, jsxRuntime.jsx)(Ge, { size: 14, className: `shrink-0 text-white/40` }),
          (0, jsxRuntime.jsx)(`input`, {
            autoFocus: t,
            value: a,
            onChange: (e) => o(e.target.value),
            onMouseDown: i,
            onFocus: i,
            onKeyDown: (t) => {
              t.key === `Enter` && (s?.[0] && p === a.trim() ? e(s[0]) : v());
            },
            spellCheck: !1,
            placeholder: n(`Город: Казань, Berlin, Алматы…`, `City: London, Berlin, Almaty…`),
            className: `min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/35`,
          }),
          (0, jsxRuntime.jsx)(`button`, {
            onClick: v,
            disabled: d || a.trim().length < 2,
            className: `press -mr-1.5 h-6 shrink-0 rounded-lg bg-white/10 px-2.5 text-[11.5px] font-medium text-white hover:bg-white/16 disabled:opacity-40`,
            children: d ? n(`Ищу…`, `Searching…`) : n(`Найти`, `Find`),
          }),
        ],
      }),
      l &&
        (0, jsxRuntime.jsx)(`div`, {
          className: `px-1 text-[11.5px] leading-snug text-[#ff9b9b]`,
          children: l,
        }),
      s &&
        s.length === 0 &&
        (0, jsxRuntime.jsx)(`div`, {
          className: `px-1 text-[12px] text-white/45`,
          children: n(`Такого города не нашлось`, `No such city was found`),
        }),
      s &&
        s.length > 0 &&
        (0, jsxRuntime.jsx)(`div`, {
          className: `scroll-thin flex min-h-0 flex-col gap-0.5 overflow-y-auto`,
          children: s.map((t) =>
            (0, jsxRuntime.jsxs)(
              `button`,
              {
                onClick: () => e(t),
                className: `press flex h-9 shrink-0 items-center gap-2 rounded-lg px-2 text-left hover:bg-white/[0.08]`,
                children: [
                  (0, jsxRuntime.jsx)(Ce, { size: 13, className: `shrink-0 text-white/40` }),
                  (0, jsxRuntime.jsx)(`span`, {
                    className: `shrink-0 text-[12.5px] font-medium text-white`,
                    children: t.name,
                  }),
                  (0, jsxRuntime.jsx)(`span`, {
                    className: `min-w-0 truncate text-[11.5px] text-white/45`,
                    children: t.region,
                  }),
                ],
              },
              `${t.lat},${t.lon}`,
            ),
          ),
        }),
    ],
  });
}
var Yn = {
  yandex: { name: `Яндекс`, url: `https://yandex.ru/search/?text=%s` },
  google: { name: `Google`, url: `https://www.google.com/search?q=%s` },
  bing: { name: `Bing`, url: `https://www.bing.com/search?q=%s` },
  duckduckgo: { name: `DuckDuckGo`, url: `https://duckduckgo.com/?q=%s` },
};
function Xn(e) {
  if (!e) return !1;
  try {
    let t = new URL(e.trim().replace(/%s/g, `x`));
    return (t.protocol === `https:` || t.protocol === `http:`) && !!t.hostname;
  } catch {
    return !1;
  }
}
function Zn(e, t, n) {
  return e === `custom` && Xn(t)
    ? `custom`
    : e && e !== `auto` && e !== `custom`
      ? e
      : n === `ru`
        ? `yandex`
        : `google`;
}
function Qn(e, t, n, r) {
  let i = encodeURIComponent(e.trim()),
    a = Zn(t, n, r),
    o = a === `custom` ? n.trim() : Yn[a].url;
  return o.includes(`%s`) ? o.replace(/%s/g, i) : o + i;
}
function $n(e, t, n) {
  let r = Zn(e, t, n);
  return r === `custom`
    ? new URL(t.trim().replace(/%s/g, `x`)).hostname.replace(/^www\./, ``)
    : r === `yandex` && n !== `ru`
      ? `Yandex`
      : Yn[r].name;
}
function er(e) {
  let t = e.trim();
  return /^[a-zA-Z]:[\\/]/.test(t) || /^\\\\[^\\/]+[\\/][^\\/]+/.test(t);
}
function tr(e, t = 36) {
  let n = e.lastIndexOf(`\\`);
  if (n <= 0) return ``;
  let r = e.slice(0, n);
  if (r.length <= t) return r;
  let i = r.split(`\\`),
    a = i.slice(-2).join(`\\`);
  return `…\\` + (a.length <= t ? a : i[i.length - 1]);
}
function nr({ id: e, mood: t, look: n = 0, face: r = !0 }) {
  let i = (0, ReactRuntime.useRef)(null),
    a = (0, ReactRuntime.useRef)({ mood: t, look: n, face: r });
  a.current = { mood: t, look: n, face: r };
  let o = At(e);
  return (
    (0, ReactRuntime.useEffect)(() => {
      let e = i.current,
        t = e?.parentElement;
      if (!e || !t || o.kind !== `attach` || !o.puppet) return;
      let n = B(`g`, {}, e),
        r = Object.create(o.puppet);
      r.build(n, 0);
      let s = Nn(() => !1),
        c = (i) => {
          let c = t.clientWidth,
            l = t.clientHeight;
          (e.setAttribute(`width`, String(c)),
            e.setAttribute(`height`, String(l)),
            e.setAttribute(`viewBox`, `${-c / 2} 0 ${c} ${l}`),
            n.setAttribute(
              `transform`,
              o.id === `tail` ? `translate(${c / 2 - 60},${l - 30})` : `translate(0,${l - 30})`,
            ));
          let { pose: u, t: d, dt: f } = s.pose(i, a.current.mood, a.current.look, null, t);
          try {
            r.draw({ ...u, h: l, face: a.current.face }, i, d, f);
          } catch {}
        };
      c(performance.now());
      let l = Sn(c, () => wn(a.current.mood));
      return () => {
        (l(), e.replaceChildren());
      };
    }, [o]),
    (0, jsxRuntime.jsx)(`svg`, {
      ref: i,
      "data-ink-art": !0,
      className: `pointer-events-none absolute top-0 left-0 overflow-visible`,
      "aria-hidden": !0,
    })
  );
}
var rr = () => ({ top: 0, low: 0, level: 0, avg: 0, last: -1, moved: -1e9, heard: 0, hit: !1, age: 0 }),
  ir = 1200,
  ar = 0.08;
function or(e, t, n, r) {
  let i = Math.max(0, Math.min(1, t)),
    a = e.last < 0;
  (a ? (e.top = e.low = i) : Math.abs(i - e.last) > 0.004 && (e.moved = n), (e.last = i));
  let o = i > 0.003 && n - e.moved < ir;
  e.heard += (+!!o - e.heard) * (1 - Math.exp(-r / 0.25));
  let s = 1 - Math.exp(-r / 4);
  ((e.top = i > e.top ? i : e.top + (i - e.top) * s), (e.low = i < e.low ? i : e.low + (i - e.low) * s));
  let c = Math.max(0, Math.min(1, (i - e.low) / Math.max(ar, e.top - e.low)));
  (a && (e.level = e.avg = c),
    (e.level += (c - e.level) * (1 - Math.exp(-r / (c > e.level ? 0.025 : 0.16)))),
    (e.age += r),
    (e.avg += (c - e.avg) * (1 - Math.exp(-r / Math.min(1.1, 0.2 + e.age * 0.45)))));
  let l = Math.max(0, Math.min(1, (e.level - e.avg) / (0.22 * e.avg + 0.05))),
    u = !1;
  return (
    l > 0.45 && !e.hit ? ((e.hit = !0), (u = o)) : l < 0.2 && (e.hit = !1),
    { env: 0.2 + 0.8 * Math.min(1, 0.45 * e.level + 0.9 * l), heard: e.heard, hit: u }
  );
}
var $ = 90,
  sr = {
    idle: `var(--liquid-rim, rgb(255 255 255 / 0.22))`,
    music: `#F0997B`,
    think: `#AFA9EC`,
    happy: `#97C459`,
    attn: `#EF9F27`,
    sad: `#ff6b6b`,
    eat: `#85B7EB`,
    sleep: `#5F5E5A`,
  },
  cr = 7,
  lr = (e) => Math.exp(-e * e),
  ur = 14,
  dr = 620,
  fr = new Set();
function pr() {
  fr.forEach((e) => e());
}
function mr({
  mood: e,
  accent: t,
  ears: n = !1,
  round: r = !1,
  rain: i = !1,
  tint: a = null,
  scaled: o = !1,
}) {
  let s = (0, ReactRuntime.useRef)(null),
    c = (0, ReactRuntime.useRef)({ mood: e, accent: t, ears: n, round: r, rain: i, scaled: o });
  c.current = { mood: e, accent: t, ears: n, round: r, rain: i, scaled: o };
  let l = (0, ReactRuntime.useRef)(null),
    u = a ? `color-mix(in srgb, ${a} 30%, var(--color-island))` : `var(--color-island)`,
    d = (0, ReactRuntime.useRef)(u);
  return (
    (d.current = u),
    (0, ReactRuntime.useEffect)(() => {
      l.current && (l.current.style.stopColor = u);
    }, [u]),
    (0, ReactRuntime.useEffect)(() => {
      let e = s.current,
        t = e?.parentElement;
      if (!e || !t) return;
      let n = (t, n) => {
          let r = document.createElementNS(z, t);
          for (let e in n) r.setAttribute(e, n[e]);
          return (e.appendChild(r), r);
        },
        r = n(`g`, {}),
        i = `liquid-${Math.random().toString(36).slice(2)}`,
        a = n(`linearGradient`, {
          id: i,
          gradientUnits: `userSpaceOnUse`,
          x1: `0`,
          x2: `0`,
          y1: `0`,
          y2: `30`,
        }),
        o = (e, t) => {
          let n = document.createElementNS(z, `stop`);
          return (
            n.setAttribute(`offset`, e),
            (n.style.stopColor = t),
            (n.style.transition = `stop-color 0.45s ease`),
            a.appendChild(n),
            n
          );
        };
      (o(`0.35`, `var(--color-island)`), (l.current = o(`1`, d.current)));
      let u = n(`path`, {});
      ((u.style.fill = `url(#${i})`), (u.style.stroke = `var(--island-edge, transparent)`));
      let f = n(`path`, { fill: `none`, "stroke-width": `1.8`, "stroke-linecap": `round` }),
        p = new Float32Array($),
        m = new Float32Array($),
        h = new Float32Array($),
        g = 150,
        _ = 30,
        v = 30,
        ee = 150,
        te = 0,
        y = 0,
        b = c.current.mood,
        x = performance.now(),
        S = 0,
        ne = !1,
        re = !1,
        ie = 0,
        ae = 0,
        C = !1,
        oe = -1e9,
        w = null,
        se = [],
        ce = rr(),
        le = new Float32Array(Math.ceil($ / cr)).fill(1),
        T = new Float32Array(le.length),
        E = 0,
        D = () => Math.min(_ / 2, _ > 60 ? 32 : 26),
        ue = (e) => {
          let t = D(),
            n = g / 2 - t,
            r = Math.abs(e);
          if (r <= n) return _;
          let i = Math.min(t, r - n);
          return _ - t + Math.sqrt(Math.max(0, t * t - i * i));
        },
        O = (e) => -g / 2 + (e / 89) * g,
        k = (e) => Math.sin((Math.PI * e) / 89) ** 0.7,
        A = (e, t, n) => {
          for (let r = 0; r < $; r++) m[r] += t * lr((O(r) - e) / n) * k(r);
        },
        j = (e, t, n, i) => {
          let a = document.createElementNS(z, `g`),
            o = document.createElementNS(z, `circle`);
          (o.setAttribute(`r`, String(i)),
            (o.style.fill = `var(--color-island)`),
            (o.style.stroke = `var(--island-edge, transparent)`));
          let s = document.createElementNS(z, `circle`);
          (s.setAttribute(`r`, String(Math.max(1, i * 0.28))),
            s.setAttribute(`cx`, String(-i * 0.35)),
            s.setAttribute(`cy`, String(-i * 0.35)),
            s.setAttribute(`fill`, `#FFFFFF`),
            s.setAttribute(`opacity`, `0.4`),
            a.append(o, s),
            r.appendChild(a));
          let c = { x: e, y: t, vy: n, r: i, g: a, age: 0, mode: `fall` };
          return (se.push(c), c);
        },
        M = (e) => {
          let t = `${e[0][0].toFixed(1)},${e[0][1].toFixed(1)}`;
          for (let n = 1; n < e.length - 1; n++) {
            let r = [(e[n][0] + e[n + 1][0]) / 2, (e[n][1] + e[n + 1][1]) / 2];
            t += ` Q${e[n][0].toFixed(1)},${e[n][1].toFixed(1)} ${r[0].toFixed(1)},${r[1].toFixed(1)}`;
          }
          let n = e[e.length - 1];
          return t + ` L${n[0].toFixed(1)},${n[1].toFixed(1)}`;
        },
        N = (e) => {
          let t = Math.min(0.05, S ? (e - S) / 1e3 : 0.016);
          S = e;
          let n = c.current.mood;
          n !== b && ((b = n), (x = e), (ne = !1), (re = !1), n === `music` && A(0, -120, 80));
          let r = e - x,
            i = P(),
            a = (_ - v) / Math.max(t, 0.004);
          !C && a < -300 && _ < v ? (C = !0) : C && a > -40 && ((C = !1), (oe = _ < 70 ? e : e - dr * 0.45));
          let o = C || e - oe < dr,
            s = C ? 0 : Math.min(1, Math.max(0, (e - oe - dr * 0.45) / (dr * 0.55))),
            l = Math.max(-140, Math.min(140, -(a - te) * 0.45));
          if (Math.abs(l) > 0.5) for (let e = 1; e < 89; e++) m[e] += l * k(e);
          ((Math.abs(_ - v) > 0.3 || Math.abs(g - ee) > 0.3) && (y = e + 400), (te = a), (v = _), (ee = g));
          let u = 0,
            d = 0;
          if (b === `music`) {
            let n = or(ce, useIslandStore.getState().level, e, t);
            if (((u = n.env), (d = n.heard), n.hit))
              for (let e = 0; e < le.length; e++) le[e] = 0.5 + 0.5 * Math.random();
          }
          let D = useIslandStore.getState(),
            M =
              b === `music` &&
              D.settings?.liquidSpectrum === !0 &&
              D.bands.length > 1 &&
              performance.now() - D.bandsAt < 700
                ? D.bands
                : null;
          E += (+!!M - E) * (1 - Math.exp(-t / 0.2));
          for (let e = 0; e < T.length; e++) {
            let n = 0;
            if (M) {
              let t = T.length > 1 ? (e / (T.length - 1)) ** 1.2 * (M.length - 1) : 0,
                r = Math.floor(t),
                i = Math.min(M.length - 1, r + 1);
              n = M[r] + (M[i] - M[r]) * (t - r);
            }
            T[e] += (n - T[e]) * (1 - Math.exp(-t / (n > T[e] ? 0.02 : 0.11)));
          }
          let N = Lt(),
            I = N ? { x: N.x - (i.left + g / 2), y: N.y - i.top } : null;
          for (let t = 0; t < $; t++) {
            let n = O(t),
              i = k(t),
              a = 0;
            if ((b === `idle` && (a = 2.5 * Math.sin(t * 0.12 + e / 1100)), b === `music`)) {
              let n = 0.25 + 0.75 * Math.max(0, Math.sin((e / 545) * Math.PI)) ** 2,
                r = n + (u - n) * d,
                i = 1 + (le[Math.floor(t / cr)] - 1) * d,
                o = (t % cr) - 3,
                s = Math.max(0, 1 - Math.abs(o) / 3.5),
                c = r * i,
                l = c + (0.1 + 0.9 * T[Math.floor(t / cr)] - c) * E,
                f = Math.min(t, 89 - t) - 4,
                p = Math.max(0, Math.min(1, f / 6)),
                m = p * p * (3 - 2 * p);
              a = Math.min(30, _ * 0.9) * l * s * s * (1 + (m - 1) * E);
            }
            if (
              (b === `think` && (a = 4 * Math.sin(t * 0.32 - e / 130)),
              b === `happy` && (a = r < 520 ? 18 * Math.min(1, r / 520) * lr(n / 26) : 0),
              b === `attn` || b === `sad`)
            ) {
              let n = (t % 5) - 2,
                r = Math.max(0, 1 - Math.abs(n) / 2.5);
              a = (10 + 3 * Math.sin(e / 30 + t)) * r * r;
            }
            if (
              (b === `eat` && (a = r < 700 ? 12 * Math.min(1, r / 700) * lr(n / 24) : 0),
              b === `sleep` && (a = 10 * i ** 2 + 1.2 * Math.sin(e / 1500)),
              I && b !== `sleep` && I.y > _ * 0.6 && Math.abs(I.x) < g / 2 + 60)
            ) {
              let e = 22 * Math.exp(-Math.max(0, I.y - _) / 140);
              a += e * lr((n - I.x) / 40);
            }
            h[t] = a * i * s;
          }
          let L = !o && (b === `music` || b === `attn` || b === `sad`),
            R = L ? 80 : 700,
            fe = L ? 420 : b === `sleep` ? 40 : 70,
            pe = L ? 30 : 6,
            me = t / 8;
          for (let e = 0; e < 8; e++) {
            for (let e = 1; e < 89; e++)
              m[e] += (R * (p[e - 1] + p[e + 1] - 2 * p[e]) - fe * (p[e] - h[e]) - pe * m[e]) * me;
            let e = Math.min(25, _ * 0.45);
            for (let t = 1; t < 89; t++)
              ((p[t] = Math.min(50, p[t] + m[t] * me)), p[t] < -e && ((p[t] = -e), m[t] < 0 && (m[t] = 0)));
            p[0] = p[89] = m[0] = m[89] = 0;
          }
          (b === `happy` &&
            r >= 520 &&
            !ne &&
            ((ne = !0), j(0, _ + 12, 40, Math.min(7, _ * 0.22)), A(0, -240, 20)),
            b === `eat` && r >= 700 && !re && ((re = !0), A(0, -360, 22)),
            b === `idle` && e - ie > 3600 && ((ie = e), A((Math.random() - 0.5) * g * 0.6, -120, 16)),
            b === `idle` &&
              c.current.rain &&
              e - ae > 1500 + Math.random() * 900 &&
              ((ae = e), j((Math.random() - 0.5) * g * 0.7, _ + 4, 26, 2.3)),
            b === `think` && !w
              ? ((w = j(0, _ + 20, 0, 4)), (w.mode = `orbit`))
              : b !== `think` && w && ((w.mode = `home`), (w = null)),
            (se = se.filter((n) => {
              if (((n.age += t), n.mode === `orbit`)) {
                let t = e / 650;
                ((n.x = Math.cos(t) * g * 0.32), (n.y = _ + 20 + Math.sin(t * 2) * 6));
              } else if (n.mode === `fall`) {
                if (
                  ((n.vy += 520 * t),
                  (n.y += n.vy * t),
                  b === `happy` && n.age > 0.5 && (n.mode = `home`),
                  (n.r < 4 &&
                    (n.g.setAttribute(`opacity`, Math.max(0, 1 - n.age / 1.3).toFixed(2)), n.age > 1.3)) ||
                    n.y > _ + 120 ||
                    n.age > 3)
                )
                  return (n.g.remove(), !1);
              } else if (
                ((n.vy += (-60 * (n.y - (ue(n.x) - 2)) - 5 * n.vy) * t),
                (n.y += n.vy * t),
                n.y < ue(n.x) + n.r * 0.6 || n.age > 4)
              )
                return (A(n.x, -300, 18), n.g.remove(), !1);
              return (n.g.setAttribute(`transform`, `translate(${n.x.toFixed(1)},${n.y.toFixed(1)})`), !0);
            })),
            de());
          let he = b === `music` && c.current.accent ? c.current.accent : sr[b];
          ((f.style.stroke = he),
            f.setAttribute(
              `opacity`,
              b === `sleep`
                ? `0.35`
                : b === `attn`
                  ? (0.5 + 0.4 * Math.abs(Math.sin(e / 120))).toFixed(2)
                  : `0.75`,
            ));
        },
        P = () => {
          let n = t.getBoundingClientRect();
          if (c.current.scaled) {
            let e = getComputedStyle(t);
            ((g = parseFloat(e.width)), (_ = parseFloat(e.height)));
          } else ((g = n.width), (_ = n.height));
          return (
            e.setAttribute(`width`, g.toFixed(2)),
            e.setAttribute(`height`, (_ + 120).toFixed(1)),
            e.setAttribute(`viewBox`, `${(-g / 2).toFixed(2)} 0 ${g.toFixed(2)} ${(_ + 120).toFixed(1)}`),
            n
          );
        },
        I = 30,
        de = () => {
          let e = [];
          for (let t = 0; t < $; t++) {
            let n = O(t);
            e.push([n, ue(n) + p[t]]);
          }
          let t = D(),
            n = g / 2,
            r = Math.max(0, _ - t),
            i = c.current.ears ? Math.min(ur, r) : 0,
            o = c.current.round && i === 0 ? t : 0,
            s = c.current.ears ? -2 : 0,
            l = (e) => e.toFixed(2);
          (u.setAttribute(
            `d`,
            `M${l(-n - i + o)},${s} H${l(n + i - o)}` +
              (s < 0 ? ` V0` : ``) +
              (i > 0 ? ` A${l(i)},${l(i)} 0 0 0 ${l(n)},${l(i)}` : ``) +
              (o > 0 ? ` A${l(o)},${l(o)} 0 0 1 ${l(n)},${l(o)}` : ``) +
              ` L${l(n)},${l(r)} L` +
              M(e.slice().reverse()) +
              ` L${l(-n)},${l(r)}` +
              (i > 0 ? ` L${l(-n)},${l(i)} A${l(i)},${l(i)} 0 0 0 ${l(-n - i)},0` : ``) +
              (o > 0 ? ` L${l(-n)},${l(o)} A${l(o)},${l(o)} 0 0 1 ${l(-n + o)},0` : ``) +
              ` Z`,
          ),
            f.setAttribute(`d`, `M` + M(e.slice(4, 86).map(([e, t]) => [e, t - 2.2]))),
            _ !== I && (a.setAttribute(`y2`, l(_)), (I = _)),
            me(e, n, r));
        },
        L = t.querySelector(`:scope > [data-liquid-clip]`),
        R = L?.querySelector(`:scope > [data-liquid-squash]`) ?? null,
        fe = !1,
        pe = !1,
        me = (e, t, n) => {
          if (!L) return;
          let r = 0,
            i = 0,
            a = 0;
          for (let e = 0; e < $; e++)
            ((r = Math.max(r, -p[e])), e > $ * 0.15 && e < $ * 0.85 && ((i += p[e]), a++));
          if (((i /= a), r > 5)) {
            let r = (e) => e.toFixed(1),
              i = M(e.map(([e, n]) => [e + t, n]).reverse());
            ((L.style.clipPath = `path("M0,0 H${r(2 * t)} L${r(2 * t)},${r(n)} L${i} L0,${r(n)} Z")`),
              (fe = !0));
          } else fe &&= ((L.style.clipPath = ``), !1);
          if (!R) return;
          let o = Math.max(0, Math.min(1, (90 - _) / 42)),
            s = i < -3 ? i * Math.min(1, (-i - 3) / 4) : 0,
            c = s < 0 && o > 0 ? 1 + (s / Math.max(_, 1)) * o : 1;
          c < 1
            ? ((R.style.transform = `scaleY(${c.toFixed(3)})`), (pe = !0))
            : (pe &&= ((R.style.transform = ``), !1));
        },
        he = () => {
          let e = g,
            t = _;
          (P(), (g !== e || _ !== t) && de());
        };
      (fr.add(he), N(performance.now()));
      let ge = Sn(N, () => {
        if (performance.now() < y) return 0;
        let e = c.current.mood;
        return e === `sleep` ? 50 : e === `idle` ? 16 : 0;
      });
      return () => {
        (ge(),
          fr.delete(he),
          (l.current = null),
          e.replaceChildren(),
          L && (L.style.clipPath = ``),
          R && (R.style.transform = ``));
      };
    }, []),
    (0, jsxRuntime.jsx)(`svg`, {
      ref: s,
      className: `pointer-events-none absolute top-0 left-0 overflow-visible`,
      "aria-hidden": !0,
    })
  );
}
export {
  xe as $,
  Et as A,
  qe as B,
  Rn as C,
  Zt as D,
  en as E,
  rt as F,
  Le as G,
  Ue as H,
  tt as I,
  je as J,
  Fe as K,
  $e as L,
  Ot as M,
  nt as N,
  nn as O,
  it as P,
  Ce as Q,
  Ze as R,
  Dn as S,
  hn as T,
  Ve as U,
  Ge as V,
  ze as W,
  De as X,
  ke as Y,
  Te as Z,
  Ln as _,
  d as _t,
  er as a,
  de as at,
  zn as b,
  m as bt,
  Qn as c,
  ee as ct,
  Wn as d,
  x as dt,
  ye as et,
  Kn as f,
  re as ft,
  Vn as g,
  f as gt,
  Hn as h,
  v as ht,
  tr as i,
  R as it,
  At as j,
  It as k,
  Jn as l,
  ie as lt,
  qn as m,
  ne as mt,
  pr as n,
  he as nt,
  Xn as o,
  useIslandStore as ot,
  Gn as p,
  _ as pt,
  Ne as q,
  nr as r,
  pe as rt,
  $n as s,
  ce as st,
  mr as t,
  _e as tt,
  Q as u,
  y as ut,
  Bn as v,
  p as vt,
  On as w,
  Cn as x,
  l as xt,
  En as y,
  u as yt,
  Ye as z,
};
