/* Sandbagged — the leaf types.

   ENG-9, first section. `engine.ts` was 6,527 lines and this split was attempted once
   before (v6.6) and reverted: it fell over on mechanical import surgery, not on design.
   Two things make the retry different.

   FIRST, `engine.ts` RE-EXPORTS everything it moves out. Nothing that imports from
   './engine' has to change — not App.tsx, not sim/entry.ts — so a section can move without
   touching a single call site. That is what "mechanical import surgery" turned into last
   time, and it is now zero lines of it.

   SECOND, the guards. Thirty-two of them read `src/engine.ts` by path and slice windows out
   of it with `region()`, and 112 mutation patches are keyed to that path. Every one fails
   LOUDLY the moment its anchor leaves the file — `region()` throws rather than returning a
   bad window (GUARD-8), and GUARD-9 refuses an injection whose anchor matches nothing. So
   the suite names each thing to fix, one at a time. v6.6 had no such net.

   What lives here: types with no value dependencies at all. NOT `GameState`, which reaches
   into the content types, and not the dials that were sitting inside the old TYPES banner —
   those are values and belong next to the rules they tune. Four of these were file-private
   before and are exported now; that widening is the price of the move, and it is worth
   naming rather than glossing over. */

export type LaneTag = 'hand' | 'feet' | 'any'
export type StyleKey = 'jug haul' | 'mixed' | 'slab' | 'crimp ladder' | 'compression' | 'power'
export type FeetKey = 'easy' | 'normal' | 'hard'
export type Fx = '' | 'precise' | 'friction' | 'static' | 'snap' | 'commit' | 'balance' | 'hooked'
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
export type Piles = { draw: Card[]; discard: Card[]; exhaust: Card[]; hand: Card[] }
export type Phase = 'menu' | 'map' | 'climb' | 'burnEnd' | 'sessionEnd'
  | 'reward' | 'camp' | 'runEnd' | 'pack' | 'collection' | 'event' | 'journal' | 'deck' | 'talk'
  | 'glossary' | 'gear' | 'logbook' | 'shop' | 'circuitNext' | 'saves' | 'stats'
  | 'prepare' | 'more' | 'epilogue' | 'history' | 'line' | 'claim' | 'deeds' | 'met'
export type NodeType = 'climb' | 'camp' | 'boss' | 'event' | 'project' | 'shop' | 'fa'
  | 'established'
