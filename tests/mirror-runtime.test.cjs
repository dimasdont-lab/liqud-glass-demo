const {test}=require('node:test');
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(){
 let clones=0;const timers=[];
 class Element{
  constructor(){this.style={};this.dataset={};this.children=[];this.isConnected=true;this.clientWidth=this.offsetWidth=300;this.clientHeight=this.offsetHeight=60;this.classes=new Set();this.classList={contains:n=>this.classes.has(n),add:n=>this.classes.add(n),toggle:(n,on)=>on?this.classes.add(n):this.classes.delete(n)};this.box={left:0,top:0,width:300,height:60}}
  append(...children){this.children.push(...children)}
  replaceChildren(...children){this.children=children.flatMap(c=>c.fragment?c.children:[c])}
  setAttribute(key,value){(this.attributes??={})[key]=String(value)} remove(){} removeAttribute(){} querySelectorAll(){return []} querySelector(){return null} closest(){return null}
  getContext(){return {createImageData:()=>({data:new Uint8ClampedArray(256*256*4)}),putImageData(){}}} toDataURL(){return 'data:image/png;base64,test'}
  cloneNode(){clones++;const copy=new Element();copy.classes=new Set(this.classes);return copy}
  getBoundingClientRect(){return this.box}
 }
 const source=new Element();source.classes.add('app');source.offsetWidth=400;source.offsetHeight=800;source.box={left:10,top:-100,width:360,height:720};
 const body=new Element(),context={console,window:{},document:{readyState:'loading',body,querySelector:s=>s==='body > .app'?source:null,createElement:()=>new Element(),createElementNS:()=>new Element(),createDocumentFragment:()=>Object.assign(new Element(),{fragment:true})},getComputedStyle:()=>({display:'block'}),requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout:fn=>{timers.push(fn);return timers.length},addEventListener(){}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('mirror-runtime.js','utf8'),context);
 return {api:context.window.VFMirror,Element,timers,body,get clones(){return clones}};
}
test('RGB updates synchronously without replacing channels through 300 morph frames',()=>{
 const f=fixture(),layer=new f.Element(),host=new f.Element();
 const config={enabled:true,strength:6,direction:1,centers:[{x:50,y:30,width:60,height:60},{x:240,y:30,width:100,height:60}]};
 f.api.update(layer,host,.9,4,1,config);
 const content=layer.children[0],region=content.children[0],red=region.children[0],green=region.children[1],blue=region.children[2],clones=f.clones;
 assert.match(red.style.filter,/^blur\(4.00px\).*url\(#vf-radial-/);
 assert.equal(green.style.transform,'none');
 assert.equal(red.style.transform,'none');assert.equal(blue.style.transform,'none');
 const displacement=f.body.children[0].children[0].children[1];assert.equal(displacement.attributes.scale,'-12');
 for(let i=0;i<300;i++){config.centers[0].x=50+i/10;host.clientWidth=300+i/10;f.api.update(layer,host,.9,4,1,config)}
 assert.equal(content.children[0],region);assert.equal(region.children[0],red);assert.equal(f.clones,clones);
 assert.equal(displacement.attributes.scale,'-12','pixel displacement is independent of capsule size');
 config.direction=-1;f.api.update(layer,host,.9,4,1,config);assert.equal(displacement.attributes.scale,'12');
 f.api.refresh();f.timers.shift()();
 assert.match(layer.children[0].children[0].children[0].style.filter,/vf-radial-/,'source refresh reapplies filters before paint');
 config.enabled=false;f.api.update(layer,host,.9,4,1,config);
 assert.equal(layer.children[0].children.length,1);assert.match(layer.children[0].style.filter,/blur\(4.00px\)/);
 f.api.remove(layer);assert.equal(layer.children.length,0);
});
test('mirrors retain page layout dimensions and compose source scale before glass zoom',()=>{
 const f=fixture(),layer=new f.Element(),host=new f.Element();f.api.update(layer,host,.8,3,1,null);f.api.flush();
 const copy=layer.children[0].children[0];
 assert.equal(copy.style.width,'400px');assert.equal(copy.style.height,'800px');
 assert.match(copy.style.transform,/scale\(0.72[0-9]*,0.72[0-9]*\)/);
 assert.equal(copy.style.transformOrigin,'0 0');
});
