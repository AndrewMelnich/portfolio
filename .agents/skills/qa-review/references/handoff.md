# Handoff: any CSS selector ↔ any Figma node

## Hard rule — no guessing

qa-review **never** infers a selector from the check key name (`chromeWidth` → root, etc.).

Resolve order:

1. `entry.selector` if set
2. `map.<frame>[selector] === nodeId` where `nodeId` is the left part of `from` (`333:16394.layout…` → `333:16394`)
3. else **SKIP** + warning — add a map row or `selector:`

## `map` in `<Block>.figma.check.yml`

```yaml
version: 1
map:
  desktop:
    ".my-block": "12:340"
    ".my-block__title": "12:341"
    ".my-block__list": "12:350"
  tablet:
    ".my-block": "99:10"
desktop:
  titleGap: { value: "10px", from: "12:341.layout.gap" }
  # when from-node ≠ measurable BEM host:
  chromeWidth:
    value: 365
    from: "12:399.layout.dimensions.width"
    selector: ".my-block__content"
  # Figma node not 1:1 with any css-tree host:
  topRowHeight:
    value: 44
    from: "12:410.layout.dimensions.height"
    compare: skip
    reason: "Figma group ≠ list box"
```

Rules:

- Map values = Figma `nodeId` from `.figma.yml` tree.
- Map keys = **simple** class selectors that appear on a node in the css-tree dump (`.block__el`). No `nth-child` / descendant combinators unless the dump walker supports them.
- Cover every `from` nodeId used under that frame, **or** put `selector:` on the entry.
- Prefer one map row per measurable BEM host; use `selector:` when Figma node is not 1:1 with the CSS box you measure.

## Dump + HTML report

`<skill>` = the qa-review skill directory. A route `--url` opens on the verify origin from `.cursor/fstack/config.json`.

```bash
node <skill>/scripts/figma-section-css-tree.mjs \
  --url <route-or-fixture> \
  --selector .my-block \
  --snapshot path/to/Block.figma.yml \
  --frame desktop \
  --width 1600 \
  --out path/to/Block.desktop.css-tree.yml

node <skill>/scripts/figma-css-tree-report.mjs \
  --snapshot path/to/Block.figma.yml \
  --check path/to/Block.figma.check.yml \
  --tree path/to/Block.desktop.css-tree.yml \
  --frame desktop \
  --out path/to/Block.desktop.css-tree.report.html
```

Report HTML **must** use skill template `assets/report-template.html`.

## design-review

design-review uses `from` + declared SCSS. `map` / `selector` help qa-review only.
