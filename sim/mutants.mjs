/* SANDBAGGED — GUARD-9: the negative tests, kept.
 *
 * `test.mjs` opens by saying that fifteen one-off harnesses were written across this
 * project, each proving something real, and every one of them was thrown away — and that
 * this is why the kept suite exists. The injections are the same story one level up.
 *
 * Every ticket here has been negative-tested: break the thing the guard claims and check
 * the guard says so. That is the only way to know a guard can fail at all, and in this
 * project it has repeatedly been the only way to find out that one CANNOT. Across
 * GUARD-8, CARD-18, SKIRM-7, SIM-7 and SIM-8 the injections found the original bug every
 * time AND three VACUOUS ASSERTIONS in guards written minutes earlier:
 *
 *   SKIRM-7 — asserted `partnerFor(st)` appeared in the screen. It does, into a local,
 *             even when the block that renders it is gated off.
 *   SIM-7  — asserted a send rate that cannot see the bug and points the other way: the
 *             illegal deck sends 99% of one boulder and completes 18.9% of campaigns.
 *   SIM-8  — asserted beta cards were absent from a list the TEST had just built, rather
 *             than from the one the harness uses.
 *
 * Every one of those read green. GUARD-8 made a fragile source WINDOW impossible; this is
 * the other shape — an assertion that tests the fixture instead of the claim — and nothing
 * static catches it. Running it does.
 *
 * So the injections stop being scratch files:
 *
 *   node sim/mutants.mjs          the fast set (the core and kept suites)
 *   node sim/mutants.mjs slow     also the ones that need the balance ledger
 *   node sim/mutants.mjs GUARD-8  just one ticket's
 *
 * It EDITS SOURCE FILES and puts them back. Every file it touches is snapshotted first,
 * restored after each mutant, restored again on any crash or Ctrl-C, and byte-compared at
 * exit — if that comparison ever fails it says so loudly rather than leaving you with a
 * mutated tree.
 *
 * A cheap part of this runs inside `test-core.mjs` on every `npm run check` (GUARD-9's own
 * guard): every mutant's ANCHOR must still match its file exactly once. That is the way a
 * kept injection rots without anybody noticing — somebody edits the line it patches, the
 * anchor stops matching, and the mutant quietly tests nothing. It is the same failure mode
 * as the guards it protects, so it gets the same treatment.
 *
 * The other rot — the `catches` message drifting away from what the guard actually prints —
 * CANNOT be checked cheaply, and it is worth saying why rather than pretending. Most of
 * these messages are template literals, so `card of 248 carries restChip` is not a string
 * that exists anywhere in the source; it only exists once a failing run has built it. So
 * that half is caught by RUNNING this, and it caught three of them while GUARD-9 was being
 * written: two `catches` strings a word out, and one that still named an assertion I had
 * reworded ten minutes earlier.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

/* Each mutant: the ticket it belongs to, the patch (one or more exact string swaps that
   must each match exactly once), which suite should notice, and a fragment of the failure
   message that must appear. `catches` is the important field — a mutant that merely makes
   SOMETHING fail proves nothing about the guard you meant to test. */
export const MUTANTS = [
  // ---- GUARD-8: the suite reads itself ------------------------------------------
  { id: 'GUARD-8/fixed-window', suite: 'core',
    why: 'a window with a hard-coded length', catches: 'a window with a hard-coded length',
    patch: [['sim/test-core.mjs',
      "  const pa = region(eng, 'export function powerAgainst', ['export function biteAgainst'],\n    { min: 400, what: 'powerAgainst' })",
      "  const pa = eng.slice(eng.indexOf('export function powerAgainst') + 0, eng.indexOf('export function powerAgainst') + 400)"]] },
  { id: 'GUARD-8/unchecked-anchor', suite: 'core',
    why: 'a window taken straight off indexOf, in the OTHER suite file', catches: 'straight off indexOf',
    patch: [['sim/test.mjs',
      '  const more = tail(app, "st.phase === \'more\'", { min: 500, what: \'the more screen\' })',
      '  const more = app.slice(app.indexOf("st.phase === \'more\'"))']] },
  { id: 'GUARD-8/two-line-anchor', suite: 'core',
    why: 'a variable set from indexOf and sliced later', catches: 'which this file sets from an indexOf',
    patch: [['sim/test-core.mjs',
      "  const marks = region(app, 'const NODE_MARK', ['}'], { min: 60, what: 'the mark vocabulary' })",
      "  const markAt = app.indexOf('const NODE_MARK')\n  const marks = app.slice(markAt, 9999)"]] },
  { id: 'GUARD-8/no-message', suite: 'core',
    why: 'an assertion with no failure message', catches: 'no failure message',
    patch: [['sim/test-core.mjs',
      "  ok(/load\\(st\\.slot\\)/.test(imp), 'IMPORT still does not reload, so the import gets overwritten')",
      '  ok(/load\\(st\\.slot\\)/.test(imp))']] },
  { id: 'GUARD-8/ok-accepts-no-message', suite: 'core',
    why: 'ok() stops demanding a message', catches: 'accepts an assertion with no failure message',
    patch: [['sim/guard.mjs',
      "  if (!m) throw new Error('GUARD-8: this assertion has no failure message, so its failure says nothing')\n  if (!c) throw new Error(m)",
      '  if (!c) throw new Error(m)']] },
  { id: 'GUARD-8/region-size', suite: 'core',
    why: 'region stops checking its own size', catches: 'region does not check its own size',
    patch: [['sim/guard.mjs', '  if (out.length < min) {', '  if (false) {']] },
  { id: 'GUARD-8/region-eof', suite: 'core',
    why: 'region silently reads to the end of the file', catches: 'closing anchor is gone',
    patch: [['sim/guard.mjs', '  if (bounds.length && !found && !eof) {', '  if (false) {']] },
  { id: 'GUARD-8/region-open-anchor', suite: 'core',
    why: 'region stops checking its opening anchor', catches: 'the opening anchor is gone',
    patch: [['sim/guard.mjs',
      '  if (at < 0) throw new Error(`${name}: the opening anchor is gone',
      '  if (false) throw new Error(`${name}: the opening anchor is gone']] },

  // ---- CARD-18: four mechanics you would never meet twice -----------------------
  { id: 'CARD-18/back-to-singleton', suite: 'core',
    why: 'a mechanic back to one card', catches: 'card of 248 carries restChip',
    patch: [['src/engine.ts',
      "  rest('Milk The Jug', 6, 3, 'uncommon', { restChip: 1, anchor: false,",
      "  rest('ZGone The Jug', 6, 3, 'uncommon', { anchor: false,"]] },
  { id: 'CARD-18/free-chip', suite: 'core',
    why: 'the chip becomes free — a strict upgrade on Shake Out', catches: 'the chip has to cost something',
    patch: [['src/engine.ts',
      "rest('Milk The Jug', 6, 3, 'uncommon', { restChip: 1, anchor: false,",
      "rest('Milk The Jug', 6, 3, 'uncommon', { restChip: 1,"]] },
  { id: 'CARD-18/free-latch', suite: 'core',
    why: 'the latch becomes free — a strict upgrade on Precise Feet', catches: 'a common plus a free latch',
    patch: [['src/engine.ts',
      "ft('Rand Smear', 1, 6, 'uncommon', { support: 2, latch: true,",
      "ft('Rand Smear', 1, 7, 'uncommon', { support: 2, latch: true,"]] },
  { id: 'CARD-18/read-strict-upgrade', suite: 'core',
    why: 'the deeper read also draws', catches: 'so it is a strict upgrade',
    patch: [['src/engine.ts',
      "bn('Take It All In', 1, 'uncommon', { read: 4,",
      "bn('Take It All In', 1, 'uncommon', { read: 4, draw: 1,"]] },
  { id: 'CARD-18/spawn-drops-field', suite: 'core',
    why: 'spawn drops restChip again — the CARD-11 bug that shipped a dead card',
    catches: 'spawn dropped restChip',
    patch: [['src/engine.ts',
      '    restChip: d.restChip, hex: d.hex,   // CARD-11 / CARD-13: were dropped here, so both were dead in play',
      '    hex: d.hex,   // CARD-11 / CARD-13']] },
  { id: 'CARD-18/chip-wrong-lane', suite: 'core',
    why: 'the chip leaks into a lane you did not rest in', catches: 'chipped a lane it was not resting in',
    patch: [['src/engine.ts',
      '    if (c && c.restChip && h) boardH[i] = { ...h, grip: Math.max(0, h.grip - c.restChip) }',
      '    const cc = boardP.find(x => x && x.restChip); if (cc && h) boardH[i] = { ...h, grip: Math.max(0, h.grip - cc.restChip) }']] },
  { id: 'CARD-18/latch-forever', suite: 'core',
    why: 'the latch stops being once-only', catches: 'the latch is not marked',
    patch: [['src/engine.ts',
      '        boardP[i] = { ...card, contact: 1, latched: true }',
      '        boardP[i] = { ...card, contact: 1 }']] },
  { id: 'CARD-18/into-rewards', suite: 'core',
    why: 'a new card slips into the in-run reward pool — a silent band change',
    catches: 'that is a band change, measure it',
    patch: [['src/engine.ts',
      "  uncommon: ['Cross-Through', 'Lock & Bump', 'Dyno', 'Toe Hook', 'Visualize', 'Try-Hard Scream',",
      "  uncommon: ['Milk The Jug', 'Cross-Through', 'Lock & Bump', 'Dyno', 'Toe Hook', 'Visualize', 'Try-Hard Scream',"]] },
  { id: 'CARD-18/drafter-blind-to-chip', suite: 'core',
    why: 'the drafter goes blind to restChip again', catches: 'the same with and without its chip',
    patch: [['src/engine.ts', '  if (c.restChip) v += c.restChip * 3', '  if (false) v += c.restChip * 3']] },
  { id: 'CARD-18/read-becomes-power', suite: 'core',
    why: 'reading ahead starts changing the turn — information becomes a power',
    catches: 'reading is a power now',
    patch: [['src/engine.ts',
      '  out = { ...out, pump, flow, readAhead: flowRead, turn: s.turn + 1,',
      '  out = { ...out, pump: Math.max(0, pump - (s.readAhead > 0 ? 1 : 0)), flow, readAhead: flowRead, turn: s.turn + 1,']] },
  { id: 'CARD-18/keyword-says-nothing', suite: 'core',
    why: 'a keyword stops saying what it does', catches: 'skin is unexplained',
    patch: [['src/engine.ts',
      "  { name: 'Skin', text: 'How much more your hands will take on this trip. Falls cost it, a camp gives some back,",
      "  { name: 'Skin', text: 'How much more your hands will take on this trip. Some cards spend it. Some cards spend it,"]] },

  // ---- SKIRM-7: the Circuit had nobody in it ------------------------------------
  { id: 'SKIRM-7/circuit-alone', suite: 'core',
    why: 'THE BUG: the partner gate back to inRun only', catches: 'the Circuit still goes out alone',
    patch: [['src/engine.ts', '  if (!s.inRun && !s.circuit) return null', '  if (!s.inRun) return null']] },
  { id: 'SKIRM-7/gate-too-wide', suite: 'core',
    why: 'the gate widened so every mode gets a partner',
    catches: 'so the gate widened further than the Circuit',
    patch: [['src/engine.ts', '  if (!s.inRun && !s.circuit) return null', '  if (false) return null']] },
  { id: 'SKIRM-7/partner-changes', suite: 'core',
    why: 'the partner changes as the circuit goes deeper', catches: 'the partner changed at line',
    patch: [['src/engine.ts',
      '  return PARTNERS[(s.runSeed >>> 0) % PARTNERS.length]\n}\n/** SKIRM-7: whether they would go again',
      '  return PARTNERS[((s.runSeed >>> 0) + (s.circuitScore || 0)) % PARTNERS.length]\n}\n/** SKIRM-7: whether they would go again']] },
  { id: 'SKIRM-7/one-shared-threshold', suite: 'core',
    why: 'the threshold stops being theirs', catches: 'said they would',
    patch: [['src/engine.ts',
      "  return s.circuitScore >= p.enough ? 'enough' : 'again'",
      "  return s.circuitScore >= 6 ? 'enough' : 'again'"]] },
  { id: 'SKIRM-7/no-disagreement', suite: 'core',
    why: 'the partners all stop at the same point', catches: 'does not matter',
    patch: [['src/engine.ts',
      "    enough: 10,\n    says: {\n      again: 'She is already pulling the rope through.",
      "    enough: 14,\n    says: {\n      again: 'She is already pulling the rope through."],
      ['src/engine.ts',
      '    enough: 6,\n    says: {\n      again: \'"Go on then, while it is cool."',
      '    enough: 14,\n    says: {\n      again: \'"Go on then, while it is cool."'],
      ['src/engine.ts',
      '    enough: 3,\n    says: {\n      again: \'"If you must."',
      '    enough: 14,\n    says: {\n      again: \'"If you must."']] },
  { id: 'SKIRM-7/circuit-silent', suite: 'core',
    why: 'the ambience bed goes silent for the Circuit again', catches: 'the Circuit climbs in silence again',
    patch: [['src/engine.ts',
      '    if (s.circuit) return circuitBed(s.circuitScore)',
      '    if (false) return circuitBed(s.circuitScore)']] },
  { id: 'SKIRM-7/bed-flat', suite: 'core',
    why: 'the bed stops changing with depth', catches: 'carries no information',
    patch: [['src/engine.ts',
      "export const CIRCUIT_BEDS: Record<number, Bed> = { 0: 'forest', 3: 'forest', 6: 'desert', 10: 'alpine', 14: 'alpine' }",
      "export const CIRCUIT_BEDS: Record<number, Bed> = { 0: 'forest', 3: 'forest', 6: 'forest', 10: 'forest', 14: 'forest' }"]] },
  { id: 'SKIRM-7/zone-with-no-bed', suite: 'core',
    why: 'a new zone with no bed of its own', catches: 'has no bed of its own',
    patch: [['src/engine.ts',
      "  if (n >= 14) return { name: 'Into the Dark',",
      "  if (n >= 20) return { name: 'The Deep', text: 'Deeper than anyone has been.', floor: 20 }\n  if (n >= 14) return { name: 'Into the Dark',"]] },
  { id: 'SKIRM-7/daily-gets-a-bed', suite: 'core',
    why: 'the deliberate exceptions break — a daily picks up a bed',
    catches: 'picked up an ambience bed it is meant not to have',
    patch: [['src/engine.ts',
      "    if (s.circuit) return circuitBed(s.circuitScore)\n    return 'none'",
      "    return circuitBed(s.circuitScore)\n    return 'none'"]] },
  { id: 'SKIRM-7/partner-not-rendered', suite: 'core',
    why: 'the partner is in the data but not on the screen', catches: 'nobody is standing there between lines',
    patch: [['src/App.tsx',
      '        {mate ? (\n          <div className="spot" style={{ borderLeftColor: \'var(--tan)\' }} role="status">',
      '        {false && mate ? (\n          <div className="spot" style={{ borderLeftColor: \'var(--tan)\' }} role="status">']] },
  { id: 'SKIRM-7/opinion-unmarked', suite: 'core',
    why: 'their view stops being marked on the buttons', catches: 'so it is flavour rather than an opinion',
    patch: [['src/App.tsx',
      "        {mate && push === 'again' ? (\n          <div className=\"sub\" style={{ color: 'var(--tan)', marginTop: 3 }}>\n            ▸ {mate.name} would go again.</div>) : null}",
      '        {null}']] },
  { id: 'SKIRM-7/season-carve-out', suite: 'core',
    why: 'the season carve-out is quietly reversed', catches: 'that is farmable',
    patch: [['src/engine.ts',
      '    seasonId: sk, seasonScore, seasonDays, seasonWeeks: wks,',
      '    seasonId: sk, seasonScore: seasonScore + s.circuitScore, seasonDays, seasonWeeks: wks,']] },
  { id: 'SKIRM-7/mechanical-partner', suite: 'core',
    why: 'a partner field that does not just select text',
    catches: 'carries a field a partner should not have',
    patch: [['src/engine.ts', '    enough: 10,\n    says: {', '    enough: 10, dPower: 2,\n    says: {']] },

  // ---- SIM-7: BUILD ME ONE was handing you an illegal deck -----------------------
  { id: 'SIM-7/rare-slots-off', suite: 'kept',
    why: 'THE BUG: the builder stops counting its rares', catches: 'rares against a limit of',
    patch: [['src/engine.ts',
      "      if (r === 'rare' && slotsUsed(deck, 'rare') >= RARE_SLOTS) continue",
      "      if (false && r === 'rare' && slotsUsed(deck, 'rare') >= RARE_SLOTS) continue"]] },
  { id: 'SIM-7/uncommon-slots-off', suite: 'kept',
    why: 'the uncommon slot rule removed', catches: 'uncommons against a limit of',
    patch: [['src/engine.ts',
      "      if (r === 'uncommon' && slotsUsed(deck, 'uncommon') >= UNCOMMON_SLOTS) continue",
      "      if (false && r === 'uncommon' && slotsUsed(deck, 'uncommon') >= UNCOMMON_SLOTS) continue"]] },
  { id: 'SIM-7/bad-seed-topped-up', suite: 'kept',
    why: 'a loadout already over the limit gets topped up (>= slipped to ===)',
    catches: 'already over the limit',
    patch: [['src/engine.ts',
      "      if (r === 'rare' && slotsUsed(deck, 'rare') >= RARE_SLOTS) continue",
      "      if (r === 'rare' && slotsUsed(deck, 'rare') === RARE_SLOTS) continue"]] },
  { id: 'SIM-7/beta-into-decks', suite: 'kept',
    why: 'buildable stops refusing beta cards', catches: 'put them in the deck the game builds',
    patch: [['src/engine.ts',
      "  return [...starter, ...owned.filter(n => CARDS[n] && CARDS[n].rarity !== 'curse'\n    && CARDS[n].rarity !== 'beta' && CARDS[n].rarity !== 'starter')]",
      "  return [...starter, ...owned.filter(n => CARDS[n] && CARDS[n].rarity !== 'curse'\n    && CARDS[n].rarity !== 'starter')]"]] },
  { id: 'SIM-7/picker-drifts', suite: 'kept',
    why: 'the card picker and the builder stop reading the same rule', catches: 'have drifted',
    patch: [['src/App.tsx',
      "      if (r === 'rare' && slotsUsed(cur, 'rare') >= RARE_SLOTS) return s",
      "      if (r === 'rare' && slotsUsed(cur, 'rare') >= 99) return s"],
      ['src/App.tsx',
      "      if (r === 'uncommon' && slotsUsed(cur, 'uncommon') >= UNCOMMON_SLOTS) return s",
      "      if (r === 'uncommon' && slotsUsed(cur, 'uncommon') >= 99) return s"],
      ['src/App.tsx',
      "          rare {slotsUsed(mine, 'rare')}/{RARE_SLOTS} · uncommon {slotsUsed(mine, 'uncommon')}/{UNCOMMON_SLOTS}",
      "          rare {slotsUsed(mine, 'rare')} · uncommon {slotsUsed(mine, 'uncommon')}"],
      ['src/App.tsx',
      "                  || (c.rarity === 'rare' && slotsUsed(mine, 'rare') >= RARE_SLOTS)\n                  || (c.rarity === 'uncommon' && slotsUsed(mine, 'uncommon') >= UNCOMMON_SLOTS)",
      "                  || (c.rarity === 'rare' && slotsUsed(mine, 'rare') >= 99)\n                  || (c.rarity === 'uncommon' && slotsUsed(mine, 'uncommon') >= 99)"],
      ['src/App.tsx',
      '  PUMP_MAX, Phase, RARE_SLOTS, RNG, ROCK, ROUTES, RUN_SKIN, Rarity, SKIN_MAX,',
      '  PUMP_MAX, Phase, RNG, ROCK, ROUTES, RUN_SKIN, Rarity, SKIN_MAX,'],
      ['src/App.tsx',
      '  UNCOMMON_SLOTS, WEATHER, abilityOf, activeSlot, aheadSummary, applyOutcome,',
      '  WEATHER, abilityOf, activeSlot, aheadSummary, applyOutcome,']] },
  { id: 'SIM-7/rare-stuffed-legal', suite: 'kept',
    why: 'the slot limits raised so the original rare-stuffed deck is legal again',
    catches: 'already over the limit',
    patch: [['src/engine.ts', 'export const RARE_SLOTS = 1', 'export const RARE_SLOTS = 10'],
      ['src/engine.ts', 'export const UNCOMMON_SLOTS = 3', 'export const UNCOMMON_SLOTS = 10']] },
  { id: 'SIM-7/measured-floor', suite: 'slow',
    why: 'the measured floor under the deck the game builds',
    catches: 'it is offering to make you worse',
    patch: [['src/engine.ts',
      "      if (r === 'rare' && slotsUsed(deck, 'rare') >= RARE_SLOTS) continue",
      "      if (false && r === 'rare' && slotsUsed(deck, 'rare') >= RARE_SLOTS) continue"]] },

  // ---- SIM-8: the band measures a deck a player can hold ------------------------
  { id: 'SIM-8/harness-builds-its-own', suite: 'core',
    why: 'THE BUG: the harness builds its own deck again', catches: 'instead of asking the engine',
    patch: [['sim/run.mjs',
      '  return E.buildLoadout(st, [], owned)',
      "  return Object.keys(E.CARDS).filter(n => E.CARDS[n].rarity !== 'curse').slice(0, 15)"]] },
  { id: 'SIM-8/second-opinion', suite: 'core',
    why: 'the harness grows a second card-scoring opinion inside the builder',
    catches: 'scoring cards by hand again',
    patch: [['sim/run.mjs',
      '  return E.buildLoadout(st, [], owned)',
      '  const pick = owned.sort((a, b) => E.CARDS[b].power - E.CARDS[a].power)\n  return E.buildLoadout(st, pick.slice(0, 2), owned)']] },
  { id: 'SIM-8/beta-claimed-as-owned', suite: 'core',
    why: 'the harness stops restricting itself to the collectible rarities',
    catches: 'restricts itself to the collectible rarities',
    patch: [['sim/run.mjs',
      "    .filter(n => ['common', 'uncommon', 'rare'].includes(E.CARDS[n].rarity ?? 'common'))",
      "    .filter(n => E.CARDS[n].rarity !== 'curse')"]] },
  { id: 'SIM-8/buildable-lets-beta-through', suite: 'core',
    why: 'buildable stops refusing beta, so claiming them puts them back in the measured deck',
    catches: 'puts them back in the measured deck',
    patch: [['src/engine.ts',
      "  return [...starter, ...owned.filter(n => CARDS[n] && CARDS[n].rarity !== 'curse'\n    && CARDS[n].rarity !== 'beta' && CARDS[n].rarity !== 'starter')]",
      "  return [...starter, ...owned.filter(n => CARDS[n] && CARDS[n].rarity !== 'curse'\n    && CARDS[n].rarity !== 'starter')]"]] },
  { id: 'SIM-8/measured-deck-illegal', suite: 'core',
    why: 'the measured deck goes illegal', catches: 'rares against',
    patch: [['src/engine.ts',
      "      if (r === 'rare' && slotsUsed(deck, 'rare') >= RARE_SLOTS) continue",
      "      if (false && r === 'rare' && slotsUsed(deck, 'rare') >= RARE_SLOTS) continue"]] },
  { id: 'SIM-8/band-excludes-its-pin', suite: 'core',
    why: 'the pin number and its band drift apart', catches: 'but its band is',
    patch: [['sim/test.mjs', '    ok(full > 38 && full < 50,', '    ok(full > 60 && full < 80,']] },
  { id: 'SIM-8/band-too-wide', suite: 'core',
    why: 'the band widened until it could not catch a drift',
    catches: 'which would not catch a BAL-14 slide',
    patch: [['sim/test.mjs', '    ok(full > 38 && full < 50,', '    ok(full > 5 && full < 95,']] },
  { id: 'SIM-8/repin-undated', suite: 'core',
    why: 'the re-pin loses its date', catches: 'does not say which version set the pin',
    patch: [['sim/test.mjs',
      '    /* THE PIN IS ~44, RE-SET AT v10.23 (SIM-8), and this is a deliberate dated re-pin in',
      '    /* THE PIN IS ~44, and this is a deliberate dated re-pin in'],
      ['sim/test.mjs',
      '      `the campaign completes ${full}% with a full journal — ~44, re-pinned at v10.23 (SIM-8)`)',
      '      `the campaign completes ${full}% with a full journal — ~44, re-pinned lately`)']] },

  // ---- GUARD-9: the kept injections themselves ----------------------------------
  /* A ticket that says every guard gets injections had better have its own. These are
     safe from recursion because the runner loads its table into memory before it patches
     anything, so a mutated table only affects the suite it then runs.
     Note the SPLIT STRINGS below. A mutant that patches this file has to quote the line it
     targets, which puts a second verbatim copy in the file and makes its own anchor match
     twice — so the anchor check kills it, correctly. Writing the needle in two halves means
     the file never holds a whole second copy. It is the same self-reference GUARD-8 needed
     its `guard-8: allow` marker for, and it wants the same kind of note rather than a
     silently clever line. */
  { id: 'GUARD-9/dead-anchor', suite: 'core',
    why: 'a kept injection whose anchor has moved, so it patches nothing',
    catches: 'patch nothing any more',
    /* by REFORMATTING the line a mutant targets — behaviour identical, anchor dead. That is
       how this actually happens: nobody deletes an anchor on purpose. */
    patch: [['sim/guard.mjs', '  if (out.length < min) {', '  if (out.length  < min) {']] },
  { id: 'GUARD-9/injection-expects-nothing', suite: 'core',
    why: 'an injection that does not say which guard it expects to hear from',
    catches: 'does not say what it expects to hear',
    patch: [['sim/mutants.mjs',
      "    why: 'region stops checking its own size', catches: 'region does not check its own siz" + "e',",
      "    why: 'region stops checking its own size', catches: '',"]] },
  { id: 'GUARD-9/runner-stops-restoring', suite: 'core',
    why: 'the runner stops putting the sources back after each mutant',
    catches: 'no longer restores after each mutant',
    patch: [['sim/mutants.mjs',
      '    } finally {\n      restore(); dirty = false\n    }',
      '    }']] },
  { id: 'GUARD-9/runner-stops-checking-the-tree', suite: 'core',
    why: 'the runner stops checking it left the tree clean',
    catches: 'no longer checks that it put the sources back',
    patch: [['sim/mutants.mjs', 'THE TREE IS STILL MUT' + 'ATED', 'some files may still be mutated']] },
  { id: 'GUARD-9/runner-abandons-on-interrupt', suite: 'core',
    why: 'the runner stops restoring the tree on Ctrl-C',
    // split for the same reason as the anchors: the guard greps this file for the signal
    // name, so leaving a whole copy here makes the mutant unable to fail.
    catches: 'no longer restores the tree on SIG' + 'INT',
    patch: [['sim/mutants.mjs', "  process.on('SIG" + "INT', () => { bail(); process.exit(130) })",
      "  process.on('SIGHUP', () => { bail(); process.exit(130) })"]] },

  // ---- BAL-16: a floor nobody can measure is not a floor -------------------------
  { id: 'BAL-16/buy-back-removed', suite: 'core',
    why: 'THE BUG: the Comp Kid back on its unmeasurable floor',
    catches: 'no psyche buy-back',
    patch: [['src/engine.ts', "quickFeet: true, dPsyche: 1, deed: 'strong',", "quickFeet: true, deed: 'strong',"]] },
  { id: 'BAL-16/buy-back-spreads', suite: 'core',
    why: 'the buy-back handed to a climber that did not need it',
    catches: 'this was a buy-back for one climber',
    patch: [['src/engine.ts', "    dContact: 1, settleMax: 0,", "    dContact: 1, settleMax: 0, dPsyche: 1,"]] },
  { id: 'BAL-16/bare-constant-cap', suite: 'core',
    why: 'a psyche cap goes back to the bare constant, so the dial stops applying there',
    catches: 'reads the bare constant again',
    patch: [['src/engine.ts', '      psyche: Math.min(psycheMax(s), s.psyche + PSYCHE_CAMP) })',
      '      psyche: Math.min(PSYCHE_MAX, s.psyche + PSYCHE_CAMP) })']] },
  { id: 'BAL-16/dial-ignored', suite: 'core',
    why: 'psycheMax stops reading the climber', catches: 'no longer reads the climber',
    patch: [['src/engine.ts', 'PSYCHE_MAX + (archOf(s).dPsyche ?? 0)', 'PSYCHE_MAX + 0']] },
  { id: 'BAL-16/floor-moved', suite: 'core',
    why: 'the 5% floor lowered to accommodate a climber — the BAL-9 failure',
    catches: 'the 5% floor has been moved',
    patch: [['sim/test.mjs', '    ok(lo > 5, `${E.ARCHETYPES[worst].name} completes only',
      '    ok(lo > 4, `${E.ARCHETYPES[worst].name} completes only']] },
  { id: 'BAL-16/margin-check-gone', suite: 'core',
    why: 'the guard stops checking its own margin is measurable',
    catches: 'no longer checks its own margin',
    patch: [['sim/test.mjs', '    ok(lo - 5 > 2 * se,', '    ok(lo - 5 > 0 * se,']] },
  { id: 'BAL-16/fine-pass-gone', suite: 'core',
    why: 'the guard stops resolving the lowest climber finely',
    catches: 'no longer resolves the lowest climber finely',
    patch: [['sim/test.mjs', 'PROJECTS=0 ARCH' + '_ONLY=${i} node sim/run.mjs arch ${FINE}',
      'PROJECTS=0 node sim/run.mjs arch ${FINE}']] },

  // ---- SKIRM-8: the good outcome gets a screen ------------------------------------
  { id: 'SKIRM-8/back-to-the-menu', suite: 'core',
    why: 'THE BUG: the walk-off goes straight to the guidebook again',
    catches: 'goes straight to the menu again',
    patch: [['src/engine.ts', "    phase: 'sessionEnd', result: 'walked' }", "    phase: 'menu', result: 'walked' }"]] },
  { id: 'SKIRM-8/unmarked', suite: 'core',
    why: 'the walk-off is unmarked, so its screen cannot tell what it was',
    catches: 'the walk-off is unmarked',
    patch: [['src/engine.ts', "    phase: 'sessionEnd', result: 'walked' }", "    phase: 'sessionEnd' }"]] },
  { id: 'SKIRM-8/reads-as-a-bail', suite: 'core',
    why: 'a walk-off marked as a bailed skirmish', catches: 'the walk-off is unmarked',
    patch: [['src/engine.ts', "    phase: 'sessionEnd', result: 'walked' }", "    phase: 'sessionEnd', result: 'bail' }"]] },
  { id: 'SKIRM-8/mode-comes-with-you', suite: 'core',
    why: 'the circuit mode is left set on the way out (MODE-1)',
    catches: 'the circuit mode came with you',
    patch: [['src/engine.ts', "  return { ...rec, circuit: false, skirmish: null, runDeck: [], log: [],",
      "  return { ...rec, skirmish: null, runDeck: [], log: [],"]] },
  { id: 'SKIRM-8/nothing-rendered', suite: 'core',
    why: 'the walk-off block is gated off, so the result is rendered nowhere',
    catches: 'the block with your score on it is not gated',
    patch: [['src/App.tsx', '        {walked ? (\n          <div className="spot" style={{ borderLeftColor: \'var(--green)\' }} role="status">',
      '        {false ? (\n          <div className="spot" style={{ borderLeftColor: \'var(--green)\' }} role="status">']] },
  { id: 'SKIRM-8/route-header-ungated', suite: 'core',
    why: 'the route header is shown on a walk-off, naming a route you were never on',
    catches: 'the route header is not gated',
    patch: [['src/App.tsx',
      '        {walked ? (\n          <div className="sub">the circuit · {zone.name.toLowerCase()}</div>\n        ) : (\n          <div className="sub">{spec.name}',
      '        {walked ? (\n          <div className="sub">the circuit</div>\n        ) : null}\n        {true ? (\n          <div className="sub">{spec.name}']] },
  { id: 'SKIRM-8/route-count-ungated', suite: 'core',
    why: 'the per-route burn and hold count shown on a walk-off (found by rendering it)',
    catches: 'is not about one route',
    patch: [['src/App.tsx', '        {walked ? null : (\n          <div style={{ fontSize:',
      '        {false ? null : (\n          <div style={{ fontSize:']] },
  { id: 'SKIRM-8/share-gone', suite: 'core',
    why: 'there is no way to paste what you did', catches: 'there is no way to paste',
    patch: [['src/App.tsx', 'circuitShare(st)', "'' /* gone */"]] },
  { id: 'SKIRM-8/best-claimed-wrongly', suite: 'core',
    why: 'a lesser circuit claims a personal best', catches: 'claims a personal best',
    patch: [['src/engine.ts', '  const best = s.circuitScore >= s.bestCircuit\n  const lines = [\n    \'Sandbagged · the circuit\',',
      '  const best = true\n  const lines = [\n    \'Sandbagged · the circuit\',']] },
  { id: 'SKIRM-8/plural-slip', suite: 'core',
    why: 'one line reads as "1 lines"', catches: 'one line reads as',
    patch: [['src/engine.ts', "`${s.circuitScore} line${s.circuitScore === 1 ? '' : 's'} ·", "`${s.circuitScore} lines ·"]] },
]

/* ---- the runner -------------------------------------------------------------- */

const SUITES = {
  core: 'node sim/test-core.mjs',
  kept: 'node sim/test.mjs',
  slow: 'node sim/test.mjs slow',
}

/** Every file any mutant touches. */
export const touched = () => [...new Set(MUTANTS.flatMap(m => m.patch.map(p => p[0])))]

/** Apply one mutant's patches to a working copy of the sources. Throws if an anchor is
    not present exactly once, which is the whole point — a mutant whose anchor has moved
    is a mutant that tests nothing, so it must be loud rather than skipped. */
export function applyPatch(mutant, read) {
  const out = new Map()
  for (const [file, from, to] of mutant.patch) {
    const src = out.get(file) ?? read(file)
    const n = src.split(from).length - 1
    if (n !== 1) {
      throw new Error(`${mutant.id}: its anchor in ${file} matches ${n} times, not once — the mutant is dead:\n    ${from.split('\n')[0]}`)
    }
    out.set(file, src.replace(from, to))
  }
  return out
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2]
  const wantSlow = arg === 'slow'
  const only = arg && !wantSlow ? arg : null
  const chosen = MUTANTS.filter(m =>
    (only ? m.id.startsWith(only) : true) && (m.suite === 'slow' ? wantSlow || only : true))

  const files = touched()
  const snapshot = new Map(files.map(f => [f, readFileSync(f, 'utf8')]))
  const restore = () => { for (const [f, src] of snapshot) writeFileSync(f, src) }
  let dirty = false
  const bail = () => { if (dirty) { restore(); dirty = false } }
  process.on('SIGINT', () => { bail(); process.exit(130) })
  process.on('uncaughtException', e => { bail(); console.error(e); process.exit(1) })

  console.log(`\n  ${chosen.length} mutant${chosen.length === 1 ? '' : 's'}` +
    `${only ? ` matching ${only}` : ''}${wantSlow ? ' (including the ledger ones)' : ''}\n`)
  const missed = []
  let ticket = ''
  for (const m of chosen) {
    const t = m.id.split('/')[0]
    if (t !== ticket) { console.log(`  ${t}`); ticket = t }
    let caught = false, note = ''
    try {
      for (const [f, src] of applyPatch(m, f2 => snapshot.get(f2))) { writeFileSync(f, src); dirty = true }
      let out = ''
      try { out = execSync(SUITES[m.suite], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }
      catch (e) { out = `${e.stdout ?? ''}${e.stderr ?? ''}` }
      caught = out.includes(m.catches)
      if (!caught) note = /✗/.test(out) ? 'something else failed instead' : 'the suite passed'
    } catch (e) {
      note = e.message
    } finally {
      restore(); dirty = false
    }
    console.log(`    ${caught ? '✓' : '✗'} ${m.why}`)
    if (!caught) { console.log(`        expected to see: ${m.catches}${note ? ` — ${note}` : ''}`); missed.push(m) }
  }

  // the sources must be exactly as we found them
  const changed = files.filter(f => readFileSync(f, 'utf8') !== snapshot.get(f))
  if (changed.length) {
    console.error(`\n  THE TREE IS STILL MUTATED: ${changed.join(', ')} — put them back before doing anything else\n`)
    process.exit(2)
  }
  console.log(`\n  ${chosen.length - missed.length}/${chosen.length} caught` +
    `${wantSlow || only ? '' : `  (run \`node sim/mutants.mjs slow\` for the ${MUTANTS.filter(m => m.suite === 'slow').length} ledger one${MUTANTS.filter(m => m.suite === 'slow').length === 1 ? '' : 's'})`}\n`)
  process.exit(missed.length ? 1 : 0)
}
