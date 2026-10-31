import { compareId } from './figma-diff-util.mjs';

function createdAtMs(version) {
    const ms = Date.parse(version.created_at);
    if (!Number.isFinite(ms)) {
        throw new Error(`Version ${version.id} has invalid created_at: ${version.created_at}`);
    }
    return ms;
}

function compareVersionId(a, b) {
    try {
        const d = BigInt(a) - BigInt(b);
        return d < 0n ? -1 : d > 0n ? 1 : 0;
    } catch {
        return compareId(a, b);
    }
}

export function pickLatestOnOrBefore(versions, instantMs) {
    const eligible = versions.filter((v) => createdAtMs(v) <= instantMs);
    if (eligible.length === 0) {
        return null;
    }
    eligible.sort((a, b) => {
        const ta = createdAtMs(a);
        const tb = createdAtMs(b);
        if (ta !== tb) {
            return ta - tb;
        }
        return compareVersionId(String(a.id), String(b.id));
    });
    return eligible[eligible.length - 1];
}

function newestFirst(versions) {
    if (versions.length < 2) {
        return null;
    }
    return createdAtMs(versions[0]) >= createdAtMs(versions[versions.length - 1]);
}

export function pageExhaustsSearch(versionsOnPage, instantMs) {
    const order = newestFirst(versionsOnPage);
    if (order === null) {
        return false;
    }
    if (order) {
        return versionsOnPage.some((v) => createdAtMs(v) <= instantMs);
    }
    return versionsOnPage.some((v) => createdAtMs(v) > instantMs);
}

export function missingHistoryError(iso, timeZone) {
    return new Error(
        `No Figma version on or before ${iso} (${timeZone}). ` +
            'Starter plans keep 30 days of history; autosaves are about every 30 minutes. ' +
            'Name a version in Figma if you need a stable checkpoint.',
    );
}
