---
name: deslop
description: >
  Remove AI-generated code slop from a branch or diff before commit
  (/deslop). Use when cleaning a padded diff, unsupported guards, narrating
  comments, dead compatibility paths, or unrelated edits.
metadata:
  vendored: "true"
  credits:
    source: cursor-team-kit
    url: "https://github.com/cursor/plugins/tree/main/cursor-team-kit/skills/deslop"
---

# Deslop

Project overrides: read `.cursor/fstack/project.md` and `.cursor/fstack/deslop.md` from the repo root when present; they win over this file.

Clean AI-generated slop from code. Prose is `unslop`. Comment policy and sweeps are `no-comments`. This skill is the pre-commit pass on the diff.

**Done when:** the scoped diff has no Focus Areas left, behavior is unchanged (unless a clear bug was fixed), and the reply is 1–3 sentences naming what was removed.

## Focus Areas

- Extra comments that are unnecessary or inconsistent with local style (prefer `no-comments` for a full comment sweep)
- Defensive checks or try/catch blocks that are abnormal for trusted code paths
- Casts to `any` used only to bypass type issues
- Deeply nested code that should be simplified with early returns
- Dead compatibility paths and unused branches left "just in case"
- Unrelated edits that do not serve the change
- Staged `*.figma.yml` / `*.figma.check.yml` / `*.figma.mcp.yml` / `*.css-tree.yml` (local snapshot only; gitignore)
- Other patterns inconsistent with the file and surrounding codebase

## Guardrails

- Keep behavior unchanged unless fixing a clear bug.
- Prefer minimal, focused edits over broad rewrites.
- Keep the final summary concise (1–3 sentences).

## Steps

1. **Scope.** Use the caller's files or diff. Else the current diff against the base branch (default `main`), including the working tree.
2. **Scan.** Walk every hunk for Focus Areas. Prefer deleting or simplifying over rewriting.
3. **Edit.** Apply the smallest change that removes each hit. Do not expand scope to adjacent cleanup.
4. **Reply.** Name what was removed in 1–3 sentences. No file-by-file essay.
