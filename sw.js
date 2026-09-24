const CACHE='voice-finance-free-v43';
const CORE=['./','./index.html','./whisper-worker.js','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  // App shell: network first prevents an installed iPhone PWA from being stuck
  // on old JS. Cross-origin model/runtime files keep their own browser cache.
  if(url.origin===self.location.origin){
    e.respondWith(fetch(e.request,{cache:'no-store'}).then(response=>{
      const copy=response.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return response;
    }).catch(()=>caches.match(e.request)));
  }
});
