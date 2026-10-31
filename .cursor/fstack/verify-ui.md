# verify-ui overrides

## Extra Done commands

From `frontend/`, only in the **Done** phase (after the last source edit and a green doctor — not during iterate), so `build/` matches the markup:

```bash
pnpm lint:css
pnpm exec vitest run tests/html/valid-html.test.ts
pnpm fallow:audit
```

Agents: `pnpm fallow:audit -- --format json --quiet --explain` (or `pnpm exec fallow audit …` from `frontend/`). A skipped `valid-html` file (`build/` missing) does not close the step. A fallow finding: fix introduced debt (`gate: new-only`), re-run.

## Recipes (project)

The agent proves a change as a user: it sees roles, names, visible text, the address bar, and screenshots, and does not know the code. A recipe step that needs a CSS class, id, DOM query, or computed style is rewritten into what the user sees (`pnpm lint:feature-map` enforces it; the allowed steps are listed at the top of `features.md` Recipes). Proof is the agent driving the real browser. Once in Done, on a fresh launch, from `frontend/`:

```bash
node ../.agents/skills/verify-ui/scripts/console-check.mjs / /services/ /projects/ /projects/project-1/ /blog/ /contacts/ /privacy/
```

Read `.cursor/fstack/features.md`, compare it with the diff, and drive the recipes of the features the change can touch. Name each driven recipe and each skipped one with its reason in the reply. Keep its screenshot in `.cursor/fstack/artifacts/<feature>/`. A recipe that cannot run (missing seed data, unreachable route) is reported with its unmet precondition, never reworded to pass.

A new feature with user-facing behavior gets its row and recipe in the same change. `pnpm lint:feature-map` fails on a row without a recipe link. A new route joins the `console-check` list.

## Stop hook (project)

One Cursor `stop` hook, `.cursor/hooks/stop.mjs` (`loop_limit: 3`), speaks only in the chat that edited the files. The same script also runs on `subagentStop`, so a ticket agent in its own worktree is gated against that worktree: the hook resolves the project from its `workspace_roots` before `CURSOR_PROJECT_DIR`. `record-edit.mjs` (`afterFileEdit`, `subagentStop`; the only `afterFileEdit` hook, it only records) appends every path the agent edits to `.cursor/hooks/state/conversations/<conversation_id>.txt` (gitignored). On `stop`, a chat with no edited `frontend/` file or verify-ui script stays silent. Otherwise the dispatcher runs four checks on that chat's files and sends one combined follow-up:

- `lint`: `scripts/verify-files.sh` (eslint `--fix`, stylelint `--fix`, oxfmt) once over every `frontend/` file the chat edited that still exists and is 200 KB or less; the unfixed findings come back in the follow-up. Replaces the per-edit lint of the `verify-ui` skill ("Edit-time lint"): lint runs once when the chat finishes, not after each edit.
- `verify-ui-tamper`: an edit under `.agents/skills/verify-ui/scripts/` in a chat that did not invoke `maintain-verify-ui`.
- `design-review-override`: an `override: true` entry in a `*.figma.check.yml` whose `user_quote` does not appear in a user message of the chat.
- `judge-user-quote`: a `userQuote` on a `judge` entry of the branch's receipt that does not appear in a user message of the chat. Each quote is checked once: the first stop that finds it in the chat records it in `.cursor/hooks/state/judge-quotes.json`, and later chats do not ask for it again. `subagentStop` skips this check, because a subagent's "user" message is the parent's prompt.

tsc, steiger, the feature map and fallow are not checked here: husky pre-push and CI run them, and `accept.mjs` gates a section. A chat the user stops by hand skips the hook (`status` is not `completed`), so husky pre-push is the net for lint too.

A chat that passes all checks gets its state file deleted. State older than 7 days is pruned.

`verify-ui` receipt / Done proof is **not** enforced by this hook. Run it when the skill or the user asks (`receipt.mjs`, layout-proof, console/overflow, motion-probe).
