import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import type { Page } from '@playwright/test';

const findConfig = (dir: string): string => {
    const file = join(dir, '.cursor/fstack/config.json');
    if (existsSync(file)) return file;
    const parent = dirname(dir);
    if (parent === dir) throw new Error('.cursor/fstack/config.json not found');
    return findConfig(parent);
};

const readDotEnv = (file: string): Record<string, string> => {
    if (!existsSync(file)) return {};
    const out: Record<string, string> = {};

    for (const rawLine of readFileSync(file, 'utf8').split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const body = line.startsWith('export ') ? line.slice(7).trim() : line;
        const eq = body.indexOf('=');
        if (eq <= 0) continue;
        const key = body.slice(0, eq).trim();
        let value = body.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        out[key] = value;
    }

    return out;
};

const shQuote = (value: string) => `'${value.replaceAll("'", `'"'"'`)}'`;

const insideApp = (appDir: string, relPath: string) => {
    const abs = resolve(appDir, relPath);
    const rel = relative(appDir, abs);
    if (!rel || rel.startsWith('..')) {
        throw new Error(`verify.dataDir must be a directory inside the app: ${relPath}`);
    }
    return abs;
};

export const verifyServer = () => {
    const file = findConfig(process.cwd());
    const root = resolve(dirname(file), '../..');
    const { app = '.', verify } = JSON.parse(readFileSync(file, 'utf8'));
    const cwd = resolve(root, app);
    const dotenv = readDotEnv(join(cwd, '.env'));
    const host: string = process.env.FSTACK_VERIFY_HOST ?? verify.host ?? '127.0.0.1';
    const port = Number(process.env.FSTACK_VERIFY_PORT ?? verify.port ?? dotenv.PORT);
    if (!Number.isInteger(port) || port <= 0) {
        throw new Error('no verify port. Set PORT in the app .env, or verify.port to that value.');
    }
    const url = `http://${host}:${port}`;
    const dataDir = typeof verify.dataDir === 'string' ? verify.dataDir : '';
    const fill = (template: string) =>
        template
            .replaceAll('{host}', host)
            .replaceAll('{port}', String(port))
            .replaceAll('{url}', url)
            .replaceAll('{dataDir}', dataDir);

    const steps: string[] = [];
    if (dataDir) {
        const abs = insideApp(cwd, fill(dataDir));
        steps.push(`rm -rf ${shQuote(abs)} && mkdir -p ${shQuote(abs)}`);
    }
    if (verify.prepare) steps.push(fill(verify.prepare));
    if (verify.build) steps.push(fill(verify.build));
    if (verify.serve) steps.push(fill(verify.serve));

    return {
        url,
        appReady: verify.appReady as string | undefined,
        command: steps.join(' && '),
        cwd,
        env: {
            ...Object.fromEntries(Object.entries(dotenv).filter(([key]) => process.env[key] === undefined)),
            ...Object.fromEntries(
                Object.entries<string>(verify.env ?? {}).map(([key, value]) => [key, fill(value)]),
            ),
        },
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
