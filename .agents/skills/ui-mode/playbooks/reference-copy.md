# Reference copy

**You own parity with a named reference: the copy moves like the reference, and the probe reports the deviation for each element. The reference is never edited.**

1. Name the reference and the copy: one selector each, on the verify origin, plus the interaction they share (hover, toggle, or scroll). Run `$CTRL doctor` first and continue only when it prints `"ok": true`.
   **Done:** both selectors match one element each on the verify origin.

2. Record the copy against the reference in one recording: `node .agents/skills/verify-ui/scripts/motion-probe.mjs --viewport <width> --target <copy selector> --compare <reference selector> --out .cursor/fstack/artifacts/<feature>/motion --file <flow>`. The flow is `goto <route>`, `record`, then the shared interaction, with `wait` and `leave` for a hover.
   **Done:** `report.json` holds a `trajectory` entry for each element of the copy, with a `deviation` value.

3. Read each `deviation` and its `at` (the point along the move where it peaks). Quote them in the reply. Fix the easing, duration, or delay of the copy at that point.
   **Done:** the todo list holds each element's deviation, and each fix names the rule it changed.

4. Repeat step 2 until every deviation is at zero. The probe fails above 10% (`deviation` 0.1), so a green exit is not a zero diff; the reply quotes the final numbers.
   **Done:** the last run's deviations are quoted, and any value above zero has its cause named.

5. Check layout when a Figma frame is in scope: the copy's `layout-proof.mjs` manifest exits 0 at each frame width (`ui-mode` Proof item 3). Otherwise mark this step `skip: no frame in scope`.
   **Done:** each manifest exits 0, or the step reads `skip:` with its reason.

6. Prove the motion on the fresh build. Run `$CTRL relaunch`, then rerun step 2 without `--reduce`.
   **Done:** `receipt.mjs` lists a motion-probe entry for the copy with `motion: true` and `verdict: pass`.

7. Judge the look only when it changed. Build a sheet with `visual-compare.mjs` from the reference crop (`reference=`) and the copy's before and after shots, dispatch `visual-judge` with the transcript path and the sheet paths only, then record each requirement with `receipt.mjs --judge`.
   **Done:** every requirement is `pass`, or the step reads `skip: motion only, look unchanged`.

Anti-shortcut: the reference's selectors, easing, and timing are read, never edited. The probe's 10% limit is not raised, and an ad-hoc script does not stand in for the trajectory.

**Reply:** the shape in `ui-mode` § Reply, plus the reference and copy selectors, a table of each element's deviation and `at`, the probe exit codes with their artifact paths, and the receipt entry.
