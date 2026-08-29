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
// Reuse pass (2026-08): every root and marker below is meant to connect to
// at least 3 OTHER morphemes in this same file -- not a hardcoded rule
// anywhere, just a design target for how much a small, hand-picked puzzle
// set can still show a morpheme recombining, without growing the set of
// distinct morphemes itself (a percentage-based version of this target is
// future work, not done here). The batch below was found generatively, not
// by grepping for existing attestations: for every (root, construction)
// pair among this file's own roots and markers, jandahl/oq's real engine
// (docs/public-api.js's buildWord(), the same forward compositor that
// applies real phonology/sandhi -- not a guessed spelling) was asked
// whether the sequence is grammatical at all, and if so what it actually
// builds to. Every kept result was then round-tripped back through
// analyzeWord() to confirm the analyzer's own top parse recovers the exact
// intended chain, and checked for `approximate: false` (no unimplemented
// sandhi rule was silently guessed at). `atuar` (the one verb root) was
// left out of this pass: none of the noun-oriented constructions below
// apply to it, so it stayed stuck at 1 connection and was pulled from the
// set entirely rather than shipped under-connected.
//
// A couple of these combinations are grammatically clean but pragmatically
// unusual sentences to actually say (e.g. "I have a man (with us)",
// "there's a birthday" as an existence statement) -- flagged inline where
// that's the case. Grammatical correctness (verified by the engine) and
// natural idiomaticity are different bars; this batch clears the first for
// all twelve, and the second for most.
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
    // The three puzzles below were originally supplied directly (root +
    // chain + resultWord) without analyzer access, and flagged pending
    // re-verification. Since re-checked against jandahl/jandahl-custom-KAL-grammarian's
    // verified worked_examples index (kalaallisut_data/worked_examples/verbal.yaml,
    // nominal.yaml) and stem/affix entries (kalaallisut_data/stems/nouns.yaml,
    // kalaallisut_data/affixes/denominal_verbs.yaml, kalaallisut_data/affixes/deverbal_nouns.yaml,
    // kalaallisut_data/endings/verb_moods.yaml) rather than hand-guessed --
    // that repo's own CLAUDE.md requires every worked-example surface form
    // to be independently attested in a cited source, so a match there is a
    // stronger guarantee than this file's own analyzer probe. Their
    // wrong-distractor picks still reuse only already-established markers
    // from this same file (mi/t/qaq), which grammarian's stem/affix entries
    // corroborate as genuinely non-matching for these exact roots.
    {
      // Verified: grammarian's worked_examples/verbal.yaml "qimmeqarpoq"
      // entry attests qimmeq + N_qaq_Vb + V_IND_INTR_3SG ("He has a dog.",
      // Fortescue1984:270/Lybech2020:154/Sadock1980:307/AITWG:§2.4); the
      // 1sg ending used here (-vunga) is grammarian's own V_IND_INTR_1SG
      // (kalaallisut_data/endings/verb_moods.yaml), and -qaq + -vunga
      // surfaces as -qarpunga by the same q-final pattern the 3sg example
      // already shows (-qaq + -poq -> -qarpoq).
      root: "qimmeq",
      rootGloss: "dog",
      steps: [
        {
          correct: { marker: "qaq", type: "affix", gloss: "to have a ___" },
          wrong: [
            { marker: "mi", gloss: "in/at" },
          ],
        },
        {
          correct: { marker: "vunga", type: "suffix", gloss: "statement -- I" },
          wrong: [
            { marker: "t", gloss: "plural" },
          ],
        },
      ],
      // qimmeq + qaq + vunga
      resultWord: "qimmeqarpunga",
      resultGloss: "I have a dog",
    },
    {
      // Verified: grammarian's inuk stem entry (kalaallisut_data/stems/nouns.yaml)
      // cites this exact form as its own pedagogy example ("inuit", absolutive
      // plural), independently corroborated by AITWG:§6.7/§7.5, Nielsen2012:§4.1.4.2.1,
      // and Bjornum2012:K4§2c -- inuk is a regular up-declined k-stem whose
      // final /k/ drops before the vowel-initial plural ending.
      root: "inuk",
      rootGloss: "person",
      steps: [
        {
          correct: { marker: "t", type: "suffix", gloss: "plural" },
          wrong: [
            { marker: "qaq", gloss: "to have a ___" },
          ],
        },
      ],
      // inuk + t (surfaces with the same k+t epenthesis pattern as angut + t -> angutit)
      resultWord: "inuit",
      resultGloss: "people, Inuit",
    },
    {
      // Verified against grammarian (kalaallisut_data/stems/nouns.yaml's
      // inuuik entry, kalaallisut_data/affixes/denominal_verbs.yaml's
      // N_siuq_Vb, kalaallisut_data/affixes/deverbal_nouns.yaml's V_soq_N,
      // and the worked_examples/nominal.yaml "inuuissiortoq" entry).
      // inuuik ("birthday") is its own stem, distinct from inuk ("person")
      // despite the visual similarity. -sior/-siuq here carries its
      // "celebrates N" sense (denominal_verbs.yaml's N_siuq_Vb, attested
      // for this exact root by grammarian's sibling "inuuissiorpoq" entry,
      // "He celebrates his birthday" -- Bjornum2012:K9§6, Katersat:lex_33741).
      // The agentive participle affix surfaces as -toq (not -soq) after
      // this r-final derived stem -- inuuissiortoq is independently attested
      // three ways per grammarian's own worked example: katersat-mirror's
      // lex_8237 ("birthday person"), Oqaatsit1997 and
      // Oqaasileriffik-KAL-ENG-dicts as their own headword, and
      // Bjornum2012:K3§5g's example sentence. Display marker kept as "soq"
      // (this file's own convention of a plain marker label vs. the real
      // phonologically-adjusted resultWord, same as illu's -voq/-poq above).
      root: "inuuik",
      rootGloss: "birthday",
      steps: [
        {
          correct: { marker: "sior", type: "affix", gloss: "to celebrate ___" },
          wrong: [
            { marker: "qaq", gloss: "to have a ___" },
          ],
        },
        {
          correct: { marker: "soq", type: "suffix", gloss: "the one who/that ___s" },
          wrong: [
            { marker: "mi", gloss: "in/at" },
          ],
        },
      ],
      // inuuik + sior + soq (-toq allomorph after the r-final derived stem)
      resultWord: "inuuissiortoq",
      resultGloss: "birthday person",
    },
    // --- Reuse batch (2026-08): new chains on ALREADY-ESTABLISHED roots and
    // markers above (illu/nuna/angut/qimmeq/inuk/inuuik x qaq/t/mi/sior/soq/
    // voq/vunga) -- see this file's header comment for how these were found
    // (jandahl/oq's buildWord() + a round-trip analyzeWord() check) and why
    // (every morpheme reaching 3+ connections). Zero new morphemes below;
    // only new combinations of the ones already used above.
    {
      root: "illu",
      rootGloss: "house, home",
      steps: [
        {
          correct: { marker: "t", type: "suffix", gloss: "plural" },
          // illu's own qaq puzzle above is real but wrong for this round.
          wrong: [
            { marker: "qaq", gloss: "to have a ___" },
          ],
        },
      ],
      // illu + t
      resultWord: "illut",
      resultGloss: "houses",
    },
    {
      root: "illu",
      rootGloss: "house, home",
      steps: [
        {
          correct: { marker: "sior", type: "affix", gloss: "to look for ___" },
          // illu's own qaq puzzle above is real but wrong for this round.
          wrong: [
            { marker: "qaq", gloss: "to have a ___" },
          ],
        },
        {
          correct: { marker: "soq", type: "suffix", gloss: "the one who/that ___s" },
          // Same -toq allomorph pattern as the inuuik+sior+soq entry above
          // (an r-final derived-verb host takes -toq, spelled here as the
          // plain "soq" marker label -- see this file's header comment on
          // marker text vs. resultWord).
          wrong: [
            { marker: "t", gloss: "plural" },
          ],
        },
      ],
      // illu + sior + soq (-toq allomorph)
      resultWord: "illusiortoq",
      resultGloss: "house-seeker (one looking for a house)",
    },
    {
      root: "nuna",
      rootGloss: "land, country, ground",
      steps: [
        {
          correct: { marker: "t", type: "suffix", gloss: "plural" },
          // nuna's own mi puzzle above is real but wrong for this round.
          wrong: [
            { marker: "mi", gloss: "in/at" },
          ],
        },
      ],
      // nuna + t
      resultWord: "nunat",
      resultGloss: "lands, countries",
    },
    {
      root: "nuna",
      rootGloss: "land, country, ground",
      steps: [
        {
          correct: { marker: "qaq", type: "affix", gloss: "to have a ___" },
          wrong: [
            { marker: "mi", gloss: "in/at" },
          ],
        },
        {
          correct: { marker: "vunga", type: "suffix", gloss: "statement -- I" },
          wrong: [
            { marker: "t", gloss: "plural" },
          ],
        },
      ],
      // nuna + qaq + vunga
      resultWord: "nunaqarpunga",
      resultGloss: "I have land",
    },
    {
      root: "angut",
      rootGloss: "man, male",
      steps: [
        {
          correct: { marker: "mi", type: "suffix", gloss: "in/at" },
          // angut's own plural puzzle above is real but wrong for this round.
          wrong: [
            { marker: "t", gloss: "plural" },
          ],
        },
      ],
      // angut + mi
      resultWord: "angutimi",
      resultGloss: "at/on the man",
    },
    {
      root: "angut",
      rootGloss: "man, male",
      steps: [
        {
          correct: { marker: "qaq", type: "affix", gloss: "to have a ___" },
          wrong: [
            { marker: "t", gloss: "plural" },
          ],
        },
        {
          correct: { marker: "vunga", type: "suffix", gloss: "statement -- I" },
          wrong: [
            { marker: "mi", gloss: "in/at" },
          ],
        },
      ],
      // angut + qaq + vunga -- grammatical but a pragmatically unusual
      // thing to actually say (context: counting people present by sex).
      resultWord: "anguteqarpunga",
      resultGloss: "I have a man (with us)",
    },
    {
      root: "qimmeq",
      rootGloss: "dog",
      steps: [
        {
          correct: { marker: "mi", type: "suffix", gloss: "in/at" },
          // qimmeq's own qaq puzzle above is real but wrong for this round.
          wrong: [
            { marker: "qaq", gloss: "to have a ___" },
          ],
        },
      ],
      // qimmeq + mi
      resultWord: "qimmermi",
      resultGloss: "at/on the dog",
    },
    {
      root: "qimmeq",
      rootGloss: "dog",
      steps: [
        {
          correct: { marker: "sior", type: "affix", gloss: "to travel on/through ___" },
          wrong: [
            { marker: "qaq", gloss: "to have a ___" },
          ],
        },
        {
          correct: { marker: "soq", type: "suffix", gloss: "the one who/that ___s" },
          wrong: [
            { marker: "vunga", gloss: "statement -- I" },
          ],
        },
      ],
      // qimmeq + sior + soq (-toq allomorph)
      resultWord: "qimmersiortoq",
      resultGloss: "dog-sledder (one who travels by dog[sled])",
    },
    {
      root: "inuk",
      rootGloss: "person",
      steps: [
        {
          correct: { marker: "mi", type: "suffix", gloss: "in/at" },
          // inuk's own plural puzzle above is real but wrong for this round.
          wrong: [
            { marker: "t", gloss: "plural" },
          ],
        },
      ],
      // inuk + mi
      resultWord: "inummi",
      resultGloss: "at/on the person",
    },
    {
      root: "inuk",
      rootGloss: "person",
      steps: [
        {
          correct: { marker: "qaq", type: "affix", gloss: "to have a ___" },
          wrong: [
            { marker: "mi", gloss: "in/at" },
          ],
        },
        {
          correct: { marker: "voq", type: "suffix", gloss: "statement -- he/she/it" },
          wrong: [
            { marker: "t", gloss: "plural" },
          ],
        },
      ],
      // inuk + qaq + voq -- an idiomatic way to say a place is inhabited.
      resultWord: "inoqarpoq",
      resultGloss: "there are people (it's inhabited)",
    },
    {
      root: "inuuik",
      rootGloss: "birthday",
      steps: [
        {
          correct: { marker: "mi", type: "suffix", gloss: "in/at" },
          // inuuik's own sior puzzle above is real but wrong for this round.
          wrong: [
            { marker: "sior", gloss: "to celebrate ___" },
          ],
        },
      ],
      // inuuik + mi
      resultWord: "inuuimmi",
      resultGloss: "at/on the birthday",
    },
    {
      root: "inuuik",
      rootGloss: "birthday",
      steps: [
        {
          correct: { marker: "qaq", type: "affix", gloss: "to have a ___" },
          wrong: [
            { marker: "sior", gloss: "to celebrate ___" },
          ],
        },
        {
          correct: { marker: "voq", type: "suffix", gloss: "statement -- he/she/it" },
          wrong: [
            { marker: "t", gloss: "plural" },
          ],
        },
      ],
      // inuuik + qaq + voq -- grammatical, and a natural-enough existence
      // statement ("there's an occasion/a birthday").
      resultWord: "inuueqarpoq",
      resultGloss: "there's a birthday/occasion",
    },
  ];

  window.OqMorphPuzzles = { puzzles };
})();
