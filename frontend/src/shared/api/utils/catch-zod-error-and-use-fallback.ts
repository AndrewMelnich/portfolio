import { z } from 'zod';
import { reportServerError } from '@/shared/lib/rollbar';
import type { ApiResponse } from '../types';

export function catchZodErrorAndUseFallback<T extends Record<string, unknown>>(fallback: T) {
    return function (ctx: { error: z.ZodError }): ApiResponse<T> {
        if (process.env.NODE_ENV === 'development' || process.env.CI) {
            throw ctx.error;
        }

        reportServerError(ctx.error, undefined, {
            source: 'catchZodErrorAndUseFallback',
            zodIssues: ctx.error.issues,
        });

        return {
            status: 'error',
            data: fallback,
            errors: ctx.error.issues.map((error) => ({ message: error.message })),
        };
    };
}
