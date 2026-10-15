/* ═══════════════════════════════════════════════════════════════════════════
   reality-breach.js — THE REALITY BREACH, REBUILT

   Replaces the AnomalyBoss block in game.js (see README: Integration). Same global name and public surface, so the
   music director (music.js: AnomalyBoss._active), the Auto-Breach Firewall (hit(n, 'firewall') and _autoHitAccum),
   the run reset, the quit sweep and the save hoard (state._breachHoard) all keep working untouched.

   THE FIGHT. A target you can spam is not a boss. This one has to be read.
     Everywhere  - THE SHELL. Six plates open and close on a rhythm. They flicker white just before they shut.
                   A hit on a shut shell is REFLECTED: it heals the breach and it steals from you.
                 - THE CORE. A hit inside the inner ring is CRITICAL (double damage). The rest of the body is a graze.
                 - IT EATS. It takes 10 / 20 / 30% of your income while it is up, and holds it.
     Phase I     - It sits still and teaches the shell.
     Phase II    - IT SPLITS. Three echoes. Only the real breach watches your cursor; the echoes stare at nothing and
                   their shards orbit the other way. Strike an echo and the real one heals. They shuffle every 4 s,
                   and each landing spot is marked a moment before.
     Phase III   - ENRAGED. It blinks around the screen (each jump is marked first) and fires tears at your energy
                   counter. A tear that lands steals 6 s of income into its hoard and heals it. Shoot them down.
     The seal    - At zero it does not die. It collapses, and a marker sweeps a ring with three lit arcs. Press as
                   the marker crosses the lit arc, three times, in 7 s. A miss and it tears free with 15% back.
                   Only a person can seal it: the Auto-Breach Firewall deals damage but cannot seal.
   Every boundary is a stagger: a beat where it cannot be hurt, so a big hit never skips a phase.

   THE PAY (unchanged in kind): everything it ate comes back, a bounty of 225-900 s of income (_birdPay), fragments
   (x3 with Breach Protocol). New: a clean fight (nothing reflected, no echo struck, no tear landed, no seal missed)
   pays the bounty x1.5. If it escapes it keeps what it ate and instability rises 15.

   Rule for this file: no emoji and no glyph characters anywhere a player can see. Icons are generated SVG
   (BossKit.icon), the breach is generated SVG, and all text is plain.
   ═══════════════════════════════════════════════════════════════════════════ */

const AnomalyBoss = (() => {
    'use strict';
    const K = () => window.BossKit;

    /* ── tuning ─────────────────────────────────────────────────────────── */
    const COL = '#ff2d6a', COL_II = '#c23bff', COL_RAGE = '#ff5a1e', COL_SEAL = '#5cf2ff', COL_WIN = '#44ffaa';
    const MIN_ENERGY = 1e8;
    const FIRST_MS = 30 * 60000, GAP_MS = 35 * 60000, GAP_SPREAD_MS = 20 * 60000, ROLL = 0.02, ROLL_EVERY_MS = 15000;
    const HP_MIN = 54, HP_SPREAD = 10, LIFE_S = 80;
    const FEED = [0.10, 0.20, 0.30];                        // share of income it eats, by phase
    const SHELL = [                                          // seconds open / warning flicker / shut, by phase
        { open: 3.4, tell: 0.75, shut: 1.5 },
        { open: 2.6, tell: 0.60, shut: 1.6 },
        { open: 2.0, tell: 0.50, shut: 1.7 },
    ];
    const FIRST_OPEN_S = 4.5;                               // the very first window is generous
    const CORE = 0.34;                                      // the core ring (34 of 110) as a share of the body, a touch generous
    const STAGGER_S = 1.1;
    const REFLECT_HEAL = 1, REFLECT_STEAL_S = 2;            // a hit on a shut shell
    const ECHOES = 3, ECHO_HEAL = 2, SHUFFLE_S = 4.2;       // phase II
    const MOVE_S = 1.7, TELL_S = 0.45;                      // phase III jumps, and the mark before any jump
    const TEAR_EVERY_S = 3.2, TEAR_FLIGHT_S = 3.0, TEAR_HEAL = 2, TEAR_STEAL_S = 6;
    const SEAL_LOCKS = 3, SEAL_WINDOW_S = 7, SEAL_REV_S = 0.85, SEAL_SPEEDUP = 1.18, SEAL_FAIL_HP = 0.15;
    const HIT = [500, 0.005, 2], BOUNTY = [50000, 0.40, 900], CLEAN_MULT = 1.5;

    /* ── state ──────────────────────────────────────────────────────────── */
    let _active = false, _ready = false, _mode = 'off';     // off | intro | fight | stagger | seal | dying
    let _hp = 0, _max = 0, _phase = 0, _left = 0, _t = 0;
    let _shell = 'open', _shellUntil = 0, _staggerUntil = 0, _afterStagger = null;
    let _moveAt = 0, _shuffleAt = 0, _tearAt = 0;
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
    const _sound = id => { try { if (window.GameSound) GameSound.play(id); } catch (e) {} };
    const _click = () => { try { if (window.Sounds && Sounds.click) Sounds.click(); } catch (e) {} };
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
.rb.jump{transition:none}
.rb-body{position:absolute;inset:0;transition:opacity .12s linear,transform .25s ease;}
.rb.blink .rb-body{opacity:0;transform:scale(.6)}
.rb-art{width:100%;height:100%;overflow:visible;display:block;filter:drop-shadow(0 0 14px color-mix(in srgb,var(--rb-col) 70%,transparent));}
.rb-hit{fill:transparent;pointer-events:all;cursor:crosshair}
.rb-ring{fill:none;stroke:var(--rb-col);stroke-width:3;stroke-dasharray:130 26 64 18 96 30 58 20;opacity:.9}
.rb-jag{fill:none;stroke:var(--rb-col);stroke-width:1.5;opacity:.55}
.rb-shard{fill:var(--rb-col);stroke:#fff;stroke-width:1;stroke-opacity:.5}
.rb-sclera{fill:#0b0410;stroke:var(--rb-col);stroke-width:2}
.rb-core-mark{fill:none;stroke:#fff;stroke-width:1;stroke-dasharray:3 5;opacity:.45}
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
            + '<circle class="rb-core-mark" r="34"/>'
            + '<path class="rb-crack rb-c1" d="M-8,-30 L-2,-12 L-14,4 L-6,22"/>'
            + '<path class="rb-crack rb-c2" d="M22,-18 L10,-2 L26,10 L16,30"/>'
            + '<path class="rb-crack rb-c3" d="M-30,8 L-12,14 L-20,30 M4,-34 L12,-20 L2,-8"/>'
            + '<g class="rb-petals">' + petals + '</g>'
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
        const b = { el, real, x: 0, y: 0, alive: true, wander: Math.random() * 10, pupil: el.querySelector('.rb-pupil-g') };
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
        el.addEventListener('click', e => {
            e.stopPropagation();
            if (_mode === 'seal') return;
            _strike(b, e.clientX, e.clientY, 'click');
        });
        document.body.appendChild(el);
        return b;
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
        _stats = { hits: 0, crits: 0, reflects: 0, echoes: 0, shot: 0, landed: 0, sealMiss: 0, stolen: 0 };
        _hints = {};
        S()._breachHoard = 0;
        _ticker('REALITY BREACH: a massive anomaly has appeared', '#ff2255', 8000);
        _sound('sfx:breach');
        K().intro({ name: 'REALITY BREACH', sub: 'IT EATS WHAT YOU MAKE. IT KEEPS WHAT IT EATS.', col: COL })
            .then(() => { if (_active) _appear(); });
        return true;
    }

    function _appear() {
        _real = _body(true);
        _place(_real, window.innerWidth / 2, Math.max(90 + _size() / 2, window.innerHeight * 0.45));
        K().bar({ name: 'REALITY BREACH', col: COL, marks: [2 / 3, 1 / 3] });
        K().phase('PHASE I');
        _mode = 'fight'; _ready = true;
        _shell = 'open'; _shellUntil = FIRST_OPEN_S;
        document.addEventListener('pointermove', _onPointer, { passive: true });
        document.addEventListener('pointerdown', _onPointer, { passive: true });
        document.addEventListener('keydown', _onKey, true);
        _lastTs = performance.now();
        _refresh();
        _hintAt('core', 'STRIKE THE CORE FOR DOUBLE DAMAGE', 'target', 1800);
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
        if (!_ready || _paused()) return;   // a panel, a cutscene, the dampener, the fake crash: everything holds
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
            if (_phase === 2 && _t >= _moveAt) _jump();
            if (_phase === 2 && _t >= _tearAt) _volley();
            if (_left <= 0) { _escape(); return; }
        }
        _stepTears(dt);
        if (_mode === 'seal') _stepSeal(dt);
        _stepEyes();
        _refresh();
    }

    function _stepShell() {
        if (_t < _shellUntil) return;
        const c = SHELL[_phase];
        if (_shell === 'open') {
            _shell = 'tell'; _shellUntil = _t + c.tell;
            _hintAt('tell', 'IT IS CLOSING. HOLD FIRE.', 'shield', 2200);
        } else if (_shell === 'tell') {
            _shell = 'shut'; _shellUntil = _t + c.shut;
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
            b.pupil.setAttribute('transform', 'translate(' + (dx * 13).toFixed(1) + ',' + (dy * 13).toFixed(1) + ')');
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
    function _strike(b, x, y, src) {
        if (!_active || !_ready) return false;
        if (_mode === 'stagger') { if (src !== 'firewall') K().pop(x, y, 'IMMUNE', 'info', '#ffffff'); return false; }
        if (_mode !== 'fight' || !b.alive) return false;

        if (!b.real) {                                  // an echo
            b.alive = false;
            b.el.classList.add('shatter');
            _heal(ECHO_HEAL, x, y, 'ECHO  +' + ECHO_HEAL);
            _stats.echoes++;
            K().flash(COL_II, 0.25); K().shake(4);
            _hintAt('echo', 'THAT WAS AN ECHO. THE REAL ONE IS WATCHING YOU.', 'eye', 2600);
            return false;
        }
        if (_shell === 'shut') {                        // the shell is closed
            if (src === 'firewall') return false;
            _stats.reflects++;
            const steal = Math.min(Math.max(0, S().energy || 0), _income() * REFLECT_STEAL_S);
            if (steal > 0) { S().energy -= steal; S()._breachHoard = (S()._breachHoard || 0) + steal; _stats.stolen += steal; }
            _heal(REFLECT_HEAL, x, y, 'REFLECTED');
            K().flash(COL, 0.22); K().shake(2);
            _hintAt('shut', 'THE SHELL IS SHUT. EVERY HIT FEEDS IT.', 'shield', 2400);
            return false;
        }
        let dmg = 1, crit = false;
        if (src === 'click') {
            const r = b.el.getBoundingClientRect();
            crit = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) <= r.width / 2 * CORE;
            if (crit) dmg = 2;
        }
        _damage(dmg, src);
        if (src === 'firewall') return true;
        _stats.hits++; if (crit) _stats.crits++;
        if (src === 'click') {
            const pay = _pay(HIT[0], HIT[1], HIT[2]);
            S().energy += pay;
            K().pop(x, y, crit ? 'CRITICAL  +' + _fmt(pay) : '+' + _fmt(pay), crit ? 'crit' : 'hit', _col());
        } else {
            K().pop(x, y - 20, '-1', 'hit', _col());
        }
        _click();
        const cls = crit ? 'crit' : 'hit';
        b.el.classList.remove('hit', 'crit'); void b.el.offsetWidth; b.el.classList.add(cls);
        K().shake(crit ? 4 : 2);
        return true;
    }

    /* damage never crosses a phase line in one go: the line is a stagger */
    function _damage(n, src) {
        const floor = _phase === 0 ? Math.ceil(_max * 2 / 3) : _phase === 1 ? Math.ceil(_max / 3) : 0;
        _hp = Math.max(floor, _hp - n);
        if (_hp <= floor) {
            if (_phase < 2) _enterPhase(_phase + 1);
            else _beginSeal();
        }
    }

    function _heal(n, x, y, text) {
        _hp = Math.min(_max, _hp + n);
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
        const col = _col();
        _bodies().forEach(b => { b.el.style.setProperty('--rb-col', col); b.el.classList.toggle('p3', p === 2); });
        K().colour(col);
        K().phase(p === 1 ? 'PHASE II  IT SPLITS' : 'PHASE III  ENRAGED');
        K().flash(col, 0.4); K().shake(7);
        _sound('sfx:breach');
        _ticker(p === 1 ? 'The breach splits. Only one of them is real.' : 'The breach is enraged. It is coming for your energy.', col, 4000);
        _stagger(() => {
            _shellUntil = _t + SHELL[p].open;
            if (p === 1) { _spawnEchoes(); _shuffleAt = _t; _hintAt('split', 'ONLY ONE OF THEM IS WATCHING YOU', 'eye', 3000); }
            if (p === 2) { _clearEchoes(); _moveAt = _t + 0.6; _tearAt = _t + 1.2; }
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
        const order = spots.slice().sort(() => Math.random() - 0.5);
        all.forEach(b => b.el.classList.add('blink'));
        setTimeout(() => {
            if (!_active || _phase !== 1) return;
            all.forEach((b, i) => {
                b.alive = true;
                b.el.classList.remove('shatter', 'blink');
                _place(b, order[i].x, order[i].y);
            });
        }, TELL_S * 1000);
    }

    function _jump() {
        _moveAt = _t + MOVE_S * (0.8 + Math.random() * 0.4) + TELL_S;
        const p = _spot([{ x: _real.x, y: _real.y }], _size() * 1.4);
        _ghost(p.x, p.y);
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
        const n = _hp / _max < 0.15 ? 3 : 2;
        _tearAt = _t + TEAR_EVERY_S;
        for (let i = 0; i < n; i++) _tear(i, n);
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
        el.addEventListener('click', e => { e.stopPropagation(); _shoot(t); });
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
        _click();
    }

    function _land(t, tg) {
        t.dead = true; t.el.remove();
        if (_mode !== 'fight' && _mode !== 'stagger') return;
        _stats.landed++;
        const steal = Math.min(Math.max(0, S().energy || 0), _income() * TEAR_STEAL_S);
        if (steal > 0) { S().energy -= steal; S()._breachHoard = (S()._breachHoard || 0) + steal; _stats.stolen += steal; }
        _hp = Math.min(_max, _hp + TEAR_HEAL);
        K().heal();
        K().pop(tg.x, tg.y - 24, 'STOLEN  -' + _fmt(steal) + ' E', 'reflect');
        K().flash(COL_RAGE, 0.18); K().shake(3);
        if (tg.el) { tg.el.classList.remove('rb-drained'); void tg.el.offsetWidth; tg.el.classList.add('rb-drained'); }
    }

    function _clearTears() { _tears.forEach(t => t.el.remove()); _tears = []; }

    /* ── the seal ───────────────────────────────────────────────────────── */
    function _beginSeal() {
        _mode = 'seal';
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
        _sound('sfx:breach');

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
            _click();
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
        _sound('sfx:breach');
        _mode = 'fight';
        _stagger(() => { _moveAt = _t + 0.3; _tearAt = _t + 0.8; _shellUntil = _t + SHELL[2].open; });
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
        _sound('stinger:eventWin');
        const mins = eps > 0 ? bounty / eps / 60 : 0;
        setTimeout(() => K().result({ title: 'BREACH SEALED', col: COL_WIN, grade, rows: [
            ['energy', 'Returned what it ate', '+' + _fmt(back) + ' E'],
            ['energy', 'Bounty' + (clean ? ' (clean x1.5)' : ''), '+' + _fmt(bounty) + ' E' + (mins > 0 ? ' (' + (mins >= 10 ? Math.round(mins) : mins.toFixed(1)) + ' MIN)' : '')],
            ['fragment', 'Fragments', '+' + frags],
            ['clock', 'Sealed in', Math.round(secs) + 'S'],
            ['target', 'Critical hits', stats.crits + ' OF ' + stats.hits],
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
        _sound('stinger:eventFail');
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
        document.querySelectorAll('.rb,.rb-ghost,.rb-tear,.rb-seal').forEach(e => e.remove());
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
        /* QA: read-only state, and levers for the sandbox and the tests */
        _qa: () => ({ active: _active, ready: _ready, mode: _mode, hits: _hp, max: _max, phase: _phase, left: _left, shell: _shell,
                      hoard: S()._breachHoard || 0, next: _nextBoss - Date.now(), echoes: _echoes.length, tears: _tears.length,
                      seal: _seal ? { locks: _seal.locks, ang: _seal.ang, target: _seal.arcs[_seal.order[_seal.locks]].a, w: _seal.arcs[0].w } : null,
                      real: _real ? { x: _real.x, y: _real.y } : null, stats: _stats ? Object.assign({}, _stats) : null,
                      FEED: FEED.slice(), HIT: HIT.slice(), BOUNTY: BOUNTY.slice(), FIRST_MS, GAP_MS, GAP_SPREAD_MS, ROLL, LIFE_S }),
        _qaSetLeft: s => { _left = s; },
        _qaSetHp: v => { _hp = Math.max(1, Math.min(_max, v)); },
        _qaPhase: p => { while (_active && _phase < p && _mode !== 'seal') { _hp = _phase === 0 ? Math.ceil(_max * 2 / 3) : Math.ceil(_max / 3); _enterPhase(_phase + 1); } },
        _qaSeal: () => { if (_active && _mode !== 'seal') { _phase = 2; _hp = 0; _beginSeal(); } },
        _qaSkipStagger: () => { _staggerUntil = _t; },
        _qaNext: ms => { _nextBoss = Date.now() + ms; },
    };
})();
window.AnomalyBoss = AnomalyBoss;
