import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

function findRoot() {
    if (process.env.FSTACK_PROJECT_DIR) return path.resolve(process.env.FSTACK_PROJECT_DIR);
    const git = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
    return git.status === 0 ? git.stdout.trim() : process.cwd();
}

export const ROOT = findRoot();
const CONFIG_FILE = path.join(ROOT, '.cursor/fstack/config.json');

if (!fs.existsSync(CONFIG_FILE)) {
    console.error(`fstack: ${CONFIG_FILE} is missing. Run /setup-fstack in this project first.`);
    process.exit(2);
}

const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
const verify = config.verify ?? {};
const host = process.env.FSTACK_VERIFY_HOST ?? verify.host ?? '127.0.0.1';
const port = process.env.FSTACK_VERIFY_PORT ?? verify.port;

export const APP = path.resolve(ROOT, config.app ?? '.');
export const VERIFY_ORIGIN = port != null ? `http://${host}:${port}` : null;

const requireFromApp = createRequire(path.join(APP, 'package.json'));

export function fromApp(name) {
    try {
        return requireFromApp(name);
    } catch {
        console.error(`fstack: "${name}" is not installed in ${APP}. Add it to the app's devDependencies.`);
        process.exit(2);
    }
}
