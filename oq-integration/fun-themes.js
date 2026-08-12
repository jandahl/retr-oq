// @ts-check
// Fun Themes: an experimental, just-for-fun feature that swaps the app's
// look for a vendored retro UI skin. While enabled it ignores the normal
// Look and Feel theme and font selections (docs/theme-store.js,
// docs/web-fonts.js keep running underneath but the skin's stylesheet wins
// on cascade order/specificity for the elements it styles).
//
// The skin's CSS lives in docs/vendor/fun-themes/ (see README.md there for
// provenance/license) and is deliberately NOT in docs/sw.js's PRECACHE list:
// it ships on GitHub Pages like any other same-origin file, but only the
// runtime cache-first fallback fetches and caches it, and only once a user
// actually opts in — nobody pays for it just by installing the PWA.

import { APP_EVENTS } from "./events.js";
import { getFunThemeId, isFunThemesEnabled } from "./settings-state.js";
import { initMac2Drag, teardownMac2Drag } from "./fun-themes-mac2-drag.js";
import { initMac2Windows, teardownMac2Windows } from "./fun-themes-mac2-windows.js";

const LINK_ID = "oq-fun-theme-stylesheet";
const ADAPTER_LINK_ID = "oq-fun-theme-adapter-stylesheet";
const FOCUS_STYLE_ID = "oq-fun-theme-focus-override";
const BODY_CLASS = "oq-fun-theme-active";

// system.css (and likely future skins) resets `outline` on focus, which
// otherwise leaves keyboard users with no focus indicator at all — oq
// doesn't have its own :focus-visible styling on every control to fall back
// on. Injected after the skin's stylesheet so it wins on source order. Black
// rather than an accent color: these retro skins are themselves black/white
// palettes (docs/fun-themes-mac2.css remaps oq's own --kc-accent etc. to
// black), so a blue ring would itself be a color leak against them.
const FOCUS_OVERRIDE_CSS =
  ":focus-visible { outline: 2px solid #000000 !important; outline-offset: 2px !important; }";

// `href` is the vendored third-party skin (docs/vendor/fun-themes/,
// unmodified). `adapterHref` is oq's own hand-authored overlay that maps the
// skin's look onto oq's real selectors -- system.css's own class vocabulary
// (.btn, .window, .title-bar, ...) doesn't exist in oq's markup, so without
// an adapter the vendored stylesheet alone changes almost nothing visible.
// Loaded after `href` so it wins the cascade for anything both touch.
const THEMES = Object.freeze({
  macII: {
    href: new URL("./vendor/fun-themes/system.css", import.meta.url).href,
    adapterHref: new URL("./fun-themes-mac2.css", import.meta.url).href,
    bodyClass: "oq-fun-theme-mac2",
  },
});

export function applyFunThemeSetting() {
  document.getElementById(LINK_ID)?.remove();
  document.getElementById(ADAPTER_LINK_ID)?.remove();
  document.getElementById(FOCUS_STYLE_ID)?.remove();
  document.body.classList.remove(BODY_CLASS);
  for (const theme of Object.values(THEMES)) document.body.classList.remove(theme.bodyClass);
  teardownMac2Drag();
  teardownMac2Windows();

  if (!isFunThemesEnabled()) return;
  const theme = THEMES[getFunThemeId()];
  if (!theme) return;

  const link = document.createElement("link");
  link.id = LINK_ID;
  link.rel = "stylesheet";
  link.href = theme.href;
  document.head.append(link);

  const adapterLink = document.createElement("link");
  adapterLink.id = ADAPTER_LINK_ID;
  adapterLink.rel = "stylesheet";
  adapterLink.href = theme.adapterHref;
  document.head.append(adapterLink);

  const focusStyle = document.createElement("style");
  focusStyle.id = FOCUS_STYLE_ID;
  focusStyle.textContent = FOCUS_OVERRIDE_CSS;
  document.head.append(focusStyle);

  document.body.classList.add(BODY_CLASS, theme.bodyClass);
  if (theme === THEMES.macII) {
    initMac2Drag();
    initMac2Windows();
  }
}

export function initFunThemes() {
  applyFunThemeSetting();
  window.addEventListener(APP_EVENTS.funThemes, applyFunThemeSetting);
}
