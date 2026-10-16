/* Plays the Reality Breach in the viewer (tools/viewer.js), in a real Chromium, and checks every mechanic.
   Run: node tests/reality-breach.test.js   (SHOTS=1 also writes screenshots to tests/shots/) */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

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
const qa = page => page.evaluate(() => AnomalyBoss._qa());
async function waitFor(page, fn, arg, ms = 8000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await sleep(40); }
    return false;
}
/* the screen point of the real breach's centre, or a point at a share of its radius */
async function realPoint(page, share = 0) {
    return page.evaluate(s => { const r = document.getElementById('anomaly-boss').getBoundingClientRect();
        return { x: r.left + r.width / 2 + r.width / 2 * s, y: r.top + r.height / 2 }; }, share);
}
/* the screen point of the real breach's weak point (rotate(wa) translate(0,-74) in a 220-wide viewBox) */
async function weakPoint(page) {
    return page.evaluate(() => { const r = document.getElementById('anomaly-boss').getBoundingClientRect(), k = r.width / 220;
        const a = AnomalyBoss._qa().real.weak * Math.PI / 180;
        return { x: r.left + r.width / 2 + Math.sin(a) * 74 * k, y: r.top + r.height / 2 - Math.cos(a) * 74 * k }; });
}
async function fresh(page) {
    await page.evaluate(() => { AnomalyBoss.cancel(); state.energy = 5e9; state.fragments = 0; state.instability = 20; state._breachHoard = 0; });
    await page.evaluate(() => AnomalyBoss.spawn());
    await waitFor(page, () => AnomalyBoss._qa().mode === 'fight');
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

    /* ── arrival ── */
    await page.evaluate(() => AnomalyBoss.spawn());
    await sleep(600);
    await shot(page, '01-intro');
    check('intro card shows the name', await page.evaluate(() => /REALITY BREACH/.test(document.querySelector('.bk-intro').textContent)));
    check('the event queue is held', await page.evaluate(() => GlobalEventQueue.isActive()));
    check('the fight starts after the intro', await waitFor(page, () => AnomalyBoss._qa().mode === 'fight'));
    check('phase I plays its own music', await waitFor(page, () => BossAudio._qa().song === 'watch' && BossAudio._qa().state === 'running'));
    check('and it is audible', await waitFor(page, () => BossAudio._qaLevel() > 0.02, null, 3000));
    await sleep(300);
    await shot(page, '02-phase1');
    let q = await qa(page);
    check('HP is 150-179', q.max >= 150 && q.max <= 179, q);
    check('one body, with the stable id', await page.evaluate(() => document.querySelectorAll('.rb').length === 1 && !!document.getElementById('anomaly-boss')));

    /* ── the weak point and the graze ── */
    let p = await weakPoint(page);
    let hp0 = (await qa(page)).hits;
    const wa0 = (await qa(page)).real.weak;
    await page.mouse.click(p.x, p.y);
    check('a weak point hit is critical (3 damage)', (await qa(page)).hits === hp0 - 3, { hp0, now: (await qa(page)).hits });
    check('the weak point moves once found', Math.abs((await qa(page)).real.weak - wa0) >= 100);
    p = await realPoint(page, 0);
    hp0 = (await qa(page)).hits;
    await page.mouse.click(p.x, p.y);
    check('the centre is only a graze (1 damage)', (await qa(page)).hits === hp0 - 1);
    const st = await page.evaluate(() => AnomalyBoss._qa().stats);
    check('hits are counted', st.hits === 2 && st.crits === 1, st);

    /* ── the shell ── */
    check('the shell warns before it shuts', await waitFor(page, () => AnomalyBoss._qa().shell === 'tell', null, 6000));
    await shot(page, '03-tell');
    check('then it shuts', await waitFor(page, () => AnomalyBoss._qa().shell === 'shut', null, 2000));
    await shot(page, '04-shut');
    hp0 = (await qa(page)).hits;
    const hoard0 = (await qa(page)).hoard;
    p = await realPoint(page, 0.3);
    await page.mouse.click(p.x, p.y);
    q = await qa(page);
    check('a hit on a shut shell is reflected and heals it', q.hits === Math.min(q.max, hp0 + Math.round(q.max * 0.012)) && q.stats.reflects === 1, q);
    check('a reflected hit steals into the hoard', q.hoard > hoard0);
    check('the firewall cannot hit a shut shell', await page.evaluate(() => AnomalyBoss.hit(3, 'firewall') === false));
    check('the shell opens again', await waitFor(page, () => AnomalyBoss._qa().shell === 'open', null, 3000));

    /* ── a phase line is a stagger ── */
    await page.evaluate(() => { const q = AnomalyBoss._qa(); AnomalyBoss._qaSetHp(Math.ceil(q.max * 0.65) + 2); });
    await page.evaluate(() => AnomalyBoss.hit(30, 'firewall'));
    q = await qa(page);
    check('a huge hit stops at the phase line', q.hits === Math.ceil(q.max * 0.65) && q.phase === 1, q);
    check('and staggers', q.mode === 'stagger');
    p = await realPoint(page, 0);
    hp0 = q.hits;
    await page.mouse.click(p.x, p.y);
    check('it is immune while staggered', (await qa(page)).hits === hp0);

    /* ── phase II: echoes ── */
    check('phase II switches the music', (await page.evaluate(() => BossAudio._qa().song)) === 'split');
    check('phase II brings two echoes', await waitFor(page, () => AnomalyBoss._qa().echoes === 2, null, 3000));
    await sleep(700);
    await shot(page, '05-phase2');
    check('echoes carry no id and are hidden from assistive tech',
        await page.evaluate(() => [...document.querySelectorAll('.rb.echo')].every(e => !e.id && e.getAttribute('aria-hidden') === 'true')));
    await page.mouse.move(100, 100);
    await sleep(100);
    const eyes = await page.evaluate(() => [...document.querySelectorAll('.rb')].map(e => ({ real: e.id === 'anomaly-boss', t: e.querySelector('.rb-pupil-g').getAttribute('transform') })));
    check('the real one watches the cursor (pupil points up-left)', /translate\(-\d/.test(eyes.find(e => e.real).t), eyes);
    await waitFor(page, () => AnomalyBoss._qa().shell === 'open' && AnomalyBoss._qa().mode === 'fight', null, 4000);
    /* echoes shuffle every few seconds: strike one in the same task the position is read, so a shuffle cannot land between */
    hp0 = (await qa(page)).hits;
    await page.evaluate(() => { const e = [...document.querySelectorAll('.rb.echo')].find(e => !e.classList.contains('blink'));
        const r = e.getBoundingClientRect();
        e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })); });
    const beamSeen = await page.evaluate(() => !!document.querySelector('.rb-beam'));
    q = await qa(page);
    check('a beam shows the echo feeding the real one', beamSeen);
    check('striking an echo heals the real one', q.stats.echoes === 1 && q.hits === Math.min(Math.ceil(q.max * 0.65), hp0 + Math.round(q.max * 0.006)), { hp0, q });
    for (let i = 0; i < 6; i++) await page.evaluate(() => { const e = document.querySelector('.rb.echo'); const r = e.getBoundingClientRect();
        e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })); }), await sleep(1050);
    q = await qa(page);
    check('heals never climb back over a phase line', q.phase === 1 && q.hits <= Math.ceil(q.max * 0.65), q);
    check('an echo cannot be killed', q.echoes === 2 && await page.evaluate(() => [...document.querySelectorAll('.rb.echo')].every(e => getComputedStyle(e).display !== 'none')));
    const pos0 = (await qa(page)).real;
    check('they shuffle', await waitFor(page, a => { const r = AnomalyBoss._qa().real; return r && (r.x !== a.x || r.y !== a.y); }, pos0, 6000));

    /* ── phase III: tears ── */
    await page.evaluate(() => AnomalyBoss._qaPhase(2));
    await page.evaluate(() => AnomalyBoss._qaSkipStagger());
    check('phase III switches the music', (await page.evaluate(() => BossAudio._qa().song)) === 'rage');
    check('phase III clears the echoes', await waitFor(page, () => AnomalyBoss._qa().echoes === 0 && AnomalyBoss._qa().phase === 2));
    check('it fires tears when its shell shuts', await waitFor(page, () => AnomalyBoss._qa().tears >= 2, null, 7000) && (await page.evaluate(() => AnomalyBoss._qa().shell)) === 'shut');
    await sleep(900);
    await shot(page, '06-phase3');
    /* a tear moves every frame, so click the element itself rather than where it was a moment ago */
    await page.evaluate(() => document.querySelector('.rb-tear').click());
    check('a tear can be shot down', (await qa(page)).stats.shot >= 1);
    const e0 = await page.evaluate(() => state.energy);
    check('a tear that lands steals and heals', await waitFor(page, () => AnomalyBoss._qa().stats.landed >= 1, null, 5000));
    q = await qa(page);
    check('stolen energy goes to the hoard', q.stats.stolen > 0 && q.hoard > 0, q.stats);
    check('it moves in phase III', await waitFor(page, a => { const r = AnomalyBoss._qa().real; return r && (r.x !== a.x || r.y !== a.y); }, q.real, 8000));

    /* ── the seal: the firewall cannot finish it ── */
    /* set it to 1 HP and finish it in the same task, so a landing tear or a closing shell cannot slip in between */
    await waitFor(page, () => { const q = AnomalyBoss._qa();
        if (q.mode !== 'fight' || q.shell === 'shut') return false;
        AnomalyBoss._qaSetHp(1); AnomalyBoss.hit(5, 'firewall'); return true; }, null, 6000);
    q = await qa(page);
    check('zero HP starts the seal, not a kill', q.mode === 'seal' && q.active, q.mode);
    check('the seal drops the music to a heartbeat', (await page.evaluate(() => BossAudio._qa().song)) === 'seal');
    check('the firewall cannot seal', await page.evaluate(() => AnomalyBoss.hit(5, 'firewall') === false && AnomalyBoss._qa().mode === 'seal'));
    await sleep(300);
    await shot(page, '07-seal');

    /* a press off the arc fails the seal */
    await waitFor(page, () => { const s = AnomalyBoss._qa().seal; const d = Math.abs(((s.ang - s.target) % 360 + 540) % 360 - 180); return d > 90; }, null, 3000);
    await page.keyboard.press('Space');
    q = await qa(page);
    check('a missed press: it tears free with 15%', q.mode !== 'seal' && q.hits === Math.max(1, Math.round(q.max * 0.15)) && q.stats.sealMiss === 1, q);

    /* seal it properly: press when the marker is inside the lit arc */
    await page.evaluate(() => AnomalyBoss._qaSeal());
    for (let i = 0; i < 3; i++) {
        const ok = await waitFor(page, () => { const s = AnomalyBoss._qa().seal; if (!s) return true; const d = Math.abs(((s.ang - s.target) % 360 + 540) % 360 - 180); return d < s.w / 2 - 6; }, null, 4000);
        if (!ok) break;
        await page.mouse.click(640, 400);
        await sleep(30);
    }
    q = await qa(page);
    const after = await page.evaluate(() => ({ e: state.energy, f: state.fragments, held: GlobalEventQueue.isActive(), defeated: state._bossesDefeated }));
    check('three locks seal it', !q.active && after.defeated === 1, { q, after });
    check('it pays fragments', after.f >= 18);
    check('the event queue is released', !after.held);
    check('the music stops when it is sealed', (await page.evaluate(() => BossAudio._qa().song)) === null);
    await sleep(900);
    check('the result card shows a grade', await page.evaluate(() => /BREACH SEALED/.test(document.querySelector('.bk-result').textContent) && !!document.querySelector('.bk-result-grade')));
    await shot(page, '08-result');
    check('no non-ASCII text on the result screen', (await visibleNonAscii(page)).length === 0, await visibleNonAscii(page));

    /* ── escape ── */
    await fresh(page);
    check('no non-ASCII text during the fight', (await visibleNonAscii(page)).length === 0, await visibleNonAscii(page));
    const instab0 = await page.evaluate(() => state.instability);
    await page.evaluate(() => AnomalyBoss._qaSetLeft(0.05));
    await waitFor(page, () => !AnomalyBoss._active);
    check('when time runs out it escapes and instability rises 15', (await page.evaluate(() => state.instability)) === instab0 + 15);

    /* ── pause holds everything ── */
    await fresh(page);
    await page.evaluate(() => document.body.classList.add('panel-open'));
    const l0 = (await qa(page)).left;
    await sleep(700);
    check('a panel pauses the clock', (await qa(page)).left === l0);
    check('and ducks the music', await page.evaluate(() => BossAudio._qa().ducked));
    await page.evaluate(() => document.body.classList.remove('panel-open'));

    /* ── quit, and the hoard comes back ── */
    await sleep(800);
    const hoard = (await qa(page)).hoard;
    await page.evaluate(() => AnomalyBoss.cancel());
    check('cancel leaves nothing on screen', await page.evaluate(() => !document.querySelector('.rb,.rb-tear,.rb-seal,.rb-ghost,.bk-bar,.bk-dim')));
    const eBefore = await page.evaluate(() => state.energy);
    await page.evaluate(() => AnomalyBoss.tick());
    check('after a quit, what it ate comes back on the next tick', hoard > 0 && (await page.evaluate(() => state._breachHoard)) === 0
        && (await page.evaluate(() => state.energy)) >= eBefore + hoard * 0.99, { hoard });

    /* ── keyboard ── */
    await fresh(page);
    await page.focus('#anomaly-boss');
    hp0 = (await qa(page)).hits;
    await page.keyboard.press('Enter');
    check('the keyboard can strike (a graze)', (await qa(page)).hits === hp0 - 1);
    await page.evaluate(() => AnomalyBoss.cancel());

    /* ── sound off ── */
    await page.evaluate(() => { Settings._prefs.sound = false; });
    await fresh(page);
    check('with sound off no music plays', (await page.evaluate(() => BossAudio._qa().song)) === null);
    await page.evaluate(() => { AnomalyBoss.cancel(); Settings._prefs.sound = true; });

    /* ── calm mode ── */
    await page.evaluate(() => document.body.classList.add('accessibility-mode'));
    await fresh(page);
    check('calm mode stills the spin', await page.evaluate(() => getComputedStyle(document.querySelector('.rb-orbit')).animationName === 'none'));
    await page.evaluate(() => { AnomalyBoss.cancel(); document.body.classList.remove('accessibility-mode'); });

    /* ── phone width ── */
    await page.setViewportSize({ width: 390, height: 844 });
    await fresh(page);
    await page.evaluate(() => AnomalyBoss._qaPhase(1));
    await page.evaluate(() => AnomalyBoss._qaSkipStagger());
    await sleep(1400);
    await shot(page, '09-phone-phase2');
    check('on a phone every body stays on screen', await page.evaluate(() => [...document.querySelectorAll('.rb')].every(e => {
        const r = e.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1; })));
    await page.evaluate(() => AnomalyBoss.cancel());

    check('no page errors', errors.length === 0, errors);
    await browser.close();
    const failed = results.filter(r => !r.ok).length;
    console.log('\n' + (results.length - failed) + '/' + results.length + ' passed');
    process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
