import type { ApiResponse } from '@/shared/api';

type FormResponse<T> = ApiResponse<T>;

type AjaxFormSenderOptions<T> = {
    onBeforeSend: () => void;
    onSuccess: (response: FormResponse<T>) => any;
    onError: (err: Error) => any;
    onComplete: () => void;
    data: Record<string, any>;
    headers: Record<string, any>;
    shouldClearInputs?: boolean;
    inputSelector: string;
    method: string;
};

type Send<T> = (url?: string) => Promise<FormResponse<T>>;

type AppendData = (...data: [string, string | Blob, string?]) => void;

export type AjaxFormSender<T> = {
    send: Send<T>;
    appendData: AppendData;
    clearInputs: () => void;
};

export const clearInputs = (inputs: HTMLInputElement[] = []) => {
    Array.from(inputs).forEach((input) => {
        if (input.type === 'checkbox') {
            input.checked = false;
        } else if (input.type !== 'hidden') {
            input.value = '';
            input.classList.remove('is-not-empty');
        }
        input.dispatchEvent(new Event('blur'));
    });
};

const removeAddedFiles = (form: HTMLElement) => {
    const files = form.querySelectorAll('.js-upload-file');

    Array.from(files).forEach((file) => {
        file.remove();
    });
};

const defaultOptions: AjaxFormSenderOptions<unknown> = {
    onBeforeSend: () => {},
    onSuccess: () => {},
    onError: () => {},
    onComplete: () => {},
    data: {},
    headers: {},
    shouldClearInputs: true,
    inputSelector: '[name]:not([type="submit"]):not([type="reset"])',
    method: 'post',
};

export default <T = unknown>(
    form: HTMLFormElement,
    _options: Partial<AjaxFormSenderOptions<T>> = defaultOptions,
): AjaxFormSender<T> => {
    const options: AjaxFormSenderOptions<T> = { ...defaultOptions, ..._options };
    const method = (form.getAttribute('method') || options.method).toLowerCase();
    const inputs = Array.from(form.querySelectorAll<HTMLInputElement>(options.inputSelector));
    let data: FormData | null;
    const preData: Record<string, any> = {};
    const submitBtn = form.querySelector<HTMLInputElement | HTMLButtonElement>(
        'input[type="submit"], button[type="submit"]',
    );

    const appendData: AppendData = (..._data) => {
        const [key, value] = _data;

        preData[key] = value;
    };

    // form.action - может получить значение инпута с именем action, правильней получать аттрибут
    const send: Send<T> = async (url = form.getAttribute('action') ?? form.action) => {
        if (!(url && typeof url === 'string')) {
            throw new Error('Form does not have "action" attibute and url has not been provided');
        }

        options.onBeforeSend();

        if (['post', 'put', 'delete'].includes(method)) {
            const formData = new FormData(form);

            if (options.data) {
                Object.entries(options.data).forEach((entry) => {
                    formData.append(...entry);
                });
            }

            Object.entries(preData).forEach((entry) => {
                formData.append(...entry);
            });

            data = formData;
        }

        form.classList.add('js-ajax-form--loading');

        form.dispatchEvent(new Event('send'));

        if (submitBtn) {
            submitBtn.disabled = true;
        }

        try {
            let response: FormResponse<T>;

            if (method === 'get') {
                response = await fetch(url, { method }).then((res) => res.json());
            } else {
                response = await fetch(url, { method, body: data, headers: options.headers }).then((res) => res.json());
            }

            Array.from(form.querySelectorAll('.js-form-input-message')).forEach((messageElement) => {
                messageElement.textContent = '';
            });

            if (response.status === 'success') {
                options.onSuccess(response);
                form.dispatchEvent(new CustomEvent('success', { detail: { data: response } }));
                form.classList.add('js-ajax-form--success');

                if (options.shouldClearInputs) {
                    clearInputs(inputs);
                    removeAddedFiles(form);
                }
            } else {
                throw new Error(response.errors?.map((error) => error.message).join('\n') || '');
            }

            return response;
        } catch (err) {
            if (err instanceof Error) {
                options.onError(err);
            }

            form.dispatchEvent(new CustomEvent('error', { detail: { error: err } }));
            form.classList.remove('js-ajax-form--error');

            throw err;
        } finally {
            options.onComplete();
            form.dispatchEvent(new Event('complete'));
            form.classList.remove('js-ajax-form--loading');

            if (submitBtn) {
                submitBtn.disabled = false;
            }
        }
    };

    return { appendData, send, clearInputs: () => clearInputs(inputs) };
};
