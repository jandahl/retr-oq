// Renders the hub tiles from window.OqHubMachines (hub-data.js, loaded
// first) and runs the boot-screen intro. Classic script, not a module --
// same load-order convention as the theme app.js files.
(function () {
  "use strict";

  // Single source of truth for how long the boot screen holds before the
  // hub is revealed. Set as a CSS custom property so the fade animation's
  // duration and this timeout can never drift apart into two numbers that
  // used to match.
  var BOOT_SCREEN_MS = 2000;
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

  function renderHub() {
    var timeline = document.querySelector(".timeline");
    var machines = window.OqHubMachines || [];
    var fragment = document.createDocumentFragment();
    machines.forEach(function (machine) {
      fragment.appendChild(renderTile(machine));
    });
    timeline.appendChild(fragment);
  }

  function runBootScreen() {
    var boot = document.getElementById("boot-screen");
    var main = document.getElementById("hub-main");
    if (!boot || !main) return;

    window.setTimeout(function () {
      boot.classList.add("boot-screen--done");
      main.classList.add("hub-main--ready");
      boot.addEventListener(
        "transitionend",
        function () {
          boot.hidden = true;
        },
        { once: true }
      );
    }, BOOT_SCREEN_MS);
  }

  renderHub();
  runBootScreen();
})();
