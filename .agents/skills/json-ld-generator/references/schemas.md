# JSON-LD Schemas Library

This file contains examples of the most commonly used JSON-LD schemas implemented with `schema-dts`.

## BreadcrumbList

```typescript
import type { BreadcrumbList, WithContext } from 'schema-dts';

const breadcrumbs: WithContext<BreadcrumbList> = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://example.com/',
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Category',
      item: 'https://example.com/category/',
    },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Current Page',
      item: 'https://example.com/category/page/',
    },
  ],
};
```

## Organization

```typescript
import type { Organization, WithContext } from 'schema-dts';

const organization: WithContext<Organization> = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Company Name',
  url: 'https://example.com',
  logo: 'https://example.com/logo.png',
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+1-000-000-0000',
    contactType: 'customer service',
  },
  sameAs: [
    'https://twitter.com/company',
    'https://linkedin.com/company',
  ],
};
```

## Article

Used for blog posts or news pages.

```typescript
import type { BlogPosting, WithContext } from 'schema-dts';

const article: WithContext<BlogPosting> = {
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: 'Article Title',
  image: ['https://example.com/image.jpg'],
  datePublished: '2024-02-13T08:00:00+08:00',
  dateModified: '2024-02-13T09:20:00+08:00',
  author: [
    {
      '@type': 'Person',
      name: 'Author Name',
      url: 'https://example.com/profile/author',
    },
  ],
};
```

## WebSite

Usually placed on the home page.

```typescript
import type { WebSite, WithContext } from 'schema-dts';

const website: WithContext<WebSite> = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Site Name',
  url: 'https://example.com',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://example.com/search?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
};
```

## FAQPage

For pages with frequently asked questions.

```typescript
import type { FAQPage, WithContext } from 'schema-dts';

const faq: WithContext<FAQPage> = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How does it work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'It works very simply...',
      },
    },
    {
      '@type': 'Question',
      name: 'How much does it cost?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The cost depends on many factors...',
      },
    },
  ],
};
```

## LocalBusiness

For physical offices or stores.

```typescript
import type { LocalBusiness, WithContext } from 'schema-dts';

const business: WithContext<LocalBusiness> = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Our Office',
  image: 'https://example.com/office.jpg',
  '@id': 'https://example.com/#organization',
  url: 'https://example.com',
  telephone: '+1-000-000-0000',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '123 Main St',
    addressLocality: 'City',
    postalCode: '12345',
    addressCountry: 'US',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 40.7128,
    longitude: -74.0060,
  },
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
    ],
    opens: '09:00',
    closes: '18:00',
  },
};
```
