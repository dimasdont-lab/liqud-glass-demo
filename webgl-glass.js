/* WebGL optical renderer adapted from the user's Liquid Glass Tab Bar example.
 * Native HTML remains interactive. html2canvas supplies cached page textures;
 * scrolling and panel transforms are composed at frame cadence, not captured
 * into one frozen viewport screenshot. One WebGL context serves all surfaces.
 */
(()=>{'use strict';
 if(!new URLSearchParams(location.search).has('studio'))return;
 const legacy=window.VFMirror;
 if(!window.html2canvas){console.error('WebGL glass: HTML renderer unavailable');return}
 const gpu=document.createElement('canvas'),gl=gpu.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:false});
 if(!gl){console.warn('WebGL glass unavailable; retaining previous renderer');return}
 const mirrors=new Map(),sources=new Map(),scene=document.createElement('canvas'),ctx=scene.getContext('2d');
 const stats={captures:0,frames:0,lastCaptureMs:0,errors:[],lost:false};
 let program,U,texture,blurProgram,BU,raf=0,serial=0,active=false,capturing=false,lastCapture=0,lastPoll=0,lastRender=0,lastKey='',updateRevision=0;
 const blurTargets=new Map();
 const VS='attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
 const FS=`
 precision mediump float;
 uniform sampler2D u_tex;
 uniform vec2 u_res,u_size,u_origin,u_ratio;
 uniform vec4 u_a,u_b;
 uniform vec2 u_radius;
 uniform float u_count,u_scale,u_blur,u_lens,u_darken;
 float sdRB(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return min(max(q.x,q.y),0.)+length(max(q,0.))-r;}
 float shape(vec2 p,vec4 s,float r){return sdRB(p-s.xy,s.zw,min(r,min(s.z,s.w)));}
 float dist(vec2 p){float a=shape(p,u_a,u_radius.x);return u_count>1.5?min(a,shape(p,u_b,u_radius.y)):a;}
 vec3 bg(vec2 x){return texture2D(u_tex,clamp(x/u_res,vec2(.001),vec2(.999))).rgb;}
 void main(){
  vec2 px=vec2(gl_FragCoord.x,u_size.y-gl_FragCoord.y)/u_size;
  vec2 local=px*u_size/u_ratio;
  vec4 mass=u_count>1.5&&shape(local,u_b,u_radius.y)<shape(local,u_a,u_radius.x)?u_b:u_a;
  float d=dist(local),m=max(1.,min(mass.z,mass.w)),t=clamp(-d/(.6*m),0.,1.);
  float e=.75;
  vec2 n=normalize(vec2(dist(local+vec2(e,0.))-dist(local-vec2(e,0.)),dist(local+vec2(0.,e))-dist(local-vec2(0.,e)))+vec2(.00001));
  // Same edge refraction and directional specular model as the reference.
  vec2 refracted=local-n*pow(1.-t,2.2)*.6*m*u_lens;
  vec2 sampleAt=u_origin+(mass.xy+(refracted-mass.xy)/u_scale)*u_ratio;
  vec3 col=bg(sampleAt);
  float rim=pow(1.-t,3.);
  float sp=pow(max(dot(n,normalize(vec2(-.6,-.8))),0.),3.)+.5*pow(max(dot(n,normalize(vec2(.6,.8))),0.),3.);
  col+=vec3(rim*(.06+.35*sp)*min(1.,u_lens));
  gl_FragColor=vec4(col*u_darken,1.);
 }`;
 function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
 function init(){
  blurTargets.clear();
  program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,VS));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,FS));gl.bindAttribLocation(program,0,'p');gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  U={};for(const name of ['u_tex','u_res','u_size','u_origin','u_ratio','u_a','u_b','u_radius','u_count','u_scale','u_blur','u_lens','u_darken'])U[name]=gl.getUniformLocation(program,name);
  texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);for(const key of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,key,gl.LINEAR);for(const key of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,key,gl.CLAMP_TO_EDGE);
  blurProgram=gl.createProgram();gl.attachShader(blurProgram,shader(gl.VERTEX_SHADER,VS));gl.attachShader(blurProgram,shader(gl.FRAGMENT_SHADER,`precision mediump float;uniform sampler2D tex;uniform vec2 res,dir;void main(){vec2 p=gl_FragCoord.xy/res;vec4 c=texture2D(tex,p)*.227027;c+=(texture2D(tex,p+dir*1.384615)+texture2D(tex,p-dir*1.384615))*.316216;c+=(texture2D(tex,p+dir*3.230769)+texture2D(tex,p-dir*3.230769))*.070270;gl_FragColor=c;}`));gl.bindAttribLocation(blurProgram,0,'p');gl.linkProgram(blurProgram);if(!gl.getProgramParameter(blurProgram,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(blurProgram));BU={};for(const n of ['tex','res','dir'])BU[n]=gl.getUniformLocation(blurProgram,n);
 }
 try{init()}catch(error){console.error('WebGL glass shader:',error);return}
 function error(message){if(stats.errors.length<20)stats.errors.push(String(message));console.warn('WebGL glass:',message);document.documentElement.dataset.glassCaptureError=String(message).slice(0,200)}
 function sourceNodes(){return [...document.querySelectorAll('body > .app,#accountTicker,.profile-drawer,.sheet-backdrop.open > .sheet,.voice-popover')].filter(n=>{const c=getComputedStyle(n);return c.display!=='none'&&(n.matches('body > .app,#accountTicker')||n.closest('.open'))}).sort((a,b)=>panelRank(a)-panelRank(b))}
 const ignored=n=>n.matches?.('.bottom-zone,.vf-contour-zoom-stack,.dock-zoom-surfaces,.vf-webgl-glass,.vf-mirror-content,.top-atmosphere,script,iframe')||false;
 function trackSources(){
  for(const node of sourceNodes())if(!sources.has(node)){
   const state={node,canvas:null,dirty:true,width:0,height:0,version:0};sources.set(node,state);
   new MutationObserver(()=>{state.dirty=true}).observe(node,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','hidden','value','d','points','src']});
   node.addEventListener('input',()=>{state.dirty=true});node.addEventListener('scroll',()=>{if(panelRank(node))state.dirty=true},{passive:true});
  }
 }
 async function capture(now){
  if(capturing||now-lastCapture<120)return;
  const pending=[...sources.values()].find(s=>s.dirty&&sourceNodes().includes(s.node));if(!pending)return;
  capturing=true;pending.dirty=false;lastCapture=now;const began=performance.now(),node=pending.node,w=Math.max(1,node.offsetWidth),h=sourceHeight(node),screenAtStart=node.querySelector('.screen.active')?.id;
  // Safari canvas memory is bounded independently of page length.
  const scale=Math.min(1.5,window.devicePixelRatio||1,4096/h,2048/w);
  try{
   const canvas=await html2canvas(node,{backgroundColor:null,scale,logging:false,useCORS:true,allowTaint:false,imageTimeout:3000,foreignObjectRendering:false,scrollX:0,scrollY:0,width:w,height:h,ignoreElements:ignored,onclone:(doc,root)=>{
    root.style.transform='none';root.style.translate='none';root.style.scale='none';root.style.opacity='1';root.style.width=w+'px';
    if(panelRank(node)){root.style.backgroundColor='transparent';root.style.backgroundImage='none'}
    doc.querySelectorAll('.vf-contour-zoom-stack,.dock-zoom-surfaces,.vf-webgl-glass,.vf-mirror-content').forEach(n=>n.remove());
    doc.querySelectorAll('*').forEach(n=>{n.style.transition='none';n.style.animationPlayState='paused'});
   }});
   if(node.querySelector('.screen.active')?.id!==screenAtStart){pending.dirty=true;return}
   pending.canvas=canvas;pending.width=w;pending.height=h;pending.version=++serial;stats.captures++;stats.lastCaptureMs=performance.now()-began;
   document.documentElement.dataset.glassTextureVersion=String(serial);
  }catch(e){error(e.message);pending.dirty=true}finally{capturing=false}
 }
 function refresh(){for(const source of sources.values())source.dirty=true;schedule()}
 function sourceHeight(node){return Math.max(1,panelRank(node)?node.offsetHeight:Math.max(node.scrollHeight,node.offsetHeight))}
 function panelRank(n){return n.classList.contains('profile-drawer')?1:n.matches('.sheet,.voice-popover')?2:0}
 function compose(rank){
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=getComputedStyle(document.body).backgroundColor||'#050505';ctx.fillRect(0,0,scene.width,scene.height);
  const sx=scene.width/innerWidth,sy=scene.height/innerHeight;
  for(const node of sourceNodes()){
   if(panelRank(node)>=rank&&panelRank(node)>0)continue;
   const s=sources.get(node),r=node.getBoundingClientRect(),c=getComputedStyle(node);ctx.globalAlpha=parseFloat(c.opacity)||0;
   if(panelRank(node)){const glass=[...mirrors.values()].find(m=>m.host===node&&m.optics?.zone==='center'&&m.canvas.style.visibility==='visible');if(glass)compositeDock(glass)}
   if(!s?.canvas){ctx.globalAlpha=1;continue}
   ctx.drawImage(s.canvas,r.left*sx,r.top*sy,r.width*sx,r.height*sy);ctx.globalAlpha=1;
  }
 }
 function shapeSpec(record){
  if(record.optics?.shapes)return record.optics.shapes.filter(v=>v[5]===undefined||v[5]>.001).slice(0,2).map(v=>[v[0]+v[2]/2,v[1]+v[3]/2,Math.max(.1,v[2]/2),Math.max(.1,v[3]/2)]);
  return [[record.host.clientWidth/2,record.host.clientHeight/2,record.host.clientWidth/2,record.host.clientHeight/2]];
 }
 function blurredTexture(radius,W,H){
  if(radius<.75)return texture;
  const key=radius.toFixed(1),div=Math.max(1,radius/3,W/512,H/1024),w=Math.max(2,Math.ceil(W/div)),h=Math.max(2,Math.ceil(H/div));let target=blurTargets.get(key);
  if(!target){if(blurTargets.size>=10){const first=blurTargets.keys().next().value;for(const p of blurTargets.get(first).pairs){gl.deleteTexture(p.tex);gl.deleteFramebuffer(p.fb)}blurTargets.delete(first)}target={width:w,height:h,pairs:[0,1].map(()=>{const tex=gl.createTexture(),fb=gl.createFramebuffer();gl.bindTexture(gl.TEXTURE_2D,tex);for(const k of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,k,gl.LINEAR);for(const k of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE);gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);return {tex,fb}})};blurTargets.set(key,target)}
  if(target.valid)return target.pairs[1].tex;
  target.width=w;target.height=h;gl.useProgram(blurProgram);gl.uniform1i(BU.tex,0);gl.uniform2f(BU.res,w,h);
  for(let i=0;i<2;i++){const pair=target.pairs[i];gl.bindTexture(gl.TEXTURE_2D,pair.tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.bindFramebuffer(gl.FRAMEBUFFER,pair.fb);gl.viewport(0,0,w,h);gl.bindTexture(gl.TEXTURE_2D,i?target.pairs[0].tex:texture);gl.uniform2f(BU.dir,i?0:radius/1.7/W,i?radius/1.7/H:0);gl.drawArrays(gl.TRIANGLE_STRIP,0,4)}
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);target.valid=true;return target.pairs[1].tex;
 }
 function invalidateBlur(){for(const target of blurTargets.values())target.valid=false}
 function compositeDock(record){
  const box=record.layer.getBoundingClientRect(),sx=scene.width/innerWidth,sy=scene.height/innerHeight;
  ctx.save();ctx.translate(box.left*sx,box.top*sy);ctx.scale(box.width/record.layer.clientWidth*sx,box.height/record.layer.clientHeight*sy);ctx.beginPath();
  for(const v of record.optics.shapes){if(v[5]<=.001)continue;const [x,y,w,h]=v,r=Math.min(v[4],w/2,h/2);ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
  ctx.clip();ctx.drawImage(record.canvas,0,0,record.layer.clientWidth,record.layer.clientHeight);ctx.restore();
 }
 function render(){
  if(stats.lost||!mirrors.size||![...sources.values()].some(s=>s.canvas))return;
  const began=performance.now();
  const positions=n=>{const r=n.getBoundingClientRect();return [r.left,r.top,r.width,r.height].map(v=>v.toFixed(2)).join(',')+':'+getComputedStyle(n).opacity};
  const key=[innerWidth,innerHeight,serial,updateRevision,...sourceNodes().map(positions),...[...mirrors.values()].map(r=>positions(r.layer))].join('|');
  if(key===lastKey)return;lastKey=key;
  const dpr=Math.min(devicePixelRatio||1,1.5),W=Math.ceil(innerWidth*dpr),H=Math.ceil(innerHeight*dpr);
  if(scene.width!==W||scene.height!==H){scene.width=W;scene.height=H}
  invalidateBlur();const records=[...mirrors.values()].filter(r=>r.layer.isConnected&&getComputedStyle(r.layer).display!=='none').sort((a,b)=>a.rank-b.rank||a.order-b.order);let rank=-1,dockSurface=null,indicatorComposed=false;
  for(const record of records){
   const box=record.layer.getBoundingClientRect(),host=record.host.getBoundingClientRect();if(!box.width||!box.height||box.bottom<0||box.top>innerHeight)continue;
   const localW=record.layer.clientWidth,localH=record.layer.clientHeight;if(!localW||!localH)continue;
   if(rank!==record.rank){compose(record.rank);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,scene);invalidateBlur();rank=record.rank}
   if(record.host.classList.contains('dock-indicator')&&dockSurface&&!indicatorComposed){compositeDock(dockSurface);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,scene);invalidateBlur();indicatorComposed=true}
   const sampled=blurredTexture(record.blur*dpr/record.scale,W,H);gl.bindTexture(gl.TEXTURE_2D,sampled);
   const width=Math.ceil(box.width*dpr),height=Math.ceil(box.height*dpr);
   if(gpu.width!==width||gpu.height!==height){gpu.width=width;gpu.height=height}
   gl.viewport(0,0,width,height);gl.useProgram(program);gl.uniform1i(U.u_tex,0);gl.uniform2f(U.u_res,W,H);gl.uniform2f(U.u_size,width,height);gl.uniform2f(U.u_origin,box.left*dpr,box.top*dpr);gl.uniform2f(U.u_ratio,width/localW,height/localH);
   const shapes=shapeSpec(record),radii=record.optics?.shapes?.filter(v=>v[5]===undefined||v[5]>.001).map(v=>v[4])||[parseFloat(getComputedStyle(record.host).borderTopLeftRadius)||0];gl.uniform4fv(U.u_a,shapes[0]||[0,0,.1,.1]);gl.uniform4fv(U.u_b,shapes[1]||shapes[0]||[0,0,.1,.1]);gl.uniform2f(U.u_radius,radii[0]||0,radii[1]||radii[0]||0);gl.uniform1f(U.u_count,shapes.length);gl.uniform1f(U.u_scale,record.scale);gl.uniform1f(U.u_blur,record.blur);gl.uniform1f(U.u_lens,record.lens);
   gl.uniform1f(U.u_darken,record.host.classList.contains('dock-indicator')?.84:1);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
   if(record.canvas.width!==width||record.canvas.height!==height){record.canvas.width=width;record.canvas.height=height}
   record.context.clearRect(0,0,width,height);record.context.drawImage(gpu,0,0);record.canvas.style.visibility='visible';record.canvas.dataset.textureVersion=String(serial);record.canvas.dataset.frame=String(stats.frames);
   if(record.host.id==='dockZoomSurfaces'&&record.optics?.zone==='center')dockSurface=record;
  }
  stats.frames++;if(stats.frames%120===1){const code=gl.getError();if(code!==gl.NO_ERROR)error('GPU error '+code)}stats.renderCostMs=performance.now()-began;lastRender=performance.now();document.documentElement.dataset.glassFrame=String(stats.frames);
 }
 function tick(now){raf=0;if(document.visibilityState==='hidden')return;trackSources();
  if(!document.documentElement.classList.contains('vf-popup-motion'))for(const record of mirrors.values()){const backdrop=record.host.closest('.profile-drawer-backdrop,.sheet-backdrop');if(backdrop&&!backdrop.classList.contains('open'))remove(record.layer)}
  if(now-lastPoll>800){lastPoll=now;for(const s of sources.values()){if(s.node.offsetWidth!==s.width||sourceHeight(s.node)!==s.height||s.node.id==='accountTicker')s.dirty=true}}
  capture(now);if(now-lastRender>14)render();if(mirrors.size)raf=requestAnimationFrame(tick);
 }
 function schedule(){if(!raf&&active)raf=requestAnimationFrame(tick)}
 function update(layer,host,scale=1,blur=0,lens=1,chromatic=null,optics=null){
  let record=mirrors.get(layer);
  if(!record){legacy.remove(layer);const canvas=document.createElement('canvas');canvas.className='vf-webgl-glass';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;visibility:hidden';layer.replaceChildren(canvas);record={layer,host,canvas,context:canvas.getContext('2d')};mirrors.set(layer,record)}
  const key=JSON.stringify([scale,blur,lens,optics]);if(record.key!==key){record.key=key;updateRevision++}
  Object.assign(record,{host,scale,blur,lens:Math.max(0,lens),optics,order:host.id==='dockZoomSurfaces'?0:host.classList.contains('dock-indicator')?2:1,rank:host.classList.contains('profile-drawer')?1:host.matches('.sheet,.voice-popover')?2:0});
  active=true;document.documentElement.dataset.glassRenderer='webgl';schedule();
 }
 function remove(layer){const record=mirrors.get(layer);if(record){layer.replaceChildren();mirrors.delete(layer);updateRevision++}else legacy.remove(layer);if(!mirrors.size&&raf){cancelAnimationFrame(raf);raf=0}}
 gpu.addEventListener('webglcontextlost',e=>{e.preventDefault();stats.lost=true;error('WebGL context lost')});
 gpu.addEventListener('webglcontextrestored',()=>{try{init();lastKey='';stats.lost=false;schedule()}catch(e){error(e.message)}});
 addEventListener('visibilitychange',schedule);addEventListener('resize',refresh);addEventListener('scroll',schedule,{capture:true,passive:true});
 legacy.suspend?.();
 window.VFMirror={update,remove,refresh,flush(){trackSources();capture(performance.now());render();schedule()},backend:'webgl',diagnostics:()=>({...stats,textureVersion:serial,surfaces:mirrors.size,sources:[...sources.values()].map(s=>({element:s.node.id||s.node.className,version:s.version,width:s.width,height:s.height,dirty:s.dirty}))})};
})();
