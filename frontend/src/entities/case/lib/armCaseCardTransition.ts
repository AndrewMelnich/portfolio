const BOUND_KEY = '__caseCardTransitionBound';

type BoundWindow = Window & {
    [BOUND_KEY]?: boolean;
};

function caseSlugFromCard(card: HTMLElement) {
    return card.dataset.caseSlug || null;
}

function armCard(card: HTMLElement) {
    const slug = caseSlugFromCard(card);

    if (!slug) {
        return;
    }

    const image = card.querySelector('.js-case-card__image');
    const title = card.querySelector('.js-case-card__title');

    if (image instanceof HTMLElement) {
        image.style.viewTransitionName = `case-image-${slug}`;
    }

    if (title instanceof HTMLElement) {
        title.style.viewTransitionName = `case-title-${slug}`;
    }
}

function findCaseCard(target: EventTarget | null) {
    if (!(target instanceof Element)) {
        return null;
    }

    const card = target.closest('.js-case-card');

    return card instanceof HTMLElement ? card : null;
}

function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) {
        return;
    }

    const card = findCaseCard(event.target);

    if (card) {
        armCard(card);
    }
}

function onClick(event: MouseEvent) {
    const card = findCaseCard(event.target);

    if (card) {
        armCard(card);
    }
}

export function initCaseCardTransition() {
    const root = window as BoundWindow;

    if (root[BOUND_KEY]) {
        return;
    }

    root[BOUND_KEY] = true;
    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('click', onClick, true);
}
