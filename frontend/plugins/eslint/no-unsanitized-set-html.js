/**
 * Любой `set:html` в Astro должен идти через sanitizeHtml(...)
 * @fileoverview Снижает XSS при вставке HTML из строк, слотов и JSON-LD
 */

function isSanitizeHtmlCall(node) {
    return (
        node &&
        node.type === 'CallExpression' &&
        node.callee?.type === 'Identifier' &&
        node.callee.name === 'sanitizeHtml'
    );
}

export default {
    meta: {
        type: 'problem',
        docs: {
            description: 'require sanitizeHtml() for every Astro set:html directive',
            category: 'Security',
            recommended: true,
        },
        schema: [],
        messages: {
            unsafeSetHtml:
                'Небезопасная вставка HTML: используйте sanitizeHtml(...) в выражении set:html для снижения риска XSS.',
        },
    },

    create(context) {
        return {
            JSXOpeningElement(node) {
                for (const attr of node.attributes) {
                    if (attr.type !== 'JSXAttribute') {
                        continue;
                    }
                    const { name } = attr;

                    if (
                        name?.type !== 'JSXNamespacedName' ||
                        name.namespace?.name !== 'set' ||
                        name.name?.name !== 'html'
                    ) {
                        continue;
                    }

                    const expr = attr.value?.type === 'JSXExpressionContainer' ? attr.value.expression : null;

                    if (!isSanitizeHtmlCall(expr)) {
                        context.report({
                            node: attr,
                            messageId: 'unsafeSetHtml',
                        });
                    }
                }
            },
        };
    },
};
