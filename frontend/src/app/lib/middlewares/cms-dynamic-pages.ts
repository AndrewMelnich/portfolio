import { defineMiddleware } from 'astro:middleware';
import { RESERVED_ROOT_SLUGS } from '@/app/lib/cms-reserved-root-segments';

// import { type AppGetPagesResponse, getPages } from '@/entities/page';

const CACHE_TIME_MS = 60000;

/** Astro повторно прогоняет middleware после `rewrite`; без маркера внутренний `/page/...` ушёл бы в 404. */
const CMS_PAGE_REWRITE_HEADER = 'x-cms-page-rewrite';

// const cmsTextPagesCache: {
//     data: AppGetPagesResponse | null;
//     timestamp: number;
// } = {
//     data: null,
//     timestamp: 0,
// };

function cloneRequestWithoutHeader(request: Request, headerName: string): Request {
    const headers = new Headers(request.headers);

    headers.delete(headerName);

    return new Request(request.url, {
        method: request.method,
        headers,
        redirect: request.redirect,
        referrer: request.referrer,
        referrerPolicy: request.referrerPolicy,
        mode: request.mode,
        credentials: request.credentials,
        cache: request.cache,
        integrity: request.integrity,
        keepalive: request.keepalive,
        signal: request.signal,
    });
}

export const cmsDynamicPageMiddleware = defineMiddleware(async (context, next) => {
    const { pathname } = context.url;

    if (pathname.startsWith('/page/')) {
        const isInternalPageRoute = context.request.headers.get(CMS_PAGE_REWRITE_HEADER) === '1';

        if (!isInternalPageRoute) {
            return context.rewrite(new Request(new URL('/404/', context.url), context.request));
        }

        return next(cloneRequestWithoutHeader(context.request, CMS_PAGE_REWRITE_HEADER));
    }

    const slug = pathname.replace(/^\/+|\/+$/g, '');

    if (!slug || slug.includes('/') || RESERVED_ROOT_SLUGS.has(slug)) {
        return next();
    }

    // if (!cmsTextPagesCache.data || Date.now() - cmsTextPagesCache.timestamp > CACHE_TIME_MS) {
    //     const response = await getPages({ params: { is_reserved: 'false', limit: 999 } });

    //     cmsTextPagesCache.data = response;
    //     cmsTextPagesCache.timestamp = Date.now();
    // }

    // const matched = cmsTextPagesCache.data?.data?.items?.find((item) => item.slug === slug);

    // if (!matched) {
    //     return next();
    // }

    // const headers = new Headers(context.request.headers);

    // headers.set(CMS_PAGE_REWRITE_HEADER, '1');

    // return context.rewrite(
    //     new Request(new URL(`/page/${slug}/`, context.url), {
    //         method: context.request.method,
    //         headers,
    //         redirect: context.request.redirect,
    //         referrer: context.request.referrer,
    //         referrerPolicy: context.request.referrerPolicy,
    //         mode: context.request.mode,
    //         credentials: context.request.credentials,
    //         cache: context.request.cache,
    //         integrity: context.request.integrity,
    //         keepalive: context.request.keepalive,
    //         signal: context.request.signal,
    //     }),
    // );

    return next();
});
