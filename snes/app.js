(() => {
  "use strict";

  // Plain classic script sharing state via window.<Namespace> globals, same
  // convention as nes/app.js -- see CLAUDE.md. The chrome is hand-drawn
  // Super NES plastic (no vendored kit); this file is the "game" the same way
  // nes/app.js is: which screen is up, D-pad focus, OQ!/DECON.
  const { loadDictEntries, filterDictEntries, DICT_ATTRIBUTION } = window.OqDictSource;
  const { syllabify } = window.OqHyphenation;
  const { getStoredRootFirst, setStoredRootFirst, createController } = window.OqDecon;

  const SCREENS = {
    boot: document.getElementById("boot-screen"),
    title: document.getElementById("title-screen"),
    menu: document.getElementById("menu-screen"),
    oq: document.getElementById("oq-screen"),
    decon: document.getElementById("decon-screen"),
    about: document.getElementById("about-screen"),
    gameover: document.getElementById("gameover-screen"),
  };

  const MENU_ORDER = ["oq", "decon", "about", "quit"];
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

  // SNES APU-ish bed, not a sample pack -- two pulse channels with a
  // slight chorus detune (the 16-bit tell), a triangle, and LFSR noise.
  // Same "no real build step" bar as the rest of this theme; nothing here
  // is a ripped Nintendo track. Silent until the first pad/key gesture
  // (autoplay policy). Typing in SEARCH/WORD stays silent on purpose.
  let audioCtx = null;
  let musicGain = null;
  let sfxGain = null;
  let noiseBuf = null;
  const pulseWaves = Object.create(null);
  let musicTrack = null;
  let musicGen = 0;
  let musicNext = 0;
  let musicTimer = 0;
  let musicStep = 0;
  const BPM = 126;
  const SIXTEENTH = 60 / BPM / 4;

  function unlockAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!audioCtx) {
        audioCtx = new AC();
        musicGain = audioCtx.createGain();
        musicGain.gain.value = 0.0001;
        musicGain.connect(audioCtx.destination);
        sfxGain = audioCtx.createGain();
        sfxGain.gain.value = 0.45;
        sfxGain.connect(audioCtx.destination);
        noiseBuf = makeNoiseBuffer(audioCtx);
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

  function pulseWave(duty) {
    const key = String(duty);
    if (pulseWaves[key]) return pulseWaves[key];
    const n = 64;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let i = 1; i < n; i++) {
      real[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
    }
    pulseWaves[key] = audioCtx.createPeriodicWave(real, imag);
    return pulseWaves[key];
  }

  function makeNoiseBuffer(ctx) {
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let reg = 1;
    for (let i = 0; i < len; i++) {
      const bit = (reg ^ (reg >> 1)) & 1;
      reg = (reg >> 1) | (bit << 14);
      data[i] = bit ? 0.55 : -0.55;
    }
    return buf;
  }

  function envGain(dest, when, dur, peak, hold) {
    const g = audioCtx.createGain();
    g.connect(dest);
    const h = hold == null ? 0.012 : hold;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + Math.min(h, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    return g;
  }

  function playPulse(freq, when, dur, peak, duty, dest) {
    if (!freq || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    osc.setPeriodicWave(pulseWave(duty));
    osc.frequency.setValueAtTime(freq, when);
    osc.connect(envGain(dest, when, dur, peak));
    osc.start(when);
    osc.stop(when + dur + 0.02);
    // Chorus twin -- a few cents sharp. That's the 16-bit bed, not a
    // second melody voice.
    const twin = audioCtx.createOscillator();
    twin.setPeriodicWave(pulseWave(duty));
    twin.frequency.setValueAtTime(freq * 1.004, when);
    twin.connect(envGain(dest, when, dur, peak * 0.35));
    twin.start(when);
    twin.stop(when + dur + 0.02);
  }

  function playTriangle(freq, when, dur, peak, dest) {
    if (!freq || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, when);
    const g = audioCtx.createGain();
    g.connect(dest);
    g.gain.setValueAtTime(peak, when);
    g.gain.setValueAtTime(peak, when + dur * 0.85);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  function playNoise(when, dur, peak, dest, playback) {
    if (!audioCtx || !noiseBuf) return;
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.playbackRate.setValueAtTime(playback || 1.4, when);
    src.connect(envGain(dest, when, dur, peak, 0.004));
    src.start(when);
    src.stop(when + dur + 0.02);
  }

  function sfx(kind) {
    const ctx = unlockAudio();
    if (!ctx || !sfxGain) return;
    const t = ctx.currentTime + 0.01;
    const dest = sfxGain;
    if (kind === "move") {
      playPulse(392, t, 0.05, 0.7, 0.125, dest);
      playNoise(t, 0.035, 0.28, dest, 3);
    } else if (kind === "ok") {
      playPulse(523.25, t, 0.08, 0.8, 0.25, dest);
      playPulse(783.99, t + 0.06, 0.12, 0.75, 0.25, dest);
      playTriangle(130.81, t, 0.18, 0.55, dest);
    } else if (kind === "back") {
      playPulse(330, t, 0.08, 0.65, 0.5, dest);
      playPulse(196, t + 0.055, 0.11, 0.55, 0.5, dest);
      playTriangle(98, t, 0.18, 0.45, dest);
    } else if (kind === "start") {
      playPulse(392, t, 0.09, 0.75, 0.25, dest);
      playPulse(523.25, t + 0.08, 0.09, 0.75, 0.25, dest);
      playPulse(659.25, t + 0.16, 0.11, 0.8, 0.25, dest);
      playPulse(784, t + 0.26, 0.2, 0.7, 0.5, dest);
      playTriangle(130.81, t, 0.24, 0.5, dest);
      playTriangle(196, t + 0.16, 0.3, 0.55, dest);
    } else if (kind === "boot") {
      // CRT power-on: noise burst, then a rising chord that is not the
      // Famicom jingle -- original, short.
      playNoise(t, 0.14, 0.55, dest, 0.45);
      playTriangle(82, t + 0.06, 0.35, 0.4, dest);
      playPulse(262, t + 0.18, 0.14, 0.7, 0.5, dest);
      playPulse(330, t + 0.32, 0.14, 0.7, 0.5, dest);
      playPulse(392, t + 0.46, 0.28, 0.8, 0.25, dest);
      playTriangle(131, t + 0.46, 0.35, 0.5, dest);
    } else if (kind === "konami") {
      const seq = [523.25, 659.25, 783.99, 1046.5, 783.99, 1318.5];
      seq.forEach((f, i) => {
        playPulse(f, t + i * 0.07, 0.11, 0.75, 0.25, dest);
        playTriangle(f / 4, t + i * 0.07, 0.13, 0.4, dest);
      });
    }
  }

  // Original 4-bar title / 2-bar menu vamp. Frequencies in Hz, 0 = rest.
  // 16th-note grid. Pulse2 is the same melody delayed two 16ths.
  const TITLE_P1 = [
    659, 0, 659, 784, 0, 784, 1047, 0, 784, 0, 659, 0, 587, 659, 698, 0,
    587, 0, 587, 698, 0, 698, 880, 0, 698, 0, 587, 0, 523, 587, 659, 0,
    523, 0, 523, 659, 0, 659, 784, 0, 659, 0, 523, 0, 392, 523, 659, 784,
    784, 698, 659, 587, 523, 0, 659, 0, 784, 0, 1047, 0, 784, 0, 0, 0,
  ];
  const TITLE_BASS = [
    131, 131, 98, 98, 131, 131, 165, 165, 175, 175, 131, 131, 175, 175, 110, 110,
    131, 131, 98, 98, 110, 110, 87, 87, 98, 98, 147, 147, 131, 131, 131, 131,
  ];
  const MENU_P1 = [
    523, 0, 659, 0, 784, 0, 659, 0, 698, 0, 587, 0, 784, 0, 0, 0,
    523, 0, 392, 0, 523, 0, 659, 0, 587, 523, 392, 330, 262, 0, 0, 0,
  ];
  const MENU_BASS = [
    131, 131, 98, 98, 131, 131, 98, 98, 175, 175, 131, 131, 98, 98, 98, 98,
  ];

  function scheduleStep(track, step, when) {
    const dest = musicGain;
    if (track === "title") {
      const i = step % TITLE_P1.length;
      const p1 = TITLE_P1[i];
      const p2 = TITLE_P1[(i + TITLE_P1.length - 2) % TITLE_P1.length];
      const bass = TITLE_BASS[Math.floor(i / 2) % TITLE_BASS.length];
      playPulse(p1, when, SIXTEENTH * 1.15, 0.22, 0.25, dest);
      playPulse(p2, when, SIXTEENTH * 1.05, 0.09, 0.5, dest);
      if (i % 2 === 0) playTriangle(bass, when, SIXTEENTH * 2.05, 0.2, dest);
      if (i % 4 === 2) playNoise(when, 0.04, 0.045, dest, 2.6);
      if (i % 16 === 0) playNoise(when, 0.07, 0.07, dest, 0.7);
    } else if (track === "menu") {
      const i = step % MENU_P1.length;
      const p1 = MENU_P1[i];
      const bass = MENU_BASS[Math.floor(i / 2) % MENU_BASS.length];
      playPulse(p1, when, SIXTEENTH * 1.1, 0.16, 0.125, dest);
      if (i % 2 === 0) playTriangle(bass, when, SIXTEENTH * 2.05, 0.16, dest);
      if (i % 8 === 4) playNoise(when, 0.035, 0.04, dest, 2.8);
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
    if (name === "title") return 0.2;
    if (name === "menu" || name === "gameover") return 0.16;
    return 0.08;
  }

  function setMusic(track, level) {
    const lvl = level == null ? 0.16 : level;
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
    } else if (dest === "menu" || dest === "about" || dest === "gameover" || dest === "title") {
      if (currentScreen === "decon") exitDecon();
      bootDone = true;
      showScreen(dest);
    } else {
      if (currentScreen === "decon") exitDecon();
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
      if (action === "start" || action === "select") {
        konamiProgress = 0;
        sfx("start");
        goMenu();
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
    if (!inputFocused()) event.preventDefault();
    handleInput(action);
  });

  document.getElementById("snes-controller").addEventListener("pointerdown", (event) => {
    const btn = event.target.closest("[data-input]");
    if (!btn) return;
    event.preventDefault();
    // Face diamond extras: X confirms like A, Y backs out like B.
    // Shoulders: L cycles (Select), R starts. Convenience mapping, not
    // a second set of verbs -- handleInput() still only sees the six
    // actions nes/ uses.
    const alias = { x: "a", y: "b", l: "select", r: "start" };
    handleInput(alias[btn.dataset.input] || btn.dataset.input);
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
