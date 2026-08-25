# Visual directions — the climb screen, five ways

Five style directions for the same turn: The Fridge, a sloper and a crux and a
smear edge on the wall, Open Hand / Lock Off / Smear in hand, pump 7 of 11.
Same content in every one, so the style is the only variable.

| file | direction | thesis |
|---|---|---|
| `Main.dc.html` | A · Field Guide | what ships today, tightened — a guidebook you annotate |
| `TopoDark.dc.html` | B · Topo Dark | the route as a technical drawing |
| `ChalkSlate.dc.html` | C · Chalk & Slate | the material the sport is made of |
| `Archive.dc.html` | D · Expedition Archive | Halloway's field book — leans hardest into the fiction |
| `Granite.dc.html` | E · Granite | the store-screenshot direction |

A is not an invention: its values are lifted from `src/App.tsx` — `#e8e1d0`
paper, `#26221e` ink, `#8c3124` oxide red, the `--stone` wall against the
`--card` hand, the tan margin stripe, the red diamond and green pill pips. The
other four are deliberate departures from it.

The card stats, hold abilities and preview strings are real, out of
`src/engine.ts`. If a rule changes, these mockups go stale — they are a
snapshot for choosing a direction, not a spec.

`canvas.json` lays the artboards out and carries the per-direction notes.
These files are the source; the published canvas is regenerated from them.
