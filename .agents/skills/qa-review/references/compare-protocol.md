# qa-review — compare protocol

## Inputs

| Artifact                  | Role                                                |
| ------------------------- | --------------------------------------------------- |
| `<Block>.figma.yml`       | Immutable tree + `designedWidth` per frame          |
| `<Block>.figma.check.yml` | Expected tokens (`value` + `from`) + optional `map` |
| `*.css-tree.yml`          | Live dump from `scripts/figma-section-css-tree.mjs` |

Viewport: default = `frames.<frame>.designedWidth`. If that width falls inside a narrower breakpoint mixin (`project.md`, Styles), desktop dumps need `--width` at or above the narrowest desktop width. The report generator warns when `frame=desktop` and the viewport is below `--desktop-min`.

## Compare set (must match within ±4px / exact enum)

- `gap` / `row-gap` / `column-gap`
- `padding-*` (or shorthand if dumped)
- `width` / `height` / `max-width` when check has a size token
- `opacity` — if computed `opacity` is 1 and `color` is `rgba`/`hsla` (or modern `/` alpha), compare **color alpha** to the check value
- `*Font` keys (`bodyFont`, `titleFont`, …): resolve `from` textStyle → `globalVars` and compare live `font-size` / `font-weight` / `line-height` (as em ratio) / `letter-spacing` (as em) / `font-family`
- `text-transform` when check has type tokens
- `display` / `flex-direction` when structure is in check scope

## Ignore set

- Page wrapper horizontal inset (page-chrome offset) unless section insets differently
- Antialias / subpixel (`121.328px` → compare rounded)
- Pure IMAGE content
- Shared primitives bound to project type tokens (unless check explicitly lists them)
- `margin` collapse noise on `<p>` unless check key targets it
- Copy stale on non-desktop (same as design-review)
- Declared `ch` — design-review **Text measure** (`ch-from-px.mjs` stdout). Live: compare computed `max-width` px to Figma TEXT width (±4px) when check targets wrap measure

## Diff → action

1. Resolve check `from` → Figma value (sanity).
2. Resolve CSS node via `map.<frame>[selector]` (or prompt-supplied pairs) — **any** selector ↔ **any** nodeId.
3. Read live `styles` / `box` from css-tree node.
4. Mismatch → fix **styles** (SCSS by default). Anti-cheat: no silent `value` edit without `override: true` + `reason`.

## Output

1. **HTML report (required when user asks for report / «отчёт»):**  
   `scripts/figma-css-tree-report.mjs` → fill [assets/report-template.html](../assets/report-template.html).  
   Do not freehand a different HTML shape.
2. Agent chat: short summary of FAIL/INFO + path to the `.css-tree.report.html`. No screenshots.
