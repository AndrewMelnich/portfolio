import type { AppCommonPageData } from '@/shared/api';
import { WEBSITE_METADATA } from '@/shared/config';
import type { CommonPageProps } from '@/shared/model';

export const getCommonPageProps = async (): Promise<Omit<CommonPageProps, 'breadcrumbs' | keyof AppCommonPageData>> => {
    return {
        meta: {
            baseTitle: WEBSITE_METADATA.name,
            description: '[APP_DESCRIPTION]',
            ogImage: '/static/img/og-image.jpg',
            title: WEBSITE_METADATA.name,
        },
    };
};
