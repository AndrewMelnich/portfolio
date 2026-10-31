import { z } from 'zod';

/**
 * Zod schema for API responses.
 *
 * @typedef {import('zod').ZodObject} ApiResponseSchema
 * @property {boolean} success - Indicates whether the request was successful.
 * @property {unknown} [data] - Optional, arbitrary data returned by the API.
 * @property {string[]} [errors] - Optional, array of error messages.
 */
export function createApiResponseSchema<T extends z.ZodType<unknown>>(dataSchema: T) {
    return z.object({
        status: z.enum(['success', 'error']),
        data: dataSchema,
        errors: z.array(z.object({ message: z.string() })).optional(),
    });
}
