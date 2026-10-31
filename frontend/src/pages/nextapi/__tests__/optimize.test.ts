// @vitest-environment node
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { widths } from '@/shared/ui/Image/const';
import { GET, POST } from '../optimize';

const TOKEN = vi.hoisted(() => 'optimize-test-token');

vi.mock('astro:env/client', () => ({ PUBLIC_API_HOST: 'https://api.example.test' }));
vi.mock('astro:env/server', () => ({ OPTIMIZE_INVALIDATE_TOKEN: TOKEN }));
vi.mock('@/shared/lib/rollbar', () => ({ reportServerError: vi.fn(async () => true) }));

const SRC = '/static/optimize-route-fixture.jpg';
const BROKEN_SRC = '/static/optimize-route-broken.jpg';
const VARIANT_SRC = '/static/optimize-route-variants.jpg';
const BACKEND_SRC = '/storage/media/optimize-fetch.jpg';

const fixtures = new Map<string, Buffer>();

const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const requested = String(input);

    for (const [src, body] of fixtures) {
        if (requested.endsWith(src)) {
            return new Response(new Uint8Array(body), { status: 200 });
        }
    }

    return new Response('Not Found', { status: 404, statusText: 'Not Found' });
});

const callGet = (search: string) =>
    GET({
        request: new Request(`http://127.0.0.1/nextapi/optimize/?${search}`),
    } as Parameters<typeof GET>[0]);

const callInvalidate = (src: string, token: string) =>
    POST({
        request: new Request('http://127.0.0.1/nextapi/optimize/', {
            method: 'POST',
            headers: {
                authorization: `Bearer ${token}`,
                'content-type': 'application/json',
            },
            body: JSON.stringify({ src }),
        }),
    } as Parameters<typeof POST>[0]);

describe('optimize route', () => {
    beforeAll(async () => {
        const width = 4000;
        const height = 8;
        const raw = Buffer.alloc(width * height * 3);

        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                const offset = (y * width + x) * 3;

                raw[offset] = x % 256;
                raw[offset + 1] = (x * 2) % 256;
                raw[offset + 2] = (y * 40 + x) % 256;
            }
        }

        const jpeg = await sharp(raw, { raw: { width, height, channels: 3 } })
            .jpeg()
            .toBuffer();

        fixtures.set(SRC, jpeg);
        fixtures.set(VARIANT_SRC, jpeg);
        fixtures.set(BACKEND_SRC, jpeg);
        fixtures.set(BROKEN_SRC, Buffer.from('not an image'));
        vi.stubGlobal('fetch', fetchMock);
    });

    afterAll(async () => {
        for (const src of [SRC, BROKEN_SRC, VARIANT_SRC, BACKEND_SRC]) {
            await callInvalidate(src, TOKEN);
        }

        vi.unstubAllGlobals();
    });

    it('serves every srcset width as webp with that exact width', async () => {
        for (const width of widths) {
            const response = await callGet(`src=${encodeURIComponent(SRC)}&w=${width}&q=80`);
            const bytes = Buffer.from(await response.arrayBuffer());
            const meta = await sharp(bytes).metadata();

            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toBe('image/webp');
            expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
            expect(bytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
            expect(meta.width).toBe(width);
        }
    });

    it('snaps a layout width up to the next srcset width', async () => {
        const response = await callGet(`src=${encodeURIComponent(SRC)}&w=850&q=80`);
        const meta = await sharp(Buffer.from(await response.arrayBuffer())).metadata();

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('image/webp');
        expect(meta.width).toBe(1024);
        expect(response.headers.get('cache-control')).toBe('public, max-age=300, stale-while-revalidate=86400');
    });

    it('caps an oversized width at the largest srcset width', async () => {
        const response = await callGet(`src=${encodeURIComponent(SRC)}&w=5000&q=70`);
        const meta = await sharp(Buffer.from(await response.arrayBuffer())).metadata();

        expect(response.status).toBe(200);
        expect(meta.width).toBe(3840);
    });

    it('rejects quality and format outside the allowlist', async () => {
        const quality = await callGet(`src=${encodeURIComponent(SRC)}&w=640&q=75`);
        const format = await callGet(`src=${encodeURIComponent(SRC)}&w=640&q=80&format=jpeg`);
        const garbageWidth = await callGet(`src=${encodeURIComponent(SRC)}&w=640abc&q=80`);

        expect(quality.status).toBe(400);
        expect(await quality.json()).toEqual({ error: 'Invalid quality' });
        expect(format.status).toBe(400);
        expect(await format.json()).toEqual({ error: 'Invalid format' });
        expect(garbageWidth.status).toBe(400);
        expect(await garbageWidth.json()).toEqual({ error: 'Invalid width' });
    });

    it('uses quality 80 when q is omitted', async () => {
        const explicit = Buffer.from(await (await callGet(`src=${encodeURIComponent(SRC)}&w=640&q=80`)).arrayBuffer());
        const omittedResponse = await callGet(`src=${encodeURIComponent(SRC)}&w=640`);
        const omitted = Buffer.from(await omittedResponse.arrayBuffer());
        const lower = Buffer.from(await (await callGet(`src=${encodeURIComponent(SRC)}&w=640&q=70`)).arrayBuffer());

        expect(omittedResponse.status).toBe(200);
        expect(omitted).toEqual(explicit);
        expect(lower).not.toEqual(explicit);
    });

    it('deletes every parallel variant without an index file', async () => {
        await Promise.all(
            widths.flatMap((width) =>
                [70, 80].map((quality) => callGet(`src=${encodeURIComponent(VARIANT_SRC)}&w=${width}&q=${quality}`)),
            ),
        );

        const invalidated = await callInvalidate(VARIANT_SRC, TOKEN);
        const body = (await invalidated.json()) as { removed: number; indexFound: boolean };
        const again = await callInvalidate(VARIANT_SRC, TOKEN);
        const againBody = (await again.json()) as { removed: number };

        expect(invalidated.status).toBe(200);
        expect(body.removed).toBe(widths.length * 2);
        expect(body.indexFound).toBe(true);
        expect(again.status).toBe(404);
        expect(againBody.removed).toBe(0);
    });

    it('does not return the processor error to the client', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        try {
            const response = await callGet(`src=${encodeURIComponent(BROKEN_SRC)}&w=640&q=80`);
            const body = await response.json();

            expect(response.status).toBe(500);
            expect(body).toEqual({ error: 'Image processing failed' });
        } finally {
            consoleError.mockRestore();
        }
    });

    it('rejects a token whose length differs from the secret', async () => {
        const shorter = await callInvalidate(SRC, 'x');
        const longer = await callInvalidate(SRC, `${TOKEN}-extra`);

        expect(shorter.status).toBe(401);
        expect(longer.status).toBe(401);
        expect(await shorter.json()).toEqual({ error: 'Unauthorized' });
    });

    it('passes an abort signal when fetching a source image', async () => {
        fetchMock.mockClear();

        const response = await callGet(`src=${encodeURIComponent(BACKEND_SRC)}&w=640&q=80`);
        const init = fetchMock.mock.calls.find(([input]) => String(input).endsWith(BACKEND_SRC))?.[1];

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('image/webp');
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        expect(init?.signal?.aborted).toBe(false);
    });
});
