import { describe, expect, test } from 'vitest';
import { chpu } from './chpu';
import { encodeUrl } from './encode-url';

describe('CHPU', () => {
    describe('parseUrlToParams', () => {
        test('Возвращает пустой объект, если нет ключевого слова в URL', () => {
            expect(chpu.parseUrlToParams('/catalog')).toEqual({});
        });

        test('Возвращает пустой объект, если есть ключевое слово, то не валидный паттерн', () => {
            expect(chpu.parseUrlToParams('/catalog/filter/')).toEqual({});
            expect(chpu.parseUrlToParams('/catalog/filter/apply/')).toEqual({});
            expect(chpu.parseUrlToParams('/catalog/filter/nonvalid/stuff/apply/')).toEqual({});
        });

        test('Возвращает пустой объект, если нет закрывающего ключевого слова', () => {
            expect(chpu.parseUrlToParams('/filter/section-is-some-name/')).toEqual({});
        });

        test('Учитывает get-параметры', () => {
            expect(chpu.parseUrlToParams('/filter/section-is-some-name/apply/?foo=bar&foo=baz&some=thing')).toEqual({
                section: 'some-name',
                foo: ['bar', 'baz'],
                some: 'thing',
            });
        });

        test('is', () => {
            expect(chpu.parseUrlToParams('/filter/section-is-some-name/apply/')).toEqual({
                section: 'some-name',
            });
        });

        test('is (multiple)', () => {
            expect(chpu.parseUrlToParams('/filter/section-is-some-name-and-other-name/apply/')).toEqual({
                section: ['some-name', 'other-name'],
            });
        });

        test('Range: from-to', () => {
            expect(chpu.parseUrlToParams('/filter/price-from-0-to-100/apply/')).toEqual({
                price: [0, 100],
            });
        });

        test('Range: from', () => {
            expect(chpu.parseUrlToParams('/filter/price-from-100/apply/')).toEqual({
                price: [100, Number.MAX_SAFE_INTEGER],
            });
        });

        test('Range: to', () => {
            expect(chpu.parseUrlToParams('/filter/price-to-1000/apply/')).toEqual({
                price: [Number.MIN_SAFE_INTEGER, 1000],
            });
        });

        test('Несколько фильтров', () => {
            expect(chpu.parseUrlToParams('/filter/price-from-0-to-1000/section-is-some-name/apply/')).toEqual({
                price: [0, 1000],
                section: 'some-name',
            });
        });

        test('Несколько фильтров, потом нонсенс', () => {
            expect(chpu.parseUrlToParams('/filter/price-from-0-to-1000/section-is-some-name/nonsense/apply/')).toEqual({
                price: [0, 1000],
                section: 'some-name',
            });
        });

        test('С get-параметром', () => {
            expect(chpu.parseUrlToParams('/filter/section-is-some-name/apply/?foo=bar&foo=baz')).toEqual({
                section: 'some-name',
                foo: ['bar', 'baz'],
            });
        });

        test('С get-параметрами', () => {
            expect(chpu.parseUrlToParams('/filter/section-is-some-name/apply/?foo=bar&foo=baz')).toEqual({
                section: 'some-name',
                foo: ['bar', 'baz'],
            });

            expect(chpu.parseUrlToParams('/filter/section-is-some-name/apply/?foo=bar&top=true')).toEqual({
                section: 'some-name',
                foo: 'bar',
                top: 'true',
            });
        });
    });

    describe('encodeParamsToUrl', () => {
        test('Пустой объект', () => {
            expect(chpu.encodeParamsToUrl({})).toEqual('');
        });

        test('Несколько полей', () => {
            expect(
                chpu.encodeParamsToUrl(
                    {
                        size: [1, 5],
                        price: [200, 1000],
                        section: 'some-name',
                        days: [13, 14],
                        categories: [1, 2],
                    },
                    {
                        rangeKeys: ['size', 'price'],
                    },
                ),
            ).toEqual(
                '/filter/size-from-1-to-5/price-from-200-to-1000/section-is-some-name/days-is-13-and-14/categories-is-1-and-2/apply/',
            );
        });
    });

    describe('encodeUrl', () => {
        test('Сохраняет get-параметры', () => {
            expect(
                encodeUrl('/filter/section-is-some-name/apply/?foo=bar&foo=baz&some=thing', {
                    another: 'one',
                }),
            ).toEqual('/filter/section-is-some-name/another-is-one/apply/?foo=bar&foo=baz&some=thing');
        });
    });
});
