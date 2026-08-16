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

/* SHIP-3: Bubblewrap reads this manifest to generate the Android project, and Play reads
   what Bubblewrap generates, so the fields below are not decoration — a missing `id`
   changes the app's identity if `start_url` ever moves, and a maskable icon that is not
   really maskable gets its edges cropped into whatever shape the launcher uses. */
const manifest = {
  id: '/sandbagged/',
  name: 'Sandbagged', short_name: 'Sandbagged',
  description: 'A climbing card battler. The route is the opponent.',
  lang: 'en-GB', dir: 'ltr',
  categories: ['games', 'entertainment'],
  start_url: './', scope: './', display: 'standalone', orientation: 'portrait',
  background_color: '#e8e1d0', theme_color: '#e8e1d0',
  icons: [
    { src: './icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: './icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    /* SHIP-3: its own file, not the plain icon relabelled. Android's maskable safe zone is
       the centred circle of 80% diameter, and the plain art does not fit it — the bottom
       hold sits about 208px from centre against a 205px radius, so a round mask shaves it
       and the contour lines go entirely. `icon-maskable-512.png` is the same artwork at
       80% on the same field, so every drawn element survives any mask shape. */
    { src: './icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  /* NOT declared: `screenshots`. Play shows them and the richer install prompt uses them,
     but they have to come off the real build on a real device — ART-3 has said so since
     v6.7 and faking them onto a store listing would be a lie. Add them with ART-3. */
}
writeFileSync(join(dist, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2))
const ICONS = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png']
for (const f of ICONS) copyFileSync(join('public', f), join(dist, f))

// cache-first, versioned: a new build drops the old cache instead of serving it
const sw = `const CACHE = 'sandbagged-v${VERSION}'
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png']
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
/* SHIP-3: this injection is NOT idempotent, and it fails silently when repeated. Run
   `node scripts/build-html.mjs` twice without a `vite build` between and the head goes in
   twice against the one `</head>` — two manifest links, and TWO service-worker
   registrations, which race each other's controllerchange. Nothing shipped was ever
   affected, because `npm run ship` always does a fresh vite build first; it bit me while
   iterating on the manifest for this ticket, which is exactly when somebody runs the
   second half of a build on its own. Refuse loudly rather than double quietly. */
if (html.includes('rel="manifest"') || html.includes('serviceWorker.register')) {
  throw new Error('build-html: dist/index.html already carries the PWA shell. This script is '
    + 'not idempotent — run `npm run build` first so it starts from a fresh vite output.')
}
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
/* `.nojekyll` matters more than it looks now: GitHub Pages runs the site through Jekyll
   otherwise, and Jekyll DROPS directories whose names begin with a dot — so
   `.well-known/assetlinks.json` would 404 and the TWA would keep its URL bar with no
   obvious cause. It was already here for other reasons; SHIP-3 depends on it. */
writeFileSync(join('docs', '.nojekyll'), '')
for (const f of ICONS) copyFileSync(join('public', f), join('docs', f))

/* SHIP-3: Play requires a privacy policy URL for every app, including one that collects
   nothing. Everything this page claims was verified against the built file rather than
   assumed: the only `fetch` in index.html is Vite's modulepreload polyfill (which never
   fires, because every asset is inlined) and the only one in sw.js re-requests the app's
   own files; the sole storage is localStorage; the only external strings in the bundle are
   React's licence URL and the SVG namespace. */
const privacy = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sandbagged — Privacy</title>
<style>body{max-width:38rem;margin:2.5rem auto;padding:0 1.2rem;background:#e8e1d0;color:#26221e;
font:16px/1.65 Georgia,'Times New Roman',serif}h1{font-size:1.6rem}h2{font-size:1.05rem;margin-top:1.8rem}
code{background:#f3ede1;padding:.1em .3em}a{color:#8c3124}</style></head><body>
<h1>Sandbagged — privacy</h1>
<p><strong>Sandbagged does not collect, transmit, or share any personal data.</strong> There are no
accounts, no analytics, no advertising, no tracking, and no third-party services.</p>
<h2>What is stored, and where</h2>
<p>Your saves, settings and records are written to your device's <code>localStorage</code> by the
browser. They never leave the device. Clearing the site's data, or uninstalling the app, deletes
them permanently — there is no copy anywhere else, and no way for anyone (including us) to recover
one.</p>
<h2>Network</h2>
<p>The game is a single self-contained page. Once it has loaded it makes no network requests except
to fetch its own files, which its service worker caches so the game works offline. Nothing is sent
anywhere at any point.</p>
<h2>Sharing</h2>
<p>The share buttons hand a block of text or an image to your own device — the clipboard, or the
system share sheet. Where that text or picture goes afterwards is entirely your choice, and is
governed by whichever app you pass it to.</p>
<h2>Children</h2>
<p>The game is suitable for general audiences and collects nothing from anyone, of any age.</p>
<h2>Contact</h2>
<p>Questions: <a href="https://github.com/RCJLabs/Sandbagged/issues">github.com/RCJLabs/Sandbagged/issues</a></p>
<p style="color:#5f584a;font-size:.85rem;margin-top:2.5rem">Applies to Sandbagged v${VERSION} and
later. Published from the repository, so this page is versioned with the build it describes.</p>
</body></html>`
writeFileSync(join('docs', 'privacy.html'), privacy)

/* SHIP-3: Digital Asset Links is what lets the TWA drop its URL bar. The fingerprint comes
   from the signing key, and with Play App Signing that means it only exists AFTER the first
   upload — so the file cannot be written until somebody has it.
   It is emitted only when SANDBAGGED_SHA256 is set, and NOT stubbed when it is missing. A
   placeholder here would be worse than nothing: the file would serve, verification would
   fail silently, and the only symptom is a URL bar nobody can explain. */
const FP = (process.env.SANDBAGGED_SHA256 ?? '').trim().toUpperCase()
const PKG = process.env.SANDBAGGED_PKG ?? 'com.rcjlabs.sandbagged'
if (/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(FP)) {
  mkdirSync(join('docs', '.well-known'), { recursive: true })
  writeFileSync(join('docs', '.well-known', 'assetlinks.json'), JSON.stringify([{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: { namespace: 'android_app', package_name: PKG, sha256_cert_fingerprints: [FP] },
  }], null, 2) + '\n')
  console.log(`build:html · assetlinks.json written for ${PKG}`)
} else if (FP) {
  throw new Error('SANDBAGGED_SHA256 is set but is not 32 colon-separated hex pairs — refusing '
    + 'to write an assetlinks.json that would fail verification silently')
}

console.log('build:html ok ->', (html.length / 1024).toFixed(0),
  'KB · syntax checked · fully inlined · PWA shell emitted · privacy page · docs/ updated'
  + (FP ? ' · assetlinks' : ' · no assetlinks (SANDBAGGED_SHA256 unset — see ship/README.md)'))
