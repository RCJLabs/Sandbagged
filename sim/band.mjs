/* SANDBAGGED — the band ledger.
 *
 * GUARD-10. Every ticket in this project measures the campaign band and writes the number into
 * the ROADMAP, and for eight versions running that discipline was enough to see nothing wrong:
 * COND-2 read −0.5, COND-3 +0.5, COND-4 −0.1, COND-5 −0.4, LANE-1 −1.7, DECK-4 −0.2, SEQ-3 −0.5.
 * Every one of them inside its own standard error, every one honestly reported band-neutral —
 * and the sum of them walked the band from the 44.3 it was pinned at down to 42.1.
 *
 * That is BAL-14's failure mode exactly ("six changes each worth a point or two, compounding"),
 * which the ledger guard in test.mjs exists to catch. It did not catch it, and it was not broken:
 * it reads `campaign 300`, where the standard error is about 2.9 points, so its tolerance has to
 * be ±6 to avoid crying wolf — and a ±6 window cannot see a 2.2-point slide. Buying the
 * resolution in simulation would cost about 9,000 extra campaign runs on a slow suite that
 * already runs 11,300.
 *
 * So the number is bought once, by hand, by whoever ships the version — at n=3000, where the
 * standard error is 1.3 — and written down here. This file is data; the guard over it is in
 * test-core.mjs and costs nothing to run, so it runs on every `npm run check`.
 *
 * WHAT THIS BUYS: you cannot bump the version without recording a band, and you cannot record a
 * band more than BAND_TOL from the pin without either paying it back or re-pinning deliberately
 * and saying so. Applied to the history below, a pin of 44.3 and a tolerance of 2.0 would have
 * failed at v10.62 — one ticket later than ideal, but it would have failed, and the drift would
 * have been argued about instead of accumulating.
 *
 * HOW TO MEASURE: `PAGES=14 SHARP_AT=99 node sim/run.mjs campaign 3000`, the full-journal arm.
 * That is the same measurement the pin is expressed in and the same one the ROADMAP quotes.
 *
 * NARR-22 ADDED A SECOND COLUMN, and it is here for a different reason than the band is.
 * The known-ending rate had slid 43.1% to 25.1% over twenty-one versions in exactly the same
 * way, and finding out where cost a version-by-version bisection — nine measurements, because
 * no version had written its number down. That number is CHEAP to measure (75 seconds), so
 * unlike the band it is policed by a real band in the suite: the NARR-22 guard in test.mjs owns
 * the pin and the tolerance. This column is not a second guard on the value. It is the history,
 * so the next slide is a file somebody reads instead of a bisection somebody runs.
 *
 * HOW TO MEASURE IT: `TRIPS=8 node sim/run.mjs career 240 reads`, and take the line that says
 * "careers reaching the known ending". Careers, not wins — see the NARR-22 note in test.mjs for
 * why the wins ratio falls when the game gets better.
 *
 * BAL-18 ADDED THE THIRD COLUMN, and it is the one whose absence cost the most.
 *
 * The climber ladder was the only guarded quantity in the project with NO record at all, and the
 * guard over it could not have caught a drift if it wanted to. It runs a coarse pass at n=600,
 * takes the two lowest, and fine-measures those at n=2000 — on the stated grounds that "the other
 * three climbers cannot hold the floor and there is no reason to pay for them". That was true
 * when the roster spanned 3.3 to 29.8. It is not true now, and both halves fail:
 *
 *   THE COARSE PASS CANNOT RANK THE ROSTER IT IS RANKING. At v10.65 four of the five sit inside
 *   0.5 points at n=600, where the standard error is about 1.0. It reported Boulderer 6.7, Comp
 *   Kid 6.8, Alpinist 7.0, Trad Dad 7.2 and picked {Boulderer, Comp Kid} as the bottom two. At
 *   n=2000 the truth is Comp Kid 6.8, Alpinist 7.0, Boulderer 7.7, Trad Dad 7.8 — so it named the
 *   FOURTH climber as the lowest and left the second-lowest unmeasured. It passed anyway, because
 *   the pair it happened to pick contained the real minimum. That is luck, not a measurement.
 *
 *   AND THE LADDER MOVES SEVERAL POINTS A RELEASE, which nobody knew because nobody wrote it
 *   down. Backfilled below: the Boulderer runs 11.1 → 12.9 → 7.7, the Onsighter 8.6 → 14.0 →
 *   10.0. A 5.4-point swing on a climber that has never once been fine-measured, because at 14.0
 *   it is nowhere near last. LANE-1 (v10.60) lifted the whole roster 2–3 points in one version.
 *   None of that was visible to anybody at the time, and finding the Alpinist's share of it cost
 *   NARR-22 a five-measurement bisection.
 *
 * SO THE LEDGER RECORDS ALL FIVE, and the guard in test.mjs takes its RANKING from here instead
 * of paying 3,000 runs for a worse one. That is cheaper as well as better: the slow suite drops
 * from 7,000 runs (3,000 coarse + 4,000 fine) to 4,000, and the fine pass now lands on the two
 * climbers the ledger says are lowest.
 *
 * AND UNLIKE THE BAND, THIS COLUMN IS CHECKABLE. The note above admits the guard cannot tell a
 * real band from an invented one, because n=3000 campaigns is too dear to re-run. One climber at
 * n=2000 is not: the fine pass re-measures the two the ledger names and refuses a number more
 * than ARCH_TOL from what was written down, so a stale or invented ladder fails where it matters.
 *
 * HOW TO MEASURE IT: `PROJECTS=0 node sim/run.mjs arch 2000` — all five, about five minutes,
 * in the order `ARCHETYPES` declares them.
 */

/** The band the game is aimed at, in the CARD-15 sense: a number somebody chose, with a date.
    LANE-4 re-pinned it 45 -> 48 on 2026-08-21, with Evan, and LANE-5 re-pinned it 48 -> 60 the
    same day, once the two climbers the feet urgency had been propping up were paid for directly.
    That is the largest deliberate move this pin has ever made and it was argued before it landed:
    the urgency was 82% of the valuation preferring a deck that loses by 10.9 points, and removing
    it is worth +14.8 with the roster intact. The known-ending pin in test.mjs moved in the same breath (62.9 -> 68.8):
    one lever moved both, and re-pinning one and not the other is the stale-copy failure NARR-22
    and BAL-18 both had to clean up. */
export const BAND_PIN = 60
/** About 1.5 standard errors at n=3000. Tight enough to see the 2.2-point slide above; loose
    enough that one honest band-neutral ticket does not fail on noise. */
export const BAND_TOL = 2.0
/** The sample the recorded numbers must be measured at, so a cheap reading cannot be passed off
    as a dear one. */
export const BAND_N = 3000
/** NARR-22: the sample the `ending` column is measured at. Kept here rather than in the guard
    so the ledger and the band in test.mjs cannot quietly disagree about what the number means —
    and since CARD-20 the guard reads it from here, so they structurally cannot.
    CARD-20 RAISED IT 240 -> 720 (2026-08-22, ~4 minutes a run, GUARD-6 says state the cost):
    at 240 the FIXED SLICE DIVERGES +-6 BETWEEN NEARLY-IDENTICAL ENGINES — same seed, same
    careers, but an engine change re-deals every climb after its first divergence, and at 240
    that resampling is as wide as the tolerance policing real damage. Strip-only arms read 82.5
    at 240 and 78.2 at 720; v10.71 itself reads 77.6 at 720 against the 82.1 it recorded at
    240. Entries from v10.72 on are 720-career readings; the column before that line is 240 and
    the two are NOT comparable across it. */
export const ENDING_N = 720
/** BAL-18: the sample the climber ladder is recorded at, and the one the fine pass re-measures
    at. The floor is asserted in standard errors, so the sample is part of the claim. */
export const ARCH_N = 2000
/** BAL-18: the floor every climber has to clear, which has been 5 since v9.35 and was lowered to
    4 once at v9.32 to accommodate a drift instead of fixing it — the thing BAL-9 exists to
    forbid. It lives HERE, not as a literal in the guard, because two places held the band pin and
    one of them sat two versions stale (see the NARR-22 note in test.mjs). */
export const ARCH_FLOOR = 5
/** BAL-18: how far a fine re-measurement may sit from the recorded ladder before the entry is
    called stale. About 2.7 SE at ARCH_N, so it tolerates nothing a release should not have
    re-recorded, and catches a number that was never measured. */
export const ARCH_TOL = 1.5

/* Oldest first. `band` is the full-journal campaign completion at BAND_N; `ending` is the share
   of `reads` careers that reach the known ending at ENDING_N; `arch` is each climber's campaign
   completion at ARCH_N, keyed by the id in ARCHETYPES.
   Only add an entry you have actually measured — the guard cannot tell a real number from an
   invented one, and an invented one is worse than no ledger at all.

   `arch` is backfilled the whole way, because it is the column that had no history at all and a
   swing rule needs one. Two things fall out of it immediately, and both are the point:
     · v10.63 and v10.64 are IDENTICAL across all five. GUARD-10 touched no game rule and the
       ledger says so, which is the shape a pure-instrument release should have.
     · v10.65 (NARR-22) is about a point LOWER for four of the five — Boulderer 9.0 → 7.7, Comp
       Kid 7.9 → 6.8, Trad Dad 8.0 → 7.8, Onsighter 11.4 → 10.0 — because closing RUN-14's leak
       took back the camp inflation that had been helping everybody, not only the Alpinist. That
       ticket measured the Alpinist, bought it back, and shipped without ever looking at the other
       four. Nothing broke, the floor still cleared by 3.2 SE, and nobody would have known. This
       column existing one version earlier is the whole argument for it.

   `ending` starts at v10.65 because that is the version that made it measurable in one line.
   For the record, and measured during NARR-22's bisection at the same sample: v10.51 read 61.3%,
   v10.52 (RUN-14) 52.1%, and v10.64 53.3%. The whole nine-point step is v10.52. */
export const BAND_LOG = [
  { version: '10.56.0', band: 43.5, arch: { boulderer: 11.1, comp: 7.5, trad: 8.8, alpine: 6.5, onsight: 8.6 }, note: 'COND-2 · windows can pass' },
  { version: '10.57.0', band: 45.0, arch: { boulderer: 11.4, comp: 8.3, trad: 9.5, alpine: 7.8, onsight: 8.9 }, note: 'COND-3 · Contact read live; finale traded Bite for Contact' },
  { version: '10.58.0', band: 44.9, arch: { boulderer: 10.7, comp: 8.1, trad: 9.3, alpine: 7.5, onsight: 8.9 }, note: 'COND-4 · forecast agrees with the skies' },
  { version: '10.59.0', band: 44.5, arch: { boulderer: 9.9, comp: 8.6, trad: 9.4, alpine: 7.3, onsight: 9.1 }, note: 'COND-5 · forecast reads the rock' },
  { version: '10.60.0', band: 42.8, arch: { boulderer: 12.9, comp: 10.6, trad: 11.3, alpine: 8.5, onsight: 14.0 }, note: 'LANE-1 · matched hands' },
  { version: '10.61.0', band: 42.6, arch: { boulderer: 10.8, comp: 9.1, trad: 10.7, alpine: 7.6, onsight: 13.4 }, note: 'DECK-4 · the shape can be paid for' },
  { version: '10.62.0', band: 42.1, arch: { boulderer: 8.9, comp: 7.5, trad: 9.3, alpine: 7.8, onsight: 12.9 }, note: 'SEQ-3 · a plan can be bought — the pin was 44.3 and this is where the slide became undeniable' },
  { version: '10.63.0', band: 46.4, arch: { boulderer: 9.0, comp: 7.9, trad: 8.0, alpine: 6.5, onsight: 11.4 }, note: 'LANE-2 · builder family bonus removed; band re-pinned ~44 → ~45 with Evan' },
  { version: '10.64.0', band: 46.4, arch: { boulderer: 9.0, comp: 7.9, trad: 8.0, alpine: 6.5, onsight: 11.4 }, note: 'GUARD-10 · this ledger and its guard; no game rule touched, and the band is identical, which is what that should look like' },
  { version: '10.65.0', band: 45.2, ending: 62.9, arch: { boulderer: 7.7, comp: 6.8, trad: 7.8, alpine: 7.0, onsight: 10.0 }, note: 'NARR-22 · RUN-14 could thin the trail node, which is the journal\'s only tap; the ending guard re-pinned on careers, not wins' },
  { version: '10.66.0', band: 45.2, ending: 62.9, arch: { boulderer: 7.7, comp: 6.8, trad: 7.8, alpine: 7.0, onsight: 10.0 }, note: 'BAL-18 · this column and its guards. src/ and sim/run.mjs are byte-identical to v10.65 (checkable with a diff, not asserted) and the harness is seed-fixed, so all three numbers are carried forward — and the ladder is the one column a stale entry cannot hide in, because the fine pass re-measures it' },
  { version: '10.67.0', band: 45.2, ending: 63.8, arch: { boulderer: 7.7, comp: 7.1, trad: 7.7, alpine: 7.0, onsight: 9.8 }, note: 'LANE-3 · the offer bar is measured bare. Band identical at 45.2; the ending it was PARKED for costs nothing (+0.9, and the 2-3 points it was held back on were read off the wins ratio NARR-22 retired); ladder inside 0.3 everywhere' },
  { version: '10.68.0', band: 45.2, ending: 63.8, arch: { boulderer: 7.7, comp: 7.1, trad: 7.7, alpine: 7.0, onsight: 9.8 }, note: 'QA-1 · the page had two scroll containers and the bar spacer sat mid-page; both fixed in App.tsx and the CSS. src/engine.ts and sim/run.mjs byte-identical to v10.67, so all three columns carry forward' },
  { version: '10.69.0', band: 48.4, ending: 68.8, arch: { boulderer: 9.3, comp: 6.7, trad: 10.1, alpine: 9.3, onsight: 10.4 }, note: 'LANE-4 · the feet cliff softened 7 -> 2. A DELIBERATE JOINT RE-PIN with Evan: band 45 -> 48, ending 62.9 -> 68.8. The removal the row asked for is worth +14.8 and breaks the floor and the spread; this is a fifth of it, with the roster intact' },
  { version: '10.70.0', band: 60.0, ending: 82.5, arch: { boulderer: 9.8, comp: 8.0, trad: 9.7, alpine: 11.3, onsight: 8.6 }, note: 'LANE-5 · the feet urgency is out of the valuation entirely, and the Comp Kid (+1 Power) and Trad Dad (+1 Contact) are paid for. JOINT RE-PIN with Evan: band 48 -> 60, ending 68.8 -> 82.5. Lowest climber 8.0 at 4.95 SE and spread 1.41x, both healthier than before' },
  { version: '10.71.0', band: 60.3, ending: 82.1, arch: { boulderer: 13.1, comp: 9.7, trad: 10.3, alpine: 11.4, onsight: 14.2 }, note: 'SIM-9 · the policy can pace a burn: autoPlay shakes out a lane nothing in hand clears (SHAKE_AT), worth +21.1 points of session send through the same lever. The BAND cannot feel it and did not move — the built deck\'s two rests are feet cards, so a hand rest is in hand on 6 of 7,610 no-clear lane decisions. The LADDER is the instrument that feels it (every climber loadout carries Shake Out x2) and all five rose — Onsighter +5.6, Boulderer +3.3, Comp Kid +1.7, Trad Dad +0.6, Alpinist +0.1 — the ruler changing, not the climb (SIM-6\'s precedent): no game rule moved, floor cleared by 7 SE, spread 1.46x. Ending inside 0.4 of its pin' },  { version: '10.72.0', band: 59.0, ending: 76.7, arch: { boulderer: 12.5, comp: 9.2, trad: 9.5, alpine: 11.4, onsight: 14.7 }, note: 'CARD-20 · Launch on Bump and Lock & Bump (+2 Power while the other hand has held a turn), and `set` made honest at every off-the-wall boundary — a blown or lifted card files without its stand. Band -1.0, inside tolerance, and the arms say it is the honesty strip\'s share; the launch is band-flat. THE ENDING COLUMN CHANGES SAMPLE HERE, 240 -> 720 careers — see the ENDING_N note above: at 240 the fixed slice diverges +-6 between nearly-identical engines, so figures before this line are comparable to each other and NOT to this one. Against v10.71 at the new sample the ending moves 77.6 -> 76.7, a draw. Ladder inside noise of v10.71 on all five' },
  { version: '10.73.0', band: 58.4, ending: 79.6, arch: { boulderer: 12.3, comp: 9.3, trad: 9.8, alpine: 10.5, onsight: 14.0 }, note: 'RUN-15 · which line fills a stage is a property of the run: a climb slot deals per run from its act\'s exact-grade pool (CLIMB_POOLS, derived from the map itself) under RUN-14\'s only-take-what-you-can-give-back rule — bosses, projects and the grade ramp never move, and the support swap\'s RNG stream is untouched. The row said this needed authoring; the measured map disagreed (all 35 lines already in ACTS, nine double-slotted at 18-21 points of same-grade spread). Band -0.6 against v10.72, inside tolerance — the three single-climb act-1 stages statically held their pools\' EASY members, so dealing fairly costs a little there. Ending +2.9. Ladder inside 0.9 of v10.72 on all five' },
  { version: '10.74.0', band: 59.0, ending: 80.0, arch: { boulderer: 13.1, comp: 9.0, trad: 10.2, alpine: 10.7, onsight: 13.7 }, note: 'INFO-2 · the policy sees what the player sees: autoPlay scores a hold at the span gripShown shows — it had been reading TRUE grip on 72.2% of open-lane decisions — reads are spendable and priced flat (depth measured worthless, +0.1 between read 2 and 4), and Take It All In gets the shed body its broken trade owed. KNOW=all reproduces every measurement before this version. The band did not move (59.0 on the 60.0 pin): the campaign\'s accumulated beta covers most decisions by mid-run, so honesty costs the measured campaign ~nothing, while fresh decks feel it — sessions read -2.5 against the clairvoyant knob. Ending +0.4 against v10.73. Ladder inside 0.8 on all five' },
  { version: '10.75.0', band: 58.9, ending: 80.0, arch: { boulderer: 13.3, comp: 9.1, trad: 10.3, alpine: 10.7, onsight: 13.5 }, note: 'ROPE-2 second row · the rack, the clip price and the card\'s hint all ask the RUN whether there is rope on this trip (ropeOnTrip) instead of the static ACTS table, which RUN-15 made the wrong question. Band-neutral by construction and confirmed so: the divergence was measured LATENT before it was fixed (0.0% of runs have no roped node, because act 3\'s roped projects never swap), so all three columns land inside noise of v10.74 — band -0.1, ending identical, ladder within 0.2. The row\'s other half had shipped at v10.48 and is asserted now. BAL-13 gained a sixth screened lever (act-1 length) and shipped no code for it' },
]
