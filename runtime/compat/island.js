import { calculateIslandGeometry, agentQuestionHeight as dj } from '../island/geometry';
import { LIQUID_FOLDED, updateSizeHistory, selectSizeTransition } from '../island/transitions';
import { k as subscribeEvent } from './shared.js';
import { createMediaEventController } from '../media/events';
import { createIslandInteractions, hasPersistentActivity } from '../island/interactions';
import { LazyNoteEditor as ek } from '../components/LazyNoteEditor';
import { ProgramIcon } from '../components/ProgramIcon';
// Compatibility application source; migrate components incrementally.
import { AgentQuestion } from "../components/AgentQuestion";
import {
  A as e,
  B as t,
  C as n,
  D as r,
  F as i,
  G as a,
  H as o,
  K as s,
  M as c,
  N as l,
  O as u,
  P as d,
  R as f,
  S as p,
  U as m,
  V as h,
  W as g,
  _,
  b as v,
  d as y,
  f as b,
  g as x,
  h as S,
  i as C,
  j as w,
  k as T,
  n as E,
  o as D,
  p as O,
  q as k,
  r as ee,
  t as te,
  u as ne,
  v as re,
  w as ie,
  x as ae,
  y as oe,
  z as se,
} from "./shared.js";
import { a as ce, i as le, n as ue, o as de, r as fe, s as pe, t as A } from "./window.js";
import {
  $ as me,
  $t as he,
  A as ge,
  At as _e,
  B as ve,
  Bt as ye,
  C as be,
  Ct as xe,
  D as Se,
  Dt as Ce,
  E as we,
  Et as j,
  F as Te,
  Ft as Ee,
  G as De,
  Gt as Oe,
  H as ke,
  Ht as Ae,
  I as je,
  It as Me,
  J as Ne,
  Jt as Pe,
  K as Fe,
  Kt as Ie,
  L as Le,
  Lt as Re,
  M as ze,
  Mt as Be,
  N as Ve,
  Nt as He,
  O as Ue,
  Ot as We,
  P as Ge,
  Pt as Ke,
  Q as qe,
  Qt as Je,
  R as Ye,
  Rt as Xe,
  S as Ze,
  St as Qe,
  T as $e,
  Tt as et,
  U as tt,
  Ut as nt,
  V as rt,
  Vt as it,
  W as at,
  Wt as ot,
  X as st,
  Xt as ct,
  Y as lt,
  Yt as ut,
  Z as dt,
  Zt as ft,
  _ as pt,
  _t as mt,
  a as ht,
  at as gt,
  b as _t,
  bt as vt,
  c as yt,
  ct as bt,
  d as xt,
  dt as St,
  en as Ct,
  et as wt,
  f as Tt,
  ft as Et,
  g as Dt,
  gt as Ot,
  h as kt,
  ht as At,
  i as jt,
  it as Mt,
  j as Nt,
  jt as Pt,
  k as Ft,
  kt as It,
  l as Lt,
  lt as Rt,
  m as zt,
  mt as Bt,
  nt as Vt,
  ot as Ht,
  p as Ut,
  pt as Wt,
  q as Gt,
  qt as Kt,
  r as qt,
  rt as Jt,
  s as Yt,
  st as Xt,
  t as Zt,
  tn as Qt,
  tt as $t,
  u as en,
  ut as tn,
  v as nn,
  vt as rn,
  w as an,
  wt as on,
  x as sn,
  xt as cn,
  y as ln,
  yt as un,
  z as dn,
  zt as fn,
} from "./home.js";
import {
  $ as pn,
  B as mn,
  C as hn,
  D as gn,
  E as _n,
  F as vn,
  G as yn,
  H as bn,
  I as xn,
  K as Sn,
  L as Cn,
  O as wn,
  Q as Tn,
  R as En,
  S as Dn,
  T as M,
  U as On,
  V as kn,
  W as An,
  X as jn,
  Y as Mn,
  Z as Nn,
  _ as Pn,
  _t as Fn,
  at as In,
  b as Ln,
  c as Rn,
  ct as zn,
  d as Bn,
  dt as Vn,
  et as Hn,
  f as Un,
  ft as Wn,
  i as Gn,
  it as Kn,
  j as qn,
  k as Jn,
  l as Yn,
  mt as Xn,
  n as Zn,
  nt as Qn,
  ot as useIslandStore,
  pt as $n,
  q as er,
  r as tr,
  rt as nr,
  s as rr,
  st as ir,
  t as ar,
  tt as or,
  vt as sr,
  w as cr,
  x as lr,
  y as ur,
  yt as dr,
  z as fr,
} from "./island-store.js";
import { i as pr, n as mr, r as hr, t as gr } from "./undo.js";
import { n as _r, t as vr } from "./check.js";
import { t as yr } from "./close.js";
var ReactRuntime = k(a(), 1),
  br = m();
function xr() {
  return new wr(fe(), window.__TAURI_INTERNALS__.metadata.currentWebview.label, { skip: !0 });
}
async function Sr() {
  return f(`plugin:webview|get_all_webviews`).then((e) =>
    e.map((e) => new wr(new ue(e.windowLabel, { skip: !0 }), e.label, { skip: !0 })),
  );
}
var Cr = [`tauri://created`, `tauri://error`],
  wr = class {
    constructor(e, t, n) {
      ((this.window = e),
        (this.label = t),
        (this.listeners = Object.create(null)),
        n?.skip ||
          f(`plugin:webview|create_webview`, { windowLabel: e.label, options: { ...n, label: t } })
            .then(async () => this.emit(`tauri://created`))
            .catch(async (e) => this.emit(`tauri://error`, e)));
    }
    static async getByLabel(e) {
      return (await Sr()).find((t) => t.label === e) ?? null;
    }
    static getCurrent() {
      return xr();
    }
    static async getAll() {
      return Sr();
    }
    async listen(e, t) {
      return this._handleTauriEvent(e, t)
        ? () => {
            let n = this.listeners[e];
            n.splice(n.indexOf(t), 1);
          }
        : l(e, t, { target: { kind: `Webview`, label: this.label } });
    }
    async once(e, t) {
      return this._handleTauriEvent(e, t)
        ? () => {
            let n = this.listeners[e];
            n.splice(n.indexOf(t), 1);
          }
        : d(e, t, { target: { kind: `Webview`, label: this.label } });
    }
    async emit(e, t) {
      if (Cr.includes(e)) {
        for (let n of this.listeners[e] || []) n({ event: e, id: -1, payload: t });
        return;
      }
      return w(e, t);
    }
    async emitTo(e, t, n) {
      if (Cr.includes(t)) {
        for (let e of this.listeners[t] || []) e({ event: t, id: -1, payload: n });
        return;
      }
      return c(e, t, n);
    }
    _handleTauriEvent(e, t) {
      return Cr.includes(e)
        ? (e in this.listeners ? this.listeners[e].push(t) : (this.listeners[e] = [t]), !0)
        : !1;
    }
    async position() {
      return f(`plugin:webview|webview_position`, { label: this.label }).then((e) => new le(e));
    }
    async size() {
      return f(`plugin:webview|webview_size`, { label: this.label }).then((e) => new ce(e));
    }
    async close() {
      return f(`plugin:webview|webview_close`, { label: this.label });
    }
    async setSize(e) {
      return f(`plugin:webview|set_webview_size`, {
        label: this.label,
        value: e instanceof pe ? e : new pe(e),
      });
    }
    async setPosition(e) {
      return f(`plugin:webview|set_webview_position`, {
        label: this.label,
        value: e instanceof de ? e : new de(e),
      });
    }
    async setFocus() {
      return f(`plugin:webview|set_webview_focus`, { label: this.label });
    }
    async setAutoResize(e) {
      return f(`plugin:webview|set_webview_auto_resize`, { label: this.label, value: e });
    }
    async hide() {
      return f(`plugin:webview|webview_hide`, { label: this.label });
    }
    async show() {
      return f(`plugin:webview|webview_show`, { label: this.label });
    }
    async setZoom(e) {
      return f(`plugin:webview|set_webview_zoom`, { label: this.label, value: e });
    }
    async reparent(e) {
      return f(`plugin:webview|reparent`, { label: this.label, window: typeof e == `string` ? e : e.label });
    }
    async clearAllBrowsingData() {
      return f(`plugin:webview|clear_all_browsing_data`);
    }
    async setBackgroundColor(e) {
      return f(`plugin:webview|set_webview_background_color`, { label: this.label, value: e });
    }
    async onDragDropEvent(t) {
      let n = await this.listen(e.DRAG_ENTER, (e) => {
          t({
            ...e,
            payload: { type: `enter`, paths: e.payload.paths, position: new le(e.payload.position) },
          });
        }),
        r = await this.listen(e.DRAG_OVER, (e) => {
          t({ ...e, payload: { type: `over`, position: new le(e.payload.position) } });
        }),
        i = await this.listen(e.DRAG_DROP, (e) => {
          t({
            ...e,
            payload: { type: `drop`, paths: e.payload.paths, position: new le(e.payload.position) },
          });
        }),
        a = await this.listen(e.DRAG_LEAVE, (e) => {
          t({ ...e, payload: { type: `leave` } });
        });
      return () => {
        (n(), i(), r(), a());
      };
    }
  },
  Tr = (e, t, n) => {
    let r = t - e;
    return ((((n - e) % r) + r) % r) + e;
  };
function Er(e, t) {
  return Ie(e) ? e[Tr(0, e.length, t)] : e;
}
var Dr = class {
  constructor(e) {
    ((this.stop = () => this.runAll(`stop`)), (this.animations = e.filter(Boolean)));
  }
  get finished() {
    return Promise.all(this.animations.map((e) => e.finished));
  }
  getAll(e) {
    return this.animations[0][e];
  }
  setAll(e, t) {
    for (let n = 0; n < this.animations.length; n++) this.animations[n][e] = t;
  }
  attachTimeline(e) {
    let t = this.animations.map((t) => t.attachTimeline(e));
    return () => {
      t.forEach((e, t) => {
        (e && e(), this.animations[t].stop());
      });
    };
  }
  get time() {
    return this.getAll(`time`);
  }
  set time(e) {
    this.setAll(`time`, e);
  }
  get speed() {
    return this.getAll(`speed`);
  }
  set speed(e) {
    this.setAll(`speed`, e);
  }
  get state() {
    return this.getAll(`state`);
  }
  get startTime() {
    return this.getAll(`startTime`);
  }
  get duration() {
    return Or(this.animations, `duration`);
  }
  get iterationDuration() {
    return Or(this.animations, `iterationDuration`);
  }
  runAll(e) {
    this.animations.forEach((t) => t[e]());
  }
  play() {
    this.runAll(`play`);
  }
  pause() {
    this.runAll(`pause`);
  }
  cancel() {
    this.runAll(`cancel`);
  }
  complete() {
    this.runAll(`complete`);
  }
};
function Or(e, t) {
  let n = 0;
  for (let r = 0; r < e.length; r++) {
    let i = e[r][t];
    i !== null && i > n && (n = i);
  }
  return n;
}
var kr = class extends Dr {
    then(e, t) {
      return this.finished.finally(e).then(() => {});
    }
  },
  Ar = [];
function jr(e) {
  (ft(
    typeof e.test == `function` && typeof e.read == `function`,
    `Effects passed to animate.addEffect() need test() and read().`,
    `effect-missing-test`,
  ),
    Mr(e),
    Ar.unshift(e));
}
function Mr(e) {
  he(Ar, e);
}
function Nr(e) {
  return Ar.find((t) => t.test(e));
}
function Pr(e, t, n = {}, r) {
  let i = [],
    { velocity: a } = n,
    o = n.reduceMotion ?? r?.shouldReduceMotion;
  for (let s in t) {
    if (s === `transition` || s === `transitionEnd`) continue;
    let c = t[s];
    if (c === void 0) continue;
    let l = e(s),
      u = l.get();
    if (u !== void 0 && !l.isAnimating() && !Array.isArray(c) && c === u && !a) {
      Oe.update(() => l.set(c));
      continue;
    }
    (l.start(Ce(s, l, c, o && j.has(s) ? { type: !1 } : n, r)), l.animation && i.push(l.animation));
  }
  let { transitionEnd: s } = t;
  if (s) {
    let t = () =>
      Oe.update(() => {
        for (let t in s) e(t).set(s[t]);
      });
    i.length ? Promise.all(i).then(t) : t();
  }
  return i;
}
function Fr(e, t, n, r, i) {
  return Pr(
    (r) => {
      let a = e.get(t, r);
      if (!a) {
        let o;
        if (!i) {
          let i = n[r];
          ((o = Ir(i) ?? e.read(t, r, i)),
            ft(
              o !== void 0,
              `"${r}" can't be read from the animated subject. Provide [from, to] keyframes.`,
              `effect-unreadable-value`,
            ));
        }
        ((a = _e(o, { owner: i })), e(t, { [r]: a }));
      }
      return a;
    },
    n,
    r,
    i,
  );
}
function Ir(e) {
  let t = Array.isArray(e) ? e[0] : void 0;
  return t === null ? void 0 : t;
}
var Lr = class {
  constructor(e = Oe.render) {
    ((this.step = e),
      (this.values = new Map()),
      (this.pending = []),
      (this.numPending = 0),
      (this.flush = () => {
        let { pending: e, numPending: t } = this;
        this.numPending = 0;
        for (let n = 0; n < t; n++) e[n]();
      }));
  }
  set(e, t, n, r) {
    if ((this.values.get(e)?.onRemove(), r))
      for (let e of this.values.values()) e.value === r && (n = e.render);
    let i = () => n && this.schedule(n);
    t.get() !== void 0 && i();
    let a = t.on(`change`, i),
      o = () => {
        (a(), n && !r && this.cancel(n), this.values.delete(e));
      };
    return (this.values.set(e, { value: t, render: r ? void 0 : n, onRemove: o }), o);
  }
  get(e) {
    return this.values.get(e)?.value;
  }
  release() {
    let e = new Map();
    return (
      this.values.forEach((t, n) => {
        (e.set(n, t.value), t.onRemove());
      }),
      (this.transformKeys = this.transformValues = void 0),
      e
    );
  }
  schedule(e) {
    let { pending: t, numPending: n } = this;
    for (let r = 0; r < n; r++) if (t[r] === e) return;
    (n || this.step(this.flush), (t[this.numPending++] = e));
  }
  cancel(e) {
    let { pending: t } = this;
    for (let n = 0; n < this.numPending; n++)
      if (t[n] === e) {
        t[n] = t[--this.numPending];
        return;
      }
  }
};
function Rr(e, { step: t, ...n } = {}) {
  let r = new WeakMap();
  return Object.assign(
    (n, i) => {
      let a = r.get(n) ?? new Lr(t);
      r.set(n, a);
      let o = [];
      for (let t in i) {
        let r = i[t],
          s = e(n, a, t, r);
        o.push(s);
      }
      return () => {
        for (let e of o) e();
      };
    },
    n,
    { get: (e, t) => r.get(e)?.get(t), flush: (e) => r.get(e)?.flush(), state: (e) => r.get(e) },
  );
}
var zr = { x: `translateX`, y: `translateY`, z: `translateZ`, transformPerspective: `perspective` },
  Br = {};
function Vr(e) {
  let t = ``,
    { transformKeys: n = [], transformValues: r = {} } = e;
  for (let e = 0; e < n.length; e++) {
    let i = n[e],
      a = r[i].get();
    a !== void 0 &&
      (typeof a == `number` ? a : parseFloat(a)) !== +!!i.startsWith(`scale`) &&
      (t += (t && ` `) + (Br[i] || (Br[i] = (zr[i] || i) + `(`)) + vt(a, Re[i]) + `)`);
  }
  let i = e.get(`pathRotation`)?.get();
  return (i && (t += (t && ` `) + `rotate(` + vt(i, Re.pathRotation) + `)`), t || `none`);
}
var Hr = new Set([`originX`, `originY`, `originZ`]),
  Ur = (e, t) => vt(e.get(t)?.get(), Me[t]),
  Wr = (e, t, n, r) => {
    let i, a;
    if (Ke.has(n)) {
      if (n !== `pathRotation`) {
        let e = (t.transformKeys ??= []);
        (((t.transformValues ??= {})[n] = r),
          e.includes(n) || (e.push(n), e.sort((e, t) => He.indexOf(e) - He.indexOf(t))));
      }
      (t.get(`transform`) ||
        (!Qe(e) && !t.get(`transformBox`) && Wr(e, t, `transformBox`, new We(`fill-box`)),
        t.set(`transform`, new We(`none`), () => {
          e.style.transform = Vr(t);
        })),
        (a = t.get(`transform`)));
    } else
      Hr.has(n)
        ? (t.get(`transformOrigin`) ||
            t.set(`transformOrigin`, new We(``), () => {
              let n = Ur(t, `originX`) ?? `50%`,
                r = Ur(t, `originY`) ?? `50%`,
                i = Ur(t, `originZ`) ?? 0;
              e.style.transformOrigin = `${n} ${r} ${i}`;
            }),
          (a = t.get(`transformOrigin`)))
        : (i = Be(n)
            ? () => {
                e.style.setProperty(n, r.get());
              }
            : () => {
                e.style[n] = vt(r.get(), Me[n]);
              });
    return t.set(n, r, i, a);
  },
  Gr = (e) => Qe(e) || cn(e),
  Kr = (e, t) => {
    if (Ke.has(t)) return Ee(e, t);
    let n = getComputedStyle(e),
      r = Be(t) ? n.getPropertyValue(t) : n[t];
    return (typeof r == `string` && r.trim()) || 0;
  },
  qr = Rr(Wr, { test: Gr, read: Kr });
function Jr(e, t) {
  if (!(t in e)) return !1;
  let n =
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e), t) || Object.getOwnPropertyDescriptor(e, t);
  return n && typeof n.set == `function`;
}
var Yr = (e, t, n, r, i = n) => {
  let a = Jr(e, i);
  !a && (i.startsWith(`data`) || i.startsWith(`aria`)) && (i = on(i));
  let o = Me[n] || Me[i],
    s = a
      ? () => {
          e[i] = vt(r.get(), Me[n]);
        }
      : () => {
          let t = vt(r.get(), o);
          t == null ? e.removeAttribute(i) : e.setAttribute(i, String(t));
        };
  return t.set(n, r, s);
};
function Xr(e, t, n, r) {
  return (
    Oe.render(() => e.setAttribute(`pathLength`, `1`)),
    n === `pathOffset`
      ? t.set(n, r, () => {
          let t = r.get();
          e.setAttribute(`stroke-dashoffset`, `${-t}`);
        })
      : (t.get(`stroke-dasharray`) ||
          t.set(`stroke-dasharray`, new We(`1 1`), () => {
            let n = t.get(`pathLength`)?.get() ?? 1,
              r = t.get(`pathSpacing`)?.get();
            e.setAttribute(`stroke-dasharray`, `${n} ${r ?? 1 - Number(n)}`);
          }),
        t.set(n, r, void 0, t.get(`stroke-dasharray`)))
  );
}
var Zr = Rr(
  (e, t, n, r) =>
    n.startsWith(`path`)
      ? Xr(e, t, n, r)
      : n.startsWith(`attr`)
        ? Yr(e, t, n, r, Qr(n))
        : (Be(n) || n in e.style ? Wr : Yr)(e, t, n, r),
  {
    test: cn,
    read: (e, t) =>
      Ke.has(t)
        ? Me[t]?.default || 0
        : Be(t) || rn.includes(t)
          ? Kr(e, t)
          : ((t = Qr(t)), e.getAttribute(on(t)) ?? e.getAttribute(t) ?? void 0),
  },
);
function Qr(e) {
  return e.replace(/^attr([A-Z])/, (e, t) => t.toLowerCase());
}
var $r = {},
  ei = (e) => (cn(e) ? Zr : qr),
  ti = class {
    constructor(e, t) {
      ((this.effect = e), (this.current = t), (this.KeyframeResolver = xe));
    }
    getValue(e) {
      return this.effect.get(this.current, e);
    }
    readValue(e, t) {
      return this.effect.read(this.current, e, t);
    }
    render() {
      this.effect.flush(this.current);
    }
    measureViewportBox() {
      return mt(this.current);
    }
    getProps() {
      return $r;
    }
  };
function ni(e, t, n, r) {
  if (r) return Pr((e) => r.getValue(e, null), t, n, r);
  let i = ei(e);
  return Fr(i, e, t, n, new ti(i, e));
}
var ri = Rr(
  (e, t, n, r) =>
    t.set(n, r, () => {
      e[n] = r.get();
    }),
  {
    test: (e) => ct(e),
    read: (e, t) => {
      let n = e[t];
      return typeof n == `string` || typeof n == `number` ? n : void 0;
    },
  },
);
function ii(...e) {
  let t = !Array.isArray(e[0]),
    n = t ? 0 : -1,
    r = e[0 + n],
    i = e[1 + n],
    a = e[2 + n],
    o = e[3 + n],
    s = ye(i, a, o);
  return t ? s(r) : s;
}
function ai(e, t, n) {
  (0, ReactRuntime.useInsertionEffect)(() => e.on(t, n), [e, t, n]);
}
function oi(e) {
  let t = Qt(() => _e(e)),
    { isStatic: n } = (0, ReactRuntime.useContext)(Bt);
  if (n) {
    let [, n] = (0, ReactRuntime.useState)(e);
    (0, ReactRuntime.useEffect)(() => t.on(`change`, n), []);
  }
  return t;
}
function si(e, t) {
  let n = oi(t()),
    r = () => n.set(t());
  return (
    r(),
    Ct(() => {
      let t = () => Oe.preRender(r, !1, !0),
        n = e.map((e) => e.on(`change`, t));
      return () => {
        (n.forEach((e) => e()), ot(r));
      };
    }),
    n
  );
}
function ci(e) {
  ((It.current = []), e());
  let t = si(It.current, e);
  return ((It.current = void 0), t);
}
function li(e, t, n, r) {
  if (typeof e == `function`) return ci(e);
  if (n !== void 0 && !Array.isArray(n) && typeof t != `function`) return di(e, t, n, r);
  let i = typeof t == `function` ? t : ii(t, n, r),
    a = Array.isArray(e) ? ui(e, i) : ui([e], ([e]) => i(e)),
    o = Array.isArray(e) ? void 0 : e.accelerate;
  return (
    o &&
      !o.isTransformed &&
      typeof t != `function` &&
      Array.isArray(n) &&
      r?.clamp !== !1 &&
      (a.accelerate = {
        ...o,
        times: t,
        keyframes: n,
        isTransformed: !0,
        ...(r?.ease ? { ease: r.ease } : {}),
      }),
    a
  );
}
function ui(e, t) {
  let n = Qt(() => []);
  return si(e, () => {
    n.length = 0;
    let r = e.length;
    for (let t = 0; t < r; t++) n[t] = e[t].get();
    return t(n);
  });
}
function di(e, t, n, r) {
  let i = Qt(() => Object.keys(n)),
    a = Qt(() => ({}));
  for (let o of i) a[o] = li(e, t, n[o], r);
  return a;
}
function fi(e) {
  return typeof e == `object` && !Array.isArray(e);
}
function pi(e, t, n, r) {
  return e == null
    ? []
    : typeof e == `string` && fi(t)
      ? un(e, n, r)
      : e instanceof NodeList
        ? Array.from(e)
        : Array.isArray(e)
          ? e.filter((e) => e != null)
          : [e];
}
function mi(e, t, n) {
  return e * (t + 1) + n * t;
}
function hi(e, t, n, r) {
  return typeof t == `number`
    ? t
    : t.startsWith(`-`) || t.startsWith(`+`)
      ? Math.max(0, e + parseFloat(t))
      : t === `<`
        ? n
        : t.startsWith(`<`)
          ? Math.max(0, n + parseFloat(t.slice(1)))
          : (r.get(t) ?? e);
}
function gi(e, t, n) {
  for (let r = 0; r < e.length; r++) {
    let i = e[r];
    i.at > t && i.at < n && (he(e, i), r--);
  }
}
function _i(e, t, n, r, i, a) {
  gi(e, i, a);
  for (let o = 0; o < t.length; o++) e.push({ value: t[o], at: nt(i, a, r[o]), easing: Er(n, o) });
}
function vi(e, t, n = 0) {
  let r = t + 1 + t * n;
  for (let t = 0; t < e.length; t++) e[t] = e[t] / r;
}
function yi(e, t) {
  return e.at === t.at ? (e.value === null ? 1 : t.value === null ? -1 : 0) : e.at - t.at;
}
var bi = `easeInOut`,
  xi = 20;
function Si(e, { defaultTransition: t = {}, ...n } = {}, r, i) {
  let a = t.duration || 0.3,
    o = new Map(),
    s = new Map(),
    c = {},
    l = new Map(),
    u = 0,
    d = 0,
    f = 0;
  for (let n = 0; n < e.length; n++) {
    let o = e[n];
    if (typeof o == `string`) {
      l.set(o, d);
      continue;
    }
    if (!Array.isArray(o)) {
      l.set(o.name, hi(d, o.at, u, l));
      continue;
    }
    let [p, m, h = {}] = o;
    h.at !== void 0 && (d = hi(d, h.at, u, l));
    let g = 0,
      _ = (e, n, r, o = 0, s = 0) => {
        let c = Ti(e),
          {
            delay: l = 0,
            times: u = Xe(c),
            type: p = t.type || `keyframes`,
            repeat: m,
            repeatType: h,
            repeatDelay: _ = 0,
            ...v
          } = n,
          { ease: y = t.ease || `easeOut`, duration: b } = n,
          x = typeof l == `function` ? l(o, s) : l,
          S = c.length,
          C = Pt(p) ? p : i?.[p || `keyframes`];
        if (S <= 2 && C) {
          let e = 100;
          if (S === 2 && Oi(c)) {
            let t = c[1] - c[0];
            e = Math.abs(t);
          }
          let n = { ...t, ...v };
          b !== void 0 && (n.duration = Pe(b));
          let r = Ae(n, e, C);
          ((y = r.ease), (b = r.duration));
        }
        b ??= a;
        let w = d + x;
        u.length === 1 && u[0] === 0 && (u[1] = 1);
        let T = u.length - c.length;
        if (
          (T > 0 && fn(u, T),
          c.length === 1 && c.unshift(null),
          m &&
            Je(
              m < xi,
              `Sequence segments can't repeat ${m} times — ignoring repeat option. Use a value below ${xi} or apply repeat at the sequence level instead.`,
            ),
          m && m < xi)
        ) {
          let e = b > 0 ? _ / b : 0;
          b = mi(b, m, _);
          let t = [...c],
            n = [...u];
          y = Array.isArray(y) ? [...y] : [y];
          let r = [...y],
            i = h === `reverse` || h === `mirror`,
            a = t,
            o = r;
          i &&
            ((a = [...t].reverse()),
            h === `reverse` && (o = [...r].reverse().map((e) => (typeof e == `function` ? Kt(e) : e))));
          for (let s = 0; s < m; s++) {
            let l = i && s % 2 == 0,
              d = l ? a : t,
              f = l ? o : r,
              p = (s + 1) * (1 + e);
            (e > 0 && (c.push(c[c.length - 1]), u.push(p), y.push(`linear`)), c.push(...d));
            for (let e = 0; e < d.length; e++) (u.push(n[e] + p), y.push(e === 0 ? `linear` : Er(f, e - 1)));
          }
          vi(u, m, e);
        }
        let E = w + b;
        (_i(r, c, y, u, w, E), (g = Math.max(x + b, g)), (f = Math.max(E, f)));
      };
    if (et(p)) {
      let e = Ci(p, s);
      _(m, h, wi(`default`, e));
    } else {
      let e = pi(p, m, r, c),
        t = e.length;
      for (let n = 0; n < t; n++) {
        ((m = m), (h = h));
        let r = e[n],
          i = Ci(r, s);
        for (let e in m) _(m[e], Ei(h, e), wi(e, i), n, t);
      }
    }
    ((u = d), (d += g));
  }
  return (
    s.forEach((e, r) => {
      for (let i in e) {
        let a = e[i];
        a.sort(yi);
        let s = [],
          c = [],
          l = [];
        for (let e = 0; e < a.length; e++) {
          let { at: t, value: n, easing: r } = a[e];
          (s.push(n), c.push(ut(0, f, t)), l.push(r || `easeOut`));
        }
        (c[0] !== 0 && (c.unshift(0), s.unshift(s[0]), l.unshift(bi)),
          c[c.length - 1] !== 1 && (c.push(1), s.push(null)),
          o.has(r) || o.set(r, { keyframes: {}, transition: {} }));
        let u = o.get(r);
        u.keyframes[i] = s;
        let { type: d, ...p } = t;
        u.transition[i] = { ...p, duration: f, ease: l, times: c, ...n };
      }
    }),
    o
  );
}
function Ci(e, t) {
  return (!t.has(e) && t.set(e, {}), t.get(e));
}
function wi(e, t) {
  return (t[e] || (t[e] = []), t[e]);
}
function Ti(e) {
  return Array.isArray(e) ? e : [e];
}
function Ei(e, t) {
  return e && e[t] ? { ...e, ...e[t] } : { ...e };
}
var Di = (e) => typeof e == `number`,
  Oi = (e) => e.every(Di);
function ki(e, t) {
  return et(e) || typeof e == `number` || (typeof e == `string` && !fi(t));
}
function Ai(e, t, n, r) {
  let i = [];
  if (ki(e, t)) i.push(At(e, (fi(t) && t.default) || t, n && (n.default || n)));
  else {
    if (e == null) return i;
    let a = pi(e, t, r),
      o = a.length;
    ft(!!o, `No valid elements provided.`, `no-valid-elements`);
    for (let e = 0; e < o; e++) {
      let r = a[e],
        s = { ...n };
      (`delay` in s && typeof s.delay == `function` && (s.delay = s.delay(e, o)),
        r instanceof Element ? i.push(...ni(r, t, s, Ot.get(r))) : i.push(...Fr(Nr(r) ?? ri, r, t, s)));
    }
  }
  return i;
}
function ji(e, t, n) {
  let r = [];
  return (
    Si(
      e.map((e) => {
        if (Array.isArray(e) && typeof e[0] == `function`) {
          let t = e[0],
            n = _e(0);
          return (
            n.on(`change`, t),
            e.length === 1 ? [n, [0, 1]] : e.length === 2 ? [n, [0, 1], e[1]] : [n, e[1], e[2]]
          );
        }
        return e;
      }),
      t,
      n,
      { spring: it },
    ).forEach(({ keyframes: e, transition: t }, n) => {
      r.push(...Ai(n, e, t));
    }),
    r
  );
}
function Mi(e) {
  return Array.isArray(e) && e.some(Array.isArray);
}
function Ni(e = {}) {
  let { scope: t, reduceMotion: n, skipAnimations: r } = e;
  function i(e, i, a) {
    let o = [],
      s,
      c = {};
    if ((n !== void 0 && (c.reduceMotion = n), r !== void 0 && (c.skipAnimations = r), Mi(e))) {
      let { onComplete: n, ...r } = i || {};
      (typeof n == `function` && (s = n), (o = ji(e, { ...c, ...r }, t)));
    } else {
      let { onComplete: n, ...r } = a || {};
      (typeof n == `function` && (s = n), (o = Ai(e, i, { ...c, ...r }, t)));
    }
    let l = new kr(o);
    return (
      s && l.finished.then(s),
      t &&
        (t.animations.push(l),
        l.finished.then(() => {
          he(t.animations, l);
        })),
      l
    );
  }
  return i;
}
var Pi = Object.assign(Ni(), { addEffect: jr, removeEffect: Mr });
function Fi(e) {
  if (e.onChat && e.chat) return [`chat`];
  let t = [`shelf`];
  return (e.launcher && t.push(`launcher`), e.chat && t.push(`chat`), t);
}

var Ri = 6e4,
  zi = 60 * Ri,
  Bi = 24 * zi,
  Vi = 9,
  Hi = [
    [/^(с|сек|секунд[аыу]?|s|sec|secs|seconds?)$/, 1e3],
    [/^(м|мин|минут[аыу]?|m|min|mins|minutes?)$/, Ri],
    [/^(ч|час|часа|часов|h|hr|hrs|hours?)$/, zi],
    [/^(д|дн|день|дня|дней|сут|сутки|суток|d|days?)$/, Bi],
    [/^(нед|недел[яюиь]|w|weeks?)$/, 7 * Bi],
  ],
  Ui = [
    [/^(сегодня|today)$/, 0],
    [/^(завтра|tomorrow)$/, 1],
    [/^(послезавтра)$/, 2],
  ];
function Wi(e) {
  let t = (e, t, n) => {
    let r = Number(e);
    if (r < 1 || r > 12) return null;
    let i = n.replace(/\./g, ``);
    return (
      (r =
        i === `am` || i === `утра`
          ? r === 12
            ? 0
            : r
          : i === `pm` || i === `вечера` || i === `дня`
            ? r === 12
              ? 12
              : r + 12
            : r === 12
              ? 0
              : r >= 9
                ? r + 12
                : r),
      `${r}:${t ?? `00`}`
    );
  };
  return e
    .replace(
      /(^|\s)(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?|утра|вечера|ночи)(?=\s|$)/g,
      (e, n, r, i, a) => {
        let o = t(r, i, a);
        return o ? n + o : e;
      },
    )
    .replace(/(^|\s)(в\s+)(\d{1,2})(?:[:.](\d{2}))?\s*дня(?=\s|$)/g, (e, n, r, i, a) => {
      let o = t(i, a, `дня`);
      return o ? n + r + o : e;
    });
}
function Gi(e, t, n, r) {
  return new Date(e.getFullYear(), e.getMonth(), e.getDate() + t, n, r, 0, 0);
}
function Ki(e, t = new Date()) {
  let n = Wi(e.toLowerCase().replace(/ё/g, `е`).replace(/\s+/g, ` `).trim());
  if (!n) return null;
  let r = /^(через|in)\s+/.test(n);
  if (((n = n.replace(/^(через|in)\s+/, ``)), /^(полчаса|half an hour)$/.test(n)))
    return new Date(t.getTime() + 30 * Ri);
  if (/^(час|an hour|hour)$/.test(n)) return new Date(t.getTime() + zi);
  if (/^(минуту|a minute)$/.test(n)) return new Date(t.getTime() + Ri);
  let i = /^(\d+(?:[.,]\d+)?)\s*([a-zа-я]+)?$/.exec(n);
  if (i && (i[2] || /^\d+$/.test(i[1]))) {
    let e = parseFloat(i[1].replace(`,`, `.`)),
      n = i[2] ? Hi.find(([e]) => e.test(i[2]))?.[1] : Ri;
    if (n && e > 0) return new Date(t.getTime() + Math.round(e * n));
    if (i[2]) return null;
  }
  if (r) return null;
  let a = n.split(` `).filter((e) => e !== `в` && e !== `во` && e !== `at` && e !== `на` && e !== `on`),
    o = null;
  a.length && Ui.some(([e]) => e.test(a[0])) && ((o = Ui.find(([e]) => e.test(a[0]))[1]), a.shift());
  let s = null;
  if (o === null && a.length) {
    let e = qi.find(([e]) => e.test(a[0]));
    e && ((s = e[1]), a.shift());
  }
  let c = null,
    l = a.length ? /^(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?$/.exec(a[0]) : null;
  if (
    l &&
    o === null &&
    s === null &&
    Number(l[2]) >= 1 &&
    Number(l[2]) <= 12 &&
    Number(l[1]) >= 1 &&
    Number(l[1]) <= 31 &&
    (a.length > 1 || l[3])
  ) {
    let e = l[3] ? (l[3].length === 2 ? 2e3 + Number(l[3]) : Number(l[3])) : t.getFullYear();
    ((c = new Date(e, Number(l[2]) - 1, Number(l[1]))), a.shift());
  }
  let u = Vi,
    d = 0,
    f = !1;
  if (a.length === 1) {
    let e = /^(\d{1,2})(?:[:.](\d{2}))?$/.exec(a[0]);
    if (!e || ((u = Number(e[1])), (d = e[2] ? Number(e[2]) : 0), u > 23 || d > 59)) return null;
    f = !0;
  } else if (a.length > 1) return null;
  if (c) {
    let e = Gi(c, 0, u, d);
    return (!l[3] && e.getTime() <= t.getTime() && e.setFullYear(e.getFullYear() + 1), e);
  }
  if (o !== null) {
    let e = Gi(t, o, u, d);
    return e.getTime() > t.getTime() ? e : null;
  }
  if (s !== null) {
    let e = (s - t.getDay() + 7) % 7,
      n = Gi(t, e, u, d);
    return n.getTime() > t.getTime() ? n : Gi(t, e + 7, u, d);
  }
  if (f) {
    let e = Gi(t, 0, u, d);
    return e.getTime() > t.getTime() ? e : Gi(t, 1, u, d);
  }
  return null;
}
var qi = [
    [/^(вс|воскресенье|воскресеньям|sun|sunday|sundays)$/, 0],
    [/^(пн|понедельник|понедельникам|mon|monday|mondays)$/, 1],
    [/^(вт|вторник|вторникам|tue|tues|tuesday|tuesdays)$/, 2],
    [/^(ср|среда|среду|средам|wed|wednesday|wednesdays)$/, 3],
    [/^(чт|четверг|четвергам|thu|thur|thurs|thursday|thursdays)$/, 4],
    [/^(пт|пятница|пятницу|пятницам|fri|friday|fridays)$/, 5],
    [/^(сб|суббота|субботу|субботам|sat|saturday|saturdays)$/, 6],
  ],
  Ji = [
    [/^(каждый день|ежедневно|every day|everyday|daily)(?=\s|$)/, [0, 1, 2, 3, 4, 5, 6]],
    [/^(по будням|в будни|каждый будний день|on weekdays|weekdays|every weekday)(?=\s|$)/, [1, 2, 3, 4, 5]],
    [/^(по выходным|в выходные|каждые выходные|on weekends|weekends|every weekend)(?=\s|$)/, [0, 6]],
  ];
function Yi(e) {
  for (let [t, n] of Ji) if (t.test(e)) return [n, e.replace(t, ``).trim()];
  let t = /^(каждый|каждую|каждое|каждые|по|every|on)\s+/.exec(e);
  if (!t) return null;
  let n = e
      .slice(t[0].length)
      .split(/[\s,]+/)
      .filter(Boolean),
    r = t[1] === `on`,
    i = [],
    a = 0;
  for (let e of n) {
    let t = r && !e.endsWith(`s`) ? void 0 : qi.find(([t]) => t.test(e));
    if (t) i.push(t[1]);
    else if (e !== `и` && e !== `and`) break;
    a++;
  }
  return i.length ? [[...new Set(i)].sort(), n.slice(a).join(` `)] : null;
}
function Xi(e, t) {
  for (let n = 0; n < 8; n++) {
    let r = Gi(t, n, e.h, e.m);
    if (r.getTime() > t.getTime() && e.days.includes(r.getDay())) return r;
  }
  return new Date(t.getTime() + Bi);
}
function Zi(e, t = new Date()) {
  let n = Yi(Wi(e.toLowerCase().replace(/ё/g, `е`).replace(/\s+/g, ` `).trim()));
  if (!n) return null;
  let [r, i] = n,
    a = i.replace(/^(в|at|на)\s+/, ``),
    o = Vi,
    s = 0;
  if (a) {
    let e = /^(\d{1,2})(?:[:.](\d{2}))?$/.exec(a);
    if (!e || ((o = Number(e[1])), (s = e[2] ? Number(e[2]) : 0), o > 23 || s > 59)) return null;
  }
  let c = { days: r, h: o, m: s };
  return { at: Xi(c, t), repeat: c };
}
function Qi(e) {
  let n = [...e.days].sort().join(``);
  if (n === `0123456`) return o(`каждый день`, `every day`);
  if (n === `12345`) return o(`по будням`, `on weekdays`);
  if (n === `06`) return o(`по выходным`, `on weekends`);
  let r =
    t() === `ru`
      ? [`вс`, `пн`, `вт`, `ср`, `чт`, `пт`, `сб`]
      : [`Sun`, `Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Sat`];
  return [...e.days]
    .sort((e, t) => ((e + 6) % 7) - ((t + 6) % 7))
    .map((e) => r[e])
    .join(`, `);
}
function $i(e, t = new Date()) {
  let n = e.trim().split(/\s+/).filter(Boolean),
    r = (e) => {
      let n = Zi(e, t);
      if (n) return n;
      if (/^\d+$/.test(e)) return null;
      let r = Ki(e, t);
      return r ? { at: r } : null;
    };
  for (let e = n.length; e >= 1; e--) {
    let t = r(n.slice(n.length - e).join(` `));
    if (t) return { text: n.slice(0, n.length - e).join(` `), ...t };
    let i = r(n.slice(0, e).join(` `));
    if (i) return { text: n.slice(e).join(` `), ...i };
  }
  return null;
}
function ea(e, t = new Date()) {
  let n = /^(?:напомни(?:ть)?|remind)(?:\s+(?:мне|me))?\s+(?:(?:о том,? что|что|to|that)\s+)?(.+)$/i.exec(
    e.trim(),
  );
  return n ? $i(n[1], t) : null;
}
function ta(e, n, r, i = new Date()) {
  let a = new Date(n),
    o = `${a.getHours()}:${String(a.getMinutes()).padStart(2, `0`)}`,
    s = t() === `ru`,
    c = ``;
  if (r) {
    let e = `${r.h}:${String(r.m).padStart(2, `0`)}`,
      t = [...r.days].sort().join(``),
      n = s ? [`вс`, `пн`, `вт`, `ср`, `чт`, `пт`, `сб`] : [`sun`, `mon`, `tue`, `wed`, `thu`, `fri`, `sat`],
      i = [...r.days].sort((e, t) => ((e + 6) % 7) - ((t + 6) % 7)).map((e) => n[e]),
      a = i.length > 1 ? `${i.slice(0, -1).join(`, `)} ${s ? `и` : `and`} ${i[i.length - 1]}` : i[0];
    c = `${t === `0123456` ? (s ? `каждый день` : `every day`) : t === `12345` ? (s ? `по будням` : `on weekdays`) : t === `06` ? (s ? `по выходным` : `on weekends`) : `${s ? `по` : `every`} ${a}`} ${s ? `в` : `at`} ${e}`;
  } else if (n > i.getTime()) {
    let e = (e) => new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime(),
      t = Math.round((e(a) - e(i)) / Bi);
    c =
      t === 0
        ? `${s ? `сегодня` : `today`} ${o}`
        : t === 1
          ? `${s ? `завтра` : `tomorrow`} ${o}`
          : `${a.getDate()}.${a.getMonth() + 1}.${a.getFullYear()} ${o}`;
  }
  return [e.trim(), c].filter(Boolean).join(` `);
}
function na(e) {
  return D(e.getHours(), e.getMinutes());
}
function ra(e, t = Date.now()) {
  let n = new Date(e),
    r = e - t;
  if (r <= 0) {
    let e = Math.round(-r / Ri);
    return e < 1
      ? o(`сейчас`, `now`)
      : e < 60
        ? o(`${e} мин назад`, `${e} min ago`)
        : e < 1440
          ? o(`${Math.round(e / 60)} ч назад`, `${Math.round(e / 60)} h ago`)
          : n.toLocaleDateString(h(), { day: `numeric`, month: `short` });
  }
  if (r < zi)
    return o(`через ${Math.max(1, Math.round(r / Ri))} мин`, `in ${Math.max(1, Math.round(r / Ri))} min`);
  let i = new Date(t),
    a = (e) => new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime(),
    s = Math.round((a(n) - a(i)) / Bi);
  return s === 0
    ? o(`сегодня ${na(n)}`, `today ${na(n)}`)
    : s === 1
      ? o(`завтра ${na(n)}`, `tomorrow ${na(n)}`)
      : `${n.toLocaleDateString(h(), { day: `numeric`, month: `short` })} ${na(n)}`;
}
var ia = Date.now(),
  aa = new Set();
function oa(e) {
  let t = e.repeat;
  if (
    (t &&
      Array.isArray(t.days) &&
      t.days.length > 0 &&
      t.days.every((e) => Number.isInteger(e) && e >= 0 && e <= 6) &&
      Number.isInteger(t.h) &&
      Number.isInteger(t.m)) ||
    !t
  )
    return e;
  let { repeat: n, ...r } = e;
  return r;
}
function sa(e) {
  u.remindersSet(JSON.stringify(e)).catch(() => {});
}
var ca = ir((e, t) => ({
  loaded: !1,
  list: [],
  load: async () => {
    if (t().loaded) return;
    let n = [];
    try {
      let e = await u.remindersGet();
      e &&
        (n = JSON.parse(e)
          .filter((e) => e && typeof e.text == `string` && Number.isFinite(e.at))
          .map(oa));
    } catch {}
    (e({ loaded: !0, list: n }), la());
  },
  add: (n, r, i) => {
    let a = [...t().list, { id: ++ia, text: n.trim(), at: r, ...(i ? { repeat: i } : {}) }].sort(
      (e, t) => e.at - t.at,
    );
    (e({ list: a }), sa(a));
  },
  remove: (n) => {
    let r = t().list.filter((e) => e.id !== n);
    (aa.delete(n), e({ list: r }), sa(r));
    let i = useIslandStore.getState();
    (i.peek?.kind === `reminder` && i.peek.reminder === n && i.nextPeek(), la());
  },
  change: (n, r, i, a) => {
    let o = t()
      .list.map((e) => (e.id === n ? { id: n, text: r.trim(), at: i, ...(a ? { repeat: a } : {}) } : e))
      .sort((e, t) => e.at - t.at);
    (aa.delete(n), e({ list: o }), sa(o));
    let s = useIslandStore.getState();
    (s.peek?.kind === `reminder` && s.peek.reminder === n && s.nextPeek(), la());
  },
  done: (n) => {
    let r = t().list.find((e) => e.id === n)?.repeat;
    if (!r) return t().remove(n);
    let i = Xi(r, new Date()).getTime(),
      a = t()
        .list.map((e) => (e.id === n ? { ...e, at: i } : e))
        .sort((e, t) => e.at - t.at);
    (aa.delete(n), e({ list: a }), sa(a));
    let o = useIslandStore.getState();
    (o.peek?.kind === `reminder` && o.peek.reminder === n && o.nextPeek(), la());
  },
  snooze: (n, r) => {
    let i = t()
      .list.map((e) => (e.id === n ? { ...e, at: Date.now() + r } : e))
      .sort((e, t) => e.at - t.at);
    (aa.delete(n), e({ list: i }), sa(i));
    let a = useIslandStore.getState();
    (a.peek?.kind === `reminder` && a.peek.reminder === n && a.nextPeek(), la());
  },
}));
function la() {
  let { loaded: e, list: t } = ca.getState();
  if (!e) return;
  let n = t.find((e) => e.at <= Date.now());
  if (!n) return;
  aa.has(n.id) || (aa.add(n.id), u.chime());
  let r = useIslandStore.getState();
  r.expanded ||
    r.palette ||
    r.peek?.kind === `reminder` ||
    r.pushPeek({ kind: `reminder`, reminder: n.id, text: n.text, at: n.at });
}
function ua() {
  ca.getState().load();
  let e = setInterval(la, 5e3);
  return () => clearInterval(e);
}
function da(e) {
  useIslandStore.setState({ chatService: e });
  try {
    localStorage.setItem(`island-chat-service`, e);
  } catch {}
}
function fa(e) {
  let t = useIslandStore.getState();
  if (!t.license.pro) return t.pushPeek({ kind: `pro`, feature: `ai` });
  let n = e ?? (t.chatService === `island` ? `gemini` : t.chatService);
  if (t.webAiPopped === n) {
    u.webAiWindowShow();
    return;
  }
  (da(n),
    useIslandStore.setState({ webAiWantsKeys: !0 }),
    t.expanded ? t.setTab(`chat`) : t.open(`hotkey`, `chat`));
}
var pa = {
  name: `app-window`,
  size: 24,
  node: [
    [`rect`, { x: `2`, y: `4`, width: `20`, height: `16`, rx: `2`, key: `izxlao` }],
    [`path`, { d: `M10 4v4`, key: `pp8u80` }],
    [`path`, { d: `M2 8h20`, key: `d11cs7` }],
    [`path`, { d: `M6 4v4`, key: `1svtjw` }],
  ],
};
pa.node;
var ma = E(pa),
  ha = {
    name: `arrow-right-left`,
    size: 24,
    node: [
      [`path`, { d: `m16 3 4 4-4 4`, key: `1x1c3m` }],
      [`path`, { d: `M20 7H4`, key: `zbl0bi` }],
      [`path`, { d: `m8 21-4-4 4-4`, key: `h9nckh` }],
      [`path`, { d: `M4 17h16`, key: `g4d7ey` }],
    ],
  };
ha.node;
var ga = E(ha),
  _a = {
    name: `arrow-up`,
    size: 24,
    node: [
      [`path`, { d: `m5 12 7-7 7 7`, key: `hav0vg` }],
      [`path`, { d: `M12 19V5`, key: `x0mq9r` }],
    ],
  };
_a.node;
var va = E(_a),
  ya = {
    name: `audio-lines`,
    size: 24,
    node: [
      [`path`, { d: `M2 10v3`, key: `1fnikh` }],
      [`path`, { d: `M6 6v11`, key: `11sgs0` }],
      [`path`, { d: `M10 3v18`, key: `yhl04a` }],
      [`path`, { d: `M14 8v7`, key: `3a1oy3` }],
      [`path`, { d: `M18 5v13`, key: `123xd1` }],
      [`path`, { d: `M22 10v3`, key: `154ddg` }],
    ],
  };
ya.node;
var ba = E(ya),
  xa = {
    name: `bell-plus`,
    size: 24,
    node: [
      [`path`, { d: `M10.268 21a2 2 0 0 0 3.464 0`, key: `vwvbt9` }],
      [`path`, { d: `M15 8h6`, key: `8ybuxh` }],
      [`path`, { d: `M18 5v6`, key: `g5ayrv` }],
      [
        `path`,
        {
          d: `M20.002 14.464a9 9 0 0 0 .738.863A1 1 0 0 1 20 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 8.75-5.332`,
          key: `1abcvy`,
        },
      ],
    ],
  };
xa.node;
var Sa = E(xa),
  Ca = {
    name: `bell`,
    size: 24,
    node: [
      [`path`, { d: `M10.268 21a2 2 0 0 0 3.464 0`, key: `vwvbt9` }],
      [
        `path`,
        {
          d: `M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326`,
          key: `11g9vi`,
        },
      ],
    ],
  };
Ca.node;
var wa = E(Ca),
  Ta = {
    name: `bell-ring`,
    size: 24,
    node: [
      [`path`, { d: `M10.268 21a2 2 0 0 0 3.464 0`, key: `vwvbt9` }],
      [`path`, { d: `M22 8c0-2.3-.8-4.3-2-6`, key: `5bb3ad` }],
      [
        `path`,
        {
          d: `M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326`,
          key: `11g9vi`,
        },
      ],
      [`path`, { d: `M4 2C2.8 3.7 2 5.7 2 8`, key: `tap9e0` }],
    ],
  };
Ta.node;
var Ea = E(Ta),
  Da = {
    name: `bluetooth-off`,
    size: 24,
    node: [
      [`path`, { d: `m17 17-5 5V12l-5 5`, key: `v5aci6` }],
      [`path`, { d: `m2 2 20 20`, key: `1ooewy` }],
      [`path`, { d: `M14.5 9.5 17 7l-5-5v4.5`, key: `1kddfz` }],
    ],
  };
Da.node;
var Oa = E(Da),
  ka = { name: `bluetooth`, size: 24, node: [[`path`, { d: `m7 7 10 10-5 5V2l5 5L7 17`, key: `1q5490` }]] };
ka.node;
var Aa = E(ka),
  ja = {
    name: `bold`,
    size: 24,
    node: [
      [`path`, { d: `M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8`, key: `mg9rjx` }],
    ],
  };
ja.node;
var Ma = E(ja),
  Na = {
    name: `calculator`,
    size: 24,
    node: [
      [`rect`, { width: `16`, height: `20`, x: `4`, y: `2`, rx: `2`, key: `1nb95v` }],
      [`line`, { x1: `8`, x2: `16`, y1: `6`, y2: `6`, key: `x4nwl0` }],
      [`line`, { x1: `16`, x2: `16`, y1: `14`, y2: `18`, key: `wjye3r` }],
      [`path`, { d: `M16 10h.01`, key: `1m94wz` }],
      [`path`, { d: `M12 10h.01`, key: `1nrarc` }],
      [`path`, { d: `M8 10h.01`, key: `19clt8` }],
      [`path`, { d: `M12 14h.01`, key: `1etili` }],
      [`path`, { d: `M8 14h.01`, key: `6423bh` }],
      [`path`, { d: `M12 18h.01`, key: `mhygvu` }],
      [`path`, { d: `M8 18h.01`, key: `lrp35t` }],
    ],
  };
Na.node;
var Pa = E(Na),
  Fa = {
    name: `circle-alert`,
    size: 24,
    node: [
      [`circle`, { cx: `12`, cy: `12`, r: `10`, key: `1mglay` }],
      [`line`, { x1: `12`, x2: `12`, y1: `8`, y2: `12`, key: `1pkeuh` }],
      [`line`, { x1: `12`, x2: `12.01`, y1: `16`, y2: `16`, key: `4dfq90` }],
    ],
    aliases: [`alert-circle`],
  };
Fa.node;
var Ia = E(Fa),
  La = {
    name: `clipboard-check`,
    size: 24,
    node: [
      [`rect`, { width: `8`, height: `4`, x: `8`, y: `2`, rx: `1`, ry: `1`, key: `tgr4d6` }],
      [
        `path`,
        { d: `M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2`, key: `116196` },
      ],
      [`path`, { d: `m9 14 2 2 4-4`, key: `df797q` }],
    ],
  };
La.node;
var Ra = E(La),
  za = {
    name: `clipboard-paste`,
    size: 24,
    node: [
      [`path`, { d: `M11 14h10`, key: `1w8e9d` }],
      [`path`, { d: `M16 4h2a2 2 0 0 1 2 2v1.344`, key: `1e62lh` }],
      [`path`, { d: `m17 18 4-4-4-4`, key: `z2g111` }],
      [`path`, { d: `M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 1.793-1.113`, key: `bjbb7m` }],
      [`rect`, { x: `8`, y: `2`, width: `8`, height: `4`, rx: `1`, key: `ublpy` }],
    ],
  };
za.node;
var Ba = E(za),
  Va = {
    name: `clock-3`,
    size: 24,
    node: [
      [`circle`, { cx: `12`, cy: `12`, r: `10`, key: `1mglay` }],
      [`path`, { d: `M12 6v6h4`, key: `135r8i` }],
    ],
  };
Va.node;
var Ha = E(Va),
  Ua = {
    name: `cloud-off`,
    size: 24,
    node: [
      [`path`, { d: `M10.94 5.274A7 7 0 0 1 15.71 10h1.79a4.5 4.5 0 0 1 4.222 6.057`, key: `1uxyv8` }],
      [`path`, { d: `M18.796 18.81A4.5 4.5 0 0 1 17.5 19H9A7 7 0 0 1 5.79 5.78`, key: `99tcn7` }],
      [`path`, { d: `m2 2 20 20`, key: `1ooewy` }],
    ],
  };
Ua.node;
var Wa = E(Ua),
  Ga = {
    name: `coins`,
    size: 24,
    node: [
      [`path`, { d: `M13.744 17.736a6 6 0 1 1-7.48-7.48`, key: `bq4yh3` }],
      [`path`, { d: `M15 6h1v4`, key: `11y1tn` }],
      [`path`, { d: `m6.134 14.768.866-.5 2 3.464`, key: `17snzx` }],
      [`circle`, { cx: `16`, cy: `8`, r: `6`, key: `14bfc9` }],
    ],
  };
Ga.node;
var Ka = E(Ga),
  qa = {
    name: `contrast`,
    size: 24,
    node: [
      [`circle`, { cx: `12`, cy: `12`, r: `10`, key: `1mglay` }],
      [`path`, { d: `M12 18a6 6 0 0 0 0-12v12z`, key: `j4l70d` }],
    ],
  };
qa.node;
var Ja = E(qa),
  Ya = {
    name: `corner-down-left`,
    size: 24,
    node: [
      [`path`, { d: `M20 4v7a4 4 0 0 1-4 4H4`, key: `6o5b7l` }],
      [`path`, { d: `m9 10-5 5 5 5`, key: `1kshq7` }],
    ],
  };
Ya.node;
var Xa = E(Ya),
  Za = {
    name: `ethernet-port`,
    size: 24,
    node: [
      [`path`, { d: `M10 8v1`, key: `1talb4` }],
      [`path`, { d: `M14 8v1`, key: `1rsfgr` }],
      [`path`, { d: `M18 8v1`, key: `gnkwox` }],
      [
        `path`,
        {
          d: `M19 17a2 2 0 00-1.765 1.059l-.47.882A2 2 0 0115 20H9a2 2 0 01-1.765-1.059l-.47-.882A2 2 0 005 17H4a2 2 0 01-2-2V6a2 2 0 012-2h16a2 2 0 012 2v9a2 2 0 01-2 2z`,
          key: `v5qa57`,
        },
      ],
      [`path`, { d: `M6 8v1`, key: `1636ez` }],
    ],
  };
Za.node;
var Qa = E(Za),
  $a = {
    name: `external-link`,
    size: 24,
    node: [
      [`path`, { d: `M15 3h6v6`, key: `1q9fwt` }],
      [`path`, { d: `M10 14 21 3`, key: `gplh6r` }],
      [`path`, { d: `M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6`, key: `a6xqqp` }],
    ],
  };
$a.node;
var eo = E($a),
  to = {
    name: `file-text`,
    size: 24,
    node: [
      [
        `path`,
        {
          d: `M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z`,
          key: `1oefj6`,
        },
      ],
      [`path`, { d: `M14 2v5a1 1 0 0 0 1 1h5`, key: `wfsgrz` }],
      [`path`, { d: `M10 9H8`, key: `b1mrlr` }],
      [`path`, { d: `M16 13H8`, key: `t4e002` }],
      [`path`, { d: `M16 17H8`, key: `z1uh3a` }],
    ],
  };
to.node;
var no = E(to),
  ro = {
    name: `file`,
    size: 24,
    node: [
      [
        `path`,
        {
          d: `M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z`,
          key: `1oefj6`,
        },
      ],
      [`path`, { d: `M14 2v5a1 1 0 0 0 1 1h5`, key: `wfsgrz` }],
    ],
  };
ro.node;
var io = E(ro),
  ao = {
    name: `gamepad-2`,
    size: 24,
    node: [
      [`line`, { x1: `6`, x2: `10`, y1: `11`, y2: `11`, key: `1gktln` }],
      [`line`, { x1: `8`, x2: `8`, y1: `9`, y2: `13`, key: `qnk9ow` }],
      [`line`, { x1: `15`, x2: `15.01`, y1: `12`, y2: `12`, key: `krot7o` }],
      [`line`, { x1: `18`, x2: `18.01`, y1: `10`, y2: `10`, key: `1lcuu1` }],
      [
        `path`,
        {
          d: `M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z`,
          key: `mfqc10`,
        },
      ],
    ],
  };
ao.node;
var oo = E(ao),
  so = {
    name: `globe`,
    size: 24,
    node: [
      [`circle`, { cx: `12`, cy: `12`, r: `10`, key: `1mglay` }],
      [`path`, { d: `M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20`, key: `13o1zl` }],
      [`path`, { d: `M2 12h20`, key: `9i4pu4` }],
    ],
  };
so.node;
var co = E(so),
  lo = {
    name: `grid-2x2-plus`,
    size: 24,
    node: [
      [
        `path`,
        {
          d: `M12 3v17a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1H3`,
          key: `11za1p`,
        },
      ],
      [`path`, { d: `M16 19h6`, key: `xwg31i` }],
      [`path`, { d: `M19 22v-6`, key: `qhmiwi` }],
    ],
    aliases: [`grid-2-x-2-plus`],
  };
lo.node;
var uo = E(lo),
  fo = {
    name: `grip-vertical`,
    size: 24,
    node: [
      [`circle`, { cx: `9`, cy: `12`, r: `1`, key: `1vctgf` }],
      [`circle`, { cx: `9`, cy: `5`, r: `1`, key: `hp0tcf` }],
      [`circle`, { cx: `9`, cy: `19`, r: `1`, key: `fkjjf6` }],
      [`circle`, { cx: `15`, cy: `12`, r: `1`, key: `1tmaij` }],
      [`circle`, { cx: `15`, cy: `5`, r: `1`, key: `19l28e` }],
      [`circle`, { cx: `15`, cy: `19`, r: `1`, key: `f4zoj3` }],
    ],
  };
fo.node;
var po = E(fo),
  mo = {
    name: `headphones`,
    size: 24,
    node: [
      [
        `path`,
        {
          d: `M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3`,
          key: `1xhozi`,
        },
      ],
    ],
  };
mo.node;
var ho = E(mo),
  go = {
    name: `hourglass`,
    size: 24,
    node: [
      [`path`, { d: `M5 22h14`, key: `ehvnwv` }],
      [`path`, { d: `M5 2h14`, key: `pdyrp9` }],
      [
        `path`,
        { d: `M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22`, key: `1d314k` },
      ],
      [
        `path`,
        { d: `M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2`, key: `1vvvr6` },
      ],
    ],
  };
go.node;
var _o = E(go),
  vo = {
    name: `house`,
    size: 24,
    node: [
      [`path`, { d: `M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8`, key: `5wwlr5` }],
      [
        `path`,
        {
          d: `M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z`,
          key: `r6nss1`,
        },
      ],
    ],
    aliases: [`home`],
  };
vo.node;
var yo = E(vo),
  bo = {
    name: `italic`,
    size: 24,
    node: [
      [`line`, { x1: `19`, x2: `10`, y1: `4`, y2: `4`, key: `15jd3p` }],
      [`line`, { x1: `14`, x2: `5`, y1: `20`, y2: `20`, key: `bu0au3` }],
      [`line`, { x1: `15`, x2: `9`, y1: `4`, y2: `20`, key: `uljnxc` }],
    ],
  };
bo.node;
var xo = E(bo),
  So = {
    name: `languages`,
    size: 24,
    node: [
      [`path`, { d: `m5 8 6 6`, key: `1wu5hv` }],
      [`path`, { d: `m4 14 6-6 2-3`, key: `1k1g8d` }],
      [`path`, { d: `M2 5h12`, key: `or177f` }],
      [`path`, { d: `M7 2h1`, key: `1t2jsx` }],
      [`path`, { d: `m22 22-5-10-5 10`, key: `don7ne` }],
      [`path`, { d: `M14 18h6`, key: `1m8k6r` }],
    ],
  };
So.node;
var Co = E(So),
  wo = {
    name: `laptop`,
    size: 24,
    node: [
      [
        `path`,
        {
          d: `M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z`,
          key: `1pdavp`,
        },
      ],
      [`path`, { d: `M20.054 15.987H3.946`, key: `14rxg9` }],
    ],
  };
wo.node;
var To = E(wo),
  Eo = {
    name: `list-checks`,
    size: 24,
    node: [
      [`path`, { d: `M13 5h8`, key: `a7qcls` }],
      [`path`, { d: `M13 12h8`, key: `h98zly` }],
      [`path`, { d: `M13 19h8`, key: `c3s6r1` }],
      [`path`, { d: `m3 17 2 2 4-4`, key: `1jhpwq` }],
      [`path`, { d: `m3 7 2 2 4-4`, key: `1obspn` }],
    ],
  };
Eo.node;
var Do = E(Eo),
  Oo = {
    name: `list-ordered`,
    size: 24,
    node: [
      [`path`, { d: `M11 5h10`, key: `1cz7ny` }],
      [`path`, { d: `M11 12h10`, key: `1438ji` }],
      [`path`, { d: `M11 19h10`, key: `11t30w` }],
      [`path`, { d: `M4 4h1v5`, key: `10yrso` }],
      [`path`, { d: `M4 9h2`, key: `r1h2o0` }],
      [`path`, { d: `M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02`, key: `xtkcd5` }],
    ],
  };
Oo.node;
var ko = E(Oo),
  Ao = {
    name: `list`,
    size: 24,
    node: [
      [`path`, { d: `M3 5h.01`, key: `18ugdj` }],
      [`path`, { d: `M3 12h.01`, key: `nlz23k` }],
      [`path`, { d: `M3 19h.01`, key: `noohij` }],
      [`path`, { d: `M8 5h13`, key: `1pao27` }],
      [`path`, { d: `M8 12h13`, key: `1za7za` }],
      [`path`, { d: `M8 19h13`, key: `m83p4d` }],
    ],
  };
Ao.node;
var jo = E(Ao),
  Mo = {
    name: `lock`,
    size: 24,
    node: [
      [`rect`, { width: `18`, height: `11`, x: `3`, y: `11`, rx: `2`, ry: `2`, key: `1w4ew1` }],
      [`path`, { d: `M7 11V7a5 5 0 0 1 10 0v4`, key: `fwvmzm` }],
    ],
  };
Mo.node;
var No = E(Mo),
  Po = {
    name: `message-circle-question-mark`,
    size: 24,
    node: [
      [
        `path`,
        {
          d: `M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719`,
          key: `1sd12s`,
        },
      ],
      [`path`, { d: `M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3`, key: `1u773s` }],
      [`path`, { d: `M12 17h.01`, key: `p32p05` }],
    ],
    aliases: [`message-circle-question`],
  };
Po.node;
var Fo = E(Po),
  Io = {
    name: `mic-off`,
    size: 24,
    node: [
      [`path`, { d: `M12 19v3`, key: `npa21l` }],
      [`path`, { d: `M15 9.34V5a3 3 0 0 0-5.68-1.33`, key: `1gzdoj` }],
      [`path`, { d: `M16.95 16.95A7 7 0 0 1 5 12v-2`, key: `cqa7eg` }],
      [`path`, { d: `M18.89 13.23A7 7 0 0 0 19 12v-2`, key: `16hl24` }],
      [`path`, { d: `m2 2 20 20`, key: `1ooewy` }],
      [`path`, { d: `M9 9v3a3 3 0 0 0 5.12 2.12`, key: `r2i35w` }],
    ],
  };
Io.node;
var Lo = E(Io),
  Ro = {
    name: `moon`,
    size: 24,
    node: [
      [
        `path`,
        {
          d: `M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401`,
          key: `kfwtm`,
        },
      ],
    ],
  };
Ro.node;
var zo = E(Ro),
  Bo = {
    name: `mouse-pointer-click`,
    size: 24,
    node: [
      [`path`, { d: `M14 4.1 12 6`, key: `ita8i4` }],
      [`path`, { d: `m5.1 8-2.9-.8`, key: `1go3kf` }],
      [`path`, { d: `m6 12-1.9 2`, key: `mnht97` }],
      [`path`, { d: `M7.2 2.2 8 5.1`, key: `1cfko1` }],
      [
        `path`,
        {
          d: `M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z`,
          key: `s0h3yz`,
        },
      ],
    ],
  };
Bo.node;
var Vo = E(Bo),
  Ho = {
    name: `mouse`,
    size: 24,
    node: [
      [`rect`, { x: `5`, y: `2`, width: `14`, height: `20`, rx: `7`, key: `11ol66` }],
      [`path`, { d: `M12 6v4`, key: `16clxf` }],
    ],
  };
Ho.node;
var Uo = E(Ho),
  Wo = {
    name: `paperclip`,
    size: 24,
    node: [
      [
        `path`,
        {
          d: `m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551`,
          key: `1miecu`,
        },
      ],
    ],
  };
Wo.node;
var Go = E(Wo),
  Ko = {
    name: `pen-line`,
    size: 24,
    node: [
      [`path`, { d: `M13 21h8`, key: `1jsn5i` }],
      [
        `path`,
        {
          d: `M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z`,
          key: `1a8usu`,
        },
      ],
    ],
    aliases: [`edit-3`],
  };
Ko.node;
var qo = E(Ko),
  Jo = {
    name: `power-off`,
    size: 24,
    node: [
      [`path`, { d: `M18.36 6.64A9 9 0 0 1 20.77 15`, key: `dxknvb` }],
      [`path`, { d: `M6.16 6.16a9 9 0 1 0 12.68 12.68`, key: `1x7qb5` }],
      [`path`, { d: `M12 2v4`, key: `3427ic` }],
      [`path`, { d: `m2 2 20 20`, key: `1ooewy` }],
    ],
  };
Jo.node;
var Yo = E(Jo),
  Xo = {
    name: `repeat`,
    size: 24,
    node: [
      [`path`, { d: `m17 2 4 4-4 4`, key: `nntrym` }],
      [`path`, { d: `M3 11v-1a4 4 0 0 1 4-4h14`, key: `84bu3i` }],
      [`path`, { d: `m7 22-4-4 4-4`, key: `1wqhfi` }],
      [`path`, { d: `M21 13v1a4 4 0 0 1-4 4H3`, key: `1rx37r` }],
    ],
  };
Xo.node;
var Zo = E(Xo),
  Qo = {
    name: `rotate-ccw`,
    size: 24,
    node: [
      [`path`, { d: `M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8`, key: `1357e3` }],
      [`path`, { d: `M3 3v5h5`, key: `1xhq8a` }],
    ],
  };
Qo.node;
var $o = E(Qo),
  es = {
    name: `rotate-cw`,
    size: 24,
    node: [
      [`path`, { d: `M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8`, key: `1p45f6` }],
      [`path`, { d: `M21 3v5h-5`, key: `1q7to0` }],
    ],
  };
es.node;
var ts = E(es),
  ns = {
    name: `settings-2`,
    size: 24,
    node: [
      [`path`, { d: `M14 17H5`, key: `gfn3mx` }],
      [`path`, { d: `M19 7h-9`, key: `6i9tg` }],
      [`circle`, { cx: `17`, cy: `17`, r: `3`, key: `18b49y` }],
      [`circle`, { cx: `7`, cy: `7`, r: `3`, key: `dfmy0x` }],
    ],
  };
ns.node;
var rs = E(ns),
  is = {
    name: `shield-alert`,
    size: 24,
    node: [
      [
        `path`,
        {
          d: `M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z`,
          key: `oel41y`,
        },
      ],
      [`path`, { d: `M12 8v4`, key: `1got3b` }],
      [`path`, { d: `M12 16h.01`, key: `1drbdi` }],
    ],
  };
is.node;
var as = E(is),
  ss = {
    name: `shield-check`,
    size: 24,
    node: [
      [
        `path`,
        {
          d: `M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z`,
          key: `oel41y`,
        },
      ],
      [`path`, { d: `m9 12 2 2 4-4`, key: `dzmm74` }],
    ],
  };
ss.node;
var cs = E(ss),
  ls = {
    name: `shield-off`,
    size: 24,
    node: [
      [`path`, { d: `m2 2 20 20`, key: `1ooewy` }],
      [
        `path`,
        {
          d: `M5 5a1 1 0 0 0-1 1v7c0 5 3.5 7.5 7.67 8.94a1 1 0 0 0 .67.01c2.35-.82 4.48-1.97 5.9-3.71`,
          key: `1jlk70`,
        },
      ],
      [
        `path`,
        {
          d: `M9.309 3.652A12.252 12.252 0 0 0 11.24 2.28a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1v7a9.784 9.784 0 0 1-.08 1.264`,
          key: `18rp1v`,
        },
      ],
    ],
  };
ls.node;
var us = E(ls),
  ds = {
    name: `smartphone`,
    size: 24,
    node: [
      [`rect`, { width: `14`, height: `20`, x: `5`, y: `2`, rx: `2`, ry: `2`, key: `1yt0o3` }],
      [`path`, { d: `M12 18h.01`, key: `mhygvu` }],
    ],
  };
ds.node;
var fs = E(ds),
  ps = {
    name: `square-pen`,
    size: 24,
    node: [
      [`path`, { d: `M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7`, key: `1m0v6g` }],
      [
        `path`,
        {
          d: `M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z`,
          key: `ohrbg2`,
        },
      ],
    ],
    aliases: [`pen-box`, `edit`, `pen-square`],
  };
ps.node;
var ms = E(ps),
  hs = {
    name: `square-terminal`,
    size: 24,
    node: [
      [`path`, { d: `m7 11 2-2-2-2`, key: `1lz0vl` }],
      [`path`, { d: `M11 13h4`, key: `1p7l4v` }],
      [`rect`, { width: `18`, height: `18`, x: `3`, y: `3`, rx: `2`, ry: `2`, key: `1m3agn` }],
    ],
    aliases: [`terminal-square`],
  };
hs.node;
var gs = E(hs),
  _s = {
    name: `strikethrough`,
    size: 24,
    node: [
      [`path`, { d: `M16 4H9a3 3 0 0 0-2.83 4`, key: `43sutm` }],
      [`path`, { d: `M14 12a4 4 0 0 1 0 8H6`, key: `nlfj13` }],
      [`line`, { x1: `4`, x2: `20`, y1: `12`, y2: `12`, key: `1e0a9i` }],
    ],
  };
_s.node;
var vs = E(_s),
  ys = {
    name: `sun-moon`,
    size: 24,
    node: [
      [`path`, { d: `M12 2v2`, key: `tus03m` }],
      [
        `path`,
        {
          d: `M14.837 16.385a6 6 0 1 1-7.223-7.222c.624-.147.97.66.715 1.248a4 4 0 0 0 5.26 5.259c.589-.255 1.396.09 1.248.715`,
          key: `xlf6rm`,
        },
      ],
      [`path`, { d: `M16 12a4 4 0 0 0-4-4`, key: `6vsxu` }],
      [`path`, { d: `m19 5-1.256 1.256`, key: `1yg6a6` }],
      [`path`, { d: `M20 12h2`, key: `1q8mjw` }],
    ],
  };
ys.node;
var bs = E(ys),
  xs = {
    name: `terminal`,
    size: 24,
    node: [
      [`path`, { d: `M12 19h8`, key: `baeox8` }],
      [`path`, { d: `m4 17 6-6-6-6`, key: `1yngyt` }],
    ],
  };
xs.node;
var Ss = E(xs),
  Cs = {
    name: `wifi-off`,
    size: 24,
    node: [
      [`path`, { d: `M12 20h.01`, key: `zekei9` }],
      [`path`, { d: `M8.5 16.429a5 5 0 0 1 7 0`, key: `1bycff` }],
      [`path`, { d: `M5 12.859a10 10 0 0 1 5.17-2.69`, key: `1dl1wf` }],
      [`path`, { d: `M19 12.859a10 10 0 0 0-2.007-1.523`, key: `4k23kn` }],
      [`path`, { d: `M2 8.82a15 15 0 0 1 4.177-2.643`, key: `1grhjp` }],
      [`path`, { d: `M22 8.82a15 15 0 0 0-11.288-3.764`, key: `z3jwby` }],
      [`path`, { d: `m2 2 20 20`, key: `1ooewy` }],
    ],
  };
Cs.node;
var ws = E(Cs),
  Ts = {
    name: `wifi`,
    size: 24,
    node: [
      [`path`, { d: `M12 20h.01`, key: `zekei9` }],
      [`path`, { d: `M2 8.82a15 15 0 0 1 20 0`, key: `dnpr2z` }],
      [`path`, { d: `M5 12.859a10 10 0 0 1 14 0`, key: `1x1e6c` }],
      [`path`, { d: `M8.5 16.429a5 5 0 0 1 7 0`, key: `1bycff` }],
    ],
  };
Ts.node;
var Es = E(Ts),
  jsxRuntime = C();
function Ds({ id: e, active: t, icon: n, title: r, hint: i }) {
  return (0, jsxRuntime.jsxs)(Et.div, {
    "data-zone": e,
    animate: { scale: t ? 1 : 0.97, opacity: t ? 1 : 0.55 },
    transition: { type: `spring`, stiffness: 500, damping: 32 },
    className: `relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-center ${t ? `bg-white/10` : `bg-white/[0.03]`}`,
    children: [
      (0, jsxRuntime.jsx)(`svg`, {
        className: `pointer-events-none absolute inset-0 size-full`,
        "aria-hidden": !0,
        children: (0, jsxRuntime.jsx)(`rect`, {
          x: `1`,
          y: `1`,
          rx: `15`,
          fill: `none`,
          stroke: t
            ? `color-mix(in srgb, var(--color-ink) 55%, transparent)`
            : `color-mix(in srgb, var(--color-ink) 18%, transparent)`,
          strokeWidth: `1.5`,
          strokeDasharray: `6 6`,
          style: {
            width: `calc(100% - 2px)`,
            height: `calc(100% - 2px)`,
            animation: t ? `marching 0.6s linear infinite` : void 0,
          },
        }),
      }),
      (0, jsxRuntime.jsx)(`div`, { className: t ? `text-ink` : `text-ink-2`, children: n }),
      (0, jsxRuntime.jsx)(`div`, { className: `text-[13px] font-semibold text-ink`, children: r }),
      (0, jsxRuntime.jsx)(`div`, { className: `text-[11px] leading-tight text-ink-3`, children: i }),
    ],
  });
}
function Os() {
  let e = useIslandStore((e) => e.dragOver?.zone ?? `shelf`),
    t = Fi({
      onChat: useIslandStore((e) => e.expanded && e.tab === `chat`),
      launcher: useIslandStore((e) => e.settings?.moduleLauncher !== !1),
      chat: useIslandStore((e) => e.license.pro),
    }),
    n = Dn(),
    r =
      n.kind === `slot`
        ? (0, jsxRuntime.jsx)(Pn, {
            id: n.id,
            mood: e === `shelf` ? `eat` : `idle`,
            width: 72,
            height: 44,
            className: `-my-2`,
          })
        : (0, jsxRuntime.jsx)(Hn, { size: 22 }),
    i = t.length === 1;
  return (0, jsxRuntime.jsx)(`div`, {
    className: `flex h-full gap-2.5 p-3`,
    children: t.map((t) =>
      t === `shelf`
        ? (0, jsxRuntime.jsx)(
            Ds,
            {
              id: t,
              active: e === t,
              icon: r,
              title: o(`На полку`, `To the shelf`),
              hint: o(`полежит, пока не понадобится`, `keeps it until you need it`),
            },
            t,
          )
        : t === `launcher`
          ? (0, jsxRuntime.jsx)(
              Ds,
              {
                id: t,
                active: e === t,
                icon: (0, jsxRuntime.jsx)(uo, { size: 22 }),
                title: o(`В лаунчер`, `To the launcher`),
                hint: o(`ярлык для быстрого запуска`, `a shortcut for quick launch`),
              },
              t,
            )
          : (0, jsxRuntime.jsx)(
              Ds,
              {
                id: t,
                active: e === t,
                icon: (0, jsxRuntime.jsx)(Go, { size: 22 }),
                title: o(`В чат`, `To the chat`),
                hint: i
                  ? o(
                      `картинки и документы для вопроса ИИ`,
                      `pictures and documents for a question to the AI`,
                    )
                  : o(`спросить ИИ про файл`, `ask the AI about it`),
              },
              t,
            ),
    ),
  });
}
var ks = /^\s*(```|~~~)\s*([\w+#.-]*)\s*$/,
  As = /^\s*(```|~~~)\s*$/,
  js = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/,
  Ms = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/,
  Ns = /^(\s*)[-*•+]\s+/,
  Ps = /^(\s*)(\d+)([.)])\s+/,
  Fs = /^\[([ xX])\]\s+/,
  Is = /^\s*>/,
  Ls = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/,
  Rs = (e) => Ns.test(e) || Ps.test(e),
  zs = (e) => e.match(/^\s*/)[0].replace(/\t/g, `    `).length;
function Bs(e, t) {
  return e[t].includes(`|`) && t + 1 < e.length && e[t + 1].includes(`-`) && Ls.test(e[t + 1]);
}
function Vs(e, t) {
  let n = e[t];
  return ks.test(n) || js.test(n) || Ms.test(n) || Rs(n) || Is.test(n) || Bs(e, t);
}
function Hs(e) {
  let t = e.trim();
  (t.startsWith(`|`) && (t = t.slice(1)), t.endsWith(`|`) && !t.endsWith(`\\|`) && (t = t.slice(0, -1)));
  let n = [],
    r = ``,
    i = !1;
  for (let e = 0; e < t.length; e++) {
    let a = t[e];
    a === `\\` && t[e + 1] === `|`
      ? ((r += `|`), e++)
      : a === "`"
        ? ((i = !i), (r += a))
        : a === `|` && !i
          ? (n.push(r.trim()), (r = ``))
          : (r += a);
  }
  return (n.push(r.trim()), n);
}
function Us(e) {
  let t = e.startsWith(`:`),
    n = e.endsWith(`:`);
  return t && n ? `center` : n ? `right` : t ? `left` : null;
}
function Ws(e) {
  let t = e.replace(
      /\r\n?/g,
      `
`,
    ).split(`
`),
    n = [],
    r = 0;
  for (; r < t.length; ) {
    let e = t[r],
      i = ks.exec(e);
    if (i) {
      let e = [],
        a = !1;
      for (r++; r < t.length; r++) {
        if (As.test(t[r])) {
          ((a = !0), r++);
          break;
        }
        e.push(t[r]);
      }
      n.push({
        t: `code`,
        lang: i[2],
        v: e.join(`
`),
        open: !a,
      });
      continue;
    }
    if (!e.trim()) {
      r++;
      continue;
    }
    let a = js.exec(e);
    if (a) {
      (n.push({ t: `h`, level: a[1].length, c: Js(a[2]) }), r++);
      continue;
    }
    if (Ms.test(e)) {
      (n.push({ t: `hr` }), r++);
      continue;
    }
    if (Rs(e)) {
      let e = [];
      for (; r < t.length; r++) {
        let n = t[r],
          i = Ns.exec(n),
          a = i ? null : Ps.exec(n);
        if (i || a)
          e.push({ indent: zs(n), mark: a ? a[2] + a[3] : null, text: n.slice((i ?? a)[0].length) });
        else if (n.trim() && zs(n) >= 2 && !ks.test(n))
          e[e.length - 1].text +=
            `
` + n.trim();
        else break;
      }
      let i = Math.min(...e.map((e) => e.indent).filter((e) => e > 0), 1 / 0),
        a = e.map((e) => {
          let t = Fs.exec(e.text);
          return {
            c: Js(t ? e.text.slice(t[0].length) : e.text),
            depth: Number.isFinite(i) ? Math.min(4, Math.round(e.indent / i)) : 0,
            mark: e.mark,
            check: t ? t[1] !== ` ` : null,
          };
        });
      n.push({ t: `list`, items: a });
      continue;
    }
    if (Bs(t, r)) {
      let i = Hs(e),
        a = Hs(t[r + 1]).map(Us),
        o = [];
      for (r += 2; r < t.length && t[r].includes(`|`) && t[r].trim(); r++) {
        let e = Hs(t[r]);
        o.push(i.map((t, n) => Js(e[n] ?? ``)));
      }
      n.push({ t: `table`, align: i.map((e, t) => a[t] ?? null), head: i.map((e) => Js(e)), rows: o });
      continue;
    }
    if (Is.test(e)) {
      let e = [];
      for (; r < t.length && Is.test(t[r]); r++) e.push(t[r].replace(/^\s*>\s?/, ``));
      n.push({
        t: `quote`,
        c: Js(
          e.join(`
`),
        ),
      });
      continue;
    }
    let o = [e];
    for (r++; r < t.length && t[r].trim() && !Vs(t, r); r++) o.push(t[r]);
    n.push({
      t: `p`,
      c: Js(
        o.join(`
`),
      ),
    });
  }
  return n;
}
var Gs = /^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/,
  Ks = /^https?:\/\/[^\s<>"]+/,
  qs = (e) => !!e && /[\p{L}\p{N}]/u.test(e);
function Js(e) {
  let t = [],
    n = ``,
    r = () => {
      (n && t.push({ t: `text`, v: n }), (n = ``));
    },
    i = 0;
  for (; i < e.length; ) {
    let a = e[i],
      o = e.slice(i);
    if (a === `\\` && /[\\`*_~[\]()#>|!-]/.test(e[i + 1] ?? ``)) {
      ((n += e[i + 1]), (i += 2));
      continue;
    }
    if (a === "`") {
      let n = e.indexOf("`", i + 1);
      if (n > i + 1) {
        (r(), t.push({ t: `code`, v: e.slice(i + 1, n) }), (i = n + 1));
        continue;
      }
    }
    if (a === `*` && o.startsWith(`***`)) {
      let n = e.indexOf(`***`, i + 3);
      if (n > i + 3) {
        (r(), t.push({ t: `b`, c: [{ t: `i`, c: Js(e.slice(i + 3, n)) }] }), (i = n + 3));
        continue;
      }
    }
    if (a === `~` && e[i + 1] === `~`) {
      let n = e.indexOf(`~~`, i + 2);
      if (n > i + 2) {
        (r(), t.push({ t: `s`, c: Js(e.slice(i + 2, n)) }), (i = n + 2));
        continue;
      }
    }
    if ((a === `*` || (a === `_` && !qs(e[i - 1]))) && e[i + 1] === a) {
      let n = e.indexOf(a + a, i + 2);
      if (n > i + 2) {
        (r(), t.push({ t: `b`, c: Js(e.slice(i + 2, n)) }), (i = n + 2));
        continue;
      }
    }
    if ((a === `*` || a === `_`) && e[i + 1] !== a && e[i + 1] !== ` ` && !(a === `_` && qs(e[i - 1]))) {
      let n = e.indexOf(a, i + 1);
      if (n > i + 1 && e[n - 1] !== ` ` && e[n + 1] !== a && !(a === `_` && qs(e[n + 1]))) {
        (r(), t.push({ t: `i`, c: Js(e.slice(i + 1, n)) }), (i = n + 1));
        continue;
      }
    }
    if (a === `[`) {
      let e = Gs.exec(o);
      if (e) {
        (r(), t.push({ t: `link`, v: e[1], href: e[2] }), (i += e[0].length));
        continue;
      }
    }
    if (a === `h` && !qs(e[i - 1])) {
      let e = Ks.exec(o);
      if (e) {
        let n = e[0].replace(/[.,;:!?)»'"]+$/, ``);
        (r(), t.push({ t: `link`, v: n, href: n }), (i += n.length));
        continue;
      }
    }
    ((n += a), i++);
  }
  return (r(), t);
}
function Ys({ items: e }) {
  return (0, jsxRuntime.jsx)(jsxRuntime.Fragment, {
    children: e.map((e, t) => {
      switch (e.t) {
        case `text`:
          return (0, jsxRuntime.jsx)(`span`, { children: e.v }, t);
        case `code`:
          return (0, jsxRuntime.jsx)(
            `code`,
            {
              className: `rounded-[5px] bg-white/10 px-1 py-px font-mono text-[12px] text-ink`,
              children: e.v,
            },
            t,
          );
        case `b`:
          return (0, jsxRuntime.jsx)(
            `strong`,
            { className: `font-semibold text-ink`, children: (0, jsxRuntime.jsx)(Ys, { items: e.c }) },
            t,
          );
        case `i`:
          return (0, jsxRuntime.jsx)(`em`, { children: (0, jsxRuntime.jsx)(Ys, { items: e.c }) }, t);
        case `s`:
          return (0, jsxRuntime.jsx)(
            `s`,
            { className: `text-ink-3`, children: (0, jsxRuntime.jsx)(Ys, { items: e.c }) },
            t,
          );
        case `link`:
          return (0, jsxRuntime.jsx)(
            `button`,
            {
              title: e.href,
              onClick: () => void u.openPath(e.href),
              className: `text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent`,
              children: e.v,
            },
            t,
          );
      }
    }),
  });
}
function Xs({ lang: e, code: t, open: n }) {
  let [r, i] = (0, ReactRuntime.useState)(!1);
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `overflow-hidden rounded-xl bg-white/6 ring-1 ring-white/8`,
    children: [
      (0, jsxRuntime.jsxs)(`div`, {
        className: `flex h-7 items-center justify-between pr-1 pl-3 text-[10.5px] text-ink-3`,
        children: [
          (0, jsxRuntime.jsx)(`span`, { className: `font-mono`, children: e || o(`код`, `code`) }),
          !n &&
            (0, jsxRuntime.jsxs)(`button`, {
              onClick: () =>
                void u.clipSetText(t).then(() => {
                  (i(!0), setTimeout(() => i(!1), 1400));
                }),
              className: `press flex h-6 items-center gap-1 rounded-md px-1.5 hover:bg-tile hover:text-ink`,
              children: [
                r
                  ? (0, jsxRuntime.jsx)(_r, { size: 12, className: `text-ok` })
                  : (0, jsxRuntime.jsx)(A, { size: 12 }),
                r ? o(`Скопировано`, `Copied`) : o(`Скопировать`, `Copy`),
              ],
            }),
        ],
      }),
      (0, jsxRuntime.jsx)(`pre`, {
        className: `scroll-thin overflow-x-auto px-3 pb-2.5 font-mono text-[12px] leading-relaxed text-ink select-text`,
        children: (0, jsxRuntime.jsx)(`code`, { children: t }),
      }),
    ],
  });
}
function Zs({ b: e }) {
  switch (e.t) {
    case `p`:
      return (0, jsxRuntime.jsx)(`p`, {
        className: `whitespace-pre-wrap`,
        children: (0, jsxRuntime.jsx)(Ys, { items: e.c }),
      });
    case `h`:
      return (0, jsxRuntime.jsx)(`p`, {
        className: `font-semibold text-ink ${e.level <= 2 ? `text-[14px]` : `text-[13px]`}`,
        children: (0, jsxRuntime.jsx)(Ys, { items: e.c }),
      });
    case `code`:
      return (0, jsxRuntime.jsx)(Xs, { lang: e.lang, code: e.v, open: e.open });
    case `list`:
      return (0, jsxRuntime.jsx)(`div`, {
        className: `flex flex-col gap-0.5`,
        children: e.items.map((e, t) =>
          (0, jsxRuntime.jsxs)(
            `div`,
            {
              className: `flex gap-2`,
              style: { paddingLeft: e.depth * 18 },
              children: [
                (0, jsxRuntime.jsx)(`span`, {
                  className: `flex shrink-0 justify-end text-ink-3 ${e.mark && e.mark.length > 2 ? `w-6` : `w-4`}`,
                  children:
                    e.check === null
                      ? (e.mark ?? (e.depth === 0 ? `•` : e.depth === 1 ? `◦` : `▪`))
                      : (0, jsxRuntime.jsx)(`span`, {
                          className: `mt-[3px] flex size-3.5 items-center justify-center rounded-[4px] ring-1 ${e.check ? `bg-accent text-neutral-950 ring-accent` : `ring-white/30`}`,
                          children: e.check && (0, jsxRuntime.jsx)(_r, { size: 10, strokeWidth: 3 }),
                        }),
                }),
                (0, jsxRuntime.jsx)(`span`, {
                  className: `min-w-0 flex-1 whitespace-pre-wrap ${e.check ? `text-ink-3 line-through` : ``}`,
                  children: (0, jsxRuntime.jsx)(Ys, { items: e.c }),
                }),
              ],
            },
            t,
          ),
        ),
      });
    case `table`:
      return (0, jsxRuntime.jsx)(`div`, {
        className: `scroll-thin overflow-x-auto rounded-xl ring-1 ring-white/10`,
        children: (0, jsxRuntime.jsxs)(`table`, {
          className: `w-full border-collapse text-[12.5px]`,
          children: [
            (0, jsxRuntime.jsx)(`thead`, {
              className: `bg-white/6`,
              children: (0, jsxRuntime.jsx)(`tr`, {
                children: e.head.map((t, n) =>
                  (0, jsxRuntime.jsx)(
                    `th`,
                    {
                      style: { textAlign: e.align[n] ?? `left` },
                      className: `px-2.5 py-1.5 font-semibold whitespace-nowrap text-ink`,
                      children: (0, jsxRuntime.jsx)(Ys, { items: t }),
                    },
                    n,
                  ),
                ),
              }),
            }),
            (0, jsxRuntime.jsx)(`tbody`, {
              children: e.rows.map((t, n) =>
                (0, jsxRuntime.jsx)(
                  `tr`,
                  {
                    className: `border-t border-white/8`,
                    children: t.map((t, n) =>
                      (0, jsxRuntime.jsx)(
                        `td`,
                        {
                          style: { textAlign: e.align[n] ?? `left` },
                          className: `px-2.5 py-1.5 align-top`,
                          children: (0, jsxRuntime.jsx)(Ys, { items: t }),
                        },
                        n,
                      ),
                    ),
                  },
                  n,
                ),
              ),
            }),
          ],
        }),
      });
    case `quote`:
      return (0, jsxRuntime.jsx)(`blockquote`, {
        className: `border-l-2 border-white/20 pl-3 whitespace-pre-wrap text-ink-2`,
        children: (0, jsxRuntime.jsx)(Ys, { items: e.c }),
      });
    case `hr`:
      return (0, jsxRuntime.jsx)(`hr`, { className: `border-white/10` });
  }
}
var Qs = (0, ReactRuntime.memo)(function ({ text: e }) {
    let t = Ws(e);
    return (0, jsxRuntime.jsx)(`div`, {
      className: `flex flex-col gap-2 select-text`,
      children: t.map((e, t) => (0, jsxRuntime.jsx)(Zs, { b: e }, t)),
    });
  }),
  $s = () => [
    o(`Объясни простыми словами, как работает VPN`, `Explain in plain words how a VPN works`),
    o(`Помоги написать вежливое письмо о переносе встречи`, `Help me write a polite email to move a meeting`),
    o(`Придумай пять идей, чем заняться в выходные`, `Give me five ideas for the weekend`),
  ];
function ec({ children: e, tone: t = `bg-accent/15 text-accent` }) {
  return (0, jsxRuntime.jsx)(`span`, {
    className: `mt-px grid size-6 shrink-0 place-items-center rounded-full ${t}`,
    children: e,
  });
}
function tc({ title: e, onClick: t, children: n }) {
  return (0, jsxRuntime.jsx)(`button`, {
    title: e,
    onClick: t,
    className: `press grid size-6 place-items-center rounded-md text-ink-3 hover:bg-tile hover:text-ink`,
    children: n,
  });
}
function nc({ text: e }) {
  let [t, n] = (0, ReactRuntime.useState)(!1);
  return (0, jsxRuntime.jsx)(tc, {
    title: o(`Скопировать ответ`, `Copy the answer`),
    onClick: () =>
      void u.clipSetText(e).then(() => {
        (n(!0), setTimeout(() => n(!1), 1400));
      }),
    children: t
      ? (0, jsxRuntime.jsx)(_r, { size: 12, className: `text-ok` })
      : (0, jsxRuntime.jsx)(A, { size: 12 }),
  });
}
function rc() {
  return (0, jsxRuntime.jsx)(`span`, {
    className: `flex h-5 items-center gap-1`,
    "aria-label": o(`ИИ думает`, `AI is thinking`),
    children: [0, 1, 2].map((e) =>
      (0, jsxRuntime.jsx)(
        `span`,
        {
          className: `size-1.5 animate-pulse rounded-full bg-ink-3`,
          style: { animationDelay: `${e * 160}ms` },
        },
        e,
      ),
    ),
  });
}
function ic({ mood: e, live: t }) {
  let n = Dn();
  return n.kind === `slot`
    ? (0, jsxRuntime.jsx)(Pn, {
        id: n.id,
        mood: e,
        width: 30,
        height: 26,
        still: !t,
        className: `-mt-0.5 -ml-1`,
      })
    : e === `sad`
      ? (0, jsxRuntime.jsx)(ec, {
          tone: `bg-danger/20 text-danger`,
          children: (0, jsxRuntime.jsx)(Ia, { size: 13 }),
        })
      : (0, jsxRuntime.jsx)(ec, { children: (0, jsxRuntime.jsx)(fr, { size: 13 }) });
}
function ac(e) {
  if (e.pages) return se(e.pages, [`стр.`, `стр.`, `стр.`], [`page`, `pages`]);
  let t = e.chars ?? 0,
    n = t >= 1e3 ? `${Math.round(t / 100) / 10}k` : String(t);
  return o(`${n} симв.`, `${n} chars`);
}
function oc({ a: e, onRemove: t }) {
  let n =
    t &&
    (0, jsxRuntime.jsx)(`button`, {
      title: o(`Убрать`, `Remove`),
      onClick: t,
      className: `press absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-white text-black opacity-0 shadow group-hover/chip:opacity-100`,
      children: (0, jsxRuntime.jsx)(yr, { size: 10, strokeWidth: 3 }),
    });
  return e.kind === `image`
    ? (0, jsxRuntime.jsxs)(`span`, {
        className: `group/chip relative shrink-0`,
        title: e.name,
        children: [
          e.thumb
            ? (0, jsxRuntime.jsx)(`img`, {
                src: e.thumb,
                alt: ``,
                draggable: !1,
                className: `h-12 max-w-[84px] rounded-lg object-cover ring-1 ring-white/15`,
              })
            : (0, jsxRuntime.jsx)(`span`, {
                className: `grid h-12 w-14 place-items-center rounded-lg bg-white/10 text-[10px] text-ink-3`,
                children: o(`фото`, `image`),
              }),
          n,
        ],
      })
    : (0, jsxRuntime.jsxs)(`span`, {
        className: `group/chip relative flex h-12 max-w-[190px] shrink-0 items-center gap-2 rounded-lg bg-white/10 pr-2.5 pl-2`,
        title: e.name,
        children: [
          (0, jsxRuntime.jsx)(no, { size: 18, className: `shrink-0 text-accent` }),
          (0, jsxRuntime.jsxs)(`span`, {
            className: `min-w-0`,
            children: [
              (0, jsxRuntime.jsx)(`span`, {
                className: `block truncate text-[11.5px] font-medium text-ink`,
                children: e.name,
              }),
              (0, jsxRuntime.jsx)(`span`, { className: `block text-[10px] text-ink-3`, children: ac(e) }),
            ],
          }),
          n,
        ],
      });
}
function sc({ m: e, isLast: t, streaming: n }) {
  return e.role === `user`
    ? (0, jsxRuntime.jsxs)(`div`, {
        className: `flex flex-col items-end gap-1.5 pl-14`,
        children: [
          e.attachments &&
            e.attachments.length > 0 &&
            (0, jsxRuntime.jsx)(`div`, {
              className: `flex flex-wrap justify-end gap-1.5`,
              children: e.attachments.map((e) => (0, jsxRuntime.jsx)(oc, { a: e }, e.id)),
            }),
          e.text &&
            (0, jsxRuntime.jsx)(`div`, {
              className: `rounded-2xl rounded-br-md bg-white/12 px-3 py-2 text-[13px] leading-relaxed break-words whitespace-pre-wrap text-ink select-text`,
              children: e.text,
            }),
        ],
      })
    : e.error
      ? (0, jsxRuntime.jsxs)(`div`, {
          className: `flex items-start gap-2.5 pr-10`,
          children: [
            (0, jsxRuntime.jsx)(ic, { mood: `sad`, live: t }),
            (0, jsxRuntime.jsxs)(`div`, {
              className: `min-w-0 flex-1 text-[12.5px] leading-relaxed text-danger`,
              children: [
                e.text,
                t &&
                  (0, jsxRuntime.jsxs)(`button`, {
                    onClick: () => M.getState().retry(),
                    className: `press mt-1.5 flex h-7 items-center gap-1.5 rounded-lg bg-tile px-2.5 text-[11.5px] font-medium text-ink hover:bg-tile-hover`,
                    children: [(0, jsxRuntime.jsx)($o, { size: 12 }), o(`Повторить`, `Retry`)],
                  }),
              ],
            }),
          ],
        })
      : (0, jsxRuntime.jsxs)(`div`, {
          className: `group flex items-start gap-2.5 pr-10`,
          children: [
            (0, jsxRuntime.jsx)(ic, { mood: n ? `think` : `idle`, live: t }),
            (0, jsxRuntime.jsxs)(`div`, {
              className: `min-w-0 flex-1 text-[13px] leading-relaxed text-ink`,
              children: [
                e.text ? (0, jsxRuntime.jsx)(Qs, { text: e.text }) : (0, jsxRuntime.jsx)(rc, {}),
                !n &&
                  e.text &&
                  (0, jsxRuntime.jsxs)(`div`, {
                    className: `mt-1 -ml-1 flex gap-0.5 ${t ? `` : `opacity-0 group-hover:opacity-100`}`,
                    children: [
                      (0, jsxRuntime.jsx)(nc, { text: e.text }),
                      t &&
                        (0, jsxRuntime.jsx)(tc, {
                          title: o(`Ответить заново`, `Regenerate`),
                          onClick: () => M.getState().retry(),
                          children: (0, jsxRuntime.jsx)($o, { size: 12 }),
                        }),
                    ],
                  }),
              ],
            }),
          ],
        });
}
var cc = { gemini: `Gemini`, deepseek: `DeepSeek` };
function lc() {
  let e = useIslandStore((e) => e.chatService),
    t = useIslandStore((e) => e.license.pro),
    n = (e) => {
      if (e !== `island` && !t) return useIslandStore.getState().pushPeek({ kind: `pro`, feature: `ai` });
      da(e);
    },
    r = [
      { id: `island`, label: o(`Остров`, `Island`) },
      { id: `gemini`, label: `Gemini` },
      { id: `deepseek`, label: `DeepSeek` },
    ];
  return (0, jsxRuntime.jsxs)(`div`, {
    "data-chat-switch": !0,
    className: `flex shrink-0 items-center gap-1.5`,
    children: [
      (0, jsxRuntime.jsx)(`div`, {
        className: `flex items-center gap-0.5 rounded-full bg-tile p-0.5`,
        children: r.map((t) =>
          (0, jsxRuntime.jsxs)(
            `button`,
            {
              "data-chat-service": t.id,
              "data-on": e === t.id || void 0,
              onClick: () => n(t.id),
              title:
                t.id === `island`
                  ? o(
                      `Чат острова: через ключ ИИ из настроек`,
                      `The island's chat: through the AI key of the settings`,
                    )
                  : o(
                      `Сайт сервиса: без ключа, со своим аккаунтом`,
                      `The service's site: no key, with your own account`,
                    ),
              className: `press flex h-6 items-center gap-1 rounded-full px-2.5 text-[11.5px] transition-colors ${e === t.id ? `bg-ink text-island` : `text-ink-2 hover:text-ink`}`,
              children: [
                t.id === `island`
                  ? (0, jsxRuntime.jsx)(fr, { size: 11 })
                  : (0, jsxRuntime.jsx)(co, { size: 11 }),
                t.label,
              ],
            },
            t.id,
          ),
        ),
      }),
      e !== `island` &&
        (0, jsxRuntime.jsxs)(`div`, {
          className: `ml-auto flex items-center gap-0.5`,
          children: [
            (0, jsxRuntime.jsxs)(`button`, {
              "data-web-ai-window": !0,
              onClick: () => {
                (u
                  .webAiWindow(e)
                  .catch((e) => useIslandStore.getState().pushPeek({ kind: `error`, message: String(e) })),
                  useIslandStore.getState().close());
              },
              title: o(
                `Открыть в отдельном окне: его размер можно менять`,
                `Open in a window of its own: it can be resized`,
              ),
              className: `press flex h-6 items-center gap-1 rounded-full px-2 text-[11.5px] text-ink-2 hover:bg-tile hover:text-ink`,
              children: [(0, jsxRuntime.jsx)(ze, { size: 11 }), o(`В окне`, `In a window`)],
            }),
            (0, jsxRuntime.jsx)(`button`, {
              "data-web-ai-browser": !0,
              onClick: () => {
                (u.webAiBrowser(e), useIslandStore.getState().close());
              },
              title: o(`Открыть в браузере`, `Open in the browser`),
              className: `press grid size-6 place-items-center rounded-full text-ink-3 hover:bg-tile hover:text-ink`,
              children: (0, jsxRuntime.jsx)(pr, { size: 13 }),
            }),
          ],
        }),
    ],
  });
}
function uc({ service: e }) {
  let t = (0, ReactRuntime.useRef)(null),
    n = useIslandStore((e) => e.expanded),
    r = useIslandStore((e) => e.tab === `chat`),
    i = useIslandStore((e) => e.license.pro),
    a = useIslandStore((t) => t.webAiPopped === e),
    s = useIslandStore((e) => e.webAiWantsKeys),
    c = (0, ReactRuntime.useRef)(null),
    [l, d] = (0, ReactRuntime.useState)(null);
  return (
    (0, ReactRuntime.useEffect)(
      () =>
        useIslandStore.subscribe((e, t) => {
          ((t.expanded && !e.expanded) || (t.tab === `chat` && e.tab !== `chat`)) &&
            ((c.current = null), u.webAiHide());
        }),
      [],
    ),
    (0, ReactRuntime.useEffect)(() => {
      let o = t.current;
      if (!o || !n || !i || !r || a) {
        ((c.current = null), u.webAiHide());
        return;
      }
      d(null);
      let s = o.closest(`[data-island]`),
        l = o.closest(`[data-liquid-squash] > div`),
        f = 0,
        p = !0,
        m = null,
        h = 0,
        g = ``,
        _ = (t) => {
          if (((f = 0), !p)) return;
          let n = o.getBoundingClientRect(),
            r = s?.getBoundingClientRect(),
            i = [n.x, n.y, n.width, n.height, r?.width ?? 0, r?.height ?? 0];
          (!m || i.some((e, t) => Math.abs(e - m[t]) > 1)) && ((m = i), (h = t));
          let a =
              !r ||
              (n.left >= r.left - 1 &&
                n.right <= r.right + 1 &&
                n.top >= r.top - 1 &&
                n.bottom <= r.bottom + 1),
            v = !l || Number(getComputedStyle(l).opacity) > 0.97;
          if (t - h < 70 || !a || !v) {
            f = requestAnimationFrame(_);
            return;
          }
          let y = [n.x, n.y, n.width, n.height].map((e) => Math.round(e)).join(`,`);
          if (y === g) return;
          g = y;
          let b = { x: n.x, y: n.y, width: n.width, height: n.height };
          c.current = b;
          let x = useIslandStore.getState().webAiWantsKeys;
          (x && useIslandStore.setState({ webAiWantsKeys: !1 }),
            u.webAiEmbed(e, b, x).catch((e) => p && d(String(e))));
        },
        v = () => {
          f ||= requestAnimationFrame(_);
        };
      v();
      let y = new ResizeObserver(v);
      return (
        y.observe(o),
        s && y.observe(s),
        window.addEventListener(`resize`, v),
        () => {
          ((p = !1),
            cancelAnimationFrame(f),
            y.disconnect(),
            window.removeEventListener(`resize`, v),
            (c.current = null),
            u.webAiHide());
        }
      );
    }, [e, n, i, r, a]),
    (0, ReactRuntime.useEffect)(() => {
      s &&
        c.current &&
        (useIslandStore.setState({ webAiWantsKeys: !1 }), u.webAiEmbed(e, c.current, !0).catch(() => void 0));
    }, [s, e]),
    a
      ? (0, jsxRuntime.jsx)(`div`, {
          "data-web-ai-popped": e,
          className: `on-dark relative grid min-h-0 flex-1 place-items-center rounded-xl bg-[#131314] px-6 text-center`,
          children: (0, jsxRuntime.jsxs)(`div`, {
            className: `flex flex-col items-center gap-3`,
            children: [
              (0, jsxRuntime.jsx)(ma, { size: 22, className: `text-ink-3` }),
              (0, jsxRuntime.jsx)(`div`, {
                className: `text-[13px] text-ink-2`,
                children: o(`${cc[e]} открыт в отдельном окне`, `${cc[e]} is open in a window of its own`),
              }),
              (0, jsxRuntime.jsxs)(`div`, {
                className: `flex gap-2`,
                children: [
                  (0, jsxRuntime.jsx)(`button`, {
                    "data-web-ai-show": !0,
                    onClick: () => {
                      (u.webAiWindowShow(), useIslandStore.getState().close());
                    },
                    className: `press h-7 rounded-full bg-[#fff] px-3 text-[12px] font-medium text-neutral-950`,
                    children: o(`Показать окно`, `Show the window`),
                  }),
                  (0, jsxRuntime.jsx)(`button`, {
                    "data-web-ai-back": !0,
                    onClick: () => void u.webAiWindowClose(),
                    className: `press h-7 rounded-full bg-tile px-3 text-[12px] text-ink`,
                    children: o(`Вернуть в остров`, `Back into the island`),
                  }),
                ],
              }),
            ],
          }),
        })
      : (0, jsxRuntime.jsx)(`div`, {
          ref: t,
          "data-web-ai-slot": e,
          className: `relative min-h-0 flex-1 overflow-hidden rounded-xl bg-[#131314]`,
          children: (0, jsxRuntime.jsx)(`div`, {
            className: `on-dark absolute inset-0 grid place-items-center text-center text-[12px] text-ink-3`,
            children: l
              ? (0, jsxRuntime.jsxs)(`span`, {
                  className: `flex max-w-[80%] items-center gap-1.5 text-rec-ink`,
                  children: [(0, jsxRuntime.jsx)(Ia, { size: 14, className: `shrink-0` }), l],
                })
              : (0, jsxRuntime.jsxs)(`span`, {
                  className: `flex items-center gap-1.5`,
                  children: [
                    (0, jsxRuntime.jsx)(Ve, { size: 14, className: `animate-spin` }),
                    o(`Открываю ${cc[e]}…`, `Opening ${cc[e]}…`),
                  ],
                }),
          }),
        })
  );
}
function dc() {
  let e = M((e) => e.messages),
    t = M((e) => e.streaming),
    n = M((e) => e.loaded),
    r = M((e) => e.draft),
    i = M((e) => e.pending),
    a = M((e) => e.attaching > 0),
    s = M((e) => e.notice),
    c = useIslandStore((e) => (e.dictation?.target === `chat` ? e.dictation.state : null)),
    l = useIslandStore((e) => e.voice),
    d = useIslandStore((e) => e.settings?.aiModel),
    f = useIslandStore((e) => e.openedBy),
    p = useIslandStore((e) => e.chatService),
    m = Dn(),
    h = useIslandStore((e) => e.look),
    [g, _] = (0, ReactRuntime.useState)(null),
    v = (0, ReactRuntime.useRef)(null),
    y = (0, ReactRuntime.useRef)(null),
    b = (0, ReactRuntime.useRef)(!0);
  ((0, ReactRuntime.useEffect)(
    () => (M.getState().load(), u.aiKeyStatus().then(_), () => useIslandStore.getState().setHoldOpen(!1)),
    [],
  ),
    (0, ReactRuntime.useEffect)(() => {
      f === `hotkey` && y.current?.focus();
    }, [f]),
    (0, ReactRuntime.useLayoutEffect)(() => {
      let e = v.current;
      e && b.current && (e.scrollTop = e.scrollHeight);
    }, [e, n]),
    (0, ReactRuntime.useLayoutEffect)(() => {
      let e = y.current;
      e && ((e.style.height = `0px`), (e.style.height = `${Math.min(112, e.scrollHeight)}px`));
    }, [r]));
  let x = (r.trim().length > 0 || i.length > 0) && !a,
    S = (e) => {
      (!e.trim() && i.length === 0) ||
        t ||
        a ||
        ((b.current = !0), M.getState().send(e), u.takeFocus(), y.current?.focus());
    },
    C = (0, ReactRuntime.useRef)(!1);
  (0, ReactRuntime.useEffect)(() => {
    (C.current && c === null && y.current?.focus(), (C.current = c !== null));
  }, [c]);
  let w = (e) => {
      let t = Array.from(e.clipboardData.files);
      if (t.length !== 0) {
        e.preventDefault();
        for (let e of t) {
          let t = new FileReader();
          ((t.onload = () =>
            M.getState().attachData(e.name || o(`снимок.png`, `picture.png`), String(t.result))),
            t.readAsDataURL(e));
        }
      }
    },
    T = () => {
      (useIslandStore.getState().setHoldOpen(!0),
        M.getState()
          .attachPick()
          .finally(() => {
            (u.takeFocus(), y.current?.focus());
          }));
    },
    E = (e) => {
      e.key === `Enter` && !e.shiftKey && !e.nativeEvent.isComposing && (e.preventDefault(), S(r));
    },
    D = () => {
      (useIslandStore.getState().setHoldOpen(!1),
        setTimeout(() => {
          let e = useIslandStore.getState();
          !document.hasFocus() && !e.hovered && !e.pinned && e.expanded && e.close();
        }, 0));
    },
    O = n && e.length === 0;
  return p === `island`
    ? (0, jsxRuntime.jsxs)(`div`, {
        className: `flex h-full flex-col gap-2`,
        children: [
          (0, jsxRuntime.jsx)(lc, {}),
          (0, jsxRuntime.jsx)(`div`, {
            ref: v,
            onScroll: (e) => {
              let t = e.currentTarget;
              b.current = t.scrollHeight - t.scrollTop - t.clientHeight < 24;
            },
            className: `scroll-thin min-h-0 flex-1 overflow-y-auto pr-1`,
            children: O
              ? (0, jsxRuntime.jsxs)(`div`, {
                  className: `flex h-full flex-col items-center justify-center gap-3 px-8 text-center`,
                  children: [
                    m.kind === `slot`
                      ? (0, jsxRuntime.jsx)(Pn, { id: m.id, mood: `idle`, width: 110, height: 78, look: h })
                      : (0, jsxRuntime.jsx)(`span`, {
                          className: `grid size-10 place-items-center rounded-full bg-accent/15 text-accent`,
                          children: (0, jsxRuntime.jsx)(fr, { size: 18 }),
                        }),
                    (0, jsxRuntime.jsxs)(`div`, {
                      children: [
                        (0, jsxRuntime.jsx)(`div`, {
                          className: `text-[15px] font-semibold text-ink`,
                          children: o(`Спроси что угодно`, `Ask anything`),
                        }),
                        (0, jsxRuntime.jsxs)(`div`, {
                          className: `mt-0.5 text-[12px] text-ink-3`,
                          children: [
                            d,
                            ` `,
                            o(
                              `помнит весь разговор · Shift+Enter — новая строка`,
                              `remembers the whole conversation · Shift+Enter for a new line`,
                            ),
                          ],
                        }),
                      ],
                    }),
                    g === !1
                      ? (0, jsxRuntime.jsxs)(`div`, {
                          className: `flex flex-col items-center gap-2 text-[12px] text-ink-2`,
                          children: [
                            o(
                              `Добавь ключ в настройках, раздел «ИИ»: там есть бесплатные сервисы. Ключ хранится только на этом компьютере. Или выбери выше Gemini или DeepSeek: их сайты работают без ключа.`,
                              `Add a key in Settings → AI: there are free services to choose from. The key is stored only on this computer. Or pick Gemini or DeepSeek above: their sites need no key.`,
                            ),
                            (0, jsxRuntime.jsx)(`button`, {
                              onClick: () => {
                                (useIslandStore.getState().close(), u.openSettings());
                              },
                              className: `press h-7 rounded-lg bg-white px-3 text-[11.5px] font-semibold text-black`,
                              children: o(`Открыть настройки`, `Open settings`),
                            }),
                          ],
                        })
                      : null,
                    g !== !1 &&
                      (0, jsxRuntime.jsx)(`div`, {
                        className: `flex flex-wrap justify-center gap-1.5`,
                        children: $s().map((e) =>
                          (0, jsxRuntime.jsx)(
                            `button`,
                            {
                              onClick: () => S(e),
                              className: `press rounded-full bg-tile px-3 py-1.5 text-[12px] text-ink-2 hover:bg-tile-hover hover:text-ink`,
                              children: e,
                            },
                            e,
                          ),
                        ),
                      }),
                  ],
                })
              : (0, jsxRuntime.jsx)(`div`, {
                  className: `flex flex-col gap-3.5 py-1`,
                  children: e.map((n, r) =>
                    (0, jsxRuntime.jsx)(
                      sc,
                      { m: n, isLast: r === e.length - 1, streaming: t && r === e.length - 1 },
                      n.id,
                    ),
                  ),
                }),
          }),
          (i.length > 0 || a || s) &&
            (0, jsxRuntime.jsxs)(`div`, {
              className: `flex shrink-0 flex-col gap-1 px-1`,
              children: [
                (i.length > 0 || a) &&
                  (0, jsxRuntime.jsxs)(`div`, {
                    className: `flex flex-wrap items-center gap-1.5 pt-1`,
                    children: [
                      i.map((e) =>
                        (0, jsxRuntime.jsx)(oc, { a: e, onRemove: () => M.getState().unattach(e.id) }, e.id),
                      ),
                      a &&
                        (0, jsxRuntime.jsxs)(`span`, {
                          className: `flex h-12 items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 text-[11.5px] text-ink-3`,
                          children: [
                            (0, jsxRuntime.jsx)(Ve, { size: 14, className: `animate-spin` }),
                            o(`Читаю файл…`, `Reading the file…`),
                          ],
                        }),
                    ],
                  }),
                s &&
                  (0, jsxRuntime.jsx)(`div`, {
                    className: `line-clamp-2 text-[11px] leading-snug text-amber-300`,
                    children: s,
                  }),
              ],
            }),
          (0, jsxRuntime.jsxs)(`div`, {
            className: `flex shrink-0 items-end gap-1.5`,
            children: [
              (0, jsxRuntime.jsx)(`button`, {
                title: o(`Новый чат`, `New chat`),
                disabled: e.length === 0,
                onClick: () => {
                  ((b.current = !0), M.getState().reset());
                },
                className: `press grid size-9 shrink-0 place-items-center rounded-xl text-ink-3 hover:bg-tile hover:text-ink disabled:pointer-events-none disabled:opacity-30`,
                children: (0, jsxRuntime.jsx)(ms, { size: 16 }),
              }),
              (0, jsxRuntime.jsxs)(`div`, {
                className: `flex min-w-0 flex-1 items-end rounded-[18px] bg-tile pr-1 focus-within:bg-tile-hover`,
                children: [
                  (0, jsxRuntime.jsx)(`button`, {
                    title: o(
                      `Приложить картинку или документ · можно вставить из буфера или перетащить`,
                      `Attach a picture or a document · you can also paste or drop it`,
                    ),
                    onClick: T,
                    className: `press mb-1 ml-1 grid size-7 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-white/10 hover:text-ink`,
                    children: (0, jsxRuntime.jsx)(Go, { size: 15 }),
                  }),
                  (0, jsxRuntime.jsx)(`textarea`, {
                    ref: y,
                    rows: 1,
                    value: r,
                    onChange: (e) => M.getState().setDraft(e.target.value),
                    onKeyDown: E,
                    onMouseDown: () => void u.takeFocus(),
                    onFocus: () => useIslandStore.getState().setHoldOpen(!0),
                    onBlur: D,
                    onPaste: w,
                    spellCheck: !0,
                    lang: `ru`,
                    placeholder:
                      g === !1
                        ? o(`Сначала добавь ключ ИИ в настройках`, `Add an AI key in settings first`)
                        : o(`Сообщение для ИИ…`, `Message the AI…`),
                    className: `scroll-thin min-h-9 flex-1 resize-none bg-transparent py-2 pl-1.5 text-[13px] leading-5 text-ink outline-none select-text placeholder:text-ink-3`,
                  }),
                  (0, jsxRuntime.jsx)(`button`, {
                    title:
                      c === `recording`
                        ? o(`Закончить и распознать`, `Finish and recognise`)
                        : c === `transcribing`
                          ? o(`Распознаю…`, `Recognising…`)
                          : o(`Надиктовать сообщение`, `Dictate the message`),
                    disabled: c === `transcribing`,
                    onClick: () => void u.dictateToggle(`chat`),
                    className: `press mr-1 mb-1 grid size-7 shrink-0 place-items-center rounded-full ${c === `recording` ? `bg-[#ff453a] text-[#fff]` : `text-ink-3 hover:bg-white/10 hover:text-ink`}`,
                    style:
                      c === `recording`
                        ? { boxShadow: `0 0 0 ${Math.round(2 + l * 7)}px rgb(255 69 58 / 0.28)` }
                        : void 0,
                    children:
                      c === `transcribing`
                        ? (0, jsxRuntime.jsx)(Ve, { size: 15, className: `animate-spin` })
                        : (0, jsxRuntime.jsx)(jn, { size: 15 }),
                  }),
                  t
                    ? (0, jsxRuntime.jsx)(`button`, {
                        title: o(`Остановить ответ`, `Stop the answer`),
                        onClick: () => M.getState().stop(),
                        className: `press mb-1 grid size-7 shrink-0 place-items-center rounded-full bg-white/15 hover:bg-white/25`,
                        children: (0, jsxRuntime.jsx)(`span`, {
                          className: `size-2.5 rounded-[3px] bg-white`,
                        }),
                      })
                    : (0, jsxRuntime.jsx)(`button`, {
                        title: o(`Отправить · Enter`, `Send · Enter`),
                        disabled: !x,
                        onClick: () => S(r),
                        className: `press mb-1 grid size-7 shrink-0 place-items-center rounded-full bg-white text-black disabled:bg-white/12 disabled:text-ink-3`,
                        children: (0, jsxRuntime.jsx)(va, { size: 15, strokeWidth: 2.5 }),
                      }),
                ],
              }),
            ],
          }),
        ],
      })
    : (0, jsxRuntime.jsxs)(`div`, {
        className: `flex h-full flex-col gap-2`,
        children: [(0, jsxRuntime.jsx)(lc, {}), (0, jsxRuntime.jsx)(uc, { service: p })],
      });
}
function fc(e, t) {
  return e === `wifi` || e === `ethernet`
    ? e
    : t !== null && t.wifi === null && t.ethernet !== null
      ? `ethernet`
      : `wifi`;
}
var pc = {
    audio: (0, jsxRuntime.jsx)(ho, { size: 16 }),
    keyboard: (0, jsxRuntime.jsx)(pn, { size: 16 }),
    mouse: (0, jsxRuntime.jsx)(Uo, { size: 16 }),
    gamepad: (0, jsxRuntime.jsx)(oo, { size: 16 }),
    phone: (0, jsxRuntime.jsx)(fs, { size: 16 }),
    computer: (0, jsxRuntime.jsx)(To, { size: 16 }),
    other: (0, jsxRuntime.jsx)(Aa, { size: 16 }),
  },
  mc = 1e3,
  hc = 3e3;
function gc({ radioOn: e, onClose: t }) {
  let [n, r] = (0, ReactRuntime.useState)(null),
    [i, a] = (0, ReactRuntime.useState)(null),
    [s, c] = (0, ReactRuntime.useState)(null),
    l = (0, ReactRuntime.useRef)(0),
    d = (0, ReactRuntime.useRef)(null);
  ((0, ReactRuntime.useEffect)(() => {
    let e = !0,
      t,
      n = () => {
        u.btDevices()
          .then((t) => e && r(t))
          .catch(() => e && r([]))
          .finally(() => {
            e && (t = setTimeout(n, Date.now() < l.current ? mc : hc));
          });
      };
    return (
      n(),
      () => {
        ((e = !1), clearTimeout(t));
      }
    );
  }, []),
    (0, ReactRuntime.useEffect)(() => {
      let e = d.current;
      if (!e || !n) return;
      let t = n.find((t) => t.id === e.id);
      t && t.connected === e.want
        ? ((d.current = null), a(null))
        : Date.now() > e.until &&
          ((d.current = null),
          a(null),
          c(
            e.want
              ? o(
                  `«${e.name}» не подключилось: включено ли оно и рядом ли?`,
                  `“${e.name}” did not connect: is it on and near?`,
                )
              : o(
                  `«${e.name}» осталось подключённым: отключи его в параметрах Bluetooth`,
                  `“${e.name}” stayed connected: disconnect it in the Bluetooth settings`,
                ),
          ));
    }, [n]));
  let f = (e) => {
    (a(e.id),
      c(null),
      (d.current = { id: e.id, name: e.name, want: !e.connected, until: Date.now() + 1e4 }),
      (l.current = Date.now() + 12e3),
      u
        .btSwitch(e.id, !e.connected)
        .then(() => u.btDevices().then(r))
        .catch((e) => {
          ((d.current = null), a(null), c(String(e)));
        }));
  };
  return (0, jsxRuntime.jsxs)(Et.div, {
    "data-bt-sheet": !0,
    className: `absolute inset-0 z-10 flex flex-col gap-1.5 rounded-2xl bg-sheet p-3 ring-1 ring-white/10`,
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] },
    children: [
      (0, jsxRuntime.jsxs)(`div`, {
        className: `flex items-center gap-2`,
        children: [
          (0, jsxRuntime.jsx)(`span`, {
            className: `min-w-0 flex-1 truncate text-[12px] font-semibold text-ink-2`,
            children: o(`Устройства Bluetooth`, `Bluetooth devices`),
          }),
          (0, jsxRuntime.jsxs)(`button`, {
            title: o(`Параметры Bluetooth в Windows`, `Bluetooth settings of Windows`),
            onClick: () => void u.openPath(`ms-settings:bluetooth`),
            className: `press flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-ink-3 hover:bg-white/8 hover:text-ink`,
            children: [(0, jsxRuntime.jsx)(rs, { size: 12 }), o(`Параметры`, `Settings`)],
          }),
          (0, jsxRuntime.jsx)(`button`, {
            title: o(`Закрыть`, `Close`),
            onClick: t,
            className: `press grid size-6 place-items-center rounded-md text-ink-3 hover:bg-white/8 hover:text-ink`,
            children: (0, jsxRuntime.jsx)(yr, { size: 13 }),
          }),
        ],
      }),
      (0, jsxRuntime.jsx)(`div`, {
        className: `scroll-thin flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto`,
        children: e
          ? n === null
            ? (0, jsxRuntime.jsx)(Ve, { size: 16, className: `m-auto animate-spin text-ink-3` })
            : n.length === 0
              ? (0, jsxRuntime.jsx)(`div`, {
                  className: `m-auto text-center text-[12px] text-ink-3`,
                  children: o(`Нет сопряжённых устройств`, `No paired devices`),
                })
              : n.map((e, t) =>
                  (0, jsxRuntime.jsxs)(
                    Et.div,
                    {
                      "data-bt-device": e.name,
                      "data-connected": String(e.connected),
                      className: `flex h-10 shrink-0 items-center gap-2.5 rounded-xl px-2 hover:bg-white/5`,
                      initial: { opacity: 0, x: -6 },
                      animate: { opacity: 1, x: 0 },
                      transition: { delay: Math.min(t, 6) * 0.03, duration: 0.16 },
                      children: [
                        (0, jsxRuntime.jsx)(`span`, {
                          className: `grid size-7 shrink-0 place-items-center rounded-full transition-colors ${e.connected ? `bg-[#8ea2ff] text-neutral-950` : `bg-white/8 text-ink-3`}`,
                          children: pc[e.kind],
                        }),
                        (0, jsxRuntime.jsxs)(`span`, {
                          className: `min-w-0 flex-1`,
                          children: [
                            (0, jsxRuntime.jsx)(`span`, {
                              className: `block truncate text-[12.5px] font-medium text-ink`,
                              children: e.name || o(`Без названия`, `Unnamed`),
                            }),
                            (0, jsxRuntime.jsxs)(`span`, {
                              className: `block truncate text-[10.5px] text-ink-3`,
                              children: [
                                e.connected
                                  ? o(`Подключено`, `Connected`)
                                  : o(`Не подключено`, `Not connected`),
                                Number.isFinite(e.battery) ? ` · ${e.battery}%` : o(` · заряд недоступен`, ` · battery unavailable`),
                              ],
                            }),
                          ],
                        }),
                        e.switchable &&
                          (0, jsxRuntime.jsxs)(`button`, {
                            "data-bt-switch": !0,
                            disabled: i !== null,
                            onClick: () => f(e),
                            className: `press flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11.5px] font-medium transition-colors disabled:opacity-60 ${e.connected ? `bg-white/10 text-ink hover:bg-white/16` : `bg-[#8ea2ff] text-neutral-950 hover:bg-[#a3b3ff]`}`,
                            children: [
                              i === e.id && (0, jsxRuntime.jsx)(Ve, { size: 12, className: `animate-spin` }),
                              e.connected ? o(`Отключить`, `Disconnect`) : o(`Подключить`, `Connect`),
                            ],
                          }),
                        !e.switchable && (0, jsxRuntime.jsx)(`button`, {
                          onClick: () => void u.openPath(`ms-settings:bluetooth`),
                          className: `press h-7 shrink-0 rounded-full bg-white/8 px-2 text-[11px] text-ink-3`,
                          title: o(`Windows не предоставила управление службами этого устройства`, `Windows does not expose service controls for this device`),
                          children: o(`В Windows`, `In Windows`),
                        }),
                      ],
                    },
                    e.id,
                  ),
                )
          : (0, jsxRuntime.jsx)(`div`, {
              className: `m-auto text-[12px] text-ink-3`,
              children: o(`Bluetooth выключен`, `Bluetooth is off`),
            }),
      }),
      s &&
        (0, jsxRuntime.jsx)(`div`, {
          "data-bt-note": !0,
          className: `truncate px-1 text-[11px] text-danger`,
          title: s,
          children: s,
        }),
    ],
  });
}
var _c = 8e3;
function vc({ bars: e }) {
  return (0, jsxRuntime.jsx)(`svg`, {
    viewBox: `0 0 16 14`,
    width: 15,
    height: 13,
    "aria-hidden": `true`,
    children: [0, 1, 2, 3].map((t) =>
      (0, jsxRuntime.jsx)(
        `rect`,
        {
          x: t * 4.2,
          y: 10 - t * 3.2,
          width: 2.8,
          height: 4 + t * 3.2,
          rx: 1,
          fill: `currentColor`,
          opacity: t < Math.max(1, e) ? 1 : 0.25,
        },
        t,
      ),
    ),
  });
}
function yc({ radioOn: e, onClose: t }) {
  let [n, r] = (0, ReactRuntime.useState)(null),
    [i, a] = (0, ReactRuntime.useState)(null),
    [s, c] = (0, ReactRuntime.useState)(null),
    [l, d] = (0, ReactRuntime.useState)(null),
    [f, p] = (0, ReactRuntime.useState)(null),
    m = () =>
      u
        .wifiNetworks()
        .then((e) => {
          (r(e), a(null));
        })
        .catch((e) => {
          (r([]), a(String(e)));
        });
  (0, ReactRuntime.useEffect)(() => {
    if (!e) return;
    let t = !0,
      n,
      r = () => {
        m().finally(() => {
          t && (n = setTimeout(r, _c));
        });
      };
    return (
      r(),
      () => {
        ((t = !1), clearTimeout(n));
      }
    );
  }, [e]);
  let h = l !== null;
  (0, ReactRuntime.useEffect)(() => {
    if (h)
      return (useIslandStore.getState().setHoldOpen(!0), () => useIslandStore.getState().setHoldOpen(!1));
  }, [h]);
  let g = (e, t) => {
      (c(e.ssid),
        p(null),
        u
          .wifiJoin(e.ssid, t)
          .then((t) => {
            if (t.ok) return (d(null), m());
            t.needsPassword
              ? d({ ssid: e.ssid, password: ``, wrong: t.message })
              : p(t.message ?? o(`Не удалось подключиться`, `Could not connect`));
          })
          .catch((e) => p(String(e)))
          .finally(() => c(null)));
    },
    _ = () => {
      (c(`leave`),
        u
          .wifiLeave()
          .then(m)
          .catch((e) => p(String(e)))
          .finally(() => c(null)));
    };
  return (0, jsxRuntime.jsxs)(Et.div, {
    "data-wifi-sheet": !0,
    className: `absolute inset-0 z-10 flex flex-col gap-1.5 rounded-2xl bg-sheet p-3 ring-1 ring-white/10`,
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] },
    children: [
      (0, jsxRuntime.jsxs)(`div`, {
        className: `flex items-center gap-2`,
        children: [
          (0, jsxRuntime.jsx)(`span`, {
            className: `min-w-0 flex-1 truncate text-[12px] font-semibold text-ink-2`,
            children: o(`Сети Wi-Fi`, `Wi-Fi networks`),
          }),
          (0, jsxRuntime.jsxs)(`button`, {
            title: o(`Параметры Wi-Fi в Windows`, `Wi-Fi settings of Windows`),
            onClick: () => void u.openPath(`ms-settings:network-wifi`),
            className: `press flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-ink-3 hover:bg-white/8 hover:text-ink`,
            children: [(0, jsxRuntime.jsx)(rs, { size: 12 }), o(`Параметры`, `Settings`)],
          }),
          (0, jsxRuntime.jsx)(`button`, {
            title: o(`Закрыть`, `Close`),
            onClick: t,
            className: `press grid size-6 place-items-center rounded-md text-ink-3 hover:bg-white/8 hover:text-ink`,
            children: (0, jsxRuntime.jsx)(yr, { size: 13 }),
          }),
        ],
      }),
      (0, jsxRuntime.jsx)(`div`, {
        className: `scroll-thin flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto`,
        children: e
          ? n === null
            ? (0, jsxRuntime.jsx)(Ve, { size: 16, className: `m-auto animate-spin text-ink-3` })
            : i
              ? (0, jsxRuntime.jsxs)(`div`, {
                  "data-wifi-error": !0,
                  className: `m-auto flex max-w-[360px] flex-col items-center gap-2 text-center text-[12px] text-ink-3`,
                  children: [
                    i,
                    /location|местоположени/i.test(i) &&
                      (0, jsxRuntime.jsx)(`button`, {
                        onClick: () => void u.openPath(`ms-settings:privacy-location`),
                        className: `press rounded-full bg-white/10 px-3 py-1 text-[11.5px] text-ink hover:bg-white/16`,
                        children: o(`Открыть настройки местоположения`, `Open the location settings`),
                      }),
                  ],
                })
              : n.length === 0
                ? (0, jsxRuntime.jsx)(`div`, {
                    className: `m-auto text-[12px] text-ink-3`,
                    children: o(`Сетей рядом не видно`, `No networks in sight`),
                  })
                : n.map((e, t) =>
                    (0, jsxRuntime.jsxs)(
                      Et.div,
                      {
                        "data-wifi-network": e.ssid,
                        "data-connected": String(e.connected),
                        className: `flex shrink-0 flex-col rounded-xl px-2 hover:bg-white/5`,
                        initial: { opacity: 0, x: -6 },
                        animate: { opacity: 1, x: 0 },
                        transition: { delay: Math.min(t, 6) * 0.03, duration: 0.16 },
                        children: [
                          (0, jsxRuntime.jsxs)(`div`, {
                            className: `flex h-10 items-center gap-2.5`,
                            children: [
                              (0, jsxRuntime.jsx)(`span`, {
                                className: `grid size-7 shrink-0 place-items-center rounded-full ${e.connected ? `bg-[#8ea2ff] text-neutral-950` : `bg-white/8 text-ink-2`}`,
                                children: (0, jsxRuntime.jsx)(vc, { bars: e.bars }),
                              }),
                              (0, jsxRuntime.jsxs)(`span`, {
                                className: `min-w-0 flex-1`,
                                children: [
                                  (0, jsxRuntime.jsxs)(`span`, {
                                    className: `flex items-center gap-1 truncate text-[12.5px] font-medium text-ink`,
                                    children: [
                                      (0, jsxRuntime.jsx)(`span`, {
                                        className: `truncate`,
                                        children: e.ssid,
                                      }),
                                      e.secure &&
                                        (0, jsxRuntime.jsx)(No, {
                                          size: 10,
                                          className: `shrink-0 text-ink-3`,
                                        }),
                                    ],
                                  }),
                                  (0, jsxRuntime.jsx)(`span`, {
                                    className: `block truncate text-[10.5px] text-ink-3`,
                                    children: e.connected
                                      ? o(`Подключено`, `Connected`)
                                      : e.secure
                                        ? o(`Защищённая`, `Secured`)
                                        : o(`Открытая`, `Open`),
                                  }),
                                ],
                              }),
                              (0, jsxRuntime.jsxs)(`button`, {
                                "data-wifi-join": !0,
                                disabled: s !== null,
                                onClick: () => (e.connected ? _() : g(e, null)),
                                className: `press flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11.5px] font-medium transition-colors disabled:opacity-60 ${e.connected ? `bg-white/10 text-ink hover:bg-white/16` : `bg-[#8ea2ff] text-neutral-950 hover:bg-[#a3b3ff]`}`,
                                children: [
                                  (s === e.ssid || (e.connected && s === `leave`)) &&
                                    (0, jsxRuntime.jsx)(Ve, { size: 12, className: `animate-spin` }),
                                  e.connected ? o(`Отключить`, `Disconnect`) : o(`Подключить`, `Connect`),
                                ],
                              }),
                            ],
                          }),
                          l?.ssid === e.ssid &&
                            (0, jsxRuntime.jsxs)(`form`, {
                              "data-wifi-password": !0,
                              className: `flex items-center gap-2 pb-2 pl-9`,
                              onSubmit: (t) => {
                                (t.preventDefault(), l.password && g(e, l.password));
                              },
                              children: [
                                (0, jsxRuntime.jsx)(`input`, {
                                  autoFocus: !0,
                                  type: `password`,
                                  value: l.password,
                                  onChange: (e) => d({ ...l, password: e.target.value }),
                                  onKeyDown: (e) => e.key === `Escape` && (e.stopPropagation(), d(null)),
                                  placeholder: l.wrong ?? o(`Пароль сети`, `Network password`),
                                  className: `h-8 min-w-0 flex-1 rounded-lg bg-tile px-2.5 text-[12px] text-ink outline-none placeholder:text-ink-3 focus:ring-1 ${l.wrong ? `ring-1 ring-danger/70` : `focus:ring-white/20`}`,
                                }),
                                (0, jsxRuntime.jsx)(`button`, {
                                  type: `submit`,
                                  disabled: !l.password || s !== null,
                                  className: `press h-8 shrink-0 rounded-lg bg-ink px-3 text-[12px] font-semibold text-island disabled:opacity-50`,
                                  children: o(`Войти`, `Join`),
                                }),
                              ],
                            }),
                        ],
                      },
                      e.ssid,
                    ),
                  )
          : (0, jsxRuntime.jsx)(`div`, {
              className: `m-auto text-[12px] text-ink-3`,
              children: o(`Wi-Fi выключен`, `Wi-Fi is off`),
            }),
      }),
      f &&
        (0, jsxRuntime.jsx)(`div`, {
          "data-wifi-note": !0,
          className: `truncate px-1 text-[11px] text-danger`,
          title: f,
          children: f,
        }),
    ],
  });
}
var bc = 4e3;
function xc({
  id: e,
  icon: t,
  title: n,
  on: r,
  busy: i,
  loading: a,
  onFlip: s,
  feminine: c = !1,
  hint: l,
  detail: u,
}) {
  let d = u ?? (r ? o(c ? `Включена` : `Включён`, `On`) : o(c ? `Выключена` : `Выключен`, `Off`)),
    f = a ? `…` : i ? o(`Переключаю…`, `Switching…`) : r === null ? o(`Нет адаптера`, `No adapter`) : d;
  return (0, jsxRuntime.jsxs)(`button`, {
    "data-control": e,
    "data-on": r === null ? `none` : String(r),
    title: l,
    disabled: r === null || i || a,
    onClick: s,
    className: `press flex min-w-0 flex-1 flex-col justify-between rounded-2xl p-3 text-left transition-colors ${r ? `bg-white/12` : `bg-tile`} ${r === null ? `opacity-45` : `hover:bg-tile-hover`} ${i ? `cursor-progress` : ``}`,
    children: [
      (0, jsxRuntime.jsx)(
        `span`,
        {
          className: `grid size-10 place-items-center rounded-full transition-colors ${r ? `pop-in bg-[#8ea2ff] text-neutral-950` : `bg-white/10 text-ink-2`}`,
          children: t,
        },
        String(r),
      ),
      (0, jsxRuntime.jsxs)(`span`, {
        className: `min-w-0`,
        children: [
          (0, jsxRuntime.jsx)(`span`, {
            className: `block truncate text-[13px] font-semibold text-ink`,
            children: n,
          }),
          (0, jsxRuntime.jsx)(`span`, { className: `block truncate text-[11.5px] text-ink-3`, children: f }),
        ],
      }),
    ],
  });
}
function Sc() {
  let [e, t] = (0, ReactRuntime.useState)(null),
    [n, r] = (0, ReactRuntime.useState)(null),
    [i, a] = (0, ReactRuntime.useState)(null),
    [s, c] = (0, ReactRuntime.useState)(null),
    [l, d] = (0, ReactRuntime.useState)(!1),
    [f, p] = (0, ReactRuntime.useState)(!1),
    [m, h] = (0, ReactRuntime.useState)(!1),
    g = useIslandStore((e) => e.vpnAsk);
  (0, ReactRuntime.useEffect)(() => {
    Date.now() - g < 3e3 && d(!0);
  }, [g]);
  let _ = useIslandStore((e) => e.battery),
    v = fc(
      useIslandStore((e) => e.settings?.controlsNet),
      e,
    ),
    y = (0, ReactRuntime.useRef)(void 0);
  (0, ReactRuntime.useEffect)(() => {
    let e = !0,
      n = () =>
        void u
          .controlsGet()
          .then((n) => e && t(n))
          .catch(() => {});
    n();
    let r = subscribeEvent(`controls:changed`, value => e && t(value));
    return () => {
      ((e = !1), void r.then(off => off()), clearTimeout(y.current));
    };
  }, []);
  let b = (e, n) => {
      (r(e.startsWith(`vpn:`) ? `vpn` : e), c(null));
      let i = e === `ethernet`;
      (i ? u.takeFocus() : Promise.resolve())
        .then(() => u.controlsSet(e, n))
        .then(t)
        .catch((e) => c(String(e)))
        .finally(() => {
          (r(null), i && u.releaseFocus());
        });
    },
    x = e?.vpns ?? [],
    S = useIslandStore((e) => e.settings?.showVpn !== !1),
    C = x.find((e) => e.on),
    w = x.filter((e) => e.ready),
    T = x.length === 1 ? x[0] : w.length === 1 ? w[0] : null,
    E = () => {
      if (C) return C.ready ? b(`vpn:${C.id}`, !1) : C.launchPath && u.openPath(C.launchPath);
      if (T?.onSource === `command`) return d(!0);
      if (T) return T.ready ? b(`vpn:${T.id}`, !0) : T.launchPath && u.openPath(T.launchPath);
      d(!0);
    },
    D = e !== null && !e.canSleep,
    O = (e) => {
      if ((clearTimeout(y.current), c(null), e === `sleep` && D)) {
        c(
          o(
            `На этом компьютере нет спящего режима: Windows его не поддерживает`,
            `This computer has no sleep mode: Windows does not support it here`,
          ),
        );
        return;
      }
      if (e !== `lock` && i !== e) {
        (a(e), (y.current = setTimeout(() => a(null), bc)));
        return;
      }
      (a(null),
        useIslandStore.getState().close(),
        u
          .powerAction(e)
          .catch((e) => useIslandStore.getState().pushPeek({ kind: `error`, message: String(e) })));
    },
    k = [
      { id: `lock`, icon: (0, jsxRuntime.jsx)(No, { size: 16 }), label: o(`Блокировка`, `Lock`) },
      { id: `sleep`, icon: (0, jsxRuntime.jsx)(zo, { size: 16 }), label: o(`Сон`, `Sleep`) },
      { id: `restart`, icon: (0, jsxRuntime.jsx)(ts, { size: 16 }), label: o(`Перезагрузка`, `Restart`) },
      { id: `shutdown`, icon: (0, jsxRuntime.jsx)(yn, { size: 16 }), label: o(`Выключение`, `Shut down`) },
    ];
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `flex h-full flex-col gap-2.5`,
    children: [
      (0, jsxRuntime.jsxs)(`div`, {
        className: `relative flex min-h-0 flex-1 gap-2.5`,
        children: [
          l &&
            (0, jsxRuntime.jsxs)(`div`, {
              "data-vpn-choice": !0,
              className: `absolute inset-0 z-10 flex flex-col gap-1.5 rounded-2xl bg-sheet p-3 ring-1 ring-white/10`,
              children: [
                (0, jsxRuntime.jsxs)(`div`, {
                  className: `flex items-center gap-2`,
                  children: [
                    (0, jsxRuntime.jsx)(`span`, {
                      className: `min-w-0 flex-1 truncate text-[12px] font-semibold text-ink-2`,
                      children: o(`Подключения VPN`, `VPN connections`),
                    }),
                    (0, jsxRuntime.jsx)(`button`, {
                      title: o(`Закрыть`, `Close`),
                      onClick: () => d(!1),
                      className: `press grid size-6 place-items-center rounded-md text-ink-3 hover:bg-white/8 hover:text-ink`,
                      children: (0, jsxRuntime.jsx)(yr, { size: 13 }),
                    }),
                  ],
                }),
                (0, jsxRuntime.jsx)(`div`, {
                  className: `scroll-thin flex min-h-0 flex-1 flex-wrap content-start gap-1.5 overflow-y-auto`,
                  children: x.map((e) => e.onSource === `command`
                    ? (0, jsxRuntime.jsxs)(`div`, {
                      "data-custom-vpn": true,
                      className: `flex w-full flex-wrap items-center gap-2 rounded-xl bg-white/5 p-2`,
                      children: [
                        (0, jsxRuntime.jsx)(`span`, { className: `w-full text-[12px] text-ink`, children: `${e.name} · ${o(`состояние неизвестно`, `status unknown`)}` }),
                        (0, jsxRuntime.jsx)(`span`, { className: `w-full text-[11px] text-ink-3`, children: e.lastRequestedOn == null
                          ? o(`Команды не проверяют состояние туннеля.`, `Commands do not verify tunnel status.`)
                          : o(`Последняя команда выполнена; проверь соединение в VPN-клиенте.`, `Last command completed; check the connection in your VPN client.`) }),
                        ...[true, false].map(on => (0, jsxRuntime.jsx)(`button`, {
                          "data-vpn-command": on ? `connect` : `disconnect`, disabled: n === `vpn`,
                          onClick: () => b(`vpn:${e.id}`, on),
                          className: `press h-8 rounded-full bg-white/10 px-3 text-[12px] text-ink disabled:opacity-50`,
                          children: on ? o(`Подключить`, `Connect`) : o(`Отключить`, `Disconnect`),
                        }, String(on))),
                      ],
                    }, e.id)
                    : (0, jsxRuntime.jsx)(
                      `button`,
                      {
                        onClick: () => {
                          (d(!1), e.ready ? b(`vpn:${e.id}`, !0) : e.launchPath && u.openPath(e.launchPath));
                        },
                        className: `press h-8 max-w-full truncate rounded-full bg-white/10 px-3 text-[12px] font-medium text-ink hover:bg-white/16`,
                        children: e.ready ? e.name : `${e.name} · ${o(`Открыть`, `Open`)}`,
                        title: e.ready ? e.name : o(`Подключение в окне VPN-клиента`, `Connect in the VPN client window`),
                      },
                      e.id,
                    ),
                  ),
                }),
              ],
            }),
          v === `ethernet`
            ? (0, jsxRuntime.jsx)(xc, {
                id: `ethernet`,
                icon: (0, jsxRuntime.jsx)(Qa, { size: 19 }),
                title: `Ethernet`,
                hint:
                  e?.ethernetAdapter?.description ??
                  o(`Открыть параметры проводной сети Windows`, `Open Windows Ethernet settings`),
                detail: e
                  ? o(e.ethernet ? `Подключён` : `Нет подключения`, e.ethernet ? `Connected` : `Disconnected`)
                  : void 0,
                on: e ? e.ethernet : !1,
                busy: n === `ethernet`,
                loading: !e,
                onFlip: () => e && b(`ethernet`, !e.ethernet),
              })
            : (0, jsxRuntime.jsxs)(`div`, {
                className: `relative flex min-w-0 flex-1`,
                children: [
                  (0, jsxRuntime.jsx)(xc, {
                    id: `wifi`,
                    icon:
                      e?.wifi === !1
                        ? (0, jsxRuntime.jsx)(ws, { size: 19 })
                        : (0, jsxRuntime.jsx)(Es, { size: 19 }),
                    title: `Wi-Fi`,
                    on: e ? e.wifi : !1,
                    busy: n === `wifi`,
                    loading: !e,
                    onFlip: () => e && b(`wifi`, !e.wifi),
                  }),
                  e?.wifi !== null &&
                    e?.wifi !== void 0 &&
                    (0, jsxRuntime.jsx)(`button`, {
                      "data-wifi-list": !0,
                      title: o(
                        `Сети Wi-Fi: выбрать сеть и подключиться`,
                        `Wi-Fi networks: pick one and join it`,
                      ),
                      onClick: () => h(!0),
                      className: `press absolute top-2.5 right-2.5 grid size-7 place-items-center rounded-full bg-white/8 text-ink-2 hover:bg-white/16 hover:text-ink`,
                      children: (0, jsxRuntime.jsx)(jo, { size: 14 }),
                    }),
                ],
              }),
          m && (0, jsxRuntime.jsx)(yc, { radioOn: e?.wifi === !0, onClose: () => h(!1) }),
          f && (0, jsxRuntime.jsx)(gc, { radioOn: e?.bluetooth === !0, onClose: () => p(!1) }),
          (0, jsxRuntime.jsxs)(`div`, {
            className: `relative flex min-w-0 flex-1`,
            children: [
              (0, jsxRuntime.jsx)(xc, {
                id: `bluetooth`,
                icon:
                  e?.bluetooth === !1
                    ? (0, jsxRuntime.jsx)(Oa, { size: 19 })
                    : (0, jsxRuntime.jsx)(Aa, { size: 19 }),
                title: `Bluetooth`,
                on: e ? e.bluetooth : !1,
                busy: n === `bluetooth`,
                loading: !e,
                onFlip: () => e && b(`bluetooth`, !e.bluetooth),
              }),
              e?.bluetooth !== null &&
                e?.bluetooth !== void 0 &&
                (0, jsxRuntime.jsx)(`button`, {
                  "data-bt-list": !0,
                  title: o(
                    `Устройства Bluetooth: подключить наушники или колонку`,
                    `Bluetooth devices: connect headphones or a speaker`,
                  ),
                  onClick: () => p(!0),
                  className: `press absolute top-2.5 right-2.5 grid size-7 place-items-center rounded-full bg-white/8 text-ink-2 hover:bg-white/16 hover:text-ink`,
                  children: (0, jsxRuntime.jsx)(jo, { size: 14 }),
                }),
            ],
          }),
          (0, jsxRuntime.jsx)(xc, {
            id: `dark`,
            icon: (0, jsxRuntime.jsx)(Ja, { size: 19 }),
            title: o(`Тёмная тема`, `Dark theme`),
            feminine: !0,
            on: e ? e.dark : !1,
            busy: n === `dark`,
            loading: !e,
            onFlip: () => e && b(`dark`, !e.dark),
          }),
          x.length > 0 &&
            S &&
            (0, jsxRuntime.jsx)(xc, {
              id: `vpn`,
              icon: C ? (0, jsxRuntime.jsx)(cs, { size: 19 }) : (0, jsxRuntime.jsx)(us, { size: 19 }),
              title: `VPN`,
              hint: o(
                `Happ, v2RayTun, Karing, Cloudflare WARP, Mullvad, PIA, Windscribe, OpenVPN и VPN-подключения самой Windows`,
                `Happ, v2RayTun, Karing, Cloudflare WARP, Mullvad, PIA, Windscribe, OpenVPN and the VPN connections of Windows itself`,
              ),
              detail: C?.name,
              on: !!C,
              busy: n === `vpn`,
              loading: !e,
              onFlip: E,
            }),
          _ &&
            (0, jsxRuntime.jsxs)(`div`, {
              "data-control": `battery`,
              className: `flex min-w-0 flex-1 flex-col justify-between rounded-2xl bg-tile p-3`,
              children: [
                (0, jsxRuntime.jsx)(`span`, {
                  className: `flex h-10 items-center`,
                  children: (0, jsxRuntime.jsx)(en, { battery: _ }),
                }),
                (0, jsxRuntime.jsxs)(`span`, {
                  className: `min-w-0`,
                  children: [
                    (0, jsxRuntime.jsx)(`span`, {
                      className: `block truncate text-[13px] font-semibold text-ink`,
                      children: o(`Батарея`, `Battery`),
                    }),
                    (0, jsxRuntime.jsx)(`span`, {
                      className: `block truncate text-[11.5px] text-ink-3`,
                      children: _.plugged
                        ? o(`Питание от сети`, `On mains power`)
                        : _.saver
                          ? o(`Экономия заряда`, `Battery saver`)
                          : o(`Работа от батареи`, `On battery`),
                    }),
                  ],
                }),
              ],
            }),
        ],
      }),
      (0, jsxRuntime.jsx)(`div`, {
        className: `flex h-[76px] shrink-0 gap-2.5`,
        children: k.map((e) => {
          let t = i === e.id,
            n = e.id === `sleep` && D;
          return (0, jsxRuntime.jsxs)(
            `button`,
            {
              "data-power": e.id,
              "data-armed": String(t),
              "data-off": String(n),
              title: n
                ? o(`На этом компьютере нет спящего режима`, `This computer has no sleep mode`)
                : void 0,
              onClick: () => O(e.id),
              className: `press relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl text-[12px] font-medium transition-colors ${t ? `bg-[#ff453a]/25 text-rec-ink` : `bg-tile text-ink hover:bg-tile-hover`} ${n ? `opacity-45` : ``}`,
              children: [
                (0, jsxRuntime.jsx)(`span`, { className: t ? `` : `text-ink-2`, children: e.icon }),
                (0, jsxRuntime.jsx)(`span`, {
                  className: `max-w-full truncate px-2`,
                  children: t ? o(`Нажми ещё раз`, `Press again`) : e.label,
                }),
                t &&
                  (0, jsxRuntime.jsx)(`span`, {
                    className: `absolute bottom-0 left-0 h-[3px] w-full origin-left bg-[#ff453a]`,
                    style: { animation: `armed ${bc}ms linear forwards` },
                  }),
              ],
            },
            e.id,
          );
        }),
      }),
      s &&
        (0, jsxRuntime.jsx)(`div`, {
          "data-control-note": !0,
          className: `truncate px-1 text-[11.5px] text-danger`,
          title: s,
          children: s,
        }),
    ],
  });
}
var Cc = (e) => e.replace(/\s+/g, ` `).trim().slice(0, 24);
function wc(e) {
  let t = null;
  try {
    t = e ? JSON.parse(e) : null;
  } catch {}
  let n = t && typeof t == `object` ? t : {},
    r = new Set(),
    i = [];
  for (let e of Array.isArray(n.folders) ? n.folders : []) {
    let { id: t, name: n, text: a } = e ?? {};
    if (
      typeof t == `string` &&
      t &&
      !r.has(t) &&
      typeof n == `string` &&
      Cc(n) &&
      (r.add(t), i.push({ id: t, name: Cc(n), text: typeof a == `string` ? a : `` }), i.length === 12)
    )
      break;
  }
  return { folders: i, current: typeof n.current == `string` && r.has(n.current) ? n.current : `` };
}
var Tc = (e) => JSON.stringify(e);
function Ec(e, t, n, r) {
  let i = new Set([n, ...e.folders.filter((e) => e.id !== r).map((e) => e.name)].map((e) => e.toLowerCase()));
  if (!i.has(t.toLowerCase())) return t;
  for (let e = 2; ; e++) {
    let n = `${t.slice(0, 24 - String(e).length - 1)} ${e}`;
    if (!i.has(n.toLowerCase())) return n;
  }
}
function Dc(e, t, n, r) {
  let i = Cc(t);
  return !i || e.folders.length >= 12 || e.folders.some((e) => e.id === r)
    ? e
    : { folders: [...e.folders, { id: r, name: Ec(e, i, n), text: `` }], current: r };
}
function Oc(e, t, n, r) {
  let i = Cc(n);
  return i ? { ...e, folders: e.folders.map((n) => (n.id === t ? { ...n, name: Ec(e, i, r, t) } : n)) } : e;
}
function kc(e, t) {
  let n = e.folders.findIndex((e) => e.id === t);
  if (n < 0) return e;
  let r = e.folders.filter((e) => e.id !== t);
  return { folders: r, current: e.current === t ? (r[n - 1]?.id ?? ``) : e.current };
}
function Ac(e, t, n) {
  return { ...e, folders: e.folders.map((e) => (e.id === t ? { ...e, text: n } : e)) };
}
function jc(e, t) {
  return t === `` || e.folders.some((e) => e.id === t) ? { ...e, current: t } : e;
}
var Mc = [`yellow`, `green`, `blue`, `pink`, `purple`],
  Nc = (e) => !!e && /[\p{L}\p{N}]/u.test(e),
  Pc = (e) => !e || /\s/.test(e);
function Fc(e, t) {
  if (e[t] !== `\\`) return !1;
  let n = e[t + 1];
  return n === `*` || n === `~` || n === `=` || (n === `_` && !Nc(e[t - 1]));
}
function Ic(e, t) {
  return t.length ? { type: `text`, text: e, marks: t.map((e) => ({ ...e })) } : { type: `text`, text: e };
}
function Lc(e, t, n) {
  for (let r = t; r < e.length; r++) {
    if (Fc(e, r)) {
      r++;
      continue;
    }
    if (e.startsWith(n, r)) {
      if (r === t || Pc(e[t]) || Pc(e[r - 1])) return -1;
      if (!(n === `_` && Nc(e[r + 1]))) {
        if (n === `*` && (e[r + 1] === `*` || e[r - 1] === `*`)) {
          e[r + 1] === `*` && r++;
          continue;
        }
        return r;
      }
    }
  }
  return -1;
}
function Rc(e, t = []) {
  let n = [],
    r = ``,
    i = () => {
      (r && n.push(Ic(r, t)), (r = ``));
    },
    a = 0;
  for (; a < e.length; ) {
    let o = e[a];
    if (Fc(e, a)) {
      ((r += e[a + 1]), (a += 2));
      continue;
    }
    let s = !1;
    for (let r of [`**`, `~~`, `==`, `_`, `*`]) {
      if (
        !e.startsWith(r, a) ||
        (r === `_` && Nc(e[a - 1])) ||
        (r === `*` && (e[a + 1] === `*` || e[a - 1] === `*`))
      )
        continue;
      let o = a + r.length,
        c = { type: r === `**` ? `bold` : r === `~~` ? `strike` : r === `==` ? `highlight` : `italic` };
      if (r === `==`) {
        let t = /^\{([a-z]+)\}/.exec(e.slice(o));
        t && Mc.includes(t[1])
          ? ((o += t[0].length), (c = { type: `highlight`, attrs: { color: t[1] } }))
          : (c = { type: `highlight`, attrs: { color: `yellow` } });
      }
      let l = Lc(e, o, r);
      if (!(l < 0)) {
        (i(), n.push(...Rc(e.slice(o, l), [...t, c])), (a = l + r.length), (s = !0));
        break;
      }
    }
    s || ((r += o), a++);
  }
  return (i(), n);
}
function zc(e) {
  let t = /^[ \t]*/.exec(e)[0],
    n = Math.floor(t.replace(/\t/g, `  `).length / 2),
    r = e.slice(t.length),
    i = /^(?:[-*•][ \t]+)?\[([ xX])\](?:[ \t](.*))?$/.exec(r);
  return i && (r.startsWith(`[`) || /^[-*•]/.test(r))
    ? { kind: `taskList`, depth: n, text: i[2] ?? ``, checked: i[1] !== ` ` }
    : ((i = /^[-*•][ \t](.*)$/.exec(r)),
      i
        ? { kind: `bulletList`, depth: n, text: i[1] }
        : ((i = /^(\d{1,9})[.)][ \t](.*)$/.exec(r)),
          i
            ? { kind: `orderedList`, depth: n, text: i[2], number: Number(i[1]) }
            : { kind: `paragraph`, depth: n, text: /^\\([-*•\d[])/.test(r) ? r.slice(1) : r }));
}
function Bc(e) {
  let t = Rc(e);
  return t.length ? { type: `paragraph`, content: t } : { type: `paragraph` };
}
function Vc(e) {
  let t = [],
    n = [];
  for (let r of e.split(`
`)) {
    let e = zc(r);
    if (e.kind === `paragraph`) {
      if (n.length && e.depth > 0 && e.text.trim()) {
        let t = n[n.length - 1];
        t.list.content[t.list.content.length - 1].content.push(Bc(e.text));
        continue;
      }
      ((n.length = 0), t.push(Bc(r.startsWith(` `) || r.startsWith(`	`) ? r : e.text)));
      continue;
    }
    for (; n.length && n[n.length - 1].depth > e.depth; ) n.pop();
    let i = n[n.length - 1];
    i && i.depth === e.depth && i.list.type !== e.kind && (n.pop(), (i = n[n.length - 1]));
    let a =
      e.kind === `taskList`
        ? { type: `taskItem`, attrs: { checked: e.checked === !0 }, content: [Bc(e.text)] }
        : { type: `listItem`, content: [Bc(e.text)] };
    if (i && i.depth === e.depth) {
      i.list.content.push(a);
      continue;
    }
    let o = { type: e.kind, content: [a] };
    (e.kind === `orderedList` && e.number !== void 0 && e.number !== 1 && (o.attrs = { start: e.number }),
      i
        ? (i.list.content[i.list.content.length - 1].content.push(o), n.push({ depth: i.depth + 1, list: o }))
        : (t.push(o), n.push({ depth: 0, list: o })));
  }
  return { type: `doc`, content: t.length ? t : [{ type: `paragraph` }] };
}
function Hc(e) {
  let t = Rc(e);
  return t.length === 0 || (t.length === 1 && !t[0].marks && t[0].text === e)
    ? e
    : e.replace(/[*~=]|(?<![\p{L}\p{N}])_/gu, (e) => `\\${e}`);
}
var Uc = [`highlight`, `strike`, `bold`, `italic`];
function Wc(e = []) {
  let t = ``;
  return (
    e.forEach((n, r) => {
      if (n.type !== `text` || !n.text) return;
      let i = [...(n.marks ?? [])]
          .filter((e) => Uc.includes(e.type))
          .sort((e, t) => Uc.indexOf(e.type) - Uc.indexOf(t.type)),
        a = Hc(n.text);
      if (!i.length) {
        t += a;
        return;
      }
      let o = /^\s*/.exec(a)[0],
        s = a.length > o.length ? /\s*$/.exec(a)[0] : ``,
        c = a.slice(o.length, a.length - s.length);
      if (!c) {
        t += a;
        return;
      }
      let l = i.some((e) => e.type === `bold`),
        u = (t + o).slice(-1),
        d = s ? s[0] : e[r + 1]?.text?.[0],
        f = (e, t) => {
          if (e.type === `bold`) return `**`;
          if (e.type === `strike`) return `~~`;
          if (e.type === `highlight`) {
            let n =
              typeof e.attrs?.color == `string` && Mc.includes(e.attrs.color) ? e.attrs.color : `yellow`;
            return t || n === `yellow` ? `==` : `=={${n}}`;
          }
          return !l && (Nc(u) || Nc(d)) ? `*` : `_`;
        };
      t +=
        o +
        i.map((e) => f(e, !1)).join(``) +
        c +
        [...i]
          .reverse()
          .map((e) => f(e, !0))
          .join(``) +
        s;
    }),
    t
  );
}
function Gc(e) {
  return zc(e).kind === `paragraph` ? e : `\\${e}`;
}
function Kc(e) {
  let t = [],
    n = (e, r) => {
      let i = `  `.repeat(r);
      if (e.type === `paragraph`) {
        let n = Wc(e.content);
        t.push(r > 0 ? i + n : n === `` || /^[ \t]/.test(n) ? n : Gc(n));
        return;
      }
      if (e.type === `bulletList` || e.type === `orderedList` || e.type === `taskList`) {
        let a = typeof e.attrs?.start == `number` ? e.attrs.start : 1;
        (e.content ?? []).forEach((o, s) => {
          let c =
              e.type === `orderedList`
                ? `${a + s}. `
                : e.type === `taskList`
                  ? `- [${o.attrs?.checked ? `x` : ` `}] `
                  : `- `,
            [l, ...u] = o.content ?? [],
            d = l?.type === `paragraph` ? Wc(l.content) : ``;
          t.push(i + c + d);
          for (let e of l?.type === `paragraph` ? u : (o.content ?? [])) n(e, r + 1);
        });
        return;
      }
      e.content ? e.content.forEach((e) => n(e, r)) : e.text && t.push(i + e.text);
    };
  return (
    (e.content ?? []).forEach((e) => n(e, 0)),
    t.join(`
`)
  );
}
function qc(e) {
  let t = [],
    n = (e, r) => {
      let i = (e) => (e ?? []).map((e) => e.text ?? ``).join(``);
      if (e.type === `paragraph`) {
        t.push(`  `.repeat(r) + i(e.content));
        return;
      }
      let a = typeof e.attrs?.start == `number` ? e.attrs.start : 1;
      (e.content ?? []).forEach((o, s) => {
        let c =
            e.type === `orderedList`
              ? `${a + s}. `
              : e.type === `taskList`
                ? o.attrs?.checked
                  ? `☑ `
                  : `☐ `
                : `• `,
          [l, ...u] = o.content ?? [];
        t.push(`  `.repeat(r) + c + (l?.type === `paragraph` ? i(l.content) : ``));
        for (let e of l?.type === `paragraph` ? u : (o.content ?? [])) n(e, r + 1);
      });
    };
  return (
    (Vc(e).content ?? []).forEach((e) => n(e, 0)),
    t.join(`
`)
  );
}
function ZO(e) {
  if (!e) return ``;
  let { from: t, to: n, $from: r } = e.state.selection,
    i = e.state.doc
      .textBetween(
        t,
        n,
        `
`,
      )
      .trim();
  if (i)
    return i
      .split(
        `
`,
      )[0]
      .slice(0, 140);
  let a = r.parent.textContent.trim();
  return a
    ? a.slice(0, 140)
    : (
        e
          .getText({
            blockSeparator: `
`,
          })
          .split(
            `
`,
          )
          .find((e) => e.trim()) ?? ``
      )
        .trim()
        .slice(0, 140);
}



var tk = 6e4,
  nk = {
    onMouseDown: () => void u.takeFocus(),
    onFocus: () => useIslandStore.setState({ holdOpen: !0 }),
    onBlur: () => useIslandStore.setState({ holdOpen: !1 }),
  };
function rk() {
  let e = wt((e) => e.timer),
    t = Xt(e);
  an(t === `running`, 200);
  let [n, r] = (0, ReactRuntime.useState)(null),
    [i, a] = (0, ReactRuntime.useState)(!1),
    { start: s, pause: c, resume: l, add: d, reset: f, dismiss: p } = wt.getState();
  ((0, ReactRuntime.useEffect)(() => {
    t !== `idle` && r(null);
  }, [t]),
    (0, ReactRuntime.useEffect)(() => {
      if (n !== null) return () => useIslandStore.setState({ holdOpen: !1 });
    }, [n === null]));
  let m = Date.now(),
    h = Mt(e, m),
    g = t === `idle` ? 1 : e.total > 0 ? Math.min(1, h / e.total) : 0,
    _ = Fn(t === `idle` ? e.base : bt(e, m)),
    v = 2 * Math.PI * 37,
    y = e.endsAt === null ? null : new Date(e.endsAt),
    b = () => {
      let e = Ht(n ?? ``);
      if (!e) return a(!0);
      (r(null), s(e));
    },
    x = (e) => {
      (e.key === `Enter` && b(), e.key === `Escape` && (e.stopPropagation(), r(null)));
    },
    S =
      t === `idle`
        ? {
            label: o(`Старт`, `Start`),
            icon: (0, jsxRuntime.jsx)(Ft, { size: 14, fill: `currentColor` }),
            tone: `bg-timer text-island`,
            run: () => s(),
          }
        : t === `running`
          ? {
              label: o(`Пауза`, `Pause`),
              icon: (0, jsxRuntime.jsx)(Nt, { size: 14, fill: `currentColor` }),
              tone: `bg-white/12 text-ink hover:bg-white/18`,
              run: c,
            }
          : t === `paused`
            ? {
                label: o(`Дальше`, `Resume`),
                icon: (0, jsxRuntime.jsx)(Ft, { size: 14, fill: `currentColor` }),
                tone: `bg-timer text-island`,
                run: l,
              }
            : {
                label: o(`Готово`, `Done`),
                icon: (0, jsxRuntime.jsx)(_r, { size: 15 }),
                tone: `bg-white text-black`,
                run: p,
              },
    C = `press h-7 min-w-0 flex-1 rounded-full bg-white/[0.08] px-1.5 text-[11px] font-medium whitespace-nowrap text-ink-2 hover:bg-white/14 hover:text-ink`,
    w = (0, ReactRuntime.useRef)(0);
  return (0, jsxRuntime.jsxs)(`div`, {
    "data-timer": !0,
    "data-timer-phase": t,
    className: `flex shrink-0 flex-col gap-2`,
    children: [
      (0, jsxRuntime.jsxs)(`div`, {
        className: `flex items-center gap-3`,
        children: [
          (0, jsxRuntime.jsxs)(`div`, {
            "data-timer-ring": !0,
            className: `relative size-[84px] shrink-0`,
            onWheel: (e) => {
              if (t !== `idle` || n !== null) return;
              w.current += e.deltaY;
              let r = Math.trunc(w.current / 100);
              if (r === 0) return;
              w.current -= r * 100;
              let i = (e.shiftKey ? 5 : 1) * tk,
                a = wt.getState().timer.base,
                o = Math.min(1440 * tk, Math.max(tk, Math.round(a / tk) * tk - r * i));
              o !== a && f(o);
            },
            children: [
              (0, jsxRuntime.jsxs)(`svg`, {
                width: `84`,
                height: `84`,
                viewBox: `0 0 84 84`,
                className: t === `done` ? `animate-pulse` : ``,
                "aria-hidden": !0,
                children: [
                  (0, jsxRuntime.jsx)(`circle`, {
                    cx: `42`,
                    cy: `42`,
                    r: `37`,
                    fill: `none`,
                    stroke: `color-mix(in srgb, var(--color-ink) 10%, transparent)`,
                    strokeWidth: `6`,
                  }),
                  (0, jsxRuntime.jsx)(`circle`, {
                    cx: `42`,
                    cy: `42`,
                    r: `37`,
                    fill: `none`,
                    stroke: `var(--color-timer)`,
                    strokeOpacity: t === `idle` ? 0.4 : t === `paused` ? 0.6 : 1,
                    strokeWidth: `6`,
                    strokeLinecap: `round`,
                    strokeDasharray: v,
                    strokeDashoffset: t === `done` ? 0 : v * (1 - g),
                    transform: `rotate(-90 42 42)`,
                    style: {
                      transition:
                        t === `running`
                          ? `stroke-dashoffset 0.2s linear`
                          : `stroke-dashoffset 0.35s ease-out`,
                    },
                  }),
                ],
              }),
              (0, jsxRuntime.jsx)(`button`, {
                "data-timer-time": !0,
                disabled: t !== `idle`,
                title:
                  t === `idle`
                    ? o(
                        `Задать своё время · колесо мыши — минуты`,
                        `Set a length of your own · the mouse wheel sets the minutes`,
                      )
                    : void 0,
                onClick: () => {
                  (u.takeFocus(), a(!1), r(``));
                },
                className: `tabular absolute inset-0 grid place-items-center font-semibold ${_.length > 5 ? `text-[14.5px]` : `text-[19px]`} ${t === `done` || (t === `running` && h <= 1e4) ? `text-timer` : t === `paused` ? `text-ink-2` : `text-ink`}`,
                children: _,
              }),
            ],
          }),
          (0, jsxRuntime.jsxs)(`div`, {
            className: `flex min-w-0 flex-1 flex-col gap-1.5`,
            children: [
              (0, jsxRuntime.jsxs)(`button`, {
                "data-timer-main": !0,
                onClick: S.run,
                className: `press flex h-9 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-semibold ${S.tone}`,
                children: [S.icon, S.label],
              }),
              (0, jsxRuntime.jsxs)(`div`, {
                className: `flex gap-1.5`,
                children: [
                  t === `idle` &&
                    (0, jsxRuntime.jsxs)(`button`, {
                      "data-timer-own": !0,
                      className: C,
                      onClick: () => {
                        (u.takeFocus(), a(!1), r(``));
                      },
                      children: [
                        (0, jsxRuntime.jsx)(qo, { size: 11, className: `mr-1 inline -translate-y-px` }),
                        o(`Своё время`, `Custom`),
                      ],
                    }),
                  (t === `running` || t === `paused`) &&
                    (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
                      children: [
                        (0, jsxRuntime.jsx)(`button`, {
                          "data-timer-add": !0,
                          className: C,
                          title: o(`Добавить минуту`, `Add a minute`),
                          onClick: () => d(tk),
                          children: o(`+1 мин`, `+1 min`),
                        }),
                        (0, jsxRuntime.jsx)(`button`, {
                          "data-timer-reset": !0,
                          className: C,
                          title: o(`Сбросить таймер`, `Reset the timer`),
                          onClick: () => f(),
                          children: o(`Сброс`, `Reset`),
                        }),
                      ],
                    }),
                  t === `done` &&
                    (0, jsxRuntime.jsx)(`button`, {
                      "data-timer-again": !0,
                      className: C,
                      onClick: () => s(),
                      children: o(`Ещё раз`, `Again`),
                    }),
                ],
              }),
            ],
          }),
        ],
      }),
      n === null
        ? t === `idle`
          ? (0, jsxRuntime.jsxs)(`div`, {
              className: `flex h-6 gap-1`,
              children: [
                Jt.map((t) =>
                  (0, jsxRuntime.jsx)(
                    `button`,
                    {
                      "data-timer-preset": t,
                      title: o(`Запустить на ${t} мин`, `Start for ${t} min`),
                      onClick: () => s(t * tk),
                      className: `press tabular h-6 min-w-0 flex-1 rounded-full text-[11.5px] font-medium ${e.base === t * tk ? `bg-white/16 text-ink` : `bg-white/[0.07] text-ink-2 hover:bg-white/14 hover:text-ink`}`,
                      children: t,
                    },
                    t,
                  ),
                ),
                (0, jsxRuntime.jsx)(`span`, {
                  className: `self-center pl-0.5 text-[10.5px] text-ink-3`,
                  children: o(`мин`, `min`),
                }),
              ],
            })
          : (0, jsxRuntime.jsxs)(`div`, {
              "data-timer-note": !0,
              className: `flex h-6 items-center truncate px-1 text-[11px] text-ink-3`,
              children: [
                t === `running` &&
                  y &&
                  o(
                    `до ${D(y.getHours(), y.getMinutes())} · всего ${gt(e.total)}`,
                    `until ${D(y.getHours(), y.getMinutes())} · ${gt(e.total)} in all`,
                  ),
                t === `paused` && o(`на паузе · всего ${gt(e.total)}`, `paused · ${gt(e.total)} in all`),
                t === `done` && o(`время вышло · ${gt(e.base)}`, `time is up · ${gt(e.base)}`),
              ],
            })
        : (0, jsxRuntime.jsxs)(`div`, {
            className: `flex h-6 gap-1`,
            children: [
              (0, jsxRuntime.jsx)(`input`, {
                autoFocus: !0,
                "data-timer-input": !0,
                value: n,
                onChange: (e) => {
                  (r(e.target.value), a(!1));
                },
                ...nk,
                onKeyDown: x,
                placeholder: o(`25, 1:30, 90 с, 2 ч`, `25, 1:30, 90 s, 2 h`),
                className: `h-6 min-w-0 flex-1 rounded-full bg-white/[0.09] px-2.5 text-[11.5px] text-ink outline-none placeholder:text-ink-3 ${i ? `ring-1 ring-danger/70` : ``}`,
              }),
              (0, jsxRuntime.jsx)(`button`, {
                title: o(`Запустить`, `Start`),
                onClick: b,
                className: `press grid size-6 shrink-0 place-items-center rounded-full bg-timer text-island`,
                children: (0, jsxRuntime.jsx)(Ft, { size: 11, fill: `currentColor` }),
              }),
              (0, jsxRuntime.jsx)(`button`, {
                title: o(`Отмена`, `Cancel`),
                onClick: () => r(null),
                className: `press grid size-6 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-white/10 hover:text-ink`,
                children: (0, jsxRuntime.jsx)(yr, { size: 12 }),
              }),
            ],
          }),
    ],
  });
}
function ik({ seed: e }) {
  let t = ca((e) => e.list),
    [n, r] = (0, ReactRuntime.useState)(``),
    [i, a] = (0, ReactRuntime.useState)(!1),
    [s, c] = (0, ReactRuntime.useState)(null),
    l = (0, ReactRuntime.useRef)(null);
  (an(t.length > 0, 5e3),
    (0, ReactRuntime.useEffect)(() => {
      e && (r(e.text ? `${e.text} ` : ``), a(!1), c(null), u.takeFocus(), l.current?.focus());
    }, [e?.n]),
    (0, ReactRuntime.useEffect)(() => {
      s !== null && !t.some((e) => e.id === s) && c(null);
    }, [t, s]));
  let d = n.trim(),
    f = d ? $i(d) : null,
    p = (e, t, n) => {
      let i = e.trim() || o(`Напоминание`, `Reminder`);
      (s === null ? ca.getState().add(i, t.getTime(), n) : ca.getState().change(s, i, t.getTime(), n),
        r(``),
        a(!1),
        c(null));
    },
    m = (e) => {
      let n = t.find((t) => t.id === e);
      n && (c(e), a(!1), r(ta(n.text, n.at, n.repeat)), u.takeFocus(), l.current?.focus());
    },
    h = () => {
      (r(``), a(!1), c(null));
    },
    g = [
      [o(`10 мин`, `10 min`), `10`],
      [o(`1 час`, `1 hour`), `60`],
      [o(`Завтра 9:00`, `Tomorrow`), `tomorrow 9:00`],
    ],
    _ = (e) => {
      (e.key === `Enter` && d && (f ? p(f.text, f.at, f.repeat) : a(!0)),
        e.key === `Escape` && (n || s !== null) && (e.stopPropagation(), h()));
    },
    v = Date.now();
  return (0, jsxRuntime.jsxs)(`div`, {
    "data-reminders": !0,
    className: `flex min-h-0 flex-1 flex-col gap-1.5`,
    children: [
      (0, jsxRuntime.jsxs)(`div`, {
        className: `flex shrink-0 items-center gap-1.5 px-1 text-[11.5px] font-semibold text-ink-2`,
        children: [
          (0, jsxRuntime.jsx)(wa, { size: 12 }),
          o(`Напоминания`, `Reminders`),
          t.length > 0 &&
            (0, jsxRuntime.jsx)(`span`, {
              className: `tabular rounded-full bg-white/12 px-1.5 text-[10px] leading-4 text-ink`,
              children: t.length,
            }),
        ],
      }),
      t.length > 0
        ? (0, jsxRuntime.jsx)(`div`, {
            className: `scroll-thin flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto`,
            children: t.map((e) => {
              let t = e.at <= v;
              return (0, jsxRuntime.jsxs)(
                `div`,
                {
                  "data-reminder-row": !0,
                  title: e.text,
                  className: `rise-in group flex h-9 shrink-0 items-center gap-2 rounded-lg px-1.5 hover:bg-white/[0.06] ${s === e.id ? `bg-white/[0.08] ring-1 ring-timer/50 ring-inset` : ``}`,
                  children: [
                    t
                      ? (0, jsxRuntime.jsx)(Ea, { size: 14, className: `shrink-0 text-timer` })
                      : (0, jsxRuntime.jsx)(wa, { size: 14, className: `shrink-0 text-ink-3` }),
                    (0, jsxRuntime.jsxs)(`div`, {
                      className: `min-w-0 flex-1`,
                      children: [
                        (0, jsxRuntime.jsx)(`div`, {
                          className: `truncate text-[12px] leading-[15px] text-ink`,
                          children: e.text,
                        }),
                        (0, jsxRuntime.jsxs)(`div`, {
                          className: `flex items-center gap-1 truncate text-[10.5px] leading-[14px] ${t ? `text-timer` : `text-ink-3`}`,
                          children: [
                            (0, jsxRuntime.jsx)(`span`, { className: `shrink-0`, children: ra(e.at, v) }),
                            e.repeat &&
                              (0, jsxRuntime.jsxs)(`span`, {
                                "data-reminder-repeat": !0,
                                className: `flex min-w-0 items-center gap-0.5`,
                                children: [
                                  `· `,
                                  (0, jsxRuntime.jsx)(Zo, { size: 9, className: `shrink-0` }),
                                  ` `,
                                  (0, jsxRuntime.jsx)(`span`, {
                                    className: `truncate`,
                                    children: Qi(e.repeat),
                                  }),
                                ],
                              }),
                          ],
                        }),
                      ],
                    }),
                    (0, jsxRuntime.jsx)(`button`, {
                      "data-reminder-edit": !0,
                      title: o(`Изменить: текст и время`, `Change: the words and the time`),
                      onClick: () => (s === e.id ? h() : m(e.id)),
                      className: `press hidden size-6 shrink-0 place-items-center rounded-md text-ink-3 group-hover:grid hover:bg-white/10 hover:text-ink`,
                      children: (0, jsxRuntime.jsx)(mr, { size: 12 }),
                    }),
                    (0, jsxRuntime.jsx)(`button`, {
                      title: o(`Убрать напоминание`, `Remove the reminder`),
                      onClick: () => ca.getState().remove(e.id),
                      className: `press hidden size-6 shrink-0 place-items-center rounded-md text-ink-3 group-hover:grid hover:bg-white/10 hover:text-danger`,
                      children: (0, jsxRuntime.jsx)(yr, { size: 13 }),
                    }),
                  ],
                },
                e.id,
              );
            }),
          })
        : (0, jsxRuntime.jsx)(`div`, {
            "data-reminders-empty": !0,
            className: `grid min-h-0 flex-1 place-items-center px-2 text-center text-[11px] leading-snug text-ink-3`,
            children: o(
              `Напиши ниже, о чём и когда: «позвонить маме завтра в 9», «таблетки каждый день в 23:00», «через 20 минут выключить плиту».`,
              `Type below what and when: “call mum tomorrow at 9”, “pills every day at 23:00”, “in 20 minutes turn the stove off”.`,
            ),
          }),
      (0, jsxRuntime.jsx)(`input`, {
        ref: l,
        "data-reminder-input": !0,
        value: n,
        onChange: (e) => {
          (r(e.target.value), a(!1));
        },
        ...nk,
        onKeyDown: _,
        placeholder: o(`Позвонить маме завтра в 9`, `Call mum tomorrow at 9`),
        className: `h-8 shrink-0 rounded-lg bg-white/[0.07] px-2.5 text-[12px] text-ink outline-none placeholder:text-ink-3 focus:bg-white/[0.11] ${i && !f ? `ring-1 ring-danger/70` : ``}`,
      }),
      d &&
        (0, jsxRuntime.jsx)(`div`, {
          className: `flex h-[22px] shrink-0 items-center gap-1 px-0.5 text-[10.5px] text-ink-3`,
          children: f
            ? (0, jsxRuntime.jsxs)(`button`, {
                "data-reminder-read": !0,
                title:
                  s === null
                    ? o(`Добавить напоминание`, `Add the reminder`)
                    : o(`Сохранить изменение`, `Save the change`),
                onClick: () => p(f.text, f.at, f.repeat),
                className: `press flex h-[22px] min-w-0 items-center gap-1 rounded-full bg-timer/15 px-2 text-[11px] font-medium text-timer`,
                children: [
                  (0, jsxRuntime.jsx)(Xa, { size: 11, className: `shrink-0` }),
                  (0, jsxRuntime.jsxs)(`span`, {
                    className: `truncate`,
                    children: [ra(f.at.getTime(), v), f.repeat && ` · ${Qi(f.repeat)}`],
                  }),
                ],
              })
            : (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
                children: [
                  (0, jsxRuntime.jsx)(`span`, {
                    className: `shrink-0 pr-0.5 ${i ? `text-danger` : ``}`,
                    children: o(`Когда?`, `When?`),
                  }),
                  g.map(([e, t]) =>
                    (0, jsxRuntime.jsx)(
                      `button`,
                      {
                        "data-reminder-quick": !0,
                        onClick: () => {
                          let e = Zi(t),
                            n = e?.at ?? Ki(t);
                          n && p(d, n, e?.repeat);
                        },
                        className: `press h-[22px] shrink-0 rounded-full bg-white/[0.08] px-2 text-[10.5px] font-medium text-ink-2 hover:bg-white/14 hover:text-ink`,
                        children: e,
                      },
                      t,
                    ),
                  ),
                ],
              }),
        }),
    ],
  });
}
function ak({ seed: e }) {
  return (
    (0, ReactRuntime.useEffect)(() => () => useIslandStore.setState({ holdOpen: !1 }), []),
    (0, jsxRuntime.jsxs)(`div`, {
      "data-time-side": !0,
      className: `flex w-[232px] shrink-0 flex-col gap-2.5 rounded-2xl bg-tile p-2.5`,
      children: [
        (0, jsxRuntime.jsx)(rk, {}),
        (0, jsxRuntime.jsx)(`div`, { className: `h-px shrink-0 bg-line` }),
        (0, jsxRuntime.jsx)(ik, { seed: e }),
      ],
    })
  );
}
function ok({ notes: e, mainName: t, onOpen: n, onAdd: r, onRename: i, onRemove: a }) {
  let [s, c] = (0, ReactRuntime.useState)(null),
    [l, d] = (0, ReactRuntime.useState)(null);
  ((0, ReactRuntime.useEffect)(() => {
    if (s)
      return (useIslandStore.setState({ holdOpen: !0 }), () => useIslandStore.setState({ holdOpen: !1 }));
  }, [s !== null]),
    (0, ReactRuntime.useEffect)(() => {
      if (!l) return;
      let e = setTimeout(() => d(null), 3e3);
      return () => clearTimeout(e);
    }, [l]));
  let f = (0, ReactRuntime.useRef)(!1),
    p = (e, t) => {
      (u.takeFocus(), (f.current = !0), c({ id: e, value: t }));
    },
    m = (e = !0) => {
      f.current &&
        ((f.current = !1), e && s?.value.trim() && (s.id === `+` ? r(s.value) : i(s.id, s.value)), c(null));
    },
    h = (e) =>
      `press flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-medium ${e ? `bg-white/14 text-ink` : `bg-white/[0.06] text-ink-2 hover:bg-white/10 hover:text-ink`}`,
    g =
      s &&
      (0, jsxRuntime.jsx)(`input`, {
        autoFocus: !0,
        value: s.value,
        maxLength: 24,
        onChange: (e) => c({ ...s, value: e.target.value }),
        onMouseDown: () => void u.takeFocus(),
        onBlur: () => m(),
        onKeyDown: (e) => {
          (e.key === `Enter` && m(), e.key === `Escape` && (e.stopPropagation(), m(!1)));
        },
        placeholder: o(`Название папки`, `Folder name`),
        className: `h-6 w-[132px] shrink-0 rounded-full bg-white/[0.11] px-2.5 text-[11.5px] text-ink outline-none placeholder:text-ink-3`,
      });
  return (0, jsxRuntime.jsxs)(`div`, {
    "data-note-folders": !0,
    className: `scroll-none flex h-6 shrink-0 items-center gap-1 overflow-x-auto`,
    children: [
      (0, jsxRuntime.jsx)(`button`, { className: h(e.current === ``), onClick: () => n(``), children: t }),
      e.folders.map((t) =>
        s?.id === t.id
          ? (0, jsxRuntime.jsx)(`span`, { children: g }, t.id)
          : l === t.id
            ? (0, jsxRuntime.jsx)(
                `button`,
                {
                  title: o(`Папка удалится вместе с текстом`, `The folder goes with what is written in it`),
                  className: `press flex h-6 shrink-0 items-center rounded-full bg-danger/20 px-2.5 text-[11.5px] font-medium text-danger`,
                  onClick: () => {
                    (d(null), a(t.id));
                  },
                  children: o(`Удалить?`, `Delete?`),
                },
                t.id,
              )
            : (0, jsxRuntime.jsxs)(
                `button`,
                {
                  title:
                    e.current === t.id ? o(`Двойной клик: переименовать`, `Double click: rename`) : void 0,
                  className: h(e.current === t.id),
                  onClick: () => n(t.id),
                  onDoubleClick: () => p(t.id, t.name),
                  children: [
                    (0, jsxRuntime.jsx)(`span`, { className: `max-w-[140px] truncate`, children: t.name }),
                    e.current === t.id &&
                      (0, jsxRuntime.jsx)(`span`, {
                        role: `button`,
                        title: o(`Удалить папку`, `Delete the folder`),
                        className: `-mr-1 grid size-4 place-items-center rounded-full text-ink-3 hover:bg-white/15 hover:text-danger`,
                        onClick: (e) => {
                          (e.stopPropagation(), d(t.id));
                        },
                        onDoubleClick: (e) => e.stopPropagation(),
                        children: (0, jsxRuntime.jsx)(yr, { size: 11 }),
                      }),
                  ],
                },
                t.id,
              ),
      ),
      s?.id === `+`
        ? g
        : e.folders.length < 12 &&
          (0, jsxRuntime.jsx)(`button`, {
            title: o(`Новая папка`, `New folder`),
            className: `press grid size-6 shrink-0 place-items-center rounded-full bg-white/[0.06] text-ink-3 hover:bg-white/10 hover:text-ink`,
            onClick: () => p(`+`, ``),
            children: (0, jsxRuntime.jsx)(Ue, { size: 13 }),
          }),
    ],
  });
}
function sk() {
  let [e, t] = (0, ReactRuntime.useState)(null),
    [n, r] = (0, ReactRuntime.useState)(null),
    [i, a] = (0, ReactRuntime.useState)(!0),
    [s, c] = (0, ReactRuntime.useState)(null),
    l = (0, ReactRuntime.useRef)(void 0),
    d = (0, ReactRuntime.useRef)({}),
    f = () => {
      (clearTimeout(l.current), (l.current = void 0));
      let e = d.current;
      return (
        (d.current = {}),
        Promise.all([e.main !== void 0 && u.noteSet(e.main), e.notes && u.noteFoldersSet(Tc(e.notes))])
      );
    };
  if (
    ((0, ReactRuntime.useEffect)(
      () => (
        Promise.all([u.noteGet(), u.noteFoldersGet()]).then(([e, n]) => {
          (t(e), r(wc(n)));
        }),
        () => {
          l.current && f();
        }
      ),
      [],
    ),
    e === null || n === null)
  )
    return null;
  let p = o(`Заметка`, `Note`),
    m = n.current === `` ? e : (n.folders.find((e) => e.id === n.current)?.text ?? ``),
    h = () => {
      (a(!1), clearTimeout(l.current), (l.current = setTimeout(() => void f().then(() => a(!0)), 400)));
    },
    g = (e) => {
      if (n.current === ``) (t(e), (d.current.main = e));
      else {
        let t = Ac(n, n.current, e);
        (r(t), (d.current.notes = t));
      }
      h();
    },
    _ = (e) => {
      e !== n && (r(e), (d.current.notes = e), h());
    },
    v = qc(m),
    y = Array.from(v).length;
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `flex h-full gap-2`,
    children: [
      (0, jsxRuntime.jsxs)(`div`, {
        className: `flex h-full min-w-0 flex-1 flex-col gap-1.5`,
        children: [
          (0, jsxRuntime.jsx)(ok, {
            notes: n,
            mainName: p,
            onOpen: (e) => _(jc(n, e)),
            onAdd: (e) =>
              _(Dc(n, e, p, Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36))),
            onRename: (e, t) => _(Oc(n, e, t, p)),
            onRemove: (e) => _(kc(n, e)),
          }),
          (0, jsxRuntime.jsx)(
            ek,
            {
              text: m,
              onChange: g,
              placeholder: o(
                `Пиши сюда что угодно: номер заказа, список дел, кусок кода. Сохраняется само.`,
                `Write anything here: an order number, a to-do list, a code snippet. It saves itself.`,
              ),
              footer: (e) =>
                (0, jsxRuntime.jsxs)(`div`, {
                  className: `flex shrink-0 items-center gap-1`,
                  children: [
                    (0, jsxRuntime.jsx)(`span`, {
                      "data-note-saved": String(i),
                      title: i
                        ? o(`Сохранено · ${y} симв.`, `Saved · ${y} chars`)
                        : o(`Сохраняю…`, `Saving…`),
                      className: `grid size-6 place-items-center`,
                      children: i
                        ? (0, jsxRuntime.jsx)(_r, { size: 12, className: `pop-in text-ok` })
                        : (0, jsxRuntime.jsx)(`span`, {
                            className: `size-1.5 animate-pulse rounded-full bg-ink-3`,
                          }),
                    }),
                    (0, jsxRuntime.jsxs)(`button`, {
                      "data-note-remind": !0,
                      title: o(
                        `Напомнить о выделенном или о строке под курсором: она встанет в поле справа, останется дописать время`,
                        `Remind me about the selection or the line under the caret: it lands in the field on the right, the time is left to add`,
                      ),
                      onMouseDown: (e) => e.preventDefault(),
                      onClick: () => c({ text: ZO(e), n: (s?.n ?? 0) + 1 }),
                      className: `press flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-ink-3 hover:bg-tile hover:text-ink`,
                      children: [(0, jsxRuntime.jsx)(Sa, { size: 13 }), o(`Напомнить`, `Remind`)],
                    }),
                    (0, jsxRuntime.jsx)(`button`, {
                      "data-note-export": !0,
                      title: o(`Экспортировать в Obsidian`, `Export to Obsidian`),
                      onMouseDown: (e) => e.preventDefault(),
                      onClick: () =>
                        void f()
                          .then(() => import(`./../components/woods-extensions.js`))
                          .then((e) =>
                            e.exportNote({
                              id: n.current || null,
                              title: n.current ? n.folders.find((e) => e.id === n.current)?.name : void 0,
                              text: m,
                            }),
                          )
                          .then(() =>
                            useIslandStore
                              .getState()
                              .pushPeek({ kind: `done`, label: o(`Заметка в Obsidian`, `Note exported`) }),
                          )
                          .catch((e) =>
                            useIslandStore.getState().pushPeek({ kind: `error`, message: String(e) }),
                          ),
                      className: `press flex h-6 items-center rounded-md px-1.5 text-[11px] text-ink-3 hover:bg-tile hover:text-ink`,
                      children: o(`В Obsidian`, `To Obsidian`),
                    }),
                    (0, jsxRuntime.jsx)(`button`, {
                      title: o(`Скопировать всё`, `Copy all`),
                      onClick: () =>
                        void u
                          .clipSetText(v)
                          .then(() =>
                            useIslandStore
                              .getState()
                              .pushPeek({ kind: `done`, label: o(`Заметка в буфере`, `Note copied`) }),
                          ),
                      className: `press grid size-6 place-items-center rounded-md text-ink-3 hover:bg-tile hover:text-ink`,
                      children: (0, jsxRuntime.jsx)(A, { size: 13 }),
                    }),
                    (0, jsxRuntime.jsx)(`button`, {
                      title: o(`Очистить`, `Clear`),
                      onClick: () => g(``),
                      className: `press grid size-6 place-items-center rounded-md text-ink-3 hover:bg-tile hover:text-danger`,
                      children: (0, jsxRuntime.jsx)(Se, { size: 13 }),
                    }),
                  ],
                }),
            },
            n.current,
          ),
        ],
      }),
      (0, jsxRuntime.jsx)(ak, { seed: s }),
    ],
  });
}
function ck({ feature: e }) {
  return (0, jsxRuntime.jsx)(`div`, {
    className: `grid h-full place-items-center`,
    children: (0, jsxRuntime.jsxs)(`div`, {
      className: `flex w-[430px] flex-col gap-3 rounded-2xl bg-tile p-4`,
      children: [
        (0, jsxRuntime.jsxs)(`div`, {
          className: `flex items-center gap-2.5`,
          children: [
            (0, jsxRuntime.jsx)(`span`, {
              className: `grid size-9 shrink-0 place-items-center rounded-full bg-[#8ea2ff]/18 text-accent-ink`,
              children: (0, jsxRuntime.jsx)(fr, { size: 17 }),
            }),
            (0, jsxRuntime.jsxs)(`div`, {
              className: `min-w-0`,
              children: [
                (0, jsxRuntime.jsx)(`div`, {
                  className: `text-[13.5px] font-semibold text-ink`,
                  children: Xn(e),
                }),
                (0, jsxRuntime.jsx)(`div`, {
                  className: `text-[12px] text-ink-3`,
                  children: o(`Покупается один раз и остаётся навсегда`, `Bought once, kept for good`),
                }),
              ],
            }),
          ],
        }),
        (0, jsxRuntime.jsx)(`ul`, {
          className: `grid grid-cols-2 gap-x-3 gap-y-1.5`,
          children: Wn().map((e) =>
            (0, jsxRuntime.jsxs)(
              `li`,
              {
                className: `flex items-start gap-1.5 text-[11.5px] leading-snug text-ink-2`,
                children: [
                  (0, jsxRuntime.jsx)(_r, { size: 12, className: `mt-[3px] shrink-0 text-accent-ink` }),
                  e,
                ],
              },
              e,
            ),
          ),
        }),
        (0, jsxRuntime.jsxs)(`div`, {
          className: `flex gap-2`,
          children: [
            (0, jsxRuntime.jsx)(`button`, {
              onClick: () => void u.openPath(zn()),
              className: `press h-8 flex-1 rounded-lg bg-[#8ea2ff] text-[12.5px] font-semibold text-neutral-950 hover:bg-[#a9b8ff]`,
              children: o(`Купить за ${$n()}`, `Buy for ${$n()}`),
            }),
            (0, jsxRuntime.jsx)(`button`, {
              onClick: () => {
                (useIslandStore.getState().close(), u.openSettings());
              },
              className: `press h-8 flex-1 rounded-lg bg-white/10 text-[12.5px] font-medium text-ink hover:bg-white/15`,
              children: o(`У меня есть ключ`, `I have a key`),
            }),
          ],
        }),
      ],
    }),
  });
}
async function lk(e, t) {
  let n = new i();
  (t && (n.onmessage = t),
    await f(`plugin:drag|start_drag`, {
      item: e.item,
      image: e.icon,
      options: { mode: e.mode },
      onEvent: n,
    }));
}
var uk = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=`;
async function dk(e, t) {
  if (e.length === 0) return;
  let n = t && t.startsWith(`data:image/png`) ? t : uk;
  useIslandStore.setState({ draggingOut: !0 });
  try {
    await lk({ item: e, icon: n }, () => useIslandStore.setState({ draggingOut: !1 }));
  } finally {
    useIslandStore.setState({ draggingOut: !1 });
  }
}
function fk(e, t) {
  let n = (0, ReactRuntime.useRef)(null);
  return {
    onPointerDown: (e) => {
      e.button === 0 && (n.current = { x: e.clientX, y: e.clientY });
    },
    onPointerMove: (r) => {
      let i = n.current;
      if (!i || !(r.buttons & 1)) {
        n.current = null;
        return;
      }
      Math.hypot(r.clientX - i.x, r.clientY - i.y) > 5 && ((n.current = null), dk(e(), t));
    },
    onPointerUp: () => {
      n.current = null;
    },
  };
}
function pk({ item: e }) {
  let t = fk(() => [e.path], e.icon);
  return (0, jsxRuntime.jsxs)(`div`, {
    ...t,
    onDoubleClick: () => void u.openPath(e.path),
    title: `${e.path}\n${o(`Перетащи наружу · двойной клик — открыть`, `Drag it out · double-click to open`)}`,
    className: `group relative flex h-[104px] w-[92px] shrink-0 cursor-grab flex-col items-center gap-1.5 rounded-2xl p-2 pt-3 hover:bg-tile active:cursor-grabbing ${e.exists ? `` : `opacity-40`}`,
    children: [
      e.icon
        ? (0, jsxRuntime.jsx)(`img`, {
            src: e.icon,
            alt: ``,
            draggable: !1,
            className: `size-11 rounded-md object-contain`,
          })
        : (0, jsxRuntime.jsx)(`div`, {
            className: `grid size-11 place-items-center text-ink-3`,
            children: (0, jsxRuntime.jsx)(io, { size: 28 }),
          }),
      (0, jsxRuntime.jsx)(`div`, {
        className: `line-clamp-2 w-full text-center text-[11px] leading-tight break-all text-ink`,
        children: e.name,
      }),
      (0, jsxRuntime.jsx)(`div`, {
        className: `text-[10px] text-ink-3`,
        children: e.exists ? dr(e.size) : o(`нет файла`, `missing`),
      }),
      (0, jsxRuntime.jsxs)(`div`, {
        className: `absolute top-1 right-1 hidden gap-0.5 group-hover:flex`,
        children: [
          (0, jsxRuntime.jsx)(`button`, {
            title: o(`Показать в папке`, `Show in folder`),
            onPointerDown: (e) => e.stopPropagation(),
            onClick: () => void u.openPath(e.path, !0),
            className: `on-dark press grid size-5 place-items-center rounded-full bg-neutral-800 text-ink-2 hover:text-ink`,
            children: (0, jsxRuntime.jsx)(Te, { size: 11 }),
          }),
          (0, jsxRuntime.jsx)(`button`, {
            title: o(`Убрать с полки`, `Remove from the shelf`),
            onPointerDown: (e) => e.stopPropagation(),
            onClick: () => void u.shelfRemove(e.id).then((e) => useIslandStore.setState({ shelf: e })),
            className: `on-dark press grid size-5 place-items-center rounded-full bg-neutral-800 text-ink-2 hover:bg-danger hover:text-white`,
            children: (0, jsxRuntime.jsx)(yr, { size: 11, strokeWidth: 3 }),
          }),
        ],
      }),
    ],
  });
}
function mk() {
  let e = useIslandStore((e) => e.shelf),
    t = e.filter((e) => e.exists),
    n = fk(() => t.map((e) => e.path), t[0]?.icon);
  return e.length === 0
    ? (0, jsxRuntime.jsx)(Ze, {
        icon: (0, jsxRuntime.jsx)(Hn, { size: 22 }),
        title: o(`Полка пуста`, `The shelf is empty`),
        hint: o(
          `Перетащи файлы на остров — они полежат здесь, пока ты не вытащишь их в нужное окно`,
          `Drop files on the island and they wait here until you drag them into the right window`,
        ),
      })
    : (0, jsxRuntime.jsxs)(`div`, {
        className: `flex h-full flex-col gap-2`,
        children: [
          (0, jsxRuntime.jsxs)(`div`, {
            className: `flex items-center gap-2`,
            children: [
              (0, jsxRuntime.jsxs)(`div`, {
                ...n,
                title: o(`Потяни, чтобы перетащить все файлы сразу`, `Drag to move all files at once`),
                className: `press flex h-9 cursor-grab items-center gap-1.5 rounded-xl bg-tile pr-3 pl-2 text-[12.5px] font-medium text-ink hover:bg-tile-hover active:cursor-grabbing`,
                children: [
                  (0, jsxRuntime.jsx)(po, { size: 15, className: `text-ink-3` }),
                  o(`Перетащить все (${t.length})`, `Drag all (${t.length})`),
                ],
              }),
              (0, jsxRuntime.jsx)(`div`, { className: `flex-1` }),
              (0, jsxRuntime.jsxs)(`button`, {
                className: `press flex h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] text-ink-3 hover:bg-tile hover:text-danger`,
                onClick: () => void u.shelfClear().then((e) => useIslandStore.setState({ shelf: e })),
                children: [(0, jsxRuntime.jsx)(Se, { size: 14 }), o(`Очистить`, `Clear`)],
              }),
            ],
          }),
          (0, jsxRuntime.jsx)(`div`, {
            className: `scroll-thin -mx-1 flex min-h-0 flex-1 flex-wrap content-start gap-0.5 overflow-y-auto`,
            children: e.map((e, t) =>
              (0, jsxRuntime.jsx)(
                `div`,
                {
                  className: `pop-in`,
                  style: { animationDelay: `${Math.min(t, 10) * 22}ms` },
                  children: (0, jsxRuntime.jsx)(pk, { item: e }),
                },
                e.id,
              ),
            ),
          }),
        ],
      });
}
var hk = s((e, t) => {
    t.exports = function () {
      return typeof Promise == `function` && Promise.prototype && Promise.prototype.then;
    };
  }),
  gk = s((e) => {
    var t,
      n = [
        0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466, 532, 581, 655, 733, 815, 901, 991, 1085,
        1156, 1258, 1364, 1474, 1588, 1706, 1828, 1921, 2051, 2185, 2323, 2465, 2611, 2761, 2876, 3034, 3196,
        3362, 3532, 3706,
      ];
    ((e.getSymbolSize = function (e) {
      if (!e) throw Error(`"version" cannot be null or undefined`);
      if (e < 1 || e > 40) throw Error(`"version" should be in range from 1 to 40`);
      return e * 4 + 17;
    }),
      (e.getSymbolTotalCodewords = function (e) {
        return n[e];
      }),
      (e.getBCHDigit = function (e) {
        let t = 0;
        for (; e !== 0; ) (t++, (e >>>= 1));
        return t;
      }),
      (e.setToSJISFunction = function (e) {
        if (typeof e != `function`) throw Error(`"toSJISFunc" is not a valid function.`);
        t = e;
      }),
      (e.isKanjiModeEnabled = function () {
        return t !== void 0;
      }),
      (e.toSJIS = function (e) {
        return t(e);
      }));
  }),
  _k = s((e) => {
    ((e.L = { bit: 1 }), (e.M = { bit: 0 }), (e.Q = { bit: 3 }), (e.H = { bit: 2 }));
    function t(t) {
      if (typeof t != `string`) throw Error(`Param is not a string`);
      switch (t.toLowerCase()) {
        case `l`:
        case `low`:
          return e.L;
        case `m`:
        case `medium`:
          return e.M;
        case `q`:
        case `quartile`:
          return e.Q;
        case `h`:
        case `high`:
          return e.H;
        default:
          throw Error(`Unknown EC Level: ` + t);
      }
    }
    ((e.isValid = function (e) {
      return e && e.bit !== void 0 && e.bit >= 0 && e.bit < 4;
    }),
      (e.from = function (n, r) {
        if (e.isValid(n)) return n;
        try {
          return t(n);
        } catch {
          return r;
        }
      }));
  }),
  vk = s((e, t) => {
    function n() {
      ((this.buffer = []), (this.length = 0));
    }
    ((n.prototype = {
      get: function (e) {
        let t = Math.floor(e / 8);
        return ((this.buffer[t] >>> (7 - (e % 8))) & 1) == 1;
      },
      put: function (e, t) {
        for (let n = 0; n < t; n++) this.putBit(((e >>> (t - n - 1)) & 1) == 1);
      },
      getLengthInBits: function () {
        return this.length;
      },
      putBit: function (e) {
        let t = Math.floor(this.length / 8);
        (this.buffer.length <= t && this.buffer.push(0),
          e && (this.buffer[t] |= 128 >>> this.length % 8),
          this.length++);
      },
    }),
      (t.exports = n));
  }),
  yk = s((e, t) => {
    function n(e) {
      if (!e || e < 1) throw Error(`BitMatrix size must be defined and greater than 0`);
      ((this.size = e), (this.data = new Uint8Array(e * e)), (this.reservedBit = new Uint8Array(e * e)));
    }
    ((n.prototype.set = function (e, t, n, r) {
      let i = e * this.size + t;
      ((this.data[i] = n), r && (this.reservedBit[i] = !0));
    }),
      (n.prototype.get = function (e, t) {
        return this.data[e * this.size + t];
      }),
      (n.prototype.xor = function (e, t, n) {
        this.data[e * this.size + t] ^= n;
      }),
      (n.prototype.isReserved = function (e, t) {
        return this.reservedBit[e * this.size + t];
      }),
      (t.exports = n));
  }),
  bk = s((e) => {
    var t = gk().getSymbolSize;
    ((e.getRowColCoords = function (e) {
      if (e === 1) return [];
      let n = Math.floor(e / 7) + 2,
        r = t(e),
        i = r === 145 ? 26 : Math.ceil((r - 13) / (2 * n - 2)) * 2,
        a = [r - 7];
      for (let e = 1; e < n - 1; e++) a[e] = a[e - 1] - i;
      return (a.push(6), a.reverse());
    }),
      (e.getPositions = function (t) {
        let n = [],
          r = e.getRowColCoords(t),
          i = r.length;
        for (let e = 0; e < i; e++)
          for (let t = 0; t < i; t++)
            (e === 0 && t === 0) ||
              (e === 0 && t === i - 1) ||
              (e === i - 1 && t === 0) ||
              n.push([r[e], r[t]]);
        return n;
      }));
  }),
  xk = s((e) => {
    var t = gk().getSymbolSize,
      n = 7;
    e.getPositions = function (e) {
      let r = t(e);
      return [
        [0, 0],
        [r - n, 0],
        [0, r - n],
      ];
    };
  }),
  Sk = s((e) => {
    e.Patterns = {
      PATTERN000: 0,
      PATTERN001: 1,
      PATTERN010: 2,
      PATTERN011: 3,
      PATTERN100: 4,
      PATTERN101: 5,
      PATTERN110: 6,
      PATTERN111: 7,
    };
    var t = { N1: 3, N2: 3, N3: 40, N4: 10 };
    ((e.isValid = function (e) {
      return e != null && e !== `` && !isNaN(e) && e >= 0 && e <= 7;
    }),
      (e.from = function (t) {
        return e.isValid(t) ? parseInt(t, 10) : void 0;
      }),
      (e.getPenaltyN1 = function (e) {
        let n = e.size,
          r = 0,
          i = 0,
          a = 0,
          o = null,
          s = null;
        for (let c = 0; c < n; c++) {
          ((i = a = 0), (o = s = null));
          for (let l = 0; l < n; l++) {
            let n = e.get(c, l);
            (n === o ? i++ : (i >= 5 && (r += t.N1 + (i - 5)), (o = n), (i = 1)),
              (n = e.get(l, c)),
              n === s ? a++ : (a >= 5 && (r += t.N1 + (a - 5)), (s = n), (a = 1)));
          }
          (i >= 5 && (r += t.N1 + (i - 5)), a >= 5 && (r += t.N1 + (a - 5)));
        }
        return r;
      }),
      (e.getPenaltyN2 = function (e) {
        let n = e.size,
          r = 0;
        for (let t = 0; t < n - 1; t++)
          for (let i = 0; i < n - 1; i++) {
            let n = e.get(t, i) + e.get(t, i + 1) + e.get(t + 1, i) + e.get(t + 1, i + 1);
            (n === 4 || n === 0) && r++;
          }
        return r * t.N2;
      }),
      (e.getPenaltyN3 = function (e) {
        let n = e.size,
          r = 0,
          i = 0,
          a = 0;
        for (let t = 0; t < n; t++) {
          i = a = 0;
          for (let o = 0; o < n; o++)
            ((i = ((i << 1) & 2047) | e.get(t, o)),
              o >= 10 && (i === 1488 || i === 93) && r++,
              (a = ((a << 1) & 2047) | e.get(o, t)),
              o >= 10 && (a === 1488 || a === 93) && r++);
        }
        return r * t.N3;
      }),
      (e.getPenaltyN4 = function (e) {
        let n = 0,
          r = e.data.length;
        for (let t = 0; t < r; t++) n += e.data[t];
        return Math.abs(Math.ceil((n * 100) / r / 5) - 10) * t.N4;
      }));
    function n(t, n, r) {
      switch (t) {
        case e.Patterns.PATTERN000:
          return (n + r) % 2 == 0;
        case e.Patterns.PATTERN001:
          return n % 2 == 0;
        case e.Patterns.PATTERN010:
          return r % 3 == 0;
        case e.Patterns.PATTERN011:
          return (n + r) % 3 == 0;
        case e.Patterns.PATTERN100:
          return (Math.floor(n / 2) + Math.floor(r / 3)) % 2 == 0;
        case e.Patterns.PATTERN101:
          return ((n * r) % 2) + ((n * r) % 3) == 0;
        case e.Patterns.PATTERN110:
          return (((n * r) % 2) + ((n * r) % 3)) % 2 == 0;
        case e.Patterns.PATTERN111:
          return (((n * r) % 3) + ((n + r) % 2)) % 2 == 0;
        default:
          throw Error(`bad maskPattern:` + t);
      }
    }
    ((e.applyMask = function (e, t) {
      let r = t.size;
      for (let i = 0; i < r; i++) for (let a = 0; a < r; a++) t.isReserved(a, i) || t.xor(a, i, n(e, a, i));
    }),
      (e.getBestMask = function (t, n) {
        let r = Object.keys(e.Patterns).length,
          i = 0,
          a = 1 / 0;
        for (let o = 0; o < r; o++) {
          (n(o), e.applyMask(o, t));
          let r = e.getPenaltyN1(t) + e.getPenaltyN2(t) + e.getPenaltyN3(t) + e.getPenaltyN4(t);
          (e.applyMask(o, t), r < a && ((a = r), (i = o)));
        }
        return i;
      }));
  }),
  Ck = s((e) => {
    var t = _k(),
      n = [
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1, 2, 2, 4, 1, 2, 4, 4, 2, 4, 4, 4, 2, 4, 6, 5, 2, 4, 6, 6, 2, 5,
        8, 8, 4, 5, 8, 8, 4, 5, 8, 11, 4, 8, 10, 11, 4, 9, 12, 16, 4, 9, 16, 16, 6, 10, 12, 18, 6, 10, 17, 16,
        6, 11, 16, 19, 6, 13, 18, 21, 7, 14, 21, 25, 8, 16, 20, 25, 8, 17, 23, 25, 9, 17, 23, 34, 9, 18, 25,
        30, 10, 20, 27, 32, 12, 21, 29, 35, 12, 23, 34, 37, 12, 25, 34, 40, 13, 26, 35, 42, 14, 28, 38, 45,
        15, 29, 40, 48, 16, 31, 43, 51, 17, 33, 45, 54, 18, 35, 48, 57, 19, 37, 51, 60, 19, 38, 53, 63, 20,
        40, 56, 66, 21, 43, 59, 70, 22, 45, 62, 74, 24, 47, 65, 77, 25, 49, 68, 81,
      ],
      r = [
        7, 10, 13, 17, 10, 16, 22, 28, 15, 26, 36, 44, 20, 36, 52, 64, 26, 48, 72, 88, 36, 64, 96, 112, 40,
        72, 108, 130, 48, 88, 132, 156, 60, 110, 160, 192, 72, 130, 192, 224, 80, 150, 224, 264, 96, 176, 260,
        308, 104, 198, 288, 352, 120, 216, 320, 384, 132, 240, 360, 432, 144, 280, 408, 480, 168, 308, 448,
        532, 180, 338, 504, 588, 196, 364, 546, 650, 224, 416, 600, 700, 224, 442, 644, 750, 252, 476, 690,
        816, 270, 504, 750, 900, 300, 560, 810, 960, 312, 588, 870, 1050, 336, 644, 952, 1110, 360, 700, 1020,
        1200, 390, 728, 1050, 1260, 420, 784, 1140, 1350, 450, 812, 1200, 1440, 480, 868, 1290, 1530, 510,
        924, 1350, 1620, 540, 980, 1440, 1710, 570, 1036, 1530, 1800, 570, 1064, 1590, 1890, 600, 1120, 1680,
        1980, 630, 1204, 1770, 2100, 660, 1260, 1860, 2220, 720, 1316, 1950, 2310, 750, 1372, 2040, 2430,
      ];
    ((e.getBlocksCount = function (e, r) {
      switch (r) {
        case t.L:
          return n[(e - 1) * 4 + 0];
        case t.M:
          return n[(e - 1) * 4 + 1];
        case t.Q:
          return n[(e - 1) * 4 + 2];
        case t.H:
          return n[(e - 1) * 4 + 3];
        default:
          return;
      }
    }),
      (e.getTotalCodewordsCount = function (e, n) {
        switch (n) {
          case t.L:
            return r[(e - 1) * 4 + 0];
          case t.M:
            return r[(e - 1) * 4 + 1];
          case t.Q:
            return r[(e - 1) * 4 + 2];
          case t.H:
            return r[(e - 1) * 4 + 3];
          default:
            return;
        }
      }));
  }),
  wk = s((e) => {
    var t = new Uint8Array(512),
      n = new Uint8Array(256);
    ((function () {
      let e = 1;
      for (let r = 0; r < 255; r++) ((t[r] = e), (n[e] = r), (e <<= 1), e & 256 && (e ^= 285));
      for (let e = 255; e < 512; e++) t[e] = t[e - 255];
    })(),
      (e.log = function (e) {
        if (e < 1) throw Error(`log(` + e + `)`);
        return n[e];
      }),
      (e.exp = function (e) {
        return t[e];
      }),
      (e.mul = function (e, r) {
        return e === 0 || r === 0 ? 0 : t[n[e] + n[r]];
      }));
  }),
  Tk = s((e) => {
    var t = wk();
    ((e.mul = function (e, n) {
      let r = new Uint8Array(e.length + n.length - 1);
      for (let i = 0; i < e.length; i++) for (let a = 0; a < n.length; a++) r[i + a] ^= t.mul(e[i], n[a]);
      return r;
    }),
      (e.mod = function (e, n) {
        let r = new Uint8Array(e);
        for (; r.length - n.length >= 0; ) {
          let e = r[0];
          for (let i = 0; i < n.length; i++) r[i] ^= t.mul(n[i], e);
          let i = 0;
          for (; i < r.length && r[i] === 0; ) i++;
          r = r.slice(i);
        }
        return r;
      }),
      (e.generateECPolynomial = function (n) {
        let r = new Uint8Array([1]);
        for (let i = 0; i < n; i++) r = e.mul(r, new Uint8Array([1, t.exp(i)]));
        return r;
      }));
  }),
  Ek = s((e, t) => {
    var n = Tk();
    function r(e) {
      ((this.genPoly = void 0), (this.degree = e), this.degree && this.initialize(this.degree));
    }
    ((r.prototype.initialize = function (e) {
      ((this.degree = e), (this.genPoly = n.generateECPolynomial(this.degree)));
    }),
      (r.prototype.encode = function (e) {
        if (!this.genPoly) throw Error(`Encoder not initialized`);
        let t = new Uint8Array(e.length + this.degree);
        t.set(e);
        let r = n.mod(t, this.genPoly),
          i = this.degree - r.length;
        if (i > 0) {
          let e = new Uint8Array(this.degree);
          return (e.set(r, i), e);
        }
        return r;
      }),
      (t.exports = r));
  }),
  Dk = s((e) => {
    e.isValid = function (e) {
      return !isNaN(e) && e >= 1 && e <= 40;
    };
  }),
  Ok = s((e) => {
    var t = `[0-9]+`,
      n = `[A-Z $%*+\\-./:]+`,
      r = `(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+`;
    r = r.replace(/u/g, `\\u`);
    var i =
      `(?:(?![A-Z0-9 $%*+\\-./:]|` +
      r +
      `)(?:.|[\r
]))+`;
    ((e.KANJI = new RegExp(r, `g`)),
      (e.BYTE_KANJI = RegExp(`[^A-Z0-9 $%*+\\-./:]+`, `g`)),
      (e.BYTE = new RegExp(i, `g`)),
      (e.NUMERIC = new RegExp(t, `g`)),
      (e.ALPHANUMERIC = new RegExp(n, `g`)));
    var a = RegExp(`^` + r + `$`),
      o = RegExp(`^[0-9]+$`),
      s = RegExp(`^[A-Z0-9 $%*+\\-./:]+$`);
    ((e.testKanji = function (e) {
      return a.test(e);
    }),
      (e.testNumeric = function (e) {
        return o.test(e);
      }),
      (e.testAlphanumeric = function (e) {
        return s.test(e);
      }));
  }),
  kk = s((e) => {
    var t = Dk(),
      n = Ok();
    ((e.NUMERIC = { id: `Numeric`, bit: 1, ccBits: [10, 12, 14] }),
      (e.ALPHANUMERIC = { id: `Alphanumeric`, bit: 2, ccBits: [9, 11, 13] }),
      (e.BYTE = { id: `Byte`, bit: 4, ccBits: [8, 16, 16] }),
      (e.KANJI = { id: `Kanji`, bit: 8, ccBits: [8, 10, 12] }),
      (e.MIXED = { bit: -1 }),
      (e.getCharCountIndicator = function (e, n) {
        if (!e.ccBits) throw Error(`Invalid mode: ` + e);
        if (!t.isValid(n)) throw Error(`Invalid version: ` + n);
        return n >= 1 && n < 10 ? e.ccBits[0] : n < 27 ? e.ccBits[1] : e.ccBits[2];
      }),
      (e.getBestModeForData = function (t) {
        return n.testNumeric(t)
          ? e.NUMERIC
          : n.testAlphanumeric(t)
            ? e.ALPHANUMERIC
            : n.testKanji(t)
              ? e.KANJI
              : e.BYTE;
      }),
      (e.toString = function (e) {
        if (e && e.id) return e.id;
        throw Error(`Invalid mode`);
      }),
      (e.isValid = function (e) {
        return e && e.bit && e.ccBits;
      }));
    function r(t) {
      if (typeof t != `string`) throw Error(`Param is not a string`);
      switch (t.toLowerCase()) {
        case `numeric`:
          return e.NUMERIC;
        case `alphanumeric`:
          return e.ALPHANUMERIC;
        case `kanji`:
          return e.KANJI;
        case `byte`:
          return e.BYTE;
        default:
          throw Error(`Unknown mode: ` + t);
      }
    }
    e.from = function (t, n) {
      if (e.isValid(t)) return t;
      try {
        return r(t);
      } catch {
        return n;
      }
    };
  }),
  Ak = s((e) => {
    var t = gk(),
      n = Ck(),
      r = _k(),
      i = kk(),
      a = Dk(),
      o = 7973,
      s = t.getBCHDigit(o);
    function c(t, n, r) {
      for (let i = 1; i <= 40; i++) if (n <= e.getCapacity(i, r, t)) return i;
    }
    function l(e, t) {
      return i.getCharCountIndicator(e, t) + 4;
    }
    function u(e, t) {
      let n = 0;
      return (
        e.forEach(function (e) {
          let r = l(e.mode, t);
          n += r + e.getBitsLength();
        }),
        n
      );
    }
    function d(t, n) {
      for (let r = 1; r <= 40; r++) if (u(t, r) <= e.getCapacity(r, n, i.MIXED)) return r;
    }
    ((e.from = function (e, t) {
      return a.isValid(e) ? parseInt(e, 10) : t;
    }),
      (e.getCapacity = function (e, r, o) {
        if (!a.isValid(e)) throw Error(`Invalid QR Code version`);
        o === void 0 && (o = i.BYTE);
        let s = (t.getSymbolTotalCodewords(e) - n.getTotalCodewordsCount(e, r)) * 8;
        if (o === i.MIXED) return s;
        let c = s - l(o, e);
        switch (o) {
          case i.NUMERIC:
            return Math.floor((c / 10) * 3);
          case i.ALPHANUMERIC:
            return Math.floor((c / 11) * 2);
          case i.KANJI:
            return Math.floor(c / 13);
          case i.BYTE:
          default:
            return Math.floor(c / 8);
        }
      }),
      (e.getBestVersionForData = function (e, t) {
        let n,
          i = r.from(t, r.M);
        if (Array.isArray(e)) {
          if (e.length > 1) return d(e, i);
          if (e.length === 0) return 1;
          n = e[0];
        } else n = e;
        return c(n.mode, n.getLength(), i);
      }),
      (e.getEncodedBits = function (e) {
        if (!a.isValid(e) || e < 7) throw Error(`Invalid QR Code version`);
        let n = e << 12;
        for (; t.getBCHDigit(n) - s >= 0; ) n ^= o << (t.getBCHDigit(n) - s);
        return (e << 12) | n;
      }));
  }),
  jk = s((e) => {
    var t = gk(),
      n = 1335,
      r = 21522,
      i = t.getBCHDigit(n);
    e.getEncodedBits = function (e, a) {
      let o = (e.bit << 3) | a,
        s = o << 10;
      for (; t.getBCHDigit(s) - i >= 0; ) s ^= n << (t.getBCHDigit(s) - i);
      return ((o << 10) | s) ^ r;
    };
  }),
  Mk = s((e, t) => {
    var n = kk();
    function r(e) {
      ((this.mode = n.NUMERIC), (this.data = e.toString()));
    }
    ((r.getBitsLength = function (e) {
      return 10 * Math.floor(e / 3) + (e % 3 ? (e % 3) * 3 + 1 : 0);
    }),
      (r.prototype.getLength = function () {
        return this.data.length;
      }),
      (r.prototype.getBitsLength = function () {
        return r.getBitsLength(this.data.length);
      }),
      (r.prototype.write = function (e) {
        let t, n, r;
        for (t = 0; t + 3 <= this.data.length; t += 3)
          ((n = this.data.substr(t, 3)), (r = parseInt(n, 10)), e.put(r, 10));
        let i = this.data.length - t;
        i > 0 && ((n = this.data.substr(t)), (r = parseInt(n, 10)), e.put(r, i * 3 + 1));
      }),
      (t.exports = r));
  }),
  Nk = s((e, t) => {
    var n = kk(),
      r = `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:`.split(``);
    function i(e) {
      ((this.mode = n.ALPHANUMERIC), (this.data = e));
    }
    ((i.getBitsLength = function (e) {
      return 11 * Math.floor(e / 2) + (e % 2) * 6;
    }),
      (i.prototype.getLength = function () {
        return this.data.length;
      }),
      (i.prototype.getBitsLength = function () {
        return i.getBitsLength(this.data.length);
      }),
      (i.prototype.write = function (e) {
        let t = 0;
        for (; t + 2 <= this.data.length; t += 2) {
          let n = r.indexOf(this.data[t]) * 45;
          ((n += r.indexOf(this.data[t + 1])), e.put(n, 11));
        }
        this.data.length % 2 && e.put(r.indexOf(this.data[t]), 6);
      }),
      (t.exports = i));
  }),
  Pk = s((e, t) => {
    var n = kk();
    function r(e) {
      ((this.mode = n.BYTE),
        (this.data = typeof e == `string` ? new TextEncoder().encode(e) : new Uint8Array(e)));
    }
    ((r.getBitsLength = function (e) {
      return e * 8;
    }),
      (r.prototype.getLength = function () {
        return this.data.length;
      }),
      (r.prototype.getBitsLength = function () {
        return r.getBitsLength(this.data.length);
      }),
      (r.prototype.write = function (e) {
        for (let t = 0, n = this.data.length; t < n; t++) e.put(this.data[t], 8);
      }),
      (t.exports = r));
  }),
  Fk = s((e, t) => {
    var n = kk(),
      r = gk();
    function i(e) {
      ((this.mode = n.KANJI), (this.data = e));
    }
    ((i.getBitsLength = function (e) {
      return e * 13;
    }),
      (i.prototype.getLength = function () {
        return this.data.length;
      }),
      (i.prototype.getBitsLength = function () {
        return i.getBitsLength(this.data.length);
      }),
      (i.prototype.write = function (e) {
        let t = 0;
        for (; t < this.data.length; t++) {
          let n = r.toSJIS(this.data[t]);
          if (n >= 33088 && n <= 40956) n -= 33088;
          else if (n >= 57408 && n <= 60351) n -= 49472;
          else
            throw Error(
              `Invalid SJIS character: ` +
                this.data[t] +
                `
Make sure your charset is UTF-8`,
            );
          ((n = ((n >>> 8) & 255) * 192 + (n & 255)), e.put(n, 13));
        }
      }),
      (t.exports = i));
  }),
  Ik = s((e, t) => {
    var n = {
      single_source_shortest_paths: function (e, t, r) {
        var i = {},
          a = {};
        a[t] = 0;
        var o = n.PriorityQueue.make();
        o.push(t, 0);
        for (var s, c, l, u, d, f, p, m, h; !o.empty(); )
          for (l in ((s = o.pop()), (c = s.value), (u = s.cost), (d = e[c] || {}), d))
            d.hasOwnProperty(l) &&
              ((f = d[l]),
              (p = u + f),
              (m = a[l]),
              (h = a[l] === void 0),
              (h || m > p) && ((a[l] = p), o.push(l, p), (i[l] = c)));
        if (r !== void 0 && a[r] === void 0) {
          var g = [`Could not find a path from `, t, ` to `, r, `.`].join(``);
          throw Error(g);
        }
        return i;
      },
      extract_shortest_path_from_predecessor_list: function (e, t) {
        for (var n = [], r = t; r; ) (n.push(r), e[r], (r = e[r]));
        return (n.reverse(), n);
      },
      find_path: function (e, t, r) {
        var i = n.single_source_shortest_paths(e, t, r);
        return n.extract_shortest_path_from_predecessor_list(i, r);
      },
      PriorityQueue: {
        make: function (e) {
          var t = n.PriorityQueue,
            r = {},
            i;
          for (i in ((e ||= {}), t)) t.hasOwnProperty(i) && (r[i] = t[i]);
          return ((r.queue = []), (r.sorter = e.sorter || t.default_sorter), r);
        },
        default_sorter: function (e, t) {
          return e.cost - t.cost;
        },
        push: function (e, t) {
          var n = { value: e, cost: t };
          (this.queue.push(n), this.queue.sort(this.sorter));
        },
        pop: function () {
          return this.queue.shift();
        },
        empty: function () {
          return this.queue.length === 0;
        },
      },
    };
    t !== void 0 && (t.exports = n);
  }),
  Lk = s((e) => {
    var t = kk(),
      n = Mk(),
      r = Nk(),
      i = Pk(),
      a = Fk(),
      o = Ok(),
      s = gk(),
      c = Ik();
    function l(e) {
      return unescape(encodeURIComponent(e)).length;
    }
    function u(e, t, n) {
      let r = [],
        i;
      for (; (i = e.exec(n)) !== null; ) r.push({ data: i[0], index: i.index, mode: t, length: i[0].length });
      return r;
    }
    function d(e) {
      let n = u(o.NUMERIC, t.NUMERIC, e),
        r = u(o.ALPHANUMERIC, t.ALPHANUMERIC, e),
        i,
        a;
      return (
        s.isKanjiModeEnabled()
          ? ((i = u(o.BYTE, t.BYTE, e)), (a = u(o.KANJI, t.KANJI, e)))
          : ((i = u(o.BYTE_KANJI, t.BYTE, e)), (a = [])),
        n
          .concat(r, i, a)
          .sort(function (e, t) {
            return e.index - t.index;
          })
          .map(function (e) {
            return { data: e.data, mode: e.mode, length: e.length };
          })
      );
    }
    function f(e, o) {
      switch (o) {
        case t.NUMERIC:
          return n.getBitsLength(e);
        case t.ALPHANUMERIC:
          return r.getBitsLength(e);
        case t.KANJI:
          return a.getBitsLength(e);
        case t.BYTE:
          return i.getBitsLength(e);
      }
    }
    function p(e) {
      return e.reduce(function (e, t) {
        let n = e.length - 1 >= 0 ? e[e.length - 1] : null;
        return n && n.mode === t.mode ? ((e[e.length - 1].data += t.data), e) : (e.push(t), e);
      }, []);
    }
    function m(e) {
      let n = [];
      for (let r = 0; r < e.length; r++) {
        let i = e[r];
        switch (i.mode) {
          case t.NUMERIC:
            n.push([
              i,
              { data: i.data, mode: t.ALPHANUMERIC, length: i.length },
              { data: i.data, mode: t.BYTE, length: i.length },
            ]);
            break;
          case t.ALPHANUMERIC:
            n.push([i, { data: i.data, mode: t.BYTE, length: i.length }]);
            break;
          case t.KANJI:
            n.push([i, { data: i.data, mode: t.BYTE, length: l(i.data) }]);
            break;
          case t.BYTE:
            n.push([{ data: i.data, mode: t.BYTE, length: l(i.data) }]);
        }
      }
      return n;
    }
    function h(e, n) {
      let r = {},
        i = { start: {} },
        a = [`start`];
      for (let o = 0; o < e.length; o++) {
        let s = e[o],
          c = [];
        for (let e = 0; e < s.length; e++) {
          let l = s[e],
            u = `` + o + e;
          (c.push(u), (r[u] = { node: l, lastCount: 0 }), (i[u] = {}));
          for (let e = 0; e < a.length; e++) {
            let o = a[e];
            r[o] && r[o].node.mode === l.mode
              ? ((i[o][u] = f(r[o].lastCount + l.length, l.mode) - f(r[o].lastCount, l.mode)),
                (r[o].lastCount += l.length))
              : (r[o] && (r[o].lastCount = l.length),
                (i[o][u] = f(l.length, l.mode) + 4 + t.getCharCountIndicator(l.mode, n)));
          }
        }
        a = c;
      }
      for (let e = 0; e < a.length; e++) i[a[e]].end = 0;
      return { map: i, table: r };
    }
    function g(e, o) {
      let c,
        l = t.getBestModeForData(e);
      if (((c = t.from(o, l)), c !== t.BYTE && c.bit < l.bit))
        throw Error(
          `"` +
            e +
            `" cannot be encoded with mode ` +
            t.toString(c) +
            `.
 Suggested mode is: ` +
            t.toString(l),
        );
      switch ((c === t.KANJI && !s.isKanjiModeEnabled() && (c = t.BYTE), c)) {
        case t.NUMERIC:
          return new n(e);
        case t.ALPHANUMERIC:
          return new r(e);
        case t.KANJI:
          return new a(e);
        case t.BYTE:
          return new i(e);
      }
    }
    ((e.fromArray = function (e) {
      return e.reduce(function (e, t) {
        return (typeof t == `string` ? e.push(g(t, null)) : t.data && e.push(g(t.data, t.mode)), e);
      }, []);
    }),
      (e.fromString = function (t, n) {
        let r = h(m(d(t, s.isKanjiModeEnabled())), n),
          i = c.find_path(r.map, `start`, `end`),
          a = [];
        for (let e = 1; e < i.length - 1; e++) a.push(r.table[i[e]].node);
        return e.fromArray(p(a));
      }),
      (e.rawSplit = function (t) {
        return e.fromArray(d(t, s.isKanjiModeEnabled()));
      }));
  }),
  Rk = s((e) => {
    var t = gk(),
      n = _k(),
      r = vk(),
      i = yk(),
      a = bk(),
      o = xk(),
      s = Sk(),
      c = Ck(),
      l = Ek(),
      u = Ak(),
      d = jk(),
      f = kk(),
      p = Lk();
    function m(e, t) {
      let n = e.size,
        r = o.getPositions(t);
      for (let t = 0; t < r.length; t++) {
        let i = r[t][0],
          a = r[t][1];
        for (let t = -1; t <= 7; t++)
          if (!(i + t <= -1 || n <= i + t))
            for (let r = -1; r <= 7; r++)
              a + r <= -1 ||
                n <= a + r ||
                ((t >= 0 && t <= 6 && (r === 0 || r === 6)) ||
                (r >= 0 && r <= 6 && (t === 0 || t === 6)) ||
                (t >= 2 && t <= 4 && r >= 2 && r <= 4)
                  ? e.set(i + t, a + r, !0, !0)
                  : e.set(i + t, a + r, !1, !0));
      }
    }
    function h(e) {
      let t = e.size;
      for (let n = 8; n < t - 8; n++) {
        let t = n % 2 == 0;
        (e.set(n, 6, t, !0), e.set(6, n, t, !0));
      }
    }
    function g(e, t) {
      let n = a.getPositions(t);
      for (let t = 0; t < n.length; t++) {
        let r = n[t][0],
          i = n[t][1];
        for (let t = -2; t <= 2; t++)
          for (let n = -2; n <= 2; n++)
            t === -2 || t === 2 || n === -2 || n === 2 || (t === 0 && n === 0)
              ? e.set(r + t, i + n, !0, !0)
              : e.set(r + t, i + n, !1, !0);
      }
    }
    function _(e, t) {
      let n = e.size,
        r = u.getEncodedBits(t),
        i,
        a,
        o;
      for (let t = 0; t < 18; t++)
        ((i = Math.floor(t / 3)),
          (a = (t % 3) + n - 8 - 3),
          (o = ((r >> t) & 1) == 1),
          e.set(i, a, o, !0),
          e.set(a, i, o, !0));
    }
    function v(e, t, n) {
      let r = e.size,
        i = d.getEncodedBits(t, n),
        a,
        o;
      for (a = 0; a < 15; a++)
        ((o = ((i >> a) & 1) == 1),
          a < 6 ? e.set(a, 8, o, !0) : a < 8 ? e.set(a + 1, 8, o, !0) : e.set(r - 15 + a, 8, o, !0),
          a < 8
            ? e.set(8, r - a - 1, o, !0)
            : a < 9
              ? e.set(8, 15 - a - 1 + 1, o, !0)
              : e.set(8, 15 - a - 1, o, !0));
      e.set(r - 8, 8, 1, !0);
    }
    function y(e, t) {
      let n = e.size,
        r = -1,
        i = n - 1,
        a = 7,
        o = 0;
      for (let s = n - 1; s > 0; s -= 2)
        for (s === 6 && s--; ; ) {
          for (let n = 0; n < 2; n++)
            if (!e.isReserved(i, s - n)) {
              let r = !1;
              (o < t.length && (r = ((t[o] >>> a) & 1) == 1),
                e.set(i, s - n, r),
                a--,
                a === -1 && (o++, (a = 7)));
            }
          if (((i += r), i < 0 || n <= i)) {
            ((i -= r), (r = -r));
            break;
          }
        }
    }
    function b(e, n, i) {
      let a = new r();
      i.forEach(function (t) {
        (a.put(t.mode.bit, 4), a.put(t.getLength(), f.getCharCountIndicator(t.mode, e)), t.write(a));
      });
      let o = (t.getSymbolTotalCodewords(e) - c.getTotalCodewordsCount(e, n)) * 8;
      for (a.getLengthInBits() + 4 <= o && a.put(0, 4); a.getLengthInBits() % 8 != 0; ) a.putBit(0);
      let s = (o - a.getLengthInBits()) / 8;
      for (let e = 0; e < s; e++) a.put(e % 2 ? 17 : 236, 8);
      return x(a, e, n);
    }
    function x(e, n, r) {
      let i = t.getSymbolTotalCodewords(n),
        a = i - c.getTotalCodewordsCount(n, r),
        o = c.getBlocksCount(n, r),
        s = o - (i % o),
        u = Math.floor(i / o),
        d = Math.floor(a / o),
        f = d + 1,
        p = u - d,
        m = new l(p),
        h = 0,
        g = Array(o),
        _ = Array(o),
        v = 0,
        y = new Uint8Array(e.buffer);
      for (let e = 0; e < o; e++) {
        let t = e < s ? d : f;
        ((g[e] = y.slice(h, h + t)), (_[e] = m.encode(g[e])), (h += t), (v = Math.max(v, t)));
      }
      let b = new Uint8Array(i),
        x = 0,
        S,
        C;
      for (S = 0; S < v; S++) for (C = 0; C < o; C++) S < g[C].length && (b[x++] = g[C][S]);
      for (S = 0; S < p; S++) for (C = 0; C < o; C++) b[x++] = _[C][S];
      return b;
    }
    function S(e, n, r, a) {
      let o;
      if (Array.isArray(e)) o = p.fromArray(e);
      else if (typeof e == `string`) {
        let t = n;
        if (!t) {
          let n = p.rawSplit(e);
          t = u.getBestVersionForData(n, r);
        }
        o = p.fromString(e, t || 40);
      } else throw Error(`Invalid data`);
      let c = u.getBestVersionForData(o, r);
      if (!c) throw Error(`The amount of data is too big to be stored in a QR Code`);
      if (!n) n = c;
      else if (n < c)
        throw Error(
          `
The chosen QR Code version cannot contain this amount of data.
Minimum version required to store current data is: ` +
            c +
            `.
`,
        );
      let l = b(n, r, o),
        d = new i(t.getSymbolSize(n));
      return (
        m(d, n),
        h(d),
        g(d, n),
        v(d, r, 0),
        n >= 7 && _(d, n),
        y(d, l),
        isNaN(a) && (a = s.getBestMask(d, v.bind(null, d, r))),
        s.applyMask(a, d),
        v(d, r, a),
        { modules: d, version: n, errorCorrectionLevel: r, maskPattern: a, segments: o }
      );
    }
    e.create = function (e, r) {
      if (e === void 0 || e === ``) throw Error(`No input text`);
      let i = n.M,
        a,
        o;
      return (
        r !== void 0 &&
          ((i = n.from(r.errorCorrectionLevel, n.M)),
          (a = u.from(r.version)),
          (o = s.from(r.maskPattern)),
          r.toSJISFunc && t.setToSJISFunction(r.toSJISFunc)),
        S(e, a, i, o)
      );
    };
  }),
  zk = s((e) => {
    function t(e) {
      if ((typeof e == `number` && (e = e.toString()), typeof e != `string`))
        throw Error(`Color should be defined as hex string`);
      let t = e.slice().replace(`#`, ``).split(``);
      if (t.length < 3 || t.length === 5 || t.length > 8) throw Error(`Invalid hex color: ` + e);
      ((t.length === 3 || t.length === 4) &&
        (t = Array.prototype.concat.apply(
          [],
          t.map(function (e) {
            return [e, e];
          }),
        )),
        t.length === 6 && t.push(`F`, `F`));
      let n = parseInt(t.join(``), 16);
      return {
        r: (n >> 24) & 255,
        g: (n >> 16) & 255,
        b: (n >> 8) & 255,
        a: n & 255,
        hex: `#` + t.slice(0, 6).join(``),
      };
    }
    ((e.getOptions = function (e) {
      ((e ||= {}), e.color || (e.color = {}));
      let n = e.margin === void 0 || e.margin === null || e.margin < 0 ? 4 : e.margin,
        r = e.width && e.width >= 21 ? e.width : void 0,
        i = e.scale || 4;
      return {
        width: r,
        scale: r ? 4 : i,
        margin: n,
        color: { dark: t(e.color.dark || `#000000ff`), light: t(e.color.light || `#ffffffff`) },
        type: e.type,
        rendererOpts: e.rendererOpts || {},
      };
    }),
      (e.getScale = function (e, t) {
        return t.width && t.width >= e + t.margin * 2 ? t.width / (e + t.margin * 2) : t.scale;
      }),
      (e.getImageWidth = function (t, n) {
        let r = e.getScale(t, n);
        return Math.floor((t + n.margin * 2) * r);
      }),
      (e.qrToImageData = function (t, n, r) {
        let i = n.modules.size,
          a = n.modules.data,
          o = e.getScale(i, r),
          s = Math.floor((i + r.margin * 2) * o),
          c = r.margin * o,
          l = [r.color.light, r.color.dark];
        for (let e = 0; e < s; e++)
          for (let n = 0; n < s; n++) {
            let u = (e * s + n) * 4,
              d = r.color.light;
            if (e >= c && n >= c && e < s - c && n < s - c) {
              let t = Math.floor((e - c) / o),
                r = Math.floor((n - c) / o);
              d = l[+!!a[t * i + r]];
            }
            ((t[u++] = d.r), (t[u++] = d.g), (t[u++] = d.b), (t[u] = d.a));
          }
      }));
  }),
  Bk = s((e) => {
    var t = zk();
    function n(e, t, n) {
      (e.clearRect(0, 0, t.width, t.height),
        (t.style ||= {}),
        (t.height = n),
        (t.width = n),
        (t.style.height = n + `px`),
        (t.style.width = n + `px`));
    }
    function r() {
      try {
        return document.createElement(`canvas`);
      } catch {
        throw Error(`You need to specify a canvas element`);
      }
    }
    ((e.render = function (e, i, a) {
      let o = a,
        s = i;
      (o === void 0 && (!i || !i.getContext) && ((o = i), (i = void 0)),
        i || (s = r()),
        (o = t.getOptions(o)));
      let c = t.getImageWidth(e.modules.size, o),
        l = s.getContext(`2d`),
        u = l.createImageData(c, c);
      return (t.qrToImageData(u.data, e, o), n(l, s, c), l.putImageData(u, 0, 0), s);
    }),
      (e.renderToDataURL = function (t, n, r) {
        let i = r;
        (i === void 0 && (!n || !n.getContext) && ((i = n), (n = void 0)), (i ||= {}));
        let a = e.render(t, n, i),
          o = i.type || `image/png`,
          s = i.rendererOpts || {};
        return a.toDataURL(o, s.quality);
      }));
  }),
  Vk = s((e) => {
    var t = zk();
    function n(e, t) {
      let n = e.a / 255,
        r = t + `="` + e.hex + `"`;
      return n < 1 ? r + ` ` + t + `-opacity="` + n.toFixed(2).slice(1) + `"` : r;
    }
    function r(e, t, n) {
      let r = e + t;
      return (n !== void 0 && (r += ` ` + n), r);
    }
    function i(e, t, n) {
      let i = ``,
        a = 0,
        o = !1,
        s = 0;
      for (let c = 0; c < e.length; c++) {
        let l = Math.floor(c % t),
          u = Math.floor(c / t);
        (!l && !o && (o = !0),
          e[c]
            ? (s++,
              (c > 0 && l > 0 && e[c - 1]) ||
                ((i += o ? r(`M`, l + n, 0.5 + u + n) : r(`m`, a, 0)), (a = 0), (o = !1)),
              (l + 1 < t && e[c + 1]) || ((i += r(`h`, s)), (s = 0)))
            : a++);
      }
      return i;
    }
    e.render = function (e, r, a) {
      let o = t.getOptions(r),
        s = e.modules.size,
        c = e.modules.data,
        l = s + o.margin * 2,
        u = o.color.light.a ? `<path ` + n(o.color.light, `fill`) + ` d="M0 0h` + l + `v` + l + `H0z"/>` : ``,
        d = `<path ` + n(o.color.dark, `stroke`) + ` d="` + i(c, s, o.margin) + `"/>`,
        f = `viewBox="0 0 ` + l + ` ` + l + `"`,
        p =
          `<svg xmlns="http://www.w3.org/2000/svg" ` +
          (o.width ? `width="` + o.width + `" height="` + o.width + `" ` : ``) +
          f +
          ` shape-rendering="crispEdges">` +
          u +
          d +
          `</svg>
`;
      return (typeof a == `function` && a(null, p), p);
    };
  }),
  Hk = k(
    s((e) => {
      var t = hk(),
        n = Rk(),
        r = Bk(),
        i = Vk();
      function a(e, r, i, a, o) {
        let s = [].slice.call(arguments, 1),
          c = s.length,
          l = typeof s[c - 1] == `function`;
        if (!l && !t()) throw Error(`Callback required as last argument`);
        if (l) {
          if (c < 2) throw Error(`Too few arguments provided`);
          c === 2
            ? ((o = i), (i = r), (r = a = void 0))
            : c === 3 &&
              (r.getContext && o === void 0
                ? ((o = a), (a = void 0))
                : ((o = a), (a = i), (i = r), (r = void 0)));
        } else {
          if (c < 1) throw Error(`Too few arguments provided`);
          return (
            c === 1
              ? ((i = r), (r = a = void 0))
              : c === 2 && !r.getContext && ((a = i), (i = r), (r = void 0)),
            new Promise(function (t, o) {
              try {
                t(e(n.create(i, a), r, a));
              } catch (e) {
                o(e);
              }
            })
          );
        }
        try {
          let t = n.create(i, a);
          o(null, e(t, r, a));
        } catch (e) {
          o(e);
        }
      }
      ((e.create = n.create),
        (e.toCanvas = a.bind(null, r.render)),
        (e.toDataURL = a.bind(null, r.renderToDataURL)),
        (e.toString = a.bind(null, function (e, t, n) {
          return i.render(e, n);
        })));
    })(),
    1,
  ),
  Uk = `\`qwertyuiop[]asdfghjkl;'zxcvbnm,./~QWERTYUIOP{}ASDFGHJKL:"ZXCVBNM<>?@#$^&`,
  Wk = `ёйцукенгшщзхъфывапролджэячсмитьбю.ЁЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮ,"№;:?`,
  Gk = new Map(),
  Kk = new Map();
for (let e = 0; e < 73; e++) (Gk.set(Uk[e], Wk[e]), Kk.set(Wk[e], Uk[e]));
var qk = /[а-яё]/i,
  Jk = /[a-z]/i;
function Yk(e) {
  let t = 0,
    n = 0;
  for (let r of e) qk.test(r) ? t++ : Jk.test(r) && n++;
  let r = n >= t ? Gk : Kk;
  return Array.from(e, (e) => r.get(e) ?? e).join(``);
}
var Xk = (e) => e.toLocaleUpperCase(`ru`),
  Zk = (e) => e.toLocaleLowerCase(`ru`);
function Qk(e) {
  return e
    .toLocaleLowerCase(`ru`)
    .replace(/(^|[\s\-«"(])(\p{L})/gu, (e, t, n) => t + n.toLocaleUpperCase(`ru`));
}
function $k(e) {
  return e
    .toLocaleLowerCase(`ru`)
    .replace(/(^\s*|[.!?…]\s+)(\p{L})/gu, (e, t, n) => t + n.toLocaleUpperCase(`ru`));
}
var eA = {
  а: `a`,
  б: `b`,
  в: `v`,
  г: `g`,
  д: `d`,
  е: `e`,
  ё: `yo`,
  ж: `zh`,
  з: `z`,
  и: `i`,
  й: `y`,
  к: `k`,
  л: `l`,
  м: `m`,
  н: `n`,
  о: `o`,
  п: `p`,
  р: `r`,
  с: `s`,
  т: `t`,
  у: `u`,
  ф: `f`,
  х: `kh`,
  ц: `ts`,
  ч: `ch`,
  ш: `sh`,
  щ: `shch`,
  ъ: ``,
  ы: `y`,
  ь: ``,
  э: `e`,
  ю: `yu`,
  я: `ya`,
};
function tA(e) {
  return Array.from(e, (e) => {
    let t = e.toLowerCase(),
      n = eA[t];
    return n === void 0 ? e : e === t || n === `` ? n : n[0].toUpperCase() + n.slice(1);
  }).join(``);
}
function nA(e) {
  return e
    .replace(
      /\r\n?/g,
      `
`,
    )
    .split(/\n{2,}/)
    .map((e) =>
      e
        .replace(/-\n(?=\p{Ll})/gu, ``)
        .replace(/\s*\n\s*/g, ` `)
        .trim(),
    )
    .filter(Boolean).join(`

`);
}
function rA(e) {
  return e
    .replace(
      /\r\n?/g,
      `
`,
    )
    .split(
      `
`,
    )
    .map((e) => e.replace(/[ \t ]+/g, ` `).trim())
    .join(
      `
`,
    )
    .replace(
      /\n{3,}/g,
      `

`,
    )
    .trim();
}
function iA(e) {
  return JSON.stringify(JSON.parse(e), null, 2);
}
function aA(e) {
  return JSON.stringify(JSON.parse(e));
}
function oA(e) {
  let t = new TextEncoder().encode(e),
    n = ``;
  for (let e of t) n += String.fromCharCode(e);
  return btoa(n);
}
function sA(e) {
  let t = e.trim().replace(/-/g, `+`).replace(/_/g, `/`).replace(/\s+/g, ``),
    n = atob(t),
    r = Uint8Array.from(n, (e) => e.charCodeAt(0));
  return new TextDecoder(`utf-8`, { fatal: !0 }).decode(r);
}
var cA = (e) => encodeURIComponent(e),
  lA = (e) => decodeURIComponent(e.replace(/\+/g, ` `));
function uA(e) {
  return {
    chars: Array.from(e).length,
    charsNoSpaces: Array.from(e.replace(/\s/g, ``)).length,
    words: (e.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? []).length,
    lines: e.length === 0 ? 0 : e.split(/\r\n|\r|\n/).length,
  };
}
var dA = [
  {
    id: `layout`,
    get label() {
      return o(`Раскладка`, `Layout`);
    },
    run: Yk,
  },
  {
    id: `upper`,
    get label() {
      return o(`ВЕРХНИЙ`, `UPPER`);
    },
    run: Xk,
  },
  {
    id: `lower`,
    get label() {
      return o(`нижний`, `lower`);
    },
    run: Zk,
  },
  {
    id: `title`,
    get label() {
      return o(`Каждое Слово`, `Title Case`);
    },
    run: Qk,
  },
  {
    id: `sentence`,
    get label() {
      return o(`Предложение`, `Sentence`);
    },
    run: $k,
  },
  {
    id: `translit`,
    get label() {
      return o(`Транслит`, `Translit`);
    },
    run: tA,
  },
  {
    id: `unwrap`,
    get label() {
      return o(`Убрать переносы`, `Join lines`);
    },
    run: nA,
  },
  {
    id: `spaces`,
    get label() {
      return o(`Лишние пробелы`, `Extra spaces`);
    },
    run: rA,
  },
  {
    id: `json`,
    get label() {
      return o(`JSON красиво`, `JSON pretty`);
    },
    run: iA,
  },
  {
    id: `jsonmin`,
    get label() {
      return o(`JSON в строку`, `JSON minify`);
    },
    run: aA,
  },
  { id: `b64e`, label: `→ Base64`, run: oA },
  { id: `b64d`, label: `Base64 →`, run: sA },
  { id: `urle`, label: `→ URL`, run: cA },
  { id: `urld`, label: `URL →`, run: lA },
];
function fA() {
  let [e, t] = (0, ReactRuntime.useState)(``),
    [n, r] = (0, ReactRuntime.useState)(null),
    [i, a] = (0, ReactRuntime.useState)(null),
    s = (0, ReactRuntime.useRef)(void 0),
    [c, l] = (0, ReactRuntime.useState)(`tools`),
    [d, f] = (0, ReactRuntime.useState)(null),
    [p, m] = (0, ReactRuntime.useState)(!1),
    [h, g] = (0, ReactRuntime.useState)(null),
    [_, v] = (0, ReactRuntime.useState)(``),
    y = (0, ReactRuntime.useRef)(null),
    b = (e, t) => {
      (clearTimeout(s.current), r({ ok: e, text: t }), (s.current = setTimeout(() => r(null), 1800)));
    },
    x = () => void u.clipCurrentText().then((e) => t(e ?? ``));
  (0, ReactRuntime.useEffect)(() => {
    let e = useIslandStore.getState().textSeed;
    e?.text ? t(e.text) : x();
    let n = _n.find((e) => e.id === `translate`);
    return (
      e?.text && e.then === `translate` && n && S(n.system, n.label, e.text),
      useIslandStore.setState({ textSeed: null }),
      u.aiKeyStatus().then(f),
      () => {
        (clearTimeout(s.current), y.current?.());
      }
    );
  }, []);
  let S = (n, r, i) => {
      let a = i ?? e;
      if (!a.trim())
        return b(
          !1,
          o(`Нет текста: скопируй что-нибудь или вставь сюда`, `No text: copy something or paste it here`),
        );
      let s = ``;
      (g(a),
        m(!0),
        t(``),
        (y.current = gn(n, a, {
          onChunk: (e) => {
            ((s += e), t(s));
          },
          onDone: () => {
            (m(!1), (y.current = null));
            let e = s.trim();
            (t(e),
              u.clipSetText(e).then(() => b(!0, o(`${r} — готово, уже в буфере`, `${r}: done, copied`))));
          },
          onError: (e) => {
            (m(!1), (y.current = null), t(a), g(null), b(!1, e));
          },
        })));
    },
    C = () => {
      (y.current?.(), (y.current = null), m(!1));
    },
    w = async (n) => {
      if (!e)
        return b(
          !1,
          o(`Нет текста: скопируй что-нибудь или вставь сюда`, `No text: copy something or paste it here`),
        );
      let r;
      try {
        r = n.run(e);
      } catch {
        return b(
          !1,
          n.id.startsWith(`json`)
            ? o(`Это не похоже на JSON`, `This doesn't look like JSON`)
            : o(`Не получилось преобразовать`, `Couldn't convert it`),
        );
      }
      (t(r),
        await u.clipSetText(r),
        b(!0, o(`${n.label} — готово, уже в буфере`, `${n.label}: done, copied`)));
    },
    T = async () => {
      if (!e) return b(!1, o(`Нет текста для QR-кода`, `No text for a QR code`));
      try {
        a(await Hk.toDataURL(e, { margin: 1, width: 360, errorCorrectionLevel: `M` }));
      } catch {
        b(!1, o(`Слишком длинный текст для QR-кода`, `The text is too long for a QR code`));
      }
    },
    E = uA(e);
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `relative grid h-full grid-cols-[1fr_262px] gap-3`,
    children: [
      (0, jsxRuntime.jsxs)(`div`, {
        className: `flex min-h-0 flex-col gap-1.5`,
        children: [
          (0, jsxRuntime.jsx)(`textarea`, {
            value: e,
            onChange: (e) => t(e.target.value),
            onMouseDown: () => void u.takeFocus(),
            spellCheck: !1,
            placeholder: o(`Скопируй текст — он появится здесь`, `Copy some text and it shows up here`),
            className: `scroll-thin min-h-0 flex-1 resize-none rounded-2xl bg-tile p-3 text-[12.5px] leading-relaxed text-ink outline-none placeholder:text-ink-3 focus:bg-tile-hover`,
          }),
          (0, jsxRuntime.jsxs)(`div`, {
            className: `flex items-center justify-between px-1`,
            children: [
              (0, jsxRuntime.jsx)(`div`, {
                className: `tabular text-[10.5px] text-ink-3`,
                children: o(
                  `${E.chars} симв. · ${E.charsNoSpaces} без пробелов · ${E.words} слов · ${E.lines} стр.`,
                  `${E.chars} chars · ${E.charsNoSpaces} without spaces · ${E.words} words · ${E.lines} lines`,
                ),
              }),
              (0, jsxRuntime.jsxs)(`div`, {
                className: `flex gap-1`,
                children: [
                  h !== null &&
                    !p &&
                    (0, jsxRuntime.jsx)(`button`, {
                      title: o(`Вернуть исходный текст`, `Restore the original text`),
                      onClick: () => {
                        (t(h), g(null));
                      },
                      className: `press grid size-6 place-items-center rounded-md text-ink-3 hover:bg-tile hover:text-ink`,
                      children: (0, jsxRuntime.jsx)(gr, { size: 13 }),
                    }),
                  (0, jsxRuntime.jsx)(`button`, {
                    title: o(`Взять из буфера`, `Take from the clipboard`),
                    onClick: x,
                    className: `press grid size-6 place-items-center rounded-md text-ink-3 hover:bg-tile hover:text-ink`,
                    children: (0, jsxRuntime.jsx)(Ba, { size: 13 }),
                  }),
                  (0, jsxRuntime.jsx)(`button`, {
                    title: o(`Скопировать`, `Copy`),
                    onClick: () => void u.clipSetText(e).then(() => b(!0, o(`Скопировано`, `Copied`))),
                    className: `press grid size-6 place-items-center rounded-md text-ink-3 hover:bg-tile hover:text-ink`,
                    children: (0, jsxRuntime.jsx)(A, { size: 13 }),
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      (0, jsxRuntime.jsxs)(`div`, {
        className: `flex min-h-0 flex-col gap-2`,
        children: [
          (0, jsxRuntime.jsx)(`div`, {
            className: `flex shrink-0 rounded-lg bg-white/6 p-0.5`,
            children: [`tools`, `ai`].map((e) =>
              (0, jsxRuntime.jsxs)(
                `button`,
                {
                  onClick: () => l(e),
                  className: `flex h-7 flex-1 items-center justify-center gap-1 rounded-md text-[11.5px] font-medium ${c === e ? `bg-white/14 text-ink` : `text-ink-3 hover:text-ink-2`}`,
                  children: [
                    e === `ai` && (0, jsxRuntime.jsx)(fr, { size: 12 }),
                    e === `tools` ? o(`Инструменты`, `Tools`) : o(`ИИ`, `AI`),
                  ],
                },
                e,
              ),
            ),
          }),
          c === `tools`
            ? (0, jsxRuntime.jsxs)(`div`, {
                className: `scroll-thin grid min-h-0 content-start gap-1.5 overflow-y-auto pr-0.5`,
                style: { gridTemplateColumns: `1fr 1fr` },
                children: [
                  dA.map((e) =>
                    (0, jsxRuntime.jsx)(
                      `button`,
                      {
                        onClick: () => void w(e),
                        className: `press h-8 truncate rounded-lg bg-tile px-2 text-[11.5px] font-medium text-ink hover:bg-tile-hover`,
                        children: e.label,
                      },
                      e.id,
                    ),
                  ),
                  (0, jsxRuntime.jsxs)(`button`, {
                    onClick: () => void T(),
                    className: `press col-span-2 flex h-8 items-center justify-center gap-1.5 rounded-lg bg-tile text-[11.5px] font-medium text-ink hover:bg-tile-hover`,
                    children: [(0, jsxRuntime.jsx)(An, { size: 14 }), ` `, o(`QR-код`, `QR code`)],
                  }),
                ],
              })
            : d === !1
              ? (0, jsxRuntime.jsxs)(`div`, {
                  className: `flex flex-1 flex-col items-center justify-center gap-2 rounded-xl bg-tile p-3 text-center`,
                  children: [
                    (0, jsxRuntime.jsx)(fr, { size: 18, className: `text-accent` }),
                    (0, jsxRuntime.jsx)(`div`, {
                      className: `text-[12px] leading-snug text-ink-2`,
                      children: o(
                        `Добавь ключ в настройках, раздел «ИИ»: там есть бесплатные сервисы. Ключ хранится только на этом компьютере, в зашифрованном виде.`,
                        `Add a key in Settings → AI: there are free services to choose from. The key is stored only on this computer, encrypted.`,
                      ),
                    }),
                    (0, jsxRuntime.jsx)(`button`, {
                      onClick: () => {
                        (useIslandStore.getState().close(), u.openSettings());
                      },
                      className: `press h-7 rounded-lg bg-white px-3 text-[11.5px] font-semibold text-black`,
                      children: o(`Открыть настройки`, `Open settings`),
                    }),
                  ],
                })
              : (0, jsxRuntime.jsxs)(`div`, {
                  className: `flex min-h-0 flex-col gap-1.5`,
                  children: [
                    (0, jsxRuntime.jsx)(`div`, {
                      className: `grid grid-cols-2 gap-1.5`,
                      children: _n.map((e) =>
                        (0, jsxRuntime.jsx)(
                          `button`,
                          {
                            disabled: p,
                            onClick: () => S(e.system, e.label),
                            className: `press h-8 truncate rounded-lg bg-tile px-2 text-[11.5px] font-medium text-ink hover:bg-tile-hover disabled:opacity-40`,
                            children: e.label,
                          },
                          e.id,
                        ),
                      ),
                    }),
                    (0, jsxRuntime.jsx)(`input`, {
                      value: _,
                      onChange: (e) => v(e.target.value),
                      onMouseDown: () => void u.takeFocus(),
                      onKeyDown: (e) => {
                        e.key === `Enter` &&
                          _.trim() &&
                          !p &&
                          S(
                            o(
                              `${_.trim()}. Верни только результат, без пояснений.`,
                              `${_.trim()}. Return only the result, no comments.`,
                            ),
                            o(`Своя команда`, `Custom command`),
                          );
                      },
                      disabled: p,
                      placeholder: o(`Своя команда, Enter…`, `Custom command, Enter…`),
                      className: `h-8 rounded-lg bg-tile px-2.5 text-[11.5px] text-ink outline-none placeholder:text-ink-3 focus:bg-tile-hover`,
                    }),
                    p &&
                      (0, jsxRuntime.jsxs)(`button`, {
                        onClick: C,
                        className: `press flex h-8 items-center justify-center gap-1.5 rounded-lg bg-danger/20 text-[11.5px] font-medium text-danger`,
                        children: [
                          (0, jsxRuntime.jsx)(vr, { size: 11, fill: `currentColor` }),
                          ` `,
                          o(`Остановить`, `Stop`),
                        ],
                      }),
                  ],
                }),
        ],
      }),
      (0, jsxRuntime.jsx)(Wt, {
        children:
          n &&
          (0, jsxRuntime.jsxs)(Et.div, {
            initial: { opacity: 0, y: 6 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: 6 },
            className: `pointer-events-none absolute bottom-7 left-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-medium shadow-lg ${n.ok ? `bg-ok/20 text-ok` : `bg-danger/20 text-danger`}`,
            children: [
              n.ok ? (0, jsxRuntime.jsx)(_r, { size: 13 }) : (0, jsxRuntime.jsx)(yr, { size: 13 }),
              n.text,
            ],
          }),
      }),
      (0, jsxRuntime.jsx)(Wt, {
        children:
          i &&
          (0, jsxRuntime.jsxs)(Et.div, {
            initial: { opacity: 0, scale: 0.96 },
            animate: { opacity: 1, scale: 1 },
            exit: { opacity: 0, scale: 0.96 },
            className: `absolute inset-0 flex items-center gap-5 rounded-2xl bg-black/95 p-3`,
            children: [
              (0, jsxRuntime.jsx)(`img`, { src: i, alt: `QR`, className: `h-full rounded-xl bg-[#fff] p-1` }),
              (0, jsxRuntime.jsxs)(`div`, {
                className: `flex flex-col gap-2`,
                children: [
                  (0, jsxRuntime.jsx)(`div`, {
                    className: `text-[13px] font-semibold text-ink`,
                    children: o(`QR-код готов`, `QR code ready`),
                  }),
                  (0, jsxRuntime.jsx)(`div`, {
                    className: `text-[12px] text-ink-3`,
                    children: o(`Наведи камеру телефона`, `Point your phone camera at it`),
                  }),
                  (0, jsxRuntime.jsxs)(`button`, {
                    onClick: () =>
                      void u.clipSetPng(i).then(() => b(!0, o(`QR-код в буфере`, `QR code copied`))),
                    className: `press flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-[12px] font-semibold text-black`,
                    children: [
                      (0, jsxRuntime.jsx)(A, { size: 13 }),
                      ` `,
                      o(`Копировать картинку`, `Copy image`),
                    ],
                  }),
                  (0, jsxRuntime.jsx)(`button`, {
                    onClick: () => a(null),
                    className: `press h-8 rounded-lg px-3 text-[12px] text-ink-2 hover:bg-tile`,
                    children: o(`Закрыть`, `Close`),
                  }),
                ],
              }),
            ],
          }),
      }),
    ],
  });
}
function pA({ w: e, onCity: t }) {
  let n = dn((e) => e.loading),
    r = st(e.now.code),
    i = e.days[0];
  return (0, jsxRuntime.jsxs)(`div`, {
    "data-wx-now": !0,
    className: `on-dark relative flex min-h-0 flex-col overflow-hidden rounded-[18px] p-3.5 text-white`,
    children: [
      (0, jsxRuntime.jsx)(pt, { sky: r, night: !e.now.isDay }),
      (0, jsxRuntime.jsxs)(`div`, {
        className: `relative flex items-center gap-1`,
        children: [
          (0, jsxRuntime.jsxs)(`button`, {
            title: o(`Выбрать другой город`, `Choose another city`),
            onClick: t,
            className: `press -ml-1 flex min-w-0 items-center gap-1 rounded-lg px-1 py-0.5 text-[12.5px] font-medium hover:bg-white/15`,
            children: [
              (0, jsxRuntime.jsx)(Tn, { size: 13, className: `shrink-0` }),
              (0, jsxRuntime.jsx)(`span`, { className: `truncate`, children: e.city }),
            ],
          }),
          (0, jsxRuntime.jsx)(`span`, { className: `flex-1` }),
          (0, jsxRuntime.jsx)(`button`, {
            title: o(`Обновить`, `Refresh`),
            onClick: () => dn.getState().refresh(),
            className: `press grid size-6 shrink-0 place-items-center rounded-lg text-white/70 hover:bg-white/15 hover:text-white`,
            children: (0, jsxRuntime.jsx)(On, { size: 13, className: n ? `animate-spin` : `` }),
          }),
        ],
      }),
      (0, jsxRuntime.jsx)(nn, { sky: r, night: !e.now.isDay, size: 54, className: `relative mt-2 -ml-1` }),
      (0, jsxRuntime.jsx)(`div`, {
        className: `tabular relative mt-1 font-display text-[46px] leading-none font-light tracking-tight`,
        children: at(e.now.temp),
      }),
      (0, jsxRuntime.jsx)(`div`, {
        className: `relative mt-1.5 text-[14px] leading-tight font-semibold`,
        children: ke(e.now.code),
      }),
      (0, jsxRuntime.jsxs)(`div`, {
        className: `relative mt-0.5 text-[11.5px] leading-snug text-white/75`,
        children: [
          o(`Ощущается как ${at(e.now.feels)}`, `Feels like ${at(e.now.feels)}`),
          i &&
            (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
              children: [
                (0, jsxRuntime.jsx)(`br`, {}),
                o(`Сегодня ${at(i.min)}…${at(i.max)}`, `Today ${at(i.min)}…${at(i.max)}`),
              ],
            }),
        ],
      }),
      (0, jsxRuntime.jsx)(`span`, { className: `flex-1` }),
      (0, jsxRuntime.jsx)(`div`, {
        "data-wx-summary": !0,
        className: `relative rounded-xl bg-black/25 px-2.5 py-2 text-[11.5px] leading-snug text-white/85`,
        children: dt(e),
      }),
      (0, jsxRuntime.jsx)(`button`, {
        onClick: () => void u.openPath(`https://www.met.no/en`),
        className: `relative mt-1.5 self-start text-[10px] text-white/45 hover:text-white/70`,
        title: o(`Источник прогноза`, `The source of the forecast`),
        children: o(`Данные MET Norway`, `Data from MET Norway`),
      }),
    ],
  });
}
function mA({ w: e }) {
  return (0, jsxRuntime.jsx)(`div`, {
    "data-wx-hours": !0,
    onWheel: (e) => {
      e.currentTarget.scrollLeft += e.deltaY;
    },
    className: `scroll-none flex min-w-0 flex-1 overflow-x-auto [mask-image:linear-gradient(to_right,#000_86%,transparent)]`,
    children: e.hours.map((t, n) =>
      (0, jsxRuntime.jsxs)(
        `div`,
        {
          className: `flex w-[42px] shrink-0 flex-col items-center gap-0.5`,
          children: [
            (0, jsxRuntime.jsx)(`span`, {
              className: `text-[10.5px] text-ink-3`,
              children: n === 0 ? o(`Сейчас`, `Now`) : De(t.time, e.timezone || e.utcOffset),
            }),
            (0, jsxRuntime.jsx)(nn, {
              sky: st(n === 0 ? e.now.code : t.code),
              night: n === 0 ? !e.now.isDay : !t.isDay,
              size: 24,
              still: !0,
            }),
            (0, jsxRuntime.jsx)(`span`, {
              className: `tabular text-[12.5px] font-semibold text-ink`,
              children: at(n === 0 ? e.now.temp : t.temp),
            }),
            (0, jsxRuntime.jsx)(`span`, {
              className: `tabular h-2.5 text-[9.5px] leading-none text-rain`,
              children: Fe(t.precip, e.units),
            }),
          ],
        },
        t.time,
      ),
    ),
  });
}
function hA({ w: e }) {
  return (0, jsxRuntime.jsx)(`div`, {
    "data-wx-week": !0,
    className: `grid min-w-0 flex-1 grid-cols-7`,
    children: e.days
      .slice(0, 7)
      .map((t, n) =>
        (0, jsxRuntime.jsxs)(
          `div`,
          {
            className: `flex min-w-0 flex-col items-center gap-0.5`,
            children: [
              (0, jsxRuntime.jsx)(`span`, {
                className: `truncate text-[10.5px] ${n === 0 ? `font-semibold text-ink` : `text-ink-3`}`,
                children: tt(t.time, e.timezone || e.utcOffset, n),
              }),
              (0, jsxRuntime.jsx)(nn, { sky: st(t.code), size: 24, still: !0 }),
              (0, jsxRuntime.jsxs)(`span`, {
                className: `tabular text-[12px] font-semibold text-ink`,
                children: [
                  at(t.max),
                  ` `,
                  (0, jsxRuntime.jsx)(`span`, { className: `font-normal text-ink-3`, children: at(t.min) }),
                ],
              }),
              (0, jsxRuntime.jsx)(`span`, {
                className: `tabular h-2.5 text-[9.5px] leading-none text-rain`,
                children: Fe(t.precip, e.units),
              }),
            ],
          },
          t.time,
        ),
      ),
  });
}
function gA({ w: e }) {
  let [t, n] = (0, ReactRuntime.useState)(`hours`);
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `flex h-[88px] shrink-0 items-center gap-2 rounded-[18px] bg-tile py-2 pr-2 pl-1`,
    children: [
      t === `hours` ? (0, jsxRuntime.jsx)(mA, { w: e }) : (0, jsxRuntime.jsx)(hA, { w: e }),
      (0, jsxRuntime.jsx)(`div`, {
        className: `flex shrink-0 flex-col gap-[3px] rounded-[10px] bg-white/[0.07] p-[3px] text-[11px]`,
        children: [`hours`, `week`].map((e) =>
          (0, jsxRuntime.jsx)(
            `button`,
            {
              "data-wx-view": e,
              "aria-pressed": t === e,
              onClick: () => n(e),
              className: `press rounded-[7px] px-2.5 py-1 ${t === e ? `bg-white/15 text-ink` : `text-ink-2 hover:text-ink`}`,
              children: e === `hours` ? o(`Часы`, `Hours`) : o(`Неделя`, `Week`),
            },
            e,
          ),
        ),
      }),
    ],
  });
}
function _A({ title: e, hint: t, mark: n, children: r }) {
  return (0, jsxRuntime.jsxs)(`div`, {
    "data-wx-tile": n,
    title: t,
    className: `flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl bg-tile px-3 py-2.5`,
    children: [
      (0, jsxRuntime.jsx)(`div`, {
        className: `text-[10px] font-semibold tracking-[0.06em] text-ink-3 uppercase`,
        children: e,
      }),
      r,
    ],
  });
}
function vA({ from: e }) {
  let [n, r, i, a] = t() === `ru` ? [`С`, `В`, `Ю`, `З`] : [`N`, `E`, `S`, `W`];
  return (0, jsxRuntime.jsxs)(`svg`, {
    width: `52`,
    height: `52`,
    viewBox: `0 0 52 52`,
    className: `shrink-0 text-ink`,
    "aria-hidden": !0,
    children: [
      (0, jsxRuntime.jsx)(`circle`, {
        cx: `26`,
        cy: `26`,
        r: `23`,
        fill: `none`,
        stroke: `currentColor`,
        strokeOpacity: `.16`,
        strokeWidth: `1.5`,
      }),
      (0, jsxRuntime.jsxs)(`g`, {
        fontSize: `8`,
        fill: `currentColor`,
        fillOpacity: `.45`,
        textAnchor: `middle`,
        fontFamily: `inherit`,
        children: [
          (0, jsxRuntime.jsx)(`text`, { x: `26`, y: `10`, children: n }),
          (0, jsxRuntime.jsx)(`text`, { x: `26`, y: `48`, children: i }),
          (0, jsxRuntime.jsx)(`text`, { x: `7`, y: `29`, children: a }),
          (0, jsxRuntime.jsx)(`text`, { x: `45`, y: `29`, children: r }),
        ],
      }),
      (0, jsxRuntime.jsxs)(`g`, {
        transform: `rotate(${e + 180} 26 26)`,
        children: [
          (0, jsxRuntime.jsx)(`path`, { d: `M26 11 L30 26 L26 23.5 L22 26 Z`, fill: `currentColor` }),
          (0, jsxRuntime.jsx)(`path`, {
            d: `M26 23.5 V40`,
            stroke: `currentColor`,
            strokeWidth: `2`,
            strokeLinecap: `round`,
          }),
        ],
      }),
    ],
  });
}
function yA({ w: e }) {
  let t = e.units === `imperial` ? `mph` : o(`м/с`, `m/s`),
    n = e.now.gust ?? 0;
  return (0, jsxRuntime.jsx)(_A, {
    mark: `wind`,
    title: o(`Ветер`, `Wind`),
    children: (0, jsxRuntime.jsxs)(`div`, {
      className: `flex min-h-0 flex-1 items-center gap-2.5`,
      children: [
        (0, jsxRuntime.jsx)(vA, { from: e.now.windDir }),
        (0, jsxRuntime.jsxs)(`div`, {
          className: `min-w-0`,
          children: [
            (0, jsxRuntime.jsxs)(`div`, {
              className: `tabular text-[20px] leading-none font-semibold text-ink`,
              children: [
                Math.round(e.now.wind),
                ` `,
                (0, jsxRuntime.jsx)(`span`, { className: `text-[11px] font-medium text-ink-2`, children: t }),
              ],
            }),
            (0, jsxRuntime.jsxs)(`div`, {
              className: `mt-1 text-[10.5px] leading-tight text-ink-2`,
              children: [
                me(e.now.windDir),
                n >= e.now.wind + 1 &&
                  (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
                    children: [
                      (0, jsxRuntime.jsx)(`br`, {}),
                      o(`порывы до ${Math.round(n)}`, `gusts to ${Math.round(n)}`),
                    ],
                  }),
              ],
            }),
          ],
        }),
      ],
    }),
  });
}
function bA({ w: e }) {
  let t = (e.now.pressure ?? 0) > 0;
  return (0, jsxRuntime.jsxs)(_A, {
    mark: `humidity`,
    title: o(`Влажность`, `Humidity`),
    children: [
      (0, jsxRuntime.jsxs)(`div`, {
        className: `tabular mt-1 text-[22px] leading-none font-semibold text-ink`,
        children: [e.now.humidity, `%`],
      }),
      (0, jsxRuntime.jsx)(`div`, {
        className: `mt-2 h-[5px] rounded-full bg-white/10`,
        children: (0, jsxRuntime.jsx)(`div`, {
          className: `h-full rounded-full bg-gradient-to-r from-[#5dcaa5] to-rain`,
          style: { width: `${Math.min(100, e.now.humidity)}%` },
        }),
      }),
      (0, jsxRuntime.jsx)(`span`, { className: `flex-1` }),
      t &&
        (0, jsxRuntime.jsx)(`div`, {
          className: `text-[10.5px] text-ink-2`,
          children: o(`Точка росы ${at(e.now.dewPoint ?? 0)}`, `Dew point ${at(e.now.dewPoint ?? 0)}`),
        }),
    ],
  });
}
function xA({ w: e }) {
  let t = e.now.pressure ?? 0,
    [n, r] = Gt(t, e.units),
    i = Math.min(1, Math.max(0, (t - 960) / 100)),
    a = Math.PI * (1 - i),
    s = [32 + 26 * Math.cos(a), 36 - 26 * Math.sin(a)];
  return (0, jsxRuntime.jsxs)(_A, {
    mark: `pressure`,
    title: o(`Давление`, `Pressure`),
    children: [
      (0, jsxRuntime.jsxs)(`div`, {
        className: `mt-1 flex items-end gap-2`,
        children: [
          (0, jsxRuntime.jsxs)(`svg`, {
            width: `64`,
            height: `40`,
            viewBox: `0 0 64 40`,
            className: `shrink-0 text-ink`,
            "aria-hidden": !0,
            children: [
              (0, jsxRuntime.jsx)(`path`, {
                d: `M6 36 A26 26 0 0 1 58 36`,
                fill: `none`,
                stroke: `currentColor`,
                strokeOpacity: `.14`,
                strokeWidth: `5`,
                strokeLinecap: `round`,
              }),
              t > 0 &&
                (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
                  children: [
                    (0, jsxRuntime.jsx)(`path`, {
                      d: `M6 36 A26 26 0 0 1 ${s[0]} ${s[1]}`,
                      fill: `none`,
                      stroke: `var(--color-accent)`,
                      strokeWidth: `5`,
                      strokeLinecap: `round`,
                    }),
                    (0, jsxRuntime.jsx)(`path`, {
                      d: `M32 36 L${32 + 20 * Math.cos(a)} ${36 - 20 * Math.sin(a)}`,
                      stroke: `currentColor`,
                      strokeWidth: `2.2`,
                      strokeLinecap: `round`,
                    }),
                    (0, jsxRuntime.jsx)(`circle`, { cx: `32`, cy: `36`, r: `3`, fill: `currentColor` }),
                  ],
                }),
            ],
          }),
          (0, jsxRuntime.jsxs)(`div`, {
            className: `min-w-0`,
            children: [
              (0, jsxRuntime.jsx)(`div`, {
                className: `tabular text-[18px] leading-none font-semibold text-ink`,
                children: n,
              }),
              (0, jsxRuntime.jsx)(`div`, { className: `truncate text-[10px] text-ink-2`, children: r }),
            ],
          }),
        ],
      }),
      (0, jsxRuntime.jsx)(`span`, { className: `flex-1` }),
      t > 0 &&
        (0, jsxRuntime.jsx)(`div`, {
          className: `text-[10.5px] text-ink-2`,
          children: Ne(e.now.pressureTrend),
        }),
    ],
  });
}
function SA({ w: e }) {
  let t = e.days[0];
  if (!t || !t.sunrise || !t.sunset)
    return (0, jsxRuntime.jsx)(_A, {
      mark: `sun`,
      title: o(`Солнце`, `Sun`),
      children: (0, jsxRuntime.jsx)(`div`, {
        className: `mt-2 text-[12px] text-ink-2`,
        children: o(`Данные о восходе и закате недоступны`, `Sunrise and sunset data unavailable`),
      }),
    });
  let n = Math.floor(Date.now() / 1e3),
    r = t.sunset - t.sunrise,
    i = (n - t.sunrise) / r,
    a = i >= 0 && i <= 1,
    s = Math.min(1, Math.max(0, i)),
    c = 6 + s * 106,
    l = 40 - Math.sin(Math.PI * s) * 34,
    u = Math.floor(r / 3600),
    d = Math.round((r % 3600) / 60);
  return (0, jsxRuntime.jsxs)(_A, {
    mark: `sun`,
    title: o(`Солнце`, `Sun`),
    hint: o(`Световой день ${u} ч ${d} мин`, `Daylight ${u} h ${d} min`),
    children: [
      (0, jsxRuntime.jsxs)(`svg`, {
        width: `118`,
        height: `46`,
        viewBox: `0 0 118 46`,
        className: `mt-1 max-w-full text-ink`,
        "aria-hidden": !0,
        children: [
          (0, jsxRuntime.jsx)(`path`, {
            d: `M6 40 Q59 -28 112 40`,
            fill: `none`,
            stroke: `#f7c35f`,
            strokeOpacity: `.45`,
            strokeWidth: `1.6`,
            strokeDasharray: `3 3`,
          }),
          (0, jsxRuntime.jsx)(`line`, {
            x1: `2`,
            y1: `40`,
            x2: `116`,
            y2: `40`,
            stroke: `currentColor`,
            strokeOpacity: `.18`,
          }),
          (0, jsxRuntime.jsx)(`circle`, { cx: c, cy: l, r: `4.5`, fill: `#f7c35f`, opacity: a ? 1 : 0.4 }),
        ],
      }),
      (0, jsxRuntime.jsx)(`span`, { className: `flex-1` }),
      (0, jsxRuntime.jsxs)(`div`, {
        className: `tabular flex justify-between text-[10.5px] text-ink-2`,
        children: [
          (0, jsxRuntime.jsxs)(`span`, { children: [`↑ `, rt(t.sunrise, e.timezone || e.utcOffset)] }),
          (0, jsxRuntime.jsxs)(`span`, { children: [`↓ `, rt(t.sunset, e.timezone || e.utcOffset)] }),
        ],
      }),
    ],
  });
}
function CA({ w: e }) {
  let [t, ...n] = Fe(e.days[0]?.precip ?? 0, e.units, !0).split(` `),
    r = Math.max(1, ...e.hours.map((e) => e.precip));
  return (0, jsxRuntime.jsxs)(_A, {
    mark: `precip`,
    title: o(`Осадки`, `Precipitation`),
    hint: o(
      `Сколько выпадет до конца суток и по часам`,
      `How much falls by the end of the day, and hour by hour`,
    ),
    children: [
      (0, jsxRuntime.jsxs)(`div`, {
        className: `tabular mt-1 text-[20px] leading-none font-semibold text-ink`,
        children: [
          t,
          ` `,
          (0, jsxRuntime.jsx)(`span`, {
            className: `text-[11px] font-medium text-ink-2`,
            children: o(`${n.join(` `)} за сутки`, `${n.join(` `)} today`),
          }),
        ],
      }),
      (0, jsxRuntime.jsx)(`span`, { className: `flex-1` }),
      (0, jsxRuntime.jsx)(`div`, {
        className: `flex h-[30px] items-end gap-[2px]`,
        children: e.hours.map((e) =>
          (0, jsxRuntime.jsx)(
            `div`,
            {
              className: `min-w-0 flex-1 rounded-[2px] ${e.precip >= 0.1 ? `bg-rain` : `bg-white/12`}`,
              style: { height: e.precip >= 0.1 ? `${Math.max(12, (e.precip / r) * 100)}%` : 2 },
            },
            e.time,
          ),
        ),
      }),
    ],
  });
}
function wA({ w: e }) {
  if (!Number.isFinite(e.now.uv))
    return (0, jsxRuntime.jsx)(_A, {
      mark: `uv`,
      title: o(`УФ-индекс`, `UV index`),
      children: (0, jsxRuntime.jsx)(`div`, {
        className: `mt-2 text-[12px] text-ink-2`,
        children: o(`Нет данных у источника`, `No data from the provider`),
      }),
    });
  let t = e.now.uv,
    n = e.days[1]?.uvMax;
  return (0, jsxRuntime.jsxs)(_A, {
    mark: `uv`,
    title: o(`УФ-индекс`, `UV index`),
    hint: o(`Индекс при ясном небе: облака его снижают`, `The index under a clear sky: clouds bring it down`),
    children: [
      (0, jsxRuntime.jsxs)(`div`, {
        className: `mt-1 flex items-baseline gap-1.5`,
        children: [
          (0, jsxRuntime.jsx)(`span`, {
            className: `tabular text-[22px] leading-none font-semibold text-ink`,
            children: Math.round(t),
          }),
          (0, jsxRuntime.jsx)(`span`, {
            className: `truncate text-[12px] font-medium text-ink-2`,
            children: qe(t),
          }),
        ],
      }),
      (0, jsxRuntime.jsx)(`div`, {
        className: `relative mt-2 h-[5px] rounded-full bg-gradient-to-r from-[#5dcaa5] via-[#f7c35f] to-[#7f77dd]`,
        children: (0, jsxRuntime.jsx)(`div`, {
          className: `absolute -top-[3px] size-[11px] rounded-full bg-[#fff] ring-2 ring-island`,
          style: { left: `calc(${Math.min(1, t / 11) * 100}% - 5px)` },
        }),
      }),
      (0, jsxRuntime.jsx)(`span`, { className: `flex-1` }),
      n !== void 0 &&
        (0, jsxRuntime.jsx)(`div`, {
          className: `text-[10.5px] text-ink-2`,
          children: o(`Завтра до ${Math.round(n)}`, `Tomorrow up to ${Math.round(n)}`),
        }),
    ],
  });
}
function TA({ onDone: e, first: t = !1 }) {
  return (
    (0, ReactRuntime.useEffect)(
      () => (useIslandStore.getState().setHoldOpen(!0), () => useIslandStore.getState().setHoldOpen(!1)),
      [],
    ),
    (0, jsxRuntime.jsxs)(`div`, {
      className: `flex min-h-0 flex-1 flex-col gap-2 rounded-[18px] bg-tile p-3`,
      children: [
        (0, jsxRuntime.jsxs)(`div`, {
          className: `flex items-center gap-2`,
          children: [
            (0, jsxRuntime.jsx)(`span`, {
              className: `flex-1 text-[13px] font-semibold text-ink`,
              children: t
                ? o(`Где показывать погоду?`, `Where should the weather be for?`)
                : o(`Другой город`, `Another city`),
            }),
            e &&
              (0, jsxRuntime.jsx)(`button`, {
                title: o(`Закрыть`, `Close`),
                onClick: e,
                className: `press grid size-6 place-items-center rounded-lg text-ink-3 hover:bg-white/10 hover:text-ink`,
                children: (0, jsxRuntime.jsx)(yr, { size: 13 }),
              }),
          ],
        }),
        (0, jsxRuntime.jsx)(Yn, {
          autoFocus: !0,
          onPick: (t) => {
            (dn.getState().setPlace(t), e?.());
          },
          onFocusInput: () => void u.takeFocus(),
        }),
        t &&
          (0, jsxRuntime.jsx)(`div`, {
            className: `mt-auto text-[11px] leading-snug text-ink-3`,
            children: o(
              `Город выбирается один раз и хранится на этом компьютере. По адресу в сети остров его не угадывает: с VPN вышла бы другая страна.`,
              `The city is chosen once and kept on this computer. The island does not guess it from your network address: with a VPN that would be another country.`,
            ),
          }),
      ],
    })
  );
}
function EA() {
  let e = dn((e) => e.data),
    t = dn((e) => e.loading),
    n = dn((e) => e.error),
    r = useIslandStore((e) => e.settings?.weatherCity ?? ``),
    [i, a] = (0, ReactRuntime.useState)(!1);
  return r.trim()
    ? e
      ? (0, jsxRuntime.jsxs)(`div`, {
          className: `grid h-full grid-cols-[198px_minmax(0,1fr)] gap-2.5`,
          children: [
            (0, jsxRuntime.jsx)(pA, { w: e, onCity: () => a((e) => !e) }),
            (0, jsxRuntime.jsx)(`div`, {
              className: `flex min-h-0 min-w-0 flex-col gap-2.5`,
              children: i
                ? (0, jsxRuntime.jsx)(TA, { onDone: () => a(!1) })
                : (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
                    children: [
                      (0, jsxRuntime.jsx)(gA, { w: e }),
                      e.timezoneWarning && (0, jsxRuntime.jsx)(`button`, {
                        "data-weather-timezone-warning": true,
                        onClick: () => void u.openSettings(`weather`),
                        style: { color: `#ffdfac`, background: `#3c3021`, borderRadius: 8, padding: `6px 9px`, fontSize: 11, textAlign: `left`, flexShrink: 0 },
                        children: o(`Часовой пояс не определён: время в UTC. Выбрать пояс →`, `Time zone unavailable: times are in UTC. Choose a zone →`),
                      }),
                      (0, jsxRuntime.jsxs)(`div`, {
                        className: `grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-2`,
                        children: [
                          (0, jsxRuntime.jsx)(yA, { w: e }),
                          (0, jsxRuntime.jsx)(bA, { w: e }),
                          (0, jsxRuntime.jsx)(xA, { w: e }),
                          (0, jsxRuntime.jsx)(SA, { w: e }),
                          (0, jsxRuntime.jsx)(CA, { w: e }),
                          (0, jsxRuntime.jsx)(wA, { w: e }),
                        ],
                      }),
                    ],
                  }),
            }),
          ],
        })
      : (0, jsxRuntime.jsx)(`div`, {
          className: `grid h-full place-items-center rounded-[18px] bg-tile`,
          children: (0, jsxRuntime.jsxs)(`div`, {
            className: `flex max-w-[380px] flex-col items-center gap-2 px-6 text-center`,
            children: [
              n
                ? (0, jsxRuntime.jsx)(Wa, { size: 22, className: `text-ink-3` })
                : (0, jsxRuntime.jsx)(Ve, { size: 22, className: `animate-spin text-accent` }),
              (0, jsxRuntime.jsx)(`div`, {
                className: `text-[13px] font-semibold text-ink`,
                children: n
                  ? o(`Прогноз не загрузился`, `The forecast didn't load`)
                  : o(`Загружаю прогноз: ${r}…`, `Loading the forecast: ${r}…`),
              }),
              n &&
                (0, jsxRuntime.jsx)(`div`, {
                  className: `line-clamp-3 text-[11.5px] leading-snug text-ink-3`,
                  children: n,
                }),
              n &&
                (0, jsxRuntime.jsx)(`button`, {
                  disabled: t,
                  onClick: () => dn.getState().refresh(),
                  className: `press mt-1 h-7 rounded-lg bg-white px-3 text-[11.5px] font-semibold text-black disabled:opacity-50`,
                  children: o(`Попробовать ещё раз`, `Try again`),
                }),
            ],
          }),
        })
    : (0, jsxRuntime.jsxs)(`div`, {
        className: `grid h-full grid-cols-[198px_1fr] gap-2.5`,
        children: [
          (0, jsxRuntime.jsxs)(`div`, {
            className: `on-dark relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-[18px] text-white`,
            children: [
              (0, jsxRuntime.jsx)(pt, { sky: `partly`, night: !1 }),
              (0, jsxRuntime.jsx)(nn, { sky: `partly`, size: 84, className: `relative` }),
              (0, jsxRuntime.jsx)(`div`, {
                className: `relative px-4 text-center text-[13px] leading-snug font-medium`,
                children: o(
                  `Прогноз на сейчас, на сутки и на неделю`,
                  `The forecast for now, for a day and for a week`,
                ),
              }),
            ],
          }),
          (0, jsxRuntime.jsx)(TA, { first: !0 }),
        ],
      });
}
var DA = [
  {
    id: `home`,
    get label() {
      return o(`Главная`, `Home`);
    },
    icon: (0, jsxRuntime.jsx)(yo, { size: 15 }),
  },
  {
    id: `clipboard`,
    get label() {
      return o(`Буфер`, `Clipboard`);
    },
    icon: (0, jsxRuntime.jsx)(Kn, { size: 15 }),
  },
  {
    id: `shelf`,
    get label() {
      return o(`Полка`, `Shelf`);
    },
    icon: (0, jsxRuntime.jsx)(Hn, { size: 15 }),
  },
  {
    id: `text`,
    get label() {
      return o(`Текст`, `Text`);
    },
    icon: (0, jsxRuntime.jsx)(te, { size: 15 }),
  },
  {
    id: `chat`,
    get label() {
      return o(`Чат`, `Chat`);
    },
    icon: (0, jsxRuntime.jsx)(Nn, { size: 15 }),
  },
  {
    id: `note`,
    get label() {
      return o(`Заметка`, `Note`);
    },
    icon: (0, jsxRuntime.jsx)(er, { size: 15 }),
  },
  {
    id: `weather`,
    get label() {
      return o(`Погода`, `Weather`);
    },
    icon: (0, jsxRuntime.jsx)(nr, { size: 15 }),
  },
  {
    id: `controls`,
    get label() {
      return o(`Управление`, `Controls`);
    },
    icon: (0, jsxRuntime.jsx)(mn, { size: 15 }),
  },
];
function OA({ tab: e }) {
  let t = useIslandStore((e) => e.license.pro);
  if (!t && e === `chat`) return (0, jsxRuntime.jsx)(ck, { feature: `ai` });
  if (!t && e === `weather`) return (0, jsxRuntime.jsx)(ck, { feature: `weather` });
  switch (e) {
    case `home`:
      return (0, jsxRuntime.jsx)(Zt, {});
    case `clipboard`:
      return (0, jsxRuntime.jsx)(_t, {});
    case `shelf`:
      return (0, jsxRuntime.jsx)(mk, {});
    case `text`:
      return (0, jsxRuntime.jsx)(fA, {});
    case `chat`:
      return (0, jsxRuntime.jsx)(dc, {});
    case `note`:
      return (0, jsxRuntime.jsx)(sk, {});
    case `weather`:
      return (0, jsxRuntime.jsx)(EA, {});
    case `controls`:
      return (0, jsxRuntime.jsx)(Sc, {});
  }
}
function kA() {
  let e = useIslandStore((e) => e.settings?.showPrivacy !== !1 && e.privacy.mic.length > 0),
    t = useIslandStore((e) => e.privacy.mic),
    n = useIslandStore((e) => e.audio?.micMuted === !0);
  return e
    ? (0, jsxRuntime.jsxs)(`button`, {
        title: o(
          `Микрофон: ${t.join(`, `)} · клик — ${n ? `включить` : `выключить`}`,
          `Microphone: ${t.join(`, `)} · click to ${n ? `unmute` : `mute`}`,
        ),
        onClick: () => void u.micToggle(),
        className: `press flex h-7 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-semibold ${n ? `bg-danger/20 text-danger` : `bg-orange-400/20 text-orange-300`}`,
        children: [
          n ? (0, jsxRuntime.jsx)(Lo, { size: 13 }) : (0, jsxRuntime.jsx)(jn, { size: 13 }),
          (0, jsxRuntime.jsx)(`span`, {
            className: `max-w-[96px] truncate`,
            children: n ? o(`выкл`, `off`) : t[0],
          }),
        ],
      })
    : null;
}
function AA() {
  let e = useIslandStore((e) => (e.settings?.showVpn === !1 ? null : e.vpn)),
    [t, n] = (0, ReactRuntime.useState)(!1),
    [r, i] = (0, ReactRuntime.useState)(null);
  if (
    ((0, ReactRuntime.useEffect)(() => {
      if (!r) return;
      let e = setTimeout(() => i(null), 8e3);
      return () => clearTimeout(e);
    }, [r]),
    !e)
  )
    return null;
  let a = e.countryCode ?? (e.active ? `VPN` : `—`),
    s = [
      e.active === null ? o(`Состояние VPN неизвестно`, `VPN status unknown`) : e.active ? o(`VPN подключён`, `VPN connected`) : o(`VPN отключён`, `VPN off`),
      e.country,
      e.ip,
      e.via,
    ]
      .filter(Boolean)
      .join(` · `),
    c = async () => {
      if (!t) {
        (n(!0), i(null));
        try {
          (await u.vpnChip()) &&
            (useIslandStore.getState().settings?.moduleControls === !1
              ? i(
                  o(
                    `Какой VPN включить, спрашивает центр управления: включи его в настройках`,
                    `Which VPN to bring up is asked in the control centre: turn it on in the settings`,
                  ),
                )
              : (useIslandStore.setState({ vpnAsk: Date.now() }),
                useIslandStore.getState().setTab(`controls`)));
        } catch (e) {
          useIslandStore.getState().expanded
            ? i(String(e))
            : useIslandStore.getState().pushPeek({ kind: `error`, message: String(e) });
        } finally {
          n(!1);
        }
      }
    },
    l = t
      ? o(`Жду ответа VPN…`, `Waiting for the VPN…`)
      : `${s}
${e.active === null ? o(`Клик — выбрать команду VPN`, `Click to choose a VPN command`) : e.active ? o(`Клик — отключить VPN`, `Click to turn the VPN off`) : o(`Клик — включить VPN`, `Click to turn the VPN on`)} · ${o(`правый клик — проверить заново`, `right-click to check again`)}`;
  return (0, jsxRuntime.jsxs)(`button`, {
    "data-vpn-chip": !0,
    "data-vpn-busy": t || void 0,
    "data-vpn-fail": r ? `` : void 0,
    title: r ?? l,
    onClick: () => void c(),
    onContextMenu: (e) => {
      (e.preventDefault(), u.vpnRefresh());
    },
    className: `press flex h-7 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-semibold ${r ? `bg-rose-500/15 text-stop-ink` : e.active ? `bg-emerald-400/15 text-emerald-300` : `bg-white/8 text-ink-3`}`,
    children: [
      t
        ? (0, jsxRuntime.jsx)(Ve, { size: 13, className: `animate-spin` })
        : r
          ? (0, jsxRuntime.jsx)(as, { size: 13 })
          : e.active
            ? (0, jsxRuntime.jsx)(cs, { size: 13 })
            : (0, jsxRuntime.jsx)(us, { size: 13 }),
      a,
    ],
  });
}
function jA() {
  let e = useIslandStore((e) => e.tab),
    t = useIslandStore((e) => e.setTab),
    n = useIslandStore((e) => e.pinned),
    r = useIslandStore((e) => e.togglePin),
    i = useIslandStore((e) => e.settings?.moduleShelf !== !1),
    a = useIslandStore((e) => e.shelf.length),
    s = useIslandStore((e) => e.settings?.moduleWeather !== !1),
    c = useIslandStore((e) => e.settings?.moduleControls !== !1),
    l = useIslandStore((e) => e.settings?.tabsHidden),
    d = DA.filter((e) => (e.id !== `shelf` || i) && (e.id !== `weather` || s) && (e.id !== `controls` || c)),
    f = d.some((t) => t.id === e) ? e : `home`,
    p = d.filter((e) => e.id === f || !l?.includes(e.id)),
    m = (0, ReactRuntime.useRef)(null);
  (0, ReactRuntime.useLayoutEffect)(() => {
    let e = m.current;
    if (!e) return;
    let t = [...e.children],
      n = 32 + 4 * (t.length - 1);
    for (let e of t) {
      if (e.classList.contains(`flex-1`)) continue;
      n += e.offsetWidth + parseFloat(getComputedStyle(e).marginRight || `0`);
      let t = e.querySelector(`.tab-name`);
      t && (n += Math.max(0, t.scrollWidth - t.clientWidth));
    }
    ((n = Math.ceil(n)),
      Math.abs(useIslandStore.getState().headerMin - n) > 2 && useIslandStore.setState({ headerMin: n }));
  });
  let [h, g] = (0, ReactRuntime.useState)(!1);
  return (
    (0, ReactRuntime.useEffect)(() => {
      let e = requestAnimationFrame(() => (0, ReactRuntime.startTransition)(() => g(!0)));
      return () => cancelAnimationFrame(e);
    }, []),
    (0, jsxRuntime.jsxs)(`div`, {
      className: `flex h-full flex-col px-4 pt-3 pb-4`,
      children: [
        (0, jsxRuntime.jsxs)(`header`, {
          ref: m,
          className: `flex h-9 shrink-0 items-center gap-1`,
          children: [
            p.map((e) =>
              (0, jsxRuntime.jsxs)(
                `button`,
                {
                  onClick: () => t(e.id),
                  className: `press relative flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium ${f === e.id ? `min-w-0 text-ink` : `shrink-0 text-ink-3 hover:text-ink-2`}`,
                  children: [
                    (0, jsxRuntime.jsx)(`span`, {
                      className: `absolute inset-0 rounded-full bg-white/12 transition-opacity duration-150 ${f === e.id ? `opacity-100` : `opacity-0`}`,
                    }),
                    (0, jsxRuntime.jsx)(
                      `span`,
                      {
                        className: `relative shrink-0 ${f === e.id ? `pop-in` : ``}`,
                        title: e.label,
                        children: e.icon,
                      },
                      f === e.id ? `on` : `off`,
                    ),
                    f === e.id &&
                      (0, jsxRuntime.jsx)(`span`, {
                        className: `tab-name relative min-w-0 truncate`,
                        children: e.label,
                      }),
                    e.id === `shelf` &&
                      a > 0 &&
                      (0, jsxRuntime.jsx)(`span`, {
                        className: `tabular relative rounded-full bg-white/15 px-1.5 text-[10px] leading-4 text-ink`,
                        children: a,
                      }),
                  ],
                },
                e.id,
              ),
            ),
            (0, jsxRuntime.jsx)(`div`, { className: `flex-1` }),
            (0, jsxRuntime.jsxs)(`div`, {
              className: `mr-1 flex shrink-0 items-center gap-1.5`,
              children: [(0, jsxRuntime.jsx)(kA, {}), (0, jsxRuntime.jsx)(AA, {})],
            }),
            (0, jsxRuntime.jsx)(be, {
              className: `shrink-0`,
              "data-dictate": !0,
              title: o(`Голос в текст`, `Voice to text`),
              onClick: () => {
                (useIslandStore.getState().close(), setTimeout(() => void u.dictateToggle(), 150));
              },
              children: (0, jsxRuntime.jsx)(ba, { size: 15 }),
            }),
            (0, jsxRuntime.jsx)(be, {
              className: `shrink-0`,
              title: n ? o(`Открепить`, `Unpin`) : o(`Закрепить открытым`, `Keep open`),
              active: n,
              onClick: r,
              children: (0, jsxRuntime.jsx)(ge, {
                size: 15,
                fill: n ? `currentColor` : `none`,
                className: `transition-transform duration-300 ease-[cubic-bezier(0.3,1.5,0.5,1)] ${n ? `-rotate-45` : ``}`,
              }),
            }),
            (0, jsxRuntime.jsx)(be, {
              className: `shrink-0`,
              title: o(`Настройки`, `Settings`),
              onClick: () => {
                (useIslandStore.getState().close(), u.openSettings());
              },
              children: (0, jsxRuntime.jsx)(rs, { size: 15 }),
            }),
          ],
        }),
        (0, jsxRuntime.jsx)(`div`, {
          className: `relative mt-3 min-h-0 flex-1`,
          children: (0, jsxRuntime.jsx)(Wt, {
            mode: `wait`,
            initial: !1,
            children: (0, jsxRuntime.jsx)(
              Et.div,
              {
                className: `absolute inset-0`,
                initial: { opacity: 0, y: 6 },
                animate: { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] } },
                exit: { opacity: 0, y: -4, transition: { duration: 0.08 } },
                children: h && (0, jsxRuntime.jsx)(OA, { tab: f }),
              },
              f,
            ),
          }),
        }),
      ],
    })
  );
}
var MA = {
    sqrt: Math.sqrt,
    корень: Math.sqrt,
    sin: (e) => Math.sin(e),
    cos: (e) => Math.cos(e),
    tan: (e) => Math.tan(e),
    ln: Math.log,
    log: Math.log10,
    abs: Math.abs,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil,
  },
  NA = { pi: Math.PI, пи: Math.PI, e: Math.E };
function PA(e) {
  let t = e
      .replace(/×|х(?=\s*\d)/g, `*`)
      .replace(/÷|:/g, `/`)
      .replace(/−/g, `-`),
    n = [],
    r = 0;
  for (; r < t.length; ) {
    let e = t[r];
    if (e === ` ` || e === `\xA0`) {
      r++;
      continue;
    }
    let i = /^\d+(?:[  ]\d{3})*(?:[.,]\d+)?/.exec(t.slice(r));
    if (i) {
      (n.push({ t: `num`, v: parseFloat(i[0].replace(/[  ]/g, ``).replace(`,`, `.`)) }), (r += i[0].length));
      continue;
    }
    if (`+-*/^%()`.includes(e)) {
      (n.push({ t: `op`, v: e }), r++);
      continue;
    }
    let a = /^[a-zа-яё]+/i.exec(t.slice(r));
    if (a) {
      (n.push({ t: `id`, v: a[0].toLowerCase() }), (r += a[0].length));
      continue;
    }
    return null;
  }
  return n;
}
function FA(e) {
  let t = PA(e);
  if (!t || t.length === 0) return null;
  let n = t;
  if (!n.some((e) => e.t === `op` || (e.t === `id` && (e.v in MA || e.v in NA)))) return null;
  let r = 0,
    i = () => n[r],
    a = (e) => {
      let t = n[r];
      return t && t.t === `op` && t.v === e ? (r++, !0) : !1;
    };
  function o() {
    let e = n[r++];
    if (!e) throw Error(`end`);
    if (e.t === `num`) return e.v;
    if (e.t === `op` && e.v === `(`) {
      let e = u();
      if (!a(`)`)) throw Error(`)`);
      return e;
    }
    if (e.t === `op` && e.v === `-`) return -c();
    if (e.t === `op` && e.v === `+`) return c();
    if (e.t === `id`) {
      if (e.v in NA) return NA[e.v];
      if (e.v in MA) return MA[e.v](c());
    }
    throw Error(`token`);
  }
  function s() {
    let e = o();
    for (; a(`%`); ) e /= 100;
    return e;
  }
  function c() {
    let e = s();
    return a(`^`) ? e ** +c() : e;
  }
  function l() {
    let e = c();
    for (;;)
      if (a(`*`)) e *= c();
      else if (a(`/`)) e /= c();
      else {
        let t = i();
        if (t && ((t.t === `op` && t.v === `(`) || t.t === `id`)) e *= c();
        else return e;
      }
  }
  function u() {
    let e = l();
    for (;;)
      if (a(`+`)) e += l();
      else if (a(`-`)) e -= l();
      else return e;
  }
  try {
    let e = u();
    return r !== n.length || !Number.isFinite(e) ? null : e;
  } catch {
    return null;
  }
}
function IA(e) {
  let n = Math.abs(e);
  return n !== 0 && (n >= 0x38d7ea4c68000 || n < 1e-6)
    ? t() === `ru`
      ? e.toExponential(6).replace(`.`, `,`)
      : e.toExponential(6)
    : e.toLocaleString(h(), { maximumFractionDigits: n < 1 ? 8 : 6 });
}
var LA = [
  {
    id: `mm`,
    kind: `len`,
    k: 0.001,
    label: `мм`,
    en: `mm`,
    exact: [`мм`, `mm`],
    stems: [`миллиметр`, `millimet`],
  },
  {
    id: `cm`,
    kind: `len`,
    k: 0.01,
    label: `см`,
    en: `cm`,
    exact: [`см`, `cm`],
    stems: [`сантиметр`, `centimet`],
  },
  { id: `m`, kind: `len`, k: 1, label: `м`, en: `m`, exact: [`м`, `m`], stems: [`метр`, `meter`, `metre`] },
  {
    id: `km`,
    kind: `len`,
    k: 1e3,
    label: `км`,
    en: `km`,
    exact: [`км`, `km`],
    stems: [`километр`, `kilomet`],
  },
  { id: `in`, kind: `len`, k: 0.0254, label: `дюйм`, en: `in`, exact: [`in`, `"`], stems: [`дюйм`, `inch`] },
  { id: `ft`, kind: `len`, k: 0.3048, label: `фут`, en: `ft`, exact: [`ft`], stems: [`фут`, `feet`, `foot`] },
  { id: `yd`, kind: `len`, k: 0.9144, label: `ярд`, en: `yd`, exact: [`yd`], stems: [`ярд`, `yard`] },
  { id: `mi`, kind: `len`, k: 1609.344, label: `миль`, en: `mi`, exact: [`mi`], stems: [`мил`, `mile`] },
  {
    id: `mg`,
    kind: `mass`,
    k: 1e-6,
    label: `мг`,
    en: `mg`,
    exact: [`мг`, `mg`],
    stems: [`миллиграм`, `milligram`],
  },
  { id: `g`, kind: `mass`, k: 0.001, label: `г`, en: `g`, exact: [`г`, `гр`, `g`], stems: [`грамм`, `gram`] },
  {
    id: `kg`,
    kind: `mass`,
    k: 1,
    label: `кг`,
    en: `kg`,
    exact: [`кг`, `kg`],
    stems: [`килограмм`, `kilogram`],
  },
  { id: `t`, kind: `mass`, k: 1e3, label: `т`, en: `t`, exact: [`т`, `t`], stems: [`тонн`, `ton`] },
  {
    id: `lb`,
    kind: `mass`,
    k: 0.45359237,
    label: `фунт`,
    en: `lb`,
    exact: [`lb`, `lbs`],
    stems: [`фунт`, `pound`],
  },
  {
    id: `oz`,
    kind: `mass`,
    k: 0.028349523125,
    label: `унц`,
    en: `oz`,
    exact: [`oz`],
    stems: [`унци`, `ounce`],
  },
  {
    id: `ml`,
    kind: `vol`,
    k: 0.001,
    label: `мл`,
    en: `ml`,
    exact: [`мл`, `ml`],
    stems: [`миллилитр`, `millilit`],
  },
  { id: `l`, kind: `vol`, k: 1, label: `л`, en: `L`, exact: [`л`, `l`], stems: [`литр`, `liter`, `litre`] },
  {
    id: `gal`,
    kind: `vol`,
    k: 3.785411784,
    label: `галлон`,
    en: `gal`,
    exact: [`gal`],
    stems: [`галлон`, `gallon`],
  },
  { id: `b`, kind: `data`, k: 1, label: `Б`, en: `B`, exact: [`б`, `b`], stems: [`байт`, `byte`] },
  {
    id: `kb`,
    kind: `data`,
    k: 1024,
    label: `КБ`,
    en: `KB`,
    exact: [`кб`, `kb`],
    stems: [`килобайт`, `kilobyte`],
  },
  {
    id: `mb`,
    kind: `data`,
    k: 1024 ** 2,
    label: `МБ`,
    en: `MB`,
    exact: [`мб`, `mb`],
    stems: [`мегабайт`, `megabyte`],
  },
  {
    id: `gb`,
    kind: `data`,
    k: 1024 ** 3,
    label: `ГБ`,
    en: `GB`,
    exact: [`гб`, `gb`],
    stems: [`гигабайт`, `gigabyte`],
  },
  {
    id: `tb`,
    kind: `data`,
    k: 1024 ** 4,
    label: `ТБ`,
    en: `TB`,
    exact: [`тб`, `tb`],
    stems: [`терабайт`, `terabyte`],
  },
  {
    id: `s`,
    kind: `time`,
    k: 1,
    label: `с`,
    en: `s`,
    exact: [`с`, `сек`, `s`, `sec`],
    stems: [`секунд`, `second`],
  },
  {
    id: `min`,
    kind: `time`,
    k: 60,
    label: `мин`,
    en: `min`,
    exact: [`мин`, `min`],
    stems: [`минут`, `minute`],
  },
  { id: `h`, kind: `time`, k: 3600, label: `ч`, en: `h`, exact: [`ч`, `h`], stems: [`час`, `hour`] },
  {
    id: `d`,
    kind: `time`,
    k: 86400,
    label: `дн`,
    en: `d`,
    exact: [`д`, `дн`, `d`],
    stems: [`дн`, `ден`, `сут`, `day`],
  },
  { id: `wk`, kind: `time`, k: 604800, label: `нед`, en: `wk`, exact: [`нед`], stems: [`недел`, `week`] },
  {
    id: `kmh`,
    kind: `speed`,
    k: 1 / 3.6,
    label: `км/ч`,
    en: `km/h`,
    exact: [`км/ч`, `kmh`, `km/h`],
    stems: [],
  },
  { id: `ms`, kind: `speed`, k: 1, label: `м/с`, en: `m/s`, exact: [`м/с`, `m/s`], stems: [] },
  { id: `mph`, kind: `speed`, k: 0.44704, label: `mph`, en: `mph`, exact: [`mph`], stems: [] },
  {
    id: `c`,
    kind: `temp`,
    k: 1,
    label: `°C`,
    en: `°C`,
    exact: [`c`, `°c`, `с°`, `°с`],
    stems: [`цельс`, `celsius`],
  },
  {
    id: `f`,
    kind: `temp`,
    k: 1,
    label: `°F`,
    en: `°F`,
    exact: [`f`, `°f`],
    stems: [`фаренгейт`, `fahrenheit`],
  },
  { id: `k`, kind: `temp`, k: 1, label: `K`, en: `K`, exact: [`k`, `к`], stems: [`кельвин`, `kelvin`] },
];
function RA(e) {
  let t = e.toLowerCase().replace(/\.$/, ``),
    n = LA.find((e) => e.exact.includes(t));
  if (n) return n;
  let r = null,
    i = 0;
  for (let e of LA) for (let n of e.stems) t.startsWith(n) && n.length > i && ((r = e), (i = n.length));
  return r;
}
var zA = (e, t) => (t === `c` ? e + 273.15 : t === `f` ? (e - 32) * (5 / 9) + 273.15 : e),
  BA = (e, t) => (t === `c` ? e - 273.15 : t === `f` ? (e - 273.15) * (9 / 5) + 32 : e),
  VA = /^\s*(-?\d+(?:[.,]\d+)?)\s*([^\s\d]+(?:\s+[^\s\d]+)?)\s+(?:в|во|to|in|->|=)\s+(.+?)\s*$/i;
function HA(e) {
  let n = VA.exec(e);
  if (!n) return null;
  let r = parseFloat(n[1].replace(`,`, `.`)),
    i = RA(n[2].trim()) ?? RA(n[2].trim().split(/\s+/)[0]),
    a = RA(n[3].trim()) ?? RA(n[3].trim().split(/\s+/)[0]);
  if (!i || !a || i.kind !== a.kind || i.id === a.id) return null;
  let o = i.kind === `temp` ? BA(zA(r, i.id), a.id) : (r * i.k) / a.k;
  return { value: o, text: `${IA(o)} ${t() === `ru` ? a.label : a.en}` };
}
var UA = [
  { code: `RUB`, symbol: `₽`, words: [`руб`, `rub`, `roubl`, `₽`, `р`] },
  { code: `USD`, symbol: `$`, words: [`usd`, `$`, `доллар`, `долл`, `бакс`, `dollar`] },
  { code: `EUR`, symbol: `€`, words: [`eur`, `€`, `евро`, `euro`] },
  { code: `CNY`, symbol: `¥`, words: [`cny`, `юан`, `yuan`] },
  { code: `GBP`, symbol: `£`, words: [`gbp`, `£`, `стерлинг`] },
  { code: `KZT`, symbol: `₸`, words: [`kzt`, `тенге`, `tenge`] },
  { code: `BYN`, symbol: `Br`, words: [`byn`, `белорусск`] },
  { code: `UAH`, symbol: `₴`, words: [`uah`, `гривн`] },
  { code: `TRY`, symbol: `₺`, words: [`try`, `лир`, `lira`] },
  { code: `JPY`, symbol: `¥`, words: [`jpy`, `иен`, `йен`, `yen`] },
];
function WA(e) {
  let t = e.toLowerCase(),
    n = null,
    r = 0;
  for (let e of UA)
    for (let i of e.words)
      (i.length <= 1 ? t === i : t.startsWith(i)) && i.length > r && ((n = e.code), (r = i.length));
  return n;
}
var GA =
  /^\s*([$€£₽¥₸₴₺]?)\s*(\d+(?:[  ]\d{3})*(?:[.,]\d+)?)\s*([$€£₽¥₸₴₺]|[^\s\d]+)?\s+(?:в|во|to|in|->|=)\s+(\S+)\s*$/i;
function KA(e, t) {
  if (!t) return null;
  let n = GA.exec(e);
  if (!n) return null;
  let r = parseFloat(n[2].replace(/[  ]/g, ``).replace(`,`, `.`)),
    i = WA(n[1] || n[3] || ``),
    a = WA(n[4]);
  if (!i || !a || i === a || !t[i] || !t[a]) return null;
  let o = (r * t[i]) / t[a],
    s = UA.find((e) => e.code === a)?.symbol ?? a;
  return {
    value: o,
    text: `${o.toLocaleString(h(), { maximumFractionDigits: 2, minimumFractionDigits: o < 100 ? 2 : 0 })} ${s}`,
  };
}
function qA(e, t) {
  let n = e.toLowerCase(),
    r = t.toLowerCase().trim();
  if (!r) return 0;
  if (n === r) return 100;
  if (n.startsWith(r)) return 80 - Math.min(20, n.length - r.length);
  let i = n.split(/[\s\-_.()]+/).filter(Boolean);
  return i.some((e) => e.startsWith(r))
    ? 60
    : r.length >= 2 &&
        i
          .map((e) => e[0])
          .join(``)
          .startsWith(r)
      ? 50
      : r.length >= 3 && n.includes(r)
        ? 40
        : 0;
}
var JA = `(?:\\s+(?:компьютер|комп|пк|ноутбук|computer|pc|the computer|the pc))?`,
  YA = RegExp(`^(?:выключи(?:ть)?|выключение|shut ?down|turn off)${JA}\\s+(.+)$`, `i`),
  XA = RegExp(`^(?:перезагрузи(?:ть)?|перезагрузка|перезапусти(?:ть)?|restart|reboot)${JA}\\s+(.+)$`, `i`),
  ZA =
    /^(?:отмени(?:ть)?\s+(?:выключение|перезагрузку)|отмена\s+(?:выключения|перезагрузки)|не\s+выключай|cancel\s+(?:the\s+)?(?:shutdown|restart))$/i,
  QA = 6048e5;
function $A(e, t = new Date()) {
  let n = e.trim().replace(/\s+/g, ` `);
  if (ZA.test(n)) return { kind: `cancel` };
  for (let [e, r] of [
    [YA, `shutdown`],
    [XA, `restart`],
  ]) {
    let i = e.exec(n);
    if (!i) continue;
    let a = Ki(i[1], t);
    if (a && a.getTime() > t.getTime() && a.getTime() - t.getTime() <= QA) return { kind: r, at: a };
  }
  return null;
}
var ej = (e) => !e.startsWith(`shell:`),
  tj = new Map();

function rj(e, t) {
  return Math.max(qA(e, t), qA(e, Yk(t)) - 5);
}
function ij({ onResize: e }) {
  let [n, r] = (0, ReactRuntime.useState)(``),
    [i, a] = (0, ReactRuntime.useState)(0),
    [s, c] = (0, ReactRuntime.useState)([]),
    [l, d] = (0, ReactRuntime.useState)([]),
    [f, p] = (0, ReactRuntime.useState)(null),
    [m, h] = (0, ReactRuntime.useState)({ q: ``, list: [] }),
    [g, _] = (0, ReactRuntime.useState)(!1),
    [v, y] = (0, ReactRuntime.useState)(null),
    b = (0, ReactRuntime.useRef)(null),
    x = (0, ReactRuntime.useRef)(null),
    S = useIslandStore((e) => e.settings),
    C = useIslandStore((e) => e.recording !== null),
    w = useIslandStore((e) => e.settings?.through === !0),
    T = S?.moduleControls !== !1,
    E = S?.showVpn !== !1,
    D = S?.paletteFiles !== !1;
  ((0, ReactRuntime.useEffect)(() => {
    D && u.filesWarm();
  }, [D]),
    (0, ReactRuntime.useEffect)(() => {
      let e = n.trim();
      if (!D || e.length < 2 || e.startsWith(`>`)) {
        h({ q: e, list: [] });
        return;
      }
      let t = !0,
        r = setTimeout(() => {
          u.filesSearch(e)
            .then((n) => t && h({ q: e, list: n }))
            .catch(() => {});
        }, 140);
      return () => {
        ((t = !1), clearTimeout(r));
      };
    }, [n, D]),
    (0, ReactRuntime.useEffect)(
      () => (
        u.paletteApps().then(c),
        u.paletteRecent().then(d),
        u
          .rates()
          .then(p)
          .catch(() => {}),
        u.aiKeyStatus().then(_),
        x.current?.focus(),
        () => b.current?.()
      ),
      [],
    ));
  let O = () => useIslandStore.getState().closePalette(),
    k = (e, t) => {
      (O(), u.clipSetText(e).then(() => useIslandStore.getState().pushPeek({ kind: `done`, label: t })));
    },
    ee = (e) => {
      (O(), Lt(() => void u.captureStart(e)));
    },
    ne = (e) => {
      (useIslandStore.getState().closePalette(), useIslandStore.getState().open(`hotkey`, e));
    },
    re = (e, t = wn()) => {
      (b.current?.(),
        y({ q: e, text: ``, state: `run` }),
        (b.current = gn(t, e, {
          onChunk: (e) => y((t) => t && { ...t, text: t.text + e }),
          onDone: () => y((e) => e && { ...e, state: `done` }),
          onError: (e) => y((t) => t && { ...t, text: e, state: `error` }),
        })));
    },
    ie = (e, t) => {
      O();
      let n = useIslandStore.getState();
      u.controlsGet()
        .then((t) => {
          if (t[e] === null) throw o(`В компьютере нет такого адаптера`, `The computer has no such adapter`);
          return u.controlsSet(e, !t[e]);
        })
        .then((r) =>
          n.pushPeek({
            kind: `done`,
            label: r[e] ? o(`${t}: включено`, `${t}: on`) : o(`${t}: выключено`, `${t}: off`),
          }),
        )
        .catch((e) => n.pushPeek({ kind: `error`, message: String(e) }));
    },
    ae = (0, ReactRuntime.useMemo)(
      () => [
        {
          t: o(`Скриншот области`, `Screenshot of an area`),
          k: `скрин снимок область screenshot area snip`,
          i: (0, jsxRuntime.jsx)(En, { size: 17 }),
          run: () => ee(`area`),
        },
        {
          t: o(`Скриншот экрана`, `Screenshot of the screen`),
          k: `скрин снимок экран весь screenshot screen full`,
          i: (0, jsxRuntime.jsx)(Mn, { size: 17 }),
          run: () => ee(`screen`),
        },
        {
          t: o(`Текст с экрана`, `Text from the screen`),
          k: `текст ocr распознать text recognize`,
          i: (0, jsxRuntime.jsx)(bn, { size: 17 }),
          run: () => ee(`ocr`),
        },
        {
          t: o(`QR-код с экрана`, `QR code from the screen`),
          k: `qr кьюар код code`,
          i: (0, jsxRuntime.jsx)(An, { size: 17 }),
          run: () => ee(`qr`),
        },
        {
          t: o(`Пипетка`, `Color picker`),
          k: `пипетка цвет color picker eyedropper`,
          i: (0, jsxRuntime.jsx)(Sn, { size: 17 }),
          run: () => ee(`color`),
        },
        C
          ? {
              t: o(`Остановить запись экрана`, `Stop the screen recording`),
              k: `запись видео стоп остановить закончить gif record video stop finish`,
              i: (0, jsxRuntime.jsx)(vr, { size: 15 }),
              run: () => {
                (O(), u.recordStop());
              },
            }
          : {
              t: o(`Запись экрана`, `Screen recording`),
              k: `запись видео gif record video`,
              i: (0, jsxRuntime.jsx)(Cn, { size: 17 }),
              run: () => {
                (O(), Lt(() => void u.recordStart()));
              },
            },
        {
          t: o(`Тема острова: тёмная или светлая`, `Island theme: dark or light`),
          k: `тема острова тёмная темная светлая оформление island theme dark light`,
          i: (0, jsxRuntime.jsx)(bs, { size: 17 }),
          run: () => void u.themeFlip(),
        },
        {
          t: w
            ? o(`Сквозной режим: выключить`, `Through mode: turn off`)
            : o(`Сквозной режим: клики проходят сквозь остров`, `Through mode: clicks go through the island`),
          k: `сквозной сквозь прозрачный клики режим призрак through click ghost transparent mode`,
          i: (0, jsxRuntime.jsx)(Vo, { size: 17 }),
          run: () => {
            (O(), u.throughToggle());
          },
        },
        {
          t: o(`Папка со скриншотами`, `Screenshots folder`),
          k: `папка скриншоты снимки недавние открыть folder screenshots recent open`,
          i: (0, jsxRuntime.jsx)(Te, { size: 17 }),
          run: () => {
            (O(), u.openCaptures(`screenshots`));
          },
        },
        {
          t: o(`Папка с записями экрана`, `Screen recordings folder`),
          k: `папка записи видео недавние открыть folder recordings videos recent open`,
          i: (0, jsxRuntime.jsx)(Te, { size: 17 }),
          run: () => {
            (O(), u.openCaptures(`recordings`));
          },
        },
        {
          t: o(`История буфера`, `Clipboard history`),
          k: `буфер история clipboard history`,
          i: (0, jsxRuntime.jsx)(Kn, { size: 17 }),
          run: () => ne(`clipboard`),
        },
        {
          t: o(`Полка файлов`, `File shelf`),
          k: `полка файлы shelf files`,
          i: (0, jsxRuntime.jsx)(Hn, { size: 17 }),
          run: () => ne(`shelf`),
        },
        {
          t: o(`Заметка`, `Note`),
          k: `заметка note блокнот notepad`,
          i: (0, jsxRuntime.jsx)(er, { size: 17 }),
          run: () => ne(`note`),
        },
        {
          t: o(`Таймер и напоминания`, `Timer and reminders`),
          k: `таймер напоминание напомнить будильник секундомер timer reminder remind alarm countdown`,
          i: (0, jsxRuntime.jsx)(_o, { size: 17 }),
          run: () => ne(`note`),
        },
        {
          t: o(`Текст-тулзы`, `Text tools`),
          k: `текст раскладка транслит json text tools layout`,
          i: (0, jsxRuntime.jsx)(te, { size: 17 }),
          run: () => ne(`text`),
        },
        {
          t: o(`Сменить персонажа`, `Change character`),
          k: `персонаж маскот пиксель жидкий питомец character mascot pixel liquid pet`,
          i: (0, jsxRuntime.jsx)(or, { size: 17 }),
          run: () => {
            (O(), u.openSettings());
          },
        },
        {
          t: o(`Голос в текст`, `Voice to text`),
          k: `голос диктовка диктовать речь распознать микрофон voice dictate dictation speech`,
          i: (0, jsxRuntime.jsx)(ba, { size: 17 }),
          run: () => {
            (O(), setTimeout(() => void u.dictateToggle(), 150));
          },
        },
        {
          t: o(`Погода`, `Weather`),
          k: `погода прогноз температура дождь снег weather forecast temperature rain`,
          i: (0, jsxRuntime.jsx)(nr, { size: 17 }),
          run: () => ne(`weather`),
        },
        {
          t: o(`Gemini — веб-версия в чате острова`, `Gemini — the web version in the island's chat`),
          k: `gemini джемини гемини гугл google ии ai веб web сайт чат chat`,
          i: (0, jsxRuntime.jsx)(co, { size: 17 }),
          run: () => fa(`gemini`),
        },
        {
          t: o(`DeepSeek — веб-версия в чате острова`, `DeepSeek — the web version in the island's chat`),
          k: `deepseek дипсик ии ai веб web сайт чат chat`,
          i: (0, jsxRuntime.jsx)(co, { size: 17 }),
          run: () => fa(`deepseek`),
        },
        {
          t: o(`Чат с ИИ`, `AI chat`),
          k: `чат ии ai нейросеть gpt диалог разговор chat assistant`,
          i: (0, jsxRuntime.jsx)(Nn, { size: 17 }),
          run: () => ne(`chat`),
        },
        {
          t: o(`Микрофон: выключить или включить`, `Microphone: mute or unmute`),
          k: `микрофон mute mic microphone unmute`,
          i: (0, jsxRuntime.jsx)(jn, { size: 17 }),
          run: () => {
            (O(), u.micToggle());
          },
        },
        {
          t: o(`Настройки Island`, `Island settings`),
          k: `настройки settings preferences options`,
          i: (0, jsxRuntime.jsx)(rs, { size: 17 }),
          run: () => {
            (O(), u.openSettings());
          },
        },
        {
          t: o(`Что нового в Island`, `What's new in Island`),
          k: `что нового новое изменения версия обновление список changelog whats new changes version release notes`,
          i: (0, jsxRuntime.jsx)(fr, { size: 17 }),
          run: () => {
            (O(), u.openSettings(`updates`));
          },
        },
        ...(T
          ? [
              {
                t: o(`Центр управления`, `Control centre`),
                k: `управление центр питание control centre center power`,
                i: (0, jsxRuntime.jsx)(mn, { size: 17 }),
                run: () => ne(`controls`),
              },
              ...(E
                ? [
                    {
                      t: o(`VPN: включить или выключить`, `VPN: turn on or off`),
                      k: `vpn впн туннель прокси подключить отключить включить выключить tunnel proxy connect disconnect`,
                      i: (0, jsxRuntime.jsx)(cs, { size: 17 }),
                      run: () => {
                        (O(), u.vpnToggle());
                      },
                    },
                  ]
                : []),
              {
                t: o(`Wi-Fi: включить или выключить`, `Wi-Fi: turn on or off`),
                k: `wifi wi-fi вайфай вай-фай сеть интернет беспроводная wireless network`,
                i: (0, jsxRuntime.jsx)(Es, { size: 17 }),
                run: () => ie(`wifi`, `Wi-Fi`),
              },
              {
                t: o(`Bluetooth: включить или выключить`, `Bluetooth: turn on or off`),
                k: `bluetooth блютуз блютус наушники headphones`,
                i: (0, jsxRuntime.jsx)(Aa, { size: 17 }),
                run: () => ie(`bluetooth`, `Bluetooth`),
              },
              {
                t: o(`Тёмная или светлая тема`, `Dark or light theme`),
                k: `тема тёмная темная светлая оформление theme dark light mode`,
                i: (0, jsxRuntime.jsx)(Ja, { size: 17 }),
                run: () => ie(`dark`, o(`Тёмная тема`, `Dark theme`)),
              },
              {
                t: o(`Заблокировать компьютер`, `Lock the computer`),
                k: `блокировка заблокировать экран lock screen`,
                i: (0, jsxRuntime.jsx)(No, { size: 17 }),
                run: () => {
                  (O(), u.powerAction(`lock`));
                },
              },
              {
                t: o(`Спящий режим…`, `Sleep…`),
                k: `сон спящий режим усыпить sleep suspend`,
                i: (0, jsxRuntime.jsx)(zo, { size: 17 }),
                run: () => ne(`controls`),
              },
              {
                t: o(`Перезагрузить компьютер…`, `Restart the computer…`),
                k: `перезагрузка перезагрузить рестарт restart reboot`,
                i: (0, jsxRuntime.jsx)(ts, { size: 17 }),
                run: () => ne(`controls`),
              },
              {
                t: o(`Выключить компьютер…`, `Shut down the computer…`),
                k: `выключить выключение завершение работы shutdown shut down power off`,
                i: (0, jsxRuntime.jsx)(yn, { size: 17 }),
                run: () => ne(`controls`),
              },
            ]
          : []),
      ],
      [C, T, E, w],
    ),
    oe = (0, ReactRuntime.useMemo)(() => {
      let e = n.trim(),
        r = [];
      if (!e)
        return (
          l.slice(0, 3).forEach((e) =>
            r.push({
              key: `r` + e.path,
              icon: (0, jsxRuntime.jsx)(no, { size: 17 }),
              iconPath: e.path,
              title: e.name,
              sub: o(`Недавний файл`, `Recent file`),
              score: 1,
              run: () => {
                (O(), u.openPath(e.path));
              },
              where: () => {
                (O(), u.openPath(e.path, !0));
              },
            }),
          ),
          ae
            .slice(0, 4)
            .forEach((e) => r.push({ key: `a` + e.t, icon: e.i, title: e.t, score: 1, run: e.run })),
          r
        );
      if (e.startsWith(`>`)) {
        let t = e.slice(1).trim();
        if (!t) return r;
        let n = (e) => () => {
          (O(),
            u
              .runShell(e, t)
              .catch((e) => useIslandStore.getState().pushPeek({ kind: `error`, message: String(e) })));
        };
        return (
          r.push({
            key: `sh-cmd`,
            icon: (0, jsxRuntime.jsx)(Ss, { size: 17 }),
            title: o(`Выполнить в cmd: ${t}`, `Run in cmd: ${t}`),
            sub: o(`Командная строка Windows`, `Windows command prompt`),
            score: 2,
            run: n(`cmd`),
          }),
          r.push({
            key: `sh-ps`,
            icon: (0, jsxRuntime.jsx)(Ss, { size: 17 }),
            title: o(`Выполнить в PowerShell: ${t}`, `Run in PowerShell: ${t}`),
            sub: `PowerShell`,
            score: 1,
            run: n(`powershell`),
          }),
          r
        );
      }
      let i = FA(e);
      if (i !== null) {
        let e = IA(i);
        r.push({
          key: `calc`,
          icon: (0, jsxRuntime.jsx)(Pa, { size: 17 }),
          title: `= ${e}`,
          sub: o(`Калькулятор · Enter — скопировать`, `Calculator · Enter to copy`),
          score: 1e3,
          run: () => k(e.replace(/\s/g, ``), o(`${e} в буфере`, `${e} copied`)),
        });
      }
      let a = HA(e);
      a &&
        r.push({
          key: `unit`,
          icon: (0, jsxRuntime.jsx)(ga, { size: 17 }),
          title: a.text,
          sub: o(`Перевод единиц · Enter — скопировать`, `Unit conversion · Enter to copy`),
          score: 990,
          run: () => k(a.text, o(`${a.text} в буфере`, `${a.text} copied`)),
        });
      let c = KA(e, f?.rub ?? null);
      c &&
        r.push({
          key: `money`,
          icon: (0, jsxRuntime.jsx)(Ka, { size: 17 }),
          title: c.text,
          sub: o(
            `По курсу ЦБ на ${f?.date ?? `сегодня`} · Enter — скопировать`,
            `Bank of Russia rate, ${f?.date ?? `today`} · Enter to copy`,
          ),
          score: 990,
          run: () => k(c.text, o(`${c.text} в буфере`, `${c.text} copied`)),
        });
      let d = Rt(e, wt.getState().timer.base);
      if (d !== null) {
        let e = gt(d);
        r.push({
          key: `timer`,
          icon: (0, jsxRuntime.jsx)(_o, { size: 17 }),
          title: o(`Запустить таймер: ${e}`, `Start a timer: ${e}`),
          sub: o(`Таймер · Enter — запустить`, `Timer · Enter to start`),
          score: 995,
          run: () => {
            (O(),
              wt.getState().start(d),
              useIslandStore.getState().pushPeek({ kind: `done`, label: o(`Таймер: ${e}`, `Timer: ${e}`) }));
          },
        });
      }
      let p = ea(e);
      if (p) {
        let e = `${ra(p.at.getTime())}${p.repeat ? ` · ${Qi(p.repeat)}` : ``}`,
          t = p.text || o(`Напоминание`, `Reminder`);
        r.push({
          key: `remind`,
          icon: (0, jsxRuntime.jsx)(Sa, { size: 17 }),
          title: o(`Напомнить: «${t}»`, `Remind me: “${t}”`),
          sub: o(`${e} · Enter — добавить`, `${e} · Enter to add`),
          score: 995,
          run: () => {
            (O(),
              ca.getState().add(t, p.at.getTime(), p.repeat),
              useIslandStore
                .getState()
                .pushPeek({ kind: `done`, label: o(`Напомню ${e}`, `Reminder set: ${e}`) }));
          },
        });
      }
      let h = $A(e);
      if (h?.kind === `cancel`)
        r.push({
          key: `power-cancel`,
          icon: (0, jsxRuntime.jsx)(Yo, { size: 17 }),
          title: o(`Отменить выключение компьютера`, `Cancel the shutdown`),
          sub: o(`Windows · Enter — отменить`, `Windows · Enter to cancel`),
          score: 995,
          run: () => {
            (O(),
              u.powerSchedule(!1, null).then(
                (e) =>
                  useIslandStore
                    .getState()
                    .pushPeek({
                      kind: `done`,
                      label: e
                        ? o(`Выключение отменено`, `Shutdown cancelled`)
                        : o(`Выключение не было назначено`, `No shutdown was set`),
                    }),
                (e) => useIslandStore.getState().pushPeek({ kind: `error`, message: String(e) }),
              ));
          },
        });
      else if (h) {
        let e = h.at.getTime(),
          t = ra(e),
          n = h.kind === `restart`;
        r.push({
          key: `power`,
          icon: n ? (0, jsxRuntime.jsx)(ts, { size: 17 }) : (0, jsxRuntime.jsx)(yn, { size: 17 }),
          title: n
            ? o(`Перезагрузить компьютер: ${t}`, `Restart the computer: ${t}`)
            : o(`Выключить компьютер: ${t}`, `Turn the computer off: ${t}`),
          sub: o(
            `Windows предупредит заранее · отменить: «отмени выключение»`,
            `Windows warns beforehand · to cancel: “cancel shutdown”`,
          ),
          score: 995,
          run: () => {
            (O(),
              u.powerSchedule(n, Math.max(1, Math.round((e - Date.now()) / 1e3))).then(
                () =>
                  useIslandStore
                    .getState()
                    .pushPeek({
                      kind: `done`,
                      label: n
                        ? o(`Перезагрузка ${t}`, `Restart ${t}`)
                        : o(`Выключение ${t}`, `Shutdown ${t}`),
                    }),
                (e) => useIslandStore.getState().pushPeek({ kind: `error`, message: String(e) }),
              ));
          },
        });
      }
      for (let t of ae) {
        let n = Math.max(rj(t.t, e), ...t.k.split(` `).map((t) => rj(t, e) - 2));
        n > 0 && r.push({ key: `a` + t.t, icon: t.i, title: t.t, sub: `Island`, score: n + 3, run: t.run });
      }
      for (let t of s) {
        let n = rj(t.name, e);
        n > 0 &&
          r.push({
            key: `p` + t.path,
            icon: (0, jsxRuntime.jsx)(ma, { size: 17 }),
            iconPath: t.path,
            title: t.name,
            sub: o(`Программа`, `App`),
            score: n + 2,
            run: () => {
              (O(), u.openPath(t.path));
            },
            admin: ej(t.path)
              ? () => {
                  (O(), u.openPath(t.path, !1, !0));
                }
              : void 0,
            where: ej(t.path)
              ? () => {
                  (O(), u.openPath(t.path, !0));
                }
              : void 0,
          });
      }
      for (let t of l) {
        let n = rj(t.name, e);
        n > 0 &&
          r.push({
            key: `r` + t.path,
            icon: (0, jsxRuntime.jsx)(Ha, { size: 17 }),
            iconPath: t.path,
            title: t.name,
            sub: o(`Недавний файл`, `Recent file`),
            score: n,
            run: () => {
              (O(), u.openPath(t.path));
            },
            where: () => {
              (O(), u.openPath(t.path, !0));
            },
          });
      }
      if (m.q === e) {
        let t = new Set([...s, ...l].map((e) => e.path.toLowerCase()));
        m.list
          .filter((e) => !t.has(e.path.toLowerCase()))
          .forEach((t, n) => {
            r.push({
              key: `f` + t.path,
              icon: t.folder ? (0, jsxRuntime.jsx)(Te, { size: 17 }) : (0, jsxRuntime.jsx)(no, { size: 17 }),
              iconPath: t.path,
              title: t.name,
              sub: Gn(t.path) || (t.folder ? o(`Папка`, `Folder`) : o(`Файл`, `File`)),
              score: Math.max(rj(t.name, e), 1) - 1 - n * 0.01,
              run: () => {
                (O(), u.openPath(t.path));
              },
              where: () => {
                (O(), u.openPath(t.path, !0));
              },
            });
          });
      }
      r.sort((e, t) => t.score - e.score);
      let _ = r.slice(0, 5);
      return (
        g &&
          _.push({
            key: `ai`,
            icon: (0, jsxRuntime.jsx)(fr, { size: 17 }),
            title: o(`Спросить ИИ: «${e}»`, `Ask AI: “${e}”`),
            sub: S?.aiModel,
            hint: `Tab`,
            score: 0,
            run: () => re(e),
          }),
        _.push({
          key: `web`,
          icon: (0, jsxRuntime.jsx)(co, { size: 17 }),
          title: o(`Искать в браузере: «${e}»`, `Search in the browser: “${e}”`),
          sub: rr(S?.searchEngine, S?.searchUrl, t()),
          score: 0,
          run: () => {
            (O(), u.openPath(Rn(e, S?.searchEngine, S?.searchUrl, t())));
          },
        }),
        _.slice(0, 7)
      );
    }, [n, s, l, m, f, g, ae, S?.aiModel, S?.searchEngine, S?.searchUrl]);
  return (
    (0, ReactRuntime.useEffect)(() => a(0), [n]),
    (0, ReactRuntime.useEffect)(() => e(oe.length, v !== null), [oe.length, v, e]),
    (0, jsxRuntime.jsxs)(`div`, {
      className: `flex h-full flex-col`,
      children: [
        (0, jsxRuntime.jsxs)(`div`, {
          className: `flex h-14 shrink-0 items-center gap-3 px-4`,
          children: [
            (0, jsxRuntime.jsx)(kn, { size: 18, className: `text-ink-3` }),
            (0, jsxRuntime.jsx)(`input`, {
              ref: x,
              value: n,
              onChange: (e) => {
                (r(e.target.value), v && y(null));
              },
              onKeyDown: (e) => {
                if (e.key === `Escape`) (e.preventDefault(), v ? (b.current?.(), y(null)) : O());
                else if (v)
                  e.key === `Enter` && e.ctrlKey && v.state === `done`
                    ? (e.preventDefault(), M.getState().continueFrom(v.q, v.text), ne(`chat`))
                    : e.key === `Enter` &&
                      v.state === `done` &&
                      k(v.text, o(`Ответ в буфере`, `Answer copied`));
                else if (e.key === `ArrowDown`)
                  (e.preventDefault(), a((e) => Math.min(oe.length - 1, e + 1)));
                else if (e.key === `ArrowUp`) (e.preventDefault(), a((e) => Math.max(0, e - 1)));
                else if (e.key === `Enter`) {
                  e.preventDefault();
                  let t = oe[i];
                  e.ctrlKey && e.shiftKey && t?.admin
                    ? t.admin()
                    : e.ctrlKey && !e.shiftKey && t?.where
                      ? t.where()
                      : t?.run();
                } else e.key === `Tab` && g && n.trim() && (e.preventDefault(), re(n.trim()));
              },
              spellCheck: !1,
              placeholder: o(
                `Программа, 12*34, 5 км в милях, > ipconfig…`,
                `App, 12*34, 5 km to miles, > ipconfig…`,
              ),
              className: `min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-3`,
            }),
            (0, jsxRuntime.jsx)(`kbd`, {
              className: `rounded-md bg-white/8 px-1.5 py-0.5 text-[10.5px] text-ink-3`,
              children: S?.hotkeyPalette,
            }),
          ],
        }),
        v
          ? (0, jsxRuntime.jsxs)(`div`, {
              className: `mx-2 mb-2 flex min-h-0 flex-1 flex-col rounded-2xl bg-tile p-3.5`,
              children: [
                (0, jsxRuntime.jsxs)(`div`, {
                  className: `mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-ink-3 uppercase`,
                  children: [
                    (0, jsxRuntime.jsx)(fr, { size: 12, className: `text-accent` }),
                    ` `,
                    S?.aiModel,
                  ],
                }),
                (0, jsxRuntime.jsxs)(`div`, {
                  "data-ai-answer": !0,
                  className: `scroll-thin min-h-0 flex-1 overflow-y-auto text-[13px] leading-relaxed select-text ${v.state === `error` ? `text-danger` : `text-ink`}`,
                  children: [
                    v.state === `error` || !v.text
                      ? (0, jsxRuntime.jsx)(`span`, {
                          className: `whitespace-pre-wrap`,
                          children: v.text || o(`Думаю…`, `Thinking…`),
                        })
                      : (0, jsxRuntime.jsx)(Qs, { text: v.text }),
                    v.state === `run` &&
                      (0, jsxRuntime.jsx)(`span`, {
                        className: `mt-1 inline-block h-3.5 w-1.5 animate-pulse bg-ink-2 align-middle`,
                      }),
                  ],
                }),
                (0, jsxRuntime.jsxs)(`div`, {
                  className: `mt-2 flex items-center justify-between text-[10.5px] text-ink-3`,
                  children: [
                    (0, jsxRuntime.jsx)(`span`, {
                      children:
                        v.state === `done`
                          ? o(
                              `Enter — скопировать · Ctrl+Enter — продолжить в чате`,
                              `Enter to copy · Ctrl+Enter to continue in chat`,
                            )
                          : v.state === `run`
                            ? o(`Esc — остановить`, `Esc to stop`)
                            : ``,
                    }),
                    (0, jsxRuntime.jsx)(`span`, { children: o(`Esc — назад`, `Esc to go back`) }),
                  ],
                }),
              ],
            })
          : (0, jsxRuntime.jsx)(`div`, {
              className: `flex flex-col px-2 pb-2`,
              children: oe.map((e, t) =>
                (0, jsxRuntime.jsxs)(
                  `button`,
                  {
                    "data-row": e.key[0],
                    onMouseEnter: () => a(t),
                    onClick: (t) =>
                      t.ctrlKey && t.shiftKey && e.admin
                        ? e.admin()
                        : t.ctrlKey && !t.shiftKey && e.where
                          ? e.where()
                          : e.run(),
                    className: `flex h-[42px] items-center gap-3 rounded-xl px-2.5 text-left ${t === i ? `bg-white/10` : ``}`,
                    children: [
                      (0, jsxRuntime.jsx)(`span`, {
                        className: `grid size-7 shrink-0 place-items-center text-ink-2`,
                        children: e.iconPath
                          ? (0, jsxRuntime.jsx)(ProgramIcon, { path: e.iconPath, fallback: e.icon })
                          : e.icon,
                      }),
                      (0, jsxRuntime.jsx)(`span`, {
                        className: `min-w-0 flex-1 truncate text-[13px] text-ink`,
                        children: e.title,
                      }),
                      t === i && (e.admin || e.where)
                        ? (0, jsxRuntime.jsx)(`span`, {
                            className: `max-w-[66%] shrink-0 truncate text-[11px] text-ink-3`,
                            children: [
                              e.where && o(`Ctrl+Enter: папка`, `Ctrl+Enter: folder`),
                              e.admin &&
                                o(
                                  `Ctrl+Shift+Enter: от администратора`,
                                  `Ctrl+Shift+Enter: as administrator`,
                                ),
                            ]
                              .filter(Boolean)
                              .join(`  ·  `),
                          })
                        : e.sub &&
                          (0, jsxRuntime.jsx)(`span`, {
                            className: `max-w-[40%] shrink-0 truncate text-[11px] text-ink-3`,
                            children: e.sub,
                          }),
                      t === i && (0, jsxRuntime.jsx)(Xa, { size: 13, className: `shrink-0 text-ink-3` }),
                    ],
                  },
                  e.key,
                ),
              ),
            }),
      ],
    })
  );
}
function aj({ icon: e, title: t, sub: n, onClick: r, children: i }) {
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `flex h-full items-center gap-3 px-4`,
    onClick: r,
    children: [
      e,
      (0, jsxRuntime.jsxs)(`div`, {
        className: `min-w-0 flex-1`,
        children: [
          (0, jsxRuntime.jsx)(`div`, {
            className: `truncate text-[13px] font-semibold text-ink`,
            children: t,
          }),
          n && (0, jsxRuntime.jsx)(`div`, { className: `truncate text-[12px] text-ink-2`, children: n }),
        ],
      }),
      i,
    ],
  });
}
function oj({ peek: e }) {
  let t = e.note;
  return (0, jsxRuntime.jsxs)(`div`, {
    "data-notification": !0,
    className: `flex h-full items-center gap-3 px-4`,
    onClick: () => {
      (t.aumid && u.openPath(`shell:AppsFolder\\${t.aumid}`), useIslandStore.getState().nextPeek());
    },
    children: [
      t.icon
        ? (0, jsxRuntime.jsx)(`img`, {
            src: t.icon,
            alt: ``,
            className: `size-9 shrink-0 object-contain`,
            draggable: !1,
          })
        : (0, jsxRuntime.jsx)($, {
            tone: `bg-accent/20 text-accent`,
            children: (0, jsxRuntime.jsx)(Ea, { size: 17 }),
          }),
      (0, jsxRuntime.jsxs)(`div`, {
        className: `min-w-0 flex-1`,
        children: [
          (0, jsxRuntime.jsxs)(`div`, {
            className: `flex items-baseline gap-2`,
            children: [
              (0, jsxRuntime.jsx)(`span`, {
                className: `min-w-0 truncate text-[13px] font-semibold text-ink`,
                children: t.title,
              }),
              t.app &&
                t.app !== t.title &&
                (0, jsxRuntime.jsx)(`span`, {
                  className: `max-w-[45%] shrink-0 truncate text-[11px] text-ink-3`,
                  children: t.app,
                }),
            ],
          }),
          t.body &&
            (0, jsxRuntime.jsx)(`div`, {
              className: `line-clamp-2 text-[12px] leading-snug whitespace-pre-line text-ink-2`,
              children: t.body,
            }),
        ],
      }),
    ],
  });
}
function sj({ peek: e }) {
  let t = e.agent,
    n = t.agent === `codex` ? `Codex` : t.agent === `opencode` ? `opencode` : `Claude Code`,
    r = t.state === `waiting`;
  return (0, jsxRuntime.jsx)(aj, {
    icon: (0, jsxRuntime.jsx)($, {
      tone: r ? `bg-[#ffb340]/20 text-[#ffb340]` : `bg-ok/20 text-ok`,
      children: r
        ? (0, jsxRuntime.jsx)(In, { size: 17 })
        : (0, jsxRuntime.jsx)(_r, { size: 17, className: `pop-in` }),
    }),
    title: (0, jsxRuntime.jsxs)(`span`, {
      "data-agent-card": t.state,
      children: [
        r ? o(`${n} ждёт ответа`, `${n} waits for an answer`) : o(`${n} закончил`, `${n} is done`),
        t.project &&
          (0, jsxRuntime.jsx)(`span`, {
            className: `ml-2 text-[11.5px] font-medium text-ink-3`,
            children: t.project,
          }),
      ],
    }),
    sub: t.message || void 0,
    onClick: () => useIslandStore.getState().nextPeek(),
  });
}
var cj = 12e4;
function lj({ until: e }) {
  let t = (0, ReactRuntime.useRef)(null);
  return (
    (0, ReactRuntime.useEffect)(() => {
      let n = Math.max(0, e - Date.now()),
        r = t.current?.animate(
          [{ transform: `scaleX(${Math.min(1, n / cj)})` }, { transform: `scaleX(0)` }],
          { duration: n, fill: `forwards`, easing: `linear` },
        );
      return () => r?.cancel();
    }, [e]),
    (0, jsxRuntime.jsx)(`div`, {
      ref: t,
      className: `absolute right-4 bottom-1.5 left-4 h-[2px] origin-left rounded-full opacity-80`,
      style: { background: `var(--color-timer)` },
    })
  );
}
function uj(e) {
  switch (e) {
    case `Bash`:
    case `PowerShell`:
      return o(`выполнить команду`, `run a command`);
    case `Edit`:
    case `MultiEdit`:
    case `Write`:
    case `NotebookEdit`:
      return o(`изменить файл`, `change a file`);
    case `Read`:
      return o(`прочитать файл`, `read a file`);
    case `WebFetch`:
      return o(`открыть адрес`, `open an address`);
    case `WebSearch`:
      return o(`поискать в сети`, `search the web`);
    default: {
      let t = e.replace(/^mcp__/, ``).replace(/__/g, ` · `);
      return o(`использовать ${t}`, `use ${t}`);
    }
  }
}

function fj({ peek: e }) {
  let t = e.ask,
    n = async (e, n) => {
      try { await u.agentsAnswer(t.id, e, n); useIslandStore.getState().dropAsk(t.id); return true; }
      catch (error) { useIslandStore.getState().pushPeek({kind: 'error', message: String(error)}); return false; }
    },
    r = t.project
      ? (0, jsxRuntime.jsx)(`span`, {
          className: `ml-2 text-[11.5px] font-medium text-ink-3`,
          children: t.project,
        })
      : null,
    i = (0, jsxRuntime.jsxs)(`button`, {
      "data-ask-terminal": !0,
      title: o(`Ответить в терминале, как обычно`, `Answer in the terminal, as usual`),
      onClick: () => n(`terminal`),
      className: `press flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-white/8 px-2.5 text-[11.5px] text-ink-2 hover:bg-white/14 hover:text-ink`,
      children: [(0, jsxRuntime.jsx)(gs, { size: 13 }), o(`В терминале`, `In the terminal`)],
    });
  if (t.kind === `permission`) {
    let e = t.tool === `Bash` || t.tool === `PowerShell`;
    return (0, jsxRuntime.jsxs)(`div`, {
      "data-agent-ask": `permission`,
      className: `relative flex h-full flex-col justify-center gap-2 px-4 pb-1.5`,
      children: [
        (0, jsxRuntime.jsxs)(`div`, {
          className: `flex items-center gap-3`,
          children: [
            (0, jsxRuntime.jsx)($, {
              tone: `bg-[#ffb340]/20 text-[#ffb340]`,
              children: (0, jsxRuntime.jsx)(In, { size: 17 }),
            }),
            (0, jsxRuntime.jsxs)(`div`, {
              className: `min-w-0 flex-1`,
              children: [
                (0, jsxRuntime.jsxs)(`div`, {
                  className: `truncate text-[13px] font-semibold text-ink`,
                  children: [o(`Claude хочет`, `Claude wants to`), ` `, uj(t.tool), r],
                }),
                (0, jsxRuntime.jsx)(`div`, {
                  className: `truncate text-[12px] text-ink-2`,
                  children: t.note || t.tool,
                }),
              ],
            }),
            (0, jsxRuntime.jsx)(hj, {
              title: o(`Запретить`, `Deny`),
              onClick: () => n(`deny`),
              children: (0, jsxRuntime.jsx)(yr, { size: 16 }),
            }),
            (0, jsxRuntime.jsx)(hj, {
              title: o(`Разрешить`, `Allow`),
              tone: `bg-ink text-island hover:opacity-90`,
              onClick: () => n(`allow`),
              children: (0, jsxRuntime.jsx)(_r, { size: 16, strokeWidth: 2.6 }),
            }),
          ],
        }),
        (0, jsxRuntime.jsxs)(`div`, {
          className: `flex items-center gap-2`,
          children: [
            (0, jsxRuntime.jsxs)(`div`, {
              "data-ask-detail": !0,
              className: `min-w-0 flex-1 truncate rounded-lg bg-black/30 px-2.5 py-1.5 font-mono text-[11.5px] text-ink-2`,
              children: [
                e && (0, jsxRuntime.jsx)(`span`, { className: `text-ink-3`, children: `$ ` }),
                t.detail || t.tool,
              ],
            }),
            i,
          ],
        }),
        (0, jsxRuntime.jsx)(lj, { until: t.until }),
      ],
    });
  }
  return (0, jsxRuntime.jsx)(pj, { peek: e, where: r, terminal: i, done: n });
}
function pj({ peek, where, terminal, done }) {
  return jsxRuntime.jsx(AgentQuestion, {
    ask: peek.ask,
    where,
    terminal,
    onAnswer: (answers) => done("answer", answers),
    onStep: step => useIslandStore.setState(current => current.peek?.id === peek.id ? {peek: {...current.peek, step}} : {}),
  });
}

function mj({ mood: e }) {
  let t = Dn();
  return (0, jsxRuntime.jsx)(Pn, { id: t.id, mood: e, width: 48, height: 46 });
}
function $({ children: e, tone: t = `bg-white/10 text-ink` }) {
  return (0, jsxRuntime.jsx)(`div`, {
    className: `grid size-9 shrink-0 place-items-center rounded-full ${t}`,
    children: e,
  });
}
function hj({
  title: e,
  onClick: t,
  children: n,
  tone: r = `bg-white/10 text-ink-2 hover:bg-white/16 hover:text-ink`,
}) {
  return (0, jsxRuntime.jsx)(`button`, {
    title: e,
    className: `press grid size-9 shrink-0 place-items-center rounded-full ${r}`,
    onClick: (e) => {
      (e.stopPropagation(), t());
    },
    children: n,
  });
}
function gj({ peek: e }) {
  let t = Date.now() - e.at > 9e4,
    n = ca((t) => t.list.find((t) => t.id === e.reminder)?.repeat);
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `flex h-full items-center gap-3 px-3.5`,
    children: [
      (0, jsxRuntime.jsx)($, {
        tone: `bg-timer/20 text-timer`,
        children: (0, jsxRuntime.jsx)(Ea, { size: 17 }),
      }),
      (0, jsxRuntime.jsxs)(`div`, {
        className: `min-w-0 flex-1`,
        children: [
          (0, jsxRuntime.jsx)(`div`, {
            className: `line-clamp-2 text-[13px] leading-snug font-semibold text-ink`,
            children: e.text || o(`Напоминание`, `Reminder`),
          }),
          (0, jsxRuntime.jsxs)(`div`, {
            className: `truncate text-[11.5px] text-ink-3`,
            children: [o(`Напоминание`, `Reminder`), n && ` · ${Qi(n)}`, t && ` · ${ra(e.at)}`],
          }),
        ],
      }),
      (0, jsxRuntime.jsx)(`button`, {
        title: o(`Напомнить через 10 минут`, `Remind me in 10 minutes`),
        className: `press h-8 shrink-0 rounded-full bg-white/10 px-3 text-[11.5px] font-semibold text-ink-2 hover:bg-white/16 hover:text-ink`,
        onClick: (t) => {
          (t.stopPropagation(), ca.getState().snooze(e.reminder, 6e5));
        },
        children: o(`+10 мин`, `+10 min`),
      }),
      (0, jsxRuntime.jsx)(hj, {
        title: n
          ? o(`Готово: напомнит в следующий раз`, `Done: it will remind you next time`)
          : o(`Готово`, `Done`),
        onClick: () => ca.getState().done(e.reminder),
        tone: `bg-white text-black`,
        children: (0, jsxRuntime.jsx)(_r, { size: 16 }),
      }),
    ],
  });
}
function _j({ peek: e }) {
  let t = Date.now() - e.at > 9e4;
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `flex h-full items-center gap-3 px-3.5`,
    children: [
      (0, jsxRuntime.jsx)($, {
        tone: `bg-timer/20 text-timer`,
        children: (0, jsxRuntime.jsx)(_o, { size: 17 }),
      }),
      (0, jsxRuntime.jsxs)(`div`, {
        className: `min-w-0 flex-1`,
        children: [
          (0, jsxRuntime.jsx)(`div`, {
            className: `truncate text-[13px] font-semibold text-ink`,
            children: o(`Время вышло`, `Time is up`),
          }),
          (0, jsxRuntime.jsxs)(`div`, {
            className: `truncate text-[11.5px] text-ink-3`,
            children: [o(`Таймер`, `Timer`), ` · `, gt(e.length), t && ` · ${ra(e.at)}`],
          }),
        ],
      }),
      (0, jsxRuntime.jsx)(`button`, {
        title: o(`Запустить ещё раз: ${gt(e.length)}`, `Start again: ${gt(e.length)}`),
        className: `press h-8 shrink-0 rounded-full bg-white/10 px-3 text-[11.5px] font-semibold text-ink-2 hover:bg-white/16 hover:text-ink`,
        onClick: (e) => {
          (e.stopPropagation(), wt.getState().start());
        },
        children: o(`Ещё раз`, `Again`),
      }),
      (0, jsxRuntime.jsx)(hj, {
        title: o(`Готово`, `Done`),
        onClick: () => wt.getState().dismiss(),
        tone: `bg-white text-black`,
        children: (0, jsxRuntime.jsx)(_r, { size: 16 }),
      }),
    ],
  });
}
function vj(e) {
  let t = useIslandStore.getState();
  if (!t.license.pro) return t.pushPeek({ kind: `pro`, feature: `ocr` });
  u.ocrFile(e)
    .then((e) => {
      let t = useIslandStore.getState();
      if (!e.trim())
        return t.pushPeek({
          kind: `error`,
          message: o(`На скриншоте не нашлось текста`, `No text was found on the screenshot`),
        });
      (t.sendToText(e, `translate`), t.open(`click`, `text`));
    })
    .catch((e) => useIslandStore.getState().pushPeek({ kind: `error`, message: String(e) }));
}
function yj({ peek: e }) {
  let t = fk(() => [e.path], e.thumb),
    n = useIslandStore((e) => vn(e.settings?.uploadService));
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `flex h-full items-center gap-3.5 px-3.5`,
    children: [
      (0, jsxRuntime.jsx)(`img`, {
        src: e.thumb,
        alt: ``,
        draggable: !1,
        title: o(`Перетащи, чтобы отправить · клик — открыть`, `Drag to send · click to open`),
        className: `press h-[72px] w-[116px] shrink-0 cursor-grab rounded-xl object-cover ring-1 ring-white/15 active:cursor-grabbing`,
        onClick: () => void u.openPath(e.path),
        ...t,
      }),
      (0, jsxRuntime.jsxs)(`div`, {
        className: `min-w-0 flex-1`,
        children: [
          (0, jsxRuntime.jsx)(`div`, {
            className: `text-[13px] font-semibold text-ink`,
            children: o(`Скриншот готов`, `Screenshot ready`),
          }),
          (0, jsxRuntime.jsxs)(`div`, {
            className: `text-[12px] text-ink-2`,
            children: [
              o(`В буфере и в папке`, `On the clipboard and in the folder`),
              ` · `,
              e.width,
              `×`,
              e.height,
            ],
          }),
          (0, jsxRuntime.jsx)(`div`, {
            className: `mt-1 text-[11px] text-ink-3`,
            children: o(`Перетащи превью в чат или папку`, `Drag the preview into a chat or folder`),
          }),
        ],
      }),
      (0, jsxRuntime.jsxs)(`div`, {
        className: `grid shrink-0 grid-cols-2 gap-1.5`,
        children: [
          (0, jsxRuntime.jsx)(`span`, {
            "data-shot-translate": !0,
            className: `contents`,
            children: (0, jsxRuntime.jsx)(hj, {
              title: o(`Распознать текст и перевести (ИИ)`, `Read the text and translate it (AI)`),
              onClick: () => vj(e.path),
              children: (0, jsxRuntime.jsx)(Co, { size: 15 }),
            }),
          }),
          n &&
            (0, jsxRuntime.jsx)(`span`, {
              "data-shot-upload": !0,
              className: `contents`,
              children: (0, jsxRuntime.jsx)(hj, {
                title: o(
                  `Загрузить на ${n.name} и скопировать ссылку`,
                  `Upload to ${n.name} and copy the link`,
                ),
                onClick: () => sn(e.path),
                children: (0, jsxRuntime.jsx)(Ge, { size: 15 }),
              }),
            }),
          (0, jsxRuntime.jsx)(hj, {
            title: o(`Разметить: стрелки, текст, скрыть данные`, `Mark up: arrows, text, hide private data`),
            onClick: () => void u.editorOpen(e.path),
            tone: `bg-white text-black`,
            children: (0, jsxRuntime.jsx)(qo, { size: 15 }),
          }),
          (0, jsxRuntime.jsx)(hj, {
            title: o(`Показать в папке`, `Show in folder`),
            onClick: () => void u.openPath(e.path, !0),
            children: (0, jsxRuntime.jsx)(Te, { size: 15 }),
          }),
        ],
      }),
    ],
  });
}
function bj({ peek: e }) {
  let t = fk(() => [e.path], e.thumb),
    n = Math.round(e.durationMs / 1e3),
    r = `${Math.floor(n / 60)}:${String(n % 60).padStart(2, `0`)}`;
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `flex h-full items-center gap-3.5 px-3.5`,
    children: [
      (0, jsxRuntime.jsxs)(`div`, {
        ...t,
        title: o(`Перетащи, чтобы отправить · клик — открыть`, `Drag to send · click to open`),
        onClick: () => void u.openPath(e.path),
        className: `press relative h-[72px] w-[116px] shrink-0 cursor-grab overflow-hidden rounded-xl bg-white/8 ring-1 ring-white/15 active:cursor-grabbing`,
        children: [
          e.thumb &&
            (0, jsxRuntime.jsx)(`img`, {
              src: e.thumb,
              alt: ``,
              draggable: !1,
              className: `size-full object-cover`,
            }),
          (0, jsxRuntime.jsx)(`span`, {
            className: `absolute inset-0 grid place-items-center`,
            children: (0, jsxRuntime.jsx)(`span`, {
              className: `on-dark grid size-7 place-items-center rounded-full bg-black/60`,
              children: (0, jsxRuntime.jsx)(Ft, { size: 13, fill: `white`, className: `ml-0.5 text-white` }),
            }),
          }),
        ],
      }),
      (0, jsxRuntime.jsxs)(`div`, {
        className: `min-w-0 flex-1`,
        children: [
          (0, jsxRuntime.jsx)(`div`, {
            className: `text-[13px] font-semibold text-ink`,
            children: o(`Запись готова`, `Recording ready`),
          }),
          (0, jsxRuntime.jsxs)(`div`, {
            className: `text-[12px] text-ink-2`,
            children: [e.format.toUpperCase(), ` · `, r, ` · `, dr(e.size)],
          }),
          (0, jsxRuntime.jsx)(`div`, {
            className: `mt-1 text-[11px] text-ink-3`,
            children: o(`Перетащи превью в чат или папку`, `Drag the preview into a chat or folder`),
          }),
        ],
      }),
      (0, jsxRuntime.jsx)(hj, {
        title: o(`Показать в папке`, `Show in folder`),
        onClick: () => void u.openPath(e.path, !0),
        children: (0, jsxRuntime.jsx)(Te, { size: 16 }),
      }),
    ],
  });
}
function xj({ peek: e }) {
  let [t, n] = (0, ReactRuntime.useState)(null),
    r = (0, ReactRuntime.useRef)(0),
    i = t ?? e.level,
    a = Math.round(i * 100),
    s = e.muted || i === 0 ? $e : i < 0.5 ? we : xn,
    c = (e) => {
      let t = e.currentTarget.getBoundingClientRect(),
        i = Math.min(1, Math.max(0, (e.clientX - t.left) / t.width));
      n(i);
      let a = performance.now();
      a - r.current > 30 && ((r.current = a), u.volumeSet(i));
    };
  return (
    (0, ReactRuntime.useEffect)(() => n(null), [e.level]),
    (0, jsxRuntime.jsxs)(`div`, {
      className: `flex h-full items-center gap-3 px-3.5`,
      children: [
        (0, jsxRuntime.jsx)(`button`, {
          title: e.muted ? o(`Включить звук`, `Unmute`) : o(`Выключить звук`, `Mute`),
          className: `press grid size-8 shrink-0 place-items-center rounded-full text-ink hover:bg-white/10`,
          onClick: () => void u.volumeMuteToggle(),
          children: (0, jsxRuntime.jsx)(s, { size: 18 }),
        }),
        (0, jsxRuntime.jsx)(`div`, {
          className: `group relative h-6 flex-1 cursor-pointer py-2.5`,
          onPointerDown: (e) => {
            (e.currentTarget.setPointerCapture(e.pointerId), c(e));
          },
          onPointerMove: (e) => e.buttons & 1 && c(e),
          onPointerUp: (e) => {
            (c(e), u.volumeSet(Math.min(1, Math.max(0, i))));
          },
          children: (0, jsxRuntime.jsx)(`div`, {
            className: `h-1.5 overflow-hidden rounded-full bg-white/15`,
            children: (0, jsxRuntime.jsx)(`div`, {
              className: `h-full rounded-full ${e.muted ? `bg-white/35` : `bg-white`}`,
              style: { width: `${a}%`, transition: t === null ? `width 120ms ease-out` : `none` },
            }),
          }),
        }),
        (0, jsxRuntime.jsx)(`span`, {
          className: `tabular w-9 text-right text-[12px] font-semibold text-ink-2`,
          children: e.muted ? `—` : a,
        }),
      ],
    })
  );
}
function Sj({ peek: e }) {
  let t = e.file,
    n = fk(() => [t.path], t.icon);
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `flex h-full items-center gap-3 px-3.5`,
    children: [
      (0, jsxRuntime.jsx)(`div`, {
        ...n,
        title: o(`Перетащи файл · клик — открыть`, `Drag the file · click to open`),
        onClick: () => void u.openPath(t.path),
        className: `press grid size-12 shrink-0 cursor-grab place-items-center rounded-xl bg-white/8 active:cursor-grabbing`,
        children: t.icon
          ? (0, jsxRuntime.jsx)(`img`, {
              src: t.icon,
              alt: ``,
              draggable: !1,
              className: `size-9 rounded object-contain`,
            })
          : (0, jsxRuntime.jsx)(je, { size: 20 }),
      }),
      (0, jsxRuntime.jsxs)(`div`, {
        className: `min-w-0 flex-1`,
        children: [
          (0, jsxRuntime.jsx)(`div`, {
            className: `text-[13px] font-semibold text-ink`,
            children: t.title ?? o(`Загружено`, `Downloaded`),
          }),
          (0, jsxRuntime.jsxs)(`div`, {
            className: `truncate text-[12px] text-ink-2`,
            children: [
              t.name,
              t.size > 0 &&
                (0, jsxRuntime.jsxs)(`span`, { className: `text-ink-3`, children: [` · `, dr(t.size)] }),
            ],
          }),
        ],
      }),
      (0, jsxRuntime.jsx)(hj, {
        title: o(`Показать в папке`, `Show in folder`),
        onClick: () => void u.openPath(t.path, !0),
        children: (0, jsxRuntime.jsx)(Te, { size: 16 }),
      }),
    ],
  });
}
function Cj({ peek: e }) {
  let t = useIslandStore((e) => e.pushPeek),
    [n, r, i] = e.rgb,
    a = (e) =>
      void u.clipSetText(e).then(() => t({ kind: `done`, label: o(`${e} в буфере`, `${e} copied`) }));
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `flex h-full items-center gap-3.5 px-3.5`,
    children: [
      (0, jsxRuntime.jsx)(`div`, {
        className: `size-14 shrink-0 rounded-2xl ring-1 ring-white/20`,
        style: { background: e.hex },
      }),
      (0, jsxRuntime.jsxs)(`div`, {
        className: `min-w-0 flex-1`,
        children: [
          (0, jsxRuntime.jsxs)(`div`, {
            className: `flex items-baseline gap-2`,
            children: [
              (0, jsxRuntime.jsx)(`span`, {
                className: `font-mono text-[15px] font-semibold text-ink`,
                children: e.hex,
              }),
              (0, jsxRuntime.jsx)(`span`, {
                className: `text-[11px] text-ok`,
                children: o(`в буфере`, `copied`),
              }),
            ],
          }),
          (0, jsxRuntime.jsxs)(`button`, {
            className: `font-mono text-[11.5px] text-ink-2 hover:text-ink`,
            onClick: () => a(`rgb(${n}, ${r}, ${i})`),
            children: [`rgb(`, n, `, `, r, `, `, i, `)`],
          }),
          (0, jsxRuntime.jsx)(`div`, {
            className: `mt-1.5 flex gap-1`,
            children: e.history
              .slice(1, 9)
              .map((e) =>
                (0, jsxRuntime.jsx)(
                  `button`,
                  {
                    title: o(`${e} — скопировать`, `${e} — copy`),
                    className: `press size-4 rounded-[5px] ring-1 ring-white/15`,
                    style: { background: e },
                    onClick: () => a(e),
                  },
                  e,
                ),
              ),
          }),
        ],
      }),
      (0, jsxRuntime.jsx)(hj, {
        title: o(`Скопировать RGB`, `Copy RGB`),
        onClick: () => a(`rgb(${n}, ${r}, ${i})`),
        children: (0, jsxRuntime.jsx)(A, { size: 15 }),
      }),
    ],
  });
}
function wj({ peek: e }) {
  let t = useIslandStore((e) => e.open),
    n = useIslandStore((e) => e.sendToText),
    r = useIslandStore((e) => e.installUpdate),
    i = cr();
  switch (e.kind) {
    case `copied`: {
      let n = e.clip,
        r = n.kind === `image`;
      return (0, jsxRuntime.jsx)(aj, {
        icon:
          r && n.thumb
            ? (0, jsxRuntime.jsx)(`img`, {
                src: n.thumb,
                alt: ``,
                className: `h-10 w-14 shrink-0 rounded-lg object-cover ring-1 ring-white/10`,
              })
            : (0, jsxRuntime.jsx)($, { children: (0, jsxRuntime.jsx)(Ra, { size: 17 }) }),
        title: r ? o(`Картинка скопирована`, `Image copied`) : o(`Скопировано`, `Copied`),
        sub: r ? `${n.width}×${n.height}${n.source ? ` · ${n.source}` : ``}` : n.preview.replace(/\s+/g, ` `),
        onClick: () => t(`click`, `clipboard`),
      });
    }
    case `screenshot`:
      return (0, jsxRuntime.jsx)(yj, { peek: e });
    case `ocr`:
      return (0, jsxRuntime.jsx)(aj, {
        icon: (0, jsxRuntime.jsx)($, {
          tone: `bg-accent/20 text-accent`,
          children: (0, jsxRuntime.jsx)(bn, { size: 17 }),
        }),
        title: o(
          `Текст распознан · ${Array.from(e.text).length} симв.`,
          `Text recognized · ${Array.from(e.text).length} chars`,
        ),
        sub: e.text.replace(/\s+/g, ` `),
        onClick: () => {
          (n(e.text), t(`click`, `text`));
        },
        children: (0, jsxRuntime.jsx)(`span`, {
          "data-ocr-translate": !0,
          className: `contents`,
          children: (0, jsxRuntime.jsx)(hj, {
            title: o(`Перевести (ИИ)`, `Translate (AI)`),
            onClick: () => {
              (n(e.text, `translate`), t(`click`, `text`));
            },
            children: (0, jsxRuntime.jsx)(Co, { size: 15 }),
          }),
        }),
      });
    case `qr`:
      return (0, jsxRuntime.jsx)(aj, {
        icon: (0, jsxRuntime.jsx)($, {
          tone: `bg-accent/20 text-accent`,
          children: (0, jsxRuntime.jsx)(An, { size: 17 }),
        }),
        title: o(`QR-код прочитан · в буфере`, `QR code read · copied`),
        sub: e.text.replace(/\s+/g, ` `),
        onClick: () => {
          (n(e.text), t(`click`, `text`));
        },
        children:
          e.url &&
          (0, jsxRuntime.jsx)(hj, {
            title: o(`Открыть ссылку`, `Open link`),
            onClick: () => void u.openPath(e.text.trim()),
            tone: `bg-white text-black`,
            children: (0, jsxRuntime.jsx)(eo, { size: 15 }),
          }),
      });
    case `color`:
      return (0, jsxRuntime.jsx)(Cj, { peek: e });
    case `shelf`:
      return (0, jsxRuntime.jsx)(aj, {
        icon: i
          ? (0, jsxRuntime.jsx)(mj, { mood: `eat` })
          : (0, jsxRuntime.jsx)($, { children: (0, jsxRuntime.jsx)(Hn, { size: 17 }) }),
        title: o(`Положено на полку`, `Put on the shelf`),
        sub: e.count > 1 ? o(`${e.name} и ещё ${e.count - 1}`, `${e.name} and ${e.count - 1} more`) : e.name,
        onClick: () => t(`click`, `shelf`),
      });
    case `launcher`:
      return (0, jsxRuntime.jsx)(aj, {
        icon: i
          ? (0, jsxRuntime.jsx)(mj, { mood: `happy` })
          : (0, jsxRuntime.jsx)($, { children: (0, jsxRuntime.jsx)(uo, { size: 17 }) }),
        title: o(`Добавлено в лаунчер`, `Added to the launcher`),
        sub: e.count > 1 ? o(`${e.name} и ещё ${e.count - 1}`, `${e.name} and ${e.count - 1} more`) : e.name,
        onClick: () => t(`click`, `home`),
      });
    case `volume`:
      return (0, jsxRuntime.jsx)(xj, { peek: e });
    case `device`:
      return (0, jsxRuntime.jsx)(aj, {
        icon: (0, jsxRuntime.jsx)($, { children: (0, jsxRuntime.jsx)(ho, { size: 17 }) }),
        title: o(`Звук идёт сюда`, `Sound now plays here`),
        sub: e.name,
      });
    case `layout`:
      return (0, jsxRuntime.jsxs)(`div`, {
        className: `flex h-full items-center justify-center gap-2 text-ink`,
        children: [
          (0, jsxRuntime.jsx)(pn, { size: 15, className: `text-ink-3` }),
          (0, jsxRuntime.jsx)(`span`, { className: `text-[15px] font-bold tracking-wide`, children: e.code }),
        ],
      });
    case `caps`:
      return (0, jsxRuntime.jsxs)(`div`, {
        className: `flex h-full items-center justify-center gap-2 px-4`,
        children: [
          (0, jsxRuntime.jsx)(`span`, {
            className: `rounded-md px-1.5 text-[11px] font-bold ${e.on ? `bg-amber-300 text-black` : `bg-white/12 text-ink-2`}`,
            children: `⇪`,
          }),
          (0, jsxRuntime.jsxs)(`span`, {
            className: `text-[13px] font-semibold text-ink`,
            children: [`Caps Lock `, e.on ? o(`включён`, `on`) : o(`выключен`, `off`)],
          }),
        ],
      });
    case `mic`:
      return (0, jsxRuntime.jsx)(aj, {
        icon: (0, jsxRuntime.jsx)($, {
          tone: `bg-orange-400/20 text-orange-300`,
          children: (0, jsxRuntime.jsx)(jn, { size: 17 }),
        }),
        title: o(`Микрофон: ${e.apps.join(`, `)}`, `Microphone: ${e.apps.join(`, `)}`),
        sub: o(`Кнопка справа выключит его во всей системе`, `The button on the right mutes it system-wide`),
        children: (0, jsxRuntime.jsx)(hj, {
          title: o(`Выключить микрофон`, `Mute the microphone`),
          onClick: () => void u.micToggle(),
          tone: `bg-orange-400 text-neutral-950 hover:bg-orange-300`,
          children: (0, jsxRuntime.jsx)(Lo, { size: 16 }),
        }),
      });
    case `micMuted`:
      return (0, jsxRuntime.jsx)(aj, {
        icon: (0, jsxRuntime.jsx)($, {
          tone: e.muted ? `bg-danger/20 text-danger` : `bg-white/10 text-ink`,
          children: e.muted ? (0, jsxRuntime.jsx)(Lo, { size: 17 }) : (0, jsxRuntime.jsx)(jn, { size: 17 }),
        }),
        title: e.muted ? o(`Микрофон выключен`, `Microphone muted`) : o(`Микрофон включён`, `Microphone on`),
      });
    case `cam`:
      return (0, jsxRuntime.jsx)(aj, {
        icon: (0, jsxRuntime.jsx)($, {
          tone: `bg-emerald-400/20 text-emerald-300`,
          children: (0, jsxRuntime.jsx)(Cn, { size: 17 }),
        }),
        title: o(`Камера: ${e.apps.join(`, `)}`, `Camera: ${e.apps.join(`, `)}`),
        sub: o(`Сейчас она снимает`, `It is recording right now`),
      });
    case `vpn`: {
      let t = e.vpn,
        n = [t.country ?? t.countryCode, t.ip].filter(Boolean).join(` · `);
      return (0, jsxRuntime.jsx)(aj, {
        icon: (0, jsxRuntime.jsx)($, {
          tone: t.active ? `bg-emerald-400/20 text-emerald-300` : `bg-white/10 text-ink-2`,
          children: t.active ? (0, jsxRuntime.jsx)(cs, { size: 17 }) : (0, jsxRuntime.jsx)(us, { size: 17 }),
        }),
        title: t.active ? o(`VPN подключён`, `VPN connected`) : o(`VPN отключён`, `VPN disconnected`),
        sub: (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
          children: [
            n || o(`страна неизвестна`, `country unknown`),
            t.active &&
              t.via &&
              (0, jsxRuntime.jsxs)(`span`, { className: `text-ink-3`, children: [` · `, t.via] }),
          ],
        }),
        onClick: () => void u.vpnRefresh(),
      });
    }
    case `download`:
      return (0, jsxRuntime.jsx)(Sj, { peek: e });
    case `recorded`:
      return (0, jsxRuntime.jsx)(bj, { peek: e });
    case `update`:
      return (0, jsxRuntime.jsx)(aj, {
        icon: i
          ? (0, jsxRuntime.jsx)(mj, { mood: `attn` })
          : (0, jsxRuntime.jsx)($, {
              tone: `bg-accent/20 text-accent`,
              children: (0, jsxRuntime.jsx)(fr, { size: 17 }),
            }),
        title: o(`Доступна версия ${e.info.version}`, `Version ${e.info.version} is available`),
        sub: o(
          `Сейчас ${e.info.current} · займёт полминуты`,
          `You have ${e.info.current} · takes half a minute`,
        ),
        children: (0, jsxRuntime.jsx)(`button`, {
          className: `press h-8 shrink-0 rounded-full bg-white px-3.5 text-[12.5px] font-semibold text-black`,
          onClick: (e) => {
            (e.stopPropagation(), r());
          },
          children: o(`Обновить`, `Update`),
        }),
      });
    case `notification`:
      return (0, jsxRuntime.jsx)(oj, { peek: e });
    case `agent`:
      return (0, jsxRuntime.jsx)(sj, { peek: e });
    case `agentAsk`:
      return (0, jsxRuntime.jsx)(fj, { peek: e });
    case `news`:
      return (0, jsxRuntime.jsx)(aj, {
        icon: i
          ? (0, jsxRuntime.jsx)(mj, { mood: `happy` })
          : (0, jsxRuntime.jsx)($, {
              tone: `bg-accent/20 text-accent`,
              children: (0, jsxRuntime.jsx)(fr, { size: 17 }),
            }),
        title: o(`Island обновлён до ${e.version}`, `Island is updated to ${e.version}`),
        sub: o(`Посмотри, что изменилось`, `See what has changed`),
        onClick: () => void u.openSettings(`updates`),
        children: (0, jsxRuntime.jsx)(`button`, {
          "data-news-open": !0,
          className: `press h-8 shrink-0 rounded-full bg-white px-3.5 text-[12.5px] font-semibold text-black`,
          onClick: (e) => {
            (e.stopPropagation(), u.openSettings(`updates`));
          },
          children: o(`Что нового`, `What's new`),
        }),
      });
    case `chat`:
      return (0, jsxRuntime.jsx)(aj, {
        icon: i
          ? (0, jsxRuntime.jsx)(mj, { mood: `happy` })
          : (0, jsxRuntime.jsx)($, {
              tone: `bg-accent/20 text-accent`,
              children: (0, jsxRuntime.jsx)(fr, { size: 17 }),
            }),
        title: o(`ИИ ответил`, `The AI replied`),
        sub: e.text,
        onClick: () => t(`click`, `chat`),
      });
    case `reminder`:
      return (0, jsxRuntime.jsx)(gj, { peek: e });
    case `timer`:
      return (0, jsxRuntime.jsx)(_j, { peek: e });
    case `weather`:
      return (0, jsxRuntime.jsx)(aj, {
        icon: (0, jsxRuntime.jsx)(`span`, {
          className: `grid size-10 shrink-0 place-items-center rounded-full bg-[#85B7EB]/15`,
          children: (0, jsxRuntime.jsx)(nn, { sky: e.sky, size: 30 }),
        }),
        title: e.title,
        sub: e.sub,
        onClick: () => t(`click`, `weather`),
      });
    case `pro`:
      return (0, jsxRuntime.jsx)(aj, {
        icon: (0, jsxRuntime.jsx)($, {
          tone: `bg-[#8ea2ff]/18 text-accent-ink`,
          children: (0, jsxRuntime.jsx)(fr, { size: 17 }),
        }),
        title: Xn(e.feature),
        sub: o(
          `Купить за ${$n()} или ввести ключ — в настройках`,
          `Buy for ${$n()} or enter a key in Settings`,
        ),
        onClick: () => void u.openSettings(),
      });
    case `dictated`:
      return (0, jsxRuntime.jsxs)(`div`, {
        className: `flex h-full items-center gap-3 px-3.5`,
        children: [
          i
            ? (0, jsxRuntime.jsx)(mj, { mood: `happy` })
            : (0, jsxRuntime.jsx)($, {
                tone: `bg-ok/20 text-ok`,
                children: (0, jsxRuntime.jsx)(jn, { size: 17 }),
              }),
          (0, jsxRuntime.jsxs)(`div`, {
            className: `min-w-0 flex-1`,
            children: [
              (0, jsxRuntime.jsx)(`div`, {
                className: `line-clamp-2 text-[12.5px] leading-snug text-ink`,
                children: e.text,
              }),
              (0, jsxRuntime.jsx)(`div`, {
                className: `truncate text-[11px] text-ink-3`,
                children: e.pasted
                  ? o(`Вставлено · осталось в буфере`, `Pasted · kept on the clipboard`)
                  : o(`Текст в буфере`, `Text copied`),
              }),
            ],
          }),
          (0, jsxRuntime.jsx)(hj, {
            title: o(`Открыть в текст-тулзах`, `Open in text tools`),
            onClick: () => {
              (n(e.text), t(`click`, `text`));
            },
            children: (0, jsxRuntime.jsx)(eo, { size: 15 }),
          }),
        ],
      });
    case `done`:
      return (0, jsxRuntime.jsx)(aj, {
        icon: i
          ? (0, jsxRuntime.jsx)(mj, { mood: `happy` })
          : (0, jsxRuntime.jsx)($, {
              tone: `bg-ok/20 text-ok`,
              children: (0, jsxRuntime.jsx)(_r, {
                size: 17,
                className: `pop-in`,
                style: { animationDelay: `60ms` },
              }),
            }),
        title: e.label,
      });
    case `error`:
      return (0, jsxRuntime.jsxs)(`div`, {
        className: `flex h-full items-center gap-3 px-4`,
        children: [
          i
            ? (0, jsxRuntime.jsx)(mj, { mood: `sad` })
            : (0, jsxRuntime.jsx)($, {
                tone: `bg-danger/20 text-danger`,
                children: (0, jsxRuntime.jsx)(Ia, { size: 17 }),
              }),
          (0, jsxRuntime.jsx)(`div`, {
            className: `line-clamp-2 min-w-0 flex-1 text-[12.5px] leading-snug text-ink`,
            children: e.message,
          }),
        ],
      });
  }
}
var jj = 428;
function Mj() {
  let e = useIslandStore(
    (e) =>
      e.expanded &&
      e.license.pro &&
      e.tab === `chat` &&
      e.chatService !== `island` &&
      e.webAiPopped !== e.chatService,
  );
  (0, ReactRuntime.useEffect)(() => {
    if (e) {
      u.islandTall(!0);
      return;
    }
    let t = 0,
      n = () => {
        let e = document.querySelector(`[data-island]`)?.getBoundingClientRect();
        if (!e || e.bottom <= jj) {
          ((t = 0), u.islandTall(!1));
          return;
        }
        t = requestAnimationFrame(n);
      };
    return (n(), () => cancelAnimationFrame(t));
  }, [e]);
}
function readLayoutViewportHeight() {
  const height = Number(document.documentElement.dataset.layoutViewportHeight);
  return Number.isFinite(height) && height > 0 ? height : window.innerHeight;
}
function Nj() {
  let [e, t] = (0, ReactRuntime.useState)(readLayoutViewportHeight);
  return (
    (0, ReactRuntime.useEffect)(() => {
      let e = () => t(readLayoutViewportHeight());
      window.addEventListener(`resize`, e);
      window.addEventListener(`woods:layout-viewport`, e);
      return () => {
        window.removeEventListener(`resize`, e);
        window.removeEventListener(`woods:layout-viewport`, e);
      };
    }, []),
    e
  );
}
var Bj = 700,
  Vj = { type: `spring`, stiffness: 420, damping: 34, mass: 0.9 },
  Hj = { type: `spring`, stiffness: 300, damping: 34, mass: 0.9 },
  Uj = {
    initial: { opacity: 0, filter: `blur(6px)` },
    animate: {
      opacity: 1,
      filter: `blur(0px)`,
      transition: { delay: 0.07, duration: 0.24, ease: [0.2, 0.8, 0.2, 1] },
    },
    exit: { opacity: 0, filter: `blur(4px)`, transition: { duration: 0.1 } },
  };
function useIslandGeometry(e) {
  let t = useIslandStore((e) => e.palette),
    r = useIslandStore((e) => e.expanded),
    i = useIslandStore((e) => e.dragOver),
    a = useIslandStore(
      (e) =>
        Fi({
          onChat: e.expanded && e.tab === `chat`,
          launcher: e.settings?.moduleLauncher !== !1,
          chat: e.license.pro,
        }).length,
    ),
    o = useIslandStore((e) => e.peek),
    s = useIslandStore(
      (e) =>
        e.tall ||
        e.tab === `note` ||
        (e.license.pro && (e.tab === `chat` || (e.tab === `weather` && e.settings?.moduleWeather !== !1))),
    ),
    c = useIslandStore(
      (e) =>
        e.license.pro && e.tab === `chat` && e.chatService !== `island` && e.webAiPopped !== e.chatService,
    ),
    l = Nj(),
    u = useIslandStore((e) => e.tab === `home`),
    d = useIslandStore((e) => e.settings?.homeHidden),
    f = useIslandStore((e) => e.media !== null),
    m = useIslandStore((e) => e.settings?.moduleMedia !== !1),
    h = useIslandStore((e) => e.settings?.moduleLauncher !== !1),
    g = useIslandStore((e) => (e.settings?.homePlayer ?? `soft`) !== `compact`),
    _ = useIslandStore((e) => e.settings?.lyrics === !0 && e.settings.lyricsInHome !== !1),
    v = Yt((e) => e.status === `ready` && !!e.lyrics && !e.lyrics.instrumental),
    S = useIslandStore((e) => e.headerMin),
    C = u
      ? Un(Bn(d, { media: f, mediaModule: m, launcherModule: h }), {
          big: g,
          words: _ && v,
          header: S || 560,
        })
      : null,
    w = Ye() !== null,
    T = useIslandStore((e) => e.settings?.showClock !== !1),
    E = useIslandStore((e) => e.settings?.clockSeconds === !0),
    D = useIslandStore((e) => e.settings?.layoutInPill === !0 && e.layoutCode !== ``),
    O = useIslandStore((e) =>
      e.settings?.desktopInPill === !0 && e.vdesk && e.vdesk.count > 1 ? y(e.vdesk).length : 0,
    ),
    k = useIslandStore((e) => e.settings?.showBattery !== !1 && e.battery !== null),
    ee = useIslandStore((e) => qn(ur(e)).kind === `slot`),
    te = useIslandStore((e) => e.settings?.characterSize === `large`),
    ie = useIslandStore((e) => ne(qn(ur(e)).box, e.settings?.characterSize === `large` ? 44 : void 0)),
    se = useIslandStore((e) => qn(ur(e)).face === !0),
    ce = useIslandStore((e) => e.settings?.moduleMedia !== !1 && e.mediaLive),
    le = useIslandStore((e) => (e.settings?.moduleShelf === !1 ? 0 : e.shelf.length)),
    ue = useIslandStore((e) => e.updating !== null),
    de = useIslandStore((e) => e.recording !== null),
    fe = useIslandStore((e) => e.dictation !== null),
    pe = useIslandStore((e) => e.downloads.length > 0 && e.settings?.downloadsInPill !== `badge`),
    A = useIslandStore((e) => e.downloads.length > 0 && e.settings?.downloadsInPill === `badge`),
    me = useIslandStore((e) => e.caps && e.settings?.showCaps !== !1),
    he = useIslandStore((e) =>
      e.settings?.showPrivacy === !1 ? 0 : +(e.privacy.mic.length > 0) + +(e.privacy.cam.length > 0),
    ),
    ge = useIslandStore(
      (e) => e.settings?.obsStatus === !0 && !!e.obs && (e.obs.recording || e.obs.streaming),
    ),
    _e = useIslandStore((e) => e.settings?.agentsStatus !== !1 && e.license.pro && e.agents.length > 0),
    ve = me || he > 0 || ge || _e || A,
    ye = $t(),
    be = useIslandStore(qj),
    xe = useIslandStore((e) => (e.media?.durationMs ?? 0) > 0),
    Se = useIslandStore((e) => e.settings?.lyrics === !0 && e.settings.lyricsInPlayer !== !1),
    Ce = Yt((e) => (e.status === `ready` ? e.lineW : 0)),
    we = xe ? Ce : 0;
  const geometry = calculateIslandGeometry({
    palette: t, expanded: r, dragOver: !!i, dropZoneCount: a,
    peek: !!o, dictating: fe, recording: de, updating: ue, downloads: pe,
    mediaLive: ce, shelfCount: le, status: !!ve,
    paletteMeasure: e, tall: !!s, externalChat: c, viewportHeight: l, homeSize: C,
    peekContent: o ? {
      kind: o.kind, noteBody: o.kind === 'notification' ? o.note.body : undefined,
      agentMessage: o.kind === 'agent' ? o.agent.message : undefined,
      question: o.kind === 'agentAsk' && o.ask.kind === 'question',
      questionHeight: o.kind === 'agentAsk' && o.ask.kind === 'question' ? dj(o.ask, o.step) : undefined,
      label: o.kind === 'done' ? o.label : undefined,
    } : null,
    mediaPill: be, devicePixelRatio: window.devicePixelRatio,
    widgets: {
      character: ee, slot: ie, big: te, face: se, weather: w,
      clock: T, seconds: E, battery: k, caps: me, layout: D, desk: O,
      dots: he, obs: ge, agent: _e, download: A, shelf: le, timer: ye,
      seekable: xe, lyrics: Se, words: we,
    },
  });
  (0, ReactRuntime.useEffect)(() => {
    Yt.getState().wrap !== geometry.wrap && Yt.setState({ wrap: geometry.wrap });
  }, [geometry.wrap]);
  return geometry;
}
function useRuntimeEvents() {
  (0, ReactRuntime.useEffect)(() => {
    let e = useIslandStore,
      c = () => e.getState().settings;
    let disposed = false;
    const interactions = createIslandInteractions({
      getState: e.getState,
      setState: e.setState,
      open: (source, tab) => e.getState().open(source, tab),
      close: () => e.getState().close(),
      openPalette: () => e.getState().openPalette(),
      closePalette: () => e.getState().closePalette(),
    });
    const mediaEvents = createMediaEventController({
      getMedia: () => e.getState().media,
      setMedia: media => e.setState({ media }),
      setCover: cover => e.setState({ cover }),
      setAccent: accent => e.setState({ accent }),
      resetLevel: () => e.setState({ level: 0 }),
      extractAccent: sr,
      isLive: () => e.getState().mediaLive,
      setLive: mediaLive => e.setState({ mediaLive }),
    });
    (u.webAiPopped().then(
      (t) => !disposed && e.setState({ webAiPopped: t }),
      () => void 0,
    ),
      u.bootstrap().then((t) => {
        if (disposed) return;
        (e.setState({
          settings: t.settings,
          shelf: t.shelf,
          launcher: t.launcher,
          media: t.media,
          mediaLive: t.media?.playing ?? !1,
          cover: t.cover,
          audio: t.audio,
          downloads: t.downloads ?? [],
          privacy: t.privacy,
          vpn: t.vpn,
          update: t.update,
          version: t.version,
          caps: t.capsLock,
          layoutCode: t.layout,
          license: t.license,
          battery: t.battery,
          vdesk: t.vdesk ?? null,
        }),
          t.trialOver && e.getState().pushPeek({ kind: `pro`, feature: `trial` }),
          !t.news.told &&
            t.news.from !== t.news.version &&
            (e.getState().pushPeek({ kind: `news`, version: t.version }), u.newsTold()),
          mediaEvents.seed(t.media, t.cover));
      }),
      u
        .agentsNow()
        .then((t) => !disposed && e.setState({ agents: t }))
        .catch(() => {}));
    let l = (e) => c()?.[e] !== !1,
      d = [
        T(`hover`, interactions.hover),
        T(`outside-click`, interactions.outsideClick),
        T(`island:palette`, interactions.togglePalette),
        T(`webai:open`, (e) => fa(e)),
        T(`webai:active`, interactions.webAiActive),
        T(`webai:popped`, (t) => e.setState({ webAiPopped: t })),
        T(`island:toggle`, interactions.toggle),
        T(`clipboard:new`, (t) => {
          (window.dispatchEvent(new Event(ln)),
            !t.own && !t.again && e.getState().pushPeek({ kind: `copied`, clip: t.clip }));
        }),
        T(`media:update`, payload => mediaEvents.update(payload ? Le(payload) : null)),
        T(`media:cover`, mediaEvents.cover),
        T(`media:level`, (t) => e.setState({ level: t })),
        T(`media:bands`, (t) => e.setState({ bands: t, bandsAt: performance.now() })),
        T(`mascot:look`, (t) => e.setState({ look: t })),
        T(`mascot:sleep`, (t) => e.setState({ asleep: t })),
        T(`capture:done`, (t) => {
          let n = e.getState();
          t.kind === `screenshot`
            ? n.pushPeek({
                kind: `screenshot`,
                path: t.path,
                thumb: t.thumb,
                width: t.width,
                height: t.height,
              })
            : t.kind === `ocr`
              ? n.pushPeek({ kind: `ocr`, text: t.text })
              : t.kind === `qr`
                ? n.pushPeek({ kind: `qr`, text: t.text, url: t.url })
                : n.pushPeek({ kind: `color`, hex: t.hex, rgb: t.rgb, history: t.history });
        }),
        T(`audio:state`, ({ state: t, reason: n }) => {
          e.setState({ audio: t });
          let r = e.getState();
          if (n === `mic`) r.pushPeek({ kind: `micMuted`, muted: t.micMuted === !0 });
          else if (l(`showVolume`))
            n === `device`
              ? r.pushPeek({ kind: `device`, name: t.device })
              : r.pushPeek({ kind: `volume`, level: t.level, muted: t.muted });
          else return;
        }),
        T(`privacy:update`, (t) => {
          let n = e.getState().privacy;
          if ((e.setState({ privacy: t }), !l(`showPrivacy`))) return;
          let r = t.mic.filter((e) => !n.mic.includes(e));
          (t.cam.filter((e) => !n.cam.includes(e)).length &&
            e.getState().pushPeek({ kind: `cam`, apps: t.cam }),
            r.length && e.getState().pushPeek({ kind: `mic`, apps: t.mic }));
        }),
        T(`vpn:update`, (t) => {
          let n = e.getState().vpn;
          (e.setState({ vpn: t }),
            l(`showVpn`) && n && n.active !== t.active && e.getState().pushPeek({ kind: `vpn`, vpn: t }));
        }),
        T(`downloads:update`, (t) => e.setState({ downloads: t })),
        T(`downloads:done`, (t) => {
          l(`showDownloads`) && e.getState().pushPeek({ kind: `download`, file: t });
        }),
        T(`notify:new`, (t) => {
          c()?.showNotifications === !0 && e.getState().pushPeek({ kind: `notification`, note: t });
        }),
        T(`input:layout`, (t) => {
          l(`showLayout`) && e.getState().pushPeek({ kind: `layout`, code: t });
        }),
        T(`input:lang`, (t) => e.setState({ layoutCode: t })),
        T(`desktop:virtual`, (t) => e.setState({ vdesk: t })),
        T(`input:caps`, (t) => {
          (e.setState({ caps: t }), l(`showCaps`) && e.getState().pushPeek({ kind: `caps`, on: t }));
        }),
        T(`update:available`, (t) => {
          (e.setState({ update: t }), e.getState().pushPeek({ kind: `update`, info: t }));
        }),
        T(`update:progress`, (t) => e.setState({ updating: t })),
        T(`record:started`, (t) => {
          (e.getState().close(), e.setState({ recording: t }));
        }),
        T(`record:done`, (t) => {
          (e.setState({ recording: null }), t && e.getState().pushPeek({ kind: `recorded`, ...t }));
        }),
        T(`update:none`, (t) =>
          e
            .getState()
            .pushPeek({
              kind: `done`,
              label: o(`Последняя версия ${t} уже стоит`, `You have the latest version, ${t}`),
            }),
        ),
        T(`capture:error`, (t) => e.getState().pushPeek({ kind: `error`, message: t })),
        T(`island:warn`, (t) => e.getState().pushPeek({ kind: `error`, message: t })),
        T(`island:note`, (t) => e.getState().pushPeek({ kind: `done`, label: t })),
        T(`obs:state`, (t) => e.setState({ obs: t })),
        T(`agents:update`, (t) => e.setState({ agents: t })),
        T(`agents:card`, (t) => {
          c()?.agentsStatus !== !1 && e.getState().pushPeek({ kind: `agent`, agent: t });
        }),
        T(`agents:ask`, (t) => {
          c()?.agentsAsk !== !1 && e.getState().pushPeek({ kind: `agentAsk`, ask: t });
        }),
        T(`agents:ask-done`, (t) => e.getState().dropAsk(t)),
        T(`vpn:choose`, () => {
          if (c()?.moduleControls === !1) {
            e.getState().pushPeek({
              kind: `error`,
              message: o(
                `Какой VPN включить, спрашивает центр управления: включи его в настройках`,
                `Which VPN to bring up is asked in the control centre: turn it on in the settings`,
              ),
            });
            return;
          }
          (e.setState({ vpnAsk: Date.now() }), e.getState().open(`hotkey`, `controls`));
        }),
        T(`dictation:state`, (t) => {
          let n = e.getState().dictation;
          e.setState({
            dictation:
              t.state === `idle`
                ? null
                : { state: t.state, target: t.target, startedAt: n?.startedAt ?? Date.now() },
            voice: 0,
          });
        }),
        T(`dictation:level`, (t) => e.setState({ voice: t })),
        T(`dictation:done`, (t) => {
          t.target === `chat`
            ? M.setState((e) => ({ draft: e.draft.trim() ? `${e.draft.trimEnd()} ${t.text}` : t.text }))
            : e.getState().pushPeek({ kind: `dictated`, text: t.text, pasted: t.pasted });
        }),
        T(`license:changed`, (t) => {
          if ((e.setState({ license: t }), !t.pro)) return;
          let n = e.getState();
          (n.queue.some((e) => e.kind === `pro`) &&
            e.setState({ queue: n.queue.filter((e) => e.kind !== `pro`) }),
            n.peek?.kind === `pro` && e.getState().nextPeek());
        }),
        T(`license:needed`, (t) => e.getState().pushPeek({ kind: `pro`, feature: t })),
        T(`weather:update`, (e) => dn.getState().received(e)),
        T(`weather:error`, (e) => dn.getState().failed(e)),
        T(`dictation:error`, (t) => {
          let n = e.getState();
          n.expanded && n.tab === `chat` ? M.getState().say(t) : n.pushPeek({ kind: `error`, message: t });
        }),
        T(`fullscreen`, (t) => {
          (t && e.getState().close(), lr(`fullscreen`, t));
        }),
        T(`power:update`, (t) => e.setState({ battery: t })),
        T(`island:edge`, (t) => e.setState({ atEdge: t })),
        T(`island:shy`, (t) => e.setState({ shy: t })),
        T(`island:desktop`, (t) => e.setState({ desktop: t })),
        T(`island:keep`, (t) => e.setState({ keep: t })),
        T(`cursor:near`, Jn),
        T(`settings:changed`, (t) => e.setState({ settings: t })),
        T(`shelf:changed`, (t) => e.setState({ shelf: t })),
        T(`launcher:changed`, (t) => e.setState({ launcher: t })),
        xr().onDragDropEvent((n) => {
          let r = n.payload,
            i = e.getState(),
            a = Fi({
              onChat: i.expanded && i.tab === `chat`,
              launcher: c()?.moduleLauncher !== !1,
              chat: i.license.pro,
            }),
            o = (e) => {
              let t = window.devicePixelRatio,
                n =
                  document.elementFromPoint(e.x / t, e.y / t)?.closest(`[data-zone]`)?.dataset.zone ??
                  i.dragOver?.zone;
              return n && a.includes(n) ? n : a[0];
            };
          if (r.type === `enter` || r.type === `over`) {
            interactions.cancelHoverOpen();
            let n = o(r.position);
            i.dragOver?.zone !== n && e.setState({ dragOver: { zone: n } });
          } else if (r.type === `drop` && o(r.position) === `chat`)
            (e.setState({ dragOver: null }),
              r.paths.length > 0 && M.getState().attachPaths(r.paths),
              (i.expanded && i.tab === `chat`) || e.getState().open(`click`, `chat`));
          else if (r.type === `drop`) {
            let t = o(r.position);
            if ((e.setState({ dragOver: null, expanded: !1 }), r.paths.length === 0)) return;
            let n = r.paths[0].split(/[\\/]/).pop() ?? ``,
              i = r.paths.length;
            t === `launcher`
              ? u.launcherAdd(r.paths).then((t) => {
                  (e.setState({ launcher: t }),
                    e.getState().pushPeek({ kind: `launcher`, count: i, name: n }));
                })
              : u.shelfAdd(r.paths).then((t) => {
                  (e.setState({ shelf: t }), e.getState().pushPeek({ kind: `shelf`, count: i, name: n }));
                });
          } else e.setState({ dragOver: null });
        }),
      ],
      f = (t) => {
        t.key === `Escape` && interactions.escape();
      };
    window.addEventListener(`keydown`, f);
    let p = ua(),
      m = Vt(),
      h = ve(),
      g = yt();
    return () => {
      (disposed = true,
        g(),
        mediaEvents.dispose(),
        interactions.dispose(),
        p(),
        m(),
        h(),
        window.removeEventListener(`keydown`, f),
        d.forEach((e) => void e.then((e) => e())));
    };
  }, []);
}
function Kj() {
  let e = useIslandStore((e) => e.settings?.theme),
    t = useIslandStore((e) => e.settings?.islandColor),
    [n, r] = (0, ReactRuntime.useState)(
      () => St(e, t, window.matchMedia(`(prefers-color-scheme: light)`).matches).theme,
    );
  return (
    (0, ReactRuntime.useEffect)(() => {
      let n = window.matchMedia(`(prefers-color-scheme: light)`),
        i = () => {
          let i = St(e, t, n.matches),
            a = document.documentElement;
          ((a.dataset.theme = i.theme),
            i.color
              ? (a.style.setProperty(`--color-island`, i.color),
                i.theme === `light`
                  ? a.style.setProperty(`--color-black`, i.color)
                  : a.style.removeProperty(`--color-black`))
              : (a.style.removeProperty(`--color-island`), a.style.removeProperty(`--color-black`)),
            r(i.theme));
        };
      return (i(), n.addEventListener(`change`, i), () => n.removeEventListener(`change`, i));
    }, [e, t]),
    n
  );
}
function qj(e) {
  let t = v(e.settings?.mediaPill);
  return t === `lyrics` && e.settings?.lyrics !== !0 ? `title` : t;
}
const Jj = hasPersistentActivity;
function IslandApp() {
  useRuntimeEvents();
  let e = Kj(),
    [t, n] = (0, ReactRuntime.useState)({ rows: 0, answer: !1 }),
    i = (0, ReactRuntime.useCallback)((e, t) => n({ rows: e, answer: t }), []),
    { mode: a, w: s, h: c } = useIslandGeometry(t);
  Mj();
  let l = useIslandStore((e) => e.settings?.style ?? `notch`),
    d = useIslandStore((e) => e.peek),
    f = useIslandStore((e) => e.open),
    p = l === `capsule`,
    m = Dn(),
    h = useIslandStore((e) => e.settings?.liquidWith === !0 && e.license.pro),
    g = Vn(m.kind, h, !0),
    v = hn(),
    y = useIslandStore((e) => e.accent),
    x = useIslandStore((e) => e.look),
    C = dn((e) => lt(e.data)),
    w = useIslandStore((e) => e.settings?.moduleWeather !== !1),
    T = C && w,
    E = a === `drop` ? `eat` : a === `peek` && d ? (Ln(d.kind) ?? v) : v,
    D = p ? 8 : 0,
    k = a === `expanded` || a === `drop` || a === `palette`,
    ee = useIslandStore((e) =>
      r({
        autoHide: S({
          autoHide: e.settings?.autoHide === !0,
          showOnDesktop: e.settings?.showOnDesktop === !0,
          desktop: e.desktop,
          shy: e.shy,
          keep: e.keep,
        }),
        mode: a,
        hovered: e.hovered,
        atEdge: e.atEdge,
      }),
    ),
    [te, ne] = (0, ReactRuntime.useState)(!1);
  ((0, ReactRuntime.useEffect)(() => {
    if (ee) {
      ne(!1);
      return;
    }
    let e = setTimeout(() => ne(!0), Bj);
    return () => clearTimeout(e);
  }, [ee]),
    (0, ReactRuntime.useEffect)(() => {
      if (!te) {
        lr(`tucked`, !1);
        return;
      }
      let e = setTimeout(() => lr(`tucked`, !0), 500);
      return () => clearTimeout(e);
    }, [te]));
  let re = useIslandStore((e) => _(e.settings?.through === !0, a)),
    ae = useIslandStore((e) =>
      ie(k ? e.settings?.opacityOpen : re ? (e.settings?.opacityThrough ?? 45) : e.settings?.opacityRest),
    ),
    oe = useIslandStore((e) => e.settings?.through === !0),
    se = useIslandStore((e) => e.settings?.hotkeyThrough ?? ``),
    ce = (0, ReactRuntime.useRef)(null);
  (0, ReactRuntime.useEffect)(() => {
    (ce.current === !1 &&
      oe &&
      useIslandStore
        .getState()
        .pushPeek({
          kind: `done`,
          label: se
            ? o(`Клики проходят сквозь остров · вернуть: ${se}`, `Clicks go through the island · back: ${se}`)
            : o(
                `Клики проходят сквозь остров · вернуть: Alt+Space, «сквозной»`,
                `Clicks go through the island · back: Alt+Space, “through”`,
              ),
        }),
      (ce.current = oe));
  }, [oe, se]);
  let le = Math.min(c / 2, k ? 32 : 26),
    ue = (0, ReactRuntime.useRef)({ w: s, h: c, fold: LIQUID_FOLDED });
  ue.current = updateSizeHistory(ue.current, s, c);
  let de = selectSizeTransition(a, useIslandStore.getState().settings?.mediaPill === 'lyrics', g, ue.current.fold),
    fe = oi(s),
    pe = li(fe, (e) => b(e, window.devicePixelRatio));
  ((0, ReactRuntime.useLayoutEffect)(() => {
    let e = Pi(fe, s, `width` in de ? de.width : de);
    return () => e.stop();
  }, [s]),
    ai(pe, `change`, () => {
      g && Oe.postRender(Zn);
    }),
    (0, ReactRuntime.useEffect)(() => {
      let e = [],
        t = () => void u.reportPageScale(window.innerWidth).catch(() => {}),
        n = () => {
          (e.forEach(clearTimeout), (e = [0, 250, 700].map((e) => window.setTimeout(t, e))));
        };
      (n(), window.addEventListener(`resize`, n));
      let r = window.setInterval(t, 3e3);
      return () => {
        (e.forEach(clearTimeout), window.removeEventListener(`resize`, n), clearInterval(r));
      };
    }, []),
    (0, ReactRuntime.useEffect)(() => {
      let e = 0,
        t = "",
        reportSequence = 0,
        disposed = false;
      const n = () => {
        const r = document.querySelector("[data-island]")?.getBoundingClientRect();
        if (r) {
          const attachment = document.querySelector("[data-island] > [data-attached-character]");
          const inset = name => Math.max(0, Math.min(128, Number(attachment?.dataset[name]) || 0));
          const args = [Math.floor(r.x), Math.floor(r.y), Math.ceil(r.width), Math.ceil(r.height), k, te, re,
            inset('attachmentRight'), inset('attachmentBottom')];
          const key = [...args, window.innerWidth, window.innerHeight].join(",");
          if (key !== t) {
            t = key;
            const sequence = ++reportSequence;
            void u.reportRect(...args).then(result => {
              if (disposed || sequence !== reportSequence) return;
              const height = result?.layoutViewportHeight;
              if (typeof height === 'number' && Number.isFinite(height) && height > 0) {
                const root = document.documentElement;
                const previous = Number(root.dataset.layoutViewportHeight);
                root.dataset.layoutViewportHeight = String(height);
                root.dataset.canvasOverscanWidth = String(result.canvasOverscanWidth ?? 0);
                root.dataset.canvasOverscanBottom = String(result.canvasOverscanBottom ?? 0);
                if (previous !== height) window.dispatchEvent(new Event('woods:layout-viewport'));
              }
            }).catch(() => {});
          }
        }
        e = requestAnimationFrame(n);
      };
      e = requestAnimationFrame(n);
      return () => { disposed = true; cancelAnimationFrame(e); };
    }, [s, c, D, k, te, re]));
  let A = useIslandStore(qj),
    me = useIslandStore((e) => e.settings?.lyrics === !0 && e.settings.lyricsInPlayer !== !1),
    he = a === `liveMedia` && A === `player` && me ? y : null,
    ge =
      a === `peek`
        ? `peek-${d?.id}`
        : a === `liveStatus` || a === `liveShelf`
          ? `idle`
          : a === `liveMedia`
            ? `liveMedia-${A}`
            : a,
    _e = (0, ReactRuntime.useMemo)(() => {
      switch (a) {
        case `palette`:
          return (0, jsxRuntime.jsx)(ij, { onResize: i });
        case `expanded`:
          return (0, jsxRuntime.jsx)(jA, {});
        case `drop`:
          return (0, jsxRuntime.jsx)(Os, {});
        case `peek`:
          return d ? (0, jsxRuntime.jsx)(wj, { peek: d }) : null;
        case `liveMedia`:
          return A === `player`
            ? (0, jsxRuntime.jsx)(jt, {})
            : A === `lyrics`
              ? (0, jsxRuntime.jsx)(qt, {})
              : A === `title`
                ? (0, jsxRuntime.jsx)(ht, {})
                : (0, jsxRuntime.jsx)(zt, {});
        case `liveShelf`:
        case `liveStatus`:
          return (0, jsxRuntime.jsx)(Ut, {});
        case `liveDownloads`:
          return (0, jsxRuntime.jsx)(Tt, {});
        case `liveUpdating`:
          return (0, jsxRuntime.jsx)(Dt, {});
        case `liveRecording`:
          return (0, jsxRuntime.jsx)(kt, {});
        case `liveDictation`:
          return (0, jsxRuntime.jsx)(xt, {});
        case `idle`:
          return (0, jsxRuntime.jsx)(Ut, {});
        default:
          return null;
      }
    }, [a, d, i, A]),
    ve =
      a !== `expanded` &&
      a !== `drop` &&
      a !== `peek` &&
      a !== `liveUpdating` &&
      a !== `palette` &&
      a !== `liveDictation`,
    ye = useIslandStore(
      (e) => e.peek?.kind === `timer` || e.peek?.kind === `reminder` || e.peek?.kind === `agentAsk`,
    ),
    be =
      useIslandStore((e) => e.settings?.showVolume !== !1) && (ve || d?.kind === `volume`)
        ? (e) => void u.volumeStep(e.deltaY < 0 ? 0.02 : -0.02)
        : void 0;
  return (0, jsxRuntime.jsx)(`div`, {
    className: `flex h-full justify-center`,
    style: { paddingTop: D },
    children: (0, jsxRuntime.jsx)(Et.div, {
      "data-island-shell": !0,
      "data-alert-glow": ye || void 0,
      initial: !1,
      animate: { y: te ? -(c + D + 18) : 0, opacity: ae },
      transition: { y: te ? Hj : Vj, opacity: { duration: 0.22 } },
      children: (0, jsxRuntime.jsxs)(Et.div, {
        "data-island": !0,
        className: `relative text-ink ${g ? `` : `bg-island`}`,
        initial: !1,
        style: { width: pe },
        animate: {
          height: c,
          borderBottomLeftRadius: le,
          borderBottomRightRadius: le,
          borderTopLeftRadius: p ? le : 0,
          borderTopRightRadius: p ? le : 0,
          boxShadow: tn(e, !g && (k || a === `peek`)),
        },
        transition: de,
        onUpdate: g ? () => Oe.postRender(Zn) : void 0,
        onClick: ve ? () => f(`click`) : void 0,
        onWheel: be,
        children: [
          g &&
            (0, jsxRuntime.jsx)(ar, {
              mood: E,
              accent: y,
              ears: !p,
              round: p,
              rain: T && a === `idle` && !te,
              tint: he,
            }),
          m.kind === `attach` &&
            (0, jsxRuntime.jsx)(tr, {
              id: m.id,
              mood: E,
              look: x,
              face: O(a) && (a !== `liveMedia` || A === `normal`),
            }),
          !p &&
            !g &&
            (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
              children: [
                (0, jsxRuntime.jsx)(`span`, { className: `notch-ear left` }),
                (0, jsxRuntime.jsx)(`span`, { className: `notch-ear right` }),
              ],
            }),
          (0, jsxRuntime.jsx)(`div`, {
            "data-liquid-clip": !0,
            className: `absolute inset-0 overflow-hidden`,
            style: { borderRadius: `inherit` },
            children: (0, jsxRuntime.jsx)(`div`, {
              "data-liquid-squash": !0,
              className: `absolute inset-0 origin-top`,
              children: (0, jsxRuntime.jsx)(Wt, {
                initial: !1,
                children:
                  _e &&
                  (0, jsxRuntime.jsx)(
                    Et.div,
                    {
                      className: `absolute top-0 left-1/2`,
                      style: { width: s, height: c, x: `-50%` },
                      variants: Uj,
                      initial: `initial`,
                      animate: `animate`,
                      exit: `exit`,
                      children: _e,
                    },
                    ge,
                  ),
              }),
            }),
          }),
        ],
      }),
    }),
  });
}
((document.documentElement.style.background = `transparent`),
  (document.body.style.background = `transparent`),
  (0, br.createRoot)(document.getElementById(`root`)).render(
    (0, jsxRuntime.jsx)(ReactRuntime.StrictMode, {
      children: (0, jsxRuntime.jsx)(ee, { children: (0, jsxRuntime.jsx)(IslandApp, {}) }),
    }),
  ));
