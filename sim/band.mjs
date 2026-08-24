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
/* RE-PINNED 60 -> 62 on 2026-08-22, with Evan, and the ending moved 76.7 -> 81 in the same
   breath — see the NARR-22 guard in test.mjs, because those two share a lever and re-pinning
   one without the other is the stale-copy failure NARR-22, BAL-18 and SIM-8 each had to clean
   up after.
   WHAT MOVED THE BAND: four gameplay tickets in one session (HOLD-2, CARD-21, ARCH-1, INFO-3),
   of which exactly one is responsible. HOLD-2 measured band-neutral at n=3000 (58.9 / 59.0 /
   59.1 across three arms), CARD-21 likewise (59.1 / 58.1 / 59.4, every gap under one SE), and
   INFO-3 read +0.1. ARCH-1 is the whole +3.0: five signature moves, one per climber, and an
   ability handed to EVERY climber lifts the whole game rather than tilting it.
   WHY RE-PIN RATHER THAN PAY IT BACK: the roster came out of ARCH-1 healthier than it went in
   — floor 8.3 -> 10.8, spread 1.60x -> 1.35x — so the +3.0 is not a leak to be plugged but a
   game that got better at the same time as easier. Buying it back would have meant weakening
   the five moves that produced the tightest roster this project has measured. Evan's call,
   made with the numbers in front of him rather than discovered afterwards. */
export const BAND_PIN = 62
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
/** BAL-18: the floor every climber has to clear, which had been 5 since v9.35 and was lowered to
    4 once at v9.32 to accommodate a drift instead of fixing it — the thing BAL-9 exists to
    forbid. It lives HERE, not as a literal in the guard, because two places held the band pin and
    one of them sat two versions stale (see the NARR-22 note in test.mjs). */
/* RAISED 5 -> 9 on 2026-08-23, with Evan, and the reason is that 5 had stopped being a bar.
   It was set when the roster spanned 3.3% to 29.8%. It does not any more, and across three
   releases the worst climber went 10.5 -> 9.2 -> 8.0 without one guard firing, because 8.0 is
   still miles clear of 5. That is BAL-14's compounding drift — six changes each worth a point
   or two, every one honestly reported — happening to the LADDER while GUARD-10 watched only
   the band. The band is policed release by release and the floor was not.

   WHAT 9 ACTUALLY DEMANDS IS ~10.4, and that is the part worth writing down. The guard asks
   for the margin in standard errors, not in points: at ARCH_N the worst climber has to clear
   the floor by 2 SE or the claim is a coin flip. So a floor of 9 needs a roster whose weakest
   member is above about 10.4%, and picking 9 was picking that.

   IT WAS NOT REACHABLE WHEN IT WAS CHOSEN. The Trad Dad read 8.0 and the Alpinist 9.9, and the
   Alpinist has no fine dial — skin does nothing (9.9 -> 9.9), attempts nothing (9.6), and
   Contact is a cliff (19.4), which is what BAL-16 recorded as "a different climber, not a
   buy-back; there is no landing between". ARCH-2 paid for it with one buy-back and one BUG:
   the Trad Dad's own +2 Contact became +3 (8.0 -> 11.4), and Dig In was capped at 2 while its
   card text has always promised 4 (9.9 -> 11.8). The floor is the Onsighter now at 10.7,
   clearing 9 by 2.5 SE, and the spread is 1.10x — the tightest this roster has ever measured.

   LOWERING THIS NUMBER TO MAKE A RELEASE PASS IS STILL THE THING BAL-9 FORBIDS. Raising it was
   a decision with a date on it; lowering it is a drift with an excuse. */
export const ARCH_FLOOR = 9
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
  { version: '10.76.0', band: 58.9, ending: 80.0, arch: { boulderer: 13.3, comp: 9.1, trad: 10.3, alpine: 10.7, onsight: 13.5 }, note: 'SHIP-3 · packaging only, and the three columns are CARRIED FORWARD on the v10.66 precedent: src/engine.ts and sim/run.mjs are byte-identical to v10.75 (checkable with a diff, not asserted) and the harness is seed-fixed, so re-measuring would be re-running the same seeds through the same rules. What changed lives in scripts/, ship/ and docs/: the site address is stated once in package.json and the TWA config, the web manifest id and the checklist all derive from it, and the build syncs the version Play shows' },
  { version: '10.77.0', band: 59.1, ending: 78.3, arch: { boulderer: 12.5, comp: 8.3, trad: 10.5, alpine: 10.6, onsight: 13.3 }, note: 'HOLD-2 · the flake, and the first rule that pays for resolve ORDER. Band-neutral at the sample that can see it: three arms at n=3000 read 58.9 (no flake) / 59.0 (flake, ability stripped) / 59.1 (shipped), all inside 0.2. THE SAME THREE ARMS AT n=900 READ 61.9 / 57.0 / 60.1 and the whole 4.9-point decomposition was sampling noise — the third time this session that a texture change looked resolved at n=900 and was not, after the CARD-20 carrier buy-back and ROUTE-8\'s traverse. Ending +1.6, ladder floor 8.3 at 4.9 SE and spread 1.60x' },
  { version: '10.78.0', band: 58.8, ending: 78.2, arch: { boulderer: 12.0, comp: 8.3, trad: 9.6, alpine: 10.7, onsight: 13.3 }, note: 'CARD-21 · Setup: the lane remembers a worked hold, so the next one there arrives 1 Grip easier. Band-neutral at n=3000 — 59.1 baseline, 58.1 with the mechanism stripped, 59.4 with it, all gaps under one SE, and the shipped tree reads 58.8 after the drafter was re-priced. THE PRICE WAS THE FINDING: it was set from how often a cleared lane is carded on the very NEXT turn (27.9%), which is the wrong window because the discounted hold sits there until it is worked — measured on the mechanic itself, 86.7%, so the drafter had been told it was worth a third of what it pays. Worth +1.9 and +1.7 on its two carriers in the shell probe. Ladder inside 0.9 everywhere' },
  { version: '10.79.0', band: 61.8, ending: 81.5, arch: { boulderer: 14.6, comp: 13.6, trad: 10.8, alpine: 13.1, onsight: 13.4 }, note: 'ARCH-1 · five signature MOVES, one a burn. THE ROSTER IS THE HEADLINE AND IT IS GOOD: every climber gained, the floor rose 8.3 -> 10.8 and the spread TIGHTENED 1.60x -> 1.35x, which is what a roster-wide ability has to do or it is a spread problem wearing a feature. BOTH OTHER PINS NOW SIT AT THE EDGE OF TOLERANCE AND THAT IS THE THING TO READ HERE: band 58.8 -> 61.8 against a pin of 60 with a tolerance of 2.0 (margin 1.8), ending 78.2 -> 81.5 against 76.7 with a tolerance of 5 (margin 4.8). Neither is re-pinned, because neither is outside — but an ability handed to EVERY climber lifts the whole game, so the next roster-wide addition needs a joint re-pin with Evan before it is built, not after'  },
  { version: '10.80.0', band: 61.9, ending: 81.4, arch: { boulderer: 14.6, comp: 13.6, trad: 10.7, alpine: 12.8, onsight: 13.3 }, note: 'INFO-3 · an unclimbed line cannot be read, and two named features never read exact. Band-neutral at +0.1 — AND THAT RETRACTS THE REASON IT WAS CHOSEN: it was designed to be band-NEGATIVE, on the argument that denying information makes the uncertainty-limited policy conservative, and it is not, because the population is tiny (FA nodes are rare in a campaign and the two Blank signatures sit on 2 of 37 routes). The mechanism is sound and the reach is small. THE BAND NOW SITS 1.9 FROM THE PIN WITH A TOLERANCE OF 2.0 — the next change that raises it AT ALL breaks GUARD-10, so the next ticket starts with a re-pin decision rather than ending with one' },
  { version: '10.81.0', band: 61.9, ending: 81.4, arch: { boulderer: 14.6, comp: 13.6, trad: 10.7, alpine: 12.8, onsight: 13.3 }, note: 'THE RE-PIN ITSELF, and nothing else: band 60 -> 62 and the known ending 76.7 -> 81, agreed with Evan on 2026-08-22 and moved in the same breath because those two share a lever. NO GAME RULE TOUCHED — src/engine.ts is byte-identical to v10.80, not merely close (the version string lives in App.tsx; checkable with a diff, not asserted) and the harness is seed-fixed, so all three columns are carried forward rather than re-measured: re-running would be the same seeds through the same rules. The v10.64 and v10.66 precedent for an instrument-only release. Margins after: band 0.1 of 2.0, ending 0.4 of 5.0 — the headroom this session spent is back' },
  { version: '10.82.0', band: 61.0, ending: 80.7, arch: { boulderer: 12.2, comp: 13.8, trad: 9.2, alpine: 12.4, onsight: 13.1 }, note: 'HOLD-3 · the chain costs a pump when the hand you sent first comes off. THE PREMISE THIS TICKET WAS WRITTEN ON MEASURED WRONG: HOLD-2 said going second was paid for by the lane you send first blowing, and it is not — 7,255 decisions resolved twice from a forked RNG, and the order changes how many cards you lose on 0.0% of them. Structural, not a sample: `laneBlows` is Contact against Bite off the COMMITTED board, so the first lane blows in either order, and `weight` never travelled with it either (HOLD-2 naming it is corrected in that row). Only opposition is order-sensitive and it flips 0.3%. SO THE COST WAS BUILT out of the condition HOLD-2 named and could not make pay. Take-rate 99.7% -> 49.2% of the lanes offered, and 72.6% of those takes actually pay. SEVEN ARMS AT n=3000, and the policy is NOT the lever: three windows and a headroom gate all land inside 0.2 (60.6-60.8), so what is worth 2.1 is having a rule rather than always taking. Free chain reads 62.0, flat pump with a blind policy 58.6. THE LAST TWO ARMS ARE THE SAME BAND AND THE CHOICE WAS MADE ON DESIGN, said plainly: flat pump 60.7, shipped 61.0, 0.3 at an SE of 0.9. THE COST IS THE LADDER AND IT IS NOT HIDDEN: floor 10.5 -> 9.2 (1.7 SE, not a measurement) and spread 1.36x -> 1.50x, both inside their guards, and the first thing to re-measure if the roster tightens again. Band margin 1.0 of 2.0 against the pin Evan set at 62 the same day' },
  { version: '10.83.0', band: 61.0, ending: 80.7, arch: { boulderer: 12.2, comp: 13.8, trad: 9.2, alpine: 12.4, onsight: 13.1 }, note: 'ENG-9 second pass · 412 lines of literal content out of engine.ts into content.ts, re-exported, no caller changed. NO RULE TOUCHED, AND THE BAND PROVES IT RATHER THAN ASSERTING IT: all three journal arms reproduce v10.82 digit for digit (48.6 / 56.0 / 61.0), which is what a pure data move has to do on fixed seeds — a tolerance would have been the wrong check here. So the ending and the ladder are carried forward on the v10.64 / v10.66 / v10.81 instrument-only precedent. THE FINDING IS THE TWO BLOCKS THAT WENT BACK: ARCHETYPES (98 lines) and ACT1_MAP (11) read as pure literal arrays and are built by FACTORIES whose names are bare capitals — L(...) for a loadout, C / CAMP / EVT / FA / PROJ / SHOP for map nodes — so a screen looking for lowercase calls passed them and the compiler refused the cut within a minute. Same class as CARDS, the canary this guard was built around, and it means the real ceiling is ~1,230 rather than the 1,350 the row estimated: 109 of those lines were never content. TALKS would have moved cleanly and did not — the guard names it as a canary and quietly re-pointing a canary to make your own move pass is how a guard stops meaning anything. Density measured first and paid as measured: 16 injection anchors and 1 guard window, ~3 per 100 lines. The guard gained a real hole-closer: it only ever looked for `export function`, which an arrow-shaped factory is not, so the content file now refuses any arrow at all. 206/206 core, 132/132 slow' },
  { version: '10.84.0', band: 61.0, ending: 80.7, arch: { boulderer: 12.2, comp: 13.8, trad: 9.2, alpine: 12.4, onsight: 13.1 }, note: 'GUARD-11 · esbuild and playwright-core were in NEITHER dependency list. NO GAME CODE TOUCHED — `git diff -- src/` is empty, so all three columns carry forward on the v10.64 / v10.66 / v10.81 instrument-only precedent. THE PREMISE WAS WORSE THAN THE ROW THAT ASKED FOR IT: esbuild is imported by run.mjs AND test-core.mjs AND test.mjs, so what rode a transitive dependency was not just the band measurement but `npm run check`, the gate every release goes through. `npm ls esbuild` found exactly one copy, a child of vite@6.4.3, with no direct edge — the day Vite drops it, every number in this file becomes unreproducible and the first symptom is a module-not-found in a file nobody was editing. playwright-core did not resolve at all, which is why `npm run perf` threw ERR_MODULE_NOT_FOUND while PERF-2 pinned the build size and told you to re-measure with it. Both declared; esbuild deduped to the copy already there (^0.25.0, the range Vite itself asks for) so nothing was added but the edge. THE PERF SCRIPT IS SOUND AND THAT IS NOW KNOWN RATHER THAN ASSUMED: run end to end against a browser it reproduces PERF-2 — boot 131 / 269 / 406 ms at 1x / 4x / 6x, turn latency median 20 / 91 / 109 ms. Guard: every bare specifier anywhere this repo owns, against dependencies + devDependencies + node builtins — not a curated list of files or packages, either of which would pass because of what it was pointed away from. 4 injections. 207/207 core, 132/132 slow' },
  { version: '10.85.0', band: 61.0, ending: 80.7, arch: { boulderer: 12.2, comp: 13.8, trad: 9.2, alpine: 12.4, onsight: 13.1 }, note: 'SAVE-8 · adding a climber no longer deletes every deck the player built. MEASURED AGAINST THE SHIPPED LOADER FIRST: `loadouts` was kept only on `length === ARCHETYPES.length`, so a save carrying FOUR customised decks lost all four, a save carrying six lost all six, and a 14-card singular loadout was discarded for being 14. THE GATE WAS NOT AN OVERSIGHT AND IS REPLACED RATHER THAN DELETED: `loadouts` is indexed positionally in five places in App.tsx, so a missing slot really is `loadoutDeck(undefined)` and a TypeError. It is the PRICE that was wrong — the whole collection, to avoid an undefined at one index — and what it defended is already handled one layer down, because `loadoutDeck` opens on `length === DECK_SIZE ? loadout : DEFAULT_LOADOUT` and filters names it does not know. Now: one entry per archetype in archetype order, what the save has kept and bounded by DECK_SIZE for SAVE-6, what it lacks filled with THAT climber default rather than the first one. THE BAND IS RE-MEASURED RATHER THAN CARRIED: engine.ts changed, and it reads 61.0 against 61.0 with 56.0 at 7/14, identical to v10.83 — `loadGame` is not on any path the sim walks, and that is now measured instead of argued. 5 injections, including the pad that satisfies every length assertion while handing the newest climber somebody else deck. 208/208 core, 132/132 slow' },
  { version: '10.86.0', band: 61.0, ending: 80.7, arch: { boulderer: 12.2, comp: 13.8, trad: 9.2, alpine: 12.4, onsight: 13.1 }, note: 'CARD-22 · THE ROW IS REFUTED AND THE INSTRUMENT WAS THE DEFECT. The audit read six cards more than 2sd below their own rarity, three of them RARES worth less than the average common. The per-card probe added THREE copies of every card and copyLimit is 1 for a rare, 2 for an uncommon — so every rare and uncommon it has ever priced was priced on a deck no player can hold, which is SIM-8 one instrument along. At the legal count: Quiet Feet -11.3 -> +1.4, Second Skin -11.3 -> +10.9, Local Knowledge -20.9 -> -4.9. Three of the six were arithmetic on an impossible deck. A SECOND INDEPENDENT ERROR: it ADDED rather than replaced, so a 14-card shell plus 3 copies is a 17-card deck and every delta carried a dilution term scaling with the shell — the same card read -11.3 against a 70.2% shell and -24.6 against an 81.4% one, and Sidepull reads -11.3 added and -28.5 swapped against the SAME shell. Fixed: copyLimit copies, swapped in, deck size held fixed, CARDS_ADD=1 to reproduce every number measured before. ON THE FIXED INSTRUMENT THE OUTLIER COUNT WENT FROM SIX TO ONE AND IT IS POSITIVE (Precise Feet +24), and the ladder came out cleanly monotonic: common -10.9, uncommon +6.9, rare +12.7. The honest reading of the row question: rarity IS a promise from common to uncommon (+17.8) and is not resolvable from uncommon to rare (+5.8 against sds of 11.2 and 9.3). NO CARD CHANGED and none is justified. NO GAME CODE TOUCHED — `git diff -- src/` is empty apart from the version string, so all three columns carry forward. 4 injections, one of which found this guard matching its OWN COMMENT rather than the code (ART-4 class, second time). 209/209 core, 132/132 slow' },
  { version: '10.87.0', band: 61.0, ending: 80.7, arch: { boulderer: 12.2, comp: 13.8, trad: 9.2, alpine: 12.4, onsight: 13.1 }, note: 'CARD-23 · REFUTED, and the question was under-specified rather than the answer wrong. The row said eleven of eighteen card effects never reach the board; that was measured on STARTING decks. Over drafted campaigns — 81,854 turns on the archetype loadouts and 87,672 on the built one — only settle2 and peel sit at zero and each is non-zero in the other population. Eight are under 1% of turns in BOTH and that is the real dead list: settle2, peel, cycle, echo, momentum, guard, greedy, snap. THE FINDING IS THE PAIR THAT INVERT AND IT LANDS ON A SHIPPED CLAIM: LANE-1 records fx weight firing on 0.12% of turns and argued from it that the effect had to be granted by the board rather than by a card. Re-measured, weight is 0.09% for a new player and 17.46% of turns / 100% of runs on the BUILT deck — the deck every band number in this project rides (SIM-8) — so the rate behind a design decision was 145x wrong for the population that is actually measured. friction inverts the other way, 17.22% to 0.07%. The mechanism is exact: buildLoadout takes ONE weight card in fifteen and no friction, no archetype loadout carries a weight card and three carry friction. LANE-1 is corrected in place, nothing is reverted — Matching earned its place on its own 28.35% and does not depend on the weight number being small. NO RULE CHANGED: the engine diff is 20 lines and every one is a comment, which is a proof rather than a sample, so all three columns carry forward. The divergence is guarded BEHAVIOURALLY because prose cannot be. 3 injections. 210/210 core, 132/132 slow' },
  { version: '10.88.0', band: 61.6, ending: 81.4, arch: { boulderer: 11.8, comp: 11.4, trad: 8.0, alpine: 9.9, onsight: 10.7 }, note: 'HOLD-4 · brushing strips GREASY only, and every brush card cuts 1 more Grip to pay for the abilities it no longer takes. THE ROW PREMISE WAS AN ARITHMETIC ERROR IN THE AUDIT THAT WROTE IT — holds-per-turn across three lanes read as a share of turns. Corrected over 142,919 hand holds the spread is FLAT: Greasy 14.1, Sharp 13.3, Squeeze 10.9, Committing 8.5, Two-finger 7.4, Razor 6.9, Rest 5.8, Chained 3.9. WHAT THE CENSUS FOUND INSTEAD: the biggest category on a hand lane was NO ability, 28.5%, and abilityOf returns empty only for a brushed hold. Counted as transitions, the PLAYER brushed on 42.98% of turns and the route move on 0.16% — one card was deleting the work of HOLD-1, HOLD-2 and HOLD-3 on three hand holds in ten. DECOMPOSED at n=1500: shipped 60.9, ability-survives 58.3, never-brush 49.9 — the cut is worth +8.4 and the erasure only +2.6. Greasy-only alone reads 57.7, the same as stripping nothing inside half an SE, so the strip value was entirely in abilities brushing has no business answering. Greasy-only +1 Grip reads 60.7 against 60.9 and ships. Band 61.6 (margin 0.4), ending 81.4 (margin 0.4). THE COST IS THE LADDER AND IT IS NOT BURIED: every climber fell, average -1.8, floor 9.2 -> 8.0 and spread 1.50x -> 1.48x. The change is mildly REGRESSIVE — a bigger Grip cut pays a strong deck that converts it and does not cover a weak one that needed Committing gone off a crux. Inside every guard (ARCH_FLOOR is 5) but it is the THIRD release running to lower the floor, 10.5 -> 9.2 -> 8.0, and ARCH-2 is the open row about exactly that. 5 injections. 211/211 core, 132/132 slow' },
  { version: '10.89.0', band: 61.6, ending: 81.4, arch: { boulderer: 11.8, comp: 11.4, trad: 11.4, alpine: 11.8, onsight: 10.7 }, note: 'ARCH-2 + BAL-19 · ARCH_FLOOR 5 -> 9, agreed with Evan on 2026-08-23 and dated in this file. 5 had stopped being a bar: it was set when the roster spanned 3.3 to 29.8, and across three releases the worst climber went 10.5 -> 9.2 -> 8.0 without one guard firing because 8.0 is still miles clear of 5 — BAL-14 compounding drift happening to the LADDER while GUARD-10 watched only the band. WHAT 9 DEMANDS IS ~10.4 AND THAT IS THE PART WORTH KNOWING: the guard asks for the margin in standard errors, so a floor of 9 needs the weakest climber above about 10.4%, and choosing 9 was choosing that. IT WAS NOT REACHABLE WHEN IT WAS CHOSEN — Trad Dad 8.0, Alpinist 9.9, and the Alpinist has NO fine dial: skin does nothing (9.9 -> 9.9), attempts nothing (9.6), Contact is a cliff (19.4), which is exactly what BAL-16 recorded as a different climber and not a buy-back. PAID WITH ONE BUY-BACK AND ONE BUG. Trad Dad dContact 2 -> 3, his one stated upside made to pay (8.0 -> 11.4); four dials measured and recorded, firstTurnPower cleared the floor at 9.9 and was passed over on FICTION because committing off the first move is the Onsighter signature. Alpinist ARCH_DIG_MAX 2 -> 4, which is a CORRECTION: the Dig In card has always promised up to 4 and the code capped it at 2 (9.9 -> 11.8), and the lever is the GATE not the give — raising only the give reads 9.7 against 9.9, nothing. FLOOR IS THE ONSIGHTER AT 10.7, clearing 9 by 2.5 SE, and the spread is 1.10x, the tightest this roster has ever measured (ARCH-1 got 1.35x, HOLD-4 left it at 1.48x). Band 61.6 and ending 81.4, both unchanged — the band is measured on arch 0 and these are climber-local. LANE-5 and the ARCH_FLOOR assertion both became FLOORS rather than equalities: lowering either is the v9.32 drift BAL-9 forbids, raising is a dated decision, and a guard that fires on its own improvement gets deleted. 2 injections. 211/211 core, 132/132 slow' },
  { version: '10.90.0', band: 61.6, ending: 81.4, arch: { boulderer: 11.8, comp: 11.4, trad: 11.4, alpine: 11.8, onsight: 10.7 }, note: 'SHIP-5 · the README was wrong in four countable places and it is the one page a stranger reads: 227 cards against 250, 30 routes against 37, four climbers against five, 83 tests against 330. It also still said the whole game is App.tsx, which ENG-9 stopped being true two releases ago. Every one of those was TRUE WHEN IT WAS WRITTEN, which is the point — a count in prose rots faster than a version string because nothing bumps it, and SHIP-4 exists because the version drifted the same way twice. Guarded by COUNTING rather than by matching text, so it fails when the game grows and not when somebody rewords a paragraph; the words four/five/seven are matched as words because that is how they are written. Also asserts the README links the same homepage build:html derives the PWA scope and the TWA package from, case included (SHIP-3 shipped a lower-case path against a case-sensitive host for forty-two releases). NO GAME CODE TOUCHED — the engine diff is empty, so all three columns carry forward. 3 injections. 212/212 core, 132/132 slow' },
]
