export const VALIDATION_MESSAGES = {
    EMPTY_FIELD: {
        ru: 'Поле обязательно к заполнению',
        // en: 'This field must not be empty',
    },
    INVALIDATED_EMAIL: {
        ru: 'Введите корректный адрес эл. почты',
        // en: 'Enter a valid email address',
    },
    INVALIDATED_PHONE: {
        ru: 'Введите корректный номер телефона',
        // en: 'Enter a valid phone number',
    },
    INVALIDATED_SELECT: {
        ru: 'Выберите значение из списка',
        // en: 'Choose an option',
    },
    INVALIDATED_FILE: {
        ru: 'Загрузите файл',
        // en: 'Upload a file',
    },
    INVALIDATED_EQUALS: {
        ru: 'Значение полей должно совпадать',
        // en: 'Values must be equal',
    },
} as const;
