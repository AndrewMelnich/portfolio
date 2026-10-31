# figma-scale overrides

- Token blocks in `frontend/src/app/css/base/_variables.scss`: `@tokens` comments. Palette primitives in `@tokens ColorPalette`, semantic aliases in `@tokens Colors`. Also `@tokens Fonts`, `@tokens Easings`, `@tokens Others`.
- Body color `$body-color` and family `$font-family` are set in `layout/_common.scss`. Do not restate them on every component.
- Typography placeholder in this repo: `%text-default` in `layout/_typography.scss`. Do not invent `%title-*` / `%txt-*` names.
- Rebuild command: `.cursor/commands/frontend/create_typography_from_figma.md`. Fluid size: `@include responsive-font-size($min, $max, $min-viewport, $max-viewport)` in `utils/_mixins.scss`.
- No global `$app-border-radius` / `--app-border-radius` in this tree.
