const CACHE = 'sandbagged-v10.7.0'
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png']
self.addEventListener('install', e => {
  // DEV-2: {cache:'reload'} bypasses the HTTP cache. Without it, an install that
  // happens soon after a previous visit can precache the PREVIOUS build's HTML
  // under the NEW cache name — and because the fetch handler is cache-first with
  // no revalidation, that stale page is then served forever. That is the whole
  // "the update never reaches the player" failure.
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()))
})
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()))
})
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  e.respondWith(caches.match(e.request, { ignoreSearch: true })
    .then(hit => hit || fetch(e.request).then(res => {
      // DEV-2: only store a response that is actually the thing. There was no ok
      // check, so a captive-portal login page or a Pages 404 during a deploy was
      // written into the versioned cache and then served cache-first for good —
      // and since the game is one inlined HTML file, that bricked the install.
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {})
      }
      return res
    }).catch(() => caches.match('./index.html'))))
})
