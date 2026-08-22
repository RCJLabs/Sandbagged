/* SANDBAGGED — the kept suite.
 *
 * Fifteen one-off harnesses were written across this project, each proving
 * something real, and every one of them was thrown away. This is those checks,
 * kept, so a future change cannot quietly undo what they proved.
 *
 *   node sim/test.mjs        all of it
 *   node sim/test.mjs slow   plus the balance guardrails
 *
 * The slow block is the dated completion ledger and it is EXPENSIVE — roughly
 * 11,300 campaign runs across a dozen child processes, about four minutes on a
 * laptop. It is NOT the "~20s" this header used to claim, and that understatement
 * is a large part of why it got skipped. (GUARD-6 also cut ~4,800 wasted runs:
 * three guards read only the full-journal band but were paying for all three, so
 * they now pass PAGES=14.) `npm run test:slow` runs it and `npm run
 * ship` will not build without it (GUARD-6: it used to be reachable only by
 * typing `slow` by hand, so a release could be cut without the band ever being
 * evaluated).
 */
import { build } from 'esbuild'
import { readFileSync, unlinkSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { BAND_PIN, ENDING_N, ARCH_N, ARCH_FLOOR, ARCH_TOL, BAND_LOG } from './band.mjs'

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
/* GUARD-8: shared with test-core.mjs, one copy, because two copies of one rule drift
   (ENG-19). `ok`/`eq` refuse an assertion with no failure message; `region` refuses a
   source window that cannot prove it is reading the right text. */
import { ok, eq, region, tail, stripComments } from './guard.mjs'

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

test('ENG-23: flow is a track with two breakpoints, and it never buys the clock', () => {
  // the track is real now: two breakpoints and a higher ceiling
  ok(E.FLOW_AT < E.FLOW_HIGH, 'the dialed tier is not above the flow tier')
  ok(E.FLOW_MAX >= E.FLOW_HIGH, 'flow cannot even reach the dialed tier')
  ok(E.FLOW_MAX > 3, 'the flow cap was not raised past the old 3')
  // the dyno odds graduate across BOTH breakpoints — not one on/off switch
  const base = { ...E.freshRun(4, 0, 1), inRun: true, skirmish: null, boardP: [null, null, null], pump: 4 }
  const none = E.stickChance({ ...base, flow: 0 })
  const inflow = E.stickChance({ ...base, flow: E.FLOW_AT })
  const dialed = E.stickChance({ ...base, flow: E.FLOW_HIGH })
  ok(inflow > none, `flow does not help the dyno: ${none.toFixed(2)} vs ${inflow.toFixed(2)}`)
  ok(dialed > inflow + 0.05, `dialing in barely helps the dyno: ${inflow.toFixed(2)} vs ${dialed.toFixed(2)}`)
  // flow must NEVER touch the clock — a per-turn pump relief compounds (it was
  // measured at +7 to +13 points of completion and cut). The end-of-turn pump
  // is identical at every flow level for an identical board.
  const rng = new E.RNG(4)
  const s0 = startClimb(4, rng, { seed: 5 })
  const hold = { ...s0.holdDeck[0], clean: true, crux: false }
  const b = { ...s0, pump: 0, boardH: [hold, null, null], boardP: [null, null, null], line: 0, mutators: [], boons: [] }
  const lanes = [
    { clears: true, biteToPump: 0, hold: true, card: true, blows: false },
    { clears: false, biteToPump: 0, hold: false, card: false, blows: false },
    { clears: false, biteToPump: 0, hold: false, card: false, blows: false },
  ]
  const clock = f => E.previewPump({ ...b, flow: f }, lanes)
  eq(clock(E.FLOW_HIGH - 1), clock(E.FLOW_HIGH - 2), 'dialing in changed the clock — flow is buying pump again')
  eq(clock(E.FLOW_MAX), clock(0), 'flow is buying pump')
  // and the raised cap must not have buffed the explosive stat through momentum
  const eng = readFileSync('src/engine.ts', 'utf8')
  ok(/momentum'\)\s*p \+= Math\.min\(3, s\.flow\)/.test(eng),
    'momentum Power is no longer capped at the old ceiling — the raised flow cap is buffing Power')
})

test('ENG-24: dialed-in flow reads the wall — information, never the clock', () => {
  // the tax relief is spent by FLOW_AT (HANG_TAX is 1), so flow 3-5 gave a
  // no-momentum deck nothing; the top of the bar pays in a read now. Crucially
  // it must NOT ease the pump — that per-turn relief was measured at +7..+13 and
  // cut (the guard above pins the clock; this pins the reward and re-pins the pump).
  ok(E.FLOW_READ > 0, 'the flow read is nothing')
  const H = (uid, grip) => ({ uid, name: 'crimp', bite: 3, grip, crux: false, clean: false })
  const turn = flow => E.resolve({ ...E.freshRun(0, 0, 5), inRun: true, skirmish: null, phase: 'climb',
    beta: ['crimp'], flow, pump: 10, cleared: 0, worked: [], turn: 5, order: [], readAhead: 0,
    boardH: [H(1, 1), H(2, 8), null], boardP: [E.spawn('Crimp Grip'), null, null], feetDeck: [],
    holdDeck: Array.from({ length: 6 }, (_, k) => H(200 + k, 5)),
    piles: { draw: [], discard: [], exhaust: [], hand: [] } }, new E.RNG(1))
  const high = turn(E.FLOW_HIGH - 1)   // clearing a hold pushes flow up to FLOW_HIGH
  const low = turn(E.FLOW_AT - 1)      // ...only to FLOW_AT, below the dialed tier
  ok(high.readAhead > low.readAhead, 'reaching FLOW_HIGH did not read further up the wall')
  eq(high.pump, low.pump, 'high flow changed the pump — the cut clock relief crept back')
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

group('weather window (ROUTE-6 / ROUTE-7)')
const WINDOWED = E.ROUTES.map((r, i) => [r, i]).filter(([r]) => r.window)
test('every weather window is telegraphed a hold before it lands and never touches Power', () => {
  ok(WINDOWED.length >= 1, `no route carries a weather window`)
  for (const [spec, idx] of WINDOWED) {
    const w = spec.window
    ok(w.at > 0 && w.at < 1, `${spec.name}: the window lands partway up, not at the start or top`)
    ok(w.warn && w.text, `${spec.name}: the window has a warning and an arrival line`)
    // ENG-20's absolute rule: conditions move Bite and Support, never Power.
    ok(!('dPower' in w) && !('powerAll' in w) && !('dPowerAll' in w),
      `${spec.name}: a weather window must never carry a Power term`)
    const base = { ...E.freshRun(idx, 0, 5), inRun: true, skirmish: null,
      weather: 1, rock: 0, boardH: [null, null, null], boardP: [null, null, null] }
    const thresh = Math.ceil(w.at * spec.clear)
    const before = { ...base, cleared: thresh - 1 }
    const after = { ...base, cleared: thresh }
    ok(!E.windowOf(before), `${spec.name}: the window is not active the hold before it lands`)
    const near = E.windowNear(before)
    ok(near && near.away === 1, `${spec.name}: telegraphed exactly one hold before it lands`)
    ok(E.windowOf(after), `${spec.name}: the window is active once you reach its height`)
    ok(!E.windowNear(after), `${spec.name}: nothing left to telegraph once it has landed`)
    // With no feet on, Support is 0 either way, so a move's Power is untouched:
    // the window only ever reaches Bite and (with feet on) Support.
    const card = E.spawn('Crimp Grip')
    const hold = { name: 'crimp', grip: 5, bite: 3 }
    eq(E.powerAgainst(after, card, hold, 0), E.powerAgainst(before, card, hold, 0),
      `${spec.name}: the window changed a move's Power, which conditions must never do`)
    eq(E.biteAgainst(after, card, hold, 0) - E.biteAgainst(before, card, hold, 0), w.dBite ?? 0,
      `${spec.name}: the window did not sharpen Bite by the amount it states`)
  }
})
test('the preview stays exact on the turn a window shuts', () => {
  /* A window feeds Bite through biteAgainst and Support through powerAgainst,
     both of which the preview already routes through — so it must be exact for
     free. Forced to the window height so every measured turn has it shut. */
  const rng = new E.RNG(9091)
  for (const [spec, idx] of WINDOWED) {
    const thresh = Math.ceil(spec.window.at * spec.clear)
    let seen = 0, bad = 0
    for (let t = 0; t < 60; t++) {
      let st = startClimb(idx, rng, { seed: Math.floor(rng.next() * 2 ** 31) })
      st = E.autoPlay({ ...st, cleared: thresh }, rng)
      ok(E.windowOf(st), `${spec.name}: the window should be shut at this height`)
      const lanes = [0, 1, 2].map(i => E.previewLane(st, i))
      const predicted = lanes.filter(p => p.clears).length
      const before = st.cleared
      const next = E.resolve(st, rng)
      const rewound = next.burn !== st.burn || next.cleared < before
      if (!lanes.some(p => p.stick !== undefined) && !rewound) {
        seen++
        if (next.cleared - before !== predicted) bad++
      }
    }
    ok(seen > 35, `${spec.name}: only ${seen} turns measured with the window shut`)
    eq(bad, 0, `${spec.name}: the preview mismatched resolve on ${bad} of ${seen} turns`)
  }
})
test('COND-2: the sky moves twice — a window can pass, and says so', () => {
  /* Every window in this game used to be a one-way switch: it shut at `at` and stayed shut to
     the top of the route, on 2 of 37 lines. Measured on the full journal before this ticket,
     1.94% of climb turns sat inside a live condition and 6.82% of burns ever reached one — so
     "the conditions change" was true of almost no turn anybody played. This holds the three
     things that fixed it: a window can pass, passing is announced, and passing genuinely takes
     its numbers back off. (Why the window and not `s.weather`: WEATHER[...].dContact is baked
     into every card's contact at startBurn, so moving the weather mid-burn leaves every card in
     hand carrying the old number — the ENG-26 divergence. A window only ever touches the
     modifiers that are read live, which is why it is the mechanism that can move.) */
  const TEMP = WINDOWED.filter(([r]) => r.window.until !== undefined)
  ok(TEMP.length >= 3, `only ${TEMP.length} route(s) in the game carry a window that can pass`)
  /* A window that shuts for good is a set-piece you are meant to fight to the top through, so
     the finale keeps one. Any ordinary line whose sky shuts forever is the old bug back. */
  for (const [spec] of WINDOWED)
    ok(spec.window.until !== undefined || spec.finale,
      `${spec.name}: an ordinary route's window shuts and never re-opens`)

  const card = E.spawn('Crimp Grip')
  const hold = { name: 'crimp', grip: 5, bite: 3 }
  for (const [spec, idx] of TEMP) {
    const w = spec.window
    ok(w.until > w.at && w.until <= 1, `${spec.name}: until=${w.until} is not above at=${w.at}`)
    // it may not quietly stop doing something to you: `clear` is required wherever `until` is
    ok(w.clear && w.clear !== w.text && w.clear !== w.warn,
      `${spec.name}: nothing of its own is said when the window passes`)

    const feet = { ...E.spawn('Flag'), set: true }
    const base = { ...E.freshRun(idx, 0, 5), inRun: true, skirmish: null, turn: 4,
      weather: 1, rock: 0, boardH: [null, null, null], boardP: [null, null, feet] }
    const shutAt = Math.ceil(w.at * spec.clear), passAt = Math.ceil(w.until * spec.clear)
    ok(passAt > shutAt, `${spec.name}: the window passes on the same hold it lands on`)
    const below = { ...base, cleared: 0 }
    const inside = { ...base, cleared: passAt - 1 }
    const past = { ...base, cleared: passAt }
    ok(E.windowOf(inside), `${spec.name}: the window is not live on the hold before it passes`)
    ok(!E.windowOf(past), `${spec.name}: the window is still live ${w.until} of the way up`)
    ok(!E.windowNear(past), `${spec.name}: a window that has passed telegraphs itself all over again`)

    /* And the numbers come back off — past it the wall reads exactly as it did below it.
       Driven off the terms the window DECLARES rather than a fixed one: COND-3 gave a window
       `dContact` and this block, written when every window was `dSupport`, went from proving
       the mechanism to proving one route's flavour. */
    const reads = {
      dSupport: st => E.supportNow(st),
      dBite: st => E.biteAgainst(st, card, hold, 0),
      dContact: st => E.contactOf(st, card),
    }
    const terms = Object.keys(reads).filter(k => w[k])
    ok(terms.length > 0, `${spec.name}: the window is declared but does nothing at all`)
    for (const k of Object.keys(reads)) {
      const [b, i2, p2] = [below, inside, past].map(reads[k])
      if (w[k]) {
        ok(b > 0, `${spec.name}: the fixture has no ${k} to move, so this proves nothing`)
        ok(k === 'dBite' ? i2 > b : i2 < b, `${spec.name}: the window moved no ${k} while it was shut`)
      }
      eq(p2, b, `${spec.name}: ${k} did not come back when the window passed`)
    }
  }

  /* And it is SAID. A condition lifting silently is worse than one that never lifts: the
     numbers change under a player who was given no reason. Driven through real turns rather
     than asserted off the state, because the announcement lives in resolve. */
  const rng = new E.RNG(4404)
  /* The board is handed easy holds and no pump on purpose. Left to the starter deck on the
     real wall at that height, Sun Dagger cleared nothing on 40 of 40 attempts and this whole
     block passed on an empty sample — which is the fixture-never-fires class of bug three
     guards in this suite have already shipped with. The turn under test is the one where a
     hold clears at `until`, so the fixture's job is to make that happen every time. */
  const easyBoard = () => [{ name: 'jug', grip: 1, bite: 0 }, { name: 'jug', grip: 1, bite: 0 },
    { name: 'smear edge', grip: 1, bite: 0 }]
  for (const [spec, idx] of TEMP) {
    const w = spec.window
    const passAt = Math.ceil(w.until * spec.clear)
    let crossed = 0, said = 0
    for (let t = 0; t < 40 && crossed < 3; t++) {
      let st = startClimb(idx, rng, { seed: Math.floor(rng.next() * 2 ** 31) })
      st = E.autoPlay({ ...st, cleared: passAt - 1, pump: 0, boardH: easyBoard() }, rng)
      if (!E.windowOf(st)) continue
      const next = E.resolve(st, rng)
      if (next.cleared < passAt || next.burn !== st.burn) continue
      crossed++
      if (next.log.some(l => l.includes(w.clear))) said++
    }
    ok(crossed >= 1, `${spec.name}: never once climbed out of the window, so nothing was tested`)
    eq(said, crossed, `${spec.name}: the window passed ${crossed} time(s) and was announced ${said}`)
  }

  /* One clock, read in one place, so resolve and the preview can never disagree about whether
     the sky is still shut — the whole reason ROUTE-6 put the window behind a function. */
  const body = region(CODE, 'export function windowOf', ['export function windowNear'],
    { min: 120, what: 'windowOf' })
  ok(/w\.until !== undefined && f >= w\.until/.test(body), 'windowOf does not close the window at `until`')
  const inFn = (body.match(/\.until\b/g) ?? []).length
  const all = (CODE.match(/\.until\b/g) ?? []).length
  eq(all, inFn, `the window's clock is read in ${all - inFn} place(s) outside windowOf`)
})
test('ROUTE-7: the bosses are not all the same trick', () => {
  /* The audit's finding: bosses reused a compact phase set and only lockLane
     was dramatic. Every boss must be readable as one named thing, and across
     them the dramatic mechanics must actually vary — a locked limb, a closing
     window, committing holds, a faster clock — not four flavours of dBite. */
  const bosses = E.ROUTES.filter(r => (r.phases && r.phases.length) || r.window || r.finale)
  ok(bosses.length >= 4, `only ${bosses.length} bosses found`)
  for (const b of bosses)
    ok(b.signature || (b.phases && b.phases.length) || b.window,
      `${b.name} has nothing the map can name it by`)
  // the distinct dramatic mechanics that appear across the bosses
  const kinds = new Set()
  for (const b of bosses) {
    if (b.window) kinds.add('window')
    for (const p of b.phases ?? []) {
      if (p.lockLane !== undefined) kinds.add('lock')
      if (p.allCrux) kinds.add('crux')
      if (p.noRest) kinds.add('norest')
      if (p.dTax) kinds.add('tax')
      if (p.dBite) kinds.add('bite')
    }
  }
  ok(kinds.has('lock'), 'no boss takes a limb — lockLane went unused')
  ok(kinds.has('window'), 'no boss turns the weather — ROUTE-6 unused on a boss')
  ok(kinds.size >= 4, `the bosses only muster ${kinds.size} distinct threats — too samey`)
})

group('a deck can commit to a shape (DECK-4)')
test('DECK-4: the shape a deck commits to can be paid for', () => {
  /* The row said deckbuilding pays in raw stats with no shape to commit to. The opposite was
     true and worse. Measured over 600 finished runs, EVERY run ends with 11 cards of one family
     and about four and a half families big enough to pay a specialist — decks are heavily
     shaped. What was broken was the payoff: the drafter was offered a specialist 2,394 times
     and took it ZERO times, and 1,841 of those offers arrived with none of that specialist's
     family in the deck at all.

     The root cause was not the price and not the odds. `REWARDS` is a curated shelf of 27 cards
     and it held exactly TWO of the game's twelve specialists — so for nine of the eleven
     families a deck can commit to, the card that pays for the commitment WAS NOT OBTAINABLE. */
  const specialists = Object.values(E.CARDS).filter(c => c.synergy)
  ok(specialists.length >= 10, `only ${specialists.length} specialists exist`)
  const families = [...new Set(specialists.map(c => c.synergy))]
  ok(families.length >= 8, `only ${families.length} families have a specialist at all`)

  /* 1. Every family a deck can commit to has a payoff the game can hand you. This is the
     assertion the old reward shelf failed for nine families out of eleven. */
  for (const fam of families) {
    const deck = []
    const feeder = Object.values(E.CARDS).find(c =>
      E.tagOf(c) === fam && !c.synergy && c.rarity !== 'curse')
    ok(feeder, `nothing in the game is a plain ${fam} card, so the family cannot be built`)
    for (let i = 0; i < E.SYNERGY_PER; i++) deck.push(E.spawn(feeder.name))
    const pay = E.commitPayoff(deck)
    ok(pay, `a deck of ${E.SYNERGY_PER} ${fam} cards is offered no payoff for committing`)
    eq(E.CARDS[pay].synergy, fam, `the ${fam} payoff is ${pay}, which pays for ${E.CARDS[pay].synergy}`)
  }

  /* 2. and it holds its fire until there is a family at all.

     LANE-2 MOVED THIS GATE FROM A COUNT TO MERIT, and had to. DECK-4 keyed on a family of
     COMMIT_AT = 8, which was only reachable because the loadout builder's family bonus handed
     you 9 of one family for free; LANE-2 removed that bonus and the payoff went from reaching
     94.3% of runs to 11.2%, so DECK-4 was dead code one ticket after it shipped. The gate is
     now the specialist for your largest family, substituted only when it beats the card it
     displaces — which restores it to 92.2% of runs and, unlike a count, cannot make the shelf
     worse. What is asserted here is therefore the floor (a family has to exist) and, below,
     that the substitution is never a downgrade. */
  const crimps = n => [...Array(n)].map(() => E.spawn('Crimp Grip'))
  /* A deck of n plain cards of ONE family, whichever family the game's own builder commits to.
     Hardcoding crimps here is what broke three of the fixtures below when the deck under test
     became the real built loadout: a crack specialist priced against a crimp deck measures the
     absence of a family rather than the presence of one. */
  const fam3 = n => {
    const built = E.buildLoadout({ ...E.freshRun(0, 0, 1),
      owned: Object.keys(E.CARDS).filter(x => ['common', 'uncommon', 'rare'].includes(E.CARDS[x].rarity ?? 'common')),
      gear: [], boons: [], mutators: [] }, [], Object.keys(E.CARDS)
      .filter(x => ['common', 'uncommon', 'rare'].includes(E.CARDS[x].rarity ?? 'common'))).map(E.spawn)
    const tag = E.CARDS[E.commitPayoff(built)].synergy
    const plain = Object.values(E.CARDS).find(c => E.tagOf(c) === tag && !c.synergy && c.rarity !== 'curse')
    return [...Array(n)].map(() => E.spawn(plain.name))
  }
  ok(!E.commitPayoff(crimps(E.SYNERGY_PER - 1)),
    `a deck of ${E.SYNERGY_PER - 1} of a family already gets a payoff — the floor does nothing`)
  ok(!E.commitPayoff([]), 'an empty deck is offered a payoff for committing to nothing')
  /* And the threshold has to BE a commitment. A deck runs 15 cards built and about 33 by the
     end, so a handful of one family is a coincidence and eight is a plan. Below that this stops
     being the reward for a shape and becomes a tailored card at every reward table. */
  /* LANE-2: COMMIT_AT is gone. It was a count of 8, reachable only because the loadout builder
     handed you 9 of one family for free; with that bonus removed the payoff reached 11.2% of
     runs instead of 94.3%. The floor is now SYNERGY_PER — there has to BE a family — and
     whether the payoff appears is decided on merit against the card it displaces. */
  ok(E.commitPayoff(fam3(E.SYNERGY_PER)), 'a deck with a real family gets no payoff')
  ok(!E.commitPayoff([]), 'an empty deck is somehow committed to something')

  /* 3. It has to REACH the deck, on the path the game actually uses. Note what this does NOT
     claim: that the payoff is the best card on any shelf. With the bake capped it is a weak
     body plus SYNERGY_CAP Power, so it wins by displacing the best rival rather than by beating
     it — a first cut of this asserted "the drafter always takes it" and was simply wrong, which
     the campaign numbers say too (564 of 1,578 payable offers taken). What is true, and is the
     ticket, is that a committed deck now gets its payoff on the shelf and takes it often enough
     to hold one: 92.2% of runs end holding a specialist against 11.2% before.

     LANE-2 also changed what "on the shelf" means. Under DECK-4's count gate the payoff was on
     EVERY shelf once the family hit 8, and this asserted exactly that. Under the merit gate it
     appears only when it beats the card it displaces — about one shelf in seven for a committed
     deck — which compounds over the ~16 shelves a run sees to the same 92% of runs holding one.
     So the per-shelf certainty is gone on purpose and what is asserted is the property that
     actually matters: it appears often enough to arrive, and it is never a downgrade. */
  const st = { ...E.freshRun(8, 1, 7), inRun: true, act: 1 }
  /* THE DECK THE GAME ACTUALLY HANDS PEOPLE, not a synthetic pile. How often the substitution
     fires depends on WHICH specialist your family maps to, because the gate is merit and the
     specialists' own stat lines are uneven: measured over 400 shelves, a crack-committed deck
     gets Crack Rat (1/7) on 70.8% of them and a crimp-committed one gets Crimp Specialist (1/5)
     on 1.0%. A first cut of this used nine identical Crimp Grips — the worst case in the game —
     and concluded the mechanism was dead when the campaign says 92.2% of runs hold a specialist.
     The unevenness is real and is recorded as LANE-3; what belongs here is the deck the builder
     produces, which is what the band is measured on. */
  const owned = Object.keys(E.CARDS).filter(n => ['common', 'uncommon', 'rare'].includes(E.CARDS[n].rarity ?? 'common'))
  const deck = E.buildLoadout({ ...E.freshRun(0, 0, 1), owned, gear: [], boons: [], mutators: [] },
    [], owned).map(E.spawn)
  const payName = E.commitPayoff(deck)
  ok(payName, 'the deck the builder produces is offered no payoff for its own biggest family')
  const pay = E.spawn(payName)
  let shown = 0, taken = 0, downgrades = 0
  const rank = c => c.power * 2 + c.contact
  for (let seed = 0; seed < 200; seed++) {
    const plain = E.rollOffers(new E.RNG(seed * 7919 + 3), 3, false, 1)
    const offers = E.rollOffers(new E.RNG(seed * 7919 + 3), 3, false, 1, deck, st)
    /* A SUBSTITUTION, not merely a crimp specialist being on the shelf — one can roll there by
       itself, and counting those as substitutions compared a card nothing had displaced and read
       31 false downgrades. Detected by diffing against the shelf the same seed rolls with no
       deck handed in. */
    const subbed = plain.map(c => c.name).join(',') !== offers.map(c => c.name).join(',')
    if (subbed) {
      shown++
      /* THE SUBSTITUTION IS NEVER A DOWNGRADE — the whole reason merit replaced the count.
         Compared against the shelf the same seed would have rolled without a deck. */
      const before = plain.reduce((a, b) => (rank(b) > rank(a) ? b : a))
      // `pay` — the card commitPayoff actually returns. Hardcoding a name here priced the
      // wrong one of the two crimp specialists and read 31 false downgrades.
      if (E.cardValue(st, pay, deck) < E.cardValue(st, before, deck)) downgrades++
      const pick = E.bestOffer(st, offers, deck)
      if (pick && pick.name === payName) taken++
    }
    // and the rest of the shelf is untouched: same seed, same cards but for the one slot
    eq(plain.length, offers.length, 'handing rollOffers a deck changed how many cards it rolled')
  }
  ok(shown > 10, `the payoff reached only ${shown} of 200 shelves — it cannot arrive in a run`)
  eq(downgrades, 0, `${downgrades} substitution(s) put a worse card on the shelf`)
  const perShelf = shown / 200
  ok(1 - Math.pow(1 - perShelf, 16) > 0.5,
    `at ${(100 * perShelf).toFixed(0)}% a shelf the payoff reaches only `
    + `${(100 * (1 - Math.pow(1 - perShelf, 16))).toFixed(0)}% of runs over the ~16 shelves one sees`)
  ok(taken > 0,
    `the payoff was shown 60 times to a committed deck and taken ${taken} — it cannot reach a deck`)
  // a thin deck of the PAYOFF'S OWN family — hardcoding crimps here compared a crack
  // specialist against a crimp deck once the fixture above became the real built loadout
  const own = Object.values(E.CARDS).find(c =>
    E.tagOf(c) === pay.synergy && !c.synergy && c.rarity !== 'curse')
  ok(own, `nothing in the game is a plain ${pay.synergy} card`)
  const thin = [...Array(E.SYNERGY_PER)].map(() => E.spawn(own.name))
  ok(E.cardValue(st, pay, thin) > E.cardValue(st, pay, []),
    'the payoff is worth no more to a deck with its family in it than to an empty one')

  /* 4. The cap is honoured on BOTH sides. The bake gives at most SYNERGY_CAP Power; if the
     drafter prices the uncapped curve it buys Power the rules never hand over. */
  // likewise built from the payoff's own family, not from crimps
  const huge = [...Array(E.SYNERGY_PER * (E.SYNERGY_CAP + 3))].map(() => E.spawn(own.name))
  const rng = new E.RNG(5)
  const burn = E.startBurn({ ...st, runDeck: [...huge, pay], skirmish: null,
    weather: 1, rock: 0 }, rng)
  const dealt = [...burn.piles.draw, ...burn.piles.hand].find(c => c.name === pay.name)
  ok(dealt, 'the specialist was not dealt, so the cap is untested')
  eq(dealt.power - pay.power, E.SYNERGY_CAP,
    `a family of ${huge.length} baked ${dealt.power - pay.power} Power onto its specialist, cap ${E.SYNERGY_CAP}`)
  /* Isolated against a TWIN of the same card with the synergy term stripped, because cardValue
     has deck-size terms of its own — feet coverage moves with the deck's length, and comparing
     two different-sized decks measured that instead of the cap. `tagOf` falls back to the name
     for the twin, so the family term cancels and only the synergy term is left. */
  const twin = { ...pay, synergy: '' }
  const synTerm = d => E.cardValue(st, pay, d) - E.cardValue(st, twin, d)
  const fam = n => [...Array(n)].map(() => E.spawn(own.name))
  const atCap = synTerm(fam(E.SYNERGY_PER * E.SYNERGY_CAP))
  ok(atCap > 0, `the synergy term is worth ${atCap.toFixed(2)} at the cap — it prices nothing`)
  ok(Math.abs(synTerm(huge) - atCap) < 1e-9,
    `the drafter pays ${(synTerm(huge) - atCap).toFixed(2)} more for family it will never be given Power for`)

  /* 5. The payoff DISPLACES the best card on the shelf. Dropped into a spare slot it measured
     +3.1 points of completion against the pin, because being shown the card your deck wants is
     itself the reward — so the shelf makes room for it. */
  const eng = stripComments(readFileSync('src/engine.ts', 'utf8'))
  const body = region(eng, 'export function rollOffers', ['const SK_A'],
    { min: 400, what: 'rollOffers' })
  ok(/rank\(out\[i\]\) > rank\(out\[bestAt\]\)/.test(body),
    'the payoff no longer displaces the best card on the shelf')
  /* And it must not move the run's randomness: the loop draws the same numbers whether a deck
     is handed in or not, so a seed still replays. */
  const a = new E.RNG(4242), b = new E.RNG(4242)
  const plain = E.rollOffers(a, 3, false, 1)
  const tailored = E.rollOffers(b, 3, false, 1, fam3(9), { ...E.freshRun(8, 1, 7), inRun: true, act: 1 })
  eq(a.next(), b.next(), 'handing rollOffers a deck changed how much randomness it consumed')
  eq(plain.length, tailored.length, 'the tailored shelf is a different size')
  /* Not asserted here that the payoff APPEARS — under merit it appears only when it beats what
     it displaces, and whether it does depends on which specialist the family maps to (measured:
     70.8% of shelves for a crack deck, 1.0% for a crimp one, LANE-3). What this fixture is for
     is the randomness, which is the same either way. */
})
test('LANE-5: what a card is worth does not depend on what the deck lacks', () => {
  /* THE END OF A THREE-TICKET ARGUMENT, and this guard replaces LANE-3's because the thing
     LANE-3 contained no longer exists.

     `cardValue` used to pay a feet card +7 against a deck under a quarter feet and +1 against one
     over it — a statement about the DECK priced as the worth of a CARD. LANE-3 could not remove
     it (the offer bar was computed through the same function, so a deck short of feet inflated
     the bar it declined against) and fixed that instead. LANE-4 measured the removal at +14.8
     points of band and found it breaks the climber floor and the spread. LANE-5 bought the two
     climbers back — Comp Kid +1 Power, Trad Dad +1 Contact — and took the term out.

     ASSERTED EXACTLY. Price the same feet card against a nine-card deck with no feet and against
     that deck plus four feet cards. The only thing that may differ is the universal deck-length
     penalty, `deck.length * 0.12`, which is 0.48 across four cards. Measured: 8.480 and 8.000.
     With the urgency in, the gap was 6.48. */
  const st = { ...E.freshRun(8, 1, 7), inRun: true, act: 1 }
  const feetCard = E.spawn('Smear')
  eq(feetCard.lane, 'feet', 'the fixture card is not a feet card')
  const starved = [...Array(9)].map(() => E.spawn('Lock Off'))
  const covered = [...starved, ...[...Array(4)].map(() => E.spawn('Smear'))]
  ok(starved.every(c => c.lane !== 'feet'), 'the starved fixture is not actually short of feet')
  ok(covered.filter(c => c.lane === 'feet').length / covered.length >= 0.25,
    'the covered fixture would not have crossed the old threshold, so this proves nothing')
  const gap = E.cardValue(st, feetCard, starved) - E.cardValue(st, feetCard, covered)
  const lengthOnly = (covered.length - starved.length) * 0.12
  ok(Math.abs(gap - lengthOnly) < 0.05,
    `a feet card is worth ${gap.toFixed(2)} more to a deck with no feet than to one with four, `
    + `against ${lengthOnly.toFixed(2)} for the deck-length penalty alone — the urgency is back `
    + 'in the valuation, and it is a statement about the deck, not about the card')

  /* AND THE OFFER BAR IS ONE VALUATION AGAIN. LANE-3 had to compute it bare; with nothing left to
     strip, asking for a second reading would be machinery with no purpose behind it. */
  const eng = stripComments(readFileSync('src/engine.ts', 'utf8'))
  const body = region(eng, 'export function bestOffer', ['export function trailNote'],
    { min: 200, what: 'bestOffer' })
  ok(!/cardValue\(s, c, deck, true\)/.test(body),
    'bestOffer still asks for a bare valuation, which no longer differs from the full one')
  ok(!/needBonus/.test(body), 'bestOffer adds a deck-need bonus by hand')
})

test('LANE-2: the builder spreads, because concentrating cost three and a half points', () => {
  /* The loadout builder used to carry a family bonus — `v += 3 + have * 2`, capped at
     SYNERGY_PER — described as "build on what the player chose". It compounds: each card of a
     family makes the next one more attractive, so whichever family it starts with, it finishes.
     The deck it handed you was 9 of one family out of 15, three of them duplicate pairs.

     Raced against decks built by the SAME value function and the SAME structural gates, changing
     only that expression, at n=3000 (SE ~1.3):

       bonus as it was    9 of one family, 3 duplicate pairs   42.1%
       bonus removed      biggest family 4, no duplicates      45.5%   (+3.4)
       bonus inverted     7 families, biggest 3                53.0%   (+10.9)

     Monotonic across three settings of one expression, with deaths down in every act. Removed
     rather than inverted, which was Evan's call — the +3.4 is the clean single-variable claim,
     while the +10.9 conflates which cards got picked (two spread decks measured 7.5 apart). */
  const owned = Object.keys(E.CARDS)
    .filter(n => ['common', 'uncommon', 'rare'].includes(E.CARDS[n].rarity ?? 'common'))
  const deck = E.buildLoadout({ ...E.freshRun(0, 0, 1), owned, gear: [], boons: [], mutators: [] },
    [], owned).map(E.spawn)
  eq(deck.length, E.DECK_SIZE, `the builder produced ${deck.length} cards`)

  const tags = {}
  for (const c of deck) { const t = E.tagOf(c); if (t) tags[t] = (tags[t] ?? 0) + 1 }
  const sizes = Object.values(tags).sort((a, b) => b - a)
  /* The bar is a THIRD of the deck. The bonus produced 9 of 15 (60%); without it the builder
     lands on 4 (27%). A third sits between the two and is the shape of the claim rather than the
     exact number, which is what stops this being a snapshot of one build. */
  ok(sizes[0] <= Math.ceil(E.DECK_SIZE / 3),
    `the builder committed ${sizes[0]} of ${E.DECK_SIZE} slots to one family — it is snowballing again`)
  ok(sizes.length >= 5,
    `the built deck holds only ${sizes.length} families, so it is a pile of one thing`)

  // and it stops stacking duplicates, which is what the compounding bonus really bought
  const counts = {}
  for (const c of deck) counts[c.name] = (counts[c.name] ?? 0) + 1
  const dupes = Object.entries(counts).filter(([, n]) => n > 1)
  ok(dupes.length <= 1,
    `the built deck carries ${dupes.length} duplicated cards (${dupes.map(([n, k]) => `${n} x${k}`).join(', ')})`)

  /* AND THE BONUS IS REALLY GONE FROM THE BUILDER, not merely absent from this one build. The
     behavioural assertions above are a property of the deck; this is a property of the code, and
     it is the one that catches somebody reinstating the expression with a different shape. */
  const eng = stripComments(readFileSync('src/engine.ts', 'utf8'))
  /* Ended at `cardValue`, which is the very next function — with `bestOffer` as the anchor this
     window swallowed `cardValue` too, and `cardValue` counts families quite legitimately: that
     is the remaining bias LANE-2 deliberately left alone (LANE-3). Scoping matters here. */
  const body = region(eng, 'export function buildLoadout', ['export function cardValue'],
    { min: 1000, what: 'buildLoadout' })
  ok(!/v \+= 3 \+ have \* 2/.test(body), 'the family bonus is back in the builder verbatim')
  ok(!/tagCounts\(/.test(body),
    'the builder is counting families again, which is the only thing that expression needed')

  /* DECK-4 STILL WORKS. Removing the bonus took its payoff from reaching 94.3% of runs to 11.2%,
     because it keyed on a family of 8 that only the bonus could reach — so the gate moved to
     merit and the payoff is back at 92.2%. Asserted here as well as in DECK-4's own guard,
     because this is the change that broke it and this is where somebody will look. */
  const payoff = E.commitPayoff(deck)
  ok(payoff, 'the deck the builder produces is committed to nothing DECK-4 can pay for')
  ok(sizes[0] >= E.SYNERGY_PER,
    `the builder's biggest family is ${sizes[0]}, below SYNERGY_PER — nothing can ever pay for a shape`)
})

group('a plan can be bought (SEQ-3)')
test('SEQ-3: the constraint is priced, so the weight can be applied', () => {
  /* SEQ-2 found a real inconsistency — `seqValue` priced a payout with `bonusValue`'s
     coefficients and then did not apply BONUS_WEIGHT to them, so `draw` was worth 2.2 here and
     7.0 next door — and then measured that FIXING it made the game worse: plans went from ranks
     57-60 of 61 bonuses to ranks 7-34, and with one purchasable, completion fell 44.3% to 40.3%
     at n=3000. The 3.2x was cancelling a cost the model did not carry: a plan does not merely
     maybe-pay later, it CONSTRAINS the play while it runs.

     What was missing was a measurement. Over 88,609 climb turns of the real campaign, each
     condition is met with nobody trying: clear 83.0%, norest 39.3%, rest 60.7%, feet 95.2%. So
     the cost is not one number — three turns of keeping your feet on is nearly free, two turns
     of NOT resting takes the play you would have made on three turns in five. With that priced
     the weight applies and the same three changes land at −0.5 instead of −4.0. */
  for (const q of E.SEQUENCES)
    ok(E.SEQ_BASE[q.need] !== undefined,
      `the '${q.need}' condition has no measured base rate, so its constraint is a guess`)
  for (const [need, p] of Object.entries(E.SEQ_BASE))
    ok(p > 0 && p < 1, `the base rate for '${need}' is ${p}, which is not a share of turns`)
  ok(E.SEQ_CONSTRAINT > 0, 'a forced turn costs nothing, so the weight is uncancelled again')

  // the cost is ORDERED by how often you would have complied anyway — the ticket's finding
  const cost = q => q.turns * (1 - E.SEQ_BASE[q.need]) * E.SEQ_CONSTRAINT
  const byId = id => E.SEQUENCES.find(q => q.id === id)
  const feet = byId('committed'), norest = byId('static')
  ok(feet && norest, 'the plans this compares are gone')
  ok(cost(feet) < cost(norest),
    `keeping your feet on for ${feet.turns} turns is priced at ${cost(feet).toFixed(1)} and `
    + `staying off a rest for ${norest.turns} at ${cost(norest).toFixed(1)} — the wrong way round`)
  ok(cost(feet) < E.SEQ_CONSTRAINT,
    'a condition met on 95% of turns is charged more than a full forced turn')
  /* And the valuation must READ the table per-condition, not merely have an ordered table
     beside it. The ordering above is a statement about SEQ_BASE; this is what makes it a
     statement about the price. A flat `forced` passes everything above it. */
  const body = region(stripComments(readFileSync('src/engine.ts', 'utf8')),
    'function seqValue(', ['export const WANT_FEET'], { min: 400, what: 'seqValue' })
  ok(/SEQ_BASE\[q\.need\]/.test(body),
    'seqValue charges a constraint that does not depend on which condition it is')
  // one precise regex, not two alternatives where the looser makes the tighter pointless
  ok(/payout \* BONUS_WEIGHT/.test(body),
    'seqValue no longer applies BONUS_WEIGHT to the payout')
  ok(/- forced \* SEQ_CONSTRAINT/.test(body), 'seqValue no longer subtracts the constraint')

  /* And the weight is really applied: the payout side must now be worth BONUS_WEIGHT times its
     raw coefficients. Read off the two plans whose payouts differ only in size, so this cannot
     pass on the constraint alone. */
  const deck = E.DEFAULT_LOADOUT.map(E.spawn)
  const linked = E.spawn('Link It Up')
  ok(linked, 'Link It Up is gone')
  const raw = 2 * 4.5                     // Linked Moves pays clear:2, at bonusValue's 4.5
  const v = E.seqShelfValue(linked, deck)
  ok(v > raw - cost(byId('linked')),
    `the plan values at ${v.toFixed(1)}, below its own unweighted payout — BONUS_WEIGHT is not applied`)
})
test('SEQ-3: a plan is on the shelf, and only one this deck could run', () => {
  const rng = new E.RNG(31)
  let shown = 0, runnable = 0, visits = 0
  for (let i = 0; i < 90; i++) {
    const base = { ...E.freshRun(0, 0, i), act: i % 3, tier: i % 4, gear: [], boons: [],
      runDeck: E.DEFAULT_LOADOUT.map(E.spawn) }
    const st = E.stockShop(base, rng)
    visits++
    const plans = st.shopCards.filter(c => c.seq)
    ok(plans.length <= 1, `${plans.length} plans on one shelf`)
    if (plans.length) {
      shown++
      if (E.seqShelfValue(plans[0], base.runDeck) >= E.SEQ_SHELF_BAR) runnable++
      ok(!base.runDeck.some(c => c.name === plans[0].name),
        `the shelf is selling ${plans[0].name} to a deck that already has one`)
    }
  }
  ok(shown > 0, 'no shelf in 90 visits carried a plan — SEQ-2\'s retraction is still in force')
  eq(runnable, shown, `${shown - runnable} shelf plan(s) were ones the deck could not run`)

  /* The gate must DISCRIMINATE, which is the half that keeps the shelf an option rather than a
     tax — SEQ-2's version put a plan there unconditionally. Asserted on the valuation rather
     than on an empty deck: an empty deck turns out to satisfy `norest` perfectly well (it has
     no rests to take), so "a deck that can run nothing" is not a thing the rules believe in,
     and the first cut of this assertion was my intuition rather than a rule. */
  const restDeck = ['Shake Out', 'Shake Out', 'Kneebar', 'Kneebar', 'Breathe', 'Breathe',
    'Deep Breath', 'Crimp Grip', 'Lock Off', 'Smear'].map(E.spawn)
  const feetless = ['Lock Off', 'Crimp Grip', 'Open Hand', 'Mantle', 'Try Hard'].map(E.spawn)
  const noRestPlan = Object.values(E.CARDS).find(c => c.seq === 'static')
  const feetPlan = Object.values(E.CARDS).find(c => c.seq === 'committed')
  ok(noRestPlan && feetPlan, 'the plans this compares are gone')
  ok(E.seqShelfValue(E.spawn(noRestPlan.name), restDeck)
    < E.seqShelfValue(E.spawn(noRestPlan.name), feetless),
    'a deck built on resting is valued no worse at a plan that forbids resting')
  ok(E.seqShelfValue(E.spawn(feetPlan.name), feetless) < E.SEQ_SHELF_BAR,
    'a deck with no feet cards clears the bar for a plan that needs feet every turn')

  /* And it costs no randomness. The kit and the rack beside it are stage-picked for exactly
     this reason — a draw here shifts every downstream roll and moves the balance guards. */
  const a = E.stockShop({ ...E.freshRun(0, 0, 3), act: 1, tier: 1, gear: [], boons: [],
    runDeck: E.DEFAULT_LOADOUT.map(E.spawn) }, new E.RNG(11))
  const b = E.stockShop({ ...E.freshRun(0, 0, 3), act: 1, tier: 1, gear: [], boons: [],
    runDeck: [] }, new E.RNG(11))
  eq(a.shopCards.filter(c => !c.seq).map(c => c.name).join(','),
    b.shopCards.filter(c => !c.seq).map(c => c.name).join(','),
    'stocking a plan changed the rest of the shelf — the plan is drawing from the run stream')
  const eng = stripComments(readFileSync('src/engine.ts', 'utf8'))
  const fn = region(eng, 'export function shelfPlan', ['function seqValue'],
    { min: 200, what: 'shelfPlan' })
  ok(!/rng/i.test(fn), 'shelfPlan takes randomness, so the shelf perturbs the run')
})
test('SEQ-3: a bought plan actually runs, pays, and can be lost', () => {
  /* The whole point of making it purchasable. Measured over 600 campaigns after this ticket:
     the shelf showed a plan on 1,900 visits, 423 were affordable and 226 were bought, 33.8% of
     runs ended holding one, and across 3,322 plan turns 1,170 paid, 929 spent the slip and 140
     broke outright. Before it, a plan was in no pool and on no shelf and none of that happened. */
  const rng = new E.RNG(515)
  let started = 0, paid = 0, broke = 0
  // a fixed sample, not an early exit: the first cut stopped as soon as it had seen enough and
  // then asserted on how many it had started, which is a threshold fighting its own loop
  for (let t = 0; t < 90; t++) {
    let st = startClimb(4, rng, { seed: Math.floor(rng.next() * 2 ** 31), pump: 0 })
    const plan = E.spawn('Link It Up')
    st = { ...st, piles: { ...st.piles, hand: [plan, ...st.piles.hand] } }
    st = E.playBonusStep(st, plan, -1, rng)
    if (!st.seq) continue
    started++
    for (let k = 0; k < 8; k++) {
      st = E.autoPlay(st, rng)
      const before = st.seq
      st = E.resolve(st, rng)
      if (before && !st.seq) {
        if (st.log.some(l => /It pays/.test(l))) paid++
        else broke++
        break
      }
      if (st.phase !== 'climb') break
    }
  }
  ok(started > 20, `only ${started} plans started — the fixture never gets one running`)
  ok(paid > 0, 'no plan ever paid out, so the payout side is unreachable')
  ok(broke > 0, 'no plan was ever lost, so a plan is a free payout with no risk in it')
})

group('the board has a shape (LANE-1)')
test('LANE-1: matched hands are a relationship between the lanes, both ways', () => {
  /* The row said Squeeze and the gaston/undercling pairing were the only cross-lane rules. They
     were not: measured over 86,251 climb turns of the real campaign there are five hand-to-hand
     terms and six on the feet-to-hands axis, and a hand-to-hand rule is live on 56.8% of turns
     (opposition 63.5% counting both sides of it, Squeeze 21.4%). What was true is that the two
     rules carried by CARDS are dead — `fx: 'guard'` fires on 0.03% of turns and `fx: 'weight'`
     on 0.12%, because only 4.8% of runs ever hold one of those eight cards. The three that fire
     are the three that need no draft: Squeeze is a hold ability, campusing is a board state,
     Featureless is a hold.

     So this rule is carried by the BOARD. Matched — both hands on the same kind of hold, a card
     on each — fires on 28.2% of turns and nothing read it before. It pays a breath and it takes
     your opposition away, and the two-sidedness is not decoration: every version that only gave
     something measured +1.6 to +5.0 against a 44.3 pin (both hands covered for a Bite point was
     +5.0; the shed alone +2.4), and the pure cost was −1.1. */
  ok(E.MATCH_SHED >= 1, `MATCH_SHED is ${E.MATCH_SHED}, so matching does nothing`)
  const H = (uid, name, grip) => ({ uid, name, bite: 3, grip, crux: false, clean: false })
  const rng = new E.RNG(1717)
  /* `pump` is set AFTER startClimb, not through it: startBurn resets the meter to 0, so passing
     it in left every arm of this test at zero pump and the shed clamped to nothing — the whole
     block measured 0 against 0 and would have passed with the mechanic deleted. */
  const base = { ...startClimb(4, rng, { weather: 1 }), turn: 3, pump: 6 }
  const a = E.spawn('Gaston'), b = E.spawn('Undercling')
  ok(a.opposes && b.opposes, 'the opposition fixture is not made of opposition cards')

  // 1. the predicate itself: same KIND in both hands, a card on each
  const same = [H(1, 'crimp', 9), H(2, 'crimp', 9), null]
  const diff = [H(1, 'crimp', 9), H(2, 'pinch', 9), null]
  ok(E.matched(same, [a, b, null]), 'two hands on the same kind of hold do not read as matched')
  ok(!E.matched(diff, [a, b, null]), 'two DIFFERENT holds read as matched')
  ok(!E.matched(same, [a, null, null]), 'one hand on the wall reads as matched')
  ok(!E.matched(same, [null, b, null]), 'the other single hand reads as matched')
  ok(!E.matched([H(1, 'crimp', 9), null, null], [a, b, null]), 'one hold reads as matched')
  /* Brushing strips a hold's ABILITY and this rule is about the hold's SHAPE, so a brushed
     crimp still matches a crimp. Keyed on `abilityOf` this would silently stop working the
     moment anybody used the Brush card. */
  ok(E.matched([{ ...same[0], clean: true }, same[1], null], [a, b, null]),
    'brushing one of the two holds broke the match')

  // 2. the cost: square to the wall, so an opposing pair is alone
  const hold = same[0]
  const paired = { ...base, boardH: diff, boardP: [a, b, null] }
  const matchedSt = { ...base, boardH: same, boardP: [a, b, null] }
  const lone = { ...base, boardH: diff, boardP: [a, null, null] }
  const pairPower = E.powerAgainst(paired, a, diff[0], 0)
  const matchPower = E.powerAgainst(matchedSt, a, hold, 0)
  const lonePower = E.powerAgainst(lone, a, diff[0], 0)
  eq(pairPower - lonePower, E.OPPOSE_PAIR - E.OPPOSE_ALONE,
    'the fixture does not read the full opposition swing, so the cost below proves nothing')
  eq(matchPower, lonePower,
    `a seated pair on matched hands still pays ${matchPower - lonePower} more than a lone card`)

  // 3. the breath: it sheds, and the preview and resolve agree that it does
  const drive = st => {
    const before = st.pump
    const pv = E.previewPump(st)
    const out = E.resolve(st, new E.RNG(99))
    return { before, pv, after: out.pump, log: out.log }
  }
  /* Both holds are BRUSHED and share their Bite and Grip, so the only thing that differs
     between these two boards is whether the names match. Unbrushed, the first cut of this
     compared a jug (Rest) against a pinch (Squeeze) and measured their abilities instead of the
     shed — it read a difference of 0 and would have passed with the shed deleted. Grip 99 so
     nothing clears and no lane resolves differently. */
  const C = (uid, name) => ({ uid, name, bite: 3, grip: 99, crux: false, clean: true })
  const m = drive({ ...matchedSt, boardH: [C(1, 'crimp'), C(2, 'crimp'), null] })
  const u = drive({ ...matchedSt, boardH: [C(1, 'crimp'), C(2, 'pinch'), null] })
  ok(E.matched([C(1, 'crimp'), C(2, 'crimp'), null], [a, b, null]),
    'the matched arm of the shed fixture is not actually matched')
  ok(m.before > E.MATCH_SHED, `the fixture starts at ${m.before} pump, so the shed cannot land`)
  eq(m.pv, m.after, `the preview said ${m.pv} pump and resolve did ${m.after} on a matched board`)
  eq(u.pv, u.after, `the preview said ${u.pv} pump and resolve did ${u.after} unmatched`)
  eq(u.after - m.after, E.MATCH_SHED,
    `matching shed ${u.after - m.after} pump, not ${E.MATCH_SHED}`)
  ok(m.log.some(l => /Matched/.test(l)), 'the breath is taken and never mentioned in the log')
  ok(!u.log.some(l => /Matched/.test(l)), 'an unmatched board claims a match in the log')

  /* 4. It reads the BOARD, not the state. `spit` takes a card off mid-turn, so the board resolve
     works on and `s.boardP` are different arrays — written against the state this diverged the
     preview from resolve on 34 of 1750 turns and tripped ENG-21's spit fixture. */
  const eng = stripComments(readFileSync('src/engine.ts', 'utf8'))
  const decl = region(eng, 'export function matched(', ['export const OPPOSE_ALONE'],
    { min: 100, what: 'matched' })
  ok(/boardH: \(Hold \| null\)\[\], boardP: \(Card \| null\)\[\]/.test(decl),
    'matched takes a GameState again — the spit divergence is back')
  ok(!/GameState/.test(decl), 'matched reads the state rather than the board it is handed')
  // and one copy of the rule: nothing else compares the two hand holds' names
  const others = (eng.match(/boardH\[0\][^\n]*?\.name === /g) ?? []).length
  eq(others, 0, `${others} place(s) outside matched() compare the two hand holds by name`)

  /* 5. And it must keep firing. A board rule that stops happening is the guard/weight story
     again — the full campaign reads 28.2% of climb turns matched, 14.2% of them with an
     opposing card out. Sampled here, so the floor is loose but not decorative. */
  let turns = 0, hits = 0
  const rng2 = new E.RNG(88)
  for (let t = 0; t < 120; t++) {
    let st = startClimb(Math.floor(rng2.next() * E.ROUTES.length), rng2,
      { seed: Math.floor(rng2.next() * 2 ** 31), pump: 0 })
    for (let k = 0; k < 6; k++) {
      st = E.autoPlay(st, rng2)
      turns++
      if (E.matched(st.boardH, st.boardP)) hits++
      const nx = E.resolve(st, rng2)
      if (nx.phase !== 'climb') break
      st = nx
    }
  }
  ok(turns > 300, `only ${turns} turns driven — nothing was really sampled`)
  ok(hits / turns > 0.1,
    `hands matched on ${(100 * hits / turns).toFixed(1)}% of turns — the board rule has gone quiet`)

  /* 6. And the two cross-lane terms the drafter could not see. `weight` had NO entry in
     cardValue at all — the only cross-card term priced at zero — while the board it is paid on
     is loaded on 90.6% of turns. Named as a family too, so the loadout builder's synergy nudge
     can reach it; that alone did not resurrect the cards (measured: 0.04% → 0.03% of turns,
     because only 4.8% of runs ever hold one), which is why this ticket's own rule lives on the
     board instead. Both halves are still worth having and both are asserted. */
  const bare = { ...E.freshRun(8, 1, 7), inRun: true, act: 1 }
  const plain = E.synth(3, 5)
  const wt = { ...plain, fx: 'weight' }
  const none = []
  const wtGain = E.cardValue(bare, wt, none) - E.cardValue(bare, plain, none)
  ok(Math.abs(wtGain - E.WEIGHT_BOARD * 2) < 1e-6,
    `a Weight move is worth no more to the drafter than the same card without it: ${wtGain.toFixed(2)}`)
  ok(E.WEIGHT_BOARD > 1, `WEIGHT_BOARD is ${E.WEIGHT_BOARD}, which is not a board anyone plays on`)
  for (const n of ['Cut Loose', 'Dead Hang', 'Front Lever'])
    eq(E.tagOf(E.spawn(n)), 'core', `${n} is a cross-lane card with no family the game can name`)
  const spec = Object.values(E.CARDS).filter(c => c.synergy === 'core')
  eq(spec.length, 1, 'core tension has no specialist, so the family is a label rather than a plan')
  ok(spec[0].fx === 'weight' || spec[0].fx === 'guard',
    `${spec[0].name} counts core cards and is not one`)
})
test('LANE-1: the board says when it has matched you', () => {
  // two things happen at once and neither is legible from the lanes, so the screen says both
  const app = readFileSync('src/App.tsx', 'utf8')
  const banner = region(app, "matched(st.boardH, st.boardP) ? (", ['A11Y-9'],
    { min: 200, what: 'the matched banner' })
  ok(/MATCHED/.test(banner), 'the matched banner does not name itself')
  ok(/MATCH_SHED/.test(banner), 'the banner does not say what the breath is worth')
  ok(/square to the wall/.test(banner), 'the banner never mentions the cost, only the gift')
  ok(/role="status"/.test(banner) && /aria-live/.test(banner),
    'the banner appears mid-climb and does not announce itself')
  // and the rule is written down where every other rule is
  ok(E.KEYWORDS.some(k => k.name === 'Matching'), 'matching is not in the keywords')
  const kw = E.KEYWORDS.find(k => k.name === 'Matching')
  ok(/shed/.test(kw.text) && /alone/.test(kw.text),
    'the keyword explains one half of matching and not the other')
})

group('the weather can move (COND-3)')
test('COND-3: Contact is read live, so the weather can turn under you', () => {
  /* Contact used to be worked out ONCE, in startBurn, and written onto every card as it was
     dealt. That is the whole reason COND-2 could not move the weather and had to go through
     the route window: `s.weather` changing mid-burn would have left every card in hand
     carrying the number it was dealt with — the screen and resolve disagreeing about the same
     card, which is the ENG-26 divergence.

     Measured before touching it: zeroing the weather's Contact term takes the campaign from
     43.5% to 49.8%, so this is a six-point lever and the reason the window's share of it is
     one point on one stretch of one line. */
  const HUMID = E.WEATHER.findIndex(w => w.dContact === -1)
  const HARD = E.WEATHER.findIndex(w => w.dContact <= -2)
  ok(HUMID > 0 && HARD > 0, 'no weather in the game moves Contact, so nothing here is tested')
  const rng = new E.RNG(3131)

  // 1. the deal does not bake it: a dealt card still carries its own stat
  const dealt = startClimb(4, rng, { weather: HUMID, pump: 0 })
  const moves = [...dealt.piles.draw, ...dealt.piles.hand].filter(c => c.kind === 'move')
  ok(moves.length > 4, `only ${moves.length} moves dealt — the fixture proves nothing`)
  let moved = 0
  for (const c of moves) {
    eq(c.contact, E.CARDS[c.name].contact,
      `${c.name} was dealt with its Contact rewritten — the bake is back`)
    if (E.contactOf(dealt, c) !== c.contact) moved++
  }
  ok(moved === moves.length,
    `${moves.length - moved} of ${moves.length} moves ignore the weather when read live`)

  // 2. and the weather can now turn mid-burn, which is the ticket
  const card = E.spawn('Open Hand')
  const lib = card.contact
  const still = { ...dealt, weather: E.WEATHER.findIndex(w => w.dContact === 0) }
  const damp = { ...dealt, weather: HUMID }
  const bad = { ...dealt, weather: HARD }
  eq(E.contactOf(still, card), lib, 'fair conditions changed a card that nothing should touch')
  eq(E.contactOf(damp, card), lib + E.WEATHER[HUMID].dContact,
    'the weather does not reach Contact — it is still baked somewhere')
  ok(E.contactOf(bad, card) < E.contactOf(damp, card),
    'a worse sky than damp costs no more Contact')

  // 3. wear and the stat are two things, and the weather is charged once, not once a turn
  const H = (uid, bite, grip) => ({ uid, name: 'crimp', bite, grip, crux: false, clean: false })
  let st = { ...dealt, pump: 0, turn: 2, boardH: [H(1, 1, 99), null, null],
    boardP: [card, null, null] }
  const start = E.contactOf(st, card)
  eq(start, lib + E.WEATHER[HUMID].dContact, 'the fixture does not start where it should')
  let left = start, turns = 0
  for (let t = 0; t < 3; t++) {
    const before = E.contactOf(st, st.boardP[0])
    const bite = E.biteAgainst(st, st.boardP[0], st.boardH[0], 0)
    st = E.resolve(st, rng)
    const on = st.boardP[0]
    if (!on) break
    turns++
    eq(on.contact, lib, 'resolve wrote the remaining Contact into the card\'s stat')
    eq(E.contactOf(st, on), before - bite,
      `a card that stood the turn did not lose exactly the ${bite} Bite it took`)
    left = E.contactOf(st, on)
    st = { ...st, boardH: [H(1, 1, 99), null, null] }
  }
  ok(turns >= 2, `the card only survived ${turns} turn(s) — the wear was never compounded`)
  ok(left < start, 'the card ended the fixture with everything it started with')

  // 4. a card already on the wall feels the sky changing — the point of reading it live
  const worn = st.boardP[0]
  ok(worn && (worn.spent ?? 0) > 0, 'the fixture has no worn card to test')
  eq(E.contactOf({ ...st, weather: HARD }, worn) - E.contactOf(st, worn),
    E.WEATHER[HARD].dContact - E.WEATHER[HUMID].dContact,
    'the weather turning left the card already on the wall reading the old number')

  // 5. nothing in your hand ever reads below the floor every move is meant to keep
  const frozen = startClimb(4, rng, { weather: HARD, pump: 0 })
  for (const c of frozen.piles.hand.filter(c => c.kind === 'move'))
    ok(E.contactOf(frozen, c) >= 1, `${c.name} reads ${E.contactOf(frozen, c)} Contact in hand`)
  /* And the clamp is exercised rather than assumed: the real deck's cheapest move still
     clears the floor unaided in the hardest weather, so the loop above never reaches it.
     A one-Contact card in a sky that costs three does. */
  const thin = E.synth(1, 1)
  eq(E.contactOf(frozen, thin), 1,
    `a ${thin.contact}-Contact move reads ${E.contactOf(frozen, thin)} in the worst weather in the game`)

  /* 6. And the reason the bake could go at all: the stat and the wear are separate fields, so
     resolve never writes Contact. If it does, the number it writes is a number with the
     weather already inside it, and the next live read charges the weather twice — which is
     exactly what the first cut of this ticket did, measured as 40.8% against 43.5%. */
  const body = region(CODE, 'export function resolve(s: GameState, rng: RNG)',
    ['export function autoPlay'], { min: 4000, what: 'resolve' })
  ok(!/\bcontact:/.test(body),
    'resolve writes a card\'s Contact stat — the stat and the wear must stay two fields')
  ok(/spent: \(card\.spent \?\? 0\) \+ bite/.test(body),
    'a card that stands a turn no longer records the Bite it took as wear')
})
test('COND-3: a window can take the rock itself, and the board feels it', () => {
  /* The payoff. Before this there was no way for a condition to reach Contact at all, so a
     window could only ever be about your feet or the holds' teeth. */
  const wet = E.ROUTES.map((r, i) => [r, i]).filter(([r]) => r.window?.dContact)
  ok(wet.length >= 2, `only ${wet.length} route(s) carry a window that touches the rock`)
  const rng = new E.RNG(7712)
  for (const [spec, idx] of wet) {
    const w = spec.window
    const card = E.spawn('Open Hand')
    const H = (uid, bite, grip) => ({ uid, name: 'crimp', bite, grip, crux: false, clean: false })
    const base = { ...startClimb(idx, rng, { weather: 1, pump: 0 }), turn: 2,
      boardH: [H(1, 1, 99), null, null], boardP: [card, null, null] }
    const shutAt = Math.ceil(w.at * spec.clear)
    const below = { ...base, cleared: shutAt - 1 }
    const inside = { ...base, cleared: shutAt }
    eq(E.contactOf(inside, card) - E.contactOf(below, card), w.dContact,
      `${spec.name}: the window does not move Contact by the amount it states`)
    // and it reaches a card that is ALREADY on the wall, worn, mid-sequence
    const stood = E.resolve(below, rng)
    const on = stood.boardP[0]
    ok(on && (on.spent ?? 0) > 0, `${spec.name}: the fixture never got a worn card onto the wall`)
    eq(E.contactOf({ ...stood, cleared: shutAt }, on) - E.contactOf({ ...stood, cleared: shutAt - 1 }, on),
      w.dContact, `${spec.name}: a card already on the wall did not feel the rock go`)
    // ENG-20's rule is untouched: a condition may take Contact, never Power
    ok(!('dPower' in w) && !('powerAll' in w),
      `${spec.name}: a window carries a Power term`)
  }
})

group('read the sequence (RUN-9)')
test('Sight the Line reveals the next holds without touching the deck', () => {
  ok(E.CARDS['Sight the Line'], 'the card exists')
  const rng = new E.RNG(321)
  const st = startClimb(4, rng, { seed: 55 })
  const before = st.holdDeck.length
  const st2 = E.playBonusStep(st, E.spawn('Sight the Line'), -1, rng)
  /* INFO-1: the card's own `read`, not a hardcoded 2. The depth changed when reading stopped
     being free (a read is beta on the holds it covers now), and a guard that names a content
     number fails on the content change rather than on the property it is about. */
  eq(st2.readAhead, Math.min(E.spawn('Sight the Line').read, before),
    'reading did not reveal what the card says it reads')
  eq(st2.holdDeck.length, before, 'reading popped the deck — it must only look, not draw')
  const shown = st2.holdDeck.slice(-st2.readAhead)
  ok(shown.length === st2.readAhead && shown.length > 0, 'nothing was actually revealed')
})
test('INFO-1: a hold you read arrives known, and that is all it arrives with', () => {
  /* INFO-1. `readAhead` was consulted by NOTHING but the display — the source said so in four
     separate places, each time as the reason a read is "band-safe" — so the wall paid in
     information and the information did nothing. Measured before the change: a player holds a read
     on 5.4% of climb turns, mean 1.25, never more than 2. `Take It All In`, the deepest read in
     the game, valued at −3.0: the worst card in the pool, because what it bought had no effect.

     WHAT SHIPPED is the information half: a hold you read arrives KNOWN, so the preview reads it
     exactly instead of as a WOBBLE-wide span. That is a real use — a whole grip of uncertainty is
     the difference between a card that clears and one that might — and it is band-safe by
     construction, because `holdKnown` is read by `gripShown` and by nothing else.

     WHAT WAS RETRACTED is the mechanical half, and the guard for it is the assertion that a read
     hold is NOT cheaper. Treating a read as beta took the band 44.3% to 46.6% and four dials could
     not move it, because a read covers whatever arrives next: it is a flat discount on the wall
     rather than a bonus with a size. engine.ts's note on `effGrip` carries the numbers. */
  const rng = new E.RNG(9)
  const st = startClimb(4, rng, { seed: 71 })
  const deep = Object.keys(E.CARDS).map(n => E.spawn(n))
    .filter(c => c.read).sort((a, b) => b.read - a.read)[0]
  ok(deep, 'no card grants a read at all any more')

  const after = E.playBonusStep({ ...st, pump: 4 }, deep, -1, rng)
  ok(after.readAhead > 0, 'the fixture bought no read, so nothing below proves anything')
  /* the hand lanes are emptied so `refillAndDraw` actually brings holds up — with a full board
     nothing arrives and every assertion below would pass for free. */
  const empty = b => ({ ...b, boardH: [null, null, b.boardH[2]], boardP: [null, null, null] })
  const out = E.resolve({ ...empty(after), phase: 'climb' }, new E.RNG(3))
  const flagged = out.boardH.filter(h => h && h.read)
  ok(flagged.length > 0, 'no hold arrived under the read, so the fixture proves nothing')

  /* KNOWN: the preview reads a read hold exactly. Compared against the same hold in a run that
     never read it, so the only difference is the reading. */
  const blind = E.resolve({ ...empty({ ...st, readAhead: 0 }), phase: 'climb' }, new E.RNG(3))
  let compared = 0
  for (const i of [0, 1]) {
    const a = out.boardH[i], b = blind.boardH[i]
    if (!a || !b || a.uid !== b.uid || !a.read || out.beta.includes(a.name)) continue
    compared++
    ok(E.gripShown(out, a).sure, 'a hold you read still reads as a range — the preview learned nothing')
    ok(!E.gripShown(blind, b).sure, 'the unread control reads exactly, so this proves nothing')
    /* NOT CHEAPER. This is the retraction, guarded: knowing what is coming must not make the
       hold easier, only legible. */
    eq(E.gripFor(out, a), E.gripFor(blind, b),
      'a hold you read is cheaper than the same hold unread — that measured 44.3% to 46.6%')
    eq(a.grip, b.grip, 'reading changed the hold itself')
  }
  ok(compared > 0, 'no arriving hold could be compared, so neither claim was tested')

  /* AND IT IS STILL INFORMATION EVERYWHERE ELSE. `holdKnown` is the one consumer of the flag,
     and `gripShown` is the one consumer of `holdKnown` — two readers is how the preview and the
     resolution come to disagree (ENG-26). Comments stripped: the notes explaining the retraction
     name `effGrip` and `beta` while explaining what must NOT read them. */
  const eng = stripComments(readFileSync('src/engine.ts', 'utf8'))
  const grip = region(eng, 'const effGrip = ', ['export const gripFor'],
    { min: 40, what: 'effGrip' })
  ok(!/h\.read/.test(grip), 'grip is discounted for a hold you read again — that is the retracted half')
  const known = region(eng, 'export const holdKnown', ['export function gripShown'],
    { min: 40, what: 'holdKnown' })
  ok(/h\.read/.test(known), 'a hold you read no longer reads as known, so reading does nothing at all')
  /* and the valuation must not price a read while reading buys information: a term there with no
     mechanical effect behind it is the ENG-25 failure inverted — the policy told a card is worth
     something it cannot spend. This is what the retracted half added, so it is what a
     re-addition would put back first. */
  const bv = region(eng, 'function bonusValue', ['function seqValue'], { min: 200, what: 'bonusValue' })
  ok(!/c\.read/.test(bv),
    'the valuation prices a read again, though a read buys information a greedy policy cannot spend')

  /* the board says it, because the pips silently stopping being a span is otherwise the game
     looking inconsistent (A11Y-8: the same fact in the accessibility tree). */
  const app = stripComments(readFileSync('src/App.tsx', 'utf8'))
  /* the two are asserted on their own STRINGS, not on the shared `h.read && !h.clean` condition:
     both the drawn line and the spoken label are guarded by it, so a condition match could not
     tell which of the two had gone. Found by an injection that removed the drawn line and tripped
     the spoken assertion instead. */
  ok(/h\.read && !h\.clean && <div[\s\S]{0,240}you read this one/.test(app),
    'the board never says which holds you had read')
  ok(/You read this one before it came up/.test(app),
    'the spoken label does not say you read the hold')
})

test('a read counts down as holds come onto the board and stays in range', () => {
  const rng = new E.RNG(654)
  let st = E.playBonusStep(startClimb(4, rng, { seed: 77 }), E.spawn('Sight the Line'), -1, rng)
  const r0 = st.readAhead
  ok(r0 > 0, 'nothing was read to begin with')
  let counted = false
  for (let k = 0; k < 8 && st.phase === 'climb'; k++) {
    const rBefore = st.readAhead
    st = E.resolve(E.autoPlay(st, rng), rng)
    ok(st.readAhead >= 0 && st.readAhead <= st.holdDeck.length,
      `readAhead ${st.readAhead} is out of range against ${st.holdDeck.length} holds`)
    if (st.readAhead < rBefore) counted = true
  }
  ok(counted, 'a read never counted down even as holds came up')
})
test('reading is information only — it never changes how a turn resolves', () => {
  /* The whole safety of RUN-9: it is what you know, not what you can do. A turn
     must resolve identically whether you have read ahead or not. */
  const rng = new E.RNG(987)
  let seen = 0
  for (let t = 0; t < 80; t++) {
    let s = startClimb(4 + rng.int(5), rng, { seed: Math.floor(rng.next() * 2 ** 31) })
    if (s.phase !== 'climb') continue
    s = E.autoPlay(s, rng)
    const blind = E.resolve({ ...s, readAhead: 0 }, new E.RNG(42))
    const read = E.resolve({ ...s, readAhead: 5 }, new E.RNG(42))
    seen++
    eq(read.cleared, blind.cleared, 'reading changed how many holds were worked')
    eq(read.pump, blind.pump, 'reading changed the pump')
    eq(JSON.stringify([read.boardP, read.boardH].map(b => b.map(x => x?.name ?? null))),
      JSON.stringify([blind.boardP, blind.boardH].map(b => b.map(x => x?.name ?? null))),
      'reading changed the board')
  }
  ok(seen > 60, `only ${seen} turns compared`)
})

group('accessibility (A11Y-4)')
test('haptics ride their own switch, not the sound one', () => {
  const app = readFileSync('src/App.tsx', 'utf8')
  const buzzes = [...app.matchAll(/buzz\([^;]*?\)/g)].map(m => m[0])
  ok(buzzes.length >= 3, `only ${buzzes.length} buzz calls found`)
  for (const b of buzzes)
    ok(/st\.haptics|,\s*true\)/.test(b), `a buzz still reads the sound setting: ${b}`)
  ok(/HAPTICS \{st\.haptics/.test(app), 'there is no HAPTICS toggle in settings')
  ok(/ASSIST \{st\.assist/.test(app), 'there is no ASSIST toggle in settings')
})
test('VIS-5: the weather-window colour is defined, in both palettes, and used', () => {
  const app = readFileSync('src/App.tsx', 'utf8')
  // the whole weather channel paints with --blue: the shut/near window boxes,
  // the map note, the menu forecast. It was used in five places and defined in
  // none, so it fell back to ink and read like every other advisory.
  ok(/var\(--blue\)/.test(app), 'nothing uses --blue — the weather channel lost its colour')
  ok(/:root\{[^}]*--blue:/.test(app), '--blue is used but never defined in :root')
  // colour-safe mode remaps the palette; the weather channel needs its own
  // value there or it collides with the teal-blue that green becomes.
  ok(/\.cb\{[^}]*--blue:/.test(app), '--blue has no colour-safe value — it breaks in cbSafe mode')
  // and a hazard you must answer this turn carries more weight than a flavour note
  ok(/spot urgent/.test(app), 'no urgency weighting on the climb advisories')
  ok(/\.spot\.urgent\{/.test(app), 'the urgent advisory style is not defined')
})
test('A11Y-5: one-handed reach is a setting, it persists, and it is layout only', () => {
  const app = readFileSync('src/App.tsx', 'utf8')
  // the toggle exists and cycles all three states
  ok(/ONE-HANDED REACH/.test(app), 'there is no ONE-HANDED REACH toggle in settings')
  ok(/reach-\$\{st\.reach\[0\]\}/.test(app), 'the reach class never reaches the climb screen')
  // it defaults off and is one of exactly three states
  eq(E.freshRun(0, 0, 1).reach, 'off', 'one-handed reach is not off by default')
  // it survives a save and carries into a new expedition — it is the player's
  E.saveGame({ ...E.freshRun(0, 0, 7), slot: 1, reach: 'left' })
  eq(E.loadGame(1).reach, 'left', 'the reach setting did not survive a save')
  eq(E.carryOver({ ...E.freshRun(0, 0, 1), reach: 'right' }).reach, 'right',
    'the reach setting was dropped starting a new expedition')
  // layout only: the engine must never branch a turn on it. Resolve with each
  // setting from an identical board lands on an identical board.
  const rng = () => new E.RNG(7)
  const base = { ...E.startBurn({ ...E.freshRun(4, 0, 5), inRun: true }, rng()), selected: null }
  const off = E.resolve({ ...base, reach: 'off' }, rng())
  const left = E.resolve({ ...base, reach: 'left' }, rng())
  eq(left.pump, off.pump, 'the reach setting changed the pump — it is not layout only')
  eq(left.cleared, off.cleared, 'the reach setting changed how many holds were worked')
})
test('UX-17: the tutorial step leads, and the marks key is one tap from a climb', () => {
  const app = readFileSync('src/App.tsx', 'utf8')
  // the tutorial step is a pinned top banner, gated on the tutorial route...
  ok(/className="teach"/.test(app), 'the tutorial step has no pinned banner')
  /* NARR-15: anchored on the opening brace. Unanchored this was a substring of
     `{false && spec.tutorial && tip`, so switching the banner off entirely left it green
     — found by the injections for a different ticket, and fixed here rather than left. */
  ok(/\{spec\.tutorial && tip \?/.test(app), 'the tutorial banner is not gated on the tutorial route')
  ok(/\.teach\{/.test(app), 'the teach banner has no style')
  // ...and the buried FROM THE GROUND box does not also fire during the tutorial
  ok(/tip && !spec\.tutorial/.test(app), 'the buried tutorial box still fires — the step shows twice')
  // the marks key opens from the climb, into a sheet, with the glyphs and family
  ok(/setLegend\(true\)/.test(app), 'there is no way to open the marks key from a climb')
  ok(/legend \?/.test(app) && /WHAT THE MARKS MEAN/.test(app), 'the marks-key sheet is missing')
  // and the content the banner and key surface actually exists
  ok(E.ROUTES.some(r => r.tutorial), 'there is no tutorial route for the banner to teach')
  ok(E.TUTORIAL_STEPS.length > 0, 'the tutorial has no steps')
})
test('UX-18: the Collection is a codex — mark, text and family, not a checklist', () => {
  const app = readFileSync('src/App.tsx', 'utf8')
  const coll = region(app, "st.phase === 'collection'", ["st.phase === 'map'"],
    { min: 300, what: 'the collection screen' })
  // it uses the deckrow layout the deck/logbook screens use, not a bare row
  ok(/className="deckrow"/.test(coll), 'the collection is still a bare name-and-stat row')
  // an owned card shows its rules text and its family, and the scannable mark
  ok(/<FamMark /.test(coll), 'owned cards show no family mark')
  ok(/c\.text/.test(coll), 'the collection still shows no card text — nowhere to look a card up')
  ok(/fam\.label/.test(coll), 'the family is not named on the entry')
  // and the mark component exists as a real inline (list) mark, not the pinned one
  ok(/function FamMark\(/.test(app), 'the inline family mark is missing')
  // unowned cards stay a mystery — the text must be gated on `have`
  ok(/have \?/.test(coll), 'the codex reveals unowned cards')
})
test('A11Y-8: the accessibility tree — headings, polite log, modal sheets', () => {
  const app = readFileSync('src/App.tsx', 'utf8')
  // 1. no live region SHOUTS: the running climb log and the tutorial step were
  // assertive, so every update interrupted a screen reader mid-utterance
  eq((app.match(/aria-live="assertive"/g) ?? []).length, 0,
    'a live region still interrupts the screen reader (should be polite)')
  ok(/aria-live="polite"/.test(app), 'the polite live regions vanished')
  // 2. every screen title is a real heading, not just a styled span
  const h1 = (app.match(/className="h1"/g) ?? []).length
  const heading = (app.match(/className="h1" role="heading" aria-level=\{1\}/g) ?? []).length
  ok(h1 >= 20, `only ${h1} screen titles`)
  eq(heading, h1, `${h1 - heading} screen title(s) are not exposed as headings`)
  /* 3. every bottom-sheet is a modal dialog you can escape and are dropped into — not a
        div a keyboard user tabs straight past.
        ART-4: this counted TWO, which was how many sheets existed when it was written, so
        adding a third correct one failed it while adding a third BROKEN one would have
        passed. Counted against the sheets themselves now, which is the property it always
        meant and needs no maintenance the next time somebody adds one. */
  const sheets = (app.match(/className="sheet"/g) ?? []).length
  ok(sheets >= 3, `only ${sheets} bottom-sheets — one has gone`)
  eq((app.match(/role="dialog" aria-modal="true"/g) ?? []).length, sheets,
    'a bottom-sheet is not a modal dialog')
  eq((app.match(/className="sheetin" ref=\{sheetRef\} tabIndex=\{-1\}/g) ?? []).length, sheets,
    'a sheet claims to be modal but focus is never moved into it, so a keyboard user is stranded behind it')
  const esc = region(app, "if (e.key === 'Escape')", ['\n'], { min: 20, what: 'the Escape handler' })
  ok(/setSheet\(false\); setLegend\(false\); shutCard\(\)/.test(esc),
    'Escape does not close every sheet, so one of them traps a keyboard user')
  ok(/aria-label="What is left/.test(app) && /aria-label="What the marks mean/.test(app),
    'a climb sheet is an unnamed dialog')
  ok(/e\.key === 'Escape'/.test(app), 'the sheets cannot be dismissed with Escape')
  ok(/sheetRef\.current\?\.focus\(\)/.test(app), 'focus is never moved into an open sheet')
})
test('UX-19: scroll lists scale with the text-size setting, not a fixed pixel box', () => {
  const app = readFileSync('src/App.tsx', 'utf8')
  // a hardcoded maxHeight in px does not grow with --fs, so at TEXT LARGER the
  // box shows fewer rows while everything in it got bigger — the one setting a
  // low-vision player turns on makes these lists show the least
  const fixed = app.match(/maxHeight: \d/g) ?? []
  eq(fixed.length, 0, `${fixed.length} scroll list(s) still use a fixed pixel height`)
  // every list height scales with --fs and is capped to the viewport (dvh) so a
  // short screen never overflows
  const scaled = app.match(/maxHeight: 'min\(\d+px \* var\(--fs\), \d+dvh\)'/g) ?? []
  ok(scaled.length >= 10, `only ${scaled.length} lists scale with the text size`)
})
test('VIS-7: the forecast never rides on colour alone, on any node', () => {
  const app = readFileSync('src/App.tsx', 'utf8')
  // every conditions line on the map (☁ weather · ⛰ rock) must carry the
  // non-colour ▲/▼ cue — colour-blind players get no read otherwise, and the
  // project / FA / established nodes used to render it green/red with no arrow
  const conditions = app.match(/☁ \{w\.name\} · ⛰ \{rk\.name\}/g) ?? []
  // COND-5 moved the tint and the cue into one shared helper, because there were four copies
  // of the same ternary pair and the verdict now needs the route. So the sites are checked for
  // the shared tag, AND the helper is checked for the cue actually being in it — a tag that
  // resolved to the empty string would satisfy the call sites and lose the arrows.
  const cued = app.match(/☁ \{w\.name\} · ⛰ \{rk\.name\}\{nick\(r\)\.tag\}/g) ?? []
  ok(conditions.length >= 4, `only ${conditions.length} node types show the forecast`)
  eq(cued.length, conditions.length,
    `${conditions.length - cued.length} forecast line(s) still ride on colour alone`)
  const helper = region(app, 'const nick = (r?: RouteSpec)', ['if (n.type ==='],
    { min: 200, what: 'the shared forecast verdict' })
  ok(/▲ in nick/.test(helper) && /▼ out of nick/.test(helper),
    'the shared forecast tag no longer carries the ▲/▼ cue, so every node rides on colour alone')
  ok(/var\(--green\)/.test(helper) && /var\(--red\)/.test(helper),
    'the shared forecast verdict lost its colour')
})
test('VIS-6: the family mark reaches every card-list screen', () => {
  const app = readFileSync('src/App.tsx', 'utf8')
  // the scannable shape mark used to stop at the hand and board; a draft screen
  // is exactly where "is this a feet card, a rest, a curse?" decides the pick
  // anchor on each SCREEN block and bound it by the next screen's `if`
  const screen = phase => region(app, `if (st.phase === '${phase}'`, ['if (st.phase ==='],
    { min: 200, what: `the ${phase} screen` })
  const reward = screen('reward'), shop = screen('shop'), pack = screen('pack')
  ok(/<FamMark /.test(reward), 'the reward offers show no family mark')
  ok(/<FamMark /.test(shop), 'the shop cards show no family mark')
  ok(/<FamMark /.test(pack), 'the level-up pack shows no family mark')
  // the inline mark and its row style both exist
  ok(/function FamMark\(/.test(app), 'the inline family mark is gone')
  ok(/\.famname\{/.test(app), 'the family-name row has no style')
})
test('A11Y-6: the settings are switches, consistent, and reachable first', () => {
  const app = readFileSync('src/App.tsx', 'utf8')
  const more = tail(app, "st.phase === 'more'", { min: 500, what: 'the more screen' })
  // settings lead the screen now; the book archives follow
  const settingsAt = more.indexOf('>SETTINGS<')
  const booksAt = more.indexOf('>THE BOOKS<')
  const collAt = more.indexOf('t="Collection"')
  ok(settingsAt > 0 && collAt > 0, 'the more screen lost its settings or its archives')
  ok(settingsAt < collAt, 'the accessibility settings are still buried below the archives')
  ok(booksAt > settingsAt && booksAt < collAt, 'the archives are not grouped below settings')
  // the on/off toggles announce themselves as switches to assistive tech
  const switches = (more.match(/role="switch"/g) || []).length
  ok(switches >= 6, `only ${switches} settings expose switch semantics`)
  ok(/aria-checked=\{st\.motion\}/.test(more), 'MOTION does not report its state')
  // MOTION fills when ON, like every other toggle — the inverted styling is gone
  ok(/btn\$\{st\.motion \? ' go' : ''\}/.test(more), 'MOTION does not fill when it is ON')
  ok(!/st\.motion \? '' : ' go'/.test(more), 'the inverted MOTION styling is still there')
})
test('the assist shows a hold exactly, and shows the real grip', () => {
  const h = { name: 'crux', grip: 8, bite: 3, crux: true, clean: false, wobble: 1 }
  const off = { ...E.freshRun(4, 0, 1), inRun: true, assist: false, beta: [] }
  const gOff = E.gripShown(off, h), gOn = E.gripShown({ ...off, assist: true }, h)
  ok(!gOff.sure && gOff.hi > gOff.lo, 'without assist an unworked hold should read as a range')
  ok(gOn.sure && gOn.lo === gOn.hi, 'with assist a hold should read as one exact number')
  eq(gOn.lo, gOff.hi, 'the assist showed something other than the hold\'s real grip')
})
test('the assist is display only — it never changes how a turn resolves', () => {
  /* The uncertainty is a pillar, so the assist may only change what you SEE.
     A turn must resolve identically with it on or off. */
  const rng = new E.RNG(4242)
  let seen = 0
  for (let t = 0; t < 80; t++) {
    let s = startClimb(4 + rng.int(5), rng, { seed: Math.floor(rng.next() * 2 ** 31) })
    if (s.phase !== 'climb') continue
    s = E.autoPlay(s, rng)
    const plain = E.resolve({ ...s, assist: false }, new E.RNG(7))
    const asst = E.resolve({ ...s, assist: true }, new E.RNG(7))
    seen++
    eq(asst.cleared, plain.cleared, 'the assist changed how many holds were worked')
    eq(asst.pump, plain.pump, 'the assist changed the pump')
    eq(JSON.stringify(asst.boardH.map(h => h?.grip ?? null)),
      JSON.stringify(plain.boardH.map(h => h?.grip ?? null)), 'the assist changed a grip underneath')
  }
  ok(seen > 60, `only ${seen} turns compared`)
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
  /* v9.99 (SAVE-1): the contract got STRONGER here. "Refused" used to mean an
     empty object — indistinguishable from an empty slot, so the app treated a
     future save as a new game and then persisted over it. Refused now means
     `null`: unreadable, do not touch. Asserting the stronger value. */
  eq(E.loadGame(1), null, 'a future save must be refused as unreadable, not read as empty')
})
test('export and import move a save between slots', () => {
  E.saveGame(sampleSave())
  const code = E.exportSave({ ...sampleSave(), slot: 1 })
  ok(code.length > 100, 'export produced nothing')
  ok(E.importSave(code, 2), 'import failed')
  eq(E.loadGame(2).level, 9, 'imported save')
  eq(E.importSave('not-a-save', 2), false, 'garbage must be rejected')
})

group('one-shot kit (CARD-7)')
test('every consumable does something and says so', () => {
  ok(E.CONSUMABLES.length >= 3, `only ${E.CONSUMABLES.length} consumables`)
  ok(E.KIT_MAX >= 1, 'the kit holds nothing')
  for (const c of E.CONSUMABLES) {
    ok(c.name && c.text.length > 10, `${c.id} does not explain itself`)
    ok((c.shed ?? 0) > 0 || (c.draw ?? 0) > 0 || (c.powerAll ?? 0) > 0 || (c.burn ?? 0) > 0
      || (c.gripCut ?? 0) > 0 || (c.skin ?? 0) > 0 || (c.psyche ?? 0) > 0, `${c.name} does nothing`)
  }
  // CARD-14: the stub grew past four — a grip-cut, a skin repair, a psyche
  // restore — and each new one-shot actually resolves through useKitStep
  ok(E.CONSUMABLES.length >= 7, `the consumable kit is still a stub: ${E.CONSUMABLES.length}`)
  const H = (uid, grip) => ({ uid, name: 'crimp', bite: 3, grip, crux: false, clean: false })
  const base = over => ({ ...E.freshRun(0, 0, 5), inRun: true, skirmish: null, phase: 'climb',
    boardH: [H(1, 8), H(2, 8), null], boardP: [null, null, null],
    piles: { draw: [], discard: [], exhaust: [], hand: [] }, ...over })
  const tick = E.useKitStep(base({ kit: ['tickstick'] }), 'tickstick', new E.RNG(1))
  eq(tick.boardH[0].grip, 6, 'Tick Stick did not ease the wall')
  eq(tick.boardH[1].grip, 6, 'Tick Stick missed a lane')
  const salve = E.useKitStep(base({ kit: ['skinsalve'], skin: 2 }), 'skinsalve', new E.RNG(1))
  ok(salve.skin > 2, 'Skin Salve patched no skin')
  const pep = E.useKitStep(base({ kit: ['peptalk'], psyche: 1 }), 'peptalk', new E.RNG(1))
  eq(pep.psyche, 2, 'Pep Talk steadied no psyche')
  ok(E.useKitStep(base({ kit: ['peptalk'], psyche: E.PSYCHE_MAX }), 'peptalk', new E.RNG(1)).psyche === E.PSYCHE_MAX,
    'Pep Talk pushed psyche past its ceiling')
})
test('a consumable is spent on use, applies, and never leaks into the deck', () => {
  const rng = new E.RNG(11)
  const s = { ...startClimb(4, rng, { seed: 5 }), kit: ['chalkshot'], pump: 8 }
  const after = E.useKitStep(s, 'chalkshot', rng)
  eq(after.kit.length, 0, 'the consumable was not spent')
  eq(after.pump, 3, 'Chalk Shot did not shed its 5 pump')
  // a consumable is not a card: it must never enter any pile
  eq(after.piles.discard.length, s.piles.discard.length, 'a consumable leaked into the discard')
  eq(after.piles.exhaust.length, s.piles.exhaust.length, 'a consumable leaked into the exhaust')
  eq(after.piles.draw.length, s.piles.draw.length, 'Chalk Shot drew from the deck')
  // and one you are not carrying does nothing
  eq(E.useKitStep({ ...s, kit: [] }, 'chalkshot', rng).kit.length, 0, 'used a consumable from an empty kit')
})
test('the post offers one consumable, on its own line', () => {
  const shopped = E.stockShop({ ...startClimb(4, new E.RNG(2), { seed: 5 }), kit: [] }, new E.RNG(2))
  eq(shopped.shopKit.length, 1, 'the post did not stock exactly one consumable')
  ok(E.consumableById(shopped.shopKit[0]), 'the post stocked something that is not a consumable')
})
test('the kit rides along in a saved run', () => {
  const s = { ...E.freshRun(0, 0, 7), slot: 1, inRun: true, act: 0, tier: 1,
    runDeck: E.DEFAULT_LOADOUT.map(E.spawn), gear: ['sticky'], kit: ['betanapkin'] }
  E.saveGame(s)
  eq(JSON.stringify(E.loadGame(1).kit), JSON.stringify(['betanapkin']), 'the kit did not survive a save')
})

group('the extra-burn consumable (CARD-9)')
test('there is a burn consumable, and it is the only kind that grants one', () => {
  const burns = E.CONSUMABLES.filter(c => (c.burn ?? 0) > 0)
  ok(burns.length >= 1, 'no consumable grants a burn')
  for (const c of burns) {
    eq(c.shed ?? 0, 0, `${c.name} both grants a burn and does something mid-climb`)
    eq(c.draw ?? 0, 0, `${c.name} both grants a burn and draws`)
    eq(c.powerAll ?? 0, 0, `${c.name} both grants a burn and pushes power`)
  }
})
test('a Second Wind is spent at the fall and buys exactly one more burn', () => {
  const base = { ...E.freshRun(4, 0, 5), inRun: true, kit: ['secondwind'] }
  const cap0 = E.attemptsFor(base)
  const after = E.secondWindStep(base, 'secondwind')
  eq(after.kit.length, 0, 'the Second Wind was not spent out of the kit')
  eq(E.attemptsFor(after), cap0 + 1, 'a Second Wind did not raise the cap by exactly one')
  // one you are not carrying is a no-op — it can never conjure a burn from nothing
  eq(E.attemptsFor(E.secondWindStep({ ...base, kit: [] }, 'secondwind')), cap0,
    'a Second Wind fired from an empty kit')
})
test('a Second Wind buys a go on THIS line only — a fresh boulder clears it', () => {
  const rng = () => new E.RNG(3)
  const wound = E.secondWindStep(
    { ...E.freshRun(4, 0, 5), inRun: true, kit: ['secondwind'], burn: 2 }, 'secondwind')
  eq(wound.bonusBurns, 1, 'the Second Wind did not light bonusBurns')
  // a retry on the same line (burn >= 2) keeps it
  eq(E.startBurn({ ...wound, burn: 3 }, rng()).bonusBurns, 1, 'a retry on the same line lost the Second Wind')
  // a fresh boulder (burn 1) clears it — it never carries over
  eq(E.startBurn({ ...wound, burn: 1 }, rng()).bonusBurns, 0, 'a Second Wind carried onto a fresh boulder')
})
test('a burn consumable does nothing mid-climb — useKitStep refuses it', () => {
  const rng = new E.RNG(11)
  const s = { ...startClimb(4, rng, { seed: 5 }), kit: ['secondwind'], pump: 8 }
  const after = E.useKitStep(s, 'secondwind', rng)
  eq(after.kit.length, 1, 'a Second Wind was wasted by a mid-climb tap')
  eq(after.pump, s.pump, 'the Second Wind did something to the climb it should not have')
})

group('the climber in the story (NARR-12)')
test('every specialist climber shows up, and never on the balance', () => {
  const gated = E.TALKS.flatMap(t => t.replies.filter(r => r.arch))
  ok(gated.length >= 5, `only ${gated.length} archetype lines in the whole cast`)
  // each specialist climber gets at least one line; the boulderer (the default
  // and the sim's climber) gets none, so the guarded runs never see one
  for (const id of ['comp', 'trad', 'alpine', 'onsight'])
    ok(gated.some(r => r.arch === id), `the ${id} never shows up in a conversation`)
  ok(!gated.some(r => r.arch === 'boulderer'), 'the default climber has gated lines — the sim would see them')
  // flavour only: an archetype line carries no outcome, so who you are can never
  // move the completion band or the climber spread
  for (const r of gated)
    ok(!r.outcome, `an archetype line ("${r.label}") carries an outcome — it can move balance`)
})
test('repliesFor shows a climber their own line and hides the rest', () => {
  const talk = E.TALKS.find(t => t.replies.some(r => r.arch))
  const archId = talk.replies.find(r => r.arch).arch
  const at = E.ARCHETYPES.findIndex(a => a.id === archId)
  const bould = E.ARCHETYPES.findIndex(a => a.id === 'boulderer')
  const base = talk.replies.filter(r => !r.arch).length
  const forArch = a => E.repliesFor(talk, { ...E.freshRun(0, 0, 1), inRun: true, arch: a })
  eq(forArch(bould).length, base, 'the boulderer was shown a gated line')
  ok(forArch(at).length > base, `the ${archId} was not shown their own line`)
  // base replies always show; gated ones never leak outside a run
  ok(forArch(at).some(r => !r.arch), 'the base replies vanished for a specialist climber')
  eq(E.repliesFor(talk, { ...E.freshRun(0, 0, 1), inRun: false, arch: at }).length, base,
    'gated lines leak outside a run')
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

test('NARR-13: a line of yours comes back a trip later with the consensus', () => {
  const L = (claimed, real, run) => ({ name: 'Broken Arete', claimed, real, act: 0, burns: 2, run })
  const mk = over => ({ ...E.freshRun(0, 0, 1), inRun: true, act: 1, runs: 1,
    seen: ['marge1', 'fa:Broken Arete'], established: [L(5, 8, 0)], ...over })
  // it matures only in a LATER expedition, and only after the first reaction
  ok(E.consensusTalk(mk({})), 'the line never comes back')
  eq(E.consensusTalk(mk({ runs: 0 })), null, 'it comes back the same trip you put it up')
  eq(E.consensusTalk(mk({ seen: ['marge1'] })), null, 'the consensus jumps the queue ahead of her first word on it')
  eq(E.consensusTalk(mk({ seen: ['marge1', 'fa:Broken Arete', 'con:Broken Arete'] })), null,
    'she gives you the consensus twice')
  // a line from a save made before this shipped (no run stamp) never matures
  eq(E.consensusTalk(mk({ established: [L(5, 8, undefined)] })), null, 'an unstamped old line matured anyway')
  // all three verdicts read differently, and the consensus states the REAL grade
  const say = (c, r) => E.consensusTalkFor(L(c, r, 0), 0)
  const texts = [say(5, 8), say(7, 7), say(9, 6)].map(t => t.text)
  eq(new Set(texts).size, 3, 'the consensus reads the same however it drifted')
  ok(say(5, 8).text.includes('V8'), 'the sandbag consensus does not state the real grade')
  ok(say(9, 6).text.includes('V6'), 'the soft-grade consensus does not state the downgrade')
  for (const t of [say(5, 8), say(7, 7), say(9, 6)]) {
    ok(t.text.includes('Broken Arete'), 'the consensus does not name the line')
    ok(t.replies.length >= 2, 'a consensus with one way out')
    for (const r of t.replies) ok(r.label.length > 3 && r.text.length > 20, 'an empty reply')
  }
  // priority: a brand-new line's first reaction still comes before an old line's consensus
  const both = mk({ seen: ['marge1', 'fa:Broken Arete'],
    established: [L(5, 8, 0), { name: 'New Prow', claimed: 6, real: 6, act: 0, burns: 1, run: 1 }] })
  eq(E.availableTalk(both).id, 'fa:New Prow', 'the fresh line does not get the first word')
  // the screen can resolve every id it stores — static, fa:, and con:
  eq(E.talkById(mk({}), 'con:Broken Arete').id, 'con:Broken Arete', 'the consensus id dead-ends in the UI')
  eq(E.talkById(mk({}), 'fa:Broken Arete').id, 'fa:Broken Arete', 'the first-ascent id dead-ends in the UI')
  ok(E.talkById(mk({}), 'marge1'), 'a static talk stopped resolving')
  eq(E.talkById(mk({}), 'con:Nonexistent'), null, 'a phantom line resolved to a talk')
})

test('NARR-17: every conversation is reachable WITHOUT being handed his journal', () => {
  /* This test opened with `journal: [1, 2, 3, 4, 5, 6, 7]`. It HANDED ITSELF the pages,
     so it proved the chain works GIVEN them and never once asked whether they arrive.
     That is how NARR-17 sat here for versions while passing:

       `marge4` gated on PAGE 4, which is SEVENTH in delivery order — the journal is
       interleaved on purpose (1, 8, 2, 9, 3, 10, 4, ...) — so it wanted seven page
       grants. And TEN of the fourteen page grants in the game live inside the Marge
       chain that page 4 unblocks. Pages gated the talks; the talks supplied the pages.

     Measured over 200 careers of ten expeditions each: `marge4` through `marge8` fired in
     0.0% of them, the talks plateaued at 15 of 20 by trip six and never moved again, and
     the "known" epilogue never happened once in 673 wins.

     So the walk starts with NOTHING and may only collect what a reply actually hands
     over. It is given no event pages at all — the four events that grant one are the only
     supply from outside the chain, and a story that needs them is a story that depends on
     a map node advertising "No climbing. No telling." The chain has to stand up alone. */
  /* AND THE INVARIANT, so a future gate cannot re-create the deadlock a different way:
     whatever a talk asks for must be suppliable from OUTSIDE its own chain. A gate whose
     pages only arrive downstream of it is a gate that never opens, and that is true
     regardless of what the walk above happens to reach in what order. */
  const downstream = id => {
    const out = new Set([id])
    for (;;) {
      const before = out.size
      for (const t of E.TALKS) if (t.after && out.has(t.after)) out.add(t.id)
      if (out.size === before) return out
    }
  }
  const gated = E.TALKS.filter(t => t.needsPages !== undefined)
  ok(gated.length > 0, 'nothing gates on his pages any more, so this guard is asserting nothing')
  for (const g of gated) {
    const closed = downstream(g.id)
    const outside = E.TALKS.filter(t => !closed.has(t.id))
      .reduce((n, t) => n + t.replies.filter(r => r.outcome?.journal !== undefined).length, 0)
    ok(outside >= g.needsPages,
      `${g.id} wants ${g.needsPages} of his pages and only ${outside} page grant(s) exist ` +
      `outside the chain it gates — that is the NARR-17 deadlock again`)
  }

  /* AND IT BITES. Everything above is about the gate being satisfiable; a gate that is
     never checked satisfies all of it and gates nothing. So: her line about recognising
     his handwriting must not be available to somebody carrying no handwriting. */
  const g0 = E.TALKS.find(t => t.needsPages !== undefined)
  const primed = { ...E.freshRun(0, 0, 1), act: 2, journal: [],
    seen: E.TALKS.filter(t => t.id !== g0.id).map(t => t.id) }
  eq(E.availableTalk(primed), null,
    `${g0.id} is offered to a player carrying none of his pages, so its gate is not checked`)
  const enough = E.JOURNAL.filter(j => j.id !== E.SUMMIT_PAGE).map(j => j.id).slice(0, g0.needsPages)
  eq(enough.length, g0.needsPages, 'the journal is shorter than the gate asks for')
  ok(E.talkOpen(g0, { ...primed, journal: enough }),
    `${g0.id} stays shut with exactly as many of his pages as it asks for`)

  const grantPage = (st, t) => {
    let journal = st.journal
    for (const r of t.replies) {
      if (r.outcome?.journal === undefined) continue
      const next = E.nextPage({ ...st, journal })
      if (next !== null) journal = [...journal, next]
    }
    return journal
  }
  const walk = st => {
    const got = []
    for (const act of [0, 1, 2]) {
      st = { ...st, act }
      for (let i = 0; i < 40; i++) {
        const t = E.availableTalk(st)
        if (!t) break
        got.push(t.id)
        st = { ...st, seen: [...st.seen, t.id], journal: grantPage(st, t) }
      }
    }
    return [st, got]
  }
  // trip one, from nothing
  let [st, seen] = walk({ ...E.freshRun(0, 0, 1), seen: [], journal: [], act: 0 })
  /* Topping out is the only way to get the summit page, and `marge6` is gated on having
     been up there — correctly, since the scene is her reading it on your face. So the
     second trip starts the way a real second trip does. */
  ok(!seen.includes('marge6'), 'marge6 fires before you have been to the top, which is the scene it is')
  st = { ...st, journal: [...st.journal, E.SUMMIT_PAGE] }
  const [, more] = walk(st)
  seen = [...seen, ...more]

  eq(seen.length, E.TALKS.length,
    `unreachable on talk supply alone: ${
      E.TALKS.map(t => t.id).filter(i => !seen.includes(i)).join(', ')}`)

  /* The summit gate is the one exception and must stay a single named page rather than
     drifting back to a count, because "you have been to the top" is not a quantity. */
  const summit = E.TALKS.filter(t => t.needsSummit)
  eq(summit.length, 1, 'the summit gate is gone, or there is more than one of it')
  eq(E.pagesHeld([E.SUMMIT_PAGE]), 0, 'the summit page counts toward knowing him, and you read it after')
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
  /* NARR-16: `read` was `gripAt(6)`, which was the whole journal when this was
     written and is six of fourteen findable pages now. Six pages is a HALF-read
     journal; asking it to behave like a read one is how the eight pages NARR-11
     added went eleven versions being worth nothing. Read means read. */
  const blind = gripAt(0), read = gripAt(E.JOURNAL.length)
  ok(blind > read + 3, `an unread finale is only ${(blind - read).toFixed(1)} Grip harder`)
  ok(gripAt(3) < blind && gripAt(3) > read, 'the penalty does not scale with pages')
})
test('NARR-16: every page he wrote is worth the same on the wall', () => {
  /* The finale's blindness was one expression — `JOURNAL.length - 1 - held(pages 1..6)`
     — in which both halves meant SIX. NARR-11 grew the journal to fifteen, the first
     half became FOURTEEN, and the second stayed capped at six. Measured mean hold grip
     on the finale before the fix:

         no pages            24.37
         pages 1-6           18.37
         ALL FOURTEEN        18.37   <- identical. The eight new pages did nothing.
         the eight new ONLY  24.37   <- identical to holding none of them at all.

     They have BETA_CARDS entries and they count toward the ending; they simply could
     not be read on the wall. The map screen said `6/6 of his pages — you can read the
     whole thing` at the exact moment eight Grip a hold of blindness remained.

     THE INVARIANT, rather than the numbers: what the wall charges you may depend on HOW
     MANY of his pages you hold and must not depend on WHICH. The old guard next door
     compared blind against read and passed either way, because a uniform bug is invisible
     to a relative test — so this compares two disjoint halves of the same journal. */
  const finale = E.ROUTES.findIndex(r => r.finale)
  const gripOf = journal => {
    const rng = new E.RNG(77)
    const s = { ...E.freshRun(finale, 0, 5), inRun: true, skirmish: null, weather: 1, rock: 0,
      journal, runDeck: E.DEFAULT_LOADOUT.map(E.spawn) }
    return E.startBurn(s, rng).holdDeck.reduce((a, h) => a + h.grip, 0)
  }
  const all = E.JOURNAL.filter(j => j.id !== 7).map(j => j.id)
  eq(all.length, E.FINDABLE, 'FINDABLE and the journal disagree about what is findable')
  const front = all.slice(0, 7), back = all.slice(7)
  eq(front.length, back.length, 'the halves differ in size, so comparing them proves nothing')
  ok(!front.some(p => back.includes(p)), 'the halves overlap, so a dead half could hide in one')
  eq(gripOf(front), gripOf(back),
    `seven of his pages are worth ${gripOf(front)} and seven others ${gripOf(back)} — NARR-16 again`)
  ok(gripOf([]) > gripOf(back), 'the back of the journal is worth nothing on the wall, which was the bug')
  ok(gripOf(back) > gripOf(all), 'holding twice as much of it reads no better')

  /* The two endpoints are where the band is pinned and the fix was not allowed to move
     them: BLIND_HOLD is NARR-11's flat cost, kept because eleven versions have been
     balanced on top of it, and UNREAD_MAX is NARR-7's range. */
  eq(E.unreadGrip([]), E.UNREAD_MAX, 'reading nothing is no longer the full penalty')
  eq(E.unreadGrip(all), 0, 'you can read every page he wrote and the wall still calls you blind')
  eq(E.unreadGrip([...all, 7]), 0, 'a full journal plus the summit page no longer reads as sighted')
  /* The summit page must not count, and asserting that on a FULL journal proves nothing:
     `Math.min(held, FINDABLE)` clamps fifteen back to fourteen, so counting page 7 by
     mistake is invisible there. An injection that counted it survived this guard on
     exactly that. It has to be asked where the count is not clamped — you have topped
     out once and gone back out with nothing else, which is a real state and the very one
     the mistake would reward. */
  eq(E.unreadGrip([7]), E.UNREAD_MAX,
    'the summit page is being counted as beta you carried up — you read it AFTER the climb')
  eq(E.unreadGrip([...all.slice(0, 2), 7]), E.unreadGrip(all.slice(0, 2)),
    'the summit page is worth a step of relief on a part-read journal — you read it AFTER the climb')
  ok(E.BLIND_HOLD > 0 && E.UNREAD_MAX > 0, 'the two halves of the old constant are not both real')
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
      /* SIM-7: THE SLOT RULES, which this guard did not check and the builder did not
         obey. `copyLimit` caps copies of ONE card; RARE_SLOTS and UNCOMMON_SLOTS cap how
         many rares and uncommons the whole loadout may hold — "without this a full
         collection fields eight distinct rares and every route sends at ~100%". The card
         picker enforces them in three places; the builder enforced neither, so BUILD ME
         ONE handed a full collection TEN rares against a limit of one.
         Note WHY it was invisible: every case here and in the send guard below used a
         beginner's collection of starters and commons, which contains no rares at all. */
      const slots = r => d.filter(n => (E.CARDS[n].rarity ?? 'common') === r).length
      ok(slots('rare') <= E.RARE_SLOTS,
        `${label}: ${slots('rare')} rares against a limit of ${E.RARE_SLOTS} — the picker would refuse this deck`)
      ok(slots('uncommon') <= E.UNCOMMON_SLOTS,
        `${label}: ${slots('uncommon')} uncommons against a limit of ${E.UNCOMMON_SLOTS}`)
      ok(!d.some(n => (E.CARDS[n].rarity ?? '') === 'beta'), `${label}: it put a beta card in your deck`)
    }
  }
  /* SIM-7: the beta check above cannot fail on its own, because every `owned` set here
     already excludes beta — found by injecting exactly that and watching it stay green.
     `buildable` is what refuses them, whatever you claim to own, so that is asserted
     against a collection that DOES claim them. It matters because the balance harness's
     own stat sort had no such filter and measured the pinned band on a deck that was six
     beta cards out of fifteen. */
  const claimBeta = [...all, ...Object.keys(E.CARDS).filter(n => (E.CARDS[n].rarity ?? '') === 'beta')]
  ok(claimBeta.length > all.length, 'there are no beta cards, so this exclusion covers nothing')
  const withBeta = E.buildLoadout(st(claimBeta), [], claimBeta)
  eq(withBeta.filter(n => (E.CARDS[n].rarity ?? '') === 'beta').length, 0,
    'claiming beta cards as owned put them in the deck the game builds')

  const fifteen = E.DEFAULT_LOADOUT.slice(0, E.DECK_SIZE)
  eq(E.buildLoadout(st(all), fifteen, all).join('|'), fifteen.join('|'),
    'it rebuilt a deck that was already full')
  /* and a seed that is ALREADY over the limit must not be topped up with more — a save
     written before this fix can carry one, and the builder is the thing that has to not
     make it worse. */
  const rares = Object.keys(E.CARDS).filter(n => (E.CARDS[n].rarity ?? '') === 'rare').slice(0, 5)
  const over = E.buildLoadout(st(all), rares, all)
  eq(over.filter(n => (E.CARDS[n].rarity ?? '') === 'rare').length, rares.length,
    'it added more rares to a loadout that was already over the limit')
  // ONE RULE, in one place: the picker screen must still gate on the same constants
  const app = readFileSync('src/App.tsx', 'utf8')
  for (const k of ['RARE_SLOTS', 'UNCOMMON_SLOTS'])
    ok(app.includes(k), `the picker no longer reads ${k}, so it and the builder have drifted`)
  ok(/slotsUsed\(deck, 'rare'\) >= RARE_SLOTS/.test(readFileSync('src/engine.ts', 'utf8')),
    'the builder no longer counts its rares against the limit')
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
  /* SIM-7: this instrument CANNOT see the bug that ticket found, and that is worth
     writing down rather than papering over with an assertion that passes.
     The builder fielded ten rares against a limit of one, and that deck completed 18.9%
     of CAMPAIGNS against the starter deck's 28.1%. Measured on one early boulder, the
     same rare-stuffed deck sends 99% against the commons-built deck's 93% — it is BETTER
     here and much worse over a trip. Which is exactly what RARE_SLOTS was written for:
     "without this a full collection fields eight distinct rares and every route sends at
     ~100%". A single climb rewards raw stats; a campaign is attrition, and fifteen
     singleton rares draw badly and carry almost no shed.
     So the full-collection case is guarded two other ways instead: STRUCTURALLY above
     (the slot rules, negative-tested), and MEASURED over campaigns in the slow ledger
     ('SIM-7: the deck the game builds you beats the one it replaces'). Adding a send
     comparison here would have read green through the entire bug. */
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
  ok(v(E.spawn('Quiet Feet'), feet) > v(E.spawn('Quiet Feet'), rest),
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
  /* what is left should be situational — cards `cardValue` STRUCTURALLY cannot price,
     not filler. A sequence's payout depends on holding a condition across turns and
     protection depends on being on a rope, so neither reads in an average state.
     CARD-18 adds `read` to that set, and it is the same property rather than a
     softer bar: the value of reading the wall is planning, and the greedy policy
     does not plan — it never consults `readAhead` at all, which is asserted just
     below so this classification stays a derived fact. INFO-1 tried to remove this excuse by
     giving a read a mechanical effect and retracted it (engine.ts, `effGrip`), so the excuse
     stands and it stands for the original reason. */
  /* SEQ-2 replaced the RATIO, not the excusing. The old second half said 40% of whatever is
     down here must be structurally unpriceable — a bar that gets HARDER to clear the better
     those cards are priced, which is backwards: pricing a plan properly moved three of the
     four sequences out of the dead set and the ratio fell to 2 of 6, failing a guard whose
     subject had just improved. So the claim is absolute now, and far stronger for it — the
     old bar permitted 33 dead cards of which about 20 could be pure filler.

     The situational classes stay excused, because that is a true statement about them rather
     than a loophole: `seqValue` is deliberately deck-dependent, so a rest plan in a deck with
     two rest cards SHOULD read as a bad card — the guard directly above requires exactly that
     asymmetry. "A plan is worth a slot" is a claim about a deck that can hold one, and it is
     asserted there, in the SEQ-2 guard, against such a deck. */
  ok(dead.length / vals.length < 0.05,
    `${dead.length} of ${vals.length} cards would never be taken`)
  /* INFO-1 TOOK `read` OUT OF THE EXCUSED SET AND PUT IT BACK. Making a read grant beta on the
     holds it covered did lift both cards out of the dead set — `Sight the Line` 5.2 to 12.9 and
     `Take It All In` −3.0 to 12.4 — and it also put the pinned band up 1.8 points in a way four
     separate dials could not touch, because a read covers whatever arrives next and so amounts to
     a flat discount on the whole wall. That half is retracted; see `effGrip` in engine.ts for the
     numbers. `read` is situational again, and for exactly CARD-18's reason. */
  const filler = dead.filter(([n]) => !E.CARDS[n].read && !E.CARDS[n].seq && !E.CARDS[n].clip)
  ok(filler.length <= 6,
    `${filler.length} dead cards the valuation CAN price and still would not take: ${filler.map(([n]) => n).join(', ')}`)
  // the derivation behind counting `read` as situational: the policy cannot spend it
  const eng = readFileSync('src/engine.ts', 'utf8')
  /* comments stripped: INFO-1's note inside `autoPlay` explains why the policy does NOT spend a
     read, and the un-stripped window matched the word in that explanation — ART-4's class. */
  const auto = stripComments(region(eng, 'export function autoPlay', ['export function coach',
    '\nexport function ', '\nexport const '], { min: 600, what: 'autoPlay' }))
  ok(!/readAhead/.test(auto),
    'the policy reads ahead now, so `read` is priceable and must not be excused as situational')
  ok(E.CARDS['Sight the Line'].read > 0 && E.CARDS['Take It All In'].read > 0,
    'the read cards are gone, so this exclusion covers nothing')
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
test('SEQ-2: a plan is nameable, protectable, and priced on the deck holding it', () => {
  /* SEQ-2. Sequences were a side quest, and the audit found five separate reasons rather than
     one. Three are fixed here and asserted below; two were MEASURED AND RETRACTED, and the
     retractions are guarded too, because a comment does not stop anybody re-adding a change
     that cost four points. */

  /* ONE — TWO OF THE FOUR PLAN CARDS WERE NAMED AFTER OTHER CARDS. 'Read The Sequence'
     (uncommon, starts Static Sequence) against 'Read the Sequence' (common, draw 2), and
     'Trust The Feet' (rare, starts Committed) against 'Trust the Feet' (common, +2 Power).
     They differ by the case of the word "the", which no screen in this game renders
     differently — the collection, the deck editor, a shelf and a reward offer all read them as
     one card. Asserted pool-wide rather than on those two names, so it is the RECURRENCE that
     is blocked and not the two instances. */
  const byLower = {}
  for (const n of Object.keys(E.CARDS)) (byLower[n.toLowerCase()] ??= []).push(n)
  const clash = Object.values(byLower).filter(v => v.length > 1)
  eq(clash.length, 0, `cards whose names differ only by case: ${clash.map(v => v.join(' / ')).join(' · ')}`)
  /* AND THE SAME CHECK AT SOURCE, because `CARDS[c.name] = c` means an EXACT duplicate is
     invisible at runtime: the second definition silently overwrites the first and the card
     simply is not in the game any more. Two names one case apart leave two entries and are
     caught above; two identical names leave one, and only the literal can show it. */
  const engSrc = readFileSync('src/engine.ts', 'utf8')
  const lit = region(engSrc, 'export const CARDS', [']) CARDS[c.name] = c'],
    { min: 4000, what: 'the card table' })
  const declared = [...lit.matchAll(/^ {2}(?:mv|bn|ft)\('([^']+)'/gm)].map(m => m[1])
  ok(declared.length > 200, `only ${declared.length} card definitions found — this guard is reading the wrong window`)
  const seenName = {}
  for (const n of declared) seenName[n] = (seenName[n] ?? 0) + 1
  const dupes = Object.keys(seenName).filter(n => seenName[n] > 1)
  eq(dupes.length, 0, `defined twice, so the second silently deletes the first: ${dupes.join(', ')}`)
  // and the four are still four, so a rename cannot quietly drop one out of the game
  const plans = Object.keys(E.CARDS).filter(n => E.CARDS[n].seq)
  eq(plans.length, E.SEQUENCES.length,
    `${plans.length} cards start a plan but there are ${E.SEQUENCES.length} plans`)
  for (const q of E.SEQUENCES) ok(plans.some(n => E.CARDS[n].seq === q.id),
    `no card starts ${q.id}, so that plan is unreachable`)

  /* TWO — A PLAN SURVIVES EXACTLY ONE MISS. The measured reason is in the SEQ_GRACE note: the
     four cards were the worst-scoring bonuses in the game and the valuation was right, because
     in play a plan was a coin flip (55 completed, 53 broken over 600 campaigns). A plan lost to
     one bad draw is a plan nobody makes. */
  ok(E.SEQ_GRACE >= 1, 'there is no slip at all, so a plan is a coin flip again')
  const rng = new E.RNG(4)
  let s = { ...E.freshRun(6, 0, 9), inRun: true,
    runDeck: E.DEFAULT_LOADOUT.map(E.spawn), skin: 9, psyche: 3 }
  s = E.startBurn(s, rng)
  // 'breathe' wants a rest, and an empty board never rests, so every turn below is a miss
  const miss = st => E.resolve({ ...st, boardP: [null, null, null], phase: 'climb', pump: 0 }, rng)
  let live = { ...s, seq: { id: 'breathe', left: 2, slip: E.SEQ_GRACE } }
  for (let i = 0; i < E.SEQ_GRACE; i++) {
    const was = live.seq.left
    live = miss(live)
    ok(live.seq, `the plan died on miss ${i + 1} of ${E.SEQ_GRACE} allowed`)
    eq(live.seq.left, was, 'a missed turn counted down the plan, so it pays sooner than the card says')
    ok(live.log.some(l => /slip/i.test(l)), 'a slip was spent silently')
  }
  const dead = miss(live)
  eq(dead.seq, null, 'the plan outlived its slips — it cannot be lost at all')
  ok(dead.log.some(l => /broken/.test(l)), 'the plan was dropped without saying so')
  // a save written before SEQ-2 has no `slip` field and must not read as zero
  ok(miss({ ...s, seq: { id: 'breathe', left: 2 } }).seq,
    'a pre-SEQ-2 save loses its plan on the first miss')

  /* THREE — THE ODDS ARE THE RIGHT SHAPE. `seqValue` discounts a plan by whether the deck can
     hold its condition, which is the whole reason a plan is worth a slot to one deck and not
     another; the first cut of this ticket used a binomial over `turns - 1` trials, which
     collapses to certainty at two turns and made the value stop depending on the deck. It also
     carried an off-by-one: the condition is checked on the turn the plan STARTS, so `turns`
     turns must hit. Both are asserted — the behaviour by measurement, the exponent at source,
     because no deck distinguishes `turns` from `turns - 1` by value alone. */
  const base = E.DEFAULT_LOADOUT.map(E.spawn)
  const rests = [...base, ...Array(6).fill(0).map(() => E.spawn('Shake Out'))]
  const feets = [...base, ...Array(6).fill(0).map(() => E.spawn('Smear'))]
  const val = (n, d) => E.cardValue(vState({ runDeck: d }), E.spawn(n), d)
  const restPlan = plans.find(n => E.seqById(E.CARDS[n].seq).need === 'rest')
  const feetPlan = plans.find(n => E.seqById(E.CARDS[n].seq).need === 'feet')
  ok(restPlan && feetPlan, 'the fixture needs a rest plan and a feet plan and one is gone')
  ok(val(restPlan, rests) > val(restPlan, feets),
    `${restPlan} is priced the same whatever the deck, so the odds no longer depend on it`)
  ok(val(feetPlan, feets) > val(feetPlan, rests),
    `${feetPlan} is priced the same whatever the deck, so the odds no longer depend on it`)
  const eng = readFileSync('src/engine.ts', 'utf8')
  /* COMMENTS STRIPPED. The note above `seqValue` explains SEQ_GRACE at length, so the
     un-stripped window matched the prose describing the rule rather than the code applying
     it — ART-4's failure class, and this guard walked straight into it: the injection that
     removes the slip from the odds left every word of that comment in place and passed. */
  const sv = stripComments(region(eng, 'function seqValue(', ['\n/*', '\nexport '],
    { min: 700, what: 'seqValue' }))
  ok(/t = q\.turns$/m.test(sv),
    'the odds need one turn fewer than the card says — the condition is checked on the turn the plan starts')
  ok(/k <= SEQ_GRACE/.test(sv), 'the valuation no longer knows a plan gets a slip')

  /* AND THE BANNER SAYS WHETHER THE MARGIN IS STILL THERE. A slip you cannot see is not a
     slip you can spend, and the turn where the next miss ends the plan has to read differently
     from the turn before it — the same telegraph rule ROUTE-6's windows set. */
  const app = readFileSync('src/App.tsx', 'utf8')
  const banner = region(app, 'st.seq && seqById(st.seq.id)', ['NARR-15'],
    { min: 300, what: 'the plan banner' })
  ok(/slip > 0/.test(banner) && /No slip left/.test(banner),
    'the banner does not say whether the slip is still there, so the margin cannot be spent')

  /* AND THE TWO RETRACTIONS. Both were implemented, measured, and taken back out; each is
     asserted here so re-adding it fails with the number attached rather than shipping. */
  const pools = [...E.REWARDS.common, ...E.REWARDS.uncommon, ...E.REWARDS.rare]
  eq(pools.filter(n => E.CARDS[n]?.seq).length, 0,
    'a plan is in the reward pools again — that measured 44.2% to 26.6% (n=3000) by diluting them')
  // the shelf retraction is asserted next door, in the core suite's shop guard
  ok(!/PLAN_STOCK\s*=/.test(eng),
    'a plan is on the shop shelf again — that measured 44.3% to 40.3% (n=3000), because bestOffer buys it instead of a move')
})

test('a broken sequence is dropped, not carried', () => {
  /* SEQ-2 changed this rule, so the guard states the new one and still has to see a plan
     DIE — "it survived" on its own would pass a sequence that can never be lost at all. */
  const rng = new E.RNG(21)
  let s = { ...E.freshRun(6, 0, 9), inRun: true,
    runDeck: E.DEFAULT_LOADOUT.map(E.spawn), skin: 9, psyche: 3 }
  s = E.startBurn(s, rng)
  ok(E.SEQ_GRACE >= 1, 'there is no slip, so the rest of this guard is testing nothing')
  // 'breathe' wants a rest; an empty board never rests, so every turn here is a miss
  const fresh = { ...s, seq: { id: 'breathe', left: 2, slip: E.SEQ_GRACE }, boardP: [null, null, null], pump: 0 }
  const once = E.resolve(fresh, rng)
  ok(once.seq, 'the first miss killed the plan outright, so the slip does nothing')
  eq(once.seq.slip, E.SEQ_GRACE - 1, 'the miss did not cost the slip')
  eq(once.seq.left, 2, 'a missed turn counted toward the plan, so it pays a turn earlier than the card says')
  ok(once.log.some(l => /slip/i.test(l)), 'the slip was spent silently')
  // and with nothing spare the next miss ends it
  const twice = E.resolve({ ...once, boardP: [null, null, null], phase: 'climb', pump: 0 }, rng)
  eq(twice.seq, null, 'the plan survived a second miss with no slip left — it cannot be lost')
  ok(twice.log.some(l => /broken/.test(l)), 'it was dropped without saying so')
  // a save written before SEQ-2 has no `slip` field, and must not read as un-slippable
  const old = E.resolve({ ...s, seq: { id: 'breathe', left: 2 }, boardP: [null, null, null], pump: 0 }, rng)
  ok(old.seq, 'a pre-SEQ-2 save loses its plan on the first miss')
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
    const mods = E.boonMods([b.id])
    /* GUARD-4: `dyno` used to appear on BOTH sides of this trade — as a gain and,
       via `mods.dyno && true`, as its own cost — so for Deadpointing (whose only
       mod IS dyno) the assertion was a tautology and the boon could have become
       pure upside with a green suite. Each side must now be satisfied by a
       DISTINCT mechanism, and dyno's cost is pinned behaviourally below instead
       of being asserted by restating the gain. */
    const gains = [['dPowerAll', mods.dPowerAll > 0], ['dDraw', mods.dDraw > 0],
      ['dyno', !!mods.dyno], ['dTurnCap', mods.dTurnCap > 0],
      ['dContactAll', mods.dContactAll > 0]].filter(([, on]) => on).map(([k]) => k)
    const costs = [['noRests', !!mods.noRests], ['dumpHand', !!mods.dumpHand],
      ['dFallSkin', mods.dFallSkin > 0], ['halvedContact', !!mods.dyno]]
      .filter(([, on]) => on).map(([k]) => k)
    ok(gains.length, `${b.id} gives nothing`)
    ok(costs.length, `${b.id} costs nothing — a wild boon that is pure upside is just a good one`)
    ok(b.text.length > 30, `${b.id} does not explain its own trade`)
  }
})
test('GUARD-4: Deadpointing pays for its doubled Power with halved Contact', () => {
  /* The doubling was tested; the halving — the entire cost of the strongest wild
     boon, and a global lever — was asserted nowhere in either suite. Delete the
     `* 0.5` and every guard stayed green. This pins it on the real path: the deck
     the burn actually deals, read the way the game reads it.
     COND-3 moved that read. It used to be the `contact` written onto each dealt
     card in startBurn; Contact is computed live now, so the halving is asserted
     through `contactOf` — the number the board, the hand and resolve all use. */
  const mk = boons => {
    const rng = new E.RNG(11)
    const s = E.startBurn({ ...E.freshRun(4, 0, 7), inRun: true, skirmish: null,
      weather: 1, rock: 0, boons, runDeck: E.DEFAULT_LOADOUT.map(E.spawn) }, rng)
    const moves = [...s.piles.draw, ...s.piles.hand].filter(c => c.kind === 'move')
    return moves.reduce((a, c) => a + E.contactOf(s, c), 0) / moves.length
  }
  const plain = mk([]), dyno = mk(['deadpointing'])
  ok(dyno < plain, `Deadpointing did not halve Contact: ${plain.toFixed(2)} → ${dyno.toFixed(2)}`)
  ok(dyno <= plain * 0.75,
    `Contact only fell ${(100 - 100 * dyno / plain).toFixed(0)}% — the doubled Power is close to free`)
  ok(dyno >= 1, 'Contact was halved past the floor every move is meant to keep')
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
test('CARD-10: Redpoint and Static are wild trades that reach the rules', () => {
  const base = { ...E.freshRun(4, 0, 1), inRun: true, skirmish: null, weather: 1, rock: 0, boons: [] }
  // Redpoint: +2 Power on every move, paid for with no shaking out
  const card = E.spawn('Lock Off')
  const hold = { uid: 1, name: 'crimp', bite: 3, grip: 9, crux: false, clean: false }
  const red = { ...base, boons: ['redpoint'] }
  ok(E.powerAgainst(red, card, hold, 0) >= E.powerAgainst(base, card, hold, 0) + 2, 'Redpoint did not raise Power by 2')
  ok(E.boonMods(['redpoint']).noRests, 'Redpoint still lets you rest — it has no cost')
  // Static: +2 Contact on the deck's moves, and a costlier fall
  eq(E.boonMods(['static']).dContactAll, 2, 'Static gives no Contact')
  eq(E.boonMods(['static']).dFallSkin, 1, 'Static costs nothing on a fall')
  // COND-3: read through contactOf, which is where the boon's Contact now lands
  const move = p => p.piles.draw.concat(p.piles.hand).find(c => c.kind === 'move')
  const ps = E.startBurn(base, new E.RNG(3))
  const ss = E.startBurn({ ...base, boons: ['static'] }, new E.RNG(3))
  const plain = E.contactOf(ps, move(ps)), stat = E.contactOf(ss, move(ss))
  ok(stat > plain, `Static did not stick the moves: ${plain} vs ${stat}`)
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
  /* esbuild ships the literal \u00b7 rather than decoding it (v0.4).
     GUARD-2 (v10.0): this guard COULD NOT FAIL. It ran against `CODE`, which is
     engine.ts \u2014 a file with zero `className=` in it, and a sibling guard
     ("the engine reaches for JSX className") actively forbids ever adding one.
     So the regex could never match and the check had been vacuously green since
     v0.4 while all 571 JSX attributes lived unscanned in App.tsx. It reads the
     screens now, and both files, so neither can regress.
     The distinction it draws is deliberate: an escape inside a STRING LITERAL is
     fine (JS decodes it \u2014 App.tsx has five, e.g. the trail marks), an escape in
     JSX TEXT is the bug, because that is what shipped literally. */
  const app = readFileSync('src/App.tsx', 'utf8')
  const jsxText = /className=[^>]*>[^<]*\\u[0-9a-fA-F]{4}/
  for (const [name, src] of [['App.tsx', app], ['engine.ts', CODE]])
    ok(!jsxText.test(src), `use a real glyph in JSX, never an escape (${name})`)
  // and prove the check is live rather than trivially green
  ok(jsxText.test('<span className="lbl">\\u00b7PUMP</span>'),
    'the escape check no longer matches the bug it exists for')
})
test('every font size scales with --fs', () => {
  // the CSS and the prose both live in App.tsx, not engine.ts — the old guard
  // sliced engine.ts and quietly matched nothing (which is how the narrative
  // blocks' hardcoded 13px slipped the text-size setting for good)
  const app = readFileSync('src/App.tsx', 'utf8')
  /* GUARD-3: anchor the slice. `indexOf` returns -1 when the CSS block is renamed or
     moved, `slice(-1, …)` yields '', and the assertion below is a count-equals-zero — so
     the whole check would pass on an empty string. This is the very guard whose comment
     above records the LAST time it silently matched nothing; it should not be able to
     happen twice. GUARD-8 moved all three of those checks into `region` so that no
     future window has to remember to make them. */
  const css = region(app, 'const CSS = `', ['`'], { min: 8000, what: 'the stylesheet' })
  const cssFixed = css.match(/font-size:\d/g) ?? []
  eq(cssFixed.length, 0, `${cssFixed.length} CSS font sizes bypass the text-size setting`)
  // 13px was the reading size for every narrative block (event, talk, claim,
  // endings, run/session/burn recaps); it must scale, so no bare 13 survives
  const prose = app.match(/fontSize:\s*13\b/g) ?? []
  eq(prose.length, 0, `${prose.length} inline narrative font sizes bypass the text-size setting`)
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
    /* BAL-16: TWO PASSES, because the floor is a claim about ONE climber and the minimum of
       five noisy estimates is biased downward. A 6% event at n=600 has an SE of ~0.9, so
       taking `min` of five of them reads about a point low — the Comp Kid measured 5.2%
       here against a floor of 5 while its real value was 5.8%, and this guard was a coin
       flip rather than a measurement. It was raised 300 -> 600 once for exactly this and
       that was not enough.
       So: a coarse pass for the SPREAD, which is a ratio of two mid-range numbers and does
       not need resolution, then a FINE pass on the two lowest, which is where the floor is
       actually asserted. `ARCH_ONLY` exists so that costs 4,000 runs and not 12,500 — the
       other three climbers cannot hold the floor and there is no reason to pay for them
       (GUARD-6). Two rather than one because the coarse pass picks the lowest off noisy
       numbers and the bottom two currently sit 0.0 apart.

       BAL-18 RETIRED THE COARSE PASS, and both of the sentences above turned out to be the
       problem rather than the design.

       "The other three climbers cannot hold the floor" was true when the roster spanned 3.3
       to 29.8. At v10.65 four of the five sit inside 0.5 points at n=600, where the SE is
       about 1.0 — so the coarse pass is ranking a roster it cannot resolve. Measured, on
       the same engine and the same seeds: it read Boulderer 6.7, Comp Kid 6.8, Alpinist
       7.0, Trad Dad 7.2 and picked {Boulderer, Comp Kid}, while the truth at n=2000 is Comp
       Kid 6.8, Alpinist 7.0, Boulderer 7.7, Trad Dad 7.8. It named the FOURTH climber as
       the lowest and left the second-lowest unmeasured — and passed, because the pair it
       happened to pick contained the real minimum. Luck, not a measurement.

       So the RANKING comes from the ledger in band.mjs, which is recorded at n=2000 by
       whoever ships the version, and this guard fine-measures the two the ledger names. It
       is cheaper as well as better: 4,000 runs instead of 7,000, GUARD-6 satisfied rather
       than argued with. And because one climber at n=2000 IS affordable to re-run — which
       the band at n=3000 campaigns is not — the fine pass also refuses a recorded number it
       cannot reproduce, so the ledger cannot be stale or invented where it matters. */
    const read = cmd => [...execSync(cmd, { encoding: 'utf8' })
      .matchAll(/\s([\d.]+)%\s+\d+/g)].map(m => Number(m[1]))
    const FINE = ARCH_N
    const ladder = BAND_LOG[BAND_LOG.length - 1].arch
    ok(ladder, 'the newest ledger entry records no climber ladder — '
      + `measure it (\`PROJECTS=0 node sim/run.mjs arch ${ARCH_N}\`) and add \`arch\` to the entry`)
    for (const a of E.ARCHETYPES)
      ok(typeof ladder[a.id] === 'number' && ladder[a.id] > 0 && ladder[a.id] < 100,
        `${a.name} is not in the recorded ladder, so nothing here can check it`)

    /* LANE-5 MEASURES ALL FIVE, and BAL-18's own blind spot is why.
       BAL-18 replaced a coarse n=600 ranking with the ledger's n=2000 one and fine-measured the
       two climbers the LEDGER called lowest. Better ranking, same hole one layer down: the ranking
       is taken BEFORE the change under test, so a change that sinks a MID-ladder climber is
       invisible. Demonstrated, not argued — reverting LANE-5's Trad Dad buy-back drops it to 5.5%
       against a floor of 5 and the whole slow suite passed, because the ledger had it fourth and
       nobody looked. That is the same fatal assumption BAL-18 called out in the design it
       replaced ("the other three climbers cannot hold the floor"), made about a fresher number.
       So: one `arch` run, every climber, at the sample the floor is expressed in. 10,000 runs
       against the 4,000 BAL-18 spent and the 7,000 before it — GUARD-6 says state the cost, and
       ~3 minutes buys the difference between checking two climbers and checking the claim. */
    const got = read(`PROJECTS=0 node sim/run.mjs arch ${FINE}`)
    eq(got.length, E.ARCHETYPES.length, `read ${got.length} climbers, expected ${E.ARCHETYPES.length}`)
    const measured = got.map((v, i) => [v, i])
    const [lo, worst] = [...measured].sort((a, b) => a[0] - b[0])[0]
    const hi = Math.max(...got)
    /* Floor back to 5 at v9.35. It was lowered to 4 at v9.32 to accommodate a
       drift rather than to fix it, which is the thing BAL-9 exists to prevent.
       BAL-14 investigated it properly: six separate hypotheses tested, none
       worth more than two points, so there was no single cause — it was six
       changes each worth a point or two, compounding, which is precisely the
       failure mode BAL-9 documented. Corrected with one dial (RUN_SKIN 8 to 9)
       rather than by moving the goalposts again. */
    /* BAL-17 — THE DATED DECISION THE FLOOR HAS BEEN WAITING FOR (2026-08-16). BAL-16 left
       a standing note: the floor of 5 was set when the roster spanned 3.3 to 29.8, and the
       roster now lives between 6 and 9, so it is a far tighter fit than it was and the next
       climber to drift hits the same unmeasurable margin. Measured again at n=2000 for the
       decision:

           Boulderer 8.7 · Onsighter 7.7 · Alpinist 7.3 · Comp Kid 7.0 · Trad Dad 6.6
           spread 1.32x against a 2.2x ceiling

       (The lowest is the TRAD DAD now, not the Comp Kid — BAL-16 bought that one back. The
       fine pass sorts, so it followed without being told.)

       THE FLOOR STAYS AT 5, for three reasons rather than inertia:
         · 6.6 clears 5 by 2.9 SE at n=2000, which is a measurement this project can afford
           and is exactly what the assertion below checks;
         · raising it to 6 would cut that margin to 1.1 SE — unresolvable at any affordable
           sample, which is precisely the state BAL-16 spent a version escaping;
         · and making it RELATIVE to the best climber (60% of 8.7 is 5.2, almost the same
           number today) would move with the roster, so the one failure an absolute floor
           exists to catch — every climber sinking together — would stop firing.
       Revisit if the roster's floor moves under ~6.2, where the 2 SE margin runs out. */
    ok(lo > ARCH_FLOOR, `${E.ARCHETYPES[worst].name} completes only ${lo}% of runs`)
    /* AND THE FLOOR HAS TO BE MEASURABLE. A margin inside the noise is not a property this
       guard can defend, and reporting that is more useful than flaking: at 5.8% the Comp
       Kid cleared a floor of 5 by 1.7 SE, which no sample this project can afford would
       turn into a real claim — so the CLIMBER was bought back (BAL-16, dPsyche) rather than
       the floor moved to meet it, which is the thing BAL-9 exists to forbid. */
    const se = 100 * Math.sqrt((lo / 100) * (1 - lo / 100) / FINE)
    ok(lo - ARCH_FLOOR > 2 * se,
      `${E.ARCHETYPES[worst].name} clears the floor by only ${((lo - ARCH_FLOOR) / se).toFixed(1)} SE ` +
      `(${lo}% at n=${FINE}) — that is a coin flip, not a measurement`)
    /* BAL-18: the spread reads the recorded ladder for its top and the FINE pass for its bottom.
       Which is the right way round — the numerator is a mid-range number that does not need
       resolution (the old comment above says so) and the denominator is the floor claim. */
    ok(hi / lo < 2.2, `spread is ${(hi / lo).toFixed(1)}x — `
      + E.ARCHETYPES.map((a, i) => `${a.name.replace('The ', '')} ${got[i]}`).join(' / '))

    /* AND ONLY THEN THE BOOKKEEPING. The ledger has to be reproducible — that is what makes
       recording it worth anything, and it is the check the band ledger admits it cannot have.
       It comes LAST on purpose: it used to run inside the fine pass, so a change that sank a
       climber failed as "stale ledger" instead of as "climber under its floor", and the injection
       for the buy-back could never reach the assertion it was written for. The game claim first,
       then whether somebody wrote the number down. */
    for (const [v, i] of measured) {
      const a = E.ARCHETYPES[i]
      ok(Math.abs(v - ladder[a.id]) <= ARCH_TOL,
        `${a.name} measures ${v}% against the ${ladder[a.id]}% recorded in band.mjs — `
        + 'the ladder is stale or was never measured; re-record it')
    }
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
       so a run found 0.4 pages and the full journal was 35 expeditions away.
       v9.87 (ENG-25): raised n=250 → n=600. Opposition, once the drafter and
       policy could see it, lifted the low-journal bands (it is journal-
       independent power), so the 7- and 14-page bands converged to within ~1
       point — and at n=250 the ~3-point per-band SE flicked them into a benign
       inversion (7=51.6 over 14=49.2). Same fix ROUTE-8 and CARD-9 took —
       measure the property at a sample that can show it, not loosen it.
       v9.89 (CARD-15): the richer reward pool lifted every band (the whole re-pin
       to ~52); n=600 now reads ~40 / ~49 / ~53 and n=1000 ~36 / ~49 / ~52, still
       monotonic and still worth well over 5 points to read the journal. */
    const out = execSync('node sim/run.mjs campaign 600', { encoding: 'utf8' })
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
  test('NARR-22: the ending the pages exist for, on a band that can see a slide', () => {
    /* THE HOLE THIS FILLS. The campaign audit (NARR-16..NARR-20) was closed against two
       harness policies: never take a trail node, and take every one. They produced `known`
       ending figures of 0.0% and 51.1%, which BRACKET the truth without ever measuring it —
       and NARR-18 is unmeasurable by either, because it changed what the node SAYS and the
       sim cannot read. Five versions of narrative work, and no number anybody could defend.

       `reads` is the player that node is now written for: they know his pages turn up out
       there, so they take it while there are still pages to find and stop once the journal
       is full. Measured at 60 careers x 8 expeditions:

           policy    completion   pages/15   known    partial   stranger
           climbs         28.3%        6.0     0.0%      82.0%      18.0%
           reads          41.7%       11.2    43.1%      48.3%       8.6%

       AND THE FINDING IS THAT `reads` IS INDISTINGUISHABLE FROM `events`: at 200x10 they
       measure 50.7% and 51.1% known, 12.5 pages each. The clause I added — stop once the
       journal is full — almost never fires inside a realistic career, because the journal
       does not fill inside one. That is not a defect in the model, it is the answer: the
       trail node costs nothing (completion is HIGHER with it, 41.7% against 28.3%, because
       pages become beta), so the optimal informed policy really is "take every one". The
       two "extremes" were never extremes. They were "believes the label" and "does not".

       WHAT THIS STILL CANNOT MEASURE: whether a human reads the label. That is the one
       question left in the audit and no harness can answer it. */
    /* NARR-22 — WHAT THIS GUARD GOT WRONG, TWICE, AND WHAT THAT COST.

       It was pinned at 43.1% and asserted `> 25`. Measured at v10.64 it read 25.1%: it had
       been passing by one tenth of a point, and nobody could have known, because a bar
       EIGHTEEN POINTS below its own pin is not a guardrail, it is a formality. That is the
       GUARD-10 failure shape exactly — a long slide passes every run until it doesn't — and
       the reason the bar was set that low is honest enough: at 60 careers the standard error
       on this is about 6 points, so any bar close to the pin would have cried wolf.

       FIRST MISTAKE: THE DENOMINATOR. `known` is measured over WINS, and only a late
       expedition holds ten pages, so the ratio divides late wins by all wins — which means
       PLAYING BETTER LOWERS IT. LANE-2 is the proof: it raised the campaign band 42.1 to
       46.4, which turned 174 wins into 199, and this number "fell" 29.3% to 25.1% while the
       share of careers that actually reached the known ending ROSE 48.3% to 50.0%. A guard
       that fires on an improvement is worse than no guard. LANE-3 is parked behind exactly
       that misreading. So the band is now on CAREERS — did the story land at all, for this
       player, inside eight expeditions — which is the question the pages exist to answer and
       is monotone in the right direction.

       SECOND MISTAKE: THE SAMPLE. 60 careers was chosen when this only had to bracket a
       number, and at that sample the fix reads 58.3% where 240 reads 62.9% — the old bar was set
       18 points low precisely to survive that noise. A band needs resolution, so it now reads
       240 (SE ~3.2, ~75s) and the tolerance is ±6: under two standard errors, and tight enough
       to have caught RUN-14's nine-point step in the version that shipped it. The `climbs` arm
       stays at 60 because it is structurally zero — it finishes on 5.8 pages against a
       threshold of 10, and no sample size changes that.

       WHAT THE BISECTION FOUND. On the career measure at 240, v10.51 reads 61.3% and v10.52
       reads 52.1% — RUN-14, one step, nine points — and v10.64 reads 53.3%, so everything
       after it is flat inside one standard error. The cause is in the `tierNodes` note in the
       engine: RUN-14's swap could take the trail node, which is the journal's only tap, and
       could not hand one back. Fixed there, and this reads 62.9% against 58.8% for an engine
       where RUN-14 never happened.

       WHAT THIS BAND DOES NOT HAVE TO CATCH, and it matters for how wide it is. The two
       narrower fixes measured on the way — protect the trail node but leave the drop wide
       (58.3%), and leave it gainable in the swap pool (67.1%) — both fail the RUN-14 core
       guard in the FAST suite, on the count of a kind per stage, in milliseconds. So this
       band is not the thing standing between a plausible misfix and the release. It is here
       for the case nothing structural can see: the ending arriving a trip later because of
       something somewhere else entirely, which is what happened for twelve versions. */
    const career = (policy, n) => {
      const out = execSync(`TRIPS=8 node sim/run.mjs career ${n} ${policy}`, { encoding: 'utf8' })
      const ck = /careers reaching the known ending: ([\d.]+)%/.exec(out)
      ok(ck, `could not read a career ending rate out of the ${policy || 'climbs'} career`)
      const ep = /known ([\d.]+)%\s+partial ([\d.]+)%\s+stranger ([\d.]+)%/.exec(out)
      ok(ep, `could not read an epilogue split out of the ${policy || 'climbs'} career`)
      const rows = [...out.matchAll(/\/20\s+([\d.]+)\/15/g)].map(m => Number(m[1]))
      ok(rows.length >= 8, `read ${rows.length} expedition rows, not the eight asked for`)
      return { ending: Number(ck[1]), stranger: Number(ep[3]), pages: rows[rows.length - 1] }
    }
    const reads = career('reads', ENDING_N)
    /* THE BAND, with a date on it, in the shape BAL-14 established and GUARD-10 sharpened:
       what gets defended is the band, and the number here is what somebody last chose.
       Set 2026-08-20 at 62.9% of careers / 11.0 pages, at 240 careers x 8 expeditions, and
       RE-PINNED 2026-08-21 to 68.8% by LANE-4 and to 82.5% by LANE-5 the same day — the feet
       urgency moves this and the campaign band together, so both were re-pinned in the same
       breath with Evan rather than one of them going stale. A player who reads the trail node
       now finishes the story in five careers out of six.
       Re-pinning is allowed and expected — moving the number without saying so is not. */
    /* CARD-20 RE-PINNED AND RE-SAMPLED THIS (2026-08-22), and the lesson cost six measurements.
       At n=240 the CARD-20 tree read 76.3 against the 82.5 pin — 0.2 outside the window — and
       the "damage" was chased through the launch's drafter term (innocent: 76.0 against 77.1
       at n=1440, a draw), the rules term at half size (76.3 — whatever it was, it did not
       scale), a bite-side redesign (78.3, and worth nothing anywhere else), and a carrier buff
       (80.4 at n=240 that melted to 76.5 at n=720 — noise, the handoff's own warning). The
       finding: THE FIXED 240-CAREER SLICE DIVERGES +-6 BETWEEN NEARLY-IDENTICAL ENGINES. Same
       seed, same careers — but an engine change re-deals every climb after its first
       divergence, and at 240 careers that resampling is as wide as the tolerance policing real
       damage: strip-only read 82.5 at 240 and 78.2 at 720, and v10.71 itself reads 77.6 at 720
       against the 82.1 it recorded at 240. The launch's real ending cost is 0.9 against
       v10.71 at n=720 — a draw — so the guard was firing on the slice, not the game.
       The resolution is BOUGHT, which is this guard's own precedent (it moved 60 -> 240 once,
       for exactly this): the sample now reads from band.mjs's ENDING_N (720, ~4 minutes), so
       the ledger and this guard cannot quietly disagree, and the pin is the shipped tree's own
       reading at that sample. TOL 5 is ~2.3 SE of a cross-engine comparison at n=720 — tighter
       as a claim than the old +-6 at 240 ever was — and still catches RUN-14's nine-point
       step with four points to spare. */
    const PIN = 76.7, TOL = 5
    ok(Math.abs(reads.ending - PIN) <= TOL,
      `an informed player's story lands ${reads.ending}% of careers against a pin of ${PIN} — ` +
      `re-measure, pay it back, or re-pin here on purpose`)
    ok(reads.pages > 9.5,
      `an informed player finishes eight expeditions with ${reads.pages} of 14 pages, and the ending needs ten`)
    ok(reads.stranger < 20,
      `${reads.stranger}% of informed wins still top out as a stranger to him`)

    /* AND THE DELTA IS THE TICKET'S ACTUAL CLAIM: that knowing what the trail node is for
       is worth the ending. A band on `reads` alone would still pass if the node became
       free for everybody. */
    const blind = career('', 60)
    ok(reads.ending - blind.ending > 20,
      `knowing what the trail node is for is worth only ${(reads.ending - blind.ending).toFixed(1)} points of the known ending`)
    ok(reads.pages - blind.pages > 3,
      `reading the node is worth only ${(reads.pages - blind.pages).toFixed(1)} pages, so NARR-18 bought nothing`)
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
       gave the back half of act 1 teeth. Back to ~48 at ROUTE-9/ENG-23. Then
       ~46 at v9.62 (RUN-10): the two project nodes in each act used to be the
       SAME boulder, so the second visit rode the first's beta — an accidental
       discount. Distinct projects remove it, so the second project is honestly
       a little harder. All deliberate and dated rather than drift. The band is
       what gets defended; the number in the comment is what somebody last chose.
       v9.74 (CARD-11) added an uncommon rest, Chalk the Hold. Adding any card to
       a rarity pool changes pool.length and reshuffles every offer roll, so the
       n=300 point estimate slid to 45.3 — but the chip effect itself is
       band-neutral (measured identical at chip 0/1/2) and n=600 reads 47.0, so
       the ~46 pin holds; the move is reshuffle, not difficulty.
       v9.87 (ENG-25): the tuning sim had been blind to opposition — `cardValue`
       had no `opposes` term so the drafter never built toward the 14-card
       compression identity, and `autoPlay` filled one hand lane at a time
       against an empty partner, so every opposition card scored at its −2 alone
       value and a pair never formed. This is an on-band change (it moves both
       the deck the sim drafts and the line it plays). Both halves fixed — the
       drafter values a partner, the policy seats the pair — and the band was
       re-verified: n=300 46.7, n=600 46.5, dead on the pin and tighter than the
       44.7/47.2 it replaced. Opposition made visible is a balanced archetype,
       not a hidden lever.
       v9.89 (CARD-15): the pin is DELIBERATELY re-set to ~52 (n=300 48.7,
       n=600 53.0) as a joint balance pass agreed with Evan. The reward pool had
       been a frozen 22-card subset and the old ~46 band was structurally held by
       that thinness — a genuine texture refresh (tough/friction/static + the
       synergy specialists) cannot hold ~46, even a same-size two-card swap read
       53.7, and BAL-13 proved the early bosses cannot open offsetting headroom
       (they are not the completion bottleneck). It is a global lever, so it
       rippled: the ROUTE-8 direct line became a +7.8 free win (the richer pool
       answers its extra cruxes) — retuned to `dClear:0` so it reads −2 vs the
       guide — and the Onsighter sank to 4.8% under its floor — bought back with
       `firstTurnPower 2→3` to 8.8%. Floor raised 40→44 below to defend the new
       pin: a drift back toward the old thin-pool ~44 is now caught, not waved
       through.
       v9.98 (ROUTE-13): 25 routes got their named feature. A signature REPLACES
       an ordinary hold, so mild ones make routes easier — pitched at dGrip 2–3
       they land the band at n=300 52.7 / n=600 53.3, still on the ~52 pin. The
       binding constraint on the way up is no longer this guard but CARD-9's
       ceiling (~1.7 clear); read its comment before lifting the base again.
       v10.10 (ENG-21): the route acts on the climber now — it can reject a card it
       will not hold, deny a shake-out in a lane, and hand you a stance. On-band by
       nature, so it was measured against the SHIPPED build rather than reasoned
       about, and both halves are worth recording.
       (1) The band moved ~0.8 HARDER (n=900 53.7 → 52.9; a paired n=2700 pass read
       55.6 → 54.1). Everything else on the ledger holds — lines, climbers, spread.
       Do not read the n=900 numbers finer than that: the SE on one arm is ~1.7, and
       an earlier tuning pass chased five configs that all sat inside one SE of each
       other and concluded the opposite sign. n=2700 is the smallest sample that
       resolves a 1.5-point question here.
       (2) A retry got more valuable, because a burn is now slightly less reliable:
       CARD-9's lift went 2.4 → 4.0 against its ceiling of 4. Shrinking ENG-21 to 8%
       of the move table only brought it to 3.8 — 0.2 inside a ~2.3 SE, which is a
       guard passing on a coin flip rather than a fix. So the ITEM pays: WIND_PUMP
       0.4 → 0.55, BAL-15's own dial, and the lift is back to 2.0. That is a
       deliberate nerf to the Second Wind in service of the contract CARD-9 states,
       recorded here rather than buried in the constant.
       NOTE for the next person: the move roll's DRAW ORDER (lane, then kind) is
       load-bearing. An earlier cut of ENG-21 rolled the kind first and that
       reshuffle alone moved the CARD-9 wind arm +2.9 and read as this ticket
       breaking the ceiling. A guard pins the order now.
       v10.16 (SIM-6): the RULER changed, not the climb. `autoPlay` chose the feet by
       max Support alone, so it could not see that a foot works its hold — and the feet
       lane works about 38% of every hold worked. Correcting it is worth about +1.9
       points measured (paired n=2700: 51.7 → 53.6 on the first value model), and the
       final model reads n=2700 52.7 — so THE ~52 PIN STILL HOLDS and no re-pin was
       needed. State it precisely, because the ticket as first logged overstated it: the
       LANE is ~38% of the clears, the BLINDNESS was ~1.9 points. Different claims.
       What it did break was the CALIBRATION of two other guards, because they were
       measured through the same weak policy. A competent policy pulls the guide line
       further ahead of the constrained ones, so ROUTE-8 read the traverse at −9.8 and
       the direct at −7.8 against its −8 floor: both retuned (traverse dCrux −2 → −3,
       direct dCrux 4 → 3), because that guard is a statement about the CONTENT and the
       better measurement is the one to believe. And a better policy needs an extra burn
       less, so CARD-9's lift went NEGATIVE at the old handicap; WIND_PUMP came down
       0.45 → 0.22 to keep the wind a leg-up. Two rounds of that were spent because
       refining the policy's value model moved the wind again — if you touch the policy,
       expect to re-read CARD-9.
       v10.12 (ENG-32): Support is EARNED — a foot placed this turn gives the hands
       less than one that has stood a turn. Measured on the ~52 pin: paired n=2700
       53.0 → 51.7, about 1.3 harder, and the pin holds. Getting there took three
       corrections and all three are worth knowing, because each one was a case of a
       global change landing on something's IDENTITY rather than on player choice:
       (1) charged flat it was 2.0 points and broke two other guards; a floor that
       never takes a foot below 1 Support puts the cost on the solid placements only.
       (2) freshness first read `settled`, which is pinned to 0 by the Trad Dad's own
       signature — so that climber paid the cost every turn for ever as a side effect
       of being itself. `set` is a separate field now; planted is not settled.
       (3) charged on turn 1 it taxed every burn's START, which is nothing but opening
       turns in a Second Wind burn — that inverted CARD-9 to a NEGATIVE lift. Exempt on
       the opening turn: there is no previous turn you could have kept your feet from.
       Then the cost still landed hardest on whoever moves their feet most, so the Comp
       Kid (85 turns a run) was bought back with `quickFeet` rather than the 5% floor
       being lowered to meet it — the CARD-15 pattern. And WIND_PUMP went 0.55 → 0.45
       rather than back to 0.4: 0.55 read a lift of −1.3 and 0.4 read 3.8 against a
       ceiling of 4, so both ends are coin flips and the middle is chosen for margin.
       v10.19 (GUARD-8): no band movement, and off-band by construction — it changed the
       suite and not one line of engine content. Recorded only so that a reader walking
       the versions does not go looking for a measurement that was never needed.
       v10.20 (CARD-18): four cards added (244 -> 248) to give skinCost, read, latch and
       restChip a second carrier each. The point estimate slid 52.7 -> 53.4 at n=2700 and
       THE MOVE IS RESHUFFLE, NOT DIFFICULTY — measured rather than asserted, in three
       arms on the same seeds:
         A  244 cards, as shipped at v10.19 ............ 52.7
         B  248 cards, the four keywords STRIPPED ...... 53.6
         C  248 cards, shipped ......................... 53.4
       B is the same four cards at identical stats, rarity and names with only the
       keyword fields removed, so every pool length and every RNG draw matches C. The
       pool change alone is +0.9; the four mechanics are -0.2, which is nothing. The ~52
       pin holds and no re-pin was needed. This is CARD-11's v9.74 finding reproduced,
       and the mechanism is now named: three EVENT outcomes draw a card off
       `BY_RARITY(rarity)`, the WHOLE table rather than REWARDS, so `rng.int(73)` became
       `rng.int(77)` and every run downstream of an event diverges. If you add a card
       and the band moves, run arm B before you believe you changed the difficulty.
       restChip was priced rather than guessed. It had NO term in `cardValue` at all, so
       for eleven versions the drafter scored a chipping rest on its shed alone and Chalk
       the Hold read BELOW the take-it line — ENG-25's blind spot, a third instance. The
       per-card probe (`CARDS_ONLY=... node sim/run.mjs cards`, added this version because
       the unfiltered probe takes over nine minutes and so was never run) reads restChip
       at +3.0pt per point, exactly linear at 1 and 2, against `anchor` at +2.6pt — and
       anchor is already worth 3 here, so restChip is worth 3 a point. `read` deliberately
       got NO term: the policy never consults `readAhead`, so valuing it would make the
       drafter buy something the sim cannot spend, which is ENG-25 run backwards.
       NOTE for the next person, and it is the bigger finding: the harness's own
       `buildBest` values a card at `power * 2 + contact` (bonuses at a flat 7) and is
       blind to shed, Support, fx, anchor, latch, chip, opposition and synergy alike. So
       the measured STARTING deck is stat-greedy while the in-run picks go through the
       engine's real `cardValue`. Every keyword card in the game is therefore outside the
       band's starting deck unless its raw stats carry it there — which is why all four of
       these are off-band by construction, and also why that is a gap rather than a
       feature. Logged as SIM-7.
       v10.22 (SIM-7): the band did not move, and what moved instead was a live bug.
       Going to point the harness at the engine's own `buildLoadout` — the builder behind
       the BUILD ME ONE button — turned up that its deck completes 18.0% (n=2700) against
       the 53.4% the band was pinned at, and against 28.1% for the STARTER DECK it offers
       to replace. Cause: `copyLimit` caps copies of one card, but RARE_SLOTS (1) and
       UNCOMMON_SLOTS (3) cap how many rares and uncommons a whole loadout may hold, and
       `buildLoadout` enforced neither — it fielded TEN rares and four uncommons, a deck
       the card picker would refuse at every step after the first. Obeying the rule takes
       it to 45.1 (n=900) / 44.3 (n=2700), so the fix is worth +26 points to anyone who
       presses that button. Off-band by construction: `buildLoadout` is called from the
       App and from these guards, never from the measured campaign, which still rides
       `buildBest` in run.mjs. `DECK=builder` measures the game's builder on purpose.
       TRIAGE, recorded so nobody re-runs it: the structural caps are NOT the problem —
       MAX_TECH 3->1 read 20.8, MAX_RESTS 3->2 read 17.9, both 20.0, MIN_HANDS 8->9 read
       18.9, bonus saturation from the first card 20.2, all against a baseline of 18.9.
       Adding `power * 3` to the build read 34.1, which is what pointed at the real cause.
       Do not tune the caps; the rule was simply missing.
       TWO THINGS ABOUT INSTRUMENTS, both of which cost me a wrong assertion first.
       (1) A SINGLE-CLIMB SEND RATE CANNOT SEE THIS, AND POINTS THE WRONG WAY. The
       rare-stuffed deck sends 99% of an early boulder against the commons-built deck's
       93% — better — while completing 18.9% of campaigns against 45%. That is exactly
       what RARE_SLOTS was written for ("every route sends at ~100%"): one climb rewards
       raw stats, a campaign is attrition. Both send-rate assertions I first added to the
       DECK-1 guard were therefore vacuous and were removed rather than kept.
       (2) THE PINNED BAND ITSELF IS MEASURED ON AN ILLEGAL DECK, and that decision is
       still open. `buildBest` caps rares and uncommons but not BETA rarity, and
       `copyLimit('beta')` is 3 — so the measured deck carries three `Beta · Going Alone`
       (4/8) and three `Beta · Being Frightened` (3/7), six of fifteen slots, in cards
       `buildable()` refuses outright. Measured, those six are worth +10.5 points: the
       same stat sort restricted to legal cards reads 42.9 (n=2700). So the honest band
       for a legal deck is ~43 stat-sorted or ~44 as the game builds it, against a pin of
       ~52. Re-pointing the harness is therefore a RE-PIN and needs a decision, and it
       will also recalibrate ROUTE-8, CARD-9 and the climber spread the way SIM-6 did.
       v10.27 (SAVE-6): no band movement — save validation and one write cap on the larder,
       neither of which the harness touches (it calls `newRun` and never loads a file).
       v10.26 (SKIRM-8): no band movement, and off-band by construction — the Circuit is not
       measured at all (`sim/run.mjs` does not contain the word, asserted since SKIRM-7).
       Recorded only so the version walk has no gap.
       v10.25 (BAL-16): the climber floor, not the band. The spread guard says no climber
       completes less than 5% and it was passing on a COIN FLIP: the Comp Kid read 5.2% at
       the n=600 that guard runs against a real 5.8%, because the minimum of five estimates
       whose SE is ~0.9 reads about an SE low. And 5.8% clears a floor of 5 by 1.7 SE, which
       no affordable sample turns into a claim (2 SE wants n>1900 on one climber, 3 SE ~3400).
       An unmeasurable property is a different problem from a false one, and the fix was
       neither the floor nor a shrug:
         (1) the guard resolves the floor WHERE IT LIVES — a coarse n=600 pass for the
             spread ratio, then a fine n=2000 pass on the two lowest climbers via a new
             `ARCH_ONLY`, which costs 4,000 runs instead of the 12,500 that fining all five
             would (GUARD-6). And it FAILS LOUDLY when the margin is inside the noise: it
             reports the margin in SEs, so "this guard cannot resolve this" is a failure
             rather than a flake. Cost: ~+4,000 runs on the ledger, stated because GUARD-6
             fought for that budget.
         (2) the Comp Kid was bought back to 6.6% — 3.2 SE clear — on the axis it actually
             died of. Every other dial was the wrong SIZE, measured one at a time at n=2500:
             one skin 4.9% (nothing, and it dies of psyche instead of skin), one betaGrip
             5.8% (nothing at all), one Contact 10.2% and one card of HAND 15.6%. That last
             pair is worth remembering: this climber is card-starved, not strength-starved,
             and a single point of Contact or one card of hand swings it four to ten points.
             So it got a dial of its own, `dPsyche`, and its psyche deaths went 19% -> 1%.
       Verified long-standing rather than recent drift: v10.19, before CARD-18 and before the
       SIM-8 re-pin, reads the same climber at 5.7% (n=1500). `arch` mode measures each
       climber's OWN loadout (`LOADOUT = undefined`), so no re-pin can reach it.
       Roster after, n=1500: Boulderer 8.9 / Comp Kid 6.7 / Trad Dad 6.7 / Alpinist 7.7 /
       Onsighter 7.3 — spread 1.33x against a 2.2x ceiling. The BAND did not move: `arch` is
       a different measurement and the campaign pin stays ~44.3.
       NOTE for whoever reads this next: the whole roster now lives between 6 and 9%, and the
       floor of 5 was set when it spanned 3.3 to 29.8. It is a much tighter fit than it was,
       and the next climber to drift will hit the same unmeasurable margin. That is worth a
       decision about the floor eventually, and it should be a dated one.
       v10.24 (GUARD-9): no band movement, and off-band by construction — it changed nothing
       but the suite. Recorded so a reader walking the versions does not look for a
       measurement that was never needed. It does keep the injections that produced most of
       the numbers in this ledger: `node sim/mutants.mjs`.
       v10.23 (SIM-8): THE PIN IS RE-SET, ~52 -> ~44.3 (n=2700, PAGES=14). Agreed with Evan
       and deliberate in the CARD-15 sense: not a drift accommodated, a wrong reference deck
       replaced. The band now rides `buildLoadout` — the engine's builder, the one behind
       BUILD ME ONE, with the slot rules SIM-7 gave it — so there is ONE builder (ENG-19)
       and the number describes a deck a player can actually arrive at. run.mjs's own stat
       sort is gone. Drift tolerance is +-6 (38-50), about 2 SE at the n=300 that guard runs
       and still tight enough to catch a BAL-14-shaped 10-point slide either way.
       WHAT THE BETTER DECK COST, measured: guide-line band 53.4 -> 44.3. Of that, +10.5 was
       the six illegal beta cards alone (the same stat sort restricted to legal cards reads
       42.9), and the rest is the deck being differently shaped: the game's build carries
       half the raw Power (20 against 40) and wins on consistency instead — two copies each
       of Hand Jam, Fist Jam and Arm Bar, three rests, three techniques.
       ONE GUARD NEEDED RETUNING, and it is the one SIM-6 also had to move. ROUTE-8 says a
       line you pick is a choice and not a trap: no more than 8 points below the guide. At
       n=1500 the guide reads 45.1 and the direct at `dCrux: 3` reads 38.1 — that is -7.0
       against a -8 floor, margin 1.0 on a 1.8-point difference SE, which is a guard passing
       on a coin flip. The direct is now `dCrux: 2` and reads 43.1, so -2.0, five points
       clear of either bound. That RESTORES the intent rather than inventing one: the
       ROUTE-8 note itself says the direct should land "~2 under the guide" and that cruxes
       are "almost free" — both were true of a deck with twice the Power, and its own next
       sentence explains the rest ("a cruxy line that a powerful deck eats and a weak one
       walls on"). The traverse needed nothing: -5.0, inside by 3.0.
       A TRAP AVOIDED, recorded because I walked into it: `dClear: -1` on the direct reads
       +1.2 and looks like a fix. CARD-15 removed exactly that, for exactly this drift — a
       short line skips endurance. Read the note above LINES before touching that field.
       AND A SAMPLE-SIZE LESSON, again. At n=500 the direct at `dCrux: 2` read +1.0 and at
       n=1500 it reads -2.0; the difference SE at 500 is 3.1, so the first number was one SE
       of nothing. ROUTE-8's own arms run at n=500, which resolves its -8 floor and NOT its
       +3 ceiling. Do not tune this guard off a single n=500 pass.
       WHAT DID NOT MOVE: CARD-9's lift reads +1.8 (base 45.1, wind 46.9 at n=900) against
       its 0-4 window, comfortable at both ends. The climber spread is untouched BY
       CONSTRUCTION — `arch` mode sets `LOADOUT = undefined` and measures each climber's own
       loadout, so this re-pin cannot reach it. Its numbers are unchanged and the Comp Kid
       still sits at 5.2% against a floor of 5, which is a pre-existing graze worth somebody
       looking at and is not SIM-8's doing. The acts curve and the journal guard both hold. */
    /* THE PIN IS ~44, RE-SET AT v10.23 (SIM-8), and this is a deliberate dated re-pin in
       the CARD-15 sense rather than a drift being accommodated. The reason is that the old
       ~52 was measured on a deck no player can hold: run.mjs sorted every card by raw stats
       and capped rares and uncommons but not BETA, and `copyLimit('beta')` is 3 — so six of
       the fifteen measured slots were `Beta ·` cards that `buildable()` refuses outright,
       worth a measured +10.5 points. The band now measures the deck the GAME builds
       (`buildLoadout`, the BUILD ME ONE button, with the slot rules SIM-7 gave it), which
       is the only deck a player can actually arrive at. 44.3% at n=2700, PAGES=14.
       Tolerance is +-6 around it: about 2 SE at the n=300 this guard runs, and still tight
       enough to catch a BAL-14-shaped 10-point slide in either direction. */
    /* NARR-22: THE WINDOW IS DERIVED FROM THE PIN NOW, because it had already come apart.
       LANE-2 re-pinned the band ~44 → 45 with Evan and moved `BAND_PIN` in band.mjs; this window
       stayed hard-coded at 38..50, centred on the old number and a version behind. Two guards
       over one quantity, one of them silently stale, is the ENG-26 duplication class — so this
       reads the pin GUARD-10 holds and cannot drift away from it again. Same ±6 width: about
       2 SE at the n=300 this runs, still tight enough for a BAL-14-shaped 10-point slide.
       AND WORTH KNOWING BEFORE YOU TRUST IT: at v10.65 this arm read 50.7 while the hand
       measurement at n=3000 read 45.2 — a 1.9 SE draw on a fixed seed. This is a tripwire.
       GUARD-10's ledger is the instrument. */
    ok(Math.abs(full - BAND_PIN) < 6,
      `the campaign completes ${full}% with a full journal against a pin of ${BAND_PIN} — re-pinned at v10.23 (SIM-8) and again at v10.63 (LANE-2)`)
    /* LANE-3 REMOVED A DUPLICATE FROM HERE, and it is worth saying what it was. This guard also
       asserted `pcts[0] < full - 5` under the message "reading his journal is worth N points" —
       word for word the same claim, and the same message, as the NARR-11 guard four tests up,
       which measures it at n=600 where this reads n=300. Two copies of one claim, one of them at
       half the sample: the ENG-26 class, and the same shape as the band pin sitting stale in two
       places until NARR-22.

       It failed on LANE-3 at 5.0 against a bar of more than 5 — failing by exactly nothing — and
       the resolution is why the copy had to go rather than the bar move. The difference of two
       n=300 arms carries about 4 points of noise, so a bar at 5 cannot see its own margin. Bought
       properly at n=3000, both arms: v10.66 reads 36.8 empty against 45.2 full and v10.67 reads
       37.0 against 45.2, so the journal is worth 8.4 and 8.2 points respectively — a 3.2-point
       margin over the bar, and LANE-3 moves it by 0.2. The n=300 reading was a draw, and the
       NARR-11 guard at n=600 saw the truth and stayed green throughout.

       The claim is not weakened; it is asserted once, by the guard that owns it. This guard is
       about the BAND. */
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
    // GUARD-6: only the full-journal row is read, so measure only that band
    const out = execSync('PAGES=14 SHARP_AT=99 node sim/run.mjs campaign 300', { encoding: 'utf8' })
    const rows = [...out.matchAll(/act1 (\d+)% act2 (\d+)% act3 (\d+)%/g)]
    ok(rows.length >= 1, 'the harness stopped reporting where runs end')
    const [, a1, a2, a3] = rows[rows.length - 1].map(Number)
    /* LANE-4: CONDITIONAL RATES, BECAUSE THE HARNESS REPORTS SHARES OF ALL RUNS AND THAT IS NOT
       WHAT "DEADLIER" MEANS. `diedAct[i]/N` is the share of EVERY run that ended in act i, so a
       later act is measured against a pool the earlier acts have already thinned — act 2 taking a
       quarter of all runs leaves only about 72% alive to reach act 3, and act 3 then cannot post a
       bigger share unless it kills nearly everyone. The comparison was structurally biased against
       the last act.

       It was passing on the draw. LANE-4 read 25% then 21% at n=300 and finally tripped it, but the
       full-journal arm has been marginally inverted on the raw shares for at least three versions:
       v10.67, v10.68 and v10.69 all read act2 25-26% against act3 24-25% at n=3000, and this guard
       went green on each of them because n=300 happened to land the other way. That is the third
       guard this session found passing on a coin flip, after NARR-21's bar and the coarse climber
       pass.

       Conditioned, the claim is true and comfortable: at v10.69, 3.1% of runs die in act 1, 25.8%
       of those who reach act 2 die there, and 33.3% of those who reach act 3 die there. Strictly
       increasing, and it is the number a player would recognise — the chance the act in front of
       you ends the run. */
    const reach = [100, 100 - a1, 100 - a1 - a2]
    ok(reach[2] > 5, `only ${reach[2].toFixed(0)}% of runs reach act 3, so nothing below can be read`)
    const rate = [a1 / reach[0], a2 / reach[1], a3 / reach[2]].map(x => 100 * x)
    const [r1, r2, r3] = rate.map(x => Number(x.toFixed(1)))
    ok(r2 >= r1, `act 2 kills ${r2}% of those who reach it against act 1's ${r1}% — the curve is inverted`)
    ok(r3 >= r2, `act 3 kills ${r3}% of those who reach it against act 2's ${r2}% — the last act is not the hardest`)
    ok(r3 > 15, `act 3 kills only ${r3}% of those who reach it — nothing is at stake at the end`)
  })
  test('SIM-7: the deck the game builds you beats the one it replaces', () => {
    /* THE GUARD THAT WAS MISSING. `buildLoadout` is what BUILD ME ONE calls, and nothing
       had ever measured its deck over a campaign — the two DECK-1 guards check SHAPE, and
       the one send measurement uses a beginner's collection of starters and commons, which
       contains no rares, so the slot bug could not appear in it.
       With a full collection the builder fielded TEN rares against a limit of one and
       completed 18.9% against the starter deck's 28.1% — nine points WORSE than the deck
       it offered to replace. Obeying the slot rules takes it to 45.0%.
       SIM-8: the harness's own stat sort is gone and `campaign` now measures the game's
       builder, so this arm and the pinned band read the same deck. 300 runs an arm: the gap
       is 18 points against a ~3.7-point difference SE, so the margin is not the tight part. */
    const pct = cmd => {
      const out = execSync(cmd, { encoding: 'utf8' })
      const m = [...out.matchAll(/completion\s+([\d.]+)%/g)].map(x => Number(x[1]))
      ok(m.length >= 1, `could not read completion from: ${cmd}`)
      return m[m.length - 1]
    }
    const built = pct('PAGES=14 node sim/run.mjs campaign 300')
    const deflt = pct('PAGES=14 node sim/run.mjs campaign 300 default')
    ok(built > deflt + 8,
      `the deck the game builds completes ${built}% against the starter deck's ${deflt}% — it is offering to make you worse`)
    ok(built > 30, `the built deck completes only ${built}% of campaigns`)
  })
  test('BAL-13: act 1 is frictionless, and no dial fixes that', () => {
    /* BAL-13 says act 1 kills ~3% of runs against act 3's 34%, so the first twenty minutes
       cannot go wrong. Measured properly (v10.33, `node sim/run.mjs acts`), the complaint is
       sharper than the row and different in kind — act 1 is not merely non-lethal, it is
       FRICTIONLESS:

           act 1: skin ever <=3 on  4.3% of runs, psyche ever <=1 on 0.6%, 0.4 camps of 3 taken
           act 2: skin ever <=3 on 30.2% of runs, psyche ever <=1 on 11.3%, 1.4 camps

       You never spend the resources, so no act-1 decision is a decision: camping is not the
       answer to a problem you never have. Psyche — the resource the game is themed on — is
       touched on one run in 160.

       FIVE LEVERS WERE SCREENED against all three bars at once (act-1 pressure, the ~44.3
       band, and the climber spread). Every previous attempt checked only one of the three,
       which is how v9.36 shipped a route-length change that took the spread 1.4x -> 2.9x.

         fewer camps          no effect at all — removing recovery does nothing, because the
         no between-act top-up   cost never accrues in the first place
         flat 1-skin approach act-1 pressure 4.3% -> 28.7%, and the band went UP six points:
                              the greedy policy answers a cost by taking all three act-1 camps
                              (3.0 +/- 0.0 against 0.4) and trading climbs for camps. THE SLACK
                              ABSORBS THE PRESSURE. Add the cost and cut act 1 to two camps and
                              it does bite (53%) — at spread 4.45x with a climber on 4.0%.
         +1 grip in act 1     spread 3.78x, lowest climber 2.3%, and -6 points of band
         one fewer burn       spread 1.78x, lowest climber 2.7% (the control, and it behaved)

       So: THREE INDEPENDENT MECHANISMS — skin, grip, attempts — each put a climber under the
       5% floor the moment act 1 bites. A fourth, weather, is differential BY CONSTRUCTION and
       needs no run to rule out: `archOf(s).ignoreWeather` means one archetype ignores it.

       The reason is structural, and it is the thing to read before trying a sixth: act 1 is
       the only stretch of the game where every climber is at FULL resources. That is exactly
       why it is frictionless, and exactly why pressure there separates the roster hardest —
       the differences compound over nine stages with nothing yet spent to recover from.
       A dial cannot fix this. Changing act 1's SHAPE might; that is a design decision and is
       Evan's, not a tuning pass.

       WHAT THIS GUARD IS FOR: act 1 being soft is now a measured, deliberate property rather
       than an oversight, so it is pinned like the band is. If it drifts — in either direction
       — read the note above before "fixing" it, because five of the obvious fixes are already
       known to fail and the evidence cost about forty thousand simulated runs. */
    const out = execSync('node sim/run.mjs acts 600', { encoding: 'utf8', env: { ...process.env, PAGES: '14' } })
    const rd = re => { const m = re.exec(out); return m ? Number(m[1]) : NaN }
    const a1skin = rd(/act 1: skin ever <=3 on ([\d.]+)%/)
    const a2skin = rd(/act 2: skin ever <=3 on ([\d.]+)%/)
    ok(Number.isFinite(a1skin) && Number.isFinite(a2skin), 'could not read act pressure from the harness')

    // act 1 is soft. Wide, because this is a tripwire and not a measurement.
    ok(a1skin < 15, `act 1 now puts ${a1skin}% of runs under skin pressure — it used to be ~4%. ` +
      'If that was deliberate, check the climber spread: every lever tried in BAL-13 that made ' +
      'act 1 bite dropped a climber under the 5% floor.')
    // ...and act 2 is not, so the contrast this ticket is about still exists
    ok(a2skin > 15, `act 2 only puts ${a2skin}% of runs under skin pressure, so the act-1 contrast has gone`)
    ok(a2skin > a1skin * 2, `act 1 (${a1skin}%) and act 2 (${a2skin}%) are no longer different in kind`)

    // (the diagnostic's own shape is asserted in the core suite, where it costs nothing)
  })
  test('campaign completion stays in a sane band', () => {

    const out = execSync('node sim/run.mjs campaign 150', { encoding: 'utf8' })
    const pcts = [...out.matchAll(/completion\s+([\d.]+)%/g)].map(m => Number(m[1]))
    ok(pcts.length >= 3, 'could not read completion from the harness')
    for (const p of pcts) ok(p > 15 && p < 85, `completion ${p}% is outside 15–85%`)
  })
  test('ROUTE-8: the line you pick is a choice, not a free win', () => {
    /* The direct used to be −2 holds and +3 cruxes and measured the EASIEST of
       the three — a shorter climb banks less pump than extra cruxes ever cost —
       so always taking it beat always-guide by six points of free completion.
       The lines trade texture now, not difficulty: none may beat the guide by
       more than a hair, and none may sink into a trap far below it.
       v9.80 (CARD-12): raised from n=150 to n=500. At 150 the per-line SE is
       ~4 points against a 3-point ceiling, so this passed on luck while the
       traverse was quietly a ~+3.5 free win; at 300 the GUIDE sample still
       swung enough (44.7–47.3 with the new cards' offer reshuffle) to flick a
       benign +1 direct up over the ceiling. At 500 every line settles: guide on
       its ~47 pin, direct +1, traverse −3. The traverse was retuned the same
       version — it had dropped two cruxes for the same height (pure difficulty),
       so it now also runs `dClear +1` (the long way is longer), a real
       endurance-vs-power trade. The band the drift guard pins is the GUIDE line
       (default `line:0`), untouched by any of this. */
    /* RUN-15: THE ARMS ARE n=1500 NOW, AND THE CEILING IS WHY. This guard's own comment has
       said since SIM-8 that n=500 resolves the -8 floor and NOT the +3 ceiling — and at
       v10.73 the ceiling finally fired on exactly that under-resolution: the traverse read
       +4.4 over the guide at n=500 while the n=1500 truth is -0.6 (guide 57.3, traverse 56.7,
       direct 58.2). Route pooling had not moved the crux density the traverse trades against
       (offers read 1.27 / 1.31 / 3.00 cruxes per climb against 1.15 / 1.33 / 3.00 static) —
       the n=500 slice had simply resampled. A guard that fires on a draw gets its resolution
       bought, not its bar widened: 4,500 runs an act instead of 1,500, ~+9 minutes of slow
       suite (GUARD-6 says state the cost), and the difference SE drops ~3.1 to ~1.8, which
       resolves the ceiling the floor never needed help with. */
    const full = line => {
      // GUARD-6: one band, not three — this guard reads only the full journal
      const out = execSync(`PAGES=14 LINE=${line} SHARP_AT=99 node sim/run.mjs campaign 1500`, { encoding: 'utf8' })
      const pcts = [...out.matchAll(/completion\s+([\d.]+)%/g)].map(m => Number(m[1]))
      return pcts[pcts.length - 1]
    }
    const guide = full('off'), direct = full(1), traverse = full(2)
    ok(direct <= guide + 3, `the direct completes ${direct}% against the guide's ${guide}% — a free win`)
    ok(traverse <= guide + 3, `the traverse completes ${traverse}% against the guide's ${guide}% — a free win`)
    ok(direct >= guide - 8 && traverse >= guide - 8,
      `a line is a trap: guide ${guide}, direct ${direct}, traverse ${traverse}`)
  })
  test('CARD-9: a bought-and-spent Second Wind helps, but never buys the campaign', () => {
    /* The carve-out was that this consumable can only be judged by a harness that
       BUYS and SPENDS it — a shop line the drafter ignores tells you nothing.
       GUARD-1 (v10.1) rebuilt HOW it is judged, because the old form was gated
       inside its own noise and could fail for the wrong reason:
         · it asserted `wind < 58`, an ABSOLUTE. But `wind` contains the base
           band, so the guard tripped when the GAME GOT EASIER rather than when
           the ITEM got stronger — two failures that need different fixes, made
           indistinguishable. ROUTE-13 hit exactly that at v9.94. It asserts the
           LIFT now, which is the property the ticket actually states: "an extra
           burn is a leg-up, not a skip."
         · it inferred "the harness is really spending it" from `wind > base + 0.5`
           — a 0.5-pt threshold under a difference of two proportions whose point
           estimate has read 0.5, +6.0, +3.6 and ~1.5 on sample size alone. The
           harness now REPORTS the winds it spends, so that is a deterministic
           integer instead of a signal buried in noise.
         · the sample tripled (300 → 900) at no cost, spending the runs GUARD-6
           freed by dropping the two journal bands nothing here reads.
       Where the threshold comes from: BAL-15 measured the unfixed item at +6.0
       and called that the skip this ceiling exists to forbid; the fixed item
       measures ~2.4 at n=900. A ceiling of 4 sits between the two, so it still
       catches the behaviour it was written for — negative-tested by reverting
       WIND_PUMP, which takes the lift back over it. */
    const arm = env => {
      const out = execSync(`PAGES=14 ${env} SHARP_AT=99 node sim/run.mjs campaign 900`,
        { encoding: 'utf8' })
      const pct = [...out.matchAll(/completion\s+([\d.]+)%/g)].map(m => Number(m[1])).pop()
      const winds = Number(/winds (\d+)/.exec(out)?.[1] ?? -1)
      ok(pct !== undefined && winds >= 0, 'the harness stopped reporting completion or winds')
      return { pct, winds }
    }
    const base = arm(''), wind = arm('KIT_BURN=1')
    /* The pinned band is measured on the DEFAULT arm, and the whole reason it is
       unmoved by kit is that the drafter never touches it. That was a prose claim
       in this ledger for four versions; it is an assertion now. */
    eq(base.winds, 0, 'the default arm spent a Second Wind — the pinned band is not kit-free')
    ok(wind.winds > 100,
      `only ${wind.winds} winds were spent across 900 runs — the buy-and-spend path is not being exercised`)
    const lift = wind.pct - base.pct
    ok(lift > 0,
      `a bought-and-spent Second Wind moved completion ${lift.toFixed(1)} pts — it is not helping at all`)
    ok(lift < 4,
      `a Second Wind is worth ${lift.toFixed(1)} pts of completion (${base.pct}% → ${wind.pct}%) — an extra burn is buying the campaign, not a leg-up`)
  })
  test('SIM-9: the policy can spend a turn on the plan, and the plan pays', () => {
    /* THE POLICY IS THE INSTRUMENT EVERY NUMBER IN THIS FILE IS MEASURED THROUGH, and until
       this ticket it could not spend a turn on anything but the best card for this turn.
       What that cost was measured before anything was designed: 74.6% of failed burns die of
       pump while the 30-turn clock binds on 0.0% of 2,780 — the binding resource spent as if
       it were the free one. The fix is ONE CLAUSE in `autoPlay` (rest a lane nothing in hand
       clears, above SHAKE_AT pump); the sweep and the three smarter rules that measured WORSE
       are on the constant in the engine.

       WHAT THIS GUARD HOLDS. The same four mid-ladder routes on the same seeds, once with the
       shipping policy and once with `REST_AT=99` — the knob run.mjs keeps, which never fires
       the branch and is the pre-SIM-9 policy exactly. Three claims, in the order they fail:
         · the policy actually shakes out — the MECHANISM, GUARD-1's rule, because a lift
           whose mechanism is invisible is measuring something else;
         · the knob still disables it — or the two arms below compare a thing to itself,
           which is the instrument failure CARD-9 spent GUARD-1 escaping;
         · the plan is worth DOUBLE DIGITS of session send rate. Measured 79.9% against 58.8%
           (+21.1); the ticket's probes read +8.2 on V8-V9 and +13.6 on roped lines. The bar
           is 10: room for content drift, while a dead branch reads ~0.

       WHAT THIS GUARD DELIBERATELY DOES NOT HOLD: the campaign band. The built deck's two
       rests are FEET cards (Knee Bar, No-Hands Rest), so a hand rest is in hand on 6 of
       7,610 no-clear lane decisions and the band cannot feel this rule — measured 59.8%
       against 59.9% at paired n=900. The LADDER can feel it (every climber loadout carries
       Shake Out x2); the v10.71 ledger row records what moved, and the fine pass above
       re-measures it. Cost: two arms x 1,200 sessions, ~1 minute (GUARD-6). */
    const arm = env => {
      const out = execSync(`${env} node sim/run.mjs policy 300`, { encoding: 'utf8' })
      const m = /policy: send ([\d.]+)%\s+shakeouts\/session ([\d.]+)/.exec(out)
      ok(m, 'the harness stopped reporting the policy A/B')
      return { send: Number(m[1]), shakes: Number(m[2]) }
    }
    const plan = arm(''), greedy = arm('REST_AT=99')
    /* THE LIFT COMES FIRST, and the order is load-bearing. Injections found that asserting the
       instrument before the claim SHIELDS the claim: any mutation that equalises the two arms
       (a dead branch, a severed knob, an inverted gate that drags REST_AT=99 along with it)
       tripped the shake-out comparison below and the lift assertion had never once failed — the
       LANE-3 shape, one failure guarded twice with one copy in front of the other. So the claim
       is asserted first, where every arms-level failure lands, and the two assertions behind it
       exist to say WHY a lift died: the mechanism went invisible, or the knob stopped severing. */
    const lift = plan.send - greedy.send
    ok(lift > 10,
      `a policy that can shake out sends ${plan.send}% against ${greedy.send}% for one that cannot — `
      + `+${lift.toFixed(1)} points against a measured +21.1; the plan is dead, fires at the wrong time, `
      + 'or the greedy arm is not greedy')
    ok(plan.shakes > 4,
      `the policy reports ${plan.shakes} shake-outs a session against a measured 6.9 — the plan is `
      + 'invisible to the instrument, so the lift above is not known to be the plan paying')
    ok(greedy.shakes < plan.shakes * 0.6,
      `REST_AT=99 still shakes out ${greedy.shakes}/session against the plan's ${plan.shakes} — `
      + 'the knob no longer disables the plan')
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
