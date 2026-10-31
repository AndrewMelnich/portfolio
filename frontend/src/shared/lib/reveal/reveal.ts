const selector = '[data-reveal]';
const charSelector = '.js-reveal-char';
const spaceClass = 'js-reveal-space';
const charClassName = 'js-reveal-char reveal-char';
const spaceClassName = 'js-reveal-char js-reveal-space reveal-char reveal-space';
const preparedAttr = 'revealPrepared';
const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

const observer = new IntersectionObserver(
    (entries, obs) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) {
                return;
            }

            obs.unobserve(entry.target);

            const element = entry.target;

            if (!(element instanceof HTMLElement)) {
                return;
            }

            revealElement(element);
        });
    },
    { threshold: 0, rootMargin: '-10% 0px -10% 0px' },
);

function prefersReducedMotion() {
    return matchMedia(reducedMotionQuery).matches;
}

function isScatter(value: string | undefined) {
    return value === 'scatter' || value === 'scatter-instant';
}

function isInstant(value: string | undefined) {
    return value === 'instant' || value === 'scatter-instant';
}

function randomOffset(min: number, max: number) {
    return min + Math.random() * (max - min);
}

function markComplete(element: HTMLElement) {
    if (prefersReducedMotion()) {
        element.classList.add('is-reveal-complete');

        return;
    }

    const chars = element.querySelectorAll(`${charSelector}:not(.${spaceClass})`);
    const target = chars.length > 0 ? chars[chars.length - 1]! : element;

    target.addEventListener(
        'transitionend',
        () => {
            element.classList.add('is-reveal-complete');
        },
        { once: true },
    );
}

function revealElement(element: HTMLElement) {
    const delay = parseFloat(element.dataset.revealDelay || '0') * 1000;

    window.setTimeout(() => {
        markComplete(element);
        element.classList.add('is-revealed');
    }, delay);
}

function applyCharMotion(char: HTMLElement, index: number, reduce: boolean) {
    char.style.setProperty('--i', String(index));

    if (reduce || char.classList.contains(spaceClass)) {
        char.style.setProperty('--rx', '0px');
        char.style.setProperty('--ry', '0px');
        char.style.setProperty('--rr', '0deg');

        return;
    }

    const side = Math.random() < 0.5 ? -1 : 1;

    char.style.setProperty('--rx', `${side * randomOffset(12, 24)}px`);
    char.style.setProperty('--ry', `${randomOffset(-28, 28)}px`);
    char.style.setProperty('--rr', `${side * randomOffset(8, 14)}deg`);
}

function createChar(char: string, index: number, reduce: boolean, space = false) {
    const span = document.createElement('span');

    span.className = space ? spaceClassName : charClassName;
    span.textContent = space ? '\u00a0' : char;
    span.setAttribute('aria-hidden', 'true');
    applyCharMotion(span, index, reduce);

    return span;
}

function createWord(wordText: string, startIndex: number, reduce: boolean) {
    const word = document.createElement('span');

    word.className = 'reveal-word';
    word.setAttribute('aria-hidden', 'true');

    let index = startIndex;

    for (const char of wordText) {
        word.append(createChar(char, index, reduce));
        index += 1;
    }

    return { word, nextIndex: index };
}

function normalizeRevealText(element: HTMLElement) {
    const raw = element.getAttribute('aria-label') ?? element.textContent ?? '';

    return raw.trim().replace(/\s+/g, ' ');
}

function splitScatter(element: HTMLElement) {
    const text = normalizeRevealText(element);

    if (!text) {
        return;
    }

    element.setAttribute('aria-label', text);

    const reduce = prefersReducedMotion();
    const fragment = document.createDocumentFragment();
    const words = text.split(' ');
    let index = 0;

    words.forEach((wordText, wordIndex) => {
        if (wordIndex > 0) {
            fragment.append(createChar(' ', index, reduce, true));
            index += 1;
        }

        const { word, nextIndex } = createWord(wordText, index, reduce);

        fragment.append(word);
        index = nextIndex;
    });

    element.replaceChildren(fragment);
    element.dataset[preparedAttr] = 'true';
}

function prepare(element: HTMLElement) {
    if (!isScatter(element.dataset.reveal)) {
        return;
    }

    splitScatter(element);
}

function init(container: Element | Document = document) {
    const elements = Array.from(container.querySelectorAll<HTMLElement>(selector));

    elements.forEach((el) => {
        observer.unobserve(el);
        el.classList.remove('is-revealed');
        el.classList.remove('is-reveal-complete');
        prepare(el);

        if (isInstant(el.dataset.reveal)) {
            revealElement(el);
        } else {
            observer.observe(el);
        }
    });
}

function veil(container: Element | Document = document) {
    const elements = Array.from(container.querySelectorAll<HTMLElement>(selector));

    elements.forEach((el) => {
        observer.unobserve(el);
        el.classList.remove('is-revealed');
        el.classList.remove('is-reveal-complete');
    });
}

function destroy(container: Element | Document = document) {
    const elements = Array.from(container.querySelectorAll<HTMLElement>(selector));

    elements.forEach((el) => {
        observer.unobserve(el);
    });
}

function reinit(container: Element | Document = document) {
    destroy(container);

    window.setTimeout(() => {
        const elements = Array.from(container.querySelectorAll<HTMLElement>(selector));

        elements.forEach((el) => {
            el.classList.remove('is-revealed');
            el.classList.remove('is-reveal-complete');
        });
    }, 1);

    window.setTimeout(() => {
        init(container);
    }, 2);
}

const _module = { init, veil, destroy, reinit };

export default _module;
