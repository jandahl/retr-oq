"""c64/ regression suite.

Guards the BASIC directory listing layout: one screen line per DIR entry
(no double CR/LF blank rows) and shared left column for block counts across
clickable .c64-link rows, dim non-launchable rows, and the header `0`.
"""


def goto_c64(page, base_url):
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    # Wide enough for the 40-column screen (16px C64 Pro Mono ≈ 16px/ch)
    # plus border/padding — avoids mistaking horizontal clip for layout bugs.
    page.set_viewport_size({"width": 900, "height": 800})
    page.goto(f"{base_url}/c64/index.html")
    page.wait_for_timeout(200)
    return errors


def _dir_entry_metrics(page):
    """Return header digit x plus per-entry {text, digitX, y, height, tag}."""
    return page.evaluate(
        """() => {
          const out = document.getElementById('c64-output');
          let headerDigitX = null;
          const walk = document.createTreeWalker(out, NodeFilter.SHOW_TEXT);
          const range = document.createRange();
          while (walk.nextNode()) {
            const t = walk.currentNode;
            const idx = t.textContent.indexOf('0 "OQ');
            if (idx >= 0) {
              range.setStart(t, idx);
              range.setEnd(t, idx + 1);
              headerDigitX = range.getBoundingClientRect().x;
              break;
            }
          }
          const nodes = [...out.querySelectorAll('.c64-link, .c64-dim')];
          const entries = nodes.map((el) => {
            const tn = el.childNodes[0];
            range.setStart(tn, 0);
            range.setEnd(tn, 1);
            const digit = range.getBoundingClientRect();
            const r = el.getBoundingClientRect();
            return {
              text: el.textContent,
              digitX: digit.x,
              y: r.y,
              height: r.height,
              tag: el.tagName.toLowerCase(),
            };
          });
          return { headerDigitX, entries };
        }"""
    )


def test_dir_listing_one_line_per_entry_and_aligned_blocks(page, base_url):
    assert goto_c64(page, base_url) == []
    data = _dir_entry_metrics(page)
    entries = data["entries"]
    assert len(entries) == 7
    assert entries[0]["text"].startswith('1   "DICT"')
    assert entries[0]["text"].rstrip().endswith("PRG")
    assert "PRG" in entries[0]["text"]
    assert entries[4]["text"].startswith('1   "DICT DAT"')
    assert entries[4]["tag"] == "span"
    assert entries[5]["tag"] == "span"
    assert all(e["tag"] == "button" for e in entries if e["tag"] != "span")

    # Block-count digit shares one vertical column (header 0, links, dim).
    xs = [data["headerDigitX"]] + [e["digitX"] for e in entries]
    assert max(xs) - min(xs) < 1.5, f"block columns drift: {xs}"

    # Exactly one line box between consecutive entries (no blank row).
    heights = [e["height"] for e in entries]
    median_h = sorted(heights)[len(heights) // 2]
    for a, b in zip(entries, entries[1:]):
        gap = b["y"] - a["y"]
        assert gap < median_h * 1.6, (
            f"double-spaced DIR rows: gap={gap:.2f} vs line={median_h:.2f} "
            f"between {a['text']!r} and {b['text']!r}"
        )
        assert gap > median_h * 0.6, f"rows overlap/collapse: gap={gap:.2f}"


def test_dir_links_still_launchable(page, base_url):
    assert goto_c64(page, base_url) == []
    for name in ("DICT", "DECON", "MORPH", "KALQ"):
        assert page.locator(f'.c64-link[data-load="{name}"]').count() == 1
    assert page.locator('.c64-link[data-action="quit"]').count() == 1
    assert page.locator(".c64-dim").count() == 2
    assert page.locator(".c64-dim.c64-link").count() == 0
