import { buildCspConfig, CSP_INTEGRATIONS, cspHash, type CspIntegration } from './csp';

const directive = (config: ReturnType<typeof buildCspConfig>, name: string) =>
    config.directives?.find((value) => value.startsWith(`${name} `) || value === name);

describe('buildCspConfig', () => {
    it('allows the CMS origin for images, media, fetch and forms', () => {
        const config = buildCspConfig({ publicHost: 'https://site.ru', apiHost: 'https://cms.site.ru/api/' });

        for (const name of ['img-src', 'media-src', 'connect-src', 'form-action']) {
            expect(directive(config, name)).toContain('https://cms.site.ru');
        }
        expect(directive(config, 'img-src')).not.toContain('/api');
    });

    it('upgrades insecure requests only for an https site', () => {
        expect(directive(buildCspConfig({ publicHost: 'https://site.ru' }), 'upgrade-insecure-requests')).toBeDefined();
        expect(
            directive(buildCspConfig({ publicHost: 'http://127.0.0.1:4327' }), 'upgrade-insecure-requests'),
        ).toBeUndefined();
    });

    it('skips an API host that is not a URL', () => {
        expect(directive(buildCspConfig({ apiHost: '' }), 'connect-src')).toBe("connect-src 'self'");
    });
});

describe('buildCspConfig integrations', () => {
    const scriptSources = (config: ReturnType<typeof buildCspConfig>) => config.scriptDirective?.resources ?? [];
    const styleSources = (config: ReturnType<typeof buildCspConfig>) =>
        (config.styleDirective?.resources ?? []).map((entry) => (typeof entry === 'string' ? entry : entry.resource));

    it('opens no third-party host until an integration is enabled', () => {
        const config = buildCspConfig({ publicHost: 'https://site.ru' });

        expect(scriptSources(config)).toEqual(["'self'"]);
        expect(config.directives?.join(';')).not.toMatch(/yandex|google|calltouch|mail\.ru/);
        expect(directive(config, 'frame-src')).toBeUndefined();
        expect(directive(config, 'worker-src')).toBeUndefined();
    });

    it.each(Object.keys(CSP_INTEGRATIONS) as CspIntegration[])('allows every %s source in its directive', (name) => {
        const config = buildCspConfig({ integrations: [name] });

        for (const [directiveName, sources] of Object.entries(CSP_INTEGRATIONS[name])) {
            const allowed =
                { 'script-src': scriptSources(config), 'style-src': styleSources(config) }[directiveName] ??
                directive(config, directiveName)?.split(' ');

            expect(allowed).toEqual(expect.arrayContaining([...sources]));
        }
    });

    it('keeps the hosts of one integration out of a project that enables another', () => {
        const config = buildCspConfig({ integrations: ['yandexMetrica'] });

        expect(scriptSources(config)).toContain('https://mc.yandex.ru');
        expect(scriptSources(config)).not.toContain('https://www.googletagmanager.com');
        expect(directive(config, 'connect-src')).not.toContain('google');
    });

    it('lists a host once when two integrations share it', () => {
        const config = buildCspConfig({ integrations: ['gtm', 'googleAnalytics'] });

        expect(scriptSources(config).filter((source) => source === 'https://www.googletagmanager.com')).toHaveLength(1);
    });

    it('lets the bundled Rollbar client report errors without opening a script host', () => {
        const config = buildCspConfig({ integrations: ['rollbar'] });

        expect(scriptSources(config)).toEqual(["'self'"]);
        expect(directive(config, 'connect-src')).toContain('https://api.rollbar.com');
    });

    it('allows inline scripts and eval only through unsafeInlineScripts', () => {
        const strict = buildCspConfig({ integrations: ['gtm', 'googleAnalytics'] });
        const relaxed = buildCspConfig({ integrations: ['gtm', 'unsafeInlineScripts'] });

        expect(scriptSources(strict)).not.toContain("'unsafe-inline'");
        expect(scriptSources(relaxed)).toEqual(expect.arrayContaining(["'unsafe-inline'", "'unsafe-eval'"]));
    });
});

describe('cspHash', () => {
    it('formats a base64 sha256 source for the CSP header', () => {
        expect(cspHash('')).toBe('sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=');
    });
});
