import { resolve } from 'path';
import node from '@astrojs/node';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { defineConfig, envField, memoryCache } from 'astro/config';
import { loadEnv } from 'vite';
import { IS_EXTERNAL_TEMPLATING, SSR_ENABLED } from './config';
import { cspMetaFirst } from './plugins/astro/csp-meta-first';
import { generateAssetsFilesPlugin } from './plugins/vite/generate-assets-files';
import { scssLoadPathsPlugin } from './plugins/vite/scss-load-paths-plugin';
import { serverOnlyPlugin } from './plugins/vite/server-only';
import { CSP_ENABLED_INTEGRATIONS, DEFAULT_LOCALE, LOCALES } from './src/shared/config';
import { buildCspConfig, CDN_DOMAIN, cdnCondition } from './src/shared/lib/utils';

const {
    PUBLIC_ENV,
    PUBLIC_HOST,
    PUBLIC_API_HOST,
    PORT = 3000,
} = loadEnv(process.env.NODE_ENV || 'production', process.cwd(), '');

// Vite Baseline = Safari/iOS 16.4 → LightningCSS emits `width<=` MQ. Safari 16.3 drops them.
const CSS_TARGET = ['safari16.3', 'ios16.3'];

// https://astro.build/config
export default defineConfig({
    ...(SSR_ENABLED
        ? {
              output: 'server',
              adapter: node({ mode: 'standalone' }),
          }
        : {}),

    cache: {
        provider: memoryCache(),
    },

    devToolbar: {
        enabled: false,
    },

    compressHTML: !IS_EXTERNAL_TEMPLATING,

    server: {
        port: Number(PORT),
    },

    build: {
        assetsPrefix: cdnCondition(PUBLIC_ENV) ? CDN_DOMAIN : undefined,
    },

    vite: IS_EXTERNAL_TEMPLATING
        ? {
              build: {
                  cssTarget: CSS_TARGET,
                  assetsInlineLimit: 0,
                  manifest: true,
                  rollupOptions: {
                      input: {
                          app: 'src/app/app.ts',
                      },
                  },
              },
              plugins: [
                  serverOnlyPlugin(),
                  scssLoadPathsPlugin(),
                  generateAssetsFilesPlugin({
                      css: {
                          src: 'src/app/app.ts',
                          dest: 'build/php_includes/css.php',
                      },
                      js: {
                          src: 'src/app/app.ts',
                          dest: 'build/php_includes/js.php',
                      },
                  }) as any,
              ],
              resolve: {
                  alias: {
                      '@': resolve(process.cwd(), 'src'),
                  },
              },
              css: {
                  preprocessorOptions: {
                      scss: {
                          loadPaths: [resolve(process.cwd(), 'src')],
                      },
                  },
              },
          }
        : {
              build: {
                  cssTarget: CSS_TARGET,
              },
              plugins: [serverOnlyPlugin(), scssLoadPathsPlugin()],
              resolve: {
                  alias: {
                      '@': resolve(process.cwd(), 'src'),
                  },
              },
              css: {
                  preprocessorOptions: {
                      scss: {
                          loadPaths: [resolve(process.cwd(), 'src')],
                      },
                  },
              },
          },

    site: PUBLIC_HOST,
    outDir: 'build',
    trailingSlash: 'always',

    markdown: {
        syntaxHighlight: 'prism',
    },

    security: {
        csp: buildCspConfig({
            publicHost: PUBLIC_HOST,
            apiHost: PUBLIC_API_HOST,
            publicEnv: PUBLIC_ENV,
            integrations: CSP_ENABLED_INTEGRATIONS,
        }),
    },

    i18n: {
        locales: LOCALES as unknown as string[],
        defaultLocale: DEFAULT_LOCALE,
    },

    env: {
        schema: {
            PUBLIC_HOST: envField.string({ context: 'client', access: 'public' }),
            PUBLIC_API_HOST: envField.string({ context: 'client', access: 'public' }),
            PUBLIC_ENV: envField.string({ context: 'client', access: 'public' }),
            OPTIMIZE_INVALIDATE_TOKEN: envField.string({ context: 'server', access: 'secret', default: '' }),
            ROLLBAR_ACCESS_TOKEN: envField.string({ context: 'server', access: 'secret', default: '' }),
            PUBLIC_FIGMA_TOKEN: envField.string({ context: 'client', access: 'public', default: '' }),
            PUBLIC_FIGMA_FILE_ID: envField.string({ context: 'client', access: 'public', default: '' }),
        },
    },

    integrations: [
        react(),
        cspMetaFirst(),

        sitemap({
            changefreq: 'monthly',
            priority: 0.7,
            lastmod: new Date(),
            filter: (page) => {
                return !page.includes('/api/') && !page.includes('/_image/');
            },
            customSitemaps: SSR_ENABLED ? [`${PUBLIC_HOST}/sitemap-dynamic.xml`] : [],
            serialize(item) {
                const url = new URL(item.url);
                const pathname = url.pathname;

                if (pathname === '/') {
                    // Главная страница дефолтной локали
                    item.priority = 1.0;
                } else if (pathname.match(new RegExp(`^/(${LOCALES.join('|')})/$`))) {
                    // Главные страницы локалей
                    item.priority = 1.0;
                } else {
                    // Остальные страницы
                    item.priority = 0.7;
                }

                // @ts-ignore
                item.changefreq = 'monthly';

                return item;
            },
        }),
    ],
});
