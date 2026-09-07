# vendor/beos — attribution

There is no 98.css-class drop-in for BeOS. The only reusable web CSS
with a yellow title tab is NovusGFX's retro-design-system BeOS demo:

  https://github.com/NovusGFX/retro-design-system
  styles/07-beos/index.html + tokens/07-beos.css
  MIT License (copy in LICENSE next to this file)

`beos/` is still an own-WM theme (hand-drawn chrome, like next/ and
kde/). What was actually taken from NovusGFX:

  - the skewed yellow-tab `::after { transform: skewX(...) }` trick
  - the idea of a compact Deskbar stack in the upper right
  - pill-shaped default buttons and inset text fields as a starting
    point, then redrawn against R5 screenshots

What was *not* taken:

  - their desktop teal `#2a5556` — real BeOS Blue is RGB 51,102,152
    (`#336698`)
  - `"Swiss 721"` as a font-family — that's a commercial Bitstream
    face; this theme reuses TeX Gyre Heros from `vendor/next/fonts/`
  - any Be / Haiku leaf or bee artwork (trademark; CLAUDE.md original
    art rule)

Do not vendor the full NovusGFX `index.html`. Tokens live in
`beos/style.css` `:root` so they stay next to the chrome they style.
