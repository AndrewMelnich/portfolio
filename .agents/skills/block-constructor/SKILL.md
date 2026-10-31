---
name: block-constructor
description: >
  Page View as a block constructor: backend (or page model) owns type, props,
  and order of UI sections via discriminated union `sections: { type, props }[]`.
  Use when the user says конструктор блоков, конструктор секций, сделай конструктор,
  backend управляет порядком/типом блоков, sections map/switch, or to convert a
  hardcoded View (literal `<Section {...static} />` list) into data-driven
  sections like Index, Contacts, Project, or ConstructorPageView.
  Not for article/CMS body blocks (wysiwyg/gallery inside content) — that is
  content-constructor / backend-api-integration §3.1.
---

# Block constructor

Turn a page View into a data-driven section list. View only switches on `type`; order and props come from outside.

Canon in this repo: `frontend/src/_pages/Index`, `Contacts`, `Project`. Rule shape: `.cursor/rules/frontend/standards/page-sections.mdc`. Astro mechanics: `astro.mdc`.

## Steps

1. **Inventory.** List every section the View mounts today (component + props type + `*Static` if any). Keep that order for the first `model/<page>-page.ts` stub.
2. **Union in View `types.ts`.** Domain props only — no `HTMLAttributes`, no wire/DTO.

```ts
type PageSection =
  | { type: "hero"; props: HeroRawProps }
  | { type: "lead"; props: ProjectLeadProps };

export type RawProps = {
  sections: PageSection[];
};
```

`type` strings: short camelCase (`hero`, `mediaFull`, `similarProjects`), stable for the future API. One variant per section component. Same type may repeat in the array.

3. **View `.astro`.** Destructure `sections`; `sections.map` + `switch (section.type)`; exhaust with `unexpectedSection(_section: never)` (see IndexView). Spread `{...section.props}` into the section component. No hardcoded static imports in the View.

4. **Page model.** `_pages/<Page>/model/<page>-page.ts`:

```ts
export const projectPage = {
  sections: [
    { type: "hero", props: projectHeroStatic },
    { type: "lead", props: projectLeadStatic },
    // …
  ],
} satisfies ProjectViewRawProps;
```

Compose from existing section `*Static` consts. Do not move section literals into the model unless Index-style (no per-section static yet).

5. **Barrel + route.** Slice `index.ts` exports `page` const + default View + `*ViewRawProps` (Index/Contacts shape). Route: `<PageView {...pageConst} />`. Drop unused section re-exports from the barrel unless something outside still imports them.

6. **Done when** View has no direct `*Static` mounts, `tsc` clean, route still renders the same section order.

## Do

- Reuse each section’s existing props / `RawProps` / `*Props` type in the union.
- Keep section slices and their `static.ts` where they are; constructor only reorders mounts.
- For API later: transformer maps CMS/API blocks → the same `sections` union (`backend-api-integration`, page detail → `ViewRawProps`). Do not invent a parallel block type on the View.

## Do not

- Put wire/`Api*` shapes into `.astro` or section props.
- Build a second ContentConstructor feature for page bands.
- Hardcode section order in the View after the conversion.
- Add nav / skip-empty helpers unless the page already needs them (x5 ConstructorPageView is optional complexity).
