/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const componentName = process.argv[2];
const componentLocation =
    process.argv.indexOf('--dir') > -1 ? process.argv[process.argv.indexOf('--dir') + 1] : 'shared/ui';
const withSection = process.argv.includes('--section');

if (!componentName || componentName.startsWith('--')) {
    console.error('Usage: mkac ComponentName [--section] [--dir layer/slice]');
    process.exit(1);
}

const folderPath = path.join(dirname, '..', 'src', componentLocation, componentName);

if (fs.existsSync(folderPath)) {
    console.error(`${componentName} folder already exists.`);
    process.exit(1);
}

fs.mkdirSync(folderPath, { recursive: true });

const toKebabCase = (str) => str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
const className = toKebabCase(componentName);

const indexFileContent = withSection
    ? `export { default } from './${componentName}.astro';
export type { RawProps as ${componentName}RawProps } from './types';
`
    : `export { default } from './${componentName}.astro';
`;

fs.writeFileSync(path.join(folderPath, 'index.ts'), indexFileContent);

const scssFileContent = `@use 'app/css/base/variables' as *;
@use 'app/css/utils/mixins' as *;

.${className} {
}
`;

fs.writeFileSync(path.join(folderPath, `${componentName}.scss`), scssFileContent);

if (withSection) {
    fs.writeFileSync(path.join(folderPath, 'types.ts'), `export type RawProps = {};\n`);
}

const astroFileContent = withSection
    ? `---
import type { HTMLAttributes } from 'astro/types';
import type { RawProps } from './types';

type Props = HTMLAttributes<'section'> & RawProps;

const { ...props } = Astro.props;
---

<section class:list={['${className}', props.class]} {...props}>
    <slot />
</section>

<style lang="scss" is:global>
    @use './${componentName}';
</style>
`
    : `---
import type { HTMLAttributes } from 'astro/types';

export type Props = HTMLAttributes<'div'>;

const { ...props } = Astro.props;
---

<div class:list={['${className}', props.class]} {...props}>
    <slot />
</div>

<style lang="scss" is:global>
    @use './${componentName}';
</style>
`;

fs.writeFileSync(path.join(folderPath, `${componentName}.astro`), astroFileContent);

console.log(`Astro component ${componentName} created successfully at ${folderPath}`);
