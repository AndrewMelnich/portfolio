import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import rule from './sort-import-specifiers.js';

const tester = new RuleTester({
    languageOptions: {
        parser: tsParser,
    },
});

tester.run('imports/sort-specifiers', rule, {
    valid: [
        { code: "import Def, { a, B, c } from 'x';" },
        { code: "import { DEFAULT_LOCALE, LOCALES, type AppLocale } from 'x';" },
        { code: "import { h2, h10 } from 'x';" },
        { code: "import { b as a, a as b } from 'x';" },
        { code: "import * as all from 'x';" },
    ],
    invalid: [
        {
            code: "import Def, { c, a, B } from 'x';",
            output: "import Def, { a, B, c } from 'x';",
            errors: [{ messageId: 'unsorted' }],
        },
        {
            code: "import { type AppLocale, LOCALES } from 'x';",
            output: "import { LOCALES, type AppLocale } from 'x';",
            errors: [{ messageId: 'unsorted' }],
        },
        {
            code: "import type { Z, A } from 'x';",
            output: "import type { A, Z } from 'x';",
            errors: [{ messageId: 'unsorted' }],
        },
        {
            code: "import { h10, h2 } from 'x';",
            output: "import { h2, h10 } from 'x';",
            errors: [{ messageId: 'unsorted' }],
        },
        {
            code: "import { b /* keep */, a } from 'x';",
            output: null,
            errors: [{ messageId: 'unsorted' }],
        },
    ],
});
