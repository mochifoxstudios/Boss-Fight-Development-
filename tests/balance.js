/* Balance probe for the Reality Breach: scripted players fight it to the end, at 4x speed, and the outcomes are tallied.
   Run: node tests/balance.js [fightsPerPlayer]
   The players differ in speed (mouse or finger) and in how well they read the fight. */
'use strict';
const { chromium } = require('playwright');
const { build } = require('../tools/viewer');

const SCALE = 4;
const PLAYERS = {
    /* a mouse, about 6.5 clicks a second: reads every tell, finds the weak point a third of the time, never strikes an echo */
    skilled: { every: 150, weak: 0.35, echo: 0.0, look: 0.5, guess: 0.0, early: 0.03, tear: 0.9, sealMiss: 0.1 },
    /* a mouse, sloppy: some echoes, some hits as the shell shuts, half the tears */
    average: { every: 150, weak: 0.12, echo: 0.2, look: 0.9, guess: 0.3, early: 0.15, tear: 0.55, sealMiss: 0.35 },
    /* a finger, about 4.5 taps a second, playing well */
    touch: { every: 220, touch: true, weak: 0.3, echo: 0.05, look: 0.7, guess: 0.1, early: 0.08, tear: 0.8, sealMiss: 0.2 },
    /* a finger, casual: slower taps, more mistakes */
    casual: { every: 270, touch: true, weak: 0.15, echo: 0.15, look: 1.2, guess: 0.4, early: 0.15, tear: 0.6, sealMiss: 0.35 },
};

/* look: seconds it takes, after the bodies shuffle, to spot the real one again. guess: the chance, while still
   looking, of tapping a body at random instead of waiting */

/* runs in the page: game time goes SCALE times faster (rAF timestamps and timers), and a bot plays */
function rig(SCALE) {
    const rAF = window.requestAnimationFrame.bind(window), sT = window.setTimeout.bind(window), t0 = performance.now();
    window.requestAnimationFrame = cb => rAF(ts => cb(t0 + (ts - t0) * SCALE));
    window.setTimeout = (fn, ms, ...a) => sT(fn, (ms || 0) / SCALE, ...a);
    window.__bot = (P, done) => {
        const fire = (el, x, y) => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerType: P.touch ? 'touch' : 'mouse' }));
        const shotAt = new WeakSet();
        let lastPos = null, lookUntil = 0;
        const iv = setInterval(() => {
            const q = AnomalyBoss._qa();
            if (!q.active) { clearInterval(iv); done({ win: !!(state._bossesDefeated), left: q.left, phase: q.phase, hp: Math.round(q.hits / q.max * 100), stats: q.stats }); return; }
            if (q.mode === 'seal') {
                const s = q.seal, d = Math.abs(((s.ang - s.target) % 360 + 540) % 360 - 180);
                const press = () => document.querySelector('.rb-seal').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
                if (d < s.w / 2 - 4) press();                              // on the arc
                else if (Math.random() < P.sealMiss / 70) press();          // a nervous press off it (about sealMiss per attempt)
                return;
            }
            /* tears first */
            for (const t of document.querySelectorAll('.rb-tear:not(.pop)')) {
                if (shotAt.has(t)) continue; shotAt.add(t);
                if (Math.random() < P.tear) { const el = t; setTimeout(() => el.isConnected && el.click(), 400 + 1400 * Math.random()); }   // game ms (the rig scales timers)
            }
            if (q.mode !== 'fight') return;
            if (q.shell === 'shut' && Math.random() > P.early) return;
            if (q.shell === 'tell' && Math.random() > P.early * 3) return;
            const echoes = [...document.querySelectorAll('.rb.echo')];
            /* after a shuffle a person has to find the real one again; meanwhile they wait, or guess */
            const pos = q.real.x + ',' + q.real.y, now = performance.now() / 1000;
            if (echoes.length && pos !== lastPos) { lastPos = pos; lookUntil = now + P.look / SCALE; }
            const looking = echoes.length && now < lookUntil;
            if (looking && Math.random() > P.guess) return;
            const all = [document.getElementById('anomaly-boss')].concat(echoes);
            const target = looking ? all[Math.floor(Math.random() * all.length)]
                : echoes.length && Math.random() < P.echo ? echoes[Math.floor(Math.random() * echoes.length)] : document.getElementById('anomaly-boss');
            const r = target.getBoundingClientRect(), k = r.width / 220;
            let x = r.left + r.width / 2, y = r.top + r.height / 2;
            if (target.id === 'anomaly-boss' && Math.random() < P.weak) {
                const a = q.real.weak * Math.PI / 180; x += Math.sin(a) * 74 * k; y -= Math.cos(a) * 74 * k;
            } else { const a = Math.random() * 6.283, d = Math.random() * 60 * k; x += Math.cos(a) * d; y += Math.sin(a) * d; }
            fire(target.querySelector('.rb-hit') || target, x, y);
        }, P.every / SCALE);
    };
}

(async () => {
    const N = +process.argv[2] || 5, ONLY = process.argv[3];
    const browser = await chromium.launch();
    for (const [name, P] of Object.entries(PLAYERS)) {
        if (ONLY && name !== ONLY) continue;
        const rows = [];
        for (let i = 0; i < N; i++) {
            const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
            await page.setContent(build().replace('<script>', () => '<script>(' + rig + ')(' + SCALE + ');</script>\n<script>'));
            await page.evaluate(() => { state.energy = 5e9; state._bossesDefeated = 0; AnomalyBoss.spawn(); });
            await page.waitForFunction(() => AnomalyBoss._qa().mode === 'fight');
            const r = await page.evaluate(P => new Promise(res => window.__bot(P, res)), P);
            rows.push(r);
            await page.close();
        }
        const wins = rows.filter(r => r.win);
        const avgLeft = wins.length ? wins.reduce((a, r) => a + r.left, 0) / wins.length : 0;
        console.log(name.padEnd(8) + ' wins ' + wins.length + '/' + N + (wins.length ? '   avg time left ' + avgLeft.toFixed(1) + 's' : '')
            + '   ' + rows.map(r => r.win ? 'W' + Math.round(r.left) : 'L(p' + (r.phase + 1) + ' ' + r.hp + '%)').join(' '));
        if (process.env.VERBOSE) rows.forEach(r => console.log('   ', JSON.stringify(r.stats)));
        /* how long each phase lasted, in fight seconds (seal time is not counted: the clock stops for it) */
        const span = (r, a, b) => r.stats.at[b] != null ? r.stats.at[b] - (a ? r.stats.at[a] : 0) : null;
        const avg = k => { const v = rows.map(k).filter(x => x != null); return v.length ? (v.reduce((a, x) => a + x, 0) / v.length).toFixed(0) + 's' : '-'; };
        console.log('         phase I ' + avg(r => span(r, 0, 1)) + '   phase II ' + avg(r => span(r, 1, 2)) + '   phase III ' + avg(r => span(r, 2, 3)));
    }
    await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
