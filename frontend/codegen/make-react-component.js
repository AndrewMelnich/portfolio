/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const componentName = process.argv[2];
const componentLocation =
    process.argv.indexOf('--dir') > -1 ? process.argv[process.argv.indexOf('--dir') + 1] : 'shared/ui';
const withStorybook = process.argv.indexOf('--sb') > -1;
const extendsHtmlElement = process.argv.indexOf('--html') > -1;
const withRawProps = process.argv.indexOf('--raw') > -1;

if (!componentName) {
    console.error('Please provide a component name as an argument.');
    process.exit(1);
}

const folderPath = path.join(dirname, '..', 'src', componentLocation, componentName);

if (fs.existsSync(folderPath)) {
    console.error(`${componentName} folder already exists.`);
    process.exit(1);
}

fs.mkdirSync(folderPath, { recursive: true });

/**
 * Index file
 */
const indexFilePath = path.join(folderPath, 'index.ts');
const indexFileContent = `export { default, type Props as ${componentName}Props${withRawProps ? `, type RawProps as ${componentName}RawProps` : ''} } from './${componentName}';\n`;

fs.writeFileSync(indexFilePath, indexFileContent);

/**
 * SCSS file
 */
const scssFilePath = path.join(folderPath, `${componentName}.scss`);
const scssFileContent = `@use 'app/css/base/variables' as *;
@use 'app/css/utils/mixins' as *;
`;

fs.writeFileSync(scssFilePath, scssFileContent);

const toKebabCase = (str) => str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

/**
 * tsx file
 */
const tsxFilePath = path.join(folderPath, `${componentName}.tsx`);
const tsxFileContent =
    `${extendsHtmlElement ? "import classNames from 'classnames';\n" : ''}
${withRawProps ? `export type RawProps = {};\n` : ''}
export type Props = ${extendsHtmlElement ? 'React.HTMLAttributes<HTMLElement> & ' : ''}${
        withRawProps
            ? '{ ref?: React.Ref<HTMLDivElement> } & RawProps;'
            : `{
    ref?: React.Ref<HTMLDivElement>;
};`
    }

const ${componentName} = ({ ref${extendsHtmlElement ? ', ...props' : ''} }: Props) => {
    return <div${extendsHtmlElement ? ' {...props}' : ''} ref={ref}${extendsHtmlElement ? ` className={classNames('${toKebabCase(componentName)}', props.className)}` : ''}></div>;
};

export default ${componentName};`.trim() + '\n';

fs.writeFileSync(tsxFilePath, tsxFileContent);

/**
 * Storybook Playground file
 */
const storybookPlaygroundFilePath = path.join(folderPath, `Playground.stories.tsx`);
const storybookPlaygroundFileContent = `import { Meta, StoryObj } from '@storybook/nextjs';
import ${componentName} from './${componentName}';

const meta: Meta<typeof ${componentName}> = {
    component: ${componentName},
    title: '${componentLocation}/${componentName}/Playground',
};

export default meta;

type Story = StoryObj<typeof ${componentName}>;

export const Playground: Story = {
  args: {},
};\n`;

if (withStorybook) {
    fs.writeFileSync(storybookPlaygroundFilePath, storybookPlaygroundFileContent);
}
