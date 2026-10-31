# Manual Accessibility Check Guide

Use after automated scanning or when fixing complex UI. Targeted verification, not full certification.

## Priority Order

1. All scanner `needs-review` items
2. Keyboard-only main user flow
3. Semantics and landmarks
4. Forms, validation, error recovery
5. Contrast (text and non-text)
6. Custom widgets and live regions
7. Reflow at 320px; touch target size

## Keyboard

| ID    | Check              | Pass                                 | WCAG          |
| ----- | ------------------ | ------------------------------------ | ------------- |
| KB-01 | Tab order          | Logical sequence                     | 2.4.3         |
| KB-02 | Focus visibility   | Visible on every interactive element | 2.4.7, 2.4.13 |
| KB-03 | No trap            | Can leave every component            | 2.1.2         |
| KB-04 | Full operation     | Main tasks without mouse             | 2.1.1         |
| KB-05 | Skip mechanism     | Bypass repeated blocks               | 2.4.1         |
| KB-06 | Focus not obscured | Sticky UI does not hide focus        | 2.4.11        |

## Semantics And Screen Readers

| ID    | Check             | Pass                                              | WCAG         |
| ----- | ----------------- | ------------------------------------------------- | ------------ |
| SR-01 | Page title        | Meaningful, unique where needed                   | 2.4.2        |
| SR-02 | Headings          | Single h1, no skipped levels without reason       | 1.3.1        |
| SR-03 | Landmarks         | `header`, `nav`, `main`, `footer`                 | 1.3.1        |
| SR-04 | Text alternatives | Informative images/icons named                    | 1.1.1        |
| SR-05 | Link purpose      | Destination clear from text                       | 2.4.4        |
| SR-06 | Tables            | `th` scope/headers associated                     | 1.3.1        |
| SR-07 | Language          | `lang` on page and changes                        | 3.1.1, 3.1.2 |
| SR-08 | Status            | Updates announced (`role="status"` / `aria-live`) | 4.1.3        |

## Visual And Responsive

| ID    | Check             | Pass                                | WCAG   |
| ----- | ----------------- | ----------------------------------- | ------ |
| CV-01 | Text contrast     | 4.5:1 normal, 3:1 large             | 1.4.3  |
| CV-02 | Non-text contrast | 3:1 for UI parts                    | 1.4.11 |
| CV-03 | Not color-only    | Errors/status not color alone       | 1.4.1  |
| CV-04 | Text spacing      | 200% zoom, spacing overrides OK     | 1.4.12 |
| CV-05 | Reflow            | 320px width, no 2D scroll           | 1.4.10 |
| RF-01 | Orientation       | No forced orientation               | 1.3.4  |
| RF-02 | Touch targets     | ≥24×24 CSS px or equivalent spacing | 2.5.8  |

## Forms

| ID    | Check        | Pass                                               | WCAG         |
| ----- | ------------ | -------------------------------------------------- | ------------ |
| FM-01 | Labels       | Programmatic label for every control               | 1.3.1, 3.3.2 |
| FM-02 | Required     | Required state exposed                             | 3.3.2        |
| FM-03 | Errors       | Specific, textual, associated (`aria-describedby`) | 3.3.1, 3.3.3 |
| FM-04 | Prevention   | Confirm destructive/sensitive actions              | 3.3.4        |
| FM-05 | Autocomplete | Valid tokens on personal fields                    | 1.3.5        |

## Custom Widgets

| ID    | Check           | Pass                                   | WCAG         |
| ----- | --------------- | -------------------------------------- | ------------ |
| AR-01 | Roles/states    | Correct ARIA or native element         | 4.1.2        |
| AR-02 | State updates   | `aria-expanded`, `aria-selected`, etc. | 4.1.2        |
| AR-03 | Modals          | Focus trap, Esc close, focus restore   | 2.1.2, 2.4.3 |
| AR-04 | Combobox        | Keyboard + announcements               | 4.1.2        |
| AR-05 | Name/role/value | AT gets correct metadata               | 4.1.2        |

## Recording Fixes

For each finding: `checkId`, location, `status`, `impact`, `wcag[]`, summary, evidence, remediation. Use `needs-review` if uncertain.

Source: [a11y-audit-agent-skill manual-check-guide.md](https://github.com/jovd83/a11y-audit-agent-skill/blob/master/references/manual-check-guide.md).
