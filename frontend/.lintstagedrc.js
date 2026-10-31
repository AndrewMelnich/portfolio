import path from 'node:path';

const buildEslintCommand = (filenames) =>
    `pnpm exec eslint --cache --cache-location .eslintcache --fix ${filenames
        .map((f) => path.relative(process.cwd(), f))
        .join(' ')}`;

export default {
    'src/**/*.{js,jsx,ts,tsx,astro}': [buildEslintCommand, 'oxfmt --no-error-on-unmatched-pattern'],
    'src/**/*.{md,mdx,css,scss}': 'oxfmt --no-error-on-unmatched-pattern',
    'src/**/*.scss': 'stylelint --cache --cache-location .stylelintcache --fix',
};
