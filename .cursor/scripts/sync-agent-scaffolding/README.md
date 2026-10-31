# sync-agent-scaffolding

Upstream: Plenum `.agents/skills` + selective `.cursor` merge with per-archetype preserve.

## Detect archetype

```bash
node detect.mjs /Users/andrewmelnichenko/Sites/ren
```

## Dry-run all active targets

```bash
node sync.mjs --all-active --dry-run
```

## Apply one repo

```bash
node sync.mjs --target /Users/andrewmelnichenko/Sites/ren --apply
```

Requires a **clean** git working tree in the target when using `--apply`.

## Archetypes

| id | When |
|----|------|
| `bitrix` | `local/templates/main/frontend/` |
| `astro` | `frontend/` + Astro deps |
| `next-monorepo` | `frontend/` + Next (default monorepo) |
| `vue-vite` | `frontend/` + Vue/Vite |
| `vite-root` | Vite at repo root (`composit`) |

Whitelist: `targets.active.json`.

After `--apply`, run `setup-fstack` in the repo if `.cursor/fstack/config.json` is missing or stale.
