import { expect, test } from '@playwright/test';
import { collectErrors, openRoute } from './app';

const ROUTES = ['/'];
const LOCALES = [''];

for (const locale of LOCALES) {
    for (const route of ROUTES) {
        const path = `${locale}${route}`;

        test(`${path} renders without errors`, async ({ page }) => {
            const errors = collectErrors(page);
            const response = await openRoute(page, path);

            expect(response?.status()).toBe(200);
            await page.waitForLoadState('networkidle');
            expect(errors).toEqual([]);
        });
    }
}
