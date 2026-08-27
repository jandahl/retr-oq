// Shared KLAX! game engine -- Klax turned upside down: one morpheme tile at
// a time rises from the well floor instead of dropping from the sky. Line
// the paddle up under its column before it reaches the top and it's caught
// automatically -- miss the column and it overflows. The catcher then holds
// that one tile until the player moves it over a stacking lane (the same
// four lanes, at the bottom of the well) and presses a button to place it
// there. Placing a root or its correct affix next to its other half --
// wherever in the stacks it is -- clears the pair and scores. Classic
// script exposing window.OqKlaxGame, same convention as
// shared/morph-game.js: this file owns pure game state and renders nothing
// itself -- no DOM, no canvas, no timers. A theme's own app.js drives
// tick()/place()/discard() from its own input handling and render loop,
// the same split morph-game.js uses.
//
// Reuses shared/morph-puzzles.js puzzle data as-is (real, verified
// Kalaallisut morphemes) rather than inventing new tile text -- but only
// each puzzle's FIRST step. A live spatial match needs a fixed tile size
// (Klax matches 3 in a row; this catches a fixed-size pair), not the
// multi-step chain MORPH! builds one option-menu at a time. If the puzzle
// set grows deeper multi-step chains worth catching live, this is the file
// to extend -- not a reason to fork the data.
(() => {
  "use strict";

  /**
   * @param {{
   *   puzzles: Array<{ root: string, steps: Array<{ correct: { marker: string }, wrong: Array<{ marker: string }> }> }>,
   *   columns?: number,
   *   stackCap?: number,
   *   startLives?: number,
   *   riseSpeed?: number, // 0..1 well progress per second
   * }} config
   */
  function createGame({ puzzles, columns = 4, stackCap = 5, startLives = 3, riseSpeed = 0.22 }) {
    if (!puzzles || puzzles.length === 0) throw new Error("createGame requires at least one puzzle");

    // Each round is one puzzle reduced to its first step: a root tile, the
    // one correct affix for it, and that step's real-but-wrong affixes.
    const rounds = puzzles.map((p, i) => ({
      id: i,
      root: p.root,
      correct: p.steps[0].correct.marker,
      wrong: p.steps[0].wrong.map((w) => w.marker),
    }));

    // A single rising tile at a time -- not one per column -- is the whole
    // fix for "getting 8 at once": the player reads and reacts to one
    // block, resolves it (caught or missed), then the next one spawns.
    let active = null;
    let held = null; // the one tile the catcher is currently carrying, pre-placement
    let stacks = []; // stacks[c] = array of placed tiles in lane c, bottom to top
    // roundIds with a root already placed in some stack but no correct
    // affix placed yet -- see spawnActive()'s pity weighting below.
    let pendingRoots = new Set();
    let lives = startLives;
    let score = 0;
    let gameOver = false;

    function spawnActive() {
      // Fairness: blind uniform spawning could -- and did, in testing --
      // hand the player a long run of tiles that can't complete anything
      // they're already holding. Once a root is on the board waiting for
      // its affix, most spawns bias toward finally giving it to them.
      if (pendingRoots.size > 0 && Math.random() < 0.6) {
        const ids = Array.from(pendingRoots);
        const roundId = ids[Math.floor(Math.random() * ids.length)];
        const round = rounds[roundId];
        active = { roundId, kind: "affix-correct", marker: round.correct, col: Math.floor(Math.random() * columns), y: 0 };
        return;
      }
      const round = rounds[Math.floor(Math.random() * rounds.length)];
      // Every other spawn is a coin flip between the round's root and one
      // of its affixes (correct or a real wrong one) -- the player never
      // knows which half of a pair they're catching until they read it.
      const wantsRoot = Math.random() < 0.5;
      const marker = wantsRoot
        ? round.root
        : Math.random() < 0.55
          ? round.correct
          : round.wrong[Math.floor(Math.random() * round.wrong.length)];
      active = {
        roundId: round.id,
        kind: wantsRoot ? "root" : marker === round.correct ? "affix-correct" : "affix-wrong",
        marker,
        col: Math.floor(Math.random() * columns),
        y: 0,
      };
    }

    function start() {
      lives = startLives;
      score = 0;
      gameOver = false;
      held = null;
      pendingRoots = new Set();
      stacks = Array.from({ length: columns }, () => []);
      active = null;
      spawnActive();
      return getState();
    }

    /**
     * Looks for a root + its correct affix anywhere across the stacking
     * lanes (not necessarily the same lane or adjacent) and clears both if
     * found. Runs after every placement.
     */
    function tryMatch() {
      for (let c = 0; c < stacks.length; c++) {
        for (const tile of stacks[c]) {
          if (tile.kind !== "root") continue;
          for (let d = 0; d < stacks.length; d++) {
            const i = stacks[d].findIndex((t) => t.roundId === tile.roundId && t.kind === "affix-correct");
            if (i === -1) continue;
            const affix = stacks[d][i];
            stacks[c] = stacks[c].filter((t) => t !== tile);
            stacks[d] = stacks[d].filter((t) => t !== affix);
            pendingRoots.delete(tile.roundId);
            score += 20;
            return { marker: tile.marker, other: affix.marker };
          }
        }
      }
      return null;
    }

    /**
     * Advances the one active tile by `dtSeconds` worth of well progress.
     * The instant it reaches the top, it resolves immediately -- caught if
     * the paddle is already sitting in its column AND the catcher isn't
     * already carrying a piece, missed otherwise. While the catcher is
     * carrying a piece, no new tile is even spawned -- placing it is a
     * deliberate, untimed decision, not a race against the next tile.
     * @param {number} paddleCol which column the paddle is currently over
     */
    function tick(dtSeconds, paddleCol) {
      if (gameOver) return { event: "gameover" };
      if (held) return { event: "holding" };
      if (!active) {
        spawnActive();
        return { event: "spawned" };
      }
      active.y = Math.min(1, active.y + riseSpeed * dtSeconds);
      if (active.y < 1) return { event: "rising" };

      if (active.col === paddleCol) {
        held = active;
        active = null;
        return { event: "caught", tile: { marker: held.marker, kind: held.kind } };
      }

      active = null;
      lives -= 1;
      if (lives <= 0) gameOver = true;
      spawnActive();
      return { event: "missed", lives, gameOver };
    }

    /**
     * Places the held tile atop the stacking lane `col`. No-ops if nothing
     * is held or that lane is already full -- the player has to pick
     * another lane rather than losing the piece.
     */
    function place(col) {
      if (!held || gameOver) return { placed: false };
      if (stacks[col].length >= stackCap) return { placed: false, full: true };
      const tile = held;
      held = null;
      stacks[col].push(tile);
      if (tile.kind === "root") pendingRoots.add(tile.roundId);
      const matched = tryMatch();
      spawnActive();
      return matched
        ? { placed: true, event: "match", cleared: [matched.marker, matched.other], score }
        : { placed: true, event: "placed" };
    }

    /** Drops the held tile with no penalty -- the escape hatch when every lane is unhelpful right now. */
    function discard() {
      if (!held) return getState();
      held = null;
      spawnActive();
      return getState();
    }

    function getState() {
      return {
        lives,
        score,
        gameOver,
        held: held && { marker: held.marker, kind: held.kind },
        stacks: stacks.map((lane) => lane.map((t) => ({ marker: t.marker, kind: t.kind }))),
        stackCap,
        active: active && { marker: active.marker, kind: active.kind, col: active.col, y: active.y },
      };
    }

    return { start, tick, place, discard, getState };
  }

  window.OqKlaxGame = { createGame };
})();
