#!/usr/bin/env python3
"""Fail on CSS parse errors, including stray or missing braces.

The themes are intentionally static and do not have a bundler. tinycss2 gives
us a real CSS parser without imposing a formatter or framework-specific style
rules, while this script adds a useful repository-level invariant: every
stylesheet must parse cleanly before a browser gets to silently discard a
section of it.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import tinycss2
from tinycss2.ast import ParseError


def parse_errors(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    errors: list[str] = []

    stylesheet = tinycss2.parse_stylesheet(text, skip_whitespace=True, skip_comments=True)
    for token in stylesheet:
        if isinstance(token, ParseError):
            errors.append(f"line {token.source_line}, column {token.source_column}: {token.message}")

    # tinycss2 reports an unmatched closing brace as a parse error. An
    # unclosed block can otherwise be represented as a malformed component
    # value, so keep this explicit guard as a clear diagnostic and regression
    # check for the exact class of mistake this linter is meant to prevent.
    depth = 0
    quote: str | None = None
    escaped = False
    in_comment = False
    line = 1
    for index, char in enumerate(text):
        if char == "\n":
            line += 1
        if in_comment:
            if char == "*" and index + 1 < len(text) and text[index + 1] == "/":
                in_comment = False
            continue
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
            continue
        if char == "/" and index + 1 < len(text) and text[index + 1] == "*":
            in_comment = True
        elif char in "\"'":
            quote = char
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth < 0:
                errors.append(f"line {line}, column {index}: unexpected closing brace")
                depth = 0
    if in_comment:
        errors.append("unterminated comment")
    if quote:
        errors.append(f"unterminated {quote} string")
    if depth:
        errors.append(f"unclosed block: {depth} opening brace(s) without a matching close")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stylesheets", nargs="+", type=Path)
    args = parser.parse_args()
    failed = False
    for path in args.stylesheets:
        errors = parse_errors(path)
        if errors:
            failed = True
            for error in errors:
                print(f"FAIL {path}: {error}")
        else:
            print(f"OK   {path}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
