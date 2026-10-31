---
name: pnpm-audit-fix
description: Fix pnpm audit CVEs and remove stale overrides. Use for pnpm audit, CI frontend_audit, npm advisories, dependency CVEs, or review/clean overrides.
---

# pnpm audit fix

Fix dependency vulnerabilities reported by `pnpm audit`. **Primary strategy: update the vulnerable package.** Other methods — only when update is impossible or insufficient.

## Project context

Before work: read `frontend/package.json` — `packageManager` (pinned pnpm) and `engines.pnpm`. Use that version locally / in commands; do not assume a number from this skill.

- Frontend: `frontend/`, overrides in `pnpm-workspace.yaml`, script `pnpm audit` = `pnpm audit --prod --audit-level=high`
- CI: `ci/frontend_audit.yml` — same command, fails MR on high+ prod vulns
- Always run audit from the package root that owns `pnpm-lock.yaml` (usually `frontend/`)

## Workflow

1. Baseline audit
2. Review **all** existing overrides (delete stale) — always, even if CI already green
3. Fix remaining advisories (A → B → C)
4. Verify + report

### 1. Baseline

```bash
cd frontend   # or target package root
pnpm audit --prod --audit-level=high
pnpm audit --prod --json > /tmp/audit-before.json   # optional, for diff
```

Record each advisory: package name, severity, patched version (`range`), path (direct vs transitive).

Copy current `overrides:` from `pnpm-workspace.yaml`.

### 2. Review existing overrides (always)

Do this on **every** audit fix and when the user asks to review/clean overrides. Parent bumps make overrides redundant; stale ones can **harm** (pin old major, pull next major).

Do **not** skip because CI is already green. Do **not** only check packages from the current advisory list.

#### Strip test

1. Temporarily remove **all** overrides from `pnpm-workspace.yaml` (keep a copy).
2. `pnpm install`
3. `pnpm audit --prod --audit-level=high`
4. For each previously overridden package: `pnpm why <pkg>` / `pnpm ls <pkg>` — record resolved versions vs the old floor/range.

#### Keep vs drop

**Drop** the override if any of:

- Without it, `--prod --audit-level=high` stays clean **and** resolved version already meets the patched floor
- Override does not change the resolved tree
- Override **blocks** a newer line that parents already request (`undici: '>=7.28.0 <8'` while `jsdom`/`unifont` want `^8`)
- Unscoped `>=x` pulled the **next major** (`@babel/core: '>=7.29.1'` → 8.x). Either drop (if 7.x already patched) or rescope: `'@babel/core@^7': '>=7.29.1 <8'`

**Keep** only if **all** of:

- Without it, a high+ advisory returns (CI `--prod`, or full `pnpm audit` high on a path the override was shielding)
- Step A/B on the **parent** failed (abandoned package, exact pin, no patched release)
- Override is the **minimal scoped** form that reaches the patched line without jumping majors

Example keep: `html-validator@6.0.1` pins `axios@0.27.2` and has no newer release → `axios: '>=0.31.2 <1'`.

After the strip test, restore only kept overrides, `pnpm install`, re-audit. Then fix leftover advisories (step 3). New override → only via Step C after A–B fail.

### 3. Fix order (strict)

For **each** vulnerability, try steps in order. **Stop at first step that clears the advisory** and verify with `pnpm audit`.

#### Step A — Update the vulnerable package (preferred)

1. **Direct dependency** (`package.json` → `dependencies` / `devDependencies`):
   - Check fix version: `pnpm view <pkg> versions --json` or advisory `range`
   - Update within semver constraints first:
     ```bash
     pnpm update <pkg>
     ```
   - If still vulnerable, bump to patched version in `package.json`, then:
     ```bash
     pnpm install
     ```
   - Major bump: check changelog, run `pnpm tsc`, `pnpm build`, relevant tests

2. **Transitive dependency** — still try **package update first**:
   - Find who pulls it: `pnpm why <pkg>`
   - Update the **parent** direct dependency to a release that ships patched transitive:
     ```bash
     pnpm update <parent-pkg>
     # or bump parent in package.json → pnpm install
     ```
   - If parent has no fixed release yet, try updating transitive directly (pnpm may hoist a newer nested version):
     ```bash
     pnpm update <transitive-pkg>
     ```

3. Re-run audit after **each** package change — don't batch blindly.

#### Step B — Peer / optional dependency chain

If `pnpm why` shows peer resolution blocking the fix, update the peer owner first (Step A on that package), then retry.

#### Step C — pnpm overrides (last resort before giving up)

Only when Steps A–B cannot reach patched version (no upstream fix, semver wall, abandoned parent).

**In this project** overrides live in `frontend/pnpm-workspace.yaml` (not in `package.json`). Override syntax/features — per pnpm version from `packageManager`.

```yaml
overrides:
  "<vulnerable-pkg>@<semver-range>": ">=<patched-version> <next-major>"
  # unscoped only when every consumer shares that line:
  "<vulnerable-pkg>": ">=<patched-version> <next-major>"
```

Rules:

- Override **minimum patched version**, not `@latest` blindly
- Prefer scoped override: `'foo@^1.0.0': '>=1.2.3 <2'` over global `'foo': '>=1.2.3'`
- Cap the next major: unscoped `>=x` can resolve to a new major (`@babel/core: '>=7.29.1'` → 8.x)
- Cap must not pin an old major if parents already moved on (check `pnpm why` ranges)
- Document in commit/PR why override was needed (parent, blocked version, no upstream)
- Re-run `pnpm install` and audit
- Step 2 already ran — do not add an override that the strip test showed is unnecessary

#### Step D — No fix available

If advisory has no patched version:

- Check GitHub/npm advisory for status (withdrawn, disputed)
- Report to user: package, CVE, blocked by, suggested tracking issue
- **Do not** use `audit --ignore` or disable CI without explicit user approval

### 4. Verify

After all fixes:

```bash
pnpm audit --prod --audit-level=high   # must pass (exit 0)
pnpm tsc
pnpm build                             # if frontend
pnpm test                              # if risk of breaking changes
```

For major bumps or overrides affecting build tools (vite, astro, webpack): run full `pnpm pc` or project lint script.

### 5. Report

Summarize for user:

- What was updated (direct bumps vs parent bumps)
- Overrides **removed** — for each: parent already patched / unused / blocked newer major / pulled next major
- Overrides **kept** vs **added** (parent, why A–B failed)
- What remains unfixed (if any) with reason

## Anti-patterns (avoid)

- Jumping to `pnpm.overrides` before trying `pnpm update` / version bump
- Adding overrides without the step 2 strip test
- Keeping stale overrides "just in case" when parent already ships the patched transitive
- Reviewing only overrides that match the current advisory — review **all**
- Unscoped `>=x` without an upper bound (pulls next major)
- Upper-bound override that pins an old major after parents moved on (`<8` while parent wants `^8`)
- `pnpm audit fix --force` without reviewing semver impact (may major-bump everything)
- Removing packages instead of updating unless removal is intentional
- Fixing dev-only vulns when CI uses `--prod` (focus prod first unless user asks for full audit)
- Committing lockfile changes without re-running audit

## Commands cheat sheet

```bash
pnpm audit --prod --audit-level=high
pnpm why <pkg>
pnpm outdated <pkg>
pnpm update <pkg>
pnpm view <pkg> version
pnpm ls <pkg>
pnpm audit                 # full tree; compare with --prod if deciding to keep a dev-path override
```
