#!/usr/bin/env bash
# Format + lint git-changed files in the app dir, then related unit tests and
# the architecture linter. Usage: bash scripts/verify-changed.sh [--tsc-only]
set -euo pipefail

tsc_only=false
if [ "${1:-}" = "--tsc-only" ]; then
    tsc_only=true
    shift
fi

APP="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(git -C "$APP" rev-parse --show-toplevel)"
PREFIX="$(git -C "$APP" rev-parse --show-prefix)"
PREFIX="${PREFIX%/}"

files=()
while IFS= read -r line; do
    case "$line" in
        "" | */pnpm-lock.yaml | pnpm-lock.yaml | */package-lock.json | package-lock.json | */yarn.lock | yarn.lock) continue ;;
    esac
    files+=("$line")
done < <(
    {
        git -C "$ROOT" diff --name-only --diff-filter=ACMRTUXB HEAD -- "${PREFIX:-.}"
        git -C "$ROOT" diff --name-only --cached --diff-filter=ACMRTUXB -- "${PREFIX:-.}"
        git -C "$ROOT" ls-files --others --exclude-standard -- "${PREFIX:-.}"
    } | sed "s|^${PREFIX:+$PREFIX/}||" | sort -u
)

if [ ${#files[@]} -eq 0 ]; then
    echo "verify-changed: no changed files"
    exit 0
fi

echo "verify-changed: ${#files[@]} file(s)"
cd "$APP"
if $tsc_only; then
    export TSC_ONLY=1
    exec bash ./scripts/verify-files.sh "${files[@]}"
fi
bash ./scripts/verify-files.sh "${files[@]}"

modules=()
touches_src=false
for f in "${files[@]}"; do
    [ -f "$f" ] || continue
    case "$f" in
        src/*) touches_src=true ;;
    esac
    case "$f" in
        *.ts | *.tsx | *.js | *.jsx | *.mjs | *.astro | *.vue | *.svelte) modules+=("$f") ;;
    esac
done

if [ ${#modules[@]} -gt 0 ] && [ -x node_modules/.bin/vitest ]; then
    pnpm exec vitest related --run --passWithNoTests "${modules[@]}"
fi
if $touches_src && [ -x node_modules/.bin/steiger ]; then
    pnpm exec steiger ./src
fi
