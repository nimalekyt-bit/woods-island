import { createSvg, roundedPath, drawEye, moodEyeShape, polar, createThinkingDots, drawThinkingDots, createSleepSymbol, drawSleepSymbol, createAttentionBadge, drawAttentionBadge } from './helpers';
import { defineDrawing } from './defineDrawing';
import type { DrawnCharacter, DrawingMood } from '../types';

interface FireState {
  smoke: SVGCircleElement[];
  sparks: SVGCircleElement[];
  f1: SVGPathElement;
  f2: SVGPathElement;
  f3: SVGPathElement;
  l: SVGPathElement;
  r: SVGPathElement;
  h: number;
  flame(width: number, height: number, timeMs: number, phase: number): string;
}
export const fireDrawing: DrawnCharacter = {
id: `fire`,
name: `Костёр`,
desc: `Маленький огонёк с глазами. Пляшет под музыку, вспыхивает от радости, думает колечками дыма, на ночь тлеет углями.`,
...defineDrawing<FireState>({
build(parent) {
        ((this.smoke = [0, 1, 2].map(() =>
          createSvg(`circle`, { fill: `none`, stroke: `#888780`, "stroke-width": 1.6 }, parent),
        )),
          (this.sparks = [0, 1, 2, 3, 4, 5].map(() => createSvg(`circle`, { r: 1.3, fill: `#FAC775` }, parent))),
          createSvg(`path`, { d: roundedPath(0, 30, 46, 7), fill: `#7A4E2D`, transform: `rotate(14,0,30)` }, parent),
          createSvg(`path`, { d: roundedPath(0, 30, 46, 7), fill: `#8E5C36`, transform: `rotate(-14,0,30)` }, parent),
          (this.f1 = createSvg(`path`, {}, parent)),
          (this.f2 = createSvg(`path`, { fill: `#FAC775` }, parent)),
          (this.f3 = createSvg(`path`, { fill: `#FFF4D6` }, parent)),
          (this.l = createSvg(`path`, {}, parent)),
          (this.r = createSvg(`path`, {}, parent)),
          (this.h = 1));
      },
flame(width, height, timeMs, phase) {
        let i = Math.sin(timeMs / 130 + phase) * width * 0.16,
          a = Math.sin(timeMs / 170 + phase + 1) * width * 0.2,
          o = Math.sin(timeMs / 110 + phase + 2) * width * 0.12;
        return `M${-width / 2},26 C${-width / 2},${26 - height * 0.45} ${-width * 0.2 + i},${26 - height * 0.7} ${a},${26 - height} C${width * 0.2 + o},${26 - height * 0.7} ${width / 2},${26 - height * 0.45} ${width / 2},26 Z`;
      },
draw(pose, timeMs, elapsedMs, dtSeconds) {
        let i = {
          idle: 1,
          music: 1 + 0.45 * Math.abs(Math.sin((timeMs / 545) * Math.PI)),
          think: 0.6,
          done: 1 + 0.6 * Math.exp(-elapsedMs / 700),
          attn: 1.35 + 0.1 * Math.sin(timeMs / 50),
          sleep: 0.22,
        }[pose.s];
        ((i = Math.min(1.7, i + pose.poke * 0.5)),
          (this.h += (i - this.h) * Math.min(1, dtSeconds * (pose.s === `music` ? 18 : 6))));
        let a = this.h;
        (this.f1.setAttribute(`d`, String(this.flame(30, 40 * a, timeMs, 0))),
          this.f2.setAttribute(`d`, String(this.flame(20, 28 * a, timeMs, 1.3))),
          this.f3.setAttribute(`d`, String(this.flame(10, 15 * a, timeMs, 2.1))),
          this.f1.setAttribute(`fill`, String(pose.s === `idle` ? `#D85A30` : pose.c)),
          (this.f3.style.display = pose.s === `sleep` ? `none` : ``),
          this.f2.setAttribute(`opacity`, String(pose.s === `sleep` ? (0.5 + 0.4 * Math.sin(timeMs / 600)).toFixed(2) : 1)));
        let o = 26 - 40 * a * 0.42,
          s = moodEyeShape(pose.s);
        [this.l, this.r].forEach((t, n) => {
          ((t.style.display = a < 0.4 ? `none` : ``),
            drawEye(t, (n ? 5 : -5) + pose.lx * 0.6, o + pose.ly * 0.4, s, pose.blink, `#4A1B0C`, 3, 4.4));
        });
        let c = pose.s === `music` || pose.s === `done`;
        (this.sparks.forEach((n, r) => {
          let i = (timeMs / (c ? 700 : 1600) + r / 6) % 1;
          ((n.style.display = pose.s === `sleep` || pose.s === `think` ? `none` : ``),
            n.setAttribute(`cx`, String((Math.sin(r * 2.1 + i * 3) * 10).toFixed(1))),
            n.setAttribute(`cy`, String((20 - i * (c ? 60 : 40) * a).toFixed(1))),
            n.setAttribute(`opacity`, String((1 - i).toFixed(2))));
        }),
          this.smoke.forEach((n, r) => {
            let i = (timeMs / 1500 + r / 3) % 1;
            ((n.style.display = pose.s === `think` ? `` : `none`),
              n.setAttribute(`cx`, String((Math.sin(i * 4 + r) * 4).toFixed(1))),
              n.setAttribute(`cy`, String((4 - i * 40).toFixed(1))),
              n.setAttribute(`r`, String((2 + i * 5).toFixed(1))),
              n.setAttribute(`opacity`, String((1 - i).toFixed(2))));
          }));
      }
})
};

interface LavaState {
  bl: SVGGElement;
  blobs: SVGCircleElement[];
  pool: SVGEllipseElement;
  ph: number[];
  y: number[];
  x: number[];
  r: number[];
  t: number;

}
export const lavaDrawing: DrawnCharacter = {
id: `lava`,
name: `Лава-лампа`,
desc: `Капли лавы всплывают и сливаются в стекле. Без лица, но гипнотизирует. Цвет лавы по настроению.`,
...defineDrawing<LavaState>({
build(parent, seed) {
        let n = createSvg(`clipPath`, { id: `lava-glass` + seed }, createSvg(`defs`, {}, parent)),
          r = `M-11,-30 L11,-30 L18,18 L-18,18 Z`;
        (createSvg(`path`, { d: r }, n),
          createSvg(`path`, { d: r, fill: `#1d1b1a`, stroke: `#5F5E5A`, "stroke-width": 1.2 }, parent),
          (this.bl = createSvg(`g`, { "clip-path": `url(#lava-glass${seed})` }, parent)),
          (this.blobs = [0, 1, 2, 3, 4].map(() => createSvg(`circle`, {}, this.bl))),
          (this.pool = createSvg(`ellipse`, { cx: 0, cy: 18, rx: 20, ry: 6 }, this.bl)),
          createSvg(`path`, { d: `M-9,-40 L9,-40 L11,-30 L-11,-30 Z`, fill: `#888780` }, parent),
          createSvg(`path`, { d: `M-18,18 L18,18 L22,38 L-22,38 Z`, fill: `#888780` }, parent),
          createSvg(`path`, { d: roundedPath(0, 38, 46, 4), fill: `#5F5E5A` }, parent),
          (this.ph = [0, 1.7, 3.1, 4.4, 5.6]),
          (this.y = [0, 0, 0, 0, 0]),
          (this.x = [0, 0, 0, 0, 0]),
          (this.r = [0, 0, 0, 0, 0]));
      },
draw(pose, timeMs, elapsedMs, dtSeconds) {
        let i = pose.s === `idle` ? `#D85A30` : pose.c,
          a = { idle: 1, music: 2.6, think: 1.4, done: 1, attn: 0, sleep: 0.25 }[pose.s];
        ((this.t = (this.t || 0) + dtSeconds * a),
          this.blobs.forEach((a, o) => {
            let s = -6 + Math.sin(this.t * 0.9 + this.ph[o]) * 18,
              c = Math.sin(this.t * 0.6 + this.ph[o] * 2) * 5,
              l = 4 + (o % 3) * 1.6;
            if (pose.s === `think`) {
              let e = (this.t * 0.35 + o / 5) % 1;
              ((s = 14 - e * 42), (c = Math.sin(e * 6 + o) * 3), (l = 3 + (o % 2)));
            }
            if (pose.s === `done`) {
              let e = Math.min(1, elapsedMs / 700) * (elapsedMs < 2200 ? 1 : Math.max(0, 1 - (elapsedMs - 2200) / 700));
              ((s = s * (1 - e) + -6 * e), (c *= 1 - e), (l = l * (1 - e) + 8 * e));
            }
            (pose.s === `music` && (s += Math.sin((timeMs / 545) * Math.PI) * 4),
              pose.s === `sleep` && ((s = 12), (l = 3 + (o % 3))),
              (s -= pose.poke * 10));
            let u = Math.min(1, dtSeconds * (pose.s === `attn` ? 0 : 4));
            ((this.y[o] += (s - this.y[o]) * u),
              (this.x[o] += (c - this.x[o]) * u),
              (this.r[o] += (l - this.r[o]) * Math.min(1, dtSeconds * 4)),
              a.setAttribute(`cx`, String(this.x[o].toFixed(1))),
              a.setAttribute(`cy`, String(this.y[o].toFixed(1))),
              a.setAttribute(`r`, String(Math.max(0.5, this.r[o]).toFixed(1))),
              a.setAttribute(`fill`, String(i)));
          }),
          this.pool.setAttribute(`fill`, String(i)),
          this.bl.setAttribute(
            `opacity`,
            String(pose.s === `sleep`
              ? 0.55
              : pose.s === `attn`
                ? (0.6 + 0.4 * Math.abs(Math.sin(timeMs / 150))).toFixed(2)
                : 1),
          ));
      }
})
};

interface IrisState {
  iw: SVGGElement;
  pu: SVGCircleElement;
  hl: SVGCircleElement;
  blades: SVGPathElement[];
  a: number;
  spin: number;
  nextBlink: number;
  b: SVGGElement;

}
export const irisDrawing: DrawnCharacter = {
id: `iris`,
name: `Объектив`,
desc: `Живой глаз-объектив: шторки диафрагмы сужаются и раскрываются, моргают, крутятся, пока ИИ думает.`,
...defineDrawing<IrisState>({
build(parent, seed) {
        (createSvg(`circle`, { r: 31, fill: `#2C2C2A` }, parent),
          createSvg(`circle`, { r: 28, fill: `none`, stroke: `#5F5E5A`, "stroke-width": 2 }, parent),
          createSvg(`circle`, { r: 23 }, createSvg(`clipPath`, { id: `iris-c` + seed }, createSvg(`defs`, {}, parent))),
          createSvg(`circle`, { r: 23, fill: `#0b0b0b` }, parent),
          (this.iw = createSvg(`g`, { "clip-path": `url(#iris-c${seed})` }, parent)),
          (this.pu = createSvg(`circle`, {}, this.iw)),
          (this.hl = createSvg(`circle`, { r: 2.2, fill: `#FFFFFF`, opacity: 0.7 }, this.iw)),
          (this.blades = [0, 1, 2, 3, 4, 5].map(() =>
            createSvg(`path`, { fill: `#3a3a38`, stroke: `#1b1b1a`, "stroke-width": 0.8 }, this.iw),
          )),
          createSvg(`circle`, { cx: -9, cy: -12, r: 3, fill: `#FFFFFF`, opacity: 0.12 }, parent),
          (this.a = 12),
          (this.spin = 0),
          (this.nextBlink = performance.now() + 3e3),
          (this.b = createAttentionBadge(parent)));
      },
draw(pose, timeMs, elapsedMs, dtSeconds) {
        let i = {
          idle: 12 + 2 * Math.sin(timeMs / 1200),
          music: 8 + 8 * Math.abs(Math.sin((timeMs / 545) * Math.PI)),
          think: 9,
          done: elapsedMs < 500 ? 18 : elapsedMs < 650 ? 2 : elapsedMs < 900 ? 18 : 15,
          attn: 4.5,
          sleep: 0.5,
        }[pose.s];
        if (pose.s !== `sleep` && pose.s !== `think` && timeMs > this.nextBlink) {
          let e = timeMs - this.nextBlink;
          e < 220
            ? (i = Math.max(0.5, i * Math.abs(1 - e / 110)))
            : (this.nextBlink = timeMs + 2800 + Math.random() * 3500);
        }
        ((i += pose.poke * -10), (this.a += (i - this.a) * Math.min(1, dtSeconds * (pose.s === `music` ? 20 : 9))));
        let a = Math.max(0.5, this.a);
        this.spin += dtSeconds * (pose.s === `think` ? 260 : 6);
        let o = pose.lx * 1.6,
          s = pose.ly * 1.6;
        (this.iw.setAttribute(`transform`, String(`translate(${o.toFixed(1)},${s.toFixed(1)})`)),
          this.blades.forEach((e, t) => {
            let n = t * 60 + this.spin,
              r = polar(a, n),
              i = polar(a, n + 60),
              o = polar(40, n + 75),
              s = polar(40, n - 15);
            e.setAttribute(
              `d`,
              String(`M${r[0].toFixed(1)},${r[1].toFixed(1)} L${i[0].toFixed(1)},${i[1].toFixed(1)} L${o[0].toFixed(1)},${o[1].toFixed(1)} L${s[0].toFixed(1)},${s[1].toFixed(1)}Z`),
            );
          }),
          this.pu.setAttribute(`r`, String(Math.max(0.5, a * 0.7).toFixed(1))),
          this.pu.setAttribute(`fill`, String(pose.s === `idle` ? `#5DCAA5` : pose.c)),
          this.hl.setAttribute(`cx`, String((-a * 0.25).toFixed(1))),
          this.hl.setAttribute(`cy`, String((-a * 0.3).toFixed(1))),
          (this.hl.style.display = a > 4 ? `` : `none`),
          drawAttentionBadge(this.b, pose.s === `attn`, 28, -26));
      }
})
};

interface CoffeeState {
  st: SVGPathElement[];
  heart: SVGPathElement;
  mug: SVGGElement;
  band: SVGRectElement;
  l: SVGPathElement;
  r: SVGPathElement;
  mo: SVGPathElement;
  z: SVGTextElement;
  b: SVGGElement;

}
export const coffeeDrawing: DrawnCharacter = {
id: `coffee`,
name: `Кофе`,
desc: `Кружка с характером. Пар танцует под музыку, складывается в сердечко от радости, кипит от тревоги, остывает во сне.`,
...defineDrawing<CoffeeState>({
build(parent) {
        ((this.st = [0, 1, 2].map(() =>
          createSvg(`path`, { fill: `none`, stroke: `#B4B2A9`, "stroke-width": 2.4, "stroke-linecap": `round` }, parent),
        )),
          (this.heart = createSvg(
            `path`,
            {
              d: `M0,6 C-9,0 -9,-8 -3.5,-8 C-1.5,-8 0,-6.5 0,-5 C0,-6.5 1.5,-8 3.5,-8 C9,-8 9,0 0,6Z`,
              fill: `#ED93B1`,
            },
            parent,
          )),
          (this.mug = createSvg(`g`, {}, parent)));
        let t = this.mug;
        (createSvg(`path`, { d: `M16,4 a8,8 0 1,1 0,14`, fill: `none`, stroke: `#F1EFE8`, "stroke-width": 4.5 }, t),
          createSvg(`path`, { d: `M-16,-2 L16,-2 L14,24 Q14,28 10,28 L-10,28 Q-14,28 -14,24 Z`, fill: `#F1EFE8` }, t),
          createSvg(`ellipse`, { cx: 0, cy: -2, rx: 16, ry: 3.6, fill: `#5B3F2E` }, t),
          (this.band = createSvg(`rect`, { x: -15, y: 17, width: 30, height: 4 }, t)),
          (this.l = createSvg(`path`, {}, t)),
          (this.r = createSvg(`path`, {}, t)),
          (this.mo = createSvg(
            `path`,
            { fill: `none`, stroke: `#5B3F2E`, "stroke-width": 1.5, "stroke-linecap": `round` },
            t,
          )),
          (this.z = createSleepSymbol(parent)),
          (this.b = createAttentionBadge(parent)));
      },
draw(pose, timeMs, elapsedMs) {
        let r = 0,
          i = 0;
        (pose.s === `music` &&
          ((r = -Math.abs(Math.sin((timeMs / 545) * Math.PI)) * 4), (i = Math.sin((timeMs / 545) * Math.PI) * 5)),
          pose.s === `attn` && (i = Math.sin(timeMs / 35) * 2.5),
          (r -= pose.poke * 8),
          this.mug.setAttribute(`transform`, String(`translate(0,${r.toFixed(1)}) rotate(${i.toFixed(1)},0,26)`)),
          this.band.setAttribute(`fill`, String(pose.s === `idle` ? `#D85A30` : pose.c)));
        let a = moodEyeShape(pose.s);
        (drawEye(this.l, -6 + pose.lx * 0.6, 7 + pose.ly * 0.4, a, pose.blink, `#5B3F2E`, 3, 4.2),
          drawEye(this.r, 6 + pose.lx * 0.6, 7 + pose.ly * 0.4, a, pose.blink, `#5B3F2E`, 3, 4.2),
          this.mo.setAttribute(
            `d`,
            String(pose.s === `attn`
              ? `M-2,13 a2,2 0 1,0 4,0 a2,2 0 1,0 -4,0`
              : pose.s === `sleep`
                ? `M-3,13 H3`
                : `M-3.5,12 Q0,15 3.5,12`),
          ));
        let o = pose.s !== `sleep` && !(pose.s === `done` && elapsedMs < 2600);
        this.st.forEach((n, i) => {
          n.style.display = o ? `` : `none`;
          let a = -7 + i * 7,
            s = pose.s === `music` || pose.s === `attn`,
            c = pose.s === `attn` ? 46 : pose.s === `think` ? 20 : 34,
            l = `M${a},${-6 + r}`;
          for (let n = 1; n <= 6; n++) {
            let o = -6 + r - (n * c) / 6,
              u = pose.s === `attn` ? 0.8 : 2.6,
              d = a + Math.sin(n * 0.9 + timeMs / (s ? 120 : 420) + i * 1.7) * u * (n / 6 + 0.3);
            l += ` L${d.toFixed(1)},${o.toFixed(1)}`;
          }
          (n.setAttribute(`d`, String(l)),
            n.setAttribute(`opacity`, String((0.35 + 0.25 * Math.sin(timeMs / 500 + i)).toFixed(2))));
        });
        let s = pose.s === `done` ? Math.min(1, elapsedMs / 400) * +(elapsedMs < 2600) : 0;
        ((this.heart.style.display = s > 0 ? `` : `none`),
          this.heart.setAttribute(
            `transform`,
            String(`translate(0,${(-26 - Math.min(1, elapsedMs / 2600) * 8).toFixed(1)}) scale(${(s * 1.6).toFixed(2)})`),
          ),
          drawSleepSymbol(this.z, pose.s === `sleep`, 18, -8, timeMs),
          drawAttentionBadge(this.b, pose.s === `attn`, 24, -30));
      }
})
};

interface CradleState {
  s: SVGPathElement[];
  b: SVGCircleElement[];
  h: SVGGElement[];
  l: SVGPathElement;
  r: SVGPathElement;

}
export const cradleDrawing: DrawnCharacter = {
id: `cradle`,
name: `Маятник Ньютона`,
desc: `Офисная игрушка вместо персонажа. Шарики щёлкают в такт музыке, бегут волной, пока ИИ думает. Средний шарик всё видит.`,
...defineDrawing<CradleState>({
build(parent) {
        (createSvg(`path`, { d: `M-38,-34 H38`, stroke: `#888780`, "stroke-width": 3, "stroke-linecap": `round` }, parent),
          createSvg(`path`, { d: `M-38,-34 V30 M38,-34 V30`, stroke: `#5F5E5A`, "stroke-width": 2 }, parent),
          createSvg(`path`, { d: `M-44,31 H44`, stroke: `#888780`, "stroke-width": 3, "stroke-linecap": `round` }, parent),
          (this.s = []),
          (this.b = []),
          (this.h = []));
        for (let t = 0; t < 5; t++) {
          this.s.push(createSvg(`path`, { stroke: `#888780`, "stroke-width": 1 }, parent));
          let t = createSvg(`g`, {}, parent);
          (this.b.push(createSvg(`circle`, { r: 6.4 }, t)),
            createSvg(`circle`, { cx: -2, cy: -2.2, r: 1.6, fill: `#FFFFFF`, opacity: 0.7 }, t),
            this.h.push(t));
        }
        ((this.l = createSvg(`path`, {}, parent)), (this.r = createSvg(`path`, {}, parent)));
      },
draw(pose, timeMs, elapsedMs) {
        let r = [0, 0, 0, 0, 0],
          i = (e: number, n: number) => {
            let i = Math.sin((timeMs / n) * Math.PI * 2);
            ((r[0] = -e * Math.max(0, -i)), (r[4] = e * Math.max(0, i)));
          };
        (pose.s === `idle` && i(16, 1700),
          pose.s === `music` && i(28, 1090),
          pose.s === `done` && i(38 * (elapsedMs < 3e3 ? 1 : 0.6), 800),
          pose.s === `think` && (r = r.map((e, n) => 9 * Math.sin(timeMs / 260 - n * 0.75))),
          pose.s === `attn` && (r[0] = -38 + Math.sin(timeMs / 40) * 2),
          (r[0] -= pose.poke * 25));
        for (let t = 0; t < 5; t++) {
          let n = -24 + t * 12,
            i = (r[t] * Math.PI) / 180,
            a = n + Math.sin(i) * 40,
            o = -34 + Math.cos(i) * 40;
          (this.s[t].setAttribute(`d`, String(`M${n},-34 L${a.toFixed(1)},${o.toFixed(1)}`)),
            this.h[t].setAttribute(`transform`, String(`translate(${a.toFixed(1)},${o.toFixed(1)})`)),
            this.b[t].setAttribute(`fill`, String(pose.s === `idle` ? `#D3D1C7` : pose.c)),
            this.b[t].setAttribute(`opacity`, String(pose.s === `sleep` ? 0.55 : 1)));
        }
        let a = Math.abs(r[0]) > Math.abs(r[4]) ? -1 : 1,
          o = pose.s === `think` ? 0 : a * 1.5,
          s = moodEyeShape(pose.s);
        (drawEye(this.l, -2.2 + o, 6.5, s, pose.blink, `#1b1b1a`, 1.8, 2.6),
          drawEye(this.r, 2.2 + o, 6.5, s, pose.blink, `#1b1b1a`, 1.8, 2.6));
      }
})
};

interface PulseState {
  grid: SVGPathElement;
  line: SVGPathElement;
  dot: SVGCircleElement;
  heart: SVGPathElement;
  pk: number;
  pkT: number;
  ecg(phase: number): number;
  val(mood: DrawingMood, timeMs: number): number;
}
export const pulseDrawing: DrawnCharacter = {
id: `pulse`,
name: `Пульс`,
desc: `Кардиомонитор острова. Сердце бьётся в такт музыке, учащается от тревоги, во сне линия почти ровная, пока ИИ думает, бегут мозговые волны.`,
pillScale: 0.34,
...defineDrawing<PulseState>({
build(parent) {
        ((this.grid = createSvg(
          `path`,
          { d: `M-84,-20 H62 M-84,0 H62 M-84,20 H62`, stroke: `#1f3a32`, "stroke-width": 0.6 },
          parent,
        )),
          (this.line = createSvg(
            `path`,
            { fill: `none`, "stroke-width": 2.2, "stroke-linejoin": `round`, "stroke-linecap": `round` },
            parent,
          )),
          (this.dot = createSvg(`circle`, { r: 2.6 }, parent)),
          (this.heart = createSvg(
            `path`,
            { d: `M0,6 C-9,0 -9,-8 -3.5,-8 C-1.5,-8 0,-6.5 0,-5 C0,-6.5 1.5,-8 3.5,-8 C9,-8 9,0 0,6Z` },
            parent,
          )),
          (this.pk = -1e9));
      },
ecg(phase) {
        return phase < 0.1
          ? 0
          : phase < 0.18
            ? 0.12 * Math.sin(((phase - 0.1) / 0.08) * Math.PI)
            : phase < 0.22
              ? 0
              : phase < 0.24
                ? -0.18
                : phase < 0.27
                  ? 1
                  : phase < 0.3
                    ? -0.35
                    : phase < 0.4
                      ? 0
                      : phase < 0.55
                        ? 0.22 * Math.sin(((phase - 0.4) / 0.15) * Math.PI)
                        : 0;
      },
val(mood, timeMs) {
        if (mood === `think`)
          return 0.22 * Math.sin(timeMs / 80) + 0.14 * Math.sin(timeMs / 33 + 1) + 0.08 * Math.sin(timeMs / 13);
        let n = { idle: 857, music: 545, done: 600, attn: 380, sleep: 1500 }[mood],
          r = mood === `sleep` ? 0.35 : mood === `attn` ? 1.1 : 1;
        return this.ecg((timeMs % n) / n) * r;
      },
draw(pose, timeMs) {
        let n = pose.s === `idle` ? `#5DCAA5` : pose.c,
          r = ``;
        for (let n = -84; n <= 62; n += 2) {
          let i = timeMs - (62 - n) * 3.2,
            a = this.val(pose.s, i),
            o = i - this.pkT;
          (this.pkT && o > 0 && o < 200 && (a += 1.4 * Math.sin((o / 200) * Math.PI)),
            (r += (n === -84 ? `M` : ` L`) + n + `,` + (-a * 18).toFixed(1)));
        }
        (pose.poke > 0.95 && (this.pkT = timeMs),
          this.line.setAttribute(`d`, String(r)),
          this.line.setAttribute(`stroke`, String(n)));
        let i = -this.val(pose.s, timeMs) * 18;
        (this.dot.setAttribute(`cx`, String(62)),
          this.dot.setAttribute(`cy`, String(i.toFixed(1))),
          this.dot.setAttribute(`fill`, String(n)));
        let a = { idle: 857, music: 545, done: 600, attn: 380, sleep: 1500, think: 1200 }[pose.s],
          o = (timeMs % a) / a,
          s = o > 0.24 && o < 0.45 ? Math.sin(((o - 0.24) / 0.21) * Math.PI) : 0;
        (this.heart.setAttribute(`fill`, String(n)),
          this.heart.setAttribute(
            `transform`,
            String(`translate(76,0) scale(${(1.35 + s * 0.35 * (pose.s === `sleep` ? 0.3 : 1) + (pose.s === `done` ? 0.3 : 0)).toFixed(2)})`),
          ),
          this.heart.setAttribute(`opacity`, String(pose.s === `think` ? 0.45 : 1)));
      }
})
};

export const things = [fireDrawing, lavaDrawing, irisDrawing, coffeeDrawing, cradleDrawing, pulseDrawing];
