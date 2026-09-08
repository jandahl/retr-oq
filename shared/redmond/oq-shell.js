(() => {
  "use strict";

  // Tabbed Dictionary / Word Deconstructor chrome for Win98/XP/Win7-style
  // single-frame apps. win31 uses its own MDI children instead -- this
  // helper deliberately does not model MDI so period differences stay
  // visible (see CLAUDE.md / theme NOTES).
  //
  // Themes own the markup (.oq-tabstrip / .oq-tab / .oq-view); this only
  // wires selection + a pure applyView() for the router's onChange.

  window.OqRedmond = window.OqRedmond || {};

  /**
   * @param {{
   *   tabs: Array<{ view: string, button: HTMLElement, panel: HTMLElement|null }>,
   *   onTabSelect?: (view: string) => void,
   *   shellWin?: HTMLElement|null,
   * }} options
   */
  function initOqShell({ tabs, onTabSelect, shellWin }) {
    function applyView(view) {
      const which = view === "decon" ? "decon" : "oq";
      for (const tab of tabs) {
        const active = tab.view === which;
        if (tab.button) {
          tab.button.setAttribute("aria-selected", active ? "true" : "false");
          tab.button.classList.toggle("is-active", active);
        }
        if (tab.panel) {
          tab.panel.hidden = !active;
          tab.panel.classList.toggle("is-active", active);
        }
      }
      if (shellWin) shellWin.dataset.oqView = which;
    }

    for (const tab of tabs) {
      if (!tab.button) continue;
      tab.button.addEventListener("click", () => {
        if (typeof onTabSelect === "function") onTabSelect(tab.view);
      });
    }

    return { applyView };
  }

  window.OqRedmond.initOqShell = initOqShell;
})();
