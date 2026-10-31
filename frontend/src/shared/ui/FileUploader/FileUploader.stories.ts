import FileUploader from './FileUploader.astro';

export default {
    title: 'shared/ui/FileUploader',
    component: FileUploader,
    args: {
        inputId: 'storybook-uploader',
        fieldName: 'files',
        endpoint: '/nextapi/upload',
        label: 'Прикрепить файлы',
        allowedFileTypes: ['image/png', 'image/jpeg', 'application/pdf'],
        maxNumberOfFiles: 3,
        message: '',
        valid: true,
        disabled: false,
        required: false,
    },
};

export const Default = {};
