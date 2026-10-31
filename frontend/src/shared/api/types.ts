import { z } from 'zod';
import type { AppLocale } from '@/shared/config';
import { createApiResponseSchema } from './utils';

export type ApiRequestParams<T extends Record<string, unknown> = {}> = {
    params: T;
    locale?: AppLocale;
    signal?: AbortSignal;
};

export type ApiResponse<T = unknown> = z.infer<ReturnType<typeof createApiResponseSchema<z.ZodType<T>>>>;

export type AppZodSchemaObject<T extends Record<string, unknown>> = Record<keyof T, z.ZodType<T[keyof T]>>;

export type AppCommonPageData = {
    //
};

export type AxiosError = {
    message: string;
    name: string;
    code?: string;
    config?: {
        url?: string;
        method?: string;
        baseURL?: string;
        headers?: Record<string, string>;
        params?: Record<string, unknown>;
        data?: unknown;
        timeout?: number;
        signal?: AbortSignal;
    };
    request?: unknown;
    response?: {
        data: unknown;
        status: number;
        statusText: string;
        headers: Record<string, string>;
        config: unknown;
    };
    isAxiosError: boolean;
    toJSON: () => object;
};
