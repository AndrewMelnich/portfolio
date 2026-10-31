# Manual Accessibility Check Guide

Use this guide after automated scanning. It is optimized for targeted manual verification rather than exhaustive certification work.

## Priority Order

1. Verify all `needs-review` findings from the scanner.
2. Test keyboard-only access across the main user flow.
3. Check semantics and landmarks.
4. Check forms, validation, and error recovery.
5. Check visual contrast and non-text contrast.
6. Check custom widgets and dynamic announcements.
7. Check responsive reflow and target size on narrow viewports.

## Keyboard

| ID | Check | Pass Criteria | WCAG |
|---|---|---|---|
| KB-01 | Tab order | Focus moves in a logical order | 2.4.3 |
| KB-02 | Focus visibility | Every interactive element shows visible focus | 2.4.7, 2.4.13 |
| KB-03 | No keyboard trap | Users can leave every component with keyboard alone | 2.1.2 |
| KB-04 | Full keyboard operation | Main tasks complete without a mouse | 2.1.1 |
| KB-05 | Skip mechanism | Repeated content can be bypassed | 2.4.1 |
| KB-06 | Focus not obscured | Sticky UI does not fully hide focused controls | 2.4.11 |

## Semantics And Screen Reader Support

| ID | Check | Pass Criteria | WCAG |
|---|---|---|---|
| SR-01 | Page title | Each page has a meaningful title | 2.4.2 |
| SR-02 | Heading hierarchy | Headings are ordered and structurally meaningful | 1.3.1 |
| SR-03 | Landmarks | Major regions use appropriate landmarks | 1.3.1 |
| SR-04 | Text alternatives | Informative visuals have meaningful alternatives | 1.1.1 |
| SR-05 | Link purpose | Link text communicates destination or action | 2.4.4 |
| SR-06 | Data tables | Headers and relationships are programmatic | 1.3.1 |
| SR-07 | Language | Page and language changes are identified | 3.1.1, 3.1.2 |
| SR-08 | Status messages | Important updates are announced without moving focus | 4.1.3 |

## Visual And Responsive Checks

| ID | Check | Pass Criteria | WCAG |
|---|---|---|---|
| CV-01 | Text contrast | Regular text meets 4.5:1, large text meets 3:1 | 1.4.3 |
| CV-02 | Non-text contrast | Controls and icons meet 3:1 where required | 1.4.11 |
| CV-03 | Color dependency | Color is not the only way information is conveyed | 1.4.1 |
| CV-04 | Text spacing | Increased spacing does not break content | 1.4.12 |
| CV-05 | Reflow | Content works at 320 CSS px without 2D scrolling | 1.4.10 |
| RF-01 | Orientation | Content does not force one orientation unnecessarily | 1.3.4 |
| RF-02 | Touch targets | Targets are large enough or adequately spaced | 2.5.8 |

## Forms

| ID | Check | Pass Criteria | WCAG |
|---|---|---|---|
| FM-01 | Labels | Controls have programmatic labels | 1.3.1, 3.3.2 |
| FM-02 | Required state | Required fields are identified accessibly | 3.3.2, 1.4.1 |
| FM-03 | Error handling | Errors are textual, specific, and actionable | 3.3.1, 3.3.3 |
| FM-04 | Error prevention | Sensitive submissions are reversible or confirmed | 3.3.4 |
| FM-05 | Autocomplete | Personal-data fields use appropriate autocomplete tokens | 1.3.5 |
| FM-06 | Redundant entry | Re-entering known data is avoided where required | 3.3.7 |

## Custom Widgets

| ID | Check | Pass Criteria | WCAG |
|---|---|---|---|
| AR-01 | Roles and states | Custom widgets expose correct semantics | 4.1.2 |
| AR-02 | State updates | Expanded, selected, and similar states update correctly | 4.1.2 |
| AR-03 | Modal behavior | Dialogs trap focus, close cleanly, and restore focus | 2.1.2, 2.4.3 |
| AR-04 | Combobox behavior | Suggestions are keyboard-accessible and announced | 4.1.2 |
| AR-05 | Name, role, value | Assistive tech receives correct control metadata | 4.1.2 |

## Recording Format

For manual findings, capture:

- `checkId`
- `pageUrl`
- `selector` or component description
- `status`
- `impact`
- `wcag`
- `summary`
- `evidence`
- `remediation`

If confidence is low, use `needs-review` instead of `violation`.
