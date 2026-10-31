# Section from frame

**You own one frame from snapshot to judged PASS. Build it, prove every width, and do not close on a partial run.**

On a `*_section` branch (`page.md` Fresh ticket) the proof origin is the dev server: `$CTRL up dev --path /<page>/` prints the `url`, and every proof command takes `VERIFY_BASE_URL=<url>`, and `$CTRL browser` steps `goto` the absolute dev url. Each step below that names the verify origin gives its section-branch variant.

1. List the frames. Put one row per Figma frame id and width in the todo list. Widths and mixins come from `.cursor/fstack/project.md` (Styles): 1920, 1440, 768, 375, and 2500 when that frame exists.
   **Done:** every frame in scope has a row, and each row names its mixin.

2. Write the token snapshot before any markup: `<Block>.figma.yml` and `<Block>.figma.check.yml` next to the section, through the ladder in `figma-design-to-code`. That skill opens `figma-scale` and `figma-reflow` when their conditions hit.
   **Done:** both files exist on disk, and their paths are in the todo list.

3. Take a before shot only when the route exists and its pixels will change. Run `$CTRL doctor` first and continue only when it prints `"ok": true` (on a section branch: `$CTRL up dev --path /<page>/` prints a `url`). Then per width, `$CTRL browser --viewport <width> flow --file <steps>`, where the steps are `goto <route>` and `screenshot --path .cursor/fstack/artifacts/<feature>/before-<width>.png --full`. For a new section, mark this step `skip: new section, no route yet`.
   **Done:** one before PNG per width exists, or the step reads `skip:` with its reason.

4. Build markup and styles from the snapshot in the component's directory (`figma-design-to-code` placement). Base styles are for 1920; override down the cascade with the mixins from `project.md`. No raw `@media` where a mixin exists.
   **Done:** every TEXT node in the frame has its copy in the markup, and each width's values sit in that width's mixin.

5. Write one `proof.json` per frame width. Run `node .agents/skills/verify-ui/scripts/layout-proof.mjs --help` for the schema. Set `fileKey`, `frameId`, `url` (the page route; a Storybook iframe only for a component outside a page ticket), and `viewportWidth` to the frame width. Add one seam and one origin per section. The script generates the children under those anchors to depth 3, plus every TEXT node. Each `skip` needs a `reason`.
   **Done:** each manifest's `viewportWidth` equals its frame width, and each has at least one seam and one origin.

6. Iterate on the dev server from `$CTRL up dev`, one red manifest at a time: `VERIFY_BASE_URL=<dev url> node .agents/skills/verify-ui/scripts/layout-proof.mjs <proof.json>`. Read that run's `notes.md` before writing any measurement script.
   **Done:** the red manifest exits 0 on the dev origin, or `notes.md` names the element and the fix that comes next.

7. Run design-review once for all widths: one `design-review` Task with every snapshot path, inside the parent ceiling (`design-review` skill, How parent). INCOMPLETE is red: rebuild the snapshot as that skill says and run again. On a section branch, also run `token-check.mjs` for each snapshot against the dev url (`token-check.mjs --help` has the flags).
   **Done:** the verdict is PASS. A FAIL is fixed and re-run within the ceiling. On a section branch each `token-check.mjs` run exits 0.

8. Prove once, on the fresh build. On a section branch the dev origin is the fresh build: `$CTRL status dev` exits 0, and the commands below take `VERIFY_BASE_URL=<dev url>` with no relaunch. Elsewhere, run `$CTRL relaunch`, then `node .agents/skills/verify-ui/scripts/layout-proof.mjs --dir .cursor/fstack/artifacts/<feature>/layout-proof` in one call for every width. Take one screenshot per width with `$CTRL browser --viewport <width> flow --file <steps>` (`goto <route>`, `screenshot --path <file> --full`).
   **Done:** that run exits 0, `notes.md` prints `coverage: mapped N/M nodes` for each manifest, and each width has a screenshot.

9. Judge with the Figma render as reference. Download the node render with `download_figma_images` (`nodeId` and `fileName` only, no `imageRef`) into `.cursor/fstack/artifacts/<feature>/` under the worktree root (`localPath` is the worktree's absolute path plus that folder). Build each sheet with `node .agents/skills/verify-ui/scripts/visual-compare.mjs --figma --out .cursor/fstack/artifacts/<feature>/sheet-<width>.png reference=<figma>.png after=<after>.png`. Dispatch `visual-judge` with the transcript path and the sheet paths only, as a Task whose `model` is the `visual-judge` role's value in `.cursor/rules/fstack-models.mdc`. Record each requirement with `node .agents/skills/verify-ui/scripts/receipt.mjs --judge "<requirement>" <pass|fail|incomplete> --sheet <sheet> --reference`.
   **Done:** every requirement on every sheet is `pass` in the receipt, or it reached ESCALATE and is listed in Open risks, and each judge Task's `model` equals the roster's `visual-judge` value.

10. Part scale outside a page ticket: run `code-review` on `git diff HEAD` once, per `ui-mode` Proof item 7. On a `*_section` branch the page's Assembly ticket reviews this diff (`page.md`), so mark this step `skip: section branch, code-review runs on assembly`.
    **Done:** the reply includes the Standards and Spec reports, or the step reads `skip:` with its reason.

Anti-shortcut: a width is not dropped from the batch, a node is not added to `skip` to get past a FAIL, and the reference is the Figma render, never a screenshot of the built page.

**Reply:** the shape in `ui-mode` § Reply, plus the snapshot paths, every `skip` with its reason, and the two code-review reports at part scale (none on a section branch).
