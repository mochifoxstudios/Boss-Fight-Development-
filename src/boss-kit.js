/* ═══════════════════════════════════════════════════════════════════════════
   boss-kit.js — THE STAGE THE REBUILT BOSSES SHARE

   Self-styled (it injects its own sheet, prefixed bk-), so it renders the same in the game and in the sandbox and
   never depends on game.css. Everything it draws is HTML text or generated SVG: no emoji, no glyph characters.

     BossKit.intro({ name, sub, col })          warning card + vignette; resolves when the boss should appear
     BossKit.bar({ name, col, marks })          the boss bar: name, phase, timer, integrity with a damage trail
     BossKit.hp(f) / phase(t) / right(t) / sub(t) / colour(c) / heal()
     BossKit.pop(x, y, text, kind)              kind: hit | crit | reflect | heal | info
     BossKit.hint(text, x, y, ms)               a teaching callout, shown where the player is looking
     BossKit.flash(col, a) / shake(px)
     BossKit.result({ title, col, rows: [[icon, label, value]], grade, foot })
     BossKit.icon(name)                         energy | fragment | clock | shield | eye | warning | mult | instability | target
     BossKit.end() / clear() / calm()

   Every motion is transform or opacity. Under safe mode, accessibility mode and the OS reduced-motion setting nothing
   shakes, slides or pops (calm()).
   ═══════════════════════════════════════════════════════════════════════════ */

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

    return { intro, bar, hp, heal, phase, right, sub, colour, pop, hint, flash, shake, result, end, clear, calm, icon };
})();
window.BossKit = BossKit;
