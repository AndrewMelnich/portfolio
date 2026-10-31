# Coding standards

Do not copy rules here. Reviewer reads the files below.

## Frontend standards

- [a11y](../.cursor/rules/frontend/standards/a11y.mdc) — carousel, skip-link
- [api](../.cursor/rules/frontend/standards/api.mdc) — SSR vs `/nextapi`, `Api*` / `App*`
- [astro](../.cursor/rules/frontend/standards/astro.mdc) — Astro props / `RawProps`
- [figma-delivery](../.cursor/rules/frontend/standards/figma-delivery.mdc) — Figma-scoped change
- [page-sections](../.cursor/rules/frontend/standards/page-sections.mdc) — page = sections, transformer → `*RawProps`
- [backend-data](../.cursor/rules/frontend/standards/backend-data.mdc) — do not sanitize CMS/API garbage on the client
- [css](../.cursor/rules/frontend/standards/css.mdc) — BEM, page grid = flex, `ch` for text max-width, `text-box-trim`, motion on wrapper around shared UI
- [fsd](../.cursor/rules/frontend/standards/fsd.mdc) — FSD layout in this repo (`_pages`, public API); steiger `off` needs a reason on the disable
- [no-code-comments](../.cursor/rules/no-code-comments.mdc) — self-explaining source; skill `no-code-comments`
- [media-types](../.cursor/rules/frontend/standards/media-types.mdc) — `ImageShape` / `VideoShape` / `AudioShape`
- [canvas-world](../.cursor/rules/frontend/standards/canvas-world.mdc) — World / canvas scene / curtain
- [project-specific](../.cursor/rules/frontend/standards/project-specific.mdc) — portfolio Astro conventions
- [no-backend](../.cursor/rules/frontend/common/no-backend.mdc) — do not edit `backend/`
- [laziness-protocol](../.cursor/rules/frontend/common/laziness-protocol.mdc) — shortest working diff (skill: `principle-laziness-protocol`)

Workflow for a new API endpoint: `../.cursor/skills/backend-api-integration`.
