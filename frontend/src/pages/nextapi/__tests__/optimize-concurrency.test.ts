// @vitest-environment node
import crypto from 'crypto';
import { cpus } from 'os';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '../optimize';

const TOKEN = vi.hoisted(() => 'optimize-test-token');
const sharpState = vi.hoisted(() => ({ active: 0, peak: 0 }));

vi.mock('astro:env/client', () => ({ PUBLIC_API_HOST: 'https://api.example.test' }));
vi.mock('astro:env/server', () => ({ OPTIMIZE_INVALIDATE_TOKEN: TOKEN }));
vi.mock('@/shared/lib/rollbar', () => ({ reportServerError: vi.fn(async () => true) }));

vi.mock('sharp', () => {
    const toBuffer = () =>
        new Promise<Buffer>((resolve) => {
            sharpState.active += 1;
            sharpState.peak = Math.max(sharpState.peak, sharpState.active);

            setTimeout(() => {
                sharpState.active -= 1;
                resolve(Buffer.from('RIFF'));
            }, 200);
        });

    const chain = {
        resize() {
            return chain;
        },
        webp() {
            return chain;
        },
        avif() {
            return chain;
        },
        toBuffer,
    };

    const sharp = () => chain;

    sharp.concurrency = () => undefined;

    return { default: sharp };
});

const limit = Math.max(1, Math.floor(cpus().length / 2));
const requestCount = limit + 3;
const runId = crypto.randomBytes(8).toString('hex');
const srcFor = (name: string) => `/static/optimize-concurrency-${runId}/${name}.jpg`;
const usedSrcs = new Set<string>();

const callGet = (src: string, format = 'webp') => {
    usedSrcs.add(src);

    return GET({
        request: new Request(
            `http://127.0.0.1/nextapi/optimize/?src=${encodeURIComponent(src)}&w=640&q=80&format=${format}`,
        ),
    } as Parameters<typeof GET>[0]);
};

describe('optimize concurrency', () => {
    beforeAll(() => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(new Uint8Array(Buffer.from('jpeg')), { status: 200 })),
        );
    });

    afterAll(async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));

        for (const src of usedSrcs) {
            await POST({
                request: new Request('http://127.0.0.1/nextapi/optimize/', {
                    method: 'POST',
                    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
                    body: JSON.stringify({ src }),
                }),
            } as Parameters<typeof POST>[0]);
        }

        vi.unstubAllGlobals();
    });

    it('keeps sharp work inside the process limit until each encode finishes', async () => {
        sharpState.active = 0;
        sharpState.peak = 0;

        const responses = await Promise.all(
            Array.from({ length: requestCount }, (_, index) => callGet(srcFor(String(index)))),
        );

        expect(responses.every((response) => response.status === 200)).toBe(true);
        expect(responses.every((response) => response.headers.get('content-type') === 'image/webp')).toBe(true);
        expect(sharpState.peak).toBe(limit);
        expect(sharpState.active).toBe(0);
    });

    it('labels the in-flight duplicate with the encoded format', async () => {
        const src = srcFor('dedup-webp');
        const first = callGet(src);

        await new Promise((resolve) => setTimeout(resolve, 40));

        const second = await callGet(src);
        const firstResponse = await first;

        expect(firstResponse.status).toBe(200);
        expect(firstResponse.headers.get('content-type')).toBe('image/webp');
        expect(second.status).toBe(200);
        expect(second.headers.get('content-type')).toBe('image/webp');
    });

    it('keeps the source type on the avif placeholder and uses image/avif for the waiter', async () => {
        const src = srcFor('dedup-avif');
        const first = callGet(src, 'avif');

        await new Promise((resolve) => setTimeout(resolve, 40));

        const second = await callGet(src, 'avif');
        const firstResponse = await first;

        expect(firstResponse.status).toBe(200);
        expect(firstResponse.headers.get('content-type')).toBe('image/jpeg');
        expect(second.status).toBe(200);
        expect(second.headers.get('content-type')).toBe('image/avif');
    });
});
