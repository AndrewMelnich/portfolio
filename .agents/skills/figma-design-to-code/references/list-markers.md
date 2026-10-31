# Custom list markers (Figma)

When the mockup shows a **sized filled disc** (or other non-default bullet): measure it. Do not guess `list-style-type: disc|circle|'-'`. Framelink often exports list lines as `"  - …"` — that string is not the visual marker.

## Steps

1. Export the list text frame (`download_figma_images`, PNG) and measure **diameter** and **gap** marker → text.
2. `list-style: none` on `ul`; marker = `li::before` (size/offset from measure).
3. First-line vertical center: `top: 0.5em` (fallback) → `top: 0.5lh` + `transform: translateY(-50%)`. `lh` is not universal; keep the `em` line above it.

## Pattern

```scss
ul:not([class]) {
  list-style: none;

  > li {
    position: relative;

    &::before {
      content: "";
      position: absolute;
      top: 0.5em;
      top: 0.5lh;
      left: /* −(diameter + gap) from measure */;
      width: /* diameter px */;
      height: /* diameter px */;
      border-radius: 50%;
      background-color: currentColor;
      transform: translateY(-50%);
    }
  }
}
```

Wysiwyg canon: the project's wysiwyg stylesheet (override), when it has one.

UI lists with **no** bullets → the project's unstyled-list utility (override), not this pattern.
