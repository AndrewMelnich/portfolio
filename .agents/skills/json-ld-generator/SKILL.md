---
name: json-ld-generator
description: Creating and implementing JSON-LD structured data for SEO. Use this skill when you need to add microdata to a page, such as Organization, Article, and other schemas. The skill helps correctly form schema-dts objects and use the JsonLd component.
---

# JSON-LD Generator

## Overview

This skill helps generate structured data in JSON-LD format to improve SEO and enhance rich snippets in search results.

## Component Usage

The project uses the `JsonLd` component for secure data rendering. It is recommended to use the export from `@/shared/lib/seo`.

```astro
---
import { JsonLd } from '@/shared/lib/seo';
import type { WebSite, WithContext } from 'schema-dts';

const jsonLd: WithContext<WebSite> = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Astro Boilerplate',
  url: 'https://example.com',
};
---

<JsonLd data={jsonLd} />
```

## Main Schemas

### Organization

Company details, logo, contacts, and social media.
See example in [references/schemas.md](references/schemas.md#organization)

### Article / BlogPosting

For news and blog posts.
See example in [references/schemas.md](references/schemas.md#article)

## Recommendations

1. **Typing**: Always use types from the `schema-dts` library to prevent errors in data structure.
2. **Context**: The root object must contain `'@context': 'https://schema.org'` and be wrapped in `WithContext<T>`.
3. **Validation**: After implementation, verify the markup using the [Google Rich Results Test](https://search.google.com/test/rich-results).

Detailed examples of all popular schemas are available in [references/schemas.md](references/schemas.md).
