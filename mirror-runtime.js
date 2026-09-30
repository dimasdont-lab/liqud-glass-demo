/* Live page copy for glass zoom. Blur is applied to this copy after scaling,
   so it samples the zoomed image rather than the unmodified backdrop. */
(()=>{'use strict';
const mirrors=new Map();let refreshTimer=0,frame=0;
// Never use a mirror copy as a source: copies carry the same .app/.ticker
// classes and can precede the real page in document order.
const sourceNodes=()=>[document.querySelector('body > .app'),document.querySelector('#accountTicker')].filter(node=>node&&getComputedStyle(node).display!=='none');
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
 record={layer,host,content,copies:[],scale:1,blur:0};
 layer.replaceChildren(content);mirrors.set(layer,record);populate(record);scheduleFrame();return record;
}
function align(){
 if(!mirrors.size)return;
 const boxes=new Map();for(const source of sourceNodes())boxes.set(source,source.getBoundingClientRect());
 for(const record of mirrors.values()){
  if(!record.layer.isConnected||getComputedStyle(record.layer).display==='none')continue;
  const hostRect=record.host.getBoundingClientRect();if(!hostRect.width||!hostRect.height)continue;
  const contentRect=record.content.getBoundingClientRect();
  // Morphing entry pills can scale their whole subtree. Viewport distances
  // must be converted back to that subtree's local CSS pixels before placing
  // the mirrored page; otherwise it visibly slips during a transition.
  const localX=contentRect.width/Math.max(1,record.content.offsetWidth),localY=contentRect.height/Math.max(1,record.content.offsetHeight);
  for(const {source,copy} of record.copies){
   const box=boxes.get(source);if(!box)continue;
   const x=(box.left-contentRect.left)/localX,y=(box.top-contentRect.top)/localY;
   const left=`${x}px`,top=`${y}px`,width=`${box.width/localX}px`,height=`${box.height/localY}px`;
   if(copy.style.left!==left)copy.style.left=left;
   if(copy.style.top!==top)copy.style.top=top;
   if(copy.style.width!==width)copy.style.width=width;
   if(copy.style.height!==height)copy.style.height=height;
   const transform=record.scale===1?'none':`scale(${record.scale})`;
   if(copy.style.transform!==transform)copy.style.transform=transform;
   if(record.scale!==1)copy.style.transformOrigin=`${(hostRect.left+hostRect.width/2-contentRect.left)/localX-x}px ${(hostRect.top+hostRect.height/2-contentRect.top)/localY-y}px`;
   if(source.classList.contains('account-ticker')){
    const track=copy.querySelector('.ticker-track'),original=source.querySelector('.ticker-track');
    if(track&&original){const animated=getComputedStyle(original).transform;if(track.style.transform!==animated)track.style.transform=animated}
   }
  }
 }
}
function positionAll(){frame=0;align();if(mirrors.size)frame=requestAnimationFrame(positionAll)}
function scheduleFrame(){if(!frame&&mirrors.size)frame=requestAnimationFrame(positionAll)}
function update(layer,host,scale=1,blur=0){const record=mount(layer,host);record.host=host;record.scale=scale;record.blur=blur;const overscan=Math.min(96,Math.max(24,Math.ceil(blur*2)));record.content.style.inset=`-${overscan}px`;record.content.style.filter=blur>0?`blur(${blur.toFixed(2)}px)`:'none';scheduleFrame()}
function remove(layer){const record=mirrors.get(layer);if(!record)return;record.layer.replaceChildren();mirrors.delete(layer);if(!mirrors.size&&frame){cancelAnimationFrame(frame);frame=0}}
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
