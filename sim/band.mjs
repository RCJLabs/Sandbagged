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
 */

/** The band the game is aimed at, in the CARD-15 sense: a number somebody chose, with a date. */
export const BAND_PIN = 45
/** About 1.5 standard errors at n=3000. Tight enough to see the 2.2-point slide above; loose
    enough that one honest band-neutral ticket does not fail on noise. */
export const BAND_TOL = 2.0
/** The sample the recorded numbers must be measured at, so a cheap reading cannot be passed off
    as a dear one. */
export const BAND_N = 3000

/* Oldest first. `band` is the full-journal campaign completion at BAND_N.
   Only add an entry you have actually measured — the guard cannot tell a real number from an
   invented one, and an invented one is worse than no ledger at all. */
export const BAND_LOG = [
  { version: '10.56.0', band: 43.5, note: 'COND-2 · windows can pass' },
  { version: '10.57.0', band: 45.0, note: 'COND-3 · Contact read live; finale traded Bite for Contact' },
  { version: '10.58.0', band: 44.9, note: 'COND-4 · forecast agrees with the skies' },
  { version: '10.59.0', band: 44.5, note: 'COND-5 · forecast reads the rock' },
  { version: '10.60.0', band: 42.8, note: 'LANE-1 · matched hands' },
  { version: '10.61.0', band: 42.6, note: 'DECK-4 · the shape can be paid for' },
  { version: '10.62.0', band: 42.1, note: 'SEQ-3 · a plan can be bought — the pin was 44.3 and this is where the slide became undeniable' },
  { version: '10.63.0', band: 46.4, note: 'LANE-2 · builder family bonus removed; band re-pinned ~44 → ~45 with Evan' },
  { version: '10.64.0', band: 46.4, note: 'GUARD-10 · this ledger and its guard; no game rule touched, and the band is identical, which is what that should look like' },
]
