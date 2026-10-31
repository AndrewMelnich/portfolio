export const commonPreserveRelative = [
    '.cursor/commands/open_mr.md',
    '.cursor/commands/**/commit_changes.md',
    '.cursor/data/**',
    '.cursor/fstack/project.md',
    '.cursor/fstack/config.json',
    '.cursor/fstack/figma-diff.md',
    '.cursor/fstack/features.md',
    'docs/agents/**',
    'AGENTS.md',
    'frontend/AGENTS.md',
    'backend/AGENTS.md',
    'ROLE.md',
];

export const skipCopyFromSourceRelative = [
    '.cursor/commands/frontend/create_astro_layout.md',
    '.cursor/rules/frontend/common/no-backend.mdc',
    '.cursor/rules/frontend/standards/astro.mdc',
    '.cursor/rules/frontend/standards/fsd.mdc',
    '.cursor/rules/frontend/standards/api.mdc',
    '.cursor/rules/frontend/standards/backend-data.mdc',
    '.cursor/rules/frontend/standards/media-types.mdc',
    '.cursor/rules/frontend/standards/page-sections.mdc',
    '.cursor/rules/frontend/standards/figma-delivery.mdc',
    '.cursor/hooks/after-file-edit.mjs',
    '.cursor/hooks/stop.mjs',
    '.cursor/hooks.json',
];

export const bitrixPreserveRelative = [
    ...commonPreserveRelative,
    '.cursor/commands/open_mr.md',
    '.cursor/commands/frontend/create_layout.md',
    '.cursor/commands/review_code.md',
    '.cursor/commands/frontend/code_review.md',
    '.cursor/commands/frontend/create_api_endpoint.md',
    '.cursor/commands/frontend/create_react_layout.md',
    '.cursor/commands/frontend/create_wysiwyg_page.md',
    '.cursor/commands/frontend/get_staged_code_review.md',
    '.cursor/commands/frontend/create_typography_from_figma.md',
    '.cursor/rules/git-workflow.mdc',
    '.cursor/rules/frontend/common/verify-after-edit.mdc',
    '.cursor/rules/frontend/common/rules.mdc',
    '.cursor/rules/frontend/standards/javascript.mdc',
    '.cursor/rules/frontend/standards/structure.mdc',
    '.cursor/rules/frontend/standards/templates.mdc',
    '.cursor/rules/frontend/standards/css.mdc',
    '.cursor/rules/frontend/standards/a11y.mdc',
    '.cursor/hooks/**',
    '.cursor/worktrees.json',
];

export const copyFromSourceRelative = [
    '.cursor/agents/design-review.md',
    '.cursor/agents/visual-judge.md',
    '.cursor/agents/plan-critic.md',
    '.cursor/commands/generate_commit_message.md',
    '.cursor/commands/review_code.md',
    '.cursor/commands/open_mr.md',
    '.cursor/commands/frontend/code_review.md',
    '.cursor/commands/frontend/create_react_layout.md',
    '.cursor/commands/frontend/create_wysiwyg_page.md',
    '.cursor/commands/frontend/get_staged_code_review.md',
    '.cursor/commands/frontend/create_typography_from_figma.md',
    '.cursor/commands/frontend/create_api_endpoint.md',
    '.cursor/rules/fstack-models.mdc',
    '.cursor/rules/no-code-comments.mdc',
    '.cursor/rules/frontend/common/laziness-protocol.mdc',
    '.cursor/rules/frontend/common/rules.mdc',
    '.cursor/rules/frontend/standards/a11y.mdc',
    '.cursor/rules/frontend/standards/css.mdc',
    '.cursor/mcp.json',
];

export function archetypeConfig(id) {
    const base = {
        id,
        preserveRelative: [...commonPreserveRelative],
        skipCopyFromSourceRelative: [...skipCopyFromSourceRelative],
        copyFromSourceRelative: [...copyFromSourceRelative],
        pathRewrites: [],
        removeCursorSkills: true,
        patchPnpmAuditFix: false,
    };

    if (id === 'bitrix') {
        return {
            ...base,
            preserveRelative: bitrixPreserveRelative,
            pathRewrites: [
                { from: 'frontend/', to: 'local/templates/main/frontend/' },
                { from: 'frontend/**', to: 'local/templates/main/frontend/**' },
            ],
            patchPnpmAuditFix: true,
        };
    }

    if (id === 'vite-root') {
        return {
            ...base,
            pathRewrites: [{ from: 'frontend/', to: 'src/' }],
        };
    }

    return base;
}
