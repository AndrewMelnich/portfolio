---
name: forms
description: >
  Forms: Zod schema in entities, FormValidator client (submit + blur),
  createFormSender / AjaxForm, fake or real nextapi POST with trailing slash.
  Use when adding or editing a feedback/contact/subscribe form, form validation,
  multipart submit, or /nextapi/* form endpoint.
---

# Forms

## Shape first

One Zod object in `entities/<domain>/model/schema.ts`. Client and `pages/nextapi/*` import **that** schema — never the widget barrel (widget `index` re-exports Astro and hangs the API route).

`export type Values = z.infer<typeof schema>`. Discriminated API envelope:

```ts
type FormApiResponse =
  | { status: "success"; data: { received: true } }
  | {
      status: "error";
      data: null;
      errors: { name: string; message: string }[];
    };
```

## Markup

- `novalidate` on `<form>`
- `action="/nextapi/<name>/"` — **trailing slash** (`astro` `trailingSlash: 'always'`; bare path → 301 and broken POST)
- `method="post"`; files → `enctype="multipart/form-data"`
- Fields: `Input` / `Select` / `FileInput` with `name`
- Errors: `.js-input-group` + `.js-app-message` (FormValidator defaults for Plenum UI)

## Client

```ts
const validator = new FormValidator(form, {
  INPUT_SELECTOR: ".js-input-group input[name], .js-dropdown-input",
  MESSAGE_SELECTOR: ".js-app-message",
});
validator.bindFieldValidation(schema); // blur
// submit:
if (!validator.validate(schema)) return; // paints + scrollToFirstError
createFormSender(form, {
  shouldClearInputs: true,
  headers: { "X-Requested-With": "XMLHttpRequest" },
}).send();
```

Import sender/loading from `@/shared/lib/ajax-form` public API (no sidestep).

`AjaxForm` (`.js-ajax-form`) = HTML5/`createValidator` path. Zod path = `FormValidator` + shared schema. Prefer Zod when the same rules must hit the fake/real endpoint.

## Server (`pages/nextapi/<name>.ts`)

```ts
const raw: unknown = Object.fromEntries((await request.formData()).entries());
const parsed = schema.safeParse(raw);
// 400 + { status: 'error', ... } | 200 + { status: 'success', data }
```

Fake OK until OpenAPI exists. Real endpoint → skill `backend-api-integration` (`pnpm api`, fixture, mkar).

## Proof

`verify-ui` (row or recipe in `.cursor/fstack/features.md`): empty submit → field messages; valid submit → `js-ajax-form--success` and cleared inputs. Curl `POST` with trailing slash.

## Reference

Live example: `widgets/FeedbackForm` + `entities/feedback` + `pages/nextapi/feedback.ts`.
