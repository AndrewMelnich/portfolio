---
name: figma-diff
description: >-
  Deterministic Figma file diff since a date. Use when the user asks что
  изменилось в макете, what changed in Figma since DATE, or to implement only
  mockup changes since a date — run this before figma-design-to-code.
---

# Figma diff

Diff the project Figma file at `--since` (end of that day) against now. Stdout is byte-identical for the same inputs. Implement **only** nodes in the report.

## When

User names a past date for the mockup (`с 28 сентября`, `since 2026-09-28`, «что изменилось в макете»). Run this **before** [figma-design-to-code](../figma-design-to-code/SKILL.md).

**Done when** the command exits 0 and this reply quotes the report path or the markdown it printed.

## Run

From `frontend/`:

```bash
pnpm figma:diff -- --since YYYY-MM-DD https://www.figma.com/design/FILE/Name?node-id=1-2
pnpm figma:diff -- --since YYYY-MM-DD --json https://www.figma.com/design/FILE/Name?node-id=0-1
pnpm figma:diff -- --since YYYY-MM-DD --visual https://www.figma.com/design/FILE/Name?node-id=1-2
```

`--visual` renders up to 3 nodes whose size, padding, paint, or text changed (not a pure x/y shift) at `--since` and now. `diff.png` is the current screenshot with changed pixels washed red. Files land in `.figma-diff-cache/visual/`.

The link is a frame or a page in any file (`node-id` required). File key and scope come from that URL, not from `AGENTS.md`. A page link diffs the canvas; a frame link diffs that frame and its descendants.

Whole-file fallback (project file in `AGENTS.md`):

```bash
pnpm figma:diff -- --since YYYY-MM-DD
pnpm figma:diff -- --since YYYY-MM-DD --page "Page Name"
pnpm figma:diff -- --since YYYY-MM-DD --node-ids 1:2,1:3
```

No token in this environment → fixture mode (no live file):

```bash
pnpm figma:diff -- --before path/old.json --after path/new.json --file-key KEY
```

`--help` lists flags. Default file key = first `figma.com/design/:key` URL in `AGENTS.md` / `frontend/AGENTS.md`. Default `--tz` `Asia/Krasnoyarsk` (end of civil day). Token from `FIGMA_TOKEN` (else `FIGMA_ACCESS_TOKEN` / `FIGMA_API_KEY` / `PUBLIC_FIGMA_TOKEN`). Do not ask for the token; do not print it.

Immutable versions cache under `<repo>/.figma-diff-cache/` (gitignored).

## After the report

Code only `added` / `changed` / `renamed` / `moved` nodes (and `removed` if the UI still renders them). Unlisted frames stay untouched. Then follow `figma-design-to-code` for those node ids.

## Limits (do not work around)

- Starter Figma: 30 days of version history. No version on or before `--since` → the command fails; say so.
- Autosaves are ~30 minutes apart, not every edit.
- `GET /v1/files/:key/variables/local` has no documented `version` param (Enterprise). Historical variable values may be missing; node `boundVariables` still diff.
- Live current file is not cached (it is not immutable).
