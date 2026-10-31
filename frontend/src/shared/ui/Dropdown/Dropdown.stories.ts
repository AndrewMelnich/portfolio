import DropdownStory from './DropdownStory.astro';

export default {
    title: 'shared/ui/Dropdown',
    component: DropdownStory,
    args: {
        id: 'storybook-dropdown',
        position: 'bottom-center',
        triggerLabel: 'Открыть меню',
    },
};

export const Default = {};
