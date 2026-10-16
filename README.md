# Boss Fight Development

Boss battles for **Just a Clicker Game**. `reference/` holds copies of the shipped game files, for reference only.

## The bosses: `src/bosses.js`

All three bosses live in one file, `src/bosses.js`, and that file is the whole deliverable. It creates every element and style it needs at runtime. It doesn't edit `index.html` and doesn't depend on any element or class in it, so it can't collide with ongoing work on that file.

| Section | Status |
|---|---|
| 1. `BossKit`: the shared stage (intro card, boss bar with damage trail, pop-ups, hints, flashes, result card, SVG icons) | done |
| 1b. `BossAudio`: the bosses' soundtrack and sound effects, synthesized live with Web Audio (no audio files) | done |
| 2. `AnomalyBoss`: the Reality Breach | done |
| 3. `MemoryLeakBoss`: the Memory Leak | done |
| 4. `FirewallBoss`: the Firewall Entity | next |

Development tools (none of these ship):

| File | What it is |
|---|---|
| `tools/viewer.js` | Builds a self-contained preview page: a stand-in for the parts of the game a boss touches, `bosses.js` inlined, and a panel to spawn the boss and skip to any phase. |
| `tests/reality-breach.test.js` | Plays every Reality Breach mechanic in Chromium (57 checks, including that the music plays, switches per phase and stops), using the viewer page. |
| `tests/balance.js` | Scripted players fight the breach to the end and report wins and time left. |
| `tests/memory-leak.test.js` | Plays every Memory Leak mechanic in Chromium (52 checks, including a phone with a finger). |
| `tests/balance-leak.js` | Scripted players fight the Memory Leak to the end and report wins, peak heap and phase times. |

## Reality Breach

### The fight

- **The shell.** Six plates open and close on an uneven rhythm and flicker white just before they shut. A hit on a shut shell is reflected: it heals the breach 1.2% and steals 2 s of income.
- **The weak point.** A small glowing mark on the rim. A hit on it does 3 damage and sends the mark elsewhere on the rim. It sits still in phase I, drifts in phase II and races in phase III. Anywhere else on the body is a 1-damage graze.
- **Phase I.** Stands still and teaches the shell.
- **Phase II: find the real one.** It makes two echoes. Echoes flicker every 0.35-0.8 s and their shards orbit the other way; the real breach is steady, and its eye follows the mouse cursor. Echoes can't be killed: hitting one draws a beam to the real breach and heals it 0.6% (at most once a second per echo). All three bodies shuffle every 5.5 s, and each landing spot is marked a moment before. Its shell stays open longer than in the other phases.
- **Phase III: enraged.** One rhythm. Each time its shell shuts, it fires two projectiles at the energy counter and jumps somewhere new (the spot is marked first): that's the moment to shoot them down. While the shell is open, it holds still: that's the moment to hit it. A projectile that lands steals 6 s of income and heals it 1.5%.
- **The seal.** At 0 HP it doesn't die. A marker sweeps a ring with three arcs. Press (click, Space or Enter) as the marker crosses the lit arc, three times within 7 s. After each lock the marker reverses and speeds up. A miss lets it tear free with 15% HP.
- **Phase lines** sit at 65% and 40% of HP, so phase II is the shortest stretch.
- **Phase lines hold.** Every phase boundary is a short stagger where it can't be hurt, so one big hit can't skip a phase. Heals never climb back over a line already crossed, so a phase you've won stays won.
- **Rewards.** Unchanged in kind: everything it ate comes back, plus a 225-900 s income bounty (`_birdPay`) and fragments (x3 with Breach Protocol). A clean fight (no mistakes) pays x1.5. The result card gives a grade from S to C.
- **Escape.** It has 150-179 HP and 105 s. If it escapes, it keeps what it ate and instability rises by 15, as before.
- **Soundtrack.** Each phase has its own music, all synthesized live in D phrygian: phase I is sparse and watchful (112 BPM), phase II drives with a stuttering arpeggio and glitches (124), phase III is four-on-the-floor with a distorted bass (140), and the seal drops to a heartbeat under a drone. Every mechanic has a sound, and two of them are tells you can play by: a rising tone as the shell starts to close, and a tick as the seal's marker enters the lit arc. While boss music plays, the game's own music director is held (`GameMusic.hold`) and released after, so the two never overlap; the game's one-shot sounds are quiet for the fight too, since the boss supplies its own. It obeys the player's sound switch and the Music / Effects sliders.
- **Touch.** Strikes register on the press, not the click, so a tap counts even if the breach moves before the finger lifts, and quick taps are never taken for a zoom. The weak point is half again as big for a finger.
- **No emoji or glyph characters** appear anywhere a player can see. Icons and art are generated SVG, and the test checks that all visible text is ASCII.

**Balance** (`node tests/balance.js 5`: scripted players at 4x speed; after every shuffle or jump they take time to find the real one again, and some guess meanwhile):

| Player | Wins | Time left (of 105 s) | Phase I / II / III |
|---|---|---|---|
| Mouse, skilled (6.5 clicks/s) | 5 of 5 | about 85 s | 8 / 4 / 9 s |
| Mouse, sloppy (1 in 5 clicks on an echo, hits the closing shell, misses half the projectiles) | 5 of 5 | about 65 s | 11 / 10 / 13 s |
| Touch, good (4.5 taps/s) | 5 of 5 | about 70 s | 11 / 9 / 15 s |
| Touch, casual (3.7 taps/s, slow to spot the real one, slow to re-find it after a jump, more mistakes) | 5 of 5 | about 38 s | 19 / 20 / 27 s |

### Integration into the game

1. Remove the old block from `game.js`. It starts at the banner `ANOMALY BOSS — the Reality Breach` (reference line 23745) and ends at `window.AnomalyBoss = AnomalyBoss;` (reference line 24011). Keep `BossStage` above it, because the old Memory Leak still uses it until that boss moves into `bosses.js`.
2. Load `bosses.js` once, after `game.js`. That one script tag is the only thing the game's `index.html` needs. Nothing else in it is edited or relied on.
3. Nothing else needs to change. Everything that touches the old boss keeps working:
   - `music.js` reads `AnomalyBoss._active`.
   - The Auto-Breach Firewall calls `hit(n, 'firewall')` and uses `_autoHitAccum`.
   - The run reset calls `resetForNewRun()`, and the quit sweep calls `cancel()`.
   - The save hoard is still `state._breachHoard`.
   - systems3's reality tear still finds `#anomaly-boss`.

Behaviour changes from the old boss:
- The Auto-Breach Firewall can't hit a shut shell and can't perform the seal. A person has to finish the fight.
- The spawn gate is a single 1e8 energy check. A roll that fails to spawn now waits for the next 15 s roll instead of re-rolling every tick.

Sounds: the boss plays its own (`BossAudio`). Only where Web Audio is unavailable does it fall back to the game's existing `sfx:breach`, `stinger:eventWin`, `stinger:eventFail` and `Sounds.click`.

## Memory Leak

A cracked RAM stick hangs under the boss bar and drips allocated memory blocks onto the screen. Every block left standing fills your **heap** faster, and the heap also fills on its own. At 100% the leak takes the simulation. Tap a block to free it: the leak loses 1 integrity and the heap drops a little.

- **The garbage collector.** Every block you free by hand charges it. At 16 it lights up: press it (or G) to free every block on screen at once and drop the heap 20%. It replaces the old typed command, which doesn't work on touch. Typing `EXECUTE GARBAGE_COLLECTION` still works as a desktop shortcut through `tryCommand`.
- **Phase I: allocation.** Plain 16 KB and 32 KB blocks, a little under two a second, with a burst of two every eighth drip. It teaches the heap.
- **Phase II: pointers.** Some blocks arrive as a numbered chain of three, joined by dashed lines. Free them 1, 2, 3. Out of order is a **segfault**: nothing is freed and the heap jumps 5%. A whole chain in order deals 3 bonus damage and drops the heap 6%.
- **Phase III: fragmentation.** The shortest stretch. One block in five is a big 64 KB block that splits into two 16 KB blocks when freed.
- **Recall.** At 0 integrity it doesn't die. Its blocks are pulled back into the stick, and a 3 x 3 grid of memory cells lights three of them in turn, slowly, each with its own tone. Tap them back in the same order (or type their numbers 1 to 9) within 10 s. A wrong cell, or running out of time, plays the sequence again; only the third miss reallocates it with 15% integrity and phase III resumes.
- **Phase lines** sit at 65% and 25% of integrity. Each is a stagger that also clears 15% of the heap, and freeing never climbs back over a line already crossed.
- **Rewards.** Unchanged in kind: 120-480 s of income (`_birdPay`) and 3 fragments. A clean fight (no segfault, no wrong cell, heap never past 80%) pays the bounty x1.5 and 5 fragments. The result card gives a grade. Out of memory: instability +25%, as before.
- **When it comes.** Unchanged: prestige 2 or more, instability over 75%, 45 minutes since the last one, then a 1% roll every 30 s.
- **Soundtrack.** Its own songs in E minor: chiptune pulses for allocation (118 BPM), a driving arpeggio for pointers (128), a distorted bass for fragmentation (142), and a quiet pulse for the recall, where each cell has its own note. Sounds for every drip, free, segfault, finished chain and collection, and a double beep while the heap is over 80%.

**Balance** (`node tests/balance-leak.js 5`: scripted players at 4x speed; a new block takes them a moment to notice, and they make chain and recall mistakes at their own rates). The `human` player is the one to trust: earlier tuning against faster bots left the fight far too hard for a person on a phone.

| Player | Wins | Peak heap | Phase I / II / III |
|---|---|---|---|
| Mouse, skilled (6.5 clicks/s) | 3 of 3 | about 14% | 24 / 12 / 8 s |
| Touch, a person on a phone (2.5 taps/s, a second to notice new blocks, slow to use the collector, a chain mistake in four) | 6 of 6 | about 23% | 25 / 17 / 9 s |

### Integration into the game

1. Remove the old block from `systems3.js`. It starts at `/* ── 8. MEMORY LEAK BOSS` (reference line 554) and ends at `window.MemoryLeakBoss = MemoryLeakBoss;` (reference line 771).
2. With both bosses moved into `bosses.js`, nothing uses `BossStage` in `game.js` any more (the banner `BOSS STAGE — the frame the bosses share`, reference lines 23646 to 23743, ending at `window.BossStage = BossStage;`). It can go too.
3. `#memory-leak-terminal` in `index.html` is no longer used. It can stay where it is; nothing in `bosses.js` needs it, and nothing in `index.html` has to change for this boss.
4. Everything that touches the old boss keeps working: `game.js` calls `MemoryLeakBoss.tick()` and `MemoryLeakBoss.cancel()`, and `music.js` reads `MemoryLeakBoss.isActive()`.

### Running

```sh
node tools/viewer.js   # writes preview.html (git-ignored); open it in a browser
node tools/viewer.js out.html --artifact   # the same page, shaped for publishing as a review artifact
node tests/memory-leak.test.js             # the Memory Leak's checks
node tests/balance-leak.js 5               # the Memory Leak's balance
npm install            # or reuse a global playwright: NODE_PATH=$(npm root -g)
npm test               # npm run test:shots also writes screenshots to tests/shots/
```
