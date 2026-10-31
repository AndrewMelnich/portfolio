# Responsive fix

**You own a breakpoint mismatch from the first red width to a green row at every width. Prove each width, and fix the band that owns the rule.**

1. Build the frame matrix: one row per Figma frame in scope, with its width and mixin (`.cursor/fstack/project.md`, Styles). Run `pnpm lint:breakpoints` in `frontend/`.
   **Done:** every row names a width and a mixin, and `pnpm lint:breakpoints` exits 0.

2. Confirm the preview before any before shot: `$CTRL doctor` prints `"ok": true` and `"stale": false`. If the developer sees a different page, run `stale-view` first.
   **Done:** doctor reports `ok: true` and `stale: false`.

3. Capture a before shot per width on the verify origin, before the first edit: `$CTRL browser --viewport <width> flow --file <steps>`, where the steps are `goto <route>` and `screenshot --path .cursor/fstack/artifacts/<feature>/before-<width>.png --full`.
   **Done:** one before PNG per frame width exists.

4. Batch the layout proof: one manifest per frame, `viewportWidth` set to that frame's width. Run `node .agents/skills/verify-ui/scripts/layout-proof.mjs --dir .cursor/fstack/artifacts/<feature>/layout-proof`. Run `node .agents/skills/verify-ui/scripts/overflow-check.mjs <route>` for the project's `overflowWidths`, and once more with each frame width as an argument.
   **Done:** the todo list holds one red or green row per width, and each red row names the element or line from `notes.md`.

5. Fix the rule in the band it belongs to. Base styles are for 1920, and overrides go down the cascade through the mixins in `project.md`. No raw `@media` where a mixin exists. Name the mixin for each changed rule in the todo list.
   **Done:** every changed rule sits in the band of the width it fixes.

6. Iterate on the dev origin, one red width at a time: `VERIFY_BASE_URL=<dev origin> node .agents/skills/verify-ui/scripts/layout-proof.mjs <red proof.json>`.
   **Done:** each red manifest exits 0 on the dev origin.

7. Prove once, on the fresh build. Run `$CTRL relaunch`, then the batch from step 4 again: one `layout-proof.mjs --dir` call for every width and `overflow-check.mjs` on the route at each width. Then `node .agents/skills/verify-ui/scripts/receipt.mjs` must show one `pass` layout-proof entry per frame width.
   **Done:** layout-proof exits 0 in one call, overflow-check exits 0 at each width, and the receipt holds a passing layout-proof row for each frame width.

8. Judge the look per width. Build a sheet per width with `node .agents/skills/verify-ui/scripts/visual-compare.mjs --figma --out .cursor/fstack/artifacts/<feature>/sheet-<width>.png reference=<figma>.png before=<before>.png after=<after>.png`. Dispatch `visual-judge` with the transcript path and the sheet paths only. Record each requirement with `receipt.mjs --judge`.
   **Done:** every requirement is `pass`, or it reached ESCALATE and is listed in Open risks.

Anti-shortcut: the frame matrix is not cut down to the widths that pass, and a mixin's band is not moved to make a width green.

**Reply:** the shape in `ui-mode` § Reply, with one row per width (frame, width, mixin, layout-proof red or green, before and after paths), and the changed rules grouped by band.
