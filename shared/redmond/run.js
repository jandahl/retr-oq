// Start → Run across win98 / xp / win7: a real themed dialog, not a
// browser prompt. Commands are case-insensitive; .exe, paths, and
// internal spaces are ignored (so "WinVer.EXE" and "3D Pipes" match).
(function (global) {
  function themeKey() {
    const p = location.pathname;
    if (p.includes("/win98/")) return "win98";
    if (p.includes("/xp/")) return "xp";
    if (p.includes("/win7/")) return "win7";
    return null;
  }

  function chrome(theme) {
    if (theme === "xp") {
      return { overlay: "xp-dialog-overlay", dialog: "window xp-dialog", body: "window-body xp-window-body" };
    }
    if (theme === "win7") {
      return { overlay: "win7-dialog-overlay", dialog: "window win7-dialog glass", body: "window-body win7-window-body" };
    }
    return { overlay: "win98-dialog-overlay", dialog: "window win98-dialog", body: "window-body win98-window-body" };
  }

  function normalize(raw) {
    return String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/\\/g, "/")
      .split("/")
      .pop()
      .replace(/\.exe$/i, "")
      .replace(/\.com$/i, "")
      .replace(/\s+/g, "")
      .trim();
  }

  function saverUrl(id) {
    return "../vendor/screensavers/" + id + "/index.html" + (id === "maze-backrooms" ? "?v=11" : "");
  }

  function startSaver(id) {
    const vendor = saverUrl(id);
    const ss = global.OqScreensaver || {};
    const host = ss.host || ss.kde;
    if (host && typeof host.setSrc === "function" && typeof host.start === "function") {
      host.setSrc(vendor);
      host.start();
      return true;
    }
    const overlay = document.getElementById("oq-ss-overlay");
    if (overlay) {
      const frame = overlay.querySelector("iframe");
      if (frame) frame.src = vendor;
      overlay.hidden = false;
      return true;
    }
    const labels = {
      "maze-backrooms": "Backrooms",
      aquarium: "Aquarium",
      pipes: "3D Pipes",
      maze: "3D Maze",
    };
    const fly = document.querySelector("#start-ss-submenu .start-menu-flyout");
    if (fly && labels[id]) {
      const items = fly.querySelectorAll(".start-menu-item");
      for (let i = 0; i < items.length; i++) {
        if (items[i].textContent.replace(/^\s+/, "").indexOf(labels[id]) !== -1) {
          items[i].click();
          return true;
        }
      }
    }
    if (typeof ss.attach === "function") {
      const next = ss.attach({ src: vendor, idleMs: 45000 });
      ss.host = next;
      global.OqScreensaver = ss;
      next.start();
      return true;
    }
    return false;
  }

  function openApp(id) {
    const item = document.querySelector('.start-menu-item[data-open="' + id + '"]');
    if (item) {
      item.click();
      return true;
    }
    const el = document.getElementById(id);
    if (!el) return false;
    el.classList.remove("minimized");
    el.hidden = false;
    return true;
  }

  function showWinver(theme) {
    let overlay = document.getElementById("winver-overlay");
    const api = (global.OqAnalysis && global.OqAnalysis.API_VERSION) || "v0.0.5";
    const apiPath = String(api).indexOf("v") === 0 ? api : "v" + api;
    const label = theme === "xp" ? "Oq!XP" : theme === "win7" ? "Oq!7" : "Oq!98";
    if (!overlay) {
      const c = chrome(theme);
      overlay = document.createElement("div");
      overlay.id = "winver-overlay";
      overlay.className = c.overlay;
      overlay.hidden = true;
      overlay.innerHTML =
        '<section class="' + c.dialog + '">' +
        '<div class="title-bar"><div class="title-bar-text">About ' + label + '</div></div>' +
        '<div class="' + c.body + '">' +
        "<p><strong>" + label + "</strong> — retr-oq desktop prototype</p>" +
        "<p>oq-api: " + apiPath + "<br>https://jandahl.github.io/oq-api/api/" + apiPath + "/public-api.js</p>" +
        "<p>theme: " + theme + "<br>viewport: " + window.innerWidth + "×" + window.innerHeight +
        "<br>user agent:<br><small>" + String(navigator.userAgent).replace(/</g, "") + "</small></p>" +
        '<div class="win98-dialog-actions" style="margin-top:1rem;display:flex;justify-content:flex-end">' +
        '<button type="button" id="winver-ok">OK</button></div></div></section>';
      document.body.appendChild(overlay);
      overlay.querySelector("#winver-ok").addEventListener("click", function () {
        overlay.hidden = true;
      });
    }
    overlay.hidden = false;
  }

  function runCommand(raw, theme) {
    theme = theme || themeKey();
    const key = normalize(raw);
    if (!key) return true;
    if (key === "winver" || key === "ver" || key === "winversion") {
      showWinver(theme);
      return true;
    }
    if (key === "backrooms" || key === "mazebackrooms") return startSaver("maze-backrooms");
    if (key === "aquarium") return startSaver("aquarium");
    if (key === "pipes" || key === "3dpipes") return startSaver("pipes");
    if (key === "maze" || key === "3dmaze") return startSaver("maze");
    if (key === "update" || key === "wupdmgr" || key === "windowsupdate") {
      window.open("https://www.debian.org/", "_blank", "noopener");
      return true;
    }
    if (key === "oq" || key === "oq!") return openApp("win-oq");
    if (key === "decon") return openApp("win-decon");
    if (key === "help") return openApp("win-help") || (showWinver(theme), true);
    if (key === "find") return openApp("win-find") || false;
    if (key === "settings" || key === "control") return openApp("win-settings");
    return false;
  }

  function ensureRunDialog(theme) {
    let overlay = document.getElementById("run-overlay");
    if (overlay) return overlay;
    const c = chrome(theme);
    overlay = document.createElement("div");
    overlay.id = "run-overlay";
    overlay.className = c.overlay;
    overlay.hidden = true;
    overlay.innerHTML =
      '<section class="' + c.dialog + '">' +
      '<div class="title-bar"><div class="title-bar-text">Run</div></div>' +
      '<div class="' + c.body + '">' +
      "<p>Type the name of a program, folder, document, or Internet resource, and Windows will open it for you.</p>" +
      '<p id="run-error" hidden style="color:#c00000"></p>' +
      '<div class="field-row" style="display:flex;gap:0.5rem;align-items:center">' +
      '<label for="run-input">Open:</label>' +
      '<input type="text" id="run-input" autocomplete="off" style="flex:1" />' +
      "</div>" +
      '<div class="win98-dialog-actions" style="margin-top:1rem;display:flex;justify-content:flex-end;gap:6px">' +
      '<button type="button" id="run-ok">OK</button>' +
      '<button type="button" id="run-cancel">Cancel</button>' +
      "</div></div></section>";
    document.body.appendChild(overlay);
    const input = overlay.querySelector("#run-input");
    const err = overlay.querySelector("#run-error");
    function close() {
      overlay.hidden = true;
      err.hidden = true;
    }
    function accept() {
      const raw = input.value;
      if (!runCommand(raw, theme)) {
        err.textContent = "Windows cannot find '" + raw + "'. Make sure you typed the name correctly.";
        err.hidden = false;
        input.focus();
        input.select();
        return;
      }
      close();
    }
    overlay.querySelector("#run-ok").addEventListener("click", accept);
    overlay.querySelector("#run-cancel").addEventListener("click", close);
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") accept();
      if (event.key === "Escape") close();
    });
    return overlay;
  }

  function addRunItem(theme) {
    const menu = document.getElementById("start-menu");
    if (!menu || menu.querySelector("#start-menu-run")) return;
    const shutdown = menu.querySelector("#start-menu-shutdown");
    const li = document.createElement("li");
    li.id = "start-menu-run";
    li.setAttribute("role", "menu-item");
    li.className = "start-menu-item";
    const icon = document.createElement("span");
    icon.className = "start-menu-icon icon-run";
    icon.setAttribute("aria-hidden", "true");
    li.append(icon, document.createTextNode(" Run…"));
    li.addEventListener("click", function () {
      menu.hidden = true;
      const overlay = ensureRunDialog(theme);
      overlay.hidden = false;
      const input = overlay.querySelector("#run-input");
      const err = overlay.querySelector("#run-error");
      if (err) err.hidden = true;
      input.focus();
      input.select();
    });
    if (shutdown) menu.insertBefore(li, shutdown);
    else menu.appendChild(li);
  }

  function boot() {
    const theme = themeKey();
    if (!theme) return;
    if (!document.getElementById("oq-run-style")) {
      const style = document.createElement("style");
      style.id = "oq-run-style";
      style.textContent = '.icon-run{background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 16 16\' shape-rendering=\'crispEdges\'%3E%3Crect x=\'2\' y=\'3\' width=\'12\' height=\'10\' fill=\'%23c0c0c0\' stroke=\'%23000000\'/%3E%3Crect x=\'3\' y=\'4\' width=\'10\' height=\'6\' fill=\'%23000080\'/%3E%3C/svg%3E");}';
      document.head.appendChild(style);
    }
    addRunItem(theme);
    ensureRunDialog(theme);
  }

  global.OqRedmondRun = {
    boot: boot,
    run: runCommand,
    open: function () {
      const theme = themeKey();
      if (!theme) return;
      const overlay = ensureRunDialog(theme);
      overlay.hidden = false;
      overlay.querySelector("#run-input").focus();
    },
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
