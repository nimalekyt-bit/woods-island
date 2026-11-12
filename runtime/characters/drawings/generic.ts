import { createSvg, roundedPath, drawEye, moodEyeShape, polar, createThinkingDots, drawThinkingDots, createSleepSymbol, drawSleepSymbol, createAttentionBadge, drawAttentionBadge } from './helpers';
import { defineDrawing } from './defineDrawing';
import type { DrawnCharacter, DrawingMood } from '../types';
const INK_COLOR = `#2C2C2A`;
const DARK_INK_COLOR = `#1b1b1a`;
const jellyPeriod = (mood: DrawingMood) => ({ idle: 2600, music: 545, think: 1500, done: 700, attn: 900, sleep: 4200 })[mood];
interface SwarmParticle { x:number; y:number; vx:number; vy:number; e:SVGCircleElement }

interface SparkState {
  body: SVGCircleElement;
  l: SVGPathElement;
  r: SVGPathElement;

}
export const sparkDrawing = defineDrawing<SparkState>({
build(parent) {
      ((this.body = createSvg(`circle`, { r: 24 }, parent)),
        createSvg(`circle`, { cx: -9, cy: -11, r: 4, fill: `#FFFFFF`, opacity: 0.55 }, parent),
        (this.l = createSvg(`path`, {}, parent)),
        (this.r = createSvg(`path`, {}, parent)));
    },
draw(pose) {
      (this.body.setAttribute(`fill`, String(pose.s === `idle` ? `#F1EFE8` : pose.c)),
        drawEye(this.l, -9 + pose.lx, -2 + pose.ly, moodEyeShape(pose.s), pose.blink, INK_COLOR, 7, 12),
        drawEye(this.r, 9 + pose.lx, -2 + pose.ly, moodEyeShape(pose.s), pose.blink, INK_COLOR, 7, 12));
    }
});

interface EyesState {
  l: SVGPathElement;
  r: SVGPathElement;
  m: SVGPathElement;

}
export const eyesDrawing = defineDrawing<EyesState>({
build(parent) {
      ((this.l = createSvg(`path`, {}, parent)),
        (this.r = createSvg(`path`, {}, parent)),
        (this.m = createSvg(`path`, { fill: `none`, "stroke-width": 2.6, "stroke-linecap": `round` }, parent)));
    },
draw(pose) {
      let t = pose.s === `idle` ? `#F1EFE8` : pose.c,
        n = moodEyeShape(pose.s);
      (drawEye(this.l, -15 + pose.lx * 1.4, -4 + pose.ly, n, pose.blink, t, 13, 22),
        drawEye(this.r, 15 + pose.lx * 1.4, -4 + pose.ly, n, pose.blink, t, 13, 22),
        this.m.setAttribute(`stroke`, String(t)),
        this.m.setAttribute(
          `d`,
          String(n === `happy` ? `M-7,16 Q0,23 7,16` : n === `wide` ? `M-3,18 a3,3 0 1,0 6,0 a3,3 0 1,0 -6,0` : ``),
        ));
    }
});

interface BotState {
  ant: SVGCircleElement;
  l: SVGPathElement;
  r: SVGPathElement;

}
export const botDrawing = defineDrawing<BotState>({
build(parent) {
      (createSvg(`path`, { d: `M0,-22 V-31`, stroke: `#B4B2A9`, "stroke-width": 2.5, "stroke-linecap": `round` }, parent),
        (this.ant = createSvg(`circle`, { cy: -34, r: 4 }, parent)),
        createSvg(`path`, { d: roundedPath(0, 0, 58, 44), fill: `#D3D1C7` }, parent),
        createSvg(`path`, { d: roundedPath(-31, 0, 6, 14), fill: `#B4B2A9` }, parent),
        createSvg(`path`, { d: roundedPath(31, 0, 6, 14), fill: `#B4B2A9` }, parent),
        createSvg(`path`, { d: roundedPath(0, 1, 44, 30), fill: INK_COLOR }, parent),
        (this.l = createSvg(`path`, {}, parent)),
        (this.r = createSvg(`path`, {}, parent)));
    },
draw(pose, timeMs) {
      let n = pose.s === `idle` ? `#5DCAA5` : pose.c;
      (this.ant.setAttribute(`fill`, String(n)),
        this.ant.setAttribute(
          `opacity`,
          String(pose.s === `think` ? (0.4 + 0.6 * Math.abs(Math.sin(timeMs / 200))).toFixed(2) : `1`),
        ),
        drawEye(this.l, -9 + pose.lx * 0.8, 1 + pose.ly * 0.6, moodEyeShape(pose.s), pose.blink, n, 6, 11),
        drawEye(this.r, 9 + pose.lx * 0.8, 1 + pose.ly * 0.6, moodEyeShape(pose.s), pose.blink, n, 6, 11));
    }
});

interface CatState {
  earL: SVGGElement;
  earR: SVGGElement;
  l: SVGPathElement;
  r: SVGPathElement;
  bell: SVGCircleElement;

}
export const catDrawing = defineDrawing<CatState>({
build(parent) {
      ((this.earL = createSvg(`g`, {}, parent)),
        createSvg(`path`, { d: `M-24,-8 L-19,-34 L-4,-21 Z`, fill: `#F1EFE8` }, this.earL),
        createSvg(`path`, { d: `M-20,-12 L-17,-27 L-9,-19 Z`, fill: `#F4C0D1` }, this.earL),
        (this.earR = createSvg(`g`, {}, parent)),
        createSvg(`path`, { d: `M24,-8 L19,-34 L4,-21 Z`, fill: `#F1EFE8` }, this.earR),
        createSvg(`path`, { d: `M20,-12 L17,-27 L9,-19 Z`, fill: `#F4C0D1` }, this.earR),
        createSvg(`ellipse`, { rx: 27, ry: 23, fill: `#F1EFE8` }, parent),
        (this.l = createSvg(`path`, {}, parent)),
        (this.r = createSvg(`path`, {}, parent)),
        createSvg(`path`, { d: `M-2.5,4 h5 l-2.5,3 z`, fill: `#ED93B1` }, parent),
        createSvg(
          `path`,
          {
            d: `M-5,9 q2.5,3 5,0 q2.5,3 5,0`,
            fill: `none`,
            stroke: INK_COLOR,
            "stroke-width": 1.6,
            "stroke-linecap": `round`,
          },
          parent,
        ),
        createSvg(
          `path`,
          {
            d: `M-12,5 L-30,2 M-12,8 L-29,10 M12,5 L30,2 M12,8 L29,10`,
            stroke: `#888780`,
            "stroke-width": 1.2,
            "stroke-linecap": `round`,
          },
          parent,
        ),
        (this.bell = createSvg(`circle`, { cy: 24, r: 4.5 }, parent)));
    },
draw(pose, timeMs) {
      this.bell.setAttribute(`fill`, String(pose.s === `idle` ? `#EF9F27` : pose.c));
      let n = pose.s === `attn` ? Math.sin(timeMs / 60) * 8 : pose.blink < 1 ? -6 : 0;
      (this.earL.setAttribute(`transform`, String(`rotate(${n},-14,-10)`)),
        this.earR.setAttribute(`transform`, String(`rotate(${-n * 0.6},14,-10)`)),
        drawEye(this.l, -10 + pose.lx, -4 + pose.ly, moodEyeShape(pose.s), pose.blink, INK_COLOR, 7, 11),
        drawEye(this.r, 10 + pose.lx, -4 + pose.ly, moodEyeShape(pose.s), pose.blink, INK_COLOR, 7, 11));
    }
});

interface BlobState {
  body: SVGPathElement;
  l: SVGPathElement;
  r: SVGPathElement;

}
export const blobDrawing = defineDrawing<BlobState>({
build(parent) {
      ((this.body = createSvg(`path`, {}, parent)),
        createSvg(`ellipse`, { cx: -10, cy: -10, rx: 5, ry: 3.5, fill: `#FFFFFF`, opacity: 0.5 }, parent),
        createSvg(`ellipse`, { cx: -15, cy: 7, rx: 4, ry: 2.5, fill: `#ED93B1`, opacity: 0.7 }, parent),
        createSvg(`ellipse`, { cx: 15, cy: 7, rx: 4, ry: 2.5, fill: `#ED93B1`, opacity: 0.7 }, parent),
        (this.l = createSvg(`path`, {}, parent)),
        (this.r = createSvg(`path`, {}, parent)));
    },
draw(pose, timeMs) {
      let n = [],
        r = pose.s === `music` ? 0.07 : 0.035;
      for (let e = 0; e < 24; e++) {
        let i = (e / 24) * Math.PI * 2,
          a = 1 + r * Math.sin(i * 3 + timeMs / 260),
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
      (this.body.setAttribute(`d`, String(i + `Z`)),
        this.body.setAttribute(`fill`, String(pose.s === `idle` ? `#F5C4B3` : pose.c)),
        drawEye(this.l, -8 + pose.lx, -1 + pose.ly, moodEyeShape(pose.s), pose.blink, INK_COLOR, 6, 10),
        drawEye(this.r, 8 + pose.lx, -1 + pose.ly, moodEyeShape(pose.s), pose.blink, INK_COLOR, 6, 10));
    }
});

interface JellyState {
  t: SVGPathElement[];
  bell: SVGPathElement;
  hl: SVGPathElement;
  l: SVGPathElement;
  r: SVGPathElement;
  z: SVGTextElement;

}
export const jellyDrawing = defineDrawing<JellyState>({
build(parent) {
      ((this.t = [0, 1, 2, 3].map(() =>
        createSvg(`path`, { fill: `none`, "stroke-width": 2.4, "stroke-linecap": `round`, opacity: 0.85 }, parent),
      )),
        (this.bell = createSvg(`path`, {}, parent)),
        (this.hl = createSvg(
          `path`,
          { fill: `none`, stroke: `#FFFFFF`, "stroke-width": 3, "stroke-linecap": `round`, opacity: 0.25 },
          parent,
        )),
        (this.l = createSvg(`path`, {}, parent)),
        (this.r = createSvg(`path`, {}, parent)),
        (this.z = createSleepSymbol(parent)));
    },
draw(pose, timeMs) {
      let n = jellyPeriod(pose.s),
        r = (timeMs % n) / n,
        i = r < 0.28 ? Math.sin((r / 0.28) * Math.PI) : 0,
        a = 46 * (1 - 0.13 * i),
        o = 30 * (1 + 0.1 * i),
        s = (pose.s === `sleep` ? 4 : 0) - 5 * i + Math.sin(timeMs / 1100) * 1.5 - pose.poke * 6,
        c = pose.s === `idle` ? `#5DCAA5` : pose.c;
      (this.bell.setAttribute(
        `d`,
        String(`M${-a / 2},${4 + s} Q${-a / 2},${-o + 4 + s} 0,${-o + 4 + s} Q${a / 2},${-o + 4 + s} ${a / 2},${4 + s} Q${a / 4},${8 + s} 0,${5 + s} Q${-a / 4},${8 + s} ${-a / 2},${4 + s}Z`),
      ),
        this.bell.setAttribute(`fill`, String(c)),
        this.hl.setAttribute(
          `d`,
          String(`M${-a * 0.32},${-o * 0.45 + 4 + s} Q${-a * 0.28},${-o * 0.85 + 4 + s} ${-a * 0.05},${-o * 0.88 + 4 + s}`),
        ));
      let l = (pose.s === `sleep` ? 27 : 24) * (1 - 0.15 * i),
        u = pose.s === `attn` ? 1.6 : 1;
      (this.t.forEach((n, r) => {
        let a = (-15 + r * 10) * u * (1 + 0.15 * i),
          o = pose.s === `sleep` ? 1.5 : 5,
          d = timeMs / (pose.s === `music` ? 160 : 330);
        (n.setAttribute(
          `d`,
          String(`M${(-15 + r * 10) * 0.85},${6 + s} Q${a + Math.sin(d + r) * o},${6 + s + l / 2} ${a * 1.1 + Math.sin(d + r + 1.5) * o * 0.8},${6 + s + l}`),
        ),
          n.setAttribute(`stroke`, String(c)));
      }),
        drawEye(this.l, -8 + pose.lx * 0.7, -9 + s + pose.ly * 0.5, moodEyeShape(pose.s), pose.blink, DARK_INK_COLOR, 4.5, 7),
        drawEye(this.r, 8 + pose.lx * 0.7, -9 + s + pose.ly * 0.5, moodEyeShape(pose.s), pose.blink, DARK_INK_COLOR, 4.5, 7),
        drawSleepSymbol(this.z, pose.s === `sleep`, 22, -12, timeMs));
    }
});

interface SlothState {
  sw: SVGGElement;
  l: SVGPathElement;
  r: SVGPathElement;
  m: SVGPathElement;
  fl: SVGGElement;
  pet: SVGCircleElement[];
  z: SVGTextElement;

}
export const slothDrawing = defineDrawing<SlothState>({
build(parent) {
      this.sw = createSvg(`g`, {}, parent);
      let t = this.sw;
      (createSvg(
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
        createSvg(
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
        createSvg(
          `path`,
          {
            d: `M-14,-55 v4 M-11,-55 v4 M-8,-55 v4 M8,-55 v4 M11,-55 v4 M14,-55 v4`,
            stroke: `#D3D1C7`,
            "stroke-width": 1.3,
            "stroke-linecap": `round`,
          },
          t,
        ),
        createSvg(`ellipse`, { cx: 0, cy: 0, rx: 22, ry: 20, fill: `#8A6A52` }, t),
        createSvg(`ellipse`, { cx: 0, cy: 3, rx: 15.5, ry: 12.5, fill: `#E8D9C0` }, t),
        createSvg(`ellipse`, { cx: -7, cy: 0, rx: 6.5, ry: 4, fill: `#5B3F2E`, transform: `rotate(-22,-7,0)` }, t),
        createSvg(`ellipse`, { cx: 7, cy: 0, rx: 6.5, ry: 4, fill: `#5B3F2E`, transform: `rotate(22,7,0)` }, t),
        (this.l = createSvg(`path`, {}, t)),
        (this.r = createSvg(`path`, {}, t)),
        createSvg(`ellipse`, { cx: 0, cy: 6, rx: 3, ry: 2, fill: `#3D2B20` }, t),
        (this.m = createSvg(
          `path`,
          { fill: `none`, stroke: `#3D2B20`, "stroke-width": 1.4, "stroke-linecap": `round` },
          t,
        )),
        (this.fl = createSvg(`g`, { transform: `translate(11,-17)` }, t)),
        (this.pet = [0, 1, 2, 3, 4].map((e) =>
          createSvg(
            `circle`,
            {
              cx: (Math.cos(e * 1.257) * 3.6).toFixed(1),
              cy: (Math.sin(e * 1.257) * 3.6).toFixed(1),
              r: 2.8,
            },
            this.fl,
          ),
        )),
        createSvg(`circle`, { r: 2, fill: `#FAC775` }, this.fl),
        (this.z = createSleepSymbol(parent)));
    },
draw(pose, timeMs, elapsedMs) {
      let r = Math.sin(timeMs / 1400) * 4;
      (pose.s === `music` && (r = Math.sin((timeMs / 545) * Math.PI) * 10),
        pose.s === `done` && (r = Math.sin(elapsedMs / 260) * 16 * Math.exp(-elapsedMs / 2200) + Math.sin(timeMs / 1400) * 3),
        pose.s === `attn` && (r = 0),
        pose.s === `sleep` && (r = Math.sin(timeMs / 2600) * 2),
        pose.s === `think` && (r = Math.sin(timeMs / 2200) * 2),
        (r += pose.poke * 12),
        this.sw.setAttribute(`transform`, String(`rotate(${r.toFixed(2)},0,-56)`)),
        this.pet.forEach((t) => t.setAttribute(`fill`, String(pose.s === `idle` ? `#ED93B1` : pose.c))));
      let i = moodEyeShape(pose.s);
      (drawEye(this.l, -7 + pose.lx * 0.5, pose.ly * 0.4, i, pose.blink, `#111`, 3.4, 4.2),
        drawEye(this.r, 7 + pose.lx * 0.5, pose.ly * 0.4, i, pose.blink, `#111`, 3.4, 4.2),
        this.m.setAttribute(
          `d`,
          String(pose.s === `attn` ? `M-2,10 a2,2 0 1,0 4,0 a2,2 0 1,0 -4,0` : `M-4,9 Q0,12 4,9`),
        ),
        drawSleepSymbol(this.z, pose.s === `sleep`, 22, -10, timeMs));
    }
});

interface AstroState {
  stars: SVGCircleElement[];
  b: SVGGElement;
  al: SVGPathElement;
  ar: SVGPathElement;
  vis: SVGEllipseElement;
  tip: SVGCircleElement;
  l: SVGPathElement;
  r: SVGPathElement;
  z: SVGTextElement;

}
export const astroDrawing = defineDrawing<AstroState>({
build(parent) {
      ((this.stars = [
        [-40, -30],
        [38, -26],
        [-34, 20],
        [42, 18],
        [0, -40],
      ].map(([t, n]) => createSvg(`circle`, { cx: t, cy: n, r: 1.2, fill: `#FFFFFF` }, parent))),
        (this.b = createSvg(`g`, {}, parent)));
      let t = this.b;
      (createSvg(`path`, { d: roundedPath(0, 4, 34, 30), fill: `#B4B2A9` }, t),
        createSvg(`path`, { d: roundedPath(0, 16, 24, 20), fill: `#F1EFE8` }, t),
        (this.al = createSvg(`path`, { d: roundedPath(0, 0, 7, 16), fill: `#F1EFE8` }, t)),
        (this.ar = createSvg(`path`, { d: roundedPath(0, 0, 7, 16), fill: `#F1EFE8` }, t)),
        createSvg(`circle`, { cx: 0, cy: -4, r: 21, fill: `#F1EFE8` }, t),
        (this.vis = createSvg(`ellipse`, { cx: 0, cy: -3, rx: 15, ry: 11 }, t)),
        createSvg(`ellipse`, { cx: -7, cy: -8, rx: 4, ry: 2.2, fill: `#FFFFFF`, opacity: 0.55 }, t),
        createSvg(
          `path`,
          { d: `M13,-20 L17,-29`, stroke: `#B4B2A9`, "stroke-width": 2, "stroke-linecap": `round` },
          t,
        ),
        (this.tip = createSvg(`circle`, { cx: 17.5, cy: -30.5, r: 2.6 }, t)),
        (this.l = createSvg(`path`, {}, t)),
        (this.r = createSvg(`path`, {}, t)),
        (this.z = createSleepSymbol(parent)));
    },
draw(pose, timeMs, elapsedMs) {
      let r = Math.sin(timeMs / 1300) * 4,
        i = Math.sin(timeMs / 2100) * 9;
      (pose.s === `music` &&
        ((i = Math.sin((timeMs / 545) * Math.PI) * 12), (r = -Math.abs(Math.sin((timeMs / 545) * Math.PI)) * 5)),
        pose.s === `done` && (i = elapsedMs < 900 ? (elapsedMs / 900) * 360 : Math.sin(timeMs / 1300) * 6),
        pose.s === `attn` && (i = elapsedMs % 1400 < 300 ? Math.sin(elapsedMs / 25) * 6 : 0),
        pose.s === `sleep` && ((i = Math.sin(timeMs / 3200) * 14), (r = Math.sin(timeMs / 2400) * 3 + 4)),
        (r -= pose.poke * 10),
        this.b.setAttribute(`transform`, String(`translate(0,${r.toFixed(2)}) rotate(${i.toFixed(2)})`)));
      let a = pose.s === `idle` ? `#85B7EB` : pose.c;
      (this.vis.setAttribute(`fill`, String(a)),
        this.tip.setAttribute(`fill`, String(a)),
        this.tip.setAttribute(
          `opacity`,
          String(pose.s === `think` ? (0.3 + 0.7 * Math.abs(Math.sin(timeMs / 180))).toFixed(2) : `1`),
        ));
      let o = pose.s === `done` && elapsedMs > 900 ? Math.sin(timeMs / 120) * 35 : 0;
      (this.al.setAttribute(`transform`, String(`translate(-15,14) rotate(30)`)),
        this.ar.setAttribute(`transform`, String(`translate(15,14) rotate(${-30 - o})`)));
      let s = moodEyeShape(pose.s),
        c = pose.s === `think` ? -3 : 0;
      (drawEye(this.l, -5 + pose.lx * 0.8, -3 + pose.ly * 0.6 + c, s, pose.blink, DARK_INK_COLOR, 3.6, 5.5),
        drawEye(this.r, 5 + pose.lx * 0.8, -3 + pose.ly * 0.6 + c, s, pose.blink, DARK_INK_COLOR, 3.6, 5.5),
        this.stars.forEach((e, n) =>
          e.setAttribute(`opacity`, String((0.25 + 0.6 * Math.abs(Math.sin(timeMs / (700 + n * 230) + n))).toFixed(2))),
        ),
        drawSleepSymbol(this.z, pose.s === `sleep`, 22, -18, timeMs));
    }
});

interface SproutState {
  stem: SVGPathElement;
  lf1: SVGPathElement;
  lf2: SVGPathElement;
  fl: SVGGElement;
  pet: SVGEllipseElement[];
  bud: SVGCircleElement;
  l: SVGPathElement;
  r: SVGPathElement;
  m: SVGPathElement;
  z: SVGTextElement;

}
export const sproutDrawing = defineDrawing<SproutState>({
build(parent) {
      ((this.stem = createSvg(
        `path`,
        { fill: `none`, stroke: `#639922`, "stroke-width": 3, "stroke-linecap": `round` },
        parent,
      )),
        (this.lf1 = createSvg(`path`, { d: `M0,0 Q-9,-8 -18,-2 Q-9,4 0,0Z`, fill: `#97C459` }, parent)),
        (this.lf2 = createSvg(`path`, { d: `M0,0 Q9,-8 18,-2 Q9,4 0,0Z`, fill: `#97C459` }, parent)),
        (this.fl = createSvg(`g`, {}, parent)),
        (this.pet = [0, 1, 2, 3, 4, 5].map((e) =>
          createSvg(`ellipse`, { cx: 0, cy: -5, rx: 2.8, ry: 5, transform: `rotate(${e * 60})` }, this.fl),
        )),
        (this.bud = createSvg(`circle`, { r: 3.6 }, this.fl)),
        createSvg(`path`, { d: `M-15,6 L15,6 L11,30 L-11,30Z`, fill: `#D85A30` }, parent),
        createSvg(`path`, { d: roundedPath(0, 6, 36, 8), fill: `#F0997B` }, parent),
        (this.l = createSvg(`path`, {}, parent)),
        (this.r = createSvg(`path`, {}, parent)),
        (this.m = createSvg(
          `path`,
          { fill: `none`, stroke: `#4A1B0C`, "stroke-width": 1.6, "stroke-linecap": `round` },
          parent,
        )),
        (this.z = createSleepSymbol(parent)));
    },
draw(pose, timeMs, elapsedMs) {
      let r = 0,
        i = Math.sin(timeMs / 1500) * 6,
        a = -10,
        o = 10,
        s = 0;
      if (pose.s === `music`) {
        let e = (timeMs % 545) / 545;
        ((r = -Math.abs(Math.sin(e * Math.PI)) * 4), (i = Math.sin((timeMs / 545) * Math.PI) * 16), (s = 0.55));
      }
      (pose.s === `think` && ((i = Math.sin(timeMs / 2600) * 3), (a = 8), (o = -8)),
        pose.s === `done` && ((s = Math.min(1, elapsedMs / 600)), (i = Math.sin(timeMs / 700) * 8)),
        pose.s === `attn` && ((a = -45), (o = 45), (i = 0)),
        pose.s === `sleep` && ((a = 40), (o = -40), (i = Math.sin(timeMs / 3e3) * 2)),
        (r -= pose.poke * 8));
      let c = -30 + (pose.s === `sleep` ? 6 : 0);
      (this.stem.setAttribute(`d`, String(`M0,${6 + r} Q${i * 0.4},${-10 + r} ${i},${c + r}`)),
        this.lf1.setAttribute(`transform`, String(`translate(${i * 0.35},${-8 + r}) rotate(${a + i})`)),
        this.lf2.setAttribute(`transform`, String(`translate(${i * 0.6},${-17 + r}) rotate(${o + i})`)),
        this.fl.setAttribute(`transform`, String(`translate(${i},${c + r})`)));
      let l = pose.s === `done` ? `#ED93B1` : pose.c;
      (this.pet.forEach((e) => {
        (e.setAttribute(`fill`, String(l)),
          e.setAttribute(`ry`, String((5 * s).toFixed(2))),
          e.setAttribute(`cy`, String((-5 * s).toFixed(2))));
      }),
        this.bud.setAttribute(`fill`, String(s > 0.1 ? `#FAC775` : `#639922`)));
      let u = moodEyeShape(pose.s);
      (drawEye(this.l, -5 + pose.lx * 0.6, 17 + r + pose.ly * 0.4, u, pose.blink, `#4A1B0C`, 3.2, 4.5),
        drawEye(this.r, 5 + pose.lx * 0.6, 17 + r + pose.ly * 0.4, u, pose.blink, `#4A1B0C`, 3.2, 4.5),
        this.m.setAttribute(
          `d`,
          String(pose.s === `attn`
            ? `M-1.8,${23 + r} a1.8,1.8 0 1,0 3.6,0 a1.8,1.8 0 1,0 -3.6,0`
            : pose.s === `sleep`
              ? `M-3,${23 + r} H3`
              : `M-3.5,${22 + r} Q0,${25 + r} 3.5,${22 + r}`),
        ),
        drawSleepSymbol(this.z, pose.s === `sleep`, 20, -16, timeMs));
    }
});

interface SwarmState {
  N: number;
  d: SwarmParticle[];
  target(mood: DrawingMood, index: number, count: number, timeMs: number): [number, number];
}
export const swarmDrawing = defineDrawing<SwarmState>({
build(parent) {
      ((this.N = 40), (this.d = []));
      for (let t = 0; t < this.N; t++) {
        let n = (t / this.N) * Math.PI * 2;
        this.d.push({ x: Math.cos(n) * 16, y: Math.sin(n) * 16, vx: 0, vy: 0, e: createSvg(`circle`, { r: 2 }, parent) });
      }
    },
target(mood, index, count, timeMs) {
      if (mood === `music`) {
        let e = (index / (count - 1) - 0.5) * 92,
          i = 4 + 10 * Math.abs(Math.sin((timeMs / 545) * Math.PI));
        return [e, Math.sin(index * 0.55 + timeMs / 170) * i];
      }
      if (mood === `think`) {
        let e = (index / count) * Math.PI * 2 + timeMs / 420;
        return [Math.cos(e) * 19, Math.sin(e) * 19];
      }
      if (mood === `done`) {
        let e = index / (count - 1),
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
      if (mood === `attn`) {
        if (index < count - 6) {
          let e = index / (count - 7);
          return [Math.sin(index) * 1.5, -24 + e * 28];
        }
        let e = (index / 6) * Math.PI * 2;
        return [Math.cos(e) * 2.5, 15 + Math.sin(e) * 2.5];
      }
      if (mood === `sleep`) {
        let e = index * 2.4 + timeMs / 6e3,
          n = 3 + (index % 7) * 1.4;
        return [Math.cos(e) * n * 1.4, 14 + Math.sin(e) * n * 0.6];
      }
      let i = (index / count) * Math.PI * 2 + timeMs / 5200,
        a = 15 + 3 * Math.sin(timeMs / 900 + index * 1.7);
      return [Math.cos(i) * a * 1.25, Math.sin(i) * a * 0.9];
    },
draw(pose, timeMs, elapsedMs, dtSeconds) {
      let i = pose.s === `idle` ? `#85B7EB` : pose.c;
      this.d.forEach((n, a) => {
        let [o, s] = this.target(pose.s, a, this.N, timeMs),
          c = pose.s === `think` ? 140 : 60,
          l = pose.s === `think` ? 16 : 9;
        ((n.vx += (-c * (n.x - o) - l * n.vx) * dtSeconds),
          (n.vy += (-c * (n.y - s + pose.poke * 14) - l * n.vy) * dtSeconds),
          (n.x += n.vx * dtSeconds),
          (n.y += n.vy * dtSeconds),
          n.e.setAttribute(`cx`, String(n.x.toFixed(1))),
          n.e.setAttribute(`cy`, String(n.y.toFixed(1))),
          n.e.setAttribute(`fill`, String(i)),
          n.e.setAttribute(
            `opacity`,
            String(pose.s === `think`
              ? (0.25 + 0.75 * ((a / this.N + timeMs / 2600) % 1)).toFixed(2)
              : pose.s === `sleep`
                ? `0.5`
                : `0.9`),
          ));
      });
    }
});

interface KaoState {
  f: SVGTextElement;
  x: SVGTextElement;

}
export const kaoDrawing = defineDrawing<KaoState>({
build(parent) {
      ((this.f = createSvg(
        `text`,
        {
          "text-anchor": `middle`,
          "dominant-baseline": `central`,
          "font-size": 19,
          "font-family": `'Segoe UI Symbol','Meiryo','Yu Gothic',sans-serif`,
        },
        parent,
      )),
        (this.x = createSvg(
          `text`,
          {
            "text-anchor": `middle`,
            "font-size": 11,
            "font-family": `'Segoe UI Symbol',sans-serif`,
            fill: `#888780`,
          },
          parent,
        )));
    },
draw(pose, timeMs, elapsedMs) {
      let r = `(・ω・)`,
        i = ``,
        a = 0,
        o = 0;
      (pose.s === `idle` &&
        (r = pose.blink < 0.5 ? `(－ω－)` : pose.lx < -1.5 ? `(・ω・ )` : pose.lx > 1.5 ? `( ・ω・)` : `(・ω・)`),
        pose.s === `music` &&
          ((r = Math.floor(timeMs / 545) % 2 ? `~(˘▾˘~)` : `(~˘▾˘)~`),
          (i = `♪   ♫`),
          (o = -Math.abs(Math.sin((timeMs / 545) * Math.PI)) * 4)),
        pose.s === `think` && ((r = `(・_・ )`), (i = `.`.repeat(Math.floor(timeMs / 350) % 4))),
        pose.s === `done` &&
          ((r = Math.floor(timeMs / 300) % 2 ? `\\(^o^)/` : `ヽ(^o^)ノ`),
          (o = -Math.abs(Math.sin(elapsedMs / 260)) * 6 * Math.exp(-elapsedMs / 2500))),
        pose.s === `attn` && ((r = `(°ロ°) !`), (a = elapsedMs % 1400 < 300 ? Math.sin(elapsedMs / 25) * 3 : 0)),
        pose.s === `sleep` && ((r = `(－_－)`), (i = `z z Z`)),
        (o -= pose.poke * 8),
        (this.f.textContent = r),
        this.f.setAttribute(`x`, String(a.toFixed(1))),
        this.f.setAttribute(`y`, String(o.toFixed(1))),
        this.f.setAttribute(`fill`, String(pose.s === `idle` ? `#F1EFE8` : pose.c)),
        (this.x.textContent = i),
        this.x.setAttribute(`x`, String(`0`)),
        this.x.setAttribute(`y`, String((-20 + o).toFixed(1))));
    }
});

export const genericDrawings = { spark: sparkDrawing, eyes: eyesDrawing, bot: botDrawing, cat: catDrawing, blob: blobDrawing, jelly: jellyDrawing, sloth: slothDrawing, astro: astroDrawing, sprout: sproutDrawing, swarm: swarmDrawing, kao: kaoDrawing };
