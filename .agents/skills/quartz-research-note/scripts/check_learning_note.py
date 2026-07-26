#!/usr/bin/env python3
"""Validate structural invariants for an initial Quartz learning note."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path


FRONTMATTER_KEY = re.compile(r"^([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$")
FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})(.*)$")
BODY_H1 = re.compile(r"^ {0,3}#(?!#)(?:\s+|$)")
DATE_VALUE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
BASE_ORDER = ("title", "date", "modified", "draft", "publish", "tags", "aliases", "description")
BASE_REQUIRED = ("title", "date", "modified", "tags", "aliases", "description")


@dataclass(frozen=True)
class Diagnostic:
    line: int
    message: str


def scalar(value: str | None) -> str:
    if value is None:
        return ""
    result = value.strip()
    if len(result) >= 2 and result[0] == result[-1] and result[0] in {'"', "'"}:
        return result[1:-1].strip()
    return result


def boolean(value: str | None) -> bool | None:
    normalized = scalar(value).lower()
    if normalized == "true":
        return True
    if normalized == "false":
        return False
    return None


def parse_frontmatter(lines: list[str]) -> tuple[int | None, dict[str, tuple[str, int]], list[Diagnostic]]:
    diagnostics: list[Diagnostic] = []
    values: dict[str, tuple[str, int]] = {}

    if not lines or lines[0].strip() != "---":
        return None, values, [Diagnostic(1, "frontmatter must begin with `---` on the first line")]

    end = next((index for index in range(1, len(lines)) if lines[index].strip() == "---"), None)
    if end is None:
        return None, values, [Diagnostic(1, "frontmatter is not closed with `---`")]

    for index, line in enumerate(lines[1:end], start=2):
        if not line or line[0].isspace() or line.lstrip().startswith("#"):
            continue
        match = FRONTMATTER_KEY.match(line)
        if not match:
            diagnostics.append(Diagnostic(index, "invalid top-level frontmatter entry"))
            continue
        key, value = match.groups()
        if key in values:
            diagnostics.append(Diagnostic(index, f"duplicate frontmatter key `{key}`"))
            continue
        values[key] = (value or "", index)

    return end, values, diagnostics


def check_frontmatter(
    values: dict[str, tuple[str, int]], publication_filter: str
) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []

    for key in BASE_REQUIRED:
        if key not in values:
            diagnostics.append(Diagnostic(1, f"missing required frontmatter key `{key}`"))

    for key in ("title", "description"):
        if key in values and not scalar(values[key][0]):
            diagnostics.append(Diagnostic(values[key][1], f"`{key}` must not be empty"))

    for key in ("date", "modified"):
        if key in values and not DATE_VALUE.fullmatch(scalar(values[key][0])):
            diagnostics.append(
                Diagnostic(values[key][1], f"`{key}` must use the YYYY-MM-DD format")
            )

    positions = [(key, values[key][1]) for key in BASE_ORDER if key in values]
    for previous, current in zip(positions, positions[1:]):
        if previous[1] > current[1]:
            diagnostics.append(
                Diagnostic(
                    current[1],
                    f"`{current[0]}` must appear after `{previous[0]}` in frontmatter",
                )
            )

    draft = boolean(values.get("draft", ("", 1))[0]) if "draft" in values else None
    publish = boolean(values.get("publish", ("", 1))[0]) if "publish" in values else None

    for key in ("draft", "publish"):
        if key in values and boolean(values[key][0]) is None:
            diagnostics.append(Diagnostic(values[key][1], f"`{key}` must be `true` or `false`"))

    if draft is True and publish is True:
        diagnostics.append(
            Diagnostic(values["publish"][1], "`draft: true` conflicts with `publish: true`")
        )

    if publication_filter == "remove-drafts":
        if draft is not True:
            line = values.get("draft", ("", 1))[1]
            diagnostics.append(
                Diagnostic(line, "an initial note under RemoveDrafts must set `draft: true`")
            )
    elif publication_filter == "explicit-publish" and publish is True:
        diagnostics.append(
            Diagnostic(
                values["publish"][1],
                "an initial note under ExplicitPublish must not set `publish: true`",
            )
        )

    return diagnostics


def check_body(lines: list[str], body_start: int) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    fence_char: str | None = None
    fence_length = 0
    fence_line = 0

    for index in range(body_start, len(lines)):
        line = lines[index]
        line_number = index + 1

        if fence_char is not None:
            closing = re.fullmatch(
                rf" {{0,3}}{re.escape(fence_char)}{{{fence_length},}}\s*", line
            )
            if closing:
                fence_char = None
                fence_length = 0
                fence_line = 0
            continue

        match = FENCE.match(line)
        if match:
            marker, info = match.groups()
            if not info.strip():
                diagnostics.append(
                    Diagnostic(line_number, "fenced code block must declare a language")
                )
            fence_char = marker[0]
            fence_length = len(marker)
            fence_line = line_number
            continue

        if BODY_H1.match(line):
            diagnostics.append(
                Diagnostic(line_number, "body-level H1 is not allowed; use frontmatter `title`")
            )

    if fence_char is not None:
        diagnostics.append(Diagnostic(fence_line, "fenced code block is not closed"))

    return diagnostics


def validate(path: Path, publication_filter: str) -> list[Diagnostic]:
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as error:
        return [Diagnostic(1, f"cannot read UTF-8 file: {error}")]

    if text.startswith("\ufeff"):
        return [Diagnostic(1, "remove the UTF-8 byte-order mark before frontmatter")]

    lines = text.splitlines()
    frontmatter_end, values, diagnostics = parse_frontmatter(lines)
    if frontmatter_end is None:
        return diagnostics

    diagnostics.extend(check_frontmatter(values, publication_filter))
    diagnostics.extend(check_body(lines, frontmatter_end + 1))
    return sorted(diagnostics, key=lambda item: (item.line, item.message))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check initial Quartz learning notes without external dependencies."
    )
    parser.add_argument(
        "--publication-filter",
        choices=("remove-drafts", "explicit-publish", "none"),
        default="none",
        help="Active Quartz publication filter (default: none).",
    )
    parser.add_argument("paths", nargs="+", type=Path, help="Markdown note paths to check.")
    args = parser.parse_args()

    failed = False
    for path in args.paths:
        diagnostics = validate(path, args.publication_filter)
        if diagnostics:
            failed = True
            for diagnostic in diagnostics:
                print(f"{path}:{diagnostic.line}: {diagnostic.message}", file=sys.stderr)
        else:
            print(f"OK {path}")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
