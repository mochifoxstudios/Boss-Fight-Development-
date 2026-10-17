# Integrating the bosses into Just a Clicker Game

For the agent integrating this into the game. This doc is self-contained.

## What you are getting

| File | Ships? | What it is |
|---|---|---|
| `src/bosses.js` | **yes** | All three bosses in one classic script (about 2,800 lines, no imports, no build step). It defines `BossKit`, `BossAudio`, `AnomalyBoss` (Reality Breach), `MemoryLeakBoss` (Memory Leak) and `FirewallBoss` (Firewall Entity). |
| `tools/integrate.js` | no | Removes the three old bosses from the game and copies `bosses.js` in. It finds code by its text, not by line number. |
| `tools/viewer.js`, `tests/` | no | Development only: a standalone preview and Chromium test suites. |

`bosses.js` creates every element and style it uses at runtime. It does not need anything in `index.html`, and it doesn't use `game.css`.

## Steps

From this repository, pointing at the game folder (the one containing `game.js`, `systems3.js`, `index.html`):

```sh
node tools/integrate.js <game folder>                          # dry run: prints what it would do
node tools/integrate.js <game folder> --write --add-script     # does it
```

`--write` makes these changes, and backs up every changed file to `*.pre-bosses.bak` first:

1. In `game.js`, it removes the old `AnomalyBoss` block. That runs from the banner `ANOMALY BOSS — the Reality Breach` to `window.AnomalyBoss = AnomalyBoss;`.
2. In `game.js`, it removes the old `FirewallBoss` block. That runs from the banner `DOM BOSS FIGHT — "Firewall Entity"` to `window.FirewallBoss = FirewallBoss;`.
3. In `game.js`, it removes `BossStage`. That runs from the banner `BOSS STAGE — the frame the bosses share` to `window.BossStage = BossStage;`. Only the two old bosses used it.
4. In `systems3.js`, it removes the old `MemoryLeakBoss` block. That runs from `/* ── 8. MEMORY LEAK BOSS` to `window.MemoryLeakBoss = MemoryLeakBoss;`.
5. It copies `src/bosses.js` to `<game folder>/bosses.js`.
6. With `--add-script` only, it adds one line to `index.html`, right after the `game.js` tag:
   ```html
   <script src="bosses.js"></script>
   ```

The script refuses to change anything unless every start and end marker is found exactly once. It also refuses if the result would still declare any of the five names. Running it again is safe, because already-removed blocks are skipped.

If you'd rather do it by hand, make the same four removals and add the same script tag. **The removals are not optional.** `game.js` and `systems3.js` are classic scripts that declare these names with top-level `const`. If an old declaration remains, loading `bosses.js` throws `Identifier 'AnomalyBoss' has already been declared`.

**Load order:** `bosses.js` must come after `game.js`. It reads these top-level bindings by bare name: `state`, `isRunning`, `format`, `_birdPay`, `showNotif`, `Game`, `Achieve`, `Instability`, `FragUpgrades` and `updateFragmentsUI`. They are only read when a fight runs, never at load, but `game.js` must be loaded first. Right after it, as `--add-script` does, is the safe place.

Tested against the uploaded reference copy: 762 lines removed, `game.js` and `systems3.js` still parse, and `game.js + systems3.js + bosses.js` parses as one script with no duplicate declarations.

## What keeps working unchanged

Each boss keeps its global name and the functions the game already calls.

| Caller | Call |
|---|---|
| `game.js` main loop | `AnomalyBoss.tick()`, `MemoryLeakBoss.tick()`, `FirewallBoss.check()` |
| `game.js` income | `FirewallBoss.getMult()` (reads `state._firewallMult`, still x8) |
| `game.js` Auto-Breach Firewall | `AnomalyBoss._active`, `AnomalyBoss._autoHitAccum`, `AnomalyBoss.hit(n, 'firewall')` |
| `game.js` run reset | `AnomalyBoss.resetForNewRun()` |
| `game.js` quit sweeps | `AnomalyBoss.cancel()`, `MemoryLeakBoss.cancel()`, `FirewallBoss.cancel()`; the id list still finds `firewall-boss` |
| `music.js` | `AnomalyBoss._active`, `MemoryLeakBoss.isActive()`, `FirewallBoss.isActive()` |
| `systems3.js` reality tear | finds `#anomaly-boss` (only the real breach carries that id) |
| Save | `state._breachHoard`, `state._firewallDefeated`, `state._firewallMult`, `state._bossesDefeated` |

Spawn rules are unchanged:
- **Breach:** first one 30 minutes into a run, then a 2% roll every 15 seconds. System Noise boosts the odds. It needs 1e8 energy.
- **Memory Leak:** prestige 2 or higher, instability above 75%, at least 45 minutes since the last one, then a 1% roll every 30 seconds.
- **Firewall:** prestige 2 or 1,000,000 clicks, then a 0.2% roll per tick, once per save.

All three now respect `GlobalEventQueue`, so none arrives on top of another crisis.

## Behaviour changes to know about

1. **Sound.** Each boss plays its own synthesized music and effects through `BossAudio`, using Web Audio with no audio files.
   - While boss music plays it calls `GameMusic.hold('bossAudio')` and releases it afterwards, so the soundtrack and the boss music never overlap.
   - A held `GameMusic` also mutes `GameSound` one-shots, so the game's own effects are quiet during a fight. The boss supplies its own.
   - It respects `Settings._prefs.sound`, `musicVol` and `sfxVol`.
   - If Web Audio is unavailable, it falls back to `GameSound.play('sfx:breach')`, `'stinger:eventWin'`, `'stinger:eventFail'`, `'stinger:eventStart'` and `Sounds.click()`.
   - As a result, the soundtrack's own `anomalyBoss`, `memoryLeak` and `firewallBoss` cues are no longer heard.
2. **Input is on `pointerdown`, not `click`**, so taps register on touch screens. Each boss handler calls `stopPropagation()`, so the game's own click handlers never see a boss hit.
3. **Breach:** the Auto-Breach Firewall still damages it, but it can't hit a shut shell and can't complete the final seal. A person has to finish the fight.
4. **Memory Leak:** the typed command is replaced by a garbage-collector button that fills as you free blocks. Typing `EXECUTE GARBAGE_COLLECTION` still works through `MemoryLeakBoss.tryCommand()`. The `#memory-leak-terminal` element in `index.html` is no longer used. It can stay; nothing breaks either way.
5. **Firewall:** it works on phones (an INSPECT button appears after two blocked taps) and has a three-phase fight inside an in-game inspector. Deleting `#firewall-boss` with the browser's real DevTools still wins, as before.
6. **Rewards** are the same in kind. The Breach and the Memory Leak pay x1.5 bounty for a clean fight. Each boss shows a result card with a grade.
7. **Layers.** Everything sits at `z-index` 9300 to 9700. The old firewall wall used `var(--z-critical)` (15000). If something in the game must stay above the bosses, it needs a higher z-index.
8. **Leftover CSS.** Old boss styles in `game.css` (`.boss-bar`, `.boss-intro`, `.anomaly-boss`, `.mlb-block`, `.fwi-*`) are now unused. They're harmless, and you can delete them when convenient.

## Checking it in the game

The tests run the bosses against stand-ins for the game, not the real game, so please check once in the real one. From the browser console in a running game:

```js
state.energy = Math.max(state.energy, 1e9); AnomalyBoss.spawn();   // the Reality Breach
MemoryLeakBoss._qaTrigger();                                       // the Memory Leak
state._firewallDefeated = false; FirewallBoss.spawn();             // the Firewall Entity
```

Run one at a time. Each holds `GlobalEventQueue` until it ends, so the next won't start while another is up. Then check that:

- each boss can be beaten, and its result card appears
- the boss music plays, and the game's soundtrack comes back afterwards
- quitting to the home screen mid-fight leaves nothing on screen (the quit sweep calls `cancel()`)
- reloading mid-Breach gives back what it ate on the next tick
- after the Firewall, income is x8 and it never spawns again
