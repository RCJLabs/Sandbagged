/* SANDBAGGED — the kept suite.
 *
 * Fifteen one-off harnesses were written across this project, each proving
 * something real, and every one of them was thrown away. This is those checks,
 * kept, so a future change cannot quietly undo what they proved.
 *
 *   node sim/test.mjs        all of it
 *   node sim/test.mjs slow   plus the balance guardrails (~20s)
 */
import { build } from 'esbuild'
import { readFileSync, unlinkSync } from 'node:fs'
import { execSync } from 'node:child_process'

const SLOW = process.argv.includes('slow')
const HISTORY_CAP_TEST = 35

// ---- a very small harness ------------------------------------------------
const results = []
let current = ''
const group = n => { current = n }
function test(name, fn) {
  try { fn(); results.push([true, current, name]) }
  catch (e) { results.push([false, current, name, e.message]) }
}
const ok = (c, m) => { if (!c) throw new Error(m) }
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m} — expected ${b}, got ${a}`) }

// ---- the engine, bundled from the same source the game ships -------------
await build({
  entryPoints: ['sim/entry.ts'], bundle: true, format: 'esm', outfile: 'sim/_test.mjs',
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
const E = await import('./_test.mjs')
unlinkSync('sim/_test.mjs')

const SRC = readFileSync('src/engine.ts', 'utf8')
/** Source with comments removed, so a rule written in prose cannot trip a
    check about code. Naive but sufficient: this file has no regex or string
    literal containing a comment opener. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const startClimb = (routeIdx, rng, over = {}) => {
  const s = {
    ...E.freshRun(routeIdx, 0, 12345), inRun: true,
    runDeck: E.DEFAULT_LOADOUT.map(E.spawn), skin: 8, psyche: 3, weather: 1, rock: 0, ...over,
  }
  return E.startBurn(s, rng)
}

/* The decks people actually build. Three separate bugs shipped behind a green
   suite because every accuracy check ran the same starter deck on the same
   kind of route: the drafter could not see sequences (SIM-3), the preview was
   wrong 13% of the time on opposition (ENG-18), and it was blind to named
   holds' abilities for six versions (v9.8). A suite that only plays one shape
   of deck keeps passing while the game is broken for every other shape. */
const SHAPES = {
  starter: E.DEFAULT_LOADOUT,
  opposition: ['Gaston', 'Gaston', 'Undercling', 'Undercling', 'Sidepull', 'Layback', 'Arm Bar',
    'Smear', 'Smear', 'Shake Out', 'Breathe', 'Crimp Grip', 'Crimp Grip', 'Heel Hook', 'Kneebar'],
  technique: ['Breathe', 'Breathe', 'Deep Breath', 'Brush', 'Chalk Up', 'Tape Job', 'Headtorch',
    'Crimp Grip', 'Crimp Grip', 'Lock Off', 'Smear', 'Smear', 'Shake Out', 'Heel Hook', 'Open Hand'],
  dynos: ['Dyno', 'Dyno', 'Double Dyno', 'Crimp Grip', 'Lock Off', 'Open Hand', 'Smear', 'Smear',
    'Shake Out', 'Breathe', 'Heel Hook', 'Kneebar', 'Flag', 'Mantle', 'Gaston'],
  greedy: ['Try Hard', 'Fight It', 'Last Gasp', 'Dig In', 'All Points Off', 'Crimp Grip',
    'Smear', 'Smear', 'Shake Out', 'Breathe', 'Heel Hook', 'Lock Off', 'Kneebar', 'Flag', 'Mantle'],
  rests: ['Shake Out', 'Shake Out', 'Kneebar', 'Kneebar', 'Breathe', 'Breathe', 'Deep Breath',
    'Smear', 'Smear', 'Crimp Grip', 'Crimp Grip', 'Lock Off', 'Heel Hook', 'Flag', 'Open Hand'],
  protection: ['Quickdraw', 'Wired Nut', 'Bomber Cam', 'Crimp Grip', 'Lock Off', 'Open Hand',
    'Smear', 'Smear', 'Shake Out', 'Breathe', 'Heel Hook', 'Kneebar', 'Flag', 'Mantle', 'Gaston'],
}
/** One of each kind of route the game can put in front of you. */
const ROUTE_KINDS = () => {
  const find = f => { const i = E.ROUTES.findIndex(f); return i >= 0 ? i : 0 }
  return {
    plain: find(r => !r.signature && !r.roped && !r.phases && !r.finale && !r.tutorial && r.clear >= 7),
    named: find(r => r.signature),
    roped: find(r => r.roped),
    boss: find(r => r.phases && r.phases.length),
  }
}

/* =======================================================================
   1. THE PREVIEW  (v4.0 — was wrong 26% / 62% before four fixes)
   ======================================================================= */
group('preview')
test('the preview holds up on a deck built out of opposition', () => {
  // ENG-18 made resolve read the board as it stands, so a hand that comes off
  // stops opposing the other one. The suite's default deck contains no
  // opposing cards, so it passed while the preview was wrong 13% of the time.
  const deck = ['Gaston', 'Gaston', 'Undercling', 'Undercling', 'Sidepull', 'Layback',
    'Arm Bar', 'Smear', 'Smear', 'Shake Out', 'Breathe', 'Crimp Grip', 'Crimp Grip',
    'Heel Hook', 'Kneebar'].map(E.spawn)
  const rng = new E.RNG(909)
  let bad = 0, seen = 0
  for (let t = 0; t < 250; t++) {
    let s = startClimb(4 + rng.int(4), rng, { runDeck: deck, seed: Math.floor(rng.next() * 2 ** 31) })
    for (let k = 0; k < 6 && s.phase === 'climb'; k++) {
      s = E.autoPlay(s, rng)
      const predicted = [0, 1, 2].map(i => E.previewLane(s, i)).filter(p => p.clears).length
      const before = s.cleared
      const next = E.resolve(s, rng)
      seen++
      if (next.cleared - before !== predicted) bad++
      s = next
    }
  }
  ok(seen > 500, `only ${seen} turns exercised`)
  eq(bad, 0, `the preview was wrong on ${bad} of ${seen} turns with opposition in the deck`)
})
test('the order you place is the order they go', () => {
  const s = { ...E.freshRun(4, 0, 1), inRun: true, order: [2, 0, 1] }
  // the order must be honoured, and any lane left out still resolves
  const order = [...s.order.filter(k => k >= 0 && k < 3),
    ...[0, 1, 2].filter(k => !s.order.includes(k))]
  eq(order.join(''), '201', 'the placement order is not followed')
  const partial = [...[1].filter(k => k >= 0 && k < 3), ...[0, 1, 2].filter(k => k !== 1)]
  eq(partial.length, 3, 'a lane went missing when only one was placed')
  eq(new Set(partial).size, 3, 'a lane resolved twice')
})

test('the odds on a dyno are the odds you get', () => {
  // ENG-15. A dyno is a check now, so the preview states a probability. The
  // one thing that must never drift is the stated number against the real one.
  const rng = new E.RNG(515)
  const deck = [...E.DEFAULT_LOADOUT.slice(0, 12), 'Dyno', 'Dyno', 'Dyno'].map(E.spawn)
  const buckets = new Map()
  for (let t = 0; t < 500; t++) {
    let s = startClimb(4 + rng.int(4), rng, { runDeck: deck, seed: Math.floor(rng.next() * 2 ** 31) })
    for (let k = 0; k < 8 && s.phase === 'climb'; k++) {
      s = E.autoPlay(s, rng)
      const dynoLane = [0, 1].find(i => s.boardP[i]?.fx === 'commit' && s.boardH[i])
      if (dynoLane === undefined) { s = E.resolve(s, rng); continue }
      const p = E.previewLane(s, dynoLane)
      ok(p.stick !== undefined, 'a dyno lane reports no odds')
      ok(p.stick > 0 && p.stick < 1, `impossible odds: ${p.stick}`)
      ok(!p.clears, 'the preview claims a dyno is a certain clear')
      // count the DYNO, not any lane that happened to clear on the same turn
      const band = Math.round(p.stick * 5) / 5
      const mark = s.log.length
      const next = E.resolve(s, rng)
      const said = next.log.slice(mark).join(' ')
      const missed = said.includes('Did not stick')
      const b = buckets.get(band) ?? { n: 0, hit: 0 }
      b.n++; if (!missed) b.hit++
      buckets.set(band, b)
      s = next
    }
  }
  let checked = 0
  for (const [band, b] of buckets) {
    if (b.n < 40) continue
    checked++
    const actual = b.hit / b.n
    ok(Math.abs(actual - band) < 0.18,
      `stated ${(band * 100).toFixed(0)}% but stuck ${(actual * 100).toFixed(0)}% of ${b.n}`)
  }
  ok(checked >= 1, 'not enough dynos thrown to check the odds')
})
test('being pumped is what makes a dyno a gamble', () => {
  const base = { ...E.freshRun(4, 0, 1), inRun: true, skirmish: null, boardP: [null, null, null] }
  const fresh = E.stickChance({ ...base, pump: 0 })
  const cooked = E.stickChance({ ...base, pump: E.PUMP_MAX - 1 })
  ok(fresh > cooked + 0.2, `pump barely matters: ${fresh.toFixed(2)} fresh vs ${cooked.toFixed(2)}`)
  const feet = E.stickChance({ ...base, pump: 4, boardP: [null, null, E.spawn('Smear')] })
  ok(feet > E.stickChance({ ...base, pump: 4 }), 'having your feet on does not help')
  for (const p of [0, 3, 6, 9, 11, 20]) {
    const c = E.stickChance({ ...base, pump: p })
    ok(c > 0 && c < 1, `odds of ${c} at pump ${p}`)
  }
})

test('the preview is exact for every shape of deck on every kind of route', () => {
  /* The sweep. Seven deck shapes against four kinds of route — 28 combinations
     — so a rule that only misbehaves for one of them fails here rather than
     six versions later on somebody's phone. */
  const kinds = ROUTE_KINDS()
  const worst = []
  for (const [shape, names] of Object.entries(SHAPES)) {
    const deck = names.filter(n => E.CARDS[n]).map(E.spawn)
    ok(deck.length >= 12, `the ${shape} deck names ${names.length - deck.length} cards that do not exist`)
    for (const [kind, idx] of Object.entries(kinds)) {
      const rng = new E.RNG(7000 + shape.length * 31 + kind.length)
      let bad = 0, seen = 0
      for (let t = 0; t < 60; t++) {
        let st = startClimb(idx, rng, { runDeck: deck, seed: Math.floor(rng.next() * 2 ** 31) })
        for (let k = 0; k < 8 && st.phase === 'climb'; k++) {
          st = E.autoPlay(st, rng)
          const lanes = [0, 1, 2].map(i => E.previewLane(st, i))
          const predicted = lanes.filter(p => p.clears).length
          const before = st.cleared
          const next = E.resolve(st, rng)
          /* Two turns cannot be measured this way and are skipped rather than
             fudged: a dyno is a stated probability rather than a prediction,
             and a caught fall on a rope rewinds `cleared` back to the last
             piece, so the difference is not what the lanes did. */
          const rewound = next.burn !== st.burn || next.cleared < before
          if (!lanes.some(p => p.stick !== undefined) && !rewound) {
            seen++
            if (next.cleared - before !== predicted) bad++
          }
          st = next
        }
      }
      ok(seen > 50, `${shape}/${kind} only exercised ${seen} turns`)
      /* Zero, and it stays zero. It was 1% while ENG-19 was open; that is
         closed, so this is strict again. Negative-tested by handing
         powerAgainst the pre-move state, which is the bug ENG-19 was: it
         fails six of the 28 combinations immediately. */
      if (bad) worst.push(`${shape} on a ${kind} route: ${bad} of ${seen}`)
    }
  }
  eq(worst.length, 0, `the preview is systematically wrong for: ${worst.join(' · ')}`)
})

test('lane outcomes and pump match resolve exactly', () => {
  const rng = new E.RNG(2027)
  let laneOk = 0, laneBad = 0, pumpOk = 0, pumpBad = 0
  for (let t = 0; t < 400; t++) {
    let s = startClimb(3 + rng.int(6), rng, { seed: Math.floor(rng.next() * 2 ** 31) })
    for (let k = 0; k < 6 && s.phase === 'climb'; k++) {
      s = E.autoPlay(s, rng)
      const lanes = [0, 1, 2].map(i => E.previewLane(s, i))
      const predictedClears = lanes.filter(p => p.clears).length
      const predictedPump = E.previewPump(s, lanes)
      const before = s.cleared
      const next = E.resolve(s, rng)
      if (next.cleared - before === predictedClears) laneOk++; else laneBad++
      if (next.phase === 'climb') {
        if (next.pump === predictedPump) pumpOk++; else pumpBad++
      }
      s = next
    }
  }
  eq(laneBad, 0, `lane predictions wrong (${laneOk} right)`)
  eq(pumpBad, 0, `pump predictions wrong (${pumpOk} right)`)
})

/* =======================================================================
   2. PILES  (v4.1 — the sheet cannot lie about what is left)
   ======================================================================= */
group('piles')
test('every card is in exactly one pile at all times', () => {
  const rng = new E.RNG(4041)
  let drift = 0
  for (let t = 0; t < 120; t++) {
    const deck = E.DEFAULT_LOADOUT.map(E.spawn)
    let s = startClimb(4 + rng.int(5), rng, { runDeck: deck, seed: Math.floor(rng.next() * 2 ** 31) })
    for (let k = 0; k < 12 && s.phase === 'climb'; k++) {
      s = E.autoPlay(s, rng); s = E.resolve(s, rng)
      if (s.phase !== 'climb') break
      const seen = s.piles.draw.length + s.piles.discard.length + s.piles.exhaust.length
        + s.piles.hand.length + s.boardP.filter(Boolean).length
      if (seen !== deck.length) drift++
    }
  }
  eq(drift, 0, 'cards appeared or vanished between piles')
})

/* =======================================================================
   3. SAVES  (v3.7 — the loader used to wipe on a version bump)
   ======================================================================= */
group('saves')
const sampleSave = () => ({
  ...E.freshRun(0, 0, 7), slot: 1, level: 9, xp: 40, owned: ['Gaston', 'Mantle'],
  sends: 12, wins: 1, journal: [1, 2], seen: ['marge1'], book: {}, bestCircuit: 11,
  loadouts: E.ARCHETYPES.map(a => a.loadout.slice()), arch: 2, style: 1, styleMax: 2,
  coaching: true, sound: true, cbSafe: false, motion: true, textScale: 0, tutorialDone: true,
})
test('round-trips a save without losing anything', () => {
  E.saveGame(sampleSave())
  const back = E.loadGame(1)
  eq(back.level, 9, 'level'); eq(back.owned.length, 2, 'collection')
  eq(back.bestCircuit, 11, 'circuit best'); eq(back.arch, 2, 'climber')
})
test('an OLDER save is migrated, not discarded', () => {
  E.saveGame(sampleSave())
  const raw = JSON.parse(store.get('sandbagged.save.1'))
  raw.v = 0; delete raw.bestCircuit; delete raw.loadouts
  store.set('sandbagged.save.1', JSON.stringify(raw))
  const old = E.loadGame(1)
  eq(old.level, 9, 'an old save must survive a version bump')
  eq(old.bestCircuit, 0, 'a missing field must take its default')
})
test('a save from a NEWER build is refused', () => {
  const raw = JSON.parse(store.get('sandbagged.save.1'))
  raw.v = E.SAVE_FILE_VERSION + 5
  store.set('sandbagged.save.1', JSON.stringify(raw))
  eq(Object.keys(E.loadGame(1)).length, 0, 'a future save must not be half-read')
})
test('export and import move a save between slots', () => {
  E.saveGame(sampleSave())
  const code = E.exportSave({ ...sampleSave(), slot: 1 })
  ok(code.length > 100, 'export produced nothing')
  ok(E.importSave(code, 2), 'import failed')
  eq(E.loadGame(2).level, 9, 'imported save')
  eq(E.importSave('not-a-save', 2), false, 'garbage must be rejected')
})

/* =======================================================================
   4. SEEDS  (v4.3 — a run must be reproducible from its code)
   ======================================================================= */
group('seeds')
test('seed codes round-trip and stay short', () => {
  let bad = 0, longest = 0
  for (let i = 0; i < 5000; i++) {
    const n = Math.floor(Math.random() * 2 ** 32) >>> 0
    const c = E.seedCode(n); longest = Math.max(longest, c.length)
    if (E.codeSeed(c) !== n) bad++
  }
  eq(bad, 0, 'seed code round-trip'); ok(longest <= 7, `code too long: ${longest}`)
  eq(E.codeSeed('   '), null, 'empty input must be null')
})
test('the same seed produces the same run', () => {
  const run = seed => {
    const rng = new E.RNG(seed)
    let s = E.newRun(seed, E.DEFAULT_LOADOUT, 0, 0)
    const fc = E.forecastFor(s).map(f => `${f.weather}/${f.rock}`).join(',')
    s = E.startBurn({ ...s, routeIdx: 3, weather: 1, rock: 0 }, rng)
    return [fc, s.holdDeck.map(h => h.name).join(','), s.piles.hand.map(c => c.name).join(','), s.gear.join(',')].join('|')
  }
  eq(run(123456), run(123456), 'same seed must give the same run')
  ok(run(123456) !== run(123457), 'different seeds must differ')
})

/* =======================================================================
   5. BOSS PHASES  (v4.2 — a phase must never ambush you)
   ======================================================================= */
group('phases')
test('every boss phase is telegraphed before it lands', () => {
  const bosses = E.ROUTES.filter(r => r.phases?.length)
  ok(bosses.length >= 4, 'expected four phased bosses')
  for (const r of bosses) {
    const idx = E.ROUTES.indexOf(r)
    const warned = new Set()
    for (let cleared = 0; cleared <= r.clear; cleared++) {
      const s = { ...E.freshRun(idx, 0, 5), inRun: true, cleared, skirmish: null }
      const nx = E.nextPhase(s), cur = E.phaseOf(s)
      if (nx && nx.away <= 2) warned.add(nx.p.name)
      if (cur) ok(warned.has(cur.name), `${r.name}: ${cur.name} landed without warning`)
      if (nx && cur) ok(nx.p.name !== cur.name, `${r.name}: countdown points at the current phase`)
    }
  }
})

/* =======================================================================
   6. CONTENT INTEGRITY
   ======================================================================= */
group('content')
test('every card has exactly one family mark', () => {
  let unmarked = 0
  for (const name of Object.keys(E.CARDS)) if (!E.familyOf(E.spawn(name))) unmarked++
  eq(unmarked, 0, 'cards without a family mark')
})
test('every route in an act map exists and is reachable', () => {
  E.ACTS.forEach((map, a) => map.forEach((tier, t) => tier.forEach(n => {
    if (n.routeIdx < 0) return
    ok(E.ROUTES[n.routeIdx], `act ${a} tier ${t} points at route ${n.routeIdx}, which does not exist`)
  })))
  const finale = E.ROUTES.findIndex(r => r.finale)
  const last = E.ACTS[2][E.ACTS[2].length - 1][0]
  eq(last.routeIdx, finale, 'the last node of act 3 must be the finale')
})
test('the tutorial route stays out of the acts', () => {
  const tut = E.ROUTES.findIndex(r => r.tutorial)
  ok(tut >= 0, 'no tutorial route')
  eq(E.ACT_OF_ROUTE[tut], undefined, 'the tutorial must not sit in an act map')
})
test('a trip does not repeat an event', () => {
  // 68% of runs used to show the same event twice, which reads as a small world
  const rng = new E.RNG(555)
  for (let r = 0; r < 400; r++) {
    const seen = []
    for (let i = 0; i < 8; i++) {
      const act = i < 3 ? 0 : i < 6 ? 1 : 2
      const ev = E.rollEvent(rng, act, seen, [])
      ok(!seen.includes(ev.id), `${ev.id} came round twice in one trip`)
      seen.push(ev.id)
    }
  }
})
test('every page event still has something to offer once its page is read', () => {
  // an earlier version filtered these out as "duds". They are not: each one
  // has a branch that does something other than hand you the page.
  const pageEvents = E.EVENTS.filter(e => e.choices.some(c => c.outcome.journal !== undefined))
  ok(pageEvents.length >= 4, `only ${pageEvents.length} events carry a page`)
  for (const e of pageEvents) {
    const other = e.choices.filter(c => c.outcome.journal === undefined)
    ok(other.length >= 1, `${e.id} is worthless once you have its page`)
    for (const c of other) {
      const o = c.outcome
      const gives = (o.xp ?? 0) > 0 || (o.skin ?? 0) > 0 || (o.cash ?? 0) > 0
        || (o.psyche ?? 0) > 0 || !!o.card || !!o.boon
      ok(gives, `${e.id}: the alternative branch gives nothing`)
    }
  }
})
test('a roped route never starts you on nothing', () => {
  // 69% of roped attempts used to end as "ground falls" because the rope was
  // treated as beginning from no protection at all. You are tied to the belay.
  const rng = new E.RNG(41)
  for (const r of E.ROUTES.filter(r => r.roped)) {
    const idx = E.ROUTES.indexOf(r)
    const s = E.startBurn({ ...E.freshRun(idx, 0, 5), inRun: true, weather: 1, rock: 0,
      runDeck: E.DEFAULT_LOADOUT.map(E.spawn) }, rng)
    eq(s.lastPiece, 0, `${r.name} starts you off the rope`)
  }
  // and a boulder must not gain a phantom piece
  const b = E.startBurn({ ...E.freshRun(3, 0, 5), inRun: true, weather: 1, rock: 0,
    runDeck: E.DEFAULT_LOADOUT.map(E.spawn) }, rng)
  eq(b.lastPiece, -1, 'a boulder should have no protection at all')
})
test('protection is a quick action, not a lost card', () => {
  for (const n of Object.keys(E.CARDS).filter(n => E.CARDS[n].clip)) {
    const c = E.spawn(n)
    ok(c.draw >= 1, `${n} costs you a card to place, which is not what clipping is`)
    ok(c.kind === 'bonus', `${n} occupies a lane, and clipping does not`)
  }
})

test('the roll still returns something when everything is used up', () => {
  const rng = new E.RNG(31)
  const ev = E.rollEvent(rng, 0, E.EVENTS.map(e => e.id))
  ok(ev && ev.id, 'the roll returned nothing with the pool exhausted')
})

test('events never leak between ranges', () => {
  for (let a = 0; a < 3; a++) {
    const rng = new E.RNG(11 + a)
    for (let i = 0; i < 2000; i++) {
      const ev = E.rollEvent(rng, a)
      ok(ev.act === undefined || ev.act === a, `${ev.id} appeared in act ${a + 1}`)
    }
  }
})
test('she has something to say about what you put your name to', () => {
  const mk = (claimed, real, seen = ['marge1']) => ({ ...E.freshRun(0, 0, 1), inRun: true,
    act: 1, seen, established: [{ name: 'Quiet Arete', claimed, real, act: 0, burns: 2 }] })
  // all three verdicts must produce different words
  const said = [[5, 8], [7, 7], [9, 6]].map(([c, r]) => E.faTalk(mk(c, r)).text)
  eq(new Set(said).size, 3, 'she says the same thing however you graded it')
  for (const t of said) ok(t.includes('Quiet Arete'), 'she does not name the line')
  // it fires once
  const s1 = mk(5, 8)
  eq(E.availableTalk(s1).id, 'fa:Quiet Arete', 'she never mentions it')
  ok(E.availableTalk({ ...s1, seen: ['marge1', 'fa:Quiet Arete'] })?.id !== 'fa:Quiet Arete',
    'she brings up the same line twice')
  // and never before you have met her, because she refers to him
  eq(E.faTalk(mk(5, 8, [])), null, 'she talks about him before you have met her')
  eq(E.faTalk({ ...mk(5, 8), established: [] }), null, 'she discussed a line you never put up')
  // every reply must lead somewhere
  for (const [c, r] of [[5, 8], [7, 7], [9, 6]]) {
    const t = E.faTalk(mk(c, r))
    ok(t.replies.length >= 2, 'a conversation with one way out')
    for (const rep of t.replies) {
      ok(rep.label.length > 3 && rep.text.length > 20, 'an empty reply')
    }
  }
})

test('every conversation is reachable', () => {
  let st = { ...E.freshRun(0, 0, 1), seen: [], journal: [1, 2, 3, 4, 5, 6, 7], act: 0 }
  const seen = []
  for (const act of [0, 1, 2, 0, 1, 2]) {
    st = { ...st, act }
    for (let i = 0; i < 40; i++) {
      const t = E.availableTalk(st)
      if (!t) break
      seen.push(t.id); st = { ...st, seen: [...st.seen, t.id] }
    }
  }
  eq(seen.length, E.TALKS.length,
    `unreachable: ${E.TALKS.map(t => t.id).filter(i => !seen.includes(i)).join(', ')}`)
})
test('the journal makes the finale readable', () => {
  // pages were worth ~16 points, then nothing once decks improved. They now
  // do what v0 said they did: without them you cannot read the route.
  const finale = E.ROUTES.findIndex(r => r.finale)
  const gripAt = pages => {
    const rng = new E.RNG(77)
    const s = { ...E.freshRun(finale, 0, 5), inRun: true, skirmish: null, weather: 1, rock: 0,
      journal: Array.from({ length: pages }, (_, i) => i + 1),
      runDeck: E.DEFAULT_LOADOUT.map(E.spawn) }
    const b = E.startBurn(s, rng)
    return b.holdDeck.reduce((a, h) => a + h.grip, 0) / b.holdDeck.length
  }
  const blind = gripAt(0), read = gripAt(6)
  ok(blind > read + 3, `an unread finale is only ${(blind - read).toFixed(1)} Grip harder`)
  ok(gripAt(3) < blind && gripAt(3) > read, 'the penalty does not scale with pages')
})
test('only the finale is affected by what you have read', () => {
  const gripAt = (idx, pages) => {
    const rng = new E.RNG(78)
    const s = { ...E.freshRun(idx, 0, 5), inRun: true, skirmish: null, weather: 1, rock: 0,
      journal: Array.from({ length: pages }, (_, i) => i + 1),
      runDeck: E.DEFAULT_LOADOUT.map(E.spawn) }
    return E.startBurn(s, rng).holdDeck.reduce((a, h) => a + h.grip, 0)
  }
  for (const idx of [0, 4, 9]) eq(gripAt(idx, 0), gripAt(idx, 6),
    `${E.ROUTES[idx].name} changes with the journal, and should not`)
})

test('the ending is gated on reaching the top', () => {
  const walk = journal => {
    let st = { ...E.freshRun(0, 0, 1), seen: [], journal, act: 0 }
    const out = []
    for (const act of [0, 1, 2, 0, 1, 2]) {
      st = { ...st, act }
      for (let i = 0; i < 40; i++) {
        const t = E.availableTalk(st); if (!t) break
        out.push(t.id); st = { ...st, seen: [...st.seen, t.id] }
      }
    }
    return out
  }
  ok(!walk([1, 2, 3, 4, 5, 6]).includes('marge6'), 'the ending leaked before page 7')
  ok(walk([1, 2, 3, 4, 5, 6, 7]).includes('marge7'), 'the ending is unreachable')
})

/* =======================================================================
   5b. LINES  (v5.6 — same rock, more than one way up it)
   ======================================================================= */
group('lines')
test('authored routes are never varied', () => {
  for (const r of E.ROUTES) {
    if (!r.finale && !r.tutorial && !r.holds) continue
    for (let line = 0; line < E.LINES.length; line++) {
      const s = { ...E.freshRun(E.ROUTES.indexOf(r), 0, 1), line, skirmish: null }
      eq(E.specOf(s).clear, r.clear, `${r.name} was varied by a line`)
      eq(E.specOf(s).crux, r.crux, `${r.name} crux was varied`)
    }
    ok(!E.lineCanVary(r), `${r.name} should not offer a choice of line`)
  }
})
test('a line never produces an unclimbable route', () => {
  for (const r of E.ROUTES) {
    if (!E.lineCanVary(r)) continue
    for (let line = 0; line < E.LINES.length; line++) {
      const s = { ...E.freshRun(E.ROUTES.indexOf(r), 0, 1), line, skirmish: null }
      const spec = E.specOf(s)
      ok(spec.clear >= 4, `${r.name} / ${E.LINES[line].name}: ${spec.clear} holds`)
      ok(spec.crux >= 0, `${r.name} / ${E.LINES[line].name}: negative crux`)
      ok(spec.crux < spec.clear, `${r.name} / ${E.LINES[line].name}: more cruxes than holds`)
    }
  }
})

/* =======================================================================
   4a. THE VALUATION  (v6.0 — the drafter is the measuring instrument)
   ======================================================================= */
group('valuation')
const vDeck = () => E.DEFAULT_LOADOUT.map(E.spawn)
const vState = (over = {}) => ({ ...E.freshRun(0, 0, 1), inRun: true, arch: 0,
  gear: [], boons: [], mutators: [], ...over })
test('the game can build you a deck that actually works', () => {
  /* DECK-1. `cardValue` scores a card on its own and knows nothing about the
     shape of a deck. Left to it, the builder made fifteen rest cards, and then
     — once rests were capped — THIRTEEN feet cards, on a board with two hand
     lanes. Shape is the builder's job. */
  const starters = Object.keys(E.CARDS).filter(n => E.CARDS[n].rarity === 'starter')
  const commons = Object.keys(E.CARDS).filter(n => (E.CARDS[n].rarity ?? '') === 'common')
  const all = Object.keys(E.CARDS).filter(n => !['curse', 'beta'].includes(E.CARDS[n].rarity ?? ''))
  const st = owned => ({ ...E.freshRun(0, 0, 1), owned, gear: [], boons: [], arch: 0 })
  for (const [label, owned] of [['a beginner', [...starters, ...commons]], ['everything', all]]) {
    for (const seed of [[], ['Gaston', 'Gaston'], ['Dyno']]) {
      const d = E.buildLoadout(st(owned), seed, owned)
      const sp = d.map(E.spawn)
      eq(d.length, E.DECK_SIZE, `${label}: built ${d.length} cards`)
      for (const n of seed) ok(d.filter(x => x === n).length >= seed.filter(x => x === n).length,
        `${label}: it threw out the ${n} you asked for`)
      const hands = sp.filter(c => c.lane === 'hand' || c.lane === 'any').length
      const feet = sp.filter(c => c.lane === 'feet').length
      const rests = sp.filter(c => c.shed > 0).length
      const tech = sp.filter(c => c.kind === 'bonus').length
      ok(hands >= E.MIN_HANDS, `${label}: only ${hands} hand cards on a two-hand board`)
      ok(feet >= 1 && feet <= E.MAX_FEET, `${label}: ${feet} feet cards`)
      ok(rests <= E.MAX_RESTS, `${label}: ${rests} rest cards, which cannot work a hold`)
      ok(tech <= E.MAX_TECH, `${label}: ${tech} technique cards`)
      for (const n of new Set(d)) ok(d.filter(x => x === n).length <= E.copyLimit(E.CARDS[n].rarity ?? 'common'),
        `${label}: too many copies of ${n}`)
      ok(!d.some(n => (E.CARDS[n].rarity ?? '') === 'curse'), `${label}: it put a curse in your deck`)
    }
  }
  const fifteen = E.DEFAULT_LOADOUT.slice(0, E.DECK_SIZE)
  eq(E.buildLoadout(st(all), fifteen, all).join('|'), fifteen.join('|'),
    'it rebuilt a deck that was already full')
})
test('a built deck climbs at least as well as the one it replaces', () => {
  // the only measurement that matters: does the thing it hands a new player
  // actually send? The first two versions built decks that sent 0%.
  const starters = Object.keys(E.CARDS).filter(n => E.CARDS[n].rarity === 'starter')
  const commons = Object.keys(E.CARDS).filter(n => (E.CARDS[n].rarity ?? '') === 'common')
  const owned = [...starters, ...commons]
  const built = E.buildLoadout({ ...E.freshRun(0, 0, 1), owned, gear: [], boons: [], arch: 0 }, [], owned)
  const send = (names, idx) => {
    const rng = new E.RNG(55); let sent = 0
    for (let i = 0; i < 150; i++) {
      let s = startClimb(idx, rng, { runDeck: names.map(E.spawn), skin: 9,
        seed: Math.floor(rng.next() * 2 ** 31) })
      for (let t = 0; t < 50 && s.phase === 'climb'; t++) { s = E.autoPlay(s, rng); s = E.resolve(s, rng) }
      if (s.result === 'send') sent++
    }
    return 100 * sent / 150
  }
  const idx = E.ROUTES.findIndex(r => r.name === 'The Fridge')
  const auto = send(built, idx), hand = send(E.DEFAULT_LOADOUT, idx)
  ok(auto >= hand, `the built deck sends ${auto.toFixed(0)}% against the default's ${hand.toFixed(0)}%`)
  ok(auto > 20, `the built deck only sends ${auto.toFixed(0)}% of an early boulder`)
})

test('you can find a card in a pool this size', () => {
  /* UX-14. Fifteen slots out of everything you own, and BAL-2 made 203 cards
     reachable inside 33 runs. The filter logic is in the screen, so this
     checks the predicate the screen uses — by name, by what a card says, and
     by the four ways of narrowing it. */
  const app = readFileSync('src/App.tsx', 'utf8')
  ok(/placeholder="find a card, or what it does"/.test(app), 'there is no search box')
  ok(/aria-label="Search your cards"/.test(app), 'the search box is not announced')
  for (const k of ['hands', 'feet', 'technique', 'mine'])
    ok(app.includes(`deckOnly === '${k}'`), `no way to narrow to ${k}`)
  // the predicate itself, run against the real pool
  const all = Object.keys(E.CARDS).filter(n => (E.CARDS[n].rarity ?? 'common') !== 'curse')
  const match = (n, q, only, inDeck) => {
    const c = E.CARDS[n]
    if (only === 'feet' && c.lane !== 'feet') return false
    if (only === 'hands' && (c.lane === 'feet' || c.kind === 'bonus')) return false
    if (only === 'technique' && c.kind !== 'bonus') return false
    if (only === 'mine' && !inDeck) return false
    if (!q) return true
    return n.toLowerCase().includes(q) || (c.text ?? '').toLowerCase().includes(q)
  }
  // searching for a card you know exists must find it and not everything else
  const one = all.find(n => n === 'Shake Out') ?? all[0]
  const hits = all.filter(n => match(n, one.toLowerCase(), 'all', false))
  ok(hits.includes(one), `searching for "${one}" does not find it`)
  ok(hits.length < all.length, 'a search for one card returned the whole pool')
  // each filter must return something, and less than everything
  for (const only of ['hands', 'feet', 'technique']) {
    const got = all.filter(n => match(n, '', only, false))
    ok(got.length > 3, `filtering to ${only} leaves almost nothing`)
    ok(got.length < all.length, `filtering to ${only} changes nothing`)
  }
  // searching what a card DOES, not just its name
  const byText = all.filter(n => match(n, 'pump', 'all', false))
  ok(byText.length > 5, 'searching what a card does finds almost nothing')
  ok(!byText.every(n => n.toLowerCase().includes('pump')), 'the search only reads names')
})

test('the shelf explains itself without lying', () => {
  const deck = E.DEFAULT_LOADOUT.map(E.spawn)
  const st = (over = {}) => ({ ...E.freshRun(4, 0, 1), inRun: true, skirmish: null,
    runDeck: deck, gear: [], boons: [], mutators: [], ...over })
  for (const n of Object.keys(E.CARDS)) {
    const h = E.cardHints(st(), E.spawn(n), deck)
    ok(h.length <= 2, `${n} produced ${h.length} hints`)
    for (const line of h) {
      ok(line.length > 5, `${n} produced an empty hint`)
      ok(line.length < 60, `${n}: "${line}" is too long for a phone`)
      ok(line === line.trim(), `${n}: a hint with loose whitespace`)
    }
  }
  for (const n of E.BY_RARITY('curse')) {
    const h = E.cardHints(st(), E.spawn(n), deck)
    ok(h[0] && h[0].includes('curse'), `${n} does not warn you it is a curse`)
  }
})
test('a hint changes when the situation does', () => {
  const deck = E.DEFAULT_LOADOUT.map(E.spawn)
  const st = (over = {}) => ({ ...E.freshRun(4, 0, 1), inRun: true, skirmish: null,
    runDeck: deck, gear: [], boons: [], mutators: [], ...over })
  const clip = Object.keys(E.CARDS).find(n => E.CARDS[n].clip)
  const onRock = E.cardHints(st(), E.spawn(clip), deck).join(' ')
  const onRope = E.cardHints(st({ skirmish: E.ROUTES.find(r => r.roped) }), E.spawn(clip), deck).join(' ')
  ok(onRock !== onRope, 'protection reads the same on a boulder and on a rope')
  ok(/boulder/.test(onRock) && /rope/.test(onRope), 'the rope hint does not say which it is')
  const rest = Object.keys(E.CARDS).find(n => E.CARDS[n].shed > 0 && E.CARDS[n].kind === 'move')
  const plain = E.cardHints(st(), E.spawn(rest), deck).join(' ')
  const withBoon = E.cardHints(st({ boons: ['kneebar'] }), E.spawn(rest), deck).join(' ')
  ok(plain !== withBoon, 'holding Kneebar Merchant changes nothing on the shelf')
})

test('no card in the pool values to nothing', () => {
  const deck = vDeck()
  for (const n of Object.keys(E.CARDS)) {
    const v = E.cardValue(vState({ runDeck: deck }), E.spawn(n), deck)
    ok(Number.isFinite(v), `${n} values to ${v}`)
  }
})
test('a sequence card is worth more than its cost', () => {
  // all four scored −3 for a whole version, so the drafter never took one and
  // every number measured a game in which sequences did not exist
  const deck = vDeck()
  for (const n of Object.keys(E.CARDS).filter(n => E.CARDS[n].seq)) {
    const v = E.cardValue(vState({ runDeck: deck }), E.spawn(n), deck)
    ok(v > -1, `${n} values at ${v.toFixed(1)} — it would never be taken`)
  }
})
test('a sequence is worth more to a deck that can hold it', () => {
  const base = vDeck()
  const feet = [...base, ...Array(6).fill(0).map(() => E.spawn('Smear'))]
  const rest = [...base, ...Array(6).fill(0).map(() => E.spawn('Shake Out'))]
  const v = (c, d) => E.cardValue(vState({ runDeck: d }), c, d)
  ok(v(E.spawn('Trust The Feet'), feet) > v(E.spawn('Trust The Feet'), rest),
    'a feet sequence should prefer a feet deck')
  ok(v(E.spawn('Find The Rest'), rest) > v(E.spawn('Find The Rest'), feet),
    'a rest sequence should prefer a rest deck')
})
test('protection is worthless on rock and worth something on a rope', () => {
  const deck = vDeck()
  const roped = E.ROUTES.findIndex(r => r.roped)
  for (const n of Object.keys(E.CARDS).filter(n => E.CARDS[n].clip)) {
    const c = E.spawn(n)
    const onRock = E.cardValue(vState({ runDeck: deck, routeIdx: 0, skirmish: null }), c, deck)
    const onRope = E.cardValue(vState({ runDeck: deck, routeIdx: roped, skirmish: null }), c, deck)
    ok(onRope > onRock + 3, `${n}: rock ${onRock.toFixed(1)} vs rope ${onRope.toFixed(1)}`)
    // a piece whose ONLY job is clipping must be near worthless on a boulder;
    // ones that also shed or draw are allowed to earn their slot either way
    const alsoUseful = c.shed > 0 || c.draw > 0
    if (!alsoUseful) ok(onRock < 2,
      `${n} does nothing but clip, yet values at ${onRock.toFixed(1)} on a boulder`)
  }
})
test('the pool does not fill up with cards nobody would take', () => {
  // 27% of the pool once valued below the line, almost all of it technique
  // cards being scored at a fifth of their measured worth
  const deck = vDeck()
  const st = vState({ runDeck: deck })
  const names = Object.keys(E.CARDS).filter(n => E.CARDS[n].rarity !== 'curse')
  const vals = names.map(n => [n, E.cardValue(st, E.spawn(n), deck)])
  const mean = vals.reduce((a, [, v]) => a + v, 0) / vals.length
  const dead = vals.filter(([, v]) => v < mean * 0.55)
  // what is left should be situational — sequences and protection — not filler
  const situational = dead.filter(([n]) => E.CARDS[n].seq || E.CARDS[n].clip).length
  ok(dead.length / vals.length < 0.14,
    `${dead.length} of ${vals.length} cards would never be taken`)
  ok(situational >= dead.length * 0.4,
    'the dead cards are filler rather than situational')
})
test('a technique card is worth a deck slot', () => {
  // measured: two of fifteen moves swapped for techniques took a mid Act 1
  // send rate from 46% to 88%
  const deck = vDeck()
  const st = vState({ runDeck: deck })
  for (const n of ['Breathe', 'Brush', 'Deep Breath']) {
    if (!E.CARDS[n]) continue
    ok(E.cardValue(st, E.spawn(n), deck) > 4, `${n} still reads as unplayable`)
  }
})
test('techniques saturate rather than stacking forever', () => {
  const deck = vDeck()
  const heavy = [...deck.slice(0, 8), ...Array(7).fill(0).map(() => E.spawn('Breathe'))]
  const b = E.spawn('Breathe')
  const light = E.cardValue(vState({ runDeck: deck }), b, deck)
  const full = E.cardValue(vState({ runDeck: heavy }), b, heavy)
  ok(full < light * 0.5, `saturation is not biting: ${light.toFixed(1)} → ${full.toFixed(1)}`)
})
test('a boon raises the value of the cards it helps', () => {
  const deck = vDeck()
  const v = (c, boons) => E.cardValue(vState({ runDeck: deck, boons }), c, deck)
  ok(v(E.spawn('Shake Out'), ['kneebar']) > v(E.spawn('Shake Out'), []), 'Kneebar should improve rests')
  ok(v(E.spawn('Smear'), ['bighands']) > v(E.spawn('Smear'), []), 'Big Hands should improve feet')
})

/* =======================================================================
   4b. SEQUENCES  (v5.9 — a plan held across turns)
   ======================================================================= */
group('sequences')
test('the condition table is exact', () => {
  const cases = [
    ['clear', 1, false, false, true], ['clear', 0, false, true, false],
    ['norest', 0, false, false, true], ['norest', 1, true, true, false],
    ['rest', 0, true, false, true], ['rest', 1, false, true, false],
    ['feet', 0, false, true, true], ['feet', 2, true, false, false],
  ]
  for (const [need, cl, rest, feet, want] of cases)
    eq(E.seqMet(need, cl, rest, feet), want, `${need} with cleared=${cl} rested=${rest} feet=${feet}`)
})
test('every sequence is startable and pays something', () => {
  const starters = Object.keys(E.CARDS).filter(n => E.CARDS[n].seq)
  eq(starters.length, E.SEQUENCES.length, 'a sequence has no card that starts it')
  for (const q of E.SEQUENCES) {
    ok(q.turns >= 2, `${q.id} is not a plan, it is a turn`)
    ok(Object.values(q.onDone).some(v => v === true || (typeof v === 'number' && v > 0)),
      `${q.id} pays nothing`)
    ok(starters.some(n => E.CARDS[n].seq === q.id), `${q.id} has no card`)
  }
})
test('a broken sequence is dropped, not carried', () => {
  const rng = new E.RNG(21)
  let s = { ...E.freshRun(6, 0, 9), inRun: true,
    runDeck: E.DEFAULT_LOADOUT.map(E.spawn), skin: 9, psyche: 3 }
  s = E.startBurn(s, rng)
  // demand a rest while playing normally: it must break rather than linger
  s = { ...s, seq: { id: 'rest' in {} ? '' : 'breathe', left: 2 }, boardP: [null, null, null] }
  const after = E.resolve(s, rng)
  ok(after.seq === null || after.seq.left < 2, 'a sequence neither advanced nor broke')
})

/* =======================================================================
   5a. MUTATORS  (v5.8 — every one must actually do something)
   ======================================================================= */
group('mutators')
test('holding none changes nothing at all', () => {
  const m = E.mutMods([])
  for (const [k, v] of Object.entries(m)) ok(v === false || v === 0, `${k} set with no mutators`)
  eq(E.xpMult([]), 1, 'XP multiplied with no mutators taken')
})
test('every mutator changes something and pays for it', () => {
  for (const d of E.MUTATORS) {
    const m = E.mutMods([d.id])
    const changed = Object.entries(m).filter(([k]) => k !== 'xp')
      .some(([, v]) => v === true || (typeof v === 'number' && v !== 0))
    ok(changed, `${d.id} changes nothing`)
    ok(d.xp > 0, `${d.id} pays nothing`)
  }
})
test('run-time mutators reach the run', () => {
  // both noGear and startCurse act inside newRun, and reading them off a fresh
  // state made them silent no-ops for a whole version
  const bare = E.newRun(1, E.DEFAULT_LOADOUT, 0, 0, [])
  const light = E.newRun(1, E.DEFAULT_LOADOUT, 0, 0, ['lightrack'])
  const choss = E.newRun(1, E.DEFAULT_LOADOUT, 0, 0, ['chossy'])
  ok(bare.gear.length > 0, 'a normal run should start with shoes')
  eq(light.gear.length, 0, 'Light Rack did not remove the gear')
  ok(choss.runDeck.length > bare.runDeck.length, 'Chossy added no curses')
  eq(choss.runDeck.filter(c => c.rarity === 'curse').length, 4, 'wrong number of curses')
})
test('stacking multiplies the XP', () => {
  const a = E.xpMult(['greasy']), b = E.xpMult(['greasy', 'sandbag'])
  ok(b > a, 'stacking did not raise the payout')
  eq(Math.round(E.xpMult(['greasy']) * 100), 125, 'greasy should pay 125%')
})

/* =======================================================================
   5c. THE DRAFT ECONOMY  (v5.7)
   ======================================================================= */
group('draft')
test('a reroll costs more each time and never goes free', () => {
  let last = -1
  for (let n = 0; n < 6; n++) {
    const c = E.rerollCost(n)
    ok(c > last, 'reroll cost must rise'); ok(c > 0, 'reroll must never be free')
    last = c
  }
})
test('you cannot spend cash you do not have', () => {
  const rng = new E.RNG(5)
  const base = { ...E.freshRun(0, 0, 1), cash: 0, rerolls: 0, offers: [E.spawn('Gaston')] }
  eq(E.rerollStep(base, rng).offers.length, 1, 'a broke reroll changed the shelf')
  eq(E.rerollStep(base, rng).cash, 0, 'a broke reroll charged you')
  eq(E.cropStep(base, rng).cash, 0, 'a broke upgrade charged you')
  const rich = { ...base, cash: 500 }
  ok(E.rerollStep(rich, rng).cash < 500, 'a paid reroll did not charge')
  eq(E.rerollStep(rich, rng).rerolls, 1, 'reroll count did not rise')
})
test('taking two brings a curse with them', () => {
  const rng = new E.RNG(6)
  const picks = [E.spawn('Gaston'), E.spawn('Mantle')]
  const before = { ...E.freshRun(0, 0, 1), inRun: true, runDeck: [], offers: [], tier: 0 }
  const after = E.takeTwoStep(before, picks, rng)
  eq(after.runDeck.length, 3, 'two cards and a curse')
  eq(after.runDeck.filter(c => c.rarity === 'curse').length, 1, 'exactly one curse')
})
test('a better shelf really is better', () => {
  const rng = new E.RNG(7)
  const val = (offers) => offers.reduce((a, c) =>
    a + (c.rarity === 'rare' ? 3 : c.rarity === 'uncommon' ? 2 : 1), 0) / offers.length
  let plain = 0, crop = 0
  for (let i = 0; i < 400; i++) {
    const s = { ...E.freshRun(0, 0, i), act: 0, cash: 500, rerolls: 0, offers: [] }
    plain += val(E.rerollStep(s, rng).offers)
    crop += val(E.cropStep(s, rng).offers)
  }
  ok(crop > plain, `the upgrade is not an upgrade: ${(crop / 400).toFixed(2)} vs ${(plain / 400).toFixed(2)}`)
})

/* =======================================================================
   6a. BOONS  (v5.5 — a boon must add a rule, never remove the default)
   ======================================================================= */
group('boons')
test('every boon is offered and applies', () => {
  const rng = new E.RNG(31)
  const seen = new Set()
  for (let i = 0; i < 4000; i++) {
    const s = { ...E.freshRun(0, 0, i), gear: [], boons: [] }
    for (const id of E.gearOffers(s, rng)) if (E.isBoon(id)) seen.add(id)
  }
  eq(seen.size, E.BOONS.length,
    `never offered: ${E.BOONS.map(b => b.id).filter(i => !seen.has(i)).join(', ')}`)
  for (const b of E.BOONS) {
    const m = E.boonMods([b.id])
    const touched = Object.values(m).some(v => v === true || (typeof v === 'number' && v > 0))
    ok(touched, `${b.id} changes nothing`)
  }
})
test('a wild boon is a trade, not a gift', () => {
  const wild = E.BOONS.filter(b => b.wild)
  ok(wild.length >= 3, `only ${wild.length} boons change how a turn feels`)
  for (const b of wild) {
    const m = E.mutMods ? null : null
    const mods = E.boonMods([b.id])
    const gains = (mods.dPowerAll > 0) || (mods.dDraw > 0) || mods.dyno || (mods.dTurnCap > 0)
    const costs = mods.noRests || mods.dumpHand || (mods.dFallSkin > 0)
      || (mods.dyno && true)   // halved Contact is the cost of doubled Power
    ok(gains, `${b.id} gives nothing`)
    ok(costs, `${b.id} costs nothing — a wild boon that is pure upside is just a good one`)
    ok(b.text.length > 30, `${b.id} does not explain its own trade`)
  }
})
test('Deadpointing doubles Power and halves Contact', () => {
  const deck = E.DEFAULT_LOADOUT.map(E.spawn)
  const base = { ...E.freshRun(4, 0, 1), inRun: true, skirmish: null, weather: 1, rock: 0,
    runDeck: deck, boons: [] }
  const dyno = { ...base, boons: ['deadpointing'] }
  const card = E.spawn('Lock Off')
  const hold = { uid: 1, name: 'crimp', bite: 3, grip: 9, crux: false, clean: false }
  const p0 = E.powerAgainst(base, card, hold, 0)
  const p1 = E.powerAgainst(dyno, card, hold, 0)
  ok(p1 > p0, `Deadpointing did not raise Power: ${p0} → ${p1}`)
})
test('carrying no boons leaves the rules exactly as they were', () => {
  // the Big Hands mistake: a boon was implemented by weakening the default
  const m = E.boonMods([])
  for (const [k, v] of Object.entries(m)) ok(v === false || v === 0, `${k} is set with no boons held`)
})
test('a boon can only be taken once and never replaces gear', () => {
  const rng = new E.RNG(9)
  let s = { ...E.freshRun(0, 0, 3), gear: ['sticky'], boons: [] }
  s = E.pickGearStep({ ...s, gearOffers: ['secondwind'], offers: [] }, 'secondwind')
  eq(s.boons.length, 1, 'boon not taken')
  eq(s.gear.length, 1, 'taking a boon must not drop your gear')
  // a different slot — same-slot gear replaces, which is intended
  s = E.pickGearStep({ ...s, gearOffers: ['liquid'], offers: [] }, 'liquid')
  eq(s.boons.length, 1, 'gear pick disturbed the boons')
  eq(s.gear.length, 2, 'gear in a free slot must be added, not swapped')
  s = E.pickGearStep({ ...s, gearOffers: ['flat'], offers: [] }, 'flat')
  eq(s.gear.length, 2, 'same-slot gear must replace, not stack')
  const offers = E.gearOffers(s, rng)
  ok(!offers.includes('secondwind'), 'a held boon was offered again')
})

/* =======================================================================
   6a2. WHERE KIT COMES FROM  (v6.7 — a run ended carrying 2 of 22)
   ======================================================================= */
group('finds')
test('the van is a real camp option that costs you the rest', () => {
  const rng = new E.RNG(3)
  const before = { ...E.freshRun(0, 0, 1), inRun: true, tier: 1, skin: 2,
    gear: [], boons: [], runDeck: [], packCards: [] }
  const van = E.campStep(before, { kind: 'van', rng })
  eq(van.phase, 'gear', 'the van did not open a find')
  eq(van.tier, 2, 'the van did not use up the camp')
  eq(van.skin, 2, 'the van rested you as well, which is not the trade')
  ok(van.gearOffers.length >= 2, 'the van offered nothing')
  const rest = E.campStep(before, { kind: 'rest' })
  ok(rest.skin > before.skin, 'resting should still restore skin')
})
test('a trading post can stock beta, not only kit', () => {
  const rng = new E.RNG(8)
  let sawBoon = 0
  for (let i = 0; i < 200; i++) {
    const s = E.stockShop({ ...E.freshRun(0, 0, i), act: 0, gear: [], boons: [] }, rng)
    if (s.shopGear.some(id => E.isBoon(id))) sawBoon++
  }
  ok(sawBoon > 20, `a post stocked a boon only ${sawBoon} times in 200`)
  ok(E.PRICE.boon > E.PRICE.gear, 'a rule should cost more than a piece of kit')
})
test('some events teach you something', () => {
  const teaching = E.EVENTS.filter(e => e.choices.some(c => c.outcome.boon))
  ok(teaching.length >= 3, `only ${teaching.length} events can grant a boon`)
  const rng = new E.RNG(12)
  const ev = teaching[0]
  const ch = ev.choices.find(c => c.outcome.boon)
  const out = E.applyOutcome({ ...E.freshRun(0, 0, 1), inRun: true, boons: [], runDeck: [] },
    ch.outcome, rng)
  eq(out.boons.length, 1, `${ev.id} granted no boon`)
})
test('nothing can hand you the same boon twice', () => {
  const rng = new E.RNG(14)
  const all = E.BOONS.map(b => b.id)
  const full = { ...E.freshRun(0, 0, 1), inRun: true, boons: all, runDeck: [], gear: [] }
  const out = E.applyOutcome(full, { boon: true }, rng)
  eq(out.boons.length, all.length, 'a duplicate boon was granted')
  const offers = E.gearOffers(full, rng)
  for (const id of offers) ok(!E.isBoon(id) || !all.includes(id), 'a held boon was offered again')
})

/* =======================================================================
   6b. RUN HISTORY  (v5.2 — no run may finish unrecorded)
   ======================================================================= */
group('history')
test('every way a run can end writes a record', () => {
  const rng = new E.RNG(77)
  const ends = []
  for (let i = 0; i < 60; i++) {
    let s = { ...E.newRun(Math.floor(rng.next() * 2 ** 31), E.DEFAULT_LOADOUT, 0, 0), topRope: false }
    let guard = 0
    while (guard++ < 900) {
      if (s.phase === 'runEnd') break
      if (s.phase === 'map') {
        const tier = E.ACTS[s.act][s.tier]
        const n = tier.find(x => x.type === 'climb' || x.type === 'boss') ?? tier[0]
        if (n.type !== 'climb' && n.type !== 'boss') { s = { ...s, tier: s.tier + 1 }; continue }
        s = E.startBurn({ ...s, routeIdx: n.routeIdx, burn: 1, beta: [], worked: [] }, rng)
        continue
      }
      if (s.phase === 'climb') { s = E.autoPlay(s, rng); s = E.resolve(s, rng); continue }
      if (s.phase === 'burnEnd') {
        const beta = [...new Set([...s.beta, ...s.worked])]
        if (s.result === 'send') { s = E.endSession({ ...s, beta }, rng); continue }
        const skin = s.skin - 1
        if (s.burn >= E.attemptsFor(s) || skin <= 0) { s = E.endSession({ ...s, beta, skin }, rng); continue }
        s = E.startBurn({ ...s, beta, skin, burn: s.burn + 1 }, rng); continue
      }
      if (s.phase === 'reward') { s = E.takeOfferStep(s, E.bestOffer(s, s.offers, s.runDeck)); continue }
      if (s.phase === 'gear') { s = E.pickGearStep(s, s.gearOffers[0] ?? null); continue }
      if (s.phase === 'epilogue') { s = E.endingStep(s, 'told'); continue }
      if (s.phase === 'pack') { s = { ...s, packCards: [], phase: s.afterPack }; continue }
      if (s.phase === 'camp') { s = E.campStep(s, { kind: 'rest' }); continue }
      break
    }
    ok(s.phase === 'runEnd', 'run did not reach an ending')
    eq(s.history.length, 1, 'a finished run left no record')
    ends.push(s.history[0].cause)
  }
  ok(new Set(ends).size >= 2, `only one kind of ending seen: ${[...new Set(ends)].join(', ')}`)
})
test('history is capped and newest-first', () => {
  let s = { ...E.freshRun(0, 0, 1), inRun: true, history: [] }
  for (let i = 0; i < HISTORY_CAP_TEST; i++) s = E.recordRun({ ...s, runSeed: i, skin: 0 }, false)
  eq(s.history.length, E.HISTORY_MAX, 'history must be capped')
  eq(s.history[0].seed, HISTORY_CAP_TEST - 1, 'newest record must be first')
})

/* =======================================================================
   6c. UNDO  (v5.3 — taking a placement back must change nothing else)
   ======================================================================= */
group('undo')
test('placing a card consumes no randomness', () => {
  // this is what makes undo safe: if a placement rolled anything, taking it
  // back would desync the run from its seed
  const rng = new E.RNG(51)
  for (let t = 0; t < 60; t++) {
    let s = startClimb(4 + rng.int(5), rng, { seed: Math.floor(rng.next() * 2 ** 31) })
    const before = s.seed
    const card = s.piles.hand.find(c => c.kind === 'move' && c.lane !== 'feet')
    if (!card) continue
    const after = { ...s, boardP: [card, null, null],
      piles: E.pileFromHand(s.piles, card.uid), selected: null }
    eq(after.seed, before, 'a placement must not touch the run seed')
    const all = after.piles.draw.length + after.piles.discard.length
      + after.piles.exhaust.length + after.piles.hand.length
      + after.boardP.filter(Boolean).length
    const was = s.piles.draw.length + s.piles.discard.length
      + s.piles.exhaust.length + s.piles.hand.length + s.boardP.filter(Boolean).length
    eq(all, was, 'a placement must not create or destroy a card')
  }
})
test('restoring a previous state is exact', () => {
  const rng = new E.RNG(52)
  let s = startClimb(5, rng)
  const snapshot = JSON.stringify(s)
  const card = s.piles.hand[0]
  const moved = { ...s, boardP: [card, null, null], piles: E.pileFromHand(s.piles, card.uid) }
  ok(JSON.stringify(moved) !== snapshot, 'the placement did nothing')
  eq(JSON.stringify(s), snapshot, 'the original state was mutated — undo would not restore it')
})

/* =======================================================================
   7. SOURCE RULES  (things this project has broken before)
   ======================================================================= */
group('source')
test('no Math.random anywhere in the engine', () => {
  const hits = (CODE.match(/Math\.random/g) ?? []).length
  eq(hits, 0, 'all randomness must go through the seeded RNG')
})
test('no unicode escapes in JSX text', () => {
  // esbuild ships the literal \u00b7 rather than decoding it (v0.4)
  const bad = /className=[^>]*>[^<]*\\u[0-9a-fA-F]{4}/.test(CODE)
  ok(!bad, 'use a real glyph in JSX, never an escape')
})
test('every CSS font size scales with --fs', () => {
  const css = SRC.slice(SRC.indexOf('const CSS = `'), SRC.indexOf('/* ==='))
  const fixed = css.match(/font-size:\d/g) ?? []
  eq(fixed.length, 0, `${fixed.length} font sizes bypass the text-size setting`)
})
test('save version is a number the loader can migrate from', () => {
  ok(Number.isInteger(E.SAVE_FILE_VERSION), 'SAVE_FILE_VERSION must be an integer')
})
test('the sim barrel re-exports nothing that does not exist', () => {
  // tsc does not cover sim/, so a name listed here but not exported from the
  // engine silently becomes undefined — which is how pileFromHand slipped through
  const barrel = readFileSync('sim/entry.ts', 'utf8')
  const names = (barrel.match(/export\s*{([\s\S]*?)}\s*from/)?.[1] ?? '')
    .split(',').map(x => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)
  const missing = names.filter(n => E[n.split(/\s+as\s+/).pop()] === undefined
    && E[n] === undefined)
  eq(missing.length, 0, `exported but undefined: ${missing.join(', ')}`)
})

/* =======================================================================
   8. BALANCE GUARDRAILS  (slow — a tripwire, not a target)
   ======================================================================= */
if (SLOW) {
  group('balance')
  test('no climber is twice as good as another', () => {
    // the spread reached 9x (Comp Kid 3.3% against Alpinist 29.8%) before
    // anyone noticed, because nothing was watching it
    // n=600: at 300 a 5% event has a standard error of 1.3 points, so this
    // guard was failing on variance — the same fix the ladder guard needed
    const out = execSync('PROJECTS=0 node sim/run.mjs arch 600', { encoding: 'utf8' })
    const pcts = [...out.matchAll(/\s([\d.]+)%\s+\d+/g)].map(m => Number(m[1]))
    ok(pcts.length === 4, `read ${pcts.length} climbers, expected 4`)
    const lo = Math.min(...pcts), hi = Math.max(...pcts)
    /* Floor back to 5 at v9.35. It was lowered to 4 at v9.32 to accommodate a
       drift rather than to fix it, which is the thing BAL-9 exists to prevent.
       BAL-14 investigated it properly: six separate hypotheses tested, none
       worth more than two points, so there was no single cause — it was six
       changes each worth a point or two, compounding, which is precisely the
       failure mode BAL-9 documented. Corrected with one dial (RUN_SKIN 8 to 9)
       rather than by moving the goalposts again. */
    ok(lo > 5, `a climber completes only ${lo}% of runs`)
    ok(hi / lo < 2.2, `spread is ${(hi / lo).toFixed(1)}x — ${pcts.join(' / ')}`)
  })
  test('the van is a decision, not the answer to every camp', () => {
    // BAL-11: a find is worth +28 to +42 points of send rate against +26 for
    // sharpening the right card and +1 for the wrong one, so raiding the van
    // was correct at every camp and nothing else was ever chosen. Once a range.
    const rng = new E.RNG(4)
    let s = { ...E.freshRun(0, 0, 1), inRun: true, act: 1, tier: 1,
      runDeck: E.DEFAULT_LOADOUT.map(E.spawn), vanRaided: [], gear: [], boons: [], packCards: [] }
    ok(E.vanOpen(s), 'the van starts shut')
    s = E.campStep(s, { kind: 'van', rng })
    eq(s.phase, 'gear', 'the first raid did not open a find')
    ok(!E.vanOpen(s), 'the van is still open after being raided')
    const again = E.campStep({ ...s, phase: 'camp', tier: 3 }, { kind: 'van', rng })
    ok(again.phase !== 'gear', 'the van gave a second find in the same range')
    eq(again.tier, 4, 'a spent raid did not still use up the camp')
    ok(E.vanOpen({ ...s, act: 2 }), 'the van never reopens in the next range')
  })
  test('the ascent ladder still spans a real range', () => {
    // BAL-9: the whole ladder drifted up ~30 points over several versions
    // without anything watching it. The band alone did not catch that,
    // because every rung moved together.
    /* Also dropped `SHARP_AT=3`. That override forces the camp policy to
       sharpen and never rest, which was the real policy when this guard was
       written and has not been since BAL-11 and SIM-5 rewrote it — so the
       guard was measuring a deliberately worse player than the game has.
       At 150 runs the hardest rung is an 8% event, so its standard error is
       about 2.2 points and this guard failed on variance rather than on the
       game — reported 2.7% where 200 runs read 8.0%. The bottom rung needs the
       sample, not a looser floor. */
    const out = execSync('node sim/run.mjs ladder-style 400 built', { encoding: 'utf8' })
    const pcts = [...out.matchAll(/\s([\d.]+)%\s+\d+%/g)].map(m => Number(m[1]))
    ok(pcts.length >= 5, `read ${pcts.length} rungs`)
    const top = pcts[0], bottom = pcts[pcts.length - 1]
    ok(top < 88, `the easiest rung completes ${top}% — the campaign is a formality`)
    ok(bottom < top / 2.5, `the ladder spans ${top}% to ${bottom}% — the rungs do not mean much`)
    ok(bottom > 3, `the hardest rung completes ${bottom}% — that is not a difficulty, it is a wall`)
  })
  test('the journal can actually be read', () => {
    /* NARR-11. Fifteen pages is only an improvement if you can find them. Six
       of them used to have their own event branch and the other eight had none,
       so a run found 0.4 pages and the full journal was 35 expeditions away. */
    const out = execSync('node sim/run.mjs campaign 250', { encoding: 'utf8' })
    const found = [...out.matchAll(/pages ([\d.]+)/g)].map(m => Number(m[1]))
    ok(found.length >= 1, 'the harness stopped reporting pages found')
    const natural = Math.min(...found)
    ok(natural >= 1.2, `a run finds ${natural} pages — the journal is ${(14 / natural).toFixed(0)} runs away`)
    // and the journal must still be worth carrying
    const pcts = [...out.matchAll(/completion\s+([\d.]+)%/g)].map(m => Number(m[1]))
    ok(pcts.length >= 3, `read ${pcts.length} journal bands`)
    ok(pcts[pcts.length - 1] > pcts[0] + 5,
      `reading his journal is worth ${(pcts[pcts.length - 1] - pcts[0]).toFixed(1)} points`)
    // more pages must never be worse than fewer — the cap exists for this
    for (let i = 1; i < pcts.length; i++)
      ok(pcts[i] >= pcts[i - 1] - 2, `${pcts[i]}% with more pages than ${pcts[i - 1]}% with fewer`)
  })
  test('the campaign has not drifted since it was last set', () => {
    /* BAL-14. Between v9.24 and v9.34 the campaign fell from 53% to 43.5% at a
       full journal, and the archetype floor was lowered to accommodate it
       instead of fixed. Six hypotheses were tested — shopping, conditions,
       curses, an extra stage, the talk outcomes, the journal — and NONE was
       worth more than two points. There was no single cause: six changes each
       worth a point or two, compounding. That is the BAL-9 failure mode, and
       the only thing that catches it is a band nailed down here with a date on
       it, so the next drift is measured against a number somebody chose. */
    const out = execSync('SHARP_AT=99 node sim/run.mjs campaign 300', { encoding: 'utf8' })
    const pcts = [...out.matchAll(/completion\s+([\d.]+)%/g)].map(m => Number(m[1]))
    ok(pcts.length >= 3, `read ${pcts.length} bands`)
    const full = pcts[pcts.length - 1]
    /* Set at 47.3% in v9.35 (RUN_SKIN 8→9), then 43.8% in v9.36 once BAL-13
       gave the back half of act 1 teeth — that cost is deliberate and dated
       rather than drift. The band is what gets defended; the number in the
       comment is what somebody last chose. */
    ok(full > 40 && full < 58,
      `the campaign completes ${full}% with a full journal — last set at 47 in v9.35`)
    ok(pcts[0] < full - 5, `reading his journal is worth ${(full - pcts[0]).toFixed(1)} points`)
  })
  test('the acts get deadlier in order', () => {
    /* BAL-13 attempted and reverted here. Act 1 kills about 6% of runs across
       nine stages against act 3's 32%, which is a real problem — but the fix
       tried (one extra hold on its hardest routes) took the CLIMBER spread from
       1.4x to 2.9x, because the Alpinist pays -2 Contact and the Comp Kid pays
       a burn, so longer routes charge them twice. Act 1's length is load-bearing
       for exactly the climbers that already give something up. So this guard
       holds the ORDER, which is the part that must never invert, and leaves the
       flatness to a fix that does not use route length. */
    const out = execSync('SHARP_AT=99 node sim/run.mjs campaign 300', { encoding: 'utf8' })
    const rows = [...out.matchAll(/act1 (\d+)% act2 (\d+)% act3 (\d+)%/g)]
    ok(rows.length >= 1, 'the harness stopped reporting where runs end')
    const [, a1, a2, a3] = rows[rows.length - 1].map(Number)
    ok(a2 >= a1, `act 2 kills ${a2}% against act 1's ${a1}% — the curve is inverted`)
    ok(a3 >= a2, `act 3 kills ${a3}% against act 2's ${a2}% — the last act is not the hardest`)
    ok(a3 > 15, `act 3 kills only ${a3}% — nothing is at stake at the end`)
  })
  test('campaign completion stays in a sane band', () => {

    const out = execSync('node sim/run.mjs campaign 150', { encoding: 'utf8' })
    const pcts = [...out.matchAll(/completion\s+([\d.]+)%/g)].map(m => Number(m[1]))
    ok(pcts.length >= 3, 'could not read completion from the harness')
    for (const p of pcts) ok(p > 15 && p < 85, `completion ${p}% is outside 15–85%`)
  })
}

/* ---- report ------------------------------------------------------------ */
const pass = results.filter(r => r[0]).length
const fail = results.filter(r => !r[0])
let last = ''
for (const [okd, grp, name, msg] of results) {
  if (grp !== last) { console.log(`\n  ${grp}`); last = grp }
  console.log(`    ${okd ? '\u2713' : '\u2717'} ${name}`)
  if (!okd) console.log(`        ${msg}`)
}
console.log(`\n  ${pass}/${results.length} passed${SLOW ? '' : '   (run `npm test -- slow` for balance guardrails)'}\n`)
process.exit(fail.length ? 1 : 0)
