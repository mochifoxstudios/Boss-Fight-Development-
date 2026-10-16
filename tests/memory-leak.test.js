/* Plays the Memory Leak in the viewer (tools/viewer.js), in a real Chromium, and checks every mechanic.
   Run: node tests/memory-leak.test.js   (SHOTS=1 also writes screenshots to tests/shots/) */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium, devices } = require('playwright');
const { build } = require('../tools/viewer');

const SHOTS = !!process.env.SHOTS;
const results = [];
function check(name, ok, info) { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || info === undefined ? '' : '  ' + JSON.stringify(info))); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function shot(page, name) {
    if (!SHOTS) return;
    fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
    await page.screenshot({ path: path.join(__dirname, 'shots', name + '.png') });
}
const qa = page => page.evaluate(() => MemoryLeakBoss._qa());
async function waitFor(page, fn, arg, ms = 8000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await sleep(40); }
    return false;
}
async function fresh(page) {
    await page.evaluate(() => { MemoryLeakBoss.cancel(); AnomalyBoss.cancel(); state.energy = 5e9; state.fragments = 0; state.instability = 20; state._bossesDefeated = 0; });
    await page.evaluate(() => MemoryLeakBoss._qaTrigger());
    await waitFor(page, () => MemoryLeakBoss._qa().mode === 'fight');
}
/* press a block (by index in _qa().blocks order, or by a predicate) with a real pointer at its centre */
async function pressBlock(page, pick) {
    const p = await page.evaluate(pick => {
        const els = [...document.querySelectorAll('.ml-block:not(.freed)')];
        const q = MemoryLeakBoss._qa().blocks;
        const want = typeof pick === 'number' ? q[pick] : q.find(b => (pick.chain == null || b.chain === pick.chain) && (pick.kb == null || b.kb === pick.kb));
        if (!want) return null;
        return { x: want.x, y: want.y };
    }, pick);
    if (!p) return false;
    await page.mouse.click(p.x, p.y);
    return true;
}
async function visibleNonAscii(page) {
    return page.evaluate(() => {
        const bad = [];
        const walk = n => { if (n.nodeType === 3) { for (const ch of n.textContent) if (ch.charCodeAt(0) > 126) bad.push(ch); }
                            else if (n.nodeType === 1 && n.tagName !== 'SCRIPT' && n.tagName !== 'STYLE') n.childNodes.forEach(walk); };
        walk(document.body);
        document.querySelectorAll('[aria-label]').forEach(e => { for (const ch of e.getAttribute('aria-label')) if (ch.charCodeAt(0) > 126) bad.push(ch); });
        return bad;
    });
}

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setContent(build());

    /* ── the game's surface ── */
    check('the game surface is kept (tick, cancel, isActive, tryCommand)', await page.evaluate(() =>
        ['tick', 'cancel', 'isActive', 'tryCommand'].every(k => typeof MemoryLeakBoss[k] === 'function')));
    check('it rolls only at prestige 2+ with instability over 75 (unchanged)', await page.evaluate(() => {
        state.instability = 20; const n0 = MemoryLeakBoss._qa().next; MemoryLeakBoss.tick(); return !MemoryLeakBoss.isActive(); }));

    /* ── arrival ── */
    await page.evaluate(() => MemoryLeakBoss._qaTrigger());
    await sleep(600);
    await shot(page, 'ml-01-intro');
    /* the heap is real until the mechanics below need time to arrive; then it is held so the fight cannot end early */
    check('intro card shows the name', await page.evaluate(() => /MEMORY LEAK/.test(document.querySelector('.bk-intro').textContent)));
    check('the event queue is held', await page.evaluate(() => GlobalEventQueue.isActive()));
    check('the fight starts after the intro', await waitFor(page, () => MemoryLeakBoss._qa().mode === 'fight'));
    check('it plays its own music', await waitFor(page, () => BossAudio._qa().song === 'alloc'));
    check('it needs nothing from index.html (no #memory-leak-terminal)', await page.evaluate(() => !document.getElementById('memory-leak-terminal') && !!document.querySelector('.ml-leak')));
    check('blocks drip out', await waitFor(page, () => MemoryLeakBoss._qa().blocks.length >= 3, null, 6000));
    await sleep(400);
    await shot(page, 'ml-02-phase1');
    let q = await qa(page);
    check('HP is 100-115', q.max >= 100 && q.max <= 115, q.max);
    check('the heap fills while blocks stand', (await page.evaluate(async () => { const a = MemoryLeakBoss._qa().heap; await new Promise(r => setTimeout(r, 600)); return MemoryLeakBoss._qa().heap - a; })) > 0);

    /* ── freeing ── */
    q = await qa(page);
    const heap0 = q.heap, hp0 = q.hp, n0 = q.blocks.length;
    await pressBlock(page, 0);
    q = await qa(page);
    check('a tap frees a block and costs the leak 1', q.hp === hp0 - 1 && q.stats.hand === 1, { hp0, q: q.hp });
    check('freeing drops the heap', q.heap < heap0);
    check('freeing by hand charges the collector', q.gc === 1);

    /* ── the collector ── */
    check('the collector cannot fire before it is charged', await page.evaluate(() => MemoryLeakBoss.collect() === false));
    await page.evaluate(() => MemoryLeakBoss._qaCharge());
    await waitFor(page, () => MemoryLeakBoss._qa().blocks.length >= 3, null, 5000);
    await sleep(100);
    check('the GC button lights when charged', await page.evaluate(() => document.querySelector('.ml-gc').classList.contains('ready')));
    await shot(page, 'ml-03-gc-ready');
    q = await qa(page);
    const before = { hp: q.hp, n: q.blocks.length, keys: q.blocks.map(b => Math.round(b.x) + ',' + Math.round(b.y)) };
    const gcBox = await page.evaluate(() => { const r = document.querySelector('.ml-gc').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.click(gcBox.x, gcBox.y);
    q = await qa(page);
    check('GC frees every block on screen', q.stats.gcs === 1 && !q.blocks.some(b => before.keys.includes(Math.round(b.x) + ',' + Math.round(b.y))), q.blocks.length);
    check('GC deals 1 damage a block', q.hp === Math.max(Math.ceil(q.max * 0.65), before.hp - before.n), { before, hp: q.hp });
    check('GC empties the charge', q.gc === 0);
    check('the typed command still works as a shortcut', await page.evaluate(() => { MemoryLeakBoss._qaCharge(); return MemoryLeakBoss.tryCommand('execute garbage_collection'); }));

    /* ── phase lines are staggers ── */
    await page.evaluate(() => { MemoryLeakBoss._qaHoldHeap(true); MemoryLeakBoss._qaSetHeap(10); const q = MemoryLeakBoss._qa(); MemoryLeakBoss._qaSetHp(Math.ceil(q.max * 0.65) + 1); MemoryLeakBoss._qaCharge(); });
    await waitFor(page, () => MemoryLeakBoss._qa().blocks.length >= 4, null, 6000);
    await page.evaluate(() => MemoryLeakBoss.collect());
    q = await qa(page);
    check('a big collection stops at the phase line', q.hp === Math.ceil(q.max * 0.65) && q.phase === 1 && q.mode === 'stagger', { hp: q.hp, phase: q.phase, mode: q.mode });
    check('phase II switches the music', (await page.evaluate(() => BossAudio._qa().song)) === 'pointers');

    /* ── phase II: pointer chains ── */
    await page.evaluate(() => MemoryLeakBoss._qaSkipStagger());
    check('chains of three arrive', await waitFor(page, () => MemoryLeakBoss._qa().blocks.filter(b => b.chain).length === 3, null, 9000));
    await sleep(400);
    await shot(page, 'ml-04-chain');
    check('a chain is drawn with links', await page.evaluate(() => document.querySelectorAll('.ml-links line').length === 2));
    q = await qa(page);
    const h1 = q.heap;
    await pressBlock(page, { chain: 3 });
    q = await qa(page);
    check('out of order is a segfault: nothing freed, heap up', q.stats.segfaults === 1 && q.blocks.filter(b => b.chain).length === 3 && q.heap > h1 + 3, { s: q.stats, heap: q.heap, h1 });
    const hpc = q.hp;
    for (const i of [1, 2, 3]) await pressBlock(page, { chain: i });
    q = await qa(page);
    check('a chain in order deals bonus damage', q.stats.chains === 1 && q.hp <= hpc - (3 + 3), { hpc, hp: q.hp, s: q.stats });

    /* ── phase III: fragmentation ── */
    await page.evaluate(() => { MemoryLeakBoss._qaPhase(2); MemoryLeakBoss._qaSkipStagger(); MemoryLeakBoss._qaSetHeap(20); });
    await waitFor(page, () => MemoryLeakBoss._qa().mode === 'fight');
    await page.evaluate(() => { MemoryLeakBoss._qaCharge(); MemoryLeakBoss.collect(); });   // clear the screen: blocks are capped
    check('phase III switches the music', (await page.evaluate(() => BossAudio._qa().song)) === 'frag');
    check('big 64 KB blocks arrive', await waitFor(page, () => MemoryLeakBoss._qa().blocks.some(b => b.kb === 64), null, 9000));
    await sleep(400);
    await shot(page, 'ml-05-phase3');
    const n64 = (await qa(page)).blocks.filter(b => b.kb === 16).length;
    await pressBlock(page, { kb: 64 });
    await sleep(80);
    check('a big block splits into two small ones', (await qa(page)).blocks.filter(b => b.kb === 16).length >= n64 + 2);

    /* ── the recall: a wrong cell ── */
    await page.evaluate(() => { MemoryLeakBoss._qaSetHeap(10); MemoryLeakBoss._qaRecall(); });
    q = await qa(page);
    check('zero integrity starts the recall, not a kill', q.mode === 'recall' && q.active && q.blocks.length === 0);
    check('the recall has its own music', (await page.evaluate(() => BossAudio._qa().song)) === 'recall');
    await sleep(1400);
    await shot(page, 'ml-06-recall');
    check('cells cannot be pressed while it shows them', await page.evaluate(() => { const q = MemoryLeakBoss._qa(); return q.recall.watching; }));
    check('then it is your turn', await waitFor(page, () => !MemoryLeakBoss._qa().recall.watching, null, 6000));
    const wrong = await page.evaluate(() => { const s = MemoryLeakBoss._qa().recall.seq; return [0, 1, 2, 3, 4, 5, 6, 7, 8].find(i => i !== s[0]); });
    const cellPt = async i => page.evaluate(i => { const r = document.querySelectorAll('.ml-cell')[i].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, i);
    let c = await cellPt(wrong);
    await page.mouse.click(c.x, c.y);
    q = await qa(page);
    check('a first wrong cell plays the sequence again', q.mode === 'recall' && q.recall.watching && q.recall.got === 0);
    check('then it is your turn again', await waitFor(page, () => !MemoryLeakBoss._qa().recall.watching, null, 6000));
    c = await cellPt(wrong);
    await page.mouse.click(c.x, c.y);
    check('a second wrong cell plays it once more', (await qa(page)).recall && (await qa(page)).recall.watching);
    await waitFor(page, () => !MemoryLeakBoss._qa().recall.watching, null, 6000);
    c = await cellPt(wrong);
    await page.mouse.click(c.x, c.y);
    q = await qa(page);
    check('a third wrong cell: it reallocates with 15%', q.mode !== 'recall' && q.hp === Math.max(1, Math.round(q.max * 0.15)) && q.stats.wrong === 3, q.mode);

    /* ── the recall: done right ── */
    await page.evaluate(() => MemoryLeakBoss._qaRecall());
    await waitFor(page, () => !MemoryLeakBoss._qa().recall.watching, null, 7000);
    const seq = (await qa(page)).recall.seq;
    for (const i of seq) { c = await cellPt(i); await page.mouse.click(c.x, c.y); await sleep(60); }
    q = await qa(page);
    const after = await page.evaluate(() => ({ f: state.fragments, held: GlobalEventQueue.isActive(), d: state._bossesDefeated }));
    check('the right sequence reclaims the heap', !q.active && after.d === 1, { q: q.mode, after });
    check('it pays fragments', after.f >= 3);
    check('the event queue is released', !after.held);
    check('the music stops', (await page.evaluate(() => BossAudio._qa().song)) === null);
    await sleep(900);
    check('the result card shows a grade', await page.evaluate(() => /HEAP RECLAIMED/.test(document.querySelector('.bk-result').textContent) && !!document.querySelector('.bk-result-grade')));
    await shot(page, 'ml-07-result');
    check('no non-ASCII text on the result screen', (await visibleNonAscii(page)).length === 0, await visibleNonAscii(page));
    check('nothing of the fight is left on screen', await page.evaluate(() => !document.querySelector('.ml-block,.ml-gc,.ml-recall,.ml-links')));

    /* ── keyboard ── */
    await fresh(page);
    check('no non-ASCII text during the fight', (await visibleNonAscii(page)).length === 0, await visibleNonAscii(page));
    await waitFor(page, () => MemoryLeakBoss._qa().blocks.length >= 2, null, 5000);
    const hk = (await qa(page)).hp;
    await page.focus('.ml-block');
    await page.keyboard.press('Enter');
    check('a block can be freed from the keyboard', (await qa(page)).hp === hk - 1);
    await page.evaluate(() => MemoryLeakBoss._qaCharge());
    await page.keyboard.press('g');
    check('G fires the collector', (await qa(page)).stats.gcs === 1);

    /* ── out of memory ── */
    await page.evaluate(() => MemoryLeakBoss._qaHoldHeap(false));
    const instab0 = await page.evaluate(() => state.instability);
    await page.evaluate(() => MemoryLeakBoss._qaSetHeap(99.9));
    await waitFor(page, () => !MemoryLeakBoss._qa().active, null, 4000);
    check('at 100% heap it is contained by force: instability +25', (await page.evaluate(() => state.instability)) === Math.min(100, instab0 + 25));
    await sleep(300);
    await shot(page, 'ml-08-fail');

    /* ── pause holds the heap ── */
    await fresh(page);
    await page.evaluate(() => document.body.classList.add('panel-open'));
    const hp1 = (await qa(page)).heap;
    await sleep(700);
    check('a panel pauses the heap', (await qa(page)).heap === hp1);
    await page.evaluate(() => document.body.classList.remove('panel-open'));

    /* ── quit ── */
    await page.evaluate(() => MemoryLeakBoss.cancel());
    check('cancel leaves nothing on screen', await page.evaluate(() => !document.querySelector('.ml-block,.ml-leak,.ml-gc,.ml-recall,.ml-links,.bk-bar,.bk-dim') && !MemoryLeakBoss.isActive()));
    check('cancel releases the event queue', await page.evaluate(() => !GlobalEventQueue.isActive()));

    /* ── a phone, with a finger ── */
    const ctx = await browser.newContext({ ...devices['Pixel 7'] });
    const phone = await ctx.newPage();
    phone.on('pageerror', e => errors.push(String(e)));
    await phone.setContent(build());
    await phone.evaluate(() => MemoryLeakBoss._qaTrigger());
    await waitFor(phone, () => MemoryLeakBoss._qa().mode === 'fight');
    await waitFor(phone, () => MemoryLeakBoss._qa().blocks.length >= 3, null, 6000);
    await sleep(400);
    let taps = 0;
    for (let i = 0; i < 8; i++) {
        const b = await phone.evaluate(() => MemoryLeakBoss._qa().blocks.find(b => !b.chain));
        if (!b) { await sleep(400); continue; }
        await sleep(350);                                   // let a new block finish dropping in before the tap
        if (!(await phone.evaluate(b => MemoryLeakBoss._qa().blocks.some(x => x.x === b.x && x.y === b.y), b))) continue;
        await phone.touchscreen.tap(b.x, b.y); taps++; await sleep(150);
    }
    check('on a phone every tap frees a block', (await phone.evaluate(() => MemoryLeakBoss._qa().stats.hand)) === taps, taps);
    await shot(phone, 'ml-09-phone');
    check('on a phone every block stays on screen and clear of the GC button', await phone.evaluate(() => {
        const gc = document.querySelector('.ml-gc').getBoundingClientRect();
        return [...document.querySelectorAll('.ml-block:not(.freed)')].every(e => { const r = e.getBoundingClientRect();
            return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1 && (r.bottom < gc.top || r.top > gc.bottom || r.right < gc.left || r.left > gc.right); }); }));
    await ctx.close();

    check('no page errors', errors.length === 0, errors);
    await browser.close();
    const failed = results.filter(r => !r.ok).length;
    console.log('\n' + (results.length - failed) + '/' + results.length + ' passed');
    process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
