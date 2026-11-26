export interface Timer {base:number;total:number;endsAt:number|null;left:number|null;doneAt:number|null;label:string}
const MIN=1000, MAX=86400000;
const duration=(value:number)=>Math.min(MAX,Math.max(MIN,Math.round(value)));
export const timerLabel=(value:unknown):string=>typeof value==='string'?value.replace(/[\r\n\t]+/g,' ').slice(0,40):'';
export function emptyTimer(base=300000,label=''):Timer {const time=duration(base);return {base:time,total:time,endsAt:null,left:null,doneAt:null,label:timerLabel(label)};}
export function startTimer(timer:Timer,now:number,base=timer.base,label=timer.label):Timer {const time=duration(base);return {...emptyTimer(time,label),endsAt:now+time};}
export function readTimer(serialized:string):Timer {
  try {
    const value=JSON.parse(serialized||'null');
    const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=MIN&&v<=MAX;
    const stamp=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>0?v:null;
    if(!value||typeof value!=='object'||!valid(value.base))return emptyTimer();
    const base=value.base,total=valid(value.total)?Math.max(base,value.total):base;
    const endsAt=stamp(value.endsAt),doneAt=stamp(value.doneAt);
    const left=typeof value.left==='number'&&Number.isFinite(value.left)&&value.left>=0&&value.left<=total?value.left:null;
    return {base,total,endsAt:doneAt===null?endsAt:null,left:doneAt===null&&endsAt===null?left:null,doneAt,label:timerLabel(value.label)};
  } catch {return emptyTimer();}
}
export function parseTimerCommand(input:string,defaultLength:number,parseDuration:(input:string)=>number|null):{length:number;label:string}|null {
  const normalized=input.replace(/\s+/g,' ').trim();
  const match=/^(?:таймер|timer|засеки|засечь)(?:\s+(?:(?:на|for)\s+)?(.+))?$/iu.exec(normalized);
  if(!match)return null;
  if(!match[1])return {length:defaultLength,label:''};
  const words=match[1].split(' ');
  for(let i=words.length;i>0;i--){const length=parseDuration(words.slice(0,i).join(' '));if(length!==null)return {length,label:timerLabel(words.slice(i).join(' ')).trim()};}
  for(let i=1;i<words.length;i++){const length=parseDuration(words.slice(i).join(' '));if(length!==null)return {length,label:timerLabel(words.slice(0,i).join(' ')).trim()};}
  return null;
}
