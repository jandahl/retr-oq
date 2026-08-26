// MORPH! puzzle set for the gb/ theme's minigame. Real morphemes, not
// invented ones: every root/marker/gloss pair below was checked against
// jandahl/oq's actual grammarian analysis engine (analyzeWordAsync via
// public-api.js) rather than hand-guessed -- see the game plan discussion
// for the probe method. TODO: this precomputation belongs in grammarian
// itself eventually (a puzzle-set endpoint any theme could pull from), not
// hand-picked here; this is the "start here, move it later" version.
//
// Each puzzle is a chain: the player builds a real word one morpheme at a
// time. Every step offers the correct next morpheme plus one or more real
// Kalaallisut morphemes that are wrong AT THIS STEP -- verified wrong by a
// real category rule (a noun case/plural ending cannot attach to a verb
// stem; a verb mood ending cannot attach to a bare noun stem), not made up.
// A step marked "suffix" is terminal (ends the word/round positively); a
// step marked "affix" continues the chain to the next step.
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
      // angut + t
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
      resultGloss: "he/she/it reads / is reading",
    },
  ];

  window.OqMorphGame = { puzzles };
})();
