// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// Ported from jandahl/oq's docs/hyphenation.js (MPL-2.0) -- an unmodified
// copy of that file lives at vendor/oq-hyphenation/hyphenation.js for
// provenance/licensing reference. This is a Modification of that Covered
// Software under MPL-2.0 terms (same algorithm, adapted from an ES module
// `export` to the classic-script window-global pattern every other
// shared/*.js and theme app.js in this repo uses, for the same file://
// CORS reason documented in dos/app.js), so it carries the same license
// rather than this repo's usual MIT.
//
// Kalaallisut (Greenlandic) syllabification for word-splitting at line
// breaks. Rules from Oqaasileriffik: https://oqaasileriffik.gl/da/vaerktoejer/orddeling-ved-ny-linje/
// See jandahl/oq's docs/HYPHENATION.md for the full specification,
// worked examples, and a 28-case test suite (docs/test-hyphenation.js)
// this port was checked against (all 28 pass unmodified).
//
// Reusable the same way shared/dict-source.js is: any theme with long
// Kalaallisut text to wrap (dos/DICT.EXE today) can call
// window.OqHyphenation.syllabify() instead of falling back to a blind
// overflow-wrap:anywhere character-count break, which ignores syllable
// boundaries entirely.

(() => {
  "use strict";

  const SOFT_HYPHEN = "­";

  function isVowel(c) {
    return c === "a" || c === "i" || c === "u" || c === "e" || c === "o";
  }

  function isConsonant(c) {
    return !isVowel(c) && c.charCodeAt(0) !== 0;
  }

  /**
   * Inserts soft hyphens (U+00AD) at valid syllable break points in a
   * Kalaallisut word, following Oqaasileriffik's syllabification rules.
   * A soft hyphen is invisible unless the browser actually needs to break
   * the line there, so this is safe to apply unconditionally -- it never
   * changes how the word looks when it already fits.
   * @param {string} word
   * @returns {string}
   */
  function syllabify(word) {
    if (!word || word.length < 2) return word;

    let result = "";
    let i = 0;

    while (i < word.length) {
      result += word[i];

      if (i < word.length - 1) {
        const curr = word[i];
        const next = word[i + 1];
        const nextNext = i + 2 < word.length ? word[i + 2] : "";

        let shouldBreak = false;

        // Rule 3c: 'nng' -> breaks as n-ng (split after first 'n')
        if (curr === "n" && next === "n" && nextNext === "g") {
          shouldBreak = true;
        }
        // Rule 3b: 'ng' is one phoneme -> never break within it
        else if (curr === "n" && next === "g") {
          shouldBreak = false;
        }
        // Rule 2a: Long vowels (same vowel doubled) -> never break within them
        else if (isVowel(curr) && curr === next) {
          shouldBreak = false;
        }
        // Rule 3a: CC cluster -> break between first and second consonant
        else if (isConsonant(curr) && isConsonant(next)) {
          shouldBreak = true;
        }
        // Rule 2b: Different adjacent vowels -> break between them,
        // except 'ai' in word-final inflectional context
        else if (isVowel(curr) && isVowel(next) && curr !== next) {
          if (curr === "a" && next === "i") {
            const afterAi = i + 2 < word.length ? word[i + 2] : "";
            shouldBreak = !(afterAi === "" || afterAi === "t" || afterAi === "q" || afterAi === "p");
          } else {
            shouldBreak = true;
          }
        }
        // Default syllabic pattern: V-CV or V-ngV
        else if (isVowel(curr) && isConsonant(next)) {
          if (next === "n" && i + 2 < word.length && word[i + 2] === "g" && i + 3 < word.length && isVowel(word[i + 3])) {
            shouldBreak = true; // V-ngV: break before ng (treating ng as an onset unit)
          } else if (i + 2 < word.length && isVowel(word[i + 2]) && !(next === "n" && word[i + 2] === "g")) {
            shouldBreak = true; // V-C-V: single consonant (not ng) between vowels
          }
        }

        if (shouldBreak) result += SOFT_HYPHEN;
      }

      i++;
    }

    return result;
  }

  window.OqHyphenation = { syllabify };
})();
