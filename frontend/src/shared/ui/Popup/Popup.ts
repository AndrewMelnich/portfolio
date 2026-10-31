import delegate from 'delegate';
import { NO_SCROLL_CLASS } from '@/shared/config';

const openingTimeoutsMap = new Map<HTMLDialogElement, NodeJS.Timeout>();

const FOCUSABLE_SELECTOR =
    'button:not([disabled]):not([tabindex="-1"]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function getDialogInitialFocus(dialog: HTMLElement): HTMLElement | null {
    const explicit = dialog.querySelector<HTMLElement>('[data-dialog-initial-focus]');

    if (explicit?.matches(FOCUSABLE_SELECTOR)) {
        return explicit;
    }

    const panel = dialog.querySelector('.js-popup-panel') ?? dialog;
    const closeBtn = panel.querySelector<HTMLElement>('[data-dialog-close]');

    if (closeBtn instanceof HTMLElement && closeBtn.matches(FOCUSABLE_SELECTOR)) {
        return closeBtn;
    }

    return panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
}

function getTransitionDurationMs(dialog: HTMLDialogElement): number {
    const duration = parseFloat(getComputedStyle(dialog).getPropertyValue('--transition-duration') || '0.3');

    return Number.isFinite(duration) ? duration * 1000 : 300;
}

function closeDialogAnimated(dialog: HTMLDialogElement) {
    if (!dialog.open || dialog.classList.contains('popup--closing')) {
        return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        dialog.close();

        return;
    }

    const durationMs = getTransitionDurationMs(dialog);

    dialog.classList.add('popup--closing');

    setTimeout(() => {
        dialog.classList.remove('popup--closing');

        if (dialog.open) {
            dialog.close();
        }
    }, durationMs + 1);
}

function observeDialog(dialog: HTMLDialogElement) {
    if (observedDialogs.has(dialog)) {
        return;
    }

    observedDialogs.add(dialog);
    popupMutationObserver.observe(dialog, { attributes: true });

    dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        closeDialogAnimated(dialog);
    });
}

function showDialogElement(dialog: HTMLDialogElement) {
    if (dialog.getAttribute('data-mode') === 'toast') {
        dialog.show();
    } else {
        dialog.showModal();
    }
}

export type OpenDialogOptions = {
    removeOnClose?: boolean;
};

function openDialog(dialog: HTMLDialogElement, options: OpenDialogOptions = {}) {
    observeDialog(dialog);
    showDialogElement(dialog);

    if (options.removeOnClose) {
        dialog.addEventListener(
            'close',
            () => {
                dialog.remove();
            },
            { once: true },
        );
    }
}

function injectDialogHtml(host: HTMLElement, html: string, options: OpenDialogOptions = {}) {
    // eslint-disable-next-line no-unsanitized/method -- trusted server-rendered popup markup
    host.insertAdjacentHTML('beforeend', html);

    const dialog = host.querySelector<HTMLDialogElement>('dialog:last-of-type');

    if (dialog) {
        openDialog(dialog, options);
    }
}

function syncModalScrollLock() {
    const hasOpenModal = Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[data-mode="modal"]')).some(
        (dialog) => dialog.open,
    );

    document.documentElement.classList.toggle(NO_SCROLL_CLASS, hasOpenModal);
}

function shouldSyncHash(dialog: HTMLDialogElement): boolean {
    return Boolean(dialog.id) && !dialog.hasAttribute('data-ignore-hash');
}

const observedDialogs = new WeakSet<HTMLDialogElement>();

const popupMutationObserver = new MutationObserver((recs) => {
    recs.forEach(({ attributeName: attr, target: dial }) => {
        if (dial instanceof HTMLDialogElement && attr === 'open') {
            if (dial.open) {
                dial.dispatchEvent(new Event('popup-open'));

                if (shouldSyncHash(dial)) {
                    history.replaceState(null, '', `#${dial.id}`);
                }

                requestAnimationFrame(() => {
                    getDialogInitialFocus(dial)?.focus({ preventScroll: true });
                });

                const transitionDurationMs = getTransitionDurationMs(dial);

                clearTimeout(openingTimeoutsMap.get(dial));

                if (dial.getAttribute('data-mode') === 'modal') {
                    syncModalScrollLock();
                }

                dial.classList.add('popup--opening');

                openingTimeoutsMap.set(
                    dial,
                    setTimeout(() => {
                        dial.classList.remove('popup--opening');
                    }, transitionDurationMs + 1),
                );
            } else {
                dial.dispatchEvent(new Event('popup-close'));

                if (shouldSyncHash(dial) && window.location.hash === `#${dial.id}`) {
                    history.replaceState(null, '', window.location.pathname + window.location.search);
                }

                clearTimeout(openingTimeoutsMap.get(dial));

                if (dial.getAttribute('data-mode') === 'modal') {
                    syncModalScrollLock();
                }
            }
        }
    });
});

function init() {
    const transitionBehaviorAllowDiscreteNotSupported =
        navigator.userAgent.includes('Firefox') || !CSS.supports('transition-behavior', 'allow-discrete');

    if (transitionBehaviorAllowDiscreteNotSupported) {
        document.documentElement.classList.add('transition-behavior-allow-discrete-not-supported');
    }

    delegate(document, '[data-dialog-open]', 'click', (event: Event & { delegateTarget: HTMLElement }) => {
        const target = event.delegateTarget;
        const dialogId = target.getAttribute('data-dialog-open');

        if (target.getAttribute('data-prevent')) {
            event.preventDefault();
        }

        if (dialogId === null) {
            return;
        }

        const dialog = document.getElementById(dialogId);

        if (dialog instanceof HTMLDialogElement) {
            showDialogElement(dialog);
        }
    });

    delegate(document, '[data-dialog-close]', 'click', (event: Event & { delegateTarget: HTMLElement }) => {
        const target = event.delegateTarget;
        const dialogId = target.getAttribute('data-dialog-close');

        if (target.getAttribute('data-prevent')) {
            event.preventDefault();
        }

        if (dialogId === null) {
            return;
        }

        const dialog = document.getElementById(dialogId);

        if (dialog instanceof HTMLDialogElement) {
            closeDialogAnimated(dialog);
        }
    });

    delegate(document, '.js-popup-outside-close', 'click', (event: Event & { delegateTarget: HTMLElement }) => {
        const target = event.delegateTarget;
        const dialogId = target.getAttribute('data-dialog-close');
        const dialog = dialogId ? document.getElementById(dialogId) : target.closest('dialog');

        if (target.getAttribute('data-prevent')) {
            event.preventDefault();
        }

        if (dialog instanceof HTMLDialogElement) {
            closeDialogAnimated(dialog);
        }
    });

    delegate(document, 'dialog', 'click', (event: Event & { delegateTarget: HTMLElement }) => {
        const target = event.target;
        const delegateTarget = event.delegateTarget;

        if (
            delegateTarget instanceof HTMLDialogElement &&
            delegateTarget.getAttribute('closed-by') === 'any' &&
            delegateTarget === target
        ) {
            closeDialogAnimated(delegateTarget);
        }
    });

    document.querySelectorAll('dialog').forEach((dial) => {
        if (dial instanceof HTMLDialogElement) {
            observeDialog(dial);
        }
    });

    if (window.location.hash) {
        setTimeout(() => {
            const dialog = document.getElementById(window.location.hash.slice(1));

            if (dialog instanceof HTMLDialogElement) {
                showDialogElement(dialog);
            }
        }, 0);
    }
}

export default { init, observeDialog, closeDialogAnimated, openDialog, injectDialogHtml };
