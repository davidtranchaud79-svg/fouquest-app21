self.addEventListener('install', e=>{
  self.skipWaiting();
  e.waitUntil(caches.open('fouquest-v15').then(c=>c.addAll(['./','./index.html','./styles.css','./app.js','./manifest.json'])));
});
self.addEventListener('activate', e=> clients.claim());
self.addEventListener('fetch', e=>{
  e.respondWith(
    caches.match(e.request).then(r=> r || fetch(e.request).catch(()=> caches.match('./index.html')))
  );
});
