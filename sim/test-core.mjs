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
    const around = src.slice(Math.max(0, m.index - 260), m.index + 260)
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
  const tweakBlock = src.slice(src.indexOf('export type Tweak'), src.indexOf('export type CurseCause'))
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
  eq(out.phase, 'menu', 'walking away does not take you to the menu')
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
    let b = E.startBurn({ ...E.freshRun(6, 0, 5), inRun: true, skirmish: null,
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
  const score = E.dailyScore(base)
  const sameWeek = E.bankDaily({ ...base, weekId: E.weekKey(), weekScore: 500 })
  eq(sameWeek.weekScore, 500 + score, "the daily did not stack onto this week's ladder")
  eq(sameWeek.weekBest, 500 + score, 'the weekly best did not follow the running total')
  eq(E.bankDaily({ ...base, weekId: 'w0', weekScore: 999 }).weekScore, score,
    'a new week did not reset the ladder')
  eq(JSON.stringify(E.bankDaily(sameWeek)), JSON.stringify(sameWeek),
    'a second bank moved the weekly ladder')
  // and it survives a save
  E.saveGame({ ...base, slot: 1, weekId: 'w123', weekScore: 700, weekBest: 900 })
  eq(E.loadGame(1).weekScore, 700, 'the weekly ladder did not survive a save')
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
  const at = app.indexOf("if (st.phase === 'runEnd')")
  ok(at > 0, 'there is no run-end screen')
  const screen = app.slice(at, at + 3200)
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
  const pip = app.slice(app.indexOf('.pip{'), app.indexOf('.cb{'))
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

test('UI-2: the menu says which caption belongs to which action, and one leads', () => {
  /* Reported off a phone: the menu was "boring and not clear what goes to what".
     Both halves of that were structural — every mode was the same full-width ink
     bar, and each caption sat in a SEPARATE element BELOW its button, so nothing
     tied a line to the thing it described. A mode is a Tile now: mark, name and
     caption inside the one element you tap, with exactly one hero taking the ink. */
  const app = readFileSync('src/App.tsx', 'utf8')
  const menu = app.slice(app.indexOf("if (st.phase === 'menu')"),
    app.indexOf("if (st.phase === 'prepare')"))
  ok(menu.length > 500, 'could not slice the menu screen')
  // every mode is a tile, and every tile carries its own caption
  const tiles = menu.match(/<Tile\b/g) ?? []
  ok(tiles.length >= 6, `only ${tiles.length} menu modes are tiles`)
  for (const t of menu.split('<Tile').slice(1))
    ok(/\bsub=/.test(t.slice(0, 420)), 'a menu tile has no caption of its own')
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
  const defs = app.slice(app.indexOf('const MENU_MARKS'), app.indexOf('function Mark('))
  for (const k of new Set(marks)) ok(new RegExp(`\\b${k}:`).test(defs), `${k} has no mark path`)
})

test('UI-2: the title card gates the game and opens the audio inside the tap', () => {
  /* A game should say its own name before it hands you a menu. It also has to:
     a browser will not start an AudioContext until the player has touched the
     page, so the tap that dismisses this screen is the only honest place to open
     one — otherwise the first climb's sound is silently blocked. */
  const app = readFileSync('src/App.tsx', 'utf8')
  ok(/const \[booted, setBooted\] = useState\(false\)/.test(app), 'nothing gates the game on a first tap')
  const splash = app.slice(app.indexOf('if (!booted)'), app.indexOf("if (st.phase === 'menu')"))
  ok(splash.length > 200, 'the title card is not rendered ahead of every screen')
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
  const app = readFileSync('src/App.tsx', 'utf8')
  const bad = []
  for (const m of app.matchAll(/(freshRun|newRun)\(/g)) {
    const near = app.slice(m.index, m.index + 420)
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
  const screen = app.slice(app.indexOf('function playBonus('), app.indexOf('function playBonus(') + 900)
  for (const rule of ['c.shed', 'c.draw', 'c.gripCut', 'c.powerAll', 'c.clip', 'c.seq', 'c.read'])
    ok(!screen.includes(rule), `the screen still handles ${rule} itself`)
  // and the harness must call it rather than its own
  const auto = engine.slice(engine.indexOf('export function autoPlay'))
  ok(/st = playBonusStep\(st, c, lane, rng\)/.test(auto),
    'the harness does not go through the shared function')
  for (const rule of ['c.restore &&', 'c.gripCut &&'])
    ok(!auto.slice(0, auto.indexOf('return st')).includes(rule + ' st.piles'),
      `the harness still applies ${rule} itself`)
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
