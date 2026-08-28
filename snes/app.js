(() => {
  "use strict";

  // Plain classic script sharing state via window.<Namespace> globals, same
  // convention as nes/app.js -- see CLAUDE.md. The chrome is hand-drawn
  // PAL Super Nintendo plastic (no vendored kit); this file is the "game"
  // the same way nes/app.js is: which screen is up, D-pad focus, OQ!/DECON.
  const { loadDictEntries, filterDictEntries, DICT_ATTRIBUTION } = window.OqDictSource;
  const { syllabify } = window.OqHyphenation;
  const { getStoredRootFirst, setStoredRootFirst, createController } = window.OqDecon;

  const SCREENS = {
    boot: document.getElementById("boot-screen"),
    title: document.getElementById("title-screen"),
    menu: document.getElementById("menu-screen"),
    oq: document.getElementById("oq-screen"),
    decon: document.getElementById("decon-screen"),
    klax: document.getElementById("klax-screen"),
    about: document.getElementById("about-screen"),
    gameover: document.getElementById("gameover-screen"),
  };

  const MENU_ORDER = ["oq", "decon", "about", "klax", "quit"];
  const menuButtons = MENU_ORDER.map((id) => document.getElementById(`menu-${id}`));
  const continueYes = document.getElementById("continue-yes");
  const continueNo = document.getElementById("continue-no");
  const continueButtons = [continueYes, continueNo];

  const oqFilter = document.getElementById("oq-filter");
  const oqStatus = document.getElementById("oq-status");
  const oqResults = document.getElementById("oq-results");
  const deconWord = document.getElementById("decon-word");
  const deconStatus = document.getElementById("decon-status");
  const deconResults = document.getElementById("decon-results");
  const deconRootFirst = document.getElementById("decon-root-first");

  document.getElementById("oq-attribution").textContent = DICT_ATTRIBUTION;

  const DEFAULT_ROWS = 50;
  const MAX_FILTERED_ROWS = 200;

  let currentScreen = "boot";
  let menuIndex = 0;
  let bootDone = false;
  let bootTimer = 0;
  const BOOT_MS = (navigator.webdriver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) ? 0 : 2200;
  let continueIndex = 0;
  let dictEntries = null;
  let visibleRows = [];
  let selectedIndex = 0;
  // Konami tracker -- title screen only. Contra's 30 lives, not a real
  // unlock: CONTINUE on the game-over screen just goes to the file-select
  // menu. Not listed on the title, same idea as dos/'s undocumented DOOM
  // command and win98/'s Hot Dog Stand scheme.
  const KONAMI = [
    "up", "up", "down", "down", "left", "right", "left", "right", "b", "a",
  ];
  let konamiProgress = 0;

  // Region jumper. PAL dogbone is the default; the NA toaster is the
  // other CIC. Undocumented, same shelf as Konami / Hot Dog Stand.
  const REGION_KEY = "retr-oq:snes-region";
  const shouldersHeld = new Set();

  function getStoredRegion() {
    try {
      return localStorage.getItem(REGION_KEY) === "ntsc" ? "ntsc" : "pal";
    } catch {
      return "pal";
    }
  }

  function applyRegion(region) {
    const ntsc = region === "ntsc";
    document.documentElement.classList.toggle("is-ntsc", ntsc);
    try {
      localStorage.setItem(REGION_KEY, ntsc ? "ntsc" : "pal");
    } catch {
      /* sandboxed iframe -- scheme still applies for this visit */
    }
  }

  function toggleRegion() {
    applyRegion(document.documentElement.classList.contains("is-ntsc") ? "pal" : "ntsc");
    sfx("konami");
  }

  function shoulderDown(side) {
    const was = shouldersHeld.has("l") && shouldersHeld.has("r");
    shouldersHeld.add(side);
    if (!was && shouldersHeld.has("l") && shouldersHeld.has("r")) {
      toggleRegion();
      return true;
    }
    return false;
  }

  function shoulderUp(side) {
    shouldersHeld.delete(side);
  }

  applyRegion(getStoredRegion());

  function showScreen(name) {
    currentScreen = name;
    for (const [key, el] of Object.entries(SCREENS)) {
      el.hidden = key !== name;
    }
    if (name !== "title" && name !== "boot") konamiProgress = 0;
    if (name === "oq") oqFilter.focus();
    else if (name === "decon") deconWord.focus();
    else if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
    syncMusic();
  }

  function setMenuIndex(next) {
    const len = menuButtons.length;
    menuIndex = ((next % len) + len) % len;
    menuButtons.forEach((btn, i) => btn.classList.toggle("is-selected", i === menuIndex));
  }

  function setContinueIndex(next) {
    const len = continueButtons.length;
    continueIndex = ((next % len) + len) % len;
    continueButtons.forEach((btn, i) => btn.classList.toggle("is-selected", i === continueIndex));
  }

  function chooseMenuItem(id) {
    if (id === "quit") {
      location.assign("../");
      return;
    }
    if (id === "oq") {
      window.OqRouter.navigate({ screen: "oq", filter: null, word: null, order: null });
      return;
    }
    if (id === "decon") {
      window.OqRouter.navigate({ screen: "decon", word: null, filter: null });
      return;
    }
    if (id === "klax") {
      window.OqRouter.navigate({ screen: "klax" });
      return;
    }
    if (id === "about") {
      window.OqRouter.navigate({ screen: "about", filter: null, word: null });
    }
  }

  function goTitle() {
    window.OqRouter.navigate({ screen: null, filter: null, word: null, order: null });
  }

  function goMenu() {
    window.OqRouter.navigate({ screen: "menu", filter: null, word: null, order: null });
  }

  function inputFocused() {
    const el = document.activeElement;
    return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
  }

  // SNES S-SMP-ish bed: pitched samples (10.5 kHz hold-upsample, 6-bit
  // crunch), ADSR, hardware echo. Not pulse/triangle NES leftovers and
  // not a ripped Nintendo track. High-paced -- 168 BPM, the kind of
  // tempo the 8-channel sampler was bought to carry. Silent until the
  // first pad/key gesture (autoplay policy). Typing in SEARCH/WORD
  // stays silent on purpose.
  let audioCtx = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let echoIn = null;
  let samples = null;
  let musicTrack = null;
  let musicGen = 0;
  let musicNext = 0;
  let musicTimer = 0;
  let musicStep = 0;
  const BPM = 168;
  const SIXTEENTH = 60 / BPM / 4;
  const BASS0 = 110;
  const LEAD0 = 440;
  const BRASS0 = 220;

  function unlockAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!audioCtx) {
        try {
          audioCtx = new AC({ latencyHint: "interactive" });
        } catch (err) {
          audioCtx = new AC();
        }
        buildGraph();
        samples = buildSamples(audioCtx);
      }
      if (audioCtx.state === "suspended") audioCtx.resume();
      // Always (re)attach the bed for the current screen -- an earlier
      // version silenced everything that wasn't the title, which is why
      // bloops/music died the moment PRESS START landed on the menu.
      syncMusic();
      return audioCtx;
    } catch (err) {
      return null;
    }
  }

  function buildGraph() {
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.85;
    masterGain.connect(audioCtx.destination);

    const echoFilter = audioCtx.createBiquadFilter();
    echoFilter.type = "lowpass";
    echoFilter.frequency.value = 3200;
    echoFilter.Q.value = 0.4;
    const delay = audioCtx.createDelay(0.4);
    delay.delayTime.value = 0.148;
    const echoFb = audioCtx.createGain();
    echoFb.gain.value = 0.42;
    echoIn = audioCtx.createGain();
    echoIn.gain.value = 1;
    echoIn.connect(delay);
    delay.connect(echoFilter);
    echoFilter.connect(echoFb);
    echoFb.connect(delay);
    echoFilter.connect(masterGain);

    const air = audioCtx.createBiquadFilter();
    air.type = "lowpass";
    air.frequency.value = 11000;
    air.connect(masterGain);

    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.0001;
    musicGain.connect(air);
    const musicEcho = audioCtx.createGain();
    musicEcho.gain.value = 0.55;
    musicGain.connect(musicEcho);
    musicEcho.connect(echoIn);

    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = 0.7;
    sfxGain.connect(air);
    const sfxEcho = audioCtx.createGain();
    sfxEcho.gain.value = 0.28;
    sfxGain.connect(sfxEcho);
    sfxEcho.connect(echoIn);
  }

  function crunch(x) {
    return Math.round(Math.max(-1, Math.min(1, x)) * 40) / 40;
  }

  function makeToneSample(ctx, seconds, render) {
    const sr = ctx.sampleRate;
    const srcRate = 10547;
    const srcN = Math.max(2, Math.floor(srcRate * seconds));
    const src = new Float32Array(srcN);
    for (let i = 0; i < srcN; i++) src[i] = crunch(render(i / srcRate));
    const n = Math.max(2, Math.floor(sr * seconds));
    const buf = ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const t = (i * srcRate) / sr;
      const j = Math.min(srcN - 2, Math.floor(t));
      const f = t - j;
      d[i] = src[j] * (1 - f) + src[j + 1] * f;
    }
    return buf;
  }

  function buildSamples(ctx) {
    const bass = makeToneSample(ctx, 0.45, (t) => {
      let s = 0;
      for (let h = 1; h <= 7; h++) s += Math.sin(2 * Math.PI * BASS0 * h * t) / h;
      return s * 0.45 * Math.exp(-t * 6.5);
    });
    const lead = makeToneSample(ctx, 0.28, (t) => {
      const duty = t % (1 / LEAD0) < 0.35 / LEAD0 ? 1 : -1;
      const saw = 2 * ((LEAD0 * t) % 1) - 1;
      return (duty * 0.55 + saw * 0.2) * Math.exp(-t * 9);
    });
    const brass = makeToneSample(ctx, 0.32, (t) => {
      const a = Math.sin(2 * Math.PI * BRASS0 * t);
      const b = Math.sin(2 * Math.PI * BRASS0 * 2 * t) * 0.4;
      const c = Math.sin(2 * Math.PI * BRASS0 * 3 * t) * 0.18;
      return (a + b + c) * 0.5 * Math.exp(-t * 7);
    });
    const kick = makeToneSample(ctx, 0.22, (t) => {
      const f = 150 * Math.exp(-t * 22);
      return Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 14);
    });
    const snare = makeToneSample(ctx, 0.16, (t) => {
      const n = (Math.random() * 2 - 1) * Math.exp(-t * 22);
      const tone = Math.sin(2 * Math.PI * 196 * t) * Math.exp(-t * 18);
      return n * 0.7 + tone * 0.35;
    });
    const hat = makeToneSample(ctx, 0.05, (t) => {
      return (Math.random() * 2 - 1) * Math.exp(-t * 70);
    });
    return { bass, lead, brass, kick, snare, hat };
  }

  function playSample(buf, when, dur, peak, dest, rate) {
    if (!buf || !audioCtx) return;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.setValueAtTime(rate || 1, when);
    const g = audioCtx.createGain();
    g.connect(dest);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(g);
    src.onended = () => {
      try { src.disconnect(); g.disconnect(); } catch (err) { /* already gone */ }
    };
    src.start(when);
    src.stop(when + dur + 0.03);
  }

  function sfx(kind) {
    const ctx = unlockAudio();
    if (!ctx || !sfxGain || !samples) return;
    const t = ctx.currentTime + 0.01;
    const dest = sfxGain;
    if (kind === "move") {
      playSample(samples.hat, t, 0.05, 0.55, dest, 1.6);
      playSample(samples.lead, t, 0.07, 0.35, dest, 392 / LEAD0);
    } else if (kind === "ok") {
      playSample(samples.lead, t, 0.1, 0.55, dest, 523.25 / LEAD0);
      playSample(samples.lead, t + 0.05, 0.14, 0.5, dest, 783.99 / LEAD0);
      playSample(samples.brass, t, 0.16, 0.4, dest, 261.63 / BRASS0);
    } else if (kind === "back") {
      playSample(samples.lead, t, 0.09, 0.4, dest, 330 / LEAD0);
      playSample(samples.bass, t + 0.05, 0.14, 0.45, dest, 98 / BASS0);
    } else if (kind === "start") {
      playSample(samples.brass, t, 0.12, 0.5, dest, 196 / BRASS0);
      playSample(samples.lead, t + 0.06, 0.1, 0.5, dest, 523.25 / LEAD0);
      playSample(samples.lead, t + 0.13, 0.1, 0.5, dest, 659.25 / LEAD0);
      playSample(samples.lead, t + 0.2, 0.18, 0.55, dest, 880 / LEAD0);
      playSample(samples.kick, t, 0.16, 0.7, dest, 1);
    } else if (kind === "boot") {
      playSample(samples.snare, t, 0.12, 0.45, dest, 0.7);
      playSample(samples.bass, t + 0.05, 0.28, 0.5, dest, 82 / BASS0);
      playSample(samples.brass, t + 0.16, 0.16, 0.45, dest, 196 / BRASS0);
      playSample(samples.lead, t + 0.28, 0.14, 0.5, dest, 392 / LEAD0);
      playSample(samples.lead, t + 0.4, 0.22, 0.55, dest, 523.25 / LEAD0);
    } else if (kind === "konami") {
      const seq = [523.25, 659.25, 783.99, 1046.5, 783.99, 1318.5];
      seq.forEach((f, i) => {
        playSample(samples.lead, t + i * 0.06, 0.1, 0.5, dest, f / LEAD0);
      });
    }
  }

  // Original 2-bar vamps, 16th grid. Not a licensed track.
  const TITLE_LEAD = [
    659, 0, 784, 880, 0, 880, 1047, 0, 880, 784, 659, 0, 587, 659, 784, 0,
    523, 0, 659, 784, 0, 880, 784, 659, 587, 523, 440, 0, 523, 659, 784, 880,
  ];
  const TITLE_BASS = [
    110, 110, 130.8, 146.8, 164.8, 146.8, 130.8, 110,
    98, 98, 110, 123.5, 130.8, 146.8, 164.8, 110,
  ];
  const TITLE_BRASS = [
    0, 0, 0, 0, 261.6, 0, 0, 0, 0, 0, 0, 0, 329.6, 0, 0, 0,
    0, 0, 0, 0, 220, 0, 0, 0, 0, 0, 0, 0, 196, 0, 261.6, 0,
  ];
  const MENU_LEAD = [
    523, 0, 659, 0, 784, 0, 659, 0, 587, 0, 784, 0, 880, 0, 0, 0,
    523, 0, 440, 0, 523, 0, 659, 0, 587, 523, 440, 392, 330, 0, 0, 0,
  ];
  const MENU_BASS = [
    110, 110, 82.4, 82.4, 110, 110, 98, 98,
    130.8, 130.8, 110, 110, 82.4, 82.4, 110, 110,
  ];

  function scheduleStep(track, step, when) {
    if (!samples || !musicGain) return;
    const dest = musicGain;
    const i = step % 32;
    playSample(samples.hat, when, 0.045, i % 2 === 0 ? 0.09 : 0.05, dest, i % 4 === 0 ? 1.15 : 1.4);
    if (i % 4 === 0) playSample(samples.kick, when, 0.14, 0.55, dest, 1);
    if (i % 8 === 4) playSample(samples.snare, when, 0.12, 0.42, dest, 1);
    if (i % 16 === 14) playSample(samples.kick, when, 0.1, 0.35, dest, 1.08);

    if (track === "title") {
      const lead = TITLE_LEAD[i];
      const bass = TITLE_BASS[Math.floor(i / 2) % TITLE_BASS.length];
      const brass = TITLE_BRASS[i];
      if (lead) playSample(samples.lead, when, SIXTEENTH * 1.35, 0.22, dest, lead / LEAD0);
      if (i % 2 === 0) playSample(samples.bass, when, SIXTEENTH * 2.1, 0.32, dest, bass / BASS0);
      if (brass) playSample(samples.brass, when, SIXTEENTH * 2.4, 0.2, dest, brass / BRASS0);
    } else {
      const lead = MENU_LEAD[i];
      const bass = MENU_BASS[Math.floor(i / 2) % MENU_BASS.length];
      if (lead) playSample(samples.lead, when, SIXTEENTH * 1.2, 0.16, dest, lead / LEAD0);
      if (i % 2 === 0) playSample(samples.bass, when, SIXTEENTH * 2.1, 0.28, dest, bass / BASS0);
      if (i % 8 === 0) playSample(samples.brass, when, SIXTEENTH * 3, 0.12, dest, 220 / BRASS0);
    }
  }

  function musicScheduler() {
    if (!audioCtx || !musicTrack) return;
    const gen = musicGen;
    const horizon = audioCtx.currentTime + 0.25;
    while (musicNext < horizon) {
      if (gen !== musicGen) return;
      scheduleStep(musicTrack, musicStep, musicNext);
      musicStep += 1;
      musicNext += SIXTEENTH;
    }
    musicTimer = setTimeout(musicScheduler, 40);
  }

  function trackForScreen(name) {
    if (name === "boot") return null;
    if (name === "title") return "title";
    return "menu";
  }

  function levelForScreen(name) {
    if (name === "title") return 0.22;
    if (name === "menu" || name === "gameover") return 0.18;
    return 0.1;
  }

  function setMusic(track, level) {
    const lvl = level == null ? 0.18 : level;
    if (!audioCtx || !musicGain) return;
    const now = audioCtx.currentTime;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(Math.max(musicGain.gain.value, 0.0001), now);
    if (!track) {
      if (musicTrack !== null) {
        musicTrack = null;
        musicGen += 1;
        if (musicTimer) {
          clearTimeout(musicTimer);
          musicTimer = 0;
        }
      }
      musicGain.gain.linearRampToValueAtTime(0.0001, now + 0.12);
      return;
    }
    musicGain.gain.linearRampToValueAtTime(lvl, now + 0.1);
    if (musicTrack === track) return;
    musicTrack = track;
    musicGen += 1;
    if (musicTimer) {
      clearTimeout(musicTimer);
      musicTimer = 0;
    }
    musicStep = 0;
    musicNext = now + 0.04;
    musicScheduler();
  }

  function syncMusic() {
    if (!audioCtx) return;
    setMusic(trackForScreen(currentScreen), levelForScreen(currentScreen));
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) klaxUpHeld = false;
    if (!audioCtx) return;
    // Only suspend the top-level page. A preview iframe often reports
    // hidden while the user is looking at it, which is what killed the
    // APU the instant PRESS START left the title screen.
    if (document.hidden && window.top === window) audioCtx.suspend();
    else audioCtx.resume();
  });



  // ---------- OQ! (dictionary) ----------
  function renderOqRows(rows) {
    visibleRows = rows;
    oqResults.textContent = "";
    if (rows.length === 0) {
      return;
    }
    if (selectedIndex >= rows.length) selectedIndex = 0;
    rows.forEach((entry, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "oq-row" + (i === selectedIndex ? " is-selected" : "");
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", i === selectedIndex ? "true" : "false");
      // Two lines, same as dos/'s lexeme/translation columns -- a balloon
      // alone hid the gloss under the list (and NES.css's own pixel padding
      // left that balloon ~one line tall). Lexeme on top, English under it.
      const lexeme = document.createElement("span");
      lexeme.className = "oq-lexeme";
      lexeme.textContent = syllabify(entry.lexeme);
      const gloss = document.createElement("span");
      gloss.className = "oq-gloss-line";
      gloss.textContent = entry.gloss_en || "";
      btn.append(lexeme, gloss);
      btn.addEventListener("click", () => {
        selectedIndex = i;
        highlightOqRow();
        sfx("move");
      });
      oqResults.appendChild(btn);
    });
    highlightOqRow();
  }

  function highlightOqRow() {
    const nodes = oqResults.querySelectorAll(".oq-row");
    nodes.forEach((node, i) => {
      const on = i === selectedIndex;
      node.classList.toggle("is-selected", on);
      node.setAttribute("aria-selected", on ? "true" : "false");
      if (on) node.scrollIntoView({ block: "nearest" });
    });
  }

  function renderOqResults() {
    if (dictEntries === null) return;
    const query = oqFilter.value.trim();
    if (query === "") {
      selectedIndex = 0;
      renderOqRows(dictEntries.slice(0, DEFAULT_ROWS));
      oqStatus.textContent = `${dictEntries.length.toLocaleString()} WORDS -- FIRST ${DEFAULT_ROWS}.`;
      return;
    }
    const matches = filterDictEntries(dictEntries, query);
    selectedIndex = 0;
    renderOqRows(matches.slice(0, MAX_FILTERED_ROWS));
    oqStatus.textContent =
      matches.length === 0
        ? "NO MATCHES."
        : matches.length > MAX_FILTERED_ROWS
          ? `FIRST ${MAX_FILTERED_ROWS} OF ${matches.length.toLocaleString()}.`
          : `${matches.length.toLocaleString()} MATCH${matches.length === 1 ? "" : "ES"}.`;
  }

  async function launchOq(initialFilter = "") {
    showScreen("oq");
    oqFilter.value = initialFilter;
    oqResults.textContent = "";
    if (dictEntries === null) {
      oqStatus.textContent = "LOADING...";
      try {
        dictEntries = await loadDictEntries();
      } catch (err) {
        oqStatus.textContent = `LOAD ERROR (${err.message}).`;
        oqFilter.focus();
        return;
      }
    }
    renderOqResults();
    oqFilter.focus();
  }

  // ---------- DECON ----------
  {
    const initialOrder = window.OqRouter.getParams().get("order");
    deconRootFirst.checked = initialOrder ? initialOrder !== "final" : getStoredRootFirst();
  }

  function renderDeconResults({ matches, dictMatch }) {
    deconResults.textContent = "";
    for (const match of matches) {
      const card = document.createElement("div");
      card.className = "nes-container is-dark is-rounded decon-card";

      const header = document.createElement("div");
      const tag = document.createElement("span");
      tag.className = match.approximate ? "decon-tag decon-tag--approximate" : "decon-tag";
      tag.textContent = match.approximate ? "[~ APPROX]" : "[EXACT]";
      const word = document.createElement("span");
      word.className = "decon-word";
      word.textContent = ` ${match.word}`;
      header.append(tag, word);
      card.appendChild(header);

      if (match.meaning) {
        const meaning = document.createElement("div");
        meaning.className = "decon-meaning";
        meaning.textContent = match.meaning;
        card.appendChild(meaning);
      }

      const breakdown = document.createElement("div");
      breakdown.className = "decon-breakdown";
      const rows = deconRootFirst.checked ? match.breakdown : [...match.breakdown].reverse();
      for (const { marker, text, changedRanges, gloss, leftPad, rightPad } of rows) {
        const row = document.createElement("div");
        row.appendChild(document.createTextNode(`${".".repeat(leftPad)}${marker}`));
        let cursor = 0;
        for (const { start, end } of changedRanges) {
          if (start > cursor) row.appendChild(document.createTextNode(text.slice(cursor, start)));
          const changed = document.createElement("span");
          changed.className = "decon-truncated";
          changed.textContent = text.slice(start, end);
          row.appendChild(changed);
          cursor = end;
        }
        if (cursor < text.length) row.appendChild(document.createTextNode(text.slice(cursor)));
        row.appendChild(document.createTextNode(`${".".repeat(rightPad)} - ${gloss}`));
        breakdown.appendChild(row);
      }
      card.appendChild(breakdown);
      deconResults.appendChild(card);
    }

    if (dictMatch) {
      const dictNote = document.createElement("p");
      dictNote.className = "decon-dict-match";
      dictNote.textContent = `IN DICT: ${dictMatch.expected} -- ${dictMatch.gloss_en}`;
      deconResults.appendChild(dictNote);
    }
  }

  const deconController = createController({
    isRootFirst: () => deconRootFirst.checked,
    onStatus: (text) => { deconStatus.textContent = text; },
    onRender: (analysis) => renderDeconResults(analysis),
    onClear: () => { deconResults.textContent = ""; },
  });

  deconRootFirst.addEventListener("change", () => {
    setStoredRootFirst(deconRootFirst.checked);
    deconController.reRenderLast();
    window.OqRouter.navigate({ order: deconRootFirst.checked ? null : "final" }, { replace: true });
  });

  async function launchDecon(initialWord = "") {
    deconController.reset();
    showScreen("decon");
    deconWord.value = initialWord;
    deconStatus.textContent = "TYPE A WORD, PRESS A.";
    deconWord.focus();
    if (initialWord.trim()) await deconController.search(initialWord);
  }

  function exitDecon() {
    deconController.abort();
  }

  // ---------- KAL-Q (Klax, upside down) ----------
  // Game state lives in shared/klax-game.js (window.OqKlaxGame) so it's
  // reusable by any future console theme -- this section is only
  // rendering, input, and pacing, same split as shared/morph-game.js gets
  // from gb/app.js's MORPH! screen. "klax" stays the internal/file-level
  // codename (genre lineage, matches the shared engine's name); KAL-Q is
  // only the on-screen title.
  const klaxCanvas = document.getElementById("klax-canvas");
  const klaxCtx = klaxCanvas.getContext("2d");
  const KLAX_TILE_COLOR = {
    root: "#e7c23f",
    "affix-correct": "#4f9e5c",
    "affix-wrong": "#cf4a3d",
    // Pills get colors from outside the morpheme-tile palette (yellow/
    // green/red) so they read as a different kind of object at a glance.
    "power-lane": "#3f7fd6",
    "power-screen": "#b06fd6",
  };

  // 4x5 bitmap font -- drawn one fillRect per pixel, same technique as the
  // concept-art pass, so canvas text never falls back to anti-aliased
  // browser glyph rendering at this resolution.
  const KLAX_FONT = {
    " ": ["....", "....", "....", "....", "...."],
    ".": ["....", "....", "....", "....", ".#.."],
    "-": ["....", "....", "####", "....", "...."],
    "=": ["....", "####", "....", "####", "...."],
    "0": [".##.", "#..#", "#..#", "#..#", ".##."],
    "1": ["..#.", ".##.", "..#.", "..#.", ".###"],
    "2": [".##.", "#..#", "..#.", ".#..", "####"],
    "3": ["###.", "...#", "..#.", "...#", "###."],
    "4": ["#..#", "#..#", "####", "...#", "...#"],
    "5": ["####", "#...", "###.", "...#", "###."],
    "6": [".##.", "#...", "###.", "#..#", ".##."],
    "7": ["####", "...#", "..#.", ".#..", ".#.."],
    "8": [".##.", "#..#", ".##.", "#..#", ".##."],
    "9": [".##.", "#..#", ".###", "...#", ".##."],
    A: [".##.", "#..#", "####", "#..#", "#..#"],
    B: ["###.", "#..#", "###.", "#..#", "###."],
    C: [".##.", "#...", "#...", "#...", ".##."],
    D: ["###.", "#..#", "#..#", "#..#", "###."],
    E: ["####", "#...", "###.", "#...", "####"],
    F: ["####", "#...", "###.", "#...", "#..."],
    G: [".##.", "#...", "#.##", "#..#", ".##."],
    H: ["#..#", "#..#", "####", "#..#", "#..#"],
    I: [".##.", ".##.", ".##.", ".##.", ".##."],
    J: ["..##", "...#", "...#", "#..#", ".##."],
    K: ["#..#", "#.#.", "##..", "#.#.", "#..#"],
    L: ["#...", "#...", "#...", "#...", "####"],
    M: ["#..#", "####", "####", "#..#", "#..#"],
    N: ["#..#", "##.#", "#.##", "#..#", "#..#"],
    O: [".##.", "#..#", "#..#", "#..#", ".##."],
    P: ["###.", "#..#", "###.", "#...", "#..."],
    Q: [".##.", "#..#", "#..#", ".##.", "...#"],
    R: ["###.", "#..#", "###.", "#.#.", "#..#"],
    S: [".###", "#...", ".##.", "...#", "###."],
    T: ["####", "..#.", "..#.", "..#.", "..#."],
    U: ["#..#", "#..#", "#..#", "#..#", ".##."],
    V: ["#..#", "#..#", "#..#", ".##.", ".##."],
    W: ["#..#", "#..#", "####", "####", "#..#"],
    X: ["#..#", ".##.", ".##.", "#..#", "#..#"],
    Y: ["#..#", ".##.", "..#.", "..#.", "..#."],
    Z: ["####", "...#", "..#.", ".#..", "####"],
  };

  function klaxPx(x, y, w, h, c) {
    klaxCtx.fillStyle = c;
    klaxCtx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function klaxText(str, x, y, scale, color, align) {
    const w = String(str).length * 5 * scale - scale;
    let ox = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    for (const ch of String(str).toUpperCase()) {
      const glyph = KLAX_FONT[ch] || KLAX_FONT[" "];
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 4; col++) {
          if (glyph[row][col] === "#") klaxPx(ox + col * scale, y + row * scale, scale, scale, color);
        }
      }
      ox += 5 * scale;
    }
  }

  function klaxBevel(x, y, w, h, fill, hi, lo) {
    klaxPx(x, y, w, h, fill);
    klaxPx(x, y, w, 1, hi);
    klaxPx(x, y, 1, h, hi);
    klaxPx(x, y + h - 1, w, 1, lo);
    klaxPx(x + w - 1, y, 1, h, lo);
  }

  let klaxGame = null;
  let klaxCol = 0;
  let klaxRaf = 0;
  let klaxLastT = 0;
  // Fast-forward while held (up) -- set true on keydown/pointerdown, false
  // on keyup/pointerup/pointercancel/tab-hide so it can never get stuck on.
  let klaxUpHeld = false;
  const KLAX_FAST_MULT = 2;
  let klaxFlash = 0; // seconds remaining on a match/miss/overflow flash
  let klaxPaused = false;
  // A just-cleared root+affix pair, kept around to draw a pulsing outline
  // over their old cells for a second instead of the pair just vanishing
  // the instant tryMatch() splices them out of the real stacks.
  let klaxMatchAnim = null;
  const KLAX_MATCH_ANIM_S = 1;

  const KLAX_COLS = 4;
  // Klax's bin sits at the floor because that's where its tiles fall to.
  // This game flips gravity, so the bin flips with it: the stacking yard
  // is up at the ceiling, right where the rising tiles are headed, and
  // grows DOWN from there as more get placed. The well fills the rest of
  // the screen below it, floor at the bottom where tiles spawn.
  const KLAX_STACK = { x: 20, top: 14, bottom: 78, w: 216 };
  const KLAX_WELL = { x: 20, top: 82, bottom: 210, w: 216 };

  function klaxColumnX(c, region) {
    const colW = region.w / KLAX_COLS;
    return region.x + c * colW + colW / 2;
  }

  function renderKlax() {
    const state = klaxGame.getState();
    klaxCtx.fillStyle = "#0c0d1e";
    klaxCtx.fillRect(0, 0, 256, 224);

    // HUD is drawn first but the paddle/well below it are what were
    // getting clipped off on very wide-but-short browser windows -- see
    // .klax-canvas in style.css (max-height fix) for the actual cause.
    klaxPx(0, 0, 256, 12, "#232551");
    klaxText(`SCORE ${state.score}`, 6, 3, 1, "#efeae0", "left");
    klaxText("KAL-Q", 128, 3, 1, "#e7c23f", "center");
    klaxText(`LIVES ${state.lives}`, 250, 3, 1, "#cf4a3d", "right");

    // Color legend: root (gold) + its correct affix (green) is the only
    // pair that ever clears a lane -- a wrong affix (red) never matches
    // anything, it just costs a paddle slot until discarded. Drawn in the
    // left margin, the one strip beside the stacking yard the layout
    // doesn't already use.
    const legend = [
      { label: "RT", color: KLAX_TILE_COLOR.root },
      { label: "OK", color: KLAX_TILE_COLOR["affix-correct"] },
      { label: "NO", color: KLAX_TILE_COLOR["affix-wrong"] },
    ];
    legend.forEach((item, i) => {
      const ly = KLAX_STACK.top + i * 20;
      klaxBevel(3, ly, 12, 8, item.color, "rgba(255,255,255,.5)", "rgba(0,0,0,.4)");
      klaxText(item.label, 3, ly + 10, 1, item.color, "left");
    });

    // Stacking yard: one lane per source lane, growing DOWN from the
    // ceiling as tiles get placed -- the physical place caught pieces
    // actually go, not an abstract "HOLDING" row.
    const stackColW = KLAX_STACK.w / KLAX_COLS;
    for (let c = 0; c < KLAX_COLS; c++) {
      const cx = klaxColumnX(c, KLAX_STACK);
      const highlighted = state.paddle.length > 0 && klaxCol === c;
      klaxPx(cx - stackColW / 2 + 1, KLAX_STACK.top, stackColW - 2, KLAX_STACK.bottom - KLAX_STACK.top,
        highlighted ? "rgba(231,194,63,.12)" : "rgba(255,255,255,.04)");
      const lane = state.stacks[c];
      const tileH = (KLAX_STACK.bottom - KLAX_STACK.top) / state.stackCap;
      lane.forEach((tile, i) => {
        const ty = KLAX_STACK.top + i * tileH;
        klaxBevel(cx - stackColW / 2 + 3, ty + 1, stackColW - 6, tileH - 2, KLAX_TILE_COLOR[tile.kind], "rgba(255,255,255,.5)", "rgba(0,0,0,.4)");
        klaxText(tile.marker, cx, ty + tileH / 2 - 2, 1, "#14152b", "center");
      });
    }

    // The just-cleared pair: tryMatch() already spliced them out of the
    // real stacks, so this redraws them as ghosts at their old cells with
    // a pulsing outline for KLAX_MATCH_ANIM_S seconds instead of them just
    // popping out of existence.
    if (klaxMatchAnim) {
      const tileH = (KLAX_STACK.bottom - KLAX_STACK.top) / state.stackCap;
      const pulse = 0.5 + 0.5 * Math.sin(klaxMatchAnim.timeLeft * 22);
      for (const cell of klaxMatchAnim.cells) {
        const cx = klaxColumnX(cell.col, KLAX_STACK);
        const ty = KLAX_STACK.top + cell.row * tileH;
        klaxBevel(cx - stackColW / 2 + 3, ty + 1, stackColW - 6, tileH - 2, KLAX_TILE_COLOR[cell.kind], "rgba(255,255,255,.5)", "rgba(0,0,0,.4)");
        klaxText(cell.marker, cx, ty + tileH / 2 - 2, 1, "#14152b", "center");
        klaxCtx.strokeStyle = `rgba(255,255,255,${(0.4 + 0.6 * pulse).toFixed(2)})`;
        klaxCtx.lineWidth = 2;
        klaxCtx.strokeRect(cx - stackColW / 2 + 2, ty, stackColW - 4, tileH);
      }
    }

    // The catch/place line -- floor of the stacking yard, ceiling of the
    // well -- is the one boundary the paddle ever sits on.
    klaxPx(KLAX_WELL.x, KLAX_WELL.top, KLAX_WELL.w, 1, "#e7c23f");
    const wellColW = KLAX_WELL.w / KLAX_COLS;
    klaxPx(KLAX_WELL.x - 2, KLAX_WELL.top, 2, KLAX_WELL.bottom - KLAX_WELL.top, "#4d473c");
    klaxPx(KLAX_WELL.x + KLAX_WELL.w, KLAX_WELL.top, 2, KLAX_WELL.bottom - KLAX_WELL.top, "#4d473c");
    // Column guides -- only one tile is ever in play, so these faint
    // dividers are what tells the player which lane it's rising in.
    for (let c = 1; c < KLAX_COLS; c++) {
      klaxPx(KLAX_WELL.x + c * wellColW, KLAX_WELL.top, 1, KLAX_WELL.bottom - KLAX_WELL.top, "rgba(255,255,255,.08)");
    }

    if (state.active) {
      const cx = klaxColumnX(state.active.col, KLAX_WELL);
      // y=1 lands the tile's vertical CENTER on the paddle line -- the
      // catch and the ceiling line up exactly, so a caught tile visibly
      // stops there instead of drifting past it.
      const ty = KLAX_WELL.bottom - state.active.y * (KLAX_WELL.bottom - KLAX_WELL.top) - 11;
      const color = KLAX_TILE_COLOR[state.active.kind];
      klaxBevel(cx - wellColW / 2 + 3, ty, wellColW - 6, 22, color, "rgba(255,255,255,.55)", "rgba(0,0,0,.4)");
      klaxText(state.active.marker, cx, ty + 8, 1, "#14152b", "center");
    }

    // Paddle: always sits on the catch/place line -- it's the same spot
    // whether it's about to catch a rising tile or about to push a held
    // one up into the highlighted lane above. Only the highlight above
    // moves; the paddle doesn't need to travel between two positions.
    const paddleX = klaxColumnX(klaxCol, KLAX_WELL);
    klaxBevel(paddleX - wellColW / 2 + 2, KLAX_WELL.top - 6, wellColW - 4, 6, "#efeae0", "#ffffff", "#867d6d");
    if (state.paddle.length) {
      // Up to paddleCap small color-coded chips show the whole LIFO
      // stack at a glance (oldest catch on the left); the readable one
      // with its text is the last one caught -- the tile place()/
      // discard() will actually act on next.
      const slotW = (wellColW - 6) / state.paddleCap;
      state.paddle.forEach((tile, i) => {
        const sx = paddleX - wellColW / 2 + 3 + i * slotW;
        klaxPx(sx, KLAX_WELL.top - 10, slotW - 1, 7, KLAX_TILE_COLOR[tile.kind]);
      });
      const top = state.paddle[state.paddle.length - 1];
      klaxBevel(paddleX - wellColW / 2 + 3, KLAX_WELL.top - 24, wellColW - 6, 12, KLAX_TILE_COLOR[top.kind], "rgba(255,255,255,.55)", "rgba(0,0,0,.4)");
      klaxText(top.marker, paddleX, KLAX_WELL.top - 21, 1, "#14152b", "center");
    }

    if (klaxFlash > 0) {
      klaxCtx.fillStyle = "rgba(255,255,255,.12)";
      klaxCtx.fillRect(0, 0, 256, 224);
    }

    if (klaxPaused) {
      klaxCtx.fillStyle = "rgba(10,10,20,.75)";
      klaxCtx.fillRect(0, 0, 256, 224);
      klaxText("PAUSED", 128, 100, 2, "#efeae0", "center");
      klaxText("START=RESUME  B=MENU", 128, 120, 1, "#8a8db8", "center");
    }

    if (state.gameOver) {
      klaxCtx.fillStyle = "rgba(10,10,20,.75)";
      klaxCtx.fillRect(0, 0, 256, 224);
      klaxText("GAME OVER", 128, 96, 2, "#cf4a3d", "center");
      klaxText(`SCORE ${state.score}`, 128, 116, 1, "#efeae0", "center");
      klaxText("A=RETRY  B=MENU", 128, 132, 1, "#8a8db8", "center");
    }
  }

  function klaxLoop(t) {
    // klaxLastT keeps advancing every frame even while paused, so dt
    // doesn't spike on resume -- only the game-state tick() call is
    // skipped, same as gb/'s MORPH! freezing the step timer in place.
    const dt = klaxLastT ? Math.min(0.1, (t - klaxLastT) / 1000) : 0;
    klaxLastT = t;
    if (!klaxPaused) {
      if (klaxFlash > 0) klaxFlash -= dt;
      if (klaxMatchAnim) {
        klaxMatchAnim.timeLeft -= dt;
        if (klaxMatchAnim.timeLeft <= 0) klaxMatchAnim = null;
      }
      const result = klaxGame.tick(dt, klaxCol, klaxUpHeld ? KLAX_FAST_MULT : 1);
      if (result.event === "caught") {
        sfx(result.tile.kind === "power-lane" || result.tile.kind === "power-screen" ? "konami" : "move");
      } else if (result.event === "missed") { klaxFlash = 0.12; sfx("back"); }
    }
    renderKlax();
    klaxRaf = requestAnimationFrame(klaxLoop);
  }

  function stopKlaxLoop() {
    if (klaxRaf) cancelAnimationFrame(klaxRaf);
    klaxRaf = 0;
    klaxLastT = 0;
  }

  function launchKlax() {
    showScreen("klax");
    if (!klaxGame) klaxGame = window.OqKlaxGame.createGame({ puzzles: window.OqMorphPuzzles.puzzles, columns: KLAX_COLS });
    klaxGame.start();
    klaxCol = 0;
    klaxFlash = 0;
    klaxMatchAnim = null;
    klaxUpHeld = false;
    klaxPaused = false;
    stopKlaxLoop();
    klaxRaf = requestAnimationFrame(klaxLoop);
  }

  function exitKlax() {
    stopKlaxLoop();
    klaxUpHeld = false;
    klaxPaused = false;
  }

  function handleKlaxInput(action) {
    const state = klaxGame.getState();
    if (state.gameOver) {
      if (action === "a" || action === "start") { sfx("ok"); klaxGame.start(); }
      else if (action === "b") { sfx("back"); goMenu(); }
      return;
    }
    if (klaxPaused) {
      if (action === "start") resumeKlax();
      else if (action === "b") { resumeKlax(); sfx("back"); goMenu(); }
      return;
    }
    if (action === "start") { pauseKlax(); return; }
    // Left/right always just move the paddle -- what that means depends on
    // whether the catcher is empty-handed (lining up under the rising
    // tile) or carrying one (choosing a stacking lane to place it in).
    if (action === "left") { sfx("move"); klaxCol = (klaxCol - 1 + KLAX_COLS) % KLAX_COLS; }
    else if (action === "right") { sfx("move"); klaxCol = (klaxCol + 1) % KLAX_COLS; }
    else if (action === "a") {
      if (!state.paddle.length) return;
      const res = klaxGame.place(klaxCol);
      if (res.event === "match") { klaxFlash = 0.12; klaxMatchAnim = { cells: res.cells, timeLeft: KLAX_MATCH_ANIM_S }; sfx("ok"); }
      else if (res.event === "power-screen") { klaxFlash = 0.25; sfx("konami"); }
      else if (res.event === "power-lane") { klaxFlash = 0.16; sfx("ok"); }
      else if (res.event === "discarded") { sfx("back"); }
      else if (res.placed) { sfx("move"); }
      else { sfx("back"); }
    } else if (action === "down") {
      klaxGame.discard();
      sfx("back");
    } else if (action === "b") {
      sfx("back");
      goMenu();
    }
  }

  // Start pauses mid-round, same as gb/'s MORPH! -- freezes the well and
  // paddle exactly where they stood and puts up a blocking card, with its
  // own distinct music (the title theme, not the in-round bed) so it's
  // unmistakably a different state, not just a quiet moment.
  function pauseKlax() {
    if (klaxPaused || klaxGame.getState().gameOver) return;
    klaxPaused = true;
    sfx("start");
    setMusic("title", levelForScreen("title"));
  }

  function resumeKlax() {
    if (!klaxPaused) return;
    klaxPaused = false;
    sfx("start");
    syncMusic();
  }

  function finishBoot() {
    if (bootDone) return;
    bootDone = true;
    if (bootTimer) {
      clearTimeout(bootTimer);
      bootTimer = 0;
    }
    showScreen("title");
  }

  function startBoot() {
    if (bootDone) {
      showScreen("title");
      return;
    }
    if (currentScreen === "boot" && bootTimer) return;
    showScreen("boot");
    if (BOOT_MS === 0) {
      finishBoot();
      return;
    }
    bootTimer = setTimeout(finishBoot, BOOT_MS);
  }

  // window.OqRouter owns "which screen is open", same reasoning as
  // dos/app.js -- every user-facing trigger (D-pad, A/B, click, the
  // on-screen pad) goes through navigate() instead of calling
  // showScreen()/launchOq() directly.
  window.OqRouter.onChange((params) => {
    const screen = params.get("screen");
    if (!screen && !bootDone) {
      startBoot();
      return;
    }
    const dest = screen || "title";
    if (dest === "oq") {
      if (currentScreen !== "oq" || SCREENS.oq.hidden) {
        launchOq(params.get("filter") || "");
      } else if (oqFilter.value !== (params.get("filter") || "")) {
        oqFilter.value = params.get("filter") || "";
        renderOqResults();
      }
    } else if (dest === "decon") {
      const orderParam = params.get("order");
      const rootFirst = orderParam ? orderParam !== "final" : getStoredRootFirst();
      if (deconRootFirst.checked !== rootFirst) {
        deconRootFirst.checked = rootFirst;
        deconController.reRenderLast();
      }
      if (currentScreen !== "decon" || SCREENS.decon.hidden) {
        launchDecon(params.get("word") || "");
      } else if (deconWord.value !== (params.get("word") || "")) {
        deconWord.value = params.get("word") || "";
        deconController.search(deconWord.value);
      }
    } else if (dest === "klax") {
      if (currentScreen === "decon") exitDecon();
      if (currentScreen !== "klax" || SCREENS.klax.hidden) launchKlax();
    } else if (dest === "menu" || dest === "about" || dest === "gameover" || dest === "title") {
      if (currentScreen === "decon") exitDecon();
      if (currentScreen === "klax") exitKlax();
      bootDone = true;
      showScreen(dest);
    } else {
      if (currentScreen === "decon") exitDecon();
      if (currentScreen === "klax") exitKlax();
      showScreen("title");
    }
  });

  oqFilter.addEventListener("input", () => {
    renderOqResults();
    window.OqRouter.navigate({ filter: oqFilter.value || null }, { replace: true });
  });
  deconWord.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    sfx("ok");
    window.OqRouter.navigate({ screen: "decon", word: deconWord.value || null });
    deconController.search(deconWord.value);
  });

  menuButtons.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      setMenuIndex(i);
      sfx("ok");
      chooseMenuItem(MENU_ORDER[i]);
    });
  });
  continueYes.addEventListener("click", () => { sfx("ok"); goMenu(); });
  continueNo.addEventListener("click", () => { sfx("back"); goTitle(); });
  // One listener on the whole title screen -- PRESS START is inside it, so
  // a second listener on #press-start would fire navigate() twice.
  SCREENS.title.addEventListener("click", () => { sfx("start"); goMenu(); });
  SCREENS.boot.addEventListener("click", () => {
    unlockAudio();
    sfx("boot");
    finishBoot();
  });

  function moveOqSelection(delta) {
    if (visibleRows.length === 0) return;
    selectedIndex = (selectedIndex + delta + visibleRows.length) % visibleRows.length;
    highlightOqRow();
  }

  function handleInput(action) {
    unlockAudio();
    if (currentScreen === "boot") {
      sfx("boot");
      finishBoot();
      return;
    }
    if (currentScreen === "title") {
      if (action === "up" || action === "down" || action === "left" || action === "right" || action === "b" || action === "a") {
        if (KONAMI[konamiProgress] === action) {
          konamiProgress += 1;
          if (konamiProgress === KONAMI.length) {
            konamiProgress = 0;
            sfx("konami");
            window.OqRouter.navigate({ screen: "gameover" });
            return;
          }
          sfx("move");
        } else {
          konamiProgress = KONAMI[0] === action ? 1 : 0;
        }
      }
      if (action === "start") {
        konamiProgress = 0;
        sfx("start");
        goMenu();
        return;
      }
      if (action === "select") {
        return;
      }
      if (action === "a" && konamiProgress === 0) {
        sfx("start");
        goMenu();
      }
      return;
    }

    if (currentScreen === "menu") {
      if (action === "up") { sfx("move"); setMenuIndex(menuIndex - 1); }
      else if (action === "down" || action === "select") { sfx("move"); setMenuIndex(menuIndex + 1); }
      else if (action === "a" || action === "start") { sfx("ok"); chooseMenuItem(MENU_ORDER[menuIndex]); }
      else if (action === "b") { sfx("back"); goTitle(); }
      return;
    }

    if (currentScreen === "gameover") {
      if (action === "up" || action === "down" || action === "select") {
        sfx("move");
        const dir = action === "up" ? -1 : 1;
        setContinueIndex(continueIndex + dir);
      } else if (action === "a" || action === "start") {
        sfx("ok");
        if (continueIndex === 0) goMenu();
        else goTitle();
      } else if (action === "b") { sfx("back"); goTitle(); }
      return;
    }

    if (currentScreen === "about") {
      if (action === "b" || action === "start" || action === "a") { sfx("back"); goMenu(); }
      return;
    }

    if (currentScreen === "oq") {
      if (action === "b") {
        sfx("back");
        goMenu();
        return;
      }
      if (action === "up" || action === "down") {
        if (inputFocused() && action === "down") {
          oqFilter.blur();
          moveOqSelection(0);
          sfx("move");
          return;
        }
        if (!inputFocused()) {
          sfx("move");
          moveOqSelection(action === "down" ? 1 : -1);
        }
      }
      return;
    }

    if (currentScreen === "decon") {
      if (action === "b") {
        sfx("back");
        goMenu();
        return;
      }
      if (action === "a" && !inputFocused()) {
        sfx("ok");
        window.OqRouter.navigate({ screen: "decon", word: deconWord.value || null });
        deconController.search(deconWord.value);
      }
      return;
    }

    if (currentScreen === "klax") {
      handleKlaxInput(action);
      return;
    }
  }

  document.addEventListener("keydown", (event) => {
    const keyMap = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      Escape: "b",
      Enter: "a",
      " ": "start",
      Tab: "select",
    };
    // Physical A/B only when not typing -- otherwise the letter "a" in
    // SEARCH would confirm the menu. Emulator convention (Z=B, X=A) is
    // the other path, also gated on !inputFocused.
    if (!inputFocused()) {
      if (event.key === "z" || event.key === "Z") keyMap[event.key] = "b";
      if (event.key === "x" || event.key === "X") keyMap[event.key] = "a";
      if (event.key === "y" || event.key === "Y") keyMap[event.key] = "b";
      if (event.key === "a" || event.key === "A") keyMap[event.key] = "a";
      if (event.key === "b" || event.key === "B") keyMap[event.key] = "b";
    }
    if (!event.repeat) {
      const isL = event.key === "Tab" || event.key === "l" || event.key === "L";
      const isR = event.key === " " || event.key === "r" || event.key === "R";
      if (!inputFocused() && (isL || isR)) {
        if (shoulderDown(isL ? "l" : "r")) {
          event.preventDefault();
          return;
        }
        if (event.key === "l" || event.key === "L" || event.key === "r" || event.key === "R") {
          event.preventDefault();
          return;
        }
      }
    }
    const action = keyMap[event.key];
    if (!action) return;
    if (inputFocused() && action === "select") return;
    if (inputFocused() && (action === "up" || action === "down" || action === "left" || action === "right" || action === "a" || action === "start")) {
      // Let the caret move / Enter submit DECON. Down from OQ's filter
      // still hops to the list.
      if (currentScreen === "oq" && action === "down") {
        event.preventDefault();
        handleInput("down");
        return;
      }
      if (currentScreen === "decon" && action === "a") return;
      if (currentScreen === "oq") return;
      if (currentScreen === "decon") return;
    }
    if (action === "up" && currentScreen === "klax" && !inputFocused()) klaxUpHeld = true;
    if (!inputFocused()) event.preventDefault();
    handleInput(action);
  });

  document.addEventListener("keyup", (event) => {
    if (event.key === "Tab" || event.key === "l" || event.key === "L") shoulderUp("l");
    if (event.key === " " || event.key === "r" || event.key === "R") shoulderUp("r");
    if (event.key === "ArrowUp") klaxUpHeld = false;
  });

  document.getElementById("snes-controller").addEventListener("pointerdown", (event) => {
    const btn = event.target.closest("[data-input]");
    if (!btn) return;
    event.preventDefault();
    const raw = btn.dataset.input;
    if (raw === "l" || raw === "r") {
      try { btn.setPointerCapture(event.pointerId); } catch (err) { /* old browser */ }
      if (shoulderDown(raw)) return;
    }
    // Face diamond extras: X confirms like A, Y backs out like B.
    // Shoulders: L cycles (Select), R starts. Convenience mapping, not
    // a second set of verbs -- handleInput() still only sees the six
    // actions nes/ uses.
    const alias = { x: "a", y: "b", l: "select", r: "start" };
    const resolved = alias[raw] || raw;
    if (resolved === "up" && currentScreen === "klax") klaxUpHeld = true;
    handleInput(resolved);
  });
  window.addEventListener("pointerup", (event) => {
    const btn = event.target && event.target.closest && event.target.closest("[data-input]");
    const raw = (btn && btn.dataset.input) || "";
    if (raw === "l" || raw === "r") shoulderUp(raw);
    if (raw === "up") klaxUpHeld = false;
  });
  window.addEventListener("pointercancel", () => {
    klaxUpHeld = false;
    shoulderUp("l");
    shoulderUp("r");
  });

  // Same visualViewport tracking as dos/app.js / c64/app.js -- a mobile
  // keyboard shrinks the visual viewport without shrinking position:fixed
  // elements, so the pad would sit under the keyboard without this.
  function syncAppHeight() {
    const vv = window.visualViewport;
    if (!vv) return;
    document.documentElement.style.setProperty("--app-height", `${vv.height}px`);
    document.documentElement.style.setProperty("--app-top", `${vv.offsetTop}px`);
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncAppHeight);
    window.visualViewport.addEventListener("scroll", syncAppHeight);
  }
  window.addEventListener("orientationchange", syncAppHeight);
  window.addEventListener("pageshow", syncAppHeight);
  syncAppHeight();

  // Hide the on-screen pad while SEARCH/WORD is focused. visualViewport
  // already shrinks the shell above the keyboard; the pad still ate the
  // leftover height, and iOS's input-zoom made that leftover a giant
  // D-pad with the field off-screen. focusin/out covers hardware and
  // on-screen keyboards; the 16px input floor in style.css stops the zoom.
  function syncKeyboardChrome() {
    const on = inputFocused();
    document.documentElement.classList.toggle("is-keyboard", on);
    if (!on) return;
    const el = document.activeElement;
    requestAnimationFrame(() => {
      if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }
  document.addEventListener("focusin", syncKeyboardChrome);
  document.addEventListener("focusout", () => {
    setTimeout(syncKeyboardChrome, 0);
  });
  // launchOq/launchDecon focus the field during router onChange, which
  // ran before these listeners existed -- catch that initial focus so a
  // deep link into OQ! doesn't leave the pad up under the keyboard.
  syncKeyboardChrome();
})();
