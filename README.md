# portfolio

Личный сайт-визитка и портфолио кейсов (Astro).

Физлицо, самозанятый. Страницы (план): `/`, `/cases`, `/contacts`, `/privacy`, `/offer`.

Структура как у студийных Astro-проектов: `frontend/` из `astro-boilerplate` (FSD, lint, Storybook, тесты), агентский scaffolding в корне (`.agents`, `.cursor`, `docs`, `ci`, husky).

## Требования

- Node.js `>=22.20`
- pnpm

## Команды

Корень (husky / prepare):

| Command        | Action                 |
| :------------- | :--------------------- |
| `pnpm install` | Хуки и корневые deps   |

`frontend/`:

| Command        | Action                       |
| :------------- | :--------------------------- |
| `pnpm install` | Зависимости приложения       |
| `pnpm dev`     | Dev-сервер `localhost:4321`  |
| `pnpm build`   | Сборка в `frontend/dist/`    |
| `pnpm preview` | Превью production-сборки     |

## Агенты

- Паспорт: [`docs/project.md`](docs/project.md)
- MCP: [`docs/mcp.md`](docs/mcp.md)
- Роль: скопируй `ROLE.md.example` → `ROLE.md` (`frontend`)
- Инструкции: корневой [`AGENTS.md`](AGENTS.md) → [`frontend/AGENTS.md`](frontend/AGENTS.md)

## Git

Ветка по умолчанию: `master`. Push на remote — только по явной просьбе.
