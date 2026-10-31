# Figma snapshot (YAML split)

Colocate next to the UI block for the **current task**. Three files, different writers:

| File                      | Contents                    | Who writes                                      |
| ------------------------- | --------------------------- | ----------------------------------------------- |
| `<Block>.figma.mcp.yml`   | Verbatim Framelink dump     | stdio / MCP client only (not LLM-retyped)       |
| `<Block>.figma.yml`       | tree + globalVars + meta    | **only** the project's snapshot command         |
| `<Block>.figma.check.yml` | checklist for design-review | human/agent per schema; FAIL ≠ quiet edit value |

The snapshot and css-tree commands are project scripts; the `figma-design-to-code` override (Scripts) names them. Below they appear as `figma:snapshot` and `figma:css-tree`.

Tree = immutable post-transform. Interpretation only in check.

**Git:** do not commit any of the three snapshot files or `*.css-tree.yml`. They stay local (gitignore). design-review still `Read`s `.figma.yml` + `.figma.check.yml` from disk.

**design-review:** reads `.figma.yml` + `.figma.check.yml` vs SCSS — **no browser**. Live computed tree = `qa-review`.

## When

Adaptive / multi-state Figma work (tablet/mobile frames, open/closed, …). Skip for a one-shot desktop-only tweak with measures already in the plan.

## Shape — `.figma.yml` (transformer output)

```yaml
fileKey: …
fileName: …
fetchedAt: YYYY-MM-DD
source: …
frames:
  desktop:
    nodeId: …
    url: …
    designedWidth: 963 # number from layout designedWidth "963px"
    designedHeight: 850
    name: …
    globalVars: { … } # YAML types from MCP GLOBAL_VARS
    elements: { … } # optional MCP ELEMENTS
    tree: { … } # structured NODES
```

- **No `check` key** in `.figma.yml`.
- Normalize: layout JSON blobs keep MCP strings (`"963px"`); `layout=layout_*` → string ref; inline `layout={…}` → object; opacity = float as MCP emits.

## Shape — `.figma.check.yml`

```yaml
version: 1
# optional — any CSS selector ↔ any Figma nodeId (any block, not one section)
map:
  desktop:
    ".my-block": "12:340"
    ".my-block__title": "12:341"
desktop:
  introGap: { value: "10px", from: "12:341.layout.gap" }
  # optional escape hatch — FAIL cannot be closed by value edit alone:
  # someKey: { value: "…", override: true, reason: "…" }
tablet: …
```

- Every `from` must resolve against `frames.*.tree` (layout string refs resolve via `globalVars`). Node ids are whatever the dump contains — not tied to a specific section.
- Optional `map.<frame>[selector] = nodeId` for qa-review (see `references/handoff.md` in the `qa-review` skill). **Required** for qa-review report: every `from` nodeId must be mapped or the entry needs `selector:`. No keyword guessing.
- **`desktopAlt`:** SKIP in check (tokens = desktop) unless values diverge — do not copy a duplicate checklist.
- **Anti-cheat:** closing a design-review FAIL by editing `value` without `override: true` + non-empty `reason` is forbidden.
- **Stale:** new mcp → regen tree → check `from` keys must still resolve; derived math (e.g. gutter = contentX − photoW) re-verify or mark stale.
- **Text `ch`:** check `value` = stdout of `ch-from-px.mjs` (flags: `--help`). design-review **Text measure** owns the Major threshold.

## Workflow

1. Both `<Block>.figma.yml` and `<Block>.figma.check.yml` already on disk, and the user did not say the frame changed → `Read` them. Skip MCP. Otherwise capture verbatim MCP per frame → write/overwrite `<Block>.figma.mcp.yml` (stdio).
2. `figma:snapshot -- path/to/Block.figma.mcp.yml` → structured `.figma.yml`.  
   If the file is still named `.figma.yml` but is an MCP dump: script **renames to `.figma.mcp.yml` first**, then writes tree.
3. Maintain `.figma.check.yml` (keys + `from`).
4. Code from `.figma.yml` tree + check values; resolve fills/styles via `globalVars`.
5. Before finish: walk every check key vs SCSS (design-review Task). Mismatch → fix **code** (or re-fetch MCP if Figma changed) — not silent check edits.
6. Optional live CSS (qa-review): `figma:css-tree` — see the `qa-review` skill.

## Scripts

```bash
<snapshot command> -- path/to/Block.figma.mcp.yml
<css-tree command> -- --url <url> --selector .block --snapshot path/to/Block.figma.yml --frame desktop
node scripts/ch-from-px.mjs 315 --size 12 --font path/to/Body-Face.woff2   # font: project.md, Fonts
node scripts/ch-from-px.mjs --measure-zero-em --font path/to/Face.woff2
node scripts/ch-from-px.mjs --self-test
```

`scripts/` is this skill's directory; run from the repo root with the skill path prefixed.
