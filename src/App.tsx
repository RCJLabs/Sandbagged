// Sandbagged — the screens.
//
// Everything the player sees. The rules live in ./engine and are imported;
// this file holds the CSS, the ink and sound layers, and the screens.
// SANDBAGGED v9.41 — EVT-4: events that remember

import { useState, useMemo, useEffect } from 'react'
import type { KeyboardEvent } from 'react'
import {
  ACTS, ACT_NAMES, ACT_OF_ROUTE, ACT_TERRAIN, ACT_XP, ARCHETYPES, ASCENT, BOOK_BETA_MAX,
  BY_RARITY, CAMPUS_BITE, CARDS, CROP_COST, CampAction, Card, DECKS, DECK_SIZE,
  DEFAULT_LOADOUT, DOUBT_AT, EVENTS, EXPOSED_FALL_PSYCHE, EXPOSED_PSYCHE, Established,
  FA_NAMES_A, FA_NAMES_B, FEET_STATS, FLOW_AT, GameState, HISTORY_MAX, HOLD_STATS,
  JOURNAL, KEYWORDS, LANE_NAMES, LINES, MAP_BOT, MAP_H, MAP_TOP, MAP_W, MUTATORS,
  MapNode, OPPOSE_ALONE, OPPOSE_PAIR, PRICE, PROJECT_SKIN, PSYCHE_BAIL, PSYCHE_MAX,
  PUMP_MAX, Phase, RARE_SLOTS, RNG, ROCK, ROUTES, RUN_SKIN, Rarity, SKIN_MAX,
  SLOTS, SYNERGY_PER, TAG_NAMES, TALKS, TOPROPE_SKIN, TUTORIAL_DECK, TWEAK_GRIP,
  UNCOMMON_SLOTS, WEATHER, abilityOf, activeSlot, aheadSummary, applyOutcome,
  archUnlocked, attemptsFor, availableTalk, biteAgainst, boonById, boonMods,
  bossAhead, bossNext, buildLoadout, buildable, campBeforeBoss, campSkinFor,
  campStep, cardHints, carryOver, cashForSend, circuitRoute, claimCurse, claimVerdict,
  coach, codeSeed, copyLimit, cropStep, dailyRoute, dailySeed, dayKey, desperationOf,
  endSession, endingFor, endingStep, establishedIn, exportSave, exposed, exposureOf,
  faRoute, familyOf, forecastFor, forecastScore, freshRun, gainXp, gearById,
  gearMods, gradeLabel, gradeText, gripShown, holdLabel, honestyOf, importSave,
  jit, leaveEventStep, leaveShopStep, lineCanVary, loadGame, loadoutDeck, mapCliff,
  mapContours, mapPoints, mutMods, newRun, nextPhase, phaseOf, phaseSummary,
  pickGearStep, pileFromHand, playBonusStep, postOpen, postTalk, powerAgainst,
  previewLane, previewPump, priceOf, recordRun, rerollCost, rerollStep, resolve,
  rollEvent, roughPath, saveGame, seedCode, seqById, seqNeedText, sigById, skirmishRoute,
  slotSummary, slotsUsed, spawn, specFromEstablished, specOf, startBurn, stockShop,
  styleMods, tagCounts, tagOf, takeOfferStep, takeTwoStep, vanOpen, walkAwayStep,
  wipeSlot, xpForSend, xpMult, xpToNext,
} from './engine'

/* ============================== UI ================================= */

/* ============================ SOUND ================================
   Synthesised in Web Audio — no files, same reasoning as the art. The
   context is created lazily on the first tap because browsers require
   a gesture, and every failure path is swallowed: a silent game still
   plays perfectly.                                                    */
type Sfx = 'tap' | 'place' | 'lift' | 'commit' | 'clear' | 'blow' | 'fall' | 'send' | 'rest' | 'phase'
let AC: AudioContext | null = null
let NOISE: AudioBuffer | null = null
function audio(): AudioContext | null {
  if (AC) return AC
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    AC = new Ctor()
    const n = Math.floor(AC.sampleRate * 0.4)
    NOISE = AC.createBuffer(1, n, AC.sampleRate)
    const ch = NOISE.getChannelData(0)
    let seed = 1337 >>> 0
    for (let i = 0; i < n; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      ch[i] = (seed / 4294967296) * 2 - 1
    }
  } catch { AC = null }
  return AC
}
function tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
  const ac = audio(); if (!ac) return
  const t = ac.currentTime + delay
  const o = ac.createOscillator(), g = ac.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.02)
}
function grit(dur: number, freq: number, q: number, vol: number, delay = 0) {
  const ac = audio(); if (!ac || !NOISE) return
  const t = ac.currentTime + delay
  const src = ac.createBufferSource(); src.buffer = NOISE
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(bp); bp.connect(g); g.connect(ac.destination)
  src.start(t); src.stop(t + dur + 0.02)
}
export function sfx(kind: Sfx, on: boolean) {
  if (!on) return
  try {
    switch (kind) {
      case 'tap': grit(0.045, 2600, 1.2, 0.05); break
      case 'lift': tone(420, 560, 0.07, 'triangle', 0.045); break
      case 'place': tone(180, 120, 0.11, 'sine', 0.10); grit(0.05, 900, 0.8, 0.045); break
      case 'commit': grit(0.20, 1500, 0.6, 0.10); tone(140, 90, 0.16, 'sine', 0.07); break
      case 'clear': tone(520, 780, 0.13, 'triangle', 0.09); tone(780, 1040, 0.10, 'sine', 0.05, 0.06); break
      case 'blow': grit(0.16, 480, 0.5, 0.13); tone(150, 60, 0.20, 'sawtooth', 0.06); break
      case 'rest': tone(300, 240, 0.22, 'sine', 0.06); break
      case 'fall': tone(260, 55, 0.55, 'sawtooth', 0.11); grit(0.45, 320, 0.4, 0.09); break
      case 'phase':
        tone(220, 170, 0.34, 'sawtooth', 0.10)
        grit(0.30, 700, 0.5, 0.09)
        break
      case 'send':
        tone(392, 392, 0.14, 'triangle', 0.08)
        tone(523, 523, 0.14, 'triangle', 0.08, 0.10)
        tone(659, 659, 0.30, 'triangle', 0.09, 0.20)
        break
    }
  } catch { /* silence is fine */ }
}
export const buzz = (ms: number | number[], on: boolean) => {
  try { if (on && 'vibrate' in navigator) navigator.vibrate(ms) } catch { /* no haptics */ }
}


const CSS = `
:root{--paper:#e8e1d0;--ink:#26221e;--red:#8c3124;--green:#3f5438;--tan:#b8873f;--fade:#5f584a}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{overflow-x:hidden}
body{margin:0;background:#d8d0bd;font-family:ui-serif,Georgia,'Times New Roman',serif;color:var(--ink)}
.wrap{max-width:390px;margin:0 auto;min-height:100vh;overflow-x:hidden;padding:9px 12px 16px;
 background-color:var(--paper);
 background-image:
  repeating-linear-gradient(to bottom,transparent 0 27px,rgba(96,84,60,.05) 27px 28px),
  radial-gradient(ellipse at 50% 40%,rgba(255,255,255,.34) 0%,rgba(120,104,74,.075) 100%),
  url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' seed='11'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23p)' opacity='0.30'/%3E%3C/svg%3E");
 background-size:auto,100% 100%,120px 120px;
 background-blend-mode:multiply,multiply,multiply}
.row{display:flex;justify-content:space-between;align-items:baseline}
.h1{font-size:calc(19px * var(--fs));font-weight:700}
.sub{font-size:calc(11px * var(--fs));color:var(--fade)}
.rule{border:0;border-top:1px solid var(--fade);opacity:.5;margin:6px 0}
.lbl{font-size:calc(9px * var(--fs));letter-spacing:1.1px;color:var(--fade);font-weight:700}
.lett span{transform-origin:50% 70%}
.inkrule{display:block;width:100%;height:8px;margin:2px 0 5px}
/* VIS-2: the silhouette was 22px in a corner, so nobody read it. It is the
   card's anchor now — big, centred, and behind the text rather than beside it,
   so the shape registers before the words do and the board can be read at a
   glance instead of parsed. */
.gl{position:absolute;top:4px;right:4px;pointer-events:none;opacity:.95}
.glossrow{display:flex;align-items:center;gap:8px}
.cond{font-size:calc(10px * var(--fs));border:1px solid var(--fade);border-radius:2px;padding:3px 6px;
 display:inline-block;margin-right:5px;letter-spacing:.4px}
.track{display:flex;gap:3px;align-items:center;margin:5px 0 2px}
.tick{flex:1;height:9px;border:1.5px solid var(--ink);border-radius:1px}
.tick.done{background:var(--green);border-color:var(--green)}
.goal{font-size:calc(12px * var(--fs));font-weight:700}
.board{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.rb{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
.topo{display:block;width:100%;height:34px;margin:4px 0 0}
.slot{position:relative;height:calc(120px + (var(--fs) - 1) * 95px);border-radius:2px;padding:6px;
 display:flex;flex-direction:column;justify-content:space-between;overflow:visible}
.slot.foe{background:#ded5c2}.slot.you{background:#f0eade}
.slot.empty{opacity:.5;justify-content:center;align-items:center}
.slot.tgt{box-shadow:0 0 0 2px rgba(158,58,44,.22)}
.nm{font-size:calc(10.5px * var(--fs));font-weight:700;line-height:1.1;
 overflow-wrap:anywhere;hyphens:auto}
.ab{font-size:calc(8.5px * var(--fs));font-weight:700;color:var(--red);letter-spacing:.3px;margin-top:2px}
.tx{font-size:calc(8px * var(--fs));color:var(--fade);line-height:1.15;overflow-wrap:anywhere}
.pips{display:flex;justify-content:space-between;align-items:center}
/* A fixed 20px circle, which was fine for a single digit and clipped "12-13"
   onto two lines the moment ENG-10 started showing an unworked grip as a span.
   The grip pip grows into a pill; at one digit the radius still reads round. */
.pip{min-width:20px;height:20px;box-sizing:border-box;border-radius:50%;
 display:grid;place-items:center;white-space:nowrap;
 font-size:calc(10.5px * var(--fs));font-weight:700;border:1.5px solid;background:var(--paper)}
.pip.o{width:20px;color:var(--red);border-color:var(--red);border-radius:3px;transform:rotate(45deg)}
.pip.o span{display:block;transform:rotate(-45deg)}
.pip.d{color:var(--green);border-color:var(--green);border-radius:10px;padding:0 4px}
.cb{--red:#a8442c;--green:#26557a;--tan:#7a6a4a}
.lanes{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:4px 0 3px;text-align:center}
.bar{height:18px;border:1.5px solid var(--ink);border-radius:2px;display:flex;overflow:hidden}
/* VIS-3: what the conditions do to the page. Deliberately under the text
   rather than over it — ENG-20 made these worth 46 points of send rate and they
   still have to be readable at the largest text size on a phone in the sun. */
.wrap[class*="wx-"]::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0}
.wrap[class*="wx-"]>*{position:relative;z-index:1}
.wx-crisp::before{background:radial-gradient(ellipse at 50% 0%,rgba(190,205,215,.16) 0%,transparent 62%)}
.wx-hotsun::before{background:
  radial-gradient(ellipse at 50% 6%,rgba(196,120,40,.17) 0%,transparent 58%),
  linear-gradient(to bottom,rgba(184,135,63,.09) 0%,transparent 42%)}
.wx-humid::before{background:
  radial-gradient(circle at 22% 28%,rgba(96,84,60,.10) 0 9%,transparent 12%),
  radial-gradient(circle at 74% 54%,rgba(96,84,60,.09) 0 11%,transparent 14%),
  radial-gradient(circle at 44% 79%,rgba(96,84,60,.08) 0 8%,transparent 11%)}
.wx-freezing::before{background:
  radial-gradient(circle at 0% 0%,rgba(196,214,226,.30) 0 14%,transparent 22%),
  radial-gradient(circle at 100% 0%,rgba(196,214,226,.28) 0 13%,transparent 21%),
  radial-gradient(circle at 0% 100%,rgba(196,214,226,.24) 0 12%,transparent 19%),
  radial-gradient(circle at 100% 100%,rgba(196,214,226,.26) 0 13%,transparent 20%)}
.wx-drizzle::before{background:
  repeating-linear-gradient(74deg,transparent 0 13px,rgba(110,120,130,.13) 13px 15px)}
/* colour-blind mode drops the hues and keeps the texture, so the cue survives */
.cb[class*="wx-"]::before{filter:saturate(.25)}
.seg{flex:1;border-right:1px solid rgba(38,34,30,.35);transition:background .18s}
/* VIS-1: where this turn takes you, drawn ahead of where you are */
.seg.will{background:repeating-linear-gradient(45deg,var(--tan) 0 2px,transparent 2px 4px)}
.seg.willfall{background:repeating-linear-gradient(45deg,var(--red) 0 2px,transparent 2px 4px)}
.seg.shedding{background:repeating-linear-gradient(45deg,var(--green) 0 2px,transparent 2px 4px)}
.bar.tremble{animation:shake .9s ease-in-out infinite}
.nomo .bar.tremble{animation:none}.seg:last-child{border-right:0}
.seg.on{background:var(--tan)}.seg.danger{background:var(--red)}
/* full-bleed horizontal scroller. padding-top leaves room for the selected
   card's lift so overflow-y:hidden does not clip it. */
.hand{display:flex;margin:8px -12px 0;padding:14px 12px 6px;min-height:calc(146px + (var(--fs) - 1) * 95px);
 overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch;
 scroll-snap-type:x proximity;overscroll-behavior-x:contain}
.hand::-webkit-scrollbar{display:none}
.card{position:relative;width:calc(112px + (var(--fs) - 1) * 40px);min-width:calc(112px + (var(--fs) - 1) * 40px);height:calc(124px + (var(--fs) - 1) * 95px);border-radius:2px;
 background:#f0eade;padding:6px 12px 6px 7px;display:flex;flex-direction:column;justify-content:space-between;
 margin-left:-8px;transition:transform .12s;box-shadow:2px 0 4px rgba(0,0,0,.10);
 scroll-snap-align:center;flex:0 0 auto}
.card:last-child{padding-right:7px}
.card:first-child{margin-left:0}
.card.sel{transform:translateY(-11px);z-index:9}
@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-3px)}
 40%{transform:translateX(3px)}60%{transform:translateX(-2px)}80%{transform:translateX(2px)}}
@keyframes pop{0%{transform:scale(1);opacity:1}45%{transform:scale(1.07);opacity:.55}
 100%{transform:scale(1);opacity:1}}
@keyframes tear{0%{transform:translateY(0) rotate(0);opacity:1}
 100%{transform:translateY(14px) rotate(-4deg);opacity:.25}}
@keyframes land{0%{transform:translateY(-9px);opacity:.4}100%{transform:translateY(0);opacity:1}}
@keyframes pulse{0%{filter:none}50%{filter:brightness(1.35)}100%{filter:none}}
.fx-bite{animation:shake .28s ease-out}
.fx-clear{animation:pop .34s ease-out}
.fx-blow{animation:tear .34s ease-in forwards}
.slot.you,.slot.foe{animation:land .18s ease-out}
.bar.hot{animation:pulse .3s ease-out}
.card.bonus{background:#eae2cf}
.btn{border:1.5px solid var(--ink);background:var(--paper);border-radius:2px;padding:8px 12px;
 font-family:inherit;font-size:calc(12px * var(--fs));font-weight:700;color:var(--ink)}
.btn.go{background:var(--ink);color:var(--paper)}
.log{font-size:calc(10px * var(--fs));color:var(--fade);line-height:1.4;margin-top:6px;min-height:46px}
.spot{font-size:calc(11px * var(--fs));line-height:1.45;margin-top:8px;padding:7px 9px;border-left:3px solid var(--red);
 background:rgba(158,58,44,.07)}
.spot b{font-size:calc(9px * var(--fs));letter-spacing:1px;color:var(--red);display:block;margin-bottom:2px}
.pv{position:absolute;left:5px;right:5px;bottom:30px;font-size:calc(8.5px * var(--fs));font-weight:700;
 letter-spacing:.3px;text-align:center;pointer-events:none;line-height:1.1}
.pv.good{color:var(--green)}.pv.bad{color:var(--red)}.pv.mid{color:var(--fade)}
.sheet{position:fixed;inset:0;background:rgba(30,26,20,.45);display:flex;
 align-items:flex-end;justify-content:center;z-index:50}
.sheetin{width:100%;max-width:390px;max-height:82vh;overflow-y:auto;padding:12px 12px 16px;
 background-color:var(--paper);border-top:2px solid var(--ink);
 background-image:radial-gradient(rgba(120,110,90,.05) 1px,transparent 1px);background-size:3px 3px}
.tap{cursor:pointer;text-decoration:underline;text-decoration-style:dotted}
/* announced, never drawn */
.vis-hidden{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;
 clip:rect(0 0 0 0);white-space:nowrap;border:0}
[role="button"]:focus-visible,button:focus-visible{outline:2.5px solid var(--red);outline-offset:2px}
.menu-item{border:1.5px solid var(--ink);border-radius:2px;padding:8px 9px;margin-bottom:6px;background:#f0eade}
.big{font-size:calc(15px * var(--fs));font-weight:700}.center{text-align:center}
.deckrow{display:flex;align-items:center;gap:7px;padding:5px 0;border-bottom:1px solid rgba(122,114,100,.28)}
.deckrow .nmx{flex:1;min-width:0}
.deckrow .t1{font-size:calc(12px * var(--fs));font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.deckrow .t2{font-size:calc(9px * var(--fs));color:var(--fade);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.step{width:32px;height:32px;border:1.5px solid var(--ink);border-radius:2px;background:var(--paper);
 font-family:inherit;font-size:calc(16px * var(--fs));font-weight:700;line-height:1;color:var(--ink);flex:0 0 auto}
.step:disabled{opacity:.25}
.cnt{width:20px;text-align:center;font-size:calc(13px * var(--fs));font-weight:700;flex:0 0 auto}

.wrap{--fs:1}
.fs1{--fs:1.15}.fs2{--fs:1.3}
/* A11Y-2: motion off, by preference or by choice */
@media (prefers-reduced-motion: reduce){
 .wrap *{animation:none !important;transition:none !important}}
.nomo *{animation:none !important;transition:none !important}
`

/* ============================ INK ==================================
   Everything is drawn in code. Jitter is derived from a seed, never
   Math.random, so a card's border is the same stroke every render
   instead of crawling under StrictMode.                              */
/** A hand-drawn box: the same edge inked twice, slightly off. */
function Ink({ w, h, seed, color = 'var(--ink)', sw = 1.5, deckle = 1 }:
  { w: number; h: number; seed: number; color?: string; sw?: number; deckle?: number }) {
  return (
    <svg className="rb" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={roughPath(w, h, seed, 1.25, deckle)} fill="none" stroke={color} strokeWidth={sw}
        strokeLinejoin="round" opacity="0.9" />
      <path d={roughPath(w, h, seed + 977, 1.6, deckle)} fill="none" stroke={color}
        strokeWidth={sw * 0.6} strokeLinejoin="round" opacity="0.45" />
    </svg>
  )
}

/* ---------- hold glyphs: seven ink marks, so the board is scannable ---------- */
const GLYPHS: Record<string, string> = {
  'jug': 'M3,8 Q12,3 21,8 Q21,15 14,13 Q8,11.5 3,14 Z',
  'crimp': 'M3,10 H21 M3,10 Q12,13.5 21,10',
  'sharp crimp': 'M3,11 H21 M5,11 l1.6,-3.4 M9.2,11 l1.6,-3.4 M13.4,11 l1.6,-3.4 M17.6,11 l1.6,-3.4',
  'sloper': 'M2.5,17 Q12,4 21.5,17',
  'pinch': 'M7,4 V20 M17,4 V20 M7,9 Q12,11.5 17,9 M7,15 Q12,12.5 17,15',
  'pocket': 'M12,5 A7,7 0 1,1 11.9,5 M9.5,10.5 h0.01 M14.5,10.5 h0.01',
  'crux': 'M12,2.5 L14.2,9.8 L21.5,12 L14.2,14.2 L12,21.5 L9.8,14.2 L2.5,12 L9.8,9.8 Z',
  'foothold': 'M4,13 H20 M4,13 V16.5 H20 V13',
  'smear edge': 'M3,17.5 L21,10 M14,10 H21 V15',
  'chip': 'M8.5,14 h7 M9.6,14 l1.4,-2.6 M14.4,14 l-1.4,-2.6',
  'blank': 'M3,12 H21',
}
/* ---------- CARD-4: family marks. 227 cards rendered identically; a hand
   should be scannable without reading it. Shape, not colour (A11Y-1). ---- */
const FAMILY: Record<string, { d: string; label: string }> = {
  hand:  { label: 'hand move',  d: 'M5,15 V9 M9,15 V6.5 M13,15 V6.5 M17,15 V9 M4,15 H18 M4,15 Q11,19 18,15' },
  feet:  { label: 'foot move',  d: 'M7,5 V13 Q7,15 9,15 H17 L19,19 H6.5 Q5,19 5,17 V5 Z' },
  rest:  { label: 'rest',       d: 'M12,3 V11 M8.5,7 Q12,3.5 15.5,7 M12,11 Q7.5,15.5 12,21 Q16.5,15.5 12,11 Z' },
  mind:  { label: 'technique',  d: 'M12,4.5 A7.5,7.5 0 1,1 11.9,4.5 M8.5,12 Q12,8 15.5,12 Q12,16 8.5,12' },
  clip:  { label: 'protection', d: 'M9.5,4 Q5,4 5,9.5 V15 Q5,20 9.5,20 H12.5 Q17,20 17,15 V9.5 Q17,4 12.5,4 M12.5,4 L16,7.5' },
  beta:  { label: 'beta',       d: 'M7,4 H14.5 L18,7.5 V20 H7 Z M14.5,4 V7.5 H18 M9.5,11 H15 M9.5,15 H15' },
  curse: { label: 'curse',      d: 'M13,3 L9,10.5 L14.5,12.5 L10,21' },
}
function Fam({ c, size = 15 }: { c: Card; size?: number }) {
  const f = FAMILY[familyOf(c)]
  if (!f) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
      style={{ position: 'absolute', top: 5, right: 5, opacity: 0.6 }}>
      <path d={f.d} fill="none" stroke="var(--ink)" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Glyph({ name, size = 22, color = 'var(--ink)' }:
  { name: string; size?: number; color?: string }) {
  const d = GLYPHS[name]
  if (!d) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
      style={{ flex: '0 0 auto', opacity: 0.85 }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.7"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ---------- hand-lettered wordmark: jittered type, not a webfont ---------- */
function Lettered({ t, seed = 5 }: { t: string; seed?: number }) {
  return (
    <span className="lett">
      {Array.from(t).map((ch, i) => ch === ' '
        ? <span key={i} style={{ display: 'inline-block', width: '0.32em' }} />
        : <span key={i} style={{
          display: 'inline-block',
          transform: `rotate(${(jit(seed * 13 + i) * 2.4).toFixed(2)}deg) translateY(${(jit(seed * 29 + i) * 1.2).toFixed(2)}px)`,
        }}>{ch}</span>)}
    </span>
  )
}
function InkRule({ seed = 3, color = 'var(--fade)' }: { seed?: number; color?: string }) {
  const f = (n: number) => n.toFixed(1)
  let d = `M2,${f(4 + jit(seed) * 1.4)}`
  for (let i = 1; i <= 8; i++)
    d += ` Q${f(i * 44 - 22)},${f(4 + jit(seed * 7 + i) * 2)} ${f(i * 44)},${f(4 + jit(seed * 11 + i) * 1.4)}`
  return (
    <svg className="inkrule" viewBox="0 0 356 8" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}

/** The route as a topo line in the margin, which is the whole art pitch. */
function Topo({ cleared, total, seed }: { cleared: number; total: number; seed: number }) {
  const W = 360, H = 34, step = W / (total + 1)
  const pts: [number, number][] = []
  for (let i = 0; i < total; i++)
    pts.push([step * (i + 1), H / 2 + jit(seed * 17 + i) * 5])
  const f = (n: number) => n.toFixed(1)
  const seg = (from: number, to: number) => {
    if (to <= from) return ''
    let d = `M${f(from === 0 ? 4 : pts[from - 1][0])},${f(from === 0 ? H / 2 : pts[from - 1][1])}`
    for (let i = from; i < to; i++) {
      const [x, y] = pts[i]
      const px = from === 0 && i === 0 ? 4 : pts[Math.max(0, i - 1)][0]
      const py = from === 0 && i === 0 ? H / 2 : pts[Math.max(0, i - 1)][1]
      d += ` Q${f((px + x) / 2 + jit(seed * 31 + i) * 4)},${f((py + y) / 2 + jit(seed * 37 + i) * 5)} ${f(x)},${f(y)}`
    }
    return d
  }
  return (
    <svg className="topo" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={seg(0, Math.max(1, cleared))} fill="none" stroke="var(--ink)" strokeWidth="2"
        strokeLinecap="round" opacity={cleared ? 0.85 : 0} />
      <path d={seg(Math.max(0, cleared - 1), total)} fill="none" stroke="var(--fade)"
        strokeWidth="1.5" strokeDasharray="4 5" strokeLinecap="round" opacity="0.75" />
      {pts.map(([x, y], i) => i < cleared
        ? <circle key={i} cx={x} cy={y} r="4.5" fill="var(--green)" stroke="var(--ink)" strokeWidth="1.2" />
        : <circle key={i} cx={x} cy={y} r="4" fill="var(--paper)" stroke="var(--fade)" strokeWidth="1.4" />)}
      <path d={`M${f(W - 8)},${f(H / 2 - 6)} L${f(W - 2)},${f(H / 2 + 6)} M${f(W - 2)},${f(H / 2 - 6)} L${f(W - 8)},${f(H / 2 + 6)}`}
        stroke="var(--red)" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
    </svg>
  )
}

/* A11Y-1: offence is a DIAMOND, defence is a CIRCLE. Shape carries the
   meaning, so the readout survives red-green colour vision deficiency —
   roughly 8% of men — with colour as a secondary cue only. */
/* RUN-8. The map was a vertical list of buttons, which is the one thing the v0
   art direction said it would never be: "hand-drawn topo lines", "every screen
   torn from the journal". This is the act as a page of the guidebook — contours
   in ink, the drainage running out to the road at the bottom, the wall at the
   top, and the nine stages climbing up the page rather than sitting at index 8
   of an array. The line behind you is drawn in solid, using the trail UX-16
   started keeping; the stage ahead is dashed. The list underneath is still how
   you choose, because tapping a 9px ink mark on a phone is not a control. */
function ActMap({ act, tier, total, trail, seed, label }: {
  act: number; tier: number; total: number; trail: string[]; seed: number; label: string
}) {
  const pts = mapPoints(total, seed)
  const contours = mapContours(act, seed)
  const cliff = mapCliff(seed)
  const line = (from: number, to: number) => pts.slice(from, to + 1)
    .map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const mark = (note: string) =>
    /camp/.test(note) ? '\u25b2' : /post/.test(note) ? '\u25aa'
    : /flashed|sent|topped|put up/.test(note) ? '\u2605'
    : /off |failed/.test(note) ? '\u00d7' : '\u00b7'
  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} width="100%" role="img"
      aria-label={`${label}. Stage ${tier + 1} of ${total}. ${trail.length} stages behind you.`}
      style={{ display: 'block', marginTop: 4 }}>
      {/* the ground: arcs that bulge uphill and narrow toward the wall */}
      {contours.map((c, k) => (
        <path key={k} d={c.d} fill="none" stroke="var(--fade)" strokeWidth={0.8} opacity={0.45} />
      ))}
      {/* the wall, drawn the way a guidebook draws one */}
      <path d={cliff.d} fill="none" stroke="var(--ink)" strokeWidth={1.4} />
      {cliff.ticks.map(([x, y], k) => (
        <line key={k} x1={x} y1={y} x2={x} y2={y - 7} stroke="var(--ink)" strokeWidth={0.9} />
      ))}
      <text x={MAP_W / 2} y={MAP_TOP - 20} textAnchor="middle" fontSize={7.5}
        fill="var(--ink)" style={{ letterSpacing: 1.4 }}>{ACT_TERRAIN[Math.min(act, 2)]}</text>
      <text x={MAP_W / 2} y={MAP_BOT + 20} textAnchor="middle" fontSize={7.5}
        fill="var(--fade)" style={{ letterSpacing: 1.4 }}>THE ROAD</text>
      {/* behind you in ink, the next stage dashed, the rest of the act faint */}
      {tier > 0 ? <path d={line(0, tier)} fill="none" stroke="var(--ink)" strokeWidth={1.7} /> : null}
      {tier + 1 < total ? (
        <path d={line(tier, tier + 1)} fill="none" stroke="var(--tan)"
          strokeWidth={1.5} strokeDasharray="5 4" />) : null}
      {tier + 2 < total ? (
        <path d={line(tier + 1, total - 1)} fill="none" stroke="var(--fade)"
          strokeWidth={1} opacity={0.5} strokeDasharray="2 5" />) : null}
      {pts.map(([x, y], i) => {
        const done = i < tier, here = i === tier
        const note = trail[i] ?? ''
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={here ? 6 : 3.4}
              fill={here ? 'var(--red)' : done ? 'var(--ink)' : 'var(--paper)'}
              stroke={done || here ? 'none' : 'var(--fade)'} strokeWidth={1.2} />
            {here ? (
              <text x={x + 11} y={y + 3} fontSize={8.5} fill="var(--red)"
                style={{ fontWeight: 700, letterSpacing: 0.5 }}>YOU</text>
            ) : done ? (
              <text x={x + 6} y={y - 1} fontSize={8.5} fill="var(--fade)">{mark(note)}</text>
            ) : (
              <text x={x + 6} y={y + 3} fontSize={7} fill="var(--fade)">{i + 1}</text>
            )}
          </g>)
      })}
    </svg>
  )
}

function Pips({ o, d, hi }: { o: number; d: number; hi?: number }) {
  return (
    <div className="pips">
      <div className="pip o" title="Power"><span>{o}</span></div>
      {/* a hold you have not worked reads as a span — ENG-10 */}
      <div className="pip d" title={hi === undefined ? 'Grip' : 'Grip — you have not been on this'}>
        {hi === undefined ? d : <span style={{ fontSize: '0.82em' }}>{d}–{hi}</span>}
      </div>
    </div>
  )
}

export default function App() {
  const [st, setSt] = useState<GameState>(() => {
    const slot = activeSlot()
    return { ...freshRun(0, 0, (Date.now() & 0x7fffffff) >>> 0), slot, ...loadGame(slot) }
  })
  const [io, setIo] = useState({ code: '', msg: '' })
  const [showPractice, setShowPractice] = useState(false)
  const [campMode, setCampMode] = useState<'rest' | 'sharpen' | 'cut'>('rest')
  const [sheet, setSheet] = useState(false)
  /* A11Y-3. Thirty-five things in this file were tappable divs: not focusable,
     not announced, and unreachable without a pointer. This gives one the
     behaviour of a button without restructuring the markup around it. */
  const tap = (fn: () => void, label?: string) => ({
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': label,
    onClick: fn,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() }
    },
  })
  /* VIS-3: the conditions are on the paper, not just in a word. Only while you
     are actually out on something — a menu has no weather. */
  const onRock = st.phase === 'climb' || st.phase === 'burnEnd'
    || st.phase === 'line' || st.phase === 'sessionEnd'
  const skin = `wrap${st.cbSafe ? ' cb' : ''}${st.motion ? '' : ' nomo'}` +
    `${st.textScale ? ` fs${st.textScale}` : ''}` +
    `${onRock ? ` wx-${WEATHER[st.weather].name.replace(/ /g, '')}` : ''}`
  const [seedIn, setSeedIn] = useState('')
  // UX-14: fifteen slots out of up to 219 owned cards, and no way to find one
  const [deckFind, setDeckFind] = useState('')
  const [deckOnly, setDeckOnly] = useState<'all' | 'hands' | 'feet' | 'technique' | 'mine'>('all')
  /* UX-7. Placements are pure — they move a card between hand and board and
     consume no randomness — so taking one back is just restoring the previous
     object. Anything that reveals hidden information (a card that draws)
     closes the stack, because otherwise undo becomes a way to look at your
     deck and then change your mind. */
  const [undo, setUndo] = useState<GameState[]>([])
  const [pending, setPending] = useState<{ routeIdx: number; nodeIdx: number } | null>(null)
  const [claim, setClaim] = useState<{ name: string; grade: number } | null>(null)
  const [takeTwo, setTakeTwo] = useState<number[]>([])
  // a typed seed wins for the next run; otherwise roll on from the last one
  const pickSeed = () => codeSeed(seedIn) ?? ((st.seed * 1664525 + 1013904223) >>> 0)
  const spec = specOf(st)
  // save at every safe point. Never mid-climb.
  useEffect(() => {
    if (st.phase === 'menu' || st.phase === 'map' || st.phase === 'reward'
      || st.phase === 'camp' || st.phase === 'runEnd' || st.phase === 'sessionEnd') saveGame(st)
  }, [st.phase, st.tier, st.level, st.xp, st.owned.length, st.skin])
  const weather = WEATHER[st.weather], rock = ROCK[st.rock]
  const sel = useMemo(() => st.piles.hand.find(c => c.uid === st.selected) ?? null,
    [st.piles.hand, st.selected])
  const remaining = Math.max(0, spec.clear - st.cleared)
  const tip = st.phase === 'climb' ? coach(st) : null
  const phase = st.phase === 'climb' ? phaseOf(st) : null
  // one preview per render, shared by both boards and the commit readout
  const lanes = useMemo(() => st.phase === 'climb'
    ? [0, 1, 2].map(i => previewLane(st, i)) : null, [st])
  const pumpAfter = useMemo(() => lanes ? previewPump(st, lanes) : st.pump, [st, lanes])

  function tapHandCard(c: Card) {
    if (st.phase !== 'climb') return
    sfx(st.selected === c.uid ? 'tap' : 'lift', st.sound)
    if (c.kind === 'bonus' && !c.targeted) { playBonus(c, -1); return }
    setSt(s => ({ ...s, selected: s.selected === c.uid ? null : c.uid }))
  }
  function playBonus(c: Card, lane: number) {
    // SIM-5: the rules live in the engine. This keeps only what a screen owns —
    // the undo stack, and the seed advancing.
    const rng = new RNG(st.seed)
    setUndo([])   // a technique card can draw, and you cannot un-see a card
    setSt(s => ({ ...playBonusStep(s, c, lane, rng), seed: rng.s }))
  }

  function tapLane(i: number) {
    if (st.phase !== 'climb') return
    if (!sel) {
      const placed = st.boardP[i]
      if (placed) setSt(s => ({ ...s, boardP: s.boardP.map((c, k) => k === i ? null : c),
        piles: { ...s.piles, hand: [...s.piles.hand, placed] } }))
      return
    }
    if (sel.kind === 'bonus') {
      if (sel.gripCut && !st.boardH[i]) return
      if (sel.power && !st.boardP[i]) return
      playBonus(sel, i); return
    }
    const isFeet = i === 2
    if (sel.lane === 'hand' && isFeet) return
    if (sel.lane === 'feet' && !isFeet) return
    if (phaseOf(st)?.lockLane === i) return
    if (st.boardP[i]) return
    sfx(sel.shed > 0 ? 'rest' : 'place', st.sound)
    setUndo(u => [...u.slice(-3), st])
    // ENG-18: the order you place is the order they resolve
    const order = [...st.order.filter(k => k !== i), i]
    setSt(s => ({ ...s, boardP: s.boardP.map((c, k) => k === i ? sel : c),
      order, piles: pileFromHand(s.piles, sel.uid), selected: null }))
  }
  function commit() {
    setUndo([])
    const rng = new RNG(st.seed)
    const next = resolve(st, rng)
    sfx('commit', st.sound); buzz(12, st.sound)
    // stagger the outcome so the trade reads as a sequence, not a jump cut
    if (next.fxLane.includes('clear')) window.setTimeout(() => sfx('clear', st.sound), 150)
    if (next.fxLane.includes('blow')) window.setTimeout(() => sfx('blow', st.sound), 190)
    if (next.phaseSeen !== st.phaseSeen && next.phaseSeen) {
      window.setTimeout(() => sfx('phase', st.sound), 240); buzz([0, 25, 40, 25], st.sound)
    }
    if (next.result === 'fall') { window.setTimeout(() => sfx('fall', st.sound), 300); buzz([0, 40, 60, 90], st.sound) }
    if (next.result === 'send') { window.setTimeout(() => sfx('send', st.sound), 220); buzz([0, 30, 40, 30, 40, 80], st.sound) }
    setSt({ ...next, seed: rng.s })
  }
  function bail() {
    setSt(s => {
      if (!s.inRun) return { ...s, phase: 'sessionEnd', result: 'bail' }
      const psyche = Math.max(0, s.psyche - PSYCHE_BAIL - (exposed(s) ? EXPOSED_PSYCHE : 0))
      const last = s.tier + 1 >= ACTS[s.act].length
      return last || psyche <= 0
        ? recordRun({ ...s, psyche, phase: 'runEnd', result: 'fall' }, false)
        : { ...s, psyche, phase: 'map', tier: s.tier + 1, result: 'bail' }
    })
  }
  function afterBurn() {
    if (specOf(st).tutorial) {
      const rng0 = new RNG(st.seed)
      const done = gainXp({ ...st, tutorialDone: true, runDeck: [] }, 20, rng0)
      setSt({ ...done, seed: rng0.s, phase: done.packCards.length ? 'pack' : 'menu',
        afterPack: 'menu', skirmish: null, log: [] })
      return
    }
    const rng = new RNG(st.seed)
    const beta = Array.from(new Set([...st.beta, ...st.worked]))
    if (st.result === 'send') { setSt({ ...endSession({ ...st, beta }, rng), seed: rng.s }); return }
    setSt(s => ({ ...s, falls: s.falls + 1 }))
    // gear can eat the first fall on a boulder
    const freeFall = st.onProject
      || (st.inRun && gearMods(st.gear).skinSave > 0 && st.burn === 1)
    // ENG-13: coming off high on the route costs more than coming off low
    const skin = st.skin - (freeFall ? 0 : 1 + boonMods(st.boons).dFallSkin)
    // coming off high is demoralising rather than flesh-destroying
    const psyche = Math.max(0, st.psyche - (exposed(st) ? EXPOSED_FALL_PSYCHE : 0))
    if (st.burn >= attemptsFor(st) || skin <= 0) {
      setSt({ ...endSession({ ...st, beta, skin, psyche }, rng), seed: rng.s }); return
    }
    setSt({ ...startBurn({ ...st, beta, skin, psyche, burn: st.burn + 1 }, rng), seed: rng.s })
  }
  function startClimb(routeIdx: number, nodeIdx = -1, line = 0) {
    const rng = new RNG(st.seed)
    const f = nodeIdx >= 0 ? forecastFor(st)[nodeIdx] : null
    const weather = f ? f.weather : rng.int(WEATHER.length)
    const rock = f ? f.rock : rng.int(ROCK.length)
    const next = startBurn({ ...st, routeIdx, skirmish: null, onProject: false, weather, rock,
      line, burn: 1, beta: [], worked: [] }, rng)
    // write the "you abandoned it" state now, so quitting mid-climb costs the
    // node rather than letting you reroll a bad start
    if (st.inRun) saveGame({ ...next, tier: st.tier + 1 })
    setSt({ ...next, seed: rng.s })
  }
  function startLostLine() {
    if (st.inRun && st.runDeck.length) { setSt(s => ({ ...s, phase: 'map' })); return }
    if (!archUnlocked(ARCHETYPES[st.arch], st.level)) return
    const r = newRun(pickSeed(), st.loadouts[st.arch], st.style, st.arch, st.mutators)
    setSt({ ...r, ...carryOver(st), runs: st.runs + 1 })
  }
function startTutorial() {
    const idx = ROUTES.findIndex(r => r.tutorial)
    const rng = new RNG(st.seed)
    const next = startBurn({ ...st, routeIdx: idx, skirmish: null, inRun: false, onProject: false,
      runDeck: TUTORIAL_DECK.map(spawn), skin: SKIN_MAX, burn: 1, beta: [], worked: [],
      weather: 1, rock: 0 }, rng)
    setSt({ ...next, seed: rng.s })
  }
  function startCircuit() {
    const seed = pickSeed()
    const rng = new RNG(seed)
    const base: GameState = { ...st, seed, runSeed: seed, circuit: true, circuitScore: 0, inRun: false,
      onProject: false, tier: 0, act: 0, gear: [], cash: 0, psyche: PSYCHE_MAX,
      skin: RUN_SKIN, runDeck: loadoutDeck(st.loadouts[st.arch]),
      skirmish: circuitRoute(0, rng), burn: 1, beta: [], worked: [],
      weather: rng.int(WEATHER.length), rock: rng.int(ROCK.length) }
    setSt({ ...startBurn(base, rng), seed: rng.s })
  }
  function nextCircuitLine() {
    const rng = new RNG(st.seed)
    const next = startBurn({ ...st, burn: 1, beta: [], worked: [],
      weather: rng.int(WEATHER.length), rock: rng.int(ROCK.length) }, rng)
    setSt({ ...next, seed: rng.s })
  }
  function startSkirmish() {
    const rng = new RNG(st.seed)
    const route = skirmishRoute(st.level, rng)
    const next = startBurn({ ...st, skirmish: route, inRun: false, tier: 0,
      runDeck: loadoutDeck(st.loadouts[st.arch]), skin: SKIN_MAX, burn: 1, beta: [], worked: [],
      weather: rng.int(WEATHER.length), rock: rng.int(ROCK.length) }, rng)
    setSt({ ...next, seed: rng.s })
  }
  /* SKIRM-2: the same problem for everybody, seeded off the date. The whole
     run is deterministic from that one number — conditions, holds, the wobble
     on each of them, the draw — so two people on the same day are on the same
     rock. One go. */
  function startDaily() {
    const key = dayKey()
    if (st.dailyDay === key) return          // you have had your go
    const rng = new RNG(dailySeed(key))
    const route = dailyRoute(key)
    const next = startBurn({ ...st, skirmish: route, inRun: false, tier: 0, daily: true,
      runDeck: loadoutDeck(st.loadouts[st.arch]), skin: SKIN_MAX, burn: 1, beta: [], worked: [],
      weather: rng.int(WEATHER.length), rock: rng.int(ROCK.length) }, rng)
    setSt({ ...next, seed: rng.s })
  }
  const setMine = (s: GameState, list: string[]) =>
    ({ ...s, loadouts: s.loadouts.map((l, i) => i === s.arch ? list : l) })
  function addCard(name: string) {
    setSt(s => {
      const cur = s.loadouts[s.arch]
      if (cur.length >= DECK_SIZE) return s
      const r = CARDS[name].rarity ?? 'common'
      if (cur.filter(n => n === name).length >= copyLimit(r)) return s
      if (r === 'rare' && slotsUsed(cur, 'rare') >= RARE_SLOTS) return s
      if (r === 'uncommon' && slotsUsed(cur, 'uncommon') >= UNCOMMON_SLOTS) return s
      return setMine(s, [...cur, name])
    })
  }
  function dropCard(name: string) {
    setSt(s => {
      const cur = s.loadouts[s.arch]
      const i = cur.lastIndexOf(name)
      return i < 0 ? s : setMine(s, cur.filter((_, k) => k !== i))
    })
  }
  /* UX-8. Every browsing screen knows where it came from, so BACK goes up one
     level rather than all the way out — and the Android back button does the
     same thing instead of closing the app. */
  const BACK_TO: Partial<Record<Phase, Phase>> = {
    prepare: 'menu', more: 'menu', deck: 'prepare',
    collection: 'more', logbook: 'more', journal: 'more', stats: 'more',
    glossary: 'more', saves: 'more', history: 'more',
  }
  const goBack = () => setSt(s => ({ ...s, phase: BACK_TO[s.phase] ?? 'menu',
    skirmish: s.phase in BACK_TO ? s.skirmish : null }))
  useEffect(() => {
    const onPop = () => { setSt(s => BACK_TO[s.phase]
      ? { ...s, phase: BACK_TO[s.phase]! } : s) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  useEffect(() => {
    // one history entry per level, so the hardware back button has something
    // to pop instead of leaving the page
    if (BACK_TO[st.phase]) { try { history.pushState({ p: st.phase }, '') } catch { /* no history */ } }
  }, [st.phase])

  const toMenu = () => setSt(s => ({ ...s, phase: 'menu', skirmish: null, result: null,
    log: [], runDeck: s.inRun ? s.runDeck : [] }))
  function takeNode(n: MapNode, i = -1) {
    if (n.type === 'camp') { setCampMode('rest'); setSt(s => ({ ...s, phase: 'camp' })); return }
    if (n.type === 'project') {
      if (st.skin <= 1) return
      const rng = new RNG(st.seed)
      const f = forecastFor(st)[i]
      const next = startBurn({ ...st, routeIdx: n.routeIdx, skirmish: null, onProject: true,
        skin: st.skin - PROJECT_SKIN, weather: f ? f.weather : rng.int(WEATHER.length),
        rock: f ? f.rock : rng.int(ROCK.length), burn: 1, beta: [], worked: [] }, rng)
      if (st.inRun) saveGame({ ...next, tier: st.tier + 1 })
      setSt({ ...next, seed: rng.s })
      return
    }
    if ((n.type === 'climb' || n.type === 'boss') && lineCanVary(ROUTES[n.routeIdx])) {
      setPending({ routeIdx: n.routeIdx, nodeIdx: i })
      setSt(x => ({ ...x, phase: 'line' }))
      return
    }
    if (n.type === 'established') {
      const e = establishedIn(st, st.act)[n.routeIdx]
      if (!e) return
      const rng = new RNG(st.seed)
      const f = forecastFor(st)[i]
      const next = startBurn({ ...st, skirmish: specFromEstablished(e), onProject: false, line: 0,
        burn: 1, beta: [], worked: [],
        weather: f ? f.weather : rng.int(WEATHER.length),
        rock: f ? f.rock : rng.int(ROCK.length) }, rng)
      if (st.inRun) saveGame({ ...next, tier: st.tier + 1 })
      setSt({ ...next, seed: rng.s })
      return
    }
    if (n.type === 'fa') {
      const rng = new RNG(st.seed)
      const spec = faRoute(st.act, new RNG(st.seed ^ (i * 7919) ^ (st.tier * 104729)))
      const next = startBurn({ ...st, skirmish: spec, onProject: false, line: 0,
        burn: 1, beta: [], worked: [], weather: rng.int(WEATHER.length),
        rock: rng.int(ROCK.length) }, rng)
      if (st.inRun) saveGame({ ...next, tier: st.tier + 1 })
      setSt({ ...next, seed: rng.s })
      return
    }
    if (n.type === 'shop') {
      if (!postOpen(st)) return          // you have already been through it
      const rng = new RNG(st.seed)
      setSt({ ...stockShop(st, rng), seed: rng.s })
      return
    }
    if (n.type === 'event') {
      const rng = new RNG(st.seed)
      const ev = rollEvent(rng, st.act, st.eventsSeen, st.eventChose)
      setSt(s => ({ ...s, eventId: ev.id, eventResult: null, phase: 'event', seed: rng.s }))
      return
    }
    startClimb(n.routeIdx, i)
  }
  function chooseEvent(ci: number) {
    const ev = EVENTS.find(e => e.id === st.eventId)
    if (!ev) return
    const rng = new RNG(st.seed)
    const next = applyOutcome(st, ev.choices[ci].outcome, rng)
    // EVT-4: record WHICH branch, not just that the event happened
    setSt({ ...next, seed: rng.s,
      eventChose: [...new Set([...next.eventChose, `${ev.id}:${ci}`])] })
  }
  function leaveEvent() { setSt(s => leaveEventStep(s)) }
  function takeOffer(c: Card | null) { setSt(s => takeOfferStep(s, c)) }

  /* The menu asks one question — what are you doing — and puts setup and
     everything else behind one door each. It had grown to twenty controls. */
  if (st.phase === 'menu') {
    const need = xpToNext(st.level), pct = Math.min(100, Math.round(100 * st.xp / need))
    const resume = st.inRun && st.runDeck.length
    return (
      <div className={skin}>
        <div className="row">
          <span className="h1" style={{ fontSize: 26, letterSpacing: '.5px' }}>
            <Lettered t="SANDBAGGED" seed={5} /></span>
          <span className="big" style={{ color: 'var(--red)' }}>LV {st.level}</span></div>
        <InkRule seed={9} color="var(--ink)" />
        <div className="bar" style={{ height: 10 }}>
          {Array.from({ length: 20 }, (_, i) => (
            <div key={i} className={`seg${i * 5 < pct ? ' on' : ''}`} />))}
        </div>
        <div className="row" style={{ marginTop: 2 }}>
          <span className="sub">{st.xp}/{need} xp</span>
          <span className="sub">{st.sends} sends · {st.wins} wins</span>
        </div>

        {!st.tutorialDone ? (
          <>
            <button className="btn go" style={{ width: '100%', padding: 14, marginTop: 12 }}
              onClick={startTutorial}>FIRST TIME? START HERE ▸</button>
            <div className="sub" style={{ marginTop: 3 }}>
              One warm-up boulder, ten minutes from the car. It teaches as you go.</div>
          </>) : null}

        <div className="lbl" style={{ marginTop: 14 }}>CLIMB</div>
        <button className="btn go" style={{ width: '100%', padding: 14, marginTop: 5 }}
          disabled={!archUnlocked(ARCHETYPES[st.arch], st.level)} onClick={startLostLine}>
          {resume ? 'CONTINUE THE LOST LINE ▸' : 'THE LOST LINE ▸'}</button>
        <div className="sub" style={{ marginTop: 2, marginBottom: 9 }}>
          {resume
            ? `${ACT_NAMES[st.act]} · stage ${st.tier + 1}/${ACTS[st.act].length} · skin ${st.skin} · psyche ${st.psyche}`
            : 'The full expedition. Three acts, about half an hour.'}</div>

        {/* SKIRM-2: the same problem for everyone, once a day */}
        {/* INJ-1: carried between trips, and there is nothing to be done about it */}
        {st.tweak ? (
          <div className="spot" style={{ borderLeftColor: 'var(--red)' }}>
            <b style={{ color: 'var(--red)' }}>CARRYING SOMETHING</b>
            {st.tweak.text} {st.tweak.hold} holds are +{TWEAK_GRIP} Grip
            for {st.tweak.runs} more {st.tweak.runs === 1 ? 'trip' : 'trips'}.
            Nothing to be done about it — no camp, no shop, no gear. It goes when it goes.
          </div>) : null}
        {(() => {
          const done = st.dailyDay === dayKey()
          const r = dailyRoute()
          return (
            <>
              <button className={`btn${done ? '' : ' go'}`} style={{ width: '100%', padding: 13 }}
                disabled={done} onClick={startDaily}>
                {done ? `TODAY'S PROBLEM — DONE · ${st.dailyScore}` : "TODAY'S PROBLEM ▸"}</button>
              <div className="sub" style={{ marginTop: 2, marginBottom: 9 }}>
                {r.name} · {gradeText(r.grade, st.grades)} · {r.clear} holds.
                {done
                  ? ` You scored ${st.dailyScore}. Back tomorrow.`
                  : ' One go. Everybody in the world is on this one today.'}
                {st.dailyStreak > 1 ? ` ${st.dailyStreak} days running.` : ''}
                {st.dailyBest > 0 ? ` Best ${st.dailyBest}.` : ''}</div>
            </>)
        })()}

        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn" style={{ flex: 1, padding: 13 }} onClick={startSkirmish}>THE FA</button>
          <button className="btn" style={{ flex: 1, padding: 13 }} onClick={startCircuit}>THE CIRCUIT</button>
        </div>
        <div className="row" style={{ marginTop: 2 }}>
          <span className="sub">one climb at your level</span>
          <span className="sub">endless{st.bestCircuit ? ` · best ${st.bestCircuit}` : ''}</span>
        </div>

        <div className="lbl" style={{ marginTop: 14 }}>BEFORE YOU GO</div>
        <button className="btn" style={{ width: '100%', padding: 12, marginTop: 5 }}
          onClick={() => setSt(x => ({ ...x, phase: 'prepare' }))}>
          {ARCHETYPES[st.arch].name.toUpperCase()} · {st.topRope ? 'TOPROPE' : ASCENT[st.style].name.toUpperCase()}
          {st.mutators.length ? ` · +${mutMods(st.mutators).xp}%` : ''} ▸</button>
        <div className="sub" style={{ marginTop: 2 }}>
          climber, ascent style, loadout, seed</div>

        <button className="btn" style={{ width: '100%', padding: 12, marginTop: 10 }}
          onClick={() => setSt(x => ({ ...x, phase: 'more' }))}>THE BOOKS & SETTINGS ▸</button>
        <div className="center sub" style={{ marginTop: 14 }}>v9.41 · RCJ Labs</div>
        <style>{CSS}</style>
      </div>
    )
  }

  if (st.phase === 'prepare') {
    const total = Object.keys(CARDS).length
    return (
      <div className={skin}>
        <div className="row"><span className="h1"><Lettered t="BEFORE YOU GO" seed={13} /></span>
          <button className="btn" style={{ padding: '5px 10px', fontSize: 11 }} onClick={goBack}>◂ BACK</button></div>
        <InkRule seed={41} color="var(--ink)" />

        <div className="lbl" style={{ marginTop: 8 }}>CLIMBER</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
          <button className="btn" style={{ padding: '7px 12px' }} disabled={st.arch <= 0}
            onClick={() => setSt(x => ({ ...x, arch: Math.max(0, x.arch - 1) }))}>◂</button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div className="big">{ARCHETYPES[st.arch].name}</div>
            <div className="sub" style={{ color: 'var(--red)' }}>
              {archUnlocked(ARCHETYPES[st.arch], st.level)
                ? `${ARCHETYPES[st.arch].sig} · ${ARCHETYPES[st.arch].sigText}`
                : `Locked — reach level ${ARCHETYPES[st.arch].unlock}.`}</div>
          </div>
          <button className="btn" style={{ padding: '7px 12px' }}
            disabled={st.arch >= ARCHETYPES.length - 1}
            onClick={() => setSt(x => ({ ...x, arch: Math.min(ARCHETYPES.length - 1, x.arch + 1) }))}>▸</button>
        </div>
        <div className="sub" style={{ marginTop: 3 }}>{ARCHETYPES[st.arch].text}</div>

        <div className="row" style={{ marginTop: 12 }}>
          <span className="lbl">MAKE IT HARDER</span>
          <span className="lbl" style={{ color: st.mutators.length ? 'var(--green)' : 'var(--fade)' }}>
            {Math.round(xpMult(st.mutators) * 100)}% XP</span>
        </div>
        <div className="sub" style={{ marginBottom: 4 }}>
          Stack as many as you like. They pay in experience.</div>
        {MUTATORS.map(m => {
          const on = st.mutators.includes(m.id)
          return (
            <div key={m.id} className="deckrow"
              style={{ opacity: on ? 1 : 0.55 }}
              {...tap(() => setSt(x => ({ ...x,
                mutators: on ? x.mutators.filter(i => i !== m.id) : [...x.mutators, m.id] })))}>
              <span className="cnt" style={{ color: on ? 'var(--green)' : 'var(--fade)' }}>
                {on ? '✓' : '·'}</span>
              <div className="nmx">
                <div className="t1">{m.name} <span style={{ color: 'var(--tan)' }}>+{m.xp}%</span></div>
                <div className="t2">{m.text}</div>
              </div>
            </div>)
        })}

        <div className="lbl" style={{ marginTop: 12 }}>THE ROPE</div>
        <button className={`btn${st.topRope ? ' go' : ''}`} style={{ width: '100%', padding: 11, marginTop: 4 }}
          onClick={() => setSt(x => ({ ...x, topRope: !x.topRope }))}>
          {st.topRope ? 'ON A TOPROPE' : 'LEADING'}</button>
        <div className="sub" style={{ marginTop: 3 }}>
          {st.topRope
            ? `+${TOPROPE_SKIN} skin and every hold bites one less. It is the way to learn a route — but a topropeed ascent does not count for style.`
            : 'The full weight of it. Sending the campaign unlocks the next ascent style.'}</div>

        <div className="lbl" style={{ marginTop: 12 }}>ASCENT STYLE</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
          <button className="btn" style={{ padding: '7px 12px' }} disabled={st.style <= 0}
            onClick={() => setSt(x => ({ ...x, style: Math.max(0, x.style - 1) }))}>◂</button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div className="big">{ASCENT[st.style].name}</div>
            <div className="sub">{styleMods(st.style).text}</div>
          </div>
          <button className="btn" style={{ padding: '7px 12px' }} disabled={st.style >= st.styleMax}
            onClick={() => setSt(x => ({ ...x, style: Math.min(x.styleMax, x.style + 1) }))}>▸</button>
        </div>
        <div className="sub" style={{ marginTop: 3 }}>
          {st.styleMax >= ASCENT.length - 1 ? 'Every style unlocked.'
            : `Send the act to unlock ${ASCENT[st.styleMax + 1].name}.`}</div>

        <button className="btn" style={{ width: '100%', padding: 12, marginTop: 12 }}
          onClick={() => setSt(x => ({ ...x, phase: 'deck' }))}>
          LOADOUT · {st.loadouts[st.arch].length}/{DECK_SIZE} cards ▸</button>
        <div className="sub" style={{ marginTop: 2 }}>
          {st.owned.length}/{total} cards collected</div>

        <div className="row" style={{ marginTop: 12 }}>
          <span className="lbl">SEED</span>
          {st.runSeed ? (
            <span className="lbl tap" {...tap(() => {
              try { void navigator.clipboard?.writeText(seedCode(st.runSeed)) } catch { /* blocked */ }
              setSeedIn(seedCode(st.runSeed))
            })}>LAST RUN · {seedCode(st.runSeed)} · TAP TO COPY</span>) : null}
        </div>
        <input value={seedIn} spellCheck={false} onChange={e => setSeedIn(e.target.value)}
          placeholder="blank for a fresh line, or paste a seed"
          style={{ width: '100%', marginTop: 4, fontSize: 11, fontFamily: 'inherit',
            background: '#f0eade', border: '1.5px solid var(--ink)', borderRadius: 2,
            padding: '7px 8px', color: 'var(--ink)' }} />

        <button className="btn go" style={{ width: '100%', marginTop: 14 }} onClick={goBack}>DONE</button>
        <style>{CSS}</style>
      </div>
    )
  }

  if (st.phase === 'more') {
    const total = Object.keys(CARDS).length
    const inAct = ROUTES.filter((_, i) => ACT_OF_ROUTE[i] !== undefined)
    const go = (ph: Phase) => () => setSt(x => ({ ...x, phase: ph }))
    const Item = ({ t, sub, on }: { t: string; sub: string; on: () => void }) => (
      <div className="menu-item" {...tap(on)}>
        <div className="row"><span className="big">{t}</span>
          <span className="sub">{sub}</span></div></div>)
    return (
      <div className={skin}>
        <div className="row"><span className="h1"><Lettered t="THE BOOKS" seed={19} /></span>
          <button className="btn" style={{ padding: '5px 10px', fontSize: 11 }} onClick={goBack}>◂ BACK</button></div>
        <InkRule seed={53} color="var(--ink)" />
        <div style={{ maxHeight: 620, overflowY: 'auto', marginTop: 6 }}>
          <Item t="Collection" sub={`${st.owned.length}/${total}`} on={go('collection')} />
          <Item t="Logbook" sub={`${inAct.filter(r => st.book[r.name]).length}/${inAct.length} ticked`}
            on={go('logbook')} />
          <Item t="The Journal" sub={`${st.journal.length}/${JOURNAL.length} pages`} on={go('journal')} />
          <Item t="The Numbers" sub="everything recorded" on={go('stats')} />
          <Item t="Every Trip" sub={st.history.length ? `last ${Math.min(st.history.length, HISTORY_MAX)} runs` : 'nothing yet'}
            on={go('history')} />
          <Item t="How It Works" sub="holds, keywords, marks" on={go('glossary')} />
          <Item t="Saves" sub={`slot ${st.slot + 1}`} on={() => { setIo({ code: '', msg: '' }); setSt(x => ({ ...x, phase: 'saves' })) }} />

          <div className="lbl" style={{ marginTop: 12 }}>SETTINGS</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
            <button className={`btn${st.coaching ? ' go' : ''}`} style={{ flex: 1, padding: 11 }}
              onClick={() => setSt(x => ({ ...x, coaching: !x.coaching }))}>
              SPOTTER {st.coaching ? 'ON' : 'OFF'}</button>
            <button className={`btn${st.sound ? ' go' : ''}`} style={{ flex: 1, padding: 11 }}
              onClick={() => { const on = !st.sound; if (on) sfx('lift', true); setSt(x => ({ ...x, sound: on })) }}>
              SOUND {st.sound ? 'ON' : 'OFF'}</button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button className={`btn${st.motion ? '' : ' go'}`} style={{ flex: 1, padding: 11 }}
              onClick={() => setSt(x => ({ ...x, motion: !x.motion }))}>
              MOTION {st.motion ? 'ON' : 'OFF'}</button>
            <button className="btn" style={{ flex: 1, padding: 11 }}
              onClick={() => setSt(x => ({ ...x, textScale: (x.textScale + 1) % 3 }))}>
              TEXT {['NORMAL', 'LARGE', 'LARGER'][st.textScale]}</button>
          </div>
          <button className={`btn${st.hints ? ' go' : ''}`} style={{ width: '100%', padding: 11, marginTop: 6 }}
            onClick={() => setSt(x => ({ ...x, hints: !x.hints }))}>
            DRAFT HINTS {st.hints ? 'ON' : 'OFF'}</button>
          <button className="btn" style={{ width: '100%', padding: 11, marginTop: 6 }}
            onClick={() => setSt(x => ({ ...x, grades: x.grades === 'v' ? 'font' : 'v' }))}>
            GRADES {st.grades === 'font' ? 'FONT' : 'V-SCALE'}</button>
          <div className="sub" style={{ marginTop: 3 }}>
            {st.grades === 'font'
              ? 'Fontainebleau. 6A, 7B+, 8A. What most of Europe writes in the book.'
              : 'Hueco. V3, V7, V11. What most of America writes in the book.'}</div>
          <div className="sub" style={{ marginTop: 3 }}>
            {st.hints ? 'A line or two on why a card fits, on the shelf and in the post.'
              : 'No hints. Work it out.'}</div>
          <button className={`btn${st.cbSafe ? ' go' : ''}`} style={{ width: '100%', padding: 11, marginTop: 6 }}
            onClick={() => setSt(x => ({ ...x, cbSafe: !x.cbSafe }))}>
            COLOUR-SAFE PALETTE {st.cbSafe ? 'ON' : 'OFF'}</button>

          <div className="lbl" style={{ marginTop: 12 }} {...tap(() => setShowPractice(!showPractice))}>
            PRACTICE {showPractice ? '▾' : '▸'}</div>
          {showPractice ? (
            <div style={{ marginTop: 5 }}>
              <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
                {DECKS.map((d, i) => (
                  <button key={d.label} className={`btn${st.deckTier === i ? ' go' : ''}`} style={{ flex: 1 }}
                    onClick={() => setSt(x => ({ ...x, deckTier: i }))}>{d.label}</button>))}
              </div>
              {ROUTES.slice(0, 10).map((r, i) => (
                <div key={r.name} className="menu-item" {...tap(() => {
                  setSt(x => ({ ...x, inRun: false, runDeck: [], skirmish: null }))
                  startClimb(i)
                })}>
                  <div className="row"><span className="big">{r.name}</span>
                    <span className="big" style={{ color: 'var(--red)' }}>{gradeLabel(r, st.grades)}</span></div>
                  <div className="sub">{r.style} · top out at {r.clear}</div>
                </div>))}
            </div>) : null}
        </div>
        <style>{CSS}</style>
      </div>
    )
  }

  if (st.phase === 'pack') return (
    <div className={skin}>
      <div className="h1">LEVEL {st.level}</div>
      <div className="sub">A pack for the effort. These are yours now.</div>
      <hr className="rule" />
      <div style={{ marginTop: 6 }}>
        {st.packCards.length ? st.packCards.map(c => (
          <div key={c.uid} className="menu-item">
            <div className="row"><span className="big">{c.name}</span>
              <span className="big" style={{ color: c.rarity === 'rare' ? 'var(--red)' : 'var(--fade)' }}>
                {c.rarity.toUpperCase()}</span></div>
            <div className="sub">
              {c.kind === 'move' ? `${c.power} / ${c.contact} · ` : `${c.cost} pump · `}{c.text}</div>
          </div>)) : <div className="sub">Nothing new this time.</div>}
      </div>
      <button className="btn go" style={{ width: '100%', marginTop: 8 }}
        onClick={() => setSt(s => ({ ...s, packCards: [], phase: s.afterPack }))}>
        INTO THE BOOK ▸</button>
      <style>{CSS}</style>
    </div>
  )

  if (st.phase === 'collection') {
    const tiers: Rarity[] = ['starter', 'common', 'uncommon', 'rare', 'curse']
    return (
      <div className={skin}>
        <div className="row"><span className="h1">COLLECTION</span>
          <span className="sub">{st.owned.length}/{Object.keys(CARDS).length}</span></div>
        <hr className="rule" />
        <div style={{ maxHeight: 640, overflowY: 'auto' }}>
          {tiers.map(t => (
            <div key={t}>
              <div className="lbl" style={{ marginTop: 8 }}>{t.toUpperCase()}</div>
              {BY_RARITY(t).map(n => {
                const c = CARDS[n]
                const have = t === 'starter' || st.owned.includes(n)
                return (
                  <div key={n} className="row" style={{ opacity: have ? 1 : 0.32, padding: '3px 0' }}>
                    <span style={{ fontSize: 12, fontWeight: have ? 700 : 400 }}>{have ? n : '???'}</span>
                    <span className="sub">{c.kind === 'move'
                      ? `${c.power ?? 0}/${c.contact ?? 0}` : `${c.cost ?? 0}p`}</span>
                  </div>)
              })}
            </div>))}
        </div>
        <button className="btn go" style={{ width: '100%', marginTop: 8 }} onClick={goBack}>◂ BOOKS</button>
        <style>{CSS}</style>
      </div>
    )
  }

  if (st.phase === 'map') {
    const own = establishedIn(st, st.act)
    // appended, never inserted: the forecast and every handler address a tier
    // by index, so anything added in the middle would shift them all
    const tier: MapNode[] = ACTS[st.act][st.tier].some(n => n.type === 'fa') && own.length
      ? [...ACTS[st.act][st.tier], ...own.slice(0, 2).map((_, k): MapNode =>
          ({ type: 'established', routeIdx: k }))]
      : ACTS[st.act][st.tier]
    const fc = forecastFor(st)
    return (
      <div className={skin}>
        <div className="row">
          <button className="btn" style={{ padding: '5px 10px', fontSize: 11 }}
            onClick={() => setSt(s => ({ ...s, phase: 'menu' }))}>◂ MENU</button>
          <span className="sub" style={{ fontWeight: 700 }}>
            <span style={{ color: 'var(--tan)' }}>${st.cash}</span>
            <span style={{ color: 'var(--red)' }}> · skin {st.skin}</span>
            <span style={{ color: st.psyche <= DOUBT_AT ? 'var(--red)' : 'var(--green)' }}>
              {' '}· psyche {st.psyche}</span>
          </span></div>
        <div className="h1" style={{ marginTop: 6 }}><Lettered t="THE LOST LINE" seed={17} /></div>
        <div className="sub">{ACT_NAMES[st.act]} · stage {st.tier + 1} of {ACTS[st.act].length} · deck {st.runDeck.length}</div>
        {/* RUN-7: you can see one stage ahead, so this is a line rather than a menu */}
        <div className="sub" style={{ marginTop: 2, color: bossNext(st) ? 'var(--red)' : 'var(--tan)' }}>
          ▸ AFTER THIS · {aheadSummary(st)}</div>
        {bossNext(st) ? (
          <div className="sub" style={{ color: 'var(--red)' }}>
            The boss is next. Whatever you are short of, this is where you get it.</div>)
          : bossAhead(st) && !campBeforeBoss(st) ? (
          <div className="sub" style={{ color: 'var(--tan)' }}>
            No camp between here and the boss.</div>) : null}
        {/* RUN-8: the act as a page of the guidebook, not a list of buttons */}
        <ActMap act={st.act} tier={st.tier} total={ACTS[st.act].length}
          trail={st.trail} seed={st.runSeed || 1} label={ACT_NAMES[st.act]} />
        <div className="sub">seed {seedCode(st.runSeed)}</div>
        {/* UX-16: what this trip has actually been */}
        {st.trail.length ? (
          <div className="sub" style={{ marginTop: 3, color: 'var(--fade)' }}>
            ◂ {st.trail.slice(-4).join(' · ')}
            {st.trail.length > 4 ? ` · and ${st.trail.length - 4} before that` : ''}</div>) : null}
        {st.gear.length ? (
          <div className="sub" style={{ marginTop: 3 }}>
            {st.gear.map(id => gearById(id)?.name).filter(Boolean).join(' · ')}
          </div>) : null}
        {st.boons.length ? (
          <div className="sub" style={{ marginTop: 2, color: 'var(--red)' }}>
            {st.boons.map(id => boonById(id)?.name).filter(Boolean).join(' · ')}
          </div>) : null}
        <hr className="rule" />
        <div className="row">
          <span className="lbl">CHOOSE YOUR LINE</span>
          <button className="btn" style={{ padding: '4px 9px', fontSize: 10 }}
            disabled={st.psyche <= 1}
            onClick={() => setSt(s => ({ ...s, reroll: s.reroll + 1,
              psyche: Math.max(1, s.psyche - 1) }))}>
            WAIT A DAY · 1 PSYCHE</button>
        </div>
        <div style={{ marginTop: 6 }}>
          {tier.map((n, i) => {
            const f = fc[i]
            const w = WEATHER[f.weather], rk = ROCK[f.rock]
            const good = forecastScore(f)
            if (n.type === 'camp') return (
              <div key={i} className="menu-item" {...tap(() => takeNode(n, i))}>
                <div className="row"><span className="big">Camp</span>
                  <span className="big" style={{ color: 'var(--green)' }}>rest</span></div>
                <div className="sub">Rest, sharpen a move, or cut a card.</div>
              </div>)
            if (n.type === 'project') {
              const r = ROUTES[n.routeIdx]
              return (
                <div key={i} className="menu-item" style={{ borderWidth: 2 }}
                  {...tap(() => takeNode(n, i))}>
                  <div className="row">
                    <span className="big">{r.name}</span>
                    <span className="big" style={{ color: 'var(--red)' }}>
                      PROJECT · {gradeLabel(r, st.grades)}</span></div>
                  <div className="sub">{r.style} · top out at {r.clear} · {r.crux} crux</div>
                  <div className="sub" style={{ color: 'var(--red)' }}>
                    A long line. Falls cost no skin, but there is nothing in it
                    unless it goes — and if it goes, gear and a card.</div>
                  <div className="sub" style={{ marginTop: 2,
                    color: good > 0 ? 'var(--green)' : good < 0 ? 'var(--red)' : 'var(--fade)' }}>
                    ☁ {w.name} · ⛰ {rk.name}</div>
                </div>)
            }
            if (n.type === 'established') {
              const e = own[n.routeIdx]
              if (!e) return null
              const r = specFromEstablished(e)
              return (
                <div key={i} className="menu-item" style={{ borderWidth: 2 }}
                  {...tap(() => takeNode(n, i), `${e.name}, your line, V${e.claimed}`)}>
                  <div className="row"><span className="big">{r.name}</span>
                    <span className="big" style={{ color: 'var(--green)' }}>
                      FA · {gradeLabel(r, st.grades)}</span></div>
                  <div className="sub">{r.style} · top out at {r.clear} · {r.crux} crux</div>
                  <div className="sub" style={{ color: 'var(--green)' }}>{r.note}</div>
                  <div className="sub" style={{ marginTop: 2,
                    color: good > 0 ? 'var(--green)' : good < 0 ? 'var(--red)' : 'var(--fade)' }}>
                    ☁ {w.name} · ⛰ {rk.name}</div>
                </div>)
            }
            if (n.type === 'fa') {
              const rng0 = new RNG(st.seed ^ (i * 7919) ^ (st.tier * 104729))
              const r = faRoute(st.act, rng0)
              return (
                <div key={i} className="menu-item" style={{ borderWidth: 2 }}
                  {...tap(() => takeNode(n, i), `An unclimbed line, grade unknown`)}>
                  <div className="row"><span className="big">An unclimbed line</span>
                    <span className="big" style={{ color: 'var(--red)' }}>?</span></div>
                  <div className="sub">{r.style} · nobody has been up it, so nobody knows how long</div>
                  <div className="sub" style={{ color: 'var(--red)' }}>
                    A season of dirt on every hold. Bring a brush.</div>
                </div>)
            }
            if (n.type === 'shop') return (
              <div key={i} className="menu-item" style={{ opacity: postOpen(st) ? 1 : 0.45 }}
                {...tap(() => takeNode(n, i), postOpen(st) ? 'Trading Post' : 'Trading Post, picked over')}>
                <div className="row"><span className="big">Trading Post</span>
                  <span className="big" style={{ color: 'var(--tan)' }}>${st.cash}</span></div>
                <div className="sub">{postOpen(st)
                  ? 'Cards, gear, tape. Cash only — and it does not cost you the day.'
                  : 'You have been round it already. Take a climb.'}</div>
              </div>)
            if (n.type === 'event') return (
              <div key={i} className="menu-item" {...tap(() => takeNode(n, i))}>
                <div className="row"><span className="big">Something on the trail</span>
                  <span className="big" style={{ color: 'var(--fade)' }}>?</span></div>
                <div className="sub">No climbing. No telling.</div>
              </div>)
            const r = ROUTES[n.routeIdx]
            return (
              <div key={i} className="menu-item" {...tap(() => takeNode(n, i))}>
                <div className="row">
                  <span className="big">{r.name}</span>
                  <span className="big" style={{ color: 'var(--red)' }}>
                    {n.type === 'boss' ? 'BOSS · ' : ''}{gradeLabel(r, st.grades)}</span></div>
                {r.signature && sigById(r.signature) ? (
                  <div className="sub" style={{ color: 'var(--red)' }}>
                    {sigById(r.signature)!.name} · {sigById(r.signature)!.note}</div>) : null}
                {r.phases?.length ? (
                  <div className="sub" style={{ color: 'var(--tan)' }}>
                    it changes at {phaseSummary(r)}</div>) : null}
                {r.finale ? (
                  <div className="sub" style={{
                    color: st.journal.length >= JOURNAL.length - 1 ? 'var(--green)' : 'var(--red)' }}>
                    {st.journal.filter(p => p <= 6).length}/6 of his pages —
                    {st.journal.filter(p => p <= 6).length >= 6
                      ? ' you can read the whole thing'
                      : ` every hold is +${Math.max(0, 6 - st.journal.filter(p => p <= 6).length)} Grip for what you do not know`}
                  </div>) : null}
                <div className="sub">{r.style} · top out at {r.clear} · {r.crux} crux
                  {r.roped ? <span style={{ color: 'var(--red)' }}> · {r.pitches} pitches, roped</span> : null}
                  {r.roped ? (
                    <div className="sub" style={{
                      color: st.runDeck.some(c => c.clip) ? 'var(--green)' : 'var(--red)' }}>
                      {st.runDeck.some(c => c.clip)
                        ? `${st.runDeck.filter(c => c.clip).length} piece${st.runDeck.filter(c => c.clip).length > 1 ? 's' : ''} on your rack — clip and you can try hard off it`
                        : 'Nothing on your rack. You can lead it, but you will be climbing scared.'}</div>) : null}
                  {st.book[r.name] ? <span style={{ color: 'var(--green)' }}>
                    {' '}· ticked, best {st.book[r.name].bestBurn}</span> : null}</div>
                <div className="sub" style={{ marginTop: 2,
                  color: good > 0 ? 'var(--green)' : good < 0 ? 'var(--red)' : 'var(--fade)' }}>
                  ☁ {w.name} · ⛰ {rk.name}{good > 0 ? ' · ▲ in nick' : good < 0 ? ' · ▼ out of nick' : ''}
                </div>
              </div>)
          })}
        </div>
        <div className="log" style={{ marginTop: 10 }}>{spec.note}</div>
        <style>{CSS}</style>
      </div>
    )
  }

  if (st.phase === 'event') {
    const ev = EVENTS.find(e => e.id === st.eventId)
    if (!ev) return <div className={skin}><button className="btn" onClick={leaveEvent}>ON</button><style>{CSS}</style></div>
    return (
      <div className={skin}>
        <div className="h1">{ev.title.toUpperCase()}</div>
        <hr className="rule" />
        <div style={{ fontSize: 13, lineHeight: 1.65, margin: '10px 0 14px' }}>{ev.text}</div>
        {st.eventResult ? (
          <>
            <div className="menu-item" style={{ borderWidth: 2 }}>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>{st.eventResult}</div>
            </div>
            <button className="btn go" style={{ width: '100%', marginTop: 8 }} onClick={leaveEvent}>
              ON UP THE TRAIL ▸</button>
          </>
        ) : (
          <div>
            {ev.choices.map((c, i) => (
              <div key={i} className="menu-item" {...tap(() => chooseEvent(i))}>
                <div className="big">{c.label}</div>
              </div>))}
          </div>
        )}
        <style>{CSS}</style>
      </div>
    )
  }

  if (st.phase === 'deck') {
    const mine = st.loadouts[st.arch] ?? DEFAULT_LOADOUT
    const pool = Array.from(new Set([...buildable(st.owned), ...ARCHETYPES[st.arch].loadout]))
    const uniq = Array.from(new Set(pool))
    const count = (n: string) => mine.filter(x => x === n).length
    const order: Record<string, number> = { starter: 0, common: 1, uncommon: 2, rare: 3 }
    uniq.sort((a, b) => (count(b) - count(a))
      || (order[CARDS[a].rarity ?? 'common'] - order[CARDS[b].rarity ?? 'common'])
      || a.localeCompare(b))
    const full = mine.length >= DECK_SIZE
    const feet = mine.filter(n => CARDS[n]?.lane === 'feet').length
    /* UX-14. The pool is everything you own, which BAL-2 just made 203 cards
       reachable inside 33 runs, and picking fifteen out of it meant scrolling.
       Search by name or by what a card says, and four ways to narrow it. */
    const q = deckFind.trim().toLowerCase()
    const shown = uniq.filter(n => {
      const c = CARDS[n]
      if (!c) return false
      if (deckOnly === 'feet' && c.lane !== 'feet') return false
      if (deckOnly === 'hands' && (c.lane === 'feet' || c.kind === 'bonus')) return false
      if (deckOnly === 'technique' && c.kind !== 'bonus') return false
      if (deckOnly === 'mine' && !count(n)) return false
      if (!q) return true
      return n.toLowerCase().includes(q) || (c.text ?? '').toLowerCase().includes(q)
    })
    return (
      <div className={skin}>
        <div className="row"><span className="h1">LOADOUT</span>
          <span className="big" style={{ color: full ? 'var(--green)' : 'var(--red)' }}>
            {mine.length}/{DECK_SIZE}</span></div>
        <div className="sub">{ARCHETYPES[st.arch].name} · what you start every climb with.</div>
        <div className="row"><span className="sub">
          rare {slotsUsed(mine, 'rare')}/{RARE_SLOTS} · uncommon {slotsUsed(mine, 'uncommon')}/{UNCOMMON_SLOTS}
        </span><span className="sub">max copies 3 / 2 / 1</span></div>
        <div className="sub" style={{ color: feet < 3 ? 'var(--red)' : 'var(--fade)' }}>
          {feet} feet cards — an empty feet lane is +1 Bite on both hands.</div>
        <div className="sub" style={{ marginTop: 2 }}>
          {(() => {
            const tc = tagCounts(mine.map(n => CARDS[n]).filter(Boolean).map(d => ({
              name: d.name, kind: d.kind ?? 'move', lane: d.lane ?? 'hand', shed: d.shed ?? 0 })))
            const parts = Object.entries(tc).sort((a, b) => b[1] - a[1])
              .map(([t, n]) => `${TAG_NAMES[t] ?? t} ${n}${n >= SYNERGY_PER ? '★' : ''}`)
            return parts.length ? parts.join(' · ') : 'no theme yet'
          })()}
        </div>
        <hr className="rule" />
        {/* DECK-1: put in what you want to build around, and it fills the rest */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
          <button className="btn go" style={{ flex: 2, padding: 10 }} disabled={full}
            onClick={() => setSt(x => setMine(x, buildLoadout(x, x.loadouts[x.arch] ?? [], x.owned)))}>
            {mine.length ? `FILL OUT THE OTHER ${DECK_SIZE - mine.length}` : 'BUILD ME ONE ▸'}</button>
          <button className="btn" style={{ flex: 1, padding: 10 }} disabled={!mine.length}
            onClick={() => setSt(x => setMine(x, []))}>EMPTY IT</button>
        </div>
        <div className="sub" style={{ marginBottom: 6 }}>
          {mine.length
            ? 'Keeps everything you have already picked and builds around it.'
            : 'Not sure where to start? Put in a card or two you like the look of, or let it pick.'}</div>
        <input value={deckFind} spellCheck={false} placeholder="find a card, or what it does"
          aria-label="Search your cards"
          onChange={e => setDeckFind(e.target.value)}
          style={{ width: '100%', padding: '8px 10px', marginBottom: 5 }} />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          {([['all', 'ALL'], ['hands', 'HANDS'], ['feet', 'FEET'],
            ['technique', 'TECHNIQUE'], ['mine', 'IN THE DECK']] as const).map(([k, label]) => (
            <button key={k} className={`btn${deckOnly === k ? ' go' : ''}`}
              style={{ padding: '5px 9px', fontSize: 11 }}
              onClick={() => setDeckOnly(k)}>{label}</button>))}
        </div>
        <div className="sub" style={{ marginBottom: 3 }}>
          {shown.length === uniq.length
            ? `${uniq.length} cards you can build with`
            : `${shown.length} of ${uniq.length}`}
          {q && !shown.length ? ' — nothing by that name. The pool grows as you level.' : ''}</div>
        <div style={{ maxHeight: 520, overflowY: 'auto' }}>
          {shown.map(n => {
            const c = CARDS[n], k = count(n)
            return (
              <div key={n} className="deckrow">
                <div className="nmx">
                  <div className="t1" style={{ opacity: k ? 1 : .55 }}>{n}</div>
                  <div className="t2">
                    {c.kind === 'move' ? `${c.power ?? 0}/${c.contact ?? 0} · ` : `${c.cost ?? 0}p · `}
                    {(() => {
                      const t = tagOf({ name: c.name, kind: c.kind ?? 'move',
                        lane: c.lane ?? 'hand', shed: c.shed ?? 0 })
                      return t ? `${TAG_NAMES[t]} · ` : ''
                    })()}{c.text}</div>
                </div>
                <button className="step" disabled={k === 0} onClick={() => dropCard(n)}>−</button>
                <span className="cnt">{k}</span>
                <button className="step" onClick={() => addCard(n)} disabled={
                  full || k >= copyLimit(c.rarity ?? 'common')
                  || (c.rarity === 'rare' && slotsUsed(mine, 'rare') >= RARE_SLOTS)
                  || (c.rarity === 'uncommon' && slotsUsed(mine, 'uncommon') >= UNCOMMON_SLOTS)
                }>+</button>
              </div>)
          })}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button className="btn" style={{ flex: 1 }}
            onClick={() => setSt(s => ({ ...s,
              loadouts: s.loadouts.map((l, i) => i === s.arch ? ARCHETYPES[s.arch].loadout.slice() : l) }))}>
            RESET</button>
          <button className="btn go" style={{ flex: 2 }} disabled={!full} onClick={goBack}>
            {full ? 'DONE' : `NEED ${DECK_SIZE - mine.length} MORE`}</button>
        </div>
        <style>{CSS}</style>
      </div>
    )
  }

  if (st.phase === 'logbook') {
    const inAct = ROUTES.filter((_, i) => ACT_OF_ROUTE[i] !== undefined)
    const done = inAct.filter(r => st.book[r.name]).length
    return (
      <div className={skin}>
        <div className="row"><span className="h1"><Lettered t="THE LOGBOOK" seed={61} /></span>
          <button className="btn" style={{ padding: '5px 10px', fontSize: 11 }} onClick={goBack}>◂ BOOKS</button></div>
        <InkRule seed={44} color="var(--ink)" />
        <div className="sub">{done}/{inAct.length} lines ticked</div>
        {st.established.length ? (
          <>
            <div className="lbl" style={{ marginTop: 10 }}>LINES YOU PUT UP</div>
            {st.established.map((f, i) => (
              <div key={i} className="deckrow">
                <span className="cnt" style={{ color: 'var(--green)' }}>FA</span>
                <div className="nmx">
                  <div className="t1">{f.name} <span style={{ color: 'var(--red)' }}>{gradeText(f.claimed, st.grades)}</span></div>
                  <div className="t2">{ACT_NAMES[f.act]} · {f.burns} burn{f.burns > 1 ? 's' : ''}</div>
                  <div className="t2" style={{
                    color: f.claimed < f.real ? 'var(--red)'
                      : f.claimed > f.real ? 'var(--tan)' : 'var(--green)' }}>
                    {claimVerdict(f.claimed, f.real)}</div>
                </div>
              </div>))}
          </>) : null}
        <div style={{ maxHeight: 640, overflowY: 'auto', marginTop: 6 }}>
          {[0, 1, 2].map(act => (
            <div key={act}>
              {(() => {
                const lines = ROUTES.filter((_, i) => ACT_OF_ROUTE[i] === act)
                const done = lines.filter(r => st.book[r.name]).length
                const paid = st.ticked.includes(`act${act}`)
                return (
                  <div className="row" style={{ marginTop: 9 }}>
                    <span className="lbl">{ACT_NAMES[act].toUpperCase()}</span>
                    <span className="lbl" style={{
                      color: done === lines.length ? 'var(--green)' : 'var(--fade)' }}>
                      {done}/{lines.length}
                      {done === lines.length ? (paid ? ' · complete' : ' · reward waiting')
                        : ` · tick them all for ${ACT_XP} xp and a rare`}</span>
                  </div>)
              })()}
              {ROUTES.map((r, i) => ACT_OF_ROUTE[i] === act ? (() => {
                const e = st.book[r.name]
                return (
                  <div key={r.name} className="deckrow" style={{ opacity: e ? 1 : 0.4 }}>
                    <span className="cnt" style={{ color: e ? 'var(--green)' : 'var(--fade)' }}>
                      {e ? '✓' : '·'}</span>
                    <div className="nmx">
                      <div className="t1">{r.name} <span style={{ color: 'var(--red)' }}>{gradeLabel(r, st.grades)}</span>
                        {e?.flashed ? <span style={{ color: 'var(--green)' }}> · flashed</span> : null}</div>
                      <div className="t2">{e
                        ? `${e.sends} send${e.sends > 1 ? 's' : ''} · best ${e.bestBurn} burn${e.bestBurn > 1 ? 's' : ''}`
                          + ` · ${ASCENT[e.bestStyle].name} · ${WEATHER[e.weather].name}, ${ROCK[e.rock].name}`
                        : `${r.style} · top out at ${r.clear}`}</div>
                      {e ? <div className="t2" style={{ color: 'var(--green)' }}>
                        you remember {Math.min(BOOK_BETA_MAX, e.sends + (e.flashed ? 1 : 0))} move
                        {Math.min(BOOK_BETA_MAX, e.sends + (e.flashed ? 1 : 0)) > 1 ? 's' : ''} on it
                      </div> : null}
                    </div>
                  </div>)
              })() : null)}
            </div>))}
        </div>
        <style>{CSS}</style>
      </div>
    )
  }

  if (st.phase === 'glossary') return (
    <div className={skin}>
      <div className="row"><span className="h1">HOW IT WORKS</span>
        <button className="btn" style={{ padding: '5px 10px', fontSize: 11 }} onClick={goBack}>◂ BOOKS</button></div>
      <hr className="rule" />
      <div style={{ maxHeight: 640, overflowY: 'auto' }}>
        <div className="lbl">WHAT THE ROCK DOES</div>
        {Object.entries(HOLD_STATS).map(([name, d]) => (
          <div key={name} className="deckrow">
            <Glyph name={name} size={24} />
            <div className="nmx">
              <div className="t1">{name} — <span style={{ color: 'var(--red)' }}>{d.ability}</span></div>
              <div className="t2">{d.text}</div>
            </div>
            <span className="cnt" style={{ color: 'var(--red)' }}>{d.bite}</span>
            <span className="cnt" style={{ color: 'var(--green)' }}>{d.grip}</span>
          </div>))}
        <div className="lbl" style={{ marginTop: 10 }}>THE MARK ON A CARD</div>
        {Object.entries(FAMILY).map(([k, f]) => (
          <div key={k} className="deckrow">
            <svg width="24" height="24" viewBox="0 0 24 24" style={{ flex: '0 0 auto' }} aria-hidden="true">
              <path d={f.d} fill="none" stroke="var(--ink)" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="nmx"><div className="t1">{f.label}</div>
              <div className="t2">{
                k === 'hand' ? 'Plays into either hand lane.'
                : k === 'feet' ? 'Plays into the feet lane. Usually carries Support.'
                : k === 'rest' ? 'Sheds pump instead of making progress.'
                : k === 'mind' ? 'Played straight away, costs pump, no lane.'
                : k === 'clip' ? 'Clips the rope: resets the runout, and for one turn you climb like somebody who is not going to hit the ground.'
                : k === 'beta' ? 'From a journal page. The finale only.'
                : 'Nothing good. Cut it when you can.'}</div></div>
          </div>))}
        <div className="lbl" style={{ marginTop: 10 }}>WHAT YOUR CARDS DO</div>
        {KEYWORDS.map(k => (
          <div key={k.name} className="deckrow">
            <div className="nmx">
              <div className="t1">{k.name}</div>
              <div className="t2">{k.text}</div>
            </div>
          </div>))}
      </div>
      <style>{CSS}</style>
    </div>
  )

  if (st.phase === 'journal') return (
    <div className={skin}>
      <div className="row"><span className="h1">THE JOURNAL</span>
        <span className="sub">{st.journal.length}/{JOURNAL.length}</span></div>
      <div className="sub">Pages of the first ascensionist. They keep between runs.</div>
      <hr className="rule" />
      <div style={{ maxHeight: 620, overflowY: 'auto' }}>
        {JOURNAL.map(j => {
          const have = st.journal.includes(j.id)
          return (
            <div key={j.id} className="menu-item" style={{ opacity: have ? 1 : 0.35 }}>
              <div className="big">{have ? j.title : 'Page ' + j.id}</div>
              <div className="sub" style={{ lineHeight: 1.55, marginTop: 3 }}>
                {have ? j.text : 'Not found yet.'}</div>
            </div>)
        })}
      </div>
      <button className="btn go" style={{ width: '100%', marginTop: 8 }} onClick={goBack}>◂ BOOKS</button>
      <style>{CSS}</style>
    </div>
  )

  if (st.phase === 'history') {
    return (
      <div className={skin}>
        <div className="row"><span className="h1"><Lettered t="EVERY TRIP" seed={109} /></span>
          <button className="btn" style={{ padding: '5px 10px', fontSize: 11 }} onClick={goBack}>◂ BOOKS</button></div>
        <InkRule seed={83} color="var(--ink)" />
        <div className="sub">The last {HISTORY_MAX}. Tap a seed to climb it again.</div>
        <div style={{ maxHeight: 660, overflowY: 'auto', marginTop: 8 }}>
          {st.history.length ? st.history.map((r, i) => (
            <div key={i} className="menu-item"
              {...tap(() => { setSeedIn(seedCode(r.seed))
                try { void navigator.clipboard?.writeText(seedCode(r.seed)) } catch { /* blocked */ } })}>
              <div className="row">
                <span className="big" style={{ color: r.won ? 'var(--green)' : undefined }}>
                  {r.circuit ? 'The Circuit' : r.won ? 'The Lost Line' : ACT_NAMES[r.act]}</span>
                <span className="lbl" style={{ color: 'var(--tan)' }}>{seedCode(r.seed)}</span></div>
              <div className="sub">
                {ARCHETYPES[Math.min(r.arch, ARCHETYPES.length - 1)].name}
                {' · '}{r.rope ? 'toprope' : ASCENT[Math.min(r.style, ASCENT.length - 1)].name}
                {r.circuit ? '' : ` · stage ${r.tier + 1}`}
                {' · '}{r.sends} sends · deck {r.deck}</div>
              <div className="sub" style={{ color: r.won ? 'var(--green)' : 'var(--red)' }}>{r.cause}</div>
            </div>)) : (
            <div className="sub" style={{ marginTop: 10 }}>
              Nothing yet. Go and get on something.</div>)}
        </div>
        <style>{CSS}</style>
      </div>
    )
  }

  if (st.phase === 'stats') {
    const inAct = ROUTES.filter((_, i) => ACT_OF_ROUTE[i] !== undefined)
    const ticked = inAct.filter(r => st.book[r.name])
    const flashes = ticked.filter(r => st.book[r.name].flashed).length
    const hardest = ticked.reduce((a, r) => Math.max(a, r.grade), -1)
    const bestStyle = ticked.reduce((a, r) => Math.max(a, st.book[r.name].bestStyle), 0)
    const oneBurn = ticked.filter(r => st.book[r.name].bestBurn === 1).length
    const byR = (r: Rarity) => {
      const pool = BY_RARITY(r)
      return `${pool.filter(n => st.owned.includes(n)).length}/${pool.length}`
    }
    const Row = ({ k, v }: { k: string; v: string }) => (
      <div className="row" style={{ padding: '3px 0' }}>
        <span className="sub">{k}</span>
        <span style={{ fontSize: 12, fontWeight: 700 }}>{v}</span></div>)
    return (
      <div className={skin}>
        <div className="row"><span className="h1"><Lettered t="THE NUMBERS" seed={97} /></span>
          <button className="btn" style={{ padding: '5px 10px', fontSize: 11 }} onClick={goBack}>◂ BOOKS</button></div>
        <InkRule seed={37} color="var(--ink)" />
        <div style={{ maxHeight: 660, overflowY: 'auto', marginTop: 4 }}>
          <div className="lbl" style={{ marginTop: 8 }}>CAREER</div>
          <Row k="level" v={`${st.level} · ${st.xp}/${xpToNext(st.level)} xp`} />
          <Row k="boulders sent" v={String(st.sends)} />
          <Row k="expeditions started" v={String(st.runs)} />
          <Row k="the lost line" v={st.wins ? `sent ${st.wins}×` : 'not yet'} />
          <Row k="success rate" v={st.runs ? `${Math.round(100 * st.wins / st.runs)}%` : '—'} />
          <Row k="falls taken" v={String(st.falls)} />

          <div className="lbl" style={{ marginTop: 10 }}>THE ROCK</div>
          <Row k="lines ticked" v={`${ticked.length}/${inAct.length}`} />
          <Row k="flashed" v={String(flashes)} />
          <Row k="one-burn sends" v={String(oneBurn)} />
          <Row k="hardest send" v={hardest >= 0 ? gradeLabel(ticked.reduce((a, r) => r.grade > a.grade ? r : a)) : '—'} />
          <Row k="best style" v={ASCENT[bestStyle].name} />
          <Row k="styles unlocked" v={`${st.styleMax + 1}/${ASCENT.length}`} />

          <div className="lbl" style={{ marginTop: 10 }}>THE CIRCUIT</div>
          <Row k="best run" v={st.bestCircuit ? `${st.bestCircuit} lines` : 'not yet'} />

          <div className="lbl" style={{ marginTop: 10 }}>THE COLLECTION</div>
          <Row k="cards owned" v={`${st.owned.length}/${Object.keys(CARDS).length}`} />
          <Row k="common" v={byR('common')} />
          <Row k="uncommon" v={byR('uncommon')} />
          <Row k="rare" v={byR('rare')} />
          <Row k="climbers" v={`${ARCHETYPES.filter(a => archUnlocked(a, st.level)).length}/${ARCHETYPES.length}`} />

          <div className="lbl" style={{ marginTop: 10 }}>THE STORY</div>
          <Row k="journal pages" v={`${st.journal.length}/${JOURNAL.length}`} />
          <Row k="conversations" v={`${st.seen.length}/${TALKS.length}`} />
        </div>
        <style>{CSS}</style>
      </div>
    )
  }

  if (st.phase === 'saves') {
    const load = (n: number) => setSt(s => ({
      ...freshRun(0, 0, (Date.now() & 0x7fffffff) >>> 0), slot: n, ...loadGame(n), phase: 'menu',
      coaching: s.coaching, sound: s.sound, cbSafe: s.cbSafe,
    }))
    return (
      <div className={skin}>
        <div className="row"><span className="h1"><Lettered t="SAVES" seed={83} /></span>
          <button className="btn" style={{ padding: '5px 10px', fontSize: 11 }} onClick={goBack}>◂ BOOKS</button></div>
        <InkRule seed={29} color="var(--ink)" />
        <div style={{ marginTop: 8 }}>
          {Array.from({ length: SLOTS }, (_, n) => {
            const sum = slotSummary(n)
            return (
              <div key={n} className="menu-item" style={{ borderWidth: n === st.slot ? 2 : 1.5 }}>
                <div className="row" {...tap(() => load(n))}>
                  <span className="big">Slot {n + 1}{n === st.slot ? ' · current' : ''}</span>
                  <span className="big" style={{ color: 'var(--red)' }}>
                    {sum ? `LV ${sum.level}` : 'empty'}</span></div>
                <div className="sub" {...tap(() => load(n))}>
                  {sum ? `${sum.cards} cards · circuit best ${sum.best}${sum.run ? ' · run in progress' : ''}`
                    : 'Tap to start here.'}</div>
                {sum ? (
                  <div className="sub" style={{ color: 'var(--red)', marginTop: 3 }}
                    {...tap(() => { wipeSlot(n); setIo({ code: '', msg: `Slot ${n + 1} wiped.` }) })}>
                    wipe this slot</div>) : null}
              </div>)
          })}
        </div>
        <div className="lbl" style={{ marginTop: 10 }}>MOVE A SAVE</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
          <button className="btn" style={{ flex: 1 }}
            onClick={() => { const c = exportSave(st); setIo({ code: c, msg: c ? 'Copied below — save it somewhere.' : 'Nothing to export.' })
              try { void navigator.clipboard?.writeText(c) } catch { /* clipboard blocked */ } }}>
            EXPORT</button>
          <button className="btn" style={{ flex: 1 }}
            onClick={() => setIo(x => ({ ...x, msg: importSave(x.code, st.slot)
              ? 'Imported. Reloading the slot.' : 'That code did not read.' }))}>
            IMPORT</button>
        </div>
        <textarea value={io.code} spellCheck={false}
          onChange={e => setIo({ code: e.target.value, msg: '' })}
          placeholder="Paste a save code here, or hit EXPORT to make one."
          style={{ width: '100%', height: 84, marginTop: 6, fontSize: 10, fontFamily: 'monospace',
            background: '#f0eade', border: '1.5px solid var(--ink)', borderRadius: 2, padding: 6,
            color: 'var(--ink)', resize: 'none' }} />
        {io.msg ? <div className="sub" style={{ marginTop: 4 }}>{io.msg}</div> : null}
        <button className="btn go" style={{ width: '100%', marginTop: 8 }}
          onClick={() => load(st.slot)}>RELOAD SLOT {st.slot + 1}</button>
        <style>{CSS}</style>
      </div>
    )
  }

  if (st.phase === 'circuitNext') {
    const nxt = st.skirmish
    return (
      <div className={skin}>
        <div className="row"><span className="h1"><Lettered t="THE CIRCUIT" seed={71} /></span>
          <span className="big" style={{ color: 'var(--green)' }}>{st.circuitScore} sent</span></div>
        <InkRule seed={23} color="var(--ink)" />
        <div className="sub">skin {st.skin} · psyche {st.psyche} · deck {st.runDeck.length}</div>
        {nxt ? (
          <div className="menu-item" style={{ borderWidth: 2, marginTop: 10 }}>
            <div className="row"><span className="big">{nxt.name}</span>
              <span className="big" style={{ color: 'var(--red)' }}>{gradeLabel(nxt, st.grades)}</span></div>
            <div className="sub">{nxt.style} · top out at {nxt.clear}
              {nxt.roped ? <span style={{ color: 'var(--red)' }}> · {nxt.pitches} pitches, roped</span> : null}</div>
            <div className="sub">{nxt.note}</div>
          </div>) : null}
        <button className="btn go" style={{ width: '100%', marginTop: 10 }} onClick={nextCircuitLine}>
          PULL ON ▸</button>
        <button className="btn" style={{ width: '100%', marginTop: 6 }}
          onClick={() => setSt(walkAwayStep)}>
          WALK AWAY WITH {st.circuitScore}</button>
        <style>{CSS}</style>
      </div>
    )
  }

  if (st.phase === 'shop') {
    const postT = postTalk(st)
    const buy = (key: string, cost: number, apply: (s: GameState) => GameState) =>
      setSt(s => s.cash < cost || s.bought.includes(key) ? s
        : { ...apply(s), cash: s.cash - cost, bought: [...s.bought, key] })
    const sold = (key: string) => st.bought.includes(key)
    return (
      <div className={skin}>
        <div className="row"><span className="h1"><Lettered t="TRADING POST" seed={53} /></span>
          <span className="big" style={{ color: 'var(--tan)' }}>${st.cash}</span></div>
        {postT ? (
          <div className="spot" style={{ borderLeftColor: 'var(--tan)' }}>
            <b style={{ color: 'var(--tan)' }}>{postT.who.toUpperCase()} IS IN</b>
            <span className="tap" {...tap(() => setSt(x => ({ ...x, talkId: postT.id,
              talkReply: null, phase: 'talk' })), `Talk to ${postT.who}`)}>
              Somebody worth five minutes. Go and say hello ▸</span>
          </div>) : null}
        <InkRule seed={19} color="var(--ink)" />
        <div className="sub">Gear shop off the back of a van. Cash only.</div>
        <div style={{ maxHeight: 520, overflowY: 'auto', marginTop: 8 }}>
          {st.shopCards.map((c, k) => {
            const key = 'c' + k, cost = priceOf(c)
            return (
              <div key={c.uid} className="menu-item"
                style={{ opacity: sold(key) ? 0.3 : st.cash < cost ? 0.55 : 1 }}
                {...tap(() => buy(key, cost, s => ({ ...s, runDeck: [...s.runDeck, c] })))}>
                <div className="row"><span className="big">{c.name}</span>
                  <span className="big" style={{ color: 'var(--tan)' }}>
                    {sold(key) ? 'sold' : '$' + cost}</span></div>
                <div className="sub">
                  {c.kind === 'move' ? `${c.power} / ${c.contact} · ` : `${c.cost} pump · `}{c.text}</div>
                {st.hints ? cardHints(st, c, st.runDeck).map((h, j) => (
                  <div key={j} className="sub" style={{ color: 'var(--tan)' }}>▸ {h}</div>)) : null}
              </div>)
          })}
          {st.shopGear.map((id, k) => {
            const b = boonById(id), g = boonById(id) ? null : gearById(id)
            if (!b && !g) return null
            const key = 'g' + k, cost = b ? PRICE.boon : PRICE.gear
            const take = (x: GameState) => b
              ? { ...x, boons: [...x.boons, b.id] }
              : { ...x, gear: [...x.gear.filter(y => gearById(y)?.slot !== g!.slot), g!.id] }
            return (
              <div key={id} className="menu-item"
                style={{ opacity: sold(key) ? 0.3 : st.cash < cost ? 0.55 : 1, borderWidth: 2 }}
                {...tap(() => buy(key, cost, take))}>
                <div className="row"><span className="big">{(b ?? g)!.name}</span>
                  <span className="big" style={{ color: 'var(--tan)' }}>
                    {sold(key) ? 'sold' : '$' + cost}</span></div>
                <div className="sub" style={{ color: b ? 'var(--red)' : undefined }}>
                  {b ? 'changes a rule' : g!.slot} · {(b ?? g)!.text}</div>
              </div>)
          })}
          <div className="menu-item" style={{ opacity: sold('skin') ? 0.3 : st.cash < PRICE.skin ? 0.55 : 1 }}
            {...tap(() => buy('skin', PRICE.skin, s => ({ ...s,
              skin: Math.min(RUN_SKIN + styleMods(s.style).skin, s.skin + 2) })))}>
            <div className="row"><span className="big">Tape and salve</span>
              <span className="big" style={{ color: 'var(--tan)' }}>
                {sold('skin') ? 'sold' : '$' + PRICE.skin}</span></div>
            <div className="sub">+2 skin.</div>
          </div>
          <div className="lbl" style={{ marginTop: 10 }}>SELL A CARD BACK · ${PRICE.cut} TO CUT</div>
          {st.runDeck.map(c => (
            <div key={c.uid} className="deckrow"
              style={{ opacity: st.cash < PRICE.cut ? 0.5 : 1 }}
              {...tap(() => setSt(s => s.cash < PRICE.cut ? s
                : { ...s, cash: s.cash - PRICE.cut, runDeck: s.runDeck.filter(x => x.uid !== c.uid) }))}>
              <div className="nmx"><div className="t1">{c.name}</div><div className="t2">{c.text}</div></div>
              <span className="cnt" style={{ color: 'var(--red)' }}>
                {c.kind === 'move' ? c.power : c.cost}</span>
              <span className="cnt" style={{ color: 'var(--green)' }}>
                {c.kind === 'move' ? c.contact : ''}</span>
            </div>))}
        </div>
        <button className="btn go" style={{ width: '100%', marginTop: 8 }}
          onClick={() => setSt(leaveShopStep)}>
          ◂ BACK ON THE ROAD</button>
        <style>{CSS}</style>
      </div>
    )
  }

  if (st.phase === 'gear') return (
    <div className={skin}>
      <div className="h1"><Lettered t="THE NEXT RANGE" seed={41} /></div>
      <InkRule seed={12} color="var(--ink)" />
      <div className="sub">Something out of the van before you drive on.</div>
      <div style={{ marginTop: 8 }}>
        {st.gearOffers.map(id => {
          const b = boonById(id), g = gearById(id)
          if (!b && !g) return null
          return (
            <div key={id} className="menu-item"
              style={b ? { borderWidth: 2 } : undefined}
              {...tap(() => setSt(s => pickGearStep(s, id)))}>
              <div className="row"><span className="big">{(b ?? g)!.name}</span>
                <span className="lbl" style={{ color: b ? 'var(--red)' : undefined }}>
                  {b ? (b.wild ? 'BREAKS A RULE' : 'CHANGES A RULE') : g!.slot.toUpperCase()}</span></div>
              <div className="sub">{(b ?? g)!.text}</div>
            </div>)
        })}
      </div>
      <button className="btn" style={{ width: '100%', marginTop: 6 }}
        onClick={() => setSt(s => pickGearStep(s, null))}>
        TRAVEL LIGHT</button>
      <style>{CSS}</style>
    </div>
  )

  if (st.phase === 'reward') {
    const cost = rerollCost(st.rerolls)
    const two = takeTwo.length
    const roll = (fn: (x: GameState, r: RNG) => GameState) => () => {
      const rng = new RNG(st.seed)
      setSt(x => ({ ...fn(x, rng), seed: rng.s }))
    }
    return (
      <div className={skin}>
        <div className="row">
          <span className="h1">{st.result === 'send' ? 'SENT' : 'WORTH KNOWING'}</span>
          <span className="big" style={{ color: 'var(--tan)' }}>${st.cash}</span></div>
        <div className="sub">{two
          ? 'Pick one more. There is a curse in it.'
          : st.result === 'send'
            ? 'Something to take with you.'
            : 'You did not top it out. You did not come away empty either.'}</div>
        <hr className="rule" />
        <div style={{ marginTop: 6 }}>
          {st.offers.map(c => (
            <div key={c.uid} className="menu-item"
              style={takeTwo.includes(c.uid) ? { borderWidth: 2, opacity: 0.55 } : undefined}
              {...tap(() => {
                if (!two) return takeOffer(c)
                if (takeTwo.includes(c.uid)) return
                const picks = [...st.offers.filter(o => takeTwo.includes(o.uid)), c]
                const rng = new RNG(st.seed)
                setTakeTwo([])
                setSt(x => ({ ...takeTwoStep(x, picks, rng), seed: rng.s }))
              })}>
              <div className="row"><span className="big">{c.name}</span>
                <span className="big">
                  {c.kind === 'move' ? `${c.power} / ${c.contact}` : `${c.cost} pump`}</span></div>
              <div className="sub">{c.lane === 'feet' ? 'feet · ' : c.lane === 'any' ? 'any · ' : ''}{c.text}</div>
            </div>))}
        </div>
        {two ? (
          <button className="btn" style={{ width: '100%', marginTop: 6 }}
            onClick={() => setTakeTwo([])}>◂ CHANGED MY MIND</button>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button className="btn" style={{ flex: 1 }} disabled={st.cash < cost}
                onClick={roll(rerollStep)}>REROLL · ${cost}</button>
              <button className="btn" style={{ flex: 1 }} disabled={st.cash < CROP_COST}
                onClick={roll(cropStep)}>BETTER SHELF · ${CROP_COST}</button>
            </div>
            <button className="btn" style={{ width: '100%', marginTop: 6 }}
              disabled={st.offers.length < 2}
              onClick={() => setTakeTwo([st.offers[0].uid])}>
              TAKE TWO — AND A CURSE WITH THEM</button>
            <div className="sub" style={{ marginTop: 3 }}>
              Tap the first, then the second. The curse comes in the deck.</div>
            <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={() => takeOffer(null)}>
              TAKE NOTHING — KEEP THE DECK TIGHT</button>
          </>)}
        <style>{CSS}</style>
      </div>
    )
  }

  if (st.phase === 'camp') {
    const talk = availableTalk(st)
    const showList = campMode !== 'rest'
    const camp = (a: CampAction) => setSt(s => campStep(s, a))
    const vanRaid = () => { const rng = new RNG(st.seed)
      setSt(s => ({ ...campStep(s, { kind: 'van', rng }), seed: rng.s })) }
    return (
      <div className={skin}>
        <div className="h1"><Lettered t="CAMP" seed={23} /></div>
        <InkRule seed={31} color="var(--ink)" />
        <div className="sub">skin {st.skin}/{RUN_SKIN + styleMods(st.style).skin} · deck {st.runDeck.length}</div>
        {talk ? (
          <div className="menu-item" style={{ borderWidth: 2, margin: '9px 0' }}
            {...tap(() => setSt(s => ({ ...s, talkId: talk.id, talkReply: null, phase: 'talk' })))}>
            <div className="row"><span className="big">{talk.who} is at the fire</span>
              <span className="big" style={{ color: 'var(--red)' }}>talk</span></div>
            <div className="sub">Costs you nothing but the evening.</div>
          </div>) : null}
        <div style={{ display: 'flex', gap: 6, margin: '9px 0 8px' }}>
          <button className={`btn${campMode === 'rest' ? ' go' : ''}`} style={{ flex: 1 }}
            onClick={() => setCampMode('rest')}>REST</button>
          <button className={`btn${campMode === 'sharpen' ? ' go' : ''}`} style={{ flex: 1 }}
            onClick={() => setCampMode('sharpen')}>SHARPEN</button>
          <button className={`btn${campMode === 'cut' ? ' go' : ''}`} style={{ flex: 1 }}
            onClick={() => setCampMode('cut')}>CUT</button>
        </div>
        <button className="btn" style={{ width: '100%', marginBottom: 8 }}
          disabled={!vanOpen(st)} onClick={vanRaid}>
          {vanOpen(st) ? 'GO THROUGH THE VAN ▸' : 'THE VAN IS PICKED OVER'}</button>
        <div className="sub" style={{ marginBottom: 6 }}>
          {vanOpen(st)
            ? 'Kit and beta instead of a rest. Once a range, so spend it well.'
            : 'You have been through it already. Nothing left in there until the next range.'}</div>
        {campMode === 'rest' ? (
          <>
            <div className="sub" style={{ marginBottom: 8 }}>
              Sleep it off and let the skin come back.</div>
            <button className="btn go" style={{ width: '100%' }}
              onClick={() => camp({ kind: 'rest' })}>
              REST · +{campSkinFor(st)} SKIN</button>
          </>
        ) : (
          <div className="sub" style={{ marginBottom: 6 }}>
            {campMode === 'sharpen'
              ? 'Work a move until it is second nature. Pick one to sharpen.'
              : 'A tighter deck draws better. Pick one to cut.'}</div>
        )}
        {showList ? (
          <div style={{ maxHeight: 470, overflowY: 'auto' }}>
            {st.runDeck.map(c => (
              <div key={c.uid} className="deckrow" {...tap(() => campMode === 'cut'
                ? camp({ kind: 'cut', uid: c.uid })
                : (c.upgraded ? null : camp({ kind: 'sharpen', name: c.name })))}>
                <div className="nmx">
                  <div className="t1" style={{ color: c.upgraded ? 'var(--green)' : undefined }}>
                    {c.name}{campMode === 'sharpen' && !c.upgraded
                      && st.runDeck.filter(x => x.name === c.name).length > 1
                      ? ` ×${st.runDeck.filter(x => x.name === c.name).length}` : ''}</div>
                  <div className="t2">{c.text}</div>
                </div>
                <span className="cnt" style={{ color: 'var(--red)' }}>
                  {c.kind === 'move' ? c.power : c.cost}</span>
                <span className="cnt" style={{ color: 'var(--green)' }}>
                  {c.kind === 'move' ? c.contact : ''}</span>
              </div>))}
          </div>) : null}
        <style>{CSS}</style>
      </div>
    )
  }

  if (st.phase === 'talk') {
    const talk = TALKS.find(t => t.id === st.talkId)
    if (!talk) return <div className={skin}><button className="btn"
      onClick={() => setSt(s => ({ ...s, phase: 'camp' }))}>BACK</button><style>{CSS}</style></div>
    return (
      <div className={skin}>
        <div className="h1">{talk.who.toUpperCase()}</div>
        <hr className="rule" />
        <div style={{ fontSize: 13, lineHeight: 1.7, margin: '10px 0 14px' }}>{talk.text}</div>
        {st.talkReply ? (
          <>
            <div className="menu-item" style={{ borderWidth: 2 }}>
              <div style={{ fontSize: 13, lineHeight: 1.65 }}>{st.talkReply}</div>
            </div>
            <button className="btn go" style={{ width: '100%', marginTop: 8 }}
              onClick={() => setSt(s => s.packCards.length
                ? { ...s, talkId: null, talkReply: null, afterPack: 'camp', phase: 'pack' }
                : { ...s, talkId: null, talkReply: null, phase: 'camp' })}>
              BACK TO THE FIRE ▸</button>
          </>
        ) : (
          <div>
            {talk.replies.map((r, i) => (
              <div key={i} className="menu-item" {...tap(() => {
                const rng = new RNG(st.seed)
                const next = r.outcome ? applyOutcome(st, r.outcome, rng) : st
                setSt({ ...next, seed: rng.s, talkReply: r.text,
                  seen: Array.from(new Set([...st.seen, talk.id])) })
              })}>
                <div className="big">{r.label}</div>
              </div>))}
          </div>
        )}
        <style>{CSS}</style>
      </div>
    )
  }

  if (st.phase === 'line' && pending) {
    const base = ROUTES[pending.routeIdx]
    const go = (line: number) => {
      setPending(null)
      const rng = new RNG(st.seed)
      const f = forecastFor(st)[pending.nodeIdx]
      const next = startBurn({ ...st, routeIdx: pending.routeIdx, skirmish: null,
        onProject: false, line, burn: 1, beta: [], worked: [],
        weather: f ? f.weather : rng.int(WEATHER.length),
        rock: f ? f.rock : rng.int(ROCK.length) }, rng)
      if (st.inRun) saveGame({ ...next, tier: st.tier + 1 })
      setSt({ ...next, seed: rng.s })
    }
    return (
      <div className={skin}>
        <div className="row"><span className="h1"><Lettered t={base.name.toUpperCase()} seed={pending.routeIdx * 3 + 2} /></span>
          <span className="big" style={{ color: 'var(--red)' }}>{gradeLabel(base, st.grades)}</span></div>
        <InkRule seed={91} color="var(--ink)" />
        <div className="sub">{base.note}</div>
        <div className="lbl" style={{ marginTop: 12 }}>WHICH WAY UP</div>
        <div style={{ marginTop: 6 }}>
          {LINES.map((l, i) => {
            const clear = Math.max(4, base.clear + (l.dClear ?? 0))
            const crux = Math.max(0, base.crux + (l.dCrux ?? 0))
            return (
              <div key={l.id} className="menu-item" {...tap(() => go(i))}>
                <div className="row"><span className="big">{l.name}</span>
                  <span className="sub">{clear} holds · {crux} crux
                    {l.dTax ? ' · +1 tax' : ''}</span></div>
                <div className="sub">{l.text}</div>
              </div>)
          })}
        </div>
        <button className="btn" style={{ width: '100%', marginTop: 8 }}
          onClick={() => { setPending(null); setSt(x => ({ ...x, phase: 'map' })) }}>
          ◂ NOT TODAY</button>
        <style>{CSS}</style>
      </div>
    )
  }

  if (st.phase === 'claim' && st.skirmish) {
    const real = st.skirmish.grade
    const c = claim ?? { name: '', grade: Math.max(0, real - 1) }
    const suggest = () => {
      const r = new RNG(st.seed ^ st.turn)
      return `${FA_NAMES_A[r.int(FA_NAMES_A.length)]} ${FA_NAMES_B[r.int(FA_NAMES_B.length)]}`
    }
    const done = () => {
      const name = (c.name.trim() || suggest()).slice(0, 28)
      const spec = st.skirmish!
      const rec: Established = { name, claimed: c.grade, real, act: st.act, burns: st.burn,
        style: spec.style, clear: spec.clear, crux: spec.crux, feet: spec.feet }
      setClaim(null)
      // CARD-6: the grade you put on it is checked against the ones before it
      setSt(x => claimCurse({ ...x, established: [rec, ...x.established].slice(0, 40),
        book: { ...x.book, [name]: { sends: 1, bestBurn: st.burn, bestStyle: x.style,
          flashed: st.burn === 1, weather: x.weather, rock: x.rock } },
        skirmish: null, phase: 'map', tier: x.tier + 1 }))
    }
    return (
      <div className={skin}>
        <div className="h1"><Lettered t="A FIRST ASCENT" seed={113} /></div>
        <InkRule seed={77} color="var(--ink)" />
        <div style={{ fontSize: 13, lineHeight: 1.7, marginTop: 8 }}>
          <p style={{ margin: '0 0 8px' }}>
            You are the first person to stand on top of this. There is nothing to compare it
            to and nobody to ask.</p>
          <p style={{ margin: '0 0 10px', color: 'var(--fade)' }}>
            {st.burn === 1 ? 'First go, and nobody had cleaned it for you.'
              : `${st.burn} burns to work it out.`}</p>
        </div>
        <div className="lbl">WHAT DO YOU CALL IT</div>
        <input value={c.name} spellCheck={false} maxLength={28}
          onChange={e => setClaim({ ...c, name: e.target.value })}
          placeholder={suggest()}
          style={{ width: '100%', marginTop: 4, fontSize: 14, fontFamily: 'inherit',
            background: '#f0eade', border: '1.5px solid var(--ink)', borderRadius: 2,
            padding: '9px 9px', color: 'var(--ink)' }} />
        <div className="row" style={{ marginTop: 12 }}>
          <span className="lbl">WHAT DO YOU GRADE IT</span>
          <span className="big" style={{ color: 'var(--red)' }}>{gradeText(c.grade, st.grades)}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 5, alignItems: 'center' }}>
          <button className="btn" style={{ padding: '9px 14px' }} disabled={c.grade <= 0}
            onClick={() => setClaim({ ...c, grade: Math.max(0, c.grade - 1) })}>◂</button>
          <div style={{ flex: 1, textAlign: 'center' }} className="sub">
            Your call. The rock has its own opinion and will not be arguing.</div>
          <button className="btn" style={{ padding: '9px 14px' }} disabled={c.grade >= 12}
            onClick={() => setClaim({ ...c, grade: Math.min(12, c.grade + 1) })}>▸</button>
        </div>
        <button className="btn go" style={{ width: '100%', marginTop: 14 }} onClick={done}>
          PUT IT IN THE BOOK ▸</button>
        <style>{CSS}</style>
      </div>
    )
  }

  if (st.phase === 'epilogue') {
    const choose = (kind: 'told' | 'kept') => setSt(x => endingStep(x, kind))
    const kind = endingFor(st)
    const honest = honestyOf(st)
    const pages = st.journal.length
    // NARR-8: the same cairn, and three different things to understand about it
    const body = kind === 'known' ? (
      <>
        <p style={{ margin: '0 0 10px' }}>
          There is a cairn up here. Six stones, the top one gone over with lichen,
          the kind of thing you would walk past.</p>
        <p style={{ margin: '0 0 10px' }}>
          Underneath it, in a freezer bag gone brittle and yellow: one page, folded twice.
          The same hand as the others. You have read enough of him by now to hear it.</p>
        <p style={{ margin: '0 0 10px' }}>
          He did it. Thirty years ago, on his own, in the same nine days of weather
          you have just used — and he told nobody. Not the book, not the locals,
          not Marge. He came down and he went home and he let it be. The last page
          says why, and it is not modesty. He writes that the line was the only thing
          he had ever done that nobody could take off him by having an opinion about it.</p>
        <p style={{ margin: '0 0 12px', color: 'var(--fade)' }}>
          You sit up there a while. The drainage runs out below you towards the road.
          There is nothing to say you were here either.</p>
      </>) : kind === 'partial' ? (
      <>
        <p style={{ margin: '0 0 10px' }}>
          There is a cairn up here. Six stones, the top one gone over with lichen.</p>
        <p style={{ margin: '0 0 10px' }}>
          Underneath it, in a freezer bag gone brittle and yellow: one page, folded twice.
          The same hand as the {pages} you found on the way in — you recognise it, which
          is more than most people would.</p>
        <p style={{ margin: '0 0 10px' }}>
          He was here. Thirty years ago, and he told nobody, and the page does not say why.
          Whatever the reason was, he put it somewhere else — in the pages you did not find,
          or in nothing at all. You are holding the end of a story you have most of.</p>
        <p style={{ margin: '0 0 12px', color: 'var(--fade)' }}>
          It sits badly. Not because you did not climb it. Because you did, and you still
          do not know what it meant to him.</p>
      </>) : (
      <>
        <p style={{ margin: '0 0 10px' }}>
          There is a cairn up here. Six stones, the top one gone over with lichen.
          Somebody built that. It was not the wind.</p>
        <p style={{ margin: '0 0 10px' }}>
          Underneath it, in a freezer bag gone brittle and yellow: one page, folded twice,
          in handwriting you have never seen before. A date. A line you cannot place.
          Some numbers that might be a grade or might be a time.</p>
        <p style={{ margin: '0 0 10px' }}>
          Somebody was up here before you and you have no idea who, or when, or what
          it cost them. You climbed the hardest thing on the wall and you are standing
          in the middle of somebody else's story without knowing you are in it.</p>
        <p style={{ margin: '0 0 12px', color: 'var(--fade)' }}>
          You could have found his pages. They were down there the whole time.</p>
      </>)
    const toldSub = kind === 'known'
      ? 'Second ascent, thirty years on. You know exactly whose name goes above yours.'
      : kind === 'partial'
      ? 'Second ascent, probably. You will have to leave the first line blank.'
      : 'First ascent, as far as the book will know. That is not the same as true.'
    const keptSub = kind === 'known'
      ? 'Leave it the way he left it, for the reason he left it. Nobody has to know.'
      : kind === 'partial'
      ? 'Put the stone back. Half a story is not yours to finish.'
      : 'Put the stone back. You do not know enough to put a name anywhere.'
    return (
      <div className={skin}>
        <div className="h1"><Lettered t="THE TOP" seed={101} /></div>
        <div className="sub">{pages} of {JOURNAL.length} pages · {gradeLabel(spec, st.grades)}</div>
        <InkRule seed={71} color="var(--ink)" />
        <div style={{ fontSize: 13, lineHeight: 1.7, marginTop: 10 }}>{body}</div>
        {honest !== 'none' && honest !== 'fair' ? (
          <div className="spot" style={{ borderLeftColor: 'var(--tan)' }}>
            <b style={{ color: 'var(--tan)' }}>AND ONE OTHER THING</b>
            {honest === 'sandbagged'
              ? 'You have been grading your own lines low all trip. Whatever you write in this book, somebody is going to get on it expecting easier.'
              : 'You have been grading your own lines high all trip. Whatever you write in this book, somebody is going to get on it and know.'}
          </div>) : null}
        <div className="lbl" style={{ marginTop: 8 }}>WHAT DO YOU DO</div>
        <div style={{ marginTop: 6 }}>
          <div className="menu-item" {...tap(() => choose('told'), 'Write your name in the book')}>
            <div className="big">{kind === 'stranger' ? 'Write your name' : 'Write your name under his'}</div>
            <div className="sub">{toldSub}</div>
          </div>
          <div className="menu-item" {...tap(() => choose('kept'), 'Put the stone back')}>
            <div className="big">Put the stone back</div>
            <div className="sub">{keptSub}</div>
          </div>
        </div>
        <style>{CSS}</style>
      </div>
    )
  }

  if (st.phase === 'runEnd') {
    const won = st.result === 'send'
    return (
      <div className={skin}>
        <div className="h1">{st.circuit ? 'CIRCUIT OVER' : won ? 'THE LOST LINE GOES' : 'RUN OVER'}</div>
        {/* UX-11: this said "Act 1" whatever act you actually died in */}
        <div className="sub">{ACT_NAMES[st.act]} · stage {st.tier + 1} · deck {st.runDeck.length}</div>
        <hr className="rule" />
        <div style={{ fontSize: 13, lineHeight: 1.6, margin: '10px 0' }}>
          {st.circuit
            ? `${st.circuitScore} lines sent${st.circuitScore >= st.bestCircuit ? ' — a new best.' : `. Best is ${st.bestCircuit}.`}`
            : won
            ? (st.ending.endsWith('told')
              ? `You wrote it in the book. Second ascent, thirty years after the first, and the first ascensionist named at last. People will come now. That was the choice.${
                st.styleMax > st.style ? ` ${ASCENT[st.style + 1].name} is open to you.` : ''}`
              : `You put the stone back and walked down. Two people have been up there and neither of them told anyone. It stays the way he found it.${
                st.styleMax > st.style ? ` ${ASCENT[st.style + 1].name} is open to you.` : ''}`)
            : st.psyche <= 0
              ? `You lost the psyche for it on ${spec.name}. Some trips end that way.`
              : `Skin ran out on ${spec.name}. The rock keeps.`}
        </div>
        {/* UX-11. The run-end screen said you won or died and nothing else,
            while the trail, the logbook, the lines you named and the pages you
            found were all being tracked. This is the account of the trip. */}
        {(() => {
          const ticked = ROUTES.filter(r => st.book[r.name])
          const hardest = ticked.reduce((a, r) => (r.grade > (a?.grade ?? -1) ? r : a),
            null as (typeof ROUTES)[number] | null)
          const flashed = ticked.filter(r => st.book[r.name].flashed).length
          const mine = st.established.slice(0, 1)
          const Line = ({ k, v }: { k: string; v: string }) => (
            <div className="row" style={{ padding: '2px 0' }}>
              <span className="sub">{k}</span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{v}</span></div>)
          return (<>
            <div className="lbl" style={{ marginTop: 4 }}>THE TRIP</div>
            {hardest ? <Line k="hardest thing you have sent" v={`${hardest.name} · ${gradeLabel(hardest, st.grades)}`} /> : null}
            <Line k="sent this trip" v={`${st.sends}`} />
            {flashed ? <Line k="flashed, ever" v={`${flashed}`} /> : null}
            <Line k="his journal" v={`${st.journal.length} of ${JOURNAL.length} pages`} />
            {mine.length ? <Line k="the last line you put up" v={`${mine[0].name} · ${gradeText(mine[0].claimed, st.grades)}`} /> : null}
            {st.tweak ? <Line k="carrying" v={`${st.tweak.kind}, ${st.tweak.runs} more trips`} /> : null}
            {st.trail.length ? (
              <>
                <div className="lbl" style={{ marginTop: 8 }}>HOW IT WENT</div>
                <div className="sub" style={{ color: 'var(--fade)', lineHeight: 1.5 }}>
                  {st.trail.join(' · ')}</div>
              </>) : null}
          </>)
        })()}
                <button className="btn go" style={{ width: '100%' }}
          onClick={() => { setSt(x => ({ ...x, inRun: false, circuit: false, skirmish: null,
            runDeck: [], tier: 0 })); toMenu() }}>
          BACK TO THE GUIDEBOOK</button>
        <style>{CSS}</style>
      </div>
    )
  }

  if (st.phase === 'sessionEnd') {
    const sent = st.result === 'send'
    return (
      <div className={skin}>
        <div className="h1">{sent ? 'SENT' : st.result === 'bail' ? 'WALKED AWAY' : 'NOT TODAY'}</div>
        <div className="sub">{spec.name} · {gradeLabel(spec, st.grades)} · {weather.name}, {rock.name}</div>
        {st.runSeed ? <div className="sub">seed {seedCode(st.runSeed)} — same seed, same run</div> : null}
        {st.ending ? (
          <div className="spot" style={{ borderLeftColor: 'var(--green)' }}>
            <b style={{ color: 'var(--green)' }}>
              {st.ending.startsWith('known') ? 'YOU KNEW WHOSE LINE IT WAS'
                : st.ending.startsWith('partial') ? 'YOU KNEW MOST OF IT'
                : 'YOU NEVER FOUND OUT WHOSE IT WAS'}</b>
            {st.ending.endsWith('told')
              ? 'You put it in the book.'
              : 'You put the stone back and left it alone.'}
            {st.ending.startsWith('stranger')
              ? ' His pages were down there the whole time — there is another way to end this.'
              : st.ending.startsWith('partial')
              ? ' Find more of his pages and you get the rest of it.'
              : ''}
          </div>) : null}
        {st.dailyDay === dayKey() && st.dailyScore > 0 ? (
          <div className="spot" style={{ borderLeftColor: 'var(--tan)' }}>
            <b style={{ color: 'var(--tan)' }}>TODAY'S PROBLEM · {st.dailyScore}</b>
            {st.dailyScore >= st.dailyBest ? 'Your best on a daily yet. ' : `Your best is ${st.dailyBest}. `}
            {st.dailyStreak > 1 ? `${st.dailyStreak} days running.` : 'Come back tomorrow and keep it going.'}
          </div>) : null}
        <hr className="rule" />
        <div style={{ fontSize: 13, lineHeight: 1.6, margin: '9px 0' }}>
          {sent ? `Topped out on burn ${st.burn}.`
            : `Burns used ${st.burn}/${attemptsFor(st)}. Got ${st.cleared} of ${spec.clear}.`}
        </div>
        <div className="lbl">BETA BANKED</div>
        <div className="sub" style={{ margin: '3px 0 12px' }}>
          {st.beta.length ? st.beta.join(' · ') : 'nothing stuck'}</div>
        <button className="btn go" style={{ width: '100%' }}
          onClick={toMenu}>BACK TO THE GUIDEBOOK</button>
        <style>{CSS}</style>
      </div>
    )
  }

  if (st.phase === 'burnEnd') {
    const sent = st.result === 'send'
    const last = st.burn >= attemptsFor(st) || st.skin <= 1
    const prev = st.book[spec.name]
    const flash = sent && st.burn === 1
    const headline = sent
      ? (flash ? 'FLASHED IT' : st.burn === 2 ? 'SECOND GO' : 'WORKED IT OUT')
      : (st.cleared >= spec.clear - 2 ? 'SO CLOSE' : st.cleared === 0 ? 'NOTHING DOING' : 'OFF')
    const line = sent
      ? (flash ? 'First go, no beta, no rehearsal. That is the one you tell people about.'
        : st.burn === 2 ? 'Off once, back on, done. That is how it usually goes.'
        : `${st.burn} burns. You earned that one.`)
      : (st.cleared >= spec.clear - 2 ? 'That was nearly it. You know where it goes now.'
        : st.cleared === 0 ? 'Did not get off the ground. It happens.'
        : 'You know it better than you did.')
    const paid = sent && st.inRun ? cashForSend(spec.grade) * (st.onProject ? 2 : 1) : 0
    const xp = sent ? xpForSend(spec.grade) : 0
    const Stat = ({ k, v, hot }: { k: string; v: string; hot?: boolean }) => (
      <div style={{ flex: 1, minWidth: 74 }}>
        <div className="lbl">{k}</div>
        <div className="big" style={{ color: hot ? 'var(--red)' : undefined }}>{v}</div>
      </div>)
    return (
      <div className={skin}>
        <div className="row">
          <span className="h1"><Lettered t={headline} seed={sent ? 41 : 17} /></span>
          <span className="big" style={{ color: sent ? 'var(--green)' : 'var(--red)' }}>
            {gradeLabel(spec, st.grades)}</span></div>
        <div className="sub">{spec.name} · burn {st.burn} of {attemptsFor(st)}
          {st.line ? ` · ${LINES[st.line].name.toLowerCase()}` : ''}</div>
        <InkRule seed={sent ? 63 : 64} color="var(--ink)" />
        <div style={{ fontSize: 13, lineHeight: 1.6, margin: '9px 0' }}>{line}</div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <Stat k="HOLDS" v={`${Math.min(st.cleared, spec.clear)}/${spec.clear}`} />
          <Stat k="TURNS" v={String(st.turn)} />
          <Stat k="HIGHEST PUMP" v={`${st.peakPump}/${PUMP_MAX}`}
            hot={st.peakPump >= PUMP_MAX - 2} />
        </div>
        <div className="sub" style={{ marginTop: -4, marginBottom: 10 }}>
          ☁ {weather.name} · ⛰ {rock.name}
          {st.beta.length && sent ? ` · ${st.beta.length} move${st.beta.length > 1 ? 's' : ''} you will remember` : ''}
        </div>

        {sent && st.inRun ? (
          <div className="spot" style={{ borderLeftColor: 'var(--green)' }}>
            <b style={{ color: 'var(--green)' }}>CHALKED</b>
            +{xp} xp{paid ? ` · $${paid}` : ''}{st.psyche < PSYCHE_MAX ? ' · psyche back' : ''}
            {prev ? `. ${prev.sends + 1}${['th','st','nd','rd'][(prev.sends + 1) % 10] ?? 'th'} time on it, best ${Math.min(prev.bestBurn, st.burn)} burn${Math.min(prev.bestBurn, st.burn) > 1 ? 's' : ''}.`
              : '. First entry in the book for this one.'}
          </div>) : null}
        {!sent ? (
          <div className="spot">
            <b>WHAT STUCK</b>
            {st.beta.length ? st.beta.join(' · ') : 'nothing yet'}
            {last ? '. That is the last burn in you today.' : `. ${attemptsFor(st) - st.burn} burn${attemptsFor(st) - st.burn > 1 ? 's' : ''} left.`}
          </div>) : null}

        <div className="lbl" style={{ marginTop: 6 }}>HOW IT WENT</div>
        <div className="log">{st.log.slice(-7).map((l, i) => <div key={i}>{l}</div>)}</div>
        <button className="btn go" style={{ width: '100%', marginTop: 9 }} onClick={afterBurn}>
          {sent ? 'DOWN OFF THE TOP' : last ? 'THAT IS THE DAY' : 'PULL ON AGAIN'}</button>
        <style>{CSS}</style>
      </div>
    )
  }

  return (
    <div className={skin}>
      <div className="row">
        <span className="h1"><Lettered t={spec.name.toUpperCase()} seed={st.routeIdx * 3 + 2} /></span>
        <span className="sub" style={{ color: 'var(--red)', fontWeight: 700 }}>burn {st.burn}/{attemptsFor(st)}</span>
      </div>
      <div style={{ margin: '4px 0 2px' }}>
        <span className="cond">☁ {weather.name.toUpperCase()}</span>
        <span className="cond">⛰ {rock.name.toUpperCase()}</span>
        <span className="sub">{st.inRun
          ? `skin ${st.skin} · psyche ${st.psyche}${st.psyche <= DOUBT_AT ? ' — doubt' : ''}${st.topRope ? ' · toprope' : ''}${st.mutators.length ? ` · ${st.mutators.length} mutators` : ''}`
          : `skin ${'●'.repeat(st.skin)}${'○'.repeat(Math.max(0, SKIN_MAX - st.skin))}`}</span>
      </div>
      <div className="sub">{weather.text} {rock.text}</div>

      <Topo cleared={st.cleared} total={spec.clear} seed={st.routeIdx * 7 + st.burn} />
      <div className="row">
        <span className="goal">{remaining === 0 ? 'TOP OUT!' : `${remaining} MORE HOLD${remaining === 1 ? '' : 'S'} TO TOP OUT`}</span>
        <span className="lbl">{st.cleared}/{spec.clear}</span>
      </div>
      <hr className="rule" />

      <div className="board">
        {[0, 1, 2].map(i => {
          const h = st.boardH[i]
          if (!h) return <div key={`${i}-${st.motion ? st.fxTick : 0}`} className="slot foe empty"
            aria-label={`${LANE_NAMES[i]}: nothing on it`}>
            <Ink w={117} h={120} seed={900 + i} color="var(--fade)" sw={1.1} />
            <span className="tx">clean</span></div>
          const ab = abilityOf(h)
          return (
            <div key={`${i}-${st.motion ? st.fxTick : 0}`}
              className={`slot foe${sel?.gripCut && sel.kind === 'bonus' ? ' tgt' : ''}` +
                (st.fxLane[i] === 'clear' ? ' fx-clear' : '')}
              {...tap(() => tapLane(i), `${LANE_NAMES[i]} hold: ${h.crux ? 'crux, ' : ''}`
                + `${holdLabel(h)}, ${(g => g.sure ? `${g.lo} grip` : `${g.lo} to ${g.hi} grip, not worked yet`)(gripShown(st, h))}`
                + `, ${biteAgainst(st, st.boardP[i], h, i)} bite`
                + (lanes ? `. ${lanes[i].clears ? 'This works it' : `${lanes[i].gripLeft} grip would remain`}` : ''))}>
              <Ink w={117} h={120} seed={h.uid} color={h.crux ? 'var(--red)' : 'var(--ink)'}
                sw={h.crux ? 2.2 : 1.5} />
              {/* the shape, big and behind the words, plus a small one in the
                  corner so it is still legible where the wash is faint */}
              {/* VIS-2: 22px to 26px and darker. Four placements were tried and
                  three had to be abandoned — behind the text needs a wash the
                  words survive, and the band above the pump line is where the
                  preview sits. A long name would wrap into anything bigger than
                  this, so the corner at 26px is the whole safe headroom. */}
              <div className="gl"><Glyph name={h.name} size={26}
                color={h.crux ? 'var(--red)' : 'var(--ink)'} /></div>
              <div>
                <div className="nm" style={h.crux || h.sig ? { color: 'var(--red)' } : undefined}>
                  {h.crux ? '★ ' : ''}{holdLabel(h).toUpperCase()}</div>
                {ab && <div className="ab">{ab.toUpperCase()}</div>}
                <div className="tx" style={{ marginTop: 2 }}>
                  {h.clean ? 'brushed clean' : (HOLD_STATS[h.name] ?? FEET_STATS[h.name])?.text}
                </div>
              </div>
              {(() => { const g = gripShown(st, h)
                return <Pips o={biteAgainst(st, st.boardP[i], h, i)} d={g.lo}
                  hi={g.sure ? undefined : g.hi} /> })()}
              {(() => {
                const pv = lanes![i]
                if (!pv.card) return pv.biteToPump
                  ? <div className="pv bad">+{pv.biteToPump} PUMP</div> : null
                return pv.clears
                  ? <div className="pv good">WORKS IT</div>
                  : <div className="pv mid">{pv.gripLeft} GRIP LEFT</div>
              })()}
            </div>
          )
        })}
      </div>
      <div className="lanes">{LANE_NAMES.map(n => <div key={n} className="lbl">{n}</div>)}</div>
      <div className="board">
        {[0, 1, 2].map(i => {
          const c = st.boardP[i]
          if (!c) return <div key={`${i}-${st.motion ? st.fxTick : 0}`}
            className={`slot you empty${st.fxLane[i] === 'blow' ? ' fx-blow' : ''}`}
            {...tap(() => tapLane(i), `${LANE_NAMES[i]}: empty. Place a card here`)}>
            <Ink w={117} h={120} seed={700 + i} color="var(--fade)" sw={1.1} />
            <span className="tx">{i === 2 ? 'no feet' : 'open'}</span></div>
          const h = st.boardH[i]
          return (
            <div key={`${i}-${st.motion ? st.fxTick : 0}`}
              className={`slot you${st.fxLane[i] === 'bite' ? ' fx-bite' : ''}`}
              {...tap(() => tapLane(i), `${LANE_NAMES[i]}: your ${c.name}, `
                + `${h ? powerAgainst(st, c, h, i) : c.power} power, ${c.contact} contact`
                + (lanes && lanes[i].card ? `. ${lanes[i].blows ? 'This burns out' : 'This holds on'}` : ''))}>
              <Ink w={117} h={120} seed={c.uid} />
              <Fam c={c} size={17} />
              {st.order.indexOf(i) >= 0 && st.boardP.filter(Boolean).length > 1 ? (
                <div style={{ position: 'absolute', top: 4, right: 5, fontSize: 10,
                  fontWeight: 700, color: 'var(--fade)' }}>
                  {st.order.indexOf(i) + 1}</div>) : null}
              <div><div className="nm">{c.name.toUpperCase()}</div>
                {c.opposes && i < 2 ? (
                  <div className="ab" style={{
                    color: st.boardP[1 - i]?.opposes ? 'var(--green)'
                      : st.boardP[1 - i] ? 'var(--fade)' : 'var(--red)' }}>
                    {st.boardP[1 - i]?.opposes ? `OPPOSED +${OPPOSE_PAIR}`
                      : st.boardP[1 - i] ? 'OPPOSITION'
                      : `NOTHING TO PULL AGAINST ${OPPOSE_ALONE}`}</div>) : null}
                {c.fx === 'greedy' ? (
                  <div className="ab" style={{
                    color: desperationOf(st) > 0 ? 'var(--red)' : 'var(--fade)' }}>
                    {desperationOf(st) > 0 ? `FIGHTING +${desperationOf(st)}` : 'NOT PUMPED ENOUGH'}</div>) : null}
                {lanes && lanes[i]?.stick !== undefined ? (
                  <div className="ab" style={{
                    color: lanes[i].stick! >= 0.7 ? 'var(--green)'
                      : lanes[i].stick! >= 0.45 ? 'var(--tan)' : 'var(--red)' }}>
                    STICK {Math.round(lanes[i].stick! * 100)}%</div>) : null}
                {(c.settled ?? 0) > 0 && <div className="ab">SETTLED +{c.settled}</div>}
                <div className="tx" style={{ marginTop: 2 }}>{c.text}</div></div>
              <Pips o={h ? powerAgainst(st, c, h, i) : c.power} d={c.contact} />
              {(() => {
                const pv = lanes![i]
                if (!pv.card || !pv.hold) return null
                return pv.blows
                  ? <div className="pv bad">{c.anchor ? 'COMES OFF' : 'BURNS OUT'}</div>
                  : <div className="pv mid">HOLDS · {pv.contactLeft}</div>
              })()}
            </div>
          )
        })}
      </div>
      <div className="row" style={{ marginTop: 2 }}>
        <span className="lbl">YOU</span>
        <span className="lbl">{st.boardP[2] ? `SUPPORT +${st.boardP[2]!.support}` : `CAMPUSING +${CAMPUS_BITE} BITE`}</span>
      </div>

{/* VIS-1. The meter showed where you are. `previewPump` has been computing
          where COMMIT puts you since UX-4 and never drew it — which is the whole
          push-your-luck decision, sitting one function call away. */}
      {(() => {
        const after = Math.min(PUMP_MAX, pumpAfter)
        const off = pumpAfter >= PUMP_MAX
        const climbing = pumpAfter > st.pump
        const near = after >= PUMP_MAX - 2 || off
        return (<>
          <div className="row" style={{ marginTop: 8 }}>
            <span className="lbl">PUMP</span>
            <span className="lbl" style={{ color: off ? 'var(--red)'
              : near ? 'var(--red)' : 'var(--tan)' }}>
              {st.pump} / {PUMP_MAX}
              {st.phase === 'climb' && pumpAfter !== st.pump
                ? ` · ${climbing ? '▴' : '▾'} ${after} AFTER THIS` : ''}
              {off ? ' · THAT IS A FALL' : ''}</span>
          </div>
          <div className={`bar${st.fxLane.some(Boolean) ? ' hot' : ''}${near ? ' tremble' : ''}`}
            key={`p-${st.fxTick}`}
            role="meter" aria-valuemin={0} aria-valuemax={PUMP_MAX} aria-valuenow={st.pump}
            aria-label={`Pump ${st.pump} of ${PUMP_MAX}.`
              + (st.phase === 'climb' && pumpAfter !== st.pump
                ? ` ${after} after this turn.${off ? ' That is a fall.' : ''}` : '')}
            style={{ marginTop: 2 }}>
            {Array.from({ length: PUMP_MAX }, (_, i) => {
              const on = i < st.pump
              // where committing puts you, drawn ahead of where you are
              const ghost = !on && st.phase === 'climb' && i < after
              const shed = on && st.phase === 'climb' && i >= after
              return (<div key={i} className={
                `seg${on && !shed ? (i >= PUMP_MAX - 2 ? ' danger' : ' on') : ''}`
                + (ghost ? (off ? ' willfall' : ' will') : '') + (shed ? ' shedding' : '')} />)
            })}
          </div>
        </>)
      })()}
      {spec.roped ? (
        <div className="row" style={{ marginTop: 3 }}>
          <span className="lbl" style={{ color: st.runout >= 4 ? 'var(--red)' : 'var(--fade)' }}>
            RUNOUT {st.runout}{st.lastPiece < 0 ? ' · NOTHING IN' : ''}</span>
          <span className="lbl">PITCH {st.pitch + 1}/{spec.pitches ?? 1}</span>
        </div>) : null}
      {exposed(st) ? (
        <div className="sub" style={{ color: 'var(--red)', marginTop: 2 }}>
          ▲ EXPOSED · {Math.round(exposureOf(st) * 100)}% up — backing off now costs an extra psyche</div>) : null}
      <div className="row" style={{ marginTop: 2 }}>
        <span className="sub">turn {st.turn} · {st.line ? `${LINES[st.line].name.toLowerCase()} · ` : ''}
          flow {st.flow >= FLOW_AT ? '▸▸ −1 tax' : '—'}</span>
        <span className="sub tap" {...tap(() => setSheet(true))}>
          deck {st.piles.draw.length} · discard {st.piles.discard.length} · gone {st.piles.exhaust.length}</span>
      </div>

      <div className="hand">
        {st.piles.hand.map(c => (
          <div key={c.uid} className={`card${st.selected === c.uid ? ' sel' : ''}${c.kind === 'bonus' ? ' bonus' : ''}`}
            {...tap(() => tapHandCard(c),
              `${c.name}. ${c.kind === 'move' ? `${c.power} power, ${c.contact} contact` : `costs ${c.cost} pump`}`
              + `. ${c.text}${st.selected === c.uid ? '. Selected' : ''}`)}>
            <Ink w={112} h={124} seed={c.uid} deckle={3}
              color={st.selected === c.uid ? 'var(--red)' : 'var(--ink)'}
              sw={st.selected === c.uid ? 2.2 : 1.4} />
            <Fam c={c} />
            <div><div className="nm">{c.name.toUpperCase()}</div>
              <div className="tx" style={{ marginTop: 2 }}>
                {c.kind === 'bonus' ? `${c.cost} pump` : c.lane === 'feet' ? 'feet' : c.lane === 'any' ? 'any' : 'hand'}
              </div></div>
            <div><div className="tx" style={{ marginBottom: 3 }}>{c.text}</div>
              {c.kind === 'move' ? <Pips o={c.power} d={c.contact} /> : null}</div>
          </div>
        ))}
      </div>
      <div className="vis-hidden" role="status" aria-live="assertive">
        {st.log.length ? st.log[st.log.length - 1] : ''}</div>
      {st.boardP.filter(Boolean).length > 1 ? (
        <div className="sub" style={{ marginTop: 2 }}>
          They go in the order you placed them — a hand that comes off stops holding
          for the other one.</div>) : null}
      <div className="row" style={{ marginTop: 8, alignItems: 'center' }}>
        <button className="btn" disabled={!undo.length}
          onClick={() => { if (!undo.length) return
            sfx('tap', st.sound)
            setSt(undo[undo.length - 1]); setUndo(u => u.slice(0, -1)) }}>
          ◂ TAKE IT BACK</button>
        {(() => {
          const after = pumpAfter
          const d = after - st.pump
          const off = after >= PUMP_MAX
          return (
            <span style={{ fontSize: 12, fontWeight: 700,
              color: off ? 'var(--red)' : d > 0 ? 'var(--tan)' : 'var(--green)' }}>
              {off ? 'THIS TAKES YOU OFF' : `PUMP ${st.pump} → ${after}`}
            </span>)
        })()}
        <button className="btn go" onClick={commit}>COMMIT ▸</button>
      </div>
      <div className="row" style={{ marginTop: 3 }}>
        <span className="sub tap" {...tap(bail)}>bail off this one</span>
        <span className="sub">burn {st.burn} of {attemptsFor(st)}</span>
      </div>
      {sheet ? (
        <div className="sheet" {...tap(() => setSheet(false), 'Close what is left')}>
          <div className="sheetin" onClick={e => e.stopPropagation()}>
            <div className="row"><span className="h1" style={{ fontSize: 17 }}>WHAT IS LEFT</span>
              <button className="btn" style={{ padding: '5px 10px', fontSize: 11 }}
                onClick={() => setSheet(false)}>CLOSE</button></div>
            <InkRule seed={67} color="var(--ink)" />
            {([
              ['STILL TO COME', st.piles.draw, 'Contents, not order — you do not get to see the shuffle.'],
              ['DISCARDED · comes back on a reshuffle', st.piles.discard, ''],
              ['BURNT OUT · gone for this burn', st.piles.exhaust, ''],
            ] as [string, Card[], string][]).map(([title, list, note]) => {
              const byName = new Map<string, { c: Card; n: number }>()
              for (const c of list) {
                const e = byName.get(c.name)
                if (e) e.n++; else byName.set(c.name, { c, n: 1 })
              }
              const rows = Array.from(byName.values()).sort((a, b) => a.c.name.localeCompare(b.c.name))
              return (
                <div key={title}>
                  <div className="lbl" style={{ marginTop: 9 }}>{title} · {list.length}</div>
                  {note ? <div className="sub" style={{ marginBottom: 2 }}>{note}</div> : null}
                  {rows.length ? rows.map(({ c, n }) => (
                    <div key={c.name} className="deckrow">
                      <div className="nmx">
                        <div className="t1" style={{ color: c.upgraded ? 'var(--green)' : undefined }}>
                          {c.name}{n > 1 ? ` ×${n}` : ''}</div>
                        <div className="t2">{c.text}</div>
                      </div>
                      <span className="cnt" style={{ color: 'var(--red)' }}>
                        {c.kind === 'move' ? c.power : c.cost}</span>
                      <span className="cnt" style={{ color: 'var(--green)' }}>
                        {c.kind === 'move' ? c.contact : ''}</span>
                    </div>)) : <div className="sub">nothing</div>}
                </div>)
            })}
          </div>
        </div>) : null}
      {st.routeMove ? (
        <div className="spot" role="status" aria-live="polite"
          style={{ borderLeftColor: st.routeMove.kind === 'dry' ? 'var(--green)' : 'var(--red)' }}>
          <b style={{ color: st.routeMove.kind === 'dry' ? 'var(--green)' : 'var(--red)' }}>
            NEXT TURN</b>{st.routeMove.text}</div>) : null}
      {st.seq && seqById(st.seq.id) ? (
        <div className="spot" style={{ borderLeftColor: 'var(--green)' }}>
          <b style={{ color: 'var(--green)' }}>
            {seqById(st.seq.id)!.name.toUpperCase()} · {st.seq.left} MORE</b>
          Keep it alive: {seqNeedText(seqById(st.seq.id)!)} this turn.</div>) : null}
      {phase ? <div className="spot" style={{ borderLeftColor: 'var(--ink)' }}>
        <b style={{ color: 'var(--ink)' }}>{phase.name.toUpperCase()}</b>{phase.text}</div> : null}
      {(() => {
        const nx = st.phase === 'climb' ? nextPhase(st) : null
        if (!nx || nx.away > 2) return null
        return (
          <div className="spot" style={{ borderLeftColor: 'var(--tan)' }}>
            <b style={{ color: 'var(--tan)' }}>
              {nx.away} HOLD{nx.away === 1 ? '' : 'S'} TO {nx.p.name.toUpperCase()}</b>
            {nx.p.text}</div>)
      })()}
      {tip ? <div className="spot" role="status" aria-live="polite">
        <b>FROM THE GROUND</b>{tip}</div> : null}
      <div className="log">{st.log.slice(-3).map((l, i) => <div key={i}>{l}</div>)}</div>
      <style>{CSS}</style>
    </div>
  )
}

