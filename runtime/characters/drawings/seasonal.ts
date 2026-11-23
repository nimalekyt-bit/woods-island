// Original Woods vector artwork; the shared pose engine drives all animation.
import { createSvg as svg, drawEye, moodEyeShape } from './helpers';
import { defineDrawing } from './defineDrawing';
import { seasonalFrame } from '../seasonal-motion';
import type { CharacterPose, Drawing } from '../types';

let paletteSequence = 0;
function palette(parent: SVGElement, name: string, seed: number) {
  const definitions = svg('defs', {}, parent), prefix = `woods-${name}-${seed}-${++paletteSequence}`;
  let index = 0;
  return (light: string, base: string, shade: string) => {
    const id = `${prefix}-${index++}`, gradient = svg('radialGradient', { id, cx: '32%', cy: '23%', r: '82%' }, definitions);
    for (const [offset, color] of [[0, light], [.58, base], [1, shade]] as const) svg('stop', { offset, 'stop-color': color }, gradient);
    return `url(#${id})`;
  };
}
const rotate = (node: SVGElement, angle: number, x: number, y: number) => node.setAttribute('transform', `rotate(${angle.toFixed(2)},${x},${y})`);
interface Face { left: SVGPathElement; right: SVGPathElement; glints: SVGCircleElement[] }
function face(parent: SVGElement): Face { return {left:svg('path',{},parent),right:svg('path',{},parent),glints:[svg('circle',{fill:'#fff',opacity:.85},parent),svg('circle',{fill:'#fff',opacity:.85},parent)]}; }
function eyes(nodes: Face, pose: CharacterPose, distance: number, y: number, width = 3.3, height = 4.2, color = '#292f31') {
  const shape = moodEyeShape(pose.s), yy = y + pose.ly * .4;
  for (const [index, eye] of [nodes.left, nodes.right].entries()) {
    const x = (index === 0 ? -distance : distance) + pose.lx * .6;
    drawEye(eye,x,yy,shape,pose.blink,color,width,height);
    const glint = nodes.glints[index];
    glint.style.display = (shape === 'open' || shape === 'wide') && pose.blink > .6 ? '' : 'none';
    glint.setAttribute('cx',(x-width*.2).toFixed(2));glint.setAttribute('cy',(yy-height*.22).toFixed(2));glint.setAttribute('r',String(Math.min(width,height)*.2));
  }
  return shape;
}
interface SnowmanState {face:Face;armL:SVGGElement;armR:SVGGElement;hat:SVGGElement;scarf:SVGPathElement;nose:SVGPathElement;mouth:SVGPathElement}
export const snowmanDrawing: Drawing = defineDrawing<SnowmanState>({
  build(parent, seed) {
    const gradient=palette(parent,'snowman',seed),snow=gradient('#fff','#e9eeec','#a7bfbc'),tin=gradient('#c7d3d5','#879da1','#475f67');
    this.armL=svg('g',{},parent);this.armR=svg('g',{},parent);
    for(const [arm,side] of [[this.armL,-1],[this.armR,1]] as const)svg('path',{d:`M${side*13},5 Q${side*22},4 ${side*29},-2 M${side*23},2 l${side*3},-7 M${side*27},0 l${side*6},2`,fill:'none',stroke:'#8c7258','stroke-width':2.3,'stroke-linecap':'round','stroke-linejoin':'round'},arm);
    svg('ellipse',{cx:0,cy:14,rx:15,ry:14,fill:snow},parent);svg('circle',{cx:0,cy:-8,r:13,fill:snow},parent);
    this.scarf=svg('path',{d:'M-12,0 Q0,7 12,0 L11,6 Q5,10 1,8 L-1,20 -7,18 -5,8 Q-9,7 -12,5 Z',fill:'#56836c'},parent);
    svg('path',{d:'M-5,10 -6,16 M-2,10 -3,17',stroke:'#b5c9b7','stroke-width':.8,opacity:.65},parent);
    for(const y of [12,19])svg('circle',{cx:4,cy:y,r:1.8,fill:'#49595c'},parent);
    this.face=face(parent);this.nose=svg('path',{fill:gradient('#ffd28b','#d99954','#a76838')},parent);this.mouth=svg('path',{fill:'none',stroke:'#617479','stroke-width':1.2,'stroke-linecap':'round'},parent);
    this.hat=svg('g',{},parent);svg('path',{d:'M-9,-19 -11,-31 Q0,-35 11,-31 L9,-19 Z',fill:tin,stroke:'#6d858b','stroke-width':.8},this.hat);
    svg('ellipse',{cx:0,cy:-31,rx:11,ry:2.6,fill:'#c0ced1'},this.hat);svg('path',{d:'M-12,-20 H12',stroke:'#4f666d','stroke-width':2.4,'stroke-linecap':'round'},this.hat);
    svg('path',{d:'M-4,-31 v9',stroke:'#e4eeee','stroke-width':1.3,opacity:.65},this.hat);
    for(const x of [-7,7])svg('circle',{cx:x,cy:-22,r:.8,fill:'#dce4e3'},this.hat);
  },
  draw(pose,time,elapsed) {
    const frame=seasonalFrame('snowman',pose,time,elapsed);rotate(this.armL,frame.armLeft,-13,5);rotate(this.armR,frame.armRight,13,5);rotate(this.hat,frame.hat,0,-20);this.scarf.setAttribute('fill',frame.accent);
    const shape=eyes(this.face,pose,4.4,-10,3.1,3.8),x=pose.lx*.7,y=pose.ly*.4;
    this.nose.setAttribute('d',`M${x},${-7+y} L${frame.carrot*10+x*.5},${-5+y} L${x},${-3.5+y} Z`);
    this.mouth.setAttribute('d',shape==='happy'?'M-4.5,-1 Q0,4 4.5,-1':shape==='wide'?'M-2,-1 Q0,3 2,-1 Q0,-4 -2,-1':'M-4,-1 Q0,1.5 4,-1');
  },
});
interface FrostState {face:Face;pom:SVGGElement;pomColor:SVGCircleElement;mouth:SVGPathElement}
export const frostDrawing: Drawing = defineDrawing<FrostState>({
  build(parent,seed) {
    const gradient=palette(parent,'frost',seed),coat=gradient('#d79080','#ac5b50','#70413e'),fur=gradient('#fff','#eee9df','#bac8c5');
    svg('path',{d:'M-15,-13 Q-18,-32 -2,-33 Q14,-35 20,-16 L15,-11 Z',fill:coat},parent);
    svg('path',{d:'M-12,-25 Q-7,-31 -2,-31',stroke:'#e5ada0','stroke-width':1.3,'stroke-linecap':'round',fill:'none'},parent);
    svg('path',{d:'M-5,-29 -5,-22 M-8,-25 -2,-25 M-7,-27 -3,-23 M-7,-23 -3,-27',stroke:'#e6d6be','stroke-width':1,'stroke-linecap':'round'},parent);
    this.pom=svg('g',{},parent);this.pomColor=svg('circle',{cx:20,cy:-17,r:4.5,fill:fur},this.pom);svg('circle',{cx:18.5,cy:-18.4,r:1.4,fill:'#fff',opacity:.5},this.pom);
    svg('path',{d:'M-18,-13 Q-14,-16 -10,-13 Q-6,-16 -2,-13 Q2,-16 6,-13 Q10,-16 14,-13 Q18,-16 19,-12 L18,-9 H-18 Z',fill:fur},parent);
    svg('ellipse',{cx:0,cy:-1,rx:14,ry:12,fill:gradient('#f6deca','#e3bba4','#bd927e')},parent);
    for(const x of [-9,9])svg('ellipse',{cx:x,cy:2,rx:3,ry:2,fill:'#cf8a80',opacity:.75},parent);
    this.face=face(parent);
    svg('path',{d:'M-15,1 Q-18,16 -9,23 Q-5,29 0,30 Q6,27 10,23 Q18,13 15,1 Q8,10 0,8 Q-8,10 -15,1 Z',fill:fur},parent);
    svg('path',{d:'M-11,12 q3,-2 5,1 M4,12 q3,-2 5,1 M-6,20 q3,-2 5,1 M2,24 q3,-2 5,0',stroke:'#aabbb5','stroke-width':1,fill:'none','stroke-linecap':'round'},parent);
    this.mouth=svg('path',{fill:'#aa6962'},parent);svg('path',{d:'M0,4 Q-5,0 -11,4 Q-7,9 0,6 Q7,9 11,4 Q5,0 0,4',fill:fur},parent);
    svg('ellipse',{cx:0,cy:1.5,rx:3,ry:2.5,fill:'#d99b8b'},parent);svg('ellipse',{cx:-.8,cy:.7,rx:1,ry:.5,fill:'#fff',opacity:.55},parent);
  },
  draw(pose,time,elapsed) {
    const frame=seasonalFrame('frost',pose,time,elapsed),shape=eyes(this.face,pose,5,-3.5);
    this.pom.setAttribute('transform',`translate(${pose.s==='sleep'?-1:0},${frame.pom})`);this.pomColor.setAttribute('fill',frame.accent);
    this.mouth.setAttribute('d',shape==='happy'?'M-4,8 Q0,14 4,8 Z':shape==='wide'?'M-2.5,9 a2.5,2.5 0 1,0 5,0 a2.5,2.5 0 1,0 -5,0':'');
  },
});
interface BirdState {eye:SVGPathElement;glint:SVGCircleElement;wing:SVGGElement;tail:SVGPathElement;beak:SVGPathElement}
export const bullfinchDrawing: Drawing = defineDrawing<BirdState>({
  build(parent,seed) {
    const gradient=palette(parent,'bullfinch',seed),feather=gradient('#b6c5c4','#7e9394','#455d65');
    this.tail=svg('path',{d:'M13,5 29,1 26,12 15,11 Z',fill:'#536a71'},parent);
    svg('path',{d:'M-4,19 v6 M4,19 v6 M-7,25 h7 M1,25 h7',stroke:'#bc9d78','stroke-width':1.6,'stroke-linecap':'round'},parent);
    svg('ellipse',{cx:0,cy:4,rx:19,ry:17,fill:feather},parent);
    svg('path',{d:'M-18,1 Q-18,19 -2,21 Q11,21 14,10 Q3,14 -4,3 Q-10,-4 -18,1 Z',fill:gradient('#e9ac90','#c97c69','#a2514e')},parent);
    this.wing=svg('g',{},parent);svg('path',{d:'M-1,0 Q12,-4 19,5 Q14,14 0,9 Q-3,5 -1,0 Z',fill:feather},this.wing);
    svg('path',{d:'M2,4 Q10,3 15,7 M1,7 Q8,7 11,10',fill:'none',stroke:'#d2dbd5','stroke-width':1.2,'stroke-linecap':'round'},this.wing);
    svg('path',{d:'M-19,-2 Q-18,-19 -4,-19 Q8,-19 11,-8 Q-1,-12 -19,-2 Z',fill:gradient('#526766','#2f4349','#1c3038')},parent);
    svg('path',{d:'M-15,-12 Q-7,-18 1,-16',fill:'none',stroke:'#849894','stroke-width':1.1,'stroke-linecap':'round'},parent);
    this.beak=svg('path',{fill:'#33484e'},parent);this.eye=svg('path',{},parent);this.glint=svg('circle',{fill:'#fff',r:.8,opacity:.85},parent);
  },
  draw(pose,time,elapsed) {
    const frame=seasonalFrame('bullfinch',pose,time,elapsed),shape=moodEyeShape(pose.s),x=-10+pose.lx*.4,y=-4+pose.ly*.4;
    drawEye(this.eye,x,y,shape,pose.blink,'#eff0e6',3,3.7);this.glint.setAttribute('cx',String(x-.5));this.glint.setAttribute('cy',String(y-.6));this.glint.style.display=(shape==='open'||shape==='wide')&&pose.blink>.6?'':'none';
    this.beak.setAttribute('d',`M-18,-3 -26,${-frame.beak*.4} -18,${1-frame.beak*.2} Z M-18,${1+frame.beak*.4} -24,${2+frame.beak} -18,4 Z`);rotate(this.wing,frame.wing,-1,3);rotate(this.tail,frame.tail,13,5);
  },
});
interface GingerState {face:Face;armL:SVGGElement;armR:SVGGElement;mouth:SVGPathElement;button:SVGCircleElement}
export const gingerDrawing: Drawing = defineDrawing<GingerState>({
  build(parent,seed) {
    const gradient=palette(parent,'ginger',seed),dough=gradient('#dcb18a','#ba8a5f','#916447'),icing='#f4edda';
    svg('path',{d:'M-8,-4 H8 L10,9 13,22 Q12,28 6,25 L0,16 -6,25 Q-12,28 -13,22 L-10,9 Z',fill:dough,stroke:'#8e6a4f','stroke-width':.8},parent);
    this.armL=svg('g',{},parent);this.armR=svg('g',{},parent);
    for(const [arm,side] of [[this.armL,-1],[this.armR,1]] as const){svg('path',{d:`M${side*6},-3 ${side*20},-2 Q${side*27},1 ${side*22},6 L${side*7},5 Z`,fill:dough,stroke:'#8e6a4f','stroke-width':.8},arm);svg('path',{d:`M${side*17},0 l${side*2},2 ${side*2},-2 ${side*2},2`,stroke:icing,'stroke-width':1.3,fill:'none','stroke-linecap':'round'},arm);}
    svg('path',{d:'M-8,20 l2,-2 2,2 M8,20 l-2,-2 -2,2',stroke:icing,'stroke-width':1.2,fill:'none','stroke-linecap':'round'},parent);
    this.button=svg('circle',{cx:0,cy:2,r:2.2,fill:'#b87365'},parent);svg('circle',{cx:0,cy:9,r:2.2,fill:'#759276'},parent);for(const y of [2,9])svg('circle',{cx:-.6,cy:y-.7,r:.65,fill:'#f4dfc1'},parent);
    svg('circle',{cx:0,cy:-15,r:12,fill:dough,stroke:'#8e6a4f','stroke-width':.8},parent);svg('path',{d:'M-8,-20 Q0,-27 8,-20',stroke:icing,'stroke-width':1.2,fill:'none','stroke-linecap':'round'},parent);
    this.face=face(parent);this.mouth=svg('path',{stroke:icing,'stroke-width':1.5,'stroke-linecap':'round',fill:'none'},parent);
    for(const x of [-8,8])svg('ellipse',{cx:x,cy:-10,rx:2.6,ry:1.5,fill:'#d79580',opacity:.6},parent);
  },
  draw(pose,time,elapsed) {
    const frame=seasonalFrame('ginger',pose,time,elapsed);rotate(this.armL,frame.armLeft,-7,0);rotate(this.armR,frame.armRight,7,0);this.button.setAttribute('fill',pose.s==='music'||pose.s==='done'?pose.c:'#b87365');
    const shape=eyes(this.face,pose,4.2,-17,2.8,3.4,'#f4edda');this.mouth.setAttribute('d',shape==='wide'?'M-1.8,-10 a1.8,1.8 0 1,0 3.6,0 a1.8,1.8 0 1,0 -3.6,0':shape==='happy'?'M-4.5,-11 Q0,-5.5 4.5,-11':'M-4,-10 Q0,-7.5 4,-10');
  },
});
interface DeerState {face:Face;antlers:SVGGElement;earL:SVGGElement;earR:SVGGElement;bell:SVGGElement;bellColor:SVGPathElement}
export const deerDrawing: Drawing = defineDrawing<DeerState>({
  build(parent,seed) {
    const gradient=palette(parent,'deer',seed),fur=gradient('#cbb08c','#a18766','#72664f'),muzzle=gradient('#f0e0c1','#d5c5a3','#b1a082');
    this.antlers=svg('g',{},parent);for(const side of [-1,1])svg('path',{d:`M${side*6},-15 Q${side*13},-26 ${side*11},-35 M${side*11},-27 Q${side*18},-28 ${side*20},-35 M${side*11},-32 l${side*-5},-7`,stroke:'#d4c69d','stroke-width':2.6,fill:'none','stroke-linecap':'round','stroke-linejoin':'round'},this.antlers);
    this.earL=svg('g',{},parent);this.earR=svg('g',{},parent);for(const [ear,side] of [[this.earL,-1],[this.earR,1]] as const){svg('ellipse',{cx:side*15,cy:-10,rx:7,ry:3.7,fill:fur},ear);svg('ellipse',{cx:side*15.5,cy:-10,rx:4.2,ry:1.8,fill:'#d0bca1'},ear);}
    svg('path',{d:'M-13,-14 Q-16,1 -9,12 Q0,23 9,12 Q16,1 13,-14 Q0,-20 -13,-14 Z',fill:fur},parent);svg('path',{d:'M-7,-15 Q0,-10 7,-15 L4,-8 H-4 Z',fill:'#d5c4a3',opacity:.7},parent);
    svg('ellipse',{cx:0,cy:10,rx:8,ry:6.5,fill:muzzle},parent);svg('ellipse',{cx:0,cy:6.5,rx:3.7,ry:2.7,fill:'#4b5142'},parent);svg('ellipse',{cx:-1,cy:5.6,rx:1.1,ry:.7,fill:'#e1e8d3',opacity:.7},parent);
    this.face=face(parent);svg('path',{d:'M-11,17 Q0,23 11,17',stroke:'#8e4f48','stroke-width':3,fill:'none','stroke-linecap':'round'},parent);
    this.bell=svg('g',{},parent);this.bellColor=svg('path',{d:'M-3,21 Q-3,18 0,18 Q3,18 3,21 L4,26 H-4 Z',fill:'#d4b369'},this.bell);svg('path',{d:'M-1.5,25 H1.5',stroke:'#685e43','stroke-width':.8,'stroke-linecap':'round'},this.bell);svg('circle',{cx:0,cy:27,r:1.1,fill:'#c7a961'},this.bell);
  },
  draw(pose,time,elapsed) {
    const frame=seasonalFrame('deer',pose,time,elapsed);rotate(this.antlers,frame.antlers,0,-14);rotate(this.earL,-24-frame.ears,-15,-10);rotate(this.earR,24+frame.ears,15,-10);rotate(this.bell,-frame.antlers*.5,0,19);this.bellColor.setAttribute('fill',frame.accent);eyes(this.face,pose,5.5,-3,3.4,4.3);
  },
});
