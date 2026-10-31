---
name: maintain-verify-ui
description: 'Periodic pass that keeps the verify-ui recipes honest: parallel source readers per feature, one live pass driving every recipe, at most one PR of proven corrections. Use for /maintain-verify-ui or "audit the verification".'
disable-model-invocation: true
---

# Maintain verify-ui

Project overrides: read `.cursor/fstack/project.md` and `.cursor/fstack/maintain-verify-ui.md` from the repo root when present; they win over this file.

The feature map is `.cursor/fstack/features.md`: one row per user-facing feature, each linking a recipe the agent drives in the real browser. Recipes are written as a user: roles, accessible names, visible text, the address bar, screenshots, never code handles (`pnpm lint:feature-map` enforces it). A recipe rots silently: nothing goes red when the app moves. `pnpm lint:feature-map` catches one kind of rot (an accessible name gone from `src`); the live pass catches the rest. A feature earns a recipe when it already broke in front of the user, breaks silently (lint, typecheck, build, and a glance at the page miss it), is a visitor's key action, or is shared code many routes depend on. Layout and styling (visual-judge, layout proof), copy, and one control's hover stay out.

## Outcomes

Pick one, and say which:

- **clean**: every feature got source and live coverage; nothing worth shipping. No branch, no PR.
- **changed**: one PR ships proven recipe, row, or harness corrections.
- **blocked**: coverage could not finish or a proven fix could not ship safely. Say exactly what blocked it.

## Edit scope

`.cursor/fstack/features.md` and `.cursor/fstack/verify-ui.md`. Harness bugs in the plugin's `verify-ui` scripts are reported; fixing them is a separate change the user asks for. The scripts under `.agents/skills/verify-ui/scripts/` change only in a chat where the user invoked this skill (`/maintain-verify-ui` in their own message, or a parent's task prompt that names it). The agent reading this file does not count. Elsewhere a `preToolUse` guard denies Write, StrReplace and Delete on those scripts. Shell commands bypass that guard, and the stop gate sees only edits the editor tools recorded, so a shell edit to them is not caught yet. Product code stays untouched: a behavior the recipe describes that the app no longer does is either recipe drift (fix the recipe) or a product regression (report it, never paper over it in the recipe).

## Pass

1. **Index hygiene.** `pnpm lint:feature-map` from `frontend/` exits 0; fix missing, dead, or duplicate rows and anchors. **Done when** it exits 0.

2. **Source wave.** One read-only subagent per row, launched concurrently. Each explains from source how the feature works, flags likely recipe drift with `file:line`, and returns the live steps it would drive in user terms. Only source readers see code; the driver (step 4) sees the UI. Children never drive the app and never edit files. Return shape: feature summary / source entry points / likely drift or none / one live recipe.

3. **Reconcile.** Every row has a returned summary. Spot-check each cited drift against source. Sweep `git log` since the last pass, and the user-facing folders in `src/`, for behavior missing from the map; a missing feature needs a concrete source path.

4. **Live pass.** The coordinator drives every recipe serially on the verify origin: `verify-ui` launch, doctor before the first drive and after any failed drive, each recipe, `verify-ui` cleanup after the last drive. **Done when** every recipe was driven once on a fresh launch (doctor `stale: false`) and each is `verified`, `drifted`, `broken`, or `verified-unreachable` with the unmet precondition and the route attempted. Evidence lands in `.cursor/fstack/artifacts/<feature>/` and survives cleanup; check it at that path.

5. **Triage.**
   - Handle renamed or path moved, behavior as a user expects: recipe drift. Fix the recipe and keep its intent.
   - Two controls with one role and name that a user reaches together and no landmark separates in Chrome's real accessibility tree: accessibility bug in the markup. Report it; fix the markup in its own change, not the recipe (the check method is in `features.md` Recipes).
   - Behavior broken: product gap. Report it; keep it out of the PR.
   - Seed or fixture data lacks a precondition the journey needs: report the failure and record the reason in the row. Never weaken the journey to make it pass.
   - Behavior the browser CLI cannot express (smoothness, a visual verdict): record its motion-probe flow or visual-judge check in the row.
   - A recipe that no longer meets the feature criteria gets deleted with its row.

6. **Ship or stop.** For changed: re-drive every corrected recipe on a fresh launch, one PR, every changed file re-read. For clean or blocked: no PR; report the outcome and the coverage.

Keep concise run notes (features covered, unreachable preconditions, drift, product gaps, outcome) in a scratch location; don't commit them.

## features.md

Missing in the project: create it. One table, one row per feature:

| Feature             | User paths covered            | Recipe                 |
| ------------------- | ----------------------------- | ---------------------- |
| Every route renders | direct URL, no console errors | [recipe](#route-smoke) |

The agent picks the rows a change can touch from its diff. Recipes follow the table as `### <Feature>` sections: `$CTRL browser flow` steps with handles (role plus accessible name), the observable end state, and a Gotcha line. A gotcha belongs in the recipe, not in a code comment (`no-comments`).
