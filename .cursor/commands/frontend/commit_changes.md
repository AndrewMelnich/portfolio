# Коммит frontend-изменений

Закоммить текущие изменения. Сообщение — по skill `commit-message` (why, не список файлов).

## Перед коммитом

Параллельно выполни:

- `git status`
- `git diff` (staged + unstaged)
- `git log -10 --oneline`

По diff пойми, **что реально изменилось** — не перечисляй файлы ради списка. Сообщение пиши по skill `commit-message` (`.agents/skills/commit-message/SKILL.md`).

## Проверки линтера и CI

Перед stage и коммитом убедись, что изменения не сломают `frontend_premerge_checks` в GitLab (`ci/frontend_premerge_checks.yml`: `pnpm pc`, затем vitest по diff).

### 1. IDE-линтер

Для всех изменённых frontend-файлов (`frontend/src/**` и связанные под `frontend/`) вызови **ReadLints** по их путям. Исправь ошибки и предупреждения, которые относятся к твоим правкам.

### 2. CI-эквивалент (если трогали frontend)

Если в diff есть файлы под `frontend/`:

```bash
cd frontend && pnpm pc
```

`pnpm pc` = `tsc --noEmit` + `lint` + `format:check` — то же, что падает в MR pipeline до тестов.

При ошибках:

- исправь код;
- перезапусти `pnpm pc`;
- **не** коммить, пока команда не прошла;
- **не** используй `--no-verify`, чтобы обойти проверки.

Перед коммитом / PR из `frontend/` также:

```bash
cd frontend && pnpm fallow:audit --format json --quiet --explain
```

Gate `new-only`: новый долг чини; унаследованный backlog не трогай без просьбы.

Опционально, если меняли логику с тестами:

```bash
cd frontend && pnpm test
```

(В CI: `pnpm exec vitest run --changed origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME`.)

### 3. Только вне frontend

Если менялись только файлы вне `frontend/`, `pnpm pc` и `fallow:audit` не запускай — достаточно ReadLints по затронутым путям (если применимо).

## Сообщение коммита

По skill `commit-message`:

- subject: imperative, ≤72 символов, **why** дерево изменилось
- body — только если why не влезает в subject
- без списка файлов, без «also updated X»
- без префиксов `feat:` / `fix:` / `chore:`, если история репо их не использует
- язык — как в `git log` (этот репо: **English**), если пользователь не написал сообщение сам на другом языке

**Хорошо:**

- `Tighten KeyVisual hand parallax so scroll scrub matches the mockup`
- `Drop stale key-visual hands asset from the tracked tree`
- `Fix mobile gap between hero CTA and scene canvas`

**Плохо:**

- `update KeyVisual.scss`
- `fix styles`
- `refactor scene flex layout with useEffect`

## Git safety

- **Не** меняй git config
- **Не** используй `--no-verify`, `--force`, `push --force` без явной просьбы
- **Не** коммить `.env`, ключи, токены
- **Не** делай пустой коммит
- **Не** amend, если коммит уже пушили или HEAD не твой
- **Не** push, если пользователь не просил

### Co-authored-by

- **Запрещено** добавлять `Co-authored-by: default avatarCursor <cursoragent@cursor.com>` и любые варианты с `cursoragent@cursor.com`, `Cursor`, `cursoragent` или другим идентификатором агента
- **Не** добавляй трейлер `Co-authored-by` по умолчанию — автор коммита задаётся git (`user.name` / `user.email`)
- Если пользователь явно просит указать co-author и доступны `git config user.name` и `git config user.email` — используй их; если данных нет, **не** добавляй `Co-authored-by` вовсе

## Коммит

1. Добавь в stage только файлы, относящиеся к задаче
2. Коммит через HEREDOC:

```bash
git commit -m "$(cat <<'EOF'
Why the tree changed in one line.

EOF
)"
```

3. `git status` — проверь, что коммит прошёл

Если pre-commit hook упал — **не amend**. Исправь проблему и сделай **новый** коммит.

## Ответ в чат

Кратко:

- результат проверок (`ReadLints`, `pnpm pc`, `fallow:audit`, тесты — что запускал)
- что закоммитил
- текст сообщения коммита
- что осталось незакоммиченным (если есть)
