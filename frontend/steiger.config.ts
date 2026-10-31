import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

// Astro `src/pages` — routing. FSD pages layer = `src/_pages` (prefixed; steiger prefers it over bare `pages`).
export default defineConfig([
    ...fsd.configs.recommended,
    {
        rules: {
            'fsd/shared-lib-grouping': 'off',
        },
    },
]);
