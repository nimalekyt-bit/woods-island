import { applyMotionPreferences } from '../preferences/motion';
import {
  characterRestWidth as Ne, characterSlotWidth as Pe, distributeFaceWidgets as We,
  timerTextWidth as et, idleSize as rt, snapWidth as it, normalMediaSize as ct,
  resolveMediaPill as lt, titleMediaSize as pt, lyricsNeedWrap as _t,
  playerMediaSize as bt, lyricsMediaSize as gt,
} from '../island/sizing';
// Compatibility application source; migrate components incrementally.
import { v, _, o, u, g, m, c } from "../vendor/react-foundation.js";
function y() {
  return (typeof navigator < `u`
    ? navigator.languages?.length
      ? navigator.languages
      : [navigator.language]
    : []
  ).some((e) => v.test(e ?? ``))
    ? `ru`
    : `en`;
}
function b(e) {
  return e === `ru` || e === `en` ? e : y();
}
var x = y();
typeof document < `u` && (document.documentElement.lang = x);
var ee = new Set();
function te() {
  return x;
}
function ne(e) {
  e !== x && ((x = e), typeof document < `u` && (document.documentElement.lang = e), ee.forEach((e) => e()));
}
function S(e, t) {
  return x === `ru` ? e : t;
}
function re() {
  return (0, _.useSyncExternalStore)(
    (e) => (ee.add(e), () => ee.delete(e)),
    () => x,
  );
}
function C() {
  return x === `ru` ? `ru-RU` : `en-US`;
}
function ie(e, t, n, r) {
  let i = Math.abs(e) % 100,
    a = i % 10;
  return i > 10 && i < 20 ? r : a === 1 ? t : a >= 2 && a <= 4 ? n : r;
}
function ae(e, t, n) {
  return x === `ru` ? `${e} ${ie(e, ...t)}` : `${e} ${e === 1 ? n[0] : n[1]}`;
}
function w(e, t, n, r) {
  if (n === `a` && !r) throw TypeError(`Private accessor was defined without a getter`);
  if (typeof t == `function` ? e !== t || !r : !t.has(e))
    throw TypeError(`Cannot read private member from an object whose class did not declare it`);
  return n === `m` ? r : n === `a` ? r.call(e) : r ? r.value : t.get(e);
}
function oe(e, t, n, r, i) {
  if (r === `m`) throw TypeError(`Private method is not writable`);
  if (r === `a` && !i) throw TypeError(`Private accessor was defined without a setter`);
  if (typeof t == `function` ? e !== t || !i : !t.has(e))
    throw TypeError(`Cannot write private member to an object whose class did not declare it`);
  return (r === `a` ? i.call(e, n) : i ? (i.value = n) : t.set(e, n), n);
}
var se,
  ce,
  le,
  ue,
  de,
  fe = `__TAURI_TO_IPC_KEY__`;
function pe(e, t = !1) {
  return window.__TAURI_INTERNALS__.transformCallback(e, t);
}
var me = class {
  constructor(e) {
    (se.set(this, void 0),
      ce.set(this, 0),
      le.set(this, []),
      ue.set(this, void 0),
      oe(this, se, e || (() => {}), `f`),
      (this.id = pe((e) => {
        let t = e.index;
        if (`end` in e) {
          t == w(this, ce, `f`) ? this.cleanupCallback() : oe(this, ue, t, `f`);
          return;
        }
        let n = e.message;
        if (t == w(this, ce, `f`)) {
          for (
            w(this, se, `f`).call(this, n), oe(this, ce, w(this, ce, `f`) + 1, `f`);
            w(this, ce, `f`) in w(this, le, `f`);

          ) {
            let e = w(this, le, `f`)[w(this, ce, `f`)];
            (w(this, se, `f`).call(this, e),
              delete w(this, le, `f`)[w(this, ce, `f`)],
              oe(this, ce, w(this, ce, `f`) + 1, `f`));
          }
          w(this, ce, `f`) === w(this, ue, `f`) && this.cleanupCallback();
        } else w(this, le, `f`)[t] = n;
      })));
  }
  cleanupCallback() {
    window.__TAURI_INTERNALS__.unregisterCallback(this.id);
  }
  set onmessage(e) {
    oe(this, se, e, `f`);
  }
  get onmessage() {
    return w(this, se, `f`);
  }
  [((se = new WeakMap()), (ce = new WeakMap()), (le = new WeakMap()), (ue = new WeakMap()), fe)]() {
    return `__CHANNEL__:${this.id}`;
  }
  toJSON() {
    return this[fe]();
  }
};
async function T(e, t = {}, n) {
  return window.__TAURI_INTERNALS__.invoke(e, t, n);
}
var he = class {
    get rid() {
      return w(this, de, `f`);
    }
    constructor(e) {
      (de.set(this, void 0), oe(this, de, e, `f`));
    }
    async close() {
      return T(`plugin:resources|close`, { rid: this.rid });
    }
    async [((de = new WeakMap()), Symbol.asyncDispose)]() {
      await this.close();
    }
  },
  ge;
(function (e) {
  ((e.WINDOW_RESIZED = `tauri://resize`),
    (e.WINDOW_MOVED = `tauri://move`),
    (e.WINDOW_CLOSE_REQUESTED = `tauri://close-requested`),
    (e.WINDOW_DESTROYED = `tauri://destroyed`),
    (e.WINDOW_FOCUS = `tauri://focus`),
    (e.WINDOW_BLUR = `tauri://blur`),
    (e.WINDOW_SCALE_FACTOR_CHANGED = `tauri://scale-change`),
    (e.WINDOW_THEME_CHANGED = `tauri://theme-changed`),
    (e.WINDOW_CREATED = `tauri://window-created`),
    (e.WINDOW_SUSPENDED = `tauri://suspended`),
    (e.WINDOW_RESUMED = `tauri://resumed`),
    (e.WEBVIEW_CREATED = `tauri://webview-created`),
    (e.DRAG_ENTER = `tauri://drag-enter`),
    (e.DRAG_OVER = `tauri://drag-over`),
    (e.DRAG_DROP = `tauri://drag-drop`),
    (e.DRAG_LEAVE = `tauri://drag-leave`));
})((ge ||= {}));
async function _e(e, t) {
  (window.__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener(e, t),
    await T(`plugin:event|unlisten`, { event: e, eventId: t }));
}
async function ve(e, t, n) {
  return T(`plugin:event|listen`, {
    event: e,
    target:
      typeof n?.target == `string` ? { kind: `AnyLabel`, label: n.target } : (n?.target ?? { kind: `Any` }),
    handler: pe(t),
  }).then((t) => async () => _e(e, t));
}
async function ye(e, t, n) {
  return ve(
    e,
    (n) => {
      (_e(e, n.id), t(n));
    },
    n,
  );
}
async function be(e, t) {
  await T(`plugin:event|emit`, { event: e, payload: t });
}
async function xe(e, t, n) {
  await T(`plugin:event|emit_to`, {
    target: typeof e == `string` ? { kind: `AnyLabel`, label: e } : e,
    event: t,
    payload: n,
  });
}
import { api as Ce } from "../ipc/legacy-api";

function we(e, t) {
  return ve(e, (e) => t(e.payload));
}
var E = /^(text|search|url|email|tel|password|number|)$/;
function D(e) {
  if (!(e instanceof Element)) return null;
  let t = e.closest(`input, textarea`);
  return t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && E.test(t.type)) ? t : null;
}
function Te(e, t) {
  if (!e) return t ? [{ id: `copy`, label: S(`Копировать`, `Copy`), keys: `Ctrl+C`, enabled: !0 }] : [];
  let n = e.selected && !e.secret;
  return [
    { id: `cut`, label: S(`Вырезать`, `Cut`), keys: `Ctrl+X`, enabled: n && e.editable },
    { id: `copy`, label: S(`Копировать`, `Copy`), keys: `Ctrl+C`, enabled: n },
    { id: `paste`, label: S(`Вставить`, `Paste`), keys: `Ctrl+V`, enabled: e.editable },
    { id: `all`, label: S(`Выделить всё`, `Select all`), keys: `Ctrl+A`, enabled: !e.empty },
  ];
}
function Ee(e, t, n, r) {
  let i = r.bottom - r.top < t.h + 12,
    a = i ? n : t,
    o = (e, t, n) => Math.max(t, Math.min(e, Math.max(t, n)));
  return { x: o(e.x, r.left + 6, r.right - 6 - a.w), y: o(e.y, r.top + 6, r.bottom - 6 - a.h), row: i };
}
var De = null;
function Oe(e, t, n) {
  De?.close();
  let r = document.createElement(`div`);
  ((r.className = `ctx-menu`),
    r.setAttribute(`role`, `menu`),
    r.addEventListener(`mousedown`, (e) => e.preventDefault()));
  for (let e of t) {
    let t = document.createElement(`button`);
    ((t.type = `button`),
      (t.dataset.ctx = e.id),
      (t.disabled = !e.enabled),
      t.setAttribute(`role`, `menuitem`));
    let i = document.createElement(`span`);
    i.textContent = e.label;
    let a = document.createElement(`kbd`);
    ((a.textContent = e.keys),
      t.append(i, a),
      t.addEventListener(`click`, () => {
        (u(), ke(e.id, n));
      }),
      r.append(t));
  }
  document.body.append(r);
  let i = r.getBoundingClientRect();
  r.classList.add(`row`);
  let a = r.getBoundingClientRect(),
    o = document.querySelector(`[data-island]`)?.getBoundingClientRect() ?? {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
    },
    s = Ee({ x: e.clientX, y: e.clientY }, { w: i.width, h: i.height }, { w: a.width, h: a.height }, o);
  (r.classList.toggle(`row`, s.row),
    (r.style.left = `${Math.round(s.x)}px`),
    (r.style.top = `${Math.round(s.y)}px`));
  let c = (e) => {
      (!(e.target instanceof Node) || !r.contains(e.target)) && u();
    },
    l = (e) => {
      e.key === `Escape` && (e.stopImmediatePropagation(), e.preventDefault(), u());
    };
  function u() {
    (r.remove(),
      window.removeEventListener(`mousedown`, c, !0),
      window.removeEventListener(`keydown`, l, !0),
      window.removeEventListener(`blur`, u),
      window.removeEventListener(`wheel`, u, !0),
      De?.el === r && (De = null));
  }
  (window.addEventListener(`mousedown`, c, !0),
    window.addEventListener(`keydown`, l, !0),
    window.addEventListener(`blur`, u),
    window.addEventListener(`wheel`, u, !0),
    (De = { el: r, close: u }));
}
function ke(e, t) {
  if (e === `all`) {
    t && (t.focus(), t.select());
    return;
  }
  if (e === `paste`) {
    if (!t) return;
    Ce.clipCurrentText().then((e) => {
      e &&
        t.isConnected &&
        (t.focus(),
        document.execCommand(`insertText`, !1, t instanceof HTMLInputElement ? e.replace(/\r?\n/g, ` `) : e));
    });
    return;
  }
  (t?.focus(), document.execCommand(e));
}
function O() {
  let e = (e) => {
    e.preventDefault();
    let t = D(e.target),
      n = t && !t.disabled ? t : null,
      r = Te(
        n && {
          selected: (n.selectionEnd ?? 0) > (n.selectionStart ?? 0),
          editable: !n.readOnly,
          empty: n.value.length === 0,
          secret: n instanceof HTMLInputElement && n.type === `password`,
        },
        !n && (window.getSelection()?.toString().trim().length ?? 0) > 0,
      );
    if (r.length === 0) {
      De?.close();
      return;
    }
    Oe(e, r, n);
  };
  return (
    window.addEventListener(`contextmenu`, e),
    () => {
      (window.removeEventListener(`contextmenu`, e), De?.close());
    }
  );
}
function Ye(e) { return e.name ? e.name.slice(0, 12) : String(e.index); }
function xt(e, t, n = !1) {
  let r = e.getHours(),
    i = String(e.getMinutes()).padStart(2, `0`),
    a = n ? `:` + String(e.getSeconds()).padStart(2, `0`) : ``;
  return `${t ? (r % 12 == 0 ? 12 : r % 12) : r}:${i}${a}`;
}
function St(e, t) {
  if (e === `ru`) return !1;
  try {
    return new Intl.DateTimeFormat(t, { hour: `numeric` }).resolvedOptions().hour12 === !0;
  } catch {
    return !0;
  }
}
function Ct(e, t) {
  return e && (t === `idle` || t.startsWith(`live`));
}
function wt(e) {
  return typeof e != `number` || !Number.isFinite(e) ? 1 : Math.min(100, Math.max(20, Math.round(e))) / 100;
}
function Tt(e) {
  return e.shy || (e.autoHide && !((e.showOnDesktop && e.desktop) || e.keep === !0));
}
var Et = new Set([`idle`, `liveMedia`, `liveShelf`, `liveStatus`]);
function Dt(e) {
  return Et.has(e);
}
var Ot = new Set([`idle`, `liveMedia`, `liveShelf`, `liveStatus`, `liveDownloads`]);
function kt(e) {
  return !e.autoHide || !Ot.has(e.mode) || e.hovered || e.atEdge;
}
var At = `auto`,
  jt = new Set();
function k(e) {
  let t = e === `12` || e === `24` ? e : `auto`;
  t !== At && ((At = t), jt.forEach((e) => e()));
}
function Mt(e, t, n) {
  return e === `12` || (e !== `24` && St(t, n));
}
function Nt() {
  return Mt(At, te(), typeof navigator < `u` ? navigator.language : void 0);
}
function Pt() {
  return (
    (0, _.useSyncExternalStore)(
      (e) => (jt.add(e), () => jt.delete(e)),
      () => At,
    ),
    Nt()
  );
}
function Ft(e, t, n = Nt()) {
  let r = String(t).padStart(2, `0`);
  return n ? `${e % 12 == 0 ? 12 : e % 12}:${r} ${e < 12 ? `AM` : `PM`}` : `${e}:${r}`;
}
function It(e, t = Nt()) {
  return t ? `${e % 12 == 0 ? 12 : e % 12} ${e < 12 ? `AM` : `PM`}` : `${e}:00`;
}
var Lt = o((e) => {
    var t = Symbol.for(`react.transitional.element`),
      n = Symbol.for(`react.fragment`);
    function r(e, n, r) {
      var i = null;
      if ((r !== void 0 && (i = `` + r), n.key !== void 0 && (i = `` + n.key), `key` in n))
        for (var a in ((r = {}), n)) a !== `key` && (r[a] = n[a]);
      else r = n;
      return ((n = r.ref), { $$typeof: t, type: e, key: i, ref: n === void 0 ? null : n, props: r });
    }
    ((e.Fragment = n), (e.jsx = r), (e.jsxs = r));
  }),
  Rt = o((e, t) => {
    t.exports = Lt();
  }),
  zt = Rt();
function Bt({ children: e }) {
  let t = re();
  return (
    (0, _.useEffect)(O, []),
    (0, _.useEffect)(() => {
      let e = (e) => {
        (ne(b(e.language)), k(e.clockFormat));
        applyMotionPreferences(e.reducedMotion);
      };
      Ce.settingsGet().then(e);
      let t = we(`settings:changed`, e);
      return () => void t.then((e) => e());
    }, []),
    (0, zt.jsx)(_.Fragment, { children: e }, t)
  );
}
var Vt = (e) => e?.replace(/([a-z0-9])([A-Z])/g, `$1-$2`).toLowerCase();
function Ht(e, t, n = []) {
  if (t == null) throw Error(`[lucide]: iconNode is required when icon name is used`);
  return { name: Vt(e), size: 24, node: t, ...(n.length > 0 ? { aliases: n } : {}) };
}
var Ut = (e) => {
    let t = ``,
      n = !1;
    for (let r of e) {
      if (r === `-` || r === `_` || r <= ` `) {
        n = t.length > 0;
        continue;
      }
      (t.length === 0 ? (t += r.toLowerCase()) : (t += n ? r.toUpperCase() : r), (n = !1));
    }
    return t;
  },
  Wt = (e) => {
    let t = Ut(e);
    return t.charAt(0).toUpperCase() + t.slice(1);
  },
  A = (...e) =>
    e
      .filter((e, t, n) => !!e && e.trim() !== `` && n.indexOf(e) === t)
      .join(` `)
      .trim(),
  Gt = {
    xmlns: `http://www.w3.org/2000/svg`,
    width: 24,
    height: 24,
    viewBox: `0 0 24 24`,
    fill: `none`,
    stroke: `currentColor`,
    "stroke-width": 2,
    "stroke-linecap": `round`,
    "stroke-linejoin": `round`,
  };
function Kt(e) {
  return e != null;
}
function qt(e, t = {}) {
  let n = t.attributeNames ?? {},
    r = (e) => n[e] ?? e,
    i = e.size ?? e.width ?? Gt.width,
    a = e.size ?? e.height ?? Gt.height,
    o = e.aliases?.filter((e) => typeof e == `string` && e.trim() !== ``).map((e) => `lucide-${e}`) ?? [],
    s = [...(e.name ? [`lucide-${e.name}`] : []), ...o],
    c = t.className?.split(` `).filter(Boolean) ?? [],
    l = t.includeDefaultClasses === !1 ? A(...c) : A(`lucide`, ...s, ...c),
    u = t.absoluteStrokeWidth
      ? (Number(t.strokeWidth ?? Gt[`stroke-width`]) * Number(e.size ?? e.width ?? Gt.width)) /
        Number(t.size ?? t.width ?? Gt.width)
      : (t.strokeWidth ?? Gt[`stroke-width`]);
  return [
    `svg`,
    {
      ...Object.entries(Gt).reduce((e, [t, n]) => ((e[r(t)] = n), e), {}),
      ...(`color` in t && t.color && { [r(`stroke`)]: t.color }),
      ...(`size` in t && Kt(t.size) && { [r(`width`)]: t.size, [r(`height`)]: t.size }),
      ...(`width` in t && Kt(t.width) && { [r(`width`)]: t.width }),
      ...(`height` in t && Kt(t.height) && { [r(`height`)]: t.height }),
      [r(`stroke-width`)]: u,
      ...(l && { [r(`class`)]: l }),
      [r(`viewBox`)]: `0 0 ${i} ${a}`,
      ...(t.hasA11yProp === !1 ? { [r(`aria-hidden`)]: `true` } : {}),
      ...(`attributes` in t && t.attributes),
    },
    e.node.map((e) => {
      let [n, i, a] = e,
        o = t.nonScalingStroke ? { [r(`vector-effect`)]: `non-scaling-stroke`, ...i } : i;
      return a ? [n, o, a] : [n, o];
    }),
  ];
}
function Jt(e, t = {}) {
  return qt(e, {
    ...t,
    attributeNames: {
      ...t.attributeNames,
      class: `className`,
      "stroke-width": `strokeWidth`,
      "stroke-linecap": `strokeLinecap`,
      "stroke-linejoin": `strokeLinejoin`,
      "vector-effect": `vectorEffect`,
    },
  });
}
var Yt = (e) => {
    for (let t in e) if (t.startsWith(`aria-`) || t === `role` || t === `title`) return !0;
    return !1;
  },
  Xt = (0, _.createContext)({}),
  Zt = () => (0, _.useContext)(Xt),
  Qt = (0, _.forwardRef)(
    (
      {
        color: e,
        size: t,
        width: n,
        height: r,
        strokeWidth: i,
        absoluteStrokeWidth: a,
        nonScalingStroke: o,
        className: s = ``,
        children: c,
        iconNode: l = [],
        icon: u = { node: l, aliases: [], size: 24 },
        ...d
      },
      f,
    ) => {
      let {
          size: p = 24,
          strokeWidth: m = 2,
          absoluteStrokeWidth: h = !1,
          nonScalingStroke: g = !1,
          color: v = `currentColor`,
          className: y = ``,
        } = Zt() ?? {},
        b = !!c || Yt(d),
        [x, ee, te = []] = Jt(u, {
          color: e ?? v,
          width: n ?? t ?? p,
          height: r ?? t ?? p,
          strokeWidth: i ?? m,
          absoluteStrokeWidth: a ?? h,
          nonScalingStroke: o ?? g,
          className: A(y, s),
          hasA11yProp: b,
          attributes: d,
        });
      return (0, _.createElement)(x, { ref: f, ...ee }, [
        ...te.map(([e, t]) => (0, _.createElement)(e, t)),
        ...(Array.isArray(c) ? c : [c]),
      ]);
    },
  );
function $t(e, t = [], n = []) {
  let r = typeof e == `string` ? Ht(e, t, n) : e,
    i = (0, _.forwardRef)(({ className: e, ...t }, n) =>
      (0, _.createElement)(Qt, { ref: n, icon: r, className: e, ...t }),
    );
  return (r.name && (i.displayName = Wt(r.name)), i);
}
var j = {
  name: `type`,
  size: 24,
  node: [
    [`path`, { d: `M12 4v16`, key: `1654pz` }],
    [`path`, { d: `M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2`, key: `e0r10z` }],
    [`path`, { d: `M9 20h6`, key: `s66wpe` }],
  ],
};
j.node;
var en = $t(j);
export {
  ge as A,
  te as B,
  pt as C,
  kt as D,
  et as E,
  me as F,
  u as G,
  S as H,
  he as I,
  o as K,
  fe as L,
  xe as M,
  ve as N,
  Ce as O,
  ye as P,
  T as R,
  ct as S,
  xt as T,
  g as U,
  C as V,
  m as W,
  Ct as _,
  It as a,
  lt as b,
  Pt as c,
  Ye as d,
  it as f,
  rt as g,
  Tt as h,
  Rt as i,
  be as j,
  we as k,
  Ne as l,
  We as m,
  $t as n,
  Ft as o,
  Dt as p,
  c as q,
  Bt as r,
  k as s,
  en as t,
  Pe as u,
  _t as v,
  wt as w,
  bt as x,
  gt as y,
  ae as z,
};
