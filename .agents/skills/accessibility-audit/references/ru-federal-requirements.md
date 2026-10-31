# Russian Federal Requirements (Official Government Websites)

Technical baseline: **GOST R 52872-2019** (web interfaces). Order 953 makes GOST clauses mandatory for official sites of state bodies, local government, and subordinate organizations.

## Order 953 (effective 2024-09-01)

Source: Ministry of Digital Development Order No. 953 of 2023-11-07.

| Letter | Requirement (summary) | GOST / WCAG anchor |
|---|---|---|
| а | Keyboard access without time limits; AT reads structure and sequence | GOST 3.1.13, 4.1.3, 4.2.4 → WCAG 2.1.1, 2.1.2, 1.3.1, 1.3.2 |
| б | Text scales to **200%** without loss of function and **without horizontal scroll** | GOST 4.1.x → WCAG 1.4.4, 1.4.10 |
| в | PDFs tagged per **GOST R 70176-2022** or accessible alternative provided | PDF/UA practice |
| г | Non-text content has text alternative readable by AT | GOST 4.1.1 → WCAG 1.1.1 |
| д | CAPTCHA in accessible form for blind users (RU language) | GOST 3.1.26 → WCAG 1.1.1, 3.3.8 |
| е | Page titles and links have **descriptive** text | GOST 4.2.4 → WCAG 2.4.2, 2.4.4 |
| ж | **Optimal contrast** per GOST | GOST 4.1.4 → WCAG 1.4.3, 1.4.11 |
| з | Instructions not **sensory-only** (shape, color, size, position, sound) | GOST 4.1.3 → WCAG 1.3.3 |
| и | UI feedback uses text/sound, not color alone | GOST 4.1.3 → WCAG 1.4.1, 4.1.3 |
| к | Auto-updating content can be **stopped/hidden/frequency changed** | GOST 4.2.2 → WCAG 2.2.2, 2.3.1 |
| л | Focus does not change context unexpectedly | GOST 4.3.2 → WCAG 3.2.1 |
| м | Forms have text labels; errors described in text | GOST 4.3.3 → WCAG 3.3.1, 3.3.2, 3.3.3 |
| §3 | Mechanism for citizens to report accessibility barriers | Process / content page |

### GOST R 52872-2019 contrast (typical interpretation)

Align with WCAG 2.1 AA unless Resolution 102 numeric rules apply:

- Normal text: **4.5:1**
- Large text (≥18pt regular or ≥14pt bold): **3:1**
- Non-text UI components and graphics: **3:1** where required

## Upcoming: Government Resolution 102 (draft, from 2026-03-01)

Per project briefing (`Изменения.docx`). Replaces Order 953 with binding **Requirements** (normative-technical, not procedural). PDF draft in repo is image-only; treat items below as **planned** until officially published.

| Change | Implementation implication |
|---|---|
| All assistive technologies | Test beyond JAWS/NVDA: magnifiers, Braille displays, speech engines |
| Contrast | Text **≥4.5:1**; large text **≥3:1** (explicit) |
| Text spacing | Letter-spacing **≥0.12×** font size; word-spacing **≥0.16×** font size |
| Non-text alternatives | Every image, video, button, CAPTCHA, infographic needs text alternative |
| Structure | Correct reading order and semantics for screen readers |
| Motion | User can pause/stop animation; no flash **>3/sec** |
| CAPTCHA | Multiple alternatives: audio, text, other sensory paths |

When user says "Resolution 102" or "March 2026 rules", apply both Order 953/GOST baseline and the draft requirements above; flag legal text as draft.

## Implementation Notes

- **Visually impaired version** (отдельная версия для слабовидящих): if the product uses a dedicated low-vision theme, ensure the default site still meets Order 953; the special version is additive, not a substitute for base conformance.
- **Language**: `html lang="ru"`; mark language changes with `lang` on inline elements.
- **Documents**: prefer accessible HTML over PDF; if PDF is required, tag per GOST R 70176-2022.
