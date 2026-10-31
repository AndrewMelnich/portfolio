import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook-astro/framework';
import { storybookAstroScssPlugin } from './astro-scss-plugin.ts';
import { storybookOptimizeMiddleware } from './storybook-optimize-middleware.ts';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(dirname, '../src');

const config: StorybookConfig = {
    stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
    staticDirs: ['../public'],
    addons: ['@storybook/addon-mcp'],
    framework: {
        name: '@storybook-astro/framework',
        options: {},
    },
    async viteFinal(viteConfig) {
        viteConfig.resolve ??= {};
        const alias = viteConfig.resolve.alias ?? [];
        const aliases = Array.isArray(alias)
            ? alias
            : Object.entries(alias).map(([find, replacement]) => ({ find, replacement }));

        viteConfig.resolve.alias = [...aliases, { find: '@', replacement: srcDir }];

        viteConfig.css ??= {};
        viteConfig.css.preprocessorOptions ??= {};
        viteConfig.css.preprocessorOptions.scss ??= {};
        viteConfig.css.preprocessorOptions.scss.loadPaths = [srcDir];

        viteConfig.optimizeDeps ??= {};
        viteConfig.optimizeDeps.exclude = [
            ...(viteConfig.optimizeDeps.exclude ?? []),
            'astro',
            'astro/types',
            'astro/types.d.ts',
        ];

        viteConfig.plugins ??= [];
        viteConfig.plugins.push(storybookAstroScssPlugin(srcDir), storybookOptimizeMiddleware());

        return viteConfig;
    },
};

export default config;
