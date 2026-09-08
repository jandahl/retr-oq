# Dictionary data sources (retr-oq)

Runtime HTTP fetch only. **Do not vendor** published JSON into this MIT
repository.

Authoritative license detail for both corpora lives in
[`jandahl/oq` `docs/SOURCES.md`](https://github.com/jandahl/oq/blob/master/docs/SOURCES.md)
— prefer the **detailed §3 prose** over the mermaid diagram (the diagram
still slips and labels katersat data as CC-BY-SA).

## Project-wide choke point

**Every theme’s OQ! list** goes through `window.OqDictSource.loadDictEntries()`
(`shared/dict-source.js`). That call:

1. Loads Chicago via `loadChicagoOnly()`.
2. Merges katersat when `katersat-source.js` + `dict-merge.js` are on the page
   (all OQ! themes load both after `dict-source.js`).
3. On katersat failure → Chicago-only (`katersatLoaded: false`).
4. Refreshes `#oq-attribution` / `#dict-attribution` via
   `applyDictAttribution()` so themes that snapshot `DICT_ATTRIBUTION` at
   init still show the GPL line after load.

Themes do **not** need per-app merge wiring — keep calling `loadDictEntries()`
and `DICT_ATTRIBUTION` as before.

**DECON** morphology still comes from `oq-api`’s `findExactDictMatch` (already
multi-source upstream). Lexeme/gloss lists in OQ! windows use this merge
layer.

## Chicago / Oqaasileriffik-dicts

| | |
| --- | --- |
| **URL** | `https://jandahl.github.io/Oqaasileriffik-dicts/all_entries.json` |
| **Loader** | `shared/dict-source.js` → `loadChicagoOnly()` / `loadDictEntries()` |
| **License** | **CC-BY-SA 4.0** (code + published JSON) |
| **Attribution** | `Oqaasileriffik (Greenlandic Language Secretariat), 2018 Chicago Kalaallisut–English Dictionary, CC-BY-SA 4.0` |

Shape: `{ dictionary_entries: [{ id?, lexeme, gloss_en, … }] }`.

## Katersat / Oqaasileriffik-katersat

| | |
| --- | --- |
| **Preferred URL** | `https://jandahl.github.io/Oqaasileriffik-katersat/lexicon.json.gz` (~3.9MB) |
| **Fallback** | `lexicon.json`, then `by-letter/{letter}.json` / `.json.gz` |
| **Loader** | `shared/katersat-source.js` → `window.OqKatersatSource` |
| **License** | **GPL-3.0-or-later** for published JSON (no CC-BY-SA grant) |
| **Attribution** | `Oqaasileriffik / Greenland Language Secretariat — katersat lexicon (GPL-3.0-or-later)` |

Schema: `{ meta, lexemes: [{ id, kalaallisut, english: string[], danish: string[], … }] }`.

### Gzip load path

1. `fetch(lexicon.json.gz)` + `DecompressionStream('gzip')` when available.
2. Else `fetch(lexicon.json)`.
3. Else walk `by-letter/{a–z,æ,ø,å}.json.gz` then `.json` and concatenate `lexemes`.

## Merge rules (Option C)

`shared/dict-merge.js` → used by `loadDictEntries()`:

1. Index both by lowercased surface (`lexeme` / `kalaallisut`).
2. Chicago rows stay. Empty Chicago `gloss_en` + katersat english → **backfill**,
   `glossSource: 'katersat'`, `sources: ['chicago','katersat']`.
3. Katersat headwords not in Chicago → append (`source: 'katersat'`).
4. Multiple English senses / homograph surfaces → join with `"; "` (deduped).
   No danish→english gloss fallback (empty english stays empty, e.g. `aalajavoq`).

## UI obligations

Show Chicago attribution wherever dictionary data is shown; when katersat
loaded, also show the GPL line. Shared `applyDictAttribution()` covers the
common `#oq-attribution` / `#dict-attribution` nodes.

## No-vendoring policy

Copying GPL-3.0-or-later katersat JSON into this MIT tree would create a
redistribution / license-mixing problem this repo does not take on. Fetch +
attribute at runtime is the supported pattern (same as oq).
