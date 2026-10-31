---
name: design-review
description: >
  Compare Figma layout tokens to declared styles/markup on default and adaptive
  frames (e.g. laptop / tablet / mobile). Tokens vs code only — no browser. Use when the
  user asks сверка с макетом, design-review, проверь адаптивы, несоответствие
  макетам, сверь с Figma, or after implementing a section from Figma. Catches
  missing scrims/overlays, gap/padding, structure, wrong text `ch`.
paths:
  - "frontend/**/*"
---

# Design review

Project overrides: read `.cursor/fstack/project.md` and `.cursor/fstack/design-review.md` from the repo root when present; they win over this file.

## Role gate

**Worker (already `design-review`):** your agent body is the protocol. Run it with tools. Emit one report. Stop. Do not call `Task`.

**Parent (main chat only):** launch Tasks only inside the ceiling below. Do not run the protocol yourself.

If your system / role names you `design-review`, you are the worker.

## When (parent)

**Must dispatch** when:

- User asked: сверка с макетом / проверь адаптивы / несоответствие макетам / `design-review` / сверь с Figma
- After implementing a **section from Figma** (frames were in the task / plan) — before claiming done

Vague «готово?» with no Figma frames is not an ask. Skip the Task.

## How (parent) — ceiling

This section is the only statement of the design-review ceiling. The page procedure and the figma-to-code completion point here.

1. **First Task.** All widths in one prompt. The snapshot pair `<Block>.figma.yml` + `<Block>.figma.check.yml` is on disk before launch, and the prompt passes both paths. The pair missing → this parent reads the frame with the ladder in `figma-design-to-code` (Figma MCP), writes the snapshot, then launches. The fetch stays on this parent.
2. **Second Task.** Once, after Critical and Major from the first `FAIL` are fixed in the styles. The prompt carries only the still-open `FAIL` lines.
3. **Third FAIL** of that section is the premise in one sentence, written when the second Task returns `FAIL`. A third Task does not launch.
4. A Task that returns `INCOMPLETE` or `REFUSE` is not the second Task and is not a pixel pass. `INCOMPLETE` → the snapshot ladder in step 1, then the first Task if none has returned `PASS` or `FAIL`. `REFUSE` → resolve the section node, then that same first Task.
5. A section whose MR is merged or closed, and whose MR text records design-review `PASS`, has no Task.

Launch:

- `subagent_type`: `design-review` if listed; else `generalPurpose` whose entire prompt starts with: follow `agent.md` in this skill directory exactly. You are the worker. Never call Task.
- `run_in_background`: `false`. One Task carries every width. Do not resume or fork a design-review Task.

Each Task prompt includes:

1. Figma per frame — URLs or `fileKey` + `nodeId` (default + each adaptive that exists). Step 2 replaces that list.
2. Section styles path (SCSS by default; the component file too if structure lives there) and the `.figma.yml` + `.figma.check.yml` paths
3. CSS root (e.g. `.catalog-section`)

Run the first Task before the first `verify-ui` launch. In the reply to the user, `PASS` means the declared style tokens matched the frame. The live frame is the layout-proof exit.

Pass no localhost. The worker does not screenshot, open a browser, or call `download_figma_images`. Token diff vs declared CSS only. Live CSS properties = the `qa-review` skill. Live box distances vs the frame = layout proof (the `figma-design-to-code` skill). Neither is this skill.

Report-only. Parent applies Critical/Major (`<prop>: figma X vs css Y → set X`). **Copy** (a string that differs only between frames): the code keeps one string, the default frame's. Copy does not change the verdict.

**Anti-cheat:** closing `FAIL` by changing check `value` without `override: true` + `reason` in `.figma.check.yml` is not a fix. An override also needs `user_quote:` on the same entry, holding the user's own words from this chat. The stop gate names an override whose quote is missing or does not appear in a user message; then remove the override, or ask the user to state it in their own words.

**Done** when step 1 returns `PASS`, or step 2 returns `PASS`, or step 3 has written the premise.
