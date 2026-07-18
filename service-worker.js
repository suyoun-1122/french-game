const CACHE="yeonjae-french-v3-4.4";
const CORE=["./","./index.html","./style.css?v=3.4.2","./app.js?v=3.4.2","./audio.js","./review.js","./data/words.json?v=3.4.2","./data/lessons.json?v=3.4.2"];
self.addEventListener("install",event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)))});
self.addEventListener("activate",event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))),self.clients.claim()])));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;
  const url=new URL(event.request.url);
  const freshFirst=url.pathname.endsWith("app.js")||url.pathname.endsWith("style.css")||url.pathname.includes("/data/")||url.pathname.endsWith("index.html")||url.pathname.endsWith("/");
  if(freshFirst){
    event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request)));
  }else{
    event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response})));
  }
});
