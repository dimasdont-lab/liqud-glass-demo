/* Voice Finance Motion format 1. Shared by the app and the visual editor. */
(()=>{'use strict';
const KEY='vf-liquid-motion-v1',draftKey=KEY+'-draft',clone=x=>JSON.parse(JSON.stringify(x));
const studio=new URLSearchParams(location.search).has('studio');
if(studio)document.body.classList.add('studio-preview');
let profile=null,frame=null,live=null;
const baseAnimate=animateDockLiquid,baseOpen=openSheet,baseClose=closeSheet;
const geometry=['entry','entryRim','entryBulge','nav','active','navRim','activeRim','neck','drop','drop2','drop3','shine','entryHtml','indicator'];
function complete(s){s=clone(s);s.entryRim=s.entryRim||s.entry.slice();return s}
const trackParts={entry:['entry','entryRim','entryHtml','entryBulge','shine'],active:['active','activeRim'],nav:['nav','navRim'],indicator:['indicator'],neck:['neck','drop','drop2','drop3'],button0:[],button1:[],button2:[],button3:[],button4:[]};
function upgradeTracks(p){p=clone(p);for(const tr of Object.values(p.transitions)){tr.tracks??={};for(const key of Object.keys(trackParts))tr.tracks[key]??={duration:tr.duration,delay:0,curve:tr.curve.slice(),frames:clone(tr.frames)}}return p}
function defaults(){
 const expanded=complete(dockLiquidTargets('expanded')),compact=complete(dockLiquidTargets('compact')),drawer=complete(dockLiquidTargets('drawer'));
 const transition=(frames,duration)=>({duration,curve:[.42,0,.58,1],frames:frames.map((s,i)=>({t:i/(frames.length-1),state:complete(s)}))});
 const press=clone(expanded);press.indicator[0]=6-16;
 const swollen=clone(expanded);swollen.indicator[0]-=6;swollen.indicator[1]-=5;swollen.indicator[2]+=12;swollen.indicator[3]+=10;
 return {format:'voice-finance-motion',version:1,referenceWidth:expanded.w,
 material:{color:'#242428',opacity:.9,blur:15,lens:1.2,border:1,borderOpacity:.3,accent:'#ff375f'},
 indicatorMaterial:{color:'#09090a',opacity:.8,blur:8,lens:1,border:1,borderOpacity:.28},
 liquid:{enabled:true,strength:1,reach:50,neck:1,tension:.28,blur:3.6},
 transitions:{expand:transition(dockExpansionFrames(compact,expanded),1120),collapse:transition(dockCollapseFrames(expanded,compact),1060),more:transition([expanded,drawer],920),back:transition([drawer,expanded],920),press:transition([press,swollen,expanded],820)},
 popups:{drawer:{duration:400,curve:[.22,.9,.28,1],color:'#17171b',opacity:.95,blur:15,radius:30,border:1,frames:[{t:0,v:[104,0,.72,1]},{t:1,v:[0,0,1,1]}]},sheet:{duration:400,curve:[.22,.9,.28,1],color:'#17171b',opacity:.95,blur:15,radius:34,border:1,frames:[{t:0,v:[0,100,.72,1]},{t:1,v:[0,0,1,1]}]}}};
}
function validate(p){
 if(!p||typeof p!=='object')throw Error('Некоректний пресет');
 p=clone(p);
 // Migrate the former indicator color into its own non-animated material group.
 p.indicatorMaterial??={color:p.material?.indicator||'#09090a',opacity:.8,blur:8,lens:1,border:1,borderOpacity:.28};
 delete p.material?.indicator;
 if(!p||p.format!=='voice-finance-motion'||p.version!==1||!Number.isFinite(p.referenceWidth)||p.referenceWidth<200)throw Error('Непідтримуваний формат пресета');
 const numeric=a=>Array.isArray(a)&&a.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<100000);
 for(const name of ['expand','collapse','more','back','press']){const tr=p.transitions?.[name];if(!tr||tr.duration<80||tr.duration>10000||!numeric(tr.curve)||tr.curve.length!==4||tr.frames.length<2||tr.frames.length>100)throw Error('Некоректний перехід '+name);let last=-1;for(const f of tr.frames){if(!Number.isFinite(f.t)||f.t<=last||f.t<0||f.t>1)throw Error('Ключі мають іти послідовно');last=f.t;for(const k of geometry)if(!numeric(f.state?.[k]))throw Error('Некоректна форма '+k);if(f.state.buttons?.length!==5||!f.state.buttons.every(numeric))throw Error('Некоректні кнопки')}if(tr.frames[0].t!==0||last!==1)throw Error('Потрібні крайні ключі 0 і 100%')}
 for(const k of ['color','accent'])if(!/^#[a-f0-9]{6}$/i.test(p.material?.[k]))throw Error('Некоректний колір');
 for(const k of ['color'])if(!/^#[a-f0-9]{6}$/i.test(p.indicatorMaterial?.[k]))throw Error('Некоректний колір індикатора');
 for(const name of ['drawer','sheet']){const q=p.popups?.[name];if(!q||!/^#[a-f0-9]{6}$/i.test(q.color)||!numeric(q.curve)||q.frames.length<2||q.duration<80||q.duration>10000)throw Error('Некоректне вікно');let last=-1;for(const f of q.frames){if(!numeric(f.v)||f.v.length!==4||f.t<=last||f.t<0||f.t>1)throw Error('Некоректні ключі вікна');last=f.t}if(q.frames[0].t!==0||last!==1)throw Error('Некоректні межі вікна')}
 for(const group of [p.material,p.indicatorMaterial,p.liquid])for(const v of Object.values(group))if(typeof v==='number'&&(!Number.isFinite(v)||Math.abs(v)>10000))throw Error('Некоректне значення');
 for(const tr of Object.values(p.transitions)){if(tr.curve.some(v=>v<0||v>1))throw Error('Крива виходить за межі');for(const f of tr.frames){for(const k of geometry){const expected=k==='entryHtml'?13:['entry','entryRim','nav','active','navRim','activeRim','indicator'].includes(k)?6:5;if(f.state[k].length!==expected)throw Error('Неповна геометрія '+k)}if(f.state.buttons.some(b=>b.length!==8))throw Error('Неповна геометрія кнопки')}}
 for(const tr of Object.values(p.transitions))for(const [key,part]of Object.entries(tr.tracks||{})){
  if(!Object.hasOwn(trackParts,key)||!Number.isFinite(part.duration)||part.duration<=0||part.duration>10000||!Number.isFinite(part.delay)||part.delay<0||part.delay+part.duration>tr.duration+.01||!numeric(part.curve)||part.curve.length!==4||part.curve.some(v=>v<0||v>1)||!Array.isArray(part.frames)||part.frames.length<2||part.frames.length>100)throw Error('Некоректна доріжка '+key);
  let previous=-1;for(const f of part.frames){if(!Number.isFinite(f.t)||f.t<=previous||f.t<0||f.t>1)throw Error('Некоректний час ключа '+key);previous=f.t;for(const k of geometry){const expected=k==='entryHtml'?13:['entry','entryRim','nav','active','navRim','activeRim','indicator'].includes(k)?6:5;if(!numeric(f.state?.[k])||f.state[k].length!==expected)throw Error('Некоректна форма доріжки')}if(f.state.buttons?.length!==5||f.state.buttons.some(b=>!numeric(b)||b.length!==8))throw Error('Некоректні кнопки доріжки')}
  if(part.frames[0].t!==0||previous!==1)throw Error('Доріжка потребує крайніх ключів');
 }
 const normalized=clone(p);delete normalized.surfaces;
 // The glass material is profile-wide, never per-frame animation data.
 for(const tr of Object.values(normalized.transitions||{})){
  for(const f of tr.frames||[])delete f.state?.material;
  for(const part of Object.values(tr.tracks||{}))for(const f of part.frames||[])delete f.state?.material;
 }
 return normalized;
}
function ease(t,c){const [x1,y1,x2,y2]=c,bezier=(u,a,b)=>3*(1-u)**2*u*a+3*(1-u)*u*u*b+u**3;let lo=0,hi=1;for(let i=0;i<18;i++){const m=(lo+hi)/2;if(bezier(m,x1,x2)<t)lo=m;else hi=m}return bezier((lo+hi)/2,y1,y2)}
function scale(s){s=clone(s);const w=document.querySelector('.dock-layout').clientWidth,r=w/profile.referenceWidth;s.w=w;for(const k of geometry){s[k][0]*=r;s[k][2]*=r}for(const b of s.buttons){b[0]*=r;b[2]*=r}return s}
function warped(frames,t,curve){let i=0;while(i<frames.length-2&&t>frames[i+1].t)i++;const a=frames[i].t,b=frames[i+1].t;return a+(b-a)*ease(Math.max(0,Math.min(1,(t-a)/(b-a))),curve)}
function samplePart(part,t){return sampleDockExpansion(part.frames.map(f=>f.state),warped(part.frames,t,part.curve),part.frames.map(f=>f.t))}
function sample(name,t){const tr=profile.transitions[name],raw=clone(samplePart(tr,t));
 for(const [key,part]of Object.entries(tr.tracks||{})){const local=Math.max(0,Math.min(1,(t*tr.duration-part.delay)/part.duration)),s=samplePart(part,local);for(const k of trackParts[key])raw[k]=s[k];if(key.startsWith('button'))raw.buttons[+key.slice(6)]=s.buttons[+key.slice(6)]}
 const s=scale(raw);if(!studio){const buttons=[...document.querySelectorAll('.dock-group>button:not(.compact-active-btn)')],i=Math.max(0,buttons.findIndex(b=>b.dataset.screen&&b.classList.contains('active'))),c=name==='collapse'?t:name==='expand'?1-t:0;if(i<3){s.indicator[0]+=(i-3)*(s.w-12)/5*(1-c)-(s.w-124)*c;if(i!==2){const a=s.buttons[i].slice(),b=s.buttons[2].slice();s.buttons[i]=a.map((v,j)=>v+(b[j]-v)*c);s.buttons[2]=b.map((v,j)=>v+(a[j]-v)*c)}}}return s}
function liquid(s){s=clone(s);const l=profile.liquid;if(!l.enabled){for(const k of ['neck','drop','drop2','drop3','entryBulge'])s[k][4]=0;return s}const gap=Math.max(0,s.nav[0]-s.active[0]-s.active[2]);s.neck[3]*=l.neck*l.strength;s.neck[4]*=gap>l.reach?Math.max(0,1-(gap-l.reach)/Math.max(1,l.reach)):1;for(const k of ['drop','drop2','drop3','entryBulge']){s[k][2]*=l.strength;s[k][3]*=l.strength}return s}
function rgba(hex,alpha){const n=parseInt(hex.slice(1),16);return`rgba(${n>>16},${n>>8&255},${n&255},${Math.max(0,Math.min(1,alpha))})`}
function material(){const m=profile.material,i=profile.indicatorMaterial,root=document.documentElement,group=document.querySelector('.dock-group'),entry=document.querySelector('.quick-entry-shell'),indicator=document.querySelector('.dock-indicator');
 root.style.setProperty('--accent',m.accent);root.style.setProperty('--dock-glass-bg',rgba(m.color,m.opacity));root.style.setProperty('--dock-glass-border',m.border+'px');root.style.setProperty('--dock-glass-border-opacity',m.borderOpacity);root.style.setProperty('--dock-glass-blur',m.blur+'px');root.style.setProperty('--dock-glass-lens',m.lens);
 root.style.setProperty('--dock-indicator-fill',rgba(i.color,i.opacity));root.style.setProperty('--dock-indicator-bg',rgba(i.color,i.opacity));root.style.setProperty('--dock-indicator-border',i.border+'px');root.style.setProperty('--dock-indicator-border-opacity',i.borderOpacity);root.style.setProperty('--dock-indicator-blur',i.blur+'px');root.style.setProperty('--dock-indicator-lens',i.lens);
 document.querySelectorAll('#dockGlassFill stop').forEach(n=>n.setAttribute('stop-color',m.color));
 // SVG goo geometry is retained for liquid motion; actual glass/refraction is rendered by HTML layers for iOS Safari.
 // Keep the liquid SVG as the visible glass silhouette. The HTML surfaces above it
 // are blur-only, so the neck/drops remain visible instead of being hidden by a plate.
 const entryGlass=document.querySelector('.dock-entry-glass'),dockGlass=document.querySelector('.dock-liquid-mass');if(entryGlass)entryGlass.style.opacity=Math.min(.22,m.opacity*.22);if(dockGlass)dockGlass.style.opacity=m.opacity;
 document.querySelectorAll('.dock-liquid-rim').forEach(n=>{n.style.strokeWidth=m.border;n.style.opacity=m.borderOpacity});document.querySelector('#dockLiquidGlass feGaussianBlur')?.setAttribute('stdDeviation',profile.liquid.enabled?profile.liquid.blur:0);document.querySelector('#liquidShine').style.filter=`brightness(${m.lens})`;if(entry){entry.style.backgroundColor=rgba(m.color,m.opacity);entry.style.border=`${m.border}px solid rgba(255,255,255,${m.borderOpacity})`;entry.style.backdropFilter=entry.style.webkitBackdropFilter=`blur(${m.blur}px) saturate(${m.lens})`}if(indicator){indicator.style.backdropFilter=indicator.style.webkitBackdropFilter=`blur(${i.blur}px) saturate(${i.lens})`;indicator.style.border=`${i.border}px solid rgba(255,255,255,${i.borderOpacity})`}if(group)group.style.setProperty('--dock-indicator-fill',rgba(i.color,i.opacity))}
function draw(s){live=s;dockLiquidCurrent=s;renderDockLiquid(liquid(s));renderDockChrome(s)}
function run(name,from){cancelAnimationFrame(frame);cancelAnimationFrame(dockLiquidFrame);const tr=profile.transitions[name],origin=sample(name,0),began=performance.now();const tick=now=>{const t=Math.min(1,(now-began)/tr.duration);let s=sample(name,t);if(from)s=rejoinDockMorph(s,from,origin,1-dockSmoothStep(Math.min(1,t/.45)));draw(s);if(t<1)frame=requestAnimationFrame(tick);else{frame=null;dockLiquidFrame=null}};frame=requestAnimationFrame(tick)}
animateDockLiquid=function(mode){if(!profile)return baseAnimate(mode);const next=mode==='drawer'?'drawer':mode?'compact':'expanded',prior=dockLiquidMode;dockLiquidMode=next;const name=next==='drawer'?'more':prior==='drawer'?'back':next===prior?'press':next==='compact'?'collapse':'expand';if(!studio)run(name,live||dockLiquidCurrent)};
function popupSample(kind,t){const q=profile.popups[kind],p=warped(q.frames,t,q.curve);let i=0;while(i<q.frames.length-2&&p>q.frames[i+1].t)i++;const a=q.frames[i],b=q.frames[i+1],u=Math.max(0,Math.min(1,(p-a.t)/(b.t-a.t)));return a.v.map((v,j)=>v+(b.v[j]-v)*u)}
function popupStyle(el,kind,t){const q=profile.popups[kind],v=popupSample(kind,t);Object.assign(el.style,{transform:`translate(${v[0]}%,${v[1]}%) scale(${v[2]})`,opacity:v[3],background:q.color+Math.round(q.opacity*255).toString(16).padStart(2,'0'),backdropFilter:`blur(${q.blur}px)`,borderRadius:q.radius+'px',borderWidth:q.border+'px',transition:'none',width:`min(${q.width|| (kind==='drawer'?360:480)}px,100%)`,maxHeight:(q.height||90)+'dvh'})}
const popupFrames=new WeakMap();
function popupRun(el,kind,closing,done){if(!profile||!el)return;cancelAnimationFrame(popupFrames.get(el));const began=performance.now(),duration=profile.popups[kind].duration;const tick=now=>{const p=Math.min(1,(now-began)/duration);popupStyle(el,kind,closing?1-p:p);if(p<1)popupFrames.set(el,requestAnimationFrame(tick));else done?.()};popupFrames.set(el,requestAnimationFrame(tick))}
openSheet=function(id){baseOpen(id);if(profile)popupRun(document.querySelector(id+' .sheet'),'sheet',false)};
closeSheet=function(id){if(profile&&document.querySelector(id)?.classList.contains('open'))popupRun(document.querySelector(id+' .sheet'),'sheet',true,()=>baseClose(id));else baseClose(id)};
function send(type,extra={}){if(studio)parent.postMessage({source:'vf-motion',type,...extra},location.origin)}
function seek(name,t,popup){cancelAnimationFrame(frame);cancelAnimationFrame(dockLiquidFrame);if(popup){const kind=popup,el=kind==='drawer'?document.querySelector('.profile-drawer'):document.querySelector('#settingsBackdrop .sheet');document.querySelector('.profile-drawer-backdrop').classList.toggle('open',kind==='drawer');document.querySelector('#settingsBackdrop').classList.toggle('open',kind==='sheet');popupStyle(el,kind,t)}else{document.querySelectorAll('.profile-drawer-backdrop,.sheet-backdrop').forEach(n=>n.classList.remove('open'));document.body.classList.remove('drawer-open');draw(sample(name,t))}}
window.VFMotion={validate,ease,defaults,sample,seek,upgradeTracks,get tension(){return profile?.liquid.tension??.28},get profile(){return clone(profile)},set(p){profile=validate(p);material()},clear(){localStorage.removeItem(KEY);location.reload()}};
try{const saved=localStorage.getItem(studio?draftKey:KEY);if(saved)profile=validate(JSON.parse(saved))}catch(e){console.warn('Motion preset ignored:',e.message)}
if(studio){profile=profile||defaults();material();addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.source!=='vf-editor')return;try{const d=e.data;if(d.type==='preset'){profile=validate(d.profile);material();seek(d.transition,d.t,d.popup)}if(d.type==='seek')seek(d.transition,d.t,d.popup);if(d.type==='save'){localStorage.setItem(KEY,JSON.stringify(validate(d.profile)));send('saved')}if(d.type==='reset')send('ready',{profile:defaults()});}catch(err){send('error',{message:err.message})}});setTimeout(()=>{cancelAnimationFrame(dockLiquidFrame);send('ready',{profile});seek('expand',0)},1100)}else if(profile){material();draw(sample('expand',1));const observer=new MutationObserver(()=>{const b=document.querySelector('.profile-drawer-backdrop');popupRun(b.querySelector('.profile-drawer'),'drawer',!b.classList.contains('open'))});observer.observe(document.querySelector('.profile-drawer-backdrop'),{attributes:true,attributeFilter:['class']})}
})();
