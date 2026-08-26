// Shared MORPH! game engine -- a WarioWare-pace "build the word one
// morpheme at a time" minigame state machine. Classic script exposing
// window.OqMorphGame, same convention as shared/decon-app.js: this file
// owns the pure game state (which puzzle, which step, lives, score, which
// options are on screen and which one is correct) and renders nothing
// itself -- no DOM, no timers, no sfx. A theme's own app.js supplies the
// puzzle data and drives the state machine from its own input handling,
// deciding its own pacing (how long to hold a "shocked" frame, its own
// sprite/sound) the same way shared/decon-app.js's createController()
// leaves rendering entirely to its caller.
//
// Extracted straight out of gb/app.js the moment a second console theme
// (nes/, gg/, ...) becomes a real candidate for the same minigame -- same
// precedent as shared/redmond/window-manager.js and shared/decon-app.js's
// own extraction comments. Puzzle *data* (shared/morph-puzzles.js) is
// shared too: it's just real dictionary/grammar facts, nothing GB-specific
// about it.
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

  /**
   * @param {{
   *   puzzles: Array<{
   *     root: string, rootGloss: string, resultGloss: string,
   *     steps: Array<{
   *       correct: { marker: string, type: "affix"|"suffix", gloss: string },
   *       wrong: Array<{ marker: string, gloss: string }>,
   *     }>,
   *   }>,
   *   startLives?: number,
   * }} config
   */
  function createGame({ puzzles, startLives = 3 }) {
    if (!puzzles || puzzles.length === 0) throw new Error("createGame requires at least one puzzle");

    // Shuffled draw-without-replacement queue of puzzle indices, refilled
    // (and reshuffled) whenever it runs dry -- guarantees every puzzle is
    // seen once before any repeats, instead of plain Math.random() picks
    // that can repeat the same puzzle back-to-back.
    let queue = [];
    let puzzle = null;
    let stepIndex = 0;
    let wordSoFar = "";
    let options = [];
    let lives = startLives;
    let score = 0;

    function nextPuzzle() {
      if (queue.length === 0) queue = shuffled(puzzles.map((_, i) => i));
      return puzzles[queue.pop()];
    }

    function currentStep() {
      return puzzle.steps[stepIndex];
    }

    // Builds the on-screen option set for the current step: the one
    // correct morpheme plus every real-but-wrong one the puzzle lists,
    // shuffled so the correct answer isn't always in the same slot.
    function beginStep() {
      const step = currentStep();
      options = shuffled([
        { ...step.correct, isCorrect: true },
        ...step.wrong.map((w) => ({ ...w, isCorrect: false })),
      ]);
      return {
        word: wordSoFar,
        stepType: step.correct.type,
        options: options.map(({ marker, gloss }) => ({ marker, gloss })),
      };
    }

    function beginPuzzle() {
      puzzle = nextPuzzle();
      stepIndex = 0;
      wordSoFar = puzzle.root;
      return { root: puzzle.root, rootGloss: puzzle.rootGloss, ...beginStep() };
    }

    /** Starts (or restarts) a full game: resets lives/score, begins the first puzzle. */
    function start() {
      lives = startLives;
      score = 0;
      queue = [];
      return { lives, score, ...beginPuzzle() };
    }

    /**
     * Applies the player's pick. Does NOT advance the state on its own --
     * a wrong pick needs retryStep(), a mid-chain correct pick needs
     * advanceStep(), a chain-ending correct pick needs advancePuzzle(),
     * called once the caller's own "shocked"/"happy" pause is done. This
     * split is what lets each theme own its own pacing without the engine
     * knowing anything about timers or animation.
     * @param {number} optionIndex index into the `options` from the last beginStep()/beginPuzzle()
     */
    function choose(optionIndex) {
      const opt = options[optionIndex];
      if (!opt) throw new Error(`choose: no option at index ${optionIndex}`);
      if (!opt.isCorrect) {
        lives -= 1;
        return { outcome: "wrong", marker: opt.marker, gloss: opt.gloss, lives, gameOver: lives <= 0 };
      }
      wordSoFar += opt.marker;
      if (opt.type === "suffix") {
        score += 10 * (stepIndex + 1);
        return { outcome: "win", word: wordSoFar, resultGloss: puzzle.resultGloss, score };
      }
      stepIndex += 1;
      return { outcome: "continue", word: wordSoFar };
    }

    /** Re-presents the current step (reshuffled) after a wrong pick. */
    function retryStep() {
      return beginStep();
    }

    /** Moves to the next step of the same puzzle after a correct "affix" pick. */
    function advanceStep() {
      return beginStep();
    }

    /** Moves to a new puzzle after a correct "suffix" pick ends the round. */
    function advancePuzzle() {
      return beginPuzzle();
    }

    function getState() {
      return { lives, score, word: wordSoFar };
    }

    return { start, choose, retryStep, advanceStep, advancePuzzle, getState };
  }

  window.OqMorphGame = { createGame };
})();
