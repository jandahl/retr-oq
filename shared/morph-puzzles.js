// Puzzle data for shared/morph-game.js's MORPH! engine -- not tied to gb/
// or any theme: it's just real dictionary/grammar facts (a root, a chain of
// morphemes, their glosses), the same kind of reusable, render-agnostic
// data shared/dict-source.js already provides. Any theme wiring up the
// minigame (gb/ today, a future console theme tomorrow) loads this before
// its own app.js the same way it loads shared/morph-game.js.
//
// Real morphemes, not invented ones: every root/marker/gloss pair below was
// checked against jandahl/oq's actual grammarian analysis engine
// (analyzeWordAsync via public-api.js) rather than hand-guessed -- see the
// game plan discussion for the probe method. TODO: this precomputation
// belongs in grammarian itself eventually (a puzzle-set endpoint any theme
// could pull from), not hand-picked here; this is the "start here, move it
// later" version.
//
// Each puzzle is a chain: the player builds a real word one morpheme at a
// time. Every step offers the correct next morpheme plus one or more real
// Kalaallisut morphemes that are wrong AT THIS STEP -- verified wrong by a
// real category rule (a noun case/plural ending cannot attach to a verb
// stem; a verb mood ending cannot attach to a bare noun stem), not made up.
// A step marked "suffix" is terminal (ends the word/round positively); a
// step marked "affix" continues the chain to the next step.
//
// `resultWord` is the REAL final surface spelling (straight from the same
// analyzeWordAsync() probe, m.word) -- not derived by concatenating this
// file's own `marker` strings. Kalaallisut inserts epenthetic vowels at
// some morpheme boundaries (angut + t surfaces as "angutit", not "angutt")
// that the analyzer's phonology step handles and a naive string-join
// can't; `marker` stays the plain per-step affix text shown on each
// option bubble mid-round, `resultWord` is what the round-win card shows
// as the completed word so it's never a spelling the game itself got wrong.
(() => {
  "use strict";

  const puzzles = [
    {
      root: "illu",
      rootGloss: "house, home",
      steps: [
        {
          correct: { marker: "qaq", type: "affix", gloss: "to have a ___" },
          wrong: [
            { marker: "mi", gloss: "in/at (a noun case ending -- can't attach here, this isn't a complete noun yet)" },
            { marker: "t", gloss: "plural (a noun ending -- can't attach here, this isn't a complete noun yet)" },
          ],
        },
        {
          correct: { marker: "voq", type: "suffix", gloss: "statement -- he/she/it" },
          wrong: [
            { marker: "t", gloss: "plural (a noun ending -- can't attach to a verb stem)" },
          ],
        },
      ],
      // illu + qaq + voq
      resultWord: "illoqarpoq",
      resultGloss: "he/she/it has a house",
    },
    {
      root: "nuna",
      rootGloss: "land, country, ground",
      steps: [
        {
          correct: { marker: "mi", type: "suffix", gloss: "in/at" },
          wrong: [
            { marker: "voq", gloss: "statement, he/she/it (a verb ending -- can't attach to a bare noun stem)" },
          ],
        },
      ],
      // nuna + mi
      resultWord: "nunami",
      resultGloss: "in/at the land",
    },
    {
      root: "angut",
      rootGloss: "man, male",
      steps: [
        {
          correct: { marker: "t", type: "suffix", gloss: "plural" },
          wrong: [
            { marker: "voq", gloss: "statement, he/she/it (a verb ending -- can't attach to a bare noun stem)" },
          ],
        },
      ],
      // angut + t (surfaces with an epenthetic vowel: angutit, not angutt)
      resultWord: "angutit",
      resultGloss: "men",
    },
    {
      root: "atuar",
      rootGloss: "to read; to study",
      steps: [
        {
          correct: { marker: "voq", type: "suffix", gloss: "statement -- he/she/it" },
          wrong: [
            { marker: "mi", gloss: "in/at (a noun case ending -- can't attach to a verb stem)" },
          ],
        },
      ],
      // atuar + voq
      resultWord: "atuarpoq",
      resultGloss: "he/she/it reads / is reading",
    },
  ];

  window.OqMorphPuzzles = { puzzles };
})();
