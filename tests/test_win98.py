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


def open_via_dblclick(page, win_id):
    """Opens `win_id` the way a real mouse/trackpad visitor would -- every
    window starts closed (see win98/app.js's own "start closed" comment),
    so any test touching a window's geometry or controls needs this first."""
    page.dblclick(f".desktop-icon[data-open='{win_id}']")
    page.wait_for_timeout(100)


def open_via_tap(page, win_id):
    """Same as open_via_dblclick, but for a touch context -- a single tap
    opens on touch (no reliable double-tap), see win98/app.js."""
    icon = page.query_selector(f".desktop-icon[data-open='{win_id}']")
    box = icon.bounding_box()
    page.touchscreen.tap(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.wait_for_timeout(100)


def test_all_windows_start_closed(page, base_url):
    # Real Windows 98 boots to a bare desktop -- no windows open, no
    # taskbar buttons apart from Start/clock. This theme used to open
    # every window by default, cluttering the desktop before the visitor
    # touched anything.
    goto_win98(page, base_url)
    for win_id in WIN98_ICON_IDS:
        assert "minimized" in page.eval_on_selector(f"#{win_id}", "el => el.className")
        assert page.evaluate(f"getComputedStyle(document.getElementById('{win_id}')).display") == "none"
    assert page.query_selector_all(".taskbar-window-button") == []


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


def test_selected_desktop_icon_has_no_whole_button_rectangle(page, base_url):
    # Regression test: selecting an icon used to paint a translucent navy
    # background + border across the *whole* button (icon + gap + label),
    # reading as a plain highlighted rectangle -- not how a real Windows
    # desktop selects an icon (a tint on the icon glyph alone, a
    # tightly-fit fill behind just the label text). The button element
    # itself should carry no background/border for selection at all now;
    # only its .desktop-icon-glyph::after (icon tint) and
    # .desktop-icon-label (text fill) should react to .selected.
    goto_win98(page, base_url)
    icon = page.query_selector(".desktop-icon")
    page.evaluate("el => el.classList.add('selected')", icon)
    button_styles = page.evaluate(
        "el => { const s = getComputedStyle(el); return {bg: s.backgroundColor, border: s.borderColor}; }",
        icon,
    )
    assert button_styles["bg"] in ("rgba(0, 0, 0, 0)", "transparent")


def test_desktop_icon_single_click_selects_but_does_not_open(page, base_url):
    # Real desktop convention (and this theme's own explicit choice on a
    # mouse/trackpad): a single click only selects an icon, it doesn't
    # launch the app -- launching takes a double-click, same as real
    # Windows. The default `page` fixture has no touch, so
    # (pointer: coarse) is false and this is the code path exercised.
    # All windows start closed, so nothing else needs closing first.
    goto_win98(page, base_url)
    icon = page.query_selector(".desktop-icon[data-open='win-about']")
    icon.click()
    page.wait_for_timeout(100)
    assert "selected" in icon.get_attribute("class")
    assert "minimized" in page.eval_on_selector("#win-about", "el => el.className")


def test_desktop_icon_double_click_opens_on_desktop(page, base_url):
    goto_win98(page, base_url)
    icon = page.query_selector(".desktop-icon[data-open='win-about']")
    icon.dblclick()
    page.wait_for_timeout(150)
    assert "minimized" not in page.eval_on_selector("#win-about", "el => el.className")


def test_touch_desktop_icon_opens_on_single_tap(touch_page, base_url):
    # Touch has no reliable double-tap and no hover-to-preview -- keeps the
    # single-tap-opens behavior this theme shipped with initially.
    goto_win98(touch_page, base_url)
    icon = touch_page.query_selector(".desktop-icon[data-open='win-about']")
    box = icon.bounding_box()
    touch_page.touchscreen.tap(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    touch_page.wait_for_timeout(150)
    assert "minimized" not in touch_page.eval_on_selector("#win-about", "el => el.className")


def test_start_button_flag_is_greenland_flag(page, base_url):
    # Regression/intent test: the Start button's flag is deliberately the
    # real Greenlandic flag (a red/white bicolor with an off-center
    # swapped-color circle), not a generic four-color Windows-logo
    # stand-in and not OQ!'s own icon -- the one spot on the desktop that's
    # about the theme's setting, not about any single app.
    goto_win98(page, base_url)
    bg = page.evaluate("getComputedStyle(document.querySelector('.start-flag')).backgroundImage")
    assert bg.startswith('url("data:image/svg+xml')
    assert "23c8102e" in bg  # the flag's red, URL-encoded (#c8102e)
    assert "linear-gradient" not in bg


def test_taskbar_has_one_button_per_window_with_icon_and_label(page, base_url):
    goto_win98(page, base_url)
    # Via the Start menu, not desktop-icon double-clicks -- opening one
    # window at its default (large) size can cover other windows' desktop
    # icons underneath it, the same real-desktop stacking behavior other
    # tests here work around. The Start menu sits above every window
    # (z-index 1001, see style.css) so it's always reachable regardless.
    for win_id in WIN98_ICON_IDS:
        page.click("#start-button")
        page.click(f".start-menu-item[data-open='{win_id}']")
        page.wait_for_timeout(100)
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
    # win-computer already starts closed/minimized -- nothing to do first.
    page.click("#start-button")
    page.click(".start-menu-item[data-open='win-computer']")
    page.wait_for_timeout(150)
    assert page.get_attribute("#start-menu", "hidden") is not None
    assert "minimized" not in page.eval_on_selector("#win-computer", "el => el.className")


def test_shutdown_dialog_opens_then_ok_returns_to_theme_picker(page, base_url):
    # Shutting down sends the visitor back to the repo's own theme-picker
    # landing page (relative "../", not a hardcoded absolute URL) rather
    # than just closing the dialog.
    goto_win98(page, base_url)
    page.click("#start-button")
    page.click("#start-menu-shutdown")
    page.wait_for_timeout(100)
    assert page.get_attribute("#shutdown-overlay", "hidden") is None
    with page.expect_navigation():
        page.click("#shutdown-ok")
    assert page.url.rstrip("/") == base_url.rstrip("/")


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
    open_via_dblclick(page, "win-about")
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
    # win-about is the only window opened here, so unlike when every window
    # started open, there's nothing else around to cover its resize handle.
    open_via_dblclick(page, "win-about")
    win = page.query_selector("#win-about")
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
    open_via_dblclick(page, "win-about")
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
    open_via_dblclick(page, "win-about")
    page.click("#win-about .win-minimize")
    page.wait_for_timeout(100)
    assert page.evaluate("getComputedStyle(document.getElementById('win-about')).display") == "none"
    page.click(".taskbar-window-button:has-text('About retr-oq')")
    page.wait_for_timeout(100)
    assert page.evaluate("getComputedStyle(document.getElementById('win-about')).display") != "none"


def test_window_close_removes_its_taskbar_button(page, base_url):
    # Regression test: closing a window used to just re-minimize it and
    # rebuild an identical taskbar button in place, so a closed window's
    # button never actually left the taskbar -- not real Win98 behavior,
    # where the taskbar only ever shows currently-running windows.
    goto_win98(page, base_url)
    open_via_dblclick(page, "win-about")
    before_count = len(page.query_selector_all(".taskbar-window-button"))
    assert before_count == 1
    page.click("#win-about .win-close")
    page.wait_for_timeout(100)
    after_count = len(page.query_selector_all(".taskbar-window-button"))
    assert after_count == before_count - 1
    assert page.query_selector(".taskbar-window-button:has-text('About retr-oq')") is None
    assert "minimized" in page.eval_on_selector("#win-about", "el => el.className")


def test_reopening_a_closed_window_rebuilds_its_taskbar_button(page, base_url):
    goto_win98(page, base_url)
    open_via_dblclick(page, "win-about")
    before_count = len(page.query_selector_all(".taskbar-window-button"))
    page.click("#win-about .win-close")
    page.wait_for_timeout(100)
    open_via_dblclick(page, "win-about")
    after_count = len(page.query_selector_all(".taskbar-window-button"))
    assert after_count == before_count
    btn = page.query_selector(".taskbar-window-button:has-text('About retr-oq')")
    assert btn is not None
    assert "active" in btn.get_attribute("class")
    assert "minimized" not in page.eval_on_selector("#win-about", "el => el.className")


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
    # Via the Start menu, not desktop-icon taps -- on a 390px viewport, the
    # first window opened can cover the rest of the desktop icons entirely,
    # same reasoning as the equivalent desktop-side test above.
    for win_id in WIN98_ICON_IDS:
        touch_page.click("#start-button")
        touch_page.click(f".start-menu-item[data-open='{win_id}']")
        touch_page.wait_for_timeout(100)
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
    open_via_tap(touch_page, "win-recyclebin")
    close_btn = touch_page.query_selector("#win-recyclebin .win-close")
    box = close_btn.bounding_box()
    touch_page.touchscreen.tap(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    touch_page.wait_for_timeout(150)
    assert "minimized" in touch_page.eval_on_selector("#win-recyclebin", "el => el.className")


def test_touch_resize_handles_are_scaled_up(touch_page, base_url):
    goto_win98(touch_page, base_url)
    open_via_tap(touch_page, "win-about")
    se = touch_page.query_selector("#win-about .win98-resize-se")
    box = se.bounding_box()
    assert box["width"] >= 44 and box["height"] >= 44


# ---------- OQ! (the dictionary lookup window) ----------

# A small fixture, not the real ~5.75MB dictionary -- shared/dict-source.js
# only cares that the response is `{dictionary_entries: [...]}` with
# lexeme/gloss_en fields, so this is enough to exercise the real load/
# render/filter code path without a live network dependency in CI.
OQ_FIXTURE_ENTRIES = [
    {"lexeme": "illu", "gloss_en": "house"},
    {"lexeme": "nuna", "gloss_en": "land"},
    {"lexeme": "qajaq", "gloss_en": "kayak"},
]


def mock_dict_source(page):
    page.route(
        "**/Oqaasileriffik-dicts/all_entries.json",
        lambda route: route.fulfill(json={"dictionary_entries": OQ_FIXTURE_ENTRIES}),
    )


def test_oq_loads_and_renders_entries_on_first_open(page, base_url):
    mock_dict_source(page)
    goto_win98(page, base_url)
    page.dblclick(".desktop-icon[data-open='win-oq']")
    page.wait_for_selector("#oq-status:has-text('entries loaded')", timeout=5000)
    rows = page.query_selector_all("#oq-tbody tr")
    assert len(rows) == len(OQ_FIXTURE_ENTRIES)
    row_texts = page.eval_on_selector_all("#oq-tbody tr", "els => els.map(e => e.textContent)")
    assert any("house" in t for t in row_texts)
    attribution = page.text_content("#oq-attribution")
    assert "Oqaasileriffik" in attribution
    assert "CC-BY-SA" in attribution


def test_oq_filter_narrows_results(page, base_url):
    mock_dict_source(page)
    goto_win98(page, base_url)
    page.dblclick(".desktop-icon[data-open='win-oq']")
    page.wait_for_selector("#oq-status:has-text('entries loaded')", timeout=5000)
    page.fill("#oq-filter", "kayak")
    page.wait_for_timeout(100)
    rows = page.query_selector_all("#oq-tbody tr")
    assert len(rows) == 1
    # syllabify() inserts a real soft hyphen (\xad) at the syllable
    # boundary, so the lexeme cell renders "qa\xadjaq" -- strip it before
    # comparing, same as a sighted reader would ignore an invisible-unless-
    # wrapping character.
    rendered = page.text_content("#oq-tbody").replace("\xad", "")
    assert "qajaq" in rendered


def test_oq_filter_no_match_shows_no_matches_status(page, base_url):
    mock_dict_source(page)
    goto_win98(page, base_url)
    page.dblclick(".desktop-icon[data-open='win-oq']")
    page.wait_for_selector("#oq-status:has-text('entries loaded')", timeout=5000)
    page.fill("#oq-filter", "zzzznotaword")
    page.wait_for_timeout(100)
    assert page.text_content("#oq-status").strip() == "No matches."
    assert page.query_selector_all("#oq-tbody tr") == []


def test_oq_load_failure_shows_retry_message(page, base_url):
    page.route(
        "**/Oqaasileriffik-dicts/all_entries.json",
        lambda route: route.fulfill(status=500, body="server error"),
    )
    goto_win98(page, base_url)
    page.dblclick(".desktop-icon[data-open='win-oq']")
    page.wait_for_selector("#oq-status:has-text('Could not load')", timeout=5000)
    assert "reopen" in page.text_content("#oq-status").lower()


def test_oq_row_click_selects_with_theme_highlight(page, base_url):
    # Clicking/tapping a result row selects it with the theme's own
    # selection color -- 98.css's real table.interactive > tbody >
    # tr.highlighted rule (navy background, white text), not a one-off
    # style invented for this table.
    mock_dict_source(page)
    goto_win98(page, base_url)
    page.dblclick(".desktop-icon[data-open='win-oq']")
    page.wait_for_selector("#oq-status:has-text('entries loaded')", timeout=5000)
    rows = page.query_selector_all("#oq-tbody tr")
    assert len(rows) == len(OQ_FIXTURE_ENTRIES)
    rows[0].click()
    assert "highlighted" in rows[0].get_attribute("class")
    bg = page.evaluate("el => getComputedStyle(el).backgroundColor", rows[0])
    assert bg == "rgb(0, 0, 128)"  # navy
    # Selecting a second row moves the highlight -- exclusive selection,
    # not accumulating multiple highlighted rows.
    rows[1].click()
    assert "highlighted" in rows[1].get_attribute("class")
    assert "highlighted" not in rows[0].get_attribute("class")


# ---------- Hot Dog Stand (the hidden color scheme) ----------


def test_desktop_right_click_shows_only_properties_item(page, base_url):
    goto_win98(page, base_url)
    assert page.get_attribute("#desktop-context-menu", "hidden") is not None
    page.click("#desktop", button="right", position={"x": 400, "y": 300})
    page.wait_for_timeout(100)
    assert page.get_attribute("#desktop-context-menu", "hidden") is None
    items = page.query_selector_all("#desktop-context-menu .start-menu-item")
    assert len(items) == 1
    assert "Properties" in items[0].text_content()


def test_desktop_right_click_on_icon_does_not_show_context_menu(page, base_url):
    # Real Windows gives an icon its own (different) context menu -- this
    # theme doesn't build one, but it shouldn't show the *desktop's* menu
    # over an icon either, which would be wrong either way.
    goto_win98(page, base_url)
    icon = page.query_selector(".desktop-icon[data-open='win-about']")
    box = icon.bounding_box()
    page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2, button="right")
    page.wait_for_timeout(100)
    assert page.get_attribute("#desktop-context-menu", "hidden") is not None


def test_desktop_context_menu_closes_on_outside_click_and_escape(page, base_url):
    goto_win98(page, base_url)
    page.click("#desktop", button="right", position={"x": 400, "y": 300})
    page.wait_for_timeout(100)
    page.mouse.click(700, 500)
    page.wait_for_timeout(100)
    assert page.get_attribute("#desktop-context-menu", "hidden") is not None

    page.click("#desktop", button="right", position={"x": 400, "y": 300})
    page.wait_for_timeout(100)
    page.keyboard.press("Escape")
    page.wait_for_timeout(100)
    assert page.get_attribute("#desktop-context-menu", "hidden") is not None


def open_display_properties(page):
    page.click("#desktop", button="right", position={"x": 400, "y": 300})
    page.click("#desktop-context-properties")
    page.wait_for_timeout(100)


def test_properties_opens_display_properties_defaulting_to_standard(page, base_url):
    goto_win98(page, base_url)
    open_display_properties(page)
    assert page.get_attribute("#display-props-overlay", "hidden") is None
    assert page.get_attribute("#desktop-context-menu", "hidden") is not None  # clicking the item also closes the menu
    assert page.eval_on_selector("#scheme-select", "el => el.value") == "standard"
    assert "hotdog-stand" not in (page.get_attribute("body", "class") or "")


def test_selecting_hot_dog_stand_and_ok_applies_and_persists_scheme(page, base_url):
    goto_win98(page, base_url)
    open_display_properties(page)
    page.select_option("#scheme-select", "hotdog")
    page.click("#display-props-ok")
    page.wait_for_timeout(100)
    assert page.get_attribute("#display-props-overlay", "hidden") is not None
    assert "hotdog-stand" in page.get_attribute("body", "class")
    # Recognizable chrome actually turns yellow/red, not just the class
    # name -- checked against a real screenshot: desktop is yellow, title
    # bars are red (see style.css's own comment on this scheme).
    assert page.evaluate("getComputedStyle(document.querySelector('.desktop')).backgroundColor") == "rgb(255, 255, 0)"

    # Persists across a reload, same as a real OS remembering your scheme.
    page.reload()
    page.wait_for_timeout(300)
    assert "hotdog-stand" in page.get_attribute("body", "class")


def test_hot_dog_stand_leaves_window_content_untouched(page, base_url):
    # Regression test: an earlier version of this scheme recolored the
    # shared `.window` class red, which bled into every window/dialog's
    # own content area too (static text, table results) since those don't
    # set their own background -- not what a real screenshot of this
    # scheme shows. Only the desktop and title bars should change; a
    # window's own body content stays its normal color.
    mock_dict_source(page)
    goto_win98(page, base_url)
    open_display_properties(page)
    page.select_option("#scheme-select", "hotdog")
    page.click("#display-props-ok")
    page.wait_for_timeout(100)
    assert "hotdog-stand" in page.get_attribute("body", "class")

    page.dblclick(".desktop-icon[data-open='win-oq']")
    page.wait_for_selector("#oq-status:has-text('entries loaded')", timeout=5000)
    body_bg = page.evaluate(
        "getComputedStyle(document.querySelector('#win-oq .win98-window-body')).backgroundColor"
    )
    assert body_bg not in ("rgb(255, 0, 0)", "rgb(255, 255, 0)")
    results_bg = page.evaluate("getComputedStyle(document.querySelector('.oq-results-panel table')).backgroundColor")
    assert results_bg not in ("rgb(255, 0, 0)", "rgb(255, 255, 0)")


# ---------- Settings window (the touch-reachable path to Display Properties) ----------


def test_settings_start_menu_item_is_enabled_and_opens_window(page, base_url):
    # Regression/intent test: Settings used to be a decorative, disabled
    # Start-menu item (start-menu-item--disabled, no data-open) -- the
    # only path to Display Properties was the desktop's right-click menu,
    # unreachable on touch. Settings is now real.
    goto_win98(page, base_url)
    item = page.query_selector(".start-menu-item[data-open='win-settings']")
    assert item is not None
    assert "start-menu-item--disabled" not in item.get_attribute("class")
    page.click("#start-button")
    page.click(".start-menu-item[data-open='win-settings']")
    page.wait_for_timeout(150)
    assert "minimized" not in page.eval_on_selector("#win-settings", "el => el.className")


def test_settings_window_has_working_display_icon(page, base_url):
    goto_win98(page, base_url)
    page.click("#start-button")
    page.click(".start-menu-item[data-open='win-settings']")
    page.wait_for_timeout(150)
    icon = page.query_selector("#settings-display-icon")
    assert icon is not None
    bg = page.evaluate(
        "getComputedStyle(document.querySelector('#settings-display-icon .control-panel-icon-glyph')).backgroundImage"
    )
    assert bg.startswith('url("data:image/svg+xml')

    # This is the actual point: opening Display Properties via a normal
    # click inside a normal window works identically on touch, unlike the
    # desktop's right-click-only Properties item.
    icon.click()
    page.wait_for_timeout(100)
    assert page.get_attribute("#display-props-overlay", "hidden") is None
    assert page.eval_on_selector("#scheme-select", "el => el.value") == "standard"


def test_touch_can_reach_display_properties_via_settings(touch_page, base_url):
    goto_win98(touch_page, base_url)
    touch_page.click("#start-button")
    touch_page.click(".start-menu-item[data-open='win-settings']")
    touch_page.wait_for_timeout(150)
    icon = touch_page.query_selector("#settings-display-icon")
    box = icon.bounding_box()
    touch_page.touchscreen.tap(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    touch_page.wait_for_timeout(150)
    assert touch_page.get_attribute("#display-props-overlay", "hidden") is None
    touch_page.select_option("#scheme-select", "hotdog")
    touch_page.click("#display-props-ok")
    touch_page.wait_for_timeout(100)
    assert "hotdog-stand" in touch_page.get_attribute("body", "class")


def test_apply_applies_without_closing_dialog(page, base_url):
    goto_win98(page, base_url)
    open_display_properties(page)
    page.select_option("#scheme-select", "hotdog")
    page.click("#display-props-apply")
    page.wait_for_timeout(100)
    assert "hotdog-stand" in page.get_attribute("body", "class")
    assert page.get_attribute("#display-props-overlay", "hidden") is None  # still open


def test_cancel_reverts_scheme_without_persisting(page, base_url):
    goto_win98(page, base_url)
    open_display_properties(page)
    page.select_option("#scheme-select", "hotdog")
    page.click("#display-props-apply")  # apply the change first, like a visitor previewing it
    page.wait_for_timeout(100)
    assert "hotdog-stand" in page.get_attribute("body", "class")

    page.click("#display-props-cancel")
    page.wait_for_timeout(100)
    assert page.get_attribute("#display-props-overlay", "hidden") is not None
    assert "hotdog-stand" not in (page.get_attribute("body", "class") or "")

    # Reloading confirms Cancel never persisted the previewed change.
    page.reload()
    page.wait_for_timeout(300)
    assert "hotdog-stand" not in (page.get_attribute("body", "class") or "")
