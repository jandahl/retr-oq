// Shared KLAX! game engine -- Klax turned upside down: one morpheme tile at
// a time rises from the well floor instead of dropping from the sky. Line
// the paddle up under its column before it reaches the top and it's caught
// automatically -- miss the column and it overflows. Catching a root and
// its correct affix (same puzzle) auto-matches the instant the second one
// lands, clearing the pair and scoring. Classic script exposing
// window.OqKlaxGame, same convention as shared/morph-game.js: this file
// owns pure game state and renders nothing itself -- no DOM, no canvas, no
// timers. A theme's own app.js drives tick()/discard() from its own input
// handling and render loop, the same split morph-game.js uses.
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
   *   holderSize?: number,
   *   startLives?: number,
   *   riseSpeed?: number, // 0..1 well progress per second
   * }} config
   */
  function createGame({ puzzles, columns = 4, holderSize = 3, startLives = 3, riseSpeed = 0.22 }) {
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
    let holder = [];
    let lives = startLives;
    let score = 0;
    let gameOver = false;

    function spawnActive() {
      const round = rounds[Math.floor(Math.random() * rounds.length)];
      // Every spawn is a coin flip between the round's root and one of its
      // affixes (correct or a real wrong one) -- the player never knows
      // which half of a pair they're catching until they read the tile.
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
      holder = [];
      active = null;
      spawnActive();
      return getState();
    }

    /**
     * If the newest catch completes a root + its correct affix from the
     * same round, clears that pair and scores. Runs automatically after
     * every catch -- there's no separate "commit" step, so a matching pair
     * always resolves the moment it's caught rather than waiting on a
     * button the player has to discover.
     */
    function tryAutoMatch() {
      for (let i = 0; i < holder.length; i++) {
        for (let j = 0; j < holder.length; j++) {
          if (i === j) continue;
          const a = holder[i], b = holder[j];
          if (a.roundId === b.roundId && a.kind === "root" && b.kind === "affix-correct") {
            holder = holder.filter((t) => t !== a && t !== b);
            score += 20;
            return { marker: a.marker, other: b.marker };
          }
        }
      }
      return null;
    }

    /**
     * Advances the one active tile by `dtSeconds` worth of well progress.
     * The instant it reaches the top, it resolves immediately -- caught if
     * the paddle is already sitting in its column, missed otherwise. There
     * is no grace window and no way for it to hang around the catch line:
     * a tile that "passes through" the paddle instead of resolving was the
     * bug, not a feature.
     * @param {number} paddleCol which column the paddle is currently over
     */
    function tick(dtSeconds, paddleCol) {
      if (gameOver) return { event: "gameover" };
      if (!active) {
        spawnActive();
        return { event: "spawned" };
      }
      active.y = Math.min(1, active.y + riseSpeed * dtSeconds);
      if (active.y < 1) return { event: "rising" };

      if (active.col === paddleCol) {
        const caught = active;
        active = null;
        if (holder.length < holderSize) holder.push(caught);
        const matched = tryAutoMatch();
        spawnActive();
        return matched
          ? { event: "match", cleared: [matched.marker, matched.other], score }
          : { event: "caught", tile: { marker: caught.marker, kind: caught.kind } };
      }

      active = null;
      lives -= 1;
      if (lives <= 0) gameOver = true;
      spawnActive();
      return { event: "missed", lives, gameOver };
    }

    /** Clears the holder with no penalty -- the escape hatch when it's stuck holding pieces that can't pair up. */
    function discard() {
      holder = [];
      return getState();
    }

    function getState() {
      return {
        lives,
        score,
        gameOver,
        holder: holder.map((t) => ({ marker: t.marker, kind: t.kind })),
        holderSize,
        active: active && { marker: active.marker, kind: active.kind, col: active.col, y: active.y },
      };
    }

    return { start, tick, discard, getState };
  }

  window.OqKlaxGame = { createGame };
})();
