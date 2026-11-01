const BOUND_KEY = '__caseCardTransitionBound';
const IMAGE_TRANSITION = 'case-active-image';

type BoundWindow = Window & {
    [BOUND_KEY]?: boolean;
};

function caseSlugFromCard(card: HTMLElement) {
    return card.dataset.caseSlug || null;
}

function caseSlugFromPath(pathname: string) {
    const parts = pathname.split('/').filter(Boolean);
    const casesIndex = parts.indexOf('cases');

    if (casesIndex < 0 || parts.length !== casesIndex + 2) {
        return null;
    }

    return parts[casesIndex + 1] ?? null;
}

function disarmCaseCards(root: ParentNode = document) {
    root.querySelectorAll<HTMLElement>('.js-case-card__image').forEach((element) => {
        element.style.removeProperty('view-transition-name');
    });
}

function setCardTransitionNames(card: HTMLElement) {
    const image = card.querySelector('.js-case-card__image');

    if (image instanceof HTMLElement) {
        image.style.viewTransitionName = IMAGE_TRANSITION;
    }
}

function armCard(card: HTMLElement) {
    if (!caseSlugFromCard(card)) {
        return;
    }

    disarmCaseCards(card.ownerDocument ?? document);
    setCardTransitionNames(card);
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

// fallow-ignore-next-line complexity -- back-nav arm: slug parse → card lookup → eager image
export function armIncomingCaseCard(doc: Document, fromPathname: string | null) {
    const slug = fromPathname ? caseSlugFromPath(fromPathname) : null;

    if (!slug) {
        return false;
    }

    const card = doc.querySelector(`[data-case-slug="${slug}"]`);

    if (!(card instanceof HTMLElement)) {
        return false;
    }

    disarmCaseCards(doc);
    setCardTransitionNames(card);

    const image = card.querySelector('.js-case-card__image');

    if (image instanceof HTMLImageElement) {
        image.loading = 'eager';
    }

    return true;
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
