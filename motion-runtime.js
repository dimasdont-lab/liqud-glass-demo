/* Voice Finance Motion format 1. Shared by the app and the visual editor. */
(()=>{'use strict';
const KEY='vf-liquid-motion-v1',draftKey=KEY+'-draft',bundleKey=KEY+'-bundle-revision',disabledKey=KEY+'-disabled',bundleRevision='103',clone=x=>JSON.parse(JSON.stringify(x));
const studio=new URLSearchParams(location.search).has('studio');
if(studio)document.body.classList.add('studio-preview');
let profile=null,frame=null,live=null,studioLive=false;
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
 material:{color:'#242428',opacity:.9,blur:15,lens:1.2,border:1,borderHorizontal:1,borderVertical:1,borderFade:0,borderFadeSpan:18,borderOpacity:.3,accent:'#ff375f'},
 indicatorMaterial:{color:'#09090a',opacity:.8,blur:8,lens:1,border:1,borderOpacity:.28},
 radialBlur:{center:12.5,edge:43.75,edgeStart:70,feather:6,units:'percent'},
 popupBlur:{drawer:{center:2.5,edge:8.75,edgeStart:70,feather:6,units:'percent'},sheet:{center:2.5,edge:8.75,edgeStart:70,feather:6,units:'percent'}},
 zoom:{dock:{value:0,units:'px'},drawer:{value:0,units:'px'},sheet:{value:0,units:'px'}},
 innerPanels:{drawer:{size:1,opacity:.045,blur:8,radius:24},sheet:{size:1,opacity:.06,blur:8,radius:18}},
 environment:{topHeight:10,topBlur:16,topShade:.2,dockShade:.22,drawerShade:.38,sheetShade:.38},
 backdropMotion:{drawer:{pageX:-86,pageY:0,pageScale:1,dockX:0,dockY:0,dockScale:1},sheet:{pageX:0,pageY:0,pageScale:1,dockX:0,dockY:0,dockScale:1,drawerX:0,drawerY:0,drawerScale:1}},
 liquid:{enabled:true,strength:1,reach:50,neck:1,tension:.28,blur:3.6},
 transitions:{expand:transition(dockExpansionFrames(compact,expanded),1120),collapse:transition(dockCollapseFrames(expanded,compact),1060),more:transition([expanded,drawer],920),back:transition([drawer,expanded],920),press:transition([press,swollen,expanded],820)},
 popups:{drawer:{duration:400,curve:[.22,.9,.28,1],color:'#17171b',opacity:.95,blur:15,radius:30,border:1,frames:[{t:0,v:[104,0,.72,1]},{t:1,v:[0,0,1,1]}]},sheet:{duration:400,curve:[.22,.9,.28,1],color:'#17171b',opacity:.95,blur:15,radius:34,border:1,frames:[{t:0,v:[0,100,.72,1]},{t:1,v:[0,0,1,1]}]}}};
}
function validate(p){
 if(!p||typeof p!=='object')throw Error('Некоректний пресет');
 p=clone(p);
 // Migrate the former indicator color into its own non-animated material group.
 p.indicatorMaterial??={color:p.material?.indicator||'#09090a',opacity:.8,blur:8,lens:1,border:1,borderOpacity:.28};
 p.radialBlur??={center:p.material?.blur??8,middle:Math.min(60,(p.material?.blur??8)*1.6),edge:Math.min(60,(p.material?.blur??8)*2.6),innerStop:50,outerStop:90,feather:6};
 p.popupBlur??={drawer:clone(p.radialBlur.units==='percent'?{center:2.5,middle:4.7,edge:8.75,innerStop:50,outerStop:90,feather:6,units:'percent'}:p.radialBlur),sheet:clone(p.radialBlur.units==='percent'?{center:2.5,middle:4.7,edge:8.75,innerStop:50,outerStop:90,feather:6,units:'percent'}:p.radialBlur)};
 // Legacy refraction settings are intentionally dropped: the effect is gone.
 delete p.reflections;
 p.zoom??=clone(defaults().zoom);for(const kind of ['dock','drawer','sheet'])p.zoom[kind]??=clone(defaults().zoom[kind]);
 // Old presets stored blur strength in px. Convert once, preserving the old
 // appearance around its original 64px dock / 320px popup reference size.
 const percentBlur=(blur,reference)=>{if(!blur||blur.units==='percent')return;for(const key of ['center','middle','edge'])blur[key]=Math.min(100,Math.round(blur[key]/reference*10000)/100);blur.units='percent'};
 percentBlur(p.radialBlur,64);percentBlur(p.popupBlur.drawer,320);percentBlur(p.popupBlur.sheet,320);
 for(const blur of [p.radialBlur,p.popupBlur.drawer,p.popupBlur.sheet])blur.edgeStart??=Math.max(20,Math.min(95,(blur.innerStop??50)+(blur.outerStop??90)-70));
 for(const kind of ['dock','drawer','sheet'])p.zoom[kind].value??=Math.round(((p.zoom[kind].center??0)+(p.zoom[kind].middle??0)+(p.zoom[kind].edge??0))/3*10)/10;
 p.innerPanels??={drawer:{size:1,opacity:.045,blur:8,radius:24},sheet:{size:1,opacity:.06,blur:8,radius:18}};
 p.environment??={topHeight:10,topBlur:16,topShade:.2,dockShade:.22,drawerShade:.38,sheetShade:.38};
 p.backdropMotion??={drawer:{pageX:-86,pageY:0,pageScale:1,dockX:0,dockY:0,dockScale:1},sheet:{pageX:0,pageY:0,pageScale:1,dockX:0,dockY:0,dockScale:1}};
 Object.assign(p.backdropMotion.sheet,{drawerX:p.backdropMotion.sheet.drawerX??0,drawerY:p.backdropMotion.sheet.drawerY??0,drawerScale:p.backdropMotion.sheet.drawerScale??1});
 delete p.material?.indicator;
 // Older presets had one width. Keep their original appearance until edited.
 p.material.borderHorizontal??=p.material.border??1;
 p.material.borderVertical??=p.material.border??1;
 p.material.borderFade??=0;
 p.material.borderFadeSpan??=18;
 if(!p||p.format!=='voice-finance-motion'||p.version!==1||!Number.isFinite(p.referenceWidth)||p.referenceWidth<200)throw Error('Непідтримуваний формат пресета');
 const numeric=a=>Array.isArray(a)&&a.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<100000);
 for(const name of ['expand','collapse','more','back','press']){const tr=p.transitions?.[name];if(!tr||tr.duration<80||tr.duration>10000||!numeric(tr.curve)||tr.curve.length!==4||tr.frames.length<2||tr.frames.length>100)throw Error('Некоректний перехід '+name);let last=-1;for(const f of tr.frames){if(!Number.isFinite(f.t)||f.t<=last||f.t<0||f.t>1)throw Error('Ключі мають іти послідовно');last=f.t;for(const k of geometry)if(!numeric(f.state?.[k]))throw Error('Некоректна форма '+k);if(f.state.buttons?.length!==5||!f.state.buttons.every(numeric))throw Error('Некоректні кнопки')}if(tr.frames[0].t!==0||last!==1)throw Error('Потрібні крайні ключі 0 і 100%')}
 for(const k of ['color','accent'])if(!/^#[a-f0-9]{6}$/i.test(p.material?.[k]))throw Error('Некоректний колір');
 for(const k of ['color'])if(!/^#[a-f0-9]{6}$/i.test(p.indicatorMaterial?.[k]))throw Error('Некоректний колір індикатора');
 for(const name of ['drawer','sheet']){const q=p.popups?.[name];if(!q||!/^#[a-f0-9]{6}$/i.test(q.color)||!numeric(q.curve)||q.frames.length<2||q.duration<80||q.duration>10000)throw Error('Некоректне вікно');let last=-1;for(const f of q.frames){if(!numeric(f.v)||f.v.length!==4||f.t<=last||f.t<0||f.t>1)throw Error('Некоректні ключі вікна');last=f.t}if(q.frames[0].t!==0||last!==1)throw Error('Некоректні межі вікна')}
 for(const group of [p.material,p.indicatorMaterial,p.liquid])for(const v of Object.values(group))if(typeof v==='number'&&(!Number.isFinite(v)||Math.abs(v)>10000))throw Error('Некоректне значення');
 const validBlur=radial=>radial?.units==='percent'&&['center','edge'].every(k=>Number.isFinite(radial[k])&&radial[k]>=0&&radial[k]<=100)&&Number.isFinite(radial.edgeStart)&&radial.edgeStart>=20&&radial.edgeStart<=95&&Number.isFinite(radial.feather)&&radial.feather>=1&&radial.feather<=30;
 if(!validBlur(p.radialBlur)||!validBlur(p.popupBlur?.drawer)||!validBlur(p.popupBlur?.sheet))throw Error('Некоректний градієнт розмиття');
 for(const kind of ['dock','drawer','sheet']){const z=p.zoom[kind];if(z?.units!=='px'||!Number.isFinite(z.value)||z.value< -30||z.value>30)throw Error('Некоректний зум '+kind)}
 for(const kind of ['drawer','sheet']){const panel=p.innerPanels?.[kind];if(!panel||!Number.isFinite(panel.size)||panel.size<.7||panel.size>1.5||!Number.isFinite(panel.opacity)||panel.opacity<0||panel.opacity>1||!Number.isFinite(panel.blur)||panel.blur<0||panel.blur>60||!Number.isFinite(panel.radius)||panel.radius<0||panel.radius>60)throw Error('Некоректний матеріал внутрішніх карток')}
 const env=p.environment;if(!env||!Number.isFinite(env.topHeight)||env.topHeight<0||env.topHeight>30||!Number.isFinite(env.topBlur)||env.topBlur<0||env.topBlur>60||!['topShade','dockShade','drawerShade','sheetShade'].every(k=>Number.isFinite(env[k])&&env[k]>=0&&env[k]<=1))throw Error('Некоректне затемнення оточення');
 for(const kind of ['drawer','sheet']){const move=p.backdropMotion?.[kind];if(!move||!['pageX','pageY','dockX','dockY',...(kind==='sheet'?['drawerX','drawerY']:[])].every(k=>Number.isFinite(move[k])&&Math.abs(move[k])<=250)||!['pageScale','dockScale',...(kind==='sheet'?['drawerScale']:[])].every(k=>Number.isFinite(move[k])&&move[k]>=.5&&move[k]<=1.3))throw Error('Некоректний рух фону '+kind)}
 for(const width of [p.material.borderHorizontal,p.material.borderVertical])if(!Number.isFinite(width)||width<0||width>8)throw Error('Некоректна товщина обводки');
 if(!Number.isFinite(p.material.borderFade)||p.material.borderFade<0||p.material.borderFade>1||!Number.isFinite(p.material.borderFadeSpan)||p.material.borderFadeSpan<0||p.material.borderFadeSpan>50)throw Error('Некоректний фейд обводки');
 for(const tr of Object.values(p.transitions)){if(tr.curve.some(v=>v<0||v>1))throw Error('Крива виходить за межі');for(const f of tr.frames){for(const k of geometry){const expected=k==='entryHtml'?13:['entry','entryRim','nav','active','navRim','activeRim','indicator'].includes(k)?6:5;if(f.state[k].length!==expected)throw Error('Неповна геометрія '+k)}if(f.state.buttons.some(b=>b.length!==8))throw Error('Неповна геометрія кнопки')}}
 for(const tr of Object.values(p.transitions))for(const [key,part]of Object.entries(tr.tracks||{})){
  if(!Object.hasOwn(trackParts,key)||!Number.isFinite(part.duration)||part.duration<=0||part.duration>10000||!Number.isFinite(part.delay)||part.delay<0||part.delay+part.duration>tr.duration+.01||!numeric(part.curve)||part.curve.length!==4||part.curve.some(v=>v<0||v>1)||!Array.isArray(part.frames)||part.frames.length<2||part.frames.length>100)throw Error('Некоректна доріжка '+key);
  let previous=-1;for(const f of part.frames){if(!Number.isFinite(f.t)||f.t<=previous||f.t<0||f.t>1)throw Error('Некоректний час ключа '+key);previous=f.t;for(const k of geometry){const expected=k==='entryHtml'?13:['entry','entryRim','nav','active','navRim','activeRim','indicator'].includes(k)?6:5;if(!numeric(f.state?.[k])||f.state[k].length!==expected)throw Error('Некоректна форма доріжки')}if(f.state.buttons?.length!==5||f.state.buttons.some(b=>!numeric(b)||b.length!==8))throw Error('Некоректні кнопки доріжки')}
  if(part.frames[0].t!==0||previous!==1)throw Error('Доріжка потребує крайніх ключів');
 }
  const normalized=clone(p);delete normalized.surfaces;
  for(const blur of [normalized.radialBlur,normalized.popupBlur.drawer,normalized.popupBlur.sheet])for(const key of ['middle','innerStop','outerStop'])delete blur[key];
  for(const zoom of Object.values(normalized.zoom))for(const key of ['center','middle','edge','innerInset','edgeInset','feather'])delete zoom[key];
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
 const s=scale(raw);if(!studio||studioLive){const buttons=[...document.querySelectorAll('.dock-group>button:not(.compact-active-btn)')],i=Math.max(0,buttons.findIndex(b=>b.dataset.screen&&b.classList.contains('active')));if(name==='press'){s.indicator[0]=tabCenter(i)-s.indicator[2]/2;return s}const c=name==='collapse'?t:name==='expand'?1-t:0;if(i<3){s.indicator[0]+=(i-3)*(s.w-12)/5*(1-c)-(s.w-124)*c;if(i!==2){const a=s.buttons[i].slice(),b=s.buttons[2].slice();s.buttons[i]=a.map((v,j)=>v+(b[j]-v)*c);s.buttons[2]=b.map((v,j)=>v+(a[j]-v)*c)}}}return s}
function liquid(s){s=clone(s);const l=profile.liquid;if(!l.enabled){for(const k of ['neck','drop','drop2','drop3','entryBulge'])s[k][4]=0;return s}const gap=Math.max(0,s.nav[0]-s.active[0]-s.active[2]);s.neck[3]*=l.neck*l.strength;s.neck[4]*=gap>l.reach?Math.max(0,1-(gap-l.reach)/Math.max(1,l.reach)):1;for(const k of ['drop','drop2','drop3','entryBulge']){s[k][2]*=l.strength;s[k][3]*=l.strength}return s}
function rgba(hex,alpha){const n=parseInt(hex.slice(1),16);return`rgba(${n>>16},${n>>8&255},${n&255},${Math.max(0,Math.min(1,alpha))})`}
const contourHosts=new WeakMap();let contourObserver=null;
function roundedPath(w,h,insetX,insetY,corners){const x=insetX,y=insetY,a=Math.max(.1,w-2*x),b=Math.max(.1,h-2*y),rx=corners.map(v=>Math.max(0,Math.min(v-x,a/2))),ry=corners.map(v=>Math.max(0,Math.min(v-y,b/2))),arc=(rX,rY,endX,endY)=>rX>.01&&rY>.01?`A ${rX} ${rY} 0 0 1 ${endX} ${endY}`:`L ${endX} ${endY}`;return`M ${x+rx[0]} ${y} H ${x+a-rx[1]} ${arc(rx[1],ry[1],x+a,y+ry[1])} V ${y+b-ry[2]} ${arc(rx[2],ry[2],x+a-rx[2],y+b)} H ${x+rx[3]} ${arc(rx[3],ry[3],x,y+b-ry[3])} V ${y+ry[0]} ${arc(rx[0],ry[0],x+rx[0],y)} Z`}
function contourMaskUrl(w,h,corners,zone,inner,outer,soft){
  const shape=inset=>roundedPath(w,h,inset[0],inset[1],corners),edge=zone==='edge',full=zone==='full';
  if(full||zone==='center'){const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${shape([0,0])}" fill="white"/></svg>`;return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`}
  const outerPath=shape([0,0]),innerPath=shape(edge?outer:inner);
 // A self-contained image mask uses the element's own coordinate system. CSS url(#id)
 // resolves SVG masks against the page on iOS and misses moving dock capsules.
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><filter id="s" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${soft}"/></filter><mask id="m" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" style="mask-type:luminance"><path d="${outerPath}" fill="white" ${edge?'':'filter="url(#s)"'}/>${innerPath?`<path d="${innerPath}" fill="black" filter="url(#s)"/>`:''}</mask><clipPath id="contour" clipPathUnits="userSpaceOnUse"><path d="${shape([0,0])}"/></clipPath></defs><rect width="${w}" height="${h}" fill="white" mask="url(#m)" clip-path="url(#contour)"/></svg>`;
 return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
function contourProfile(host){return host.classList.contains('profile-drawer')?profile.popupBlur.drawer:host.classList.contains('sheet')||host.classList.contains('voice-popover')?profile.popupBlur.sheet:profile.radialBlur}
function zoomProfile(host){return host.classList.contains('profile-drawer')?profile.zoom.drawer:host.classList.contains('sheet')||host.classList.contains('voice-popover')?profile.zoom.sheet:profile.zoom.dock}
function updateContourZoomHost(host,w,h,corners,blur){if(host.classList.contains('dock-material-surface'))return;const ref=contourHosts.get(host),z=zoomProfile(host);if(!ref?.zoomLayers||!z)return;const backdrop=host.closest('.sheet-backdrop,.profile-drawer-backdrop');if(backdrop&&!backdrop.classList.contains('open')&&!studioSeeking){for(const layer of Object.values(ref.zoomLayers)){layer.style.display='none';window.VFMirror?.remove(layer)}return}const depth=Math.min(w,h)/2,inset=depth*(1-blur.edgeStart/100),band=[inset,inset],scale=Math.max(.5,Math.min(1.5,1+z.value/Math.max(20,depth))),lens=host.classList.contains('dock-indicator')?profile.indicatorMaterial.lens:backdrop?1:profile.material.lens;for(const zone of ['center','edge']){const layer=ref.zoomLayers[zone],radius=Math.min(w,h)*blur[zone]/100;if(!z.value&&!radius){layer.style.display='none';window.VFMirror?.remove(layer);continue}layer.style.display='block';const key=[w,h,...corners,blur.edgeStart,blur.feather,zone].join(':');if(layer.dataset.maskKey!==key){layer.dataset.maskKey=key;layer.style.maskImage=layer.style.webkitMaskImage=contourMaskUrl(w,h,corners,zone,band,band,Math.max(.1,Math.min(w,h)*blur.feather/100))}window.VFMirror?.update(layer,host,scale,radius,lens)}}
function ensureRadialBlurHosts(){
  if(!contourObserver&&typeof ResizeObserver!=='undefined')contourObserver=new ResizeObserver(entries=>{for(const item of entries)updateContourBlurHost(item.target,contourProfile(item.target))});
  document.querySelectorAll('.quick-entry-shell,.dock-indicator,.dock-material-surface,.profile-drawer,.sheet,.voice-popover').forEach(host=>{
   if(contourHosts.has(host))return;
   const zoomStack=document.createElement('span'),zoomLayers={};zoomStack.className='vf-contour-zoom-stack';zoomStack.setAttribute('aria-hidden','true');for(const zone of ['center','edge']){const layer=document.createElement('span');layer.className='vf-contour-zoom-layer';zoomStack.append(layer);zoomLayers[zone]=layer}host.prepend(zoomStack);host.classList.add('vf-radial-blur-host');host.style.backdropFilter=host.style.webkitBackdropFilter='none';contourHosts.set(host,{zoomLayers});contourObserver?.observe(host);
  });
}
function updateContourBlurHost(host,blur,size){
  const ref=contourHosts.get(host);if(!ref||!blur)return;
  const w=size?.[0]??host.clientWidth,h=size?.[1]??host.clientHeight;if(w<1||h<1)return;const css=getComputedStyle(host),corners=typeof size?.[2]==='number'?Array(4).fill(size[2]):[css.borderTopLeftRadius,css.borderTopRightRadius,css.borderBottomRightRadius,css.borderBottomLeftRadius].map(v=>parseFloat(v)||0);updateContourZoomHost(host,w,h,corners,blur);
}
function applyRadialBlur(){document.querySelectorAll('.vf-radial-blur-host').forEach(host=>updateContourBlurHost(host,contourProfile(host)))}
function material(){const m=profile.material,i=profile.indicatorMaterial,root=document.documentElement,group=document.querySelector('.dock-group'),entry=document.querySelector('.quick-entry-shell'),indicator=document.querySelector('.dock-indicator');
 root.classList.add('vf-motion-active');
 ensureRadialBlurHosts();const blur=profile.radialBlur;
 applyRadialBlur();
 root.style.setProperty('--vf-blur-center',`${blur.center}%`);root.style.setProperty('--vf-blur-edge',`${blur.edge}%`);root.style.setProperty('--vf-blur-edge-start',`${blur.edgeStart}%`);root.style.setProperty('--vf-blur-feather',`${blur.feather}%`);
 const env=profile.environment;root.style.setProperty('--vf-top-height',`${env.topHeight}dvh`);root.style.setProperty('--vf-top-blur',`${env.topBlur}px`);root.style.setProperty('--vf-top-shade',env.topShade);root.style.setProperty('--vf-dock-shade',env.dockShade);root.style.setProperty('--vf-drawer-shade',env.drawerShade);root.style.setProperty('--vf-sheet-shade',env.sheetShade);
 for(const kind of ['drawer','sheet']){const panel=profile.innerPanels[kind];root.style.setProperty(`--vf-${kind}-card-size`,panel.size);root.style.setProperty(`--vf-${kind}-card-opacity`,panel.opacity);root.style.setProperty(`--vf-${kind}-card-blur`,`${panel.blur}px`);root.style.setProperty(`--vf-${kind}-card-radius`,`${panel.radius}px`)}
 const edgeAlpha=1-m.borderFade,fadeMask=`linear-gradient(to right,rgba(0,0,0,${edgeAlpha}) 0%,#000 ${m.borderFadeSpan}%,#000 ${100-m.borderFadeSpan}%,rgba(0,0,0,${edgeAlpha}) 100%)`;
 root.style.setProperty('--accent',m.accent);root.style.setProperty('--dock-glass-bg',rgba(m.color,m.opacity));root.style.setProperty('--dock-entry-tint',rgba(m.color,m.opacity*.5));root.style.setProperty('--dock-glass-border',m.borderHorizontal+'px');root.style.setProperty('--dock-glass-border-x',m.borderVertical+'px');root.style.setProperty('--dock-glass-border-opacity',m.borderOpacity);root.style.setProperty('--dock-outline-mask',fadeMask);root.style.setProperty('--dock-glass-blur',m.blur+'px');root.style.setProperty('--dock-glass-lens',m.lens);
 root.style.setProperty('--dock-indicator-fill',rgba(i.color,i.opacity));root.style.setProperty('--dock-indicator-bg',rgba(i.color,i.opacity));root.style.setProperty('--dock-indicator-border',i.border+'px');root.style.setProperty('--dock-indicator-border-opacity',i.borderOpacity);root.style.setProperty('--dock-indicator-blur',i.blur+'px');root.style.setProperty('--dock-indicator-lens',i.lens);
 document.querySelectorAll('#dockGlassFill stop').forEach(n=>n.setAttribute('stop-color',m.color));
 // SVG paints the shared glass silhouette; contour-clipped page copies supply
 // zoom and blur underneath without covering the liquid neck and drops.
 const entryGlass=document.querySelector('.dock-entry-glass'),dockGlass=document.querySelector('.dock-liquid-mass');if(entryGlass)entryGlass.style.opacity=Math.min(.22,m.opacity*.22);if(dockGlass)dockGlass.style.opacity=m.opacity*.5;
 const outline=document.querySelector('#dockLiquidOutlineGroup');if(outline)outline.style.opacity=1;const outlineLayer=document.querySelector('#dockLiquidOutlineLayer');if(outlineLayer)outlineLayer.style.maskImage=outlineLayer.style.webkitMaskImage=fadeMask;document.querySelector('#dockLiquidOutlineFilter feGaussianBlur')?.setAttribute('stdDeviation',profile.liquid.enabled?profile.liquid.blur:0);document.querySelector('#dockLiquidOutlineFilter feMorphology')?.setAttribute('radius',`${m.borderVertical} ${m.borderHorizontal}`);document.querySelector('#dockLiquidOutlineFilter feFlood')?.setAttribute('flood-opacity',m.borderOpacity);if(entry){entry.style.backgroundColor='transparent';entry.style.border='0';entry.style.backdropFilter=entry.style.webkitBackdropFilter='none'}if(indicator){indicator.style.backdropFilter=indicator.style.webkitBackdropFilter='none';indicator.style.border=`${i.border}px solid rgba(255,255,255,${i.borderOpacity})`}if(group)group.style.setProperty('--dock-indicator-fill',rgba(i.color,i.opacity))}
function dockMirrorMask(s,r,zone){
 const w=s.w+28,h=156;
 const pill=v=>`<rect x="${v[0]}" y="${v[1]}" width="${Math.max(.1,v[2])}" height="${Math.max(.1,v[3])}" rx="${Math.max(0,v[4])}" opacity="${v[5]}"/>`;
 const drop=v=>`<ellipse cx="${v[0]}" cy="${v[1]}" rx="${Math.max(.1,v[2]/2)}" ry="${Math.max(.1,v[3]/2)}" opacity="${v[4]}"/>`;
 const neck=dockNeckPath(s),shapes=[pill(s.nav),pill(s.active),neck?`<path d="${neck}" opacity="${s.neck[4]}"/>`:'',drop(s.drop),drop(s.drop2),drop(s.drop3)].join('');
 const inset=Math.max(.1,Math.min(s.nav[3],s.active[3])/2*(1-r.edgeStart/100)),soft=Math.max(.1,Math.min(s.nav[3],s.active[3])*r.feather/100);
  const output=zone==='center'?'':`<feMorphology in="mass" operator="erode" radius="${inset}" result="inner"/><feComposite in="mass" in2="inner" operator="out" result="result"/><feGaussianBlur in="result" stdDeviation="${soft}" result="feather"/><feComposite in="feather" in2="mass" operator="in"/>`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><filter id="rim" x="-22%" y="-36%" width="144%" height="172%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="${profile.liquid.enabled?profile.liquid.blur:0}" result="blur"/><feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -8.2" result="mass"/>${output}</filter></defs><g fill="white" filter="url(#rim)">${shapes}</g></svg>`;
 return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
function updateDockZoom(s){const z=profile.zoom.dock,blur=profile.radialBlur,container=document.querySelector('#dockZoomSurfaces');if(!container)return;const size=Math.min(s.nav[3],s.active[3]),scale=Math.max(.5,Math.min(1.5,1+z.value/39));for(const zone of ['center','edge']){const layer=container.querySelector(`[data-zone="${zone}"]`);if(!layer)continue;const radius=size*blur[zone]/100;if(!z.value&&!radius){layer.style.display='none';window.VFMirror?.remove(layer);continue}layer.style.display='block';const mask=dockMirrorMask(s,blur,zone);layer.style.maskImage=layer.style.webkitMaskImage=mask;window.VFMirror?.update(layer,container,scale,radius,profile.material.lens)}}
function draw(s){live=s;dockLiquidCurrent=s;const visible=liquid(s);renderDockLiquid(visible);renderDockChrome(s);for(const [selector,shape,blur] of [['.quick-entry-shell',s.entryHtml,profile.radialBlur],['.dock-indicator',s.indicator,profile.radialBlur]]){const host=document.querySelector(selector);if(host)updateContourBlurHost(host,blur,[shape[2],shape[3],shape[4]])}updateDockZoom(visible);window.VFMirror?.flush?.()}
// Selection is an interaction, not an editable transition: keep the editor's
// indicator width, height and radius while moving its centre between tabs.
let selectionFrame=null,selectionCommit=false;
const selectionButtons=()=>[...document.querySelectorAll('.dock-group>button[data-screen]')];
const selectedIndex=()=>Math.max(0,selectionButtons().findIndex(b=>b.classList.contains('active')));
const tabCenter=i=>{const b=selectionButtons()[i],g=document.querySelector('.dock-group');if(!b||!g)return 0;const a=b.getBoundingClientRect(),r=g.getBoundingClientRect();return a.left-r.left+a.width/2};
const visualIndex=()=>{const v=selectionBase().indicator,c=v[0]+v[2]/2,centers=selectionButtons().map((_,i)=>tabCenter(i));return centers.reduce((best,x,i)=>Math.abs(x-c)<Math.abs(centers[best]-c)?i:best,0)};
function selectionBase(){return clone(live||dockLiquidCurrent||sample('press',1))}
function paintSelection(base,cx,velocity,origin){
 const s=clone(base),v=s.indicator,w=v[2],h=v[3],stretch=Math.min(19,Math.abs(velocity)*.08),squash=Math.min(10,Math.abs(velocity)*.037);
 v[0]=cx-(w+stretch)/2;v[1]=base.indicator[1]+squash/2;v[2]=w+stretch;v[3]=h-squash;v[4]=Math.min(base.indicator[4],v[3]/2);
 const gap=Math.abs(cx-origin),tail=gap>18?Math.max(0,1-gap/Math.max(75,base.w*.58)):0;
 s.selectionTails=tail?[[origin,base.indicator[1]+h/2,w*.5*tail,h*.5*tail]]:[];
 draw(s)
}
function settleSelection(target,from=selectionBase(),velocity=0){
 cancelAnimationFrame(selectionFrame);cancelAnimationFrame(frame);cancelAnimationFrame(dockLiquidFrame);frame=null;dockLiquidFrame=null;
 const start=from.indicator[0]+from.indicator[2]/2,base=clone(from),rest=sample('press',1).indicator,began=performance.now(),duration=500;
 const tick=now=>{const end=tabCenter(target),distance=end-start,raw=Math.min(1,(now-began)/duration),p=liquidEase(raw),speed=Math.abs(distance)*(p-liquidEase(Math.max(0,raw-.016)))/(.016*duration/1000),momentum=velocity*(1-raw);
  const evolving=clone(base);evolving.indicator=base.indicator.map((value,index)=>value+(rest[index]-value)*p);paintSelection(evolving,start+distance*p,speed+momentum,start);
  if(raw<1)selectionFrame=requestAnimationFrame(tick);else{selectionFrame=null;const s=clone(base);s.indicator=rest.slice();s.indicator[0]=end-rest[2]/2;s.selectionTails=[];draw(s)}};
 selectionFrame=requestAnimationFrame(tick)
}
function setupSelectionGesture(){
 const group=document.querySelector('.dock-group');if(!group?.addEventListener||!document.addEventListener)return;let gesture=null,suppressClick=false;
 group.addEventListener('click',e=>{if(!suppressClick)return;e.preventDefault();e.stopImmediatePropagation();suppressClick=false},true);
 group.addEventListener('pointerdown',e=>{if(!profile||dockCompact||document.body.classList.contains('drawer-open')||(!e.target.closest('button[data-screen]')&&!e.target.closest('.dock-indicator')))return;
  const base=selectionBase();gesture={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastAt:performance.now(),cx:base.indicator[0]+base.indicator[2]/2,base,origin:base.indicator[0]+base.indicator[2]/2,dragging:false};
 });
 const move=e=>{if(!gesture||e.pointerId!==gesture.id)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(!gesture.dragging){if(Math.abs(dx)<6||Math.abs(dx)<Math.abs(dy))return;gesture.dragging=true;group.setPointerCapture?.(e.pointerId);cancelAnimationFrame(frame);cancelAnimationFrame(dockLiquidFrame);cancelAnimationFrame(selectionFrame);frame=null;dockLiquidFrame=null;if(studio)send('gesture-start')}
  e.preventDefault();const now=performance.now(),dt=Math.max(8,now-gesture.lastAt),velocity=(e.clientX-gesture.lastX)/dt*1000;gesture.lastX=e.clientX;gesture.lastAt=now;gesture.velocity=velocity;
  const centers=selectionButtons().map((_,i)=>tabCenter(i));gesture.cx=Math.max(centers[0],Math.min(centers[centers.length-1],gesture.origin+dx));paintSelection(gesture.base,gesture.cx,velocity,gesture.origin)
 };
 const end=e=>{if(!gesture||e.pointerId!==gesture.id)return;const g=gesture;gesture=null;if(!g.dragging)return;suppressClick=true;setTimeout(()=>{suppressClick=false},80);const centers=selectionButtons().map((_,i)=>tabCenter(i));let target=0;for(let i=1;i<centers.length;i++)if(Math.abs(centers[i]-g.cx)<Math.abs(centers[target]-g.cx))target=i;
  const current=selectionBase();selectionCommit=true;switchScreen(selectionButtons()[target].dataset.screen);selectionCommit=false;settleSelection(target,current,g.velocity||0);if(studio)send('gesture-end',{screen:selectionButtons()[target].dataset.screen})
 };
 document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',end);document.addEventListener('pointercancel',end)
}
function run(name,from){cancelAnimationFrame(selectionFrame);cancelAnimationFrame(frame);cancelAnimationFrame(dockLiquidFrame);const tr=profile.transitions[name],origin=sample(name,0),began=performance.now();const tick=now=>{const t=Math.min(1,(now-began)/tr.duration);let s=sample(name,t);if(from)s=rejoinDockMorph(s,from,origin,1-dockSmoothStep(Math.min(1,t/.45)));draw(s);if(t<1)frame=requestAnimationFrame(tick);else{frame=null;dockLiquidFrame=null}};frame=requestAnimationFrame(tick)}
animateDockLiquid=function(mode){if(!profile)return baseAnimate(mode);const next=mode==='drawer'?'drawer':mode?'compact':'expanded',prior=dockLiquidMode;dockLiquidMode=next;if(next!=='drawer')document.querySelector('#bottomZone')?.classList.toggle('compact',next==='compact');const name=next==='drawer'?'more':prior==='drawer'?'back':next===prior?'press':next==='compact'?'collapse':'expand';if(selectionCommit)return;if(name==='press'&&next==='expanded'){let current=selectionBase();if(Math.abs(current.w-document.querySelector('.dock-layout').clientWidth)>1){cancelAnimationFrame(frame);cancelAnimationFrame(selectionFrame);draw(sample('press',1));current=selectionBase()}if(studio)send('interaction');settleSelection(selectedIndex(),current);return}if(!studio||studioLive)run(name,live||dockLiquidCurrent)};
function popupSample(kind,t){const q=profile.popups[kind],p=warped(q.frames,t,q.curve);let i=0;while(i<q.frames.length-2&&p>q.frames[i+1].t)i++;const a=q.frames[i],b=q.frames[i+1],u=Math.max(0,Math.min(1,(p-a.t)/(b.t-a.t)));return a.v.map((v,j)=>v+(b.v[j]-v)*u)}
function popupStyle(el,kind,t){const q=profile.popups[kind],v=popupSample(kind,t);Object.assign(el.style,{transform:`translate(${v[0]}%,${v[1]}%) scale(${v[2]})`,opacity:v[3],background:q.color+Math.round(q.opacity*255).toString(16).padStart(2,'0'),backdropFilter:'none',webkitBackdropFilter:'none',borderRadius:kind==='drawer'?`${q.radius}px 0 0 ${q.radius}px`:`${q.radius}px ${q.radius}px 0 0`,borderWidth:q.border+'px',transition:'none',width:`min(${q.width|| (kind==='drawer'?360:480)}px,100%)`,maxHeight:(q.height||90)+'dvh'});updateContourBlurHost(el,profile.popupBlur[kind])}
function backdropStyle(kind,t){
 const target=kind?profile.backdropMotion[kind]:null,p=!target||t<=0?0:t>=1?1:ease(t,profile.popups[kind].curve);
 const behindDrawer=kind==='sheet'&&document.body.classList.contains('drawer-open'),base=behindDrawer?profile.backdropMotion.drawer:null;
 const blend=(key,rest=0)=>((base?.[key]??rest)*(1-p)+(target?.[key]??rest)*p);
 const page=target?`translate3d(${blend('pageX')}px,${blend('pageY')}px,0) scale(${blend('pageScale',1)})`:'';
 const dock=target?`translateX(-50%) translate3d(${blend('dockX')}px,${blend('dockY')}px,0) scale(${blend('dockScale',1)})`:'';
 for(const selector of ['body > .app','#accountTicker']){const el=document.querySelector(selector);if(el)el.style.transform=page}
 const zone=document.querySelector('.bottom-zone');if(zone)zone.style.transform=dock;
 const drawer=document.querySelector('.profile-drawer');if(drawer){drawer.style.translate=kind==='sheet'?`${(target.drawerX||0)*p}px ${(target.drawerY||0)*p}px`:'';drawer.style.scale=kind==='sheet'?String(1+((target.drawerScale??1)-1)*p):''}
 window.VFMirror?.flush?.();
}
const popupFrames=new WeakMap(),popupProgress=new WeakMap();
function popupRun(el,kind,closing,done){if(!profile||!el)return;cancelAnimationFrame(popupFrames.get(el));document.documentElement.classList.add('vf-popup-motion');const start=popupProgress.get(el)??(closing?1:0),end=closing?0:1,duration=profile.popups[kind].duration*Math.abs(end-start),began=performance.now(),finish=()=>{document.documentElement.classList.remove('vf-popup-motion');done?.()};if(duration<1){popupStyle(el,kind,end);backdropStyle(kind,end);popupProgress.set(el,end);finish();return}const tick=now=>{const ratio=Math.min(1,(now-began)/duration),p=start+(end-start)*ratio;popupStyle(el,kind,p);backdropStyle(kind,p);popupProgress.set(el,p);if(ratio<1)popupFrames.set(el,requestAnimationFrame(tick));else finish()};popupFrames.set(el,requestAnimationFrame(tick))}
openSheet=function(id){const el=document.querySelector(id+' .sheet');if(profile&&el){popupStyle(el,'sheet',0);popupProgress.set(el,0)}baseOpen(id);if(profile)popupRun(el,'sheet',false)};
closeSheet=function(id){if(profile&&document.querySelector(id)?.classList.contains('open'))popupRun(document.querySelector(id+' .sheet'),'sheet',true,()=>baseClose(id));else baseClose(id)};
function send(type,extra={}){if(studio)parent.postMessage({source:'vf-motion',type,...extra},location.origin)}
let studioSeeking=false;
function previewBackButton(on){const button=document.querySelector('#moreBtn');if(!button)return;button.classList.toggle('active',on);button.setAttribute('aria-label',on?'Назад':'Додатково');const label=button.querySelector('.dock-label');if(label)label.textContent=on?'Назад':'Додатково'}
function seek(name,t,popup){
 studioSeeking=true;setTimeout(()=>{studioSeeking=false},0);document.querySelectorAll('.profile-drawer,.sheet').forEach(el=>cancelAnimationFrame(popupFrames.get(el)));cancelAnimationFrame(frame);cancelAnimationFrame(dockLiquidFrame);cancelAnimationFrame(selectionFrame);
 document.documentElement.classList.toggle('vf-popup-motion',!!popup);document.body.classList.toggle('sheet-open',popup==='sheet');
 previewBackButton(!!popup);
 if(popup){
  const drawer=document.querySelector('.profile-drawer'),el=popup==='drawer'?drawer:document.querySelector('#settingsBackdrop .sheet');
  document.body.classList.add('drawer-open');document.querySelector('.profile-drawer-backdrop').classList.add('open');document.querySelector('#settingsBackdrop').classList.toggle('open',popup==='sheet');
  if(popup==='sheet')popupStyle(drawer,'drawer',1);
  draw(sample('more',popup==='drawer'?t:1));popupStyle(el,popup,t);backdropStyle(popup,t);popupProgress.set(el,t);window.VFMirror?.flush?.();
 }else{
  document.querySelectorAll('.profile-drawer-backdrop,.sheet-backdrop').forEach(n=>n.classList.remove('open'));document.body.classList.remove('drawer-open');unlockDrawerPage();unlockPageScroll();backdropStyle(null,0);draw(sample(name,t));
 }
}
window.VFMotion={validate,ease,defaults,sample,seek,upgradeTracks,published:()=>validate(clone(window.VF_BUNDLED_MOTION_PROFILE)),get tension(){return profile?.liquid.tension??.28},get profile(){return clone(profile)},set(p){profile=validate(p);material()},clear(){localStorage.removeItem(KEY);localStorage.removeItem(bundleKey);localStorage.setItem(disabledKey,'1');location.reload()},preparePopup(kind){if(!profile||kind!=='drawer')return;const el=document.querySelector('.profile-drawer');if(!el)return;popupStyle(el,kind,0);popupProgress.set(el,0)}};
try{const bundled=window.VF_BUNDLED_MOTION_PROFILE?validate(window.VF_BUNDLED_MOTION_PROFILE):null,saved=localStorage.getItem(studio?draftKey:KEY),preferSaved=studio||!bundled||localStorage.getItem(bundleKey)===bundleRevision;profile=!studio&&localStorage.getItem(disabledKey)==='1'?null:preferSaved&&saved?validate(JSON.parse(saved)):bundled||null}catch(e){console.warn('Motion preset ignored:',e.message);try{profile=window.VF_BUNDLED_MOTION_PROFILE?validate(window.VF_BUNDLED_MOTION_PROFILE):null}catch{profile=null}}
if(studio){profile=profile||defaults();material();addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.source!=='vf-editor')return;try{const d=e.data;if(d.type==='preset'){profile=validate(d.profile);material();if(!studioLive)seek(d.transition,d.t,d.popup);else if(live)draw(live)}if(d.type==='seek'){studioLive=false;seek(d.transition,d.t,d.popup)}if(d.type==='live-preview'){studioLive=!!d.enabled;if(d.profile){profile=validate(d.profile);material()}if(studioLive){studioSeeking=true;setTimeout(()=>{studioSeeking=false},0);document.querySelectorAll('.profile-drawer,.sheet').forEach(el=>cancelAnimationFrame(popupFrames.get(el)));document.body.classList.remove('sheet-open','drawer-open');unlockDrawerPage();unlockPageScroll();document.documentElement.classList.remove('vf-popup-motion');document.querySelectorAll('.profile-drawer-backdrop,.sheet-backdrop').forEach(n=>n.classList.remove('open'));dockCompact=false;dockLiquidMode='expanded';previewBackButton(false);document.querySelector('#bottomZone')?.classList.remove('compact');backdropStyle(null,0);draw(sample('expand',1))}}if(d.type==='toggle-dock'&&studioLive)setDockCompact(!dockCompact);if(d.type==='gesture-preview'){cancelAnimationFrame(frame);cancelAnimationFrame(dockLiquidFrame);cancelAnimationFrame(selectionFrame);document.querySelectorAll('.profile-drawer-backdrop,.sheet-backdrop').forEach(n=>n.classList.remove('open'));document.body.classList.remove('drawer-open');dockCompact=false;dockLiquidMode='expanded';document.querySelector('#bottomZone')?.classList.remove('compact');backdropStyle(null,0);const state=sample('press',1),index=selectedIndex(),button=state.buttons[index];state.indicator[0]=button[0]+button[2]/2-state.indicator[2]/2;draw(state);send('gesture-ready')}if(d.type==='save'){localStorage.setItem(KEY,JSON.stringify(validate(d.profile)));localStorage.setItem(bundleKey,bundleRevision);localStorage.removeItem(disabledKey);send('saved')}if(d.type==='reset')send('ready',{profile:defaults()});}catch(err){send('error',{message:err.message})}});setTimeout(()=>{cancelAnimationFrame(dockLiquidFrame);send('ready',{profile});seek('expand',0)},1100)}else if(profile){material();draw(sample('expand',1))}
if(profile){const backdrop=document.querySelector('.profile-drawer-backdrop');if(backdrop?.nodeType===1&&typeof MutationObserver!=='undefined'){const observer=new MutationObserver(()=>{if(studioSeeking||document.querySelector('.sheet-backdrop.open'))return;popupRun(backdrop.querySelector('.profile-drawer'),'drawer',!backdrop.classList.contains('open'))});try{observer.observe(backdrop,{attributes:true,attributeFilter:['class']})}catch(error){console.warn('Drawer observer unavailable:',error)}}}
setupSelectionGesture();
})();
