import { type Page } from '@playwright/test';
import { expect, testAllPages } from '../utils';

const getOpenGraphImages = async (page: Page): Promise<string[]> => {
    return await page.evaluate(() => {
        const metaElements = document.querySelectorAll('meta[property="og:image"]');
        const images: string[] = [];

        metaElements.forEach((meta) => {
            const content = meta.getAttribute('content');

            if (content) {
                images.push(content);
            }
        });

        return images;
    });
};

const checkImageStatus = async (
    page: Page,
    imageUrl: string,
): Promise<{ url: string; status: number; error?: string }> => {
    try {
        const response = await page.request.get(imageUrl);

        return { url: imageUrl, status: response.status() };
    } catch (error) {
        return { url: imageUrl, status: 0, error: error instanceof Error ? error.message : 'Unknown error' };
    }
};

testAllPages('OpenGraph Images Status', async (page, url) => {
    const ogImages = await getOpenGraphImages(page);

    expect(
        ogImages.length,
        `На странице ${url} отсутствуют OpenGraph изображения (meta property="og:image")`,
    ).toBeGreaterThan(0);

    const imageStatuses = await Promise.all(ogImages.map((imageUrl) => checkImageStatus(page, imageUrl)));

    const failedImages = imageStatuses.filter((img) => img.status !== 200);

    if (failedImages.length > 0) {
        const errorDetails = failedImages
            .map((img) => `URL: ${img.url}, Status: ${img.status}${img.error ? `, Error: ${img.error}` : ''}`)
            .join('\n');

        expect(
            failedImages.length,
            `OpenGraph изображения на странице ${url} не возвращают статус 200:\n${errorDetails}`,
        ).toBe(0);
    }
});
