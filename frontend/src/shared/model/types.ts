import type { AppCommonPageData } from '../api';

export type PageMeta = Partial<{
    title: string;
    description: string;
    ogImage: string;
}>;

export type AppBreadcrumbs = {
    text: string;
    href?: string | null;
}[];

export type CommonPageProps = AppCommonPageData & {
    bodyClass?: string;
    meta: PageMeta &
        Partial<{
            baseTitle: string;
        }>;
    breadcrumbs: AppBreadcrumbs;
};

export type ImageShape = {
    src: string;
    width?: number;
    height?: number;
    alt?: string;
    title?: string;
};

export type VideoShape = {
    media?: string;
    src: string;
    type: string;
    captions?: {
        src: string;
        srclang?: string;
        label?: string;
    };
}[];

export type AudioShape = {
    src: string;
    type?: string;
};
