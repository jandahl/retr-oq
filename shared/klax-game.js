// Shared KLAX! game engine -- Klax turned upside down: one morpheme tile at
// a time rises from the well floor instead of dropping from the sky. Line
// the paddle up under its column before it reaches the top and it's caught
// automatically -- miss the column and it overflows. The catcher can hold
// up to 4 caught tiles at once, LIFO -- catching doesn't pause the well, so
// the player can keep reading and catching while deciding where to place
// them. Pressing place() pops the most recently caught tile and puts it
// atop a stacking lane (the same four lanes, at the ceiling above the
// well). Placing a root or its correct affix next to its other half --
// wherever in the stacks it is -- clears the pair and scores. A rare
// (1 in 20) spawn is a Dr. Mario-style pill instead of a real morpheme
// tile: caught and carried the same as anything else, but placing one
// clears a whole lane or the whole board instead of stacking. Classic
// script exposing window.OqKlaxGame, same convention as
// shared/morph-game.js: this file owns pure game state and renders nothing
// itself -- no DOM, no canvas, no timers. A theme's own app.js drives
// tick()/place()/discard() from its own input handling and render loop,
// the same split morph-game.js uses.
//
// Reuses shared/morph-puzzles.js puzzle data as-is (real, verified
// Kalaallisut morphemes) rather than inventing new tile text. Every step of
// every puzzle becomes its own round (not just the first) -- a multi-step
// puzzle's later steps are just as verified as its first, so "illu" alone
// already yields two rounds (illu+qaq, and the word-so-far "illuqaq"+voq)
// without fabricating anything new. A live spatial match needs a fixed
// tile size (Klax matches 3 in a row; this catches a fixed-size pair), not
// the multi-step chain MORPH! builds one option-menu at a time -- treating
// each step as its own round is what lets this reuse that same chain data
// instead of forking it.
(() => {
  "use strict";

  /**
   * @param {{
   *   puzzles: Array<{ root: string, steps: Array<{ correct: { marker: string }, wrong: Array<{ marker: string }> }> }>,
   *   columns?: number,
   *   stackCap?: number,
   *   paddleCap?: number,
   *   startLives?: number,
   *   riseSpeed?: number, // 0..1 well progress per second
   * }} config
   */
  function createGame({ puzzles, columns = 4, stackCap = 5, paddleCap = 4, startLives = 3, riseSpeed = 0.22 }) {
    if (!puzzles || puzzles.length === 0) throw new Error("createGame requires at least one puzzle");

    // Flatten every step of every puzzle into its own round: a tile pair
    // (the word-so-far and the one correct next marker), plus that step's
    // real-but-wrong markers.
    const rounds = [];
    for (const p of puzzles) {
      let wordSoFar = p.root;
      for (const step of p.steps) {
        rounds.push({
          id: rounds.length,
          root: wordSoFar,
          correct: step.correct.marker,
          wrong: step.wrong.map((w) => w.marker),
        });
        wordSoFar += step.correct.marker;
      }
    }

    // A single rising tile at a time -- not one per column -- is the whole
    // fix for "getting 8 at once": the player reads and reacts to one
    // block, resolves it (caught or missed), then the next one spawns.
    let active = null;
    let paddle = []; // tiles the catcher is currently carrying, LIFO -- paddle[paddle.length-1] is the one place()/discard() acts on
    let stacks = []; // stacks[c] = array of placed tiles in lane c, bottom to top
    // roundIds with a root already placed in some stack but no correct
    // affix placed yet -- see spawnActive()'s pity weighting below.
    let pendingRoots = new Set();
    let lives = startLives;
    let score = 0;
    let gameOver = false;

    function spawnActive() {
      // Dr. Mario-style pill: 1 in 20 spawns, unrelated to the round pity
      // logic below. Caught and carried in the paddle just like any other
      // tile -- "stored for later" falls out of that for free -- but
      // placing one never occupies a lane; it clears one instead.
      if (Math.random() < 0.05) {
        const isLane = Math.random() < 0.5;
        active = {
          roundId: null,
          kind: isLane ? "power-lane" : "power-screen",
          marker: isLane ? "LANE" : "ALL",
          col: Math.floor(Math.random() * columns),
          y: 0,
        };
        return;
      }
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
      paddle = [];
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
     * Advances the one active tile by `dtSeconds` worth of well progress,
     * scaled by `speedMultiplier` (holding a fast-forward input passes >1
     * here). The well never pauses, catching or not: the catcher can hold
     * up to `paddleCap` tiles at once, so a full paddle -- not "anything
     * currently held" -- is the only thing that turns a catch into a miss.
     * @param {number} paddleCol which column the paddle is currently over
     * @param {number} [speedMultiplier]
     */
    function tick(dtSeconds, paddleCol, speedMultiplier = 1) {
      if (gameOver) return { event: "gameover" };
      if (!active) {
        spawnActive();
        return { event: "spawned" };
      }
      active.y = Math.min(1, active.y + riseSpeed * speedMultiplier * dtSeconds);
      if (active.y < 1) return { event: "rising" };

      if (active.col === paddleCol && paddle.length < paddleCap) {
        paddle.push(active);
        const tile = active;
        active = null;
        spawnActive();
        return { event: "caught", tile: { marker: tile.marker, kind: tile.kind } };
      }

      active = null;
      lives -= 1;
      if (lives <= 0) gameOver = true;
      spawnActive();
      return { event: "missed", lives, gameOver };
    }

    /**
     * Pops the most recently caught tile (LIFO). A wrong affix can never
     * complete a match (only a root + its correct affix can), so placing
     * one doesn't occupy a lane at all -- it's just discarded, freeing the
     * paddle slot. Without this, a caught dud would sit in a stack forever
     * with no way to ever clear it, since match-by-meaning (unlike Klax's
     * match-by-color) gives it no path to completing anything. A root or
     * correct affix still needs an actual open lane -- no-ops if the
     * chosen one is already full, same as before.
     */
    function place(col) {
      if (!paddle.length || gameOver) return { placed: false };
      const tile = paddle[paddle.length - 1];
      if (tile.kind === "power-lane") {
        paddle.pop();
        for (const t of stacks[col]) if (t.kind === "root") pendingRoots.delete(t.roundId);
        const cleared = stacks[col].map((t) => t.marker);
        stacks[col] = [];
        return { placed: true, event: "power-lane", col, cleared };
      }
      if (tile.kind === "power-screen") {
        paddle.pop();
        const cleared = stacks.flat().map((t) => t.marker);
        stacks = stacks.map(() => []);
        pendingRoots = new Set();
        return { placed: true, event: "power-screen", cleared };
      }
      if (tile.kind === "affix-wrong") {
        paddle.pop();
        return { placed: true, event: "discarded", tile: { marker: tile.marker, kind: tile.kind } };
      }
      if (stacks[col].length >= stackCap) return { placed: false, full: true };
      paddle.pop();
      stacks[col].push(tile);
      if (tile.kind === "root") pendingRoots.add(tile.roundId);
      const matched = tryMatch();
      return matched
        ? { placed: true, event: "match", cleared: [matched.marker, matched.other], score }
        : { placed: true, event: "placed" };
    }

    /** Drops the most recently caught tile (LIFO) with no penalty -- the escape hatch for a piece that isn't useful right now. */
    function discard() {
      if (!paddle.length) return getState();
      paddle.pop();
      return getState();
    }

    function getState() {
      return {
        lives,
        score,
        gameOver,
        paddle: paddle.map((t) => ({ marker: t.marker, kind: t.kind })),
        paddleCap,
        stacks: stacks.map((lane) => lane.map((t) => ({ marker: t.marker, kind: t.kind }))),
        stackCap,
        active: active && { marker: active.marker, kind: active.kind, col: active.col, y: active.y },
      };
    }

    return { start, tick, place, discard, getState };
  }

  window.OqKlaxGame = { createGame };
})();
