import { moveCspMetaFirst } from './csp-meta-first';

const META = `<meta http-equiv="content-security-policy" content="script-src 'self' 'sha256-a'">`;

describe('moveCspMetaFirst', () => {
    it('moves the policy above every script in head, right after the charset', () => {
        const html = `<html><head><meta charset="utf-8"><script>evil()</script><title>t</title>${META}</head><body></body></html>`;

        expect(moveCspMetaFirst(html)).toBe(
            `<html><head><meta charset="utf-8">${META}<script>evil()</script><title>t</title></head><body></body></html>`,
        );
    });

    it('opens head with the policy when there is no charset meta', () => {
        expect(moveCspMetaFirst(`<head lang="ru"><script></script>${META}</head>`)).toBe(
            `<head lang="ru">${META}<script></script></head>`,
        );
    });

    it('leaves a page without a policy untouched', () => {
        const html = '<html><head><meta charset="utf-8"></head></html>';

        expect(moveCspMetaFirst(html)).toBe(html);
    });
});
