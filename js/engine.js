/* Daily Practice engine: shared by every mode (Movement, Pilates, Yoga, Strength).
   Each mode file in js/modes/ supplies its movements, routines, weekly themes and coaching text. */
(()=>{
"use strict";
/* ---------------- storage (per-viewer convenience) ---------------- */
const store={get(k,d){try{const v=localStorage.getItem("dp."+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem("dp."+k,JSON.stringify(v))}catch(e){}}};
/* bring over the practice logs of Daily Move and Daily Reformer (same origin), once */
(function migrate(){if(store.get("migrated",false))return;const h=[];
 [["dm.history","movement"],["dr.history","pilates"]].forEach(([k,m])=>{try{(JSON.parse(localStorage.getItem(k)||"[]")||[]).forEach(x=>h.push(Object.assign({m},x)))}catch(e){}});
 if(h.length){h.sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:0);store.set("history",[...h,...store.get("history",[])].slice(-800))}store.set("migrated",true)})();
const settings=Object.assign({voice:true,bell:true,breath:true,springs:"level",lenFor:{},mode:"movement",dailyLen:"standard",voiceKind:"natural"},store.get("settings",{}));
const saveSettings=()=>store.set("settings",settings);

/* ---------------- modes ---------------- */
const MODES=window.MODES;const MODE_BY=Object.fromEntries(MODES.map(x=>[x.id,x]));
const urlMode=new URLSearchParams(location.search).get("mode")||location.hash.slice(1);
if(MODE_BY[urlMode])settings.mode=urlMode;
let MD=MODE_BY[settings.mode]||MODES[0],M=MD.M;

/* ---------- pose math ---------- */
const ease=u=>.5-.5*Math.cos(Math.PI*u);
function lerpPose(a,b,u){const o={};for(const k in a){const x=a[k],y=b[k];if(typeof x==="number")o[k]=x+((y??x)-x)*u;else if(Array.isArray(x)&&Array.isArray(y))o[k]=x.map((v,i)=>v+(y[i]-v)*u);else o[k]=u<.5||y===undefined?x:y}return stepArc(o,a,b,u)}
/* a foot or hand that moves along the floor lifts and steps instead of sliding */
function stepArc(o,a,b,u){for(const k of["fL","fR","hL","hR"]){const x=a[k],y=b[k];if(Array.isArray(x)&&Array.isArray(y)&&x[1]<=7&&y[1]<=7){const d=Math.abs(y[0]-x[0]);if(d>12)o[k]=[o[k][0],o[k][1]+Math.sin(Math.PI*Math.max(0,Math.min(1,u)))*Math.min(15,d*.17)]}}return o}
/* smooth motion through several keyframes: cubic Hermite with Catmull-Rom tangents, at rest at both ends */
function hermite(P,T,tau,cyclic){const n=P.length-1;let j=0;while(j<n-1&&tau>T[j+1])j++;const h=T[j+1]-T[j]||1,s=Math.max(0,Math.min(1,(tau-T[j])/h));
 const h00=2*s*s*s-3*s*s+1,h10=s*s*s-2*s*s+s,h01=-2*s*s*s+3*s*s,h11=s*s*s-s*s;
 const tan=(i,get)=>{if(!cyclic&&(i===0||i===n))return 0;const a=cyclic&&i===0?n-1:i-1,b=cyclic&&i===n?1:i+1,ta=cyclic&&i===0?T[n-1]-T[n]:T[a],tb=cyclic&&i===n?T[n]+T[1]:T[b];
  const va=get(P[a]),vb=get(P[b]);return typeof va==="number"&&typeof vb==="number"?(vb-va)/(tb-ta):0};
 const A=P[j],B=P[j+1],o={};
 for(const k in A){const x=A[k],y=B[k];
  if(typeof x==="number"&&typeof y==="number")o[k]=h00*x+h10*h*tan(j,p=>p[k])+h01*y+h11*h*tan(j+1,p=>p[k]);
  else if(Array.isArray(x)&&Array.isArray(y))o[k]=x.map((v,i)=>h00*v+h10*h*tan(j,p=>Array.isArray(p[k])?p[k][i]:undefined)+h01*y[i]+h11*h*tan(j+1,p=>Array.isArray(p[k])?p[k][i]:undefined));
  else o[k]=s<.5||y===undefined?x:y}
 return stepArc(o,A,B,s)}
function mirror(p,view){const q=Object.assign({},p);const sw=(a,b)=>{const t=q[a];q[a]=q[b];q[b]=t};
 ["ua","la","th","sh","f","k","sua","sla","fc","ft","h","eh","hc"].forEach(n=>sw(n+"L",n+"R"));
 if(view==="front"){["uaL","laL","uaR","laR","thL","shL","thR","shR"].forEach(n=>{if(q[n]!=null)q[n]=-q[n]});
  ["fL","fR","kL","kR","hL","hR","ehL","ehR"].forEach(n=>{if(q[n])q[n]=[-q[n][0],q[n][1]]});q.hx=-q.hx;q.px=-q.px;q.face=-q.face;q.torso=360-q.torso;q.neck=360-q.neck;q.arch=-q.arch}
 return q}
function locate(m,t){let x=((t%m.C)+m.C)%m.C,i=0;while(i<m.beats.length-1&&x>m.beats[i]){x-=m.beats[i];i++}return{i,x}}
function poseAt(m,t,mir){const{i,x}=locate(m,t);const n=m.K.length;const u=ease(Math.min(1,x/m.beats[i]));let p=lerpPose(m.K[i],m.K[(i+1)%n],u),nx=m.K[(i+1)%n];if(mir){p=mirror(p,m.view);nx=mirror(nx,m.view)}return{p,nx}}
/* ---------- one breath for the whole session ----------
   Each mode sets its own steady breath (in BIN seconds, out BOUT seconds). Every part of a session (arrival,
   transitions, each movement and each side) lasts a whole number of breaths and starts on an in-breath, so the
   rhythm never breaks; every movement is animated from this clock. */
function breathPhase(t,md=MD){const B=md.BIN+md.BOUT,r=((t%B)+B)%B,inh=r<md.BIN;return{lab:inh?"in":"out",prog:inh?r/md.BIN:(r-md.BIN)/md.BOUT,rem:inh?md.BIN-r:B-r,n:Math.floor(t/B)}}
/* map each movement's keyframes onto in- and out-breaths. Holds and long stretches breathe through one full breath. */
function buildTimeline(m){const n=m.beats.length,L=m.breath,BREATH=m.mode.BIN+m.mode.BOUT;
 if(m.fixedPace||L.every(x=>x==="flow")){const N=Math.max(1,Math.round(BREATH/m.C));m.tl={kind:"tempo",rate:m.C*N/BREATH,per:N,smooth:!m.fixedPace&&m.K.length>2};return}
 const lab=L.every(x=>x==="soft"||x==="still")?L.map((x,i)=>i%2?"out":"in"):L;
 const groups=[];for(let i=0;i<n;){const l=lab[i],tr=[];while(i<n&&lab[i]===l){tr.push(i);i++}groups.push({l,tr,w:tr.map(q=>m.beats[q])})}
 let next=null;const G=groups.map(g=>{const breathy=g.l==="in"||g.l==="out";let ty=breathy?(next&&g.l!==next?next:g.l):(next||"in");const types=[];
  for(let k=0;k<(breathy?1:2);k++){types.push(ty);ty=ty==="in"?"out":"in"}next=ty;return{types,tr:g.tr,w:g.w}});
 if(G.reduce((a,g)=>a+g.types.length,0)%2)G[G.length-1].types.push(next); /* whole breaths per cycle */
 m.tl={kind:"breath",G,lead:G[0].types[0]==="out"?1:0,total:G.reduce((a,g)=>a+g.types.length,0)}}
function animPose(m,t,mir){const tl=m.tl,BIN=m.mode.BIN,BOUT=m.mode.BOUT,BREATH=BIN+BOUT,n=m.K.length;let p,nx;
 if(tl.kind==="tempo"){
  if(!tl.smooth)return poseAt(m,t*tl.rate,mir);
  /* flowing movements glide through their keyframes without stopping at each one */
  const T=[0];m.beats.forEach(b=>T.push(T[T.length-1]+b));const x=(((t*tl.rate)%m.C)+m.C)%m.C;
  p=hermite([...m.K,m.K[0]],T,x,true);let i=0;while(i<n-1&&x>T[i+1])i++;nx=m.K[(i+1)%n]}
 else{const r=((t%BREATH)+BREATH)%BREATH,j=2*Math.floor(t/BREATH)+(r<BIN?0:1),u=r<BIN?r/BIN:(r-BIN)/BOUT;
  if(j<tl.lead){p=m.K[0];nx=m.K[1%n]} /* a movement that starts on an out-breath settles through the first in-breath */
  else{let q=(j-tl.lead)%tl.total,gi=0;while(q>=tl.G[gi].types.length){q-=tl.G[gi].types.length;gi++}
   const g=tl.G[gi],dur=g.types.map(x=>x==="in"?BIN:BOUT);let el=u*dur[q];for(let k=0;k<q;k++)el+=dur[k];
   /* one smooth rise and settle per breath, passing through any in-between keyframes without a stop */
   const W=g.w.reduce((a,c)=>a+c,0),tau=ease(el/dur.reduce((a,c)=>a+c,0))*W;
   const P=[...g.tr.map(i=>m.K[i]),m.K[(g.tr[g.tr.length-1]+1)%n]],T=[0];g.w.forEach(w=>T.push(T[T.length-1]+w));
   p=P.length===2?lerpPose(P[0],P[1],tau/W):hermite(P,T,tau,false);nx=P[P.length-1]}}
 if(mir){p=mirror(p,m.view);nx=mirror(nx,m.view)}return{p,nx}}
/* a movement lasts a whole number of breaths; each side of a two-sided movement gets the same whole number */
const quant=(id,s,md=MD)=>{const B=md.BIN+md.BOUT,unit=md.M[id].sides?2*B:B;return Math.max(1,Math.round(s/unit))*unit};
const overhead=(r,md=MD)=>(r.items.length>1?md.ARRIVE:0)+md.PREP_FIRST+(r.items.length-1)*md.PREP;
const routineSecs=(r,md=MD)=>r.items.reduce((a,[id,s])=>a+quant(id,s,md),0)+overhead(r,md);
/* fit a routine into a chosen number of minutes by scaling every movement's time by the same factor */
function scaleRoutine(r,min){const moveT=r.items.reduce((a,[,s])=>a+s,0),f=Math.max(.15,(min*60-overhead(r))/moveT);
 return Object.assign({},r,{items:r.items.map(([id,s])=>[id,Math.max(M[id].sides?30:20,Math.round(s*f/5)*5)])})}
const fmtMin=s=>Math.max(1,Math.round(s/60));
const fmt=s=>{s=Math.max(0,Math.ceil(s));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")};

/* ---------- solving a pose into joint positions ---------- */
const dir=a=>[Math.sin(a*D),-Math.cos(a*D)]; // y-up world, 0° = down, 90° = right
const add=(p,v,s)=>[p[0]+v[0]*s,p[1]+v[1]*s];
const angOf=v=>Math.atan2(v[0],-v[1])/D;
/* two-bone IK with unequal lengths; hint picks which way the middle joint bends */
function ik2(a,b,l1,l2,hint){let dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy);const mx=l1+l2-.01;
 if(d>mx){b=[a[0]+dx/d*mx,a[1]+dy/d*mx];dx=b[0]-a[0];dy=b[1]-a[1];d=mx}d=Math.max(d,Math.abs(l1-l2)+.5);
 const ux=dx/d,uy=dy/d,along=(l1*l1-l2*l2+d*d)/(2*d),h=Math.sqrt(Math.max(0,l1*l1-along*along));
 const m=[a[0]+ux*along,a[1]+uy*along],c1=[m[0]-uy*h,m[1]+ux*h],c2=[m[0]+uy*h,m[1]-ux*h];
 const s1=(c1[0]-m[0])*hint[0]+(c1[1]-m[1])*hint[1],s2=(c2[0]-m[0])*hint[0]+(c2[1]-m[1])*hint[1];
 return{k:s1>=s2?c1:c2,an:b}}
function solveBody(p,view,machine){const side=view!=="front",S={};let hy=p.hy;
 const hjx=s=>p.hx+(side?0:(s==="L"?-LEN.hipW:LEN.hipW));
 /* standing feet keep the hips low enough for the legs to reach the ground */
 if(!machine)["L","R"].forEach(s=>{const f=p["f"+s];if(p["th"+s]==null&&f&&f[1]<=.5){const dx=f[0]-hjx(s);hy=Math.min(hy,Math.sqrt(Math.max(0,79.6*79.6-dx*dx))+f[1])}});
 const hip=[p.hx,hy];S.hip=hip;const tl=LEN.torso*(p.tls??1)*(1+.024*(p.br||0)); /* tls foreshortens a torso leaning toward the viewer */ /* the chest rises a little on each in-breath */
 const td=dir(p.torso);S.nb=add(hip,td,tl);S.td=td;
 const perp=[-td[1],td[0]];const mid=add(hip,td,tl/2);S.ctrl=add(mid,perp,(p.arch||0)*2);
 const r=[td[1],-td[0]];const sb=add(S.nb,td,-3);
 S.shL=side?sb:add(sb,r,-LEN.shW);S.shR=side?sb:add(sb,r,LEN.shW);
 const nd=dir(p.neck);S.ne=add(S.nb,nd,LEN.neck);S.head=add(S.ne,nd,LEN.head);S.nd=nd;
 ["L","R"].forEach(s=>{
  if(p["h"+s]){const o=ik2(S["sh"+s],p["h"+s],LEN.ua,LEN.la,p["eh"+s]||[0,-1]);S["el"+s]=o.k;S["ha"+s]=o.an}
  else{S["el"+s]=add(S["sh"+s],dir(p["ua"+s]),LEN.ua*(p["sua"+s]??1));S["ha"+s]=add(S["el"+s],dir(p["la"+s]),LEN.la*(p["sla"+s]??1))}
  const hj=[hjx(s),hy];S["hj"+s]=hj;let kn,an,fk=p["th"+s]!=null;
  if(fk){kn=add(hj,dir(p["th"+s]),LEN.th);an=add(kn,dir(p["sh"+s]),LEN.sh)}else{const o=ik2(hj,p["f"+s],LEN.th,LEN.sh,p["k"+s]||[1,.1]);kn=o.k;an=o.an}
  S["kn"+s]=kn;S["an"+s]=an;const sa=angOf([an[0]-kn[0],an[1]-kn[1]]);let toe;
  const out=side?1:(s==="L"?-1:1),fl=side?10:7;
  if(p["ft"+s]!=null)toe=add(an,dir(p["ft"+s]),fl);
  else if(machine)toe=Math.abs(sa)>=50?add(an,dir(sa),fl):add(an,dir(sa+90),fl);
  else if(!fk&&Math.abs(sa)<50&&an[1]<fl-.5)toe=[an[0]+out*Math.sqrt(fl*fl-an[1]*an[1]),0]; /* foot flat on the ground */
  else if(!fk&&Math.abs(sa)>=50)toe=add(an,dir(sa),fl);
  else toe=add(an,dir(side?sa+90:sa+out*75),fl);
  S["to"+s]=toe});
 S.dan=add(hip,td,13);S.face=p.face||1;return S}
/* Reformer: parts riding on the carriage move with it; a figure facing the risers is solved facing right and mirrored */
function solve(p,view,machine){
 if(!machine)return solveBody(p,view,false);
 const c=p.car||0;
 if(p.flip){const S=solveBody(Object.assign({},p,{car:0}),view,true);for(const k in S){const v=S[k];if(k!=="nd"&&k!=="td"&&Array.isArray(v))S[k]=[2*p.fx-v[0]-c,v[1]]}S.nd=[-S.nd[0],S.nd[1]];S.face=-1;return S}
 const q=Object.assign({},p,{hx:p.hx-(p.hc?c:0)});
 if(p.fL)q.fL=[p.fL[0]-(p.fcL?c:0),p.fL[1]];if(p.fR)q.fR=[p.fR[0]-(p.fcR?c:0),p.fR[1]];
 if(p.hL)q.hL=[p.hL[0]-(p.hcL?c:0),p.hL[1]];if(p.hR)q.hR=[p.hR[0]-(p.hcR?c:0),p.hR[1]];
 return solveBody(q,view,true)}
const solveM=(m,p)=>solve(p,m.view,m.mode.scene==="reformer");

/* ---------- framing: each movement gets a steady camera that fits all of its poses ---------- */
function frameOf(m){if(m.frame)return m.frame;let x0=1e9,x1=-1e9,y0=0,y1=-1e9;const pt=(x,y)=>{x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)};
 const poses=[...m.K,...(m.sides?m.K.map(k=>mirror(k,m.view)):[])];
 poses.forEach(k=>{const S=solveM(m,k);for(const key in S){const v=S[key];if(Array.isArray(v)&&key!=="nd"&&key!=="td")pt(v[0],v[1])}pt(S.head[0]-12,S.head[1]+12);pt(S.head[0]+12,S.head[1]-12)});
 const sc=m.mode.scene;
 if(sc==="reformer"){pt(-132,0);pt(132,0);pt(0,84)}
 if(m.prop){const pr=m.prop,xs=[pr.x||0,-(pr.x||0)];if(pr.type==="rail")xs.forEach(x=>{pt(x-20,pr.h);pt(x+42,pr.h);pt(x-42,0)});else if(pr.type==="door")xs.forEach(x=>{pt(x,pr.h);pt(x+26,pr.h);pt(x-26,0)});else if(pr.type==="bar"){pt(-50,pr.h+4);pt(50,0)}else if(pr.type==="tree")xs.forEach(x=>{pt(x-30,0);pt(x+30,Math.min(200,y1))});else if(pr.type==="wall")(m.sides?xs:[xs[0]]).forEach(x=>{pt(x+(x<0?-12:12),0)})}
 /* a calm, consistent scale: small poses don't fill the frame */
 let w=x1-x0,h=y1-y0;const minW=sc==="reformer"?270:130,minH=sc==="reformer"?150:116;
 if(w<minW){x0-=(minW-w)/2;x1+=(minW-w)/2;w=minW}if(h<minH){y1+=minH-h;h=minH}
 m.frame={x0:x0-8,x1:x1+8,y0:y0-6,y1:y1+8};return m.frame}
/* the player keeps a roomier, steadier camera so the figure doesn't zoom in and out between movements */
const stageFrame=m=>{const f=frameOf(m);if(m.mode.scene==="reformer")return f;let{x0,x1,y0,y1}=f;const w=x1-x0,h=y1-y0,W=Math.max(w,200),H=Math.max(h,196);x0-=(W-w)/2;x1+=(W-w)/2;y1+=H-h;return{x0,x1,y0,y1}};
const lerpFrame=(a,b,u)=>({x0:a.x0+(b.x0-a.x0)*u,x1:a.x1+(b.x1-a.x1)*u,y0:a.y0+(b.y0-a.y0)*u,y1:a.y1+(b.y1-a.y1)*u});

/* ---------- drawing ---------- */
let COL={};
function parseCol(c){c=(c||"").trim();if(c.startsWith("#")){let h=c.slice(1);if(h.length===3)h=h.split("").map(x=>x+x).join("");const n=parseInt(h,16);return[n>>16&255,n>>8&255,n&255]}const m=c.match(/[\d.]+/g);return m?m.slice(0,3).map(Number):[0,0,0]}
const mix=(a,b,u)=>{const A=parseCol(a),B=parseCol(b);return`rgb(${A.map((v,i)=>Math.round(v+(B[i]-v)*u)).join(",")})`};
function readColors(){const cs=getComputedStyle(document.documentElement);const g=n=>cs.getPropertyValue(n).trim();
 COL={ink:g("--ink"),muted:g("--muted"),line:g("--line"),jade:g("--jade"),saffron:g("--saffron"),surface:g("--surface"),sunk:g("--sunk"),paper:g("--paper"),wood:g("--wood"),pad:g("--pad"),fig:g("--fig"),mat:g("--mat")};
 COL.figFar=mix(COL.fig,COL.sunk,.5);COL.matEdge=mix(COL.mat,COL.ink,.18)}
function hexA(col,a){const[r,g,b]=parseCol(col);return`rgba(${r},${g},${b},${a})`}
function fit(c){const r=c.getBoundingClientRect();const dpr=Math.min(2.5,window.devicePixelRatio||1);const w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));
 if(c.width!==w||c.height!==h){c.width=w;c.height=h}const ctx=c.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);return{ctx,W:r.width,H:r.height}}
/* a tapered limb: two circles joined by their outer tangents */
function capsule(ctx,a,b,ra,rb,stroke){const done=()=>stroke?ctx.stroke():ctx.fill();const dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy);ctx.beginPath();
 if(d<Math.abs(ra-rb)+.01){const r=Math.max(ra,rb),p=ra>=rb?a:b;ctx.arc(p[0],p[1],r,0,Math.PI*2);done();return}
 const ang=Math.atan2(dy,dx),k=Math.asin((ra-rb)/d),P=Math.PI;
 ctx.arc(a[0],a[1],ra,ang+P/2+k,ang+3*P/2-k);ctx.arc(b[0],b[1],rb,ang-P/2-k,ang+P/2+k);ctx.closePath();done()}
/* opt: pad, ring (progress 0–1), ghost (next pose), thumb, breath (0–1 chest rise), frame, alpha, keep (draw over) */
function drawScene(c,m,pose,opt={}){const F=fit(c),ctx=F.ctx,H=F.H;if(F.W<2)return;if(!opt.keep)ctx.clearRect(0,0,F.W,H);
 /* opt.box draws into one slice of the canvas, for side-by-side views */
 const bx=opt.box||{x:0,w:F.W},W=bx.w;
 const fr=opt.frame||frameOf(m),pad=opt.pad??1,ring=opt.ring!=null?14:0,top=opt.label?14:0;
 const s=Math.min(W/(fr.x1-fr.x0),(H-ring-top)/(fr.y1-fr.y0))*pad;const cx=bx.x+W/2-(fr.x0+fr.x1)/2*s,gy=top+(H-ring-top)/2+(fr.y0+fr.y1)/2*s;
 const T=pt=>[cx+pt[0]*s,gy-pt[1]*s];
 ctx.save();ctx.globalAlpha=opt.alpha??1;if(opt.box){ctx.beginPath();ctx.rect(bx.x,0,W,H);ctx.clip()}
 if(opt.label){ctx.fillStyle=COL.muted;ctx.font="700 10px Figtree,system-ui,sans-serif";ctx.textAlign="center";ctx.fillText(opt.label,bx.x+W/2,14)}
 /* progress along the bottom edge */
 if(opt.ring!=null&&!opt.keep){const y=H-6,x0=18,x1=F.W-18;ctx.lineCap="round";ctx.lineWidth=3;ctx.strokeStyle=COL.line;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke();
  if(opt.ring>0){ctx.strokeStyle=COL.saffron;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x0+(x1-x0)*opt.ring,y);ctx.stroke()}}
 const sc=m.mode.scene,p=opt.breath!=null?Object.assign({},pose,{br:opt.breath}):pose;
 const S=solveM(m,p);
 /* ground, mat, machine and props */
 if(sc==="reformer"){ctx.lineCap="round";ctx.strokeStyle=COL.line;ctx.lineWidth=Math.max(1.5,2*s);const a=T([-136,-1]),b=T([136,-1]);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();drawReformer(ctx,T,s,p.car||0,m)}
 else{const a=T([fr.x0-30,-.5]),b=T([fr.x1+30,-.5]);ctx.lineCap="round";ctx.strokeStyle=COL.line;ctx.lineWidth=Math.max(1,1.6*s);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
  if(sc==="mat"&&!m.noMat){const mx=(fr.x0+fr.x1)/2,half=Math.max(92,(fr.x1-fr.x0)/2-2),q0=T([mx-half,2.4]),q1=T([mx+half,-.4]);ctx.fillStyle=COL.mat;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(q0[0],q0[1],q1[0]-q0[0],q1[1]-q0[1],1.4*s);else ctx.rect(q0[0],q0[1],q1[0]-q0[0],q1[1]-q0[1]);ctx.fill()}
  if(m.prop)drawProp(ctx,m.prop,p.px||1,T,s)}
 if(sc!=="reformer")shadow(ctx,S,T,s);
 if(p.strap){const ends=p.strap==="hands"?[S.haL,S.haR]:[S.anL,S.anR];ctx.strokeStyle=hexA(COL.muted,.7);ctx.lineWidth=Math.max(1,1.3*s);
  ends.forEach(e=>{const a=T(RF.pulley),b=T(e);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();ctx.beginPath();ctx.arc(b[0],b[1],3.2*s,0,Math.PI*2);ctx.stroke()})}
 if(p.glow>0&&!opt.thumb){const g=T(S.dan);const rr=(14+22*p.glow)*s;const grd=ctx.createRadialGradient(g[0],g[1],0,g[0],g[1],rr);grd.addColorStop(0,hexA(COL.jade,.38*p.glow));grd.addColorStop(1,hexA(COL.jade,0));ctx.fillStyle=grd;ctx.beginPath();ctx.arc(g[0],g[1],rr,0,Math.PI*2);ctx.fill()}
 if(opt.ghost)ghostFig(ctx,solveM(m,opt.ghost),T,s,m.view);
 figure(ctx,S,T,s,m.view,p,opt.bg||COL.sunk);
 ctx.restore()}
/* movements with a second camera (m.alt) show both views side by side; thumbnails keep the first */
const VIEWNAME={side:"SIDE",front:"FRONT"};
function animBoth(m,t,mir){const a=animPose(m,t,mir);if(m.alt){const b=animPose(m.alt,t,mir);a.ap=b.p;a.anx=b.nx}return a}
function drawMove(c,m,r,opt={}){if(!m.alt||opt.thumb){drawScene(c,m,r.p,Object.assign({},opt,{ghost:r.nx}));return}
 const W=c.getBoundingClientRect().width,h=W/2,stage=opt.stage;
 drawScene(c,m,r.p,Object.assign({},opt,{ghost:r.nx,box:{x:0,w:h},label:VIEWNAME[m.view],frame:stage?stageFrame(m):opt.frame}));
 drawScene(c,m.alt,r.ap||m.alt.K[0],Object.assign({},opt,{ghost:r.anx,box:{x:h,w:h},label:VIEWNAME[m.alt.view],keep:true,frame:stage?stageFrame(m.alt):undefined}))}
/* a soft contact shadow under whatever touches the ground */
function shadow(ctx,S,T,s){const low=[S.anL,S.anR,S.toL,S.toR,S.haL,S.haR,S.knL,S.knR,S.hip,S.head].filter(q=>q[1]<14);if(!low.length)return;
 let a=1e9,b=-1e9;low.forEach(q=>{a=Math.min(a,q[0]);b=Math.max(b,q[0])});const c=T([(a+b)/2,0]),rx=((b-a)/2+12)*s,ry=3.2*s;
 const g=ctx.createRadialGradient(c[0],c[1],0,c[0],c[1],rx);g.addColorStop(0,hexA(COL.ink,.13));g.addColorStop(1,hexA(COL.ink,0));
 ctx.save();ctx.fillStyle=g;ctx.translate(c[0],c[1]);ctx.scale(1,ry/rx);ctx.beginPath();ctx.arc(0,0,rx,0,Math.PI*2);ctx.fill();ctx.restore()}
/* the figure: tapered limbs, a shaped torso, far-side limbs in a lighter tone for depth */
function figure(ctx,S,T,s,view,pose,bg){const side=view!=="front",near=COL.fig,far=side?COL.figFar:COL.fig;
 /* limbs are drawn twice: first a thin outline in the background color, then the fill, so an arm or leg in front
    of the body (or of the other limb) stays readable instead of merging into one dark shape */
 let pass="fill";const edge=Math.max(2.2,1.5*s);
 const cap=(a,b,ra,rb,col)=>{if(pass==="edge"){ctx.strokeStyle=bg;ctx.lineWidth=edge;capsule(ctx,T(a),T(b),ra*s,rb*s,true)}else{ctx.fillStyle=col;capsule(ctx,T(a),T(b),ra*s,rb*s)}};
 const dot=(p,r,col)=>{const q=T(p);ctx.beginPath();ctx.arc(q[0],q[1],r*s,0,Math.PI*2);if(pass==="edge"){ctx.strokeStyle=bg;ctx.lineWidth=edge;ctx.stroke()}else{ctx.fillStyle=col;ctx.fill()}};
 const twice=f=>{pass="edge";f();pass="fill";f()};
 const leg=(k,col,o)=>{const f=()=>{cap(S["hj"+k],S["kn"+k],8,5.4,col);cap(S["kn"+k],S["an"+k],5.3,3.3,col);cap(S["an"+k],S["to"+k],3.4,2.3,col)};o?twice(f):f()};
 const bell=(k,col)=>{if(!pose.db)return;const h=S["ha"+k];if(side){dot(h,6.4,mix(col,COL.paper,.25));if(pass==="fill")dot(h,3.6,col)}else{const a=[h[0]-8,h[1]],b=[h[0]+8,h[1]];cap(a,b,1.6,1.6,col);cap([a[0]-1.5,a[1]-5.5],[a[0]-1.5,a[1]+5.5],2.4,2.4,col);cap([b[0]+1.5,b[1]-5.5],[b[0]+1.5,b[1]+5.5],2.4,2.4,col)}};
 const arm=(k,col,o)=>{const f=()=>{cap(S["sh"+k],S["el"+k],5,3.9,col);cap(S["el"+k],S["ha"+k],3.8,2.7,col);dot(S["ha"+k],3.5,col);bell(k,col)};o?twice(f):f()};
 if(side){arm("L",far);leg("L",far)}
 /* torso: sampled along the spine curve with a waist and a chest */
 const A=S.hip,C=S.ctrl,B=S.nb,N=12,L=[],R=[];
 const prof=side?[[0,9.6],[.42,8.2],[.74,10],[1,7.6]]:[[0,13],[.42,11.4],[.8,15.2],[1,15.6]];
 const wAt=t=>{for(let i=1;i<prof.length;i++)if(t<=prof[i][0]){const[a,wa]=prof[i-1],[b,wb]=prof[i],u=(t-a)/(b-a);return wa+(wb-wa)*(.5-.5*Math.cos(Math.PI*u))}return prof[prof.length-1][1]};
 for(let i=0;i<=N;i++){const t=i/N,mt=1-t;const x=mt*mt*A[0]+2*mt*t*C[0]+t*t*B[0],y=mt*mt*A[1]+2*mt*t*C[1]+t*t*B[1];
  let tx=2*mt*(C[0]-A[0])+2*t*(B[0]-C[0]),ty=2*mt*(C[1]-A[1])+2*t*(B[1]-C[1]);const tl=Math.hypot(tx,ty)||1;tx/=tl;ty/=tl;
  const w=wAt(t),nx=-ty,ny=tx;L.push(T([x+nx*w,y+ny*w]));R.push(T([x-nx*w,y-ny*w]))}
 ctx.fillStyle=near;ctx.beginPath();L.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));R.reverse().forEach(q=>ctx.lineTo(q[0],q[1]));ctx.closePath();ctx.fill();
 dot(A,side?9.4:11.4,near);
 if(!side){cap(S.shL,S.shR,6.2,6.2,near);cap(S.hjL,S.hjR,8,8,near);leg("L",near);leg("R",near,true)}else{dot(B,7.4,near);leg("R",near,true)}
 cap(S.nb,S.ne,4.2,3.9,near);
 dot(S.head,10.6,near);
 /* a hint of a nose shows which way the head faces */
 if(side){dot(add(S.head,dir(angOf(S.nd)-90*(S.face||1)),8.6),2.6,near)}else if(Math.abs(pose.face||0)>.05){dot([S.head[0]+pose.face*8.4,S.head[1]-1.5],2.4,near)}
 if(side)arm("R",near,true);else{arm("L",near,true);arm("R",near,true)}}
/* the next pose, drawn as a faint line figure */
function ghostFig(ctx,S,T,s,view){ctx.save();ctx.strokeStyle=hexA(COL.jade,.42);ctx.lineWidth=Math.max(1,2.2*s);ctx.lineCap="round";ctx.lineJoin="round";
 const line=pts=>{ctx.beginPath();pts.forEach((p,i)=>{const q=T(p);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])});ctx.stroke()};
 ["L","R"].forEach(k=>{line([S["hj"+k],S["kn"+k],S["an"+k],S["to"+k]]);line([S["sh"+k],S["el"+k],S["ha"+k]])});
 const a=T(S.hip),b=T(S.nb),c=T(S.ctrl);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.quadraticCurveTo(c[0],c[1],b[0],b[1]);ctx.stroke();
 if(view==="front"){line([S.shL,S.shR]);line([S.hjL,S.hjR])}line([S.nb,S.ne]);const h=T(S.head);ctx.beginPath();ctx.arc(h[0],h[1],10*s,0,Math.PI*2);ctx.stroke();ctx.restore()}
/* outdoor furniture some movements use: railing, door frame, pull-up bar, tree */
function drawProp(ctx,pr,sign,T,s){const x=(pr.x||0)*sign,c=hexA(COL.muted,.55);ctx.lineCap="round";ctx.strokeStyle=c;ctx.lineWidth=Math.max(2,4*s);
 const seg=(a,b)=>{const p=T(a),q=T(b);ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.stroke()};
 if(pr.type==="rail"){const L=x-18*sign,R=x+40*sign;seg([L,pr.h],[R,pr.h]);seg([x+32*sign,0],[x+32*sign,pr.h]);seg([x-10*sign,0],[x-10*sign,pr.h]);ctx.lineWidth=Math.max(1,2*s);seg([L,pr.h*.5],[R,pr.h*.5])}
 else if(pr.type==="door"){seg([x,0],[x,pr.h]);seg([x,pr.h],[x+24*sign,pr.h])}
 else if(pr.type==="bar"){seg([-48,pr.h],[48,pr.h]);seg([-44,0],[-44,pr.h]);seg([44,0],[44,pr.h])}
 else if(pr.type==="tree"){const a=T([x-8,0]),b=T([x+8,200]);ctx.fillStyle=hexA(COL.muted,.18);ctx.fillRect(a[0],b[1],b[0]-a[0],a[1]-b[1]);ctx.lineWidth=Math.max(1.5,2.5*s);
  seg([x-8,0],[x-8,200]);seg([x+8,0],[x+8,200]);seg([x+4,150],[x+30,182]);seg([x-5,128],[x-28,160]);seg([x+18,166],[x+26,194])}
 else if(pr.type==="wall"){const h=pr.h||150,o=x<0?-10:10;ctx.fillStyle=hexA(COL.muted,.16);const a=T([x,0]),b=T([x+o,h]);ctx.fillRect(Math.min(a[0],b[0]),b[1],Math.abs(b[0]-a[0]),a[1]-b[1]);ctx.lineWidth=Math.max(1.5,2.5*s);seg([x,0],[x,h])}
 else if(pr.type==="bench"){ctx.fillStyle=hexA(COL.muted,.3);const a=T([x-pr.w/2,pr.h]),b=T([x+pr.w/2,pr.h-6]);ctx.fillRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);seg([x-pr.w/2+6,0],[x-pr.w/2+6,pr.h-6]);seg([x+pr.w/2-6,0],[x+pr.w/2-6,pr.h-6])}}
/* the machine: frame, risers and pulleys, footbar, platform, springs, sliding carriage with headrest and shoulder blocks */
function drawReformer(ctx,T,s,c,m){const wood=COL.wood,pad=COL.pad,metal=hexA(COL.muted,.8);
 const seg=(a,b,w,col)=>{const p=T(a),q=T(b);ctx.strokeStyle=col;ctx.lineWidth=Math.max(1,w*s);ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.stroke()};
 const rect=(x0,y0,x1,y1,col,r)=>{const a=T([x0,y1]),b=T([x1,y0]);ctx.fillStyle=col;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(a[0],a[1],b[0]-a[0],b[1]-a[1],r*s);else ctx.rect(a[0],a[1],b[0]-a[0],b[1]-a[1]);ctx.fill()};
 const dot=(x,y,r,col)=>{const q=T([x,y]);ctx.fillStyle=col;ctx.beginPath();ctx.arc(q[0],q[1],r*s,0,Math.PI*2);ctx.fill()};
 ctx.lineCap="round";
 seg([-124,1],[-124,20],5,wood);seg([124,1],[124,20],5,wood);rect(-129,18,129,24,wood,2);
 seg([-124,24],[-124,80],3.5,metal);dot(-121,79,3.4,metal);
 rect(102,24,129,30,pad,2);
 seg([100,24],[112,62],3.5,metal);dot(112,62,3.6,metal);
 /* springs from the anchor near the footbar to the carriage, one coil per spring, in its color when colors are shown */
 const mode=settings.springs||"level",list=[];(m.springs||[[1,"M"]]).forEach(([n,k])=>{for(let i=0;i<n;i++)list.push(k)});
 const x0=97,x1=RF.carR-c;list.slice(0,4).forEach((k,j)=>{const y=27-j*1.6,col=mode==="level"?metal:SPEECH.SPRING[k].hex;ctx.strokeStyle=col;ctx.lineWidth=Math.max(1,1.3*s);ctx.beginPath();
  const n=12;for(let i=0;i<=n;i++){const x=x1+(x0-x1)*i/n,yy=y+((i>0&&i<n)?(i%2?1.8:-1.8):0);const q=T([x,yy]);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])}ctx.stroke()});
 rect(RF.carL-c,24,RF.carR-c,30,pad,2.5);rect(RF.carL-c,30,RF.carL+14-c,33,pad,1.5);rect(-3-c,30,3-c,42,pad,1.5);
 if(m.box)rect(m.box.x0-c,30,m.box.x1-c,30+m.box.h,wood,2)}

/* static + animated canvas registry */
let statics=[];
const restPose=m=>poseAt(m,m.beats[0]*.999).p;
function staticPose(c,m,opt={}){const f=()=>drawScene(c,m,opt.keyIndex!=null?m.K[opt.keyIndex]:restPose(m),Object.assign({thumb:true},opt));statics.push(f);requestAnimationFrame(f);return f}
function redrawAll(){readColors();statics.forEach(f=>f());if(player.active)player.render()}
const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
const breathAmt=(t,md=MD)=>{const b=breathPhase(t,md);return b.lab==="in"?ease(b.prog):1-ease(b.prog)};

/* ---------- audio ---------- */
let AC=null;
/* iPhone mutes web audio with the ringer switch unless the page asks for "playback";
   speech can also leave the audio context "interrupted", so resume it before every sound. */
try{if(navigator.audioSession)navigator.audioSession.type="playback"}catch(e){}
function ac(){if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}return AC}
function withAudio(play){const a=ac();if(!a)return;if(a.state==="running")play(a);else a.resume().then(()=>play(a)).catch(()=>{})}
function bowl(strength=1){if(!settings.bell)return;withAudio(a=>{const t=a.currentTime+.02,f0=262;const out=a.createGain();out.gain.value=.34*strength;out.connect(a.destination);
 [[1,1,5],[2.71,.45,3.5],[5.1,.22,2.2],[1.003,.6,5]].forEach(([r,g,d])=>{const o=a.createOscillator(),gn=a.createGain();o.type="sine";o.frequency.value=f0*r;gn.gain.setValueAtTime(0,t);gn.gain.linearRampToValueAtTime(g,t+.015);gn.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(gn);gn.connect(out);o.start(t);o.stop(t+d+.1)})})}
function tick(hi){if(!settings.bell)return;withAudio(a=>{const t=a.currentTime+.01,o=a.createOscillator(),g=a.createGain();o.type="triangle";o.frequency.value=hi?1320:880;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.16,t+.005);g.gain.exponentialRampToValueAtTime(.0001,t+.12);o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+.15)})}

/* ---------- voice ----------
   A calm recorded voice: every sentence the coach can say is pre-recorded (voice/<key>.mp3, listed in
   voice/manifest.json) and played through Web Audio, so it sounds the same on every phone and works offline once
   cached. Any sentence without a recording falls back to the device's speech voice. */
const VO={clips:null,bytes:new Map(),bufs:new Map(),queue:[],cur:null,gen:0,timer:0};
fetch("voice/manifest.json").then(r=>r.ok?r.json():null).then(j=>{if(j&&j.clips)VO.clips=j.clips;syncVoiceBtn()}).catch(()=>{});
const natural=()=>settings.voiceKind!=="device"&&!!VO.clips;
function clipBytes(k){if(!VO.bytes.has(k))VO.bytes.set(k,fetch("voice/"+k+".mp3").then(r=>{if(!r.ok)throw 0;return r.arrayBuffer()}).catch(e=>{VO.bytes.delete(k);throw e}));return VO.bytes.get(k)}
function clipBuf(k){if(VO.bufs.has(k))return VO.bufs.get(k);const a=ac();const p=clipBytes(k).then(b=>new Promise((res,rej)=>a.decodeAudioData(b.slice(0),res,rej)));
 VO.bufs.set(k,p);p.catch(()=>VO.bufs.delete(k));if(VO.bufs.size>24)VO.bufs.delete(VO.bufs.keys().next().value);return p}
/* fetch (not decode) the recordings a stretch of practice will need */
function prefetch(texts){if(!natural())return;const keys=[...new Set(texts.flatMap(t=>SPEECH.split(t)).map(SPEECH.key))].filter(k=>VO.clips[k]&&!VO.bytes.has(k));
 let i=0;const go=()=>{if(i>=keys.length)return;clipBytes(keys[i++]).catch(()=>{}).finally(go)};go();go();go()}
let VOICE=null;
/* Network voices (e.g. Chrome's "Google …") go silent offline, so offline we only use on-device voices. */
function pickVoice(){try{let vs=speechSynthesis.getVoices().filter(v=>/^en/i.test(v.lang));if(!navigator.onLine){const loc=vs.filter(v=>v.localService);if(loc.length)vs=loc}const pref=[/natural/i,/Google UK English Female/i,/Samantha/i,/Serena/i,/Daniel/i,/Aria/i,/Jenny/i,/Google US English/i];
 for(const p of pref){const v=vs.find(v=>p.test(v.name));if(v)return v}return vs[0]||null}catch(e){return null}}
try{VOICE=pickVoice();speechSynthesis.onvoiceschanged=()=>{VOICE=pickVoice()}}catch(e){}
addEventListener("online",()=>{VOICE=pickVoice()});addEventListener("offline",()=>{VOICE=pickVoice()});
function stopSpeech(){VO.gen++;VO.queue=[];clearTimeout(VO.timer);if(VO.cur){try{VO.cur.onended=null;VO.cur.stop()}catch(e){}VO.cur=null}try{speechSynthesis.cancel()}catch(e){}VO.busy=false}
function pump(){if(VO.busy||!VO.queue.length)return;const it=VO.queue.shift(),gen=VO.gen;VO.busy=true;
 const done=gap=>{if(gen!==VO.gen)return;VO.cur=null;VO.timer=setTimeout(()=>{if(gen!==VO.gen)return;VO.busy=false;pump()},gap)};
 const tts=()=>{try{const u=new SpeechSynthesisUtterance(it.text);if(VOICE)u.voice=VOICE;u.rate=it.slow?.72:.8;u.pitch=.95;u.volume=1;u.onend=u.onerror=()=>done(60);speechSynthesis.speak(u)}catch(e){done(0)}};
 if(it.key&&natural()&&VO.clips[it.key]){let started=false;
  /* if the recording can't start soon (slow network, audio still locked), say it with the device voice instead */
  const dog=setTimeout(()=>{if(!started&&gen===VO.gen){started=true;tts()}},2500);
  clipBuf(it.key).then(buf=>{if(gen!==VO.gen||started)return;withAudio(a=>{if(gen!==VO.gen||started)return;started=true;clearTimeout(dog);const src=a.createBufferSource();src.buffer=buf;src.connect(a.destination);VO.cur=src;src.onended=()=>done(it.slow?80:380);src.start()})}).catch(()=>{if(!started){started=true;clearTimeout(dog);tts()}})}
 else tts()}
/* opt.caption=false speaks without replacing the on-screen cue (used for breath words) */
function say(text,interrupt,opt={}){const cue=$("#plCue");if(cue&&opt.caption!==false)cue.textContent=typeof opt.caption==="string"?opt.caption:text;if(!settings.voice)return;
 if(interrupt)stopSpeech();SPEECH.split(text).forEach(s=>VO.queue.push({text:s,key:SPEECH.key(s),slow:SPEECH.isSlow(s)}));pump()}
const speaking=()=>{if(VO.busy||VO.queue.length)return true;try{return speechSynthesis.speaking||speechSynthesis.pending}catch(e){return false}};

/* presence prompts, woven between the form cues so attention keeps returning to the body and the breath */
function presencePool(m){const P=m.mode.presence,modes=[...new Set(m.breath)].filter(b=>b==="flow"||b==="soft");
 return[...P.all,...m.tags.flatMap(t=>P[t]||[]),...modes.flatMap(b=>[...(P[b]||[]),...(P[b]||[])])]}
function presenceFor(m,used){const pool=presencePool(m);let fresh=pool.filter(x=>!used.has(x));if(!fresh.length){used.clear();fresh=pool}
 const pick=fresh[Math.floor(Math.random()*fresh.length)];used.add(pick);return pick}

/* ---------- history ---------- */
const dkey=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
function history(){return store.get("history",[])}
function record(secs,name,ids){if(secs<45)return;const h=history();h.push({d:dkey(new Date()),s:Math.round(secs),r:name,ids:ids||[],m:MD.id});store.set("history",h.slice(-800));renderLog()}
function streak(){const days=new Set(history().map(x=>x.d));let n=0;const d=new Date();if(!days.has(dkey(d)))d.setDate(d.getDate()-1);while(days.has(dkey(d))){n++;d.setDate(d.getDate()-1)}return n}

/* ---------- DOM helpers ---------- */
const $=s=>document.querySelector(s);
const el=(tag,attrs={},html="")=>{const e=document.createElement(tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(html)e.innerHTML=html;return e};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const cap1=s=>s.charAt(0).toUpperCase()+s.slice(1);
/* the label shown in the accent color (spring setting on the Reformer, family elsewhere) and the small line under it */
const hzOf=m=>m.springs?SPEECH.springText(m,settings.springs):m.fam;
const subOf=m=>m.springs?m.fam:m.tags.filter(t=>t!=="floor").slice(0,2).map(t=>m.mode.tags[t]||t).join(" · ");
const sayingHTML=q=>`<figure class="saying"><blockquote>${esc(q[0])}</blockquote><figcaption>${esc(q[2])}<small>${esc(q[1])}</small></figcaption></figure>`;

/* ---------- home: log ---------- */
function renderLog(){const h=history(),days=new Set(h.map(x=>x.d));const wk=$("#week");wk.innerHTML="";const now=new Date();const dow=(now.getDay()+6)%7;
 const mon=new Date(now);mon.setDate(now.getDate()-dow);let wsec=0;const names=["M","T","W","T","F","S","S"];
 for(let i=0;i<7;i++){const d=new Date(mon);d.setDate(mon.getDate()+i);const k=dkey(d);const on=days.has(k);h.forEach(x=>{if(x.d===k)wsec+=x.s});const th=MD.themes[d.getDay()];
  const cell=el("div",{class:"day"},`<div class="dot${on?" on":""}${i===dow?" is-today":""}" aria-label="${d.toDateString()}${on?", practiced":""}">${on?"✓":d.getDate()}</div><span>${names[i]}</span><span class="mark" title="${esc(th.name)}">${esc(th.mark)}</span>`);wk.appendChild(cell)}
 const st=streak();$("#streakN").textContent=st;$("#streakL").textContent="day streak";
 const mine=h.filter(x=>(x.m||"movement")===MD.id).length;
 $("#weekMin").textContent=Math.round(wsec/60)+" min this week";$("#allMin").textContent=h.length?(mine+" "+MD.name.toLowerCase()+(mine===1?" session":" sessions")):"Your first session will appear here"}

/* ---------- daily practice: a weekly rhythm, a new sequence each day ---------- */
const WEEKDAYS=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const LENGTHS=[["short","Short",8],["standard","Standard",15],["long","Long",25]];
function seeded(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19}
 return()=>{h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);h^=h>>>16;return(h>>>0)/4294967296}}
function shuffle(a,rnd){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function dailyPractice(date,lenKey){const today=dkey(date),th=MD.themes[date.getDay()],min=LENGTHS.find(l=>l[0]===lenKey)[2],T=min*60,rnd=seeded(MD.id+today+lenKey);
 /* movements from the three days before today go to the back of the queue. Today's own sessions are ignored so the plan holds all day. */
 const since=new Date(date);since.setDate(since.getDate()-3);const sinceKey=dkey(since);
 const recent=new Set(history().filter(x=>(x.m||"movement")===MD.id&&x.d<today&&x.d>=sinceKey).flatMap(x=>x.ids||[]));
 const fresh=list=>{const sh=shuffle(list,rnd);return[...sh.filter(id=>!recent.has(id)),...sh.filter(id=>recent.has(id))]};
 const nWarm=min<=8?2:min<=15?3:4;const warm=fresh(th.warm||MD.warm).slice(0,nWarm);
 const close=min<=8?th.close.slice(-1):th.close;
 const nMain=Math.max(2,Math.round((T-nWarm*45-close.length*70)/(th.per||72)));let main;
 if(th.ordered){const L=th.ordered.length;
  if(nMain>=L)main=[...th.ordered,...fresh(th.extra||[]).slice(0,nMain-L)];
  else{const week=Math.floor(date.getTime()/6048e5),start=(week*nMain)%L;main=Array.from({length:nMain},(_,i)=>th.ordered[(start+i)%L])}} /* a different stretch of the set each week */
 else main=fresh(th.pool).slice(0,nMain);
 main=main.filter(id=>!warm.includes(id)&&!close.includes(id));
 const ids=[...warm,...main,...close];const avail=T-overhead({items:ids});
 const long=id=>M[id].longHold;
 const w=ids.map((id,i)=>long(id)?3:i<warm.length?.65:(M[id].sides?1.4:1)*(close.includes(id)?1.2:1));const sw=w.reduce((a,b)=>a+b,0);
 const items=ids.map((id,i)=>[id,Math.max(30,Math.min(long(id)?600:240,Math.round(avail*w[i]/sw/5)*5))]);
 return{id:"daily",name:th.name,hz:th.hz,focus:th.name,feat:main[0]||ids[0],desc:th.desc,items,theme:th}}

let heroR=null,heroAnim=0,heroDay="";
function setupHero(){cancelAnimationFrame(heroAnim);const now=new Date(),hr=now.getHours(),lenKey=settings.dailyLen||"standard";heroDay=dkey(now);
 heroR=dailyPractice(now,lenKey);
 $("#greet").textContent=`${hr<12?"Good morning":hr<17?"Good afternoon":"Good evening"} · ${WEEKDAYS[now.getDay()]} · ${MD.name}`;
 $("#heroName").textContent=heroR.name;$("#heroHz").textContent=heroR.hz;$("#heroDesc").textContent=heroR.desc+" A new sequence every day.";
 $("#heroMeta").innerHTML=`<span><b class="num">${fmtMin(routineSecs(heroR))}</b> min</span><span><b class="num">${heroR.items.length}</b> ${MD.unit[1]}</span><span>Featured: <b>${esc(M[heroR.feat].name)}</b></span>`;
 renderChips($("#dailyLen"),LENGTHS.map(([k,l])=>[k,l]),lenKey,v=>{settings.dailyLen=v;saveSettings();setupHero()});
 $("#heroGo").onclick=()=>player.start(heroR);$("#heroView").onclick=()=>openRoutine(heroR);
 const c=$("#heroCanvas"),m=M[heroR.feat],B=MD.BIN+MD.BOUT;
 if(reduced){staticPose(c,m,{pad:.9});return}
 const loop=now=>{if(!player.active&&!document.hidden){const t=now/1000;const half=m.sides&&(Math.floor(t/(4*B))%2===1);drawMove(c,m,animBoth(m,t,half),{pad:.9,breath:breathAmt(t)})}heroAnim=requestAnimationFrame(loop)};heroAnim=requestAnimationFrame(loop)}
/* a new day while the app was left open */
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&!player.active&&heroDay&&heroDay!==dkey(new Date())){setupHero();renderLog()}});

/* ---------- routines grid ---------- */
const DUR=[["all","All"],["5","5 min"],["10","10 min"],["15","15 min"],["30","20 min +"]];let durF="all";
function durBucket(s){const m=s/60;return m<=7?"5":m<=12?"10":m<=18?"15":"30"}
function renderChips(box,list,cur,on){box.innerHTML="";list.forEach(([v,l])=>{const b=el("button",{class:"chip","aria-pressed":String(v===cur),type:"button"},esc(l));b.onclick=()=>on(v);box.appendChild(b)})}
function renderRoutines(){renderChips($("#durChips"),DUR,durF,v=>{durF=v;renderRoutines()});const g=$("#routines");g.innerHTML="";
 MD.routines.filter(r=>durF==="all"||durBucket(routineSecs(r))===durF).forEach(r=>{const secs=routineSecs(r);
  const b=el("button",{class:"rcard",type:"button","aria-label":`${r.name}, ${fmtMin(secs)} minutes`});
  b.innerHTML=`<div class="dur num">${fmtMin(secs)}<span>min</span></div><div class="vhz" aria-hidden="true">${esc(r.hz)}</div><h3>${esc(r.name)}</h3><p>${esc(r.desc)}</p><div class="strip"></div>`;
  const strip=b.querySelector(".strip");const uniq=[...new Set(r.items.map(x=>x[0]))].slice(0,6);uniq.forEach(id=>{const c=el("canvas",{"aria-hidden":"true"});strip.appendChild(c);staticPose(c,M[id],{pad:1})});
  b.onclick=()=>openRoutine(r);g.appendChild(b)});
 if(!g.children.length)g.innerHTML=`<p class="muted">No routines of this length yet.</p>`}

/* ---------- compose ---------- */
let cFocus,cMin,composed=null;
function compose(min,focus){const T=min*60,rules=MD.composeRules?MD.composeRules(focus,min):{};const per=rules.per||72;
 const n=Math.max(4,Math.round(T/per)),nw=rules.nw?rules.nw(n):Math.max(2,Math.min(4,Math.round(n*.25)));
 const close=rules.close||[],warm=(rules.warm||MD.warm).slice(0,nw);
 const pool=MD.pools[focus].filter(id=>!warm.includes(id)&&!close.includes(id)),nm=Math.max(1,n-nw-close.length),main=[];for(let i=0;i<nm;i++)main.push(pool[i%pool.length]);
 const ids=[...warm,...main,...close],avail=T-overhead({items:ids});
 const w=ids.map((id,i)=>i<warm.length?(rules.warmWeight??.75):rules.weight?rules.weight(id):M[id].sides?1.4:1),sw=w.reduce((a,b)=>a+b,0);
 const items=ids.map((id,i)=>[id,Math.max(30,Math.min(rules.max?rules.max(id):180,Math.round(avail*w[i]/sw/5)*5))]);
 return{id:"custom",name:`${min}-minute ${MD.foci.find(f=>f[0]===focus)[1].toLowerCase()} ${MD.id==="pilates"?"workout":"sequence"}`,hz:"CUSTOM",desc:"Composed for you.",items}}
function renderCompose(){$("#cMin").value=cMin;$("#cMinOut").innerHTML=`${cMin}<span> min</span>`;
 renderChips($("#focusChips"),MD.foci,cFocus,v=>{cFocus=v;store.set("cFocus."+MD.id,v);renderCompose()});
 composed=compose(cMin,cFocus);const ol=$("#cPlan");ol.innerHTML="";
 composed.items.forEach(([id,s])=>{const m=M[id];const li=el("li",{},`<canvas aria-hidden="true"></canvas><span class="nm">${esc(m.name)}<small>${esc(hzOf(m))} · ${esc(subOf(m))}</small></span><span class="s">${fmt(quant(id,s))}</span>`);ol.appendChild(li);staticPose(li.querySelector("canvas"),m,{pad:1.05})});
 $("#cPlanMeta").textContent=`${composed.items.length} ${MD.unit[1]} · ${fmtMin(routineSecs(composed))} min`}

/* ---------- library ---------- */
let tagF="all";
function renderLib(){const tl=[["all","All"],...MD.libTags.map(t=>[t,MD.tags[t]])];if(!MD.libTags.includes(tagF))tagF="all";
 renderChips($("#tagChips"),tl,tagF,v=>{tagF=v;renderLib()});const g=$("#lib");g.innerHTML="";
 MD.moves.filter(m=>tagF==="all"||m.tags.includes(tagF)).forEach(m=>{const b=el("button",{class:"mcard",type:"button"},`<canvas aria-hidden="true"></canvas><span class="hzs">${esc(hzOf(m))}</span><b>${esc(m.name)}</b><small>${esc(subOf(m))}</small>`);
  const c=b.querySelector("canvas");const draw=staticPose(c,m,{pad:.98});let raf=0;
  const go=()=>{if(reduced)return;cancelAnimationFrame(raf);const t0=performance.now();const f=now=>{const t=(now-t0)/1000;const{p,nx}=animPose(m,t);drawScene(c,m,p,{pad:.98,thumb:true,ghost:nx,breath:breathAmt(t)});raf=requestAnimationFrame(f)};raf=requestAnimationFrame(f)};
  const stop=()=>{cancelAnimationFrame(raf);draw()};
  b.addEventListener("pointerenter",go);b.addEventListener("pointerleave",stop);b.addEventListener("focus",go);b.addEventListener("blur",stop);
  b.onclick=()=>{stop();openMove(m)};g.appendChild(b)})}
/* spring notation: plain resistance levels, Balanced Body colors, or both */
const SPRING_MODES={level:"levels",color:"colors",both:"levels + colors"};
function syncSprings(){const b=$("#tSprings");b.hidden=!MD.springs;b.textContent="Springs: "+SPRING_MODES[settings.springs||"level"]}
$("#tSprings").onclick=()=>{const order=["level","color","both"];settings.springs=order[(order.indexOf(settings.springs||"level")+1)%3];saveSettings();syncSprings();renderCompose();renderLib();redrawAll()};

/* ---------- sheets ---------- */
let sheetAnim=0,lastFocus=null;
function openSheet(html,list){lastFocus=document.activeElement;const p=$("#panel");p.className="panel"+(list?" list":"");p.innerHTML=html;$("#sheet").hidden=false;document.body.style.overflow="hidden";const x=p.querySelector(".x");x&&x.focus()}
function closeSheet(){cancelAnimationFrame(sheetAnim);$("#sheet").hidden=true;document.body.style.overflow="";lastFocus&&lastFocus.focus&&lastFocus.focus()}
$("#sheet").addEventListener("click",e=>{if(e.target.id==="sheet")closeSheet()});
const XBTN=`<button class="x" type="button" aria-label="Close"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
function openMove(m){openSheet(`<div class="pfig"><canvas id="mvC" aria-label="${esc(m.name)} demonstration"></canvas></div><div class="pbody">${XBTN}
 <div class="hero-hz">${m.springs?"Springs · ":""}${esc(hzOf(m))}</div><h2 id="sheetTitle">${esc(m.name)}</h2><div class="muted" style="font-size:13px">${m.springs?esc(m.fam)+" · ":""}${m.tags.map(t=>esc(m.mode.tags[t]||t)).join(" · ")}${m.sides?" · both sides":""}</div>
 <p>${esc(m.about)}</p><div><div class="eyebrow" style="margin-bottom:6px">How to</div><p>${esc(m.setup)}</p></div>
 <div><div class="eyebrow" style="margin-bottom:6px">Coaching cues</div><ul>${m.cues.map(c=>`<li>${esc(c)}</li>`).join("")}</ul></div>
 <div class="muted" style="font-size:13px">Breath: ${breathSummary(m)}</div>
 <div><button class="btn" id="mvGo"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>Try it for 1 minute</button></div></div>`);
 $("#panel .x").onclick=closeSheet;$("#mvGo").onclick=()=>{closeSheet();player.start({id:"single",name:m.name,hz:hzOf(m),items:[[m.id,60]]})};
 const c=$("#mvC"),B=MD.BIN+MD.BOUT;const t0=performance.now();const f=now=>{const t=(now-t0)/1000;const half=m.sides&&(Math.floor(t/(4*B))%2===1);drawMove(c,m,animBoth(m,t,half),{pad:.94,breath:breathAmt(t)});if(!reduced)sheetAnim=requestAnimationFrame(f)};sheetAnim=requestAnimationFrame(f)}
function breathSummary(m){const md=m.mode;return m.tl.kind==="tempo"?`in ${md.BIN} s, out ${md.BOUT} s, the same steady rhythm all session. The movement keeps its own tempo, ${m.tl.per>1?m.tl.per+" times":"once"} per breath`:`in ${md.BIN} s, out ${md.BOUT} s, the same steady rhythm all session. The movement follows the breath`}
const BL={in:"Inhale",out:"Exhale",hold:"Hold",flow:"Breathe naturally",soft:"Breathe into the stretch",still:"Rest in stillness"};
function openRoutine(base){const full=fmtMin(routineSecs(base)),keep=!["daily","custom","single"].includes(base.id),lk=MD.id+":"+base.id;
 const lo=Math.max(3,Math.min(5,full)),hi=Math.max(30,Math.min(60,full*2));let min=Math.min(hi,Math.max(lo,keep&&settings.lenFor[lk]||full));
 openSheet(`<div class="pbody">${XBTN}<div class="hero-hz">${esc(base.hz)}</div><h2 id="sheetTitle">${esc(base.name)}</h2><p class="muted">${esc(base.desc)}</p>
 <div class="meta" id="rMeta"></div>${base.saying!=null?sayingHTML(MD.sayings[base.saying]):""}
 <div class="field len"><div class="plan-head"><label for="rLen"><b>Length</b></label><span class="muted num" id="rLenNote"></span></div>
  <input type="range" id="rLen" min="${lo}" max="${hi}" step="1" value="${min}"><div class="scale"><span>${lo} min</span><button type="button" class="chip" id="rLenReset">Original · ${full} min</button><span>${hi} min</span></div></div>
 <ol class="plan" id="rPlan"></ol><div><button class="btn" id="rGo"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>Begin practice</button></div></div>`,true);
 $("#panel .x").onclick=closeSheet;let r=base;
 const draw=()=>{r=min===full?base:scaleRoutine(base,min);const secs=routineSecs(r),f=(secs/60)/full;
  $("#rMeta").innerHTML=`<span><b class="num">${fmtMin(secs)}</b> min</span><span><b class="num">${r.items.length}</b> ${MD.unit[1]}</span><span>Focus: <b>${esc(r.focus||"")}</b></span>`;
  $("#rLenNote").textContent=min===full?"As designed":`Every ${MD.unit[0]} ×${f.toFixed(2).replace(/0$/,"")}`;$("#rLenReset").setAttribute("aria-pressed",String(min===full));
  const ol=$("#rPlan");ol.innerHTML="";
  r.items.forEach(([id,s])=>{const m=M[id];const li=el("li",{},`<canvas aria-hidden="true"></canvas><span class="nm">${esc(m.name)}<small>${esc(hzOf(m))} · ${esc(subOf(m))}${m.sides?" · both sides":""}</small></span><span class="s">${fmt(quant(id,s))}</span>`);ol.appendChild(li);
   requestAnimationFrame(()=>drawScene(li.querySelector("canvas"),m,restPose(m),{pad:1.05,thumb:true}))})};
 const set=v=>{min=v;$("#rLen").value=v;if(keep){settings.lenFor[lk]=v;saveSettings()}draw()};
 $("#rLen").addEventListener("input",e=>set(+e.target.value));$("#rLenReset").onclick=()=>set(full);draw();
 $("#rGo").onclick=()=>{closeSheet();player.start(r)}}

/* ---------- player ---------- */
const MORPH=2.4; /* seconds to glide from the last pose into the next movement's starting pose */
const player={active:false,segs:[],si:0,t:0,running:false,raf:0,last:0,practiced:0,wake:null,routine:null,lastPose:null,
 start(r){ac();this.routine=r;this.segs=[];this.arrive=r.items.length>1;if(this.arrive)this.segs.push({kind:"arrive",m:M[r.items[0][0]],dur:MD.ARRIVE,idx:-1});r.items.forEach(([id,s],i)=>{this.segs.push({kind:"prep",m:M[id],dur:i===0?MD.PREP_FIRST:MD.PREP,idx:i});this.segs.push({kind:"move",m:M[id],dur:quant(id,s),idx:i})});
  this.total=this.segs.reduce((a,s)=>a+s.dur,0);this.si=0;this.t=0;this.practiced=0;this.recorded=false;this.idsDone=new Set();this.usedPres=new Set();this.active=true;this.running=true;this.lastPose=null;
  $("#player").hidden=false;$("#plDone").hidden=true;document.body.style.overflow="hidden";$("#plRoutine").textContent=r.name;
  const bar=$("#plBar");bar.innerHTML="";r.items.forEach(([id,s])=>{const d=el("div");d.style.flex=String(quant(id,s));d.appendChild(el("i"));bar.appendChild(d)});
  prefetch([MD.arrive,...SPEECH.ARRIVE_BREATH,...this.linesFor(0)]);
  this.syncToggles();this.enter(true);this.lockWake();this.last=performance.now();cancelAnimationFrame(this.raf);this.raf=requestAnimationFrame(n=>this.frame(n));$("#plPlay").focus()},
 /* the sentences one movement of the routine may need */
 linesFor(i){const it=this.routine.items[i];if(!it)return[];const m=M[it[0]],nx=this.routine.items[i+1],nm=nx&&M[nx[0]].name;
  return[SPEECH.intro(m,i===0,settings.springs),...m.cues,...presencePool(m),SPEECH.SWITCH,SPEECH.LAST,SPEECH.begin(!!m.sides),
   ...["in","out"].flatMap(l=>[SPEECH.breathWord(l,true,m.sound,false,false),SPEECH.breathWord(l,false,m.sound,false,false),SPEECH.breathWord(l,true,m.sound,true,!!m.sides)]),
   ...(nm?[SPEECH.tenNext(nm),SPEECH.next(nm)]:[MD.finish])]},
 async lockWake(){try{if("wakeLock" in navigator)this.wake=await navigator.wakeLock.request("screen")}catch(e){this.wake=null}},
 seg(){return this.segs[this.si]},
 enter(first){const g=this.seg(),m=g.m,n=this.routine.items.length;this.fired={};this.prevLab=null;this.breathN=0;
  if(g.kind==="arrive"){$("#plStep").textContent="Arrive";$("#plName").textContent=this.routine.name;$("#plHz").textContent=this.routine.hz||"";$("#plPy").textContent=fmtMin(this.total)+" minutes";
   $("#plPhase").textContent="Arrive";$("#plNextWrap").hidden=true;bowl(.6);
   say(MD.arrive,true);return}
  $("#plStep").textContent=g.kind==="prep"?`Up next · ${g.idx+1} of ${n}`:`${cap1(MD.unit[0])} ${g.idx+1} of ${n}`;
  $("#plName").textContent=m.name;$("#plHz").textContent=hzOf(m);$("#plPy").textContent=subOf(m)+(m.sides?" · both sides":"");
  $("#plPhase").textContent=g.kind==="prep"?(MD.springs?"Set springs":g.idx===0?"Get ready":"Up next"):m.sides?"Side one":"Practice";
  const nextIdx=g.idx+1;const nw=$("#plNextWrap");
  this.nextM=g.kind==="move"&&nextIdx<n?M[this.routine.items[nextIdx][0]]:null;nw.classList.remove("soon");
  if(this.nextM){nw.hidden=false;$("#plNextLabel").textContent="Up next";$("#plNext").textContent=this.nextM.name;$("#plNextC").hidden=false;drawScene($("#plNextC"),this.nextM,this.nextM.K[0],{pad:1.05,thumb:true})}
  else if(g.kind==="move"){nw.hidden=false;$("#plNextLabel").textContent="Last "+MD.unit[0];$("#plNext").textContent="Closing bell";$("#plNextC").hidden=true}
  else nw.hidden=true;
  if(g.kind==="prep"){say(SPEECH.intro(m,g.idx===0,settings.springs),!this.arrive||g.idx!==0);prefetch(this.linesFor(g.idx+1))}
  else{bowl(.7);this.idsDone.add(m.id);this.cuePlan=planCues(g)}},
 frame(now){const dt=Math.min(.1,(now-this.last)/1000);this.last=now;if(!this.seg())return;
  if(this.running&&this.active){const g=this.seg();const a=this.t;this.t+=dt;if(g.kind==="move")this.practiced+=dt;this.events(g,a,this.t);if(this.t>=g.dur)this.next()}
  if(this.active){this.render();this.raf=requestAnimationFrame(n=>this.frame(n))}},
 events(g,a,b){const cross=x=>a<x&&b>=x,B=MD.BIN+MD.BOUT,AB=SPEECH.ARRIVE_BREATH;
  if(g.kind==="arrive"){if(cross(B))say(AB[0],false,{caption:false});if(cross(B+MD.BIN))say(AB[1],false,{caption:false});
   if(cross(2*B))say(AB[2],false,{caption:false});if(cross(2*B+MD.BIN))say(AB[3],false,{caption:false});return}
  if(g.kind==="move")this.breathCue(g,b);
  if(g.kind==="prep"){[3,2,1].forEach(k=>{if(cross(g.dur-k))tick(false)})}
  else{(this.cuePlan||[]).forEach(c=>{if(cross(c.t))say(c.text,c.int);});if(g.m.sides&&cross(g.dur/2)){bowl(.5);$("#plPhase").textContent="Side two"}if(g.m.bellEvery)for(let k=g.m.bellEvery;k<g.dur-8;k+=g.m.bellEvery)if(cross(k))bowl(.3)}},
 /* spoken breath coaching: every breath for the first three cycles of a movement (or side), then every other cycle */
 breathCue(g,t){if(!settings.breath||!settings.voice)return;const m=g.m,half=m.sides&&t>=g.dur/2,lt=half?t-g.dur/2:t;
  const side=half?1:0;if(this.breathSide!==side){this.breathSide=side;this.breathN=0;this.prevLab=null}
  const bi=breathPhase(lt);if(bi.lab===this.prevLab)return;this.prevLab=bi.lab;
  if(g.dur-t<3)return;const n=this.breathN,opening=n===0&&t<1;
  if((m.tags.includes("meditation")||m.longHold)&&n>=4)return; /* in meditation the breath is guided only at the start */
  if(n>=6&&bi.n%2===1)return; /* after six spoken breaths, coach every other breath */
  if(!opening&&speaking())return;if((this.cuePlan||[]).some(c=>Math.abs(c.t-t)<2.5))return;
  const word=SPEECH.breathWord(bi.lab,n<2,m.sound,opening,!!m.sides);this.breathN++;
  say(word,false,{caption:opening?word+".":false})},
 next(){if(this.si>=this.segs.length-1){this.finish();return}this.si++;this.t=0;this.enter(false)},
 skip(d){if(!$("#plDone").hidden)return;const g=this.seg();let idx=g.idx;
  if(d>0){idx++;if(idx>=this.routine.items.length){this.finish();return}}
  else if(!(g.kind==="move"&&this.t>3))idx=Math.max(0,idx-1);
  this.si=idx*2+(this.arrive?1:0);this.t=0;this.enter(idx===0)},
 toggle(){this.running=!this.running;$("#plPlayIcon").innerHTML=this.running?'<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>':'<path d="M8 5v14l11-7z"/>';$("#plPlay").setAttribute("aria-label",this.running?"Pause":"Resume");
  try{this.running?speechSynthesis.resume():speechSynthesis.pause()}catch(e){}try{AC&&(this.running?AC.resume():AC.suspend())}catch(e){}
  if(!this.running)$("#plPhase").textContent="Paused";else{const g=this.seg();$("#plPhase").textContent=g.kind==="prep"?"Up next":g.m.sides&&this.t>=g.dur/2?"Side two":g.m.sides?"Side one":"Practice"}},
 finish(){this.running=false;bowl(1);setTimeout(()=>bowl(.6),2600);const mins=Math.max(1,Math.round(this.practiced/60));record(this.practiced,this.routine.name,[...this.idsDone]);this.recorded=true;
  say(MD.finish,true);
  $("#doneMin").textContent=mins;$("#doneSaying").innerHTML=sayingHTML(MD.sayings[this.routine.saying??Math.floor(Math.random()*MD.sayings.length)]);$("#doneStreak").textContent=streak();$("#plDone").hidden=false;$("#doneBtn").focus()},
 close(){if(this.active&&!this.recorded)record(this.practiced,this.routine.name,[...this.idsDone]);
  this.active=false;this.running=false;this.recorded=false;cancelAnimationFrame(this.raf);stopSpeech();try{AC&&AC.state==="suspended"&&AC.resume()}catch(e){}try{this.wake&&this.wake.release()}catch(e){}this.wake=null;
  $("#player").hidden=true;document.body.style.overflow=""},
 syncToggles(){$("#plBreathBtn").setAttribute("aria-pressed",String(settings.breath));$("#tBreath").setAttribute("aria-pressed",String(settings.breath));$("#plVoice").setAttribute("aria-pressed",String(settings.voice));$("#plBell").setAttribute("aria-pressed",String(settings.bell));$("#tVoice").setAttribute("aria-pressed",String(settings.voice));$("#tBell").setAttribute("aria-pressed",String(settings.bell))},
 render(){const g=this.seg();if(!g)return;const m=g.m;const c=$("#plCanvas");let pose,ghost=null,bi,fr=stageFrame(m);
  if(g.kind!=="move"){bi=breathPhase(this.t);const start=m.K[0];pose=start;
   /* glide from where the last movement ended into this one's starting pose; a change of view cross-fades */
   const lp=this.lastPose;if(g.kind==="prep"&&lp&&this.t<MORPH&&!reduced){const u=ease(this.t/MORPH);
    if(lp.m.view===m.view&&lp.m.mode===m.mode&&!lp.m.alt&&!m.alt){pose=lerpPose(lp.p,start,u);fr=lerpFrame(lp.fr,fr,u)}
    else{drawMove(c,lp.m,{p:lp.p,ap:lp.ap},{pad:.8,frame:lp.fr,stage:true,bg:COL.paper,alpha:1-u,ring:0});drawMove(c,m,{p:start,ap:m.alt&&m.alt.K[0]},{pad:.8,stage:true,bg:COL.paper,alpha:u,keep:true,breath:breathAmt(this.t)});this.hud(g,bi);return}}}
  else{const half=m.sides&&this.t>=g.dur/2;const lt=half?this.t-g.dur/2:this.t;const r=animBoth(m,lt,half);pose=r.p;ghost=r.nx;this.alt=r;bi=breathPhase(lt);if(m.count)bi.count=bi.n%m.count+1;this.lastPose={m,p:pose,fr,ap:r.ap}}
  if(g.kind!=="move")this.alt={ap:m.alt&&m.alt.K[0]};
  drawMove(c,m,{p:pose,nx:ghost,ap:this.alt.ap,anx:this.alt.anx},{pad:.8,frame:fr,stage:true,bg:COL.paper,breath:breathAmt(g.kind==="move"&&m.sides&&this.t>=g.dur/2?this.t-g.dur/2:this.t),ring:g.kind==="move"?Math.min(1,this.t/g.dur):0});
  this.hud(g,bi)},
 hud(g,bi){const m=g.m;$("#plTime").textContent=fmt(g.dur-this.t);
  let done=0;for(let i=0;i<this.si;i++)done+=this.segs[i].dur;done+=this.t;$("#plRemain").textContent=fmt(this.total-done)+" remaining";
  const bars=$("#plBar").children;for(let i=0;i<bars.length;i++){const fi=bars[i].firstChild;let f=0;if(i<g.idx)f=1;else if(i===g.idx&&g.kind==="move")f=this.t/g.dur;fi.style.width=(f*100)+"%"}
  if(g.kind==="move"){const left=g.dur-this.t,soon=left<=10,nw=$("#plNextWrap");$("#plNextIn").textContent="in "+fmt(left);nw.classList.toggle("soon",soon);
   if(soon&&this.nextM&&!reduced)drawScene($("#plNextC"),this.nextM,animPose(this.nextM,this.t).p,{pad:1.05,thumb:true})}
  $("#plBreath").textContent=BL[bi.lab];$("#plBreathN").textContent=bi.count?`${Math.ceil(bi.rem)} · count ${bi.count}/${m.count}`:Math.ceil(bi.rem)+"";
  const sc=bi.lab==="in"?.55+.45*ease(bi.prog):1-.45*ease(bi.prog);$("#plOrb").style.transform=`scale(${sc.toFixed(3)})`;this.glow(sc)},
 glow(sc){const k=Math.max(0,Math.min(1,(sc-.55)/.45)),e=$("#plGlow");e.style.opacity=(.08+.92*k).toFixed(3);if(!reduced)e.style.transform=`scale(${(.72+.5*k).toFixed(3)})`}
};
function planCues(g){const m=g.m,d=g.dur,out=[];const lines=[];m.cues.forEach(c=>{lines.push(c);lines.push(presenceFor(m,player.usedPres))});
 /* with breath coaching, "Begin" rides on the first breath word and form cues wait until the first breath cycle has been guided */
 const coached=settings.breath&&settings.voice;if(!coached)out.push({t:.4,text:SPEECH.begin(!!m.sides),int:false});
 const B=MD.BIN+MD.BOUT,t0=coached?B+1:6; /* the first breath is guided before any form cue */
 const marks=[];if(m.sides)marks.push(d/2);if(d>=35)marks.push(d-10);
 const iv=m.cueGap||Math.max(15,Math.min(28,d/(m.cues.length+1)));let k=0;
 const med=m.tags.includes("meditation")||!!m.longHold;for(let t=t0;t<d-6&&k<lines.length*(med?1:2);t+=iv){if(marks.some(x=>Math.abs(x-t)<6))continue;out.push({t,text:lines[k%lines.length]});k++}
 if(m.sides)out.push({t:d/2,text:SPEECH.SWITCH,int:true});
 const nx=player.routine.items[g.idx+1],nxName=nx&&M[nx[0]].name;
 if(d>=35)out.push({t:d-10,text:med?SPEECH.RETURN:nxName?SPEECH.tenNext(nxName):SPEECH.LAST});
 else if(d>=20&&nxName)out.push({t:d-6,text:SPEECH.next(nxName)});
 return out}

/* controls */
$("#plPlay").onclick=()=>player.toggle();
$("#plNextBtn").onclick=()=>player.skip(1);
$("#plPrev").onclick=()=>player.skip(-1);
$("#plClose").onclick=()=>player.close();
$("#doneBtn").onclick=()=>player.close();
const tv=()=>{settings.voice=!settings.voice;saveSettings();player.syncToggles();if(!settings.voice)stopSpeech()};
const tb=()=>{settings.bell=!settings.bell;saveSettings();player.syncToggles();if(settings.bell)bowl(.5)};
const tbr=()=>{settings.breath=!settings.breath;saveSettings();player.syncToggles()};
$("#plBreathBtn").onclick=tbr;$("#tBreath").onclick=tbr;
$("#plVoice").onclick=tv;$("#tVoice").onclick=tv;$("#plBell").onclick=tb;$("#tBell").onclick=tb;
/* ---------- the voice panel: choose the calm recorded voice or the device's own, and save modes for offline use ---------- */
const canSave=()=>!!(VO.clips&&navigator.serviceWorker&&navigator.serviceWorker.controller);
const saving={}; /* mode id -> progress 0..1 while downloading */
function syncVoiceBtn(){const b=$("#tVoiceKind");b.hidden=!VO.clips;b.textContent=settings.voiceKind==="device"?"Voice: device":"Voice: calm";b.setAttribute("aria-label",b.textContent+". Voice settings");if(!$("#sheet").hidden&&$("#voicePanel"))renderVoicePanel()}
const modeKeys=md=>[...new Set(SPEECH.lines(md).map(SPEECH.key))].filter(k=>VO.clips[k]);
const modeMB=md=>Math.max(1,Math.round(modeKeys(md).reduce((a,k)=>a+VO.clips[k],0)*5.2/1e6));
function renderVoicePanel(){const box=$("#voicePanel");if(!box)return;const nat=settings.voiceKind!=="device";
 box.querySelectorAll("[data-k]").forEach(b=>b.setAttribute("aria-checked",String((b.dataset.k==="natural")===nat)));
 const ul=$("#voiceSave");ul.innerHTML="";const ok=canSave();
 MODES.forEach(md=>{const st=saving[md.id],saved=(settings.voiceSaved||{})[md.id];
  const li=el("li",{},`<span><b>${esc(md.name)}</b><small>${st!=null?`Saving… ${Math.round(st*100)}%`:saved?"Saved on this device":`About ${modeMB(md)} MB`}</small></span>`);
  const b=el("button",{type:"button",class:"chip"},st!=null?"Saving…":saved?"Update":"Save");b.disabled=!ok||st!=null||!nat;b.onclick=()=>saveVoice(md);li.appendChild(b);ul.appendChild(li)});
 $("#voiceSaveNote").textContent=!nat?"Offline saving is for the calm voice. The device voice needs no download.":ok?"The calm voice downloads as you practice. Save a mode to use it with no connection at all.":"Saving for offline works once the app is opened from its web address or installed on your home screen."}
async function saveVoice(md){if(saving[md.id]!=null||!canSave())return;const keys=modeKeys(md),total=keys.length;let done=0,fail=0;saving[md.id]=0;renderVoicePanel();
 const step=async()=>{while(keys.length){const k=keys.pop();try{const r=await fetch("voice/"+k+".mp3");if(!r.ok)fail++}catch(e){fail++}done++;saving[md.id]=done/total;if(done%10===0||done===total)renderVoicePanel()}};
 await Promise.all([step(),step(),step(),step()]);delete saving[md.id];
 if(!fail){settings.voiceSaved=Object.assign({},settings.voiceSaved,{[md.id]:true});saveSettings()}renderVoicePanel();
 if(fail){const n=$("#voiceSaveNote");if(n)n.textContent=`${fail} voice files didn't download. Check the connection and try again.`}}
function openVoice(){openSheet(`<div class="pbody" id="voicePanel">${XBTN}<h2 id="sheetTitle">Voice</h2><p class="muted">Choose who guides your practice. Each plays a short sample.</p>
 <div class="vchoice" role="radiogroup" aria-label="Voice">
  <button type="button" role="radio" data-k="natural"><b>Calm voice</b><small>A soft recorded voice, the same on every device</small></button>
  <button type="button" role="radio" data-k="device"><b>Device voice</b><small>Your phone or computer's built-in speech</small></button></div>
 <div><div class="eyebrow" style="margin-bottom:6px">Use without a connection</div><p class="muted" style="font-size:13px;margin:0 0 6px" id="voiceSaveNote"></p><ul class="vsave" id="voiceSave"></ul></div></div>`,true);
 $("#panel .x").onclick=closeSheet;
 $("#voicePanel").querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>{settings.voiceKind=b.dataset.k;saveSettings();syncVoiceBtn();renderVoicePanel();stopSpeech();say("Breathe in. And slowly out.",true,{caption:false})});
 renderVoicePanel()}
$("#tVoiceKind").onclick=openVoice;
document.addEventListener("keydown",e=>{
 if(player.active){if(e.key===" "){e.preventDefault();if($("#plDone").hidden)player.toggle()}else if(e.key==="ArrowRight")player.skip(1);else if(e.key==="ArrowLeft")player.skip(-1);else if(e.key==="Escape")player.close();return}
 if(!$("#sheet").hidden&&e.key==="Escape")closeSheet()});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&player.active&&player.running)player.toggle();if(!document.hidden&&player.active&&!player.wake)player.lockWake()});

$("#cMin").addEventListener("input",e=>{cMin=+e.target.value;store.set("cMin."+MD.id,cMin);renderCompose()});
$("#cGo").onclick=()=>player.start(composed);

/* ---------- modes ---------- */
function renderModes(){const box=$("#modes");box.innerHTML="";MODES.forEach(md=>{const b=el("button",{type:"button",role:"tab","aria-selected":String(md===MD),class:"mode-tab","data-m":md.id},`<b>${esc(md.name)}</b><small>${esc(md.tagline)}</small>`);
 b.onclick=()=>setMode(md.id);box.appendChild(b)})}
function setMode(id,first){const md=MODE_BY[id];if(!md||(!first&&md===MD))return;MD=md;M=md.M;settings.mode=id;saveSettings();
 document.documentElement.dataset.mode=id;try{window.history.replaceState(null,"",location.pathname+location.search.replace(/[?&]mode=[^&]*/,"")+"#"+id)}catch(e){}
 const th=$('meta[name="theme-color"]');readColors();if(th)th.setAttribute("content",COL.paper);
 cFocus=store.get("cFocus."+id,md.foci[0][0]);if(!md.pools[cFocus])cFocus=md.foci[0][0];cMin=store.get("cMin."+id,md.id==="pilates"?15:12);tagF="all";durF="all";statics=[];
 $("#rBlurb").textContent=md.blurb.routines;$("#cBlurb").textContent=md.blurb.compose;$("#lBlurb").textContent=md.blurb.lib;$("#note").textContent=md.note;
 $("#lTitle").textContent=md.id==="yoga"?"Pose library":md.id==="movement"?"Movement library":"Exercise library";
 renderModes();syncSprings();syncVoiceBtn();renderLog();setupHero();renderRoutines();renderCompose();renderLib()}

addEventListener("hashchange",()=>{const id=location.hash.slice(1);if(MODE_BY[id]&&!player.active)setMode(id)});

/* theme + resize */
new MutationObserver(redrawAll).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme","class","style"]});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change",redrawAll);
let rz=0;addEventListener("resize",()=>{clearTimeout(rz);rz=setTimeout(redrawAll,120)});

/* install + offline */
const standalone=matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
let installEvt=null;const inst=$("#tInstall");
addEventListener("beforeinstallprompt",e=>{e.preventDefault();installEvt=e;inst.hidden=false});
addEventListener("appinstalled",()=>{installEvt=null;inst.hidden=true});
if(!standalone&&isIOS)inst.hidden=false;
const SHARE_ICON=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-label="Share"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M6 11v9h12v-9"/></svg>`;
inst.onclick=()=>{if(installEvt){installEvt.prompt();installEvt.userChoice.finally(()=>{installEvt=null;inst.hidden=true});return}
 openSheet(`<div class="pbody">${XBTN}<h2 id="sheetTitle">Install Daily Practice</h2><p class="muted">Add it to your home screen and it opens full-screen and works without a connection.</p>
 <ol class="steps"><li>Open this page in <b>Safari</b>.</li><li>Tap the Share button ${SHARE_ICON} in the toolbar.</li><li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol></div>`,true);$("#panel .x").onclick=closeSheet};
if("serviceWorker" in navigator&&/^https?:$/.test(location.protocol)&&!/^(localhost|127\.)/.test(location.hostname)){
 /* When an update installs while the app is open, reload into it, but never mid-practice. */
 const hadController=!!navigator.serviceWorker.controller;let reloaded=false;
 navigator.serviceWorker.addEventListener("controllerchange",()=>{if(!hadController||reloaded)return;const go=()=>{if(player.active)return setTimeout(go,5000);reloaded=true;location.reload()};go()});
 navigator.serviceWorker.addEventListener("controllerchange",()=>syncVoiceBtn());
 navigator.serviceWorker.register("sw.js",{updateViaCache:"none"}).then(r=>r.update()).catch(()=>{})}

/* ---------- start ---------- */
MODES.forEach(md=>{md.M=Object.fromEntries(md.moves.map(m=>[m.id,m]));
 md.moves.forEach(m=>{m.mode=md;const B=m.view==="side"?SIDE:FRONT;const base=Object.assign({},B,m.base||{});m.K=m.keys.map(k=>Object.assign({},base,k));m.C=m.beats.reduce((a,b)=>a+b,0);buildTimeline(m);
  /* a second camera: the same timing, with its own keyframes drawn from the other view */
  if(m.alt&&!m.alt.K){const a=m.alt,A=Object.assign({},m,{view:a.view,prop:a.prop,frame:null,alt:null});const b=Object.assign({},a.view==="side"?SIDE:FRONT,a.base||{});
   A.K=a.keys.map(k=>Object.assign({},b,k));if(A.K.length!==m.K.length)console.warn("alt keys must match",m.id);m.alt=A}})});
M=MD.M;
player.syncToggles();syncVoiceBtn();setMode(MD.id,true);
if(/[?&]sheet=/.test(location.search))setTimeout(()=>{const s=document.createElement("script");s.src="tools/sheet.js";document.body.appendChild(s)}); /* authoring aid */
window.__dp={MODES,get MD(){return MD},setMode,mirror,say,drawMove,animBoth,solveM,poseAt,animPose,breathPhase,quant,drawScene,frameOf,player,dailyPractice,routineSecs,compose,SPEECH,VO};
})();
