#!/usr/bin/env bash
set -euo pipefail

FE="${1:-frontend}"
BINARIES=(lint-staged oxfmt fallow steiger eslint stylelint tsc concurrently)

missing=()
for bin in "${BINARIES[@]}"; do
    if [[ ! -x "$FE/node_modules/.bin/$bin" ]]; then
        missing+=("$bin")
        echo "ERROR: missing $FE/node_modules/.bin/$bin" >&2
    fi
done

if [[ "${#missing[@]}" -ne 0 ]]; then
    echo "Missing: ${missing[*]}. Fix: ROOT_WORKTREE_PATH=<main repo> bash .cursor/scripts/setup-worktree.sh (or cd $FE && pnpm install)." >&2
    exit 1
fi
