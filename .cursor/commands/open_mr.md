# Открытие Merge Request на GitLab

Открой Merge Request (MR) в проект на GitLab по названию текущего workspace. Исходная ветка = текущая ветка, если иное не указано. **Не переходи по ссылке на задачу**, если она приложена.

Check 'Delete source branch', if source branch is 'master' OR if user requests.

Паттерн заголовка: `(<role>) id:<task_id> <title>`.

- `role` (optional): Only include if provided by the user **OR (IMPORTANT) check [gitlab.json](.cursor/data/gitlab.json)**.
- `task_id` (optional): task ID. Only include if task link is provided by the user.
- `title`: описательный емкий заголовок, отражающий суть изменений в коде относительно целевой ветки.

Добавь описание MR:

```
<task link>

<текст, коротко описывающий изменения в коде относительно целевой ветки>
```

Верни в чат кликабельную ссылку на открытый Merge Request.
