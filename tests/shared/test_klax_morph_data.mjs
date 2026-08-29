// Node-only regression tests for shared/morph-puzzles.js, shared/morph-game.js,
// and shared/klax-game.js -- no browser needed, unlike the rest of tests/
// (Playwright against a real theme page). These three files are pure logic
// with no DOM, so they're loaded directly into a vm sandbox and exercised as
// data/state machines.
//
// Written after a real shipped bug (see git history: klax-game.js used to
// flatten every step of a multi-step MORPH! puzzle into its own KLAX round,
// using a naively string-concatenated "word-so-far" as that round's root
// tile -- e.g. "illu" + "qaq" -> "illuqaq", rendered with the exact same
// tile styling as a real verified root, silently vouching for a string that
// was neither a real standalone word nor even correctly spelled, since
// Kalaallisut sandhi at these boundaries is exactly what shared/morph-puzzles.js's
// own `resultWord` field exists to correct). Nothing before this file would
// have caught that: the Playwright suites never drive KLAX far enough to
// see a specific tile's text, and none of them run at all for a shared/-only
// change until this file's own CI wiring (theme-tests.yml's `shared` filter).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function loadSharedScripts(...files) {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  for (const file of files) {
    const code = readFileSync(path.join(repoRoot, "shared", file), "utf8");
    vm.runInContext(code, sandbox, { filename: file });
  }
  return sandbox;
}

const sandbox = loadSharedScripts("morph-puzzles.js", "morph-game.js", "klax-game.js");
const { puzzles } = sandbox.window.OqMorphPuzzles;

test("morph-puzzles.js: every puzzle's steps end on a terminal 'suffix', never mid-chain", () => {
  for (const puzzle of puzzles) {
    assert.ok(puzzle.steps.length >= 1, `${puzzle.root}: needs at least one step`);
    const last = puzzle.steps[puzzle.steps.length - 1];
    assert.equal(last.correct.type, "suffix", `${puzzle.root}: last step must be type "suffix"`);
    for (const step of puzzle.steps.slice(0, -1)) {
      assert.equal(step.correct.type, "affix", `${puzzle.root}: non-final step must be type "affix"`);
    }
  }
});

test("morph-puzzles.js: every puzzle declares a resultWord/resultGloss (no consumer should ever need to concatenate one itself)", () => {
  for (const puzzle of puzzles) {
    assert.ok(puzzle.resultWord && puzzle.resultWord.length > 0, `${puzzle.root}: missing resultWord`);
    assert.ok(puzzle.resultGloss && puzzle.resultGloss.length > 0, `${puzzle.root}: missing resultGloss`);
  }
});

test("morph-game.js: playing every puzzle's correct chain wins with the puzzle's own resultWord", () => {
  for (const puzzle of puzzles) {
    // One puzzle per game so beginPuzzle()/beginStep()'s shuffled option
    // list unambiguously belongs to this puzzle.
    const game = sandbox.window.OqMorphGame.createGame({ puzzles: [puzzle] });
    let state = game.start();
    for (const step of puzzle.steps) {
      const correctIndex = state.options.findIndex((opt) => opt.marker === step.correct.marker);
      assert.ok(correctIndex !== -1, `${puzzle.root}: correct marker "${step.correct.marker}" missing from options`);
      const result = game.choose(correctIndex);
      if (step.correct.type === "suffix") {
        assert.equal(result.outcome, "win");
        assert.equal(result.word, puzzle.resultWord);
      } else {
        assert.equal(result.outcome, "continue");
        state = game.advanceStep();
      }
    }
  }
});

test("morph-game.js: a step's wrong option costs a life and never wins", () => {
  for (const puzzle of puzzles) {
    for (let targetStepIndex = 0; targetStepIndex < puzzle.steps.length; targetStepIndex++) {
      const targetStep = puzzle.steps[targetStepIndex];
      if (targetStep.wrong.length === 0) continue; // nothing to test for a step with no distractor

      const game = sandbox.window.OqMorphGame.createGame({ puzzles: [puzzle] });
      let state = game.start();
      // Walk correctly through every prior step so `state.options` really
      // belongs to targetStep before picking a wrong one from it.
      for (let i = 0; i < targetStepIndex; i++) {
        const correctIndex = state.options.findIndex((opt) => opt.marker === puzzle.steps[i].correct.marker);
        game.choose(correctIndex);
        state = game.advanceStep();
      }

      const wrongIndex = state.options.findIndex((opt) => opt.marker !== targetStep.correct.marker);
      assert.ok(wrongIndex !== -1, `${puzzle.root} step ${targetStepIndex}: expected a wrong option among this step's options`);
      const result = game.choose(wrongIndex);
      assert.equal(result.outcome, "wrong");
      assert.equal(result.lives, 2); // startLives (3) - 1
    }
  }
});

test("klax-game.js: builds exactly one round per puzzle, using each puzzle's own verified root untouched", () => {
  const realRoots = new Set(puzzles.map((p) => p.root));
  const game = sandbox.window.OqKlaxGame.createGame({ puzzles, riseSpeed: 1 });
  let state = game.start();
  const seenRootTiles = new Set();
  for (let i = 0; i < 4000 && !state.gameOver; i++) {
    if (state.active && state.active.kind === "root") seenRootTiles.add(state.active.marker);
    game.tick(1, state.active ? state.active.col : 0, 1);
    state = game.getState();
  }

  assert.ok(seenRootTiles.size > 0, "expected to observe at least one root tile spawn");
  for (const tile of seenRootTiles) {
    assert.ok(
      realRoots.has(tile),
      `root tile "${tile}" is not one of the puzzles' own verified roots -- looks like a synthesized word-so-far string`,
    );
  }
});

test("klax-game.js: multi-step puzzles (illu/qimmeq/inuuik) never leak a synthesized intermediate word as a tile", () => {
  const multiStepPuzzles = puzzles.filter((p) => p.steps.length > 1);
  assert.ok(multiStepPuzzles.length > 0, "expected at least one multi-step puzzle to exercise this regression");

  const game = sandbox.window.OqKlaxGame.createGame({ puzzles, riseSpeed: 1 });
  let state = game.start();
  const seenMarkers = new Set();
  for (let i = 0; i < 4000 && !state.gameOver; i++) {
    if (state.active) seenMarkers.add(state.active.marker);
    game.tick(1, state.active ? state.active.col : 0, 1);
    state = game.getState();
  }

  for (const puzzle of multiStepPuzzles) {
    const fakeIntermediate = puzzle.root + puzzle.steps[0].correct.marker;
    assert.ok(
      !seenMarkers.has(fakeIntermediate),
      `saw synthesized intermediate word "${fakeIntermediate}" as a tile marker -- the exact bug this test guards against`,
    );
  }
});

// --- Reuse/connectivity floor (2026-08) -------------------------------------
//
// Design target from the reuse pass that added most of this file's puzzles
// (see morph-puzzles.js's own header comment): every root and every marker
// should connect to at least 3 OTHER morphemes in the set -- not by adding
// new morphemes, but by giving existing ones more combinations. This isn't
// a rule anyone is required to keep growing forever (a percentage-based
// version of it is explicitly future work), but it should never silently
// regress: a puzzle removed, or a puzzle's marker/root typo'd, could quietly
// drop a morpheme back under the floor with nothing else in this file
// noticing (the other tests above check correctness of what IS here, not
// how connected it is). This test only checks the floor holds; it does not
// enforce HOW a future addition gets there.
test("reuse floor: every root and marker connects to at least 3 DISTINCT others", () => {
  // Sets, not counts: two puzzles that both pair the same root with the
  // same marker (e.g. a second "angut+mi" puzzle added on top of the real
  // one) must NOT count as two connections -- that would let a future edit
  // pad an occurrence count back over the floor by duplicating an existing
  // combination instead of adding a genuinely new one, defeating the whole
  // point of this test.
  const connections = new Map();
  const connect = (a, b) => {
    if (!connections.has(a)) connections.set(a, new Set());
    connections.get(a).add(b);
  };
  for (const puzzle of puzzles) {
    // chainHead tracks what a step's marker actually attaches to: the bare
    // root for the first step, or "root>marker" for a later step in the
    // same chain -- so a root's own connections are exactly the (distinct)
    // markers that attach directly to it, and a marker's connections are
    // exactly the (distinct) roots/chain-heads it's been used with.
    let chainHead = puzzle.root;
    for (const step of puzzle.steps) {
      const marker = step.correct.marker;
      connect(chainHead, marker);
      connect(marker, chainHead);
      chainHead = `${chainHead}>${marker}`;
    }
  }

  const MIN_CONNECTIONS = 3;
  const underFloor = [...connections.entries()]
    .filter(([key]) => !key.includes(">")) // only roots/markers are the "morphemes" this floor is about, not synthetic chain-heads
    .filter(([, others]) => others.size < MIN_CONNECTIONS);
  assert.deepEqual(
    underFloor,
    [],
    `expected every root/marker to connect to >= ${MIN_CONNECTIONS} distinct others; ` +
      `under the floor: ${underFloor.map(([k, others]) => `${k} (${others.size}: ${[...others].join(",")})`).join("; ")}`,
  );
});
