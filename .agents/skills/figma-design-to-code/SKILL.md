---
name: figma-design-to-code
description: Converts Figma designs into HTML and CSS/SCSS code. Use when working with Figma links, layer IDs, or implementing a design from a mockup. Before calling layout done, run layout proof — live element boxes vs Figma boxes (references/layout-proof.md); проверка верстки, попасть в макет.
---

# Figma Design to Code

Project overrides: read `.cursor/fstack/project.md` and `.cursor/fstack/figma-design-to-code.md` from the repo root when present; they win over this file.

## Figma MCP

URL → `fileKey` / `nodeId`:

- `…/design/:fileKey/…?node-id=1-2` → `nodeId` `1:2` (`-`→`:`)
- `/branch/:branchKey/` → use `:branchKey` as `fileKey`

**On disk first.** Colocated `<Block>.figma.yml` + `<Block>.figma.check.yml` → `Read` both and code from them. Fetch only when either file is missing, or the user says the frame changed (then rewrite `<Block>.figma.mcp.yml` → the project's snapshot command (override, Scripts) → `Read` the new tree).

**Ladder** when the snapshot is missing. One node at a time: the next node starts after this node has returned. The same worker continues.

0. Node cache. `pnpm figma:node-cache -- get <figma-url>` (from the checkout; needs the Figma token). Exit 0 prints a cached dump path: copy it to `<Block>.figma.mcp.yml` and run the snapshot command. Exit 1 is a miss and exit 2 an error (no token, no network); both continue with rung 1. After a Framelink rung, store the verbatim dump with `pnpm figma:node-cache -- put <figma-url> <Block>.figma.mcp.yml`. The cache key is file key + node id + the file's Figma `lastModified`, so a changed frame misses. Only a verbatim Framelink dump is stored.
1. Project-scoped Framelink. `GetDynamicTools` once, pattern `Framelink`. The project-scoped namespace is the one whose name starts with `project-`. A usable status → `get_figma_data` for this node.
2. Status `error`, `needsAuth`, or the namespace missing from discovery → user-scoped `user-Framelink MCP for Figma`, one node at a time.
3. Both unavailable → `GET https://api.figma.com/v1/files/:fileKey/nodes?ids=:nodeId` with header `X-Figma-Token`. The token is `FIGMA_API_KEY` in the root `.env`, else `PUBLIC_FIGMA_TOKEN` in `frontend/.env`. Leave the token out of the reply. `fileKey` comes from `docs/project.md`.

`429` → wait `Retry-After`, then repeat that same call once. Same rung, same worker. A second `429` stops the ladder and names the rung.

**Done when** `<Block>.figma.yml` and `<Block>.figma.check.yml` are on disk and each node call finished before the next. A Framelink rung writes verbatim `<Block>.figma.mcp.yml`, then the snapshot command. A REST payload is not a Framelink dump: write `.figma.yml` in the shape in [references/figma-snapshot.md](references/figma-snapshot.md) from that payload. `figma:snapshot` runs on a dump that contains `NODES:`.

Then match tokens via `get_variable_defs` / the variables file (`project.md`, Styles), and `download_figma_images` for that node on the same rung (see Assets).

`user-Figma_Dev_Mode_MCP` (if enabled): `get_screenshot`, `get_design_context`, `get_variable_defs`.

**MCP schema:** `GetDynamicTools` **once per namespace per session** (Framelink, browser, …). Reuse schema.

**Plan already has measures** (px, copy, HEX, node ids) → code from the plan. The ladder runs only for a measure the plan and the yaml tree both lack.

### Snapshot (adaptive / multi-state)

Files already on disk → `Read`. A missing snapshot is the ladder above. Checklist shape: [references/figma-snapshot.md](references/figma-snapshot.md).

**Git:** do not commit snapshot files. `*.figma.yml`, `*.figma.check.yml`, `*.figma.mcp.yml`, and `*.css-tree.yml` stay local (gitignore). design-review and layout still `Read` them from disk.

**Completion for this step:** the ladder's Done, with check keys covering gap/padding/type/color that differ from desktop/base. design-review follows the parent ceiling in the `design-review` skill (How, parent). Live CSS = the `qa-review` skill.

Empty `get_variable_defs`, no text/color styles, no tokens / typography → **scale**: the `figma-scale` skill **before** component CSS (**bind** by default; **rebuild** only when asked to build the typography).

## Reflow (no Auto Layout)

`layoutMode` NONE/absent, or children only have `absoluteBoundingBox` / x / y → **reflow**: the `figma-reflow` skill **before** CSS. Default: flex/grid/gap/padding from spatial clusters. `position: absolute` only for nodes that skill classifies as overlay.

## Layout Grid (conditional)

The column mixins (`project.md`, Styles) — **only** when element snaps to a column (~1px). Else exact Figma px / tokens.

### Breakpoints (CRITICAL)

Do **not** hardcode column counts. Read live grid tokens from the custom-properties file (`project.md`, Styles): column count (and its overrides inside the breakpoint mixins), gutter, page inset. Mixins: the mixins file (`project.md`, Styles).

`N` = tracks of the **current** breakpoint's column count, not a frozen desktop width.

- Desktop / tablet / mobile = **different Figma frames** — snap **per frame**; never reuse desktop N on another breakpoint.
- Whether the mockups carry a Figma layout grid (COLUMNS) is a project fact (override). Framelink does not return grids either. With no COLUMNS, lay out by the mockup's px/gap/margin; column mixins only when the element clearly matches the token columns (~1px).
- On-grid SCSS: remap N (or raw px) inside the breakpoint mixin.

### Decision tree (per frame, then per element)

1. No COLUMNS in Figma → do not invent a grid; gaps/margins/widths from the mockup.
2. Element matches the column count / gutter / offset tokens of the custom-properties file at this breakpoint. Per element:
   - `colStart(n) = offset + (n - 1) * (section + gutter)` (`n` = 1…count)
   - snapped if `min_n |x - colStart(n)| ≤ 1px` (same for right edge `x + width`) → column-width / column-offset mixins, parent `gap` = the gutter token
   - miss (e.g. 8–15px off) → ignore grid → exact Figma
3. Mixed siblings OK — do not force everything onto the column mixins.
4. After desktop, re-snap other frames; override in matching mixins.

### SCSS when snapped

Page column grid: the project's CSS rules (`project.md`, Rules).

1. Inset — the page container (`project.md`, Styles) owns the page inset padding.
2. Width — the column-width mixin with N for the **current** breakpoint.
3. Skip cols — the column-offset mixin (`margin-left`, K).
4. Pair with breakpoint overrides (re-snap or raw px).
5. Media crop frame (`__clip` / `__media` / `__picture`): `aspect-ratio: W / H` (integers). Prefer `width: 100%` + ratio, no fixed `height`. Fixed `height` only with `aspect-ratio` and `width: auto` / omitted. Stylelint `custom/no-fixed-media-height`.

```scss
.block__item {
  @include grid-columns($nDesktop); // the project's column-width mixin

  @include tablet {
    @include grid-columns($nTablet); // or Figma px
  }
}
```

### Half-split (50/50)

Two equal halves separated by the gutter token (label left / title right, a lockup in a section header, etc.). When the project ships half-split utility classes (override names them), mount those classes in markup instead of repeating their declarations in BEM. When the mockup is clearly 50/50 with gutter = the gutter token, prefer the utilities over a local `calc(50% - …)`.

## Assets

**MUST read** [references/assets-mcp.md](references/assets-mcp.md) before any `download_figma_images`. `localPath` is the absolute path into the checkout you are working in (`git rev-parse --show-toplevel`); a relative one resolves from the MCP server's root, which differs per server, and can land in the main checkout.

Target: the project's static image folder (override, Assets) `/<category>/` (kebab-case). Code paths: its public URL prefix + `/<category>/…`. Export raster at `pngScale: 2` when used.

**CRITICAL — gray / tinted media plates:** if the Figma node has fills beyond `IMAGE` (e.g. `rgba(227,227,227,0.2)` under a product photo), download **node render** (`nodeId` + `fileName` only). Do **not** pass `imageRef` or `needsCropping` / `cropTransform` — that exports the raw white photo and drops the plate. Details: assets-mcp.md.

**CRITICAL** — after every download:

```text
ls <workspace>/<images-dir>/<cat>/
# empty → cp $HOME/<images-dir>/<cat>/* → workspace
ls again — do not finish until files present
```

### Code usage

- Raster: the project's image component (`project.md`, Shared UI).
- SVG: `<img width height loading="lazy" decoding="async">` with the project's fluid-image class (override).
- Icons: the project's icon component (`project.md`, Shared UI).

## Media scrim

A dark or tinted layer over a full-bleed IMAGE or VIDEO in Figma is a CSS overlay on the section or media host (`::after` or an `__overlay` element), not atmosphere to drop. Inventory every semi-transparent fill over media before done (design-review, Scrims).

## Same control, already built

Before a new field, leader, badge, or button chrome, search the source for that visible label and for that job. A hit in a page section counts the same as one in the shared UI folder (`project.md`, Shared UI).

One existing control: mount it. A visual with no script (a leader, a scrim) can be copied. A second use of a control that has markup and script: extract it into shared UI and mount it in both places. Copying that markup, styles, and script is not reuse.

**Done when** every call site mounts that component, or the reply names the query and that nothing matched.

## Project

**MUST read** `.cursor/fstack/project.md` and `.cursor/fstack/figma-design-to-code.md` before implementing (project-specific layout quirks). Either may be missing.

## Frontmatter

Extract repetitive lists (news, partners, features) into data at the top of the component file, not repeated markup:

```astro
---
const items = [{ title: '…', text: '…' }];
---
```

```tsx
const items = [{ title: "…", text: "…" }];
```

```vue
<script setup>
const items = [{ title: "…", text: "…" }];
</script>
```

## Hard rules

1. **CRITICAL** — exact Figma values; never invent content/spacing. Grid mixins only when snapped (see Layout Grid). A reused section keeps the donor block's flex until this frame's `x` / width / padding are written on the modifier (`locationRelativeToParent`, not `width: 50%` from the other page). Copy that changes only between frames: one string from the default frame, no second prop (design-review **Copy**).
2. BEM flat selectors. Nest only pseudo / mod / media — no `.block { .block__el {} }`.
3. Typography via classes / `@extend %<role>` — visual. Tag = document outline, not Figma style name. Wysiwyg / rich-text pages: skill `create-wysiwyg-page`.
4. Variables from the variables file (`project.md`, Styles) when HEX/RGBA/timing matches; hardcode only if unique. Unbound Figma (no variables/styles) → **scale** skill (harvest → cluster → bind).
5. Section → direct child page container (`project.md`, Styles) (do not override its padding).
6. Semantics + the project's a11y rules (`project.md`, Rules) and the `accessibility` skill; deep AT → the `aria-patterns` skill. Media types: the project's media rules (override), when it has them.
7. UI `<ul>` without bullets → the project's unstyled-list utility (override). Content/wysiwyg markers sized in Figma → [references/list-markers.md](references/list-markers.md).
8. Visible text → the project's text typography helper (override), when it has one.
9. `letter-spacing (em) = letter-spacing (px) / font-size (px)`.
   9a. **Text wrap `ch`:** before `max-width: …ch`, run `node scripts/ch-from-px.mjs` (this skill) and write its stdout. Flags and formula: that script's `--help`. Font file: `project.md`, Fonts. `px / fontSize` is not a `ch` value. When: the project's CSS rules on text width (override).
10. Media with plate fills (gray/tint under photo) → node render only (`nodeId`, no `imageRef`/crop). Raw `imageRef` only for cutouts. See assets-mcp.md.
11. Responsive overrides → **responsive-layout** skill (no duplicate props across max-width mixins).
12. Section / View props and page composition: the project's component and page-section rules (override). Scaffold: the project's component generator (override), when it has one.
13. No Auto Layout → **reflow** skill first (flex/grid/gap). Overlay absolute only.
14. No Figma tokens/styles → **scale** skill first (the typography file / color tokens, not per-block font-size/HEX copies).
15. **Overlay insets**: `top`/`right`/`bottom`/`left` from `absoluteBoundingBox` vs parent.
16. Interactive control (`a`, `button`, chip, card) → the `hover` skill. A control under the minimum hit size (`project.md`, Styles) on either axis → the click-target mixin (`project.md`, Styles).
17. Written files follow the `no-comments` skill.

## FSD placement (CRITICAL)

By default the project uses Feature-Sliced Design; `project.md` (Architecture) names the actual layer folders and wins. Canon: [fsd.how](https://fsd.how). Local rules: `project.md`, Rules. Lint: the FSD linter (steiger by default; command in `project.md`, Architecture).

### Where to put new UI from Figma

| What                                                                | Where                                                                                                                                     |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Full page composition                                               | `<pages layer>/<SliceName>/` (+ `index` public API). When the framework owns a routing folder, the route file only imports and renders it |
| Section (backend data, one page)                                    | `<pages layer>/<Slice>/ui/…/sections/<Name>/` (exact path: override) until a second page needs it                                         |
| Section reused on 2+ pages                                          | `widgets/<Name>/`                                                                                                                         |
| Entity UI (only when the entity type already exists)                | `entities/<entity>/ui/`                                                                                                                   |
| User action with business value (submit lead, auth, …)              | `features/<slice>/`                                                                                                                       |
| Reusable kit / no business meaning (Reveal, AjaxForm, Image, utils) | `shared/ui/*` or `shared/lib/*` — **not** `features/`                                                                                     |

Progressive default: new section stays page-local until real reuse. Details: the project's page-section rules (override).

### Hard rules

- **Never** put page slices or sections into the framework's file-based routing folder — that folder is routing only.
- Imports only downward: `app` → pages → `widgets` → `features` → `entities` → `shared`.
- Slice/segment public API: `index` with **named** exports (no `export *`).
- Prefer the existing shared UI (`project.md`, Shared UI) over reinventing.

### After implementing a layout

Run the FSD lint from the app directory (`config.json` `app`; command in `project.md`, Architecture).

Fix steiger findings that your change introduced (wrong layer, missing public API, sidestep imports). Do not silence rules without a project-level reason in `steiger.config.ts`.

## Done (CRITICAL)

Do **not** claim done until all hold:

1. **`check.*` recheck** — if `<Block>.figma.check.yml` exists (or should — adaptive/multi-state): every check key matches SCSS. Fix **code** on mismatch. Do not close FAIL by editing `value` without `override: true` + `reason`.
2. **design-review** — when the task/plan had Figma frames (section or widget from mockup): before the first `verify-ui` launch, follow the parent ceiling in the `design-review` skill (How, parent). **Done = that ceiling.**
3. **Layout proof** — Figma frames were in scope: follow [references/layout-proof.md](references/layout-proof.md), including its proof surface (story iframe, or the product route). `control launch` only when that surface is the verify origin. Later SCSS on a site route: `control launch` again so the build matches. **Done = every manifest exits 0**, and the closing message **quotes the exit 0** (and artifact path). That exit is boxes, padding, inset, text line counts, and page overflow. A `display: contents` node is the union of its in-flow children. A seam of 0 does not cover them. Browser CDP / hand tables / one-off Playwright / screenshots do not close this step. design-review and qa-review do not replace it.
4. **Reset gate** — when the project's CSS rules define a reset / normalize gate (override names it), run it. **Done = that step's own Done criterion.** Do not duplicate its table here; the rule file is canon.
5. Lint/FSD checkboxes below green.

Vague "done?" with no Figma frames in the task → skip design-review and layout proof.

## Verify

- [ ] Exact Figma values
- [ ] Text `max-width` in `ch`: value = stdout of `ch-from-px.mjs` (`--help`)
- [ ] Snapshot: adaptive/multi-state → `.figma.yml` + `.figma.check.yml`; check keys walked vs SCSS
- [ ] Scale: unbound Figma → harvest/cluster/bind (figma-scale); type via `%placeholder` / class
- [ ] Reflow: no Auto Layout → flex/grid/gap; each `position: absolute` is an overlay (figma-reflow)
- [ ] Grid: snap per breakpoint frame or raw px (see Layout Grid)
- [ ] Assets: MUST-read assets-mcp + ls in workspace ok; media plates → node render (no imageRef/crop)
- [ ] Project: MUST-read `project.md` + `figma-design-to-code.md` overrides applied (if any rules)
- [ ] Same control: the search in Same control ran; markup mounts the existing control, or the reply names the query and the miss
- [ ] Hard rules (tokens, BEM, page container, text helper, ul, em, a11y)
- [ ] **Reset gate** (project CSS rules, when defined) passed
- [ ] Responsive: no duplicate unchanged props (responsive-layout)
- [ ] FSD layer (pages / `widgets` / `features` / `entities` / `shared`; not the framework's routing folder for slices)
- [ ] Section / View props follow the project's component rules (override)
- [ ] FSD lint (steiger) passes
- [ ] Touched files: eslint / stylelint clean
- [ ] **Comments** (the `no-comments` skill): no narration, banners, commented-out code, or workaround notes; only that skill's allowed list
- [ ] **design-review** parent ceiling met when Figma frames were in scope (`design-review` skill, How parent)
- [ ] **Hover** (the `hover` skill): each new link / button / chip has the hover state and the same state on `:active, :focus-visible`
- [ ] **Underline from mockup** → `.link` / `.link--underlined`, not `text-decoration: underline` (stylelint `custom/no-text-decoration-underline`)
- [ ] **Hit area** (`project.md`, Styles): a control under the minimum hit size on either axis has the click-target mixin, or both axes already meet it
- [ ] **Layout proof** ([references/layout-proof.md](references/layout-proof.md)): each in-scope `layout-proof.mjs` exits 0; closing message quotes that exit

## Links

- the `hover` skill — hover state on interactive controls
- the `no-comments` skill — no workaround comments in the generated code
- [references/layout-proof.md](references/layout-proof.md) — live boxes vs Figma boxes
- the `figma-reflow` skill
- the `figma-scale` skill
- the `responsive-layout` skill
- the `design-review` skill · the `design-review` subagent
- the `qa-review` skill (live CSS / qa-review)
- the `verify-ui` skill (preview server, `layout-proof.mjs`)
- [references/figma-snapshot.md](references/figma-snapshot.md)
- project rule files and token files: `project.md` (Rules, Styles)
