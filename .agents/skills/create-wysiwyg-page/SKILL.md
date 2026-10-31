---
name: create-wysiwyg-page
description: >-
  CMS text page: unclassed semantic tags, typography @extend.
  Use when laying out a WYSIWYG HTML page from Figma, or when
  editing the wysiwyg stylesheet selectors.
---

# WYSIWYG page

Project overrides: read `.cursor/fstack/project.md` and `.cursor/fstack/create-wysiwyg-page.md` from the repo root when present; they win over this file.

Editor HTML is bare tags inside the wysiwyg root (override). Chrome stays on the view. Editor CSS lives in the wysiwyg stylesheet (override).

## Reach

- Figma values, outline tag vs text style, scale, `ch`, responsive pass: skill `figma-design-to-code`.
- Text `max-width`: the project's CSS rules on text width (override).
- Breakpoint mixins: skill `responsive-layout`.
- SCSS nesting: the project's CSS rules (override).
- Normalize already zeros tag margins: the project's reset (override). This stylesheet puts the gaps back (grammar below).
- Sized list marker: skill `figma-design-to-code`, `references/list-markers.md`.
- Hint control inside a heading: skill `aria-patterns`, `references/tooltip.md`.
- Prove the route: skill `verify-ui` (iterate vs Done). Layout-proof frame scope: below.

## Frame scope (layout-proof)

Full-page legal / CMS text (privacy, terms): use the **outer page frame** at each breakpoint (the artboard that sets viewport width). Put Form, Footer, header, and other chrome direct children in `skip` with a reason. Do not point `frameId` at the inner content/text group — its width is not the page width and laptop styles fire under a desktop artboard.

Block-only WYSIWYG (a section inside a larger page): `frameId` is that section's frame; site chrome stays out of the manifest.

## Steps

1. Measure the **outer page frame** (or the block frame — see Frame scope) with `figma-design-to-code`. For each CMS tag, pick the typography placeholder (override) and record gap px plus that tag's font-size px at the same breakpoint.
   Done when every tag has a placeholder and a px pair.

2. Put the editor document in one HTML string of bare tags in the wysiwyg root (override).
   Done when CMS tags in the string have no classes.

3. Add tag rules with the grammar below, inside the existing wysiwyg block.
   Done when every tag in the string has a tag rule or shares a grouped one, and the project's stylelint (override) exits 0 on the wysiwyg stylesheet.

## Grammar

Tag rules sit in the project's nested-tag disable (override) when the linter forbids tag selectors.

**Tag rule.** Selector is `tag:not([class])`. Tags that share declarations form one group. `@extend` the placeholder from step 1.

**Vertical rhythm.** Inside the tag rule, `&:not(:first-child)` sets `margin-top` and `&:not(:last-child)` sets `margin-bottom`. Value: `calc(<gap-px> / <font-size-px> * 1em)`. The denominator is that placeholder's font-size at the breakpoint.

**Empty paragraph.** `p:empty { display: none; }`.
