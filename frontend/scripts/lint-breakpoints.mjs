import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mixinsPath = join(root, 'src/app/css/utils/_mixins.scss');
const projectPath = join(root, '../.cursor/fstack/project.md');

const expected = [
    { name: 'laptop', max: 1366 },
    { name: 'tablet', max: 1199 },
    { name: 'mobile', max: 767 },
];

const mixins = readFileSync(mixinsPath, 'utf8');
const project = readFileSync(projectPath, 'utf8');
const errors = [];

for (const bp of expected) {
    const mixinRe = new RegExp(`@mixin\\s+${bp.name}\\b[\\s\\S]*?max-width:\\s*${bp.max}px`);
    if (!mixinRe.test(mixins)) {
        errors.push(`mixin ${bp.name} with max-width ${bp.max}px missing in ${mixinsPath}`);
    }
    if (!project.includes(`\`${bp.name}\``) && !project.includes(bp.name)) {
        errors.push(`breakpoint ${bp.name} not documented in ${projectPath}`);
    }
}

if (errors.length) {
    console.error('lint:breakpoints:');
    for (const line of errors) console.error(`  ${line}`);
    process.exit(1);
}
