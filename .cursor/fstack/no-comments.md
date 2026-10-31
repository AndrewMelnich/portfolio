# no-comments (this repo)

Wins over `.agents/skills/no-comments` for this project.

Always-on rule: `.cursor/rules/no-code-comments.mdc`. Skill home: `.agents/skills/no-code-comments`.

Same allowed list as that rule. Extra directives here: `fallow-ignore-next-line` with a reason on the same line; Steiger `rules: 'off'` with a reason naming why the slice cannot move. JSDoc on `.mjs` public exports is the type contract for `tsc` — keep `@typedef` / `@param` / `@returns` / `@type`. Keep existing `TODO` / `FIXME`. Skip `frontend/src/app/css/base/_normalize.scss` (MIT Bootstrap Reboot fork).

Comment removal is JS/TS only. Leave `*.sh` and other non-JS/TS files untouched. Leave `${var#pattern}`, `${var##pattern}`, and `${#var}` whole — that `#` is a shell parameter expansion, not a comment.
