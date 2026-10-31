import { defineConfig } from '@playwright/test';
import { verifyServer } from './tests/e2e/app';

const server = verifyServer();

const GL_SPECS = /(canvas|webgl)\.spec\.ts$/;

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 60_000,
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 2 : '50%',
    projects: [
        { name: 'dom', testIgnore: GL_SPECS, use: { reducedMotion: 'reduce' } },
        {
            name: 'gl',
            testMatch: GL_SPECS,
            dependencies: process.env.CI ? ['dom'] : [],
            workers: process.env.CI ? 1 : undefined,
        },
    ],
    reporter: process.env.CI ? 'github' : 'list',
    webServer: {
        command: server.command,
        cwd: server.cwd,
        env: server.env,
        url: server.url,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
    },
    use: {
        baseURL: server.url,
        channel: 'chromium',
        reducedMotion: 'no-preference',
        viewport: { width: 1440, height: 900 },
        trace: 'retain-on-failure',
        actionTimeout: 10_000,
    },
});
