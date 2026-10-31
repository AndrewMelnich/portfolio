# WCAG Quick Reference

Map findings and fixes to success criteria. Compact table for implementation work.

## Common Criteria By Theme

| Theme               | Typical issues                                 | WCAG           |
| ------------------- | ---------------------------------------------- | -------------- |
| Text alternatives   | Missing/poor `alt`, unlabeled icons            | 1.1.1          |
| Structure           | Broken headings, missing landmarks, bad tables | 1.3.1          |
| Reading sequence    | Visual vs DOM order mismatch                   | 1.3.2          |
| Orientation         | Forced portrait/landscape                      | 1.3.4          |
| Input purpose       | Missing `autocomplete` on personal data        | 1.3.5          |
| Text contrast       | Low contrast text                              | 1.4.3          |
| Reflow              | Horizontal scroll at 320px or 200% zoom        | 1.4.4, 1.4.10  |
| Non-text contrast   | Low-contrast controls/icons                    | 1.4.11         |
| Text spacing        | Layout breaks under user spacing               | 1.4.12         |
| Hover/focus content | Tooltip not dismissible/hoverable              | 1.4.13         |
| Keyboard access     | Click-only behavior                            | 2.1.1          |
| Keyboard trap       | Cannot escape widget                           | 2.1.2          |
| Bypass blocks       | No skip link                                   | 2.4.1          |
| Page titles         | Generic/duplicate `<title>`                    | 2.4.2          |
| Focus order         | Illogical tab order                            | 2.4.3          |
| Link purpose        | "Click here", icon-only links                  | 2.4.4          |
| Focus visible       | `outline: none` without replacement            | 2.4.7, 2.4.13  |
| Focus obscured      | Sticky header covers focus                     | 2.4.11, 2.4.12 |
| Label in name       | Visible vs accessible name mismatch            | 2.5.3          |
| Dragging            | Drag-only with no alternative                  | 2.5.7          |
| Target size         | Small touch targets                            | 2.5.8          |
| Language            | Missing `lang`                                 | 3.1.1, 3.1.2   |
| Predictability      | Unexpected context change on focus             | 3.2.1, 3.2.2   |
| Error handling      | Vague errors                                   | 3.3.1, 3.3.3   |
| Authentication      | CAPTCHA blocks access                          | 3.3.8, 3.3.9   |
| Name, role, value   | Custom widget semantics                        | 4.1.2          |
| Status messages     | AJAX updates not announced                     | 4.1.3          |

## Automation vs Manual

| Usually automatable                              | Partially                                   | Usually manual                                          |
| ------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------- |
| Titles, missing labels, some contrast, some ARIA | Semantics, reflow, focus style, target size | Keyboard tasks, meaningful sequence, media alternatives |

**Conformance reminder:** Passing axe does not prove full WCAG conformance.

Source: [a11y-audit-agent-skill wcag-quickref.md](https://github.com/jovd83/a11y-audit-agent-skill/blob/master/references/wcag-quickref.md).
