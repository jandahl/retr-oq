(() => {
  "use strict";

  // Global menu-bar open/close for the OS X family. Themes supply the
  // markup; this owns the interaction model (click to open, hover to
  // switch, outside click / Escape to close). Classic script → window.OqOsx.
  // While any menu is open, menuBar gets .is-tracking so themes can style
  // hover-switch highlights without painting accent on idle :hover.

  window.OqOsx = window.OqOsx || {};

  /**
   * @param {object} opts
   * @param {HTMLElement} opts.menuBar
   * @param {string} [opts.itemSelector=':scope > [role="menuitem"][aria-haspopup="true"], :scope > [role="menu-item"][aria-haspopup="true"]']
   * @param {string} [opts.openClass="menu-open"]
   */
  function initMenuBar({
    menuBar,
    itemSelector = ':scope > [role="menuitem"][aria-haspopup="true"], :scope > [role="menu-item"][aria-haspopup="true"]',
    openClass = "menu-open",
  }) {
    const menuItems = Array.from(menuBar.querySelectorAll(itemSelector));
    let openMenuItem = null;

    function close() {
      if (!openMenuItem) return;
      openMenuItem.classList.remove(openClass);
      openMenuItem.setAttribute("aria-expanded", "false");
      openMenuItem.blur();
      openMenuItem = null;
      menuBar.classList.remove("is-tracking");
    }

    function open(item) {
      if (openMenuItem === item) return;
      close();
      item.classList.add(openClass);
      item.setAttribute("aria-expanded", "true");
      openMenuItem = item;
      menuBar.classList.add("is-tracking");
    }

    for (const item of menuItems) {
      item.setAttribute("aria-expanded", "false");
      item.addEventListener("click", (event) => {
        if (event.target.closest('[role="menu"]')) return;
        if (openMenuItem === item) close();
        else open(item);
      });
      item.addEventListener("pointerenter", () => {
        if (openMenuItem && openMenuItem !== item) open(item);
      });
      for (const link of item.querySelectorAll('[role="menu"] a')) {
        link.addEventListener("click", () => close());
      }
    }

    document.addEventListener("pointerdown", (event) => {
      if (openMenuItem && !menuBar.contains(event.target)) close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && openMenuItem) close();
    });

    return {
      open,
      close,
      getOpen: () => openMenuItem,
      items: menuItems,
    };
  }

  window.OqOsx.initMenuBar = initMenuBar;
})();
