# Sandbagged

A climbing card battler. The route is the opponent — it fights back with pump,
fear and conditions. You don't kill anything; you top out.

**Play it: https://rcjlabs.github.io/Sandbagged/**

Installable to a home screen and works offline.

## What it is

Two modes over a single-file React 19 + TypeScript build:

- **The Lost Line** — a three-act expedition for a climb that vanished with the
  man who found it. About half an hour.
- **The Circuit** — endless, escalating, bankable whenever you like.
- **The FA** — one procedural boulder at your level.

250 cards, 37 named routes, five climbers, seven ascent styles, a journal in
the first ascensionist's handwriting, and a logbook you fill in.

## Working on it

```sh
npm install
npm run dev          # vite
npm run check        # typecheck + 330 tests — the one command that fails properly
npm test -- slow     # plus the balance tripwires
npm run ship         # check, build, inline, write docs/
npm run build        # typecheck + vite
npm run build:html   # inline everything into one file, emit docs/
npm run sim campaign 300     # monte-carlo the whole campaign
npm run sim arch 300         # completion by climber
```

Four files. `src/engine.ts` is every rule, `src/App.tsx` every screen,
`src/content.ts` the literal content, `src/types.ts` the leaf types. Content
lives in tables (`CARDS`, `ROUTES`, `EVENTS`, `GEAR`, `ARCHETYPES`) and adding
some touches a table, never the engine — `engine.ts` re-exports everything that
moved out, so nothing that imports from it has to know where a thing lives.
All in-run randomness goes through one seeded RNG, which is why a run can be
replayed from a six-character seed.

`sim/` runs the real engine headlessly — the same `resolve` the game uses — so
balance numbers come from the shipping code rather than a model of it.

## Deploying

`npm run build:html` writes `docs/` — one self-contained HTML file plus the PWA
shell, icons and privacy page. Commit it and GitHub Pages serves it from the
`docs/` folder of the **default branch**, so a release is only live once it has
landed on `main`. Check the footer of the live page against `package.json`:
they are the same string, and SHIP-4 fails the build if they drift.
