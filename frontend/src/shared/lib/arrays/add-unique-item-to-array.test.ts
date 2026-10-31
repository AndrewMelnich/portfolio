import { describe, expect, it } from 'vitest';
import { addUniqueItemToArray } from './add-unique-item-to-array';

describe('addUniqueItemToArray', () => {
    it('should add an item to an empty array', () => {
        const arr: number[] = [];
        const result = addUniqueItemToArray(arr, 1);

        expect(result).toEqual([1]);
    });

    it('should add a unique item to an array', () => {
        const arr = [1, 2, 3];
        const result = addUniqueItemToArray(arr, 4);

        expect(result).toEqual([1, 2, 3, 4]);
    });

    it('should not add a duplicate item to an array', () => {
        const arr = [1, 2, 3];
        const result = addUniqueItemToArray(arr, 2);

        expect(result).toEqual([1, 2, 3]);
    });

    it('should handle adding objects to an array', () => {
        interface Person {
            name: string;
            age: number;
        }

        const arr: Person[] = [{ name: 'John', age: 30 }];
        const person: Person = { name: 'Jane', age: 25 };
        const result = addUniqueItemToArray(arr, person);

        expect(result).toEqual([
            { name: 'John', age: 30 },
            { name: 'Jane', age: 25 },
        ]);
    });
});
