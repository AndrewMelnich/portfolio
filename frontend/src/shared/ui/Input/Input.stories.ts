import Input from './Input.astro';

export default {
    title: 'shared/ui/Input',
    component: Input,
    args: {
        id: 'storybook-input',
        label: 'Имя',
        type: 'text',
        hideLabel: false,
        showMessage: true,
        disabled: false,
        required: false,
    },
};

export const Default = {};
