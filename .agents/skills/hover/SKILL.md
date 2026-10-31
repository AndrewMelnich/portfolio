---
name: hover
description: >
  Hover states for interactive controls.
  Use when adding or editing the hover state of a link, button, chip, card,
  or icon button, including a Figma section that has no hover frame.
paths:
  - "frontend/**/*"
---

# Hover

Project overrides: read `.cursor/fstack/project.md` and `.cursor/fstack/hover.md` from the repo root when present; they win over this file.

Every interactive control gets a hover. A rest-only link, button, or chip is unfinished. A Figma frame with no hover variant still gets one.

A link or a chip changes `color` and `background-color`. `transform` on a link or a chip only when a control of that same kind in this repo already moves on hover. A card may scale when a sibling card already scales.

## Mixin

The project's hover mixin (`project.md`, Styles) — by default an SCSS `@mixin hover`. It emits `@media (any-hover: hover), (hover: hover) and (pointer: fine)` and `&:not(:disabled):hover`. Touch never sees the rule, so the state does not stick. A project without that mixin writes the same media query and selector by hand, or in its own styling mechanism.

```scss
@use "<project mixins module>" as *;

.block__link {
  transition: color $transition-duration $transition-easing; // the project's motion tokens

  @include hover {
    color: $accent;
  }

  &:active,
  &:focus-visible {
    color: $accent;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
```

`:active` and `:focus-visible` repeat the hover declarations. `prefers-reduced-motion` sits next to `transition` and only drops the animation. The color change stays.

## Rules

- Write `@include hover { … }` on the control you added: `a`, `button`, chip, card hit area, icon button.
- Name the properties that change in `transition` on that element. For a link or a chip those properties are `color` and `background-color`.
- Nest the mixin under the BEM selector. A parent `@include hover` may target a child (`.product-card` reveals `.product-card__fav`).
- Raw `&:hover` outside that media query breaks the convention. When the project lints it (`project.md`, Styles names the rule), do not silence the rule.

**Done when:** each new interactive control has `@include hover` and the same declarations on `:active, :focus-visible`. A link or chip hover sets `color` and `background-color`. `transform` is copied from a same-kind control that already moves.
