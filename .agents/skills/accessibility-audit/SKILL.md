---
name: accessibility-audit
description: Site-wide accessibility audit for Russian government sites — crawl routes, axe/pa11y/Lighthouse, JSON/HTML remediation reports vs Order 953 / GOST / WCAG 2.1 AA. Stakeholder deliverable or baseline/trend; not an inline code fix (use accessibility skill).
---

# Accessibility Audit — RU Government Sites

Project overrides: read `.cursor/fstack/project.md` and `.cursor/fstack/accessibility-audit.md` from the repo root when present; they win over this file.

Evidence-based audits for **official websites** of Russian state/municipal bodies. Does not certify legal compliance.

**Baseline:** Order 953 + **GOST R 52872-2019** (WCAG 2.1 AA). **Planned from 2026-03-01:** Government Resolution 102 — see [references/ru-federal-requirements.md](references/ru-federal-requirements.md).

For implementing fixes, use the `accessibility` skill.

## Core Rules

1. Automation = triage, not full conformance proof.
2. Default standard tag: `wcag21aa` (matches GOST 52872). Map findings to Order 953 letters in reports.
3. Separate automated, manual, and `needs-review` findings.
4. Representative route sample over exhaustive crawl unless user requests full surface.
5. Record evidence: URL, selector, WCAG, Order 953 letter, impact, remediation.
6. Say **aligned to** Order 953/GOST — not "legally compliant".

## Setup (once per machine)

Run from this skill's directory (scripts and `sandbox/` paths below are relative to it):

```bash
npm install
```

Outputs go to `sandbox/` (gitignored). Create if missing: `mkdir -p sandbox`.

## Inputs To Confirm

- Target URL or entry point (for the project's own build: the verify origin — `control doctor` in the `verify-ui` skill prints it)
- Scope: single page, representative sample, or broader crawl
- Standard: default `wcag21aa`; use `wcag22aa` only if user explicitly wants 2.2 delta
- Tool: `axe` (default), `pa11y`, or `lighthouse`. If axe fails with ChromeDriver mismatch, use `--tool pa11y`
- Authentication required? (browser session config)
- Deliverables: JSON, HTML, markdown summary

## Workflow

### 1. Scope

**Single page:** audit URL directly.

**Broader surface:**

```bash
node scripts/crawler.js --url https://example.gov.ru --output sandbox/routes.json
```

Authenticated / SPA:

```bash
node scripts/crawler-browser.js --url https://example.gov.ru/app \
  --session-config examples/session-config.example.json \
  --storage-state sandbox/auth/state.json \
  --output sandbox/routes-auth.json
```

Select representative pages: home, nav-heavy, form/auth, listing, detail, critical workflow.

### 2. Automated scan

```bash
node scripts/audit.js --url https://example.gov.ru/contact \
  --tool axe --standard wcag21aa --output sandbox/contact.json
```

`--output` must be a **file path** (e.g. `sandbox/home.json`), not a directory.

If axe fails (ChromeDriver vs Chrome version), use pa11y:

```bash
node scripts/audit.js --url https://example.gov.ru/ --tool pa11y --standard wcag21aa --output sandbox/home.json
```

**Default pa11y only reports errors (~20–30 on a typical page).** For a thorough scan use `--deep` (adds warnings + notices) and combine tools:

```bash
node scripts/audit.js --url https://example.gov.ru/ --tool pa11y --deep --wait 2000 --output sandbox/runs/home-pa11y.json
node scripts/audit-browser.js --url https://example.gov.ru/ --standard wcag21aa --wait 2000 --output sandbox/runs/home-axe.json
node scripts/audit-batch.js --input-dir sandbox/runs --output sandbox/merged.json
node scripts/generate-html-report.js sandbox/merged.json sandbox/merged.html
```

Authenticated + screenshots:

```bash
node scripts/audit-browser.js --url https://example.gov.ru/account \
  --standard wcag21aa \
  --session-config examples/session-config.example.json \
  --storage-state sandbox/auth/state.json \
  --capture-screenshots --run-id audit-2026-05-19 \
  --output sandbox/runs/account.json
```

Validate envelope:

```bash
node scripts/validate-results.js sandbox/contact.json
```

### 3. RU-specific manual checks

After automation, verify Order 953 items automation often misses:

| Letter | Check |
|---|---|
| а | Full keyboard + AT reading order |
| б | 200% zoom, no horizontal scroll, function preserved |
| в | PDF accessible or alternative linked |
| г | All non-text has text alternative |
| д | CAPTCHA has audio/text alternative (RU) |
| е | Titles and links descriptive in Russian |
| ж | Contrast 4.5:1 / 3:1 large text |
| з | Instructions not sensory-only |
| к | Auto-updating content pausable |
| л | No unexpected context change on focus |
| м | Form labels and textual errors |

Use [references/manual-check-guide.md](references/manual-check-guide.md) and [references/wcag-quickref.md](references/wcag-quickref.md).

### 4. Report

```bash
node scripts/generate-html-report.js sandbox/contact.json sandbox/contact.html
```

Deliver:

- JSON findings (`schemaVersion`, `metadata`, `summary`, `findings`)
- HTML report
- Markdown summary: scope, standard, top violations, Order 953 mapping, manual outcomes, limitations

Trend/baseline (repeat runs):

```bash
node scripts/aggregate-runs.js --input-dir sandbox/runs \
  --output sandbox/trends.json --html-output sandbox/trends.html \
  --baseline-run audit-2026-05-01
```

### 5. Project CI (optional cross-check)

Run the project's Playwright + axe a11y test when it has one (`.cursor/fstack/accessibility-audit.md` names the file and command).

Green CI ≠ AA. What is disabled and what to check by hand: the `accessibility` skill, § Verify.

## Manual Finding Shape

```json
{
  "source": "manual",
  "status": "violation",
  "impact": "serious",
  "pageUrl": "https://example.gov.ru/contact",
  "ruleId": "KB-02",
  "wcag": ["2.4.7"],
  "order953": "а",
  "selector": "button.submit",
  "summary": "Keyboard focus not visible on submit button.",
  "evidence": "outline removed in CSS",
  "remediation": "Restore :focus-visible indicator with sufficient contrast."
}
```

## Failure Handling

- Scan fails (auth, CSP, bot protection): partial result + manual path.
- Too many URLs: collapse to templates.
- SPA: use `audit-browser.js` or increase wait.
- Incomplete evidence → `needs-review`.

## Bundled Resources

| Path | Purpose |
|---|---|
| `scripts/audit.js` | Automated audit |
| `scripts/crawler.js` | Route discovery |
| `scripts/audit-browser.js` | Auth + screenshots |
| `scripts/crawler-browser.js` | Auth crawl |
| `scripts/generate-html-report.js` | HTML report |
| `scripts/aggregate-runs.js` | Trend reports |
| `scripts/validate-results.js` | JSON validation |
| `references/ru-federal-requirements.md` | Order 953 / Resolution 102 |
| `references/manual-check-guide.md` | Manual checklist |
| `references/wcag-quickref.md` | WCAG lookup |
| `references/legal-standards.md` | Jurisdiction mapping |
| `references/output-contract.md` | JSON schema fields |
| `schemas/a11y-audit.schema.json` | JSON schema |

## Guardrails

- No "fully accessible" from axe alone.
- State auth scope explicitly.
- Call out untested: PDFs, third-party embeds, mobile apps, citizen feedback process (Order 953 §3).

## Attribution

Scripts and references from [a11y-audit-agent-skill](https://github.com/jovd83/a11y-audit-agent-skill) (MIT), adapted for RU government baseline.
