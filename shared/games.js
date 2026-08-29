// retr-oq games/programs catalogue -- not wired into any theme, this is a
// reference data structure only (source of truth for the README matrix).
// Update both when a theme gains or loses a game/easter egg.
//
// kind: "core" (OQ!/DECON, present everywhere), "game" (a real minigame),
// "demo" (visual/audio toggle, not interactive play), "egg" (undocumented
// or joke easter egg).
window.OqGames = {
  games: [
    { id: "oq", name: "OQ! dictionary", kind: "core" },
    { id: "decon", name: "DECON", kind: "core" },
    { id: "morph", name: "MORPH!", kind: "game" },
    { id: "kal-q", name: "Super KAL-Q! (Klax)", kind: "game" },
    { id: "konami", name: "Konami Code", kind: "egg" },
    { id: "doom", name: "DOOM", kind: "egg" },
    { id: "boing", name: "Boing Ball", kind: "demo" },
    { id: "copper", name: "Copper bars", kind: "demo" },
    { id: "panic", name: "Kernel panic", kind: "egg" },
    { id: "kde-rain", name: "Compiz rain", kind: "demo" },
    { id: "kde-cube", name: "Desktop cube", kind: "demo" },
    { id: "solitaire", name: "Solitaire (joke)", kind: "egg" },
    { id: "hotdog", name: "Hot Dog Stand scheme", kind: "egg" },
    { id: "credits", name: "Hidden credits", kind: "egg" },
  ],
  // theme -> game ids present in that theme. oq/decon are in every theme
  // and omitted here for brevity -- they're implied by the theme existing.
  matrix: {
    dos: ["doom"],
    c64: ["morph"],
    mac1984: [],
    nes: ["konami"],
    amiga: ["boing", "copper"],
    gb: ["morph", "konami"],
    gg: ["konami"],
    snes: ["kal-q", "konami"],
    win31: ["solitaire", "credits"],
    next: ["panic"],
    mac8: [],
    win98: ["hotdog"],
    xp: [],
    kde: ["kde-rain", "kde-cube"],
    win7: [],
  },
};
