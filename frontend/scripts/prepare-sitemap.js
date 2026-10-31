import fs from 'fs';
import path from 'path';

const candidates = [
    [
        path.join(import.meta.dirname, '../build/sitemap-index.xml'),
        path.join(import.meta.dirname, '../build/sitemap.xml'),
    ],
    [
        path.join(import.meta.dirname, '../build/client/sitemap-index.xml'),
        path.join(import.meta.dirname, '../build/client/sitemap.xml'),
    ],
];

for (const [from, to] of candidates) {
    if (fs.existsSync(from)) {
        fs.renameSync(from, to);
        break;
    }
}
