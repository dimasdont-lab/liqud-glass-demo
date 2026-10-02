/* Live page copy for glass zoom. Blur is applied to this copy after scaling,
   so it samples the zoomed image rather than the unmodified backdrop. */
(()=>{'use strict';
const mirrors=new Map();let refreshTimer=0,frame=0,suspended=false;
const SVG='http://www.w3.org/2000/svg';
let channelDefinitions,radialTexture,channelSerial=0;
function radialMap(){
 if(radialTexture)return radialTexture;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
 const context=canvas.getContext('2d'),pixels=context.createImageData(256,256);
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){
  const dx=x-127.5,dy=y-127.5,length=Math.hypot(dx,dy)||1,i=(y*256+x)*4;
  pixels.data[i]=Math.round(127.5+127.5*dx/length);pixels.data[i+1]=Math.round(127.5+127.5*dy/length);pixels.data[i+2]=128;pixels.data[i+3]=255;
 }
 context.putImageData(pixels,0,0);radialTexture=canvas.toDataURL();return radialTexture;
}
function displacementChannel(name){
 const filter=document.createElementNS(SVG,'filter'),id=`vf-radial-${++channelSerial}`;
 filter.id=id;filter.setAttribute('filterUnits','userSpaceOnUse');filter.setAttribute('color-interpolation-filters','sRGB');
 const map=document.createElementNS(SVG,'feImage');map.setAttribute('href',radialMap());map.setAttribute('preserveAspectRatio','none');map.setAttribute('result','radial');
 const displacement=document.createElementNS(SVG,'feDisplacementMap');displacement.setAttribute('in','SourceGraphic');displacement.setAttribute('in2','radial');displacement.setAttribute('xChannelSelector','R');displacement.setAttribute('yChannelSelector','G');
 const matrix=document.createElementNS(SVG,'feColorMatrix'),values=Array(20).fill(0);values[['red','green','blue'].indexOf(name)*6]=1;values[18]=1;matrix.setAttribute('values',values.join(' '));
 filter.append(map,displacement,matrix);channelDefinitions.append(filter);return {filter,map,displacement,id};
}
function ensureChannels(){
 if(channelDefinitions)return;
 const root=document.createElementNS(SVG,'svg');root.setAttribute('aria-hidden','true');
 root.style.cssText='position:fixed;left:-100px;top:-100px;width:1px;height:1px;pointer-events:none';
 // Green stays at its original sample coordinates. Red/blue use persistent
 // displacement filters and one shared static texture throughout the morph.
 root.innerHTML='<defs>'+['red','green','blue'].map((name,index)=>{
  const matrix=Array(20).fill(0);matrix[index*6]=1;matrix[18]=1;
  return `<filter id="vf-channel-${name}" color-interpolation-filters="sRGB" x="-50%" y="-50%" width="200%" height="200%"><feColorMatrix type="matrix" values="${matrix.join(' ')}"/></filter>`;
 }).join('')+'</defs>';document.body.append(root);channelDefinitions=root;
}
function rgbPoints(record){return record.chromatic?.centers||[{x:record.host.clientWidth/2,y:record.host.clientHeight/2,width:record.host.clientWidth,height:record.host.clientHeight}]}
function rgbEnabled(config){return !!(config?.enabled&&config.strength>0)}
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
 record.channels?.forEach(item=>item.optics?.filter.remove());record.channels=[];
 const appendCopies=parent=>{for(const template of templates){const copy=template.copy.cloneNode(true);record.copies.push({source:template.source,copy});parent.append(copy)}};
 record.rgbCount=rgbEnabled(record.chromatic)?rgbPoints(record).length:0;
 if(record.rgbCount){
  ensureChannels();
  for(let i=0;i<record.rgbCount;i++){
   const region=document.createElement('span');region.className='vf-rgb-region';scene.append(region);
   for(const [name,sign]of [['red',1],['green',0],['blue',-1]]){
    const channel=document.createElement('span');channel.className='vf-rgb-channel';channel.dataset.channel=name;
    region.append(channel);appendCopies(channel);record.channels.push({region,channel,name,sign,index:i,optics:sign?displacementChannel(name):null});
   }
  }
 }else appendCopies(scene);
 record.content.classList.toggle('vf-rgb-content',!!record.rgbCount);
 record.content.replaceChildren(scene);
}
function rebuild(){
 refreshTimer=0;
 const templates=sourceNodes().map(source=>({source,copy:copySource(source)}));
 for(const record of mirrors.values()){
  if(!record.layer.isConnected){remove(record.layer);continue}
  populate(record,templates);
  if(record.options)update(record.layer,record.host,...record.options);
 }
 scheduleFrame();
}
function scheduleRefresh(records){
 if(suspended)return;
 const navigation=Array.isArray(records)&&records.some(record=>record.attributeName==='class'&&record.target.classList.contains('screen'));
 if(refreshTimer){if(!navigation)return;clearTimeout(refreshTimer)}
 // Changing pages must not leave the previous page under the dock for 180ms.
 // Frequent chart/ticker changes remain batched to avoid cloning every frame.
 refreshTimer=setTimeout(rebuild,navigation?0:180);
}
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
   const sourceW=source.offsetWidth||box.width,sourceH=source.offsetHeight||box.height;
   const left=`${x}px`,top=`${y}px`,width=`${sourceW}px`,height=`${sourceH}px`;
   if(copy.style.left!==left)copy.style.left=left;
   if(copy.style.top!==top)copy.style.top=top;
   if(copy.style.width!==width)copy.style.width=width;
   if(copy.style.height!==height)copy.style.height=height;
   const cx=(hostRect.left+hostRect.width/2-contentRect.left)/localX,cy=(hostRect.top+hostRect.height/2-contentRect.top)/localY;
   // Preserve the source's actual layout and background-motion scale. Giving
   // a cloned page its transformed width would reflow its text instead.
   const transform=`translate(${(record.scale-1)*(x-cx)}px,${(record.scale-1)*(y-cy)}px) scale(${box.width/sourceW/localX*record.scale},${box.height/sourceH/localY*record.scale})`;
   if(copy.style.transform!==transform)copy.style.transform=transform;
   copy.style.transformOrigin='0 0';
   if(source.classList.contains('account-ticker')){
    const track=copy.querySelector('.ticker-track'),original=source.querySelector('.ticker-track');
    if(track&&original){const animated=getComputedStyle(original).transform;if(track.style.transform!==animated)track.style.transform=animated}
   }
  }
 }
}
function positionAll(){frame=0;align();if(mirrors.size)frame=requestAnimationFrame(positionAll)}
function scheduleFrame(){if(!frame&&mirrors.size)frame=requestAnimationFrame(positionAll)}
 function update(layer,host,scale=1,blur=0,lens=1,chromatic=null){
  const record=mount(layer,host);record.host=host;record.scale=scale;record.blur=blur;record.chromatic=chromatic;record.options=[scale,blur,lens,chromatic];
  const overscan=Math.min(96,Math.max(24,Math.ceil(blur*2)+(chromatic?.strength||0)*2)),inset=`-${overscan}px`;
  record.overscan=overscan;if(record.content.style.inset!==inset)record.content.style.inset=inset;
  const count=rgbEnabled(chromatic)?rgbPoints(record).length:0;if(count!==record.rgbCount)populate(record);
  const optical=`saturate(${Math.max(0,lens).toFixed(2)}) contrast(${Math.max(.75,1+(lens-1)*.16).toFixed(2)}) brightness(${Math.max(.8,1+(lens-1)*.07).toFixed(2)})`,filter=`${blur>0?`blur(${blur.toFixed(2)}px) `:''}${optical}`;
  // Source zoom → blur/material → constant-pixel radial displacement → channel isolation.
  // The outer layer retains the exact shared contour/edge mask in all states.
  record.content.style.filter=count?'none':filter;
  for(const item of record.channels){
   const point=rgbPoints(record)[item.index],w=point.width||host.clientWidth,h=point.height||host.clientHeight;
   const amount=item.sign*chromatic.strength*chromatic.direction;
   item.channel.style.filter=`${filter} url(#${item.optics?.id||'vf-channel-green'})`;
   item.channel.style.transform='none';
   if(item.optics){
    const {filter:svgFilter,map,displacement}=item.optics;
    const width=host.clientWidth+2*overscan,height=host.clientHeight+2*overscan;
    for(const node of [svgFilter,map]){node.setAttribute('x','0');node.setAttribute('y','0');node.setAttribute('width',width);node.setAttribute('height',height)}
    // A square map keeps the vector normalized in CSS pixels, even for long pills.
    const size=Math.max(width,height)*2;
    map.setAttribute('x',point.x+overscan-size/2);map.setAttribute('y',point.y+overscan-size/2);map.setAttribute('width',size);map.setAttribute('height',size);
    displacement.setAttribute('scale',-2*amount);
   }
   // Separate capsules use their own mass centre; never smear RGB across the gap.
   const points=rgbPoints(record),split=count===2?(points[0].x+points[1].x)/2+overscan:0;
   item.region.style.clipPath=count===2?(item.index===0?`inset(0 ${Math.max(0,host.clientWidth+2*overscan-split)}px 0 0)`:`inset(0 0 0 ${split}px)`):'none';
  }
  scheduleFrame();
 }
function remove(layer){const record=mirrors.get(layer);if(!record)return;record.channels?.forEach(item=>item.optics?.filter.remove());record.layer.replaceChildren();mirrors.delete(layer);if(!mirrors.size&&frame){cancelAnimationFrame(frame);frame=0}}
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
window.VFMirror={update,remove,refresh:scheduleRefresh,flush:align,suspend(){suspended=true;clearTimeout(refreshTimer);cancelAnimationFrame(frame);for(const layer of mirrors.keys())remove(layer)}};
})();
