import Tooltip from './Tooltip.astro';

type TooltipStoryArgs = {
    triggerText: string;
    tooltipText: string;
    class?: string;
};

export default {
    title: 'shared/ui/Tooltip',
    component: Tooltip,
    args: {
        triggerText: 'Наведите курсор',
        tooltipText: 'Подсказка для кнопки',
        class: 'storybook-tooltip',
    },
    render: (args: TooltipStoryArgs) => ({
        component: Tooltip,
        props: { class: args.class, style: 'margin: 48px' },
        slots: {
            default: `<button type="button" class="btn">${args.triggerText}</button>`,
            tooltip: args.tooltipText,
        },
    }),
};

export const Default = {};
