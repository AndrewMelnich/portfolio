import { sequence } from 'astro:middleware';
import {
    chpuMiddleware,
    cmsDynamicPageMiddleware,
    securityMiddleware,
    staticFilesMiddleware,
} from '@/app/lib/middlewares';
import { SSR_ENABLED } from '../config.js';

export const onRequest = sequence(
    ...(SSR_ENABLED ? [staticFilesMiddleware, chpuMiddleware, cmsDynamicPageMiddleware, securityMiddleware] : []),
);
