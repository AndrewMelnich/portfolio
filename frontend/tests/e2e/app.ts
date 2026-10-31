import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { Page } from '@playwright/test';

const findConfig = (dir: string): string => {
    const file = join(dir, '.cursor/fstack/config.json');

    if (existsSync(file)) return file;
    const parent = dirname(dir);

    if (parent === dir) throw new Error('.cursor/fstack/config.json not found');

    return findConfig(parent);
};

export const verifyServer = () => {
    const file = findConfig(process.cwd());
    const { app = '.', verify } = JSON.parse(readFileSync(file, 'utf8'));
    const host: string = verify.host ?? '127.0.0.1';
    const port = Number(process.env.FSTACK_VERIFY_PORT ?? verify.port);
    const url = `http://${host}:${port}`;
    const fill = (template: string) =>
        template.replaceAll('{host}', host).replaceAll('{port}', String(port)).replaceAll('{url}', url);

    return {
        url,
        appReady: verify.appReady as string | undefined,
        command: [verify.build, verify.serve].filter(Boolean).map(fill).join(' && '),
        cwd: resolve(dirname(file), '../..', app),
        env: Object.fromEntries(Object.entries<string>(verify.env ?? {}).map(([key, value]) => [key, fill(value)])),
    };
};

const { appReady } = verifyServer();

export const openRoute = async (page: Page, path: string) => {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });

    if (appReady) {
        await page.waitForFunction(appReady, null, { timeout: 20_000 });
    }

    return response;
};

export const collectErrors = (page: Page) => {
    const errors: string[] = [];

    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
        if (message.type() === 'error') {
            errors.push(`console: ${message.text()}`);
        }
    });

    return errors;
};
