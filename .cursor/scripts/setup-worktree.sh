#!/usr/bin/env bash
set -euo pipefail

copy_frontend_env() {
    local root="${ROOT_WORKTREE_PATH:-}"

    if [[ -z "$root" || ! -d "$root/frontend" ]]; then
        echo "ERROR: ROOT_WORKTREE_PATH must point at the main repo (got: ${root:-unset})" >&2
        exit 1
    fi

    mkdir -p frontend

    local src="$root/frontend"
    local copied=0
    local f base

    shopt -s nullglob
    for f in "$src"/.env "$src"/.env.*; do
        base="$(basename "$f")"
        [[ "$base" == ".env.example" ]] && continue
        cp "$f" "frontend/$base"
        echo "copied frontend/$base"
        copied=1
    done
    shopt -u nullglob

    if [[ "$copied" -eq 0 ]]; then
        echo "WARN: no frontend/.env* in $src (skipped copy)" >&2
    fi
}

copy_frontend_env

run_in_frontend() {
    (
        cd frontend

        NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
        if [[ -s "$NVM_DIR/nvm.sh" && -f .nvmrc ]]; then
            # shellcheck source=/dev/null
            . "$NVM_DIR/nvm.sh"
            nvm use
        fi

        if command -v corepack >/dev/null 2>&1; then
            corepack enable >/dev/null 2>&1 || true
        fi

        "$@"
    )
}

run_in_frontend pnpm install
run_in_frontend pnpm astro sync

bash "$(dirname "${BASH_SOURCE[0]}")/check-hook-binaries.sh" frontend

echo "worktree setup ok (env, hook and pnpm pc binaries, astro types)"
