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
  clip: boolean; seq: string
  /** ENG-12. A move that pulls sideways needs the other hand pulling back.
      Left and right were interchangeable, which made a three-lane board a
      two-lane one; this is what makes *which hand* a question. */
  opposes: boolean
  fx: Fx; targeted: boolean; text: string; latched?: boolean; settled?: number
  upgraded?: boolean
}
type Piles = { draw: Card[]; discard: Card[]; exhaust: Card[]; hand: Card[] }
export type Phase = 'menu' | 'map' | 'climb' | 'burnEnd' | 'sessionEnd'
  | 'reward' | 'camp' | 'runEnd' | 'pack' | 'collection' | 'event' | 'journal' | 'deck' | 'talk'
  | 'glossary' | 'gear' | 'logbook' | 'shop' | 'circuitNext' | 'saves' | 'stats'
  | 'prepare' | 'more' | 'epilogue' | 'history' | 'line' | 'claim'
export type NodeType = 'climb' | 'camp' | 'boss' | 'event' | 'project' | 'shop' | 'fa'
  | 'established'
// Skin is worth ~16 points of completion — far too coarse for a small
// decision. Cash is the currency you can spend a little of.
export const PRICE = { common: 30, uncommon: 55, rare: 90, gear: 70, boon: 110, cut: 40, skin: 45 }
// A reward used to be three cards, take one. These make it a decision with a
// price on it — cash, or the health of your deck.
export const REROLL_BASE = 25
export const REROLL_STEP = 15
export const CROP_COST = 45
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
export function faRoute(act: number, rng: RNG): RouteSpec {
  const grade = Math.min(10, 3 + act * 3 + rng.int(3))
  const styles: StyleKey[] = ['mixed', 'slab', 'crimp ladder', 'compression', 'power']
  const feet: FeetKey[] = ['normal', 'hard']
  return {
    name: 'An unclimbed line', grade, style: styles[rng.int(styles.length)],
    // scales with the grade, as circuitRoute and skirmishRoute already did —
    // this alone did not, so every first ascent was the same length
    clear: 5 + Math.floor(grade * 0.7) + rng.int(2), crux: 1 + Math.floor(grade / 4),
    feet: feet[rng.int(feet.length)], fa: true,
    note: 'Nobody has been up this. No chalk, no tick marks, nothing in the book.',
  }
}
/* LOG-2. The book recorded every send and paid nothing back. You remember a
   route you have done — that is what beta is — so a line you have ticked
   starts with some of its sequence already known. */
export const BOOK_BETA_MAX = 2
export const HISTORY_MAX = 20

/* ============================ THE LINE =============================
   Same rock, more than one way up it. Which one suits you is a question
   about your deck rather than about difficulty.                       */
export type Line = { id: string; name: string; text: string
  dClear?: number; dCrux?: number; dTax?: number }
export const LINES: Line[] = [
  { id: 'guide', name: 'As it goes', text: 'The line in the book. No arguments.' },
  { id: 'direct', name: 'The direct', dClear: -2, dCrux: 3,
    text: 'Straight up it. Two fewer holds to work, but three more cruxes on the way.' },
  { id: 'traverse', name: 'The traverse', dClear: 1, dCrux: -2,
    text: 'Out left and back in. One more hold, two fewer cruxes, and a longer day.' },
]
export type RunRecord = {
  seed: number; arch: number; style: number; rope: boolean; circuit: boolean
  act: number; tier: number; won: boolean; cause: string; sends: number; deck: number
}
export const PROJECT_SKIN = 0     // the price is the node, not your skin
export const RUNOUT_SKIN = 2      // holds of runout per skin lost in a fall
export const FALL_PUMP = 0.5      // pump you keep after being caught
export type MapNode = { type: NodeType; routeIdx: number }

export type GameState = {
  seed: number; routeIdx: number; deckTier: number; burn: number; skin: number
  weather: number; rock: number
  beta: string[]; worked: string[]
  holdDeck: Hold[]; feetDeck: Hold[]
  boardH: (Hold | null)[]; boardP: (Card | null)[]
  piles: Piles
  pump: number; flow: number; cleared: number; turn: number
  log: string[]; phase: Phase; result: 'send' | 'fall' | 'bail' | null
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
  runs: number
  falls: number
  shopCards: Card[]
  shopGear: string[]
  bought: string[]
  loadout: string[]
  act: number
  seen: string[]
  talkId: string | null
  talkReply: string | null
  coaching: boolean
  sound: boolean
  cbSafe: boolean
  motion: boolean
  textScale: number
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
  dailyScore: number
  dailyBest: number
  dailyStreak: number
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
  dailyDay?: string; dailyScore?: number; dailyBest?: number; dailyStreak?: number
  mutators?: string[]
  runs?: number; falls?: number; ending?: string; topRope?: boolean; history?: RunRecord[]
  coaching?: boolean; sound?: boolean; cbSafe?: boolean; tutorialDone?: boolean
  motion?: boolean; textScale?: number
  run: { deck: string[]; tier: number; skin: number; seed: number; act: number
    gear: string[]; boons: string[]; cash: number; psyche: number; runSeed: number
    eventsSeen: string[] } | null
}
const slotKey = (n: number) => `${SAVE_KEY}.${n}`

export function saveGame(s: GameState) {
  try {
    const d: SaveData = {
      v: SAVE_FILE_VERSION, level: s.level, xp: s.xp, owned: s.owned,
      sends: s.sends, wins: s.wins, journal: s.journal, loadout: s.loadout,
      style: s.style, styleMax: s.styleMax, seen: s.seen, coaching: s.coaching, sound: s.sound, cbSafe: s.cbSafe,
      tutorialDone: s.tutorialDone, motion: s.motion, textScale: s.textScale,
      arch: s.arch, loadouts: s.loadouts, book: s.book, bestCircuit: s.bestCircuit, ticked: s.ticked, established: s.established, hints: s.hints, grades: s.grades, tweak: s.tweak,
      dailyDay: s.dailyDay, dailyScore: s.dailyScore, dailyBest: s.dailyBest, dailyStreak: s.dailyStreak,
      mutators: s.mutators,
      runs: s.runs, falls: s.falls, ending: s.ending, topRope: s.topRope,
      history: s.history.slice(0, HISTORY_MAX),
      run: s.inRun && s.tier < ACTS[s.act].length
        ? { deck: s.runDeck.map(c => c.upgraded ? c.name : c.name), tier: s.tier, skin: s.skin, seed: s.seed,
            act: s.act, gear: s.gear, boons: s.boons, cash: s.cash, psyche: s.psyche,
            runSeed: s.runSeed, eventsSeen: s.eventsSeen }
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
    if (typeof d.level !== 'number') return false
    localStorage.setItem(slotKey(slot), json)
    return true
  } catch { return false }
}
export function loadGame(slot = 0): Partial<GameState> {
  try {
    const raw = localStorage.getItem(slotKey(slot))
    if (!raw) return {}
    const d = JSON.parse(raw) as SaveData
    // Older saves are merged, not discarded — every field has a default, so a
    // version bump fills gaps instead of wiping the player. Only a NEWER save
    // than this build is refused.
    if ((d.v ?? 0) > SAVE_FILE_VERSION) return {}
    return {
      level: d.level, xp: d.xp, owned: d.owned ?? [], sends: d.sends ?? 0, wins: d.wins ?? 0,
      journal: d.journal ?? [],
      ...(d.loadout && d.loadout.length === DECK_SIZE ? { loadout: d.loadout } : {}),
      style: d.style ?? 0, styleMax: d.styleMax ?? 0, seen: d.seen ?? [],
      coaching: d.coaching ?? true, sound: d.sound ?? true, cbSafe: d.cbSafe ?? false,
      tutorialDone: d.tutorialDone ?? false,
      motion: d.motion ?? true, textScale: d.textScale ?? 0,
      arch: d.arch ?? 0,
      ...(d.loadouts && d.loadouts.length === ARCHETYPES.length ? { loadouts: d.loadouts } : {}),
      book: d.book ?? {}, bestCircuit: d.bestCircuit ?? 0, mutators: d.mutators ?? [],
      ticked: d.ticked ?? [], established: d.established ?? [], hints: d.hints ?? true,
      grades: d.grades ?? 'v', tweak: d.tweak ?? null,
      dailyDay: d.dailyDay ?? '', dailyScore: d.dailyScore ?? 0,
      dailyBest: d.dailyBest ?? 0, dailyStreak: d.dailyStreak ?? 0,
      runs: d.runs ?? 0, falls: d.falls ?? 0, ending: d.ending ?? '',
      topRope: d.topRope ?? true, history: d.history ?? [],
      ...(d.run ? { inRun: true,
        runDeck: d.run.deck.map(n => n.endsWith('+')
          ? upgrade(spawn(n.slice(0, -1))) : spawn(n)),
        tier: d.run.tier,
        skin: d.run.skin, seed: d.run.seed, act: d.run.act ?? 0, gear: d.run.gear ?? [],
        cash: d.run.cash ?? 0, boons: d.run.boons ?? [], psyche: d.run.psyche ?? PSYCHE_MAX,
        runSeed: d.run.runSeed ?? 0, eventsSeen: d.run.eventsSeen ?? [] } : {}),
    }
  } catch { return {} }
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
/* ROUTE-5. Seven hold types across thirty-one routes meant every crimp
   behaved like every other crimp, and a route was remembered as a stat line.
   A signature hold is one named feature per line — the thing you tell somebody
   about afterwards. It behaves as its base type with the numbers moved. */
export type Signature = {
  id: string; name: string; note: string; base: string
  dGrip?: number; dBite?: number; ability?: string
}
export const SIGNATURES: Signature[] = [
  { id: 'rattler', name: 'The Rattler', base: 'crimp', dBite: 2, ability: 'Sharp',
    note: 'A flake the size of a dinner plate. It moves when you pull on it.' },
  { id: 'twofinger', name: 'The Two-Finger Pocket', base: 'pocket', dGrip: 1,
    note: 'Two fingers fit. A third would have made this a different climb.' },
  { id: 'wetjug', name: 'The Wet Jug', base: 'jug', dGrip: 2, ability: 'Greasy',
    note: 'It seeps. It has always seeped. Everyone knows and nobody mentions it.' },
  { id: 'thankgod', name: 'The Thank God Hold', base: 'jug', dGrip: -2,
    note: 'You do not know it is there until your hand is already on it.' },
  { id: 'guillotine', name: 'The Guillotine', base: 'sharp crimp', dBite: 1,
    note: 'A horizontal edge with an edge. People tape up for this one move.' },
  { id: 'organpipe', name: 'The Organ Pipe', base: 'pinch', dGrip: 2, ability: 'Squeeze',
    note: 'A fin you can get both hands round and no way to weight your feet.' },
  { id: 'deathblock', name: 'The Death Block', base: 'sloper', dGrip: 3,
    note: 'Enormous, rounded, and entirely without features. It goes on for a while.' },
  { id: 'letterbox', name: 'The Letterbox', base: 'pocket', dBite: -1, ability: 'Two-finger',
    note: 'A slot you post a hand into and hope to get back.' },
  { id: 'sidewinder', name: 'The Sidewinder', base: 'crimp', dGrip: 2,
    note: 'Good, if you are standing somewhere you cannot stand.' },
  { id: 'lastjug', name: 'The Last Jug', base: 'jug', dGrip: -1, ability: 'Rest',
    note: 'The last thing on the route that is kind to you.' },
  { id: 'bellows', name: 'The Bellows', base: 'pinch', dBite: 1, dGrip: -1,
    note: 'A slot the wind comes up through. Cold hands, and you can hear it coming.' },
]
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
  /** ROUTE-6: the conditions turn partway up. */
  window?: WeatherWindow
  roped?: boolean; pitches?: number
  /** An unclimbed line: no grade shown, dirty holds, yours to name. */
  fa?: boolean
  /** The one feature on this line that people talk about. */
  signature?: string
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
    note: 'Everyone starts here. Nobody writes it in the book.' },
  { name: 'The Sit Start', grade: 1, style: 'mixed', clear: 6, crux: 0, feet: 'normal',
    note: 'Two moves off the ground and already honest.' },
  { name: 'Mossback', grade: 1, style: 'slab', clear: 6, crux: 1, feet: 'hard',
    note: 'No handholds worth the name. Just faith and rubber.' },
  { name: 'Chossmaster', grade: 2, style: 'mixed', clear: 7, crux: 1, feet: 'normal',
    signature: 'rattler',
    note: 'Half of it came off in my hand. The half that stayed was good.' },
  { name: 'Peeler', grade: 2, style: 'crimp ladder', clear: 7, crux: 1, feet: 'normal',
    note: 'Named for what it does to you, not for what it looks like.' },
  { name: 'The Fridge', grade: 3, style: 'compression', clear: 9, crux: 1, feet: 'normal',
    signature: 'deathblock',
    note: "You don't hold the fridge. You hug it and hope." },
  { name: 'Deer Tick', grade: 3, style: 'power', clear: 8, crux: 2, feet: 'easy',
    note: 'Small, mean, and it gets under your skin.' },
  { name: 'Cathedral Traverse', grade: 4, style: 'mixed', clear: 10, crux: 2, feet: 'normal',
    note: 'Forty feet sideways. The forearms go long before the moves do.' },
  { name: 'Wasp Nest', grade: 4, style: 'power', clear: 9, crux: 3, feet: 'easy',
    signature: 'letterbox',
    note: 'Three hard moves. Every one of them wants you off.' },
  { name: 'The Priest', grade: 5, style: 'compression', clear: 10, crux: 3, feet: 'hard',
    signature: 'guillotine',
    note: "His chalk is still in the crack. Thirty years and nobody's touched it.",
    phases: [{ at: 0.65, name: 'The Headwall', dTax: 1,
      text: 'It steepens and does not stop. The clock runs faster from here.' }] },

  { name: 'The Sandbag', grade: 3, style: 'crimp ladder', clear: 11, crux: 2, feet: 'normal',
    note: 'Given V2 by a man who never did it. It has never been V2.' },

  // ---------------- ACT 2 · desert towers ----------------
  { name: 'The Gooseneck', grade: 5, style: 'mixed', clear: 10, crux: 1, feet: 'normal',
    note: 'Sandstone that eats skin and gives nothing back.' },
  { name: 'Varnish', grade: 5, style: 'crimp ladder', clear: 10, crux: 1, feet: 'normal',
    note: 'Black desert varnish, holds like glass until it is not.' },
  { name: 'Sun Dagger', grade: 6, style: 'power', clear: 10, crux: 1, feet: 'easy',
    signature: 'twofinger',
    note: 'Shade for forty minutes a day. Miss it and you cook.' },
  { name: 'The Chimney', grade: 6, style: 'compression', clear: 11, crux: 1, feet: 'normal',
    signature: 'organpipe',
    note: 'You do not climb it so much as fight your way up the inside.' },
  { name: 'Rattlesnake Arete', grade: 6, style: 'slab', clear: 10, crux: 1, feet: 'hard',
    note: 'Check the base before you drop the pads. Every time.' },
  { name: 'Kiln', grade: 7, style: 'power', clear: 11, crux: 2, feet: 'easy',
    note: 'A hundred and ten in the shade and there is no shade.' },
  { name: 'The Hourglass', grade: 7, style: 'mixed', clear: 12, crux: 2, feet: 'normal',
    signature: 'sidewinder',
    note: 'Two towers welded at the waist. He drew it in the margin twice.',
    phases: [{ at: 0.5, name: 'The Waist', lockLane: 1,
      text: 'The tower pinches in. There is nothing out right — left hand only.' }] },

  { name: 'Furnace Arete', grade: 6, style: 'power', clear: 13, crux: 2, feet: 'easy',
    note: 'South facing, no shade, and the rock stays warm past midnight.' },

  // ---------------- ACT 3 · the alpine wall ----------------
  { name: 'The Notch', grade: 7, style: 'slab', clear: 11, crux: 3, feet: 'hard',
    note: 'Granite, altitude, and weather that turns in twenty minutes.' },
  { name: 'Cold Shoulder', grade: 8, style: 'crimp ladder', clear: 12, crux: 3, feet: 'normal',
    note: 'Your fingers stop reporting back somewhere around the third move.' },
  { name: 'Icebox Corner', grade: 8, style: 'compression', clear: 12, crux: 3, feet: 'normal',
    signature: 'wetjug',
    note: 'North facing. Never dries. Perfect friction, no feeling.' },
  { name: 'Whiteout Slab', grade: 8, style: 'slab', clear: 12, crux: 3, feet: 'hard',
    note: 'Nothing to hold. Nothing to see. Stand up on it anyway.' },
  { name: 'The Nose Direct', grade: 7, style: 'mixed', clear: 12, crux: 3, feet: 'normal',
    roped: true, pitches: 3,
    note: 'Three pitches, and the second one is why people come.' },
  { name: 'Coffin Crack', grade: 8, style: 'compression', clear: 12, crux: 3, feet: 'normal',
    roped: true, pitches: 3,
    note: 'Off-width the whole way. Bring the big gear and your dignity.' },
  { name: 'The Diving Board', grade: 9, style: 'power', clear: 12, crux: 3, feet: 'easy',
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

  { name: 'The Cornice', grade: 8, style: 'slab', clear: 14, crux: 3, feet: 'hard',
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
  { name: 'Squeeze Chimney', grade: 5, style: 'mixed', clear: 12, crux: 1, feet: 'hard',
    note: 'Nobody has ever enjoyed this. It goes in the book anyway.' },
  { name: 'Sunstroke Slab', grade: 7, style: 'slab', clear: 10, crux: 2, feet: 'hard',
    note: 'No shade, no holds, no hurry. Two of those are a problem.' },
  { name: 'The Warm-Up Boulder', grade: 0, style: 'jug haul', clear: 12, crux: 0, feet: 'easy',
    tutorial: true,
    holds: ['jug', 'jug', 'jug', 'sloper', 'crimp', 'crimp', 'pinch', 'pinch',
      'sharp crimp', 'crux', 'jug', 'jug'],
    note: 'Ten minutes from the car. Everybody starts here.' },
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

  // ---------- UNCOMMON · technique ----------
  bn('Visualize', 0, 'uncommon', { draw: 2, text: 'Draw 2.' }),
  bn('Try-Hard Scream', 2, 'uncommon', { power: 3, targeted: true, text: '+3 Power to one lane.' }),
  bn('Chalk Bag', 0, 'uncommon', { shed: 1, draw: 1, text: 'Shed 1. Draw 1.' }),
  bn('Liquid Chalk', 1, 'uncommon', { powerAll: 1, text: '+1 Power to every lane.' }),
  bn('Guidebook', 0, 'uncommon', { gripCut: 3, targeted: true, text: '−3 Grip to one hold.' }),
  bn('Second Wind', 1, 'uncommon', { shed: 4, draw: 1, text: 'Shed 4. Draw 1.' }),
  bn('Skin File', 0, 'uncommon', { restore: 2, text: 'Return 2 burnt cards to hand.' }),
  bn('Beta Spray', 0, 'uncommon', { draw: 2, shed: 1, text: 'Shed 1. Draw 2.' }),

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
  mv('Read And React', 3, 7, 'rare', { fx: 'cycle', text: 'Cycle · draw when you place it.' }),
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
  mv('Tweaked Pulley', 1, 2, 'curse', { text: 'It popped. You felt it pop.' }),
  mv('Split Tip', 2, 3, 'curse', { text: 'Right down the middle of the pad.' }),
  mv('Wet Holds', 1, 4, 'curse', { text: 'Seeping. Nothing sticks.' }),
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
  mv('Tweaky Finger', 1, 3, 'curse', { text: 'It twinges. You keep going.' }),
  mv('Flapper', 2, 4, 'curse', { text: 'Skin off. Tape it.' }),
  mv('Cold Shut', 0, 5, 'curse', { text: 'No feeling in it at all.' }),
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
  [C(7), C(8), PROJ(10), SHOP],  // Cathedral Traverse · Wasp Nest · The Sandbag
  [B(9)],                        // The Priest
]
const ACT2_MAP: MapNode[][] = [
  [C(11), C(12), C(31)],         // The Gooseneck · Varnish · Squeeze Chimney
  [CAMP, EVT, C(13), SHOP],
  [C(13), C(14), PROJ(18), SHOP],// Sun Dagger · The Chimney · Furnace Arete
  [CAMP, C(15), EVT, FA],
  [C(15), C(16), C(30), SHOP],   // Rattlesnake Arete · Kiln · The Blowhole
  [C(30), C(32), EVT],           // The Blowhole · Sunstroke Slab
  [CAMP, EVT, PROJ(18)],
  [B(17)],                       // The Hourglass
]
const ACT3_MAP: MapNode[][] = [
  [C(19), C(20)],                // The Notch · Cold Shoulder
  [CAMP, EVT, C(21)],
  [C(21), C(22), PROJ(28), SHOP],// Icebox Corner · Whiteout Slab · The Cornice
  [C(23), C(24), SHOP],          // The Nose Direct · Coffin Crack  — roped
  [CAMP, C(25), EVT, FA],
  [C(25), C(26), SHOP],          // The Diving Board · Bergschrund
  [CAMP, EVT, PROJ(28)],
  [B(27)],                       // Summit Block
  [B(29)],                       // THE LOST LINE
]
export const ACTS: MapNode[][][] = [ACT1_MAP, ACT2_MAP, ACT3_MAP]
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
  dAttempts?: number
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
    sig: 'Plastic', sigText: '+2 Power on every move, and one less burn a day. All engine, no patience.',
    dPower: 2, dAttempts: -1,
    loadout: L(['Deadpoint', 2], ['Lunge', 2], ['Bump', 1], ['Mantle', 1], ['Crimp Grip', 1],
      ['Smear', 2], ['High Step', 1], ['Shake Out', 2], ['Deep Breath', 1],
      ['Breathe', 1], ['Chalk Up', 1]) },
  { id: 'trad', name: 'The Trad Dad', unlock: 8, gear: 'tape',
    text: 'Slow, bomber, and will tell you about the rack.',
    sig: 'Bomber', sigText: '+1 Contact on every move, and nothing you place ever settles.',
    dContact: 1, settleMax: 0,
    loadout: L(['Hand Jam', 2], ['Arm Bar', 2], ['Undercling', 2], ['Slow Pull', 1],
      ['Heel Hook', 2], ['Smear', 1], ['Kneebar', 1], ['Breathe', 2], ['Brush', 2]) },
  { id: 'alpine', name: 'The Alpinist', unlock: 12, gear: 'liquid',
    text: 'Used to being cold, tired and a long way from the road.',
    sig: 'Endurance', sigText: 'Moves settle all the way to +3, but everything has 2 less Contact.',
    settleMax: 3, dContact: -2,
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
     there because the sim asked for it, dHand:2 being a cliff to 11.8%. */
  { id: 'onsight', name: 'The Onsighter', unlock: 16, gear: 'ball',
    text: 'Walks up, ties in, and climbs it. Strong, unfussy, no tick marks.',
    sig: 'Onsight', sigText: 'No beta ever — every hold stays a guess — but nothing the weather does touches you, your hand runs a card deeper, and you commit hard off the first move.',
    noBeta: true, ignoreWeather: true, dHand: 1, dContact: 1, dSkin: 1, firstTurnPower: 2,
    loadout: L(['Crimp Grip', 2], ['Open Hand', 2], ['Lock Off', 2], ['Mantle', 1],
      ['Smear', 2], ['Flag', 1], ['Shake Out', 2], ['Breathe', 1],
      ['Sight the Line', 1], ['Chalk Up', 1]) },
]
export const archOf = (s: GameState) => ARCHETYPES[Math.min(s.arch, ARCHETYPES.length - 1)]
export const archUnlocked = (a: Archetype, level: number) => level >= a.unlock

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
}
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
]
export const mutById = (id: string) => MUTATORS.find(m => m.id === id)
export function mutMods(ids: string[]) {
  const m = { foul: false, dContact: 0, noShakes: false, dAttempts: 0,
    noGear: false, gradeUp: 0, startCurse: 0, drySpell: false, xp: 0 }
  for (const id of ids) {
    const d = mutById(id); if (!d) continue
    m.foul ||= !!d.foul; m.dContact += d.dContact ?? 0; m.noShakes ||= !!d.noShakes
    m.dAttempts += d.dAttempts ?? 0; m.noGear ||= !!d.noGear
    m.gradeUp += d.gradeUp ?? 0; m.startCurse += d.startCurse ?? 0
    m.drySpell ||= !!d.drySpell; m.xp += d.xp
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
]
export const boonById = (id: string) => BOONS.find(b => b.id === id)
export function boonMods(ids: string[]) {
  const m = { shedEvery: 0, freeBonus: false, cruxDraw: false, cruxShed: 0, freeDraws: false, restChips: 0,
    wideSupport: false, keepFlow: false, settle: 0, saveBlow: false,
    noCampus: false, sendBeta: 0,
    dPowerAll: 0, noRests: false, dDraw: 0, dumpHand: false, dyno: false,
    dTurnCap: 0, dFallSkin: 0 }
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

/* ======================= THE FORECAST ==============================
   Conditions used to be rolled the moment you committed, which made a
   57-96% swing invisible. Derived instead as a pure function of the run
   seed, act, tier and node — so it can be shown on the map, and stays
   stable across re-renders without consuming the run RNG.            */
export function forecastFor(s: GameState): { weather: number; rock: number }[] {
  const nodes = ACTS[s.act]?.[s.tier] ?? []
  return nodes.map((_, i) => {
    const h = ((s.seed ^ (s.act * 7919) ^ (s.tier * 104729)
      ^ (i * 1299709) ^ (s.reroll * 2654435761)) >>> 0)
    const r = new RNG(h)
    return { weather: r.int(WEATHER.length), rock: r.int(ROCK.length) }
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
  return { ...s, shopCards: cards, shopGear: stock, bought: [], phase: 'shop' }
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
  id: string; who: string; act: number; after?: string; needsPage?: number
  text: string
  replies: { label: string; text: string; outcome?: EventOutcome }[]
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
    ] },
  { id: 'marge4', who: 'Marge', act: 1, after: 'marge3', needsPage: 4,
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
  { id: 'marge6', who: 'Marge', act: 0, after: 'marge5', needsPage: 7,
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
    ] },
  { id: 'dale2', who: 'Dale', act: 1, after: 'dale1',
    text: 'He used to say a grade is just a rumour that got organised. Drove the guidebook people mad.',
    replies: [
      { label: 'He was not wrong.', text: '"He was not wrong. He was insufferable about it."', outcome: { xp: 8 } },
      { label: 'Sounds like an excuse.', text: '"It was. He was also the only one who could back it up."', outcome: { journal: 0 } },
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
    ] },
  { id: 'nita2', who: 'Nita', act: 1, after: 'nita1',
    text: 'I climb harder than he did. On plastic. I know exactly what that sentence is worth, before you say it.',
    replies: [
      { label: 'It is worth something.', text: '"It is worth something on plastic." She is quiet a moment. "Show me the pages."', outcome: { cardRarity: 'uncommon' } },
      { label: 'Say it out loud again.', text: 'She does. It sounds smaller the second time and she knows it.', outcome: { journal: 0 } },
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

/* FA-1c. You name a line and grade it, and until now nobody said a word about
   it. Grading is a social act — undergrading and overgrading are both claims
   about yourself — and there is a whole cast standing at the fire. */
export function faTalk(s: GameState): Talk | null {
  // she refers to him, so you have to have met her first
  if (!s.seen.includes('marge1')) return null
  const line = s.established.find(e => !s.seen.includes('fa:' + e.name))
  if (!line) return null
  const d = line.claimed - line.real
  const id = 'fa:' + line.name
  if (d <= -2) return { id, who: 'Marge', act: s.act,
    text: `"${line.name}." She says it like she is trying it out. "Somebody came down off that `
      + `saying it was V${line.claimed}. It is not V${line.claimed}." A pause. "He used to do that too."`,
    replies: [
      { label: 'It felt like V' + line.claimed + '.', outcome: { psyche: -1 },
        text: '"It did not." She lets it sit. "You do not have to be hard about it. Nobody is keeping score but you."' },
      { label: 'I got it wrong.', outcome: { psyche: 1 },
        text: '"You got it wrong on the low side, which is the only honest way to get it wrong." She refills your cup.' },
    ] }
  if (d >= 2) return { id, who: 'Marge', act: s.act,
    text: `"${line.name}, V${line.claimed}." She does not look up. "Two people have been on it since. `
      + `They both came down laughing." She pokes the fire. "It will get downgraded. They always do."`,
    replies: [
      { label: 'It was hard for me.', outcome: { psyche: 1 },
        text: '"Then say that. That is a different sentence and nobody would argue with it."' },
      { label: 'Let them downgrade it.', outcome: {},
        text: '"They will." She sounds almost fond. "The name will stick, though. The name always sticks."' },
    ] }
  return { id, who: 'Marge', act: s.act,
    text: `"${line.name}." She turns the name over. "V${line.claimed}. That is what it is, near enough. `
      + `You would be surprised how rare that is." She hands you the cup without being asked.`,
    replies: [
      { label: 'It is only a number.', outcome: {},
        text: '"It is a number you gave a thing that did not have one. That is not nothing."' },
      { label: 'Thank you.', outcome: { psyche: 1 },
        text: 'She waves it off, but she writes the name down in the back of something, and does not show you.' },
    ] }
}

/** A trading post has people in it. Somebody who has been out there is
    exactly who tells you something you did not know. */
export function postTalk(s: GameState): Talk | null {
  // Marge is at the fire, not behind a counter — her thread stays at camps.
  // This has to look PAST her rather than stop at her: she holds seven of the
  // seventeen and sits at the front of the queue, so filtering the first
  // available conversation returned nothing almost every time.
  return TALKS.find(t =>
    t.who !== 'Marge' && t.act <= s.act && !s.seen.includes(t.id)
    && (!t.after || s.seen.includes(t.after))
    && (t.needsPage === undefined || s.journal.includes(t.needsPage))) ?? null
}

export function availableTalk(s: GameState): Talk | null {
  // what you put your name to comes first — she has been waiting to say it
  const fa = faTalk(s)
  if (fa) return fa
  return TALKS.find(t =>
    t.act <= s.act && !s.seen.includes(t.id)
    && (!t.after || s.seen.includes(t.after))
    && (t.needsPage === undefined || s.journal.includes(t.needsPage))) ?? null
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
  const p = JOURNAL.find(j => j.id !== 7 && !found.has(j.id))
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
  if (o.psyche) n.psyche = Math.max(0, Math.min(PSYCHE_MAX, n.psyche + o.psyche))
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

export const REWARDS = {
  common: ['Gaston', 'Sloper Slap', 'Undercling', 'Mantle', 'Pinch Grip', 'Deadpoint',
    'Heel Hook', 'Drop Knee', 'Flag', 'High Step', 'Breathe', 'Brush'],
  uncommon: ['Cross-Through', 'Lock & Bump', 'Dyno', 'Toe Hook', 'Visualize', 'Try-Hard Scream'],
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
export function circuitRoute(n: number, rng: RNG): RouteSpec {
  const grade = Math.min(10, Math.floor(n * 0.7))
  const styles: StyleKey[] = ['mixed', 'slab', 'crimp ladder', 'compression', 'power', 'jug haul']
  const feet: FeetKey[] = ['easy', 'normal', 'hard']
  const roped = n > 0 && n % 4 === 3
  return {
    name: `${SK_A[rng.int(SK_A.length)]} ${SK_B[rng.int(SK_B.length)]}`,
    grade, style: styles[rng.int(styles.length)],
    clear: 5 + Math.floor(grade * 0.7) + rng.int(2),
    crux: Math.floor(grade / 3),
    feet: feet[rng.int(feet.length)],
    roped, pitches: roped ? 2 : undefined,
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
/** Today's problem. Harder than a skirmish and the same for everyone. */
export function dailyRoute(key = dayKey()): RouteSpec {
  const rng = new RNG(dailySeed(key))
  const styles: StyleKey[] = ['mixed', 'slab', 'crimp ladder', 'compression', 'power', 'jug haul']
  const feet: FeetKey[] = ['normal', 'hard']
  const grade = 3 + rng.int(5)
  return {
    name: `${SK_A[rng.int(SK_A.length)]} ${SK_B[rng.int(SK_B.length)]}`,
    grade, style: styles[rng.int(styles.length)],
    clear: 9 + rng.int(5), crux: 1 + rng.int(3), feet: feet[rng.int(feet.length)],
    note: 'Today only. Everybody is on this one.',
  }
}
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
  const unread = spec.finale ? Math.max(0, JOURNAL.length - 1 - s.journal.filter(p => p <= 6).length) : 0
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
  for (const i of rng.shuffle(holds.map((_, k) => k)).slice(0, spec.crux)) {
    holds[i] = { uid: nextUid(), name: 'crux', crux: true, clean: false,
      bite: 4 + biteBump + BITE_BUMP + w.dBite + asc.dBite,
      grip: 8 + bump + asc.dGrip + blind + (spec.fa ? DIRT_GRIP : 0),
      ...(spec.fa ? { dirt: DIRT_GRIP } : {}) }
  }
  placeSig()
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
export const holdLabel = (h: Hold) => (h.sig ? sigById(h.sig)?.name : null) ?? h.name

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

/** Everything that belongs to you rather than to a run. A new expedition must
    carry all of it; hand-copying a subset is how it got lost. */
export function carryOver(s: GameState): Partial<GameState> {
  return {
    level: s.level, xp: s.xp, owned: s.owned, sends: s.sends, wins: s.wins,
    runs: s.runs, falls: s.falls, seen: s.seen, book: s.book, ticked: s.ticked,
    established: s.established, history: s.history, bestCircuit: s.bestCircuit,
    loadouts: s.loadouts, styleMax: s.styleMax, tutorialDone: s.tutorialDone,
    slot: s.slot, ending: s.ending, tweak: s.tweak,
    // settings are the player's, not the run's
    sound: s.sound, motion: s.motion, cbSafe: s.cbSafe, textScale: s.textScale,
    coaching: s.coaching, hints: s.hints, topRope: s.topRope, grades: s.grades,
    dailyDay: s.dailyDay, dailyScore: s.dailyScore,
    dailyBest: s.dailyBest, dailyStreak: s.dailyStreak,
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
    gear: mutMods(s.mutators).noGear ? [] : [a.gear], psyche: PSYCHE_MAX,
    skin: Math.max(2, RUN_SKIN + styleMods(style).skin + (a.dSkin ?? 0)
      + (s.topRope ? TOPROPE_SKIN : 0)) }
}

export function freshRun(routeIdx: number, deckTier: number, seed: number): GameState {
  const rng = new RNG(seed ^ 0x9e37)
  return {
    seed, routeIdx, deckTier, burn: 1, skin: SKIN_MAX,
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
    circuit: false, circuitScore: 0, bestCircuit: 0, slot: 0, runSeed: 0, ending: '', topRope: true, history: [], runs: 0, falls: 0,
    shopCards: [], shopGear: [], bought: [],
    coaching: true, sound: true, cbSafe: false, motion: true, textScale: 0,
    tutorialDone: false,
    fxLane: ['', '', ''], fxTick: 0, gear: [], boons: [], gearOffers: [], savedBlow: false, peakPump: 0, clipped: false, bonusUsed: false, line: 0, rerolls: 0, mutators: [], seq: null, readAhead: 0, order: [], routeMove: null, arch: 0,
    loadouts: ARCHETYPES.map(a => a.loadout.slice()), reroll: 0, book: {}, ticked: [], hints: true, grades: 'v',
    dailyDay: '', dailyScore: 0, dailyBest: 0, dailyStreak: 0, daily: false, trail: [],
    shoppedAt: [], tweak: null, eventChose: [], vanRaided: [], established: [],
  }
}

/** Session over: pay skin, hand out a reward, or end the run. */
/** Bank today's attempt. Called once, when the burn that used it ends. */
export function bankDaily(s: GameState): GameState {
  if (!s.daily) return s
  const key = dayKey()
  const score = dailyScore(s)
  // a streak is consecutive days, so yesterday must have been the last one
  const y = new Date(); y.setUTCDate(y.getUTCDate() - 1)
  const kept = s.dailyDay === dayKey(y) ? s.dailyStreak : 0
  return { ...s, daily: false, dailyDay: key, dailyScore: score,
    dailyBest: Math.max(s.dailyBest, score), dailyStreak: kept + 1 }
}

export function endSession(s0: GameState, rng: RNG): GameState {
  let s = bankDaily(s0)
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
      psyche: Math.min(PSYCHE_MAX, s.psyche + PSYCHE_SEND),
      bestCircuit: Math.max(s.bestCircuit, n) }, xpForSend(specOf(s).grade), rng)
    // a card every third line, so the deck grows with the grade
    if (n % 3 === 0) return { ...s, beta, offers: rollOffers(rng, 3, false, Math.min(2, Math.floor(n / 6))),
      phase: 'reward' }
    return { ...s, beta, skirmish: circuitRoute(n, rng), phase: 'circuitNext' }
  }
  if (s.result === 'send') {
    const paid = cashForSend(specOf(s).grade) * (s.onProject ? 2 : 1)
    const book = logSend(s)
    s = gainXp({ ...s, sends: s.sends + 1, book, cash: s.cash + paid,
      psyche: Math.min(PSYCHE_MAX, s.psyche + PSYCHE_SEND) },
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
  if (s.result === 'send' && s.skirmish?.fa) {
    // you do not get a reward screen for this. You get to name it.
    const paid = cashForSend(s.skirmish.grade)
    return gainXp({ ...s, beta, sends: s.sends + 1, cash: s.cash + paid,
      psyche: Math.min(PSYCHE_MAX, s.psyche + PSYCHE_SEND), phase: 'claim' },
      xpForSend(s.skirmish.grade) + 20, rng)
  }
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
      s = gainXp({ ...s, wins: s.wins + 1, psyche: PSYCHE_MAX,
        journal: Array.from(new Set([...s.journal, 7])),
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
      + (s.inRun ? (archOf(s).dContact ?? 0) + mutMods(s.mutators).dContact : 0))
      * (boonMods(s.boons).dyno ? 0.5 : 1))),
    power: Math.max(0, c.power + (c.lane === 'feet' ? gm.dPowerFeet : gm.dPowerHand)
      + (c.synergy ? Math.floor((tags[c.synergy] ?? 0) / SYNERGY_PER) : 0)),
  }))
  return refillAndDraw({
    ...s, holdDeck: holds, feetDeck: feet,
    boardH: [null, null, null], boardP: [null, null, null],
    piles: { draw: deck, discard: [], exhaust: [], hand: [] },
    pump: 0, flow: 0, cleared: 0, worked: [], turn: 1, phaseSeen: '',
    // the belay is your first piece: on a rope you are never on nothing
    runout: 0, lastPiece: spec.roped ? 0 : -1, pitch: 0, savedBlow: false, peakPump: 0,
    clipped: false, seq: null, readAhead: 0,
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
  const flow = s.flow >= FLOW_AT ? 0.05 : 0
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
export type RouteMove = { kind: 'grease' | 'dry' | 'gust' | 'crumble'; lane: number; text: string }
export const MOVE_EVERY = 3        // roughly one telegraph every this many turns
export const MOVE_GRIP = 2
export const MOVE_BITE = 1

/** What the route is about to do. Rolled from the run RNG at the end of a turn. */
export function rollRouteMove(s: GameState, rng: RNG): RouteMove | null {
  const lanes = [0, 1, 2].filter(i => s.boardH[i])
  if (!lanes.length) return null
  const lane = lanes[rng.int(lanes.length)]
  const where = LANE_NAMES[lane].toLowerCase()
  const r = rng.next()
  if (r < 0.34) return { kind: 'grease', lane,
    text: `The ${where} hold is greasing up.` }
  if (r < 0.58) return { kind: 'dry', lane,
    text: `A breeze on the ${where} hold. It is coming into condition.` }
  if (r < 0.80) return { kind: 'gust', lane,
    text: 'Wind coming up the face. All of it is about to bite.' }
  return { kind: 'crumble', lane, text: `Something is flaking off the ${where} hold.` }
}

/** Apply what was telegraphed last turn. Returns the holds and any log lines. */
export function applyRouteMove(m: RouteMove, boardH: (Hold | null)[]): {
  boardH: (Hold | null)[]; log: string[]
} {
  const out = boardH.slice(), log: string[] = []
  const h = out[m.lane]
  if (m.kind === 'gust') {
    for (let i = 0; i < 3; i++) if (out[i]) out[i] = { ...out[i]!, bite: out[i]!.bite + MOVE_BITE }
    log.push('The wind arrives. Everything bites harder.')
    return { boardH: out, log }
  }
  if (!h) return { boardH: out, log }
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
  return { boardH: out, log }
}
/** Only beta makes a hold readable. Anything else would let you tell the
    wobbled holds from the flat ones by whether they showed a span at all. */
export const holdKnown = (s: GameState, h: Hold) => s.beta.includes(h.name)
/** What the player may read off a hold: a number once worked, a span before.
    The span is always WOBBLE wide, so it gives away nothing about which side
    of it this particular hold sits on. */
export function gripShown(s: GameState, h: Hold): { lo: number; hi: number; sure: boolean } {
  const g = gripFor(s, h)
  if (holdKnown(s, h)) return { lo: g, hi: g, sure: true }
  const base = Math.max(1, g - (h.wobble ?? 0))
  return { lo: base, hi: base + WOBBLE, sure: false }
}

/** Power a card brings to a lane, after abilities and conditions. */
export function powerAgainst(s: GameState, card: Card, hold: Hold, lane: number,
  live?: (Card | null)[]): number {
  const wb = boonMods(s.boons)
  const board = live ?? s.boardP
  const feetCard = s.boardP[2]
  const feetHold = s.boardH[2]
  const featureless = feetHold ? abilityOf(feetHold) === 'Featureless' : false
  const bm = boonMods(s.boons)
  // wet rock: your feet are worth less, which every deck feels
  const sup = feetCard
    ? Math.max(0, feetCard.support + gearMods(s.boardP ? s.gear : []).dSupport
        + (WEATHER[s.weather]?.dSupport ?? 0)
        + (windowOf(s)?.dSupport ?? 0))       // ROUTE-6: the feet stop trusting it
    : 0
  // Big Hands: Support normally favours one hand; this reaches both
  // Big Hands doubles what the feet give; it does not gate the default
  const eff = bm.wideSupport ? sup * 2 : sup
  const support = lane < 2 && feetCard && !featureless
    ? eff + (abilityOf(hold) === 'Two-finger' ? -eff : 0) : 0
  let p = card.power + (card.settled ?? 0) + support
  // ENG-16: was a binary +2 above pump 7 on two cards. It scales now, so
  // being pumped is a thing some of your deck actually wants.
  // above a piece you have just placed, you commit
  if (s.clipped && specOf(s).roped) p += CLIPPED_POWER
  if (card.fx === 'greedy') p += desperationOf(s)
  if (card.fx === 'momentum') p += s.flow
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
  if (lane < 2 && !s.boardP[2] && !boonMods(s.boons).noCampus) b += CAMPUS_BITE
  if (abilityOf(hold) === 'Squeeze' && s.boardH[0] && s.boardH[1]
    && !(card && card.fx === 'balance')) b += 1
  if (card && card.fx === 'static') b -= 1
  // a Guard in the other hand lane covers this one
  if (lane < 2 && s.boardP[1 - lane]?.fx === 'guard') b -= 1
  const ph = phaseOf(s)
  if (ph) b += ph.dBite ?? 0
  const win = windowOf(s)                  // ROUTE-6: the window closes
  if (win) b += win.dBite ?? 0
  if (s.inRun && s.topRope) b -= 1        // the rope is doing some of the work
  return Math.max(0, b)
}

export function resolve(s: GameState, rng: RNG): GameState {
  const boardH = s.boardH.slice(), boardP = s.boardP.slice()
  const holdDeckLocal = s.holdDeck.slice()
  let piles = s.piles, pump = s.pump, cleared = s.cleared
  const worked = s.worked.slice(), log: string[] = []
  // ENG-11: what the route said it would do last turn, it does now — before
  // anything of yours resolves, so the telegraph was worth reading
  if (s.routeMove) {
    const done = applyRouteMove(s.routeMove, boardH)
    for (let i = 0; i < 3; i++) boardH[i] = done.boardH[i]
    log.push(...done.log)
  }
  // ENG-19: powerAgainst and biteAgainst read the feet hold (Support, campus)
  // out of the state they are handed. The move above has already changed the
  // board — a crumbled feet hold is no longer Featureless, so it grants Support
  // now — so they must read the post-move board, not s. previewLane does the
  // same thing; without this the preview and resolve disagree on exactly the
  // turn a feet hold flakes off.
  const sMove: GameState = s.routeMove ? { ...s, boardH: boardH.slice() } : s
  const fxLane = ['', '', '']
  let restedThis = false, clearedThis = 0

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
  for (const c of boardP) if (c && c.shed) {
    if (noRest) { restedThis = true; log.push(`${c.name} · nowhere to shake out up here.`); continue }
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
      // Crux Junkie
      if (bm.cruxDraw && hold.crux) {
        piles = pileDraw(piles, 1, rng)
        pump = Math.max(0, pump - bm.cruxShed)
        log.push(`Crux worked. Draw${bm.cruxShed ? `, shed ${bm.cruxShed}` : ''}.`)
      }
      boardH[i] = null
      if (card.fx === 'echo') {
        piles = { ...piles, hand: [...piles.hand, { ...card, settled: 0 }] }
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
    } else boardP[i] = { ...card, contact: c,
      settled: Math.min((card.settled ?? 0) + (card.fx === 'settle2' ? 2 : 1) + bm.settle,
        s.inRun ? (archOf(s).settleMax ?? SETTLE_MAX) : SETTLE_MAX) }
  }

  // Second Wind
  if (bm.shedEvery && clearedThis > 0 && cleared > 0 && cleared % bm.shedEvery === 0) {
    pump = Math.max(0, pump - 2)
    log.push(`Second wind. ${cleared} holds in — shed 2.`)
  }
  let out: GameState = { ...s, boardH, boardP, piles, pump, cleared, worked, runout, lastPiece,
    savedBlow, holdDeck: holdDeckLocal, fxLane, fxTick: s.fxTick + 1, log: [...s.log, ...log] }
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

  const flow = clearedThis > 0 && (!restedThis || bm.keepFlow) ? Math.min(3, s.flow + 1) : 0
  const tax = Math.max(0, HANG_TAX - (flow >= FLOW_AT ? FLOW_TAX : 0))
  const unanswered = [0, 1, 2].filter(i => boardH[i] && !boardP[i]).length
  const hooked = boardP[2]?.fx === 'hooked'
  const cruxTax = hooked ? 0 : boardH.filter(h => h && abilityOf(h) === 'Committing').length
  const doubt = s.inRun && s.psyche <= DOUBT_AT ? 1 : 0
  const add = HANG_FLAT + tax * unanswered + cruxTax + (phaseOf(s)?.dTax ?? 0) + doubt
    + (LINES[s.line]?.dTax ?? 0)
  pump = Math.max(0, pump + add - gearMods(s.gear).shedPerTurn)
  out = { ...out, pump, flow, turn: s.turn + 1, log: [...out.log, `Hanging. +${add} pump.`] }
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
    const skin = Math.max(0, out.skin - Math.max(1, Math.ceil(lost / RUNOUT_SKIN)))
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
  return refillAndDraw({ ...out, piles: pileDiscard(out.piles, out.piles.hand), selected: null }, rng)
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
  piles = { ...piles, discard: [...piles.discard, c] }
  return { ...s, piles, pump, skin: Math.max(0, s.skin - c.skinCost),
    peakPump: Math.min(PUMP_MAX, Math.max(s.peakPump, pump)),
    boardP, boardH, runout, lastPiece, seq, readAhead, clipped, bonusUsed: true,
    selected: null, log: [...s.log, ...log] }
}

/** Headless policy — used by the sim so it exercises the shipping engine. */
export function autoPlay(s: GameState, rng: RNG): GameState {
  let st = { ...s, boardP: s.boardP.slice(), piles: { ...s.piles, hand: s.piles.hand.slice() } }
  const feet = st.piles.hand.filter(c => c.kind === 'move' && c.lane === 'feet')
  if (!st.boardP[2] && feet.length) {
    const pick = feet.reduce((a, b) => (b.support > a.support ? b : a))
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
      const clears = real.filter(c => powerAgainst(st, c, hold, i) >= target)
      pick = (clears.length ? clears : real).reduce((a, b) =>
        (powerAgainst(st, b, hold, i) > powerAgainst(st, a, hold, i) ? b : a))
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
    const cost = isFree ? 0 : c.cost
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
  const s = s0.routeMove
    ? { ...s0, boardH: applyRouteMove(s0.routeMove, s0.boardH).boardH }
    : s0
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
  const target = gripFor(s, hold)
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
  const s = s0.routeMove
    ? { ...s0, boardH: applyRouteMove(s0.routeMove, s0.boardH).boardH }
    : s0
  const L = lanes ?? [0, 1, 2].map(i => previewLane(s, i))
  let pump = s.pump
  const noRest = phaseOf(s)?.noRest === true || mutMods(s.mutators).noShakes
    || boonMods(s.boons).noRests
  // resolve clamps at zero on EACH shed, then adds the clock — clamping only
  // at the end silently under-reports by however far it went negative
  for (const c of s.boardP) if (c && c.shed && !noRest) pump = Math.max(0, pump - c.shed)
  let cleared = 0
  for (let i = 0; i < 3; i++) {
    const p = L[i]
    pump += p.biteToPump
    if (p.clears) {
      cleared++
      // working a jug sheds a pump — Rest fires on the clear, not on contact
      const h = s.boardH[i]!
      const ab = h.clean ? '' : (HOLD_STATS[h.name]?.ability ?? FEET_STATS[h.name]?.ability ?? '')
      if (ab === 'Rest') pump = Math.max(0, pump - 1)
    }
    // Sharp fires on a blow regardless of Anchor; Peel takes precedence over it
    const c = s.boardP[i]
    if (p.blows && s.boardH[i] && c && c.fx !== 'peel' && c.fx !== 'tough') {
      const ab = HOLD_STATS[s.boardH[i]!.name]?.ability
        ?? FEET_STATS[s.boardH[i]!.name]?.ability ?? ''
      if (ab === 'Sharp' && !s.boardH[i]!.clean) pump += 1
    }
  }
  const restedThis = s.boardP.some(c => c && c.shed > 0)
  const flow = cleared > 0 && !restedThis ? Math.min(3, s.flow + 1) : 0
  const tax = Math.max(0, HANG_TAX - (flow >= FLOW_AT ? FLOW_TAX : 0))
  // the clock is charged AFTER resolution, so a card that blows leaves its
  // lane unanswered too — this was the whole gap between preview and reality
  const unanswered = [0, 1, 2].filter(i => {
    const pv = L[i]
    return pv.hold && !pv.clears && (!pv.card || pv.blows)
  }).length
  const hooked = s.boardP[2]?.fx === 'hooked'
  const cruxTax = hooked ? 0 : [0, 1, 2].filter(i => {
    const h = s.boardH[i]
    return h && !L[i].clears && !h.clean && h.crux
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

  // keywords that measured well in the per-card probe
  if (c.anchor) v += 3
  if (c.latch) v += 3
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

  if (c.rarity === 'curse') sharp.push('a curse — it does nothing good')
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
  return { ...s, circuit: false, skirmish: null, runDeck: [], log: [],
    bestCircuit: Math.max(s.bestCircuit, s.circuitScore), phase: 'menu' }
}

/** Leave the post. You are back where you were, not a stage further on. */
export function leaveShopStep(s: GameState): GameState {
  return { ...s, shopCards: [], shopGear: [], phase: 'map',
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
      psyche: Math.min(PSYCHE_MAX, s.psyche + PSYCHE_CAMP) })
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
  const cause = won ? 'topped out'
    : s.circuit ? `${s.circuitScore} lines`
    : s.psyche <= 0 ? 'lost the psyche'
    : s.skin <= 0 ? 'skin ran out'
    : `beaten by ${specOf(s).name}`
  const rec: RunRecord = {
    seed: s.runSeed, arch: s.arch, style: s.style, rope: s.topRope, circuit: s.circuit,
    act: s.act, tier: s.tier, won, cause, sends: s.sends, deck: s.runDeck.length,
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
export const FINDABLE = JOURNAL.filter(j => j.id !== 7).length
export const KNOWN_AT = Math.ceil(FINDABLE * 0.7)
export const PARTIAL_AT = Math.ceil(FINDABLE * 0.3)

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
    const ab = HOLD_STATS[h.name]?.ability ?? ''
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
  if (s.flow >= FLOW_AT)
    return 'Flow is up, so the hang tax is cheaper. Resting now would break it.'
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
  { name: 'Cycle', text: 'Draw a card when you place it.' },
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
