import fs from 'node:fs';
import path from 'node:path';

function exists(p) {
    return fs.existsSync(p);
}

function readPkg(dir) {
    const file = path.join(dir, 'package.json');
    if (!exists(file)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return null;
    }
}

function depsInclude(pkg, names) {
    if (!pkg) {
        return false;
    }
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    return names.some((n) => Object.prototype.hasOwnProperty.call(all, n));
}

export function detectArchetype(repoRoot) {
    const bitrixFe = path.join(repoRoot, 'local/templates/main/frontend');
    if (exists(bitrixFe) && exists(path.join(bitrixFe, 'package.json'))) {
        return { id: 'bitrix', app: 'local/templates/main/frontend' };
    }

    const rootPkg = readPkg(repoRoot);
    const frontendDir = path.join(repoRoot, 'frontend');
    const frontendPkg = readPkg(frontendDir);

    if (frontendPkg) {
        if (depsInclude(frontendPkg, ['astro'])) {
            return { id: 'astro', app: 'frontend' };
        }
        if (depsInclude(frontendPkg, ['next'])) {
            return { id: 'next-monorepo', app: 'frontend' };
        }
        if (depsInclude(frontendPkg, ['vue', 'nuxt'])) {
            return { id: 'vue-vite', app: 'frontend' };
        }
        if (depsInclude(frontendPkg, ['vite'])) {
            return { id: 'vue-vite', app: 'frontend' };
        }
        return { id: 'next-monorepo', app: 'frontend' };
    }

    if (rootPkg && depsInclude(rootPkg, ['vite']) && !exists(frontendDir)) {
        return { id: 'vite-root', app: '.' };
    }

    if (rootPkg && depsInclude(rootPkg, ['next'])) {
        return { id: 'next-monorepo', app: '.' };
    }

    return { id: 'unknown', app: null };
}
