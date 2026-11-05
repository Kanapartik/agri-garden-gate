const CACHE='agrighar-fieldwork-v6-focus';const FILES=['./','./index.html','./style.css','./data.js','./forms.js','./enterprise.js','./enterprise-source.json','./leadership.js','./leadership-methods.json','./app.js','./auth-client.js','./mobile-runtime.js','./guided.js','./travel.js','./location-dashboard.js','./i18n.js','./translations.js','./manifest.webmanifest','./icon.svg','./blueprint.md'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('agrighar-preview-')||k.startsWith('agrighar-fieldwork-'))&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
// Only explicitly bundled public assets are cacheable. Authentication, staff
// profiles, survey responses and leadership API requests never enter CacheStorage.
const ASSETS=new Set(FILES.map(file=>new URL(file,self.registration.scope).href));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||!ASSETS.has(e.request.url))return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){let copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return r}).catch(()=>caches.match(e.request).then(r=>r||(e.request.mode==='navigate'?caches.match('./index.html'):Response.error()))))});
