import type { FilterParamsResult, FilterRange } from './types';

const FILTER_SEPARATOR = '-';
const FILTER_START_KEYWORD = '/filter/';
const FILTER_END_KEYWORD = '/apply';
const FILTER_IGNORED_KEYS: string[] = ['limit'];

function parseRange(str: string): FilterRange {
    const regex = /from-(\d+)-to-(\d+)/;
    const match = str.match(regex);

    if (match) {
        const from = parseFloat(match[1]);
        const to = parseFloat(match[2]);

        return [from, to];
    }

    return [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
}

function parseRangeFrom(str: string): FilterRange {
    const regex = /from-(\d+)/;
    const match = str.match(regex);

    if (match) {
        const from = parseFloat(match[1]);

        return [from, Number.MAX_SAFE_INTEGER];
    }

    return [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
}

function parseRangeTo(str: string): FilterRange {
    const regex = /to-(\d+)/;
    const match = str.match(regex);

    if (match) {
        const to = parseFloat(match[1]);

        return [Number.MIN_SAFE_INTEGER, to];
    }

    return [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
}

export const chpu = {
    parseUrlToParams: (url: string): FilterParamsResult => {
        if (!url.includes(FILTER_START_KEYWORD) || !url.includes(FILTER_END_KEYWORD)) {
            return {};
        }

        const searchParams = new URLSearchParams(url.split('?')[1]);

        return {
            ...((url.replace(/\/$/, '').split(FILTER_START_KEYWORD)[1] || '')
                .split(FILTER_END_KEYWORD)[0]
                ?.split('/')
                .reduce<FilterParamsResult>((obj, str) => {
                    // direct value ('is')
                    if (str.includes(`${FILTER_SEPARATOR}is${FILTER_SEPARATOR}`)) {
                        const arr = str.split(`${FILTER_SEPARATOR}is${FILTER_SEPARATOR}`);
                        const arr0 = decodeURIComponent(arr[0]);
                        const arr1 = decodeURIComponent(arr[1]);
                        const arr1Multiple = arr1.split(`${FILTER_SEPARATOR}and${FILTER_SEPARATOR}`);

                        if (typeof obj[arr0] === 'string' || typeof obj[arr0] === 'number') {
                            obj[arr0] = [obj[arr0] as string | number];

                            (obj[arr0] as (string | number)[]).push(arr1);
                        } else {
                            if (arr1Multiple[1]) {
                                obj[arr0] = arr1Multiple;
                            } else {
                                obj[arr0] = arr1;
                            }
                        }
                    }
                    // Range: from-to
                    else if (str.includes('from') && str.includes('to')) {
                        obj[str.split(`${FILTER_SEPARATOR}from`)[0]] = parseRange(str);
                    }
                    // Range: from
                    else if (str.includes('from') && !str.includes('to')) {
                        obj[str.split(`${FILTER_SEPARATOR}from`)[0]] = parseRangeFrom(str);
                    }
                    // Range: to
                    else if (!str.includes('from') && str.includes('to')) {
                        obj[str.split(`${FILTER_SEPARATOR}to`)[0]] = parseRangeTo(str);
                    }

                    return obj;
                }, {}) ?? {}),
            ...[...searchParams.entries()].reduce<FilterParamsResult>((obj, [key, value]) => {
                if (obj[key]) {
                    if (Array.isArray(obj[key])) {
                        (obj[key] as (string | number)[]).push(decodeURIComponent(value));
                    } else {
                        obj[key] = [obj[key] as string | number, decodeURIComponent(value)];
                    }
                } else {
                    obj[key] = decodeURIComponent(value);
                }

                return obj;
            }, {}),
        };
    },

    encodeParamsToUrl: (
        params: FilterParamsResult,
        { ignoredKeys = [], rangeKeys = [] }: Partial<{ ignoredKeys: string[]; rangeKeys: string[] }> = {},
    ): string => {
        const filteredParams = { ...params };

        [...ignoredKeys, ...FILTER_IGNORED_KEYS].forEach((key) => {
            delete filteredParams[key];
        });

        const entries = Object.entries(filteredParams).filter(([, value]) =>
            Array.isArray(value) ? value.length > 0 : !!value,
        );

        if (entries.length === 0) {
            return '';
        }

        return (
            `${FILTER_START_KEYWORD}` +
            entries
                .reduce<string[]>((arr, [key, value]) => {
                    if (
                        typeof value === 'string' ||
                        typeof value === 'number' ||
                        typeof value === 'boolean' ||
                        (Array.isArray(value) && !rangeKeys.includes(key))
                    ) {
                        if (Array.isArray(value)) {
                            arr.push(
                                `${key}${FILTER_SEPARATOR}is${FILTER_SEPARATOR}${value.join(`${FILTER_SEPARATOR}and${FILTER_SEPARATOR}`)}`,
                            );
                        } else {
                            arr.push(`${key}${FILTER_SEPARATOR}is${FILTER_SEPARATOR}${value}`);
                        }
                    } else {
                        if (rangeKeys.includes(key)) {
                            if (value && typeof value[0] === 'number' && typeof value[1] === 'number') {
                                arr.push(
                                    `${key}${FILTER_SEPARATOR}from${FILTER_SEPARATOR}${value[0]}${FILTER_SEPARATOR}to${FILTER_SEPARATOR}${value[1]}`,
                                );
                            }
                        }
                    }

                    return arr;
                }, [])
                .join('/') +
            `${FILTER_END_KEYWORD}/`
        );
    },

    convertParamsToString: (params: FilterParamsResult) =>
        Object.entries(params)
            .map(([key, value]) => `${key}=${value}`, '')
            .join('&'),
};
