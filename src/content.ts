/* Sandbagged — the content that is only content.
//
   ENG-9, second section. What is here is TYPE PLUS LITERAL and nothing else: the ascent
   styles, the weather and the rock, his journal, the sequences, the mutators, the boons.
   Every FUNCTION that reads any of it stayed in engine.ts — `styleMods`, `seqById`,
   `mutMods`, `boonById`, `boonMods`, `attemptsFor`, `campSkinFor`. That line is the whole
   discipline of this split and it is where v6.6 died: `CONTENT: DIALOGUE` looks like 602
   lines of content and is really data wrapped in rules that need `GameState`, so moving a
   "section" moves the rules with it and the imports go circular.

   Data out, rules stay. Measured before starting rather than guessed: across all 2,350
   lines of `CONTENT:` sections there are 42 injection anchors and only SEVEN guard windows
   keyed to engine.ts by path, which is ~2 references per 100 lines — and an injection's
   path is a one-token edit that GUARD-9 names for you. The expensive part was never the
   references. It is telling data from rules.

   Re-exported by engine.ts, so nothing that imports from './engine' changes. */

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


export type SeqNeed = 'clear' | 'norest' | 'rest' | 'feet'
export type Sequence = {
  id: string; name: string; text: string; need: SeqNeed; turns: number
  onDone: { clear?: number; draw?: number; dumpPump?: boolean; contact?: number; settle?: number }
}
/* SEQ-2. `turns` counts the turn you START on — the bonus is played and the condition is
   checked in the same resolution — so three turns is this one plus two, which is what the
   banner's countdown already showed.

   THE COPY SAYS THE SLIP, on every one of them. A plan that dies to one bad draw is a plan
   a measured valuation correctly refuses (see SEQ_GRACE), so the slip is not a footnote —
   it is the reason the card is worth a slot, and it has to be on the card you are deciding
   whether to take. */
export const SEQUENCES: Sequence[] = [
  { id: 'linked', name: 'Linked Moves', need: 'clear', turns: 3,
    text: 'Work a hold every turn for three turns. One slip is allowed.',
    onDone: { clear: 2 } },
  { id: 'static', name: 'Static Sequence', need: 'norest', turns: 2,
    text: 'Two turns without resting. One slip is allowed.', onDone: { draw: 3 } },
  { id: 'breathe', name: 'Breathing', need: 'rest', turns: 2,
    text: 'Rest two turns running. One slip is allowed.', onDone: { dumpPump: true } },
  { id: 'committed', name: 'Committed', need: 'feet', turns: 3,
    text: 'Keep something on your feet for three turns. One slip is allowed.',
    onDone: { contact: 2, settle: 1 } },
]

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


/* ENG-9, third section: the two biggest bodies of literal content in the game — thirty-seven
   routes and thirty-six events. Both are type-plus-literal, so both move; their TYPES
   (`RouteSpec`, `GameEvent`, `EventOutcome`) stay in engine.ts and are imported here,
   because engine functions annotate with them constantly and a type is not content.

   `CARDS` is the one that did NOT come, and the reason is worth writing down. It looks like
   the biggest content block in the file (346 lines) and it is not content at all:

       export const CARDS: Record<string, CardDef> = {}
       for (const c of [ mv('Crimp Grip', 2, 5, 'starter', {...}), ... ]) ...

   That is data BUILT BY RULES — `mv` and its siblings are factories with defaults and
   invariants in them. Moving CARDS means moving the factories, and then the "content" file
   holds rules and the split has bought a longer import list and nothing else. Data out,
   rules stay: CARDS is on the rules side of that line no matter how much of it reads like a
   list. Same verdict, same reason, for `CONTENT: DIALOGUE`, whose 602 lines are `TALKS`
   wrapped in `talkOpen`, `availableTalk`, `postTalk`, `metCount` and `loreFor` — all of
   which need `GameState`. */
import type { RouteSpec, GameEvent, Signature, Partner, Gear, Consumable, Tweak, Line,
  HoldDef, CurseCause } from './engine'
import type { StyleKey } from './types'

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
  /* COND-2: the dagger of sun crosses the wall and moves off it. `dSupport` only — BAL-13
     proved added Bite on the critical path is dangerous, and ENG-20's rule is that a condition
     may move Bite and Support and never Power. */
  { name: 'Sun Dagger', grade: 6, style: 'power', clear: 10,
    window: { at: 0.3, until: 0.7, dSupport: -1,
      warn: 'The line of sun is coming across the face towards you.',
      text: 'You are in the dagger. Hot rock, wet hands, nothing staying on.',
      clear: 'The sun moves off the wall. Cold stone, and your feet bite again.' }, crux: 1, feet: 'easy',
    signature: 'twofinger',
    note: 'Shade for forty minutes a day. Miss it and you cook.' },
  { name: 'The Chimney', grade: 6, style: 'compression', clear: 11, crux: 1, feet: 'normal',
    signature: 'organpipe',
    /* COND-3: the first place in the game where the ROCK goes off rather than your feet.
       The back of a chimney is where the water runs, and you are in the back of it — so it
       costs CONTACT, which nothing could do to you mid-burn before this ticket. It passes:
       you fight up out of the wet section and the walls dry out. One point, on one stretch
       of one act-2 line, because a point of Contact is worth ~6 points of completion when
       it is always on (measured: zeroing the weather's contact term takes the campaign from
       43.5% to 49.8%). */
    window: { at: 0.35, until: 0.7, dContact: -1,
      warn: 'There is water coming down the back of it above you.',
      text: 'The back of the chimney is running wet. Nothing you press on stays pressed.',
      clear: 'Out of the wet. The walls go dry and rough again and you can push.' },
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
  // COND-2: a squall crosses and goes. Slab is a Support problem, so that is what it takes.
  { name: 'Whiteout Slab', signature: 'thewhiteout', grade: 8, style: 'slab', clear: 12, crux: 3, feet: 'hard',
    window: { at: 0.4, until: 0.75, dSupport: -1,
      warn: 'The cloud below you is coming up the face.',
      text: 'Whiteout. You cannot see your feet, and you are trusting them anyway.',
      clear: 'It blows through. The slab comes back and you can see what you are standing on.' },
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
    /* ROUTE-6: the nine-day window the journal keeps circling. It holds while you climb the
       lower wall and shuts on the headwall — cloud over, the wind gets under everything, feet
       off. Never Power (ENG-20's absolute rule).

       COND-3: and the rock itself goes. Journal page 3 has said it from the start — "the rest
       of the time it seeps and the crux is a waterfall" — and until Contact could move during
       a burn, the one condition this whole route is ABOUT was the one thing its window could
       not do. It does not pass: this is the headwall, and BAL-13 is why it is the only place
       on the act-3 critical path that gets a Contact term at all (any added difficulty up
       there charges the Comp Kid and the Alpinist twice; the finale is the exception it
       carved out, because few runs reach it).

       THE `dBite: 1` IT USED TO CARRY IS GONE, AND THAT IS THE PRICE OF THIS. Measured on the
       full journal: adding the Contact term on top of the Bite cost 1.1 points (43.5% → 42.4%,
       against a 44.3% pin and a 0.9pt SE — a real move, not noise). Trading the Bite away for
       it lands at 45.0%. So a point of Bite up here is worth ~2.6 points of completion and a
       point of Contact ~1.1, and the swap is the version of this that holds the band. It also
       reads better: `dSupport` is already the wind getting under you, so the Bite was a second
       term doing the first one's job, and what the journal keeps saying is that the crux runs
       with water. */
    window: { at: 0.65, dSupport: -1, dContact: -1,
      warn: 'The light is going flat. Weather is coming in.',
      text: 'The window shuts. Wind on the wall, nothing under your feet, and the crux is running.' },
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
  // COND-2: it is called the Blowhole. The gust comes up the slot and then it stops.
  { name: 'The Blowhole', grade: 6, style: 'compression', clear: 11,
    window: { at: 0.45, until: 0.8, dSupport: -1,
      warn: 'The slot below you starts to moan.',
      text: 'The gust comes up through the hole and takes your feet off the wall.',
      clear: 'The wind drops as suddenly as it came. Quiet, and you can stand up again.' }, crux: 2, feet: 'normal',
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
  /* ROUTE-16. This was THE CORNICE AGAIN. Same grade, same style, same clear, same crux,
     same feet, same roped, same pitches — and a signature with the same stats too
     (`thecornice` and `thehang` are both base sloper, dGrip 3, read 1). Two of the four
     roped lines in the game were one line under two names, which is how the rope content
     came to look twice as big as it is. Found while baselining ROPE-2: the two reported
     identical send rates, ground-fall rates and caught-falls-per-session across 600 runs
     each on different seeds, which is not a coincidence anything but duplication produces.

     The mechanic that tells them apart was already written in this route's own note. "A
     band of ice that lets go in the afternoon" is a closing weather window — ROUTE-6's
     mechanic, which the finale uses and no other scripted line does. So the prose is not
     changed to fit the fix; the fix is what the prose already said. It lands EARLIER than
     the finale's (0.5 against 0.65) because this is two pitches and the note says
     afternoon, and it takes the feet rather than sharpening everything: ice releasing over
     slab is a Support problem. Never Power — the absolute rule from ENG-20. */
  { name: 'The Hanging Slab', signature: 'thehang', grade: 8, style: 'slab', clear: 14, crux: 3, feet: 'hard',
    roped: true, pitches: 2,
    /* COND-2: the ice band PASSES. It is an afternoon thaw, not a permanent state — its own
       note says "a band of ice that lets go in the afternoon" — so climbing through it and out
       the other side is what the route was always describing. This is also the offset for the
       three windows COND-2 adds elsewhere: making the harshest window in the game temporary
       pays for putting mild ones on three more routes. */
    window: { at: 0.5, until: 0.85, dSupport: -2,
      warn: 'Something lets go above you and skitters off down the slab.',
      text: 'The ice band is going. Meltwater everywhere and nothing under your feet.',
      clear: 'Above the ice band. Dry rock, and your feet mean something again.' },
    note: 'Two pitches of slab under a band of ice that lets go in the afternoon.' },
]

export const EVENTS: GameEvent[] = [
  { id: 'storm', title: 'Weather Coming In',
    text: 'Anvil cloud over the ridge. Maybe an hour, maybe twenty minutes.',
    lore: { page: 14, text: 'Six hours under it watching water come down the line he wanted, then out in the dark. He calls that the seventh attempt. He does not say what number this one would be.' },
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
    lore: { page: 15, text: 'No name in it. He had a whole page about that — a name is a way of telling people you were there, and he had decided against it. Somebody else may just have been careless.' },
    choices: [
      { label: 'Read what is written inside', outcome: { text: 'Somebody wrote their beta on the lining in biro.', boon: true } },
      { label: 'Take it', outcome: { text: 'Good brush inside. Somebody else brushed these holds first.', card: 'Brush' } },
      { label: 'Hang it where they will find it', outcome: { text: 'It is gone next week. Somebody found it.', xp: 8 } },
    ] },
  { id: 'sandbag', title: 'A Friendly Grade',
    text: 'Guy at the parking lot says the line at the far end is a soft V2. Great warm-up, he says.',
    lore: { page: 2, text: 'He had climbed harder and never climbed anything that made less sense. A grade is a rumour that got organised. This one is barely organised.' },
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
    lore: { page: 4, text: 'He told Marge he was working the Cathedral. This is not the Cathedral. Somebody sat here on their own for a long time and let her go on thinking it.' },
    choices: [
      { label: 'Go through it', outcome: { text: 'Notebook pages, a wire brush, and a name you half recognise.', journal: 0, card: 'Guidebook' } },
      { label: 'Make camp and leave it alone', outcome: { text: 'You sleep well in somebody else\'s good spot.', skin: 1, xp: 4 } },
    ] },
  { id: 'seep', title: 'Seepage',
    text: 'The whole lower band is weeping. Half the crag is off.',
    lore: { page: 3, text: 'Nine days a year, he reckoned. The rest of the time it seeps and the crux is a waterfall. You are standing in the rest of the time.' },
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
    lore: { page: 9, text: 'You have read about this rock. Everything up here is rubbish, and then somewhere one fin of something hard and grey that nobody has touched. This is the rubbish. That is almost encouraging.' },
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
    lore: { page: 1, text: 'No chalk, no tick marks, no trail. He sat under his for a whole evening and did not touch it. You could do that. You are not going to.' },
    choices: [
      { label: 'Spend the afternoon brushing', outcome: { text: 'Four hours on a wire brush. It is a real line now.', card: 'Wire Brush', xp: 10 } },
      { label: 'Leave it for the locals', outcome: { text: 'Somebody else can have that one.', psyche: 1 } },
    ] },
  { id: 'logging', act: 0, title: 'The Logging Road',
    text: 'Fresh gate across the spur road. The walk in just became four miles.',
    lore: { page: 10, text: 'Four hours if the creek is low, six if it is not, eleven times, and it never once got shorter. He stopped resenting the walk. You are not there yet.' },
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
    lore: { page: 6, text: 'Conditions are perfect. Skin is good. That is the last thing he wrote down before he went up, and you are reading it off the same forecast.' },
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
    lore: { page: 12, text: 'He wrote that he is frightened up there the whole time, and that what he has is a willingness to be frightened for nine hours. You have managed about four seconds and you would like that on the record.' },
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


/* ============================ ENG-9, THIRD SECTION ============================
   The same rule as the two above and no new one: TYPE PLUS LITERAL, nothing else. Eighteen
   blocks, 412 lines, and every function that reads any of them stayed in engine.ts —
   `abilityOf`, `sigById`, `gearById`, `consumableById`, `partnerFor`, `tweakGrip`,
   `claimCurse`. Re-exported by engine.ts, so no caller changed.

   MEASURED BEFORE STARTING, the way the first pass was: across these lines there are
   fourteen injection anchors and one guard window keyed to engine.ts by path — under three
   references per 100 lines, the same density the first pass found and paid. Every one fails
   loudly rather than silently: `region()` throws instead of returning a bad window (GUARD-8)
   and GUARD-9 refuses an injection whose anchor matches nothing, so the suite names each one.

   TWO BLOCKS WERE CUT AND PUT BACK, and they are the point of this section rather than a
   footnote. ARCHETYPES (98 lines) and ACT1_MAP (11) are literal arrays that read as pure
   content and are built by FACTORIES — `L(...)` for a loadout, and `C`/`CAMP`/`EVT`/`FA`/
   `PROJ`/`SHOP` for map nodes. They passed a screen that looked for lowercase function calls
   because a bare capital identifier is not one. Moving them moves the factories, which is
   precisely what killed v6.6, and the compiler said so within a minute of the cut.

   WHAT ELSE DID NOT COME:
     · CARDS — 389 lines, a `Record` filled by `mv(...)`. The original canary, still valid.
     · TALKS — the CONST is pure literal and would move cleanly, and it stayed anyway. The
       ENG-9 guard names it as a canary beside CARDS, and quietly re-pointing a canary to make
       a move pass is how a guard stops meaning anything. Worth 141 lines; needs an argument
       with Evan, not a commit.
     · FONT, PRICE, MAP_SWAP_IN, DEEDS, CLIP_STOCK, MOVE_GIFTS, ACTS, CREEP, DAILY_GOALS —
       literals with arrow functions or GameState reads inside them.
   ============================================================================= */

export const HOLD_STATS: Record<string, HoldDef> = {
  'jug':         { bite: 2, grip: 3, ability: 'Rest',       text: 'Answer it and shed 1 pump.' },
  'crimp':       { bite: 3, grip: 5, ability: 'Sharp',      text: 'Blows a card → +1 pump.' },
  'sharp crimp': { bite: 4, grip: 5, ability: 'Razor',      text: 'Blows a card → burn 1 from hand.' },
  'sloper':      { bite: 2, grip: 6, ability: 'Greasy',     text: '−1 Power without feet. Sweats up if you leave it.' },
  'pinch':       { bite: 3, grip: 5, ability: 'Squeeze',    text: '+1 Bite while both hands are busy.' },
  'pocket':      { bite: 4, grip: 4, ability: 'Two-finger', text: 'Ignores Support.' },
  'flake':       { bite: 3, grip: 6, ability: 'Chained',    text: 'Let the other hand go first: 2 Grip. If it comes off, +1 pump.' },
  'crux':        { bite: 4, grip: 8, ability: 'Committing', text: 'Needs Power 2+. +1 hang tax.' },
}
export const FEET_STATS: Record<string, HoldDef> = {
  /* FEET-1: this row was `ability: '', text: ''` — the ONLY thing on the board that said
     nothing at all, in a table where every hold and every other foothold has an ability and
     a sentence. It is 22.6% of the footholds a campaign meets.

     And it is the answer to the lane's real problem. The choice of foot is genuinely a trade
     already: 38 foot cards, 25 distinct power/contact/support profiles and not one pair where
     either card dominates the other on all three. But SUPPORT ONLY EVER TAKES THE VALUES 1
     AND 2 — every powerful foot is Support 1 and every Support 2 foot is weak — so it is the
     same binary trade every turn. And the wall can only ever push that axis DOWN: `Featureless`
     zeroes it on 28.9% of turns, one weather and two route windows subtract from it, and the
     single positive `dSupport` in the game is a pair of shoes you can buy. Nothing the route
     does ever makes your feet matter MORE, so the trade never inverts — it only gets cancelled.
     `Solid` is the first upward pressure, so some routes are footwork routes and the choice
     changes with the rock instead of being a constant. */
  'foothold':   { bite: 2, grip: 2, ability: 'Solid',      text: 'A settled foot pays +1 Support.' },
  'smear edge': { bite: 2, grip: 3, ability: 'Slick',      text: '−1 Power against it.' },
  'chip':       { bite: 3, grip: 3, ability: 'Sharp',      text: 'Blows a card → +1 pump.' },
  'blank':      { bite: 2, grip: 4, ability: 'Featureless', text: 'This lane grants no Support.' },
}
export const CRUX_CHAR: Record<StyleKey, { label: string; dBite: number }> = {
  'crimp ladder': { label: 'the razor', dBite: 0 },
  'slab':         { label: 'the blank', dBite: 0 },
  'compression':  { label: 'the squeeze', dBite: 0 },
  'power':        { label: 'the throw', dBite: 0 },
  'mixed':        { label: 'the crux', dBite: 0 },
  'jug haul':     { label: 'the crux', dBite: 0 },
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
  /* INFO-3: the two named blanks. Both were already lines about not being able to SEE — the
     sun in your eyes, and nothing to see at all — and both sat on a `read: 1` that told you
     what was coming next while the hold under your hand stayed a mystery only in the prose.
     `Blank` makes the prose true: this one hold never reads exact, whatever beta you carry. */
  { id: 'themirage', name: 'The Mirage', base: 'sloper', dGrip: 3, read: 1, ability: 'Blank',
    note: 'Nothing to hold, and the sun straight in your eyes for the one hard move.' },
  { id: 'thespit', name: 'The Spit', base: 'pocket', dGrip: 2, dBite: 1, read: 1,
    note: 'It turns you slowly over the drop while you work out where the pocket went.' },
  { id: 'thenotch', name: 'The Notch', base: 'pinch', dGrip: 3, read: 1,
    note: 'A slot in the arete, and the weather turning over while you read it.' },
  { id: 'numbcrimp', name: 'The Numb Crimp', base: 'crimp', dGrip: 2, ability: 'Sharp', read: 1,
    note: 'Your fingers stop reporting back somewhere around this one.' },
  { id: 'thewhiteout', name: 'The Whiteout', base: 'sloper', dGrip: 3, read: 1, ability: 'Blank',
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
export const FA_NAMES_A = ['Quiet', 'Long', 'Broken', 'Second', 'Hidden', 'Slow', 'North',
  'Last', 'Thin', 'Cold', 'Old', 'Blind']
export const FA_NAMES_B = ['Line', 'Arete', 'Wall', 'Prow', 'Corner', 'Slab', 'Groove',
  'Crack', 'Face', 'Rib', 'Buttress', 'Nose']
export const ACT_NAMES = ['Act 1 · the forest', 'Act 2 · desert towers', 'Act 3 · the alpine wall']
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
/** One idea per hold, in the order the rock introduces them. */
export const TUTORIAL_STEPS: string[] = [
  // one per hold, in order — jug jug jug sloper crimp crimp pinch pinch
  // sharp-crimp crux jug jug
  'Tap a card, then tap a lane underneath a hold. Then COMMIT — all three go at once, in the order you placed them.',
  'Your Power — the diamond — chips its Grip. Its Bite chips your Contact. Both at once, so you can work a hold and still come off it.',
  'The hold reads a range rather than a number. You have not been on it yet. Work it once and it reads true for the rest of the trip.',
  'That sloper is Greasy: you lose 1 Power on it unless your feet are on something. Put a card in the FEET lane — leaving it empty is campusing, and costs you Bite on both hands.',
  'Every turn costs pump, plus one for each hold you have not answered — and a Greasy hold does worse than that. It sweats up while you are elsewhere, harder every turn, and the hold says so. Clearing holds is how you outrun all of it. Max pump and you are off.',
  'Watch the top of the screen. Every few turns the route does something — greases up, dries out, a gust — and it always says so a turn beforehand.',
  'A card that survives a turn settles in, gaining Power for every turn it stays. Leaving a good card where it is usually beats moving it.',
  'A gaston pulls sideways, and sideways needs something pulling back. On its own it is weak. Put the undercling in the other hand and both get stronger.',
  'Sharp holds burn your card out for the rest of the burn when they blow it. Careful what you put on them.',
  'That is a crux. It needs Power 2 or more or the move does nothing at all. Line something real up for it.',
  'You are near the top, which the game calls EXPOSED. Backing off from here costs an extra psyche. Finishing does not.',
  'Last one. Everything you have just learned is the whole game — the rest is more of it, harder, and further from the car.',
]
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
export const REWARDS = {
  common: ['Gaston', 'Sloper Slap', 'Undercling', 'Mantle', 'Pinch Grip', 'Deadpoint',
    'Heel Hook', 'Drop Knee', 'Flag', 'High Step', 'Breathe', 'Brush',
    'Hand Jam', 'Palm Press', 'Static Reach'],
  uncommon: ['Cross-Through', 'Lock & Bump', 'Dyno', 'Toe Hook', 'Visualize', 'Try-Hard Scream',
    'Crimp Specialist', 'Pocket Poacher'],
  rare: ['Iron Fingers', 'Static Lock', 'Perfect Beta', 'Send Train'],
}
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
  /* CARD-20: Settle's cross-lane sibling, and the combination the two Bump cards had promised
     by name since they existed. */
  { name: 'Launch', text: 'Fires off the other hand: +2 Power while the card in your other hand lane has held a turn. A neighbour you can trust is worth pulling off — durability turned into offence one lane over.' },
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
  { name: 'Blank', text: 'Some things cannot be read. A blank feature never shows you an exact '
    + 'number however much beta you carry, and neither does any hold on a line nobody has '
    + 'climbed — there is no beta on a first ascent, which is what makes it one. You commit on '
    + 'a range, and the range is the climb.' },
  { name: 'Setup', text: 'Work a hold with a Setup move and you are established there: the next '
    + 'hold that comes up in that lane arrives 1 Grip easier. The lane remembers it, not the '
    + 'card — so you collect it by climbing back into the same lane.' },
  { name: 'Chained', text: 'A flake gives ground to whoever lets the other hand go first: '
    + 'resolve it second and it is 2 Grip easier. What it costs is on the board before you '
    + 'commit — if the hand you send first is coming off, you are left hanging there alone and '
    + 'it is a pump. So read the other lane: a hand that holds makes the chain free, and a hand '
    + 'that burns out makes it a trade.' },
  { name: 'Matching', text: 'Both hands on the same kind of hold, with a card on each. You have '
    + 'worked the move once, so you get a breath — shed 1 pump. But you are square to the wall, '
    + 'and opposition needs something to pull against: while you are matched, a sideways move is '
    + 'alone even with a partner beside it.' },
  { name: 'Momentum', text: '+1 Power for each point of flow.' },
  { name: 'Weight', text: '+1 Power for every other card you have on the board.' },
  { name: 'Echo', text: 'Returns to your hand when it clears a hold.' },
  { name: 'Peel', text: 'Draw a card when it blows.' },
  { name: 'Cycle', text: 'Draws a card each turn it holds on, as the turn resolves.' },
  { name: 'Chip', text: 'Also damages the Grip of every other hold on the board.' },
  { name: 'Greedy', text: 'Stronger the closer you are to coming off: +1 Power for every 2 pump you are carrying.' },
]
