export const groupBy = <T extends Record<string, unknown>>(arr: T[], key: string) => {
    return arr.reduce<Record<string, T[]>>((group, item) => {
        const data = item[key];

        if (typeof data === 'string') {
            group[data] = group[data] ?? [];
            group[data].push(item);
        }

        return group;
    }, {});
};
