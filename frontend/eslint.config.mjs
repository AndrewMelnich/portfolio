/* eslint-disable import/no-internal-modules */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import * as astroParser from 'astro-eslint-parser';
import eslintPluginAstro from 'eslint-plugin-astro';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import noUnsanitized from 'eslint-plugin-no-unsanitized';
import reactCompiler from 'eslint-plugin-react-compiler';
import sonarjs from 'eslint-plugin-sonarjs';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import { IS_EXTERNAL_TEMPLATING } from './config.js';
import astroStyleBeforeScript from './plugins/eslint/astro-style-before-script.js';
import noAppTypeFromGenerated from './plugins/eslint/no-app-type-from-generated.js';
import noClassSelectorWithoutJsPrefix from './plugins/eslint/no-class-selector-without-js-prefix.js';
import noTpInHtmlAttributes from './plugins/eslint/no-tp-in-html-attributes.js';
import noUnreexportedModelType from './plugins/eslint/no-unreexported-model-type.js';
import noUnsanitizedSetHtml from './plugins/eslint/no-unsanitized-set-html.js';
import preferImageShape from './plugins/eslint/prefer-image-shape.js';
import sortImportSpecifiers from './plugins/eslint/sort-import-specifiers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

const publicApiPlugin = compat.extends('@feature-sliced/eslint-config/rules/public-api/lite');

export default defineConfig([
    ...eslintPluginAstro.configs.recommended,
    ...eslintPluginAstro.configs['jsx-a11y-recommended'],
    {
        files: ['**/*.{jsx,tsx}'],
        ...jsxA11y.flatConfigs.recommended,
    },
    {
        files: ['**/*.{jsx,tsx}'],
        rules: {
            'jsx-a11y/prefer-tag-over-role': 'error',
            'jsx-a11y/anchor-ambiguous-text': [
                'warn',
                {
                    words: [
                        'click',
                        'click here',
                        'here',
                        'learn more',
                        'more',
                        'read more',
                        'see more',
                        'details',
                        'подробнее',
                        'здесь',
                        'читать далее',
                        'кликни',
                        'далее',
                    ],
                },
            ],
        },
    },
    ...compat.extends('@feature-sliced/eslint-config/rules/public-api/lite'),
    ...publicApiPlugin,
    {
        files: ['**/*.{js,jsx,ts,tsx}'],
        plugins: {
            sonarjs,
            '@stylistic': stylistic,
            'react-compiler': reactCompiler,
            '@typescript-eslint': tseslint.plugin,
            'no-unsanitized': noUnsanitized,
            custom: {
                rules: {
                    'no-class-selector-without-js-prefix': noClassSelectorWithoutJsPrefix,
                    'no-app-type-from-generated': noAppTypeFromGenerated,
                    'no-tp-in-html-attributes': noTpInHtmlAttributes,
                    'no-unreexported-model-type': noUnreexportedModelType,
                    'prefer-image-shape': preferImageShape,
                },
            },
        },
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
            },
        },
        rules: {
            'no-eval': 'error',
            'no-implied-eval': 'error',
            'no-new-func': 'error',
            'no-unsanitized/method': 'error',
            'no-unsanitized/property': [
                'error',
                {
                    escape: {
                        taggedTemplates: ['Sanitizer.escapeHTML', 'escapeHTML'],
                        methods: ['Sanitizer.unwrapSafeHTML', 'unwrapSafeHTML', 'DOMPurify.sanitize', 'sanitizeHtml'],
                    },
                },
            ],
            'no-console': ['warn'],
            'import/no-internal-modules': [
                'error',
                {
                    allow: [...publicApiPlugin[0].rules['import/no-internal-modules'][1].allow, '@icons/*'],
                },
            ],
            '@typescript-eslint/naming-convention': [
                'error',
                {
                    selector: 'typeLike',
                    format: ['PascalCase'],
                },
            ],
            '@typescript-eslint/consistent-type-assertions': 'error',
            '@typescript-eslint/no-unused-vars': 'warn',
            '@stylistic/padding-line-between-statements': [
                'error',
                { blankLine: 'always', prev: '*', next: 'return' },
                { blankLine: 'always', prev: '*', next: 'for' },
                { blankLine: 'always', prev: '*', next: 'while' },
                { blankLine: 'always', prev: '*', next: 'switch' },
                { blankLine: 'always', prev: '*', next: 'if' },
                { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
                { blankLine: 'any', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] },
                { blankLine: 'always', prev: 'directive', next: '*' },
                { blankLine: 'any', prev: 'directive', next: 'directive' },
                { blankLine: 'always', prev: ['case', 'default'], next: '*' },
            ],
            'sonarjs/class-name': 'error',
            'sonarjs/class-prototype': 'error',
            'sonarjs/code-eval': 'error',
            'sonarjs/deprecation': 'warn',
            'sonarjs/fixme-tag': 'warn',
            'sonarjs/inconsistent-function-call': 'error',
            'sonarjs/link-with-target-blank': 'error',
            'sonarjs/new-operator-misuse': 'error',
            'sonarjs/no-array-delete': 'error',
            'sonarjs/no-associative-arrays': 'error',
            'sonarjs/no-built-in-override': 'error',
            'sonarjs/no-commented-code': 'warn',
            'sonarjs/no-delete-var': 'error',
            'sonarjs/no-duplicate-in-composite': 'error',
            'sonarjs/no-element-overwrite': 'error',
            'sonarjs/no-fallthrough': 'error',
            'sonarjs/no-global-this': 'error',
            'sonarjs/no-gratuitous-expressions': 'error',
            'sonarjs/no-hardcoded-ip': 'error',
            'sonarjs/no-hardcoded-passwords': 'error',
            'sonarjs/no-hardcoded-secrets': 'warn',
            'sonarjs/no-identical-conditions': 'error',
            'sonarjs/no-identical-expressions': 'error',
            'sonarjs/no-identical-functions': 'error',
            'sonarjs/no-ignored-exceptions': 'error',
            'sonarjs/no-implicit-global': 'error',
            'sonarjs/no-in-misuse': 'warn',
            'sonarjs/no-inconsistent-returns': 'error',
            'sonarjs/no-incorrect-string-concat': 'error',
            'sonarjs/no-inverted-boolean-check': 'error',
            'sonarjs/no-labels': 'error',
            'sonarjs/no-nested-conditional': 'warn',
            'sonarjs/no-primitive-wrappers': 'error',
            'sonarjs/no-redundant-assignments': 'warn',
            'sonarjs/no-redundant-jump': 'error',
            'sonarjs/no-redundant-optional': 'error',
            'sonarjs/no-redundant-parentheses': 'warn',
            'sonarjs/no-return-type-any': 'warn',
            'sonarjs/no-same-line-conditional': 'error',
            'sonarjs/no-skipped-tests': 'error',
            'sonarjs/no-small-switch': 'warn',
            'sonarjs/no-undefined-argument': 'error',
            // 'sonarjs/no-undefined-assignment': 'error',
            'sonarjs/no-uniq-key': 'error',
            'sonarjs/no-unthrown-error': 'warn',
            'sonarjs/no-use-of-empty-return-value': 'error',
            'sonarjs/no-useless-catch': 'error',
            'sonarjs/non-existent-operator': 'error',
            'sonarjs/post-message': 'error',
            'sonarjs/prefer-default-last': 'error',
            'sonarjs/prefer-immediate-return': 'warn',
            'sonarjs/prefer-promise-shorthand': 'warn',
            'sonarjs/prefer-single-boolean-return': 'error',
            'sonarjs/prefer-while': 'error',
            'sonarjs/reduce-initial-value': 'error',
            'sonarjs/todo-tag': 'warn',
            'sonarjs/unused-import': 'warn',
            'sonarjs/variable-name': 'error',
            'custom/no-class-selector-without-js-prefix': 'error',
            'custom/no-tp-in-html-attributes': 'error',
            'custom/no-unreexported-model-type': 'warn',
            'custom/prefer-image-shape': 'error',
        },
    },
    {
        files: ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,astro}'],
        plugins: {
            imports: {
                rules: {
                    'sort-specifiers': sortImportSpecifiers,
                },
            },
        },
        rules: {
            'imports/sort-specifiers': 'error',
            'import/no-duplicates': 'error',
            'import/newline-after-import': ['error', { considerComments: true }],
        },
    },
    {
        files: ['**/*.stories.tsx', '**/*.stories.ts', '**/*.stories.js'],
        rules: {
            'sonarjs/no-built-in-override': 'off',
        },
    },
    {
        files: ['**/*.tsx'],
        rules: {
            'sonarjs/no-inconsistent-returns': 'off',
        },
    },
    {
        files: ['**/*.astro'],
        plugins: {
            astro: eslintPluginAstro,
            sonarjs,
            custom: {
                rules: {
                    'astro-style-before-script': astroStyleBeforeScript,
                    'no-unsanitized-set-html': noUnsanitizedSetHtml,
                    'no-tp-in-html-attributes': noTpInHtmlAttributes,
                    'prefer-image-shape': preferImageShape,
                },
            },
        },
        languageOptions: {
            parser: astroParser, // Use astro-eslint-parser for .astro files
            parserOptions: {
                parser: tseslint.parser, // Chain to TypeScript for frontmatter
                extraFileExtensions: ['.astro'], // Allow .astro in TS parser
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: { jsx: true }, // Enable JSX support for Astro templates
            },
        },
        rules: {
            'custom/astro-style-before-script': 'error',
            'custom/no-unsanitized-set-html': 'error',
            'custom/no-tp-in-html-attributes': 'error',
            'custom/prefer-image-shape': 'error',
            'astro/prefer-class-list-directive': 'error',
            'astro/jsx-a11y/prefer-tag-over-role': 'error',
            'astro/jsx-a11y/anchor-ambiguous-text': [
                'warn',
                {
                    words: [
                        'click',
                        'click here',
                        'here',
                        'learn more',
                        'more',
                        'read more',
                        'see more',
                        'details',
                        'подробнее',
                        'здесь',
                        'читать далее',
                        'кликни',
                        'далее',
                    ],
                },
            ],
            'astro/jsx-a11y/label-has-associated-control': ['error', { depth: 5 }],
            // Site has no VTT captions; decorative mute-loops only
            'astro/jsx-a11y/media-has-caption': 'off',
            ...(IS_EXTERNAL_TEMPLATING
                ? {
                      'no-restricted-syntax': [
                          'error',
                          {
                              selector: "JSXElement > JSXOpeningElement > JSXIdentifier[name='style']",
                              message: 'Использование тега <style> запрещено. Используйте внешние SCSS-файлы.',
                          },
                          {
                              selector: "JSXElement > JSXOpeningElement > JSXIdentifier[name='script']",
                              message: 'Использование тега <script> запрещено. Выносите логику во внешние JS/TS-файлы.',
                          },
                      ],
                  }
                : {}),
        },
    },
    {
        files: ['src/**/index.ts', 'src/**/index.js'],
        rules: {
            'no-restricted-syntax': [
                'error',
                {
                    selector: 'ExportAllDeclaration[exportKind!="type"]',
                    message: 'Barrel: явный export { X }, не export *.',
                },
            ],
        },
    },
    {
        files: ['src/**/model/**/*.{ts,tsx}', 'src/**/*.interface.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    paths: [
                        {
                            name: '@/shared/api/generated/api',
                            message: 'App*/model не импортирует generated. Только Api* в types.ts эндпоинта.',
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ['src/**/api/**/types.ts'],
        rules: {
            'custom/no-app-type-from-generated': 'error',
        },
    },
    {
        // Browser client TS must not pull SSR fetchers / secrets.
        // Entity public API (`@/entities/<name>`) stays client-safe; HTTP lives in `@/entities/<name>/api`.
        files: [
            'src/app/app.ts',
            'src/widgets/**/*.{ts,js}',
            'src/features/**/*.{ts,js}',
            'src/shared/ui/**/*.{ts,js}',
            'src/shared/lib/**/*.{ts,js}',
            'src/entities/**/ui/**/*.{ts,js}',
            'src/_pages/**/sections/**/*.{ts,js}',
            'src/_pages/**/*PageView.ts',
            'src/_pages/**/*PageView.js',
        ],
        ignores: [
            'src/**/api/**',
            'src/**/model/**',
            'src/**/*.stories.*',
            'src/**/*.test.*',
            'src/**/*.d.ts',
            'src/shared/lib/rollbar/**',
        ],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    paths: [
                        {
                            name: 'astro:env/server',
                            message: 'astro:env/server только server-side. В client-бандле — ServerOnlyModule.',
                        },
                        {
                            name: '@/shared/api',
                            allowTypeImports: true,
                            message:
                                'Client: не value-import @/shared/api — баррель тянет getApiAuthHeaders / astro:env/server. Типы → import type; HTTP → /nextapi.',
                        },
                    ],
                    patterns: [
                        {
                            regex: '^@/entities/[^/]+/api(?:/.*)?$',
                            allowTypeImports: true,
                            message:
                                'Client: не value-import @/entities/*/api — SSR fetchers (server-only). Бери client-safe API из @/entities/<name>.',
                        },
                    ],
                },
            ],
        },
    },
]);
