/* Animation contact sheet, for checking poses while authoring.
   Open the app with ?sheet=<mode> and every movement is drawn as a strip of frames sampled across one breath cycle
   (both sides for two-sided movements; both cameras for movements with a second view). Options: &ids=a,b,c
   &from=<n>&n=<count>  &cols=<frames per row>  &keys=1 draws the authored keyframes instead of samples in time. */
(()=>{const q=new URLSearchParams(location.search),mode=q.get("sheet");if(!mode)return;
 const dp=window.__dp;dp.setMode(mode);dp.player.active=true; /* pauses the hero animation */
 const md=dp.MD,from=+(q.get("from")||0),n=+(q.get("n")||999),cols=+(q.get("cols")||6),only=q.get("ids"),keys=q.get("keys");
 const box=document.createElement("div");box.style.cssText="position:fixed;inset:0;z-index:999;overflow:auto;background:var(--paper);padding:8px;display:grid;gap:10px;font:12px/1.2 system-ui;align-content:start";
 document.body.appendChild(box);
 const list=(only?only.split(",").map(id=>md.M[id]):md.moves.slice(from,from+n)).filter(Boolean);
 list.forEach(m=>{const row=document.createElement("div");row.style.cssText=`display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px`;
  const head=document.createElement("div");head.style.cssText="grid-column:1/-1";head.innerHTML=`<b>${m.name}</b> <span style="opacity:.6">${m.id} · ${m.view}${m.alt?" + "+m.alt.view:""}${m.sides?" · sides":""}</span>`;row.appendChild(head);box.appendChild(row);
  const B=md.BIN+md.BOUT,span=m.tl.kind==="tempo"?B:(m.tl.total/2)*B;
  const frames=keys?[...m.K.map((k,i)=>({p:k,ap:m.alt&&m.alt.K[i]})),...(m.sides?m.K.map((k,i)=>({p:dp.mirror(k,m.view),ap:m.alt&&dp.mirror(m.alt.K[i],m.alt.view)})):[])]
   :Array.from({length:cols},(_,i)=>{const mir=m.sides&&i>=cols/2,t=(mir?i-cols/2:i)/(m.sides?cols/2:cols)*span+(m.tl.lead?md.BIN:0);return dp.animBoth(m,t,mir)});
  frames.forEach(f=>{const c=document.createElement("canvas");c.style.cssText=`width:100%;aspect-ratio:${m.alt?1.6:1.25};background:var(--sunk);border-radius:6px`;row.appendChild(c);
   requestAnimationFrame(()=>dp.drawMove(c,m,{p:f.p,ap:f.ap},{pad:.95}))})})})();
