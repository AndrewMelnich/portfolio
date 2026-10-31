import Icon from './Icon.astro';
import { iconNames } from './types.generated';

export default {
    title: 'shared/ui/Icon',
    component: Icon,
    args: {
        name: iconNames[0],
        'aria-hidden': true,
    },
    argTypes: {
        name: {
            control: 'select',
            options: [...iconNames],
        },
    },
};

export const Default = {};
