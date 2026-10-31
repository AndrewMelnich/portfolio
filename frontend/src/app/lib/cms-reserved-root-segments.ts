/**
 * Первые сегменты URL, занятые статическими/динамическими роутами из `src/pages/`,
 * чтобы middleware CMS не перехватывал их (например `/news/` → не rewrite на `/page/news/`).
 * Список строится по файлам при сборке через import.meta.glob.
 */
const pagesModules = import.meta.glob(['../../pages/**/*.{astro,ts}', '!../../pages/**/_*', '!../../pages/**/_*/**']);

/** Маршруты Astro без файла в pages (оптимизация изображений, dev toolbar и т.п.). */
const ASTRO_INTERNAL_ROOT_SEGMENTS = ['_image', '_astro'] as const;

type NonEmpty<T> = [T, ...T[]];

function isNonEmpty<T>(items: T[]): items is NonEmpty<T> {
    return items.length > 0;
}

function firstRootSegmentFromPagesFile(relativePath: string): string | null {
    const segments = relativePath.split('/').filter(Boolean);

    if (!isNonEmpty(segments)) {
        return null;
    }

    // `src/pages/index.astro` → `/`, отдельного сегмента нет
    if (segments.length === 1 && segments[0] === 'index.astro') {
        return null;
    }

    const rawFirst = segments[0];
    const first = rawFirst.replace(/\.(astro|ts|tsx|jsx|md|mdx)$/, '');

    if (first.startsWith('[') || first.startsWith('_')) {
        return null;
    }

    return first;
}

function relativePathUnderPages(globKey: string): string | null {
    const normalized = globKey.replace(/\\/g, '/');
    const marker = 'pages/';
    const idx = normalized.lastIndexOf(marker);

    if (idx === -1) {
        return null;
    }

    return normalized.slice(idx + marker.length);
}

function buildReservedRootSlugSet(): Set<string> {
    const reserved = new Set<string>();

    for (const key of Object.keys(pagesModules)) {
        const rel = relativePathUnderPages(key);

        if (!rel) {
            continue;
        }

        const segment = firstRootSegmentFromPagesFile(rel);

        if (segment) {
            reserved.add(segment);
        }
    }

    for (const s of ASTRO_INTERNAL_ROOT_SEGMENTS) {
        reserved.add(s);
    }

    return reserved;
}

/** Сегменты первого уровня, занятые роутами из `src/pages` и встроенными путями Astro. */
export const RESERVED_ROOT_SLUGS = buildReservedRootSlugSet();
