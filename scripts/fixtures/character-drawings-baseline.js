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
