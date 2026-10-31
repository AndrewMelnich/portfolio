import { isPhone } from '../index';

describe('Номер телефона', () => {
    it('Не принимает пустую строку', () => {
        expect(isPhone('')).toBe(false);
    });

    it('Не принимает буквы', () => {
        expect(isPhone('+799s9999999')).toBe(false);
    });

    it('Принимает спецсимволы [()s-]', () => {
        expect(isPhone('+7 (999) 111-22-33')).toBe(true);
    });
});
