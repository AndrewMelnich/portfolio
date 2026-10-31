import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import rule from './prefer-image-shape.js';

const tester = new RuleTester({
    languageOptions: {
        parser: tsParser,
    },
});

tester.run('custom/prefer-image-shape', rule, {
    valid: [
        { code: 'type Props = { image?: ImageShape };' },
        { code: 'type Card = { src: string; alt?: string; caption: string };' },
        { code: 'type Source = { src: string; type: string };' },
        { code: 'type Audio = { src: string };' },
        {
            code: 'export type ImageShape = { src: string; alt?: string };',
            filename: 'src/shared/model/types.ts',
        },
        {
            code: 'export type ApiImage = { src: string; alt?: string };',
            filename: 'src/shared/api/generated/api.d.ts',
        },
        {
            code: 'export type Props = { src: string; alt: string; width: number; height: number; format?: string };',
        },
    ],
    invalid: [
        {
            code: 'type HeroImage = { src: string; alt?: string };',
            errors: [{ messageId: 'preferImageShape' }],
        },
        {
            code: 'type Props = { image: { src: string; alt?: string } };',
            errors: [{ messageId: 'preferImageShape' }],
        },
        {
            code: 'interface HeroImage { src: string; alt?: string }',
            errors: [{ messageId: 'preferImageShape' }],
        },
        {
            code: 'type Img = { src: string; width?: number; height?: number; alt?: string; title?: string };',
            errors: [{ messageId: 'preferImageShape' }],
        },
    ],
});
