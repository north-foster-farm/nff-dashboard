#!/usr/bin/env bash
#
# Pre-commit guard: the app version is stored in two files that must
# stay in lockstep —
#   * package.json            -> .version
#   * src/data/nff-data.json  -> .meta.version   (rendered by TopBar)
#
# They have drifted before: TopBar sat at v0.10.1-alpha while
# package.json had run ahead to v0.10.9-alpha (corrected in 8d0d48c).
# This guard blocks any `git commit` while the two strings disagree.
#
# Wired in as a Claude Code PreToolUse(Bash) hook via
# .claude/settings.json. The tool payload arrives as JSON on stdin; we
# act only on `git commit` commands and pass everything else through.
# Exit 2 blocks the tool call and feeds stderr back to the model.
set -uo pipefail

payload="$(cat)"
cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // ""')"

# Only police actual commits; let every other Bash command through.
case "$cmd" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

root="$(git rev-parse --show-toplevel)"
pkg="$(jq -r '.version' "$root/package.json")"
ui="$(jq -r '.meta.version' "$root/src/data/nff-data.json")"

if [ "$pkg" != "$ui" ]; then
  {
    echo "✗ Version drift — sync these before committing:"
    echo "    package.json            $pkg"
    echo "    src/data/nff-data.json  $ui   (TopBar renders this)"
    echo "  Set both to the same vX.Y.Z-alpha string, then re-commit."
  } >&2
  exit 2
fi

exit 0
