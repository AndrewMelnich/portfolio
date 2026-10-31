import DOMPurify, { type Config } from 'isomorphic-dompurify';

const DEFAULT_CONFIG: Config = {
    ADD_ATTR: ['target'],
};

let targetBlankHookRegistered = false;

function ensureTargetBlankHook() {
    if (targetBlankHookRegistered) {
        return;
    }

    targetBlankHookRegistered = true;

    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
        if (node.tagName !== 'A' || node.getAttribute('target') !== '_blank') {
            return;
        }

        const rel = node.getAttribute('rel') ?? '';
        const relValues = new Set(rel.split(/\s+/).filter(Boolean));

        relValues.add('noopener');
        relValues.add('noreferrer');

        node.setAttribute('rel', [...relValues].join(' '));
    });
}

ensureTargetBlankHook();

export function sanitizeHtml(dirty: string, config?: Config): string {
    return DOMPurify.sanitize(dirty, config ? { ...DEFAULT_CONFIG, ...config } : DEFAULT_CONFIG);
}
