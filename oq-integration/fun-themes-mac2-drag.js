// @ts-check
// Fun Themes (Mac II): the generic drag primitive, plus wiring for the main
// window (docs/fun-themes-mac2.css's .page-wrapper "window" chrome, dragged
// by its .page-header "title bar"). makeDraggable() itself is exported so
// docs/fun-themes-mac2-windows.js can reuse it for the Builder/Deconstruct/
// Tornasuk windows and their title bars, rather than duplicating the pointer
// handling.
//
// Pure pointer-event drag: translates the target element via a CSS
// transform relative to its own last position, ignoring drags that start
// on a real interactive descendant (a button, link, input, ...) so the
// toolbar/nav inside the title bar keep working normally. Wired up by
// docs/fun-themes.js alongside the rest of the Mac II skin, torn down
// (offset reset) when the setting turns off so re-enabling starts fresh.

/**
 * @param {HTMLElement} handle the element the user grabs
 * @param {HTMLElement} target the element that actually moves
 * @returns {() => void} teardown -- removes listeners and resets the
 *   target's transform
 */
export function makeDraggable(handle, target) {
  /** @type {number | null} the pointerId currently driving a drag, or null */
  let activePointerId = null;
  let startX = 0;
  let startY = 0;
  let origX = 0;
  let origY = 0;

  /** @param {PointerEvent} event */
  function onPointerDown(event) {
    if (event.button !== 0) return;
    // Re-entrancy guard: a second pointer (another finger, a second mouse
    // button) going down mid-drag must not hijack the one already driving
    // it -- ignore it rather than resetting start/origin under it.
    if (activePointerId !== null) return;
    if (
      event.target instanceof Element &&
      event.target.closest("button, a, input, select, textarea, [role='tab'], svg")
    ) {
      return;
    }
    activePointerId = event.pointerId;
    const current = getComputedStyle(target).transform;
    const matrix = current && current !== "none" ? new DOMMatrixReadOnly(current) : null;
    origX = matrix ? matrix.m41 : 0;
    origY = matrix ? matrix.m42 : 0;
    startX = event.clientX;
    startY = event.clientY;
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  /** @param {PointerEvent} event */
  function onPointerMove(event) {
    if (event.pointerId !== activePointerId) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    target.style.transform = `translate(${origX + dx}px, ${origY + dy}px)`;
  }

  /** @param {PointerEvent} event */
  function onPointerEnd(event) {
    if (event.pointerId !== activePointerId) return;
    activePointerId = null;
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  }

  // lostpointercapture fires whenever capture is released for any reason
  // (including ones with no matching pointerup/pointercancel, e.g. an OS
  // gesture interrupting the drag, or the handle itself being removed) --
  // without it, activePointerId could get stuck set and ignore all further
  // drags.
  function onLostPointerCapture() {
    activePointerId = null;
  }

  handle.addEventListener("pointerdown", onPointerDown);
  handle.addEventListener("pointermove", onPointerMove);
  handle.addEventListener("pointerup", onPointerEnd);
  handle.addEventListener("pointercancel", onPointerEnd);
  handle.addEventListener("lostpointercapture", onLostPointerCapture);

  return () => {
    handle.removeEventListener("pointerdown", onPointerDown);
    handle.removeEventListener("pointermove", onPointerMove);
    handle.removeEventListener("pointerup", onPointerEnd);
    handle.removeEventListener("pointercancel", onPointerEnd);
    handle.removeEventListener("lostpointercapture", onLostPointerCapture);
    target.style.transform = "";
  };
}

/** @type {(() => void) | null} */
let _teardownMainWindow = null;

export function initMac2Drag() {
  if (_teardownMainWindow) return; // already wired
  const handle = document.querySelector(".page-header");
  const target = document.querySelector(".page-wrapper");
  if (handle instanceof HTMLElement && target instanceof HTMLElement) {
    _teardownMainWindow = makeDraggable(handle, target);
  }
}

export function teardownMac2Drag() {
  _teardownMainWindow?.();
  _teardownMainWindow = null;
}
