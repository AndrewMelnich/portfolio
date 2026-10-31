---
name: figma-reflow
description: >-
  Reflow Figma frames without Auto Layout into CSS document flow (flex/grid/gap/padding).
  Use when layoutMode is NONE or missing, нет auto layout, children have only
  absoluteBoundingBox / x / y, grouped mockups, or Figma x/y would become
  position:absolute / лишние абсолюты.
---

# Figma reflow

Project overrides: read `.cursor/fstack/project.md` and `.cursor/fstack/figma-reflow.md` from the repo root when present; they win over this file.

Restore **document flow** from a Figma dump that has no Auto Layout. Numbers stay exact (`figma-design-to-code`); this skill only chooses **how** those numbers sit in CSS.

Auto Layout present (`layoutMode` `HORIZONTAL` / `VERTICAL`, or wrap) → trust Figma padding / `itemSpacing` / align / grow. **Reflow** the rest.

## Steps

Do these **per parent** (frame or kept group), then recurse into children that stay wrappers.

### 1. Tag the tree

Each node: `al` (has Auto Layout) or `reflow` (`layoutMode` missing / `NONE` / not horizontal or vertical). Mixed trees are normal: `al` subtrees are opaque units; reflow only `reflow` parents.

**Done when:** every node in the target subtree is `al` or `reflow`.

### 2. Localize

Parent-relative box:

```text
x' = child.x - parent.x
y' = child.y - parent.y
```

Use `absoluteBoundingBox` when present. **ε** = 1px for edge snap; 2px for band membership (fractional Figma coords).

**Done when:** every child of this parent has `x' y' w h`.

### 3. Rewrite the Figma tree

Figma groups ≠ DOM. Before clustering:

| Signal | Action |
| --- | --- |
| `GROUP` with no fill, stroke, radius, clip, shadow | hoist children into parent |
| Sibling `RECTANGLE` / fill matching parent bounds (±ε) | parent `background`; drop the rect |
| Empty node (no fill/stroke/text/children) used as spacer | drop; its size becomes **gap** / padding |
| Filled rect that visually contains sibling nodes | synthesize a wrapper (card); those siblings become its children |
| `INSTANCE` / `COMPONENT` | one unit; do not reflow insides unless you implement that component now |

**Done when:** leftover nodes are visual boxes or content; no spacer frames; no full-bleed bg rects as siblings.

### 4. Classify overlay vs flow

Default: **flow**. **Overlay** only when the node paints *on* something rather than *after* it:

- Overlap area / min(areas) > 0.08 **and** not an ε edge-kiss (gap −2…0 → treat as adjacent, gap 0)
- Badge, chip, icon on a corner of a sibling; vector/blob/line; rotated node; photo stack on a photo
- Constraints pin to a corner/edge of a **sibling box**, not a slot in the stack

Designed overlap in a sequence (avatar stack, stacked cards): flow + negative margin, still not a page of absolutes.

**Done when:** every remaining child is `flow` or `overlay`.

### 5. Cluster flow nodes

Reading order: sort by `y'`, then `x'`.

**Band** (row): transitive cluster where vertical overlap / min(h) ≥ 0.5, or |ΔcenterY| < min(h) / 2.

**Pack** (tight group inside a band): split where a hole ≫ typical item gap (hole > 2× median gap, or one large void between left cluster and right cluster).

**Done when:** parent = ordered bands; each band = 1+ packs; each pack = 1+ items.

### 6. Pick a mechanism

One mechanism per parent. Page column grid (the column mixins in `project.md`, Styles) stays `figma-design-to-code` — this table is **local** layout.

| Cluster | CSS |
| --- | --- |
| Several bands, each one item or one column pack | `display: flex; flex-direction: column;` + `gap` |
| One band, one pack, n items | `flex-direction: row;` + `gap` + `align-items` |
| One band, two packs with a hole (logo vs nav, title vs action) | row + `margin-inline-start: auto` on the right pack (or `justify-content: space-between` if packs are the only two children) |
| Several bands of the same repeating item (cards, chips) | `flex-wrap` + `gap`, or local `display: grid` + `gap` when columns **and** rows line up |
| Equal columns in a band (50/50, 1/3s) | local grid `1fr 1fr`… or `flex: 1` on children; widths as fractions, not copied px |
| Overlay | containing block `position: relative`; overlay `position: absolute`; pin from [Constraints](#constraints) |

Prefer **gap on the parent** over per-child margin. Uneven sibling distances: `gap` = the common value, extra space as margin on the one child that differs.

**Done when:** each parent has exactly one mechanism; overlays listed with their containing block.

### 7. Measure

From localized boxes, not from invention:

```text
padding-top    = min(y')
padding-left   = min(x')
padding-right  = parent.w - max(x' + w)
padding-bottom = parent.h - max(y' + h)
gap-x / gap-y  = distance between consecutive flow siblings in that axis
```

Shared inset of all children → **parent padding**, not the same margin on every child.

**Align** (within ε):

- Column: same `x'` → `align-items: flex-start`; same right edge → `flex-end`; same centerX → `center`; child width ≈ parent inner width → `stretch` / `width: 100%`
- Row: same `y'` → `flex-start`; same bottom → `flex-end`; same centerY → `center`; text next to icon → `center` or `baseline`

**Hug / fill:**

- Parent height ≈ padding + children + gaps → height **hug** (`auto`), not a copied frame height
- Child width ≈ parent inner width → **fill**
- `child.w / inner` ≈ ½, ⅓, ¼ (±1%) → fraction / `1fr`, not px
- Else keep Figma px (tokens if they match)

**Text:** never set CSS `height` from a `TEXT` bounding box. `textAutoResize`:

- `WIDTH_AND_HEIGHT` → hug width
- `HEIGHT` → width from Figma, height auto
- `NONE` (fixed frame) → `max-width` (text blocks: `ch` per the `figma-design-to-code` skill, Text wrap `ch`), not min-height unless the node has a visible fill

**Done when:** padding / gap / align / hug-or-fill are numbers taken from the boxes; text has no fake height.

### 8. Implement, then recurse

DOM order = reading order (bands top → bottom, packs left → right). Figma paint order (later child on top) applies **only** to overlays (`z-index` or DOM after the painted-under sibling).

Then reflow each kept child wrapper.

Tokens, page container, BEM, assets: `figma-design-to-code`. Unbound Figma (no variables/styles): **scale**. Breakpoint frames: **responsive-layout**.

**Done when:** every flow node is in normal flow; every overlay has a mapped containing block.

### 9. Verify

- New SCSS: each `position: absolute` maps to a node classified overlay in step 4. Stage-sized absolute children of a full desktop frame = failed reflow; redo from step 5.
- Live boxes vs these frames: layout proof (`references/layout-proof.md` in the `figma-design-to-code` skill). **Done = that file's done criteria** (`layout-proof.mjs` exit 0: every box `|live - figma| ≤ 1`).

**Done when:** overlay check is green and layout proof is green for this frame.

## Constraints

Use Figma `constraints` to pick **which edge** an overlay pins to (flow nodes ignore this — flex/grid owns them):

| Horizontal | CSS |
| --- | --- |
| `MIN` / LEFT | `left: x'` |
| `MAX` / RIGHT | `right: parent.w - x' - w` |
| `CENTER` | `left: 50%` + `translateX(-50%)`, or inset math if the parent is the visual center |
| `STRETCH` / LEFT_RIGHT | `left` + `right`, width auto |
| `SCALE` | `%` of parent |

Same for vertical (`top` / `bottom` / `translateY`). Stretch + fill is still flex/grid when the node is **flow**.

## Stroke

Figma stroke can sit outside the fill. CSS is `border-box`. If the MCP box includes an outside stroke, subtract it from width/height before copying px.

## Patterns

Worked cases (stack, split pack, cards, badge, blob, avatar stack, fake group): [references/patterns.md](references/patterns.md).
