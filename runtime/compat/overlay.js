// Compatibility application source; migrate components incrementally.
import { G as e, H as t, O as n, U as r, i, k as a, q as o, r as s, t as c } from "./shared.js";
import { i as l, n as u, r as d, t as f } from "./undo.js";
import { n as p, t as m } from "./check.js";
import { a as h, i as g, n as _, o as v, r as y, t as b } from "./markup.js";
import { t as x } from "./close.js";
var S = r(),
  C = o(e(), 1),
  w = i(),
  T = 48;
function E({ on: e, title: t, onClick: n, children: r }) {
  return (0, w.jsx)(`button`, {
    title: t,
    onClick: n,
    className: `grid size-8 place-items-center rounded-lg ${e ? `bg-white/18 text-white` : `text-white/65 hover:bg-white/10 hover:text-white`}`,
    children: r,
  });
}
function D({ sel: e, frame: n, k: r, onDone: i, onReselect: a }) {
  let [o, s] = (0, C.useState)(`arrow`),
    [S, D] = (0, C.useState)(b[0]),
    [O, k] = (0, C.useState)(_[1]),
    [A, j] = (0, C.useState)([]),
    [M, N] = (0, C.useState)([]),
    [P, F] = (0, C.useState)(null),
    [I, L] = (0, C.useState)(null),
    [R, z] = (0, C.useState)(void 0),
    B = (0, C.useRef)(null);
  (0, C.useEffect)(() => {
    if (!n) return;
    let t = new Image();
    ((t.onload = () => z({ img: t, scale: t.naturalWidth / window.innerWidth, dx: e.x, dy: e.y })),
      (t.src = n));
  }, [n, e.x, e.y]);
  let V = (0, C.useMemo)(() => (P ? [...A, P] : A), [A, P]);
  (0, C.useEffect)(() => {
    let t = B.current;
    if (!t) return;
    let n = window.devicePixelRatio;
    ((t.width = Math.max(1, Math.round(e.w * n))), (t.height = Math.max(1, Math.round(e.h * n))));
    let r = t.getContext(`2d`);
    (r.clearRect(0, 0, t.width, t.height), y(r, V, n, n, R));
  }, [V, e.w, e.h, R]);
  let H = 14 + O * 3,
    U = (e = I) => {
      (e &&
        e.text.trim() &&
        (j((t) => [...t, { t: `text`, at: e.at, text: e.text, color: S, size: H }]), N([])),
        L(null));
    },
    W = () => {
      let t = I && I.text.trim() ? [...A, { t: `text`, at: I.at, text: I.text, color: S, size: H }] : A;
      if (!t.length) return i(null);
      let n = document.createElement(`canvas`);
      ((n.width = Math.max(1, Math.round(e.w * r))),
        (n.height = Math.max(1, Math.round(e.h * r))),
        y(n.getContext(`2d`), t, r, r, R),
        i(n.toDataURL(`image/png`)));
    },
    G = () => {
      A.length && (N((e) => [...e, A[A.length - 1]]), j((e) => e.slice(0, -1)));
    },
    K = () => {
      M.length && (j((e) => [...e, M[M.length - 1]]), N((e) => e.slice(0, -1)));
    };
  (0, C.useEffect)(() => {
    let e = (e) => {
      if (I) return;
      let t = e.ctrlKey || e.metaKey;
      if (e.key === `Enter` || (t && e.code === `KeyC`)) (e.preventDefault(), W());
      else if (t && e.code === `KeyZ`) (e.preventDefault(), e.shiftKey ? K() : G());
      else if (t && e.code === `KeyY`) (e.preventDefault(), K());
      else if (!t) {
        let t = { KeyA: `arrow`, KeyR: `rect`, KeyP: `pen`, KeyM: `marker`, KeyT: `text`, KeyB: `blur` };
        t[e.code] && s(t[e.code]);
      }
    };
    return (window.addEventListener(`keydown`, e), () => window.removeEventListener(`keydown`, e));
  });
  let q = (t) => ({ x: t.clientX - e.x, y: t.clientY - e.y }),
    J = (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      let t = q(e);
      if (o === `text`) {
        (e.preventDefault(), U(), L({ at: t, text: `` }));
        return;
      }
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      F(
        o === `pen` || o === `marker`
          ? { t: o, pts: [t], color: S, w: O }
          : o === `blur`
            ? { t: `blur`, a: t, b: t }
            : { t: o, a: t, b: t, color: S, w: O },
      );
    },
    Y = (e) => {
      if (!P) return;
      let t = q(e);
      P.t === `pen` || P.t === `marker`
        ? F({ ...P, pts: [...P.pts, t] })
        : P.t !== `text` && F({ ...P, b: t });
    },
    X = () => {
      P && (g(P) || (j((e) => [...e, P]), N([])), F(null));
    },
    Z = window.innerHeight - (e.y + e.h) > 60 ? e.y + e.h + 8 : e.y > 60 ? e.y - T - 8 : e.y + e.h - T - 8,
    Q = Math.min(Math.max(8, e.x + e.w - 560), window.innerWidth - 560 - 8);
  return (0, w.jsxs)(w.Fragment, {
    children: [
      (0, w.jsx)(`div`, {
        className: `fixed inset-0`,
        onMouseDown: (e) => {
          e.button !== 0 || A.length || P || I || (e.stopPropagation(), a({ x: e.clientX, y: e.clientY }));
        },
      }),
      (0, w.jsx)(`canvas`, {
        ref: B,
        "data-markup": !0,
        className: `fixed`,
        style: { left: e.x, top: e.y, width: e.w, height: e.h, cursor: o === `text` ? `text` : `crosshair` },
        onPointerDown: J,
        onPointerMove: Y,
        onPointerUp: X,
        onMouseDown: (e) => o === `text` && e.preventDefault(),
      }),
      I &&
        (0, w.jsx)(`textarea`, {
          autoFocus: !0,
          value: I.text,
          onChange: (e) => L({ ...I, text: e.target.value }),
          onMouseDown: (e) => e.stopPropagation(),
          onKeyDown: (e) => {
            (e.stopPropagation(),
              e.key === `Enter` && !e.shiftKey ? (e.preventDefault(), U()) : e.key === `Escape` && L(null));
          },
          onBlur: () => U(),
          placeholder: t(`Текст, Enter`, `Text, Enter`),
          className: `fixed min-w-[140px] resize-none rounded bg-black/50 px-1 font-semibold outline-1 outline-white/40 outline-dashed`,
          style: { left: e.x + I.at.x, top: e.y + I.at.y, color: S, fontSize: H, lineHeight: 1.25 },
          rows: Math.max(
            1,
            I.text.split(`
`).length,
          ),
        }),
      (0, w.jsxs)(`div`, {
        "data-markup-bar": !0,
        className: `fixed flex items-center gap-0.5 rounded-xl bg-[#141416]/95 px-1.5 text-white shadow-2xl ring-1 ring-white/10`,
        style: { left: Q, top: Z, height: T, width: 560 },
        onMouseDown: (e) => e.stopPropagation(),
        children: [
          (0, w.jsx)(E, {
            on: o === `arrow`,
            title: t(`Стрелка (A)`, `Arrow (A)`),
            onClick: () => s(`arrow`),
            children: (0, w.jsx)(l, { size: 17 }),
          }),
          (0, w.jsx)(E, {
            on: o === `rect`,
            title: t(`Рамка (R)`, `Box (R)`),
            onClick: () => s(`rect`),
            children: (0, w.jsx)(m, { size: 15 }),
          }),
          (0, w.jsx)(E, {
            on: o === `pen`,
            title: t(`Карандаш (P)`, `Pen (P)`),
            onClick: () => s(`pen`),
            children: (0, w.jsx)(u, { size: 15 }),
          }),
          (0, w.jsx)(E, {
            on: o === `marker`,
            title: t(`Выделитель (M)`, `Highlighter (M)`),
            onClick: () => s(`marker`),
            children: (0, w.jsx)(d, { size: 15 }),
          }),
          (0, w.jsx)(E, {
            on: o === `text`,
            title: t(`Текст (T)`, `Text (T)`),
            onClick: () => s(`text`),
            children: (0, w.jsx)(c, { size: 16 }),
          }),
          (0, w.jsx)(E, {
            on: o === `blur`,
            title: t(`Скрыть данные (B)`, `Hide data (B)`),
            onClick: () => s(`blur`),
            children: (0, w.jsx)(v, { size: 16 }),
          }),
          (0, w.jsx)(`span`, { className: `mx-1.5 h-6 w-px bg-white/12` }),
          b.map((e) =>
            (0, w.jsx)(
              `button`,
              {
                title: e,
                onClick: () => D(e),
                className: `mx-[3px] size-5 shrink-0 rounded-full ring-offset-2 ring-offset-[#141416] ${S === e ? `ring-2 ring-white` : `ring-1 ring-white/25`}`,
                style: { background: e },
              },
              e,
            ),
          ),
          (0, w.jsx)(`span`, { className: `mx-1.5 h-6 w-px bg-white/12` }),
          _.map((e) =>
            (0, w.jsx)(
              `button`,
              {
                title: t(`Толщина ${e}`, `Width ${e}`),
                onClick: () => k(e),
                className: `grid size-7 place-items-center rounded-lg ${O === e ? `bg-white/18` : `hover:bg-white/10`}`,
                children: (0, w.jsx)(`span`, {
                  className: `rounded-full bg-white`,
                  style: { width: e + 3, height: e + 3 },
                }),
              },
              e,
            ),
          ),
          (0, w.jsx)(`span`, { className: `mx-1.5 h-6 w-px bg-white/12` }),
          (0, w.jsx)(E, {
            title: t(`Отменить (Ctrl+Z)`, `Undo (Ctrl+Z)`),
            onClick: G,
            children: (0, w.jsx)(f, { size: 15 }),
          }),
          (0, w.jsx)(E, {
            title: t(`Повторить (Ctrl+Y)`, `Redo (Ctrl+Y)`),
            onClick: K,
            children: (0, w.jsx)(h, { size: 15 }),
          }),
          (0, w.jsx)(`div`, { className: `flex-1` }),
          (0, w.jsx)(`button`, {
            title: t(`Отмена (Esc)`, `Cancel (Esc)`),
            "data-markup-cancel": !0,
            onClick: () => window.dispatchEvent(new KeyboardEvent(`keydown`, { key: `Escape` })),
            className: `grid size-8 place-items-center rounded-lg text-white/65 hover:bg-white/10 hover:text-white`,
            children: (0, w.jsx)(x, { size: 16 }),
          }),
          (0, w.jsxs)(`button`, {
            "data-markup-done": !0,
            title: t(`Готово (Enter)`, `Done (Enter)`),
            onClick: W,
            className: `ml-1 flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-[13px] font-semibold text-black hover:bg-white/90`,
            children: [(0, w.jsx)(p, { size: 15 }), t(`Готово`, `Done`)],
          }),
        ],
      }),
    ],
  });
}
function O(e, t) {
  return { x: Math.min(e.x, t.x), y: Math.min(e.y, t.y), w: Math.abs(e.x - t.x), h: Math.abs(e.y - t.y) };
}
function k({ frame: e }) {
  return e
    ? (0, w.jsx)(`div`, {
        "data-backdrop": !0,
        className: `pointer-events-none fixed inset-0`,
        style: { backgroundImage: `url(${e})`, backgroundSize: `100% 100%` },
      })
    : null;
}
var A = (e) => e / window.innerWidth,
  j = (e) => e / window.innerHeight,
  M = () => ({
    area: t(`Скриншот области`, `Area screenshot`),
    screen: t(`Скриншот экрана`, `Screen screenshot`),
    ocr: t(`Текст с экрана`, `Screen text`),
    qr: t(`QR-код`, `QR code`),
    color: t(`Пипетка`, `Color picker`),
    record: t(`Запись экрана`, `Screen recording`),
  });
function N({ mode: e, text: t, below: n = 0, children: r }) {
  return (0, w.jsxs)(`div`, {
    "data-hint": !0,
    style: { top: `max(16px, calc(${(n * 100).toFixed(3)}vh + 10px))` },
    className: `fixed left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/85 px-4 py-2 text-[12.5px] whitespace-nowrap text-white shadow-2xl ${r ? `` : `pointer-events-none`}`,
    onMouseDown: (e) => e.stopPropagation(),
    onMouseUp: (e) => e.stopPropagation(),
    children: [
      (0, w.jsx)(`span`, { className: `font-semibold`, children: M()[e] }),
      r,
      (0, w.jsx)(`span`, { className: `text-white/55`, children: t }),
    ],
  });
}
var P = 5,
  F = 11;
function I({ frame: e, below: r }) {
  let [i, a] = (0, C.useState)(null),
    [o, s] = (0, C.useState)([]),
    c = (0, C.useRef)(null),
    l = (0, C.useRef)(!1),
    u = () => {
      let e = c.current;
      e &&
        !l.current &&
        ((c.current = null),
        (l.current = !0),
        n
          .colorPatch(A(e.x), j(e.y), P)
          .then(s)
          .finally(() => {
            ((l.current = !1), c.current && u());
          }));
    },
    d = o[60],
    f = d === void 0 ? `` : `#${d.toString(16).padStart(6, `0`).toUpperCase()}`,
    p = i ? (i.x + 24 + 121 > window.innerWidth ? i.x - 24 - 121 : i.x + 24) : 0,
    m = i ? (i.y + 24 + 121 + 30 > window.innerHeight ? i.y - 24 - 121 - 30 : i.y + 24) : 0;
  return (0, w.jsxs)(`div`, {
    className: `fixed inset-0 cursor-crosshair select-none`,
    onMouseMove: (e) => {
      (a({ x: e.clientX, y: e.clientY }), (c.current = { x: e.clientX, y: e.clientY }), u());
    },
    onMouseDown: (e) => {
      e.button === 0 && n.colorPick(A(e.clientX), j(e.clientY));
    },
    onContextMenu: (e) => {
      (e.preventDefault(), n.captureCancel());
    },
    children: [
      (0, w.jsx)(k, { frame: e }),
      (0, w.jsx)(N, {
        mode: `color`,
        below: r,
        text: t(`Клик — скопировать цвет · Esc — отмена`, `Click to copy the colour · Esc to cancel`),
      }),
      i &&
        o.length > 0 &&
        (0, w.jsxs)(`div`, {
          className: `pointer-events-none fixed`,
          style: { left: p, top: m },
          children: [
            (0, w.jsx)(`div`, {
              className: `grid overflow-hidden rounded-xl shadow-2xl ring-2 ring-white`,
              style: { gridTemplateColumns: `repeat(11, ${F}px)`, width: 121, height: 121 },
              children: o.map((e, t) =>
                (0, w.jsx)(
                  `span`,
                  {
                    style: {
                      background: `#${e.toString(16).padStart(6, `0`)}`,
                      outline: t === 60 ? `2px solid #fff` : void 0,
                      outlineOffset: -1,
                      boxShadow: t === 60 ? `0 0 0 3px rgb(0 0 0 / 0.6)` : void 0,
                      zIndex: t === 60 ? 1 : void 0,
                    },
                  },
                  t,
                ),
              ),
            }),
            (0, w.jsxs)(`div`, {
              className: `mt-1.5 flex items-center justify-center gap-1.5 rounded-lg bg-black/85 py-1 font-mono text-[12px] font-semibold text-white`,
              children: [
                (0, w.jsx)(`span`, {
                  className: `size-3 rounded-sm ring-1 ring-white/40`,
                  style: { background: f },
                }),
                f,
              ],
            }),
          ],
        }),
    ],
  });
}
function L() {
  let [e, r] = (0, C.useState)(`area`),
    [i, o] = (0, C.useState)(null),
    [s, c] = (0, C.useState)(0),
    [l, u] = (0, C.useState)(`mp4`),
    [d, f] = (0, C.useState)(null),
    [p, m] = (0, C.useState)(null),
    [h, g] = (0, C.useState)(0),
    [_, v] = (0, C.useState)(null),
    [y, b] = (0, C.useState)(!1),
    [x, S] = (0, C.useState)(null),
    T = (0, C.useRef)(!1);
  if (
    ((0, C.useEffect)(() => {
      let e = a(`overlay:start`, (e) => {
          let t = e.mode;
          (n.pickerSize().then((e) => v(e ? e[0] : null)),
            r(t),
            o(e.frame ?? null),
            c(Number.isFinite(e.below) ? e.below : 0),
            f(null),
            m(null),
            S(null),
            b(!1),
            g((e) => e + 1),
            (T.current = !1),
            t === `record` && n.settingsGet().then((e) => u(e.recordFormat)),
            t === `area` && n.settingsGet().then((e) => b(e.shotDraw === !0)));
        }),
        t = (e) => {
          e.key === `Escape` && n.captureCancel();
        };
      return (
        window.addEventListener(`keydown`, t),
        () => {
          (e.then((e) => e()), window.removeEventListener(`keydown`, t));
        }
      );
    }, []),
    e === `color`)
  )
    return (0, w.jsx)(I, { frame: i, below: s }, h);
  let E = (t) => {
      if (T.current) return;
      T.current = !0;
      let [r, i, a, o] = t.w < 4 || t.h < 4 ? [0, 0, 1, 1] : [A(t.x), j(t.y), A(t.w), j(t.h)];
      (f(null),
        m(null),
        S(null),
        e === `record` ? n.recordBegin(r, i, a, o, l) : n.captureRegion(r, i, a, o, e));
    },
    M = (e, t) => {
      if (!t) return E(e);
      T.current || ((T.current = !0), S(null), n.captureRegionDrawn(A(e.x), j(e.y), A(e.w), j(e.h), t));
    },
    P = x ?? (d && p ? O(d, p) : null),
    F = _ ? _ / window.innerWidth : window.devicePixelRatio;
  return (0, w.jsxs)(`div`, {
    className: `fixed inset-0 cursor-crosshair select-none`,
    onContextMenu: (e) => {
      (e.preventDefault(), n.captureCancel());
    },
    onMouseDown: (e) => {
      e.button !== 0 || x || (f({ x: e.clientX, y: e.clientY }), m({ x: e.clientX, y: e.clientY }));
    },
    onMouseMove: (e) => m({ x: e.clientX, y: e.clientY }),
    onMouseUp: (t) => {
      if (t.button !== 0 || !d) return;
      let n = O(d, { x: t.clientX, y: t.clientY });
      if (e === `area` && y && n.w >= 4 && n.h >= 4) {
        (f(null), m(null), S(n));
        return;
      }
      E(n);
    },
    children: [
      (0, w.jsx)(k, { frame: i }),
      !P &&
        (0, w.jsx)(`div`, {
          className: `pointer-events-none fixed inset-0`,
          style: { background: `rgb(0 0 0 / 0.32)` },
        }),
      !P &&
        p &&
        (0, w.jsxs)(w.Fragment, {
          children: [
            (0, w.jsx)(`div`, {
              className: `pointer-events-none fixed inset-x-0 h-px bg-white/35`,
              style: { top: p.y },
            }),
            (0, w.jsx)(`div`, {
              className: `pointer-events-none fixed inset-y-0 w-px bg-white/35`,
              style: { left: p.x },
            }),
          ],
        }),
      P &&
        (0, w.jsx)(`div`, {
          className: `pointer-events-none fixed rounded-[3px] outline-[1.5px] outline-white outline-solid`,
          style: {
            left: P.x,
            top: P.y,
            width: P.w,
            height: P.h,
            boxShadow: `0 0 0 100vmax rgb(0 0 0 / 0.42)`,
          },
          children: (0, w.jsxs)(`div`, {
            className: `tabular absolute -top-7 left-0 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-white`,
            children: [Math.round(P.w * F), ` × `, Math.round(P.h * F)],
          }),
        }),
      x &&
        (0, w.jsx)(
          D,
          {
            sel: x,
            frame: i,
            k: F,
            onDone: (e) => M(x, e),
            onReselect: (e) => {
              (S(null), f(e), m(e));
            },
          },
          `${x.x},${x.y},${x.w},${x.h}`,
        ),
      e === `record`
        ? (0, w.jsx)(N, {
            mode: e,
            below: s,
            text: t(
              `Выдели область · клик — весь экран · Esc — отмена`,
              `Select an area · click for the whole screen · Esc to cancel`,
            ),
            children: (0, w.jsx)(`span`, {
              className: `flex rounded-full bg-white/10 p-0.5`,
              children: [`mp4`, `gif`].map((e) =>
                (0, w.jsx)(
                  `button`,
                  {
                    onClick: () => u(e),
                    className: `rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${l === e ? `bg-white text-black` : `text-white/70 hover:text-white`}`,
                    children: e.toUpperCase(),
                  },
                  e,
                ),
              ),
            }),
          })
        : (0, w.jsx)(N, {
            mode: e,
            below: s,
            text:
              e === `qr`
                ? t(`Выдели QR-код целиком · Esc — отмена`, `Select the whole QR code · Esc to cancel`)
                : x
                  ? t(
                      `Рисуй на выделении · Enter — готово · Esc — отмена`,
                      `Draw on the selection · Enter when done · Esc to cancel`,
                    )
                  : t(
                      `Выдели область · клик — весь экран · Esc — отмена`,
                      `Select an area · click for the whole screen · Esc to cancel`,
                    ),
          }),
    ],
  });
}
((document.documentElement.style.background = `transparent`),
  (document.body.style.background = `transparent`),
  (0, S.createRoot)(document.getElementById(`root`)).render(
    (0, w.jsx)(C.StrictMode, { children: (0, w.jsx)(s, { children: (0, w.jsx)(L, {}) }) }),
  ));
