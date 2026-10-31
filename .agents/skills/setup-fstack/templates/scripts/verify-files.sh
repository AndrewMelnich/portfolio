#!/usr/bin/env bash
# Format + lint given files (relative to the app dir). One typecheck at the end.
# SKIP_TSC=1 — format/lint only. TSC_ONLY=1 — typecheck only.
# VERIFY_DIRECT_BIN=1 — call node_modules/.bin (skip pnpm exec).
# TYPECHECK="vue-tsc --noEmit" — typecheck command (default: tsc --noEmit).
# Tools missing from node_modules/.bin are skipped.
set -euo pipefail

cd "$(dirname "$0")/.."

skip_tsc=false
tsc_only=false
[ "${SKIP_TSC:-}" = "1" ] && skip_tsc=true
if [ "${TSC_ONLY:-}" = "1" ]; then
    tsc_only=true
    skip_tsc=false
fi

has_tool() { [ -x "node_modules/.bin/$1" ]; }

run_tool() {
    local tool="$1"
    shift
    if [ "${VERIFY_DIRECT_BIN:-}" = "1" ] && has_tool "$tool"; then
        "./node_modules/.bin/$tool" "$@"
    else
        pnpm exec "$tool" "$@"
    fi
}

has_js=false
prettier_files=()
js_files=()
css_files=()

for f in "$@"; do
    [ -f "$f" ] || continue
    case "$f" in
        *.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs | *.mts | *.cts)
            has_js=true
            prettier_files+=("$f")
            js_files+=("$f")
            ;;
        *.astro | *.vue | *.svelte)
            has_js=true
            prettier_files+=("$f")
            js_files+=("$f")
            css_files+=("$f")
            ;;
        *.scss | *.css | *.sass | *.less)
            prettier_files+=("$f")
            css_files+=("$f")
            ;;
        *.json | *.md | *.html)
            prettier_files+=("$f")
            ;;
    esac
done

if [ ${#prettier_files[@]} -eq 0 ]; then
    echo "verify-files: no lintable files" >&2
    exit 0
fi

if ! $tsc_only; then
    if has_tool prettier; then
        run_tool prettier --write --ignore-unknown "${prettier_files[@]}"
    fi

    pids=()
    if [ ${#js_files[@]} -gt 0 ] && has_tool eslint; then
        run_tool eslint --cache --cache-location .eslintcache --fix "${js_files[@]}" &
        pids+=("$!")
    fi
    if [ ${#css_files[@]} -gt 0 ] && has_tool stylelint; then
        run_tool stylelint --cache --cache-location .stylelintcache --fix --allow-empty-input "${css_files[@]}" &
        pids+=("$!")
    fi
    for pid in "${pids[@]+"${pids[@]}"}"; do
        wait "$pid"
    done
fi

if ! $skip_tsc && $has_js; then
    if [ -n "${TYPECHECK:-}" ]; then
        sh -c "$TYPECHECK"
    elif has_tool tsc; then
        run_tool tsc --noEmit
    fi
fi
