import type { ICase } from './types';

export const CASES: ICase[] = [
    {
        slug: 'ren',
        title: { ru: 'Ren', en: 'Ren' },
        teaser: {
            ru: 'Сайт мероприятия: программа, участники, сервисы. Собрал фронт по макету с нуля.',
            en: 'Event site — programme, participants, services. Built the frontend from the mockup.',
        },
        description: {
            ru: ['Сайт мероприятия: программа, участники, сервисы.', 'Собрал фронт по макету с нуля.'],
            en: ['Event site — programme, participants, services.', 'Built the frontend from the mockup.'],
        },
        role: 'built',
        tags: ['event', 'forum', 'i18n'],
        featured: true,
        liveUrl: 'https://rusenergyweek.com/',
        image: {
            src: '/static/img/cases/ren/cover.jpg',
            width: 1440,
            height: 900,
            alt: 'Российская энергетическая неделя — главная страница',
        },
    },
    {
        slug: 'tnf',
        title: { ru: 'TNF', en: 'TNF' },
        teaser: {
            ru: 'Сайт технологического форума TNF: экраны, регистрация, сервисы для участников. Фронт с нуля по макету.',
            en: 'TNF tech forum site — pages, registration, participant services. Frontend from scratch.',
        },
        description: {
            ru: [
                'Сайт технологического форума TNF: экраны, регистрация, сервисы для участников.',
                'Фронт с нуля по макету.',
            ],
            en: ['TNF tech forum site — pages, registration, participant services.', 'Frontend from scratch.'],
        },
        role: 'built',
        tags: ['event', 'forum', 'forms'],
        featured: true,
        liveUrl: 'https://oilgasforum.ru/',
        image: {
            src: '/static/img/cases/tnf/cover.jpg',
            width: 1024,
            height: 544,
            alt: 'Международный промышленно-энергетический форум TNF',
        },
    },
    {
        slug: 'vileda',
        title: { ru: 'Vileda Professional', en: 'Vileda Professional' },
        teaser: {
            ru: 'B2B-сайт: каталог, решения для бизнеса, контентные разделы. Собрал по макету.',
            en: 'B2B site — catalog, business solutions, content sections. Built from the mockup.',
        },
        description: {
            ru: ['B2B-сайт: каталог, решения для бизнеса, контентные разделы.', 'Собрал по макету.'],
            en: ['B2B site — catalog, business solutions, content sections.', 'Built from the mockup.'],
        },
        role: 'built',
        tags: ['catalog', 'b2b', 'corporate'],
        liveUrl: 'https://vileda-prof.ru',
        featured: true,
        image: {
            src: '/static/img/cases/vileda/cover.jpg',
            width: 1440,
            height: 900,
            alt: 'Vileda Professional — главная страница сайта',
        },
    },
    {
        slug: 'iiko',
        title: { ru: 'iiko', en: 'iiko' },
        teaser: {
            ru: 'Сайт продуктовой экосистемы iiko. Поддержка и точечные фронт-задачи.',
            en: 'iiko product site — frontend support and updates.',
        },
        description: {
            ru: ['Сайт продуктовой экосистемы iiko.', 'Поддержка и точечные фронт-задачи.'],
            en: ['iiko product site.', 'Frontend support and updates.'],
        },
        role: 'support',
        tags: ['product', 'corporate'],
        liveUrl: 'https://iiko.ru/',
        image: {
            src: '/static/img/cases/iiko/cover.jpg',
            width: 1440,
            height: 900,
            alt: 'iiko — главная страница сайта',
        },
    },
    {
        slug: 'composit',
        title: { ru: 'Composit', en: 'Composit' },
        teaser: {
            ru: 'Каталог Composit: карточки, разделы. Доработки и поддержка фронта.',
            en: 'Composit catalog — listings and sections. Frontend support.',
        },
        description: {
            ru: ['Каталог Composit: карточки, разделы.', 'Доработки и поддержка фронта.'],
            en: ['Composit catalog — listings and sections.', 'Frontend support.'],
        },
        role: 'support',
        tags: ['catalog', 'corporate'],
        liveUrl: 'https://kompozit.online',
        image: {
            src: '/static/img/cases/composit/cover.jpg',
            width: 1440,
            height: 900,
            alt: 'Composit — главная страница сайта',
        },
    },

    {
        slug: 'artlife',
        title: { ru: 'Artlife', en: 'Artlife' },
        teaser: {
            ru: 'Корпоративный сайт Artlife. Сопровождение фронта.',
            en: 'Artlife corporate site — frontend support.',
        },
        description: {
            ru: ['Корпоративный сайт Artlife.', 'Сопровождение фронта.'],
            en: ['Artlife corporate site.', 'Frontend support.'],
        },
        role: 'support',
        tags: ['biotech', 'corporate'],
        liveUrl: 'https://biotech.artlife.ru/',
        image: {
            src: '/static/img/cases/artlife/cover.jpg',
            width: 1440,
            height: 900,
            alt: 'Artlife — главная страница сайта',
        },
    },
    {
        slug: 'october',
        title: { ru: 'October', en: 'October' },
        teaser: {
            ru: 'Сайт клиники / медицинского центра. Поддержка фронта.',
            en: 'Clinic / medical center site — frontend support.',
        },
        description: {
            ru: ['Сайт клиники / медицинского центра.', 'Поддержка фронта.'],
            en: ['Clinic / medical center site.', 'Frontend support.'],
        },
        role: 'support',
        tags: ['medicine', 'corporate'],
        liveUrl: 'https://kdc-hm.ru/',
        image: {
            src: '/static/img/cases/october/cover.jpg',
            width: 1440,
            height: 900,
            alt: 'October — главная страница сайта',
        },
    },
    {
        slug: 'daigo',
        title: { ru: 'Daigo', en: 'Daigo' },
        teaser: {
            ru: 'Контентный проект Daigo. Правки вёрстки и блоков.',
            en: 'Daigo content project — layout and block updates.',
        },
        description: {
            ru: ['Контентный проект Daigo.', 'Правки вёрстки и блоков.'],
            en: ['Daigo content project.', 'Layout and block updates.'],
        },
        role: 'support',
        tags: ['media', 'content'],
        liveUrl: 'https://daigo.chipsa.design',
        image: {
            src: '/static/img/cases/daigo/cover.jpg',
            width: 1440,
            height: 900,
            alt: 'Daigo — главная страница сайта',
        },
    },
    {
        slug: 'dvizh',
        title: { ru: 'Dvizh Online School', en: 'Dvizh Online School' },
        teaser: {
            ru: 'Онлайн-школа: страницы курсов, формы. Поддержка и доработки UI.',
            en: 'Online school — course pages and forms. UI support.',
        },
        description: {
            ru: ['Онлайн-школа: страницы курсов, формы.', 'Поддержка и доработки UI.'],
            en: ['Online school — course pages and forms.', 'UI support.'],
        },
        role: 'support',
        tags: ['education', 'forms'],
        liveUrl: 'https://dvizhenie.school',
        image: {
            src: '/static/img/cases/dvizh/cover.jpg',
            width: 1440,
            height: 900,
            alt: 'Dvizh Online School — главная страница сайта',
        },
    },
    {
        slug: 'eldis',
        title: { ru: 'Eldis', en: 'Eldis' },
        teaser: {
            ru: 'Корпоративный сайт Eldis. Сопровождение интерфейса.',
            en: 'Eldis corporate site — ongoing UI work.',
        },
        description: {
            ru: ['Корпоративный сайт Eldis.', 'Сопровождение интерфейса.'],
            en: ['Eldis corporate site.', 'Ongoing UI work.'],
        },
        role: 'support',
        tags: ['corporate'],
        liveUrl: 'https://eldis24.ru',
        image: {
            src: '/static/img/cases/eldis/cover.jpg',
            width: 1440,
            height: 900,
            alt: 'Eldis — главная страница сайта',
        },
    },
    {
        slug: 'zagranitsa',
        title: { ru: 'Заграница', en: 'Zagranitsa' },
        teaser: {
            ru: 'Контентный сайт. Поддержка вёрстки и страниц.',
            en: 'Content site — layout and page support.',
        },
        description: {
            ru: ['Контентный сайт.', 'Поддержка вёрстки и страниц.'],
            en: ['Content site.', 'Layout and page support.'],
        },
        role: 'support',
        tags: ['media', 'content'],
        liveUrl: 'https://zagranitsa.pro/',
        image: {
            src: '/static/img/cases/zagranitsa/cover.jpg',
            width: 1440,
            height: 900,
            alt: 'Заграница — главная страница сайта',
        },
    },
    {
        slug: 'chillbase',
        title: { ru: 'Chillbase', en: 'Chillbase' },
        teaser: {
            ru: 'Продуктовый сайт Chillbase. Поддержка и доработки UI.',
            en: 'Chillbase product site — UI support.',
        },
        description: {
            ru: ['Продуктовый сайт Chillbase.', 'Поддержка и доработки UI.'],
            en: ['Chillbase product site.', 'UI support.'],
        },
        role: 'support',
        tags: ['product', 'corporate'],
        liveUrl: 'https://chillbase.net/',
        image: {
            src: '/static/img/cases/chillbase/cover.jpg',
            width: 1440,
            height: 900,
            alt: 'Chillbase — главная страница сайта',
        },
    },
    {
        slug: 'chipsa',
        title: { ru: 'Chipsa', en: 'Chipsa' },
        teaser: {
            ru: 'Сайт агентства Chipsa. Поддержка и правки интерфейса.',
            en: 'Chipsa agency site — UI support.',
        },
        description: {
            ru: ['Сайт агентства Chipsa.', 'Поддержка и правки интерфейса.'],
            en: ['Chipsa agency site.', 'UI support.'],
        },
        role: 'support',
        tags: ['agency', 'corporate'],
        liveUrl: 'https://chipsa.ru/',
        image: {
            src: '/static/img/cases/chipsa/cover.jpg',
            width: 1440,
            height: 900,
            alt: 'Chipsa — главная страница сайта',
        },
    },
    {
        slug: 'vki',
        title: { ru: 'VKI', en: 'VKI' },
        teaser: {
            ru: 'Корпоративный сайт VKI. Доработки по макету.',
            en: 'VKI corporate site — mockup-driven updates.',
        },
        description: {
            ru: ['Корпоративный сайт VKI.', 'Доработки по макету.'],
            en: ['VKI corporate site.', 'Mockup-driven updates.'],
        },
        role: 'support',
        tags: ['corporate'],
        liveUrl: 'https://vk-ing.ru/',
        image: {
            src: '/static/img/cases/vki/cover.jpg',
            width: 1440,
            height: 900,
            alt: 'VKI — главная страница сайта',
        },
    },
];

export const getCaseBySlug = (slug: string): ICase | undefined => CASES.find((item) => item.slug === slug);

export const FEATURED_CASES = CASES.filter((item) => item.featured);

export const BUILT_CASES = CASES.filter((item) => item.role === 'built');

export const SUPPORT_CASES = CASES.filter((item) => item.role === 'support');
