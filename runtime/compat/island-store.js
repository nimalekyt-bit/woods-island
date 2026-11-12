import { creatures } from '../characters/drawings/creatures';
import { things } from '../characters/drawings/things';
import { genericDrawings } from '../characters/drawings/generic';
import { CharacterSprite } from '../characters/CharacterSprite';
import { AttachedCharacter } from '../characters/AttachedCharacter';
import { setNativeCursor as It } from '../characters/cursor';
import { suspendCharacterAnimations as Cn } from '../characters/scheduler';
import { LiquidIsland } from '../characters/LiquidIsland';
import { measureLiquidIslands as pr } from '../characters/liquid';
import { PixelCharacter } from '../characters/PixelCharacter';
import { createCharacterCatalog } from "../characters/catalog";
import { approvedDefinitions } from '../characters/approved';
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
  n(`Все 36 встроенных персонажей`, `All 36 built-in characters`),
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
const { catalog: Et, describe: Ot, find: At } = createCharacterCatalog({
  creatures, things, renderers: genericDrawings, language: e, additions: approvedDefinitions,
});

const Yt = PixelCharacter;
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
var Tn = (e) => e.settings?.moduleMedia !== !1 && e.mediaLive && e.media?.playing === !0,
  En = (e) => S(e.settings, e.license.pro, Tn(e));
function Dn() {
  return useIslandStore((e) => At(e.settings ? En(e) : null));
}
function On() {
  return Dn().kind === `slot`;
}
function Ln({ id, ...props }) {
  return jsxRuntime.jsx(CharacterSprite, { definition: At(id), ...props });
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
function nr({ id, ...props }) {
  return jsxRuntime.jsx(AttachedCharacter, { definition: At(id), ...props });
}
function readLiquidAudio() {
  const state = useIslandStore.getState();
  return { level: state.level, bands: state.bands, bandsAt: state.bandsAt,
    liquidSpectrum: state.settings?.liquidSpectrum === true };
}
function mr(props) {
  return jsxRuntime.jsx(LiquidIsland, { ...props, readAudio: readLiquidAudio });
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
