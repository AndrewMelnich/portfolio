import Typograf from 'typograf';
import { DEFAULT_LOCALE } from '@/shared/config';

Typograf.addRule({
    name: 'common/other/aposToQuot',
    handler: function (text) {
        return text.replace(/&apos;/g, "'");
    },
});

const typograf = new Typograf({ locale: ['ru', 'en-US'] });

typograf.enableRule(['common/nbsp/afterNumber']);
// Не превращать «1C» в «1°C»
typograf.disableRule(['common/symbols/cf']);

// Вложенные кавычки тоже «ёлочки» для русской типографики
typograf.setSetting('common/punctuation/quote', 'ru', { left: '«', right: '»', removeDuplicateQuotes: true });

const cache = new Map<string, string>();

export const tp = (str: string, locale = DEFAULT_LOCALE) => {
    const key = `${locale}___${str}`;
    const cached = cache.get(key);

    if (cached !== undefined) {
        return cached;
    }

    const localeValue = locale === 'ru' ? 'ru' : 'en-US';

    // U+2028/U+2029 из Figma/Word: в HTML как второй пробел, не как \n
    const result = typograf.execute(str.replace(/[\u2028\u2029]/g, ' ').replace(/\r?\n/g, '<br/>'), {
        locale: localeValue,
    });

    cache.set(key, result);

    return result;
};
