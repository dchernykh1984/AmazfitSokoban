#!/usr/bin/env python3
"""Adapt existing git guards and warnings to Codex shell-hook events."""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def run(action: str, payload: dict, root: Path) -> int:
    names = {"guard": "guard-git.mjs", "warn": "warn-clobbered-gitignore.mjs"}
    if action not in names:
        return 0
    tool_input = payload.get("tool_input")
    if not isinstance(tool_input, dict):
        return 0
    command = tool_input.get("command")
    if not isinstance(command, str):
        return 0
    try:
        result = subprocess.run(
            ["node", str(root / ".claude/hooks" / names[action])],
            input=json.dumps({"tool_input": {"command": command}}),
            text=True, capture_output=True, cwd=root, check=False,
        )
    except OSError:
        return 0
    if result.returncode:
        print(result.stderr, file=sys.stderr)
        return result.returncode
    if action == "warn" and result.stdout.strip():
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PostToolUse", "additionalContext": result.stdout.strip()
        }}))
    return 0


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except ValueError:
        return 0
    if not isinstance(payload, dict) or len(sys.argv) != 2:
        return 0
    return run(sys.argv[1], payload, ROOT)


if __name__ == "__main__":
    sys.exit(main())
