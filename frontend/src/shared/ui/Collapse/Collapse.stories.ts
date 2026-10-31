import Collapse from './Collapse.astro';

type CollapseStoryArgs = {
    trigger: string;
    content: string;
};

export default {
    title: 'shared/ui/Collapse',
    component: Collapse,
    args: {
        trigger: 'Заголовок секции',
        content: 'Содержимое, которое раскрывается по клику на заголовок.',
    },
    render: (args: CollapseStoryArgs) => ({
        component: Collapse,
        slots: {
            trigger: `<h3>${args.trigger}</h3>`,
            default: `<p>${args.content}</p>`,
        },
    }),
};

export const Default = {};
