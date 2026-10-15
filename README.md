# Boss Fight Development

Boss battles for **Just a Clicker Game**. `reference/` holds copies of the shipped game files, for reference only.

## The bosses: `src/bosses.js`

All three bosses live in one file, `src/bosses.js`, and that file is the whole deliverable. It creates every element and style it needs at runtime. It doesn't edit `index.html` and doesn't depend on any element or class in it, so it can't collide with ongoing work on that file.

| Section | Status |
|---|---|
| 1. `BossKit`: the shared stage (intro card, boss bar with damage trail, pop-ups, hints, flashes, result card, SVG icons) | done |
| 2. `AnomalyBoss`: the Reality Breach | done |
| 3. `MemoryLeakBoss`: the Memory Leak | next |
| 4. `FirewallBoss`: the Firewall Entity | next |

Development tools (none of these ship):

| File | What it is |
|---|---|
| `tools/viewer.js` | Builds a self-contained preview page: a stand-in for the parts of the game a boss touches, `bosses.js` inlined, and a panel to spawn the boss and skip to any phase. |
| `tests/reality-breach.test.js` | Plays every Reality Breach mechanic in Chromium (49 checks), using the viewer page. |
| `tests/balance.js` | Scripted players fight the breach to the end and report wins and time left. |

## Reality Breach

### The fight

- **The shell.** Six plates open and close on an uneven rhythm and flicker white just before they shut. A hit on a shut shell is reflected: it heals the breach 1.2% and steals 2 s of income.
- **The weak point.** A small glowing mark on the rim. A hit on it does 3 damage and sends the mark elsewhere on the rim. It sits still in phase I, drifts in phase II and races in phase III. Anywhere else on the body is a 1-damage graze.
- **Phase I.** Stands still and teaches the shell.
- **Phase II: find the real one.** It makes three echoes. Only the real breach's pupil follows your cursor, and the echoes' shards orbit the other way. Echoes can't be killed: hitting one draws a beam to the real breach and heals it 1.2% (at most once a second per echo). All four bodies shuffle every 4 s, and each landing spot is marked a moment before.
- **Phase III: enraged.** It jumps around the screen, with each jump marked first, and fires projectiles at the energy counter. One that lands steals 6 s of income and heals it 2%. You can shoot them down.
- **The seal.** At 0 HP it doesn't die. A marker sweeps a ring with three arcs. Press (click, Space or Enter) as the marker crosses the lit arc, three times within 7 s. After each lock the marker reverses and speeds up. A miss lets it tear free with 15% HP.
- **Phase lines hold.** Every phase boundary is a short stagger where it can't be hurt, so one big hit can't skip a phase. Heals never climb back over a line already crossed, so a phase you've won stays won.
- **Rewards.** Unchanged in kind: everything it ate comes back, plus a 225-900 s income bounty (`_birdPay`) and fragments (x3 with Breach Protocol). A clean fight (no mistakes) pays x1.5. The result card gives a grade from S to C.
- **Escape.** It has 200-239 HP and 90 s. If it escapes, it keeps what it ate and instability rises by 15, as before.
- **No emoji or glyph characters** appear anywhere a player can see. Icons and art are generated SVG, and the test checks that all visible text is ASCII.

**Balance** (`node tests/balance.js 6`: scripted players clicking about 6.5 times a second, at 4x speed):

| Player | Wins | Time left |
|---|---|---|
| Skilled (weak point 35% of hits, never hits an echo) | 6 of 6 | about 60 s of 90 |
| Sloppy (1 in 5 clicks on an echo, hits the closing shell, misses half the projectiles) | about half | 8 to 37 s |

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

Sounds used: `sfx:breach`, `stinger:eventWin`, `stinger:eventFail` and `Sounds.click`, all of which already exist.

### Running

```sh
node tools/viewer.js   # writes preview.html (git-ignored); open it in a browser
node tools/viewer.js out.html --artifact   # the same page, shaped for publishing as a review artifact
npm install            # or reuse a global playwright: NODE_PATH=$(npm root -g)
npm test               # npm run test:shots also writes screenshots to tests/shots/
```
