/* PERF-3 — finding a chromium, in one place.
 *
 * This is its own module because two things need it and neither can have a second copy:
 * `scripts/perf.mjs` launches with it, and PERF-3's guard uses it to tell a box with no
 * browser (environmental, and not this repo's problem) apart from a box WITH one that the
 * script cannot use (the defect PERF-3 exists about). Importing perf.mjs to get it would
 * run perf.mjs — it is a script with top-level await that starts a server.
 *
 * WHY IT EXISTS AT ALL. PERF-3's row blamed `npm run perf` failing on an undeclared
 * `playwright-core`. GUARD-11 declared it at v10.84 and the script still could not run:
 * playwright-core ships no browsers by design, 1.62.1 resolves Chromium build 1234, and
 * the machine has 1194 — so `chromium.launch()` with no executablePath dies on a path that
 * has never existed here, under a banner recommending `npx playwright install`, which is
 * the one thing this environment documents you must not do. A measurement script needs
 * A chromium, not the blessed build, so take whichever one is actually on disk.
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const REL = [
  'chrome-linux/chrome', 'chrome-linux/headless_shell',
  'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
  'chrome-mac/headless_shell', 'chrome-win/chrome.exe', 'chrome-win/headless_shell.exe',
]

/** @returns {{path: string|undefined, how: string}} path undefined = fall back to playwright's default */
export function findBrowser(env = process.env) {
  if (env.PW_EXE) return { path: env.PW_EXE, how: 'PW_EXE' }
  const root = env.PLAYWRIGHT_BROWSERS_PATH
  if (root && existsSync(root)) {
    // newest build first, so a box with several picks the one most likely to match
    for (const dir of readdirSync(root).filter(d => /^chromium/.test(d)).sort().reverse())
      for (const rel of REL) {
        const p = join(root, dir, rel)
        if (existsSync(p)) return { path: p, how: `${root}/${dir}` }
      }
  }
  return { path: undefined, how: "playwright's own default" }
}
