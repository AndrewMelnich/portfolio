#!/bin/bash

PROCESS_NAME="${1:?process name required}"
SCRIPT_NAME="${2:-start}"

cd "$(dirname "$0")"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
. "$NVM_DIR/nvm.sh"

nvm use

NODE_BIN="$(command -v node)"
NODE_BIN_DIR="$(dirname "$NODE_BIN")"
PNPM_BIN="$(command -v pnpm)"

# PM2 daemon often keeps a stale PATH (e.g. nvm default 20.x). Child `node` /
# `pnpm start` → sh -c must resolve the .nvmrc binary, not the daemon's.
export PATH="${NODE_BIN_DIR}:${PATH}"
export NVM_BIN="${NODE_BIN_DIR}"
export NVM_INC="$(dirname "${NODE_BIN_DIR}")/include/node"

PM2_BIN="$(command -v pm2 || true)"
if [ -z "$PM2_BIN" ]; then
    PM2_BIN="$(ls "$NVM_DIR"/versions/node/*/bin/pm2 2>/dev/null | head -n 1)"
fi
if [ -z "$PM2_BIN" ] || [ ! -x "$PM2_BIN" ]; then
    echo "pm2 not found" >&2
    exit 1
fi

export NODE_ENV=production
export DOTENV_CONFIG_QUIET=true

# Static (SSR_ENABLED=false): нет build/server/entry.mjs — PM2 не нужен, чистим старый процесс
if [ ! -f build/server/entry.mjs ]; then
    if "$PM2_BIN" describe "$PROCESS_NAME" &>/dev/null; then
        "$PM2_BIN" delete "$PROCESS_NAME"
        "$PM2_BIN" save
        echo "No SSR entry — deleted \"$PROCESS_NAME\" (static build)."
    else
        echo "No SSR entry — skip PM2 (static build)."
    fi
    exit 0
fi

if "$PM2_BIN" describe "$PROCESS_NAME" &>/dev/null; then
    "$PM2_BIN" delete "$PROCESS_NAME"
fi

if [ "$SCRIPT_NAME" = "start" ]; then
    # Direct entry + absolute interpreter: do not rely on PATH `node` via pnpm/sh.
    "$PM2_BIN" start build/server/entry.mjs \
        --name "$PROCESS_NAME" \
        --cwd "$(pwd)" \
        --interpreter "$NODE_BIN" \
        --node-args="-r dotenv/config" \
        --update-env
else
    "$PM2_BIN" start "$PNPM_BIN" \
        --name "$PROCESS_NAME" \
        --cwd "$(pwd)" \
        --interpreter "$NODE_BIN" \
        --update-env \
        -- "$SCRIPT_NAME"
fi

echo "Started \"$PROCESS_NAME\" (node $($NODE_BIN -v) ${SCRIPT_NAME})."
"$PM2_BIN" save
