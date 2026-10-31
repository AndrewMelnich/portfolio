const compareNames = (a, b) => a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true, caseFirst: 'lower' });

const kindRank = (specifier) => (specifier.importKind === 'type' ? 1 : 0);

const bySpecifierOrder = (a, b) => kindRank(a) - kindRank(b) || compareNames(a.local.name, b.local.name);

export default {
    meta: {
        type: 'layout',
        fixable: 'code',
        schema: [],
        messages: {
            unsorted: 'Named imports go values first, then `type`, each by name.',
        },
    },
    create(context) {
        const { sourceCode } = context;

        return {
            ImportDeclaration(node) {
                const named = node.specifiers.filter((specifier) => specifier.type === 'ImportSpecifier');
                const sorted = named.toSorted(bySpecifierOrder);

                if (sorted.every((specifier, index) => specifier === named[index])) {
                    return;
                }

                const hasComments = sourceCode.getCommentsInside(node).length > 0;

                context.report({
                    node,
                    messageId: 'unsorted',
                    fix: hasComments
                        ? null
                        : (fixer) =>
                              named.map((specifier, index) =>
                                  fixer.replaceText(specifier, sourceCode.getText(sorted[index])),
                              ),
                });
            },
        };
    },
};
