import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as sass from 'sass-embedded';
import { normalizePath, type ModuleNode, type Plugin } from 'vite';
import { STORYBOOK_ASTRO_SCSS_HMR_MARK } from './astro-scss-constants.ts';

const STYLE_BLOCK = /<style([^>]*)>([\s\S]*?)<\/style>/g;
const STUB_MARK = 'Astro components are rendered server-side by Storybook.';
const SCSS_VIRTUAL_PREFIX = `\0${STORYBOOK_ASTRO_SCSS_HMR_MARK}:`;

const virtualScssId = (astroPath: string, index: number) => `${SCSS_VIRTUAL_PREFIX}${astroPath}:${index}.css`;

const parseVirtualScssId = (id: string): { astroPath: string; index: number } | null => {
    if (!id.startsWith(SCSS_VIRTUAL_PREFIX) || !id.endsWith('.css')) {
        return null;
    }

    const rest = id.slice(SCSS_VIRTUAL_PREFIX.length, -'.css'.length);
    const lastColon = rest.lastIndexOf(':');
    const index = Number(rest.slice(lastColon + 1));

    if (lastColon === -1 || Number.isNaN(index)) {
        return null;
    }

    return { astroPath: rest.slice(0, lastColon), index };
};

const extractScssBlocks = (source: string): string[] => {
    const blocks: string[] = [];

    for (const match of source.matchAll(STYLE_BLOCK)) {
        const lang = match[1].match(/lang=["']([^"']+)["']/)?.[1];

        if (lang === 'scss') {
            blocks.push(match[2].trim());
        }
    }

    return blocks;
};

const extractFrontmatter = (source: string): string => {
    const match = source.match(/^---([\s\S]*?)---/m);

    if (!match) {
        return '';
    }

    return match[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
};

const namedImportsFrom = (frontmatter: string, specifier: string): string[] => {
    const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = frontmatter.match(new RegExp(`import\\s+\\{([^}]+)\\}\\s+from\\s+['"]${escaped}['"]`));

    if (!match) {
        return [];
    }

    return match[1]
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part && !part.startsWith('type '))
        .map((part) => part.split(/\s+as\s+/).at(-1) ?? '')
        .filter(Boolean);
};

const resolveToAbs = (specifier: string, fromFile: string, srcDir: string): string | null => {
    if (specifier.startsWith('@/')) {
        return path.join(srcDir, specifier.slice(2));
    }

    if (specifier.startsWith('.')) {
        return path.resolve(path.dirname(fromFile), specifier);
    }

    return null;
};

const astroInDir = (dir: string, name?: string): string | null => {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
        return null;
    }

    const candidates = name
        ? [path.join(dir, `${name}.astro`), path.join(dir, 'ui', name, `${name}.astro`)]
        : [path.join(dir, `${path.basename(dir)}.astro`)];

    return candidates.find((file) => existsSync(file)) ?? null;
};

const childAstroFiles = (fromFile: string, srcDir: string): string[] => {
    const frontmatter = extractFrontmatter(readFileSync(fromFile, 'utf8'));
    const specifiers = new Set<string>();
    const importRe = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;

    while ((match = importRe.exec(frontmatter))) {
        specifiers.add(match[1]);
    }

    const files = new Set<string>();

    for (const specifier of specifiers) {
        if (specifier.endsWith('.astro')) {
            const abs = resolveToAbs(specifier, fromFile, srcDir);

            if (abs && existsSync(abs)) {
                files.add(abs);
            }

            continue;
        }

        const abs = resolveToAbs(specifier, fromFile, srcDir);

        if (!abs) {
            continue;
        }

        if (abs.endsWith('.astro') && existsSync(abs)) {
            files.add(abs);
            continue;
        }

        const defaultAstro = astroInDir(abs);

        if (defaultAstro) {
            files.add(defaultAstro);
        }

        for (const name of namedImportsFrom(frontmatter, specifier)) {
            const namedAstro = astroInDir(abs, name);

            if (namedAstro) {
                files.add(namedAstro);
            }
        }
    }

    files.delete(fromFile);

    return [...files];
};

const compileAstroScssBlock = (
    pluginContext: { addWatchFile: (file: string) => void },
    srcDir: string,
    astroPath: string,
    index: number,
): string => {
    const source = readFileSync(astroPath, 'utf8');
    const scss = extractScssBlocks(source)[index];

    if (!scss) {
        return '';
    }

    pluginContext.addWatchFile(astroPath);

    const result = sass.compileString(scss, {
        loadPaths: [srcDir, path.dirname(astroPath)],
        url: pathToFileURL(astroPath),
    });

    for (const loadedUrl of result.loadedUrls) {
        if (loadedUrl.protocol === 'file:') {
            pluginContext.addWatchFile(fileURLToPath(loadedUrl));
        }
    }

    return result.css;
};

export const storybookAstroScssPlugin = (srcDir: string): Plugin => ({
    name: 'storybook-astro-scss',
    enforce: 'post',
    resolveId(id) {
        if (id.startsWith(SCSS_VIRTUAL_PREFIX)) {
            return id;
        }

        return undefined;
    },
    load(id) {
        const parsed = parseVirtualScssId(id);

        if (!parsed) {
            return undefined;
        }

        return {
            code: compileAstroScssBlock(this, srcDir, parsed.astroPath, parsed.index),
            moduleType: 'css',
        };
    },
    async transform(code, id) {
        const filePath = id.split('?')[0];

        if (!filePath.endsWith('.astro') || !code.includes(STUB_MARK)) {
            return null;
        }

        this.addWatchFile(filePath);

        const source = readFileSync(filePath, 'utf8');
        const scssBlocks = extractScssBlocks(source);
        const styleImports = scssBlocks
            .map((_, index) => `import ${JSON.stringify(virtualScssId(filePath, index))};`)
            .join('\n');
        const childImports = childAstroFiles(filePath, srcDir).map((file) => `import ${JSON.stringify(file)};`);

        if (!styleImports && !childImports.length) {
            return null;
        }

        return {
            code: `${styleImports}\n${childImports.join('\n')}\n${code}`,
            map: null,
        };
    },
    handleHotUpdate({ file, server }) {
        const normalizedFile = normalizePath(file);

        if (!/\.(astro|scss|sass)$/.test(normalizedFile)) {
            return undefined;
        }

        const affected = new Set<ModuleNode>();

        for (const mod of server.moduleGraph.getModulesByFile(normalizedFile) ?? []) {
            if (mod.id?.startsWith(SCSS_VIRTUAL_PREFIX)) {
                affected.add(mod);
            }
        }

        for (const mod of server.moduleGraph.idToModuleMap.values()) {
            const modId = mod.id;

            if (!modId?.startsWith(SCSS_VIRTUAL_PREFIX)) {
                continue;
            }

            const parsed = parseVirtualScssId(modId);

            if (parsed && normalizePath(parsed.astroPath) === normalizedFile) {
                affected.add(mod);
            }
        }

        if (affected.size === 0) {
            return undefined;
        }

        for (const mod of affected) {
            server.moduleGraph.invalidateModule(mod);
        }

        return [...affected];
    },
});
