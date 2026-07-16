const CACHE='yeonjae-french-v3';
const ASSETS=['./','./index.html','./style.css?v=3','./app.js?v=3','./audio.js','./review.js','./data/words.json?v=3','./data/lessons.json?v=3'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
