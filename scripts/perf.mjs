/* PERF-2 — "the 190KB question". The row asks whether React's weight matters on a
 * mid-range phone, and calls it unmeasured. Bytes are not the question; what a big bundle
 * costs on a slow CPU is parse, compile and first render, so that is what this times —
 * under Chromium's CPU throttling, which is the standard stand-in for a slower device
 * (4x ~ mid-tier mobile, 6x ~ low end).
 *
 * It also times a TURN, because a card game's felt performance is the tap-to-repaint loop
 * rather than the boot, and a renderer swap would be justified by the second, not the first.
 */
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { extname, join } from 'node:path'

/* Serves docs/ itself rather than expecting one to be running: over file:// the service
   worker never registers and the numbers would be measuring a different app. */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json' }
const srv = createServer((req, res) => {
  const f = join('docs', (req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]))
  try {
    const body = readFileSync(f)
    res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' })
    res.end(body)
  } catch { res.writeHead(404); res.end() }
})
await new Promise(r => srv.listen(0, '127.0.0.1', r))
const URL = `http://127.0.0.1:${srv.address().port}/index.html`
const b = await chromium.launch({ executablePath: process.env.PW_EXE || undefined })

async function boot(rate) {
  const ctx = await b.newContext({ viewport: { width: 402, height: 874 } })
  const pg = await ctx.newPage()
  const cdp = await ctx.newCDPSession(pg)
  if (rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate })
  await pg.goto(URL, { waitUntil: 'load' })
  await pg.locator('.splash').waitFor({ state: 'visible', timeout: 30000 })
  const t = await pg.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const fp = performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint')
    return {
      // how long the browser spent on OUR script before the page could show anything
      domInteractive: Math.round(nav.domInteractive),
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
      loadEnd: Math.round(nav.loadEventEnd),
      fcp: fp ? Math.round(fp.startTime) : null,
    }
  })
  // and the first interaction: tap to begin, wait for the menu to exist
  const t0 = Date.now()
  await pg.locator('.splash').click()
  await pg.locator('text=THE EXPEDITION').first().waitFor({ timeout: 30000 })
  t.firstInteraction = Date.now() - t0
  await ctx.close()
  return t
}

async function turn(rate) {
  const ctx = await b.newContext({ viewport: { width: 402, height: 874 } })
  const pg = await ctx.newPage()
  const cdp = await ctx.newCDPSession(pg)
  await pg.goto(URL, { waitUntil: 'load' })
  await pg.locator('.splash').click()
  await pg.locator("text=TODAY'S PROBLEM").first().click()
  await pg.locator('button:has-text("COMMIT")').first().waitFor({ timeout: 30000 })
  if (rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate })   // throttle AFTER setup
  const times = []
  for (let i = 0; i < 6; i++) {
    const commit = pg.locator('button:has-text("COMMIT")')
    if (!(await commit.count())) break
    // place what is to hand, then time the commit -> repaint
    for (const [want, slot] of [['feet', 2], ['hand', 0], ['hand', 1]]) {
      const k = await pg.evaluate(w => [...document.querySelectorAll('.card')]
        .findIndex(el => !el.classList.contains('bonus') && new RegExp('\\n' + w + '\\n').test(el.innerText)), want)
      if (k < 0) continue
      const slots = pg.locator('.slot.you')
      if (await slots.count() <= slot) continue
      if (!(await slots.nth(slot).getAttribute('class')).includes('empty')) continue
      await pg.locator('.card').nth(k).click(); await slots.nth(slot).click()
    }
    const ms = await pg.evaluate(async () => {
      const btn = [...document.querySelectorAll('button')].find(x => /COMMIT/.test(x.textContent))
      if (!btn) return null
      const t0 = performance.now()
      btn.click()
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      return performance.now() - t0
    })
    if (ms != null) times.push(ms)
    await pg.waitForTimeout(120)
  }
  await ctx.close()
  return times
}

console.log('PERF-2 — boot cost by CPU throttle (402x874, cold context each time)\n')
console.log('throttle   domInteractive   DCL     load    FCP    tap-to-menu')
for (const rate of [1, 4, 6]) {
  const runs = []
  for (let i = 0; i < 3; i++) runs.push(await boot(rate))
  const med = k => Math.round(runs.map(r => r[k]).sort((a, c) => a - c)[1])
  console.log(`${(rate + 'x').padEnd(10)} ${String(med('domInteractive')).padStart(11)}ms ` +
    `${String(med('domContentLoaded')).padStart(6)}ms ${String(med('loadEnd')).padStart(6)}ms ` +
    `${String(med('fcp')).padStart(5)}ms ${String(med('firstInteraction')).padStart(10)}ms`)
}
console.log('\nturn latency — commit tap to second repaint, throttled after setup')
for (const rate of [1, 4, 6]) {
  const t = await turn(rate)
  if (!t.length) { console.log(`${rate}x: no turns`); continue }
  const s = t.slice().sort((a, c) => a - c)
  console.log(`${(rate + 'x').padEnd(4)} n=${t.length}  median ${s[Math.floor(s.length / 2)].toFixed(0)}ms  ` +
    `worst ${s[s.length - 1].toFixed(0)}ms  (${t.map(x => x.toFixed(0)).join(', ')})`)
}
await b.close()
srv.close()
