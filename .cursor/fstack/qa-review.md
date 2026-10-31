# qa-review overrides

- Desktop frame dumps: `--width` ≥ 1441 (typical 1920; the 1440 frame is the `laptop` band); pass `--desktop-min 1441` to the report.
- This project also has the scripts as pnpm aliases in `frontend/`: `pnpm figma:css-tree -- …` (`frontend/scripts/figma-section-css-tree.mjs`), `pnpm figma:css-tree-report -- …` (`frontend/scripts/figma-css-tree-report.mjs`, compare in `figma-css-tree-compare.mjs`). Same CLI; they warn at viewport ≤ 1199 without `--desktop-min` and take no route-only `--url`.
- Fixture test: `frontend/scripts/__fixtures__/figma-css-tree/section.html`, vitest `frontend/scripts/__tests__/figma-section-css-tree.test.ts` and `figma-css-tree-report.test.ts`.
