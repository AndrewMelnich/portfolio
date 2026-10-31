const FIGMA_URL_RE = /figma\.com\/(?:design|file|proto|board|slides)\/([A-Za-z0-9]+)/g;

export function parseFileKeyFromText(text) {
    if (!text) {
        return null;
    }
    FIGMA_URL_RE.lastIndex = 0;
    const match = FIGMA_URL_RE.exec(text);
    return match ? match[1] : null;
}

function parseFileKeyFromTexts(texts) {
    for (const text of texts) {
        const key = parseFileKeyFromText(text);
        if (key) {
            return key;
        }
    }
    return null;
}

/**
 * @param {{
 *   flag?: string,
 *   env?: Record<string, string | undefined>,
 *   agentsTexts?: string[],
 * }} opts
 * @returns {string}
 */
export function resolveFileKey({ flag, env = process.env, agentsTexts = [] }) {
    if (flag) {
        return flag;
    }
    const fromEnv = env.FIGMA_FILE_KEY || env.PUBLIC_FIGMA_FILE_ID;
    if (fromEnv) {
        return fromEnv;
    }
    const fromDocs = parseFileKeyFromTexts(agentsTexts);
    if (fromDocs) {
        return fromDocs;
    }
    throw new Error(
        'No Figma file key. Pass --file-key, set FIGMA_FILE_KEY, or add a figma.com/design URL to AGENTS.md.',
    );
}

const LINK_KINDS = new Set(['design', 'file', 'proto', 'board', 'slides']);

/**
 * @param {string} input
 * @returns {{ fileKey: string, nodeId: string | null } | null}
 */
export function parseFigmaLink(input) {
    if (!input || typeof input !== 'string') {
        return null;
    }
    let url;
    try {
        url = new URL(input);
    } catch {
        return null;
    }
    if (!/(^|\.)figma\.com$/i.test(url.hostname)) {
        return null;
    }
    const parts = url.pathname.split('/').filter(Boolean);
    if (!LINK_KINDS.has(parts[0]) || !parts[1]) {
        return null;
    }
    let fileKey = parts[1];
    const branchAt = parts.indexOf('branch');
    if (branchAt !== -1 && parts[branchAt + 1]) {
        fileKey = parts[branchAt + 1];
    }
    const rawNode = url.searchParams.get('node-id');
    const nodeId = rawNode ? rawNode.replace(/-/g, ':') : null;
    return { fileKey, nodeId };
}

export function nodeDeepLink(fileKey, nodeId) {
    return `https://www.figma.com/design/${fileKey}?node-id=${String(nodeId).replace(/:/g, '-')}`;
}
