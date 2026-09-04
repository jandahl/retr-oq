"""Start → Run across win98 / xp / win7.

Guards the bugs that shipped in #143–#145: the dialog must exist (not a
browser prompt), `backrooms` must start the screensaver overlay, and
`winver` / `WINVER.EXE` must open the About window.
"""

import pytest

THEMES = ("win98", "xp", "win7")


def dismiss_boot(page):
    boot = page.query_selector("#boot-screen")
    if boot and boot.is_visible():
        page.click("#boot-screen")
        page.wait_for_timeout(50)


def goto_theme(page, base_url, theme):
    page.goto(f"{base_url}/{theme}/index.html")
    dismiss_boot(page)
    # The Run item lives inside #start-menu, which starts hidden -- wait for
    # attached, not visible.
    page.wait_for_selector("#start-menu-run", state="attached", timeout=8000)


def open_run(page):
    page.click("#start-button")
    page.wait_for_selector("#start-menu-run", state="visible", timeout=3000)
    page.click("#start-menu-run")
    page.wait_for_selector("#run-overlay:not([hidden])", timeout=3000)
    page.wait_for_selector("#run-input")


def submit_run(page, command):
    page.fill("#run-input", command)
    page.click("#run-ok")
    page.wait_for_timeout(200)


@pytest.mark.parametrize("theme", THEMES)
def test_run_item_opens_dialog(page, base_url, theme):
    goto_theme(page, base_url, theme)
    open_run(page)
    assert page.get_attribute("#run-overlay", "hidden") is None
    assert page.is_visible("#run-input")


@pytest.mark.parametrize("theme", THEMES)
def test_backrooms_starts_screensaver(page, base_url, theme):
    goto_theme(page, base_url, theme)
    open_run(page)
    submit_run(page, "backrooms")
    overlay = page.query_selector("#oq-ss-overlay")
    assert overlay is not None, "screensaver overlay missing after backrooms"
    assert page.get_attribute("#oq-ss-overlay", "hidden") is None
    src = page.eval_on_selector("#oq-ss-overlay iframe", "el => el.getAttribute('src') or ''")
    assert "maze-backrooms" in src
    assert page.get_attribute("#run-overlay", "hidden") is not None


@pytest.mark.parametrize("theme", THEMES)
def test_winver_case_insensitive(page, base_url, theme):
    goto_theme(page, base_url, theme)
    open_run(page)
    submit_run(page, "WINVER.EXE")
    assert page.get_attribute("#winver-overlay", "hidden") is None
    body = page.text_content("#winver-overlay")
    assert "oq-api" in body.lower() or "Oq!" in body


@pytest.mark.parametrize("theme", THEMES)
def test_unknown_command_stays_in_dialog(page, base_url, theme):
    goto_theme(page, base_url, theme)
    open_run(page)
    submit_run(page, "not-a-real-program")
    assert page.get_attribute("#run-overlay", "hidden") is None
    err = page.text_content("#run-error")
    assert "cannot find" in err.lower()
    assert "not-a-real-program" in err
