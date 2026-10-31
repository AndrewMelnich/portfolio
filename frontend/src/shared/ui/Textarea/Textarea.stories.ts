import Textarea from './Textarea.astro';

export default {
    title: 'shared/ui/Textarea',
    component: Textarea,
    args: {
        id: 'storybook-textarea',
        label: 'Сообщение',
        placeholder: 'Ваш текст',
        rows: 4,
        hideLabel: false,
        message: '',
        valid: true,
        variant: 'light',
        disabled: false,
        required: false,
    },
};

export const Default = {};
