---
name: figma-scale
description: >-
  Infer a design scale (colors, type, radii) from Figma files with no variables,
  text styles, or color styles. Use when get_variable_defs is empty, нет токенов /
  переменных / стилей / типографики, no textStyleId / fillStyleId, or raw
  fontSize / HEX would be copied onto every BEM block.
---

# Figma scale

Project overrides: read `.cursor/fstack/project.md` and `.cursor/fstack/figma-scale.md` from the repo root when present; they win over this file.

Figma with no variables / text styles / color styles still has a scale: it lives in **repeated raw values**. **Harvest** those values, **cluster** them, **bind** to project tokens — then implement. Exact numbers (`figma-design-to-code`); this skill chooses **where** they live.

Figma already has variables or named styles → map `get_variable_defs` / style names onto the variables file / typography file (same bind table). Harvest only the unbound leftovers.

## Modes

| Mode | When | Write |
| --- | --- | --- |
| **bind** | Default: implementing a section/page | Match existing placeholders / `$vars`. Add a token or `%placeholder` only for a **new fingerprint that repeats**, or a new heading/subtitle role |
| **rebuild** | User (or the project's typography command, override) asks to build the typography (or a new color system) | Rebuild the typography file (and new `$vars`) from the harvest of **all** breakpoint frames |

**Done when:** mode chosen before the first CSS write.

## Homes

File paths: `project.md`, Styles. By default:

| Kind | File |
| --- | --- |
| Color, duration, easing, font-family | the variables file (token blocks: override) |
| Type roles | the typography file (`%name` + `.name`) |
| `@font-face` | the fonts file |
| Page offset, grid, header height | the custom-properties file |
| Spacing (gap/padding from reflow) | component px, unless it already equals a layout custom property (gutter, page inset, header height) |

Do not invent a new spacing scale in the variables file. Layout numbers stay with **reflow**.

## Steps

### 1. Detect

Unbound file when **any**:

- `get_variable_defs` empty / missing
- Nodes lack `boundVariables`, `textStyleId`, `fillStyleId`, `styles`
- TEXT has only `style.fontSize` + fills, no style name

**Done when:** file tagged `bound` or `unbound`. Unbound → continue. Bound → bind named styles, harvest only leftovers.

### 2. Harvest

Collect from **every breakpoint frame** of the surface you implement (desktop + tablet + mobile), not one node.

| Channel | Source | Record |
| --- | --- | --- |
| Color | solid fills, strokes, TEXT fills | 8-bit HEX + alpha (see [RGB](#rgb)) |
| Type | each TEXT | **fingerprint** (below) + frame + role hint (heading vs caption from size rank) |
| Radius | `cornerRadius` / per-corner | px |
| Shadow | `effects` DROP_SHADOW / INNER | CSS `box-shadow` tuple |
| Font family | `style.fontFamily` | string + weights used |

Skip: image fills (assets), unique one-off gradients (copy as CSS at the node), spacers.

**Fingerprint** (type):

```text
family | size_px | weight | italic? | lh_unitless | ls_em | transform
```

- `lh_unitless` = `lineHeightPx / fontSize` (or `lineHeightPercentFontSize / 100`). Round to 0.05 for clustering; store the Figma ratio.
- `ls_em` = `letterSpacing_px / fontSize` (already in `figma-design-to-code`). `0` → omit property.
- `transform`: Figma `textCase` UPPER → `uppercase`, TITLE → `capitalize`, LOWER → `lowercase`, else none.

**Done when:** every TEXT and every solid paint on the frames is in the harvest table.

### 3. Cluster

**ε:** HEX — after 8-bit round, max channel Δ ≤ 1 binds to the same swatch (export noise). Type size Δ ≤ 0.5px + same weight/lh/ls/transform → one fingerprint. Radius Δ ≤ 1px.

Color used ≥ 2 times, or once on a large surface / body text / primary button → **swatch**. Color used once on a tiny decor → stay local HEX.

Type: one fingerprint per cluster. Count occurrences across frames.

**Done when:** harvest is a set of swatches + fingerprints with occurrence counts, not a list of nodes.

### 4. Bind

Against the current variables file and typography file:

| Harvest | Existing match | Action |
| --- | --- | --- |
| HEX = `$accent` (etc.) | yes | use `$accent` |
| New swatch | no | **bind:** add `$name` in the right token block if it repeats or is brand. **rebuild colors:** same, names from role (bg, text, accent, danger), not `color-1` |
| Fingerprint = `%heading-h2` | yes | `@extend %heading-h2` / class `heading-h2` |
| New fingerprint, repeats **or** heading/subtitle rank | no | add `%name` + `.name` (see [Naming](#naming)) |
| New fingerprint, **once**, body-size or caption | no | properties on that BEM node; no new placeholder |

**Never** retune an existing `%placeholder` to a different Figma size during **bind** — that restyles other pages. New size → new slot (or local). **rebuild** may replace the type file.

Color stays **off** the placeholder by default (the override says whether the typography file carries `color`). The body color token on `body`; overrides on the block.

Family matches the base font-family token → inherit, do not restate `font-family` on each role. New family → `@font-face` in the fonts file + token if reused.

Radius/shadow: repeat ≥ 2 components → token (the project's global radius token if one is already in play (override), else a `$var`). Once → px on the block.

**Done when:** every swatch and fingerprint has a home: existing token, new token, or documented local.

### 5. Pair breakpoints (type)

Same **role** across frames: same size-rank in that frame’s ladder + weight + transform (layer/component name as a hint, not the source of truth).

```scss
%heading-h2 {
  font-size: 64px; // desktop frame

  @include mobile {
    font-size: 36px; // mobile frame, same role
  }
}
```

Unchanged size at a narrower mixin → omit (responsive-layout). **rebuild** + user asked fluid → the project's fluid font-size mixin with the viewport range from the typography command (override).

**Done when:** each paired role has one placeholder, desktop in base, overrides only where Figma differs.

### 6. Implement

HTML: typography **class** on the node (`class="heading-h2"`) when the tag is the role. BEM that needs extra layout: `@extend %heading-h2` inside `.block__title`, no second `font-size`.

Semantic tag ≠ Figma name (`figma-design-to-code` / the project's wysiwyg guide). Visual = class / `%placeholder`.

**Done when:** component SCSS has no copied `font-size` / `font-weight` / `line-height` / `letter-spacing` that already live on a bound placeholder; no copied HEX that already lives on a `$swatch`.

### 7. Verify

- Every TEXT node on the frames maps to a fingerprint → placeholder, class, or a counted local.
- `grep font-size` on the new block SCSS: hits are locals from step 4 or inside the typography file.
- `grep` HEX on the new block: hits are locals or `$var` references.
- Body still extends the project's body text role (override).

**Done when:** checklist green.

## RGB

Figma `color: { r, g, b, a }` is 0…1.

```text
hex_channel = round(channel * 255)
```

`a < 1` → `rgba($swatch, a)` (or `rgb(from …)`), token the RGB, alpha at the use site.

## Naming

Follow the typography file as it exists. Default names for new slots (the override may replace them):

| Rank (desktop size) | Base name |
| --- | --- |
| Largest display | `heading-h1` … `heading-h6` (one step per distinct size) |
| Next band (~21–30px) | `subtitle-lg` / `md` / `sm` / `xs` |
| ~16–18px | `text-lg` / `text-default` |
| ~14px | `text-sm` |
| ~12px | `text-xs` |
| ≪12 or tiny labels | `text-micro` |

Reuse the suffixes already in the file (weight, tighter line-height, case — the override lists them). Tracking as `%tracking-*` when ls is the only delta.

Color `$name`: role (`$dark`, `$accent`, `$body-bg`), not the HEX. Palette primitives and semantic aliases in separate token blocks (override names them).
