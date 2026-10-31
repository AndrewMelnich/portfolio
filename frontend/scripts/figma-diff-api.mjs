import fs from 'node:fs';
import path from 'node:path';
import { missingHistoryError, pageExhaustsSearch, pickLatestOnOrBefore } from './figma-diff-versions.mjs';

export const API_BASE = 'https://api.figma.com';
const MAX_PAGES = 100;
const MAX_RETRIES = 4;

export function getToken(env = process.env) {
    const token = env.FIGMA_TOKEN || env.FIGMA_ACCESS_TOKEN || env.FIGMA_API_KEY || env.PUBLIC_FIGMA_TOKEN;
    if (!token) {
        throw new Error(
            'Missing Figma token. Set FIGMA_TOKEN, FIGMA_ACCESS_TOKEN, FIGMA_API_KEY, or PUBLIC_FIGMA_TOKEN (frontend/.env is loaded).',
        );
    }
    return token;
}

export function cacheScope(ids) {
    if (!ids?.length) {
        return 'all';
    }
    return [...ids]
        .map((id) => String(id).replace(/:/g, '-'))
        .sort()
        .join('.');
}

function cacheFilePath(cacheDir, fileKey, versionId, scope = 'all') {
    const safeKey = String(fileKey).replace(/[^A-Za-z0-9_-]/g, '_');
    const safeVer = String(versionId).replace(/[^A-Za-z0-9._-]/g, '_');
    const safeScope = String(scope).replace(/[^A-Za-z0-9._-]/g, '_');
    const name = scope && scope !== 'all' ? `${safeVer}.${safeScope}.json` : `${safeVer}.json`;
    return path.join(cacheDir, safeKey, name);
}

export function readCache(cacheDir, fileKey, versionId, scope = 'all') {
    const file = cacheFilePath(cacheDir, fileKey, versionId, scope);
    if (!fs.existsSync(file)) {
        return null;
    }
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeCache(cacheDir, fileKey, versionId, data, scope = 'all') {
    const file = cacheFilePath(cacheDir, fileKey, versionId, scope);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(data)}\n`);
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function retryAfterMs(res, attempt) {
    const raw = res.headers?.get?.('retry-after');
    const sec = raw != null ? Number(raw) : NaN;
    if (Number.isFinite(sec) && sec >= 0) {
        return Math.min(sec * 1000, 30_000);
    }
    return Math.min(1000 * 2 ** attempt, 16_000);
}

export async function figmaFetch(url, { token, fetchImpl = fetch } = {}) {
    let lastErr;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
        const res = await fetchImpl(url, {
            headers: {
                Accept: 'application/json',
                'X-Figma-Token': token,
            },
        });
        if (res.status === 429 && attempt < MAX_RETRIES - 1) {
            await sleep(retryAfterMs(res, attempt));
            continue;
        }
        const text = await res.text();
        if (!res.ok) {
            lastErr = new Error(`Figma API ${res.status} ${url}: ${text.slice(0, 500)}`);
            lastErr.status = res.status;
            if (res.status >= 500 && attempt < MAX_RETRIES - 1) {
                await sleep(retryAfterMs(res, attempt));
                continue;
            }
            throw lastErr;
        }
        return JSON.parse(text);
    }
    throw lastErr;
}

function fileQuery({ version, ids, geometry }) {
    const q = new URLSearchParams();
    if (version) {
        q.set('version', String(version));
    }
    if (ids?.length) {
        q.set('ids', ids.join(','));
    }
    if (geometry === 'paths') {
        q.set('geometry', 'paths');
    }
    const s = q.toString();
    return s ? `?${s}` : '';
}

export async function fetchFile(fileKey, { token, version, ids, geometry, fetchImpl } = {}) {
    const url = `${API_BASE}/v1/files/${encodeURIComponent(fileKey)}${fileQuery({ version, ids, geometry })}`;
    return figmaFetch(url, { token, fetchImpl });
}

export async function fetchVariables(fileKey, { token, version, fetchImpl } = {}) {
    const q = version ? `?version=${encodeURIComponent(String(version))}` : '';
    const url = `${API_BASE}/v1/files/${encodeURIComponent(fileKey)}/variables/local${q}`;
    return figmaFetch(url, { token, fetchImpl });
}

export async function fetchAllVersions(fileKey, { token, fetchImpl, untilMs = null } = {}) {
    const all = [];
    let url = `${API_BASE}/v1/files/${encodeURIComponent(fileKey)}/versions?page_size=50`;
    for (let page = 0; page < MAX_PAGES && url; page += 1) {
        const data = await figmaFetch(url, { token, fetchImpl });
        const versions = data.versions ?? [];
        all.push(...versions);
        if (untilMs != null && pageExhaustsSearch(versions, untilMs)) {
            break;
        }
        const next = data.pagination?.next_page;
        if (next) {
            url = next.startsWith('http') ? next : `${API_BASE}${next}`;
            continue;
        }
        if (versions.length < 50) {
            break;
        }
        const last = versions[versions.length - 1];
        url = `${API_BASE}/v1/files/${encodeURIComponent(fileKey)}/versions?page_size=50&before=${encodeURIComponent(last.id)}`;
    }
    return all;
}

export function pickVersionOrThrow(versions, instantMs, iso, timeZone) {
    const picked = pickLatestOnOrBefore(versions, instantMs);
    if (!picked) {
        throw missingHistoryError(iso, timeZone);
    }
    return picked;
}

export function attachVariables(fileJson, variablesPayload) {
    if (!variablesPayload) {
        return fileJson;
    }
    return {
        ...fileJson,
        variableCollections: variablesPayload.meta?.variableCollections ?? variablesPayload.variableCollections ?? {},
        variables: variablesPayload.meta?.variables ?? variablesPayload.variables ?? {},
    };
}
