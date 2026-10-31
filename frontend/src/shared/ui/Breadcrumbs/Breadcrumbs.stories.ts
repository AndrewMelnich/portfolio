import Breadcrumbs from './Breadcrumbs.astro';

export default {
    title: 'shared/ui/Breadcrumbs',
    component: Breadcrumbs,
    args: {
        data: [{ text: 'Главная', href: '#' }, { text: 'Раздел', href: '#' }, { text: 'Текущая страница' }],
    },
};

export const Default = {};
