import { createHash } from 'node:crypto';
import type { AstroUserConfig } from 'astro';
import { CDN_DOMAIN, cdnCondition } from './cdn';

type CspConfig = Exclude<NonNullable<NonNullable<AstroUserConfig['security']>['csp']>, boolean>;

type Directive =
    | 'script-src'
    | 'style-src'
    | 'img-src'
    | 'media-src'
    | 'font-src'
    | 'connect-src'
    | 'frame-src'
    | 'worker-src'
    | 'form-action';

type Sources = Partial<Record<Directive, ReadonlyArray<string | undefined>>>;

const YANDEX_METRICA_COLLECTORS = [
    'https://mc.yandex.ru',
    'https://mc.yandex.az',
    'https://mc.yandex.by',
    'https://mc.yandex.co.il',
    'https://mc.yandex.com',
    'https://mc.yandex.com.am',
    'https://mc.yandex.com.ge',
    'https://mc.yandex.com.tr',
    'https://mc.yandex.ee',
    'https://mc.yandex.fr',
    'https://mc.yandex.kg',
    'https://mc.yandex.kz',
    'https://mc.yandex.lt',
    'https://mc.yandex.lv',
    'https://mc.yandex.md',
    'https://mc.yandex.tj',
    'https://mc.yandex.tm',
    'https://mc.yandex.uz',
    'https://mc.webvisor.com',
    'https://mc.webvisor.org',
];

const VK_PIXEL_HOSTS = ['https://top-fwz1.mail.ru', 'https://privacy-cs.mail.ru', 'https://mytopf.com'];

const YANDEX_MAPS_HOSTS = ['https://api-maps.yandex.ru', 'https://*.api-maps.yandex.ru'];

const GOOGLE_ANALYTICS_COLLECTORS = [
    'https://www.googletagmanager.com',
    'https://*.google-analytics.com',
    'https://*.analytics.google.com',
];

/**
 * Hosts per vendor CSP guide, checked in Chromium against the real tags.
 * Weaker than the default: `yandexMaps` adds `'unsafe-eval'`, `yandexSmartCaptcha` inline `<style>`,
 * `unsafeInlineScripts` drops the script hashes for GTM Custom HTML tags and Custom JavaScript variables.
 */
export const CSP_INTEGRATIONS = {
    yandexMetrica: {
        'script-src': ['https://mc.yandex.ru', 'https://yastatic.net'],
        'connect-src': [
            ...YANDEX_METRICA_COLLECTORS,
            ...YANDEX_METRICA_COLLECTORS.map((host) => host.replace('https:', 'wss:')),
        ],
        'img-src': YANDEX_METRICA_COLLECTORS,
        'frame-src': ['blob:', 'https://mc.yandex.ru'],
        'worker-src': ['blob:'],
    },
    gtm: {
        'script-src': ['https://www.googletagmanager.com'],
        'connect-src': ['https://www.googletagmanager.com', 'https://www.google.com'],
        'img-src': ['https://www.googletagmanager.com'],
        'frame-src': ['https://www.googletagmanager.com'],
    },
    googleAnalytics: {
        'script-src': ['https://www.googletagmanager.com'],
        'connect-src': [...GOOGLE_ANALYTICS_COLLECTORS, 'https://www.google.com'],
        'img-src': GOOGLE_ANALYTICS_COLLECTORS,
    },
    calltouch: {
        'script-src': ['https://mod.calltouch.ru'],
        'connect-src': ['https://mod.calltouch.ru', 'https://api.calltouch.ru'],
    },
    vkPixel: {
        'script-src': VK_PIXEL_HOSTS,
        'connect-src': VK_PIXEL_HOSTS,
        'img-src': VK_PIXEL_HOSTS,
        'frame-src': ['blob:', ...VK_PIXEL_HOSTS],
    },
    yandexMaps: {
        'script-src': [...YANDEX_MAPS_HOSTS, 'https://yastatic.net', "'unsafe-eval'"],
        'style-src': [...YANDEX_MAPS_HOSTS, 'https://yastatic.net'],
        'connect-src': [...YANDEX_MAPS_HOSTS, 'https://*.maps.yandex.net'],
        'img-src': ['data:', ...YANDEX_MAPS_HOSTS, 'https://*.maps.yandex.net', 'https://yastatic.net'],
        'worker-src': ['data:', ...YANDEX_MAPS_HOSTS, 'https://yastatic.net'],
    },
    recaptcha: {
        'script-src': ['https://www.google.com/recaptcha/', 'https://www.gstatic.com/recaptcha/'],
        'frame-src': ['https://www.google.com/recaptcha/', 'https://recaptcha.google.com/recaptcha/'],
    },
    yandexSmartCaptcha: {
        'script-src': ['https://smartcaptcha.yandexcloud.net'],
        'style-src': ["'unsafe-inline'"],
        'connect-src': ['https://smartcaptcha.yandexcloud.net'],
        'frame-src': ['https://smartcaptcha.yandexcloud.net'],
    },
    rollbar: {
        'connect-src': ['https://api.rollbar.com'],
    },
    youtube: {
        'frame-src': ['https://www.youtube.com', 'https://www.youtube-nocookie.com'],
    },
    rutube: {
        'frame-src': ['https://rutube.ru'],
    },
    unsafeInlineScripts: {
        'script-src': ["'unsafe-inline'", "'unsafe-eval'"],
    },
} as const satisfies Record<string, Sources>;

export type CspIntegration = keyof typeof CSP_INTEGRATIONS;

type CspHosts = {
    publicHost?: string;
    apiHost?: string;
    publicEnv?: string;
    integrations?: readonly CspIntegration[];
};

const toOrigin = (url?: string): string | undefined => {
    if (!url || !URL.canParse(url)) return undefined;

    return new URL(url).origin;
};

export const cspHash = (content: string) => `sha256-${createHash('sha256').update(content).digest('base64')}` as const;

/** `frame-ancestors` is ignored in `<meta>`, so it goes out as a header from the SSR middleware only. */
export const CSP_FRAME_ANCESTORS = "frame-ancestors 'self' https://awards.ratingruneta.ru";

function mergeSources(...all: Sources[]) {
    const merged: Partial<Record<Directive, string[]>> = {};

    for (const sources of all) {
        for (const [name, list] of Object.entries(sources) as Array<[Directive, Sources[Directive]]>) {
            merged[name] = [
                ...new Set(
                    ["'self'", ...(merged[name] ?? []), ...(list ?? [])].filter((source) => source !== undefined),
                ),
            ];
        }
    }

    return merged;
}

export function buildCspConfig({ publicHost, apiHost, publicEnv, integrations = [] }: CspHosts): CspConfig {
    const api = toOrigin(apiHost);
    const cdn = cdnCondition(publicEnv) ? toOrigin(CDN_DOMAIN) : undefined;
    const {
        'script-src': scriptSources = [],
        'style-src': styleSources = [],
        ...fetchSources
    } = mergeSources(
        {
            'script-src': [cdn],
            'style-src': [cdn],
            'img-src': ['data:', api, cdn],
            'media-src': [api, cdn],
            'font-src': [cdn],
            'connect-src': [api, cdn],
            'form-action': [api],
        },
        ...integrations.map((name) => CSP_INTEGRATIONS[name]),
    );

    return {
        directives: [
            "default-src 'self'",
            ...(Object.entries(fetchSources) as Array<[Exclude<Directive, 'script-src' | 'style-src'>, string[]]>).map(
                ([name, list]) => `${name} ${list.join(' ')}` as const,
            ),
            "object-src 'none'",
            "base-uri 'self'",
            ...(publicHost?.startsWith('https://') ? (['upgrade-insecure-requests'] as const) : []),
        ],
        scriptDirective: {
            resources: scriptSources,
        },
        styleDirective: {
            resources: [
                ...styleSources.map((resource) => ({ resource, kind: 'element' as const })),
                { resource: "'unsafe-inline'", kind: 'attribute' },
            ],
        },
    };
}
