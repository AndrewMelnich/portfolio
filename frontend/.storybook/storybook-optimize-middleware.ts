import type { Plugin } from 'vite';

/** redirect optimize to static — SB has no Astro nextapi route */
export const storybookOptimizeMiddleware = (): Plugin => ({
    name: 'storybook-optimize-middleware',
    configureServer(server) {
        server.middlewares.use((req, res, next) => {
            const url = req.url?.split('?')[0];

            if (url !== '/nextapi/optimize' && url !== '/nextapi/optimize/') {
                next();

                return;
            }

            const parsed = new URL(req.url ?? '', 'http://storybook');
            const src = parsed.searchParams.get('src');

            if (!src || !src.startsWith('/static/')) {
                next();

                return;
            }

            res.writeHead(302, { Location: src });
            res.end();
        });
    },
});
