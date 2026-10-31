/**
 * App* type aliases must not reference `components` / `operations` from generated OpenAPI.
 * Api* aliases in the same types.ts may still use generated types.
 * @fileoverview App* без components['schemas'] в api types.ts
 */

const GENERATED_TYPE_REFS = new Set(['components', 'operations']);

function typeUsesGeneratedRef(node) {
    if (!node) {
        return false;
    }

    switch (node.type) {
        case 'TSTypeReference':
            if (node.typeName?.type === 'Identifier' && GENERATED_TYPE_REFS.has(node.typeName.name)) {
                return true;
            }

            return node.typeParameters?.params?.some(typeUsesGeneratedRef) ?? false;

        case 'TSIndexedAccessType':
            return typeUsesGeneratedRef(node.objectType) || typeUsesGeneratedRef(node.indexType);

        case 'TSUnionType':

        case 'TSIntersectionType':
            return node.types?.some(typeUsesGeneratedRef) ?? false;

        case 'TSTypeLiteral':
            return node.members?.some((member) => typeUsesGeneratedRef(member.typeAnnotation)) ?? false;

        case 'TSArrayType':
            return typeUsesGeneratedRef(node.elementType);

        case 'TSTypeOperator':
            return typeUsesGeneratedRef(node.typeAnnotation);

        case 'TSConditionalType':
            return (
                typeUsesGeneratedRef(node.checkType) ||
                typeUsesGeneratedRef(node.extendsType) ||
                typeUsesGeneratedRef(node.trueType) ||
                typeUsesGeneratedRef(node.falseType)
            );

        case 'TSParenthesizedType':
            return typeUsesGeneratedRef(node.typeAnnotation);

        case 'TSRestType':

        case 'TSOptionalType':
            return typeUsesGeneratedRef(node.typeAnnotation);

        case 'TSMappedType':
            return typeUsesGeneratedRef(node.typeAnnotation);

        case 'TSTypeQuery':
            return node.exprName?.type === 'Identifier' && GENERATED_TYPE_REFS.has(node.exprName.name);

        default:
            return false;
    }
}

export default {
    meta: {
        type: 'problem',
        docs: {
            description: 'App* type aliases must not reference generated OpenAPI types',
            category: 'Best Practices',
            recommended: true,
        },
        schema: [],
        messages: {
            appTypeFromGenerated:
                'App* не ссылается на components/operations. Домен — model/ или shared/model; generated только в Api*.',
        },
    },

    create(context) {
        return {
            TSTypeAliasDeclaration(node) {
                if (!/^App/.test(node.id.name)) {
                    return;
                }

                if (typeUsesGeneratedRef(node.typeAnnotation)) {
                    context.report({
                        node: node.id,
                        messageId: 'appTypeFromGenerated',
                    });
                }
            },
        };
    },
};
