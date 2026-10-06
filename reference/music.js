/* ═══════════════════════════════════════════════════════════════════════════
   music.js — THE SOUND DIRECTOR (2026-09-26)

   The game's sound IS the owner's approved soundtrack now: `soundtrack.js`, copied
   into the build byte for byte by tools/sync_soundtrack.js from
   Graphics+Docs/Sound Prototype ("all sounds are approved"). ⛔ Owner rules: the
   prototype is not edited to wire it in, and each sound is used exactly as made —
   no volume, tempo or fade changes here. `window.Soundtrack` is its whole surface.

   This file only DECIDES what plays. Two parts:
     GameMusic  — which cue is sounding. Every second-by-second choice is derived
                  from what is on screen (the title, a transmission, the pause menu,
                  an encounter, the chapter), so a close path that forgets to say
                  "stop" cannot leave the wrong music running. The EVENTS table is the
                  prototype's COVERAGE rows for music, each paired with the one thing
                  in the game that says the event is live.
     GameSound  — one-shots: `GameSound.play('stinger:eventWin')`, `'sfx:birdCatch'`.
                  The id is the prototype's own COVERAGE vocabulary, so the build can be
                  checked against that table (qa_soundtrack).

   It replaces the old procedural engine that lived here (V1.20.9.4, eight sine-wave
   phases). The public GameMusic methods kept their names, so no caller changed:
   setPhase / tick / lorePush / loreRestore / pausePush / pauseRestore /
   prestigeFanfare / crashCut / crashRestore / onSoundToggle.
   ═══════════════════════════════════════════════════════════════════════════ */

const GameMusic = (() => {
    'use strict';

    const ST = () => window.Soundtrack || null;
    const TICK_MS = 250;           // re-derive the cue four times a second — ~30 cheap reads
    const CRASH_DREAD_MS = 600;    // the cut, then silence, then the hung machine (the owner's "split second of dread")
    const LINGER_MS = 1500;        // an event cue outlives its signal this long, so a flicker never restarts it

    let _timer = null;
    let _playing = null;           // the cue this director last asked for (null = silence)
    let _lore = null;              // the cue for the transmission on screen
    let _pause = false;
    let _crashAt = 0;              // wall clock of the crash cut; 0 = no crash
    let _silentSince = 0;          // when the director last went quiet (for the idle suspend below)
    const IDLE_SUSPEND_MS = 10000; // quiet this long, with no one-shot either, and the audio engine is paused
    const _holds = new Set();      // anything that needs the game silent (the street view carries its own sound)
    let _over = null;   // { key, cue }: see override()
    const _since = {}, _lastLive = {};

    const _shown = id => { const e = document.getElementById(id); return !!e && !!e.style.display && e.style.display !== 'none'; };
    const _loreShown = () => { const e = document.getElementById('lore-cutscene'); return !!e && e.classList.contains('active') && e.style.display !== 'none'; };
    const _geq = id => () => GlobalEventQueue.current() === id;
    const _we = id => () => WorldEvents.activeId() === id;

    /* ── THE ENCOUNTERS, WORLD EVENTS AND MODES (COVERAGE, music rows) ──────────────
       [cue, tier, live]. The highest tier wins; within a tier, the most recent start.
       3 = something on screen asking for the player's attention · 2 = a timed world event
       · 1 = a mode the game is in. Below all of them is the chapter's own theme.
       A `live` that throws (its module is not loaded) simply reads as not live. */
    const EVENTS = [
        ['duckTribunal',       3, _geq('duckTribunal')],
        ['nullInterrogation',  3, _geq('nullInterrogation')],
        ['prisonersDilemma',   3, _geq('prisonersDilemma')],
        ['captcha',            3, _geq('captcha')],
        ['existentialCrisis',  3, _geq('existentialCrisis')],
        ['severance',          3, _geq('ransomProtocol')],
        ['anomalyBoss',        3, () => AnomalyBoss._active],
        ['duckyCouncil',       3, () => DuckyCouncil.isActive()],
        ['minigameDecoy',      3, () => MinigameDecoy.isActive()],
        ['bios',               3, () => BIOSLayer.isActive()],
        ['quarantine',         3, () => _shown('quarantine-overlay')],
        ['echoProbe',          3, () => _shown('echo-probe-overlay')],
        ['wipeProtocol',       3, () => InterceptedSignals.isWiping()],
        ['memoryLeak',         3, () => MemoryLeakBoss.isActive()],
        ['firewallBoss',       3, () => FirewallBoss.isActive()],
        ['expedition',         3, () => !!document.getElementById('expedition-choice-overlay')],
        ['quantumSurge',       2, _we('surge')],
        ['dataStorm',          2, _we('storm')],
        ['walkerStrike',       2, _we('strike')],
        ['momentumCascade',    2, _we('momentum_cascade')],
        ['corruptPacket',      2, _we('corrupt_packet')],
        ['timeFreeze',         2, _we('time_freeze')],
        ['memoryPurge',        2, _we('memory_purge')],
        ['eyeOfStorm',         2, _geq('eyeOfStorm')],
        ['duckRansom',         2, () => DuckRansom.isActive()],
        ['autoRebellion',      2, () => AutoRebellion.isStriking()],
        ['redline',            1, () => /^(ARMING|ACTIVE)$/.test(RedlineMechanic.getPhase())],
        ['overdrive',          1, () => OverdriveMode.isActive()],
        ['controlledOverload', 1, () => ControlledOverload.isActive()],
        ['omegaTimeline',      1, () => SimulationSchism.isOmega()],
        ['dampened',           1, () => (typeof CognitiveDampener !== 'undefined' && CognitiveDampener.isActive())
                                        || (typeof CryoStasis !== 'undefined' && CryoStasis.isActive())
                                        || (typeof CognitiveDenial !== 'undefined' && CognitiveDenial.isActive())],
        ['zalgoInversion',     1, () => ZalgoUpgrade.isActive()],
        ['rogueButton',        1, () => RogueUI.isActive()],
        ['nullTab',            1, () => NullTab.isPresent()],
    ];

    /* The player's own switch (Settings → SOUND). Read live, so a saved OFF is silent from the
       first frame — the old engine only heard about it when the toggle was pressed. */
    function _enabled() {
        try { return typeof Settings === 'undefined' || !Settings._prefs || Settings._prefs.sound !== false; }
        catch (e) { return true; }
    }
    const _inGame = () => document.body.classList.contains('game-active');
    /* the chapter the world is dressed in — body[data-lore-phase], set by _applyLorePhaseTheme,
       which waits for a transmission to close, so the music turns with the colours */
    function _chapter() {
        const p = +(document.body.dataset.lorePhase || 0);
        return p >= 0 && p <= 6 ? (p | 0) : 0;
    }

    function _topEvent() {
        const t = Date.now();
        let best = null, bt = -1, bs = -1;
        for (let i = 0; i < EVENTS.length; i++) {
            const cue = EVENTS[i][0], tier = EVENTS[i][1];
            let on = false;
            try { on = !!EVENTS[i][2](); } catch (e) {}
            if (on) { if (!_since[cue]) _since[cue] = t; _lastLive[cue] = t; }
            else if (_since[cue] && t - _lastLive[cue] > LINGER_MS) _since[cue] = 0;
            if (_since[cue] && (tier > bt || (tier === bt && _since[cue] > bs))) { best = cue; bt = tier; bs = _since[cue]; }
        }
        return best;
    }

    /* What should be sounding right now. First match wins. */
    function _desired() {
        /* ⭐ NOT silenced when the window is hidden (owner, 2026-09-27: "fix music bug" — alt-tabbing or minimising
           stopped the music). It used to return null on document.hidden, reasoning that a background page's timers
           cannot keep time. Measured with a real minimised window (tools/probe_hidden_music.js): a page that is
           playing audio is exempt from Chromium's background timer throttling, so the scheduler keeps time. */
        if (!_enabled()) return null;
        /* a screen that asks for one cue for a while (the street view plays the boot music while it starts, review
           2026-09-27 §15) outranks the holds: it is asked for on purpose and taken back by name */
        if (_over) return _over.cue;
        if (_holds.size) return null;
        if (_crashAt) return (Date.now() - _crashAt < CRASH_DREAD_MS) ? null : 'fakeCrash';
        if (_shown('boot-sequence')) return 'boot';
        /* ⚠ the lore and pause flags only count while their screen is really up. Quitting from the pause menu never
           called pauseRestore, so the title — and the next game — played the pause music (qa_home_panels §5 caught it). */
        if (_lore && _loreShown()) return _lore;
        if (_pause && _shown('pause-overlay')) return 'pause';
        if (_shown('prestige-overlay')) return 'prestige';
        if (_shown('run-spec-modal') || _shown('run-mutation-modal')) return 'runLaws';
        if (!_inGame()) return 'menu';
        return _topEvent() || ('phase' + _chapter());
    }

    function _resolve() {
        const S = ST();
        if (!S) return;
        let want = null;
        try { want = _desired(); } catch (e) {}
        try {
            /* instability is not a track: it is fed to the phase themes, which speed up, detune and grow a
               heartbeat on their own (screens and events ignore it) */
            const inGame = _inGame();
            S.setIntensity(inGame && typeof state !== 'undefined' ? Math.max(0, Math.min(1, (state.instability || 0) / 100)) : 0);
            if (inGame) S.setSfxPhase(_chapter());           // the click kit and interface tint follow the chapter
        } catch (e) {}
        if (want === null) {
            if (_playing !== null) { S.stop(); _playing = null; }
            _idle();
            return;
        }
        _silentSince = 0;
        /* re-ask when the wish changes, or when a stinger that stops music (the crash cut) has left
           nothing sounding */
        if (want !== _playing || !S.nowPlaying()) { ensureMix(); if (S.play(want)) _playing = want; }
    }

    /* ⭐ CPU: an AudioContext keeps rendering its graph (the soundtrack's reverb and echo included) through silence.
       Measured 2026-09-26 with probe_audio_cpu: ~0.4% CPU for a game with sound switched OFF mid-session. After ten
       quiet seconds with no one-shot ringing, the context is suspended; the soundtrack resumes it by itself on the
       next sound it is asked for (its ensure()). The sounds are untouched — only the silence stops being computed. */
    function _idle() {
        const now = Date.now();
        if (!_silentSince) { _silentSince = now; return; }
        if (now - _silentSince < IDLE_SUSPEND_MS || now - GameSound.lastAt() < IDLE_SUSPEND_MS) return;
        const c = GameSound.context();
        if (c && c.state === 'running') { try { c.suspend(); } catch (e) {} }
    }

    /* ⭐ THE MIX — owner, PLAYTEST_REVIEW_2026-09-27 §1: "Background music is too loud — owner had to turn system volume
       down, which then made hover/button SFX inaudible." Measured at the soundtrack's own output tap
       (tools/probe_audio_mix.js): the music's body sat at −14 dBFS while menu clicks peaked 24 dB below it and the hover
       tick 34 dB below — and −14 is exactly where the master compressor starts, so the music was being squeezed all
       the time. The game therefore sets the soundtrack's own BUS levels (Soundtrack.setVolume, the owner's mixing
       control — every sound is untouched): music 0.9 → 0.25 (−11 dB, below the compressor), effects 0.9 → 1.5 (+4.4 dB,
       its ceiling). Stingers are the music's own punctuation, so they come down WITH the music (0.9 → 0.25) — the owner's
       music-to-stinger balance is kept exactly as made; only music against effects changes. They follow the music slider. The player's Music and Effects sliders
       (Settings → SYSTEM → Audio) scale these. */
    const MIX = { music: 0.25, sfx: 1.5, stinger: 0.25 };
    function _vol(key) {
        try { const v = Settings._prefs[key]; return (typeof v === 'number' && isFinite(v)) ? Math.max(0, Math.min(1, v)) : 1; }
        catch (e) { return 1; }
    }
    /* ⚠ NEVER BUILD THE ENGINE JUST TO SET A LEVEL. setVolume creates the AudioContext, and a player with sound saved
       OFF must get none at all (qa_soundtrack R3). So without an engine this only marks the mix as owed, and the first
       sound actually asked for applies it (ensureMix, called just before it plays). */
    let _mixApplied = false;
    function applyVolume(create) {
        const S = ST();
        if (!S || !S.setVolume) return;
        if (!create && !(S.analyser && S.analyser())) { _mixApplied = false; return; }
        _mixApplied = true;
        try {
            S.setVolume('music',   MIX.music   * _vol('musicVol'));
            S.setVolume('stinger', MIX.stinger * _vol('musicVol'));
            S.setVolume('sfx',     MIX.sfx     * _vol('sfxVol'));
        } catch (e) {}
    }

    function ensureMix() { if (!_mixApplied) applyVolume(true); }   // before the first sound, so nothing plays at the old level

    function _start() {
        if (_timer) return;
        _timer = setInterval(_resolve, TICK_MS);
        document.addEventListener('visibilitychange', _resolve);
    }

    return {
        /* Legacy entry points: the phase is derived now, so a name passed here is not needed.
           They start the director and re-derive at once. */
        setPhase() { _start(); _resolve(); },
        tick() { _start(); _resolve(); },

        /* a transmission is on screen — its mood picks one of the prototype's five lore cues */
        lorePush(mood) {
            const S = ST();
            _lore = (mood && S && S.has('cue:lore_' + mood)) ? 'lore_' + mood : 'lore';
            _start(); _resolve();
        },
        loreRestore() { _lore = null; _resolve(); },
        pausePush() { _pause = true; _start(); _resolve(); },
        pauseRestore() { _pause = false; _resolve(); },

        prestigeFanfare() { GameSound.play('stinger:prestigeFanfare'); },

        /* ⭐ THE CRASH (PLAYTEST_REVIEW_2026-09-25 §2): the prototype's Crash cut stinger stops the music dead
           after four slivers of buzz; a beat of silence; then the hung machine (fan, drive, a meaningless beep).
           crashRestore hands the music back to whatever the game is doing. Idempotent both ways. */
        crashCut() {
            if (_crashAt) return;
            _crashAt = Date.now();
            if (_playing !== null) { GameSound.play('stinger:crashCut'); _playing = null; }
            _start(); _resolve();
        },
        crashRestore() {
            if (!_crashAt) return;
            _crashAt = 0;
            _resolve();
        },

        /* anything that needs the game's sound out of the way while it is up — the street view and the owner's
           The End (theend/) each carry their own sound */
        hold(key) { _holds.add(key); _start(); _resolve(); },
        /* override(key, cue) plays that cue until override(key, null); only the key that set it can clear it */
        override(key, cue) { if (cue) _over = { key: key, cue: cue }; else if (_over && _over.key === key) _over = null; _start(); _resolve(); },
        release(key) { _holds.delete(key); _resolve(); },
        held() { return _holds.size > 0; },

        onSoundToggle() { _start(); _resolve(); },
        applyVolume: () => applyVolume(false),         // Settings' Music / Effects sliders (never builds the engine)
        ensureMix,
        _qaMix: () => Object.assign({}, MIX, { musicVol: _vol('musicVol'), sfxVol: _vol('sfxVol') }),

        /* QA (qa_music_phases, qa_soundtrack, qa_review_0925): read-only */
        _qaState() {
            const S = ST(), np = S && S.nowPlaying ? S.nowPlaying() : null;
            let want = null;
            try { want = _desired(); } catch (e) {}
            return { cue: _playing, playing: np ? np.name : null, want, cut: !!_crashAt, lore: _lore,
                     pause: _pause, holds: Array.from(_holds), over: _over ? _over.cue : null, enabled: _enabled(), intensity: S ? S.getIntensity() : 0,
                     chapter: _chapter(), running: !!_timer };
        },
        _qaEvents() { return EVENTS.map(e => ({ cue: e[0], tier: e[1] })); },
    };
})();
window.GameMusic = GameMusic;

/* ═══ GameSound — the one-shots ═══════════════════════════════════════════════
   GameSound.play('sfx:<id>' | 'stinger:<id>', opt) plays the prototype's sound as made.
   Gameplay sounds obey Sounds.isMuted() — the player's switch, the SILENT RUN law, and the
   ending's hush. The few stingers that belong to the music's own story (below) obey only the
   player's switch. While the owner's The End plays, the game's sound is held outright. */
const GameSound = (() => {
    'use strict';
    const MUSIC_OWNED = {
        'stinger:phaseAdvance': 1, 'stinger:prestigeFanfare': 1, 'stinger:crashCut': 1, 'stinger:crashReveal': 1,
        'stinger:loreReveal': 1,
    };
    function _prefOn() {
        try { return typeof Settings === 'undefined' || !Settings._prefs || Settings._prefs.sound !== false; }
        catch (e) { return true; }
    }
    let _lastAt = 0;
    function play(ref, opt) {
        const S = window.Soundtrack;
        if (!S || !_prefOn()) return false;
        if (GameMusic.held()) return false;      // e.g. the street view is up and carries its own sound
        if (!MUSIC_OWNED[ref]) { try { if (window.Sounds && Sounds.isMuted()) return false; } catch (e) {} }
        const i = String(ref).indexOf(':'), kind = ref.slice(0, i), id = ref.slice(i + 1);
        _lastAt = Date.now();
        try { GameMusic.ensureMix(); } catch (e) {}
        try {
            if (kind === 'sfx') return S.sfx(id, opt);
            if (kind === 'stinger') return S.stinger(id);
        } catch (e) {}
        return false;
    }
    /* the soundtrack's AudioContext, once it exists — for resuming it on the first click */
    function context() {
        try { const a = window.Soundtrack && Soundtrack.analyser(); return a ? a.context : null; } catch (e) { return null; }
    }
    return { play, context, lastAt: () => _lastAt };
})();
window.GameSound = GameSound;
