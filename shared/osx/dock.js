(() => {
  "use strict";

  // Dock launch + running-indicator helpers for the OS X family.
  // Magnification / genie animation stay theme-side (period chrome).

  window.OqOsx = window.OqOsx || {};

  /**
   * @param {object} opts
   * @param {HTMLElement} opts.dock
   * @param {string} [opts.itemSelector="[data-open]"]
   * @param {(id: string, el: HTMLElement) => void} opts.onLaunch
   * @param {string} [opts.runningClass="is-running"]
   * @param {string} [opts.bounceClass="is-bouncing"]
   */
  function initDock({
    dock,
    itemSelector = "[data-open]",
    onLaunch,
    runningClass = "is-running",
    bounceClass = "is-bouncing",
  }) {
    const items = Array.from(dock.querySelectorAll(itemSelector));

    function itemFor(id) {
      return items.find((el) => el.dataset.open === id) || null;
    }

    function setRunning(id, running) {
      const el = itemFor(id);
      if (!el) return;
      el.classList.toggle(runningClass, !!running);
    }

    function bounce(id) {
      const el = itemFor(id);
      if (!el) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      el.classList.remove(bounceClass);
      void el.offsetWidth;
      el.classList.add(bounceClass);
      const done = () => {
        el.classList.remove(bounceClass);
        el.removeEventListener("animationend", done);
      };
      el.addEventListener("animationend", done);
      setTimeout(done, 900);
    }

    for (const el of items) {
      el.addEventListener("click", () => {
        const id = el.dataset.open;
        if (!id) return;
        bounce(id);
        if (onLaunch) onLaunch(id, el);
      });
    }

    return { setRunning, bounce, itemFor, items };
  }

  window.OqOsx.initDock = initDock;
})();
