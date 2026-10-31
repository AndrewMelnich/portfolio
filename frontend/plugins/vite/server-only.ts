import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const MODULE_ID = 'server-only';
const FORBIDDEN_ID = '\0server-only-client-forbidden';
const EMPTY_FILE = resolve(dirname(fileURLToPath(import.meta.url)), '../../vendor/server-only/empty.js');

/** Astro/Vite SSR-ish environment names (see astro/dist/environments.js). */
const SERVER_ENV_NAMES = new Set(['ssr', 'prerender', 'astro']);

/**
 * Astro/Vite analogue of npm `server-only`.
 *
 * - Real package (`vendor/server-only`): `default` → empty, `browser` → throw.
 *   Covers SSR module-runner (no virtual `\0` id) and client runtime.
 * - Plugin: when Vite environment name is known `client`, fail at transform time
 *   with a clear build/dev error (don't wait for browser.js evaluation).
 */
export function serverOnlyPlugin(): Plugin {
    return {
        name: 'server-only',
        enforce: 'pre',
        resolveId(id) {
            if (id !== MODULE_ID) {
                return undefined;
            }

            const envName = this.environment?.name;

            if (envName === 'client') {
                return FORBIDDEN_ID;
            }

            if (envName && SERVER_ENV_NAMES.has(envName)) {
                return EMPTY_FILE;
            }

            // Unknown / module-runner without env → package exports (default = empty).
            return undefined;
        },
        load(id) {
            if (id !== FORBIDDEN_ID) {
                return undefined;
            }

            throw this.error(
                '[server-only] imported in the client bundle. ' +
                    'Keep SSR fetchers in @/entities/<name>/api; client-safe API stays on @/entities/<name>.',
            );
        },
    };
}
