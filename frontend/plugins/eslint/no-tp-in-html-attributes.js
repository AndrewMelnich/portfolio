/**
 * `tp()` меняет строку (nbsp, кавычки, `<br/>`) — в HTML-атрибутах ломает a11y и парсинг.
 * @fileoverview Запрет tp() в aria-*, alt, title, placeholder
 */

const ALWAYS_ATTRS = new Set(['alt']);
const INTRINSIC_ATTRS = new Set(['title', 'placeholder']);

function getAttrName(attr) {
    const { name } = attr;

    if (name?.type === 'JSXIdentifier') {
        return name.name;
    }

    if (name?.type === 'JSXNamespacedName') {
        return `${name.namespace.name}:${name.name.name}`;
    }

    return null;
}

function getTagName(node) {
    const { name } = node;

    if (name?.type === 'JSXIdentifier') {
        return name.name;
    }

    return null;
}

function isHtmlAttribute(tagName, attrName) {
    if (!attrName) {
        return false;
    }

    if (attrName.startsWith('aria-') || ALWAYS_ATTRS.has(attrName)) {
        return true;
    }

    return Boolean(tagName && tagName === tagName.toLowerCase() && INTRINSIC_ATTRS.has(attrName));
}

function containsTpCall(node) {
    if (!node || typeof node !== 'object') {
        return false;
    }

    if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'tp') {
        return true;
    }

    for (const [key, value] of Object.entries(node)) {
        if (key === 'parent' || key === 'tokens' || key === 'comments') {
            continue;
        }

        if (Array.isArray(value)) {
            if (value.some(containsTpCall)) {
                return true;
            }
        } else if (value && typeof value === 'object' && typeof value.type === 'string') {
            if (containsTpCall(value)) {
                return true;
            }
        }
    }

    return false;
}

export default {
    meta: {
        type: 'problem',
        docs: {
            description: 'disallow tp() in HTML attributes (aria-*, alt, title, placeholder)',
            category: 'Best Practices',
            recommended: true,
        },
        schema: [],
        messages: {
            tpInHtmlAttribute:
                'Не используй tp() в HTML-атрибуте "{{name}}". Обычная строка; tp() — только для видимого текста.',
        },
    },

    create(context) {
        return {
            JSXAttribute(node) {
                const attrName = getAttrName(node);
                const tagName = getTagName(node.parent);

                if (!isHtmlAttribute(tagName, attrName)) {
                    return;
                }

                const value = node.value;

                if (value?.type !== 'JSXExpressionContainer') {
                    return;
                }

                if (containsTpCall(value.expression)) {
                    context.report({
                        node: node.name ?? node,
                        messageId: 'tpInHtmlAttribute',
                        data: { name: attrName },
                    });
                }
            },
        };
    },
};
