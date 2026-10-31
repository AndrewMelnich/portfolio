# Layout a typical WYSIWYG text page

Study the Figma mockup and implement the page. Add SCSS in `frontend/src/app/css/layout/_wysiwyg.scss`. Important: markup ONLY semantic HTML tags. All styling goes in `_wysiwyg.scss`.

Read values from Figma first. If a Figma layer has a typography class (e.g. h1, h2, text-l) and the HTML tag differs, `@extend %class-name` in `_wysiwyg.scss` for that tag.

A Figma typography class (`h4`, `text-l`) is visual, not the document outline. Do not use `<h4>` only because the layer is named/styled as h4. Outline: do not skip levels (after h2 comes h3, not h4). Visual h4 on a subheading → tag `h3` or `p` + `@extend %h4`. "Take tags from the mockup" = semantics (`p`, `ul`, `blockquote`), not the text-style name.

Hint button inside a heading: association is required; otherwise place the button next to the heading. Pattern: `.agents/skills/aria-patterns/references/tooltip.md`.

Take tags from the mockup — semantics, not the style name.

The first tag must not have margin-top; the last must not have margin-bottom. All other tags need margins between them so any tag order still works. Compute margins in `em` from the mockup: divide gap px by the element's font-size (e.g. 32px gap / 16px font-size → `2em`).

Layout: `.agents/skills/figma-design-to-code/SKILL.md`. Astro: `.cursor/commands/frontend/create_astro_layout.md`.

## Example

```scss
.wysiwyg {
  h1 {
    @extend %h2;

    &:not(:first-child) {
      margin-top: 1.5em; // margin_px / font_size_px = em
    }

    &:not(:last-child) {
      margin-bottom: 1.5em;
    }
  }

  h2 {
    @extend %h3;

    &:not(:first-child) {
      margin-top: 1.2em;
    }

    &:not(:last-child) {
      margin-bottom: 1.2em;
    }
  }

  p:not([class]) {
    @extend %text-default;

    &:not(:first-child) {
      margin-top: 1em;
    }

    &:not(:last-child) {
      margin-bottom: 1em;
    }
  }
// ...
```
