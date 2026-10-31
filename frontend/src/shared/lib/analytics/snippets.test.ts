import { Script } from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
    calltouchSnippet,
    googleAnalyticsSnippet,
    googleTagManagerSnippet,
    requireCspIntegration,
    vkPixelSnippet,
    yandexMetrikaSnippet,
} from './snippets';

const snippets = {
    yandexMetrika: yandexMetrikaSnippet(12345678),
    googleTagManager: googleTagManagerSnippet('GTM-TEST'),
    googleAnalytics: googleAnalyticsSnippet('G-TEST'),
    vkPixel: vkPixelSnippet('3000000'),
    calltouch: calltouchSnippet('abc123'),
};

describe('requireCspIntegration', () => {
    it('passes when the integration is enabled', () => {
        expect(() => requireCspIntegration('gtm', 'GoogleTagManager', ['gtm'])).not.toThrow();
    });

    it('throws with the component and integration names when it is not', () => {
        expect(() => requireCspIntegration('gtm', 'GoogleTagManager', ['yandexMetrica'])).toThrow(
            "<GoogleTagManager /> needs 'gtm' in CSP_ENABLED_INTEGRATIONS",
        );
    });
});

describe('analytics snippets', () => {
    it.each(Object.entries(snippets))('%s is valid JavaScript', (_, code) => {
        // eslint-disable-next-line sonarjs/code-eval -- compiles the snippet without running it
        expect(() => new Script(code)).not.toThrow();
    });

    it.each(Object.entries(snippets))('%s waits for a prerendered page to be shown', (_, code) => {
        expect(code).toContain("document.addEventListener('prerenderingchange',run,{once:true})");
    });

    it('quotes ids so they cannot break out of the string', () => {
        expect(googleTagManagerSnippet("x');alert(1);//")).toContain(`"x');alert(1);//"`);
    });

    it('enables the usual Metrica options by default', () => {
        expect(snippets.yandexMetrika).toContain(
            `ym(12345678,'init',{"ssr":true,"webvisor":true,"clickmap":true,"accurateTrackBounce":true,"trackLinks":true});`,
        );
    });

    it('turns Metrica options off and sets the ecommerce container', () => {
        const code = yandexMetrikaSnippet(1, { webvisor: false, ecommerce: 'dataLayer' });

        expect(code).toContain('"webvisor":false');
        expect(code).toContain('"ecommerce":"dataLayer"');
    });
});
