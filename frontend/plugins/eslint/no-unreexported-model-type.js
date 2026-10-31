/**
 * Model / *.interface.ts: type export that the sibling barrel does not re-export
 * is dead for FSD public API (import/no-internal-modules). Inline or drop export.
 * @fileoverview export type only if index.ts re-exports it
 */

import fs from 'node:fs';
import path from 'node:path';

function collectReexportedNames(indexPath, sourceFileName) {
    if (!fs.existsSync(indexPath)) {
        return null;
    }

    const source = fs.readFileSync(indexPath, 'utf8');
    const names = new Set();
    // export type { A, B as C } from './product.interface'
    // export { type A, type B as C } from './foo'
    const fromRe = /export\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]\.\/([^'"]+)['"]/g;
    let match;

    const targetBase = path.basename(sourceFileName).replace(/\.ts$/, '');

    while ((match = fromRe.exec(source)) !== null) {
        const fromBase = path.basename(match[2]).replace(/\.ts$/, '');

        if (fromBase !== targetBase) {
            continue;
        }

        for (const part of match[1].split(',')) {
            const trimmed = part.trim();

            if (!trimmed) {
                continue;
            }

            // type Foo as Bar | Foo as Bar | Foo
            const withoutType = trimmed.replace(/^type\s+/, '');
            const local = withoutType.split(/\s+as\s+/)[0].trim();

            if (local) {
                names.add(local);
            }
        }
    }

    return names;
}

export default {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Do not export model types that the barrel index does not re-export',
            recommended: true,
        },
        schema: [],
        messages: {
            unreexported:
                'Agent: `export type {{name}}` не реэкспортится из `{{barrel}}`. По fsd.mdc — без внешнего импорта не экспортируй: inline или убери `export`.',
        },
    },

    create(context) {
        const filename = context.filename ?? context.getFilename();

        if (!filename || filename === '<input>') {
            return {};
        }

        const normalized = filename.replaceAll('\\', '/');
        const isInterface = normalized.endsWith('.interface.ts');
        const inModel = normalized.includes('/model/');

        if (!isInterface && !inModel) {
            return {};
        }

        if (normalized.endsWith('/index.ts') || normalized.endsWith('/index.js')) {
            return {};
        }

        const dir = path.dirname(filename);
        const base = path.basename(filename);
        const barrelPath = path.join(dir, 'index.ts');
        const reexported = collectReexportedNames(barrelPath, base);

        if (reexported === null) {
            return {};
        }

        // Empty barrel re-exports from this file → every export is suspicious only if barrel exists
        // and lists other files; if barrel doesn't mention this file at all, skip (different pattern)
        const barrelSource = fs.readFileSync(barrelPath, 'utf8');
        const mentionsThisFile =
            barrelSource.includes(`./${base.replace(/\.ts$/, '')}`) || barrelSource.includes(`./${base}`);

        if (!mentionsThisFile) {
            return {};
        }

        return {
            ExportNamedDeclaration(node) {
                if (node.declaration?.type === 'TSTypeAliasDeclaration') {
                    const name = node.declaration.id.name;

                    if (!reexported.has(name)) {
                        context.report({
                            node: node.declaration.id,
                            messageId: 'unreexported',
                            data: { name, barrel: path.relative(dir, barrelPath) || 'index.ts' },
                        });
                    }

                    return;
                }

                if (node.declaration?.type === 'TSInterfaceDeclaration') {
                    const name = node.declaration.id.name;

                    if (!reexported.has(name)) {
                        context.report({
                            node: node.declaration.id,
                            messageId: 'unreexported',
                            data: { name, barrel: path.relative(dir, barrelPath) || 'index.ts' },
                        });
                    }

                    return;
                }

                for (const spec of node.specifiers ?? []) {
                    if (spec.exportKind === 'type' || node.exportKind === 'type' || spec.type === 'ExportSpecifier') {
                        const name = spec.local.name;

                        if (!reexported.has(name)) {
                            context.report({
                                node: spec,
                                messageId: 'unreexported',
                                data: { name, barrel: 'index.ts' },
                            });
                        }
                    }
                }
            },
        };
    },
};
