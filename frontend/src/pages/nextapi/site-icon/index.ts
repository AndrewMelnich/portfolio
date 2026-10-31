import type { APIRoute } from 'astro';
import 'server-only';

export const prerender = false;

const HTML_TIMEOUT_MS = 8_000;
const ICON_TIMEOUT_MS = 3_500;
const HTML_MAX_BYTES = 120_000;
const CACHE_CONTROL = 'public, max-age=86400, stale-while-revalidate=604800';
const LINK_TAG_RE = /<link\b[^>]*>/gi;
const ATTR_RE = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/gi;
const BROWSER_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FALLBACK_PATHS = [
    '/img/favicon/apple-touch-icon.png',
    '/img/favicon/favicon-32x32.png',
    '/img/favicon/favicon.ico',
    '/apple-touch-icon.png',
    '/apple-touch-icon-precomposed.png',
    '/favicon-32x32.png',
    '/favicon.png',
    '/favicon.ico',
    '/favicon.svg',
];

type IconPayload = {
    body: Buffer;
    contentType: string;
    sourceUrl: string;
};

type IconCandidate = {
    href: string;
    score: number;
};

// fallow-ignore-next-line complexity
const readAttr = (tag: string, name: string) => {
    ATTR_RE.lastIndex = 0;

    let match: RegExpExecArray | null;

    while ((match = ATTR_RE.exec(tag))) {
        if (match[1]!.toLowerCase() !== name) {
            continue;
        }

        return match[2] ?? match[3] ?? match[4] ?? '';
    }

    return '';
};

const parseSizeScore = (sizes: string) => {
    const match = /(\d+)\s*x\s*(\d+)/i.exec(sizes);

    if (!match) {
        return sizes.trim().toLowerCase() === 'any' ? 64 : 0;
    }

    return Math.min(Number(match[1]), Number(match[2]));
};

// fallow-ignore-next-line complexity
const scoreRel = (rel: string) => {
    const parts = new Set(rel.toLowerCase().split(/\s+/).filter(Boolean));

    if (parts.has('apple-touch-icon') || parts.has('apple-touch-icon-precomposed')) {
        return 300;
    }

    if (parts.has('icon')) {
        return 200;
    }

    if (parts.has('shortcut')) {
        return 150;
    }

    return 0;
};

const resolveAgainst = (base: string, href: string) => {
    try {
        return new URL(href, base).href;
    } catch {
        return null;
    }
};

const isHttpUrl = (value: string) => {
    try {
        const parsed = new URL(value);

        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

// fallow-ignore-next-line complexity
const collectIconCandidates = (html: string, pageUrl: string) => {
    const candidates: IconCandidate[] = [];

    LINK_TAG_RE.lastIndex = 0;

    let match: RegExpExecArray | null;

    while ((match = LINK_TAG_RE.exec(html))) {
        const tag = match[0]!;
        const rel = readAttr(tag, 'rel');
        const href = readAttr(tag, 'href');
        const relScore = scoreRel(rel);

        if (!href || relScore === 0 || /^(data:|blob:|javascript:)/i.test(href.trim())) {
            continue;
        }

        const absolute = resolveAgainst(pageUrl, href);

        if (!absolute || !isHttpUrl(absolute)) {
            continue;
        }

        candidates.push({
            href: absolute,
            score: relScore + parseSizeScore(readAttr(tag, 'sizes')),
        });
    }

    candidates.sort((left, right) => right.score - left.score);

    return candidates.map((item) => item.href);
};

const withTimeout = async <T>(promise: Promise<T>, ms: number) => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
        return await Promise.race([
            promise,
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error('timeout')), ms);
            }),
        ]);
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
};

// fallow-ignore-next-line complexity
const fetchBinary = async (url: string): Promise<IconPayload | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ICON_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                accept: 'image/*,*/*;q=0.8',
                'user-agent': BROWSER_UA,
            },
        });

        clearTimeout(timer);

        if (!response.ok) {
            return null;
        }

        const contentType = response.headers.get('content-type') ?? '';
        const finalUrl = response.url || url;

        if (/\/$/.test(finalUrl) && !/favicon\.ico\/$/i.test(finalUrl)) {
            return null;
        }

        const body = Buffer.from(await withTimeout(response.arrayBuffer(), ICON_TIMEOUT_MS));

        if (body.byteLength < 16 || (contentType && /^text\/html/i.test(contentType))) {
            return null;
        }

        if (contentType && !/^(image\/|application\/octet-stream|application\/ico)/i.test(contentType)) {
            return null;
        }

        return {
            body,
            contentType: contentType || 'application/octet-stream',
            sourceUrl: finalUrl,
        };
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
};

// fallow-ignore-next-line complexity
const readLimitedText = async (response: Response, maxBytes: number) => {
    if (!response.body) {
        return (await response.text()).slice(0, maxBytes);
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    while (total < maxBytes) {
        const { done, value } = await reader.read();

        if (done || !value) {
            break;
        }

        chunks.push(value);
        total += value.byteLength;

        if (total >= maxBytes) {
            break;
        }
    }

    try {
        await reader.cancel();
    } catch {}

    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
};

const fetchHtmlHead = async (url: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTML_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
                'user-agent': BROWSER_UA,
            },
        });

        clearTimeout(timer);

        if (!response.ok) {
            return null;
        }

        return {
            html: await withTimeout(readLimitedText(response, HTML_MAX_BYTES), HTML_TIMEOUT_MS),
            finalUrl: response.url || url,
        };
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
};

const uniqueHttpUrls = (urls: string[]) =>
    urls.filter((href, index, list) => isHttpUrl(href) && list.indexOf(href) === index);

const firstIcon = async (urls: string[]) => {
    if (urls.length === 0) {
        return null;
    }

    return Promise.any(
        urls.map(async (url) => {
            const icon = await fetchBinary(url);

            if (!icon) {
                throw new Error('miss');
            }

            return icon;
        }),
    ).catch(() => null);
};

const externalIconUrls = (liveUrl: string) => {
    try {
        const host = new URL(liveUrl).hostname;

        return uniqueHttpUrls([
            `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
            `https://icons.duckduckgo.com/ip3/${host}.ico`,
            `https://favicon.yandex.net/favicon/v2/${host}?size=120`,
        ]);
    } catch {
        return [];
    }
};

const resolveIcon = async (liveUrl: string) => {
    const origin = new URL(liveUrl).origin;
    const fallbacks = uniqueHttpUrls(
        FALLBACK_PATHS.map((path) => resolveAgainst(`${origin}/`, path)).filter((href): href is string =>
            Boolean(href),
        ),
    );

    const fromExternal = firstIcon(externalIconUrls(liveUrl));
    const fromPaths = firstIcon(fallbacks);
    const fromHtml = fetchHtmlHead(liveUrl).then(async (page) => {
        if (!page) {
            return null;
        }

        return firstIcon(uniqueHttpUrls(collectIconCandidates(page.html, page.finalUrl)));
    });

    return Promise.any([fromExternal, fromPaths, fromHtml]).catch(() => null);
};

// fallow-ignore-next-line complexity
export const GET: APIRoute = async ({ request }) => {
    const liveUrl = new URL(request.url).searchParams.get('src')?.trim() ?? '';

    if (!liveUrl || !isHttpUrl(liveUrl)) {
        return new Response('400 Bad Request', { status: 400 });
    }

    const icon = await resolveIcon(liveUrl);

    if (!icon) {
        return new Response('404 Not Found', { status: 404 });
    }

    return new Response(new Uint8Array(icon.body), {
        status: 200,
        headers: {
            'Content-Type': icon.contentType,
            'Cache-Control': CACHE_CONTROL,
            'X-Icon-Source': icon.sourceUrl,
            'Access-Control-Expose-Headers': 'X-Icon-Source',
        },
    });
};
