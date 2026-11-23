import { React } from '../react';
import { holidayPolicy, type HolidaySettings } from './model';
import { snowCapPath } from './snow-cap';
import './holidays.css';

export function useHolidayClock() {
  const [date, setDate] = React.useState(() => new Date());
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const now = new Date();setDate(now);
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(tick, Math.max(1000, next.getTime() - now.getTime() + 50));
    };
    tick();
    const resume = () => { if (!document.hidden) { clearTimeout(timer);tick(); } };
    document.addEventListener('visibilitychange',resume);
    return () => {clearTimeout(timer);document.removeEventListener('visibilitychange',resume);};
  }, []);
  return date;
}
export function useReducedMotion() {
  const [reduced, setReduced] = React.useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  React.useEffect(() => {
    const media=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduced(media.matches);
    media.addEventListener('change',change);change();
    return () => media.removeEventListener('change',change);
  },[]);
  return reduced;
}
interface Flake {x:number;y:number;r:number;v:number;phase:number;side?:boolean}
const colors=['#f87878','#efcc72','#72d5af','#82b5ff'];
const finiteLevel=(value:number)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
export function HolidayEffects({settings,width:targetWidth,height:targetHeight,capsule,visible,musicLevel=0,still=false,falling=true}: {
  settings:HolidaySettings;width:number;height:number;capsule:boolean;visible:boolean;musicLevel?:number;still?:boolean;falling?:boolean;
}) {
  const date=useHolidayClock(),systemReduced=useReducedMotion();
  const reducedMotion=still||settings.reducedMotion==='reduce'||settings.reducedMotion!=='full'&&systemReduced;
  const selection=holidayPolicy(settings,{date,visible,capsule,reducedMotion});
  const policy={...selection,fall:selection.fall&&falling};
  const container=React.useRef<HTMLDivElement>(null);
  const [measured,setMeasured]=React.useState<{width:number;height:number}|null>(null);
  React.useLayoutEffect(()=>{
    const parent=container.current?.parentElement;
    if(!parent||!policy.active)return;
    // Observe the actual animated pill rather than drawing the target size early.
    const observer=new ResizeObserver(entries=>{
      const rect=entries[0]?.contentRect;
      if(rect&&rect.width>0&&rect.height>0)setMeasured(previous=>previous&&Math.abs(previous.width-rect.width)<.05&&Math.abs(previous.height-rect.height)<.05?previous:{width:rect.width,height:rect.height});
    });
    observer.observe(parent);return ()=>observer.disconnect();
  },[policy.active]);
  const width=measured?.width??targetWidth,height=measured?.height??targetHeight;
  const live=React.useRef({width,height,policy,musicLevel});
  live.current={width,height,policy,musicLevel};
  const canvas=React.useRef<HTMLCanvasElement>(null),cap=React.useRef<SVGPathElement>(null);
  const lights=React.useRef<SVGGElement>(null);
  const count=Math.max(8,Math.min(38,Math.round(width/22))),radius=Math.min(height/2,26);
  const bulbs=Array.from({length:count},(_,index)=>{
    const x=8+(width-16)*index/(count-1);
    const edge=Math.min(x,width-x);
    const y=height+5-(edge<radius?radius-Math.sqrt(Math.max(0,radius*radius-(radius-edge)**2)):0);
    return {x,y,color:colors[index%colors.length]};
  });
  React.useEffect(()=>{
    const node=canvas.current,context=node?.getContext('2d');
    if(!node||!context)return;
    let frame=0,last=0,rendered=0,oldWidth=live.current.width,music=0;
    let flakes:Flake[]=[];
    const create=(w:number,y:number):Flake=>({x:4+Math.random()*Math.max(1,w-8),y,r:.8+Math.random()*1.8,v:13+Math.random()*22,phase:Math.random()*6.28});
    const draw=(now:number)=>{
      frame=requestAnimationFrame(draw);
      if(document.hidden){last=0;return;}
      if(now-rendered<32)return;
      const dt=last?Math.min(.1,(now-last)/1000):0;last=now;rendered=now;
      const {width:w,height:h,policy:p,musicLevel:level}=live.current;
      const scale=Math.min(2,window.devicePixelRatio||1),bottom=p.fall?90:8;
      const pixelW=Math.ceil(w*scale),pixelH=Math.ceil((h+bottom+10)*scale);
      if(node.width!==pixelW||node.height!==pixelH){node.width=pixelW;node.height=pixelH;}
      context.setTransform(scale,0,0,scale,0,0);context.clearRect(0,0,w,h+bottom+10);
      if(p.fall){
        const wanted=Math.round(w/18*p.density);
        if(flakes.length>wanted+24)flakes=flakes.slice(0,wanted+24);
        while(flakes.length<wanted)flakes.push(create(w,h+8+Math.random()*75));
        if(p.cap&&w<oldWidth-5){
          for(let i=0;i<Math.min(16,Math.round((oldWidth-w)/10));i++)flakes.push({...create(w,5),x:i%2?Math.max(4,w-4):4,side:true});
        }
        for(let i=flakes.length-1;i>=0;i--){
          const flake=flakes[i];flake.y+=flake.v*dt;
          if(flake.y>h+90){if(flake.side){flakes.splice(i,1);continue;}flakes[i]=create(w,h+8);continue;}
          flake.x=Math.max(3,Math.min(w-3,flake.x));
          const alpha=Math.max(0,1-Math.max(0,flake.y-h)/90)*.65;
          context.beginPath();context.arc(flake.x+Math.sin(now*.0004+flake.phase)*2,flake.y,flake.r,0,Math.PI*2);
          context.fillStyle=`rgba(239,247,255,${alpha})`;context.fill();
        }
      }else flakes=[];
      oldWidth=w;
      if(cap.current&&p.cap)cap.current.setAttribute('d',snowCapPath(w,now/1000,p.density));
      music+= (finiteLevel(level)-music)*Math.min(1,dt*10);
      if(lights.current){
        const children=Array.from(lights.current.children);
        children.forEach((bulb,index)=>{
          const phase=p.garland==='wave'?now*.003-index*.65:now*.002+index*2.4;
          const brightness=p.animateGarland?(p.garland==='music'?.38+music*.62:.3+.7*(Math.sin(phase)*.5+.5)):.7;
          bulb.setAttribute('opacity',brightness.toFixed(3));
        });
      }
    };
    if(policy.active&&!reducedMotion)frame=requestAnimationFrame(draw);
    return ()=>{cancelAnimationFrame(frame);context.clearRect(0,0,node.width,node.height);};
  },[policy.active,reducedMotion,policy.fall,policy.cap,policy.garland]);
  if(!policy.active)return null;
  return <div ref={container} data-holiday-effects data-snow-bottom={policy.fall?90:8} className="wi-holiday-effects" aria-hidden="true">
    <canvas ref={canvas} style={{width,height:height+(policy.fall?90:8)+10}} />
    <svg width={width} height={height+10} viewBox={`0 0 ${width} ${height+10}`}>
      {policy.cap&&<path ref={cap} data-snow-cap d={snowCapPath(width,0,policy.density)} fill="#eef7ff" opacity=".92"/>}
      {policy.garland!=='off'&&<>
        <path d={`M8,${height+7-radius} Q8,${height+5} ${radius},${height+5} H${width-radius} Q${width-8},${height+5} ${width-8},${height+7-radius}`} stroke="#66776c" strokeWidth=".8" fill="none" opacity=".7"/>
        <g ref={lights} data-garland={policy.garland}>
          {bulbs.map((bulb,index)=><g key={index} opacity=".7"><circle cx={bulb.x} cy={bulb.y} r="4.8" fill={bulb.color} opacity=".12"/><ellipse cx={bulb.x} cy={bulb.y+1.4} rx="1.8" ry="2.4" fill={bulb.color}/></g>)}
        </g>
      </>}
    </svg>
  </div>;
}
