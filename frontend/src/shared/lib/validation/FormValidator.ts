import { z } from 'zod';

const DEFAULTS = {
    INPUT_SELECTOR: '.js-form-input',
    MESSAGE_SELECTOR: '.js-form-message',
    DATA_FIELD_ATTR: 'data-field',
    ERROR_CLASS: 'is-error',
};

type Config = typeof DEFAULTS;

export class FormValidator {
    config: Config;
    controller = new AbortController();

    constructor(
        public readonly form: HTMLFormElement,
        config: Partial<Config> = {},
    ) {
        this.config = { ...DEFAULTS, ...config };

        form.noValidate = true;

        Array.from(form.querySelectorAll(this.config.INPUT_SELECTOR)).forEach((el) => {
            el.addEventListener(
                'focus',
                (event) => {
                    const input = event.target;

                    if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return;

                    this.clearError(input.name);
                },
                { signal: this.controller.signal },
            );
        });
    }

    validate<T extends z.ZodTypeAny>(schema: T): z.infer<T> | false {
        this.clearErrors();

        const formData = new FormData(this.form);
        const data = Object.fromEntries(formData.entries());

        try {
            return schema.parse(data);
        } catch (error) {
            if (error instanceof z.ZodError) {
                error.issues.forEach((err) => {
                    const field = err.path[0];

                    this.showError(String(field), err.message);
                });
            }

            return false;
        }
    }

    clearError(field: string) {
        const errorEl = this.form.querySelector<HTMLElement>(`[${this.config.DATA_FIELD_ATTR}="${field}"]`);

        if (errorEl) {
            errorEl.textContent = '';
            errorEl.classList.remove(this.config.ERROR_CLASS);
        }
    }

    clearErrors() {
        const errorMessages = this.form.querySelectorAll<HTMLElement>(this.config.MESSAGE_SELECTOR);

        errorMessages.forEach((el) => {
            const field = el.getAttribute(this.config.DATA_FIELD_ATTR);

            if (field) {
                this.clearError(field);
            }
        });
    }

    showError(field: string, message: string) {
        const errorEl = this.form.querySelector<HTMLElement>(`[${this.config.DATA_FIELD_ATTR}="${field}"]`);

        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.add(this.config.ERROR_CLASS);
        }
    }

    destroy() {
        this.controller.abort();
    }
}
