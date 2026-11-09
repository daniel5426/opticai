// Cache only the isolated scanner shell and its requested static assets; never API data.
const CACHE = 'prysm-scanner-v1';
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.add('/scanner/'))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('prysm-scanner-') && key !== CACHE).map(key => caches.delete(key))))); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !(url.pathname === '/scanner/' || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/scanner/icon-'))) return;
  event.respondWith(fetch(event.request).then(response => { if (response.ok) {const copy=response.clone();void caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response; }).catch(()=>caches.match(event.request)));
});
