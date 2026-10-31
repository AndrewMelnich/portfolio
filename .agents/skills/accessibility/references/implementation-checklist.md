# Implementation Checklist

Apply while writing or reviewing markup, components (Astro / React / Vue), SCSS.

## Document And Page

- [ ] `<html lang="...">` matches page language
- [ ] Unique, descriptive `<title>`
- [ ] Skip link: first in `<body>`, targets `#main-content`; project markup in its a11y rule (`project.md`, Rules)
- [ ] One logical `<h1>` per page/view
- [ ] Landmarks: `header`, `nav`, `main`, `footer` (no duplicate `main`)
- [ ] `meta viewport` allows zoom (no `user-scalable=no`)

## Text And Media

- [ ] Informative images: meaningful `alt`
- [ ] Decorative images: `alt=""` and optionally `role="presentation"`
- [ ] Icons with meaning: visible text **or** `aria-label` on control
- [ ] Video with speech: `<track kind="captions">`. Transcript on page ≠ captions
- [ ] Audio-only if `<audio>` hidden from AT: full transcript in DOM next to player (`details` ok). Download `.txt` alone ≠ enough. Field `transcript` on parent block, not a new media type
- [ ] No autoplay with sound; native `controls` preferred, not required if custom play is named + keyboard
- [ ] Autoplay carousels/tickers: visible Pause/Stop **before** interaction (Order 953 к)
- [ ] SVG icons in controls: `aria-hidden="true"` on graphic if label is on parent

## Color And Typography

- [ ] Body text contrast ≥ **4.5:1** (≥ **3:1** if large text)
- [ ] UI boundaries/icons ≥ **3:1** against adjacent colors
- [ ] Information not conveyed by color alone (add text/icon/pattern)
- [ ] RU Resolution 102 draft: letter-spacing ≥ **0.12em** of font size, word-spacing ≥ **0.16em** where mandated
- [ ] Content reflows at **320px** width without horizontal scroll
- [ ] **200% zoom** (RU Order 953): no horizontal scroll, functionality preserved

## Keyboard And Focus

- [ ] All interactive elements reachable and operable by keyboard
- [ ] Visible `:focus-visible` (never remove without replacement)
- [ ] No `tabindex` > 0
- [ ] Modals: prefer `<dialog>`; else [focus-trap](https://github.com/focus-trap/focus-trap) with `escapeDeactivates`, `returnFocusOnDeactivate`, `isolateSubtrees`
- [ ] Modals: `dialog` or `role="dialog"` + `aria-modal="true"` + labelled (`aria-labelledby`)
- [ ] Modals: initial focus inside, Tab cycles, **Esc closes**, focus returns to trigger
- [ ] Modals: background inert (`inert` / `aria-hidden` on page behind overlay); no focus under overlay
- [ ] No broken focus trap (user can always leave open modal via Esc/close)
- [ ] Dropdowns/menus: Arrow keys, Esc, typeahead where expected

## Links And Buttons

- [ ] Links use `<a href>` for navigation; buttons use `<button type>` for actions
- [ ] No `role="button"` on `<a href>` (SKILL.md, Core Rules)
- [ ] Repeated controls have distinct accessible names (project a11y rule, `project.md` Rules)
- [ ] No nested interactive inside a play/card link (`<object>` wrapping `<a>` is not a fix)
- [ ] Link text describes destination (avoid "more", "here" alone)
- [ ] `target="_blank"`: warn user (`rel` + text if needed)
- [ ] Disabled controls: use `disabled` or `aria-disabled` with explanation if required

## Forms

- [ ] Every input has `<label for>` or `aria-label` / `aria-labelledby`
- [ ] Group related fields (`fieldset` / `legend` or `role="group"`)
- [ ] Errors: text + `aria-invalid="true"` + `aria-describedby` to error id
- [ ] Required fields indicated in text, not color alone (`required` / `aria-required`)
- [ ] `autocomplete` on personal data fields
- [ ] CAPTCHA (RU gov): audio/text/alternative path

## Dynamic Content

- [ ] Carousels/tickers: Pause/Stop control
- [ ] `@media (prefers-reduced-motion: reduce)`: disable autoplay, shorten/remove transitions, `scroll-behavior: auto` (WCAG 2.3.3)
- [ ] JS libraries (Swiper, GSAP): check `matchMedia("(prefers-reduced-motion: reduce)")` before autoplay/parallax
- [ ] No content flashing **>3 times/second**
- [ ] SPA updates: `aria-live="polite"` or `role="status"` for important messages
- [ ] Focus not moved unexpectedly on input (WCAG 3.2.1)

## Tables

- [ ] Data tables: `<th scope="col|row">`, caption if helpful
- [ ] Layout tables avoided for data

## ARIA (when native HTML is insufficient)

- [ ] Prefer native `<button>`, `<details>`, `<dialog>`, `<select>`
- [ ] `aria-expanded`, `aria-controls` on disclosure widgets
- [ ] `aria-current="page"` on active nav item
- [ ] No redundant roles (e.g. `role="button"` on `<button>`)

## PDF And Downloads (RU gov)

- [ ] Tagged PDF per GOST R 70176-2022 **or** HTML/text alternative linked

## Before Merge

- [ ] Run Playwright a11y test if page is in test matrix
- [ ] Manual pass on changed flow per [manual-check-guide.md](manual-check-guide.md)
- [ ] List WCAG IDs in PR/commit notes for non-trivial fixes
