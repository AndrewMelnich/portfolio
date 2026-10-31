---
name: setup-fstack
description: Set up or refresh fstack in a project — detect the frontend stack and write .cursor/fstack/config.json, project.md, features.md, and the check/e2e templates, run setup-matt-pocock-skills, then prove the verify preview launches. Use for /setup-fstack, when a fstack script says the config is missing, or when the stack changed.
disable-model-invocation: true
---

# Setup fstack

Writes the project side of fstack. The contract is `contract.md` next to this file; read it first. Every value below is discovered from the repo, never guessed: a value no file shows gets asked or left out.

## Outcomes

- **ready**: config written, `setup-matt-pocock-skills` done (or already configured), `verify-ui` launch and doctor print `"ok": true`, e2e command green, required prerequisites present.
- **partial**: config written, a named step blocked (build fails, no Playwright, **prerequisites** declined or still missing, **matt-pocock-skills** setup aborted). Say exactly which.

## Steps

1. **App.** Find the `package.json` that owns the frontend (repo root, `frontend/`, or one app in a monorepo such as `apps/web`). A monorepo with several apps: ask which one this config serves. **Done when** `app` is a path from the repo root.

2. **Prerequisites.** Read `prerequisites.md` next to this file. Probe every row for `<app>` (package.json / `node_modules`, MCP `namespaceStatus`, skill directories). Missing **required**: one question listing them all; on yes, run each row's `install` (npm into `<app>` + post-installs such as `playwright install chromium`, or `npx skills add` for skill rows, from the repo root); on no, outcome **partial: prerequisites** and skip Prove. Missing **recommended** or **external**: do not install; keep for the Toolchain reply. Do not add lint tools or plugins the app lacks. Do not edit MCP config. Install foreign skills only when a required catalog row names them. **Done when** every required item is installed or the user declined, and recommended/external statuses are known.

3. **Server.** Read the framework from the app's dependencies and its config file, then fill `verify` from the matching row. The build output dir comes from the framework config when it overrides the default. `{bin}` is the prefix for a package binary, from the lockfile in `<app>`: `pnpm-lock.yaml` → `pnpm exec`, `package-lock.json` → `npm exec --`, `yarn.lock` → `yarn`. `{pm}` in `prerequisites.md` is the package manager name (`pnpm`, `npm`, `yarn`).

   | Framework                     | build                      | serve                                                                    | buildOutput       | sourcePaths                                       |
   | ----------------------------- | -------------------------- | ------------------------------------------------------------------------ | ----------------- | ------------------------------------------------- |
   | Astro                         | `{bin} astro build`        | `{bin} astro preview --host {host} --port {port}`                         | `dist` (`outDir`) | `src`, `public`, `astro.config.*`                 |
   | Next.js                       | `{bin} next build`         | `{bin} next start -H {host} -p {port}`                                    | `.next`           | `src` or `app`/`pages`, `public`, `next.config.*` |
   | Nuxt                          | `{bin} nuxt build`         | `node .output/server/index.mjs` (env `HOST={host}`, `PORT={port}`)       | `.output`         | `app` or root dirs, `public`, `nuxt.config.*`     |
   | Vite SPA (React, Vue, Svelte) | `{bin} vite build`         | `{bin} vite preview --host {host} --port {port} --strictPort`             | `dist`            | `src`, `public`, `index.html`, `vite.config.*`    |
   | SvelteKit                     | `{bin} vite build`         | `{bin} vite preview --host {host} --port {port} --strictPort`             | `.svelte-kit`     | `src`, `static`, `svelte.config.*`                |
   | React Router / Remix          | `{bin} react-router build` | `{bin} react-router-serve build/server/index.js` (env `PORT={port}`)     | `build`           | `app`, `public`, `react-router.config.*`          |

   Env the build needs (`.env`, `.env.example`, CI env steps) goes into `verify.env` with `{url}` for the site's own origin. Port: the `PORT` value in the app `.env` (or `.env.example` when `.env` is absent), or the variable the framework serve script already reads. Write that number to `verify.port`. Do not invent a port and do not write a literal port into `verify.serve`, `verify.prepare`, or a copied template. Commands use `{port}`, `{host}`, `{url}`, and `{dataDir}`. When the app has a database, migrations, or seeds, set `verify.prepare` to the commands that empty that database, migrate, and seed, with the database URL taken from `.env`. Set `verify.dataDir` only when the empty state is a directory inside the app; launch deletes and recreates it before `verify.prepare`. Omit both keys when the app has no database. `readyText`: a string the seeded home page always renders (site name in the title or logo label). Ready means usable, not that a process answers. A database health check can pass while init scripts are still running, so `readyText` is page content, not a health route. `appReady`: the expression that turns true when a preloader, intro, or hydration gate lets go; omit it when the app has none. **Done when** each `verify` key cites the file it came from, and any port value is the one from `.env`.

4. **Viewports.** Read the breakpoint mixins or tokens (SCSS, CSS custom media, Tailwind `screens`). One named viewport inside each band; `isMobile`, `hasTouch`, `deviceScaleFactor` on touch bands. `overflowWidths`: one width just inside each band edge, plus 375. **Done when** each viewport name matches a breakpoint name in the code.

5. **Checks.** Prefer the project's own changed-files lint/test script as `checks.onStop`. None: copy `templates/scripts/verify-files.sh` and `verify-changed.sh` (next to this file) into `<app>/scripts/`, set `checks.onStop` to `bash scripts/verify-changed.sh`, set `TYPECHECK` for Vue (`vue-tsc --noEmit`), Svelte (`svelte-check`), or Astro (`astro check`) in the commands. `verify-ui` runs that command once at Done, from `config.app`, because its Done section says to. Cursor `.cursor/hooks.json` and Claude `.claude/settings.json` are host hooks for every turn; this install only copies `.agents/skills/`. If the app has ESLint, read the `no-comments` skill (Lint), ask before adding those rules, and add a rule only when it is missing, its plugin is already a dependency, and the project's lint script still exits 0 with it on. Skip and name any rule that would go red on the current tree. Do not add a new plugin. **Done when** `checks.onStop` exits 0 on a clean tree, and those ESLint rules are present, skipped with a reason, or the user declined.

6. **E2E.** Existing Playwright e2e: point `e2e.dir` and `e2e.command` at it, and switch its config's `baseURL` to the verify origin (see `templates/playwright.e2e.config.ts` next to this file, which reads `config.json`). None: copy `templates/playwright.e2e.config.ts`, `templates/e2e-app.ts` as `<e2e.dir>/app.ts`, and `templates/smoke.spec.ts` with every public route; add `"test:e2e": "playwright test -c playwright.e2e.config.ts"`; install `@playwright/test` if Prerequisites did not already. **Done when** the e2e command runs.

7. **Project facts.** Write `.cursor/fstack/project.md` with the headings from `contract.md` (Stack, Architecture, Styles, Shared UI, Fonts, Rules), each fact pointing at a path. A convention that differs from the defaults (FSD, SCSS + BEM) is stated there. Existing `.cursor/fstack/*.md`: merge, never overwrite. Do not put the Toolchain list in `project.md`. **Done when** every heading has facts with paths, or says "none".

8. **Feature map.** Write `.cursor/fstack/features.md` (format in `maintain-verify-ui`) with one row per existing spec. If seed or fixture data lacks a precondition a journey needs, the spec reports a failure and the reason goes in that feature's gotchas. Never weaken the journey to make it pass. **Done when** every spec file has a row.

9. **Ignore.** Add `.cursor/fstack/artifacts/` to `.gitignore`. Leave `test-results/` and `playwright-report/` ignored too.

10. **CI.** Ask before adding `templates/github-frontend-check.yml` (next to this file); it replaces `APP_DIR` and gains the project's setup steps (env files, codegen).

11. **Matt Pocock skills.** Read and follow `setup-matt-pocock-skills` (same install tree as this skill). Skip only when `docs/agents/issue-tracker.md` already exists and the user did not ask to reconfigure. If that skill is missing, stop with **partial: prerequisites** (`mattpocock-skills`). If the user aborts its questions, **partial: matt-pocock-skills**. **Done when** that skill's Done step is satisfied, or the skip condition holds.

12. **Prove.** If required prerequisites are still missing, stop with **partial: prerequisites** — do not mask that as a launch error. Otherwise: `verify-ui` launch, doctor (`"ok": true`), console-check on `/`, the e2e command. Launch has to reach a usable app from an empty data dir (migrations and seeds included when the app has them). Doctor green on a port that merely answers is not proof. Then `verify-ui` cleanup. If you proved it in a stand-in for the real target (a container in place of a VM, a local stack in place of a remote one), list every setup step the stand-in did that the target will not. Those steps stay unverified until a run on the real target covers them.
