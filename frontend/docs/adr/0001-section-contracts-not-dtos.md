# Section contracts, not backend DTOs, feed the UI

A page is a list of sections. Each section and each view owns a frontend data contract. Transformers map OpenAPI or CMS payloads onto those contracts so a backend rename does not rewrite Astro markup.

Rejected: passing `Api*` / `components['schemas']` into sections. That couples the UI to the CMS resource shape.
