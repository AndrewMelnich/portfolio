export type FilterRange = [number, number];

export type FilterParamsResult = Record<string, string | number | null | boolean | FilterRange | (string | number)[]>;
