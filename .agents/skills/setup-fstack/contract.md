# Project config

fstack skills and scripts carry no project facts. Each project supplies them in `.cursor/fstack/` at the repo root. `/setup-fstack` writes the first version.

## Prerequisites

`/setup-fstack` probes the catalog in `prerequisites.md` next to this skill (npm packages in `<app>`, MCP namespaces, skills, host CLIs). **required** items install only after the user agrees, using each row's `install` command (app `devDependencies` + post-install such as Playwright Chromium, or `npx skills add` for skill deps like `mattpocock-skills`). **recommended** and **external** items are reported only — never auto-installed, and never written into `config.json` or `project.md`. After the fstack project files are in place, `/setup-fstack` runs `/setup-matt-pocock-skills` (issue tracker, triage labels, domain docs under `docs/agents/`) unless that setup already exists. The closing reply always includes a Toolchain checklist from that probe.

```
.cursor/fstack/
  config.json        machine settings: scripts read these
  project.md         project facts several skills share (stack, conventions, paths)
  features.md        e2e feature map: behavior → spec (verify-ui, maintain-verify-ui)
  <skill-name>.md    per-skill overrides, read by that skill only
  artifacts/         verify evidence (gitignored)
```

## Precedence

A skill reads, in order: its own `SKILL.md`, then `.cursor/fstack/project.md`, then `.cursor/fstack/<skill-name>.md`. Later wins where they conflict. A missing file is fine.

## Defaults the skills assume

Unless `project.md` says otherwise, skills assume:

- **Architecture: Feature-Sliced Design.** Layers `app → pages → widgets → features → entities → shared`, imports only downward, a slice's public API is its `index`. `project.md` names the actual layer folders (for example `_pages` when the framework owns `pages`).
- **Styles: SCSS with BEM.** One block per component, breakpoint mixins instead of raw media queries, design tokens as variables. `project.md` names the mixins and their widths, and where tokens live.
- **Component format: whatever the framework uses** (`.astro`, `.tsx`, `.vue`, `.svelte`). Skills say "component" and "markup"; `project.md` names the framework.
- **Comments: the `no-comments` skill.** No narration or workaround comments. A different allowed list goes in `.cursor/fstack/no-comments.md`.
- **Pre-commit code cleanup: the `deslop` skill.** Strip AI code slop from the diff before commit. Prose cleanup is `unslop`.

## `project.md`

Free-form Markdown. Facts a skill cannot discover cheaply, each under a heading:

- **Stack.** Framework, rendering mode, package manager, where the app lives.
- **Architecture.** Layer folders, where a new section or shared control goes, the rule files that enforce it.
- **Styles.** Breakpoint mixins and widths, token files, click-target mixin, hover convention.
- **Shared UI.** Where reusable controls live and how to find one before building a new one.
- **Fonts.** Font files, for measuring text (`ch`).
- **Rules.** Paths to the project's own rule files that skills should follow (`.cursor/rules/...`). Comment policy is the `no-comments` skill unless `.cursor/fstack/no-comments.md` overrides it.

## `config.json`

`{bin}` prefixes a package binary (`pnpm exec`, `npm exec --`, or `yarn`, from `pnpm-lock.yaml`, `package-lock.json`, or `yarn.lock` in `app`). `{run}` prefixes a package script (`pnpm run`, `npm run`, or `yarn run`). The `port` number in the example is only the shape of the field. Setup writes the `PORT` value from the app `.env`.

```json
{
  "app": "frontend",
  "verify": {
    "build": "{bin} astro build",
    "buildOutput": "build",
    "serve": "{bin} astro preview --host {host} --port {port}",
    "host": "127.0.0.1",
    "port": 4317,
    "readyText": "My Site",
    "appReady": "!document.querySelector('.js-preloader') || document.querySelector('.js-preloader').hidden",
    "sourcePaths": ["src", "public", "astro.config.ts"],
    "sourceExclude": ["src/**/*.test.*", "**/*.md"],
    "env": { "PUBLIC_SITE_URL": "{url}" }
  },
  "viewports": {
    "desktop": { "width": 1440, "height": 900 },
    "laptop": { "width": 1280, "height": 800 },
    "tablet": {
      "width": 834,
      "height": 1194,
      "isMobile": true,
      "hasTouch": true,
      "deviceScaleFactor": 2
    },
    "mobile": {
      "width": 390,
      "height": 844,
      "isMobile": true,
      "hasTouch": true,
      "deviceScaleFactor": 3
    }
  },
  "defaultViewport": "laptop",
  "overflowWidths": [1440, 1199, 908, 767, 375],
  "checks": {
    "onStop": "bash scripts/verify-changed.sh"
  },
  "e2e": {
    "dir": "tests/e2e",
    "command": "{run} test:e2e"
  }
}
```

| Key                                          | Used by                           | Meaning                                                                                                                                               |
| -------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app`                                        | everything                        | Directory (from repo root) with the app's `package.json`. Playwright and sharp resolve from here; commands run here. `"."` for a single-package repo. |
| `verify.build`                               | `control launch`                  | Production build command.                                                                                                                             |
| `verify.buildOutput`                         | `control launch --skip-build`     | Build output directory (relative to `app`); its absence forces a build.                                                                               |
| `verify.serve`                               | `control launch`                  | Serves the build. `{host}`, `{port}`, `{url}`, and `{dataDir}` are substituted. Must not be the dev server the developer runs. Never a literal port. |
| `verify.prepare`                             | `control launch`, e2e `webServer` | Migrations and seeds, run after `verify.dataDir` is emptied and before build. Omit when the app has no database. The database URL comes from the app `.env`. |
| `verify.dataDir`                             | `control launch`, e2e `webServer` | Directory inside the app that launch deletes and recreates so prepare starts empty. Omit when the empty state is not a directory.                     |
| `verify.env`                                 | `control launch`, e2e `webServer` | Extra env for prepare, build, and serve; values take the same placeholders. The app `.env` is loaded first.                                           |
| `verify.host`, `verify.port`                 | all verify scripts                | Verify origin. `verify.port` is the `PORT` value from the app `.env` (or the variable the serve script already reads). Scripts have no default port. |
| `verify.readyText`                           | `control launch`, `doctor`        | Text the seeded home page contains. A process that answers is not enough. A database health check is not this text.                                  |
| `verify.appReady`                            | every `goto`                      | JS expression polled after navigation until truthy (preloader gone, hydration done). Omit when the app has nothing to wait for.                       |
| `verify.sourcePaths`, `verify.sourceExclude` | `doctor` stale check              | Inputs of the build, relative to `app`; a change marks the running preview stale.                                                                     |
| `viewports`                                  | `--viewport NAME`                 | Named viewports, one inside each breakpoint band. Any Playwright context option is allowed.                                                           |
| `defaultViewport`                            | browser steps                     | Viewport when none is passed.                                                                                                                         |
| `overflowWidths`                             | `overflow-check`                  | Widths probed for horizontal overflow, one near each breakpoint edge.                                                                                 |
| `checks.onStop`                              | verify-ui Done                    | Shell command `verify-ui` runs once from `config.app` at Done, after the last source edit, because that skill says to. Omit the key to skip. Host stop hooks are not part of this install. |
| `e2e.dir`, `e2e.command`                     | verify skill, CI template         | Where regression specs live and how to run them.                                                                                                      |

## Templates

`templates/` next to this skill holds starting points `setup-fstack` copies when the project has none:

| Template                    | Copy to                  | Role                                                                                                                                                 |
| --------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/verify-files.sh`   | `<app>/scripts/`         | Format + lint given files; called by `verify-changed.sh`. Skips tools the app lacks. `TYPECHECK` env picks `vue-tsc`, `svelte-check`, `astro check`. |
| `scripts/verify-changed.sh` | `<app>/scripts/`         | Lint/typecheck on git-changed files, then `vitest related` and `steiger` when installed. Wired as `checks.onStop`.                                   |
| `playwright.e2e.config.ts`  | `<app>/`                 | Reads `config.json`; reuses the running verify preview locally, and in CI empties data, prepares, builds, and serves (`webServer`).                  |
| `e2e-app.ts`                | `<app>/<e2e.dir>/app.ts` | `openRoute` (waits on `verify.appReady`), `collectErrors`, `verifyServer` (port from `.env`, empty data dir, prepare).                                |
| `smoke.spec.ts`             | `<app>/<e2e.dir>/`       | Every route renders without console errors.                                                                                                          |
| `github-frontend-check.yml` | `.github/workflows/`     | Install, lint, unit, e2e; no plugin needed in CI.                                                                                                    |
