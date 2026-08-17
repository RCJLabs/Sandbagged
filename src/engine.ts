// Sandbagged — the engine.
//
// Types, dials, content tables and every rule of the game. Nothing in here
// knows that a screen exists: no React, no JSX, no DOM. The UI imports from
// this file and never the other way round, which is the point — three of the
// bugs this project shipped were state-shape mistakes that a module boundary
// makes visible.
//
// All in-run randomness flows through the seeded run RNG. Never Math.random().
/* ============================== DIALS ============================== */
export const PUMP_MAX = 11
export const HAND_SIZE = 5
export const HANG_FLAT = 1
export const HANG_TAX = 1
export const SUPPORT = 1
export const CAMPUS_BITE = 1
export const FLOW_AT = 2
export const FLOW_TAX = 1
/* ENG-23: flow you can feel. It used to cap at 3 and read as a single on/off
   switch at FLOW_AT (unanswered lanes stop costing tax) — flow 1 vs flow 3 was
   invisible. Now it climbs to FLOW_MAX as a visible track, and there is a
   second, earned breakpoint at FLOW_HIGH: dialed in, you are moving so well the
   dyno lands far more often (stickChance below), a real reward for a
   flow-and-throw line without touching the clock — a per-turn pump relief was
   measured at +7 to +13 points of completion (the "per-turn costs compound"
   lesson, in reverse) and cut. You reach the tier only by clearing a hold every
   turn without resting, so it is never a turtle's reward, and momentum cards
   still cap their Power at the old ceiling (below), so the raised cap feeds the
   dyno and the track, never the explosive stat. */
export const FLOW_HIGH = 4
export const FLOW_MAX = 5
/* ENG-24: the audit flagged that flow 3-5 does nothing for a deck with no
   momentum/dyno cards — its one clock payoff, the unanswered-lane tax relief,
   is already spent at FLOW_AT (HANG_TAX is 1, so the tax is 0 by flow 2, nothing
   left to graduate). The obvious fix — easing the per-turn pump at FLOW_HIGH —
   is the exact thing ENG-23 measured at +7 to +13 points and cut, so the top of
   the bar pays in INFORMATION instead: dialed in, you read the coming holds. It
   moves readAhead only, which resolution never consults and the greedy sim never
   reads (the ROUTE-12 lesson), so it cannot touch the band — a real reward for a
   steady deck that never touches the clock the flow-and-throw lesson protects. */
export const FLOW_READ = 2
export const BETA_GRIP = 1
export const ATTEMPTS = 3        // v0.7: 4 → 3. Sessions must fit ~5 minutes.
export const SKIN_MAX = 4
// ENG-4: a move that survives a turn settles into the hold and gains Power.
// This is what converts Contact into offense — without it, Contact is worthless
// and at low Power it is actively negative (you survive only to eat more clock).
export const SETTLE_MAX = 2
// Compensates for Settle. Raising Bite kills cards before they settle, which
// restores difficulty WITHOUT devaluing Contact the way more clock would.
export const BITE_BUMP = 1
export const RUN_SKIN = 9       // run-scoped. Falls cost 1. Zero ends the run.
export const CAMP_SKIN = 2
export const SAVE_KEY = 'sandbagged.save'
export const SLOT_KEY = 'sandbagged.slot'
export const SLOTS = 3
export const SAVE_FILE_VERSION = 1
export const PACK_SIZE = 4
export const DECK_SIZE = 15      // loadout is fixed size: choice is composition, not bulk
// Copy limits scale with rarity. Without this a full collection runs 9 rares
// in 15 cards and every route in the act sends at 100%.
export const copyLimit = (r: Rarity): number =>
  r === 'rare' ? 1 : r === 'uncommon' ? 2 : 3
// ...and a cap on how many you may carry at once. Without this a full
// collection fields eight distinct rares and every route sends at ~100%.
export const RARE_SLOTS = 1
export const UNCOMMON_SLOTS = 3
export const slotsUsed = (loadout: string[], r: Rarity) =>
  loadout.filter(n => CARDS[n]?.rarity === r).length

/* ============================== TYPES ============================== */
export type LaneTag = 'hand' | 'feet' | 'any'
type StyleKey = 'jug haul' | 'mixed' | 'slab' | 'crimp ladder' | 'compression' | 'power'
type FeetKey = 'easy' | 'normal' | 'hard'
type Fx = '' | 'precise' | 'friction' | 'static' | 'snap' | 'commit' | 'balance' | 'hooked'
  | 'tough' | 'settle2' | 'greedy' | 'guard' | 'momentum' | 'weight' | 'echo' | 'peel' | 'cycle'
export type Rarity = 'starter' | 'common' | 'uncommon' | 'rare' | 'curse' | 'gear' | 'beta'
export type Tag = '' | 'crimp' | 'sloper' | 'pinch' | 'pocket' | 'dyno' | 'crack'
  | 'feet' | 'rest' | 'mental'

export type Hold = {
  uid: number; name: string; bite: number; grip: number; crux: boolean; clean: boolean
  /** A named feature: reads as itself, behaves as its base type. */
  sig?: string
  /** ENG-10. A hold is exactly what it is — you just have not touched it yet.
      Rolled once when the route is built, so a seed still replays identically;
      hidden from you until you have beta on this kind of hold. */
  wobble?: number
  /** Moss, lichen and loose rock on a line nobody has climbed. Comes off with
      a brush, and until it does every hold is harder than it looks. */
  dirt?: number
  /** ROUTE-10: a display name that overrides the base type on the board — the
      crux reads as its style's own feature (the razor, the blank, the throw)
      while still resolving as a Committing crux. */
  label?: string
}
export type Card = {
  uid: number; name: string; kind: 'move' | 'bonus'
  power: number; contact: number; lane: LaneTag
  shed: number; support: number; anchor: boolean; latch: boolean
  cost: number; powerAll: number; gripCut: number; draw: number; cleans: boolean
  /** RUN-9: read the next N holds off the route deck — the order of what is
      coming, which projecting never showed. Information, not power. */
  read: number
  restore: number; rarity: Rarity; chip: number; skinCost: number; synergy: Tag
  /** CARD-11: a rest that also works the hold in its OWN lane — chips its grip
      by this much. Where you rest becomes a choice (soften the hold you want
      next vs block the bite you fear), not just how much you shed. */
  restChip?: number
  /** CARD-13: a curse that does something — the mirror of restChip. Dumping this
      onto a lane sharpens the hold there by this much Grip (a tweak, a flapper,
      a wet hold makes the rock worse), so a curse costs you a position, not just
      a draw. You still choose the least-bad lane to be rid of it. */
  hex?: number
  clip: boolean; seq: string
  /** ENG-12. A move that pulls sideways needs the other hand pulling back.
      Left and right were interchangeable, which made a three-lane board a
      two-lane one; this is what makes *which hand* a question. */
  opposes: boolean
  fx: Fx; targeted: boolean; text: string; latched?: boolean; settled?: number
  /* ENG-32: has this card stood a full turn on the wall? Deliberately NOT `settled`.
     The Trad Dad's whole signature is `settleMax: 0` — "nothing you place ever
     settles" — which is a statement about the Power bonus, not about whether a foot is
     planted. Reading freshness off `settled` charged that climber the settling cost
     every turn for ever, as a side effect of its own identity (measured: 6.2%). Two
     different questions, so now two fields. */
  set?: boolean
  upgraded?: boolean
}
type Piles = { draw: Card[]; discard: Card[]; exhaust: Card[]; hand: Card[] }
export type Phase = 'menu' | 'map' | 'climb' | 'burnEnd' | 'sessionEnd'
  | 'reward' | 'camp' | 'runEnd' | 'pack' | 'collection' | 'event' | 'journal' | 'deck' | 'talk'
  | 'glossary' | 'gear' | 'logbook' | 'shop' | 'circuitNext' | 'saves' | 'stats'
  | 'prepare' | 'more' | 'epilogue' | 'history' | 'line' | 'claim' | 'deeds'
export type NodeType = 'climb' | 'camp' | 'boss' | 'event' | 'project' | 'shop' | 'fa'
  | 'established'
// Skin is worth ~16 points of completion — far too coarse for a small
// decision. Cash is the currency you can spend a little of.
export const PRICE = { common: 30, uncommon: 55, rare: 90, gear: 70, boon: 110, cut: 40, skin: 45, kit: 35 }
// A reward used to be three cards, take one. These make it a decision with a
// price on it — cash, or the health of your deck.
export const REROLL_BASE = 25
export const REROLL_STEP = 15
export const CROP_COST = 45
/* CARD-17. The four BONUS curses — Bad Landing, Ego, Doubt, Sandbagged Beta — were
   the last dead cards in the game, and worse than dead. They carry a pump cost and
   nothing else, and a played bonus goes to the DISCARD, so paying to play one bought
   you nothing and then handed the card back when the discard reshuffled. Strictly
   negative: the only correct play was to let it clog your hand.
   They are a tax you can PAY OFF now. Play one and it is written off — exhausted for
   the rest of the burn instead of recycled — for the cost already printed on it plus
   this surcharge. CARD-16 deferred to exactly this: a removal mechanic rather than an
   active per-turn effect, because a per-turn pump term compounds and this project has
   measured that five times. Camps already `cut` a card from the run deck for good;
   this is the mid-climb move that camp cannot make, and it is deliberately a worse
   deal than the camp's — you are paying for the timing. */
export const CURSE_TAX = 1
export const cashForSend = (grade: number) => 5 + grade * 2
// Skin is attrition from falling; psyche is attrition from FAILING. Skin
// caps how much you can climb, psyche caps how much you can fail.
export const PSYCHE_MAX = 3
export const PSYCHE_FAIL = 1      // lost when a boulder beats you
export const PSYCHE_BAIL = 2
export const PSYCHE_SEND = 1
export const PSYCHE_CAMP = 2
export const DOUBT_AT = 2         // at or below this, the clock runs faster
// Daylight. A deck with enough rests in it could shed faster than the clock
// ticked and hang on a boulder forever — the Alpinist averaged 457 turns.
export const TURN_CAP = 30
// You toprope before you lead. Explicit, switchable, and it does not unlock
// styles — a beginner setting you can see rather than difficulty done behind
// your back.
export const TOPROPE_SKIN = 3
/* The v0 pitch was that his journal pages are lore *and* the finale's beta —
   that exploration literally makes The Lost Line sendable. Once decks got
   better the pages stopped mattering at all (54.0 / 54.5 / 52.5%). They now
   do the thing they were always described as doing: without them you cannot
   read the route, and every hold on it is harder for that. */
export const UNREAD_GRIP = 1
/* NARR-16. What reading everything is worth, and what the wall costs you anyway.

   This used to be one expression — `JOURNAL.length - 1 - held(pages 1..6)` — in which
   both halves meant "six": six findable pages, six grip of blindness, read them all and
   the route is legible. NARR-11 grew the journal to fifteen and pulled the two halves
   apart. The first became FOURTEEN. The second stayed capped at six. Two things happened
   at once, neither of them measured:

     - the finale got a flat EIGHT grip harder per hold for everybody, blind or read.
       Eleven versions of balance have since been pinned on top of that, so it is real
       now whether or not it was intended, and taking it back out is a bigger change
       than leaving it in. It is named rather than reverted.

     - the eight pages NARR-11 added became worth NOTHING on the wall. Measured mean
       hold grip on the finale: no pages 24.37, pages 1-6 18.37, ALL FOURTEEN FINDABLE
       18.37 — identical. Holding only the eight new ones measured 24.37, the same as
       holding none of them. They have BETA_CARDS entries and a place in the ending;
       they just could not be read.

   Split back into the two constants it always was. BLIND_HOLD is the flat part and does
   not move, so both measured endpoints are exactly where they were and the band does not
   shift. UNREAD_MAX is NARR-7's range, and it now runs off every findable page. */
export const BLIND_HOLD = 8
export const UNREAD_MAX = 6
/* NARR-17. Page 7 is the one he wrote at the top, and you get it by getting there —
   which makes it the only page that is not FINDABLE, not beta you can carry up, and not
   part of any count of how much of him you have read. That fact was spelled `7` in nine
   places across three files, and `!== 7` reads as an off-by-one rather than as a design
   statement. NARR-16 was two expressions of "six" drifting apart; this is nine of
   "seven" waiting to. */
export const SUMMIT_PAGE = 7
/* FA-1. The game is named for a first ascensionist and has never let you make
   one. An unclimbed line has no grade, no beta anywhere in the world, and a
   season of dirt on it. */
export const DIRT_GRIP = 2
export const FA_NAMES_A = ['Quiet', 'Long', 'Broken', 'Second', 'Hidden', 'Slow', 'North',
  'Last', 'Thin', 'Cold', 'Old', 'Blind']
export const FA_NAMES_B = ['Line', 'Arete', 'Wall', 'Prow', 'Corner', 'Slab', 'Groove',
  'Crack', 'Face', 'Rib', 'Buttress', 'Nose']
export type Established = {
  name: string; claimed: number; real: number; act: number; burns: number
  // enough to rebuild the line exactly. Stored rather than regenerated,
  // because a line you put up must not change if the generator ever does.
  style?: StyleKey; clear?: number; crux?: number; feet?: FeetKey
  /** NARR-13: which expedition you put it up on, so the cast can come back to
      it a trip LATER with the consensus — a repeat is a thing that takes time.
      Optional: lines from saves made before this shipped simply never mature. */
  run?: number
}
/* FA-1b. A line you established is player-authored content living in the save.
   It is deliberately NOT appended to ROUTES: the act maps address routes by
   index, and appending is exactly what pointed the campaign finale at the
   tutorial boulder in v3.2. Established lines get their own node type and are
   injected into a tier at run time. */
export function specFromEstablished(e: Established): RouteSpec {
  return {
    name: e.name,
    grade: e.real,                 // it climbs at what it is
    shownGrade: e.claimed,         // and reads at what you called it
    style: e.style ?? 'mixed', clear: e.clear ?? 8, crux: e.crux ?? 2,
    feet: e.feet ?? 'normal', established: true,
    note: e.claimed === e.real ? 'Your line. Graded honestly, as it turns out.'
      : e.claimed < e.real ? 'Your line, and stiffer than the grade you gave it.'
      : 'Your line. Softer than you claimed, and everybody knows.',
  }
}
/** The lines you put up in this range, most recent first. */
export const establishedIn = (s: GameState, act: number) =>
  s.established.filter(e => e.act === act)
/** A line nobody has been up. The grade exists — the rock does not care what
    you call it — but it is not shown until you have claimed one. */
/* RUN-10: a first ascent is still unclimbed and unnamed — that is the whole
   point, you name it after — but it has a SHAPE and a character now, per act,
   so no two of them read as the same "An unclimbed line". Every difficulty stat
   (grade, clear, crux, feet) is untouched, and `faRoute` builds off an isolated
   RNG, so this changes what a first ascent feels like, never how hard it is. */
const FA_NOTES: string[][] = [
  [ // forest
    'Nobody has been up this. No chalk, no tick marks, nothing in the book.',
    'Green in the seams and a landing you would not choose. It has been waiting.',
    'You found it looking for somewhere to eat lunch. That is usually how it goes.' ],
  [ // desert
    'Varnish and silence. The desert keeps its lines to itself.',
    'No approach trail, no beta, and the sun already on it. Move.',
    'A tower nobody bothered with, for reasons you are about to learn.' ],
  [ // alpine
    'Rimed up and a long way from the car. This is the real thing.',
    'He never drew it in the margin. Up here, that means something.',
    'Cloud coming and going across it. You get one look at a time.' ],
]
export function faRoute(act: number, rng: RNG): RouteSpec {
  const grade = Math.min(10, 3 + act * 3 + rng.int(3))
  const styles: StyleKey[] = ['mixed', 'slab', 'crimp ladder', 'compression', 'power']
  const feet: FeetKey[] = ['normal', 'hard']
  const style = styles[rng.int(styles.length)]
  const clear = 5 + Math.floor(grade * 0.7) + rng.int(2)
  const feetK = feet[rng.int(feet.length)]
  // the feature it climbs — unnamed, but no longer shapeless
  const feature = style === 'slab' ? 'slab' : style === 'crimp ladder' ? 'wall'
    : style === 'compression' ? 'prow' : style === 'power' ? 'roof' : 'line'
  const notes = FA_NOTES[Math.min(act, FA_NOTES.length - 1)]
  return {
    name: `An unclimbed ${feature}`, grade, style,
    // scales with the grade, as circuitRoute and skirmishRoute already did —
    // this alone did not, so every first ascent was the same length
    clear, crux: 1 + Math.floor(grade / 4),
    feet: feetK, fa: true,
    note: notes[rng.int(notes.length)],
  }
}
/* LOG-2. The book recorded every send and paid nothing back. You remember a
   route you have done — that is what beta is — so a line you have ticked
   starts with some of its sequence already known. */
export const BOOK_BETA_MAX = 2
export const HISTORY_MAX = 20
/* SAVE-6. The write cap on your first ascents. It lived as a bare `.slice(0, 40)` inside
   `claimStep`, so the loader had no way to know what the limit was and did not enforce
   one — two copies of a rule that must agree (ENG-19), one of them invisible. */
export const ESTABLISHED_MAX = 40

/* ============================ THE LINE =============================
   Same rock, more than one way up it. Which one suits you is a question
   about your deck rather than about difficulty.                       */
export type Line = { id: string; name: string; text: string
  dClear?: number; dCrux?: number; dTax?: number }
/* ROUTE-8. The three were a false choice. "The direct" was −2 holds and +3
   cruxes and measured the EASIEST line of the three — 53% against the guide's
   47% and the traverse's 42% — because a shorter climb banks less pump than a
   handful of extra cruxes ever costs, so always taking the direct was strictly
   best (the auto-picker beat always-guide by six points of free completion).
   The lever choice is the whole story: tax is enormous (±1 swung a line ~27
   points — the compounding trap this project has hit five times), grip is
   superlinear and nearly as violent, and crux is almost free. Only hold count
   is a medium lever, and shorter is always easier. So the lines trade TEXTURE,
   not difficulty: the direct stacks four more cruxes at the SAME height, a cruxy
   line that a powerful deck eats and a weak one walls on; the traverse drops two
   cruxes at the same height, the safe way past the hard moves. All three land
   within a few points of the guide for a default deck — none a free win, none a
   trap — with the deck lean underneath. See the balance guard.
   v9.89 (CARD-15): the direct used to keep one fewer hold (`dClear:-1`), which
   was fine against the thin pool but a +7.8 free win once the richer pool could
   answer its extra cruxes — a short line skips endurance, and endurance is what
   the pool bought. Neutralised to `dClear:0` (same height, still +4 cruxes): the
   line's identity is now the cruxes alone, and it lands ~2 under the guide. */
export const LINES: Line[] = [
  { id: 'guide', name: 'As it goes', text: 'The line in the book. No arguments.' },
  /* SIM-8: dCrux 3 -> 2, and the prose with it. This comment says cruxes are "almost free"
     and that the direct "lands ~2 under the guide" — both were true of the deck the band
     used to be measured on, which carried twice the raw Power and could simply pull through
     them. Against the deck the game actually builds (SIM-8), three extra cruxes cost 7.0
     against a floor of 8, and this paragraph's own sentence explains why: "a cruxy line
     that a powerful deck eats and a weak one walls on". Two cruxes restores the INTENDED
     relationship rather than inventing a new one — measured at n=1500, guide 45.1 vs
     direct 43.1, so −2.0, five points clear of either bound.
     NOT via `dClear`: CARD-15 removed the direct's one-fewer-hold for exactly the drift
     this ticket is fixing, and putting it back read +1.2 here. Read the note above. */
  { id: 'direct', name: 'The direct', dClear: 0, dCrux: 2,
    text: 'Straight up it. Same height, but two more cruxes on the way.' },
  { id: 'traverse', name: 'The traverse', dCrux: -3, dClear: 1,
    text: 'Out left and back in, past the worst of it. Three fewer cruxes, but the long way — more holds to work before the top.' },
]
export type RunRecord = {
  seed: number; arch: number; style: number; rope: boolean; circuit: boolean
  act: number; tier: number; won: boolean; cause: string; sends: number; deck: number
  /** META-9: which mutators the trip carried, so a mastery deed can read
      "won with a mutator on" off the record. Optional — old saves lack it. */
  mutators?: string[]
}
export const PROJECT_SKIN = 0     // the price is the node, not your skin
export const RUNOUT_SKIN = 2      // holds of runout per skin lost in a fall
export const FALL_PUMP = 0.5      // pump you keep after being caught
/* BAL-15: a Second Wind buys the GO, not a fresh body. The retry used to start
   on an empty clock — a full extra attempt, carrying the beta you had just
   banked — which measured at +6 points of campaign completion off one cheap
   consumable. That is the "skip" CARD-9's ceiling exists to forbid, and it had
   quietly eaten all the headroom the band had left. You come back on part-pumped
   now, exactly as a caught roped fall does above: chalk up, shake out, tie back
   in — but you have already been fighting. */
/* ENG-21 raised this 0.4 → 0.55 at v10.10 and ENG-32 put it BACK to 0.4 at v10.12.
   The reason both times is the contract rather than the constant. CARD-9 says an extra
   burn is a leg-up, not a skip. ENG-21 made a single burn less reliable, so a retry got
   more valuable and the lift went 2.4 → 4.0 against a ceiling of 4; the item paid for
   it. ENG-32 then made the START of a burn harder — a freshly placed foot gives the
   hands less — and a wind burn is nothing BUT early turns, because it begins
   part-pumped. The two stacked and inverted the contract: the lift measured −1.3, a
   Second Wind actively worth buying against, which is a different failure from the one
   the ceiling guards. ENG-32 now does the work the v10.10 nerf was doing, so the nerf
   comes off rather than being paid twice. It sits at 0.45 rather than either end
   because both ends are coin flips: 0.55 measured a lift of −1.3 (fails the floor) and
   0.4 measured 3.8 against a ceiling of 4 (passes by 0.2 inside a ~2.3 standard error).
   The value is chosen for MARGIN, which is the whole point of GUARD-1. */
export const WIND_PUMP = 0.22   // share of the meter you carry into a wind burn
export type MapNode = { type: NodeType; routeIdx: number }

export type GameState = {
  seed: number; routeIdx: number; deckTier: number; burn: number; skin: number
  /** CARD-9: extra burns bought on this boulder (a Second Wind). Added to the
      attempt cap, reset by startBurn on a fresh line — it never carries over. */
  bonusBurns?: number
  /** BAL-15: the next burn was bought with a Second Wind, so it starts
      part-pumped (WIND_PUMP). Transient — spent by startBurn, never saved. */
  windBurn?: boolean
  /** SAVE-1: this slot exists on disk but could not be read, so the game must
      NOT write over it. Transient — derived at load, never itself saved. */
  saveBlocked?: boolean
  weather: number; rock: number
  beta: string[]; worked: string[]
  holdDeck: Hold[]; feetDeck: Hold[]
  boardH: (Hold | null)[]; boardP: (Card | null)[]
  piles: Piles
  pump: number; flow: number; cleared: number; turn: number
  /* SKIRM-8: 'walked' is the CIRCUIT's walk-off, and it is a distinct result from 'bail'
     because it is the good outcome (RUN-13) rather than giving up on one boulder. Every run
     start sets `result: null`, so this cannot leak into the next attempt the way a mode flag
     could (MODE-1). */
  log: string[]; phase: Phase; result: 'send' | 'fall' | 'bail' | 'walked' | null
  selected: number | null
  customDeck?: Card[]      // harness only — lets the sim sweep synthetic cards
  // --- run state (RUN-1) ---
  inRun: boolean
  runDeck: Card[]
  tier: number
  offers: Card[]
  // --- meta (persists across sessions) ---
  level: number
  xp: number
  owned: string[]
  sends: number
  wins: number
  packCards: Card[]
  skirmish: RouteSpec | null
  afterPack: Phase
  journal: number[]
  eventId: string | null
  eventResult: string | null
  eventsSeen: string[]
  phaseSeen: string
  onProject: boolean
  runout: number
  lastPiece: number
  pitch: number
  cash: number
  psyche: number
  circuit: boolean
  circuitScore: number
  bestCircuit: number
  slot: number
  runSeed: number
  ending: string
  topRope: boolean
  history: RunRecord[]
  /* META-10: the mastery deeds (quiver, hardway) used to read `history`, which
     is capped at 20 and evicts oldest-first — so a deed could tick and later
     un-tick. These are the durable, monotonic records they read instead: the
     set of archetypes that have ever topped the finale, and whether any finale
     win carried a mutator. Optional so old saves migrate (they fall back to
     whatever `history` still holds). */
  archWins?: number[]
  mutatorWin?: boolean
  runs: number
  falls: number
  shopCards: Card[]
  shopGear: string[]
  /** CARD-7: consumables on offer at a post, and the ones you are carrying. */
  shopKit: string[]
  kit: string[]
  bought: string[]
  loadout: string[]
  act: number
  seen: string[]
  talkId: string | null
  talkReply: string | null
  coaching: boolean
  sound: boolean
  /** AUD-2: the sustained beds on their own switch. A drone you cannot turn off
      without losing the effects too is a drone people mute at the OS instead. */
  ambience: boolean
  /** A11Y-4: haptics on their own switch. The buzz used to ride on `sound`, so
      you could not have one without the other. */
  haptics: boolean
  /** A11Y-4: an assist that shows every hold's grip exactly instead of a range.
      Display only — the grip underneath and everything resolve does with it are
      unchanged — so it trades the guessing game for clarity without touching a
      single number. */
  assist: boolean
  cbSafe: boolean
  motion: boolean
  textScale: number
  /** A11Y-5: one-handed reach. Off is the two-handed layout; left/right pin the
      climb's primary controls into a thumb-reachable bottom bar and mirror them
      to that hand. Layout only — it moves no number and gates no rule. */
  reach: 'off' | 'left' | 'right'
  tutorialDone: boolean
  fxLane: string[]
  fxTick: number
  gear: string[]
  boons: string[]
  gearOffers: string[]
  savedBlow: boolean
  /** How close it got. Kept per burn so the screen at the end has something
      to tell you beyond "that is a send". */
  peakPump: number
  /* DAILY-2: two more per-burn readings, so an objective can ask you to climb a
     particular WAY rather than just score. Both are counted where the thing
     actually happens in `resolve` and cleared by `startBurn` alongside `cleared`
     and `peakPump` — they describe this burn, never the career. */
  /** Turns you shook out on. */
  rests: number
  /** Crux holds taken with nothing in the feet lane. */
  cruxFree: number
  /* ENG-21: a no-hands stance is live for the turn the route hands it to you. A
     TRANSIENT — it is set on the local post-move state that resolve and the preview
     both build, never on the state that is stored, so it cannot outlive its turn. */
  stance?: boolean
  /** You just clipped. You are above a bomber piece and you can go for it. */
  clipped: boolean
  bonusUsed: boolean
  line: number
  rerolls: number
  mutators: string[]
  seq: { id: string; left: number } | null
  /** RUN-9. How many upcoming hand-holds you have read off the deck. Counts
      down as they come onto the board, so it always means "the next this-many
      are known". Climb-scoped; costs a card to top up. */
  readAhead: number
  /** ENG-18. The order you placed your cards is the order they resolve in.
      Every cross-lane rule reads the board as it stands, so a hand that has
      already come off is no longer holding anything for the other one. */
  order: number[]
  routeMove: RouteMove | null
  arch: number
  loadouts: string[][]
  reroll: number
  book: Record<string, LogEntry>
  ticked: string[]
  hints: boolean
  /** SKIRM-2: which day you last played, and what you got. */
  dailyDay: string
  /** DAILY-2: which of today's objectives the attempt met, by id. */
  dailyMet: string[]
  /** SOCIAL-2: the challenge being climbed, if this is one. */
  challenge: Challenge | null
  /** DAILY-1: consumables earned from a streak, waiting for your next trip. Kept
      out of `newRun` on purpose — the App hands them over, so the balance harness
      never receives them. */
  larder: string[]
  /** DAILY-1: cosmetic titles earned from the streak ladder. */
  titles: string[]
  /** DAILY-1: the week you last spent your one forgiven miss in. */
  graceWeek: string
  /** SAVE-4: the day you have already STARTED. `dailyDay` cannot do this job —
      bankDaily derives the streak from it being YESTERDAY, so stamping it early
      would reset every streak to 1. */
  dailyTried: string
  dailyScore: number
  dailyBest: number
  dailyStreak: number
  /** SKIRM-3: the weekly ladder — a running total of this week's dailies. */
  weekId: string
  weekScore: number
  weekBest: number
  /* DAILY-3: the season. The weekly ladder reset into a void every seven days —
     nothing accumulated past a week and nothing was ever finished. Four weeks make
     a season with a board and a title at the end of it. */
  seasonId: string
  seasonScore: number
  seasonBest: number
  /** Days climbed this season, for the board. */
  seasonDays: number
  /** This season's four weekly totals, so the board has something to draw. */
  seasonWeeks: number[]
  /* BAL-5. A post used to cost you the stage, and a stage of climbing is worth
     more than anything on the shelf — so a rational player skipped every one,
     which the harness did, which is why posts measured 0.4 a run. Forcing the
     visits cost eight points of completion, proving the skip was correct.
     A trading post is in town, on the drive between areas. It does not cost you
     a day on the rock. Once a stage, so it cannot be farmed. */
  shoppedAt: number[]
  /** EVT-4: which branch you took, as `eventId:index`. A run remembers. */
  eventChose: string[]
  /** INJ-1: something you carry between trips. Never a resource to manage. */
  tweak: Tweak | null
  /** This burn is today's problem. */
  daily: boolean
  /* UX-16. A run is nine stages and the map showed one, so after twenty
     minutes you could not see the shape of the trip you had had — which climbs
     you took, where you rested, what you walked past. One short line per
     stage behind you, in the order you did them. */
  trail: string[]
  /** Which scale grades read in. Both are real; people use both. */
  grades: GradeScale
  established: Established[]
  vanRaided: number[]
  style: number
  styleMax: number
}

/* ====================== CONTENT: ASCENT STYLE ======================
   The difficulty ladder. In climbing, harder is not a bigger number —
   it is better style. Modifiers are CUMULATIVE: style N applies every
   rung up to and including N. Completing a run unlocks the next.     */
export type AscentStyle = {
  name: string; text: string
  dBite: number; dGrip: number; skin: number; attempts: number; camp: number; noBeta: boolean
  /** Flash and above: you cannot work on your deck at a camp. */
  noSharpen?: boolean
}
export const ASCENT: AscentStyle[] = [
  { name: 'Working It', text: 'The line as it comes. Burn until it goes.',
    dBite: 0, dGrip: 0, skin: 0, attempts: 0, camp: 0, noBeta: false },
  { name: 'Second Go', text: 'Everything bites harder.',
    dBite: 1, dGrip: 0, skin: 0, attempts: 0, camp: 0, noBeta: false },
  { name: 'Redpoint', text: 'Less skin to spend on the whole trip.',
    dBite: 0, dGrip: 0, skin: -1, attempts: 0, camp: 0, noBeta: false },
  { name: 'Headpoint', text: 'Two burns a boulder, not three.',
    dBite: 0, dGrip: 0, skin: 0, attempts: -1, camp: 0, noBeta: false },
  { name: 'Flash', text: 'No sharpening at camps. The deck you brought is the deck you have.',
    dBite: 0, dGrip: 0, skin: 0, attempts: 0, camp: -1, noSharpen: true, noBeta: false },
  { name: 'Onsight', text: 'No beta banks between burns. Every burn is the first.',
    dBite: 0, dGrip: 0, skin: 0, attempts: 0, camp: 0, noBeta: true },
  { name: 'Ground Up', text: 'The rock itself is harder, everywhere.',
    dBite: 0, dGrip: 1, skin: 0, attempts: 0, camp: 0, noBeta: false },
]
export function styleMods(level: number): AscentStyle {
  const n = Math.max(0, Math.min(ASCENT.length - 1, level))
  const out: AscentStyle = { name: ASCENT[n].name, text: ASCENT[n].text,
    dBite: 0, dGrip: 0, skin: 0, attempts: 0, camp: 0, noBeta: false, noSharpen: false }
  for (let i = 0; i <= n; i++) {
    out.dBite += ASCENT[i].dBite; out.dGrip += ASCENT[i].dGrip
    out.skin += ASCENT[i].skin; out.attempts += ASCENT[i].attempts
    out.camp += ASCENT[i].camp; out.noBeta = out.noBeta || ASCENT[i].noBeta
    out.noSharpen = out.noSharpen || !!ASCENT[i].noSharpen
  }
  return out
}
export const attemptsFor = (s: GameState) =>
  Math.max(1, ATTEMPTS + (s.inRun
    ? styleMods(s.style).attempts + (archOf(s).dAttempts ?? 0) + mutMods(s.mutators).dAttempts : 0))
  + (s.bonusBurns ?? 0)   // CARD-9: second winds spent on this boulder
export const campSkinFor = (s: GameState) =>
  Math.max(1, CAMP_SKIN + styleMods(s.style).camp)


/* ============================ PERSISTENCE ==========================
   Saved at every safe point. A battle in progress is NEVER saved as
   in-progress: starting a climb writes the "you lost it" state, so
   quitting mid-climb costs you the node instead of rerolling it.    */
type SaveData = {
  v: number; level: number; xp: number; owned: string[]; sends: number; wins: number
  journal: number[]; loadout: string[]; style: number; styleMax: number; seen: string[]
  arch?: number; loadouts?: string[][]; book?: Record<string, LogEntry>; bestCircuit?: number
  ticked?: string[]; established?: Established[]; hints?: boolean; grades?: GradeScale
  tweak?: Tweak | null
  larder?: string[]; titles?: string[]; graceWeek?: string; dailyMet?: string[]
  challenge?: Challenge | null
  dailyDay?: string; dailyTried?: string; dailyScore?: number; dailyBest?: number; dailyStreak?: number
  weekId?: string; weekScore?: number; weekBest?: number
  seasonId?: string; seasonScore?: number; seasonBest?: number
  seasonDays?: number; seasonWeeks?: number[]
  mutators?: string[]
  runs?: number; falls?: number; ending?: string; topRope?: boolean; history?: RunRecord[]
  archWins?: number[]; mutatorWin?: boolean
  coaching?: boolean; sound?: boolean; ambience?: boolean; haptics?: boolean; assist?: boolean; cbSafe?: boolean; tutorialDone?: boolean
  motion?: boolean; textScale?: number; reach?: 'off' | 'left' | 'right'
  run: { deck: string[]; tier: number; skin: number; seed: number; act: number
    gear: string[]; boons: string[]; kit?: string[]; cash: number; psyche: number; runSeed: number
    eventsSeen: string[]
    /* SAVE-4: these are run-scoped and were NOT saved, so a reload reopened the
       trading post and the van (`postOpen`/`vanOpen` read them) — the two things
       the code calls "once a stage" and "once a range" were farmable by reloading
       — and lost the trail, the branch you took at each event, and which line you
       were on. */
    shoppedAt?: number[]; vanRaided?: number[]; trail?: string[]
    eventChose?: string[]; reroll?: number; line?: number } | null
  /* DEV-3: the Circuit sets `inRun: false`, so the `run` block above never
     covered it and NOT ONE LINE of an endless run was ever written down — a
     twenty-line streak was pure memory, gone to a reload or an evicted tab, with
     only `bestCircuit` surviving. It is its own block because it is its own mode:
     no act, no tier, no map. The route is regenerated from the line count rather
     than serialised, the way it was generated in the first place. */
  circuit?: { score: number; deck: string[]; skin: number; psyche: number
    seed: number; runSeed: number; gear: string[]; boons: string[]; kit: string[] } | null
}
const slotKey = (n: number) => `${SAVE_KEY}.${n}`

export function saveGame(s: GameState) {
  try {
    const d: SaveData = {
      v: SAVE_FILE_VERSION, level: s.level, xp: s.xp, owned: s.owned,
      sends: s.sends, wins: s.wins, journal: s.journal, loadout: s.loadout,
      style: s.style, styleMax: s.styleMax, seen: s.seen, coaching: s.coaching, sound: s.sound, ambience: s.ambience, haptics: s.haptics, assist: s.assist, cbSafe: s.cbSafe,
      tutorialDone: s.tutorialDone, motion: s.motion, textScale: s.textScale, reach: s.reach,
      arch: s.arch, loadouts: s.loadouts, book: s.book, bestCircuit: s.bestCircuit, ticked: s.ticked, established: s.established, hints: s.hints, grades: s.grades, tweak: s.tweak,
      larder: s.larder, titles: s.titles, graceWeek: s.graceWeek, dailyMet: s.dailyMet,
      challenge: s.challenge,
      dailyDay: s.dailyDay, dailyTried: s.dailyTried, dailyScore: s.dailyScore, dailyBest: s.dailyBest, dailyStreak: s.dailyStreak,
      weekId: s.weekId, weekScore: s.weekScore, weekBest: s.weekBest,
      seasonId: s.seasonId, seasonScore: s.seasonScore, seasonBest: s.seasonBest,
      seasonDays: s.seasonDays, seasonWeeks: s.seasonWeeks,
      mutators: s.mutators,
      runs: s.runs, falls: s.falls, ending: s.ending, topRope: s.topRope,
      history: s.history.slice(0, HISTORY_MAX), archWins: s.archWins, mutatorWin: s.mutatorWin,
      /* SAVE-2: this used to drop the whole run whenever `tier` ran past the end
         of the act's map — and it always does at a boss, because a boss IS the
         last tier and starting a climb pre-writes tier+1 (the "you abandoned it"
         state). So the on-disk save said "no run in progress" from the moment you
         tapped into any boss, and closing the tab on the screens that follow a
         boss send lost the entire act. The tier is CLAMPED to the map now instead
         of the run being thrown away; you resume on the boss's stage. */
      run: s.inRun
        ? { deck: s.runDeck.map(c => c.name),
            tier: Math.min(s.tier, Math.max(0, ACTS[s.act].length - 1)), skin: s.skin, seed: s.seed,
            act: s.act, gear: s.gear, boons: s.boons, kit: s.kit, cash: s.cash, psyche: s.psyche,
            runSeed: s.runSeed, eventsSeen: s.eventsSeen,
            shoppedAt: s.shoppedAt, vanRaided: s.vanRaided, trail: s.trail,
            eventChose: s.eventChose, reroll: s.reroll, line: s.line }
        : null,
      circuit: s.circuit
        ? { score: s.circuitScore, deck: s.runDeck.map(c => c.name), skin: s.skin,
            psyche: s.psyche, seed: s.seed, runSeed: s.runSeed,
            gear: s.gear, boons: s.boons, kit: s.kit }
        : null,
    }
    localStorage.setItem(slotKey(s.slot), JSON.stringify(d))
    localStorage.setItem(SLOT_KEY, String(s.slot))
  } catch { /* storage blocked — the game still plays, it just forgets */ }
}
export function activeSlot(): number {
  try { return Math.min(SLOTS - 1, Math.max(0, Number(localStorage.getItem(SLOT_KEY) ?? 0))) }
  catch { return 0 }
}
export function slotSummary(n: number): { level: number; cards: number; best: number; run: boolean } | null {
  try {
    const raw = localStorage.getItem(slotKey(n))
    if (!raw) return null
    const d = JSON.parse(raw) as SaveData
    return { level: d.level ?? 1, cards: (d.owned ?? []).length,
      best: d.bestCircuit ?? 0, run: !!d.run }
  } catch { return null }
}
export function wipeSlot(n: number) {
  try { localStorage.removeItem(slotKey(n)) } catch { /* nothing to do */ }
}
/** Save as a paste-able string, so a run can be moved or handed over. */
export function exportSave(s: GameState): string {
  try { return btoa(unescape(encodeURIComponent(localStorage.getItem(slotKey(s.slot)) ?? ''))) }
  catch { return '' }
}
export function importSave(code: string, slot: number): boolean {
  try {
    const json = decodeURIComponent(escape(atob(code.trim())))
    const d = JSON.parse(json) as SaveData
    /* SAVE-5: this validated exactly one field, so `{"level":1}` imported
       cleanly and then bricked levelling for good (xp came through undefined and
       every gainXp produced NaN). Check the shape of what we are about to trust,
       and refuse a save from a build newer than this one rather than storing
       something we would only fail to read back. */
    if (typeof d.level !== 'number' || !isFinite(d.level)) return false
    if (d.xp !== undefined && (typeof d.xp !== 'number' || !isFinite(d.xp))) return false
    if ((d.v ?? 0) > SAVE_FILE_VERSION) return false
    for (const [k, val] of [['owned', d.owned], ['journal', d.journal], ['seen', d.seen],
      ['loadout', d.loadout], ['history', d.history]] as const)
      if (val !== undefined && !Array.isArray(val)) { void k; return false }
    localStorage.setItem(slotKey(slot), json)
    return true
  } catch { return false }
}
/* SAVE-1: `null` means the slot exists but could NOT be read (corrupt, or written
   by a newer build); `{}` means the slot is genuinely empty. They used to be the
   same value, so an unreadable save was indistinguishable from a new game — and
   the app then persisted a fresh game straight over it. The caller must refuse to
   write when this returns null. */
/* SAVE-6. Every array a save carries, clamped to what the game can actually produce.
   SAVE-5 was one unvalidated NUMBER (`xp: undefined` beat freshRun's 0, `gainXp` returned
   NaN and levelling froze for ever) and it was reachable from a one-field import code. The
   arrays were the same shape of hole: `owned`, `history`, `journal`, `established`, `trail`
   and a dozen more were taken at whatever length the file claimed. A crafted save — or an
   import code — carrying 100,000 history records is accepted, written back out, and then
   rendered by the Every Trip screen.
   The caps are DERIVED wherever the game already knows the number, so they cannot drift from
   the thing they bound: you cannot own more cards than exist, or tick more acts than there
   are. Two were literals only the WRITER knew (`established`'s 40, and the larder's none at
   all) and are named constants now, shared by both ends (ENG-19).
   Contents are a separate question and already handled where it matters: `runDeck` filters to
   cards that still exist (SAVE-1) and `challenge` to goals this build has (SOCIAL-2). This is
   about LENGTH. */
const cap = <T,>(v: T[] | undefined, n: number): T[] =>
  Array.isArray(v) ? v.slice(0, n) : []

export function loadGame(slot = 0): Partial<GameState> | null {
  try {
    const raw = localStorage.getItem(slotKey(slot))
    if (!raw) return {}
    const d = JSON.parse(raw) as SaveData
    // Older saves are merged, not discarded — every field has a default, so a
    // version bump fills gaps instead of wiping the player. Only a NEWER save
    // than this build is refused.
    if ((d.v ?? 0) > SAVE_FILE_VERSION) return null   // SAVE-1: written by a newer build — do not overwrite it
    return {
      /* SAVE-5: these two were the ONLY fields here without a default, directly
         under the comment above promising every field has one. Object spread
         copies a key holding `undefined`, so `xp: undefined` beat freshRun's 0,
         `gainXp` then computed NaN, and `while (NaN >= xpToNext(level))` was
         never true — levelling frozen for good and every XP readout NaN. It was
         reachable from a one-field import code, not just a future version bump. */
      level: typeof d.level === 'number' && isFinite(d.level) ? d.level : 1,
      xp: typeof d.xp === 'number' && isFinite(d.xp) ? d.xp : 0,
      owned: cap(d.owned, Object.keys(CARDS).length), sends: d.sends ?? 0, wins: d.wins ?? 0,
      journal: cap(d.journal, JOURNAL.length),
      ...(d.loadout && d.loadout.length === DECK_SIZE ? { loadout: d.loadout } : {}),
      style: d.style ?? 0, styleMax: d.styleMax ?? 0, seen: cap(d.seen, EVENTS.length),
      coaching: d.coaching ?? true, sound: d.sound ?? true, ambience: d.ambience ?? true, haptics: d.haptics ?? true, assist: d.assist ?? false, cbSafe: d.cbSafe ?? false,
      tutorialDone: d.tutorialDone ?? false,
      motion: d.motion ?? true, textScale: d.textScale ?? 0, reach: d.reach ?? 'off',
      arch: d.arch ?? 0,
      ...(d.loadouts && d.loadouts.length === ARCHETYPES.length ? { loadouts: d.loadouts } : {}),
      book: d.book ?? {}, bestCircuit: d.bestCircuit ?? 0, mutators: cap(d.mutators, MUTATORS.length),
      ticked: cap(d.ticked, ACTS.length), established: cap(d.established, ESTABLISHED_MAX), hints: d.hints ?? true,
      grades: d.grades ?? 'v', tweak: d.tweak ?? null,
      larder: cap(d.larder, LARDER_MAX),
      titles: cap(d.titles, STREAK_REWARDS.length + SEASON_TITLES.length), graceWeek: d.graceWeek ?? '',
      dailyMet: cap(d.dailyMet, GOALS_PER_DAY),
      // SOCIAL-2: a code from a newer build could name a goal this one does not have
      challenge: d.challenge && goalById(d.challenge.goal) ? d.challenge : null,
      dailyDay: d.dailyDay ?? '', dailyTried: d.dailyTried ?? '', dailyScore: d.dailyScore ?? 0,
      dailyBest: d.dailyBest ?? 0, dailyStreak: d.dailyStreak ?? 0,
      weekId: d.weekId ?? '', weekScore: d.weekScore ?? 0, weekBest: d.weekBest ?? 0,
      seasonId: d.seasonId ?? '', seasonScore: d.seasonScore ?? 0,
      seasonBest: d.seasonBest ?? 0, seasonDays: d.seasonDays ?? 0,
      seasonWeeks: cap(d.seasonWeeks, SEASON_WEEKS).map(n => Number(n) || 0),
      runs: d.runs ?? 0, falls: d.falls ?? 0, ending: d.ending ?? '',
      topRope: d.topRope ?? true, history: cap(d.history, HISTORY_MAX),
      archWins: cap(d.archWins, ARCHETYPES.length), mutatorWin: d.mutatorWin ?? false,
      ...(d.run ? { inRun: true,
        /* SAVE-1: an unknown card name used to throw out of `spawn` and take the
           WHOLE save with it (the catch below returned an empty object, which the
           app then treated as a new game and persisted over the original). A card
           renamed or removed between versions now costs you that card, not your
           campaign. */
        runDeck: cap(d.run.deck, RUN_DECK_MAX)
          .filter(n => CARDS[n.endsWith('+') ? n.slice(0, -1) : n])
          .map(n => n.endsWith('+') ? upgrade(spawn(n.slice(0, -1))) : spawn(n)),
        tier: d.run.tier,
        skin: d.run.skin, seed: d.run.seed, act: d.run.act ?? 0, gear: cap(d.run.gear, GEAR.length),
        cash: d.run.cash ?? 0, boons: cap(d.run.boons, BOONS.length), kit: cap(d.run.kit, KIT_MAX), psyche: d.run.psyche ?? PSYCHE_MAX,
        runSeed: d.run.runSeed ?? 0, eventsSeen: cap(d.run.eventsSeen, EVENTS.length),
        // SAVE-4: the anti-farm gates and the trip's own record
        shoppedAt: cap(d.run.shoppedAt, MAP_NODES), vanRaided: cap(d.run.vanRaided, MAP_NODES),
        trail: cap(d.run.trail, MAP_NODES), eventChose: cap(d.run.eventChose, MAP_NODES),
        reroll: d.run.reroll ?? 0, line: d.run.line ?? 0 } : {}),
      ...(d.circuit ? (() => {
        const rng = new RNG(d.circuit.seed ?? 1)
        return { circuit: true, circuitScore: d.circuit.score ?? 0,
          runDeck: cap(d.circuit.deck, RUN_DECK_MAX)
            .filter(n => CARDS[n.endsWith('+') ? n.slice(0, -1) : n])
            .map(n => n.endsWith('+') ? upgrade(spawn(n.slice(0, -1))) : spawn(n)),
          skin: d.circuit.skin ?? RUN_SKIN, psyche: d.circuit.psyche ?? PSYCHE_MAX,
          seed: d.circuit.seed ?? 1, runSeed: d.circuit.runSeed ?? 0,
          gear: cap(d.circuit.gear, GEAR.length), boons: cap(d.circuit.boons, BOONS.length),
          kit: cap(d.circuit.kit, KIT_MAX),
          skirmish: circuitRoute(d.circuit.score ?? 0, rng) }
      })() : {}),
    }
  } catch { return null }   // SAVE-1: unreadable, NOT empty — the caller must not overwrite
}

/* ===================== CONTENT: HOLDS + ABILITIES ==================
   Every hold type does something. This is what makes the route an
   opponent rather than a stat block.                                */
type HoldDef = { bite: number; grip: number; ability: string; text: string }

export const HOLD_STATS: Record<string, HoldDef> = {
  'jug':         { bite: 2, grip: 3, ability: 'Rest',       text: 'Answer it and shed 1 pump.' },
  'crimp':       { bite: 3, grip: 5, ability: 'Sharp',      text: 'Blows a card → +1 pump.' },
  'sharp crimp': { bite: 4, grip: 5, ability: 'Razor',      text: 'Blows a card → burn 1 from hand.' },
  'sloper':      { bite: 2, grip: 6, ability: 'Greasy',     text: '−1 Power unless your feet are on.' },
  'pinch':       { bite: 3, grip: 5, ability: 'Squeeze',    text: '+1 Bite while both hands are busy.' },
  'pocket':      { bite: 4, grip: 4, ability: 'Two-finger', text: 'Ignores Support.' },
  'crux':        { bite: 4, grip: 8, ability: 'Committing', text: 'Needs Power 2+. +1 hang tax.' },
}
/* ROUTE-10: the crux's character by style. `label` is what it reads as on the
   board — the line's own defining move — so a crimp crux is "the razor", a slab
   crux "the blank", a power crux "the throw". The resolution is deliberately
   left alone: a crux is a Committing wall (Power 2+, +1 tax) and its Grip is the
   load-bearing difficulty stat, so it must not diverge by style. `dBite` is the
   one lever that could add mechanical character, but every non-zero lean was
   measured to move the pinned completion band hard (a −1 on a common style is
   worth +4-5 points — the sim gains far more from a softer crux than it loses
   to a sharper one), so it is held at 0. The character is in the identity, and
   the band stays where it was pinned. */
export const CRUX_CHAR: Record<StyleKey, { label: string; dBite: number }> = {
  'crimp ladder': { label: 'the razor', dBite: 0 },
  'slab':         { label: 'the blank', dBite: 0 },
  'compression':  { label: 'the squeeze', dBite: 0 },
  'power':        { label: 'the throw', dBite: 0 },
  'mixed':        { label: 'the crux', dBite: 0 },
  'jug haul':     { label: 'the crux', dBite: 0 },
}
/* ROUTE-5. Seven hold types across thirty-one routes meant every crimp
   behaved like every other crimp, and a route was remembered as a stat line.
   A signature hold is one named feature per line — the thing you tell somebody
   about afterwards. It behaves as its base type with the numbers moved. */
export type Signature = {
  id: string; name: string; note: string; base: string
  dGrip?: number; dBite?: number; ability?: string
  /* ROUTE-12: working it the first time reads this many holds off the wall —
     the sequence you suss from that one good stance. Information, not power:
     it moves readAhead only, which resolution never reads, so it is band-safe. */
  read?: number
  /* ROUTE-15: this feature belongs to the line it was written for and is never
     tagged onto a generated one, because its NOTE names a specific place or a
     specific moment — "you start from the floor" is a start, not a hold you meet
     halfway up somebody else's circuit. The rest of the pool is written loosely
     enough to land anywhere, which is why they are shared. */
  local?: boolean
}
export const SIGNATURES: Signature[] = [
  /* ROUTE-15: the first four lines in the book had no named feature, which is the sameness
     ROUTE-5 set out to kill — you meet them before you meet anything else. STAT-LESS on
     purpose: they are TAGGED onto a hold that is already there rather than replacing one
     (see the tagger in buildRoute), so a dGrip here would move a number on the four routes
     a new player meets first, and nothing reads a signature's dGrip outside `placeSig`
     anyway. What they DO is ROUTE-12's answer to what a signature is for: `read`. It is
     information, which is free — the resolution never consults readAhead — and on the four
     earliest lines in the book it is the mechanic teaching itself, at the point where you
     have the fewest cards that can do it. The notes deliberately do not name a hold type,
     because the tag lands on whatever the line actually rolled — and for the same reason
     they do not name a POSITION either. The holds are shuffled, so a note that says "you
     start from the floor" reads wrong four moves up; that was the first draft of The
     Sit-Down and the render is what caught it. The line is called The Sit Start; the
     feature only has to be a hold on it. */
  { id: 'therail', local: true, name: 'The Rail', base: 'jug', read: 1,
    note: 'Polished pale. Forty years of people warming up on the same hold.' },
  { id: 'thesitdown', local: true, name: 'The Sit-Down', base: 'jug', read: 1,
    note: 'Big enough for two hands and a breather. Everybody uses it. Nobody rushes it.' },
  { id: 'thegreen', local: true, name: 'The Green Patch', base: 'sloper', read: 1,
    note: 'Damp nine months of the year. Brush it and it is back by spring.' },
  { id: 'theflake', local: true, name: 'The Flake', base: 'crimp', read: 1,
    note: 'It was bigger last season. Nobody has written that down.' },
  { id: 'rattler', name: 'The Rattler', base: 'crimp', dBite: 2, ability: 'Sharp', read: 1,
    note: 'A flake the size of a dinner plate. It moves when you pull on it.' },
  { id: 'twofinger', name: 'The Two-Finger Pocket', base: 'pocket', dGrip: 1, read: 2,
    note: 'Two fingers fit. A third would have made this a different climb.' },
  { id: 'wetjug', name: 'The Wet Jug', base: 'jug', dGrip: 2, ability: 'Greasy', read: 1,
    note: 'It seeps. It has always seeped. Everyone knows and nobody mentions it.' },
  { id: 'thankgod', name: 'The Thank God Hold', base: 'jug', dGrip: -2, read: 3,
    note: 'You do not know it is there until your hand is already on it. A place to breathe and look up.' },
  { id: 'guillotine', name: 'The Guillotine', base: 'sharp crimp', dBite: 1, read: 1,
    note: 'A horizontal edge with an edge. People tape up for this one move.' },
  { id: 'organpipe', name: 'The Organ Pipe', base: 'pinch', dGrip: 2, ability: 'Squeeze', read: 2,
    note: 'A fin you can get both hands round and no way to weight your feet.' },
  { id: 'deathblock', name: 'The Death Block', base: 'sloper', dGrip: 3, read: 2,
    note: 'Enormous, rounded, and entirely without features. It goes on for a while — long enough to see what is next.' },
  { id: 'letterbox', name: 'The Letterbox', base: 'pocket', dBite: -1, ability: 'Two-finger', read: 2,
    note: 'A slot you post a hand into and hope to get back.' },
  { id: 'sidewinder', name: 'The Sidewinder', base: 'crimp', dGrip: 2, read: 1,
    note: 'Good, if you are standing somewhere you cannot stand.' },
  { id: 'lastjug', name: 'The Last Jug', base: 'jug', dGrip: -1, ability: 'Rest', read: 2,
    note: 'The last thing on the route that is kind to you.' },
  { id: 'bellows', name: 'The Bellows', base: 'pinch', dBite: 1, dGrip: -1, read: 1,
    note: 'A slot the wind comes up through. Cold hands, and you can hear it coming.' },
  /* ROUTE-13: the rest of the guidebook's named features, so a route reads as a
     place rather than a stat block. A signature REPLACES an ordinary hold, so a
     mild one makes a route EASIER — which is why the first pass measured +3 and
     these are pitched hard (dGrip 2–3, inside the range `deathblock` already
     demonstrated). Every one pays a read, which is band-free (ROUTE-12).
     This could only ship once BAL-15 opened the CARD-9 headroom: a distinctive
     hold is exactly what a bought extra burn beats on the retry, so at the old
     +6 Second-Wind lift the whole set pushed the kit run to 62% against a 58%
     ceiling. See the balance guard. */
  { id: 'thetick', name: 'The Tick', base: 'sharp crimp', dGrip: 2, ability: 'Sharp', read: 1,
    note: 'A crimp the size of a tick, and it bites about as clean as one.' },
  { id: 'thenave', name: 'The Nave', base: 'crimp', dGrip: 3, read: 2,
    note: 'Forty feet sideways, and the good hold is always one move further on.' },
  { id: 'softtouch', name: 'The Soft Touch', base: 'crimp', dGrip: 3, read: 2,
    note: 'It reads like a jug in the book. It has never once been a jug.' },
  { id: 'thesecond', name: 'The Second Guess', base: 'crimp', dGrip: 3, read: 1,
    note: 'You commit, then you do not, and by then the crimp has decided for you.' },
  { id: 'gooseneck', name: 'The Gooseneck', base: 'pinch', dGrip: 3, read: 1,
    note: 'A neck of sandstone you pinch and hope it keeps its head on.' },
  { id: 'blackglass', name: 'The Black Glass', base: 'crimp', dGrip: 2, ability: 'Greasy', read: 1,
    note: 'Desert varnish, black and bright. It holds like glass, right up until it does not.' },
  { id: 'therattle', name: 'The Rattle', base: 'sloper', dGrip: 3, read: 1,
    note: 'You hear it before the move. Knowing does not make the move any easier.' },
  { id: 'thekiln', name: 'The Kiln Pocket', base: 'pocket', dGrip: 3, read: 1,
    note: 'A hundred and ten in the shade, no shade, and the pocket hotter than either.' },
  { id: 'furnace', name: 'The Furnace', base: 'jug', dGrip: 2, ability: 'Greasy', read: 1,
    note: 'South-facing and warm past midnight; the one good hold sweats you off it.' },
  { id: 'squeezechim', name: 'The Squeeze', base: 'pinch', dGrip: 2, ability: 'Squeeze', read: 2,
    note: 'You do not climb it so much as refuse, for a while, to fall out of it.' },
  { id: 'themirage', name: 'The Mirage', base: 'sloper', dGrip: 3, read: 1,
    note: 'Nothing to hold, and the sun straight in your eyes for the one hard move.' },
  { id: 'thespit', name: 'The Spit', base: 'pocket', dGrip: 2, dBite: 1, read: 1,
    note: 'It turns you slowly over the drop while you work out where the pocket went.' },
  { id: 'thenotch', name: 'The Notch', base: 'pinch', dGrip: 3, read: 1,
    note: 'A slot in the arete, and the weather turning over while you read it.' },
  { id: 'numbcrimp', name: 'The Numb Crimp', base: 'crimp', dGrip: 2, ability: 'Sharp', read: 1,
    note: 'Your fingers stop reporting back somewhere around this one.' },
  { id: 'thewhiteout', name: 'The Whiteout', base: 'sloper', dGrip: 3, read: 1,
    note: 'Nothing to see and nothing to hold. Stand up on it anyway.' },
  { id: 'thenose', name: 'The Nose', base: 'crimp', dGrip: 3, read: 2,
    note: 'The pitch people come for, and the hard move exactly where you are most tired.' },
  { id: 'thecoffin', name: 'The Coffin', base: 'pinch', dGrip: 2, ability: 'Squeeze', read: 2,
    note: 'Off-width the whole way. Bring the big gear and bring your dignity.' },
  { id: 'theboard', name: 'The Board', base: 'sloper', dGrip: 3, read: 2,
    note: 'A flat plank of rock over the cirque. The mantel, then the rumour of a landing.' },
  { id: 'thecornice', name: 'The Cornice', base: 'sloper', dGrip: 3, read: 1,
    note: 'Nobody has decided if it is still attached. You find out by weighting it.' },
  { id: 'thehang', name: 'The Hanging Foot', base: 'sloper', dGrip: 3, read: 1,
    note: 'Slab, on a rope, over nothing. The feet are the whole climb here.' },
]
/* ROUTE-12: which signatures may be TAGGED onto a generated line (circuit,
   skirmish, daily, first ascents) without moving its balance. The tag is
   name + note + the read hook only — the grip/bite nudge is NOT applied and the
   ability must be empty, so a tagged hold resolves exactly as the plain hold it
   already was. So: the ability-less signatures, matched to a hold of their own
   base type so the note still fits what is under your hand. */
export const GEN_SIG_IDS = SIGNATURES.filter(s => !s.ability && !s.local).map(s => s.id)
export const sigById = (id: string) => SIGNATURES.find(x => x.id === id)

export const FEET_STATS: Record<string, HoldDef> = {
  'foothold':   { bite: 2, grip: 2, ability: '',           text: '' },
  'smear edge': { bite: 2, grip: 3, ability: 'Slick',      text: '−1 Power against it.' },
  'chip':       { bite: 3, grip: 3, ability: 'Sharp',      text: 'Blows a card → +1 pump.' },
  'blank':      { bite: 2, grip: 4, ability: 'Featureless', text: 'This lane grants no Support.' },
}

const FEET_POOLS: Record<FeetKey, Record<string, number>> = {
  easy: { 'foothold': 5, 'smear edge': 3, 'chip': 1, 'blank': 1 },
  normal: { 'foothold': 1, 'smear edge': 1, 'chip': 1, 'blank': 1 },
  hard: { 'foothold': 1, 'smear edge': 2, 'chip': 3, 'blank': 5 },
}
const STYLES: Record<StyleKey, { w: Record<string, number>; dgrip: number; dbite: number }> = {
  'jug haul': { w: { 'jug': 8, 'crimp': 1, 'sloper': 1 }, dgrip: 0, dbite: 0 },
  'mixed': { w: { 'jug': 3, 'crimp': 3, 'sloper': 3, 'pinch': 2, 'pocket': 2 }, dgrip: 0, dbite: 0 },
  'slab': { w: { 'sloper': 5, 'crimp': 4, 'jug': 2 }, dgrip: 0, dbite: -1 },
  'crimp ladder': { w: { 'crimp': 5, 'sharp crimp': 4, 'jug': 1 }, dgrip: 0, dbite: 1 },
  'compression': { w: { 'sloper': 6, 'pinch': 4, 'jug': 1 }, dgrip: 1, dbite: -1 },
  'power': { w: { 'pocket': 4, 'sharp crimp': 4, 'pinch': 3, 'crimp': 2 }, dgrip: 1, dbite: 1 },
}

/* ======================= CONTENT: CONDITIONS ======================= */
export type Weather = {
  /** Wet rock: what your feet are worth, which every deck feels. */
  dSupport?: number
  name: string; text: string; dBite: number; dContact: number; sloperGrip: number
}
// NOTE: conditions must never touch Power globally. 1 Power ≈ 4 Contact, so a
// flat ±1 Power swung these routes from 29% to 98%. Bite and Contact only.
export const WEATHER: Weather[] = [
  { name: 'crisp', text: 'Cold and dry. Rubber sticks.', dBite: -1, dContact: 0, sloperGrip: 0 },
  { name: 'still', text: 'Nothing doing. Fine conditions.', dBite: 0, dContact: 0, sloperGrip: 0 },
  { name: 'humid', text: 'Greasy. Nothing feels attached.', dBite: 0, dContact: -1, sloperGrip: 2 },
  { name: 'hot sun', text: 'Baking. The holds fight back.', dBite: 1, dContact: 0, sloperGrip: 0 },
  { name: 'freezing', text: 'Great friction, and no feeling in your fingers at all.',
    dBite: -1, dContact: -3, sloperGrip: 0 },
  { name: 'drizzle', text: 'Seeping. Slopers are off and your feet are going nowhere.',
    dBite: 0, dContact: 0, sloperGrip: 3, dSupport: -1 },
]
export type Rock = {
  name: string; text: string; boost: Record<string, number>
  grip: Record<string, number>; bite: Record<string, number>
}
export const ROCK: Rock[] = [
  { name: 'granite', text: 'Edges and cracks. Positive but sharp.',
    boost: { 'crimp': 2 }, grip: { 'crimp': 1 }, bite: {} },
  { name: 'sandstone', text: 'Soft, friable, brutal on skin.',
    boost: {}, grip: { 'crimp': -1, 'sloper': -1, 'pinch': -1, 'pocket': -1 }, bite: { 'crimp': 1, 'sharp crimp': 1 } },
  { name: 'limestone', text: 'Pockets and tufas.',
    boost: { 'pocket': 3 }, grip: {}, bite: { 'pocket': 1 } },
  { name: 'gneiss', text: 'Rounded and blank. Body tension.',
    boost: { 'sloper': 2 }, grip: { 'sloper': 1 }, bite: {} },
  { name: 'basalt', text: 'Columns. Pinch it or fall.',
    boost: { 'pinch': 3 }, grip: {}, bite: { 'pinch': 1 } },
]

/* ========================= CONTENT: ROUTES ========================= */
/** Scripted behaviour partway up a boss. `at` is a fraction of the top-out. */
export type BossPhase = {
  at: number; name: string; text: string
  allCrux?: boolean; dBite?: number; dTax?: number; lockLane?: number; noRest?: boolean
}
/* ROUTE-6. The weather window — ENG-20 measured conditions as the largest lever
   in the game (46 points crisp→hot) and VIS-3 put them on the paper, but they
   were fixed for a whole climb — a still morning stayed a still morning to the
   top. On the alpine wall and the finale the window closes partway up: cloud
   comes over, the wind gets under everything and your feet stop trusting the
   rock. It is telegraphed a hold ahead like a phase, so it is a decision rather
   than an ambush, and — like every condition in this game — it may move Bite
   and Support but NEVER Power (the absolute rule from ENG-20). `dBite` sharpens
   the whole route; `dSupport` is the feet going, which every deck feels. */
export type WeatherWindow = {
  at: number; dBite?: number; dSupport?: number
  /** Shown a hold before it lands. */ warn: string
  /** Shown when it arrives. */ text: string
}
export type RouteSpec = {
  name: string; grade: number; style: StyleKey
  clear: number; crux: number; feet: FeetKey; note: string; finale?: boolean
  phases?: BossPhase[]
  /** SKIRM-5: a flat Bite on every hold of this line. The Circuit's grade caps
      at 10 by line ~15, so past the cap "Into the Dark" was mechanically frozen
      — pure skin attrition with no new teeth. This is the lever that keeps
      escalating past the cap, as a deterministic function of the line count.
      Only the Circuit sets it; every scripted route leaves it undefined. */
  dBite?: number
  /** ROUTE-6: the conditions turn partway up. */
  window?: WeatherWindow
  roped?: boolean; pitches?: number
  /** An unclimbed line: no grade shown, dirty holds, yours to name. */
  fa?: boolean
  /** The one feature on this line that people talk about. Placed by REPLACING a hold, so
      it carries its own stats and is band-active. */
  signature?: string
  /** ROUTE-15: a named feature TAGGED onto a hold the line already has — same numbers, only
      a name, a note and a read hook. Band-neutral by construction, which is the whole reason
      it is a separate field from `signature` rather than a flag on it. */
  sigTag?: string
  /** A line you put up. Reads at the grade you claimed, climbs at the real one. */
  established?: boolean; shownGrade?: number
  /** An authored hold sequence. Only the tutorial uses this — everything
      else is generated from the style weights. */
  holds?: string[]; tutorial?: boolean
}
/** What is coming, and how many holds away — so a phase is a decision
    rather than an ambush. */
export function nextPhase(s: GameState): { p: BossPhase; away: number } | null {
  const spec = specOf(s)
  if (!spec.phases || !spec.phases.length) return null
  const f = spec.clear ? s.cleared / spec.clear : 0
  const nxt = spec.phases.find(p => f < p.at)
  if (!nxt) return null
  return { p: nxt, away: Math.max(1, Math.ceil(nxt.at * spec.clear) - s.cleared) }
}
export const phaseSummary = (spec: RouteSpec) =>
  (spec.phases ?? []).map(p => `${Math.round(p.at * 100)}% ${p.name}`).join(' · ')

/** The phase you are in: the deepest threshold you have passed. */
export function phaseOf(s: GameState): BossPhase | null {
  const spec = specOf(s)
  if (!spec.phases) return null
  const f = spec.clear ? s.cleared / spec.clear : 0
  let out: BossPhase | null = null
  for (const p of spec.phases) if (f >= p.at) out = p
  return out
}

/* ROUTE-6. The window is read off the height you START the turn at, exactly as
   phaseOf is, so resolve and the preview agree — both call these before any
   hold clears this turn. Its Bite lands in biteAgainst and its Support in
   powerAgainst, which the preview already routes through, so it is exact for
   free. */
export function windowOf(s: GameState): WeatherWindow | null {
  const spec = specOf(s)
  const w = spec.window
  if (!w) return null
  const f = spec.clear ? s.cleared / spec.clear : 0
  return f >= w.at ? w : null
}
/** What the sky is about to do, and how many holds away — so it is a decision. */
export function windowNear(s: GameState): { w: WeatherWindow; away: number } | null {
  const spec = specOf(s)
  const w = spec.window
  if (!w) return null
  const f = spec.clear ? s.cleared / spec.clear : 0
  if (f >= w.at) return null
  return { w, away: Math.max(1, Math.ceil(w.at * spec.clear) - s.cleared) }
}
/* DES-4. Everything read in V-scale, which is one of the two scales people
   actually use. Font is the other, and the game is fussy enough about real
   hold types and real ethics that it should not be parochial about grades. */
export type GradeScale = 'v' | 'font'
export const FONT = ['4', '5', '5+', '6A', '6B', '6C', '7A', '7A+', '7B',
  '7C', '7C+', '8A', '8A+', '8B', '8B+', '8C', '8C+', '9A']
export const fontOf = (g: number) => FONT[Math.max(0, Math.min(FONT.length - 1, g))]
export const gradeText = (g: number, scale: GradeScale = 'v') =>
  scale === 'font' ? fontOf(g) : 'V' + g
// nobody has graded an unclimbed line, so nobody can tell you what it is
export const gradeLabel = (r: RouteSpec, scale: GradeScale = 'v') =>
  (r.finale || r.fa) ? '?' : gradeText(r.shownGrade ?? r.grade, scale)
export const ROUTES: RouteSpec[] = [
  { name: 'Warm-Up Rail', grade: 0, style: 'jug haul', clear: 5, crux: 0, feet: 'easy',
    note: 'Everyone starts here. Nobody writes it in the book.', sigTag: 'therail' },
  { name: 'The Sit Start', grade: 1, style: 'mixed', clear: 6, crux: 0, feet: 'normal',
    note: 'Two moves off the ground and already honest.', sigTag: 'thesitdown' },
  { name: 'Mossback', grade: 1, style: 'slab', clear: 6, crux: 1, feet: 'hard',
    note: 'No handholds worth the name. Just faith and rubber.', sigTag: 'thegreen' },
  { name: 'Chossmaster', grade: 2, style: 'mixed', clear: 7, crux: 1, feet: 'normal',
    signature: 'rattler',
    note: 'Half of it came off in my hand. The half that stayed was good.' },
  { name: 'Peeler', grade: 2, style: 'crimp ladder', clear: 7, crux: 1, feet: 'normal',
    note: 'Named for what it does to you, not for what it looks like.', sigTag: 'theflake' },
  { name: 'The Fridge', grade: 3, style: 'compression', clear: 9, crux: 1, feet: 'normal',
    signature: 'deathblock',
    note: "You don't hold the fridge. You hug it and hope." },
  { name: 'Deer Tick', signature: 'thetick', grade: 3, style: 'power', clear: 8, crux: 2, feet: 'easy',
    note: 'Small, mean, and it gets under your skin.' },
  { name: 'Cathedral Traverse', signature: 'thenave', grade: 4, style: 'mixed', clear: 10, crux: 2, feet: 'normal',
    note: 'Forty feet sideways. The forearms go long before the moves do.' },
  { name: 'Wasp Nest', grade: 4, style: 'power', clear: 9, crux: 3, feet: 'easy',
    signature: 'letterbox',
    note: 'Three hard moves. Every one of them wants you off.' },
  { name: 'The Priest', grade: 5, style: 'compression', clear: 10, crux: 3, feet: 'hard',
    signature: 'guillotine',
    note: "His chalk is still in the crack. Thirty years and nobody's touched it.",
    /* BAL-13 (v9.88): the two early bosses were single-phase — a slightly harder
       route, not a fight with an arc like the act-3 bosses. The Priest now
       kicks into a second phase near the top: the guillotine crack narrows to
       one hand while the clock keeps running (dTax carried, lockLane added), so
       the last three holds are a real closing crux. dTax/lockLane, never dBite —
       the Summit Block ledger proved added Bite on a crit path charges the
       Alpinist (−2 Contact) and Comp Kid (a burn) twice. */
    phases: [{ at: 0.65, name: 'The Headwall', dTax: 1,
      text: 'It steepens and does not stop. The clock runs faster from here.' },
      { at: 0.85, name: 'The Guillotine', dTax: 1, lockLane: 1,
        text: 'The crack narrows to a blade. One hand above it — and the clock still running.' }] },

  { name: 'The Sandbag', signature: 'softtouch', grade: 3, style: 'crimp ladder', clear: 11, crux: 2, feet: 'normal',
    note: 'Given V2 by a man who never did it. It has never been V2.' },

  // ---------------- ACT 2 · desert towers ----------------
  { name: 'The Gooseneck', signature: 'gooseneck', grade: 5, style: 'mixed', clear: 10, crux: 1, feet: 'normal',
    note: 'Sandstone that eats skin and gives nothing back.' },
  { name: 'Varnish', signature: 'blackglass', grade: 5, style: 'crimp ladder', clear: 10, crux: 1, feet: 'normal',
    note: 'Black desert varnish, holds like glass until it is not.' },
  { name: 'Sun Dagger', grade: 6, style: 'power', clear: 10, crux: 1, feet: 'easy',
    signature: 'twofinger',
    note: 'Shade for forty minutes a day. Miss it and you cook.' },
  { name: 'The Chimney', grade: 6, style: 'compression', clear: 11, crux: 1, feet: 'normal',
    signature: 'organpipe',
    note: 'You do not climb it so much as fight your way up the inside.' },
  { name: 'Rattlesnake Arete', signature: 'therattle', grade: 6, style: 'slab', clear: 10, crux: 1, feet: 'hard',
    note: 'Check the base before you drop the pads. Every time.' },
  { name: 'Kiln', signature: 'thekiln', grade: 7, style: 'power', clear: 11, crux: 2, feet: 'easy',
    note: 'A hundred and ten in the shade and there is no shade.' },
  { name: 'The Hourglass', grade: 7, style: 'mixed', clear: 12, crux: 2, feet: 'normal',
    signature: 'sidewinder',
    note: 'Two towers welded at the waist. He drew it in the margin twice.',
    /* BAL-13 (v9.88): a second phase above the waist. The pinch opens into the
       upper tower, both hands back — but it kicks back and the clock runs
       faster to the top (dTax). A distinct late constraint, reached tired,
       rather than the waist's lane-lock all the way up. */
    phases: [{ at: 0.5, name: 'The Waist', lockLane: 1,
      text: 'The tower pinches in. There is nothing out right — left hand only.' },
      { at: 0.8, name: 'The Upper Tower', dTax: 1, lockLane: 1,
        text: 'Past the waist it kicks back — still nothing out right, and the clock running.' }] },

  { name: 'Furnace Arete', signature: 'furnace', grade: 6, style: 'power', clear: 13, crux: 2, feet: 'easy',
    note: 'South facing, no shade, and the rock stays warm past midnight.' },

  // ---------------- ACT 3 · the alpine wall ----------------
  { name: 'The Notch', signature: 'thenotch', grade: 7, style: 'slab', clear: 11, crux: 3, feet: 'hard',
    note: 'Granite, altitude, and weather that turns in twenty minutes.' },
  { name: 'Cold Shoulder', signature: 'numbcrimp', grade: 8, style: 'crimp ladder', clear: 12, crux: 3, feet: 'normal',
    note: 'Your fingers stop reporting back somewhere around the third move.' },
  { name: 'Icebox Corner', grade: 8, style: 'compression', clear: 12, crux: 3, feet: 'normal',
    signature: 'wetjug',
    note: 'North facing. Never dries. Perfect friction, no feeling.' },
  { name: 'Whiteout Slab', signature: 'thewhiteout', grade: 8, style: 'slab', clear: 12, crux: 3, feet: 'hard',
    note: 'Nothing to hold. Nothing to see. Stand up on it anyway.' },
  { name: 'The Nose Direct', signature: 'thenose', grade: 7, style: 'mixed', clear: 12, crux: 3, feet: 'normal',
    roped: true, pitches: 3,
    note: 'Three pitches, and the second one is why people come.' },
  { name: 'Coffin Crack', signature: 'thecoffin', grade: 8, style: 'compression', clear: 12, crux: 3, feet: 'normal',
    roped: true, pitches: 3,
    note: 'Off-width the whole way. Bring the big gear and your dignity.' },
  { name: 'The Diving Board', signature: 'theboard', grade: 9, style: 'power', clear: 12, crux: 3, feet: 'easy',
    note: 'Sticks out over the cirque. The landing is a rumour.' },
  { name: 'Bergschrund', grade: 9, style: 'mixed', clear: 13, crux: 3, feet: 'normal',
    signature: 'thankgod',
    note: 'The gap between the wall and everything that used to hold it up.' },
  { name: 'Summit Block', grade: 9, style: 'compression', clear: 13, crux: 4, feet: 'hard',
    signature: 'lastjug',
    note: 'Last thing between you and the drainage he wrote about.',
    // ROUTE-7: the alpine act is the weather act. Summit Block's signature is
    // the gale that funnels over the roof — the same difficulty as before (the
    // Roof's +1 Bite, then no rest over the lip), reflavoured as weather so it
    // reads as a sibling of the finale's — but NOT a persistent ROUTE-6
    // window: BAL-13 proved that any added Bite on the act-3 critical path
    // charges the Comp Kid (one less burn) and the Alpinist (-2 Contact) twice,
    // and a window that reaches the top does exactly that. Measured: it dropped
    // the Comp Kid to 5.0 against a floor of 5. So the mechanic stays on the
    // finale, which few runs reach, and this boss keeps its numbers.
    phases: [
      { at: 0.45, name: 'The Gale', dBite: 1,
        text: 'The wind funnels over the roof. Everything bites harder in it.' },
      { at: 0.8, name: 'The Lip', noRest: true, text: 'Over the lip. Nowhere left to shake out.' }] },

  { name: 'The Cornice', signature: 'thecornice', grade: 8, style: 'slab', clear: 14, crux: 3, feet: 'hard',
    roped: true, pitches: 2,
    note: 'Nobody knows if it is attached. That is most of the difficulty.' },

  // ---------------- THE FINALE ----------------
  { name: 'The Lost Line', grade: 10, style: 'compression', clear: 15, crux: 6, feet: 'hard',
    finale: true,
    note: 'No chalk. No tick marks. No trail. Exactly as he left it.',
    // ROUTE-6: the nine-day window the journal keeps circling. It holds while
    // you climb the lower wall and shuts on the headwall — cloud over, the wind
    // gets under everything, feet off. Bite and Support only; never Power.
    window: { at: 0.65, dBite: 1, dSupport: -1,
      warn: 'The light is going flat. Weather is coming in.',
      text: 'The window shuts. Wind on the wall and nothing under your feet.' },
    phases: [
      { at: 0.35, name: 'The Traverse', dTax: 1,
        text: 'Forty feet sideways with nothing under you. The clock runs faster here.' },
      { at: 0.6, name: 'The Crux Sequence', allCrux: true,
        text: 'The move he drew four times in the margin. Every hold is committing now.' },
      { at: 0.85, name: 'The Headwall', noRest: true,
        text: 'The last of it. Nowhere left to shake out.' }] },

  // Appended last on purpose. Inserting a route mid-table shifts every index
  // after it — which silently pointed the campaign finale at this boulder.
  /* NARR-10, appended out of place on purpose: inserting into the act 2 block
     above would shift every index in acts 2 and 3. Desert towers, indices 31-33. */
  { name: 'The Blowhole', grade: 6, style: 'compression', clear: 11, crux: 2, feet: 'normal',
    signature: 'bellows',
    note: 'The wind comes up through it about four. You want to be off by then.' },
  { name: 'Squeeze Chimney', signature: 'squeezechim', grade: 5, style: 'mixed', clear: 12, crux: 1, feet: 'hard',
    note: 'Nobody has ever enjoyed this. It goes in the book anyway.' },
  { name: 'Sunstroke Slab', signature: 'themirage', grade: 7, style: 'slab', clear: 10, crux: 2, feet: 'hard',
    note: 'No shade, no holds, no hurry. Two of those are a problem.' },
  { name: 'The Warm-Up Boulder', grade: 0, style: 'jug haul', clear: 12, crux: 0, feet: 'easy',
    tutorial: true,
    holds: ['jug', 'jug', 'jug', 'sloper', 'crimp', 'crimp', 'pinch', 'pinch',
      'sharp crimp', 'crux', 'jug', 'jug'],
    note: 'Ten minutes from the car. Everybody starts here.' },
  /* RUN-10: a second project per act, so the two project nodes are no longer the
     same boulder twice. Each is a stat-for-stat sibling of its act's other
     project (same grade/clear/crux/style/feet) — a different line at the same
     difficulty, so it reads new on the map and generates its own holds off its
     own index, while the completion band does not move. Indices 34-36. */
  { name: 'The Second Guess', signature: 'thesecond', grade: 3, style: 'crimp ladder', clear: 11, crux: 2, feet: 'normal',
    note: 'The line beside The Sandbag. Same man, same optimistic grade in the book.' },
  { name: 'The Rotisserie', signature: 'thespit', grade: 6, style: 'power', clear: 13, crux: 2, feet: 'easy',
    note: 'South-facing, like the Arete next door, and somehow hotter. Bring water.' },
  { name: 'The Hanging Slab', signature: 'thehang', grade: 8, style: 'slab', clear: 14, crux: 3, feet: 'hard',
    roped: true, pitches: 2,
    note: 'Two pitches of slab under a band of ice that lets go in the afternoon.' },
]

/* ========================== CONTENT: CARDS ========================= */
type CardDef = Partial<Card> & { name: string }
const mv = (name: string, power: number, contact: number, rarity: Rarity, o: Partial<Card> = {}): CardDef =>
  ({ name, kind: 'move', power, contact, lane: 'hand', rarity, ...o })
const ft = (name: string, power: number, contact: number, rarity: Rarity, o: Partial<Card> = {}): CardDef =>
  ({ name, kind: 'move', power, contact, lane: 'feet', rarity, ...o })
export const rest = (name: string, contact: number, shed: number, rarity: Rarity, o: Partial<Card> = {}): CardDef =>
  ({ name, kind: 'move', power: 0, contact, lane: 'any', shed, anchor: true, rarity, ...o })
const bn = (name: string, cost: number, rarity: Rarity, o: Partial<Card> = {}): CardDef =>
  ({ name, kind: 'bonus', cost, rarity, ...o })

/* Costed to the measured law: budget ~ 2*Power + Contact.
   starter/common 10-13 · uncommon 13-16 · rare 15-19. */
export const CARDS: Record<string, CardDef> = {}
for (const c of [
  // ---------- STARTER ----------
  mv('Crimp Grip', 2, 5, 'starter', { fx: 'precise', text: 'Precise · +2 Power vs crimps.' }),
  mv('Open Hand', 2, 7, 'starter', { fx: 'friction', text: 'Friction · ignores Greasy.' }),
  mv('Lock Off', 3, 6, 'starter', { fx: 'static', text: 'Static · takes 1 less Bite.' }),
  ft('Smear', 1, 6, 'starter', { support: 1, text: 'Support 1.' }),
  rest('Shake Out', 6, 3, 'starter', { text: 'Rest · shed 3. Anchor.' }),
  rest('Kneebar', 7, 2, 'starter', { text: 'Rest · shed 2. Anchor.' }),
  bn('Chalk Up', 1, 'starter', { power: 2, targeted: true, text: '+2 Power to one lane.' }),

  // ---------- COMMON · hands ----------
  mv('Half Crimp', 3, 5, 'common', { text: 'Fingers at ninety.' }),
  mv('Full Crimp', 4, 3, 'common', { fx: 'precise', text: 'Precise · hard on the pulleys.' }),
  mv('Sidepull', 2, 7, 'common', { opposes: true, text: 'Lean off it. Needs the other hand pulling back. Opposition.' }),
  mv('Undercling', 2, 7, 'common', { opposes: true, fx: 'static', text: 'Static · takes 1 less Bite. Opposition.' }),
  mv('Gaston', 3, 5, 'common', { opposes: true, text: 'Shoulders complain. Opposition.' }),
  mv('Sloper Slap', 2, 6, 'common', { fx: 'friction', text: 'Friction · ignores Greasy.' }),
  mv('Pinch Grip', 3, 6, 'common', { fx: 'balance', text: 'Balance · prevents Squeeze.' }),
  mv('Mantle', 4, 4, 'common', { text: 'Press down. Commit.' }),
  mv('Deadpoint', 4, 3, 'common', { fx: 'snap', text: 'Snap · clears Grip 3 or less outright.' }),
  mv('Jug Haul', 1, 8, 'common', { text: 'Nothing to it but pulling.' }),
  mv('Match', 2, 6, 'common', { text: 'Both hands, one hold.' }),
  mv('Bump', 3, 5, 'common', { text: 'Small hand, then the good one.' }),
  mv('Layback', 3, 6, 'common', { opposes: true, text: 'Lean and walk the feet. Opposition.' }),
  mv('Hand Jam', 2, 8, 'common', { fx: 'tough', text: 'Tough · ignores Sharp and Razor.' }),
  mv('Palm Press', 2, 6, 'common', { fx: 'friction', text: 'Friction · ignores Greasy.' }),
  mv('Static Reach', 3, 6, 'common', { fx: 'static', text: 'Static · takes 1 less Bite.' }),

  // ---------- COMMON · feet ----------
  ft('Edge', 2, 5, 'common', { support: 1, text: 'Support 1.' }),
  ft('High Step', 2, 5, 'common', { support: 1, text: 'Support 1. Foot to the waist.' }),
  ft('Heel Hook', 1, 8, 'common', { support: 1, text: 'Support 1. Third hand.' }),
  ft('Drop Knee', 2, 6, 'common', { support: 1, fx: 'balance', text: 'Support 1 · prevents Squeeze.' }),
  ft('Flag', 0, 7, 'common', { support: 2, text: 'Support 2. Pure counterbalance.' }),
  ft('Back Flag', 0, 8, 'common', { support: 2, text: 'Support 2.' }),
  ft('Foot Swap', 1, 6, 'common', { support: 1, text: 'Support 1. Quiet and quick.' }),
  ft('Rock Over', 3, 4, 'common', { support: 1, text: 'Support 1. All of it onto one foot.' }),
  ft('Outside Edge', 2, 6, 'common', { support: 1, text: 'Support 1. Turn the hip in.' }),
  ft('Knee Scum', 1, 7, 'common', { support: 1, text: 'Support 1. Ugly, effective.' }),

  // ---------- COMMON · technique ----------
  bn('Breathe', 0, 'common', { shed: 2, text: 'Shed 2 pump.' }),
  bn('Deep Breath', 1, 'common', { shed: 4, text: 'Shed 4 pump.' }),
  bn('Brush', 0, 'common', { gripCut: 2, cleans: true, targeted: true, text: '−2 Grip, strip its ability.' }),
  bn('Tick Marks', 0, 'common', { gripCut: 2, targeted: true, text: '−2 Grip to one hold.' }),
  bn('Read the Sequence', 0, 'common', { draw: 2, text: 'Draw 2.' }),
  bn('Sight the Line', 0, 'common', { read: 2, draw: 1, text: 'Read the next 2 holds. Draw 1.' }),
  bn('Warm Up', 0, 'common', { shed: 1, draw: 1, text: 'Shed 1. Draw 1.' }),
  bn('Trust the Feet', 1, 'common', { power: 2, targeted: true, text: '+2 Power to one lane.' }),
  bn('Downclimb', 2, 'common', { shed: 5, text: 'Shed 5 pump.' }),
  bn('Tape Job', 0, 'common', { restore: 2, text: 'Return 2 burnt cards to hand.' }),
  rest('Stem Rest', 7, 3, 'common', { text: 'Rest · shed 3. Anchor.' }),
  rest('Hands-Free', 8, 2, 'common', { text: 'Rest · shed 2. Anchor.' }),

  // ---------- UNCOMMON · hands ----------
  // CARD-12: a second snap — Deadpoint clears a weak hold at low contact; Pounce
  // trades some of that finish for staying power, so it snaps AND holds if the
  // hold turns out to be a touch too stiff. The crux-clear identity, one step up.
  mv('Pounce', 4, 5, 'uncommon', { fx: 'snap', text: 'Snap · clears Grip 3 or less outright.' }),
  mv('Cross-Through', 3, 7, 'uncommon', { opposes: true, text: 'Wrong hand, right hold. Opposition.' }),
  mv('Lock & Bump', 4, 5, 'uncommon', { text: 'Two moves in one breath.' }),
  mv('Iron Cross', 4, 6, 'uncommon', { opposes: true, text: 'Both arms, nothing spare. Opposition.' }),
  mv('Two-Finger Pocket', 4, 5, 'uncommon', { fx: 'precise', text: 'Precise · +2 vs crimps.' }),
  mv('Finger Lock', 3, 8, 'uncommon', { fx: 'tough', text: 'Tough · ignores Sharp and Razor.' }),
  mv('Compression Squeeze', 4, 6, 'uncommon', { opposes: true, fx: 'balance', text: 'Balance · prevents Squeeze. Opposition.' }),
  mv('Barn Door Fix', 2, 9, 'uncommon', { fx: 'static', text: 'Static · takes 1 less Bite.' }),
  mv('Campus Move', 5, 3, 'uncommon', { text: 'No feet. All arm.' }),
  mv('Dyno', 6, 2, 'uncommon', { fx: 'commit', text: 'Commit · stick it and go straight past the next hold. Miss and you are off.' }),
  mv('Sloper Squeeze', 3, 8, 'uncommon', { fx: 'friction', text: 'Friction · ignores Greasy.' }),
  mv('Gaston Lock', 4, 6, 'uncommon', { fx: 'static', text: 'Static · takes 1 less Bite.' }),
  mv('Try Hard', 3, 6, 'uncommon', { fx: 'greedy', text: 'Greedy · stronger the more pumped you are.' }),
  mv('Fight It', 4, 5, 'uncommon', { fx: 'greedy', text: 'Greedy · stronger the more pumped you are.' }),
  mv('Last Gasp', 3, 4, 'common', { fx: 'greedy', text: 'Greedy · stronger the more pumped you are.' }),
  mv('Scream Through It', 5, 4, 'rare', { fx: 'greedy', text: 'Greedy · stronger the more pumped you are. Loud.' }),
  mv('Dig In', 3, 6, 'common', { fx: 'greedy', text: 'Greedy · stronger the more pumped you are.' }),
  mv('Nothing Left', 6, 3, 'rare', { fx: 'greedy', text: 'Greedy · stronger the more pumped you are. Nothing held back.' }),

  // ---------- UNCOMMON · feet ----------
  ft('Toe Hook', 1, 9, 'uncommon', { support: 1, anchor: true, fx: 'hooked', text: 'Anchor · cancels crux tax.' }),
  ft('Bicycle', 3, 5, 'uncommon', { support: 1, text: 'Support 1. Toe and heel.' }),
  ft('Heel-Toe Cam', 2, 8, 'uncommon', { support: 2, anchor: true, text: 'Support 2. Anchor.' }),
  ft('Stem', 1, 9, 'uncommon', { support: 2, text: 'Support 2. Bridge it.' }),
  ft('Frog Step', 3, 6, 'uncommon', { support: 1, text: 'Support 1.' }),
  ft('Knee Bar', 0, 9, 'uncommon', { support: 1, shed: 2, anchor: true, text: 'Support 1 · rest · shed 2.' }),
  // CARD-11: a rest that poses a decision — it sheds less than a plain rest, but
  // brushes and chalks the hold you rest under, so where you shake out matters.
  rest('Chalk the Hold', 7, 2, 'uncommon', { restChip: 2,
    text: 'Rest · shed 2. −2 Grip to the hold you rest under. Anchor.' }),
  /* CARD-18: and the other way round — rest MORE and work the hold less. One card
     is a quirk; two make the trade the mechanic is about (how much of a shake-out
     you spend on the rock) into a decision you make twice.
     The first cut of this was Shake Out with a free chip bolted on, which is the
     strict upgrade CARD-11's own guard forbids for Chalk the Hold. It pays for the
     chip on a different axis instead: no anchor, so you get the rest and the chip
     and then it is gone for the burn. */
  rest('Milk The Jug', 6, 3, 'uncommon', { restChip: 1, anchor: false,
    text: 'Rest · shed 3. −1 Grip to the hold you rest under. No anchor — it burns out.' }),

  // ---------- UNCOMMON · technique ----------
  bn('Visualize', 0, 'uncommon', { draw: 2, text: 'Draw 2.' }),
  bn('Try-Hard Scream', 2, 'uncommon', { power: 3, targeted: true, text: '+3 Power to one lane.' }),
  bn('Chalk Bag', 0, 'uncommon', { shed: 1, draw: 1, text: 'Shed 1. Draw 1.' }),
  bn('Liquid Chalk', 1, 'uncommon', { powerAll: 1, text: '+1 Power to every lane.' }),
  bn('Guidebook', 0, 'uncommon', { gripCut: 3, targeted: true, text: '−3 Grip to one hold.' }),
  bn('Second Wind', 1, 'uncommon', { shed: 4, draw: 1, text: 'Shed 4. Draw 1.' }),
  bn('Skin File', 0, 'uncommon', { restore: 2, text: 'Return 2 burnt cards to hand.' }),
  bn('Beta Spray', 0, 'uncommon', { draw: 2, shed: 1, text: 'Shed 1. Draw 2.' }),
  /* CARD-18: the other end of RUN-9's read. Sight the Line reads 2 and hands you a
     card; this reads twice as far and hands you nothing, off the clock instead. Both
     are pure information — resolution never consults readAhead — so this is the one
     part of the ticket that cannot touch the band whatever it costs. */
  bn('Take It All In', 1, 'uncommon', { read: 4, text: 'Read the next 4 holds off the wall.' }),
  /* CARD-18: skin was a currency exactly one card ever charged, and that card was a
     rare that bought Power with it. This buys the CLOCK with it, at uncommon: the
     route goes, and the trip is a fall shorter for it. */
  bn('Last Of The Skin', 0, 'uncommon', { shed: 5, skinCost: 1, text: 'Shed 5. Costs 1 skin.' }),

  // ---------- RARE ----------
  mv('Iron Fingers', 4, 8, 'rare', { latch: true, fx: 'precise', text: 'Latch · Precise vs crimps.' }),
  mv('Static Lock', 3, 9, 'rare', { anchor: true, fx: 'static', text: 'Anchor · Static.' }),
  mv('Perfect Lock', 5, 7, 'rare', { fx: 'static', text: 'Static · takes 1 less Bite.' }),
  mv('Double Dyno', 8, 2, 'rare', { fx: 'commit', text: 'Commit · stick it and skip a hold. Fresher hands stick it more often.' }),
  mv('Monodoigt', 5, 6, 'rare', { fx: 'precise', text: 'Precise · one finger, all of it.' }),
  mv('The Sweet Spot', 3, 9, 'rare', { fx: 'settle2', text: 'Settles twice as fast.' }),
  mv('Death Grip', 4, 9, 'rare', { fx: 'tough', text: 'Tough · ignores Sharp and Razor.' }),
  mv('All Points Off', 6, 4, 'rare', { fx: 'greedy', text: 'Greedy · stronger the more pumped you are.' }),
  ft('Bat Hang', 0, 10, 'rare', { support: 2, shed: 3, anchor: true, text: 'Support 2 · rest · shed 3.' }),
  ft('Silent Feet', 2, 8, 'rare', { support: 2, anchor: true, text: 'Support 2. Anchor.' }),
  ft('Hands-Free Rest', 0, 9, 'rare', { support: 2, shed: 4, anchor: true, text: 'Support 2 · shed 4.' }),
  bn('Perfect Beta', 0, 'rare', { gripCut: 4, cleans: true, targeted: true, text: '−4 Grip, strip its ability.' }),
  bn('Send Train', 1, 'rare', { powerAll: 2, text: '+2 Power to every lane.' }),
  bn('Local Knowledge', 0, 'rare', { draw: 3, text: 'Draw 3.' }),
  bn('Flash Pump', 0, 'rare', { shed: 6, text: 'Shed 6 pump.' }),
  bn('Second Skin', 0, 'rare', { restore: 3, text: 'Return 3 burnt cards to hand.' }),

  // ================= EXPANDED POOL · commons =================
  mv('Closed Crimp', 3, 5, 'common', { fx: 'precise', text: 'Precise · +2 vs crimps.' }),
  mv('Open Crimp', 2, 6, 'common', { fx: 'friction', text: 'Friction · ignores Greasy.' }),
  mv('Edge Pull', 3, 5, 'common', { text: 'Straight down on a good one.' }),
  mv('Rail Pull', 2, 7, 'common', { text: 'Long horizontal, no feet.' }),
  mv('Incut Edge', 3, 6, 'common', { text: 'It takes the weight for you.' }),
  mv('Dish Press', 2, 6, 'common', { fx: 'friction', text: 'Friction · ignores Greasy.' }),
  mv('Friction Press', 1, 8, 'common', { fx: 'friction', text: 'Friction · all palm, no edge.' }),
  mv('Slopey Rail', 2, 7, 'common', { text: 'Wide, rounded, unhelpful.' }),
  mv('Wide Pinch', 3, 5, 'common', { fx: 'balance', text: 'Balance · prevents Squeeze.' }),
  mv('Thumb Catch', 2, 7, 'common', { fx: 'balance', text: 'Balance · the thumb does it.' }),
  mv('Thumb Sprag', 3, 6, 'common', { text: 'Wedge it and pull sideways.' }),
  mv('Three-Finger Drag', 3, 5, 'common', { text: 'Kinder on the pulleys.' }),
  mv('Shallow Pocket', 2, 6, 'common', { text: 'Two knuckles of nothing.' }),
  mv('Pocket Pull', 3, 5, 'common', { fx: 'precise', text: 'Precise · +2 vs crimps.' }),
  mv('Backhand', 2, 6, 'common', { text: 'Wrong way round and it works.' }),
  mv('Reverse Gaston', 3, 5, 'common', { text: 'Shoulder says no. Do it anyway.' }),
  mv('Slow Pull', 2, 8, 'common', { fx: 'static', text: 'Static · takes 1 less Bite.' }),
  mv('Press', 4, 4, 'common', { text: 'Straight down through the palm.' }),
  mv('Rock Press', 3, 5, 'common', { text: 'Shift the hips and stand.' }),
  mv('Fist Jam', 3, 6, 'common', { fx: 'tough', text: 'Tough · ignores Sharp and Razor.' }),
  mv('Ring Lock', 2, 7, 'common', { fx: 'tough', text: 'Tough · ignores Sharp and Razor.' }),
  mv('Arm Bar', 2, 8, 'common', { opposes: true, fx: 'static', text: 'Static · wedge the whole arm. Opposition.' }),
  mv('Chicken Wing', 1, 9, 'common', { opposes: true, fx: 'static', text: 'Static · undignified, secure. Opposition.' }),
  mv('Lunge', 4, 3, 'common', { text: 'Go before you think.' }),
  mv('Snatch', 4, 4, 'common', { text: 'Quick hand, quicker regret.' }),
  mv('Pop', 3, 4, 'common', { text: 'A little air, a lot of hope.' }),
  mv('Throw', 5, 2, 'common', { text: 'Everything, at once, upward.' }),
  mv('Dead Hang', 0, 9, 'common', { fx: 'guard', text: 'Guard · covers the other hand.' }),
  mv('Flag Save', 1, 7, 'common', { fx: 'guard', text: 'Guard · covers the other hand.' }),
  mv('Cut Loose', 3, 5, 'common', { fx: 'weight', text: 'Weight · +1 per other card out.' }),
  ft('Inside Edge', 2, 5, 'common', { support: 1, text: 'Support 1.' }),
  ft('Toe Scum', 1, 6, 'common', { support: 1, text: 'Support 1. Rubber on nothing.' }),
  ft('Foot Cam', 2, 6, 'common', { support: 1, text: 'Support 1. Twist and lock.' }),
  ft('Smedge', 2, 5, 'common', { support: 1, text: 'Support 1. Half smear, half edge.' }),
  ft('Standing Rest', 0, 7, 'common', { support: 1, shed: 1, text: 'Support 1 · shed 1.' }),
  ft('Precise Feet', 1, 7, 'common', { support: 2, text: 'Support 2. Quiet.' }),
  ft('Heel Cam', 2, 6, 'common', { support: 1, text: 'Support 1.' }),
  ft('Toe Jam', 2, 6, 'common', { support: 1, fx: 'tough', text: 'Support 1 · Tough.' }),
  rest('Jug Shake', 7, 3, 'common', { text: 'Rest · shed 3. Anchor.' }),
  rest('Drop Shake', 6, 2, 'common', { text: 'Rest · shed 2. Anchor.' }),
  bn('Wire Brush', 0, 'common', { gripCut: 2, targeted: true, text: '−2 Grip to one hold.' }),
  bn('Extra Pad', 1, 'common', { shed: 3, text: 'Shed 3 pump.' }),
  bn('Trail Snack', 0, 'common', { shed: 2, draw: 1, text: 'Shed 2. Draw 1.' }),
  bn('Coffee', 0, 'common', { draw: 2, text: 'Draw 2.' }),
  bn('Focus', 1, 'common', { power: 2, targeted: true, text: '+2 Power to one lane.' }),
  bn('Slow Down', 1, 'common', { shed: 3, text: 'Shed 3 pump.' }),
  bn('Session Plan', 0, 'common', { draw: 1, shed: 1, text: 'Shed 1. Draw 1.' }),
  bn('Approach Shoes', 0, 'common', { shed: 2, text: 'Shed 2 pump.' }),
  bn('Headtorch', 0, 'common', { draw: 1, shed: 1, text: 'Draw 1, shed 1. One more burn before dark.' }),

  // ================= EXPANDED POOL · uncommons =================
  mv('Micro Crimp', 4, 4, 'uncommon', { fx: 'precise', text: 'Precise · +2 vs crimps.' }),
  mv('Closed Crimp Lock', 4, 6, 'uncommon', { fx: 'static', text: 'Static · takes 1 less Bite.' }),
  mv('Sloper Compression', 3, 7, 'uncommon', { opposes: true, fx: 'friction', chip: 1, text: 'Friction · Chip 1 to every lane. Opposition.' }),
  mv('Vice Grip', 4, 6, 'uncommon', { fx: 'balance', text: 'Balance · prevents Squeeze.' }),
  mv('Mono', 5, 3, 'uncommon', { fx: 'precise', text: 'Precise · one finger, all of it.' }),
  mv('Paddle Dyno', 5, 4, 'uncommon', { text: 'Two hands, neither of them ready.' }),
  mv('Double Bump', 4, 6, 'uncommon', { text: 'Small, small, good.' }),
  mv('Cross Under', 3, 7, 'uncommon', { opposes: true, fx: 'guard', text: 'Guard · covers the other hand. Opposition.' }),
  mv('Iron Press', 5, 4, 'uncommon', { text: 'Straight-arm and stand up.' }),
  mv('Barn Door Save', 2, 9, 'uncommon', { fx: 'guard', text: 'Guard · covers the other hand.' }),
  mv('Momentum Move', 3, 6, 'uncommon', { fx: 'momentum', text: 'Momentum · +1 Power per flow.' }),
  mv('Compression Lock', 3, 7, 'uncommon', { opposes: true, chip: 1, text: 'Chip 1 to every lane. Opposition.' }),
  mv('Off-Width Grovel', 2, 10, 'uncommon', { fx: 'tough', text: 'Tough · no style, all progress.' }),
  mv('Figure Four', 4, 5, 'uncommon', { fx: 'weight', text: 'Weight · +1 per other card out.' }),
  mv('Kneedrop', 3, 6, 'uncommon', { text: 'Turn in and reach past it.' }),
  mv('Backstep', 3, 6, 'uncommon', { fx: 'echo', text: 'Echo · returns to hand when it clears.' }),
  mv('Recovery Hang', 0, 10, 'uncommon', { shed: 3, anchor: true, text: 'Rest · shed 3. Anchor.' }),
  ft('Hooked Heel', 2, 8, 'uncommon', { support: 1, anchor: true, text: 'Support 1. Anchor.' }),
  ft('Toe Hook Rest', 0, 9, 'uncommon', { support: 2, shed: 2, anchor: true, text: 'Support 2 · shed 2.' }),
  ft('Precise Swap', 2, 7, 'uncommon', { support: 2, text: 'Support 2.' }),
  ft('Stem Box', 1, 9, 'uncommon', { support: 2, shed: 1, text: 'Support 2 · shed 1.' }),
  /* CARD-18: latch existed on exactly one card, a rare hand move. On a FOOT it is a
     different card entirely — what it saves is the Support, which ENG-32 made the
     thing you are paying for, so a foot that slips and catches keeps the hands paid
     for a turn they would otherwise have climbed alone. */
  ft('Rand Smear', 1, 6, 'uncommon', { support: 2, latch: true, text: 'Support 2 · Latch.' }),
  bn('Wire Brush Pro', 0, 'uncommon', { gripCut: 3, cleans: true, targeted: true, text: '−3 Grip, strip its ability.' }),
  bn('Spotter', 1, 'uncommon', { shed: 2, draw: 1, text: 'Shed 2. Draw 1.' }),
  bn('Crash Pad', 1, 'uncommon', { shed: 4, text: 'Shed 4 pump.' }),
  bn('Fresh Shoes', 0, 'uncommon', { powerAll: 1, text: '+1 Power to every lane.' }),
  bn('Antihydral', 0, 'uncommon', { restore: 2, text: 'Return 2 burnt cards to hand.' }),
  bn('Psyche', 0, 'uncommon', { powerAll: 1, draw: 1, text: '+1 Power everywhere. Draw 1.' }),
  bn('Rest Day', 2, 'uncommon', { shed: 6, text: 'Shed 6 pump.' }),
  bn('Cold Front', 1, 'uncommon', { powerAll: 1, text: '+1 Power to every lane.' }),
  bn('Commit', 2, 'uncommon', { power: 4, targeted: true, text: '+4 Power to one lane.' }),
  bn('Trust', 0, 'uncommon', { draw: 2, shed: 1, text: 'Shed 1. Draw 2.' }),
  bn('Warm Conditions', 1, 'uncommon', { powerAll: 1, text: '+1 Power to every lane.' }),
  bn('Tape Up', 0, 'uncommon', { restore: 1, shed: 1, text: 'Shed 1. Return 1 burnt card.' }),
  bn('One More Go', 1, 'uncommon', { shed: 6, text: 'Shed 6 pump. Costs a pump to play.' }),

  // ================= EXPANDED POOL · rares =================
  mv('Perfect Crimp', 5, 8, 'rare', { fx: 'precise', text: 'Precise · +2 vs crimps.' }),
  mv('Total Compression', 4, 8, 'rare', { opposes: true, chip: 2, text: 'Chip 2 to every lane. Opposition.' }),
  mv('The Lock', 4, 10, 'rare', { fx: 'static', anchor: true, text: 'Anchor · Static.' }),
  mv('Hands of Stone', 5, 9, 'rare', { fx: 'tough', text: 'Tough · ignores Sharp and Razor.' }),
  mv('Full Send', 7, 3, 'rare', { fx: 'commit', text: 'Commit · everything on one move. Stick it and skip a hold.' }),
  mv('The Long Pull', 5, 7, 'rare', { fx: 'momentum', text: 'Momentum · +1 Power per flow.' }),
  mv('Everything At Once', 6, 6, 'rare', { fx: 'weight', text: 'Weight · +1 per other card out.' }),
  mv('Second Nature', 3, 10, 'rare', { fx: 'settle2', text: 'Settles twice as fast.' }),
  mv('Untouchable', 2, 12, 'rare', { fx: 'guard', anchor: true, text: 'Guard · Anchor.' }),
  mv('Bomber Jam', 4, 9, 'rare', { fx: 'tough', anchor: true, text: 'Tough · Anchor.' }),
  mv('Muscle Memory', 4, 7, 'rare', { fx: 'echo', text: 'Echo · returns to hand when it clears.' }),
  mv('Ripcord', 3, 6, 'rare', { fx: 'peel', text: 'Peel · draw a card when it blows.' }),
  // CARD-12: a second peel with a different shape — commit hard, and if it rips
  // you grab something. More Power, less Contact than Ripcord, so it blows (and
  // peels) more often; a finisher you throw knowing the safety net is there.
  mv('Bail Out', 4, 4, 'rare', { fx: 'peel', text: 'Peel · draw a card when it blows.' }),
  mv('Read And React', 3, 7, 'rare', { fx: 'cycle', text: 'Cycle · draws a card each turn it holds on.' }),
  // CARD-12: a second cycle — low Power, high Contact, so it clings to a hold
  // for turns and keeps feeding you cards while it does. The patient engine to
  // Read And React's aggressive one.
  mv('Latch And Look', 2, 9, 'rare', { fx: 'cycle', text: 'Cycle · draws a card each turn it holds on.' }),
  rest('The Rest', 12, 5, 'rare', { text: 'Rest · shed 5. Anchor.' }),
  ft('Perfect Heel', 2, 10, 'rare', { support: 2, anchor: true, text: 'Support 2. Anchor.' }),
  ft('No-Hands Rest', 0, 11, 'rare', { support: 2, shed: 5, anchor: true, text: 'Support 2 · shed 5.' }),
  ft('Ghost Feet', 3, 9, 'rare', { support: 2, text: 'Support 2. Nobody hears you.' }),
  bn('Beta Flash', 0, 'rare', { draw: 3, shed: 1, text: 'Shed 1. Draw 3.' }),
  bn('The Right Sequence', 0, 'rare', { gripCut: 4, cleans: true, targeted: true, text: '−4 Grip, strip its ability.' }),
  bn('Full Rack', 1, 'rare', { powerAll: 2, draw: 1, text: '+2 Power everywhere. Draw 1.' }),
  bn('Skin Like Leather', 0, 'rare', { restore: 3, shed: 2, text: 'Shed 2. Return 3 burnt cards.' }),
  bn('Deep Focus', 1, 'rare', { power: 5, targeted: true, text: '+5 Power to one lane.' }),
  bn('Send Temps', 0, 'rare', { powerAll: 2, text: '+2 Power to every lane.' }),
  bn('The Whole Trip', 2, 'rare', { powerAll: 3, skinCost: 1, text: '+3 Power everywhere. Costs 1 skin.' }),

  // ================= EXPANDED POOL · curses =================
  mv('Tweaked Pulley', 1, 2, 'curse', { hex: 1, text: 'It popped. You felt it pop — you crank harder to spare it, and the hold you put it on gets +1 Grip.' }),
  mv('Split Tip', 2, 3, 'curse', { hex: 1, text: 'Right down the middle of the pad. Whatever you put it on gets +1 Grip.' }),
  mv('Wet Holds', 1, 4, 'curse', { hex: 1, text: 'Seeping. Nothing sticks — the hold you use it on gets +1 Grip.' }),
  bn('Bad Landing', 2, 'curse', { text: 'The pads were in the wrong place.' }),
  bn('Ego', 1, 'curse', { text: 'You told everyone the grade before you did it.' }),
  bn('Doubt', 1, 'curse', { text: 'You are already thinking about the fall.' }),

  // ---------- PROTECTION · a quick action, not a hold you grip ----------
  bn('Quickdraw', 0, 'common', { clip: true, draw: 1, shed: 1, text: 'Clip · shed 1, draw 1. One turn of climbing like you are safe.' }),
  bn('Wired Nut', 0, 'common', { clip: true, draw: 1, shed: 1, text: 'Clip · resets the runout. One turn of trying hard off it.' }),
  bn('Bomber Cam', 0, 'rare', { clip: true, draw: 1, shed: 3, text: 'Clip · shed 3, draw 1. It is not coming out, so neither are you.' }),

  // ---------- SEQUENCES · a plan you hold across turns ----------
  bn('Link It Up', 1, 'uncommon', { seq: 'linked',
    text: 'Work a hold three turns running, then two holds go free.' }),
  bn('Read The Sequence', 1, 'uncommon', { seq: 'static',
    text: 'Two turns without resting, then draw 3.' }),
  bn('Find The Rest', 1, 'uncommon', { seq: 'breathe',
    text: 'Rest two turns running, then shed the lot.' }),
  bn('Trust The Feet', 1, 'rare', { seq: 'committed',
    text: 'Feet on for three turns, then everything gains 2 Contact and settles.' }),

  // ---------- SPECIALISTS · scale off what else is in the deck ----------
  mv('Crimp Specialist', 1, 5, 'uncommon', { synergy: 'crimp', fx: 'precise',
    text: 'Precise · +1 Power per 3 crimp cards.' }),
  mv('Friction Master', 1, 6, 'uncommon', { synergy: 'sloper', fx: 'friction',
    text: 'Friction · +1 Power per 3 sloper cards.' }),
  mv('Compression Beast', 2, 6, 'uncommon', { opposes: true, synergy: 'pinch', fx: 'balance',
    text: 'Balance · +1 Power per 3 compression cards. Opposition.' }),
  mv('Pocket Poacher', 2, 5, 'uncommon', { synergy: 'pocket',
    text: '+1 Power per 3 pocket cards.' }),
  mv('Air Time', 2, 3, 'uncommon', { synergy: 'dyno',
    text: '+1 Power per 3 dynamic cards.' }),
  mv('Crack Rat', 1, 7, 'uncommon', { synergy: 'crack', fx: 'tough',
    text: 'Tough · +1 Power per 3 crack cards.' }),
  ft('Footwork', 0, 7, 'uncommon', { support: 1, synergy: 'feet',
    text: 'Support 1 · +1 Power per 3 foot cards.' }),
  mv('Old Hands', 2, 8, 'rare', { synergy: 'rest',
    text: '+1 Power per 3 rest cards. Knows when to stop.' }),
  mv('The Specialist', 3, 7, 'rare', { synergy: 'crimp', fx: 'precise',
    text: 'Precise · +1 Power per 3 crimp cards.' }),
  ft('Silent Approach', 1, 8, 'rare', { support: 2, synergy: 'feet',
    text: 'Support 2 · +1 Power per 3 foot cards.' }),

  // ---------- BETA · finale only, one per journal page ----------
  bn('Beta · The Approach', 0, 'beta', { gripCut: 3, targeted: true, text: '−3 Grip. He walked it first.' }),
  bn('Beta · The Grade', 0, 'beta', { draw: 2, shed: 1, text: 'Shed 1. Draw 2.' }),
  bn('Beta · Conditions', 0, 'beta', { powerAll: 1, text: '+1 Power to every lane.' }),
  mv('Beta · Going Alone', 4, 8, 'beta', { fx: 'tough', text: 'Tough · nobody is coming.' }),
  bn('Beta · The Crux', 0, 'beta', { gripCut: 5, cleans: true, targeted: true, text: '−5 Grip, strip its ability.' }),
  bn('Beta · Last Entry', 1, 'beta', { powerAll: 2, text: '+2 Power to every lane.' }),
  // NARR-11: the eight new pages. Deliberately smaller than the original six —
  // fifteen pages means fifteen of these on the finale, and NARR-7 measured the
  // original six at nine points of completion on their own.
  bn('Beta · The Photograph', 0, 'beta', { gripCut: 2, targeted: true, text: '−2 Grip. He had looked at it for years.' }),
  bn('Beta · The Rock', 0, 'beta', { gripCut: 2, targeted: true, text: '−2 Grip. He knew which bits were solid.' }),
  bn('Beta · The Walk In', 0, 'beta', { shed: 2, text: 'Shed 2. He never once found it shorter.' }),
  bn('Beta · What He Told Her', 0, 'beta', { draw: 1, shed: 1, text: 'Shed 1. Draw 1.' }),
  mv('Beta · Being Frightened', 3, 7, 'beta', { fx: 'tough', text: 'Tough · frightened the whole time, and going anyway.' }),
  bn('Beta · The Traverse', 0, 'beta', { gripCut: 3, targeted: true, text: '−3 Grip. The forty feet nobody warns you about.' }),
  bn('Beta · Waiting It Out', 0, 'beta', { shed: 3, text: 'Shed 3. Six hours under it, and he came back.' }),
  bn('Beta · The Name', 1, 'beta', { powerAll: 1, text: '+1 Power to every lane. He was never going to sign it.' }),

  // ---------- CURSE (never in packs) ----------
  mv('Tweaky Finger', 1, 3, 'curse', { hex: 1, text: 'It twinges. You keep going, favouring it — the hold you put it on gets +1 Grip.' }),
  mv('Flapper', 2, 4, 'curse', { hex: 1, text: 'Skin off. The hold you use it on gets +1 Grip.' }),
  mv('Cold Shut', 0, 5, 'curse', { hex: 1, text: 'No feeling in it at all — you grip too hard to be sure of it, and the hold you put it on gets +1 Grip.' }),
  bn('Sandbagged Beta', 1, 'curse', { text: 'Someone lied about the grade.' }),
]) CARDS[c.name] = c

/* ======================== SYNERGY TAGS =============================
   Derived from a card's identity rather than authored 209 times. Tags do
   nothing on their own — specialist cards read the whole deck and scale
   off them, which is what turns drafting from "best stat line" into
   "does this fit what I am building".                                 */
const TAG_WORDS: [Tag, string[]][] = [
  ['pocket', ['Pocket', 'Mono', 'Three-Finger', 'Two-Finger']],
  ['crimp', ['Crimp', 'Edge', 'Rail', 'Iron Fingers', 'Micro']],
  ['sloper', ['Sloper', 'Palm', 'Friction', 'Dish', 'Open Hand', 'Slopey', 'Slap']],
  ['pinch', ['Pinch', 'Thumb', 'Compression', 'Vice', 'Squeeze']],
  ['dyno', ['Dyno', 'Lunge', 'Throw', 'Deadpoint', 'Pop', 'Snatch', 'Campus', 'Paddle', 'Bump', 'Send']],
  ['crack', ['Jam', 'Lock', 'Arm Bar', 'Chicken Wing', 'Grovel', 'Ring']],
]
export function tagOf(c: { name: string; kind: string; lane: LaneTag; shed: number }): Tag {
  if (c.shed > 0) return 'rest'
  if (c.lane === 'feet') return 'feet'
  if (c.kind === 'bonus') return 'mental'
  for (const [tag, words] of TAG_WORDS)
    if (words.some(w => c.name.includes(w))) return tag
  return ''
}
export const TAG_NAMES: Record<string, string> = {
  crimp: 'crimp', sloper: 'sloper', pinch: 'compression', pocket: 'pocket',
  dyno: 'dynamic', crack: 'crack', feet: 'footwork', rest: 'rest', mental: 'headgame',
}
export function tagCounts(cards: { name: string; kind: string; lane: LaneTag; shed: number }[]) {
  const out: Record<string, number> = {}
  for (const c of cards) { const t = tagOf(c); if (t) out[t] = (out[t] ?? 0) + 1 }
  return out
}
/** Specialists gain +1 Power for every 3 cards of their tag in the deck. */
export const SYNERGY_PER = 3

export const BY_RARITY = (r: Rarity) =>
  Object.values(CARDS).filter(c => c.rarity === r).map(c => c.name)

/** Pack roll: weighted by rarity, prefers cards you do not own yet. */
/* BAL-2. This rolled a rarity first and only then preferred what you did not
   own — so once the commons were collected, 60% of every pack was a roll that
   could not give you anything new, and the pool took 600+ runs to finish.
   The rarity is now chosen from the tiers that still have something in them. */
export function rollPackCard(rng: RNG, owned: string[]): Card | null {
  const tiers: [Rarity, number][] = [['common', 0.60], ['uncommon', 0.30], ['rare', 0.10]]
  const open = tiers.filter(([t]) => BY_RARITY(t).some(n => !owned.includes(n)))
  const use = open.length ? open : tiers
  const total = use.reduce((a, [, w]) => a + w, 0)
  let r = rng.next() * total
  let tier: Rarity = use[use.length - 1][0]
  for (const [t, w] of use) { if (r < w) { tier = t; break } r -= w }
  const pool = BY_RARITY(tier)
  const fresh = pool.filter(n => !owned.includes(n))
  const from = fresh.length ? fresh : pool
  const pick = from[rng.int(from.length)]
  return pick ? spawn(pick) : null
}

/* ============================= PROGRESSION ========================= */
export const xpToNext = (level: number) => 25 + level * 10
export const xpForSend = (grade: number) => 8 + grade * 4

/** Award XP and roll a pack for every level gained. Pure given an RNG. */
export function gainXp(s: GameState, amount0: number, rng: RNG): GameState {
  // mutators pay in XP, and only while you are actually on a trip
  const amount = Math.round(amount0 * (s.inRun ? xpMult(s.mutators) : 1))
  let level = s.level, xp = s.xp + amount
  const gained: Card[] = []
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level); level += 1
    for (let i = 0; i < PACK_SIZE; i++) {
      const c = rollPackCard(rng, s.owned.concat(gained.map(g => g.name)))
      if (c) gained.push(c)
    }
  }
  return { ...s, level, xp,
    owned: Array.from(new Set([...s.owned, ...gained.map(c => c.name)])),
    packCards: gained }
}

export const DECKS: { label: string; list: [string, number][] }[] = [
  { label: 'Starter', list: [['Crimp Grip', 3], ['Open Hand', 3], ['Lock Off', 2], ['Smear', 3],
    ['Shake Out', 2], ['Kneebar', 1], ['Chalk Up', 1]] },
  { label: 'Mid', list: [['Crimp Grip', 3], ['Open Hand', 3], ['Lock Off', 2], ['Smear', 3],
    ['Shake Out', 2], ['Kneebar', 1], ['Chalk Up', 1], ['Gaston', 1], ['Heel Hook', 1],
    ['Undercling', 1], ['Drop Knee', 1], ['Breathe', 1], ['Pinch Grip', 1]] },
  { label: 'Late', list: [['Crimp Grip', 3], ['Open Hand', 3], ['Lock Off', 2], ['Smear', 3],
    ['Shake Out', 2], ['Kneebar', 1], ['Chalk Up', 1], ['Gaston', 1], ['Heel Hook', 1],
    ['Undercling', 1], ['Drop Knee', 1], ['Breathe', 1], ['Pinch Grip', 1], ['Mantle', 1],
    ['Flag', 1], ['Brush', 1], ['Cross-Through', 1], ['Toe Hook', 1], ['Visualize', 1],
    ['Deadpoint', 1], ['Iron Fingers', 1], ['Perfect Beta', 1]] },
]

/** The 15 cards you start every climb with. Defaults to the starter kit. */
export const DEFAULT_LOADOUT: string[] = (() => {
  const out: string[] = []
  for (const [name, n] of DECKS[0].list) for (let i = 0; i < n; i++) out.push(name)
  return out
})()

export function loadoutDeck(loadout: string[]): Card[] {
  const names = loadout.length === DECK_SIZE ? loadout : DEFAULT_LOADOUT
  return names.filter(n => CARDS[n]).map(spawn)
}

/** Everything you are allowed to put in a loadout. */
export function buildable(owned: string[]): string[] {
  const starter = Object.values(CARDS).filter(c => c.rarity === 'starter').map(c => c.name)
  return [...starter, ...owned.filter(n => CARDS[n] && CARDS[n].rarity !== 'curse'
    && CARDS[n].rarity !== 'beta' && CARDS[n].rarity !== 'starter')]
}

export const LANE_NAMES = ['LEFT HAND', 'RIGHT HAND', 'FEET']

/* AUD-2. Eight one-shot effects and nothing sustained: the game had no sense of
   PLACE. Wind on the alpine wall, a stove at a camp, the radio in the van — and
   deliberately nothing at all on the finale, because silence is the loudest thing you
   can do with a boss and an ambience bed that plays through it would throw that away.
   Synthesised, not sampled: this build is one inlined HTML file with no external
   requests, and there is no audio library in `package.json` (a roadmap row claimed
   Tone.js was already a dependency for seven versions; it never was).
   WHICH BED PLAYS IS A PURE FUNCTION AND IT LIVES HERE. The screen owns the
   oscillators; this owns the decision — which means the part that can be wrong can be
   tested, and I cannot hear a test. */
export type Bed = 'none' | 'forest' | 'desert' | 'alpine' | 'camp' | 'van' | 'post'
const ACT_BEDS = ['forest', 'desert', 'alpine'] as const
const actBed = (act: number): Bed => ACT_BEDS[Math.min(2, Math.max(0, act))]

/* SKIRM-7: the Circuit gets a place too, and it is keyed to its own ZONES rather than
   to an act it does not have — so the bed tells you how deep you are. Keyed off
   `circuitZone(n).floor` rather than repeating the thresholds, because two copies of
   one ladder drift (ENG-19); a guard asserts every zone floor has an entry, so adding
   a zone fails loudly instead of falling through to the default.
   Into the Dark shares alpine with The Business on purpose: there is no fourth
   synthesised bed, and inventing one is oscillator work AUD-2 deliberately left
   outside the tested part of the game. Said out loud rather than left to be noticed. */
export const CIRCUIT_BEDS: Record<number, Bed> = { 0: 'forest', 3: 'forest', 6: 'desert', 10: 'alpine', 14: 'alpine' }
export const circuitBed = (n: number): Bed => CIRCUIT_BEDS[circuitZone(n).floor] ?? 'forest'

export function bedFor(s: GameState): Bed {
  // the finale is silent ON PURPOSE, and it outranks everything below it
  if (s.phase === 'climb' || s.phase === 'burnEnd') {
    if (specOf(s).finale) return 'none'
    if (s.inRun) return actBed(s.act)
    if (s.circuit) return circuitBed(s.circuitScore)
    return 'none'                       // a skirmish, a daily, the tutorial: no place to be
  }
  if (s.phase === 'camp') return 'camp'
  if (s.phase === 'shop') return 'post'
  if (s.phase === 'map' && s.inRun) return actBed(s.act)
  // the circuit's between-lines screen is its map, so it keeps the place it is in
  if (s.phase === 'circuitNext' && s.circuit) return circuitBed(s.circuitScore)
  return 'none'
}

/** A deliberately plain deck — nothing to read, nothing to misplay. */
export const TUTORIAL_DECK: string[] = [
  'Crimp Grip', 'Crimp Grip', 'Crimp Grip', 'Open Hand', 'Open Hand',
  'Gaston', 'Gaston', 'Undercling',
  'Lock Off', 'Lock Off', 'Smear', 'Smear', 'Smear', 'Shake Out', 'Shake Out',
]
/** One idea per hold, in the order the rock introduces them. */
export const TUTORIAL_STEPS: string[] = [
  // one per hold, in order — jug jug jug sloper crimp crimp pinch pinch
  // sharp-crimp crux jug jug
  'Tap a card, then tap a lane underneath a hold. Then COMMIT — all three go at once, in the order you placed them.',
  'Your Power — the diamond — chips its Grip. Its Bite chips your Contact. Both at once, so you can work a hold and still come off it.',
  'The hold reads a range rather than a number. You have not been on it yet. Work it once and it reads true for the rest of the trip.',
  'That sloper is Greasy: you lose 1 Power on it unless your feet are on something. Put a card in the FEET lane — leaving it empty is campusing, and costs you Bite on both hands.',
  'Every turn costs pump, plus one for each hold you have not answered. Clearing holds is how you outrun it. Max pump and you are off.',
  'Watch the top of the screen. Every few turns the route does something — greases up, dries out, a gust — and it always says so a turn beforehand.',
  'A card that survives a turn settles in, gaining Power for every turn it stays. Leaving a good card where it is usually beats moving it.',
  'A gaston pulls sideways, and sideways needs something pulling back. On its own it is weak. Put the undercling in the other hand and both get stronger.',
  'Sharp holds burn your card out for the rest of the burn when they blow it. Careful what you put on them.',
  'That is a crux. It needs Power 2 or more or the move does nothing at all. Line something real up for it.',
  'You are near the top, which the game calls EXPOSED. Backing off from here costs an extra psyche. Finishing does not.',
  'Last one. Everything you have just learned is the whole game — the rest is more of it, harder, and further from the car.',
]

/* ===================== CONTENT: THE ACT 1 MAP ======================
   One choice per tier. Renders as a column on a phone and still gives
   the real decision: which boulder, and when to spend a camp.        */
const C = (i: number): MapNode => ({ type: 'climb', routeIdx: i })
export const CAMP: MapNode = { type: 'camp', routeIdx: -1 }
const EVT: MapNode = { type: 'event', routeIdx: -1 }
const PROJ = (i: number): MapNode => ({ type: 'project', routeIdx: i })
const SHOP: MapNode = { type: 'shop', routeIdx: -1 }
const FA: MapNode = { type: 'fa', routeIdx: -1 }
const B = (i: number): MapNode => ({ type: 'boss', routeIdx: i })

export const ACT1_MAP: MapNode[][] = [
  [C(0), C(1)],                  // Warm-Up Rail · The Sit Start
  [C(2), EVT, C(1)],
  [CAMP, C(3), EVT],
  [C(3), C(4), PROJ(10), SHOP],  // Chossmaster · Peeler · The Sandbag
  [CAMP, EVT, C(5), SHOP],
  [C(5), C(6)],                  // The Fridge · Deer Tick
  [CAMP, C(7), EVT, FA],
  [C(7), C(8), PROJ(34), SHOP],  // Cathedral Traverse · Wasp Nest · The Second Guess (RUN-10)
  [B(9)],                        // The Priest
]
const ACT2_MAP: MapNode[][] = [
  [C(11), C(12), C(31)],         // The Gooseneck · Varnish · Squeeze Chimney
  [CAMP, EVT, C(13), SHOP],
  [C(13), C(14), PROJ(18), SHOP],// Sun Dagger · The Chimney · Furnace Arete
  [CAMP, C(15), EVT, FA],
  [C(15), C(16), C(30), SHOP],   // Rattlesnake Arete · Kiln · The Blowhole
  [C(30), C(32), EVT],           // The Blowhole · Sunstroke Slab
  [CAMP, EVT, PROJ(35)],         // The Rotisserie (RUN-10)
  [B(17)],                       // The Hourglass
]
const ACT3_MAP: MapNode[][] = [
  [C(19), C(20)],                // The Notch · Cold Shoulder
  [CAMP, EVT, C(21)],
  [C(21), C(22), PROJ(28), SHOP],// Icebox Corner · Whiteout Slab · The Cornice
  [C(23), C(24), SHOP],          // The Nose Direct · Coffin Crack  — roped
  [CAMP, C(25), EVT, FA],
  [C(25), C(26), SHOP],          // The Diving Board · Bergschrund
  [CAMP, EVT, PROJ(36)],         // The Hanging Slab (RUN-10)
  [B(27)],                       // Summit Block
  [B(29)],                       // THE LOST LINE
]
export const ACTS: MapNode[][][] = [ACT1_MAP, ACT2_MAP, ACT3_MAP]
/* SAVE-6. Every node on the whole map — the ceiling for anything the save records once per
   node, and for how much a run deck can have grown by the end of a trip. Derived, so adding
   an act cannot leave these caps behind. Declared HERE, after ACTS, and not up with the other
   save caps: `LARDER_MAX` was written there as `KIT_MAX * 6` two thousand lines before
   KIT_MAX exists and silently evaluated to NaN — tsc catches this one, and would have caught
   that one had I run it between the two edits. */
export const MAP_NODES = ACTS.reduce((n, act) => n + act.flat().length, 0)
export const RUN_DECK_MAX = DECK_SIZE + MAP_NODES

export const ACT_NAMES = ['Act 1 · the forest', 'Act 2 · desert towers', 'Act 3 · the alpine wall']
export const ACT_SKIN = 5        // topped up between acts

/* ======================== CONTENT: THE JOURNAL =====================
   NARR-1 seed. Pages persist across runs — the only meta-progression
   that is narrative rather than a stat drip.                        */
export const JOURNAL: { id: number; title: string; text: string }[] = [
  { id: 1, title: 'First entry', text: 'Came up the drainage looking for the wall in the old survey photo. Found it. Nobody has been here. No chalk, no tick marks, no trail. I sat under it until dark and did not touch it.' },
  { id: 8, title: 'The survey photo', text: 'The photo is from 1961 and it is nine-tenths cloud. There is a line of shadow on the left edge that is either a corner system or a scratch on the negative. I have looked at it enough to know I am no longer looking at it, I am looking at what I have decided it is.' },
  { id: 2, title: 'On the grade', text: 'I have climbed harder. I have not climbed anything that made less sense. Every sequence I try is the wrong one, and the wrong one still gets me two moves higher than the last.' },
  { id: 9, title: 'On the rock', text: 'It is better rock than it has any right to be. Everything around it is rubbish — you could pull the whole ridge down with a nut key — and then this one fin of something hard and grey that nobody has touched. I do not know what it is doing there. Neither does the guidebook, because there is no guidebook.' },
  { id: 3, title: 'Conditions', text: 'It only comes into condition for about nine days a year, as far as I can tell. Cold, dry, north wind. The rest of the time it seeps and the crux is a waterfall.' },
  { id: 10, title: 'The walk in', text: 'Four hours if the creek is low. Six if it is not, and the last hour of it is moraine, which is four hours of its own kind. I have done it eleven times now and the walk has never once got shorter. What changed is that I stopped resenting it.' },
  { id: 4, title: 'On going alone', text: 'Told Marge I was working the Cathedral. Not a lie exactly. She would come if I asked and I am not asking. This one is mine to be stupid about.' },
  { id: 11, title: 'On Marge', text: 'She asked me straight out tonight and I told her the Cathedral again. She let me. That is the part I keep turning over — she let me, and she knew, and she let me anyway. I do not know what to do with being loved by somebody that patient.' },
  { id: 12, title: 'On being frightened', text: 'I am not brave. I want that written down somewhere by me and not by somebody else afterwards. I am frightened up there the whole time. What I am is willing to be frightened for nine hours, which is a different thing and a much smaller one.' },
  { id: 5, title: 'The crux', text: 'The move is a cross-through off a two-finger pocket to a sloper you cannot see from the ground. I have done it four times. I have never done it with anything left.' },
  { id: 13, title: 'The traverse', text: 'Everybody who ever looks at this will think the crux is the crux. It is not. It is the forty feet after it, where you are pumped stupid and the holds are fine and there is nothing to do but keep going sideways with the whole drainage under your heels.' },
  { id: 14, title: 'The day it rained', text: 'Sat under it for six hours watching water come down the line I want to climb. Ate everything I had. Walked out in the dark. That was the seventh attempt and I want to be honest that I cried on the moraine, and that it was not about the climb.' },
  { id: 6, title: 'Last entry', text: 'Conditions are perfect. Skin is good. If it goes I will name it for the drainage and not for me. If it does not go I will be back in the spring.' },
  { id: 15, title: 'On the name', text: 'If it goes I am not putting my name on it. I have thought about this the whole walk in and out, eleven times. A name is a way of telling people you were there, and the only thing I have ever wanted from this line is the part where nobody was.' },
  { id: 7, title: 'At the top', text: 'Nine days of weather and it went on the seventh. I have not told anybody and I do not think I am going to. Marge would want to know, and I would want to tell her, and both of those are reasons to keep it. A line nobody knows about stays the way it was when I found it. So I am going to call it nothing at all. Whoever comes up here next can do the naming.' },
]

/* ========================= CONTENT: EVENTS ========================= */
export type EventOutcome = {
  text?: string; skin?: number; cash?: number; psyche?: number; boon?: boolean
  card?: string; cardRarity?: Rarity
  curse?: string; xp?: number; removeCard?: boolean; journal?: number
}
export type GameEvent = {
  id: string; title: string; text: string
  /** Undefined means it can happen anywhere. */
  act?: number
  /* EVT-4. Thirty-two events, all self-contained: you caused an access closure,
     you trundled a block, you believed a man about a grade, and nothing ever
     referred back. `eventsSeen` recorded WHICH event fired and never which
     branch you took, so nothing could look back even if it wanted to.
     An event can now require a specific choice you made earlier, as `id:index`. */
  after?: string
  choices: { label: string; outcome: EventOutcome }[]
}
export const EVENTS: GameEvent[] = [
  { id: 'storm', title: 'Weather Coming In',
    text: 'Anvil cloud over the ridge. Maybe an hour, maybe twenty minutes.',
    choices: [
      { label: 'Get on it wet', outcome: { text: 'You climb it damp and it goes, barely. Your skin pays.', skin: -2, xp: 12 } },
      { label: 'Sit it out under the boulder', outcome: { text: 'An hour under an overhang. You lose the day but keep the skin.', xp: 4 } },
    ] },
  { id: 'hold', title: 'The Hold Goes',
    text: 'A flake you have used twice shifts under your hand. It is going to break for somebody.',
    choices: [
      { label: 'Trundle it now', outcome: { text: 'It lands in the talus. Safer for everyone. The line got harder.', curse: 'Cold Shut', xp: 10 } },
      { label: 'Leave it and say nothing', outcome: { text: 'You climb past it and do not sleep well.', xp: 4 } },
    ] },
  { id: 'access', title: 'Access Notice',
    text: 'New sign at the pullout. Landowner has had enough of the parking.',
    choices: [
      { label: 'Walk in the long way', outcome: { text: 'Two extra miles each way. Legs cooked, conscience clean — and the landowner waves at you on the third morning.', skin: -1, psyche: 2, xp: 16 } },
      { label: 'Park down the road and slip in', outcome: { text: 'You get away with it. So does everyone, until nobody does.', xp: 6, curse: 'Sandbagged Beta' } },
    ] },
  { id: 'ethics', title: 'Bolt War',
    text: 'Two locals arguing about a bolt someone added to a highball. Both want you to agree.',
    choices: [
      { label: 'Side with the first ascensionist', outcome: { text: 'The old guard buys your coffee and tells you things.', cardRarity: 'uncommon' } },
      { label: 'Stay out of it and go climbing', outcome: { text: 'You get three burns in while they shout.', xp: 10 } },
    ] },
  { id: 'rescue', title: 'Somebody Is Hurt',
    text: 'A shout from the next boulder over. Ankle, bad landing, nobody else around.',
    choices: [
      { label: 'Carry them out', outcome: { text: 'Four hours. Your day is done and your back is wrecked.', skin: -2, xp: 20 } },
      { label: 'Point them at the trail', outcome: { text: 'They manage. You climb. It sits with you.', xp: 2 } },
    ] },
  { id: 'van', title: 'The Van',
    text: 'Turns over and does not catch. Again.',
    choices: [
      { label: 'Sell a rack piece to pay for it', outcome: { text: 'Cash for the alternator. Something had to go.', removeCard: true, xp: 6 } },
      { label: 'Sleep at the trailhead and fix it Monday', outcome: { text: 'Three nights of bad sleep. You climb anyway.', skin: -1, xp: 10 } },
    ] },
  { id: 'bear', title: 'Bear Got The Bag',
    text: 'Food bag shredded, forty feet from where you hung it. Amateur hour.',
    choices: [
      { label: 'Ration what is left', outcome: { text: 'Two days on trail mix and stubbornness.', skin: -2, xp: 8 } },
      { label: 'Drive to town for supplies', outcome: { text: 'A whole day gone to a grocery run. You do buy tape.', card: 'Tape Job' } },
    ] },
  { id: 'oldtimer', title: 'The Old Timer',
    text: 'Someone who has been coming here for thirty years watches you fall off the same move twice.',
    choices: [
      { label: 'Ask him how he did it', outcome: { text: 'He draws the sequence in the dirt with a stick. You will not forget it.', boon: true } },
      { label: 'Ask for the beta', outcome: { text: 'He shows you where the foot goes. It was never a hand problem.', card: 'Drop Knee' } },
      { label: 'Work it out yourself', outcome: { text: 'Six more burns. You own it now.', skin: -1, xp: 16 } },
    ] },
  { id: 'restday', title: 'Rest Day',
    text: 'Skin is shot and you know it. There is also a forecast window closing.',
    choices: [
      { label: 'Spend the day watching', outcome: { text: 'A whole day of other people climbing, and something clicks.', boon: true } },
      { label: 'Actually rest', outcome: { text: 'A whole day doing nothing. It is the hardest discipline there is.', skin: 2 } },
      { label: 'Go touch rock anyway', outcome: { text: 'You get away with it this time.', skin: -1, xp: 14 } },
    ] },
  { id: 'chalkbag', title: 'Somebody Left A Bag',
    text: 'A chalk bag under a boulder, rain-stiff, no name in it. Been there a season at least.',
    choices: [
      { label: 'Read what is written inside', outcome: { text: 'Somebody wrote their beta on the lining in biro.', boon: true } },
      { label: 'Take it', outcome: { text: 'Good brush inside. Somebody else brushed these holds first.', card: 'Brush' } },
      { label: 'Hang it where they will find it', outcome: { text: 'It is gone next week. Somebody found it.', xp: 8 } },
    ] },
  { id: 'sandbag', title: 'A Friendly Grade',
    text: 'Guy at the parking lot says the line at the far end is a soft V2. Great warm-up, he says.',
    choices: [
      { label: 'Believe him', outcome: { text: 'It is not a V2. It was never a V2.', curse: 'Sandbagged Beta', xp: 14 } },
      { label: 'Go look at it yourself first', outcome: { text: 'You walk up, look at it, and walk away. Good instincts.', xp: 6 } },
    ] },
  { id: 'cairn', title: 'A Cairn Where There Should Not Be One',
    text: 'Six stones stacked on a boulder well off the trail. Old lichen on the top one.',
    choices: [
      { label: 'Look underneath', outcome: { text: 'A page in a ziplock, gone soft with damp.', journal: 0, xp: 10 } },
      { label: 'Leave it be', outcome: { text: 'Somebody meant that. You keep walking.', xp: 4 } },
    ] },
  { id: 'campsite', title: 'The Old Campsite',
    text: 'Fire ring grown over, a bent pot, and a stuff sack wedged under a rock.',
    choices: [
      { label: 'Go through it', outcome: { text: 'Notebook pages, a wire brush, and a name you half recognise.', journal: 0, card: 'Guidebook' } },
      { label: 'Make camp and leave it alone', outcome: { text: 'You sleep well in somebody else\'s good spot.', skin: 1, xp: 4 } },
    ] },
  { id: 'seep', title: 'Seepage',
    text: 'The whole lower band is weeping. Half the crag is off.',
    choices: [
      { label: 'Hike higher to the dry stuff', outcome: { text: 'Steep approach, cold wind, perfect friction up top.', skin: -1, xp: 16 } },
      { label: 'Take the day off', outcome: { text: 'You read in the van and let the skin come back.', skin: 1, xp: 4 } },
    ] },
  { id: 'board', title: 'The Hangboard In The Van',
    text: 'It is right there. It is always right there.',
    choices: [
      { label: 'Do it his way', outcome: { text: 'It is not how you were taught. It is better.', boon: true } },
      { label: 'Do a session', outcome: { text: 'Hard to say if it helped. Easy to say it cost skin.', skin: -1, xp: 12 } },
      { label: 'Leave it alone, you are on a trip', outcome: { text: 'You go look at boulders instead. Correct.', xp: 6 } },
    ] },
  { id: 'choss', title: 'A Line Nobody Has Done',
    text: 'Obvious prow, obvious holds, no chalk anywhere. There is usually a reason.',
    choices: [
      { label: 'Try it', outcome: { text: 'Two good moves and a lot of gravel. You learn something.', skin: -1, cardRarity: 'common', xp: 12 } },
      { label: 'There is a reason', outcome: { text: 'You save it for a day with more skin.', xp: 4 } },
    ] },
  { id: 'notebook', title: 'Loose Pages',
    text: 'Under a flat rock at the base of the wall, weighted deliberately.',
    choices: [
      { label: 'Read them', outcome: { text: 'Handwriting you have seen once before, on a cairn note.', journal: 0, xp: 10 } },
      { label: 'Put the rock back', outcome: { text: 'Not yours. You leave them for whoever they were for.', xp: 6 } },
    ] },

  // ---------------- ACT 1 · the forest ----------------
  { id: 'ticks', act: 0, title: 'Deer Ticks',
    text: 'You find one behind your knee at the end of the day. There are probably others.',
    choices: [
      { label: 'Strip and check properly', outcome: { text: 'An hour of it. You find three more and sleep easier.', psyche: 1 } },
      { label: 'Deal with it tomorrow', outcome: { text: 'You do not sleep well and you climb worse for it.', skin: -1, xp: 8 } },
    ] },
  { id: 'moss', act: 0, title: 'Under the Moss',
    text: 'A clean line of holds, entirely green. Somebody would have to brush it.',
    choices: [
      { label: 'Spend the afternoon brushing', outcome: { text: 'Four hours on a wire brush. It is a real line now.', card: 'Wire Brush', xp: 10 } },
      { label: 'Leave it for the locals', outcome: { text: 'Somebody else can have that one.', psyche: 1 } },
    ] },
  { id: 'logging', act: 0, title: 'The Logging Road',
    text: 'Fresh gate across the spur road. The walk in just became four miles.',
    choices: [
      { label: 'Walk it', outcome: { text: 'Two hours each way. The crag is empty, at least.', skin: -1, xp: 14 } },
      { label: 'Find another way in', outcome: { text: 'A deer trail and a fence. It works.', cash: -10, xp: 8 } },
    ] },
  { id: 'midges', act: 0, title: 'Midges',
    text: 'Still evening, no wind, and the air is made of them.',
    choices: [
      { label: 'Climb anyway', outcome: { text: 'Two burns, and you are eaten alive for both.', skin: -1, xp: 10 } },
      { label: 'Retreat to the van', outcome: { text: 'You lose the evening and keep your mind.', psyche: 1 } },
    ] },
  { id: 'ivy', act: 0, title: 'Poison Ivy',
    text: 'Leaves of three, all round the base of the best boulder here.',
    choices: [
      { label: 'Pick your way through', outcome: { text: 'You are careful. Mostly careful.', skin: -1, cash: 15 } },
      { label: 'Buy long sleeves in town', outcome: { text: 'Twenty dollars and a shirt that does not fit, and you walk in and out of that base all week without thinking about it.', cash: -20, psyche: 1, xp: 14 } },
    ] },

  // ---------------- ACT 2 · desert towers ----------------
  { id: 'water', act: 1, title: 'The Cache Is Gone',
    text: 'Six litres buried under a cairn last week. Cairn is there. Water is not.',
    choices: [
      { label: 'Ration and keep climbing', outcome: { text: 'A dry, hot, stupid day. You get up something.', skin: -2, xp: 16 } },
      { label: 'Drive out for more', outcome: { text: 'Ninety minutes each way and a tank of fuel.', cash: -25 } },
    ] },
  { id: 'heat', act: 1, title: 'Midday',
    text: 'A hundred and six on the rock. Nothing will stick until five.',
    choices: [
      { label: 'Sleep under the van until it turns', outcome: { text: 'You wake at four to perfect conditions.', psyche: 1, xp: 8 } },
      { label: 'Try it hot', outcome: { text: 'Greasy, furious, pointless. You learn the moves at least.', skin: -1, xp: 14 } },
    ] },
  { id: 'flood', act: 1, title: 'Water In The Wash',
    text: 'Thunderheads on the mesa, and you are camped in a dry riverbed.',
    choices: [
      { label: 'Move camp now, in the dark', outcome: { text: 'Two hours of it. By morning the wash is a river and you are watching it from high ground, dry, with the kettle on.', psyche: 2, xp: 12 } },
      { label: 'It will not come to anything', outcome: { text: 'It comes to something. You save most of the gear and lose the rest downstream.', cash: -30, skin: -1, xp: 10 } },
    ] },
  { id: 'snake', act: 1, title: 'Under The Boulder',
    text: 'Something moves in the shade where you were about to drop the pads.',
    choices: [
      { label: 'Move the session elsewhere', outcome: { text: 'You climb somewhere worse and live.', psyche: 1 } },
      { label: 'Pad the other side and get on', outcome: { text: 'You spend every rest checking over your shoulder.', xp: 12, skin: -1 } },
    ] },
  { id: 'towerdrive', act: 1, title: 'Forty Miles Of Washboard',
    text: 'The tower you want is at the end of a road that is barely one.',
    choices: [
      { label: 'Drive it', outcome: { text: 'Something under the van is looser than it was.', cash: -20, xp: 14 } },
      { label: 'Walk in from the highway', outcome: { text: 'Nine miles with pads. You arrive destroyed.', skin: -2, psyche: 1, xp: 10 } },
    ] },

  // ---------------- ACT 3 · the alpine wall ----------------
  { id: 'window', act: 2, title: 'The Window',
    text: 'Thirty hours of high pressure, then a week of snow. That is the forecast.',
    choices: [
      { label: 'Go now, go tired', outcome: { text: 'You climb through it on no sleep and it works.', skin: -2, xp: 22 } },
      { label: 'Wait for the next one', outcome: { text: 'Nine days out. You rest properly, at least.', psyche: 2, skin: 2 } },
    ] },
  { id: 'altitude', act: 2, title: 'The Headache',
    text: 'Twelve thousand feet and your skull is in a vice.',
    choices: [
      { label: 'Drop down and sleep low', outcome: { text: 'A night two thousand feet lower and you are human again.', psyche: 2 } },
      { label: 'Push through it', outcome: { text: 'You climb badly and remember none of it.', skin: -1, psyche: -1, xp: 12 } },
    ] },
  { id: 'rockfall', act: 2, title: 'Rockfall',
    text: 'Something the size of a fridge comes down the gully while you are in it.',
    choices: [
      { label: 'Get under the overhang', outcome: { text: 'You sit it out for an hour, listening.', psyche: -1, xp: 10 } },
      { label: 'Run for the moraine', outcome: { text: 'You make it. Barely, and with a dead leg.', skin: -2, xp: 18 } },
    ] },
  { id: 'verglas', act: 2, title: 'Verglas',
    text: 'A film of ice on every hold, invisible until your hand is on it.',
    choices: [
      { label: 'Wait for the sun to touch it', outcome: { text: 'Three hours shivering, then perfect friction.', skin: -1, xp: 16 } },
      { label: 'Go somewhere south-facing', outcome: { text: 'Warmer rock, easier line, day saved.', psyche: 1, cash: 10 } },
    ] },
  /* EVT-4. These do not appear unless the thing they refer to happened, and a
     callback never repeats even once the range is exhausted — meeting the same
     consequence twice reads as a bug rather than as a consequence. */
  { id: 'access2', title: 'The Sign Is Bigger Now', after: 'access:1',
    text: 'Same pullout. The sign has been replaced with a larger one, and somebody has added a second board underneath it listing the dates the gate is locked. Which is all of them.',
    choices: [
      { label: 'This is on me.',
        outcome: { text: 'It is partly on you. There were four other cars.', psyche: -1, xp: 20 } },
      { label: 'Park at the next pullout and walk.',
        outcome: { text: 'Three miles now instead of two. You have the whole walk to think about it.', skin: -1, xp: 24 } },
    ] },
  { id: 'hold2', title: 'Where The Block Was', after: 'hold:0',
    text: 'You come back past the line you trundled. The scar is pale and obvious from the trail, and there is a party under it looking up at it, and one of them is saying it must have come off in the winter.',
    choices: [
      { label: 'Say nothing.', outcome: { text: 'You let them have the winter. It is not even a lie, exactly.', xp: 12 } },
      { label: 'Tell them it was you.',
        outcome: { text: 'The oldest one nods. "Better on the ground than on somebody." He means it, and it helps more than you expected.', psyche: 1, xp: 22 } },
    ] },
  { id: 'ethics2', title: 'Word Got Round', after: 'ethics:0',
    text: 'Somebody you have never met knows what you said at the campsite about the bolt, and repeats it back to you slightly wrong, as though it were a thing you are known for.',
    choices: [
      { label: 'Let it stand.', outcome: { text: 'It is close enough, and arguing would make it a bigger thing than it was.', xp: 14 } },
      { label: 'Correct it, carefully.',
        outcome: { text: 'You get it back to what you actually said. It takes ten minutes and they respect you more for the ten minutes than for the opinion.', psyche: 1, xp: 18 } },
    ] },
  { id: 'sandbag2', title: 'Him Again', after: 'sandbag:0',
    text: 'The same man, at the same table, with the same certainty, about a different line. He does not remember telling you the last one was V2.',
    choices: [
      { label: 'Ask him about the last one.',
        outcome: { text: '"That thing? That is nails." Not a flicker. He has simply moved the number and taken the memory with it.', xp: 16 } },
      { label: 'Take the beta anyway.',
        outcome: { text: 'You know exactly what you are getting and you take it anyway, which is at least an informed decision.', card: 'Beta · The Grade', curse: 'Sandbagged Beta', xp: 12 } },
    ] },
  { id: 'moraine', act: 2, title: 'Something In The Moraine',
    text: 'A stuff sack, bleached almost white, wedged between two blocks.',
    choices: [
      { label: 'Work it free', outcome: { text: 'Rope, a rack of nuts, and a folded page.', journal: 0, card: 'Wired Nut' } },
      { label: 'Leave it where it is', outcome: { text: 'Whoever put it there had reasons.', psyche: 1, xp: 6 } },
    ] },
]

/** Generic events plus whatever belongs to the range you are standing in —
    and never one you have already had this trip if there is any alternative.
    68% of runs used to repeat one, which reads as the world being small. */
export function rollEvent(rng: RNG, act = 0, seen: string[] = [],
  chose: string[] = []): GameEvent {
  const inRange = EVENTS.filter(e => e.act === undefined || e.act === act)
  // EVT-4: a callback only exists if the thing it calls back to happened
  const open = inRange.filter(e => !e.after || chose.includes(e.after))
  const fresh = open.filter(e => !seen.includes(e.id))
  /* Once the range is exhausted, repeats are allowed rather than nothing — but
     never a callback, because meeting the same consequence twice reads as a bug
     rather than as a consequence. */
  const pool = fresh.length ? fresh : open.filter(e => !e.after)
  return pool[rng.int(pool.length)] ?? inRange[rng.int(inRange.length)]
}

/* ======================= CONTENT: ARCHETYPES ======================
   Four climbers. Each is a loadout, a starting piece of gear, and one
   signature rule that changes how the game plays — not just its cards. */
export type Archetype = {
  id: string; name: string; text: string; sig: string; sigText: string
  unlock: number; gear: string; loadout: string[]
  betaGrip?: number; firstTurnPower?: number; noBeta?: boolean
  /* BAL-12. Three signatures compound over a burn — beta coming back cheaper,
     Contact on every move, settling to +3. The Comp Kid's fired once, on turn
     one, worth about half a hold on a twelve-hold route. It measured bottom of
     the four at 8.2% against 12.4%, on 80-turn runs against 121: explosive,
     then out of ideas. Power on every move, and a smaller hand to pay for it. */
  dPower?: number
  dHand?: number
  dContact?: number; settleMax?: number; ignoreWeather?: boolean; dSkin?: number
  /* ENG-32: this climber's feet are trusted the moment they land, so they never pay the
     settling cost. A buy-back, and a characterful one: the settling cost falls hardest
     on whoever moves their feet most, and the Comp Kid plays the fastest game in the
     roster (85 turns against the Trad Dad's 133). It cost that climber ~0.9 points and
     it had ~1.1 of margin over its 5% floor, which is the CARD-15 pattern exactly —
     a global change sinks one archetype, so that archetype is bought back rather than
     the floor being lowered to meet it. */
  quickFeet?: boolean
  /* BAL-16: how much more this climber's head takes before it goes. The Comp Kid dies of
     PSYCHE — 19% of its runs against 11-14% for everyone else — because `dAttempts: -1`
     means it fails more boulders and PSYCHE_MAX is only 3. Every other dial on this list
     is the wrong SIZE for that: measured at n=2500, one skin is worth nothing (4.9 against
     5.8 — it just fails more boulders and dies of psyche anyway), one point of betaGrip is
     worth nothing at all (5.8), one Contact is worth +4.4 and one card of hand +9.8. There
     is no existing dial between "nothing" and "makes it the best climber in the game", so
     the thing it dies of gets one, and it is characterful on the same axis: a comp kid does
     not lose heart when a boulder beats them, they go again. */
  dPsyche?: number
  dAttempts?: number
  /** META-6: a deed that earns this climber early. The `unlock` level stays as
      a backstop, so the deed is a faster, earned path — never the only one. */
  deed?: string
}
export const L = (...pairs: [string, number][]) => {
  const out: string[] = []
  for (const [n, k] of pairs) for (let i = 0; i < k; i++) out.push(n)
  return out
}
export const ARCHETYPES: Archetype[] = [
  { id: 'boulderer', name: 'The Boulderer', unlock: 1, gear: 'sticky',
    text: 'Pads, chalk, and forty attempts. The default way in.',
    sig: 'Projecting', sigText: 'Beta is worth double — worked holds come back at −2 Grip.',
    betaGrip: 2,
    loadout: L(['Crimp Grip', 3], ['Open Hand', 2], ['Lock Off', 2], ['Smear', 3],
      ['Shake Out', 2], ['Breathe', 2], ['Chalk Up', 1]) },
  { id: 'comp', name: 'The Comp Kid', unlock: 4, gear: 'downturn',
    text: 'Trained on plastic. Enormously strong, no patience at all.',
    sig: 'Plastic', sigText: '+2 Power on every move, and one less burn a day. All engine, no patience. Feet you trust the moment they land, and a boulder that beats you never gets in your head.',
    dPower: 2, dAttempts: -1, quickFeet: true, dPsyche: 1, deed: 'strong',   // META-6: earned by sending V5+
    loadout: L(['Deadpoint', 2], ['Lunge', 2], ['Bump', 1], ['Mantle', 1], ['Crimp Grip', 1],
      ['Smear', 2], ['High Step', 1], ['Shake Out', 2], ['Deep Breath', 1],
      ['Breathe', 1], ['Chalk Up', 1]) },
  { id: 'trad', name: 'The Trad Dad', unlock: 8, gear: 'tape',
    text: 'Slow, bomber, and will tell you about the rack.',
    sig: 'Bomber', sigText: '+1 Contact on every move, and nothing you place ever settles.',
    dContact: 1, settleMax: 0, deed: 'fa',       // META-6: earned by putting up a line
    loadout: L(['Hand Jam', 2], ['Arm Bar', 2], ['Undercling', 2], ['Slow Pull', 1],
      ['Heel Hook', 2], ['Smear', 1], ['Kneebar', 1], ['Breathe', 2], ['Brush', 2]) },
  { id: 'alpine', name: 'The Alpinist', unlock: 12, gear: 'liquid',
    text: 'Used to being cold, tired and a long way from the road.',
    sig: 'Endurance', sigText: 'Moves settle all the way to +3, but everything has 2 less Contact.',
    settleMax: 3, dContact: -2, deed: 'enduro',  // META-6: earned by an eight-line Circuit
    loadout: L(['Open Hand', 3], ['Jug Haul', 2], ['Flag', 2], ['Heel Hook', 2],
      ['Gaston', 2], ['Shake Out', 1], ['Breathe', 2], ['Brush', 1]) },
  /* META-7. The one climber built out of the hooks the engine already had and
     nobody used: noBeta, ignoreWeather, firstTurnPower, dHand, dSkin. She never
     rehearses — no beta ever banks, so every hold stays a guess and projecting
     buys her nothing. noBeta is a blunt, heavy cost (projecting is a pillar), so
     it is paid back not with one clever lever but with raw ability: nothing the
     sky does touches her, her hand runs a card deeper, she reads a move tougher,
     and she commits off the first one. An onsight is one try, so she gets no
     extra burns — the compensation is being strong, not getting more goes. Her
     deck reads the line as it goes (Sight the Line) rather than working it.
     Landed at 7.7% against a 5% floor and a 1.37x spread — every lever below is
     there because the sim asked for it, dHand:2 being a cliff to 11.8%.
     v9.89 (CARD-15): the richer reward pool feeds her synergy specialists she
     cannot build around (no beta, a fixed grindy hand), so it diluted her deck
     and dropped her to 4.8% under the floor while lifting the others. Bought
     back with firstTurnPower 2→3 (she commits even harder off the first move) —
     to 8.8%, back in the pack (spread 1.45x). dContact:2 was tried first and was
     the same cliff dHand:2 is (14.7%); firstTurnPower is the fine lever. */
  { id: 'onsight', name: 'The Onsighter', unlock: 16, gear: 'ball',
    text: 'Walks up, ties in, and climbs it. Strong, unfussy, no tick marks.',
    sig: 'Onsight', sigText: 'No beta ever — every hold stays a guess — but nothing the weather does touches you, your hand runs a card deeper, and you commit hard off the first move.',
    noBeta: true, ignoreWeather: true, dHand: 1, dContact: 1, dSkin: 1, firstTurnPower: 3,
    deed: 'flash',   // META-6: earned by a flash — a first-try send, which is the whole idea
    loadout: L(['Crimp Grip', 2], ['Open Hand', 2], ['Lock Off', 2], ['Mantle', 1],
      ['Smear', 2], ['Flag', 1], ['Shake Out', 2], ['Breathe', 1],
      ['Sight the Line', 1], ['Chalk Up', 1]) },
]
export const archOf = (s: GameState) => ARCHETYPES[Math.min(s.arch, ARCHETYPES.length - 1)]
/** BAL-16: the psyche ceiling for whoever is climbing. One function rather than twelve
    copies of the constant (ENG-19), so a climber who carries more heart carries it
    everywhere — at the start of a trip, off a send, and out of a camp alike. */
export const psycheMax = (s: GameState) => PSYCHE_MAX + (archOf(s).dPsyche ?? 0)
/* META-6. A climber is earned by its deed OR by reaching its level. The level
   is a backstop, not the intended path — do the deed and you have it early,
   which is what "unlock by waiting" was the complaint about — and because the
   backstop is always there, a climber can never become unreachable however the
   deeds change. A guard checks exactly that. */
export const archUnlocked = (a: Archetype, s: GameState) =>
  s.level >= a.unlock || (!!a.deed && deedsDone(s).includes(a.deed))

/* META-8. Deeds — a tick-list of things worth doing, read straight off the
   record the game already keeps (the logbook, the lines you put up, the pages
   you found, the daily streak). It doubles as a map of the game's breadth: a
   new player learns conditions matter, that you can put up your own lines and
   sandbag them, that there is a style past Redpoint. Narrative only — a deed
   pays NOTHING (no XP, no card), the same rule INJ-1 holds to, because the
   moment a deed pays you it becomes a grind rather than a record. It is the
   surface META-6 can later gate a climber unlock on; it does not gate anything
   yet. Every predicate is pure and safe on an empty save. */
export type Deed = { id: string; name: string; text: string; done: (s: GameState) => boolean }
const tickedGrades = (s: GameState) => ROUTES.filter(r => s.book[r.name]).map(r => r.grade)
export const DEEDS: Deed[] = [
  { id: 'send', name: 'Topped One Out', text: 'Send your first boulder.',
    done: s => s.sends >= 1 },
  { id: 'flash', name: 'Flashed It', text: 'Top a boulder out on the first burn.',
    done: s => Object.values(s.book).some(b => b.flashed) },
  { id: 'strong', name: 'Strong', text: 'Send something V5 or harder.',
    done: s => tickedGrades(s).some(g => g >= 5) },
  { id: 'wet', name: 'Bad Conditions', text: 'Send a boulder in the wet — humid or drizzle.',
    done: s => Object.values(s.book).some(b => b.weather === 2 || b.weather === 5) },
  { id: 'pages', name: 'The Whole Story', text: 'Find ten pages of his journal.',
    done: s => pagesHeld(s.journal) >= 10 },
  { id: 'lostline', name: 'The Lost Line', text: 'Top out the finale.',
    done: s => s.wins >= 1 },
  { id: 'fa', name: 'First Ascensionist', text: 'Put up a line of your own.',
    done: s => s.established.length >= 1 },
  { id: 'sandbagger', name: 'Sandbagger', text: 'Put a line in the book graded soft — the game\'s namesake.',
    done: s => s.established.some(e => e.claimed < e.real) },
  { id: 'streak', name: 'Every Morning', text: "Play the day's problem three days running.",
    done: s => s.dailyStreak >= 3 },
  // RUN-12: the weekly ladder finally gates something — a real week of dailies
  // (a single great day tops out around 600, so a thousand takes coming back)
  { id: 'bigweek', name: 'In Season', text: 'Bank a thousand points in a single week of dailies.',
    done: s => s.weekBest >= BIG_WEEK },
  { id: 'enduro', name: 'Enduro', text: 'Climb eight lines in a single Circuit.',
    done: s => s.bestCircuit >= 8 },
  { id: 'onsight', name: 'No Rehearsal', text: 'Unlock the Onsight style.',
    done: s => s.styleMax >= 5 },
  /* META-9: the mastery tier — read off the record the game already keeps, and
     earned over many trips rather than on day one. Like every deed (INJ-1) they
     pay nothing and gate nothing; they are a map of the game's depth for a
     player who has already seen its breadth. */
  { id: 'veteran', name: 'Seasoned', text: 'Top out the Lost Line five times over.',
    done: s => s.wins >= 5 },
  { id: 'quiver', name: 'The Whole Quiver', text: 'Top the finale as each of the five climbers.',
    done: s => {
      // the durable record, unioned with whatever history still remembers, so a
      // deed earned before META-10 (or on a pre-META-10 save) is never lost
      const won = new Set([...(s.archWins ?? []),
        ...s.history.filter(r => r.won && !r.circuit).map(r => r.arch)])
      return ARCHETYPES.every((_, i) => won.has(i))
    } },
  { id: 'hardway', name: 'The Hard Way', text: 'Win a trip with a mutator switched on.',
    done: s => (s.mutatorWin ?? false)
      || s.history.some(r => r.won && !r.circuit && (r.mutators?.length ?? 0) > 0) },
  { id: 'purist', name: 'Left No Trace', text: 'Top the Lost Line and put the stone back — tell no one.',
    // the ending is written as `${endingFor}-${kind}` (e.g. stranger-kept), never
    // the bare 'kept' this used to compare against — so it could never be earned
    done: s => s.ending.endsWith('kept') },
  { id: 'everypage', name: 'Every Last Page', text: 'Find every page of his journal, not just the ten.',
    done: s => JOURNAL.every(p => p.id === SUMMIT_PAGE || s.journal.includes(p.id)) },
]
export const deedsDone = (s: GameState) => DEEDS.filter(d => d.done(s)).map(d => d.id)

/* ======================== CONTENT: SEQUENCES ======================
   A turn was: place three, commit. A sequence is a plan held across turns
   that pays if you can protect it, and is lost the moment you cannot.  */
export type SeqNeed = 'clear' | 'norest' | 'rest' | 'feet'
export type Sequence = {
  id: string; name: string; text: string; need: SeqNeed; turns: number
  onDone: { clear?: number; draw?: number; dumpPump?: boolean; contact?: number; settle?: number }
}
export const SEQUENCES: Sequence[] = [
  { id: 'linked', name: 'Linked Moves', need: 'clear', turns: 3,
    text: 'Work a hold every turn for three turns. Miss one and it is gone.',
    onDone: { clear: 2 } },
  { id: 'static', name: 'Static Sequence', need: 'norest', turns: 2,
    text: 'Two turns without resting.', onDone: { draw: 3 } },
  { id: 'breathe', name: 'Breathing', need: 'rest', turns: 2,
    text: 'Rest two turns running.', onDone: { dumpPump: true } },
  { id: 'committed', name: 'Committed', need: 'feet', turns: 3,
    text: 'Keep something on your feet for three turns.',
    onDone: { contact: 2, settle: 1 } },
]
export const seqById = (id: string) => SEQUENCES.find(q => q.id === id)
export const seqNeedText = (q: Sequence) =>
  q.need === 'clear' ? 'work a hold' : q.need === 'norest' ? 'do not rest'
    : q.need === 'rest' ? 'rest' : 'feet on'
/** Did this turn satisfy the plan? */
export function seqMet(need: SeqNeed, clearedThis: number, restedThis: boolean, feetOn: boolean) {
  return need === 'clear' ? clearedThis > 0
    : need === 'norest' ? !restedThis
    : need === 'rest' ? restedThis
    : feetOn
}

/* ======================== CONTENT: MUTATORS =======================
   Opt-in, stackable, and each one pays in XP. The ascent ladder makes the
   game harder in a fixed order; this lets you choose which way.        */
export type Mutator = {
  id: string; name: string; text: string; xp: number
  foul?: boolean; dContact?: number; noShakes?: boolean
  dAttempts?: number; noGear?: boolean; gradeUp?: number
  startCurse?: number; drySpell?: boolean
  /* RUN-11. Every other mutator is a one-directional harder slider — worse
     conditions, less Contact, fewer burns. This one changes the TEXTURE of a
     climb instead of its number: you never re-rack. Your hand carries between
     moves and you draw fewer fresh, so you climb the boulder on what you are
     already holding rather than on a fresh five every turn. It is the mirror of
     the All In boon (draw deep, keep nothing). Off the guarded band — the
     campaign sim runs with no mutators (run.mjs), so this only shapes the runs a
     player opts into. */
  retain?: boolean
}
/** Sustained shrinks the working hand by this much, so carrying cards over is a
    husbanding decision rather than a free hoard. */
export const SUSTAINED_CUT = 2
export const MUTATORS: Mutator[] = [
  { id: 'greasy', name: 'Greasy', xp: 25, foul: true,
    text: 'The conditions are never good. Not once, all trip.' },
  { id: 'sharpend', name: 'The Sharp End', xp: 30, dContact: -1,
    text: 'The rock is sharp all over. Every move has one less Contact.' },
  { id: 'noshakes', name: 'No Shakes', xp: 40, noShakes: true,
    text: 'Rests shed nothing. There is nowhere to recover.' },
  { id: 'onego', name: 'Two Goes', xp: 50, dAttempts: -1,
    text: 'Two burns on every boulder instead of three. Less room to work it out.' },
  { id: 'lightrack', name: 'Light Rack', xp: 40, noGear: true,
    text: 'You left the kit at home. No gear to start with.' },
  { id: 'sandbag', name: 'Sandbagged', xp: 35, gradeUp: 1,
    text: 'Every grade in the book is a lie. Everything is harder than it says.' },
  { id: 'chossy', name: 'Chossy', xp: 30, startCurse: 4,
    text: 'Four curses in the deck before you have touched the rock.' },
  { id: 'dryspell', name: 'Dry Spell', xp: 30, drySpell: true,
    text: 'Camps do nothing for your skin. Rest is only for your head.' },
  { id: 'sustained', name: 'Sustained', xp: 40, retain: true,
    text: 'No re-rack between moves. Your hand carries over and you draw fewer — climb it on what you are holding.' },
]
export const mutById = (id: string) => MUTATORS.find(m => m.id === id)
export function mutMods(ids: string[]) {
  const m = { foul: false, dContact: 0, noShakes: false, dAttempts: 0,
    noGear: false, gradeUp: 0, startCurse: 0, drySpell: false, retain: false, xp: 0 }
  for (const id of ids) {
    const d = mutById(id); if (!d) continue
    m.foul ||= !!d.foul; m.dContact += d.dContact ?? 0; m.noShakes ||= !!d.noShakes
    m.dAttempts += d.dAttempts ?? 0; m.noGear ||= !!d.noGear
    m.gradeUp += d.gradeUp ?? 0; m.startCurse += d.startCurse ?? 0
    m.drySpell ||= !!d.drySpell; m.retain ||= !!d.retain; m.xp += d.xp
  }
  return m
}
export const xpMult = (ids: string[]) => 1 + mutMods(ids).xp / 100

/* ========================== CONTENT: BOONS ========================
   Gear gives you numbers. A boon changes a rule. They are what makes a run
   worth telling somebody about rather than merely finishing.            */
export type Boon = {
  id: string; name: string; text: string
  shedEvery?: number      // shed 2 every N holds worked in a burn
  freeBonus?: boolean     // first technique card each turn costs nothing
  cruxDraw?: boolean      // working a crux draws
  cruxShed?: number       // and sheds this much
  freeDraws?: boolean     // the free technique card replaces itself
  restChips?: number      // a rest also chips its lane's hold
  wideSupport?: boolean   // Support reaches both hands
  keepFlow?: boolean      // resting does not break flow
  settle?: number         // extra Settle per surviving turn
  saveBlow?: boolean      // the first card that would blow each burn survives
  noCampus?: boolean      // an empty feet lane stops costing you
  sendBeta?: number       // a send banks beta into the next boulder
  /* The wild ones: a large gain bought with a rule for the rest of the run. */
  wild?: boolean
  dPowerAll?: number      // Power on every move
  noRests?: boolean       // and rests do nothing
  dDraw?: number          // draw this many more each turn
  dumpHand?: boolean      // and the hand goes at the end of it
  dyno?: boolean          // every move: double Power, half Contact
  dTurnCap?: number       // more daylight
  dFallSkin?: number      // and a fall costs this much more skin
  dContactAll?: number    // CARD-10: Contact on every move (a gain — moves stick)
}
export const BOONS: Boon[] = [
  { id: 'secondwind', name: 'Second Wind', shedEvery: 2,
    text: 'Every second hold you work, shed 2 pump.' },
  { id: 'freerein', name: 'Free Rein', freeBonus: true, freeDraws: true, dDraw: 1,
    text: 'A bigger hand every turn, and the first technique card is free and replaces itself.' },
  { id: 'cruxjunkie', name: 'Crux Junkie', cruxDraw: true, cruxShed: 2,
    text: 'Working a crux draws you a card and sheds 2 pump.' },
  { id: 'kneebar', name: 'Kneebar Merchant', restChips: 1,
    text: 'A rest also chips 1 Grip off the hold in its lane.' },
  { id: 'bighands', name: 'Big Hands', wideSupport: true,
    text: 'Your feet give twice the Support they used to.' },
  { id: 'momentum', name: 'Momentum', keepFlow: true,
    text: 'Resting no longer breaks your flow.' },
  { id: 'glued', name: 'Glued On', settle: 1,
    text: 'Everything settles twice as fast.' },
  { id: 'ironfingers', name: 'Iron Fingers', saveBlow: true,
    text: 'The first card that would blow each burn holds on instead.' },
  { id: 'weightless', name: 'Weightless', noCampus: true,
    text: 'An empty feet lane stops costing you Bite.' },
  { id: 'sendtrain', name: 'Send Train', sendBeta: 3,
    text: 'Send a boulder and you arrive at the next one with 3 beta.' },

  // ---------- the wild ones ----------
  { id: 'freesolo', name: 'Free Solo', wild: true, dPowerAll: 1, noRests: true,
    text: '+1 Power on every move. Rests do nothing — there is no shaking out up here.' },
  { id: 'allin', name: 'All In', wild: true, dDraw: 3, dumpHand: true,
    text: 'Draw 3 more every turn. Everything left in your hand goes at the end of it.' },
  { id: 'deadpointing', name: 'Deadpointing', wild: true, dyno: true,
    text: 'Every move is a dyno: twice the Power, half the Contact.' },
  { id: 'longgame', name: 'The Long Game', wild: true, dTurnCap: 20, dFallSkin: 1,
    text: 'Twenty more turns of daylight on every burn. Every fall costs an extra skin.' },
  // CARD-10: two more wild boons — a gain paired with a rule you live with.
  { id: 'redpoint', name: 'Redpoint', wild: true, dPowerAll: 2, noRests: true,
    text: '+2 Power on every move — you go for the send. But there is no shaking out; rests do nothing.' },
  { id: 'static', name: 'Static', wild: true, dContactAll: 2, dFallSkin: 1,
    text: '+2 Contact on every move; nothing spits you off. But when you do come off, it costs an extra skin.' },
]
export const boonById = (id: string) => BOONS.find(b => b.id === id)
export function boonMods(ids: string[]) {
  const m = { shedEvery: 0, freeBonus: false, cruxDraw: false, cruxShed: 0, freeDraws: false, restChips: 0,
    wideSupport: false, keepFlow: false, settle: 0, saveBlow: false,
    noCampus: false, sendBeta: 0,
    dPowerAll: 0, noRests: false, dDraw: 0, dumpHand: false, dyno: false,
    dTurnCap: 0, dFallSkin: 0, dContactAll: 0 }
  for (const id of ids) {
    const b = boonById(id); if (!b) continue
    if (b.shedEvery) m.shedEvery = b.shedEvery
    m.freeBonus ||= !!b.freeBonus; m.cruxDraw ||= !!b.cruxDraw
    m.cruxShed += b.cruxShed ?? 0; m.freeDraws ||= !!b.freeDraws
    m.restChips += b.restChips ?? 0; m.wideSupport ||= !!b.wideSupport
    m.keepFlow ||= !!b.keepFlow; m.settle += b.settle ?? 0
    m.saveBlow ||= !!b.saveBlow; m.noCampus ||= !!b.noCampus
    m.sendBeta = Math.max(m.sendBeta, b.sendBeta ?? 0)
    m.dPowerAll += b.dPowerAll ?? 0; m.noRests ||= !!b.noRests
    m.dDraw += b.dDraw ?? 0; m.dumpHand ||= !!b.dumpHand; m.dyno ||= !!b.dyno
    m.dTurnCap += b.dTurnCap ?? 0; m.dFallSkin += b.dFallSkin ?? 0
    m.dContactAll += b.dContactAll ?? 0
  }
  return m
}

/* ========================== CONTENT: GEAR =========================
   Run-scoped passives, three slots. Lost when the run ends — this is
   loot, not collection. It is what stops every run opening identically. */
export type GearSlot = 'shoes' | 'chalk' | 'kit'
export type Gear = {
  id: string; name: string; slot: GearSlot; text: string
  dPowerHand?: number; dPowerFeet?: number; dContact?: number; dSupport?: number
  shedPerTurn?: number; drawFirst?: number; handSize?: number
  attempts?: number; skinSave?: number; brushFirst?: boolean
}
export const GEAR: Gear[] = [
  // NOTE: deck-wide Power is the single most explosive modifier in the game —
  // the weather sweep proved ±1 Power swings a battle ~40 points. Gear that
  // touches Power either pays for it in Contact, or only touches the feet
  // lane (4-5 cards, not 15). Nothing here grants an extra burn.
  { id: 'downturn', name: 'Downturned Shoes', slot: 'shoes', dPowerHand: 1, dContact: -2,
    text: '+1 Power to hand moves. −2 Contact to everything.' },
  { id: 'flat', name: 'Flat-Lasted Shoes', slot: 'shoes', dContact: 1,
    text: '+1 Contact to every move. All-day comfort.' },
  { id: 'sticky', name: 'Fresh Rubber', slot: 'shoes', dPowerFeet: 1,
    text: '+1 Power to foot moves.' },
  { id: 'slipper', name: 'Soft Slippers', slot: 'shoes', dSupport: 1,
    text: '+1 Support from the feet lane.' },
  { id: 'liquid', name: 'Liquid Chalk', slot: 'chalk', shedPerTurn: 1,
    text: 'Shed 1 pump at the end of every turn.' },
  { id: 'ball', name: 'Chalk Ball', slot: 'chalk', drawFirst: 2,
    text: 'Draw 2 extra on the first turn of a burn.' },
  { id: 'anti', name: 'Antihydral', slot: 'chalk', dContact: 1,
    text: '+1 Contact to every move. Skin holds up.' },
  { id: 'loose', name: 'Loose Chalk', slot: 'chalk', handSize: 1,
    text: '+1 card in hand, every turn.' },
  { id: 'brush', name: 'Wire Brush', slot: 'kit', brushFirst: true,
    text: 'The first hold of every burn comes brushed clean.' },
  { id: 'pads', name: 'Crash Pads', slot: 'kit', skinSave: 1,
    text: 'The first fall on each boulder costs no skin.' },
  { id: 'tape', name: 'Tape Gloves', slot: 'kit', dContact: 1,
    text: '+1 Contact to every move.' },
  { id: 'nuttool', name: 'Nut Tool', slot: 'kit', dPowerHand: 1, dContact: -1,
    text: '+1 Power to hand moves. −1 Contact to everything.' },
]
export const gearById = (id: string) => GEAR.find(g => g.id === id)

/* CARD-7. One-shot kit. Gear is a rule you carry for the whole run; a
   consumable is a single use you spend when it counts — bought at a post,
   capped, and gone once used. It rides its own shop line and its own
   inventory, so it never displaces a card offer, and the drafting harness
   (which values cards) never touches it: a cash sink for the player, not a
   lever on the balance band. Effects are deliberately mild and one-shot; the
   post is once a stage, so it cannot be farmed. */
export type Consumable = {
  id: string; name: string; text: string
  shed?: number; draw?: number; powerAll?: number
  /** CARD-9: extra burns. A `burn` consumable does nothing mid-climb — it is
      spent at the fall, to buy another go on this boulder (`secondWindStep`). */
  burn?: number
  /** CARD-14: three one-shots the four-item stub was missing — a grip-cut that
      eases the whole wall, a skin repair, and a psyche restore. All mid-climb,
      all off the band (the drafting sim never buys or spends kit). */
  gripCut?: number; skin?: number; psyche?: number
}
export const CONSUMABLES: Consumable[] = [
  { id: 'chalkshot', name: 'Chalk Shot', shed: 5,
    text: 'A big scoop when you need it. Shed 5 pump.' },
  { id: 'betanapkin', name: 'Beta Napkin', draw: 2,
    text: 'Somebody sketched the moves for you. Draw 2.' },
  { id: 'cruxpad', name: 'Crux Pad', powerAll: 2,
    text: 'Slid under the crux. +2 Power to every lane you have out, this turn.' },
  { id: 'secondwind', name: 'Second Wind', burn: 1,
    text: 'Chalk up, shake out, tie back in. One more burn on this line.' },
  // CARD-14
  { id: 'tickstick', name: 'Tick Stick', gripCut: 2,
    text: 'Chalk the holds you can reach. −2 Grip to every hold on the wall.' },
  { id: 'skinsalve', name: 'Skin Salve', skin: 3,
    text: 'Tape and time. Patch your tips — +3 skin.' },
  { id: 'peptalk', name: 'Pep Talk', psyche: 1,
    text: 'Somebody talks you back onto it. +1 psyche.' },
]
export const consumableById = (id: string) => CONSUMABLES.find(k => k.id === id)
export const KIT_MAX = 2
/* SAVE-6. The larder is the only array in the save that grows in NORMAL PLAY without a
   ceiling: `bankDaily` appends a kit item every time the streak ladder pays one, and the
   only thing that shrinks it is starting a trip and being handed some. Keep a habit up for
   months and never tie in, and it grows for ever. Six trips' worth is more banked kit than
   anyone will spend; past that the oldest is simply not kept.
   It lives HERE, under KIT_MAX, and not up with the other save caps — written there it read
   `KIT_MAX * 6` two thousand lines before KIT_MAX exists, and esbuild hoists the declaration
   rather than throwing, so it silently evaluated to NaN. `slice(-NaN)` returns the whole
   array, so the cap did nothing at all. That is SAVE-5's exact failure mode (`xp: undefined`
   -> NaN -> frozen levelling) reproduced inside the fix for it, which is why every cap is
   now asserted to be a finite positive number. */
export const LARDER_MAX = KIT_MAX * 6

/** Spend a consumable: apply it and take it out of the kit. The one shared
    path for the screen (and any policy), the SIM-5 rule — nothing that plays a
    consumable reimplements what it does. */
export function useKitStep(s: GameState, id: string, rng: RNG): GameState {
  const k = consumableById(id)
  const i = s.kit.indexOf(id)
  if (!k || i < 0) return s
  // CARD-9: a burn consumable has no mid-climb effect — it is spent at the fall
  // (secondWindStep). Refuse it here so a mis-tap during the climb cannot waste it.
  if (k.burn && !k.shed && !k.draw && !k.powerAll && !k.gripCut && !k.skin && !k.psyche) return s
  const kit = s.kit.slice(); kit.splice(i, 1)
  let pump = s.pump, piles = s.piles, skin = s.skin, psyche = s.psyche
  const boardP = s.boardP.slice(), boardH = s.boardH.slice(), log: string[] = []
  if (k.shed) { pump = Math.max(0, pump - k.shed); log.push(`${k.name}. −${k.shed} pump.`) }
  if (k.draw) { piles = pileDraw(piles, k.draw, rng); log.push(`${k.name}. Draw ${k.draw}.`) }
  if (k.powerAll) {
    for (let j = 0; j < 3; j++) if (boardP[j]) boardP[j] = { ...boardP[j]!, power: boardP[j]!.power + k.powerAll }
    log.push(`${k.name}. +${k.powerAll} Power everywhere.`)
  }
  // CARD-14: soften the whole wall / patch skin / steady the head
  if (k.gripCut) {
    for (let j = 0; j < 3; j++) if (boardH[j]) boardH[j] = { ...boardH[j]!, grip: Math.max(1, boardH[j]!.grip - k.gripCut) }
    log.push(`${k.name}. −${k.gripCut} Grip to every hold.`)
  }
  if (k.skin) { skin = Math.min(RUN_SKIN + styleMods(s.style).skin, skin + k.skin); log.push(`${k.name}. Skin patched.`) }
  if (k.psyche) { psyche = Math.min(psycheMax(s), psyche + k.psyche); log.push(`${k.name}. +${k.psyche} psyche.`) }
  return { ...s, kit, pump, piles, boardP, boardH, skin, psyche,
    peakPump: Math.min(PUMP_MAX, Math.max(s.peakPump, pump)), log: [...s.log, ...log] }
}

/* CARD-9. Second wind — the extra-burn consumable. This is the ONE new rule:
   spending it raises this boulder's attempt cap by lighting `bonusBurns`, which
   `attemptsFor` reads. Everything else — the skin the fall costs, starting the
   next burn — is the ordinary retry the caller already runs, so the moment the
   cap goes up the existing "out of burns?" check simply says no. It is spent at
   the fall (the screen and the harness both call this, then take their normal
   retry path), and `bonusBurns` is per-boulder: startBurn clears it on a fresh
   line, so a second wind buys a go on THIS route and never carries over. */
export function secondWindStep(s: GameState, id: string): GameState {
  const k = consumableById(id)
  const i = s.kit.indexOf(id)
  if (!k || !k.burn || i < 0) return s
  const kit = s.kit.slice(); kit.splice(i, 1)
  // BAL-15: the next burn is a wind burn — you get the go, but not a fresh body
  return { ...s, kit, bonusBurns: (s.bonusBurns ?? 0) + k.burn, windBurn: true,
    log: [...s.log, `${k.name}. One more burn — ${s.burn + 1} of ${attemptsFor(s) + k.burn}.`,
      'Back on, but you have been fighting a while.'] }
}

/* ======================= THE FORECAST ==============================
   Conditions used to be rolled the moment you committed, which made a
   57-96% swing invisible. Derived instead as a pure function of the run
   seed, act, tier and node — so it can be shown on the map, and stays
   stable across re-renders without consuming the run RNG.            */
/* ROUTE-9: each act climbs in its own weather. Conditions used to be rolled
   uniformly and act-agnostic, so the desert could come up freezing-drizzle and
   the alpine hot-sun — the forest/desert/alpine identity was just a background.
   These palettes (indices into WEATHER / ROCK, weighted by repetition) give
   each act a climate: a mild forest, a hot dry desert, a cold wet alpine.
   Every weather and rock is still reachable somewhere across the campaign.
   The forecast is derived from an ISOLATED per-node RNG (never the run stream),
   so keying the palette to the act shifts no guard by stream drift — only the
   completion band, via difficulty, tuned to stay put: a kinder forest offsets
   the harsher desert, and the alpine being hardest reinforces the
   acts-get-deadlier guard rather than fighting it. */
const ACT_WEATHER: number[][] = [
  [0, 0, 1, 1, 1, 2, 2, 5],       // forest: crisp & still, some humid, a little seep
  [3, 3, 3, 1, 1, 0, 0, 2],       // desert: hot sun, dry stillness, cold mornings
  [4, 4, 4, 5, 5, 5, 0, 0, 1],    // alpine: freezing & drizzle, the odd crisp day
]
const ACT_ROCK: number[][] = [
  [1, 0, 3],                      // forest: sandstone, granite, gneiss
  [1, 1, 2, 4],                   // desert: sandstone, limestone, basalt
  [0, 3, 4],                      // alpine: granite, gneiss, basalt
]
export function forecastFor(s: GameState): { weather: number; rock: number }[] {
  const nodes = ACTS[s.act]?.[s.tier] ?? []
  const wp = ACT_WEATHER[s.act], rp = ACT_ROCK[s.act]
  return nodes.map((_, i) => {
    const h = ((s.seed ^ (s.act * 7919) ^ (s.tier * 104729)
      ^ (i * 1299709) ^ (s.reroll * 2654435761)) >>> 0)
    const r = new RNG(h)
    return {
      weather: wp ? wp[r.int(wp.length)] : r.int(WEATHER.length),
      rock: rp ? rp[r.int(rp.length)] : r.int(ROCK.length),
    }
  })
}
/** Rough read on whether a forecast is kind, for the map's colour. */
export function forecastScore(f: { weather: number; rock: number }): number {
  const w = WEATHER[f.weather]
  return -w.dBite * 2 + w.dContact - (w.sloperGrip > 0 ? 2 : 0)
}
/** Sum of everything you are carrying. */
export function gearMods(ids: string[]): Required<Omit<Gear, 'id' | 'name' | 'slot' | 'text' | 'brushFirst'>> & { brushFirst: boolean } {
  const m = { dPowerHand: 0, dPowerFeet: 0, dContact: 0, dSupport: 0,
    shedPerTurn: 0, drawFirst: 0, handSize: 0, attempts: 0, skinSave: 0, brushFirst: false }
  for (const id of ids) {
    const g = gearById(id); if (!g) continue
    m.dPowerHand += g.dPowerHand ?? 0; m.dPowerFeet += g.dPowerFeet ?? 0
    m.dContact += g.dContact ?? 0; m.dSupport += g.dSupport ?? 0
    m.shedPerTurn += g.shedPerTurn ?? 0; m.drawFirst += g.drawFirst ?? 0
    m.handSize += g.handSize ?? 0; m.attempts += g.attempts ?? 0
    m.skinSave += g.skinSave ?? 0; m.brushFirst = m.brushFirst || !!g.brushFirst
  }
  return m
}
/** Three offers, one per slot where possible, never a duplicate slot you filled. */
export function stockShop(s: GameState, rng: RNG): GameState {
  const cards = rollOffers(rng, 3, false, s.act)
  const gp = GEAR.filter(g => !s.gear.includes(g.id))
  const bp = BOONS.filter(b => !s.boons.includes(b.id))
  // a post sells kit, and sometimes somebody is selling beta
  const stock: string[] = []
  if (gp.length) stock.push(gp[rng.int(gp.length)].id)
  if (bp.length && rng.next() < 0.5) stock.push(bp[rng.int(bp.length)].id)
  // CARD-7: one consumable on the shelf, on its own line. The screen greys it
  // out and blocks the buy once your kit is full (KIT_MAX), so the shelf can
  // always show one without letting you overfill. Which one is picked from the
  // stage rather than the run RNG ON PURPOSE — drawing from the shared stream
  // here would shift every downstream roll and move the balance guards for no
  // real reason (the harness never buys kit). Deterministic, zero perturbation.
  const kitId = CONSUMABLES[(s.act * 3 + s.tier) % CONSUMABLES.length].id
  return { ...s, shopCards: cards, shopGear: stock, shopKit: [kitId], bought: [], phase: 'shop' }
}
export const priceOf = (c: Card) =>
  c.rarity === 'rare' ? PRICE.rare : c.rarity === 'uncommon' ? PRICE.uncommon : PRICE.common

/** Three finds, gear and boons competing for the same slot — so taking a
    rule-breaker means going without the shoes. */
export function gearOffers(s: GameState, rng: RNG): string[] {
  const held = new Set(s.gear.map(id => gearById(id)?.slot))
  const gearPool = GEAR.filter(g => !s.gear.includes(g.id))
  const fresh = gearPool.filter(g => !held.has(g.slot))
  const gearUse = (fresh.length >= 2 ? fresh : gearPool).map(g => g.id)
  const boonUse = BOONS.filter(b => !s.boons.includes(b.id)).map(b => b.id)
  const out: string[] = []
  // one boon guaranteed when any remain, so a rule-breaker is always on offer
  if (boonUse.length) out.push(boonUse[rng.int(boonUse.length)])
  const bag = [...gearUse, ...boonUse.filter(b => !out.includes(b))]
  while (out.length < 3 && bag.length) {
    const pick = bag.splice(rng.int(bag.length), 1)[0]
    if (!out.includes(pick)) out.push(pick)
  }
  return rng.shuffle(out)     // position must not imply a recommendation
}
export const isBoon = (id: string) => !!boonById(id)

/* ======================== CONTENT: DIALOGUE =======================
   Camps had a rest button and nothing else. These are the people you
   meet at the fire. Marge's thread is the spine — she was his partner. */
export type Talk = {
  id: string; who: string; act: number; after?: string
  /* NARR-17. This was `needsPage: n` — a gate on ONE NAMED PAGE — and it deadlocked the
     story. `marge4` asked for page 4, which is SEVENTH in delivery order because the
     journal is interleaved on purpose (1, 8, 2, 9, 3, 10, 4, ...), so it wanted seven
     page grants. Ten of the fourteen grants in the game live inside the Marge chain that
     page 4 unblocks, and the only supply from outside it is four events reached through
     one map node. Measured over 200 careers of ten expeditions: `marge4` through
     `marge8` fired in 0.0% of them, the talks plateaued at 15 of 20 by trip six and never
     moved again, and the "known" epilogue never happened once in 673 wins.

     A gate on a COUNT cannot deadlock: any page satisfies it, so the supply is never
     downstream of the gate. It is also what the scene means — she recognises his
     handwriting on a page you brought back, and it does not matter which page it is. */
  needsPages?: number
  /* The one gate that really is about a specific page: you have been to the top and read
     what he left there. Named rather than spelled `needsPage: 7`, because "he wrote this
     at the summit" is the whole reason and the number said none of it. */
  needsSummit?: boolean
  text: string
  /* NARR-12: a reply with `arch` set is that climber's line — it shows only to
     them. Flavour only (never an `outcome`), so who you are changes the
     conversation, never the reward or the balance. */
  replies: { label: string; text: string; outcome?: EventOutcome; arch?: string }[]
}
/* NARR-14. Thirty-seven routes and nobody belayed. The game had a spotter (coaching,
   which is a hint system wearing a person) and it had TALKS (people you meet once and
   leave behind), but nothing that was WITH you — so a trip that is meant to read as an
   expedition read as a solo campaign with dialogue in it.

   A partner is not a stat. Everything here is text, which is deliberate rather than
   lazy: ROUTE-10 and ENG-24 both established that this project pays narrative in
   INFORMATION and never in power, and after four on-band tickets in a row the last
   thing the ledger needs is a fifth. So a partner cannot make you better at climbing.
   What they can do is have an OPINION — each of them would go a particular way up, they
   say so before you choose, and they have something to say about it afterwards whether
   you took their advice or not. That is the whole mechanic: somebody who wanted
   something different from what you did.

   WHO YOU GET IS DERIVED FROM THE RUN SEED, not stored. UX-5's contract is that a run
   is fully determined by its starting seed, so a shared seed has to hand the other
   person the same partner; deriving it also means no new save field to drift and no
   chance of a reload changing who is standing there. */
export type PartnerMoment = 'tie' | 'agree' | 'differ' | 'send' | 'fall' | 'camp' | 'top' | 'died'
  /* SKIRM-7: the Circuit has no line choice and no camp, so `tie` and `camp` never
     fire there — but it has a decision no other mode has, which is whether to go
     again. These are the two things they say to that. */
  | 'again' | 'enough'
  /* NARR-15: four moments the game had already built and left them silent through.
     `walked` closes the loop SKIRM-7 opened and SKIRM-8 gave a screen: they spend the
     whole circuit telling you to go again or to stop, and when you stopped they said
     nothing. `claim` is the sharpest of the four — the FA screen's own words are
     "nothing to compare it to and NOBODY TO ASK", and there is somebody standing
     right there with an opinion about your grade. `curse` is a decision they would
     obviously have a view on, taken on a screen that offers it in as many words.
     `phase` is the one that goes in the climb log rather than on a screen, and it is
     kept to one clause because it lands mid-move; only four routes have phases at
     all, so it stays a moment rather than a drumbeat. */
  | 'walked' | 'claim' | 'curse' | 'phase'
  /* And a fifth the backlog row did not list, found by reading the screens rather than
     the row: the Circuit has TWO endings and both were silent. Walking off goes to
     `sessionEnd`; running out of skin goes to `runEnd`, which renders CIRCUIT OVER and
     whose partner block is gated `!st.circuit` — correctly, because `top` and `died`
     are trip lines and a circuit is not a trip. So the mode's ordinary ending, which is
     the one most sessions get, had nobody in it at all. */
  | 'spent'
export type Partner = {
  id: string
  name: string
  /** Who they are, in one line, for the screen that introduces them. */
  who: string
  /** Which of the three lines they would take. Their opinion, and nothing more. */
  line: number
  /* SKIRM-7: the circuit score from which THIS person would rather you walked off.
     A fixed per-partner push would be static — Kit always says go, Ade always says
     stop — and deriving it from the zone alone would make it the game's opinion
     rather than theirs. A threshold is both: the same person says go early and
     enough later, and where that line falls is who they are. */
  enough: number
  says: Record<PartnerMoment, string>
}
export const PARTNERS: Partner[] = [
  { id: 'wren', name: 'Wren', who: 'Belays like she is being timed. Has opinions about your feet.', line: 1,
    enough: 10,
    says: {
      again: 'She is already pulling the rope through. "One more. You are climbing well and it will not last."',
      enough: '"That is the good one to stop on." She starts coiling before you answer.',
      tie: 'She flakes the rope without being asked. "Straight up it, if you have any sense."',
      agree: '"Good. I hate traversing." She sits down and watches your feet, not your hands.',
      differ: '"Fine. I will be here." She does not look up from her book until you are off the ground.',
      send: '"There you go." She says it like she never doubted it, which is a kindness and a lie.',
      fall: '"Feet." One word, and she is right, and you both know it.',
      camp: 'She eats standing up and goes to bed early. "Tomorrow you go first."',
      top: '"Well." She shakes your hand, formally, like a stranger. Then she laughs at herself.',
      died: 'She carries the pads down without saying anything. At the car: "Next time you go first."',
      walked: '"Good. Stop while it is still the good one." She is coiling before she has finished the sentence.',
      claim: '"Do not be modest, it is a waste of everybody\u2019s time." A beat. "Do not be the other thing either."',
      curse: '"Two for one and you carry the difference." She has watched people do this before.',
      phase: 'Wren, from below: "It changes here. You knew that."',
      spent: 'She turns your hand over and looks at it. "Right. Done." She does not make it a defeat.',
    } },
  { id: 'ade', name: 'Ade', who: 'Been coming here thirty years. Knows where the water is.', line: 0,
    enough: 6,
    says: {
      again: '"Go on then, while it is cool." He does not get up.',
      enough: '"You have had the best of the day." He is looking at the light, not at you.',
      tie: '"The book has it right, you know. People forget the book was written by somebody who was here."',
      agree: '"Sensible." He settles in with the flask and does not offer you any.',
      differ: '"Hm." He watches you go the other way and says nothing at all, which is worse.',
      send: '"That is the line." He is pleased about the LINE, which is somehow better than being pleased for you.',
      fall: '"It goes. Not like that, but it goes." He is already thinking about the sequence.',
      camp: 'He tells you about a winter here in the nineties. Half of it cannot be true.',
      top: '"I will put it in the book." From him this is an enormous thing to say.',
      died: '"Thirty years I have been failing on things here." He means it to be comforting, and it is.',
      walked: '"That will do." He has the flask out already. The light is going off the top of the crag.',
      claim: '"Whatever you put, somebody will repeat it and disagree. That is the grade working." He is not warning you.',
      curse: '"You will be carrying that in November." He says it mildly, which is how he says everything.',
      phase: 'Ade, not looking up: "This is the bit people forget about."',
      spent: '"Skin is the only thing out here you cannot buy." He has said this before and will say it again.',
    } },
  { id: 'moss', name: 'Moss', who: 'Would rather be looking at the rock than climbing it.', line: 2,
    enough: 3,
    says: {
      again: '"If you must." He has found something in the scree and is not really listening.',
      enough: '"Right — come and see this instead." He has been waiting an hour to show you.',
      tie: '"There is a way round the side, you know. It is nicer over there."',
      agree: '"Oh good." He points out three things on the way that have nothing to do with climbing.',
      differ: '"Suit yourself." He wanders off left anyway and describes it to you while you are pumped.',
      send: '"Did you see the quartz band? No. You would not have." He is not disappointed in you.',
      fall: '"That hold is a fossil, you know. Whole animal." You are lying on the ground.',
      camp: 'He has collected four rocks and wants to talk about all of them.',
      top: '"Good. Now can we go and look at the other side." He has wanted to all week.',
      died: '"Shame." He is already photographing something in the moss.',
      walked: '"Finally." He has been standing by something he wants you to look at for about an hour.',
      claim: '"Call it what the rock is." He means it literally, and it is not bad advice.',
      curse: '"Is that the one that hurts?" He has not been following. He is not going to start now.',
      phase: 'Moss, delighted: "That is a different bed of rock, that is."',
      spent: '"You have gone through to the pink." He sounds interested rather than sympathetic.',
    } },
  { id: 'kit', name: 'Kit', who: 'Nineteen, terrifyingly strong, no idea how lucky that is.', line: 1,
    enough: 14,
    says: {
      again: '"Go again go again go again." It is not a question and she is not tired.',
      enough: '"Wait, we are stopping? Oh." She gets over it in about four seconds.',
      tie: '"Just go up it? Why would you not just go up it." Genuine question.',
      agree: '"Obviously." She is already thinking about the next one.',
      differ: '"Weird flex but okay." She spots you properly, though, which she does not have to.',
      send: '"Was that hard? That looked hard." She is not being cruel. That is the problem.',
      fall: '"Ohhh. Yeah. Go again?" It has not occurred to her that you might not.',
      camp: 'She is asleep before the water boils and up before you.',
      top: 'She screams. Genuinely screams, at a wall, in the dark. It is the best moment of the trip.',
      died: '"Same time next year?" She has already forgotten which one beat you.',
      walked: '"That was ages." It was not ages. She is already looking at what is next to it.',
      claim: '"That is soft for the grade." She has climbed it zero times and is completely certain.',
      curse: '"Free card!" She does not appear to have read the other half of the sentence.',
      phase: 'Kit, brightly: "Oh, it does a thing here."',
      spent: '"Tape?" She has tape. She always has tape. It is not going to be enough.',
    } },
]
/** Who is out with you. Derived from the run seed — see the note above. */
export function partnerFor(s: GameState): Partner | null {
  /* SKIRM-7: the Circuit was the least-served mode in the game — it runs
     `inRun: false`, so it got no partner and no ambience while every other mode
     got both. It is also the LONGEST single sitting there is, which is the mode
     that most wants somebody there. Its `runSeed` is saved and restored with the
     rest of the circuit (DEV-3), so resuming one keeps the same person. */
  /* NARR-15: `result: 'walked'` counts as well, and finding out why cost a browser.
     SKIRM-8 clears `circuit` on the way out of a walk-off so a stale score can never be
     read as "this was a circuit" (MODE-1) — which means that by the time the walk-off
     SCREEN renders, the two flags above are both false and this returned null. The
     screen's own gate was written not to read `circuit` for exactly that reason, and
     then called this, which read it for us. `result` is per-run and reset to null at
     every start, so it cannot leak into the next attempt the way a mode flag could. */
  if (!s.inRun && !s.circuit && s.result !== 'walked') return null
  return PARTNERS[(s.runSeed >>> 0) % PARTNERS.length]
}
/** SKIRM-7: whether they would go again or walk off — their opinion, nothing more.
    RUN-13 established that walking off is the GOOD circuit outcome and that nothing
    in the game ever said so; somebody saying it is the cheapest honest way to. */
export function partnerPush(s: GameState): 'again' | 'enough' | null {
  const p = partnerFor(s)
  if (!p || !s.circuit) return null
  return s.circuitScore >= p.enough ? 'enough' : 'again'
}
/** What they have to say about a moment, or '' if nobody is there. */
export function partnerSays(s: GameState, m: PartnerMoment): string {
  const p = partnerFor(s)
  return p ? p.says[m] : ''
}
/** Did you go their way? Only meaningful once a line is chosen. */
export const partnerAgrees = (s: GameState, line: number) => {
  const p = partnerFor(s)
  return p ? p.line === line : false
}

export const TALKS: Talk[] = [
  { id: 'marge1', who: 'Marge', act: 0,
    text: 'You are the one asking about the drainage. I have had four of you this year. Two of them were journalists.',
    replies: [
      { label: 'I am not a journalist.', text: 'She looks at your hands. "No. You are not." She goes back to the fire.' },
      { label: 'Did you know him?', text: '"Twenty-two years." That is all she says for a while.' },
    ] },
  { id: 'marge2', who: 'Marge', act: 0, after: 'marge1',
    text: 'He did not tell me where it was. Twenty-two years and he did not tell me. I have decided that was kindness and not cowardice, most days.',
    replies: [
      { label: 'Most days.', text: '"Most days." She almost laughs. Later she comes back with a page out of a box in the van and does not say anything about it.', outcome: { journal: 0 } },
      { label: 'Why would that be kind?', text: '"Because I would have gone up there after him. And I would still be up there."' },
    ] },
  { id: 'marge3', who: 'Marge', act: 1, after: 'marge2',
    text: 'I looked for two seasons. Walked every drainage on the north side with a photocopy of a survey photo. You know what I found? Good bouldering. That is all.',
    replies: [
      { label: 'You stopped.', text: '"I stopped. That is allowed." She feeds the fire.', outcome: { skin: 1 } },
      { label: 'I could bring something back.', text: '"Bring yourself back. Start there."', outcome: { skin: 2 } },
      { label: 'You do not stop. You come down and go back up.', text: 'She looks at your frostbitten kit and goes very still. "That is exactly what he used to say. It was not a compliment then either."', arch: 'alpine' },
    ] },
  /* NARR-17: was `needsPage: 4`, the seventh page in delivery order and the reason
     nobody has ever seen this line. Three of his pages is a real gate — she is reacting
     to a body of handwriting, not to one scrap — and it clears on the default policy. */
  { id: 'marge4', who: 'Marge', act: 1, after: 'marge3', needsPages: 3,
    text: 'That is his hand. I would know it upside down in the rain. Where.',
    replies: [
      { label: 'Under a cairn, well off the trail.', text: 'She reads it four times. Then she gives it back. "Keep it. It is beta now, not a letter."', outcome: { journal: 0 } },
    ] },
  { id: 'marge5', who: 'Marge', act: 2, after: 'marge4',
    text: 'North side of the third drainage, above the moraine. There is a wall you cannot see from the valley and he never once drew it in the margin, which is how I know.',
    replies: [
      { label: 'Come with me.', text: '"No." A long pause. "Take the cams. He would want them up there and not in my shed."', outcome: { cardRarity: 'rare' } },
      { label: 'Thank you.', text: '"Do not thank me. Come back down."', outcome: { journal: 0 } },
    ] },
  { id: 'marge6', who: 'Marge', act: 0, after: 'marge5', needsSummit: true,
    text: 'You have got that look. The one he used to come back with.',
    replies: [
      { label: 'I found it. He did it first.', text: '"Of course he did." She is quiet for a long time. "Thirty years I have been angry at a man for dying on something he had already climbed." She laughs, once, and it is not really a laugh.' },
      { label: 'Say nothing.', text: 'She looks at you, and then at the fire, and does not ask again. Some of it she works out anyway.', outcome: { journal: 0 } },
    ] },
  { id: 'marge7', who: 'Marge', act: 0, after: 'marge6',
    text: 'One thing. Did he name it?',
    replies: [
      { label: 'He left that to whoever came next.', text: '"Then it is yours." She hands you the coffee. "Do not put your own name on it either. He would think that was hilarious and he would be right."', outcome: { psyche: 2 } },
    ] },
  { id: 'dale1', who: 'Dale', act: 0,
    text: 'Everybody wants the ghost story. Nobody wants to hear he was a bit of a show-off who left his rubbish at the crag.',
    replies: [
      { label: 'Was he strong?', text: '"Strongest I ever saw. That is the boring part of it."' },
      { label: 'Did you like him?', text: 'Long pause. "I did, actually. That is the annoying part of it."', outcome: { journal: 0 } },
      { label: 'Gym strong, or rock strong?', text: '"Ha." He studies your downturned shoes. "Both, and he would have hated that you asked. A gym rat who could actually climb. Like someone else I am looking at."', arch: 'comp' },
    ] },
  { id: 'dale2', who: 'Dale', act: 1, after: 'dale1',
    text: 'He used to say a grade is just a rumour that got organised. Drove the guidebook people mad.',
    replies: [
      { label: 'He was not wrong.', text: '"He was not wrong. He was insufferable about it."', outcome: { xp: 8 } },
      { label: 'Sounds like an excuse.', text: '"It was. He was also the only one who could back it up."', outcome: { journal: 0 } },
      { label: 'A grade is a conversation, not a number.', text: 'He looks at your rack of tat and old cams. "Now you sound like him. That is not a warning, exactly. But watch yourself."', arch: 'trad' },
      { label: 'You only really know a grade first try.', text: '"He said that too." Dale almost winces. "Right before he sandbagged half the valley. Careful whose habits you pick up."', arch: 'onsight' },
    ] },
  { id: 'dale3', who: 'Dale', act: 2, after: 'dale2',
    text: 'If you find it and it is not as hard as he said, you keep that to yourself. Let him have the one thing.',
    replies: [
      { label: 'And if it is harder?', text: '"Then you tell everyone. Loudly. He would have."', outcome: { cardRarity: 'uncommon', journal: 0 } },
    ] },
  { id: 'nita1', who: 'Nita', act: 0,
    text: 'Honest question. Do you actually believe there is a wall up there, or is this a nice long walk with a story attached?',
    replies: [
      { label: 'I believe the survey photo.', text: '"A photo of a shadow." She shrugs. "Fine. It is a nice walk."' },
      { label: 'It is a nice long walk.', text: 'She laughs, properly. "Okay. Now I like you."', outcome: { xp: 6 } },
      { label: 'The walk is the point. So is the rack.', text: 'She eyes the nuts and slings hanging off you. "Oh, you are one of the old ones. He would have talked your ear off at this fire and enjoyed every minute."', arch: 'trad' },
    ] },
  { id: 'nita2', who: 'Nita', act: 1, after: 'nita1',
    text: 'I climb harder than he did. On plastic. I know exactly what that sentence is worth, before you say it.',
    replies: [
      { label: 'It is worth something.', text: '"It is worth something on plastic." She is quiet a moment. "Show me the pages."', outcome: { cardRarity: 'uncommon' } },
      { label: 'Say it out loud again.', text: 'She does. It sounds smaller the second time and she knows it.', outcome: { journal: 0 } },
      { label: 'I climb harder than him too. On plastic.', text: 'She looks at you properly for the first time. "Then we already understand each other." A pause. "It still does not count up here. But show me the pages."', arch: 'comp' },
      { label: 'I would not know. I do not rehearse.', text: '"An onsighter." She shakes her head. "On his rock, first try? That is not confidence, that is a comedy. Good luck."', arch: 'onsight' },
    ] },
  { id: 'nita3', who: 'Nita', act: 2, after: 'nita2',
    text: 'I found this wedged in a crack on the approach. I nearly used it for kindling before I read it.',
    replies: [
      { label: 'Let me see.', text: 'A page, water-stained, in the same hand as the rest.', outcome: { journal: 0 } },
    ] },
  { id: 'ellis1', who: 'Ranger Ellis', act: 1,
    text: 'Whatever you are doing up the third drainage, do it before the fifteenth. After that the road closes and I am not coming to get you.',
    replies: [
      { label: 'Understood.', text: 'He writes your plate down anyway. Fair enough.' },
      { label: 'What is up the third drainage?', text: '"Rock. Weather. A lot of both." He is already walking away.', outcome: { xp: 6 } },
      { label: 'The weather up there does not read your calendar.', text: 'Ellis stops. Looks at your rimed-up rack. "No. But I do, and the road still closes on the fifteenth. People like you are exactly who I write down."', arch: 'alpine' },
    ] },
  { id: 'ellis2', who: 'Ranger Ellis', act: 2, after: 'ellis1',
    text: 'We pulled a pack out of the moraine field in ninety-eight. No name in it. It is in a box in the office if you want to look at it.',
    replies: [
      { label: 'I want to look at it.', text: 'Rope, a rack, and a notebook with the last four pages torn out.', outcome: { journal: 0, xp: 10 } },
      { label: 'Leave it in the box.', text: '"That is probably the right answer." He does not sound sure.', outcome: { skin: 1 } },
    ] },
  { id: 'pim1', who: 'Pim', act: 0,
    text: 'Mate, your van is nicer than my van and my van has a bed in it. That is a serious accusation and I stand by it.',
    replies: [
      { label: 'It has a bed in it.', text: '"Then we are the same. Have some coffee."', outcome: { skin: 1 } },
      { label: 'It is not a nice van.', text: '"No. It is not." He seems relieved.', outcome: { cardRarity: 'common' } },
    ] },
  { id: 'pim2', who: 'Pim', act: 1, after: 'pim1',
    text: 'Everyone out here is looking for something. Mine is a shower. Yours seems harder to find.',
    replies: [
      { label: 'Yours sounds better.', text: '"Mine is achievable. That is the whole trick."', outcome: { skin: 1, xp: 6 } },
    ] },
  { id: 'pim3', who: 'Pim', act: 2, after: 'pim2',
    text: 'This is where I turn round. I have been very clear with myself about what I am and am not doing, and that wall is in the second category.',
    replies: [
      { label: 'Sensible.', text: '"It is. It is also the most boring thing about me." He leaves you the rest of his coffee and most of his tape.', outcome: { skin: 2, cash: 20, xp: 10 } },
      { label: 'You could come as far as the moraine.',
        text: 'He thinks about it longer than you expected. "No. But ask me again next year." He means it, which is worse.', outcome: { psyche: 1, xp: 14 } },
    ] },
  { id: 'nita4', who: 'Nita', act: 2, after: 'nita3',
    text: 'I have been up on that face twice. Both times I came down and could not tell anybody why I had. It is not the difficulty. It is that it does not want anybody on it.',
    replies: [
      { label: 'And you think I should go anyway.',
        text: '"I think you are going anyway. I am telling you what it is like so it does not surprise you."', outcome: { psyche: 1, xp: 12 } },
      { label: 'That sounds like superstition.',
        text: 'She does not argue. "Come and find me after." Then, quieter: "Please come and find me after."', outcome: { xp: 16 } },
    ] },
  { id: 'marge8', who: 'Marge', act: 2, after: 'marge5',
    text: 'You have got the look he had the last week. I am not going to talk you out of it. I would like it on the record that I did not try.',
    replies: [
      { label: 'It is on the record.',
        text: '"Good." She puts something in your hand — a stub of chalk gone hard with age. "That was in his van. Do what you like with it."', outcome: { psyche: 1, xp: 18 } },
      { label: 'Would you have talked him out of it?',
        text: '"No." A long pause. "I have had twenty-two years to decide whether that was love or laziness. I still do not know."', outcome: { xp: 20 } },
    ] },
]

/* NARR-12: the replies this climber can actually give. An `arch` reply is that
   climber's own line and shows only to them; every player still sees the base
   replies. Flavour only — arch replies carry no `outcome` — so the specialist
   climbers (Comp Kid, Trad Dad, Alpinist, Onsighter) show up in the story
   without moving a single number. The Boulderer, the default and the sim's
   climber, is the everyclimber and gets no gated line, so the guarded runs are
   untouched. */
export const repliesFor = (t: Talk, s: GameState) =>
  t.replies.filter(r => !r.arch || (s.inRun && archOf(s).id === r.arch))

/* FA-1c. You name a line and grade it, and until now nobody said a word about
   it. Grading is a social act — undergrading and overgrading are both claims
   about yourself — and there is a whole cast standing at the fire. */
export function faTalk(s: GameState): Talk | null {
  // she refers to him, so you have to have met her first
  if (!s.seen.includes('marge1')) return null
  const line = s.established.find(e => !s.seen.includes('fa:' + e.name))
  if (!line) return null
  return faTalkFor(line, s.act)
}
/** Marge's first reaction to a line you just put up, for one specific line. */
export function faTalkFor(line: Established, act: number): Talk {
  const d = line.claimed - line.real
  const id = 'fa:' + line.name
  if (d <= -2) return { id, who: 'Marge', act,
    text: `"${line.name}." She says it like she is trying it out. "Somebody came down off that `
      + `saying it was V${line.claimed}. It is not V${line.claimed}." A pause. "He used to do that too."`,
    replies: [
      { label: 'It felt like V' + line.claimed + '.', outcome: { psyche: -1 },
        text: '"It did not." She lets it sit. "You do not have to be hard about it. Nobody is keeping score but you."' },
      { label: 'I got it wrong.', outcome: { psyche: 1 },
        text: '"You got it wrong on the low side, which is the only honest way to get it wrong." She refills your cup.' },
    ] }
  if (d >= 2) return { id, who: 'Marge', act,
    text: `"${line.name}, V${line.claimed}." She does not look up. "Two people have been on it since. `
      + `They both came down laughing." She pokes the fire. "It will get downgraded. They always do."`,
    replies: [
      { label: 'It was hard for me.', outcome: { psyche: 1 },
        text: '"Then say that. That is a different sentence and nobody would argue with it."' },
      { label: 'Let them downgrade it.', outcome: {},
        text: '"They will." She sounds almost fond. "The name will stick, though. The name always sticks."' },
    ] }
  return { id, who: 'Marge', act,
    text: `"${line.name}." She turns the name over. "V${line.claimed}. That is what it is, near enough. `
      + `You would be surprised how rare that is." She hands you the cup without being asked.`,
    replies: [
      { label: 'It is only a number.', outcome: {},
        text: '"It is a number you gave a thing that did not have one. That is not nothing."' },
      { label: 'Thank you.', outcome: { psyche: 1 },
        text: 'She waves it off, but she writes the name down in the back of something, and does not show you.' },
    ] }
}

/* NARR-13. You name and grade a first ascent — the game's namesake act — and
   the cast reacts once, the evening you come down. Then the line went silent
   forever: `fa:<name>` sat in `seen` and never recurred, so a claim nobody could
   test over time was exactly the thing time never touched. A grade is a claim
   others repeat and re-grade; this brings the line back a trip LATER with the
   consensus. Deterministic from the drift you already stored (claimed vs real),
   fired only in a later expedition (`run` stamped at the claim). No new node, no
   RNG, no touch to the campaign path — flavour, off the band. */
export function consensusTalkFor(line: Established, act: number): Talk {
  const d = line.claimed - line.real
  const id = 'con:' + line.name
  if (d < 0) return { id, who: 'Marge', act,
    text: `"Your ${line.name}." She almost smiles. "Two people repeated it while you were gone. `
      + `Both came down cursing your name — the consensus is V${line.real}, a grade stiffer than you `
      + `called it." A pause. "A sandbag ages well. People remember who undersold them."`,
    replies: [
      { label: 'I graded it honestly.', outcome: {},
        text: '"You graded it scared, which came out honest. It happens." She lets it sit.' },
      { label: 'Good.', outcome: { psyche: 1 },
        text: '"Good," she agrees. "Let them find out the hard way. That is the whole pleasure of it."' },
    ] }
  if (d > 0) return { id, who: 'Marge', act,
    text: `"That ${line.name} of yours." She does not look up. "Somebody flashed it. Then somebody else. `
      + `It is going in the book at V${line.real}, not the V${line.claimed} you put on it." She shrugs. `
      + `"I did tell you. The name sticks, though — that part you got right."`,
    replies: [
      { label: 'I called it as I found it.', outcome: {},
        text: '"You called it as you hoped. Different thing. No harm done — the rock does not keep grudges."' },
      { label: 'Fair enough.', outcome: { psyche: 1 },
        text: '"Fair enough," she echoes, and crosses out a number in the back of the book without ceremony.' },
    ] }
  return { id, who: 'Marge', act,
    text: `"${line.name} has had repeats." She turns the cup in her hands. "Nobody has argued the grade. `
      + `V${line.claimed} stands — they are climbing it and calling it exactly what you did." She nods, once. `
      + `"That is the rarest thing in this whole book. A number that held."`,
    replies: [
      { label: 'It felt right.', outcome: { psyche: 1 },
        text: '"It was right. There is a difference, and this time you were on the good side of it."' },
      { label: 'One out of how many.', outcome: {},
        text: '"One is one." She is not smiling now. "Most people put up a lifetime of lines and never get a single one square."' },
    ] }
}
export function consensusTalk(s: GameState): Talk | null {
  if (!s.seen.includes('marge1')) return null
  // a line only matures a trip later: its first reaction is spent (`fa:` seen),
  // this one has not fired (`con:` unseen), and it was put up on an earlier run
  const line = s.established.find(e => e.run !== undefined && s.runs > e.run
    && s.seen.includes('fa:' + e.name) && !s.seen.includes('con:' + e.name))
  return line ? consensusTalkFor(line, s.act) : null
}
/** Resolve any talk id — the static cast, or a dynamic line-of-yours id
    (`fa:`/`con:`). The screen stores only the id, so without this the dynamic
    talks (which are never in TALKS) resolved to nothing and dead-ended. */
export function talkById(s: GameState, id: string | null): Talk | null {
  if (!id) return null
  const stat = TALKS.find(t => t.id === id)
  if (stat) return stat
  if (id.startsWith('fa:')) {
    const line = s.established.find(e => 'fa:' + e.name === id)
    return line ? faTalkFor(line, s.act) : null
  }
  if (id.startsWith('con:')) {
    const line = s.established.find(e => 'con:' + e.name === id)
    return line ? consensusTalkFor(line, s.act) : null
  }
  return null
}

/** Is this conversation available right now?
 *
 *  NARR-17: this condition was written out TWICE — once in `postTalk` and once in
 *  `availableTalk` — which is one divergence away from a talk being reachable at the
 *  counter and not at the fire, or the other way round. It is the same shape NARR-16
 *  came from: one rule, spelled in two places, waiting for somebody to change one of
 *  them. Written once, and both callers ask it. */
export function talkOpen(t: Talk, s: GameState): boolean {
  return t.act <= s.act && !s.seen.includes(t.id)
    && (!t.after || s.seen.includes(t.after))
    && (t.needsPages === undefined || pagesHeld(s.journal) >= t.needsPages)
    && (!t.needsSummit || s.journal.includes(SUMMIT_PAGE))
}

/** A trading post has people in it. Somebody who has been out there is
    exactly who tells you something you did not know. */
export function postTalk(s: GameState): Talk | null {
  // Marge is at the fire, not behind a counter — her thread stays at camps.
  // This has to look PAST her rather than stop at her: she holds seven of the
  // seventeen and sits at the front of the queue, so filtering the first
  // available conversation returned nothing almost every time.
  return TALKS.find(t => t.who !== 'Marge' && talkOpen(t, s)) ?? null
}

export function availableTalk(s: GameState): Talk | null {
  // what you put your name to comes first — she has been waiting to say it
  const fa = faTalk(s)
  if (fa) return fa
  // then a line of yours that has matured since — the repeats, the consensus
  const con = consensusTalk(s)
  if (con) return con
  return TALKS.find(t => talkOpen(t, s)) ?? null
}

/** One beta card per journal page you carry. Finale only — this is why the
    pages were worth collecting. */
export const BETA_CARDS: Record<number, string> = {
  1: 'Beta · The Approach', 2: 'Beta · The Grade', 3: 'Beta · Conditions',
  4: 'Beta · Going Alone', 5: 'Beta · The Crux', 6: 'Beta · Last Entry',
  // NARR-11: the eight new pages. Page 7 is what you find at the top, so it
  // has never been a beta card and still is not — you read it after.
  8: 'Beta · The Photograph', 9: 'Beta · The Rock', 10: 'Beta · The Walk In',
  11: 'Beta · What He Told Her', 12: 'Beta · Being Frightened',
  13: 'Beta · The Traverse', 14: 'Beta · Waiting It Out',
  15: 'Beta · The Name',
}

/* A page grant used to name a specific page, which meant every page needed its
   own event branch and is why there were only ever six findable. An event can
   now ask for "the next one he wrote" and the pool does the rest. */
export function nextPage(s: GameState): number | null {
  const found = new Set(s.journal)
  const p = JOURNAL.find(j => j.id !== SUMMIT_PAGE && !found.has(j.id))
  return p ? p.id : null
}
/* You cannot carry the whole journal up there. Measured: seven pages is worth
   twelve points of completion and fourteen is worth the same — every beta card
   past the ones you need is a card you draw instead of a move, which is the
   same thing DECK-1 found from the other end. So the pages are the story and
   the ending; the beta you take onto the wall is capped. */
export const BETA_TAKE = 8
export function betaDeck(journal: number[]): Card[] {
  return journal.map(id => BETA_CARDS[id]).filter(n => n && CARDS[n])
    .slice(0, BETA_TAKE).map(spawn)
}

export function applyOutcome(s: GameState, o: EventOutcome, rng: RNG): GameState {
  let n: GameState = { ...s }
  if (o.skin) n.skin = Math.max(0, Math.min(RUN_SKIN, n.skin + o.skin))
  if (o.cash) n.cash = Math.max(0, n.cash + o.cash)
  if (o.psyche) n.psyche = Math.max(0, Math.min(psycheMax(n), n.psyche + o.psyche))
  if (o.boon) {
    const left = BOONS.filter(b => !n.boons.includes(b.id))
    if (left.length) n.boons = [...n.boons, left[rng.int(left.length)].id]
  }
  if (o.card) n.runDeck = [...n.runDeck, spawn(o.card)]
  if (o.cardRarity) {
    const pool = BY_RARITY(o.cardRarity)
    if (pool.length) n.runDeck = [...n.runDeck, spawn(pool[rng.int(pool.length)])]
  }
  if (o.curse) n.runDeck = [...n.runDeck, spawn(o.curse)]
  if (o.removeCard && n.runDeck.length > 10) {
    const i = rng.int(n.runDeck.length)
    n.runDeck = n.runDeck.filter((_, k) => k !== i)
  }
  if (o.journal !== undefined) {
    // NARR-11: 0 means "the next one he wrote", so all fourteen are reachable
    // rather than only the six that happened to have their own event branch.
    const id = o.journal === 0 ? nextPage(n) : o.journal
    if (id !== null && !n.journal.includes(id)) n.journal = [...n.journal, id]
  }
  if (o.xp) n = gainXp(n, o.xp, rng)
  return { ...n, eventResult: o.text ?? '' }
}

/* CARD-15 (v9.89): the reward pool was a frozen 22-card subset — the vanilla
   moves the game shipped with. Mechanics added since (tough, friction, an extra
   static, the synergy specialists) were undraftable as a climb reward, so a
   campaign deck could never express them. Added here across common and uncommon;
   the rare tier is left untouched on purpose (it is the dominant band lever).
   This is a DELIBERATE, dated re-pin and a joint balance pass — the ~46 band was
   structurally held by the pool being thin, so enriching it moves the pin to ~52
   AND lifts the ROUTE-8 alternate lines (retuned this version) and would sink the
   Onsighter under its floor (bought back this version). Carved out: the strong
   rare-only keywords (echo/settle2/weight/momentum/guard) and snap, each of which
   pushed a fuller refresh to 58%; chip/sequences/protection/skin-cost as their
   own sub-systems; and extra feet cards (the pool already covers that lever). */
export const REWARDS = {
  common: ['Gaston', 'Sloper Slap', 'Undercling', 'Mantle', 'Pinch Grip', 'Deadpoint',
    'Heel Hook', 'Drop Knee', 'Flag', 'High Step', 'Breathe', 'Brush',
    'Hand Jam', 'Palm Press', 'Static Reach'],
  uncommon: ['Cross-Through', 'Lock & Bump', 'Dyno', 'Toe Hook', 'Visualize', 'Try-Hard Scream',
    'Crimp Specialist', 'Pocket Poacher'],
  rare: ['Iron Fingers', 'Static Lock', 'Perfect Beta', 'Send Train'],
}
/** Reward quality scales with the act — later ranges hand out better gear,
    which is what lets the deck keep pace with the grade ramp. */
const ACT_ODDS: [number, number][] = [[0.70, 0.95], [0.50, 0.88], [0.35, 0.80]]
export function rollOffers(rng: RNG, count = 3, weak = false, act = 0): Card[] {
  const out: Card[] = [], used = new Set<string>()
  const [cw, uw] = ACT_ODDS[Math.max(0, Math.min(2, act))]
  let guard = 0
  while (out.length < count && guard++ < 60) {
    const r = weak ? 0 : rng.next()
    const pool = r < cw ? REWARDS.common : r < uw ? REWARDS.uncommon : REWARDS.rare
    const name = pool[rng.int(pool.length)]
    if (used.has(name)) continue
    used.add(name); out.push(spawn(name))
  }
  return out
}

/* ======================= CONTENT: SKIRMISH ========================= */
const SK_A = ['Broken', 'Silent', 'Long', 'Crooked', 'Bitter', 'Hollow', 'Green', 'Old',
  'Low', 'Sharp', 'Quiet', 'Dead', 'Cold', 'Loose', 'Blind']
const SK_B = ['Ledge', 'Arete', 'Prow', 'Roof', 'Slab', 'Wall', 'Boulder', 'Traverse',
  'Corner', 'Bulge', 'Nose', 'Crack', 'Scoop', 'Rail', 'Block']
const SK_NOTE = [
  'Nobody has bothered to name this one properly.',
  'Marked in the book with a question mark.',
  'A line the guidebook forgot.',
  'Two stars, if you believe the book.',
  'Chalk on it from someone, sometime.',
]
/* ========================== THE CIRCUIT ============================
   Endless. One deck, no map, escalating grades until the skin or the head
   goes. Every fourth line is roped, which is the only place outside Act 3
   that the rope machinery gets used.                                    */
/* SKIRM-4: the Circuit is not a flat treadmill any more — it climbs through
   named zones as your line count rises, so the endless mode has a sense of
   place and of how deep you are. Pure function of the count (no RNG, no new
   state), and it changes nothing about difficulty — the grade curve and the
   `enduro` deed (8 lines, in The Grind) are exactly as they were. */
export function circuitZone(n: number): { name: string; text: string; floor: number } {
  if (n >= 14) return { name: 'Into the Dark', text: 'No rack lasts forever, and now the rock bites harder the deeper you go. See how far it goes.', floor: 14 }
  if (n >= 10) return { name: 'The Business', text: 'Every line is a project from here.', floor: 10 }
  if (n >= 6) return { name: 'The Grind', text: 'This is where a circuit is won or lost.', floor: 6 }
  if (n >= 3) return { name: 'Getting Steep', text: 'It tilts back now. No more freebies.', floor: 3 }
  return { name: 'The Warm-Up', text: 'Gentle angles. Save something for later.', floor: 0 }
}
export function circuitRoute(n: number, rng: RNG): RouteSpec {
  const grade = Math.min(10, Math.floor(n * 0.7))
  const styles: StyleKey[] = ['mixed', 'slab', 'crimp ladder', 'compression', 'power', 'jug haul']
  const feet: FeetKey[] = ['easy', 'normal', 'hard']
  const roped = n > 0 && n % 4 === 3
  // SKIRM-5: the grade pins at 10 by ~line 15, and past that the line was
  // identical forever — pure skin attrition. Into the Dark now grows a Bite: +1
  // as the grade caps, then +1 every three lines deeper. A pure function of n
  // that only rises above line 15, so nothing at or below the enduro deed (line
  // 8) moves, and the RNG draw order is unchanged — lower lines are identical.
  const dBite = Math.ceil(Math.max(0, n - 15) / 3)
  return {
    name: `${SK_A[rng.int(SK_A.length)]} ${SK_B[rng.int(SK_B.length)]}`,
    grade, style: styles[rng.int(styles.length)],
    clear: 5 + Math.floor(grade * 0.7) + rng.int(2),
    crux: Math.floor(grade / 3),
    feet: feet[rng.int(feet.length)],
    roped, pitches: roped ? 2 : undefined,
    dBite: dBite || undefined,
    note: roped ? 'Two pitches. Rack up.' : SK_NOTE[rng.int(SK_NOTE.length)],
  }
}

/* SKIRM-2. Every design note since v0 justified the seeded RNG the same way:
   it is "what makes daily-seeded skirmish possible later". Every shuffle,
   draw, event roll and hold wobble has gone through it for ninety versions,
   and the word "daily" appeared nowhere in the file. This is the collection. */
export const DAILY_ATTEMPTS = 1

/** The day itself, as a number. Same date, same problem, everywhere. */
export function dayKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}
export function dailySeed(key = dayKey()): number {
  // a plain string hash: everyone with the same date gets the same number
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) || 1
}
/* One problem generator, two doors into it. SOCIAL-2 needed a shareable one-off
   problem and the daily already had exactly the right generator; a second copy of it
   would have been a second set of tables to drift (the ENG-19 lesson). Only the seed
   and the note differ, so only those are arguments. */
function problemFrom(seed: number, note: string): RouteSpec {
  const rng = new RNG(seed >>> 0)
  const styles: StyleKey[] = ['mixed', 'slab', 'crimp ladder', 'compression', 'power', 'jug haul']
  const feet: FeetKey[] = ['normal', 'hard']
  const grade = 3 + rng.int(5)
  return {
    name: `${SK_A[rng.int(SK_A.length)]} ${SK_B[rng.int(SK_B.length)]}`,
    grade, style: styles[rng.int(styles.length)],
    clear: 9 + rng.int(5), crux: 1 + rng.int(3), feet: feet[rng.int(feet.length)],
    note,
  }
}
/** Today's problem. Harder than a skirmish and the same for everyone. */
export const dailyRoute = (key = dayKey()): RouteSpec =>
  problemFrom(dailySeed(key), 'Today only. Everybody is on this one.')
/** What a daily attempt was worth. Topping out matters most; being quick and
    unpumped is the tiebreak, which is how people actually compare a session. */
export function dailyScore(s: GameState): number {
  const spec = specOf(s)
  const topped = s.result === 'send'
  const holds = Math.min(s.cleared, spec.clear)
  return Math.max(0, holds * 10 + (topped ? 100 + spec.grade * 15 : 0)
    + (topped ? Math.max(0, 40 - s.turn) * 2 : 0)
    + Math.max(0, PUMP_MAX - s.peakPump) * 3)
}

/* SKIRM-3. The conditions of the day. The daily already rolls its weather and
   rock off the date — that is how everyone lands on the same problem — but it
   never told you what they were before you tied in. This is that reading, and
   because conditions are the biggest lever in the game (ENG-20), it is a real
   shared modifier, not decoration. It reproduces startDaily's derivation
   exactly (same seed, same first two draws), pinned by a test, so the reading
   is the same conditions you actually climb in. */
export function dailyForecast(key = dayKey()): { weather: number; rock: number } {
  const r = new RNG(dailySeed(key))
  return { weather: r.int(WEATHER.length), rock: r.int(ROCK.length) }
}
/* SKIRM-3. The week as a number, for the ladder that adds up your dailies. A
   plain seven-day block off the epoch — deterministic, and all that a running
   weekly total needs. Takes a date so a test is not at the mercy of the clock. */
export function weekKey(d = new Date()): string {
  const day = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000)
  return `w${Math.floor(day / 7)}`
}
/* DAILY-3. The weekly ladder reset into a void. Every seven days the number went
   back to zero, nothing accumulated past it, and nothing was ever FINISHED — so
   there was no arc longer than a week and no reason to care about week three.

   A season is four of those weeks. It keeps a running total, a count of the days
   you showed up, and the four weekly totals so there is a board to look at; when
   it rolls over, the season that just ended pays a title off what it was worth.
   The title lands the next time you play rather than at midnight on the last day —
   there is no clock running in a game with no server, and inventing one would mean
   lying about when it happened. Stated rather than hidden: a season you never come
   back from stays unclosed, and closes when you do.

   Titles reuse DAILY-1's list, so a season title and a streak title sit in the same
   place and the save gained no new shape for it. Off-band: a title is cosmetic and
   the season total is a leaderboard number no run can spend. */
export const SEASON_WEEKS = 4
export function seasonKey(d = new Date()): string {
  const day = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000)
  return `s${Math.floor(day / (7 * SEASON_WEEKS))}`
}
/** Which week of the season this is, 0-3 — the column the board fills in. */
export function seasonWeekOf(d = new Date()): number {
  const day = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000)
  return Math.floor(day / 7) % SEASON_WEEKS
}
/* The ladder is pinned to what a day is actually worth: a strong daily banks around
   550-600 with both objectives met (DAILY-2), so a 28-day season tops out near
   16,000. The rungs below are roughly 3, 7, 14 and 23 days of good climbing. */
export const SEASON_TITLES: { at: number; title: string; text: string }[] = [
  { at: 1500, title: 'Weekender', text: 'You got out. That is more than most managed.' },
  { at: 4000, title: 'Committed', text: 'Four weeks and you kept turning up.' },
  { at: 8000, title: 'Season Local', text: 'Half the season on the wall. People know your car.' },
  { at: 13000, title: 'Crag Rat', text: 'You basically lived here. Go home.' },
]
/** What a finished season was worth, or null if it was not worth a title. */
export function seasonTitle(score: number) {
  let out: { at: number; title: string; text: string } | null = null
  for (const t of SEASON_TITLES) if (score >= t.at) out = t
  return out
}
/** The next rung of the season and how far off it is, for the board to show. */
export function nextSeasonTitle(score: number) {
  const t = SEASON_TITLES.find(x => x.at > score)
  return t ? { ...t, away: t.at - score } : null
}
/* DAILY-3. Tomorrow, teased. `dailyRoute` and `dailyForecast` already take a key,
   so what is coming has been computable all along and was never shown — which is
   the cheapest come-back hook in the game. The objectives are deliberately NOT
   revealed: the conditions are what you plan around, the puzzle is what you turn up
   for. */
export function tomorrowKey(d = new Date()): string {
  const t = new Date(d); t.setUTCDate(t.getUTCDate() + 1)
  return dayKey(t)
}

/* SOCIAL-1. The share string — the whole feature, and it needs no server. A
   daily result you can paste anywhere, the way people post a Wordle grid: the
   date, a row of squares for the holds you worked, the grade and the conditions
   everyone shared today, the score, and the streak and week behind it. It reads
   straight off the attempt, so two people who did the same thing write the same
   line — which is the point of a daily. */
/* ART-4. SOCIAL-1 made a result you can paste anywhere, and text is what it made. An
   IMAGE is what people actually post, and the day's grid is already a picture — it just
   had no way out of the app.

   THE FIELDS LIVE HERE rather than in the drawing code, for the reason ENG-19 keeps
   restating: the text share and the picture are two renderings of one result, and two
   copies of "what the result was" drift. The canvas reads this; `dailyShare` reads this;
   a guard asserts the grid they show is the same string. Nothing here touches the run —
   it is a projection of state that has already happened. */
export type ShareCard = {
  day: string; grid: string; holds: number; clear: number
  grade: string; weather: string; rock: string
  score: number; flashed: boolean
  goals: { text: string; met: boolean }[]
  streak: number; week: number
}
export function shareCard(s: GameState): ShareCard {
  const spec = specOf(s)
  const holds = Math.max(0, Math.min(s.cleared, spec.clear))
  return {
    day: s.dailyDay,
    grid: '▪'.repeat(holds) + '▫'.repeat(Math.max(0, spec.clear - holds)),
    holds, clear: spec.clear,
    grade: gradeText(spec.grade, s.grades),
    weather: WEATHER[s.weather]?.name ?? '',
    rock: ROCK[s.rock]?.name ?? '',
    score: s.dailyScore,
    flashed: s.result === 'send',
    goals: dailyGoals(s.dailyDay || undefined)
      .map(g => ({ text: g.text, met: s.dailyMet.includes(g.id) })),
    streak: s.dailyStreak, week: s.weekScore,
  }
}
export function dailyShare(s: GameState): string {
  // ART-4: off the one projection, so the picture and the paste say the same thing
  const c = shareCard(s)
  const lines = [
    `Sandbagged · ${c.day}`,
    `${c.grid} ${c.holds}/${c.clear} · ${c.grade}${c.weather ? ` · ${c.weather}` : ''}`,
    `${c.score} pts${c.flashed ? ' · flashed it' : ''}`,
  ]
  /* DAILY-2: the objectives are the part worth comparing — two people can both
     score well and only one of them kept off the rests. Appended, so SOCIAL-1's
     line order (and the guard that reads the grid off line 2) is unchanged. */
  if (c.goals.length) lines.push(c.goals.map(g =>
    `${g.met ? '✓' : '✗'} ${g.text.toLowerCase()}`).join(' · '))
  const tail: string[] = []
  if (c.streak > 1) tail.push(`${c.streak}-day streak`)
  if (c.week > 0) tail.push(`week ${c.week}`)
  if (tail.length) lines.push(tail.join(' · '))
  return lines.join('\n')
}
/* SOCIAL-2. SOCIAL-1 let you paste a RESULT and that was the whole social surface:
   people could compare numbers but nobody could climb your thing. A challenge is the
   other direction — a problem and the terms it has to be done on, short enough to say
   out loud, and it needs no server either.

   A code carries a seed and one objective, and the objective is the point: a seed alone
   is just "try this problem", where a seed plus "and do it without shaking out" is a
   thing to beat. The objectives are DAILY-2's, so a challenge asks for something the
   game already knows how to judge and show.

   IT CARRIES A CHECK CHARACTER, which is the SAVE-1 lesson in miniature: without one a
   mistyped code parses as a perfectly valid DIFFERENT problem, so two people compare
   scores on two different boulders and neither can tell.
   The scheme is ISO 7064 MOD 37,36, and it is that rather than something hand-rolled
   for a measured reason. The first cut summed `seed % 36`, which ignores every digit
   above the last — so changing a high-order character left the check valid and 210 of
   the single-character typos in the guard's sweep read back as a different challenge.
   MOD 37,36 PROVABLY detects every single-character substitution and every adjacent
   transposition, which is exactly the class of mistake a person makes reading a code
   over a phone. The 37th symbol is why the check alphabet has a `*` in it: 37 is prime
   and base36 only has 36 digits to spend. */
export type Challenge = { seed: number; goal: string }
export const CHALLENGE_NOTE = 'Somebody else-s problem, on their terms.'
/** The problem a challenge seed names. Same generator the daily uses. */
export const challengeRoute = (seed: number): RouteSpec =>
  problemFrom(seed, CHALLENGE_NOTE)
const CHK = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ*'
/** ISO 7064 MOD 37,36 over the base-36 payload. */
function checkChar(payload: string): string {
  let pp = 36
  for (const ch of payload) {
    const a = parseInt(ch, 36)
    if (!Number.isFinite(a)) return ''
    const sum = (pp + a) % 36
    pp = ((sum === 0 ? 36 : sum) * 2) % 37
  }
  return CHK[(38 - pp) % 37]
}
export function challengeCode(c: Challenge): string {
  const gi = DAILY_GOALS.findIndex(g => g.id === c.goal)
  if (gi < 0) return ''
  const seed = c.seed >>> 0
  const body = `${seed.toString(36).toUpperCase()}${gi.toString(36).toUpperCase()}`
  return `${seed.toString(36).toUpperCase()}-${gi.toString(36).toUpperCase()}${checkChar(body)}`
}
export function readChallenge(code: string): Challenge | null {
  // the check alphabet includes `*`, so it must survive normalising
  const raw = (code || '').toUpperCase().replace(/[^0-9A-Z*-]/g, '')
  const parts = raw.split('-').filter(Boolean)
  if (parts.length !== 2 || parts[1].length !== 2) return null
  if (!/^[0-9A-Z]+$/.test(parts[0]) || !/^[0-9A-Z]$/.test(parts[1][0])) return null
  const seed = parseInt(parts[0], 36)
  const gi = parseInt(parts[1][0], 36)
  if (!Number.isFinite(seed) || !Number.isFinite(gi)) return null
  if (seed > 0xffffffff) return null
  if (gi < 0 || gi >= DAILY_GOALS.length) return null
  // a typo is REFUSED, never climbed as a different problem
  if (checkChar(parts[0] + parts[1][0]) !== parts[1][1]) return null
  return { seed: seed >>> 0, goal: DAILY_GOALS[gi].id }
}
/** What you did on somebody's challenge, in a line they can compare against theirs. */
export function challengeShare(s: GameState): string {
  const c = s.challenge
  if (!c) return ''
  const spec = specOf(s)
  const holds = Math.max(0, Math.min(s.cleared, spec.clear))
  const grid = '\u25aa'.repeat(holds) + '\u25ab'.repeat(Math.max(0, spec.clear - holds))
  const g = goalById(c.goal)
  const met = g ? g.met(s, spec) : false
  return [
    `Sandbagged \u00b7 challenge ${challengeCode(c)}`,
    `${grid} ${holds}/${spec.clear} \u00b7 ${gradeText(spec.grade, s.grades)}`,
    `${g ? `${met ? '\u2713' : '\u2717'} ${g.text.toLowerCase()}` : ''}`,
    `${dailyScore(s)} pts${s.result === 'send' ? ' \u00b7 topped it' : ''}`,
  ].filter(Boolean).join('\n')
}

/* RUN-12. The weekly ladder was accumulated, saved and printed — and nothing
   else. The daily has a streak deed and a share; the week gets its own now: a
   share of the running total (a week is an aggregate, so no per-hold grid — it
   is the sum of the days behind it) and a deed for a real week of climbing. */
export const BIG_WEEK = 1000
/** SKIRM-8: the endless mode had nothing to paste. Same shape as the others (SOCIAL-1):
    no server, no link, just the numbers. `bestCircuit` has already taken this run into
    account by the time this renders, so `score >= best` reads exactly as "tied or beat the
    previous best" — which is the same convention the between-lines screen uses. */
export function circuitShare(s: GameState): string {
  const best = s.circuitScore >= s.bestCircuit
  const lines = [
    'Sandbagged · the circuit',
    `${s.circuitScore} line${s.circuitScore === 1 ? '' : 's'} · ${circuitZone(s.circuitScore).name}`,
  ]
  lines.push(best ? 'a personal best' : `best ${s.bestCircuit}`)
  return lines.join('\n')
}
export function weekShare(s: GameState): string {
  const best = s.weekScore >= s.weekBest && s.weekScore > 0
  const lines = [
    'Sandbagged · the week',
    `${s.weekScore} pts${best ? ' · a personal best' : ''}`,
  ]
  if (!best && s.weekBest > 0) lines.push(`best week ${s.weekBest}`)
  if (s.dailyStreak > 1) lines.push(`${s.dailyStreak}-day streak going`)
  return lines.join('\n')
}

export function skirmishRoute(level: number, rng: RNG): RouteSpec {
  const grade = Math.min(5, Math.floor((level - 1) / 2))
  const styles: StyleKey[] = ['mixed', 'slab', 'crimp ladder', 'compression', 'power', 'jug haul']
  const feet: FeetKey[] = ['easy', 'normal', 'hard']
  return {
    name: `${SK_A[rng.int(SK_A.length)]} ${SK_B[rng.int(SK_B.length)]}`,
    grade, style: styles[rng.int(styles.length)],
    clear: 5 + grade + rng.int(2),
    crux: Math.floor(grade / 2),
    feet: feet[rng.int(feet.length)],
    note: SK_NOTE[rng.int(SK_NOTE.length)],
  }
}
/** Your collection deck: the starter shell plus one of everything you own. */
export function collectionDeck(owned: string[]): Card[] {
  const deck = makeDeck(0)
  for (const n of owned) if (CARDS[n] && CARDS[n].rarity !== 'curse') deck.push(spawn(n))
  return deck
}

/* ============================== RNG ================================ */
export class RNG {
  s: number
  constructor(seed: number) { this.s = seed >>> 0 }
  next(): number {
    this.s = (this.s + 0x6D2B79F5) >>> 0
    let t = this.s
    t = Math.imul(t ^ (t >>> 15), 1 | t)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  int(n: number) { return Math.floor(this.next() * n) }
  shuffle<T>(a: T[]): T[] {
    const r = a.slice()
    for (let i = r.length - 1; i > 0; i--) { const j = this.int(i + 1);[r[i], r[j]] = [r[j], r[i]] }
    return r
  }
  weighted(w: Record<string, number>): string {
    const keys = Object.keys(w); let total = 0
    for (const k of keys) total += w[k]
    let roll = this.next() * total
    for (const k of keys) { roll -= w[k]; if (roll <= 0) return k }
    return keys[keys.length - 1]
  }
}

/* ======================= PILE HELPERS (pure) ======================= */
let UID = 1
const nextUid = () => UID++

/** Harness helpers: one card by name, and a synthetic Power/Contact probe. */
/** Sharpening is derived from a card's shape, not authored 209 times.
    Moves gain +1/+1 (~+3 budget by the costing law, a tier's worth); rests
    also shed more; bonuses lose a pump of cost, or gain a point of effect. */
export function upgrade(c: Card): Card {
  if (c.upgraded) return c
  const u: Card = { ...c, upgraded: true, name: c.name + '+' }
  if (c.kind === 'move') {
    u.contact = c.contact + 1
    if (c.shed > 0) u.shed = c.shed + 1
    else u.power = c.power + 1
  } else if (c.cost > 0) {
    u.cost = c.cost - 1
  } else {
    if (c.power) u.power = c.power + 1
    if (c.powerAll) u.powerAll = c.powerAll + 1
    if (c.gripCut) u.gripCut = c.gripCut + 1
    if (c.draw) u.draw = c.draw + 1
    if (c.shed) u.shed = c.shed + 1
    if (c.restore) u.restore = c.restore + 1
  }
  return u
}

export function spawn(name: string): Card {
  const d = CARDS[name]
  return { uid: nextUid(), name: d.name, kind: d.kind ?? 'move', power: d.power ?? 0,
    contact: d.contact ?? 0, lane: d.lane ?? 'hand', shed: d.shed ?? 0, support: d.support ?? 0,
    anchor: d.anchor ?? false, latch: d.latch ?? false, cost: d.cost ?? 0,
    powerAll: d.powerAll ?? 0, gripCut: d.gripCut ?? 0, draw: d.draw ?? 0, read: d.read ?? 0,
    cleans: d.cleans ?? false, restore: d.restore ?? 0, rarity: d.rarity ?? 'common',
    chip: d.chip ?? 0, skinCost: d.skinCost ?? 0, synergy: d.synergy ?? '', clip: d.clip ?? false, seq: d.seq ?? '', opposes: d.opposes ?? false,
    restChip: d.restChip, hex: d.hex,   // CARD-11 / CARD-13: were dropped here, so both were dead in play
    fx: d.fx ?? '', targeted: d.targeted ?? false, text: d.text ?? '' }
}
export function synth(power: number, contact: number): Card {
  return { uid: nextUid(), name: `T${power}/${contact}`, kind: 'move', power, contact,
    lane: 'hand', shed: 0, support: 0, anchor: false, latch: false, cost: 0,
    powerAll: 0, gripCut: 0, draw: 0, read: 0, cleans: false, restore: 0, rarity: 'common',
    chip: 0, skinCost: 0, synergy: '', clip: false, seq: '', opposes: false, fx: '', targeted: false, text: '' }
}

export function makeDeck(tier: number): Card[] {
  const out: Card[] = []
  for (const [name, n] of DECKS[tier].list) {
    const d = CARDS[name]
    for (let i = 0; i < n; i++) out.push({
      uid: nextUid(), name: d.name, kind: d.kind ?? 'move',
      power: d.power ?? 0, contact: d.contact ?? 0, lane: d.lane ?? 'hand',
      shed: d.shed ?? 0, support: d.support ?? 0, anchor: d.anchor ?? false,
      latch: d.latch ?? false, cost: d.cost ?? 0, powerAll: d.powerAll ?? 0,
      gripCut: d.gripCut ?? 0, draw: d.draw ?? 0, read: d.read ?? 0, cleans: d.cleans ?? false,
      restore: d.restore ?? 0, rarity: d.rarity ?? 'common',
      chip: d.chip ?? 0, skinCost: d.skinCost ?? 0, synergy: d.synergy ?? '', clip: d.clip ?? false, seq: d.seq ?? '', opposes: d.opposes ?? false,
      restChip: d.restChip, hex: d.hex,   // CARD-11 / CARD-13
      fx: d.fx ?? '', targeted: d.targeted ?? false, text: d.text ?? '',
    })
  }
  return out
}
export function pileDraw(p: Piles, n: number, rng: RNG): Piles {
  let draw = p.draw.slice(), discard = p.discard.slice()
  const hand = p.hand.slice()
  for (let i = 0; i < n; i++) {
    if (draw.length === 0) {
      if (discard.length === 0) break
      draw = rng.shuffle(discard); discard = []
    }
    hand.push(draw.pop()!)
  }
  return { ...p, draw, discard, hand }
}
export function pileDiscard(p: Piles, cards: Card[]): Piles {
  const ids = new Set(cards.map(c => c.uid))
  return { ...p, hand: p.hand.filter(c => !ids.has(c.uid)), discard: [...p.discard, ...cards] }
}
export function pileExhaust(p: Piles, card: Card): Piles {
  return { ...p, exhaust: [...p.exhaust, card] }
}
export function pileFromHand(p: Piles, uid: number): Piles {
  return { ...p, hand: p.hand.filter(c => c.uid !== uid) }
}

/* ============================ ENGINE =============================== */
// V0-1:0 · V2-3:1 · V4-5:2 · V6+:3 (capped)
// identical to the old table for grades 0-5, so Act 1 balance is untouched.
// The cap matters: uncapped, Act 3 outran deck growth and the campaign
// finished at 1%.
/* Saturates at V6 deliberately. Extending it by one point above V8 was
   measured at −14 points of campaign completion: this is a global multiplier
   on every hold of every route, and the grade is meant to do its work through
   hold and crux counts instead. See BAL-8. */
const bumpFor = (g: number) => Math.min(3, Math.floor(g / 2))

/** The route as you have chosen to climb it. Authored lines — the tutorial
    and the finale — are never varied. */
export const specOf = (s: GameState): RouteSpec => {
  const base = s.skirmish ?? ROUTES[s.routeIdx]
  const l = LINES[s.line]
  if (!l || !s.line || base.finale || base.tutorial || base.holds) return base
  // a short boulder can end up with more cruxes than holds, which is not a
  // route at all — the crux count is capped below the hold count
  const clear = Math.max(4, base.clear + (l.dClear ?? 0))
  return { ...base, clear,
    crux: Math.min(clear - 1, Math.max(0, base.crux + (l.dCrux ?? 0))) }
}
export const lineCanVary = (r: RouteSpec) => !r.finale && !r.tutorial && !r.holds

export function buildRoute(s: GameState, rng: RNG): { holds: Hold[]; feet: Hold[] } {
  const spec = specOf(s), st = STYLES[spec.style], rock = ROCK[s.rock]
  const mm = mutMods(s.inRun ? s.mutators : [])
  // Greasy: the worst weather in the book, every single time
  const foulIdx = WEATHER.reduce((worst, x, i) =>
    (x.dBite - x.dContact) > (WEATHER[worst].dBite - WEATHER[worst].dContact) ? i : worst, 0)
  const w = (s.inRun && archOf(s).ignoreWeather) ? WEATHER[1]
    : WEATHER[s.inRun && mm.foul ? foulIdx : s.weather]
  const asc = s.inRun ? styleMods(s.style) : styleMods(0)
  const bump = bumpFor(spec.grade + (s.inRun ? mm.gradeUp : 0)), biteBump = Math.ceil(bump / 2)
  // no chalk, no tick marks, no trail: what you have not read, you cannot climb
  const unread = spec.finale ? BLIND_HOLD + unreadGrip(s.journal) : 0
  const blind = unread * UNREAD_GRIP
  const weights: Record<string, number> = {}
  for (const k of Object.keys(st.w)) weights[k] = st.w[k] * (rock.boost[k] ?? 1)
  const holds: Hold[] = []
  if (spec.holds) {
    // authored, in order, no shuffle — the tutorial teaches in sequence
    const list = spec.holds.map(t => {
      if (t === 'crux') return { uid: nextUid(), name: 'crux', crux: true, clean: false,
        bite: 3, grip: 6 }
      const d = HOLD_STATS[t]
      return { uid: nextUid(), name: t, crux: false, clean: false, bite: d.bite, grip: d.grip }
    })
    const fp0 = FEET_POOLS[spec.feet], feet0: Hold[] = []
    for (let i = 0; i < 40; i++) {
      const t = rng.weighted(fp0), d = FEET_STATS[t]
      feet0.push({ uid: nextUid(), name: t, crux: false, clean: false, bite: d.bite, grip: d.grip })
    }
    return { holds: list.reverse(), feet: feet0 }
  }
  for (let i = 0; i < spec.clear + 6; i++) {
    const t = rng.weighted(weights), d = HOLD_STATS[t]
    // rolled here, from the run RNG, so a seed still replays exactly
    const wob = rng.next() < 0.5 ? WOBBLE : 0
    holds.push({
      uid: nextUid(), name: t, crux: false, clean: false,
      bite: Math.max(1, d.bite + st.dbite + biteBump + BITE_BUMP + (rock.bite[t] ?? 0) + w.dBite + asc.dBite),
      grip: Math.max(1, d.grip + st.dgrip + bump + (rock.grip[t] ?? 0) + asc.dGrip + blind
        + (spec.fa ? DIRT_GRIP : 0) + wob
        + (t === 'sloper' ? w.sloperGrip : 0) + tweakGrip(s, t)),
      ...(wob ? { wobble: wob } : {}),
      ...(spec.fa ? { dirt: DIRT_GRIP } : {}),
    })
  }
  // Placed AFTER the cruxes and never onto one: the crux loop writes at random
  // indices and was overwriting the signature on two of the ten routes.
  const placeSig = () => {
    if (!spec.signature) return
    const sig = sigById(spec.signature)
    const d = sig ? HOLD_STATS[sig.base] : null
    const open = holds.map((h, k) => (h.crux ? -1 : k)).filter(k => k > 0)
    if (sig && d && open.length) {
      const at = open[rng.int(open.length)]
      holds[at] = {
        uid: nextUid(), name: sig.base, crux: false, clean: false, sig: sig.id,
        bite: Math.max(1, d.bite + st.dbite + biteBump + BITE_BUMP + (rock.bite[sig.base] ?? 0)
          + w.dBite + asc.dBite + (sig.dBite ?? 0)),
        grip: Math.max(1, d.grip + st.dgrip + bump + (rock.grip[sig.base] ?? 0) + asc.dGrip
          + blind + (sig.dGrip ?? 0) + (spec.fa ? DIRT_GRIP : 0)),
        ...(spec.fa ? { dirt: DIRT_GRIP } : {}),
      }
    }
  }
  /* ROUTE-10: the crux takes its NAME from the style — it reads as the line's
     own defining move — while resolving exactly as it always has: a Committing
     crux (name 'crux' → Power 2+, +1 tax) with its load-bearing Grip untouched.
     `dBite` is held at 0 (see CRUX_CHAR): a bite lean was measured to move the
     pinned band hard, so the character is identity, not difficulty. */
  const cc = CRUX_CHAR[spec.style]
  for (const i of rng.shuffle(holds.map((_, k) => k)).slice(0, spec.crux)) {
    holds[i] = { uid: nextUid(), name: 'crux', crux: true, clean: false, label: cc.label,
      bite: Math.max(1, 4 + cc.dBite + biteBump + BITE_BUMP + w.dBite + asc.dBite),
      grip: 8 + bump + asc.dGrip + blind + (spec.fa ? DIRT_GRIP : 0),
      ...(spec.fa ? { dirt: DIRT_GRIP } : {}) }
  }
  placeSig()
  // ROUTE-12: the grind lines (circuit, daily, skirmish, first ascents) carried
  // no named feature at all — the exact sameness ROUTE-5 set out to kill. Tag
  // one, band-neutrally: an ability-less signature matched to a hold of its own
  // base type, so NOTHING about the numbers changes — only the name, the note
  // and the read hook. Chosen from an ISOLATED rng keyed to the line, so it
  // draws nothing from the run stream (the daily and the seed replay identically).
  /* ROUTE-15: and the SCRIPTED lines that never got one either. ROUTE-13 named 31 of the 37
     and left six: the first four (Warm-Up Rail, The Sit Start, Mossback, Peeler), the finale,
     and the tutorial. Those five are guidebook routes with no named feature at all, which is
     the sameness ROUTE-5 set out to kill — and the tagging above is exactly the tool for it,
     because it is band-neutral BY CONSTRUCTION: it renames a hold that is already there
     (`{ ...holds[at], sig: id }`) rather than replacing one the way a scripted `signature`
     does, and it draws from an rng keyed to the line rather than the run stream. Nothing
     reads a signature's dGrip or dBite outside `placeSig`, so the numbers cannot move.
     The TUTORIAL is left out on purpose: its holds are authored one at a time to teach one
     thing at a time (`spec.holds`), and a named feature with a note to read is the one place
     in the game where more text is not a gift. */
  /* ROUTE-15: a scripted line can name its own feature with `sigTag`, and the four earliest
     ones now do. Where there is no tag, the ROUTE-12 behaviour stands for the grind lines.
     TWO CARVE-OUTS, both because of what the line IS rather than for convenience:
     the TUTORIAL, whose holds are authored one at a time to teach one thing at a time and
     where another note to read is the one thing it does not need; and THE LOST LINE, whose
     own note is "No chalk. No tick marks. No trail. Exactly as he left it." A named feature
     means people have been there and named it. Nothing on that line is named — that IS the
     line, and it is almost certainly why ROUTE-13 left it out. (If it ever gets one, the
     name should come out of HIS pages, which the player may or may not have read.) */
  /* WHICH feature and WHETHER to tag are two questions, and running them together is how
     the first cut of this silently switched the grind lines off — an empty candidate list
     and "do not tag" are not the same thing, and `[] || undefined` is falsy. */
  const own = spec.sigTag ?? null
  const generated = !own && !spec.signature && !spec.tutorial && !spec.finale
  if (own || generated) {
    let h = 2166136261
    for (const ch of spec.name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
    const sigRng = new RNG(((h ^ (spec.grade * 2654435761) ^ (spec.clear * 40503)) >>> 0) || 1)
    const ids = own ? [own] : sigRng.shuffle(GEN_SIG_IDS.slice())
    let placed = false
    for (const id of ids) {
      const at = holds.findIndex(x => !x.crux && !x.sig && x.name === sigById(id)!.base)
      if (at >= 0) { holds[at] = { ...holds[at], sig: id }; placed = true; break }
    }
    /* a line's OWN feature has to be on it every time, or it is not a named feature. The
       preferred base is what the style usually rolls, not what it guarantees — `mixed` rolls
       a jug on only about four holds in five — so if it did not come up, the name goes on
       whatever the line did roll. That is why these notes never say what kind of hold it is.
       A generated line has the whole pool to try and does not get this fallback: it has no
       name of its own to be missing. */
    if (!placed && own) {
      const at = holds.findIndex(x => !x.crux && !x.sig)
      if (at >= 0) holds[at] = { ...holds[at], sig: own }
    }
  }
  const fp = FEET_POOLS[spec.feet], feet: Hold[] = []
  for (let i = 0; i < 40; i++) {
    const t = rng.weighted(fp), d = FEET_STATS[t]
    feet.push({ uid: nextUid(), name: t, crux: false, clean: false,
      bite: d.bite + w.dBite, grip: d.grip + bump })
  }
  return { holds: rng.shuffle(holds), feet }
}

export const abilityOf = (h: Hold) => {
  if (h.clean) return ''
  const sig = h.sig ? sigById(h.sig) : null
  if (sig?.ability) return sig.ability
  return HOLD_STATS[h.name]?.ability ?? FEET_STATS[h.name]?.ability ?? ''
}
/** What a hold is called on the board — its own name if it has one. */
export const holdLabel = (h: Hold) => h.label ?? (h.sig ? sigById(h.sig)?.name : null) ?? h.name

/* UX-5. A run is fully determined by its starting seed — the forecast, the
   hold decks, every shuffle, event and offer. The live seed advances as you
   play, so the START is what has to be recorded for a run to be repeatable. */
export const seedCode = (n: number) => (n >>> 0).toString(36).toUpperCase()
export function codeSeed(code: string): number | null {
  const c = code.trim().replace(/[^0-9a-zA-Z]/g, '')
  if (!c) return null
  const n = parseInt(c, 36)
  return Number.isFinite(n) ? (n >>> 0) : null
}

/* MODE-1. Five flags say what KIND of attempt this is — a daily, somebody's challenge,
   an endless circuit, a project, a one-off skirmish — and each mode-start used to set
   only its own. So the flags leaked into each other, and two of the leaks were live:

     - climb a challenge, then the daily, and the end-of-burn screen rendered its
       CHALLENGE block on a daily result, quoting somebody else's code and their terms;
     - abandon a daily to the menu (`daily` stays true — it is session state, not saved)
       and then climb an FA, and `endSession` BANKED THE FA'S SCORE AS YOUR DAILY. It
       measured 581 against a real daily's ~353, and it corrupts the score, the streak
       and the week together.

   This is SAVE-2's shape exactly: a state built by hand-copying the fields somebody
   remembered. The fix is the same shape as `carryOver` — one place that names all of
   them, so a mode start cannot inherit another mode by forgetting a line. A guard now
   requires every start to go through it. */
export const MODE_FLAGS = ['daily', 'challenge', 'circuit', 'onProject', 'skirmish'] as const
export function modeReset(): Pick<GameState, typeof MODE_FLAGS[number]> {
  return { daily: false, challenge: null, circuit: false, onProject: false, skirmish: null }
}

/** Everything that belongs to you rather than to a run. A new expedition must
    carry all of it; hand-copying a subset is how it got lost.

    SAVE-7: and it got lost. This list was missing two fields the save writes as ACCOUNT
    state, which is the exact failure the sentence above warns about, sitting directly
    under it since the function was written:

      `journal` — the game's ONLY meta-progression (NARR-1's words). Saved and loaded at
        account level, and dropped here, so starting an expedition reset it to [] and the
        next autosave wrote the empty array to disk. You find about two pages a run, the
        "known" ending needs ten and the `everypage` deed needs all fourteen — so BOTH
        were unreachable in normal play, and had been for as long as this function existed.
        Found while auditing NARR-9, which asked for MORE pages on the premise that you
        read most of them in one run; you read two, and then lost them.

      `dailyTried` — SAVE-4's anti-farm gate, the one that says you have had your go today
        even if you bailed. `dailyDay` was carried and this was not, so: start the daily,
        come off it, start an expedition, and `dailyUsed` reads false again.

    The guard does not check for these two by name. It diffs what `saveGame` writes as
    account state against what this function returns, so the NEXT field added to the save
    fails the suite instead of going quiet for a year. */
export function carryOver(s: GameState): Partial<GameState> {
  return {
    journal: s.journal, dailyTried: s.dailyTried,
    level: s.level, xp: s.xp, owned: s.owned, sends: s.sends, wins: s.wins,
    runs: s.runs, falls: s.falls, seen: s.seen, book: s.book, ticked: s.ticked,
    established: s.established, history: s.history, bestCircuit: s.bestCircuit,
    archWins: s.archWins, mutatorWin: s.mutatorWin,
    loadouts: s.loadouts, styleMax: s.styleMax, tutorialDone: s.tutorialDone,
    slot: s.slot, ending: s.ending, tweak: s.tweak,
    // settings are the player's, not the run's
    sound: s.sound, ambience: s.ambience, haptics: s.haptics, assist: s.assist, motion: s.motion, cbSafe: s.cbSafe, textScale: s.textScale, reach: s.reach,
    coaching: s.coaching, hints: s.hints, topRope: s.topRope, grades: s.grades,
    dailyDay: s.dailyDay, dailyScore: s.dailyScore,
    dailyBest: s.dailyBest, dailyStreak: s.dailyStreak,
    larder: s.larder, titles: s.titles, graceWeek: s.graceWeek, dailyMet: s.dailyMet,
    weekId: s.weekId, weekScore: s.weekScore, weekBest: s.weekBest,
    seasonId: s.seasonId, seasonScore: s.seasonScore, seasonBest: s.seasonBest,
    seasonDays: s.seasonDays, seasonWeeks: s.seasonWeeks,
  }
}

export function newRun(seed: number, loadout?: string[], style = 0, arch = 0,
  mutators: string[] = []): GameState {
  // mutators must be in place BEFORE the run is built: two of them act here,
  // and reading them off a fresh state made both silent no-ops
  const s = { ...freshRun(0, 0, seed), runSeed: seed, mutators }
  const a = ARCHETYPES[Math.min(arch, ARCHETYPES.length - 1)]
  const curses = BY_RARITY('curse')
  const chossy = Array.from({ length: mutMods(s.mutators).startCurse },
    (_, i) => spawn(curses[i % curses.length]))
  return { ...s, inRun: true, arch, runDeck: [...loadoutDeck(loadout ?? a.loadout), ...chossy],
    tier: 0, act: 0, phase: 'map', style,
    gear: mutMods(s.mutators).noGear ? [] : [a.gear], psyche: PSYCHE_MAX + (a.dPsyche ?? 0),
    skin: Math.max(2, RUN_SKIN + styleMods(style).skin + (a.dSkin ?? 0)
      + (s.topRope ? TOPROPE_SKIN : 0)) }
}

export function freshRun(routeIdx: number, deckTier: number, seed: number): GameState {
  const rng = new RNG(seed ^ 0x9e37)
  return {
    seed, routeIdx, deckTier, burn: 1, skin: SKIN_MAX, bonusBurns: 0,
    weather: rng.int(WEATHER.length), rock: rng.int(ROCK.length),
    beta: [], worked: [], holdDeck: [], feetDeck: [],
    boardH: [null, null, null], boardP: [null, null, null],
    piles: { draw: [], discard: [], exhaust: [], hand: [] },
    pump: 0, flow: 0, cleared: 0, turn: 1,
    log: [], phase: 'menu', result: null, selected: null,
    inRun: false, runDeck: [], tier: 0, offers: [],
    level: 1, xp: 0, owned: [], sends: 0, wins: 0, packCards: [], skirmish: null,
    afterPack: 'menu', journal: [], eventId: null, eventResult: null,
    loadout: DEFAULT_LOADOUT.slice(), style: 0, styleMax: 0, act: 0,
    seen: [], eventsSeen: [], talkId: null, talkReply: null, phaseSeen: '', onProject: false,
    runout: 0, lastPiece: -1, pitch: 0, cash: 0, psyche: PSYCHE_MAX,
    circuit: false, circuitScore: 0, bestCircuit: 0, slot: 0, runSeed: 0, ending: '', topRope: true, history: [], archWins: [], mutatorWin: false, runs: 0, falls: 0,
    shopCards: [], shopGear: [], shopKit: [], kit: [], bought: [],
    coaching: true, sound: true, ambience: true, haptics: true, assist: false, cbSafe: false, motion: true, textScale: 0, reach: 'off',
    tutorialDone: false,
    fxLane: ['', '', ''], fxTick: 0, gear: [], boons: [], gearOffers: [], savedBlow: false, peakPump: 0, rests: 0, cruxFree: 0, clipped: false, bonusUsed: false, line: 0, rerolls: 0, mutators: [], seq: null, readAhead: 0, order: [], routeMove: null, arch: 0,
    loadouts: ARCHETYPES.map(a => a.loadout.slice()), reroll: 0, book: {}, ticked: [], hints: true, grades: 'v',
    larder: [], titles: [], graceWeek: '', dailyMet: [], challenge: null,
    dailyDay: '', dailyTried: '', dailyScore: 0, dailyBest: 0, dailyStreak: 0, weekId: '', weekScore: 0, weekBest: 0,
    seasonId: '', seasonScore: 0, seasonBest: 0, seasonDays: 0, seasonWeeks: [],
    daily: false, trail: [],
    shoppedAt: [], tweak: null, eventChose: [], vanRaided: [], established: [],
  }
}

/** Session over: pay skin, hand out a reward, or end the run. */
/** Bank today's attempt. Called once, when the burn that used it ends. */
/* SAVE-4: "One go" is what the menu promises, and it was not true — the day was
   stamped only when the climb RESOLVED, so quitting mid-daily left it unstamped
   and you could re-roll until the score was good, which the streak and the weekly
   ladder (RUN-12) both sit on top of. A go is used when it STARTS now.
   The accepted cost, stated plainly: a genuine crash or an evicted tab also
   spends the day. That is the honest reading of one go, and it is the side to err
   on when the alternative is a farmable ladder. */
export const dailyUsed = (s: GameState, key = dayKey()) =>
  s.dailyDay === key || s.dailyTried === key

/* DAILY-2. The daily was a score and nothing else, so there was no reason to climb
   it a particular WAY — the optimal line was the optimal line, every day, forever.
   Two objectives a day, off the same seed everybody else gets, give the one shared
   problem a shape: today it wants a flash and a cool head, tomorrow it wants you
   to keep off the rests. They are announced BEFORE you tie in (that is the whole
   point — everyone is solving the same stated puzzle) and they pay in daily score
   and XP.

   THE SEED IS DERIVED, NOT SHARED — and the reason is correlation, not corruption.
   `dailyRoute` and `dailyForecast` each construct their OWN `RNG(dailySeed(key))`,
   so reusing that seed here could not have changed the route (nothing shares a
   mutable stream). What it WOULD do is lock the objectives to the same number the
   route came from: the grade and the goals would move together forever, so every
   V4 day would ask the same two things and a month of dailies would read as a
   short loop. Hashing `key#goals` makes the two independent. A snapshot test pins
   the route and the forecast for a fixed day regardless, because a daily that
   changes what it was is a compatibility break rather than a tuning change.

   Off-band by construction: the score is a leaderboard number no run can spend,
   and the XP is paid on the daily, which the balance harness never plays (it calls
   `newRun` and climbs the campaign). Nothing here reaches the guide line. */
export type DailyGoal = {
  id: string
  /** What it asks, in the imperative — this is what the menu prints. */
  text: string
  /** Added to the day's score. */
  pts: number
  xp: number
  met: (s: GameState, spec: RouteSpec) => boolean
}
export const GOALS_PER_DAY = 2
export const DAILY_GOALS: DailyGoal[] = [
  { id: 'flash', text: 'Top it out', pts: 120, xp: 8,
    met: s => s.result === 'send' },
  { id: 'quick', text: 'Top it out inside 22 turns', pts: 150, xp: 10,
    met: s => s.result === 'send' && s.turn <= 22 },
  // half the route is the floor on the "how you climbed" goals, so falling off the
  // first hold cannot satisfy them by having done nothing at all
  { id: 'norest', text: 'Past halfway without shaking out', pts: 130, xp: 9,
    met: (s, spec) => s.rests === 0 && s.cleared * 2 >= spec.clear },
  { id: 'cool', text: 'Past halfway and never over half pumped', pts: 110, xp: 8,
    met: (s, spec) => s.peakPump <= Math.floor(PUMP_MAX / 2) && s.cleared * 2 >= spec.clear },
  { id: 'cruxfree', text: 'Take a crux with your feet off', pts: 100, xp: 7,
    met: s => s.cruxFree > 0 },
  { id: 'deep', text: 'Reach the last two holds', pts: 90, xp: 6,
    met: (s, spec) => s.cleared >= spec.clear - 2 },
]
export const goalById = (id: string) => DAILY_GOALS.find(g => g.id === id) ?? null
/** Today's two, deterministic and the same for everyone. */
export function dailyGoals(key = dayKey()): DailyGoal[] {
  // a separate hash of the same day, so the route's stream is left alone
  const rng = new RNG(dailySeed(`${key}#goals`))
  const pool = DAILY_GOALS.slice()
  const out: DailyGoal[] = []
  for (let i = 0; i < GOALS_PER_DAY && pool.length; i++) out.push(pool.splice(rng.int(pool.length), 1)[0])
  return out
}
/** Which of today's objectives the attempt actually met. */
export function goalsMet(s: GameState, key = dayKey()): DailyGoal[] {
  const spec = specOf(s)
  return dailyGoals(key).filter(g => g.met(s, spec))
}

/* DAILY-1: a streak was a number with one deed on it — nothing to earn and nothing
   to protect. It pays on a ladder now, and it forgives one missed day a week,
   because a streak that punishes a single bad day makes people give up rather than
   come back; the habit is the point, not the punishment.
   Every rung is KIT or a TITLE, never a draftable card and never cash: CARD-14
   established that consumables ride their own shop line and inventory and that the
   drafting sim never touches them, so this provably cannot move the pinned band.
   The larder is handed over by the App at run start — the harness calls `newRun`
   directly, so it never receives any of it. */
export const STREAK_REWARDS: { at: number; kit?: string; title?: string; text: string }[] = [
  { at: 3, kit: 'chalkshot', text: 'Three days on the trot. Somebody left a chalk shot in your bag.' },
  { at: 7, kit: 'skinsalve', text: 'A week straight. Your skin has opinions about it; the salve helps.' },
  { at: 14, kit: 'secondwind', title: 'Regular', text: 'Two weeks without missing. The locals know your van now.' },
  { at: 30, kit: 'tickstick', title: 'Local', text: 'A month. Thirty days. This is your crag.' },
]
export const streakReward = (n: number) => STREAK_REWARDS.find(r => r.at === n) ?? null
/** The next rung and how far off it is, for the menu to show. */
export function nextStreakReward(n: number) {
  const r = STREAK_REWARDS.find(x => x.at > n)
  return r ? { at: r.at, away: r.at - n } : null
}

export function bankDaily(s: GameState, rng = new RNG(dailySeed())): GameState {
  if (!s.daily) return s
  const key = dayKey()
  /* DAILY-2: the objectives are paid HERE, in the one funnel a daily attempt has
     to pass through, so they are banked exactly once for the same reason the score
     and the streak are — the `!s.daily` guard above. `dailyScore` stays the raw
     climb (the share and the tests read it), and the objective bonus lands on top
     of it, so the day, the week and the best all agree on one number.
     The rng defaults rather than being optional-and-skipped: a missing argument
     must not silently drop the XP, which is how a feature ships dead. */
  const met = goalsMet(s, key)
  const score = dailyScore(s) + met.reduce((n, g) => n + g.pts, 0)
  // a streak is consecutive days, so yesterday must have been the last one
  const y = new Date(); y.setUTCDate(y.getUTCDate() - 1)
  const wk0 = weekKey()
  /* DAILY-1: yesterday keeps the streak outright. The day BEFORE yesterday keeps
     it too, once per week — one forgiven miss, then it is gone. */
  const d2 = new Date(); d2.setUTCDate(d2.getUTCDate() - 2)
  const onTime = s.dailyDay === dayKey(y)
  const forgiven = !onTime && s.dailyDay === dayKey(d2) && s.graceWeek !== wk0
  const kept = onTime || forgiven ? s.dailyStreak : 0
  // SKIRM-3: add today onto this week's ladder, or start the week fresh. Runs
  // exactly once per day — the `!s.daily` guard above makes bankDaily idempotent.
  const wk = weekKey()
  const weekScore = s.weekId === wk ? s.weekScore + score : score
  const streak = kept + 1
  const rw = streakReward(streak)
  const xp = met.reduce((n, g) => n + g.xp, 0)
  const paid = xp > 0 ? gainXp(s, xp, rng) : s
  /* DAILY-3: the season. A new season closes the last one FIRST — that is when its
     title is paid, off the total it finished on — and then starts this one at
     today's score. Within a season, today lands in its own week's column. */
  const sk = seasonKey()
  const sameSeason = s.seasonId === sk
  const closing = sameSeason ? null : (s.seasonId ? seasonTitle(s.seasonScore) : null)
  const seasonScore = sameSeason ? s.seasonScore + score : score
  const seasonDays = sameSeason ? s.seasonDays + 1 : 1
  const wks = sameSeason
    ? Array.from({ length: SEASON_WEEKS }, (_, i) => s.seasonWeeks[i] ?? 0)
    : new Array(SEASON_WEEKS).fill(0)
  const col = seasonWeekOf()
  wks[col] = (wks[col] ?? 0) + score
  // both ladders can hand out a title on the same day, so they are applied in turn
  // rather than either one overwriting the other
  const withStreak = rw?.title && !s.titles.includes(rw.title) ? [...s.titles, rw.title] : s.titles
  const titles = closing && !withStreak.includes(closing.title)
    ? [...withStreak, closing.title] : withStreak
  return { ...paid, daily: false, dailyDay: key, dailyScore: score,
    dailyMet: met.map(g => g.id),
    dailyBest: Math.max(s.dailyBest, score), dailyStreak: streak,
    graceWeek: forgiven ? wk0 : s.graceWeek,
    // SAVE-6: capped where it GROWS, not only where it loads, or the save itself bloats
    larder: rw?.kit ? [...s.larder, rw.kit].slice(-LARDER_MAX) : s.larder,
    titles,
    seasonId: sk, seasonScore, seasonDays, seasonWeeks: wks,
    seasonBest: Math.max(s.seasonBest, seasonScore),
    weekId: wk, weekScore, weekBest: Math.max(s.weekBest, weekScore) }
}

export function endSession(s0: GameState, rng: RNG): GameState {
  let s = bankDaily(s0, rng)   // DAILY-2: the session's rng, so a daily level-up rolls off the run
  // CARD-6: the consequence arrives here, once, on the way off the boulder
  const cause = s.inRun ? curseEarned(s) : null
  if (cause) s = addCurse(s, cause)
  const beta = Array.from(new Set([...s.beta, ...s.worked]))
  if (s.circuit) {
    if (s.result !== 'send') {
      const best = Math.max(s.bestCircuit, s.circuitScore)
      return recordRun({ ...s, beta, bestCircuit: best, phase: 'runEnd', result: 'fall' }, false)
    }
    const n = s.circuitScore + 1
    s = gainXp({ ...s, circuitScore: n, sends: s.sends + 1,
      psyche: Math.min(psycheMax(s), s.psyche + PSYCHE_SEND),
      bestCircuit: Math.max(s.bestCircuit, n) }, xpForSend(specOf(s).grade), rng)
    // SKIRM-6: crossing into a deep zone (The Business at 10, Into the Dark at
    // 14 — past the enduro deed at line 8) offers a boon, so the endless deck
    // can break a RULE, not only grow a card every third line. The next line's
    // route is set now so the pick returns straight to circuitNext.
    const deepZone = circuitZone(n).floor === n && n >= 10
    const boonOffer = deepZone ? gearOffers(s, rng) : []
    if (boonOffer.length) return { ...s, beta, skirmish: circuitRoute(n, rng),
      gearOffers: boonOffer, phase: 'gear' }
    // a card every third line, so the deck grows with the grade
    if (n % 3 === 0) return { ...s, beta, offers: rollOffers(rng, 3, false, Math.min(2, Math.floor(n / 6))),
      phase: 'reward' }
    return { ...s, beta, skirmish: circuitRoute(n, rng), phase: 'circuitNext' }
  }
  if (s.result === 'send') {
    const paid = cashForSend(specOf(s).grade) * (s.onProject ? 2 : 1)
    const book = logSend(s)
    s = gainXp({ ...s, sends: s.sends + 1, book, cash: s.cash + paid,
      psyche: Math.min(psycheMax(s), s.psyche + PSYCHE_SEND) },
      xpForSend(specOf(s).grade), rng)
    // finishing an act's guidebook pays once, in XP and a card you keep
    for (let a = 0; a < ACTS.length; a++) {
      const key = `act${a}`
      if (s.ticked.includes(key) || !actTicked(book, a)) continue
      const rares = BY_RARITY('rare').filter(n => !s.owned.includes(n))
      s = gainXp({ ...s, ticked: [...s.ticked, key],
        owned: rares.length ? [...s.owned, rares[rng.int(rares.length)]] : s.owned }, ACT_XP, rng)
    }
  }
  const gate = (next: GameState): GameState =>
    next.packCards.length ? { ...next, afterPack: next.phase, phase: 'pack' } : next
  // FA-1: a first ascent — in a run OR as the standalone THE FA mode — is sent,
  // then NAMED. You do not get a reward screen; you get to grade it (claimStep).
  // This sits BEFORE the !inRun return so the menu's THE FA reaches the claim
  // too; it used to be reachable only from the in-campaign fa node.
  if (s.result === 'send' && s.skirmish?.fa) {
    const paid = cashForSend(s.skirmish.grade)
    return gainXp({ ...s, beta, sends: s.sends + 1, cash: s.cash + paid,
      psyche: Math.min(psycheMax(s), s.psyche + PSYCHE_SEND), phase: 'claim' },
      xpForSend(s.skirmish.grade) + 20, rng)
  }
  if (!s.inRun) return gate({ ...s, beta, phase: 'sessionEnd' })
  const map = ACTS[s.act]
  // a boulder that beats you costs psyche, whether you were projecting it or not
  if (s.inRun && s.result !== 'send')
    s = { ...s, psyche: Math.max(0, s.psyche - PSYCHE_FAIL) }
  const isBoss = map[s.tier].some(n => n.type === 'boss')
  const lastAct = s.act >= ACTS.length - 1
  const finale = specOf(s).finale === true
  if (s.skin <= 0 || s.psyche <= 0)
    return gate(recordRun({ ...s, beta, phase: 'runEnd', result: 'fall' }, false))
  if (s.result === 'send' && s.onProject) {
    // a project pays gear — otherwise boss-only — and a card on top
    return gate({ ...s, beta, onProject: false, gearOffers: gearOffers(s, rng),
      offers: rollOffers(rng, 3, false, s.act), phase: 'gear' })
  }
  if (s.onProject) {
    // it did not go. The days are spent either way.
    return gate(noteTrail({ ...s, beta, onProject: false, tier: s.tier + 1, phase: 'map' },
      trailNote(s)))
  }
  if (s.result === 'send') {
    if (isBoss) {
      // an act boss that is not the finale sends you over the pass to the next range
      if (!(lastAct && finale)) {
        if (s.tier + 1 < map.length)
          return gate({ ...s, beta, offers: rollOffers(rng, 3, false, s.act), phase: 'reward' })
        s = gainXp({ ...s, cash: s.cash + 35 }, 25, rng)
        return gate({ ...s, beta, act: s.act + 1, tier: 0, phase: 'gear',
          gearOffers: gearOffers(s, rng),
          skin: Math.min(RUN_SKIN + styleMods(s.style).skin, s.skin + ACT_SKIN) })
      }
      // a topropoed ascent counts for everything except the ladder
      // META-10: stamp the durable deed records the moment the finale goes, so
      // quiver/hardway never depend on the 20-deep rolling history again
      s = gainXp({ ...s, wins: s.wins + 1, psyche: psycheMax(s),
        archWins: Array.from(new Set([...(s.archWins ?? []), s.arch])),
        mutatorWin: (s.mutatorWin ?? false) || s.mutators.length > 0,
        journal: Array.from(new Set([...s.journal, SUMMIT_PAGE])),
        styleMax: s.topRope ? s.styleMax
          : Math.min(ASCENT.length - 1, Math.max(s.styleMax, s.style + 1)) }, 100, rng)
      // topping out the finale is not a result screen — there is something up there
      return { ...s, beta, phase: 'epilogue', result: 'send' }
    }
    return gate({ ...s, beta, offers: rollOffers(rng, 3, false, s.act), phase: 'reward' })
  }
  // failing the boss, or running out of map, ends the run rather than
  // advancing past the last tier
  if (isBoss || s.tier + 1 >= map.length)
    return gate(recordRun({ ...s, beta, phase: 'runEnd', result: 'fall' }, false))
  // FALLING IS LEARNING. A lost session still banks something, or climbing is
  // a coin flip that can whiff entirely and skipping it becomes correct.
  return gate({ ...s, beta, offers: rollOffers(rng, 2, true, s.act), phase: 'reward' })
}

function refillAndDraw(s: GameState, rng: RNG): GameState {
  const boardH = s.boardH.slice()
  const holdDeck = s.holdDeck.slice(), feetDeck = s.feetDeck.slice()
  const ph = phaseOf(s)
  let drawn = 0                                              // RUN-9: holds that came up
  for (const i of [0, 1]) {
    if (ph?.lockLane === i) { boardH[i] = null; continue }   // nothing out there
    if (!boardH[i] && holdDeck.length) {
      const h = holdDeck.pop()!
      drawn++
      boardH[i] = ph?.allCrux && !h.crux ? { ...h, crux: true, grip: h.grip + 2 } : h
    }
  }
  // RUN-9: a hold you had read is on the board now, so it is no longer "ahead".
  const readAhead = Math.min(holdDeck.length, Math.max(0, s.readAhead - drawn))
  if (!boardH[2] && feetDeck.length) boardH[2] = feetDeck.pop()!
  const gm = gearMods(s.gear)
  const want = HAND_SIZE + gm.handSize + boonMods(s.boons).dDraw
    + (s.inRun ? (archOf(s).dHand ?? 0) : 0) + (s.turn === 1 ? gm.drawFirst : 0)
    - (mutMods(s.mutators).retain ? SUSTAINED_CUT : 0)   // RUN-11: a smaller working hand
  const piles = pileDraw(s.piles, Math.max(0, want - s.piles.hand.length), rng)
  if (gm.brushFirst && s.turn === 1) for (const i of [0, 1])
    if (boardH[i]) { boardH[i] = clearDirt({ ...boardH[i]!, clean: true }); break }
  return { ...s, boardH, holdDeck, feetDeck, piles, readAhead }
}

export function startBurn(s: GameState, rng: RNG): GameState {
  const spec = specOf(s)
  const { holds, feet } = buildRoute(s, rng)
  const dc = (s.inRun && archOf(s).ignoreWeather) ? 0 : WEATHER[s.weather].dContact
  const gm = gearMods(s.gear)
  const base = s.customDeck ?? (s.runDeck.length ? s.runDeck : makeDeck(s.deckTier))
  // the finale hands you a beta card for every journal page you carry
  const withBeta: Card[] = spec.finale ? [...base, ...betaDeck(s.journal)] : base
  const tags = tagCounts(withBeta)
  const deck = rng.shuffle(withBeta.map((c): Card => c.kind !== 'move' ? c : {
    ...c,
    contact: Math.max(1, Math.round((c.contact + dc + gm.dContact
      + (s.inRun ? (archOf(s).dContact ?? 0) + mutMods(s.mutators).dContact + boonMods(s.boons).dContactAll : 0))
      * (boonMods(s.boons).dyno ? 0.5 : 1))),
    power: Math.max(0, c.power + (c.lane === 'feet' ? gm.dPowerFeet : gm.dPowerHand)
      + (c.synergy ? Math.floor((tags[c.synergy] ?? 0) / SYNERGY_PER) : 0)),
  }))
  return refillAndDraw({
    ...s, holdDeck: holds, feetDeck: feet,
    boardH: [null, null, null], boardP: [null, null, null],
    piles: { draw: deck, discard: [], exhaust: [], hand: [] },
    // BAL-15: a wind burn starts part-pumped — the go, not a fresh body. The
    // flag is spent here, so only the burn the wind bought pays it.
    pump: s.windBurn ? Math.floor(PUMP_MAX * WIND_PUMP) : 0,
    windBurn: false,
    flow: 0, cleared: 0, worked: [], turn: 1, phaseSeen: '',
    // the belay is your first piece: on a rope you are never on nothing
    runout: 0, lastPiece: spec.roped ? 0 : -1, pitch: 0, savedBlow: false, peakPump: 0,
    // DAILY-2: per-burn, like peakPump above it — a fresh go asks the objective again
    rests: 0, cruxFree: 0,
    clipped: false, seq: null, readAhead: 0,
    // CARD-9: a second wind buys a go on THIS boulder only — clear it when a
    // fresh line begins (burn 1), keep it across a retry on the same line.
    bonusBurns: s.burn <= 1 ? 0 : (s.bonusBurns ?? 0),
    order: [],
    routeMove: null,
    beta: (styleMods(s.inRun ? s.style : 0).noBeta || (s.inRun && archOf(s).noBeta))
      ? [] : Array.from(new Set([...s.beta, ...betaFromBook(s)])),
    phase: 'climb', result: null, selected: null,
    log: [`Burn ${s.burn} of ${attemptsFor(s)}. ${spec.note}`],
  }, rng)
}

const effGrip = (h: Hold, beta: string[], betaGrip = BETA_GRIP) =>
  Math.max(0, h.grip - (beta.includes(h.name) ? betaGrip : 0))
/** Beta is worth what your archetype says it is worth. */
export const gripFor = (s: GameState, h: Hold) =>
  effGrip(h, s.beta, s.inRun ? (archOf(s).betaGrip ?? BETA_GRIP) : BETA_GRIP)

/* The preview was made 100% accurate by UX-4 and that quietly cost the game a
   stated pillar: if a turn can be read exactly before you commit, committing
   is arithmetic rather than a gamble. The numbers are still exact underneath —
   this is what you can SEE. A hold you have worked reads true; one you have
   not reads as a range, and projecting is what buys you the certainty. */
export const WOBBLE = 1

/* ENG-15. The v0 baseline said "dynos skip segments on a commitment check".
   What shipped was `commit`: clears any hold, then burns out — guaranteed, no
   check, no skip, which made the most committing move in climbing the safest
   card in the deck. It is a gamble now, and the odds are yours to set: you
   stick a dyno when you are fresh and with your feet on, not when you are
   pumped out of your mind. */
/* ENG-16. Pump only ever went one way: you gained it, you shed it, and
   nothing in the game ever wanted you to have any. That made "shake out or
   push on" a question about delay rather than a real choice. A desperate move
   is stronger the closer you are to coming off — and it argues directly with
   the dyno, which wants you fresh. */
export const DESPERATE_PER = 2
/** What a greedy move gains from how cooked you are. */
export const desperationOf = (s: GameState) => Math.floor(s.pump / DESPERATE_PER)

export const STICK_BASE = 0.9
export const STICK_PUMP = 0.6      // how much being pumped costs you
export const STICK_FEET = 0.15     // and what having your feet on is worth
/** The odds of sticking a dyno, right now. Shown before you commit. */
export function stickChance(s: GameState): number {
  const fresh = 1 - Math.min(1, s.pump / PUMP_MAX)
  const feet = s.boardP[2] ? STICK_FEET : 0
  const flow = s.flow >= FLOW_HIGH ? 0.15 : s.flow >= FLOW_AT ? 0.05 : 0   // ENG-23: dialed in, you throw for it
  return Math.max(0.15, Math.min(0.97,
    STICK_BASE - STICK_PUMP * (1 - fresh) + feet + flow))
}
/* ENG-12. A sideways pull needs something pulling back. Alone it is weak;
   opposed by the other hand it is the strongest thing you can do. */
/* ENG-13. The last hold of a route played exactly like the first: nothing
   about being high up changed anything. This is deliberately not another
   difficulty ramp — bite is the most explosive dial in the game and a per-turn
   cost compounds out of all proportion (measured four times). What changes is
   what a mistake COSTS, so pushing on when you are nearly there is a real
   gamble and backing off late genuinely hurts. */
/* RUN-7. The map showed one tier at a time, so every choice was made blind to
   what it was choosing between — you could not know that spending this camp
   meant meeting the boss without one. Seeing the next stage turns a menu into
   a line you can plan two moves of. */
export function tierAhead(s: GameState): MapNode[] {
  const map = ACTS[s.act]
  return map && s.tier + 1 < map.length ? map[s.tier + 1] : []
}
/** What is coming, in the words the map uses. */
export function aheadSummary(s: GameState): string {
  const next = tierAhead(s)
  if (!next.length) {
    return s.act + 1 < ACTS.length ? 'the next range' : 'the last thing on the wall'
  }
  const seen = new Map<string, number>()
  for (const n of next) {
    const k = n.type === 'boss' ? 'a boss climb'
      : n.type === 'camp' ? 'a camp' : n.type === 'event' ? 'whatever turns up'
      : n.type === 'shop' ? 'a trading post' : n.type === 'project' ? 'a project'
      : n.type === 'fa' ? 'an unclimbed line' : n.type === 'established' ? 'one of yours'
      : ROUTES[n.routeIdx] ? `${ROUTES[n.routeIdx].name} (${gradeLabel(ROUTES[n.routeIdx])})` : 'a climb'
    seen.set(k, (seen.get(k) ?? 0) + 1)
  }
  return [...seen].map(([k, n]) => (n > 1 ? `${n} × ${k}` : k)).join(' · ')
}
/** Is the boss the very next thing? Worth saying out loud. */
export const bossNext = (s: GameState) => tierAhead(s).some(n => n.type === 'boss')
/** Is there still a boss between here and the end of the range? */
export function bossAhead(s: GameState): boolean {
  const map = ACTS[s.act] ?? []
  for (let t = s.tier + 1; t < map.length; t++)
    if (map[t].some(n => n.type === 'boss')) return true
  return false
}
/** Is there a camp coming before the boss? The question people actually ask. */
export function campBeforeBoss(s: GameState): boolean {
  const map = ACTS[s.act] ?? []
  for (let t = s.tier + 1; t < map.length; t++) {
    if (map[t].some(n => n.type === 'boss')) return false
    if (map[t].some(n => n.type === 'camp')) return true
  }
  return false
}

/* ROPE-4. Protection only ever reduced what a fall cost, and with an average
   runout of 1.2 holds that was worth about one skin — never a card slot. A
   rack measured 5%→2%, 2%→2%, 0%→0% across the three roped routes: engaging
   with the subsystem made you worse at it. What a piece actually buys a
   climber is not a smaller fall, it is the nerve to try the move. */
export const CLIPPED_POWER = 1
export const EXPOSED_AT = 0.7
/* Measured twice: a per-FALL penalty is not a sharpening, it is a different
   game. Charging a skin took skin deaths from ~25% to 58-81%; charging a
   psyche instead took psyche deaths to 72-79%. You fall constantly — that is
   the whole point of projecting — so exposure touches only the thing that is
   rare and deliberate: choosing to walk away when you were nearly there. */
export const EXPOSED_SKIN = 0
export const EXPOSED_FALL_PSYCHE = 0
export const EXPOSED_PSYCHE = 1
/** How far up you are, 0 to 1. */
export const exposureOf = (s: GameState) => {
  const c = specOf(s).clear
  return c > 0 ? Math.min(1, s.cleared / c) : 0
}
/** High enough that coming off is going to hurt. */
export const exposed = (s: GameState) => exposureOf(s) >= EXPOSED_AT

export const OPPOSE_ALONE = -2
export const OPPOSE_PAIR = 2

/* ENG-11. "The route is the opponent" has been the thesis since v0 and the
   opponent has never done anything: holds are static numbers and only a boss
   phase ever changes one. The route now makes a move — telegraphed a full turn
   ahead, so it is a fight you can read rather than a dice roll in your face. */
/* ENG-21. The four original moves all did the same KIND of thing: they mutated a
   hold's numbers. The route could make the wall harder or easier and that was the
   whole vocabulary — it never engaged the climber, only the stone. Three moves that
   act on YOU:
     spit    — the hold REJECTS a placement that is not positive enough: the card comes
               back to your hand and the lane goes unanswered this turn. Judged on what
               each lane is actually judged on — Power in the hands, Support on the feet
               — because every feet card is Power 0-3, so a Power rule would have spat
               nearly all of them. Rests are Power 0, so a spitting hold will not hold a
               shake-out, which is the decision it asks for.
               IT RETURNS THE CARD RATHER THAN BURNING IT, and that is a balance
               requirement, not a kindness. Moves fire on a TIMER (MOVE_EVERY), so any
               net cost in the move table scales with how long a climb takes — which
               punishes the long lines and the slow climbers, not the player's choices.
               Destroying the card broke ROUTE-8 outright (guide 55.4 against direct 49
               and traverse 47, both traps) and put an archetype on 5%. Costing the
               TEMPO and not the card keeps the decision and drops the damage.
     pin     — no shaking out in that lane this turn. The rest still costs you the
               card and the position; it just does not pay.
     stance  — the gift. A no-hands stance: the hand lanes get the Support you never
               placed, and you are not campusing while you have it. It paid a DRAW in
               the first cut and that shipped dead — `refillAndDraw` tops the hand
               back to HAND_SIZE at the end of every turn, so the extra card was
               absorbed the same turn it arrived. Support survives because it is spent
               inside the turn, and it rides `powerAgainst`/`biteAgainst`, which the
               preview and resolve already share.
   BOARD AND LANE EFFECTS ONLY, and no per-turn pump term anywhere in them — that
   compounds, which this project has measured five separate times (ENG-23 last).
   `stance` pays in a CARD rather than pump relief for the same reason: ENG-23 put
   clock relief at +7 to +13 points of completion, which is a lever, not a gift. */
export type RouteMove = {
  kind: 'grease' | 'dry' | 'gust' | 'crumble' | 'spit' | 'pin' | 'stance'
  lane: number; text: string
}
export const MOVE_EVERY = 3        // roughly one telegraph every this many turns
export const MOVE_GRIP = 2
export const MOVE_BITE = 1
/** A hold that spits rejects a hand card under this much Power... */
export const MOVE_SPIT = 3
/** ...and a foot under this much Support. Feet are judged on what they hold, not
    on Power: every feet card in the game is Power 0-3 and Support 1-2, so Power
    would have spat almost all of them and Support tells a smear from a solid edge. */
export const MOVE_SPIT_SUPPORT = 2
/* ENG-32. The feet lane read as "a lane you fill, not a decision you make", and
   measuring it showed the premise was half wrong in a useful way: 38.9% of every hold
   worked in a campaign is worked by the FEET lane. A third of the climb was already
   happening down there and nothing said so.
   What was missing was the trade. A foot gave its full Support the instant it landed,
   so there was no cost to moving your feet and no reward for leaving them alone —
   and the card pool already carries the shape of a trade (Support 2+ averages 1.0
   Power, Support 1 averages 1.6), it just never bit.
   Support is EARNED now: a foot placed this turn withholds this much, and pays in
   full once it has settled. That is the climbing truth and it makes the pool's own
   trade real — a high-Power foot tends to CLEAR its hold, which takes it off the wall
   before it can ever settle, so stepping up costs you the Support that standing still
   would have given you. Lane-local by construction: no cross-lane ordering, and it
   rides `powerAgainst`, which the preview and resolve already share.
   A FRESH FOOT NEVER DROPS BELOW ONE SUPPORT, and that floor is the whole difference
   between a good idea and a shippable one. Charged flat, this measured 2.0 points of
   completion (paired n=2700: 53.0 → 51.0) and took two other guards with it — the
   weakest climber to 4.3% against its 5% floor, and CARD-9 to a NEGATIVE lift, because
   a Second Wind burn starting part-pumped is worth less than nothing once the base is
   that much harder. Support is load-bearing enough that one point of it, withheld
   everywhere, is a difficulty change rather than a texture change. Floored, it bites
   only the Support-2 placements — the ones whose Support is worth the most, and the
   ones you would actually think twice about rushing — and a smear still does the
   little it always did. */
export const FOOT_FRESH = 1
/** What a gifted no-hands stance is worth, as Support you did not have to place. */
export const STANCE_SUPPORT = 1
/** The moves that are good news, for anything that has to tell the two apart. */
export const MOVE_GIFTS: RouteMove['kind'][] = ['dry', 'stance']
/* ROUTE-11. How hard the live condition leans on which move comes. A trade
   inside an opposed pair (grease↔dry for the air, crumble↔gust for the stone),
   so the four still sum to a fixed 100 and the roll still draws exactly one
   number — stream-neutral, no guard moves on drift. Tuned so the campaign band
   holds: the act climates are not evenly wet/dry, so a big lean would drag the
   number; these are the largest tilts that still net flat across the acts. */
export const MOVE_WET = 14         // seeping air greases; crisp air dries
export const MOVE_FRIABLE = 12     // soft stone flakes instead of gusting

/** How the four moves are weighted for the condition you are actually in.
    grease/dry/gust/crumble, out of a fixed total. */
export function moveWeights(s: GameState): [number, number, number, number, number, number, number] {
  /* ENG-21 gives the three new kinds a fixed 25 of the 100 and scales the old four
     onto the remaining 75, keeping their ratios. The conditional trades below still
     run INSIDE the old opposed pairs, so the seven sum to a fixed 100 and the roll
     still draws exactly one number. Both leans stay smaller than the weight they
     lean on, so no kind can go negative:
       grease 26 ± MOVE_WET(14) · dry 18 ± 14 · gust 16 ± MOVE_FRIABLE(12) · crumble 15 ± 12

     THESE WEIGHTS ARE PRICED ON MEASURED BITE RATE, NOT ON THE NOMINAL NUMBER — the
     finding that cost two tuning passes. `grease` and `dry` do something 100% of the
     times they fire; the new costs are CONDITIONAL, and measured over 900 climbs
     `spit` bit 30% of the time at MOVE_SPIT 2 and `pin` 26%. So the first cut swapped
     ~10 points of always-biting cost for ~9 of always-paying gift and only ~6 of
     effective cost, and the band went 53.7 → 56.1. Raising MOVE_SPIT to 3 takes
     spit's bite to 69% (4 would be 86% — near-unconditional, and a guaranteed card
     loss is not a decision), and `pin` is deliberately small: it constrains where a
     HUMAN shakes out, and the harness policy rests 0.3× a run, so it is close to
     inert on-band by nature rather than by mistake. Stated, not hidden. */
  let grease = 30, dry = 21, gust = 19, crumble = 18
  const spit = 5, pin = 3, stance = 4
  const wx = WEATHER[s.weather], rk = ROCK[s.rock]
  // humid and drizzle seep (sloper friction up, feet going); crisp and freezing
  // come into nick — the two conditions the player already sees on the paper
  const wet = !!wx && (wx.sloperGrip >= 2 || (wx.dSupport ?? 0) < 0)
  const dryAir = !!wx && wx.dBite < 0
  if (wet) { grease += MOVE_WET; dry -= MOVE_WET }
  else if (dryAir) { grease -= MOVE_WET; dry += MOVE_WET }
  // sandstone is the friable one — it is what flakes; the harder rock gusts
  if (rk && rk.name === 'sandstone') { crumble += MOVE_FRIABLE; gust -= MOVE_FRIABLE }
  return [grease, dry, gust, crumble, spit, pin, stance]
}
/** Whether a spitting hold rejects what you put on it: Power in the hands, Support
    on the feet. One rule — the hold will not take a placement that is not positive
    enough — read through the measure that lane is actually judged on. */
export const spitRejects = (c: Card | null, lane: number) =>
  !!c && (lane < 2 ? c.power < MOVE_SPIT : (c.support ?? 0) < MOVE_SPIT_SUPPORT)

/** What the route is about to do. Rolled from the run RNG at the end of a turn. */
export function rollRouteMove(s: GameState, rng: RNG): RouteMove | null {
  const lanes = [0, 1, 2].filter(i => s.boardH[i])
  if (!lanes.length) return null
  /* THE DRAW ORDER IS LOAD-BEARING: lane first, then kind, exactly as it was before
     ENG-21, and exactly two draws. An earlier cut rolled the KIND first so that
     `spit` could be kept off the feet lane — and swapping two draws reshuffles every
     roll after it in the run. That is not free: measured against the shipped build it
     moved the CARD-9 wind arm by +2.9 points on its own and took the Second Wind's
     lift from 2.4 to over 5, which reads as ENG-21 breaking the ceiling when it was
     the reshuffle. Spit is judged per lane instead (see `spitRejects`), so the stream
     is untouched and what the ledger measures is the feature. */
  const lane = lanes[rng.int(lanes.length)]
  const where = LANE_NAMES[lane].toLowerCase()
  const [wg, wd, wgu, wc, wsp, wpi] = moveWeights(s)
  const r = rng.next() * 100
  const kind: RouteMove['kind'] =
      r < wg ? 'grease'
    : r < wg + wd ? 'dry'
    : r < wg + wd + wgu ? 'gust'
    : r < wg + wd + wgu + wc ? 'crumble'
    : r < wg + wd + wgu + wc + wsp ? 'spit'
    : r < wg + wd + wgu + wc + wsp + wpi ? 'pin'
    : 'stance'
  if (kind === 'grease') return { kind, lane, text: `The ${where} hold is greasing up.` }
  if (kind === 'dry') return { kind, lane, text: `A breeze on the ${where} hold. It is coming into condition.` }
  if (kind === 'gust') return { kind, lane, text: 'Wind coming up the face. All of it is about to bite.' }
  if (kind === 'crumble') return { kind, lane, text: `Something is flaking off the ${where} hold.` }
  if (kind === 'spit') return { kind, lane, text: lane < 2
    ? `The ${where} hold is not holding much — it will spit anything under ${MOVE_SPIT} Power.`
    : `The ${where} hold is greasy — a foot with less than ${MOVE_SPIT_SUPPORT} Support will pop off it.` }
  if (kind === 'pin') return { kind, lane, text: `No shaking out on the ${where} hold this turn.` }
  return { kind, lane, text: `A no-hands stance off the ${where} hold. Time for a look up.` }
}

/** Apply what was telegraphed last turn. Returns the holds and any log lines. */
/** Apply what was telegraphed last turn. ONE function for resolve and both preview
    entry points, so they cannot disagree about what the route just did — the ENG-19
    lesson. `spat` is handed back rather than filed here, because only resolve holds
    the piles; `noRestLane` is -1 when nothing is pinned. */
export function applyRouteMove(m: RouteMove, boardH: (Hold | null)[],
  boardP: (Card | null)[] = [null, null, null]): {
  boardH: (Hold | null)[]; boardP: (Card | null)[]; log: string[]
  spat: Card | null; noRestLane: number
} {
  const out = boardH.slice(), log: string[] = []
  const outP = boardP.slice()
  const none = { boardP: outP, spat: null, noRestLane: -1 }
  const h = out[m.lane]
  if (m.kind === 'gust') {
    for (let i = 0; i < 3; i++) if (out[i]) out[i] = { ...out[i]!, bite: out[i]!.bite + MOVE_BITE }
    log.push('The wind arrives. Everything bites harder.')
    return { boardH: out, log, ...none }
  }
  // ENG-21: the three that act on you rather than on the stone
  if (m.kind === 'spit') {
    const c = outP[m.lane]
    if (spitRejects(c, m.lane)) {
      outP[m.lane] = null
      log.push(`${h ? holdLabel(h) : 'The hold'} spits ${c!.name} off. Back in your hand — put it somewhere else.`)
      return { boardH: out, log, boardP: outP, spat: c, noRestLane: -1 }
    }
    if (c) log.push(`${c.name} holds on where a weaker one would not.`)
    return { boardH: out, log, ...none }
  }
  if (m.kind === 'pin') {
    log.push(`${h ? holdLabel(h) : 'That hold'} — no rest to be had there this turn.`)
    return { boardH: out, log, boardP: outP, spat: null, noRestLane: m.lane }
  }
  // the stance itself is a flag on the post-move state (see afterMove); nothing here
  if (m.kind === 'stance') {
    log.push('You get your weight over your feet. Hands off, and it feels solid.')
    return { boardH: out, log, ...none }
  }
  if (!h) return { boardH: out, log, ...none }
  if (m.kind === 'grease') {
    out[m.lane] = { ...h, grip: h.grip + MOVE_GRIP }
    log.push(`${holdLabel(h)} greases up. Harder than it was.`)
  } else if (m.kind === 'dry') {
    out[m.lane] = { ...h, grip: Math.max(1, h.grip - MOVE_GRIP) }
    log.push(`${holdLabel(h)} dries out. Better than it was.`)
  } else {
    out[m.lane] = { ...h, bite: h.bite + MOVE_BITE, clean: true }
    log.push(`${holdLabel(h)} loses a flake. Sharper, and whatever it did is gone.`)
  }
  return { boardH: out, log, ...none }
}
/* ENG-21. The board as the telegraphed move leaves it, for the two preview entry
   points. `routeMove` is CLEARED on the way out: previewPump builds this state and
   then calls previewLane on it, which used to apply the same move a second time —
   unreachable today because every caller passes precomputed lanes, but a grease
   would have counted twice the moment one did not. Closed rather than left set. */
export function afterMove(s: GameState): { s: GameState; noRestLane: number } {
  if (!s.routeMove) return { s, noRestLane: -1 }
  const d = applyRouteMove(s.routeMove, s.boardH, s.boardP)
  return { s: { ...s, routeMove: null, boardH: d.boardH, boardP: d.boardP,
      stance: s.routeMove.kind === 'stance' },
    noRestLane: d.noRestLane }
}
/** Only beta makes a hold readable. Anything else would let you tell the
    wobbled holds from the flat ones by whether they showed a span at all. */
export const holdKnown = (s: GameState, h: Hold) => s.beta.includes(h.name)
/** What the player may read off a hold: a number once worked, a span before.
    The span is always WOBBLE wide, so it gives away nothing about which side
    of it this particular hold sits on. */
export function gripShown(s: GameState, h: Hold): { lo: number; hi: number; sure: boolean } {
  const g = gripFor(s, h)
  // A11Y-4: the assist reads it exactly, the way projecting or beta would — a
  // clarity option, not a change to the grip itself.
  if (holdKnown(s, h) || s.assist) return { lo: g, hi: g, sure: true }
  const base = Math.max(1, g - (h.wobble ?? 0))
  return { lo: base, hi: base + WOBBLE, sure: false }
}

/** Power a card brings to a lane, after abilities and conditions. */
/* What the feet are actually giving your hands, before the receiving hold's own
   ability has its say. ENG-19's lesson is why this is a function and not a second
   copy of the sum: the screen has to print this number, and two copies of one formula
   drift. `powerAgainst` is the only consumer of the total; the per-hold parts
   (Featureless, Two-finger) stay where the hold is known. */
export function supportNow(s: GameState): number {
  const feetCard = s.boardP[2]
  /* ENG-21: a gifted stance is the feet you did not place, so it pays in SUPPORT —
     which is what ENG-20 allows a condition to move (Bite and Support, never Power).
     It rides the same conditions a real foot placement does, so wet rock devalues a
     stance exactly as it devalues your feet. A gift arrives ready to stand on, so it
     pays no ENG-32 settling cost — there is no placement to have rushed. */
  const stanceSup = s.stance && !feetCard ? STANCE_SUPPORT : 0
  if (!feetCard && !stanceSup) return 0
  /* ENG-32: a foot pays in full only once it has settled — but never below one, so
     the cost lands on the solid placements rather than flattening every smear to
     nothing. See the note on FOOT_FRESH for what the unfloored version measured. */
  /* ...and never on the opening turn: there was no previous turn you could have kept
     your feet from, so charging it there taxes every burn's START rather than a choice
     you made. It landed hardest on the one place that is nothing but opening turns —
     a Second Wind burn, which begins part-pumped — and inverted CARD-9's contract. */
  const quick = s.inRun && archOf(s).quickFeet === true
  const fresh = feetCard && !feetCard.set && s.turn > 1 && !quick
    ? Math.max(0, Math.min(FOOT_FRESH, feetCard.support - 1)) : 0
  return Math.max(0, (feetCard ? feetCard.support : stanceSup) - fresh
    + gearMods(s.boardP ? s.gear : []).dSupport
    + (WEATHER[s.weather]?.dSupport ?? 0)
    + (windowOf(s)?.dSupport ?? 0))           // ROUTE-6: the feet stop trusting it
}
export function powerAgainst(s: GameState, card: Card, hold: Hold, lane: number,
  live?: (Card | null)[]): number {
  const wb = boonMods(s.boons)
  const board = live ?? s.boardP
  const feetHold = s.boardH[2]
  const featureless = feetHold ? abilityOf(feetHold) === 'Featureless' : false
  const bm = boonMods(s.boons)
  // wet rock: your feet are worth less, which every deck feels
  const sup = supportNow(s)
  // Big Hands: Support normally favours one hand; this reaches both
  // Big Hands doubles what the feet give; it does not gate the default
  const eff = bm.wideSupport ? sup * 2 : sup
  const support = lane < 2 && !featureless
    ? eff + (abilityOf(hold) === 'Two-finger' ? -eff : 0) : 0
  let p = card.power + (card.settled ?? 0) + support
  // ENG-16: was a binary +2 above pump 7 on two cards. It scales now, so
  // being pumped is a thing some of your deck actually wants.
  // above a piece you have just placed, you commit
  if (s.clipped && specOf(s).roped) p += CLIPPED_POWER
  if (card.fx === 'greedy') p += desperationOf(s)
  if (card.fx === 'momentum') p += Math.min(3, s.flow)   // ENG-23: keep Power at the old ceiling; the raised flow cap feeds tempo
  if (s.inRun && s.turn === 1) p += archOf(s).firstTurnPower ?? 0
  if (s.inRun) p += archOf(s).dPower ?? 0
  if (card.fx === 'weight') p += s.boardP.filter((c, k) => c && k !== lane).length
  if (abilityOf(hold) === 'Greasy' && card.fx !== 'friction' && !s.boardP[2]) p -= 1
  if (abilityOf(hold) === 'Slick') p -= 1
  if (card.fx === 'precise' && (hold.name === 'crimp' || hold.name === 'sharp crimp')) p += 2
  // opposition: a gaston with nothing pulling against it is just a shrug
  if (card.opposes && lane < 2) {
    const other = board[1 - lane]
    p += !other ? OPPOSE_ALONE : (other.opposes ? OPPOSE_PAIR : 0)
  }
  if (wb.dyno) p *= 2                    // Deadpointing
  return Math.max(0, p + wb.dPowerAll)   // Free Solo
}

/** Bite a hold deals into a lane, after abilities and conditions. */
export function biteAgainst(s: GameState, card: Card | null, hold: Hold, lane: number): number {
  let b = hold.bite
  // ENG-21: a gifted stance means your weight is on your feet — that is not campusing
  if (lane < 2 && !s.boardP[2] && !s.stance && !boonMods(s.boons).noCampus) b += CAMPUS_BITE
  if (abilityOf(hold) === 'Squeeze' && s.boardH[0] && s.boardH[1]
    && !(card && card.fx === 'balance')) b += 1
  if (card && card.fx === 'static') b -= 1
  // a Guard in the other hand lane covers this one
  if (lane < 2 && s.boardP[1 - lane]?.fx === 'guard') b -= 1
  const ph = phaseOf(s)
  if (ph) b += ph.dBite ?? 0
  b += specOf(s).dBite ?? 0                // SKIRM-5: the Circuit's deep-zone teeth
  const win = windowOf(s)                  // ROUTE-6: the window closes
  if (win) b += win.dBite ?? 0
  if (s.inRun && s.topRope) b -= 1        // the rope is doing some of the work
  return Math.max(0, b)
}

export function resolve(s: GameState, rng: RNG): GameState {
  const boardH = s.boardH.slice(), boardP = s.boardP.slice()
  const holdDeckLocal = s.holdDeck.slice()
  let piles = s.piles, pump = s.pump, cleared = s.cleared
  let readAhead = s.readAhead                              // ROUTE-12: a signature can add to it
  const worked = s.worked.slice(), log: string[] = []
  // ENG-11: what the route said it would do last turn, it does now — before
  // anything of yours resolves, so the telegraph was worth reading
  let noRestLane = -1                                      // ENG-21: a pinned lane
  if (s.routeMove) {
    const done = applyRouteMove(s.routeMove, boardH, boardP)
    for (let i = 0; i < 3; i++) { boardH[i] = done.boardH[i]; boardP[i] = done.boardP[i] }
    log.push(...done.log)
    noRestLane = done.noRestLane
    /* a rejected card is HANDED BACK, not filed — see the note on `spit`. The lane
       going unanswered is the cost; the card is not. `settled` resets because it is
       off the wall, the same way an echo returns it. */
    if (done.spat) piles = { ...piles, hand: [...piles.hand, { ...done.spat, settled: 0, set: false }] }
  }
  // ENG-19: powerAgainst and biteAgainst read the feet hold (Support, campus)
  // out of the state they are handed. The move above has already changed the
  // board — a crumbled feet hold is no longer Featureless, so it grants Support
  // now — so they must read the post-move board, not s. previewLane does the
  // same thing; without this the preview and resolve disagree on exactly the
  // turn a feet hold flakes off.
  /* ENG-21: carries the post-move boardP and the stance as well as the holds. The
     boardP matters because `spit` removes a card and both `fx: 'weight'` and the
     opposition term count the OTHER lanes — reading the pre-move board there would
     have paid a card that is no longer on the wall. */
  const sMove: GameState = s.routeMove
    ? { ...s, boardH: boardH.slice(), boardP: boardP.slice(),
        stance: s.routeMove.kind === 'stance' }
    : s
  const fxLane = ['', '', '']
  let restedThis = false, clearedThis = 0
  /* DAILY-2: "feet off" is a decision you made when you committed the turn, so it
     reads the board you handed in — not the mutated one below, where a feet card
     that blew would look like a choice you never made. */
  const feetOff = !s.boardP[2]
  let cruxFree = s.cruxFree

  for (const c of boardP) if (c && c.fx === 'cycle') {
    piles = pileDraw(piles, 1, rng); log.push(`${c.name} · dig for the next one.`)
  }
  const bm = boonMods(s.boons)
  let savedBlow = s.savedBlow
  const roped = specOf(s).roped === true
  let runout = s.runout, lastPiece = s.lastPiece
  for (const c of boardP) if (c && c.clip && roped) {
    lastPiece = cleared; runout = 0
    log.push(`${c.name} in. That is the rope clipped.`)
  }
  const noRest = phaseOf(s)?.noRest === true || mutMods(s.mutators).noShakes
    || boonMods(s.boons).noRests
  // Kneebar Merchant: a rest is no longer purely defensive
  if (bm.restChips) for (let i = 0; i < 3; i++) {
    const c = boardP[i], h = boardH[i]
    if (c && c.shed > 0 && h) boardH[i] = { ...h, grip: Math.max(0, h.grip - bm.restChips) }
  }
  // CARD-11: a rest that works its own lane's hold while you shake out. Only
  // where you actually rest, and only if there is a rest to be had here.
  if (!noRest) for (let i = 0; i < 3; i++) {
    const c = boardP[i], h = boardH[i]
    // ENG-21: a pinned lane is no rest, so there is no chip to be had from it either
    if (i === noRestLane) continue
    if (c && c.restChip && h) boardH[i] = { ...h, grip: Math.max(0, h.grip - c.restChip) }
  }
  // CARD-13: a curse dumped onto a lane sharpens the hold there — the tweak, the
  // flapper, the seep makes the rock meaner, so a curse costs a position too
  for (let i = 0; i < 3; i++) {
    const c = boardP[i], h = boardH[i]
    if (c && c.hex && h) {
      boardH[i] = { ...h, grip: h.grip + c.hex }
      log.push(`${c.name} · the ${holdLabel(h)} is worse for it now.`)
    }
  }
  for (let i = 0; i < 3; i++) {
    const c = boardP[i]
    if (!c || !c.shed) continue
    // ENG-21: a pinned lane is the same deal the noRest phases already strike — the
    // rest costs you the card and the position and pays nothing, and it still counts
    // as having shaken out, so flow breaks exactly as it does everywhere else
    if (noRest || i === noRestLane) {
      restedThis = true; log.push(`${c.name} · nowhere to shake out up here.`); continue
    }
    pump = Math.max(0, pump - c.shed); restedThis = true
    log.push(`${c.name} · −${c.shed} pump, no progress.`)
  }
  if (!boardP[2]) log.push('Feet off — campusing.')

  // ENG-18: the order you placed them is the order they go
  const laneOrder = [...s.order.filter(i => i >= 0 && i < 3),
    ...[0, 1, 2].filter(i => !s.order.includes(i))]
  for (const i of laneOrder) {
    const hold = boardH[i], card = boardP[i]
    if (!hold) continue
    const ab = abilityOf(hold)
    const bite = biteAgainst(sMove, card, hold, i)
    if (!card) {
      pump += bite; fxLane[i] = 'bite'
      log.push(`Nothing on the ${hold.name}. +${bite} pump.`)
      continue
    }
    let power = powerAgainst(sMove, card, hold, i, boardP)
    if (ab === 'Committing' && power < 2) {
      power = 0
      log.push(`${hold.name}: too committing for ${card.name}.`)
    }
    const target = gripFor(s, hold)
    const snapped = card.fx === 'snap' && target <= 3
    // the commitment check: rolled from the run RNG, so a seed still replays
    const isDyno = card.fx === 'commit'
    const stuck = isDyno && rng.next() < stickChance(s)
    const committed = isDyno && stuck
    if (isDyno && !stuck) log.push(`${card.name} — off it. Did not stick.`)
    const g = snapped || committed ? 0 : target - power
    const c = card.contact - bite

    if (card.chip) {
      for (let k = 0; k < 3; k++) if (k !== i && boardH[k])
        boardH[k] = { ...boardH[k]!, grip: boardH[k]!.grip - card.chip }
      log.push(`${card.name} · squeezes the whole thing.`)
    }
    if (g <= 0) {
      cleared++; clearedThis++
      if (!worked.includes(hold.name)) worked.push(hold.name)
      if (ab === 'Rest') { pump = Math.max(0, pump - 1); log.push(`${card.name} works the jug. Shed 1.`) }
      else log.push(`${card.name} works the ${hold.name}.`)
      fxLane[i] = 'clear'
      if (committed && holdDeckLocal.length) {
        // "dynos skip segments" — you go straight past the next one
        const skipped = holdDeckLocal.pop()!
        cleared++; clearedThis++
        if (!worked.includes(skipped.name)) worked.push(skipped.name)
        log.push(`Stuck it — straight past the ${skipped.name}.`)
      }
      if (roped) runout += 1
      if (hold.crux && feetOff) cruxFree++          // DAILY-2
      // Crux Junkie
      if (bm.cruxDraw && hold.crux) {
        piles = pileDraw(piles, 1, rng)
        pump = Math.max(0, pump - bm.cruxShed)
        log.push(`Crux worked. Draw${bm.cruxShed ? `, shed ${bm.cruxShed}` : ''}.`)
      }
      // ROUTE-12: a signature is a feature you learn something FROM. Working it
      // the first time reads the next holds off the wall — the sequence you sussed
      // from that stance. Information, never power (ROUTE-10's lesson): it moves
      // readAhead, which the resolution never consults, so the band cannot feel it.
      if (hold.sig) {
        const sg = sigById(hold.sig)
        if (sg?.read) {
          readAhead = Math.min(holdDeckLocal.length, Math.max(readAhead, sg.read))
          log.push(`${holdLabel(hold)} — you read the next ${readAhead} hold${readAhead === 1 ? '' : 's'} off it.`)
        }
      }
      boardH[i] = null
      if (card.fx === 'echo') {
        piles = { ...piles, hand: [...piles.hand, { ...card, settled: 0, set: false }] }
        boardP[i] = null; log.push(`${card.name} comes back to hand.`)
        continue
      }
    } else boardH[i] = { ...hold, grip: g }

    if (c <= 0 || committed) {
      if (bm.saveBlow && !savedBlow && !committed) {
        savedBlow = true
        boardP[i] = { ...card, contact: 1 }
        log.push(`${card.name} should have gone. It holds on.`)
        continue
      }
      if (card.latch && !card.latched && !committed) {
        boardP[i] = { ...card, contact: 1, latched: true }
        log.push(`${card.name} latches. Barely.`)
      } else {
        boardP[i] = null; fxLane[i] = 'blow'
        piles = card.anchor && !committed ? pileDiscard(piles, [card]) : pileExhaust(piles, card)
        if (!committed) {
          if (card.fx === 'peel') { piles = pileDraw(piles, 1, rng); log.push(`${card.name} rips. You grab something else.`) }
          else if (card.fx === 'tough') log.push(`${card.name} blows, but takes it clean.`)
          else if (ab === 'Sharp') { pump += 1; log.push(`${card.name} blows on the ${hold.name}. Sharp — +1 pump.`) }
          else if (ab === 'Razor') {
            const victim = piles.hand[0]
            if (victim) { piles = { ...pileFromHand(piles, victim.uid), exhaust: [...piles.exhaust, victim] } }
            log.push(`Razor. ${card.name} blows and takes ${victim ? victim.name : 'nothing'} with it.`)
          } else log.push(`${card.name} blows.`)
        } else log.push(`${card.name} — all of it, all at once.`)
      }
    } else boardP[i] = { ...card, contact: c, set: true,   // ENG-32: it stood the turn
      settled: Math.min((card.settled ?? 0) + (card.fx === 'settle2' ? 2 : 1) + bm.settle,
        s.inRun ? (archOf(s).settleMax ?? SETTLE_MAX) : SETTLE_MAX) }
  }

  // Second Wind
  if (bm.shedEvery && clearedThis > 0 && cleared > 0 && cleared % bm.shedEvery === 0) {
    pump = Math.max(0, pump - 2)
    log.push(`Second wind. ${cleared} holds in — shed 2.`)
  }
  let out: GameState = { ...s, boardH, boardP, piles, pump, cleared, worked, runout, lastPiece,
    // DAILY-2: `restedThis` is the game's existing definition of having shaken out
    // (it is what flow and a `norest` sequence already read), so an objective and a
    // sequence agree about the same turn rather than inventing a second rule.
    readAhead, savedBlow, cruxFree, rests: s.rests + (restedThis ? 1 : 0),
    holdDeck: holdDeckLocal, fxLane, fxTick: s.fxTick + 1, log: [...s.log, ...log] }
  // the plan: satisfied, broken, or paid out
  if (out.seq) {
    const q = seqById(out.seq.id)
    if (!q) out = { ...out, seq: null }
    else if (!seqMet(q.need, clearedThis, restedThis, !!boardP[2])) {
      out = { ...out, seq: null, log: [...out.log, `${q.name} broken. It needed ${seqNeedText(q)}.`] }
    } else {
      const left = out.seq.left - 1
      if (left > 0) {
        out = { ...out, seq: { id: q.id, left },
          log: [...out.log, `${q.name} holding. ${left} more.`] }
      } else {
        let piles2 = out.piles, cleared2 = out.cleared, pump2 = out.pump
        const board2 = out.boardP.slice()
        if (q.onDone.clear) cleared2 += q.onDone.clear
        if (q.onDone.draw) piles2 = pileDraw(piles2, q.onDone.draw, rng)
        if (q.onDone.dumpPump) pump2 = 0
        if (q.onDone.contact || q.onDone.settle) for (let i = 0; i < 3; i++) {
          const c = board2[i]
          if (c) board2[i] = { ...c, contact: c.contact + (q.onDone.contact ?? 0),
            settled: (c.settled ?? 0) + (q.onDone.settle ?? 0) }
        }
        out = { ...out, seq: null, piles: piles2, cleared: cleared2, pump: pump2, boardP: board2,
          log: [...out.log, `${q.name} — done. It pays.`] }
      }
    }
  }
  // All In: draw deep, keep nothing
  if (bm.dumpHand && out.phase === 'climb' && out.piles.hand.length)
    out = { ...out, piles: pileDiscard({ ...out.piles, hand: [] }, out.piles.hand),
      log: [...out.log, 'All in. The hand goes.'] }
  // the move that was pending has now happened, so it is spent; then the route
  // calls its next one, a full turn ahead of doing it
  let move: RouteMove | null = null
  if (out.phase === 'climb' && out.turn % MOVE_EVERY === 0) move = rollRouteMove(out, rng)
  out = { ...out, routeMove: move }
  if (move) out = { ...out, log: [...out.log, `▸ ${move.text}`] }
  // the nerve a piece buys you lasts exactly one turn
  out = { ...out, bonusUsed: false, clipped: false }
  const nowPh = phaseOf(out)
  if (nowPh && out.phaseSeen !== nowPh.name)
    out = { ...out, phaseSeen: nowPh.name, log: [...out.log, `— ${nowPh.name.toUpperCase()} — ${nowPh.text}`] }
  // ROUTE-6: the window closing is logged the turn it lands (it did not apply
  // last turn and does this one), and telegraphed a hold before, like a phase.
  if (windowOf(out) && !windowOf(s))
    out = { ...out, log: [...out.log, `— THE WINDOW — ${windowOf(out)!.text}`] }
  else {
    const near = windowNear(out)
    if (near && near.away === 1) out = { ...out, log: [...out.log, `▸ ${near.w.warn}`] }
  }
  const spec = specOf(s)
  if (cleared >= spec.clear)
    return { ...out, peakPump: Math.min(PUMP_MAX, Math.max(out.peakPump, out.pump)), phase: 'burnEnd', result: 'send', log: [...out.log, `Topped out. ${spec.name} goes.`] }
  if (roped && spec.pitches && spec.pitches > 1) {
    const per = spec.clear / spec.pitches
    const reached = Math.floor(cleared / per)
    if (reached > out.pitch) {
      out = { ...out, pitch: reached, pump: 0, runout: 0, lastPiece: cleared,
        log: [...out.log, `— BELAY — Pitch ${reached} done. Anchor in, rope stacked, breathe.`] }
    }
  }

  const flow = clearedThis > 0 && (!restedThis || bm.keepFlow) ? Math.min(FLOW_MAX, s.flow + 1) : 0
  const tax = Math.max(0, HANG_TAX - (flow >= FLOW_AT ? FLOW_TAX : 0))
  const unanswered = [0, 1, 2].filter(i => boardH[i] && !boardP[i]).length
  const hooked = boardP[2]?.fx === 'hooked'
  const cruxTax = hooked ? 0 : boardH.filter(h => h && abilityOf(h) === 'Committing').length
  const doubt = s.inRun && s.psyche <= DOUBT_AT ? 1 : 0
  const add = HANG_FLAT + tax * unanswered + cruxTax + (phaseOf(s)?.dTax ?? 0) + doubt
    + (LINES[s.line]?.dTax ?? 0)
  pump = Math.max(0, pump + add - gearMods(s.gear).shedPerTurn)
  // ENG-24: dialed in (FLOW_HIGH), you read the coming holds — the top of the
  // flow bar's reward for a deck that has nothing to spend it on. Information,
  // never the clock (see the constant); refillAndDraw nets it as holds arrive.
  const flowRead = flow >= FLOW_HIGH
    ? Math.min(holdDeckLocal.length, Math.max(readAhead, FLOW_READ)) : readAhead
  out = { ...out, pump, flow, readAhead: flowRead, turn: s.turn + 1,
    log: [...out.log, `Hanging. +${add} pump.${flow >= FLOW_HIGH ? ' Dialed in — you can read the wall.' : ''}`] }
  if (out.turn >= TURN_CAP + bm.dTurnCap)
    return { ...out, peakPump: Math.min(PUMP_MAX, Math.max(out.peakPump, out.pump)), phase: 'burnEnd', result: 'fall',
      log: [...out.log, 'The light has gone. That is the day — down you come.'] }
  if (pump >= PUMP_MAX) {
    if (!roped)
      return { ...out, peakPump: Math.min(PUMP_MAX, Math.max(out.peakPump, out.pump)), phase: 'burnEnd', result: 'fall', log: [...out.log, 'Forearms gone. Off.'] }
    if (out.lastPiece < 0)
      return { ...out, peakPump: Math.min(PUMP_MAX, Math.max(out.peakPump, out.pump)), phase: 'burnEnd', result: 'fall',
        log: [...out.log, 'Off, with nothing in. That is a ground fall.'] }
    if (out.lastPiece === 0 && out.cleared > 0)
      out = { ...out, log: [...out.log, 'Nothing in but the belay. The whole pitch, gone.'] }
    // caught by the last piece: you lose the ground above it, not the route.
    // It costs a burn, so a roped route ends by lowering off rather than by
    // grinding until your skin runs out.
    const lost = Math.max(0, out.cleared - out.lastPiece)
    const burn = out.burn + 1
    /* ENG-27: the caught-fall skin cost honours the same fall-skin modifiers a
       boulder fall does (App.tsx's fall handler). It used to ignore both, so on
       exactly the routes you fall most, Long Game / Static's stated drawback
       (dFallSkin) vanished — they became strictly upside — and Crash Pads
       (skinSave, which eats the first fall) stopped working. Base loss scales
       with the runout as before; dFallSkin adds to it, skinSave eats the first. */
    const freeFall = out.onProject || (out.inRun && gearMods(out.gear).skinSave > 0 && out.burn === 1)
    const loss = freeFall ? 0
      : Math.max(1, Math.ceil(lost / RUNOUT_SKIN)) + boonMods(out.boons).dFallSkin
    const skin = Math.max(0, out.skin - loss)
    if (burn > attemptsFor(out) || skin <= 0)
      return { ...out, burn, skin, phase: 'burnEnd', result: 'fall',
        peakPump: Math.min(PUMP_MAX, Math.max(out.peakPump, out.pump)),
        log: [...out.log, `Off — ${lost} holds. That is the day. Lower off.`] }
    return { ...out, burn, skin, cleared: out.lastPiece, runout: 0,
      peakPump: Math.min(PUMP_MAX, Math.max(out.peakPump, out.pump)),
      pump: Math.floor(PUMP_MAX * FALL_PUMP),
      log: [...out.log,
        `Off — ${lost} holds onto the last piece. Caught. Back on. Burn ${burn} of ${attemptsFor(out)}.`] }
  }
  // recorded at the very end, after every pump change including the hang tax
  out = { ...out, peakPump: Math.min(PUMP_MAX, Math.max(out.peakPump, out.pump)) }
  // RUN-11: Sustained keeps the unplayed hand between moves; otherwise the hand
  // dumps each turn and a fresh five is dealt (All In already emptied it above)
  const endPiles = mutMods(out.mutators).retain
    ? out.piles
    : pileDiscard(out.piles, out.piles.hand)
  return refillAndDraw({ ...out, piles: endPiles, selected: null }, rng)
}

/* SIM-5. Playing a technique card was implemented twice — once in the screen's
   `playBonus` and once inside `autoPlay` — and a rule added to one failed to
   reach the other three times running. Sequences never started for the
   drafter (SIM-3), Free Rein measured +0 for two versions (BAL-9), and
   clipping bought nothing (ROPE-4). Every time the mechanic looked worthless
   and the fix was to teach the harness the rule it already had.
   One function. The screen and the policy both call it; neither owns the
   rules. What each keeps is its own business: the screen keeps the sound and
   the undo stack, the policy keeps deciding which card to play at all. */
export function playBonusStep(s: GameState, c: Card, lane: number, rng: RNG): GameState {
  const bn = boonMods(s.boons)
  let piles = pileFromHand(s.piles, c.uid)
  // Free Rein pays for the first technique card of the turn, and replaces it
  const free = bn.freeBonus && !s.bonusUsed
  if (free && bn.freeDraws) piles = pileDraw(piles, 1, rng)
  let pump = s.pump + (free ? 0 : c.cost)
  const boardP = s.boardP.slice(), boardH = s.boardH.slice(), log: string[] = []

  let seq = s.seq
  if (c.seq) {
    const q = seqById(c.seq)
    if (q) { seq = { id: q.id, left: q.turns }; log.push(`${q.name}. ${q.turns} turns — ${seqNeedText(q)}.`) }
  }
  let runout = s.runout, lastPiece = s.lastPiece, clipped = s.clipped
  if (c.clip && specOf(s).roped) {
    runout = 0; lastPiece = s.cleared; clipped = true
    log.push(`${c.name} in. Clipped — you can try hard off that.`)
  }
  if (c.skinCost) log.push(`${c.name}. That is skin you do not get back.`)
  if (c.shed) { pump = Math.max(0, pump - c.shed); log.push(`${c.name}. −${c.shed} pump.`) }
  if (c.draw) { piles = pileDraw(piles, c.draw, rng); log.push(`${c.name}. Draw ${c.draw}.`) }
  // RUN-9: read the sequence — reveal the next N upcoming holds. Information
  // only: it draws nothing, spends no randomness, and never touches the board.
  let readAhead = s.readAhead
  if (c.read) {
    readAhead = Math.min(s.holdDeck.length, Math.max(readAhead, c.read))
    log.push(`${c.name}. You read the next ${readAhead} hold${readAhead === 1 ? '' : 's'} off the wall.`)
  }
  if (c.restore && piles.exhaust.length) {
    const n = Math.min(c.restore, piles.exhaust.length)
    const back = piles.exhaust.slice(-n)
    piles = { ...piles, exhaust: piles.exhaust.slice(0, -n), hand: [...piles.hand, ...back] }
    log.push(`${c.name}. ${n} back from the burnt pile.`)
  }
  if (c.powerAll) {
    for (let i = 0; i < 3; i++) if (boardP[i]) boardP[i] = { ...boardP[i]!, power: boardP[i]!.power + c.powerAll }
    log.push(`${c.name}. +${c.powerAll} Power everywhere.`)
  }
  if (c.power && lane >= 0 && boardP[lane]) {
    boardP[lane] = { ...boardP[lane]!, power: boardP[lane]!.power + c.power }
    log.push(`${c.name}. +${c.power} Power.`)
  }
  if (c.gripCut && lane >= 0 && boardH[lane]) {
    boardH[lane] = { ...boardH[lane]!, grip: Math.max(1, boardH[lane]!.grip - c.gripCut),
      clean: c.cleans ? true : boardH[lane]!.clean }
    if (c.cleans) boardH[lane] = clearDirt(boardH[lane]!)
    log.push(`${c.name}. −${c.gripCut} Grip${c.cleans ? ', ability stripped' : ''}.`)
  }
  /* CARD-17: a curse you have paid for is WRITTEN OFF — exhausted, not discarded, so
     it cannot come back round this burn. Every other bonus recycles as it always has. */
  const cursed = c.rarity === 'curse'
  if (cursed) {
    pump += CURSE_TAX
    log.push(`${c.name}. Written off — that is ${c.cost + CURSE_TAX} pump, and you will not see it again this burn.`)
  }
  piles = cursed
    ? { ...piles, exhaust: [...piles.exhaust, c] }
    : { ...piles, discard: [...piles.discard, c] }
  return { ...s, piles, pump, skin: Math.max(0, s.skin - c.skinCost),
    peakPump: Math.min(PUMP_MAX, Math.max(s.peakPump, pump)),
    boardP, boardH, runout, lastPiece, seq, readAhead, clipped, bonusUsed: true,
    selected: null, log: [...s.log, ...log] }
}

/** Headless policy — used by the sim so it exercises the shipping engine. */
/* SIM-6. What a worked FOOTHOLD is worth to the policy, against a point of Support.
   A cleared foothold is one hold of progress, certain. A point of Support is +1 Power
   on both hand lanes for a turn, which turns a near miss into a hold sometimes. So the
   certain thing is worth a little more than the point that might pay — that is the whole
   content of this number, and it is measured rather than reasoned (see the ledger). */
export const FOOT_CLEAR_VALUE = 3
export function autoPlay(s: GameState, rng: RNG): GameState {
  let st = { ...s, boardP: s.boardP.slice(), piles: { ...s.piles, hand: s.piles.hand.slice() } }
  const feet = st.piles.hand.filter(c => c.kind === 'move' && c.lane === 'feet')
  if (!st.boardP[2] && feet.length) {
    /* SIM-6: the policy used to take the most Support in hand and nothing else, which
       made it blind to the fact that a foot WORKS ITS HOLD — measured, the feet lane
       works about 39% of every hold worked in a campaign, so a third of the climb was
       being chosen for by a rule that could not see it. That is the ENG-25 failure mode
       and it means every band number was measured by a policy under-playing the feet.
       It scores the same two things the hand lanes are scored on: does this clear, and
       what does it leave behind. Support is read through `supportNow` with the card in
       place, so ENG-32's settling cost is priced in rather than assumed away. */
    const h2 = st.boardH[2]
    /* A foot is worth what it gives you NOW plus what it will give you if it stays —
       and those are different numbers, which is the whole ENG-32 trade. A fresh
       Support-2 foot and a fresh Support-1 foot pay the hands exactly the same on the
       turn they land, because the settling cost is floored at one Support; they only
       separate once PLANTED. Scoring the placement turn alone therefore cannot tell a
       Flag from a Rock Over, which is what this guard caught. So: a foot that works its
       hold leaves the wall and is scored on the hold, and a foot that stays is scored on
       what it will pay once it is bedded in. */
    const supWith = (c: Card, set: boolean) => {
      const live = st.boardP.slice(); live[2] = { ...c, set }
      return supportNow({ ...st, boardP: live })
    }
    const footValue = (c: Card) => {
      const now = supWith(c, false)
      if (!h2) return now + supWith(c, true)    // nothing under you; it can only stand there
      const clears = powerAgainst(st, c, h2, 2) >= gripFor(st, h2)
      return clears ? now + FOOT_CLEAR_VALUE : now + supWith(c, true)
    }
    const pick = feet.reduce((a, b) => (footValue(b) > footValue(a) ? b : a))
    st.boardP[2] = pick; st.piles = pileFromHand(st.piles, pick.uid)
  }
  const order = [0, 1].sort((a, b) => (st.boardH[b]?.bite ?? 0) - (st.boardH[a]?.bite ?? 0))
  for (const i of order) {
    const hold = st.boardH[i]
    if (!hold || st.boardP[i]) continue
    if (phaseOf(st)?.lockLane === i) continue
    const cands = st.piles.hand.filter(c => c.kind === 'move' && (c.lane === 'hand' || c.lane === 'any'))
    if (!cands.length) continue
    const rests = cands.filter(c => c.shed > 0)
    const real = cands.filter(c => c.shed === 0)
    let pick: Card
    if (rests.length && st.pump >= PUMP_MAX - 4 && real.length === 0) pick = rests[0]
    else if (real.length) {
      const target = gripFor(st, hold)
      /* ENG-25: opposition pays +2 only with a hand partner pulling the other
         way, and −2 alone. The greedy fill placed one hand lane at a time
         against an empty partner, so every opposition card was scored at its
         −2 alone value and a pair never formed — a 14-card mechanic the tuning
         sim literally could not see. When the other hand lane is an open hold
         and a second opposition card is in hand, score this one as the pair it
         is about to become; once the first is placed, the second lane reads the
         real partner off the board, so the +2 is counted once, not twice. */
      const openOther = i < 2 && !!st.boardH[1 - i] && !st.boardP[1 - i]
      const scorePow = (c: Card) => {
        if (c.opposes && openOther) {
          const partner = real.find(x => x.opposes && x.uid !== c.uid)
          if (partner) {
            const live = st.boardP.slice(); live[1 - i] = partner
            return powerAgainst(st, c, hold, i, live)
          }
        }
        return powerAgainst(st, c, hold, i)
      }
      const clears = real.filter(c => scorePow(c) >= target)
      pick = (clears.length ? clears : real).reduce((a, b) =>
        (scorePow(b) > scorePow(a) ? b : a))
    } else pick = rests[0]
    st.boardP[i] = pick; st.piles = pileFromHand(st.piles, pick.uid)
  }
  // bonuses last, once we know which lanes need help. The POLICY lives here —
  // which card, which lane, whether it is worth the pump — but the RULES are
  // `playBonusStep`, the same function the screen calls. See SIM-5.
  const ab = boonMods(s.boons)
  let freeUsed = false
  for (const c of st.piles.hand.filter(c => c.kind === 'bonus')) {
    const isFree = ab.freeBonus && !freeUsed
    /* CARD-17: the surcharge is part of what a write-off costs, so the headroom gate
       has to see it — otherwise the policy could pay the tax straight through the cap.
       Free Rein still covers the card's own cost, as it does for any bonus; the tax is
       the price of the timing and is always paid. */
    const cost = (isFree ? 0 : c.cost) + (c.rarity === 'curse' ? CURSE_TAX : 0)
    if (st.pump + cost >= PUMP_MAX - 2) continue
    /* Where to point it. A grip cut wants the hold that is furthest from
       going; a Power boost wants the lane closest to clearing, because that is
       where it turns a near miss into a hold worked. Picking the first lane
       that happened to be occupied cost the sim about ten points. */
    const best = (score: (i: number) => number) => {
      let at = -1, bestScore = -Infinity
      for (const i of [0, 1, 2]) {
        const v = score(i)
        if (v > bestScore) { bestScore = v; at = i }
      }
      return bestScore > -Infinity ? at : -1
    }
    const lane = !c.targeted ? -1
      : c.gripCut ? best(i => (st.boardH[i] ? gripFor(st, st.boardH[i]!) : -Infinity))
      : best(i => {
          const card = st.boardP[i], hold = st.boardH[i]
          if (!card || !hold) return -Infinity
          const short = gripFor(st, hold) - powerAgainst(st, card, hold, i, st.boardP)
          // closest to clearing without being there already
          return short > 0 && short <= c.power ? 100 - short : -short
        })
    const worth =
      (c.restore > 0 && st.piles.exhaust.length > 0)
      || (c.draw > 0)
      || (c.shed > 0 && st.pump >= Math.min(c.shed, 2))
      || (c.clip === true && specOf(st).roped)
      || (!!c.seq && !st.seq)
      || (c.powerAll > 0 && st.boardP.some(Boolean))
      || ((c.power > 0 || c.gripCut > 0) && lane >= 0)
      /* CARD-17: writing a curse off buys HAND QUALITY, not progress, so it wants more
         headroom than a card that does something this turn — otherwise the policy
         spends the clock on tidying up. ENG-25's lesson is why this clause exists at
         all: a mechanic the policy cannot see gets measured as dead. */
      || (c.rarity === 'curse' && st.pump + cost <= PUMP_MAX - 5)
    if (!worth) continue
    st = playBonusStep(st, c, lane, rng)
    if (isFree) freeUsed = true
  }

  return st
}

/* =========================== THE LOGBOOK ===========================
   A guidebook you fill in. Every send recorded with its burn count, the
   style it went in and the conditions on the day — repeats keep the best
   of each. Persists across runs; the only record that outlives a death. */
export type LogEntry = {
  sends: number; bestBurn: number; bestStyle: number
  flashed: boolean; weather: number; rock: number
}
export function logSend(s: GameState): Record<string, LogEntry> {
  const spec = specOf(s)
  // a line you established is yours and belongs in the book; a procedural one
  // and an unclimbed one do not (the latter is written when you name it)
  if (s.skirmish && !s.skirmish.established) return s.book
  const prev = s.book[spec.name]
  const better = !prev || s.burn < prev.bestBurn
  return {
    ...s.book,
    [spec.name]: {
      sends: (prev?.sends ?? 0) + 1,
      bestBurn: prev ? Math.min(prev.bestBurn, s.burn) : s.burn,
      bestStyle: Math.max(prev?.bestStyle ?? 0, s.inRun ? s.style : 0),
      flashed: (prev?.flashed ?? false) || s.burn === 1,
      weather: better ? s.weather : prev.weather,
      rock: better ? s.rock : prev.rock,
    },
  }
}
/** What you already know about a line you have climbed before: the hold types
    you worked, up to a cap that rises with how well you know it. */
export function betaFromBook(s: GameState): string[] {
  const spec = specOf(s)
  if (s.skirmish || spec.tutorial) return []
  const e = s.book[spec.name]
  if (!e) return []
  // What you remember is the awkward move, not the whole route — so this is
  // the RAREST hold on the line, not the commonest. Remembering the commonest
  // was worth +42 points of send rate, which would make grinding known lines
  // strictly better than climbing new ones.
  const depth = Math.min(BOOK_BETA_MAX, e.sends + (e.flashed ? 1 : 0))
  const weights = STYLES[spec.style].w
  return Object.keys(weights)
    .filter(k => (weights[k] ?? 0) > 0)
    .sort((a, b) => (weights[a] ?? 0) - (weights[b] ?? 0))
    .slice(0, depth)
}

/** Which act a route belongs to, derived from the maps rather than hardcoded. */
/** Every line in an act, ticked. Paid once, and the reward is a rare card you
    then own for good — the book turning into something you can hold. */
export function actTicked(book: Record<string, LogEntry>, act: number): boolean {
  const lines = ROUTES.filter((_, i) => ACT_OF_ROUTE[i] === act)
  return lines.length > 0 && lines.every(r => book[r.name])
}
export const ACT_XP = 120
/** Brushing a hold takes the season off it as well as stripping its ability. */
export const clearDirt = (h: Hold): Hold =>
  h.dirt ? { ...h, grip: Math.max(1, h.grip - h.dirt), dirt: 0 } : h
/** What the rock says about the grade you claimed. */
export function claimVerdict(claimed: number, real: number): string {
  const d = claimed - real
  if (d <= -2) return 'Sandbagged. It is harder than you said, and somebody will find out.'
  if (d === -1) return 'A touch stiff for the grade. People will call it sandbagged.'
  if (d === 0) return 'Fair. That is what it is.'
  if (d === 1) return 'Soft. Nobody will complain, but they will notice.'
  return 'Sprayed. That is nowhere near the grade you gave it.'
}

export const ACT_OF_ROUTE: Record<number, number> = (() => {
  const out: Record<number, number> = {}
  ACTS.forEach((map, a) => map.forEach(tier => tier.forEach(n => {
    if (n.routeIdx >= 0) out[n.routeIdx] = a
  })))
  return out
})()

/* =========================== THE PREVIEW ===========================
   UX-2. Every one of these numbers already existed; none of them were
   shown before you committed. A card game should not hide its own maths. */
export type LanePreview = {
  /** For a dyno: the odds of sticking it. Undefined for everything else. */
  stick?: number
  hold: boolean; clears: boolean; gripLeft: number
  card: boolean; blows: boolean; contactLeft: number
  biteToPump: number
}
/* ENG-19. Whether a lane comes off was written out twice — once for the lane
   itself and once inside the simulation of the lanes before it — and two
   copies of one formula drift. They are one function now, so they cannot. */
export function laneBlows(s: GameState, i: number): boolean {
  const c = s.boardP[i], h = s.boardH[i]
  if (!c || !h) return false
  if (c.fx === 'commit') return true
  return c.contact - biteAgainst(s, c, h, i) <= 0 && !(c.latch && !c.latched)
}

export function previewLane(s0: GameState, i: number): LanePreview {
  // a telegraphed move is information the player has, so the preview uses it
  const { s, noRestLane } = afterMove(s0)
  const hold = s.boardH[i], card = s.boardP[i]
  const blank: LanePreview = { hold: false, clears: false, gripLeft: 0,
    card: false, blows: false, contactLeft: 0, biteToPump: 0 }
  /* ENG-18: resolve reads the board as it stands, so a lane that comes off
     before this one is no longer opposing it. Whether a lane blows depends on
     Contact against Bite and never on opposition, so this can be worked out
     in one pass without recursion. */
  const order = [...s.order.filter(k => k >= 0 && k < 3),
    ...[0, 1, 2].filter(k => !s.order.includes(k))]
  const live = s.boardP.slice()
  for (const j of order) {
    if (j === i) break
    if (laneBlows(s, j)) live[j] = null
  }
  if (!hold) return blank
  const bite = biteAgainst(s, card, hold, i)
  if (!card) return { ...blank, hold: true, gripLeft: gripFor(s, hold), biteToPump: bite }
  const ab = abilityOf(hold)
  let power = powerAgainst(s, card, hold, i, live)
  if (ab === 'Committing' && power < 2) power = 0
  /* ENG-26: resolve mutates this lane's hold grip BEFORE it resolves — a
     chipping rest works it down (the Kneebar boon's restChips, or a CARD-11
     restChip card) and a curse sharpens it (hex) — so the target must be read
     off the same adjusted hold, or the preview reports the wrong grip on
     exactly the turn one of those lands here. Mirrors resolve's order and its
     clamps (rest chips floor at 0; hex does not). */
  const bmL = boonMods(s.boons)
  const noRestL = phaseOf(s)?.noRest === true || mutMods(s.mutators).noShakes || bmL.noRests
    || i === noRestLane                                    // ENG-21: pinned, so no chip either
  let g0 = hold.grip
  if (bmL.restChips && card.shed > 0) g0 = Math.max(0, g0 - bmL.restChips)
  if (!noRestL && card.restChip) g0 = Math.max(0, g0 - card.restChip)
  if (card.hex) g0 = g0 + card.hex
  const target = gripFor(s, g0 === hold.grip ? hold : { ...hold, grip: g0 })
  const snapped = card.fx === 'snap' && target <= 3
  const isDyno = card.fx === 'commit'
  const gripLeft = snapped ? 0 : target - power
  const contactLeft = card.contact - bite
  const blows = laneBlows(s, i)
  // ENG-15: a dyno is a check now, so the preview reports the odds rather than
  // claiming a certainty it cannot have
  return { hold: true, clears: isDyno ? false : gripLeft <= 0,
    stick: isDyno ? stickChance(s) : undefined,
    gripLeft: isDyno ? 0 : Math.max(0, gripLeft),
    card: true, blows, contactLeft: Math.max(0, contactLeft), biteToPump: 0 }
}
/** Predicted pump after COMMIT — rests, unanswered lanes, and the clock.
    Takes precomputed lanes so a render does not recompute them per call. */
export function previewPump(s0: GameState, lanes?: LanePreview[]): number {
  const { s, noRestLane } = afterMove(s0)
  const L = lanes ?? [0, 1, 2].map(i => previewLane(s, i))
  let pump = s.pump
  const noRest = phaseOf(s)?.noRest === true || mutMods(s.mutators).noShakes
    || boonMods(s.boons).noRests
  // resolve clamps at zero on EACH shed, then adds the clock — clamping only
  // at the end silently under-reports by however far it went negative
  // ENG-21: and a pinned lane sheds nothing, exactly as resolve has it
  for (let i = 0; i < 3; i++) {
    const c = s.boardP[i]
    if (c && c.shed && !noRest && i !== noRestLane) pump = Math.max(0, pump - c.shed)
  }
  let cleared = 0
  for (let i = 0; i < 3; i++) {
    const p = L[i]
    pump += p.biteToPump
    if (p.clears) {
      cleared++
      /* working a jug sheds a pump — Rest fires on the clear, not on contact.
         ENG-28: through abilityOf, never the base hold's default. A signature
         may OVERRIDE its base ability (The Wet Jug is a jug that is Greasy, not
         a Rest), and resolve has always gone through abilityOf — so reading
         HOLD_STATS here made the preview shed a pump the resolution never did. */
      if (abilityOf(s.boardH[i]!) === 'Rest') pump = Math.max(0, pump - 1)
    }
    // Sharp fires on a blow regardless of Anchor; Peel takes precedence over it
    const c = s.boardP[i]
    if (p.blows && s.boardH[i] && c && c.fx !== 'peel' && c.fx !== 'tough') {
      if (abilityOf(s.boardH[i]!) === 'Sharp') pump += 1
    }
  }
  const restedThis = s.boardP.some(c => c && c.shed > 0)
  const flow = cleared > 0 && !restedThis ? Math.min(FLOW_MAX, s.flow + 1) : 0
  const tax = Math.max(0, HANG_TAX - (flow >= FLOW_AT ? FLOW_TAX : 0))
  // the clock is charged AFTER resolution, so a card that blows leaves its
  // lane unanswered too — this was the whole gap between preview and reality
  const unanswered = [0, 1, 2].filter(i => {
    const pv = L[i]
    return pv.hold && !pv.clears && (!pv.card || pv.blows)
  }).length
  const hooked = s.boardP[2]?.fx === 'hooked'
  /* ENG-26: resolve taxes holds whose ABILITY is Committing (`abilityOf`), over
     the post-resolution board (a cleared hold is gone). The preview keyed on the
     `h.crux` FLAG instead — and the allCrux boss phase promotes ordinary holds
     to crux:true while leaving their base ability (a jug stays a Rest), so the
     flag was set where the ability was not, and the preview over-reported the
     tax on exactly that phase. Key on the same ability resolve does; `abilityOf`
     already returns '' for a brushed-clean hold, so the old !h.clean is subsumed. */
  const cruxTax = hooked ? 0 : [0, 1, 2].filter(i => {
    const h = s.boardH[i]
    return h && !L[i].clears && abilityOf(h) === 'Committing'
  }).length
  const doubt = s.inRun && s.psyche <= DOUBT_AT ? 1 : 0
  pump += HANG_FLAT + tax * unanswered + cruxTax + (phaseOf(s)?.dTax ?? 0) + doubt
    + (LINES[s.line]?.dTax ?? 0) - gearMods(s.gear).shedPerTurn
  return Math.max(0, pump)
}

/* ========================= CARD VALUATION ==========================
   Lives in the engine, not the harness (SIM-1). Every balance number in
   this project used to come from `power*2 + contact`, which knows nothing
   about synergy, gear, archetypes or deck bloat.                       */
/* Measured, not guessed. Swapping two of fifteen moves for technique cards
   took a mid-Act-1 send rate from 46% to 88%; Breathe alone is worth +28
   points. They were being scored at about a fifth of what they are worth,
   which is why 48 of them read as unplayable. They do saturate, though —
   nine moves and six techniques drops back to 62% — so the value falls away
   as a deck fills up with them. */
const BONUS_WEIGHT = 3.2
function bonusValue(c: Card, deck: Card[]): number {
  // only the benefits scale — a pump cost is a pump cost, not a scaled benefit
  const good = c.shed * 1.4 + c.draw * 2.2 + c.gripCut * 1.6 + c.powerAll * 4.5
    + c.power * 1.8 + c.restore * 1.8 + (c.cleans ? 1.6 : 0)
  const share = deck.length ? deck.filter(x => x.kind === 'bonus').length / deck.length : 0
  // full value up to about a fifth of the deck, then away sharply
  const saturation = share <= 0.2 ? 1 : Math.max(0.25, 1 - (share - 0.2) * 3)
  return good * BONUS_WEIGHT * saturation - c.cost * 1.2 - c.skinCost * 6
}
/** What a plan is worth: the payout, discounted by the odds of holding it,
    and by whether this deck can meet the condition at all. A sequence card
    with no valuation scored −3 and was never taken by anyone. */
function seqValue(c: Card, deck: Card[]): number {
  const q = seqById(c.seq)
  if (!q) return 0
  const d = q.onDone
  const payout = (d.clear ?? 0) * 4.5 + (d.draw ?? 0) * 2.2 + (d.dumpPump ? 5 : 0)
    + (d.contact ?? 0) * 3 + (d.settle ?? 0) * 2.5
  // can this deck actually meet the condition, turn after turn?
  const n = Math.max(1, deck.length)
  const rests = deck.filter(x => x.shed > 0).length / n
  const feet = deck.filter(x => x.lane === 'feet').length / n
  const power = deck.reduce((a, x) => a + x.power, 0) / n
  const hold = q.need === 'rest' ? Math.min(1, rests * 3)
    : q.need === 'norest' ? Math.min(1, 1.2 - rests)
    : q.need === 'feet' ? Math.min(1, feet * 3.5)
    : Math.min(1, power / 1.6)
  return payout * Math.pow(hold, q.turns - 1)
}
/* DECK-1. Fifteen slots out of everything you own is a real decision and not
   everybody wants to make it from scratch. Put in the two or three cards you
   actually want to build around and this fills the rest — using `cardValue`,
   which is the most carefully measured thing in this game and until now was
   only ever consulted by the drafter, plus the two things a deck needs
   structurally and a new player will not think of: feet, and something to rest
   on. It does not overrule you. Whatever you put in stays in. */
export const WANT_FEET = 3
export const WANT_RESTS = 2
export const MAX_RESTS = 3          // more than this and you cannot work a hold
export const MAX_TECH = 3
export const MIN_MOVES = 9
/* The board is two hand lanes and one feet lane, so a deck is mostly hands.
   `cardValue` scores a card on its own and has no idea what a deck looks like:
   given a floor for feet and no ceiling it built THIRTEEN feet cards, which
   cannot work a hold at all. Shape is the builder's job, not the valuation's. */
export const MAX_FEET = 4
export const MIN_HANDS = 8

export function buildLoadout(s: GameState, seed: string[], owned: string[]): string[] {
  const pool = buildable(owned)
  const deck = seed.filter(n => CARDS[n]).slice(0, DECK_SIZE)
  const copies = (n: string) => deck.filter(x => x === n).length
  let guard = 0
  while (deck.length < DECK_SIZE && guard++ < 400) {
    const spawned = deck.map(spawn)
    const feet = spawned.filter(c => c.lane === 'feet').length
    const rests = spawned.filter(c => c.shed > 0).length
    const tech = spawned.filter(c => c.kind === 'bonus').length
    const moves = spawned.filter(c => c.kind === 'move').length
    const hands = spawned.filter(c => c.lane === 'hand' || c.lane === 'any').length
    const left = DECK_SIZE - deck.length
    const tags = tagCounts(spawned)
    let bestName: string | null = null, bestScore = -Infinity
    for (const n of pool) {
      const d = CARDS[n]
      if (!d || d.rarity === 'curse') continue
      if (copies(n) >= copyLimit(d.rarity ?? 'common')) continue
      /* SIM-7: THE SLOT RULES. `copyLimit` caps copies of one card; RARE_SLOTS and
         UNCOMMON_SLOTS cap how many rares and uncommons the whole loadout may hold, and
         they exist for a stated reason — "without this a full collection fields eight
         distinct rares and every route sends at ~100%". The card picker enforces them in
         three places. This builder enforced neither, so BUILD ME ONE handed you TEN rares
         against a limit of one and four uncommons against three: a loadout the picker
         would have refused at every step after the first. Measured, it completed 18.9%
         of campaigns against 28.1% for the starter deck it replaced — the button that
         says "not sure where to start? let it pick" was actively making you worse. */
      const r = d.rarity ?? 'common'
      if (r === 'rare' && slotsUsed(deck, 'rare') >= RARE_SLOTS) continue
      if (r === 'uncommon' && slotsUsed(deck, 'uncommon') >= UNCOMMON_SLOTS) continue
      const c = spawn(n)
      /* A deck that cannot work a hold is not a deck. The first version had no
         structural limits and `cardValue` plus an uncapped synergy bonus built
         fifteen rest cards, every time — so these are hard gates rather than
         weights, and the move floor takes over once the slots run short. */
      if (c.shed > 0 && rests >= MAX_RESTS) continue
      if (c.kind === 'bonus' && tech >= MAX_TECH) continue
      if (c.kind !== 'move' && moves + left <= MIN_MOVES) continue
      if (c.lane === 'feet' && feet >= MAX_FEET) continue
      // once the slots left would not cover the hands a deck needs, only hands
      if (c.lane !== 'hand' && c.lane !== 'any' && hands + left <= MIN_HANDS) continue
      let v = cardValue(s, c, spawned)
      if (c.lane === 'feet' && feet < WANT_FEET) v += 14
      if (c.shed > 0 && rests < WANT_RESTS) v += 12
      // build on what the player chose — but the bonus stops growing at the
      // point synergy itself stops paying, or it feeds on itself
      const tag = tagOf(c)
      if (tag) {
        const have = Math.min(tags[tag] ?? 0, SYNERGY_PER)
        if (have > 0) v += 3 + have * 2
      }
      v -= copies(n) * 4
      if (v > bestScore) { bestScore = v; bestName = n }
    }
    if (!bestName) break
    deck.push(bestName)
  }
  return deck
}

export function cardValue(s: GameState, c: Card, deck: Card[]): number {
  if (c.rarity === 'curse') return -20
  const arch = archOf(s)
  const gm = gearMods(s.gear)
  const settleCap = arch.settleMax ?? SETTLE_MAX
  // Contact is worth more the further a card can settle, and less when the
  // archetype caps it — measured at 1 Power ~ 2 Contact at settleMax 2.
  const contactRate = 0.35 + settleCap * 0.14
  const bn = boonMods(s.boons)
  let v = c.kind === 'bonus'
    ? bonusValue(c, deck) + seqValue(c, deck)
    : c.power * 2 + c.contact * (contactRate * 2)
  // protection does nothing at all on a boulder, and a great deal on a rope
  if (c.clip) {
    const act = ACTS[s.act] ?? []
    const idx = act.flat().map(n => n.routeIdx).filter(i => i >= 0)
    const share = idx.length ? idx.filter(i => ROUTES[i]?.roped).length / idx.length : 0
    v += specOf(s).roped ? 6 : s.circuit ? 1.5 : share * 7
  }
  // boons change what a card is worth: a free technique, a rest that chips,
  // feet that count double
  if (bn.freeBonus && c.kind === 'bonus') v += c.cost * 1.2
  if (bn.restChips && c.shed > 0) v += 2
  if (bn.wideSupport && c.lane === 'feet') v += c.support * 1.5
  if (bn.settle && c.kind === 'move') v += 1.5

  // feet coverage is the single biggest hidden lever in the game
  const feet = deck.filter(x => x.lane === 'feet').length
  if (c.lane === 'feet') {
    v += feet / Math.max(1, deck.length) < 0.25 ? 7 : 1
    v += gm.dPowerFeet * 2
  } else v += gm.dPowerHand * 1.5

  // synergy runs both ways: a specialist gains from the deck, and a tagged
  // card feeds any specialist already in it
  const tags = tagCounts(deck)
  if (c.synergy) v += ((tags[c.synergy] ?? 0) / SYNERGY_PER) * 2.2
  const t = tagOf(c)
  if (t) v += deck.filter(x => x.synergy === t).length * 1.6

  // ENG-25: opposition is a pair mechanic (−2 alone, +2 with a partner pulling
  // the other way), so it values like a light synergy — the first is a mild
  // liability, every one after it turns a −2 into a seatable +2 pair. Without
  // this the drafter scored the whole 14-card compression identity on raw
  // stats and never built toward it.
  if (c.opposes) v += deck.some(x => x.opposes) ? 2 : -1

  // keywords that measured well in the per-card probe
  if (c.anchor) v += 3
  if (c.latch) v += 3
  /* CARD-18 / ENG-25: restChip had no term at all, so the drafter scored a chipping
     rest on its shed alone and Chalk the Hold read below the take-it line for eleven
     versions. Priced against a keyword already calibrated here rather than guessed:
     the per-card probe reads restChip at +3.0pt per point (exactly linear at 1 and 2)
     against anchor's +2.6pt, and anchor is worth 3 — so restChip is worth 3 a point.
     The policy CAN spend it: ENG-26 wired the chip into previewLane, so autoPlay
     sees the grip it will actually face. That is what separates this from `read`. */
  if (c.restChip) v += c.restChip * 3
  if (c.fx === 'tough' || c.fx === 'guard') v += 2
  if (c.fx === 'echo') v += 3
  if (c.fx === 'settle2') v += settleCap
  if (c.chip) v += c.chip * 2.5


  // a bloated deck draws worse — dilute only for something that beats it
  return v - deck.length * 0.12
}
/** Would this offer actually improve the deck? */
export function bestOffer(s: GameState, offers: Card[], deck: Card[]): Card | null {
  if (!offers.length) return null
  const scored = offers.map(c => [c, cardValue(s, c, deck)] as [Card, number])
  scored.sort((a, b) => b[1] - a[1])
  const mean = deck.length
    ? deck.reduce((a, c) => a + cardValue(s, c, deck), 0) / deck.length : 0
  // decline anything that would drag the deck down
  return scored[0][1] > mean * 0.8 ? scored[0][0] : null
}

/* ======================= THE PHASE GRAPH ===========================
   Screen transitions used to live only in the UI, so the sim reimplemented
   them — and got the gear→reward chain wrong, silently re-running the same
   node. These are the single source of truth for "what happens next", and
   both the game and the harness call them. (SIM-1)                      */
const toMapNext = (s: GameState): GameState =>
  s.packCards.length ? { ...s, afterPack: 'map', phase: 'pack' } : { ...s, phase: 'map' }

/** What a finished stage is remembered as. Short — it goes in a list on a
    phone — and specific enough to be worth reading back. */
export function trailNote(s: GameState): string {
  const spec = specOf(s)
  if (s.eventId) {
    const ev = EVENTS.find(e => e.id === s.eventId)
    return ev ? ev.title.toLowerCase() : 'an event'
  }
  if (s.phase === 'camp') return 'camped'
  if (s.phase === 'shop') return 'the post'
  if (spec.fa) return s.result === 'send' ? 'put up a line' : 'failed on the unclimbed one'
  if (spec.finale) return s.result === 'send' ? 'topped The Lost Line' : 'off The Lost Line'
  const name = spec.name
  return s.result === 'send'
    ? (s.burn === 1 ? `flashed ${name}` : `sent ${name}`)
    : `off ${name}`
}
/** Note what this stage turned out to be. */
export const noteTrail = (s: GameState, what: string): GameState =>
  ({ ...s, trail: [...s.trail, what] })

export const rerollCost = (n: number) => REROLL_BASE + REROLL_STEP * n

/** Pay to see three different cards. */
export function rerollStep(s: GameState, rng: RNG): GameState {
  const cost = rerollCost(s.rerolls)
  if (s.cash < cost) return s
  return { ...s, cash: s.cash - cost, rerolls: s.rerolls + 1,
    offers: rollOffers(rng, 3, false, s.act) }
}
/** Pay for a better shelf: the same three slots, a tier up. */
export function cropStep(s: GameState, rng: RNG): GameState {
  if (s.cash < CROP_COST) return s
  return { ...s, cash: s.cash - CROP_COST,
    offers: rollOffers(rng, 3, false, Math.min(2, s.act + 1)) }
}
/** Two cards and something you will regret. */
export function takeTwoStep(s: GameState, picks: Card[], rng: RNG): GameState {
  const curses = BY_RARITY('curse')
  const curse = spawn(curses[rng.int(curses.length)])
  return takeOfferStep({ ...s, runDeck: [...s.runDeck, ...picks, curse] }, null)
}

/* UX-1. `cardValue` is the best-measured thing in this game and the player has
   never been able to see any of it. A number would just expose the machine, so
   this says the reasons instead — drawn from the same signals the valuation
   uses, so the hint and the score cannot disagree. */
export function cardHints(s: GameState, c: Card, deck: Card[]): string[] {
  const n = Math.max(1, deck.length)
  const copies = deck.filter(x => x.name === c.name).length
  const feet = deck.filter(x => x.lane === 'feet').length
  const rests = deck.filter(x => x.shed > 0).length
  const tech = deck.filter(x => x.kind === 'bonus').length
  const bn = boonMods(s.boons)
  // most specific first — a generic note about deck shape must never crowd out
  // the reason this particular card is or is not worth a slot
  const sharp: string[] = []
  const shape: string[] = []

  // CARD-17: it is still a curse, but it is no longer a card you can do nothing about
  if (c.rarity === 'curse') sharp.push(c.kind === 'bonus'
    ? `a curse — pay ${c.cost + CURSE_TAX} pump mid-climb to write it off for the burn`
    : 'a curse — it does nothing good')
  if (c.clip) sharp.push(
    specOf(s).roped || ACTS[s.act]?.flat().some(x => ROUTES[x.routeIdx]?.roped)
      ? 'there is rope on this trip' : 'nothing to clip on a boulder')
  if (c.seq) {
    const q = seqById(c.seq)
    if (q) sharp.push(`wants ${seqNeedText(q)} ${q.turns} turns running`)
  }
  if (bn.restChips && c.shed > 0) sharp.push('your Kneebar Merchant makes this chip too')
  if (bn.wideSupport && c.lane === 'feet') sharp.push('Big Hands doubles what this gives')
  if (bn.freeBonus && c.kind === 'bonus') sharp.push('Free Rein pays for the first one each turn')
  const tag = tagOf(c)
  if (tag) {
    const have = tagCounts(deck)[tag] ?? 0
    if (have >= SYNERGY_PER - 1) sharp.push(`${have} ${TAG_NAMES[tag] ?? tag} card${have > 1 ? 's' : ''} in here already`)
  }

  if (c.lane === 'feet' && feet <= 2) shape.push('you are short on feet')
  if (c.shed > 0 && rests <= 1) shape.push('nothing in here to shake out on')
  if (c.kind === 'bonus' && tech <= 1) shape.push('no technique in the deck yet')
  if (c.kind === 'bonus' && tech / n > 0.3) shape.push('plenty of technique already')
  if (copies >= copyLimit(c.rarity)) shape.push('you are at the limit for this one')
  else if (copies > 0) shape.push(`${copies} of these already`)

  return [...sharp, ...shape].slice(0, 2)
}

/** A card reward resolved: take it or leave it, then on up the trail. */
export function takeOfferStep(s: GameState, card: Card | null): GameState {
  const deck = card ? [...s.runDeck, card] : s.runDeck
  const next = { ...s, runDeck: deck, offers: [], rerolls: 0 }
  if (s.circuit) return { ...next, phase: 'circuitNext' }
  return toMapNext(noteTrail({ ...next, tier: s.tier + 1 }, trailNote(s)))
}
/** Gear picked. A card may still be waiting behind it — that is the chain
    the harness got wrong. Note the tier is NOT advanced here: whoever set
    phase 'gear' has already done it. */
export function pickGearStep(s: GameState, id: string | null): GameState {
  const b = id ? boonById(id) : null
  const g = id && !b ? gearById(id) : null
  const gear = g ? [...s.gear.filter(x => gearById(x)?.slot !== g.slot), g.id] : s.gear
  const boons = b ? [...s.boons, b.id] : s.boons
  const next = { ...s, gear, boons, gearOffers: [] }
  // SKIRM-6: in the Circuit the boon offer sits mid-run and the next line's
  // route is already set, so hand straight back to it rather than the map
  if (s.circuit) return { ...next, phase: 'circuitNext' }
  return next.offers.length ? { ...next, phase: 'reward' } : toMapNext(next)
}
export type CampAction =
  | { kind: 'rest' } | { kind: 'sharpen'; name: string } | { kind: 'cut'; uid: number }
  | { kind: 'van'; rng: RNG }
/** Have you already been through the van in this range? */
export const vanOpen = (s: GameState) => !s.vanRaided.includes(s.act)
/** Have you already been through the post at this stage? */
export const postOpen = (s: GameState) =>
  !s.shoppedAt.includes(s.act * 100 + s.tier)
/* TEST-4. Three of the four screens with no coverage are where a run ENDS,
   which is where state gets written to the save — and `NARR-4` found that class
   of bug by accident, after it had been silently emptying saves for a while.
   The circuit's exit was doing its own `Math.max` on your best score inline in
   the screen, which is the same shape as the bug that started all this. */
/* CARD-6. Ten curses, and only two of them ever arrived: Cold Shut and
   Sandbagged Beta, from three events of which two give the same one, plus the
   Sandbagged mutator and TAKE TWO. Eight were unreachable. A curse should be
   the price of something you wanted, not a rare accident — so these come from
   decisions the game already watches you make.

   Note what this is NOT: a reward for climbing hurt. Per the design values,
   climbing on wrecked skin is a bad decision the game permits and never
   rewards — a curse is the consequence arriving, not a payout. */
/* INJ-1. A run was 26 minutes and then nothing carried but XP and cards, so a
   bad decision had no memory. This gives one a memory, and the design values
   set hard limits on how:

     "Skin, injury and psyche model care, risk and consequence — not
      grind-through-pain optimization... nothing valorizes training through
      injury."

   So this is deliberately NOT a system. There is no way to speed it up, no item
   that clears it, nothing to buy, and no reward whatsoever for climbing with
   one — an injury pays you nothing, which is the whole design. It arrives when
   you climbed a run down to nothing, it makes one thing harder, and it goes
   when it goes. The only thing you can do about it is the honest one: go
   anyway, or wait. */
export type Tweak = { kind: string; hold: string; runs: number; text: string }
export const TWEAKS: Omit<Tweak, 'runs'>[] = [
  { kind: 'pulley', hold: 'crimp',
    text: 'A pulley in the ring finger. Crimps are going to let you know about it.' },
  { kind: 'elbow', hold: 'sloper',
    text: 'Something in the elbow. Anything you have to press down on aches.' },
  { kind: 'shoulder', hold: 'sharp crimp',
    text: 'The shoulder again. It is fine until it is above your head.' },
  { kind: 'tips', hold: 'pinch',
    text: 'The tips have not come back properly. Anything you have to squeeze is raw.' },
]
export const TWEAK_RUNS = 2
export const TWEAK_GRIP = 1

/** You climbed a whole trip down to nothing. That leaves a mark. */
export function tweakEarned(s: GameState, rng: RNG): Tweak | null {
  if (s.tweak) return null            // one at a time; they do not stack
  if (s.skin > 0) return null         // you walked off it with something left
  const t = TWEAKS[rng.int(TWEAKS.length)]
  return { ...t, runs: TWEAK_RUNS }
}
/** A trip goes by. Nothing else moves this — no camp, no cash, no gear. */
export function tweakAfterRun(s: GameState): GameState {
  if (!s.tweak) return s
  const runs = s.tweak.runs - 1
  return { ...s, tweak: runs > 0 ? { ...s.tweak, runs } : null }
}
/** What a tweak costs you on a hold, which is the only thing it ever does. */
export const tweakGrip = (s: GameState, holdName: string) =>
  s.tweak && s.tweak.hold === holdName ? TWEAK_GRIP : 0

export type CurseCause = 'rawskin' | 'exposed' | 'sprayed' | 'bargain'
export const EARNED_CURSES: Record<CurseCause, { card: string; why: string }> = {
  rawskin: { card: 'Flapper', why: 'You went again on tips that were already gone.' },
  exposed: { card: 'Doubt', why: 'You came off with the top in reach. That stays with you.' },
  sprayed: { card: 'Ego', why: 'You told everyone the grade before anybody repeated it.' },
  // CARD-8: the odd one out, kept here for the full picture but NOT earned from
  // how a burn ended. rawskin/exposed come from curseEarned reading the fall,
  // sprayed from claimCurse reading your grades; bargain is a choice you make in
  // an event, applied through the `curse` outcome (spawn by name), so
  // curseEarned deliberately never returns it — a test pins that so nobody
  // wires it into the fall and double-applies Sandbagged Beta with the events.
  bargain: { card: 'Sandbagged Beta', why: 'Cheap topo, cheap for a reason.' },
}
export const RAW_SKIN_AT = 2

/** Has this fall earned you something? Checked once, as the burn ends. */
export function curseEarned(s: GameState): CurseCause | null {
  if (s.result === 'send') return null
  if (s.skin <= RAW_SKIN_AT) return 'rawskin'
  if (exposed(s)) return 'exposed'
  return null
}
/** Put it in the deck, once. A run collects consequences, not a collection. */
export function addCurse(s: GameState, cause: CurseCause): GameState {
  const c = EARNED_CURSES[cause]
  if (!c || !CARDS[c.card]) return s
  // one of each kind a run; the same mistake twice is the same lesson
  if (s.runDeck.some(x => x.name === c.card)) return s
  return { ...s, runDeck: [...s.runDeck, spawn(c.card)],
    log: [...s.log, `${c.card}. ${c.why}`] }
}

export function walkAwayStep(s: GameState): GameState {
  /* RUN-13: walking off is the GOOD circuit outcome — a clean stop with a score
     in hand — but it left no trace in history, which then only ever showed the
     circuits you LOST (endSession records those). Record it as the win it is,
     so "Every Trip" tells the whole story. Career "expeditions started" /
     "success rate" stay Lost-Line metrics on purpose — `wins` counts finale
     sends and the mastery deeds read it — so the circuit lives in history, not
     folded into `runs`/`wins`, which would corrupt the success rate. */
  const rec = recordRun(s, true)
  /* SKIRM-8: it used to go straight to `phase: 'menu'`. So the ONE GOOD outcome this mode
     has — the one RUN-13 added to history because nothing in the game acknowledged it, and
     the one SKIRM-7's partner now nudges you toward — dropped you on the guidebook with no
     screen at all, while every fall got a full account. It ends on `sessionEnd` now, which
     already had a WALKED AWAY heading for a bailed skirmish and needed only the circuit's
     own numbers adding to it.
     `circuit` and `skirmish` are still cleared here: they are MODE_FLAGS (MODE-1) and a
     mode left set leaks into the next attempt. `circuitScore` is not a mode flag, it is the
     score, and the screen reads it — with `result: 'walked'` as the marker for whether this
     ending was a circuit at all, rather than a stale score being taken as one. */
  return { ...rec, circuit: false, skirmish: null, runDeck: [], log: [],
    bestCircuit: Math.max(s.bestCircuit, s.circuitScore),
    phase: 'sessionEnd', result: 'walked' }
}

/** Leave the post. You are back where you were, not a stage further on. */
export function leaveShopStep(s: GameState): GameState {
  return { ...s, shopCards: [], shopGear: [], shopKit: [], phase: 'map',
    shoppedAt: [...s.shoppedAt, s.act * 100 + s.tier] }
}

export function campStep(s: GameState, a: CampAction): GameState {
  const base = noteTrail({ ...s, tier: s.tier + 1 }, trailNote(s))
  // A run was ending with barely two pieces of kit out of twenty-two, because
  // there were only two places to find any. The van is the third choice at a
  // camp, and it costs you the rest you came for.
  if (a.kind === 'van') {
    if (s.vanRaided.includes(s.act)) return toMapNext(base)   // once a range
    return { ...base, vanRaided: [...s.vanRaided, s.act],
      gearOffers: gearOffers(s, a.rng), phase: 'gear' }
  }
  if (a.kind === 'rest')
    return toMapNext({ ...base,
      skin: mutMods(s.mutators).drySpell ? s.skin
        : Math.min(RUN_SKIN + styleMods(s.style).skin, s.skin + campSkinFor(s)),
      psyche: Math.min(psycheMax(s), s.psyche + PSYCHE_CAMP) })
  if (a.kind === 'sharpen') {
    // Flash: the deck you brought is the deck you have
    if (s.inRun && styleMods(s.style).noSharpen) return toMapNext(base)
    return toMapNext({ ...base, runDeck: s.runDeck.map(c => c.name === a.name ? upgrade(c) : c) })
  }
  return toMapNext({ ...base, runDeck: s.runDeck.filter(c => c.uid !== a.uid) })
}
/** Every way a run can end goes through here, so nothing can finish without
    being written down — the phase graph is the seam that has drifted three
    times, so the recording lives in it rather than at each call site. */
export function recordRun(s: GameState, won: boolean): GameState {
  if (!s.inRun && !s.circuit) return s
  /* INJ-1. A trip ending is the only thing that moves a tweak: the one you were
     carrying gets a trip closer to gone, and if you climbed this one down to
     nothing you pick one up. In that order, so a tweak earned today is not
     already a trip old. */
  const rng0 = new RNG(s.seed)
  let tw = tweakAfterRun(s)
  const got = tweakEarned(tw, rng0)
  if (got) tw = { ...tw, tweak: got, seed: rng0.s }
  s = tw
  const cause = won
    ? (s.circuit ? `walked off · ${s.circuitScore} lines` : 'topped out')   // RUN-13
    : s.circuit ? `${s.circuitScore} lines`
    : s.psyche <= 0 ? 'lost the psyche'
    : s.skin <= 0 ? 'skin ran out'
    : `beaten by ${specOf(s).name}`
  const rec: RunRecord = {
    seed: s.runSeed, arch: s.arch, style: s.style, rope: s.topRope, circuit: s.circuit,
    act: s.act, tier: s.tier, won, cause, sends: s.sends, deck: s.runDeck.length,
    mutators: s.mutators,   // META-9
  }
  return { ...s, history: [rec, ...s.history].slice(0, HISTORY_MAX) }
}

/** The choice at the top. Part of the phase graph so the harness cannot
    miss it — adding a phase and not telling the sim is how v4.9 silently
    read every campaign win as a loss. */
/* NARR-8. One epilogue, and it told you he did it and told nobody —
   regardless of whether you had read seven of his pages or none of them. That
   is the one thing `NARR-7` built the pages for: the cost of ignorance. The
   top of the wall now depends on what you actually know when you get there,
   and on whether you have been honest about your own lines on the way up. */
export type EndingKind = 'known' | 'partial' | 'stranger'
/* NARR-11 rescaled these. They were 5 and 2 out of seven pages; there are
   fifteen now, so they are proportions rather than counts and cannot drift
   apart from the journal again. */
export const FINDABLE = JOURNAL.filter(j => j.id !== SUMMIT_PAGE).length
/** How many of his pages you are carrying. The summit page is not one of them — you
    read it after the climb, so it is never beta and never counts toward knowing him. */
export const pagesHeld = (journal: number[]) =>
  journal.filter(p => p !== SUMMIT_PAGE).length
export const KNOWN_AT = Math.ceil(FINDABLE * 0.7)
export const PARTIAL_AT = Math.ceil(FINDABLE * 0.3)

/** NARR-16. How much of the finale you cannot read, on NARR-7's six-grip scale,
    driven by every findable page rather than by the first six. Page 7 is the summit
    page — you read it AFTER the climb, so it has never counted and still does not. */
export function unreadGrip(journal: number[]): number {
  const held = Math.min(pagesHeld(journal), FINDABLE)
  /* CEIL, not round. Six grip spread over fourteen pages means about two pages a step
     whichever way it rounds, so two of the steps are always flat — the only choice is
     WHERE. Rounding puts them at the start, so the first page you ever find changes
     nothing. Ceiling puts them at the end, where the last pages are already paying you
     in the ending and the every-page deed. The first page he wrote should be worth
     something on the wall; the fourteenth does not need to be. */
  return UNREAD_MAX - Math.ceil(UNREAD_MAX * held / FINDABLE)
}

/** What you understand when you get up there. */
export function endingFor(s: GameState): EndingKind {
  const pages = s.journal.length
  return pages >= KNOWN_AT ? 'known' : pages >= PARTIAL_AT ? 'partial' : 'stranger'
}
/** Have you told the truth about your own first ascents? The game has been
    keeping count, and it comes up at the top. */
export function honestyOf(s: GameState): 'sandbagged' | 'sprayed' | 'fair' | 'none' {
  const own = s.established
  if (!own.length) return 'none'
  const drift = own.reduce((a, e) => a + (e.claimed - e.real), 0) / own.length
  // more than a full grade out, on average. One grade either way is an opinion,
  // not a lie — every guidebook in the world disagrees with itself by that much.
  return drift < -1 ? 'sandbagged' : drift > 1 ? 'sprayed' : 'fair'
}

/** Spraying your own grades earns Ego — checked when you put a line in the
    book, because that is the moment you are doing it. */
export function claimCurse(s: GameState): GameState {
  return honestyOf(s) === 'sprayed' ? addCurse(s, 'sprayed') : s
}

/* FA-1: the grade you put on a first ascent is a real economy now, not just a
   flavour line. UNDERSELL it — a sandbag, the game's namesake — and the reward
   is quiet and lasting: XP, because a line stiffer than its grade earns a
   reputation and teaches you the most. OVERSELL it (spray) and the reward is
   loud and immediate — cash, the story sells — but `claimCurse` still checks
   your running average and hands you Ego if you make a habit of it. Honest pays
   a little of the calm reward. All of it is OFF the campaign band by
   construction: the reward lives here in the claim RULE, which the sim's
   honest-claim policy (run.mjs) never calls, and XP only feeds the collection
   the drift guard already measures at a full "built" loadout. */
export const CLAIM_XP = 6
export const SANDBAG_XP = 10   // per grade undersold, capped at three
export const SPRAY_CASH = 15   // per grade oversold, capped at three

export function claimStep(s: GameState, name: string, grade: number, rng: RNG): GameState {
  const spec = s.skirmish
  if (!spec) return s
  const real = spec.grade
  const rec: Established = { name, claimed: grade, real, act: s.act, burns: s.burn,
    style: spec.style, clear: spec.clear, crux: spec.crux, feet: spec.feet, run: s.runs }
  const honesty = real - grade      // > 0 undersold (sandbag), < 0 oversold (spray)
  const xpGain = honesty > 0 ? CLAIM_XP + SANDBAG_XP * Math.min(honesty, 3)
    : honesty === 0 ? CLAIM_XP : 0
  const cashGain = honesty < 0 ? SPRAY_CASH * Math.min(-honesty, 3) : 0
  let out: GameState = { ...s,
    established: [rec, ...s.established].slice(0, ESTABLISHED_MAX),
    book: { ...s.book, [name]: { sends: 1, bestBurn: s.burn, bestStyle: s.style,
      flashed: s.burn === 1, weather: s.weather, rock: s.rock } },
    cash: s.cash + cashGain, skirmish: null }
  out = claimCurse(out)                       // CARD-6: a habit of spraying earns Ego
  if (xpGain > 0) out = gainXp(out, xpGain, rng)
  // in a run you drop back onto the map a stage further on — and, like every
  // other stage advance, it leaves a mark on the trail (UX-16); a standalone FA
  // from the menu goes home to the menu
  const back: GameState = s.inRun
    ? noteTrail({ ...out, phase: 'map', tier: s.tier + 1 }, trailNote(s))
    : { ...out, phase: 'menu' }
  return back.packCards.length ? { ...back, afterPack: back.phase, phase: 'pack' } : back
}

export function endingStep(s: GameState, kind: 'told' | 'kept'): GameState {
  return recordRun({ ...s, ending: `${endingFor(s)}-${kind}`,
    phase: 'runEnd', result: 'send' }, true)
}
export function leaveEventStep(s: GameState): GameState {
  return toMapNext(noteTrail({ ...s, eventId: null, eventResult: null, tier: s.tier + 1,
    eventsSeen: s.eventId ? Array.from(new Set([...s.eventsSeen, s.eventId])) : s.eventsSeen },
    trailNote(s)))
}

/* ========================= THE SPOTTER =============================
   Nothing taught the board — every rule was learned by losing. This is
   someone on the ground shouting the beta up at you: one line, always
   the thing that is about to cost you most.                          */
export function coach(s: GameState): string | null {
  const spec = specOf(s)
  if (spec.tutorial) return TUTORIAL_STEPS[Math.min(s.cleared, TUTORIAL_STEPS.length - 1)]
  if (!s.coaching) return null
  const holds = s.boardH, mine = s.boardP
  const handHolds = [0, 1].filter(i => holds[i])
  if (s.turn === 1 && !mine.some(Boolean))
    return 'Tap a card, then tap a lane. COMMIT resolves all three lanes at once.'
  if (specOf(s).roped && s.lastPiece < 0 && s.cleared >= 2)
    return 'You have nothing in. Come off now and it is a ground fall — clip something.'
  if (specOf(s).roped && s.runout >= 4 && s.pump >= PUMP_MAX - 4)
    return `${s.runout} holds above the gear. Fall now and you lose all of it — get a piece in.`
  if (s.inRun && s.psyche <= DOUBT_AT)
    return 'Your head has gone. Doubt is costing you an extra pump every turn — rest at a camp.'
  if (s.pump >= PUMP_MAX - 2)
    return 'You are about to come off. Shake out, or clear a lane to slow the clock.'
  if (!mine[2] && handHolds.length)
    return 'Feet lane empty — that is campusing. Both hands take +1 Bite until you put a foot on.'
  for (const i of [0, 1]) {
    const h = holds[i], c = mine[i]
    if (!h || !c) continue
    // ENG-28: the spotter reads the ability the hold actually HAS — a signature
    // can override its base (The Wet Jug is Greasy, not a Rest) and a brushed
    // hold has none at all, so the base lookup shouted the wrong beta.
    const ab = abilityOf(h)
    if (ab === 'Committing' && powerAgainst(s, c, h, i) < 2)
      return 'A crux needs Power 2 or more. Below that the move does nothing at all.'
    if (ab === 'Greasy' && c.fx !== 'friction' && !mine[2])
      return 'Slopers are Greasy: −1 Power unless your feet are on. Friction cards ignore it.'
    if (ab === 'Two-finger')
      return 'Pockets ignore Support. Your feet will not help on that one.'
    if (c.contact <= biteAgainst(s, c, h, i) && !c.latch)
      return `${c.name} will not survive that Bite. It burns out for the rest of the burn.`
  }
  const open = [0, 1].find(i => holds[i] && !mine[i])
  if (open !== undefined)
    return 'An unanswered hold bites straight into your pump, and costs an extra tax at end of turn.'
  if (mine.some(c => (c?.settled ?? 0) > 0))
    return 'A card that survives settles in — it gains Power every turn it stays on.'
  if (s.flow >= FLOW_HIGH)
    return 'Dialed in. Unanswered lanes cost no tax and the dyno is landing — throw for it while it holds.'
  if (s.flow >= FLOW_AT)
    return 'Flow is up, so an unanswered lane costs no tax. Keep clearing to dial in; resting now would break it.'
  if (!mine[2] && !handHolds.length) return null
  return null
}

export const KEYWORDS: { name: string; text: string }[] = [
  { name: 'What a hold reads', text: 'A hold you have not worked shows a range, not a number — you have not been on it yet. Beta makes it exact. That is what projecting buys.' },
  { name: 'Opposition', text: 'A move that pulls sideways needs the other hand pulling back. Alone it is weaker; opposed by another sideways move it is stronger. Which hand you use is a decision.' },
  { name: 'Resolve order', text: 'Lanes resolve in the order you placed them, and a hand that has already come off stops holding for the other one.' },
  { name: 'The route acts', text: 'Every few turns the route does something, and always says so a turn beforehand. Greasing up, drying out, a gust, a flake coming off.' },
  { name: 'Exposed', text: 'Past about two thirds of the way up, backing off costs an extra psyche. Walking away from something you had nearly done is not free.' },
  { name: 'Clipping', text: 'On a rope, placing a piece resets your runout and, for one turn, lets you climb like somebody who is not going to hit the ground.' },
  { name: 'Sequence', text: 'A plan held across turns. Meet its condition every turn and it pays out; miss once and it is gone.' },
  { name: 'Boons', text: 'Found where gear is found. Gear gives you numbers; a boon changes a rule. The wild ones change how a turn feels.' },
  { name: 'Power / Contact', text: 'Your Power chips a hold\'s Grip. Its Bite chips your Contact. Both happen at once.' },
  { name: 'Bite / Grip', text: 'A hold\'s attack and its health. Grip to 0 works the hold; Contact to 0 burns your card.' },
  { name: 'Pump', text: 'Your health and your mana in one bar. Bonus cards spend it. Fill it and you fall.' },
  { name: 'The clock', text: '+1 pump every turn, plus 1 for every hold you have not answered. Clearing slows it.' },
  { name: 'Support / campusing', text: 'A card in the feet lane adds Power to both hands. An empty feet lane adds Bite instead.' },
  { name: 'Settle', text: 'A move that survives a turn gains +1 Power, up to +2. Durability turns into offence.' },
  { name: 'Beta', text: 'Hold types you have worked come back at −1 Grip on later burns. Falling is learning.' },
  /* CARD-18: both of these were mechanics the game had and never named. A card can
     spend skin and a card can read the wall, and until this ticket exactly one card
     did each — so neither was worth explaining. Now they are. */
  { name: 'Reading ahead', text: 'The next holds off the route deck, before you are on them. Some cards read them, some holds read themselves, and being dialed in reads them for free. It changes what you plan and never what the hold does.' },
  { name: 'Skin', text: 'How much more your hands will take on this trip. Falls cost it, a camp gives some back, and running out ends the trip wherever you happen to be standing. A few cards spend it outright.' },
  { name: 'Anchor', text: 'Does not burn out when it blows — it returns to the discard pile.' },
  { name: 'Latch', text: 'Survives its first blow at 1 Contact instead of being destroyed.' },
  { name: 'Precise', text: '+2 Power against crimps and sharp crimps.' },
  { name: 'Friction', text: 'Ignores a sloper\'s Greasy penalty.' },
  { name: 'Static', text: 'Takes 1 less Bite. A move made slowly and deliberately costs you less when it goes wrong.' },
  { name: 'Tough', text: 'Ignores Sharp and Razor when it blows.' },
  { name: 'Balance', text: 'Prevents a pinch\'s Squeeze.' },
  { name: 'Hooked', text: 'Cancels the extra hang tax a crux adds.' },
  { name: 'Snap', text: 'Outright clears any hold at Grip 3 or less.' },
  { name: 'Commit', text: 'A dyno. Roll to stick it — better fresh, worse pumped, better with feet on. Stick it and you skip the next hold as well. Miss and you are off it.' },
  { name: 'Guard', text: 'While it survives, the other hand lane takes 1 less Bite.' },
  { name: 'Momentum', text: '+1 Power for each point of flow.' },
  { name: 'Weight', text: '+1 Power for every other card you have on the board.' },
  { name: 'Echo', text: 'Returns to your hand when it clears a hold.' },
  { name: 'Peel', text: 'Draw a card when it blows.' },
  { name: 'Cycle', text: 'Draws a card each turn it holds on, as the turn resolves.' },
  { name: 'Chip', text: 'Also damages the Grip of every other hold on the board.' },
  { name: 'Greedy', text: 'Stronger the closer you are to coming off: +1 Power for every 2 pump you are carrying.' },
]


/* ============================ INK MATHS ============================
   Deterministic geometry: a border derived from a seed rather than rolled,
   so a card is inked with the same stroke on every render. Pure, cached and
   tested, so it belongs with the rules rather than with the screens — the
   <Ink> component that draws with it stays in the UI.                   */
export function jit(a: number): number {
  let t = (a * 0x6D2B79F5) >>> 0
  t = Math.imul(t ^ (t >>> 15), 1 | t)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1)
}
// PERF-1: these are pure functions of (w,h,seed,amp,segs) and were being
// rebuilt every render — ~6KB of string building per frame for paths that
// never change. Cached, with a cap so a long session cannot grow it forever.
const PATHS = new Map<string, string>()
/* RUN-8. Where each stage sits on the act map. In the engine rather than the
   component because it is geometry, and geometry goes quietly out of bounds. */
export const MAP_W = 352
export const MAP_H = 212
export const MAP_PAD = 26
export const ACT_TERRAIN = ['FOREST', 'DESERT', 'ALPINE']
export const MAP_TOP = 34        // the cliff line sits above this
export const MAP_BOT = MAP_H - 26 // the road runs below it

/* The first version swung the path by 0.28 of the width on a sine of the stage
   index, which at nine stages is a ±99px zigzag — it read as a scribble rather
   than a line up a hill. A path meanders; it does not oscillate. Amplitude is a
   sixth of the width now and the period is set across the whole act rather than
   per stage, so it drifts once or twice instead of switching back every step. */
export function mapPoints(total: number, seed: number): [number, number][] {
  const n = Math.max(1, total)
  return Array.from({ length: n }, (_, i) => {
    const t = n > 1 ? i / (n - 1) : 0
    const x = MAP_W / 2 + Math.sin(t * Math.PI * 1.6 + seed * 0.7) * (MAP_W * 0.16)
      + jit(seed * 31 + i) * 7
    return [Math.max(MAP_PAD, Math.min(MAP_W - MAP_PAD, x)),
      MAP_BOT - t * (MAP_BOT - MAP_TOP)]
  })
}
/** The contours: arcs that bulge uphill and narrow toward the wall, rather than
    the full-width ruled lines the first version drew. */
export function mapContours(act: number, seed: number): { d: string; y: number }[] {
  const rows = 4 + (act % 3)
  const out: { d: string; y: number }[] = []
  for (let k = 0; k < rows; k++) {
    const t = rows > 1 ? k / (rows - 1) : 0
    const y = MAP_BOT - t * (MAP_BOT - MAP_TOP) * 0.92
    const span = MAP_W * 0.46 * (1 - t * 0.42)
    const cx = MAP_W / 2 + jit(seed * 11 + k) * 10
    const bulge = 9 + t * 7
    let d = ''
    for (let i = 0; i <= 24; i++) {
      const u = i / 24
      const x = cx - span + 2 * span * u
      const yy = y - Math.sin(u * Math.PI) * bulge + jit(seed * 17 + k * 31 + i) * 1.6
      d += `${i ? 'L' : 'M'}${x.toFixed(1)},${yy.toFixed(1)}`
    }
    out.push({ d, y })
  }
  return out
}
/** The wall, as a guidebook draws one: a line with hachures on the uphill side. */
export function mapCliff(seed: number): { d: string; ticks: [number, number][] } {
  const pts: [number, number][] = []
  for (let i = 0; i <= 24; i++) {
    const u = i / 24
    pts.push([MAP_PAD - 4 + (MAP_W - (MAP_PAD - 4) * 2) * u,
      MAP_TOP - 8 + Math.sin(u * 3.1) * 4 + jit(seed * 41 + i) * 1.5])
  }
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('')
  return { d, ticks: pts.filter((_, i) => i % 2 === 0) }
}

export function roughPath(w: number, h: number, seed: number, amp = 1.25, segs = 1): string {
  const key = `${w}|${h}|${seed}|${amp}|${segs}`
  const hit = PATHS.get(key)
  if (hit) return hit
  const out = buildRough(w, h, seed, amp, segs)
  if (PATHS.size > 600) PATHS.clear()
  PATHS.set(key, out)
  return out
}
export function buildRough(w: number, h: number, seed: number, amp: number, segs: number): string {
  const j = (i: number) => jit(seed * 131 + i) * amp
  const c: [number, number][] = [
    [2 + j(1), 2 + j(2)], [w - 2 + j(3), 2 + j(4)],
    [w - 2 + j(5), h - 2 + j(6)], [2 + j(7), h - 2 + j(8)],
  ]
  const f = (n: number) => n.toFixed(1)
  let d = `M${f(c[0][0])},${f(c[0][1])}`
  for (let i = 0; i < 4; i++) {
    const a = c[i], b = c[(i + 1) % 4]
    // segs > 1 subdivides the edge — that is all a deckled edge is
    for (let k = 1; k <= segs; k++) {
      const t0 = (k - 1) / segs, t1 = k / segs
      const p0: [number, number] = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0]
      const p1: [number, number] = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1]
      const n = i * 40 + k * 3
      d += ` Q${f((p0[0] + p1[0]) / 2 + j(n))},${f((p0[1] + p1[1]) / 2 + j(n + 1))} ${f(p1[0])},${f(p1[1])}`
    }
  }
  return d + ' Z'
}

/* A card's family is derived from what it does, in a fixed priority. The
   marks that draw it are in the UI; which family a card belongs to is a
   rule, so it lives here. */
export function familyOf(c: { rarity: Rarity; clip: boolean; shed: number; kind: string; lane: LaneTag }): string {
  if (c.rarity === 'curse') return 'curse'
  if (c.rarity === 'beta') return 'beta'
  if (c.clip) return 'clip'
  if (c.shed > 0) return 'rest'
  if (c.kind === 'bonus') return 'mind'
  if (c.lane === 'feet') return 'feet'
  return 'hand'
}
