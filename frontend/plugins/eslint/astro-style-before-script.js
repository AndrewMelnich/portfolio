/**
 * В `.astro` после разметки: сначала `<style>`, затем `<script>`.
 * @fileoverview Порядок блоков в шаблоне Astro
 */

function getJsxElementName(node) {
    const name = node.openingElement?.name;

    if (name?.type === 'JSXIdentifier') {
        return name.name;
    }

    return null;
}

export default {
    meta: {
        type: 'layout',
        docs: {
            description: 'require <style> before <script> in Astro templates',
            category: 'Best Practices',
            recommended: true,
        },
        schema: [],
        messages: {
            styleAfterScript:
                'В `.astro` сначала `<style>`, затем `<script>`. Перенеси `<style>` выше всех `<script>`.',
        },
    },

    create(context) {
        return {
            AstroFragment(node) {
                let seenScript = false;

                for (const child of node.children ?? []) {
                    if (child.type !== 'JSXElement') {
                        continue;
                    }

                    const tagName = getJsxElementName(child);

                    if (tagName === 'script') {
                        seenScript = true;
                        continue;
                    }

                    if (tagName === 'style' && seenScript) {
                        context.report({
                            node: child.openingElement,
                            messageId: 'styleAfterScript',
                        });
                    }
                }
            },
        };
    },
};
