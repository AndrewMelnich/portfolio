---
name: accessibility
description: Russian federal accessibility workflow — Order 953, GOST R 52872-2019, WCAG 2.1 AA mapping, Resolution 102. Use when implementing or reviewing against that baseline (CAPTCHA alternative, tagged PDF, contrast letters, Playwright + axe a11y test).
---

# Accessibility (Apply Rules) — RU Government Sites

Project overrides: read `.cursor/fstack/project.md` and `.cursor/fstack/accessibility.md` from the repo root when present; they win over this file.

Apply accessibility requirements during implementation and review on **official websites of Russian state and municipal bodies** (and subordinate organizations).

**Legal baseline:** Order 953 (from 2024-09-01) → **GOST R 52872-2019** (harmonized with WCAG 2.1). **Planned:** Government Resolution 102 (from 2026-03-01) — see [references/legal-standards.md](references/legal-standards.md).

## Core Rules

1. Default standard: **GOST R 52872-2019 / WCAG 2.1 Level AA** via Order 953 letters (а–м).
2. Map every non-trivial fix to WCAG success criterion **and** Order 953 letter where applicable.
3. Do not claim legal certification. Say **aligned to** or **benchmarked against** Order 953 and GOST.
4. Prefer native HTML semantics over ARIA. No `role="button"` on `<a href>`.
5. Never remove focus outlines without an equally visible replacement.
6. Automation (axe, Playwright) is triage only — not proof of full conformance.
7. After 2026-03-01, also apply draft Resolution 102 requirements (contrast numbers, spacing, CAPTCHA alternatives, all AT).
8. Honor **`prefers-reduced-motion`** (WCAG 2.3.3). SCSS placement: see **`prefers-reduced-motion`** below.

## Workflow

### 1. Scope the task

Confirm:

- **Mode**: implement, fix issue, or review diff/PR
- **Surface**: page, component, form, modal, media, PDF, CAPTCHA
- **Assistive tech** (if known): NVDA, JAWS, VoiceOver, magnifier, Braille display

### 2. Apply requirements

Use [references/implementation-checklist.md](references/implementation-checklist.md) and [references/legal-standards.md](references/legal-standards.md).

Priority:

1. Blockers: keyboard traps, missing names, no focus, CAPTCHA without alternative
2. Order 953 (а)(г)(е)(ж): keyboard/AT, alt text, link/title text, contrast
3. Order 953 (б): 200% zoom without horizontal scroll
4. Order 953 (к)(м): motion control, forms/errors
5. PDF (в): tagged PDF or accessible alternative

### 3. Verify

**Playwright + axe (project test)**

Run the project's Playwright + axe a11y test when it has one (`.cursor/fstack/accessibility.md` names the file, the command, and which rules/impacts it skips).

A typical triage test reports serious/critical only and disables rules such as `color-contrast` and `image-alt`. Green CI does not prove AA. Alt, keyboard on carousels without links, control names, media — by hand, VoiceOver, or the `accessibility-audit` skill.

**Manual:** [references/manual-check-guide.md](references/manual-check-guide.md)

### 4. Report changes

Per fix: what was wrong, WCAG ID, Order 953 letter (а–м), verification method. Use `needs-review` if uncertain.

## Quick Patterns

### Images

```html
<img src="gerb.png" alt="Герб Российской Федерации" width="48" height="48" />
<img src="divider.svg" alt="" />
```

### Icon-only control

```html
<button type="button" aria-label="Открыть поиск">
  <Icon name="search" aria-hidden="true" />
</button>
```

### Skip link

Follow the project's skip-link markup in its a11y rule (`project.md`, Rules). Target: `<main id="main-content" tabindex="-1">`.

### Visible focus (WCAG 2.4.7, Order 953 г)

```scss
:focus-visible {
  outline: 2px solid var(--focus-ring-color, currentColor);
  outline-offset: 2px;
}
```

**Do not make non-interactive containers focusable** — a common 2.4.7 audit failure:

| ❌                                                                   | ✅                                                                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `<ul class="carousel-list" tabindex="0">` for arrow keys             | Tab/arrows via links/buttons inside slides; carousel rules in the project's a11y rule (`project.md`, Rules) |
| `<div role="tabpanel" tabindex="0">` when buttons/fields are inside  | `tabindex="-1"` or no tabindex; Tab goes into the content                                                     |
| `<div class="wysiwyg" tabindex="0">` in a closed popup               | Remove tabindex; initial focus — `[data-dialog-initial-focus]` or close                                       |

Allowed `tabindex="-1"`: `#main-content` (skip link), popup heading for programmatic focus.

### Live region

```html
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  class="visually-hidden"
>
  {statusMessage}
</div>
```

Media seek slider: do not set `aria-valuetext` on every `timeupdate` — `references/live-regions.md` in the `aria-patterns` skill, § Media seek sliders.

### Motion / CAPTCHA

- Carousel: visible **Пауза** / **Стоп**; no flash >3/sec (Order 953 к, Resolution 102 draft).
- CAPTCHA: audio/text/alternative (Order 953 д).

### `prefers-reduced-motion` (WCAG 2.3.3)

Honor the user/OS setting. Non-essential motion must scale down or stop; essential state changes stay available without animation.

SCSS: `@media` **inside** the class that has `transition` / `animation` (the project's CSS rule in `project.md`, Rules, may say more). Do not dump a file-scope `*` / `!important` block.

**JS (GSAP, Swiper, custom)** — read the media query before starting loops:

```js
const reduceMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

if (reduceMotion) {
  // no autoplay; static first slide; disable parallax / scroll-linked motion
} else {
  // autoplay OK if Pause/Stop still present (Order 953 к)
}

window
  .matchMedia("(prefers-reduced-motion: reduce)")
  .addEventListener("change", (e) => {
    if (e.matches) stopAutoplayAndAnimations();
    else restoreMotionIfUserAllows();
  });
```

**Checklist**

- [ ] Autoplay carousels, tickers, parallax, scroll-jacking respect `reduce`
- [ ] Pause/Stop still works when motion is enabled (Order 953 к)
- [ ] No vestibular triggers: flashing >3/sec, large parallax, infinite zoom/pulse
- [ ] `scroll-behavior: smooth` disabled under `reduce` (or use instant scroll)
- [ ] Test: macOS **System Settings → Accessibility → Display → Reduce motion**, or Chrome DevTools **Rendering → Emulate prefers-reduced-motion**

### Modal focus (WCAG 2.1.2, 2.4.3, 4.1.2)

**Wrong:** focus enters modal and cannot leave (broken trap), or Esc does nothing, or focus stays behind overlay after close.

**Right:** trap focus **only while open**; user can always exit with **Esc** or explicit close; focus returns to trigger.

Prefer native `<dialog>`:

```html
<dialog id="search-popup" aria-labelledby="search-title">
  <h2 id="search-title">Поиск</h2>
  <form method="get" action="/search/">
    <label for="search-q">Что ищем</label>
    <input id="search-q" type="search" name="q" />
    <button type="submit">Найти</button>
  </form>
  <button type="button" data-dialog-close>Закрыть</button>
</dialog>
```

```js
const dialog = document.getElementById("search-popup");
const opener = document.querySelector("[data-open-search]");

opener?.addEventListener("click", () => dialog.showModal());

dialog.addEventListener("close", () => opener?.focus());
dialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  dialog.close();
});

dialog.querySelectorAll("[data-dialog-close]").forEach((btn) => {
  btn.addEventListener("click", () => dialog.close());
});
```

**Custom overlay (no `<dialog>`):** use [focus-trap](https://github.com/focus-trap/focus-trap) — vanilla JS trap for Tab/Shift+Tab inside a container. React: [focus-trap-react](https://github.com/focus-trap/focus-trap-react).

```bash
npm install focus-trap
```

```js
import { createFocusTrap } from "focus-trap";

const modal = document.querySelector(".search-popup");
let trap = null;
let opener = null;

function openModal(trigger) {
  opener = trigger;
  modal.hidden = false;

  trap = createFocusTrap(modal, {
    escapeDeactivates: true, // Esc closes (default) — WCAG 2.1.2
    returnFocusOnDeactivate: true, // focus back to opener (default)
    allowOutsideClick: true, // or clickOutsideDeactivates: true to close
    initialFocus: () => modal.querySelector("input, button, [href]"),
    fallbackFocus: modal, // tabindex="-1" on modal if empty momentarily
    preventScroll: true,
    isolateSubtrees: "inert", // hide background from AT (Safari: enable Tab highlights)
    onActivate: () => modal.classList.add("is-open"),
    onDeactivate: () => {
      modal.classList.remove("is-open");
      modal.hidden = true;
    },
    // Animated open: gate activation until visible
  });

  trap.activate();
}

function closeModal() {
  trap?.deactivate();
  trap = null;
}

document.querySelector("[data-open-search]")?.addEventListener("click", (e) => {
  openModal(e.currentTarget);
});
modal.querySelectorAll("[data-modal-close]").forEach((btn) => {
  btn.addEventListener("click", closeModal);
});
```

focus-trap rules:

- [ ] Container has ≥1 tabbable node when open (or `fallbackFocus` with `tabindex="-1"`)
- [ ] **activate** after DOM ready (dynamic content: `trap.updateContainerElements()`)
- [ ] **deactivate** on close; never leave trap active on hidden modal
- [ ] Nested modals: library auto-pauses outer trap — use `trap.pause()` / `unpause()` for menus inside dialog
- [ ] Do not set `escapeDeactivates: false` unless user must confirm (offer visible cancel)
- [ ] `isolateSubtrees: "inert"` conflicts with `clickOutsideDeactivates` — pick one UX pattern
- [ ] First/last tabbable: prefer `<button>` / `<input>`, not iframe/video at edges
- [ ] Safari: **Preferences → Advanced → Press Tab to highlight each item** or trap behaves oddly

Custom overlay checklist:

- [ ] `role="dialog"` + `aria-modal="true"` + `aria-labelledby` / `aria-label`
- [ ] On open: move focus to first focusable (or dialog container with `tabindex="-1"`)
- [ ] **Tab** / **Shift+Tab** cycle inside modal only
- [ ] **Esc** closes; focus returns to element that opened dialog
- [ ] Background inert: `inert` on `<main>` or `aria-hidden="true"` on siblings (not on dialog subtree)
- [ ] No focus on elements under semi-transparent overlay
- [ ] Scroll locked on body OK; keyboard user not stuck

### Auto-playing media (WCAG 2.2.2; Order 953 к)

**Wrong:** carousel/video/audio starts automatically with no pause, or sound autoplays, or ticker cannot be stopped.

**Right:** autoplay only for **silent** decorative loops; always provide visible **Пауза** / **Стоп**; respect `prefers-reduced-motion`.

```html
<section
  class="hero-carousel"
  aria-roledescription="carousel"
  aria-label="Афиша"
>
  <button type="button" class="hero-carousel__pause" aria-pressed="false">
    Пауза
  </button>
  <!-- slides -->
</section>
```

```html
<video controls preload="metadata" poster="preview.jpg">
  <source src="promo.mp4" type="video/mp4" />
  <track
    kind="captions"
    src="promo.ru.vtt"
    srclang="ru"
    label="Русский"
    default
  />
</video>
```

Native `controls` — preferred, not required.

| Clip | AT and media |
| --- | --- |
| Speech / meaning in audio | `<track kind="captions">` required (`kind` is not `subtitles`). Custom play is OK if named and in Tab |
| Decor, `muted` + loop, no speech | Media container `aria-hidden="true"`, no track |
| Custom play | Unique name (no two identical labels on one page); no nested second link/button; `<video tabindex="-1">` OK if controls are outside |

Auto-captions without human review are not WCAG.

Rules:

- [ ] No `autoplay` with sound; `muted` alone is not enough for essential UI
- [ ] Carousels/tickers: pause control before first interaction (Order 953 к)
- [ ] Under `prefers-reduced-motion: reduce`: no autoplay; show first slide/static frame
- [ ] iframe embeds (YouTube, etc.): meaningful `title`; prefer `?autoplay=0` unless user started playback

## Common Issues (review pass)

When auditing a page, explicitly check:

1. Insufficient color contrast
2. Missing form labels
3. No keyboard access to interactive elements
4. Missing alt text on meaningful images
5. **Focus traps in modals** (cannot exit, focus lost, no Esc)
6. Missing ARIA landmarks
7. **Auto-playing media without controls** (carousel, video, audio, ticker)
8. Time limits without extension options
9. **Duplicate accessible names** on repeated widgets (two `aria-label="Смотреть видео"`, three `section aria-label="Галерея"`)

## Project Hooks

- The project's a11y test, if any (`.cursor/fstack/accessibility.md`)
- Semantic regions: `header`, `nav`, `main`, `footer`, `section`
- `<ul>`: reset list styles per project convention (`project.md`)
- `html lang="ru"`; `lang` on inline language changes

## References

| File                                                                  | When                            |
| --------------------------------------------------------------------- | ------------------------------- |
| [legal-standards.md](references/legal-standards.md)                   | Order 953, GOST, Resolution 102 |
| [implementation-checklist.md](references/implementation-checklist.md) | Any UI change                   |
| [wcag-quickref.md](references/wcag-quickref.md)                       | WCAG mapping                    |
| [manual-check-guide.md](references/manual-check-guide.md)             | Manual verification             |

## Guardrails

- Do not mark accessible based on axe alone.
- No `tabindex` > 0; no `title`-only names.
- No `tabindex="0"` on non-interactive containers (`ul`/`div`/`section`) — see **Visible focus** above (WCAG 2.4.7).
- PDF: GOST R 70176-2022 or HTML/text alternative.
- Untested: auth flows, third-party widgets, mobile apps.

## Attribution

Checklists adapted from [a11y-audit-agent-skill](https://github.com/jovd83/a11y-audit-agent-skill) (MIT), [accessibility-review](https://github.com/anthropics/knowledge-work-plugins/blob/a0fda662dd52f2704c43a57ea38ff7de647b013f/design/skills/accessibility-review/SKILL.md), and [focus-trap](https://github.com/focus-trap/focus-trap).
