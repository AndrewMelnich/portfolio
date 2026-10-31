import Checkbox from './Checkbox.astro';

type StoryArgs = {
    text: string;
};

export default {
    title: 'shared/ui/Checkbox',
    component: Checkbox,
    args: {
        text: 'Согласен с условиями',
    },
    render: (args: StoryArgs) => ({
        component: Checkbox,
        props: args,
        slots: { default: args.text },
    }),
};

export const Default = {};
