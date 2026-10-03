const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','webgl-glass.js'),'utf8');

// Executes scheduling/composition with simulated GL; this does not compile
// shaders on Safari or verify rendered pixels.
function node(id,classes='',box={left:0,top:0,width:400,height:100}){
 const names=new Set(classes.split(/\s+/).filter(Boolean)),events=new Map();
 const n={id,nodeType:1,tagName:'DIV',className:classes,isConnected:true,parentElement:null,children:[],style:{},dataset:{},box:{...box},
  classList:{contains:name=>names.has(name),add:name=>names.add(name),remove:name=>names.delete(name)},
  get clientWidth(){return this.box.width},get clientHeight(){return this.box.height},get offsetWidth(){return this.box.width},get offsetHeight(){return this.box.height},
  getBoundingClientRect(){return {...this.box,right:this.box.left+this.box.width,bottom:this.box.top+this.box.height}},
  matches(selector){return selector.split(',').some(s=>{s=s.trim();return s.startsWith('.')?names.has(s.slice(1)):s.startsWith('#')?id===s.slice(1):this.tagName.toLowerCase()===s})},
  closest(selector){for(let p=this;p;p=p.parentElement)if(p.matches(selector))return p;return null},
  querySelectorAll(selector){const found=[];const visit=p=>{for(const c of p.children){if(selector==='*'||c.matches(selector))found.push(c);visit(c)}};visit(this);return found},
  appendChild(child){child.parentElement=this;this.children.push(child);return child},
  replaceChildren(...children){this.children=[];children.forEach(c=>this.appendChild(c))},setAttribute(name,value){this[name]=String(value)},
  addEventListener(name,listener){events.set(name,listener)},dispatch(name,event={}){events.get(name)?.(event)},
  remove(){this.isConnected=false;if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(c=>c!==this)}};
 return n;
}

function harness({studio=true,webgl=true,cacheAvailable=true,ready=true}={}){
 let nextId=0,clock=0,currentProgram=null,currentFramebuffer=null,currentUnit=0,currentScissor=null,currentViewport=null;
 const calls=[],draws=[],copied=[],frames=new Map(),eventListeners=new Map(),programs=[],boundTextures=new Map(),canvases=[],warnings=[],attachments=new Map(),enabled=new Set();
 const gl={};for(const name of ['VERTEX_SHADER','FRAGMENT_SHADER','COMPILE_STATUS','LINK_STATUS','ARRAY_BUFFER','STATIC_DRAW','DYNAMIC_DRAW','FLOAT','TEXTURE0','TEXTURE1','TEXTURE_2D','TEXTURE_MIN_FILTER','TEXTURE_MAG_FILTER','TEXTURE_WRAP_S','TEXTURE_WRAP_T','LINEAR','CLAMP_TO_EDGE','RGBA','UNSIGNED_BYTE','FRAMEBUFFER','COLOR_ATTACHMENT0','FRAMEBUFFER_COMPLETE','MAX_TEXTURE_SIZE','BLEND','ONE','ONE_MINUS_SRC_ALPHA','COLOR_BUFFER_BIT','TRIANGLE_STRIP','SCISSOR_TEST'])gl[name]=++nextId;gl.NO_ERROR=0;
 for(const name of ['createTexture','createFramebuffer','createBuffer','createShader'])gl[name]=()=>({kind:name,id:++nextId});
 gl.createProgram=()=>{const p={id:++nextId,uniforms:{},shaders:[]};programs.push(p);return p};
 gl.attachShader=(program,shader)=>program.shaders.push(shader);gl.shaderSource=(shader,code)=>shader.source=code;
 gl.getShaderParameter=gl.getProgramParameter=()=>true;gl.getShaderInfoLog=gl.getProgramInfoLog=()=>'';gl.checkFramebufferStatus=()=>gl.FRAMEBUFFER_COMPLETE;gl.getParameter=key=>key===gl.MAX_TEXTURE_SIZE?4096:0;gl.getError=()=>0;
 gl.getUniformLocation=(program,name)=>({program,name});gl.useProgram=program=>{currentProgram=program};gl.activeTexture=unit=>{currentUnit=unit};
 gl.bindTexture=(target,texture)=>{boundTextures.set(currentUnit,texture);calls.push({name:'bindTexture',target,texture})};
 gl.bindFramebuffer=(target,fb)=>{currentFramebuffer=fb;calls.push({name:'bindFramebuffer',target,fb})};
 for(const name of ['uniform1i','uniform1f','uniform2f','uniform4f','uniform4fv'])gl[name]=(location,...values)=>{location.program.uniforms[location.name]=values.length===1&&Array.isArray(values[0])?Array.from(values[0]):values;calls.push({name,uniform:location.name,values})};
 for(const name of ['compileShader','deleteShader','deleteProgram','bindAttribLocation','linkProgram','bindBuffer','enableVertexAttribArray','vertexAttribPointer','texParameteri','texImage2D','deleteTexture','deleteFramebuffer','blendFunc','clearColor','clear'])gl[name]=(...args)=>calls.push({name,args});
 gl.framebufferTexture2D=(target,attachment,textureTarget,texture,level)=>{attachments.set(currentFramebuffer,texture);calls.push({name:'framebufferTexture2D',framebuffer:currentFramebuffer,args:[target,attachment,textureTarget,texture,level]})};
 gl.enable=value=>{enabled.add(value);calls.push({name:'enable',args:[value]})};gl.disable=value=>{enabled.delete(value);calls.push({name:'disable',args:[value]})};
 gl.scissor=(...args)=>{currentScissor=args;calls.push({name:'scissor',args})};gl.viewport=(...args)=>{currentViewport=args;calls.push({name:'viewport',args})};
 gl.bufferData=(target,data,usage)=>calls.push({name:'bufferData',target,data:Array.from(data),usage});
 gl.drawArrays=(...args)=>{
  const attachment=attachments.get(currentFramebuffer),samplers=['tex','u_tex','u_parentTex'].filter(name=>currentProgram.uniforms[name]);
  const feedback=!!attachment&&samplers.some(name=>boundTextures.get(gl.TEXTURE0+currentProgram.uniforms[name][0])===attachment);
  draws.push({program:currentProgram,framebuffer:currentFramebuffer,uniforms:Object.fromEntries(Object.entries(currentProgram.uniforms).map(([key,value])=>[key,Array.isArray(value)?value.slice():value])),textures:new Map(boundTextures),viewport:currentViewport?.slice(),scissor:enabled.has(gl.SCISSOR_TEST)?currentScissor?.slice():null,feedback,args});
 };
 const root=node('root'),body=node('body');root.tagName='HTML';body.tagName='BODY';root.appendChild(body);body.backgroundColor='rgb(5,5,5)';
 const app=node('app','app'),screen=node('home','screen active'),pageA=node('greeting','', {left:0,top:40,width:400,height:100}),pageB=node('balance','',{left:0,top:200,width:400,height:250});body.appendChild(app);app.appendChild(screen);screen.appendChild(pageA);screen.appendChild(pageB);
 const drawerBackdrop=node('drawerBackdrop','profile-drawer-backdrop'),drawer=node('drawer','profile-drawer',{left:80,top:0,width:320,height:800}),drawerContent=node('drawerContent','',{left:90,top:80,width:300,height:400});body.appendChild(drawerBackdrop);drawerBackdrop.appendChild(drawer);drawer.appendChild(drawerContent);
 const sheetBackdrop=node('sheetBackdrop','sheet-backdrop'),sheet=node('sheet','sheet',{left:0,top:200,width:400,height:600}),sheetContent=node('sheetContent','',{left:10,top:220,width:380,height:400});body.appendChild(sheetBackdrop);sheetBackdrop.appendChild(sheet);sheet.appendChild(sheetContent);
 const computed=n=>({display:n.style.display||'block',visibility:n.style.visibility||'visible',opacity:n.style.opacity??'1',backgroundColor:n.backgroundColor||'rgba(0,0,0,0)',borderTopLeftRadius:n.style.borderTopLeftRadius||'20',borderTopRightRadius:n.style.borderTopRightRadius||'20',borderBottomRightRadius:n.style.borderBottomRightRadius||'20',borderBottomLeftRadius:n.style.borderBottomLeftRadius||'20',overflow:n.style.overflow||'visible',overflowX:n.style.overflowX||n.style.overflow||'visible',overflowY:n.style.overflowY||n.style.overflow||'visible',getPropertyValue:key=>n.style[key]||'rgba(20,20,20,.2)'});
 const document={documentElement:root,body,visibilityState:'visible',querySelector(){return null},
  querySelectorAll(selector){if(selector==='body > .app .screen.active')return [screen];if(selector==='.profile-drawer,.sheet,.voice-popover')return [drawer,sheet];if(selector==='.profile-drawer-backdrop')return [drawerBackdrop];if(selector==='.sheet-backdrop')return [sheetBackdrop];if(selector==='.profile-drawer-backdrop,.sheet-backdrop')return [drawerBackdrop,sheetBackdrop];return []},
  createElement(name){assert.equal(name,'canvas');const canvas=node('canvas-'+canvases.length);canvas.width=300;canvas.height=150;canvas.tagName='CANVAS';canvas.getContext=type=>type==='webgl'?(webgl?gl:null):{clearRect(){},drawImage(...args){copied.push({canvas,args})}};canvases.push(canvas);return canvas}};
 let cache;
 class FakeCache{
  constructor(_gl,options){this.options=options;this.records=[];this.byNode=new Map();this.serial=1;this.pumps=[];this.syncs=[];this.refreshes=0;this.pending=null;cache=this}
  sync(nodes){this.syncs.push(nodes.slice());this.records=nodes.map(n=>{if(!this.byNode.has(n))this.byNode.set(n,{node:n,texture:{source:n.id},ready,version:1});return this.byNode.get(n)});return this.records}
  pump(now,{moving}){this.pumps.push({now,moving});return false}
  refresh(){this.refreshes++}destroy(){this.destroyed=true;this.records=[]}
  diagnostics(){return {captures:0,lastCaptureMs:0,records:this.records.map(r=>({element:r.node.id,ready:r.ready})),uploads:0}}
  complete(){this.records.forEach(r=>{r.ready=true});this.serial++;this.options.onDirty()}
 }
 const legacy={removed:[],suspends:0,remove(layer){this.removed.push(layer)},suspend(){this.suspends++}};
 const win={VFMirror:legacy,html2canvas(){},VFDomTextureCache:cacheAvailable?FakeCache:undefined,visualViewport:{addEventListener(){}},innerWidth:400,innerHeight:800,devicePixelRatio:1};
 const context={window:win,document,URLSearchParams,location:{search:studio?'?studio=1':''},innerWidth:400,innerHeight:800,devicePixelRatio:1,getComputedStyle:computed,performance:{now:()=>clock},console:{warn:(...v)=>warnings.push(v),error:(...v)=>warnings.push(v)},VFDomTextureCache:FakeCache,
  requestAnimationFrame(callback){const id=++nextId;frames.set(id,callback);return id},cancelAnimationFrame(id){frames.delete(id)},addEventListener(name,callback){eventListeners.set(name,callback)}};
 vm.runInNewContext(source,context,{filename:'webgl-glass.js'});
 function runFrame(time=clock+16){clock=time;const [id,callback]=frames.entries().next().value||[];assert.ok(callback,'a frame should have been scheduled');frames.delete(id);callback(time);assert.deepEqual(Array.from(win.VFMirror.diagnostics().errors),[],'renderer must not throw or report GL errors');assert.ok(draws.every(d=>!d.feedback),'framebuffer must never sample its own attached texture')}
 function surface(id,host=null,box={left:0,top:650,width:400,height:80}){host ||= node(id,id==='indicator'?'dock-indicator':'',box);if(!host.parentElement)body.appendChild(host);const layer=node(id+'-layer','',box);host.appendChild(layer);return {host,layer}}
 const optics=(width=400,height=80,zone='center')=>({zone,shapes:[[0,0,width,height,20,1]]});
 const opticalDraws=()=>draws.filter(d=>Object.hasOwn(d.uniforms,'u_world'));
 return {win,document,root,body,app,gl,legacy,warnings,calls,draws,copied,frames,canvases,screen,pageA,pageB,drawerBackdrop,drawer,drawerContent,sheetBackdrop,sheet,sheetContent,runFrame,surface,optics,opticalDraws,get cache(){return cache},dispatch:name=>eventListeners.get(name)?.(),count:name=>calls.filter(c=>c.name===name).length};
}

test('only Studio activates WebGL; missing cache or context retains the previous renderer',()=>{
 for(const options of [{studio:false},{cacheAvailable:false},{webgl:false}]){const h=harness(options);assert.equal(h.win.VFMirror,h.legacy);assert.equal(h.legacy.suspends,0);assert.equal(h.frames.size,0)}
 const h=harness();assert.equal(h.win.VFMirror.backend,'webgl');assert.equal(h.legacy.suspends,1);
});

test('renderer supplies independent DOM blocks to the asynchronous cache and waits for ready textures',()=>{
 const h=harness({ready:false}),s=h.surface('dockZoomSurfaces');h.win.VFMirror.update(s.layer,s.host,1,0,1,null,h.optics());h.runFrame();
 assert.deepEqual(Array.from(h.cache.syncs[0],n=>n.id),['greeting','balance']);assert.equal(h.cache.pumps.length,1);assert.equal(h.opticalDraws().length,0);
 h.cache.complete();h.runFrame();assert.ok(h.opticalDraws().length>0);assert.equal(h.win.VFMirror.diagnostics().sources.length,2);
});

test('native page scroll moves GPU quads without reallocating or uploading viewport screenshots',()=>{
 const h=harness(),s=h.surface('dockZoomSurfaces');h.win.VFMirror.update(s.layer,s.host,1,0,1,null,h.optics());h.runFrame();
 const initialAllocations=h.count('texImage2D'),initialDraws=h.draws.length,initialFrames=h.win.VFMirror.diagnostics().frames;
 h.pageA.box.top-=80;h.pageB.box.top-=80;h.dispatch('scroll');h.runFrame();
 assert.equal(h.count('texImage2D'),initialAllocations);assert.ok(h.draws.length>initialDraws);assert.equal(h.win.VFMirror.diagnostics().frames,initialFrames+1);assert.equal(h.cache.refreshes,0);assert.equal(h.cache.pumps.at(-1).moving,true);
 const allocations=h.calls.filter(c=>c.name==='texImage2D');assert.ok(allocations.every(call=>call.args.length===9&&call.args.at(-1)===null),'only framebuffer allocation, no canvas viewport uploads');
});

test('source and glass ordering composes page before drawer, then drawer before the sheet',()=>{
 const h=harness();h.drawerBackdrop.classList.add('open');h.sheetBackdrop.classList.add('open');
 const page=h.surface('dockZoomSurfaces'),drawerLayer=node('drawer-glass','',{left:80,top:0,width:320,height:800}),sheetLayer=node('sheet-glass','',{left:0,top:200,width:400,height:600});h.drawer.appendChild(drawerLayer);h.sheet.appendChild(sheetLayer);
 h.win.VFMirror.update(sheetLayer,h.sheet,1,0,1,null,h.optics(400,600));h.win.VFMirror.update(drawerLayer,h.drawer,1,0,1,null,h.optics(320,800));h.win.VFMirror.update(page.layer,page.host,1,0,1,null,h.optics());h.runFrame();
 const visible=h.opticalDraws().filter(d=>d.framebuffer===null);assert.deepEqual(visible.map(d=>d.uniforms.u_world),[[0,650,400,80],[80,0,320,800],[0,200,400,600]]);
 const contentCopies=h.draws.filter(d=>d.textures.get(h.gl.TEXTURE0)?.source).map(d=>d.textures.get(h.gl.TEXTURE0).source);
 assert.ok(contentCopies.includes('greeting'));assert.ok(contentCopies.includes('drawerContent'));assert.ok(contentCopies.indexOf('greeting')<contentCopies.indexOf('drawerContent'));assert.equal(h.win.VFMirror.diagnostics().scenePasses,3);
});

test('indicator receives its actual parent glass optics rather than a second offset page copy',()=>{
 const h=harness(),bar=h.surface('dockZoomSurfaces'),indicator=h.surface('indicator',null,{left:250,top:660,width:80,height:60});
 h.win.VFMirror.update(indicator.layer,indicator.host,1.15,0,.7,null,h.optics(80,60));h.win.VFMirror.update(bar.layer,bar.host,.9,0,.6,null,h.optics());h.runFrame();
 const visible=h.opticalDraws().filter(d=>d.framebuffer===null),barDraw=visible[0],indicatorDraw=visible[1];
 assert.equal(barDraw.uniforms.u_parentCount[0],0);assert.equal(indicatorDraw.uniforms.u_parentCount[0],1);assert.deepEqual(indicatorDraw.uniforms.u_parentWorld,[0,650,400,80]);assert.deepEqual(indicatorDraw.uniforms.u_parentLocal,[400,80]);assert.equal(indicatorDraw.uniforms.u_parentScale[0],.9);assert.equal(indicatorDraw.uniforms.u_parentLens[0],.6);
});

test('unchanged updates coalesce and skip rendering; a mask change invalidates the next frame',()=>{
 const h=harness(),s=h.surface('dockZoomSurfaces'),settings=h.optics();h.win.VFMirror.update(s.layer,s.host,1,0,1,null,settings);h.win.VFMirror.update(s.layer,s.host,1,0,1,null,settings);assert.equal(h.frames.size,1);h.runFrame();
 const rendered=h.win.VFMirror.diagnostics().frames;h.win.VFMirror.update(s.layer,s.host,1,0,1,null,settings);h.runFrame();assert.equal(h.win.VFMirror.diagnostics().frames,rendered);
 s.layer.style.maskImage='url(animated-contour-frame-2.svg)';h.win.VFMirror.update(s.layer,s.host,1,0,1,null,settings);h.runFrame();assert.equal(h.win.VFMirror.diagnostics().frames,rendered+1);
});

test('RGB settings invalidate rendering immediately and affect only the edge optical layer',()=>{
 const h=harness(),edge=h.surface('dockZoomSurfaces'),rgb={enabled:true,strength:3,direction:-1,centers:[{x:200,y:40,width:400,height:80}]};
 h.win.VFMirror.update(edge.layer,edge.host,1,0,1,rgb,h.optics(400,80,'edge'));h.runFrame();assert.equal(h.opticalDraws().at(-1).uniforms.u_rgbStrength[0],-3);
 const rendered=h.win.VFMirror.diagnostics().frames;h.win.VFMirror.update(edge.layer,edge.host,1,0,1,{...rgb,strength:5},h.optics(400,80,'edge'));h.runFrame();assert.equal(h.win.VFMirror.diagnostics().frames,rendered+1);assert.equal(h.opticalDraws().at(-1).uniforms.u_rgbStrength[0],-5);
 h.win.VFMirror.update(edge.layer,edge.host,1,0,1,rgb,h.optics(400,80,'center'));h.runFrame();assert.equal(h.opticalDraws().at(-1).uniforms.u_rgbStrength[0],0);
});

test('removing the final glass surface cancels scheduling without disturbing the original HTML',()=>{
 const h=harness(),s=h.surface('dockZoomSurfaces');h.win.VFMirror.update(s.layer,s.host,1,0,1,null,h.optics());h.runFrame();assert.equal(h.frames.size,1);
 h.win.VFMirror.remove(s.layer);assert.equal(h.frames.size,0);assert.equal(s.layer.children.length,0);assert.equal(h.screen.children.length,2);assert.equal(h.win.VFMirror.diagnostics().surfaces,0);
});

test('a change only to source ancestor opacity invalidates glass and updates composited HTML alpha',()=>{
 const h=harness(),bar=h.surface('dockZoomSurfaces');h.win.VFMirror.update(bar.layer,bar.host,1,0,1,null,h.optics());h.runFrame();
 const frame=h.win.VFMirror.diagnostics().frames,drawCount=h.draws.length;h.app.style.opacity='.4';h.runFrame();
 assert.equal(h.win.VFMirror.diagnostics().frames,frame+1);
 const pageCopies=h.draws.slice(drawCount).filter(d=>d.textures.get(h.gl.TEXTURE0)?.source==='greeting');
 assert.ok(pageCopies.length>0);assert.equal(pageCopies[0].uniforms.alpha[0],.4);assert.equal(h.cache.refreshes,0);
 // A host's opacity also changes the glass layer's inherited alpha even
 // though no HTML source moved, changed opacity, or received a new texture.
 const nextFrame=h.win.VFMirror.diagnostics().frames;bar.host.style.opacity='.6';h.runFrame();assert.equal(h.win.VFMirror.diagnostics().frames,nextFrame+1);
});

function popupFixture(){
 const h=harness();h.drawerBackdrop.classList.add('open');h.sheetBackdrop.classList.add('open');
 h.drawer.box={left:70,top:80,width:300,height:500};h.drawer.backgroundColor='rgba(10,40,90,.35)';Object.assign(h.drawer.style,{borderTopLeftRadius:'10px',borderTopRightRadius:'22px',borderBottomRightRadius:'0px',borderBottomLeftRadius:'7px'});
 const drawerLayer=node('drawer-optics','vf-contour-zoom-stack',{...h.drawer.box}),sheetLayer=node('sheet-optics','vf-contour-zoom-stack',{...h.sheet.box});h.drawer.appendChild(drawerLayer);h.sheet.appendChild(sheetLayer);
 h.win.VFMirror.update(drawerLayer,h.drawer,1,0,1,null,h.optics(300,500));h.win.VFMirror.update(sheetLayer,h.sheet,1,0,1,null,h.optics(400,600));
 return {h,drawerLayer,sheetLayer};
}

test('depositing popup optics uses the framebuffer pixel origin and resets it for visible surfaces',()=>{
 const {h}=popupFixture();h.runFrame();const deposited=h.opticalDraws().find(d=>d.framebuffer!==null&&d.uniforms.u_clip[0]===1);
 assert.ok(deposited);assert.deepEqual(deposited.uniforms.u_pixelOrigin,[70,220]);assert.deepEqual(deposited.viewport,[70,220,300,500]);
 const visible=h.opticalDraws().filter(d=>d.framebuffer===null);assert.ok(visible.length>=2);assert.ok(visible.every(d=>d.uniforms.u_pixelOrigin[0]===0&&d.uniforms.u_pixelOrigin[1]===0));
});

test('visible and deposited popup glass receive identical tint and asymmetric corner radii',()=>{
 const {h}=popupFixture();h.runFrame();const drawerDraws=h.opticalDraws().filter(d=>d.uniforms.u_world[0]===70&&d.uniforms.u_world[1]===80);
 const deposit=drawerDraws.find(d=>d.framebuffer!==null),visible=drawerDraws.find(d=>d.framebuffer===null);assert.ok(deposit&&visible);
 assert.deepEqual(visible.uniforms.u_tint,[10/255,40/255,90/255,.35]);assert.deepEqual(deposit.uniforms.u_tint,visible.uniforms.u_tint);
 assert.deepEqual(visible.uniforms.u_corners,[10,22,0,7]);assert.deepEqual(deposit.uniforms.u_corners,visible.uniforms.u_corners);
});

test('source quads use the intersection of ancestor overflow clips in bottom-origin scissor coordinates',()=>{
 const h=harness(),bar=h.surface('dockZoomSurfaces');h.app.box={left:50,top:0,width:300,height:800};h.app.style.overflowX='hidden';h.screen.box={left:25,top:100,width:350,height:300};h.screen.style.overflowY='auto';
 h.win.VFMirror.update(bar.layer,bar.host,1,0,1,null,h.optics());h.runFrame();const pageCopies=h.draws.filter(d=>d.textures.get(h.gl.TEXTURE0)?.source==='greeting');
 assert.ok(pageCopies.length>0);assert.deepEqual(pageCopies[0].scissor,[50,400,300,300]);
 assert.ok(h.opticalDraws().filter(d=>d.framebuffer===null).every(d=>d.scissor===null),'native source clipping must not leak to glass outputs');
});

test('dock above an open drawer sees drawer content but not the overlying sheet shade',()=>{
 const {h}=popupFixture();h.body.classList.add('drawer-open');h.sheetBackdrop.backgroundColor='rgba(200,0,0,.6)';
 const bottom=node('bottom','bottom-zone');h.body.appendChild(bottom);const dockHost=node('dockZoomSurfaces','',{left:0,top:650,width:400,height:80});bottom.appendChild(dockHost);const dock=h.surface('dockZoomSurfaces',dockHost);
 h.win.VFMirror.update(dock.layer,dock.host,1,0,1,null,h.optics());h.runFrame();
 const visible=h.opticalDraws().filter(d=>d.framebuffer===null),dockDraw=visible.find(d=>d.uniforms.u_world[1]===650),sheetDraw=visible.find(d=>d.uniforms.u_world[1]===200);
 assert.ok(dockDraw&&sheetDraw);const dockTexture=dockDraw.textures.get(h.gl.TEXTURE0),sheetTexture=sheetDraw.textures.get(h.gl.TEXTURE0);assert.notEqual(dockTexture,sheetTexture);
 // Identify the composition destination by its attached texture and inspect
 // only its own source/shade draws, not the recursively built base scenes.
 const destFor=texture=>h.draws.find(d=>d.framebuffer&&h.calls.some(c=>c.name==='framebufferTexture2D'&&c.framebuffer===d.framebuffer&&c.args[3]===texture))?.framebuffer;
 const dockFb=destFor(dockTexture),sheetFb=destFor(sheetTexture);assert.ok(dockFb&&sheetFb);
 const drawerContentDraw=h.draws.find(d=>d.textures.get(h.gl.TEXTURE0)?.source==='drawerContent');assert.ok(drawerContentDraw);
 const groupTexture=h.calls.find(c=>c.name==='framebufferTexture2D'&&c.framebuffer===drawerContentDraw.framebuffer)?.args[3];assert.ok(groupTexture);
 assert.ok(h.draws.some(d=>d.framebuffer===dockFb&&d.textures.get(h.gl.TEXTURE0)===groupTexture),'the completed drawer glass/content group is composited below the dock');
 assert.equal(h.draws.some(d=>d.framebuffer===dockFb&&d.uniforms.tint?.[0]===200/255),false);assert.equal(h.draws.some(d=>d.framebuffer===sheetFb&&d.uniforms.tint?.[0]===200/255),true);
});

test('popup opacity is applied once to the completed glass/content group, not separately to each layer',()=>{
 const {h}=popupFixture();h.drawer.style.opacity='.5';h.runFrame();
 const contentDraw=h.draws.find(d=>d.textures.get(h.gl.TEXTURE0)?.source==='drawerContent');assert.ok(contentDraw);assert.equal(contentDraw.uniforms.alpha[0],1);
 const groupTexture=h.calls.find(c=>c.name==='framebufferTexture2D'&&c.framebuffer===contentDraw.framebuffer)?.args[3];assert.ok(groupTexture);
 const glassDraw=h.opticalDraws().find(d=>d.framebuffer===contentDraw.framebuffer);assert.ok(glassDraw);assert.equal(glassDraw.uniforms.u_alpha[0],1);
 const groupComposite=h.draws.find(d=>d.framebuffer!==contentDraw.framebuffer&&d.textures.get(h.gl.TEXTURE0)===groupTexture);assert.ok(groupComposite);
 assert.equal(groupComposite.uniforms.alpha[0],.5);assert.equal(groupComposite.uniforms.clip[0],1);assert.deepEqual(groupComposite.uniforms.corners,[10,22,0,7]);
});
