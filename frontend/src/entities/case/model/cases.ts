import type { ICase } from './types';

export const CASES: ICase[] = [
    {
        slug: 'ren',
        title: { ru: 'Ren', en: 'Ren' },
        teaser: {
            ru: 'Сайт Российской энергетической недели: программа, спикеры, сервисы для участников.',
            en: 'Russian Energy Week site — programme, speakers, participant services.',
        },
        description: {
            ru: [
                'Пришёл, когда была только сырая главная. Дальше конвейер: макет → страница → результат — так прошли все экраны.',
                'После сборки — круг оптимизации: PageSpeed, a11y, правки заказчика, снова по кругу. Сдан в октябре 2025. Стек — PHP.',
            ],
            en: [
                'Joined when only a rough homepage existed. Then a factory loop: mockup → page → ship — every screen that way.',
                'After build came the optimization loop: PageSpeed, a11y, client fixes, repeat. Delivered October 2025. Stack: PHP.',
            ],
        },
        role: 'built',
        tags: ['PHP', 'PageSpeed', 'a11y'],
        featured: true,
        liveUrl: 'https://rusenergyweek.com/',
        image: {
            src: '/static/img/cases/ren/cover.jpg',
            width: 1024,
            height: 594,
            alt: 'Российская энергетическая неделя — главная страница',
        },
    },
    {
        slug: 'tnf',
        title: { ru: 'TNF', en: 'TNF' },
        teaser: {
            ru: 'Промышленно-энергетический форум: регистрация, сервисы участников, плотная сетка страниц.',
            en: 'Industrial energy forum — registration, participant services, a dense set of pages.',
        },
        description: {
            ru: [
                'Забрал проект с готовой главной и несколькими страницами — ведущий разработчик уволился. Дальше месяцы срочных экранов. Это был мой первый проект на Next.js.',
                'Потом около двух лет поддержки с задачами «надо вчера», особенно перед форумами. Темп жёсткий — а сайт один из тех, чем горжусь.',
            ],
            en: [
                'Took over a site with a homepage and a few pages after the lead left. Months of urgent screens followed. My first Next.js project.',
                'Then about two years of support with "needed yesterday" tasks, especially before each forum. Tough pace — and a site I\'m proud of.',
            ],
        },
        role: 'built',
        tags: ['Next.js', 'support'],
        featured: true,
        liveUrl: 'https://oilgasforum.ru/',
        image: {
            src: '/static/img/cases/tnf/cover.jpg',
            width: 1024,
            height: 594,
            alt: 'Международный промышленно-энергетический форум TNF',
        },
    },
    {
        slug: 'vileda',
        title: { ru: 'Vileda Professional', en: 'Vileda Professional' },
        teaser: {
            ru: 'B2B-сайт Vileda Professional: каталог, решения для бизнеса, контентные разделы.',
            en: 'Vileda Professional B2B site — catalog, business solutions, content sections.',
        },
        description: {
            ru: [
                'Пришёл на PHP-проект с готовой, но сломанной вёрсткой части страниц — не на нашем стеке. По сути переписал сайт с нуля.',
                'Главная менялась уже несколько раз: заказчик любит новые идеи, и с каждым редизайном продукт становится свежее. Много работы по оптимизации и микроразметке — здесь многому научился.',
            ],
            en: [
                'Joined a PHP project with broken pages already in place — off our stack. Effectively rewrote the site from scratch.',
                'The homepage has been redesigned several times: the client brings new ideas, and each round makes the product fresher. Lots of optimization and structured data — I learned a lot here.',
            ],
        },
        role: 'built',
        tags: ['PHP', 'microdata', 'PageSpeed'],
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
            ru: 'Продуктовый сайт экосистемы iiko — точечные фронт-задачи в живом продукте.',
            en: 'iiko product ecosystem site — focused frontend work in a live product.',
        },
        description: {
            ru: [
                'Корпоративно-продуктовый сайт экосистемы iiko.',
                'Не сборка с нуля: точечные экраны, правки и обновления в уже работающем фронте.',
            ],
            en: [
                'Corporate product site for the iiko ecosystem.',
                'Not a from-scratch build: focused screens, fixes, and updates in a live frontend.',
            ],
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
            ru: 'Каталог Composit — карточки и разделы, доработки листингов.',
            en: 'Composit catalog — listings and sections, listing UI updates.',
        },
        description: {
            ru: [
                'Каталожный сайт с карточками товаров и разделами.',
                'Поддержка фронта: правки листингов, карточек и навигации по разделам.',
            ],
            en: [
                'Catalog site with product cards and sections.',
                'Frontend support: listing, card, and section-navigation updates.',
            ],
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
        slug: 'sgk-epp',
        title: { ru: 'СГК · ЕПП', en: 'SGK · EPP' },
        teaser: {
            ru: 'Кабинет и платежи СГК (ЕПП) — формы и личный кабинет.',
            en: 'SGK account and payments (EPP) — forms and cabinet UI.',
        },
        description: {
            ru: [
                'Кабинетный и платёжный контур СГК в рамках ЕПП.',
                'Доработки форм, кабинетов и связанных экранов — без пересборки всего сайта.',
            ],
            en: [
                'SGK account and payment flow within EPP.',
                'Updates to forms, cabinets, and related screens — not a full site rebuild.',
            ],
        },
        role: 'support',
        tags: ['cabinet', 'forms', 'payments'],
        liveUrl: 'https://sibgenco.ru',
        image: {
            src: '/static/img/cases/sgk-epp/cover.jpg',
            width: 1440,
            height: 900,
            alt: 'СГК — главная страница сайта',
        },
    },
    {
        slug: 'gtenergo',
        title: { ru: 'GT Energo', en: 'GT Energo' },
        teaser: {
            ru: 'Корпоративный сайт энергокомпании — сопровождение интерфейса.',
            en: 'Energy company corporate site — ongoing UI support.',
        },
        description: {
            ru: [
                'Корпоративный сайт GT Energo в энергетике.',
                'Поддержка и точечные правки интерфейса по мере задач от команды.',
            ],
            en: [
                'GT Energo corporate site in the energy sector.',
                "Support and focused UI fixes as the team's tasks come in.",
            ],
        },
        role: 'support',
        tags: ['corporate', 'energy'],
        liveUrl: 'https://www.gtenergo.ru',
        image: {
            src: '/static/img/cases/gtenergo/cover.jpg',
            width: 1440,
            height: 900,
            alt: 'GT Energo — главная страница сайта',
        },
    },
    {
        slug: 'artlife',
        title: { ru: 'Artlife', en: 'Artlife' },
        teaser: {
            ru: 'Биотех Artlife — корпоративный сайт на сопровождении.',
            en: 'Artlife biotech — corporate site under ongoing support.',
        },
        description: {
            ru: [
                'Корпоративный сайт биотех-направления Artlife.',
                'Сопровождение фронта: контентные и интерфейсные правки без смены основы.',
            ],
            en: [
                "Corporate site for Artlife's biotech line.",
                'Frontend support: content and UI updates without rebuilding the foundation.',
            ],
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
        title: { ru: 'КДЦ Октябрь', en: 'KDC October' },
        teaser: {
            ru: 'Культурный центр: афиша, билеты, сервисы — поддержка UI.',
            en: 'Cultural center — programme, tickets, services; UI support.',
        },
        description: {
            ru: [
                'Сайт КДЦ с афишей, билетами и сервисами для посетителей.',
                'Поддержка фронта: правки сценариев афиши и связанных экранов.',
            ],
            en: [
                'Cultural center site with programme, tickets, and visitor services.',
                'Frontend support: programme flows and related screen updates.',
            ],
        },
        role: 'support',
        tags: ['culture', 'events'],
        liveUrl: 'https://kdc-hm.ru/',
        image: {
            src: '/static/img/cases/october/cover.jpg',
            width: 1440,
            height: 900,
            alt: 'КДЦ Октябрь — главная страница сайта',
        },
    },
    {
        slug: 'daigo',
        title: { ru: 'Daigo', en: 'Daigo' },
        teaser: {
            ru: 'Контентный Daigo — правки блоков и вёрстки.',
            en: 'Daigo content project — block and layout updates.',
        },
        description: {
            ru: [
                'Контентный проект с набором типовых блоков.',
                'Правки вёрстки и блоков по мере обновления материалов.',
            ],
            en: [
                'Content project built from a set of recurring blocks.',
                'Layout and block updates as materials change.',
            ],
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
            ru: 'Онлайн-школа: курсы и формы — доработки UI.',
            en: 'Online school — course pages and forms; UI updates.',
        },
        description: {
            ru: [
                'Образовательный сайт со страницами курсов и формами записи.',
                'Поддержка и доработки UI под новые запуски и правки программ.',
            ],
            en: [
                'Education site with course pages and signup forms.',
                'UI support and updates for new launches and programme changes.',
            ],
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
            ru: 'Корпоративный Eldis — регулярные правки интерфейса.',
            en: 'Eldis corporate site — regular interface updates.',
        },
        description: {
            ru: [
                'Корпоративный сайт Eldis.',
                'Постоянное сопровождение: небольшие и средние правки интерфейса по запросу.',
            ],
            en: ['Eldis corporate site.', 'Ongoing support: small and mid-size interface updates on request.'],
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
            ru: 'Медиа «Заграница» — поддержка страниц и вёрстки.',
            en: 'Zagranitsa media — page and layout support.',
        },
        description: {
            ru: [
                'Контентный медиа-сайт с регулярными публикациями.',
                'Поддержка вёрстки и отдельных страниц под новые материалы.',
            ],
            en: ['Content media site with regular publications.', 'Layout and page support as new materials go live.'],
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
            ru: 'Продуктовый Chillbase — доработки UI в проде.',
            en: 'Chillbase product site — UI updates in production.',
        },
        description: {
            ru: ['Продуктовый сайт Chillbase.', 'Поддержка живого UI: правки экранов и блоков без полной пересборки.'],
            en: ['Chillbase product site.', 'Live UI support: screen and block updates without a full rebuild.'],
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
            ru: 'Сайт агентства Chipsa — правки своего рабочего дома.',
            en: "Chipsa agency site — updates to the studio's own home.",
        },
        description: {
            ru: [
                'Сайт дизайн-студии Chipsa, где я работаю.',
                'Поддержка и правки интерфейса: как у клиента, только свой продукт студии.',
            ],
            en: [
                'Site for Chipsa design studio, where I work.',
                "UI support and fixes — same bar as client work, on the studio's own product.",
            ],
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
            ru: 'Корпоративный VKI — доработки строго по макету.',
            en: 'VKI corporate site — mockup-driven updates.',
        },
        description: {
            ru: ['Корпоративный сайт VKI.', 'Точечные доработки фронта по макету — без переписывания всего проекта.'],
            en: [
                'VKI corporate site.',
                'Focused frontend updates from the mockup — without rewriting the whole project.',
            ],
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
