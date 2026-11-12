import { i as getJsxRuntime } from '../compat/shared.js'; const jsxRuntime=getJsxRuntime();
import { O as u } from '../compat/shared.js';
import { React as ReactRuntime } from '../react';
import { jC as jC } from '../vendor/editor.js';
import { H as o } from '../compat/shared.js';
import { n as E } from '../compat/shared.js';
import { r as hr } from '../compat/undo.js';
import { pt as Wt } from '../compat/home.js';
import { ft as Et } from '../compat/home.js';
import { XO as XO } from '../vendor/editor.js';
import { nt as Qn } from '../compat/island-store.js';
import { FC as FC } from '../vendor/editor.js';
import { KO as KO } from '../vendor/editor.js';
import { ZD as ZD } from '../vendor/editor.js';
import { XD as XD } from '../vendor/editor.js';
import { YO as YO } from '../vendor/editor.js';
import { RO as RO } from '../vendor/editor.js';
import { OC as OC } from '../vendor/editor.js';
const ja = {
    name: `bold`,
    size: 24,
    node: [
      [`path`, { d: `M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8`, key: `mg9rjx` }],
    ],
  };
const Ma = E(ja);
const bo = {
    name: `italic`,
    size: 24,
    node: [
      [`line`, { x1: `19`, x2: `10`, y1: `4`, y2: `4`, key: `15jd3p` }],
      [`line`, { x1: `14`, x2: `5`, y1: `20`, y2: `20`, key: `bu0au3` }],
      [`line`, { x1: `15`, x2: `9`, y1: `4`, y2: `20`, key: `uljnxc` }],
    ],
  };
const xo = E(bo);
const Eo = {
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
const Do = E(Eo);
const Oo = {
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
const ko = E(Oo);
const Ao = {
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
const jo = E(Ao);
const _s = {
    name: `strikethrough`,
    size: 24,
    node: [
      [`path`, { d: `M16 4H9a3 3 0 0 0-2.83 4`, key: `43sutm` }],
      [`path`, { d: `M14 12a4 4 0 0 1 0 8H6`, key: `nlfj13` }],
      [`line`, { x1: `4`, x2: `20`, y1: `12`, y2: `12`, key: `1e0a9i` }],
    ],
  };
const vs = E(_s);
const Mc = [`yellow`, `green`, `blue`, `pink`, `purple`];
const Nc = (e) => !!e && /[\p{L}\p{N}]/u.test(e);
const Pc = (e) => !e || /\s/.test(e);
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
const Uc = [`highlight`, `strike`, `bold`, `italic`];
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
function QO({ on: e, title: t, onPress: n, children: r, data: i }) {
  return (0, jsxRuntime.jsx)(`button`, {
    "data-note-tool": i,
    "data-on": String(e),
    title: t,
    onMouseDown: (e) => {
      (e.preventDefault(), u.takeFocus(), n());
    },
    className: `press grid size-6 place-items-center rounded-md transition-colors ${e ? `bg-white/14 text-ink` : `text-ink-3 hover:bg-tile hover:text-ink`}`,
    children: r,
  });
}
function $O({ editor: e }) {
  let [t, n] = (0, ReactRuntime.useState)(!1),
    r = jC({
      editor: e,
      selector: ({ editor: e }) => ({
        bold: e.isActive(`bold`),
        italic: e.isActive(`italic`),
        strike: e.isActive(`strike`),
        highlight: e.isActive(`highlight`),
        bullet: e.isActive(`bulletList`),
        ordered: e.isActive(`orderedList`),
        task: e.isActive(`taskList`),
      }),
    }),
    i = (t) => t(e.chain().focus()).run();
  return (0, jsxRuntime.jsxs)(`div`, {
    "data-note-toolbar": !0,
    className: `relative flex items-center gap-0.5`,
    children: [
      (0, jsxRuntime.jsx)(QO, {
        data: `bold`,
        on: r.bold,
        title: o(`Жирный · Ctrl+B`, `Bold · Ctrl+B`),
        onPress: () => i((e) => e.toggleBold()),
        children: (0, jsxRuntime.jsx)(Ma, { size: 13, strokeWidth: 2.5 }),
      }),
      (0, jsxRuntime.jsx)(QO, {
        data: `italic`,
        on: r.italic,
        title: o(`Курсив · Ctrl+I`, `Italic · Ctrl+I`),
        onPress: () => i((e) => e.toggleItalic()),
        children: (0, jsxRuntime.jsx)(xo, { size: 13 }),
      }),
      (0, jsxRuntime.jsx)(QO, {
        data: `strike`,
        on: r.strike,
        title: o(`Зачеркнуть · Ctrl+Shift+S`, `Strike through · Ctrl+Shift+S`),
        onPress: () => i((e) => e.toggleStrike()),
        children: (0, jsxRuntime.jsx)(vs, { size: 13 }),
      }),
      (0, jsxRuntime.jsx)(QO, {
        data: `highlight`,
        on: r.highlight || t,
        title: o(`Выделить цветом`, `Mark with a colour`),
        onPress: () => n((e) => !e),
        children: (0, jsxRuntime.jsx)(hr, { size: 13 }),
      }),
      (0, jsxRuntime.jsx)(`span`, { className: `mx-0.5 h-3.5 w-px bg-white/10` }),
      (0, jsxRuntime.jsx)(QO, {
        data: `bullet`,
        on: r.bullet,
        title: o(`Список · начни строку с «- »`, `List · start a line with “- ”`),
        onPress: () => i((e) => e.toggleBulletList()),
        children: (0, jsxRuntime.jsx)(jo, { size: 13 }),
      }),
      (0, jsxRuntime.jsx)(QO, {
        data: `ordered`,
        on: r.ordered,
        title: o(`Нумерованный список · начни строку с «1. »`, `Numbered list · start a line with “1. ”`),
        onPress: () => i((e) => e.toggleOrderedList()),
        children: (0, jsxRuntime.jsx)(ko, { size: 13 }),
      }),
      (0, jsxRuntime.jsx)(QO, {
        data: `task`,
        on: r.task,
        title: o(`Список задач · начни строку с «[ ] »`, `Task list · start a line with “[ ] ”`),
        onPress: () => i((e) => e.toggleTaskList()),
        children: (0, jsxRuntime.jsx)(Do, { size: 13 }),
      }),
      (0, jsxRuntime.jsx)(Wt, {
        children:
          t &&
          (0, jsxRuntime.jsxs)(Et.div, {
            "data-note-colours": !0,
            className: `absolute bottom-full left-[60px] z-10 mb-1.5 flex items-center gap-1 rounded-full bg-sheet px-1.5 py-1 shadow-lg ring-1 ring-white/10`,
            initial: { opacity: 0, y: 4, scale: 0.92 },
            animate: { opacity: 1, y: 0, scale: 1 },
            exit: { opacity: 0, y: 4, scale: 0.92 },
            transition: { duration: 0.14 },
            children: [
              Mc.map((e) =>
                (0, jsxRuntime.jsx)(
                  `button`,
                  {
                    "data-note-colour": e,
                    title: XO[e](),
                    onMouseDown: (t) => {
                      (t.preventDefault(), i((t) => t.setHighlight({ color: e })), n(!1));
                    },
                    className: `press size-5 rounded-full ring-1 ring-white/15 transition-transform hover:scale-110`,
                    style: { background: `var(--mark-${e})` },
                  },
                  e,
                ),
              ),
              (0, jsxRuntime.jsx)(`button`, {
                "data-note-colour": `none`,
                title: o(`Убрать выделение`, `Take the colour off`),
                onMouseDown: (e) => {
                  (e.preventDefault(), i((e) => e.unsetHighlight()), n(!1));
                },
                className: `press grid size-5 place-items-center rounded-full text-ink-3 hover:text-ink`,
                children: (0, jsxRuntime.jsx)(Qn, { size: 12 }),
              }),
            ],
          }),
      }),
    ],
  });
}
function ek({ text: e, onChange: t, placeholder: n, footer: r }) {
  let i = (0, ReactRuntime.useRef)(e),
    a = (0, ReactRuntime.useRef)(t);
  a.current = t;
  let o = FC({
    extensions: [
      KO.configure({
        blockquote: !1,
        code: !1,
        codeBlock: !1,
        heading: !1,
        horizontalRule: !1,
        hardBreak: !1,
        underline: !1,
        link: !1,
        trailingNode: !1,
      }),
      ZD,
      XD.configure({ nested: !0 }),
      YO.configure({ multicolor: !0 }),
      RO.configure({ placeholder: n }),
    ],
    content: Vc(e),
    editorProps: {
      attributes: {
        class: `note-editor scroll-thin h-full overflow-y-auto rounded-2xl bg-tile p-3.5 text-[13px] leading-relaxed text-ink outline-none focus:bg-tile-hover`,
        spellcheck: `true`,
        lang: `ru`,
        "data-note-editor": ``,
      },
    },
    onUpdate: ({ editor: e }) => {
      let t = Kc(e.getJSON());
      ((i.current = t), a.current(t));
    },
  });
  return (
    (0, ReactRuntime.useEffect)(() => {
      o && e !== i.current && ((i.current = e), o.commands.setContent(Vc(e), { emitUpdate: !1 }));
    }, [o, e]),
    (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
      children: [
        (0, jsxRuntime.jsx)(`div`, {
          className: `min-h-0 flex-1`,
          onMouseDown: () => void u.takeFocus(),
          children: (0, jsxRuntime.jsx)(OC, { editor: o, className: `h-full` }),
        }),
        (0, jsxRuntime.jsxs)(`div`, {
          className: `flex items-center justify-between gap-2 px-1`,
          children: [o ? (0, jsxRuntime.jsx)($O, { editor: o }) : (0, jsxRuntime.jsx)(`span`, {}), r(o)],
        }),
      ],
    })
  );
}
export { ek as NoteEditor };
