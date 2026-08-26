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
// time. Every step offers the correct next morpheme plus one or more other
// real Kalaallisut morphemes that are wrong for the word THIS ROUND is
// building. A step marked "suffix" is terminal (ends the word/round
// positively); a step marked "affix" continues the chain to the next step.
//
// A wrong option's `gloss` is ONLY that morpheme's own real meaning --
// never an invented claim about WHY it's wrong ("can't attach to a verb
// stem", etc). An earlier version of this file did assert reasons like
// that, checked only by hand, and got real Kalaallisut facts wrong twice:
// (1) angut + voq was used as a "can't attach to a bare noun" distractor,
// but root-final t + v assimilates in real Kalaallisut, and "anguvoq" is
// a real dictionary word ("catches a seal") -- unrelated to "angut" in
// origin, but a real, confusing collision to present as impossible.
// (2) mi attached to a verb stem (atuar + mi) isn't the noun-locative
// "in/at" sense at all -- the analyzer's own real parse of "atuarmi" gives
// "what about ___?", a completely different morpheme that happens to
// share the same spelling. Every wrong option below was re-verified
// against the analyzer/dictionary for its EXACT root+marker pairing
// (not just "this marker is real somewhere") before being kept.
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
          // illumi/illut are both real, complete words (illu already
          // needs no ending of its own) -- genuinely wrong for THIS
          // round only because they end the word on something other
          // than "has a house", not because they're ungrammatical.
          wrong: [
            { marker: "mi", gloss: "in/at" },
            { marker: "t", gloss: "plural" },
          ],
        },
        {
          correct: { marker: "voq", type: "suffix", gloss: "statement -- he/she/it" },
          // "illuqaqt" has no valid parse at all (verified 0 matches) --
          // a safe, non-colliding wrong pick, shown with -t's own plain
          // meaning rather than any claim about why it fails here.
          wrong: [
            { marker: "t", gloss: "plural" },
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
          // "nunaqaq" is a real, verified chain (nuna + "to have a ___")
          // -- genuinely wrong here only because -qaq is an affix, not an
          // ending: it continues the word instead of finishing it.
          wrong: [
            { marker: "qaq", gloss: "to have a ___" },
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
          // "angutqaq" has no valid parse (verified 0 matches) -- unlike
          // this puzzle's very first draft, which used -voq here: angut's
          // final t assimilates with a following v in real Kalaallisut,
          // and "anguvoq" turned out to already be a real, unrelated
          // dictionary word ("catches a seal") -- a genuinely bad
          // distractor, not just a wording problem.
          wrong: [
            { marker: "qaq", gloss: "to have a ___" },
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
          // "atuarmi" IS a real, verified chain -- just not the noun
          // locative sense; on a verb stem this -mi is a different
          // morpheme meaning "what about ___?". Shown with that real
          // gloss, not the wrong one an earlier draft of this file used.
          wrong: [
            { marker: "mi", gloss: "what about ___?" },
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
