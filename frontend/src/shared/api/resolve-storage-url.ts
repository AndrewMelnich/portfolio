import { PUBLIC_API_HOST } from 'astro:env/client';

export const resolveStorageUrl = (url: string): string =>
    url.startsWith('/storage/') ? `${PUBLIC_API_HOST}${url}` : url;
