# Feature map

Single map of user-facing frontend behavior. The agent proves a behavior by driving its recipe below in the real browser; a behavior that gets a recipe adds or updates its row here in the same change.

- The agent reads this table, compares it with its own diff, and drives the recipes of the features the change can touch. The reply lists the recipes driven and each one skipped with a reason.
- `pnpm lint:feature-map` fails when an accessible name passed with `--name` below is not in `frontend/src` product code (stories and tests do not count), a row links no recipe or a missing one, or a recipe step is made of code handles. Husky pre-push runs it.

## Features

| Feature               | User paths covered                                                                                                                                                                   | Recipe                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Every route renders   | direct URL `/`, `/services/`, `/projects/`, `/projects/project-1/`, `/blog/`, `/contacts/`, `/privacy/`: HTTP 200, no console or page errors                                         | [recipe](#route-smoke)                                  |
| Home route            | `/` shows hero heading and site chrome; showreel button opens and closes the showreel dialog                                                                                         | [recipe](#home-route)                                   |
| Site header           | logo, menu/CTA, mobile burger; services hero → transparent+difference, then solid                                                                                                    | [recipe](#site-header)                                  |
| Menu popup            | header menu/burger opens purple panel; desktop slide left, mobile bottom; Escape/close                                                                                               | [recipe](#site-header)                                  |
| Site footer           | services nav, contacts, privacy, Telegram channel                                                                                                                                    | [recipe](#site-footer)                                  |
| Skip link             | Tab/Enter to `#main`                                                                                                                                                                 | [recipe](#skip-link)                                    |
| Cookie banner         | appears after delay without stealing focus; accept hides it. Gotcha: 3s show delay; clear cookies first                                                                              | [recipe](#cookie-banner)                                |
| Services page         | `/services/` hero + list: tabs compact/sticky, panel anchors, sticky title shrink                                                                                                    | [recipe](#services-page) · Storybook `pages/Services/*` |
| Lead form popup       | header CTA / hash opens dialog; empty submit paints field errors                                                                                                                     | [recipe](#lead-form-popup)                              |
| Feedback form consent | empty submit paints field errors; `#feedback` purple panel consent checkbox stroke contrasts with panel on mobile                                                                    | [recipe](#feedback-form-consent)                        |
| Projects catalog      | `/projects/` filter chips and client/project tabs swap the list and the address (Back restores it); load more appends the next page; a filter link opened directly shows that filter | [recipe](#projects-catalog)                             |
| Blog catalog          | `/blog/` load more appends articles; `?page=2` opened directly shows the whole accumulated list                                                                                      | [recipe](#blog-catalog)                                 |

## Handles

Prefer ARIA role + accessible name over CSS. Copy a handle from here when driving by hand.

| Control               | Handle                                                           |
| --------------------- | ---------------------------------------------------------------- |
| Skip to content       | `--role link --name "Перейти к основному содержанию"` → `#main`  |
| Logo home             | `--role link --name "Plenum"` → `/`                              |
| Discuss CTA           | `--role button --name "обсудить проект"` (desktop/tablet)        |
| Menu (desktop/tablet) | `--role button --name "меню"` in navigation `Основная навигация` |
| Menu (≤767)           | `--role button --name "Открыть меню"`                            |
| Home heading          | heading `--name "Брендинговое агентство"`                        |
| Footer channel        | `--role link --name "канал"`                                     |

## Recipes

`$CTRL` = `node .agents/skills/verify-ui/scripts/control.mjs` from the repo root. Preconditions for every recipe: `$CTRL doctor` reports `"ok": true`, `"stale": false`; drive only the doctor `url`, never the developer's `pnpm dev`. Evidence goes to `.cursor/fstack/artifacts/<feature>/`; a `$CTRL browser screenshot` there also lands in the verify-ui receipt. An unreachable path is reported with its unmet precondition, not counted as verified through another path.

**A recipe is written as a user.** The agent acts on what a visitor sees: roles, accessible names, visible text, the address bar, a screenshot. It does not know the code. Allowed in a recipe: `goto <path>`, `click`/`hover`/`press`/`scroll --by`, a target as `--role R --name N` or `--selector` made only of `role=…` / `text=…` parts joined with `>>`, `wait --selector` on such a target, `wait --ms` to let a page settle, `snapshot --aria`, `screenshot`, and `eval --js "history.back()"` as the Back button. The `url` each step prints is the address bar. Banned: CSS classes, ids, data attributes, DOM queries, computed styles, window globals. `pnpm lint:feature-map` fails on them. **Context comes from the tree.** When a name repeats, scope it with the landmark that holds it (`dialog`, `form`, `region`, `navigation`). If two controls with one role and name can be reached at the same time and no landmark tells them apart in Chrome's real accessibility tree, that is an accessibility bug: fix the markup, not the recipe. Playwright's role tree does not model `inert`, so it also lists the page behind an open modal; Chrome's tree drops it. Check Chrome's tree with CDP `Accessibility.getFullAXTree` before blaming the markup. A fact visible only through code is not a recipe step: judge it on a screenshot (`visual-judge`) or leave it to a lint.

### Home route

- `$CTRL browser --viewport 1440 goto /` → HTTP 200, document title contains `Plenum`.
- `$CTRL browser snapshot --aria --path .cursor/fstack/artifacts/home/direct.aria.txt` → heading `--name "Брендинговое агентство"` in `main` and navigation `Основная навигация` with button `--name "меню"` in `banner`.
- `$CTRL browser --viewport 1440 screenshot --path .cursor/fstack/artifacts/home/direct.png` → heading and header navigation visible.
- **Showreel.** `$CTRL browser --viewport 1440 flow`: `goto /` → `click --role button --name "Смотреть шоурил"` → `wait --selector "role=dialog[name='Шоурил']" --state visible` → `screenshot --path .cursor/fstack/artifacts/home/showreel-open.png` → `click --selector "role=dialog[name='Шоурил'] >> role=button[name='Закрыть шоурил']"` → `wait --selector "role=dialog[name='Шоурил']" --state hidden`.
- Gotcha: ready text and title use `Plenum`; the header logo link `Plenum` on `/` stays hidden until the page scrolls past the first screen.

### Site header

- **Logo.** `$CTRL browser --viewport 1920 flow`: `goto /services/` → `click --role link --name "Plenum"` → the address becomes `/`.
- **Desktop.** `snapshot --aria` → navigation `Основная навигация` with button `--name "меню"`, and button `--name "обсудить проект"`; no `Открыть меню`.
- **Menu (desktop).** `$CTRL browser --viewport 1920 --motion flow`: `goto /` → `click --role button --name "меню"` → `wait --selector "role=dialog[name='Меню сайта']" --state visible` → `screenshot --path .cursor/fstack/artifacts/menu-popup/desktop-open.png`: a purple panel slides in from the left with links Проекты, Команда, Блог, Контакты, Услуги; `press --key Escape` → `wait --selector "role=dialog[name='Меню сайта']" --state hidden`.
- **Mobile.** `$CTRL browser --viewport 375 flow`: `goto /` → `snapshot --aria`: button `--name "Открыть меню"`; `меню` and `обсудить проект` absent → `click --role button --name "Открыть меню"` → the dialog `Меню сайта` is visible; screenshot `.cursor/fstack/artifacts/menu-popup/mobile-open.png`: the panel comes up from the bottom.
- **Theme (services).** `$CTRL browser --viewport 1440 flow`: `goto /services/` → `screenshot --path .cursor/fstack/artifacts/header/services-top.png`: the header sits transparent over the hero → `scroll --by 1600` → `screenshot --path .cursor/fstack/artifacts/header/services-scrolled.png`: the header is solid and readable on the content.
- Gotchas: on `/` the `Plenum` logo link is hidden until the first screen is scrolled past. The 375 burger also shows in landscape up to 900 wide; the 768 portrait tablet frame keeps the text buttons. `/#menu-popup` opens the menu. The menu closes by its close button, Escape, and a click outside (and by the desktop `меню` button again; the mobile burger hides while the menu is open); the page behind it is blurred while it is open.

### Site footer

- **Landmark.** `$CTRL browser --viewport 1920 flow`: `goto /` → `snapshot --aria --path .cursor/fstack/artifacts/footer/desktop.aria.txt` → `contentinfo` with navigation `Услуги`, link `--name "Политика конфиденциальности"`, link `--name "канал"`.
- **Mobile.** `$CTRL browser --viewport 375 flow`: `goto /` → `screenshot --selector "role=contentinfo" --path .cursor/fstack/artifacts/footer/mobile.png`: contacts stack, the channel link is visible.
- Gotcha: service links are placeholders until the CMS wires routes.

### Skip link

- **Present.** `$CTRL browser --viewport 1440 flow`: `goto /` → `snapshot --aria --path .cursor/fstack/artifacts/skip-link/present.aria.txt` → navigation `Ссылки для быстрого перехода` with link `--name "Перейти к основному содержанию"`.
- **Activate.** `goto /` → `press --key Tab` → `screenshot --path .cursor/fstack/artifacts/skip-link/focused.png`: the link appears top-left → `press --key Enter` → `screenshot --path .cursor/fstack/artifacts/skip-link/after.png`: the skip link is gone and the heading `Брендинговое агентство` is at the top of the main content.
- Gotcha: the link is clipped to 1×1 px until it has keyboard focus, so a mouse `click` by role times out; use the keyboard like a user.

### Route smoke

- `node .agents/skills/verify-ui/scripts/console-check.mjs / /services/ /projects/ /projects/project-1/ /blog/ /contacts/ /privacy/` → exit 0: every route answers 2xx and prints no console or page error.
- Gotcha: a new route joins this list in the same change that adds it.

### Services page

- **Anchor tabs.** `$CTRL browser --viewport 1440 flow`: `goto /services/` → `snapshot --aria --path .cursor/fstack/artifacts/services-page/initial.aria.txt`: navigation `Услуги` with links `стратегия`, `брендинг`, `пространство`, `поддержка` → `click --selector "role=navigation[name='Услуги'] >> role=link[name='брендинг']"` → the address ends with `#brand-design` → `wait --ms 800` → `screenshot --path .cursor/fstack/artifacts/services-page/brand-design.png`: the section `бренд-дизайн` is at the top of the viewport and the header is solid.
- Gotcha: sticky tab compaction and sticky section title shrink are scroll-driven above 1199px; verify smoothness with `motion-probe` when touching their styles or scripts.

### Cookie banner

- `$CTRL browser --viewport 1440 flow` (a fresh browser has no cookies): `goto /` → `press --key Tab` → `wait --selector "role=dialog[name='Согласие на использование cookie']" --state visible` → `screenshot --path .cursor/fstack/artifacts/cookie-banner/open.png`: the banner shows at the bottom and the skip link still shows top-left with focus (the banner did not take focus).
- **Accept.** `click --selector "role=dialog[name='Согласие на использование cookie'] >> role=button[name='принять']"` → `wait --selector "role=dialog[name='Согласие на использование cookie']" --state hidden`.
- Gotcha: the banner appears after a few seconds; wait on it, do not count seconds.

### Lead form popup

- **Open.** `$CTRL browser --viewport 1440 flow`: `goto /` → `click --role button --name "обсудить проект"` → `wait --selector "role=dialog[name='Расскажите о задаче']" --state visible` → the address ends with `#lead-form-popup` → `screenshot --path .cursor/fstack/artifacts/lead-form-popup/desktop-open.png`.
- **Deep link on mobile.** `$CTRL browser --viewport 375 flow`: `goto /#lead-form-popup` → `wait --selector "role=dialog[name='Расскажите о задаче']" --state visible`.
- **Empty submit.** In the open popup `click --selector "role=dialog[name='Расскажите о задаче'] >> role=button[name='отправить']"` → `wait --ms 800` → `snapshot --aria`: under the fields `Введите email` and `Введите имя`.
- Gotchas: the feedback form on the page has its own `отправить` button. With the popup open, a user (and Chrome's accessibility tree) reaches only the dialog's one, because the page behind is inert; Playwright's role tree still lists both, so the recipe scopes to the dialog. An empty submit stops at the form and sends nothing; fill and submit only when the lead backend is configured for the run.

### Feedback form consent

- **Empty submit.** `$CTRL browser --viewport 1440 flow`: `goto /` → `click --selector "role=form[name='Расскажите о задаче'] >> role=button[name='отправить']"` → `wait --ms 800` → `snapshot --aria --path .cursor/fstack/artifacts/feedback-form/empty-submit.aria.txt`: under the fields in the form `Введите email` and `Введите имя`.
- **Mobile contrast.** `$CTRL browser --viewport 375 flow`: `goto /` → `screenshot --selector "role=form[name='Расскажите о задаче']" --path .cursor/fstack/artifacts/feedback-form/consent-mobile.png`: the consent checkbox outline is clearly visible against the purple panel.
- Gotcha: on `/contacts/` the same form is named `Сделаем классный проект вместе?` on a light background. Judge the mobile contrast screenshot by eye, or with `visual-judge` when the change touches the checkbox or the panel colors.

### Projects catalog

Cards = the links to `/projects/project-…` in the snapshot; the line `status` shows the total of the current filter.

- **Filter.** `$CTRL browser --viewport 1440 flow`: `goto /projects/` → `snapshot --aria`: status `50 проектов`, 22 cards → `click --role tab --name "Тип клиента"` → `click --role link --name "Еда и напитки"` → the address becomes `/projects/filter/client-is-food/apply/` → `wait --ms 1000` → `snapshot --aria`: status `13 проектов`, 13 cards; `screenshot`: the chip `Еда и напитки` is highlighted → `eval --js "history.back()"` → `wait --ms 1000` → `snapshot --aria`: status `50 проектов`, 22 cards, address `/projects/`.
- **Load more.** `goto /projects/` → `click --role link --name "загрузить ещё"` → `wait --ms 1000` → `snapshot --aria`: 44 cards, address ends with `?page=2` → click it again → 50 cards and the link is gone.
- **Direct link.** `goto /projects/filter/service-is-branding/client-is-food/apply/` → `snapshot --aria`: status `6 проектов`, 6 cards → `screenshot`: the chip `Брендинг` is highlighted; `click --role tab --name "Тип клиента"` → the chip `Еда и напитки` is highlighted too.
- Gotcha: counts follow the seeded API.

### Blog catalog

The status line shows `14 статей` on initial load and `Загружены ещё статьи` after load more; the articles are the headings in the region `Статьи блога`.

- **Load more.** `$CTRL browser --viewport 1440 flow`: `goto /blog/` → `snapshot --aria`: status `14 статей`, 11 articles in the region → `click --role link --name "загрузить ещё"` → `wait --ms 1000` → `snapshot --aria`: status `Загружены ещё статьи`, 14 articles, address ends with `?page=2`, the link is gone.
- **Direct link.** `goto /blog/?page=2` → `snapshot --aria`: status `14 статей`, 14 articles.
- Gotcha: counts follow the seeded API.
