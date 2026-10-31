## Development

When starting the dev server, use background mode from `frontend/`:

```
astro dev --background
```

Manage with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Agent skills

### Issue tracker

GitLab issues (`glab`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default role strings. See `docs/agents/triage-labels.md`.

### Domain docs

Frontend context: `GLOSSARY.md` + `docs/adr/` in this folder, created lazily. See `docs/agents/domain.md`. Backend is a separate harness.

### Skill homes

- `.agents/skills` — fstack + Matt + cursor-only (единый дом)
- Overrides: `.cursor/fstack/project.md` (+ per-skill `.cursor/fstack/<skill>.md`)
- Kept: project-specific commands under `.cursor/commands/` and hooks under `.cursor/hooks/`

## Fallow

Dead code, duplication, complexity, FSD boundaries. Commands and flags: skill `fallow` (`.agents/skills/fallow`, copy of fallow 3.33.1). Do not guess flags. Rule: `.cursor/rules/frontend/common/fallow.mdc`.

Before commit or PR: `pnpm fallow:audit`. Agents add `--format json --quiet --explain`.

Run from this directory (`frontend/`) via `pnpm exec fallow` (`pnpm fallow:audit`, `pnpm fallow:scan`). Config: `.fallowrc.json`. The repo root has no fallow config. Do not run `fallow init`, `fallow recommend`, or `fallow agent install` there.

`fallow audit` gate is `new-only`. Inherited debt is not a failure. Do not mass-fix the backlog unless asked.

Setup is done: CI `ci/frontend_fallow.yml`, husky pre-commit, Cursor `.cursor/hooks.json` (`afterFileEdit` / `stop`: fallow + `verify-frontend` eslint/stylelint/oxfmt/tsc). Do not use skill `fallow-setup` to re-wire them.
