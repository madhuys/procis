const C = "procis-desk-v1";
const ASSETS = ["./", "index.html", "desk.css", "desk.js", "data/wheat.js", "data/prices.json", "data/countries.json", "vendor/globe.gl.min.js", "manifest.json"];
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); if (r.ok && new URL(e.request.url).origin === location.origin) caches.open(C).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});
