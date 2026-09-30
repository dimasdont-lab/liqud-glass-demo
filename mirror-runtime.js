/* Live glass refraction. A local copy of the page is kept in viewport
   alignment; only pixels inside each glass silhouette are displaced. */
(()=>{'use strict';
const mirrors=new Map();let refreshTimer=0,frame=0,serial=0,defs;
// Never use a mirror copy as a source: copies carry the same .app/.ticker
// classes and can precede the real page in document order.
const sourceNodes=()=>[document.querySelector('body > .app'),document.querySelector('#accountTicker')].filter(node=>node&&getComputedStyle(node).display!=='none');
const svgNode=name=>document.createElementNS('http://www.w3.org/2000/svg',name);
function ensureDefs(){
 if(defs)return defs;
 const svg=svgNode('svg');svg.id='vfLiveGlassFilters';svg.setAttribute('width','0');svg.setAttribute('height','0');svg.setAttribute('aria-hidden','true');svg.style.cssText='position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
 defs=svgNode('defs');svg.append(defs);document.body.append(svg);return defs;
}
function makeFilter(record){
 if(!record.refracts)return;
 const filter=svgNode('filter');filter.id=`vf-live-refraction-${++serial}`;filter.setAttribute('x','-25%');filter.setAttribute('y','-25%');filter.setAttribute('width','150%');filter.setAttribute('height','150%');
 const noise=svgNode('feTurbulence');noise.setAttribute('type','fractalNoise');noise.setAttribute('baseFrequency','.035 .055');noise.setAttribute('numOctaves','2');noise.setAttribute('seed','7');noise.setAttribute('result','noise');
 const vector=svgNode('feColorMatrix');vector.setAttribute('in','noise');vector.setAttribute('type','matrix');vector.setAttribute('result','vector');
 const displace=svgNode('feDisplacementMap');displace.setAttribute('in','SourceGraphic');displace.setAttribute('in2','vector');displace.setAttribute('scale','12');displace.setAttribute('xChannelSelector','R');displace.setAttribute('yChannelSelector','G');
 filter.append(noise,vector,displace);ensureDefs().append(filter);record.filter=filter;record.vector=vector;record.displace=displace;
 record.content.style.filter=`url(#${filter.id})`;
}
function setDirection(record,angle){
 if(!record.vector||record.angle===angle)return;
 record.angle=angle;
 const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 record.vector.setAttribute('values',`${c} ${-s} 0 0 ${(1-c+s)/2}  ${s} ${c} 0 0 ${(1-s-c)/2}  0 0 1 0 0  0 0 0 1 0`);
}
function copySource(source){
 const copy=source.cloneNode(true);copy.removeAttribute('id');copy.setAttribute('aria-hidden','true');copy.inert=true;
 if(source.classList.contains('app'))copy.querySelectorAll('.screen:not(.active)').forEach(node=>node.remove());
 copy.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
 copy.querySelectorAll('input,button,select,textarea,a').forEach(node=>{node.tabIndex=-1});
 copy.classList.add('vf-mirror-copy');return copy;
}
function populate(record){
 const scene=document.createDocumentFragment();record.copies=[];
 for(const source of sourceNodes()){const copy=copySource(source);record.copies.push({source,copy});scene.append(copy)}
 record.content.replaceChildren(scene);
}
function rebuild(){
 refreshTimer=0;
 for(const record of mirrors.values()){
  if(!record.layer.isConnected){remove(record.layer);continue}
  populate(record);
 }
 scheduleFrame();
}
function scheduleRefresh(){if(refreshTimer)return;refreshTimer=setTimeout(rebuild,180)}
function mount(layer,host){
 let record=mirrors.get(layer);if(record)return record;
 const content=document.createElement('span');content.className='vf-mirror-content';
 record={layer,host,content,copies:[],refracts:layer.classList.contains('vf-edge-reflection')||layer.id==='dockMirrorSurface',angle:null,scale:1};
 layer.replaceChildren(content);mirrors.set(layer,record);makeFilter(record);populate(record);scheduleFrame();return record;
}
function align(){
 if(!mirrors.size)return;
 const boxes=new Map();for(const source of sourceNodes())boxes.set(source,source.getBoundingClientRect());
 for(const record of mirrors.values()){
  if(!record.layer.isConnected||getComputedStyle(record.layer).display==='none')continue;
  const hostRect=record.host.getBoundingClientRect();if(!hostRect.width||!hostRect.height)continue;
  for(const {source,copy} of record.copies){
   const box=boxes.get(source);if(!box)continue;
   const x=box.left-hostRect.left,y=box.top-hostRect.top;
   const left=`${x}px`,top=`${y}px`,width=`${source.offsetWidth}px`,height=`${source.offsetHeight}px`;
   if(copy.style.left!==left)copy.style.left=left;
   if(copy.style.top!==top)copy.style.top=top;
   if(copy.style.width!==width)copy.style.width=width;
   if(copy.style.height!==height)copy.style.height=height;
   // Zoom uses the same live source, but refraction never rotates the scene.
   const transform=record.scale===1?'none':`scale(${record.scale})`;
   if(copy.style.transform!==transform)copy.style.transform=transform;
   if(record.scale!==1)copy.style.transformOrigin=`${hostRect.width/2-x}px ${hostRect.height/2-y}px`;
   if(source.classList.contains('account-ticker')){
    const track=copy.querySelector('.ticker-track'),original=source.querySelector('.ticker-track');
    if(track&&original){const animated=getComputedStyle(original).transform;if(track.style.transform!==animated)track.style.transform=animated}
   }
  }
 }
}
function positionAll(){frame=0;align();if(mirrors.size)frame=requestAnimationFrame(positionAll)}
function scheduleFrame(){if(!frame&&mirrors.size)frame=requestAnimationFrame(positionAll)}
function update(layer,host,angle=180,scale=1,strength=.5){const record=mount(layer,host);record.host=host;record.scale=scale;setDirection(record,angle);if(record.displace)record.displace.setAttribute('scale',String(12+16*strength));scheduleFrame()}
function remove(layer){const record=mirrors.get(layer);if(!record)return;record.layer.replaceChildren();record.filter?.remove();mirrors.delete(layer);if(!mirrors.size&&frame){cancelAnimationFrame(frame);frame=0}}
function releaseClosed(){
 for(const record of mirrors.values()){
  const sheet=record.host.closest('.sheet-backdrop'),drawer=record.host.closest('.profile-drawer-backdrop');
  if((sheet&&!sheet.classList.contains('open'))||(drawer&&!drawer.classList.contains('open')))remove(record.layer);
 }
}
function observe(){
 for(const source of sourceNodes()){
  const observer=new MutationObserver(scheduleRefresh);
  try{observer.observe(source,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','hidden','value','d','points']})}
  catch(error){console.warn('Glass source observer unavailable:',source.localName,error)}
 }
 for(const backdrop of document.querySelectorAll('.sheet-backdrop,.profile-drawer-backdrop')){
  try{new MutationObserver(()=>setTimeout(releaseClosed,600)).observe(backdrop,{attributes:true,attributeFilter:['class']})}
  catch(error){console.warn('Glass panel observer unavailable:',error)}
 }
 // Hidden/background tabs throttle animation frames, but not scroll events.
 // Align immediately for wheel/touch scrolling and also at frame cadence
 // while fixed panels animate in the foreground.
 addEventListener('scroll',align,{passive:true,capture:true});
 addEventListener('resize',align,{passive:true});
 window.visualViewport?.addEventListener('scroll',align,{passive:true});
 window.visualViewport?.addEventListener('resize',align,{passive:true});
}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',observe,{once:true});else observe();
window.VFMirror={update,remove,refresh:scheduleRefresh};
})();
