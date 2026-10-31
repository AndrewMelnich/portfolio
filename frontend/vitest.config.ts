/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { getViteConfig } from 'astro/config';
import astroConfig from './astro.config';

export default getViteConfig(
    {
        resolve: {
            alias: {
                '@': resolve(process.cwd(), 'src'),
            },
        },
        test: {
            globals: true,
            environment: 'jsdom',
            exclude: [
                '**/node_modules/**',
                '**/dist/**',
                '**/cypress/**',
                '**/.{idea,git,cache,output,temp}/**',
                '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
                'tests/e2e/**',
                'tests/general/**',
                ...(process.env.VITEST_SUITE === 'html' ? [] : ['tests/html/**']),
                'tests/lighthouse/**',
                'tests/meta-tags/**',
            ],
        },
    },
    {
        site: astroConfig.site,
        trailingSlash: astroConfig.trailingSlash,
    },
);
