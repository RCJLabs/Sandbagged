# Sandbagged — session handoff

A climbing card battler. The route is the opponent. Single-file React 19 + TypeScript + Vite,
shipped as one self-contained HTML file.

**State at the time of writing: v10.74.** `npm run check` is 200/200 core + 119/119 kept;
`npm run check:slow` adds 13 balance guardrails for 132/132. Everything below is measured, and
where a number appears it is reproducible with the command next to it.

---

## Read these first

- **`ROADMAP.md`** — the project's memory. Every ticket, its measurements, and (often) the
  premise it started from and had to retract. Read the row before touching the code it names.
- **`sim/band.mjs`** — the release ledger. Three measured columns per version: the campaign
  band, the known-ending rate, and the five-climber ladder. Its header explains what each one
  is for and how to buy it.
- **The comment above whatever you are about to change.** This codebase carries its reasoning
  in-source, at length, including the versions where the reasoning was wrong. That is not
  decoration: several tickets have been saved by a note saying "this was tried and cost 3.1
  points".

## How work is done here

1. **Measure the row's premise before designing anything.** Roughly half the rows in the
   ROADMAP turned out to be wrong or half-wrong on measurement, and the ones that shipped well
   are the ones where that was found first. Recent examples: LANE-3's row blamed a family bias
   that decomposes to zero; LANE-4's row said to remove a term whose removal breaks two
   guardrails; BAL-18's row prescribed a fix that would have cost three times what shipped.
2. **One guard per ticket, negatively tested by injection.** Add the guard, then break the
   thing it guards and confirm it says so — `node sim/mutants.mjs <TICKET>`. A guard that has
   never failed is not known to work. This has caught vacuous assertions written minutes
   earlier more than once.
3. **Never weaken a guardrail to make it pass.** If a floor is in the way, buy the thing back
   (CARD-15, BAL-16, LANE-5 all did) or fix the cause. Moving the bar is the one thing BAL-9
   exists to forbid.
4. **Re-pin deliberately, with a date and a reason, and move every pin the lever touches.**
   Two copies of one number is the failure mode that cost NARR-22, BAL-18 and SIM-8 a repair
   each.
5. **Watch for guards that pass on a draw.** Five were found in one session, every one because
   something else moved: a bar 18 points under its own pin, a coarse pass ranking a roster
   inside its own error, a claim asserted twice at different samples, an act curve comparing
   unconditional shares, and a fine pass that only looked at two climbers. When a guard's
   margin is inside its noise, buy the resolution or fix the metric — do not widen the bar.
6. **Anchor injections on what identifies a thing, never on a number a release can change.**
   Five anchors rotted in one session on version strings and balance constants. GUARD-9 now
   refuses an anchor quoting the current version; it cannot catch a balance constant, so that
   part is on you.

## The numbers, and how to buy them

| what | command | at v10.74 |
|---|---|---|
| campaign band (the pin) | `PAGES=14 SHARP_AT=99 node sim/run.mjs campaign 3000` | **59.0%** |
| known-ending rate | `TRIPS=8 node sim/run.mjs career 720 reads` | **80.0%** |
| climber ladder | `PROJECTS=0 node sim/run.mjs arch 2000` | 13.1 / 9.0 / 10.2 / 10.7 / 13.7 |

All three go into `sim/band.mjs` for the version you ship; a release without them fails
`npm run check`. The band takes ~20 minutes, the ending ~4 minutes (CARD-20 bought its resolution — the old
240-career slice diverges ±6 between nearly-identical engines), the ladder ~5 minutes.
The harness is seed-fixed, so an honest entry reproduces exactly.

**Sample sizes are not decoration.** Campaign completion has an SE of ~2.9 at n=300 and ~1.3 at
n=3000; a climber near 7% has ~0.57 at n=2000. Several tickets have chased differences smaller
than their own error and concluded the opposite sign. If a margin is under 2 SE, it is not a
measurement yet.

## Where things are

- `src/engine.ts` — all the rules. The sim imports this, so the harness can never drift from
  what ships.
- `src/App.tsx` — every screen, the CSS, the ink and sound layers. **The CSS lives in a
  template literal: no backticks in its comments.** (Cost two tsc failures in one ticket.)
- `sim/run.mjs` — the harness. Modes: `campaign`, `arch`, `career`, `ladder`, `rock`, and more.
- `sim/test-core.mjs` — the fast suite: rules, screens, saves, and arithmetic over the ledgers.
- `sim/test.mjs` — the kept suite, plus the balance guardrails behind `slow`.
- `sim/mutants.mjs` — the kept injections. `node sim/mutants.mjs` for the fast set,
  `... slow` for the ledger ones, `... TICKET-N` for one ticket's.
- **If a `mutants` run is KILLED rather than exiting, check the tree before trusting it.** The
  runner restores on SIGINT and on an uncaught exception and byte-compares at exit, but a hard
  kill bypasses all of that. It happened once: an injection's mutation was left in the newest
  ledger row — an invented number, which `band.mjs` calls worse than no ledger at all. Both
  guards caught it (GUARD-9's anchor check and BAL-18's arithmetic), so `npm run check` is the
  check that matters after an interrupted run.
- `sim/guard.mjs` — `region()`, `cssRule()`, `declBody()`. **Use these for source windows.**
  GUARD-8 fails any window taken off a bare `indexOf`, and it has caught guards written in the
  same hour as itself.

## Shipping

`npm run ship` = `check:slow` + `vite build` + `build:html`, and it will not build without the
slow suite. Then: bump `package.json`, update the three version strings in `src/App.tsx`
(SHIP-4 enforces this — two releases shipped showing the wrong version before it existed), add
the ledger row, update the ROADMAP row, commit, push to `main`.

## What is open

Read the ROADMAP rows for the full argument; this is the shape of it.

- **ROPE-2 second row**, **SHIP-3** (Play Store: account, signing key, device), **ART-3** (store
  art) — the last two need a human with a phone and an account.
- **BAL-13** is parked with an answer: act 1 is frictionless and no dial fixes it.

## A prompt to start from

> This is Sandbagged, a single-file React climbing card game. Read `HANDOFF.md` and `ROADMAP.md`
> first, then `sim/band.mjs`.
>
> Work the way the handoff describes: pick a row, **measure its premise before designing
> anything** — about half of them turn out to be wrong — then ship it as a full version bump
> with its own guard, negatively tested by injection (`node sim/mutants.mjs <TICKET>`). Never
> weaken a guardrail to make it pass: buy the thing back or fix the cause. If you move a pin,
> move every pin the same lever touches, and say in the ledger that you did it and why.
>
> Report what you measured, including the numbers that went against you, and retract premises
> explicitly with the figures. Verify claims on disk before presenting them.
>
> Ship with `npm run ship`, record the three ledger numbers for the new version, update the
> ROADMAP row, and push to `main`. Then hand me the single-file build.
>
> Start with: **<row>**.
