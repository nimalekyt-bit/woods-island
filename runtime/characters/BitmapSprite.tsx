import { React } from '../react';
import type { CharacterSpriteProps } from './CharacterSprite';
import { createBitmapTimeline, spritePosition, lookCell, codexLookCell } from './bitmap';
import { getCursor, normalizedLook } from './cursor';
import { subscribeAnimationFrames, STILL_INTERVAL_MS, refreshCharacterScheduler } from './scheduler';
import { localPetAsset, usePetLibrary } from './pet-library';
import { bitmapAssets } from './bitmap-assets';

export function BitmapSprite({definition,mood='idle',width,height,look=0,still=false,className=''}: CharacterSpriteProps) {
  const spec = definition.bitmap!;
  const root = React.useRef<HTMLDivElement>(null), art = React.useRef<HTMLDivElement>(null), face = React.useRef<HTMLDivElement>(null);
  const props = React.useRef({mood,look,still}); props.current = {mood,look,still};
  const repaint = React.useRef<((time: number) => void) | null>(null);
  const [visible,setVisible] = React.useState(false);
  const [sheet,setSheet] = React.useState<string | null>(null);
  const [loadError,setLoadError] = React.useState<string | null>(null);
  const library = usePetLibrary();
  const entry = library.pets.find(pet => pet.id === spec.file);
  const available = spec.source === 'woods' || entry?.available === true;
  React.useEffect(() => {
    const node = root.current; if (!node) return;
    const observer = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)), {rootMargin:'40px'});
    observer.observe(node); return () => observer.disconnect();
  },[]);
  React.useEffect(() => {
    let disposed = false; setSheet(null); setLoadError(null);
    if (!visible || !available) return;
    const source = spec.source === 'woods' ? Promise.resolve(bitmapAssets[definition.id].full) : localPetAsset(spec.file);
    void source.then(async url => {
      const urls = spec.source === 'woods' && spec.look ? Object.values(bitmapAssets[definition.id]) : [url];
      await Promise.all(urls.map(async source => { const image = new Image(); image.src=source; await image.decode(); }));
      if (!disposed) setSheet(url);
    }).catch(error => { if (!disposed) setLoadError(String(error)); });
    return () => { disposed = true; };
  },[definition,visible,available,entry]);
  React.useEffect(() => {
    const element = root.current, body = art.current, overlay = face.current;
    if (!element || !body || !sheet || !visible) return;
    let gazeX=0,gazeY=0;
    const timeline=createBitmapTimeline(spec);
    const custom=spec.source==='woods'?bitmapAssets[definition.id]:null;
    const paint=(time:number)=>{
      const current=props.current;
      const result=timeline.frame(time,current.mood,current.still),state=result.state;
      const dt=result.delta;
      let frame=result.frame;
      const point=getCursor(),rect=element.getBoundingClientRect();
      const desired=current.mood==='sleep'||current.still?[0,0]:point?normalizedLook(point.x-rect.left-rect.width/2,point.y-rect.top-rect.height/2):[current.look*4,0];
      const ease=current.still?1:1-Math.exp(-dt/75);
      gazeX+=(desired[0]/4-gazeX)*ease;gazeY+=(desired[1]/3-gazeY)*ease;
      const awake=current.mood!=='sleep'&&!current.still;
      const useOverlay=!!custom&&!!spec.look&&!!frame.lookGroup&&spec.look.states.includes(result.renderState);
      body.style.backgroundImage=`url("${useOverlay?custom!.body:sheet}")`;
      if (spec.source==='codex'&&current.mood==='idle'&&awake&&Math.hypot(gazeX,gazeY)>.04) frame={...frame,...codexLookCell(gazeX,gazeY)};
      body.style.backgroundPosition=spritePosition(frame,spec);
      element.dataset.petFrame=`${frame.rowIndex}:${frame.columnIndex}`;element.dataset.petState=state;
      element.dataset.petAnimation=result.renderState;
      element.dataset.petLook=awake?`${gazeX.toFixed(3)},${gazeY.toFixed(3)}`:'off';
      if (overlay) {
        overlay.hidden=!useOverlay;
        if (useOverlay) {
          const cell=lookCell(awake?gazeX:0,awake?gazeY:0,spec.look!.groups[frame.lookGroup!].rowOffset);
          overlay.style.backgroundImage=`url("${custom!.look}")`;
          overlay.style.backgroundPosition=spritePosition(cell,spec.look!);
          overlay.style.left=`${(frame.lookOffset?.x??0)/spec.frameWidth*100}%`;overlay.style.top=`${(frame.lookOffset?.y??0)/spec.frameHeight*100}%`;
          overlay.dataset.petLookFrame=`${cell.rowIndex}:${cell.columnIndex}`;
        } else { delete overlay.dataset.petLookFrame; }
      }
    };
    repaint.current=paint;paint(performance.now());
    const stop=subscribeAnimationFrames(paint,()=>props.current.still?STILL_INTERVAL_MS:33);
    return ()=>{repaint.current=null;stop();};
  },[definition,sheet,visible]);
  React.useEffect(()=>{repaint.current?.(performance.now());refreshCharacterScheduler();},[mood,still,look]);
  const scale=Math.min(width/spec.frameWidth,height/spec.frameHeight)*.94;
  const status=loadError?'error':sheet?'ready':available?'loading':library.status==='loading'?'loading':'unavailable';
  return <div ref={root} data-character={definition.id} data-character-mood={mood} data-bitmap-character data-pet-availability={status}
    className={`grid shrink-0 place-items-center ${className}`} style={{width,height}} aria-hidden>
    {sheet&&<div ref={art} data-bitmap-art style={{position:'relative',width:spec.frameWidth*scale,height:spec.frameHeight*scale,
      backgroundSize:`${spec.columns*100}% ${spec.rows*100}%`,backgroundRepeat:'no-repeat',imageRendering:spec.source==='woods'?'pixelated':'auto'}}>
      {spec.look&&<div ref={face} data-bitmap-face style={{position:'absolute',width:'100%',height:'100%',pointerEvents:'none',
        backgroundSize:`${spec.look.columns*100}% ${spec.look.rows*100}%`,backgroundRepeat:'no-repeat',imageRendering:'pixelated'}}/>}
    </div>}
  </div>;
}
