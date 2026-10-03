/* Liquid Studio optics, adapted from the supplied live-DOM WebGL example.
 * Cached HTML blocks stay on the GPU. Scrolling moves textured quads, not
 * screenshots. Motion Studio still owns geometry, masks, material and input.
 */
(() => {
 'use strict';
 if (!new URLSearchParams(location.search).has('studio')) return;
 const legacy = window.VFMirror;
 if (!window.html2canvas || !window.VFDomTextureCache) { console.error('WebGL glass: DOM texture cache unavailable'); return; }
 const gpu = document.createElement('canvas');
 const gl = gpu.getContext('webgl', {alpha:true, antialias:false, premultipliedAlpha:false});
 if (!gl) { console.warn('WebGL glass unavailable; retaining previous renderer'); return; }
 const mirrors = new Map(), scenes = new Map(), blurTargets = new Map(), panelTargets = new Map();
 const stats = {frames:0, scenePasses:0, lost:false, errors:[], renderCostMs:0};
 let cache, optical, copy, blur, solid, quad, fullscreen, raf=0, serial=0, revision=0;
 let active=false, lastKey='', lastMotionKey='', W=0, H=0, ratio=1, outputW=1, outputH=1;
 const VS = 'attribute vec2 p;attribute vec2 uv;varying mediump vec2 v_uv;void main(){v_uv=uv;gl_Position=vec4(p,0.,1.);}';
 const PRECISION = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
 const FS = PRECISION + `
 uniform sampler2D u_tex,u_parentTex;
 uniform vec2 u_view,u_size,u_local,u_pixelOrigin;
 uniform vec4 u_world,u_a,u_b,u_tint;
 uniform vec2 u_radius;
 uniform vec4 u_corners,u_parentCorners;
 uniform float u_count,u_scale,u_lens,u_clip,u_alpha;
 uniform vec4 u_parentWorld,u_parentA,u_parentB,u_parentTint;
 uniform vec2 u_parentLocal,u_parentRadius;
 uniform float u_parentCount,u_parentScale,u_parentLens;
 uniform vec4 u_rgbA,u_rgbB;
 uniform float u_rgbCount,u_rgbStrength;
 float sdRB(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return min(max(q.x,q.y),0.)+length(max(q,0.))-r;}
 float shape(vec2 p,vec4 s,float r,vec4 corners){
  vec2 q=p-s.xy;if(corners.x>=0.)r=q.y<0.?(q.x<0.?corners.x:corners.y):(q.x<0.?corners.w:corners.z);
  return sdRB(q,s.zw,min(r,min(s.z,s.w)));
 }
 float dist(vec2 p,vec4 a,vec4 b,vec2 radius,float count,vec4 corners){float d=shape(p,a,radius.x,corners);return count>1.5?min(d,shape(p,b,radius.y,corners)):d;}
 vec4 massAt(vec2 p,vec4 a,vec4 b,vec2 radius,float count,vec4 corners){return count>1.5&&shape(p,b,radius.y,corners)<shape(p,a,radius.x,corners)?b:a;}
 vec2 normalAt(vec2 p,vec4 a,vec4 b,vec2 r,float count,vec4 corners){
  vec2 e=vec2(.75,0.);return normalize(vec2(dist(p+e,a,b,r,count,corners)-dist(p-e,a,b,r,count,corners),dist(p+e.yx,a,b,r,count,corners)-dist(p-e.yx,a,b,r,count,corners))+vec2(.00001));
 }
 vec2 refractAt(vec2 p,vec4 a,vec4 b,vec2 radius,float count,vec4 corners,float lens,float scale){
  vec4 mass=massAt(p,a,b,radius,count,corners);float m=max(1.,min(mass.z,mass.w));
  float t=clamp(-dist(p,a,b,radius,count,corners)/(.6*m),0.,1.);vec2 n=normalAt(p,a,b,radius,count,corners);
  vec2 refracted=p-n*pow(1.-t,2.2)*.6*m*lens;
  return mass.xy+(refracted-mass.xy)/max(.5,scale);
 }
 vec3 shineAt(vec2 p,vec4 a,vec4 b,vec2 r,float count,vec4 corners,float lens){
  vec4 mass=massAt(p,a,b,r,count,corners);float m=max(1.,min(mass.z,mass.w));
  float t=clamp(-dist(p,a,b,r,count,corners)/(.6*m),0.,1.);vec2 n=normalAt(p,a,b,r,count,corners);
  float sp=pow(max(dot(n,normalize(vec2(-.6,-.8))),0.),3.)+.5*pow(max(dot(n,normalize(vec2(.6,.8))),0.),3.);
  return vec3(pow(1.-t,3.)*(.06+.35*sp)*min(1.,lens));
 }
 vec3 bg(vec2 world){vec2 q=clamp(world/u_view,vec2(.0001),vec2(.9999));return texture2D(u_tex,vec2(q.x,1.-q.y)).rgb;}
 // Nested optics, as barColor in the supplied example: the indicator refracts
 // the bar's result, not another independently shifted copy of the page.
 vec3 barColor(vec2 world){
  vec3 plain=bg(world);if(u_parentCount<.5)return plain;
  vec2 p=(world-u_parentWorld.xy)*u_parentLocal/u_parentWorld.zw;
  float d=dist(p,u_parentA,u_parentB,u_parentRadius,u_parentCount,u_parentCorners);if(d>1.)return plain;
  vec2 rp=refractAt(p,u_parentA,u_parentB,u_parentRadius,u_parentCount,u_parentCorners,u_parentLens,u_parentScale);
  vec2 wp=u_parentWorld.xy+rp*u_parentWorld.zw/u_parentLocal;
  vec2 q=clamp(wp/u_view,vec2(.0001),vec2(.9999));vec3 c=texture2D(u_parentTex,vec2(q.x,1.-q.y)).rgb;
  c+=shineAt(p,u_parentA,u_parentB,u_parentRadius,u_parentCount,u_parentCorners,u_parentLens);
  c=mix(c,u_parentTint.rgb,u_parentTint.a);return mix(plain,c,clamp(.5-d,0.,1.));
 }
 void main(){
  vec2 pixel=gl_FragCoord.xy-u_pixelOrigin;
  vec2 p=vec2(pixel.x,u_size.y-pixel.y)/u_size*u_local;
  vec2 rp=refractAt(p,u_a,u_b,u_radius,u_count,u_corners,u_lens,u_scale);vec2 world=u_world.xy+rp*u_world.zw/u_local;
  vec3 c=barColor(world);
  if(abs(u_rgbStrength)>.001){
   vec4 center=u_rgbA;
   if(u_rgbCount>1.5&&length((p-u_rgbB.xy)/max(u_rgbB.zw,vec2(1.)))<length((p-center.xy)/max(center.zw,vec2(1.))))center=u_rgbB;
   vec2 radial=normalize((p-center.xy)/max(center.zw,vec2(1.))+vec2(.00001));vec2 offset=radial*u_rgbStrength*u_world.zw/u_local;
   c=vec3(barColor(world+offset).r,c.g,barColor(world-offset).b);
  }
  c+=shineAt(p,u_a,u_b,u_radius,u_count,u_corners,u_lens);c=mix(c,u_tint.rgb,u_tint.a);
  float a=u_alpha*(u_clip>.5?clamp(.5-dist(p,u_a,u_b,u_radius,u_count,u_corners),0.,1.):1.);
  // The visible layer is clipped by Studio's EXACT animated SVG/CSS mask.
  // SDF alpha is used only when depositing a popup beneath another popup.
  gl_FragColor=vec4(c*a,a);
 }`;
 const OPTICS_NAMES = ['u_tex','u_parentTex','u_view','u_size','u_local','u_pixelOrigin','u_world','u_a','u_b','u_tint','u_radius','u_corners','u_count','u_scale','u_lens','u_clip','u_alpha','u_parentWorld','u_parentA','u_parentB','u_parentTint','u_parentLocal','u_parentRadius','u_parentCorners','u_parentCount','u_parentScale','u_parentLens','u_rgbA','u_rgbB','u_rgbCount','u_rgbStrength'];
 function report(message){if(stats.errors.length<20)stats.errors.push(String(message));console.warn('WebGL glass:',message);document.documentElement.dataset.glassCaptureError=String(message).slice(0,200);}
 function makeProgram(fragment,names){
  const program=gl.createProgram();
  for(const [type,source] of [[gl.VERTEX_SHADER,VS],[gl.FRAGMENT_SHADER,fragment]]){
   const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
   if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);gl.deleteProgram(program);throw Error(message);}
   gl.attachShader(program,shader);gl.deleteShader(shader);
  }
  gl.bindAttribLocation(program,0,'p');gl.bindAttribLocation(program,1,'uv');gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)){const message=gl.getProgramInfoLog(program);gl.deleteProgram(program);throw Error(message);}
  const U={};for(const name of names)U[name]=gl.getUniformLocation(program,name);return {program,U};
 }
 function init(){
  optical=makeProgram(FS,OPTICS_NAMES);
  copy=makeProgram(PRECISION+`varying mediump vec2 v_uv;uniform sampler2D tex;uniform float alpha,flip,premult,clip;
   uniform vec2 view;uniform vec4 box,corners;
   void main(){vec2 q=vec2(v_uv.x,mix(v_uv.y,1.-v_uv.y,flip));vec4 c=texture2D(tex,q);float mask=1.;
    if(clip>.5){vec2 p=v_uv*view-box.xy;float r=p.y<0.?(p.x<0.?corners.x:corners.y):(p.x<0.?corners.w:corners.z);vec2 d=abs(p)-box.zw+r;float sdf=min(max(d.x,d.y),0.)+length(max(d,0.))-r;mask=clamp(.5-sdf,0.,1.);}
    gl_FragColor=vec4(c.rgb*mix(c.a,1.,premult)*alpha*mask,c.a*alpha*mask);
   }`, ['tex','alpha','flip','premult','clip','view','box','corners']);
  blur=makeProgram(PRECISION+'uniform sampler2D tex;uniform vec2 res,dir;void main(){vec2 p=gl_FragCoord.xy/res;vec4 c=texture2D(tex,p)*.227027;c+=(texture2D(tex,p+dir*1.384615)+texture2D(tex,p-dir*1.384615))*.316216;c+=(texture2D(tex,p+dir*3.230769)+texture2D(tex,p-dir*3.230769))*.070270;gl_FragColor=c;}', ['tex','res','dir']);
  solid=makeProgram(PRECISION+'uniform vec4 tint;void main(){gl_FragColor=vec4(tint.rgb*tint.a,tint.a);}', ['tint']);
  quad=gl.createBuffer();fullscreen=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,fullscreen);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,0,1,1,-1,1,1,-1,1,0,0,1,1,1,0]),gl.STATIC_DRAW);
  cache=new VFDomTextureCache(gl,{onDirty:schedule,onError:report});
 }
 try{init();}catch(error){report(error.message);return;}
 function attributes(buffer){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(0,2,gl.FLOAT,false,16,0);gl.vertexAttribPointer(1,2,gl.FLOAT,false,16,8);}
 function newTarget(w,h){
  const tex=gl.createTexture(),fb=gl.createFramebuffer();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);
  for(const key of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,key,gl.LINEAR);
  for(const key of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,key,gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
  if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){gl.deleteTexture(tex);gl.deleteFramebuffer(fb);throw Error('Glass framebuffer unavailable');}
  return {tex,fb,w,h};
 }
 function releaseTarget(t){gl.deleteTexture(t.tex);gl.deleteFramebuffer(t.fb);}
 function resetTargets(){for(const t of scenes.values())releaseTarget(t);scenes.clear();for(const t of blurTargets.values())t.pairs.forEach(releaseTarget);blurTargets.clear();for(const t of panelTargets.values())releaseTarget(t);panelTargets.clear();}
 function panelRank(node){return node.closest('.profile-drawer')?1:node.closest('.sheet,.voice-popover')?2:0;}
 function visible(node){const s=getComputedStyle(node),r=node.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;}
 function sourceNodes(){
  const result=[];
  for(const screen of document.querySelectorAll('body > .app .screen.active'))result.push(...screen.children);
  // Studio hides the ticker. If it is shown, capture moving cells separately.
  const ticker=document.querySelector('#accountTicker');if(ticker&&visible(ticker))result.push(...ticker.querySelectorAll('.ticker-item'));
  for(const panel of document.querySelectorAll('.profile-drawer,.sheet,.voice-popover')){
   const backdrop=panel.closest('.profile-drawer-backdrop,.sheet-backdrop');
   const box=panel.getBoundingClientRect(),onScreen=box.right>0&&box.left<innerWidth&&box.bottom>0&&box.top<innerHeight;
   if(visible(panel)&&onScreen&&((backdrop||panel).classList.contains('open')||document.documentElement.classList.contains('vf-popup-motion')))result.push(...panel.children);
  }
  return result.filter(n=>!n.matches('script,style,.vf-contour-zoom-stack,.dock-zoom-surfaces,.vf-webgl-glass,.vf-mirror-content')&&visible(n));
 }
 function boxKey(node){const r=node.getBoundingClientRect();return [r.left,r.top,r.width,r.height].map(v=>v.toFixed(2)).join(',')+':'+inheritedOpacity(node);}
 function paintTexture(target,tex,box,alpha=1,flip=0,panel=null){
  gl.bindFramebuffer(gl.FRAMEBUFFER,target.fb);gl.viewport(0,0,W,H);gl.useProgram(copy.program);
  const l=box.left/innerWidth*2-1,r=box.right/innerWidth*2-1,t=1-box.top/innerHeight*2,b=1-box.bottom/innerHeight*2;
  gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([l,b,0,1,r,b,1,1,l,t,0,0,r,t,1,0]),gl.DYNAMIC_DRAW);attributes(quad);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);gl.uniform1i(copy.U.tex,0);gl.uniform1f(copy.U.alpha,alpha);gl.uniform1f(copy.U.flip,flip);gl.uniform1f(copy.U.premult,flip);gl.uniform1f(copy.U.clip,panel?1:0);
  if(panel){
   const b=panel.getBoundingClientRect(),style=getComputedStyle(panel),factor=b.width/Math.max(1,panel.clientWidth);
   gl.uniform2f(copy.U.view,innerWidth,innerHeight);gl.uniform4f(copy.U.box,b.left+b.width/2,b.top+b.height/2,b.width/2,b.height/2);
   gl.uniform4fv(copy.U.corners,['borderTopLeftRadius','borderTopRightRadius','borderBottomRightRadius','borderBottomLeftRadius'].map(k=>(parseFloat(style[k])||0)*factor));
  }
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
 }
 function inheritedOpacity(node){let a=1;for(let p=node;p&&p!==document.documentElement;p=p.parentElement)a*=Number(getComputedStyle(p).opacity)||0;return a;}
 function sourceClip(node){
  let clip={left:0,top:0,right:innerWidth,bottom:innerHeight};
  for(let p=node.parentElement;p&&p!==document.body;p=p.parentElement){
   const s=getComputedStyle(p),r=p.getBoundingClientRect();
   if(/hidden|clip|auto|scroll/.test(s.overflowX||s.overflow||'')){clip.left=Math.max(clip.left,r.left);clip.right=Math.min(clip.right,r.right);}
   if(/hidden|clip|auto|scroll/.test(s.overflowY||s.overflow||'')){clip.top=Math.max(clip.top,r.top);clip.bottom=Math.min(clip.bottom,r.bottom);}
  }
  return clip;
 }
 function shapes(record){
  const w=record.layer.clientWidth,h=record.layer.clientHeight;
  const values=(record.optics?.shapes||[[0,0,w,h,parseFloat(getComputedStyle(record.host).borderTopLeftRadius)||0,1]]).filter(v=>v[5]===undefined||v[5]>.001).slice(0,2);
  return {masses:values.map(v=>[v[0]+v[2]/2,v[1]+v[3]/2,Math.max(.1,v[2]/2),Math.max(.1,v[3]/2)]),radii:values.map(v=>Math.max(0,v[4]))};
 }
 function color(value){const n=String(value||'').match(/[\d.]+/g)?.map(Number)||[];return n.length>=3?[n[0]/255,n[1]/255,n[2]/255,n[3]??1]:[0,0,0,0];}
 function blurredTexture(target,radius){
  if(radius<.75)return target.tex;
  const key=target.rank+':'+radius.toFixed(1),div=Math.max(1,radius/3,W/512,H/1024),w=Math.max(2,Math.ceil(W/div)),h=Math.max(2,Math.ceil(H/div));let t=blurTargets.get(key);
  if(!t){if(blurTargets.size>=10){const first=blurTargets.keys().next().value;blurTargets.get(first).pairs.forEach(releaseTarget);blurTargets.delete(first);}t={pairs:[newTarget(w,h),newTarget(w,h)],version:-1};blurTargets.set(key,t);}
  else {blurTargets.delete(key);blurTargets.set(key,t);}
  if(t.pairs[0].w!==w||t.pairs[0].h!==h){t.pairs.forEach(releaseTarget);t.pairs=[newTarget(w,h),newTarget(w,h)];t.version=-1;}
  if(t.version===target.version)return t.pairs[1].tex;
  gl.disable(gl.BLEND);attributes(fullscreen);gl.useProgram(blur.program);gl.uniform1i(blur.U.tex,0);gl.uniform2f(blur.U.res,w,h);
  for(let i=0;i<2;i++){gl.bindFramebuffer(gl.FRAMEBUFFER,t.pairs[i].fb);gl.viewport(0,0,w,h);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,i?t.pairs[0].tex:target.tex);gl.uniform2f(blur.U.dir,i?0:radius/1.7/W,i?radius/1.7/H:0);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}
  t.version=target.version;return t.pairs[1].tex;
 }
 function bindOptics(record,target,parent=null,clip=false){
  const box=record.layer.getBoundingClientRect(),localW=record.layer.clientWidth,localH=record.layer.clientHeight;
  const width=Math.max(1,Math.ceil(box.width*ratio)),height=Math.max(1,Math.ceil(box.height*ratio));
  const ownBlur=record.blur*ratio*Math.min(box.width/localW,box.height/localH)/record.scale;
  const pb=parent?.layer.getBoundingClientRect(),parentBlur=parent?parent.blur*ratio*Math.min(pb.width/parent.layer.clientWidth,pb.height/parent.layer.clientHeight)/parent.scale:0;
  const tex=blurredTexture(target,ownBlur),parentTex=parent?blurredTexture(target,Math.hypot(ownBlur,parentBlur)):tex;
  gl.useProgram(optical.program);attributes(fullscreen);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,parentTex);
  const U=optical.U,s=shapes(record),empty=[0,0,.1,.1];
  gl.uniform1i(U.u_tex,0);gl.uniform1i(U.u_parentTex,1);gl.uniform2f(U.u_view,innerWidth,innerHeight);gl.uniform2f(U.u_size,width,height);gl.uniform2f(U.u_local,localW,localH);gl.uniform2f(U.u_pixelOrigin,0,0);gl.uniform4f(U.u_world,box.left,box.top,box.width,box.height);
  gl.uniform4fv(U.u_a,s.masses[0]||empty);gl.uniform4fv(U.u_b,s.masses[1]||s.masses[0]||empty);gl.uniform2f(U.u_radius,s.radii[0]||0,s.radii[1]||s.radii[0]||0);gl.uniform1f(U.u_count,s.masses.length);
  const popup=record.host.matches('.profile-drawer,.sheet,.voice-popover');
  const cornerRadii=r=>r.host.matches('.profile-drawer,.sheet,.voice-popover')?['borderTopLeftRadius','borderTopRightRadius','borderBottomRightRadius','borderBottomLeftRadius'].map(k=>parseFloat(getComputedStyle(r.host)[k])||0):[-1,-1,-1,-1];
  gl.uniform4fv(U.u_corners,cornerRadii(record));gl.uniform4fv(U.u_parentCorners,parent?cornerRadii(parent):[-1,-1,-1,-1]);
  gl.uniform1f(U.u_scale,record.scale);gl.uniform1f(U.u_lens,record.lens);gl.uniform1f(U.u_clip,clip?1:0);gl.uniform1f(U.u_alpha,1);gl.uniform4fv(U.u_tint,popup?color(getComputedStyle(record.host).backgroundColor):[0,0,0,0]);
  if(parent){
   const p=shapes(parent),b=parent.layer.getBoundingClientRect();gl.uniform4f(U.u_parentWorld,b.left,b.top,b.width,b.height);gl.uniform2f(U.u_parentLocal,parent.layer.clientWidth,parent.layer.clientHeight);
   gl.uniform4fv(U.u_parentA,p.masses[0]||empty);gl.uniform4fv(U.u_parentB,p.masses[1]||p.masses[0]||empty);gl.uniform2f(U.u_parentRadius,p.radii[0]||0,p.radii[1]||p.radii[0]||0);gl.uniform1f(U.u_parentCount,p.masses.length);gl.uniform1f(U.u_parentScale,parent.scale);gl.uniform1f(U.u_parentLens,parent.lens);
   gl.uniform4fv(U.u_parentTint,color(getComputedStyle(parent.host).getPropertyValue('--dock-entry-tint')));
  }else{gl.uniform1f(U.u_parentCount,0);gl.uniform4f(U.u_parentWorld,0,0,1,1);gl.uniform2f(U.u_parentLocal,1,1);}
  const rgb=record.chromatic,points=rgb?.centers||[],enabled=rgb?.enabled&&record.optics?.zone==='edge';
  const point=v=>v?[v.x,v.y,Math.max(1,v.width/2),Math.max(1,v.height/2)]:[localW/2,localH/2,localW/2,localH/2];
  gl.uniform4fv(U.u_rgbA,point(points[0]));gl.uniform4fv(U.u_rgbB,point(points[1]||points[0]));gl.uniform1f(U.u_rgbCount,points.length||1);gl.uniform1f(U.u_rgbStrength,enabled?(rgb.strength||0)*(rgb.direction||1):0);gl.activeTexture(gl.TEXTURE0);
  return {box,width,height};
 }
 function paintShade(target,rank){
  const selector=rank===1?'.profile-drawer-backdrop':'.sheet-backdrop';
  for(const node of document.querySelectorAll(selector)){
   if(!visible(node))continue;const tint=color(getComputedStyle(node).backgroundColor);tint[3]*=inheritedOpacity(node);if(tint[3]<=0)continue;
   gl.bindFramebuffer(gl.FRAMEBUFFER,target.fb);gl.viewport(0,0,W,H);gl.useProgram(solid.program);attributes(fullscreen);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.uniform4fv(solid.U.tint,tint);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }
 }
 function paintBlock(target,source,opacity){
  const b=source.node.getBoundingClientRect();if(b.bottom<0||b.top>innerHeight||b.right<0||b.left>innerWidth)return;
  const c=sourceClip(source.node);if(c.right<=c.left||c.bottom<=c.top)return;
  gl.enable(gl.SCISSOR_TEST);gl.scissor(Math.ceil(c.left*ratio),Math.ceil(H-c.bottom*ratio),Math.max(0,Math.floor((c.right-c.left)*ratio)),Math.max(0,Math.floor((c.bottom-c.top)*ratio)));
  paintTexture(target,source.texture,b,opacity);gl.disable(gl.SCISSOR_TEST);
 }
 function paintPanel(target,base,panel){
  const opacity=inheritedOpacity(panel.host);if(opacity<=0)return;
  let group=panelTargets.get(panel.host);if(!group){group=newTarget(W,H);panelTargets.set(panel.host,group);}
  gl.bindFramebuffer(gl.FRAMEBUFFER,group.fb);gl.viewport(0,0,W,H);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  const o=bindOptics(panel,base,null,true),left=Math.round(o.box.left*ratio),bottom=Math.round(H-o.box.bottom*ratio);
  gl.bindFramebuffer(gl.FRAMEBUFFER,group.fb);gl.viewport(left,bottom,o.width,o.height);gl.uniform2f(optical.U.u_pixelOrigin,left,bottom);gl.disable(gl.BLEND);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  for(const source of cache.records)if(source.ready&&source.node.closest('.profile-drawer,.sheet,.voice-popover')===panel.host)paintBlock(group,source,inheritedOpacity(source.node)/opacity);
  // Parent opacity is applied once to the completed glass+content group.
  paintTexture(target,group.tex,{left:0,top:0,right:innerWidth,bottom:innerHeight},opacity,1,panel.host);
 }
 function sceneFor(rank,records,includeShade=true){
  const sceneKey=rank+':'+includeShade;
  let target=scenes.get(sceneKey);if(target?.version===serial)return target;if(!target){target={...newTarget(W,H),rank:sceneKey,version:-1};scenes.set(sceneKey,target);}
  gl.bindFramebuffer(gl.FRAMEBUFFER,target.fb);gl.viewport(0,0,W,H);gl.disable(gl.BLEND);const bg=color(getComputedStyle(document.body).backgroundColor);gl.clearColor(bg[0],bg[1],bg[2],1);gl.clear(gl.COLOR_BUFFER_BIT);
  if(rank>0){
   const base=sceneFor(rank-1,records);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);paintTexture(target,base.tex,{left:0,top:0,right:innerWidth,bottom:innerHeight},1,1);
   if(rank>1)for(const panel of records.filter(r=>r.rank===rank-1&&r.optics?.zone==='center'&&r.host.matches('.profile-drawer,.sheet,.voice-popover')))paintPanel(target,base,panel);
  }
  // Page blocks are painted once in rank 0. Rank 1 copies that result and
  // adds the drawer shade; rank 2 deposits drawer glass/content + sheet shade.
  if(rank===0){
   gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
   for(const source of cache.records)if(source.ready&&panelRank(source.node)===0)paintBlock(target,source,inheritedOpacity(source.node));
  }
  if(rank>0&&includeShade)paintShade(target,rank);gl.disable(gl.BLEND);target.version=serial;stats.scenePasses++;return target;
 }
 function render(records){
  if(stats.lost||!records.length||!cache.records.some(s=>s.ready))return;
  // Keep the last valid surface during a newly opened page/panel bootstrap.
  // Do not flash partially captured text over a black, incomplete background.
  if(cache.records.some(s=>!s.ready&&s.node.getBoundingClientRect().bottom>0&&s.node.getBoundingClientRect().top<innerHeight))return;
  const shadeKey=[...document.querySelectorAll('.profile-drawer-backdrop,.sheet-backdrop')].filter(visible).map(n=>getComputedStyle(n).backgroundColor+':'+inheritedOpacity(n));
  const began=performance.now(),key=[innerWidth,innerHeight,cache.serial,revision,...cache.records.map(s=>boxKey(s.node)),...records.map(r=>boxKey(r.layer)),...shadeKey].join('|');if(key===lastKey)return;lastKey=key;serial++;
  const maxSide=Math.min(4096,Number(gl.getParameter(gl.MAX_TEXTURE_SIZE))||4096);ratio=Math.min(devicePixelRatio||1,1.5,maxSide/innerWidth,maxSide/innerHeight);
  const nextW=Math.ceil(innerWidth*ratio),nextH=Math.ceil(innerHeight*ratio);if(nextW!==W||nextH!==H){resetTargets();W=nextW;H=nextH;}
  const sizes=records.map(r=>r.layer.getBoundingClientRect()),maxW=Math.max(1,...sizes.map(b=>Math.ceil(b.width*ratio))),maxH=Math.max(1,...sizes.map(b=>Math.ceil(b.height*ratio)));
  // One growing drawing buffer, not repeated per-surface canvas reallocations.
  if(maxW>outputW||maxH>outputH){outputW=Math.max(outputW,maxW);outputH=Math.max(outputH,maxH);gpu.width=outputW;gpu.height=outputH;}
  const parent=records.find(r=>r.host.id==='dockZoomSurfaces'&&r.optics?.zone==='center');
  for(const record of records){
   const b=record.layer.getBoundingClientRect();if(!b.width||!b.height||!record.layer.clientWidth||!record.layer.clientHeight||b.bottom<0||b.top>innerHeight)continue;
   const scene=sceneFor(record.rank,records,!record.overDrawer),o=bindOptics(record,scene,record.host.classList.contains('dock-indicator')?parent:null);
   gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,o.width,o.height);gl.disable(gl.BLEND);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
   if(record.canvas.width!==o.width||record.canvas.height!==o.height){record.canvas.width=o.width;record.canvas.height=o.height;}
   record.context.clearRect(0,0,o.width,o.height);record.context.drawImage(gpu,0,gpu.height-o.height,o.width,o.height,0,0,o.width,o.height);
   record.canvas.style.visibility='visible';record.canvas.dataset.textureVersion=String(cache.serial);record.canvas.dataset.frame=String(stats.frames+1);
  }
  stats.frames++;stats.renderCostMs=performance.now()-began;document.documentElement.dataset.glassFrame=String(stats.frames);document.documentElement.dataset.glassTextureVersion=String(cache.serial);
  if(stats.frames%120===1){const code=gl.getError();if(code!==gl.NO_ERROR)report('GPU error '+code);}
 }
 function cycle(now){
  raf=0;if(document.visibilityState==='hidden'||stats.lost)return;
  if(!document.documentElement.classList.contains('vf-popup-motion'))for(const r of mirrors.values()){const backdrop=r.host.closest('.profile-drawer-backdrop,.sheet-backdrop');if(backdrop&&!backdrop.classList.contains('open'))remove(r.layer);}
  const nodes=sourceNodes();cache.sync(nodes);const records=[...mirrors.values()].filter(r=>r.layer.isConnected&&visible(r.layer)).sort((a,b)=>a.rank-b.rank||a.order-b.order);
  const motionKey=[...nodes.map(boxKey),...records.map(r=>boxKey(r.layer)),...records.map(r=>r.key)].join('|'),moving=lastMotionKey!==''&&lastMotionKey!==motionKey;lastMotionKey=motionKey;cache.pump(now,{moving});
  try{render(records);}catch(error){lastKey='';report(error.message);}if(mirrors.size)raf=requestAnimationFrame(cycle);
 }
 function schedule(){if(!raf&&active&&!stats.lost)raf=requestAnimationFrame(cycle);}
 function update(layer,host,scale=1,blurPx=0,lens=1,chromatic=null,optics=null){
  let r=mirrors.get(layer);if(!r){legacy?.remove(layer);const canvas=document.createElement('canvas');canvas.className='vf-webgl-glass';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;visibility:hidden';layer.replaceChildren(canvas);r={layer,host,canvas,context:canvas.getContext('2d')};mirrors.set(layer,r);}
  const key=JSON.stringify([scale,blurPx,lens,chromatic,optics,layer.style.maskImage,layer.style.webkitMaskImage]);if(r.key!==key){r.key=key;revision++;}
  // The Back button/dock is z52, above the drawer (z50), but below sheets.
  // It sees drawer glass/content without prematurely applying the sheet shade.
  const overDrawer=!!host.closest('.bottom-zone')&&document.body.classList.contains('drawer-open'),rank=overDrawer?2:panelRank(host);
  if(r.rank!==rank||r.overDrawer!==overDrawer)revision++;
  Object.assign(r,{host,scale:Math.max(.5,Math.min(1.5,scale)),blur:Math.max(0,blurPx),lens:Math.max(0,lens),chromatic,optics,order:host.id==='dockZoomSurfaces'?0:host.classList.contains('dock-indicator')?2:1,rank,overDrawer});
  active=true;document.documentElement.dataset.glassRenderer='webgl';schedule();
 }
 function remove(layer){if(mirrors.has(layer)){layer.replaceChildren();mirrors.delete(layer);revision++;}else legacy?.remove(layer);if(!mirrors.size&&raf){cancelAnimationFrame(raf);raf=0;}}
 function refresh(){cache.refresh();lastKey='';schedule();}
 function flush(){
  if(!active||stats.lost||document.visibilityState==='hidden')return;
  // Runtime calls flush after committing all geometry + masks. Draw in that
  // same frame; a deferred rAF would leave glass one frame behind its contour.
  cache.sync(sourceNodes());
  const records=[...mirrors.values()].filter(r=>r.layer.isConnected&&visible(r.layer)).sort((a,b)=>a.rank-b.rank||a.order-b.order);
  try{render(records);}catch(error){lastKey='';report(error.message);}schedule();
 }
 gpu.addEventListener('webglcontextlost',e=>{e.preventDefault();stats.lost=true;if(raf)cancelAnimationFrame(raf);raf=0;report('WebGL context lost');});
 gpu.addEventListener('webglcontextrestored',()=>{try{cache.destroy();scenes.clear();blurTargets.clear();panelTargets.clear();init();lastKey='';lastMotionKey='';stats.lost=false;W=H=0;schedule();}catch(error){report(error.message);}});
 addEventListener('visibilitychange',schedule);addEventListener('scroll',schedule,{capture:true,passive:true});addEventListener('resize',()=>{lastKey='';cache.refresh();schedule();});window.visualViewport?.addEventListener('resize',()=>{lastKey='';schedule();});
 legacy?.suspend?.();
 window.VFMirror={update,remove,refresh,flush,backend:'webgl',diagnostics:()=>{const d=cache.diagnostics();return {...stats,captures:d.captures,lastCaptureMs:d.lastCaptureMs,textureVersion:cache.serial,surfaces:mirrors.size,sources:d.records,cache:d,pipeline:'incremental DOM textures / GPU composition / zoom-refraction / blur / contour mask',nestedIndicator:true};}};
})();
