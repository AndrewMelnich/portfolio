import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcSvg = join(root, 'public/static/img/favicon.svg');
const outDir = join(root, 'public/static/img');

const prepareSvg = (svg) =>
    svg
        .replace(/<style>[\s\S]*?<\/style>/, '')
        .replace(/<rect[^/]*\/>/, '')
        .replace(/\sfill="[^"]*"/g, '')
        .replace(/<path /g, '<path fill="#000000" ');

const writePng = async (name, size, { padRatio = 0 } = {}) => {
    const svg = prepareSvg(await readFile(srcSvg, 'utf8'));
    const logoSize = Math.round(size * (1 - padRatio * 2));
    const offset = Math.round((size - logoSize) / 2);

    const logo = await sharp(Buffer.from(svg)).resize(logoSize, logoSize, { fit: 'contain' }).png().toBuffer();

    await sharp({
        create: {
            width: size,
            height: size,
            channels: 3,
            background: '#ffffff',
        },
    })
        .composite([{ input: logo, left: offset, top: offset }])
        .png()
        .toFile(join(outDir, name));

    console.log(`wrote ${name} (${size}x${size})`);
};

await mkdir(outDir, { recursive: true });

await writeFile(join(outDir, 'favicon.svg'), await readFile(srcSvg));

await writePng('icon-192.png', 192);
await writePng('icon-512.png', 512);
const MASKABLE_SAFE_ZONE_PAD_RATIO = 0.1;
await writePng('icon-maskable-512.png', 512, { padRatio: MASKABLE_SAFE_ZONE_PAD_RATIO });
await writePng('apple-touch-icon.png', 180);

console.log('PWA icons ready in public/static/img/');
