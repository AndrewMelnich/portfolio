/**
 * Локальный `{ src, alt }` (и ImageShape-поля) дублирует `@/shared/model/types`.
 * @fileoverview Требует ImageShape вместо локального { src, alt }
 */

const IMAGE_SHAPE_KEYS = new Set(['src', 'width', 'height', 'alt', 'title']);

function isCanonicalImageShapeFile(filename) {
    const normalized = filename.replaceAll('\\', '/');

    return normalized.endsWith('shared/model/types.ts') || normalized.includes('/generated/');
}

function getMemberName(member) {
    if (member.type !== 'TSPropertySignature' || !member.key) {
        return null;
    }

    if (member.key.type === 'Identifier') {
        return member.key.name;
    }

    if (member.key.type === 'Literal') {
        return String(member.key.value);
    }

    return null;
}

function isImageShapeDuplicate(members) {
    if (!members?.length) {
        return false;
    }

    const keys = [];

    for (const member of members) {
        const name = getMemberName(member);

        if (!name || !IMAGE_SHAPE_KEYS.has(name)) {
            return false;
        }

        keys.push(name);
    }

    return keys.includes('src') && keys.includes('alt');
}

export default {
    meta: {
        type: 'problem',
        docs: {
            description: 'require ImageShape instead of a local { src, alt } media type',
            category: 'Best Practices',
            recommended: true,
        },
        schema: [],
        messages: {
            preferImageShape: 'Локальный { src, alt } → ImageShape из @/shared/model/types.',
        },
    },

    create(context) {
        if (isCanonicalImageShapeFile(context.filename)) {
            return {};
        }

        function checkMembers(members, node) {
            if (isImageShapeDuplicate(members)) {
                context.report({
                    node,
                    messageId: 'preferImageShape',
                });
            }
        }

        return {
            TSTypeLiteral(node) {
                checkMembers(node.members, node);
            },
            TSInterfaceDeclaration(node) {
                checkMembers(node.body.body, node.id ?? node);
            },
        };
    },
};
