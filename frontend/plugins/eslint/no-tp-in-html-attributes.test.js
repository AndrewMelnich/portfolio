import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import rule from './no-tp-in-html-attributes.js';

const tester = new RuleTester({
    languageOptions: {
        parser: tsParser,
        parserOptions: {
            ecmaFeatures: { jsx: true },
        },
    },
});

tester.run('custom/no-tp-in-html-attributes', rule, {
    valid: [
        { code: 'const el = <a aria-label="На главную" />;' },
        { code: 'const el = <img alt="Логотип" />;' },
        { code: 'const el = <a aria-label={label} />;' },
        { code: 'const el = <h1>{tp("Заголовок")}</h1>;' },
        { code: 'const el = <Button label={tp("Далее")} />;' },
        { code: 'const el = <Section title={tp("Герой")} />;' },
    ],
    invalid: [
        {
            code: "const el = <a aria-label={tp('На главную')} />;",
            errors: [{ messageId: 'tpInHtmlAttribute' }],
        },
        {
            code: "const el = <img alt={tp('Логотип')} />;",
            errors: [{ messageId: 'tpInHtmlAttribute' }],
        },
        {
            code: "const el = <Image alt={tp('Фото')} />;",
            errors: [{ messageId: 'tpInHtmlAttribute' }],
        },
        {
            code: "const el = <nav aria-label={cond ? tp('A') : 'B'}></nav>;",
            errors: [{ messageId: 'tpInHtmlAttribute' }],
        },
        {
            code: "const el = <button title={tp('Подсказка')} />;",
            errors: [{ messageId: 'tpInHtmlAttribute' }],
        },
        {
            code: "const el = <input placeholder={tp('Поиск')} />;",
            errors: [{ messageId: 'tpInHtmlAttribute' }],
        },
    ],
});
