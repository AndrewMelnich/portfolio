import Select from './Select.astro';

const options = [
    { label: 'Москва', value: 'msk' },
    { label: 'Санкт-Петербург', value: 'spb' },
    { label: 'Казань', value: 'kzn' },
];

export default {
    title: 'shared/ui/Select',
    component: Select,
    args: {
        id: 'storybook-select',
        name: 'city',
        options,
        placeholder: 'Выберите город',
        initialValue: '',
        position: 'bottom-center',
    },
};

export const Default = {};

export const WithValue = {
    args: {
        initialValue: 'spb',
    },
};
