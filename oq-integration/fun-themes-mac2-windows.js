// @ts-check
// Fun Themes (Mac II): multiple simultaneous, draggable windows for
// Builder/Deconstruct/Tornasuk. Dictionary stays the main window (see
// docs/fun-themes-mac2-drag.js) since it shares the header/search chrome;
// this module handles the other three, each opened via its own desktop
// icon (the former tab strip, restyled in docs/fun-themes-mac2.css) instead
// of a tab that swaps the single visible view.
//
// Deliberately layered ON TOP of docs/router.js, not integrated into it:
// router.js still owns the URL/history and toggles each view-section's
// .hidden class exactly as it always has, so deep links, back/forward, and
// every other consumer of currentView() keep working completely unchanged.
// This module only overrides the VISUAL effect of that class for windows
// the user has explicitly opened (the .mac2-window-open class this module
// controls -- see the CSS's `.mac2-window.mac2-window-open.hidden`
// override) and adds position/z-index/drag on top of that. Closing the
// window that router currently considers the active route routes back to
// dictionary (via router's own navigateTo()) rather than just hiding it --
// otherwise the base .mac2-window{display:none} would blank the screen
// while router still thinks a now-invisible view is the active one.
//
// Scoped to wide viewports (docs/fun-themes-mac2.css's 88rem breakpoint,
// matching the floating tool-palette window): narrower viewports have no
// room for extra floating windows and keep oq's normal single-view tab
// behavior untouched -- router.js's own click handlers on the nav links
// still fire regardless, so clicking a "desktop icon" always at least
// switches the view the normal way. Crossing the breakpoint while windows
// are open (a resize, not just the initial load) tears them all the way
// back down to oq's normal layout, not just the nav column, so shrinking
// below it can't strand a floating window with no way to close it.

import { makeDraggable } from "./fun-themes-mac2-drag.js";
import { currentView, navigateTo } from "./router.js";
import { t } from "./i18n.js";

const BREAKPOINT = "(min-width: 88rem)";

const WINDOWS = Object.freeze({
  builder: { section: "view-builder", nav: "nav-builder", view: "builder", labelKey: "nav.wordBuilder" },
  deconstruct: {
    section: "view-deconstruct",
    nav: "nav-deconstruct",
    view: "deconstruct",
    labelKey: "nav.deconstruct",
  },
  tornasuk: { section: "view-tornasuk", nav: "nav-tornasuk", view: "tornasuk", labelKey: "nav.tornasuk" },
});

let zTop = 30;
/** @param {HTMLElement} el */
function bringToFront(el) {
  zTop += 1;
  el.style.zIndex = String(zTop);
}

/** @type {Set<string>} view keys that have been converted to windows */
const _initialized = new Set();
/** @type {Map<string, (event: PointerEvent) => void>} per-key section pointerdown
 * handler, so it can be removed again on restore instead of accumulating a
 * duplicate on every enable/disable cycle (the section element itself
 * persists across cycles -- only its window chrome is added/removed). */
const _sectionListeners = new Map();
let _stagger = 0;
let _wired = false;

/**
 * Build a window's title bar (real DOM, not a pseudo-element, since the
 * title text is dynamic per window) the first time that view is opened,
 * reparent the section out of .page-wrapper so it can float anywhere on
 * the desktop instead of being clipped by the main window's own
 * overflow/bounds, and wire up its close box and drag handle.
 * @param {string} key
 */
function ensureWindow(key) {
  const cfg = WINDOWS[key];
  const section = document.getElementById(cfg.section);
  if (!section) return null;
  if (_initialized.has(key)) return section;
  _initialized.add(key);

  const label = t(cfg.labelKey);
  section.classList.add("mac2-window");

  const titlebar = document.createElement("div");
  titlebar.className = "mac2-titlebar";

  const closebox = document.createElement("button");
  closebox.type = "button";
  closebox.className = "mac2-closebox";
  closebox.setAttribute("aria-label", t("funThemes.mac2.closeWindow", { label }));
  closebox.addEventListener("click", () => closeWindow(key));

  const titleLabel = document.createElement("span");
  titleLabel.className = "mac2-titlebar-label";
  titleLabel.textContent = t("funThemes.mac2.windowTitle", { label });

  titlebar.append(closebox, titleLabel);
  section.prepend(titlebar);

  makeDraggable(titlebar, section);
  const onPointerDown = () => bringToFront(section);
  section.addEventListener("pointerdown", onPointerDown);
  _sectionListeners.set(key, onPointerDown);

  document.body.append(section);

  // Stagger each newly-opened window's starting position so they don't
  // all land in an identical stack -- real desktops spread windows out
  // the same way when you open several at once.
  const offset = 4 + (_stagger % 6) * 1.5;
  _stagger += 1;
  section.style.top = `${offset}rem`;
  section.style.left = `${8 + offset}rem`;

  return section;
}

/** @param {string} key */
function openWindow(key) {
  if (!window.matchMedia(BREAKPOINT).matches) return;
  const section = ensureWindow(key);
  if (!section) return;
  section.classList.add("mac2-window-open");
  bringToFront(section);
}

/**
 * Close a window. If router currently considers this view the active
 * route, navigate back to dictionary first -- router's own .hidden
 * toggling only runs on navigation, so simply hiding the window here
 * (without routing away from it) would leave the screen blank: this
 * section's .mac2-window base rule is display:none, but router still has
 * the dictionary section .hidden until something navigates it away.
 * @param {string} key
 */
function closeWindow(key) {
  const cfg = WINDOWS[key];
  if (currentView() === cfg.view) navigateTo("dictionary");
  document.getElementById(cfg.section)?.classList.remove("mac2-window-open");
}

/**
 * Move a window's section back into .page-wrapper (in the three views'
 * original relative order, since restoreAll() below always calls this in
 * that order) and strip the window chrome this module added, so turning
 * the theme off -- or crossing back below the breakpoint -- leaves the DOM
 * exactly as oq's normal layout expects it.
 * @param {string} key
 */
function restoreWindow(key) {
  const cfg = WINDOWS[key];
  const section = document.getElementById(cfg.section);
  if (!section) return;
  const wrapper = document.querySelector(".page-wrapper");
  section.querySelector(".mac2-titlebar")?.remove();
  const onPointerDown = _sectionListeners.get(key);
  if (onPointerDown) {
    section.removeEventListener("pointerdown", /** @type {EventListener} */ (onPointerDown));
    _sectionListeners.delete(key);
  }
  section.classList.remove("mac2-window", "mac2-window-open");
  section.style.transform = "";
  section.style.top = "";
  section.style.left = "";
  section.style.zIndex = "";
  if (wrapper) wrapper.append(section);
  _initialized.delete(key);
}

function restoreAll() {
  for (const key of Object.keys(WINDOWS)) restoreWindow(key);
}

/** @type {Array<{ el: Element, handler: (event: MouseEvent) => void }>} */
const _navListeners = [];

// .view-switch (the former tab strip, restyled in docs/fun-themes-mac2.css
// as a fixed-position column of desktop icons) lives inside .sticky-chrome,
// which sets will-change: transform for scroll-perf reasons -- per spec
// that makes .sticky-chrome the containing block for any position: fixed
// descendant instead of the viewport, so a fixed .view-switch left in place
// would be positioned relative to the wrong box (the same gotcha already
// worked around for the tool-palette in docs/fun-themes-mac2.css, but that
// one uses position: absolute anchored to .page-header instead -- not an
// option here, since these icons need to stay put on the desktop even after
// the main window gets dragged). Reparenting to document.body sidesteps it
// the same way the per-view windows above do.
/** @type {{ el: HTMLElement, parent: Node, next: ChildNode | null } | null} */
let _navSwitch = null;
let _mql = /** @type {MediaQueryList | null} */ (null);

function reparentNavOut() {
  if (_navSwitch) return;
  const el = document.querySelector(".view-switch");
  if (!(el instanceof HTMLElement) || !el.parentNode) return;
  _navSwitch = { el, parent: el.parentNode, next: el.nextSibling };
  document.body.append(el);
}

function reparentNavIn() {
  if (!_navSwitch) return;
  _navSwitch.parent.insertBefore(_navSwitch.el, _navSwitch.next);
  _navSwitch = null;
}

/** @param {MediaQueryListEvent | MediaQueryList} event */
function onBreakpointChange(event) {
  if (event.matches) {
    reparentNavOut();
    return;
  }
  // Leaving the breakpoint (a resize, not just "never entered it") must
  // tear down any windows that were opened while it was wide -- otherwise
  // they're stranded reparented to document.body with .mac2-window chrome
  // and no way to close them at a viewport with no room for floating
  // windows, breaking the "narrow viewports keep normal tab behavior"
  // guarantee.
  restoreAll();
  reparentNavIn();
}

export function initMac2Windows() {
  if (_wired) return;
  _wired = true;
  for (const [key, cfg] of Object.entries(WINDOWS)) {
    const nav = document.getElementById(cfg.nav);
    if (!nav) continue;
    // router.js already binds its own click listener to open the view the
    // normal way (URL, .hidden toggling, viewChange event) -- this is
    // purely additive, opening/focusing the floating window on top of
    // that at wide viewports.
    /** @param {MouseEvent} event */
    const handler = (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      openWindow(key);
    };
    nav.addEventListener("click", handler);
    _navListeners.push({ el: nav, handler });
  }

  _mql = window.matchMedia(BREAKPOINT);
  onBreakpointChange(_mql);
  _mql.addEventListener("change", onBreakpointChange);
}

export function teardownMac2Windows() {
  for (const { el, handler } of _navListeners) {
    el.removeEventListener("click", /** @type {EventListener} */ (handler));
  }
  _navListeners.length = 0;
  restoreAll();
  reparentNavIn();
  _mql?.removeEventListener("change", onBreakpointChange);
  _mql = null;
  _wired = false;
}
