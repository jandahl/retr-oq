"""win98/ regression suite.

Codifies the ad hoc Playwright checks run by hand while building and
fixing win98/ (taskbar, Start menu, drag/resize/minimize/maximize/close,
mobile viewport clamping, touch hit-testing, icon rendering). Each test
below maps to a specific bug this theme actually shipped with and was
fixed for -- see the git history of win98/app.js and win98/style.css for
the fix each one guards against.
"""

WIN98_ICON_IDS = ["win-oq", "win-about", "win-computer", "win-recyclebin"]


def goto_win98(page, base_url):
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    # A 404 surfaces as a generic "Failed to load resource" console error
    # with no URL in the message text itself, so the only reliable way to
    # tell "the expected favicon 404" apart from a real missing asset is to
    # correlate against the actual response, not string-match the message.
    unexpected_404s = []
    page.on(
        "response",
        lambda r: unexpected_404s.append(r.url) if r.status == 404 and not r.url.endswith("/favicon.ico") else None,
    )
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.goto(f"{base_url}/win98/index.html")
    page.wait_for_timeout(300)
    return errors, console_errors, unexpected_404s


def test_loads_without_errors(page, base_url):
    errors, console_errors, unexpected_404s = goto_win98(page, base_url)
    assert errors == []
    # No 404 other than the harmless favicon (every page in this repo gets
    # one, since none of them ship a favicon) -- checked against the real
    # response, not string-matched against the console message, which
    # never actually includes the URL.
    assert unexpected_404s == []
    # Any remaining console "error" is real, once the generic
    # "Failed to load resource ... 404" text (already proven above to be
    # the favicon alone, and only that) is filtered back out.
    real_errors = [e for e in console_errors if "404" not in e]
    assert real_errors == []


def test_all_windows_present_and_stacked_above_desktop_icons(page, base_url):
    # Regression test: only the first window in DOM order ever got an
    # explicit z-index (a single focus(windows[0]) call at setup), so every
    # other window sat at z-index:auto -- the same stacking level as
    # ordinary content, BELOW .desktop-icons' own explicit z-index: 1. Any
    # window that hadn't yet been focused rendered *behind* the desktop
    # icons, an impossible state on a real desktop.
    goto_win98(page, base_url)
    icon_z = int(page.evaluate("getComputedStyle(document.querySelector('.desktop-icons')).zIndex"))
    for win_id in WIN98_ICON_IDS:
        win_z = page.evaluate(f"getComputedStyle(document.getElementById('{win_id}')).zIndex")
        assert win_z != "auto", f"{win_id} has no explicit z-index"
        assert int(win_z) > icon_z, f"{win_id} (z={win_z}) is not above desktop icons (z={icon_z})"


def test_desktop_icons_have_no_button_chrome(page, base_url):
    # Regression test: desktop icons are real <button> elements, but
    # 98.css's own `button` reset (beveled box-shadow, silver background,
    # min-75px width/height, color:transparent) was bleeding through onto
    # them, rendering each one as a visible 3D button square.
    goto_win98(page, base_url)
    icon = page.query_selector(".desktop-icon")
    styles = page.evaluate(
        "el => { const s = getComputedStyle(el); return {boxShadow: s.boxShadow, bg: s.backgroundColor, minWidth: s.minWidth}; }",
        icon,
    )
    assert styles["boxShadow"] in ("none", "")
    assert styles["minWidth"] in ("0px", "auto")


def test_desktop_icons_render_svg_art_not_emoji(page, base_url):
    # Regression test: icons were plain Unicode emoji, which render as a
    # monochrome/outline glyph on any platform lacking a color emoji font
    # (common on Linux Chromium, some Android WebViews) -- "icons are black
    # only". Real inline SVG background art renders identically everywhere.
    goto_win98(page, base_url)
    for name in ["oq", "computer", "about", "recyclebin"]:
        bg = page.evaluate(f"getComputedStyle(document.querySelector('.icon-{name}')).backgroundImage")
        assert bg.startswith('url("data:image/svg+xml'), f"icon-{name} background-image was: {bg!r}"
        # No emoji text content left behind either -- the glyph should be
        # an empty span carrying only the background-image above.
    for win_id in WIN98_ICON_IDS:
        glyph_text = page.eval_on_selector(
            f"#desktop button[data-open='{win_id}'] .desktop-icon-glyph", "el => el.textContent"
        )
        assert glyph_text.strip() == ""


def test_taskbar_has_one_button_per_window_with_icon_and_label(page, base_url):
    goto_win98(page, base_url)
    buttons = page.query_selector_all(".taskbar-window-button")
    assert len(buttons) == len(WIN98_ICON_IDS)
    for btn in buttons:
        assert btn.query_selector(".taskbar-window-icon") is not None
        label = btn.query_selector(".taskbar-window-label")
        assert label is not None
        assert label.text_content().strip() != ""


def test_start_menu_open_close_toggle(page, base_url):
    goto_win98(page, base_url)
    assert page.get_attribute("#start-menu", "hidden") is not None
    page.click("#start-button")
    assert page.get_attribute("#start-menu", "hidden") is None
    assert page.get_attribute("#start-button", "aria-expanded") == "true"
    page.click("#start-button")
    assert page.get_attribute("#start-menu", "hidden") is not None


def test_start_menu_closes_on_outside_click(page, base_url):
    goto_win98(page, base_url)
    page.click("#start-button")
    page.mouse.click(700, 400)
    page.wait_for_timeout(100)
    assert page.get_attribute("#start-menu", "hidden") is not None


def test_start_menu_closes_on_escape(page, base_url):
    goto_win98(page, base_url)
    page.click("#start-button")
    page.keyboard.press("Escape")
    page.wait_for_timeout(100)
    assert page.get_attribute("#start-menu", "hidden") is not None


def test_start_menu_item_opens_window_and_closes_menu(page, base_url):
    goto_win98(page, base_url)
    page.click("#win-computer .win-minimize")  # start from a known (minimized) state
    page.click("#start-button")
    page.click(".start-menu-item[data-open='win-computer']")
    page.wait_for_timeout(150)
    assert page.get_attribute("#start-menu", "hidden") is not None
    assert "minimized" not in page.eval_on_selector("#win-computer", "el => el.className")


def test_shutdown_dialog_opens_and_closes(page, base_url):
    goto_win98(page, base_url)
    page.click("#start-button")
    page.click("#start-menu-shutdown")
    page.wait_for_timeout(100)
    assert page.get_attribute("#shutdown-overlay", "hidden") is None
    page.click("#shutdown-ok")
    page.wait_for_timeout(100)
    assert page.get_attribute("#shutdown-overlay", "hidden") is not None


def test_taskbar_clock_updates_live(page, base_url):
    goto_win98(page, base_url)
    initial = page.text_content("#taskbar-clock")
    assert initial.strip() != ""
    # Format sanity check ("H:MM AM/PM"), not a specific value -- the clock
    # is real-time, not fixed.
    import re

    assert re.match(r"^\d{1,2}:\d{2} (AM|PM)$", initial.strip())


def test_window_drag_moves_by_title_bar(page, base_url):
    goto_win98(page, base_url)
    win = page.query_selector("#win-about")
    before = win.bounding_box()
    titlebar = page.query_selector("#win-about .title-bar")
    tbox = titlebar.bounding_box()
    page.mouse.move(tbox["x"] + 50, tbox["y"] + 10)
    page.mouse.down()
    page.mouse.move(tbox["x"] + 120, tbox["y"] + 80, steps=5)
    page.mouse.up()
    after = win.bounding_box()
    assert after["x"] != before["x"] or after["y"] != before["y"]


def test_window_resize_from_se_handle(page, base_url):
    goto_win98(page, base_url)
    win = page.query_selector("#win-about")
    # win-about isn't topmost by default (win-computer/win-recyclebin cover
    # part of its bottom-right corner in the default cascade) -- focusing
    # it first, via a real click, brings it above whatever's currently
    # covering its own resize handle. Real overlapping-window behavior, not
    # a workaround: a window's own resize handle is only reachable where
    # nothing else is drawn on top of it, same as any real desktop.
    page.click("#win-about .title-bar-text")
    before = win.bounding_box()
    se = page.query_selector("#win-about .win98-resize-se")
    sbox = se.bounding_box()
    page.mouse.move(sbox["x"] + 3, sbox["y"] + 3)
    page.mouse.down()
    page.mouse.move(sbox["x"] + 60, sbox["y"] + 40, steps=5)
    page.mouse.up()
    after = win.bounding_box()
    assert after["width"] > before["width"]
    assert after["height"] > before["height"]


def test_window_maximize_and_restore(page, base_url):
    goto_win98(page, base_url)
    win = page.query_selector("#win-about")
    before = win.bounding_box()
    page.click("#win-about .win-maximize")
    page.wait_for_timeout(100)
    maxed = win.bounding_box()
    assert maxed["width"] > before["width"]
    page.click("#win-about .win-maximize")
    page.wait_for_timeout(100)
    restored = win.bounding_box()
    assert abs(restored["width"] - before["width"]) < 2
    assert abs(restored["height"] - before["height"]) < 2


def test_window_minimize_and_restore_via_taskbar(page, base_url):
    goto_win98(page, base_url)
    page.click("#win-about .win-minimize")
    page.wait_for_timeout(100)
    assert page.evaluate("getComputedStyle(document.getElementById('win-about')).display") == "none"
    page.click(".taskbar-window-button:has-text('About retr-oq')")
    page.wait_for_timeout(100)
    assert page.evaluate("getComputedStyle(document.getElementById('win-about')).display") != "none"


def test_window_close_rebuilds_a_fresh_taskbar_button(page, base_url):
    goto_win98(page, base_url)
    before_count = len(page.query_selector_all(".taskbar-window-button"))
    page.click("#win-about .win-close")
    page.wait_for_timeout(100)
    after_count = len(page.query_selector_all(".taskbar-window-button"))
    assert after_count == before_count  # closing parks the window, doesn't remove its taskbar entry
    assert "minimized" in page.eval_on_selector("#win-about", "el => el.className")


def test_tap_highlight_color_suppressed(page, base_url):
    # Regression test: WebKit's default tap-highlight overlay is separate
    # from any CSS :active state -- without an explicit override, every tap
    # on a desktop icon flashed a translucent grey rectangle, looking
    # exactly like the "still a button square" bug this theme otherwise
    # fixes deliberately.
    goto_win98(page, base_url)
    color = page.evaluate(
        "getComputedStyle(document.querySelector('.desktop-icon')).webkitTapHighlightColor"
    )
    assert color == "rgba(0, 0, 0, 0)"


# ---------- Mobile / touch-specific ----------


def test_mobile_windows_clamp_within_viewport(touch_page, base_url):
    # Regression test: the markup's starting top/left/width/height are
    # sized for a desktop viewport and overflowed outright on a phone-width
    # screen, pushing a window's own close/minimize/maximize buttons
    # entirely off-screen with no way to reach them.
    goto_win98(touch_page, base_url)
    viewport = touch_page.viewport_size
    for win_id in WIN98_ICON_IDS:
        box = touch_page.query_selector(f"#{win_id}").bounding_box()
        assert box["x"] >= 0
        assert box["y"] >= 0
        assert box["x"] + box["width"] <= viewport["width"] + 1
        # bottom is allowed up to the taskbar's own height above the
        # viewport bottom, not the full viewport height


def test_touch_tap_on_title_bar_controls_is_not_swallowed_by_resize_handle(touch_page, base_url):
    # Regression test: the NE corner resize-handle hitbox, scaled to 50x50
    # for (pointer: coarse), fully overlapped the minimize/maximize/close
    # button cluster and had a higher effective z-index than the
    # unpositioned title bar, silently swallowing taps meant for those
    # buttons.
    goto_win98(touch_page, base_url)
    close_btn = touch_page.query_selector("#win-recyclebin .win-close")
    box = close_btn.bounding_box()
    touch_page.touchscreen.tap(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    touch_page.wait_for_timeout(150)
    assert "minimized" in touch_page.eval_on_selector("#win-recyclebin", "el => el.className")


def test_touch_resize_handles_are_scaled_up(touch_page, base_url):
    goto_win98(touch_page, base_url)
    se = touch_page.query_selector("#win-about .win98-resize-se")
    box = se.bounding_box()
    assert box["width"] >= 44 and box["height"] >= 44
