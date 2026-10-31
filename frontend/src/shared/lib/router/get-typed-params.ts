import { z } from 'zod';
import { chpu } from '../chpu';

export const getTypedParams = <T extends z.ZodTypeAny>(schema: T, url: string): z.infer<T> => {
    const params = chpu.parseUrlToParams(url);

    return schema.parse(params);
};
