import { readFileSync, writeFileSync, readdirSync, unlinkSync, copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const dist = 'dist'
let html = readFileSync(join(dist, 'index.html'), 'utf8')
const assets = join(dist, 'assets')
let jsBody = ''
let jsInserted = ''

for (const f of readdirSync(assets)) {
  const body = readFileSync(join(assets, f), 'utf8')
  // CRITICAL: pass a FUNCTION to .replace(). A replacement *string* interprets
  // $&, $`, $', $1 ... and minified React is full of $ — that corrupts the bundle.
  if (f.endsWith('.js')) {
    jsBody = body
    // a literal </script> inside a string would close the tag early
    // esbuild already emits <\/script> inside string literals, so this normally
    // finds nothing — it is a guard for any asset that is not so careful.
    const safe = body.split('</script').join('<\\/script')
    jsInserted = safe
    html = html.replace(
      new RegExp(`<script[^>]*src="[^"]*${f}"[^>]*></script>`),
      () => `<script type="module">${safe}</script>`)
  } else if (f.endsWith('.css')) {
    html = html.replace(
      new RegExp(`<link[^>]*href="[^"]*${f}"[^>]*>`),
      () => `<style>${body}</style>`)
  }
}

// gate: extract the JS back OUT of the assembled HTML and prove it is lossless.
// Checking jsBody pre-insertion would test the ingredient, not the cake.
const m = html.match(/<script type="module">([\s\S]*?)<\/script>/)
if (!m) { console.error('BUILD FAILED — no inlined module script found'); process.exit(1) }
// compare against what was INSERTED. Do not "unescape" — esbuild's own
// <\/script> sequences are legitimate JS and undoing them eats a backslash.
const extracted = m[1]
if (extracted !== jsInserted) {
  console.error(`BUILD FAILED — inlining was lossy: ${extracted.length} out vs ${jsInserted.length} in`)
  process.exit(1)
}
const probe = join(dist, '_syntax_probe.mjs')
writeFileSync(probe, extracted)
try {
  execSync(`node --check ${probe}`, { stdio: 'pipe' })
} catch (e) {
  console.error('BUILD FAILED — inlined JS does not parse:\n' + String(e.stderr || e))
  process.exit(1)
} finally { unlinkSync(probe) }

if (/<script[^>]*src=/.test(html) || /<link[^>]*stylesheet/.test(html)) {
  console.error('BUILD FAILED — an external asset reference survived inlining')
  process.exit(1)
}

// ---- SHIP-2: PWA shell -------------------------------------------------
// A service worker MUST be a real file at its own scope — it cannot be
// inlined — so this is the one place the build emits more than the HTML.
// index.html stays fully self-contained and still works on its own.
const VERSION = JSON.parse(readFileSync('package.json', 'utf8')).version

const manifest = {
  name: 'Sandbagged', short_name: 'Sandbagged',
  description: 'A climbing card battler. The route is the opponent.',
  start_url: './', scope: './', display: 'standalone', orientation: 'portrait',
  background_color: '#e8e1d0', theme_color: '#e8e1d0',
  icons: [
    { src: './icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: './icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: './icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}
writeFileSync(join(dist, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2))
for (const f of ['icon-192.png', 'icon-512.png']) copyFileSync(join('public', f), join(dist, f))

// cache-first, versioned: a new build drops the old cache instead of serving it
const sw = `const CACHE = 'sandbagged-v${VERSION}'
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
`
writeFileSync(join(dist, 'sw.js'), sw)

const head = `<link rel="manifest" href="./manifest.webmanifest">` +
  `<link rel="apple-touch-icon" href="./icon-192.png">` +
  `<meta name="apple-mobile-web-app-capable" content="yes">` +
  `<meta name="apple-mobile-web-app-status-bar-style" content="default">` +
  `<meta name="apple-mobile-web-app-title" content="Sandbagged">`
/* DEV-2: registration was fire-and-forget. skipWaiting()+clients.claim() do NOT
   reload an open page, so a new build landed a whole app relaunch late — or never,
   on an installed iOS PWA that is rarely cold-started. This reloads when the
   controller is replaced, but ONLY once, only when there was already a controller
   (so a first install does not bounce), and only when window.__SB_BUSY__ is false.

   DEV-7: that flag used to mean "mid-climb", and the reload it allowed everywhere else
   was reported as the game randomly going back a menu. It did: `loadGame` restores the
   save but not `phase`, so a reload from any screen lands on the splash. The flag now
   means "the player has tapped begin", so the only reload that ever happens is one the
   player cannot see. That also RETIRES THE POLL: busy used to go true and false as the
   phase changed, so waiting four seconds and asking again made sense. It is one-way now
   — nothing un-taps the splash — so if it is busy at controllerchange it is busy for the
   rest of the session, and an interval that can never fire is just an interval. The
   build lands on the next launch instead, in that launch's splash window. */
const reg = `<script>if('serviceWorker' in navigator){` +
  `addEventListener('load',function(){` +
  `var had=!!navigator.serviceWorker.controller,done=false;` +
  `navigator.serviceWorker.addEventListener('controllerchange',function(){` +
  `if(!had||done)return;done=true;` +
  `if(!window.__SB_BUSY__){location.reload()}});` +
  `navigator.serviceWorker.register('./sw.js').catch(function(){})})}<\/script>`
html = html.replace('</head>', () => head + '</head>')
html = html.replace('</body>', () => reg + '</body>')

writeFileSync(join(dist, 'sandbagged.html'), html)
writeFileSync(join(dist, 'index.html'), html)

// GitHub Pages serves /docs from the default branch, so the built site lives
// in the repo and a push deploys. Source stays at the root.
mkdirSync('docs', { recursive: true })
writeFileSync(join('docs', 'index.html'), html)
writeFileSync(join('docs', 'manifest.webmanifest'), JSON.stringify(manifest, null, 2))
writeFileSync(join('docs', 'sw.js'), sw)
writeFileSync(join('docs', '.nojekyll'), '')   // do not run the site through Jekyll
for (const f of ['icon-192.png', 'icon-512.png']) copyFileSync(join('public', f), join('docs', f))
console.log('build:html ok ->', (html.length / 1024).toFixed(0),
  'KB · syntax checked · fully inlined · PWA shell emitted · docs/ updated')
