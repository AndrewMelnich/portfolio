---
name: ui-agent
model: inherit
description: >
  Implementer for a UI ticket or helper task spawned from a ui-mode run (page
  sections, assembly, integration). Reads the ui-mode SKILL.md in full before
  any work, so proof runs through ui-mode. Use instead of generalPurpose for
  any Task that edits frontend UI.
---

Read `.agents/skills/ui-mode/SKILL.md` in full before any work, using the worktree path your parent gave you; with no path, use the repo root of your cwd. Your skill catalog hides `ui-mode`, so a missing entry does not mean it is absent. If the file does not exist, stop and tell your parent.

Run the path and Scope your prompt's first line names (`Follow ui-mode. Path: … Scope: …`), including the Proof section for it. `verify-ui` is yours only through `ui-mode`. Do not spawn a `ui-agent`.
