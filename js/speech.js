/* Everything the coach can say, in one place. The app speaks through these functions, and tools/speech-lines.mjs
   calls lines() to list every sentence so each one can be pre-recorded. A sentence with no recording falls back
   to the device voice. */
"use strict";
const SPEECH=(()=>{
 const split=text=>String(text).split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(Boolean);
 /* FNV-1a: a short, stable file name for each sentence */
 const key=s=>{let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)}return(h>>>0).toString(16).padStart(8,"0")};
 const SPRING={H:{name:"heavy",color:"red",hex:"#D0453A"},M:{name:"medium",color:"green",hex:"#3E9A5B"},L:{name:"light",color:"blue",hex:"#3D73C4"},X:{name:"extra light",color:"yellow",hex:"#E0B23A"}};
 function springText(m,mode,speech){mode=mode||"level";
  const parts=m.springs.map(([n,k])=>{const s=SPRING[k];const t=mode==="color"?s.color:mode==="both"?(speech?`${s.name} ${s.color}`:`${s.name} (${s.color})`):s.name;return`${n} ${t}`});
  return speech?parts.join(" plus ")+(m.springs.reduce((a,[n])=>a+n,0)>1?" springs":" spring"):parts.join(" + ")}
 const intro=(m,first,springMode)=>`${first?"First":"Next"}: ${m.name}.`+(m.springs?` Springs: ${springText(m,springMode,true)}.`:"")+` ${m.setup}`;
 const begin=sides=>"Begin."+(sides?" First side.":"");
 const SWITCH="Switch sides. Take a breath as you change.";
 const tenNext=name=>`Ten seconds. Next, ${name}.`;
 const next=name=>`Next, ${name}.`;
 const LAST="Last ten seconds. Stay soft, and keep breathing.";
 const RETURN="Gently let your attention return to the room.";
 const ARRIVE_BREATH=["Breathe in.","And slowly out.","In.","And out."];
 /* breath words: spoken more slowly than the cues */
 function breathWord(lab,first,sound,opening,sides){let w=lab==="in"?(first?"Breathe in":"In"):(sound?`Out, ${sound}`:first?"Breathe out":"Out");
  if(opening)w=`Begin${sides?", first side":""}. ${w}`;return w}
 const SLOW=new Set(["Breathe in","In","Breathe out","Out","Begin.","Begin, first side.",...ARRIVE_BREATH]);
 const isSlow=s=>SLOW.has(s)||/^Out, /.test(s);
 /* every sentence a mode can speak */
 function lines(mode){const L=new Set(),put=t=>split(t).forEach(s=>L.add(s));
  put(mode.arrive);put(mode.finish);ARRIVE_BREATH.forEach(put);[SWITCH,LAST,RETURN,begin(false),begin(true)].forEach(put);
  Object.values(mode.presence).flat().forEach(put);
  mode.moves.forEach(m=>{(mode.springs?["level","color","both"]:[null]).forEach(sm=>{put(intro(m,true,sm));put(intro(m,false,sm))});
   m.cues.forEach(put);put(tenNext(m.name));put(next(m.name));
   ["in","out"].forEach(lab=>[true,false].forEach(first=>[true,false].forEach(op=>[true,false].forEach(sd=>put(breathWord(lab,first,m.sound,op,sd))))))});
  return[...L]}
 return{split,key,SPRING,springText,intro,begin,SWITCH,tenNext,next,LAST,RETURN,ARRIVE_BREATH,breathWord,isSlow,lines}})();
if(typeof module!=="undefined")module.exports=SPEECH;
