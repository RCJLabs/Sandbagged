/* SANDBAGGED — the core suite.
 *
 * `test.mjs` covers the features. This covers the 61 engine exports that had
 * no test at all: the constants, the curves, the tables and the small pure
 * functions everything else is built on. The choice of what to assert is not
 * arbitrary — each one is either a rule this project has stated and never
 * checked, or a place a bug has actually come from.
 *
 *   node sim/test-core.mjs
 */
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { unlinkSync } from 'node:fs'

const results = []
let current = ''
const group = n => { current = n }
function test(name, fn) {
  try { fn(); results.push([true, current, name]) }
  catch (e) { results.push([false, current, name, e.message]) }
}
const ok = (c, m) => { if (!c) throw new Error(m) }
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m} — expected ${b}, got ${a}`) }

await build({
  entryPoints: ['sim/entry.ts'], bundle: true, format: 'esm', outfile: 'sim/_core.mjs',
  platform: 'node', logLevel: 'error', external: ['react', 'react-dom', 'react/jsx-runtime'],
})
const store = new Map()
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
}
globalThis.btoa = s => Buffer.from(s, 'binary').toString('base64')
globalThis.atob = s => Buffer.from(s, 'base64').toString('binary')
const E = await import('./_core.mjs')
unlinkSync('sim/_core.mjs')

/* ---- the constants have to relate to each other sensibly -------------- */
group('constants')
test('the resource pools are ordered as the design says', () => {
  ok(E.PSYCHE_MAX > E.DOUBT_AT, 'doubt must be reachable but not immediate')
  ok(E.DOUBT_AT >= 1, 'doubt at zero would never fire')
  ok(E.RUN_SKIN > E.CAMP_SKIN, 'a camp must not refill the whole run')
  ok(E.ACT_SKIN > 0, 'crossing an act should give something back')
  ok(E.ATTEMPTS >= 2, 'projecting needs more than one go')
  eq(E.PROJECT_SKIN, 0, 'a project is priced in nodes, not skin — see v2.7')
})
test('the daylight cap is longer than a climb but shorter than a grind', () => {
  // added because a rest-heavy deck could hang on a boulder for 457 turns
  ok(E.TURN_CAP >= 20, 'a legitimate long boulder needs room')
  ok(E.TURN_CAP <= 60, 'the cap exists to stop the grind, not to permit it')
})
test('the deck rules are self-consistent', () => {
  ok(E.DECK_SIZE >= 10, 'a loadout must be a deck')
  ok(E.RARE_SLOTS < E.UNCOMMON_SLOTS, 'rares must be scarcer than uncommons')
  ok(E.RARE_SLOTS + E.UNCOMMON_SLOTS < E.DECK_SIZE, 'a loadout cannot be all rares')
  eq(E.copyLimit('rare'), 1, 'a rare should be a one-of')
  ok(E.copyLimit('common') > E.copyLimit('uncommon'), 'copy limits must fall with rarity')
})
test('prices are ordered by rarity', () => {
  ok(E.PRICE.common < E.PRICE.uncommon, 'uncommon must cost more')
  ok(E.PRICE.uncommon < E.PRICE.rare, 'rare must cost more')
  ok(E.CROP_COST > E.PRICE.common, 'a better shelf must cost more than a card')
  ok(E.cashForSend(9) > E.cashForSend(0), 'a hard send must pay more')
})

/* ---- the tables ------------------------------------------------------- */
group('tables')
test('no condition touches Power', () => {
  // stated as a rule since v0.7 and never once checked. A weather that moved
  // Power swung a battle 69 points and had to be reverted.
  for (const w of E.WEATHER) {
    ok(!('dPower' in w), `${w.name} touches Power`)
    ok(Math.abs(w.dBite ?? 0) <= 2, `${w.name} bites ${w.dBite}`)
    ok(Math.abs(w.dContact ?? 0) <= 2, `${w.name} shifts Contact by ${w.dContact}`)
  }
  for (const r of E.ROCK) ok(!('dPower' in r), `${r.name} touches Power`)
})
test('the map can always tell you what is coming', () => {
  // RUN-7. The map showed one tier at a time, so every choice was made blind
  // to what it was choosing between.
  for (let a = 0; a < E.ACTS.length; a++) {
    for (let t = 0; t < E.ACTS[a].length; t++) {
      const s = { ...E.freshRun(0, 0, 1), inRun: true, act: a, tier: t }
      const said = E.aheadSummary(s)
      ok(said.length > 3, `act ${a + 1} stage ${t + 1} says nothing about what is next`)
      ok(!said.includes('undefined'), `act ${a + 1} stage ${t + 1}: "${said}"`)
      // the last stage of a range has no tier after it and must say so
      if (t + 1 >= E.ACTS[a].length) eq(E.tierAhead(s).length, 0, 'a stage past the end of the act')
      else eq(E.tierAhead(s).length, E.ACTS[a][t + 1].length, 'the wrong stage was read ahead')
    }
  }
})
test('the boss warnings are true', () => {
  for (let a = 0; a < E.ACTS.length; a++) {
    const map = E.ACTS[a]
    // act 3 has two: the boss climb and the finale
    const bossTiers = map.map((t, i) => (t.some(n => n.type === 'boss') ? i : -1)).filter(i => i >= 0)
    if (!bossTiers.length) continue
    for (let t = 0; t < map.length; t++) {
      const s = { ...E.freshRun(0, 0, 1), inRun: true, act: a, tier: t }
      eq(E.bossNext(s), bossTiers.includes(t + 1), `act ${a + 1} stage ${t + 1}: wrong boss-next`)
      const next = bossTiers.find(b => b > t)
      eq(E.bossAhead(s), next !== undefined, `act ${a + 1} stage ${t + 1}: wrong boss-ahead`)
      // a promised camp has to actually be there, before the next boss
      if (E.campBeforeBoss(s)) {
        let found = false
        for (let k = t + 1; k < (next ?? map.length); k++)
          if (map[k].some(n => n.type === 'camp')) found = true
        ok(found, `act ${a + 1} stage ${t + 1} promises a camp that is not there`)
      }
    }
  }
})

test('every act is named and mapped', () => {
  eq(E.ACT_NAMES.length, E.ACTS.length, 'an act has no name')
  for (const map of E.ACTS) {
    ok(map.length >= 5, 'an act is too short to be an act')
    for (const tier of map) ok(tier.length >= 1, 'a tier with nothing in it')
  }
  ok(E.ACT1_MAP.length > 0, 'act 1 map is empty')
})
test('no two rungs of the ladder are the same climb', () => {
  // SIM-4: Headpoint and Flash returned identical numbers to the turn for
  // eight versions — Flash's only effect was on resting, and the harness never
  // rested. Measured completion cannot catch this (two different mechanics can
  // coincide inside the sampling error), so this checks the mods themselves.
  const seen = new Map()
  for (let i = 0; i < E.ASCENT.length; i++) {
    const m = E.styleMods(i)
    const key = JSON.stringify([m.dBite, m.dGrip, m.skin, m.attempts, m.camp, m.noBeta, !!m.noSharpen])
    ok(!seen.has(key), `${E.ASCENT[i].name} is mechanically identical to ${seen.get(key)}`)
    seen.set(key, E.ASCENT[i].name)
  }
  // and every rung above the first must add something of its own
  for (let i = 1; i < E.ASCENT.length; i++) {
    const a = E.ASCENT[i]
    const adds = a.dBite || a.dGrip || a.skin || a.attempts || a.camp || a.noBeta || a.noSharpen
    ok(adds, `${a.name} adds nothing to the rung below it`)
  }
})

test('the ascent ladder only gets harder', () => {
  let prev = null
  for (let i = 0; i < E.ASCENT.length; i++) {
    const m = E.styleMods(i)
    const harder = (m.dBite ?? 0) + (m.dGrip ?? 0) - (m.skin ?? 0) - (m.attempts ?? 0)
      + (m.noBeta ? 2 : 0)
    if (prev !== null) ok(harder >= prev, `${E.ASCENT[i].name} is not harder than the rung below`)
    prev = harder
  }
  eq(E.styleMods(0).dBite ?? 0, 0, 'the first rung should be the plain route')
})
test('rarity buckets partition the pool', () => {
  const all = Object.keys(E.CARDS)
  const buckets = ['starter', 'common', 'uncommon', 'rare', 'curse', 'beta']
  const seen = new Set()
  for (const b of buckets) for (const n of E.BY_RARITY(b)) {
    ok(!seen.has(n), `${n} is in two rarity buckets`)
    seen.add(n)
  }
  eq(seen.size, all.length, `${all.length - seen.size} cards belong to no bucket`)
})
test('every tag has a display name', () => {
  const used = new Set()
  for (const n of Object.keys(E.CARDS)) {
    const t = E.tagOf(E.spawn(n))
    if (t) used.add(t)
  }
  for (const t of used) ok(E.TAG_NAMES[t], `tag "${t}" has no name`)
  ok(E.SYNERGY_PER >= 2, 'a synergy threshold of 1 is not a theme')
})
test('the tutorial is a fixed, teachable thing', () => {
  eq(E.TUTORIAL_DECK.length >= 10, true, 'the tutorial deck is too small to draw from')
  const tut = E.ROUTES.find(r => r.tutorial)
  eq(E.TUTORIAL_STEPS.length, tut.holds.length, 'a hold with no lesson, or a lesson with no hold')
  for (const s of E.TUTORIAL_STEPS) ok(s.length > 20, 'a lesson too short to teach anything')
})
test('the journal and its gear are complete', () => {
  for (let i = 1; i <= E.JOURNAL.length; i++)
    ok(E.JOURNAL.some(p => p.id === i), `journal page ${i} is missing`)
  const slots = new Set(E.GEAR.map(g => g.slot))
  for (const s of slots) ok(E.GEAR.filter(g => g.slot === s).length >= 2,
    `slot ${s} has only one piece of gear, so it is never a choice`)
  for (const g of E.GEAR) ok(E.gearById(g.id) === g, `gearById cannot find ${g.id}`)
  for (const b of E.BOONS) ok(E.boonById(b.id) === b, `boonById cannot find ${b.id}`)
  for (const m of E.MUTATORS) ok(E.mutById(m.id) === m, `mutById cannot find ${m.id}`)
  for (const q of E.SEQUENCES) {
    ok(E.seqById(q.id) === q, `seqById cannot find ${q.id}`)
    ok(E.seqNeedText(q).length > 3, `${q.id} cannot describe what it needs`)
  }
})

/* ---- the boundary between the rules and the screens ------------------ */
group('boundary')
test('the engine knows nothing about a screen', () => {
  // ENG-8. The whole point of the split: if the rules can reach the DOM, the
  // boundary is decorative and the next state-shape bug hides in the seam.
  const src = readFileSync('src/engine.ts', 'utf8')
  const forbidden = [
    [/className=/, 'JSX className'],
    [/<\/[A-Za-z]/, 'a closing JSX tag'],
    [/\bfrom ['"]react/, 'a react import'],
    [/\buse(State|Effect|Memo|Ref|Callback)\s*\(/, 'a React hook'],
    [/\bdocument\./, 'the DOM'],
    [/\bwindow\./, 'the window'],
  ]
  for (const [re_, what] of forbidden)
    ok(!re_.test(src), `the engine reaches for ${what}`)
})
test('every screen you can back out of knows where it came from', () => {
  // BACK used to drop you to the menu from anywhere, so leaving the collection
  // meant walking back in through THE BOOKS to see the next thing
  const src = readFileSync('src/App.tsx', 'utf8')
  const m = /const BACK_TO[^=]*= \{([\s\S]*?)\n  \}/.exec(src)
  ok(m, 'there is no back hierarchy at all')
  const back = Object.fromEntries([...m[1].matchAll(/(\w+): '(\w+)'/g)].map(x => [x[1], x[2]]))
  // any screen rendering a BACK control must be in it
  const withBack = new Set()
  for (const blk of src.split(/if \(st\.phase === '/).slice(1)) {
    const name = blk.slice(0, blk.indexOf("'"))
    if (/goBack/.test(blk.slice(0, 4000))) withBack.add(name)
  }
  for (const n of withBack) ok(back[n], `${n} has a BACK button but no parent`)
  // and no parent may be a screen that does not exist
  const screens = new Set([...src.matchAll(/st\.phase === '(\w+)'/g)].map(x => x[1]))
  for (const [k, v] of Object.entries(back)) {
    ok(screens.has(v), `${k} backs out to ${v}, which is not a screen`)
    ok(k !== v, `${k} backs out to itself`)
  }
  // and the hierarchy must terminate at the menu rather than loop
  for (const k of Object.keys(back)) {
    let cur = k, hops = 0
    while (back[cur] && hops++ < 10) cur = back[cur]
    eq(cur, 'menu', `${k} never reaches the menu — it goes round in a circle`)
  }
})
test('nothing interactive is unreachable without a pointer', () => {
  // thirty-five tappable divs had no role, no tab stop and no key handler
  const src = readFileSync('src/App.tsx', 'utf8')
  const bare = [...src.matchAll(/<(?:div|span)\b[^>]*?onClick=/g)]
    .filter(m => !/stopPropagation/.test(src.slice(m.index, m.index + 200)))
  eq(bare.length, 0, `${bare.length} elements are clickable but not focusable`)
  ok(/role: 'button' as const/.test(src), 'the tap helper does not give a role')
  ok(/e\.key === 'Enter'/.test(src), 'nothing responds to the keyboard')
  ok(/focus-visible/.test(src), 'a keyboard user cannot see where they are')
})
test('the game announces itself', () => {
  const src = readFileSync('src/App.tsx', 'utf8')
  ok(/aria-live="polite"/.test(src), 'the spotter is not announced')
  ok(/aria-live="assertive"/.test(src), 'the result of a turn is not announced')
  ok(/role="meter"/.test(src), 'the pump meter has no role')
  // most labels are passed as the second argument to `tap`, not written inline
  const inline = (src.match(/aria-label/g) ?? []).length
  const viaTap = (src.match(/\{\.\.\.tap\([\s\S]{0,400}?,\s*[`'"]/g) ?? []).length
  ok(inline + viaTap >= 8,
    `only ${inline + viaTap} labelled controls (${inline} inline, ${viaTap} via tap)`)
  // and the three that matter most must be labelled
  ok(/LANE_NAMES\[i\]\} hold:/.test(src), 'the route side of the board is unlabelled')
  ok(/LANE_NAMES\[i\]\}: your/.test(src), 'your side of the board is unlabelled')
  ok(/\$\{c\.name\}\. \$\{c\.kind === 'move'/.test(src), 'cards in hand are unlabelled')
})

test('a card can show its own name', () => {
  // reported from a real device: names and rules text ran off the card, because
  // the fan overlapped each card by more than its right padding
  const src = readFileSync('src/App.tsx', 'utf8')
  const num = (re_) => { const m = re_.exec(src); return m ? Number(m[1]) : NaN }
  const width = num(/\.card\{position:relative;width:calc\((\d+)px/)
  const padR = num(/padding:6px (\d+)px 6px \d+px/)
  const padL = num(/padding:6px \d+px 6px (\d+)px/)
  const lap = num(/margin-left:-(\d+)px/)
  ok(Number.isFinite(width) && Number.isFinite(lap), 'could not read the card geometry')
  const content = width - padL - padR
  const visible = width - lap
  ok(content <= visible,
    `a card hides ${content - visible}px of its own content behind the next one`)
  ok(content >= 85, `${content}px of content is too narrow for the longest card names`)
  // the inked border must be drawn at the width the card actually is
  const ink = num(/<Ink w=\{(\d+)\} h=\{124\} seed=\{c\.uid\}/)
  eq(ink, width, 'the border is drawn at a different width from the card')
})
test('the resolve preview sits inside the slot', () => {
  const src = readFileSync('src/App.tsx', 'utf8')
  const m = /\.pv\{[^}]*bottom:(-?\d+)px/.exec(src)
  ok(m, 'could not find the preview line')
  ok(Number(m[1]) > 20, `the preview sits at ${m[1]}px, on top of the lane label below it`)
})

test('the hardware back button is handled', () => {
  // on an installed PWA an unhandled back press closes the game
  const src = readFileSync('src/App.tsx', 'utf8')
  ok(/addEventListener\('popstate'/.test(src), 'nothing listens for a back press')
  ok(/pushState/.test(src), 'no history entry is pushed, so there is nothing to pop')
})

test('the screens do not define the rules', () => {
  const src = readFileSync('src/App.tsx', 'utf8')
  for (const fn of ['resolve', 'startBurn', 'endSession', 'buildRoute', 'cardValue'])
    ok(!new RegExp(`^(export )?function ${fn}\\b`, 'm').test(src),
      `${fn} is defined in the screens rather than the engine`)
  ok(/from '\.\/engine'/.test(src), 'the screens do not import the engine at all')
})

/* ---- the curves ------------------------------------------------------- */
group('curves')
test('levelling costs more each time and never stalls', () => {
  let prev = 0
  for (let l = 1; l <= 40; l++) {
    const n = E.xpToNext(l)
    ok(n > prev, `level ${l} costs no more than the one before`)
    ok(n < 2000, `level ${l} costs ${n} — the curve has run away`)
    prev = n
  }
})
test('levelling up grants cards and carries the remainder', () => {
  const rng = new E.RNG(4)
  const before = { ...E.freshRun(0, 0, 1), level: 1, xp: 0, owned: [] }
  const after = E.gainXp(before, E.xpToNext(1) + 5, rng)
  eq(after.level, 2, 'did not level')
  eq(after.xp, 5, 'the remainder was thrown away')
  ok(after.packCards.length > 0, 'levelling granted no cards')
  const flat = E.gainXp(before, 1, rng)
  eq(flat.level, 1, 'levelled on one point of xp')
})
test('a pack always reaches for something you do not own', () => {
  // BAL-2: the roll picked a rarity first and only then preferred what you
  // lacked, so once the commons were collected 60% of every pack could not
  // give you anything new. 95% of the pool took 127 runs; it now takes 33.
  const rng = new E.RNG(12)
  const commons = E.BY_RARITY('common')
  // own every common: a pack must now reach past them every single time
  for (let i = 0; i < 300; i++) {
    const c = E.rollPackCard(rng, commons)
    ok(c, 'a pack came back empty')
    ok(c.rarity !== 'common', 'a pack offered a common when every common was owned')
  }
  // own everything: it must still return a card rather than nothing
  const all = [...E.BY_RARITY('common'), ...E.BY_RARITY('uncommon'), ...E.BY_RARITY('rare')]
  const c = E.rollPackCard(rng, all)
  ok(c && c.name, 'a pack returned nothing once the pool was complete')
})
test('the collectable pool is actually collectable', () => {
  const reach = new Set([...E.BY_RARITY('common'), ...E.BY_RARITY('uncommon'), ...E.BY_RARITY('rare')])
  const owned = new Set(E.BY_RARITY('starter'))
  for (const n of Object.keys(E.CARDS)) {
    const r = E.CARDS[n].rarity ?? 'common'
    if (r === 'curse' || r === 'beta') continue     // curses are given, beta comes from the journal
    ok(reach.has(n) || owned.has(n), `${n} can never be collected or started with`)
  }
})

test('a level-up cannot hand you a curse', () => {
  const rng = new E.RNG(11)
  for (let i = 0; i < 60; i++) {
    const s = E.gainXp({ ...E.freshRun(0, 0, i), level: 1, xp: 0, owned: [] },
      E.xpToNext(1) + 1, rng)
    for (const c of s.packCards) ok(c.rarity !== 'curse' && c.rarity !== 'beta',
      `a level-up offered a ${c.rarity}`)
  }
})
test('a camp restores less than a run needs', () => {
  const s = { ...E.freshRun(0, 0, 1), inRun: true, style: 0 }
  ok(E.campSkinFor(s) > 0, 'a camp gives nothing back')
  ok(E.campSkinFor(s) < E.RUN_SKIN, 'a camp refills the entire run')
  ok(E.PSYCHE_CAMP > 0 && E.PSYCHE_CAMP < E.PSYCHE_MAX,
    'a camp must restore some psyche but not all of it')
  ok(E.TOPROPE_SKIN > 0 && E.TOPROPE_SKIN < E.RUN_SKIN,
    'the toprope allowance must help without replacing the run')
})

/* ---- the small pure functions ---------------------------------------- */
group('functions')
test('a loadout becomes a deck of the right size', () => {
  for (const a of E.ARCHETYPES) {
    const d = E.loadoutDeck(a.loadout)
    eq(d.length, a.loadout.length, `${a.name}: loadout and deck disagree`)
    eq(new Set(d.map(c => c.uid)).size, d.length, `${a.name}: two cards share a uid`)
    ok(d.filter(c => c.lane === 'feet').length >= 2, `${a.name} cannot cover the feet lane`)
  }
})
test('spawn and synth produce complete cards', () => {
  for (const n of Object.keys(E.CARDS)) {
    const c = E.spawn(n)
    eq(typeof c.uid, 'number', `${n} has no uid`)
    eq(typeof c.power, 'number', `${n} has no power`)
    eq(typeof c.contact, 'number', `${n} has no contact`)
    ok(c.power >= 0 && c.contact >= 0, `${n} has a negative stat`)
  }
  ok(E.spawn('Crimp Grip').uid !== E.spawn('Crimp Grip').uid, 'two spawns share a uid')
  // synth makes a bare test card from a stat line — used by the balance probes
  const made = E.synth(2, 5)
  eq(made.power, 2, 'synth lost the power')
  eq(made.contact, 5, 'synth lost the contact')
  eq(made.kind, 'move', 'synth did not make a move')
  eq(typeof made.uid, 'number', 'synth made a card with no uid')
  eq(made.shed, 0, 'synth did not default the untouched fields')
  ok(E.synth(1, 1).uid !== E.synth(1, 1).uid, 'two synths share a uid')
})
test('sharpening improves a card and is idempotent', () => {
  for (const n of Object.keys(E.CARDS).slice(0, 40)) {
    const base = E.spawn(n), up = E.upgrade(base)
    ok(up.name.endsWith('+'), `${n} does not read as sharpened`)
    const twice = E.upgrade(up)
    eq(twice.name, up.name, `${n} can be sharpened twice`)
    const better = up.power > base.power || up.contact > base.contact
      || up.shed > base.shed || up.cost < base.cost || up.draw > base.draw
      || up.gripCut > base.gripCut || up.powerAll > base.powerAll || up.restore > base.restore
    ok(better, `${n}+ is no better than ${n}`)
  }
})
test('procedural routes are always climbable', () => {
  const rng = new E.RNG(31)
  for (let i = 0; i < 300; i++) {
    for (const r of [E.skirmishRoute(1 + (i % 20), rng), E.circuitRoute(i % 25, rng)]) {
      ok(r.clear >= 3, `${r.name}: ${r.clear} holds`)
      ok(r.crux < r.clear, `${r.name}: more cruxes than holds`)
      ok(r.grade >= 0 && r.grade <= 10, `${r.name}: grade ${r.grade}`)
      ok(r.name.length > 2 && r.note.length > 5, `${r.name}: no name or note`)
    }
  }
  ok(E.circuitRoute(20, rng).grade > E.circuitRoute(0, rng).grade, 'the circuit does not escalate')
})
test('the forecast is deterministic, varied and bounded', () => {
  const s = { ...E.freshRun(0, 0, 999), act: 0, tier: 2, reroll: 0 }
  eq(JSON.stringify(E.forecastFor(s)), JSON.stringify(E.forecastFor(s)), 'not deterministic')
  ok(JSON.stringify(E.forecastFor(s)) !== JSON.stringify(E.forecastFor({ ...s, reroll: 1 })),
    'waiting a day changes nothing')
  const seen = new Set()
  for (let i = 0; i < 500; i++)
    for (const f of E.forecastFor({ ...s, seed: i })) {
      ok(f.weather >= 0 && f.weather < E.WEATHER.length, 'weather out of range')
      ok(f.rock >= 0 && f.rock < E.ROCK.length, 'rock out of range')
      seen.add(f.weather)
    }
  eq(seen.size, E.WEATHER.length, 'some weather never appears')
  const scores = E.WEATHER.map((_, i) => E.forecastScore({ weather: i, rock: 0 }))
  ok(Math.max(...scores) > Math.min(...scores), 'every forecast scores the same')
})
test('every event is a decision, and one you can win', () => {
  // EVT-2. Priced in one currency: three events had every branch negative — a
  // tax with a menu — and `flood` had a spread of 0.4 between its two options,
  // which is not a choice. The curse field was missing from the first pricing,
  // which made two sharp events look flat.
  const W = { skin: 9, psyche: 6, cash: 0.12, xp: 0.02 }
  const worth = o => (o.skin ?? 0) * W.skin + (o.psyche ?? 0) * W.psyche
    + (o.cash ?? 0) * W.cash + (o.xp ?? 0) * W.xp
    + (o.card || o.cardRarity ? 7 : 0) + (o.boon ? 12 : 0)
    + (o.journal !== undefined ? 9 : 0) + (o.curse ? -11 : 0)
  for (const ev of E.EVENTS) {
    ok(ev.choices.length >= 2, `${ev.id} offers no choice at all`)
    const vals = ev.choices.map(c => worth(c.outcome))
    const lo = Math.min(...vals), hi = Math.max(...vals)
    ok(hi - lo > 1, `${ev.id}: every branch is worth about the same (${lo.toFixed(1)} to ${hi.toFixed(1)})`)
    for (const c of ev.choices) {
      ok(c.label.length > 3, `${ev.id} has a choice with no label`)
      ok((c.outcome.text ?? '').length > 15, `${ev.id}: a branch that says nothing`)
    }
  }
  // Bad news is legitimate — running out of water has no good branch, and the
  // choice is which cost you pay. It just must not be most of what you meet.
  const grim = E.EVENTS.filter(ev => Math.max(...ev.choices.map(c => worth(c.outcome))) <= 0)
  ok(grim.length / E.EVENTS.length < 0.25,
    `${grim.length} of ${E.EVENTS.length} events have no branch worth taking: ${grim.map(e => e.id).join(', ')}`)
})

test('an outcome can never push a resource out of range', () => {
  const rng = new E.RNG(5)
  for (const ev of E.EVENTS) for (const ch of ev.choices) {
    for (const cash of [0, 500]) for (const skin of [1, E.RUN_SKIN]) {
      const s = { ...E.freshRun(0, 0, 1), inRun: true, runDeck: [], cash, skin,
        psyche: E.PSYCHE_MAX, journal: [] }
      const out = E.applyOutcome(s, ch.outcome, rng)
      ok(out.skin >= 0, `${ev.id}: skin went to ${out.skin}`)
      ok(out.skin <= E.RUN_SKIN, `${ev.id}: skin exceeded the cap at ${out.skin}`)
      ok(out.cash >= 0, `${ev.id}: cash went to ${out.cash}`)
      ok(out.psyche >= 0 && out.psyche <= E.PSYCHE_MAX, `${ev.id}: psyche ${out.psyche}`)
    }
  }
})
test('the climb keeps enough to tell you what happened', () => {
  // the post-climb screen said "That is a send" and showed a raw log. It now
  // reports how close it got, which needs the peak to have been recorded.
  const rng = new E.RNG(23)
  let s = E.startBurn({ ...E.freshRun(6, 0, 5), inRun: true, skirmish: null, weather: 1,
    rock: 0, runDeck: E.DEFAULT_LOADOUT.map(E.spawn) }, rng)
  eq(s.peakPump, 0, 'a fresh burn starts with a peak already set')
  let highest = 0
  for (let t = 0; t < 25 && s.phase === 'climb'; t++) {
    s = E.autoPlay(s, rng); s = E.resolve(s, rng)
    highest = Math.max(highest, s.pump)
    ok(s.peakPump >= s.pump, 'the peak is below the current pump')
    ok(s.peakPump >= highest, `the peak dropped: ${s.peakPump} after reaching ${highest}`)
  }
  ok(s.peakPump <= E.PUMP_MAX, 'the peak went past the top of the meter')
  // and a new burn starts it again
  const next = E.startBurn({ ...s, phase: 'climb', burn: 2, peakPump: 99 }, rng)
  eq(next.peakPump, 0, 'the peak carried over from the last burn')
})

test('being high on a route costs more when it goes wrong', () => {
  // ENG-13. The last hold played exactly like the first. This is deliberately
  // not another bite ramp — bite compounds per turn and has wrecked the
  // balance four times — it changes what a mistake costs instead.
  const idx = E.ROUTES.findIndex(r => !r.tutorial && r.clear >= 8)
  const clear = E.ROUTES[idx].clear
  const at = c => ({ ...E.freshRun(idx, 0, 1), inRun: true, skirmish: null, cleared: c })
  ok(!E.exposed(at(0)), 'you are exposed standing on the ground')
  ok(!E.exposed(at(Math.floor(clear * 0.4))), 'exposed less than half way up')
  ok(E.exposed(at(clear)), 'not exposed at the top of the route')
  // and it must be monotonic — you cannot become less exposed by climbing
  let seen = false
  for (let c = 0; c <= clear; c++) {
    const e = E.exposed(at(c))
    ok(!(seen && !e), `exposure turned off again at ${c} of ${clear} holds`)
    seen = seen || e
  }
  eq(E.exposureOf(at(0)), 0, 'exposure does not start at nothing')
  eq(E.exposureOf(at(clear)), 1, 'exposure does not reach one at the top')
  // exposure costs on the bail only: a per-fall charge was measured twice and
  // both times it stopped being a sharpening and became a different game
  ok(E.EXPOSED_PSYCHE > 0, 'backing off high costs nothing')
  eq(E.EXPOSED_SKIN, 0, 'exposure charges skin per fall, which wrecks the run')
  eq(E.EXPOSED_FALL_PSYCHE, 0, 'exposure charges psyche per fall, which wrecks the run')
})

test('being pumped is worth something to part of the deck', () => {
  // ENG-16. Pump only ever went one way. `greedy` existed but was a binary +2
  // above pump 7 on two cards, which is not a mechanic, it is a footnote.
  const hold = { uid: 1, name: 'crimp', bite: 3, grip: 12, crux: false, clean: false }
  const base = { ...E.freshRun(4, 0, 1), inRun: true, skirmish: null,
    gear: [], boons: [], mutators: [], boardP: [null, null, null] }
  const greedy = Object.keys(E.CARDS).filter(n => E.CARDS[n].fx === 'greedy')
  ok(greedy.length >= 5, `only ${greedy.length} cards want you pumped`)
  const c = E.spawn(greedy[0])
  const at = pump => E.powerAgainst({ ...base, pump }, c, hold, 0)
  ok(at(9) > at(0), 'a greedy move is no better when you are cooked')
  // and it must be a slope, not a cliff
  const steps = [0, 3, 6, 9].map(at)
  for (let i = 1; i < steps.length; i++)
    ok(steps[i] >= steps[i - 1], `power fell going from more pump to less at step ${i}`)
  ok(new Set(steps).size >= 3, `only ${new Set(steps).size} distinct values across the meter — still a cliff`)
  // a plain move must not care
  const plain = E.spawn('Crimp Grip')
  eq(E.powerAgainst({ ...base, pump: 0 }, plain, hold, 0),
     E.powerAgainst({ ...base, pump: 9 }, plain, hold, 0),
     'a plain move changed with the pump')
  // it argues with the dyno, which is the whole point
  ok(E.stickChance({ ...base, pump: 0 }) > E.stickChance({ ...base, pump: 9 }),
    'dynos and greedy moves both want the same pump, so there is no tension')
})

test('opposition makes which hand a question', () => {
  // ENG-12. Left and right were interchangeable, so a three-lane board was a
  // two-lane one. A sideways pull is weak alone and strongest when the other
  // hand is pulling back against it.
  const hold = { uid: 1, name: 'crimp', bite: 3, grip: 9, crux: false, clean: false }
  const base = { ...E.freshRun(4, 0, 1), inRun: true, skirmish: null,
    gear: [], boons: [], mutators: [] }
  const opp = Object.keys(E.CARDS).filter(n => E.CARDS[n].opposes)
  ok(opp.length >= 8, `only ${opp.length} moves need opposition`)
  const g = E.spawn(opp[0]), plain = E.spawn('Crimp Grip')
  ok(!plain.opposes, 'the control card opposes, which spoils the comparison')
  const at = boardP => E.powerAgainst({ ...base, boardP }, g, hold, 0)
  const alone = at([g, null, null]), withAny = at([g, plain, null])
  const paired = at([g, E.spawn(opp[1]), null])
  ok(alone < withAny, 'a sideways pull is no weaker with nothing to pull against')
  ok(paired > withAny, 'two opposing hands are worth no more than one')
  // and a plain move must not care either way
  const p = boardP => E.powerAgainst({ ...base, boardP }, plain, hold, 0)
  eq(p([plain, null, null]), p([plain, g, null]), 'a plain move changed with the other hand')
  // every opposing move must say so on its face
  for (const n of opp) ok(/Opposition/.test(E.CARDS[n].text ?? ''),
    `${n} needs opposition and does not say so`)
})

test('the route telegraphs, then acts, exactly once', () => {
  // ENG-11. A move announced one turn and applied the next — if it can fire
  // twice it is a hidden penalty rather than a fight you can read.
  const rng = new E.RNG(31)
  const before = { uid: 1, name: 'crimp', bite: 3, grip: 9, crux: false, clean: false }
  const s = { ...E.freshRun(6, 0, 5), inRun: true, skirmish: null,
    boardH: [before, { ...before, uid: 2 }, null], boardP: [null, null, null] }
  const move = { kind: 'grease', lane: 0, text: 'x' }
  const once = E.applyRouteMove(move, s.boardH)
  eq(once.boardH[0].grip, 9 + E.MOVE_GRIP, 'greasing did not make the hold harder')
  eq(once.boardH[1].grip, 9, 'a move on one lane touched another')
  const dry = E.applyRouteMove({ kind: 'dry', lane: 0, text: 'x' }, s.boardH)
  ok(dry.boardH[0].grip < 9, 'drying out did not make the hold easier')
  const gust = E.applyRouteMove({ kind: 'gust', lane: 0, text: 'x' }, s.boardH)
  ok(gust.boardH[0].bite > 3 && gust.boardH[1].bite > 3, 'a gust must reach every lane')
  // a move never survives the turn it lands on
  let b = E.startBurn({ ...E.freshRun(6, 0, 5), inRun: true, skirmish: null, weather: 1,
    rock: 0, runDeck: E.DEFAULT_LOADOUT.map(E.spawn) }, rng)
  for (let t = 0; t < 20 && b.phase === 'climb'; t++) {
    const pending = b.routeMove
    b = E.autoPlay(b, rng); b = E.resolve(b, rng)
    if (pending) ok(b.routeMove !== pending, 'a telegraphed move was still pending after it landed')
  }
})
test('a telegraph is information, so the preview must use it', () => {
  // the preview is verified 100% accurate elsewhere; a move it could not see
  // would make it lie about a turn the player was told about in advance
  const rng = new E.RNG(7)
  const b = E.startBurn({ ...E.freshRun(6, 0, 5), inRun: true, skirmish: null, weather: 1,
    rock: 0, runDeck: E.DEFAULT_LOADOUT.map(E.spawn) }, rng)
  const withMove = { ...b, routeMove: { kind: 'grease', lane: 0, text: 'x' } }
  if (b.boardH[0]) {
    const plain = E.previewLane(b, 0), moved = E.previewLane(withMove, 0)
    ok(JSON.stringify(plain) !== JSON.stringify(moved),
      'the preview reads the same whether or not the route is about to act')
  }
})

test('a hold you have not been on does not read exactly', () => {
  // ENG-10. UX-4 made the preview 100% accurate, which quietly cost a stated
  // pillar: a turn you can read exactly is arithmetic, not a gamble. The
  // numbers are still exact underneath — this is what may be SEEN.
  const rng = new E.RNG(11)
  const s = E.startBurn({ ...E.freshRun(6, 0, 5), inRun: true, skirmish: null, weather: 1,
    rock: 0, runDeck: E.DEFAULT_LOADOUT.map(E.spawn), beta: [] }, rng)
  const all = [...s.holdDeck, ...s.boardH.filter(Boolean)]
  ok(all.length > 5, 'no holds to check')
  for (const h of all) {
    const g = E.gripShown(s, h)
    ok(!g.sure, `${h.name} reads exactly with no beta on it`)
    // the span must always contain the truth, and never give away which side
    const t = E.gripFor(s, h)
    ok(t >= g.lo && t <= g.hi, `${h.name}: truth ${t} is outside the span ${g.lo}–${g.hi}`)
    eq(g.hi - g.lo, E.WOBBLE, `${h.name}: a span of ${g.hi - g.lo} gives away which holds wobble`)
  }
  // and beta buys certainty — that is what projecting is for
  const worked = { ...s, beta: all.map(h => h.name) }
  for (const h of all) {
    const g = E.gripShown(worked, h)
    ok(g.sure, `${h.name} still reads as a span after you have worked it`)
    eq(g.lo, E.gripFor(worked, h), `${h.name} reads a number that is not its grip`)
  }
})
test('the wobble is rolled from the run seed, not at render', () => {
  const build = () => {
    const rng = new E.RNG(11)
    return E.startBurn({ ...E.freshRun(6, 0, 5), inRun: true, skirmish: null, weather: 1,
      rock: 0, runDeck: E.DEFAULT_LOADOUT.map(E.spawn), beta: [] }, rng)
  }
  eq(JSON.stringify(build().holdDeck.map(h => [h.grip, h.wobble ?? 0])),
     JSON.stringify(build().holdDeck.map(h => [h.grip, h.wobble ?? 0])),
     'the same seed produced a different route — seed sharing is broken')
})

test('the acts get structurally harder, not just higher-graded', () => {
  // BAL-10: act 1 to act 3 raised the mean hold count by 17% while the grade
  // tripled — and bumpFor saturates at V6, so the later acts were barely
  // harder in the one dimension that dominates.
  const byAct = [0, 1, 2].map(a =>
    E.ROUTES.filter((_, i) => E.ACT_OF_ROUTE[i] === a).filter(r => !r.tutorial))
  const mean = (rs, f) => rs.reduce((x, r) => x + f(r), 0) / rs.length
  const holds = byAct.map(rs => mean(rs, r => r.clear))
  const crux = byAct.map(rs => mean(rs, r => r.crux))
  for (let a = 1; a < 3; a++) {
    ok(holds[a] > holds[a - 1] + 1,
      `act ${a + 1} is only ${(holds[a] - holds[a - 1]).toFixed(1)} holds longer than act ${a}`)
  }
  ok(crux[2] > crux[0], 'the last act has no more cruxes than the first')
  // and no route may be so long it cannot finish inside the daylight
  for (const r of E.ROUTES) ok(r.clear < E.TURN_CAP - 6,
    `${r.name} needs ${r.clear} holds against a ${E.TURN_CAP}-turn day`)
})

test('every generator scales its length with its grade', () => {
  // faRoute did not, so a V3 first ascent and a V10 one were the same length.
  // The grade cannot do its work through the difficulty bump, which saturates
  // at V6 on purpose — so it has to do it here.
  const rng = new E.RNG(17)
  const gen = {
    faRoute: g => { for (let i = 0; i < 400; i++) { const r = E.faRoute(g, rng); if (r) return r } },
  }
  const sample = (fn, n) => {
    const out = []
    for (let i = 0; i < 200; i++) out.push(fn(n))
    return out.reduce((a, r) => a + r.clear, 0) / out.length
  }
  const low = sample(a => E.faRoute(0, rng), 0)
  const high = sample(a => E.faRoute(2, rng), 2)
  ok(high > low + 1.5,
    `an unclimbed line is ${low.toFixed(1)} holds in act 1 and ${high.toFixed(1)} in act 3`)
  // and the other two must keep doing it
  const cLow = sample(() => E.circuitRoute(2, rng)), cHigh = sample(() => E.circuitRoute(14, rng))
  ok(cHigh > cLow + 1.5, 'the circuit stopped scaling with its grade')
  const sLow = sample(() => E.skirmishRoute(2, rng)), sHigh = sample(() => E.skirmishRoute(12, rng))
  ok(sHigh > sLow + 1.5, 'skirmish stopped scaling with its grade')
})

test('a line you put up reads at your grade and climbs at its own', () => {
  const e = { name: 'Quiet Arete', claimed: 5, real: 8, act: 1, burns: 3,
    style: 'compression', clear: 9, crux: 2, feet: 'normal' }
  const r = E.specFromEstablished(e)
  eq(E.gradeLabel(r), 'V5', 'it does not read at the grade you claimed')
  eq(r.grade, 8, 'it does not climb at the grade it actually is')
  ok(r.note.length > 10, 'a sandbagged line says nothing about itself')
  ok(E.specFromEstablished({ ...e, claimed: 8 }).note !==
     E.specFromEstablished({ ...e, claimed: 11 }).note, 'honest and sprayed read the same')
})
test('an old save without the shape still builds a climbable line', () => {
  // `established` predates the style/clear/crux fields by one version
  const bare = { name: 'Old One', claimed: 6, real: 6, act: 0, burns: 2 }
  const r = E.specFromEstablished(bare)
  ok(r.clear >= 4 && r.crux < r.clear, 'a save from before the shape was stored is unclimbable')
  ok(r.style && r.feet, 'the line has no style or feet pool')
})
test('nothing a player creates touches the route table', () => {
  // appending to ROUTES is what pointed the finale at the tutorial in v3.2
  const before = E.ROUTES.length
  const finaleIdx = E.ACTS[E.ACTS.length - 1].at(-1)[0].routeIdx
  E.specFromEstablished({ name: 'X', claimed: 1, real: 1, act: 0, burns: 1 })
  eq(E.ROUTES.length, before, 'establishing a line changed the route table')
  eq(E.ACTS[E.ACTS.length - 1].at(-1)[0].routeIdx, finaleIdx, 'the finale index moved')
  ok(E.ROUTES[finaleIdx].finale, 'the finale node no longer points at the finale')
})
test('your lines only appear in the range you found them', () => {
  const s = { ...E.freshRun(0, 0, 1), established: [
    { name: 'A', claimed: 4, real: 4, act: 0, burns: 1 },
    { name: 'B', claimed: 7, real: 7, act: 2, burns: 1 }] }
  eq(E.establishedIn(s, 0).length, 1, 'act 1 shows the wrong number of your lines')
  eq(E.establishedIn(s, 1).length, 0, 'a line leaked into an act it was not found in')
  eq(E.establishedIn(s, 2)[0].name, 'B', 'act 3 shows the wrong line')
})

test('a named hold appears exactly once, and never on a route without one', () => {
  const rng = new E.RNG(4)
  for (const r of E.ROUTES) {
    const s = E.startBurn({ ...E.freshRun(E.ROUTES.indexOf(r), 0, 5), inRun: true,
      skirmish: null, weather: 1, rock: 0, runDeck: E.DEFAULT_LOADOUT.map(E.spawn) }, rng)
    const all = [...s.holdDeck, ...s.boardH.filter(Boolean)]
    const named = all.filter(h => h.sig)
    if (!r.signature) { eq(named.length, 0, `${r.name} has a named hold it was not given`); continue }
    eq(named.length, 1, `${r.name}: ${named.length} of ${r.signature}`)
    ok(!named[0].crux, `${r.name}: the named hold was written over by a crux`)
    eq(named[0].sig, r.signature, `${r.name} has the wrong named hold`)
  }
})
test('every signature is real, named and used at most once', () => {
  const used = E.ROUTES.map(r => r.signature).filter(Boolean)
  eq(new Set(used).size, used.length, 'two routes share a named hold')
  for (const id of used) ok(E.sigById(id), `${id} is not a signature`)
  for (const sig of E.SIGNATURES) {
    ok(E.HOLD_STATS[sig.base], `${sig.id} is based on a hold type that does not exist`)
    ok(sig.name.length > 3 && sig.note.length > 20, `${sig.id} has no name or no line`)
    const changes = sig.dGrip || sig.dBite || sig.ability
    ok(changes, `${sig.id} is just its base hold with a name on it`)
  }
})
test('the preview and resolve read a hold the same way', () => {
  // ROUTE-5 gave named holds their own abilities and taught `abilityOf` about
  // them. The preview was still reading HOLD_STATS directly, so it was blind
  // to every signature hold's ability from v8.0 until this was found.
  const src = readFileSync('src/engine.ts', 'utf8')
  const previews = src.slice(src.indexOf('export function previewLane'),
    src.indexOf('export function previewPump'))
  ok(/const ab = abilityOf\(hold\)/.test(previews),
    'the preview works out a hold ability by hand instead of asking abilityOf')
  ok(!/HOLD_STATS\[hold\.name\]\?\.ability/.test(previews),
    'the preview still reads HOLD_STATS directly, which misses named holds')
  // and the two must agree on every hold in the game, named or not
  for (const sig of E.SIGNATURES) {
    const h = { uid: 1, name: sig.base, bite: 3, grip: 6, crux: false, clean: false, sig: sig.id }
    if (sig.ability) eq(E.abilityOf(h), sig.ability, `${sig.id} does not carry its own ability`)
    eq(E.abilityOf({ ...h, clean: true }), '', `${sig.id} keeps its ability after a brush`)
  }
})

test('a named hold reads as itself', () => {
  const plain = { uid: 1, name: 'crimp', bite: 3, grip: 5, crux: false, clean: false }
  eq(E.holdLabel(plain), 'crimp', 'a plain hold lost its name')
  const named = { ...plain, sig: 'rattler' }
  eq(E.holdLabel(named), 'The Rattler', 'a named hold does not use its name')
  eq(E.abilityOf(named), 'Sharp', 'a named hold does not carry its own ability')
  eq(E.abilityOf({ ...named, clean: true }), '', 'brushing did not strip a named hold')
})

test('an unclimbed line tells you nothing and is filthy', () => {
  const rng = new E.RNG(3)
  for (let a = 0; a < 3; a++) for (let i = 0; i < 40; i++) {
    const r = E.faRoute(a, rng)
    eq(E.gradeLabel(r), '?', 'an unclimbed line showed its grade')
    ok(r.fa === true, 'the route is not flagged as a first ascent')
    ok(r.grade >= 0 && r.grade <= 10, `grade ${r.grade} is outside the scale`)
    ok(r.crux < r.clear, 'more cruxes than holds')
  }
  // the dirt is real, and only on new rock
  const fa = E.startBurn({ ...E.freshRun(0, 0, 3), inRun: true, weather: 1, rock: 0,
    skirmish: E.faRoute(1, rng), runDeck: E.DEFAULT_LOADOUT.map(E.spawn) }, rng)
  ok(fa.holdDeck.every(h => h.dirt === E.DIRT_GRIP), 'an unclimbed line is not dirty')
  const known = E.startBurn({ ...E.freshRun(4, 0, 3), inRun: true, weather: 1, rock: 0,
    skirmish: null, runDeck: E.DEFAULT_LOADOUT.map(E.spawn) }, rng)
  ok(known.holdDeck.every(h => !h.dirt), 'a known route came up dirty')
})
test('brushing takes the dirt off, once', () => {
  const h = { uid: 1, name: 'crimp', bite: 3, grip: 10, crux: false, clean: false, dirt: E.DIRT_GRIP }
  const c = E.clearDirt(h)
  eq(c.grip, 10 - E.DIRT_GRIP, 'brushing did not reduce the grip')
  eq(c.dirt, 0, 'the dirt is still there')
  eq(E.clearDirt(c).grip, c.grip, 'brushing twice cleaned it twice')
  const plain = { ...h, dirt: undefined }
  eq(E.clearDirt(plain).grip, plain.grip, 'brushing a clean hold made it easier')
})
test('the rock has an opinion about your grade', () => {
  const at = d => E.claimVerdict(7 + d, 7)
  ok(at(-2).toLowerCase().includes('sandbag'), 'undergrading is not called sandbagging')
  ok(at(2).toLowerCase().includes('spray'), 'overgrading is not called spraying')
  ok(at(0) !== at(1) && at(0) !== at(-1), 'the verdict does not distinguish a fair grade')
  for (const d of [-3, -2, -1, 0, 1, 2, 3]) ok(at(d).length > 10, `no verdict at ${d}`)
})

test('a line you have climbed remembers something, and only that', () => {
  const idx = 4, name = E.ROUTES[idx].name
  const mk = book => ({ ...E.freshRun(idx, 0, 7), inRun: true, skirmish: null, book,
    runDeck: E.DEFAULT_LOADOUT.map(E.spawn), beta: [] })
  eq(E.betaFromBook(mk({})).length, 0, 'an unclimbed line gave you beta')
  const once = E.betaFromBook(mk({ [name]: { sends: 1, bestBurn: 3, bestStyle: 0, flashed: false, weather: 0, rock: 0 } }))
  const more = E.betaFromBook(mk({ [name]: { sends: 3, bestBurn: 1, bestStyle: 0, flashed: true, weather: 0, rock: 0 } }))
  eq(once.length, 1, 'one send should be worth one move')
  ok(more.length > once.length, 'knowing a line better remembers no more of it')
  ok(more.length <= E.BOOK_BETA_MAX, 'the book remembers more than its own cap')
  eq(E.betaFromBook({ ...mk({}), skirmish: E.ROUTES[idx] }).length, 0,
    'a procedural line drew on the book')
})
test('ticking an act pays once and only once', () => {
  const lines = E.ROUTES.filter((_, i) => E.ACT_OF_ROUTE[i] === 0)
  const book = Object.fromEntries(lines.map(r =>
    [r.name, { sends: 1, bestBurn: 2, bestStyle: 0, flashed: false, weather: 0, rock: 0 }]))
  ok(E.actTicked(book, 0), 'a fully ticked act does not read as ticked')
  const partial = { ...book }; delete partial[lines[0].name]
  ok(!E.actTicked(partial, 0), 'a partly ticked act reads as complete')
  ok(!E.actTicked({}, 1), 'an empty book completed an act')
  ok(E.ACT_XP > 0, 'ticking an act pays nothing')
})

test('a send is written into the book correctly', () => {
  const s = { ...E.freshRun(3, 0, 1), inRun: true, skirmish: null, book: {},
    burn: 2, style: 1, weather: 0, rock: 1 }
  const first = E.logSend(s)
  const name = E.ROUTES[3].name
  eq(first[name].sends, 1, 'no send recorded')
  eq(first[name].flashed, false, 'a two-burn send counted as a flash')
  const second = E.logSend({ ...s, book: first, burn: 1, style: 0 })
  eq(second[name].sends, 2, 'the repeat was not counted')
  eq(second[name].bestBurn, 1, 'the better burn count was not kept')
  eq(second[name].bestStyle, 1, 'the better style was overwritten')
  eq(second[name].flashed, true, 'the flash was not recorded')
})
test('the shop stocks something you could actually buy', () => {
  const rng = new E.RNG(9)
  for (let i = 0; i < 60; i++) {
    const s = E.stockShop({ ...E.freshRun(0, 0, i), act: i % 3, gear: [], boons: [] }, rng)
    eq(s.phase, 'shop', 'stocking did not open the shop')
    eq(s.shopCards.length, 3, 'the shelf is the wrong size')
    for (const c of s.shopCards) ok(E.priceOf(c) > 0, `${c.name} is free`)
    eq(s.bought.length, 0, 'the shop opened with something already sold')
  }
})
test('leaving an event always moves you on', () => {
  const s = { ...E.freshRun(0, 0, 1), inRun: true, tier: 2, eventId: 'storm',
    eventResult: 'x', packCards: [] }
  const out = E.leaveEventStep(s)
  eq(out.tier, 3, 'the event did not advance the tier')
  eq(out.eventId, null, 'the event was not cleared')
  eq(out.phase, 'map', 'an event left you somewhere other than the map')
})
test('climbers unlock in order and the first is always available', () => {
  ok(E.archUnlocked(E.ARCHETYPES[0], 1), 'the starting climber is locked')
  for (let i = 1; i < E.ARCHETYPES.length; i++)
    ok(E.ARCHETYPES[i].unlock > E.ARCHETYPES[i - 1].unlock,
      `${E.ARCHETYPES[i].name} unlocks no later than the one before`)
  ok(!E.archUnlocked(E.ARCHETYPES[3], 1), 'the last climber is available at level 1')
})
test('a phase summary describes every phase a boss has', () => {
  for (const r of E.ROUTES.filter(r => r.phases?.length)) {
    const sum = E.phaseSummary(r)
    for (const p of r.phases) ok(sum.includes(p.name), `${r.name}: ${p.name} is not summarised`)
  }
  eq(E.phaseSummary(E.ROUTES[0]), '', 'a route with no phases summarised something')
})
test('inked paths are cached without changing', () => {
  for (const seed of [1, 77, 4096]) {
    eq(E.roughPath(84, 124, seed, 1.25, 3), E.buildRough(84, 124, seed, 1.25, 3),
      'the cached path differs from a freshly built one')
    ok(E.roughPath(84, 124, seed).length > 40, 'a path with almost nothing in it')
  }
  ok(E.roughPath(84, 124, 1) !== E.roughPath(84, 124, 2), 'every border is the same stroke')
})
test('an empty save slot reports empty rather than throwing', () => {
  eq(E.slotSummary(2), null, 'an untouched slot claims to hold a save')
  ok(E.activeSlot() >= 0, 'the active slot is not a slot')
  E.wipeSlot(2)
  eq(E.slotSummary(2), null, 'wiping an empty slot broke it')
})
test('tag counts add up to the tagged cards', () => {
  const deck = E.DEFAULT_LOADOUT.map(E.spawn)
  const counts = E.tagCounts(deck)
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  eq(total, deck.filter(c => E.tagOf(c)).length, 'the tally does not match the deck')
})

/* ---- report ---------------------------------------------------------- */
const pass = results.filter(r => r[0]).length
const fail = results.filter(r => !r[0])
let last = ''
for (const [okd, grp, name, msg] of results) {
  if (grp !== last) { console.log(`\n  ${grp}`); last = grp }
  console.log(`    ${okd ? '\u2713' : '\u2717'} ${name}`)
  if (!okd) console.log(`        ${msg}`)
}
console.log(`\n  ${pass}/${results.length} passed\n`)
process.exit(fail.length ? 1 : 0)
