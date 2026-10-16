/* Balance probe for the Memory Leak: scripted players fight it to the end, at 4x speed, and the outcomes are tallied.
   Run: node tests/balance-leak.js [fightsPerPlayer] [player]
   Players differ in speed (mouse or finger), in how long a new block takes to catch their eye, in chain mistakes,
   in how soon they use the collector, and in how well they remember the recall. */
'use strict';
const { chromium } = require('playwright');
const { build } = require('../tools/viewer');

const SCALE = 4;
const PLAYERS = {
    skilled: { every: 150, notice: 0.25, order: 0.02, gcDelay: 0.3, recallMiss: 0.1 },
    average: { every: 160, notice: 0.45, order: 0.15, gcDelay: 1.5, recallMiss: 0.3 },
    touch:   { every: 220, notice: 0.4, order: 0.06, gcDelay: 0.8, recallMiss: 0.2, touch: true },
    casual:  { every: 270, notice: 0.7, order: 0.2, gcDelay: 2.5, recallMiss: 0.4, touch: true },
    /* a person on a phone: taps travel across the screen, new blocks take a second to register, the collector is an afterthought */
    human:   { every: 400, notice: 1.0, order: 0.25, gcDelay: 4, recallMiss: 0.45, touch: true },
};

function rig(SCALE) {
    const rAF = window.requestAnimationFrame.bind(window), sT = window.setTimeout.bind(window), t0 = performance.now();
    window.requestAnimationFrame = cb => rAF(ts => cb(t0 + (ts - t0) * SCALE));
    window.setTimeout = (fn, ms, ...a) => sT(fn, (ms || 0) / SCALE, ...a);
    window.__bot = (P, done) => {
        const press = (el, x, y) => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerType: P.touch ? 'touch' : 'mouse' }));
        const seen = new Map();          // block key -> game time first seen
        let gcSeen = 0, recallPlan = null, gameT = 0;
        const iv = setInterval(() => {
            gameT += P.every / 1000;
            const q = MemoryLeakBoss._qa();
            if (!q.active) { clearInterval(iv); done({ win: !!state._bossesDefeated, phase: q.phase, hp: Math.round(q.hp / Math.max(1, q.max) * 100), stats: q.stats, peak: q.peak }); return; }
            if (q.mode === 'recall') {
                if (!q.recall || q.recall.watching) { recallPlan = null; return; }
                if (!recallPlan) { recallPlan = q.recall.seq.slice(); if (Math.random() < P.recallMiss) recallPlan[1 + Math.floor(Math.random() * 3)] = (recallPlan[1] + 1) % 9; }
                const i = recallPlan[q.recall.got]; const c = document.querySelectorAll('.ml-cell')[i];
                if (c) { const r = c.getBoundingClientRect(); press(c, r.left + r.width / 2, r.top + r.height / 2); }
                return;
            }
            if (q.mode !== 'fight') return;
            if (q.gc >= q.GC_NEED) { if (!gcSeen) gcSeen = gameT; if (gameT - gcSeen >= P.gcDelay) { gcSeen = 0; MemoryLeakBoss.collect(); return; } } else gcSeen = 0;
            const els = [...document.querySelectorAll('.ml-block:not(.freed)')];
            const blocks = q.blocks.map((b, i) => Object.assign({ key: Math.round(b.x) + ',' + Math.round(b.y) }, b));
            blocks.forEach(b => { if (!seen.has(b.key)) seen.set(b.key, gameT); });
            const ready = blocks.filter(b => gameT - seen.get(b.key) >= P.notice);
            if (!ready.length) return;
            const chain = ready.filter(b => b.chain);
            let pick;
            if (chain.length && Math.random() < 0.5) {
                const next = Math.min(...blocks.filter(b => b.chain).map(b => b.chain));
                pick = Math.random() < P.order ? chain[Math.floor(Math.random() * chain.length)] : chain.find(b => b.chain === next) || chain[0];
            } else {
                const plain = ready.filter(b => !b.chain);
                pick = plain.length ? plain[Math.floor(Math.random() * plain.length)] : chain.find(b => b.chain === Math.min(...blocks.filter(x => x.chain).map(x => x.chain)));
            }
            if (!pick) return;
            const el = document.elementFromPoint(pick.x, pick.y);
            const btn = el && el.closest && el.closest('.ml-block');
            if (btn) press(btn, pick.x, pick.y);
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
            await page.evaluate(() => { state._bossesDefeated = 0; MemoryLeakBoss._qaTrigger(); document.getElementById('panel').classList.add('folded'); });
            await page.waitForFunction(() => MemoryLeakBoss._qa().mode === 'fight');
            rows.push(await page.evaluate(P => new Promise(res => window.__bot(P, res)), P));
            await page.close();
        }
        const wins = rows.filter(r => r.win);
        const t = r => r.stats.at;
        const avg = f => { const v = rows.map(f).filter(x => x != null && !isNaN(x)); return v.length ? (v.reduce((a, x) => a + x, 0) / v.length).toFixed(0) + 's' : '-'; };
        console.log(name.padEnd(8) + ' wins ' + wins.length + '/' + N + '   peak heap ' + avg(r => r.peak).replace('s', '%')
            + '   ' + rows.map(r => r.win ? 'W' : 'L(p' + (r.phase + 1) + ' ' + r.hp + '%)').join(' '));
        console.log('         phase I ' + avg(r => t(r)[1]) + '   phase II ' + avg(r => t(r)[2] - t(r)[1]) + '   phase III ' + avg(r => t(r)[3] - t(r)[2])
            + '   recalls missed ' + rows.reduce((a, r) => a + r.stats.wrong, 0) + '   segfaults ' + rows.reduce((a, r) => a + r.stats.segfaults, 0));
    }
    await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
