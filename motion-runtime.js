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
 material:{color:'#242428',opacity:.9,blur:15,lens:1.2,border:1,borderHorizontal:1,borderVertical:1,borderFade:0,borderFadeSpan:18,borderOpacity:.3,accent:'#ff375f'},
 indicatorMaterial:{color:'#09090a',opacity:.8,blur:8,lens:1,border:1,borderOpacity:.28},
 radialBlur:{center:12.5,middle:23.5,edge:43.75,innerStop:50,outerStop:90,feather:6,units:'percent'},
 popupBlur:{drawer:{center:2.5,middle:4.7,edge:8.75,innerStop:50,outerStop:90,feather:6,units:'percent'},sheet:{center:2.5,middle:4.7,edge:8.75,innerStop:50,outerStop:90,feather:6,units:'percent'}},
 innerPanels:{drawer:{size:1,opacity:.045,blur:8,radius:24},sheet:{size:1,opacity:.06,blur:8,radius:18}},
 environment:{topHeight:10,topBlur:16,topShade:.2,dockShade:.22,drawerShade:.38,sheetShade:.38},
 backdropMotion:{drawer:{pageX:-86,pageY:0,pageScale:1,dockX:0,dockY:0,dockScale:1},sheet:{pageX:0,pageY:0,pageScale:1,dockX:0,dockY:0,dockScale:1}},
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
 // Old presets stored blur strength in px. Convert once, preserving the old
 // appearance around its original 64px dock / 320px popup reference size.
 const percentBlur=(blur,reference)=>{if(!blur||blur.units==='percent')return;for(const key of ['center','middle','edge'])blur[key]=Math.min(100,Math.round(blur[key]/reference*10000)/100);blur.units='percent'};
 percentBlur(p.radialBlur,64);percentBlur(p.popupBlur.drawer,320);percentBlur(p.popupBlur.sheet,320);
 p.innerPanels??={drawer:{size:1,opacity:.045,blur:8,radius:24},sheet:{size:1,opacity:.06,blur:8,radius:18}};
 p.environment??={topHeight:10,topBlur:16,topShade:.2,dockShade:.22,drawerShade:.38,sheetShade:.38};
 p.backdropMotion??={drawer:{pageX:-86,pageY:0,pageScale:1,dockX:0,dockY:0,dockScale:1},sheet:{pageX:0,pageY:0,pageScale:1,dockX:0,dockY:0,dockScale:1}};
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
 const validBlur=radial=>radial?.units==='percent'&&['center','middle','edge'].every(k=>Number.isFinite(radial[k])&&radial[k]>=0&&radial[k]<=100)&&Number.isFinite(radial.innerStop)&&radial.innerStop>=20&&radial.innerStop<=70&&Number.isFinite(radial.outerStop)&&radial.outerStop>=75&&radial.outerStop<=95&&Number.isFinite(radial.feather)&&radial.feather>=1&&radial.feather<=30;
 if(!validBlur(p.radialBlur)||!validBlur(p.popupBlur?.drawer)||!validBlur(p.popupBlur?.sheet))throw Error('Некоректний градієнт розмиття');
 for(const kind of ['drawer','sheet']){const panel=p.innerPanels?.[kind];if(!panel||!Number.isFinite(panel.size)||panel.size<.7||panel.size>1.5||!Number.isFinite(panel.opacity)||panel.opacity<0||panel.opacity>1||!Number.isFinite(panel.blur)||panel.blur<0||panel.blur>60||!Number.isFinite(panel.radius)||panel.radius<0||panel.radius>60)throw Error('Некоректний матеріал внутрішніх карток')}
 const env=p.environment;if(!env||!Number.isFinite(env.topHeight)||env.topHeight<0||env.topHeight>30||!Number.isFinite(env.topBlur)||env.topBlur<0||env.topBlur>60||!['topShade','dockShade','drawerShade','sheetShade'].every(k=>Number.isFinite(env[k])&&env[k]>=0&&env[k]<=1))throw Error('Некоректне затемнення оточення');
 for(const kind of ['drawer','sheet']){const move=p.backdropMotion?.[kind];if(!move||!['pageX','pageY','dockX','dockY'].every(k=>Number.isFinite(move[k])&&Math.abs(move[k])<=250)||!['pageScale','dockScale'].every(k=>Number.isFinite(move[k])&&move[k]>=.5&&move[k]<=1.3))throw Error('Некоректний рух фону '+kind)}
 for(const width of [p.material.borderHorizontal,p.material.borderVertical])if(!Number.isFinite(width)||width<0||width>8)throw Error('Некоректна товщина обводки');
 if(!Number.isFinite(p.material.borderFade)||p.material.borderFade<0||p.material.borderFade>1||!Number.isFinite(p.material.borderFadeSpan)||p.material.borderFadeSpan<0||p.material.borderFadeSpan>50)throw Error('Некоректний фейд обводки');
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
const contourHosts=new WeakMap();let contourSerial=0,contourDefs=null,contourObserver=null;
function svgNode(name){return document.createElementNS('http://www.w3.org/2000/svg',name)}
function contourRect(mask,fill,soft){const shape=svgNode('path');shape.setAttribute('fill',fill);if(soft)shape.setAttribute('filter',soft);mask.append(shape);return shape}
function roundedPath(w,h,insetX,insetY,corners){const x=insetX,y=insetY,a=Math.max(.1,w-2*x),b=Math.max(.1,h-2*y),factor=Math.min(a/w,b/h),r=corners.map(v=>Math.max(0,Math.min(v*factor,a/2,b/2))),[tl,tr,br,bl]=r;return`M ${x+tl} ${y} H ${x+a-tr} Q ${x+a} ${y} ${x+a} ${y+tr} V ${y+b-br} Q ${x+a} ${y+b} ${x+a-br} ${y+b} H ${x+bl} Q ${x} ${y+b} ${x} ${y+b-bl} V ${y+tl} Q ${x} ${y} ${x+tl} ${y} Z`}
function contourProfile(host){return host.classList.contains('profile-drawer')?profile.popupBlur.drawer:host.classList.contains('sheet')||host.classList.contains('voice-popover')?profile.popupBlur.sheet:profile.radialBlur}
function ensureRadialBlurHosts(){
 if(!document.createElementNS)return;
 if(!contourDefs){const svg=svgNode('svg');svg.id='vfContourMasks';svg.setAttribute('width','0');svg.setAttribute('height','0');svg.setAttribute('aria-hidden','true');svg.style.cssText='position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';contourDefs=svgNode('defs');svg.append(contourDefs);document.body.append(svg)}
 if(!contourObserver&&typeof ResizeObserver!=='undefined')contourObserver=new ResizeObserver(entries=>{for(const item of entries)updateContourBlurHost(item.target,contourProfile(item.target))});
 document.querySelectorAll('.quick-entry-shell,.dock-indicator,.dock-material-surface,.profile-drawer,.sheet,.voice-popover').forEach(host=>{
  if(contourHosts.has(host))return;
  const id=++contourSerial,stack=document.createElement('div'),parts={};stack.className='vf-radial-blur-stack';stack.setAttribute('aria-hidden','true');
  const filter=svgNode('filter'),gaussian=svgNode('feGaussianBlur');filter.id=`vf-contour-soft-${id}`;filter.setAttribute('x','-50%');filter.setAttribute('y','-50%');filter.setAttribute('width','200%');filter.setAttribute('height','200%');filter.append(gaussian);contourDefs.append(filter);
  for(const zone of ['edge','middle','center']){const mask=svgNode('mask');mask.id=`vf-contour-${id}-${zone}`;mask.setAttribute('maskUnits','userSpaceOnUse');mask.setAttribute('maskContentUnits','userSpaceOnUse');mask.setAttribute('mask-type','luminance');mask.style.maskType='luminance';const outer=contourRect(mask,'white',zone==='center'||zone==='middle'?`url(#${filter.id})`:null),inner=zone==='center'?null:contourRect(mask,'black',`url(#${filter.id})`);contourDefs.append(mask);parts[zone]={mask,outer,inner};const layer=document.createElement('span');layer.className=`vf-radial-blur-layer vf-radial-blur-${zone}`;layer.style.maskImage=layer.style.webkitMaskImage=`url(#${mask.id})`;stack.append(layer)}
  host.prepend(stack);host.classList.add('vf-radial-blur-host');host.style.backdropFilter=host.style.webkitBackdropFilter='none';contourHosts.set(host,{parts,gaussian,layers:[...stack.children]});contourObserver?.observe(host);
 });
}
function updateContourBlurHost(host,blur,size){
 const ref=contourHosts.get(host);if(!ref||!blur)return;
 const w=size?.[0]??host.clientWidth,h=size?.[1]??host.clientHeight;if(w<1||h<1)return;const css=getComputedStyle(host),corners=typeof size?.[2]==='number'?Array(4).fill(size[2]):[css.borderTopLeftRadius,css.borderTopRightRadius,css.borderBottomRightRadius,css.borderBottomLeftRadius].map(v=>parseFloat(v)||0);const key=[w,h,...corners,blur.center,blur.middle,blur.edge,blur.innerStop,blur.outerStop,blur.feather].map(v=>Number(v).toFixed(2)).join(':');if(ref.key===key)return;ref.key=key;
 const inner=[w*(1-blur.innerStop/100)/2,h*(1-blur.innerStop/100)/2],outer=[w*(1-blur.outerStop/100)/2,h*(1-blur.outerStop/100)/2],soft=Math.max(.1,Math.min(w,h)*blur.feather/100);ref.gaussian.setAttribute('stdDeviation',soft.toFixed(2));
 const rect=(el,inset)=>{if(el)el.setAttribute('d',roundedPath(w,h,inset[0],inset[1],corners))};
 for(const [zone,part]of Object.entries(ref.parts)){part.mask.setAttribute('x','0');part.mask.setAttribute('y','0');part.mask.setAttribute('width',w);part.mask.setAttribute('height',h);rect(part.outer,zone==='edge'?[0,0]:zone==='middle'?outer:inner);rect(part.inner,zone==='edge'?outer:inner)}
 for(const [index,zone]of ['edge','middle','center'].entries()){const layer=ref.layers[index],radius=Math.min(w,h)*blur[zone]/100;layer.style.backdropFilter=layer.style.webkitBackdropFilter=`blur(${radius.toFixed(2)}px)`}
}
function applyRadialBlur(){document.querySelectorAll('.vf-radial-blur-host').forEach(host=>updateContourBlurHost(host,contourProfile(host)))}
function material(){const m=profile.material,i=profile.indicatorMaterial,root=document.documentElement,group=document.querySelector('.dock-group'),entry=document.querySelector('.quick-entry-shell'),indicator=document.querySelector('.dock-indicator');
 root.classList.add('vf-motion-active');
 ensureRadialBlurHosts();const blur=profile.radialBlur;
 applyRadialBlur();
 root.style.setProperty('--vf-blur-center',`${blur.center}px`);root.style.setProperty('--vf-blur-middle',`${blur.middle}px`);root.style.setProperty('--vf-blur-edge',`${blur.edge}px`);root.style.setProperty('--vf-blur-inner',`${blur.innerStop}%`);root.style.setProperty('--vf-blur-outer',`${blur.outerStop}%`);root.style.setProperty('--vf-blur-feather',`${blur.feather}%`);
 const env=profile.environment;root.style.setProperty('--vf-top-height',`${env.topHeight}dvh`);root.style.setProperty('--vf-top-blur',`${env.topBlur}px`);root.style.setProperty('--vf-top-shade',env.topShade);root.style.setProperty('--vf-dock-shade',env.dockShade);root.style.setProperty('--vf-drawer-shade',env.drawerShade);root.style.setProperty('--vf-sheet-shade',env.sheetShade);
 for(const kind of ['drawer','sheet']){const panel=profile.innerPanels[kind];root.style.setProperty(`--vf-${kind}-card-size`,panel.size);root.style.setProperty(`--vf-${kind}-card-opacity`,panel.opacity);root.style.setProperty(`--vf-${kind}-card-blur`,`${panel.blur}px`);root.style.setProperty(`--vf-${kind}-card-radius`,`${panel.radius}px`)}
 const edgeAlpha=1-m.borderFade,fadeMask=`linear-gradient(to right,rgba(0,0,0,${edgeAlpha}) 0%,#000 ${m.borderFadeSpan}%,#000 ${100-m.borderFadeSpan}%,rgba(0,0,0,${edgeAlpha}) 100%)`;
 root.style.setProperty('--accent',m.accent);root.style.setProperty('--dock-glass-bg',rgba(m.color,m.opacity));root.style.setProperty('--dock-glass-border',m.borderHorizontal+'px');root.style.setProperty('--dock-glass-border-x',m.borderVertical+'px');root.style.setProperty('--dock-glass-border-opacity',m.borderOpacity);root.style.setProperty('--dock-outline-mask',fadeMask);root.style.setProperty('--dock-glass-blur',m.blur+'px');root.style.setProperty('--dock-glass-lens',m.lens);
 root.style.setProperty('--dock-indicator-fill',rgba(i.color,i.opacity));root.style.setProperty('--dock-indicator-bg',rgba(i.color,i.opacity));root.style.setProperty('--dock-indicator-border',i.border+'px');root.style.setProperty('--dock-indicator-border-opacity',i.borderOpacity);root.style.setProperty('--dock-indicator-blur',i.blur+'px');root.style.setProperty('--dock-indicator-lens',i.lens);
 for(const zone of ['center','middle','edge']){const layer=document.querySelector(`#vfDockBlur${zone[0].toUpperCase()+zone.slice(1)}`);if(layer)layer.style.backdropFilter=layer.style.webkitBackdropFilter=`blur(${blur[zone]}px)`}
 document.querySelectorAll('#dockGlassFill stop').forEach(n=>n.setAttribute('stop-color',m.color));
 // SVG paints the shared glass silhouette; transparent HTML layers provide iOS Safari backdrop blur.
 // Keep the liquid SVG as the visible glass silhouette. The HTML surfaces above it
 // are blur-only, so the neck/drops remain visible instead of being hidden by a plate.
 const entryGlass=document.querySelector('.dock-entry-glass'),dockGlass=document.querySelector('.dock-liquid-mass');if(entryGlass)entryGlass.style.opacity=Math.min(.22,m.opacity*.22);if(dockGlass)dockGlass.style.opacity=m.opacity*.5;
 const outline=document.querySelector('#dockLiquidOutlineGroup');if(outline)outline.style.opacity=1;const outlineLayer=document.querySelector('#dockLiquidOutlineLayer');if(outlineLayer)outlineLayer.style.maskImage=outlineLayer.style.webkitMaskImage=fadeMask;document.querySelector('#dockLiquidOutlineFilter feGaussianBlur')?.setAttribute('stdDeviation',profile.liquid.enabled?profile.liquid.blur:0);document.querySelector('#dockLiquidOutlineFilter feMorphology')?.setAttribute('radius',`${m.borderVertical} ${m.borderHorizontal}`);document.querySelector('#dockLiquidOutlineFilter feFlood')?.setAttribute('flood-opacity',m.borderOpacity);document.querySelector('#liquidShine').style.filter=`brightness(${m.lens})`;if(entry){entry.style.backgroundColor=rgba(m.color,m.opacity*.5);entry.style.border='0';entry.style.backdropFilter=entry.style.webkitBackdropFilter='none'}if(indicator){indicator.style.backdropFilter=indicator.style.webkitBackdropFilter='none';indicator.style.border=`${i.border}px solid rgba(255,255,255,${i.borderOpacity})`}if(group)group.style.setProperty('--dock-indicator-fill',rgba(i.color,i.opacity))}
function updateDockContour(s){const r=Math.max(1,Math.min(s.nav[4]||32,s.active[4]||32)),blur=profile.radialBlur,inner=r*(1-blur.innerStop/100),outer=r*(1-blur.outerStop/100),soft=Math.max(.35,Math.min(5,r*blur.feather/30));for(const [id,value]of [['vfDockErodeCenter',inner],['vfDockErodeInner',inner],['vfDockErodeOuter',outer],['vfDockErodeEdge',outer]])document.getElementById(id)?.setAttribute('radius',value.toFixed(2));for(const id of ['vfDockFeatherCenter','vfDockFeatherMiddle','vfDockFeatherEdge'])document.getElementById(id)?.setAttribute('stdDeviation',soft.toFixed(2))}
function draw(s){live=s;dockLiquidCurrent=s;renderDockLiquid(liquid(s));renderDockChrome(s);for(const [selector,shape,blur] of [['.quick-entry-shell',s.entryHtml,profile.radialBlur],['.dock-indicator',s.indicator,profile.radialBlur],['#dockMaterialNav',s.nav,profile.radialBlur],['#dockMaterialActive',s.active,profile.radialBlur]]){const host=document.querySelector(selector);if(host)updateContourBlurHost(host,blur,[shape[2],shape[3],shape[4]])}updateDockContour(s)}
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
 const start=from.indicator[0]+from.indicator[2]/2,end=tabCenter(target),distance=end-start,base=clone(from),began=performance.now(),duration=500;
 const tick=now=>{const raw=Math.min(1,(now-began)/duration),p=liquidEase(raw),speed=Math.abs(distance)*(p-liquidEase(Math.max(0,raw-.016)))/(.016*duration/1000),momentum=velocity*(1-raw);
  paintSelection(base,start+distance*p,speed+momentum,start);
  if(raw<1)selectionFrame=requestAnimationFrame(tick);else{selectionFrame=null;const s=clone(base);s.indicator[0]=end-s.indicator[2]/2;s.selectionTails=[];draw(s)}};
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
animateDockLiquid=function(mode){if(!profile)return baseAnimate(mode);const next=mode==='drawer'?'drawer':mode?'compact':'expanded',prior=dockLiquidMode;dockLiquidMode=next;const name=next==='drawer'?'more':prior==='drawer'?'back':next===prior?'press':next==='compact'?'collapse':'expand';if(selectionCommit)return;if(!studio){if(name==='press'&&next==='expanded'&&selectedIndex()!==visualIndex()){settleSelection(selectedIndex());return}run(name,live||dockLiquidCurrent)}};
function popupSample(kind,t){const q=profile.popups[kind],p=warped(q.frames,t,q.curve);let i=0;while(i<q.frames.length-2&&p>q.frames[i+1].t)i++;const a=q.frames[i],b=q.frames[i+1],u=Math.max(0,Math.min(1,(p-a.t)/(b.t-a.t)));return a.v.map((v,j)=>v+(b.v[j]-v)*u)}
function popupStyle(el,kind,t){const q=profile.popups[kind],v=popupSample(kind,t);Object.assign(el.style,{transform:`translate(${v[0]}%,${v[1]}%) scale(${v[2]})`,opacity:v[3],background:q.color+Math.round(q.opacity*255).toString(16).padStart(2,'0'),backdropFilter:'none',webkitBackdropFilter:'none',borderRadius:kind==='drawer'?`${q.radius}px 0 0 ${q.radius}px`:`${q.radius}px ${q.radius}px 0 0`,borderWidth:q.border+'px',transition:'none',width:`min(${q.width|| (kind==='drawer'?360:480)}px,100%)`,maxHeight:(q.height||90)+'dvh'});updateContourBlurHost(el,profile.popupBlur[kind])}
function backdropStyle(kind,t){
 const target=kind?profile.backdropMotion[kind]:null,p=!target||t<=0?0:t>=1?1:ease(t,profile.popups[kind].curve);
 const page=target?`translate3d(${target.pageX*p}px,${target.pageY*p}px,0) scale(${1+(target.pageScale-1)*p})`:'';
 const dock=target?`translateX(-50%) translate3d(${target.dockX*p}px,${target.dockY*p}px,0) scale(${1+(target.dockScale-1)*p})`:'';
 for(const selector of ['.app','.account-ticker']){const el=document.querySelector(selector);if(el)el.style.transform=page}
 const zone=document.querySelector('.bottom-zone');if(zone)zone.style.transform=dock;
}
const popupFrames=new WeakMap(),popupProgress=new WeakMap();
function popupRun(el,kind,closing,done){if(!profile||!el)return;cancelAnimationFrame(popupFrames.get(el));document.documentElement.classList.add('vf-popup-motion');const start=popupProgress.get(el)??(closing?1:0),end=closing?0:1,duration=profile.popups[kind].duration*Math.abs(end-start),began=performance.now(),finish=()=>{document.documentElement.classList.remove('vf-popup-motion');done?.()};if(duration<1){popupStyle(el,kind,end);backdropStyle(kind,end);popupProgress.set(el,end);finish();return}const tick=now=>{const ratio=Math.min(1,(now-began)/duration),p=start+(end-start)*ratio;popupStyle(el,kind,p);backdropStyle(kind,p);popupProgress.set(el,p);if(ratio<1)popupFrames.set(el,requestAnimationFrame(tick));else finish()};popupFrames.set(el,requestAnimationFrame(tick))}
openSheet=function(id){baseOpen(id);if(profile)popupRun(document.querySelector(id+' .sheet'),'sheet',false)};
closeSheet=function(id){if(profile&&document.querySelector(id)?.classList.contains('open'))popupRun(document.querySelector(id+' .sheet'),'sheet',true,()=>baseClose(id));else baseClose(id)};
function send(type,extra={}){if(studio)parent.postMessage({source:'vf-motion',type,...extra},location.origin)}
function seek(name,t,popup){cancelAnimationFrame(frame);cancelAnimationFrame(dockLiquidFrame);cancelAnimationFrame(selectionFrame);document.documentElement.classList.toggle('vf-popup-motion',!!popup);document.body.classList.toggle('sheet-open',popup==='sheet');if(popup){const kind=popup,el=kind==='drawer'?document.querySelector('.profile-drawer'):document.querySelector('#settingsBackdrop .sheet');document.querySelector('.profile-drawer-backdrop').classList.toggle('open',kind==='drawer');document.querySelector('#settingsBackdrop').classList.toggle('open',kind==='sheet');popupStyle(el,kind,t);backdropStyle(kind,t)}else{document.querySelectorAll('.profile-drawer-backdrop,.sheet-backdrop').forEach(n=>n.classList.remove('open'));document.body.classList.remove('drawer-open');backdropStyle(null,0);draw(sample(name,t))}}
window.VFMotion={validate,ease,defaults,sample,seek,upgradeTracks,get tension(){return profile?.liquid.tension??.28},get profile(){return clone(profile)},set(p){profile=validate(p);material()},clear(){localStorage.removeItem(KEY);location.reload()}};
try{const saved=localStorage.getItem(studio?draftKey:KEY);if(saved)profile=validate(JSON.parse(saved))}catch(e){console.warn('Motion preset ignored:',e.message)}
if(studio){profile=profile||defaults();material();addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.source!=='vf-editor')return;try{const d=e.data;if(d.type==='preset'){profile=validate(d.profile);material();seek(d.transition,d.t,d.popup)}if(d.type==='seek')seek(d.transition,d.t,d.popup);if(d.type==='gesture-preview'){cancelAnimationFrame(frame);cancelAnimationFrame(dockLiquidFrame);cancelAnimationFrame(selectionFrame);document.querySelectorAll('.profile-drawer-backdrop,.sheet-backdrop').forEach(n=>n.classList.remove('open'));document.body.classList.remove('drawer-open');dockCompact=false;dockLiquidMode='expanded';document.querySelector('#bottomZone')?.classList.remove('compact');backdropStyle(null,0);draw(sample('press',1));send('gesture-ready')}if(d.type==='save'){localStorage.setItem(KEY,JSON.stringify(validate(d.profile)));send('saved')}if(d.type==='reset')send('ready',{profile:defaults()});}catch(err){send('error',{message:err.message})}});setTimeout(()=>{cancelAnimationFrame(dockLiquidFrame);send('ready',{profile});seek('expand',0)},1100)}else if(profile){material();draw(sample('expand',1));const backdrop=document.querySelector('.profile-drawer-backdrop');if(backdrop){const observer=new MutationObserver(()=>popupRun(backdrop.querySelector('.profile-drawer'),'drawer',!backdrop.classList.contains('open')));observer.observe(backdrop,{attributes:true,attributeFilter:['class']})}}
setupSelectionGesture();
})();
