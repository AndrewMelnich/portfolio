# figma-design-to-code overrides

## Scripts

- Snapshot: `pnpm figma:snapshot -- path/to/Block.figma.mcp.yml`. Css-tree: `pnpm figma:css-tree -- --url <url> --selector .block --snapshot path/to/Block.figma.yml --frame desktop`. Run from `frontend/`.
- Changes since a date: `pnpm figma:diff -- --since YYYY-MM-DD <figma-frame-or-page-url>` before implementing. Skill `.agents/skills/figma-diff`. `--visual` writes a red-highlight screenshot under `.figma-diff-cache/visual/`.
- Scaffold: `pnpm mkac Name --section --dir …`.

## Layout grid

- Page column grid is flex (`css.mdc`): `cols()` / `grid-columns` / `grid-offset` in `app/css/utils/_mixins.scss`. Do not implement that grid with `display: grid`.
- This boilerplate has no `.grid-lockup` / `.grid-half` utilities.

## Media frames

- Cover/clip boxes (`__clip` / `__media` / `__picture`): `aspect-ratio: W / H`. Fixed `height` only with ratio and `width: auto` / omitted. Enforced by Stylelint `custom/no-fixed-media-height`.
