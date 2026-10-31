---
name: implement-spec
description: "Implement the result of /to-spec and /to-tickets in code."
disable-model-invocation: true
---

You have been provided a spec. This spec should have tickets associated with it, describing how to implement the spec.

The issue tracker should have been provided to you. If not, tell the user to run `/setup-matt-pocock-skills`.

The goal is the entire spec implemented on a single **integration branch**, with every ticket resolved the way the issue tracker closes work.

The tickets are not a list of steps. They are a **task graph** with blocking relationships between them. This means there is always a **frontier** of tickets which are ready to be grabbed.

Communication to and from subagents should be sparse. Communicate primarily through **context pointers**: to the spec, tickets, research notes, and previous commits. Don't duplicate information already available via pointers.

**Implementer subagents** should be run in the background where possible for maximum concurrency.

## Page tickets

A ticket whose first line is `Follow ui-mode` and whose Scope is `one section`, `assembly`, or `integration` follows `.agents/skills/ui-mode/page.md` for the assembly branch, section branches, MR target, prompt, env file, resume, and which proof runs. Models come from the roster in `.cursor/rules/fstack-models.mdc` by role (`implementer`, `visual-judge`, `code-review`, `orchestrator`); `page.md` (implement-spec) says which role each Task takes. Where that file differs from the steps below, it wins. The parent merges each finished section branch into assembly and closes that section MR; assembly starts as soon as every fresh section is merged — do not wait on the user.

## Steps

1. Read the spec and tickets to understand the task graph.

2. (optional) Use an **exploration subagent** to conduct any exploration required by the tickets - relevant codebase files or external documentation. Ensure the exploration subagent can save files - it should save its markdown notes in a directory outside the repo, accessible by all future subagents. This lets **implementer subagents** focus on implementation rather than exploration. On a page ticket those notes do not replace `page.md`.

3. Create the integration branch. A page cuts the assembly branch from `master` as `page.md` names. Otherwise, if the issue tracker closes work through PRs, or the user asks for one, open a draft PR after the first merge in step 5 (a branch with no commits ahead of main can't open one), marked as closing the spec and tickets.

4. Use **implementer subagents** to implement each ticket, each in its own worktree on its own branch. Each implementer subagent:
   - confirms its worktree is based on the integration branch before starting, and resets onto it if not;
   - reads and follows the skill the ticket names. A page ticket's prompt is the one in `page.md` (implement-spec). Any other ticket's prompt includes that skill's path. A ticket that names no skill is built by calling the Skill tool with `tdd`;
   - merges the integration branch tip into its own branch before reporting done

5. Once an **implementer subagent** completes, merge its work to the integration branch with a **merger subagent**. A page section follows `page.md` instead of this merge. After the merge, delete the ticket branch locally and on the remote, and remove its worktree. From then on, every fix for that ticket lands on the integration branch.
   **Done:** `git branch -r` lists no merged ticket branch.

6. If this changes the **frontier** of available tickets, kick off more **implementer subagents** to work on the new tickets. This allows for maximum concurrency.

7. Once all tickets are complete, call the Skill tool with `code-review` on the integration branch, unless the tickets are page tickets. A page's code-review is the one in `page.md` (Assembly ticket), run on the assembly diff by the assembly ticket's agent on the roster's `code-review` model; the parent runs no other, and the assembly ticket's agent fixes its findings. Otherwise, fix all issues raised by the code review in a single **implementer subagent**.

8. When a ticket named `ui-mode`, follow `deslop` on the integration diff, then `no-comments`. If a draft PR exists, mark it ready for review. Otherwise, resolve each ticket the way the issue tracker closes work, and report the integration branch.

9. Clean up all **implementer subagent** worktrees.
