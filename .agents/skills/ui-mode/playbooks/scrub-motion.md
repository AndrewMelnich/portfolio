# Scrub motion

**You own a scroll-linked element from its start frame to its end frame. Prove both ends, the whole track, and the recorded range.**

1. Write one manifest per Figma state frame: the scrub's start and its end. Each sets `state.scroll: "<selector> <top|bottom> <offset>"` to its position. Iterate on the dev origin with `VERIFY_BASE_URL=<dev origin> node .agents/skills/verify-ui/scripts/layout-proof.mjs <start.json> <end.json>`.
   **Done:** two manifests exist, each with `state.scroll`, and both exit 0.

2. Record the whole track. Write a flow file with `goto <route>`, `record-range --track <track selector>`, then `scroll --selector <scrollport> --by <n> --repeat <k>` until the track ends. Run `node .agents/skills/verify-ui/scripts/motion-probe.mjs --viewport <width> --target <moving selector> --out .cursor/fstack/artifacts/<feature>/motion --file <flow>`.
   **Done:** the probe exits 0 and `report.json` has a `range` entry covering at least 90% of the track.

3. Name each property the scrub drives. Add `--prop <name>` once per property, custom property or computed style. The default `--expect monotonic,linear` applies: the value rises or falls with scroll and stays on a straight line within the probe's limit.
   **Done:** each property appears in `report.props`, and the probe still exits 0.

4. Read the DOM channels in `report.json` under `dom`: `blinks`, `jumps`, `kinks` (a snap at the scrub's end shows here), `clips` (an `overflow` ancestor), and `occlusions` (a fixed or sticky header). Open `sheet.png` for each named frame.
   **Done:** all five lists are empty, or each named item is fixed and the probe re-runs to exit 0.

5. Read `report.warnings`. Text under non-uniform scale is a warning that leaves the exit code alone. Fix it, or name it in Open risks.
   **Done:** each warning is fixed or named.

6. Prove both ends on the fresh build. Run `$CTRL relaunch`, then `node .agents/skills/verify-ui/scripts/layout-proof.mjs <start.json> <end.json>` in one call.
   **Done:** both manifests exit 0 on the verify origin.

7. Verify motion on the verify origin: rerun step 2's probe without `--reduce`. The probe writes its receipt entry there, and `receipt.mjs` must show it with `motion: true` and a `rangeRatio` of at least 0.9.
   **Done:** the motion-probe entry exists with `motion: true` and `verdict: pass` on the fresh stamp.

8. Judge the motion. Build a sheet with `visual-compare.mjs` from the before shot, the after shot, and the Figma start and end renders (`reference`). Include the probe's `sheet.png` as a sheet path. Dispatch `visual-judge` with the transcript path and the sheet paths only, then record each requirement with `receipt.mjs --judge`.
   **Done:** every requirement is `pass`, or it reached ESCALATE and is listed in Open risks.

Anti-shortcut: the track is not shortened to fit the probe, and a `kink`, `clip`, or `occlusion` is not cleared by hiding the element from the sampler. A script that samples `getComputedStyle` on its own does not count; only the probe's report does.

**Reply:** the shape in `ui-mode` § Reply, plus the start and end manifests with their coverage, the probe's `range` ratio, the `dom` channel results, the properties from `report.props`, and each warning with its outcome.
