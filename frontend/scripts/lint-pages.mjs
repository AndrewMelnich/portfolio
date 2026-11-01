import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const forbidden = join(root, 'src/pages/ui');

if (existsSync(forbidden)) {
    console.error(
        'lint:pages: src/pages/ui/ must not exist — proof routes are not product surfaces (use Storybook or a product route).',
    );
    process.exit(1);
}
