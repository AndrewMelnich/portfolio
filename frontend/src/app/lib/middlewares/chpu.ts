import { defineMiddleware } from 'astro:middleware';
import { chpu } from '@/shared/lib/chpu';

export const chpuMiddleware = defineMiddleware((context, next) => {
    if (/\/filter\/.*/.test(context.url.href)) {
        const params = chpu.parseUrlToParams(context.url.href);
        const newUrl = `${context.url.href.replace(/\/filter\/.*\/apply/, '').replace(/\?.*/, '')}?${chpu.convertParamsToString(params)}`;

        return next(new Request(newUrl, context.request));
    }

    return next();
});
