const CACHE='liquid-glass-demo-v103';
const CACHE_PREFIX='liquid-glass-demo-v';
const CORE=['./','./index.html','./whisper-worker.js','./manifest.webmanifest','./motion-editor.webmanifest','./icons/liquid-studio-180.png','./icons/liquid-studio-192.png','./icons/liquid-studio-512.png','./mirror-runtime.js','./motion-preset.js','./motion-runtime.js','./motion-editor.html','./motion-editor.js','./motion-editor.css','./motion-editor-mobile.css'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  // App shell: network first prevents an installed iPhone PWA from being stuck
  // on old JS. Cross-origin model/runtime files keep their own browser cache.
  if(url.origin===self.location.origin&&url.pathname.startsWith(new URL(self.registration.scope).pathname)){
    e.respondWith(fetch(e.request,{cache:'no-store'}).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return response;
    }).catch(()=>caches.match(e.request)));
  }
});
