/**
 * ESLint правило для проверки использования querySelector/querySelectorAll с классами без префикса 'js-'
 * @fileoverview Требует использовать префикс 'js-' для классов в querySelector, querySelectorAll и closest
 */

const DOM_QUERY_METHODS = new Set(['querySelector', 'querySelectorAll', 'closest']);

function findVariable(scope, name) {
    let current = scope;

    while (current) {
        const variable = current.variables.find((item) => item.name === name);

        if (variable) {
            return variable;
        }

        current = current.upper;
    }

    return null;
}

function getStaticString(node, context, seen = new Set()) {
    if (!node || seen.has(node)) {
        return null;
    }

    seen.add(node);

    if (node.type === 'Literal' && typeof node.value === 'string') {
        return node.value;
    }

    if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
        return node.quasis[0].value.cooked;
    }

    if (node.type !== 'Identifier') {
        return null;
    }

    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const variable = findVariable(sourceCode.getScope(node), node.name);

    if (!variable || variable.defs.length !== 1) {
        return null;
    }

    const def = variable.defs[0];

    if (def.type !== 'Variable' || def.parent?.kind !== 'const' || !def.node.init) {
        return null;
    }

    return getStaticString(def.node.init, context, seen);
}

export default {
    meta: {
        type: 'problem',
        docs: {
            description: 'require js- prefix for class selectors in querySelector, querySelectorAll and closest',
            category: 'Best Practices',
            recommended: true,
        },
        fixable: null,
        schema: [],
        messages: {
            missingJsPrefix:
                'Селектор класса "{{ selector }}" должен иметь префикс "js-". Используйте ".js-{{ className }}" вместо ".{{ className }}"',
        },
    },

    create(context) {
        /**
         * Проверяет строку селектора на наличие классов без префикса js-
         */
        function checkSelector(selectorString, node) {
            // Регулярное выражение для поиска селекторов классов
            const classSelectors = selectorString.match(/\.([a-zA-Z][\w-]*)/g);

            if (!classSelectors) return;

            classSelectors.forEach((selector) => {
                const className = selector.slice(1); // Убираем точку

                // Проверяем, что класс не начинается с js-
                if (!className.startsWith('js-')) {
                    context.report({
                        node,
                        messageId: 'missingJsPrefix',
                        data: {
                            selector,
                            className,
                        },
                    });
                }
            });
        }

        /**
         * Проверяет аргументы вызова функции
         */
        function checkCallExpression(node) {
            const { callee, arguments: args } = node;
            const isDirectCall = callee.type === 'Identifier' && DOM_QUERY_METHODS.has(callee.name);
            const isMemberCall =
                callee.type === 'MemberExpression' &&
                callee.property.type === 'Identifier' &&
                DOM_QUERY_METHODS.has(callee.property.name);

            if (!isDirectCall && !isMemberCall) {
                return;
            }

            const selector = getStaticString(args[0], context);

            if (selector) {
                checkSelector(selector, node);
            }
        }

        return {
            CallExpression: checkCallExpression,
        };
    },
};
