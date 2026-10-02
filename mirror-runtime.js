/* Live page copy for glass zoom. Blur is applied to this copy after scaling,
   so it samples the zoomed image rather than the unmodified backdrop. */
(()=>{'use strict';
const mirrors=new Map();let refreshTimer=0,frame=0,filterId=0;
const SVG='http://www.w3.org/2000/svg';
function channelFilter(record,config){
 if(!config?.enabled||!config.strength)return '';
 const w=record.host.clientWidth,h=record.host.clientHeight,pad=record.overscan,cw=w+2*pad,ch=h+2*pad;
 if(!w||!h)return '';
 if(!record.rgb){
  const root=document.createElementNS(SVG,'svg');root.setAttribute('aria-hidden','true');root.style.cssText='position:absolute;width:0;height:0;pointer-events:none;overflow:hidden';
  const id=`vf-rgb-${++filterId}`;root.innerHTML=`<defs><filter id="${id}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feImage result="field" preserveAspectRatio="none"/><feDisplacementMap in="SourceGraphic" in2="field" xChannelSelector="R" yChannelSelector="G" result="redShift"/><feDisplacementMap in="SourceGraphic" in2="field" xChannelSelector="R" yChannelSelector="G" result="blueShift"/><feColorMatrix in="redShift" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red"/><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green"/><feColorMatrix in="blueShift" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue"/><feComposite in="red" in2="green" operator="arithmetic" k2="1" k3="1" result="rg"/><feComposite in="rg" in2="blue" operator="arithmetic" k2="1" k3="1"/></filter></defs>`;
  document.body.append(root);record.rgb={root,id,filter:root.querySelector('filter'),image:root.querySelector('feImage'),maps:[...root.querySelectorAll('feDisplacementMap')]};
 }
 const rgb=record.rgb,points=config.centers||[{x:w/2,y:h/2}],key=JSON.stringify([w,h,pad,points]);
 if(rgb.key!==key){
  rgb.key=key;const canvas=document.createElement('canvas');canvas.width=canvas.height=48;const ctx=canvas.getContext('2d'),data=ctx.createImageData(48,48);
  for(let y=0;y<48;y++)for(let x=0;x<48;x++){
   const px=(x+.5)/48*cw-pad,py=(y+.5)/48*ch-pad;
   const center=points.reduce((best,p)=>Math.hypot(px-p.x,py-p.y)<Math.hypot(px-best.x,py-best.y)?p:best,points[0]);
   const dx=px-center.x,dy=py-center.y,length=Math.max(1,Math.hypot(dx,dy)),i=(y*48+x)*4;
   data.data[i]=Math.round(127.5+127.5*dx/length);data.data[i+1]=Math.round(127.5+127.5*dy/length);data.data[i+2]=128;data.data[i+3]=255;
  }
  ctx.putImageData(data,0,0);const href=canvas.toDataURL(),decoder=new Image();
  // Keep the previous valid field until the replacement is decoded. An empty
  // feImage during a morph would shift the entire edge and visibly blink.
  decoder.onload=()=>{if(rgb.key!==key||!record.layer.isConnected||mirrors.get(record.layer)!==record)return;rgb.image.setAttribute('href',href);rgb.image.setAttributeNS('http://www.w3.org/1999/xlink','href',href);for(const el of [rgb.filter,rgb.image]){el.setAttribute('x','0');el.setAttribute('y','0');el.setAttribute('width',cw);el.setAttribute('height',ch)}rgb.ready=true;if(record.options)update(record.layer,record.host,...record.options)};
  decoder.src=href;
 }
 rgb.maps[0].setAttribute('scale',config.strength*2*config.direction);rgb.maps[1].setAttribute('scale',-config.strength*2*config.direction);
 return rgb.ready?`url(#${rgb.id}) `:'';
}
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
function populate(record,templates=sourceNodes().map(source=>({source,copy:copySource(source)}))){
 const scene=document.createDocumentFragment();record.copies=[];
 for(const template of templates){const copy=template.copy.cloneNode(true);record.copies.push({source:template.source,copy});scene.append(copy)}
 record.content.replaceChildren(scene);
}
function rebuild(){
 refreshTimer=0;
 const templates=sourceNodes().map(source=>({source,copy:copySource(source)}));
 for(const record of mirrors.values()){
  if(!record.layer.isConnected){remove(record.layer);continue}
  populate(record,templates);
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
 function update(layer,host,scale=1,blur=0,lens=1,chromatic=null){const record=mount(layer,host);record.host=host;record.scale=scale;record.blur=blur;record.options=[scale,blur,lens,chromatic];const overscan=Math.min(96,Math.max(24,Math.ceil(blur*2)+(chromatic?.strength||0)*2)),inset=`-${overscan}px`;record.overscan=overscan;if(record.content.style.inset!==inset)record.content.style.inset=inset;const optical=`saturate(${Math.max(0,lens).toFixed(2)}) contrast(${Math.max(.75,1+(lens-1)*.16).toFixed(2)}) brightness(${Math.max(.8,1+(lens-1)*.07).toFixed(2)})`,filter=`${blur>0?`blur(${blur.toFixed(2)}px) `:''}${optical} ${channelFilter(record,chromatic)}`;if(record.content.style.filter!==filter)record.content.style.filter=filter;scheduleFrame()}
function remove(layer){const record=mirrors.get(layer);if(!record)return;record.rgb?.root.remove();record.layer.replaceChildren();mirrors.delete(layer);if(!mirrors.size&&frame){cancelAnimationFrame(frame);frame=0}}
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
window.VFMirror={update,remove,refresh:scheduleRefresh,flush:align};
})();
