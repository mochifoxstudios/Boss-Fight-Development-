/* Plays the Firewall Entity in the viewer (tools/viewer.js), in a real Chromium, and checks every mechanic.
   Run: node tests/firewall.test.js   (SHOTS=1 also writes screenshots to tests/shots/) */
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
const qa = page => page.evaluate(() => FirewallBoss._qa());
async function waitFor(page, fn, arg, ms = 8000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await sleep(40); }
    return false;
}
async function fresh(page) {
    await page.evaluate(() => { FirewallBoss.cancel(); AnomalyBoss.cancel(); MemoryLeakBoss.cancel(); FirewallBoss._qaForget(); state._firewallMult = 1; FirewallBoss.spawn(); });
}
/* press the element matching a selector (the nth match) with a real pointer at its centre */
async function press(page, sel, n = 0) {
    const p = await page.evaluate(([sel, n]) => { const e = document.querySelectorAll(sel)[n]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, [sel, n]);
    if (!p) return false;
    await page.mouse.click(p.x, p.y);
    return true;
}
/* the delete button on the inspector row whose code contains `text` */
async function delRow(page, text) {
    const p = await page.evaluate(text => { const r = [...document.querySelectorAll('.fw-row')].find(r => r.querySelector('.fw-code').textContent.includes(text));
        const b = r && r.querySelector('.fw-del'); if (!b || b.disabled) return null; const q = b.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; }, text);
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
    check('the game surface is kept (spawn, check, getMult, cancel, isActive)', await page.evaluate(() =>
        ['spawn', 'check', 'getMult', 'cancel', 'isActive'].every(k => typeof FirewallBoss[k] === 'function') && FirewallBoss.getMult() === 1));

    /* ── the wall ── */
    await page.evaluate(() => FirewallBoss.spawn());
    await sleep(300);
    check('the wall is <div id="firewall-boss"> over the game', await page.evaluate(() => !!document.getElementById('firewall-boss')));
    check('the event queue is held', await page.evaluate(() => GlobalEventQueue.isActive()));
    check('it plays its own music', await waitFor(page, () => BossAudio._qa().song === 'wall'));
    await shot(page, 'fw-01-wall');
    await page.mouse.click(640, 400);
    let q = await qa(page);
    check('tapping the wall is BLOCKED and does nothing else', q.blocked === 1 && q.done === 0 && !q.open);
    check('no INSPECT button after one tap', await page.evaluate(() => !document.querySelector('.fw-inspect')));
    await page.mouse.click(600, 300);
    check('after two blocked taps an INSPECT button appears', await page.evaluate(() => !!document.querySelector('.fw-inspect')));
    await shot(page, 'fw-02-inspect-button');

    /* ── the inspector ── */
    await page.keyboard.press('F12');
    q = await qa(page);
    check('F12 opens the inspector', q.open && q.mode === 'fight');
    check('the boss bar appears with the first look', await page.evaluate(() => !!document.getElementById('boss-bar')));
    await page.keyboard.press('Escape');
    check('Escape closes it', !(await qa(page)).open);
    const tr0 = (await qa(page)).trace;
    await sleep(500);
    check('the trace does not rise while the inspector is closed', (await qa(page)).trace === tr0);
    await press(page, '.fw-inspect');
    check('the INSPECT button opens it', (await qa(page)).open);
    await sleep(500);
    check('the trace rises while it is open', (await qa(page)).trace > tr0);
    await shot(page, 'fw-03-elements');

    /* ── phase I: rules ── */
    let t1 = (await qa(page)).trace;
    await delRow(page, 'main-game');
    q = await qa(page);
    check('deleting the game itself is ACCESS DENIED and costs trace', q.stats.denied === 1 && q.trace >= t1 + 11);
    t1 = q.trace;
    await delRow(page, 'firewall-boss');
    q = await qa(page);
    check('the firewall cannot be deleted while rules protect it', !q.boss && q.trace >= t1 + 11);
    await page.evaluate(() => FirewallBoss._qaSetTrace(0));
    for (const n of ['deny-click', 'deny-touch', 'deny-key', 'deny-scroll', 'deny-focus', 'deny-escape']) await delRow(page, n);
    q = await qa(page);
    check('six rules deleted', q.rules === 0);
    check('each rule cracks a band of the wall', await page.evaluate(() => document.querySelectorAll('.fw-band.gone').length === 6));
    await shot(page, 'fw-04-rules-gone');
    await delRow(page, 'firewall-boss');
    q = await qa(page);
    check('then the firewall node can be deleted: phase II', q.boss && q.phase === 1);
    check('phase II switches the music', (await page.evaluate(() => BossAudio._qa().song)) === 'ports');
    check('the wall rebuilds itself', await page.evaluate(() => document.querySelectorAll('.fw-band.gone').length === 0));

    /* ── phase II: styles ── */
    await shot(page, 'fw-05-styles');
    const optPress = async (prop, val) => { const p = await page.evaluate(([prop, val]) => { const b = [...document.querySelectorAll('.fw-opt')].find(b => b.getAttribute('aria-label') === 'Set ' + prop + ' to ' + val);
        if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, [prop, val]); if (p) await page.mouse.click(p.x, p.y); return !!p; };
    t1 = (await qa(page)).trace;
    await optPress('pointer-events', 'auto');
    q = await qa(page);
    check('a wrong value costs trace and does nothing', q.trace >= t1 + 9 && q.stats.wrongStyle === 1);
    await optPress('pointer-events', 'none');
    check('pointer-events: none makes clicks pass through the wall', await page.evaluate(() => document.getElementById('firewall-boss').classList.contains('see-through')));
    await optPress('z-index', '-1');
    await optPress('opacity', '0');
    q = await qa(page);
    check('all three locks undone: phase III', q.phase === 2);
    check('phase III switches the music', (await page.evaluate(() => BossAudio._qa().song)) === 'console');

    /* ── phase III: console ── */
    await page.evaluate(() => FirewallBoss._qaSetTrace(0));
    await shot(page, 'fw-06-console');
    const chipPress = async text => { const p = await page.evaluate(text => { const b = [...document.querySelectorAll('.fw-chip')].find(b => b.textContent === text && !b.classList.contains('used'));
        if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, text); if (p) await page.mouse.click(p.x, p.y); return !!p; };
    await chipPress('.hide()');
    await chipPress("'firewall-boss'");
    q = await qa(page);
    check('a decoy or an out-of-order chip costs trace', q.stats.wrongChip === 2 && q.line.length === 0 && q.trace >= 19);
    check('after two wrong chips the line is shown as a guide', await page.evaluate(() => !!document.querySelector('.fw-guide')));
    await shot(page, 'fw-07-guide');
    for (const c of ['document', '.getElementById(', "'firewall-boss'", ')', '.remove()']) await chipPress(c);
    q = await qa(page);
    const st = await page.evaluate(() => ({ d: state._firewallDefeated, m: state._firewallMult, held: GlobalEventQueue.isActive() }));
    check('the right line deletes it', !q.active && st.d === true);
    check('it pays x8 income, permanently', st.m === 8 && (await page.evaluate(() => FirewallBoss.getMult())) === 8);
    check('the event queue is released', !st.held);
    check('the music stops', (await page.evaluate(() => BossAudio._qa().song)) === null);
    await sleep(1100);
    check('the wall is gone', await page.evaluate(() => !document.getElementById('firewall-boss') && !document.querySelector('.fw-insp,.fw-inspect')));
    check('the result card shows a grade', await page.evaluate(() => /FIREWALL DELETED/.test(document.querySelector('.bk-result').textContent) && !!document.querySelector('.bk-result-grade')));
    await shot(page, 'fw-08-result');
    check('no non-ASCII text on the result screen', (await visibleNonAscii(page)).length === 0, await visibleNonAscii(page));
    check('once beaten it never comes again', await page.evaluate(() => { state.prestige = { count: 5 }; for (let i = 0; i < 5000; i++) FirewallBoss.check(); return !FirewallBoss.isActive(); }));

    /* ── the trace resets the connection ── */
    await fresh(page);
    await page.evaluate(() => FirewallBoss._qaOpen());
    check('no non-ASCII text during the fight', (await visibleNonAscii(page)).length === 0, await visibleNonAscii(page));
    for (const n of ['deny-click', 'deny-touch', 'deny-key']) await delRow(page, n);
    await page.evaluate(() => FirewallBoss._qaSetTrace(99.9));
    await waitFor(page, () => FirewallBoss._qa().mode === 'reset', null, 2000);
    q = await qa(page);
    check('a full trace resets the connection: the inspector closes', q.mode === 'reset' && !q.open && q.trace === 0);
    check('and two deleted rules come back', q.rules === 5, q.rules);
    check('it cannot be reopened during the reset', await page.evaluate(() => { FirewallBoss._qaOpen(); return !FirewallBoss._qa().open; }));
    check('then INSPECT comes back', await waitFor(page, () => !!document.querySelector('.fw-inspect') && FirewallBoss._qa().mode === 'fight', null, 4000));

    /* ── the real DevTools still win ── */
    await page.evaluate(() => document.getElementById('firewall-boss').remove());
    await sleep(100);
    check('deleting the div with the real DevTools wins', await page.evaluate(() => !FirewallBoss.isActive() && state._firewallDefeated && FirewallBoss.getMult() === 8));

    /* ── quit ── */
    await fresh(page);
    await page.evaluate(() => FirewallBoss._qaOpen());
    await page.evaluate(() => FirewallBoss.cancel());
    const left = await page.evaluate(() => ({ els: [...document.querySelectorAll('#firewall-boss,.fw-insp,.fw-inspect,.bk-bar')].map(e => e.id || e.className), active: FirewallBoss.isActive(), d: !!state._firewallDefeated }));
    check('cancel leaves nothing on screen and pays nothing', !left.els.length && !left.active && !left.d, left);
    check('cancel releases the event queue', await page.evaluate(() => !GlobalEventQueue.isActive()));

    /* ── a phone, with a finger ── */
    const ctx = await browser.newContext({ ...devices['Pixel 7'] });
    const phone = await ctx.newPage();
    phone.on('pageerror', e => errors.push(String(e)));
    await phone.setContent(build());
    await phone.evaluate(() => { document.getElementById('panel').classList.add('folded'); FirewallBoss.spawn(); });
    await phone.touchscreen.tap(200, 400); await sleep(100);
    await phone.touchscreen.tap(200, 500); await sleep(100);
    const ib = await phone.evaluate(() => { const r = document.querySelector('.fw-inspect').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await phone.touchscreen.tap(ib.x, ib.y);
    await sleep(400);
    check('on a phone the INSPECT button opens the inspector', (await phone.evaluate(() => FirewallBoss._qa().open)));
    check('on a phone the inspector is a bottom sheet that fits', await phone.evaluate(() => { const r = document.querySelector('.fw-insp').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.top > innerHeight * 0.3; }));
    const db = await phone.evaluate(() => { const r = [...document.querySelectorAll('.fw-row')].find(r => r.textContent.includes('deny-click')).querySelector('.fw-del').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height }; });
    await phone.touchscreen.tap(db.x, db.y);
    check('on a phone a tap deletes a rule', (await phone.evaluate(() => FirewallBoss._qa().rules)) === 5);
    check('delete buttons are big enough for a finger', db.h >= 30, db.h);
    await shot(phone, 'fw-09-phone');
    await ctx.close();

    check('no page errors', errors.length === 0, errors);
    await browser.close();
    const failed = results.filter(r => !r.ok).length;
    console.log('\n' + (results.length - failed) + '/' + results.length + ' passed');
    process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
