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
import { readFileSync, existsSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { unlinkSync } from 'node:fs'

const results = []
let current = ''
const group = n => { current = n }
function test(name, fn) {
  try { fn(); results.push([true, current, name]) }
  catch (e) { results.push([false, current, name, e.message]) }
}
/* GUARD-8: the assertions and the source-window helpers live in sim/guard.mjs, one copy
   shared with test.mjs, because two copies of one rule drift (ENG-19). Read the header
   there for what each of them refuses to do. `guardScan` is asserted at the bottom of
   this file, over this file. */
import { ok, eq, region, declBody, appFn, cssRule, tail, guardScan, stripComments } from './guard.mjs'
/* GUARD-9: the kept injections. The table is data; the guard below checks it has not
   rotted. `node sim/mutants.mjs` is what actually runs them. */
import { MUTANTS, applyPatch, touched } from './mutants.mjs'

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
    /* ENG-20 raised this from 2 to 3, with the measurement: freezing at -3
       Contact reads -9 points for a sturdy deck and +3 for a fragile one, which
       is a trade rather than a runaway. At -4 it was -84, which is why there is
       still a ceiling. */
    ok(Math.abs(w.dContact ?? 0) <= 3, `${w.name} shifts Contact by ${w.dContact}`)
    ok(Math.abs(w.dSupport ?? 0) <= 1, `${w.name} shifts Support by ${w.dSupport}`)
    ok(Math.abs(w.sloperGrip ?? 0) <= 3, `${w.name} moves sloper Grip by ${w.sloperGrip}`)
  }
  for (const r of E.ROCK) ok(!('dPower' in r), `${r.name} touches Power`)
})
test('the conditions are on the paper, and still readable', () => {
  /* VIS-3. ENG-20 measured weather at 46 points of send rate — the largest
     lever in the game — and it read as the word "hot sun". Mocked at 390px and
     measured before shipping: every overlay costs at most one point of the gap
     between ink and paper, against a plain page's 69. */
  const app = readFileSync('src/App.tsx', 'utf8')
  // every weather in the table needs a class, and the class name has to survive
  // the space in "hot sun" — that is what the replace is for
  for (const w of E.WEATHER) {
    const cls = `wx-${w.name.replace(/ /g, '')}`
    ok(app.includes(`.${cls}::before`) || w.name === 'still',
      `${w.name} has no mark on the paper (looked for .${cls})`)
  }
  ok(/wx-\$\{|wx-\$\{WEATHER/.test(app) || app.includes("`wx-${WEATHER[st.weather].name.replace(/ /g, '')}`"),
    'the wrap never gets a weather class')
  // it must only happen while you are out on something — a menu has no weather
  ok(/const onRock = st\.phase === 'climb'/.test(app),
    'the paper shows weather on screens that have none')
  // under the text, never over it, or it fights the thing it is decorating
  ok(/\.wrap\[class\*="wx-"\]::before\{[^}]*z-index:0/.test(app),
    'the weather sits over the text rather than under it')
  ok(/\.wrap\[class\*="wx-"\]>\*\{[^}]*z-index:1/.test(app),
    'the content is not lifted above the weather layer')
  // and colour-blind mode must keep the cue while dropping the hue
  ok(/\.cb\[class\*="wx-"\]::before\{filter:saturate/.test(app),
    'colour-blind mode gets the same hues as everybody else')
})

test('every condition does what it says it does', () => {
  /* ENG-20. The item claimed conditions barely mattered; the measurement said
     46 points of send rate across the six. What was true is that two of them
     lied. Freezing promised no feeling and measured +2 and +9 — a straight
     benefit, because -1 Bite on every hold beats -2 Contact on every card.
     Drizzle said slopers were off and measured +1 and -4, because only 6 of
     231 cards care about slopers. */
  const named = w => E.WEATHER.find(x => x.name === w)
  // a condition whose text promises a cost must carry one
  const freezing = named('freezing')
  ok(freezing.dContact < -2, `freezing costs only ${freezing.dContact} Contact`)
  ok(freezing.dBite < 0, 'freezing does not give the friction it promises')
  // and one that says your feet are going nowhere must reach the feet, because
  // every deck has feet and almost none has slopers
  const drizzle = named('drizzle')
  ok((drizzle.dSupport ?? 0) < 0, 'drizzle does not touch your feet')
  ok((drizzle.sloperGrip ?? 0) > 0, 'drizzle does not touch slopers either')
  // every condition must do something, or it is a line of flavour text
  for (const w of E.WEATHER) {
    if (w.name === 'still') continue          // the zero point, by design
    const does = (w.dBite ?? 0) || (w.dContact ?? 0) || (w.sloperGrip ?? 0) || (w.dSupport ?? 0)
    ok(does, `${w.name} changes nothing at all`)
    ok(w.text.length > 15, `${w.name} does not explain itself`)
  }
  // and a rock type must actually favour something
  for (const r of E.ROCK) {
    const does = Object.keys(r.boost).length || Object.keys(r.grip).length || Object.keys(r.bite).length
    ok(does, `${r.name} is the same as every other rock`)
  }
})

test('a run remembers where it has been', () => {
  /* UX-16. A run is nine stages and the map showed one, so after twenty
     minutes there was no way to see the shape of the trip you had had. */
  const at = over => E.trailNote({ ...E.freshRun(6, 0, 1), inRun: true, skirmish: null, ...over })
  const spec = E.ROUTES[6]
  eq(at({ result: 'send', burn: 1 }), `flashed ${spec.name}`, 'a flash is not remembered as one')
  eq(at({ result: 'send', burn: 3 }), `sent ${spec.name}`, 'a send on the third burn reads wrong')
  eq(at({ result: 'fall', burn: 2 }), `off ${spec.name}`, 'coming off reads wrong')
  eq(at({ phase: 'camp' }), 'camped', 'a camp is not remembered')
  eq(at({ phase: 'shop' }), 'the post', 'a post is not remembered')
  // an event is remembered by name, not as "an event"
  const ev = E.EVENTS[0]
  eq(at({ eventId: ev.id }), ev.title.toLowerCase(), 'an event is not remembered by name')
  // every note must be short enough for a phone and worth reading
  for (const note of [at({ result: 'send', burn: 1 }), at({ phase: 'camp' }), at({ eventId: ev.id })]) {
    ok(note.length > 4, 'a stage left an empty note')
    ok(note.length < 42, `"${note}" is too long for the list`)
  }
  // and a note is appended, never replaced
  const one = E.noteTrail({ ...E.freshRun(0, 0, 1), trail: ['camped'] }, 'the post')
  eq(one.trail.join('|'), 'camped|the post', 'the trail lost a step')
  const two = E.noteTrail(one, 'flashed something')
  eq(two.trail.length, 3, 'the trail stopped growing')
  eq(two.trail[0], 'camped', 'the trail forgot where it started')
})
test('a stage cannot advance without leaving a mark', () => {
  // four places move the run on a stage, and every one of them must record it
  const src = readFileSync('src/engine.ts', 'utf8')
  const advances = [...src.matchAll(/tier: s\.tier \+ 1/g)]
  ok(advances.length >= 4, `only ${advances.length} places advance a stage`)
  for (const m of advances) {
    // guard-8: allow — a proximity check, not a guard window. The requirement over it is
    // POSITIVE, so a window too small fails loudly instead of passing on nothing.
    const around = src.slice(Math.max(0, m.index - 260), m.index + 260) // guard-8: allow
    ok(/noteTrail/.test(around),
      `a stage advance at line ${src.slice(0, m.index).split('\n').length} records nothing`)
  }
})

group('the screens where a run ends')
test('every screen appears in the suites', () => {
  /* The check that found TEST-4 in the first place, kept so the next screen
     added cannot arrive uncovered. Naming a phase is a low bar — but the four
     that were missing were missing entirely, and three of them wrote to the
     save. */
  const app = readFileSync('src/App.tsx', 'utf8')
  const mine = readFileSync('sim/test-core.mjs', 'utf8') + readFileSync('sim/test.mjs', 'utf8')
  const screens = [...new Set([...app.matchAll(/phase === '(\w+)'/g)].map(m => m[1]))]
  ok(screens.length > 20, `only found ${screens.length} screens`)
  const missing = screens.filter(p => !mine.includes(p))
  eq(missing.length, 0, `no test mentions: ${missing.join(', ')}`)
})
test('an injury is a consequence and never a strategy', () => {
  /* INJ-1. The design values are explicit: skin, injury and psyche model care,
     risk and consequence — "not grind-through-pain optimization", and "nothing
     valorizes training through injury". So the things this test checks are the
     values, not the mechanics. A tweak must pay nothing, must not be removable
     by anything you can buy or do, and must never be worth having. */
  const t = { kind: 'pulley', hold: 'crimp', runs: 2, text: 'x' }
  const src = readFileSync('src/engine.ts', 'utf8')
  // it costs, on one hold, and nowhere else
  eq(E.tweakGrip({ tweak: t }, 'crimp'), E.TWEAK_GRIP, 'a tweak costs nothing on its own hold')
  eq(E.tweakGrip({ tweak: t }, 'jug'), 0, 'a tweak costs you on a hold it has nothing to do with')
  eq(E.tweakGrip({ tweak: null }, 'crimp'), 0, 'you are paying for a tweak you do not have')
  // it pays NOTHING. No xp, no cash, no card, no draw — that is the whole design
  // comments stripped first: the block SAYS "no cash, no gear", and a test that
  // reads prose instead of code will fail on its own documentation
  /* GUARD-3: anchor both ends. If either type is renamed the slice is '' and the
     six negative assertions below all pass on nothing — "an injury must never pay
     you anything" would be unenforced while reading green. GUARD-8 made that the
     helper's job rather than each guard's. */
  const tweakBlock = region(src, 'export type Tweak', ['export type CurseCause'],
    { min: 200, what: 'the Tweak block' })
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  for (const pay of ['xp', 'cash', 'dDraw', 'powerAll', 'dPower', 'reward'])
    ok(!new RegExp(`\\b${pay}\\b`).test(tweakBlock),
      `the tweak system mentions ${pay} — an injury must never pay you anything`)
  // only a trip passing moves it, and nothing else in the game touches it
  const after1 = E.tweakAfterRun({ tweak: t })
  eq(after1.tweak.runs, 1, 'a trip did not bring it closer to gone')
  eq(E.tweakAfterRun(after1).tweak, null, 'it never goes away')
  eq(E.tweakAfterRun({ tweak: null }).tweak, null, 'not having one broke something')
  const app = readFileSync('src/App.tsx', 'utf8')
  ok(!/tweak: null/.test(app.replace(/tweak: s\.tweak/g, '')),
    'the screen can clear a tweak, which makes it a thing to manage')
  // you only get one for climbing a trip down to nothing — never for sending
  const rng = new E.RNG(4)
  eq(E.tweakEarned({ ...E.freshRun(0, 0, 1), skin: 3 }, rng), null,
    'walking off with skin left earned you an injury')
  ok(E.tweakEarned({ ...E.freshRun(0, 0, 1), skin: 0 }, rng),
    'climbing a whole trip down to nothing left no mark')
  // and they never stack, so there is no spiral to fall into
  eq(E.tweakEarned({ ...E.freshRun(0, 0, 1), skin: 0, tweak: t }, rng), null,
    'injuries stack, which is a spiral rather than a consequence')
  // every one must name a real hold type and say what it is in plain words
  for (const w of E.TWEAKS) {
    ok(E.HOLD_STATS[w.hold], `${w.kind} is about ${w.hold}, which is not a hold`)
    ok(w.text.length > 30, `${w.kind} does not explain itself`)
    ok(!/\btrain|\bpush through|\btough it out/i.test(w.text),
      `${w.kind} reads like advice to climb through it`)
  }
  ok(E.TWEAK_RUNS >= 2 && E.TWEAK_RUNS <= 4, `a tweak lasting ${E.TWEAK_RUNS} trips`)
})

test('a curse is the price of something you did', () => {
  /* CARD-6. Ten curses and only two ever arrived — Cold Shut and Sandbagged
     Beta, from three events of which two give the same one, plus the Sandbagged
     mutator and TAKE TWO. Eight were unreachable. These come from decisions the
     game already watches you make.

     And the line that matters: this is NOT a reward for climbing hurt. Per the
     design values, climbing on wrecked skin is a bad decision the game permits
     and never rewards — a curse is the consequence arriving. */
  const base = { ...E.freshRun(6, 0, 1), inRun: true, skirmish: null,
    runDeck: E.DEFAULT_LOADOUT.map(E.spawn) }
  const clear = E.specOf(base).clear
  // topping out never costs you anything, however wrecked you are
  eq(E.curseEarned({ ...base, result: 'send', skin: 1 }), null,
    'topping out on raw skin earned you a curse')
  // coming off on nothing, and coming off with the top in reach, both do
  eq(E.curseEarned({ ...base, result: 'fall', skin: 1 }), 'rawskin',
    'going again on gone tips costs nothing')
  eq(E.curseEarned({ ...base, result: 'fall', skin: 7, cleared: clear }), 'exposed',
    'coming off with the top in reach costs nothing')
  eq(E.curseEarned({ ...base, result: 'fall', skin: 7, cleared: 1 }), null,
    'coming off the second hold left a mark')
  // one of each a run — the same mistake twice is the same lesson
  const once = E.addCurse(base, 'rawskin')
  eq(once.runDeck.filter(c => c.name === 'Flapper').length, 1, 'the curse did not land')
  eq(E.addCurse(once, 'rawskin').runDeck.filter(c => c.name === 'Flapper').length, 1,
    'the same curse landed twice in one run')
  // spraying your own grades catches up at the claim; grading fairly does not
  ok(E.claimCurse({ ...base, established: [{ claimed: 9, real: 6 }, { claimed: 8, real: 5 }] })
    .runDeck.some(c => c.name === 'Ego'), 'spraying your grades costs nothing')
  ok(!E.claimCurse({ ...base, established: [{ claimed: 5, real: 5 }] })
    .runDeck.some(c => c.name === 'Ego'), 'grading honestly earned you Ego')
  // every curse it can hand out has to exist and be a curse
  for (const [cause, c] of Object.entries(E.EARNED_CURSES)) {
    ok(E.CARDS[c.card], `${cause} hands out ${c.card}, which is not a card`)
    eq(E.CARDS[c.card].rarity, 'curse', `${cause} hands out ${c.card}, which is not a curse`)
    ok(c.why.length > 20, `${cause} does not say why`)
  }
})
test('CARD-8: bargain is the events curse, not one earned from the fall', () => {
  /* The bargain entry sits in EARNED_CURSES for reference, but curseEarned
     reads how a burn ended and must never hand it out — Sandbagged Beta is a
     choice you make in an event, applied through the `curse` outcome. If a
     future edit wires bargain into curseEarned, it would double up with the
     events, so this pins it shut. */
  const base = { ...E.freshRun(6, 0, 1), inRun: true, skirmish: null,
    runDeck: E.DEFAULT_LOADOUT.map(E.spawn) }
  const clear = E.specOf(base).clear
  for (const st of [
    { ...base, result: 'fall', skin: 0 },
    { ...base, result: 'fall', skin: 7, cleared: clear },
    { ...base, result: 'fall', skin: 7, cleared: 1 },
    { ...base, result: 'send', skin: 1 },
  ]) ok(E.curseEarned(st) !== 'bargain', 'curseEarned handed out the bargain curse from the fall')
  // and the bargain card must stay reachable — an event has to offer it
  const card = E.EARNED_CURSES.bargain.card
  ok(E.EVENTS.some(e => e.choices.some(ch => ch.outcome.curse === card)),
    `${card} is not reachable from any event`)
})
test('ENG-22: Cycle draws as the turn resolves, and says so', () => {
  /* The card and the glossary both used to say "when you place it", but the
     draw fires in resolve, once per turn the move is on the board — the exact
     doc/behaviour drift SIM-5 exists to catch, here in prose. */
  ok(!/place it/i.test(E.CARDS['Read And React'].text),
    'the Cycle card still says it draws "when you place it"')
  const kw = E.KEYWORDS.find(k => k.name === 'Cycle')
  ok(kw && !/place it/i.test(kw.text), 'the Cycle glossary still says "when you place it"')
  ok(kw && /resolve|holds on|each turn/i.test(kw.text),
    'the Cycle glossary does not say when it actually draws')
})

test('walking away from the circuit banks what you did', () => {
  /* TEST-4. Four screens appeared in neither suite — circuitNext, prepare,
     sessionEnd, stats — and three of them are where a run ENDS, which is where
     state is written to the save. The circuit's exit was doing its own
     Math.max on your best score inline in the screen, which is the same shape
     as the bug in NARR-4 that was silently emptying saves. */
  const mid = { ...E.freshRun(0, 0, 1), circuit: true, circuitScore: 7, bestCircuit: 4,
    skirmish: E.circuitRoute(3, new E.RNG(1)), runDeck: E.DEFAULT_LOADOUT.map(E.spawn),
    level: 9, owned: ['Gaston'], seen: ['marge1'], ticked: ['act0'], hints: false }
  const out = E.walkAwayStep(mid)
  eq(out.bestCircuit, 7, 'walking away did not bank a new best')
  // RUN-13: the good circuit outcome is recorded, not just the ones you lose
  eq(out.history.length, mid.history.length + 1, 'walking off wrote no history record')
  ok(out.history[0].won && out.history[0].circuit, 'the walk-off was not recorded as a won circuit')
  ok(/walked off · 7 lines/.test(out.history[0].cause), `wrong walk-off cause: ${out.history[0].cause}`)
  eq(out.circuit, false, 'you are still on the circuit after walking away')
  eq(out.skirmish, null, 'the route came with you')
  eq(out.runDeck.length, 0, 'the deck came with you')
  /* SKIRM-8: this pinned `phase: 'menu'`, which is exactly what the ticket found wrong —
     the one GOOD outcome this mode has went straight to the guidebook with no screen while
     every fall got a full account. It ends on `sessionEnd` now, marked `walked` so that
     screen can tell a circuit walk-off from a bailed skirmish without reading a score that
     outlives its run. The guard keeps asserting the exit, it just asserts the right one. */
  eq(out.phase, 'sessionEnd', 'walking away no longer ends on a screen of its own')
  eq(out.result, 'walked', 'the walk-off is not marked, so its screen cannot tell what it was')
  ok(out.circuitScore > 0, 'the score did not survive to be shown')
  // a worse run must not overwrite a better best
  eq(E.walkAwayStep({ ...mid, circuitScore: 2, bestCircuit: 9 }).bestCircuit, 9,
    'a worse circuit overwrote your best')
  // and nothing of yours may be lost on the way out
  for (const k of ['level', 'owned', 'seen', 'ticked', 'hints'])
    eq(JSON.stringify(out[k]), JSON.stringify(mid[k]), `walking away lost ${k}`)
})
test('SKIRM-6: a deep Circuit zone offers a boon, not just a card', () => {
  // a send that crosses FROM `score` INTO line score+1
  const send = score => E.endSession({ ...E.freshRun(0, 0, 1), circuit: true, circuitScore: score,
    bestCircuit: 20, skirmish: E.circuitRoute(score, new E.RNG(1)), result: 'send', inRun: false,
    runDeck: E.DEFAULT_LOADOUT.map(E.spawn) }, new E.RNG(1))
  // crossing into The Business (line 10) and Into the Dark (line 14) offers a boon,
  // with the next line already queued behind it
  for (const enter of [9, 13]) {
    const out = send(enter)
    eq(out.phase, 'gear', `entering line ${enter + 1} did not offer a boon`)
    ok(out.gearOffers.some(id => E.isBoon(id)), `line ${enter + 1}'s offer holds no rule-breaker`)
    ok(out.skirmish, 'the next line was not queued behind the offer')
  }
  // below the deep zones — including the enduro deed at line 8 — none is offered,
  // so the mode's one pinned checkpoint is untouched
  for (const enter of [5, 7]) ok(send(enter).phase !== 'gear', `line ${enter + 1} offered a boon too shallow`)
  // taking the boon adds it and hands straight back to the next line
  const offered = send(9)
  const boon = offered.gearOffers.find(id => E.isBoon(id))
  const after = E.pickGearStep(offered, boon)
  eq(after.phase, 'circuitNext', 'the circuit boon pick did not return to the next line')
  ok(after.boons.includes(boon), 'the boon was not taken')
  ok(after.skirmish, 'the next line vanished after the pick')
})
test('the end of a session writes what it should and nothing else', () => {
  const rng = new E.RNG(11)
  const lived = { ...E.freshRun(6, 0, 5), inRun: false, skirmish: E.dailyRoute(),
    daily: true, result: 'send', cleared: 9, turn: 18, peakPump: 6,
    worked: ['crimp', 'jug'], beta: ['sloper'], burn: 1,
    runDeck: E.DEFAULT_LOADOUT.map(E.spawn), skin: 6,
    level: 9, owned: ['Gaston'], seen: ['marge1'], book: {}, ticked: [],
    established: [], history: [], dailyDay: '', dailyBest: 0, dailyStreak: 0 }
  const out = E.endSession(lived, rng)
  // what it must write
  ok(out.beta.includes('crimp'), 'the holds you worked were not banked as beta')
  eq(out.dailyDay, E.dayKey(), "today's attempt was not filed")
  ok(out.dailyScore > 0, "today's attempt scored nothing")
  eq(out.daily, false, 'the attempt is still open after the session ended')
  // what it must not touch
  for (const k of ['level', 'owned', 'seen', 'ticked', 'established'])
    eq(JSON.stringify(out[k]), JSON.stringify(lived[k]), `ending a session lost ${k}`)
  // and a session that is not a daily must not write a daily score
  const plain = E.endSession({ ...lived, daily: false }, rng)
  eq(plain.dailyDay, '', 'a plain session filed itself as today\'s problem')
})
test('the numbers screen survives a save with nothing in it', () => {
  // a stats page on a fresh file is the classic divide-by-zero, and it reads
  // straight out of book/owned/history, all of which start empty
  const fresh = E.freshRun(0, 0, 1)
  const inAct = E.ROUTES.filter((_, i) => E.ACT_OF_ROUTE[i] !== undefined)
  const ticked = inAct.filter(r => fresh.book[r.name])
  eq(ticked.length, 0, 'a fresh save already has ticks in the book')
  // the reduce that finds your hardest send starts at -1 and must survive empty
  const hardest = ticked.reduce((a, r) => Math.max(a, r.grade), -1)
  eq(hardest, -1, 'the hardest send on an empty book is not -1')
  ok(Number.isFinite(hardest), 'the hardest send is not a number')
  for (const r of ['starter', 'common', 'uncommon', 'rare']) {
    const pool = E.BY_RARITY(r)
    ok(pool.length > 0, `${r} has no cards, so the collection line divides by zero`)
    eq(pool.filter(n => fresh.owned.includes(n)).length, 0, `a fresh save owns ${r} cards`)
  }
  eq(fresh.history.length, 0, 'a fresh save has run history')
  eq(fresh.runs, 0, 'a fresh save has runs on it')
})
test('what you choose before a run is inside the bounds', () => {
  // prepare walks arch, style and mutators. Every one is an index into a table.
  for (const step of [-1, 0, 1]) {
    const arch = Math.max(0, Math.min(E.ARCHETYPES.length - 1, 0 + step))
    ok(E.ARCHETYPES[arch], `arch ${arch} is not a climber`)
    const style = Math.max(0, Math.min(E.ASCENT.length - 1, 0 + step))
    ok(E.ASCENT[style], `style ${style} is not an ascent style`)
  }
  // an unlocked style must never exceed what exists, or prepare offers nothing
  ok(E.ASCENT.length > 1, 'there is only one ascent style')
  // and every mutator id in a chosen set must be real, since xpMult reads them
  for (const m of E.MUTATORS) ok(E.mutById(m.id), `${m.id} is not a mutator`)
  eq(E.xpMult([]), 1, 'no mutators does not mean no multiplier')
  ok(E.xpMult(E.MUTATORS.map(m => m.id)) > 1, 'every mutator at once pays nothing')
  // a set containing something that does not exist must not blow up
  ok(Number.isFinite(E.xpMult(['not-a-mutator'])), 'an unknown mutator breaks the multiplier')
})

test('RUN-11: Sustained changes the texture — the hand carries, and it is smaller', () => {
  // every other mutator is a one-directional harder slider; this one changes
  // how a climb plays. It must be a real, reachable mutator that flips `retain`.
  const sus = E.MUTATORS.find(m => m.id === 'sustained')
  ok(sus, 'the Sustained mutator is gone')
  ok(E.mutMods(['sustained']).retain, 'Sustained does not set retain')
  ok(!E.mutMods([]).retain, 'retain is on with no mutator')
  // it pays XP like every other opt-in hardship, and is not free
  ok(sus.xp > 0, 'Sustained pays no XP')
  const burn = muts => {
    const rng = new E.RNG(9)
    /* The route is incidental here — this tests the Sustained HAND, not a climb.
       ROUTE-13 gave the old fixture route (idx 6, Deer Tick) a signature hard
       enough to end the burn in one turn; the finale (idx 29) stays
       signature-less by design and reliably leaves an unplayed card mid-climb. */
    let b = E.startBurn({ ...E.freshRun(29, 0, 5), inRun: true, skirmish: null,
      weather: 1, rock: 0, mutators: muts, runDeck: E.DEFAULT_LOADOUT.map(E.spawn) }, rng)
    const open = b.piles.hand.length
    const before = new Set(b.piles.hand.map(c => c.uid))
    b = E.autoPlay(b, rng); b = E.resolve(b, rng)
    const carried = b.phase === 'climb' ? b.piles.hand.filter(c => before.has(c.uid)).length : 0
    return { open, carried, phase: b.phase }
  }
  const control = burn([]), sustained = burn(['sustained'])
  // the working hand is smaller by exactly the cut
  eq(sustained.open, control.open - E.SUSTAINED_CUT, 'Sustained did not shrink the opening hand')
  // the default hand dumps each turn (a fresh five); Sustained carries the
  // unplayed cards, so at least one survives the turn it was drawn
  eq(control.carried, 0, 'the default hand did not dump between turns')
  ok(sustained.phase === 'climb' && sustained.carried > 0,
    'Sustained did not carry an unplayed card between turns')
})

test('a trading post is worth the stop', () => {
  /* BAL-5. A post was offered in 4 of 25 stages, so picking at random you saw
     1.00 posts against 2.67 camps — and the harness skipped even those, which
     turned out to be CORRECT: forcing the visits cost eight points of
     completion, because a post used to cost you the stage and a stage of
     climbing is worth more than anything on the shelf. A post is in town, on
     the drive. It does not cost you a day on the rock. */
  const odds = type => E.ACTS.reduce((a, tiers) =>
    a + tiers.reduce((b, t) => b + (t.some(n => n.type === type) ? 1 / t.length : 0), 0), 0)
  const posts = odds('shop'), camps = odds('camp')
  ok(posts > camps * 0.7,
    `a post is ${posts.toFixed(2)} a campaign against ${camps.toFixed(2)} camps — still nearly unreachable`)
  // leaving must not advance the stage
  const at = { ...E.freshRun(0, 0, 1), inRun: true, act: 1, tier: 3, shoppedAt: [],
    shopCards: [], shopGear: [] }
  const out = E.leaveShopStep(at)
  eq(out.tier, at.tier, 'a post still costs you the stage')
  eq(out.phase, 'map', 'leaving a post does not put you back on the map')
  // but you cannot go round twice at the same stage
  ok(E.postOpen(at), 'the post starts shut')
  ok(!E.postOpen(out), 'the post is still open after you have been round it')
  // and it opens again at the next stage, and in the next act
  ok(E.postOpen({ ...out, tier: at.tier + 1 }), 'the post never opens again this act')
  ok(E.postOpen({ ...out, act: 2 }), 'the post never opens again in the next range')
  // the key must not collide across acts — act 1 stage 3 is not act 2 stage 3
  const a1 = E.leaveShopStep({ ...at, act: 0, tier: 3 })
  ok(E.postOpen({ ...a1, act: 1, tier: 3 }), 'shopping in act 1 shut the post in act 2')
})

test('the act map fits on the page', () => {
  /* RUN-8. The campaign map was a vertical list of buttons. It is a drawn page
     now, which means geometry — and geometry goes quietly out of bounds. */
  for (const act of [0, 1, 2]) {
    const total = E.ACTS[act].length
    for (const seed of [1, 999, 2 ** 30]) {
      const pts = E.mapPoints(total, seed)
      eq(pts.length, total, `act ${act + 1} drew ${pts.length} of ${total} stages`)
      for (const [x, y] of pts) {
        ok(x >= E.MAP_PAD && x <= E.MAP_W - E.MAP_PAD, `a stage sits at x=${x.toFixed(0)}, off the page`)
        ok(y >= 0 && y <= E.MAP_H, `a stage sits at y=${y.toFixed(0)}, off the page`)
        ok(Number.isFinite(x) && Number.isFinite(y), 'a stage has no position at all')
      }
      // the stages must climb: later ones sit higher up the page
      for (let i = 1; i < pts.length; i++)
        ok(pts[i][1] < pts[i - 1][1], `stage ${i + 1} is not above stage ${i}`)
      // and two stages must never land on top of each other
      for (let i = 1; i < pts.length; i++)
        ok(Math.abs(pts[i][1] - pts[i - 1][1]) > 6,
          `stages ${i} and ${i + 1} are ${Math.abs(pts[i][1] - pts[i - 1][1]).toFixed(1)}px apart`)
    }
  }
  /* VIS-4: the path must MEANDER, not oscillate. The first version swung it by
     0.28 of the width on a sine of the stage index — at nine stages that is a
     ±99px zigzag, which reads as a scribble rather than a line up a hill. */
  for (const act of [0, 1, 2]) {
    const pts = E.mapPoints(E.ACTS[act].length, 7)
    const xs = pts.map(p => p[0])
    const swing = Math.max(...xs) - Math.min(...xs)
    ok(swing < E.MAP_W * 0.45, `the path swings ${swing.toFixed(0)}px of ${E.MAP_W} — a scribble`)
    // it may not switch direction on every single stage
    let turns = 0
    for (let i = 2; i < xs.length; i++)
      if (Math.sign(xs[i] - xs[i - 1]) !== Math.sign(xs[i - 1] - xs[i - 2])) turns++
    ok(turns <= Math.ceil(xs.length / 3), `the path changes direction ${turns} times in ${xs.length} stages`)
  }
  // the ground and the wall must be drawable and stay on the page
  for (const act of [0, 1, 2]) {
    const cs = E.mapContours(act, 5)
    ok(cs.length >= 4, `act ${act + 1} has ${cs.length} contours`)
    for (const c of cs) {
      ok(c.d.startsWith('M') && c.d.length > 40, 'a contour is not a path')
      ok(!/NaN/.test(c.d), 'a contour has a NaN in it')
    }
    const cliff = E.mapCliff(5)
    ok(cliff.d.startsWith('M') && !/NaN/.test(cliff.d), 'the wall is not a path')
    ok(cliff.ticks.length >= 8, `the wall has ${cliff.ticks.length} hachures`)
    for (const [x, y] of cliff.ticks) {
      ok(x >= 0 && x <= E.MAP_W, `a hachure at x=${x.toFixed(0)} is off the page`)
      ok(y - 7 >= 0, 'a hachure points off the top of the page')
    }
  }
  eq(E.ACT_TERRAIN.length, 3, 'the acts are not all named on the map')

  // and it must not fall over on the degenerate cases
  eq(E.mapPoints(1, 5).length, 1, 'a one-stage act draws nothing')
  eq(E.mapPoints(0, 5).length, 1, 'a zero-stage act crashes rather than drawing one point')
  // the same seed must draw the same map, or it redraws itself every render
  eq(JSON.stringify(E.mapPoints(9, 42)), JSON.stringify(E.mapPoints(9, 42)),
    'the map moves between renders')
})

test('RUN-14: the map is a property of the run, and one function says so', () => {
  /* RUN-14. The row said "act maps branch, but the branches rarely differ in kind", and that is
     wrong twice: they differ in kind at 18 of the 26 stages, and at the 4 climb-only stages the
     routes differ in grade, style, clear count and how hard the feet are. What is true is worse
     and simpler — `ACTS` is a static table, so the map was BYTE-IDENTICAL in every run anybody
     ever played. The conditions at each node were already per-run; the shape was not. */
  const CAN = ['climb', 'project', 'boss']
  const run = (seed, act) => ({ ...E.freshRun(0, 0, seed), runSeed: seed, inRun: true, act })

  /* NOTHING THAT MATTERS MOVES, and this comes first because it is the half that two measured
     versions of this ticket got wrong. Both of the versions this ticket measured and threw away
     broke one of these: dropping a node cost 3.1 points of completion, and swapping a CLIMB for
     a camp cost 5.1, because sends are what grow a deck. */
  for (let a = 0; a < E.ACTS.length; a++) for (let t = 0; t < E.ACTS[a].length; t++) {
    const all = E.ACTS[a][t]
    for (let r = 1; r <= 40; r++) {
      const at = E.tierNodes(run(r, a), t)
      eq(at.length, all.length, `act ${a + 1} stage ${t + 1} changed width on seed ${r}`)
      eq(at.filter(n => CAN.includes(n.type)).length, all.filter(n => CAN.includes(n.type)).length,
        `act ${a + 1} stage ${t + 1} changed how much you can climb on seed ${r}`)
      eq(at.some(n => n.type === 'boss'), all.some(n => n.type === 'boss'),
        `act ${a + 1} stage ${t + 1} gained or lost its boss on seed ${r}`)
      for (const k of E.MAP_SWAP_IN) ok(at.filter(n => n.type === k).length <= 1,
        `act ${a + 1} stage ${t + 1} offers two ${k} nodes on seed ${r}`)
      ok(at.every(n => n.routeIdx >= 0 || !CAN.includes(n.type)),
        `act ${a + 1} stage ${t + 1} invented a climb with no route on seed ${r}`)
    }
  }

  /* IT VARIES. Counted rather than asserted loosely: 16 of the 26 stages produce more than one
     shape across seeds. The 10 that do not are all explained — 4 boss stages hold one node, 4
     are two-node climb pairs at the floor with no support node to vary, and 2 already offer all
     of camp, event and shop, so there is nothing new they could be given. */
  let vary = 0
  for (let a = 0; a < E.ACTS.length; a++) for (let t = 0; t < E.ACTS[a].length; t++) {
    const seen = new Set()
    for (let r = 1; r <= 60; r++) seen.add(E.tierNodes(run(r, a), t).map(n => n.type).sort().join('+'))
    if (seen.size > 1) vary++
  }
  ok(vary >= 12, `only ${vary} of 26 stages differ between runs — the map is a corridor again`)

  /* DERIVED FROM `runSeed`, NOT THE LIVE SEED. `s.seed` advances as you play, so keying off it
     would re-draw a stage under the player between two looks at the same map screen. */
  const a1 = E.tierNodes({ ...run(7, 1), seed: 999 }, 2).map(n => n.type).join(',')
  const a2 = E.tierNodes({ ...run(7, 1), seed: 4242 }, 2).map(n => n.type).join(',')
  eq(a1, a2, 'the stage changed when the live seed advanced — the map is being re-drawn under the player')
  eq(E.tierNodes(run(7, 1), 2).join(), E.tierNodes(run(7, 1), 2).join(), 'the same run gives two different maps')
  const other = E.tierNodes(run(8, 1), 2).map(n => n.type).sort().join(',')
  ok(other !== a1.split(',').sort().join(',') || vary > 0, 'this fixture proves nothing')

  /* THE ONE THAT WOULD HAVE BECOME A LIE. The map screen prints "No camp between here and the
     boss" off `campBeforeBoss`, so it has to read the run's own stages. Checked against the
     stages this run actually has, which is the only thing that makes the sentence true. */
  for (let r = 1; r <= 30; r++) for (let a = 0; a < E.ACTS.length; a++) {
    for (let t = 0; t < E.ACTS[a].length - 1; t++) {
      const s = { ...run(r, a), tier: t }
      let expected = false
      for (let k = t + 1; k < E.ACTS[a].length; k++) {
        const at = E.tierNodes(s, k)
        if (at.some(n => n.type === 'boss')) break
        if (at.some(n => n.type === 'camp')) { expected = true; break }
      }
      eq(E.campBeforeBoss(s), expected,
        `act ${a + 1} stage ${t + 1} seed ${r}: the camp warning does not match this run's stages`)
    }
  }

  /* ONE FUNCTION, and this half is what stops the screen and the engine disagreeing. The map
     screen already carries a note that the forecast and every handler address a tier BY INDEX,
     so a second reading of "which nodes are here" shifts every one of them — ENG-26 arriving by
     the front door. Comments stripped: the notes below quote `ACTS[s.act]` while explaining why
     nothing should read it. */
  const eng = stripComments(readFileSync('src/engine.ts', 'utf8'))
  const fc = region(eng, 'export function forecastFor', ['export function forecastScore'],
    { min: 200, what: 'forecastFor' })
  ok(/tierNodes\(s\)/.test(fc), 'the forecast is built off the static table, so it labels the wrong nodes')
  for (const [fn, end] of [['export function tierAhead', 'export function aheadSummary'],
                           ['export function campBeforeBoss', '\nexport ']]) {
    const body = region(eng, fn, [end], { min: 80, what: fn })
    ok(/tierNodes\(/.test(body), `${fn} reads the static table, so it can disagree with the map screen`)
  }
  const app = stripComments(readFileSync('src/App.tsx', 'utf8'))
  ok(!/ACTS\[st\.act\]\[st\.tier\]/.test(app),
    'the map screen reads the static tier again, so what it offers can differ from the forecast beside it')
  /* and the harness plays the map the game deals — it read the static table, which would have
     measured this ticket as band-neutral while the shipping game played something else (SIM-1). */
  const sim = stripComments(readFileSync('sim/run.mjs', 'utf8'))
  ok(/E\.tierNodes\(s\)/.test(sim), 'the harness is back on the static map, so the band no longer measures the real one')
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
      /* the last stage of a range has no tier after it and must say so */
      if (t + 1 >= E.ACTS[a].length) eq(E.tierAhead(s).length, 0, 'a stage past the end of the act')
      /* RUN-14 made a stage's contents a property of the run, so what is read ahead is
         `tierNodes` of the next stage rather than the static row. Asserted against
         `tierNodes` — the same function the map screen and the forecast use — so this still
         fails if the read-ahead ever points at a different stage, which is what it is for. */
      else eq(E.tierAhead(s).length, E.tierNodes(s, t + 1).length, 'the wrong stage was read ahead')
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

test('every climber has a signature that pays over a burn', () => {
  /* BAL-12. Three of the four compounded — beta coming back cheaper, Contact
     on every move, settling further. The Comp Kid's fired once on turn one,
     worth about half a hold on a twelve-hold route, and it measured bottom of
     the four at 8.2% against 12.4%. A signature that fires once is a footnote. */
  for (const a of E.ARCHETYPES) {
    // over a burn, not once. betaGrip/dPower/dContact/settleMax all compound;
    // so do noBeta (every hold stays a guess) and ignoreWeather (conditions
    // nulled the whole climb). firstTurnPower alone would NOT count — it fires
    // once, which is the footnote this guard was written to reject.
    const compounds = (a.betaGrip ?? 0) !== 0 || (a.dPower ?? 0) !== 0
      || (a.dContact ?? 0) !== 0 || a.settleMax !== undefined
      || a.noBeta === true || a.ignoreWeather === true
    ok(compounds, `${a.name}'s signature does not do anything over a burn`)
    ok(a.sigText.length > 25, `${a.name}'s signature does not explain itself`)
    // the starting climber is the baseline the others are measured against, so
    // it is the one that does not trade anything away
    const costs = (a.dContact ?? 0) < 0 || (a.dAttempts ?? 0) < 0
      || (a.dSkin ?? 0) < 0 || a.settleMax === 0 || a.noBeta === true
      || (a.dHand ?? 0) < 0
    if (a.unlock > 1) ok(costs, `${a.name} pays nothing for its signature`)
  }
  // and each starting deck must be one you can actually climb with — the Comp
  // Kid was shipping with ONE rest card and 70-turn runs
  for (const a of E.ARCHETYPES) {
    const sp = a.loadout.map(E.spawn)
    eq(sp.length, E.DECK_SIZE, `${a.name} starts with ${sp.length} cards`)
    ok(sp.filter(c => c.shed > 0).length >= E.WANT_RESTS,
      `${a.name} cannot shed pump: ${sp.filter(c => c.shed > 0).length} rest cards`)
    ok(sp.filter(c => c.lane === 'feet').length >= 2, `${a.name} has nothing for the feet lane`)
    ok(sp.filter(c => c.lane === 'hand' || c.lane === 'any').length >= 6,
      `${a.name} has too little for two hand lanes`)
  }
})

test('no act is the thin one', () => {
  /* NARR-10. Act 2 had 8 climbs against 11 and 12, and act 3 had 4
     conversations against 7 and 6 — the middle of the story with the least in
     it, and the end of it with the fewest people. Counted off the act maps
     rather than the table, because the three desert lines are appended at the
     END of ROUTES: inserting them into the act 2 block would have shifted every
     index in acts 2 and 3. */
  const climbs = a => {
    const idx = new Set()
    for (const t of E.ACTS[a]) for (const n of t)
      if ((n.type === 'climb' || n.type === 'boss' || n.type === 'project') && n.routeIdx >= 0)
        idx.add(n.routeIdx)
    return idx.size
  }
  const counts = E.ACTS.map((_, a) => climbs(a))
  const talks = E.ACTS.map((_, a) => E.TALKS.filter(t => t.act === a).length)
  const lo = Math.min(...counts), hi = Math.max(...counts)
  ok(hi - lo <= 2, `climbs per act: ${counts.join(' / ')} — one act is much thinner`)
  const tlo = Math.min(...talks), thi = Math.max(...talks)
  ok(thi - tlo <= 2, `conversations per act: ${talks.join(' / ')} — one act is much quieter`)
  for (const n of counts) ok(n >= 8, `an act with only ${n} climbs in it`)
  for (const n of talks) ok(n >= 5, `an act with only ${n} conversations in it`)
  /* And the thing the v3.2 warning is actually about: appending is safe only
     because nothing finds the tutorial or the finale by position. */
  const app = readFileSync('src/App.tsx', 'utf8') + readFileSync('src/engine.ts', 'utf8')
  ok(!/ROUTES\[30\]|ROUTES\[29\]/.test(app), 'something addresses a route by a hardcoded index')
  ok(E.ROUTES.findIndex(r => r.tutorial) >= 0, 'the tutorial cannot be found by its flag')
  ok(E.ROUTES.findIndex(r => r.finale) >= 0, 'the finale cannot be found by its flag')
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
test('the journal is big enough for the decision it makes', () => {
  /* NARR-11. Seven pages, and NARR-8 made them pick which of three endings you
     get — so never knowing and knowing were four pieces of paper apart. */
  ok(E.JOURNAL.length >= 14, `${E.JOURNAL.length} pages for a three-way ending`)
  eq(E.FINDABLE, E.JOURNAL.length - 1, 'the page you find at the top is findable on the way up')
  // every findable page must be a beta card, and every beta card must exist
  for (const j of E.JOURNAL) {
    if (j.id === 7) { ok(!E.BETA_CARDS[j.id], 'the page from the top is a beta card'); continue }
    const name = E.BETA_CARDS[j.id]
    ok(name, `page ${j.id} (${j.title}) gives you nothing on the wall`)
    ok(E.CARDS[name], `${name} is named as beta and is not a card`)
    eq(E.CARDS[name].rarity, 'beta', `${name} is not a beta card`)
  }
  // every page has to be in his voice and worth reading
  for (const j of E.JOURNAL) {
    ok(j.text.length > 120, `page ${j.id} (${j.title}) is too short to be an entry`)
    ok(j.title.length > 3, `page ${j.id} has no title`)
  }
  const ids = E.JOURNAL.map(j => j.id)
  eq(new Set(ids).size, ids.length, 'two pages share an id')
  // the pool hands out the next one he wrote and never repeats
  const seen = []
  let st = { ...E.freshRun(0, 0, 1), journal: [] }
  for (let i = 0; i < E.FINDABLE; i++) {
    const next = E.nextPage(st)
    ok(next !== null, `ran out of pages after ${i}`)
    ok(!seen.includes(next), `page ${next} handed out twice`)
    seen.push(next); st = { ...st, journal: [...st.journal, next] }
  }
  eq(E.nextPage(st), null, 'the pool still had a page after every one was found')
  ok(!seen.includes(7), 'the page from the top was handed out on the way up')
})
test('you cannot carry the whole journal up the wall', () => {
  /* Measured: seven pages was worth twelve points of completion and fourteen
     was worth the same, because every beta card past the ones you need is a
     card you draw instead of a move. Capped, and the curve is monotonic again
     at 29.2 / 40.4 / 42.8%. */
  const all = E.JOURNAL.filter(j => j.id !== 7).map(j => j.id)
  eq(E.betaDeck(all).length, E.BETA_TAKE, `carrying every page gives ${E.betaDeck(all).length} cards`)
  ok(E.BETA_TAKE < E.FINDABLE, 'the cap is not a cap')
  ok(E.BETA_TAKE >= 6, 'the cap is below what the original six pages gave')
  // fewer pages than the cap gives you exactly what you have
  eq(E.betaDeck(all.slice(0, 3)).length, 3, 'three pages did not give three cards')
  eq(E.betaDeck([]).length, 0, 'no pages gave you cards')
  // and an unknown page id must not produce a card
  eq(E.betaDeck([999]).length, 0, 'a page that does not exist gave you beta')
})

test('the top of the wall depends on what you know when you get there', () => {
  /* NARR-8. There was one epilogue and it told you he had done it and told
     nobody — whether you had read seven of his pages or none. That is the one
     thing NARR-7 built the pages for. */
  const at = n => ({ ...E.freshRun(0, 0, 1), journal: Array.from({ length: n }, (_, i) => i), established: [] })
  eq(E.endingFor(at(0)), 'stranger', 'arriving with nothing still explains everything')
  eq(E.endingFor(at(E.JOURNAL.length)), 'known', 'arriving with every page explains nothing')
  // and it must only ever get better as you read more
  const rank = { stranger: 0, partial: 1, known: 2 }
  let last = -1
  for (let n = 0; n <= E.JOURNAL.length; n++) {
    const r = rank[E.endingFor(at(n))]
    ok(r >= last, `reading page ${n} made you understand less`)
    last = r
  }
  ok(E.KNOWN_AT <= E.JOURNAL.length, 'the best ending needs more pages than the game contains')
  // the ending id has to carry both halves, because the run-end screen reads both
  for (const kind of ['told', 'kept']) {
    const out = E.endingStep({ ...at(E.JOURNAL.length), history: [], runs: 1 }, kind)
    ok(out.ending.startsWith('known'), `the ending forgot what you knew: ${out.ending}`)
    ok(out.ending.endsWith(kind), `the ending forgot what you did: ${out.ending}`)
  }
})
test('the game has been counting how you grade your own lines', () => {
  const own = list => ({ ...E.freshRun(0, 0, 1), established: list })
  eq(E.honestyOf(own([])), 'none', 'somebody with no lines of their own has a reputation')
  eq(E.honestyOf(own([{ claimed: 5, real: 5 }, { claimed: 7, real: 7 }])), 'fair', 'honest grading read as something else')
  eq(E.honestyOf(own([{ claimed: 4, real: 6 }, { claimed: 5, real: 7 }])), 'sandbagged', 'grading low did not read as sandbagging')
  eq(E.honestyOf(own([{ claimed: 8, real: 6 }, { claimed: 9, real: 7 }])), 'sprayed', 'grading high did not read as spraying')
  // one point either way is within the noise of an honest opinion
  eq(E.honestyOf(own([{ claimed: 6, real: 5 }])), 'fair', 'being one grade out makes you a liar')
})

test("today's problem is the same problem for everybody", () => {
  /* SKIRM-2. Every design note since v0 justified the seeded RNG as "what
     makes daily-seeded skirmish possible later". This is the collection, and
     the only thing that actually matters is that two people on the same date
     are on the same rock. */
  for (const day of ['2026-07-29', '2026-12-25', '2027-01-01']) {
    eq(JSON.stringify(E.dailyRoute(day)), JSON.stringify(E.dailyRoute(day)),
      `${day} gave two different problems`)
    eq(E.dailySeed(day), E.dailySeed(day), 'the same date gave two different seeds')
  }
  // and different days must differ
  const seen = new Set()
  for (let i = 0; i < 60; i++) {
    const d = new Date(Date.UTC(2026, 0, 1 + i))
    seen.add(E.dailySeed(E.dayKey(d)))
  }
  eq(seen.size, 60, 'two days in a row shared a seed')
  // the rock itself, not just the spec
  const rock = () => {
    const rng = new E.RNG(E.dailySeed('2026-07-29'))
    const s = E.startBurn({ ...E.freshRun(0, 0, 1), skirmish: E.dailyRoute('2026-07-29'),
      inRun: false, runDeck: E.DEFAULT_LOADOUT.map(E.spawn), skin: 9,
      weather: rng.int(4), rock: rng.int(4) }, rng)
    return s.holdDeck.map(h => [h.name, h.grip, h.wobble ?? 0])
  }
  eq(JSON.stringify(rock()), JSON.stringify(rock()), 'the same day built two different routes')
  // a problem must be a real one
  for (let i = 0; i < 40; i++) {
    const r = E.dailyRoute(E.dayKey(new Date(Date.UTC(2026, 5, 1 + i))))
    ok(r.clear >= 8 && r.clear < E.TURN_CAP - 6, `a daily with ${r.clear} holds`)
    ok(r.grade >= 3 && r.grade <= 8, `a daily graded V${r.grade}`)
    ok(r.name.length > 3 && r.note.length > 10, 'a daily with no name or no note')
  }
})
test('a daily attempt is banked once and only once', () => {
  const base = { ...E.freshRun(0, 0, 1), daily: true, result: 'send', cleared: 10,
    turn: 20, peakPump: 5, skirmish: E.dailyRoute(), dailyDay: '', dailyBest: 0, dailyStreak: 0 }
  const first = E.bankDaily(base)
  ok(first.dailyScore > 0, 'topping out today scored nothing')
  eq(first.dailyDay, E.dayKey(), 'the attempt was not filed under today')
  eq(first.daily, false, 'the attempt is still open after being banked')
  eq(first.dailyStreak, 1, 'a first day is not a streak of one')
  // banking again must change nothing — you had your go
  eq(JSON.stringify(E.bankDaily(first)), JSON.stringify(first), 'a second bank moved the score')
  // yesterday's attempt continues a streak; an older one does not
  const y = new Date(); y.setUTCDate(y.getUTCDate() - 1)
  eq(E.bankDaily({ ...base, dailyDay: E.dayKey(y), dailyStreak: 4 }).dailyStreak, 5,
    'playing two days running did not continue the streak')
  eq(E.bankDaily({ ...base, dailyDay: '2020-01-01', dailyStreak: 9 }).dailyStreak, 1,
    'a streak survived a gap of years')
  // and falling still scores what you climbed
  ok(E.bankDaily({ ...base, result: 'fall', cleared: 6 }).dailyScore > 0,
    'coming off scored nothing at all')
  ok(E.bankDaily({ ...base, result: 'fall', cleared: 6 }).dailyScore < first.dailyScore,
    'coming off scored the same as topping out')
})
test('the daily surfaces its conditions and stacks a weekly ladder (SKIRM-3)', () => {
  // conditions of the day: deterministic, and the reading is the conditions
  // the daily actually rolls (same seed, same first two draws as startDaily)
  const key = '2026-07-29'
  eq(JSON.stringify(E.dailyForecast(key)), JSON.stringify(E.dailyForecast(key)),
    'the same day gave two different forecasts')
  const r = new E.RNG(E.dailySeed(key))
  eq(JSON.stringify(E.dailyForecast(key)),
    JSON.stringify({ weather: r.int(E.WEATHER.length), rock: r.int(E.ROCK.length) }),
    'the forecast is not the conditions the daily actually climbs in')
  // the week id is stable within a week and moves across one
  const d0 = new Date(Date.UTC(2026, 6, 20))
  eq(E.weekKey(d0), E.weekKey(new Date(Date.UTC(2026, 6, 20))), 'the same day gave two week ids')
  ok(E.weekKey(d0) !== E.weekKey(new Date(Date.UTC(2026, 6, 27))), 'seven days on is still the same week')
  // the ladder adds today onto this week, resets on a new week, banks once
  const base = { ...E.freshRun(0, 0, 1), daily: true, result: 'send', cleared: 10,
    turn: 20, peakPump: 5, skirmish: E.dailyRoute(), dailyDay: '', dailyBest: 0, dailyStreak: 0,
    weekId: '', weekScore: 0, weekBest: 0 }
  /* v10.8 (DAILY-2): this used to recompute `dailyScore(base)` and expect the week
     to equal 500 + that. `bankDaily` now adds the day's objective bonus on top of
     the raw climb, so the recomputed number is no longer what was banked. Asserting
     against the banked `dailyScore` is the stronger form of the same property — the
     week stacks exactly what the day scored, whatever the day scored. */
  const sameWeek = E.bankDaily({ ...base, weekId: E.weekKey(), weekScore: 500 })
  ok(sameWeek.dailyScore > 0, 'the day banked nothing to stack')
  eq(sameWeek.weekScore, 500 + sameWeek.dailyScore, "the daily did not stack onto this week's ladder")
  eq(sameWeek.weekBest, 500 + sameWeek.dailyScore, 'the weekly best did not follow the running total')
  const newWeek = E.bankDaily({ ...base, weekId: 'w0', weekScore: 999 })
  eq(newWeek.weekScore, newWeek.dailyScore, 'a new week did not reset the ladder')
  eq(JSON.stringify(E.bankDaily(sameWeek)), JSON.stringify(sameWeek),
    'a second bank moved the weekly ladder')
  // and it survives a save
  E.saveGame({ ...base, slot: 1, weekId: 'w123', weekScore: 700, weekBest: 900 })
  eq(E.loadGame(1).weekScore, 700, 'the weekly ladder did not survive a save')
})
test('four weeks make a season that finishes, and tomorrow is on the board (DAILY-3)', () => {
  /* DAILY-3. The weekly ladder reset into a void: every seven days the number went
     to zero, nothing accumulated past a week, and nothing was ever FINISHED. A
     season is four weeks with a board and a title at the end. The two things worth
     guarding are the boundary arithmetic (a season must be exactly four weeks, and
     the day must land in the right column) and the close — the title is paid off
     the total the season ENDED on, not the one starting. */
  const d = k => new Date(`${k}T00:00:00Z`)
  const plus = (dt, n) => { const t = new Date(dt); t.setUTCDate(t.getUTCDate() + n); return t }
  /* Seasons are aligned to the epoch, not to any date a test happens to pick — the
     first version of this guard assumed 2026-01-05 started one and failed for its own
     reason rather than the code's. So the boundary is DERIVED: step back to the first
     day of whatever season contains that date, then walk it. */
  eq(E.SEASON_WEEKS, 4, 'a season is no longer four weeks')
  const span = 7 * E.SEASON_WEEKS
  const s0 = new Date(Math.floor(d('2026-01-05').getTime() / 86400000 / span) * span * 86400000)
  eq(E.seasonWeekOf(s0), 0, 'the derived season start is not the start of a season')
  eq(E.seasonKey(s0), E.seasonKey(plus(s0, 6)), 'day 1 and day 7 fell in different seasons')
  eq(E.seasonKey(s0), E.seasonKey(plus(s0, span - 1)), 'a season ended before its last day')
  ok(E.seasonKey(s0) !== E.seasonKey(plus(s0, span)), 'a season ran past its last day')
  ok(E.seasonKey(s0) !== E.seasonKey(plus(s0, -1)), 'a season started before its first day')
  // the column walks 0,1,2,3 and wraps with the season
  eq(E.seasonWeekOf(s0), E.seasonWeekOf(plus(s0, 6)), 'one week spanned two columns')
  const cols = [0, 7, 14, 21].map(n => E.seasonWeekOf(plus(s0, n)))
  eq(cols.join(','), '0,1,2,3', `the four weeks of a season are not columns 0-3: ${cols}`)
  eq(E.seasonWeekOf(plus(s0, span)), 0, 'a new season did not start a new board')
  // and the whole season is covered — no day falls outside it or outside a column
  for (let i = 0; i < span; i++) {
    const t = plus(s0, i)
    const c = E.seasonWeekOf(t)
    eq(c, Math.floor(i / 7), `day ${i} of a season sits in column ${c}`)
    eq(E.seasonKey(t), E.seasonKey(s0), `day ${i} of a season fell out of it`)
    eq(E.weekKey(t), E.weekKey(plus(s0, Math.floor(i / 7) * 7)),
      `day ${i} does not sit in the week its column claims`)
  }

  // the title ladder rises, and every rung says something
  const ats = E.SEASON_TITLES.map(t => t.at)
  eq(JSON.stringify(ats), JSON.stringify([...ats].sort((a, b) => a - b)), 'the season ladder is out of order')
  eq(new Set(E.SEASON_TITLES.map(t => t.title)).size, E.SEASON_TITLES.length, 'two season rungs share a title')
  for (const t of E.SEASON_TITLES) ok(t.text.length > 10 && t.title.length > 2, `${t.title} is not a rung`)
  // seasonTitle pays the HIGHEST rung reached, not the first one passed
  eq(E.seasonTitle(0), null, 'a season worth nothing paid a title')
  eq(E.seasonTitle(ats[0] - 1), null, 'a season under the first rung paid a title')
  eq(E.seasonTitle(ats[0]).title, E.SEASON_TITLES[0].title, 'the first rung did not pay on the nose')
  eq(E.seasonTitle(ats[ats.length - 1] * 10).title, E.SEASON_TITLES[E.SEASON_TITLES.length - 1].title,
    'a huge season paid a lesser title than a smaller one')
  for (const t of E.SEASON_TITLES) eq(E.seasonTitle(t.at).title, t.title, `${t.at} did not pay ${t.title}`)
  eq(E.nextSeasonTitle(0).at, ats[0], 'the next rung from nothing is not the first one')
  eq(E.nextSeasonTitle(ats[0]).at, ats[1], 'the next rung after the first is not the second')
  eq(E.nextSeasonTitle(ats[ats.length - 1]), null, 'there is a rung past the top of the season')
  ok(E.nextSeasonTitle(ats[0] - 100).away === 100, 'the distance to the next season rung is wrong')

  // banking accumulates the season and fills this week's column
  const base = { ...E.freshRun(0, 0, 1), daily: true, result: 'send', cleared: 10,
    turn: 20, peakPump: 5, skirmish: E.dailyRoute(), dailyDay: '', dailyBest: 0,
    dailyStreak: 0, rests: 0, cruxFree: 1, dailyMet: [],
    seasonId: '', seasonScore: 0, seasonBest: 0, seasonDays: 0, seasonWeeks: [] }
  const sk = E.seasonKey()
  const col = E.seasonWeekOf()
  const first = E.bankDaily(base)
  eq(first.seasonId, sk, 'the day was not filed under this season')
  eq(first.seasonScore, first.dailyScore, 'the season did not start on what the day scored')
  eq(first.seasonDays, 1, 'a first day is not one day of a season')
  eq(first.seasonWeeks.length, E.SEASON_WEEKS, 'the board is not four weeks wide')
  eq(first.seasonWeeks[col], first.dailyScore, "the day did not land in this week's column")
  eq(first.seasonWeeks.reduce((a, b) => a + b, 0), first.seasonScore,
    'the board does not add up to the season')
  // a second day in the same season stacks onto both
  const second = E.bankDaily({ ...base, seasonId: sk, seasonScore: 900, seasonDays: 3,
    seasonWeeks: Array.from({ length: E.SEASON_WEEKS }, (_, i) => (i === col ? 900 : 0)) })
  eq(second.seasonScore, 900 + second.dailyScore, 'the season did not stack the day')
  eq(second.seasonDays, 4, 'the day was not counted onto the season')
  eq(second.seasonWeeks[col], 900 + second.dailyScore, 'the column did not stack the day')
  eq(second.seasonBest, 900 + second.dailyScore, 'the season best did not follow the running total')

  // A NEW SEASON CLOSES THE OLD ONE: the title is paid off the total it ENDED on
  const rung = E.SEASON_TITLES[1]
  const rolled = E.bankDaily({ ...base, seasonId: 's-old', seasonScore: rung.at, seasonDays: 20,
    seasonWeeks: [rung.at, 0, 0, 0] })
  ok(rolled.titles.includes(rung.title), `a season worth ${rung.at} did not pay ${rung.title}`)
  eq(rolled.seasonId, sk, 'the new season did not start')
  eq(rolled.seasonScore, rolled.dailyScore, "the new season inherited the old one's total")
  eq(rolled.seasonDays, 1, "the new season inherited the old one's days")
  eq(rolled.seasonWeeks.filter(n => n > 0).length, 1, 'the new season inherited the old board')
  // the title is the OLD total's, never the new day's
  eq(E.seasonTitle(rolled.dailyScore), null, 'this fixture cannot tell the two totals apart')
  // a season under the first rung closes with nothing, and closing is idempotent
  const poor = E.bankDaily({ ...base, seasonId: 's-old', seasonScore: 10, seasonDays: 1,
    seasonWeeks: [10, 0, 0, 0] })
  eq(poor.titles.length, 0, 'a season worth nothing paid a title anyway')
  // there was no previous season to close on a very first day
  eq(first.titles.length, 0, 'the first day of the first season closed a season that never was')
  // and a season title never doubles up
  const twice = E.bankDaily({ ...base, seasonId: 's-old', seasonScore: rung.at,
    seasonWeeks: [rung.at, 0, 0, 0], titles: [rung.title] })
  eq(twice.titles.filter(t => t === rung.title).length, 1, 'the season title was handed out twice')
  // a streak rung and a season close can land on the same day; both must survive
  const y = new Date(); y.setUTCDate(y.getUTCDate() - 1)
  const both = E.bankDaily({ ...base, seasonId: 's-old', seasonScore: rung.at,
    seasonWeeks: [rung.at, 0, 0, 0], dailyDay: E.dayKey(y), dailyStreak: 13 })
  ok(both.titles.includes(rung.title), 'the streak title displaced the season title')
  ok(both.titles.includes('Regular'), 'the season title displaced the streak title')
  // banking twice pays once, seasons included
  eq(JSON.stringify(E.bankDaily(first)), JSON.stringify(first), 'a second bank moved the season')

  // TOMORROW is the day after today, and it is a real problem you can read
  eq(E.tomorrowKey(d('2026-03-31')), '2026-04-01', 'tomorrow did not cross a month')
  eq(E.tomorrowKey(d('2026-12-31')), '2027-01-01', 'tomorrow did not cross a year')
  eq(E.tomorrowKey(d('2028-02-28')), '2028-02-29', 'tomorrow did not know it was a leap year')
  const tk = E.tomorrowKey()
  ok(tk !== E.dayKey(), 'tomorrow is today')
  const tr = E.dailyRoute(tk), tf = E.dailyForecast(tk)
  ok(tr.name.length > 2 && tr.clear > 0 && tr.grade > 0, 'tomorrow has no problem on it')
  ok(tf.weather >= 0 && tf.weather < E.WEATHER.length, 'tomorrow has no weather')
  ok(tf.rock >= 0 && tf.rock < E.ROCK.length, 'tomorrow has no rock')
  eq(JSON.stringify(E.dailyRoute(tk)), JSON.stringify(tr), 'tomorrow read differently twice')
  // the tease shows conditions, and deliberately does NOT spoil the objectives
  const app = readFileSync('src/App.tsx', 'utf8')
  const tease = region(app, 'DAILY-3: what is coming', ['<div className="tilerow">'],
    { min: 200, what: "tomorrow's tease" })
  ok(/dailyForecast\(tk\)/.test(tease), 'the tease does not show the conditions')
  ok(!/dailyGoals\(tk\)/.test(tease), "the tease gives away tomorrow's objectives")

  // the season survives a save, board and all
  E.saveGame({ ...base, slot: 1, seasonId: 's99', seasonScore: 4321, seasonBest: 9999,
    seasonDays: 12, seasonWeeks: [1000, 2000, 1321, 0] })
  const back = E.loadGame(1)
  eq(back.seasonId, 's99', 'the season did not survive a save')
  eq(back.seasonScore, 4321, 'the season total did not survive a save')
  eq(back.seasonBest, 9999, 'the best season did not survive a save')
  eq(back.seasonDays, 12, 'the days climbed did not survive a save')
  eq(back.seasonWeeks.join(','), '1000,2000,1321,0', 'the board did not survive a save')
  // OFF-BAND: a season pays a cosmetic title and a number no run can spend
  const eng = readFileSync('src/engine.ts', 'utf8')
  ok(!/(cash|skin|psyche|pump|grip)[^\n]*\bseasonScore\b/.test(eng),
    'a run resource is now computed from the season total')
  const sim = readFileSync('sim/run.mjs', 'utf8')
  ok(!/season/i.test(sim), 'the balance harness now knows about seasons')
})
test('the daily asks for two objectives, off its own seed (DAILY-2)', () => {
  /* DAILY-2. The daily was a score and nothing else, so the optimal line was the
     optimal line every day forever. Two objectives give the shared problem a shape.
     On the seed, stated correctly after a negative test proved the first version of
     this comment wrong: reusing `dailySeed(key)` here could NOT change the route,
     because `dailyRoute` and `dailyForecast` each construct their own RNG and share
     no mutable stream. What it would do is CORRELATE the goals with the route — the
     grade and the objectives locked to one number, so every V4 day asks the same two
     things. So this guard checks two separate properties: the day's problem is
     snapshotted (a daily that changes what it was is a compatibility break), and the
     goal pick is pinned to a derived key so the correlation cannot come back. */
  const key = '2026-07-29'
  const eng0 = readFileSync('src/engine.ts', 'utf8')
  /* The route and the conditions for a fixed day, snapshotted at v10.8 BEFORE the
     goals existed. Anything that touches the daily's RNG stream shows up here as a
     changed problem — which for a daily is a compatibility break, not a tuning
     change: everyone who has played 2026-07-29 climbed this. */
  const spec = E.dailyRoute(key)
  eq(JSON.stringify(spec),
    '{"name":"Quiet Crack","grade":4,"style":"crimp ladder","clear":12,"crux":2,"feet":"hard","note":"Today only. Everybody is on this one."}',
    "the goal seed moved today's problem")
  eq(JSON.stringify(E.dailyForecast(key)), '{"weather":1,"rock":3}',
    'the goal seed moved the shared forecast')
  // and the forecast is still the first two draws of the route's own stream (SKIRM-3)
  const q = new E.RNG(E.dailySeed(key))
  eq(JSON.stringify(E.dailyForecast(key)),
    JSON.stringify({ weather: q.int(E.WEATHER.length), rock: q.int(E.ROCK.length) }),
    'the forecast is no longer the conditions the daily climbs in')
  /* the goal pick is pinned to a DERIVED key at the call site. Asserting
     `dailySeed(key+'#goals') !== dailySeed(key)` would only test the hash function —
     it stays green when `dailyGoals` is edited to reuse the route seed, which is the
     bug. So the derivation is asserted where it is written. */
  const pick = region(eng0, 'export function dailyGoals', ['export function goalsMet'],
    { min: 100, what: 'dailyGoals' })
  ok(/dailySeed\(`\$\{key\}#goals`\)/.test(pick), 'the goals are picked off the route seed, not a derived one')
  // and the correlation that would cause: the goals must not track the grade
  const byGrade = new Map()
  for (let d = 1; d <= 28; d++) {
    const k = `2026-10-${String(d).padStart(2, '0')}`
    const g = E.dailyGoals(k).map(x => x.id).sort().join('+')
    const gr = E.dailyRoute(k).grade
    if (!byGrade.has(gr)) byGrade.set(gr, new Set())
    byGrade.get(gr).add(g)
  }
  ok([...byGrade.values()].some(v => v.size > 1),
    'every route grade always asks for the same objectives — the goals track the route')

  // two goals, deterministic, distinct, and drawn from the real table
  const gs = E.dailyGoals(key)
  eq(gs.length, E.GOALS_PER_DAY, 'the day did not ask for two things')
  eq(gs[0].id === gs[1].id, false, 'the day asked for the same thing twice')
  eq(JSON.stringify(E.dailyGoals(key)), JSON.stringify(gs), 'the same day asked for two different sets')
  for (const g of gs) ok(E.goalById(g.id), `the day asked for a goal that is not in the table: ${g.id}`)
  // and the day is what varies them — over a month they are not all the same pair
  const seen = new Set()
  for (let d = 1; d <= 28; d++) seen.add(E.dailyGoals(`2026-09-${String(d).padStart(2, '0')}`).map(g => g.id).sort().join('+'))
  ok(seen.size >= 5, `a month of dailies only ever asked ${seen.size} different things`)
  // every goal in the table is reachable, readable and pays something
  for (const g of E.DAILY_GOALS) {
    ok(g.pts > 0 && g.xp > 0, `${g.id} pays nothing`)
    ok(g.text.length > 8 && g.text === g.text.trim(), `${g.id} does not say what it wants`)
    eq(typeof g.met, 'function', `${g.id} cannot be checked`)
  }

  // the predicates read the run, and each one can be both met and missed
  const spc = { clear: 10, crux: 2, grade: 5 }
  const won = { result: 'send', turn: 15, cleared: 10, peakPump: 2, rests: 0, cruxFree: 1 }
  const lost = { result: 'fall', turn: 40, cleared: 1, peakPump: E.PUMP_MAX, rests: 4, cruxFree: 0 }
  for (const g of E.DAILY_GOALS) {
    eq(g.met(won, spc), true, `${g.id} was not met by a perfect attempt`)
    eq(g.met(lost, spc), false, `${g.id} was met by falling off the first hold`)
  }
  // the "how you climbed" goals are not satisfied by having climbed nothing
  const nothing = { result: 'fall', turn: 2, cleared: 0, peakPump: 0, rests: 0, cruxFree: 0 }
  eq(E.goalById('norest').met(nothing, spc), false, 'not resting was satisfied by not climbing')
  eq(E.goalById('cool').met(nothing, spc), false, 'staying cool was satisfied by not climbing')

  // banking pays the ones met, into the score, the record and xp — and only those
  const base = { ...E.freshRun(0, 0, 1), daily: true, result: 'send', cleared: 10,
    turn: 20, peakPump: 5, skirmish: E.dailyRoute(), dailyDay: '', dailyBest: 0,
    dailyStreak: 0, rests: 0, cruxFree: 1, dailyMet: [] }
  const banked = E.bankDaily(base)
  const met = E.goalsMet(base)
  eq(banked.dailyMet.join(','), met.map(g => g.id).join(','), 'the day did not record what it met')
  eq(banked.dailyScore, E.dailyScore(base) + met.reduce((n, g) => n + g.pts, 0),
    'the objective bonus is not in the day-s score')
  // xp: exactly what the met goals are worth, and it is the ONLY xp bankDaily pays
  const xpWant = met.reduce((n, g) => n + g.xp, 0)
  ok(xpWant > 0, 'this fixture met no objective, so the payout is untested')
  const none = { ...base, result: 'fall', cleared: 0, turn: 40, peakPump: E.PUMP_MAX, rests: 5, cruxFree: 0 }
  eq(E.goalsMet(none).length, 0, 'a nothing attempt still met an objective')
  eq(E.bankDaily(none).xp, none.xp, 'a day that met nothing was paid xp anyway')
  eq(E.bankDaily(none).dailyScore, E.dailyScore(none), 'a day that met nothing was paid a bonus anyway')
  // banking twice pays once — the same guard the score and the streak ride on
  eq(JSON.stringify(E.bankDaily(banked)), JSON.stringify(banked), 'a second bank paid the objectives again')

  // the counters are counted where it happens, and cleared by a fresh burn
  const eng = readFileSync('src/engine.ts', 'utf8')
  ok(/if \(hold\.crux && feetOff\) cruxFree\+\+/.test(eng), 'a feet-off crux is not counted at the hold')
  ok(/rests: s\.rests \+ \(restedThis \? 1 : 0\)/.test(eng), 'a rest is not counted off the turn that rested')
  const burn = region(eng, 'export function startBurn', ['const effGrip'],
    { min: 400, what: 'startBurn' })
  ok(/rests: 0, cruxFree: 0/.test(burn), 'a fresh burn does not reset the objective counters')
  // feet-off reads the board you HANDED IN, not the one resolve has chewed on
  ok(/const feetOff = !s\.boardP\[2\]/.test(eng), 'feet-off reads the mutated board')

  // OFF-BAND BY CONSTRUCTION: the harness climbs the campaign, never the daily
  const sim = readFileSync('sim/run.mjs', 'utf8')
  ok(!/bankDaily|dailyGoals|goalsMet|startDaily/.test(sim), 'the balance harness now plays the daily')
  // and both new counters are inert outside the daily — nothing else reads them
  const readers = [...eng.matchAll(/\b(rests|cruxFree)\b/g)].length
  ok(readers > 0, 'the counters vanished')
  ok(!/(pump|contact|power|grip|skin|psyche)[^\n]*\b(s\.rests|s\.cruxFree)\b/.test(eng),
    'a run resource is now computed from an objective counter')

  // the record survives a save, and the share carries the objectives
  E.saveGame({ ...base, slot: 1, dailyMet: ['flash', 'cool'] })
  eq(E.loadGame(1).dailyMet.join(','), 'flash,cool', 'the objectives met did not survive a save')
  const share = E.dailyShare({ ...banked, dailyDay: key, grades: 'v' })
  const gridLine = share.split('\n')[1]
  eq((gridLine.match(/[▪▫]/g) || []).length, E.specOf(banked).clear,
    'the goals line displaced the grid SOCIAL-1 puts on line two')
  for (const g of E.dailyGoals(key)) ok(share.toLowerCase().includes(g.text.toLowerCase()),
    `the share does not carry the objective "${g.text}"`)
})
test('the streak pays a ladder in kit and titles, and forgives one miss a week (DAILY-1)', () => {
  /* DAILY-1. Coming back every day paid nothing at all before this: `dailyStreak`
     was a number on the save that one deed read. The ladder pays it — but only in
     kit and cosmetic titles, and only through the larder, which the App hands over
     at run start. That is the whole reason the pinned completion band cannot feel
     it: the balance harness calls `newRun` directly and never sees a larder. This
     guard holds both halves — the payout is off-band by construction, and the
     forgiveness is one miss per week rather than an open door. */
  const base = { ...E.freshRun(0, 0, 1), daily: true, result: 'send', cleared: 10,
    turn: 20, peakPump: 5, skirmish: E.dailyRoute(), dailyDay: '', dailyBest: 0,
    dailyStreak: 0, larder: [], titles: [], graceWeek: '' }
  const y = new Date(); y.setUTCDate(y.getUTCDate() - 1)
  const yest = E.dayKey(y)
  const d2 = new Date(); d2.setUTCDate(d2.getUTCDate() - 2)

  // the rungs are where they say they are, and each pays something nameable
  eq(E.STREAK_REWARDS.map(r => r.at).join(','), '3,7,14,30', 'the ladder moved its rungs')
  for (const r of E.STREAK_REWARDS) {
    ok(r.kit || r.title, `the rung at ${r.at} pays nothing`)
    ok(r.text.length > 10, `the rung at ${r.at} has nothing to say`)
    if (r.kit) ok(E.consumableById(r.kit), `the rung at ${r.at} pays kit that does not exist: ${r.kit}`)
  }
  // a rung pays on the day you reach it and on no other day
  for (let n = 1; n <= 31; n++) {
    const want = E.STREAK_REWARDS.some(r => r.at === n)
    eq(!!E.streakReward(n), want, `day ${n} pays when it should not, or does not when it should`)
  }
  // reaching 3 puts kit in the larder — and touches nothing you could spend
  const at3 = E.bankDaily({ ...base, dailyDay: yest, dailyStreak: 2 })
  eq(at3.dailyStreak, 3, 'three days running is not a streak of three')
  eq(at3.larder.join(','), 'chalkshot', 'the third day paid no kit into the larder')
  /* v10.8 (DAILY-2): `bankDaily` now also pays the day's objectives, so comparing a
     banked state to the UNBANKED one would read that payout as the ladder's. The
     property is differential and always was: a rung day and an ordinary day differ
     by the rung and NOTHING else. Same climb, same day, same objectives — so any
     difference in cash, xp, level or the collection is the ladder's doing. */
  const ctrl = E.bankDaily({ ...base, dailyDay: yest, dailyStreak: 3 })
  eq(at3.cash, ctrl.cash, 'the ladder paid cash')
  eq(at3.xp, ctrl.xp, 'the ladder paid xp')
  eq(at3.level, ctrl.level, 'the ladder paid a level')
  eq(at3.owned.length, ctrl.owned.length, 'the ladder paid a card')
  eq(ctrl.larder.length, 0, 'an ordinary day paid kit into the larder')
  eq(at3.kit.length, 0, 'the ladder put kit straight into your hands')
  eq(at3.titles.length, 0, 'the third day handed out a title')
  // a titled rung adds it once and never again
  const at14 = E.bankDaily({ ...base, dailyDay: yest, dailyStreak: 13 })
  eq(at14.titles.join(','), 'Regular', 'two weeks running earned no title')
  eq(E.bankDaily({ ...base, dailyDay: yest, dailyStreak: 13, titles: ['Regular'] }).titles.length, 1,
    'the same title was handed out twice')
  // an ordinary day pays nothing into either pile
  const at4 = E.bankDaily({ ...base, dailyDay: yest, dailyStreak: 3, larder: ['chalkshot'] })
  eq(at4.larder.join(','), 'chalkshot', 'a day off the ladder paid kit anyway')

  // ONE forgiven miss per week: the day before yesterday keeps the streak, and burns the grace
  const wk = E.weekKey()
  const forgiven = E.bankDaily({ ...base, dailyDay: E.dayKey(d2), dailyStreak: 8 })
  eq(forgiven.dailyStreak, 9, 'a single missed day threw the streak away')
  eq(forgiven.graceWeek, wk, 'the forgiven miss did not spend the week grace')
  // and having spent it, the next miss in that same week is not forgiven
  eq(E.bankDaily({ ...base, dailyDay: E.dayKey(d2), dailyStreak: 8, graceWeek: wk }).dailyStreak, 1,
    'a second missed day in one week was forgiven too')
  // grace spent in an earlier week does not carry
  eq(E.bankDaily({ ...base, dailyDay: E.dayKey(d2), dailyStreak: 8, graceWeek: 'w-old' }).dailyStreak, 9,
    "last week's spent grace blocked this week's")
  // three days back is a gap, forgiven or not
  const d3 = new Date(); d3.setUTCDate(d3.getUTCDate() - 3)
  eq(E.bankDaily({ ...base, dailyDay: E.dayKey(d3), dailyStreak: 8 }).dailyStreak, 1,
    'a two-day gap was forgiven')
  // yesterday never spends the grace — it was not a miss
  eq(E.bankDaily({ ...base, dailyDay: yest, dailyStreak: 8 }).graceWeek, '',
    'an on-time day spent the week grace')

  // the payout is off-band BY CONSTRUCTION: newRun cannot see a larder, so the
  // harness that pins the completion band cannot be paid by a streak
  eq(E.newRun(7, E.DEFAULT_LOADOUT, 0, 0, []).kit.length, 0, 'a fresh run starts holding kit')
  eq(E.newRun(7, E.DEFAULT_LOADOUT, 0, 0, []).larder.length, 0, 'a fresh run starts with a larder')
  const eng = readFileSync('src/engine.ts', 'utf8')
  ok(!/kit:\s*[^\n]*larder/.test(eng), 'the engine loads kit from the larder itself')
  // the App hands it over, capped, and keeps the rest banked for next time
  const app = readFileSync('src/App.tsx', 'utf8')
  const hand = region(app, 'function startLostLine', ['function startTutorial'],
    { min: 200, what: 'the run-start handover' })
  ok(/larder\.slice\(0,\s*KIT_MAX\)/.test(hand), 'the larder is handed over without a cap')
  ok(/kit:\s*take/.test(hand) && /larder:\s*st\.larder\.slice\(take\.length\)/.test(hand),
    'the leftover kit is not kept back for the next trip')

  // and all three new fields survive a save
  E.saveGame({ ...base, slot: 1, larder: ['chalkshot', 'tickstick', 'skinsalve'],
    titles: ['Regular'], graceWeek: 'w42' })
  const back = E.loadGame(1)
  eq(back.larder.join(','), 'chalkshot,tickstick,skinsalve', 'the larder did not survive a save')
  eq(back.titles.join(','), 'Regular', 'the titles did not survive a save')
  eq(back.graceWeek, 'w42', 'the spent grace did not survive a save')
  eq(E.nextStreakReward(0).at, 3, 'the next rung from nothing is not the first one')
  eq(E.nextStreakReward(7).away, 7, 'the distance to the next rung is wrong')
  eq(E.nextStreakReward(30), null, 'there is a rung past the top of the ladder')
})
test('the daily share is a deterministic, spoiler-shaped line (SOCIAL-1)', () => {
  const spec = E.dailyRoute('2026-07-29')
  const base = { ...E.freshRun(0, 0, 1), skirmish: spec, daily: false,
    dailyDay: '2026-07-29', dailyScore: 340, dailyStreak: 6, weekScore: 1240,
    weather: 3, rock: 0, result: 'send', cleared: spec.clear, grades: 'v' }
  const out = E.dailyShare(base)
  eq(out, E.dailyShare({ ...base }), 'two identical attempts wrote different shares')
  ok(out.includes('2026-07-29'), 'the share does not carry the date')
  ok(out.includes('340'), 'the share does not carry the score')
  ok(/flashed it/.test(out), 'a topped daily did not read as flashed')
  ok(out.includes('6-day streak') && out.includes('week 1240'), 'the streak or the week is missing')
  // the grid is one mark per hold, filled for what you worked
  const gridLine = out.split('\n')[1]
  const filled = (gridLine.match(/▪/g) || []).length
  const empty = (gridLine.match(/▫/g) || []).length
  eq(filled + empty, spec.clear, 'the grid is not one mark per hold')
  eq(filled, spec.clear, 'a flash did not fill the grid')
  // coming off reads differently and fills fewer
  const off = E.dailyShare({ ...base, result: 'fall', cleared: 3, dailyScore: 90 })
  ok(!/flashed it/.test(off), 'coming off still read as flashed')
  eq((off.split('\n')[1].match(/▪/g) || []).length, 3, 'the grid did not show what you worked')
})

test('grades read correctly in both scales', () => {
  // DES-4. Everything read in V-scale. Font is the other scale people use,
  // and the conversion has to be the real one — climbers will check.
  const pairs = [[0,'4'],[1,'5'],[2,'5+'],[3,'6A'],[4,'6B'],[5,'6C'],[6,'7A'],
    [7,'7A+'],[8,'7B'],[9,'7C'],[10,'7C+'],[11,'8A'],[12,'8A+']]
  for (const [v, f] of pairs) {
    eq(E.gradeText(v, 'v'), 'V' + v, `V${v} does not read as V${v}`)
    eq(E.gradeText(v, 'font'), f, `V${v} should be Font ${f}`)
  }
  // the scale must never change how hard anything is
  for (const r of E.ROUTES) {
    const v = E.gradeLabel(r, 'v'), f = E.gradeLabel(r, 'font')
    if (r.finale || r.fa) { eq(v, '?', 'an unclimbed line shows a grade'); eq(f, '?', 'an unclimbed line shows a grade') }
    else ok(v !== f || r.grade === undefined, `${r.name} reads the same in both scales`)
  }
  // and it must run off the end of the table without breaking
  ok(E.fontOf(99).length > 0, 'a grade above the table returns nothing')
  ok(E.fontOf(-5).length > 0, 'a grade below the table returns nothing')
  eq(E.FONT.length, 18, 'the Font table changed length')
})

test('the tutorial teaches the game that exists', () => {
  /* TUT-2. It taught eight things — tapping, Power vs Grip, feet, Greasy,
     pump, Settle, Sharp, crux — while the game grew opposition, dynos, the
     route acting, exposure, greedy, sequences, boons and hold uncertainty,
     and mentioned none of them. */
  const blob = E.TUTORIAL_STEPS.join(' ').toLowerCase()
  for (const [thing, word] of [
    ['what a hold reads', 'range'], ['opposition', 'sideways'],
    ['the route acting', 'few turns'], ['exposure', 'exposed'],
    ['resolve order', 'order you placed'],
  ]) ok(blob.includes(word), `the tutorial never mentions ${thing}`)
  // a lesson you cannot follow is worse than no lesson
  const deck = E.TUTORIAL_DECK.map(E.spawn)
  ok(deck.filter(c => c.opposes).length >= 2,
    'the tutorial teaches opposition with no opposing cards in the deck')
  ok(deck.filter(c => c.lane === 'feet').length >= 2, 'nothing to put in the feet lane')
  ok(deck.filter(c => c.shed > 0).length >= 1, 'nothing to rest with')
})
test('the glossary keeps up with the rules', () => {
  const named = E.KEYWORDS.map(k => k.name.toLowerCase()).join(' | ')
  for (const k of ['opposition', 'exposed', 'sequence', 'boon', 'clipping',
    'resolve order', 'the route acts', 'what a hold reads'])
    ok(named.includes(k), `the glossary has no entry for ${k}`)
  // and no entry may describe a rule that has since changed
  const commit = E.KEYWORDS.find(k => k.name === 'Commit')
  ok(commit && /stick/i.test(commit.text), 'Commit still describes the old guaranteed dyno')
  const greedy = E.KEYWORDS.find(k => k.name === 'Greedy')
  ok(greedy && /every 2 pump/i.test(greedy.text), 'Greedy still describes the old binary bonus')
  for (const k of E.KEYWORDS) ok(k.text.length > 25, `${k.name} explains nothing`)
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
    const name = blk.slice(0, blk.indexOf("'")) // guard-8: allow — a phase name, up to its own closing quote
    // GUARD-8: this read a fixed 4000 chars, so a screen with its BACK control further
    // down was silently left out of the census and never checked for a parent at all.
    if (/goBack/.test(blk)) withBack.add(name)
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
    // a lookahead, not a guard window: a stopPropagation that moved out of range counts
    // the element as bare, so this errs loud rather than quiet.
    .filter(m => !/stopPropagation/.test(src.slice(m.index, m.index + 200))) // guard-8: allow
  eq(bare.length, 0, `${bare.length} elements are clickable but not focusable`)
  ok(/role: 'button' as const/.test(src), 'the tap helper does not give a role')
  ok(/e\.key === 'Enter'/.test(src), 'nothing responds to the keyboard')
  ok(/focus-visible/.test(src), 'a keyboard user cannot see where they are')
})
test('the game announces itself', () => {
  const src = readFileSync('src/App.tsx', 'utf8')
  ok(/aria-live="polite"/.test(src), 'the spotter is not announced')
  // A11Y-8: the turn result is still announced — via the hidden log live region
  // — but POLITELY now, so it no longer interrupts the reader mid-utterance
  ok(/vis-hidden"[^>]*aria-live/.test(src), 'the result of a turn is not announced')
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
test('the end of a run gives you an account of it', () => {
  /* UX-11. `UX-10` rebuilt the post-CLIMB screen and the post-RUN screen still
     said you won or died, while the trail, the logbook, the lines you named,
     the pages you found and what you were carrying were all being tracked. */
  const app = readFileSync('src/App.tsx', 'utf8')
  /* v10.17: this sliced a fixed 3200 characters, so adding anything near the top of the
     screen silently pushed a needle out of the window and failed for the wrong reason
     (NARR-14's closing line did exactly that). The window ends where the screen ends
     now — at the next phase branch — which is the property meant all along. */
  const screen = region(app, "if (st.phase === 'runEnd')", ["if (st.phase === '"],
    { min: 800, what: 'the run-end screen' })
  ok(screen.length > 1500, `the run-end screen reads as only ${screen.length} chars`)
  for (const [what, needle] of [
    ['the hardest thing you have sent', 'hardest thing you have sent'],
    ['what you sent this trip', 'sent this trip'],
    ['how much of his journal you have', 'his journal'],
    ['the last line you put up', 'the last line you put up'],
    ['what you are carrying', 'carrying'],
    ['the shape of the trip', 'HOW IT WENT'],
  ]) ok(screen.includes(needle), `the end of a run does not tell you ${what}`)
  /* And the bug this turned up: the subtitle was the literal string "Act 1"
     whatever act you actually died in. */
  ok(!/className="sub">Act 1 /.test(screen),
    'the run-end screen still claims every run ended in act 1')
  ok(screen.includes('ACT_NAMES[st.act]'), 'the run-end screen does not name the act you died in')
})

test('a two-digit grip span still fits its pip', () => {
  /* The pip was a fixed 20px circle, which was fine for one digit and clipped
     "12-13" onto two lines the moment ENG-10 started showing an unworked grip
     as a span. Reported from a phone. The widest case is a two-digit span at the
     largest text size: about 47px, against a 93px content strip shared with the
     20px power diamond. */
  const app = readFileSync('src/App.tsx', 'utf8')
  const pip = region(app, '.pip{', ['.cb{'], { min: 60, what: 'the pip styles' })
  ok(!/\.pip\{width:20px/.test(pip), 'the pip is still a fixed width and will clip a span')
  ok(/\.pip\{min-width:20px/.test(pip), 'the pip has no minimum, so a single digit will collapse')
  ok(/white-space:nowrap/.test(pip), 'the pip can still wrap a span onto two lines')
  ok(/\.pip\.d\{[^}]*padding/.test(pip), 'the grip pip has no room to grow into')
  ok(/\.pip\.o\{width:20px/.test(pip), 'the power diamond lost its fixed size')
  /* And the arithmetic, so this cannot creep back: the widest pips row must fit
     the strip UX-9 pinned. 10.5px base, the span drawn at 0.82em, 1.3 scale. */
  const CHAR = 10.5 * 1.3 * 0.82 * 0.62      // bold digit width, measured
  const widest = 20 + (5 * CHAR + 8) + 6     // diamond + pill + gap
  ok(widest < 93, `the widest pips row is ${widest.toFixed(0)}px of a 93px strip`)
  // the grip a route can actually produce, so the span is never three digits
  let max = 0
  for (const h of Object.values(E.HOLD_STATS)) max = Math.max(max, h.grip)
  ok(max + 12 < 100, `a hold could reach ${max + 12} Grip, which needs three digits`)
})

test('the meter shows where the turn takes you', () => {
  /* VIS-1. `previewPump` has been computing where COMMIT puts you since UX-4
     and the meter never drew it — the whole push-your-luck decision, one
     function call away from being visible. */
  const app = readFileSync('src/App.tsx', 'utf8')
  ok(/AFTER THIS/.test(app), 'the meter does not say where the turn takes you')
  ok(/THAT IS A FALL/.test(app), 'the meter does not warn you when the turn ends the burn')
  for (const cls of ['seg.will', 'seg.willfall', 'seg.shedding'])
    ok(app.includes(`.${cls}{`), `no style for ${cls}`)
  ok(/\.nomo \.bar\.tremble\{animation:none\}/.test(app),
    'the trembling meter ignores the motion setting')
  ok(/after this turn/.test(app), 'the projection is invisible to a screen reader')
  /* And the number it draws must be one the meter can hold — drawing past its
     own end is what made peakPump read 13 of 11 in UX-10. */
  const rng = new E.RNG(88)
  for (let t = 0; t < 150; t++) {
    let s = E.startBurn({ ...E.freshRun(4 + rng.int(4), 0, Math.floor(rng.next() * 2 ** 31)),
      inRun: true, skirmish: null, weather: 1, rock: 0,
      runDeck: E.DEFAULT_LOADOUT.map(E.spawn) }, rng)
    for (let k = 0; k < 6 && s.phase === 'climb'; k++) {
      s = E.autoPlay(s, rng)
      const lanes = [0, 1, 2].map(i => E.previewLane(s, i))
      const after = E.previewPump(s, lanes)
      ok(after >= 0, `the meter would draw a negative pump: ${after}`)
      ok(Math.min(E.PUMP_MAX, after) <= E.PUMP_MAX, 'the meter would draw past its own end')
      s = E.resolve(s, rng)
    }
  }
})

test('ROUTE-13: the guidebook is named, and what stays plain stays plain on purpose', () => {
  /* ROUTE-5 gave eleven routes a named feature and stopped; the other 25 were
     stat blocks. They are named now — but four routes and the finale are
     deliberately left plain, and that list is the point of this guard:
       · the first four boulders teach the rules, and a named feature there is
         noise while you are still learning what a crux is;
       · THE LOST LINE is the line NOBODY has named. Giving it a named hold would
         contradict the whole premise, so it keeps its anonymity;
       · the tutorial authors its holds outright and has no signature slot.
     Anything else added later must be named, or say here why not. */
  const PLAIN = ['Warm-Up Rail', 'The Sit Start', 'Mossback', 'Peeler', 'The Lost Line']
  const named = E.ROUTES.filter(r => r.signature)
  ok(named.length >= 30, `only ${named.length} of ${E.ROUTES.length} routes have a named feature`)
  for (const r of E.ROUTES) {
    if (r.tutorial) continue
    if (PLAIN.includes(r.name)) {
      ok(!r.signature, `${r.name} is on the deliberately-plain list but carries a signature`)
      continue
    }
    ok(r.signature, `${r.name} has no named feature and is not a deliberate exception`)
  }
  // the finale's anonymity is load-bearing narrative, so say so twice
  const finale = E.ROUTES.find(r => r.finale)
  ok(finale && !finale.signature, 'the unnamed line has been given a named hold')
  /* Every signature REPLACES an ordinary hold, so a mild one makes its route
     EASIER — the first pass measured +3 points of completion for exactly that
     reason. These are pitched at or above their base, inside the range the
     original table already demonstrated (deathblock, dGrip 3). */
  for (const r of named) {
    const s = E.sigById(r.signature)
    ok(s, `${r.name} points at ${r.signature}, which is not a signature`)
    ok((s.dGrip ?? 0) <= 3, `${s.id} is dGrip ${s.dGrip}, past anything the table had`)
  }
})

test('ENG-28: a hold\'s ability is read through abilityOf, never its base type', () => {
  /* A signature may OVERRIDE the ability of the hold it is built on — The Wet
     Jug is a jug that is GREASY, not a Rest — and a brushed hold has no ability
     at all. resolve has always gone through abilityOf; three readers reached for
     HOLD_STATS[name].ability directly instead, so on Icebox Corner the preview
     shed a pump the resolution never did and the spotter shouted the wrong beta.
     The tripwire is structural: only abilityOf may look an ability up by name. */
  const eng = readFileSync('src/engine.ts', 'utf8')
  const direct = eng.match(/(?:HOLD_STATS|FEET_STATS)\[[^\]]+\]\?\.ability/g) ?? []
  eq(direct.length, 2, `${direct.length} base-ability lookups — only the two inside abilityOf are allowed`)
  const fn = region(eng, 'export const abilityOf', ['/** What a hold is called'],
    { min: 100, what: 'abilityOf' })
  eq((fn.match(/(?:HOLD_STATS|FEET_STATS)\[[^\]]+\]\?\.ability/g) ?? []).length, 2,
    'the allowed base-ability lookups are not the ones inside abilityOf')
  // and the behaviour: an overriding signature must read the same to both sides
  const sig = E.SIGNATURES.find(s => s.ability && E.HOLD_STATS[s.base]
    && E.HOLD_STATS[s.base].ability !== s.ability)
  ok(sig, 'no signature overrides its base ability, so this cannot be tested')
  const base = { ...E.freshRun(4, 0, 1), inRun: true, skirmish: null, phase: 'climb',
    gear: [], boons: [], mutators: [], weather: 1, rock: 0, turn: 1, flow: 0, pump: 4,
    holdDeck: [], worked: [], order: [0], fxLane: ['', '', ''],
    piles: { draw: [], discard: [], exhaust: [], hand: [] } }
  // the overriding hold, set to clear this turn: resolve fires its REAL ability
  const hold = { uid: 1, name: sig.base, bite: 1, grip: 1, crux: false, clean: false, sig: sig.id }
  eq(E.abilityOf(hold), sig.ability, 'abilityOf ignored the signature override')
  const st = { ...base, boardH: [hold, null, null], boardP: [E.spawn('Lock Off'), null, null] }
  const lanes = [0, 1, 2].map(i => E.previewLane(st, i))
  eq(E.previewPump(st, lanes), E.resolve(st, new E.RNG(1)).pump,
    'the preview and resolve disagree on an ability-overriding signature hold')
})

test('BAL-15: a Second Wind buys the go, not a fresh body', () => {
  /* The retry a Second Wind bought used to start on an EMPTY clock — a complete
     extra attempt, carrying the beta you had just banked — which measured at +6
     points of campaign completion off one cheap consumable. That is the "skip"
     CARD-9's ceiling exists to forbid, and it had eaten the band's whole
     headroom. A wind burn starts part-pumped now (WIND_PUMP), the same way a
     caught roped fall does (FALL_PUMP). */
  ok(E.WIND_PUMP > 0 && E.WIND_PUMP < 1, `WIND_PUMP is ${E.WIND_PUMP}, not a share of the meter`)
  const base = { ...E.freshRun(6, 0, 5), inRun: true, skirmish: null, weather: 1, rock: 0,
    runDeck: E.DEFAULT_LOADOUT.map(E.spawn), kit: ['secondwind'], burn: 3, bonusBurns: 0 }
  // spending the wind marks the next burn, and raises the cap that lets it run
  const spent = E.secondWindStep(base, 'secondwind')
  ok(spent.windBurn, 'spending a Second Wind does not mark the burn it bought')
  ok(E.attemptsFor(spent) > E.attemptsFor(base), 'the wind bought no extra burn')
  eq(spent.kit.length, 0, 'the wind was not consumed')
  // that burn starts part-pumped; an ordinary retry still starts fresh
  const windOn = E.startBurn({ ...spent, burn: spent.burn + 1 }, new E.RNG(3))
  const plain = E.startBurn({ ...base, burn: base.burn + 1 }, new E.RNG(3))
  eq(plain.pump, 0, 'an ordinary retry no longer starts on an empty clock')
  eq(windOn.pump, Math.floor(E.PUMP_MAX * E.WIND_PUMP), 'a wind burn does not start part-pumped')
  ok(windOn.pump > 0 && windOn.pump < E.PUMP_MAX,
    'a wind burn must be a real chance, not a lost one')
  // and the mark is spent, so the burn AFTER it is not taxed again
  eq(windOn.windBurn, false, 'the wind mark survives the burn it paid for')
  eq(E.startBurn({ ...windOn, burn: windOn.burn + 1 }, new E.RNG(3)).pump, 0,
    'the burn after a wind burn is still being charged for it')
})

test('UI-2: the menu says which caption belongs to which action, and one leads', () => {
  /* Reported off a phone: the menu was "boring and not clear what goes to what".
     Both halves of that were structural — every mode was the same full-width ink
     bar, and each caption sat in a SEPARATE element BELOW its button, so nothing
     tied a line to the thing it described. A mode is a Tile now: mark, name and
     caption inside the one element you tap, with exactly one hero taking the ink. */
  const app = readFileSync('src/App.tsx', 'utf8')
  const menu = region(app, "if (st.phase === 'menu')", ["if (st.phase === 'prepare')"],
    { min: 500, what: 'the menu screen' })
  // every mode is a tile, and every tile carries its own caption
  const tiles = menu.match(/<Tile\b/g) ?? []
  ok(tiles.length >= 6, `only ${tiles.length} menu modes are tiles`)
  for (const t of menu.split('<Tile').slice(1))
    ok(/\bsub=/.test(t.split('/>')[0]), 'a menu tile has no caption of its own')
  // the caption lives INSIDE the tapped element, not in a sibling below it
  ok(/\.tile \.tsub\{/.test(app), 'the tile caption has no style of its own')
  // and the old ambiguous pattern is gone from this screen
  eq((menu.match(/btn go/g) ?? []).length, 0,
    'the menu still stacks full-width ink bars, which is what made it unreadable')
  // exactly one tile may take the ink, and it follows what you are mid-way through
  ok(/hero=\{st\.tutorialDone \|\| !!resume\}/.test(menu),
    'the expedition tile does not lead once you are under way')
  ok(/hero=\{!resume\}/.test(menu), 'the teaching climb leads even with a run to resume')
  // the marks are what make the rows scannable, so they must all differ
  const marks = [...app.matchAll(/MENU_MARKS\.(\w+)/g)].map(m => m[1])
  ok(new Set(marks).size >= 6, `only ${new Set(marks).size} distinct menu marks`)
  const defs = region(app, 'const MENU_MARKS', ['function Mark('],
    { min: 100, what: 'the menu mark paths' })
  for (const k of new Set(marks)) ok(new RegExp(`\\b${k}:`).test(defs), `${k} has no mark path`)
})

test('UI-2: the title card gates the game and opens the audio inside the tap', () => {
  /* A game should say its own name before it hands you a menu. It also has to:
     a browser will not start an AudioContext until the player has touched the
     page, so the tap that dismisses this screen is the only honest place to open
     one — otherwise the first climb's sound is silently blocked. */
  const app = readFileSync('src/App.tsx', 'utf8')
  ok(/const \[booted, setBooted\] = useState\(false\)/.test(app), 'nothing gates the game on a first tap')
  const splash = region(app, 'if (!booted)', ["if (st.phase === 'menu')"],
    { min: 200, what: 'the title card' })
  ok(/TAP TO BEGIN/.test(splash), 'the title card never says how to get past it')
  ok(/sfx\(/.test(splash) && /setBooted\(true\)/.test(splash),
    'the tap does not open the audio context, so the sound bed stays blocked')
  ok(/<Ridge\b/.test(splash), 'the title card carries no drawing')
  // it must sit in FRONT of the phase graph, not be a phase of its own — the save
  // format and the harness's phase walk stay untouched that way
  ok(app.indexOf('if (!booted)') < app.indexOf("if (st.phase === 'menu')"),
    'the title card renders after a screen it is meant to gate')
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
test('SKIRM-4: the Circuit climbs through named zones', () => {
  // every depth lands in a named zone, and the zones only get deeper — a floor
  // never goes backwards as the line count rises
  let lastFloor = -1, names = new Set()
  for (let n = 0; n <= 30; n++) {
    const z = E.circuitZone(n)
    ok(z.name.length > 2 && z.text.length > 5, `line ${n} has no zone`)
    ok(z.floor <= n, `line ${n} sits in a zone that starts at ${z.floor}`)
    ok(z.floor >= lastFloor, `the zone floor went backwards at line ${n}`)
    lastFloor = z.floor
    names.add(z.name)
  }
  ok(names.size >= 4, `only ${names.size} zones across a deep circuit`)
  // the Warm-Up is where you start, and it does not last forever
  eq(E.circuitZone(0).floor, 0, 'the circuit does not start in the first zone')
  ok(E.circuitZone(30).name !== E.circuitZone(0).name, 'a deep circuit is still the warm-up')
  // the enduro deed (8 lines) lands in a real, named zone past the warm-up
  ok(E.circuitZone(8).floor > 0, 'the endurance deed still sits in the opening zone')
})
test('SKIRM-5: past the grade cap, Into the Dark keeps biting harder', () => {
  const rng = new E.RNG(1)
  // the premise: the grade pins at 10 and never moves again
  eq(E.circuitRoute(15, rng).grade, 10, 'the circuit grade never reaches its cap')
  for (const n of [16, 20, 30, 50]) eq(E.circuitRoute(n, new E.RNG(n)).grade, 10,
    `the grade is still climbing at line ${n} — the premise is wrong`)
  // the new lever is zero at and below the cap (so the enduro deed at line 8 and
  // the whole lower curve are untouched) and grows, monotonically, past it
  let prev = 0
  for (let n = 0; n <= 50; n++) {
    const d = E.circuitRoute(n, new E.RNG(n)).dBite ?? 0
    if (n <= 15) eq(d, 0, `line ${n} grew teeth below the cap`)
    ok(d >= prev, `the dark stopped escalating at line ${n}`)
    prev = d
  }
  ok((E.circuitRoute(16, new E.RNG(16)).dBite ?? 0) >= 1, 'the dark has no teeth the moment the grade caps')
  ok((E.circuitRoute(30, new E.RNG(30)).dBite ?? 0) > (E.circuitRoute(16, new E.RNG(16)).dBite ?? 0),
    'a deeper line in the dark bites no harder than a shallow one')
  // and the teeth are real: the same hold bites harder deep in the dark than in
  // the shallows, by exactly the route's dBite (lane 2 sidesteps the campus bite)
  const hold = { uid: 1, name: 'crimp', bite: 3, grip: 9, crux: false, clean: false }
  const at = n => E.biteAgainst({ ...E.freshRun(0, 0, 1), inRun: true, gear: [], boons: [],
    mutators: [], boardP: [null, null, null], boardH: [null, null, null],
    skirmish: E.circuitRoute(n, new E.RNG(n)) }, null, hold, 2)
  ok(at(30) > at(10), 'a hold deep in the dark bites no harder than one in the shallows')
  eq(at(30) - at(10), E.circuitRoute(30, new E.RNG(30)).dBite, 'the deep-zone bite is not what the route says')
})
test('RUN-10: an act\'s two projects are different boulders at the same grade', () => {
  for (let act = 0; act < E.ACTS.length; act++) {
    const projs = E.ACTS[act].flat().filter(n => n.type === 'project').map(n => n.routeIdx)
    ok(projs.length >= 2, `act ${act} has ${projs.length} project node(s)`)
    // no act points two project nodes at the same boulder any more
    eq(new Set(projs).size, projs.length, `act ${act} still shows the same project twice`)
    const specs = projs.map(i => E.ROUTES[i])
    eq(new Set(specs.map(r => r.name)).size, specs.length, `act ${act}'s projects share a name`)
    // ...but they are the same difficulty, so the completion band cannot move
    const key = r => `${r.grade}/${r.clear}/${r.crux}/${r.style}/${r.feet}/${r.roped ? 'roped' : 'dry'}`
    for (const s of specs)
      eq(key(s), key(specs[0]), `act ${act}'s projects differ in difficulty, not just in name`)
  }
})
test('RUN-10: a first ascent has a shape and a note, but no name yet', () => {
  const shapes = new Set(), notes = new Set()
  for (let act = 0; act < 3; act++)
    for (let seed = 0; seed < 60; seed++) {
      const fa = E.faRoute(act, new E.RNG(seed * 131 + act))
      ok(fa.fa, 'faRoute did not flag a first ascent')
      // still unnamed — you name it after — but it has a shape now
      ok(fa.name.startsWith('An unclimbed '), `a first ascent arrived pre-named: ${fa.name}`)
      ok(fa.note.length > 8, 'a first ascent has no note')
      // difficulty is untouched: grade stays in the act's original band
      ok(fa.grade >= 3 + act * 3 && fa.grade <= Math.min(10, 3 + act * 3 + 2),
        `fa grade ${fa.grade} out of range for act ${act}`)
      shapes.add(fa.name); notes.add(fa.note)
    }
  ok(shapes.size >= 3, `first ascents come in only ${shapes.size} shape(s)`)
  ok(notes.size >= 4, `first ascents read from only ${notes.size} note(s)`)
  eq(E.faRoute(1, new E.RNG(7)).name, E.faRoute(1, new E.RNG(7)).name, 'faRoute is not deterministic')
})
test('ROUTE-10: the crux reads as its style, and resolves the same everywhere', () => {
  const styles = Object.keys(E.CRUX_CHAR)
  ok(styles.length >= 6, 'not every style gives its crux a name')
  ok(new Set(styles.map(s => E.CRUX_CHAR[s].label)).size >= 3, 'the cruxes all read the same')
  // the resolution is load-bearing: no style may lean the Bite (it moves the band)
  for (const s of styles) eq(E.CRUX_CHAR[s].dBite, 0, `${s}'s crux leans its Bite — that moves the band`)
  // build a crux on two styles: reads different on the board, resolves identical
  const crux = style => {
    const spec = { name: 'x', grade: 6, style, clear: 12, crux: 3, feet: 'normal', note: 'a route' }
    const s = { ...E.freshRun(0, 0, 5), inRun: false, skirmish: spec, runDeck: E.DEFAULT_LOADOUT.map(E.spawn) }
    return E.startBurn(s, new E.RNG(9)).holdDeck.find(h => h.crux)
  }
  const razor = crux('crimp ladder'), squeeze = crux('compression')
  ok(razor && squeeze, 'no crux was placed')
  ok(E.holdLabel(razor) !== E.holdLabel(squeeze), 'the cruxes read the same on the board')
  eq(razor.grip, squeeze.grip, 'the crux grip diverged by style — that moves the band')
  eq(razor.bite, squeeze.bite, 'the crux bite diverged by style — that moves the band')
  eq(E.abilityOf(razor), 'Committing', 'the crux stopped being a committing wall')
})
test('the forecast is deterministic, varied and bounded', () => {
  const s = { ...E.freshRun(0, 0, 999), act: 0, tier: 2, reroll: 0 }
  eq(JSON.stringify(E.forecastFor(s)), JSON.stringify(E.forecastFor(s)), 'not deterministic')
  ok(JSON.stringify(E.forecastFor(s)) !== JSON.stringify(E.forecastFor({ ...s, reroll: 1 })),
    'waiting a day changes nothing')
  // ROUTE-9: the palette is per-act now, so coverage is a CAMPAIGN property —
  // every weather is reachable somewhere across the three acts, not in any one.
  const seen = new Set()
  for (let act = 0; act < E.ACTS.length; act++)
    for (let i = 0; i < 500; i++)
      for (const f of E.forecastFor({ ...s, act, tier: 0, seed: i })) {
        ok(f.weather >= 0 && f.weather < E.WEATHER.length, 'weather out of range')
        ok(f.rock >= 0 && f.rock < E.ROCK.length, 'rock out of range')
        seen.add(f.weather)
      }
  eq(seen.size, E.WEATHER.length, 'some weather never appears anywhere in the campaign')
  const scores = E.WEATHER.map((_, i) => E.forecastScore({ weather: i, rock: 0 }))
  ok(Math.max(...scores) > Math.min(...scores), 'every forecast scores the same')
})
test('ROUTE-9: each act has its own weather', () => {
  // sample a lot of stages per act and read off what each act can throw at you
  const wof = act => {
    const w = new Set()
    for (let seed = 0; seed < 400; seed++)
      for (let tier = 0; tier < E.ACTS[act].length; tier++)
        for (const f of E.forecastFor({ ...E.freshRun(0, 0, seed), act, tier, reroll: 0 }))
          w.add(E.WEATHER[f.weather].name)
    return w
  }
  const [forest, desert, alpine] = [wof(0), wof(1), wof(2)]
  // the acts are not the same weather bag with a different background
  ok(desert.has('hot sun') && !forest.has('hot sun') && !alpine.has('hot sun'),
    'hot sun is not the desert\'s alone')
  ok(alpine.has('freezing') && !forest.has('freezing') && !desert.has('freezing'),
    'the freeze is not the alpine\'s alone')
  ok(!desert.has('drizzle'), 'it is drizzling in the desert')
  // and none of them is a one-note climate
  for (const [name, w] of [['forest', forest], ['desert', desert], ['alpine', alpine]])
    ok(w.size >= 3, `the ${name} has only ${w.size} kind${w.size === 1 ? '' : 's'} of weather`)
})
test('an event can remember what you did', () => {
  /* EVT-4. Thirty-two events, all self-contained: you caused an access closure,
     you trundled a block, you believed a man about a grade, and nothing ever
     referred back. `eventsSeen` recorded WHICH event fired and never which
     branch you took, so nothing could look back even if it wanted to. */
  const backs = E.EVENTS.filter(e => e.after)
  ok(backs.length >= 3, `only ${backs.length} events look back at anything`)
  const rng = new E.RNG(3)
  // every callback must point at a branch that actually exists
  for (const b of backs) {
    const [id, ci] = b.after.split(':')
    const cause = E.EVENTS.find(e => e.id === id)
    ok(cause, `${b.id} calls back to ${id}, which is not an event`)
    ok(cause.choices[Number(ci)], `${b.id} calls back to a choice ${id} does not offer`)
    ok(b.title.length > 5 && b.text.length > 60, `${b.id} is too thin to be worth remembering`)
  }
  // unreachable until its cause has happened
  let early = 0
  for (let i = 0; i < 2000; i++) if (E.rollEvent(rng, 0, [], []).after) early++
  eq(early, 0, `a callback fired ${early} times before its cause`)
  // reachable once it has
  let got = 0
  for (let i = 0; i < 2000; i++) if (E.rollEvent(rng, 0, [], ['access:1']).id === 'access2') got++
  ok(got > 20, `the callback only appeared ${got} times in 2000 rolls after earning it`)
  /* and NEVER once the range is exhausted, because meeting the same consequence
     twice reads as a bug rather than as a consequence — the old roll allowed
     repeats in that case, which is what this had to work around */
  const all = E.EVENTS.map(e => e.id)
  let again = 0
  for (let i = 0; i < 1000; i++) if (E.rollEvent(rng, 0, all, ['access:1', 'hold:0']).after) again++
  eq(again, 0, `a callback repeated ${again} times once everything had been seen`)
  // an exhausted range must still return an event rather than undefined
  for (let i = 0; i < 50; i++) ok(E.rollEvent(rng, 0, all, []).id, 'the roll came back empty')
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
    // pump can spike past the top of the meter on the turn you come off; the
    // peak is a reading of the meter, so it is capped at the meter
    ok(s.peakPump >= Math.min(E.PUMP_MAX, s.pump), 'the peak is below the current pump')
    ok(s.peakPump >= Math.min(E.PUMP_MAX, highest), `the peak dropped: ${s.peakPump} after reaching ${highest}`)
  }
  ok(s.peakPump <= E.PUMP_MAX, 'the peak went past the top of the meter')
  // and a new burn starts it again
  const next = E.startBurn({ ...s, phase: 'climb', burn: 2, peakPump: 99 }, rng)
  eq(next.peakPump, 0, 'the peak carried over from the last burn')
})

test('a piece placed is worth placing', () => {
  // ROPE-4. Protection only reduced what a fall cost, which at an average
  // runout of 1.2 holds was worth about one skin — never a card slot. A rack
  // measured 5%→2%, 2%→2%, 0%→0% across the three roped lines: engaging with
  // the subsystem made you worse at it.
  const hold = { uid: 1, name: 'crimp', bite: 3, grip: 9, crux: false, clean: false }
  const ropedIdx = E.ROUTES.findIndex(r => r.roped)
  const boulderIdx = E.ROUTES.findIndex(r => !r.roped && !r.tutorial)
  const at = (idx, clipped) => E.powerAgainst({ ...E.freshRun(idx, 0, 1), inRun: true,
    skirmish: null, gear: [], boons: [], mutators: [], boardP: [null, null, null], clipped },
    E.spawn('Crimp Grip'), hold, 0)
  ok(at(ropedIdx, true) > at(ropedIdx, false), 'clipping buys you nothing on a rope')
  eq(at(boulderIdx, true), at(boulderIdx, false), 'clipping helped on a boulder, where there is no rope')
  ok(E.CLIPPED_POWER > 0, 'a placed piece is worth nothing')
  // and every piece must still say what it does
  for (const n of Object.keys(E.CARDS).filter(n => E.CARDS[n].clip))
    ok((E.CARDS[n].text ?? '').length > 25, `${n} does not explain itself`)
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

test('ENG-25: the sim can see opposition — it drafts toward it and seats the pair', () => {
  /* powerAgainst has scored opposition since ENG-12, but the two halves of the
     tuning sim were blind to it: `cardValue` had no `opposes` term, so the
     drafter never built toward the 14-card compression identity, and `autoPlay`
     filled one hand lane at a time against an empty partner, so every
     opposition card was evaluated at its −2 alone value and a pair never
     formed. This pins both fixes. */
  const base = { ...E.freshRun(4, 0, 1), inRun: true, skirmish: null,
    gear: [], boons: [], mutators: [], pump: 0 }
  const oppNames = Object.keys(E.CARDS).filter(n => {
    const c = E.CARDS[n]; return c.opposes && (c.lane === 'hand' || c.lane === 'any')
  })
  ok(oppNames.length >= 2, `only ${oppNames.length} opposition hand moves to pair`)
  const g1 = E.spawn(oppNames[0]), g2 = E.spawn(oppNames[1])
  // a plain control move of the SAME base power and no power-shifting fx: it
  // beats a lone opposition card (−2) but loses to a seated pair (+2), so it is
  // exactly the card the old greedy fill wrongly kept in a lane.
  const shift = ['greedy', 'momentum', 'weight', 'precise']
  const plainName = Object.keys(E.CARDS).find(n => {
    const c = E.CARDS[n]
    return c.kind === 'move' && !c.opposes && (c.lane === 'hand' || c.lane === 'any')
      && c.power === g1.power && !shift.includes(c.fx ?? '')
  })
  ok(plainName, 'no equal-power plain control card to discriminate the fix')
  const plain = E.spawn(plainName)
  const hold = { uid: 10, name: 'crimp', bite: 3, grip: 9, crux: false, clean: false }
  const st = { ...base, boardH: [hold, { ...hold, uid: 11 }, null],
    boardP: [null, null, null],
    piles: { ...base.piles, hand: [g1, plain, g2] } }
  const out = E.autoPlay(st, new E.RNG(3))
  ok(out.boardP[0]?.opposes && out.boardP[1]?.opposes,
    'autoPlay kept the plain card in a lane instead of seating the opposition pair')
  // and the seated pair reads the full swing the mechanic promises
  const alone = E.powerAgainst({ ...st, boardP: [g1, null, null] }, g1, hold, 0)
  const paired = E.powerAgainst(out, out.boardP[0], hold, 0)
  eq(paired - alone, E.OPPOSE_PAIR - E.OPPOSE_ALONE,
    'the seated pair does not read the full opposition swing')
  // the drafter now values a second opposition card above a lone one
  ok(E.cardValue(base, g2, [g1]) > E.cardValue(base, g2, [plain]),
    'cardValue is blind to a partner already in the deck')
})

test('BAL-13: the early bosses are fights, not flat routes', () => {
  /* The fourth audit found The Priest (act 1) and The Hourglass (act 2) were
     single-phase — a slightly harder route — against the two- and three-phase
     act-3 bosses. They now kick into a real second phase near the top. This is
     a feel/arc change, measured band-neutral (the early bosses are not the
     completion bottleneck; act 3 is). Even-handed clock/lane effects ONLY: the
     Summit Block ledger proved dBite on a crit path charges the Alpinist (−2
     Contact) and the Comp Kid (a burn) twice, so no early-boss phase adds Bite. */
  const byName = n => E.ROUTES.find(r => r.name === n)
  for (const n of ['The Priest', 'The Hourglass']) {
    const r = byName(n)
    ok(r, `${n} is gone from the route table`)
    ok((r.phases?.length ?? 0) >= 2, `${n} is still a flat single-phase boss`)
    ok(r.phases.some(p => p.at >= 0.75), `${n}'s closing phase never reaches the top`)
    for (const p of r.phases) ok(!p.dBite, `${n}'s ${p.name} adds Bite on the crit path (climber-spread)`)
  }
})

test('CARD-15: the reward pool is real and carries the modern texture', () => {
  /* The pool was a frozen 22-card subset — mechanics added since were
     undraftable as a climb reward. This pins the refresh: every name resolves
     to a real card of its tier (a typo would have rollOffers spawn a blank),
     and the texture that was missing (tough / friction / static + the synergy
     specialists) is now present below the rare tier. The rare tier is
     deliberately left untouched — it is the dominant band lever — so this does
     not assert any rare additions. The completion cost of the refresh, and the
     ROUTE-8 / Onsighter ripples it forced, are pinned by the slow guards. */
  const tiers = [['common', E.REWARDS.common], ['uncommon', E.REWARDS.uncommon],
    ['rare', E.REWARDS.rare]]
  for (const [tier, names] of tiers)
    for (const n of names) {
      const c = E.CARDS[n]
      ok(c, `reward "${n}" (${tier}) is not a real card — rollOffers would spawn a blank`)
      ok(c.rarity === tier || c.rarity === 'starter', `${n} is ${c && c.rarity}, offered as ${tier}`)
    }
  // rollOffers only ever yields real, spawned cards
  const rng = new E.RNG(9)
  for (let a = 0; a < 3; a++) for (const c of E.rollOffers(rng, 3, false, a))
    ok(c && c.name && E.CARDS[c.name], `rollOffers produced a blank in act ${a + 1}`)
  // the texture the refresh set out to add is now draftable
  const below = [...E.REWARDS.common, ...E.REWARDS.uncommon].map(n => E.CARDS[n])
  ok(below.some(c => c.fx === 'tough'), 'no tough card reaches a reward')
  ok(below.some(c => c.fx === 'friction'), 'no friction card reaches a reward')
  ok(below.some(c => c.fx === 'static'), 'no static card reaches a reward')
  ok(below.some(c => c.synergy), 'no synergy specialist reaches a reward')
})

test('ENG-26: the preview reads the same board resolve does', () => {
  /* The exact-preview pillar (UX-4/ENG-19) broke in two spots. (a) the tax:
     resolve counts holds whose ABILITY is Committing, the preview counted the
     crux FLAG — and the allCrux boss phase sets the flag on ordinary holds
     without the ability, so the preview over-taxed there. (b) the grip: resolve
     chips (restChip) or sharpens (hex) a lane's hold BEFORE it resolves, but the
     preview read the un-mutated grip, so it disagreed on whether that lane
     cleared. Each case below commits expecting one thing and must get it. */
  const base = { ...E.freshRun(4, 0, 1), inRun: true, skirmish: null, phase: 'climb',
    gear: [], boons: [], mutators: [], weather: 1, rock: 0, turn: 1, flow: 0,
    holdDeck: [], worked: [], order: [], fxLane: ['', '', ''],
    piles: { draw: [], discard: [], exhaust: [], hand: [] } }
  const pumpOf = s => E.previewPump(s, [0, 1, 2].map(i => E.previewLane(s, i)))

  // (a) a promoted hold: the crux FLAG set, but a jug's Rest ability. resolve
  // does not tax it (abilityOf ≠ Committing); the preview must not either.
  const jug = { uid: 1, name: 'jug', bite: 2, grip: 3, crux: true, clean: false }
  const s1 = { ...base, boardH: [jug, null, null], boardP: [null, null, null], pump: 0 }
  eq(pumpOf(s1), E.resolve(s1, new E.RNG(1)).pump,
    'the preview taxes an allCrux-promoted hold the resolve does not')

  // (b1) a hex curse sharpens its lane BEFORE answering it: Split Tip (Power 2,
  // hex 1) on a Grip-2 hold clears at 2 but not at 3, so resolve leaves it up.
  const crimp = { uid: 2, name: 'crimp', bite: 2, grip: 2, crux: false, clean: false }
  const s2 = { ...base, boardH: [crimp, null, null], boardP: [E.spawn('Split Tip'), null, null],
    order: [0], pump: 0 }
  eq(E.previewLane(s2, 0).clears, E.resolve(s2, new E.RNG(1)).boardH[0] === null,
    'the preview ignores the hex the cursed lane takes before it resolves')

  // (b2) a chipping rest works its own hold down first: Chalk the Hold (restChip
  // 2, Power 0) on a Grip-2 hold clears it — the preview must show the clear.
  const crimp2 = { uid: 3, name: 'crimp', bite: 2, grip: 2, crux: false, clean: false }
  const s3 = { ...base, boardH: [crimp2, null, null], boardP: [E.spawn('Chalk the Hold'), null, null],
    order: [0], pump: 3 }
  eq(E.previewLane(s3, 0).clears, E.resolve(s3, new E.RNG(1)).boardH[0] === null,
    'the preview ignores the restChip that works the hold before it resolves')
})

test('ENG-27: a roped fall pays the fall-skin modifiers a boulder fall does', () => {
  /* The caught-fall skin cost in resolve ignored dFallSkin and skinSave, so on
     the roped routes — where you fall most — Long Game / Static's stated
     drawback vanished (strictly upside) and Crash Pads stopped working. Now it
     mirrors the boulder fall handler. cleared stays below the next pitch line so
     the belay does not reset pump before the fall lands. */
  const ropedIdx = E.ROUTES.findIndex(r => r.roped)
  ok(ropedIdx >= 0, 'no roped route to test')
  const hold = { uid: 1, name: 'crimp', bite: 4, grip: 9, crux: false, clean: false }
  const base = { ...E.freshRun(7, 0, 1), inRun: true, skirmish: null, phase: 'climb',
    routeIdx: ropedIdx, weather: 1, rock: 0, turn: 1, flow: 0, burn: 1, onProject: false,
    boardH: [hold, null, null], boardP: [null, null, null], boons: [], gear: [],
    holdDeck: [], worked: [], order: [], fxLane: ['', '', ''],
    piles: { draw: [], discard: [], exhaust: [], hand: [] },
    pump: E.PUMP_MAX, cleared: 3, lastPiece: 0, runout: 3, pitch: 0, skin: 9 }
  const skinAfter = over => E.resolve({ ...base, ...over }, new E.RNG(1)).skin
  const plain = skinAfter({})
  const withDraw = skinAfter({ boons: ['longgame'] })  // dFallSkin:1 — costs one more skin
  const withPads = skinAfter({ gear: ['pads'] })        // skinSave:1 — eats the first fall
  ok(plain < base.skin, `a plain roped fall cost no skin (${plain}/${base.skin})`)
  ok(withDraw < plain, `Long Game's fall drawback is free on a rope (${withDraw} vs ${plain})`)
  ok(withPads === base.skin, `Crash Pads does not save the first roped fall (${withPads}/${base.skin})`)
})

test('FA-1: the FA is a real mode, and the grade you claim is an economy', () => {
  /* THE FA menu button ran a plain skirmish that never reached the claim, and
     the grade you put on a first ascent bought nothing. Now: a standalone FA
     send reaches the claim screen, and claimStep is a real economy — undersell
     (sandbag) for quiet XP, oversell (spray) for loud cash at the Ego risk,
     honest for a little XP. All off-band: the sim's honest-claim stub never
     calls claimStep, and XP feeds a collection the drift guard measures full. */
  // (a) a standalone FA (inRun:false) sent reaches the claim, not sessionEnd
  const fa = { ...E.freshRun(6, 0, 1), inRun: false, result: 'send',
    skirmish: E.faRoute(1, new E.RNG(2)), beta: [], worked: [] }
  eq(E.endSession(fa, new E.RNG(1)).phase, 'claim',
    'a standalone FA send never reaches the naming screen')
  // (b) the honesty economy
  const base = { ...E.freshRun(6, 0, 1), inRun: false, established: [], book: {},
    cash: 0, level: 10, xp: 0, burn: 1, act: 1, tier: 2, runs: 3,
    skirmish: E.faRoute(1, new E.RNG(2)) }
  const real = base.skirmish.grade
  const claim = (g, n) => E.claimStep(base, n, g, new E.RNG(5))
  const sandbag = claim(real - 2, 'Low Ball'), honest = claim(real, 'Fair'), spray = claim(real + 2, 'Big Talk')
  // the line is written to the book and the ledger, at the grade you called it
  eq(sandbag.established[0].claimed, real - 2, 'the claimed grade was not recorded')
  eq(sandbag.established[0].real, real, 'the real grade was not recorded')
  ok(sandbag.book['Low Ball'], 'the named line never reached the book')
  // spray pays loud cash; sandbag/honest pay none
  ok(spray.cash > honest.cash, 'spraying the grade paid no cash')
  eq(sandbag.cash, base.cash, 'a sandbag paid cash it should not')
  // sandbag pays the most quiet XP, honest a little, spray none (no level-up at L10)
  eq(sandbag.level, 10, 'the test leaked a level-up and the xp compare is unsafe')
  ok(sandbag.xp > honest.xp && honest.xp > spray.xp,
    `the honesty XP gradient is wrong: sandbag ${sandbag.xp} honest ${honest.xp} spray ${spray.xp}`)
  // a standalone FA goes home to the menu; an in-run FA drops back on the map
  eq(honest.phase, 'menu', 'a standalone FA claim did not return to the menu')
  eq(E.claimStep({ ...base, inRun: true }, 'On The Map', real, new E.RNG(5)).phase, 'map',
    'an in-run FA claim did not drop back onto the map')
})

test('a line-s description agrees with its own numbers (ROUTE-14)', () => {
  /* Caught on a render, not in review: SIM-6 retuned the direct from four extra cruxes
     to three and left the prose saying "four more cruxes" next to a panel showing 3.
     Tuning a number and leaving the sentence is the easiest mistake in the file, so the
     words are checked against the numbers now. */
  const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight']
  for (const l of E.LINES) {
    const dc = l.dCrux ?? 0, dl = l.dClear ?? 0
    const t = l.text.toLowerCase()
    // any count word in the prose must be a number the line actually carries
    for (const m of t.matchAll(/\b(no|one|two|three|four|five|six|seven|eight)\b\s+(more|fewer|extra|less)?/g)) {
      const n = WORDS.indexOf(m[1])
      ok(n === Math.abs(dc) || n === Math.abs(dl),
        `${l.name} says "${m[0].trim()}" but carries dCrux ${dc} and dClear ${dl}`)
    }
    // and the direction words have to match the sign
    if (dc > 0) ok(!/fewer crux/.test(t), `${l.name} adds cruxes but says fewer`)
    if (dc < 0) ok(!/more crux/.test(t), `${l.name} removes cruxes but says more`)
  }
})
test('no mode leaks into another mode (MODE-1)', () => {
  /* MODE-1. Five flags say what KIND of attempt this is, and each mode-start set only
     its own — so they leaked, and two of the leaks were live and user-visible:
       - climb a challenge, then the daily, and the end-of-burn screen rendered its
         CHALLENGE block on a daily result, quoting somebody else's code and terms;
       - abandon a daily to the menu (`daily` is session state and stays true), then
         climb an FA, and endSession BANKED THE FA'S SCORE AS YOUR DAILY — measured 581
         against a real daily's ~353, corrupting score, streak and week together.
     Same shape as SAVE-2: a state built from the fields somebody remembered. The fix is
     the same shape as `carryOver` — one place naming all of them. */
  eq([...E.MODE_FLAGS].sort().join(','), Object.keys(E.modeReset()).sort().join(','),
    'MODE_FLAGS and modeReset disagree about what a mode is')
  const r = E.modeReset()
  eq(r.daily, false, 'modeReset leaves the daily flag set')
  eq(r.challenge, null, 'modeReset leaves a challenge attached')
  eq(r.circuit, false, 'modeReset leaves the circuit flag set')
  eq(r.onProject, false, 'modeReset leaves you on a project')
  eq(r.skirmish, null, 'modeReset leaves a one-off route attached')
  // freshRun must agree with it, or a new run and a reset run are different things
  const f = E.freshRun(0, 0, 1)
  for (const k of E.MODE_FLAGS) {
    eq(JSON.stringify(f[k]), JSON.stringify(r[k]), `freshRun and modeReset disagree about ${k}`)
  }
  // and carryOver must never carry one back in
  const carried = E.carryOver({ ...f, daily: true, circuit: true, onProject: true,
    challenge: { seed: 1, goal: 'flash' }, skirmish: E.dailyRoute() })
  for (const k of E.MODE_FLAGS) {
    eq(k in carried, false, `carryOver carries the ${k} flag into a new expedition`)
  }

  /* EVERY START GOES THROUGH IT. This is the part that makes the class of bug
     impossible rather than the two instances of it fixed. */
  const app = readFileSync('src/App.tsx', 'utf8')
  const starts = ['startDaily', 'startChallenge', 'startFA', 'startCircuit',
    'startTutorial', 'startLostLine', 'startClimb']
  for (const fn of starts) {
    const body = appFn(app, fn)
    ok(/modeReset\(\)/.test(body), `${fn} does not clear the other modes — it can inherit one`)
  }
  // the circuit has TWO entry paths (start and resume) and both need it
  const cBody = region(app, '  function startCircuit', ['  function nextCircuitLine'],
    { min: 200, what: 'startCircuit' })
  eq((cBody.match(/modeReset\(\)/g) || []).length, 2,
    'one of the two circuit entry paths does not clear the other modes')
  ok(/circuit: true/.test(cBody), 'the circuit resets its own flag and never puts it back')

  /* AND THE TWO BEHAVIOURS THAT WERE BROKEN. Asserted on the engine, so they hold
     whatever the screens do. */
  // (1) a state that had a challenge, reset, is not a challenge any more
  const wasChal = { ...f, challenge: { seed: 4242, goal: 'flash' }, skirmish: E.challengeRoute(4242) }
  eq(E.challengeShare({ ...wasChal, ...E.modeReset() }), '',
    'a reset attempt still writes a challenge answer')
  // (2) bankDaily cannot fire on an attempt that is not the daily
  const faLike = { ...f, ...E.modeReset(), skirmish: E.challengeRoute(99),
    result: 'send', cleared: 40, turn: 6, peakPump: 0, rests: 0, cruxFree: 1,
    dailyDay: '', dailyScore: 0, dailyStreak: 0 }
  const after = E.bankDaily(faLike)
  eq(after.dailyScore, 0, 'a non-daily attempt banked a daily score')
  eq(after.dailyDay, '', 'a non-daily attempt stamped the day as played')
  eq(after.dailyStreak, 0, 'a non-daily attempt moved the streak')
  // ...and it still banks a real one, so the guard above is not just "bankDaily is dead"
  const realDaily = { ...faLike, daily: true, skirmish: E.dailyRoute() }
  ok(E.bankDaily(realDaily).dailyScore > 0, 'bankDaily stopped banking actual dailies')
})
test('somebody is out there with you, and they wanted something else (NARR-14)', () => {
  /* NARR-14. Thirty-seven routes and nobody belayed. The game had a spotter (a hint
     system wearing a person) and TALKS (people you meet once), but nothing that was WITH
     you, so a trip meant to read as an expedition read as a solo campaign.
     A partner is TEXT AND NOTHING ELSE, and that is deliberate: ROUTE-10 and ENG-24
     both established that this project pays narrative in information and never in power.
     So the guard's first job is to prove they cannot make you better at climbing. Their
     one mechanic is an OPINION — they would go a particular way up, and they have
     something to say whether you took it or not. */
  ok(E.PARTNERS.length >= 3, `only ${E.PARTNERS.length} partners — a run would always draw the same one`)
  // SKIRM-7 added the two the Circuit needs: it has no line choice and no camp,
  // so `tie` and `camp` never fire there, but it has a go-again decision nothing else has.
  const MOMENTS = ['tie', 'agree', 'differ', 'send', 'fall', 'camp', 'top', 'died', 'again', 'enough']
  for (const p of E.PARTNERS) {
    ok(p.name && p.who.length > 15, `${p.id} is not a person`)
    ok(p.line >= 0 && p.line < E.LINES.length, `${p.name} favours a line that does not exist: ${p.line}`)
    for (const m of MOMENTS) {
      ok(typeof p.says[m] === 'string' && p.says[m].length > 20,
        `${p.name} has nothing to say at ${m}`)
    }
    // every line is distinct — a partner that repeats itself is not a voice
    eq(new Set(MOMENTS.map(m => p.says[m])).size, MOMENTS.length, `${p.name} repeats a line`)
  }
  // no two partners share a name or an id, and between them they hold real disagreement
  eq(new Set(E.PARTNERS.map(p => p.id)).size, E.PARTNERS.length, 'two partners share an id')
  eq(new Set(E.PARTNERS.map(p => p.name)).size, E.PARTNERS.length, 'two partners share a name')
  /* every line has an advocate. Weaker forms of this ("at least two differ") pass while
     a whole line has nobody who would take it — and a line nobody ever argues for is a
     line the player never hears a reason for. */
  const favoured = new Set(E.PARTNERS.map(p => p.line))
  for (let i = 0; i < E.LINES.length; i++) {
    ok(favoured.has(i), `no partner would ever take ${E.LINES[i].name} — that line has no advocate`)
  }

  /* THEY ARE TEXT. A partner must carry no field that could reach the resolution — no
     Power, Contact, Grip, Bite, Support, skin, psyche or pump anywhere in the table. */
  /* SKIRM-7 widened this by one — `enough`, the circuit score from which THIS person
     would rather you walked off. Widening an allowlist to admit your own field is
     exactly how a guard gets quietly relaxed, so it comes with the two assertions that
     make it safe: `enough` is the same shape as `line` (a number whose only job is to
     SELECT A LINE OF TEXT), and the way that is proved is below — every value the new
     consumer can return has to be a key of `says` and nothing else. A field that
     selected anything other than text would fail that. */
  const allowed = new Set(['id', 'name', 'who', 'line', 'enough', 'says'])
  for (const p of E.PARTNERS) {
    for (const k of Object.keys(p)) ok(allowed.has(k), `${p.name} carries a field a partner should not have: ${k}`)
    ok(typeof p.enough === 'number' && p.enough > 0, `${p.name} would never think it was enough`)
  }
  // the numeric fields only ever choose words: whatever partnerPush returns must be a line
  for (const p of E.PARTNERS) {
    for (const n of [0, p.enough - 1, p.enough, p.enough + 5]) {
      const got = E.partnerPush({ ...E.freshRun(0, 0, 5), circuit: true, circuitScore: n,
        runSeed: E.PARTNERS.indexOf(p) })
      ok(got === null || typeof p.says[got] === 'string',
        `partnerPush returned ${got}, which is not something a partner can say`)
    }
  }
  // and they disagree about when to stop, or the threshold is decoration
  ok(new Set(E.PARTNERS.map(p => p.enough)).size >= 3,
    'the partners all stop at the same point, so who you are out with does not matter')
  const eng = readFileSync('src/engine.ts', 'utf8')
  const table = region(eng, 'export const PARTNERS', ['export function partnerFor'],
    { min: 800, what: 'the partner table' })
  ok(!/\b(power|contact|grip|bite|support|skin|psyche|pump|dTax|shed)\s*:/i.test(table),
    'the partner table grew a mechanical field — a partner is text')
  // ...and nothing in the resolution consults them
  for (const fn of ['export function resolve', 'export function powerAgainst', 'export function biteAgainst',
    'export function startBurn', 'export function autoPlay']) {
    // GUARD-8: bounded at the next declaration, not at 4000 characters. With a fixed
    // window a function that outgrows it puts its tail outside, and the negative
    // assertion below then passes on the part that was cut off.
    const body = declBody(eng, fn, fn)
    /* match the API, not the English word: autoPlay's opposition comments call the other
       hand lane a "partner", which is a different thing entirely. */
    ok(!/\b(partnerFor|partnerSays|partnerAgrees|partnerPush|PARTNERS)\b/.test(body),
      `${fn} reads the partner — that is power, not narrative`)
  }

  /* WHO YOU GET IS DERIVED FROM THE RUN SEED. UX-5's contract is that a run is fully
     determined by its starting seed, so a shared seed must hand over the same partner —
     and deriving rather than storing means a reload cannot change who is standing there. */
  const base = { ...E.freshRun(0, 0, 5), inRun: true, runSeed: 12345 }
  const p1 = E.partnerFor(base)
  ok(p1, 'nobody is out there on a run')
  eq(E.partnerFor({ ...base }).id, p1.id, 'the same seed drew two different partners')
  eq(E.partnerFor({ ...base, act: 2, tier: 4, skin: 1 }).id, p1.id,
    'the partner changed partway through the trip')
  // ...and different seeds do spread across the roster
  const drawn = new Set()
  for (let n = 0; n < 200; n++) drawn.add(E.partnerFor({ ...base, runSeed: n * 7919 }).id)
  eq(drawn.size, E.PARTNERS.length, `200 seeds only ever drew ${drawn.size} of ${E.PARTNERS.length} partners`)
  // nobody is belaying a skirmish, a daily or a challenge — those are not trips
  eq(E.partnerFor({ ...base, inRun: false }), null, 'somebody turned up to a one-off problem')
  eq(E.partnerSays({ ...base, inRun: false }, 'tie'), '', 'a partner spoke outside a run')

  // the opinion reads off the same field the screen shows
  eq(E.partnerAgrees(base, p1.line), true, 'going their way does not read as agreement')
  const other = [0, 1, 2].find(i => i !== p1.line)
  eq(E.partnerAgrees(base, other), false, 'going the other way still reads as agreement')
  eq(E.partnerAgrees({ ...base, inRun: false }, p1.line), false, 'a partner who is not there agreed with you')
  // and they say something different depending on which you took
  ok(E.partnerSays(base, 'agree') !== E.partnerSays(base, 'differ'),
    'the partner says the same thing whether you took their advice or not')

  /* THEY ARE ON THE SCREENS. A partner nobody sees is the CARD-17 failure mode again —
     present in the data, dead in the game. */
  const app = readFileSync('src/App.tsx', 'utf8')
  const lineScreen = region(app, "st.phase === 'line'", ['NOT TODAY'],
    { min: 300, what: 'the line-choice screen' })
  ok(/partnerSays\(st, 'tie'\)/.test(lineScreen), 'they do not say which way they would go')
  ok(/partnerAgrees\(st, i\)/.test(lineScreen), 'the line they favour is not marked on the choice')
  const campScreen = region(app, "st.phase === 'camp'", ["if (st.phase === '"],
    { min: 400, what: 'the camp screen' })
  ok(/partnerSays\(st, 'camp'\)/.test(campScreen), 'they are not at the fire')
  ok(/partnerSays\(st, sent \? 'send' : 'fall'\)/.test(app), 'they have nothing to say about a burn')
  const endScreen = region(app, "if (st.phase === 'runEnd')", ["if (st.phase === '"],
    { min: 800, what: 'the run-end screen' })
  /* NARR-15 pinned the surviving half rather than the whole expression. This assertion
     used to read the entire call, which meant adding a THIRD outcome to the same screen
     broke it without anything being wrong — and the claim it is making is only about the
     two trip endings. `won ? 'top' : 'died'` is still exact about both of them. */
  ok(/won \? 'top' : 'died'/.test(endScreen),
    'the trip ends without a word from whoever was there')
})
test('the Circuit is not the mode nobody bothered with (SKIRM-7)', () => {
  /* SKIRM-7. The Circuit runs `inRun: false` — which is correct, it is not a campaign —
     and every feature that gated on `inRun` therefore skipped it silently. By v10.20 it
     was the least-served mode in the game: no partner (NARR-14), no ambience bed (AUD-2),
     nothing between lines but a zone name. It is also the LONGEST single sitting there
     is, so it is the mode that most wanted somebody standing there. */
  const circ = (n) => ({ ...E.freshRun(0, 0, 5), ...E.modeReset(), circuit: true,
    circuitScore: n, inRun: false, runSeed: 7, skirmish: E.circuitRoute(n, new E.RNG(1)) })

  // A PARTNER. The bug, asserted directly: this returned null for the whole mode.
  ok(E.partnerFor(circ(0)), 'the Circuit still goes out alone')
  ok(E.partnerFor({ ...circ(0), inRun: true }), 'a campaign lost its partner')
  // and every other non-campaign mode still gets nobody — the gate widened by exactly one
  for (const mode of ['daily', 'onProject']) {
    eq(E.partnerFor({ ...E.freshRun(0, 0, 5), ...E.modeReset(), runSeed: 7, [mode]: true }), null,
      `${mode} picked up a partner, so the gate widened further than the Circuit`)
  }
  eq(E.partnerFor({ ...E.freshRun(0, 0, 5), ...E.modeReset(), runSeed: 7 }), null,
    'a state in no mode at all has a partner')
  /* the same person all the way through, including across a resume. DEV-3 saves and
     restores the circuit's runSeed, which is the only reason this can hold — if it were
     ever dropped, coming back to a circuit would hand you a stranger. */
  const who = E.partnerFor(circ(0)).id
  for (const n of [1, 5, 9, 14, 30]) eq(E.partnerFor(circ(n)).id, who, `the partner changed at line ${n}`)
  ok(new Set([0, 1, 2, 3].map(sd => E.partnerFor({ ...circ(0), runSeed: sd }).id)).size > 1,
    'every circuit draws the same partner regardless of seed')

  // AN OPINION about the one decision this mode has, and it is THEIRS, not the zone's
  for (const p of E.PARTNERS) {
    const seed = E.PARTNERS.indexOf(p)
    const at = n => E.partnerPush({ ...circ(n), runSeed: seed })
    eq(at(p.enough - 1), 'again', `${p.name} wants to stop before they said they would`)
    eq(at(p.enough), 'enough', `${p.name} does not stop when they said they would`)
    eq(at(p.enough + 3), 'enough', `${p.name} changes their mind back further in`)
  }
  // it is an opinion and not a rule: nothing outside the circuit can be pushed
  eq(E.partnerPush({ ...circ(20), circuit: false }), null, 'a non-circuit has a push')
  eq(E.partnerPush({ ...circ(0), runSeed: 7 }), 'again', 'a fresh circuit has no opinion on going again')

  // A PLACE. Keyed to the Circuit's own zones, so the bed says how deep you are.
  eq(E.bedFor({ ...circ(0), phase: 'climb' }), E.circuitBed(0), 'the Circuit climbs in silence again')
  ok(E.bedFor({ ...circ(0), phase: 'climb' }) !== 'none', 'the Circuit has no place to be')
  eq(E.bedFor({ ...circ(12), phase: 'circuitNext' }), E.circuitBed(12),
    'the between-lines screen is silent, though it is the Circuit\'s map')
  // it CHANGES with depth, or it is not saying anything
  ok(new Set([0, 6, 12].map(E.circuitBed)).size >= 3,
    'the Circuit sounds the same at every depth, so the bed carries no information')
  /* every zone has a bed, keyed off the zone's own floor rather than a second copy of
     the ladder (ENG-19) — so adding a zone fails here instead of falling through to the
     default and sounding like the warm-up for ever. */
  for (let n = 0; n <= 40; n++) {
    const floor = E.circuitZone(n).floor
    ok(E.CIRCUIT_BEDS[floor], `${E.circuitZone(n).name} (floor ${floor}) has no bed of its own`)
  }
  // the deliberate exceptions still hold: a skirmish and a daily have nowhere to be,
  // and the finale's silence outranks everything (AUD-2)
  for (const mode of ['daily', 'skirmish']) {
    const st = { ...E.freshRun(0, 0, 5), ...E.modeReset(), phase: 'climb',
      [mode]: mode === 'skirmish' ? E.circuitRoute(0, new E.RNG(1)) : true }
    eq(E.bedFor(st), 'none', `${mode} picked up an ambience bed it is meant not to have`)
  }

  /* THEY ARE ON THE SCREEN. A partner present in the data and absent from the render is
     CARD-17's failure mode, and the Circuit is where it would be least noticed. */
  const app = readFileSync('src/App.tsx', 'utf8')
  const next = region(app, "st.phase === 'circuitNext'", ["if (st.phase === '"],
    { min: 600, what: 'the circuit between-lines screen' })
  /* assert the RENDER, not the call. The first cut of this checked that `partnerFor(st)`
     appeared in the screen — which stays true when the block is gated off, because the
     screen calls it into a local either way. Gating the block to `{false && mate ? (`
     left this guard green, and the negative test is the only reason I know that. So the
     gate itself is pinned: `mate` and nothing else may decide whether they are there. */
  ok(/\{mate \? \(/.test(next), 'nobody is standing there between lines')
  ok(/const mate = partnerFor\(st\)/.test(next), 'the screen does not ask who came out with you')
  ok(/partnerSays\(st, push === 'enough' \? 'enough' : 'again'\)/.test(next),
    'the partner says nothing about going again')
  // and their opinion is marked on the choice, the way NARR-14 marks the line they favour
  eq((next.match(/push === 'again'|push === 'enough'/g) ?? []).length, 3,
    'their view is not marked on both buttons, so it is flavour rather than an opinion')
  // the run-end screen must still keep the circuit OUT — a walk-off is not a death
  const end = region(app, "if (st.phase === 'runEnd')", ["if (st.phase === '"],
    { min: 800, what: 'the run-end screen' })
  /* NARR-15. This pinned the GATE — `partnerFor(st) && !st.circuit` — which was the only
     way to say "not a death line" while the circuit had nothing of its own to say. It has
     now, so the gate is gone and the claim is asserted where it actually lives: what the
     circuit branch of that screen chooses. Strictly stronger than the old test, which
     could not have told you WHICH moment a circuit was getting, only that it got none. */
  const say = /partnerSays\(st, st\.circuit \? '(\w+)' : /.exec(end)
  ok(say, 'the run-end screen no longer tells a circuit from a trip, so it is back to one ending for both')
  ok(say[1] !== 'top' && say[1] !== 'died',
    `the circuit reaches run-end with a partner saying you ${say[1]} — those are trip lines`)

  /* OFF-BAND BY CONSTRUCTION, and this one is absolute: the balance harness does not
     contain the word. There is no path from any of this to the measured campaign. */
  const sim = readFileSync('sim/run.mjs', 'utf8')
  ok(!/circuit/i.test(sim), 'the balance harness plays the Circuit now, so this is on-band')

  /* SCOPE, said out loud. The audit item also listed "no season or daily hook" and that
     is deliberately NOT done: the Circuit is ENDLESS, so feeding its score into a bounded
     four-week season (DAILY-3) turns the season into a grind test that can be farmed,
     and the season is meant to measure a habit. Asserted so the carve-out is a decision
     on the record rather than something I forgot. */
  ok(!/circuitScore/.test(declBody(readFileSync('src/engine.ts', 'utf8'),
    'export function bankDaily', 'bankDaily')),
    'the Circuit feeds the season score now — that is farmable, and it wants a decision first')
})
test('SAVE-6: a save cannot claim an array longer than the game can make', () => {
  /* SAVE-6. SAVE-5 was ONE unvalidated number — `xp: undefined` beat freshRun's 0, `gainXp`
     returned NaN, `while (NaN >= xpToNext(level))` was never true and levelling froze for
     ever — and it was reachable from a one-field import code rather than only a future
     version bump. The arrays were the same hole: `owned`, `history`, `journal`,
     `established`, `trail` and a dozen more were taken at whatever length the file claimed.
     The audit's example was harmless (500 `seasonWeeks`, of which the board reads four). The
     ones that are not: `history` and `owned` are RENDERED in full, and everything accepted is
     written straight back out, so the file grows too. */
  const caps = {
    owned: Object.keys(E.CARDS).length, journal: E.JOURNAL.length, seen: E.EVENTS.length,
    ticked: E.ACTS.length, mutators: E.MUTATORS.length, archWins: E.ARCHETYPES.length,
    established: E.ESTABLISHED_MAX, history: E.HISTORY_MAX, larder: E.LARDER_MAX,
    dailyMet: E.GOALS_PER_DAY, seasonWeeks: E.SEASON_WEEKS,
    titles: E.STREAK_REWARDS.length + E.SEASON_TITLES.length,
  }
  /* EVERY CAP IS A REAL NUMBER. This is not padding: `LARDER_MAX` was first written as
     `KIT_MAX * 6` two thousand lines above KIT_MAX, and esbuild hoists the declaration rather
     than throwing, so it evaluated to NaN — and `slice(-NaN)` returns the whole array, so the
     cap silently did nothing. SAVE-5's exact failure mode inside the fix for SAVE-5's shape. */
  for (const [k, v] of Object.entries(caps))
    ok(typeof v === 'number' && isFinite(v) && v > 0, `the cap on ${k} is ${v}, not a number`)
  for (const k of ['MAP_NODES', 'RUN_DECK_MAX', 'KIT_MAX', 'ESTABLISHED_MAX', 'LARDER_MAX'])
    ok(typeof E[k] === 'number' && isFinite(E[k]) && E[k] > 0, `${k} is ${E[k]}, not a number`)

  /* CRAFTED RAW, the way SAVE-1's guard does it, because that is the threat: a file somebody
     wrote by hand or an import code, not something `saveGame` would ever produce. Going
     through `saveGame` would also only test the fields it happens to copy. */
  const craft = d => {
    localStorage.setItem('sandbagged.save.6', JSON.stringify({ v: E.SAVE_FILE_VERSION, level: 3, ...d }))
    return E.loadGame(6)
  }
  /* LONGER THAN THE LARGEST CAP, or the fixture cannot see the clamp at all: `owned` is
     capped at the size of the card table (248), so a 100-entry fixture reads the same
     clamped or not. Found by injecting the removal of that very clamp and watching the
     length assertion pass. */
  const many = Array.from({ length: Math.max(400, ...Object.values(caps)) + 20 }, (_, i) => `x${i}`)
  ok(many.length > Math.max(...Object.values(caps)), 'the fixture is shorter than a cap it tests')
  const back = craft({
    ...Object.fromEntries(Object.keys(caps).map(k => [k, many])),
    seasonWeeks: many.map(() => 7),
    run: { deck: many, tier: 0, skin: 5, seed: 1, gear: many, boons: many,
      kit: many, eventsSeen: many, shoppedAt: many, vanRaided: many,
      trail: many, eventChose: many },
  })
  ok(back, 'the crafted save did not load at all')
  for (const [k, n] of Object.entries(caps))
    ok(back[k].length <= n, `${k} came back with ${back[k].length} entries against a cap of ${n}`)
  for (const [k, n] of [['gear', E.GEAR.length], ['boons', E.BOONS.length], ['kit', E.KIT_MAX],
    ['eventsSeen', E.EVENTS.length], ['shoppedAt', E.MAP_NODES], ['vanRaided', E.MAP_NODES],
    ['trail', E.MAP_NODES], ['eventChose', E.MAP_NODES]])
    ok(back[k].length <= n, `${k} came back with ${back[k].length} against a cap of ${n}`)
  // and the clamp must not be a wipe: what fits is kept, in order
  eq(back.seasonWeeks.length, E.SEASON_WEEKS, 'seasonWeeks was emptied rather than clamped')
  ok(back.seasonWeeks.every(n => n === 7), 'clamping seasonWeeks changed what it kept')
  eq(back.owned[0], 'x0', 'clamping owned kept the wrong end of it')
  eq(back.level, 3, 'clamping the arrays lost the rest of the save')

  // a garbage type where an array belongs is an empty array, not a crash and not a wipe
  const junk = craft({ owned: 'not an array', history: 42, seasonWeeks: { nope: 1 } })
  ok(junk, 'a save with a non-array where an array belongs became unreadable')
  for (const k of ['owned', 'history', 'seasonWeeks'])
    ok(Array.isArray(junk[k]) && junk[k].length === 0, `a non-array ${k} came back as ${typeof junk[k]}`)
  eq(junk.level, 3, 'one bad field cost the rest of the save')
  E.wipeSlot(6)

  /* THE LARDER GROWS IN NORMAL PLAY, which is the one here that is not only about crafted
     saves: `bankDaily` appends a kit item every time the streak ladder pays one and only
     starting a trip takes any out. So it is capped where it GROWS as well as where it loads,
     or the file itself bloats. */
  const eng = readFileSync('src/engine.ts', 'utf8')
  ok(/\[\.\.\.s\.larder, rw\.kit\]\.slice\(-LARDER_MAX\)/.test(eng),
    'the larder is appended to without a cap again, so it grows for ever in normal play')
  // and the writer's own caps are shared with the loader rather than being literals (ENG-19)
  ok(/\.slice\(0, ESTABLISHED_MAX\)/.test(eng), 'the first-ascent cap is a bare number again')
  ok(/\.slice\(0, HISTORY_MAX\)/.test(eng), 'the history cap is a bare number again')
  /* strip the comments first: the note above `ESTABLISHED_MAX` quotes the old `.slice(0, 40)`
     to say what it replaced, and a bare-text negative fails on its own explanation. Fourth
     time this correction has been needed (NARR-14, SIM-6, BAL-16, here), so it is worth
     saying out loud: a NEGATIVE assertion about source must read code, not prose. */
  const engCode = eng.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  ok(!/slice\(0, 40\)/.test(engCode), 'a bare 40 is back — the loader cannot know that number')

  // every array field in the loader goes through the clamp, so a new one cannot be missed
  const load = region(eng, 'export function loadGame', ['\nexport function '],
    { min: 800, what: 'loadGame' })
  const bare = [...load.matchAll(/(\w+): (?:d|d\.run|d\.circuit)\.\w+ \?\? \[\]/g)].map(m => m[1])
  eq(bare.length, 0, `${bare.join(', ')} still take whatever length the file claims`)
})
test('SKIRM-8: the good outcome gets a screen', () => {
  /* SKIRM-8. RUN-13 added the circuit walk-off to history because nothing in the game
     acknowledged the ONE outcome this mode has that is not a failure. SKIRM-7 then gave you
     somebody who nudges you toward it. And pressing the button dropped you on the guidebook
     with no screen at all — while every fall got a full account. Found while wiring SKIRM-7
     and logged rather than bundled. */
  const mid = { ...E.freshRun(0, 0, 1), circuit: true, circuitScore: 7, bestCircuit: 4,
    skirmish: E.circuitRoute(3, new E.RNG(1)), runDeck: E.DEFAULT_LOADOUT.map(E.spawn) }
  const out = E.walkAwayStep(mid)
  eq(out.phase, 'sessionEnd', 'the walk-off goes straight to the menu again')
  eq(out.result, 'walked', 'the walk-off is unmarked, so its screen cannot tell what it was')

  /* It is its OWN result, not 'bail' and not 'send': a bail is giving up on one boulder,
     this is the good ending, and a send would be paid like one. The `eq` above already
     forbids all of that — asserting `result !== 'bail'` separately cannot fail while that eq
     stands, and an assertion that cannot fail is what GUARD-9 exists to catch, so the intent
     is recorded here rather than dressed up as a check. */

  /* THE SCORE SURVIVES AND THE MODE DOES NOT. `circuit` and `skirmish` are MODE_FLAGS and a
     mode left set leaks into the next attempt (MODE-1); the score is not a flag and the
     screen needs it. So the MARKER is `result`, which every run start clears — asserted,
     because reading a stale `circuitScore` as "this was a circuit" is exactly MODE-1. */
  eq(out.circuit, false, 'the circuit mode came with you')
  eq(out.skirmish, null, 'the route came with you')
  ok(out.circuitScore > 0, 'the score did not survive to be shown')
  eq(E.freshRun(0, 0, 1).result, null, 'a fresh run carries a result, so a walk-off marker can leak')
  ok(E.newRun(1).result !== 'walked', 'a brand new run still reads as a walk-off')

  /* AND IT IS ON THE SCREEN. A result nobody renders is CARD-17's failure mode. The route
     header is deliberately NOT shown: `skirmish` is gone, so `specOf` falls back to
     `ROUTES[routeIdx]` and would name a campaign route you were never on. */
  const app = readFileSync('src/App.tsx', 'utf8')
  const end = region(app, "if (st.phase === 'sessionEnd')", ["if (st.phase === '"],
    { min: 600, what: 'the session-end screen' })
  ok(/const walked = st\.result === 'walked'/.test(end), 'the screen does not ask whether you walked off')
  /* pin the gate to the block that carries the SCORE. `/walked \? \(/` on its own matches the
     header's gate too, so disabling the result block left it green — the same "which of these
     did I actually check" slip as SKIRM-7's `partnerFor` assertion. */
  ok(/\{walked \? \(\s*\n\s*<div className="spot"/.test(end),
    'the block with your score on it is not gated on the walk-off')
  ok(/WALKED OFF/.test(end), 'the walk-off has no heading of its own')
  ok(/circuitShare\(st\)/.test(end), 'there is no way to paste what you did')
  // the route header must be behind the same condition, or it names a route you never saw
  ok(/walked \? \([\s\S]{0,400}\) : \([\s\S]{0,200}spec\.name/.test(end),
    'the route header is not gated, so a walk-off names a campaign route')
  /* and NEITHER MAY THE PER-ROUTE COUNT. This one was found by rendering the screen, not by
     reading it: "Burns used 3/3. Got 6 of 5" — one line's burns against a hold count already
     passed. Every per-route number on this screen has to be behind the same gate. */
  ok(/\{walked \? null : \([\s\S]{0,200}Burns used/.test(end),
    "the per-route burn and hold count is shown on a walk-off, which is not about one route")

  /* the share says the same thing the screen does, and the "personal best" wording is only
     true because `bestCircuit` has already taken this run in — so `score >= best` reads as
     "tied or beat the previous best". Asserted both ways rather than trusted. */
  eq(E.circuitShare(out).includes('a personal best'), true, 'beating your best does not say so')
  const worse = E.walkAwayStep({ ...mid, circuitScore: 2, bestCircuit: 9 })
  ok(/best 9/.test(E.circuitShare(worse)), 'a lesser circuit claims a personal best')
  ok(/2 lines/.test(E.circuitShare(worse)) && /7 lines/.test(E.circuitShare(out)),
    'the share does not say how far you got')
  const one = E.circuitShare({ ...out, circuitScore: 1, bestCircuit: 1 })
  ok(/1 line \u00b7/.test(one) && !/1 lines/.test(one), `one line reads as "1 lines": ${one}`)
})
test('BAL-16: a floor nobody can measure is not a floor', () => {
  /* BAL-16. The climber-spread guard says no climber completes less than 5% of campaigns,
     and it was passing on a coin flip: the Comp Kid measured 5.2% at the n=600 that guard
     runs, against a real value of 5.8% — the minimum of five noisy estimates reads about an
     SE low, and an SE there is ~0.9. Worse, 5.8% clears a floor of 5 by 1.7 SE, and no
     sample this project can afford turns that into a claim (2 SE needs n>1900 for one
     climber; 3 SE needs ~3400).
     So the property was UNMEASURABLE, which is a different problem from the property being
     false. Two things fixed it, and neither was moving the floor — BAL-9 exists to forbid
     that, and its own note records the floor being lowered to 4 once "to accommodate a
     drift rather than to fix it":
       (1) the guard resolves the floor where the floor lives (a coarse pass for the spread,
           a fine pass on the two lowest climbers, via `ARCH_ONLY`), and it now FAILS LOUDLY
           when the margin is inside the noise rather than flaking; and
       (2) the Comp Kid was bought back to 6.6%, which is 3.2 SE clear.
     Verified long-standing rather than a recent drift: v10.19, before CARD-18 and before the
     SIM-8 re-pin, reads the same climber at 5.7% (n=1500). `arch` mode measures each
     climber's OWN loadout, so no re-pin can reach it. */
  const comp = E.ARCHETYPES.find(a => a.id === 'comp')
  ok(comp, 'the Comp Kid is gone')

  /* THE BUY-BACK IS TARGETED AND ON THE AXIS IT DIED OF. It died of psyche — 19% of its runs
     against 11-14% for everyone else — because `dAttempts: -1` fails more boulders and
     PSYCHE_MAX is 3. Every other dial was the wrong SIZE, measured at n=2500: one skin 4.9%
     (nothing, and it dies of psyche instead), one betaGrip 5.8% (nothing at all), one Contact
     10.2% and one card of hand 15.6% — either nothing or the best climber in the game. */
  ok((comp.dPsyche ?? 0) > 0, 'the Comp Kid has no psyche buy-back, so it is back on its floor')
  const others = E.ARCHETYPES.filter(a => a.id !== 'comp')
  for (const a of others)
    ok(!a.dPsyche, `${a.name} also carries dPsyche — this was a buy-back for one climber`)

  // ONE FORMULA (ENG-19): every cap on a climber's own psyche goes through psycheMax
  const eng = readFileSync('src/engine.ts', 'utf8')
  eq((eng.match(/Math\.min\(PSYCHE_MAX,/g) ?? []).length, 0,
    'a psyche cap reads the bare constant again, so a climber who carries more heart loses it there')
  ok(/export const psycheMax = /.test(eng), 'psycheMax is gone')
  ok(/PSYCHE_MAX \+ \(archOf\(s\)\.dPsyche \?\? 0\)/.test(eng),
    'psycheMax no longer reads the climber, so the dial does nothing')

  // and it BEHAVES: this climber starts, sends and camps against a higher ceiling
  const st = a => ({ ...E.freshRun(0, 0, 1), arch: E.ARCHETYPES.indexOf(a) })
  eq(E.psycheMax(st(comp)), E.PSYCHE_MAX + comp.dPsyche, 'the Comp Kid climbs on the common ceiling')
  for (const a of others)
    eq(E.psycheMax(st(a)), E.PSYCHE_MAX, `${a.name}'s ceiling moved`)
  // a cap is a cap: nothing may push anyone above their own
  for (const a of E.ARCHETYPES) {
    const cap = E.psycheMax(st(a))
    const camped = E.campStep({ ...st(a), inRun: true, psyche: cap, skin: 5, cash: 0 }, new E.RNG(3))
    ok(camped.psyche <= cap, `${a.name} camps past its own psyche ceiling`)
  }

  // the climber says so — a signature that undersells itself is the CARD-17 shape
  ok(/head/i.test(comp.sigText), "the Comp Kid's signature does not mention what it now carries")

  /* THE FLOOR ITSELF DID NOT MOVE, and the guard says how far above it we are in SEs rather
     than trusting a single draw. Read off the ledger so the two cannot drift apart. */
  const led = readFileSync('sim/test.mjs', 'utf8')
  const spread = region(led, "test('no climber is twice as good as another'", ["  test('"],
    { min: 800, what: 'the climber-spread guard' })
  ok(/ok\(lo > 5,/.test(spread), 'the 5% floor has been moved — BAL-9 is about exactly that')
  /* match the COMMAND, not the word: the prose in that guard explains why `ARCH_ONLY`
     exists, so the bare-name form stayed green when the flag was dropped from the call.
     Third time this project has had to make that correction (NARR-14, SIM-6, here). */
  ok(/ARCH_ONLY=\$\{i\} node sim\/run\.mjs arch \$\{FINE\}/.test(spread),
    'the guard no longer resolves the lowest climber finely')
  ok(/lo - 5 > 2 \* se/.test(spread), 'the guard no longer checks its own margin is measurable')
  ok(/Math\.sqrt\(\(lo \/ 100\) \* \(1 - lo \/ 100\) \/ FINE\)/.test(spread),
    'the standard error is not computed from the proportion and the sample any more')
})
test('the tuning policy can see the feet lane (SIM-6)', () => {
  /* SIM-6. `autoPlay` chose the feet by MAX SUPPORT and nothing else, so it could not
     see that a foot works its hold — and the feet lane works about 38% of every hold
     worked in a campaign. That is the ENG-25 failure mode aimed at the harness itself:
     every band number in the ledger was measured by a policy under-playing one lane.
     Correcting it was worth +1.9 points of measured completion (paired n=2700:
     51.7 → 53.6) with NO game rule changed — the ruler got better, not the climb.
     Recorded honestly, because I overstated this when I logged the ticket: the LANE is
     ~38% of the clears; the BLINDNESS was worth 1.9 points. Different claims. */
  const H = (uid, grip) => ({ uid, name: 'crimp', bite: 1, grip, crux: false, clean: false })
  /* FEET-1: a 'chip' rather than the plain 'foothold', for the reason spelled out on ENG-32's
     fixture — the plain one now pays `Solid` once a foot settles, and `footValue` scores a
     STAYING foot on exactly that ("what it will pay once it is bedded in"), so Solid tips this
     deciding case by +1 and the policy correctly prefers Support. That is the feature working;
     this guard is about whether the policy can see a foot WORK its hold, so it needs a
     foothold that does not also reward staying. */
  const F = (uid, grip) => ({ uid, name: 'chip', bite: 1, grip, crux: false, clean: false })
  eq(E.creepOf(F(1, 1)), 0, 'the chip creeps, so this fixture is carrying a second rule again')
  const base = { ...E.freshRun(6, 0, 5), inRun: true, skirmish: null, phase: 'climb',
    weather: 1, rock: 0, turn: 2, flow: 0, pump: 3, gear: [], boons: [], mutators: [],
    boardH: [null, null, null], boardP: [null, null, null], holdDeck: [], feetDeck: [],
    worked: [], order: [], fxLane: ['', '', ''], topRope: false }
  ok(E.FOOT_CLEAR_VALUE > 0, 'a worked foothold is worth nothing to the policy')

  const feet = Object.keys(E.CARDS).map(n => E.spawn(n)).filter(c => c.lane === 'feet')
  const solid = feet.find(c => c.support >= 2 && c.power <= 1)     // Support, no reach
  const strong = feet.find(c => c.power >= 3 && c.support === 1)   // reach, less Support
  ok(solid && strong, 'the feet pool no longer has both a Support foot and a strong one')

  /* THE DECIDING CASE: a foothold this reachable foot WORKS and the Support foot does
     not. Blind-to-Support-only picks the wrong one; a policy that can see the lane
     takes the hold. This is the whole ticket in one assertion. */
  const easyFoot = F(9, 1)
  const st = { ...base, boardH: [H(1, 99), null, easyFoot],
    piles: { draw: [], discard: [], exhaust: [], hand: [solid, strong] } }
  ok(E.powerAgainst(st, strong, easyFoot, 2) >= E.gripFor(st, easyFoot),
    'the strong foot does not work this foothold, so the fixture proves nothing')
  ok(E.powerAgainst(st, solid, easyFoot, 2) < E.gripFor(st, easyFoot),
    'the Support foot also works it, so the two choices are not distinguishable')
  eq(E.autoPlay(st, new E.RNG(3)).boardP[2].name, strong.name,
    'the policy left a workable foothold to take Support instead — it still cannot see the lane')

  /* ...and it has NOT just become "always take the strongest foot". With nothing
     workable under you, Support is what a foot is for, and the policy takes it. */
  const hardFoot = F(10, 99)
  /* the strong foot is FIRST in hand on purpose: `reduce` keeps its accumulator on a
     tie, so with `[solid, strong]` this passed even when Support was not being scored
     at all — it was hand order doing the work, not the policy. Proved by injection. */
  const st2 = { ...base, boardH: [H(1, 99), null, hardFoot],
    piles: { draw: [], discard: [], exhaust: [], hand: [strong, solid] } }
  ok(E.powerAgainst(st2, strong, hardFoot, 2) < E.gripFor(st2, hardFoot),
    'the strong foot works even this foothold, so the fixture proves nothing')
  eq(E.autoPlay(st2, new E.RNG(3)).boardP[2].name, solid.name,
    'the policy chased an unreachable foothold instead of taking the Support')
  // with no foothold at all, Support is still the only thing a foot can give
  const st3 = { ...base, boardH: [H(1, 99), null, null],
    piles: { draw: [], discard: [], exhaust: [], hand: [strong, solid] } }
  eq(E.autoPlay(st3, new E.RNG(3)).boardP[2].name, solid.name,
    'with nothing under you the policy did not take the most Support')

  // it prices Support through the SHARED function, so ENG-32's settling cost is in it
  const eng = readFileSync('src/engine.ts', 'utf8')
  const pick = region(eng, 'export function autoPlay', ['const order = [0, 1]'],
    { min: 300, what: 'the feet pick' })
  ok(/supportNow\(/.test(pick), 'the policy scores Support with its own copy of the sum')
  ok(/powerAgainst\(st, c, h2, 2\)/.test(pick), 'the policy does not ask whether the foot works its hold')
  ok(!/b\.support > a\.support/.test(pick), 'the policy is back to picking on raw Support alone')

  // a settled foot is never thrown away — the policy only fills an EMPTY feet lane,
  // which is what makes ENG-32's "leave them alone" trade available to it at all
  const held = { ...base, boardH: [H(1, 99), null, easyFoot],
    boardP: [null, null, { ...solid, set: true }],
    piles: { draw: [], discard: [], exhaust: [], hand: [strong] } }
  eq(E.autoPlay(held, new E.RNG(3)).boardP[2].name, solid.name,
    'the policy replaced a planted foot, which it cannot do in the real game either')

  // and the harness still only ever calls the shipping engine (SIM-1/SIM-5)
  const sim = readFileSync('sim/run.mjs', 'utf8')
  ok(/autoPlay/.test(sim), 'the harness no longer plays through the shipping policy')
  /* match the CODE, not the English word — the same correction NARR-14's guard carries for
     the same reason. SIM-8's note in run.mjs lists what the old stat sort was blind to, and
     the word "Support" appears in that sentence, so the bare-word form failed on a comment
     while the property it defends was untouched. Comments are stripped first. */
  const simCode = sim.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  ok(!/support/i.test(simCode), 'the harness grew its own opinion about the feet')
})
test('SIM-8: the band measures a deck a player can actually hold', () => {
  /* SIM-8. The pinned band was measured on an ILLEGAL deck for as long as there has been a
     pin. run.mjs had its own builder — sort every card by `power * 2 + contact`, take the
     top ones — and it capped rares and uncommons but not BETA rarity, while
     `copyLimit('beta')` is 3. So six of the fifteen measured slots were `Beta · Going Alone`
     (4/8) and `Beta · Being Frightened` (3/7), cards `buildable()` refuses outright, worth a
     measured +10.5 points. The band now rides `buildLoadout` — the engine's builder, the one
     behind BUILD ME ONE — so there is ONE builder (ENG-19) and the number describes a deck
     somebody could arrive at. Re-pinned ~52 -> ~44 at v10.23. */
  const sim = readFileSync('sim/run.mjs', 'utf8')
  const builder = region(sim, 'function buildBest()', ['\nif (mode', '\nfunction '],
    { min: 200, what: "the harness's deck builder" })
  ok(/E\.buildLoadout\(/.test(builder), 'the harness builds its own deck again instead of asking the engine')
  /* and it must not have grown a second opinion. Scoped to the builder on purpose: run.mjs
     legitimately scores cards elsewhere (which one to sharpen), so a file-wide ban on the
     formula would fail on code that has nothing to do with this. */
  ok(!/\.power\b|\bsort\(|\breduce\(/.test(builder),
    'the harness deck builder is scoring cards by hand again — one builder, per ENG-19')

  // the deck it hands over is one the card picker would accept, on every count
  const owned = Object.keys(E.CARDS)
    .filter(n => ['common', 'uncommon', 'rare'].includes(E.CARDS[n].rarity ?? 'common'))
  const deck = E.buildLoadout({ ...E.freshRun(0, 0, 1), owned, gear: [], boons: [],
    mutators: [], arch: 0 }, [], owned)
  const used = r => deck.filter(n => (E.CARDS[n].rarity ?? 'common') === r).length
  eq(deck.length, E.DECK_SIZE, `the measured deck is ${deck.length} cards`)
  ok(used('rare') <= E.RARE_SLOTS, `the measured deck holds ${used('rare')} rares against ${E.RARE_SLOTS}`)
  ok(used('uncommon') <= E.UNCOMMON_SLOTS,
    `the measured deck holds ${used('uncommon')} uncommons against ${E.UNCOMMON_SLOTS}`)
  eq(used('beta'), 0, 'the measured deck carries beta cards again — the exact bug SIM-8 fixed')
  eq(used('curse'), 0, 'the measured deck carries a curse')

  /* the beta exclusion has to be checked where it can FAIL. Asserting `used('beta') === 0`
     on a collection that never offered beta is the vacuous shape this session hit twice, so:
     beta cards must exist, must be excluded from what the harness claims to own, and must
     still be refused when a collection does claim them. */
  const betas = Object.keys(E.CARDS).filter(n => (E.CARDS[n].rarity ?? '') === 'beta')
  ok(betas.length > 0, 'there are no beta cards, so none of this exclusion means anything')
  /* read what the HARNESS restricts itself to, not a list rebuilt here. The first cut of
     this asserted `betas.every(n => !owned.includes(n))` against the `owned` computed a few
     lines above — true by construction, so widening run.mjs's own filter back to
     "anything but a curse" left it green. Found by injecting exactly that. */
  ok(/\['common', 'uncommon', 'rare'\]\.includes\(E\.CARDS\[n\]\.rarity/.test(builder),
    'the harness no longer restricts itself to the collectible rarities, so beta can come back')
  ok(E.copyLimit('beta') > 1,
    'a beta card is now single-copy, so the six-of-fifteen shape could not recur — check this guard still says something')
  const claimed = [...owned, ...betas]
  eq(E.buildLoadout({ ...E.freshRun(0, 0, 1), owned: claimed, gear: [], boons: [],
    mutators: [], arch: 0 }, [], claimed).filter(n => (E.CARDS[n].rarity ?? '') === 'beta').length, 0,
    'claiming beta cards as owned puts them back in the measured deck')

  /* THE PIN AND ITS GUARD MUST AGREE. The band is stated twice — as a number in the
     assertion and as prose in its message — and a re-pin that updates one and not the other
     is how a pin quietly stops meaning anything. */
  const led = readFileSync('sim/test.mjs', 'utf8')
  const drift = region(led, "test('the campaign has not drifted since it was last set'", ["  test('"],
    { min: 800, what: 'the drift guard' })
  const band = /ok\(full > (\d+) && full < (\d+)/.exec(drift)
  ok(band, 'the drift guard no longer states a band')
  const said = /completes \$\{full\}% with a full journal — ~(\d+)/.exec(drift)
  ok(said, 'the drift guard does not say what it is pinned at')
  const [lo, hi] = [Number(band[1]), Number(band[2])], pin = Number(said[1])
  ok(pin > lo && pin < hi, `the guard is pinned at ~${pin} but its band is ${lo}–${hi}`)
  ok(hi - lo <= 14, `the band is ${hi - lo} points wide, which would not catch a BAL-14 slide`)
  /* the date has to be in the MESSAGE, not merely somewhere in the test. The first cut
     asserted it anywhere in the window, which the ledger note above the assertion satisfies
     on its own — so stripping the date off the pin itself left this green. A failing run
     prints the message and nothing else, so that is where the version has to be. */
  const msg = /with a full journal — [^`]*/.exec(drift)
  ok(msg && /v\d+\.\d+/.test(msg[0]),
    `the drift guard's message does not say which version set the pin: ${msg ? msg[0] : 'no message'}`)
})
test('a challenge is a problem and its terms, and a typo is refused (SOCIAL-2)', () => {
  /* SOCIAL-2. SOCIAL-1 let you paste a RESULT — people could compare numbers but
     nobody could climb your thing. A challenge code is a seed and one objective: the
     objective is what makes it a challenge rather than a link, because a seed alone is
     only "try this" where a seed plus "and no shaking out" is something to beat.
     THE CHECKSUM IS THE LOAD-BEARING PART, and it is SAVE-1's lesson in miniature:
     without it a mistyped code parses as a perfectly valid DIFFERENT problem, so two
     people compare scores on two different boulders and neither can tell. */
  const goals = E.DAILY_GOALS.map(g => g.id)
  ok(goals.length > 1, 'there is only one objective, so a challenge carries no terms')

  // a code round-trips, for every objective and across the whole seed range
  for (const goal of goals) {
    for (const seed of [0, 1, 42, 999983, 0x7fffffff, 0xfffffffe, 0xffffffff]) {
      const code = E.challengeCode({ seed, goal })
      ok(code.length > 2, `no code for seed ${seed} goal ${goal}`)
      const back = E.readChallenge(code)
      ok(back, `code ${code} does not read back`)
      eq(back.seed, seed >>> 0, `seed ${seed} did not survive the code`)
      eq(back.goal, goal, `goal ${goal} did not survive the code`)
    }
  }
  // it is short enough to say out loud, and case and spacing do not matter
  const code = E.challengeCode({ seed: 0x51ABCD, goal: goals[1] })
  ok(code.length <= 12, `a challenge code is ${code.length} characters — too long to read out`)
  eq(JSON.stringify(E.readChallenge(code.toLowerCase())), JSON.stringify(E.readChallenge(code)),
    'a lowercase code does not read')
  eq(JSON.stringify(E.readChallenge(`  ${code} `)), JSON.stringify(E.readChallenge(code)),
    'a code with spaces around it does not read')

  /* A TYPO IS REFUSED. Every single-character change to a valid code must either read
     back as the SAME challenge or not read at all — never as a different one. */
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let silentlyDifferent = 0, refused = 0
  for (const seed of [7, 12345, 0xabcdef]) {
    const good = E.challengeCode({ seed, goal: goals[0] })
    const want = JSON.stringify({ seed, goal: goals[0] })
    for (let i = 0; i < good.length; i++) {
      if (good[i] === '-') continue
      for (const ch of alphabet) {
        if (ch === good[i]) continue
        const typo = good.slice(0, i) + ch + good.slice(i + 1) // guard-8: allow — a code, not source
        const got = E.readChallenge(typo)
        if (!got) { refused++; continue }
        if (JSON.stringify(got) !== want) silentlyDifferent++
      }
    }
  }
  ok(refused > 50, `only ${refused} typos were refused — the checksum is not doing anything`)
  eq(silentlyDifferent, 0,
    `${silentlyDifferent} single-character typos read back as a DIFFERENT challenge — two people would compare scores on two different boulders`)
  /* ...and so is a TRANSPOSITION, the other mistake people make reading a code out.
     MOD 37,36 guarantees adjacent transpositions too, so this can demand zero as well. */
  let swapped = 0
  for (const seed of [7, 12345, 0xabcdef, 0x5f3759df]) {
    const good = E.challengeCode({ seed, goal: goals[0] })
    const want = JSON.stringify({ seed: seed >>> 0, goal: goals[0] })
    for (let i = 0; i + 1 < good.length; i++) {
      if (good[i] === '-' || good[i + 1] === '-' || good[i] === good[i + 1]) continue
      const t = good.slice(0, i) + good[i + 1] + good[i] + good.slice(i + 2) // guard-8: allow — a code, not source
      const got = E.readChallenge(t)
      if (got && JSON.stringify(got) !== want) swapped++
    }
  }
  eq(swapped, 0, `${swapped} adjacent transpositions read back as a DIFFERENT challenge`)

  // and outright rubbish is refused rather than guessed at
  for (const bad of ['', '-', 'ABC', 'ABC-', '-2F', 'ZZZZ-99-1', 'ABC-2FG', '!!!']) {
    eq(E.readChallenge(bad), null, `rubbish read as a challenge: ${JSON.stringify(bad)}`)
  }
  /* A goal index past the end of the table is refused — a code from a newer build. The
     first version of this used one guessed check character, so it was rejected by the
     CHECKSUM and never exercised the bounds test at all (proved by injection: removing
     the upper bound left it green). It tries every check symbol now, so the only thing
     that can refuse it is the bounds test. */
  const CHK = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ*'
  for (const gi of [E.DAILY_GOALS.length, E.DAILY_GOALS.length + 1, 35]) {
    if (gi < E.DAILY_GOALS.length) continue
    let accepted = null
    for (const ch of CHK) {
      const got = E.readChallenge(`AAAA-${gi.toString(36).toUpperCase()}${ch}`)
      if (got) { accepted = got; break }
    }
    eq(accepted, null, `a code naming objective #${gi}, which this build does not have, was accepted`)
  }

  /* ONE PROBLEM GENERATOR. The daily already had the right one; a second copy would be
     a second set of tables to drift. Same seed in, same problem out — and the daily's
     own snapshot pin (DAILY-2) is what proves the refactor changed nothing. */
  const spec = E.challengeRoute(12345)
  eq(JSON.stringify(E.challengeRoute(12345)), JSON.stringify(spec), 'the same seed gave two problems')
  ok(spec.clear > 0 && spec.grade > 0 && spec.name.length > 2, 'a challenge seed names no problem')
  ok(spec.note !== E.dailyRoute().note, 'a challenge reads as the daily')
  // different seeds are different problems (not a constant)
  const names = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(n => JSON.stringify(E.challengeRoute(n * 7919))))
  ok(names.size >= 6, `eight seeds only made ${names.size} problems`)
  // and it is the DAILY's generator: the daily for a key equals the challenge for that key's seed
  eq(JSON.stringify({ ...E.challengeRoute(E.dailySeed('2026-07-29')), note: '' }),
    JSON.stringify({ ...E.dailyRoute('2026-07-29'), note: '' }),
    'the challenge and the daily are no longer the same generator')

  /* THE RESULT SAYS WHETHER THE TERMS WERE MET. A score alone is not an answer to a
     challenge, which is the entire difference between this and SOCIAL-1. */
  const c = { seed: 4242, goal: 'flash' }
  const base = { ...E.freshRun(0, 0, 1), skirmish: E.challengeRoute(c.seed), challenge: c,
    inRun: false, result: 'send', turn: 12, peakPump: 3, rests: 0, cruxFree: 1, grades: 'v' }
  base.cleared = E.specOf(base).clear
  const out = E.challengeShare(base)
  ok(out.includes(E.challengeCode(c)), 'the answer does not carry the code it is answering')
  ok(/\u2713/.test(out), 'a met objective is not ticked in the answer')
  const missed = E.challengeShare({ ...base, result: 'fall', cleared: 1 })
  ok(/\u2717/.test(missed), 'a missed objective is not marked in the answer')
  ok(missed !== out, 'the answer reads the same whether you met the terms or not')
  eq(E.challengeShare({ ...base, challenge: null }), '', 'a non-challenge produced a challenge answer')
  // the grid is one mark per hold, like SOCIAL-1's
  const grid = out.split('\n')[1]
  eq((grid.match(/[\u25aa\u25ab]/g) || []).length, E.specOf(base).clear,
    'the answer grid is not one mark per hold')

  // it survives a save, and a goal this build does not know is dropped rather than kept
  E.saveGame({ ...base, slot: 1 })
  eq(JSON.stringify(E.loadGame(1).challenge), JSON.stringify(c), 'the challenge did not survive a save')
  E.saveGame({ ...base, slot: 1, challenge: { seed: 5, goal: 'not-a-goal' } })
  eq(E.loadGame(1).challenge, null, 'a challenge naming an unknown objective survived a load')

  /* OFF-BAND BY CONSTRUCTION: a challenge is a skirmish, and the harness climbs the
     campaign. Nothing here can reach the guided line. */
  const app = readFileSync('src/App.tsx', 'utf8')
  const start = region(app, 'function startChallenge', ['const setMine'],
    { min: 200, what: 'startChallenge' })
  ok(/inRun: false/.test(start), 'a challenge starts as a campaign run')
  ok(/skirmish: route/.test(start), 'a challenge does not ride the skirmish path')
  ok(/readChallenge\(code\)/.test(start), 'a challenge starts without reading the code first')
  const sim = readFileSync('sim/run.mjs', 'utf8')
  ok(!/challenge/i.test(sim), 'the balance harness now plays challenges')
})
test('no two screens fight over a class name (VIS-8)', () => {
  /* VIS-8. `.board` has named the climb screen's lane rows — a 3-column grid — since
     v0. DAILY-3 (v10.9) added a season board and called it `.board` too. The later rule
     won, so both the route row and YOUR MOVES were forced into a 30px-tall, 230px-wide
     flexbox: the hold cards overflowed up across the header and the screen was visibly
     broken for FOUR versions, through v10.10, v10.11, v10.12 and v10.13.
     Nothing caught it. tsc cannot see it, the guards did not render the climb screen's
     LAYOUT, and I had a screenshot of the breakage in front of me while checking a card
     caption and read straight past it. So this is the tripwire: one stylesheet, one
     global namespace, and a bare class may only be declared once.
     `.wrap` is the documented exception — the second rule sets a custom property and
     nothing else (`--fs`, the text-scale root), which cannot conflict with layout. The
     rule is therefore "twice is fine only if one side is variables only". */
  const app = readFileSync('src/App.tsx', 'utf8')
  /* the stylesheet must not be truncated: a stray backtick inside it silently ends the
     template literal and takes the rest of the CSS with it. This has bitten twice now
     (DEV-3's comment, and VIS-8's own first draft), so it is asserted — and `region`'s
     floor is now the thing that asserts it. */
  const css = region(app, 'const CSS = `', ['`'], { min: 8000, what: 'the stylesheet' })
  ok(css.includes('.wrap{'), 'the stylesheet does not contain the page wrapper — it is truncated')
  ok(css.includes('.hand'), 'the stylesheet stops before the hand — it is truncated')

  const rules = new Map()
  for (const line of css.split('\n')) {
    const m = /^(\.[a-zA-Z][\w-]*)\s*\{(.*)$/.exec(line)
    if (!m) continue
    const name = m[1].slice(1)
    if (!rules.has(name)) rules.set(name, [])
    rules.get(name).push(m[2])
  }
  ok(rules.size > 40, `only ${rules.size} class rules found — the parse is not seeing the stylesheet`)
  const clashes = []
  for (const [name, bodies] of rules) {
    if (bodies.length < 2) continue
    // a declaration block that sets ONLY custom properties cannot fight over layout
    const real = bodies.filter(b => /[a-zA-Z-]+\s*:/.test(b.replace(/--[\w-]+\s*:[^;]*/g, '')))
    if (real.length > 1) clashes.push(`.${name} x${bodies.length}`)
  }
  eq(clashes.length, 0,
    `two screens are fighting over the same class name, and the later rule wins: ${clashes.join(', ')}`)

  // and the season board specifically must not be called `board` again
  ok(css.includes('.wkboard{'), 'the season board lost its own class name')
  ok(/className="wkboard"/.test(app), 'the season board markup does not use its own class')
  const boardRules = [...css.matchAll(/^\.board\{/gm)]
  eq(boardRules.length, 1, `.board is declared ${boardRules.length} times — the climb screen owns that name`)
})
test('the game has a sense of place, and the finale has none on purpose (AUD-2)', () => {
  /* AUD-2. Eight one-shot effects and nothing sustained, so the game had no sense of
     place. What can be TESTED here is not the sound — I cannot hear it — but the
     decision and the wiring, which is exactly why the decision lives in the engine as
     a pure function and only the oscillators live in the screen.
     The load-bearing case is the finale: "silence is the loudest thing you can do with
     a boss", so a bed that played through it would throw away the one deliberate
     silence in the game. */
  const base = { ...E.freshRun(0, 0, 5), inRun: true, skirmish: null, act: 0, phase: 'map' }
  const beds = new Set()

  // every act on the wall has its own place, and they are distinct
  const onWall = act => E.bedFor({ ...base, act, phase: 'climb' })
  for (const act of [0, 1, 2]) {
    const b = onWall(act)
    ok(b !== 'none', `act ${act} climbs in silence`)
    beds.add(b)
  }
  eq(beds.size, 3, `the three acts do not sound like three places: ${[...beds].join(',')}`)
  // and the map keeps you in the same place as the climb
  for (const act of [0, 1, 2]) {
    eq(E.bedFor({ ...base, act, phase: 'map' }), onWall(act),
      `act ${act} sounds like somewhere else on the map than on the wall`)
  }

  /* THE FINALE IS SILENT, and it outranks the act it is in. */
  const finaleIdx = E.ROUTES.findIndex(r => r.finale)
  ok(finaleIdx >= 0, 'no route is the finale, so this cannot be tested')
  const onFinale = { ...base, act: 2, routeIdx: finaleIdx, skirmish: null, phase: 'climb' }
  ok(E.specOf(onFinale).finale, 'the finale fixture is not the finale')
  eq(E.bedFor(onFinale), 'none', 'the finale has a bed playing over it')
  eq(E.bedFor({ ...onFinale, phase: 'burnEnd' }), 'none', 'the finale is silent climbing but not at the end of a burn')
  // ...and act 3 is NOT silent otherwise, so the silence is the finale's and not the act's
  ok(onWall(2) !== 'none', 'the whole alpine act is silent, so the finale silence says nothing')

  // a camp, a post and the van are places of their own
  eq(E.bedFor({ ...base, phase: 'camp' }), 'camp', 'a camp sounds like nowhere')
  eq(E.bedFor({ ...base, phase: 'shop' }), 'post', 'the trading post sounds like nowhere')
  ok(['camp', 'post', 'van'].every(k => k !== onWall(0)), 'a camp sounds like the wall it is under')

  // the menu and anything outside a run are silent — there is no place to be
  eq(E.bedFor({ ...base, phase: 'menu' }), 'none', 'the menu drones')
  eq(E.bedFor({ ...base, inRun: false, phase: 'climb', skirmish: E.dailyRoute() }), 'none',
    'a daily or a skirmish claims a place in a campaign it is not in')
  // every phase resolves to a real bed name, so nothing can ask for a graph that
  // does not exist — the screen switches on this and a stray name would be silence
  const KINDS = ['none', 'forest', 'desert', 'alpine', 'camp', 'van', 'post']
  const phases = ['menu', 'map', 'climb', 'burnEnd', 'sessionEnd', 'reward', 'camp', 'runEnd',
    'pack', 'collection', 'event', 'journal', 'deck', 'talk', 'glossary', 'gear', 'logbook',
    'shop', 'circuitNext', 'saves', 'stats', 'prepare', 'more', 'epilogue', 'history',
    'line', 'claim', 'deeds']
  for (const phase of phases) for (const act of [0, 1, 2]) for (const inRun of [true, false]) {
    const b = E.bedFor({ ...base, phase, act, inRun })
    ok(KINDS.includes(b), `phase ${phase} asks for a bed that does not exist: ${b}`)
  }
  // and it is a pure read — asking twice gives the same answer
  eq(E.bedFor(onWall(1) ? { ...base, act: 1, phase: 'climb' } : base),
    E.bedFor({ ...base, act: 1, phase: 'climb' }), 'bedFor is not a pure read')

  /* THE WIRING. Synthesised, gated by both switches, and taken away when the tab goes.
     None of this can be heard in a test, so it is read off the source. */
  const app = readFileSync('src/App.tsx', 'utf8')
  // no sampled audio and no library: the build is one inlined file with no requests
  ok(!/\.mp3|\.ogg|\.wav|audio\/|new Audio\(|decodeAudioData|tone\.js|Tone\./i.test(app),
    'the ambience is not synthesised — something fetches or decodes an asset')
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(' ')
  ok(!/tone|howler|pizzicato|audio/i.test(deps), `an audio library crept into the deps: ${deps}`)
  // both switches gate it, and the ambience one is the player's own
  // DEV-7: bounded at the next declaration rather than at the prose of the block after
  // it, which this ticket rewrote — a comment is not a boundary, a declaration is.
  const drive = region(app, 'AUD-2: put the game where it is', ['\n  useEffect(() => {\n    ;(window'],
    { min: 200, what: 'the bed driver' })
  ok(/bedFor\(st\)/.test(drive), 'the screen decides the bed itself instead of asking the engine')
  /* BOTH call sites must carry both switches. Asserting the pair appears "somewhere in
     the driver" was not enough: the visibility handler also contains it, so ungating the
     main effect left this green — caught by injecting exactly that. */
  eq((drive.match(/st\.sound && st\.ambience/g) || []).length, 2,
    'a bed call site is missing one of the two switches')
  ok(!/bed\(bedFor\(st\), st\.sound\)/.test(drive),
    'the main bed effect is gated by sound alone, so the ambience switch does nothing')
  ok(/visibilitychange/.test(drive), 'a backgrounded tab is left droning')
  ok(/document\.hidden/.test(drive), 'nothing checks whether the tab is hidden')
  // one bed at a time: exactly one place stops the running graph
  const mgr = region(app, 'export function bed(', ['export const buzz'],
    { min: 150, what: 'the bed manager' })
  eq((mgr.match(/BED\.stop\(/g) || []).length, 1,
    'more than one place stops the bed, so a graph can be left running')
  ok(/BED\.kind === want/.test(mgr), 'asking for the bed already playing restarts it')
  // the switch is on the settings screen and says which state it is in
  ok(/AMBIENCE \{st\.ambience \? 'ON' : 'OFF'\}/.test(app), 'there is no ambience switch to turn off')
  ok(/aria-checked=\{st\.ambience\}/.test(app), 'the ambience switch is not a switch to a screen reader')
  // and the setting is the player's, so it survives a run and a save
  E.saveGame({ ...base, slot: 1, ambience: false })
  eq(E.loadGame(1).ambience, false, 'the ambience setting did not survive a save')
  eq(E.carryOver({ ...base, ambience: false }).ambience, false,
    'the ambience setting is thrown away by a new run — settings are the player-s')
})
test('FEET-1: the wall can make your feet matter, and every foothold says what it does', () => {
  /* FEET-1. The row said the feet lane was "a single slot answering a single foothold", and
     measuring corrected that twice before anything was designed.

     THE CHOICE OF FOOT WAS ALREADY REAL: 38 foot cards, 25 distinct power/contact/support
     profiles, and not one pair where either card beats the other on all three axes. The lane
     is filled on 77.5% of climb turns and you hold two or more feet on 49.3% of them.

     WHAT WAS MISSING WAS VARIETY IN THE QUESTION. Support only ever takes the values 1 and 2 —
     every powerful foot is Support 1, every Support 2 foot is weak — so it was the same binary
     trade every turn. And the wall could only push that axis DOWN: `Featureless` zeroes it
     (28.9% of the footholds a campaign meets), one weather and two route windows subtract, and
     the only positive dSupport in the game was a pair of shoes. `Solid` is the first upward
     pressure from the rock itself. */
  const feetTypes = Object.entries(E.FEET_STATS)
  /* EVERY FOOTHOLD SAYS SOMETHING. The plain 'foothold' was `ability: '', text: ''` — the only
     thing on the board with nothing to say, in a table where every hold and every other
     foothold has both. Asserted over the table so a silent row cannot come back anywhere. */
  for (const [name, d] of feetTypes) {
    ok(d.ability, `the ${name} has no ability — it is a blank row on the board`)
    ok(d.text, `the ${name} says nothing about what it does`)
  }
  ok(E.SOLID_SUPPORT > 0, 'a solid foothold adds nothing, so the wall still cannot raise Support')
  const solidType = feetTypes.find(([, d]) => d.ability === 'Solid')
  ok(solidType, 'no foothold raises Support any more — the axis only goes down again')

  const H = (uid, grip) => ({ uid, name: 'crimp', bite: 1, grip, crux: false, clean: false })
  const FT = (name, over = {}) => ({ uid: 9, name, bite: 2, grip: 2, crux: false, clean: false, ...over })
  const base = { ...E.freshRun(6, 0, 5), inRun: true, skirmish: null, phase: 'climb',
    weather: 1, rock: 0, turn: 2, flow: 0, pump: 4, gear: [], boons: [], mutators: [],
    holdDeck: [], worked: [], order: [], fxLane: ['', '', ''], topRope: false,
    piles: { draw: [], discard: [], exhaust: [], hand: [] } }
  const allFeet = Object.keys(E.CARDS).map(n => E.spawn(n)).filter(c => c.lane === 'feet')
  const big = allFeet.find(c => c.support >= 2)
  const small = allFeet.find(c => c.support === 1)
  ok(big && small, 'the feet pool no longer has both a Support 2 and a Support 1 foot')
  const hand = E.spawn('Crimp Grip')
  const sup = (fh, card, set, over = {}) => E.supportNow({ ...base,
    boardH: [H(1, 9), null, FT(fh, over)], boardP: [hand, null, { ...card, set }] })

  /* IT PAYS ONLY ONCE THE FOOT HAS SETTLED, and only on the solid foothold. Checked against
     every other foothold type in the table rather than one of them, so this cannot quietly
     become a bonus the whole wall grants. */
  const solidName = solidType[0]
  eq(sup(solidName, big, true) - sup(solidName, big, false), E.FOOT_FRESH + E.SOLID_SUPPORT,
    'settling on a solid foothold is not worth the fresh cost plus what Solid says')
  for (const [name] of feetTypes) {
    if (name === solidName) continue
    eq(sup(name, big, true) - sup(name, big, false), E.FOOT_FRESH,
      `the ${name} pays a settling bonus it does not advertise`)
    eq(sup(name, small, true), sup(name, small, false),
      `the ${name} pays a Support 1 foot something for settling — that is ENG-32's floor, not Solid`)
  }
  /* AND IT REACHES THE FLOORED FEET TOO. ENG-32 exempts a Support 1 foot from the settling
     cost, so without this Solid would have been invisible to exactly the cards that most want
     a reason to stay put. */
  eq(sup(solidName, small, true) - sup(solidName, small, false), E.SOLID_SUPPORT,
    'a Support 1 foot gains nothing from settling on solid rock — the floor swallowed Solid')

  // brushing a foothold strips Solid, exactly as `abilityOf` strips every other ability
  eq(sup(solidName, big, true, { clean: true }), sup('chip', big, true),
    'a brushed solid foothold still pays Solid, so brushing does not mean what it means elsewhere')
  // and a gifted stance never settles, so it never qualifies — the same reason it pays no fresh cost
  eq(E.supportNow({ ...base, stance: true, boardH: [H(1, 9), null, FT(solidName)],
    boardP: [hand, null, null] }), E.STANCE_SUPPORT,
    'a stance you never placed is collecting Solid')

  /* THE POLICY PRICES IT, which is the mechanism that turns +1 Support into "keeping your feet
     can beat working the foothold". Asserted at source: SIM-6 scores a staying foot on what it
     will pay ONCE BEDDED IN, and that is the branch Solid lands in. Not asserted as a flipped
     pick — `footValue`'s `reduce` keeps its accumulator on a tie, so a fixture built to show
     the flip would be testing hand order, which is the trap SIM-6's own note records. */
  const eng = readFileSync('src/engine.ts', 'utf8')
  const pick = stripComments(region(eng, 'export function autoPlay', ['const order = [0, 1]'],
    { min: 300, what: 'the feet pick' }))
  /* THE EXACT LINE, not the pattern. `supWith(c, true)` appears twice in this window — the
     other is the nothing-under-you branch — so the loose form passed while the injection that
     blanks the staying branch went straight through it. Found by that injection. */
  ok(/clears \? now \+ FOOT_CLEAR_VALUE : now \+ supWith\(c, true\)/.test(pick),
    'the policy no longer scores a staying foot on what it will pay once settled, so Solid is invisible to it')

  /* SOLID IS A CHARACTERISTIC OF THE ROCK, NOT THE DEFAULT. It was 5 of the 10 weight on every
     easy-feet route, which would have made half of act 1 a footwork route — and measured, Solid
     at that frequency took the pinned band 44.3% to 45.9% (n=3000). Reweighted to 2, which reads
     45.0%. Asserted as a share so the offset cannot be undone by editing one number. */
  const pools = stripComments(region(eng, 'const FEET_POOLS', ['const STYLES'],
    { min: 150, what: 'the feet pools' }))
  const easy = region(pools, 'easy:', ['normal:'], { min: 40, what: 'the easy feet pool' })
  const weights = [...easy.matchAll(/'([^']+)': (\d+)/g)].map(m => [m[1], Number(m[2])])
  const total = weights.reduce((a, [, w]) => a + w, 0)
  const solidW = (weights.find(([n]) => n === solidName) ?? [, 0])[1]
  ok(total > 0 && weights.length === feetTypes.length, `the easy pool guard is reading ${weights.length} weights of ${feetTypes.length}`)
  ok(solidW / total <= 0.35,
    `the solid foothold is ${solidW}/${total} of the easy pool — a default, not a characteristic`)
  ok(solidW > 0, 'the solid foothold cannot appear on an easy route at all, so Solid is unreachable early')

  /* AND IT IS LOOKABLE-UP. `FEET_STATS` was read in exactly ONE place in App.tsx — the board —
     so both marks keys listed the four hold types and none of the four footholds. A player who
     wanted to know what Featureless meant had nowhere to go. */
  const app = readFileSync('src/App.tsx', 'utf8')
  eq((app.match(/Object\.entries\(FEET_STATS\)/g) ?? []).length, 2,
    'the footholds are missing from one of the two marks keys')
})

test('the feet lane is a trade, and it says what it is doing (ENG-32)', () => {
  /* ENG-32. The ticket read "feet are a lane you fill, not a decision you make", and
     measuring first showed the premise was half wrong in the useful direction: the
     FEET lane works about 39% of every hold worked in a campaign. A third of the climb
     was already down there and nothing said so.
     What was actually missing was the trade. A foot paid its full Support the instant
     it landed, so moving your feet cost nothing and leaving them cost nothing either.
     Support is earned now: a fresh foot withholds FOOT_FRESH and pays in full once
     settled — and because a high-Power foot tends to WORK its hold and leave the wall,
     it never settles, so the pool's own Support-versus-Power shape finally bites. */
  const H = (uid, grip, over = {}) => ({ uid, name: 'crimp', bite: 1, grip, crux: false, clean: false, ...over })
  /* FEET-1 moved this fixture off the plain 'foothold', which now carries `Solid` (+1 Support
     once your foot has settled). That is a SECOND rule about the same turn, so measuring
     ENG-32's settling trade on it stopped isolating ENG-32: the delta below read FOOT_FRESH +
     SOLID_SUPPORT. A 'chip' is the right stand-in — Sharp is read only by `resolve`'s blow
     branch, so it touches neither `supportNow` nor the Support term in `powerAgainst`, where
     'smear edge' (Slick) would have changed the numbers this guard depends on. The combined
     behaviour on a Solid foothold is asserted in the FEET-1 guard instead. */
  const F = (uid, over = {}) => ({ uid, name: 'chip', bite: 2, grip: 2, crux: false, clean: false, ...over })
  eq(E.FEET_STATS['chip'].ability, 'Sharp', 'the chip is no longer the neutral-for-Support foothold this fixture needs')
  const base = { ...E.freshRun(6, 0, 5), inRun: true, skirmish: null, phase: 'climb',
    weather: 1, rock: 0, turn: 2, flow: 0, pump: 4, gear: [], boons: [], mutators: [],
    holdDeck: [], worked: [], order: [], fxLane: ['', '', ''], topRope: false,
    piles: { draw: [], discard: [], exhaust: [], hand: [] } }
  ok(E.FOOT_FRESH > 0, 'a fresh foot withholds nothing, so there is no trade')

  // the premise the design rests on: the pool trades Support against Power
  const feet = Object.keys(E.CARDS).map(n => E.spawn(n)).filter(c => c.lane === 'feet')
  const mean = a => a.reduce((n, c) => n + c.power, 0) / a.length
  const solid = feet.filter(c => c.support >= 2), loose = feet.filter(c => c.support < 2)
  ok(solid.length > 3 && loose.length > 3, 'the feet pool has no two sides to trade off')
  ok(mean(solid) < mean(loose),
    `the feet pool no longer trades Support against Power (${mean(solid).toFixed(2)} vs ${mean(loose).toFixed(2)})`)

  const solidFoot = feet.find(c => c.support >= 2)
  const looseFoot = feet.find(c => c.support === 1)
  ok(solidFoot && looseFoot, 'the pool no longer has both a solid and a loose foot')
  const hand = E.spawn('Crimp Grip')
  const withFoot = (c, planted) => ({ ...base, boardH: [H(1, 9), null, F(3)],
    boardP: [hand, null, { ...c, set: planted }] })

  /* A SOLID foot pays the settling cost; a LOOSE one is floored and does not. That
     floor is the shippable version of this feature — see FOOT_FRESH's note for what
     the unfloored form measured (2.0 points, and two other guards with it). */
  const fresh = E.supportNow(withFoot(solidFoot, false))
  const bedded = E.supportNow(withFoot(solidFoot, true))
  eq(bedded - fresh, E.FOOT_FRESH, 'settling a solid foot is not worth what FOOT_FRESH says')
  ok(fresh >= 1, 'a fresh foot dropped below one Support — the floor is gone')
  eq(E.supportNow(withFoot(looseFoot, false)), E.supportNow(withFoot(looseFoot, true)),
    'a one-Support foot was charged a settling cost — the floor is not holding')
  ok(E.supportNow(withFoot(looseFoot, false)) >= 1, 'a smear now gives the hands nothing at all')
  // and it reaches the hands through Power, which is the only thing Support does
  const pFresh = E.powerAgainst(withFoot(solidFoot, false), hand, withFoot(solidFoot, false).boardH[0], 0)
  const pBedded = E.powerAgainst(withFoot(solidFoot, true), hand, withFoot(solidFoot, true).boardH[0], 0)
  eq(pBedded - pFresh, E.FOOT_FRESH, 'the settling difference never reaches the hands')

  /* NOT ON THE OPENING TURN. There is no previous turn you could have kept your feet
     from, so charging it on turn 1 taxes every burn's start rather than a choice — and
     it landed hardest on the one thing that is nothing but opening turns, a Second Wind
     burn, which begins part-pumped. That inverted CARD-9's contract (lift −1.3). */
  eq(E.supportNow({ ...withFoot(solidFoot, false), turn: 1 }), bedded,
    'a foot placed on the opening turn was charged for not having settled yet')
  ok(E.supportNow({ ...withFoot(solidFoot, false), turn: 2 }) < bedded,
    'the settling cost is not charged after the opening turn either — it does nothing')

  /* THE BUY-BACK. The settling cost falls hardest on whoever moves their feet most,
     and that is the Comp Kid (85 turns a run against the Trad Dad's 133). It cost that
     climber ~0.9 points against ~1.1 of margin over its 5% floor, so the archetype is
     bought back — the CARD-15 pattern — rather than the floor being lowered to meet it. */
  const quick = E.ARCHETYPES.find(a => a.quickFeet)
  ok(quick, 'no archetype has quickFeet, so the ENG-32 buy-back is gone')
  ok(/feet/i.test(quick.sigText), `${quick.name} does not say its feet are different`)
  const qIdx = E.ARCHETYPES.indexOf(quick)
  const qSt = { ...base, inRun: true, arch: qIdx, boardH: [H(1, 9), null, F(3)],
    boardP: [hand, null, { ...solidFoot, set: false }] }
  eq(E.supportNow(qSt), bedded, `${quick.name} still pays the settling cost`)
  // ...and only that climber
  const other = E.ARCHETYPES.findIndex(a => !a.quickFeet)
  ok(other >= 0, 'every archetype has quickFeet, so the cost applies to nobody')
  ok(E.supportNow({ ...qSt, arch: other }) < bedded,
    'the buy-back reached every climber, so ENG-32 does nothing in a run')
  // outside a run there is no archetype, so nobody gets it for free
  ok(E.supportNow({ ...qSt, inRun: false }) < bedded,
    'a skirmish got the buy-back with no archetype in play')

  /* PLANTED IS NOT SETTLED. The Trad Dad's signature is `settleMax: 0` — nothing it
     places ever settles — which is about the Power bonus, not about whether a foot is
     on the wall. Reading freshness off `settled` charged that climber the cost every
     turn for ever as a side effect of its own identity, and measured it down to 6.2%.
     A planted foot with no settle pays in FULL. */
  const trad = E.ARCHETYPES.find(a => a.settleMax === 0)
  ok(trad, 'no archetype has settleMax 0, so this interaction cannot be tested')
  eq(E.supportNow({ ...base, boardH: [H(1, 9), null, F(3)],
    boardP: [hand, null, { ...solidFoot, set: true, settled: 0 }] }), bedded,
    `a planted foot that cannot settle was still charged — ${trad.name} pays for its own signature`)
  // and resolve marks a foot that stood the turn as planted even at settleMax 0
  const tradIdx = E.ARCHETYPES.indexOf(trad)
  const stood = E.resolve({ ...base, arch: tradIdx, inRun: true,
    boardH: [null, null, F(3, { grip: 9 })],
    boardP: [null, null, { ...solidFoot, set: false }], feetDeck: [F(9)] }, new E.RNG(3))
  eq(stood.boardP[2] && stood.boardP[2].set, true,
    'a foot that stood the turn was not marked planted (settleMax 0 climber)')
  eq(stood.boardP[2] && (stood.boardP[2].settled ?? 0), 0,
    'the settleMax-0 climber started settling after all — the fields are conflated again')
  const foot = solidFoot
  // no feet at all is worse still, and the campus bite is separate from Support
  eq(E.supportNow({ ...base, boardH: [H(1, 9), null, F(3)], boardP: [hand, null, null] }), 0,
    'campusing still granted Support')

  // ONE FORMULA. The screen prints this number; a second copy of the sum would drift
  // (ENG-19), so powerAgainst must be its only consumer of the total.
  const eng = readFileSync('src/engine.ts', 'utf8')
  const pa = region(eng, 'export function powerAgainst', ['export function biteAgainst'],
    { min: 400, what: 'powerAgainst' })
  ok(/supportNow\(s\)/.test(pa), 'powerAgainst no longer reads the shared Support formula')
  ok(!/\.support\b/.test(pa), 'powerAgainst grew its own copy of the Support sum')

  // the gift stance is not charged a settling cost — there was no placement to rush
  const stanced = E.afterMove({ ...base, boardH: [H(1, 9), null, F(3)],
    boardP: [hand, null, null], routeMove: { kind: 'stance', lane: 0, text: 'x' } }).s
  eq(E.supportNow(stanced), E.STANCE_SUPPORT, 'a gifted stance was charged a settling cost')

  // Featureless still means the lane gives nothing, settled or not
  const blank = { ...base, boardH: [H(1, 9), null, F(3, { name: 'blank', grip: 4 })],
    boardP: [hand, null, { ...foot, settled: 3 }] }
  eq(E.powerAgainst(blank, hand, blank.boardH[0], 0), E.powerAgainst(
    { ...blank, boardP: [hand, null, null] }, hand, blank.boardH[0], 0),
    'a blank feet hold granted Support anyway')

  // THE LANE ACTUALLY WORKS HOLDS — the finding that reframed this ticket. A foot that
  // beats its hold's grip clears it, and that is real progress up the route.
  const strongFoot = feet.reduce((a, b) => (b.power > a.power ? b : a))
  const stepUp = { ...base, boardH: [null, null, F(3, { grip: 1 })],
    boardP: [null, null, { ...strongFoot, settled: 0 }], holdDeck: [], feetDeck: [F(9)] }
  const stepped = E.resolve(stepUp, new E.RNG(3))
  ok(stepped.cleared > stepUp.cleared, 'working a feet hold is no longer progress up the route')
  // ...and the preview says so, for the feet lane like any other
  eq(E.previewLane(stepUp, 2).clears, true, 'the preview does not show the feet lane working its hold')

  // the screen says what the feet are doing, using the shared number
  const app = readFileSync('src/App.tsx', 'utf8')
  const board = region(app, '<div className="board">', ['<div className="sect">YOUR HAND</div>'],
    { min: 400, what: 'the board render' })
  ok(/supportNow\(st\)/.test(board), 'the feet lane does not print what the hands are getting')
  ok(/SETTLING/.test(board), 'the feet lane does not say when a foot is still settling')
  ok(/i === 2/.test(board), 'the feet reading is not scoped to the feet lane')
  /* the "settling" note must be DERIVED, not assumed. The first cut keyed it on
     `settled` and promised a Support-1 smear a point it can never gain, because the
     floor exempts it — caught on a render, not in review. It has to ask the same
     function resolve asks. */
  ok(/set: true/.test(board), 'the settling note is not derived from the shared formula')
  ok(/gain > 0/.test(board), 'the settling note is not conditional on there being a gain')
  const reading = tail(board, 'const now = supportNow(st)',
    { min: 200, what: 'the feet reading' })
  ok(!/c\.settled/.test(reading),
    'the feet reading keys the settling note on `settled`, which the floor makes a lie')

  // and the preview still agrees with resolve with feet in play, fresh and settled
  for (const settled of [0, 1, 2]) {
    const st = { ...base, pump: 6, boardH: [H(1, 4), H(2, 6), F(3)],
      boardP: [hand, E.spawn('Lock Off'), { ...foot, settled }],
      feetDeck: [F(9)], holdDeck: [H(4, 5)] }
    const lanes = [0, 1, 2].map(i => E.previewLane(st, i))
    eq(E.previewPump(st, lanes), E.resolve(st, new E.RNG(5)).pump,
      `the preview and resolve disagree on pump with a foot settled ${settled}`)
    const predicted = lanes.filter(p => p.clears).length
    const got = E.resolve(st, new E.RNG(5)).cleared - st.cleared
    if (!lanes.some(p => p.stick !== undefined)) {
      eq(got, predicted, `the preview mispredicted the clears with a foot settled ${settled}`)
    }
  }
})
test('a bonus curse is a tax you can pay off, not a dead card (CARD-17)', () => {
  /* CARD-17. The four BONUS curses were the last dead cards in the game and were
     actually WORSE than dead: they carry a pump cost and nothing else, and a played
     bonus goes to the DISCARD — so paying to play one bought nothing and handed the
     card back on the next reshuffle. The only correct play was to let it clog your
     hand all burn. A curse you pay for is written off now: exhausted for the burn,
     for its printed cost plus CURSE_TAX. */
  const bonusCurses = Object.keys(E.CARDS).map(n => E.spawn(n))
    .filter(c => c.rarity === 'curse' && c.kind === 'bonus')
  ok(bonusCurses.length >= 4, `only ${bonusCurses.length} bonus curses — this test is about those`)
  // the premise: these carry a cost and nothing else. If one ever gains a real
  // effect, that is a design change and this test should be revisited, not muted.
  for (const c of bonusCurses) {
    ok(c.cost > 0, `${c.name} costs nothing, so there is no tax to pay`)
    eq(c.shed + c.draw + c.gripCut + c.powerAll + c.power + c.restore + c.read, 0,
      `${c.name} now does something on its own — CARD-17 assumed it did not`)
    eq(c.targeted, false, `${c.name} is targeted, so it cannot be written off with a tap`)
  }
  ok(E.CURSE_TAX > 0, 'writing a curse off is free')

  const base = { ...E.freshRun(6, 0, 5), inRun: true, skirmish: null, phase: 'climb',
    weather: 1, rock: 0, turn: 1, flow: 0, pump: 2, gear: [], boons: [], mutators: [],
    boardH: [null, null, null], boardP: [null, null, null], holdDeck: [], worked: [],
    order: [], fxLane: ['', '', ''] }
  const curse = bonusCurses[0]
  // a costed bonus with no pump-moving effect of its own, so the comparison is clean
  const other = Object.keys(E.CARDS).map(n => E.spawn(n))
    .find(c => c.kind === 'bonus' && c.rarity !== 'curse' && !c.targeted && c.cost > 0
      && c.shed === 0 && c.draw === 0 && c.restore === 0)
  ok(other, 'no ordinary costed bonus without a pump effect to compare against')

  // a curse is EXHAUSTED, so it cannot come back this burn
  const st = { ...base, piles: { draw: [], discard: [], exhaust: [], hand: [curse] } }
  const paid = E.playBonusStep(st, curse, -1, new E.RNG(3))
  ok(paid.piles.exhaust.some(c => c.uid === curse.uid), 'a written-off curse was not exhausted')
  eq(paid.piles.discard.some(c => c.uid === curse.uid), false,
    'a written-off curse went to the discard, so it comes back round — the bug CARD-17 fixes')
  eq(paid.piles.hand.some(c => c.uid === curse.uid), false, 'a written-off curse stayed in hand')
  // it costs the printed cost PLUS the surcharge, and nothing else
  eq(paid.pump, base.pump + curse.cost + E.CURSE_TAX, 'a write-off does not cost what it says')
  eq(paid.skin, base.skin, 'a write-off cost skin as well')
  eq(paid.cleared, base.cleared, 'a write-off made progress up the wall')
  // ...and an ORDINARY bonus still recycles exactly as it always did
  const st2 = { ...base, piles: { draw: [], discard: [], exhaust: [], hand: [other] } }
  const ord = E.playBonusStep(st2, other, -1, new E.RNG(3))
  ok(ord.piles.discard.some(c => c.uid === other.uid), 'an ordinary bonus stopped recycling')
  eq(ord.piles.exhaust.some(c => c.uid === other.uid), false, 'an ordinary bonus is being burned now')
  eq(ord.pump, base.pump + other.cost, 'an ordinary bonus is paying the curse surcharge')

  // the write-off is deliberately a WORSE deal than the camp cut, which is permanent
  const held = { ...base, runDeck: [curse, E.spawn('Crimp Grip')] }
  const cut = E.campStep(held, { kind: 'cut', uid: curse.uid })
  eq(cut.runDeck.some(c => c.uid === curse.uid), false, 'a camp cut no longer removes the card')
  ok(paid.runDeck.length === base.runDeck.length,
    'a mid-climb write-off removed the card from the run deck — that is the camp cut, not this')

  /* THE POLICY CAN SEE IT. ENG-25's lesson: a mechanic the sim cannot use is measured
     as dead, and the whole point of CARD-17 is that these cards stop being dead. */
  const handSt = { ...base, pump: 0,
    piles: { draw: [], discard: [], exhaust: [], hand: [curse] } }
  const played = E.autoPlay(handSt, new E.RNG(7))
  ok(played.piles.exhaust.some(c => c.uid === curse.uid),
    'the policy will not write a curse off, so the balance sim still scores it as dead')
  /* ...but not when the clock is against it — that would spend the burn on tidying up.
     THE FIXTURE IS ON THE BOUNDARY, derived from the constants, because a fixture that
     is merely "pumped" proves nothing: the policy's outer affordability gate already
     rejects those, so an earlier version of this test passed with the headroom rule
     deleted AND with the surcharge left out of the gate. One pump either side of the
     line catches both. */
  const price = curse.cost + E.CURSE_TAX
  const headroom = E.PUMP_MAX - 5              // what the policy demands for a write-off
  const okPump = Math.max(0, headroom - price) // just inside: it should tidy up
  const tightPump = headroom - price + 1       // one pump worse: it must not
  ok(tightPump + price < E.PUMP_MAX - 2,
    'the tight fixture is rejected by the affordability gate, so it tests nothing')
  const loose = E.autoPlay({ ...base, pump: okPump,
    piles: { draw: [], discard: [], exhaust: [], hand: [curse] } }, new E.RNG(7))
  ok(loose.piles.exhaust.some(c => c.uid === curse.uid),
    `the policy would not write a curse off even with headroom to spare (pump ${okPump})`)
  const tight = E.autoPlay({ ...base, pump: tightPump,
    piles: { draw: [], discard: [], exhaust: [], hand: [curse] } }, new E.RNG(7))
  eq(tight.piles.exhaust.some(c => c.uid === curse.uid), false,
    `the policy wrote a curse off at pump ${tightPump} — the clock spent on housekeeping`)

  // the hint tells you the option exists, and quotes what it actually costs
  const hint = E.cardHints(base, curse, [curse, E.spawn('Crimp Grip')]).join(' · ')
  ok(/curse/i.test(hint), 'the hint no longer says it is a curse')
  ok(hint.includes(String(curse.cost + E.CURSE_TAX)),
    `the hint does not quote the real price: ${hint}`)
  /* AND THE CARD IN HAND HAS TO SAY SO. `cardHints` only renders on the draft screens,
     so without this the option exists mid-climb and nothing tells you — which is the
     same "technically present, practically dead" state CARD-17 exists to end. */
  const app = readFileSync('src/App.tsx', 'utf8')
  const hand = region(app, '<div className="sect">YOUR HAND</div>', ['vis-hidden'],
    { min: 400, what: 'the hand render' })
  ok(/writeOff\(c\)/.test(hand), 'the card in hand does not mark a curse as writable-off')
  ok(/CURSE_TAX/.test(hand), 'the card in hand does not quote what a write-off costs')
  ok(/burn/i.test(hand), 'the card in hand does not say the write-off lasts the burn')

  // a MOVE curse is untouched — it already has teeth (CARD-13/16), so it is not this
  const moveCurse = Object.keys(E.CARDS).map(n => E.spawn(n))
    .find(c => c.rarity === 'curse' && c.kind === 'move')
  ok(moveCurse && moveCurse.hex > 0, 'a move curse lost its hex')
  ok(!E.cardHints(base, moveCurse, [moveCurse, E.spawn('Crimp Grip')]).join(' ').includes('write it off'),
    'a move curse is being offered a write-off it does not have')
})
test('the route acts on the climber, not just the stone (ENG-21)', () => {
  /* ENG-21. All four original moves did the same KIND of thing — mutate a hold's
     numbers — so the route could make the wall harder or easier and that was the
     entire vocabulary. Three that act on YOU: `spit` throws a weak card off the
     hold, `pin` denies the shake-out in a lane, `stance` is the gift (draw one).
     The rules this holds: board and lane effects only with NO per-turn pump term
     (that compounds — measured five times, ENG-23 last); the preview must agree with
     resolve on every one of them; and a spat card must be filed, not vanished. */
  const H = (uid, grip, over = {}) => ({ uid, name: 'crimp', bite: 1, grip, crux: false, clean: false, ...over })
  const base = { ...E.freshRun(6, 0, 5), inRun: true, skirmish: null, phase: 'climb',
    weather: 1, rock: 0, turn: 1, flow: 0, pump: 10, gear: [], boons: [], mutators: [],
    holdDeck: [], worked: [], order: [0, 1, 2], fxLane: ['', '', ''],
    piles: { draw: [], discard: [], exhaust: [], hand: [] } }

  // every kind is reachable, and the seven weights are a fixed 100 in every condition
  const kinds = new Set()
  for (let w = 0; w < E.WEATHER.length; w++) for (let r = 0; r < E.ROCK.length; r++) {
    const ws = E.moveWeights({ ...base, weather: w, rock: r })
    eq(ws.length, 7, 'there are not seven move weights')
    eq(ws.reduce((a, b) => a + b, 0), 100, `the weights do not sum to 100 at weather ${w} rock ${r}`)
    for (const n of ws) ok(n >= 0, `a move weight went negative at weather ${w} rock ${r}: ${ws}`)
    const rng = new E.RNG(700 + w * 17 + r)
    for (let n = 0; n < 3000; n++) {
      const m = E.rollRouteMove({ ...base, weather: w, rock: r,
        boardH: [H(1, 5), H(2, 5), H(3, 5)] }, rng)
      if (m) kinds.add(m.kind)
    }
  }
  eq(kinds.size, 7, `only ${[...kinds].sort().join(',')} can ever be rolled`)

  /* THE DRAW ORDER IS THE LOAD-BEARING PART. rollRouteMove must take exactly two
     draws, lane first then kind, exactly as it did before ENG-21. An earlier cut
     rolled the kind first so spit could be kept off the feet lane, and swapping two
     draws reshuffles every roll after it: measured against the shipped build it moved
     the CARD-9 wind arm +2.9 points and took the Second Wind's lift from 2.4 to over
     5 — which reads as this ticket breaking that ceiling when it was the reshuffle.
     This pins the order by replaying the stream by hand. */
  const boardFull = [H(1, 5), H(2, 5), H(3, 5)]
  for (const seed of [3, 17, 91, 404]) {
    const a = new E.RNG(seed)
    const got = E.rollRouteMove({ ...base, boardH: boardFull }, a)
    const b = new E.RNG(seed)
    const lanes = [0, 1, 2].filter(i => boardFull[i])
    const wantLane = lanes[b.int(lanes.length)]     // draw 1 is the LANE
    b.next()                                        // draw 2 is the kind
    eq(got.lane, wantLane, 'rollRouteMove no longer draws the lane first')
    // and exactly two draws: a third RNG advanced twice must now agree with the first
    const c = new E.RNG(seed); c.int(lanes.length); c.next()
    eq(c.s, a.s, 'rollRouteMove no longer takes exactly two draws')
  }
  /* Spit reaches every lane, judged on what that lane is judged on: Power in the
     hands, Support on the feet. A Power rule on the feet would have been near-total —
     asserted here rather than assumed, because it is why the rule is split. */
  const feet = Object.keys(E.CARDS).map(n => E.spawn(n)).filter(c => c.lane === 'feet')
  ok(feet.length > 5, 'there are not enough feet cards to test this')
  // the rationale, asserted: Power is the BLUNTER measure on the feet, Support the
  // one that actually tells a smear from a solid edge
  const byPower = feet.filter(c => c.power < E.MOVE_SPIT).length
  const bySupport = feet.filter(c => (c.support ?? 0) < E.MOVE_SPIT_SUPPORT).length
  ok(byPower > bySupport,
    `Power is no blunter than Support on the feet (${byPower} vs ${bySupport} of ${feet.length}) — the split rule is unjustified`)
  ok(bySupport > 0 && bySupport < feet.length,
    `the Support rule spits ${bySupport} of ${feet.length} feet — it does not discriminate`)
  eq(E.spitRejects(E.spawn('Flag'), 2), false, 'a two-Support foot was popped off')
  eq(E.spitRejects(E.spawn('Smear'), 2), true, 'a one-Support smear held on')
  eq(E.spitRejects(null, 0), false, 'an empty lane was spat')
  let spits = 0, onFeet = 0
  const rngS = new E.RNG(11)
  for (let n = 0; n < 20000; n++) {
    const m = E.rollRouteMove({ ...base, boardH: boardFull }, rngS)
    if (m && m.kind === 'spit') { spits++; if (m.lane === 2) onFeet++ }
  }
  ok(spits > 100, `spit only came up ${spits} times, so this is not testing much`)
  ok(onFeet > 0, 'spit never reached the feet lane, so the Support rule is dead')

  // spit throws off anything UNDER the threshold and nothing at or above it
  const weak = E.spawn('Shake Out')            // a rest: power 0
  ok(weak.power < E.MOVE_SPIT, 'the weak fixture is not weak enough to be spat')
  const allCards = Object.keys(E.CARDS).map(n => E.spawn(n))
  const strong = allCards.find(c => c.lane === 'hand' && c.power >= E.MOVE_SPIT)
  ok(strong, 'no hand card is strong enough to survive a spit')
  const spitMove = { kind: 'spit', lane: 0, text: 'x' }
  const gone = E.applyRouteMove(spitMove, [H(1, 5), null, null], [weak, null, null])
  eq(gone.boardP[0], null, 'a card under the threshold was not spat off')
  eq(gone.spat && gone.spat.name, weak.name, 'the spat card was not handed back to be filed')
  const held = E.applyRouteMove(spitMove, [H(1, 5), null, null], [strong, null, null])
  eq(held.boardP[0] && held.boardP[0].name, strong.name, 'a strong card was spat off anyway')
  eq(held.spat, null, 'a card that held on was still filed as spat')
  // exactly at the threshold is safe — the text says UNDER
  const atThresh = { ...weak, power: E.MOVE_SPIT }
  eq(E.applyRouteMove(spitMove, [H(1, 5), null, null], [atThresh, null, null]).spat, null,
    'a card exactly on the threshold was spat')
  /* a rejected card is HANDED BACK, never destroyed. This is a balance requirement,
     not a kindness: moves fire on a timer, so net cost in the move table scales with
     how long a climb takes — and burning the card broke ROUTE-8 outright (guide 55.4
     against direct 49 and traverse 47) and put an archetype on 5%. The cost is the
     lane going unanswered for a turn; it is not the card. */
  const stSpit = { ...base, boardH: [H(1, 5), null, null], boardP: [weak, null, null],
    piles: { draw: [], discard: [], exhaust: [], hand: [] }, routeMove: spitMove }
  const after = E.resolve(stSpit, new E.RNG(3))
  ok(after.piles.hand.some(c => c.name === weak.name), 'a rejected card did not come back to hand')
  eq(after.piles.exhaust.some(c => c.name === weak.name), false, 'a rejected card was burned')
  const settled = after.piles.hand.find(c => c.name === weak.name)
  eq(settled.settled ?? 0, 0, 'a rejected card kept the settle it had earned on the wall')
  // and it is off the wall, so the lane it was in goes unanswered
  eq(after.boardP[0], null, 'a rejected card was still on the wall')

  // PIN denies the shed, and denies the CARD-11 chip with it
  const pinMove = { kind: 'pin', lane: 0, text: 'x' }
  eq(E.applyRouteMove(pinMove, [H(1, 5), null, null], [weak, null, null]).noRestLane, 0,
    'a pin did not pin its lane')
  eq(E.applyRouteMove({ kind: 'grease', lane: 0, text: 'x' }, [H(1, 5), null, null]).noRestLane, -1,
    'a move that is not a pin pinned a lane anyway')
  const restIn = l => ({ ...base, pump: 20,
    boardH: [H(1, 9), H(2, 9), null], boardP: l === 0 ? [weak, null, null] : [null, weak, null] })
  const pinned = E.resolve({ ...restIn(0), routeMove: pinMove }, new E.RNG(3))
  const free = E.resolve({ ...restIn(0), routeMove: null }, new E.RNG(3))
  ok(pinned.pump > free.pump, 'a pinned rest still shed pump')
  // ...but only in the lane it pinned
  const elsewhere = E.resolve({ ...restIn(1), routeMove: pinMove }, new E.RNG(3))
  const elseFree = E.resolve({ ...restIn(1), routeMove: null }, new E.RNG(3))
  eq(elsewhere.pump, elseFree.pump, 'a pin in one lane stopped a rest in another')
  // a pinned rest still breaks flow, exactly as the noRest phases do
  const chip = allCards.find(c => c.restChip)
  ok(chip, 'no card carries restChip, so the chip half cannot be tested')
  const chipSt = l => ({ ...base, boardH: [H(1, 9), null, null], boardP: [chip, null, null] })
  const chipPinned = E.resolve({ ...chipSt(), routeMove: pinMove }, new E.RNG(3))
  const chipFree = E.resolve({ ...chipSt(), routeMove: null }, new E.RNG(3))
  const gripOf = st => (st.boardH[0] ? st.boardH[0].grip : -1)
  ok(gripOf(chipPinned) >= gripOf(chipFree), 'a pinned lane still let the rest chip its hold')

  /* STANCE is the gift, and it has to be a gift that SURVIVES THE TURN. The first
     cut paid a card draw and shipped dead: `refillAndDraw` tops the hand back up to
     HAND_SIZE at the end of every turn, so the extra card was absorbed the same turn
     it arrived and the move did nothing at all. It pays in Support now — spent inside
     the turn, and through `powerAgainst`, which the preview and resolve share. This
     asserts the EFFECT, so a gift that gets absorbed again fails here. */
  const stanceMove = { kind: 'stance', lane: 0, text: 'x' }
  const hand = E.spawn('Crimp Grip')
  const stanceSt = { ...base, boardH: [H(1, 9), null, null], boardP: [hand, null, null] }
  const { s: withSt } = E.afterMove({ ...stanceSt, routeMove: stanceMove })
  const { s: without } = E.afterMove({ ...stanceSt, routeMove: null })
  eq(withSt.stance, true, 'afterMove did not hand the stance to the preview')
  const powSt = E.powerAgainst(withSt, hand, withSt.boardH[0], 0)
  const powNo = E.powerAgainst(without, hand, without.boardH[0], 0)
  ok(powSt > powNo, `a stance was worth no Power at all (${powNo} -> ${powSt}) — it shipped dead`)
  eq(powSt - powNo, E.STANCE_SUPPORT, 'a stance is not worth what STANCE_SUPPORT says')
  // ...and it is not campusing while you have it
  const biteSt = E.biteAgainst(withSt, hand, withSt.boardH[0], 0)
  const biteNo = E.biteAgainst(without, hand, without.boardH[0], 0)
  ok(biteSt < biteNo, 'a stance still counted as campusing')
  // a real foot placement is not double-paid by a stance on top of it
  const footed = { ...stanceSt, boardP: [hand, null, E.spawn('Edge')] }
  const { s: bothFeet } = E.afterMove({ ...footed, routeMove: stanceMove })
  const { s: justFeet } = E.afterMove({ ...footed, routeMove: null })
  eq(E.powerAgainst(bothFeet, hand, bothFeet.boardH[0], 0),
    E.powerAgainst(justFeet, hand, justFeet.boardH[0], 0),
    'a stance paid on top of the feet you had already placed')
  /* The gift pays in Support and Bite, never in a flat pump term. A stance DOES lower
     the pump you take off an unanswered hand hold — that is the Bite pathway every
     weather condition uses (ENG-20 sanctions Bite and Support explicitly), not the
     flat clock relief ENG-23 measured at +7 to +13 and cut. The two are told apart
     here: with nothing on the wall to bite there must be no difference at all, and
     where there IS something to bite the difference must be exactly CAMPUS_BITE and
     no more. */
  const pumpWith = (boardH, move) => E.resolve({ ...base, boardH,
    boardP: [null, null, null], routeMove: move }, new E.RNG(3)).pump
  eq(pumpWith([null, null, null], stanceMove), pumpWith([null, null, null], null),
    'a stance moved the pump with nothing on the wall — that is a flat clock term')
  const unanswered = [H(1, 99), null, null]
  eq(pumpWith(unanswered, null) - pumpWith(unanswered, stanceMove), E.CAMPUS_BITE,
    'a stance is worth something other than exactly the campus bite it cancels')
  const untouched = E.applyRouteMove(stanceMove, [H(1, 5), H(2, 5), H(3, 5)], [weak, null, null])
  eq(untouched.boardH.map(h => h.grip).join(','), '5,5,5', 'a stance changed the stone')
  eq(untouched.boardP[0].name, weak.name, 'a stance changed your board')
  eq(untouched.spat, null, 'a stance spat a card')
  eq(untouched.noRestLane, -1, 'a stance pinned a lane')
  // and it never outlives its turn — it is a transient, not a stored field
  E.saveGame({ ...base, slot: 1, stance: true })
  eq(E.loadGame(1).stance, undefined, 'a stance survived a save')
  eq(E.resolve({ ...base, boardH: [H(1, 9), null, null], boardP: [hand, null, null],
    routeMove: stanceMove }, new E.RNG(3)).stance, undefined, 'a stance outlived the turn it was given')

  // NO MOVE CARRIES A PUMP TERM. The three new branches are read off the source,
  // because "it happens not to add pump today" is what a guard is for.
  const eng = readFileSync('src/engine.ts', 'utf8')
  const fn = region(eng, 'export function applyRouteMove', ['export function afterMove'],
    { min: 600, what: 'applyRouteMove' })
  ok(!/\bpump\b/.test(fn), 'a route move now touches the pump directly')

  // THE PREVIEW AGREES WITH RESOLVE on every kind — the exactness pillar
  const rngP = new E.RNG(97)
  for (const kind of ['grease', 'dry', 'gust', 'crumble', 'spit', 'pin', 'stance']) {
    for (const lane of [0, 1, 2]) {
      const st = { ...base, pump: 14,
        boardH: [H(1, 4), H(2, 6), H(3, 5)],
        boardP: [weak, E.spawn('Crimp Grip'), E.spawn('Edge')],
        piles: { draw: [E.spawn('Lock Off')], discard: [], exhaust: [], hand: [] },
        routeMove: { kind, lane, text: 'x' } }
      const lanes = [0, 1, 2].map(i => E.previewLane(st, i))
      eq(E.previewPump(st, lanes), E.resolve(st, new E.RNG(5)).pump,
        `the preview and resolve disagree on pump after a ${kind} on lane ${lane}`)
      const predicted = lanes.filter(p => p.clears).length
      const got = E.resolve(st, new E.RNG(5)).cleared - st.cleared
      if (!lanes.some(p => p.stick !== undefined)) {
        eq(got, predicted, `the preview mispredicted the clears after a ${kind} on lane ${lane}`)
      }
    }
  }
  // and previewPump computing its own lanes must match previewPump handed them —
  // the move used to be applied twice down that path
  for (const kind of ['grease', 'dry', 'spit', 'pin']) {
    const st = { ...base, pump: 14, boardH: [H(1, 4), H(2, 6), H(3, 5)],
      boardP: [weak, E.spawn('Crimp Grip'), E.spawn('Edge')],
      routeMove: { kind, lane: 0, text: 'x' } }
    eq(E.previewPump(st), E.previewPump(st, [0, 1, 2].map(i => E.previewLane(st, i))),
      `previewPump applies a ${kind} twice when it computes its own lanes`)
  }
  // afterMove hands back a state the move cannot land on again
  const moved = E.afterMove({ ...base, boardH: [H(1, 5), null, null],
    boardP: [null, null, null], routeMove: { kind: 'grease', lane: 0, text: 'x' } })
  eq(moved.s.routeMove, null, 'afterMove left the move set, so it can be applied twice')
  eq(moved.s.boardH[0].grip, 5 + E.MOVE_GRIP, 'afterMove did not apply the move')

  // every kind says what it is about to do, and the gifts are marked as gifts
  const seen = new Map()
  const rngT = new E.RNG(13)
  for (let n = 0; n < 20000; n++) {
    const m = E.rollRouteMove({ ...base, boardH: [H(1, 5), H(2, 5), H(3, 5)] }, rngT)
    if (m && !seen.has(m.kind)) seen.set(m.kind, m.text)
  }
  eq(seen.size, 7, 'not every kind produced a telegraph')
  for (const [k, text] of seen) {
    ok(text && text.length > 12, `${k} does not say what it is about to do: ${text}`)
    ok(/[.!]$/.test(text), `${k}'s telegraph is not a sentence: ${text}`)
  }
  ok(seen.get('spit').includes(String(E.MOVE_SPIT)), 'the spit telegraph does not say what it will spit')
  eq(E.MOVE_GIFTS.slice().sort().join(','), 'dry,stance', 'the gifts are no longer dry and stance')
  for (const k of E.MOVE_GIFTS) ok(seen.has(k), `${k} is called a gift but cannot be rolled`)
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

test('ROUTE-11: the route move reads the weather and rock you are in', () => {
  // rock was inert after build time; now the live condition biases which move
  // comes, so a drizzle-on-sandstone climb and a crisp-on-granite one no longer
  // throw the identical stream. The bias is a trade inside a fixed total, so it
  // stays stream-neutral — that invariant is what keeps the guards off drift.
  const wIdx = n => E.WEATHER.findIndex(w => w.name === n)
  const rIdx = n => E.ROCK.findIndex(r => r.name === n)
  const sum = t => t.reduce((a, b) => a + b, 0)
  // every combination still totals exactly 100 — one draw, like before
  for (let w = 0; w < E.WEATHER.length; w++)
    for (let r = 0; r < E.ROCK.length; r++)
      eq(sum(E.moveWeights({ weather: w, rock: r })), 100,
        `${E.WEATHER[w].name}/${E.ROCK[r].name} weights do not sum to 100`)
  const [g0, d0] = E.moveWeights({ weather: wIdx('still'), rock: rIdx('granite') })
  // seeping air greases: grease climbs, drying dries: dry climbs
  const [gw, dw] = E.moveWeights({ weather: wIdx('drizzle'), rock: rIdx('granite') })
  ok(gw > g0 && dw < d0, 'a seeping day did not lean the move toward greasing')
  const [gc, dc] = E.moveWeights({ weather: wIdx('crisp'), rock: rIdx('granite') })
  ok(gc < g0 && dc > d0, 'a crisp day did not lean the move toward drying out')
  // friable stone flakes; hard stone does not
  const soft = E.moveWeights({ weather: wIdx('still'), rock: rIdx('sandstone') })
  const hard = E.moveWeights({ weather: wIdx('still'), rock: rIdx('granite') })
  ok(soft[3] > hard[3], 'sandstone did not flake more than granite')
  // and it genuinely differs by condition — not a decorative parameter
  ok(JSON.stringify(gw ? [gw, dw] : []) !== JSON.stringify([gc, dc]),
    'wet and crisp produced the same weighting')
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
    /* ROUTE-15: a route owns its feature one of two ways. `signature` REPLACES a hold
       (placeSig, which applies the feature's stats and so is band-active); `sigTag` TAGS
       one that is already there, which moves no number. Both put exactly one named hold
       on the line, and a route with neither must still have none. */
    const owned = r.signature ?? r.sigTag ?? null
    if (!owned) { eq(named.length, 0, `${r.name} has a named hold it was not given`); continue }
    eq(named.length, 1, `${r.name}: ${named.length} of ${owned}`)
    ok(!named[0].crux, `${r.name}: the named hold was written over by a crux`)
    eq(named[0].sig, owned, `${r.name} has the wrong named hold`)
  }
})
test('every signature is real, named and used at most once', () => {
  const used = E.ROUTES.map(r => r.signature).filter(Boolean)
  eq(new Set(used).size, used.length, 'two routes share a named hold')
  for (const id of used) ok(E.sigById(id), `${id} is not a signature`)
  for (const sig of E.SIGNATURES) {
    ok(E.HOLD_STATS[sig.base], `${sig.id} is based on a hold type that does not exist`)
    ok(sig.name.length > 3 && sig.note.length > 20, `${sig.id} has no name or no line`)
    /* ROUTE-15 widened this deliberately, and it is worth saying why rather than just
       doing it. When this was written a signature could only be a REPLACED hold, so
       "does something" could only mean a moved number. ROUTE-12 then answered the
       question properly — a signature is a feature you learn something FROM, and it
       pays a one-time `read` when first worked — and the guard below asserts read > 0
       on every one of them. So a stat-less feature is no longer a name on a hold; it
       is the thing ROUTE-12 says a feature is. The bar is unchanged in substance. */
    const changes = sig.dGrip || sig.dBite || sig.ability || sig.read
    ok(changes, `${sig.id} is just its base hold with a name on it`)
  }
  /* And the converse, which is new and is the part that can actually go wrong: a TAGGED
     feature may not carry stats. The tagger writes `{ ...hold, sig: id }` — it does not
     rebuild the hold from the feature's base — so a dGrip on one of these would be a
     number that silently does nothing, and a reader of the table would believe it. */
  const tagOnly = new Set([...E.ROUTES.map(r => r.sigTag).filter(Boolean), ...E.GEN_SIG_IDS])
  for (const id of tagOnly) {
    const sig = E.sigById(id)
    ok(!sig.ability, `${id} can be tagged onto a hold but carries an ability the tag cannot apply`)
  }
  for (const id of E.ROUTES.map(r => r.sigTag).filter(Boolean)) {
    const sig = E.sigById(id)
    ok(!sig.dGrip && !sig.dBite,
      `${id} is tagged onto a hold, so its dGrip/dBite is a number that never applies`)
    ok(sig.read > 0, `${id} is tagged and stat-less, so a read is the only thing it can do`)
  }
  // a line owns its feature one way or the other, never both, and never twice
  const all = E.ROUTES.flatMap(r => [r.signature, r.sigTag].filter(Boolean))
  eq(new Set(all).size, all.length, 'two routes claim the same named feature')
  for (const r of E.ROUTES)
    ok(!(r.signature && r.sigTag), `${r.name} claims a feature both ways`)
})
test('ROUTE-12: a signature does something, and the grind lines get one too', () => {
  // every signature now pays a one-time read when first worked...
  for (const s of E.SIGNATURES) ok(s.read > 0, `${s.id} still does nothing but sit there`)
  // ...and the pool that may be TAGGED onto a generated line is ability-less and real
  ok(E.GEN_SIG_IDS.length >= 3, 'too few signatures are safe to tag onto a grind line')
  for (const id of E.GEN_SIG_IDS) {
    const s = E.sigById(id)
    ok(s, `${id} is not a signature`); ok(!s.ability, `${id} carries an ability and is not tag-safe`)
  }
  // the read hook fires when a signature is worked, and reads off the wall
  const base = E.freshRun(0, 0, 3)
  const climb = sig => ({ ...base, inRun: true, skirmish: null, phase: 'climb', beta: ['crimp'],
    boardH: [{ uid: 1, name: 'crimp', bite: 3, grip: 1, crux: false, clean: false, ...(sig ? { sig } : {}) }, null, null],
    boardP: [null, null, null], readAhead: 0, cleared: 0, worked: [], turn: 1, order: [],
    holdDeck: Array.from({ length: 8 }, (_, k) => ({ uid: 100 + k, name: 'crimp', bite: 3, grip: 5, crux: false, clean: false })),
    piles: { draw: [], discard: [], exhaust: [], hand: [E.spawn('Crimp Grip')] } })
  const run = st => { let s = E.autoPlay(st, new E.RNG(1)); return E.resolve(s, new E.RNG(1)) }
  const tagged = run(climb('sidewinder')), plain = run(climb(null))
  ok(tagged.log.some(l => /read the next/.test(l)), 'working a signature read nothing off the wall')
  // and it is BAND-NEUTRAL: the only ability-less-tagged difference is information —
  // the clears, the pump and the board come out identical to the untagged hold
  eq(tagged.cleared, plain.cleared, 'the read hook changed how much you cleared')
  eq(tagged.pump, plain.pump, 'the read hook changed the pump')
  eq(JSON.stringify(tagged.boardH.map(h => h && h.grip)), JSON.stringify(plain.boardH.map(h => h && h.grip)),
    'the read hook changed the board')
  // a generated line (the circuit) gets exactly one tagged hold, from the safe
  // pool, and the tag adds no ability — the hold resolves as the plain one it was
  const holds = E.buildRoute({ ...base, inRun: true, weather: 1, rock: 0,
    skirmish: E.circuitRoute(9, new E.RNG(9)) }, new E.RNG(7)).holds
  const tags = holds.filter(h => h.sig)
  eq(tags.length, 1, `a circuit line carried ${tags.length} named features, not one`)
  ok(E.GEN_SIG_IDS.includes(tags[0].sig), 'the circuit tag came from outside the tag-safe pool')
  const natural = E.HOLD_STATS[tags[0].name]?.ability ?? ''
  eq(E.abilityOf(tags[0]), natural, 'the tag put an ability on a hold that had none')
  ok(E.holdLabel(tags[0]) !== tags[0].name, 'the tagged hold shows no feature name')
  // deterministic: the same line names the same feature every time (isolated rng)
  const again = E.buildRoute({ ...base, inRun: true, weather: 1, rock: 0,
    skirmish: E.circuitRoute(9, new E.RNG(9)) }, new E.RNG(7)).holds.find(h => h.sig)
  eq(again.sig, tags[0].sig, 'the same line named a different feature on a replay')
})
test('ROPE-2: The Lost Line is the one route you choose the shape of', () => {
  /* Solo it and it is one push of fifteen holds. Rope it and it is three pitches — and a
     belay is `pump: 0, runout: 0`, which is a large gift on a route whose difficulty IS
     accumulated pump. What pays for it: the rack takes deck slots (ROPE-1's trade), and THE
     HEADWALL SITS ABOVE THE LAST BELAY, so the final third is still one unbroken push with
     `noRest` and the window already shut. That last property falls out of the arithmetic
     rather than being written in, which is exactly why it is asserted here — change
     `pitches` or move the phase and it has to still hold. */
  const f = E.ROUTES.findIndex(r => r.finale)
  ok(f >= 0, 'there is no finale')
  const at = roped => E.specOf({ ...E.freshRun(f, 0, 1), inRun: true, skirmish: null, ropedUp: roped })
  const solo = at(false), rope = at(true)
  // BOTH shapes exist and are actually different
  ok(!solo.roped, 'the finale is roped whether you chose it or not, so there is no choice left')
  ok(rope.roped && (rope.pitches ?? 0) >= 2, 'choosing to rope up does not rope the route')
  /* And it is THE SAME ROUTE otherwise — not an easier variant. Compared field by field so a
     future edit cannot quietly make one of them a different climb. */
  for (const k of ['name', 'grade', 'style', 'clear', 'crux', 'feet'])
    eq(JSON.stringify(rope[k]), JSON.stringify(solo[k]), `roping the finale changed its ${k}`)
  eq(JSON.stringify(rope.phases), JSON.stringify(solo.phases), 'roping the finale changed its phases')
  eq(JSON.stringify(rope.window), JSON.stringify(solo.window), 'roping the finale changed its weather window')

  /* THE PROPERTY THE WHOLE TRADE RESTS ON. */
  const per = rope.clear / rope.pitches
  const lastBelay = per * (rope.pitches - 1)
  const headwall = rope.phases.find(p => p.noRest)
  ok(headwall, 'the finale has no no-rest phase, so there is nothing the belays must not reach')
  ok(Math.ceil(headwall.at * rope.clear) > lastBelay,
    `the last belay (hold ${lastBelay}) is at or above the headwall (hold ${Math.ceil(headwall.at * rope.clear)}) — roping up now buys you a reset on the last push, which is the one thing it must not`)

  /* PER ATTEMPT vs DURABLE, and the difference is not cosmetic: Marge's line is gated on the
     summit page, so it fires on a LATER expedition. My first cut gated her reply on `ropedUp`
     — run state, cleared by `newRun` — which made it unreachable, with a comment claiming the
     opposite. That is NARR-17's lesson, walked into in the same session. */
  const topped = { ...E.freshRun(0, 0, 1), ropedUp: true, ropedFinale: true, journal: [E.SUMMIT_PAGE] }
  const next = { ...E.newRun(9, undefined, 0, 0, []), ...E.carryOver(topped), ...E.modeReset() }
  eq(next.ropedUp, false, 'how you climbed one finale carries into the next expedition, and it should not')
  eq(next.ropedFinale, true, 'the record of roping it does NOT survive, so Marge can never mention it')
  const m7 = E.TALKS.find(t => t.replies.some(r => r.roped))
  ok(m7, 'nobody has anything to say about how you got up')
  const replies = st => E.repliesFor(m7, { ...st, inRun: true, journal: [E.SUMMIT_PAGE], seen: [m7.after] })
  ok(replies(next).length > replies({ ...next, ropedFinale: false }).length,
    'the roped reply is unreachable on the expedition where that conversation actually happens')

  /* NEITHER OPTION PAYS BETTER. The moment one does, the choice stops being about him and
     becomes an optimisation — ROUTE-10, ENG-24 and NARR-12's rule, applied to a decision
     rather than to a line of text. Compared as outcomes, field by field. */
  const roped = m7.replies.find(r => r.roped), plain = m7.replies.find(r => !r.roped && !r.arch)
  eq(JSON.stringify(roped.outcome), JSON.stringify(plain.outcome),
    'roping it and soloing it pay differently, so the decision is an optimisation now')

  /* OFF BAND BY CONSTRUCTION: the harness never ropes it, so the pinned campaign number
     cannot move. `newRun` must default to soloing. */
  eq(E.newRun(5, undefined, 0, 0, []).ropedUp, false,
    'a new run ropes the finale by default, which puts this on the measured band')
})
test('ROPE-2: the rack ROPE-1 built can actually be got', () => {
  /* THREE CARDS CARRY `clip: true` AND NONE OF THEM WAS OBTAINABLE. Quickdraw, Wired Nut and
     Bomber Cam are what ROPE-1's whole decision rests on — "carrying protection costs deck
     slots and speed and insures against catastrophe". They were in no reward pool and no
     starting loadout, default or archetype. Measured: 4,000 act-3 shop stockings offered a
     piece 0.0% of the time. The single exception proves it — the `moraine` event's "Work it
     free" hands over a Wired Nut, which needs a trail node, that event, and that branch.

     Meanwhile the map card tells you "Nothing on your rack. You can lead it, but you will be
     climbing scared", and `coach()` warns you about running it out. The game described a rack
     you could not have.

     SOLD, NOT GIVEN, and that is the measured part. Putting the three into REWARDS moved the
     band 44.3% → 48.0% at n=3000 with act 3 deaths FALLING 33% → 29% — adding a catastrophic
     risk made the campaign easier. The clip is narrow, but `shed 1, draw 1` at cost 0 is free
     value on all thirty-seven lines (compare `Breathe`: cost 0, common, sheds 2, draws
     nothing). So the shelf sells one and cash is the price. */
  const rack = Object.values(E.CARDS).filter(c => c.clip)
  ok(rack.length >= 3, `only ${rack.length} pieces of protection exist`)
  // not free: none of them may sit in a reward pool
  const pools = [...E.REWARDS.common, ...E.REWARDS.uncommon, ...E.REWARDS.rare]
  for (const c of rack)
    ok(!pools.includes(c.name),
      `${c.name} is handed out free again — measured at +3.7 points of completion, because shed-and-draw is not narrow`)
  ok(E.CLIP_STOCK.length >= 2, 'the shelf rotation has collapsed to one piece')
  for (const n of E.CLIP_STOCK)
    ok(E.CARDS[n]?.clip, `${n} is on the protection shelf and is not a piece of protection`)

  /* OBTAINABLE, in the act that needs it and nowhere else — derived from the map, so adding a
     roped line to another act provisions it without anybody remembering to. */
  const ropedActs = E.ACTS.map((a, i) =>
    a.flat().some(n => n.routeIdx >= 0 && E.ROUTES[n.routeIdx]?.roped) ? i : -1).filter(i => i >= 0)
  ok(ropedActs.length >= 1, 'no act has a roped line on it, so this guard is asserting nothing')
  /* DETERMINISM BEFORE ROTATION, because an RNG-drawn piece looks like a shelf that never
     varies when every stocking is handed the same seed — so the rotation assertion fired
     first and named the wrong defect. Picked from the STAGE, not the run RNG: the same rule
     the kit shelf states two lines above it, because drawing from the shared stream shifts
     every downstream roll and moves the balance guards for nothing. Two stockings of one
     stage with DIFFERENT rngs must offer the same piece. */
  const at = seed => E.stockShop({ ...E.freshRun(0, 0, 7), inRun: true, act: ropedActs[0], tier: 1,
    gear: [], boons: [] }, new E.RNG(seed)).shopCards.filter(c => c.clip).map(c => c.name).join()
  eq(at(11), at(9999), 'the piece on the shelf is drawn from the run RNG, which perturbs every roll after it')

  for (const act of [0, 1, 2]) {
    const seen = new Set()
    for (let tier = 0; tier < 4; tier++) {
      const st = E.stockShop({ ...E.freshRun(0, 0, 7), inRun: true, act, tier, gear: [], boons: [] },
        new E.RNG(11))
      const clips = st.shopCards.filter(c => c.clip)
      eq(clips.length, ropedActs.includes(act) ? 1 : 0,
        `act ${act + 1} shop offers ${clips.length} pieces and ${ropedActs.includes(act) ? 'should offer one' : 'has no ropes on it'}`)
      clips.forEach(c => seen.add(c.name))
    }
    // and which piece rotates with the stage, so it is not always the same one
    if (ropedActs.includes(act)) ok(seen.size >= 2,
      `the roped act always sells the same piece (${[...seen].join(', ')}), so the shelf never varies`)
  }

})
test('ROUTE-16: no line is another line wearing a different name', () => {
  /* THE CORNICE AND THE HANGING SLAB WERE THE SAME ROUTE. Identical grade, style, clear,
     crux, feet, roped and pitches — and signatures with identical stats as well
     (`thecornice` and `thehang` are both base sloper, dGrip 3, read 1). Two of the game's
     four roped lines were one line under two names, which made the rope content look twice
     the size it is.

     Found by accident, while baselining ROPE-2: the two reported identical send rates,
     ground-fall rates AND caught-falls-per-session across 600 sessions each on different
     seeds. Three statistics agreeing to three figures is not something sampling does.

     ROUTE-12 already asserts every signature is real, is named, is used at most once, and
     DOES something. All four passed. None of them asks whether two signatures do the SAME
     thing, or whether two routes are the same route — which is the shape of this bug and
     the reason it sat there. */
  const key = r => JSON.stringify([r.grade, r.style, r.clear, r.crux, r.feet,
    !!r.roped, r.pitches ?? 0, !!r.finale, !!r.window, (r.phases ?? []).length, r.dBite ?? 0])
  const byShape = new Map()
  for (const r of E.ROUTES) {
    const k = key(r)
    if (!byShape.has(k)) byShape.set(k, [])
    byShape.get(k).push(r.name)
  }
  /* Two EASY boulders being statistically alike is not the complaint — a V0 and a V1 slab
     will always resemble each other. The complaint is a line with a FEATURE, because that is
     the game promising something specific twice. So the check is scoped to lines carrying
     one: a signature, a rope, a window, phases, or finale billing. */
  const featured = r => r.signature || r.sigTag || r.roped || r.window || (r.phases ?? []).length || r.finale
  for (const [k, names] of byShape) {
    if (names.length < 2) continue
    const rs = E.ROUTES.filter(r => names.includes(r.name))
    if (!rs.some(featured)) continue
    /* A shared shape is still fine if the signatures differ MECHANICALLY. Names and notes
       are not mechanics — that was exactly the fig leaf here. */
    const sigs = rs.map(r => {
      const g = E.sigById(r.signature ?? r.sigTag ?? '')
      return g ? JSON.stringify([g.base, g.dGrip ?? 0, g.read ?? 0, g.dBite ?? 0,
        g.dContact ?? 0, g.crux ?? false]) : 'none'
    })
    ok(new Set(sigs).size === sigs.length,
      `${names.join(' and ')} are the same line with different names — same shape ${k} and signatures that differ only in prose`)
  }

  /* I FIRST WROTE THIS AS "no two signatures may be mechanically identical anywhere", and
     running it showed the rule was over-broad in two different ways rather than finding two
     more bugs.

     `therail` and `thesitdown` are identical and SHOULD be: they are ROUTE-15's `local`
     pool, which pays in information and never in power (`read: 1`, nothing else) exactly so
     that naming a hold cannot move the band. Identical mechanics is the point; the line they
     belong to is what tells them apart.

     `thenave` and `softtouch` are identical too (crimp, dGrip 3, read 2) but they sit on
     routes that are NOT alike — Cathedral Traverse at grade 4 mixed clear 10, The Sandbag at
     grade 3 crimp-ladder clear 11. That is duplicated FLAVOUR, not duplicated gameplay, and
     it is a much smaller thing than two identical lines. Logged rather than asserted.

     So the rule that carries the defect is the one above: two routes of the SAME SHAPE must
     have signatures that differ mechanically. The Cornice and The Hanging Slab failed it;
     these pairs do not. What remains worth stating on its own is only that a `local`
     signature must never grow teeth, because that would be band-active by the back door. */
  for (const g of E.SIGNATURES) if (g.local)
    ok(!(g.dGrip || g.dBite || g.dContact || g.crux),
      `${g.id} is tagged onto generated lines and now moves the numbers, which is band-active by the back door`)

  /* The specific fix, so it cannot quietly revert: The Hanging Slab's own note promises "a
     band of ice that lets go in the afternoon", and it now has the closing window that says
     so. Prose and mechanics agreeing is NARR-20's rule, applied to a route. */
  const hang = E.ROUTES.find(r => r.name === 'The Hanging Slab')
  ok(hang, 'The Hanging Slab is gone')
  ok(hang.window, 'The Hanging Slab promises ice that lets go and no longer has a window that does it')
  ok((hang.window.dSupport ?? 0) < 0, 'the ice band no longer takes the feet, which is what ice over slab does')
  eq(hang.window.dBite, undefined, 'the window sharpens every hold, where the note only promises the feet going')
  // ENG-20's absolute rule, restated where a new window could break it
  for (const r of E.ROUTES) if (r.window)
    eq('dPower' in r.window, false, `${r.name}'s window moves Power, which no condition in this game may ever do`)
})
test('UX-19: the primary action is on the screen without scrolling', () => {
  /* REPORTED FROM A PHONE: on the first-run tutorial, COMMIT could not be reached — the
     teaching banner pushed it off the bottom and the page would not scroll to it.

     Two things were wrong and only one of them was the tutorial.

     The banner costs 75px at NORMAL text and 113px at LARGER, and the climb screen has no
     slack: measured page overflow on the tutorial climb was 8px at 874/NORMAL, 142px at
     740/NORMAL, 107px at 874/LARGE and 252px at 874/LARGER. So on any phone shorter than
     about 870 CSS px, a first-timer is told to press a button that is not on screen.

     And A11Y-5's thumb-reachable COMMIT bar — the thing that was supposed to prevent
     exactly this — HAD NEVER WORKED. It was position:sticky, and a bare sticky-bottom
     control div dropped into the same parent sat at 1170px in an 874px viewport. So
     DEV-1's goal of keeping COMMIT out of the OS gesture strip was never met either.

     The bar is FIXED now, and ungated. Fixed because its position does not depend on
     scroll semantics, on which ancestor is a scroll container, or on the page scrolling at
     all — which is also the only reason this is verifiable: its rect either sits inside the
     viewport or it does not. Ungated because "the primary action must be reachable" is not
     a one-handed preference. */
  const app = readFileSync('src/App.tsx', 'utf8')
  const stripped0 = stripComments(app)
  /* Matched as a whole declaration rather than through a region() anchored on the selector.
     Three of this guard's own injections rewrite that selector, so anchoring on it meant the
     window vanished and GUARD-8's "the opening anchor is gone" fired instead of the
     assertion that names the defect — an anchor must not contain the thing it is testing,
     and I broke that rule three times in one guard. */
  /* THE SELECTOR FIRST, then the declaration — an injection should land on the assertion
     that names its defect, and every one of these rewrites the selector. NOT GATED: the old
     rule was .reach .climb-foot, so the bar only existed for players who had found the
     one-handed setting, and it did not work for them either. */
  const stripped = stripped0
  ok(!/\.reach\s+\.climb-foot\s*\{/.test(stripped),
    'the control bar is behind the one-handed setting again, so most players never get it')
  /* And it must outrank the weather tint, which sets position:relative on every direct child
     of .wrap at (0,2,0). The first cut of this fix used a bare .climb-foot at (0,1,0) and
     computed to relative — the bar did not move at all, and what caught that was a hit-test,
     not a reading. */
  ok(/\.wrap\[class\*="wx-"\]>\.climb-foot/.test(stripped),
    'the rule no longer outranks the weather tint, which sets position:relative on .wrap children')
  const decl = /\.wrap>\.climb-foot\{([^}]*)\}/.exec(stripped0)
  ok(decl, 'the .wrap>.climb-foot rule is gone, so the control bar is styled by something else')
  const rule = decl[1]
  ok(/position:fixed/.test(rule), 'the control bar is not fixed, so it depends on scrolling working')
  ok(!/position:sticky/.test(rule), 'the control bar is sticky again, which never pinned anything in this document')
  // DEV-1: and it stays out of the gesture strip
  ok(/env\(safe-area-inset-bottom\)/.test(rule),
    'the control bar sits in the OS gesture strip again, which is the DEV-1 bug')

  /* Nothing may FOLLOW the bar in flow: it is out of flow now, so anything after it can end
     up underneath it — which the bail row did, on a viewport tall enough not to scroll. */
  const footAt = stripped.indexOf('className="climb-foot"')
  const bailAt = stripped.indexOf('{...tap(bail)}')
  ok(footAt > 0, 'the climb foot has gone')
  ok(bailAt > 0, 'the bail control has gone from the climb screen')
  ok(bailAt < footAt,
    'the bail link is below the fixed control bar again, where it can be covered by it')

  /* The reserve is MEASURED, because the bar grows a second row whenever you carry kit —
     a magic number would be wrong for exactly the players carrying most. */
  const eff = region(stripped, '    const el = footRef.current', ['  useEffect('],
    { min: 120, what: 'the bar measurement' })
  ok(/ResizeObserver/.test(eff), 'the bar height is no longer observed, so the reserve goes stale when it grows')
  ok(/offsetHeight/.test(eff), 'the reserve is a literal again rather than the bar it is reserving for')
  /* The dependency list is INSIDE that window rather than anchored by its own contents, for
     the same reason: the injection that drops `st.kit` would otherwise delete the anchor. */
  ok(/st\.kit/.test(eff), 'the reserve stops re-measuring when kit changes, and kit adds a row to the bar')
})
test('ENG-9: content is content, and every caller still sees one engine', () => {
  /* `engine.ts` was 6,527 lines. The split was tried once (v6.6) and reverted, and the
     stated reason was mechanical import surgery. Two rules make the retry hold, and both
     are asserted here rather than remembered.

     ONE: engine.ts RE-EXPORTS everything it moves out, so nothing that imports from
     './engine' changes — App.tsx and sim/entry.ts were not touched by any of this. The
     moment a caller has to know which file a thing lives in, the split has started costing
     what v6.6 paid.

     TWO: data out, rules stay. `CARDS` is the trap — 346 lines that read like the biggest
     content block in the game and are really `Record<string, CardDef> = {}` filled by a
     loop over `mv(...)` factories. Moving it moves the factories, and then the content file
     holds rules. Same for `TALKS`, whose section is wrapped in five functions that need
     GameState. Both correctly stayed, and this guard fails if either arrives. */
  const eng = readFileSync('src/engine.ts', 'utf8')
  const content = readFileSync('src/content.ts', 'utf8')
  const types = readFileSync('src/types.ts', 'utf8')
  const app = readFileSync('src/App.tsx', 'utf8')
  const barrel = readFileSync('sim/entry.ts', 'utf8')

  // ONE: every caller still sees a single engine
  for (const [what, src] of [['the screens', app], ['the sim barrel', barrel]]) {
    ok(!/from '\.\/content'|from '\.\.\/src\/content'/.test(src),
      `${what} imports content directly, so engine.ts has stopped being the one door`)
    ok(!/from '\.\/types'|from '\.\.\/src\/types'/.test(src),
      `${what} imports types directly, so engine.ts has stopped being the one door`)
  }
  /* And the re-export is real: a name that moved must still be reachable through E, which
     is the only thing the callers actually rely on. */
  for (const n of ['ROUTES', 'EVENTS', 'JOURNAL', 'BOONS', 'MUTATORS', 'WEATHER', 'ROCK', 'ASCENT', 'SEQUENCES'])
    ok(E[n] !== undefined, `${n} moved out and is no longer re-exported, so every caller of it breaks`)

  // TWO: nothing in the content file is a rule
  ok(!/\bexport function\b/.test(content),
    'a function has moved into the content file, which is how a content file becomes a second engine')
  ok(!/=>\s*\{[\s\S]{0,400}\bs\.\w+/.test(content) || !/GameState/.test(content),
    'the content file has started reading GameState, so it is no longer content')
  /* Written as `!A || B` first, and the injection walked straight through it: with a value
     import ADDED ALONGSIDE the type import, both halves were true and the disjunction held.
     An assertion must be sensitive to the thing under test and nothing else, so this counts
     value imports rather than asking whether a type import exists somewhere. */
  const valueImports = [...content.matchAll(/^import\s+(?!type\b)[^\n]*from '\.\/engine'/gm)]
  eq(valueImports.length, 0,
    'the content file imports VALUES from the engine, which is a real import cycle rather than an erased one')
  // the two that must not have come, and the reason each is a rule
  ok(/export const CARDS/.test(eng) && /\bmv\(/.test(eng),
    'CARDS moved to the content file — it is built by factories, so the factories went with it')
  ok(/export const TALKS/.test(eng),
    'TALKS moved to the content file, and its section is five functions that need GameState')
  // types.ts stays leaf: no values, no imports at all
  ok(!/export (const|function)/.test(types), 'a value has moved into the leaf types file')
  ok(!/^import/m.test(types), 'the leaf types file has grown an import, so it is no longer a leaf')
})
test('NARR-20: the events know about him, once you have read him', () => {
  /* Thirty-six events and more words than the journal and the conversations put together —
     the largest body of prose in the game — and only nine of them knew the story existed.
     The biggest thing in the game was narratively inert while the smallest carried the
     whole campaign. Ten events now answer a specific page, and only for somebody carrying
     it. What this guard CANNOT check is whether each line actually answers its page; that
     is a reading, and it is written down in the ticket instead. What it can check is every
     way the mechanism goes wrong. */
  const withLore = E.EVENTS.filter(e => e.lore)
  ok(withLore.length >= 8, `only ${withLore.length} events have anything to say about him`)
  /* AND NOT ALL OF THEM. A world where every rockfall reminds you of a dead man is worse,
     not better — the restraint is the design, so it is asserted rather than trusted. */
  ok(withLore.length < E.EVENTS.length / 2,
    `${withLore.length} of ${E.EVENTS.length} events mention him, which is no longer restraint`)

  const findable = new Set(E.JOURNAL.filter(j => j.id !== E.SUMMIT_PAGE).map(j => j.id))
  const pages = new Set()
  for (const e of withLore) {
    ok(findable.has(e.lore.page),
      `${e.id} answers page ${e.lore.page}, which is not a findable page — the summit page is read after everything`)
    ok(!pages.has(e.lore.page),
      `page ${e.lore.page} is answered by more than one event, so one page is doing all the work`)
    pages.add(e.lore.page)
    ok(e.lore.text.length > 60, `${e.id}'s line is too short to be saying anything`)
    ok(e.lore.text !== e.text, `${e.id} repeats its own text back as a discovery`)
    /* TEXT AND NEVER POWER — ROUTE-10, ENG-24 and NARR-12 all settled this, and it is also
       what makes the whole ticket band-neutral by construction rather than by measurement.
       Checked on the DATA as well as the type, because a stray field is not a type error. */
    eq(e.lore.outcome, undefined, `${e.id}'s line carries an outcome, so narrative has become power`)
    eq(Object.keys(e.lore).sort().join(','), 'page,text', `${e.id}'s line has grown a field beyond page and text`)
  }

  // it appears only for somebody carrying the page, and it is the right line
  const one = withLore[0]
  const blank = { ...E.freshRun(0, 0, 1), journal: [] }
  eq(E.loreFor(one, blank), '', 'the line shows to somebody who has not read the page it answers')
  eq(E.loreFor(one, { ...blank, journal: [one.lore.page] }), one.lore.text,
    'the line does not show to somebody carrying the page it answers')
  eq(E.loreFor(one, { ...blank, journal: [E.SUMMIT_PAGE] }), '',
    'the summit page unlocks lines about pages you have not read')
  const noLore = E.EVENTS.find(e => !e.lore)
  eq(E.loreFor(noLore, { ...blank, journal: [...findable] }), '',
    'an event with nothing to say invents something for a full journal')

  /* THE SCREEN ASKS, and does not work the gate out for itself — the NARR-16 and NARR-17
     shape, twice fixed already. And the engine must never call it: the moment resolution
     reads this, a sentence has become a number. */
  const app = stripComments(readFileSync('src/App.tsx', 'utf8'))
  const eng = stripComments(readFileSync('src/engine.ts', 'utf8'))
  const scr = region(app, "if (st.phase === 'event') {", ['{st.eventResult ?'],
    { min: 200, what: 'the event screen' })
  ok(/loreFor\(ev, st\)/.test(scr), 'the event screen no longer shows his pages at all')
  ok(!/ev\.lore/.test(scr), 'the screen reads the field directly, so it can gate differently from the engine')
  const engCalls = (eng.match(/loreFor\(/g) ?? []).length
  eq(engCalls, 1, `loreFor is called ${engCalls} times inside the engine — it is declared there and must never be USED there, or text has become power`)
  ok(!/lore/.test(region(eng, 'export function applyOutcome', ['\nexport '], { min: 200, what: 'applyOutcome' })),
    'applying an outcome reads the lore, which is the one thing it must never do')
})
test('NARR-19: the conversations are a thread you can read back', () => {
  /* `seen` recorded THAT a conversation happened and nothing whatever about it, and your
     own half was discarded the moment you left the fire. Marge's thread is SEVEN BEATS
     delivered across about six expeditions — days of real time — so an arc arrived as
     seven half-remembered moments with no way to look at it. `said` is the half the game
     was throwing away. */
  const app = stripComments(readFileSync('src/App.tsx', 'utf8'))
  const eng = stripComments(readFileSync('src/engine.ts', 'utf8'))

  /* IT IS WRITTEN WHERE A REPLY IS TAKEN, and it stores the LABEL. An index rots the
     moment a reply is reordered or reworded — and it would rot SILENTLY, showing you a
     sentence you never said, which is worse than showing nothing. */
  const reply = region(app, '                setSt({ ...next, seed: rng.s, talkReply: r.text,',
    ['\n              })'], { min: 80, what: 'taking a reply' })
  /* `/said:/` is NOT the assertion here, though it looks like one: `said: st.said` matches
     it and throws the answer away, which is precisely the bug. The claim is that something
     is recorded AGAINST THIS TALK. Caught by the injection written for this ticket. */
  ok(/\[talk\.id\]:/.test(reply), 'your half of the conversation is thrown away again')
  ok(/r\.label/.test(reply), 'the reply is recorded by something other than its label, which rots when replies move')
  ok(!/indexOf|\bi\b\s*[,}]/.test(reply), 'the reply is recorded by position, so reordering replies rewrites your past')

  /* IT SURVIVES A NEW EXPEDITION. SAVE-7's diff already refuses to let an account field
     go uncarried — and it FIRED on this one, which is the whole reason that guard was
     written as a diff rather than as two field names. This is the behaviour behind it. */
  const acct = { ...E.freshRun(0, 0, 1), said: { marge1: 'I am not a journalist.' }, seen: ['marge1'] }
  const started = { ...E.newRun(9, undefined, 0, 0, []), ...E.carryOver(acct), ...E.modeReset() }
  eq(started.said?.marge1, 'I am not a journalist.',
    'the transcript empties itself every expedition, which is a memory feature losing its memory')

  /* AND IT IS BOUNDED, because it is read straight off disk (SAVE-6). A map needs its own
     clamp — `cap` only knows about arrays — and the count is not the only axis: one 10MB
     value is the same attack as a million short ones. */
  const many = {}
  for (let i = 0; i < 400; i++) many[`k${i}`] = 'x'
  localStorage.setItem('sandbagged.save.9', JSON.stringify(
    { v: E.SAVE_FILE_VERSION, level: 3, said: many }))
  const loadedMany = E.loadGame(9)
  ok(Object.keys(loadedMany.said).length < 400,
    `said is taken at whatever size the file claims (${Object.keys(loadedMany.said).length} keys)`)
  localStorage.setItem('sandbagged.save.9', JSON.stringify({ v: E.SAVE_FILE_VERSION, level: 3,
    said: { ['j'.repeat(500)]: 'y'.repeat(9000), ok: 'fine', bad: 7 } }))
  const loadedBig = E.loadGame(9)
  /* SAVE-6's sharpest lesson was that a crafted field must be DROPPED rather than take the
     whole save down — and this is where that goes wrong quietly: calling `.slice` on a
     number throws, `loadGame` catches, and the entire slot reads as unreadable. Found by
     injecting the removal of the type filter and watching the test crash instead of fail. */
  ok(loadedBig, 'one crafted value in the map takes the whole save down with it, which is SAVE-6 again')
  const [k0] = Object.keys(loadedBig.said).filter(k => k.startsWith('j'))
  ok(k0 === undefined || k0.length < 500, 'a key is taken at whatever length the file claims')
  ok((loadedBig.said[k0 ?? 'ok'] ?? '').length < 9000, 'a value is taken at whatever length the file claims')
  eq(loadedBig.said.bad, undefined, 'a non-string value survives the loader and is rendered as your answer')
  localStorage.setItem('sandbagged.save.9', JSON.stringify({ v: E.SAVE_FILE_VERSION, level: 3, said: 'not a map' }))
  eq(JSON.stringify(E.loadGame(9).said), '{}', 'a non-map where a map belongs is not replaced with one')

  /* THE SCREEN SHOWS BOTH HALVES, grouped by person and in authored order — which is what
     makes it an arc rather than a log, since `after` means the authored order is the only
     order they can happen in. A trip-ordered list would interleave five people. */
  const screen = region(app, "if (st.phase === 'met') {", ['◂ BOOKS'],
    { min: 400, what: 'the transcript' })
  ok(/t\.text/.test(screen), 'the transcript stops showing what they said')
  ok(/st\.said\[t\.id\]/.test(screen), 'the transcript stops showing what you said')
  ok(/TALKS\.filter\(t => t\.who === who/.test(screen),
    'the transcript is no longer grouped by person, so seven beats read as five people interleaved')
  /* Conversations that happened before any of this shipped are in `seen` and absent from
     `said`. Inventing an answer for them would be putting words in the player's mouth. */
  ok(/This was before anyone was writing it down/.test(screen),
    'an old conversation with no recorded answer is rendered without saying so')

  /* ONE COUNTER. The Books entry, the transcript header and this guard must not each
     arrive at their own number — that is exactly the shape NARR-16 came from, and it also
     began as one expression written in two places. */
  ok(/metCount\(st\)/.test(screen), 'the transcript header counts for itself')
  const books = region(app, 'Who You Have Met', ['on={go('], { min: 40, what: 'the Books entry' })
  ok(/metCount\(st\)/.test(books), 'the Books entry counts for itself, so the two can disagree')
  /* Behaviour first, then the shape — an injection should land on the sharper claim, and
     "it counts your own lines as people" says more than "it does not filter TALKS". */
  eq(E.metCount({ ...E.freshRun(0, 0, 1), seen: ['marge1', 'fa:Broken Arete', 'con:Broken Arete'] }), 1,
    'metCount counts conversations about your own lines as people you have met')
  ok(/TALKS\.filter/.test(region(eng, 'export const metCount', ['\n\nexport '], { min: 40, what: 'metCount' })),
    'metCount counts something other than the authored cast')
})
test('NARR-18: the node the campaign lives behind says so', () => {
  /* The trail node read "Something on the trail · ? · No climbing. No telling." and
     nothing else. It was the ONLY node on the map that quoted no numbers — every other
     one sells itself with a grade, a forecast, a price or a pitch count — and it is the
     only route to his pages outside the conversations. Measured over 200 careers: the
     ones that take these nodes reach the `known` ending 51.1% of the time and the ones
     that never take one, 0.0%. Taking them is not a sacrifice either; those careers
     FINISHED more often, 44.7% by trip ten against 37%, because pages become beta.

     THE TWO HALVES OF THIS GUARD PULL AGAINST EACH OTHER ON PURPOSE. The node must say
     enough that the choice is informed, and it must NOT say which event is coming —
     `rollEvent` picks after you commit and the not-knowing is the whole node. A guard
     that only checked the first half would be satisfied by naming the event. */
  const app = stripComments(readFileSync('src/App.tsx', 'utf8'))
  const node = region(app, "\n            if (n.type === 'event') {", ['</div>)'],
    { min: 200, what: 'the trail node' })

  /* TWO BRANCHES, TWO STATES — there is more to find, or you have it all — and the node
     must name his pages in BOTH. `his pages` occurs in each, so an assertion that merely
     FINDS the phrase is satisfied by either one on its own: blank the first branch and a
     `.test()` still passes on the second. That is the repeated-fragment trap, which is the
     single most common way a guard in this project has gone vacuous, and it caught this
     one during its own negative test. Count, do not find. */
  const mentions = (node.match(/his pages/g) ?? []).length
  eq(mentions, 2,
    'the trail node stops naming his pages in one of its two states, so it goes quiet in one of them')
  ok(/pagesHeld\(st\.journal\)/.test(node) && /FINDABLE/.test(node),
    'the node counts his pages itself instead of asking the engine, so it can disagree with the journal')
  // and the mystery survives, because that is the node
  ok(/No telling/.test(node), 'the line that makes it a trail node and not a shop has gone')
  /* Declared here rather than at module scope: `E` is bound by a dynamic import further
     down the file, so reading it up there is a temporal dead zone — the fourth of those
     this project has hit, and the reason SAVE-6 has a comment about it. */
  const named = E.EVENTS.map(e => e.id).filter(id => node.includes(`'${id}'`) || node.includes(`"${id}"`))
  eq(named.length, 0,
    `the node names ${named.join(', ')} before you commit — rollEvent picks after, and the not-knowing is the point`)
  ok(!/eventId|rollEvent/.test(node),
    'the node reaches for which event is coming, which would both spoil it and roll the run stream early')

  /* And the journal screen says what the pages are FOR. It said they keep between runs
     and never once said they are the finale's beta and the ending's threshold — a player
     who does not know that has no reason to walk up a drainage looking for them. Both
     numbers must be READ OFF the functions that impose them: `unreadGrip` is the same
     call the wall makes (NARR-16) and KNOWN_AT is the ending's own threshold, so the
     screen cannot promise a different game from the one it gives you. */
  const screen = region(app, 'Pages of the first ascensionist', ['◂ BOOKS'],
    { min: 200, what: 'the journal screen' })
  ok(/unreadGrip\(st\.journal\)/.test(screen),
    'the journal screen states a Grip cost it worked out itself, so it can differ from the wall')
  ok(/KNOWN_AT/.test(screen),
    'the ending threshold is written as a literal here, and it is derived from the journal length')
  ok(/Grip/.test(screen) && /Lost Line/.test(screen),
    'the journal screen no longer says the pages are beta for the finale')
  ok(!/\b10\b|\bten\b/.test(screen),
    'a hardcoded ten — KNOWN_AT is ceil(FINDABLE * 0.7) and moves when the journal does')
})
test('NARR-17: one rule says whether a conversation is open', () => {
  /* The availability condition was written out TWICE — once in `postTalk` (the counter)
     and once in `availableTalk` (the fire) — four clauses each, by hand. That is one
     divergence away from a conversation that exists at one and not the other, and it is
     the same shape NARR-16 came from: a single rule spelled in two places, waiting for
     somebody to edit one of them. The behaviour is guarded in test.mjs; this guards the
     shape, because the behaviour test only ever walks ONE of the two callers. */
  const eng = stripComments(readFileSync('src/engine.ts', 'utf8'))
  const post = region(eng, 'export function postTalk', ['export function availableTalk'],
    { min: 120, what: 'postTalk' })
  const avail = region(eng, 'export function availableTalk', ['\nexport '],
    { min: 100, what: 'availableTalk' })
  for (const [what, src] of [['the counter', post], ['the fire', avail]]) {
    ok(/talkOpen\(/.test(src), `${what} works out availability for itself again, so the two can disagree`)
    ok(!/needsPages|needsSummit/.test(src),
      `${what} reads a gate field directly, which is how the two copies drifted in the first place`)
  }
  /* And the gates are named for what they mean. `needsPage: 7` was a number that said
     nothing about being at the summit, which is why nobody noticed it was summit-only. */
  ok(!/needsPage\b/.test(eng), 'the old single-page gate is back, and it is what deadlocked the story')
  const decl = declBody(eng, 'export function talkOpen')
  ok(/needsPages/.test(decl) && /needsSummit/.test(decl),
    'talkOpen has stopped checking one of the two gates, so that gate is decoration')
  ok(/pagesHeld\(/.test(decl),
    'talkOpen counts his pages itself instead of asking pagesHeld, which also feeds the wall')
})
test('NARR-16: the finale screen cannot promise what the wall does not honour', () => {
  /* The map card read `{journal.filter(p => p <= 6).length}/6 of his pages` and, at six,
     `you can read the whole thing` — while the engine was counting to fourteen and still
     charging eight Grip a hold at that exact moment. Two hand-rolled counts of the same
     thing, in two files, and NARR-11 moved one of them.

     The behaviour is guarded in test.mjs. THIS guards the shape that let it happen: there
     must be ONE function that says how blind you are, and both the wall and the screen
     must call it. A second hand-rolled page count on either side is the bug returning,
     whatever number it happens to agree with today. */
  const eng = stripComments(readFileSync('src/engine.ts', 'utf8'))
  const app = stripComments(readFileSync('src/App.tsx', 'utf8'))

  // the wall asks the function rather than counting for itself
  const blind = region(eng, '  const unread = spec.finale', ['\n'],
    { min: 30, what: "the finale's blindness" })
  ok(/unreadGrip\(/.test(blind), 'the wall counts pages itself again instead of asking unreadGrip')
  ok(/BLIND_HOLD/.test(blind), "NARR-11's flat cost is no longer named, so it is an unexplained number again")
  ok(!/<=\s*6|journal\.filter/.test(blind),
    'the wall is back to hand-rolling a page count, which is exactly what drifted')

  // and so does the screen. The anchor deliberately stops short of the call itself.
  const card = region(app, '{r.finale ? (() => {', ['})() : null}'],
    { min: 120, what: "the finale's map card" })
  ok(/unreadGrip\(st\.journal\)/.test(card),
    'the map card works out its own blindness again, so it can disagree with the route')
  ok(/FINDABLE/.test(card), 'the card is back to a literal page total, which is the half NARR-11 moved')
  ok(!/\/6\b|<=\s*6/.test(card), 'the card still says six pages, and there are fourteen')

  /* The one thing a source guard cannot see: that the two agree. So ask them. */
  const all = E.JOURNAL.filter(j => j.id !== 7).map(j => j.id)
  ok(E.unreadGrip(all.slice(0, 1)) < E.unreadGrip([]),
    'the FIRST page he wrote buys nothing on the wall, which is the whole reason for the ceiling')
  ok(E.unreadGrip(all) === 0 && E.unreadGrip([]) === E.UNREAD_MAX,
    'the endpoints moved, and the band is pinned on them')
  // and it only ever goes one way: reading more of him can never make the wall worse
  const held = [], ladder = []
  for (const page of all) { held.push(page); ladder.push(E.unreadGrip(held)) }
  ok(ladder.every((v, i) => i === 0 || v <= ladder[i - 1]),
    `finding a page makes the finale HARDER somewhere: ${ladder.join(',')}`)
})
test('SAVE-7: a new expedition carries everything that is yours', () => {
  /* `carryOver`'s own docstring says "Everything that belongs to you rather than to a run.
     A new expedition must carry all of it; hand-copying a subset is how it got lost."
     It was hand-copying a subset, and two things had got lost — sitting directly under
     that sentence for as long as the function existed:

       journal      the game's ONLY meta-progression (NARR-1). Saved and loaded as ACCOUNT
                    state, dropped by carryOver, so starting an expedition reset it to []
                    and the next autosave wrote the empty array to disk. You find about two
                    pages a run; the "known" ending needs ten and the `everypage` deed needs
                    all fourteen — both unreachable in normal play.
       dailyTried   SAVE-4's anti-farm gate: you have had your go today even if you bailed.
                    `dailyDay` was carried and this was not, so starting the daily, coming
                    off it, and starting an expedition made `dailyUsed` read false again.

     Found while auditing NARR-9, which asked for MORE journal pages on the premise that you
     read most of them in one run. You read two, and then lost them.

     THIS GUARD DOES NOT NAME THOSE TWO. It diffs what `saveGame` writes as account state
     against what `carryOver` hands a new run, so the NEXT field added to the save fails
     here rather than going quiet for a year. That is the difference between fixing two
     fields and fixing the thing that lost them. */
  /* BEHAVIOUR FIRST, then the structural rule. A source diff that runs first reports
     "a field is missing" for a bug whose real symptom is "your journal resets", and the
     specific message is the more useful one to land on. */
  const acctState = { ...E.freshRun(0, 0, 1), journal: [1, 2, 3, 4, 5], dailyTried: '2026-08-16', runs: 3 }
  const started = { ...E.newRun(99, undefined, 0, 0, []), ...E.carryOver(acctState), ...E.modeReset() }
  eq(JSON.stringify(started.journal), '[1,2,3,4,5]',
    'the journal does not survive starting an expedition, so the only meta-progression resets')
  /* `eq` on the field, and NOT a follow-up `ok(dailyUsed(...))`: with dailyTried carried
     correctly, dailyUsed is true by construction, so that assertion could never be the one
     that fires. Same vacuous shape SKIRM-8 cut two of. What it was there to say is worth
     saying, so it is said here: the consequence of losing this field is that starting the
     daily, coming off it and starting a trip makes `dailyUsed` read false and SAVE-4's
     one-go rule stops holding. */
  eq(started.dailyTried, '2026-08-16',
    'dailyTried does not survive starting an expedition, so the daily can be retried by starting a trip (SAVE-4)')

  const eng = readFileSync('src/engine.ts', 'utf8')

  const save = region(eng, 'export function saveGame', ['export function loadGame'],
    { min: 400, what: 'saveGame' })
  // account state is everything OUTSIDE the `run:` block — that block is the run's own
  const runAt = save.indexOf('run:')
  ok(runAt > 0, 'saveGame no longer has a run block, so account and run state cannot be told apart')
  const acct = new Set([...save.slice(0, runAt).matchAll(/(\w+):\s*s\.\w+/g)].map(m => m[1]))
  const co = region(eng, 'export function carryOver', ['\n}'], { min: 300, what: 'carryOver' })
  const carried = new Set([...co.matchAll(/(\w+):\s*s\.\w+/g)].map(m => m[1]))

  /* The five that are account state and legitimately NOT carried, each for a stated
     reason. Anything else missing is the SAVE-7 bug happening again. */
  const EXEMPT = {
    arch: 'passed to newRun as an argument, which sets it',
    style: 'passed to newRun as an argument',
    mutators: 'passed to newRun as an argument, and it acts on them while building the run',
    loadout: 'passed to newRun as an argument (as loadouts[arch])',
    challenge: 'a mode flag, and modeReset() clears every one of them on purpose (MODE-1)',
  }
  const missing = [...acct].filter(k => !carried.has(k) && !(k in EXEMPT))
  eq(missing.length, 0,
    `saveGame keeps ${missing.join(', ')} as account state and carryOver does not hand ${
      missing.length === 1 ? 'it' : 'them'} to a new expedition — that is SAVE-7 again`)
  // and the exemptions have to stay true: each must really be an argument to newRun
  const start = region(readFileSync('src/App.tsx', 'utf8'), '    const r = newRun(', ['\n'],
    { min: 30, what: 'the run-start call' })
  for (const k of ['style', 'arch', 'mutators'])
    ok(new RegExp(`st\\.${k}`).test(start), `${k} is exempt because newRun takes it, and it no longer does`)

  /* The pages are worth having, which is the reason any of this matters: the ending reads
     them, and the deed asks for all of them. Neither is reachable if they reset. */
  ok(E.KNOWN_AT > 2, 'the known ending needs more pages than one run finds, which is the point of persisting them')
  ok(E.DEEDS.some(d => d.id === 'everypage'), 'the every-page deed is gone')
})
test('A11Y-10: a screen change announces, on every screen', () => {
  /* A11Y-9 settled the rule that a live region is for what appears while you are already
     on a screen, and left three blocks carrying `role="status"` while being present when
     their screen MOUNTS. Under the rule those look like noise to delete. Deleting them
     would have made the app worse, for a reason that only shows up on inspection:

         the only `.focus()` in App.tsx was the bottom-sheet one.

     Nothing moved focus on a phase change. This is a single-page app, so swapping a whole
     screen is not a navigation — a screen reader announces NOTHING, and the user is left
     with focus where the button they pressed used to be. Those three were not noise; they
     were the only announcement three screens had, and seventeen had none.

     So: fix the gap rather than tidy the symptom. Focus moves to the screen's heading on
     every phase change, which announces the screen and puts a keyboard user at the top of
     it. Every title already carries role=heading aria-level=1 — A11Y-8 asserts there are
     at least twenty and that every one of them does — so it needed no per-screen markup,
     and it makes the three redundant, which is why they came out in the same change. */
  const app = readFileSync('src/App.tsx', 'utf8')
  const code = stripComments(app)

  const eff = region(app, "const h = document.querySelector('[role=\"heading\"][aria-level=\"1\"]')",
    ['  }, ['], { min: 60, what: 'the phase-change focus effect' })
  ok(/h\.focus\(\{ preventScroll: true \}\)/.test(eff), 'the screen change no longer moves focus, so it announces nothing')
  ok(/h\.tabIndex = -1/.test(eff), 'the heading is not made focusable, so focus() is a no-op on a div')
  ok(/\}, \[st\.phase, booted\]\)/.test(code),
    'the focus effect no longer fires on a phase change, or no longer counts leaving the splash as one')

  /* AND THE THREE ARE GONE. Keeping them alongside the heading focus would read the block
     twice — once because focus landed on the screen, once because the region announced. */
  const sess = region(app, "if (st.phase === 'sessionEnd')", ["if (st.phase === '"],
    { min: 800, what: 'the session-end screen' })
  const next = region(app, "if (st.phase === 'circuitNext')", ["if (st.phase === '"],
    { min: 400, what: 'the circuit-next screen' })
  for (const [where, src] of [['session-end', sess], ['circuit-next', next]])
    ok(!/className="spot"[^>]*role="status"/.test(src),
      `a mount-time block on the ${where} screen announces as well as the heading, so it is read twice`)

  /* The in-place ones A11Y-9 added must survive: they appear WITHOUT a phase change, so
     the heading focus never fires for them and a live region is the only thing they have. */
  ok(/role="status" aria-live="polite"/.test(app), 'the in-place live regions went with them')
  ok((app.match(/role="status"/g) ?? []).length >= 6,
    'too few live regions left — the in-place updates A11Y-9 added have gone too')
})
test('PERF-2: the bundle is measured, and the size is pinned', () => {
  /* PERF-2 — "the 190KB question" — asked whether React's weight matters on a mid-range
     phone and called it unmeasured. Measured (v10.35, `npm run perf`), the row's premise
     was stale in both numbers and the answer is no.

       react + react-dom alone   190 KB raw    59 KB gzip
       the whole build           497 KB raw   157 KB gzip
       so the game itself        307 KB raw   ~98 KB gzip

     React is 38% of it, not "most of the bundle", and the game — not React — is what grew.
     Bytes were never the question anyway; what a big bundle costs on a slow CPU is parse,
     compile and first render, so that is what was timed, under Chromium CPU throttling
     (4x ~ mid-tier phone, 6x ~ low end):

       throttle   interactive   first paint   turn repaint
       1x              115 ms        --            20 ms
       4x              378 ms       592 ms         50 ms
       6x              605 ms       832 ms        110 ms

     A mid-tier phone has the game up in about a third of a second and repaints a turn in
     50 ms. React's share of that boot is bounded by its share of the script — call it 90 ms
     on a mid-tier phone — and buying it back means hand-rolling a renderer under four
     thousand lines of App.tsx. THE ANSWER IS THAT IT DOES NOT MATTER, and the question is
     closed rather than left open for somebody to re-ask.

     WHAT IS PINNED is the size, because that answer holds at this size and not at any size.
     The ceiling is generous — roughly a third above today — so it is a tripwire for a
     dependency arriving, not a budget to manage. If it fires, re-run `npm run perf` and
     decide with numbers rather than reverting to the guess this ticket replaced. */
  const raw = readFileSync('docs/index.html')
  const kb = raw.length / 1024
  ok(kb < 700, `the build is ${kb.toFixed(0)} KB raw, past the 700 KB tripwire — re-run \`npm run perf\` before assuming it is fine`)
  ok(kb > 200, `the build is only ${kb.toFixed(0)} KB, which means it is not the whole game`)
  const gz = gzipSync(raw, { level: 9 }).length / 1024
  ok(gz < 230, `the build is ${gz.toFixed(0)} KB gzipped, past the 230 KB tripwire — measure before shipping it`)

  // the measurement has to stay runnable, or the note above is unverifiable
  ok(existsSync('scripts/perf.mjs'), 'the perf measurement is gone, so PERF-2 cannot be re-answered')
  const perf = readFileSync('scripts/perf.mjs', 'utf8')
  /* BOTH sites. The script throttles twice — once for the boot and once, after setup, for
     the turn — and a check for the string anywhere would pass with either one removed,
     which is exactly how you would end up quoting a phone number measured on a desktop. */
  eq((perf.match(/Emulation\.setCPUThrottlingRate/g) ?? []).length, 2,
    'the perf script no longer throttles both measurements, so one of them reports this machine rather than a phone')
  /* Both sweeps again — boot and turn each iterate the rates, and checking for the literal
     anywhere passes with one narrowed. Third time in this ticket that a repeated fragment
     made a single-match assertion vacuous; count when the fragment repeats. */
  eq((perf.match(/\[1, 4, 6\]/g) ?? []).length, 2,
    'the perf script no longer sweeps the throttle rates the answer was measured at')
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  eq(pkg.scripts.perf, 'node scripts/perf.mjs', 'npm run perf is gone')
})
test('SKIRM-9: the circuit ending wears its own furniture', () => {
  /* Found while shipping NARR-15 and logged rather than bundled, because that ticket was
     about who SPEAKS. The run-end screen's subtitle was unconditional:

         {ACT_NAMES[st.act]} · stage {st.tier + 1} · deck {st.runDeck.length}

     A circuit is not a trip. It has no acts and no stages, so on CIRCUIT OVER it read
     "Act 1 · the forest · stage 1" — the act and stage a run happens to have been left on.
     Same class SKIRM-8 caught twice on the walk-off: a route header naming a route you were
     never on, and "Burns used 3/3. Got 6 of 5".

     The circuit's own furniture is its zone, worded exactly as the walk-off words it so the
     mode's two endings read alike. The deck is the one number that means the same thing in
     both modes, so it stays on both. */
  const app = readFileSync('src/App.tsx', 'utf8')
  const end = region(app, "if (st.phase === 'runEnd')", ["if (st.phase === '"],
    { min: 800, what: 'the run-end screen' })
  /* No window anchored on the condition. The first cut took the subtitle with
     `region(end, '<div className="sub">{st.circuit', ...)`, so switching the branch off
     moved the ANCHOR and the window failed before the assertion could — GUARD-8 reported a
     broken guard where the guard was fine and the code was wrong. Same shape A11Y-9 hit.
     An anchor must not contain the thing it is testing. */
  ok(/the circuit · \{circuitZone\(st\.circuitScore\)\.name\.toLowerCase\(\)\}/.test(end),
    'the circuit ending does not name its zone')
  /* the two endings of one mode have to word it the same way, or they read as two features */
  const sess = region(app, "if (st.phase === 'sessionEnd')", ["if (st.phase === '"],
    { min: 800, what: 'the session-end screen' })
  ok(/the circuit · \{zone\.name\.toLowerCase\(\)\}/.test(sess),
    'the walk-off screen no longer words the zone the way the other ending does')
  /* The CONDITION, and then the branch. Asserting only that the branch text exists would
     pass with the whole thing switched off — the words stay in the file either way. */
  ok(/<div className="sub">\{st\.circuit/.test(end),
    'the run-end subtitle no longer tells a circuit from a trip, so it is back to naming an act and a stage it does not have')
  const circuitBranch = region(end, '? <>the circuit', [': <>'],
    { min: 40, what: 'the circuit branch of the run-end subtitle' })
  ok(!/ACT_NAMES/.test(circuitBranch) && !/st\.tier/.test(circuitBranch),
    'the circuit branch names an act or a stage, which a circuit does not have')
  // ...while a trip keeps them, because for a trip they are the right numbers
  ok(/ACT_NAMES\[st\.act\]\} · stage \{st\.tier \+ 1\}/.test(end),
    'the trip ending lost the act and stage it is supposed to show')
})
test('SHIP-3: the site is packageable, and the claims about it are true', () => {
  /* SHIP-3 is packaging rather than porting — one self-contained HTML file with no external
     requests. Everything that does not need a Play account is in the repo; what is left needs
     Evan's account, key and device, and is listed in ship/README.md rather than half-built.
     This guards the parts that can silently rot, and the parts where a document makes a claim
     about the code. */
  const mf = JSON.parse(readFileSync('docs/manifest.webmanifest', 'utf8'))
  /* stripComments, for the fifth time in three tickets: commenting a line OUT leaves its
     text in the file, so a regex for `writeFileSync(join('docs', '.nojekyll')` matches the
     commented-out copy perfectly happily. Two injections written for this very ticket
     walked straight past assertions phrased that way. */
  const gen = stripComments(readFileSync('scripts/build-html.mjs', 'utf8'))
  const app = readFileSync('docs/index.html', 'utf8')

  /* THE SHELL GOES IN ONCE. The PWA injection is not idempotent and fails silently when
     repeated: two manifest links against one `</head>`, and TWO service-worker
     registrations racing each other's controllerchange (DEV-7). Nothing shipped was ever
     affected — `npm run ship` always rebuilds first — but it happened in this working tree
     while iterating on the manifest, which is exactly when somebody runs half a build. */
  eq((app.match(/<link rel="manifest"/g) ?? []).length, 1, 'the PWA head was injected more than once')
  eq((app.match(/serviceWorker\.register/g) ?? []).length, 1,
    'the service worker is registered more than once, so two registrations race the update path')
  /* the CONDITION, not the message. The first cut matched `already carries the PWA shell`,
     which lives in the throw the mutant leaves untouched — so switching the check off with
     `if (false)` sailed past it. Assert the thing that does the work. */
  ok(/html\.includes\('rel="manifest"'\)/.test(gen) && /html\.includes\('serviceWorker\.register'\)/.test(gen),
    'the build no longer refuses to inject the shell twice')

  // 1. Bubblewrap reads the manifest to generate the Android project
  for (const k of ['id', 'name', 'short_name', 'description', 'lang', 'dir', 'categories',
    'start_url', 'scope', 'display', 'orientation', 'background_color', 'theme_color'])
    ok(mf[k] !== undefined && String(mf[k]).length, `the manifest has no ${k}, which Bubblewrap or Play wants`)
  eq(mf.display, 'standalone', 'the app would launch in a browser chrome')
  ok(/^#[0-9a-f]{6}$/i.test(mf.theme_color) && /^#[0-9a-f]{6}$/i.test(mf.background_color),
    'a colour Android has to parse is not a plain hex triple')

  /* 2. THE MASKABLE ICON IS ITS OWN FILE. Android's safe zone is the centred circle of 80%
        diameter and the plain artwork does not fit it — the bottom hold sits ~208px from
        centre against a 205px radius — so relabelling the plain icon as maskable gets it
        shaved by a round launcher mask and loses the contour lines entirely. */
  const mask = mf.icons.filter(i => i.purpose === 'maskable')
  eq(mask.length, 1, `${mask.length} maskable icons declared, not one`)
  const plain = mf.icons.filter(i => i.purpose === 'any').map(i => i.src)
  ok(!plain.includes(mask[0].src),
    'the maskable icon is the plain icon relabelled, so a round mask will crop the artwork')
  ok(/icon-maskable-512\.png[^\n]*purpose: 'maskable'/.test(gen),
    'the build no longer emits a separate maskable icon, so the next build relabels the plain one')
  for (const i of mf.icons) ok(existsSync(`docs/${i.src.replace('./', '')}`), `${i.src} is declared and missing`)
  // ...and it is really the 80% variant, not a copy that happens to have another name
  const a = readFileSync('docs/icon-512.png'), b = readFileSync('docs/' + mask[0].src.replace('./', ''))
  ok(!a.equals(b), 'the maskable icon is byte-identical to the plain one, so it is not a safe-zone variant')

  /* 3. `.nojekyll` IS LOAD-BEARING for this ticket. Pages runs Jekyll without it, and Jekyll
        drops directories beginning with a dot — so `.well-known/assetlinks.json` would 404,
        the TWA would keep its URL bar, and nothing would say why. */
  ok(existsSync('docs/.nojekyll'),
    'docs/.nojekyll is gone, so Pages will run Jekyll and .well-known/assetlinks.json will 404')
  ok(/writeFileSync\(join\('docs', '\.nojekyll'\)/.test(gen),
    'the build no longer emits .nojekyll, so the next build drops it and Pages runs Jekyll')

  /* 4. NEVER A PLACEHOLDER FINGERPRINT. A stub assetlinks.json serves, fails verification
        silently, and leaves a URL bar nobody can explain — worse than having no file. */
  ok(/SANDBAGGED_SHA256/.test(gen), 'the build no longer takes a fingerprint, so assetlinks can never be written')
  ok(/\{31\}/.test(gen) || /([0-9A-F]\{2\}:)/.test(gen), 'the build no longer validates the fingerprint shape')
  ok(/refusing/.test(gen), 'the build no longer refuses a malformed fingerprint')
  if (existsSync('docs/.well-known/assetlinks.json')) {
    const al = JSON.parse(readFileSync('docs/.well-known/assetlinks.json', 'utf8'))
    const fp = al[0]?.target?.sha256_cert_fingerprints?.[0] ?? ''
    ok(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(fp), `assetlinks carries ${JSON.stringify(fp)}, which is not a fingerprint`)
    ok(!/^(AA:|00:|XX)/i.test(fp), 'assetlinks carries a placeholder fingerprint, which fails verification silently')
  }

  /* 5. THE PRIVACY POLICY MUST STAY TRUE. Play requires the URL; the page says the game
        collects nothing and talks to nothing, and that was verified against the BUILT file
        rather than from memory. If the bundle grows a tracker or a remote host, the page
        becomes a false statement on a store listing — so it is asserted, not trusted. */
  ok(existsSync('docs/privacy.html'), 'the privacy policy is gone, and Play requires the URL')
  ok(/writeFileSync\(join\('docs', 'privacy\.html'\), privacy\)/.test(gen),
    'the build no longer emits the privacy policy, so the next build drops the URL Play requires')
  const pv = readFileSync('docs/privacy.html', 'utf8')
  ok(/does not collect, transmit, or share any personal data/.test(pv), 'the policy no longer makes its central claim')
  for (const bad of ['google-analytics', 'googletagmanager', 'gtag(', 'plausible.io', 'sentry.io',
    'mixpanel', 'segment.com', 'facebook.net', 'doubleclick'])
    ok(!app.includes(bad), `the bundle contains ${bad}, and docs/privacy.html tells Play there is no tracking`)
  ok(!/navigator\.sendBeacon/.test(app), 'the bundle can beacon out, and the privacy policy says nothing leaves the device')
  // the only external hosts in the build are React's licence URL and the SVG namespace
  const hosts = [...new Set([...app.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map(m => m[1].toLowerCase()))]
  const allowed = new Set(['www.w3.org', 'react.dev'])
  for (const h of hosts) ok(allowed.has(h), `the build references ${h}; the privacy policy says it talks to nothing`)

  /* 6. THE PACKAGING CONFIG AND THE SITE HAVE TO AGREE, or Bubblewrap generates an app whose
        asset-link check can never pass. */
  ok(existsSync('ship/twa-manifest.json'), 'the Bubblewrap config is gone')
  const twa = JSON.parse(readFileSync('ship/twa-manifest.json', 'utf8'))
  ok(twa.webManifestUrl.endsWith('/manifest.webmanifest'), 'the TWA config points at no web manifest')
  ok(twa.webManifestUrl.includes(twa.host), `the TWA config's host ${twa.host} is not where it reads the manifest from`)
  ok(twa.maskableIconUrl.endsWith(mask[0].src.replace('./', '')),
    'the TWA config and the web manifest name different maskable icons')
  ok(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(twa.packageId), `${twa.packageId} is not a valid Android package id`)
  eq(twa.display, mf.display, 'the TWA and the web manifest disagree about display mode')
  eq(twa.orientation, mf.orientation, 'the TWA and the web manifest disagree about orientation')

  /* 7. A DOCUMENT THAT MAKES A CLAIM ABOUT THE REPO IS CHECKED AGAINST THE REPO. ship/README.md
        tells Evan the keystore is gitignored, and that is exactly the kind of sentence that is
        true when written and false a month later — at the cost of committing a signing key. */
  /* `.gitignore` comments with `#`, and a rule commented out still contains its own text.
     Reading the ACTIVE rules is the difference between guarding the signing key and
     guarding a sentence about it — an injection comments this exact rule out. */
  const rules = readFileSync('.gitignore', 'utf8').split('\n')
    .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  for (const want of ['ship/*.keystore', 'ship/*.jks'])
    ok(rules.includes(want),
      `${want} is not an active gitignore rule, and ship/README.md tells Evan the signing key is ignored`)
  const rd = readFileSync('ship/README.md', 'utf8')
  ok(rd.includes(twa.packageId), 'the checklist and the TWA config name different packages')
  ok(rd.includes('privacy.html'), 'the checklist no longer tells Evan the privacy URL Play asks for')
  ok(/\.nojekyll/.test(rd), 'the checklist no longer records why .nojekyll is load-bearing')
})
test('BAL-13: the act diagnostic measures pressure, not just deaths', () => {
  /* BAL-13 read "act 1 kills ~3% of runs against act 3's 34%" for many versions, and the
     death rate is the wrong number — it says act 1 is not lethal, where the complaint is
     that act 1 is FRICTIONLESS. Measured (v10.33): act 1 puts 4.3% of runs under skin
     pressure against act 2's 30.2%, touches psyche on 0.6% against 11.3%, and takes 0.4 of
     the three camps it offers. You never spend the resources, so no act-1 decision is a
     decision.

     The `acts` mode is what produced that, and the balance ledger pins the numbers. Two
     things about its SHAPE have to hold or the pin is measuring nothing, and both are
     source reads, so they live here rather than behind a ten-minute ledger run. */
  const run = readFileSync('sim/run.mjs', 'utf8')
  ok(/mode === 'acts'/.test(run), 'the acts diagnostic is gone, so BAL-13 cannot be re-measured')
  /* THE TROUGH, NOT THE EXIT. The first cut of this measured state at the act boundary and
     found skin 8.9/9 leaving act 1 — which reads as "act 1 costs nothing" but actually says
     "you can always camp back to full", because the boundary value is post-camp. The
     trough is the number that answers the complaint, and it is a different number: 6.9. */
  ok(/lowSkin/.test(run) && /lowPsyche/.test(run),
    'the acts mode no longer tracks the trough, and the exit state is post-camp — it would say ' +
    '"you can recover" where the question is "were you ever under pressure"')
  ok(/if \(s\.skin < lowSkin\) lowSkin = s\.skin/.test(run), 'the skin trough is not actually being tracked')
  ok(/skin ever <=3|psyche ever <=1/.test(run), 'the acts mode no longer reports a pressure rate')
  /* And it must not be able to change what it measures. The probe reads state inside the
     run loop; if it ever fed a decision, the numbers would be about the probe. */
  const loop = region(run, 'if (s.skin < lowSkin) lowSkin = s.skin', ['\n      if (s.phase ==='],
    { min: 120, what: 'the act-boundary probe' })
  ok(!/\bn =|E\.startBurn|E\.resolve/.test(loop), 'the act probe reaches into the policy, so it measures itself')
})
test('ART-4: the day comes out as a picture, and it says what the text says', () => {
  /* SOCIAL-1 gave the daily a result you can paste anywhere, and what it gave was text.
     An image is what people actually post, and the grid was already a picture with no way
     out of the app.

     THE DELIVERY WAS THE HARD HALF and the backlog row said so. `<a download>` is the
     wrong answer for the device this is played on: iOS has never handled downloading a
     blob from a web app properly, and inside an installed PWA there is nowhere the file
     lands that the player can see. So there is no download link. Two native routes:
     `navigator.share` WITH THE FILE behind `canShare` (a browser can have share() and
     refuse files), and where that is missing, the picture on screen to press and hold —
     which is how a phone saves an image anyway. */
  const app = readFileSync('src/App.tsx', 'utf8')
  const code = stripComments(app)
  ok(!/<a[^>]+download/.test(code) && !/\.download\s*=/.test(code),
    'a download link is back — the one delivery route this ticket ruled out for iOS and installed PWAs')
  ok(/canShare\?\.\(\{ files: \[file\] \}\)/.test(code),
    'the share sheet is called without asking whether it takes files')
  ok(/navigator\.share\(\{ files: \[file\] \}\)/.test(code), 'the file is never handed to the share sheet')
  ok(/Press and hold the picture to save it\./.test(app),
    'the fallback does not tell the player how to save it, which is the whole fallback')

  /* IT LIVES ON THE SCREEN ITS BUTTON IS ON. The first cut put the fallback sheet in the
     climb screen's tree, which returns earlier — so the picture was drawn correctly,
     1080 wide, 142 KB, and had nowhere to appear. Every guard passed, because every guard
     was reading the right source in the wrong component. Only a browser found it. */
  const sess = region(app, "if (st.phase === 'sessionEnd')", ["if (st.phase === '"],
    { min: 800, what: 'the session-end screen' })
  ok(/\{cardUrl \? \(/.test(sess), 'the picture has no way to appear on the screen that makes it')
  ok(/shareImage\(\)/.test(sess), 'the button that makes the picture is not on this screen')
  eq((app.match(/\{cardUrl \? \(/g) ?? []).length, 1,
    'the picture renders from more than one place, so one of them is dead or it draws twice')

  // the object URL is let go of, or a session of shares holds every canvas it ever drew
  ok(/URL\.revokeObjectURL/.test(code), 'the object URL is never revoked')
  ok(/useEffect\(\(\) => \(\) => \{ if \(cardUrl\) URL\.revokeObjectURL\(cardUrl\) \}/.test(code),
    'the last picture is not released when the screen goes')

  /* AND THE PICTURE SAYS WHAT THE PASTE SAYS. Two renderings of one result drift (ENG-19),
     so both read `shareCard` and this asserts they agree — on the grid, which is the part
     a reader compares, and on the numbers beside it. The canvas draws boxes rather than
     the ▪/▫ characters, because a glyph that renders as tofu is a broken IMAGE rather than
     a broken line; the count is what has to match, and it is checked here. */
  const base = { ...E.freshRun(0, 0, 3), daily: true, dailyDay: '2026-08-15', grades: 'v',
    dailyScore: 300, dailyMet: [], dailyStreak: 4, weekScore: 900 }
  for (const [cleared, why] of [[0, 'came off the ground'], [4, 'got partway'], [99, 'topped it out']]) {
    const st = { ...base, cleared }
    const c = E.shareCard(st)
    const text = E.dailyShare(st)
    const line = text.split('\n')[1]
    ok(line.startsWith(c.grid), `the picture and the paste show different grids when you ${why}`)
    eq(c.grid.length, c.clear, `the grid is not one mark per hold when you ${why}`)
    eq([...c.grid].filter(ch => ch === '▪').length, c.holds,
      `the filled marks are not the holds you got when you ${why}`)
    ok(c.holds <= c.clear, `the picture claims more holds than the route has when you ${why}`)
    ok(line.includes(c.grade), 'the grade differs between the picture and the paste')
    ok(text.includes(String(c.score)), 'the score differs between the picture and the paste')
  }
  // the projection is what both read — not two copies of the same arithmetic
  const eng = readFileSync('src/engine.ts', 'utf8')
  const share = declBody(eng, 'export function dailyShare', 'dailyShare')
  ok(/shareCard\(s\)/.test(share), 'dailyShare no longer reads the shared projection at all')
  /* Any `.repeat(`, not the literal mark. Written as `'\u25aa'.repeat(...)` the escape form
     is the same code and slips a test that looks for the character — an injection proved
     it. dailyShare has no other reason to repeat a string, so the broad form is exact. */
  ok(!/\.repeat\(/.test(share), 'dailyShare computes its own grid again, so the two can disagree')

  // nothing here reaches the run: a share is a projection of a result already decided
  const card = declBody(eng, 'export function shareCard', 'shareCard')
  ok(!/\bRNG\b|rng\.|Math\.random/.test(card), 'the share draws from the rng, so looking at it could change a run')
})
test('A11Y-9: a screen reader hears the turn, not the last line of it', () => {
  /* THE ROW SAID "the newest blocks are static divs; consistency, not a break". Reading
     the screens found something worse and narrower. The climb screen has had a
     screen-reader live region since A11Y-2 and it announced ONE line — the last one:

         <div className="vis-hidden" role="status" aria-live="polite">
           {st.log.length ? st.log[st.log.length - 1] : ''}</div>

     A turn writes a MEAN OF 4.8 log lines. Measured over 297 turns of real play: one line
     on 2% of turns, four to six on two thirds of them, nine on one. So a screen-reader
     player was getting about a fifth of what happened — and not a chosen fifth: the last
     line is whatever the engine appended last, which is routinely the route's move for
     NEXT turn or a phase banner rather than the outcome of the move just made. The
     visible log renders `slice(-3)`, so a sighted player was two lines a turn ahead.
     What goes out now is every line added since the last render. No three-line cap: that
     cap is a small screen's space constraint, not a judgement about what matters. */
  const app = readFileSync('src/App.tsx', 'utf8')
  ok(!/\{st\.log\.length \? st\.log\[st\.log\.length - 1\] : ''\}/.test(app),
    'the live region is back to announcing one line of a turn that writes about five')
  const live = region(app, 'const logSeen = useRef(0)', ['  }, [st.log])'],
    { min: 200, what: 'the announcement effect' })
  ok(/st\.log\.slice\(logSeen\.current\)/.test(live),
    'the announcement no longer sends the lines that were added, so it is back to a sample')
  ok(/n < logSeen\.current/.test(live),
    'a new burn empties the log and this would replay the old one from the start')
  ok(/<div className="vis-hidden" role="status" aria-live="polite">\{spoken\}<\/div>/.test(app),
    'the live region does not read what the effect computed')

  /* AND THE BLOCKS THAT ARRIVE WITHOUT A NAVIGATION. That is the rule this ticket settled
     on, rather than "make every static div announce": a live region is for something that
     appears while you are already on the screen. Three qualified and said nothing — the
     sequence banner, the phase-approaching banner, and NARR-15's curse block, which
     appears when you arm TAKE TWO. */
  /* Bounded at the NEXT banner, not at the next arrow function. The first cut closed on
     `{(() => {`, which is two banners further down, so the window swallowed the phase
     banner and passed on the live region belonging to that. */
  const clim = region(app, '{st.seq && seqById(st.seq.id) ? (', ['      {/* NARR-15:'],
    { min: 150, what: 'the sequence banner' })
  ok(/role="status" aria-live="polite"/.test(clim), 'a sequence starts and nothing is announced')
  const near = region(app, 'const nx = st.phase === ', ['      })()}'],
    { min: 200, what: 'the phase-approaching banner' })
  ok(/role="status" aria-live="polite"/.test(near), 'the phase gets closer and nothing is announced')
  const rew = region(app, "if (st.phase === 'reward')", ["if (st.phase === '"],
    { min: 600, what: 'the reward screen' })
  const curse = region(rew, '{two && partnerFor(st) ? (', ['{two ? ('],
    { min: 80, what: 'the curse block' })
  ok(/role="status" aria-live="polite"/.test(curse), 'arming a curse announces nothing')

  /* THE PHASE BANNER IS THE EXCEPTION, AND ON PURPOSE. The phase writes a log line, so the
     region above already reads it — a live region on the banner would say it twice. Its
     partner clause is the one thing there that is NOT in the log and cannot be, because
     NARR-14 keeps them out of `resolve`. So the clause announces and the banner does not. */
  /* Anchored on `{phase ? <div` rather than on the whole opening tag. An anchor that
     contains the very attribute list under test does not fail the assertion when somebody
     adds a role — it fails the WINDOW, which reports a moved anchor instead of the thing
     that is actually wrong. */
  const banner = region(app, '{phase ? <div', ['</div> : null}'],
    { min: 150, what: 'the climb screen phase banner' })
  const open = region(banner, '{phase ? <div', ['>'], { min: 10, what: 'the phase banner opening tag' })
  ok(!/role=/.test(open), 'the phase banner announces the phase, which the log region already read out')
  ok(/role="status" aria-live="polite"/.test(banner),
    "the partner's phase clause is not announced, and it is the one line here the log never carries")

  // a live region has to be reachable to be a live region
  ok(/\.vis-hidden\s*\{/.test(app) || /vis-hidden/.test(app), 'the screen-reader-only class is gone')
})
test('NARR-15: the moments they were standing through in silence', () => {
  /* NARR-14 gave you somebody on the trip and four things to say. SKIRM-7 added two for
     the Circuit. That left five moments the game had already BUILT and walked them
     through without a word — and the first two are the ones that sting:

       WALKED — SKIRM-7 spends the whole circuit having them say go again or that is
         enough, and SKIRM-8 gave walking off its own screen. Nobody joined the two up:
         they pushed you there and then said nothing when you arrived.
       CLAIM — the first-ascent screen's own words are "nothing to compare it to and
         NOBODY TO ASK", and there is somebody standing right there. Having an opinion
         about what you just did is the entire partner mechanic.
       CURSE — taking one on purpose is a decision, on a screen that offers it in as
         many words.
       PHASE — a route changing under you is the loudest thing that happens mid-climb.
       SPENT — the fifth, which the backlog row did not list and reading the screens
         found: the Circuit has TWO endings and both were silent. Walking off goes to
         sessionEnd; running out of skin goes to runEnd, whose partner block was gated
         `!st.circuit`. That gate was RIGHT — `top` and `died` are trip lines, pads
         carried down, next time you go first — but it left the mode's ordinary ending,
         the one most sessions get, with nobody in it at all. */
  const NEW = ['walked', 'claim', 'curse', 'phase', 'spent']
  for (const p of E.PARTNERS)
    for (const m of NEW) {
      const line = p.says[m]
      ok(line && line.length > 20, `${p.name} has nothing to say at ${m}`)
      ok(line !== p.says.send && line !== p.says.fall && line !== p.says.camp,
        `${p.name}'s ${m} is a line they already had somewhere else`)
    }
  // every partner says something different at every moment — a shared line is a stub
  for (const m of NEW)
    eq(new Set(E.PARTNERS.map(p => p.says[m])).size, E.PARTNERS.length,
      `two partners say the same thing at ${m}, so who came out with you does not matter`)
  // and the type knows about them, so a new partner cannot be added missing one
  const eng = readFileSync('src/engine.ts', 'utf8')
  const type = region(eng, 'export type PartnerMoment', ['export type Partner ='],
    { min: 200, what: 'the PartnerMoment type' })
  for (const m of NEW) ok(new RegExp(`'${m}'`).test(type), `${m} is not a PartnerMoment`)

  /* STILL TEXT, AND STILL OUT OF THE RESOLUTION. NARR-14's rule is that a partner the
     resolution can read is a partner somebody can later make matter, and it is guarded
     above. The `phase` line was first written into `resolve`'s log and that guard
     refused it — correctly. It lives on the climb screen's phase banner instead, which
     was already there and is pure render. */
  const app = readFileSync('src/App.tsx', 'utf8')
  const banner = region(app, '{phase ? <div className="spot"', ['</div> : null}'],
    { min: 150, what: 'the climb screen phase banner' })
  ok(/partnerSays\(st, 'phase'\)/.test(banner), 'a route changes under you and nobody remarks on it')
  ok(/partnerFor\(st\) \?/.test(banner), 'the phase line renders with nobody there to say it')

  // the walk-off, read off `result` rather than `circuit` — which is cleared on the way
  // out (MODE-1), exactly as SKIRM-8's own numbers on that screen are
  const sess = region(app, "if (st.phase === 'sessionEnd')", ["if (st.phase === '"],
    { min: 800, what: 'the session-end screen' })
  /* ANCHOR THE GATE ON ITS OPENING BRACE. `/walked && partnerFor\(st\)/` is a SUBSTRING
      of `{false && walked && partnerFor(st)`, so an injection that switches the block off
      by prefixing the condition sailed straight past it. That is the same shape as the
      ROUTE-15 tagger assertion one ticket ago, and `{` is what makes it exact.
      The negative check runs FIRST so that reading a flag which is cleared on the way out
      reports itself rather than being masked by the positive one below. */
  ok(!/\{st\.circuit && partnerFor/.test(sess),
    'the walk-off block reads `circuit`, which is cleared on the way out, so it shows nothing')
  ok(/\{walked && partnerFor\(st\) \?/.test(sess), 'you walk off on their advice and they say nothing')
  ok(/partnerSays\(st, 'walked'\)/.test(sess), 'the walk-off has no word from whoever was there')
  /* AND THEY HAVE TO ACTUALLY BE THERE. The gate above is careful not to read `circuit`,
     which is cleared on the way out — and then calls `partnerFor`, which read it for us,
     so the block rendered nothing at all. A browser is what found that, not this file.
     Asserted behaviourally, on the state the screen is really handed. */
  const off = { ...E.freshRun(0, 0, 3), inRun: false, circuit: null, result: 'walked', runSeed: 12345 }
  ok(E.partnerFor(off), 'nobody is there on the walk-off screen, so its partner block renders nothing')
  ok(E.partnerSays(off, 'walked').length > 20, 'the walk-off line comes back empty')
  // ...and `result` is per-run, so this cannot put somebody on the guidebook (MODE-1)
  eq(E.partnerFor({ ...E.freshRun(0, 0, 3), inRun: false, circuit: null, result: null }), null,
    'a partner is standing on a screen where no run is happening')

  /* THE OTHER HALF OF THE SAME FINDING. Teaching `partnerFor` about the walk-off woke a
     block that had been SILENTLY DEAD on that screen: the send/fall line, which then said
     "Feet. One word, and she is right" on the one ending where you did not fall. It is the
     same class as the two things SKIRM-8 caught here — a per-route line on the one ending
     that is not about a route — and it is gated the same way. */
  ok(/\{!walked && partnerFor\(st\) \?/.test(sess),
    'the send/fall line renders on a walk-off, where nothing was sent and nothing fell')

  // the first ascent — their view, and only their view: the grade is still yours
  const fa = region(app, "if (st.phase === 'claim'", ["if (st.phase === '"],
    { min: 600, what: 'the first-ascent screen' })
  ok(/partnerSays\(st, 'claim'\)/.test(fa), 'the screen says nobody to ask and somebody is standing there')
  const faCode = stripComments(fa)
  ok(!/partner\w*\([^)]*\)[^\n]*c\.grade/.test(faCode) && !/setClaim\([^\n]*partner/.test(faCode),
    'the partner moves the grade — that is power, and the number on this screen is yours')
  /* AND WHICH FA. There are two ways to a first ascent and they are not the same outing:
     the map node keeps the trip's state, so somebody is with you; the menu FA sets
     `inRun: false`, so you went on your own and the block correctly shows nothing. That
     is the same shape as the walk-off bug a few lines up — a block whose visibility hangs
     on a flag set somewhere else entirely — so it is asserted rather than assumed. */
  const trip = { ...E.freshRun(0, 0, 3), inRun: true, phase: 'claim', runSeed: 999 }
  ok(E.partnerFor(trip), 'nobody is there for a first ascent found on a trip')
  ok(E.partnerSays(trip, 'claim').length > 20, 'the first-ascent line comes back empty')
  const solo = { ...E.freshRun(0, 0, 3), inRun: false, circuit: null, result: null, phase: 'claim' }
  eq(E.partnerFor(solo), null, 'somebody turned up to a first ascent you drove out to alone')
  /* All THREE solo modes, counted. The first cut of this tested for the fragment anywhere
     in the file, and the FA, the daily and the challenge all contain it — so removing the
     one it was about left it matching one of the other two. Counting is what makes it
     exact, and it now covers the modes it was not even claiming to. */
  eq((app.match(/skirmish: route, inRun: false/g) ?? []).length, 3,
    'one of the solo modes stopped saying you went out on your own, so a partner appears out of nowhere')

  // the curse, while it is still a decision rather than a comment on one
  const rew = region(app, "if (st.phase === 'reward')", ["if (st.phase === '"],
    { min: 600, what: 'the reward screen' })
  ok(/\{two && partnerFor\(st\) \?/.test(rew), 'they have no view on taking a curse on purpose')
  ok(/partnerSays\(st, 'curse'\)/.test(rew), 'the curse has no word from whoever was there')

  /* AND THE ONE PLACE THEY MUST STAY SILENT. `partnerFor` returns null unless you are on
     a trip or in the circuit, so a skirmish and the daily have nobody — that is the
     point, they are one boulder on your own. Asserted rather than assumed, because
     every new moment above is a new chance to render an empty block. */
  const alone = { ...E.freshRun(0, 0, 3), inRun: false, circuit: null }
  eq(E.partnerFor(alone), null, 'somebody turned up to a boulder you went to on your own')
  for (const m of NEW) eq(E.partnerSays(alone, m), '', `${m} says something with nobody there`)
})
test('ROUTE-15: the first lines in the book have a feature too', () => {
  /* ROUTE-5 added named features to kill the sameness of "a route is a stat line", and it
     left the FIRST FOUR LINES IN THE BOOK without one — the four you meet before you meet
     anything else. Thirty-one of thirty-seven had a feature; the six that did not were the
     four earliest, the tutorial and the finale.

     They are TAGGED, not placed. `signature` runs placeSig, which rebuilds the hold from the
     feature's base type and applies its stats — band-active, and not something to do to the
     four routes a new player learns on. `sigTag` writes `{ ...hold, sig: id }` onto a hold
     that is already there, from an RNG keyed to the route rather than the run, so it moves
     no number and consumes no run entropy. What the feature DOES is ROUTE-12's answer: it
     pays a one-time read. Information is free — the resolution never consults readAhead —
     and on the four earliest lines it is the read mechanic teaching itself at the point
     where you own the fewest cards that can do it.

     TWO CARVE-OUTS, both from content rather than convenience:
       the TUTORIAL is authored hold by hold (`spec.holds`) to teach one thing at a time, and
       a named feature in the middle of that is a second thing;
       THE LOST LINE's own note is "No chalk. No tick marks. No trail. Exactly as he left
       it." A named feature means people have been there and talked about it, which is the
       one thing that route is about not being. ROUTE-13 almost certainly left it out for
       exactly this reason. */
  const byTag = E.ROUTES.filter(r => r.sigTag)
  eq(byTag.length, 4, `${byTag.length} lines carry a tagged feature, not the four earliest`)
  for (const r of byTag) ok(r.grade <= 2, `${r.name} is not one of the early lines this was for`)

  // nothing else in the book is bare, and the two that are say why in their own flags
  const bare = E.ROUTES.filter(r => !r.signature && !r.sigTag)
  eq(bare.length, 2, `${bare.length} lines have no named feature: ${bare.map(r => r.name).join(', ')}`)
  for (const r of bare)
    ok(r.tutorial || r.finale, `${r.name} has no named feature and no reason not to`)

  /* IT LANDS. A tag needs a hold of the feature's base type on the line and the line is
     rolled, so this is the assertion that matters — every route, over many seeds, not one. */
  for (const r of byTag) {
    for (let seed = 0; seed < 40; seed++) {
      const st = E.startBurn({ ...E.freshRun(E.ROUTES.indexOf(r), 0, 5), inRun: true,
        skirmish: null, weather: 1, rock: 0, runDeck: E.DEFAULT_LOADOUT.map(E.spawn) }, new E.RNG(seed))
      const all = [...st.holdDeck, ...st.boardH.filter(Boolean)]
      const named = all.filter(h => h.sig)
      eq(named.length, 1, `${r.name} on seed ${seed}: ${named.length} named holds`)
      eq(named[0].sig, r.sigTag, `${r.name} on seed ${seed} named the wrong feature`)
      // the tag put nothing on the hold but the name: it resolves as what it already was
      eq(E.abilityOf(named[0]), E.HOLD_STATS[named[0].name]?.ability ?? '',
        `${r.name}: the tag changed what the hold does`)
      ok(E.holdLabel(named[0]) !== named[0].name, `${r.name}: the tagged hold shows no feature name`)
    }
  }

  /* A TAGGED FEATURE MAY NOT NAME A POSITION. The holds are shuffled, so the tag lands
     anywhere on the line — "you start from the floor" was the first draft of The Sit-Down
     and reads wrong four moves up. The route's own name carries where it is; the feature
     only has to be a hold on it. (The render is what caught this, not the code.) */
  for (const r of byTag) {
    const note = E.sigById(r.sigTag).note
    ok(!/\b(start|starts|first move|off the ground|top out|last hold|finish)\b/i.test(note),
      `${r.sigTag} names a position, and the tag lands on a shuffled hold: "${note}"`)
  }

  /* BAND-NEUTRAL BY CONSTRUCTION, which is a source claim because it is a claim about how
     the tag is applied rather than about any one outcome: a spread that adds `sig` and
     nothing else, off an RNG that is not the run's. */
  const eng = readFileSync('src/engine.ts', 'utf8')
  const tagger = region(eng, '  /* ROUTE-15: a scripted line can name its own feature',
    ['  const fp = FEET_POOLS'], { min: 400, what: 'the ROUTE-15 tagger' })
  const code = stripComments(tagger)
  /* EVERY write, not just one of them. The tagger writes to `holds[at]` twice — the
     preferred base type and the fallback — and an assertion that only wanted to see one
     spread anywhere passed with the first site rebuilt, which an injection caught. */
  const writes = code.match(/holds\[at\] = [^\n]*/g) ?? []
  eq(writes.length, 2, 'the tagger writes to the hold list a different number of times than it did')
  for (const w of writes)
    ok(/= \{ \.\.\.holds\[at\], sig: \w+ \}/.test(w),
      `the tagger no longer spreads the existing hold, so tagging can move a number: ${w.trim()}`)
  ok(!/nextUid\(/.test(code), 'the tagger builds a new hold now — that is placeSig, and it is band-active')
  ok(/sigRng/.test(code) && !/\brng\./.test(code),
    'the tagger draws from the run rng, so naming a feature would shift every roll after it')

  /* THE FOUR ARE LOCAL. Their notes name a specific place or a specific moment — "you start
     from the floor" is a start — so unlike the rest of the pool they are never tagged onto a
     generated circuit line. Keeping them out also leaves GEN_SIG_IDS byte-identical, so the
     circuit names the same feature it did before this ticket. */
  for (const r of byTag) {
    ok(E.sigById(r.sigTag).local, `${r.sigTag} is not marked local and can land on a circuit line`)
    ok(!E.GEN_SIG_IDS.includes(r.sigTag), `${r.sigTag} is in the generated pool`)
  }

  // and the book shows it: the guidebook reads a tagged feature the same as a placed one
  const app = readFileSync('src/App.tsx', 'utf8')
  ok(/sigById\(r\.signature \?\? r\.sigTag \?\? ''\)/.test(app),
    'the guidebook only knows about placed features, so four lines read as unnamed')
})
test('CARD-11: a rest can pose a decision — where you rest chips that lane', () => {
  const c = E.CARDS['Chalk the Hold']
  ok(c, 'the deciding rest is gone')
  ok(c.shed > 0, 'it does not rest'); ok(c.restChip > 0, 'it chips nothing')
  // it trades recovery for the chip — sheds less than a plain full rest
  ok(c.shed < 3, 'it is a strict upgrade on a plain rest, not a trade')
  // resolve, comparing against a restChip-neutered clone of the SAME spawned
  // card — baseline-independent, so it measures ONLY the chip. (The old version
  // asserted an absolute grip that coincidentally matched the un-chipped
  // baseline, which is how the fact that `spawn` dropped restChip went unseen.)
  const H = (uid, grip) => ({ uid, name: 'crimp', bite: 3, grip, crux: false, clean: false })
  const play = card => {
    const s = { ...E.freshRun(0, 0, 5), inRun: true, skirmish: null, phase: 'climb', beta: ['crimp'],
      boardH: [H(1, 8), H(2, 8), null], boardP: [card, null, null], holdDeck: [], feetDeck: [], readAhead: 0,
      piles: { draw: [], discard: [], exhaust: [], hand: [] }, cleared: 0, worked: [], turn: 1, order: [] }
    return E.resolve(s, new E.RNG(1)).boardH
  }
  const chip = c.restChip
  // the card as it comes off spawn (the real deck path) must carry the chip —
  // this is what catches the field being dropped in spawn/makeDeck
  const real = play(E.spawn('Chalk the Hold'))
  const ctrl = play({ ...E.spawn('Chalk the Hold'), restChip: 0 })
  eq(real[0].grip, ctrl[0].grip - chip, 'a spawned Chalk the Hold does not chip its lane — restChip was dropped')
  eq(real[1].grip, ctrl[1].grip, 'the rest chipped a lane it was not on')
})
test('CARD-13: a curse does something — it sharpens the hold you dump it on', () => {
  // curses are no longer inert dead weight: at least one carries an active hex,
  // and every hex card is a curse (the effect must not leak onto a real card)
  const hexed = Object.values(E.CARDS).filter(c => c.hex)
  ok(hexed.length >= 1, 'no curse does anything — they are all still dead weight')
  for (const c of hexed) eq(c.rarity, 'curse', `${c.name} carries a hex but is not a curse`)
  // resolve: dump the curse on a lane and compare against a hex-neutered clone of
  // the SAME card — timing-independent, so it isolates exactly the hex's effect
  const H = (uid, grip) => ({ uid, name: 'crimp', bite: 3, grip, crux: false, clean: false })
  const curse = hexed[0]
  const play = card => {
    const s = { ...E.freshRun(0, 0, 5), inRun: true, skirmish: null, phase: 'climb', beta: ['crimp'],
      boardH: [H(1, 8), H(2, 8), null], boardP: [card, null, null], holdDeck: [], feetDeck: [], readAhead: 0,
      piles: { draw: [], discard: [], exhaust: [], hand: [] }, cleared: 0, worked: [], turn: 1, order: [] }
    return E.resolve(s, new E.RNG(1)).boardH
  }
  const hexed0 = play(E.spawn(curse.name))
  const ctrl = play({ ...E.spawn(curse.name), hex: 0 })
  ok(hexed0[0] && ctrl[0], 'the curse cleared the hold it should have been too weak for')
  eq(hexed0[0].grip - ctrl[0].grip, curse.hex, 'the hex did not sharpen its lane by exactly its hex')
  eq(hexed0[1].grip, ctrl[1].grip, 'the hex reached a lane the curse was not on')
  // and it is a real DOWNSIDE — a hex only ever raises grip, never lowers it
  ok(curse.hex > 0, 'a hex that helps you is not a curse')
})
test('CARD-16: no move-curse is inert — every one sharpens the hold it lands on', () => {
  /* The fourth audit found 7 of 10 curses did nothing beyond being a weak card.
     The three that had slipped through CARD-13 — Tweaked Pulley, Tweaky Finger,
     Cold Shut — now carry the same hex, so EVERY curse you can place on a lane
     costs a position, not just a draw. (The four bonus curses are a documented
     carve-out: an active effect there needs a per-turn or opening-hand hook that
     risks the pump-compounding trap the ledger forbids — deferred, not forgotten.) */
  const moveCurses = Object.values(E.CARDS).filter(c => c.rarity === 'curse' && c.kind === 'move')
  ok(moveCurses.length >= 5, `only ${moveCurses.length} move curses to check`)
  for (const c of moveCurses)
    ok(c.hex > 0, `${c.name} is an inert move-curse — it does nothing to the hold it lands on`)
})
test('CARD-12: the singleton effects have draftable breadth now', () => {
  // snap / peel / cycle were carried by exactly one card each; each identity now
  // has at least two, and the siblings are genuinely different cards, not clones
  for (const fx of ['snap', 'peel', 'cycle']) {
    const cards = Object.values(E.CARDS).filter(c => c.fx === fx)
    ok(cards.length >= 2, `only ${cards.length} card carries ${fx}`)
    const shapes = new Set(cards.map(c => `${c.power}/${c.contact}`))
    eq(shapes.size, cards.length, `two ${fx} cards share a stat line — that is a reskin, not breadth`)
    // and every one is a real, costed move that a deck can draw (not a curse)
    for (const c of cards) { ok(c.kind === 'move', `a ${fx} card is not a move`); ok(c.rarity !== 'curse', `a ${fx} card is a curse`) }
  }
  // the siblings come off spawn carrying their fx (the field spawn nearly dropped)
  for (const name of ['Pounce', 'Bail Out', 'Latch And Look']) {
    const c = E.CARDS[name]; ok(c, `${name} is gone`)
    eq(E.spawn(name).fx, c.fx, `${name} lost its effect on spawn`)
  }
})
test('CARD-18: the four mechanics nobody could meet twice', () => {
  /* skinCost, read, latch and restChip were each carried by exactly ONE card of 244.
     That is not a small pool — it is a mechanic the game has and a player will almost
     certainly never see, which is CARD-12's pattern and CARD-17's failure mode. Each
     has a sibling now, and each sibling is a different card rather than a reskin. */
  const MECH = {
    skinCost: ['The Whole Trip', 'Last Of The Skin'],
    read: ['Sight the Line', 'Take It All In'],
    latch: ['Iron Fingers', 'Rand Smear'],
    restChip: ['Chalk the Hold', 'Milk The Jug'],
  }
  for (const [field, names] of Object.entries(MECH)) {
    const carry = Object.entries(E.CARDS).filter(([, c]) => c[field])
    ok(carry.length >= 2, `only ${carry.length} card of ${Object.keys(E.CARDS).length} carries ${field}`)
    for (const n of names) {
      ok(E.CARDS[n], `${n} is gone`)
      ok(E.CARDS[n][field], `${n} no longer carries ${field}`)
      // the CARD-11/CARD-13 trap: the field must survive spawn or it is dead in play
      eq(E.spawn(n)[field], E.CARDS[n][field], `spawn dropped ${field} on ${n}`)
    }
    // and the pair must not be one card twice
    const shapes = new Set(names.map(n => {
      const c = E.CARDS[n]
      return `${c.power ?? 0}/${c.contact ?? 0}/${c.cost ?? 0}/${c.lane ?? 'hand'}/${c[field]}`
    }))
    eq(shapes.size, names.length, `the two ${field} cards are the same card twice`)
  }

  /* NO STRICT UPGRADES. Two of the four shipped as one in the first cut — Milk The Jug
     was Shake Out with a free chip and Rand Smear was Precise Feet's exact stat line
     with a free latch — which is the thing CARD-11's own guard forbids for its card.
     A general dominance scan was tried and abandoned: it reports 2,759 pairs across the
     table, because a higher rarity is SUPPOSED to dominate and two different `fx`
     values are not comparable. So the trade is asserted against the specific neighbour
     each card was measured against. */
  const c = n => E.CARDS[n]
  // vs a plain starter rest at the same contact and shed: it pays with the anchor
  eq(c('Milk The Jug').contact, c('Shake Out').contact, 'the rest comparison moved')
  eq(c('Milk The Jug').shed, c('Shake Out').shed, 'the rest comparison moved')
  ok(c('Shake Out').anchor && !c('Milk The Jug').anchor,
    'Milk The Jug is Shake Out plus a free chip — the chip has to cost something')
  // vs the common feet card at the same Support: it pays with a point of Contact
  eq(c('Rand Smear').support, c('Precise Feet').support, 'the feet comparison moved')
  ok(c('Rand Smear').contact < c('Precise Feet').contact,
    'Rand Smear is a common plus a free latch')
  // the read pair trade information depth against what they hand back
  ok(c('Take It All In').read > c('Sight the Line').read, 'the deeper read does not read deeper')
  ok(!c('Take It All In').draw && c('Sight the Line').draw > 0,
    'the deeper read also draws, so it is a strict upgrade')
  ok(c('Take It All In').cost > c('Sight the Line').cost, 'the deeper read is free')
  // and skin buys the clock at uncommon where it used to buy Power at rare
  ok(c('Last Of The Skin').shed > 0 && !c('Last Of The Skin').powerAll,
    'both skin cards buy the same thing')
  eq(c('Last Of The Skin').cost, 0, 'the skin card charges pump as well as skin')

  /* BEHAVIOUR, each against a control, because "it is in the table" is what CARD-11
     and CARD-13 both looked like while shipping dead. */
  const s0 = E.startBurn({ ...E.freshRun(4, 0, 5), inRun: true, skirmish: null, phase: 'climb' },
    new E.RNG(11))
  const H = (uid, grip) => ({ uid, name: 'crimp', bite: 2, grip, crux: false, clean: false })
  const F = (uid, bite, grip) => ({ uid, name: 'ledge', bite, grip, crux: false, clean: false })

  // restChip: exactly its own amount, in the lane it rests in, and nowhere else
  for (const name of MECH.restChip) {
    const card = E.spawn(name)
    const out = E.resolve({ ...s0, pump: 10, boardH: [H(1, 6), H(2, 6), null],
      boardP: [card, null, null] }, new E.RNG(5))
    eq(out.boardH[0].grip, 6 - card.restChip, `${name} did not chip the hold it rested under`)
    eq(out.boardH[1].grip, 6, `${name} chipped a lane it was not resting in`)
  }

  // latch: it holds where an identical-Contact card without it comes off, and once only
  const foot = E.spawn('Rand Smear')
  const plain = E.spawn('Flag')
  eq(plain.support, foot.support, 'the latch control no longer matches on Support')
  const bite = foot.contact + 2                       // enough to blow either of them
  const play = card => E.resolve({ ...s0, pump: 6, boardH: [H(1, 3), null, F(3, bite, 4)],
    boardP: [E.spawn('Lock Off'), null, card] }, new E.RNG(7))
  const latched = play(foot), blew = play(plain)
  ok(latched.boardP[2], 'the latching foot came off on its first blow')
  eq(latched.boardP[2].contact, 1, 'a latch holds on at something other than 1 Contact')
  ok(latched.boardP[2].latched, 'the latch is not marked, so it can save the same card for ever')
  ok(!blew.boardP[2], 'the control foot survived, so this proves nothing about latch')
  ok(E.supportNow(latched) > E.supportNow(blew),
    'latching the foot bought no Support, which is the whole reason it is on a foot')
  ok(!E.resolve({ ...latched, pump: 6 }, new E.RNG(7)).boardP[2], 'a latch saves more than once')

  // read: it raises readAhead by what it says, and pays what it says
  for (const name of MECH.read) {
    const card = E.spawn(name)
    const out = E.playBonusStep({ ...s0, pump: 8 }, card, 0, new E.RNG(3))
    eq(out.readAhead, Math.min(s0.holdDeck.length, card.read), `${name} read a different depth`)
    eq(out.pump, 8 + card.cost, `${name} did not cost what it says`)
  }
  /* and reading is INFORMATION (RUN-9/ENG-24), which is what makes it band-safe and
     what makes `read` situational in the dead-card guard. Asserted behaviourally, not
     by grepping resolve for `readAhead`: resolve legitimately WRITES it — a signature
     hold can grant a read (ROUTE-12) and being dialed in grants one (ENG-24) — so the
     property is that no outcome depends on it. Two states differing only in how far
     you have read must resolve identically. */
  const seen = { ...s0, pump: 9, boardH: [H(1, 5), H(2, 4), F(3, 3, 4)],
    boardP: [E.spawn('Lock Off'), E.spawn('Crimp Grip'), E.spawn('Flag')] }
  const outcome = st => {
    const r = E.resolve(st, new E.RNG(21))
    return JSON.stringify({ pump: r.pump, cleared: r.cleared, skin: r.skin, psyche: r.psyche,
      flow: r.flow, boardH: r.boardH, boardP: r.boardP, piles: r.piles, turn: r.turn })
  }
  eq(outcome({ ...seen, readAhead: 4 }), outcome({ ...seen, readAhead: 0 }),
    'a turn resolves differently depending on how far you have read — reading is a power now')

  // skinCost: it takes the skin and pays out
  for (const name of MECH.skinCost) {
    const card = E.spawn(name)
    const out = E.playBonusStep({ ...s0, pump: 12, skin: 4 }, card, 0, new E.RNG(3))
    eq(out.skin, 4 - card.skinCost, `${name} did not charge the skin it says it does`)
  }

  /* OFF-BAND BY CONSTRUCTION, asserted rather than argued. The in-run offer pool is
     REWARDS, and the harness's built loadout is stat-sorted over the moves and feet —
     bonuses cannot enter it at all. None of the four is in REWARDS, so no offer roll
     changes. What DOES change is `BY_RARITY('uncommon').length`, which three event
     outcomes draw against, and that is the whole of the measured +0.9 (see the ledger).
     A later change that puts one of these in REWARDS moves the band, so it trips here
     first and gets measured on purpose. */
  const inRewards = Object.values(MECH).flat()
    .filter(n => Object.values(E.REWARDS).some(list => list.includes(n)) && n !== 'Iron Fingers')
  eq(inRewards.length, 0,
    `${inRewards.join(', ')} joined the in-run reward pool — that is a band change, measure it`)
  // but they must be reachable SOMEWHERE, or this is breadth nobody can meet
  for (const n of Object.values(MECH).flat())
    ok(E.BY_RARITY(E.CARDS[n].rarity).includes(n), `${n} is in no pool at all`)

  /* And the drafter can see restChip now — it had no term, so a chipping rest was
     scored on its shed alone and BOTH restChip cards read below the take-it line. */
  const deck = E.DEFAULT_LOADOUT.map(E.spawn)
  const st = { ...E.freshRun(0, 0, 3), inRun: true, skirmish: null, runDeck: deck,
    boons: [], gear: [], mutators: [] }
  const val = n => E.cardValue(st, E.spawn(n), deck)
  for (const n of MECH.restChip) {
    const bare = E.spawn(n)
    ok(val(n) > E.cardValue(st, { ...bare, restChip: 0 }, deck),
      `the drafter prices ${n} the same with and without its chip`)
  }
  ok(val('Chalk the Hold') > val('Milk The Jug'),
    'the bigger chip is not worth more to the drafter than the smaller one')

  // both new mechanics are named in the game, not just carried by a card
  const kw = new Map(E.KEYWORDS.map(k => [k.name, k.text]))
  ok(/route deck|next holds/i.test(kw.get('Reading ahead') ?? ''), 'reading ahead is unexplained')
  ok(/never/i.test(kw.get('Reading ahead') ?? ''),
    'the reading-ahead entry does not say it changes nothing about the hold')
  ok(/fall|camp/i.test(kw.get('Skin') ?? ''), 'skin is unexplained')
})
test('spawn carries every field a card defines — no effect silently dropped', () => {
  // the tripwire for the class of bug that made CARD-11 and CARD-13 ship DEAD:
  // spawn()/makeDeck() copy an EXPLICIT field list, and a new field left off it
  // is silently lost, so the card works in a hand-built test and does nothing in
  // a real deck. A card off spawn must equal its definition on every field.
  for (const [name, def] of Object.entries(E.CARDS)) {
    const s = E.spawn(name)
    for (const k of Object.keys(def)) {
      if (k === 'uid') continue
      eq(JSON.stringify(s[k]), JSON.stringify(def[k]), `spawn dropped '${k}' on ${name}`)
    }
  }
})
test('nothing builds a state from scratch without carrying you over', () => {
  /* SAVE-2. `startLostLine` built a fresh state and hand-copied five fields,
     dropping twenty. The round-trip test never caught it because it only
     tested save-then-load, never the transitions between modes. This checks
     the shape rather than the symptom: anywhere a state is built from
     `freshRun` or `newRun` rather than from the state you are already in,
     `carryOver` or `loadGame` must be right beside it. */
  /* v9.99 (SAVE-1): the window used to look FORWARD only, so hoisting the read
     into `const loaded = loadGame(slot)` on the line above tripped it even though
     the state below merges that very value. Adjacency is adjacency in either
     direction — the property being defended (a from-scratch state is merged with
     what was loaded or carried) is unchanged, and a freshRun with neither call
     anywhere near it still fails. */
  const app = readFileSync('src/App.tsx', 'utf8')
  const bad = []
  for (const m of app.matchAll(/(freshRun|newRun)\(/g)) {
    // guard-8: allow — proximity again, and positive again: DAILY-1 had to widen this
    // window, which is the safe direction — it failed rather than quietly stopped asking.
    const near = app.slice(Math.max(0, m.index - 200), m.index + 420) // guard-8: allow
    if (!/carryOver|loadGame/.test(near)) {
      const line = app.slice(0, m.index).split('\n').length
      bad.push(`${m[1]} at line ${line}`)
    }
  }
  eq(bad.length, 0, `builds a state from nothing and keeps none of you: ${bad.join(', ')}`)
})
test('every mode you can start keeps what is yours', () => {
  // the five transitions that touch persistent state, none of which were
  // covered when startLostLine was silently emptying the save
  const lived = {
    ...E.freshRun(0, 0, 1), level: 9, xp: 40, owned: ['Gaston'], sends: 12, wins: 2,
    runs: 7, falls: 30, seen: ['marge1'], ticked: ['act0'], bestCircuit: 9,
    book: { 'The Priest': { sends: 1, bestBurn: 1, bestStyle: 0, flashed: true, weather: 0, rock: 0 } },
    established: [{ name: 'Quiet Arete', claimed: 5, real: 8, act: 0, burns: 2 }],
    hints: false, textScale: 2, cbSafe: true, styleMax: 3, tutorialDone: true,
  }
  const mine = s => JSON.stringify([s.level, s.owned, s.seen, s.book, s.ticked,
    s.established, s.bestCircuit, s.hints, s.textScale, s.cbSafe, s.styleMax, s.tutorialDone])
  const rng = new E.RNG(5)
  // a new expedition
  eq(mine({ ...E.newRun(2, E.DEFAULT_LOADOUT, 0, 0, []), ...E.carryOver(lived) }), mine(lived),
    'starting an expedition loses something of yours')
  // the circuit and skirmish both spread the state they came from
  const circuit = { ...lived, circuit: true, runDeck: [], skirmish: E.circuitRoute(0, rng) }
  eq(mine(circuit), mine(lived), 'the circuit loses something of yours')
  const skirm = { ...lived, skirmish: E.skirmishRoute(4, rng), inRun: false }
  eq(mine(skirm), mine(lived), 'a one-off route loses something of yours')
  // and a full save round trip
  const saved = E.saveGame({ ...lived, slot: 0 })
  const back = E.loadGame(0)
  if (back) for (const k of ['level', 'owned', 'seen', 'ticked', 'bestCircuit', 'hints', 'textScale'])
    eq(JSON.stringify(back[k]), JSON.stringify(lived[k]), `the save file loses ${k}`)
})

test('a new expedition keeps everything that is yours', () => {
  /* NARR-4 turned this up. Starting a run replaced the whole state and
     hand-copied five fields across — level, xp, owned, sends, wins — and
     silently dropped the rest: the story you had heard, your logbook, the
     lines you had put up, your settings. The next save then wrote the emptied
     values back over the file. */
  const lived = {
    ...E.freshRun(0, 0, 1),
    level: 9, xp: 40, owned: ['Gaston'], sends: 12, wins: 2, runs: 7, falls: 30,
    seen: ['marge1', 'marge2', 'dale1'],
    book: { 'The Priest': { sends: 2, bestBurn: 1, bestStyle: 0, flashed: true, weather: 0, rock: 0 } },
    ticked: ['act0'],
    established: [{ name: 'Quiet Arete', claimed: 5, real: 8, act: 0, burns: 2 }],
    history: [{ seed: 1, arch: 0, style: 0, rope: false, circuit: false, act: 1, tier: 2, won: false, cause: 'x', sends: 3, deck: 15 }],
    bestCircuit: 9, styleMax: 3, tutorialDone: true, slot: 2, ending: 'told',
    sound: false, haptics: false, assist: true, motion: false, cbSafe: true, textScale: 2, coaching: false,
    hints: false, topRope: false, loadouts: [['Crimp Grip']],
  }
  const carried = { ...E.newRun(99, E.DEFAULT_LOADOUT, 0, 0, []), ...E.carryOver(lived) }
  // everything the save file keeps must survive starting a new expedition
  for (const k of ['level', 'xp', 'sends', 'wins', 'runs', 'falls', 'bestCircuit',
    'styleMax', 'tutorialDone', 'slot', 'ending', 'sound', 'haptics', 'assist', 'motion', 'cbSafe',
    'textScale', 'coaching', 'hints', 'topRope'])
    eq(JSON.stringify(carried[k]), JSON.stringify(lived[k]), `a new run lost ${k}`)
  for (const k of ['owned', 'seen', 'book', 'ticked', 'established', 'history', 'loadouts'])
    eq(JSON.stringify(carried[k]), JSON.stringify(lived[k]), `a new run lost ${k}`)
  // and it must not carry anything that belongs to the run just ended
  const c = E.carryOver(lived)
  for (const k of ['skin', 'psyche', 'cash', 'gear', 'boons', 'tier', 'act', 'runDeck', 'beta'])
    ok(!(k in c), `carryOver drags ${k} out of the last run`)
})

test('there is one way to play a card', () => {
  /* SIM-5. The screen and the harness each had their own implementation, and
     a rule added to one failed to reach the other three times: sequences
     (SIM-3), Free Rein (BAL-9), clipping (ROPE-4). Every time the mechanic
     measured as worthless and the fix was to teach the harness a rule the
     game already had. */
  const app = readFileSync('src/App.tsx', 'utf8')
  const engine = readFileSync('src/engine.ts', 'utf8')
  ok(/playBonusStep\(s, c, lane, rng\)/.test(app),
    'the screen does not go through the shared function')
  ok(engine.split('export function playBonusStep').length === 2,
    'playBonusStep is declared more than once')
  // the screen must not re-implement any of the rules
  /* GUARD-3: anchor it. Convert playBonus to a const/arrow and the slice is '',
     so all seven "the screen must not reimplement this rule" checks pass on
     nothing — the exact SIM-3 divergence class they exist to prevent. */
  /* GUARD-8: the anchor was already checked here, but the 900 was not — grow playBonus
     and a rule slides out of the window while all seven negatives keep passing. */
  const screen = region(app, 'function playBonus(', ['\n  function ', '\n  const '],
    { min: 200, what: 'playBonus' })
  for (const rule of ['c.shed', 'c.draw', 'c.gripCut', 'c.powerAll', 'c.clip', 'c.seq', 'c.read'])
    ok(!screen.includes(rule), `the screen still handles ${rule} itself`)
  // and the harness must call it rather than its own
  const auto = tail(engine, 'export function autoPlay', { min: 600, what: 'autoPlay' })
  ok(/st = playBonusStep\(st, c, lane, rng\)/.test(auto),
    'the harness does not go through the shared function')
  /* GUARD-8: the negative below used to take its window straight off an indexOf, which
     is the whole of autoPlay minus one character the day that anchor is renamed. */
  const head = region(auto, 'export function autoPlay', ['return st'],
    { min: 400, what: "autoPlay's bonus handling" })
  for (const rule of ['c.restore &&', 'c.gripCut &&'])
    ok(!head.includes(rule + ' st.piles'), `the harness still applies ${rule} itself`)
})

test('the preview and resolve read a hold the same way', () => {
  // ROUTE-5 gave named holds their own abilities and taught `abilityOf` about
  // them. The preview was still reading HOLD_STATS directly, so it was blind
  // to every signature hold's ability from v8.0 until this was found.
  const src = readFileSync('src/engine.ts', 'utf8')
  const previews = region(src, 'export function previewLane', ['export function previewPump'],
    { min: 300, what: 'the preview functions' })
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
    /* ROPE-2: three finds, plus a piece of protection in any act that has ropes. Asserted
       as a rule rather than a number, so the shelf cannot quietly grow a fourth find.
       SEQ-2 put a PLAN here and took it back out again — measured 44.3% to 40.3% (n=3000),
       because `bestOffer` buys the plan instead of a solid move on a valuation that overrates
       it. The retraction is kept as an injection rather than a comment. */
    const ropedAct = E.ACTS[s.act].flat().some(n => n.routeIdx >= 0 && E.ROUTES[n.routeIdx]?.roped)
    const clips = s.shopCards.filter(c => c.clip)
    eq(s.shopCards.length - clips.length, 3, 'the shelf is the wrong size')
    eq(clips.length, ropedAct ? 1 : 0, ropedAct
      ? 'the post in a roped act has no rack on the shelf, so protection is unobtainable again'
      : 'a post is selling protection in an act with no ropes on it')
    eq(s.shopCards.filter(c => c.seq).length, 0,
      'a plan is on the shelf again — that measured 44.3% to 40.3%, see PLAN_STOCK in engine.ts')
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
  const at = level => ({ ...E.freshRun(0, 0, 1), level })   // a fresh save with no deeds done
  ok(E.archUnlocked(E.ARCHETYPES[0], at(1)), 'the starting climber is locked')
  for (let i = 1; i < E.ARCHETYPES.length; i++)
    ok(E.ARCHETYPES[i].unlock > E.ARCHETYPES[i - 1].unlock,
      `${E.ARCHETYPES[i].name} unlocks no later than the one before`)
  ok(!E.archUnlocked(E.ARCHETYPES[E.ARCHETYPES.length - 1], at(1)),
    'the last climber is available at level 1 with nothing done')
})
test('META-6: every climber is earnable, by a deed or by the level backstop', () => {
  const fresh = E.freshRun(0, 0, 1)
  // the starter is always in
  ok(E.archUnlocked(E.ARCHETYPES[0], { ...fresh, level: 1 }), 'the starter climber is not available')
  // a lived-in save that has earned every deed (the META-8 fixture) unlocks
  // every deed-gated climber at level 1 — the earned path works
  const lived = { ...fresh, level: 1, sends: 5, wins: 1, dailyStreak: 3, bestCircuit: 9, styleMax: 5,
    journal: [1, 2, 3, 4, 5, 6, 8, 9, 10, 11],
    book: { 'The Priest': { sends: 1, bestBurn: 1, bestStyle: 0, flashed: true, weather: 5, rock: 0 } },
    established: [{ name: 'Soft Touch', claimed: 4, real: 7, act: 0, burns: 2 }] }
  for (const a of E.ARCHETYPES) {
    // the backstop guarantees earnability no matter what: max level unlocks all
    ok(E.archUnlocked(a, { ...fresh, level: 999 }), `${a.name} cannot be unlocked even at max level`)
    if (a.deed) {
      ok(E.DEEDS.some(d => d.id === a.deed), `${a.name}'s unlock deed "${a.deed}" is not a real deed`)
      ok(E.archUnlocked(a, lived), `${a.name}'s deed did not earn it at level 1`)
      // and without the deed and below its level, it stays locked (the deed matters)
      ok(!E.archUnlocked(a, { ...fresh, level: a.unlock - 1 }),
        `${a.name} unlocked with neither the deed nor the level`)
    }
  }
})
test('deeds are earnable, pure, and pay nothing (META-8)', () => {
  ok(E.DEEDS.length >= 8, `only ${E.DEEDS.length} deeds`)
  const fresh = E.freshRun(0, 0, 1)
  for (const d of E.DEEDS) {
    ok(d.name && d.text.length > 12, `${d.id} does not explain itself`)
    eq(typeof d.done(fresh), 'boolean', `${d.id}'s predicate is not a clean yes/no on a fresh save`)
    // a deed is a record, not a reward — the INJ-1 rule. No payout fields.
    eq(JSON.stringify(Object.keys(d).sort()), JSON.stringify(['done', 'id', 'name', 'text']),
      `${d.id} carries something beyond a record — a deed must pay nothing`)
  }
  // a brand-new climber has done nothing
  eq(E.deedsDone(fresh).length, 0, 'a fresh save has already earned a deed')
  // a lived-in record earns the deeds it should — The Priest is V5 and drizzle,
  // the line is graded soft, the journal is ten pages in, the streak is up
  // ...and the META-9 mastery tier: five finale wins, one on a mutator, one per
  // climber, the stone put back, every page found.
  const lived = { ...fresh, sends: 5, wins: 5, dailyStreak: 3, bestCircuit: 9, styleMax: 5,
    weekBest: E.BIG_WEEK,   // RUN-12: a real week of dailies earns 'In Season'
    ending: 'stranger-kept',   // META-10: the real ending shape, not the bare 'kept' that never occurs
    journal: [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15],
    book: { 'The Priest': { sends: 1, bestBurn: 1, bestStyle: 0, flashed: true, weather: 5, rock: 0 } },
    established: [{ name: 'Soft Touch', claimed: 4, real: 7, act: 0, burns: 2 }],
    history: [0, 1, 2, 3, 4].map(a => ({ won: true, circuit: false, arch: a, mutators: a === 0 ? ['greasy'] : [] })) }
  const got = new Set(E.deedsDone(lived))
  for (const id of ['send', 'flash', 'strong', 'wet', 'pages', 'lostline', 'fa', 'sandbagger', 'streak', 'enduro', 'onsight',
    'veteran', 'quiver', 'hardway', 'purist', 'everypage'])
    ok(got.has(id), `a lived-in save did not earn ${id}`)
  eq(got.size, E.DEEDS.length, 'that record should have earned every deed')
})
test('META-9: the mastery deeds read the record, and only a real record earns them', () => {
  const base = E.freshRun(0, 0, 1)
  const has = (over, id) => E.deedsDone({ ...base, ...over }).includes(id)
  const wins = arches => ({ history: arches.map(a => ({ won: true, circuit: false, arch: a })) })
  ok(E.DEEDS.length >= 16, `the mastery tier did not land: only ${E.DEEDS.length} deeds`)
  // Seasoned is five finale wins, not the first
  ok(!has({ wins: 4 }, 'veteran'), 'four wins earned Seasoned')
  ok(has({ wins: 5 }, 'veteran'), 'five wins did not earn Seasoned')
  // the whole quiver is all five climbers, not four
  ok(!has(wins([0, 1, 2, 3]), 'quiver'), 'four climbers earned the whole quiver')
  ok(has(wins([0, 1, 2, 3, 4]), 'quiver'), 'all five climbers did not earn the whole quiver')
  ok(!has({ history: [0, 1, 2, 3, 4].map(a => ({ won: true, circuit: true, arch: a })) }, 'quiver'),
    'circuit wins counted toward the campaign quiver')
  // the hard way needs a WON trip with a mutator — a mutated loss or a clean win is not it
  ok(!has({ history: [{ won: false, circuit: false, arch: 0, mutators: ['greasy'] }] }, 'hardway'), 'a mutated loss earned the hard way')
  ok(!has({ history: [{ won: true, circuit: false, arch: 0, mutators: [] }] }, 'hardway'), 'a clean win earned the hard way')
  ok(has({ history: [{ won: true, circuit: false, arch: 0, mutators: ['greasy'] }] }, 'hardway'), 'a mutated win did not earn the hard way')
  // Left No Trace reads the honest ending — the REAL shape, `${endingFor}-${kind}`
  ok(has({ ending: 'stranger-kept' }, 'purist') && has({ ending: 'known-kept' }, 'purist'),
    'the purist deed does not read the real ending format')
  ok(!has({ ending: 'known-told' }, 'purist') && !has({ ending: '' }, 'purist'),
    'the purist deed fires on a told ending or a fresh save')
  // and recordRun now stamps the trip's mutators onto the record the deed reads
  const rec = E.recordRun({ ...base, inRun: true, mutators: ['greasy'], runSeed: 3, runDeck: [] }, true).history[0]
  eq(JSON.stringify(rec.mutators), JSON.stringify(['greasy']), 'recordRun did not stamp the mutators onto the record')
})
test('META-10: the mastery deeds are honest — no dead predicate, no eviction', () => {
  const base = E.freshRun(0, 0, 1)
  const has = (over, id) => E.deedsDone({ ...base, ...over }).includes(id)
  // 1. the bug: `s.ending === 'kept'` could NEVER be true, because the ending is
  // written as `${endingFor}-${kind}` — a fresh save shipped an unearnable deed
  ok(base.ending !== 'kept', 'a fresh ending is the literal the old predicate wanted')
  ok(has({ ending: 'stranger-kept' }, 'purist'), 'putting the stone back still earns nothing')
  // 2. the eviction: quiver/hardway must read the DURABLE record, so a deed
  // earned long ago survives history rolling over (HISTORY_MAX evicts oldest)
  ok(has({ archWins: [0, 1, 2, 3, 4], history: [] }, 'quiver'),
    'the quiver un-earned itself once its wins fell off the 20-deep history')
  ok(has({ mutatorWin: true, history: [] }, 'hardway'),
    'the hard way un-earned itself once its win fell off the history')
  // 3. but the durable record only comes from a real finale win — a fresh save
  // (no archWins, no mutatorWin, no history) earns neither
  ok(!has({}, 'quiver') && !has({}, 'hardway'), 'a fresh save earned a mastery deed')
  // 4. and the record persists across a save round-trip
  const saved = { ...base, slot: 0, archWins: [0, 2, 4], mutatorWin: true }
  E.saveGame(saved)
  const back = E.loadGame(0)
  eq(JSON.stringify(back.archWins), JSON.stringify([0, 2, 4]), 'archWins did not survive save/load')
  eq(back.mutatorWin, true, 'mutatorWin did not survive save/load')
})
test('RUN-12: the weekly ladder has a hook — a deed and a share', () => {
  const base = E.freshRun(0, 0, 1)
  // the deed exists, gates on the all-time best week, and is a real bar — a
  // single great day cannot earn it (dailyScore tops out well under BIG_WEEK)
  const deed = E.DEEDS.find(d => d.id === 'bigweek')
  ok(deed, 'the weekly ladder still gates nothing')
  ok(E.BIG_WEEK >= 800, `a week worth ${E.BIG_WEEK} is too cheap`)
  ok(!deed.done({ ...base, weekBest: E.BIG_WEEK - 1 }), 'a near miss earned In Season')
  ok(deed.done({ ...base, weekBest: E.BIG_WEEK }), 'a full week did not earn In Season')
  ok(!deed.done(base), 'a fresh save earned In Season')
  // the share reads off the week and names the total; a personal best says so
  const sh = E.weekShare({ ...base, weekScore: 640, weekBest: 900 })
  ok(sh.includes('640') && sh.includes('900'), 'the week share does not carry the week and the best')
  ok(/best/i.test(E.weekShare({ ...base, weekScore: 1200, weekBest: 1200 })), 'a best week is not called out')
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
test('GUARD-6: the balance ledger is gated on a release, not on a habit', () => {
  /* The dated completion band — the thing this project defends hardest — lived
     entirely inside `if (SLOW)`, and NO script passed `slow`. `npm run check` and
     `npm run ship` both skipped it, and there is no CI, so a release could be cut
     without the band being evaluated once. It had been holding only because a
     human remembered to type it. This pins the wiring instead. */
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  const s = pkg.scripts ?? {}
  ok(/\bslow\b/.test(s['test:slow'] ?? ''), 'there is no script that runs the balance ledger')
  ok(/\bslow\b/.test(s['check:slow'] ?? '') || /test:slow/.test(s['check:slow'] ?? ''),
    'check:slow does not reach the ledger')
  ok(/check:slow|test:slow|\bslow\b/.test(s.ship ?? ''),
    'ship can still build without the completion band ever being measured')
  // and the ledger must actually be behind that flag, i.e. the band lives there
  const slow = readFileSync('sim/test.mjs', 'utf8')
  const block = tail(slow, 'if (SLOW)', { min: 400, what: 'the slow block' })
  for (const pin of ['has not drifted', 'no climber is twice as good', 'ROUTE-8'])
    ok(block.includes(pin), `the ledger no longer contains "${pin}"`)
  // the header must not under-advertise what it costs, or people skip it
  ok(!/balance guardrails \(~20s\)/.test(slow),
    'the header still claims the ledger costs ~20s, which is why it gets skipped')
})

test('UI-4: the map says what each stage ahead of you is', () => {
  /* Every future stage was an identical circle with a bare number, so the run's
     decision surface — and the screen the art direction is proudest of — could not
     tell you that stage 5 is a camp or stage 9 the boss; you read the prose list
     instead. Past stages already drew a mark from the trail, so only the future
     was anonymous. */
  const app = readFileSync('src/App.tsx', 'utf8')
  // the kinds have to reach the drawing at all
  ok(/function ActMap\(\{[^}]*kinds/.test(app), 'ActMap still cannot see what the stages are')
  ok(/<ActMap[\s\S]{0,400}kinds=\{/.test(app), 'the map is not told the stage kinds')
  // every node type that is NOT a plain climb must be distinguishable
  const marks = region(app, 'const NODE_MARK', ['}'], { min: 60, what: 'the mark vocabulary' })
  for (const kind of ['camp', 'shop', 'event', 'project', 'fa', 'boss'])
    ok(new RegExp(`${kind}:`).test(marks), `${kind} has no mark, so it draws as a bare number`)
  // the boss is the one that must read from a distance, so it is a shape not a glyph
  ok(/boss = k === 'boss'|const boss = k === 'boss'/.test(app), 'the boss is not singled out')
  ok(/boss \? 'var\(--red\)' : 'var\(--fade\)'/.test(app), 'the boss does not stand out in ink')
  // and the engine's node types must all be accounted for, so a new one cannot
  // silently arrive as an anonymous circle
  /* ENG-9: `NodeType` moved to src/types.ts and this broke loudly, which is the split
     working. Repointed at the MAPS rather than at the other file — every node type that
     actually appears on a map must have a mark. That is a stronger question than the one
     it was asking: a member of the type union that no map ever uses used to be demanded a
     mark, and a type is not what draws the circle. It also stops this guard caring which
     file a type declaration lives in, which is why it broke. */
  const types = [...new Set(E.ACTS.flat(2).map(n => n.type))]
  ok(types.length >= 6, `read ${types.length} node types`)
  for (const t of types.filter(t => t !== 'climb'))
    ok(new RegExp(`${t}:`).test(marks), `node type "${t}" has no mark on the map`)
})

test('DEV-1: content is inset past the notch and the home indicator', () => {
  /* index.html sets viewport-fit=cover — an explicit opt-OUT of the browser
     insetting content for the notch and the home indicator — and env(safe-area-*)
     appeared ZERO times, so the bottom of every screen sat in the gesture strip.
     Worst case was the one-handed COMMIT bar: A11Y-5 exists to put COMMIT under
     the thumb and it was putting it inside the OS swipe-up zone. */
  const app = readFileSync('src/App.tsx', 'utf8')
  const html = readFileSync('index.html', 'utf8')
  ok(/viewport-fit=cover/.test(html), 'the viewport no longer opts out — this guard needs rewriting')
  const rule = name => cssRule(app, name)
  // the page, the bottom-anchored sheets, and the fixed COMMIT bar
  ok(/env\(safe-area-inset-bottom\)/.test(rule('.wrap{max-width')),
    'the page is not padded past the home indicator')
  ok(/env\(safe-area-inset-bottom\)/.test(rule('.sheetin{')),
    'a bottom-anchored sheet still ends inside the indicator strip')
  /* UX-19 renamed this rule: the bar is fixed and ungated now, not `.reach`-only and
     sticky. The anchor moved with it and this guard broke loudly, which is the point. */
  ok(/env\(safe-area-inset-bottom\)/.test(rule('.wrap>.climb-foot{')),
    'the COMMIT bar still sits in the OS swipe-up zone')
  // and the viewport unit must be the dynamic one on a phone
  ok(/\.wrap\{[^}]*min-height:100dvh/.test(app),
    'the page is still sized in vh, so it is taller than the visible viewport')
  ok(!/max-height:82vh/.test(app), 'a sheet is still sized in vh rather than dvh')
})

test('DEV-7: an update never takes the player off the screen they are on', () => {
  /* REPORTED AS: "I am on the main menu, I tap to enter and get in and then it randomly
     goes back to the previous menu." It did, and it was the update path.

     THE CHAIN. DEV-2 reloads the page when a new service worker takes over, gated on
     `__SB_BUSY__`, which meant "mid-climb" — the two phases the save skips, because a
     reload there throws the boulder away. Every other screen was fair game. But
     `loadGame` restores the save and NOT `phase`, deliberately: SAVE-4 exists so that a
     reload cannot reopen the post, the van or the daily. So a reload from anywhere at all
     puts the player back on the splash. Three levels into the books, that is your place
     gone, unrequested, a couple of seconds after launch.

     REPRODUCED with two builds over HTTP: install, deploy a new sw.js, reopen, tap into
     THE BOOKS — and a navigation fires and the splash is back. `controllerchange` was
     measured at about 1.7s after load.

     THE FIX is that 1.7s. The flag means "the player has tapped begin" now, so the only
     reload that can happen is one nobody can see: the splash is up, the page reloads, the
     splash is still up. That keeps DEV-2's entire point — an installed PWA that is rarely
     cold-started still gets the build in the session it downloaded it — and costs nothing,
     because the window is the normal case rather than a lucky one. */
  const app = readFileSync('src/App.tsx', 'utf8')
  const gen = readFileSync('scripts/build-html.mjs', 'utf8')

  // the flag is the splash, and `booted` is one-way — nothing puts the splash back
  ok(/__SB_BUSY__ = booted/.test(app), 'the reload gate is not the splash any more')
  eq((app.match(/setBooted\(/g) ?? []).length, 1,
    'booted is set in more than one place, so it may no longer be one-way and the gate could reopen mid-session')
  ok(/setBooted\(true\)/.test(app), 'booted is never set, so the splash never clears')
  const gate = region(app, ';(window as unknown as { __SB_BUSY__?: boolean }).__SB_BUSY__',
    ['\n  const ', '\n  useEffect('], { min: 40, what: 'the busy-flag effect' })
  ok(/\}, \[booted\]\)/.test(gate), 'the flag is published on a dependency that is not the splash')

  // one check, no interval: a one-way flag cannot become false, so a poll can never fire
  ok(!/setInterval/.test(gen), 'the update path polls a flag that can no longer change')
  const sw = region(gen, "const reg = `<script>", ['`\nhtml = html.replace', 'html = html.replace'],
    { min: 200, what: 'the service-worker registration' })
  eq((sw.match(/location\.reload\(\)/g) ?? []).length, 1,
    'the registration reloads from more than one place, so a guard on one of them is not a guard')
  ok(/if\(!had\|\|done\)return;done=true;/.test(sw),
    'a first install bounces the page, or a second controllerchange reloads twice')
  ok(/if\(!window\.__SB_BUSY__\)\{location\.reload\(\)\}/.test(sw),
    'the reload is not gated on the flag at all')

  /* AND THE REASON THE RELOAD IS DESTRUCTIVE IN THE FIRST PLACE, asserted so that nobody
     "fixes" this by restoring `phase` instead. SAVE-4 is why the loader drops it, and
     dropping it is correct — the answer was to stop reloading at the wrong moment, not
     to start restoring a screen the save was never meant to reopen. */
  const eng = readFileSync('src/engine.ts', 'utf8')
  const load = declBody(eng, 'export function loadGame', 'loadGame')
  ok(!/\bphase: d\.phase\b/.test(load),
    'the loader restores the phase, which is how a reload reopens the post, the van and the daily (SAVE-4)')
})
test('DEV-2: the service worker cannot pin a stale or broken build', () => {
  /* Nineteen lines with three defects, all of which end in "the player is stuck
     on a build they cannot get off". The generator is the source of truth, so
     assert against it AND against the emitted worker. */
  const gen = readFileSync('scripts/build-html.mjs', 'utf8')
  const sw = readFileSync('docs/sw.js', 'utf8')
  for (const [name, src] of [['generator', gen], ['emitted sw.js', sw]]) {
    // 1. precache must bypass the HTTP cache, or it can store the PREVIOUS build
    ok(/cache: *'reload'/.test(src),
      `${name}: addAll can precache the previous build's HTML under the new cache name`)
    // 2. never write a non-OK response into a cache that is then served first
    ok(/res\.ok/.test(src),
      `${name}: a 404 or captive-portal page can be cached permanently and bricks the install`)
  }
  // 3. an update has to reach an open page — but never mid-climb
  ok(/controllerchange/.test(gen), 'a new build never reaches an already-open page')
  ok(/__SB_BUSY__/.test(gen), 'the update path can reload mid-climb and eat the boulder')
  ok(/had *= *!!navigator\.serviceWorker\.controller|var had=!!navigator\.serviceWorker\.controller/.test(gen),
    'a first install would bounce the page, because nothing checks for a prior controller')
  const app = readFileSync('src/App.tsx', 'utf8')
  ok(/__SB_BUSY__/.test(app), 'the app never publishes whether it is safe to reload')
  /* DEV-7 replaced what this asserted, and the replacement is strictly stronger, so the
     assertion moves rather than relaxes. The flag used to mean "mid-climb", which let a
     reload happen on every other screen — and since `loadGame` restores the save but not
     `phase`, that reload lands the player back on the splash. It was reported as the game
     randomly going back a menu, and reproduced with two builds over HTTP. The flag means
     "the player has tapped begin" now, which covers mid-climb a fortiori (you cannot
     climb before you have begun) and covers every other screen too. */
  ok(/__SB_BUSY__ = booted/.test(app),
    'the busy flag is not tied to the splash, so a reload can throw the player off a screen')
  ok(!/__SB_BUSY__[\s\S]{0,220}phase === 'climb'/.test(app),
    'the busy flag is back to mid-climb only, which permits a reload on every other screen')
  // the poll is retired with it: the flag is one-way now, so an interval can never fire
  ok(!/setInterval/.test(gen),
    'the update path still polls a flag that can no longer change, so the interval runs for ever')
  // the cache name must still be per-release, or an update cannot displace the old one
  ok(/const CACHE = 'sandbagged-v[\d.]+'/.test(sw), 'the cache name is not versioned')
})

test('DEV-3: an endless run is written down, and the page cannot be pulled away', () => {
  /* The Circuit sets `inRun: false`, so saveGame's `run` block never covered it
     and NOT ONE LINE of an endless run was ever persisted — a twenty-line streak
     was pure memory, gone to a reload, with only `bestCircuit` surviving. And
     `overscroll-behavior` existed on exactly one element (the hand scroller,
     x-axis), so Android pull-to-refresh could reload the app mid-climb. */
  const deep = { ...E.freshRun(0, 0, 9), slot: 9, circuit: true, circuitScore: 17,
    inRun: false, runDeck: E.DEFAULT_LOADOUT.map(E.spawn), skin: 5, psyche: 2,
    kit: ['secondwind'], gear: [], boons: ['longgame'], bestCircuit: 4 }
  E.saveGame(deep)
  const back = { ...E.freshRun(0, 0, 1), ...E.loadGame(9) }
  ok(back.circuit, 'the endless run was not written down at all')
  eq(back.circuitScore, 17, 'the line count did not survive')
  eq(back.skin, 5, 'skin did not survive'); eq(back.psyche, 2, 'psyche did not survive')
  eq(back.runDeck.length, deep.runDeck.length, 'the deck did not survive')
  eq(JSON.stringify(back.boons), JSON.stringify(['longgame']), 'the boons did not survive')
  eq(JSON.stringify(back.kit), JSON.stringify(['secondwind']), 'the kit did not survive')
  ok(back.skirmish, 'there is no line to come back to')
  // it must not be confused with a campaign run — different mode, no map
  ok(!back.inRun, 'the resumed circuit claims to be a campaign run')
  E.wipeSlot(9)
  // and the document must not chain its scroll into a browser refresh
  const app = readFileSync('src/App.tsx', 'utf8')
  ok(/html,body\{[^}]*overscroll-behavior-y:contain/.test(app),
    'the page still chains its overscroll, so pull-to-refresh can eat a climb')
  ok(/\.sheetin\{[^}]*overscroll-behavior:contain/.test(app),
    'an over-flicked sheet still chains its scroll to the document')
})

test('SAVE-4: reloading does not reopen the post, the van, or the daily', () => {
  /* `shoppedAt` and `vanRaided` are what `postOpen`/`vanOpen` read — the fields
     behind the code's own "once a stage" and "once a range" — and neither was in
     SaveData, so reloading reopened both with freshly rolled stock. The daily
     promised "One go" in the menu copy while stamping the day only when the climb
     RESOLVED, so quitting mid-daily bought a fresh roll, which the streak and the
     weekly ladder sit on top of. */
  const mid = { ...E.freshRun(4, 0, 3), slot: 8, inRun: true, act: 1, tier: 3,
    runDeck: E.DEFAULT_LOADOUT.map(E.spawn),
    shoppedAt: [1 * 100 + 3], vanRaided: [1], trail: ['camped', 'the post'],
    eventChose: ['storm:1'], reroll: 2, line: 1 }
  ok(!E.postOpen(mid), 'the fixture is wrong — the post should already be used')
  ok(!E.vanOpen(mid), 'the fixture is wrong — the van should already be raided')
  E.saveGame(mid)
  const back = { ...E.freshRun(0, 0, 1), ...E.loadGame(8) }
  ok(!E.postOpen(back), 'reloading reopened the trading post — the stock is farmable')
  ok(!E.vanOpen(back), 'reloading reopened the van — it is meant to be once a range')
  eq(back.trail.length, 2, 'the trip forgot where it had been')
  eq(back.eventChose.length, 1, 'the run forgot which branch it took')
  eq(back.reroll, 2, 'the days you waited were not remembered')
  eq(back.line, 1, 'the line you were climbing was forgotten')
  E.wipeSlot(8)

  // the daily: a go is used when it STARTS, and that survives a reload
  const key = E.dayKey()
  const fresh = { ...E.freshRun(0, 0, 1), slot: 8 }
  ok(!E.dailyUsed(fresh, key), 'a fresh save has already used today')
  const started = { ...fresh, daily: true, dailyTried: key }
  ok(E.dailyUsed(started, key), 'starting the daily did not use the go')
  E.saveGame(started)
  ok(E.dailyUsed({ ...E.freshRun(0, 0, 1), ...E.loadGame(8) }, key),
    'quitting the daily and reloading bought a fresh go at today problem')
  /* and the streak must NOT be collateral damage: bankDaily reads dailyDay being
     YESTERDAY, which is exactly why the early stamp needed its own field. */
  const y = new Date(); y.setUTCDate(y.getUTCDate() - 1)
  const onStreak = E.bankDaily({ ...started, dailyDay: E.dayKey(y), dailyStreak: 6,
    skirmish: E.dailyRoute(key), cleared: 3, turns: 9 })
  eq(onStreak.dailyStreak, 7, 'the early stamp reset a running streak')
  E.wipeSlot(8)
})

test('SAVE-5: a save missing xp does not freeze levelling forever', () => {
  /* `level: d.level, xp: d.xp` were the only two fields in loadGame without a
     default, under a comment promising every field had one. Object spread copies
     a key holding undefined, so xp came through undefined, gainXp computed NaN,
     and `while (NaN >= xpToNext(level))` was never true — level frozen for good
     and every XP readout NaN. `{"level":1}` as an import code was enough. */
  const code = btoa(unescape(encodeURIComponent(JSON.stringify({ v: E.SAVE_FILE_VERSION, level: 4 }))))
  ok(E.importSave(code, 5), 'a minimal but valid save code was refused')
  const got = E.loadGame(5)
  ok(got, 'a valid minimal save read as unreadable')
  eq(got.xp, 0, 'xp came back undefined, which turns every future gain into NaN')
  eq(got.level, 4, 'the level did not survive')
  // and the thing that actually broke: XP must still accumulate
  const s = { ...E.freshRun(0, 0, 1), ...got }
  const after = E.gainXp(s, 30, new E.RNG(1))
  ok(Number.isFinite(after.xp), `xp went to ${after.xp} — levelling is frozen`)
  ok(after.xp > 0 || after.level > got.level, 'the xp gain vanished')
  // a code whose xp is present but not a number must be refused outright
  const bad = btoa(unescape(encodeURIComponent(JSON.stringify({ level: 1, xp: 'lots' }))))
  ok(!E.importSave(bad, 5), 'a save with a non-numeric xp was accepted')
  E.wipeSlot(5)
})

test('SAVE-2: the run survives a boss, and so does winning the campaign', () => {
  /* saveGame dropped the run whenever tier ran past the end of the act's map —
     which it ALWAYS does at a boss, because a boss is the last tier and starting
     a climb pre-writes tier+1 as the "you abandoned it" state. So the save said
     "no run" from the moment you tapped into any boss, and the screens after a
     boss send were not save phases either. */
  const lastTier = E.ACTS[0].length - 1
  const atBoss = { ...E.freshRun(9, 0, 4), slot: 6, inRun: true, act: 0,
    tier: lastTier + 1,                     // the pre-written abandon state
    runDeck: E.DEFAULT_LOADOUT.map(E.spawn), skin: 7, psyche: 2, cash: 40 }
  E.saveGame(atBoss)
  const back = E.loadGame(6)
  ok(back, 'the boss save read as unreadable')
  ok(back.inRun, 'tapping into a boss threw the whole run away on disk')
  eq(back.tier, lastTier, 'the resumed tier is off the end of the act map')
  eq(back.runDeck.length, atBoss.runDeck.length, 'the deck did not survive the boss')
  eq(back.skin, 7, 'skin did not survive'); eq(back.psyche, 2, 'psyche did not survive')
  // and the screens that follow a send must be save phases — it is a denylist now
  const app = readFileSync('src/App.tsx', 'utf8')
  /* GUARD-8: this read a fixed 220 characters, so the four negative assertions below
     were only ever checking the first two lines of whatever followed. It ends where the
     effect ends now. */
  const eff = region(app, 'if (st.saveBlocked) return', ['\n  }'],
    { min: 40, what: 'the persist effect' })
  ok(/phase !== 'climb'/.test(eff) && /phase !== 'burnEnd'/.test(eff),
    'the persist effect is an allowlist again — a screen after a send will not save')
  for (const p of ['gear', 'epilogue', 'pack', 'claim'])
    ok(!new RegExp(`st\\.phase === '${p}'`).test(eff), `${p} is being special-cased again`)
  E.wipeSlot(6)
})

test('SAVE-1: an unreadable slot is never overwritten, and an import is applied', () => {
  /* loadGame returned {} for BOTH "empty slot" and "could not read this", so an
     unreadable save was indistinguishable from a new game — and the app then
     persisted a fresh game over it. One unknown card name was enough to trigger
     the throw. */
  // a corrupt slot reads as null (unreadable), not {} (empty)
  localStorage.setItem('sandbagged.save.7', '{not json at all')
  eq(E.loadGame(7), null, 'a corrupt save reads as an empty slot, so it gets overwritten')
  // a save from a NEWER build is refused the same way, not treated as empty
  localStorage.setItem('sandbagged.save.7',
    JSON.stringify({ v: E.SAVE_FILE_VERSION + 1, level: 9 }))
  eq(E.loadGame(7), null, 'a newer save reads as empty, so this build would eat it')
  // an unknown card in the run deck costs that card, never the whole save
  E.saveGame({ ...E.freshRun(0, 0, 1), slot: 7, inRun: true, act: 0, tier: 1,
    runDeck: E.DEFAULT_LOADOUT.map(E.spawn), level: 12 })
  const raw = JSON.parse(localStorage.getItem('sandbagged.save.7'))
  raw.run.deck = [...raw.run.deck, 'A Card That No Longer Exists']
  localStorage.setItem('sandbagged.save.7', JSON.stringify(raw))
  const back = E.loadGame(7)
  ok(back, 'one renamed card destroyed the entire save')
  eq(back.level, 12, 'the campaign was lost with the unknown card')
  ok(back.runDeck.every(c => c && c.name), 'a blank card came back in the deck')
  // the app must refuse to write over a blocked slot, and the import must reload
  const app = readFileSync('src/App.tsx', 'utf8')
  ok(/if \(st\.saveBlocked\) return/.test(app), 'nothing stops the game overwriting an unreadable slot')
  ok(/saveBlocked: (got|loaded) === null/.test(app), 'a failed read is not recorded anywhere')
  const imp = region(app, 'if (!importSave(', ['IMPORT</button>'],
    { min: 40, what: 'the import handler' })
  ok(/load\(st\.slot\)/.test(imp), 'IMPORT still does not reload, so the import gets overwritten')
  ok(!/Reloading the slot/.test(imp), 'IMPORT still claims to reload without reloading')
  E.wipeSlot(7)
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

test('HOLD-1: a hold you leave hanging gets worse, the ability says which, the cap says how far', () => {
  /* HOLD-1. The wall had seven abilities and every one of them was a static modifier to the
     same turn's arithmetic, so no turn's decision outlived the turn: leaving a hold cost
     `HANG_TAX` per hold and nothing else, which means WHICH hold you left never mattered,
     only how many. A creeping hold makes triage a real decision. What this guards is the
     four things that have to be true for it to be a decision rather than an ambush or a
     soft lock: it is keyed on what the board already PRINTS, only the lanes you LEFT pay,
     it is CAPPED, and it is said out loud on the hold and in the accessibility tree. */
  const S = (uid, o = {}) => ({ uid, name: 'sloper', bite: 1, grip: 6, crux: false, clean: false, ...o })
  const C = (uid, o = {}) => ({ uid, name: 'crimp', bite: 1, grip: 5, crux: false, clean: false, ...o })
  const base = { ...E.freshRun(6, 0, 5), inRun: true, skirmish: null, phase: 'climb',
    weather: 1, rock: 0, turn: 2, flow: 0, pump: 0, gear: [], boons: [], mutators: [],
    boardH: [null, null, null], boardP: [null, null, null], holdDeck: [], feetDeck: [],
    piles: { draw: [], discard: [], exhaust: [], hand: [] },
    worked: [], order: [], fxLane: ['', '', ''], topRope: false, routeMove: null }

  const rate = E.CREEP['Greasy']
  ok(rate > 0, 'nothing creeps at all, so the whole mechanic is switched off')
  ok(E.CREEP_MAX >= rate * 2, 'the cap lands on the first tick, so leaving a hold is a one-off cost again')

  // KEYED ON THE ABILITY, NOT THE TYPE — the easy cases first, the deciding one below.
  eq(E.creepOf(S(1)), rate, 'the sloper — the common Greasy hold — does not creep')
  // and a hold the board calls something else does not creep on the quiet
  eq(E.creepOf(C(1)), 0, 'a crimp creeps, so this is not keyed on the ability at all')
  /* BRUSHING STOPS THE CLOCK. `abilityOf` already reads a clean hold as having no ability,
     so this is inherited rather than restated — and it is the reason the mechanic has an
     ANSWER and not only a countdown. */
  eq(E.creepOf(S(1, { clean: true })), 0, 'a brushed hold still creeps, so there is no way to stop it')
  /* AND NOW THE DECIDING CASE, after the easy ones: a hold whose BASE is not a sloper and
     which the board still prints GREASY on. Keyed on the type, the game says GREASY and then
     quietly does not do the thing GREASY means. */
  const wet = E.SIGNATURES.find(g => g.ability === 'Greasy' && g.base !== 'sloper')
  ok(wet, 'no signature is Greasy over a non-sloper base any more, so this fixture proves nothing')
  const wj = { uid: 5, name: wet.base, bite: 1, grip: 5, crux: false, clean: false, sig: wet.id }
  eq(E.abilityOf(wj), 'Greasy', `${wet.name} is not Greasy, so the fixture proves nothing`)
  eq(E.creepOf(wj), rate, `${wet.name} reads GREASY on the board and does not creep — this is keyed on the type`)

  /* ONLY THE LANES YOU LEFT. Paired, because "nothing sweats" would pass the first half on
     its own — the second resolve is the same hold, same seed, nothing on it. */
  const big = S(1, { grip: 99 })                     // never worked, so it survives the turn
  const held = E.resolve({ ...base, boardH: [big, null, null],
    boardP: [E.spawn('Open Hand'), null, null] }, new E.RNG(7))
  ok(held.boardP[0], 'the card blew, so lane 0 counts as unanswered and the fixture proves nothing')
  eq(held.boardH[0].worn ?? 0, 0, 'a hold sweats while you are ON it, so there is nothing to triage')
  const left = E.resolve({ ...base, boardH: [big, null, null] }, new E.RNG(7))
  eq(left.boardH[0].worn, rate, 'the same hold left on its own does not sweat either')

  /* IT IS REAL ARITHMETIC, not a badge: the wear goes into `grip`, which is what the
     preview, `gripShown` and the resolution all already read. */
  const one = E.resolve({ ...base, boardH: [S(1), C(2), null] }, new E.RNG(7))
  eq(one.boardH[0].grip, 6 + rate, 'the sloper you left is no harder to work than it was')
  eq(one.boardH[0].worn, rate, 'the wear is not written down, so the cap has nothing to count')
  eq(one.boardH[1].grip, 5, 'the crimp you left in the next lane got worse too')
  ok(one.log.some(l => /sweating up/.test(l)), 'it happened silently, which makes it an ambush')

  /* CAPPED. Uncapped, a lane you cannot answer runs to unanswerable and takes the burn with
     it. `grip` and `worn` must stop at the same place — they are two records of one fact. */
  let st = { ...base, boardH: [S(1), null, null] }
  for (let t = 0; t < 6; t++) st = { ...E.resolve(st, new E.RNG(7)), phase: 'climb', routeMove: null, pump: 0 }
  eq(st.boardH[0].worn, E.CREEP_MAX, 'the wear does not stop at the cap')
  eq(st.boardH[0].grip, 6 + E.CREEP_MAX, 'the grip ran past the cap that the wear stopped at')

  /* ONE PREDICATE FOR TWO CONSEQUENCES. The hang tax and the wear are charged on the same
     lanes, so `unanswered` is that list's length rather than a second walk of the board —
     two walks of one rule is exactly how ENG-26 got a preview that disagreed with the
     resolution, and it would arrive here in a new form. */
  const eng = readFileSync('src/engine.ts', 'utf8')
  const res = stripComments(region(eng, 'export function resolve(s: GameState, rng: RNG)',
    ['\nexport function '], { min: 8000, what: 'resolve' }))
  eq((res.match(/\[0, 1, 2\]\.filter\(i => boardH\[i\] && !boardP\[i\]\)/g) ?? []).length, 1,
    'resolve walks the board for unanswered lanes twice, so the tax and the wear can disagree')
  ok(/const unanswered = hanging\.length/.test(res),
    'the hang tax no longer counts the lanes the wear is charged on')
  ok(/const worn = Math\.min\(CREEP_MAX,/.test(res), 'the wear is no longer clamped to the cap')

  /* AND THE HOLD SAYS SO. ROUTE-6's windows and the boss phases both set the rule that the
     wall telegraphs before it lands; a hold getting worse has to read that way too, on the
     hold itself and in the accessibility tree (A11Y-8), and in words rather than colour
     alone (VIS-7). */
  const app = readFileSync('src/App.tsx', 'utf8')
  const slot = stripComments(region(app, 'const ab = abilityOf(h)', ['<Pips'],
    { min: 1500, what: 'the board hold' }))
  ok(/creepOf\(h\) > 0 && <div/.test(slot), 'the board draws nothing at all on a sweating hold')
  ok(/\+\$\{creepOf\(h\)\}\/turn/.test(slot),
    'the hold says it is sweating without saying how fast, which is not enough to choose against')
  ok(/>= CREEP_MAX/.test(slot),
    'the board never says a hold has stopped getting worse, so the clock reads as endless')
  ok(/\$\{h\.worn\} so far/.test(slot), 'the hold does not say how much wear is already on it')
  /* the same sentence has to exist for a screen reader, which is not the same string and so
     is not covered by any of the four above. */
  const aria = region(slot, 'grip a turn you leave it', ['}>'], { min: 40, what: 'the hold label' })
  ok(/h\.worn/.test(aria), 'the spoken label does not say how far it has already gone')
})

group('the suite')
test('GUARD-9: the kept injections still injure something', () => {
  /* GUARD-9. `test.mjs` exists because fifteen one-off harnesses were each written, used
     once and thrown away. The negative tests were the same story a level up: every ticket
     in this project gets injections, they have found the original bug every time AND three
     assertions that COULD NOT FAIL — and every one of those scripts lived in /tmp.
     `sim/mutants.mjs` keeps them. Running it is opt-in because it edits source files and
     takes minutes; what runs here on every check is the part that ROTS. A mutant is a
     patch against an exact line, so the moment somebody edits that line the anchor stops
     matching and the mutant silently stops testing anything — the same way a guard with a
     moved window silently stops testing anything, which is what GUARD-8 was about. */
  // a mutant has to be a real change that says which guard it expects to hear from
  const ids = new Set()
  for (const m of MUTANTS) {
    ok(m.id.includes('/'), `${m.id} does not name the ticket it belongs to`)
    ok(!ids.has(m.id), `two mutants share the id ${m.id}`)
    ids.add(m.id)
    ok(m.catches && m.catches.length > 8, `${m.id} does not say what it expects to hear`)
    ok(['core', 'kept', 'slow'].includes(m.suite), `${m.id} runs against no suite (${m.suite})`)
    ok(m.why && m.why.length > 12, `${m.id} does not say what it breaks`)
    for (const entry of m.patch) {
      /* SAVE-6 found this hole: a patch written with two elements instead of three
         destructures to file=<the needle>, from=<the replacement>, to=undefined, and the
         runner tries to open the needle as a filename. The shape is asserted now. */
      eq(entry.length, 3, `${m.id} has a patch of ${entry.length} parts, not [file, from, to]`)
      const [file, from, to] = entry
      for (const [what, v] of [['file', file], ['from', from], ['to', to]])
        ok(typeof v === 'string', `${m.id}'s patch ${what} is ${typeof v}, not a string`)
      /* DEV-7 added `scripts/`. The point of this check is that a patch names a real file
         in this repo — the runner snapshots exactly the files the table touches and
         byte-compares them at exit, so anything outside the tree would be restored from
         nothing. `scripts/build-html.mjs` is source by every measure that matters here:
         DEV-2's guard already reads it as the source of truth for the service worker. */
      ok(/^(src|sim|scripts|ship|docs|\.gitignore|package\.json)/.test(file),
        `${m.id} patches ${JSON.stringify(file)}, which is not a source path`)
      ok(from !== to, `${m.id} patches ${file} to exactly what it already says`)
      ok(from.length > 12, `${m.id} has an anchor too short to be unique on purpose`)
    }
  }
  /* and every ticket that has been negative-tested keeps its injections. A number rather
     than a list on purpose: the point is that they are not thrown away, not that any
     particular one exists for ever. */
  const tickets = new Set(MUTANTS.map(m => m.id.split('/')[0]))
  ok(tickets.size >= 5, `only ${tickets.size} tickets have kept injections`)
  ok(MUTANTS.length >= 40, `only ${MUTANTS.length} injections kept`)
  /* the runner puts the tree back. This is the assertion that matters most for anybody
     running it, because the failure mode is a mutated working tree. */
  const runner = readFileSync('sim/mutants.mjs', 'utf8')
  ok(/finally\s*\{\s*\n?\s*restore\(\)/.test(runner), 'the runner no longer restores after each mutant')
  ok(/THE TREE IS STILL MUTATED/.test(runner), 'the runner no longer checks that it put the sources back')
  for (const sig of ['SIGINT', 'uncaughtException'])
    ok(runner.includes(sig), `the runner no longer restores the tree on ${sig}`)

  /* THE ANCHOR CHECK COMES LAST, deliberately. Any injection that patches `mutants.mjs`
     removes the line it itself targets, so its own anchor dies as a side effect — put this
     first and it fires for every one of them, masking the assertion each was written to
     test. Found by running GUARD-9's own injections and watching four of five report the
     wrong failure. */
  const snap = new Map(touched().map(f => [f, readFileSync(f, 'utf8')]))
  const dead = []
  for (const m of MUTANTS) {
    try { applyPatch(m, f => snap.get(f)) } catch (e) { dead.push(e.message) }
  }
  eq(dead.length, 0,
    `${dead.length} kept injection(s) patch nothing any more:\n    ${dead.join('\n    ')}`)
})
test('GUARD-8: no guard reads a window it cannot prove is the right one', () => {
  /* This is the ticket. GUARD-3 found and fixed unchecked-anchor windows; GUARD-8 found
     five more fixed-length ones and two more unchecked anchors, three of them written
     during the ticket immediately before this. Fixing instances plainly does not work,
     because the technique is fine and the mistake is invisible — a guard reading the
     wrong text reads GREEN. So the suite reads itself.

     The rule is: there is one way to take a source window (`region`, and the helpers
     built on it), it validates its own anchors and its own size, and anything that
     hand-rolls one is a failure here. A line that genuinely needs a raw slice — a string
     being mutated, a deliberate lookahead — says `guard-8: allow` on that line with a
     reason, which is a decision somebody has to write down rather than a habit. */
  const files = ['sim/guard.mjs', 'sim/test-core.mjs', 'sim/test.mjs']
    .map(f => [f, readFileSync(f, 'utf8')])
  const bad = guardScan(files)
  eq(bad.length, 0, `${bad.length} hand-rolled source window(s):\n    ${bad.join('\n    ')}`)

  /* And the assertions themselves must keep demanding a message. That check is at CALL
     time rather than in the scan above, which is what makes it exact — the audit that
     opened this ticket reported two message-less assertions from a line-based scan and
     both were false positives, a regex literal containing a quote being enough to fool
     it. Every assertion in both suites executes, so nothing message-less can hide. */
  for (const [name, call] of [['ok', () => ok(true)], ['eq', () => eq(1, 1)]]) {
    let threw = ''
    try { call() } catch (e) { threw = e.message }
    ok(/no failure message/.test(threw), `${name}() accepts an assertion with no failure message`)
  }
  // a window that is there reads; one whose anchors are gone throws instead of lying
  const src = readFileSync('sim/guard.mjs', 'utf8')
  ok(region(src, 'export function region', ['export const declBody'],
    { min: 200, what: 'region' }).includes('out.length < min'), 'region does not check its own size')
  for (const [from, to, says, why] of [
    ['export function noSuchThing', ['export const declBody'], /opening anchor is gone/,
      'the opening anchor is gone'],
    ['export function region', ['export const noSuchThing'], /closing anchors are left/,
      'every closing anchor is gone, so it would read to the end of the file'],
    ['export function region', ['('], /only \d+ chars/,
      'the window came back far too small to assert over'],
  ]) {
    let threw = ''
    try { region(src, from, to, { min: 200, what: 'a fixture' }) } catch (e) { threw = e.message }
    ok(says.test(threw), `region handed back a window when ${why} — it said ${JSON.stringify(threw)}`)
  }
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
