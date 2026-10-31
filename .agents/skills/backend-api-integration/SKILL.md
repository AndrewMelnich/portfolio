---
name: backend-api-integration
description: Backend endpoint integration via OpenAPI — update types, Zod, transformer to FSD domain model, raw JSON fixtures from the live API, and data connection on pages.
---

# Backend API integration

Use this skill when you need to connect a new (or update an existing) API request: types from OpenAPI, response validation, mapping to frontend structure, and usage in `pages/` without fake data.

## 0. Update API contract

**First**, from the `frontend/` root, run:

```bash
pnpm api
```

This concurrently updates `src/shared/api/generated/api.d.ts` (openapi-typescript) and `src/shared/api/generated/generated-schemas.ts` (Zod from OpenAPI). Without this step, types and schemas might be outdated.

## 0.1. Raw API response fixture (always, before grilling / plan / code)

**When the task touches a backend endpoint**, snapshot live JSON **immediately** — as the first concrete step after `pnpm api` (§0), **before** grilling questions, plan sections about field mapping, or implementation. Fixtures answer factual questions (ключи, пустые блоки, slug тегов, 404 vs 200); do not defer to a later todo.

**Write the fixture even in Plan / Ask mode.** This is research ground truth, not implementation. Cursor plan-mode “no edits” does **not** apply here: `mkdir` + write `<request-dir>/fixtures/<name>.json` anyway. Do not skip because “plan mode is read-only”, do not fetch-to-stdout instead of a file, do not postpone until Agent / after grilling.

If the user attached **grilling** (`.agents/skills/grilling`): still fetch **and save** fixtures first; only **decisions** go to the user one-by-one afterward.

**On every new or updated endpoint integration**, save the **exact HTTP JSON body** from the backend (envelope with `status` and `data`, as returned by `axios` / `fetch` — **not** `App*` after `transformApiResponse`). One file per meaningful request variant.

| What      | Rule                                                                                                                                                             |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Path      | `<folder-with-request.ts>/fixtures/<name>.json` (e.g. `src/app/api/article-detail/fixtures/dobro-stanovitsia-castiu-biznesa-pomoshh-stanovitsia-sistemnoi.json`) |
| File name | Detail by `slug`/`id` — use that slug/id; list/other — stable descriptor (`default.json`, `limit-12.json`); if the user gives a UUID — use it as the file name   |
| Format    | `JSON.stringify(parsed, null, 2)` + trailing newline                                                                                                             |
| Headers   | `App-Locale` as on the page (usually `ru` / `DEFAULT_LOCALE`), `Accept: application/json`                                                                        |

Fetch from `frontend/` (requires `PUBLIC_API_HOST` in `frontend/.env` and/or `frontend/.env.local`):

```bash
cd frontend && node --env-file=.env --env-file=.env.local -e "
const pathParam = '<path-segment>'; // e.g. v1/articles/\${encodeURIComponent('<slug-or-id>')}
const out = 'src/<path-to-api>/fixtures/<name>.json';
const base = process.env.PUBLIC_API_HOST.replace(/\\/$/, '') + '/api';
(async () => {
  const res = await fetch(base + '/' + pathParam, {
    headers: { Accept: 'application/json', 'App-Locale': 'ru', 'X-Requested-With': 'XMLHttpRequest' },
  });
  if (!res.ok) throw new Error(res.status + ' ' + (await res.text()).slice(0, 200));
  const fs = await import('fs');
  fs.mkdirSync(require('path').dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(await res.json(), null, 2) + '\\n');
  console.log('written', out);
})();
"
```

Reference example: `src/app/api/article-detail/fixtures/ad8b91a5-6d47-4195-ae2a-48f03e5d9302.json` (`GET /v1/articles/dobro-stanovitsia-castiu-biznesa-pomoshh-stanovitsia-sistemnoi`).

Re-snapshot when the backend contract or real payload changes (after `pnpm api` if OpenAPI changed). Do not hand-edit fixture content to “fix” CMS quirks — fix backend/CMS; fixtures are ground truth for transformers and Storybook/tests.

## 1. Generate request boilerplate (mkar + FSD)

Command:

```bash
pnpm run mkar <method> <name> <path_from_src>
```

- `method` — HTTP method in lowercase (`get`, `post`, ...).
- `name` — name segment in CamelCase part of files (as in codegen template), e.g., `articles` → `GetArticles` in types.
- path — **from the `src/` folder**, according to FSD: for a news entity, for example: `entities/news/api/articles`.

Example:

```bash
pnpm run mkar get articles entities/news/api
```

**FSD:** place entity API in `entities/<entity>/api/...`, not in `shared` if these are domain entity requests. Follow `frontend/AGENTS.md` and layer rules.

Check the generated `request.ts`: URL and method must match OpenAPI (the template substitutes `/v1/<name>` in lowercase). In case of mismatch, fix the path/method manually according to `api.d.ts`.

## 2. `backend-response.zod.ts`

1. Remove the placeholder comment `// import from generated api types`.
2. Import the **specific** resource schema from `@/shared/api/generated/generated-schemas` (do not leave the abstract `BackendResource`).
3. Substitute it into `createApiResponseSchema(<ResourceSchema>)` — for example, for a list of articles: `ArticleListResource`.
4. In `catchZodErrorAndUseFallback({ ... })`, specify an object **with the same keys as DTO in `data`** (as in the resource Zod schema, often `snake_case`). For **any field with a list of content (array)**, specify an **empty array `[]`** in the fallback so that UI doesn't break on `undefined` if parsing fails. Other fields — safe scalars (e.g., counter `0`).

Example for a list:

```ts
catchZodErrorAndUseFallback({
  total_count: 0,
  items: [],
}),
```

Take the schema name from OpenAPI: in `api.d.ts`, look at the endpoint response `@description` / `components['schemas'][...]` and find the corresponding `export const ... = z.object` in `generated-schemas.ts`.

### Detail endpoints (single entity page by `slug` / `id`)

**Do not parse the response via Zod** in `request.ts`: after `axios.get<Api*Response>(...)`, pass **`response.data` immediately to `transformApiResponse`**. The contract at the type stage is `Api*Response` from OpenAPI; discrepancies between the actual form and the contract are caught via HTTP errors and handling on the detail page (404 redirect, etc., see section 5.1), not via `parse`/`parseAsync`. **Do not create a `backend-response.zod.ts` file for such a request** (if generated by mkar — delete it and remove the import from `request.ts`).

## 3. `types.ts`

### Strict typing rules (non-negotiable)

- **`API*` types** (e.g., `ApiGetPageDetailResponse`) **MUST** be based on types from `@/shared/api/generated/` (`components` or `operations`).
- **`App*` types** (e.g., `AppGetPageDetailResponse`) **MUST NOT** depend on `@/shared/api/generated/`. All nested fields must use either primitives, domain interfaces from `model/`, or types from `shared/model`.

Imports:

```ts
import type { components, operations } from "@/shared/api/generated/api";
```

### Request (`Api*Request`)

- Take the parameter types from **`operations['<operationId>']`** (operation key from `api.d.ts`, e.g., `'v1.articles.list'`).
- For query parameters: `export type ApiGetArticlesRequest = operations['v1.articles.list']['parameters']['query'] & {};`
- **`& {}` for query is mandatory** — it's easier to extend the type later and consistent with the project template.
- Remove placeholder comments.

### Backend Response (`Api*Response`)

```ts
export type ApiGetArticlesResponse = ApiResponse<
  components["schemas"]["ArticleListResource"]
>;
```

The schema name in `components['schemas']` must match what you validate in Zod (**except** for detail according to the rule above — there it's only the type, without Zod).

### Application Response (`App*Response`)

- Wrap the **domain** structure, not the literal backend DTO.
- **Page detail:** `AppGetXPageDetailResponse` wraps `XViewRawProps` (list of `{ type, props: SectionRawProps }`). Map CMS/API blocks onto that union in the transformer. Do not pass `Api*` / `components['schemas']` into a section. Rule: `.cursor/rules/frontend/standards/page-sections.mdc`.
- **Entity list/detail:** fields match `entities/.../model/` (e.g. `INews`). Typical form: `ApiResponse<{ totalCount: number; items: INews[] }>`.
- Constructor mapping — section 3.1 (article body blocks, not page sections). Images/video — media rule below.
- **Images and video:** always `ImageShape` / `VideoShape` from `@/shared/model/types` ([media-types.mdc](../../rules/frontend/standards/media-types.mdc)) — never parallel custom media interfaces in `model/`, props, or `App*`. Map from `Api*` / OpenAPI in `transformer.ts`.
- For SEO fields from `MetaResource`, map to **`PageMeta`** (or a separate domain type in `shared/model`), do not pass `MetaResource` into `App*`.
- If mapping to an entity is non-obvious (different field names, unclear optional fields) — **ask the user** for the desired form or clarify the mapping.

### 3.1. Content → Content Constructor (`map-api-content-to-blocks.ts`)

- Mapping JSON from API to **`IContentBlock[]`** for `ContentConstructor` is centralized in
  `frontend/src/features/content-constructor/lib/constructor/map-api-content-to-blocks.ts`.
  Do not create separate `map-*-content-to-blocks.ts` files unnecessarily — extend this module.
- **`mapApiContentToBlocks`**: declare all types and internal helpers needed **only** by this function (e.g., element type `ArticleDetailResource['content']`, `wysiwyg` / `wysiwygVideo` / `wysiwygGallery`) **inside** the function, not at the file level.
- **FSD:** the `entities` layer **does not** import `features`. If the `content` field from a detail response is converted **only** into constructor blocks: add **`content`** to `AppGet*Response['data']` (type — as in OpenAPI for this field), pass it into `transformApiResponse`, return **`App*Response`** in `request.ts` without a separate intersection with `raw*`; on the page, call **`map<Service>DetailApiContentToBlocks(service.content)`**.
- Keep intermediate domain structures for content (if needed between "API → domain → blocks") in `entities/<entity>/model/*.interface.ts`; `features` can import these interfaces.

## 4. `transformer.ts`

Implement `transformApiResponse`:

- Default mapping **entirely within** `transformApiResponse` (including `.map` callbacks). **Do not move** to `entities/.../lib/map-*.ts` (and do not create a separate named function just for readability) if mapping is called from **one place** — keep it in the transformer body. **Exception:** the same mapping is already used in **another** `transformer.ts` or **another** public entry of the same entity — then one shared helper in `entities/<entity>/lib/` is appropriate (do not duplicate a third time). Mapping **only** to constructor blocks — not in the transformer, but in section 3.1.
- Pass through response metadata (`...response`), and assemble `data` from backend `response.data`.
- **Map all fields** of the target `App*Response['data']`. Go through the entity interface and ensure every field is either filled or intentionally unused.
- If the backend DTO **lacks** a field required on the frontend — add `// TODO: backend missing <field> — ...` and briefly describe in the response to the user what is missing; **temporarily leave a fallback based on current content** (what was already on the page / in mocks / in hardcoded data before integration) so nothing breaks until the API is supplemented.
- Do not "lose" nested objects and arrays: use `.map` for arrays, maintain nesting as in the domain model.

## 5. Pages (`src/pages/`)

- Find all pages where content depends on an entity (e.g., news and `INews`).
- Replace mocks/hardcoded data with a function call from `entities/.../api/...` (e.g., `getArticles` from `request.ts`).
- **Parallelism:** where multiple independent requests are needed for one page — use `Promise.all` if a failure of any request should abort the entire page.
- **Detail page:** when the main request by `slug`/`id` should definitively determine a 404, while other requests (similar materials, secondary blocks) can fail without canceling the page — use **`Promise.allSettled`** and error handling **only for the detail request**, as shown below.
- Follow FSD: a page can import from `entities` and below, not vice versa.

### 5.1. Detail page: `Promise.allSettled` and errors

1. Set up `locale` (e.g., `DEFAULT_LOCALE` from `@/shared/config/i18n` or the current page locale) and pass it to API functions where the `locale` parameter is supported.
2. Result names: `commonPagePropsSettledResponse`, `<entity>DetailSettledResponse` (or similar), plus separate `*SettledResponse` for secondary requests.
3. First, handle **`rejected`** status for the **detail** request:
   - if `reason?.response?.status === 404` (axios response) — in Astro: `return Astro.rewrite('/404/')`; in Next `getStaticPaths` / data functions context — `return { notFound: true }` according to project contract;
   - otherwise, if `reason instanceof Error` — rethrow it;
   - otherwise — `throw new Error(DICT.INTERNAL_SERVER_ERROR[locale])` (`DICT` from `@/shared/config/i18n`).
4. After that, cast types to "successful" result via **`PromiseFulfilledResult<...>.value`** for common props and for the **`App*Response`** of the detail endpoint (page detail: type from `_pages/...`; entity detail: from `entities/...`).
5. Unwrap secondary promises from `allSettled` based on `status === 'fulfilled'` and check `status === 'success'` of the API wrapper if necessary; in case of failure, provide a safe fallback (empty list, etc.), **do not** redirect to 404 because of them.

Example skeleton (Astro):

```ts
const locale = DEFAULT_LOCALE;

const [
  commonPagePropsSettledResponse,
  articleDetailSettledResponse,
  similarNewsSettledResponse,
] = await Promise.allSettled([
  getCommonPageProps(),
  getArticleDetail({ params: { slug }, locale }),
  getArticles({ params: { limit: 4 }, locale }),
]);

if (articleDetailSettledResponse.status === "rejected") {
  if (articleDetailSettledResponse.reason?.response?.status === 404) {
    return Astro.redirect("/404/");
  }

  if (articleDetailSettledResponse.reason instanceof Error) {
    throw articleDetailSettledResponse.reason;
  }

  throw new Error(DICT.INTERNAL_SERVER_ERROR[locale]);
}

const commonPageProps = (
  commonPagePropsSettledResponse as PromiseFulfilledResult<
    Awaited<ReturnType<typeof getCommonPageProps>>
  >
).value;

const articleResponse = (
  articleDetailSettledResponse as PromiseFulfilledResult<AppGetArticleDetailResponse>
).value;
```

If necessary, additionally handle the API **envelope** (`articleResponse.status !== 'success'`) — 404 redirect or error display according to product rules.

## 6. After edits

According to `frontend/AGENTS.md`: if necessary, run `pnpm exec eslint --fix` on affected files and `pnpm run tsc` to check types.

## Brief checklist

- [ ] `pnpm api` run before type edits.
- [ ] Raw fixture JSON saved under `<request-dir>/fixtures/` (section 0.1).
- [ ] mkar-path matches FSD.
- [ ] Zod (lists, etc.): same schema as `components['schemas'][...]`; fallback — empty arrays `[]`. Detail — no Zod in `request.ts`.
- [ ] `Api*Request` from `operations`, with `& {}` for query.
- [ ] `App*Response`: page detail → `ViewRawProps`; entity → `I*`; constructor `content` — section 3.1.
- [ ] Transformer covers all fields; TODO where API is incomplete; no "one-off" `map-*` in `lib/` if no reuse; constructor content — in `map-api-content-to-blocks.ts` (section 3.1).
- [ ] For `mapApiContentToBlocks`: helper types/functions for the article — inside the function, not at the module level.
- [ ] Pages switched to real API; lists and regular pages — `Promise.all`; detail — `Promise.allSettled` + 404/error handling as per section 5.1.
