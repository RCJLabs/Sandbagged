// ENG-2: the balance harness imports the GAME's engine. One resolution
// function serves both, so the sim can never drift from what ships.
import { build } from 'esbuild'
import { writeFileSync, unlinkSync } from 'node:fs'

const out = 'sim/_bundle.mjs'
await build({
  entryPoints: ['sim/entry.ts'], bundle: true, format: 'esm',
  outfile: out, platform: 'node', logLevel: 'error',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
})
const E = await import('../' + out)
unlinkSync(out)

const N = Number(process.argv[3] ?? 1200)
const mode = process.argv[2] ?? 'ladder'

function session(routeIdx, tier, seed, force) {
  const rng = new E.RNG(seed)
  let s = E.freshRun(routeIdx, tier, seed)
  if (force) s = { ...s, ...force }
  s = E.startBurn(s, rng)
  let turns = 0
  for (let burn = 1; burn <= E.ATTEMPTS; burn++) {
    for (let guard = 0; guard < 40; guard++) {
      s = E.autoPlay(s, rng)
      s = E.resolve(s, rng)
      turns++
      if (s.phase === 'burnEnd') break
    }
    if (s.result === 'send') return { sent: true, burn, turns }
    if (burn >= E.ATTEMPTS) break
    s = E.startBurn({ ...s, beta: [...new Set([...s.beta, ...s.worked])], burn: burn + 1 }, rng)
  }
  return { sent: false, burn: E.ATTEMPTS, turns }
}

function stat(routeIdx, tier, force) {
  let sent = 0, turns = 0, burns = 0
  const rng = new E.RNG(99)
  for (let i = 0; i < N; i++) {
    const r = session(routeIdx, tier, Math.floor(rng.next() * 2 ** 31), force)
    if (r.sent) sent++
    turns += r.turns; burns += r.burn
  }
  return { send: 100 * sent / N, turns: turns / N, burns: burns / N }
}

if (mode === 'ladder') {
  console.log('route                    V   start%   mid%  late%   turns/session   ~min @12s')
  console.log('-'.repeat(78))
  for (let i = 0; i < E.ROUTES.length; i++) {
    const a = stat(i, 0), b = stat(i, 1), c = stat(i, 2)
    console.log(
      `${E.ROUTES[i].name.padEnd(22)} V${E.ROUTES[i].grade}` +
      `${a.send.toFixed(0).padStart(8)}%${b.send.toFixed(0).padStart(6)}%${c.send.toFixed(0).padStart(6)}%` +
      `${b.turns.toFixed(1).padStart(13)}${(b.turns * 12 / 60).toFixed(1).padStart(11)}`)
  }
}

if (mode === 'conditions') {
  const mid = [3, 4, 6, 8]   // Chossmaster, Peeler, The Fridge, Cathedral
  const avg = (force) => mid.reduce((a, i) => a + stat(i, 1, force).send, 0) / mid.length
  console.log('send% across four mid-ladder routes, mid-act deck\n')
  console.log('WEATHER')
  for (let w = 0; w < E.WEATHER.length; w++)
    console.log(`  ${E.WEATHER[w].name.padEnd(10)} ${avg({ weather: w }).toFixed(0).padStart(4)}%`)
  console.log('\nROCK')
  for (let r = 0; r < E.ROCK.length; r++)
    console.log(`  ${E.ROCK[r].name.padEnd(10)} ${avg({ rock: r }).toFixed(0).padStart(4)}%`)
}

/* COND-5. send% by rock AND by the route's style. The `conditions` table above averages the
   rock over four mid-ladder routes that happen to be mixed, crimp ladder and compression — no
   slab, no power, no jug haul — so its single number per rock hides the thing that matters:
   a rock's `boost` MULTIPLIES the style's own hold weights, so how kind it is depends entirely
   on what the line is made of. This is the matrix `forecastScore` needs to be right. */
if (mode === 'rock') {
  const byStyle = new Map()
  E.ROUTES.forEach((r, i) => {
    if (r.finale || r.tutorial || r.grade < 3 || r.grade > 8) return
    const l = byStyle.get(r.style) ?? []
    if (l.length < 4) { l.push(i); byStyle.set(r.style, l) }
  })
  const names = E.ROCK.map(r => r.name)
  console.log(`send% by rock and style — mid-act deck, ${N} sessions per cell\n`)
  console.log('style'.padEnd(15) + names.map(n => n.padStart(11)).join('') + '     spread')
  console.log('-'.repeat(15 + 11 * names.length + 11))
  const rows = []
  for (const [style, idxs] of byStyle) {
    const cells = E.ROCK.map((_, r) =>
      idxs.reduce((a, i) => a + stat(i, 1, { rock: r }).send, 0) / idxs.length)
    rows.push([style, cells])
    const spread = Math.max(...cells) - Math.min(...cells)
    console.log(style.padEnd(15) + cells.map(c => (c.toFixed(0) + '%').padStart(11)).join('')
      + `${spread.toFixed(0).padStart(9)}pt`)
  }
  console.log('')
  for (const [style, cells] of rows) {
    const best = cells.indexOf(Math.max(...cells)), worst = cells.indexOf(Math.min(...cells))
    console.log(`  ${style.padEnd(14)} kindest ${names[best].padEnd(10)} harshest ${names[worst]}`)
  }
}

if (mode === 'costing') {
  const shell = (P, C) => {
    const d = []
    const add = (n, k) => { for (let i = 0; i < k; i++) d.push(E.spawn(n)) }
    add('Smear', 3); add('Shake Out', 2); add('Kneebar', 1); add('Chalk Up', 1)
    for (let i = 0; i < 8; i++) d.push(E.synth(P, C))
    return d
  }
  const probe = [3, 4, 6, 8]
  const score = (P, C) => probe.reduce((a, i) =>
    a + stat(i, 0, { customDeck: shell(P, C) }).send, 0) / probe.length
  console.log('send% — 8 identical hand moves in a 15-card shell, 4 mid-ladder routes\n')
  const cs = [3, 4, 5, 6, 7, 8, 9, 10]
  console.log('      ' + cs.map(c => ('C' + c).padStart(7)).join(''))
  const g = {}
  for (const P of [1, 2, 3, 4]) {
    const row = []
    for (const C of cs) { g[P + ':' + C] = score(P, C); row.push((g[P + ':' + C].toFixed(0) + '%').padStart(7)) }
    console.log(('P' + P).padStart(6) + row.join(''))
  }
  const base = g['2:6'], tgt = g['3:6']
  let best = 6, bd = 1e9
  for (const c of cs) { const d = Math.abs(g['2:' + c] - tgt); if (d < bd) { bd = d; best = c } }
  console.log(`\nP2/C6 ${base.toFixed(0)}%  ·  P3/C6 ${tgt.toFixed(0)}%  ·  closest P2 match C${best} (${g['2:' + best].toFixed(0)}%)`)
  console.log(`=> 1 Power ~ ${best - 6} Contact` + (g['2:10'] < tgt ? '   (still unreachable at C10)' : ''))
}

const EVENT_BIAS = process.argv[4] === 'events'
/* NARR-21. The harness had exactly two opinions about the trail node — never take one, or
   take every single one — and a real player is neither. That mattered more than it looked:
   the whole campaign audit (NARR-16..NARR-20) was closed against those two extremes, so
   `known` ending figures of 0.0% and 51.1% BRACKETED the truth without ever measuring it.
   And NARR-18 is unmeasurable by either, because it changed what the node SAYS and the sim
   cannot read.

   `reads` models the player that node is now written for: they know his pages turn up out
   there, so they take it WHILE THERE ARE STILL PAGES TO FIND, and stop bothering once the
   journal is full. That last clause is why this is a better model than `events` even for an
   enthusiast — `events` keeps spending stages on trail nodes after there is nothing left to
   find, which no informed player does. */
const READS = process.argv[4] === 'reads'
let STYLE = Number(process.env.STYLE ?? 0), LOADOUT = undefined, JOURNAL_PAGES = 0, ARCH = 0
let SHARP_AT = Number(process.env.SHARP_AT ?? 99)
const FORECAST = process.env.FORECAST !== '0'
const TOPROPE = process.env.TOPROPE === '1'
const BOONS_FIRST = process.env.BOONS !== '0'
const LINE_MODE = process.env.LINE ?? 'off'
const DRAFT_ECON = process.env.ECON !== '0'
const MUTS = (process.env.MUT ?? '').split(',').filter(Boolean)
const VAN_UNTIL = Number(process.env.VAN ?? 4)
const PROJECTS = process.env.PROJECTS !== '0'   // does the sim take projects?   // does the sim read the weather?   // rest below this skin, else sharpen
// CARD-9: default OFF, so the drafter still ignores kit and the guarded band is
// unmoved. On, the harness buys a Second Wind at every post and spends it at the
// last fall — the buy-and-spend path the ticket needs to measure the feature.
const KIT_BURN = process.env.KIT_BURN === '1'
function runOnce(seed, carry) {
    const rng = new E.RNG(seed)
    // balance is measured at the real difficulty — TOPROPE=1 to measure the
    // beginner path instead
    let s = E.newRun(seed, LOADOUT, STYLE, ARCH, MUTS)
    s = { ...s, mutators: MUTS, topRope: TOPROPE,
      skin: TOPROPE ? s.skin : Math.max(2, s.skin - E.TOPROPE_SKIN) }
    // NARR-11: was hardcoded [1..6], so it could never grant a page above 6
    if (JOURNAL_PAGES) s = { ...s, journal: E.JOURNAL.filter(j => j.id !== E.SUMMIT_PAGE)
      .map(j => j.id).slice(0, JOURNAL_PAGES) }
    if (carry) s = { ...s, ...carry }
    let turns = 0, climbs = 0, events = 0, talks = 0, projects = 0, shops = 0, fas = 0, rests = 0, winds = 0, guard = 0, skinAtBoss = -1, reachedBoss = false
    /* BAL-13: what an act COSTS, not just how often it kills. Recorded at the boundary
       and nowhere read by the policy, so this cannot move a decision or a roll. */
    let lastAct = s.act
    const actExit = []
    /* The exit value is post-camp, so it says "you can always recover" rather than "you
       were never under pressure". The trough is the one that answers the complaint. */
    let lowSkin = s.skin, lowPsyche = s.psyche, camps = 0
    const ACTS_LAST = E.ACTS.length - 1   // "reached the boss" must mean the LAST one
    while (s.phase !== 'runEnd' && guard++ < 400) {
      if (s.skin < lowSkin) lowSkin = s.skin
      if (s.psyche < lowPsyche) lowPsyche = s.psyche
      if (s.act !== lastAct) {
        actExit.push({ act: lastAct, skin: s.skin, psyche: s.psyche, cash: s.cash,
          deck: s.runDeck.length, turn: turns, lowSkin, lowPsyche, camps })
        lastAct = s.act; lowSkin = s.skin; lowPsyche = s.psyche; camps = 0
      }
      if (s.phase === 'map') {
        /* RUN-14: `tierNodes`, not `ACTS[act][tier]`. The harness was reading the STATIC
           table, so it would have played the unthinned map and reported the change as
           band-neutral while the shipping game played something else — SIM-1's rule and
           ENG-25's failure class in one line. */
        const tier = E.tierNodes(s)
        const camp = tier.find(n => n.type === 'camp')
        const evt = tier.find(n => n.type === 'event')
        const proj = tier.find(n => n.type === 'project')
        const shop = tier.find(n => n.type === 'shop')
        const climb = tier.find(n => n.type === 'climb' || n.type === 'boss')
        let n
        // rest first when hurt — a project is an alternative to a climb, not to a camp
        if (camp && s.skin <= E.RUN_SKIN - E.CAMP_SKIN) n = camp
        // only worth a node if there is enough cash to actually stock up
        else if (shop && E.postOpen(s) && s.cash >= E.PRICE.common) n = shop   // free, so go in
        else if (proj && PROJECTS && s.skin > E.PROJECT_SKIN + 2) n = proj
        else if (evt && EVENT_BIAS) n = evt
        // NARR-21: takes the trail node only while he still has something left to say
        else if (evt && READS && E.nextPage(s) !== null) n = evt
        else if (FORECAST) {
          // read the forecast: take the best-conditioned climb on offer
          const fcs = E.forecastFor(s)
          const climbs = tier.map((x, i) => [x, i]).filter(([x]) => x.type === 'climb' || x.type === 'boss')
          n = climbs.length
            // COND-5: with the route, so the rock counts — it is half of what the forecast says
            ? climbs.reduce((a, b) => (E.forecastScore(fcs[b[1]], E.ROUTES[b[0].routeIdx])
              > E.forecastScore(fcs[a[1]], E.ROUTES[a[0].routeIdx]) ? b : a))[0]
            : (climb ?? tier[0])
        }
        else n = climb ?? tier[0]
        if (n.type === 'camp') {
          camps++
          // talk first if anyone is there — it is free and sometimes pays
          const talk = E.availableTalk(s)
          if (talk) {
            const r = E.repliesFor(talk, s).reduce((a, b) =>
              ((b.outcome?.skin ?? 0) + (b.outcome?.journal ? 3 : 0)
               > (a.outcome?.skin ?? 0) + (a.outcome?.journal ? 3 : 0) ? b : a))
            if (r.outcome) s = E.applyOutcome(s, r.outcome, rng)
            s = { ...s, seen: [...new Set([...s.seen, talk.id])], packCards: [] }
            talks++
          }
          // rest when hurt, otherwise sharpen the best unsharpened card
          const cands = s.runDeck.filter(c => !c.upgraded && c.kind === 'move')
          const copies = n => s.runDeck.filter(c => c.name === n).length
          const best = cands.length
            ? cands.reduce((a, b) => (copies(b.name) * (b.power * 2 + b.contact)
                > copies(a.name) * (a.power * 2 + a.contact) ? b : a))
            : null
          /* SIM-4. The old policy was `skin > SHARP_AT && best`, which sharpens
             unless you are nearly dead — so it almost never rested, and
             `campSkinFor` never entered the decision. That made the *Flash*
             rung, whose entire effect is that camps give back less, invisible
             to every measurement ever taken: Headpoint and Flash returned
             identical numbers to the turn. It now weighs what each option is
             actually worth at this moment. */
          const maxSkin = E.RUN_SKIN + E.styleMods(s.style).skin + (s.topRope ? E.TOPROPE_SKIN : 0)
          const canHeal = Math.min(E.campSkinFor(s), Math.max(0, maxSkin - s.skin))
          const hurt = s.skin <= 3 ? 6 : s.skin <= 5 ? 3 : 1
          const restValue = canHeal * hurt + (s.psyche < E.PSYCHE_MAX ? 3 : 0)
          const sharpValue = (best && !E.styleMods(s.style).noSharpen) ? copies(best.name) * (best.power * 2 + best.contact) * 0.25 : 0
          const held = s.gear.length + s.boons.length
          const vanValue = E.vanOpen(s) && held < VAN_UNTIL ? 9 - held * 2 : 0
          // SHARP_AT stays as an override so old measurements can be reproduced
          const forced = SHARP_AT < 99 ? (s.skin > SHARP_AT && best ? 'sharpen' : 'rest') : null
          const pick = forced ?? (
            restValue >= sharpValue && restValue >= vanValue ? 'rest'
            : sharpValue >= vanValue ? 'sharpen' : 'van')
          const n0 = s.sharpened ?? 0
          s = pick === 'van' ? E.campStep(s, { kind: 'van', rng })
            : pick === 'sharpen' ? E.campStep(s, { kind: 'sharpen', name: best.name })
            : E.campStep(s, { kind: 'rest' })
          if (pick === 'sharpen') s = { ...s, sharpened: n0 + 1 }
          rests += pick === 'rest' ? 1 : 0
          continue
        }
        if (n.type === 'fa') {
          // an unclimbed line: dirty, ungraded, and worth the XP if it goes
          const spec = E.faRoute(s.act, new E.RNG(s.seed ^ (tier.indexOf(n) * 7919)))
          s = E.startBurn({ ...s, skirmish: spec, burn: 1, beta: [], worked: [],
            weather: rng.int(E.WEATHER.length), rock: rng.int(E.ROCK.length) }, rng)
          climbs++; fas++
          continue
        }
        if (n.type === 'shop') {
          // NARR-4: somebody is behind the counter
          const pt = E.postTalk(s)
          if (pt) {
            const r = pt.replies[0]
            if (r?.outcome) s = E.applyOutcome(s, r.outcome, rng)
            s = { ...s, seen: [...new Set([...s.seen, pt.id])], packCards: [] }
            talks++
          }
          s = E.stockShop(s, rng)
          // buy the best card the deck actually wants, then gear, then tape
          /* BAL-5: it bought up to six cards a visit, and every card past the
             ones you need dilutes the draw. Now it buys only what beats what it
             already has, which is what a player weighing a purchase does. */
          let guard2 = 0
          while (guard2++ < 2) {
            const affordable = s.shopCards.filter(c => E.priceOf(c) <= s.cash)
            const pick = E.bestOffer(s, affordable, s.runDeck)
            if (!pick) break
            // is it actually better than the deck's median card?
            const vals = s.runDeck.map(c => E.cardValue(s, c, s.runDeck)).sort((a, b) => a - b)
            const median = vals[Math.floor(vals.length / 2)] ?? 0
            if (E.cardValue(s, pick, s.runDeck) <= median) break
            s = { ...s, cash: s.cash - E.priceOf(pick), runDeck: [...s.runDeck, pick],
              shopCards: s.shopCards.filter(c => c.uid !== pick.uid) }
          }
          for (const id of s.shopGear) {
            const b = E.boonById(id), g = b ? null : E.gearById(id)
            const cost = b ? E.PRICE.boon : E.PRICE.gear
            if (s.cash < cost) continue
            s = b ? { ...s, cash: s.cash - cost, boons: [...s.boons, b.id] }
              : { ...s, cash: s.cash - cost,
                  gear: [...s.gear.filter(x => E.gearById(x)?.slot !== g.slot), g.id] }
          }
          if (s.cash >= E.PRICE.skin && s.skin <= E.RUN_SKIN - 2)
            s = { ...s, cash: s.cash - E.PRICE.skin, skin: s.skin + 2 }
          // CARD-9: a player who values the safety net buys a Second Wind while
          // there is room and cash for it — a real cash sink, weighed after cards.
          if (KIT_BURN && s.kit.length < E.KIT_MAX && s.cash >= E.PRICE.kit)
            s = { ...s, cash: s.cash - E.PRICE.kit, kit: [...s.kit, 'secondwind'] }
          shops++
          s = E.leaveShopStep(s)   // BAL-5: a post does not cost you the stage
          continue
        }
        if (n.type === 'project') {
          const fc = E.forecastFor(s); const idx = tier.indexOf(n)
          const f = fc[idx] ?? { weather: 1, rock: 0 }
          s = E.startBurn({ ...s, routeIdx: n.routeIdx, onProject: true, burn: 1, beta: [], worked: [],
            skin: s.skin - E.PROJECT_SKIN, weather: f.weather, rock: f.rock }, rng)
          climbs++; projects++
          continue
        }
        if (n.type === 'event') {
          const ev = E.rollEvent(rng, s.act, s.eventsSeen, s.eventChose)
          // policy: take the choice that is not a pure skin sink
          const pick = ev.choices.reduce((a, b) => ((b.outcome.skin ?? 0) > (a.outcome.skin ?? 0) ? b : a))
          // EVT-4: record which branch, or a callback can never fire for the sim
          const ci = ev.choices.indexOf(pick)
          s = E.applyOutcome(s, pick.outcome, rng)
          s = { ...s, eventChose: [...new Set([...s.eventChose, ev.id + ':' + ci])] }
          s = E.leaveEventStep({ ...s, eventId: ev.id, packCards: [] })
          events++
          continue
        }
        if (n.type === 'boss') { reachedBoss = reachedBoss || s.act === ACTS_LAST; skinAtBoss = s.skin }
        // the forecast is visible now — a climber picks the friendliest line
        const fc = E.forecastFor(s)
        const idx = tier.indexOf(n)
        const f = fc[idx] ?? { weather: 1, rock: 0 }
        // pick the line that suits the deck: power wants the direct, a deck
        // that survives wants the traverse
        const pow = s.runDeck.reduce((a, c) => a + c.power, 0) / Math.max(1, s.runDeck.length)
        const line = !E.lineCanVary(E.ROUTES[n.routeIdx]) ? 0 : (LINE_MODE === 'auto'
          ? (pow >= 1.6 ? 1 : 2) : LINE_MODE === 'off' ? 0 : Number(LINE_MODE))
        s = E.startBurn({ ...s, routeIdx: n.routeIdx, line, burn: 1, beta: [], worked: [],
          weather: f.weather, rock: f.rock }, rng)
        climbs++; continue
      }
      if (s.phase === 'climb') {
        s = E.autoPlay(s, rng)
        // on a rope, get a piece in when the runout is getting long
        const spec = E.ROUTES[s.routeIdx]
        if (spec?.roped && (s.runout >= 3 || s.lastPiece < 0)) {
          const piece = s.piles.hand.find(c => c.clip)
          const lane = [0, 1, 2].find(i => !s.boardP[i] && s.boardH[i])
          if (piece && lane !== undefined) {
            const bp = s.boardP.slice(); bp[lane] = piece
            s = { ...s, boardP: bp, piles: { ...s.piles, hand: s.piles.hand.filter(c => c.uid !== piece.uid) } }
          }
        }
        s = E.resolve(s, rng); turns++; continue
      }
      if (s.phase === 'burnEnd') {
        const beta = [...new Set([...s.beta, ...s.worked])]
        if (s.result === 'send') { s = E.endSession({ ...s, beta }, rng); continue }
        const skin = s.skin - 1 - E.boonMods(s.boons).dFallSkin
        s = { ...s, psyche: Math.max(0, s.psyche - (E.exposed(s) ? E.EXPOSED_FALL_PSYCHE : 0)) }
        // CARD-9: out of burns but carrying a Second Wind and still on your feet?
        // Spend it — it raises the cap, so the check below lets the retry run.
        if (KIT_BURN && s.burn >= E.attemptsFor(s) && skin > 0
            && s.kit.some(id => E.consumableById(id)?.burn)) {
          s = E.secondWindStep(s, s.kit.find(id => E.consumableById(id)?.burn))
          winds++   // GUARD-1: report the mechanism, not just its shadow on the band
        }
        if (s.burn >= E.attemptsFor(s) || skin <= 0) { s = E.endSession({ ...s, beta, skin }, rng); continue }
        s = E.startBurn({ ...s, beta, skin, burn: s.burn + 1 }, rng); continue
      }
      if (s.phase === 'pack') { s = { ...s, packCards: [], phase: s.afterPack }; continue }
      // SIM-1: every screen transition now goes through the engine, so the
      // harness cannot reimplement the flow differently from the game.
      if (s.phase === 'gear') {
        // prefer a rule-breaker when one is on offer — that is the interesting line
        const boon = s.gearOffers.find(id => E.isBoon(id))
        s = E.pickGearStep(s, (BOONS_FIRST && boon) || s.gearOffers[0] || null)
        continue
      }
      // the top of the finale: take the ascent and write it in the book
      if (s.phase === 'epilogue') { s = E.endingStep(s, 'told'); continue }
      if (s.phase === 'claim') {
        // claim it at what it actually is
        s = { ...s, skirmish: null, phase: 'map', tier: s.tier + 1, faSent: (s.faSent ?? 0) + 1 }
        continue
      }
      if (s.phase === 'reward') {
        // SIM-2: the drafter uses the engine's valuation. RUN-6: it will also
        // spend cash when the shelf is poor, and never takes the curse deal.
        if (DRAFT_ECON) {
          const mean = s.runDeck.length
            ? s.runDeck.reduce((a, c) => a + E.cardValue(s, c, s.runDeck), 0) / s.runDeck.length : 0
          const best = E.bestOffer(s, s.offers, s.runDeck)
          const poor = !best || E.cardValue(s, best, s.runDeck) < mean * 1.1
          if (poor && s.cash >= E.CROP_COST) { s = E.cropStep(s, rng) }
          else if (poor && s.cash >= E.rerollCost(s.rerolls) && s.rerolls < 2) { s = E.rerollStep(s, rng) }
        }
        s = E.takeOfferStep(s, E.bestOffer(s, s.offers, s.runDeck))
        continue
      }
      break
    }
    return { seenOut: s.seen, journalOut: s.journal, won: s.phase === 'runEnd' && s.result === 'send', tier: s.tier, act: s.act, turns, climbs,
      deck: s.runDeck.length, skin: s.skin, skinAtBoss, reachedBoss, events, gear: s.gear.length,
      trail: s.trail.length, journal: s.journal.length, talks, projects, shops, fas, rests, faSent: s.faSent ?? 0,
      winds,
      cash: s.cash, psyche: s.psyche, actExit,
      held: s.gear.length + s.boons.length,
      killedBy: s.result === 'send' ? 'won' : (s.psyche <= 0 ? 'psyche' : s.skin <= 0 ? 'skin' : 'route'),
      sharpened: s.sharpened ?? 0,
      feet: s.runDeck.filter(c => c.lane === 'feet').length }
}

if (mode === 'run') {
  let won = 0, turns = 0, deck = 0, climbs = 0, boss = 0, sab = 0, feet = 0, evs = 0, jrn = 0
  const diedAt = {}
  const rng = new E.RNG(2026)
  for (let i = 0; i < N; i++) {
    const r = runOnce(Math.floor(rng.next() * 2 ** 31))
    if (r.won) won++; else diedAt[r.tier] = (diedAt[r.tier] ?? 0) + 1
    turns += r.turns; deck += r.deck; climbs += r.climbs; feet += r.feet
    evs += r.events; jrn += r.journal
    if (r.reachedBoss) { boss++; sab += r.skinAtBoss }
  }
  console.log(`ACT 1 RUN — ${N} runs, greedy reward policy\n`)
  console.log(`  completion      ${(100 * won / N).toFixed(1)}%`)
  console.log(`  climbs / run    ${(climbs / N).toFixed(1)}`)
  console.log(`  deck at end     ${(deck / N).toFixed(1)} cards`)
  console.log(`  turns / run     ${(turns / N).toFixed(0)}  (~${(turns / N * 12 / 60).toFixed(0)} min @12s)`)
  console.log(`  reached boss    ${(100 * boss / N).toFixed(1)}%   skin on arrival ${(sab / Math.max(1, boss)).toFixed(1)}/${E.RUN_SKIN}`)
  console.log(`  boss send%      ${(100 * won / Math.max(1, boss)).toFixed(1)}%   feet cards ${(feet / N).toFixed(1)}`)
  console.log(`  events taken    ${(evs / N).toFixed(1)}   journal pages ${(jrn / N).toFixed(2)}`)
  console.log('\n  runs ended at stage:')
  for (const k of Object.keys(diedAt).sort((a, b) => a - b))
    console.log(`    stage ${Number(k) + 1}  ${(100 * diedAt[k] / N).toFixed(1)}%`)
}

if (mode === 'cards') {
  // per-card probe: swap one copy into a fixed shell and measure the delta.
  const probe = [3, 4, 6]
  const base = () => {
    const d = []
    for (let i = 0; i < 3; i++) d.push(E.spawn('Crimp Grip'))
    for (let i = 0; i < 3; i++) d.push(E.spawn('Open Hand'))
    for (let i = 0; i < 2; i++) d.push(E.spawn('Lock Off'))
    for (let i = 0; i < 3; i++) d.push(E.spawn('Smear'))
    for (let i = 0; i < 2; i++) d.push(E.spawn('Shake Out'))
    d.push(E.spawn('Kneebar'))
    return d
  }
  const score = deck => probe.reduce((a, i) => a + stat(i, 0, { customDeck: deck }).send, 0) / probe.length
  const ctrl = score(base())
  const rows = []
  /* CARD-18: the whole table is ~240 cards x 3 routes and takes over nine minutes,
     which is why nobody ran it. CARDS_ONLY='A|B' probes just the ones you are
     asking about, so pricing one keyword costs seconds instead. */
  const only = process.env.CARDS_ONLY ? process.env.CARDS_ONLY.split('|') : null
  for (const name of Object.keys(E.CARDS)) {
    const c = E.CARDS[name]
    if (only && !only.includes(name)) continue
    if (c.rarity === 'starter') continue
    const d = base(); for (let k = 0; k < 3; k++) d.push(E.spawn(name))
    rows.push({ name, r: c.rarity, d: score(d) - ctrl })
  }
  rows.sort((a, b) => b.d - a.d)
  console.log(`control ${ctrl.toFixed(1)}% · delta from adding 3 copies\n`)
  console.log('STRONGEST'); rows.slice(0, 8).forEach(r => console.log(`  ${(r.d >= 0 ? '+' : '') + r.d.toFixed(1)}pt  ${r.name} (${r.r})`))
  console.log('\nWEAKEST'); rows.slice(-8).forEach(r => console.log(`  ${(r.d >= 0 ? '+' : '') + r.d.toFixed(1)}pt  ${r.name} (${r.r})`))
  // absolute deltas are dominated by shell weakness, so compare WITHIN rarity
  const byR = {}
  for (const r of rows) (byR[r.r] ??= []).push(r)
  console.log('\nmean delta by rarity (the shell is weak, so absolutes run high):')
  const stats = {}
  for (const k of Object.keys(byR)) {
    const v = byR[k].map(x => x.d)
    const m = v.reduce((a, b) => a + b, 0) / v.length
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1
    stats[k] = { m, sd }
    console.log(`  ${k.padEnd(9)} ${m >= 0 ? '+' : ''}${m.toFixed(1)}pt  (sd ${sd.toFixed(1)}, n=${v.length})`)
  }
  const bad = rows.filter(r => r.r !== 'curse' && Math.abs(r.d - stats[r.r].m) > 2 * stats[r.r].sd)
  console.log(`\nwithin-rarity outliers (>2sd): ${bad.length ? bad.map(b => `${b.name} ${b.d >= 0 ? '+' : ''}${b.d.toFixed(0)}`).join(', ') : 'none'}`)
}

/* SIM-8. This used to be the harness's OWN deck builder: sort every card by
   `power * 2 + contact` (bonuses at a flat 7) and take the top ones. Two things were
   wrong with it and the second is why the pinned band moved.

   (1) It was blind to every keyword in the game — shed, Support, fx, anchor, latch, chip,
   opposition, synergy, restChip, read — while the harness's IN-RUN picks went through the
   engine's real `cardValue`. The measured campaign started with a stat-greedy deck and
   then drafted like a competent player, which is nobody.

   (2) It measured an ILLEGAL deck. It capped rares and uncommons but not BETA rarity, and
   `copyLimit('beta')` is 3 — so the top of a raw stat sort pulled in three
   `Beta · Going Alone` (4/8) and three `Beta · Being Frightened` (3/7), SIX of the fifteen
   slots, in cards `buildable()` refuses outright. Measured worth: +10.5 points. The ~52
   pin was set on a deck no player can hold.

   The engine builds a deck — `buildLoadout`, what the BUILD ME ONE button calls, with the
   slot rules SIM-7 gave it — so the band measures THAT. One builder (ENG-19), and the
   number describes the deck the game would actually hand you. */
function buildBest() {
  // what a player can actually collect: packs roll common/uncommon/rare and `buildable`
  // adds the starters. Beta and curse are not collectible.
  const owned = Object.keys(E.CARDS)
    .filter(n => ['common', 'uncommon', 'rare'].includes(E.CARDS[n].rarity ?? 'common'))
  const st = { ...E.freshRun(0, 0, 1), owned, gear: [], boons: [], mutators: [], arch: ARCH }
  return E.buildLoadout(st, [], owned)
}

if (mode === 'loadout') {
  const built = buildBest()
  console.log('built loadout:', [...new Set(built)].map(n => `${n} x${built.filter(x => x === n).length}`).join(' · '))
  console.log('')
  const decks = { default: E.DEFAULT_LOADOUT, built }
  console.log(`${'route'.padEnd(22)}${'default'.padStart(9)}${'built'.padStart(8)}`)
  for (let i = 0; i < E.ROUTES.length; i++) {
    const a = stat(i, 0, { customDeck: E.loadoutDeck(decks.default) }).send
    const b = stat(i, 0, { customDeck: E.loadoutDeck(decks.built) }).send
    console.log(`${E.ROUTES[i].name.padEnd(22)}${a.toFixed(0).padStart(8)}%${b.toFixed(0).padStart(7)}%`)
  }
}

if (mode === 'ladder-style') {
  const useBuilt = process.argv[4] === 'built'
  JOURNAL_PAGES = 6
  if (useBuilt) LOADOUT = buildBest()
  console.log(`Act 1 completion by ascent style — ${useBuilt ? 'BUILT' : 'default'} loadout\n`)
  console.log(`${'style'.padEnd(14)}${'completion'.padStart(12)}${'reached the finale'.padStart(12)}${'turns'.padStart(8)}`)
  for (let i = 0; i < E.ASCENT.length; i++) {
    STYLE = i
    let won = 0, boss = 0, turns = 0
    const rng = new E.RNG(4242)
    for (let k = 0; k < N; k++) {
      const r = runOnce(Math.floor(rng.next() * 2 ** 31))
      if (r.won) won++; if (r.reachedBoss) boss++; turns += r.turns
    }
    console.log(`${E.ASCENT[i].name.padEnd(14)}${(100 * won / N).toFixed(1).padStart(11)}%` +
      `${(100 * boss / N).toFixed(0).padStart(11)}%${(turns / N).toFixed(0).padStart(8)}`)
  }
}

if (mode === 'campaign') {
  LOADOUT = buildBest()
  const label = process.argv[4] ?? 'built'
  if (label === 'default') LOADOUT = undefined
  console.log(`Full campaign — ${label} loadout, Working It\n`)
  /* GUARD-6: most guards read only the full-journal band but paid for all three,
     so two runs in three were thrown away. `PAGES=14` measures one band, which
     buys a 3x bigger sample for the same wall-clock — spend it on the guards
     whose margins are tightest rather than on numbers nobody reads. */
  const BANDS = process.env.PAGES !== undefined
    ? [Number(process.env.PAGES)] : [0, 7, 14]
  for (const pages of BANDS) {
    JOURNAL_PAGES = pages
    let won = 0, turns = 0, talksT = 0, pagesT = 0, restsT = 0, windsT = 0
    const diedAct = [0, 0, 0]
    const rng = new E.RNG(777)
    for (let i = 0; i < N; i++) {
      const r = runOnce(Math.floor(rng.next() * 2 ** 31))
      if (r.won) won++; else diedAct[r.act]++
      turns += r.turns; talksT += r.talks; pagesT += r.journal
 restsT += r.rests ?? 0
      windsT += r.winds ?? 0
    }
    console.log(`  journal ${pages}/14 → completion ${(100 * won / N).toFixed(1).padStart(5)}%` +
      `   turns ${(turns / N).toFixed(0).padStart(3)} (~${(turns / N * 12 / 60).toFixed(0)} min)` +
      `   died: act1 ${(100 * diedAct[0] / N).toFixed(0)}% act2 ${(100 * diedAct[1] / N).toFixed(0)}% act3 ${(100 * diedAct[2] / N).toFixed(0)}%` +
      `   talks ${(talksT / N).toFixed(1)} rests ${(restsT / N).toFixed(1)} pages ${(pagesT / N).toFixed(1)}` +
      `   winds ${windsT}`)
  }
  JOURNAL_PAGES = 0
}

/* BAL-13: act 1 is a formality — it kills ~3% of runs against act 3's 34%, so the first
   twenty minutes cannot go wrong. Two attempts have failed: v9.36 tried route length and
   took the climber spread from 1.4x to 2.9x, and v9.88's boss phases were measured
   band-neutral because the early bosses are not the completion bottleneck.
   This measures what act 1 actually COSTS rather than how often it kills, because
   "cannot go wrong" and "rarely kills" are different claims and only the first is the
   complaint. If every run leaves act 1 in the same shape, act 1 has no consequences at
   all — and that is a sharper problem than a low death rate, with different fixes. */
if (mode === 'acts') {
  LOADOUT = buildBest()
  console.log('What each act costs — state on the way OUT of it\n')
  const rng = new E.RNG(777)
  const per = [[], [], []]
  let died = [0, 0, 0], won = 0
  for (let i = 0; i < N; i++) {
    const r = runOnce(Math.floor(rng.next() * 2 ** 31))
    if (r.won) won++; else died[r.act]++
    for (const e of r.actExit) if (per[e.act]) per[e.act].push(e)
  }
  const stat = (xs, k) => {
    const v = xs.map(x => x[k]).sort((a, b) => a - b)
    if (!v.length) return '   —  '
    const mean = v.reduce((a, b) => a + b, 0) / v.length
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length)
    return `${mean.toFixed(1).padStart(5)} ±${sd.toFixed(1).padStart(4)}  [${v[0]}–${v[v.length - 1]}]`
  }
  console.log('act  reached   LOWEST skin       LOWEST psyche     camps             exit skin         deck')
  for (let a = 0; a < 3; a++) {
    const xs = per[a]
    console.log(`  ${a + 1}  ${String(xs.length).padStart(5)}   ` +
      ['lowSkin', 'lowPsyche', 'camps', 'skin', 'deck'].map(k => stat(xs, k).padEnd(18)).join(''))
  }
  // how often did the act ever put you in real trouble?
  for (let a = 0; a < 2; a++) {
    const xs = per[a]; if (!xs.length) continue
    const tight = xs.filter(x => x.lowSkin <= 3).length
    const shaken = xs.filter(x => x.lowPsyche <= 1).length
    console.log(`  act ${a + 1}: skin ever <=3 on ${(100 * tight / xs.length).toFixed(1)}% of runs, ` +
      `psyche ever <=1 on ${(100 * shaken / xs.length).toFixed(1)}%`)
  }
  console.log(`\n  died: act1 ${(100 * died[0] / N).toFixed(1)}%  act2 ${(100 * died[1] / N).toFixed(1)}%  ` +
    `act3 ${(100 * died[2] / N).toFixed(1)}%   completed ${(100 * won / N).toFixed(1)}%`)
  /* THE POINT OF THE TABLE: the spread, not the mean. A run that can go wrong leaves an
     act in a range of states; a formality leaves every run in the same one. */
  const sd = a => {
    const v = per[a].map(x => x.skin)
    if (!v.length) return 0
    const m = v.reduce((x, y) => x + y, 0) / v.length
    return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / v.length)
  }
  console.log(`  skin spread leaving each act: act1 ±${sd(0).toFixed(2)}  act2 ±${sd(1).toFixed(2)}\n`)
}

if (mode === 'arch') {
  console.log('Campaign completion by climber — own loadout, full journal, Working It\n')
  console.log(`${'climber'.padEnd(16)}${'signature'.padEnd(15)}${'completion'.padStart(11)}${'turns'.padStart(8)}${'sharp'.padStart(9)}${'proj'.padStart(8)}${'shops'.padStart(7)}${'held'.padStart(7)}${'died: psyche'.padStart(10)}${'skin'.padStart(11)}`)
  JOURNAL_PAGES = 6; LOADOUT = undefined
  /* BAL-16: `ARCH_ONLY=<index>` measures one climber. The spread guard needs a coarse pass
     over all five and then a FINE one on whichever came out lowest — the floor is a claim
     about that climber alone, and paying for 2,500 runs of the other four to resolve it is
     the waste GUARD-6 went after. */
  const only = process.env.ARCH_ONLY === undefined ? null : Number(process.env.ARCH_ONLY)
  for (let a = 0; a < E.ARCHETYPES.length; a++) {
    if (only !== null && a !== only) continue
    ARCH = a
    let won = 0, turns = 0, sh = 0, pj = 0, cashLeft = 0, shopsT = 0, heldT = 0, restsT = 0
    const kill = { won: 0, psyche: 0, skin: 0, route: 0 }
    const rng = new E.RNG(555)
    for (let i = 0; i < N; i++) {
      const r = runOnce(Math.floor(rng.next() * 2 ** 31))
      if (r.won) won++; turns += r.turns; sh += r.sharpened; pj += r.projects
      cashLeft += r.cash; shopsT += r.shops; heldT += r.held; restsT += r.rests ?? 0
      kill[r.killedBy]++
    }
    console.log(`${E.ARCHETYPES[a].name.padEnd(16)}${E.ARCHETYPES[a].sig.padEnd(15)}` +
      `${(100 * won / N).toFixed(1).padStart(10)}%${(turns / N).toFixed(0).padStart(8)}` +
      `${(sh / N).toFixed(1).padStart(9)}${(pj / N).toFixed(1).padStart(8)}` +
      `${(shopsT / N).toFixed(1).padStart(7)}${(heldT / N).toFixed(1).padStart(7)}` +
      `${('psy ' + (100 * kill.psyche / N).toFixed(0) + '%').padStart(10)}` +
      `${('skin ' + (100 * kill.skin / N).toFixed(0) + '%').padStart(11)}`)
  }
  ARCH = 0
}

/* NARR audit: how a CAREER reads, not a run. Talks chain by `after` and gate on
   journal pages; both `seen` and `journal` are account state that carryOver now
   keeps (SAVE-7). So the question is not "how many talks in a run" but "how many
   expeditions before the story finishes". */
if (mode === 'career') {
  const TRIPS = Number(process.env.TRIPS ?? 10)
  LOADOUT = buildBest()
  const rng = new E.RNG(777)
  const firstSeen = new Map()   // talk id -> [trip index...]
  const pagesAt = [], talksAt = [], wonAt = []
  const END = { known: 0, partial: 0, stranger: 0 }
  let finished = 0, finishTrip = []
  for (let c = 0; c < N; c++) {
    let carry = { seen: [], journal: [] }
    let done = -1
    for (let t = 0; t < TRIPS; t++) {
      const r = runOnce(Math.floor(rng.next() * 2 ** 31), carry)
      // page 7 is the summit page: only a completed expedition brings it back
      const j = r.won ? [...new Set([...r.journalOut, E.SUMMIT_PAGE])] : r.journalOut
      carry = { seen: r.seenOut, journal: j }
      pagesAt[t] = (pagesAt[t] ?? 0) + j.length
      talksAt[t] = (talksAt[t] ?? 0) + r.seenOut.filter(x => E.TALKS.some(k => k.id === x)).length
      wonAt[t] = (wonAt[t] ?? 0) + (r.won ? 1 : 0)
      for (const id of r.seenOut) {
        if (!E.TALKS.some(k => k.id === id)) continue
        const a = firstSeen.get(id) ?? []
        if (!a.includes(c)) { a.push(c); firstSeen.set(id, a) }
      }
      if (done < 0 && E.TALKS.every(k => carry.seen.includes(k.id))) done = t
      if (r.won) END[E.endingFor({ journal: r.journalOut.includes(7) ? r.journalOut : [...r.journalOut, 7] })]++
    }
    if (done >= 0) { finished++; finishTrip.push(done + 1) }
  }
  console.log(`${N} careers x ${TRIPS} expeditions\n`)
  console.log('trip   completed%   talks seen (cum)   journal pages (cum)')
  for (let t = 0; t < TRIPS; t++)
    console.log(`  ${String(t + 1).padStart(2)}   ${(100 * wonAt[t] / N).toFixed(1).padStart(8)}%   ` +
      `${(talksAt[t] / N).toFixed(1).padStart(14)}/${E.TALKS.length}   ${(pagesAt[t] / N).toFixed(1).padStart(14)}/15`)
  console.log(`\n  all ${E.TALKS.length} talks seen within ${TRIPS} trips: ${(100 * finished / N).toFixed(1)}%` +
    (finishTrip.length ? `  (median trip ${finishTrip.sort((a,b)=>a-b)[Math.floor(finishTrip.length/2)]})` : ''))
  const tot = END.known + END.partial + END.stranger
  console.log(`\n  epilogue over ${tot} wins: known ${(100*END.known/tot).toFixed(1)}%  partial ${(100*END.partial/tot).toFixed(1)}%  stranger ${(100*END.stranger/tot).toFixed(1)}%   (known needs ${E.KNOWN_AT}, partial ${E.PARTIAL_AT} of ${E.FINDABLE})`)
  console.log('\n  talk                     careers reaching it')
  for (const k of E.TALKS)
    console.log(`  ${k.id.padEnd(10)} ${k.who.padEnd(14)} ${(100 * (firstSeen.get(k.id)?.length ?? 0) / N).toFixed(1).padStart(6)}%`)
}
