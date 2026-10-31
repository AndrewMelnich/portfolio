# Output Contract

The canonical output of `scripts/audit.js` is a JSON envelope.

## Top-Level Shape

```json
{
  "schemaVersion": "1.0.0",
  "metadata": {},
  "summary": {},
  "findings": []
}
```

## Metadata

| Field | Type | Meaning |
|---|---|---|
| `url` | string | Audited page URL |
| `tool` | string | `axe`, `pa11y`, or `lighthouse` |
| `standard` | string | Standards flag used by the run |
| `waitMs` | number | Configured wait before scan |
| `generatedAt` | string | ISO timestamp |
| `runId` | string or null | Logical group for multiple audited pages in the same run |
| `runLabel` | string or null | Human-readable label for the run |
| `mode` | string | `cli` or `browser` |
| `session` | object or null | Browser-session metadata when applicable |

## Summary

`summary` contains:

- `total`
- `byImpact`
- `byStatus`

## Finding Fields

| Field | Required | Meaning |
|---|---|---|
| `source` | yes | `automated` or `manual` |
| `tool` | recommended | Source tool if applicable |
| `status` | yes | `violation`, `needs-review`, or `pass` |
| `impact` | yes | `critical`, `serious`, `moderate`, or `minor` |
| `pageUrl` | recommended | Page where the issue was observed |
| `ruleId` | yes | Scanner rule or manual check identifier |
| `wcag` | recommended | Array of mapped WCAG references |
| `selector` | optional | CSS selector or target description |
| `html` | optional | Relevant snippet |
| `summary` | yes | Short human-readable finding title |
| `evidence` | optional | Why the issue is believed to exist |
| `remediation` | optional | Practical fix guidance |
| `helpUrl` | optional | Tool or standards reference |

## Semantics

- `violation`: evidence is strong enough to treat the issue as confirmed
- `needs-review`: tool or reviewer has insufficient confidence for a confirmed failure
- `pass`: an explicitly checked item passed; use sparingly to avoid noisy reports

## Reporting Guidance

- Keep automated and manual findings in the same envelope only if `source` is populated correctly.
- Do not invent `wcag` mappings when you do not have enough evidence.
- Preserve raw evidence where practical so later reviewers can audit your audit.
- When screenshots are captured, store them relative to the report/output directory and include a `screenshot` field on the finding.
