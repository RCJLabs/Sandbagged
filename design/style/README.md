# Visual directions — round two: five different UIs

The first five directions (A–E) were rejected, correctly: they were five
palettes on one layout — wall panel on top, three hold rows, hand along the
bottom. Changing the paint is not a choice of design.

These five change the **structure** first. Same turn in every one — The Fridge
V3, a sloper (Greasy, bite 2 / grip 6), the blank (Committing, 4 / 8) and a
smear edge (1 / 3); Open Hand / Lock Off / Smear in hand; pump 7 of 11, flow 2;
preview WORKS IT · 2 grip left · +1 pump — so the layout is the only variable.

| file | direction | what is structurally different |
|---|---|---|
| `Main.dc.html` | F · Vertical Ascent | no panels — the screen is the wall, holds are placed in space |
| `Ring.dc.html` | G · Ring | radial: pump is a dial, holds are spokes, hand curves under the thumb |
| `Arcade.dc.html` | H · Arcade | fighting-game HUD: you vs the route, two health bars, a move list |
| `Zine.dc.html` | I · Zine | photocopied collage: clippings taped at angles, two inks, no grid |
| `Terminal.dc.html` | J · Terminal | one monospace column; the preview shows its own arithmetic |

They are lettered F–J so A–E keep their identities in the earlier notes.

The card stats, hold abilities and preview strings are real, out of
`src/engine.ts`. If a rule changes these go stale — they are a snapshot for
choosing a direction, not a spec.

`canvas.json` lays the artboards out and carries the per-direction notes,
each with its motivation *and* its tradeoff. These files are the source; the
published canvas is regenerated from them.
