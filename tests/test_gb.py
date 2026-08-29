"""gb/ regression suite.

A handheld theme, not a window manager -- these tests cover the title
screen, file-select menu, D-pad/A/B routing, shareable ?screen= URLs,
and the undocumented Konami code. Dictionary content itself is upstream
data; we only assert the chrome around it actually opens.
"""

import math


def goto_gb(page, base_url, query=""):
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    unexpected_404s = []
    page.on(
        "response",
        lambda r: unexpected_404s.append(r.url)
        if r.status == 404 and not r.url.endswith("/favicon.ico")
        else None,
    )
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.goto(f"{base_url}/gb/index.html{query}")
    page.wait_for_timeout(300)
    return errors, console_errors, unexpected_404s


def assert_clean(errors, console_errors, unexpected_404s):
    assert errors == []
    assert unexpected_404s == []
    real_errors = [e for e in console_errors if "404" not in e]
    assert real_errors == []


def test_loads_without_errors(page, base_url):
    errors, console_errors, unexpected_404s = goto_gb(page, base_url)
    assert_clean(errors, console_errors, unexpected_404s)
    assert page.locator("#title-screen").is_visible()
    assert page.locator(".title-logo").inner_text() == "OQ!"
    assert page.locator("#menu-screen").is_hidden()


def test_start_opens_menu(page, base_url):
    goto_gb(page, base_url)
    page.keyboard.press("Enter")
    page.wait_for_timeout(100)
    assert page.locator("#menu-screen").is_visible()
    assert page.locator("#title-screen").is_hidden()
    assert "is-selected" in page.locator("#menu-oq").get_attribute("class")


def test_menu_a_opens_oq(page, base_url):
    goto_gb(page, base_url)
    page.keyboard.press("Enter")  # title -> menu
    page.wait_for_timeout(50)
    page.keyboard.press("Enter")  # menu OQ!
    page.wait_for_timeout(100)
    assert page.locator("#oq-screen").is_visible()
    assert "screen=oq" in page.url


def test_deeplink_oq_loads_rows(page, base_url):
    goto_gb(page, base_url, "?screen=oq")
    page.wait_for_function(
        """() => {
          const s = document.getElementById('oq-status');
          return s && s.textContent && !s.textContent.includes('LOADING')
            && !s.textContent.includes('LOAD ERROR');
        }""",
        timeout=20000,
    )
    assert page.locator("#oq-screen").is_visible()
    assert page.locator(".oq-row").count() > 0
    assert "is-selected" in page.locator(".oq-row").first.get_attribute("class")
    line = page.locator(".oq-row.is-selected .oq-gloss-line").inner_text().strip()
    assert line, "selected row must show the English gloss, not just the lexeme"
    assert page.locator("#oq-balloon").count() == 0
    assert "Oqaasileriffik" in page.locator("#oq-attribution").inner_text()


def test_deeplink_oq_filter(page, base_url):
    goto_gb(page, base_url, "?screen=oq&filter=nuna")
    page.wait_for_function(
        """() => {
          const s = document.getElementById('oq-status');
          return s && s.textContent && !s.textContent.includes('LOADING');
        }""",
        timeout=20000,
    )
    assert page.locator("#oq-filter").input_value() == "nuna"
    rows = page.locator(".oq-row")
    assert rows.count() > 0
    # Matches can hit the gloss, not just the lexeme (filterDictEntries
    # searches both), and syllabify() inserts soft hyphens -- strip those
    # before looking for the query.
    blob = " ".join(rows.nth(i).inner_text() for i in range(min(rows.count(), 15)))
    blob = blob.replace("\xad", "").lower()
    assert "nuna" in blob
    assert "NO MATCHES" not in page.locator("#oq-status").inner_text()


def test_b_from_menu_returns_to_title(page, base_url):
    goto_gb(page, base_url)
    page.keyboard.press("Enter")
    page.wait_for_timeout(50)
    page.keyboard.press("Escape")
    page.wait_for_timeout(50)
    assert page.locator("#title-screen").is_visible()
    assert page.locator("#menu-screen").is_hidden()


def test_konami_code_opens_gameover(page, base_url):
    goto_gb(page, base_url)
    for key in [
        "ArrowUp",
        "ArrowUp",
        "ArrowDown",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "ArrowLeft",
        "ArrowRight",
        "b",
        "a",
    ]:
        page.keyboard.press(key)
        page.wait_for_timeout(20)
    assert page.locator("#gameover-screen").is_visible()
    assert "30 LIVES" in page.locator("#gameover-screen").inner_text()
    assert "screen=gameover" in page.url


def test_on_screen_start_opens_menu(touch_page, base_url):
    goto_gb(touch_page, base_url)
    touch_page.locator("[data-input=start]").tap()
    touch_page.wait_for_timeout(100)
    assert touch_page.locator("#menu-screen").is_visible()


def test_deeplink_morph_shows_sprite(page, base_url):
    errors, console_errors, unexpected_404s = goto_gb(page, base_url, "?screen=morph")
    assert_clean(errors, console_errors, unexpected_404s)
    assert page.locator("#morph-screen").is_visible()
    img = page.locator("#morph-sprite-img")
    assert img.is_visible()
    src = img.get_attribute("src") or ""
    assert "fox-" in src
    hearts = page.locator("#morph-lives .morph-heart")
    assert hearts.count() == 3


def test_about_deeplink(page, base_url):
    goto_gb(page, base_url, "?screen=about")
    assert page.locator("#about-screen").is_visible()
    assert "Kalaallisut" in page.locator("#about-screen").inner_text()


def test_search_input_is_at_least_16px(page, base_url):
    """iOS Safari auto-zooms focused inputs under 16px -- keep the floor."""
    goto_gb(page, base_url, "?screen=oq")
    size = page.locator("#oq-filter").evaluate(
        "el => parseFloat(getComputedStyle(el).fontSize)"
    )
    assert size >= 16


def test_controller_hides_while_search_focused(page, base_url):
    goto_gb(page, base_url, "?screen=oq")
    pad = page.locator("#gb-controller")
    # launchOq focuses SEARCH on open -- pad should already be gone.
    assert pad.is_hidden()
    page.locator("#oq-filter").blur()
    page.wait_for_timeout(50)
    assert pad.is_visible()
    page.locator("#oq-filter").focus()
    page.wait_for_timeout(50)
    assert pad.is_hidden()


def test_select_cycles_menu(page, base_url):
    goto_gb(page, base_url)
    page.keyboard.press("Enter")
    page.wait_for_timeout(80)
    assert "is-selected" in page.locator("#menu-oq").get_attribute("class")
    page.keyboard.press("Tab")
    page.wait_for_timeout(40)
    assert "is-selected" in page.locator("#menu-decon").get_attribute("class")
    page.keyboard.press("Tab")
    page.wait_for_timeout(40)
    assert "is-selected" in page.locator("#menu-morph").get_attribute("class")
    page.keyboard.press("Tab")
    page.wait_for_timeout(40)
    assert "is-selected" in page.locator("#menu-about").get_attribute("class")


# --- Overflow guard -------------------------------------------------------
#
# The bug class this guards against: a real mobile browser's address-bar/
# toolbar chrome shrinks the *available* height below what any headless
# viewport test normally uses, and a fixed-px element (a sprite image, a
# vw-only font-size) doesn't shrink with it -- so a screen that looks fine
# at 844px silently clips content at, say, 560px. This bit three times now:
# MORPH!'s options/hint text, a fixed-px sprite image dropped in without
# switching to the em-based sizing the rest of the screen already uses, and
# then again on the very fix for that -- the first version of this guard
# checked #gb-lcd's own scrollHeight/clientHeight, but every .gb-screen is
# absolutely positioned with inset:0 (a fixed size, not shrink-to-fit) and
# clips its own overflow before it ever reaches #gb-lcd, so #gb-lcd never
# overflows regardless of how badly a screen's *content* does -- that
# version passed even against a real screenshot showing 1.5 of 3 MORPH!
# options. Checking each `.gb-screen`'s own scrollHeight against its own
# clientHeight is what actually catches it.
SHORT_VIEWPORT = {"width": 390, "height": 560}


def _assert_screen_fits(page, screen_id, label=None):
    box = page.locator(f"#{screen_id}").evaluate(
        "el => ({sh: el.scrollHeight, ch: el.clientHeight, sw: el.scrollWidth, cw: el.clientWidth})"
    )
    label = label or screen_id
    assert box["sh"] <= box["ch"] + 1, f"{label}: content overflows #{screen_id} vertically ({box})"
    assert box["sw"] <= box["cw"] + 1, f"{label}: content overflows #{screen_id} horizontally ({box})"


def test_no_overflow_at_short_viewport(browser, base_url):
    context = browser.new_context(viewport=SHORT_VIEWPORT)
    page = context.new_page()
    for screen in ["title", "menu", "oq", "decon", "about", "gameover"]:
        goto_gb(page, base_url, f"?screen={screen}")
        _assert_screen_fits(page, f"{screen}-screen")
    context.close()


def test_morph_worst_case_no_overflow(browser, base_url):
    """The illu- puzzle's first step (3 options + a 2-line status) is
    MORPH!'s worst case -- verified directly rather than assumed, since a
    size that only looks right on a lucky 2-option puzzle would silently
    clip on this one.

    MORPH! picks a random puzzle on each page load (shared/morph-game.js's
    own shuffled queue), and only ONE puzzle step in the whole set has 3
    options -- everything else has 2. A fixed small retry count here was
    tuned against a ~7-puzzle set; shared/morph-puzzles.js's own reuse pass
    grew that to ~19 (see its header comment) with no new 3-option steps,
    which silently turned this into a coin flip (a fixed 15 retries against
    1-in-19 odds fails close to half the time) -- exactly what made this
    test flake in CI rather than fail every run. Scaling the retry budget
    to the real, current puzzle count (read from the page itself, not
    hardcoded) keeps the failure probability negligible regardless of how
    many puzzles this file grows to next.
    """
    context = browser.new_context(viewport=SHORT_VIEWPORT)
    page = context.new_page()
    goto_gb(page, base_url, "?screen=morph")
    puzzle_count = page.evaluate("() => window.OqMorphPuzzles.puzzles.length")
    # Retries needed for a <0.1% chance of never rolling a specific 1-in-N
    # puzzle: N * ln(1000) rounds up comfortably (e.g. N=19 -> ~132), with a
    # floor so a small puzzle set doesn't undertest.
    max_retries = max(30, math.ceil(puzzle_count * math.log(1000)))
    for _ in range(max_retries):
        if page.locator(".morph-option").count() == 3:
            break
        page.reload()
        page.wait_for_timeout(300)
    assert page.locator(".morph-option").count() == 3, (
        f"couldn't roll the 3-option puzzle to test against in {max_retries} "
        f"tries (puzzle set has {puzzle_count} entries)"
    )
    _assert_screen_fits(page, "morph-screen", "morph (3-option worst case)")
    context.close()


def _sprite_to_font_ratio(browser, base_url, viewport):
    context = browser.new_context(viewport=viewport)
    page = context.new_page()
    goto_gb(page, base_url, "?screen=morph")
    data = page.evaluate(
        "() => ({sprite: document.getElementById('morph-sprite').getBoundingClientRect().height,"
        " font: parseFloat(getComputedStyle(document.getElementById('morph-screen')).fontSize)})"
    )
    context.close()
    return data["sprite"] / data["font"]


def test_morph_sprite_scales_with_font_size(browser, base_url):
    """Guards against a fixed-px sprite (e.g. `width: 96px`) that doesn't
    shrink along with #morph-screen's own responsive font-size the way an
    em-sized sprite does. #morph-screen's font-size is a cqh clamp
    (clamp(11px, 3.3cqh, 18px)) tied to #gb-lcd's rendered height, so a
    short and a tall viewport actually produce different font sizes -- an
    em-sized sprite keeps the same sprite-height/font-size ratio at both;
    a fixed-px sprite's ratio visibly drifts."""
    ratio_short = _sprite_to_font_ratio(browser, base_url, {"width": 390, "height": 500})
    ratio_tall = _sprite_to_font_ratio(browser, base_url, {"width": 390, "height": 844})
    assert ratio_short < 8, ratio_short
    assert abs(ratio_short - ratio_tall) / ratio_tall < 0.05, (ratio_short, ratio_tall)


def test_morph_cards_fit_when_shown(browser, base_url):
    """The win card and the Start-pause card are both absolutely positioned
    overlays with fixed em insets -- force each visible (independent of
    actually winning a round or pausing) and check neither overflows. The
    win card is filled with the longest real word/gloss pair in
    shared/morph-puzzles.js rather than left empty, since an empty card
    wouldn't exercise the wrapping that could actually push it past its
    fixed top/bottom insets."""
    context = browser.new_context(viewport=SHORT_VIEWPORT)
    page = context.new_page()
    goto_gb(page, base_url, "?screen=morph")
    page.evaluate(
        "() => { document.getElementById('morph-card-word').textContent = 'ILLOQARPOQ';"
        " document.getElementById('morph-card-meaning').textContent = 'he/she/it has a house'; }"
    )
    for card_id in ["morph-card", "morph-pause-card"]:
        page.evaluate(f"document.getElementById('{card_id}').hidden = false")
        _assert_screen_fits(page, "morph-screen", card_id)
        page.evaluate(f"document.getElementById('{card_id}').hidden = true")
    context.close()
