import type { AppLocale } from '@/shared/config';
import type { ImageShape } from '@/shared/model';

export type CaseRole = 'built' | 'support';

export type ICase = {
    slug: string;
    title: Record<AppLocale, string>;
    teaser: Record<AppLocale, string>;
    description: Record<AppLocale, string[]>;
    role: CaseRole;
    tags: string[];
    liveUrl?: string;
    featured?: boolean;
    image?: ImageShape;
};
