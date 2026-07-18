const CACHE="yeonjae-french-v4-4-0";
const CORE=[
  "./","./index.html",
  "./style.css?v=4.4.0",
  "./assets/styles/design-system.css?v=4.4.0",
  "./assets/styles/components.css?v=4.4.0",
  "./app.js?v=4.4.0","./audio.js","./review.js",
  "./data/words.json?v=4.3.0","./data/lessons.json?v=4.3.0","./data/recipes.json?v=4.3.0",
  "./assets/characters/petit-animated.svg","./assets/characters/fromage-animated.svg","./assets/characters/lavande-animated.svg","./assets/characters/trio-animated.svg","./assets/foods/recipes/croissant.svg","./assets/foods/recipes/baguette.svg","./assets/foods/recipes/crepe.svg","./assets/foods/recipes/madeleine.svg","./assets/foods/recipes/macaron.svg","./assets/foods/recipes/quiche.svg","./assets/foods/recipes/croquemonsieur.svg","./assets/foods/recipes/ratatouille.svg","./assets/foods/recipes/gratin.svg","./assets/foods/recipes/soupe.svg","./assets/foods/recipes/boeuf.svg","./assets/foods/recipes/coq.svg","./assets/foods/recipes/cassoulet.svg","./assets/foods/recipes/bouillabaisse.svg","./assets/foods/recipes/tarte.svg"
];
self.addEventListener("install",event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)))});
self.addEventListener("activate",event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))),self.clients.claim()])));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;
  const url=new URL(event.request.url);
  const freshFirst=url.pathname.endsWith("app.js")||url.pathname.endsWith(".css")||url.pathname.includes("/data/")||url.pathname.endsWith("index.html")||url.pathname.endsWith("/");
  if(freshFirst){
    event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request)));
  }else{
    event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response})));
  }
});
