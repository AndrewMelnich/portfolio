#!/usr/bin/env bash
set -euo pipefail

# Creates the five triage labels on the GitLab project of the current remote.
# Names must match docs/agents/triage-labels.md. Safe to re-run.

if ! command -v glab >/dev/null 2>&1; then
  echo "glab is not installed. See https://gitlab.com/gitlab-org/cli" >&2
  exit 1
fi

if ! glab label list --output json >/dev/null 2>&1; then
  echo "glab cannot list labels. Check origin (GitLab) and run: glab auth login" >&2
  exit 1
fi

existing="$(glab label list --per-page 100 --output json --jq '.[].name')"

create() {
  local name="$1"
  local color="$2"
  local description="$3"

  if printf '%s\n' "$existing" | grep -Fxq "$name"; then
    echo "exists: $name"
    return
  fi

  glab label create --name "$name" --color "$color" --description "$description"
  echo "created: $name"
}

create "needs-triage" "#8c8c8c" "Maintainer needs to evaluate this issue"
create "needs-info" "#428BCA" "Waiting on reporter for more information"
create "ready-for-agent" "#1aaa55" "Fully specified, ready for an AFK agent"
create "ready-for-human" "#cc338b" "Requires human implementation"
create "wontfix" "#445261" "Will not be actioned"
