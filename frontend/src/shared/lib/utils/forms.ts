/**
 * Трансформация объекта в FormData
 */
export const toFormData = (obj: Record<string, any>): FormData => {
    const formData = new FormData();

    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];

            if (Array.isArray(value)) {
                value.forEach((item) => formData.append(key, item));
            } else {
                formData.append(key, value);
            }
        }
    }

    return formData;
};
