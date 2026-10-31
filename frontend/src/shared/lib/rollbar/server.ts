import 'server-only';
import type { IncomingMessage } from 'http';
import { ROLLBAR_ACCESS_TOKEN } from 'astro:env/server';
import Rollbar from 'rollbar';
import { isBotUserAgent } from './bots';
import { isRollbarEnabled, rollbarCodeVersion, rollbarEnvironment } from './config';

function getUserAgentFromRollbarItem(item: Rollbar.Dictionary): string | undefined {
    const request = item.request;

    if (request !== null && request !== undefined && typeof request === 'object') {
        const headers = (request as { headers?: Record<string, string> }).headers;
        const fromHeaders = headers?.['User-Agent'] ?? headers?.['user-agent'];

        if (typeof fromHeaders === 'string') {
            return fromHeaders;
        }

        const ua = (request as { user_agent?: unknown }).user_agent ?? (request as { userAgent?: unknown }).userAgent;

        if (typeof ua === 'string') {
            return ua;
        }
    }

    return undefined;
}

function getUserAgentFromIncomingMessage(req: IncomingMessage): string | undefined {
    const userAgent = req.headers['user-agent'];

    return Array.isArray(userAgent) ? userAgent[0] : userAgent;
}

function getUserAgentFromRequest(req: Request): string | undefined {
    return req.headers.get('user-agent') ?? undefined;
}

function itemHasNonEmptyTraceFrames(item: Rollbar.Dictionary): item is Rollbar.Dictionary & {
    body: { trace: { frames: unknown[] } };
} {
    const body = item.body;

    if (body === null || body === undefined || typeof body !== 'object') {
        return false;
    }

    const trace = (body as { trace?: unknown }).trace;

    if (trace === null || trace === undefined || typeof trace !== 'object') {
        return false;
    }

    const frames = (trace as { frames?: unknown }).frames;

    return Array.isArray(frames) && frames.length > 0;
}

function requestToRollbarPayload(req: Request, route?: string): Rollbar.Dictionary {
    const headers: Record<string, string> = {};

    req.headers.forEach((value, key) => {
        headers[key] = value;
    });

    const url = new URL(req.url);

    return {
        url: `${url.pathname}${url.search}`,
        method: req.method,
        headers,
        user_ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
        ...(route ? { route: { path: route } } : {}),
    };
}

const baseConfig = {
    captureUncaught: true,
    captureUnhandledRejections: true,
    environment: rollbarEnvironment,
    payload: rollbarCodeVersion ? { code_version: rollbarCodeVersion } : undefined,
    ignoredMessages: [
        /play\(\) failed because the user didn't interact/,
        /Failed to fetch/,
        /NetworkError/,
        /Load failed/,
        'net::ERR_INTERNET_DISCONNECTED',
        'net::ERR_BLOCKED_BY_CLIENT',
        'Script error.',
        /ResizeObserver loop/,
        /QuotaExceededError/,
        'Access is denied for this document',
        /AbortError/,
        /fetching process for the media resource was aborted/,
        /NotAllowedError.*not allowed by the user agent/,
        /ChunkLoadError/,
        /Loading chunk \d+ failed/,
        /Error creating WebGL context/,
        /WebGL context could not be created/,
    ],
    checkIgnore: function (isUncaught: boolean, _args: Rollbar.LogArgument[], item: Rollbar.Dictionary) {
        if (isBotUserAgent(getUserAgentFromRollbarItem(item))) {
            return true;
        }

        if (!isUncaught) {
            return false;
        }

        return !itemHasNonEmptyTraceFrames(item);
    },
} satisfies Rollbar.Configuration;

export const rollbarServerInstance = new Rollbar({
    accessToken: ROLLBAR_ACCESS_TOKEN,
    enabled: isRollbarEnabled(),
    ...baseConfig,
});

type ReportRequest = IncomingMessage | Request;

function isWebRequest(req: ReportRequest): req is Request {
    return typeof (req as Request).headers?.get === 'function';
}

function isBotRequest(req: ReportRequest): boolean {
    if (isWebRequest(req)) {
        return isBotUserAgent(getUserAgentFromRequest(req));
    }

    return isBotUserAgent(getUserAgentFromIncomingMessage(req));
}

function toRollbarRequest(req: ReportRequest, route?: string): IncomingMessage | Rollbar.Dictionary {
    return isWebRequest(req) ? requestToRollbarPayload(req, route) : req;
}

export function reportServerError(error: unknown, req?: ReportRequest, custom?: Rollbar.Dictionary): Promise<boolean> {
    if (!isRollbarEnabled()) {
        return Promise.resolve(false);
    }

    if (!rollbarServerInstance.options.enabled) {
        return Promise.resolve(false);
    }

    if (req && isBotRequest(req)) {
        return Promise.resolve(false);
    }

    const reportError = error instanceof Error ? error : new Error(String(error));
    const route = typeof custom?.route === 'string' ? custom.route : undefined;

    return new Promise((resolve) => {
        const onSent = () => {
            rollbarServerInstance.wait(() => resolve(true));
        };

        const rollbarReq = req ? toRollbarRequest(req, route) : undefined;

        if (rollbarReq && custom) {
            rollbarServerInstance.error(reportError, rollbarReq, custom, onSent);
        } else if (rollbarReq) {
            rollbarServerInstance.error(reportError, rollbarReq, onSent);
        } else if (custom) {
            rollbarServerInstance.error(reportError, custom, onSent);
        } else {
            rollbarServerInstance.error(reportError, onSent);
        }
    });
}
