const PRESSED_CLASS = 'is-pressed';
const RELEASE_CLEAR_MS = 400;
const BOUND_KEY = '__pressBound';
const PRESS_SELECTOR = '[data-press]';

let clearTimer = 0;

type PressBoundWindow = Window & {
    [BOUND_KEY]?: boolean;
};

function clearPressed() {
    document.querySelectorAll(PRESS_SELECTOR).forEach((element) => {
        element.classList.remove(PRESSED_CLASS);
    });
}

function scheduleClear() {
    window.clearTimeout(clearTimer);
    clearTimer = window.setTimeout(clearPressed, RELEASE_CLEAR_MS);
}

function isPressBlocked(element: HTMLElement) {
    return element.matches(':disabled, [aria-disabled="true"]') || Boolean(element.closest('[aria-disabled="true"]'));
}

function findPressTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) {
        return null;
    }

    const element = target.closest(PRESS_SELECTOR);

    if (!(element instanceof HTMLElement) || isPressBlocked(element)) {
        return null;
    }

    return element;
}

function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) {
        return;
    }

    const card = findPressTarget(event.target);

    if (!card) {
        return;
    }

    window.clearTimeout(clearTimer);
    clearPressed();
    card.classList.add(PRESSED_CLASS);
}

function onPointerUp(event: PointerEvent) {
    const card = findPressTarget(event.target);

    if (card?.classList.contains(PRESSED_CLASS)) {
        scheduleClear();

        return;
    }

    window.clearTimeout(clearTimer);
    clearPressed();
}

function onPointerCancel() {
    window.clearTimeout(clearTimer);
    clearPressed();
}

function onBeforePreparation() {
    window.clearTimeout(clearTimer);
}

function onAfterSwap() {
    window.clearTimeout(clearTimer);
    clearPressed();
}

export function initPress() {
    const root = window as PressBoundWindow;

    if (root[BOUND_KEY]) {
        return;
    }

    root[BOUND_KEY] = true;
    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('pointerup', onPointerUp, { passive: true });
    document.addEventListener('pointercancel', onPointerCancel, { passive: true });
    document.addEventListener('astro:before-preparation', onBeforePreparation);
    document.addEventListener('astro:after-swap', onAfterSwap);
}
