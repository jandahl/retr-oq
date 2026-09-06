"""Smoke tests for the OS/2 Workplace Shell host and guest sessions."""


def open_theme(page, base_url):
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(f"{base_url}/os2/index.html")
    page.wait_for_timeout(150)
    return errors


def test_os2_desktop_and_system_folder_load(page, base_url):
    assert open_theme(page, base_url) == []
    assert page.locator("#desktop").is_visible()
    assert page.locator("#system-window").is_visible()
    assert page.locator(".launchpad").is_visible()


def test_os2_opens_win_os2_and_dos_guests(page, base_url):
    assert open_theme(page, base_url) == []
    page.locator("[data-open='win-os2-window']").first.click()
    page.locator("[data-open='dos-window']").first.click()
    assert page.locator("#win-os2-window").is_visible()
    assert page.locator("#dos-window").is_visible()
    assert page.locator("#win-os2-window iframe").get_attribute("src") == "../win31/index.html"
    assert page.locator("#dos-window iframe").get_attribute("src") == "../dos/index.html"
