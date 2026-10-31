import crypto from 'crypto';
import { constants, promises as fs } from 'fs';
import type { PathLike } from 'fs';
import { cpus } from 'os';
import path from 'path';
import type { APIRoute } from 'astro';
import 'server-only';
import { PUBLIC_API_HOST } from 'astro:env/client';
import { OPTIMIZE_INVALIDATE_TOKEN } from 'astro:env/server';
import sharp from 'sharp';
import { reportServerError } from '@/shared/lib/rollbar';
import { widths } from '@/shared/ui/Image/const';

const USE_AVIF = false;
const ALLOWED_FORMATS = ['avif', 'webp'] as const;
const ALLOWED_QUALITIES = [70, 80] as const;

type Format = (typeof ALLOWED_FORMATS)[number];
type Quality = (typeof ALLOWED_QUALITIES)[number];

const DEFAULT_FORMAT: Format = 'webp';
const DEFAULT_QUALITY: Quality = 80;
const DEFAULT_WIDTH = 3840;
const OPTIMIZED_CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=86400';
const SOURCE_PLACEHOLDER_CACHE_CONTROL = 'public, max-age=180, must-revalidate';
const SOURCE_FETCH_TIMEOUT_MS = 10_000;
const MAX_CONCURRENT_PROCESSES = Math.max(1, Math.floor(cpus().length / 2)); // максимум одновременных процессов в зависимости от количества ядер CPU

type OptimizeParams = {
    width: number;
    quality: Quality;
    format: Format;
};

const queue = new Map<string, Promise<Buffer>>();

sharp.concurrency(MAX_CONCURRENT_PROCESSES);

const withProcessingSlot = (() => {
    let active = 0;
    const waiters: Array<() => void> = [];

    return async <T>(task: () => Promise<T>): Promise<T> => {
        if (active >= MAX_CONCURRENT_PROCESSES) {
            await new Promise<void>((resolve) => {
                waiters.push(() => {
                    active += 1;
                    resolve();
                });
            });
        } else {
            active += 1;
        }

        try {
            return await task();
        } finally {
            active -= 1;
            waiters.shift()?.();
        }
    };
})();

const processImage = (data: Buffer, width: number, quality: number, format: Format) =>
    withProcessingSlot(async () => {
        const pipeline = sharp(data).resize({
            withoutEnlargement: true,
            width,
        });

        if (format === 'webp') {
            return pipeline.webp({ quality }).toBuffer();
        }

        return pipeline.avif({ quality }).toBuffer();
    });

const sha = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

const tokenMatches = (provided: string, expected: string) => {
    const providedDigest = crypto.createHash('sha256').update(provided).digest();
    const expectedDigest = crypto.createHash('sha256').update(expected).digest();

    return crypto.timingSafeEqual(providedDigest, expectedDigest);
};

const normalizeSrc = (rawSrc: string) => {
    const trimmed = rawSrc.trim().replace(/\\/g, '/');
    let decoded = trimmed;

    try {
        decoded = decodeURIComponent(trimmed);
    } catch {
        decoded = trimmed;
    }

    if (/^https?:\/\//.test(decoded)) {
        try {
            const parsed = new URL(decoded);
            const allowedHost = PUBLIC_API_HOST.replace(/^https?:\/\//, '');

            if (parsed.host === allowedHost) {
                return parsed.pathname;
            }
        } catch {
            return decoded;
        }
    }

    return decoded;
};

const isAllowedSourcePath = (src: string) => /^\/static\//.test(src) || /^\/storage\/(settings|media)\//.test(src);
const isAllowedImageExtension = (src: string) => /\.(png|jpe?g|webp|avif)$/i.test(src);
const isUnsafeSrc = (src: string) => src.includes('..') || src.includes('./');
const getCacheFileName = (src: string, width: number, quality: number, format: Format) =>
    sha(`${sha(src)}${sha(String(width))}${sha(String(quality))}${sha(format)}`);

const getCacheDir = (() => {
    const cacheDir = path.resolve('@/../.images_cache');
    let prom: Promise<string>;

    return () =>
        (prom =
            prom ||
            (async () => {
                await fs.mkdir(cacheDir, { recursive: true });

                return cacheDir;
            })());
})();

const fileExists = async (file: PathLike) => {
    try {
        await fs.access(file, constants.F_OK);

        return true;
    } catch {
        return false;
    }
};

const unlinkIfExists = async (filePath: string) => {
    try {
        await fs.unlink(filePath);

        return true;
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            return false;
        }
        throw err;
    }
};

const writeFileAtomic = async (filePath: string, data: Uint8Array) => {
    const tmpPath = `${filePath}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`;

    try {
        await fs.writeFile(tmpPath, data);
        await fs.rename(tmpPath, filePath);
    } finally {
        await unlinkIfExists(tmpPath);
    }
};

const variantFileNames = (src: string) => {
    const names: string[] = [];

    for (const width of widths) {
        for (const quality of ALLOWED_QUALITIES) {
            for (const format of ALLOWED_FORMATS) {
                names.push(getCacheFileName(src, width, quality, format));
            }
        }
    }

    return names;
};

const deleteSourceCache = async (src: string) => {
    const cacheDir = await getCacheDir();
    let removed = 0;

    for (const cacheFileName of variantFileNames(src)) {
        const wasDeleted = await unlinkIfExists(path.join(cacheDir, cacheFileName));

        if (wasDeleted) {
            removed += 1;
        }
    }

    for (const requestKey of queue.keys()) {
        if (requestKey.startsWith(`${src}-`)) {
            queue.delete(requestKey);
        }
    }

    return { removed, indexFound: removed > 0 };
};

const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

const imageResponse = (body: Uint8Array<ArrayBuffer>, contentType: string, cacheControl: string) =>
    new Response(body, {
        status: 200,
        headers: {
            'Cache-Control': cacheControl,
            'Content-Type': contentType,
        },
    });

const sourceImageContentType = (src: string) => {
    const extension = path.extname(src).toLowerCase().slice(1).replace('jpg', 'jpeg');

    return `image/${extension}`;
};

const parsePositiveInt = (raw: string) => {
    if (!/^[1-9]\d*$/.test(raw)) {
        return null;
    }

    const value = Number(raw);

    return Number.isSafeInteger(value) ? value : null;
};

const isQuality = (value: number): value is Quality => (ALLOWED_QUALITIES as readonly number[]).includes(value);

const isFormat = (value: string): value is Format => (ALLOWED_FORMATS as readonly string[]).includes(value);

const snapWidth = (width: number) => {
    for (const allowed of widths) {
        if (allowed >= width) {
            return allowed;
        }
    }

    return widths[widths.length - 1] ?? width;
};

const stepDownQuality = (quality: Quality): Quality => {
    const index = ALLOWED_QUALITIES.indexOf(quality);

    return ALLOWED_QUALITIES[index - 1] ?? quality;
};

const readParams = (widthRaw: string, qualityRaw: string, formatRaw: string): OptimizeParams | Response => {
    const width = parsePositiveInt(widthRaw);
    const quality = parsePositiveInt(qualityRaw);

    if (width === null) {
        return json(400, { error: 'Invalid width' });
    }

    if (quality === null || !isQuality(quality)) {
        return json(400, { error: 'Invalid quality' });
    }

    if (!isFormat(formatRaw)) {
        return json(400, { error: 'Invalid format' });
    }

    return {
        width: snapWidth(width),
        quality,
        format: formatRaw,
    };
};

const validateWebhookAuth = (request: Request) => {
    if (!OPTIMIZE_INVALIDATE_TOKEN) {
        return json(500, { error: 'OPTIMIZE_INVALIDATE_TOKEN is not configured' });
    }

    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();

    if (!token || !tokenMatches(token, OPTIMIZE_INVALIDATE_TOKEN)) {
        return json(401, { error: 'Unauthorized' });
    }

    return null;
};

const validatePayloadSrc = (src: string) => {
    if (!src) {
        return json(400, { error: 'src is required' });
    }

    if (isUnsafeSrc(src)) {
        return json(400, { error: 'Invalid src' });
    }

    if (!isAllowedSourcePath(src)) {
        return json(403, { error: 'Forbidden src' });
    }

    if (!isAllowedImageExtension(src)) {
        return json(400, { error: 'Unsupported file type' });
    }

    return null;
};

const handleInvalidate: APIRoute = async ({ request }) => {
    const authError = validateWebhookAuth(request);

    if (authError) {
        return authError;
    }

    let payload: { src?: string };

    try {
        payload = (await request.json()) as { src?: string };
    } catch {
        return json(400, { error: 'Invalid JSON body' });
    }

    const src = normalizeSrc(payload.src || '');
    const validationError = validatePayloadSrc(src);

    if (validationError) {
        return validationError;
    }

    const result = await deleteSourceCache(src);
    const status = result.indexFound ? 200 : 404;

    return json(status, {
        src,
        removed: result.removed,
        indexFound: result.indexFound,
    });
};

export const POST = handleInvalidate;
export const DELETE = handleInvalidate;

const loadSource = async (sourceUrl: string) => {
    const response = await fetch(sourceUrl, {
        signal: AbortSignal.timeout(SOURCE_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
        return new Response(`HTTP ${response.status}: ${response.statusText}`, {
            status: response.status,
        });
    }

    return Buffer.from(await response.arrayBuffer());
};

export const GET: APIRoute = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const rawSrc = url.searchParams.get('src');
        const src = rawSrc ? normalizeSrc(rawSrc) : '';
        const widthRaw = url.searchParams.get('w') || String(DEFAULT_WIDTH);
        let qualityRaw = url.searchParams.get('q') || String(DEFAULT_QUALITY);
        let formatRaw = url.searchParams.get('format') || DEFAULT_FORMAT;
        const isImageFromBackend = /^\/storage\/(settings|media)\//.test(src);

        if (isUnsafeSrc(src)) {
            return new Response('400 Bad Request', { status: 400 });
        }

        if (!isAllowedImageExtension(src)) {
            return new Response('400 Bad Request: Unsupported file type', { status: 400 });
        }

        if (!isAllowedSourcePath(src)) {
            return new Response('403 Forbidden: Access denied', { status: 403 });
        }

        const acceptHeader = request.headers.get('accept') || '';
        const avifSupported = USE_AVIF && acceptHeader.includes('image/avif');

        if (avifSupported && formatRaw !== 'avif') {
            formatRaw = 'avif';
            const parsedQuality = parsePositiveInt(qualityRaw);

            if (parsedQuality !== null && isQuality(parsedQuality)) {
                qualityRaw = String(stepDownQuality(parsedQuality));
            }
        }

        const params = readParams(widthRaw, qualityRaw, formatRaw);

        if (params instanceof Response) {
            return params;
        }

        const { width, quality, format } = params;
        const cacheDir = await getCacheDir();
        const host = isImageFromBackend ? PUBLIC_API_HOST.replace(/^https?:\/\//, '') : url.host;
        const protocol = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? 'http:' : 'https:';
        const origin = `${protocol}//${host}`;
        const cacheFileName = getCacheFileName(src, width, quality, format);
        const cacheFile = path.join(cacheDir, cacheFileName);
        const contentType = `image/${format}`;

        if (await fileExists(cacheFile)) {
            const cachedFile = await fs.readFile(cacheFile);

            return imageResponse(new Uint8Array(cachedFile), contentType, OPTIMIZED_CACHE_CONTROL);
        }

        const requestKey = `${src}-${width}-${quality}-${format}`;
        let processingPromise = queue.get(requestKey);

        if (!processingPromise) {
            const loaded = await loadSource(origin + src);

            if (loaded instanceof Response) {
                return loaded;
            }

            processingPromise = processImage(loaded, width, quality, format);
            queue.set(requestKey, processingPromise);
            processingPromise
                .finally(() => {
                    queue.delete(requestKey);
                })
                .catch(() => undefined);

            if (format === 'avif') {
                void processingPromise
                    .then((result) => writeFileAtomic(cacheFile, new Uint8Array(result)))
                    .catch((err) => {
                        // eslint-disable-next-line no-console
                        console.error('Image optimization error:', err);

                        return reportServerError(err, request, {
                            src,
                            width,
                            quality,
                            format,
                        });
                    });

                return imageResponse(
                    new Uint8Array(loaded),
                    sourceImageContentType(src),
                    SOURCE_PLACEHOLDER_CACHE_CONTROL,
                );
            }

            const optimized = await processingPromise;

            await writeFileAtomic(cacheFile, new Uint8Array(optimized));

            return imageResponse(new Uint8Array(optimized), contentType, OPTIMIZED_CACHE_CONTROL);
        }

        const optimized = await processingPromise;

        return imageResponse(new Uint8Array(optimized), contentType, OPTIMIZED_CACHE_CONTROL);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Image optimization error:', err);

        const url = new URL(request.url);
        const src = url.searchParams.get('src') ?? '';

        await reportServerError(err, request, {
            src,
            width: url.searchParams.get('w'),
            quality: url.searchParams.get('q'),
            format: url.searchParams.get('format'),
            statusCode: 500,
        });

        return json(500, { error: 'Image processing failed' });
    }
};
