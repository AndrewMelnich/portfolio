import { DEFAULT_LOCALE, LOCALES } from '../const';
import type { AppLocale } from '../types';

const locales: readonly string[] = LOCALES;

const isAppLocale = (value: string): value is AppLocale => locales.includes(value);

export const getLocale = (): AppLocale => {
    const lang = document.documentElement.lang;

    return isAppLocale(lang) ? lang : DEFAULT_LOCALE;
};
