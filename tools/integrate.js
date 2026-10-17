/* tools/integrate.js — puts bosses.js into the game. Development only.

     node tools/integrate.js <game folder>                 dry run: says what it would do, changes nothing
     node tools/integrate.js <game folder> --write         does it
     node tools/integrate.js <game folder> --write --add-script
                                                           also adds the one <script> tag to index.html

   What --write does, each step found by the text of the code itself (never by line number, since game.js keeps
   changing), and refused unless every start and end is found exactly once:
     1. game.js     remove the old Reality Breach (AnomalyBoss) block
     2. game.js     remove the old Firewall Entity (FirewallBoss) block
     3. systems3.js remove the old Memory Leak (MemoryLeakBoss) block
     4. game.js     remove BossStage, the old shared boss frame (only the two old bosses used it)
     5. copy src/bosses.js next to game.js
   Every changed file is first copied to <name>.pre-bosses.bak. index.html is touched only with --add-script, and
   then only to add <script src="bosses.js"></script> right after the game.js tag. */
'use strict';
const fs = require('fs');
const path = require('path');

const CUTS = [
    { file: 'game.js', what: 'the old Reality Breach (AnomalyBoss)',
      start: /\n[ \t]*\/\*[ \t]*═+[ \t]*\n[ \t]*ANOMALY BOSS — the Reality Breach[^\n]*\n/, end: /\n[ \t]*window\.AnomalyBoss = AnomalyBoss;[^\n]*\n/ },
    { file: 'game.js', what: 'the old Firewall Entity (FirewallBoss)',
      start: /\n[ \t]*\/\*[ \t]*═+[ \t]*\n[ \t]*DOM BOSS FIGHT — "Firewall Entity"[^\n]*\n/, end: /\n[ \t]*window\.FirewallBoss = FirewallBoss;[^\n]*\n/ },
    { file: 'game.js', what: 'BossStage, the old shared boss frame',
      start: /\n[ \t]*\/\*[ \t]*═+[ \t]*\n[ \t]*BOSS STAGE — the frame the bosses share[^\n]*\n/, end: /\n[ \t]*window\.BossStage = BossStage;[^\n]*\n/ },
    { file: 'systems3.js', what: 'the old Memory Leak (MemoryLeakBoss)',
      start: /\n\/\* ── 8\. MEMORY LEAK BOSS[^\n]*\n/, end: /\nwindow\.MemoryLeakBoss = MemoryLeakBoss;[^\n]*\n/ },
];

function count(text, re) { const g = new RegExp(re.source, 'g'); return (text.match(g) || []).length; }

function main() {
    const args = process.argv.slice(2);
    const dir = args.find(a => !a.startsWith('--'));
    const write = args.includes('--write'), addScript = args.includes('--add-script');
    if (!dir) { console.error('usage: node tools/integrate.js <game folder> [--write] [--add-script]'); process.exit(2); }
    const src = path.join(__dirname, '..', 'src', 'bosses.js');
    const texts = {}, problems = [];
    for (const f of ['game.js', 'systems3.js']) {
        const p = path.join(dir, f);
        if (!fs.existsSync(p)) { problems.push(f + ' not found in ' + dir); continue; }
        texts[f] = fs.readFileSync(p, 'utf8');
    }
    const plan = [];
    for (const c of CUTS) {
        const t = texts[c.file]; if (t == null) continue;
        const ns = count(t, c.start), ne = count(t, c.end);
        if (ns === 0 && ne === 0) { plan.push({ c, skip: 'already removed' }); continue; }
        if (ns !== 1 || ne !== 1) { problems.push(c.file + ': ' + c.what + ': start found ' + ns + 'x, end found ' + ne + 'x (need exactly 1 each)'); continue; }
        const a = t.search(c.start), mEnd = t.match(c.end), b = t.indexOf(mEnd[0]) + mEnd[0].length;
        if (b <= a) { problems.push(c.file + ': ' + c.what + ': its end comes before its start'); continue; }
        plan.push({ c, a, b, lines: t.slice(a, b).split('\n').length - 2 });
    }
    plan.forEach(p => console.log((p.skip ? 'skip    ' : 'remove  ') + p.c.file.padEnd(12) + p.c.what + (p.skip ? ' (' + p.skip + ')' : ', ' + p.lines + ' lines')));
    if (problems.length) { console.error('\nNothing was changed:'); problems.forEach(p => console.error('  ' + p)); process.exit(1); }

    /* the cuts must leave nothing that still declares the three bosses */
    const after = {};
    for (const f of Object.keys(texts)) {
        let t = texts[f];
        plan.filter(p => p.c.file === f && !p.skip).sort((x, y) => y.a - x.a).forEach(p => { t = t.slice(0, p.a) + '\n' + t.slice(p.b); });
        after[f] = t;
        const left = (t.match(/\b(const|let|var|function)\s+(AnomalyBoss|MemoryLeakBoss|FirewallBoss|BossKit|BossAudio)\b/g) || []);
        if (left.length) problems.push(f + ' would still declare: ' + left.join(', '));
    }
    if (problems.length) { console.error('\nNothing was changed:'); problems.forEach(p => console.error('  ' + p)); process.exit(1); }

    const idx = path.join(dir, 'index.html');
    let html = fs.existsSync(idx) ? fs.readFileSync(idx, 'utf8') : null;
    const tag = '<script src="bosses.js"></script>';
    const hasTag = html && html.includes('src="bosses.js"');
    console.log('copy    src/bosses.js -> ' + path.join(dir, 'bosses.js'));
    if (hasTag) console.log('ok      index.html already loads bosses.js');
    else if (addScript) console.log('add     index.html: ' + tag + ' right after the game.js tag');
    else console.log('todo    index.html: add ' + tag + ' right after <script src="game.js"></script> (or rerun with --add-script)');

    if (!write) { console.log('\nDry run. Rerun with --write to do it.'); return; }
    for (const f of Object.keys(after)) {
        if (after[f] === texts[f]) continue;
        const p = path.join(dir, f);
        fs.writeFileSync(p + '.pre-bosses.bak', texts[f]);
        fs.writeFileSync(p, after[f]);
    }
    fs.copyFileSync(src, path.join(dir, 'bosses.js'));
    if (addScript && html && !hasTag) {
        const m = html.match(/([ \t]*)<script src="game\.js"><\/script>[^\n]*\n/);
        if (!m) { console.error('index.html: no <script src="game.js"></script> tag found; add ' + tag + ' after it by hand'); process.exit(1); }
        fs.writeFileSync(idx + '.pre-bosses.bak', html);
        html = html.replace(m[0], m[0] + m[1] + tag + '   <!-- the three bosses (Boss Fight Development) -->\n');
        fs.writeFileSync(idx, html);
    }
    console.log('\nDone. Backups are next to each changed file, as *.pre-bosses.bak');
}
main();
