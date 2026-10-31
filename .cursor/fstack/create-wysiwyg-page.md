# create-wysiwyg-page overrides

- Stylesheet: `frontend/src/app/css/layout/_wysiwyg.scss`. Root: `.wysiwyg`.
- Markup: `<article class="wysiwyg" set:html={sanitizeHtml(html)} />`.
- Placeholders: `frontend/src/app/css/layout/typography-placeholders.scss`.
- Text width, nesting, reset: `.cursor/rules/frontend/standards/css.mdc` — «Ограничение ширины текста», «Вложенность в SCSS», Reset.
- Nested tags: `stylelint-disable custom/no-nested-tag-selectors` with reason `CMS HTML has unclassed tags`. Check from `frontend/`: `pnpm exec stylelint src/app/css/layout/_wysiwyg.scss`.
- Layout-proof: outer page frames in the Plenum UI Set (privacy/legal). Header / form / footer chrome → `skip`. Prove via `verify-ui` iterate vs Done.
