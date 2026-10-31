const enabled = false;

export const CDN_DOMAIN = 'https://cdn.chipsa.ru'; // TODO: поменять!

export const cdnCondition = (env?: string) => enabled && process.env.NODE_ENV === 'production' && env === 'production';

export const fromCDN = (path: string) => {
    return cdnCondition(import.meta.env.PUBLIC_ENV) && !path.startsWith(CDN_DOMAIN) ? CDN_DOMAIN + path : path;
};
