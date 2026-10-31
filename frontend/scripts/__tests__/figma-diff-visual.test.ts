import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { diffPngBuffers, visualTargets } from '../figma-diff-visual.mjs';

function solid(width: number, height: number, rgba: number[]) {
    const png = new PNG({ width, height });

    for (let i = 0; i < png.data.length; i += 4) {
        png.data[i] = rgba[0];
        png.data[i + 1] = rgba[1];
        png.data[i + 2] = rgba[2];
        png.data[i + 3] = rgba[3];
    }

    return PNG.sync.write(png);
}

describe('diffPngBuffers', () => {
    it('counts one changed pixel and survives a size mismatch', () => {
        const before = solid(2, 2, [255, 255, 255, 255]);
        const afterPng = new PNG({ width: 2, height: 2 });

        afterPng.data.fill(255);
        afterPng.data[0] = 0;
        afterPng.data[1] = 0;
        afterPng.data[2] = 0;
        const same = diffPngBuffers(before, solid(2, 2, [255, 255, 255, 255]));
        const changed = diffPngBuffers(before, PNG.sync.write(afterPng));
        const taller = diffPngBuffers(before, solid(2, 3, [255, 255, 255, 255]));

        expect(same.diffPixels).toBe(0);
        expect(changed.diffPixels).toBe(1);
        expect(taller.height).toBe(3);
        expect(taller.diffPixels).toBe(2);
    });
});

describe('visualTargets', () => {
    it('renders nodes with a visual property change, not a pure move', () => {
        expect(
            visualTargets({
                scope: { id: '1:1', kind: 'frame', name: 'Hero' },
                pages: [],
            }),
        ).toEqual([{ id: '1:1', name: 'Hero' }]);

        const page = visualTargets({
            scope: { id: '0:1', kind: 'page', name: 'Home' },
            pages: [
                {
                    id: '0:1',
                    frames: [
                        {
                            id: '1:1',
                            name: 'Hero',
                            added: [{ id: '1:4', name: 'Badge' }],
                            removed: [],
                            changed: [
                                { id: '1:2', name: 'Title', paths: [{ path: 'absoluteBoundingBox.y' }] },
                                {
                                    id: '1:3',
                                    name: 'Card',
                                    paths: [{ path: 'paddingTop' }, { path: 'absoluteBoundingBox.height' }],
                                },
                            ],
                            renamed: [],
                            moved: [],
                        },
                    ],
                },
            ],
        });

        expect(page).toEqual([
            { id: '1:3', name: 'Card' },
            { id: '1:4', name: 'Badge' },
        ]);
    });
});
