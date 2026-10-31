import { describe, expect, test } from 'vitest';
import { bytesToSize, deleteGetParams, formatTimeInSeconds, trimDecimal, withLeadingZero } from '.';

describe('strings', () => {
    test('withLeadingZero', () => {
        expect(withLeadingZero(1)).toBe('01');
        expect(withLeadingZero(10)).toBe('10');
        expect(withLeadingZero(10, 3)).toBe('010');
    });

    test('trimDecimal', () => {
        expect(trimDecimal(1.02)).toBe('1');
        expect(trimDecimal(1)).toBe('1');
        expect(trimDecimal(1.22, 1)).toBe('1.2');
    });

    test('deleteGetParams', () => {
        expect(deleteGetParams('/endpoint?id=1')).toBe('/endpoint');
        expect(deleteGetParams('/endpoint?id=1&some=2')).toBe('/endpoint');
    });

    test('formatTimeInSeconds', () => {
        expect(formatTimeInSeconds(62)).toBe('01:02');
        expect(formatTimeInSeconds(62, 1)).toBe('1:02');
    });

    test('bytesToSize', () => {
        expect(bytesToSize(0)).toBe('0 bytes');
        expect(bytesToSize(166_433)).toBe('163 kb');
        expect(bytesToSize(164_024)).toBe('160 kb');
        expect(bytesToSize(204_800)).toBe('200 kb');
        expect(bytesToSize(1_048_576)).toBe('1 mb');
        expect(bytesToSize(1_536)).toBe('1.5 kb');
    });
});
