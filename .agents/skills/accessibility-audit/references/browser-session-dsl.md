# Browser Session DSL

Use this format for authenticated or interaction-heavy crawl and audit flows.

## Top-Level Fields

| Field | Purpose |
|---|---|
| `baseUrl` | Base origin for relative navigation |
| `loginUrl` | Optional login page |
| `storageStatePath` | Optional persisted browser session path |
| `secrets` | Map stable secret names to environment variables |
| `variables` | Reusable string substitutions |
| `actionLibrary` | Named reusable action arrays |
| `actions` | Default startup or login flow |
| `routeProfiles` | Per-route hooks based on regex matching |

## String Interpolation

Supported placeholders inside `value` strings:

- `${secret:name}`
- `${env:NAME}`
- `${baseUrl}`
- `${variableName}`

## Actions

Supported action types:

- `goto`
- `fill`
- `fillEnv`
- `click`
- `press`
- `waitForSelector`
- `waitForURL`
- `waitForTimeout`
- `check`
- `setViewport`

You can also reference a reusable sequence:

```json
{ "use": "login-form" }
```

## Route Profiles

Each route profile supports:

- `name`
- `match`
- `afterLogin`
- `beforeAudit`

`afterLogin` runs during session bootstrap when the target URL matches. `beforeAudit` runs immediately before the browser-backed audit on that matched route.

## Guardrails

- Keep secrets in environment variables, not checked-in plaintext.
- Prefer named `actionLibrary` entries over copy-pasted action arrays.
- Keep route regexes narrow so audits remain deterministic.
- Validate configs with `node scripts/validate-session-config.js <config.json>`.
