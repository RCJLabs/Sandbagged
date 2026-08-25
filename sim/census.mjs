/* SANDBAGGED — the firing-rate census, and what may be guarded on it.
 *
 *   node sim/run.mjs census 150 built      (SEED=n draws a different stream)
 *   node sim/run.mjs census 150 arch
 *
 * WHY THIS FILE EXISTS. Every finding in CARD-23, CARD-24, HOLD-4 and INFO-4 came out of one
 * script written for one audit and deleted after it, and the same class of bug — a mechanic
 * the policy cannot use, measuring as dead — has been tripped over NINE times as ENG-25
 * rather than looked for. GUARD-10 does this for the band: measure, write it down, fail at
 * ship time. This is that, for whether the rules still fire.
 *
 * THE ROW ASKED WHETHER THE RATES ARE STABLE ENOUGH TO GUARD, AND THE ANSWER IS HALF.
 * Three seeds, 150 campaigns each, ~21,500 turns each, built loadout:
 *
 *     fx          min     max   spread   ratio
 *     static     37.70   39.22    1.52     1.0
 *     tough      36.11   36.58    0.47     1.0
 *     setup      30.95   33.57    2.62     1.1
 *     precise    24.31   27.03    2.72     1.1
 *     weight     17.92   18.58    0.66     1.0
 *     balance    13.85   14.41    0.56     1.0
 *     hooked     12.63   13.87    1.24     1.1
 *     launch      7.32    8.56    1.24     1.2
 *     commit      2.65    3.50    0.85     1.3
 *     ---------------------------------------- the line, and it is a clean break
 *     guard       0.04    0.08    0.04     2.0
 *     friction    0.05    0.25    0.20     5.0
 *     snap        0.01    0.09    0.08     9.0
 *     momentum    0.01    0.11    0.10    11.0
 *     echo        0.00    0.03    0.03     inf
 *     cycle / settle2 / peel: absent from every sample
 *
 * Everything above 2.6% moves by at most 1.3x between seeds. Everything below 0.3% moves by
 * 2x to infinity — not because the game changed but because 0.05% of 21,500 turns is about
 * ten events, and ten events do not have a rate. NO SAMPLE FIXES THAT: resolving 0.05% to
 * +-20% needs ~10,000 occurrences, which is twenty million turns.
 *
 * SO THE BAR IS ONLY WHERE A BAR CAN MEAN SOMETHING. The effects that carry the game must
 * keep carrying it — that is CENSUS_FLOOR, and it is the tripwire the row wanted. The
 * near-zero eight are RECORDED, not gated: this is BAL-18's shape, history rather than a
 * gate, and the row predicted it ("the honest version may be a recorded census with no bar
 * at all"). A guard on momentum's 0.01% would fire on a seed and get deleted, which is worse
 * than no guard, because for a while it would read as coverage (PERF-3, one release ago).
 */

/* The floor is on the BUILT deck because that is the deck every band number in this project
   rides (SIM-8), and it is a FLOOR in the ARCH_FLOOR sense: raising it is a dated decision,
   lowering it is the v9.32 drift BAL-9 forbids. 1.0 sits 1.65 points under `commit`, the
   weakest live effect, against a between-seed spread of 0.85 — so about 2x the noise. */
export const CENSUS_FLOOR = 1.0
export const CENSUS_N = 60        // 6s; the rates hold at this sample (checked against 150)

/* Alive on the built deck: measured 2.65% of turns or better in every sample. */
export const LIVE_BUILT = ['static', 'tough', 'setup', 'precise', 'weight', 'balance',
  'hooked', 'launch', 'commit']

/* Alive on the ARCHETYPE loadouts and dead on the built one. This is not a curiosity — it is
   CARD-23's finding, that a firing rate is a property of a DECK and not of the game: weight
   reads 18% built and 0.16% arch, friction 0.07% built and 17.29% arch, because buildLoadout
   takes one weight card in fifteen and no friction while three archetype decks carry friction
   and none carries weight. An effect here is not dead; it is somebody else's. */
export const LIVE_ARCH = ['friction']

/* Measured at or near zero in BOTH populations, and recorded rather than gated. These are
   CARD-24's list — the row's own framing is that a card the drafter never offers and a card
   the policy never takes are different diseases, and this file cannot tell them apart. It
   only refuses to let the set grow quietly. */
export const DEAD = ['greedy', 'guard', 'momentum', 'snap', 'echo', 'cycle', 'peel', 'settle2']

/* History, per version, in the BAL-18 shape: what the numbers were, so a slide is visible
   even where a bar would be dishonest. Built loadout, seed 777, n=150 unless noted. */
export const CENSUS_LOG = [
  { version: '10.93.0', turns: 21737, n: 150, seed: 777,
    play: { static: 38.02, tough: 36.11, setup: 32.14, precise: 27.03, weight: 18.58,
      balance: 14.15, hooked: 13.77, launch: 7.32, commit: 2.65,
      friction: 0.07, greedy: 0.07, guard: 0.04, momentum: 0.02, snap: 0.02, echo: 0.01 },
    note: 'SIM-10 · the first recorded census. Reproduces the CARD-23 audit that was written '
      + 'and thrown away: weight 18.58 against its 17.46, friction 0.07 against its 0.07. '
      + 'The arch population at the same sample reads friction 17.29 and weight 0.16, which '
      + 'is the inversion CARD-23 found and the reason LIVE is split by deck.' },
]
