# ui-mode overrides

- Reply style stays caveman (`caveman` skill).
- **Script** on a form (submit, validation, nextapi) → also read skill `forms` (`.agents/skills/forms`).
- **Motion** scroll-linked / sticky scrub / `view()` timeline → also read skill `scroll-linked-animation` (`.agents/skills/scroll-linked-animation`).
- **Motion** repaint / jank / scrub grow / custom cursor hot path → also read skill `design-engineer` (`.agents/skills/design-engineer`).
- **Script** / **Layout** fixed-header theme over a section (`data-header-theme`, transparent / blend / solid chrome) → also read skill `design-engineer`, example `examples/header-theme.md`.
- **Verify.** A route, control, or console proof is a `verify-ui` drive (recipes from `.cursor/fstack/features.md`, picked by the agent from its diff; the reply names the driven and the skipped ones), and it runs only inside this mode. Whether the recipes still match the app → `maintain-verify-ui`. A fixed bug lives on as a `features.md` recipe when the defect meets the `maintain-verify-ui` criteria.
- **Subagents and ticket agents** get `ui-mode` in their prompt: `subagent_type: "ui-agent"`, first line `Follow ui-mode. …`, then the path of `.agents/skills/ui-mode/SKILL.md` in their worktree.
