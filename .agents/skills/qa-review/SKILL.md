---
name: qa-review
description: >
  Dump live computed CSS tree via Playwright, compare to .figma.yml /
  .figma.check.yml for any Figma node ↔ any CSS selector, and emit an HTML
  report from the skill template. Use when user asks qa-review, computed styles vs Figma.
paths:
  - "frontend/**/*"
---

# QA review (live CSS tree)

Project overrides: read `.cursor/fstack/project.md` and `.cursor/fstack/qa-review.md` from the repo root when present; they win over this file.

**design-review** = declared SCSS vs tokens, no browser. **qa-review** = computed CSS tree from a running page or fixture HTML + HTML report. Distances between live boxes vs Figma frames = layout proof (`scripts/layout-proof.mjs` in the `verify-ui` skill; protocol in the `figma-design-to-code` skill).

Scope: **any** colocated `<Block>.figma.yml` + any `--selector`. Not tied to one section.

## CLI

Scripts live in this skill's `scripts/` (`<skill>` below = this skill's directory); run them from the repo root. They read `.cursor/fstack/config.json`: Playwright and `yaml` resolve from the app dir (`config.app`), and a route `--url` (`/about`) opens on the verify origin (`control doctor` in the `verify-ui` skill prints it; launch the preview there first). Never hardcode a host or port.

```bash
# 1) dump
node <skill>/scripts/figma-section-css-tree.mjs --url <route|http(s)|file:|path> --selector .any-block \
  --snapshot path/to/Block.figma.yml --frame desktop [--out Block.css-tree.yml]

# debug viewport (default = frames.<frame>.designedWidth — NOT always the project desktop band)
node <skill>/scripts/figma-section-css-tree.mjs --url … --selector … --width 1440

# 2) HTML report (template-bound)
node <skill>/scripts/figma-css-tree-report.mjs \
  --snapshot path/to/Block.figma.yml \
  --check path/to/Block.figma.check.yml \
  --tree path/to/Block.css-tree.yml \
  [--frame desktop] [--desktop-min <px>] \
  [--out path/to/Block.css-tree.report.html]
```

| Artifact          | Path                                                       |
| ----------------- | ---------------------------------------------------------- |
| Dump script       | `scripts/figma-section-css-tree.mjs`                       |
| Compare           | `scripts/figma-css-tree-compare.mjs`                       |
| Report script     | `scripts/figma-css-tree-report.mjs`                        |
| Project context   | `scripts/project.mjs` (root, config, verify origin)        |
| **HTML template** | [assets/report-template.html](assets/report-template.html) |
| Fixture HTML      | [assets/fixture-section.html](assets/fixture-section.html) |

- Dump output: `*.css-tree.yml` (gitignore it)
- Report output: `*.css-tree.report.html` (commit while reviewing if useful)
- Unreachable `--url` → non-zero exit + message
- Missing `.cursor/fstack/config.json` or a package missing from the app → exit `2` + hint
- Report FAIL → exit code `2`
- **No screenshots**

### Viewport caution

`designedWidth` from Figma (e.g. 963) may sit **inside** a narrower breakpoint mixin from `project.md` (Styles). Then live CSS is that band, not desktop — desktop tokens false-FAIL. For desktop frame dumps use `--width` at or above the narrowest desktop width (the first px no breakpoint mixin matches; typical 1441 in this project, since `laptop` covers 1440), and pass that width to the report as `--desktop-min` so it warns on a too-narrow dump. For an adaptive frame, dump at that frame's designedWidth / band.

## Protocol

1. Read [references/handoff.md](references/handoff.md) — write/use `map` (selector → nodeId).
2. Read [references/compare-protocol.md](references/compare-protocol.md).
3. Dump live tree (viewport policy above).
4. Generate HTML report via `scripts/figma-css-tree-report.mjs` — **must** use [assets/report-template.html](assets/report-template.html) (override only with `--template` for experiments).
5. Diff FAIL rows → fix **styles** (SCSS by default; anti-cheat: no quiet-edit check `value`).

## HTML report template

Canonical template: [assets/report-template.html](assets/report-template.html).

Placeholders (filled by `figma-css-tree-report.mjs`):

`{{TITLE}}` `{{BLOCK}}` `{{FRAME}}` `{{GENERATED_AT}}` `{{SNAPSHOT}}` `{{CHECK}}` `{{CSS_TREE}}` `{{URL}}` `{{SELECTOR}}` `{{VIEWPORT}}` `{{DESIGNED_WIDTH}}` `{{VERDICT}}` `{{COUNT_PASS}}` `{{COUNT_FAIL}}` `{{COUNT_SKIP}}` `{{COUNT_INFO}}` `{{WARNINGS}}` `{{ROWS}}` `{{MAP_ROWS}}`

Do not invent a different layout in the agent response — open/share the generated HTML file.

## Fixture test

[assets/fixture-section.html](assets/fixture-section.html) — generic `.fixture-block` HTML without the full app. Smoke check: `node <skill>/scripts/figma-section-css-tree.mjs --url <skill>/assets/fixture-section.html --selector .fixture-block --width 963` prints `gap: 30px` on the root.
