import { createSvg, roundedPath, drawEye, moodEyeShape, polar, createThinkingDots, drawThinkingDots, createSleepSymbol, drawSleepSymbol, createAttentionBadge, drawAttentionBadge } from './helpers';
import { defineDrawing } from './defineDrawing';
import type { DrawnCharacter, DrawingMood } from '../types';
interface StickPose { tor:number; la1:number; la2:number; ra1:number; ra2:number; ll1:number; ll2:number; rl1:number; rl2:number; hy:number; hx:number; tilt:number }
interface TailPose { sw:number; cu:number; dr:number; wi:number }
interface LegsPose { a1:number; b1:number; a2:number; b2:number; jump:number }
const STICK_KEYS: (keyof StickPose)[] = ["tor", "la1", "la2", "ra1", "ra2", "ll1", "ll2", "rl1", "rl2", "hy", "hx", "tilt"];
const TAIL_KEYS: (keyof TailPose)[] = ["sw", "cu", "dr", "wi"];
const LEGS_KEYS: (keyof LegsPose)[] = ["a1", "b1", "a2", "b2", "jump"];

interface HamsterState {
  sp: SVGGElement;
  rim: SVGCircleElement;
  h: SVGGElement;
  f1: SVGEllipseElement;
  f2: SVGEllipseElement;
  e: SVGPathElement;
  ang: number;
  z: SVGTextElement;
  d: SVGCircleElement[];
  b: SVGGElement;

}
export const hamsterDrawing: DrawnCharacter = {
id: `hamster`,
name: `Хомяк в колесе`,
desc: `Бежит в колесе: чем больше дел, тем быстрее. Под музыку несётся, когда тебя нет, спит прямо в колесе.`,
...defineDrawing<HamsterState>({
build(parent) {
        (createSvg(
          `path`,
          {
            d: `M-15,40 L0,0 L15,40`,
            fill: `none`,
            stroke: `#5F5E5A`,
            "stroke-width": 3,
            "stroke-linecap": `round`,
          },
          parent,
        ),
          (this.sp = createSvg(`g`, {}, parent)));
        for (let e = 0; e < 8; e++) {
          let [t, n] = polar(30, e * 45);
          createSvg(
            `path`,
            { d: `M0,0 L${t.toFixed(1)},${n.toFixed(1)}`, stroke: `#444441`, "stroke-width": 1.2 },
            this.sp,
          );
        }
        ((this.rim = createSvg(`circle`, { r: 30, fill: `none`, "stroke-width": 3 }, parent)),
          createSvg(`circle`, { r: 3, fill: `#888780` }, parent),
          (this.h = createSvg(`g`, {}, parent)));
        let t = this.h;
        ((this.f1 = createSvg(`ellipse`, { rx: 2.6, ry: 1.8, fill: `#F4C0D1` }, t)),
          (this.f2 = createSvg(`ellipse`, { rx: 2.6, ry: 1.8, fill: `#F4C0D1` }, t)),
          createSvg(`ellipse`, { cx: 0, cy: 0, rx: 13, ry: 10, fill: `#E8B47A` }, t),
          createSvg(`ellipse`, { cx: 2, cy: 3.5, rx: 8, ry: 5.5, fill: `#F7E7D0` }, t),
          createSvg(`circle`, { cx: 7, cy: -8.5, r: 3.4, fill: `#E8B47A` }, t),
          createSvg(`circle`, { cx: 7, cy: -8.5, r: 1.9, fill: `#F4C0D1` }, t),
          (this.e = createSvg(`path`, {}, t)),
          createSvg(`circle`, { cx: 13.2, cy: 0, r: 1.5, fill: `#ED93B1` }, t),
          (this.ang = 0),
          (this.z = createSleepSymbol(parent)),
          (this.d = createThinkingDots(parent)),
          (this.b = createAttentionBadge(parent)));
      },
draw(pose, timeMs, elapsedMs, dtSeconds) {
        let i = {
          idle: 0.9,
          music: 5.5,
          think: 2,
          done: elapsedMs < 600 ? 0 : Math.max(0, 7 * Math.exp(-(elapsedMs - 600) / 900)),
          attn: 0,
          sleep: 0,
        }[pose.s];
        ((this.ang -= i * dtSeconds * 57.3),
          this.sp.setAttribute(`transform`, String(`rotate(${this.ang.toFixed(1)})`)),
          this.rim.setAttribute(`stroke`, String(pose.s === `idle` ? `#B4B2A9` : pose.c)));
        let a = pose.s === `idle` || pose.s === `music` || pose.s === `think`,
          o = (this.ang / 57.3) * (pose.s === `music` ? 2.4 : 3),
          s = 17 - (a ? Math.abs(Math.sin(o)) * 2 : 0),
          c = 1,
          l = 0;
        (pose.s === `done` && elapsedMs < 1400 && (s -= Math.abs(Math.sin(elapsedMs / 230)) * 14 * Math.exp(-elapsedMs / 700)),
          pose.s === `attn` && ((s = 14), (l = -18)),
          pose.s === `sleep` && ((s = 19), (c = 0.82)),
          (s -= pose.poke * 10),
          this.h.setAttribute(`transform`, String(`translate(0,${s.toFixed(1)}) rotate(${l}) scale(1,${c})`)));
        let u = a ? Math.sin(o * 2) * 4 : 0;
        (this.f1.setAttribute(`cx`, String((-6 + u).toFixed(1))),
          this.f1.setAttribute(`cy`, String(9)),
          this.f2.setAttribute(`cx`, String((6 - u).toFixed(1))),
          this.f2.setAttribute(`cy`, String(9)),
          (this.f1.style.display = this.f2.style.display = pose.s === `sleep` ? `none` : ``),
          drawEye(this.e, 8 + pose.lx * 0.3, -2 + pose.ly * 0.3, moodEyeShape(pose.s), pose.blink, `#1b1b1a`, 2.6, 3.4),
          drawSleepSymbol(this.z, pose.s === `sleep`, 18, -14, timeMs),
          drawThinkingDots(this.d, pose.s === `think`, -7, -40, timeMs),
          drawAttentionBadge(this.b, pose.s === `attn`, 22, -24));
      }
})
};

interface StickState {
  body: SVGPathElement;
  head: SVGCircleElement;
  e1: SVGCircleElement;
  e2: SVGCircleElement;
  q: StickPose;
  d: SVGCircleElement[];
  z: SVGTextElement;
  b: SVGGElement;

}
export const stickDrawing: DrawnCharacter = {
id: `stick`,
name: `Человечек`,
desc: `Нарисован одной линией и показывает всё телом: танцует, чешет подбородок, машет руками, дремлет сидя.`,
...defineDrawing<StickState>({
build(parent) {
        let t = { fill: `none`, "stroke-width": 3, "stroke-linecap": `round`, "stroke-linejoin": `round` };
        ((this.body = createSvg(`path`, t, parent)),
          (this.head = createSvg(`circle`, { r: 6.5, fill: `#000`, "stroke-width": 3 }, parent)),
          (this.e1 = createSvg(`circle`, { r: 1.3 }, parent)),
          (this.e2 = createSvg(`circle`, { r: 1.3 }, parent)),
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
          (this.d = createThinkingDots(parent)),
          (this.z = createSleepSymbol(parent)),
          (this.b = createAttentionBadge(parent)));
      },
draw(pose, timeMs, elapsedMs, dtSeconds) {
        let i = Math.sin((timeMs / 545) * Math.PI),
          a = {
            tor: Math.sin(timeMs / 1500) * 1.5,
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
            tilt: Math.sin(timeMs / 2300) * 6,
          };
        if (
          (pose.s === `music` &&
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
          pose.s === `think` &&
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
          pose.s === `done`)
        ) {
          let e = Math.abs(Math.sin(elapsedMs / 260)) * Math.exp(-elapsedMs / 2600);
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
        if (pose.s === `attn`) {
          let e = Math.sin(timeMs / 90);
          Object.assign(a, { la1: -140, la2: -140 + 45 * e, ra1: 140, ra2: 140 - 45 * e });
        }
        (pose.s === `sleep` &&
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
          (a.hy -= pose.poke * 10));
        let o = this.q,
          s = Math.min(1, dtSeconds * (pose.s === `music` || pose.s === `attn` ? 20 : 8));
        for (const key of STICK_KEYS) o[key] += (a[key] - o[key]) * s;
        let c = (angle: number): [number, number] => [Math.sin((angle * Math.PI) / 180), Math.cos((angle * Math.PI) / 180)],
          l = [o.hx, 12 + o.hy],
          u = [Math.sin((o.tor * Math.PI) / 180), -Math.cos((o.tor * Math.PI) / 180)],
          d = [l[0] + u[0] * 17, l[1] + u[1] * 17],
          f = [l[0] + u[0] * 14, l[1] + u[1] * 14],
          p = [d[0] + u[0] * 7, d[1] + u[1] * 7],
          m = (e: number[], t: number, n: number, r: number, i: number): [[number, number], [number, number]] => {
            let a = c(t),
              o: [number, number] = [e[0] + a[0] * r, e[1] + a[1] * r],
              s = c(n);
            return [o, [o[0] + s[0] * i, o[1] + s[1] * i]];
          },
          [h, g] = m(f, o.la1, o.la2, 9, 8),
          [_, v] = m(f, o.ra1, o.ra2, 9, 8),
          [ee, te] = m(l, o.ll1, o.ll2, 11, 11),
          [y, b] = m(l, o.rl1, o.rl2, 11, 11),
          x = (point: number[]) => point.map((value) => value.toFixed(1)).join(`,`);
        this.body.setAttribute(
          `d`,
          String(`M${x(l)} L${x(d)} M${x(g)} L${x(h)} L${x(f)} L${x(_)} L${x(v)} M${x(te)} L${x(ee)} L${x(l)} L${x(y)} L${x(b)}`),
        );
        let S = pose.c;
        (this.body.setAttribute(`stroke`, String(S)),
          this.head.setAttribute(`stroke`, String(S)),
          this.head.setAttribute(`cx`, String(p[0].toFixed(1))),
          this.head.setAttribute(`cy`, String(p[1].toFixed(1))));
        let ne = pose.s !== `sleep` && pose.blink > 0.5;
        ([this.e1, this.e2].forEach((t, n) => {
          (t.setAttribute(`cx`, String((p[0] + (n ? 2.4 : -2.4) + pose.lx * 0.4).toFixed(1))),
            t.setAttribute(`cy`, String((p[1] - 0.5 + pose.ly * 0.3).toFixed(1))),
            t.setAttribute(`fill`, String(S)),
            (t.style.display = ne ? `` : `none`));
        }),
          drawThinkingDots(this.d, pose.s === `think`, p[0] + 9, p[1] - 8, timeMs),
          drawSleepSymbol(this.z, pose.s === `sleep`, p[0] + 8, p[1] - 6, timeMs),
          drawAttentionBadge(this.b, pose.s === `attn`, p[0] + 16, p[1] - 6));
      }
})
};

interface KoiState {
  bub: SVGCircleElement[];
  f: SVGGElement;
  tail: SVGPathElement;
  p1: SVGEllipseElement;
  p2: SVGEllipseElement;
  e: SVGPathElement;
  x: number;
  dir: number;
  fx: number;
  z: SVGTextElement;
  b: SVGGElement;

}
export const koiDrawing: DrawnCharacter = {
id: `koi`,
name: `Рыбка-кои`,
desc: `Плавает из края в край острова. Под музыку выписывает волны, от радости выпрыгивает, спит на дне.`,
pillScale: 0.42,
...defineDrawing<KoiState>({
build(parent) {
        ((this.bub = [0, 1, 2].map(() =>
          createSvg(`circle`, { r: 2, fill: `none`, stroke: `#85B7EB`, "stroke-width": 1.2 }, parent),
        )),
          (this.f = createSvg(`g`, {}, parent)));
        let t = this.f;
        ((this.tail = createSvg(`path`, { d: `M0,0 L-10,-8 Q-6,0 -10,8 Z` }, t)),
          createSvg(`ellipse`, { cx: 1, cy: 6, rx: 4, ry: 2, fill: `#D3D1C7`, transform: `rotate(30,1,6)` }, t),
          createSvg(`path`, { d: `M20,0 C14,-9 -4,-9 -12,-3 L-17,0 L-12,3 C-4,9 14,9 20,0 Z`, fill: `#F1EFE8` }, t),
          (this.p1 = createSvg(`ellipse`, { cx: 5, cy: -3, rx: 6, ry: 3.6 }, t)),
          (this.p2 = createSvg(`ellipse`, { cx: -6, cy: 2, rx: 4.5, ry: 2.6 }, t)),
          (this.e = createSvg(`path`, {}, t)),
          (this.x = -30),
          (this.dir = 1),
          (this.fx = 1),
          (this.z = createSleepSymbol(parent)),
          (this.b = createAttentionBadge(parent)));
      },
draw(pose, timeMs, elapsedMs, dtSeconds) {
        let i = { idle: 16, music: 42, think: 0, done: 0, attn: 0, sleep: 0 }[pose.s];
        ((this.x += i * this.dir * dtSeconds),
          this.x > 58 && (this.dir = -1),
          this.x < -58 && (this.dir = 1),
          (this.fx += (this.dir - this.fx) * Math.min(1, dtSeconds * 4)));
        let a = Math.sin(timeMs / 1700) * 5,
          o = 0;
        if (
          (pose.s === `music` &&
            ((a = Math.sin((timeMs / 545) * Math.PI) * 8), (o = Math.cos((timeMs / 545) * Math.PI) * 20)),
          pose.s === `done` && elapsedMs < 1600)
        ) {
          let e = elapsedMs / 1600;
          ((a = -Math.sin(e * Math.PI) * 28), (o = -Math.cos(e * Math.PI) * 45));
        }
        (pose.s === `sleep` && (a = 12), (a -= pose.poke * 8));
        let s =
          Math.sin(timeMs / (pose.s === `music` ? 110 : pose.s === `sleep` ? 900 : 280)) * (pose.s === `sleep` ? 6 : 22);
        (this.tail.setAttribute(`transform`, String(`translate(-16,0) rotate(${s.toFixed(1)})`)),
          this.f.setAttribute(
            `transform`,
            String(`translate(${this.x.toFixed(1)},${a.toFixed(1)}) scale(${this.fx.toFixed(3)},1) rotate(${(o * this.dir).toFixed(1)})`),
          ));
        let c = pose.s === `idle` ? `#D85A30` : pose.c;
        ([this.tail, this.p1, this.p2].forEach((e) => e.setAttribute(`fill`, String(c))),
          drawEye(this.e, 14, -2, moodEyeShape(pose.s), pose.blink, `#1b1b1a`, 2.4, 2.8));
        let l = pose.s === `think` || pose.s === `idle` || pose.s === `sleep`;
        (this.bub.forEach((n, r) => {
          let i = (timeMs / (pose.s === `think` ? 900 : 2600) + r / 3) % 1;
          ((n.style.display = l ? `` : `none`),
            n.setAttribute(`cx`, String((this.x + this.fx * 20 + Math.sin(i * 9) * 2).toFixed(1))),
            n.setAttribute(`cy`, String((a - 2 - i * 16).toFixed(1))),
            n.setAttribute(`r`, String((1.2 + i * 1.8).toFixed(1))),
            n.setAttribute(`opacity`, String((1 - i).toFixed(2))));
        }),
          drawSleepSymbol(this.z, pose.s === `sleep`, this.x + 14, a - 8, timeMs),
          drawAttentionBadge(this.b, pose.s === `attn`, this.x + this.fx * 26, a - 10));
      }
})
};

interface SnailState {
  w: SVGGElement;
  bd: SVGGElement;
  s1: SVGPathElement;
  s2: SVGPathElement;
  e1: SVGPathElement;
  e2: SVGPathElement;
  m: SVGPathElement;
  sh: SVGGElement;
  shc: SVGCircleElement;
  x: number;
  dir: number;
  fx: number;
  ext: number;
  d: SVGCircleElement[];
  z: SVGTextElement;
  b: SVGGElement;

}
export const snailDrawing: DrawnCharacter = {
id: `snail`,
name: `Улитка`,
desc: `Медленно ползёт по острову. Рожки вытягиваются от любопытства, а когда никого нет, прячется в домик.`,
...defineDrawing<SnailState>({
build(parent) {
        this.w = createSvg(`g`, {}, parent);
        let t = this.w;
        this.bd = createSvg(`g`, {}, t);
        let n = this.bd;
        (createSvg(
          `path`,
          {
            d: `M-24,30 Q-24,24 -12,24 L10,24 Q17,22 19,13 Q21,6 26,8 Q30,14 26,24 Q23,30 14,30 Z`,
            fill: `#D3C3A8`,
          },
          n,
        ),
          (this.s1 = createSvg(
            `path`,
            { fill: `none`, stroke: `#D3C3A8`, "stroke-width": 2.2, "stroke-linecap": `round` },
            n,
          )),
          (this.s2 = createSvg(
            `path`,
            { fill: `none`, stroke: `#D3C3A8`, "stroke-width": 2.2, "stroke-linecap": `round` },
            n,
          )),
          (this.e1 = createSvg(`path`, {}, n)),
          (this.e2 = createSvg(`path`, {}, n)),
          (this.m = createSvg(
            `path`,
            { fill: `none`, stroke: `#5B3F2E`, "stroke-width": 1.3, "stroke-linecap": `round` },
            n,
          )),
          (this.sh = createSvg(`g`, {}, t)),
          (this.shc = createSvg(`circle`, { cx: 0, cy: 0, r: 15 }, this.sh)),
          createSvg(
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
          (this.d = createThinkingDots(parent)),
          (this.z = createSleepSymbol(parent)),
          (this.b = createAttentionBadge(parent)));
      },
draw(pose, timeMs, elapsedMs, dtSeconds) {
        let i = pose.s === `idle` ? 5 : 0;
        ((this.x += i * this.dir * dtSeconds),
          this.x > 30 && (this.dir = -1),
          this.x < -30 && (this.dir = 1),
          (this.fx += (this.dir - this.fx) * Math.min(1, dtSeconds * 3)));
        let a = pose.s === `sleep` ? 0 : pose.s === `attn` ? 1.35 : 1;
        this.ext += (a - this.ext) * Math.min(1, dtSeconds * (pose.s === `sleep` ? 2 : 6));
        let o = 0,
          s = Math.sin(timeMs / 1600) * 2;
        (pose.s === `music` &&
          ((o = -Math.abs(Math.sin((timeMs / 545) * Math.PI)) * 4), (s = Math.sin((timeMs / 545) * Math.PI) * 9)),
          pose.s === `done` && (o = -Math.abs(Math.sin(elapsedMs / 250)) * 8 * Math.exp(-elapsedMs / 2e3)),
          (o -= pose.poke * 6),
          this.w.setAttribute(
            `transform`,
            String(`translate(${this.x.toFixed(1)},${o.toFixed(1)}) scale(${this.fx.toFixed(3)},1)`),
          ),
          this.bd.setAttribute(
            `transform`,
            String(`translate(${(-14 * (1 - Math.min(1, this.ext))).toFixed(1)},0) scale(${(0.5 + 0.5 * Math.min(1, this.ext)).toFixed(3)},1)`),
          ),
          (this.bd.style.opacity = this.ext < 0.15 ? "0" : "1"));
        let c =
            pose.s === `music`
              ? Math.sin((timeMs / 545) * Math.PI) * 14
              : pose.s === `think`
                ? -18
                : Math.sin(timeMs / 900) * 6,
          l = 13 * this.ext,
          u = (e: number, t: number, n: number): [number, number] => {
            let r = ((n - 90) * Math.PI) / 180;
            return [e + Math.cos(r) * l, t + Math.sin(r) * l];
          },
          [d, f] = u(21, 10, 8 + c),
          [p, m] = u(25, 10, 28 + c * (pose.s === `think` ? 0 : 0.7));
        (this.s1.setAttribute(`d`, String(`M21,10 L${d.toFixed(1)},${f.toFixed(1)}`)),
          this.s2.setAttribute(`d`, String(`M25,10 L${p.toFixed(1)},${m.toFixed(1)}`)));
        let h = moodEyeShape(pose.s);
        (drawEye(this.e1, d, f, h === `open` ? `open` : h, pose.blink, `#1b1b1a`, 3, 3.2),
          drawEye(this.e2, p, m, h === `open` ? `open` : h, pose.blink, `#1b1b1a`, 3, 3.2),
          this.m.setAttribute(`d`, String(`M22,18 Q24.5,20 27,18`)),
          this.sh.setAttribute(`transform`, String(`translate(-2,11) rotate(${s.toFixed(1)})`)),
          this.shc.setAttribute(`fill`, String(pose.s === `idle` ? `#D85A30` : pose.c)),
          drawThinkingDots(this.d, pose.s === `think`, this.x + 12, -14, timeMs),
          drawSleepSymbol(this.z, pose.s === `sleep`, this.x + 12, -6, timeMs),
          drawAttentionBadge(this.b, pose.s === `attn`, this.x + this.fx * 34, -16));
      }
})
};

interface TailState {
  t: SVGPathElement;
  tip: SVGCircleElement;
  z: SVGTextElement;
  q: TailPose | null;

}
export const tailDrawing: DrawnCharacter = {
id: `tail`,
name: `Хвост`,
outside: !0,
desc: `В острове кто-то живёт, но видно только хвост. Виляет под музыку, сворачивается вопросом, распушается от тревоги.`,
...defineDrawing<TailState>({
build(parent) {
        ((this.t = createSvg(`path`, { fill: `none`, stroke: `#E8A65A`, "stroke-linecap": `round` }, parent)),
          (this.tip = createSvg(`circle`, {}, parent)),
          (this.z = createSleepSymbol(parent)),
          (this.q = null));
      },
draw(pose, timeMs, elapsedMs) {
        let r = Math.sin(timeMs / 1300) * 8,
          i = 9,
          a = 0,
          o = 0;
        (pose.s === `music` && (r = Math.sin((timeMs / 545) * Math.PI * 2) * 18),
          pose.s === `done` && (r = Math.sin(timeMs / 70) * 20 * (elapsedMs < 2400 ? 1 : 0.4)),
          pose.s === `think` && ((a = 1), (r = Math.sin(timeMs / 1600) * 3)),
          pose.s === `attn` && ((i = 16), (r = Math.sin(timeMs / 40) * 1.5)),
          pose.s === `sleep` && ((o = 1), (r = Math.sin(timeMs / 2400) * 3)),
          (r += pose.poke * 20));
        let s = { sw: r, cu: a, dr: o, wi: i };
        this.q ||= { ...s };
        for (const key of TAIL_KEYS) this.q[key] += (s[key] - this.q[key]) * 0.12;
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
          String(`M56,20 C74,${d.toFixed(1)} ${f.toFixed(1)},${p.toFixed(1)} ${l.toFixed(1)},${u.toFixed(1)}${m}`),
        ),
          this.t.setAttribute(`stroke-width`, String(c.wi.toFixed(1))));
        let h = c.cu > 0.05 ? l - 20 * c.cu : l,
          g = c.cu > 0.05 ? u - 4 * c.cu : u;
        (this.tip.setAttribute(`cx`, String(h.toFixed(1))),
          this.tip.setAttribute(`cy`, String(g.toFixed(1))),
          this.tip.setAttribute(`r`, String((c.wi * 0.62).toFixed(1))),
          this.tip.setAttribute(`fill`, String(pose.s === `idle` ? `#F7E7D0` : pose.c)),
          drawSleepSymbol(this.z, pose.s === `sleep`, 68, 30, timeMs));
      }
})
};

interface LegsState {
  g2: SVGGElement;
  legs: SVGPathElement[];
  shoes: SVGPathElement[];
  e1: SVGPathElement;
  e2: SVGPathElement;
  z: SVGTextElement;
  q: LegsPose | null;

}
export const legsDrawing: DrawnCharacter = {
id: `legs`,
name: `Остров на ножках`,
outside: !0,
face: !0,
desc: `Персонаж это сам остров: глаза внутри, ножки свисают снизу. Болтает ими, отбивает ритм, подпрыгивает.`,
...defineDrawing<LegsState>({
build(parent) {
        ((this.g2 = createSvg(`g`, {}, parent)),
          (this.legs = [0, 1].map(() =>
            createSvg(
              `path`,
              {
                fill: `none`,
                stroke: `#000`,
                "stroke-width": 4.5,
                "stroke-linecap": `round`,
                "stroke-linejoin": `round`,
              },
              parent,
            ),
          )),
          (this.shoes = [0, 1].map(() => createSvg(`path`, {}, parent))),
          (this.e1 = createSvg(`path`, {}, parent)),
          (this.e2 = createSvg(`path`, {}, parent)),
          (this.z = createSleepSymbol(parent)),
          (this.q = null));
      },
draw(pose, timeMs, elapsedMs) {
        let r = Math.sin(timeMs / 950),
          i = { a1: 18 * r, b1: 12, a2: -18 * r, b2: 12, jump: 0 };
        if (pose.s === `music`) {
          let e = Math.sin((timeMs / 545) * Math.PI);
          i = {
            a1: Math.max(0, e) * 45,
            b1: -Math.max(0, e) * 30 + 10,
            a2: Math.max(0, -e) * -45,
            b2: Math.max(0, -e) * 30 - 10,
            jump: 0,
          };
        }
        if (
          (pose.s === `think` &&
            (i = { a1: 30, b1: -40, a2: -10, b2: 30 + Math.max(0, Math.sin(timeMs / 200)) * 20, jump: 0 }),
          pose.s === `done` &&
            (i = {
              a1: -20,
              b1: 60,
              a2: 20,
              b2: -60,
              jump: Math.abs(Math.sin(elapsedMs / 240)) * 14 * Math.exp(-elapsedMs / 1800),
            }),
          pose.s === `attn`)
        ) {
          let e = Math.sin(timeMs / 70);
          i = { a1: 2, b1: Math.max(0, e) * 25, a2: -2, b2: -Math.max(0, -e) * 25, jump: 0 };
        }
        (pose.s === `sleep` &&
          (i = { a1: 6 * Math.sin(timeMs / 2600), b1: 4, a2: -6 * Math.sin(timeMs / 2600), b2: -4, jump: 0 }),
          (i.jump += pose.poke * 10),
          (this.q ||= { ...i }));
        for (const key of LEGS_KEYS) this.q[key] += (i[key] - this.q[key]) * 0.2;
        let a = this.q,
          o = -a.jump;
        this.g2.setAttribute(`transform`, String(`translate(0,${o})`));
        let s = (e: number, t: number, n: number): [[number, number], [number, number], number] => {
          let r = (t * Math.PI) / 180,
            i = ((t + n) * Math.PI) / 180,
            a: [number, number] = [e + Math.sin(r) * 13, 30 + Math.cos(r) * 13 + o];
          return [a, [a[0] + Math.sin(i) * 13, a[1] + Math.cos(i) * 13], i];
        };
        [
          [-18, a.a1, a.b1],
          [18, a.a2, a.b2],
        ].forEach(([t, n, r], i) => {
          let [a, c, l] = s(t, n, r);
          this.legs[i].setAttribute(
            `d`,
            String(`M${t},${28 + o} L${a[0].toFixed(1)},${a[1].toFixed(1)} L${c[0].toFixed(1)},${c[1].toFixed(1)}`),
          );
          let u = i ? 1 : -1;
          (this.shoes[i].setAttribute(`d`, String(roundedPath(c[0] + u * 2.5, c[1] + 1.5, 11, 6.5))),
            this.shoes[i].setAttribute(`fill`, String(pose.s === `idle` ? `#D85A30` : pose.c)),
            this.shoes[i].setAttribute(
              `transform`,
              String(`rotate(${(-l * 57.3 * 0.3).toFixed(1)},${c[0].toFixed(1)},${c[1].toFixed(1)})`),
            ));
        });
        let c = moodEyeShape(pose.s);
        if ((pose.h || 30) > 40 || pose.face === !1) (this.e1.setAttribute(`d`, String(``)), this.e2.setAttribute(`d`, String(``)));
        else {
          let t = Math.max(8, 13 + o * 0.45 + pose.ly * 0.6);
          (drawEye(this.e1, -12 + pose.lx * 1.2, t, c, pose.blink, `#F1EFE8`, 6.5, 11),
            drawEye(this.e2, 12 + pose.lx * 1.2, t, c, pose.blink, `#F1EFE8`, 6.5, 11));
        }
        drawSleepSymbol(this.z, pose.s === `sleep`, 20, 22, timeMs);
      }
})
};

export const creatures = [hamsterDrawing, stickDrawing, koiDrawing, snailDrawing, tailDrawing, legsDrawing];
