import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/** Storybook SSR loads astro vite.plugins only — not vite.css.preprocessorOptions */
export const scssLoadPathsPlugin = (): Plugin => {
    const loadPaths = [resolve(process.cwd(), 'src')];

    return {
        name: 'scss-src-load-paths',
        config() {
            return {
                css: {
                    preprocessorOptions: {
                        scss: { loadPaths },
                    },
                },
            };
        },
    };
};
