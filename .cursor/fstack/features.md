# Feature map

Single map of user-facing frontend behavior. The agent proves a behavior by driving its recipe below in the real browser; a behavior that gets a recipe adds or updates its row here in the same change.

- The agent reads this table, compares it with its own diff, and drives the recipes of the features the change can touch. The reply lists the recipes driven and each one skipped with a reason.
- `pnpm lint:feature-map` fails when an accessible name passed with `--name` below is not in `frontend/src` product code (stories and tests do not count), a row links no recipe or a missing one, or a recipe step is made of code handles. Husky pre-push runs it.

## Features

| Feature             | User paths covered                                                                                          | Recipe                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------- |
| Every route renders | direct URL `/`, `/cases/`, `/en/`, `/en/cases/`: HTTP 200, no console or page errors                        | [recipe](#route-smoke) |
| Home route          | `/` shows name heading, intro landmark, Cases/Contact CTAs                                                  | [recipe](#home-route)  |
| Site header         | logo home, primary nav (Обо мне / Кейсы / Контакт), language switch                                         | [recipe](#site-header) |
| Skip link           | Tab/Enter to `#main`                                                                                        | [recipe](#skip-link)   |
| Cases catalog       | `/cases/` lists built and support groups                                                                    | [recipe](#cases-catalog) |

## Handles

Prefer ARIA role + accessible name over CSS. Copy a handle from here when driving by hand.

| Control         | Handle                                                              |
| --------------- | ------------------------------------------------------------------- |
| Skip to content | `--role link --name "Перейти к основному содержанию"` → `#main`     |
| Logo home       | `--role link --name "Главная"` → `/`                                |
| Primary nav     | navigation `--name "Primary"`                                       |
| Home heading    | heading `--name "Andrew Melnichenko"`                               |
| Cases CTA       | `--role link --name "Смотреть работы"`                              |

## Recipes

`$CTRL` = `node .agents/skills/verify-ui/scripts/control.mjs` from the repo root. Preconditions for every recipe: `$CTRL doctor` reports `"ok": true`, `"stale": false`; drive only the doctor `url`, never the developer's `pnpm dev`. Evidence goes to `.cursor/fstack/artifacts/<feature>/`.

**A recipe is written as a user.** Allowed in a recipe: `goto <path>`, `click`/`hover`/`press`/`scroll --by`, a target as `--role R --name N` or `--selector` made only of `role=…` / `text=…` parts joined with `>>`, `wait --selector` on such a target, `wait --ms`, `snapshot --aria`, `screenshot`, and `eval --js "history.back()"` as the Back button. Banned: CSS classes, ids, data attributes, DOM queries, computed styles, window globals.

### Home route

- `$CTRL browser --viewport 1440 goto /` → HTTP 200.
- `$CTRL browser snapshot --aria` → heading `--name "Andrew Melnichenko"` in `main` and navigation `Primary` in `banner`.
- `$CTRL browser --viewport 1440 flow`: `goto /` → `click --role link --name "Смотреть работы"` → address includes `#work`.

### Site header

- **Logo.** `$CTRL browser --viewport 1440 flow`: `goto /cases/` → `click --role link --name "Главная"` → address becomes `/`.
- **Nav.** `snapshot --aria` → navigation `Primary` with links `--name "Обо мне"`, `--name "Кейсы"`, `--name "Контакт"`.

### Skip link

- **Present.** `$CTRL browser --viewport 1440 flow`: `goto /` → `snapshot --aria` → navigation `Ссылки для быстрого перехода` with link `--name "Перейти к основному содержанию"`.
- **Activate.** `goto /` → `press --key Tab` → `press --key Enter` → heading `Andrew Melnichenko` at top of main.

### Route smoke

- `node .agents/skills/verify-ui/scripts/console-check.mjs / /cases/ /en/ /en/cases/` → exit 0: every route answers 2xx and prints no console or page error.

### Cases catalog

- `$CTRL browser --viewport 1440 goto /cases/` → HTTP 200.
- `$CTRL browser snapshot --aria` → headings for built and support case groups visible in `main`.
