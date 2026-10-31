import { defineMiddleware } from 'astro:middleware';
import { CSP_FRAME_ANCESTORS } from '@/shared/lib/utils';

export const securityMiddleware = defineMiddleware(async (_context, next) => {
    const response = await next();

    response.headers.append('Content-Security-Policy', CSP_FRAME_ANCESTORS);
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    return response;
});
