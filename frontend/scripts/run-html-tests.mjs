import { spawnSync } from 'node:child_process';
import { SSR_ENABLED } from '../config.js';

if (SSR_ENABLED) {
    console.log('Skip test:html — SSR_ENABLED=true, build has no static HTML pages.');
    process.exit(0);
}

const result = spawnSync('pnpm', ['exec', 'vitest', 'run', 'tests/html'], {
    stdio: 'inherit',
    env: { ...process.env, VITEST_SUITE: 'html' },
});

process.exit(result.status ?? 1);
