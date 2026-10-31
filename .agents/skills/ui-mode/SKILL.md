---
name: ui-mode
description: Routes one frontend job — layout, script, motion, hover, responsive, a11y, check, prototype, or a bug — to the skill that owns it, then the proof that job owes. A frame joins the hover, motion, and responsive paths it needs.
disable-model-invocation: true
mode: true
reminder: Layout, script, motion, hover, responsive, a11y, a check, a prototype, or a bug in that UI? Follow ui-mode. Otherwise stay quiet.
---

# UI mode

Project overrides: read `.cursor/fstack/project.md` and `.cursor/fstack/ui-mode.md` from the repo root when present; they win over this file.

One primary path. A second path joins only when its own line is also true. Read each named skill and follow it. This file only says when. `principle-*` are fstack-owned ports of pstack. `unslop` and `deslop` are vendored here (`metadata.vendored`). `diagnosing-bugs`, `code-review`, and `pr` come from mattpocock/skills. A named skill that is not installed: say so in the reply and continue with the rest.

The Principles section below grounds every trigger. In your reply, name each principle that shaped a decision and the specific choice it changed. Cite only principles whose leaf `SKILL.md` you read this session.

Name the path and the scale before any edit. A request that resumes earlier work (a chat id, a pushed branch, "продолжение") runs `session-pickup` first. **Done when** the reply names the path (`layout`, `script`, `motion`, `hover`, `responsive`, `a11y`, `check`, `prototype`, or `bug`) and `component` or `part`, and no file has changed yet.

Leave the branch uncommitted until the user asks to commit. Under the page procedure, Outer commits and pushes the stub on the assembly branch, and ticket agents commit on their branch and open the MR `page.md` names. They leave that MR open and stop; the parent accepts it with `accept.mjs`.

## Principles

Read the leaf skill in full for any principle you apply. Each entry names when it applies. Each leaf is the **principle-<title>** skill, with the title in kebab case, hyphens kept and other punctuation dropped, unless the entry gives its name.

**Core**

- **Laziness Protocol.** Refactoring, sizing a diff, or tempted to add abstractions, layers, or signal threading. Bias to deletion and the smallest change that solves the problem.
- **Foundational Thinking.** Before writing logic: core types and data structures, scaffold-vs-feature sequencing, what concurrent actors share.
- **Redesign from First Principles.** Integrating a new requirement into an existing design. Redesign as if it had been foundational from day one.
- **Attack the Premise.** Two or more fixes that share one premise have failed the same gate. Write the premise down and test it directly before you write another fix that assumes it.
- **Subtract Before You Add.** Sequencing an addition, refactor, or rewrite. Remove dead weight first, then build on the simpler base.
- **Minimize Reader Load.** Reviewing or shaping code that's hard to trace. Count layers and hidden state, collapse one-caller wrappers, shrink mutable scope.
- **Outcome-Oriented Execution.** Planned rewrites and migrations with explicit phase boundaries. Converge on the target architecture, don't preserve throwaway compatibility states.
- **Experience First.** Product, UX, or feature-scope tradeoffs. Choose user delight over implementation convenience.
- **Exhaust the Design Space.** A novel interaction or architectural decision with no precedent. Build 2-3 competing prototypes and compare before committing.
- **Build the Lever.** Any non-trivial work. Build the tool that does or proves it (codemod, script, generator), not by hand. The tool is the artifact a reviewer reruns.

**Architecture**

- **Model the Domain.** Writing stateful logic, or code that branches a lot or repeats a shape assumption across files. Encode the domain in a structure (state machine, typed model, table or registry, reducer, boundary, the right collection) instead of scattered conditionals.
- **Boundary Discipline.** Wiring validation, error handling, or framework adapters. Guards at system boundaries, trust internal types, keep business logic pure.
- **Type System Discipline.** Designing types or a signature in any typed language. Make illegal states unrepresentable, brand primitives, parse external data at boundaries. TypeScript → also read `typescript-best-practices` before the edit.
- **Make Operations Idempotent.** Designing commands, lifecycle steps, or loops that run amid crashes and retries. Converge to the same end state.
- **Migrate Callers Then Delete Legacy APIs.** Introducing a new internal API while old callers exist. Migrate and delete in one wave.
- **Separate Before Serializing Shared State.** Concurrent actors might write the same file, branch, key, or object. Eliminate the sharing first.

**Verification**

- **Prove It Works.** After a task, before declaring done. Verify against the real artifact, not a proxy or "it compiles".
- **Fix Root Causes.** Debugging. Trace each symptom back to the first place the system went wrong and fix it there. A guard is a fix only when the state it handles is legitimate.
- **Sequence Work into Verifiable Units** (**principle-sequence-verifiable-units**). Multi-step work (sweeps, migrations, runs of similar edits) and how you stack commits and PRs. Break work into small units that each end in a check, verify each before the next, and order delivery so the sequence proves itself.
- **Test Behavior, Not Implementation.** Writing, changing, or keeping a test. Assert what the code's users can observe, so the test fails when that behavior breaks and keeps passing when only the internals change.
- **Explain the Number.** Before you trust, report, or act on a number you measured (fps, timing, size, a speedup, a regression, or a probe result). Find what limits it, and rule out that it measured something other than the work you think.

**Delegation**

- **Guard the Context Window.** Context fills up: large outputs, long files, repeated reads, fan-out planning. Route bulk to subagents, keep summaries in the main thread.
- **Never Block on the Human.** Tempted to ask "should I do X?" on reversible work. Proceed, present the result, let the human course-correct.

**Meta**

- **Encode Lessons in Structure.** You catch yourself writing the same instruction a second time. Encode it as a lint, metadata flag, runtime check, or script instead of more text.

## Questions

Before asking the user anything, classify the question. A fact a run can show (layout, behavior, timing, which fix turns the loop green, whether the build matches the frame) is not theirs to answer: drive it on the verify preview, or follow `prototype` and let the result decide. A novel interaction with no precedent in the repo: **Exhaust the Design Space** (two or three prototypes) before any production edit. A reversible choice the frame and code leave open: pick one (**Never Block on the Human**; **Experience First** when the choice is what the user feels), proceed, and name the pick in the reply. Ask only a product or taste call no run can settle. **Done when** every question in the reply is one of those.

## Scale

- **Component.** One component. Markup, styles, and script stay in that component's directory. A call site changes only to mount it.
- **Part.** A section, a run of sections, or a whole page. Follow the project's architecture (`project.md`, Architecture; default FSD: the page composes widgets, each section is a widget). On a page of sections, placement comes from the page procedure. The script stays in the section or widget that owns the behavior.

**Done when** the tree matches that scale.

## Paths

**Layout.** Markup and styles from a Figma frame. A frame → `figma-design-to-code`. The user names a date for the mockup → `figma-diff` first, then implement only the nodes in its report. That skill opens `figma-scale` (no tokens or named styles) and `figma-reflow` (no Auto Layout) when its own conditions hit. The frame needs a typed props or domain shape (`shared/model`, widget props) → **Type System Discipline** before writing that type. Breakpoints of that frame also take **Responsive**. A control in that frame also takes **Hover**. A transition on that UI also takes **Motion**. A page of sections with no Scope line → [page.md](page.md) Outer. Scope `one section` → page.md Fresh ticket. Scope `assembly` → page.md Assembly ticket. Scope `integration` → **Script**, and page.md Integration ticket. Playbook: `section-from-frame`; page orchestration is `parallel-sections` (page.md).

**Motion.** A transition that is not in the UI yet → `transitions-dev`. Timing, easing, stagger, or motion tokens on a transition that already runs → `transitions-polish`. The surface should look generated (dotted wireframe, scan line) → `transitions-ui-generation`. Scroll-linked scrub, sticky progress, `view()` / `animation-timeline` → `scroll-linked-animation` (`.agents/skills`). Playbook: `scrub-motion` for scroll-linked work; `reference-copy` when the target must move like a named reference.

**Hover.** The hover of a link, button, chip, card, or icon button, including a frame with no hover variant → `hover`. Playbook: none.

**Responsive.** Breakpoint mixins, media-query overrides, or the same property repeated across bands → `responsive-layout`. Playbook: `responsive-fix`.

**Script.** Behavior on markup that already exists (form, popup, filter, cart, toggle, route state). **Model the Domain** before writing. **Done when** the reply names the data shape. Combobox, dialog, menu, tooltip, switch, tabs, accordion, or live region → also `aria-patterns`. A control this script adds also takes **Hover**. A transition it adds also takes **Motion**. Playbook: none.

**A11y.** Implementing or reviewing one change against Order 953 / GOST / WCAG → `accessibility`. A site-wide report, baseline, or trend → `accessibility-audit`. One widget where JAWS, NVDA, VoiceOver, TalkBack, or Narrator disagrees with the APG → `aria-patterns`. Playbook: none.

**Check.** The deliverable is a verdict.

- Declared styles against tokens, no browser → `design-review`.
- Computed CSS against the frame → `qa-review`.
- Live boxes against the frame → layout proof, via `verify-ui`.
- A route, control, console, overflow, or motion check → `verify-ui`.
- Whether the feature map still covers the app → `maintain-verify-ui`.

Playbook: none. `verify-ui` owns the proof.

**Prototype.** A question settled by looking (a state model, or which layout) → `prototype`. The prototype stays throwaway until the user asks to fold the decision into the tree. Playbook: none.

**Bug.** Wrong pixels, or a user action that fails, in UI that is already there. `diagnosing-bugs` until a feedback loop goes red on this defect. Then **Fix Root Causes**, and the path the cause belongs to. The diff stays in the module that owns the defect. If the deciding fact took a deep dig to find, leave a cheap always-on signal (log, check, or metric) so the next look finds it without repeating the dig. A fix that changes branching state also reads **Model the Domain** before the edit. **Done when** the reply names the data shape. When two fixes shared one premise and both failed that loop, read **Attack the Premise** before the next edit. **Done when** the premise is one sentence and it has been tested. Playbook: `stale-view` when the developer sees no change or reports the bug on their own origin (before any edit); `motion-bug` when the defect is motion; otherwise none.

## Playbooks

Each path names one playbook in `playbooks/`, or none. Before the first edit, copy that playbook's steps verbatim into the todo list as its first items. A step you do not run stays in the list with `skip: <reason>`. In playbooks, `$CTRL` is `node .agents/skills/verify-ui/scripts/control.mjs`; other verify-ui scripts are `.agents/skills/verify-ui/scripts/<name>.mjs`.

## During

- The script branches and the path is Layout → **Model the Domain** before writing it. **Done when** the reply names the data shape.
- Adding or editing a domain type, union, branded primitive, or props shape → **Type System Discipline** (read the leaf; TypeScript → also `typescript-best-practices`) before the edit. **Done when** the reply names the discriminant or brand, or why a simple total type was enough.
- A third design-review FAIL of the same section follows the parent ceiling in the `design-review` skill (How, parent). **Done when** that ceiling's Done is met.
- A third miss of layout proof or the same visual miss → **Attack the Premise** before the next edit. **Done when** the premise is one sentence and it has been tested.
- Non-trivial bulk (many similar sections, a sweep, a migration of call sites) → **Build the Lever** before hand-applying the rest.
- Reporting fps, timing, size, or a probe number → **Explain the Number** before you trust or act on it.
- Before declaring the path done → **Prove It Works** against the real surface (the Proof section below), not a compile or a static read.

## Proof

Check, Prototype, and `accessibility-audit` end when that skill's own completion is met. The page procedure replaces this list with the proof in [page.md](page.md): a section proves on the page route with `$CTRL up dev`, and assembly runs the build and preview once. Its outer pass ends at the pushed stub and the published tickets. Every other path, once its skill is met. `INCOMPLETE` is red, the same as `FAIL`: a check that returned no verdict has not passed:

1. An existing route whose pixels change: the before shot (`verify-ui`, Visual before/after) exists under `.cursor/fstack/artifacts/` before the first edit. After the edit, `visual-judge` returns `PASS` on every requirement.
2. A control added or edited: `hover` is met, and Hit target is met.
3. Markup came from a frame, or the bug is a mismatch to a frame: design-review meets the parent ceiling (`design-review` skill, How parent). `layout-proof.mjs` exits 0 for every breakpoint frame of the section (`.cursor/fstack/project.md`, Styles: 1920, 1440, 768, 375, and 2500 when that frame exists), one manifest per frame with `viewportWidth` set to that frame's width (`verify-ui`, Layout proof). Find the sibling frames on the Figma page even when the chat links only one. A width the user waives is named in Open risks with the user's own words. `qa-review` exits 0 at each frame's width, so computed color and typography match the frame; a red qa-review row is red even when layout proof is green. Playbook: `section-from-frame`, or `responsive-fix` for a breakpoint-only task.
4. An animated or scroll-linked element this task touched: the motion probe exits 0 on the verify origin with motion on (`verify-ui`, Motion). Playbook: `scrub-motion`, `motion-bug`, or `reference-copy`.
5. A change a visitor can see or operate (markup, script, behaviour, a route): follow `verify-ui` on the route that shows it, with the recipes from `.cursor/fstack/features.md` that the change can touch (you pick them from your diff), and `console-check`. **Done when** `verify-ui` Done passes, each user action the change added has an observed result, and the reply lists the recipes driven and each one skipped with its reason. Copy-only, token-only, or a change with no DOM or script effect on a route: mark this item `skip: <reason>`.
6. Bug: the loop from `diagnosing-bugs` is green, and it lives on as a `features.md` recipe when the defect meets the `maintain-verify-ui` criteria.
7. Scale is **part** (medium: one section; large: a run of sections or a page): follow `code-review` on `git diff HEAD`. The spec is the user request and the frame. **Done when** the reply includes the Standards and Spec reports.

**Receipt.** `receipt.mjs` reads `.cursor/fstack/artifacts/receipt.json` on the current source stamp. A chat that edited runtime source needs all of these: a passing layout-proof for each Figma node URL in the chat, at that frame's width (the receipt sees only linked frames; item 3 also asks for the unlinked breakpoint frames); a passing motion-probe with motion on when the diff adds motion (item 4); every judged requirement `pass`, where round 3 without a pass is ESCALATE and only the user's words in the chat settle it; no `fail` or `incomplete` entry on this stamp; console-check and overflow-check only when no frame is in the chat; and a screenshot from the fresh preview. Design-review and qa-review verdicts are not recorded there, so item 3 is yours to check. **Done when** `receipt.mjs` exits 0 on the final stamp and each breakpoint frame in item 3 has its own `pass` row.

## Anti-shortcut

Fix the product until the proof passes. The proof stays as the task started.

- Verify-ui scripts, layout-proof manifests, `*.figma.check.yml` checks, before shots, and judge sheets are not edited to turn a red result green. Edits under `.agents/skills/verify-ui/scripts/` are refused outside `maintain-verify-ui`. A manifest changed after a FAIL needs a `reason`, or the receipt marks it stale.
- A `design-review` override carries the user's own words as `user_quote`. A judge escalation is settled only by `receipt.mjs --judge ... --user-quote` with those words.
- A width, node, state, or requirement is not dropped because it fails. A `skip` in a playbook needs a reason.
- Restructuring the page or a shared component to pass one diff is not the fix. The change stays in the module that owns the defect.
- When the baseline looks wrong (the Figma node, the reference render, the before shot), stop and ask the user. Do not re-capture it to pass.

## Reply

Every closing message uses this shape. A playbook's **Reply** adds only its own lines.

- **Changed:** each file or component, one line each.
- **Proof:** a table with one row per frame id and width: `layout-proof` red or green with its `notes.md` path, plus `motion-probe` and `judge` rows when in scope, each with its artifact path.
- **Open risks:** unproved widths or states, ESCALATE requirements, skipped steps with their reasons, and any harness gap the run hit.

## Hit target

A control's hit area is at least the project's minimum target size on both axes (`project.md`, Rules; default 44×44 CSS px). The project names its helper for growing a hit area without changing the visual box; without one, extend the area with padding or a pseudo-element. **Done when** the control uses that helper, or both axes already meet the minimum.

## Comments

Follow `no-comments`. Narration, section banners, commented-out code, and workaround notes in the diff are unfinished. **Done when** every file this task wrote matches that skill's allowed list.

## PR

When the user asks to commit or open a pull request for this UI work, follow `deslop` on the diff, then `no-comments`, then `pr`. **Done when** the diff has no deslop Focus Areas, matches the `no-comments` allowed list, and the body matches `pr` and carries the evidence paths from `verify-ui`. CI red, or a request to loop until CI is green → `ci-green-loop`.
