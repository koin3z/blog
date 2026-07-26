#!/usr/bin/env python3
"""Regression tests for check_learning_note.py."""

from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("check_learning_note.py")
SPEC = importlib.util.spec_from_file_location("check_learning_note", SCRIPT_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"cannot load {SCRIPT_PATH}")
CHECKER = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = CHECKER
SPEC.loader.exec_module(CHECKER)


VALID_NOTE = """\
---
title: Test Note
date: 2026-07-24
modified: 2026-07-24
draft: true
tags: []
aliases: []
description: A test learning note.
---

## Overview

```shell
echo test
```
"""


class LearningNoteCheckerTest(unittest.TestCase):
    def validate(self, content: str, publication_filter: str = "remove-drafts") -> list[str]:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "note.md"
            path.write_text(content, encoding="utf-8")
            return [
                diagnostic.message
                for diagnostic in CHECKER.validate(path, publication_filter)
            ]

    def test_accepts_valid_remove_drafts_note(self) -> None:
        self.assertEqual(self.validate(VALID_NOTE), [])

    def test_accepts_unpublished_explicit_publish_note(self) -> None:
        note = VALID_NOTE.replace("draft: true", "publish: false")
        self.assertEqual(self.validate(note, "explicit-publish"), [])

    def test_rejects_published_or_conflicting_initial_state(self) -> None:
        note = VALID_NOTE.replace("draft: true", "draft: true\npublish: true")
        messages = self.validate(note)
        self.assertIn("`draft: true` conflicts with `publish: true`", messages)

        explicit_note = VALID_NOTE.replace("draft: true", "publish: true")
        explicit_messages = self.validate(explicit_note, "explicit-publish")
        self.assertIn(
            "an initial note under ExplicitPublish must not set `publish: true`",
            explicit_messages,
        )

    def test_rejects_body_h1_and_language_less_fence(self) -> None:
        note = VALID_NOTE.replace(
            "## Overview\n\n```shell\necho test\n```",
            "# Duplicate title\n\n```\necho test\n```",
        )
        messages = self.validate(note)
        self.assertIn(
            "body-level H1 is not allowed; use frontmatter `title`",
            messages,
        )
        self.assertIn("fenced code block must declare a language", messages)

    def test_rejects_missing_key_and_frontmatter_order(self) -> None:
        note = VALID_NOTE.replace(
            "date: 2026-07-24\nmodified: 2026-07-24",
            "modified: 2026-07-24",
        ).replace("tags: []\naliases: []", "aliases: []\ntags: []")
        messages = self.validate(note)
        self.assertIn("missing required frontmatter key `date`", messages)
        self.assertIn("`aliases` must appear after `tags` in frontmatter", messages)


if __name__ == "__main__":
    unittest.main()
