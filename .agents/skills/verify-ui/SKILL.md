---
name: verify-ui
description: "Prove frontend work in a real browser as a visitor: drive routes and controls, catch console errors and overflow, detect animation blinks and jumps, judge a visual before/after. Runs from /ui-mode (its Proof section and playbooks) or when the user asks for a browser check of a route, popup, form, catalog, or animation. Recipes per feature: .cursor/fstack/features.md."
disable-model-invocation: true
---

# Verify UI

Project overrides: read `.cursor/fstack/project.md` and `.cursor/fstack/verify-ui.md` from the repo root when present; they win over this file.

The agent proves its own work in a real browser. Proof runs on an isolated verify origin that this skill's scripts start from `.cursor/fstack/config.json` (build command, serve command, host, port, ready marker, viewports). The developer's dev server belongs to them: opening or screenshotting it is fine; its process lifecycle (start, restart, kill, port) stays theirs.

Scripts live in this skill's `scripts/` directory. Run them with cwd anywhere inside the project; they find the repo root through git and resolve Playwright and sharp from the app's own `node_modules` (`config.app`). Below, `$CTRL` stands for `node <this skill's directory>/scripts/control.mjs`.

The only allowed verify server is the one `$CTRL launch` starts. If the config is missing, run the `setup-fstack` skill; do not hand-roll a parallel server or harness.

## Launch

```bash
$CTRL launch                # empty verify.dataDir, verify.prepare, verify.build, then verify.serve
$CTRL launch --skip-build   # reuse the last build while the source is unchanged; still resets data and runs prepare
$CTRL relaunch              # cleanup + launch (same flags). Prefer this over hand-rolled cleanup then launch
```

Ready means the app is usable, not that a process answers. Launch starts from an empty data dir: it removes `verify.dataDir` when that key is set, runs `verify.prepare` (migrations and seeds), then serves. `GET /` is 200 and the body contains `verify.readyText` from the seeded page. A database health check is not readiness: it can pass while init scripts are still running. The port is `PORT` from the app `.env`, or `verify.port` when setup copied that value. Commands use `{port}`. There is no default port. A linked git worktree gets its own verify port, derived from its path inside 4500–4799; the main checkout keeps `verify.port`. Ports come from `control`; do not pick one by hand. If the app has migrations or seeds and `verify.prepare` is missing, stop and run `setup-fstack`. **Done when** `$CTRL doctor` prints `"ok": true`. Doctor hashes `verify.sourcePaths` and compares it with the build: `"stale": true` means the preview serves old code (`ok` goes false), and `launch --skip-build` refuses on stale source. After a source edit that the preview must reflect: `$CTRL relaunch` (full build). Port busy or orphan with no meta: `$CTRL cleanup`, then `launch`.

If launch fails (dependencies, Node version, port busy, build error), fix it or report it precisely. The dev server is never the fallback.

## Iteration servers

The dev server and Storybook start, report and stop through one command per kind. Never write your own launch, kill or wait logic, and never `kill -9`:

```bash
$CTRL up dev [--path /team/]                    # astro dev; reuses a healthy server on the port
$CTRL up storybook [--stories "<glob>[,<glob>]"] # globs relative to the app root; one story starts fastest
$CTRL up preview                                # verify.serve on the verify port, no build
$CTRL status dev                                # JSON: running, pid, port, url, healthy, log; exit 1 unless healthy
$CTRL down dev                                  # kills the whole process group; exit 0 when nothing runs
```

`up` spawns the server detached in its own process group, so it outlives the shell that started it. It writes `<kind>.pid` and `<kind>.log` under `.cursor/fstack/artifacts/servers/` (read the log by that path), waits until the server answers 200 (dev, preview: `--path`, default `/`; Storybook: `/index.json`), then prints JSON with the `url`. On an early exit or after `--timeout` seconds (default 120) it exits 1 with the log tail and leaves no process behind. A second `up` on a healthy server is a no-op. A port held by something else is never killed: `up` exits 1 and names the port. A healthy server whose process runs from another checkout counts as something else; one from this checkout is reused. Ports: dev 4321 (worktree 5100–5399, `FSTACK_DEV_PORT`), Storybook 6006 (worktree 6500–6799, `FSTACK_STORYBOOK_PORT`), preview is the verify port. `up storybook` skips the MCP addon in a linked worktree. A page section proves on `$CTRL up dev --path /<page>/`; Storybook is a component showcase, outside the page pipeline, and records no receipt entry.

A machine-wide slot pool caps heavy processes across all worktrees. A slot is held only while Chromium or a build runs: `launch` and `relaunch` hold one for the prepare and build step (not for the preview they leave running), and `layout-proof`, `token-check`, `visual-compare`, `motion-probe`, `console-check` and `overflow-check` hold one per invocation (a `layout-proof` run over several manifests is one). `up`, `down` and `status` never take a slot, so an idle dev server holds none. At the cap the command waits and prints `queue position N` and the holders on stderr, repeated every 15 s (`FSTACK_SLOT_HEARTBEAT_MS`); it does not fail, so wait for it. Run a proof unpiped, with output to a file (`> out.txt 2>&1`): a `| tail` holds the queue line back until the process exits, and a waiting proof then looks hung. `control holders` shows who holds a slot; a stuck process is ended by its pid, and `release-foreign` always carries an `--allow` for every checkout of the fan-out, because a bare call stops the siblings' proofs. A slot is released when the script exits, and the death of its process releases it too. `control --help` shows both caps, their defaults and overrides, and the pool directory: `Slots now:` is the heavy cap (`FSTACK_MAX_HEAVY`), `Implementer cap now:` is how many Section implementers a page fan-out runs at once (`FSTACK_MAX_IMPLEMENTERS`). The defaults are derived from measured peak memory: [slot-sizing.md](slot-sizing.md). A direct `pnpm build` or `pnpm storybook` is not gated: start them only through `control`.

## Doctor

```bash
$CTRL doctor
```

Requires: meta present, pid alive, `GET {url}/` is 200, body has `verify.readyText` (seeded page, not a process answering and not a database health check), build not stale. Run it before the first drive and again after any failed drive. It prints the verify origin; every other script defaults to that origin, so pass paths (`/about/`) rather than URLs.

**User origin.** The developer reports a stale view or a bug "on my side": run `$CTRL doctor --user-origin <url>` first, before any drive. It fetches `/` on both `localhost` and `127.0.0.1` at that port, compares each page's `<meta name="fstack-source-stamp">` with the current source stamp, and prints the listening PIDs. `"stale": true` (or a page without the stamp) means that origin serves an older build: tell the developer to restart their dev server or rebuild it, and never kill their process. An `astro dev` server stamps `dev:<checkout path>` instead, because HMR serves live source: there `"mode": "dev"` and `stale` means it serves another checkout (another worktree), named in the message. If the origin is fresh and the bug is dev-only, check its console on their URL: `VERIFY_BASE_URL=<url> node <this skill's directory>/scripts/console-check.mjs /<path>/`. Proof still runs on the verify origin.

## Drive

Playwright, one fresh browser per command; `flow` keeps one session for multi-step UI (menus, dialogs). Prefer ARIA roles and accessible names over CSS selectors and coordinates. After every `goto` the harness polls `verify.appReady` (preloader gone, hydration done).

Context flags go before the step: `--viewport <name from config.viewports>|WxH` (default `config.defaultViewport`), `--motion` (real animation, see Motion), `--engine webkit|firefox`, `--device "<Playwright device>"`. Steps: `goto`, `click`, `hover`, `leave` (moves the pointer off the bottom-right corner, the other half of a hover), `fill`, `press`, `scroll`, `wait`, `snapshot`, `screenshot [--selector S] [--full]`, `eval`. Flags per step: run `$CTRL` with no arguments.

```bash
A=.cursor/fstack/artifacts/<feature>
$CTRL browser goto /
$CTRL browser --viewport 375 screenshot --path $A/home-mobile.png --full
$CTRL browser flow <<'EOF'
goto /contacts/
click --role button --name "Send request"
snapshot --aria --path .cursor/fstack/artifacts/contacts/form-open.aria.txt
screenshot --path .cursor/fstack/artifacts/contacts/form-open.png
EOF
```

## Feature map

`.cursor/fstack/features.md` in the project indexes each user-facing behavior against the recipe the agent drives in the browser. Pick the recipes the change can touch from your diff, drive them, and name the driven and the skipped ones with a reason. A red recipe changes the product or gets reported. If seed or fixture data lacks a precondition a journey needs, report the unmet precondition. Never weaken the journey to make it pass. The `maintain-verify-ui` skill finds gaps.

## Motion

The harness defaults to `reducedMotion: 'reduce'`, which proves the instant path only; `--motion` switches to `no-preference`.

Chromium runs in new headless (`channel: 'chromium'`) on the GPU. The old headless shell renders WebGL in SwiftShader at a few fps, which hides and fakes frame-level bugs; every script here uses the GPU channel.

A change to animation, scroll-linked UI, hover motion, or a WebGL/canvas surface runs the motion probe on the element that moves:

```bash
node <this skill's directory>/scripts/motion-probe.mjs --viewport 375 \
  --target '.js-accordion-trigger' --out .cursor/fstack/artifacts/<feature>/motion <<'EOF'
goto /faq/
record
scroll --selector .js-scroll-panel --by 16 --repeat 120
EOF
```

A diff that adds motion (transition, animation, keyframes, `animation-timeline`, `view-timeline`, `@property`, `requestAnimationFrame`, `ScrollTimeline`, or a scroll listener) needs this probe on the element that moves before Done (see Receipt).

Steps before `record` set the scene; steps after it are recorded. The probe watches every element matching `--target` in two ways: screencast pixels per element (a blink is a crop that changes and comes back within 1–3 frames; Chromium only) and a rAF DOM sampler. The DOM sampler fails on:

- **blink**: visible area (through opacity and clip-path, minus fixed or sticky occluders) drops and comes back.
- **jump**: position in viewport or document coordinates (scroll-corrected, so a transform that the page's own scroll cancels is no motion), or visible area, moves by more than the element's typical step. A stall (a step smaller than the motion around it) is not a jump.
- **kink**: the per-frame speed changes by 3× or more between adjacent 6-frame windows, both at least 4px per frame (a hard stop or a snap into motion).
- **clip**: more than 10% of an on-screen element is hidden by an `overflow` ancestor.
- **occlusion**: more than 10% of an on-screen element is covered by a fixed or sticky element (`elementFromPoint` grid).

Further checks are opt-in per flow:

- `--prop <name>` (repeatable) samples a computed style or custom property; `--expect monotonic,linear` (default both) checks it against the window's scroll position.
- `record-range --track <selector>` records like `record` and fails when less than 90% of the track's scroll range was recorded (scroll-scrubbed UI).
- `--compare <selector>` samples a reference element in the same recording and fails when the target's progress along its move differs from the reference's by more than 10% at any of ten normalized steps. Use it when an element must move like another one (same easing, same timing).
- A `hover` needs a `leave` after `record` (the pointer moves off the bottom-right corner), or the probe exits 2. Put a `wait` before `leave` so the enter transition finishes first.
- A recorded `click` that flips `aria-expanded` (or opens a `details`) needs a closing step before the flow ends: a second click or `press --key Escape`. When the state is still flipped at the end, the probe exits 2.
- Text scaled non-uniformly (x and y scale differ by more than 2%, measured through the element's and its ancestors' transforms) is a **warning** in `report.json` and stdout; it does not change the exit code.

**Done = exit 0.** Exit 1 names the element, frame, and channel in `report.json`; `sheet.png` holds the evidence frames. Read `sheet.png` before arguing with the verdict.

On the verify origin a probe also writes a `motion-probe` entry to the receipt (see Receipt). A probe of any other URL writes nothing, and a `--reduce` probe records `motion: false`, which does not satisfy the gate.

## Visual before/after

A visual change keeps a before shot: capture the route (and a `--selector` crop) on the preview built from the untouched source, before the first edit. After the change, the same commands make the after shot. For Figma work, the Figma render is the `reference` panel, and `--figma` makes it mandatory:

```bash
node <this skill's directory>/scripts/visual-compare.mjs --figma --out <dir>/sheet.png \
  reference=<dir>/figma.png before=<dir>/before.png after=<dir>/after.png
```

The sheet builder refuses a `--figma` sheet without a `reference` panel, and refuses any `reference` whose pixels are near-uniform (a blank or black render). Panels labeled `variant-*` are declared variants: the builder refuses two whose pixels are near-identical.

Dispatch the `visual-judge` subagent (`.cursor/agents/visual-judge.md`, read-only) with this chat's transcript path and the sheet paths, nothing else: no request text, no summary of your change, no code. The judge reads the user's messages from the transcript itself. After each run, record every requirement's verdict as its next round:

```bash
node <this skill's directory>/scripts/receipt.mjs --judge "<requirement>" <pass|fail|incomplete> --sheet <dir>/sheet.png [--reference]
```

**Done = every requirement's verdict is `PASS`.** A `FAIL` names the missed requirement: fix it, then judge again on the changed source. A requirement still failing at round 3 is ESCALATE: stop re-judging, and report the requirement and the visible difference to the user. The receipt refuses a fourth round. Once the user decides, record their words: `receipt.mjs --judge "<requirement>" pass --sheet <sheet.png> --user-quote "<their words>"`. The quote is the user's own words, copied from their message, and the requirement's rounds start over. The receipt CLI cannot see the chat; the Cursor `stop` hook checks the quote against the user's messages and names one it does not find. Where that hook is not wired, the quote is unverified.

## Layout proof

Spacing or layout against a Figma frame: the layout-proof reference in the `figma-design-to-code` skill, including its proof surface (story iframe, or the product route). **Done = `scripts/layout-proof.mjs` exits 0** on every in-scope manifest (one Chromium for many paths or `--dir`). It writes `notes.md` under `.cursor/fstack/artifacts/<run-id>/layout-proof/`. Padding inside a box and the frame's leftover inset are in that exit; a seam of 0 does not cover them. A hand-written table does not close the step.

## Iterate vs Done

Two phases. Mixing them is the usual slowdown.

**Iterate** (source still changing; layout-proof or a drive is red):

1. Batch SCSS/markup fixes, then iterate on the dev server or Storybook (`$CTRL up dev` / `$CTRL up storybook`): `VERIFY_BASE_URL=<its origin>` makes layout-proof, console-check, and overflow-check prove against that origin. Only a run on the verify origin on a fresh stamp counts toward the receipt, so relaunch the verify origin (`$CTRL relaunch`; not cleanup+launch by hand; not `--skip-build` after edits) when a proof has to count, and always for Done. Exception: on a `*_section` branch (section scope) a run on this checkout's dev origin (`$CTRL up dev`) counts too, and so does the screenshot taken there; no relaunch is needed for Done.
2. Re-run only the red proof(s) or the failing drive. Do not re-run the full breakpoint matrix, `checks.onStop`, fallow, or valid-html here.
3. Read `notes.md` / the failure, fix, repeat from 1.

Lint: the `stop` hook runs it once on every file the chat edited.

**Done** (no further source edits planned for this task) — once, on a fresh `$CTRL relaunch` or `launch` with doctor `stale: false`:

- If `checks.onStop` is set, run it once in `config.app`; it exits 0. Run it here even when the project wires a `stop` hook (Cursor `.cursor/hooks.json`, Claude `Stop`): the hook is a backstop that re-runs the checks on the files the chat edited and gates on the receipt (below), not the place the proof happens. Do not run lint, format, or typecheck on each edit — only here.
- Figma frame in scope: every in-scope manifest's `layout-proof.mjs` exits 0 in one batch invocation when possible; the closing message quotes the exit plus the artifact path(s).
- No frame: `console-check.mjs` and `overflow-check.mjs` exit 0 on each route you changed.
- Every extra Done command `verify-ui.md` lists exits 0.
- **CI parity** (the frontend checks CI runs): `pnpm lint:fsd` (steiger, part of `pnpm pc` in `frontend_premerge_checks`) and `pnpm fallow:audit` (`frontend_fallow`) exit 0 when this turn changed `frontend/` source.

## Receipt

`console-check.mjs`, `overflow-check.mjs`, `layout-proof.mjs`, and `motion-probe.mjs` record one entry per run in `.cursor/fstack/artifacts/receipt.json`: the source hash behind doctor `stale`, the kind of check, route, viewport, verdict (`pass`, `fail`, or `incomplete`), and artifacts. A motion-probe entry also carries the target, the steps, the motion flag, and the range ratio (`null` for a plain `record`). `$CTRL browser screenshot` records every screenshot path. A run under a different source hash starts a new receipt, so an edit after the proof empties it. A run against a stale preview is recorded with `previewStale: true` and does not count. Only runs on the verify origin are recorded, plus runs on the dev origin when the branch is `front/feature-<page>-<section>_section` (section scope; the entry carries `origin: "dev"` and `previewStale: false`). On any other branch (assembly scope) a dev-origin run is not recorded, and a dev-origin entry in a receipt is a problem: assembly needs the build + preview verify origin. On a section branch the source hash covers only the section slice, its assets and `verify.sectionSharedPaths` from `config.json` (shared styles, for example `src/app/css`), so merging assembly into an unchanged section keeps the receipt fresh and editing the slice stales it.

```bash
node <this skill's directory>/scripts/receipt.mjs   # exit 0 = fresh proof; prints problems otherwise
```

Fresh means all of these hold on the current source hash:

- Every entry is `pass`. A `fail` or `incomplete` entry blocks until the source changes; re-running the same check on unchanged code does not clear it.
- A layout-proof whose manifest changed after a `fail` clears only when the passing run carries the manifest's `reason`. Without it the receipt reports the manifest as stale. The last layout-proof `fail` per frame and width carries over to a new source hash: the same manifest passing on the fixed source clears it.
- Each Figma frame in the chat has a passing layout-proof at a configured frame width.
- A diff that adds motion (see Motion) has a passing motion-probe entry with real motion (motion on, not `--reduce`) for the moving element.
- Every artifact the receipt recorded still exists with the hash recorded by its last run.
- At least one screenshot from the fresh preview still exists.
- Every judged requirement has a PASS. A FAIL stands until a PASS lands on a newer source stamp; a requirement at round 3 without a PASS is ESCALATE and blocks the receipt until the user's decision is recorded with `--user-quote`.

Console-check and overflow-check count as the proof only when no Figma frame is in the chat; a frame makes layout-proof the proof. Judge rounds are recorded by `receipt.mjs --judge` and persist across source stamps; motion-probe records its own entry on the verify origin. Design-review verdicts are not recorded here. The receipt proves the checks ran on this code, not that they covered the right routes; the closing message still names the routes and artifact paths. Proof is not forced by a host `stop` hook — run it when Done or the user asks.

## Evidence

Root: `.cursor/fstack/artifacts/<feature>/` (gitignored).

- Exercise the real user path (nav link, menu, CTA), not internal APIs or test-only hooks.
- Capture the action and the resulting state (ARIA snapshot and/or screenshot with the site's brand visible).
- Side effects: submit a form only when its backend is intentionally configured for the run; by default open it, check the fields, and close it.
- Mocks only at production boundaries the app already isolates.
- Name each artifact after the feature and entry point it proves.

## Cleanup

```bash
$CTRL cleanup
```

Cleanup stops only the verify server's process group and frees the verify port. It never deletes `.cursor/fstack/artifacts/`; confirm the evidence still exists after cleanup.

## Helpers

Requires Playwright in the app (`playwright` package plus `pnpm exec playwright install chromium`) and `sharp` for sheets. Every CLI below answers `--help` with usage and examples; read that before opening the source.

| Script | Role |
| --- | --- |
| `scripts/control.mjs` | launch, relaunch, doctor, cleanup, up, down, status, browser drive on the verify origin |
| `scripts/ready-wait.mjs` | shared ready-wait for every page load: domcontentloaded, app-ready poll, fonts, images; media requests answered empty so a stalled video cannot hang it. `networkidle` is not used anywhere |
| `scripts/cli-help.mjs` | `--help` responder used by every CLI |
| `scripts/console-check.mjs` | fail when the given paths print a console error |
| `scripts/overflow-check.mjs` | fail when the page scrolls horizontally at `config.overflowWidths` |
| `scripts/layout-proof.mjs` | Figma boxes vs live boxes; one or many manifests / `--dir`; exit 1 when Δ is over its band (1px; text boxes: width max(2px, 1%)) |
| `scripts/measure-rss.mjs` | peak RSS summed over a process tree (a command, or running pids), the tool behind `slot-sizing.md` |
| `scripts/token-check.mjs` | `.figma.check.yml` tokens vs computed styles per frame, plus check value vs snapshot drift; exit 1 on FAIL or DRIFT, 2 when a token could not be proved; records no receipt entry |
| `scripts/diff-in-slice.mjs` | section branch diff against the assembly branch stays inside the slice and its assets; exit 0 pass, 1 files outside (named with owner), 2 cannot decide; importable as `checkDiffInSlice` |
| `scripts/accept.mjs` | idempotent section acceptance: requires a clean tree, diff-in-slice, receipt exit 0, a passing layout-proof per `--widths` value and `pnpm pc`; then merges into the assembly branch, pushes, closes the section MR, removes the worktree and deletes the branch locally and remotely; prints width → verdict, check → exit, wall time (first commit or `--started-at` → accept); exit 0 accepted, 1 refused or a step failed, 2 cannot decide |
| `scripts/motion-probe.mjs` | blink, jump, kink, clip, occlusion, property, range, trajectory, hover-leave and toggle-close checks on a recorded flow; exit 1 on any, warnings do not fail; records a receipt entry on the verify origin |
| `scripts/visual-compare.mjs` | labeled before/after sheet for `visual-judge`; `--figma` requires the `reference` panel |
| `scripts/source-stamp.mjs` | source hash behind doctor `stale`; on a `*_section` branch scoped to the slice, its assets and `verify.sectionSharedPaths` |
| `scripts/scope.mjs` | ticket scope from the branch name: `*_section` is section scope, any other branch is assembly scope |
| `scripts/receipt.mjs` | proof receipt: print the fresh-proof verdict; `--judge` records a visual-judge round |
| `scripts/servers.mjs` | server kinds (dev, preview, storybook), pidfile, log and readiness behind `up`, `down`, `status` |
| `scripts/ports.mjs` | verify, dev and Storybook ports for this checkout: the main checkout keeps its port, a linked worktree derives one from its path |
| `scripts/project.mjs` | reads `.cursor/fstack/config.json` for every script |

## Corpus

The scripts are tested against seeded fixtures: a clean page must pass, and each defect must fail or pass as named. From `frontend/`, one command:

```bash
pnpm test:verify-ui
```

It runs `frontend/tests/verify-ui/` on one Vitest worker: `corpus.test.ts` serves `tests/verify-ui/fixtures/` from a tiny static server and runs the CLIs against each page; `scripts.test.ts` checks that every CLI answers `--help` and that no script waits for `networkidle`. The suite sets `FSTACK_ARTIFACTS_DIR` to a temp dir, so corpus runs never write the real receipt. A new false PASS gets a fixture (a directory with `index.html`) and a test case in `corpus.test.ts` that asserts the exit code and the named failure.
