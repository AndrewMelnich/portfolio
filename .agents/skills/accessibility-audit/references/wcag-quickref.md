# WCAG Quick Reference

Use this file to map common audit findings to likely WCAG criteria. It is intentionally compact and optimized for audit work.

## Common Criteria By Audit Theme

| Theme | Typical Issues | WCAG |
|---|---|---|
| Text alternatives | Missing or poor alt text, unlabeled icons | 1.1.1 |
| Structure and semantics | Broken heading order, missing landmarks, bad table markup | 1.3.1 |
| Reading sequence | Visual order and DOM order diverge | 1.3.2 |
| Orientation | Content breaks in portrait or landscape | 1.3.4 |
| Input purpose | Missing autocomplete tokens on personal-data fields | 1.3.5 |
| Text contrast | Low contrast text | 1.4.3 |
| Reflow | Horizontal scrolling at narrow width or high zoom | 1.4.10 |
| Non-text contrast | Low-contrast controls and icons | 1.4.11 |
| Text spacing | Layout breaks under user spacing overrides | 1.4.12 |
| Hover and focus content | Tooltip or popup cannot be dismissed or hovered | 1.4.13 |
| Keyboard access | Click-only behavior | 2.1.1 |
| Keyboard trap | Focus cannot escape a widget | 2.1.2 |
| Bypass blocks | Missing skip link or equivalent | 2.4.1 |
| Page titles | Generic or duplicate titles | 2.4.2 |
| Focus order | Illogical tab order | 2.4.3 |
| Link purpose | Ambiguous link text | 2.4.4 |
| Focus visible | No visible focus style | 2.4.7 |
| Focus obscured | Sticky UI hides the focused control | 2.4.11, 2.4.12 |
| Focus appearance | Focus indicator too small or too low contrast | 2.4.13 |
| Label in name | Spoken label does not match visible label | 2.5.3 |
| Dragging alternatives | Drag-only interaction | 2.5.7 |
| Target size | Touch targets too small | 2.5.8 |
| Language | Missing page language or language changes | 3.1.1, 3.1.2 |
| Predictability | Unexpected context changes | 3.2.1, 3.2.2 |
| Consistency | Navigation or help appears inconsistently | 3.2.3, 3.2.6 |
| Error handling | Errors unclear or not actionable | 3.3.1, 3.3.3 |
| Accessible authentication | Cognitive-function tests block access | 3.3.8, 3.3.9 |
| Name, role, value | Custom controls lack usable semantics | 4.1.2 |
| Status messages | Dynamic updates are not announced | 4.1.3 |

## Automation Guidance

- Usually automatable: titles, missing labels, some contrast checks, some ARIA misuse, some link-purpose cases
- Partially automatable: semantics, reflow, status messages, focus indicators, target size
- Usually manual: keyboard task completion, cognitive load, meaningful sequence, unexpected changes, media alternatives

## Conformance Reminder

Automation provides evidence for specific failures. It does not prove complete conformance.
