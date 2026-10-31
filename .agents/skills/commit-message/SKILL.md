---
name: commit-message
description: >
  Commit message that states why the tree changed, not the file list.
  Use when the user asks for a commit message, to commit, or to закоммитить.
---

# Commit message

Write a message a teammate can trust without opening the diff: the **why**.

## Steps

1. Collect the tree: `git status`, `git diff` (staged and unstaged), `git log -10 --format='%s'`.
2. Name **one intent**. Two unrelated intents → say so; prefer split commits (or two paragraphs if the user wants one commit anyway).
3. Draft:
   - Subject: imperative, ≤72 characters, the reason the tree changed.
   - Body: only if the why does not fit the subject. No file inventory, no “also updated X”.
4. Language: follow `git log` (this repo: English) unless the user wrote the message in another language.
5. Show the message. **Commit only if the user asked to commit** — then HEREDOC, no `--amend` unless the user asked and the amend rules in the session allow it.

**Done when:** a teammate could skip the diff and still know why this commit exists.

## Shape

```
<why in one line>

<optional: constraint, follow-up, or issue ref>
```

Issue refs (`#12`, `Closes #12`) only when the diff maps to a tracker issue.

## Examples

Diff: slim `api.mdc`, drop invented `access_token` docs.

- Why: `Drop stale access_token docs from the API rule; the frontend has no such token.`
- File list (skip): `Update api.mdc and RETRO-PLAN.md.`

Diff: add GitLab label script + README step.

- Why: `Add a glab script so new GitLab projects get triage labels without the UI.`
