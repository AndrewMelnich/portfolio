import 'server-only';
import { PUBLIC_ENV } from 'astro:env/client';
import { ROLLBAR_ACCESS_TOKEN } from 'astro:env/server';

const DISABLED_ENVIRONMENTS = new Set(['local']);

export const rollbarEnvironment = PUBLIC_ENV || 'development';

export const isRollbarEnvironmentEnabled = !DISABLED_ENVIRONMENTS.has(rollbarEnvironment);

export function isRollbarEnabled(): boolean {
    return Boolean(ROLLBAR_ACCESS_TOKEN) && isRollbarEnvironmentEnabled;
}

export const rollbarCodeVersion =
    process.env.CI_COMMIT_SHA || process.env.CI_COMMIT_SHORT_SHA || process.env.npm_package_version;
