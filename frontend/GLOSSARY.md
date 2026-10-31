# Site

A content site: the visitor moves between pages. Each page is a sequence of sections. Data that reaches the UI is a frontend domain, not the CMS or API resource shape.

## Language

**Page**:
A screen composed of sections. The Astro route file is a thin entry, not the page.
_Avoid_: route, template

**View**:
The composition of a page: receives the page data contract and renders its sections. One view per page. In code and under `ui/`: `*View` / `*ViewRawProps`. Slice folder in `_pages` omits the `View` suffix (`Index`, not `IndexView`) — steiger `repetitive-naming`.
_Avoid_: PageView, page view

**Section**:
A chunk of a page that receives a data contract and renders it. A page is only sections (plus app shell).
_Avoid_: block, component

**Entity**:
A frontend domain concept with its own model, independent of the backend DTO. One entity can appear in more than one section.
_Avoid_: resource, DTO, schema
