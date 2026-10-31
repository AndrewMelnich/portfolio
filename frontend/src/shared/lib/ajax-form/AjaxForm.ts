import { removeButtonLoading, setButtonLoading } from './loading-btn';
import createFormSender from './sender';
import createValidator from './validator';

const SELECTOR = '.js-ajax-form';
const map = new WeakMap<
    HTMLFormElement,
    {
        sender: ReturnType<typeof createFormSender>;
        submitFn: EventListener;
        focusFn: EventListener;
    }
>();

async function init(container: Element | Document = document) {
    const uiMessage = 'Something went wrong';
    const forms = Array.from(container.querySelectorAll<HTMLFormElement>(SELECTOR));

    forms.forEach((form) => {
        let isSubmitting = false;
        const validator = createValidator(form, {
            scrollToInvalidInputOptions: {
                behavior: 'smooth',
                block: 'center',
            },
        });

        const shouldClearInputs = !form.classList.contains('do-not-clear');
        const responseEl = form.querySelector<HTMLElement>('.js-subscribe-form-response');
        const responseTextEl = form.querySelector<HTMLElement>('.js-ajax-form-response-text');
        const responseCloseEl = form.querySelector<HTMLElement>('.js-subscribe-form-response-close');

        responseCloseEl?.addEventListener('click', () => {
            if (responseEl) {
                responseEl.classList.remove('is-opened');
            }
        });

        const sender = createFormSender<{ message: string }>(form, {
            shouldClearInputs,
            headers: {
                ['X-Requested-With']: 'XMLHttpRequest',
            },
            onError: (err) => {
                if (responseTextEl) {
                    responseTextEl.textContent = uiMessage;
                }

                throw err;
            },
            onComplete: () => {
                if (responseEl) {
                    responseEl.classList.add('is-opened');
                }
            },
        });

        function submitFn(event: Event) {
            if (isSubmitting) return;
            event.preventDefault();

            const isFormValid = validator.validate();
            const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]');

            if (isFormValid) {
                isSubmitting = true;

                if (submitBtn) {
                    setButtonLoading(submitBtn);
                }

                sender.send().finally(() => {
                    isSubmitting = false;

                    if (submitBtn) {
                        removeButtonLoading(submitBtn);
                    }
                });
            }
        }

        function onFocus(this: HTMLInputElement) {
            const inputGroup = this.closest<HTMLElement>('.js-input-group');

            if (inputGroup) {
                validator.clearInput(inputGroup);
            }
        }

        validator.inputGroups.forEach((inputGroup) => {
            const input = inputGroup.querySelector<HTMLInputElement>(
                'input[name]:not([type="submit"]):not([type="reset"]):not([type="hidden"]), select[name]:not([type="submit"]):not([type="reset"]):not([type="hidden"]), textarea[name]:not([type="submit"]):not([type="reset"]):not([type="hidden"])',
            );

            input?.addEventListener('focus', onFocus);
        });
        form.addEventListener('submit', submitFn);
        map.set(form, { sender, submitFn, focusFn: onFocus });
    });
}

function destroy(container: Element | Document = document) {
    const forms = Array.from(container.querySelectorAll<HTMLFormElement>(SELECTOR));

    forms.forEach((form) => {
        const data = map.get(form);

        if (data) {
            form.removeEventListener('submit', data.submitFn);
            Array.from(form.querySelectorAll('input')).forEach((input) => {
                input.removeEventListener('focus', data.focusFn);
            });
        }
    });
}

function getInstanceByElement(element: HTMLFormElement) {
    return map.get(element);
}

const _module = {
    init,
    destroy,
    getInstanceByElement,
};

export default _module;
