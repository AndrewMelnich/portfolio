# Page

Read the heading your ticket's Scope names. With no Scope line, run Outer.

A **section** is a top-level content block, plus each narrower frame where that block exists. **Shell** (header, footer, and the form that lives in the page layout) stays in the project's existing page layout and off the section list. A **reuse** is a slice that already does the section's role. Mount that slice as it stands. A **fresh** section has no such slice. **Assembly** is the route file, the page view, and the page barrel. **Static** is one const per section, typed as that section's props, inside the slice. **Integration** is an API fetch for the page. The **stub** is assembly with a placeholder slice for every fresh section, committed on the assembly branch by Outer. A **slice** is `frontend/src/_pages/<Page>/ui/<Page>View/sections/<Section>/`, with `<Page>` and `<Section>` in PascalCase. `$CTRL` is `node .agents/skills/verify-ui/scripts/control.mjs`; every other `<name>.mjs` named below is in `.agents/skills/verify-ui/scripts/`.

`<page>` and `<section>` are the kebab-case names from the section list. Assembly branch: `front/feature-<page>_page`, cut from `master`, MR to `master`. Section branch: `front/feature-<page>-<section>_section`, MR into the assembly branch. `master` is the project's main branch and its prod branch. There is no `prod` branch. The dev row in `docs/project.md` is a deploy URL. The MR base is the branch above, not that URL.

## Outer

The frame is a page of sections. Name `layout` and `part` before any edit.

1. A date for the mockup follows Layout's `figma-diff`. The section list is then the sections in that report. Otherwise the list is the frame's top-level content blocks, top to bottom. A block that appears only on a narrower frame stays off the list.
2. Search the app for each section's role. Mark **reuse** with the slice to mount, or **fresh**. **Done when** the reply lists every section as one or the other, before any grill question.
3. For each fresh section, in list order, before `grill-with-docs`: read that section in the page mockups and the same-named functional-description frame the way `docs/project.md` (Как читать файл) defines it. Quote the text under this section's media. Read an animation scenario only when this pair's annotation or that quoted text points at it. Then `grill-with-docs` until the user confirms shared understanding. A question cites that quote and asks about behavior in it. Another section's behavior stays on that section. **Done when** the reply quoted that text before its first question, and the user confirmed shared understanding for this section.
4. Read and follow `to-spec` once, for the page, then `to-tickets` once. Publish from the grill. Skip `to-spec`'s seam check and `to-tickets`' quiz: the ticket list is already fixed. Tickets, each with one agent:
   - one per fresh section, first line `Follow ui-mode. Path: layout. Scale: part. Scope: one section, <name>.`
   - one for assembly, blocked by every fresh ticket, first line `Follow ui-mode. Path: layout. Scale: part. Scope: assembly.`
   - when the user asks for API integration in this task, one more, blocked by the assembly ticket, first line `Follow ui-mode. Path: script. Scope: integration.`
5. In a worktree, never in the main checkout, cut `front/feature-<page>_page` from `origin/master` (`git worktree add -b front/feature-<page>_page ~/.cursor/worktrees/plenum-<page>-stub origin/master`, then `ROOT_WORKTREE_PATH=<main checkout> bash .cursor/scripts/setup-worktree.sh` from inside it), commit the stub there, and push it. The main checkout keeps its branch and its changes. The stub holds:
   - the route file in the framework's `pages/` directory, rendering the view;
   - `<Page>View`, mounting every section in list order: a reuse mounts its recorded slice with that slice's own props, and a fresh section mounts its placeholder slice with `{...<section>Static}`;
   - one barrel line per section in `_pages/<Page>/index.ts`, in the shape of the Services barrel: the default component, `<section>Static`, and the type `<Section>Props`.

   A placeholder slice is `index.ts` exporting those three names, a component that renders nothing, and `<section>Static` as `{}` in `static.ts`, re-exported from `index.ts`. The fresh ticket replaces the contents and keeps the names. Shell stays in the existing page layout.
   **Done when** `git ls-remote --heads origin front/feature-<page>_page` lists the branch, `pnpm pc` and `pnpm fallow:audit` exit 0 in the worktree's `frontend/`, `$CTRL up dev --path /<page>/` prints a `url`, `$CTRL down dev` has then run, and `git worktree list` no longer lists the stub worktree.

6. Stop. The reply names the assembly branch and tells the user to invoke `implement-spec`.
   **Done when** the reply carries `front/feature-<page>_page` and the word `implement-spec`, and no edit or command follows it.

When `to-spec` or `to-tickets` stops because the tracker is missing, stop with it.

**Done when** the page has one published spec, each fresh section has one ticket, the assembly ticket is blocked by those tickets, the integration ticket exists only if the user asked for API integration, step 5's Done holds, and the only section files on the branch are placeholder slices.

## Fresh ticket

You are the ticket agent for one fresh section. Build that section on `front/feature-<page>-<section>_section`. The stub on the assembly branch already holds the route, the page view, and the barrel lines, and mounts your placeholder slice. This ticket's diff stays inside the slice and its assets (`frontend/public/static/<kind>/<page>/`); `diff-in-slice.mjs` fails any other file. A change the section needs outside them goes to the parent in the reply.

Placement follows `figma-design-to-code`. The slice includes markup, styles, and every breakpoint frame that exists for this section. Replace the placeholder's contents and keep its three exports: the default component, the props type `<Section>Props`, and `<section>Static`, one const of that props type that holds the frame literals. `<section>Static` lives in `static.ts`, typed `satisfies <Section>Props`; `types.ts` holds types only. Markup reads props only. Assets baked into the slice travel with it. Behavior the section owns (accordion, slider, share) is part of this ticket; a branching script follows During. Take the Layout joins that are true here (Responsive, Hover, Motion).

Write the token snapshot (`.figma.yml` + `.figma.check.yml`) before design-review. A frame with no snapshot is read by the ladder in `figma-design-to-code` (Figma MCP).

Proof on this branch renders that const:

- the snapshot is on disk
- design-review meets the parent ceiling in the `design-review` skill (How, parent)
- `token-check.mjs` exits 0 for every frame of the snapshot: the deterministic token comparison against the live page (`token-check.mjs --help` has the flags; pass the page width as `--frame <name>:<width>`)
- each new control meets `hover` and Hit target
- layout proof, the before shot, `visual-judge`, the motion probe, and `verify-ui`

The proof surface is the page route on `astro dev` with HMR. `$CTRL up dev --path /<page>/` prints the dev `url`; pass it as `VERIFY_BASE_URL=<url>` to layout proof, `token-check.mjs`, `console-check.mjs`, `overflow-check.mjs`, and the motion probe. On a `*_section` branch a dev-origin run counts toward the receipt, so this section needs no build and no preview. Storybook stays out of the page pipeline.

`visual-judge` runs per section.

The **parent** accepts the section, merges it into assembly (it does not wait for the user), closes the MR, and removes the branch and worktree. This ticket ends at "MR open, report receipt, stop". Further section fixes land on the assembly branch.

The receipt stamp hashes the slice's content: a proof recorded before the last edit goes stale, so a later edit means rerunning the affected proof on the final source.

**Done when** all of these hold, checked in this order:

1. the slice, its props type, and the const exist, and every existing breakpoint frame of this section is in the slice;
2. `pnpm pc` and `pnpm fallow:audit` exit 0 in `frontend/`, the work is committed (commit hooks may rewrite files, so proofs follow the commit), and `diff-in-slice.mjs --assembly front/feature-<page>_page` exits 0;
3. the proof above is met on that committed source, and every `visual-judge` Task ran on the model its role has in the roster (the implement-spec section below);
4. the MR is open: `glab mr create -b front/feature-<page>_page -t <title> -d <description> -y`;
5. `receipt.mjs` exits 0, and the reply pastes its output;
6. `$CTRL down dev` has run, and `$CTRL status dev` exits 1.

Then stop: no further edit, no new worktree, no second MR.

## Assembly ticket

You are the ticket agent for assembly, on `front/feature-<page>_page`, after the parent has accepted every fresh section into it. Do not wait on the user. Compose the page from the stub.

The route, the page view, and the barrel already exist, and the accepted slices have replaced the placeholders. This ticket owns those three files. `project.md` (Architecture) wins on the path; otherwise the view is `_pages/<Page>`. The view mounts each section in list order with `{...<section>Static}`. A reuse mounts the recorded slice. Shell stays in the existing page layout. The page renders from the imported consts until an integration ticket exists.

Review first, so a fix is proved once. Run `code-review` once on the assembly diff: `git diff master...HEAD`, fixed point `master`. One subagent on the `code-review` role's model; the prompt says this review is a single agent (`code-review` skill), so it writes the Standards and Spec reports itself. The spec is the page spec and the tickets the assembly ticket is blocked by (`glab issue view <number>`), plus this ticket. Fix every finding on this branch, or list it in Open risks with the reason.

Proof on this branch is the full build and preview, run once, on the source after those fixes: `$CTRL relaunch`, then `console-check.mjs` and `overflow-check.mjs` on the page route, then `receipt.mjs`. Section-branch proof (layout proof, the before shot, `visual-judge`, the motion probe, design-review) stays on that branch. Design-review follows the parent ceiling.

Open the MR to `master`: `glab mr create -b master -t <title> -d <description> -y`.

**Done when** the reply includes the Standards and Spec reports on the assembly diff and each finding is fixed or listed in Open risks, each `<section>Static` appears in the view in list order, `$CTRL doctor` prints `"ok": true` on the final source, `console-check.mjs`, `overflow-check.mjs`, and `receipt.mjs` exit 0, `$CTRL cleanup` has run, and the MR to `master` exists.

## Integration ticket

You are the ticket agent for integration. The page route already exists. Follow **Script**. **Model the Domain** before writing. **Done when** the reply names the data shape.

The fetch lives in the route and passes the same props the consts already type. Proof is the Proof list in `SKILL.md`. Take the before shot before the first edit of the fetch. Open the MR into the assembly branch: `glab mr create -b front/feature-<page>_page -t <title> -d <description> -y`.

## implement-spec

The parent that runs `implement-spec` for this page follows [playbooks/parallel-sections.md](playbooks/parallel-sections.md) for orchestration: the assembly preflight, worktrees, the Figma cache, the implementer cap, context packs, launch order, resume, acceptance, and the wall-time report. It wins over the generic steps in that skill where they differ.

- Every implementer Task is `subagent_type: "ui-agent"` (`.cursor/agents/ui-agent.md`), and its prompt opens with the ticket's first line (`Follow ui-mode. Path: … Scope: …`) followed by `<worktree>/.agents/skills/ui-mode/SKILL.md`. A subagent's catalog hides `ui-mode`, so the path is how it finds the mode; `verify-ui` runs only inside it. Then the prompt is this file's path, the ticket number, the worktree path, the section branch, and the assembly branch, plus the context pack that playbook lists: the Figma node-cache paths, the `figmaFile` path per frame, and the canonical `proof.json` example. The implementer reads those paths and searches no other worktree or transcript for them. The section contract stays in the ticket. Read the ticket with `glab issue view <number> --comments`.
- Models come from `.cursor/rules/fstack-models.mdc` by role: `implementer` for each section and assembly Task, `visual-judge` for the judge, `code-review` for the assembly review. The parent runs on the `orchestrator` role's model. A skill, playbook, or prompt names the role, never a model.
