import delegate from 'delegate';

export const OPENED_CLASS = 'collapse--opened';
export const TRIGGER_SELECTOR = '.js-collapse-trigger';
export const CONTAINER_SELECTOR = '.js-collapse';

export function toggleCollapse(collapseEl: HTMLElement) {
    const trigger = collapseEl.querySelector<HTMLElement>(TRIGGER_SELECTOR);

    collapseEl.classList.toggle(OPENED_CLASS);

    const isOpened = collapseEl.classList.contains(OPENED_CLASS);

    if (trigger) {
        trigger.setAttribute('aria-expanded', String(isOpened));
    }

    if (isOpened) {
        collapseEl.dispatchEvent(new Event('expanded'));
    } else {
        collapseEl.dispatchEvent(new Event('collapsed'));
    }
}

function init(container: Element | Document = document) {
    delegate(container, TRIGGER_SELECTOR, 'click', (event: { delegateTarget: EventTarget | null }) => {
        const target = event.delegateTarget;

        if (!(target instanceof HTMLElement)) return;

        const collapseEl = target.closest<HTMLElement>(CONTAINER_SELECTOR);

        if (collapseEl) {
            toggleCollapse(collapseEl);
        }
    });
}

export default { init };
