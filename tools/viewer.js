/* tools/viewer.js — a preview page for src/bosses.js. Development only: nothing here ships.

   The game's index.html is never edited. This builds a self-contained page instead: a stand-in for the bits of the
   game a boss touches (state, format, _birdPay, an energy counter, the event queue), bosses.js inlined, and a panel
   to spawn each boss and skip to any phase. The tests load it, and so does the review artifact.

     node tools/viewer.js [out.html]       writes the page (default: preview.html, git-ignored)
     node tools/viewer.js out.html --artifact   the same page, shaped for publishing as a review artifact
     require('./tools/viewer').build()     returns it as a string */
'use strict';
const fs = require('fs');
const path = require('path');

const SHELL = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Boss Viewer</title>
<style>
  :root { color-scheme:dark; --bg:#07030c; --panel:#120a1a; --line:#2a1838; --text:#d8d0e4; --dim:#7a6c8c; --accent:#44ffaa; }
  * { box-sizing:border-box; }
  html, body { margin:0; height:100%; background:var(--bg); color:var(--text);
    font-family:'Courier New', ui-monospace, monospace; overflow:hidden; }
  body { background:radial-gradient(ellipse at 50% 40%, #1a0b26 0%, var(--bg) 70%); }
  #energy-display { position:fixed; left:50%; bottom:calc(26px + env(safe-area-inset-bottom, 0px)); transform:translateX(-50%); text-align:center; }
  #energy-display .v { font-size:28px; font-weight:900; letter-spacing:2px; color:#fff; font-variant-numeric:tabular-nums; }
  #energy-display .l { font-size:10px; letter-spacing:4px; color:var(--dim); }
  #main-btn { position:fixed; left:50%; top:50%; width:120px; height:120px; margin:-60px; border-radius:50%;
    border:2px solid var(--line); background:#140a1e; color:var(--dim); font:inherit; letter-spacing:3px; cursor:pointer; }
  #panel { position:fixed; left:calc(12px + env(safe-area-inset-left, 0px)); top:76px; width:220px; padding:12px; background:var(--panel); border:1px solid var(--line);
    font-size:11px; z-index:9000; }   /* under the bosses: a fight is never blocked by this panel */
  #panel #b-fold { display:flex; justify-content:space-between; margin:0 0 4px; padding:0; border:0; background:none; font-size:11px; letter-spacing:3px; color:var(--accent); font-weight:700; }
  #panel #b-fold span { color:var(--dim); font-weight:400; }
  #panel.folded #panel-body { display:none; }
  #panel.folded #b-fold { margin:0; }
  #panel .row { display:grid; grid-template-columns:1fr 1fr; gap:4px; }
  #panel .row button { margin:0; }
  #panel h2 { font-size:10px; letter-spacing:2px; margin:8px 0 4px; color:var(--dim); font-weight:400; }
  #panel button { display:block; width:100%; margin:4px 0; padding:6px; background:#1d1029; color:var(--text);
    border:1px solid var(--line); font:inherit; cursor:pointer; text-align:left; }
  #panel button:hover { border-color:var(--accent); }
  #panel label { display:flex; gap:6px; align-items:center; margin:6px 0; }
  #stats { margin-top:8px; white-space:pre; color:var(--dim); font-size:10px; line-height:1.5; }
  #toast { position:fixed; left:50%; bottom:90px; transform:translateX(-50%); font-size:12px; letter-spacing:1px;
    padding:6px 12px; background:rgba(0,0,0,.6); border:1px solid var(--line); opacity:0; transition:opacity .3s; pointer-events:none; }
  #toast.on { opacity:1; }
  @media (max-width: 600px) { #panel { top:auto; bottom:90px; width:calc(100vw - 24px); } #stats { display:none; } }
</style>
</head>
<body>
  <button id="main-btn" type="button">CLICK</button>
  <div id="energy-display"><div class="v" id="energy-v">0</div><div class="l">ENERGY</div></div>
  <div id="toast"></div>
  <div id="panel">
    <button id="b-fold" type="button" aria-expanded="true">BOSS VIEWER <span>HIDE</span></button>
    <div id="panel-body">
    <h2>REALITY BREACH</h2>
    <div class="row"><button id="b-spawn" type="button">Spawn</button><button id="b-p2" type="button">Phase II</button>
      <button id="b-p3" type="button">Phase III</button><button id="b-seal" type="button">Seal</button></div>
    <h2>MEMORY LEAK</h2>
    <div class="row"><button id="m-spawn" type="button">Spawn</button><button id="m-p2" type="button">Phase II</button>
      <button id="m-p3" type="button">Phase III</button><button id="m-recall" type="button">Recall</button></div>
    <button id="b-cancel" type="button">Cancel the fight (quit)</button>
    <label><input type="checkbox" id="c-sound" checked> Sound</label>
    <label><input type="checkbox" id="c-calm"> Calm mode</label>
    <label><input type="checkbox" id="c-fw"> Auto-Breach Firewall (2/s)</label>
    <label><input type="checkbox" id="c-protocol"> Breach Protocol owned</label>
    <div id="stats"></div>
    </div>
  </div>

<!-- stand-ins for the game.js script-scope bindings the boss uses -->
<script>
  let isRunning = true;
  const state = { prestige: { count: 3 }, energy: 5e9, eps: 2.5e7, _realEPS: 2.5e7, fragments: 0, instability: 20, multiplier: 1, _breachHoard: 0 };
  const format = n => {
    n = +n || 0;
    const u = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
    let i = 0; while (Math.abs(n) >= 1000 && i < u.length - 1) { n /= 1000; i++; }
    return (i ? n.toFixed(2) : Math.round(n)) + u[i];
  };
  function _birdPay(floor, bankShare, secs) {
    const eps = Math.max(0, +state._realEPS || +state.eps || 0);
    const hi = eps * secs, lo = hi * 0.25;
    const bank = Math.max(0, +state.energy || 0) * bankShare;
    return Math.max(floor, Math.min(hi, Math.max(lo, bank)));
  }
  let _protocol = false;
  const FragUpgrades = { hasBought: id => id === 'boss_loot' && _protocol };
  const Game = { update() {} };
  const Achieve = { checkAll() {} };
  const Settings = { _prefs: { sound: true, musicVol: 1, sfxVol: 1 } };
  const Instability = { updateUI() {} };
  function updateFragmentsUI() {}
  function _toast(t) { const e = document.getElementById('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('on'), 3500); }
  window.showNotif = (t) => _toast(t);
  window.Ticker = { show: (t) => _toast(t) };
  window.GlobalEventQueue = { _h: null, hold(id) { if (this._h) return false; this._h = id; return true; }, unhold(id) { if (this._h === id) this._h = null; }, isActive() { return !!this._h; } };
</script>
<script>
__BOSSES_JS__
</script>
<script>
  const $ = id => document.getElementById(id);
  $('main-btn').onclick = () => { state.energy += state._realEPS * 0.05; };
  const fold = f => { $('panel').classList.toggle('folded', f); $('b-fold').setAttribute('aria-expanded', String(!f)); $('b-fold').querySelector('span').textContent = f ? 'SHOW' : 'HIDE'; };
  $('b-fold').onclick = () => fold(!$('panel').classList.contains('folded'));
  /* the panel folds itself away when a fight starts or skips ahead, so it never sits where the boss goes */
  ['b-spawn', 'b-p2', 'b-p3', 'b-seal', 'm-spawn', 'm-p2', 'm-p3', 'm-recall'].forEach(id => $(id).addEventListener('click', () => fold(true)));
  $('b-spawn').onclick = () => { if (!AnomalyBoss.spawn()) _toast('Cannot spawn now (already up?)'); };
  $('b-p2').onclick = () => AnomalyBoss._qaPhase(1);
  $('b-p3').onclick = () => AnomalyBoss._qaPhase(2);
  $('b-seal').onclick = () => AnomalyBoss._qaSeal();
  $('m-spawn').onclick = () => { if (!MemoryLeakBoss._qaTrigger()) _toast('Cannot spawn now (a fight is already up?)'); };
  $('m-p2').onclick = () => MemoryLeakBoss._qaPhase(1);
  $('m-p3').onclick = () => MemoryLeakBoss._qaPhase(2);
  $('m-recall').onclick = () => MemoryLeakBoss._qaRecall();
  $('b-cancel').onclick = () => { AnomalyBoss.cancel(); MemoryLeakBoss.cancel(); };
  $('c-sound').onchange = e => { Settings._prefs.sound = e.target.checked; if (!e.target.checked && window.BossAudio) BossAudio.stop(); };
  $('c-calm').onchange = e => document.body.classList.toggle('accessibility-mode', e.target.checked);
  $('c-protocol').onchange = e => { _protocol = e.target.checked; };
  let last = performance.now();
  (function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    state.energy += state._realEPS * dt;
    if ($('c-fw').checked && AnomalyBoss._active) {
      AnomalyBoss._autoHitAccum += 2 * dt;
      const w = Math.floor(AnomalyBoss._autoHitAccum);
      if (w >= 1) { AnomalyBoss._autoHitAccum -= w; AnomalyBoss.hit(w, 'firewall'); }
    }
    $('energy-v').textContent = format(state.energy);
    const m = MemoryLeakBoss._qa();
    if (m.active) {
      $('stats').textContent = 'mode   ' + m.mode + '\nphase  ' + m.phase + '\nhp     ' + m.hp + ' / ' + m.max + '\nheap   ' + m.heap.toFixed(0) + '%'
        + '\nblocks ' + m.blocks.length + '\ngc     ' + m.gc + ' / ' + m.GC_NEED + '\nfrags  ' + state.fragments + '\ninstab ' + state.instability;
    } else {
      const q = AnomalyBoss._qa();
      $('stats').textContent = 'mode   ' + q.mode + '\nphase  ' + q.phase + '\nhp     ' + q.hits + ' / ' + q.max + '\nshell  ' + q.shell
        + '\nleft   ' + q.left.toFixed(1) + '\nhoard  ' + format(q.hoard) + '\nfrags  ' + state.fragments + '\ninstab ' + state.instability;
    }
    requestAnimationFrame(loop);
  })(last);
</script>
</body>
</html>
`;

function build(opt) {
    const js = fs.readFileSync(path.join(__dirname, '..', 'src', 'bosses.js'), 'utf8');
    let html = SHELL.replace('__BOSSES_JS__', () => js.replace(/<\/script/gi, '<\\/script'));
    if (opt && opt.artifact) {
        /* a review artifact: the publisher supplies the document skeleton and the charset and viewport metas */
        html = html.replace(/<!doctype html>\s*<html[^>]*>\s*<head>\s*/i, '')
                   .replace(/<meta charset="utf-8">\s*<meta name="viewport"[^>]*>\s*/i, '')
                   .replace(/<\/head>\s*<body>\s*/i, '')
                   .replace(/\s*<\/body>\s*<\/html>\s*$/i, '\n')
                   .replace('<title>Boss Viewer</title>', '<title>Clicker Game Bosses</title>');
    }
    return html;
}

if (require.main === module) {
    const args = process.argv.slice(2), artifact = args.includes('--artifact');
    const out = path.resolve(args.find(a => a !== '--artifact') || path.join(__dirname, '..', 'preview.html'));
    fs.writeFileSync(out, build({ artifact }));
    console.log('wrote ' + out);
}
module.exports = { build };
