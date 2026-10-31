import { definePreview } from '@storybook-astro/framework';
import { applyStyles } from 'virtual:storybook-astro-renderer';
import { STORYBOOK_ASTRO_SCSS_HMR_MARK } from './astro-scss-constants.ts';
import '../src/app/css/app.scss';

const previewParameters = {
    layout: 'centered',
    controls: {
        matchers: {
            color: /(background|color)$/i,
            date: /Date$/i,
        },
    },
} as const;

export const parameters = previewParameters;

export default definePreview({
    parameters: previewParameters,
});

if (import.meta.hot) {
    import.meta.hot.on('vite:afterUpdate', (payload) => {
        if (payload.updates.some((update) => update.path.includes(STORYBOOK_ASTRO_SCSS_HMR_MARK))) {
            applyStyles();
        }
    });
}
