# SYSTEM-INFO.md

Canonical hardware facts per theme, for quick reference in future
contexts. Not a style guide (see `CLAUDE.md` for that) — just the
numbers: native resolution, color depth, possible gamut, and palette
size/count. "Possible gamut" = everything the real hardware could
ever produce; "palette size/count" = how many of those colors are
selectable on screen at once. `tools/check_palette.py` enforces GAMUT
for `c64/` and `gb/` (screen colors only) and FAMILY (baseline +
distance check) for `nes/` `gb/` `gg/` `snes/` `c64/`.

| Theme | Native resolution | Color depth | Possible gamut | Palette size / count on-screen |
| --- | --- | --- | --- | --- |
| `dos/` | 640×480 (VGA text/CGA-ish chrome) | 4-bit (16 color EGA/VGA text) | 16 (EGA) / 256 (VGA 6-bit DAC) | 16 displayed |
| `c64/` | 320×200 (PAL 320×256 incl. border) | Fixed 4-bit index | **Exactly 16 colors, hardware-fixed** | 16 total, all 16 selectable at once (per pixel from the 16) |
| `mac1984/` | 512×342 | 1-bit | 2 (black/white) | 2 |
| `nes/` | 256×240 (NTSC) | PPU indexed | 64-entry PPU master palette (~54 unique, some duplicates) | 25 on screen at once (4 background palettes × 3 colors + 1 shared backdrop, doubled for sprites) |
| `amiga/` | 320×256 (PAL low-res) | OCS 12-bit RGB (4-4-4) | 4096 (12-bit OCS) | This theme: fixed 4-pen chrome (`#0055AA` white black `#FF8800`); art uses full 4096-color OCS range |
| `gb/` | 160×144 (DMG-01) | 2-bit (4 shades) | 4 fixed greens (DMG LCD) | 4 (gamut == palette, no larger master palette to pick from) |
| `gg/` | 160×144 | 12-bit master palette (4-4-4) | 4096 (Master System VDP) | 32 on screen at once (2 palettes × 16, incl. sprite) |
| `snes/` | 256×224 (NTSC) | 15-bit RGB (5-5-5) | 32,768 (SNES PPU) | 256 on screen at once (CGRAM, 8-bit indexed) |
| `win31/` `win98/` `xp/` `win7/` | Desktop-metaphor, resolution-independent (CSS) | n/a (vendor CSS theme, not emulated video hardware) | n/a | n/a — chrome fidelity governed by vendor dist (98.css / XP.css / 7.css), not a fixed hardware palette |
| `next/` | Desktop-metaphor, resolution-independent | n/a | n/a | Chrome constrained to 4 MegaPixel grays (theme convention, not hardware gamut) |
| `mac8/` | Desktop-metaphor, resolution-independent | n/a (era supported 8-bit/24-bit; theme doesn't emulate a fixed depth) | n/a | n/a |
| `kde/` | Desktop-metaphor, resolution-independent | n/a | n/a | n/a |

## Notes

- **Fixed vs. desktop-metaphor themes.** `c64/`, `gb/`, `nes/`, `gg/`,
  `snes/`, `mac1984/`, `amiga/` emulate real fixed-resolution,
  fixed-palette video hardware — the numbers above are hardware facts,
  not stylistic choices. `win31/` `win98/` `xp/` `win7/` `next/`
  `mac8/` `kde/` are desktop-metaphor themes skinned with vendor CSS
  (or, for `next/`/`kde/`, a hand-held convention) over an ordinary
  resolution-independent browser viewport — there is no fixed hardware
  screen to report.
- **GAMUT check scope is narrower than the whole theme.** For `gb/`
  it only covers the four DMG *screen* vars — the plastic shell isn't
  gamut-limited. For `c64/` it covers the whole theme, because a real
  C64's entire visible output (screen + border) had no colors outside
  the 16.
- **NES palette arithmetic**: 64-entry PPU master palette, but only
  25 distinct colors are visible on screen simultaneously (background:
  1 shared backdrop + 4 palettes × 3 colors = 13; sprites: another 4
  palettes × 3 colors = 12; backdrop shared between the two).
- **Amiga is a hybrid**: hardware gamut is the full 4096-color OCS
  space, but this theme's own *chrome* convention pins it to exactly
  four Kickstart 1.3 pens — see `CLAUDE.md` under `amiga/`. Don't
  conflate the chrome constraint with the art's OCS gamut.
- **Game Gear is a pocket Master System**, not a Game Boy Color — its
  gamut is the SMS VDP's 4096, with 32 simultaneous on screen (2×16),
  not a DMG-style fixed 4-shade set.
- Sources: `CLAUDE.md` (theme invariants), `README.md` (launch years,
  vendor CSS), `tools/check_palette.py` (which themes declare a canon
  palette and which check applies).
