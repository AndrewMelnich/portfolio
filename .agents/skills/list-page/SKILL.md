---
name: list-page
description: >
  List-page load more: the browser GETs /nextapi/<name>/list/ (trailing slash)
  and inserts HTML from experimental_AstroContainer.renderToString.
  Response is { html, hasMore, nextUrl, mode }.
  Use when adding or changing a catalog, blog, projects, news, or other list
  with «загрузить ещё», load more, or page append.
---

# List page

Load more is one BFF request. The route pages the same items the SSR page uses, renders the item partial to a string, and returns JSON. The browser inserts that string. The next slice does not live in the document (`data-*` queue, client-built cards).

Canon: `pages/nextapi/projects/list.ts`, `pages/nextapi/blog/list.ts`, `shared/lib/list-page`, `shared/lib/astro-container`.

## Contract

`ListMode` is `append` | `replace`. `ListPayload`:

```ts
{ html: string; hasMore: boolean; nextUrl: string | null; mode: ListMode }
```

`nextUrl` is the **page** URL (`/projects/?page=3`), so the control works without JS. The fetch URL is `/nextapi/<name>/list/?mode=append&page=2` plus that list's filters. Build it with `listApiUrl`. Trailing slash on the pathname (`trailingSlash: 'always'`).

`append` returns only the new slice. `replace` returns the accumulated prefix `0 … page * size`. `hasMore` is `page * size < total`.

## Steps

1. **SSR.** The page reads `?page=` (and filters) and renders the accumulated prefix with the same item component the partial uses. The more control is an `<a href>` to the next page URL. **Done when** a request with JS disabled shows that prefix and the link points at the next page.

2. **Partial.** One Astro component renders the items and nothing else (no section chrome, no script). A flat list is a run of elements the client can `insertAdjacentHTML` into one parent. A split layout (columns, feature row) puts placement on each item (`data-lane`, `data-placement`); the client moves those nodes. **Done when** the partial's markup matches a card already on the page.

3. **Route** `pages/nextapi/<name>/list.ts`. Read `page`, `mode`, and filters. Load that slice: entity `get*` when OpenAPI exists (skill `backend-api-integration`); until then the page model the SSR page already calls. `renderAstroToString(Partial, props)` from `@/shared/lib/astro-container` (`server-only`, one container per process). Return `listResponse`. On failure, `500` and `{ status: 'error', message }`. **Done when** `GET /nextapi/<name>/list/?page=2&mode=append` is JSON and `html` contains the item class.

4. **Browser.** `preventDefault` on the more control (leave modified clicks to the page URL). `fetch(listApiUrl(...), { headers: { Accept: 'application/json' } })`. `append` → `insertAdjacentHTML('beforeend', html)` or move placed nodes. `replace` → `innerHTML`. eslint-disable `no-unsanitized/method` or `property` with the reason `trusted SSR markup from /nextapi/<name>/list`. Then set `data-page`, copy `nextUrl` onto the link, hide the control when `hasMore` is false, `pushState` the page URL when the list keeps `?page=` in history, and re-init DOM scanners (cursor, parallax) on the inserted root. Failure navigates to the page `href`. **Done when** the click's only list request is that GET, and a second click does not duplicate the first slice.

Browser modules import `@/shared/lib/list-page` only. `@/shared/lib/astro-container` stays on the server. The client script does not import the slice barrel (it re-exports the view and the renderer).

Filters may stay a document fetch. Load more uses this endpoint either way.

## Proof

`verify-ui`: the feature-map spec clicks «загрузить ещё», asserts the `/nextapi/<name>/list/` response, the appended count, and the `?page=` URL. Curl the same GET and check `html`.
