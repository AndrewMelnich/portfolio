# Monorepo

Read `ROLE.md` at the repo root if it exists. First line is the local role: `frontend` or `backend`.

- `frontend` → [`frontend/AGENTS.md`](frontend/AGENTS.md).
- `backend` → `backend/AGENTS.md`.
- Missing → follow files in context. Do not assume a role.

## Project passport

Before a task, read [`docs/project.md`](docs/project.md): external ids — Figma page roles, Planfix, environments, Rollbar. Repo-local tools (Storybook, CMS) are not in the passport.

- Dynamic data (mockup, task text, Rollbar items): fetch through MCP with the passport ids. Storybook MCP when the process is up — see [`docs/mcp.md`](docs/mcp.md).
- GitLab (MRs, diffs, pipelines, repository files): `glab` CLI, see [`gitlab-glab`](.agents/skills/gitlab-glab/SKILL.md). MCP only for services without a CLI.
- A field the task needs is empty: ask the user and wait. Ids come from the passport or the user only. `нет` means the project does not use it.
- The passport holds links and ids only; tokens stay in environment variables.
- Empty template on a new project: the user runs `/project-init`.
