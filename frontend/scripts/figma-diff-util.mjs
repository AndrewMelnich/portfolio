export function compareId(a, b) {
    const sa = String(a);
    const sb = String(b);
    if (sa === sb) {
        return 0;
    }
    return sa < sb ? -1 : 1;
}

export function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isPrimitive(value) {
    return value === null || (typeof value !== 'object' && typeof value !== 'function');
}

function normalizeNumber(n) {
    if (!Number.isFinite(n)) {
        return n;
    }
    if (Object.is(n, -0)) {
        return 0;
    }
    if (Number.isInteger(n)) {
        return n;
    }
    const rounded = Number(n.toFixed(6));
    return Object.is(rounded, -0) ? 0 : rounded;
}

export function sortDeep(value) {
    if (typeof value === 'number') {
        return normalizeNumber(value);
    }
    if (Array.isArray(value)) {
        return value.map(sortDeep);
    }
    if (!isPlainObject(value)) {
        return value;
    }
    const out = {};
    for (const key of Object.keys(value).sort(compareId)) {
        const v = value[key];
        if (v !== undefined) {
            out[key] = sortDeep(v);
        }
    }
    return out;
}

export function stableStringify(value) {
    return `${JSON.stringify(sortDeep(value), null, 2)}\n`;
}

export function jsonValue(value) {
    if (value === undefined) {
        return 'null';
    }
    return JSON.stringify(sortDeep(value));
}
