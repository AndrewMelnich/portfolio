# Legal Standards Mapping

**This project defaults to Russian government official sites.** Use the Russian Federation section below first.

Use international mapping when comparing frameworks or procurement outside RU.

## International Mapping

| Context             | Practical baseline | Notes                                                       |
| ------------------- | ------------------ | ----------------------------------------------------------- |
| WCAG 2.2 AA         | `wcag22aa`         | Default for modern web work                                 |
| WCAG 2.1 AA         | `wcag21aa`         | Still common in policy and contracts                        |
| Section 508         | `section508`       | US federal; largely aligned to WCAG 2.0 AA                  |
| EN 301 549          | `en301549`         | EU; includes non-web obligations beyond WCAG                |
| ADA web risk review | `wcag21aa`         | ADA is not a technical spec; WCAG AA is the usual benchmark |
| AODA / IASR         | `wcag20aa` minimum | WCAG 2.1 AA is often a better forward target                |

## Russian Federation (official government websites)

| Context                   | Practical baseline                           | Legal anchor                                                                                                              |
| ------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Current (from 2024-09-01) | GOST R 52872-2019 via Order 953              | [Ministry of Digital Order No. 953](https://www.consultant.ru/document/cons_doc_LAW_462353/) — procedure referencing GOST |
| PDF documents on site     | GOST R 70176-2022 or accessible alternative  | Order 953 §1(в)                                                                                                           |
| From 2026-03-01 (planned) | Stricter numeric + CAPTCHA + AT requirements | Draft Government Resolution replacing Order 953 (Resolution 102)                                                      |

GOST R 52872-2019 is harmonized with **WCAG 2.1** (not 2.2). When implementing for RU gov sites, satisfy GOST/Order 953 first; add WCAG 2.2 criteria where they do not conflict.

## Reporting Guardrails

- Say **aligned to** or **benchmarked against** when the legal standard is broader than the code you changed.
- Untested: mobile apps, PDFs not linked, third-party widgets, phone support, hardware AT.
- For ADA: frame as risk-oriented assessment, not legal compliance certification.
- For RU gov: cite Order 953 letters (а–м) and GOST clauses; note Resolution 102 if user targets post-2026 rules.

## Extra Obligations

- EN 301 549: governance, procurement, non-web ICT.
- Section 508: functional performance criteria.
- RU: citizen feedback channel for inaccessible content (Order 953 §3; Federal Law 59-FZ).

Adapted from [a11y-audit-agent-skill legal-standards.md](https://github.com/jovd83/a11y-audit-agent-skill/blob/master/references/legal-standards.md).
