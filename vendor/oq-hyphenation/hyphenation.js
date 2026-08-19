// Kalaallisut (Greenlandic) syllabification for word-splitting at line breaks.
// Rules from Oqaasileriffik: https://oqaasileriffik.gl/da/vaerktoejer/orddeling-ved-ny-linje/
// See HYPHENATION.md for full specification and examples.

const SOFT_HYPHEN = '­';

function _isVowel(c) {
	return c === 'a' || c === 'i' || c === 'u' || c === 'e' || c === 'o';
}

function _isConsonant(c) {
	return !_isVowel(c) && c.charCodeAt(0) !== 0; // ASCII letter is consonant if not vowel
}

/**
 * Inserts soft hyphens (U+00AD) at valid syllable break points in a Kalaallisut word.
 * Follows the syllabification rules from Oqaasileriffik.
 *
 * @param {string} word - The Kalaallisut word to syllabify
 * @returns {string} The word with soft hyphens inserted at break points
 */
export function syllabify(word) {
	if (!word || word.length < 2) {
		return word;
	}

	let result = '';
	let i = 0;

	while (i < word.length) {
		result += word[i];

		// Check for potential break point AFTER position i
		if (i < word.length - 1) {
			const curr = word[i];
			const next = word[i + 1];
			const nextNext = i + 2 < word.length ? word[i + 2] : '';

			let shouldBreak = false;

			// Rule 3c: 'nng' → breaks as n­ng (split after first 'n')
			if (curr === 'n' && next === 'n' && nextNext === 'g') {
				shouldBreak = true;
			}
			// Rule 3b: 'ng' is one phoneme → never break within it
			else if (curr === 'n' && next === 'g') {
				shouldBreak = false;
			}
			// Rule 2a: Long vowels (same vowel doubled) → never break within them
			else if (_isVowel(curr) && curr === next) {
				shouldBreak = false;
			}
			// Rule 3a: CC cluster → break between first and second consonant
			else if (_isConsonant(curr) && _isConsonant(next)) {
				shouldBreak = true;
			}
			// Rule 2b: Different adjacent vowels → break between them
			// EXCEPT for 'ai' in word-final inflectional context
			else if (_isVowel(curr) && _isVowel(next) && curr !== next) {
				if (curr === 'a' && next === 'i') {
					const afterAi = i + 2 < word.length ? word[i + 2] : '';
					// Don't break if this looks like a word-final '-ai' inflection
					shouldBreak = !(afterAi === '' || afterAi === 't' || afterAi === 'q' || afterAi === 'p');
				} else {
					shouldBreak = true;
				}
			}
			// Default syllabic pattern: V-CV or V-ngV
			// If curr is a vowel and there's a single consonant before the next vowel,
			// the consonant should go with the next vowel (onset position).
			else if (_isVowel(curr) && _isConsonant(next)) {
				// Check for V-ng-V: the 'ng' digraph after a vowel, before a vowel
				if (next === 'n' && i + 2 < word.length && word[i + 2] === 'g' && i + 3 < word.length && _isVowel(word[i + 3])) {
					// V­ngV: break before ng (treating ng as an onset unit)
					shouldBreak = true;
				}
				// Check for V-C-V: single consonant (not ng) between vowels
				else if (i + 2 < word.length && _isVowel(word[i + 2]) && !(next === 'n' && word[i + 2] === 'g')) {
					// Single C between V and V: V­CV pattern
					shouldBreak = true;
				}
			}

			if (shouldBreak) {
				result += SOFT_HYPHEN;
			}
		}

		i++;
	}

	return result;
}
