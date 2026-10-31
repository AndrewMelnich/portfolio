---
name: responsive-layout
description: >-
  Rules for writing adaptive SCSS with the project's breakpoint mixins (e.g. laptop/tablet/mobile).
  Use when adding or editing responsive styles, media-query overrides, @include <breakpoint>,
  Figma multi-breakpoint layouts, or cleaning duplicate properties across breakpoints.
paths:
  - "frontend/**/*"
---

# Responsive layout

Project overrides: read `.cursor/fstack/project.md` and `.cursor/fstack/responsive-layout.md` from the repo root when present; they win over this file.

Use the project's breakpoint mixins (`project.md`, Styles): their names, widths, and the file they live in. By default they are **max-width** cascades, for example:

| Mixin    | Query                | Also matches    |
| -------- | -------------------- | --------------- |
| `laptop` | ≤ laptop width       | tablet + mobile |
| `tablet` | ≤ tablet width       | mobile          |
| `mobile` | ≤ mobile width       | —               |

Narrower viewport → **all wider mixins still apply**. Cascade: base → widest mixin → … → narrowest mixin.

A project without SCSS mixins (CSS media queries, container queries, a utility framework's breakpoint prefixes) maps the same rules to its own breakpoint mechanism: every rule below speaks of a band that still matches a narrower viewport.

## No duplicate values

**Do not** restate a property in a narrower breakpoint if the value is already set by a wider one that still matches.

```scss
// ❌ tablet repeats laptop
@include laptop {
  margin-bottom: 40px;
}

@include tablet {
  margin-bottom: 40px; // noop — laptop already applied
  padding-inline: 0;
}

// ✅ only what changes
@include laptop {
  margin-bottom: 40px;
}

@include tablet {
  padding-inline: 0;
}
```

Same for near-identical Figma noise (`54.18%` vs `54.17%`) — one value, drop the clone.

## When restating is required

Restate only to **override** a wider breakpoint (or base after a mid-tier change):

```scss
// base 80 → laptop 40 → tablet must reset to 80 (overrides laptop)
padding-bottom: 80px;

@include laptop {
  padding-bottom: 40px;
}

@include tablet {
  padding-bottom: 80px; // needed
}

@include mobile {
  padding-bottom: 40px; // needed — overrides tablet
}
```

Checklist before adding a prop in a narrower mixin (`@include tablet` / `@include mobile`):

1. Same value already in base / a wider mixin that still matches this viewport? → **omit**.
2. Wider mixin set a _different_ value and this breakpoint needs the old or a new one? → **write**.
3. Property first appears at this breakpoint? → **write**.

## Placement

- Put overrides **inside** the BEM block that owns the property (the project's style rules, `project.md` Rules).
- Order mixins wide → narrow (`laptop` → `tablet` → `mobile`).
- Prefer project tokens / global custom properties (`project.md`, Styles) when Figma matches globals; don't hardcode the same token value again in a breakpoint.
