function globToRegExp(pattern) {
    const escaped = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '\0')
        .replace(/\*/g, '[^/]*')
        .replace(/\0/g, '.*');
    return new RegExp(`^${escaped}$`);
}

export function matchGlob(relativePath, pattern) {
    const normalized = relativePath.replace(/\\/g, '/');
    return globToRegExp(pattern).test(normalized);
}

export function matchesAny(relativePath, patterns) {
    return patterns.some((p) => matchGlob(relativePath, p));
}
