const selector = '[data-reveal]';
const charSelector = '.js-reveal-char';
const spaceClass = 'js-reveal-space';
const charClassName = 'js-reveal-char reveal-char';
const preparedAttr = 'revealPrepared';
const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

type MotionMode = 'enter' | 'explode';

const revealTimeouts = new WeakMap<HTMLElement, number>();
let listenersBound = false;
let activePath: string | null = null;
let startToken = 0;

function handleRevealEntry(entry: IntersectionObserverEntry) {
    if (!(entry.target instanceof HTMLElement)) {
        return;
    }

    const element = entry.target;
    const revealed = element.classList.contains('is-revealed');

    if (entry.isIntersecting === revealed) {
        return;
    }

    if (entry.isIntersecting) {
        settleElement(element);
    } else {
        explodeElement(element);
    }
}

const observer = new IntersectionObserver((entries) => entries.forEach(handleRevealEntry), {
    threshold: 0,
    rootMargin: '0px',
});

function prefersReducedMotion() {
    return matchMedia(reducedMotionQuery).matches;
}

function isScatter(value: string | undefined) {
    return value === 'scatter' || value === 'scatter-instant';
}

function isInstant(value: string | undefined) {
    return value === 'instant' || value === 'scatter-instant';
}

function isSticky(element: HTMLElement) {
    return element.dataset.revealSticky === '' || element.dataset.revealSticky === 'true';
}

function randomOffset(min: number, max: number) {
    return min + Math.random() * (max - min);
}

function forceReflow(element: HTMLElement) {
    void element.offsetWidth;
}

function clearRevealTimeout(element: HTMLElement) {
    const timeoutId = revealTimeouts.get(element);

    if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        revealTimeouts.delete(element);
    }
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

function armRevealed(element: HTMLElement) {
    element.classList.remove('is-exploding');
    element.classList.remove('is-revealed');
    element.classList.remove('is-reveal-complete');
    forceReflow(element);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            markComplete(element);
            element.classList.add('is-revealed');
        });
    });
}

function revealElement(element: HTMLElement) {
    clearRevealTimeout(element);

    const delay = parseFloat(element.dataset.revealDelay || '0') * 1000;
    const timeoutId = window.setTimeout(() => {
        revealTimeouts.delete(element);
        armRevealed(element);
    }, delay);

    revealTimeouts.set(element, timeoutId);
}

const CHAR_MOTION = {
    enter: { rx: [12, 24], ry: [-28, 28], rr: [8, 14] },
    explode: { rx: [40, 110], ry: [-100, 100], rr: [18, 42] },
} as const;

function applyCharMotion(char: HTMLElement, index: number, reduce: boolean, mode: MotionMode) {
    char.style.setProperty('--i', String(index));

    if (reduce || char.classList.contains(spaceClass)) {
        char.style.setProperty('--rx', '0px');
        char.style.setProperty('--ry', '0px');
        char.style.setProperty('--rr', '0deg');

        return;
    }

    const side = Math.random() < 0.5 ? -1 : 1;
    const range = CHAR_MOTION[mode];

    char.style.setProperty('--rx', `${side * randomOffset(range.rx[0], range.rx[1])}px`);
    char.style.setProperty('--ry', `${randomOffset(range.ry[0], range.ry[1])}px`);
    char.style.setProperty('--rr', `${side * randomOffset(range.rr[0], range.rr[1])}deg`);
}

function refreshCharMotion(element: HTMLElement, mode: MotionMode) {
    const reduce = prefersReducedMotion();
    const chars = element.querySelectorAll<HTMLElement>(charSelector);

    chars.forEach((char, index) => {
        applyCharMotion(char, index, reduce, mode);
    });

    element.style.setProperty('--n', String(Math.max(chars.length - 1, 0)));
}

function settleElement(element: HTMLElement) {
    if (isScatter(element.dataset.reveal)) {
        refreshCharMotion(element, 'enter');
    }

    revealElement(element);
}

function explodeElement(element: HTMLElement) {
    clearRevealTimeout(element);

    if (prefersReducedMotion()) {
        element.classList.remove('is-revealed');
        element.classList.remove('is-reveal-complete');

        return;
    }

    if (isScatter(element.dataset.reveal)) {
        refreshCharMotion(element, 'explode');
    }

    element.classList.add('is-exploding');
    element.classList.remove('is-reveal-complete');
    element.classList.remove('is-revealed');
}

function createChar(char: string, index: number, reduce: boolean) {
    const span = document.createElement('span');

    span.className = charClassName;
    span.textContent = char;
    span.setAttribute('aria-hidden', 'true');
    applyCharMotion(span, index, reduce, 'enter');

    return span;
}

function measureWordWidths(element: HTMLElement, words: string[]) {
    if (!element.isConnected || words.length === 0) {
        return words.map(() => 0);
    }

    const probe = document.createElement('span');
    const styles = getComputedStyle(element);

    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;white-space:nowrap;';
    probe.style.font = styles.font;
    probe.style.letterSpacing = styles.letterSpacing;
    probe.style.textTransform = styles.textTransform;
    probe.style.wordSpacing = styles.wordSpacing;
    element.append(probe);

    const widths = words.map((word) => {
        probe.textContent = word;

        return probe.getBoundingClientRect().width;
    });

    probe.remove();

    return widths;
}

function createWord(wordText: string, startIndex: number, reduce: boolean, widthPx: number) {
    const word = document.createElement('span');

    word.className = 'reveal-word';
    word.setAttribute('aria-hidden', 'true');

    if (widthPx > 0) {
        word.style.width = `${widthPx}px`;
    }

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
    const words = text.split(' ');
    const widths = measureWordWidths(element, words);
    const fragment = document.createDocumentFragment();
    let index = 0;

    words.forEach((wordText, wordIndex) => {
        if (wordIndex > 0) {
            fragment.append(document.createTextNode(' '));
        }

        const { word, nextIndex } = createWord(wordText, index, reduce, widths[wordIndex] ?? 0);

        fragment.append(word);
        index = nextIndex;
    });

    element.replaceChildren(fragment);
    element.style.setProperty('--n', String(Math.max(index - 1, 0)));
    element.dataset[preparedAttr] = 'true';
}

function prepare(element: HTMLElement) {
    if (!isScatter(element.dataset.reveal)) {
        return;
    }

    if (element.dataset[preparedAttr] === 'true') {
        refreshCharMotion(element, 'enter');

        return;
    }

    splitScatter(element);
}

function collectRevealElements(root: Element | Document) {
    const elements: HTMLElement[] = [];

    if (root instanceof HTMLElement && root.matches(selector)) {
        elements.push(root);
    }

    elements.push(...Array.from(root.querySelectorAll<HTMLElement>(selector)));

    return [...new Set(elements)];
}

function prepareAll(container: Element | Document = document) {
    collectRevealElements(container).forEach((element) => {
        if (isSticky(element)) {
            return;
        }

        clearRevealTimeout(element);
        observer.unobserve(element);
        element.classList.remove('is-revealed');
        element.classList.remove('is-reveal-complete');
        element.classList.remove('is-exploding');
        prepare(element);
    });
}

function prepareIncomingDocument(doc: Document) {
    doc.documentElement.classList.remove('no-js');
    doc.documentElement.classList.add('js');
}

function resetRevealState(element: HTMLElement) {
    clearRevealTimeout(element);
    observer.unobserve(element);
    element.classList.remove('is-revealed');
    element.classList.remove('is-reveal-complete');
    element.classList.remove('is-exploding');
}

function replayElement(element: HTMLElement) {
    resetRevealState(element);

    if (isScatter(element.dataset.reveal)) {
        if (element.dataset[preparedAttr] === 'true') {
            refreshCharMotion(element, 'enter');
        } else {
            prepare(element);
        }
    }

    settleElement(element);

    if (!isSticky(element)) {
        observer.observe(element);
    }
}

function replayIn(root: Element | Document, onlyHidden = false) {
    collectRevealElements(root).forEach((element) => {
        if (isSticky(element)) {
            return;
        }

        if (onlyHidden && element.classList.contains('is-revealed')) {
            return;
        }

        replayElement(element);
    });
}

function revealHashTarget(onlyHidden = false) {
    const id = window.location.hash.slice(1);

    if (!id) {
        return;
    }

    const target = document.getElementById(id);

    if (!target) {
        return;
    }

    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
            replayIn(target, onlyHidden);
        });
    });
}

function samePageHashLink(link: HTMLAnchorElement) {
    const url = new URL(link.href, window.location.href);

    return url.pathname === window.location.pathname && url.hash.length > 1;
}

function bindListeners() {
    if (listenersBound) {
        return;
    }

    listenersBound = true;

    window.addEventListener('hashchange', () => {
        revealHashTarget(true);
    });

    document.addEventListener(
        'click',
        (event) => {
            const target = event.target;

            if (!(target instanceof Element)) {
                return;
            }

            const link = target.closest('a[href]');

            if (!(link instanceof HTMLAnchorElement) || !samePageHashLink(link)) {
                return;
            }

            window.setTimeout(() => {
                revealHashTarget(true);
            }, 0);
        },
        true,
    );
}

function waitForViewTransitions() {
    const animations = document.documentElement.getAnimations({ subtree: true }).filter((animation) => {
        const effect = animation.effect;

        if (!(effect instanceof KeyframeEffect)) {
            return false;
        }

        return Boolean(effect.pseudoElement?.includes('view-transition'));
    });

    if (animations.length === 0) {
        return Promise.resolve();
    }

    return Promise.allSettled(animations.map((animation) => animation.finished)).then(() => undefined);
}

function init(container: Element | Document = document) {
    bindListeners();

    const path = window.location.pathname;

    if (activePath === path) {
        if (window.location.hash) {
            revealHashTarget(true);
        }

        return;
    }

    activePath = path;

    const elements = collectRevealElements(container);

    elements.forEach((el) => {
        clearRevealTimeout(el);
        observer.unobserve(el);
        el.classList.remove('is-revealed');
        el.classList.remove('is-reveal-complete');
        el.classList.remove('is-exploding');
        prepare(el);

        if (isInstant(el.dataset.reveal)) {
            revealElement(el);
        }

        if (!isSticky(el)) {
            observer.observe(el);
        }
    });

    if (window.location.hash) {
        window.setTimeout(() => {
            revealHashTarget(true);
        }, 40);
    }
}

async function startAfterTransitions(container: Element | Document = document) {
    const token = ++startToken;

    await waitForViewTransitions();

    if (token !== startToken) {
        return;
    }

    init(container);
}

function veil(container: Element | Document = document) {
    if (activePath === window.location.pathname) {
        return;
    }

    collectRevealElements(container).forEach((el) => {
        if (isSticky(el)) {
            return;
        }

        clearRevealTimeout(el);
        observer.unobserve(el);
        el.classList.remove('is-revealed');
        el.classList.remove('is-reveal-complete');
        el.classList.remove('is-exploding');
        prepare(el);
    });
}

function destroy(container: Element | Document = document) {
    collectRevealElements(container).forEach((el) => {
        clearRevealTimeout(el);
        observer.unobserve(el);
    });
}

function reinit(container: Element | Document = document) {
    destroy(container);

    window.setTimeout(() => {
        collectRevealElements(container).forEach((el) => {
            el.classList.remove('is-revealed');
            el.classList.remove('is-reveal-complete');
            el.classList.remove('is-exploding');
        });
    }, 1);

    window.setTimeout(() => {
        init(container);
    }, 2);
}

const _module = {
    init,
    veil,
    destroy,
    reinit,
    replayIn,
    prepareAll,
    prepareIncomingDocument,
    startAfterTransitions,
};

export default _module;
