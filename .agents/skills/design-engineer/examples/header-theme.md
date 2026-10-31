# Header theme

Section-driven chrome for a fixed header. Port of the Lux strip probe: sections declare the theme; JS only resolves which section sits under the header and toggles one class.

## Shape

```ts
// shared/config/header-theme.ts
HEADER_THEME = { light: 'light', transparent: 'transparent' }
type HeaderTheme = (typeof HEADER_THEME)[keyof typeof HEADER_THEME]
```

Add a token only when a new visual state exists in the mockup. Class on the header root: `header--${theme}`.

## Markup

Every band that should change the header declares the attr. Later bands must declare the “rest” theme (usually `light`), or scroll past the first band keeps the first theme forever.

```astro
---
import { HEADER_THEME } from '@/shared/config';
---

<section data-header-theme={HEADER_THEME.transparent} …>
<!-- next content band -->
<section data-header-theme={HEADER_THEME.light} …>
```

Optional override: `data-header-theme-tablet` when tablet/mobile need a different token (Lux parity; mq `(max-width: 1199px)`).

Default in `Header.astro`: `header--light` (or the project default). Do not hardcode a page class like `.services-page .header`.

## Runtime

Canon: `widgets/Header/model/header-theme.ts`.

1. Collect `[data-header-theme]` once at init. Empty → no listeners.
2. Probe Y = header `getBoundingClientRect().top + height / 2`.
3. `themeAt(probeY, sections)`: section that currently covers the probe wins; else last section whose `top <= probeY` (scrolled past); else default.
4. `applyTheme`: toggle `header--*` **only when the token flips** (threshold sync).
5. Scroll/resize → `requestAnimationFrame` gate (one pending frame). Passive listeners.
6. Read tablet override via cached `matchMedia`, not every tick.

Hot-path smells: `getComputedStyle` in the loop; rewriting every theme class every scroll; querying sections every frame; page-specific hero selectors instead of `data-header-theme`.

## Styles

Theme owns paint that is not scrubbed every frame — class change is discrete, CSS `transition` on `color` / `background-color` is fine.

```scss
.header--transparent {
  background-color: transparent;
  mix-blend-mode: difference; // when the mockup inverts chrome over media
  color: $white;
  // logo → white via filter/mask if the asset is brand-colored
}

.header--light {
  background-color: $white;
  mix-blend-mode: normal;
  color: $body-color;
}

html.header-theme-boot .header {
  transition: none; // FOUC guard while boot runs
}

html.menu-popup-open .header--transparent {
  mix-blend-mode: normal; // panel is opaque; difference against it is wrong
}
```

Toggle `menu-popup-open` on `document.documentElement` when the menu opens (MenuPopup `syncTriggers`) — avoid `html:has(.menu-popup[open])` (selector complexity / fallow).

Do not put `mix-blend-mode` on a forever-scrubbed property path. Theme switch is thresholded.

## Boot (FOUC)

1. Inline early: `document.documentElement.classList.add('header-theme-boot')` (with `no-js` → `js`).
2. After `<Header />` is in the DOM, inline script: read first `[data-header-theme]` (+ tablet attr), set `header--*` once, `finally` remove `header-theme-boot`.
3. Hash the boot bytes through `InlineScript` (CSP).

Canon: `app/layouts/RootLayout/RootLayout.astro`.

## Checklist

- [ ] Theme tokens in `shared/config`, exported from `shared/config/index.ts`
- [ ] Probe module under `widgets/Header/model/`
- [ ] Hero/media band: `data-header-theme` for the overlaid state
- [ ] Following band: rest theme (`light` / solid)
- [ ] Boot + `header-theme-boot` transition kill
- [ ] Menu/dialog open does not leave a broken blend
- [ ] Verify: top of route → overlaid class; scroll past band → rest class

## Verify recipe

```bash
$CTRL browser --viewport 1440 flow <<'EOF'
goto /services/
wait --ms 400
eval --js "document.querySelector('.js-header').className"
scroll --by 1600
wait --ms 300
eval --js "document.querySelector('.js-header').className"
EOF
```

Expect `header--transparent` then `header--light` (or the tokens this page declared).
