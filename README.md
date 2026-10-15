# Boss Fight Development

Boss battles for **Just a Clicker Game**. `reference/` holds copies of the shipped game files, for reference only.

## Reality Breach (rebuilt)

| File | What it is |
|---|---|
| `src/boss-kit.js` | The shared boss stage: intro card, boss bar with damage trail, pop-ups, hints, flashes, result card, SVG icon set. Self-styled, so it doesn't depend on `game.css`. |
| `src/reality-breach.js` | The boss. Drop-in replacement for `AnomalyBoss` in `game.js`, with the same global name and public API. |
| `sandbox/index.html` | Plays the fight on its own, with the game's globals stubbed. Has buttons to skip to each phase. |
| `tests/reality-breach.test.js` | Plays every mechanic in Chromium (45 checks). |

### The fight

- **The shell.** Six plates open and close on an uneven rhythm and flicker white just before they shut. A hit on a shut shell is reflected: it heals the breach and steals 2 s of income.
- **The core.** Hitting the inner ring is a critical hit (2 damage). Hitting the rest of the body is a graze (1 damage).
- **Phase I.** Stands still and teaches the shell.
- **Phase II: it splits.** It makes three echoes. Only the real breach's pupil follows your cursor, and the echoes' shards orbit the other way. Hitting an echo heals the real one by 2. All four bodies shuffle every 4 s, and each landing spot is marked a moment before.
- **Phase III: enraged.** It jumps around the screen, with each jump marked first, and fires tears at the energy counter. A tear that lands steals 6 s of income and heals it by 2. You can shoot tears down.
- **The seal.** At 0 HP it doesn't die. A marker sweeps a ring with three arcs. Press (click, Space or Enter) as the marker crosses the lit arc, three times within 7 s. After each lock the marker reverses and speeds up. A miss lets it tear free with 15% HP.
- **Phase lines.** Every phase boundary is a short stagger where it can't be hurt, so one big hit can't skip a phase.
- **Rewards.** Unchanged in kind: everything it ate comes back, plus a 225-900 s income bounty (`_birdPay`) and fragments (x3 with Breach Protocol). A clean fight (no mistakes) pays x1.5. The result card gives a grade from S to C.
- **Escape.** If it escapes, it keeps what it ate and instability rises by 15, as before.
- **No emoji or glyph characters** appear anywhere a player can see. Icons and art are generated SVG, and the test checks that all visible text is ASCII.

### Integration into the game

1. In `game.js`, delete the old block. It starts at the banner `ANOMALY BOSS — the Reality Breach` (reference line 23745) and ends at `window.AnomalyBoss = AnomalyBoss;` (reference line 24011). Keep `BossStage` above it, because the Memory Leak still uses it.
2. In `index.html`, load the two files right after `game.js`:
   ```html
   <script src="game.js"></script>
   <script src="boss-kit.js"></script>
   <script src="reality-breach.js"></script>
   ```
3. Nothing else needs to change. Everything that touches the old boss keeps working:
   - `music.js` reads `AnomalyBoss._active`.
   - The Auto-Breach Firewall calls `hit(n, 'firewall')` and uses `_autoHitAccum`.
   - The run reset calls `resetForNewRun()`, and the quit sweep calls `cancel()`.
   - The save hoard is still `state._breachHoard`.
   - systems3's reality tear still finds `#anomaly-boss`.

Behaviour changes from the old boss:
- The Auto-Breach Firewall can't hit a shut shell and can't perform the seal. A person has to finish the fight.
- The spawn gate is a single 1e8 energy check. A roll that fails to spawn now waits for the next 15 s roll instead of re-rolling every tick.

Sounds used: `sfx:breach`, `stinger:eventWin`, `stinger:eventFail` and `Sounds.click`, all of which already exist.

### Running

Open `sandbox/index.html` in a browser. To run the tests:

```sh
npm install        # or reuse a global playwright: NODE_PATH=$(npm root -g)
npm test           # npm run test:shots also writes screenshots to tests/shots/
```
