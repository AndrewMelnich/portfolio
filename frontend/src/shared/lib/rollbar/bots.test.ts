import { describe, expect, it } from 'vitest';
import { isBotUserAgent } from './bots';

describe('isBotUserAgent', () => {
    it.each([
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/140.0.0.0 Safari/537.36',
    ])('treats %s as a bot', (userAgent) => {
        expect(isBotUserAgent(userAgent)).toBe(true);
    });

    it.each([
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
        undefined,
    ])('treats %s as a visitor', (userAgent) => {
        expect(isBotUserAgent(userAgent)).toBe(false);
    });
});
