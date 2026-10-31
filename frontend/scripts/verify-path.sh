#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

TARGET="${1:?Usage: pnpm verify:path <file-or-directory>}"

if [ -f "$TARGET" ]; then
    FILES=("$TARGET")
elif [ -d "$TARGET" ]; then
    FILES=()
    while IFS= read -r line; do
        FILES+=("$line")
    done < <(find "$TARGET" -type f)
else
    echo "verify-path: not found: $TARGET" >&2
    exit 1
fi

exec bash ./scripts/verify-files.sh "${FILES[@]}"
