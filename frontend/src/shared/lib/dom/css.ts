type CssCustomPropCast = 'number' | 'int' | 'boolean' | 'string';

function readCustomProp(element: HTMLElement, propKey: string) {
    const value = getComputedStyle(element).getPropertyValue(propKey);

    if (!value.length) return value;

    return value.replace(/'|"/g, '').trim();
}

function cssBoolean(value: string) {
    return value === 'true' || value === '1';
}

const cssCustomPropCasts = {
    int: (value: string) => parseInt(value, 10),
    number: (value: string) => parseFloat(value),
    boolean: cssBoolean,
    string: (value: string) => value,
} satisfies Record<CssCustomPropCast, (value: string) => number | boolean | string>;

export function getCSSCustomProp(element: HTMLElement | undefined, propKey: string, castAs: 'number' | 'int'): number;
export function getCSSCustomProp(element: HTMLElement | undefined, propKey: string, castAs: 'boolean'): boolean;
export function getCSSCustomProp(element: HTMLElement | undefined, propKey: string, castAs?: 'string'): string;
export function getCSSCustomProp(element = document.documentElement, propKey: string, castAs?: CssCustomPropCast) {
    return cssCustomPropCasts[castAs ?? 'string'](readCustomProp(element, propKey));
}
