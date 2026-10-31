export const addUniqueItemToArray = <T = unknown>(arr: T[], value: T) => {
    return [...new Set([...arr, value])];
};
