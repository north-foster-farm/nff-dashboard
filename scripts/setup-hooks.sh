#!/bin/sh
# One-time, per-clone: point git at the repo-tracked hooks so the
# pre-commit test-suite gate applies to every commit, by anyone.
cd "$(dirname "$0")/.." || exit 1
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks
echo "core.hooksPath -> .githooks (pre-commit runs the unit suite)"
