import { chpu } from './chpu';
import { getPathWithoutFilter } from './get-path-without-filter';
import type { FilterParamsResult } from './types';

export const encodeUrl = (
    path: string,
    params: FilterParamsResult,
    options?: Partial<{ ignoredKeys: string[]; rangeKeys: string[] }>,
) => {
    const splittedPath = path.split('?');
    const searchParams = new URLSearchParams(splittedPath[1]).toString();
    const existingParams = chpu.parseUrlToParams(path);
    const mergedParams = { ...existingParams, ...params };

    const filteredParams = { ...mergedParams };

    if (splittedPath[1]) {
        const urlParams = new URLSearchParams(splittedPath[1]);

        for (const key of urlParams.keys()) {
            delete filteredParams[key];
        }
    }

    const basePath = getPathWithoutFilter(path, true);
    const encodedChpu = chpu.encodeParamsToUrl(filteredParams, options);

    return `${basePath}${encodedChpu || '/'}`.replace('//', '/') + (searchParams ? `?${searchParams}` : '');
};
