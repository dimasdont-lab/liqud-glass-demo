/* Live, non-interactive copy of the page behind a glass edge. The copy is
   rotated around each glass object's own centre, then clipped by its rim. */
(()=>{'use strict';
const mirrors=new Map();let refreshQueued=false;
const sources=()=>[document.querySelector('.app'),document.querySelector('.account-ticker')].filter(node=>node&&getComputedStyle(node).display!=='none');
function copySource(source){
 const copy=source.cloneNode(true);
 copy.removeAttribute('id');copy.setAttribute('aria-hidden','true');copy.inert=true;
 // Hidden routes cannot contribute pixels to the current reflection. Keeping
 // only the visible route avoids cloning the entire finance app for each rim.
 if(source.classList.contains('app'))copy.querySelectorAll('.screen:not(.active)').forEach(node=>node.remove());
 copy.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
 copy.querySelectorAll('input,button,select,textarea,a').forEach(node=>{node.tabIndex=-1});
 copy.classList.add('vf-mirror-copy');
 return copy;
}
function rebuild(){
 refreshQueued=false;
 for(const record of mirrors.values()){
  if(!record.layer.isConnected){mirrors.delete(record.layer);continue}
  const scene=document.createDocumentFragment();record.copies=[];
  for(const source of sources()){const copy=copySource(source);record.copies.push({source,copy});scene.append(copy)}
  record.layer.replaceChildren(scene);position(record);
 }
}
function scheduleRefresh(){if(refreshQueued)return;refreshQueued=true;setTimeout(rebuild,90)}
function releaseClosed(){
 for(const record of mirrors.values()){
  const sheet=record.host.closest('.sheet-backdrop');
  const drawer=record.host.closest('.profile-drawer-backdrop');
  if((sheet&&!sheet.classList.contains('open'))||(drawer&&!drawer.classList.contains('open'))){record.layer.replaceChildren();mirrors.delete(record.layer)}
 }
}
function position(record){
 if(!record.layer.isConnected)return;
 const hostRect=record.host.getBoundingClientRect();if(!hostRect.width||!hostRect.height)return;
 for(const {source,copy} of record.copies){
  const box=source.getBoundingClientRect(),x=box.left-hostRect.left,y=box.top-hostRect.top;
  copy.style.left=`${x}px`;copy.style.top=`${y}px`;
  copy.style.width=`${source.offsetWidth}px`;copy.style.height=`${source.offsetHeight}px`;
  copy.style.transformOrigin=`${hostRect.width/2-x}px ${hostRect.height/2-y}px`;
  copy.style.transform=`rotate(${record.angle??180}deg) scale(${record.scale??1})`;
  if(source.classList.contains('account-ticker')){
   const track=copy.querySelector('.ticker-track'),original=source.querySelector('.ticker-track');
   if(track&&original)track.style.transform=getComputedStyle(original).transform;
  }
 }
}
function mount(layer,host){
 let record=mirrors.get(layer);if(record)return record;
 record={layer,host,copies:[]};mirrors.set(layer,record);
 const scene=document.createDocumentFragment();for(const source of sources()){const copy=copySource(source);record.copies.push({source,copy});scene.append(copy)}
 layer.replaceChildren(scene);return record;
}
function update(layer,host,angle=180,scale=1){const record=mount(layer,host);record.angle=angle;record.scale=scale;position(record)}
function remove(layer){const record=mirrors.get(layer);if(!record)return;layer.replaceChildren();mirrors.delete(layer)}
function observe(){
 for(const source of sources()){
  const observer=new MutationObserver(scheduleRefresh);
  if(source?.nodeType!==1)continue;
  try{observer.observe(source,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','hidden','value','d','points']})}
  catch(error){console.warn('Mirror source observer unavailable:',source.localName,error)}
 }
 addEventListener('scroll',()=>{for(const record of mirrors.values())position(record)},{passive:true});
 addEventListener('resize',()=>{for(const record of mirrors.values())position(record)},{passive:true});
 for(const backdrop of document.querySelectorAll('.sheet-backdrop,.profile-drawer-backdrop')){
  const observer=new MutationObserver(()=>setTimeout(releaseClosed,600));
  if(backdrop?.nodeType!==1)continue;
  try{observer.observe(backdrop,{attributes:true,attributeFilter:['class']})}
  catch(error){console.warn('Mirror backdrop observer unavailable:',error)}
 }
}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',observe,{once:true});else observe();
window.VFMirror={update,remove,refresh:scheduleRefresh};
})();
