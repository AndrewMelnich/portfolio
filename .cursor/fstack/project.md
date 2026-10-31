# Portfolio

## Figma file

Which page to open (UI Set, page mockups, motion spec, motion examples): `docs/project.md`.

## Stack

- Astro + React islands, pnpm; app in `frontend/`.
- Issue tracker: GitLab (`glab`). See `frontend/docs/agents/issue-tracker.md`.
- Figma token: `PUBLIC_FIGMA_TOKEN` in `frontend/.env`. File id: `PUBLIC_FIGMA_FILE_ID`.

## Architecture

- FSD; the pages layer is `src/_pages/` (Astro owns `src/pages/` for file-based routes: a thin route imports and renders the `_pages` slice). Imports: `app` → `_pages` → `widgets` → `features` → `entities` → `shared`.
- A page composes sections per `.cursor/rules/frontend/standards/page-sections.mdc`.
- FSD lint: `pnpm lint:fsd` (steiger) from `frontend/`. Style lint: `pnpm lint:css`.

## Styles

- Breakpoint mixins in `frontend/src/app/css/utils/_mixins.scss`, max-width cascade: `laptop` ≤1366 (also matches tablet and mobile), `tablet` ≤1199 (also matches mobile), `mobile` ≤767 (and landscape ≤900px). Desktop CSS (no mixin) starts at 1367px.
- Mixins import: `@use "app/css/utils/mixins" as *;`.
- Token files (`frontend/src/app/css/`): variables `base/_variables.scss`, custom properties `base/_custom-properties.scss`, typography `layout/_typography.scss`, fonts `base/_fonts.scss`, mixins `utils/_mixins.scss`, utilities `layout/_common.scss`, wysiwyg `layout/_wysiwyg.scss`.
- Grid tokens and column mixins: `@include grid-columns(N)`, `@include grid-offset(...)`, function `cols(N)`. Page grid is flex, not CSS grid (`css.mdc`).
- Hover: `@include hover`. Raw `:hover` outside it is the stylelint warning `custom/no-hover`.
- A class selector in a script or test needs the `js-` prefix (`custom/no-class-selector-without-js-prefix`).

## Shared UI

- Components live in `frontend/src/shared/ui/`.

## Fonts

- Declared in `frontend/src/app/css/base/_fonts.scss`. Files under `frontend/public/static/`.

## Rules

- `.cursor/rules/frontend/standards/`: `css.mdc`, `fsd.mdc`, `astro.mdc`, `page-sections.mdc`, `a11y.mdc`, `media-types.mdc`, `api.mdc`, `backend-data.mdc`, `figma-delivery.mdc`.
- Glossary: `frontend/GLOSSARY.md`.
