import { sanitizeHtml } from '@/shared/lib/utils';

const loaderTemplate = `<span class="loader"></span>`;

export function setButtonLoading(el: HTMLButtonElement | HTMLAnchorElement) {
    const textEl = el.querySelector('[data-loader-el]');
    const rect = el.getBoundingClientRect();

    if (el instanceof HTMLButtonElement) {
        el.disabled = true;
    } else {
        el.classList.add('is-disabled');
    }

    Object.assign(el.style, { width: `${rect.width}px`, height: `${rect.height}px` });
    el.dataset.actualText = el.innerHTML || '';

    if (textEl) {
        textEl.innerHTML = sanitizeHtml(loaderTemplate);
    }
}

export function removeButtonLoading(el: HTMLButtonElement | HTMLAnchorElement) {
    const textEl = el.querySelector('[data-loader-el]');

    if (el instanceof HTMLButtonElement) {
        el.disabled = false;
    } else {
        el.classList.remove('is-disabled');
    }

    Object.assign(el.style, { width: '', height: '' });

    if (textEl) {
        textEl.innerHTML = sanitizeHtml(el.dataset.actualText || '');
    }

    el.removeAttribute('data-actual-text');
}
