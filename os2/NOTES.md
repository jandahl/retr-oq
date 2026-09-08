# os2/ — internal notes

The OQ!2 theme is a host desktop, not a recolored Windows 3.1 page. The outer
shell is Workplace Shell/Presentation Manager-inspired; the Win-OQ!2 guest
deliberately reuses `win31/index.html`, and the DOS guest deliberately reuses
`dos/index.html` so guest updates are reflected here automatically.

The current scaffold uses iframe session boundaries. Replace those boundaries
with shared guest modules only if embedding requires tighter routing or focus
integration; do not copy either guest's application logic into this theme.

- **Word Deconstructor** is a Workplace Shell object / PM window that iframes `win31/index.html?screen=decon`, mirroring how OQ!2 Dictionary iframes `?screen=oq`. Desktop + System folder icons open `#decon-window`.
