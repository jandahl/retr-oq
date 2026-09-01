// Renders the hub tiles from window.OqHubMachines (hub-data.js, loaded
// first) and runs the boot-screen intro. Classic script, not a module --
// same load-order convention as the theme app.js files.
(function () {
  "use strict";

  // Single source of truth for how long the boot screen holds before the
  // hub is revealed. Set as a CSS custom property so the fade animation's
  // duration and this timeout can never drift apart into two numbers that
  // used to match.
  var BOOT_SCREEN_MS = 700;
  document.documentElement.style.setProperty(
    "--boot-duration",
    BOOT_SCREEN_MS + "ms"
  );

  function renderTile(machine) {
    var li = document.createElement("li");
    li.className = "entry";

    var a = document.createElement("a");
    a.className = "tile";
    a.href = machine.href;
    a.target = "_top";

    var dot = document.createElement("span");
    dot.className = "dot";
    dot.setAttribute("aria-hidden", "true");

    var info = document.createElement("span");
    info.className = "info";

    var icon = document.createElement("span");
    icon.className = "icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML =
      "<!-- " +
      machine.iconNote +
      ' --><svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">' +
      machine.icon +
      "</svg>";

    var name = document.createElement("span");
    name.className = "name";
    name.textContent = machine.name;

    var year = document.createElement("span");
    year.className = "year";
    year.textContent = machine.year;

    var meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = machine.meta;

    info.append(icon, name, year, meta);
    a.append(dot, info);
    li.appendChild(a);
    return li;
  }

  function matchesFilter(machine, filter) {
    return filter === "all" ||
      (filter === "games" ? machine.hasGames : machine.category === filter);
  }

  function renderHub(filter) {
    var timeline = document.querySelector(".timeline");
    var machines = window.OqHubMachines || [];
    var visibleMachines = machines.filter(function (machine) {
      return matchesFilter(machine, filter || "all");
    });
    var fragment = document.createDocumentFragment();
    timeline.replaceChildren();
    visibleMachines.forEach(function (machine) {
      fragment.appendChild(renderTile(machine));
    });
    timeline.appendChild(fragment);
    var line = document.createElement("span");
    line.className = "timeline-line";
    line.setAttribute("aria-hidden", "true");
    timeline.appendChild(line);
    syncTimelineGeometry(timeline);
    return visibleMachines.length;
  }

  function enableFilters() {
    var buttons = document.querySelectorAll("[data-filter]");
    var count = document.querySelector(".result-count");
    var machines = window.OqHubMachines || [];

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        var filter = button.getAttribute("data-filter");
        buttons.forEach(function (other) {
          other.setAttribute("aria-pressed", String(other === button));
        });
        var visibleCount = renderHub(filter);
        count.textContent = visibleCount + " of " + machines.length + " machines";
        updateNavigation(document.querySelector(".timeline"));
      });
    });
  }

  // Desktop-only: the timeline is visually horizontal, so a vertical
  // mouse-wheel scroll should pan it left/right instead of doing nothing
  // (the page has no vertical scroll of its own to consume it). Trackpad
  // horizontal swipes already arrive as deltaX and are left alone -- only
  // deltaY-dominant events get redirected. Matches the >640px breakpoint
  // where the CSS switches the timeline from a vertical mobile column to
  // the horizontal alternating layout.
  var DESKTOP_QUERY = "(min-width: 641px)";
  var TILE_WIDTH = 132;

  function syncTimelineGeometry(timeline) {
    var line = timeline.querySelector(".timeline-line");
    if (!line) return;
    if (window.matchMedia(DESKTOP_QUERY).matches) {
      timeline.style.setProperty(
        "--timeline-edge-padding",
        Math.max(64, (timeline.clientWidth - TILE_WIDTH) / 2) + "px"
      );
      line.style.width = timeline.scrollWidth + "px";
    } else {
      timeline.style.removeProperty("--timeline-edge-padding");
      line.style.width = "";
    }
  }

  function enableWheelPan(timeline) {
    var isDesktop = window.matchMedia(DESKTOP_QUERY);
    timeline.addEventListener(
      "wheel",
      function (event) {
        if (!isDesktop.matches) return;
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
        event.preventDefault();
        timeline.scrollLeft += event.deltaY;
      },
      { passive: false }
    );
  }

  function enableNavigation(timeline) {
    var previous = document.querySelector(".timeline-nav--prev");
    var next = document.querySelector(".timeline-nav--next");
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function page(direction) {
      var amount = 0.8;
      if (window.matchMedia(DESKTOP_QUERY).matches) {
        timeline.scrollBy({
          left: direction * timeline.clientWidth * amount,
          behavior: reducedMotion.matches ? "auto" : "smooth"
        });
      } else {
        window.scrollBy({
          top: direction * window.innerHeight * amount,
          behavior: reducedMotion.matches ? "auto" : "smooth"
        });
      }
    }

    previous.addEventListener("click", function () { page(-1); });
    next.addEventListener("click", function () { page(1); });
    timeline.addEventListener("scroll", function () { updateNavigation(timeline); });
    window.addEventListener("scroll", function () { updateNavigation(timeline); }, { passive: true });
    window.addEventListener("resize", function () { updateNavigation(timeline); });
    updateNavigation(timeline);
  }

  function updateNavigation(timeline) {
    var previous = document.querySelector(".timeline-nav--prev");
    var next = document.querySelector(".timeline-nav--next");
    var isDesktop = window.matchMedia(DESKTOP_QUERY).matches;
    var canGoBack;
    var canGoForward;
    var icons = timeline.querySelectorAll(".icon");
    var bounds = isDesktop
      ? timeline.getBoundingClientRect()
      : { top: 0, bottom: window.innerHeight };

    function hasUnseenIcon(direction) {
      return Array.prototype.some.call(icons, function (icon) {
        var rect = icon.getBoundingClientRect();
        return direction < 0
          ? (isDesktop ? rect.left < bounds.left - 1 : rect.top < bounds.top - 1)
          : (isDesktop ? rect.right > bounds.right + 1 : rect.bottom > bounds.bottom + 1);
      });
    }

    if (isDesktop) {
      canGoBack = hasUnseenIcon(-1);
      canGoForward = hasUnseenIcon(1);
      previous.setAttribute("aria-label", "Scroll timeline left");
      next.setAttribute("aria-label", "Scroll timeline right");
      previous.textContent = "<";
      next.textContent = ">";
    } else {
      canGoBack = hasUnseenIcon(-1);
      canGoForward = hasUnseenIcon(1);
      previous.setAttribute("aria-label", "Scroll page up");
      next.setAttribute("aria-label", "Scroll page down");
      previous.textContent = "↑";
      next.textContent = "↓";
    }
    previous.hidden = !canGoBack;
    next.hidden = !canGoForward;
  }

  function runBootScreen() {
    var boot = document.getElementById("boot-screen");
    var main = document.getElementById("hub-main");
    if (!boot || !main) return;

    var skip = boot.querySelector(".skip-intro");
    var finished = false;

    function completeBoot() {
      if (finished) return;
      finished = true;
      boot.classList.add("boot-screen--done");
      main.classList.add("hub-main--ready");
      boot.addEventListener(
        "transitionend",
        function () {
          boot.hidden = true;
        },
        { once: true }
      );
      window.setTimeout(function () { boot.hidden = true; }, 900);
    }

    skip.addEventListener("click", completeBoot);
    var delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : BOOT_SCREEN_MS;
    window.setTimeout(completeBoot, delay);
  }

  var initialCount = renderHub("all");
  document.querySelector(".result-count").textContent =
    initialCount + " of " + (window.OqHubMachines || []).length + " machines";
  enableFilters();
  enableWheelPan(document.querySelector(".timeline"));
  enableNavigation(document.querySelector(".timeline"));
  window.addEventListener("resize", function () {
    var timeline = document.querySelector(".timeline");
    syncTimelineGeometry(timeline);
    updateNavigation(timeline);
  });
  runBootScreen();
})();
