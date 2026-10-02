(()=>{'use strict';
 if(!new URLSearchParams(location.search).has('diagnostic'))return;
 const sessions=[],errors=[];let current=null,sequence=0;
 const selectors='.quick-entry-shell,.dock-indicator,#dockZoomSurfaces,#dockZoomSurfaces > span,.profile-drawer,.sheet,.vf-contour-zoom-layer,.vf-rgb-channel,.vf-mirror-content,.vf-mirror-copy,.vf-webgl-glass';
 const round=n=>Math.round(n*1000)/1000;
 function start(meta){current={id:++sequence,...meta,startedAt:new Date().toISOString(),startedMs:performance.now(),frames:[],values:[],droppedFrames:0};sessions.push(current);if(sessions.length>6)sessions.shift();return current.id}
 function intern(value){value=String(value||'');let index=current.values.indexOf(value);if(index<0){if(current.values.length>=1500)return {truncated:true,length:value.length,head:value.slice(0,120)};index=current.values.push(value)-1}return index}
 function captureRendered(context={}){
  if(!current)return;
  const began=performance.now();
  const layers=[...document.querySelectorAll(selectors)].slice(0,100).map(node=>{
   const c=getComputedStyle(node),r=node.getBoundingClientRect();
   return {element:node.id||String(node.className),channel:node.dataset.channel||null,rect:[r.x,r.y,r.width,r.height].map(round),filter:intern(c.filter),backdropFilter:intern(c.backdropFilter||c.webkitBackdropFilter),mask:intern(c.maskImage||c.webkitMaskImage),clipPath:intern(c.clipPath),transform:intern(c.transform),translate:c.translate,scale:c.scale,opacity:c.opacity,visibility:c.visibility,display:c.display,zIndex:c.zIndex,overflow:c.overflow,children:node.childElementCount};
  });
  const frame={atMs:round(began-current.startedMs),...context,geometry:context.geometry?JSON.parse(JSON.stringify(context.geometry)):null,bodyClasses:document.body.className,webgl:window.VFMirror?.diagnostics?.()||null,layers,rgbFilters:[...document.querySelectorAll('filter[id^="vf-radial-"]')].slice(0,30).map(f=>({id:f.id,scale:f.querySelector('feDisplacementMap')?.getAttribute('scale'),map:f.querySelector('feImage')?.hasAttribute('href')})),captureCostMs:round(performance.now()-began)};
  if(current.frames.length>=120){current.frames.splice(1,1);current.droppedFrames++}current.frames.push(frame);
 }
 window.VFDiagnosticCapture=context=>{try{captureRendered(context)}catch(error){if(errors.length<20)errors.push({message:String(error.message).slice(0,800),time:new Date().toISOString()})}};
 window.VFDiagnosticTrace={start,stop(){const ending=current;setTimeout(()=>{if(current===ending)current=null},100)},snapshot(){return {schema:'liquid-studio-transition-trace-v1',limits:{sessions:6,framesPerSession:120,valuesPerSession:1500},warning:'Computed layer state after rendering, not captured screen pixels. Recording adds measurable overhead.',errors,sessions}}};
})();
