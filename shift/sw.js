// Netwerk eerst, zodat updates direct doorkomen; de cache is de terugval voor offline spelen.
const CACHE='shift-mk-2026-10-14-2';
const ASSETS=['./','./index.html','./style.css','./app.js','./engine.js','./audio.js','./duels.js','./multiplayer-ui.js','./vragen.js','./leaderboard.js','./leaderboard-config.js','./manifest.webmanifest','./icon.svg','./logo.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('cirkelstrijd-')||k.startsWith('shift-'))&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;})
    .catch(()=>caches.match(event.request,{ignoreSearch:true}).then(hit=>hit||(event.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));
});
