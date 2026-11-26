import '../frame-guard';
import { listen } from '@tauri-apps/api/event';
import { snowDensity } from '../holidays/model';

interface SnowState {enabled:boolean;amount:number;revision?:number;motion?:'auto'|'reduce'|'full'}
declare global {interface Window {__woodsSnow:{setState:(value:SnowState)=>void;status:()=>object}}}
const canvas=document.querySelector<HTMLCanvasElement>('#woods-snow')!;
const context=canvas.getContext('2d');
const motion=matchMedia('(prefers-reduced-motion: reduce)');
let enabled=false,preference:SnowState['motion']='auto',revision=-1,density=1;
let width=0,height=0,scale=1,frame=0,last=0,painted=0,paintCount=0;
interface Flake {x:number;y:number;r:number;v:number;phase:number;z:number}
let flakes:Flake[]=[];
const sprites=new Map<number,HTMLCanvasElement>();
function sprite(radius:number){
  const key=Math.round(radius*scale*2),old=sprites.get(key);if(old)return old;
  const r=Math.max(1,key/2),item=document.createElement('canvas');item.width=item.height=Math.ceil(r*4+4);
  const brush=item.getContext('2d')!;const middle=item.width/2;
  const gradient=brush.createRadialGradient(middle,middle,0,middle,middle,r*1.7);
  gradient.addColorStop(0,'rgba(248,252,255,.95)');gradient.addColorStop(.55,'rgba(239,247,255,.72)');gradient.addColorStop(1,'rgba(239,247,255,0)');
  brush.fillStyle=gradient;brush.fillRect(0,0,item.width,item.height);
  sprites.set(key,item);return item;
}
function flake(initial:boolean):Flake{
  const z=Math.random()**1.6;
  return {x:Math.random()*width,y:initial?Math.random()*height:-12-Math.random()*32,r:.8+z*2.3,v:18+z*52,phase:Math.random()*Math.PI*2,z};
}
function resize(){
  const nextWidth=window.innerWidth,nextHeight=window.innerHeight,nextScale=Math.max(1,Math.min(2,window.devicePixelRatio||1));
  if(nextWidth<=0||nextHeight<=0)return;
  const resized=nextWidth!==width||nextHeight!==height||nextScale!==scale;
  const expanded=width>0&&height>0&&(nextWidth>width*1.2||nextHeight>height*1.2);
  if(resized){
    width=nextWidth;height=nextHeight;scale=nextScale;
    const pixelWidth=Math.ceil(width*scale),pixelHeight=Math.ceil(height*scale);
    if(canvas.width!==pixelWidth)canvas.width=pixelWidth;
    if(canvas.height!==pixelHeight)canvas.height=pixelHeight;
    canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;sprites.clear();
  }
  const desired=Math.min(700,Math.round(width*height/22000*density));
  if(expanded){
    flakes=Array.from({length:desired},()=>flake(true));
  }else{
    if(flakes.length>desired)flakes=flakes.slice(0,desired);
    while(flakes.length<desired)flakes.push(flake(true));
  }
}
function mayRun(){return enabled&&preference!=='reduce'&&(preference==='full'||!motion.matches)&&!document.hidden&&!!context;}
function draw(now:number){
  frame=0;if(!mayRun()){last=0;return;}
  frame=requestAnimationFrame(draw);if(now-painted<15)return;
  if(window.innerWidth!==width||window.innerHeight!==height)resize();
  const dt=last?Math.min(.1,(now-last)/1000):0;last=now;painted=now;
  if(!context||width<=0||height<=0)return;
  context.clearRect(0,0,canvas.width,canvas.height);
  const seconds=now/1000,wind=14*Math.sin(seconds*.07)+6*Math.sin(seconds*.23+1.3);
  for(let index=0;index<flakes.length;index++){
    let item=flakes[index];item.y+=item.v*dt;item.x+=wind*item.z*dt;
    if(item.y>height+8){item=flakes[index]=flake(false);}
    if(item.x<-20)item.x+=width+40;if(item.x>width+20)item.x-=width+40;
    const x=item.x+Math.sin(item.phase+seconds*(.12+item.z*.28)*Math.PI*2)*(5+item.z*16);
    const bottom=Math.min(1,Math.max(0,(height-item.y)/(height*.125)));
    context.globalAlpha=(.35+item.z*.6)*bottom;
    const stamp=sprite(item.r);context.drawImage(stamp,x*scale-stamp.width/2,item.y*scale-stamp.height/2);
  }
  context.globalAlpha=1;paintCount++;
}
function resume(){
  if(mayRun()){
    resize();
    if(!frame){last=0;frame=requestAnimationFrame(draw);}
  }else if(frame){
    cancelAnimationFrame(frame);frame=0;last=0;
    if(!enabled||preference==='reduce')context?.clearRect(0,0,canvas.width,canvas.height);
  }
}
function accept(payload:unknown){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return;
  const value=payload as Partial<SnowState>;
  if(typeof value.revision==='number'){
    if(!Number.isSafeInteger(value.revision)||value.revision<revision)return;
    revision=value.revision;
  }
  enabled=value.enabled===true;
  preference=value.motion==='reduce'||value.motion==='full'?value.motion:'auto';
  density=snowDensity(value.amount);
  resize();
  resume();
}
window.__woodsSnow={setState:accept,status:()=>({enabled,running:frame!==0,revision,density,flakes:flakes.length,paintCount,width,height,scale})};
resize();window.addEventListener('resize',resize);document.addEventListener('visibilitychange',resume);motion.addEventListener('change',resume);
let live=true;let off:(()=>void)|undefined;
void listen<SnowState>('snow:state',event=>{if(live)accept(event.payload);}).then(async unsubscribe=>{
  off=unsubscribe;if(!live){off();return;}
  const state=await window.__TAURI_INTERNALS__.invoke('snow_state');if(live)accept(state);
}).catch(()=>{});
window.addEventListener('pagehide',()=>{live=false;off?.();enabled=false;resume();},{once:true});
