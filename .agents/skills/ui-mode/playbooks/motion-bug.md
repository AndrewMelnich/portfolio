# Motion bug

**You own a red motion defect until the probe is green on the same flow. Reproduce it on the probe first, then fix the place it starts.**

1. Put the verify origin on the current source: `$CTRL relaunch`, then `$CTRL doctor` prints `"ok": true`.
   **Done:** doctor reports `ok: true` and `stale: false`.

2. Write the flow that reproduces the defect, with both legs. Hover: `hover --selector <target>`, `wait --ms <ms>`, then `leave`. Toggle: `click --selector <target>`, `wait --ms <ms>`, then a closing `click` or `press --key Escape`. The probe exits 2 when a leg is missing, so exit 2 means a bad flow, not a red result.
   **Done:** the flow has an enter and a leave, or an open and a close.

3. Run the probe until it is red: `node .agents/skills/verify-ui/scripts/motion-probe.mjs --viewport <width> --target <selector> --out .cursor/fstack/artifacts/<feature>/motion --file <flow>`. Open `sheet.png`.
   **Done:** exit 1, with the element, frame, and channel named in `report.json`. On exit 0 the flow does not reproduce: change the viewport or the timing in the flow, not the probe.

4. Diagnose with `diagnosing-bugs` until one mechanism explains the channel: the property, the rule, and the element that moves. Confirm it with `--prop <property>` on the same flow.
   **Done:** the reply states the mechanism in one sentence, with the probe number or sheet frame that shows it.

5. Fix at the place the mechanism starts, as `ui-mode` Bug says: the change stays in the module that owns the defect, and branching state reads **Model the Domain** first.
   **Done:** the reply names the file and rule changed, and step 3's command exits 0 on the verify origin.

6. Attack the premise if two fixes failed with one shared premise. Write the premise as one sentence and test it directly with the probe before the next fix (`principle-attack-the-premise`).
   **Done:** the premise sentence and the probe result are in the reply, or the step reads `skip: fewer than two failed fixes`.

7. Judge the fix when the look changed. Build `visual-compare.mjs --out <dir>/sheet.png before=<before>.png after=<after>.png`, dispatch `visual-judge` with the transcript path and the sheet paths only, then record each requirement with `receipt.mjs --judge`.
   **Done:** every requirement is `pass`, or the step reads `skip: motion only, look unchanged`.

8. Prove it on the fresh build. Run `$CTRL relaunch`, then rerun step 3's probe without `--reduce`. Its receipt entry must read `motion: true`.
   **Done:** `receipt.mjs` lists a motion-probe entry with `verdict: pass` and `motion: true` on the fresh stamp.

Anti-shortcut: the probe, its legs, and its thresholds stay as written. A fix that hides the element from the sampler, or a flow shortened until it passes, is not a fix. `--reduce` does not clear a motion bug.

**Reply:** the shape in `ui-mode` § Reply, plus the reproduced red (channel, element, sheet path), the mechanism sentence, the fix (file and rule), the premise test if one ran, and the green probe run with its receipt entry.
