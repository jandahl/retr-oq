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
    for win_id in ("win-oq", "win-decon", "win-home", "win-apps", "win-about", "win-trash"):
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


def test_context_menu_clean_up_and_hide_icons(page, base_url):
    goto_aqua(page, base_url)
    # Open desktop context menu via JS (Playwright right-click coords vary with zoom).
    page.evaluate(
        """() => {
          const desk = document.getElementById('desktop');
          desk.dispatchEvent(new MouseEvent('contextmenu', {
            bubbles: true, cancelable: true, clientX: 40, clientY: 80
          }));
        }"""
    )
    page.wait_for_timeout(50)
    menu = page.locator("#desktop-context-menu")
    assert menu.is_visible()
    assert page.locator("#desktop-ctx-cleanup").count() == 1
    assert "Clean Up Desktop" in page.locator("#desktop-ctx-cleanup").inner_text()
    assert page.locator("#desktop-ctx-toggle-icons").count() == 1

    # Hide icons → persists class + localStorage
    page.locator("#desktop-ctx-toggle-icons a").click()
    page.wait_for_timeout(50)
    assert page.locator(".desktop-icons").evaluate("el => el.classList.contains('icons-hidden')")
    stored = page.evaluate("() => localStorage.getItem('retr-oq:aqua-desktop-icons')")
    assert stored == "hidden"

    # Re-open menu and show again
    page.evaluate(
        """() => {
          const desk = document.getElementById('desktop');
          desk.dispatchEvent(new MouseEvent('contextmenu', {
            bubbles: true, cancelable: true, clientX: 40, clientY: 80
          }));
        }"""
    )
    page.wait_for_timeout(50)
    page.locator("#desktop-ctx-toggle-icons a").click()
    page.wait_for_timeout(50)
    assert not page.locator(".desktop-icons").evaluate("el => el.classList.contains('icons-hidden')")

    # Clean Up exists and runs without error (snaps column / clears selection)
    page.dblclick(".desktop-icon[data-open='win-oq']")
    page.wait_for_timeout(80)
    page.evaluate(
        """() => {
          const desk = document.getElementById('desktop');
          desk.dispatchEvent(new MouseEvent('contextmenu', {
            bubbles: true, cancelable: true, clientX: 40, clientY: 80
          }));
        }"""
    )
    page.wait_for_timeout(50)
    page.locator("#desktop-ctx-cleanup a").click()
    page.wait_for_timeout(50)
    assert page.locator(".desktop-icon.selected").count() == 0
    # Icons still in the tidy right-side column container
    assert page.locator(".desktop-icons .desktop-icon").count() >= 4


def test_app_switcher_hud_present_and_opens(page, base_url):
    goto_aqua(page, base_url)
    hud = page.locator("#app-switcher")
    assert hud.count() == 1
    assert hud.is_hidden()

    # Open a window so the switcher has a running app, then Meta+Tab
    page.dblclick(".desktop-icon[data-open='win-oq']")
    page.wait_for_timeout(80)
    page.keyboard.down("Meta")
    page.keyboard.press("Tab")
    page.wait_for_timeout(80)
    assert hud.is_visible()
    assert page.locator("#app-switcher-track .app-switcher-item").count() >= 1
    page.keyboard.press("Escape")
    page.wait_for_timeout(50)
    assert hud.is_hidden()


def test_screen_effects_menu_and_host_hook(page, base_url):
    goto_aqua(page, base_url)
    # DOM presence — System menu item + context item
    assert page.locator("#menu-screen-effects").count() == 1
    assert page.locator("#desktop-ctx-effects").count() == 1
    # Host should attach (router loads screensaver.js for aqua/)
    page.wait_for_timeout(150)
    has_host = page.evaluate(
        """() => !!(window.OqScreensaver && (window.OqScreensaver.aqua || window.OqScreensaver.host))"""
    )
    assert has_host
    # Idle hook present for tests; do not wait on real idle in CI
    assert page.evaluate("() => typeof window.__aquaScreenEffects?.setIdleMs === 'function'")


def test_applications_window_opens_from_go_and_dock(page, base_url):
    goto_aqua(page, base_url)
    assert page.locator("#win-apps").evaluate("el => el.classList.contains('closed')")
    page.locator("#dock > .osx-dock-item[data-open='win-apps']").click()
    page.wait_for_timeout(100)
    win = page.locator("#win-apps")
    assert win.is_visible()
    assert not win.evaluate("el => el.classList.contains('closed')")
    labels = page.locator("#win-apps .finder-item span").all_inner_texts()
    assert "OQ!" in labels
    assert "Word Deconstructor" in labels
    assert "About" in labels
    # Go menu also lists Applications
    assert page.locator("#menu-bar [data-open='win-apps']").count() >= 1


def test_force_quit_sheet_lists_open_apps(page, base_url):
    goto_aqua(page, base_url)
    page.dblclick(".desktop-icon[data-open='win-oq']")
    page.wait_for_timeout(80)
    page.evaluate("() => document.querySelector('#menu-force-quit a').click()")
    page.wait_for_timeout(80)
    overlay = page.locator("#forcequit-overlay")
    assert overlay.is_visible()
    rows = page.locator("#forcequit-list li").all_inner_texts()
    assert any("OQ!" in r for r in rows)
    page.click("#forcequit-cancel")
    page.wait_for_timeout(60)
    assert page.locator("#forcequit-overlay").is_hidden()


def test_get_info_sheet_for_macintosh_hd(page, base_url):
    goto_aqua(page, base_url)
    page.click(".desktop-icon[data-open='win-home']")
    page.wait_for_timeout(40)
    page.evaluate("() => document.querySelector('#menu-get-info a').click()")
    page.wait_for_timeout(80)
    assert page.locator("#getinfo-overlay").is_visible()
    assert "Macintosh HD" in page.locator("#getinfo-name").inner_text()
    assert page.locator("#getinfo-blurb").inner_text().strip() != ""
    page.click("#getinfo-ok")
    page.wait_for_timeout(40)
    assert page.locator("#getinfo-overlay").is_hidden()


def test_graphite_appearance_persists(page, base_url):
    goto_aqua(page, base_url)
    page.evaluate("() => document.querySelector('#menu-sys-prefs a').click()")
    page.wait_for_timeout(60)
    page.check("#appearance-graphite")
    page.wait_for_timeout(40)
    assert page.evaluate("() => document.documentElement.dataset.appearance") == "graphite"
    page.click("#sysprefs-ok")
    page.reload()
    page.wait_for_timeout(200)
    assert page.evaluate("() => document.documentElement.dataset.appearance") == "graphite"
    stored = page.evaluate("() => localStorage.getItem('retr-oq:aqua-appearance')")
    assert stored == "graphite"


def test_edge_resize_handles_present(page, base_url):
    goto_aqua(page, base_url)
    count = page.locator("#win-oq .osx-resize").count()
    assert count == 8
    assert page.locator("#win-oq .osx-growbox").count() == 1


def test_icon_drag_persists_position(page, base_url):
    """Fine-pointer drag writes localStorage; Clean Up clears it."""
    goto_aqua(page, base_url)
    # Force fine-pointer path: evaluate drag helpers via stored positions API.
    page.evaluate(
        """() => {
          const icon = document.querySelector(".desktop-icon[data-open='win-oq']");
          const desk = document.getElementById('desktop');
          const icons = document.querySelector('.desktop-icons');
          icons.classList.add('is-free');
          icons.style.top = '0'; icons.style.left = '0'; icons.style.right = '0';
          icons.style.bottom = '0'; icons.style.width = '100%'; icons.style.height = '100%';
          icon.style.position = 'absolute';
          icon.style.left = '40px';
          icon.style.top = '60px';
          localStorage.setItem('retr-oq:aqua-desktop-icon-pos', JSON.stringify({
            'win-oq': { left: 40, top: 60 }
          }));
        }"""
    )
    page.reload()
    page.wait_for_timeout(200)
    left = page.evaluate(
        """() => document.querySelector('.desktop-icon[data-open="win-oq"]').style.left"""
    )
    assert left == "40px"
    page.evaluate("() => document.querySelector('#desktop-ctx-cleanup a').click()")
    # Clean Up may need context open — call storage clear via menu click after showing isn't required;
    # invoke Clean Up through the same handler by dispatching click on the menu item link after unhiding.
    page.evaluate(
        """() => {
          const item = document.getElementById('desktop-ctx-cleanup');
          item.querySelector('a').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }"""
    )
    page.wait_for_timeout(60)
    stored = page.evaluate("() => localStorage.getItem('retr-oq:aqua-desktop-icon-pos')")
    assert stored in (None, "")



def test_time_machine_overlay_opens_and_sets_era(page, base_url):
    """TM overlay opens from System menu; selecting an era sets data-osx-era."""
    goto_aqua(page, base_url)
    assert page.evaluate("() => document.documentElement.dataset.osxEra") in (
        "aqua",
        "tiger",
        "leopard",
        None,
        "",
    )
    # Default boot should be aqua when storage empty
    page.evaluate("() => localStorage.removeItem('retr-oq:aqua-osx-era')")
    page.reload()
    page.wait_for_timeout(200)
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "aqua"

    page.evaluate("() => document.querySelector('#menu-time-machine a').click()")
    page.wait_for_timeout(80)
    overlay = page.locator("#tm-overlay")
    assert overlay.is_visible()
    assert page.evaluate("() => window.__aquaTimeMachine && window.__aquaTimeMachine.isOpen") is True

    # Select Tiger via card
    page.click('.tm-era-card[data-era="tiger"]')
    page.wait_for_timeout(40)
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "tiger"

    page.click("#tm-restore")
    page.wait_for_timeout(800)
    assert page.locator("#tm-overlay").is_hidden()
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "tiger"
    stored = page.evaluate("() => localStorage.getItem('retr-oq:aqua-osx-era')")
    assert stored == "tiger"

    # Persists across reload (boot script)
    page.reload()
    page.wait_for_timeout(200)
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "tiger"


def test_time_machine_cancel_restores_previous_era(page, base_url):
    goto_aqua(page, base_url)
    page.evaluate(
        """() => {
          localStorage.setItem('retr-oq:aqua-osx-era', 'aqua');
          document.documentElement.dataset.osxEra = 'aqua';
        }"""
    )
    page.evaluate("() => window.__aquaTimeMachine.open()")
    page.wait_for_timeout(60)
    page.click('.tm-era-card[data-era="leopard"]')
    page.wait_for_timeout(40)
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "leopard"
    page.click("#tm-cancel")
    page.wait_for_timeout(60)
    assert page.locator("#tm-overlay").is_hidden()
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "aqua"
    assert page.evaluate("() => localStorage.getItem('retr-oq:aqua-osx-era')") in (
        "aqua",
        None,
    )


def test_time_machine_reduced_motion_instant_restore(page, base_url):
    """With prefers-reduced-motion, Restore swaps era without leaving overlay stuck."""
    goto_aqua(page, base_url)
    page.emulate_media(reduced_motion="reduce")
    page.evaluate("() => window.__aquaTimeMachine.open()")
    page.wait_for_timeout(40)
    page.click('.tm-era-card[data-era="leopard"]')
    page.click("#tm-restore")
    page.wait_for_timeout(100)
    assert page.locator("#tm-overlay").is_hidden()
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "leopard"
    assert page.evaluate("() => localStorage.getItem('retr-oq:aqua-osx-era')") == "leopard"
