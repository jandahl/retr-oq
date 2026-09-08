(() => {
  "use strict";

  // Time Machine–inspired OS X era switcher (visual skins only).
  // Persists html[data-osx-era] via localStorage key retr-oq:aqua-osx-era.

  const ERA_KEY = "retr-oq:aqua-osx-era";
  const ERAS = [
    {
      id: "aqua",
      year: "2001",
      name: "Aqua",
      blurb: "Cheetah–Puma jelly & shelf Dock",
    },
    {
      id: "tiger",
      year: "2005",
      name: "Tiger",
      blurb: "Unified toolbar · metal-ish chrome",
    },
    {
      id: "leopard",
      year: "2007",
      name: "Leopard",
      blurb: "Dark menubar · reflective Dock",
    },
    {
      id: "lion",
      year: "2011",
      name: "Lion",
      blurb: "Peak skeuomorphism · linen & leather",
    },
    {
      id: "yosemite",
      year: "2014",
      name: "Yosemite",
      blurb: "Translucent flat · vibrancy blur",
    },
    {
      id: "bigsur",
      year: "2020",
      name: "Big Sur",
      blurb: "Rounder chrome · dense translucency",
    },
    {
      id: "glass",
      year: "2026",
      name: "Glassholism",
      blurb: "Maximal liquid glass · frost & bloom",
    },
  ];

  const ERA_IDS = new Set(ERAS.map((e) => e.id));

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function readStoredEra() {
    try {
      const v = localStorage.getItem(ERA_KEY);
      if (ERA_IDS.has(v)) return v;
    } catch {
      /* ignore */
    }
    return "aqua";
  }

  function writeStoredEra(id) {
    try {
      localStorage.setItem(ERA_KEY, id);
    } catch {
      /* ignore */
    }
  }

  function applyEra(id, { persist = false } = {}) {
    const era = ERA_IDS.has(id) ? id : "aqua";
    document.documentElement.dataset.osxEra = era;
    if (persist) writeStoredEra(era);
    return era;
  }

  function currentEra() {
    const d = document.documentElement.dataset.osxEra;
    return ERA_IDS.has(d) ? d : "aqua";
  }

  // Ensure attribute exists even if boot script missed (tests / odd loads).
  if (!document.documentElement.dataset.osxEra) {
    applyEra(readStoredEra());
  }

  const overlay = document.getElementById("tm-overlay");
  const timeline = document.getElementById("tm-timeline");
  const scrubThumb = document.getElementById("tm-scrubber-thumb");
  const labelEl = document.getElementById("tm-era-label");
  const btnPrev = document.getElementById("tm-prev");
  const btnNext = document.getElementById("tm-next");
  const btnRestore = document.getElementById("tm-restore");
  const btnCancel = document.getElementById("tm-cancel");
  const menuItem = document.getElementById("menu-time-machine");
  const dockItem = document.getElementById("dock-timemachine");

  if (!overlay || !timeline) return;

  /** @type {string} */
  let eraBeforeOpen = "aqua";
  /** @type {number} */
  let selectedIndex = 0;
  let open = false;
  let transitioning = false;

  function indexOfEra(id) {
    const i = ERAS.findIndex((e) => e.id === id);
    return i >= 0 ? i : 0;
  }

  function setSelected(index, { preview = true } = {}) {
    selectedIndex = Math.max(0, Math.min(ERAS.length - 1, index));
    const era = ERAS[selectedIndex];
    const cards = timeline.querySelectorAll(".tm-era-card");
    cards.forEach((card, i) => {
      card.classList.toggle("is-selected", i === selectedIndex);
      card.setAttribute("aria-selected", i === selectedIndex ? "true" : "false");
    });
    if (scrubThumb) {
      const pct = ERAS.length <= 1 ? 0 : (selectedIndex / (ERAS.length - 1)) * 100;
      scrubThumb.style.left = pct + "%";
    }
    if (labelEl) {
      labelEl.textContent = era.year + " — " + era.name + " · " + era.blurb;
    }
    if (preview) applyEra(era.id, { persist: false });
  }

  function buildCards() {
    timeline.textContent = "";
    ERAS.forEach((era, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tm-era-card";
      btn.dataset.era = era.id;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-label", era.name + " " + era.year);
      btn.innerHTML =
        '<span class="tm-era-preview" aria-hidden="true"></span>' +
        '<span class="tm-era-meta">' +
        '<span class="tm-era-year">' +
        era.year +
        "</span>" +
        '<span class="tm-era-name">' +
        era.name +
        "</span>" +
        "</span>";
      btn.addEventListener("click", () => setSelected(i));
      btn.addEventListener("dblclick", () => {
        setSelected(i);
        restore();
      });
      timeline.appendChild(btn);
    });
  }

  function openTM() {
    if (open || transitioning) return;
    eraBeforeOpen = currentEra();
    open = true;
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    setSelected(indexOfEra(eraBeforeOpen), { preview: true });
    // Focus selected card for keyboard.
    const sel = timeline.querySelector(".tm-era-card.is-selected");
    if (sel) sel.focus();
  }

  function closeOverlay() {
    open = false;
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("tm-transitioning");
  }

  function cancel() {
    if (!open || transitioning) return;
    applyEra(eraBeforeOpen, { persist: false });
    closeOverlay();
  }

  function restore() {
    if (!open || transitioning) return;
    const era = ERAS[selectedIndex];
    applyEra(era.id, { persist: true });
    if (prefersReducedMotion()) {
      closeOverlay();
      return;
    }
    transitioning = true;
    document.documentElement.classList.add("tm-transitioning");
    const done = () => {
      transitioning = false;
      closeOverlay();
    };
    // Match CSS animation length (~700ms).
    window.setTimeout(done, 720);
  }

  buildCards();

  menuItem?.querySelector("a")?.addEventListener("click", (event) => {
    event.preventDefault();
    openTM();
  });

  dockItem?.addEventListener("click", (event) => {
    event.preventDefault();
    openTM();
  });

  btnPrev?.addEventListener("click", () => setSelected(selectedIndex - 1));
  btnNext?.addEventListener("click", () => setSelected(selectedIndex + 1));
  btnRestore?.addEventListener("click", () => restore());
  btnCancel?.addEventListener("click", () => cancel());

  window.addEventListener(
    "keydown",
    (event) => {
      // ⌥⌘T — open Time Machine when not already in an input.
      if (
        !open &&
        !transitioning &&
        event.key.toLowerCase() === "t" &&
        event.altKey &&
        (event.metaKey || event.ctrlKey) &&
        !event.target.closest("input, textarea, select, [contenteditable]")
      ) {
        event.preventDefault();
        openTM();
        return;
      }
      if (!open || transitioning) return;
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        setSelected(selectedIndex - 1);
        return;
      }
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        setSelected(selectedIndex + 1);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        restore();
      }
    },
    true,
  );

  // Public test / debug hook
  window.__aquaTimeMachine = {
    open: openTM,
    cancel,
    restore,
    applyEra,
    readStoredEra,
    eras: ERAS.slice(),
    get selected() {
      return ERAS[selectedIndex] && ERAS[selectedIndex].id;
    },
    get isOpen() {
      return open;
    },
  };
})();
