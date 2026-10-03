const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','dom-texture-cache.js'),'utf8');

function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}}

function makeNode(id,width=320,height=180){
 const listeners=new Map(),attributes=new Map();
 const node={id,nodeType:1,tagName:'SECTION',offsetWidth:width,offsetHeight:height,scrollHeight:height,isConnected:true,children:[],style:{},className:'card',
  classList:{contains(){return false}},getBoundingClientRect(){return {left:0,top:0,width:this.offsetWidth,height:this.offsetHeight,bottom:this.offsetHeight}},
  addEventListener(name,callback){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(callback)},
  removeEventListener(name,callback){listeners.get(name)?.delete(callback)},
  dispatch(name){for(const callback of listeners.get(name)||[])callback({target:node,type:name})},
  getAttribute(name){return name==='style'?Object.entries(this.style).map(([property,value])=>property+':'+value).join(';'):attributes.get(name)??null},setAttribute(name,value){attributes.set(name,String(value))},
  querySelector(){return null},querySelectorAll(){return []},matches(){return false},closest(){return null},contains(other){return other===node},
  cloneNode(){return makeNode(id+'-snapshot',this.offsetWidth,this.offsetHeight)}};
 return node;
}

function createHarness({capture,textureLimit=4096}={}){
 let clock=1000,textureSerial=0;
 const calls=[],captures=[],observers=[],resizers=[],errors=[],snapshots=[],cleanups=[];
 const gl={TEXTURE_2D:3553,TEXTURE_MIN_FILTER:10241,TEXTURE_MAG_FILTER:10240,TEXTURE_WRAP_S:10242,TEXTURE_WRAP_T:10243,
  LINEAR:9729,CLAMP_TO_EDGE:33071,RGBA:6408,UNSIGNED_BYTE:5121,MAX_TEXTURE_SIZE:3379,UNPACK_FLIP_Y_WEBGL:37440,
  createTexture(){const texture={id:++textureSerial};calls.push({name:'createTexture',args:[texture]});return texture},
  getParameter(name){return name===this.MAX_TEXTURE_SIZE?textureLimit:0}};
 for(const name of ['bindTexture','texParameteri','texImage2D','texSubImage2D','pixelStorei','deleteTexture'])gl[name]=(...args)=>calls.push({name,args});
 class Observer{
  constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this)}
  observe(node,options){this.node=node;this.options=options}
  disconnect(){this.disconnected=true}
  takeRecords(){return []}
  emit(records){if(this.disconnected)return;const matched=records.filter(record=>record.type!=='attributes'||!this.options.attributeFilter||this.options.attributeFilter.includes(record.attributeName));if(matched.length)this.callback(matched)}
 }
 class ResizeObserver{
  constructor(callback){this.callback=callback;this.disconnected=false;resizers.push(this)}
  observe(node){this.node=node}disconnect(){this.disconnected=true}emit(){if(!this.disconnected)this.callback([{target:this.node}])}
 }
 const computed=node=>({display:'block',visibility:'visible',opacity:'1',position:'static',transform:node.style.transform||'none',translate:'none',scale:'none',overflow:'visible',overflowX:'visible',overflowY:'visible',getPropertyValue(){return ''}});
 const window={devicePixelRatio:2,MutationObserver:Observer,ResizeObserver,performance:{now:()=>clock},getComputedStyle:computed};
 const context={window,document:{fonts:{ready:Promise.resolve()},createElement(name){assert.equal(name,'canvas');return {width:0,height:0,getContext(){return {drawImage(){}}}}}},MutationObserver:Observer,ResizeObserver,performance:window.performance,
  getComputedStyle:computed,devicePixelRatio:2,console,Map,Set,WeakMap,Promise,Math,Number,Date,setTimeout,clearTimeout};
 vm.runInNewContext(source,context,{filename:'dom-texture-cache.js'});
 const cache=new window.VFDomTextureCache(gl,{
  onDirty(){},onError(error){errors.push(error)},
  snapshot(node,record){snapshots.push(node);return {node:node.cloneNode(true),cleanup(){cleanups.push(record)}}},
  capture(node,options){captures.push({node,options});return capture?capture(node,options,captures.length):Promise.resolve({width:Math.max(1,Math.round(options.width*options.scale)),height:Math.max(1,Math.round(options.height*options.scale))})}
 });
 const invoke=(now,moving=false)=>{clock=now;return cache.pump(now,{moving})};
 const finish=async()=>{if(cache.pending)await cache.pending;await Promise.resolve()};
 const count=name=>calls.filter(call=>call.name===name).length;
 const mutate=(node,type='characterData',attributeName)=>observers.filter(observer=>observer.node===node).forEach(observer=>observer.emit([{type,target:node,attributeName}]));
 return {cache,gl,window,calls,captures,observers,resizers,errors,snapshots,cleanups,invoke,finish,count,mutate,setClock(now){clock=now}};
}

test('same-size DOM changes upload a single block with texSubImage2D without reallocating its texture',async()=>{
 const h=createHarness(),node=makeNode('balance');h.cache.sync([node]);
 assert.equal(h.invoke(1000),true);await h.finish();
 assert.equal(h.cache.byNode.get(node).ready,true);assert.equal(h.count('texImage2D'),1);assert.equal(h.count('texSubImage2D'),1);
 const initialVersion=h.cache.byNode.get(node).version;
 h.mutate(node);assert.equal(h.invoke(2000),true);await h.finish();
 assert.equal(h.cache.byNode.get(node).version,initialVersion+1);assert.equal(h.count('texImage2D'),1);assert.equal(h.count('texSubImage2D'),2);
 assert.equal(h.cache.diagnostics().uploads,2);h.cache.destroy();
});

test('mutations received during an asynchronous capture are not discarded when that capture resolves',async()=>{
 const waiting=deferred(),h=createHarness({capture:(_node,options,attempt)=>attempt===1?waiting.promise:Promise.resolve({width:320,height:180})}),node=makeNode('history');
 h.cache.sync([node]);assert.equal(h.invoke(1000),true);
 h.mutate(node);const revisionAfterMutation=h.cache.byNode.get(node).revision;
 waiting.resolve({width:320,height:180});await h.finish();
 const record=h.cache.byNode.get(node);assert.equal(record.revision,revisionAfterMutation);assert.equal(record.dirty,true);assert.ok(record.capturedRevision<record.revision);
 assert.equal(h.invoke(2000),true);await h.finish();assert.equal(record.dirty,false);assert.equal(record.capturedRevision,record.revision);assert.equal(h.captures.length,2);h.cache.destroy();
});

test('an update to one DOM block does not screenshot its clean sibling',async()=>{
 const h=createHarness(),a=makeNode('greeting'),b=makeNode('transactions');h.cache.sync([a,b]);
 h.invoke(1000);await h.finish();h.invoke(2000);await h.finish();assert.equal(h.captures.length,2);
 const cleanVersion=h.cache.byNode.get(a).version;h.mutate(b);h.invoke(3000);await h.finish();
 assert.equal(h.captures.length,3);assert.equal(h.cache.byNode.get(a).version,cleanVersion);assert.equal(h.snapshots.at(-1),b);h.cache.destroy();
});

test('an input event marks its own live HTML block dirty without forcing a whole-scene capture',async()=>{
 const h=createHarness(),a=makeNode('input-form'),b=makeNode('unrelated');h.cache.sync([a,b]);h.invoke(1000);await h.finish();h.invoke(2000);await h.finish();
 a.dispatch('input');assert.equal(h.cache.byNode.get(a).dirty,true);assert.equal(h.cache.byNode.get(b).dirty,false);
 h.invoke(3000);await h.finish();assert.equal(h.captures.length,3);assert.equal(h.snapshots.at(-1),a);h.cache.destroy();
});

test('scrolling and a CSS transform do not trigger an otherwise-clean DOM capture',async()=>{
 const h=createHarness(),node=makeNode('page-block');h.cache.sync([node]);h.invoke(1000);await h.finish();
 const before=h.captures.length;h.window.scrollY=200;node.getBoundingClientRect=()=>({left:-90,top:-200,width:256,height:144,bottom:-56});node.style.transform='translate3d(-90px,-200px,0) scale(.8)';h.mutate(node,'attributes','style');h.cache.sync([node]);
 for(const time of [2000,3000,5000]){h.invoke(time);await h.finish()}
 assert.equal(h.captures.length,before);assert.equal(h.cache.byNode.get(node).dirty,false);h.cache.destroy();
});

test('scrolling inside a cached panel invalidates that panel and waits until its gesture settles',async()=>{
 const h=createHarness(),node=makeNode('scrollable-panel');h.cache.sync([node]);h.invoke(1000);await h.finish();h.setClock(2000);node.dispatch('scroll');
 assert.equal(h.cache.byNode.get(node).dirty,true);assert.equal(h.invoke(2040),false);assert.equal(h.invoke(2300),true);await h.finish();assert.equal(h.captures.length,2);h.cache.destroy();
});

test('ready dirty blocks defer capture during motion, then refresh after a short idle period',async()=>{
 const h=createHarness(),node=makeNode('animated-panel');h.cache.sync([node]);h.invoke(1000);await h.finish();h.cache.refresh(node);
 assert.equal(h.invoke(2000,true),false);assert.equal(h.invoke(2040),false);assert.equal(h.captures.length,1);
 assert.equal(h.invoke(2300),true);await h.finish();assert.equal(h.captures.length,2);h.cache.destroy();
});

test('a source with no texture may bootstrap during motion so opening panels are never blank',async()=>{
 const h=createHarness(),node=makeNode('new-panel');h.cache.sync([node]);assert.equal(h.invoke(1000,true),true);await h.finish();
 assert.equal(h.cache.byNode.get(node).ready,true);assert.equal(h.captures.length,1);h.cache.destroy();
});

test('capture errors keep the record dirty and back off before a later successful retry',async()=>{
 const h=createHarness({capture:(_node,_options,attempt)=>attempt===1?Promise.reject(new Error('capture failed')):Promise.resolve({width:320,height:180})}),node=makeNode('retry-card');
 h.cache.sync([node]);h.invoke(1000);await h.finish();assert.equal(h.cache.byNode.get(node).dirty,true);assert.equal(h.cache.byNode.get(node).ready,false);
 assert.equal(h.errors.length,1);assert.equal(h.invoke(1001),false);assert.equal(h.captures.length,1);
 assert.equal(h.invoke(10000),true);await h.finish();assert.equal(h.cache.byNode.get(node).ready,true);assert.equal(h.cache.byNode.get(node).dirty,false);h.cache.destroy();
});

test('canvas capture respects the GPU texture limit for both very wide and very tall sources',async()=>{
 const h=createHarness({textureLimit:2048}),wide=makeNode('wide',8000,180),tall=makeNode('tall',400,9000);h.cache.sync([wide,tall]);
 h.invoke(1000);await h.finish();h.invoke(2000);await h.finish();
 for(const {options} of h.captures){assert.ok(Math.round(options.width*options.scale)<=2048);assert.ok(Math.round(options.height*options.scale)<=2048);assert.ok(options.scale>0)}
 assert.equal(h.captures.length,2);assert.ok(h.cache.diagnostics().textureBytes<=2*2048*2048*4);h.cache.destroy();
});

test('a genuine source resize reallocates storage while preserving the same logical block',async()=>{
 const h=createHarness(),node=makeNode('resize');h.cache.sync([node]);h.invoke(1000);await h.finish();const record=h.cache.byNode.get(node);
 node.offsetWidth=420;node.offsetHeight=260;node.scrollHeight=260;h.resizers.find(observer=>observer.node===node).emit();h.cache.sync([node]);
 h.invoke(2000);await h.finish();assert.equal(h.cache.byNode.get(node),record);assert.equal(record.width,420);assert.equal(record.height,260);assert.equal(h.count('texImage2D'),2);h.cache.destroy();
});

test('a pending screenshot at obsolete dimensions is not uploaded after its source resizes',async()=>{
 const waiting=deferred(),h=createHarness({capture:(_node,options,attempt)=>attempt===1?waiting.promise:Promise.resolve({width:Math.round(options.width*options.scale),height:Math.round(options.height*options.scale)})}),node=makeNode('resize-race');
 h.cache.sync([node]);h.invoke(1000);node.offsetWidth=500;node.offsetHeight=200;h.cache.sync([node]);
 waiting.resolve({width:320,height:180});await h.finish();assert.equal(h.count('texSubImage2D'),0);assert.equal(h.cache.byNode.get(node).dirty,true);
 h.invoke(2000);await h.finish();assert.equal(h.count('texSubImage2D'),1);assert.equal(h.cache.byNode.get(node).width,500);h.cache.destroy();
});

test('removing a block disconnects observers and releases its GPU texture',async()=>{
 const h=createHarness(),a=makeNode('keep'),b=makeNode('remove');h.cache.sync([a,b]);h.invoke(1000);await h.finish();h.invoke(2000);await h.finish();
 const removedTexture=h.cache.byNode.get(b).texture;h.cache.sync([a]);
 assert.equal(h.cache.byNode.has(b),false);assert.equal(h.cache.records.length,1);assert.ok(h.calls.some(call=>call.name==='deleteTexture'&&call.args[0]===removedTexture));
 assert.ok(h.observers.filter(observer=>observer.node===b).every(observer=>observer.disconnected));assert.ok(h.resizers.filter(observer=>observer.node===b).every(observer=>observer.disconnected));h.cache.destroy();
});

test('destroying the cache during a pending capture prevents late uploads and cleans snapshot resources',async()=>{
 const waiting=deferred(),h=createHarness({capture:()=>waiting.promise}),node=makeNode('closing');h.cache.sync([node]);h.invoke(1000);
 const pending=h.cache.pending;h.cache.destroy();waiting.resolve({width:320,height:180});await pending;await Promise.resolve();
 assert.equal(h.count('texSubImage2D'),0);assert.equal(h.cache.records.length,0);assert.equal(h.cache.byNode.size,0);assert.equal(h.cleanups.length,1);
 assert.ok(h.observers.every(observer=>observer.disconnected));assert.ok(h.resizers.every(observer=>observer.disconnected));assert.equal(h.invoke(5000),false);
});
