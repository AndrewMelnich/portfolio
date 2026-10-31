# Legal Standards Mapping

**Default for this project:** Order 953 + GOST R 52872-2019 — see [ru-federal-requirements.md](ru-federal-requirements.md).

Use this file for international comparison or non-RU scope.

## Mapping Table

| Context | Practical Baseline | Notes |
|---|---|---|
| WCAG 2.2 AA | `wcag22aa` | Strong default for modern web audits |
| WCAG 2.1 AA | `wcag21aa` | Still widely referenced in policy and procurement |
| Section 508 | `section508` | US federal baseline, largely aligned to WCAG 2.0 AA |
| EN 301 549 | `en301549` | EU accessibility standard; includes non-web obligations beyond WCAG |
| ADA web risk review | `wcag21aa` | ADA is not itself a technical spec; WCAG AA is the usual benchmark |
| AODA / IASR | `wcag20aa` minimum | WCAG 2.1 AA is often a better forward-looking target |

## Reporting Guardrails

- Say "aligned to" or "benchmarked against" when the legal standard is broader than the tested web scope.
- If the product includes documents, mobile apps, hardware, or support channels, call out those untested areas explicitly.
- For ADA requests, frame the result as a risk-oriented accessibility assessment rather than definitive legal compliance.

## Extra Obligations Worth Calling Out

- EN 301 549 can require checks beyond a website page audit.
- Section 508 includes functional performance considerations.
- Regional frameworks may mandate statements, governance, or procurement obligations that this skill does not assess.
