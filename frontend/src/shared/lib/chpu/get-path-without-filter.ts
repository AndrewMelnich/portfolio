export const getPathWithoutFilter = (path: string, removeTrailingSlash = false) => {
    let newPath = path.replace(/\/filter\/.*\/apply/, '');

    if (removeTrailingSlash) {
        newPath = newPath.replace(/\/$/, '');
    }

    newPath = newPath.replace('/filter/apply', '');

    return newPath.split('?')[0];
};
