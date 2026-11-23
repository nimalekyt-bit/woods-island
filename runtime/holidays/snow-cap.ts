/** Rounded, bounded snow drifts. The slowly shifting profile settles and melts. */
export function snowCapPath(width: number, seconds = 0, density = 1): string {
  const w=Math.max(16,Number.isFinite(width)?width:16);
  const time=Number.isFinite(seconds)?seconds:0;
  const depth=Math.max(.6,Math.min(1.8,Number.isFinite(density)?Math.sqrt(density):1));
  const count=Math.max(6,Math.min(24,Math.round(w/28))),step=(w-12)/count;
  const points=Array.from({length:count+1},(_,index)=>{
    const x=6+index*step;
    const edge=Math.sin(Math.PI*index/count);
    const drift=(2.2+1.1*Math.sin(index*1.7+time*.018)+.6*Math.sin(index*.65-time*.037))*depth;
    return {x,y:6-(.8+drift)*(.3+.7*Math.sqrt(Math.max(0,edge)))};
  });
  const p=(value:number)=>value.toFixed(2);
  let result=`M${p(points[0].x)},${p(points[0].y)}`;
  for(let index=0;index<count;index++){
    const before=points[Math.max(0,index-1)],start=points[index],end=points[index+1],after=points[Math.min(count,index+2)];
    result+=` C${p(start.x+(end.x-before.x)/6)},${p(start.y+(end.y-before.y)/6)} ${p(end.x-(after.x-start.x)/6)},${p(end.y-(after.y-start.y)/6)} ${p(end.x)},${p(end.y)}`;
  }
  return `${result} Q${p(w-3)},7 ${p(w-6)},8 Q${p(w/2)},10 6,8 Q3,7 ${p(points[0].x)},${p(points[0].y)} Z`;
}
