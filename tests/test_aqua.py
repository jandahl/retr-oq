"""Aqua theme regression suite.

Guards the early OS X Aqua skin + shared/osx shell against the gaps Jan
called out (boot friction, idle menubar hover, independent close, Finder
open-by-dblclick, etc.).
"""


def goto_aqua(page, base_url):
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    unexpected_404s = []
    page.on(
        "response",
        lambda r: unexpected_404s.append(r.url)
        if r.status == 404
        and not r.url.endswith("/favicon.ico")
        and r.url.startswith(base_url)
        else None,
    )
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.goto(f"{base_url}/aqua/index.html")
    page.wait_for_timeout(200)
    return errors, console_errors, unexpected_404s


def test_loads_clean_without_power_button_boot(page, base_url):
    errors, console_errors, unexpected_404s = goto_aqua(page, base_url)
    assert errors == []
    assert unexpected_404s == []
    real_errors = [e for e in console_errors if "404" not in e]
    assert real_errors == []
    # No power-button / lingering boot overlay — desktop is immediate.
    assert page.query_selector("#boot-screen") is None
    assert page.query_selector("#power-button") is None
    assert page.locator("#shell").is_visible()
    assert page.locator("#desktop").is_visible()
    assert page.locator("#menu-bar").is_visible()
    assert page.locator("#dock").is_visible()


def test_windows_start_closed(page, base_url):
    goto_aqua(page, base_url)
    for win_id in ("win-oq", "win-decon", "win-home", "win-about", "win-trash"):
        assert page.locator(f"#{win_id}").evaluate("el => el.classList.contains('closed')")


def test_dblclick_opens_macintosh_hd(page, base_url):
    goto_aqua(page, base_url)
    page.dblclick(".desktop-icon[data-open='win-home']")
    page.wait_for_timeout(100)
    win = page.locator("#win-home")
    assert win.is_visible()
    assert not win.evaluate("el => el.classList.contains('closed')")


def test_independent_close_leaves_decon_open(page, base_url):
    """Open OQ! + Word Deconstructor, close OQ! — DECON must stay open."""
    goto_aqua(page, base_url)
    page.dblclick(".desktop-icon[data-open='win-oq']")
    page.wait_for_timeout(80)
    page.dblclick(".desktop-icon[data-open='win-decon']")
    page.wait_for_timeout(80)
    assert page.locator("#win-oq").is_visible()
    assert page.locator("#win-decon").is_visible()

    # Focus OQ! via Dock (windows overlap so a titlebar click can miss), then close.
    page.locator("#dock > .osx-dock-item[data-open='win-oq']").click()
    page.wait_for_timeout(80)
    page.evaluate("() => document.getElementById('win-oq-close').click()")
    page.wait_for_timeout(120)
    assert page.locator("#win-oq").evaluate("el => el.classList.contains('closed')")
    assert page.locator("#win-decon").is_visible()
    assert not page.locator("#win-decon").evaluate("el => el.classList.contains('closed')")


def test_app_menu_tracks_focus(page, base_url):
    goto_aqua(page, base_url)
    assert page.locator("#app-menu-title").inner_text() == "Finder"

    page.dblclick(".desktop-icon[data-open='win-oq']")
    page.wait_for_timeout(100)
    assert page.locator("#app-menu-title").inner_text() == "OQ!"
    assert "About OQ!" in page.locator("#app-menu-about-link").inner_text()

    page.dblclick(".desktop-icon[data-open='win-decon']")
    page.wait_for_timeout(100)
    assert page.locator("#app-menu-title").inner_text() == "Word Deconstructor"

    # Finder window focus flips the app menu back.
    page.dblclick(".desktop-icon[data-open='win-home']")
    page.wait_for_timeout(100)
    assert page.locator("#app-menu-title").inner_text() == "Finder"

    # Bare desktop click (empty strip under the menubar, left of icons) → Finder.
    # Dispatch on #desktop so open windows cannot intercept the hit-test.
    page.evaluate(
        """() => {
          const desk = document.getElementById('desktop');
          desk.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 8, clientY: 8 }));
        }"""
    )
    page.wait_for_timeout(80)
    assert page.locator("#app-menu-title").inner_text() == "Finder"


def test_menubar_idle_hover_has_no_accent_class_only(page, base_url):
    """Accent highlight is via .menu-open, not bare :hover (CSS contract)."""
    goto_aqua(page, base_url)
    css = page.evaluate(
        """() => {
          const sheets = [...document.styleSheets];
          let idleHover = false;
          let menuOpen = false;
          for (const sheet of sheets) {
            let rules;
            try { rules = sheet.cssRules; } catch { continue; }
            for (const rule of rules) {
              if (!rule.selectorText) continue;
              const s = rule.selectorText;
              if (s.includes('.osx-menubar') && s.includes(':hover')
                  && s.includes('[role') && !s.includes('menu-open')
                  && !s.includes('[role="menu"]') && !s.includes('.dock')) {
                // Top-level menubar item idle hover painting accent = bad.
                const bg = rule.style.background || rule.style.backgroundColor || '';
                if (bg.includes('aqua-accent') || bg.includes('4d76c5') || bg.includes('accent')) {
                  idleHover = true;
                }
              }
              if (s.includes('.menu-open') && s.includes('.osx-menubar')) {
                menuOpen = true;
              }
            }
          }
          return { idleHover, menuOpen };
        }"""
    )
    assert css["menuOpen"] is True
    assert css["idleHover"] is False


def test_optional_zoom_toggle(page, base_url):
    goto_aqua(page, base_url)
    page.dblclick(".desktop-icon[data-open='win-home']")
    page.wait_for_timeout(100)
    win = page.locator("#win-home")
    before = win.evaluate(
        "el => ({ t: el.style.top, l: el.style.left, w: el.style.width, h: el.style.height })"
    )
    page.click("#win-home-zoom")
    page.wait_for_timeout(220)
    assert win.evaluate("el => el.classList.contains('zoomed')")
    page.click("#win-home-zoom")
    page.wait_for_timeout(220)
    assert not win.evaluate("el => el.classList.contains('zoomed')")
    after = win.evaluate(
        "el => ({ t: el.style.top, l: el.style.left, w: el.style.width, h: el.style.height })"
    )
    # Zoom restore should return to prior rect (Finder-style).
    assert after == before


def test_dock_captions_present(page, base_url):
    goto_aqua(page, base_url)
    captions = page.locator("#dock > .osx-dock-item .dock-caption")
    assert captions.count() >= 5
    labels = captions.all_inner_texts()
    assert "OQ!" in labels
    assert "Trash" in labels
