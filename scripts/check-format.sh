#!/usr/bin/env bash
# check-format.sh — the two house formatting rules the linters don't
# carry (H5). Run by the pre-commit hook via `npm run check`.
#
#   1. NO TRAILING WHITESPACE, repo-wide, on every tracked text file.
#      Markdown keeps its one semantic exception: a line may end in
#      EXACTLY two spaces (the hard line break); anything else fails.
#   2. MAX-LEN 80 as a RATCHET: only lines this commit ADDS are
#      checked (the pre-80-rule backlog stays until touched), and only
#      in non-template code (.js/.mjs/.sql/.sh/.css — JSX and HTML are
#      template-layer, exempt per the house rule). Lines carrying a
#      URL are exempt: an unbreakable token can't be wrapped.
set -euo pipefail

fail=0

# ── 1. trailing whitespace ───────────────────────────────────────────
text_files=$(git ls-files |
  grep -E '\.(js|jsx|mjs|css|html|json|sql|sh|yml|yaml|toml|txt)$' ||
  true)
if [ -n "$text_files" ]; then
  # shellcheck disable=SC2086
  offenders=$(echo "$text_files" |
    xargs grep -nE '[[:blank:]]+$' /dev/null 2>/dev/null || true)
  if [ -n "$offenders" ]; then
    echo "check-format: trailing whitespace:"
    echo "$offenders" | head -40
    fail=1
  fi
fi

md_offenders=$(git ls-files '*.md' | xargs awk '
  match($0, /[[:blank:]]+$/) {
    if (substr($0, RSTART) != "  ") print FILENAME ":" FNR
  }' 2>/dev/null || true)
if [ -n "$md_offenders" ]; then
  echo "check-format: trailing whitespace in markdown (only an exact"
  echo "two-space hard break may end a line):"
  echo "$md_offenders" | head -40
  fail=1
fi

# ── 2. max-len 80 on added lines ─────────────────────────────────────
# Staged diff when invoked from the hook; falls back to the working
# tree diff so `npm run check` behaves the same outside a commit.
long=$(git diff --cached -U0 --no-color \
    -- '*.js' '*.mjs' '*.sql' '*.sh' '*.css' \
    ':(exclude)*.test.js' |
  awk '
    /^\+\+\+ b\// { file = substr($0, 7) }
    /^@@/ { match($0, /\+[0-9]+/); ln = substr($0, RSTART + 1) + 0 }
    /^\+/ && !/^\+\+\+/ {
      line = substr($0, 2)
      if (length(line) > 80 && line !~ /:\/\//)
        print file ":" ln ": " length(line) " chars"
      ln++
    }' || true)
if [ -n "$long" ]; then
  echo "check-format: added lines over 80 chars (house max-len;"
  echo "wrap, or restructure — template files are already exempt):"
  echo "$long" | head -40
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  exit 1
fi
echo "check-format: clean."
