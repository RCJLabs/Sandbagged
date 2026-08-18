# ROPE-2 — The Lost Line, roped

A spec, not an implementation. Written 2026-08-17 against v10.44.

## 1. What exists today, verified rather than remembered

`ROPE-1` shipped at **v3.0** and was the change that defined the MVP. The three-lane
fight is identical on a rope; what changes is what a fall *means*. You fall onto your
last piece, lose the ground above it, and carry on — so **runout** is the tension.
Clearing a hold without clipping raises it; clipping resets it and marks where the rope
catches you. A pitch boundary is a **belay**: `pump: 0`, `runout: 0`, `lastPiece: cleared`.

On disk now:

| | |
|---|---|
| roped routes | **4 of 37** — The Nose Direct (3 pitches), Coffin Crack (3), The Cornice (2), The Hanging Slab (2) |
| | *(corrected v10.46: it was **3** distinct lines when this spec was written. The Cornice and The Hanging Slab were mechanically identical — same shape, same signature stats — and reported identical send, ground-fall and caught-fall rates across 600 sessions each. `ROUTE-16` differentiated the Hanging Slab with the closing ice window its own note had always promised, so the count is honestly four now.)* |
| where | **all in Act 3** |
| Circuit | every fourth line is roped, 2 pitches (`n % 4 === 3`) |
| protection | 8 pieces, carried as `clip` **bonus** cards (not moves — clipping is a quick action, not a limb) |
| a caught fall | costs a burn; `ATTEMPTS = 3`, so three and the day is done |

You can finish the campaign having roped up three times. The game's most distinctive
mechanic is a speciality of its last act.

## 2. The blocker — read this before designing anything

**Ground falls are unreachable.** `startBurn` sets

```ts
runout: 0, lastPiece: spec.roped ? 0 : -1, pitch: 0,
// the belay is your first piece: on a rope you are never on nothing
```

so on a roped route `lastPiece` is never negative, and the branch that ends the route —

```ts
if (out.lastPiece < 0) return { ... 'Off, with nothing in. That is a ground fall.' }
```

— cannot fire. **Measured: 1,600 sessions across all four roped routes with every `clip`
card stripped out of the deck, and zero ground falls.** Send rate 52.8%.

ROPE-1's headline number — *"without gear 65% send but 16% ground falls; with gear 51%
and 2%"* — is **historical**. Protection today changes *where you get caught*, not
*whether the route ends*. That is a real mechanic, but it is a smaller one, and the
roadmap still describes the larger one.

**So ROPE-2 has a prerequisite, and it is a decision rather than a build:**

- **(a) Give the rope its teeth back.** The belay stops counting as a piece once you are
  above the first hold, so running it out with nothing in can still end the day. Restores
  the risk ROPE-1 measured — and is **on-band**, because it makes four existing routes
  and every fourth Circuit line harder.
- **(b) Accept what it is now.** The rope's tension is "you lose ground and a burn",
  which is honest and already balanced. Then **delete the dead branch and its message**,
  and correct the ROPE-1 row so the ledger stops claiming a risk the game does not have.

I lean to **(b)**, and the reason is BAL-13's shape: the current numbers are eleven acts
of balance old and the game plays well. Reintroducing catastrophe to Act 3 is a
completion-band change made for narrative tidiness, which is the trade this project has
declined before. But (b) means ROPE-2 cannot be sold as "risk" — it has to be sold as
*structure*, which is what section 3 does.

Either way: **do not build a finale on a risk that is not there.**

## 3. The proposal — a second way up, not a replacement

`The Lost Line` is grade 10, `clear: 15`, `crux: 6`, compression, feet hard, with a
weather window at 0.65 and three phases already named out of his journal:

| phase | at | effect | his page |
|---|---|---|---|
| The Traverse | 0.35 | `dTax: 1` | 13 — *"the crux is not the crux. It is the forty feet after it"* |
| The Crux Sequence | 0.60 | `allCrux` | 5 — *"a cross-through off a two-finger pocket to a sloper you cannot see"* |
| The Headwall | 0.85 | `noRest` | 6 — *"conditions are perfect. Skin is good."* |

**The proposal is that you choose how to climb it.** Not a harder variant and not an
easier one — a different shape, with the choice made on the ground before you commit.

- **Solo it** (today's route, unchanged). One push. Pump accumulates over fifteen holds,
  the window shuts on the headwall, and there is nowhere to shake out at the top.
- **Rope it.** Three pitches, belays at 5 and 10. Each belay is `pump: 0` — which is a
  large gift on a route whose difficulty *is* accumulated pump — paid for by: the rack
  taking deck slots that would have been moves, and **the headwall sitting above the last
  belay**, so the final third is still one unbroken push with `noRest` and the window
  already shut. You buy two resets and you do not buy the top.

**Why this is the right ticket rather than a rope-first act.** It reuses everything
ROPE-1 built, it is contained to one route, and it lands the mechanic at the moment the
player cares most — where the journal beta, the blind penalty and the epilogue already
converge. A rope-first act is an expansion needing its own band re-pin from scratch.

## 4. The part that makes it a story rather than a mode

His page 4, *On going alone*: **"Told Marge I was working the Cathedral. Not a lie
exactly. She would come if I asked and I am not asking. This one is mine to be stupid
about."**

So roping up is a choice **against his example**, and soloing it is following him. That
is free to express and this project already has the pattern for it — `NARR-20`'s `lore`
proved that text gated on state is band-neutral by construction:

- the epilogue gains **one line** that differs by how you got up, alongside what it
  already reads off `endingFor` and `honestyOf`
- `marge7` — *"One thing. Did he name it?"* — gains an `arch`-style variant reply for
  somebody who roped it, because she is the person who would have come if he had asked
- **no reward asymmetry.** Soloing must not pay better. The moment it does, the narrative
  choice becomes an optimisation and the fiction is decoration on a dial.

## 5. Band risk, and how to keep it honest

This is the dangerous part, and it is the reason the ticket is P2 rather than P1.

- **Making it choosable in the campaign is on-band.** Two pump resets on the finale is
  worth a lot, and the finale is the last gate before the 44.3% completion figure.
- **The safe construction:** the harness's default policy **never ropes it**, the same
  way `PROJECTS=0` keeps projects off the measured band. Then the pinned band is
  unchanged *by construction*, and the roped line gets its own band, measured and dated
  beside the existing one.
- **Measurements to run before writing any content:**
  1. `PAGES=14` completion with the roped variant available and the policy declining it —
     must read **44.3%**, or something is not off-band that should be.
  2. Finale send rate, solo vs roped, at n≥2000. If roped is more than **~8 points**
     easier, the belays are too cheap: move the second one down, or cut to 2 pitches.
  3. Ground-fall rate under (a) if (a) is chosen at all, on all four existing roped
     routes — because (a) changes them, not just the finale.
  4. Climber spread across the roster, roped. The rack costs deck slots, so this is
     exactly the lever that took the spread to 2.9× at v9.36. **BAL-16's floor of 5 and
     BAL-17's 1.32× spread are the numbers to defend.**

## 6. What this deliberately does not do

- **No new routes.** Thirty-seven is enough; the complaint was never variety.
- **No rope-first act.** Named as ROPE-3 if anybody still wants it after this.
- **No reward for the harder-looking choice.** See section 4.
- **No new protection.** Eight pieces already exist and are barely used outside Act 3.

## 7. Guards it would need

- the finale exists in both shapes, and **both are reachable** — the NARR-17 lesson: a
  variant nobody can get to is not a feature
- the roped finale's **last belay is below the headwall phase**, asserted against
  `phases`, so a later edit to either cannot silently hand you a reset at the top
- **no outcome asymmetry**: the two paths' rewards compared field by field, so soloing
  cannot quietly start paying better
- the epilogue and Marge lines are **text only** — the `NARR-20` assertion that resolution
  never reads them
- and whichever of (a)/(b) is chosen, a guard that **states it**: under (b), that the
  dead ground-fall branch is gone and stays gone; under (a), that a runout with nothing
  in still ends the day, measured rather than asserted from source.

## 8. Rough order

1. Decide (a) or (b). Nothing else starts first.
2. Ship the decision on its own, with its guard and its measurement.
3. The roped finale, off-band by construction, with the four measurements above.
4. The epilogue line and Marge's variant reply.
