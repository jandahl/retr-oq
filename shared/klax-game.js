// Shared KLAX! game engine -- Klax turned upside down: morpheme tiles rise
// from the well floor instead of dropping from the sky, a paddle at the top
// catches them, and matching a root with its correct affix clears the pair.
// Classic script exposing window.OqKlaxGame, same convention as
// shared/morph-game.js: this file owns pure game state (which tiles are
// rising in which column, what the paddle is holding, lives, score) and
// renders nothing itself -- no DOM, no canvas, no timers. A theme's own
// app.js drives tick()/catchTile()/rotateHolder()/commit() from its own
// input handling and render loop, the same split morph-game.js uses.
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

  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  let nextTileId = 1;

  /**
   * @param {{
   *   puzzles: Array<{ root: string, steps: Array<{ correct: { marker: string }, wrong: Array<{ marker: string }> }> }>,
   *   columns?: number,
   *   holderSize?: number,
   *   startLives?: number,
   *   riseSpeed?: number, // 0..1 well progress per second
   * }} config
   */
  function createGame({ puzzles, columns = 4, holderSize = 3, startLives = 3, riseSpeed = 0.18 }) {
    if (!puzzles || puzzles.length === 0) throw new Error("createGame requires at least one puzzle");

    // Each round is one puzzle reduced to its first step: a root tile, the
    // one correct affix for it, and that step's real-but-wrong affixes.
    const rounds = puzzles.map((p, i) => ({
      id: i,
      root: p.root,
      correct: p.steps[0].correct.marker,
      wrong: p.steps[0].wrong.map((w) => w.marker),
    }));

    let cols = []; // cols[c] = array of tiles, index 0 is the frontmost (closest to the paddle)
    let holder = [];
    let lives = startLives;
    let score = 0;
    let gameOver = false;

    function spawnTile() {
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
      return {
        tileId: nextTileId++,
        roundId: round.id,
        kind: wantsRoot ? "root" : marker === round.correct ? "affix-correct" : "affix-wrong",
        marker,
        y: 0,
        ready: false,
      };
    }

    function refillColumn(c) {
      // Stagger new tiles behind whatever's already rising so a column
      // never looks like it spawned a wall of tiles at once.
      const back = cols[c][cols[c].length - 1];
      const tile = spawnTile();
      tile.y = back ? Math.max(-0.6, back.y - 0.55 - Math.random() * 0.35) : -Math.random() * 0.4;
      cols[c].push(tile);
    }

    function start() {
      lives = startLives;
      score = 0;
      gameOver = false;
      holder = [];
      cols = Array.from({ length: columns }, () => []);
      for (let c = 0; c < columns; c++) {
        for (let n = 0; n < 3; n++) refillColumn(c);
      }
      return getState();
    }

    /**
     * Advances every rising tile by `dtSeconds` worth of well progress.
     * A tile that crosses y=1 uncaught overflows the well: it's removed,
     * costs a life, and a fresh tile refills the column from the back.
     * Returns { overflowed: boolean, gameOver } so the caller can flash/sfx
     * an overflow without polling getState() every frame.
     */
    function tick(dtSeconds) {
      if (gameOver) return { overflowed: false, gameOver: true };
      let overflowed = false;
      for (let c = 0; c < cols.length; c++) {
        const column = cols[c];
        for (const tile of column) {
          if (tile.y < 1) tile.y = Math.min(1, tile.y + riseSpeed * dtSeconds);
          tile.ready = tile.y >= 1;
        }
        if (!column.length) continue;
        const front = column[0];
        if (front.ready && front.overflowGrace === undefined) {
          // Only the front tile can overflow, same as only the front tile
          // can be caught -- it gets one grace window to be caught before
          // the well counts it as a miss.
          front.overflowGrace = 0.35;
        }
        if (front.overflowGrace !== undefined) {
          front.overflowGrace -= dtSeconds;
          if (front.overflowGrace <= 0) {
            column.shift();
            refillColumn(c);
            lives -= 1;
            overflowed = true;
          }
        }
      }
      if (lives <= 0) gameOver = true;
      return { overflowed, gameOver, lives };
    }

    /** Pulls the frontmost ready tile in column `c` into the paddle's holder, if there's room. */
    function catchTile(c) {
      if (gameOver) return { caught: false };
      const column = cols[c];
      if (!column || !column.length || !column[0].ready) return { caught: false };
      if (holder.length >= holderSize) return { caught: false, holderFull: true };
      const [tile] = column.splice(0, 1);
      delete tile.overflowGrace;
      holder.push(tile);
      refillColumn(c);
      return { caught: true, tile: { marker: tile.marker, kind: tile.kind } };
    }

    /** Cycles the holder order (front tile moves to the back) so the player can line up a pair for commit(). */
    function rotateHolder() {
      if (holder.length > 1) holder.push(holder.shift());
      return getState();
    }

    /**
     * Attempts a match: if any two held tiles are a root + its correct
     * affix from the same round, they clear and score. Otherwise the
     * whole holder is discarded and a life is lost -- committing on a
     * bad guess is the risk, same as dropping a bad line in Klax.
     */
    function commit() {
      if (gameOver) return { outcome: "gameover" };
      for (let i = 0; i < holder.length; i++) {
        for (let j = 0; j < holder.length; j++) {
          if (i === j) continue;
          const a = holder[i], b = holder[j];
          if (a.roundId === b.roundId && a.kind === "root" && b.kind === "affix-correct") {
            const cleared = [a, b];
            holder = holder.filter((t) => t !== a && t !== b);
            score += 20;
            return { outcome: "match", cleared: cleared.map((t) => t.marker), score };
          }
        }
      }
      holder = [];
      lives -= 1;
      if (lives <= 0) gameOver = true;
      return { outcome: "miss", lives, gameOver };
    }

    function getState() {
      return {
        lives,
        score,
        gameOver,
        holder: holder.map((t) => ({ marker: t.marker, kind: t.kind })),
        columns: cols.map((column) =>
          column.map((t) => ({ marker: t.marker, kind: t.kind, y: t.y, ready: t.ready })),
        ),
      };
    }

    return { start, tick, catchTile, rotateHolder, commit, getState };
  }

  window.OqKlaxGame = { createGame };
})();
