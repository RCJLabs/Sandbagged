# Visual directions — round three: five takes on F

F (Vertical Ascent) was the pick. These five keep its thesis — **no stacked
panels; the screen is the wall; holds sit where they physically are** — and
vary the **camera** and the **rendering** instead.

Each one also takes a different run at F's real weakness: in F every number
ends up sitting on drawn rock.

| file | direction | camera | how it answers F's weakness |
|---|---|---|---|
| `Ascent.dc.html` | F · Vertical Ascent | face-on | *(reference — the one being varied)* |
| `Main.dc.html` | K · Profile | turned 90°, daylight | labels live in open sky on leader lines |
| `Beta.dc.html` | L · Beta | face-on, photographic | the data becomes handwriting on the photo |
| `Route.dc.html` | M · Route | pulled back to the whole climb | holds become a legible vertical chain |
| `Dusk.dc.html` | N · Dusk | face-on, flattened | the wall has no texture to compete with type |
| `Macro.dc.html` | O · Macro | pushed all the way in | one hold owns the screen, so numbers can be huge |

Same turn in all six — The Fridge V3, a sloper (Greasy, bite 2 / grip 6), the
blank (Committing, 4 / 8) and a smear edge (1 / 3); Open Hand / Lock Off /
Smear in hand; pump 7 of 11, flow 2; preview WORKS IT · 2 grip left · +1 pump
— so the camera is the only variable.

M is the odd one out and worth calling out: it is the only direction that shows
**progress** — holds already sent, the anchor above, time elapsed — which no
version of the game currently shows anywhere.

The card stats, hold abilities and preview strings are real, out of
`src/engine.ts`. If a rule changes these go stale — they are a snapshot for
choosing a direction, not a spec.

`canvas.json` lays the artboards out and carries the per-direction notes, each
with its motivation *and* its tradeoff. These files are the source; the
published canvas is regenerated from them.
