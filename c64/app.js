(() => {
  "use strict";

  // Plain classic script sharing state via window.<Namespace> globals, same
  // convention as dos/app.js -- see that file's own comment and CLAUDE.md.
  const { loadDictEntries, filterDictEntries, DICT_ATTRIBUTION } = window.OqDictSource;
  const { syllabify } = window.OqHyphenation;

  const dirScreen = document.getElementById("c64-dir");
  const dictApp = document.getElementById("dict-app");
  const dictFilter = document.getElementById("dict-filter");
  const dictStatus = document.getElementById("dict-status");
  const dictTbody = document.getElementById("dict-tbody");
  const loadingScreen = document.getElementById("c64-loading");
  const morphApp = document.getElementById("morph-app");

  document.getElementById("dict-attribution").textContent = petsciiSafe(DICT_ATTRIBUTION);

  const DEFAULT_ROWS = 50; // shown before any filtering -- a browsable sample, not a blank table
  const MAX_FILTERED_ROWS = 200; // same ceiling as dos/app.js, same reasoning: 17,000+ entries, never render a full match set

  let dictEntries = null; // null until a load succeeds

  // The real C64 character set (PETSCII) has no en dash, em dash, or
  // ellipsis -- the upstream dictionary data has all three (see
  // shared/dict-source.js's DICT_ATTRIBUTION). Applied here, not upstream,
  // so dos/mac1984 keep the real Unicode punctuation; only c64/ needs the
  // period-accurate downgrade.
  function petsciiSafe(text) {
    return text.replace(/–/g, "-").replace(/—/g, "--").replace(/…/g, "...");
  }

  function renderRows(rows) {
    dictTbody.textContent = "";
    for (const entry of rows) {
      const row = document.createElement("tr");
      const lexemeCell = document.createElement("td");
      // syllabify() -- same reasoning as dos/app.js's identical call: real
      // Kalaallisut syllable boundaries, not wherever overflow-wrap:anywhere
      // happens to break.
      lexemeCell.textContent = petsciiSafe(syllabify(entry.lexeme));
      const glossCell = document.createElement("td");
      glossCell.textContent = petsciiSafe(entry.gloss_en);
      row.append(lexemeCell, glossCell);
      dictTbody.appendChild(row);
    }
  }

  function renderResults() {
    if (dictEntries === null) return; // still loading or failed -- dictStatus already says so

    const query = dictFilter.value.trim();
    if (query === "") {
      renderRows(dictEntries.slice(0, DEFAULT_ROWS));
      dictStatus.textContent = `${dictEntries.length.toLocaleString()} ENTRIES LOADED -- SHOWING FIRST ${DEFAULT_ROWS}, TYPE TO FILTER.`;
      return;
    }

    const matches = filterDictEntries(dictEntries, query);
    renderRows(matches.slice(0, MAX_FILTERED_ROWS));
    dictStatus.textContent =
      matches.length === 0
        ? "NO MATCHES."
        : matches.length > MAX_FILTERED_ROWS
          ? `SHOWING FIRST ${MAX_FILTERED_ROWS} OF ${matches.length.toLocaleString()} MATCHES.`
          : `${matches.length.toLocaleString()} MATCH${matches.length === 1 ? "" : "ES"}.`;
  }

  async function launchDict(initialFilter = "") {
    loadingScreen.hidden = true;
    dirScreen.hidden = true;
    dictApp.hidden = false;
    dictFilter.value = initialFilter;
    dictTbody.textContent = "";

    if (dictEntries === null) {
      dictStatus.textContent = "SEARCHING FOR DICT DAT";
      try {
        dictEntries = await loadDictEntries();
      } catch (err) {
        dictStatus.textContent = `?LOAD ERROR (${err.message}). EXIT AND RELAUNCH TO RETRY.`;
        dictFilter.focus();
        return;
      }
    }
    renderResults();
    dictFilter.focus();
  }

  function exitDict() {
    dictApp.hidden = true;
    dirScreen.hidden = false;
  }

  // ---------- MORPH! (WarioWare-style morpheme minigame, text mode) ----------
  // shared/morph-game.js owns the state machine (puzzle sequencing, lives,
  // score, which option is correct) -- same split gb/app.js uses. There's
  // no room for a D-pad-driven sprite in 40-column text mode, so this
  // renders each step as a numbered BASIC-style option list: press 1-9 (or
  // Up/Down + RETURN) to answer, same input idiom as the command line.
  const morphHud = document.getElementById("morph-hud");
  const morphWordEl = document.getElementById("morph-word");
  const morphStatusEl = document.getElementById("morph-status");
  const morphOptionsEl = document.getElementById("morph-options");
  const morphTimerFill = document.getElementById("morph-timerfill");

  const MORPH_START_LIVES = 3;
  // Same pacing as gb/app.js's identical constant -- long enough to read a
  // Kalaallisut morpheme and its gloss once, short enough to still feel
  // like a WarioWare beat, not an untimed quiz.
  const MORPH_STEP_MS = 6000;
  const morphGame = window.OqMorphGame.createGame({
    puzzles: window.OqMorphPuzzles.puzzles,
    startLives: MORPH_START_LIVES,
  });
  let morphSelected = 0;
  let morphOptionCount = 0;
  let morphBusy = false; // true during the brief shock/win pause -- input ignored, same as gb/app.js
  let morphTimerRaf = 0;
  let morphTimerDeadline = 0;

  function renderMorphHud() {
    const { lives, score } = morphGame.getState();
    morphHud.textContent = ` LIVES ${"*".repeat(lives)}${".".repeat(MORPH_START_LIVES - lives)}  SCORE ${score}`;
  }

  function highlightMorphOptions() {
    const nodes = morphOptionsEl.querySelectorAll(".c64-morph-option");
    nodes.forEach((node, i) => node.classList.toggle("is-selected", i === morphSelected));
  }

  function stopMorphTimer() {
    if (morphTimerRaf) cancelAnimationFrame(morphTimerRaf);
    morphTimerRaf = 0;
  }

  function startMorphTimer() {
    stopMorphTimer();
    morphTimerDeadline = performance.now() + MORPH_STEP_MS;
    const tick = (now) => {
      const remaining = Math.max(0, morphTimerDeadline - now);
      morphTimerFill.style.width = `${(remaining / MORPH_STEP_MS) * 100}%`;
      if (remaining <= 0) {
        morphTimerRaf = 0;
        handleMorphTimeout();
        return;
      }
      morphTimerRaf = requestAnimationFrame(tick);
    };
    morphTimerRaf = requestAnimationFrame(tick);
  }

  // Renders a step handed back by the engine's start()/advanceStep()/
  // advancePuzzle()/retryStep() -- they all return the same { word,
  // stepType, options } shape, same as gb/app.js's renderMorphStep.
  function renderMorphStep(step) {
    morphOptionCount = step.options.length;
    morphSelected = 0;
    morphWordEl.textContent = petsciiSafe(syllabify(step.word)) + "-";
    morphStatusEl.textContent = step.stepType === "suffix" ? "PICK THE ENDING." : "PICK THE NEXT AFFIX.";
    morphOptionsEl.textContent = "";
    step.options.forEach((opt, i) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "c64-morph-option";
      btn.textContent = `${i + 1}. -${petsciiSafe(opt.marker)}`;
      btn.addEventListener("click", () => {
        morphSelected = i;
        highlightMorphOptions();
        chooseMorphOption();
      });
      li.appendChild(btn);
      morphOptionsEl.appendChild(li);
    });
    highlightMorphOptions();
    startMorphTimer();
  }

  function launchMorph() {
    dirScreen.hidden = true;
    morphApp.hidden = false;
    renderMorphHud();
    renderMorphStep(morphGame.start());
  }

  function exitMorph() {
    stopMorphTimer();
    morphApp.hidden = true;
    dirScreen.hidden = false;
  }

  function settleMorphRound(result) {
    // Same "did the player already leave MORPH?" guard as gb/app.js's
    // identical function -- RUN/STOP=EXIT mid-pause shouldn't have a stray
    // timeout yank the player back in seconds later.
    const resumeIfStillOnMorph = (fn) => {
      morphBusy = false;
      if (morphApp.hidden) return;
      fn();
    };
    if (result.outcome === "wrong" || result.outcome === "timeout") {
      morphStatusEl.textContent = result.outcome === "wrong" ? `NOT THERE -- ${result.gloss}` : "TOO SLOW!";
      renderMorphHud();
      setTimeout(() => resumeIfStillOnMorph(() => {
        if (result.gameOver) {
          morphWordEl.textContent = "";
          morphStatusEl.textContent = `GAME OVER -- SCORE ${morphGame.getState().score}. RUN/STOP=EXIT, THEN RUN TO RETRY.`;
          morphOptionsEl.textContent = "";
          morphOptionCount = 0;
          morphTimerFill.style.width = "0%";
          return;
        }
        renderMorphStep(morphGame.retryStep());
      }), 900);
      return;
    }
    if (result.outcome === "win") {
      renderMorphHud();
      morphStatusEl.textContent = `${petsciiSafe(result.word.toUpperCase())} -- ${petsciiSafe(result.resultGloss)}`;
      morphOptionsEl.textContent = "";
      morphOptionCount = 0;
      setTimeout(() => resumeIfStillOnMorph(() => {
        renderMorphStep(morphGame.advancePuzzle());
      }), 2200);
      return;
    }
    // "continue" -- a correct mid-chain affix
    setTimeout(() => resumeIfStillOnMorph(() => {
      renderMorphStep(morphGame.advanceStep());
    }), 350);
  }

  function handleMorphTimeout() {
    if (morphBusy) return;
    morphBusy = true;
    settleMorphRound(morphGame.timeout());
  }

  function chooseMorphOption() {
    if (morphBusy || morphOptionCount === 0) return;
    stopMorphTimer();
    morphBusy = true;
    settleMorphRound(morphGame.choose(morphSelected));
  }

  function moveMorphSelection(delta) {
    if (morphOptionCount === 0) return;
    morphSelected = (morphSelected + delta + morphOptionCount) % morphOptionCount;
    highlightMorphOptions();
  }

  document.getElementById("morph-exit").addEventListener("click", () => {
    window.OqRouter.navigate({ screen: null, filter: null });
  });

  // ---------- KALQ (KAL-Q, the same engine snes/'s port uses) ----------
  // shared/klax-game.js owns the state machine (same split MORPH! above
  // gets from shared/morph-game.js) -- this is only rendering, input, and
  // pacing. Unlike MORPH!'s text-mode option list, this draws a real
  // bitmapped playfield: real C64 software wasn't all BASIC listings, and
  // this repo's snes/app.js already proved the engine is theme-agnostic.
  const kalqApp = document.getElementById("kalq-app");
  const kalqCanvas = document.getElementById("kalq-canvas");
  const kalqCtx = kalqCanvas.getContext("2d");

  // Same reasoning as snes/app.js's identical block: the canvas can't read
  // var(--c64-*) directly, so read the theme's own declared palette once
  // via getComputedStyle instead of inventing hex. c64 has no live
  // palette-swap toggle (unlike snes's NTSC/PAL region jumper), so unlike
  // that file this only needs to run once, not be refreshed later.
  const c64Vars = getComputedStyle(document.documentElement);
  const c64Color = (name) => c64Vars.getPropertyValue(`--c64-${name}`).trim();

  // Colors and layout below follow the real C64 KLAX cabinet, not a
  // generic "pick four palette colors" scheme: black backdrop, a cyan
  // track, green bin walls with a black/white checker trim, a white
  // bracket-frame catch bar, and tiles in yellow/blue/red/cyan/white --
  // green is never a tile color there, it's reserved for the bins.
  const KLAX_C = {
    bg: c64Color("black"),
    hud: c64Color("black"),
    ink: c64Color("black"),
    paper: c64Color("white"),
    accent: c64Color("cyan"),
    bin: c64Color("green"),
  };
  const KLAX_TILE_COLOR = {
    root: c64Color("yellow"),
    "affix-correct": c64Color("blue"),
    "affix-wrong": c64Color("red"),
    "power-lane": c64Color("cyan"),
    "power-screen": KLAX_C.paper,
  };
  function hexToRgbTriplet(hex) {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(full, 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }
  const KLAX_CLEAR_COLOR = {
    match: hexToRgbTriplet(KLAX_C.paper),
    "power-lane": hexToRgbTriplet(KLAX_TILE_COLOR["power-lane"]),
    "power-screen": hexToRgbTriplet(KLAX_TILE_COLOR["power-screen"]),
  };

  // Same 4x5 bitmap font/pixel helpers as snes/app.js's klax section --
  // each console draws its own canvas font privately, no shared module,
  // same precedent that file's own comment sets.
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
    kalqCtx.fillStyle = c;
    kalqCtx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
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
  let klaxUpHeld = false;
  const KLAX_FAST_MULT = 2;
  let klaxFlash = 0;
  let klaxClearAnim = null;
  const KLAX_CLEAR_ANIM_S = 1;

  const KLAX_COLS = 4;
  // Canvas is 320x200 (the real C64 hi-res bitmap resolution) instead of
  // snes/'s 256x224 -- same layout ratios (margins, HUD height, stacking
  // yard vs. well split), just scaled to this theme's own real hardware
  // pixels: x/width by 320/256, y/height by 200/224.
  const KLAX_STACK = { x: 25, top: 13, bottom: 70, w: 270 };
  const KLAX_WELL = { x: 25, top: 73, bottom: 188, w: 270 };

  function klaxColumnX(c, region) {
    const colW = region.w / KLAX_COLS;
    return region.x + c * colW + colW / 2;
  }

  function renderKlax() {
    const state = klaxGame.getState();
    kalqCtx.fillStyle = KLAX_C.bg;
    kalqCtx.fillRect(0, 0, 320, 200);

    kalqCtx.fillStyle = KLAX_C.hud;
    kalqCtx.fillRect(0, 0, 320, 12);
    klaxText(`SCORE ${state.score}`, 6, 3, 1, KLAX_C.paper, "left");
    klaxText("KALQ", 160, 3, 1, KLAX_C.accent, "center");
    klaxText(`LIVES ${state.lives}`, 314, 3, 1, KLAX_TILE_COLOR["affix-wrong"], "right");

    // Color legend -- same reasoning as snes/'s klax-canvas: root+correct
    // is the only pair that ever clears a lane, shown as swatches in the
    // margin the stacking yard doesn't otherwise use.
    const legend = [
      { label: "RT", color: KLAX_TILE_COLOR.root },
      { label: "OK", color: KLAX_TILE_COLOR["affix-correct"] },
      { label: "NO", color: KLAX_TILE_COLOR["affix-wrong"] },
    ];
    legend.forEach((item, i) => {
      const ly = KLAX_STACK.top + i * 20;
      klaxBevel(3, ly, 14, 8, item.color, "rgba(255,255,255,.5)", "rgba(0,0,0,.4)");
      klaxText(item.label, 3, ly + 10, 1, item.color, "left");
    });

    // Bin walls -- green side panels with a black/white checker trim,
    // flanking the stacking yard the same way the real cabinet's bins sit
    // between two green walls (image reference). Drawn before the tiles
    // so the walls read as a frame, not something tiles sit "inside".
    const binWallW = 10;
    const binWallTop = KLAX_STACK.top - 4;
    const binWallH = KLAX_STACK.bottom - binWallTop;
    // [wall x, outer-edge x] -- the checker trim sits on the OUTER edge of
    // each wall (away from the bins), same as the reference cabinet's
    // side panels, not glued to the inner edge facing the tiles.
    for (const [wallX, trimX] of [
      [KLAX_STACK.x - binWallW, KLAX_STACK.x - binWallW],
      [KLAX_STACK.x + KLAX_STACK.w, KLAX_STACK.x + KLAX_STACK.w + binWallW - 4],
    ]) {
      klaxPx(wallX, binWallTop, binWallW, binWallH, KLAX_C.bin);
      for (let y = binWallTop, i = 0; y < KLAX_STACK.bottom; y += 4, i++) {
        klaxPx(trimX, y, 4, 4, i % 2 === 0 ? KLAX_C.paper : KLAX_C.hud);
      }
    }

    const stackColW = KLAX_STACK.w / KLAX_COLS;
    for (let c = 0; c < KLAX_COLS; c++) {
      const cx = klaxColumnX(c, KLAX_STACK);
      const highlighted = state.paddle.length > 0 && klaxCol === c;
      klaxPx(cx - stackColW / 2 + 1, KLAX_STACK.top, stackColW - 2, KLAX_STACK.bottom - KLAX_STACK.top,
        highlighted ? "rgba(191,206,114,.15)" : "rgba(0,0,0,.3)");
      const lane = state.stacks[c];
      const tileH = (KLAX_STACK.bottom - KLAX_STACK.top) / state.stackCap;
      lane.forEach((tile, i) => {
        const ty = KLAX_STACK.top + i * tileH;
        klaxBevel(cx - stackColW / 2 + 3, ty + 1, stackColW - 6, tileH - 2, KLAX_TILE_COLOR[tile.kind], "rgba(255,255,255,.5)", "rgba(0,0,0,.4)");
        klaxText(tile.marker, cx, ty + tileH / 2 - 2, 1, KLAX_C.ink, "center");
      });
    }

    if (klaxClearAnim) {
      const tileH = (KLAX_STACK.bottom - KLAX_STACK.top) / state.stackCap;
      const pulse = 0.5 + 0.5 * Math.sin(klaxClearAnim.timeLeft * 22);
      const rgb = KLAX_CLEAR_COLOR[klaxClearAnim.kind] || KLAX_CLEAR_COLOR.match;
      for (const cell of klaxClearAnim.cells) {
        const cx = klaxColumnX(cell.col, KLAX_STACK);
        const ty = KLAX_STACK.top + cell.row * tileH;
        klaxBevel(cx - stackColW / 2 + 3, ty + 1, stackColW - 6, tileH - 2, KLAX_TILE_COLOR[cell.kind], "rgba(255,255,255,.5)", "rgba(0,0,0,.4)");
        klaxText(cell.marker, cx, ty + tileH / 2 - 2, 1, KLAX_C.ink, "center");
        kalqCtx.strokeStyle = `rgba(${rgb},${(0.4 + 0.6 * pulse).toFixed(2)})`;
        kalqCtx.lineWidth = 2;
        kalqCtx.strokeRect(cx - stackColW / 2 + 2, ty, stackColW - 4, tileH);
      }
    }

    // The track -- a row of faint cyan chute lines down the well, same
    // reading as the reference cabinet's cyan track above the bins (this
    // game's gravity is flipped, so the track sits below the bins instead
    // of above them).
    const wellColW = KLAX_WELL.w / KLAX_COLS;
    for (let y = KLAX_WELL.top + 8; y < KLAX_WELL.bottom; y += 12) {
      klaxPx(KLAX_WELL.x + 4, y, KLAX_WELL.w - 8, 2, "rgba(103,182,189,.5)");
    }
    for (let c = 1; c < KLAX_COLS; c++) {
      klaxPx(KLAX_WELL.x + c * wellColW, KLAX_WELL.top, 1, KLAX_WELL.bottom - KLAX_WELL.top, "rgba(255,255,255,.1)");
    }
    // White bracket frame around the bins -- the catch/place line plus the
    // stacking yard's own left/right/top edges, same white-outline-around-
    // the-bins look the reference cabinet has, instead of a plain line.
    kalqCtx.strokeStyle = KLAX_C.paper;
    kalqCtx.lineWidth = 2;
    kalqCtx.strokeRect(KLAX_STACK.x - 1, KLAX_STACK.top - 1, KLAX_STACK.w + 2, KLAX_STACK.bottom - KLAX_STACK.top + 1);
    klaxPx(KLAX_STACK.x, KLAX_STACK.bottom, KLAX_STACK.w, 2, KLAX_C.paper);

    if (state.active) {
      const cx = klaxColumnX(state.active.col, KLAX_WELL);
      const ty = KLAX_WELL.bottom - state.active.y * (KLAX_WELL.bottom - KLAX_WELL.top) - 10;
      const color = KLAX_TILE_COLOR[state.active.kind];
      klaxBevel(cx - wellColW / 2 + 3, ty, wellColW - 6, 20, color, "rgba(255,255,255,.55)", "rgba(0,0,0,.4)");
      klaxText(state.active.marker, cx, ty + 7, 1, KLAX_C.ink, "center");
    }

    const paddleX = klaxColumnX(klaxCol, KLAX_WELL);
    klaxBevel(paddleX - wellColW / 2 + 2, KLAX_WELL.top - 6, wellColW - 4, 6, KLAX_C.paper, "rgba(255,255,255,.55)", "rgba(0,0,0,.4)");
    if (state.paddle.length) {
      const slotW = (wellColW - 6) / state.paddleCap;
      state.paddle.forEach((tile, i) => {
        const sx = paddleX - wellColW / 2 + 3 + i * slotW;
        klaxPx(sx, KLAX_WELL.top - 10, slotW - 1, 6, KLAX_TILE_COLOR[tile.kind]);
      });
      const top = state.paddle[state.paddle.length - 1];
      klaxBevel(paddleX - wellColW / 2 + 3, KLAX_WELL.top - 22, wellColW - 6, 11, KLAX_TILE_COLOR[top.kind], "rgba(255,255,255,.55)", "rgba(0,0,0,.4)");
      klaxText(top.marker, paddleX, KLAX_WELL.top - 19, 1, KLAX_C.ink, "center");
    }

    if (klaxFlash > 0) {
      kalqCtx.fillStyle = "rgba(255,255,255,.12)";
      kalqCtx.fillRect(0, 0, 320, 200);
    }

    if (state.gameOver) {
      kalqCtx.fillStyle = "rgba(0,0,0,.75)";
      kalqCtx.fillRect(0, 0, 320, 200);
      klaxText("GAME OVER", 160, 84, 2, KLAX_TILE_COLOR["affix-wrong"], "center");
      klaxText(`SCORE ${state.score}`, 160, 104, 1, KLAX_C.paper, "center");
      klaxText("ENTER=RETRY  ESC=EXIT", 160, 120, 1, KLAX_C.accent, "center");
    }
  }

  function klaxLoop(t) {
    const dt = klaxLastT ? Math.min(0.1, (t - klaxLastT) / 1000) : 0;
    klaxLastT = t;
    if (klaxFlash > 0) klaxFlash -= dt;
    if (klaxClearAnim) {
      klaxClearAnim.timeLeft -= dt;
      if (klaxClearAnim.timeLeft <= 0) klaxClearAnim = null;
    }
    const result = klaxGame.tick(dt, klaxCol, klaxUpHeld ? KLAX_FAST_MULT : 1);
    if (result.event === "missed") klaxFlash = 0.12;
    renderKlax();
    klaxRaf = requestAnimationFrame(klaxLoop);
  }

  function stopKlaxLoop() {
    if (klaxRaf) cancelAnimationFrame(klaxRaf);
    klaxRaf = 0;
    klaxLastT = 0;
  }

  function launchKalq() {
    dirScreen.hidden = true;
    kalqApp.hidden = false;
    if (!klaxGame) klaxGame = window.OqKlaxGame.createGame({ puzzles: window.OqMorphPuzzles.puzzles, columns: KLAX_COLS });
    klaxGame.start();
    klaxCol = 0;
    klaxFlash = 0;
    klaxClearAnim = null;
    klaxUpHeld = false;
    stopKlaxLoop();
    klaxRaf = requestAnimationFrame(klaxLoop);
  }

  function exitKalq() {
    stopKlaxLoop();
    klaxUpHeld = false;
    kalqApp.hidden = true;
    dirScreen.hidden = false;
  }

  // Only left/right/down/a ever reach here -- Esc/RUN-STOP=EXIT is handled
  // by the keydown listener's own early-return branch, same as DICT/MORPH.
  function handleKalqInput(action) {
    const state = klaxGame.getState();
    if (state.gameOver) {
      if (action === "a") klaxGame.start();
      return;
    }
    if (action === "left") klaxCol = (klaxCol - 1 + KLAX_COLS) % KLAX_COLS;
    else if (action === "right") klaxCol = (klaxCol + 1) % KLAX_COLS;
    else if (action === "a") {
      if (!state.paddle.length) return;
      const res = klaxGame.place(klaxCol);
      if (res.event === "match") klaxClearAnim = { kind: "match", cells: res.cells, timeLeft: KLAX_CLEAR_ANIM_S };
      else if (res.event === "power-screen") { klaxFlash = 0.25; klaxClearAnim = { kind: "power-screen", cells: res.cells, timeLeft: KLAX_CLEAR_ANIM_S }; }
      else if (res.event === "power-lane") { klaxFlash = 0.16; klaxClearAnim = { kind: "power-lane", cells: res.cells, timeLeft: KLAX_CLEAR_ANIM_S }; }
    } else if (action === "down") {
      klaxGame.discard();
    }
  }

  document.getElementById("kalq-exit").addEventListener("click", () => {
    window.OqRouter.navigate({ screen: null, filter: null });
  });

  // window.OqRouter (shared/router.js) owns "which screen is open", same
  // reasoning as dos/app.js's identical block -- every user-facing trigger
  // (click, Esc, the LOAD/RUN command line) goes through navigate() instead
  // of calling launchDict()/exitDict()/launchMorph()/exitMorph() directly.
  window.OqRouter.onChange((params) => {
    const screen = params.get("screen");
    if (screen === "dict") {
      if (!morphApp.hidden) exitMorph();
      if (!kalqApp.hidden) exitKalq();
      if (dictApp.hidden) {
        launchDict(params.get("filter") || "");
      } else if (dictFilter.value !== (params.get("filter") || "")) {
        dictFilter.value = params.get("filter") || "";
        renderResults();
      }
    } else if (screen === "morph") {
      if (!dictApp.hidden) exitDict();
      if (!kalqApp.hidden) exitKalq();
      if (morphApp.hidden) launchMorph();
    } else if (screen === "kalq") {
      if (!dictApp.hidden) exitDict();
      if (!morphApp.hidden) exitMorph();
      if (kalqApp.hidden) launchKalq();
    } else {
      if (!dictApp.hidden) exitDict();
      if (!morphApp.hidden) exitMorph();
      if (!kalqApp.hidden) exitKalq();
    }
  });

  document.getElementById("dict-exit").addEventListener("click", () => {
    window.OqRouter.navigate({ screen: null, filter: null });
  });
  dictFilter.addEventListener("input", () => {
    renderResults();
    window.OqRouter.navigate({ filter: dictFilter.value || null }, { replace: true });
  });
  document.addEventListener("keydown", (event) => {
    // RUN/STOP is the real C64 key for "abort whatever's running" -- Esc is
    // the closest a modern keyboard has, same substitution dos/app.js makes
    // for its own Esc=Exit footer.
    if (event.key === "Escape" && (!dictApp.hidden || !morphApp.hidden || !kalqApp.hidden)) {
      window.OqRouter.navigate({ screen: null, filter: null });
      return;
    }
    if (!kalqApp.hidden) {
      const keyMap = { ArrowLeft: "left", ArrowRight: "right", ArrowDown: "down", Enter: "a" };
      if (event.key === "ArrowUp") { event.preventDefault(); klaxUpHeld = true; return; }
      const action = keyMap[event.key];
      if (action) { event.preventDefault(); handleKalqInput(action); }
      return;
    }
    if (morphApp.hidden || morphBusy) return;
    if (event.key >= "1" && event.key <= "9") {
      const i = Number(event.key) - 1;
      if (i < morphOptionCount) {
        event.preventDefault();
        morphSelected = i;
        highlightMorphOptions();
        chooseMorphOption();
      }
      return;
    }
    if (event.key === "ArrowUp") { event.preventDefault(); moveMorphSelection(-1); }
    else if (event.key === "ArrowDown") { event.preventDefault(); moveMorphSelection(1); }
    else if (event.key === "Enter") { event.preventDefault(); chooseMorphOption(); }
  });
  document.addEventListener("keyup", (event) => {
    if (event.key === "ArrowUp") klaxUpHeld = false;
  });
  // Belt-and-suspenders against a stuck fast-forward -- same reasoning as
  // snes/app.js's identical guard: a held key whose keyup gets lost (tab
  // switch, window blur) would otherwise leave klaxUpHeld permanently true.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) klaxUpHeld = false;
  });

  // The RUN loading-screen flicker (issue #27 piece 2): a real LOAD/RUN
  // blanked the screen and cycled the border through the VIC-II palette
  // while the drive worked (style.css's .c64-palette-cycle does the actual
  // color stepping) -- this just times how long that blank screen shows
  // before the loaded program takes over.
  const LOAD_FLICKER_MS = 1400;
  function flickerThenRun(after) {
    return new Promise((resolve) => {
      loadingScreen.hidden = false;
      loadingScreen.classList.add("c64-palette-cycle");
      setTimeout(() => {
        loadingScreen.classList.remove("c64-palette-cycle");
        loadingScreen.hidden = true;
        after();
        resolve();
      }, LOAD_FLICKER_MS);
    });
  }

  // Command line: real BASIC/KERNAL two-step idiom -- LOAD"NAME",8[,1] to
  // read a program off "disk", RUN to actually start whatever was last
  // loaded. Neither command takes effect alone: LOAD only ever reports
  // success, RUN with nothing loaded is the real ?SYNTAX ERROR a bare RUN
  // gave when BASIC's own program buffer was empty.
  //
  // Built as DOM nodes, not a plain template-literal string, so a LIST
  // reprint stays clickable -- see the delegated #c64-output click listener
  // below, same as the initial listing markup in index.html.
  function printDirListing() {
    printLine('0 "OQ DISK       " 09 2A');
    for (const [name, label, padding] of [["DICT", '1   "DICT"', "            PRG"], ["MORPH", '1   "MORPH"', "           PRG"], ["KALQ", '1   "KALQ"', "            PRG"]]) {
      // Inline, not a block-level <div> -- a <div> here forces its own line
      // box regardless of the "\n" text node already inserted before it,
      // which with two such lines back to back produced a spurious blank
      // row between them. The initial listing markup in index.html already
      // gets this right (a plain inline <button> in the same text flow);
      // matched here instead of reinventing it.
      c64Output.appendChild(document.createTextNode("\n"));
      const link = document.createElement("button");
      link.type = "button";
      link.className = "c64-link";
      link.dataset.load = name;
      link.textContent = label;
      c64Output.appendChild(link);
      c64Output.appendChild(document.createTextNode(padding));
    }
    printLine('1   "DICT DAT"             SEQ');
    printLine('1   "BUILD"                PRG');
    printLine('2   "RUN"                  PRG');
    printLine("661 BLOCKS FREE.");
  }

  let loadedProgram = null; // null until a LOAD succeeds -- what a bare RUN would start

  const c64Output = document.getElementById("c64-output");
  const c64Cmd = document.getElementById("c64-cmd");

  function printLine(text) {
    c64Output.appendChild(document.createTextNode(`\n${text}`));
    dirScreen.scrollTop = dirScreen.scrollHeight;
  }

  // Clicking "1 DICT" in the directory (the initial listing in index.html,
  // or a LIST reprint from printDirListing() above) is the mouse
  // equivalent of typing LOAD"DICT",8,1 then RUN -- same idea as
  // dos/index.html's clickable filename, but the C64 idiom is genuinely two
  // commands, not one, so the click plays the same flicker the command line
  // does rather than jumping straight to the app. Delegated on #c64-output
  // (rather than bound to a single fixed id) so it keeps working no matter
  // how many times the listing has been reprinted.
  c64Output.addEventListener("click", (event) => {
    const link = event.target.closest(".c64-link[data-load]");
    if (!link) return;
    const name = link.dataset.load;
    printLine(`LOAD"${name}",8,1`);
    printLine(`SEARCHING FOR ${name}`);
    printLine("LOADING");
    printLine("READY.");
    // loadedProgram set here (not just implied by the transcript above) so
    // a bare RUN typed afterward -- the natural next move after watching
    // a program load and launch this way -- relaunches it instead of
    // hitting the real ?SYNTAX ERROR an empty program buffer gives.
    loadedProgram = name;
    runProgram(loadedProgram);
  });

  function runProgram(name) {
    if (name === "DICT") {
      printLine("RUN");
      flickerThenRun(() => window.OqRouter.navigate({ screen: "dict", filter: null }));
    } else if (name === "MORPH") {
      printLine("RUN");
      flickerThenRun(() => window.OqRouter.navigate({ screen: "morph", filter: null }));
    } else if (name === "KALQ") {
      printLine("RUN");
      flickerThenRun(() => window.OqRouter.navigate({ screen: "kalq", filter: null }));
    } else if (name === "BUILD") {
      printLine("BUILD: NOT YET IMPLEMENTED");
    } else {
      printLine("?FILE NOT FOUND ERROR");
    }
  }

  function runCommand(line) {
    const trimmed = line.trim();
    if (trimmed === "") return;
    const upper = trimmed.toUpperCase(); // real BASIC auto-uppercased typed input outside quotes; simplest to just uppercase the whole line, same idea as dos/app.js's cmd.toUpperCase()

    // LOAD"$",8 is the real way to read the directory into BASIC's own
    // variable buffer (LIST then prints it back) -- checked before the
    // general LOAD match below so it can't be treated as an unknown
    // program name and wrongly clear loadedProgram.
    if (upper === 'LOAD"$",8' || upper === "LIST") {
      printLine("SEARCHING FOR $");
      printLine("LOADING");
      printLine("READY.");
      printLine("LIST");
      printLine("");
      printDirListing();
      return;
    }

    const loadMatch = upper.match(/^LOAD\s*"([^"]*)"\s*,\s*8(?:\s*,\s*1)?$/);
    if (loadMatch) {
      const name = loadMatch[1];
      printLine(`SEARCHING FOR ${name}`);
      if (name === "DICT" || name === "MORPH" || name === "KALQ" || name === "BUILD") {
        loadedProgram = name;
        printLine("LOADING");
        printLine("READY.");
      } else {
        printLine("?FILE NOT FOUND ERROR");
        loadedProgram = null;
      }
      return;
    }

    if (upper === "RUN") {
      if (loadedProgram) {
        runProgram(loadedProgram);
      } else {
        printLine("?SYNTAX ERROR");
      }
      return;
    }

    printLine("?SYNTAX ERROR");
  }

  // Real BASIC had no lowercase mode by default -- typed input showed
  // uppercase as it was typed, not just after Enter uppercased it for
  // matching (runCommand() already does that separately). Forced here
  // rather than left to CSS text-transform so the *echoed* history line
  // below also reads uppercase, not just the live input box.
  function forceUppercase(input) {
    input.addEventListener("input", () => {
      const { selectionStart, selectionEnd } = input;
      input.value = input.value.toUpperCase();
      input.setSelectionRange(selectionStart, selectionEnd);
    });
  }
  forceUppercase(c64Cmd);
  // dict-filter's own uppercase look comes from style.css's
  // text-transform:uppercase instead of this same JS trick -- it doesn't
  // need an uppercased *value* the way the command echo below does
  // (filterDictEntries() already matches case-insensitively), and forcing
  // the value here would race the existing "input" listener below that
  // reads dictFilter.value into the shareable URL.

  c64Cmd.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    printLine(c64Cmd.value);
    runCommand(c64Cmd.value);
    c64Cmd.value = "";
  });

  document.getElementById("c64-dir").addEventListener("click", () => c64Cmd.focus());
  c64Cmd.focus();

  // Same stepped, non-momentum wheel scroll as dos/app.js's
  // stepScrollOnWheel -- text mode scrolled a whole row at a time, never a
  // smooth trackpad glide. See that file's own comment for the full
  // reasoning; reapplied here rather than reinvented.
  //
  // Measured per-element from ITS OWN computed line-height, unlike
  // dos/app.js's single body-wide measurement -- dos/'s vendored framework
  // sets a real line-height on body itself, but c64/style.css doesn't (only
  // .c64-screen/.c64-app set one, and .c64-app-results doesn't even inherit
  // .c64-screen's), so reading body's here would resolve to "normal" (NaN
  // once parsed) and silently always fall back to one hardcoded literal,
  // wrong for any element whose real row height differs from it.
  function rowHeight(el) {
    return parseFloat(getComputedStyle(el).lineHeight) || 20;
  }
  // A real mechanical wheel has detents -- one click, one line, no matter
  // how fast you spin it. A trackpad has none: a single two-finger swipe
  // fires a burst of many "wheel" events in quick succession. Stepping by
  // a full row on every one of those events still moved a whole row per
  // event, but the burst was frequent enough to *look* like a smooth
  // glide -- the exact "smooth scrolling" bug report this throttle exists
  // to fix. Coalescing the burst down to one step per
  // WHEEL_STEP_INTERVAL_MS (same value and reasoning as dos/app.js's
  // identical throttle) makes a fast swipe visibly hop row by row instead.
  const WHEEL_STEP_INTERVAL_MS = 60;
  function stepScrollOnWheel(el) {
    const step = rowHeight(el);
    let lastStepAt = 0;
    el.addEventListener(
      "wheel",
      (event) => {
        if (event.ctrlKey || event.metaKey) return;
        if (event.deltaY === 0) return;
        // preventDefault on every event in the burst, even throttled-away
        // ones -- otherwise the swallowed events fall through to native
        // scrolling and reintroduce the exact smoothness being suppressed.
        event.preventDefault();
        const now = performance.now();
        if (now - lastStepAt < WHEEL_STEP_INTERVAL_MS) return;
        lastStepAt = now;
        el.scrollTop += event.deltaY > 0 ? step : -step;
      },
      { passive: false },
    );
  }
  stepScrollOnWheel(dirScreen);
  document.querySelectorAll(".c64-app-results").forEach(stepScrollOnWheel);

  // Mobile on-screen-keyboard viewport tracking -- identical reasoning and
  // implementation to dos/app.js's syncAppHeight; see that file's own
  // comment for the full explanation of why both --app-height and
  // --app-top are needed, not just one.
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
  // Belt-and-suspenders beyond visualViewport's own events: orientation
  // changes and bfcache restores (Safari in particular re-shows a page from
  // cache on back/forward without necessarily firing a visualViewport
  // resize first) have been seen to leave --app-height/--app-top stale
  // from before the navigation. Re-syncing on these too costs nothing (the
  // property is a no-op set if nothing actually changed) and closes that
  // gap instead of leaving the screen sized to a viewport it's not in
  // anymore.
  window.addEventListener("orientationchange", syncAppHeight);
  window.addEventListener("pageshow", syncAppHeight);
  syncAppHeight();
})();
