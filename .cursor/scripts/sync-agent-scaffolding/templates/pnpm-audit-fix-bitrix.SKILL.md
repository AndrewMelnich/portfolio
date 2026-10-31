---
name: pnpm-audit-fix
description: >
  Fix npm/pnpm audit CVEs and remove stale overrides. Use for npm audit, yarn
  audit, CI frontend_audit, advisories, dependency CVEs, or review/clean overrides.
  On Bitrix projects the frontend uses npm in local/templates/main/frontend/.
---

# Dependency audit fix (Bitrix)

Fix dependency vulnerabilities reported by the package manager audit. **Primary strategy: update the vulnerable package.**

## This project

- Frontend app: `local/templates/main/frontend/`
- Lockfile: `package-lock.json` → use **npm**
- There is no root `frontend/` and no `pnpm-workspace.yaml` here
- Always run audit from `local/templates/main/frontend/`

```bash
cd local/templates/main/frontend
npm audit --production --audit-level=high
```

## Strategy order (each advisory)

1. **Update the package** that owns the advisory.
2. **Update the parent** that pulls a vulnerable transitive.
3. **overrides** in `package.json` — last resort.
4. Accept / document only when no fixed release exists and CI still blocks.

## Verify

```bash
cd local/templates/main/frontend
npm audit --production --audit-level=high
```
