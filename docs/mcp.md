# MCP-серверы и секреты

Агент берёт динамические данные проекта (макет, текст задачи, ошибки Rollbar, документацию компонентов) через MCP по идентификаторам из [паспорта проекта](project.md). Конфиг для Cursor — `.cursor/mcp.json`. Токен Figma — `FIGMA_API_KEY` в корневом `.env`, подключается к Framelink через `envFile: ${workspaceFolder}/.env` (только STDIO). Токены Rollbar — в `.rollbar-mcp.json`.

GitLab (MR, diff, пайплайны, файлы репозитория) — через CLI `glab` по скиллу [`gitlab-glab`](../.agents/skills/gitlab-glab/SKILL.md), токен в `GITLAB_TOKEN`. MCP — только для сервисов без CLI: описания инструментов GitLab MCP занимают 23–66 тыс. токенов в каждом запросе, скилл — ~0,4 тыс. и только когда нужен.

## Серверы

| Сервер                    | Что даёт                                                                                                     | Транспорт и авторизация                                   | Источник                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------------- |
| `Framelink MCP for Figma` | `get_figma_data`, `download_figma_images` — на них опираются скиллы `figma-design-to-code` и `design-review` | stdio `npx figma-developer-mcp`, `FIGMA_API_KEY`          | [GLips/Figma-Context-MCP](https://github.com/GLips/Figma-Context-MCP)       |
| `planfix`                 | Официальный сервер Planfix: задачи, контакты, комментарии                                                    | HTTP `https://mcp.planfix.ru/mcp`, OAuth                  | [Planfix: MCP](https://planfix.ru/help/MCP)                                 |
| `rollbar`                 | Items, occurrences, деплои. `project` — имя из паспорта                                                      | stdio `npx @rollbar/mcp-server`, файл `.rollbar-mcp.json` | [rollbar/rollbar-mcp-server](https://github.com/rollbar/rollbar-mcp-server) |
| `storybook`               | Документация компонентов и историй                                                                           | HTTP `http://localhost:6006/mcp`, пока запущен Storybook  | [@storybook/addon-mcp](https://github.com/storybookjs/mcp)                  |

Сервис в проекте не используется (в паспорте `нет`) — отключите его сервер в Cursor. Сервер уже настроен глобально в `~/.cursor/mcp.json` — отключите дубль.

Planfix: аккаунты на planfix.com используют `https://mcp.planfix.com/mcp`. Подключение OAuth-клиента к аккаунту подтверждает администратор Planfix ([инструкция](https://planfix.ru/help/MCP)).

## Rollbar

Скопируйте [`.rollbar-mcp.example.json`](../.rollbar-mcp.example.json) в `.rollbar-mcp.json` и впишите токены проектов со scope `read`. `projects[].name` совпадает с колонкой «Имя в `.rollbar-mcp.json`» в паспорте: это значение параметра `project`. Пустой `token` файл невалиден — сервер не стартует. Файл в gitignore.

`ROLLBAR_CONFIG_FILE` в `.cursor/mcp.json` указывает на этот файл. Путь задан, а файла нет — сервер завершается с ошибкой.

Инструменты чтения: `list-projects`, `list-items`, `get-top-items`, `get-item-details`, `list-occurrences`, `get-deployments`, `get-version`. `environment` по умолчанию `production`. Номер item — аргумент `counter`, не поле паспорта.

## Storybook

Аддон `@storybook/addon-mcp` подключён в `frontend/.storybook/main.ts`. Эндпоинт поднимается вместе с dev-сервером:

```bash
cd frontend && pnpm storybook
```

Порт `6006` — скрипт `storybook` в `frontend/package.json`; порт берётся из `SBCONFIG_PORT`, поэтому флаги (`--ci`, `--no-open`) передаются как есть. `STORYBOOK_STORIES` — необязательный список glob историй через запятую (относительно `frontend/`). В linked worktree аддон MCP не подключается. Агенты запускают Storybook через `control.mjs up storybook`, см. `verify-ui`. URL в `.cursor/mcp.json` — `http://localhost:6006/mcp`. Процесс не запущен — инструментов нет.

Инструменты аддона: `get-storybook-story-instructions` (как писать историю и какие пропсы есть), `preview-stories` (URL превью после правки UI), `get-changed-stories` (новые и изменённые истории). Свойства, которого нет в ответе `get-storybook-story-instructions`, не существует: не подставляй его по аналогии, спроси.

Второй Storybook (другой пакет или порт) — отдельная запись в `.cursor/mcp.json`, как `timeless-shared-sb-mcp` / `timeless-web-main-sb-mcp` в new-timeless.

## Локально (Cursor IDE)

1. Figma: скопируйте `.env.example` → `.env` в корне репо, впишите `FIGMA_API_KEY`, перезапустите MCP/Cursor. Framelink берёт файл через `envFile` ([Cursor MCP](https://cursor.com/docs/mcp)). Альтернатива без файла: `${env:FIGMA_API_KEY}` из окружения процесса Cursor.
2. Rollbar: заполните `.rollbar-mcp.json` (см. выше) и перезапустите Cursor.
3. Для `planfix` подключите сервер в Cursor и войдите через OAuth (шаги — по ссылке из таблицы).
4. Storybook MCP доступен после `pnpm storybook` в `frontend/`.

## Облачные агенты Cursor

Облачный агент получает клон репозитория и секреты окружения. По документации Cursor MCP-серверы для облачных агентов добавляются в настройках Cursor, а не берутся из `.cursor/mcp.json` репозитория:

- **MCP.** Личные серверы — через выпадающее меню MCP на [cursor.com/agents](https://cursor.com/agents). Общие для команды — администратор в **Dashboard → Plugins & MCPs**. Поддерживаются HTTP и stdio; SSE и `mcp-remote` не поддерживаются. Рекомендуется HTTP: конфиг и токены не попадают в VM агента. OAuth проходит каждый пользователь сам. Значения `env` (stdio) и `headers` (HTTP) хранятся зашифрованно и после сохранения не показываются. Источник: [Cursor: Cloud Agent capabilities → MCP tools](https://cursor.com/docs/cloud-agent/capabilities#mcp-tools).
- **Секреты.** Вкладка Secrets в [Cloud Agents dashboard](https://cursor.com/dashboard/cloud-agents): значения попадают в агента как переменные окружения. Для токенов выбирайте тип **Runtime Secret**: значение скрывается из вывода инструментов, чата и коммитов. Секрет можно ограничить одним environment. Источники: [Cursor: Cloud Environment Setup → Environment variables and secrets](https://cursor.com/docs/cloud-agent/setup#environment-variables-and-secrets), [Cursor: Secrets & Network](https://cursor.com/docs/cloud-agent/security-network#secret-protection).

Что добавить для облачных агентов:

| Сервер                    | Как добавить                                                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `planfix`                 | HTTP-сервер с URL из таблицы выше, затем OAuth                                                                                   |
| `Framelink MCP for Figma` | stdio, команда и аргументы из `.cursor/mcp.json`, токен Figma в `env` сервера (`FIGMA_API_KEY`)                                  |
| `rollbar`                 | stdio с `ROLLBAR_CONFIG_FILE`. Файл `.rollbar-mcp.json` в git нет: положите его в окружение VM из секретов до старта MCP         |
| `storybook`               | Локальный процесс. В VM выполните `pnpm storybook` в `frontend/`; URL `http://localhost:6006/mcp` доступен только внутри этой VM |

Скриптам `figma:*` во `frontend/` нужен `FIGMA_API_KEY` в окружении агента — добавьте его во вкладку Secrets как Runtime Secret.

`glab` нужен `GITLAB_TOKEN` — тоже Runtime Secret.

stdio-серверы запускаются внутри VM агента: `npx` должен быть доступен в окружении ([Cursor: Cloud Environment Setup](https://cursor.com/docs/cloud-agent/setup)).
