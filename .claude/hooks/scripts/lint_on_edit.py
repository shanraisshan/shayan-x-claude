#!/usr/bin/env python3
"""PostToolUse lint hook: runs ESLint on frontend edits and ruff on backend edits.

Reads Claude Code hook JSON from stdin, extracts tool_input.file_path, and routes
to the appropriate linter based on path + extension. Exits 0 on pass; a non-zero
exit surfaces the linter output to the calling agent so it can self-heal.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


def main() -> int:
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError:
        return 0

    tool_input = payload.get("tool_input") or {}
    raw_path = tool_input.get("file_path")
    if not raw_path:
        return 0

    project_dir = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    path = Path(raw_path)
    if not path.is_absolute():
        path = Path(project_dir) / path

    try:
        rel = path.relative_to(project_dir)
    except ValueError:
        return 0

    parts = rel.parts
    if not parts:
        return 0

    top = parts[0]
    suffix = path.suffix.lower()

    if top == "frontend" and suffix in {".ts", ".tsx", ".js", ".jsx"}:
        cmd = ["npx", "--no-install", "eslint", str(path)]
        cwd = str(Path(project_dir) / "frontend")
    elif top == "backend" and suffix == ".py":
        cmd = ["uv", "run", "ruff", "check", str(path)]
        cwd = str(Path(project_dir) / "backend")
    else:
        return 0

    try:
        result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=18)
    except FileNotFoundError as exc:
        print(f"lint_on_edit: {exc}", file=sys.stderr)
        return 0
    except subprocess.TimeoutExpired:
        print("lint_on_edit: linter timed out", file=sys.stderr)
        return 0

    if result.returncode != 0:
        if result.stdout:
            print(result.stdout, end="")
        if result.stderr:
            print(result.stderr, end="", file=sys.stderr)
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
