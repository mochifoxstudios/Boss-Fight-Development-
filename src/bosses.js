/* ═══════════════════════════════════════════════════════════════════════════
   bosses.js — JUST A CLICKER GAME: THE BOSSES, IN ONE FILE

   Load it once, after game.js. It edits nothing in index.html and relies on nothing in it: every element a boss uses
   (bars, cards, bodies, terminals, overlays) and every style it needs is created here, at runtime.
   Preview it without the game: node tools/viewer.js (development only).

     1. BossKit           the stage every boss shares (intro, bar, pops, hints, flashes, result card, SVG icons)
        BossAudio         the bosses' soundtrack and sound effects, synthesized live (Web Audio, no audio files)
     2. AnomalyBoss       the Reality Breach (replaces the AnomalyBoss block in game.js)
     3. MemoryLeakBoss    the Memory Leak     (replaces the block in systems3.js)
     4. FirewallBoss      the Firewall Entity (next: replaces the block in game.js)

   Rule for this file: no emoji and no glyph characters anywhere a player can see. Icons and art are generated SVG.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── 1. BOSSKIT ─────────────────────────────────────────────────────────────
   BossKit.intro({ name, sub, col }) / bar({ name, col, marks }) / hp(f) / phase(t) / right(t, low) / sub(t) / colour(c)
   / heal() / pop(x, y, text, kind) / hint(text, x, y, ms, col, icon) / flash(col, a) / shake(px)
   / result({ title, col, grade, rows: [[icon, label, value]] }) / icon(name) / end() / clear() / calm()
   Self-styled (bk- classes), so it never depends on game.css. Every motion is transform or opacity; under safe
   mode, accessibility mode and the OS reduced-motion setting nothing shakes, slides or pops. */
const BossKit = (() => {
    'use strict';

    const CSS = `
.bk-dim{position:fixed;inset:0;z-index:9400;pointer-events:none;opacity:0;transition:opacity .5s ease;
  background:radial-gradient(ellipse at center,transparent 38%,color-mix(in srgb,var(--bk-col) 22%,transparent) 78%,rgba(0,0,0,.72) 100%);}
.bk-dim.on{opacity:1}.bk-dim.out{opacity:0}
.bk-dim::after{content:"";position:absolute;inset:0;opacity:.07;
  background:repeating-linear-gradient(0deg,#fff 0 1px,transparent 1px 3px);}

.bk-intro{position:fixed;left:0;right:0;top:34%;z-index:9700;pointer-events:none;text-align:center;
  font-family:var(--bk-font,'Courier New',ui-monospace,monospace);color:#fff;transform:translateY(-50%);}
.bk-intro-band{position:absolute;left:0;right:0;top:-34px;bottom:-34px;transform-origin:center;
  background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--bk-col) 30%,#000) 18%,color-mix(in srgb,var(--bk-col) 30%,#000) 82%,transparent);
  border-top:1px solid var(--bk-col);border-bottom:1px solid var(--bk-col);animation:bkBand .45s cubic-bezier(.2,.9,.2,1) both;}
.bk-intro-warn{position:relative;display:flex;align-items:center;justify-content:center;gap:12px;
  font-size:12px;letter-spacing:6px;color:var(--bk-col);animation:bkBlink .5s steps(2) 4 both;}
.bk-intro-warn svg{width:18px;height:18px}
.bk-intro-name{position:relative;margin:10px 0 6px;font-size:clamp(30px,7vw,64px);font-weight:900;letter-spacing:.18em;
  text-shadow:0 0 24px var(--bk-col);animation:bkIn .5s .15s cubic-bezier(.2,.9,.2,1) both;}
.bk-intro-name::before,.bk-intro-name::after{content:attr(data-t);position:absolute;inset:0;opacity:.7;mix-blend-mode:screen;}
.bk-intro-name::before{color:#0ff;animation:bkSplitA 1.2s steps(6) infinite;}
.bk-intro-name::after{color:var(--bk-col);animation:bkSplitB 1.2s steps(6) infinite;}
.bk-intro-sub{position:relative;font-size:13px;letter-spacing:3px;color:#d8d8e8;opacity:.85;animation:bkIn .5s .35s both;}
.bk-intro.out{animation:bkOut .38s ease both}
.bk-intro.calm *,.bk-intro.calm{animation:none!important}
.bk-intro.calm .bk-intro-name::before,.bk-intro.calm .bk-intro-name::after{display:none}

.bk-bar{position:fixed;left:50%;top:14px;width:min(640px,calc(100vw - 32px));transform:translateX(-50%);z-index:9600;
  pointer-events:none;font-family:var(--bk-font,'Courier New',ui-monospace,monospace);color:#fff;
  animation:bkDrop .4s cubic-bezier(.2,.9,.2,1) both;}
.bk-bar.out{animation:bkUp .35s ease both}
.bk-bar-top{display:flex;align-items:baseline;gap:10px;font-size:11px;letter-spacing:2px;margin-bottom:5px;
  text-shadow:0 1px 2px #000;white-space:nowrap;min-width:0;}
.bk-bar-name{font-weight:900;font-size:13px;letter-spacing:4px;color:var(--bk-col);flex:none;}
.bk-bar-phase{opacity:.85;overflow:hidden;text-overflow:ellipsis;min-width:0;}
.bk-bar-right{margin-left:auto;font-variant-numeric:tabular-nums;flex:none;}
.bk-bar-sub{margin-top:5px;font-size:10px;letter-spacing:2px;text-align:center;opacity:.8;text-shadow:0 1px 2px #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
@media (max-width:520px){.bk-bar-top{font-size:9px;gap:6px;letter-spacing:1px}.bk-bar-name{font-size:10px;letter-spacing:2px}.bk-bar-sub{font-size:8px;letter-spacing:1px}}
.bk-bar-right.low{color:#ff4d4d;animation:bkBlink .5s steps(2) infinite}
.bk-bar-track{position:relative;height:12px;background:rgba(10,4,14,.82);border:1px solid color-mix(in srgb,var(--bk-col) 70%,#000);
  box-shadow:0 0 18px color-mix(in srgb,var(--bk-col) 35%,transparent);overflow:hidden;}
.bk-bar-trail,.bk-bar-fill{position:absolute;inset:0;transform-origin:left center;}
.bk-bar-trail{background:#fff;opacity:.55;transition:transform .55s .25s ease-out;}
.bk-bar-fill{background:linear-gradient(90deg,color-mix(in srgb,var(--bk-col) 60%,#000),var(--bk-col));transition:transform .08s linear;}
.bk-bar-fill::after{content:"";position:absolute;inset:0;opacity:.25;background:repeating-linear-gradient(90deg,transparent 0 9px,#000 9px 10px);}
.bk-bar-track.heal .bk-bar-fill{animation:bkHeal .45s ease}
.bk-gauge{display:flex;align-items:center;gap:8px;margin-top:6px;font-size:10px;letter-spacing:2px;text-shadow:0 1px 2px #000}
.bk-gauge-track{position:relative;flex:1;height:7px;background:rgba(10,4,14,.82);border:1px solid rgba(255,255,255,.25);overflow:hidden}
.bk-gauge-fill{position:absolute;inset:0;transform-origin:left center;background:var(--bk-g,#fff);transition:transform .12s linear,background .3s}
.bk-gauge.warn .bk-gauge-fill{animation:bkBlink .45s steps(2) infinite}
.bk-bar-mark{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:rgba(255,255,255,.75);z-index:2}

.bk-pop{position:fixed;left:0;top:0;z-index:9650;pointer-events:none;font-family:var(--bk-font,'Courier New',ui-monospace,monospace);
  font-weight:900;font-size:15px;letter-spacing:1px;color:#fff;text-shadow:0 0 8px var(--bk-col),0 1px 2px #000;
  white-space:nowrap;animation:bkPop .7s cubic-bezier(.2,.9,.3,1) forwards;}
.bk-pop.crit{font-size:22px;color:#fff8c8;}
.bk-pop.reflect,.bk-pop.heal{color:#ff5470;font-size:17px}
.bk-pop.info{font-size:12px;letter-spacing:3px;opacity:.9}

.bk-hint{position:fixed;left:0;top:0;z-index:9660;pointer-events:none;font-family:var(--bk-font,'Courier New',ui-monospace,monospace);
  display:flex;align-items:center;gap:8px;padding:7px 12px;font-size:12px;letter-spacing:2px;color:#fff;max-width:calc(100vw - 32px);
  background:rgba(8,2,12,.9);border:1px solid var(--bk-col);box-shadow:0 0 16px color-mix(in srgb,var(--bk-col) 45%,transparent);
  animation:bkHint .3s ease both;}
.bk-hint svg{width:16px;height:16px;flex:none;color:var(--bk-col)}
.bk-hint.out{animation:bkOut .3s ease both}

.bk-flash{position:fixed;inset:0;z-index:9550;pointer-events:none;background:var(--bk-col);animation:bkFlash .35s ease-out forwards;}

.bk-result{position:fixed;left:50%;top:50%;z-index:9700;width:min(380px,calc(100vw - 32px));transform:translate(-50%,-50%);
  font-family:var(--bk-font,'Courier New',ui-monospace,monospace);color:#fff;background:rgba(8,3,14,.95);
  border:1px solid var(--bk-col);box-shadow:0 0 40px color-mix(in srgb,var(--bk-col) 40%,transparent);padding:18px 20px 14px;
  cursor:pointer;animation:bkCard .4s cubic-bezier(.2,.9,.2,1) both;}
.bk-result.out{animation:bkOut .3s ease both}
.bk-result-head{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.bk-result-title{font-size:18px;font-weight:900;letter-spacing:4px;color:var(--bk-col);}
.bk-result-grade{margin-left:auto;width:42px;height:42px;display:grid;place-items:center;font-size:24px;font-weight:900;
  border:2px solid var(--bk-col);color:var(--bk-col);}
.bk-result-row{display:flex;align-items:center;gap:10px;padding:6px 0;border-top:1px solid rgba(255,255,255,.08);font-size:12px;letter-spacing:1px}
.bk-result-row svg{width:16px;height:16px;flex:none;color:var(--bk-col)}
.bk-result-row b{margin-left:auto;font-variant-numeric:tabular-nums;text-align:right}
.bk-result-foot{margin-top:10px;font-size:10px;letter-spacing:3px;opacity:.5;text-align:center}

body.bk-shake{animation:bkShake .18s steps(2) 1}

@keyframes bkBand{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes bkBlink{50%{opacity:.25}}
@keyframes bkIn{from{opacity:0;transform:scale(1.25)}to{opacity:1;transform:none}}
@keyframes bkOut{to{opacity:0}}
@keyframes bkSplitA{0%,100%{transform:translate(0,0)}20%{transform:translate(-3px,1px)}40%{transform:translate(2px,-1px)}60%{transform:translate(0,0)}80%{transform:translate(-1px,0)}}
@keyframes bkSplitB{0%,100%{transform:translate(0,0)}20%{transform:translate(3px,-1px)}40%{transform:translate(-2px,1px)}60%{transform:translate(1px,0)}80%{transform:translate(0,0)}}
@keyframes bkDrop{from{opacity:0;transform:translate(-50%,-20px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes bkUp{to{opacity:0;transform:translate(-50%,-20px)}}
@keyframes bkHeal{0%,100%{filter:none}40%{filter:brightness(2.2) saturate(.3)}}
@keyframes bkPop{0%{opacity:0;transform:translate(var(--x),var(--y)) translate(-50%,-50%) scale(.6)}
  15%{opacity:1;transform:translate(var(--x),var(--y)) translate(-50%,-90%) scale(1.15)}
  100%{opacity:0;transform:translate(var(--x),var(--y)) translate(-50%,-220%) scale(1)}}
@keyframes bkHint{from{opacity:0;margin-top:8px}to{opacity:1;margin-top:0}}
@keyframes bkFlash{from{opacity:var(--a,.35)}to{opacity:0}}
@keyframes bkCard{from{opacity:0;transform:translate(-50%,-50%) scale(.9)}to{opacity:1;transform:translate(-50%,-50%)}}
@keyframes bkShake{0%{transform:translate(var(--s),calc(var(--s) * -.5))}50%{transform:translate(calc(var(--s) * -1),calc(var(--s) * .5))}}
`;

    /* line icons on a 24 grid, stroke = currentColor, so a colour comes from CSS */
    const ICONS = {
        energy:      '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
        fragment:    '<path d="M12 2 20 9l-8 13L4 9z"/><path d="M4 9h16M12 2v20"/>',
        clock:       '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        shield:      '<path d="M12 2 20 5v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/>',
        eye:         '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
        warning:     '<path d="M12 3 22 20H2z"/><path d="M12 10v4M12 17v.5"/>',
        mult:        '<path d="M6 6l12 12M18 6 6 18"/>',
        instability: '<path d="M2 12h4l2-6 4 12 3-9 2 3h5"/>',
        target:      '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>',
    };
    function icon(name) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
            + (ICONS[name] || '') + '</svg>';
    }

    let _bar = null, _card = null, _dim = null, _res = null, _hint = null, _pops = 0;
    const _timers = [];

    function _css() {
        if (document.getElementById('bk-css')) return;
        const s = document.createElement('style'); s.id = 'bk-css'; s.textContent = CSS;
        document.head.appendChild(s);
    }
    function calm() {
        const b = document.body.classList;
        return b.contains('safe-mode') || b.contains('accessibility-mode')
            || !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
    function _later(fn, ms) { const t = setTimeout(fn, ms); _timers.push(t); return t; }
    function _el(cls, tag) { const d = document.createElement(tag || 'div'); d.className = cls; return d; }
    function _fade(e, ms) { if (!e) return; e.classList.add('out'); setTimeout(() => e.remove(), ms); }

    function intro(o) {
        _css(); clear();
        _dim = _el('bk-dim'); _dim.style.setProperty('--bk-col', o.col); document.body.appendChild(_dim);
        requestAnimationFrame(() => _dim && _dim.classList.add('on'));
        _card = _el('bk-intro' + (calm() ? ' calm' : ''));
        _card.style.setProperty('--bk-col', o.col);
        _card.setAttribute('role', 'alert');
        _card.innerHTML = '<div class="bk-intro-band"></div><div class="bk-intro-warn">' + icon('warning') + '<span>WARNING</span>' + icon('warning') + '</div>'
            + '<div class="bk-intro-name"></div><div class="bk-intro-sub"></div>';
        const n = _card.querySelector('.bk-intro-name'); n.textContent = o.name; n.dataset.t = o.name;
        _card.querySelector('.bk-intro-sub').textContent = o.sub || '';
        document.body.appendChild(_card);
        return new Promise(res => _later(() => { const c = _card; _card = null; _fade(c, 380); res(); }, calm() ? 1500 : 2600));
    }

    function bar(o) {
        _css();
        if (_bar) _bar.remove();
        _bar = _el('bk-bar'); _bar.id = 'boss-bar';
        _bar.style.setProperty('--bk-col', o.col);
        _bar.innerHTML = '<div class="bk-bar-top"><span class="bk-bar-name"></span><span class="bk-bar-phase"></span><span class="bk-bar-right"></span></div>'
            + '<div class="bk-bar-track"><div class="bk-bar-trail"></div><div class="bk-bar-fill"></div>'
            + (o.marks || []).map(m => '<i class="bk-bar-mark" style="left:' + (m * 100).toFixed(1) + '%"></i>').join('') + '</div>'
            + '<div class="bk-bar-sub"></div>';
        _bar.querySelector('.bk-bar-name').textContent = o.name;
        document.body.appendChild(_bar);
        return _bar;
    }
    const _q = s => _bar && _bar.querySelector(s);
    function hp(f) {
        f = Math.max(0, Math.min(1, f));
        const t = 'scaleX(' + f.toFixed(4) + ')';
        const fill = _q('.bk-bar-fill'), trail = _q('.bk-bar-trail');
        if (fill) fill.style.transform = t;
        if (trail) trail.style.transform = t;                       // its transition delay makes it trail a hit
    }
    function heal() { const t = _q('.bk-bar-track'); if (t) { t.classList.remove('heal'); void t.offsetWidth; t.classList.add('heal'); } }
    function phase(t) { const e = _q('.bk-bar-phase'); if (e && e.textContent !== t) e.textContent = t; }
    function right(t, low) { const e = _q('.bk-bar-right'); if (!e) return; if (e.textContent !== t) e.textContent = t; e.classList.toggle('low', !!low && !calm()); }
    /* a second, slimmer meter under the bar: what the boss is filling (a heap, a timer) */
    function gauge(label, f, col, warn) {
        if (!_bar) return;
        let g = _q('.bk-gauge');
        if (!g) {
            g = _el('bk-gauge'); g.innerHTML = '<span></span><div class="bk-gauge-track"><div class="bk-gauge-fill"></div></div>';
            _bar.insertBefore(g, _q('.bk-bar-sub'));
        }
        const l = g.querySelector('span'); if (l.textContent !== label) l.textContent = label;
        const fill = g.querySelector('.bk-gauge-fill');
        fill.style.transform = 'scaleX(' + Math.max(0, Math.min(1, f)).toFixed(3) + ')';
        if (col) fill.style.setProperty('--bk-g', col);
        g.classList.toggle('warn', !!warn && !calm());
    }
    function sub(t) { const e = _q('.bk-bar-sub'); if (e && e.textContent !== t) e.textContent = t; }
    function colour(c) { [_bar, _dim].forEach(e => e && e.style.setProperty('--bk-col', c)); }

    function pop(x, y, text, kind, col) {
        if (_pops >= 14) return;
        _css();
        const p = _el('bk-pop ' + (kind || 'hit'));
        p.textContent = text;
        p.style.setProperty('--x', Math.round(x) + 'px'); p.style.setProperty('--y', Math.round(y) + 'px');
        if (col) p.style.setProperty('--bk-col', col);
        if (calm()) { p.style.animation = 'bkOut .6s ease forwards'; p.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px) translate(-50%,-100%)'; }
        document.body.appendChild(p); _pops++;
        setTimeout(() => { p.remove(); _pops--; }, 720);
    }

    function hint(text, x, y, ms, col, ic) {
        _css();
        if (_hint) _hint.remove();
        const h = _hint = _el('bk-hint');
        h.setAttribute('role', 'status');
        if (col) h.style.setProperty('--bk-col', col);
        h.innerHTML = icon(ic || 'warning') + '<span></span>';
        h.querySelector('span').textContent = text;
        document.body.appendChild(h);
        const w = h.offsetWidth, W = window.innerWidth;
        const H = window.innerHeight, hh = h.offsetHeight;
        h.style.transform = 'translate(' + Math.round(Math.max(16, Math.min(W - w - 16, x - w / 2))) + 'px,' + Math.round(Math.max(76, Math.min(H - hh - 16, y))) + 'px)';
        _later(() => { if (_hint === h) _hint = null; _fade(h, 300); }, ms || 2600);
    }

    function flash(col, a) {
        if (calm()) return;
        _css();
        const f = _el('bk-flash'); f.style.setProperty('--bk-col', col); f.style.setProperty('--a', a == null ? 0.3 : a);
        document.body.appendChild(f); setTimeout(() => f.remove(), 380);
    }
    function shake(px) {
        if (calm()) return;
        const b = document.body; b.style.setProperty('--s', (px || 3) + 'px');
        b.classList.remove('bk-shake'); void b.offsetWidth; b.classList.add('bk-shake');
        _later(() => b.classList.remove('bk-shake'), 200);
    }

    function result(o) {
        _css();
        if (_res) _res.remove();
        const r = _res = _el('bk-result');
        r.setAttribute('role', 'status');
        r.style.setProperty('--bk-col', o.col);
        r.innerHTML = '<div class="bk-result-head"><div class="bk-result-title"></div>' + (o.grade ? '<div class="bk-result-grade"></div>' : '') + '</div>'
            + '<div class="bk-result-rows"></div><div class="bk-result-foot"></div>';
        r.querySelector('.bk-result-title').textContent = o.title;
        if (o.grade) r.querySelector('.bk-result-grade').textContent = o.grade;
        const rows = r.querySelector('.bk-result-rows');
        (o.rows || []).forEach(([ic, a, b]) => {
            const row = _el('bk-result-row');
            row.innerHTML = icon(ic) + '<span></span><b></b>';
            row.querySelector('span').textContent = a; row.querySelector('b').textContent = b;
            rows.appendChild(row);
        });
        r.querySelector('.bk-result-foot').textContent = o.foot || 'PRESS TO CLOSE';
        const close = () => { if (_res === r) _res = null; _fade(r, 300); };
        r.addEventListener('click', close);
        document.body.appendChild(r);
        _later(close, o.ms || 8000);
    }

    function end() {
        if (_bar) { const b = _bar; _bar = null; _fade(b, 350); }
        if (_dim) { const d = _dim; _dim = null; _fade(d, 500); }
        if (_card) { _card.remove(); _card = null; }
        if (_hint) { _hint.remove(); _hint = null; }
    }
    function clear() {
        _timers.splice(0).forEach(clearTimeout);
        [_bar, _card, _dim, _res, _hint].forEach(e => { if (e) e.remove(); });
        _bar = _card = _dim = _res = _hint = null;
        document.querySelectorAll('.bk-pop,.bk-flash').forEach(p => p.remove()); _pops = 0;
        document.body.classList.remove('bk-shake');
    }

    return { intro, bar, hp, heal, phase, right, sub, gauge, colour, pop, hint, flash, shake, result, end, clear, calm, icon };
})();
window.BossKit = BossKit;


/* ── 1b. BOSSAUDIO ─────────────────────────────────────────────────────────
   The bosses' own soundtrack and sound effects, synthesized live with Web Audio: no audio files.
     BossAudio.song(name)      start or switch the music (a song is a set of 16-step patterns and a tempo)
     BossAudio.stop()          end the music; what is ringing rings out
     BossAudio.sfx(name, arg)  a one-shot; returns false when sound is off or unavailable
     BossAudio.duck(on)        music down while the game is paused under the fight
   While a boss song plays, the game's own music director is held (GameMusic.hold), so the two never overlap, and it
   is released when the song ends. It obeys the player's sound switch and the Music / Effects sliders
   (Settings._prefs.sound / musicVol / sfxVol). The engine is built on the first sound asked for, never before. */
const BossAudio = (() => {
    'use strict';
    const LOOK = 0.12, TICK_MS = 25;                     // schedule this far ahead, this often
    let ctx = null, out = null, music = null, sfxBus = null, echo = null, noise = null, crush = null, meter = null;
    let song = null, step = 0, nextT = 0, timer = 0, ducked = false, holding = false;

    function _on() { try { return typeof Settings === 'undefined' || !Settings._prefs || Settings._prefs.sound !== false; } catch (e) { return true; } }
    function _vol(k) { try { const v = Settings._prefs[k]; return typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(1, v)) : 1; } catch (e) { return 1; } }
    const hz = m => 440 * Math.pow(2, (m - 69) / 12);

    function _ensure() {
        if (!_on()) return null;
        if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            try { ctx = new AC(); } catch (e) { return null; }
            const comp = ctx.createDynamicsCompressor();
            comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
            out = ctx.createGain(); out.gain.value = 0.9;
            music = ctx.createGain(); sfxBus = ctx.createGain();
            music.connect(out); sfxBus.connect(out); out.connect(comp); comp.connect(ctx.destination);
            meter = ctx.createAnalyser(); meter.fftSize = 2048; comp.connect(meter);   // QA: is anything actually sounding
            /* a dotted-eighth echo for the lead */
            echo = ctx.createDelay(1); const fb = ctx.createGain(), wet = ctx.createGain(), tone = ctx.createBiquadFilter();
            fb.gain.value = 0.38; wet.gain.value = 0.3; tone.type = 'lowpass'; tone.frequency.value = 2600;
            echo.connect(tone); tone.connect(fb); fb.connect(echo); tone.connect(wet); wet.connect(music);
            noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
            const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            crush = ctx.createWaveShaper(); const c = new Float32Array(1024);
            for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; c[i] = Math.tanh(x * 4) * 0.8; } crush.curve = c;
        }
        if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
        _levels();
        return ctx;
    }
    function _levels() {
        if (!ctx) return;
        music.gain.setTargetAtTime(0.3 * _vol('musicVol') * (ducked ? 0.3 : 1), ctx.currentTime, 0.08);
        sfxBus.gain.setTargetAtTime(0.55 * _vol('sfxVol'), ctx.currentTime, 0.02);
    }

    /* ── voices: each is a few nodes, built at time t and left to stop by itself ── */
    function _env(g, t, a, peak, d, end) {
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a);
        g.gain.exponentialRampToValueAtTime(end || 0.0001, t + a + d);
    }
    function _osc(type, f, t, dur, peak, dest, a, f2) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
        _env(g, t, a || 0.004, peak, dur); o.connect(g); g.connect(dest);
        o.start(t); o.stop(t + (a || 0.004) + dur + 0.05);
        return o;
    }
    function _noise(t, dur, peak, dest, type, f, f2, q) {
        const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
        s.buffer = noise; s.loop = true; fl.type = type || 'highpass'; fl.frequency.setValueAtTime(f || 6000, t);
        if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q || 0.8;
        _env(g, t, 0.002, peak, dur); s.connect(fl); fl.connect(g); g.connect(dest);
        s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    }
    const kick = (t, v) => { _osc('sine', 160, t, 0.28, 0.9 * v, music, 0.002, 42); _noise(t, 0.02, 0.15 * v, music, 'highpass', 3000); };
    const snare = (t, v) => { _noise(t, 0.16, 0.35 * v, music, 'bandpass', 1900, 1200, 0.9); _osc('triangle', 190, t, 0.08, 0.25 * v, music, 0.002, 140); };
    const hat = (t, v, open) => _noise(t, open ? 0.16 : 0.035, 0.12 * v, music, 'highpass', 8000);
    function bass(t, m, dur, v, dirty) {
        const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = hz(m); o2.frequency.value = hz(m - 12);
        f.type = 'lowpass'; f.Q.value = 6; f.frequency.setValueAtTime(dirty ? 1800 : 1100, t); f.frequency.exponentialRampToValueAtTime(140, t + dur);
        _env(g, t, 0.004, 0.32 * v, dur);
        o.connect(f); o2.connect(f); f.connect(g);
        if (dirty) { g.connect(crush); crush.connect(music); } else g.connect(music);
        o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    }
    function lead(t, m, dur, v) {
        const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = 'square'; o2.type = 'sawtooth'; o.frequency.value = hz(m); o2.frequency.value = hz(m) * 1.006;
        f.type = 'lowpass'; f.frequency.value = 2400; _env(g, t, 0.006, 0.11 * v, dur);
        o.connect(f); o2.connect(f); f.connect(g); g.connect(music); g.connect(echo);
        o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    }
    function pad(t, notes, dur, v) {
        const f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'lowpass'; f.frequency.value = 900; f.connect(g); g.connect(music);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06 * v, t + dur * 0.3);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        notes.forEach(m => [-7, 7].forEach(c => { const o = ctx.createOscillator(); o.type = 'sawtooth';
            o.frequency.value = hz(m); o.detune.value = c; o.connect(f); o.start(t); o.stop(t + dur + 0.05); }));
    }
    function glitch(t, v) {   // a sample-and-hold stutter: the breach tearing at the music
        const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square';
        for (let i = 0; i < 5; i++) o.frequency.setValueAtTime(400 + Math.random() * 2400, t + i * 0.018);
        _env(g, t, 0.002, 0.07 * v, 0.1); o.connect(g); g.connect(music); o.start(t); o.stop(t + 0.15);
    }

    /* ── the songs: D phrygian, 4 bars of 16 steps; R is each bar's root, C its chord ── */
    const D = 38;   // D2
    const R = [0, 1, 0, -2], C = [[50, 53, 57], [51, 55, 58], [50, 53, 57], [48, 51, 55]];
    const ARP = [0, 3, 7, 12, 7, 3, 10, 7];
    const SONGS = {
        /* phase I: it is watching. Sparse, a slow pulse, the eye motif */
        watch: { bpm: 112, play(s, t, d) {
            const b = (s >> 4) & 3, i = s & 15;
            if (i === 0 || i === 8 || (b === 3 && i === 11)) kick(t, 1);
            if (i % 4 === 2) hat(t, 0.6);
            if ([0, 3, 6, 8, 11, 14].includes(i)) bass(t, D + R[b] + (i === 6 ? 1 : i === 14 ? -2 : 0), d * 2, 0.9);
            if (i === 0) pad(t, C[b], d * 16, 1);
            if ((b === 0 || b === 2) && [0, 3, 6].includes(i)) lead(t, [69, 70, 69][[0, 3, 6].indexOf(i)], d * 2.5, 0.9);
            if (b === 1 && i === 10) lead(t, 65, d * 5, 0.8);
        } },
        /* phase II: it splits. Driving, a stuttering arpeggio, glitches */
        split: { bpm: 124, play(s, t, d) {
            const b = (s >> 4) & 3, i = s & 15;
            if (i % 4 === 0) kick(t, 1);
            if (i === 4 || i === 12) snare(t, 0.9);
            hat(t, i % 2 ? 0.5 : 0.9, i === 14);
            if (i % 2 === 0) bass(t, D + R[b] + (i === 10 ? 12 : 0), d * 1.6, 0.9);
            if (i === 0) pad(t, C[b], d * 16, 0.8);
            lead(t, 62 + R[b] + ARP[i % 8], d * 0.9, i % 4 === 0 ? 0.8 : 0.5);
            if (Math.random() < 0.12) glitch(t + d * 0.5, 1);
        } },
        /* phase III: enraged. Four on the floor, a distorted bass, the lead an octave up */
        rage: { bpm: 140, play(s, t, d) {
            const b = (s >> 4) & 3, i = s & 15;
            if (i % 4 === 0 || (b === 3 && i === 14)) kick(t, 1.1);
            if (i === 4 || i === 12 || (b === 3 && i >= 13)) snare(t, 1);
            hat(t, i % 2 ? 0.6 : 1, i % 4 === 2);
            bass(t, D + R[b] + (i % 4 === 3 ? 12 : 0), d * 0.9, 1, true);
            if (i === 0) pad(t, C[b].map(m => m + 12), d * 16, 1);
            if (i % 2 === 0) lead(t, 74 + R[b] + ARP[(i >> 1) % 8], d * 1.2, 0.7);
            if (Math.random() < 0.08) glitch(t, 1.2);
        } },
        /* THE MEMORY LEAK, in E minor: chiptune pulses and drips */
        alloc: { bpm: 118, play(s, t, d) {
            const b = (s >> 4) & 3, i = s & 15, r = [0, 0, -4, -2][b];
            if (i === 0 || i === 7 || i === 10) kick(t, 0.9);
            if (i % 4 === 2) hat(t, 0.5);
            if (i % 2 === 0) bass(t, 40 + r + (i === 12 ? 7 : 0), d * 1.4, 0.8);
            if (i === 0) pad(t, [52 + r, 55 + r, 59 + r], d * 16, 0.8);
            if ([0, 3, 6, 9, 12].includes(i)) lead(t, 76 + r + [0, 7, 12, 7, 3][[0, 3, 6, 9, 12].indexOf(i)], d * 0.8, 0.55);
        } },
        pointers: { bpm: 128, play(s, t, d) {
            const b = (s >> 4) & 3, i = s & 15, r = [0, 0, -4, -2][b];
            if (i % 4 === 0) kick(t, 1);
            if (i === 4 || i === 12) snare(t, 0.85);
            hat(t, i % 2 ? 0.45 : 0.8);
            bass(t, 40 + r + (i % 8 === 6 ? 12 : 0), d * 0.9, 0.85);
            if (i === 0) pad(t, [52 + r, 55 + r, 59 + r], d * 16, 0.7);
            lead(t, 64 + r + [0, 3, 7, 12, 15, 12, 7, 3][i % 8], d * 0.8, i % 4 === 0 ? 0.7 : 0.45);
        } },
        frag: { bpm: 142, play(s, t, d) {
            const b = (s >> 4) & 3, i = s & 15, r = [0, 0, -4, -2][b];
            if (i % 4 === 0 || i === 14) kick(t, 1.1);
            if (i === 4 || i === 12 || (b === 3 && i > 12)) snare(t, 1);
            hat(t, i % 2 ? 0.6 : 1, i % 8 === 6);
            bass(t, 40 + r + (i % 4 === 3 ? 12 : 0), d * 0.8, 1, true);
            if (i === 0) pad(t, [64 + r, 67 + r, 71 + r], d * 16, 0.9);
            if (i % 2 === 0) lead(t, 76 + r + [0, 12, 7, 15][(i >> 1) % 4], d * 0.9, 0.6);
            if (Math.random() < 0.1) glitch(t, 1);
        } },
        recall: { bpm: 100, play(s, t, d) {
            const i = s & 15;
            if (i === 0 || i === 8) kick(t, 0.6);
            if ((s & 31) === 0) pad(t, [40, 52, 59], d * 32, 1.2);
            if (i === 12) hat(t, 0.25, true);
        } },
        /* the seal: the music drops away to a heartbeat under a drone */
        seal: { bpm: 140, play(s, t, d) {
            const i = s & 15;
            if (i === 0 || i === 3) kick(t, i ? 0.7 : 1);
            if (i === 0 && (s & 31) === 0) { pad(t, [26, 38, 45], d * 32, 1.4); }
            if (i === 8) hat(t, 0.3, true);
        } },
    };

    function _pump() {
        if (!song || !ctx) return;
        const d = 60 / song.bpm / 4;
        while (nextT < ctx.currentTime + LOOK) {
            try { song.play(step, nextT, d); } catch (e) {}
            nextT += d; step++;
        }
    }
    function _hold(on) {
        if (on === holding) return;
        holding = on;
        try { if (window.GameMusic) on ? GameMusic.hold('bossAudio') : GameMusic.release('bossAudio'); } catch (e) {}
    }

    function songTo(name) {
        const S = SONGS[name]; if (!S || !_ensure()) return false;
        _hold(true);
        if (!song) { step = 0; nextT = ctx.currentTime + 0.05; }
        else step = (step + 15) & ~15;   // a new song starts on the next bar line, so the change lands on the beat
        song = S;
        if (!timer) timer = setInterval(_pump, TICK_MS);
        _pump();
        return true;
    }
    function stop() {
        song = null;
        if (timer) { clearInterval(timer); timer = 0; }
        _hold(false);
    }
    function duck(on) { if (on !== ducked) { ducked = on; _levels(); } }

    /* ── effects ── */
    const FX = {
        siren(t) { for (let i = 0; i < 4; i++) _osc('square', i % 2 ? 660 : 880, t + i * 0.26, 0.24, 0.12, sfxBus, 0.01);
                   _osc('sine', 70, t, 1.1, 0.5, sfxBus, 0.02, 30); },
        hit(t) { _osc('triangle', 480 + Math.random() * 120, t, 0.06, 0.3, sfxBus, 0.002, 220); _noise(t, 0.03, 0.12, sfxBus, 'highpass', 4000); },
        crit(t) { FX.hit(t); [1320, 1980, 2640].forEach((f, i) => _osc('sine', f, t, 0.45 - i * 0.1, 0.18 / (i + 1), sfxBus, 0.002)); },
        reflect(t) { const g = ctx.createGain(); g.connect(sfxBus); _env(g, t, 0.003, 0.4, 0.2);
                     [88, 93].forEach(f => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(crush); o.start(t); o.stop(t + 0.25); });
                     _osc('square', 140, t, 0.18, 0.12, sfxBus, 0.002, 70); },
        echo(t) { _noise(t, 0.32, 0.25, sfxBus, 'bandpass', 3200, 380, 3); _osc('sine', 300, t, 0.3, 0.2, sfxBus, 0.01, 120); },
        tell(t, dur) { _osc('sine', 420, t, dur || 0.6, 0.12, sfxBus, 0.02, 980); },
        shut(t) { _osc('sine', 130, t, 0.18, 0.5, sfxBus, 0.002, 55); _noise(t, 0.04, 0.2, sfxBus, 'lowpass', 1200); },
        immune(t) { _osc('square', 220, t, 0.05, 0.06, sfxBus, 0.002, 200); },
        tearLaunch(t) { _osc('square', 1300, t, 0.14, 0.08, sfxBus, 0.002, 260); },
        tearShot(t) { _noise(t, 0.05, 0.25, sfxBus, 'highpass', 2500); _osc('sine', 980, t, 0.07, 0.2, sfxBus, 0.002, 1600); },
        tearLand(t) { _noise(t, 0.28, 0.35, sfxBus, 'lowpass', 700, 120); _osc('sawtooth', 75, t, 0.22, 0.25, sfxBus, 0.002, 40); },
        jump(t) { _osc('sine', 260, t, 0.16, 0.12, sfxBus, 0.005, 1300); },
        phase(t) { _osc('sine', 90, t, 1.1, 0.8, sfxBus, 0.003, 28); _noise(t, 0.9, 0.3, sfxBus, 'lowpass', 6000, 200);
                   [146.8, 155.6, 220].forEach(f => _osc('triangle', f, t, 1.4, 0.1, sfxBus, 0.005)); },
        sealTick(t) { _osc('sine', 2200, t, 0.03, 0.12, sfxBus, 0.001); },
        lock(t, n) { const b = 880 * Math.pow(2, (n || 0) * 4 / 12); [1, 2.01, 3].forEach((k, i) => _osc('sine', b * k, t, 0.9 - i * 0.25, 0.22 / (i + 1), sfxBus, 0.002)); },
        sealMiss(t) { [146.8, 155.6, 207.7].forEach(f => _osc('sawtooth', f, t, 0.5, 0.1, sfxBus, 0.003, f * 0.8)); _noise(t, 0.3, 0.3, sfxBus, 'lowpass', 900); },
        alloc(t) { _osc('sine', 1400, t, 0.09, 0.07, sfxBus, 0.002, 500); _osc('sine', 700, t + 0.05, 0.06, 0.05, sfxBus, 0.002, 350); },
        free(t, kb) { const f = kb >= 64 ? 420 : kb >= 32 ? 620 : 860; _osc('square', f, t, 0.07, 0.14, sfxBus, 0.002, f * 1.6); _noise(t, 0.04, 0.12, sfxBus, 'highpass', 3000); },
        segfault(t) { _osc('sawtooth', 110, t, 0.3, 0.18, sfxBus, 0.002, 60); _osc('square', 1760, t, 0.05, 0.08, sfxBus, 0.001); _noise(t, 0.2, 0.2, sfxBus, 'bandpass', 900, 300, 2); },
        chainDone(t) { [72, 76, 79].forEach((m, i) => _osc('square', hz(m), t + i * 0.06, 0.18, 0.08, sfxBus, 0.002)); },
        gcReady(t) { [79, 84].forEach((m, i) => _osc('sine', hz(m), t + i * 0.09, 0.3, 0.15, sfxBus, 0.003)); },
        gc(t) { _noise(t, 0.7, 0.35, sfxBus, 'lowpass', 200, 8000); _osc('sine', 110, t, 0.8, 0.4, sfxBus, 0.01, 440);
                [64, 67, 71, 76].forEach((m, i) => _osc('triangle', hz(m), t + 0.15 + i * 0.05, 0.4, 0.1, sfxBus, 0.003)); },
        heapWarn(t) { _osc('square', 988, t, 0.09, 0.07, sfxBus, 0.002); _osc('square', 988, t + 0.16, 0.09, 0.07, sfxBus, 0.002); },
        cell(t, i) { const m = [64, 67, 69, 71, 74, 76, 79, 81, 83][i || 0]; _osc('triangle', hz(m), t, 0.35, 0.22, sfxBus, 0.004); _osc('sine', hz(m + 12), t, 0.2, 0.06, sfxBus, 0.004); },
        win(t) { [62, 66, 69, 74, 78].forEach((m, i) => { _osc('sine', hz(m), t + i * 0.09, 1.2, 0.2, sfxBus, 0.003); _osc('triangle', hz(m + 12), t + i * 0.09, 0.5, 0.06, sfxBus, 0.003); });
                 _osc('sine', 73.4, t, 1.6, 0.4, sfxBus, 0.01); },
        fail(t) { _osc('sawtooth', 294, t, 1.3, 0.16, sfxBus, 0.01, 73); _osc('sawtooth', 311, t, 1.3, 0.12, sfxBus, 0.01, 78); _noise(t, 1.2, 0.2, sfxBus, 'lowpass', 2000, 100); },
    };
    function sfx(name, arg) {
        const f = FX[name]; if (!f || !_ensure()) return false;
        try { f(ctx.currentTime + 0.005, arg); } catch (e) { return false; }
        return true;
    }

    return { song: songTo, stop, sfx, duck, enabled: () => _on() && !!(window.AudioContext || window.webkitAudioContext),
             _qaLevel: () => { if (!meter) return 0; const a = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(a);
                               let m = 0; for (const v of a) m = Math.max(m, Math.abs(v)); return m; },
             _qa: () => ({ song: song ? Object.keys(SONGS).find(k => SONGS[k] === song) : null, holding, ducked, state: ctx ? ctx.state : 'none', step }) };
})();
window.BossAudio = BossAudio;


/* ── 2. THE REALITY BREACH ──────────────────────────────────────────────────

   Replaces the AnomalyBoss block in game.js (see README: Integration). Same global name and public surface, so the
   music director (music.js: AnomalyBoss._active), the Auto-Breach Firewall (hit(n, 'firewall') and _autoHitAccum),
   the run reset, the quit sweep and the save hoard (state._breachHoard) all keep working untouched.

   THE FIGHT. A target you can spam is not a boss. This one has to be read.
     Everywhere  - THE SHELL. Six plates open and close on a rhythm. They flicker white just before they shut.
                   A hit on a shut shell is REFLECTED: it heals the breach and it steals from you.
                 - THE WEAK POINT. A small glowing mark on the rim. A hit on it is CRITICAL (triple damage) and sends it
                   somewhere else on the rim; it drifts in phase II and races in phase III. Anywhere else is a graze.
                 - IT EATS. It takes 10 / 20 / 30% of your income while it is up, and holds it.
     Phase I     - It sits still and teaches the shell.
     Phase II    - IT SPLITS. Two echoes. The echoes flicker now and then and their shards orbit the other way; the
                   real breach is steady and its eye follows your cursor. An echo cannot be killed: strike one and a beam shows it feeding the
                   real one (+2). They shuffle every 5.5 s, and each landing spot is marked a moment before.
     Phase III   - ENRAGED. One rhythm: each time its shell shuts it fires two tears at your energy counter and jumps
                   somewhere new (the spot is marked first); while the shell is open it holds still. A tear that lands steals 6 s of income into its hoard and heals it. Shoot them down.
     The seal    - At zero it does not die. It collapses, and a marker sweeps a ring with three lit arcs. Press as
                   the marker crosses the lit arc, three times, in 7 s. A miss and it tears free with 15% back.
                   Only a person can seal it: the Auto-Breach Firewall deals damage but cannot seal.
   Every boundary is a stagger: a beat where it cannot be hurt, so a big hit never skips a phase.

   THE PAY (unchanged in kind): everything it ate comes back, a bounty of 225-900 s of income (_birdPay), fragments
   (x3 with Breach Protocol). New: a clean fight (nothing reflected, no echo struck, no tear landed, no seal missed)
   pays the bounty x1.5. If it escapes it keeps what it ate and instability rises 15. */

const AnomalyBoss = (() => {
    'use strict';
    const K = () => window.BossKit;

    /* ── tuning ─────────────────────────────────────────────────────────── */
    const COL = '#ff2d6a', COL_II = '#c23bff', COL_RAGE = '#ff5a1e', COL_SEAL = '#5cf2ff', COL_WIN = '#44ffaa';
    const MIN_ENERGY = 1e8;
    const FIRST_MS = 30 * 60000, GAP_MS = 35 * 60000, GAP_SPREAD_MS = 20 * 60000, ROLL = 0.02, ROLL_EVERY_MS = 15000;
    const HP_MIN = 150, HP_SPREAD = 30, LIFE_S = 105;         // tuned for taps as well as clicks (tests/balance.js); heals are shares of this
    const FEED = [0.10, 0.20, 0.30];                        // share of income it eats, by phase
    const SHELL = [                                          // seconds open / warning flicker / shut, by phase
        { open: 3.4, tell: 0.75, shut: 1.5 },
        { open: 3.2, tell: 0.60, shut: 1.3 },   // phase II gives more time open: finding the real one is the work
        { open: 3.0, tell: 0.55, shut: 1.5 },   // phase III: while shut it jumps and fires; while open it holds still
    ];
    const FIRST_OPEN_S = 4.5;                               // the very first window is generous
    const WEAK_R = 74, WEAK_HIT = 24, WEAK_HIT_TOUCH = 36, WEAK_DMG = 3;   // the weak point: radius on the rim, hit radius for a mouse / a finger (art units), damage
    const WEAK_DRIFT = [0, 34, 45];                         // how fast it slides round the rim, degrees a second, by phase
    const STAGGER_S = 1.1;
    const REFLECT_HEAL = 0.012, REFLECT_STEAL_S = 2;        // a hit on a shut shell: heals 1.2% of max
    const ECHOES = 2, ECHO_HEAL = 0.006, ECHO_COOL_S = 1.0, SHUFFLE_S = 5.5;   // phase II (one echo heals at most once a second)
    const FLICK_GAP = [0.35, 0.8], FLICK_S = 0.2;           // an echo flickers every 0.35-0.8 s, for 0.2 s
    const LINE_II = 0.65, LINE_III = 0.40;                  // the phase lines, as shares of HP: phase II is the shortest stretch
    const TELL_S = 0.45;                                    // the mark before any jump or shuffle
    const TEAR_FLIGHT_S = 2.6, TEAR_HEAL = 0.015, TEAR_STEAL_S = 6;   // phase III fires two tears each time its shell shuts
    const SEAL_LOCKS = 3, SEAL_WINDOW_S = 7, SEAL_REV_S = 0.85, SEAL_SPEEDUP = 1.18, SEAL_FAIL_HP = 0.15;
    const HIT = [500, 0.005, 2], BOUNTY = [50000, 0.40, 900], CLEAN_MULT = 1.5;

    /* ── state ──────────────────────────────────────────────────────────── */
    let _active = false, _ready = false, _mode = 'off';     // off | intro | fight | stagger | seal | dying
    let _hp = 0, _max = 0, _phase = 0, _left = 0, _t = 0;
    let _shell = 'open', _shellUntil = 0, _staggerUntil = 0, _afterStagger = null;
    let _shuffleAt = 0;
    let _raf = 0, _lastTs = 0, _px = -1, _py = -1;
    let _real = null, _echoes = [], _tears = [], _seal = null;
    let _stats = null, _hints = null, _uid = 0;
    let _nextBoss = Date.now() + FIRST_MS;

    /* ── game hooks (bare names are game.js script-scope bindings) ─────── */
    const S = () => (typeof state !== 'undefined' ? state : {});
    const _running = () => (typeof isRunning !== 'undefined' ? !!isRunning : true);
    const _fmt = n => (typeof format === 'function' ? format(n) : String(Math.round(n)));
    const _pay = (a, b, c) => (typeof _birdPay === 'function' ? _birdPay(a, b, c) : window._qaBirdPay ? window._qaBirdPay(a, b, c) : a);
    const _income = () => Math.max(0, +S()._realEPS || +S().eps || 0);
    /* a sound: the boss's own (BossAudio), or the game's nearest one when Web Audio is unavailable */
    const _fx = (name, fallback, arg) => {
        try { if (window.BossAudio && BossAudio.sfx(name, arg)) return; } catch (e) {}
        try { if (fallback === 'click') { if (window.Sounds && Sounds.click) Sounds.click(); } else if (fallback && window.GameSound) GameSound.play(fallback); } catch (e) {}
    };
    const _music = name => { try { if (window.BossAudio) name ? BossAudio.song(name) : BossAudio.stop(); } catch (e) {} };
    const _ticker = (t, c, ms) => { try { if (window.Ticker) Ticker.show(t, c, ms); } catch (e) {} };
    const _calm = () => !!(K() && K().calm());
    function _paused() {
        const b = document.body.classList;
        return !_running() || b.contains('panel-open') || b.contains('crash-freeze') || !!window._loreActive
            || !!(window.CognitiveDampener && CognitiveDampener.isActive && CognitiveDampener.isActive());
    }

    /* ── art ────────────────────────────────────────────────────────────── */
    const CSS = `
.rb{position:fixed;left:0;top:0;z-index:9500;width:var(--rb-size);height:var(--rb-size);margin:calc(var(--rb-size) / -2) 0 0 calc(var(--rb-size) / -2);
  --rb-size:clamp(130px,24vmin,240px);--rb-col:${COL};color:var(--rb-col);pointer-events:none;outline:none;will-change:transform;}
.rb,.rb-tear,.rb-seal{touch-action:manipulation;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.rb.echo.flick .rb-body{opacity:.2;transform:translateX(5px) skewX(-10deg)}
.rb.calm.echo.flick .rb-body{transform:none}
.rb-body{position:absolute;inset:0;transition:opacity .12s linear,transform .25s ease;}
.rb.blink .rb-body{opacity:0;transform:scale(.6)}
.rb-art{width:100%;height:100%;overflow:visible;display:block;filter:drop-shadow(0 0 14px color-mix(in srgb,var(--rb-col) 70%,transparent));}
.rb-hit{fill:transparent;pointer-events:all;cursor:crosshair}
.rb-ring{fill:none;stroke:var(--rb-col);stroke-width:3;stroke-dasharray:130 26 64 18 96 30 58 20;opacity:.9}
.rb-jag{fill:none;stroke:var(--rb-col);stroke-width:1.5;opacity:.55}
.rb-shard{fill:var(--rb-col);stroke:#fff;stroke-width:1;stroke-opacity:.5}
.rb-sclera{fill:#0b0410;stroke:var(--rb-col);stroke-width:2}
.rb-weak{transition:opacity .15s}
.rb-weak-glow{fill:#fff;opacity:.18;animation:rbWeak .9s ease-in-out infinite alternate}
.rb-weak-ring{fill:none;stroke:#fff;stroke-width:2.5}
.rb-weak-core{fill:#fff;stroke:var(--rb-col);stroke-width:1.5}
.rb.shut .rb-weak,.rb.stagger .rb-weak{opacity:.2}
.rb.calm .rb-weak-glow{animation:none}
.rb.mock .rb-body{animation:rbMock .45s steps(3)}
.rb-beam{position:fixed;inset:0;z-index:9510;pointer-events:none;width:100vw;height:100vh;overflow:visible}
.rb-beam line{stroke:#ff5470;stroke-width:4;stroke-linecap:round;stroke-dasharray:14 10;filter:drop-shadow(0 0 6px #ff5470);animation:rbBeam .5s linear forwards}
.rb-pupil{fill:#050008}
.rb-glint{fill:#fff;opacity:.85}
.rb-crack{fill:none;stroke:#fff;stroke-width:2.2;stroke-linecap:round;opacity:0;transition:opacity .2s}
.rb[data-cracks="1"] .rb-c1,.rb[data-cracks="2"] .rb-c1,.rb[data-cracks="2"] .rb-c2,
.rb[data-cracks="3"] .rb-c1,.rb[data-cracks="3"] .rb-c2,.rb[data-cracks="3"] .rb-c3{opacity:.9}
.rb-petal{fill:#14061c;stroke:var(--rb-col);stroke-width:2;stroke-linejoin:round;
  transform:translateY(-40px) scale(.42);opacity:.75;transition:transform .2s cubic-bezier(.5,0,.2,1.3),opacity .2s,fill .1s;}
.rb.shut .rb-petal{transform:none;opacity:1}
.rb.tell .rb-petal{animation:rbTell .14s steps(2) infinite}
.rb.tell .rb-ring{stroke:#fff}
.rb-spin-a{animation:rbSpin 9s linear infinite}
.rb-spin-b{animation:rbSpin 14s linear infinite reverse}
.rb-orbit{animation:rbSpin 5s linear infinite}
.rb.echo .rb-orbit{animation-direction:reverse}
.rb.p3 .rb-spin-a{animation-duration:3s}.rb.p3 .rb-orbit{animation-duration:2.2s}
.rb.hit .rb-body{animation:rbHit .16s ease}
.rb.crit .rb-body{animation:rbCrit .22s ease}
.rb.stagger .rb-body{animation:rbStagger .28s steps(2) infinite}
.rb.collapsed .rb-body{transform:scale(.62)}
.rb.collapsed .rb-petal{transform:none;opacity:1;fill:#04161c}
.rb.dead .rb-body{animation:rbDie .9s cubic-bezier(.6,0,.4,1) forwards}
.rb.fled .rb-body{animation:rbFlee .7s ease-in forwards}
.rb.shatter .rb-body{animation:rbShatter .35s ease-out forwards}
.rb.calm .rb-spin-a,.rb.calm .rb-spin-b,.rb.calm .rb-orbit,.rb.calm.tell .rb-petal{animation:none}
.rb.calm.tell .rb-petal{fill:#fff}

.rb-ghost{position:fixed;left:0;top:0;z-index:9490;width:var(--rb-size);height:var(--rb-size);--rb-size:clamp(130px,24vmin,240px);
  margin:calc(var(--rb-size) / -2) 0 0 calc(var(--rb-size) / -2);pointer-events:none;color:var(--rb-col);animation:rbGhost .45s ease-out both;}
.rb-ghost svg{width:100%;height:100%;overflow:visible}
.rb-ghost circle{fill:none;stroke:currentColor;stroke-width:2;stroke-dasharray:6 8}

.rb-tear{position:fixed;left:0;top:0;z-index:9520;width:44px;height:44px;margin:-22px 0 0 -22px;padding:0;border:0;background:none;
  color:var(--rb-col);cursor:crosshair;outline:none;}
.rb-tear svg{width:100%;height:100%;overflow:visible;filter:drop-shadow(0 0 6px currentColor)}
.rb-tear .rb-tear-core{fill:currentColor;stroke:#fff;stroke-width:1.5}
.rb-tear .rb-tear-trail{fill:none;stroke:currentColor;stroke-width:2;opacity:.5}
.rb-tear:focus-visible{outline:2px solid #fff;outline-offset:2px}
.rb-tear.pop{animation:rbShatter .25s ease-out forwards;pointer-events:none}

.rb-seal{position:fixed;inset:0;z-index:9580;cursor:crosshair;}
.rb-seal svg{position:absolute;left:0;top:0;width:340px;height:340px;margin:-170px 0 0 -170px;overflow:visible;pointer-events:none}
.rb-seal-track{fill:none;stroke:rgba(255,255,255,.14);stroke-width:10}
.rb-seal-arc{fill:none;stroke:${COL_SEAL};stroke-width:12;opacity:.22}
.rb-seal-arc.now{opacity:1;filter:drop-shadow(0 0 6px ${COL_SEAL});animation:rbArc .5s ease-in-out infinite alternate}
.rb-seal-arc.done{opacity:1;stroke:${COL_WIN};animation:none}
.rb-seal-mark{fill:#fff;stroke:${COL_SEAL};stroke-width:2;filter:drop-shadow(0 0 6px #fff)}
.rb-seal-time{fill:none;stroke:${COL_SEAL};stroke-width:3;opacity:.7}
.rb-seal.calm .rb-seal-arc.now{animation:none}
.rb-seal.miss .rb-seal-track{stroke:${COL};}

.rb-drained{animation:rbDrained .4s ease}

@keyframes rbSpin{to{transform:rotate(360deg)}}
@keyframes rbWeak{from{transform:scale(.8)}to{transform:scale(1.25)}}
@keyframes rbMock{0%{opacity:.3;filter:saturate(0) brightness(1.8)}50%{opacity:.8}100%{opacity:1;filter:none}}
@keyframes rbBeam{0%{opacity:1;stroke-dashoffset:0}100%{opacity:0;stroke-dashoffset:-48}}
@keyframes rbTell{0%{fill:#fff}100%{fill:#14061c}}
@keyframes rbHit{50%{transform:scale(.94)}}
@keyframes rbCrit{0%{filter:brightness(2.5)}40%{transform:scale(.88) rotate(-4deg)}100%{filter:none}}
@keyframes rbStagger{0%{filter:brightness(3) saturate(0)}100%{filter:none}}
@keyframes rbDie{0%{transform:scale(.62)}30%{transform:scale(.8);filter:brightness(3)}100%{transform:scale(0) rotate(200deg);opacity:0}}
@keyframes rbFlee{to{transform:scale(1.4,0);opacity:0}}
@keyframes rbShatter{to{transform:scale(1.6);opacity:0}}
@keyframes rbGhost{from{opacity:0;transform:scale(1.5)}to{opacity:.9;transform:scale(1)}}
@keyframes rbArc{to{stroke-width:16}}
@keyframes rbDrained{30%{transform:scale(.9);filter:brightness(.4) sepia(1) hue-rotate(-50deg) saturate(4)}}
`;
    function _css() {
        if (document.getElementById('rb-css')) return;
        const s = document.createElement('style'); s.id = 'rb-css'; s.textContent = CSS;
        document.head.appendChild(s);
    }

    function _art() {
        const u = 'rb' + (++_uid);
        const jag = [];
        for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, r = i % 2 ? 76 : 84; jag.push((Math.cos(a) * r).toFixed(1) + ',' + (Math.sin(a) * r).toFixed(1)); }
        const petals = [0, 60, 120, 180, 240, 300].map(a =>
            '<g transform="rotate(' + a + ')"><path class="rb-petal" d="M0,-2 L-27,-48 Q0,-56 27,-48 Z"/></g>').join('');
        return '<svg class="rb-art" viewBox="-110 -110 220 220" aria-hidden="true">'
            + '<defs><radialGradient id="' + u + 'g"><stop offset="0" stop-color="currentColor" stop-opacity=".55"/>'
            +   '<stop offset=".6" stop-color="currentColor" stop-opacity=".12"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></radialGradient>'
            + '<radialGradient id="' + u + 'i" cx=".4" cy=".35"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="currentColor"/>'
            +   '<stop offset="1" stop-color="#1a0010"/></radialGradient></defs>'
            + '<circle r="106" fill="url(#' + u + 'g)"/>'
            + '<g class="rb-spin-a"><circle class="rb-ring" r="94"/></g>'
            + '<g class="rb-spin-b"><polygon class="rb-jag" points="' + jag.join(' ') + '"/></g>'
            + '<g class="rb-orbit">' + [0, 60, 120, 180, 240, 300].map(a =>
                  '<polygon class="rb-shard" transform="rotate(' + a + ') translate(0,-84)" points="0,-11 6,3 0,11 -6,3"/>').join('') + '</g>'
            + '<circle class="rb-sclera" r="52"/>'
            + '<circle r="36" fill="url(#' + u + 'i)"/>'
            + '<g class="rb-pupil-g"><ellipse class="rb-pupil" rx="6.5" ry="25"/><circle class="rb-glint" cx="-9" cy="-13" r="3.2"/></g>'
            + '<path class="rb-crack rb-c1" d="M-8,-30 L-2,-12 L-14,4 L-6,22"/>'
            + '<path class="rb-crack rb-c2" d="M22,-18 L10,-2 L26,10 L16,30"/>'
            + '<path class="rb-crack rb-c3" d="M-30,8 L-12,14 L-20,30 M4,-34 L12,-20 L2,-8"/>'
            + '<g class="rb-petals">' + petals + '</g>'
            + '<g class="rb-weak"><circle class="rb-weak-glow" r="17"/><circle class="rb-weak-ring" r="12"/>'
            +   '<path class="rb-weak-core" d="M0,-8 L5.5,0 L0,8 L-5.5,0 Z"/></g>'
            + '<circle class="rb-hit" r="100"/>'
            + '</svg>';
    }
    const TEAR_ART = '<svg viewBox="-22 -22 44 44" aria-hidden="true"><path class="rb-tear-trail" d="M0,10 L0,20"/>'
        + '<path class="rb-tear-core" d="M0,-14 L7,0 L0,10 L-7,0 Z"/><circle r="2.5" fill="#fff"/></svg>';

    /* ── bodies: the real breach and its echoes ────────────────────────── */
    function _body(real) {
        const el = document.createElement('div');
        el.className = 'rb' + (real ? '' : ' echo') + (_calm() ? ' calm' : '');
        el.innerHTML = '<div class="rb-body">' + _art() + '</div>';
        const b = { el, real, x: 0, y: 0, alive: true, wander: Math.random() * 10, pupil: el.querySelector('.rb-pupil-g'),
                    weak: el.querySelector('.rb-weak'), wa: Math.random() * 360, wdir: Math.random() < 0.5 ? -1 : 1, cool: 0 };
        _aimWeak(b);
        if (real) {
            el.id = 'anomaly-boss';   // addressable (the reality tear in systems3, tests); only the real one has it
            el.setAttribute('role', 'button');
            el.tabIndex = 0;
            el.setAttribute('aria-label', 'Reality Breach. Press to strike. Wait while its shell is shut.');
            el.addEventListener('keydown', e => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault(); e.stopPropagation();
                if (_mode === 'seal') { _sealPress(); return; }
                _strike(b, b.x, b.y, 'key');
            });
        } else {
            el.setAttribute('aria-hidden', 'true');
        }
        /* strike on the press, not the click: on a touchscreen the click comes only when the finger lifts, and not at
           all if the target moved meanwhile or the browser took two quick taps for a zoom */
        el.addEventListener('pointerdown', e => {
            if (e.button > 0) return;
            e.preventDefault(); e.stopPropagation();
            if (_mode === 'seal') return;
            _strike(b, e.clientX, e.clientY, 'click', e.pointerType === 'touch' || e.pointerType === 'pen');
        });
        el.addEventListener('click', e => e.stopPropagation());   // the game's own click handlers never see a strike
        document.body.appendChild(el);
        return b;
    }
    function _aimWeak(b) { if (b.weak) b.weak.setAttribute('transform', 'rotate(' + b.wa.toFixed(1) + ') translate(0,-' + WEAK_R + ')'); }
    /* a click, in the art's own units (the 220-wide viewBox), measured from the body's centre */
    function _local(b, x, y) {
        const r = b.el.getBoundingClientRect(), k = 220 / Math.max(1, r.width);
        return { x: (x - (r.left + r.width / 2)) * k, y: (y - (r.top + r.height / 2)) * k };
    }
    function _onWeak(b, x, y, touch) {
        const p = _local(b, x, y), a = b.wa * Math.PI / 180;
        return Math.hypot(p.x - Math.sin(a) * WEAK_R, p.y + Math.cos(a) * WEAK_R) <= (touch ? WEAK_HIT_TOUCH : WEAK_HIT);
    }
    function _place(b, x, y) {
        b.x = x; b.y = y;
        b.el.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
    }
    function _size() { return _real ? _real.el.offsetWidth || 200 : 200; }
    function _area() {
        const W = window.innerWidth, H = window.innerHeight, m = _size() / 2 + 12;
        const tg = _target(), floorY = tg.el ? tg.y - 50 : H - 90;      // never on top of the energy counter
        const y0 = 96 + m, y1 = Math.max(y0 + 1, Math.min(H - m - 12, floorY - m));
        return { x0: m, x1: Math.max(m + 1, W - m), y0, y1 };
    }
    function _spot(avoid, minD) {
        const a = _area();
        let best = null, bestD = -1;
        for (let i = 0; i < 24; i++) {
            const p = { x: a.x0 + Math.random() * (a.x1 - a.x0), y: a.y0 + Math.random() * (a.y1 - a.y0) };
            const d = avoid.reduce((m, q) => Math.min(m, Math.hypot(p.x - q.x, p.y - q.y)), 1e9);
            if (d >= minD) return p;
            if (d > bestD) { bestD = d; best = p; }
        }
        return best;
    }
    function _ghost(x, y, col) {
        const g = document.createElement('div');
        g.className = 'rb-ghost';
        g.style.setProperty('--rb-col', col || _col());
        g.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
        g.innerHTML = '<svg viewBox="-110 -110 220 220" aria-hidden="true"><circle r="96"/><circle r="40"/></svg>';
        document.body.appendChild(g);
        setTimeout(() => g.remove(), TELL_S * 1000 + 120);
    }
    function _bodies() { return [_real].concat(_echoes).filter(Boolean); }
    function _col() { return _phase === 2 ? COL_RAGE : _phase === 1 ? COL_II : COL; }

    /* ── lifecycle ──────────────────────────────────────────────────────── */
    function spawn() {
        if (_active || !_running()) return false;
        if ((S().energy || 0) < MIN_ENERGY) return false;
        if (window.GlobalEventQueue && !GlobalEventQueue.hold('anomalyBoss')) return false;   // another crisis is up
        _css();
        _active = true; _ready = false; _mode = 'intro';
        _max = HP_MIN + Math.floor(Math.random() * HP_SPREAD);
        _hp = _max; _phase = 0; _left = LIFE_S; _t = 0;
        _stats = { hits: 0, crits: 0, reflects: 0, echoes: 0, shot: 0, landed: 0, sealMiss: 0, stolen: 0, at: [] };   // at: fight seconds each phase began
        _hints = {};
        S()._breachHoard = 0;
        _ticker('REALITY BREACH: a massive anomaly has appeared', '#ff2255', 8000);
        _fx('siren', 'sfx:breach');
        K().intro({ name: 'REALITY BREACH', sub: 'IT EATS WHAT YOU MAKE. IT KEEPS WHAT IT EATS.', col: COL })
            .then(() => { if (_active) _appear(); });
        return true;
    }

    function _appear() {
        _real = _body(true);
        _place(_real, window.innerWidth / 2, Math.max(90 + _size() / 2, window.innerHeight * 0.45));
        K().bar({ name: 'REALITY BREACH', col: COL, marks: [LINE_II, LINE_III] });
        K().phase('PHASE I');
        _mode = 'fight'; _ready = true;
        _shell = 'open'; _shellUntil = FIRST_OPEN_S;
        document.addEventListener('pointermove', _onPointer, { passive: true });
        document.addEventListener('pointerdown', _onPointer, { passive: true });
        document.addEventListener('keydown', _onKey, true);
        _lastTs = performance.now();
        _refresh();
        _hintAt('weak', 'HIT THE GLOWING WEAK POINT FOR TRIPLE DAMAGE', 'target', 3200);
        _music('watch');
        _raf = requestAnimationFrame(_frame);
    }

    function _onPointer(e) { _px = e.clientX; _py = e.clientY; }
    function _onKey(e) {
        if (_mode !== 'seal') return;
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); _sealPress(); }
    }

    function _frame(now) {
        if (!_active) return;
        _raf = requestAnimationFrame(_frame);
        const dt = Math.min(0.1, (now - _lastTs) / 1000);
        _lastTs = now;
        const paused = _paused();
        try { if (window.BossAudio) BossAudio.duck(paused); } catch (e) {}
        if (!_ready || paused) return;   // a panel, a cutscene, the dampener, the fake crash: everything holds
        _t += dt;

        if (_mode === 'fight' || _mode === 'stagger') {
            const take = Math.min(Math.max(0, S().energy || 0), _income() * FEED[_phase] * dt);
            if (take > 0) { S().energy -= take; S()._breachHoard = (S()._breachHoard || 0) + take; }
        }
        if (_mode === 'stagger' && _t >= _staggerUntil) {
            _bodies().forEach(b => b.el.classList.remove('stagger'));
            _mode = 'fight';
            const f = _afterStagger; _afterStagger = null;
            if (f) f();
        }
        if (_mode === 'fight') {
            _left -= dt;
            _stepShell();
            if (_phase === 1 && _t >= _shuffleAt) _shuffle();
            if (_left <= 0) { _escape(); return; }
        }
        _stepTears(dt);
        if (_mode === 'seal') _stepSeal(dt);
        if (_phase === 1) _echoes.forEach(e => {   // echoes flicker now and then; the real one is steady (a tell that needs no cursor)
            if (_t >= (e.flickAt || 0)) { e.el.classList.add('flick'); e.flickEnd = _t + FLICK_S; e.flickAt = _t + FLICK_GAP[0] + Math.random() * (FLICK_GAP[1] - FLICK_GAP[0]); }
            else if (e.flickEnd && _t >= e.flickEnd) { e.el.classList.remove('flick'); e.flickEnd = 0; }
        });
        if (_mode === 'fight' && WEAK_DRIFT[_phase]) _bodies().forEach(b => { b.wa = (b.wa + b.wdir * WEAK_DRIFT[_phase] * dt + 360) % 360; _aimWeak(b); });
        _stepEyes();
        _refresh();
    }

    function _stepShell() {
        if (_t < _shellUntil) return;
        const c = SHELL[_phase];
        if (_shell === 'open') {
            _shell = 'tell'; _shellUntil = _t + c.tell;
            _fx('tell', null, c.tell);
            _hintAt('tell', 'IT IS CLOSING. HOLD FIRE.', 'shield', 2200);
        } else if (_shell === 'tell') {
            _shell = 'shut'; _shellUntil = _t + c.shut;
            _fx('shut');
            /* phase III keeps one rhythm: shut, it fires and jumps (shoot the tears); open, it holds still (hit it) */
            if (_phase === 2) { _volley(); _jump(); }
        } else {
            _shell = 'open'; _shellUntil = _t + c.open * (0.85 + Math.random() * 0.3);   // never quite the same rhythm
        }
        _shellClasses();
    }
    function _shellClasses() {
        _bodies().forEach(b => { b.el.classList.toggle('tell', _shell === 'tell'); b.el.classList.toggle('shut', _shell === 'shut'); });
    }

    /* the real one watches you; an echo looks around on its own */
    function _stepEyes() {
        _bodies().forEach(b => {
            if (!b.pupil) return;
            let dx, dy;
            if (b.real && _px >= 0) { const v = Math.hypot(_px - b.x, _py - b.y) || 1; dx = (_px - b.x) / v; dy = (_py - b.y) / v; }
            else { b.wander += 0.016; dx = Math.sin(b.wander * 1.3); dy = Math.cos(b.wander * 0.9) * 0.6; }
            b.pupil.setAttribute('transform', 'translate(' + (dx * 16).toFixed(1) + ',' + (dy * 16).toFixed(1) + ')');
        });
    }

    function _refresh() {
        if (!_active) return;
        K().hp(_hp / Math.max(1, _max));
        if (_mode === 'seal' && _seal) {
            K().right('SEAL ' + _seal.locks + '/' + SEAL_LOCKS + '  ' + Math.max(0, _seal.until - _t).toFixed(1) + 'S', true);
        } else {
            const s = Math.max(0, Math.ceil(_left));
            K().right('ESCAPES IN ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'), s <= 15);
        }
        /* what it is doing to you is said once, under the bar, never under a body (an echo must not be told apart by it) */
        K().sub(_mode === 'seal' ? 'IT IS COLLAPSING. WHAT IT ATE: ' + _fmt(S()._breachHoard || 0) + ' E'
            : 'EATING ' + Math.round(FEED[_phase] * 100) + '% OF YOUR INCOME   HOLDING ' + _fmt(S()._breachHoard || 0) + ' E');
        const f = (_max - _hp) / Math.max(1, _max), cracks = String(f >= 0.75 ? 3 : f >= 0.5 ? 2 : f >= 0.25 ? 1 : 0);
        _bodies().forEach(b => { if (b.el.dataset.cracks !== cracks) b.el.dataset.cracks = cracks; });
    }

    function _hintAt(key, text, ic, ms) {
        if (_hints[key] || !_real) return;
        _hints[key] = true;
        K().hint(text, _real.x, _real.y + _size() / 2 + 14, ms || 2600, _col(), ic);
    }

    /* ── striking ───────────────────────────────────────────────────────── */
    function _strike(b, x, y, src, touch) {
        if (!_active || !_ready) return false;
        if (_mode === 'stagger') { if (src !== 'firewall') { K().pop(x, y, 'IMMUNE', 'info', '#ffffff'); _fx('immune'); } return false; }
        if (_mode !== 'fight' || !b.alive) return false;

        if (!b.real) {                                  // an echo: it cannot be hurt, it feeds the real one
            if (_t < b.cool) return false;
            b.cool = _t + ECHO_COOL_S;
            b.el.classList.remove('mock'); void b.el.offsetWidth; b.el.classList.add('mock');
            _beam(b, _real);
            K().pop(x, y, 'ECHO', 'info', '#ffffff');
            _heal(_amt(ECHO_HEAL), _real.x, _real.y - 30, 'HEALED +' + _amt(ECHO_HEAL));
            _stats.echoes++;
            _fx('echo');
            K().shake(3);
            _hintAt('echo', 'ECHOES CANNOT DIE. THE REAL ONE NEVER FLICKERS.', 'eye', 3200);
            return false;
        }
        if (_shell === 'shut') {                        // the shell is closed
            if (src === 'firewall') return false;
            _stats.reflects++;
            const steal = Math.min(Math.max(0, S().energy || 0), _income() * REFLECT_STEAL_S);
            if (steal > 0) { S().energy -= steal; S()._breachHoard = (S()._breachHoard || 0) + steal; _stats.stolen += steal; }
            _heal(_amt(REFLECT_HEAL), x, y, 'REFLECTED  +' + _amt(REFLECT_HEAL));
            _fx('reflect');
            K().flash(COL, 0.22); K().shake(2);
            _hintAt('shut', 'THE SHELL IS SHUT. EVERY HIT FEEDS IT.', 'shield', 2400);
            return false;
        }
        let dmg = 1, crit = false;
        if (src === 'click' && _onWeak(b, x, y, touch)) {
            crit = true; dmg = WEAK_DMG;
            b.wa = (b.wa + 120 + Math.random() * 120) % 360; b.wdir = -b.wdir; _aimWeak(b);   // found it: it moves
        }
        _damage(dmg, src);
        if (src === 'firewall') return true;
        _stats.hits++; if (crit) _stats.crits++;
        if (src === 'click') {
            const pay = _pay(HIT[0], HIT[1], HIT[2]);
            S().energy += pay;
            K().pop(x, y, crit ? 'WEAK POINT  -' + WEAK_DMG : '-1', crit ? 'crit' : 'hit', _col());
        } else {
            K().pop(x, y - 20, '-1', 'hit', _col());
        }
        _fx(crit ? 'crit' : 'hit', 'click');
        const cls = crit ? 'crit' : 'hit';
        b.el.classList.remove('hit', 'crit'); void b.el.offsetWidth; b.el.classList.add(cls);
        K().shake(crit ? 4 : 2);
        return true;
    }

    const _line = share => Math.ceil(_max * share);

    /* damage never crosses a phase line in one go: the line is a stagger */
    function _damage(n, src) {
        const floor = _phase === 0 ? _line(LINE_II) : _phase === 1 ? _line(LINE_III) : 0;
        _hp = Math.max(floor, _hp - n);
        if (_hp <= floor) {
            if (_phase < 2) _enterPhase(_phase + 1);
            else _beginSeal();
        }
    }

    /* a line from an echo to the real breach: what it fed, and to whom */
    function _beam(from, to) {
        if (!to) return;
        const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'), l = document.createElementNS(NS, 'line');
        svg.setAttribute('class', 'rb-beam'); svg.setAttribute('aria-hidden', 'true');
        l.setAttribute('x1', from.x); l.setAttribute('y1', from.y); l.setAttribute('x2', to.x); l.setAttribute('y2', to.y);
        svg.appendChild(l); document.body.appendChild(svg);
        setTimeout(() => svg.remove(), 520);
    }

    const _amt = share => Math.max(1, Math.round(_max * share));
    /* a heal never climbs back over a phase line already crossed: a phase, once won, stays won */
    const _ceil = () => _phase === 0 ? _max : _phase === 1 ? _line(LINE_II) : _line(LINE_III);

    function _heal(n, x, y, text) {
        _hp = Math.min(_ceil(), _hp + n);
        K().heal();
        K().pop(x, y, text, 'reflect', '#ff5470');
    }

    /* ── phases ─────────────────────────────────────────────────────────── */
    function _stagger(then) {
        _mode = 'stagger';
        _staggerUntil = _t + STAGGER_S;
        _afterStagger = then;
        _shell = 'open'; _shellClasses();
        _bodies().forEach(b => b.el.classList.add('stagger'));
    }

    function _enterPhase(p) {
        _phase = p;
        _stats.at[p] = Math.round(LIFE_S - _left);
        const col = _col();
        _bodies().forEach(b => { b.el.style.setProperty('--rb-col', col); b.el.classList.toggle('p3', p === 2); });
        K().colour(col);
        K().phase(p === 1 ? 'PHASE II  FIND THE REAL ONE' : 'PHASE III  ENRAGED');
        K().flash(col, 0.4); K().shake(7);
        _fx('phase', 'sfx:breach');
        _music(p === 1 ? 'split' : 'rage');
        _ticker(p === 1 ? 'The breach splits. Only one of them is real.' : 'The breach is enraged. It is coming for your energy.', col, 4000);
        _stagger(() => {
            _shellUntil = _t + SHELL[p].open;
            if (p === 1) { _spawnEchoes(); _shuffleAt = _t; _hintAt('split', 'ECHOES FLICKER AND HEAL IT. HIT THE STEADY ONE.', 'eye', 4200); }
            if (p === 2) _clearEchoes();
        });
    }

    function _spawnEchoes() {
        _clearEchoes();
        for (let i = 0; i < ECHOES; i++) {
            const e = _body(false);
            e.el.style.setProperty('--rb-col', _col());
            _place(e, _real.x, _real.y);
            _echoes.push(e);
        }
        _shellClasses();
    }
    function _clearEchoes() { _echoes.forEach(e => e.el.remove()); _echoes = []; }

    /* every body jumps to a new spot at once; the spots are marked first, but not which one is real */
    function _shuffle() {
        _shuffleAt = _t + SHUFFLE_S + TELL_S;
        const all = _bodies(), spots = [], minD = _size() * 1.25;
        all.forEach(() => spots.push(_spot(spots, minD)));
        spots.forEach(p => _ghost(p.x, p.y));
        _fx('jump');
        const order = spots.slice().sort(() => Math.random() - 0.5);
        all.forEach(b => b.el.classList.add('blink'));
        setTimeout(() => {
            if (!_active || _phase !== 1) return;
            all.forEach((b, i) => {
                b.el.classList.remove('blink');
                _place(b, order[i].x, order[i].y);
            });
        }, TELL_S * 1000);
    }

    function _jump() {
        const p = _spot([{ x: _real.x, y: _real.y }], _size() * 1.4);
        _ghost(p.x, p.y);
        _fx('jump');
        _real.el.classList.add('blink');
        setTimeout(() => {
            if (!_active || _mode === 'seal' || !_real) return;
            _place(_real, p.x, p.y);
            _real.el.classList.remove('blink');
        }, TELL_S * 1000);
    }

    /* ── tears ──────────────────────────────────────────────────────────── */
    function _target() {
        const ids = ['energy-display', 'energy-count', 'energy-counter', 'energy'];
        for (const id of ids) {
            const e = document.getElementById(id);
            if (e && e.offsetParent !== null) { const r = e.getBoundingClientRect(); if (r.width) return { x: r.left + r.width / 2, y: r.top + r.height / 2, el: e }; }
        }
        return { x: window.innerWidth / 2, y: window.innerHeight - 60, el: null };
    }

    function _volley() {
        const n = 2;
        for (let i = 0; i < n; i++) _tear(i, n);
        _fx('tearLaunch');
        _hintAt('tear', 'TEARS STEAL YOUR ENERGY. SHOOT THEM DOWN.', 'energy', 2800);
    }

    function _tear(i, n) {
        const tg = _target();
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'rb-tear';
        el.style.setProperty('--rb-col', COL_RAGE);
        el.setAttribute('aria-label', 'Tear heading for your energy. Press to shoot it down.');
        el.innerHTML = TEAR_ART;
        const x0 = _real.x, y0 = _real.y;
        const mx = (x0 + tg.x) / 2, my = (y0 + tg.y) / 2, len = Math.hypot(tg.x - x0, tg.y - y0) || 1;
        const bend = (i - (n - 1) / 2) * 220 + (Math.random() - 0.5) * 120;   // they fan out, so one sweep cannot get them all
        const t = { el, x0, y0, cx: mx + (-(tg.y - y0) / len) * bend, cy: my + ((tg.x - x0) / len) * bend,
                    t0: _t + i * 0.18, flight: TEAR_FLIGHT_S * (0.9 + Math.random() * 0.2), dead: false, x: x0, y: y0 };
        el.addEventListener('pointerdown', e => { if (e.button > 0) return; e.preventDefault(); e.stopPropagation(); _shoot(t); });
        el.addEventListener('click', e => { e.stopPropagation(); _shoot(t); });   // the keyboard (Enter on a focused tear)
        el.style.transform = 'translate(' + Math.round(x0) + 'px,' + Math.round(y0) + 'px)';
        document.body.appendChild(el);
        _tears.push(t);
    }

    function _stepTears() {
        if (!_tears.length) return;
        const tg = _target();
        _tears.forEach(t => {
            if (t.dead) return;
            const raw = (_t - t.t0) / t.flight;
            if (raw < 0) return;
            const p = Math.min(1, Math.pow(raw, 1.6)), q = 1 - p;   // it accelerates: the last stretch is the fast one
            const x = q * q * t.x0 + 2 * q * p * t.cx + p * p * tg.x, y = q * q * t.y0 + 2 * q * p * t.cy + p * p * tg.y;
            const ang = Math.atan2(y - t.y, x - t.x) * 180 / Math.PI - 90;
            t.x = x; t.y = y;
            t.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + ang.toFixed(0) + 'deg)';
            if (raw >= 1) _land(t, tg);
        });
        _tears = _tears.filter(t => !t.dead);
    }

    function _shoot(t) {
        if (t.dead || !_active) return;
        t.dead = true;
        _stats.shot++;
        t.el.classList.add('pop');
        setTimeout(() => t.el.remove(), 260);
        K().pop(t.x, t.y, 'SHOT', 'info', COL_RAGE);
        _fx('tearShot', 'click');
    }

    function _land(t, tg) {
        t.dead = true; t.el.remove();
        if (_mode !== 'fight' && _mode !== 'stagger') return;
        _stats.landed++;
        const steal = Math.min(Math.max(0, S().energy || 0), _income() * TEAR_STEAL_S);
        if (steal > 0) { S().energy -= steal; S()._breachHoard = (S()._breachHoard || 0) + steal; _stats.stolen += steal; }
        _hp = Math.min(_ceil(), _hp + _amt(TEAR_HEAL));
        K().heal();
        K().pop(tg.x, tg.y - 24, 'STOLEN  -' + _fmt(steal) + ' E', 'reflect');
        K().flash(COL_RAGE, 0.18); K().shake(3);
        _fx('tearLand');
        if (tg.el) { tg.el.classList.remove('rb-drained'); void tg.el.offsetWidth; tg.el.classList.add('rb-drained'); }
    }

    function _clearTears() { _tears.forEach(t => t.el.remove()); _tears = []; }

    /* ── the seal ───────────────────────────────────────────────────────── */
    function _beginSeal() {
        _mode = 'seal';
        if (_stats.at[3] == null) _stats.at[3] = Math.round(LIFE_S - _left);
        _clearTears(); _clearEchoes();
        const W = window.innerWidth, H = window.innerHeight;
        const cx = W / 2, cy = Math.max(200, H * 0.5);
        _real.el.classList.remove('blink', 'tell', 'shut');
        _real.el.classList.add('collapsed');
        _real.el.style.setProperty('--rb-col', COL_SEAL);
        _place(_real, cx, cy);
        K().colour(COL_SEAL);
        K().phase('SEAL IT');
        K().flash('#ffffff', 0.5); K().shake(8);
        _fx('phase', 'sfx:breach');
        _music('seal');

        const arcs = [], base = Math.random() * 360, w = _calm() ? 54 : 40;
        for (let i = 0; i < SEAL_LOCKS; i++) arcs.push({ a: (base + i * 120 + (Math.random() - 0.5) * 50) % 360, w });
        const order = [0, 1, 2].sort(() => Math.random() - 0.5);   // the lit arc is not simply the next one round
        const el = document.createElement('div');
        el.className = 'rb-seal' + (_calm() ? ' calm' : '');
        el.setAttribute('role', 'application');
        el.setAttribute('aria-label', 'Seal the breach. Press Space or click when the marker crosses the lit arc.');
        const R = 150, arcPath = a => {
            const a0 = (a.a - a.w / 2 - 90) * Math.PI / 180, a1 = (a.a + a.w / 2 - 90) * Math.PI / 180;
            return 'M' + (Math.cos(a0) * R).toFixed(1) + ',' + (Math.sin(a0) * R).toFixed(1)
                + ' A' + R + ',' + R + ' 0 0 1 ' + (Math.cos(a1) * R).toFixed(1) + ',' + (Math.sin(a1) * R).toFixed(1);
        };
        el.innerHTML = '<svg viewBox="-170 -170 340 340" aria-hidden="true">'
            + '<circle class="rb-seal-track" r="' + R + '"/>'
            + arcs.map((a, i) => '<path class="rb-seal-arc" data-i="' + i + '" d="' + arcPath(a) + '"/>').join('')
            + '<circle class="rb-seal-time" r="166" transform="rotate(-90)"/>'
            + '<g class="rb-seal-m"><polygon class="rb-seal-mark" points="0,-' + (R + 16) + ' 8,-' + (R - 2) + ' 0,-' + (R - 12) + ' -8,-' + (R - 2) + '"/></g>'
            + '</svg>';
        el.querySelector('svg').style.transform = 'translate(' + Math.round(cx) + 'px,' + Math.round(cy) + 'px)';
        el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); _sealPress(); });
        el.addEventListener('click', e => e.stopPropagation());
        document.body.appendChild(el);
        const timeRing = el.querySelector('.rb-seal-time'), circ = 2 * Math.PI * 166;
        timeRing.style.strokeDasharray = circ.toFixed(1);
        _seal = { el, arcs, order, locks: 0, ang: (arcs[order[0]].a + 180) % 360, dir: 1, speed: 360 * SEAL_REV_S * (_calm() ? 0.75 : 1),
                  until: _t + SEAL_WINDOW_S, mark: el.querySelector('.rb-seal-m'), timeRing, circ, cx, cy };
        _sealLight();
        _ticker('The breach is collapsing. Seal it.', COL_SEAL, 4000);
        K().hint('PRESS AS THE MARKER CROSSES THE LIT ARC', cx, cy + 190, 3200, COL_SEAL, 'target');
        try { el.focus(); } catch (e) {}
    }

    function _sealLight() {
        if (!_seal) return;
        _seal.el.querySelectorAll('.rb-seal-arc').forEach(p => {
            const i = +p.dataset.i, k = _seal.order.indexOf(i);
            p.classList.toggle('done', k < _seal.locks);
            p.classList.toggle('now', k === _seal.locks);
        });
    }

    function _stepSeal(dt) {
        const s = _seal; if (!s) return;
        s.ang = (s.ang + s.dir * s.speed * dt + 360) % 360;
        s.mark.setAttribute('transform', 'rotate(' + s.ang.toFixed(1) + ')');
        const lit = s.arcs[s.order[s.locks]], inArc = Math.abs(((s.ang - lit.a) % 360 + 540) % 360 - 180) <= lit.w / 2;
        if (inArc && !s.inArc) _fx('sealTick');   // a tick as the marker enters the lit arc: the timing, by ear
        s.inArc = inArc;
        const left = Math.max(0, s.until - _t) / SEAL_WINDOW_S;
        s.timeRing.style.strokeDashoffset = (s.circ * (1 - left)).toFixed(1);
        if (_t >= s.until) _sealFail('TOO SLOW');
    }

    function _sealPress() {
        const s = _seal; if (!s || _mode !== 'seal' || _paused()) return;
        const a = s.arcs[s.order[s.locks]];
        const diff = Math.abs(((s.ang - a.a) % 360 + 540) % 360 - 180);
        if (diff <= a.w / 2 + 3) {
            s.locks++;
            _fx('lock', 'click', s.locks - 1);
            K().pop(s.cx, s.cy - 190, 'LOCKED ' + s.locks + '/' + SEAL_LOCKS, 'crit', COL_SEAL);
            K().flash(COL_SEAL, 0.25); K().shake(4);
            if (s.locks >= SEAL_LOCKS) { _defeat(); return; }
            s.dir = -s.dir; s.speed *= SEAL_SPEEDUP;   // it fights the lock: the marker reverses and quickens
            _sealLight();
        } else {
            _sealFail('MISSED');
        }
    }

    function _sealFail(why) {
        const s = _seal; if (!s) return;
        _stats.sealMiss++;
        s.el.classList.add('miss');
        s.el.remove(); _seal = null;
        _hp = Math.max(1, Math.round(_max * SEAL_FAIL_HP));
        _real.el.classList.remove('collapsed');
        _real.el.style.setProperty('--rb-col', COL_RAGE);
        K().colour(COL_RAGE);
        K().phase('PHASE III  ENRAGED');
        K().heal();
        K().pop(_real.x, _real.y - 60, why + '  IT TORE FREE', 'reflect');
        K().flash(COL, 0.45); K().shake(8);
        _fx('sealMiss', 'sfx:breach');
        _music('rage');
        _mode = 'fight';
        _stagger(() => { _shellUntil = _t + SHELL[2].open; });
    }

    /* ── endings ────────────────────────────────────────────────────────── */
    function _stop() {
        _active = false; _ready = false; _mode = 'off';
        cancelAnimationFrame(_raf); _raf = 0;
        document.removeEventListener('pointermove', _onPointer);
        document.removeEventListener('pointerdown', _onPointer);
        document.removeEventListener('keydown', _onKey, true);
        _clearTears(); _clearEchoes();
        if (_seal) { _seal.el.remove(); _seal = null; }
        if (window.GlobalEventQueue) GlobalEventQueue.unhold('anomalyBoss');
        _music(null);
        try { if (window.BossAudio) BossAudio.duck(false); } catch (e) {}
    }

    function _grade() {
        const miss = _stats.reflects + _stats.echoes * 2 + _stats.landed * 2 + _stats.sealMiss * 3;
        const spare = _left / LIFE_S;
        if (miss === 0) return spare > 0.25 ? 'S' : 'A';
        if (miss <= 4) return 'A';
        if (miss <= 9) return 'B';
        return 'C';
    }

    function _defeat() {
        if (!_active) return;
        const st = S();
        const back = Math.max(0, st._breachHoard || 0);
        const eps = _income();
        const clean = _stats.reflects + _stats.echoes + _stats.landed + _stats.sealMiss === 0;
        const bounty = _pay(BOUNTY[0], BOUNTY[1], BOUNTY[2]) * (clean ? CLEAN_MULT : 1);
        const hasProtocol = !!(typeof FragUpgrades !== 'undefined' && FragUpgrades.hasBought && FragUpgrades.hasBought('boss_loot'));
        const baseFrags = 18 + Math.floor(Math.random() * 12);
        const frags = Math.round((hasProtocol ? baseFrags * 3 : baseFrags) * (clean ? 1.5 : 1));
        const grade = _grade(), stats = _stats, secs = LIFE_S - _left;
        st._breachHoard = 0;
        st.energy = (st.energy || 0) + back + bounty;
        st.fragments = (st.fragments || 0) + frags;
        if (hasProtocol) {
            st.multiplier = (st.multiplier || 1) + 2;
            setTimeout(() => { st.multiplier = Math.max(1, (st.multiplier || 1) - 2); if (typeof Game !== 'undefined') Game.update(); }, 30000);
        }
        const el = _real && _real.el; _real = null;
        _stop();
        if (el) { el.classList.add('dead'); setTimeout(() => el.remove(), 950); }
        K().flash('#ffffff', 0.6); K().shake(10);
        K().end();
        if (typeof updateFragmentsUI === 'function') updateFragmentsUI();
        if (typeof Game !== 'undefined' && Game.update) Game.update();
        _fx('win', 'stinger:eventWin');
        const mins = eps > 0 ? bounty / eps / 60 : 0;
        setTimeout(() => K().result({ title: 'BREACH SEALED', col: COL_WIN, grade, rows: [
            ['energy', 'Returned what it ate', '+' + _fmt(back) + ' E'],
            ['energy', 'Bounty' + (clean ? ' (clean x1.5)' : ''), '+' + _fmt(bounty) + ' E' + (mins > 0 ? ' (' + (mins >= 10 ? Math.round(mins) : mins.toFixed(1)) + ' MIN)' : '')],
            ['fragment', 'Fragments', '+' + frags],
            ['clock', 'Sealed in', Math.round(secs) + 'S'],
            ['target', 'Weak point hits', stats.crits + ' OF ' + stats.hits],
            ['shield', 'Mistakes', String(stats.reflects + stats.echoes + stats.landed + stats.sealMiss)],
        ].concat(hasProtocol ? [['mult', 'Breach Protocol', 'x2 FOR 30S']] : []) }), _calm() ? 0 : 700);
        _ticker('BREACH SEALED: +' + frags + ' fragments, +' + _fmt(back + bounty) + ' E' + (hasProtocol ? ', x2 multiplier for 30s' : ''), '#44ffaa', 6000);
        st._bossesDefeated = (st._bossesDefeated || 0) + 1;
        try { if (typeof Achieve !== 'undefined') Achieve.checkAll(); } catch (e) {}
        _scheduleNext();
    }

    function _escape() {
        if (!_active) return;
        const st = S();
        const kept = Math.max(0, st._breachHoard || 0);
        st._breachHoard = 0;   // it keeps what it ate
        const el = _real && _real.el; _real = null;
        _stop();
        if (el) { el.classList.add('fled'); setTimeout(() => el.remove(), 750); }
        K().end();
        st.instability = Math.min(100, (st.instability || 0) + 15);
        try { if (typeof Instability !== 'undefined' && Instability.updateUI) Instability.updateUI(); } catch (e) {}
        _fx('fail', 'stinger:eventFail');
        K().result({ title: 'THE BREACH ESCAPED', col: COL, rows: [['energy', 'It kept', _fmt(kept) + ' E'], ['instability', 'Instability', '+15%']] });
        _ticker('REALITY BREACH escaped. Instability +15', '#ff3355', 4000);
        _scheduleNext();
    }

    function _scheduleNext() { _nextBoss = Date.now() + GAP_MS + Math.random() * GAP_SPREAD_MS; }

    /* ── the game's hooks ───────────────────────────────────────────────── */
    function tick() {
        const st = S();
        /* a fight cut short by a quit, a reload or a crash: what it ate comes back */
        if (!_active && (st._breachHoard || 0) > 0) {
            const back = st._breachHoard; st._breachHoard = 0; st.energy = (st.energy || 0) + back;
            if (typeof showNotif === 'function') showNotif('The breach collapsed with the simulation. What it ate came back: +' + _fmt(back) + ' E', '#44ffaa', 6000);
        }
        if (!_running() || _active) return;
        if (Date.now() < _nextBoss) return;
        if (window.GlobalEventQueue && GlobalEventQueue.isActive()) return;   // never on top of another crisis
        /* System Noise draws breaches (x1 to x4 on the roll, read live) */
        const attract = (window.SystemNoise && typeof SystemNoise.getBossAttractMult === 'function') ? SystemNoise.getBossAttractMult() : 1;
        if (!(Math.random() < ROLL * attract && spawn())) _nextBoss = Date.now() + ROLL_EVERY_MS;
    }

    /* n hits from a click, the keyboard, or the Auto-Breach Firewall */
    function hit(n, src, x, y) {
        if (!_active || !_ready || !_real) return false;
        if (src === 'firewall') {
            if (_mode !== 'fight' || _shell === 'shut') return false;
            _damage(Math.max(1, Math.floor(n) || 1), 'firewall');
            return true;
        }
        return _strike(_real, x == null ? _real.x : x, y == null ? _real.y : y, src === 'click' ? 'click' : 'key');
    }

    /* a quit: no reward, no penalty, nothing left on screen. What it ate stays in the save and comes back on tick. */
    function cancel() {
        if (!_active && !_real) return;
        const el = _real && _real.el; _real = null;
        _stop();
        if (el) el.remove();
        document.querySelectorAll('.rb,.rb-ghost,.rb-tear,.rb-seal,.rb-beam').forEach(e => e.remove());
        K().clear();
    }

    function resetForNewRun() { cancel(); _nextBoss = Date.now() + FIRST_MS; }

    return {
        tick, spawn, hit, cancel, resetForNewRun,
        defeat: () => { if (_active) _defeat(); },
        get _active() { return _active; },
        set _active(v) { _active = v; },
        get _ready() { return _ready; },
        get _hitsLeft() { return _hp; },
        set _hitsLeft(v) { _hp = v; },
        get _maxHits() { return _max; },
        _autoHitAccum: 0,
        /* QA: read-only state, and levers for the viewer and the tests */
        _qa: () => ({ active: _active, ready: _ready, mode: _mode, hits: _hp, max: _max, phase: _phase, left: _left, shell: _shell,
                      hoard: S()._breachHoard || 0, next: _nextBoss - Date.now(), echoes: _echoes.length, tears: _tears.length,
                      seal: _seal ? { locks: _seal.locks, ang: _seal.ang, target: _seal.arcs[_seal.order[_seal.locks]].a, w: _seal.arcs[0].w } : null,
                      real: _real ? { x: _real.x, y: _real.y, weak: _real.wa } : null, stats: _stats ? Object.assign({}, _stats) : null,
                      FEED: FEED.slice(), HIT: HIT.slice(), BOUNTY: BOUNTY.slice(), FIRST_MS, GAP_MS, GAP_SPREAD_MS, ROLL, LIFE_S }),
        _qaSetLeft: s => { _left = s; },
        _qaSetHp: v => { _hp = Math.max(1, Math.min(_max, v)); },
        _qaPhase: p => { while (_active && _phase < p && _mode !== 'seal') { _hp = _phase === 0 ? _line(LINE_II) : _line(LINE_III); _enterPhase(_phase + 1); } },
        _qaSeal: () => { if (_active && _mode !== 'seal') { _phase = 2; _hp = 0; _beginSeal(); } },
        _qaSkipStagger: () => { _staggerUntil = _t; },
        _qaNext: ms => { _nextBoss = Date.now() + ms; },
    };
})();
window.AnomalyBoss = AnomalyBoss;


/* ── 3. THE MEMORY LEAK ─────────────────────────────────────────────────────

   Replaces the MemoryLeakBoss block in systems3.js (see README: Integration). Same global name and the surface the
   game uses: tick() (game.js, every 30 s it rolls), cancel() (the quit sweep and the run reset), isActive() (music.js).
   tryCommand(text) still accepts EXECUTE GARBAGE_COLLECTION, as a keyboard shortcut for the collector. It no longer
   needs #memory-leak-terminal from index.html: everything it shows, it makes.

   THE FIGHT. A broken RAM stick hangs at the top of the screen and drips allocated blocks onto it. Every block left
   standing fills your HEAP faster; at 100% it takes the simulation. Free a block by tapping it: the leak loses
   integrity and the heap drops.
     Everywhere  - THE COLLECTOR. Each block you free by hand charges the garbage collector. When it is full, its
                   button lights: press it (or G) and every block on screen is freed at once, with bonus damage.
     Phase I     - ALLOCATION. Plain blocks, a steady drip. It teaches the heap.
     Phase II    - POINTERS. Some blocks arrive as a numbered chain, linked by lines. Free them 1, 2, 3. Out of order
                   is a SEGFAULT: nothing is freed and the heap jumps. A whole chain in order deals bonus damage.
     Phase III   - FRAGMENTATION. The drip quickens, and big 64 KB blocks split into two 16 KB blocks when freed.
     Recall      - At zero integrity it does not die. Its blocks are compacted away and a 3 x 3 grid of memory cells
                   lights three of them in turn, each with its own tone. Tap them back in the same order. A wrong cell
                   (or running out of time) plays the sequence again; the third time, it reallocates: 15% back.
   Every boundary is a stagger, and freeing never climbs back over a line already crossed (as the Breach).

   THE PAY (unchanged in kind): 120-480 s of income (_birdPay) and 3 fragments; a clean fight (no segfault, no wrong
   cell, heap never past 80%) pays the bounty x1.5 and 5 fragments. Out of memory: instability +25, as before. */

const MemoryLeakBoss = (() => {
    'use strict';
    const K = () => window.BossKit;

    /* ── tuning ─────────────────────────────────────────────────────────── */
    const COL = '#ff7a1a', COL_II = '#ffc21a', COL_III = '#ff3b3b', COL_RECALL = '#5cf2ff', COL_WIN = '#44ff88';
    const CMD = 'EXECUTE GARBAGE_COLLECTION';
    const GAP_MS = 45 * 60000, ROLL = 0.01, CHECK_MS = 30000;                 // when it may come (unchanged)
    const HP_MIN = 100, HP_SPREAD = 16;
    const LINE_II = 0.65, LINE_III = 0.25;                  // phase III is the shortest stretch: the end should not be a wall
    const MAX_BLOCKS = 14;
    const SPAWN_S = [0.65, 0.6, 0.6];                      // a new allocation every ..., by phase
    const BURST_EVERY = 8, BURST = 2;                      // every eighth drip is a burst of two
    const HEAP_START = 8, HEAP_BASE = [1.3, 1.5, 1.5], HEAP_PER_BLOCK = 0.35, HEAP_FREE = 0.8, HEAP_WARN = 80;
    const CHAIN_EVERY = 3, CHAIN_LEN = 3, CHAIN_BONUS = 3, CHAIN_HEAP = 6, SEGFAULT_HEAP = 5;
    const BIG_EVERY = 5;                                   // phase III: one allocation in five is a 64 KB block that splits
    const PHASE_RELIEF = 15;                               // each phase line clears this much heap
    const GC_NEED = 16, GC_BONUS = 0, GC_HEAP = 20;        // frees to charge it; extra damage per block it frees; extra heap it clears
    const STAGGER_S = 1.1;
    const RECALL_LEN = 3, RECALL_STEP_S = 0.8, RECALL_WINDOW_S = 10, RECALL_TRIES = 3, RECALL_FAIL_HP = 0.15;
    const BOUNTY = [1e6, 0.20, 480], CLEAN_MULT = 1.5;

    /* ── state ──────────────────────────────────────────────────────────── */
    let _active = false, _ready = false, _mode = 'off';      // off | intro | fight | stagger | recall | dying
    let _hp = 0, _max = 0, _phase = 0, _heap = 0, _peak = 0, _t = 0, _gc = 0, _qaHold = false;
    let _spawnAt = 0, _spawned = 0, _staggerUntil = 0, _afterStagger = null, _warnAt = 0;
    let _raf = 0, _lastTs = 0, _lastCheck = 0, _nextAllowed = Date.now() + GAP_MS;
    let _leak = null, _links = null, _gcBtn = null, _recall = null, _hints = null, _stats = null, _chainId = 0;
    const _blocks = new Set();

    /* ── game hooks ─────────────────────────────────────────────────────── */
    const S = () => (typeof state !== 'undefined' ? state : {});
    const _running = () => (typeof isRunning !== 'undefined' ? !!isRunning : true);
    const _fmt = n => (typeof format === 'function' ? format(n) : String(Math.round(n)));
    const _pay = (a, b, c) => (typeof _birdPay === 'function' ? _birdPay(a, b, c) : window._qaBirdPay ? window._qaBirdPay(a, b, c) : a);
    const _income = () => Math.max(0, +S()._realEPS || +S().eps || 0);
    const _ticker = (t, c, ms) => { try { if (window.Ticker) Ticker.show(t, c, ms); else if (typeof showNotif === 'function') showNotif(t, c, ms); } catch (e) {} };
    const _calm = () => !!(K() && K().calm());
    const _fx = (name, fallback, arg) => {
        try { if (window.BossAudio && BossAudio.sfx(name, arg)) return; } catch (e) {}
        try { if (fallback === 'click') { if (window.Sounds && Sounds.click) Sounds.click(); } else if (fallback && window.GameSound) GameSound.play(fallback); } catch (e) {}
    };
    const _music = name => { try { if (window.BossAudio) name ? BossAudio.song(name) : BossAudio.stop(); } catch (e) {} };
    function _paused() {
        const b = document.body.classList;
        return !_running() || b.contains('panel-open') || b.contains('crash-freeze') || !!window._loreActive
            || !!(window.CognitiveDampener && CognitiveDampener.isActive && CognitiveDampener.isActive());
    }
    const _col = () => _phase === 2 ? COL_III : _phase === 1 ? COL_II : COL;
    const _line = share => Math.ceil(_max * share);
    const _floor = () => _phase === 0 ? _line(LINE_II) : _phase === 1 ? _line(LINE_III) : 0;

    /* ── art ────────────────────────────────────────────────────────────── */
    const CSS = `
.ml-leak{position:fixed;left:50%;top:var(--ml-top,120px);z-index:9480;width:min(300px,70vw);transform:translateX(-50%);pointer-events:none;color:var(--ml-col,${COL})}
.ml-leak svg{width:100%;height:auto;display:block;overflow:visible;filter:drop-shadow(0 0 12px color-mix(in srgb,currentColor 55%,transparent))}
.ml-board{fill:#0d1a10;stroke:currentColor;stroke-width:2}
.ml-ic{fill:#16111c;stroke:#3a3046;stroke-width:1}
.ml-gold{fill:#c9a23a}
.ml-crack{fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;animation:mlPulse 1.1s ease-in-out infinite alternate}
.ml-drip{fill:currentColor;animation:mlDrip 1.6s ease-in infinite}
.ml-leak.stagger svg{animation:mlStagger .28s steps(2) infinite}
.ml-leak.calm .ml-crack,.ml-leak.calm .ml-drip{animation:none}
.ml-leak.dead svg{animation:mlDie .9s ease-in forwards}

.ml-block{position:fixed;left:0;top:0;z-index:9500;margin:0;padding:0;border:0;background:none;cursor:crosshair;color:var(--ml-col,${COL});
  width:var(--w);height:calc(var(--w) * .64);touch-action:manipulation;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;
  transition:transform .3s cubic-bezier(.2,.9,.3,1.1),opacity .2s;outline:none}
.ml-block svg{width:100%;height:100%;overflow:visible;display:block;pointer-events:none;filter:drop-shadow(0 0 6px color-mix(in srgb,currentColor 50%,transparent))}
.ml-block:focus-visible{outline:2px solid #fff;outline-offset:3px}
.ml-chip{fill:#120b18;stroke:currentColor;stroke-width:2.5}
.ml-pin{fill:#c9a23a}
.ml-die{fill:color-mix(in srgb,currentColor 30%,#120b18);stroke:currentColor;stroke-width:1}
.ml-addr{fill:#fff;font:700 13px ui-monospace,'Courier New',monospace;letter-spacing:.5px}
.ml-kb{fill:currentColor;font:700 12px ui-monospace,'Courier New',monospace}
.ml-pip{fill:#fff;stroke:currentColor;stroke-width:2}
.ml-pipn{fill:#120b18;font:900 15px ui-monospace,'Courier New',monospace;text-anchor:middle}
.ml-block.freed{opacity:0;pointer-events:none}
.ml-block.freed svg{transform:scale(1.4);transition:transform .25s}
.ml-block.bad svg{animation:mlBad .3s steps(3)}
.ml-block.calm{transition:none}
.ml-links{position:fixed;inset:0;z-index:9490;pointer-events:none;width:100vw;height:100vh;overflow:visible}
.ml-links line{stroke:${COL_II};stroke-width:3;stroke-dasharray:8 6;opacity:.8}

.ml-gc{position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom,0px));z-index:9560;width:84px;height:84px;margin-left:-42px;padding:0;
  border:0;border-radius:50%;background:none;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;color:#fff;outline:none}
.ml-gc svg{width:100%;height:100%;overflow:visible;pointer-events:none}
.ml-gc-bg{fill:rgba(10,4,14,.9);stroke:rgba(255,255,255,.25);stroke-width:2}
.ml-gc-ring{fill:none;stroke:${COL_WIN};stroke-width:6;stroke-linecap:round;transform:rotate(-90deg);transform-origin:center;transition:stroke-dashoffset .2s}
.ml-gc-txt{fill:rgba(255,255,255,.45);font:900 20px ui-monospace,'Courier New',monospace;text-anchor:middle;letter-spacing:2px}
.ml-gc-sub{fill:rgba(255,255,255,.4);font:700 8px ui-monospace,'Courier New',monospace;text-anchor:middle;letter-spacing:1.5px}
.ml-gc.ready .ml-gc-bg{fill:color-mix(in srgb,${COL_WIN} 25%,#0a040e);stroke:${COL_WIN}}
.ml-gc.ready .ml-gc-txt,.ml-gc.ready .ml-gc-sub{fill:#fff}
.ml-gc.ready{animation:mlReady .8s ease-in-out infinite alternate}
.ml-gc.calm.ready{animation:none}
.ml-gc:focus-visible{outline:2px solid #fff;outline-offset:3px}

.ml-recall{position:fixed;left:50%;top:50%;z-index:9580;display:grid;grid-template-columns:repeat(3,var(--c));gap:10px;
  --c:min(88px,24vw);transform:translate(-50%,-45%)}
.ml-cell{width:var(--c);height:var(--c);padding:0;border:2px solid color-mix(in srgb,${COL_RECALL} 45%,transparent);background:rgba(6,14,18,.92);
  cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:background .08s,box-shadow .08s;outline:none}
.ml-cell svg{width:100%;height:100%;pointer-events:none}
.ml-cell rect{fill:none;stroke:color-mix(in srgb,${COL_RECALL} 35%,transparent);stroke-width:2}
.ml-cell.lit{background:${COL_RECALL};box-shadow:0 0 28px ${COL_RECALL}}
.ml-cell.good{background:${COL_WIN};box-shadow:0 0 24px ${COL_WIN}}
.ml-cell.wrong{background:${COL_III};box-shadow:0 0 24px ${COL_III}}
.ml-recall.watch .ml-cell{cursor:default}
.ml-cell:focus-visible{outline:2px solid #fff;outline-offset:2px}

@keyframes mlPulse{from{opacity:.5}to{opacity:1}}
@keyframes mlDrip{0%{transform:translateY(0);opacity:1}100%{transform:translateY(22px);opacity:0}}
@keyframes mlStagger{0%{filter:brightness(3) saturate(0)}100%{filter:none}}
@keyframes mlDie{30%{transform:scale(1.08);filter:brightness(3)}100%{transform:scale(.2,0);opacity:0}}
@keyframes mlBad{0%,100%{transform:none}33%{transform:translateX(-5px)}66%{transform:translateX(5px)}}
@keyframes mlReady{from{transform:scale(1)}to{transform:scale(1.08)}}
`;
    function _css() {
        if (document.getElementById('ml-css')) return;
        const s = document.createElement('style'); s.id = 'ml-css'; s.textContent = CSS;
        document.head.appendChild(s);
    }

    const LEAK_ART = (() => {
        let ics = '', pins = '';
        for (let i = 0; i < 6; i++) ics += '<rect class="ml-ic" x="' + (18 + i * 36) + '" y="14" width="28" height="30" rx="2"/>';
        for (let i = 0; i < 28; i++) if (i !== 13) pins += '<rect class="ml-gold" x="' + (12 + i * 8) + '" y="58" width="5" height="12"/>';
        let drips = '';
        [[96, 0], [140, 0.5], [118, 1.0]].forEach(([x, d]) => { drips += '<ellipse class="ml-drip" cx="' + x + '" cy="76" rx="3" ry="5" style="animation-delay:' + d + 's"/>'; });
        return '<svg viewBox="0 0 240 100" aria-hidden="true"><rect class="ml-board" x="4" y="4" width="232" height="66" rx="4"/>' + ics + pins
            + '<path class="ml-crack" d="M104,4 L112,22 L100,34 L118,48 L110,70 M112,22 L130,28 L124,40"/>' + drips + '</svg>';
    })();

    function _blockArt(kb, addr, idx) {
        let pins = '';
        for (let i = 0; i < 8; i++) pins += '<rect class="ml-pin" x="' + (12 + i * 10.5) + '" y="1" width="5" height="7"/><rect class="ml-pin" x="' + (12 + i * 10.5) + '" y="56" width="5" height="7"/>';
        return '<svg viewBox="0 0 100 64" aria-hidden="true">' + pins
            + '<rect class="ml-chip" x="4" y="7" width="92" height="50" rx="4"/><rect class="ml-die" x="12" y="15" width="22" height="34" rx="2"/>'
            + '<text class="ml-addr" x="40" y="30">' + addr + '</text><text class="ml-kb" x="40" y="47">' + kb + ' KB</text>'
            + (idx ? '<circle class="ml-pip" cx="88" cy="9" r="11"/><text class="ml-pipn" x="88" y="14">' + idx + '</text>' : '')
            + '</svg>';
    }
    const GC_ART = '<svg viewBox="0 0 84 84" aria-hidden="true"><circle class="ml-gc-bg" cx="42" cy="42" r="38"/>'
        + '<circle class="ml-gc-ring" cx="42" cy="42" r="38"/><text class="ml-gc-txt" x="42" y="47">GC</text><text class="ml-gc-sub" x="42" y="62">COLLECT</text></svg>';

    /* ── the leak and its blocks ────────────────────────────────────────── */
    function _leakAt() {
        const r = _leak ? _leak.getBoundingClientRect() : { left: innerWidth / 2 - 120, width: 240, top: 76, height: 100 };
        return { x: r.left + r.width / 2, y: r.top + r.height * 0.75 };
    }
    function _area() {
        const W = innerWidth, H = innerHeight, top = (_leak ? _leak.getBoundingClientRect().bottom : 170) + 52;   // room for a hint
        return { x0: 16, x1: Math.max(17, W - 16), y0: top, y1: Math.max(top + 1, H - 200) };
    }
    function _spot(w, h, near) {
        const a = _area(); let best = null, bestD = -1;
        for (let i = 0; i < 30; i++) {
            let x, y;
            if (near) { x = near.x + (Math.random() - 0.5) * 260; y = near.y + (Math.random() - 0.5) * 200; }
            else { x = a.x0 + w / 2 + Math.random() * Math.max(1, a.x1 - a.x0 - w); y = a.y0 + h / 2 + Math.random() * Math.max(1, a.y1 - a.y0 - h); }
            x = Math.max(a.x0 + w / 2, Math.min(a.x1 - w / 2, x)); y = Math.max(a.y0 + h / 2, Math.min(a.y1 - h / 2, y));
            let d = 1e9; _blocks.forEach(b => { if (!b.freed) d = Math.min(d, Math.hypot(b.x - x, b.y - y) - (b.w + w) * 0.45); });
            if (d > 6) return { x, y };
            if (d > bestD) { bestD = d; best = { x, y }; }
        }
        return best;
    }
    const _width = kb => (kb >= 64 ? 128 : kb >= 32 ? 108 : 94) * (innerWidth < 520 ? 0.82 : 1);

    function _alloc(kb, at, chain, from) {
        if (_blocks.size >= MAX_BLOCKS + (chain ? CHAIN_LEN : 0)) return null;
        const w = _width(kb), h = w * 0.64;
        const p = at || _spot(w, h);
        if (!p) return null;
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'ml-block' + (_calm() ? ' calm' : '');
        const addr = '0x' + Math.floor(0x1000 + Math.random() * 0xEFFF).toString(16).toUpperCase();
        el.innerHTML = _blockArt(kb, addr, chain ? chain.idx : 0);
        el.style.setProperty('--w', Math.round(w) + 'px');
        el.style.setProperty('--ml-col', chain ? COL_II : _col());
        el.setAttribute('aria-label', 'Leaked block ' + addr + ', ' + kb + ' kilobytes' + (chain ? ', link ' + chain.idx + ' of ' + CHAIN_LEN : '') + '. Press to free it.');
        const b = { el, kb, x: p.x, y: p.y, w, h, chain: chain || null, freed: false };
        const src = from || _leakAt();
        el.style.transform = 'translate(' + Math.round(src.x - w / 2) + 'px,' + Math.round(src.y - h / 2) + 'px) scale(.3)';
        el.addEventListener('pointerdown', e => { if (e.button > 0) return; e.preventDefault(); e.stopPropagation(); _free(b, 'hand'); });
        el.addEventListener('click', e => { e.stopPropagation(); if (e.detail === 0) _free(b, 'hand'); });   // detail 0: the keyboard
        document.body.appendChild(el);
        void el.offsetWidth;
        el.style.transform = 'translate(' + Math.round(p.x - w / 2) + 'px,' + Math.round(p.y - h / 2) + 'px)';
        _blocks.add(b);
        return b;
    }

    function _drip() {
        _spawned++;
        if (_phase >= 1 && _spawned % CHAIN_EVERY === 0 && !_chainUp()) { _chainOf(); _fx('alloc'); return; }
        const big = _phase === 2 && _spawned % BIG_EVERY === 0;
        const n = _spawned % BURST_EVERY === 0 ? BURST : 1;
        let any = false;
        for (let i = 0; i < n; i++) if (_alloc(big && !i ? 64 : [16, 32][Math.random() < 0.6 ? 0 : 1])) any = true;
        if (any) _fx('alloc');
    }
    const _chainUp = () => { for (const b of _blocks) if (b.chain && !b.freed) return true; return false; };
    function _chainOf() {
        const id = ++_chainId, w = _width(32), h = w * 0.64, first = _spot(w, h);
        if (!first) return;
        let prev = first;
        for (let i = 1; i <= CHAIN_LEN; i++) {
            const p = i === 1 ? first : (_spot(w, h, prev) || _spot(w, h));
            const b = _alloc(32, p, { id, idx: i });
            if (b) prev = p;
        }
        _drawLinks();
        _hintAt('chain', 'FREE A CHAIN IN ORDER: 1, 2, 3', 'target', 3000, first.x, first.y + 60);
    }
    function _drawLinks() {
        if (!_links) return;
        const chain = [..._blocks].filter(b => b.chain && !b.freed).sort((a, b) => a.chain.idx - b.chain.idx);
        let s = '';
        for (let i = 1; i < chain.length; i++) s += '<line x1="' + chain[i - 1].x + '" y1="' + chain[i - 1].y + '" x2="' + chain[i].x + '" y2="' + chain[i].y + '"/>';
        _links.innerHTML = s;
    }

    /* ── freeing ────────────────────────────────────────────────────────── */
    function _free(b, how) {
        if (!_active || !_ready || b.freed) return false;
        if (_mode === 'stagger') { if (how === 'hand') { K().pop(b.x, b.y, 'LOCKED', 'info', '#ffffff'); _fx('immune'); } return false; }
        if (_mode !== 'fight') return false;
        if (b.chain && how === 'hand') {                 // a pointer chain: in order, or it faults
            const next = Math.min(...[..._blocks].filter(x => x.chain && x.chain.id === b.chain.id && !x.freed).map(x => x.chain.idx));
            if (b.chain.idx !== next) {
                _stats.segfaults++;
                _heap = Math.min(100, _heap + SEGFAULT_HEAP);
                b.el.classList.remove('bad'); void b.el.offsetWidth; b.el.classList.add('bad');
                K().pop(b.x, b.y - 20, 'SEGFAULT  HEAP +' + SEGFAULT_HEAP + '%', 'reflect');
                K().flash(COL_III, 0.22); K().shake(4);
                _fx('segfault');
                _hintAt('segfault', 'OUT OF ORDER. FREE ' + next + ' FIRST.', 'warning', 2600, b.x, b.y + 50);
                return false;
            }
        }
        b.freed = true; _blocks.delete(b);
        b.el.classList.add('freed'); setTimeout(() => b.el.remove(), 280);
        _heap = Math.max(0, _heap - HEAP_FREE);
        if (how === 'hand') {
            _stats.hand++;
            _gc = Math.min(GC_NEED, _gc + 1);
            if (_gc === GC_NEED) { _fx('gcReady'); _hintAt('gc', 'THE COLLECTOR IS READY. PRESS GC.', 'energy', 3000, innerWidth / 2, innerHeight - 230); }
        }
        _fx('free', 'click', b.kb);
        K().pop(b.x, b.y - 10, how === 'gc' ? 'COLLECTED' : 'FREED', how === 'gc' ? 'info' : 'hit', _col());
        let dmg = 1 + (how === 'gc' ? GC_BONUS : 0);
        if (b.kb >= 64) _split(b);                       // fragmentation: a big block leaves two small ones
        if (b.chain) {
            const left = [..._blocks].some(x => x.chain && x.chain.id === b.chain.id && !x.freed);
            if (!left) {
                _stats.chains++;
                dmg += CHAIN_BONUS; _heap = Math.max(0, _heap - CHAIN_HEAP);
                K().pop(b.x, b.y - 46, 'CHAIN FREED  -' + (1 + CHAIN_BONUS), 'crit', COL_II);
                _fx('chainDone');
            }
            _drawLinks();
        }
        _damage(dmg);
        return true;
    }
    function _split(b) {
        _hintAt('split', 'BIG BLOCKS FRAGMENT. FREE THE PIECES TOO.', 'warning', 2600, b.x, b.y + 60);
        for (let i = 0; i < 2; i++) {
            const w = _width(16), h = w * 0.64;
            const p = _spot(w, h, { x: b.x + (i ? 70 : -70), y: b.y }) || _spot(w, h);
            _alloc(16, p, null, { x: b.x, y: b.y });
        }
    }

    function _damage(n) {
        _hp = Math.max(_floor(), _hp - n);
        if (_hp <= _floor()) { if (_phase < 2) _enterPhase(_phase + 1); else _beginRecall(); }
    }

    function collect() {
        if (!_active || _mode !== 'fight' || _gc < GC_NEED) return false;
        _gc = 0; _stats.gcs++;
        _fx('gc');
        K().flash(COL_WIN, 0.3); K().shake(5);
        const all = [..._blocks];
        _heap = Math.max(0, _heap - GC_HEAP);
        for (const b of all) { if (_mode !== 'fight') break; _free(b, 'gc'); }
        K().pop(innerWidth / 2, innerHeight - 200, 'GARBAGE COLLECTED  ' + all.length + ' BLOCKS', 'crit', COL_WIN);
        _refresh();
        return true;
    }
    function tryCommand(val) { return String(val || '').trim().toUpperCase() === CMD ? collect() : false; }

    /* ── lifecycle ──────────────────────────────────────────────────────── */
    function tick() {
        if (!_running()) return;
        const now = Date.now();
        if (now - _lastCheck < CHECK_MS) return;
        _lastCheck = now;
        if (_active || now < _nextAllowed) return;
        if (window.GlobalEventQueue && GlobalEventQueue.isActive()) return;   // never on top of another crisis
        if (((S().prestige && S().prestige.count) || 0) >= 2 && (S().instability || 0) > 75 && Math.random() < ROLL) _trigger();
    }

    function _trigger() {
        if (_active) return false;
        if (window.GlobalEventQueue && !GlobalEventQueue.hold('memoryLeak')) return false;
        _css();
        _active = true; _ready = false; _mode = 'intro';
        _max = HP_MIN + Math.floor(Math.random() * HP_SPREAD); _hp = _max;
        _phase = 0; _heap = HEAP_START; _peak = _heap; _t = 0; _gc = 0; _spawned = 0;
        _stats = { hand: 0, gcs: 0, chains: 0, segfaults: 0, wrong: 0, at: [] };
        _hints = {};
        _ticker('MEMORY LEAK: it is allocating blocks. Free them before the heap fills.', COL, 8000);
        _fx('siren', 'stinger:eventStart');
        K().intro({ name: 'MEMORY LEAK', sub: 'ALLOCATED. NEVER FREED.', col: COL }).then(() => { if (_active) _appear(); });
        return true;
    }

    function _appear() {
        _leak = document.createElement('div');
        _leak.className = 'ml-leak' + (_calm() ? ' calm' : '');
        _leak.innerHTML = LEAK_ART;
        _leak.setAttribute('aria-hidden', 'true');
        document.body.appendChild(_leak);
        _links = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        _links.setAttribute('class', 'ml-links'); _links.setAttribute('aria-hidden', 'true');
        document.body.appendChild(_links);
        _gcBtn = document.createElement('button');
        _gcBtn.type = 'button';
        _gcBtn.className = 'ml-gc' + (_calm() ? ' calm' : '');
        _gcBtn.innerHTML = GC_ART;
        _gcBtn.setAttribute('aria-label', 'Garbage collector. Frees every block on screen when charged.');
        _gcBtn.addEventListener('pointerdown', e => { if (e.button > 0) return; e.preventDefault(); e.stopPropagation(); collect(); });
        _gcBtn.addEventListener('click', e => { e.stopPropagation(); if (e.detail === 0) collect(); });
        document.body.appendChild(_gcBtn);
        K().bar({ name: 'MEMORY LEAK', col: COL, marks: [LINE_II, LINE_III] });
        K().phase('PHASE I  ALLOCATION');
        _mode = 'fight'; _ready = true;
        _spawnAt = 0.4;
        document.addEventListener('keydown', _onKey, true);
        _lastTs = performance.now();
        _refresh();
        _hintAt('free', 'TAP BLOCKS TO FREE THEM BEFORE THE HEAP FILLS', 'target', 3400, innerWidth / 2, (_leak.getBoundingClientRect().bottom || 170) + 16);
        _music('alloc');
        _raf = requestAnimationFrame(_frame);
    }

    function _onKey(e) {
        if (!_active) return;
        if ((e.key === 'g' || e.key === 'G') && _mode === 'fight' && !(e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) { e.preventDefault(); collect(); }
        if (_mode === 'recall' && /^[1-9]$/.test(e.key)) { e.preventDefault(); _cellPress(+e.key - 1); }
    }

    function _frame(now) {
        if (!_active) return;
        _raf = requestAnimationFrame(_frame);
        const dt = Math.min(0.1, (now - _lastTs) / 1000);
        _lastTs = now;
        const paused = _paused();
        try { if (window.BossAudio) BossAudio.duck(paused); } catch (e) {}
        if (!_ready || paused) return;
        _t += dt;
        if (_mode === 'stagger' && _t >= _staggerUntil) {
            if (_leak) _leak.classList.remove('stagger');
            _mode = 'fight';
            const f = _afterStagger; _afterStagger = null; if (f) f();
        }
        if (_mode === 'fight') {
            if (_t >= _spawnAt) { _drip(); _spawnAt = _t + SPAWN_S[_phase] * (0.85 + Math.random() * 0.3); }
            if (!_qaHold) _heap += (HEAP_BASE[_phase] + HEAP_PER_BLOCK * _blocks.size) * dt;
            _peak = Math.max(_peak, _heap);
            if (_heap >= HEAP_WARN && _t >= _warnAt) { _fx('heapWarn'); _warnAt = _t + 1.4; }
            if (_heap >= 100) { _heap = 100; _refresh(); _fail(); return; }
        }
        if (_mode === 'recall') _stepRecall();
        _refresh();
    }

    function _refresh() {
        if (!_active || !K()) return;
        K().hp(_hp / Math.max(1, _max));
        const bar = document.getElementById('boss-bar');   // the leak hangs just under the bar, however tall the bar is
        if (_leak && bar) { const top = Math.round(bar.getBoundingClientRect().bottom + 10) + 'px'; if (_leak.style.getPropertyValue('--ml-top') !== top) _leak.style.setProperty('--ml-top', top); }
        if (_mode === 'recall' && _recall) {
            K().right(_recall.watching ? 'WATCH' : 'RECALL ' + _recall.got + '/' + RECALL_LEN + '  ' + Math.max(0, _recall.until - _t).toFixed(1) + 'S', !_recall.watching);
        } else {
            K().right('HEAP ' + Math.min(100, Math.floor(_heap)) + '%', _heap >= HEAP_WARN);
        }
        if (K().gauge) K().gauge('HEAP', _heap / 100, _heap >= HEAP_WARN ? COL_III : _heap >= 55 ? COL_II : COL_WIN, _heap >= HEAP_WARN);
        K().sub(_mode === 'recall' ? 'IT IS COMPACTING. REPEAT THE CELLS IN ORDER.'
            : _blocks.size + ' BLOCK' + (_blocks.size === 1 ? '' : 'S') + ' ALLOCATED   AT 100% HEAP IT TAKES THE SIMULATION');
        if (_gcBtn) {
            const ring = _gcBtn.querySelector('.ml-gc-ring'), c = 2 * Math.PI * 38;
            ring.style.strokeDasharray = c.toFixed(1);
            ring.style.strokeDashoffset = (c * (1 - _gc / GC_NEED)).toFixed(1);
            _gcBtn.classList.toggle('ready', _gc >= GC_NEED && _mode === 'fight');
            _gcBtn.hidden = _mode === 'recall';
        }
    }

    /* hints show in one place, just under the leak, so they never sit on a block; the collector's sits over its button */
    function _hintAt(key, text, ic, ms, x, y) {
        if (_hints[key]) return;
        _hints[key] = true;
        const under = _leak ? _leak.getBoundingClientRect().bottom + 8 : 180;
        K().hint(text, key === 'gc' ? x : innerWidth / 2, key === 'gc' ? y : under, ms || 2600, _col(), ic);
    }

    /* ── phases ─────────────────────────────────────────────────────────── */
    function _stagger(then) {
        _mode = 'stagger'; _staggerUntil = _t + STAGGER_S; _afterStagger = then;
        if (_leak) _leak.classList.add('stagger');
    }
    function _enterPhase(p) {
        _phase = p;
        _stats.at[p] = Math.round(_t);
        _heap = Math.max(0, _heap - PHASE_RELIEF);           // a phase won clears some of the heap
        const col = _col();
        if (_leak) _leak.style.setProperty('--ml-col', col);
        _blocks.forEach(b => { if (!b.chain) b.el.style.setProperty('--ml-col', col); });
        K().colour(col);
        K().phase(p === 1 ? 'PHASE II  POINTERS' : 'PHASE III  FRAGMENTATION');
        K().flash(col, 0.4); K().shake(7);
        _fx('phase', 'stinger:eventStart');
        _music(p === 1 ? 'pointers' : 'frag');
        _ticker(p === 1 ? 'The leak links its blocks. Free a chain in order.' : 'The leak is fragmenting. Big blocks split.', col, 4000);
        _stagger(() => { _spawnAt = _t + 0.3; });
    }

    /* ── the recall ─────────────────────────────────────────────────────── */
    function _beginRecall() {
        _mode = 'recall';
        if (_stats.at[3] == null) _stats.at[3] = Math.round(_t);
        const c = _leakAt();
        _blocks.forEach(b => {                           // compaction: every block is pulled into the leak
            b.freed = true; b.el.style.transform = 'translate(' + Math.round(c.x - b.w / 2) + 'px,' + Math.round(c.y - b.h / 2) + 'px) scale(.2)';
            b.el.classList.add('freed'); setTimeout(() => b.el.remove(), 320);
        });
        _blocks.clear(); _drawLinks();
        if (_leak) _leak.style.setProperty('--ml-col', COL_RECALL);
        K().colour(COL_RECALL); K().phase('RECALL');
        K().flash('#ffffff', 0.5); K().shake(8);
        _fx('phase', 'stinger:eventStart');
        _music('recall');
        const el = document.createElement('div');
        el.className = 'ml-recall watch';
        el.setAttribute('role', 'group');
        el.setAttribute('aria-label', 'Memory cells. Watch four light up, then press them in the same order, or type their numbers 1 to 9.');
        const cells = [];
        for (let i = 0; i < 9; i++) {
            const c = document.createElement('button');
            c.type = 'button'; c.className = 'ml-cell';
            c.setAttribute('aria-label', 'Cell ' + (i + 1));
            c.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="8" y="8" width="24" height="24" rx="2"/></svg>';
            c.addEventListener('pointerdown', e => { if (e.button > 0) return; e.preventDefault(); e.stopPropagation(); _cellPress(i); });
            c.addEventListener('click', e => { e.stopPropagation(); if (e.detail === 0) _cellPress(i); });
            el.appendChild(c); cells.push(c);
        }
        document.body.appendChild(el);
        const seq = [];
        while (seq.length < RECALL_LEN) { const n = Math.floor(Math.random() * 9); if (!seq.includes(n)) seq.push(n); }
        const step = RECALL_STEP_S * (_calm() ? 1.3 : 1);
        _recall = { el, cells, seq, got: 0, watching: true, showAt: _t + 0.9, step, shown: -1, until: Infinity, tries: RECALL_TRIES };
        _ticker('The leak is compacting. Remember the cells.', COL_RECALL, 4000);
        K().hint('WATCH THE CELLS, THEN TAP THEM IN THE SAME ORDER', innerWidth / 2, innerHeight / 2 + 190, 3400, COL_RECALL, 'eye');
    }

    function _stepRecall() {
        const r = _recall; if (!r) return;
        if (r.watching) {
            const k = Math.floor((_t - r.showAt) / r.step);
            if (k >= 0 && k !== r.shown) {
                r.cells.forEach(c => c.classList.remove('lit'));
                if (k < r.seq.length) { r.cells[r.seq[k]].classList.add('lit'); _fx('cell', null, r.seq[k]); }
                r.shown = k;
            }
            if (k >= r.seq.length) {
                r.cells.forEach(c => c.classList.remove('lit'));
                r.watching = false; r.el.classList.remove('watch');
                r.until = _t + RECALL_WINDOW_S;
                try { r.cells[0].focus({ preventScroll: true }); } catch (e) {}
            }
            return;
        }
        if (_t >= r.until) {
            if (--r.tries > 0) { r.got = 0; r.watching = true; r.shown = -1; r.showAt = _t + 0.6; r.until = Infinity; r.el.classList.add('watch');
                                 K().pop(innerWidth / 2, innerHeight / 2 - 190, 'TOO SLOW  WATCH AGAIN  (' + r.tries + ' LEFT)', 'reflect'); }
            else _recallFail('TOO SLOW');
        }
    }

    function _cellPress(i) {
        const r = _recall;
        if (!r || r.watching || _mode !== 'recall' || _paused()) return;
        const c = r.cells[i];
        if (r.seq[r.got] === i) {
            r.got++;
            c.classList.remove('good'); void c.offsetWidth; c.classList.add('good');
            setTimeout(() => c.classList.remove('good'), 220);
            _fx('cell', null, i);
            if (r.got >= RECALL_LEN) { _fx('lock', null, 2); _win(); }
        } else if (--r.tries > 0) {          // another look: the sequence plays again
            r.got = 0; r.watching = true; r.shown = -1; r.showAt = _t + 0.9; r.until = Infinity;
            r.el.classList.add('watch');
            c.classList.add('wrong'); setTimeout(() => c.classList.remove('wrong'), 400);
            _stats.wrong++;
            _fx('segfault');
            K().pop(innerWidth / 2, innerHeight / 2 - 190, 'WRONG CELL  WATCH AGAIN  (' + r.tries + ' LEFT)', 'reflect');
        } else {
            c.classList.add('wrong');
            _recallFail('WRONG CELL');
        }
    }

    function _recallFail(why) {
        const r = _recall; if (!r) return;
        _stats.wrong++;
        _recall = null;
        setTimeout(() => r.el.remove(), 300);
        _hp = Math.max(1, Math.round(_max * RECALL_FAIL_HP));
        if (_leak) _leak.style.setProperty('--ml-col', COL_III);
        K().colour(COL_III); K().phase('PHASE III  FRAGMENTATION'); K().heal();
        K().pop(innerWidth / 2, innerHeight / 2, why + '  IT REALLOCATED', 'reflect');
        K().flash(COL_III, 0.45); K().shake(8);
        _fx('sealMiss', 'stinger:eventFail');
        _music('frag');
        _mode = 'fight';
        _stagger(() => { _spawnAt = _t + 0.2; });
    }

    /* ── endings ────────────────────────────────────────────────────────── */
    function _stop() {
        _active = false; _ready = false; _mode = 'off';
        cancelAnimationFrame(_raf); _raf = 0;
        document.removeEventListener('keydown', _onKey, true);
        _blocks.forEach(b => b.el.remove()); _blocks.clear();
        [_links, _gcBtn].forEach(e => e && e.remove()); _links = _gcBtn = null;
        if (_recall) { _recall.el.remove(); _recall = null; }
        if (window.GlobalEventQueue) GlobalEventQueue.unhold('memoryLeak');
        _nextAllowed = Date.now() + GAP_MS;
        _music(null);
        try { if (window.BossAudio) BossAudio.duck(false); } catch (e) {}
    }
    function _dropLeak(cls) { const l = _leak; _leak = null; if (l) { l.classList.add(cls); setTimeout(() => l.remove(), 950); } }

    function _grade(clean) {
        const miss = _stats.segfaults + _stats.wrong * 3 + (_peak >= HEAP_WARN ? 2 : 0);
        if (clean) return _peak < 55 ? 'S' : 'A';
        return miss <= 3 ? 'A' : miss <= 7 ? 'B' : 'C';
    }

    function _win() {
        if (!_active) return;
        const st = S(), eps = _income();
        const clean = _stats.segfaults === 0 && _stats.wrong === 0 && _peak < HEAP_WARN;
        const reward = _pay(BOUNTY[0], BOUNTY[1], BOUNTY[2]) * (clean ? CLEAN_MULT : 1);
        const frags = clean ? 5 : 3, stats = _stats, secs = _t, grade = _grade(clean), peak = _peak;
        st.energy = (st.energy || 0) + reward;
        st.fragments = (st.fragments || 0) + frags;
        _stop();
        _dropLeak('dead');
        K().flash('#ffffff', 0.6); K().shake(10);
        K().end();
        _fx('win', 'stinger:eventWin');
        const mins = eps > 0 ? reward / eps / 60 : 0;
        setTimeout(() => K().result({ title: 'HEAP RECLAIMED', col: COL_WIN, grade, rows: [
            ['energy', 'Bounty' + (clean ? ' (clean x1.5)' : ''), '+' + _fmt(reward) + ' E' + (mins > 0 ? ' (' + (mins >= 10 ? Math.round(mins) : mins.toFixed(1)) + ' MIN)' : '')],
            ['fragment', 'Fragments', '+' + frags],
            ['clock', 'Reclaimed in', Math.round(secs) + 'S'],
            ['instability', 'Peak heap', Math.round(peak) + '%'],
            ['target', 'Freed by hand / collections', stats.hand + ' / ' + stats.gcs],
            ['shield', 'Mistakes', String(stats.segfaults + stats.wrong)],
        ] }), _calm() ? 0 : 700);
        _ticker('HEAP RECLAIMED: +' + _fmt(reward) + ' E, +' + frags + ' fragments', COL_WIN, 6000);
        st._bossesDefeated = (st._bossesDefeated || 0) + 1;
        try { if (typeof updateFragmentsUI === 'function') updateFragmentsUI(); if (typeof Game !== 'undefined' && Game.update) Game.update(); } catch (e) {}
        try { if (typeof Achieve !== 'undefined') Achieve.checkAll(); } catch (e) {}
    }

    function _fail() {
        if (!_active) return;
        _stop();
        _dropLeak('dead');
        K().end();
        _fx('fail', 'stinger:eventFail');
        try { if (typeof Instability !== 'undefined' && Instability.add) Instability.add(25); else S().instability = Math.min(100, (S().instability || 0) + 25); } catch (e) {}
        K().result({ title: 'OUT OF MEMORY', col: COL, rows: [['instability', 'Contained by force', 'Instability +25%']] });
        _ticker('MEMORY LEAK contained by force. Instability +25%', COL_III, 5000);
    }

    /* a quit: no reward, no penalty, nothing left on screen */
    function cancel() {
        if (_active || _blocks.size || _leak) { _stop(); if (_leak) { _leak.remove(); _leak = null; } K().clear(); }
        document.querySelectorAll('.ml-block,.ml-leak,.ml-links,.ml-gc,.ml-recall').forEach(e => e.remove());
    }

    return { tick, tryCommand, collect, cancel, isActive: () => _active,
        /* QA: read-only state, and levers for the viewer and the tests */
        _qaTrigger: () => { _nextAllowed = 0; return _trigger(); },
        _qa: () => ({ active: _active, ready: _ready, mode: _mode, hp: _hp, max: _max, phase: _phase, heap: _heap, peak: _peak, gc: _gc,
                      blocks: [..._blocks].map(b => ({ x: b.x, y: b.y, kb: b.kb, chain: b.chain ? b.chain.idx : 0, id: b.chain ? b.chain.id : 0 })),
                      recall: _recall ? { seq: _recall.seq.slice(), got: _recall.got, watching: _recall.watching } : null,
                      stats: _stats ? Object.assign({}, _stats, { at: _stats.at.slice() }) : null, next: _nextAllowed - Date.now(),
                      GC_NEED, BOUNTY: BOUNTY.slice(), GAP_MS, ROLL }),
        _qaPhase: p => { while (_active && _phase < p && _mode !== 'recall') { _hp = _floor(); _enterPhase(_phase + 1); } },
        _qaRecall: () => { if (_active && _mode !== 'recall') { _phase = 2; _hp = 0; _beginRecall(); } },
        _qaSkipStagger: () => { _staggerUntil = _t; },
        _qaSetHeap: v => { _heap = v; },
        _qaSetHp: v => { _hp = Math.max(1, Math.min(_max, v)); },
        _qaCharge: () => { _gc = GC_NEED; },
        _qaHoldHeap: on => { _qaHold = !!on; },
    };
})();
window.MemoryLeakBoss = MemoryLeakBoss;
