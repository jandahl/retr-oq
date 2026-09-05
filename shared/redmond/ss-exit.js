/* Click, tap, or any key returns to the desktop that launched this saver.
   Only arms when the host passed ?oqret= so KDE settings thumbnails stay put. */
(function () {
  "use strict";

  function param(name) {
    var search = location.search || "";
    var re = new RegExp("[?&]" + name + "=([^&]*)");
    var m = search.match(re);
    if (!m) return "";
    try {
      return decodeURIComponent(m[1].replace(/\+/g, " "));
    } catch (e) {
      return m[1];
    }
  }

  function safeRet(raw) {
    if (!raw) return "";
    if (raw.charAt(0) !== "/") return "";
    if (raw.charAt(1) === "/") return "";
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return "";
    return raw;
  }

  var ret = safeRet(param("oqret"));
  if (!ret) return;

  var gone = false;
  function go(event) {
    if (gone) return;
    gone = true;
    if (event) {
      try {
        event.preventDefault();
        event.stopPropagation();
      } catch (e) {}
    }
    // Delay so the dismissing click cannot land on the desktop underneath.
    setTimeout(function () {
      location.href = ret;
    }, 80);
  }

  function muteCanvas() {
    var nodes = document.querySelectorAll("canvas, video, iframe");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].style.pointerEvents = "none";
    }
  }
  muteCanvas();
  try {
    new MutationObserver(muteCanvas).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  } catch (e) {}

  var shield = document.createElement("div");
  shield.setAttribute("aria-label", "Exit screen saver");
  shield.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;background:transparent;cursor:none;";
  function mountShield() {
    if (!shield.isConnected) (document.body || document.documentElement).appendChild(shield);
  }
  if (document.body) mountShield();
  else document.addEventListener("DOMContentLoaded", mountShield);

  function arm(target) {
    target.addEventListener("pointerdown", go, true);
    target.addEventListener("touchstart", go, { capture: true, passive: false });
  }
  arm(shield);
  arm(window);
  window.addEventListener("keydown", go, true);
})();
