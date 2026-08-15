/* SANDBAGGED — GUARD-8: the parts of the suite that guard the suite.
 *
 * A good half of these tests work by reading a window of source and asserting what is
 * and is not inside it. That is a legitimate technique — it is how you assert "the
 * screen does not reimplement this rule" or "this function grew a pump term" — but the
 * WINDOW is where those guards rot, and they rot silently, because a guard reading the
 * wrong text still reads green.
 *
 * Three failure modes, all of which have actually happened in this project:
 *
 *   A FIXED LENGTH — `slice(at, at + 4000)`. Too short and the tail falls outside the
 *   window, so every NEGATIVE assertion over it passes for free; too long and it bleeds
 *   into the next function and can pass on somebody else's code. Three of these were
 *   written during NARR-14's own ticket, and two more had to be repaired mid-session
 *   when adding content pushed a needle out of them (SAVE-2's adjacency window during
 *   DAILY-1, and the run-end account during NARR-14).
 *
 *   AN UNCHECKED ANCHOR — `src.slice(src.indexOf('x'))` where 'x' has been renamed  guard-8: allow
 *   gives -1, and `slice(-1)` is one character. A negative assertion over one character
 *   passes. That is the GUARD-3 class: GUARD-3 fixed the instances it found and did
 *   nothing to stop the next ones, and there were more.
 *
 *   NO FAILURE MESSAGE — `ok(cond)` throws `Error(undefined)`, so the suite reports a
 *   blank line and you go source-diving to find out what broke.
 *
 * So the fix is not "repair those windows". It is: there is one way to take a window,
 * it validates itself, and `guardScan` refuses to let a hand-rolled one back in.
 *
 * Lines that genuinely need a raw slice carry a `guard-8: allow` marker and a reason.
 */

/* ---- assertions ---------------------------------------------------------------
   Both of these demand a message. That is checked at CALL time rather than by reading
   the source, which makes it exact: a regex literal containing a quote is enough to
   fool a static scan, and the two message-less assertions the seventh audit found had
   sat there through six audits that were all looking. */
export const ok = (c, m) => {
  if (!m) throw new Error('GUARD-8: this assertion has no failure message, so its failure says nothing')
  if (!c) throw new Error(m)
}
export const eq = (a, b, m) => {
  if (!m) throw new Error('GUARD-8: this assertion has no failure message, so its failure says nothing')
  if (a !== b) throw new Error(`${m} — expected ${b}, got ${a}`)
}

/* ---- windows ------------------------------------------------------------------ */

/** The source from `from` up to whichever of `to` comes first after it.
 *
 *  Throws rather than returning a bad window in all three of the ways a window goes
 *  bad: the opening anchor is gone, every closing anchor is gone, or what came back is
 *  too small to be worth asserting over. `min` is the floor a caller expects — set it
 *  to roughly half of what the window really is, so it catches truncation without
 *  needing maintenance every time the code grows. */
export function region(src, from, to, { min = 120, what, eof = false } = {}) {
  const name = what ?? from
  const at = src.indexOf(from)
  if (at < 0) throw new Error(`${name}: the opening anchor is gone, so this guard is reading nothing — looked for ${JSON.stringify(from)}`)
  const bounds = [].concat(to)
  let end = src.length
  let found = false
  for (const b of bounds) {
    const i = src.indexOf(b, at + from.length)
    if (i >= 0 && i < end) { end = i; found = true }
  }
  if (bounds.length && !found && !eof) {
    throw new Error(`${name}: none of its closing anchors are left, so this guard would read to the end of the file — ${JSON.stringify(bounds)}`)
  }
  const out = src.slice(at, end) // guard-8: allow — this IS the validated window
  if (out.length < min) {
    throw new Error(`${name}: the window is only ${out.length} chars against a floor of ${min} — a bound moved and this guard is reading almost nothing`)
  }
  return out
}

/** A top-level declaration in engine.ts, bounded by the next one rather than a count. */
export const declBody = (src, header, what) =>
  region(src, header, ['\nexport function ', '\nexport const ', '\nexport type ',
    '\nfunction ', '\nconst '], { min: 200, what: what ?? header })

/** One of App.tsx's inner functions — two-space indented, inside the component. */
export const appFn = (src, name, what) =>
  region(src, `  function ${name}`, ['\n  function ', '\n  const ', '\n  useEffect('],
    { min: 80, what: what ?? name })

/** A single CSS rule, selector through its closing brace. */
export const cssRule = (src, sel) => region(src, sel, ['}'], { min: 8, what: `the ${sel} rule` })

/** From `from` to the end of the file — for the cases where that is the point. Still
 *  validates the anchor, which is the half that actually goes wrong. */
export const tail = (src, from, { min = 120, what } = {}) =>
  region(src, from, [], { min, what, eof: true })

/** Source with its comments removed, for negative assertions.
 *
 *  ART-4: the FIFTH time a negative source assertion has matched the prose explaining
 *  what it forbids rather than the code doing it. Four of those were a missing strip; the
 *  fifth was a strip that did not work — three guards had rolled their own as a per-LINE
 *  filter on lines that START with a comment marker, and this project writes block
 *  comments whose continuation lines are bare indented prose:
 *
 *      \/* THE DELIVERY IS THE HARD HALF, and `<a download>` is the wrong answer
 *         for the device this is played on. *\/          <- this line survives the filter
 *
 *  So `!/<a[^>]+download/` failed on the sentence saying there must be no download link.
 *  Block comments have to be stripped as BLOCKS, which needs the whole string rather than
 *  a line at a time — so it lives here, once, instead of being rewritten per guard. */
export const stripComments = src => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1')

/* ---- the meta-guard ----------------------------------------------------------- */

const ALLOW = 'guard-8: allow'

/** Reads the suite's own source for the three shapes above.
 *
 *  Takes [name, src] pairs and returns a list of complaints. Rule C is whole-file
 *  rather than per-line: a variable set from an `indexOf` and later handed to a
 *  `slice` is the same unchecked anchor spread across two lines, which is how most of
 *  them were actually written. */
export function guardScan(files) {
  const bad = []
  for (const [file, src] of files) {
    const lines = src.split('\n')
    const anchored = new Set([...src.matchAll(/\b(?:const|let|var)\s+(\w+)\s*=\s*[^\n=]*?\.indexOf\(/g)]
      .map(m => m[1]))
    lines.forEach((line, i) => {
      if (line.includes(ALLOW)) return
      const where = `${file}:${i + 1}`
      const say = why => bad.push(`${where} — ${why}\n      ${line.trim()}`)
      // `.*` rather than `[^)]*` on purpose: `slice(x.indexOf('a') + 0, … + 400)` is the
      // same mistake and a paren-shy pattern walks straight past it.
      if (/\.slice\(.*\+\s*\d/.test(line)) {
        say('a window with a hard-coded length. Use region()/declBody(), which bounds at the next real boundary')
      } else if (/\.slice\(/.test(line) && /\.indexOf\(/.test(line)) {
        say('a window taken straight off indexOf, which is -1 when the anchor is renamed. Use region()')
      } else {
        const v = /\.slice\(\s*(\w+)\s*[,)]/.exec(line)
        if (v && anchored.has(v[1])) {
          say(`a window off \`${v[1]}\`, which this file sets from an indexOf. Use region()`)
        }
      }
    })
  }
  return bad
}
