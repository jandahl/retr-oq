// Fullscreen iframe host for vendored screensaver remakes.
// Auto-wires win31 / win98 / xp / win7. Themes may also call attach() by hand.
(function (global) {
  const CSS = [
    "#oq-ss-overlay{position:fixed;inset:0;z-index:2147483646;background:#000;}",
    "#oq-ss-overlay[hidden]{display:none !important;}",
    "#oq-ss-overlay iframe{width:100%;height:100%;border:0;display:block;background:#000;pointer-events:none;}",
    ".icon-ss{background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Crect width='16' height='16' fill='%23000000'/%3E%3Crect x='1' y='1' width='6' height='6' fill='%23c00000'/%3E%3Crect x='9' y='1' width='6' height='6' fill='%2300a000'/%3E%3Crect x='1' y='9' width='6' height='6' fill='%230000c0'/%3E%3Crect x='9' y='9' width='6' height='6' fill='%23c0c000'/%3E%3C/svg%3E\");}",
  ].join("");

  function attach(opts) {
    const idleMs = opts.idleMs == null ? 45000 : opts.idleMs;
    let src = opts.src;
    if (!document.getElementById("oq-ss-style")) {
      const style = document.createElement("style");
      style.id = "oq-ss-style";
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    let overlay = document.getElementById("oq-ss-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "oq-ss-overlay";
      overlay.hidden = true;
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-label", "Screen saver");
      overlay.innerHTML = '<iframe title="Screen saver"></iframe>';
      document.body.appendChild(overlay);
    }
    const frame = overlay.querySelector("iframe");
    let timer = 0;
    let running = false;

    function stop(event) {
      if (event && running) {
        event.preventDefault();
        event.stopPropagation();
      }
      running = false;
      overlay.hidden = true;
      frame.removeAttribute("src");
      ping();
    }

    function start() {
      if (running) return;
      running = true;
      clearTimeout(timer);
      frame.src = src;
      overlay.hidden = false;
    }

    function ping() {
      if (running) return;
      clearTimeout(timer);
      if (idleMs > 0) timer = window.setTimeout(start, idleMs);
    }

    function setSrc(next) {
      src = next;
      if (running) frame.src = src;
    }

    // iframe is pointer-events:none so tap/click hits the overlay, not the
    // nested document (parent window never sees iframe pointer events).
    function tapOut(event) { stop(event); }
    overlay.addEventListener("pointerdown", tapOut);
    overlay.addEventListener("click", tapOut);
    overlay.addEventListener("touchstart", tapOut, { passive: false });
    window.addEventListener("keydown", (event) => {
      if (running) stop(event);
      else ping();
    }, true);
    window.addEventListener("pointerdown", ping, true);
    window.addEventListener("pointermove", ping, true);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) clearTimeout(timer);
      else ping();
    });
    ping();
    return { start, stop, setSrc, ping };
  }

  function vendor(name) {
    var bust = name === "maze-backrooms" ? "?v=4" : "";
    return "../vendor/screensavers/" + name + "/index.html" + bust;
  }

  function themeKey() {
    const p = location.pathname;
    if (p.includes("/win31/")) return "win31";
    if (p.includes("/win98/")) return "win98";
    if (p.includes("/win7/")) return "win7";
    if (p.includes("/xp/")) return "xp";
    return null;
  }

  function addStartItem(menu, label, onClick) {
    if (!menu) return;
    const item = document.createElement("li");
    item.setAttribute("role", "menu-item");
    item.className = "start-menu-item";
    const icon = document.createElement("span");
    icon.className = "start-menu-icon icon-ss";
    icon.setAttribute("aria-hidden", "true");
    item.append(icon, document.createTextNode(" " + label));
    item.addEventListener("click", () => {
      menu.hidden = true;
      onClick();
    });
    const about = menu.querySelector('[data-open="win-about"]');
    if (about) menu.insertBefore(item, about);
    else menu.appendChild(item);
  }

  function bindAccessory(el, start) {
    if (!el) return;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    el.addEventListener("click", () => {
      if (coarse) start();
    });
    if (!coarse) el.addEventListener("dblclick", start);
  }

  function boot() {
    const theme = themeKey();
    if (!theme) return;

    if (theme === "win31") {
      const host = attach({ src: vendor("flying-windows"), idleMs: 45000 });
      const group = document.querySelector("#win-group-acc .group-icons");
      if (group && !document.getElementById("acc-ss")) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "prog-icon";
        btn.id = "acc-ss";
        btn.innerHTML =
          '<span class="prog-icon-glyph icon-ss" aria-hidden="true"></span>' +
          '<span class="prog-icon-label">Flying Windows</span>';
        const about = document.getElementById("acc-about");
        if (about) group.insertBefore(btn, about);
        else group.appendChild(btn);
        bindAccessory(btn, host.start);
      }
      return;
    }

    if (theme === "win98") {
      const host = attach({ src: vendor("pipes"), idleMs: 45000 });
      const menu = document.getElementById("start-menu");
      addStartItem(menu, "3D Pipes", () => {
        host.setSrc(vendor("pipes"));
        host.start();
      });
      addStartItem(menu, "3D Maze", () => {
        host.setSrc(vendor("maze"));
        host.start();
      });
      addStartItem(menu, "Backrooms", () => {
        host.setSrc(vendor("maze-backrooms"));
        host.start();
      });
      return;
    }

    if (theme === "xp") {
      const host = attach({ src: vendor("pipes"), idleMs: 45000 });
      const menu = document.getElementById("start-menu");
      addStartItem(menu, "3D Pipes", () => {
        host.setSrc(vendor("pipes"));
        host.start();
      });
      addStartItem(menu, "Backrooms", () => {
        host.setSrc(vendor("maze-backrooms"));
        host.start();
      });
      return;
    }

    if (theme === "win7") {
      const host = attach({ src: vendor("pipes"), idleMs: 45000 });
      addStartItem(document.getElementById("start-menu"), "3D Pipes", () => {
        host.setSrc(vendor("pipes"));
        host.start();
      });
    }
  }

  global.OqScreensaver = { attach };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window);
