import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

const CSP_META = /<meta http-equiv="content-security-policy" content="[^"]*">/i;
const HEAD_START = /<head[^>]*>(\s*<meta charset="[^"]*"\s*\/?>)?/i;

/** Astro puts the CSP `<meta>` at the end of `<head>`; a policy only covers markup parsed after it. */
export function moveCspMetaFirst(html: string): string {
    const meta = html.match(CSP_META)?.[0];

    if (!meta) return html;

    return html.replace(meta, '').replace(HEAD_START, (head) => `${head}${meta}`);
}

export function cspMetaFirst(): AstroIntegration {
    return {
        name: 'csp-meta-first',
        hooks: {
            'astro:build:done': async ({ dir }) => {
                const root = fileURLToPath(dir);
                const files = (await readdir(root, { recursive: true })).filter((file) => file.endsWith('.html'));

                await Promise.all(
                    files.map(async (file) => {
                        const path = `${root}/${file}`;
                        const html = await readFile(path, 'utf8');
                        const moved = moveCspMetaFirst(html);

                        if (moved !== html) await writeFile(path, moved);
                    }),
                );
            },
        },
    };
}
