(() => {
  "use strict";

  // Tabbed Dictionary / Word Deconstructor chrome for Win98/XP/Win7-style
  // single-frame apps. Themes own the markup and must use the vendor Tab
  // control (menu[role=tablist] + [role=tabpanel] from 98.css / XP.css /
  // 7.css) so the chrome reads as a Win32 property sheet, not a custom
  // flex strip. win31 uses its own MDI children instead -- this helper
  // deliberately does not model MDI so period differences stay visible
  // (see CLAUDE.md / theme NOTES).
  //
  // `button` here is the selectable tab node: <li role="tab"> (98.css) or
  // <button role="tab"> (XP.css / 7.css). Selection is aria-selected;
  // .is-active is kept as a convenience for any theme CSS that still
  // wants it. Panels are the inner view nodes shown/hidden inside the
  // shared sheet.

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
      tab.button.addEventListener("click", (event) => {
        // 98.css tabs wrap an <a href="#...">; cancel hash navigation.
        event.preventDefault();
        if (typeof onTabSelect === "function") onTabSelect(tab.view);
      });
    }

    return { applyView };
  }

  window.OqRedmond.initOqShell = initOqShell;
})();
