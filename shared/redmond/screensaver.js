// Fullscreen iframe host for vendored screensaver remakes.
// Themes call OqScreensaver.attach({ src, idleMs }) once.
(function (global) {
  const CSS = [
    "#oq-ss-overlay{position:fixed;inset:0;z-index:2147483646;background:#000;}",
    "#oq-ss-overlay[hidden]{display:none !important;}",
    "#oq-ss-overlay iframe{width:100%;height:100%;border:0;display:block;background:#000;}",
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

    const dismiss = (event) => stop(event);
    overlay.addEventListener("pointerdown", dismiss);
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

  global.OqScreensaver = { attach };
})(window);
