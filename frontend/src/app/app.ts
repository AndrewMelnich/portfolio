import { initCaseCardTransition } from '@/entities/case';
import { calculateScrollbarWidth, vhMobileFix } from '@/shared/lib/dom';
import { initPress } from '@/shared/lib/press';
import reveal from '@/shared/lib/reveal';

document.documentElement.classList.add('js-ready');

calculateScrollbarWidth();
vhMobileFix();
initPress();
initCaseCardTransition();
reveal.init();

const SMOOTH_SCROLL_CLASS = 'is-smooth-scroll';
const CASES_LIST_SCROLL_KEY = 'cases-list-scroll:';
const nativeScrollTo = window.scrollTo.bind(window);

let suppressTransitionScroll = false;
let pendingScroll: { left: number; top: number } | null = null;
let navigationType: string | null = null;
let fromPath: string | null = null;

function casesPathIndex(pathname: string) {
    return pathname.split('/').filter(Boolean).indexOf('cases');
}

function isCasesIndexPath(pathname: string) {
    const parts = pathname.split('/').filter(Boolean);
    const casesIndex = casesPathIndex(pathname);

    return casesIndex >= 0 && parts.length === casesIndex + 1;
}

function isCaseDetailPath(pathname: string) {
    const parts = pathname.split('/').filter(Boolean);
    const casesIndex = casesPathIndex(pathname);

    return casesIndex >= 0 && parts.length === casesIndex + 2;
}

function casesListScrollKey(pathname: string) {
    return `${CASES_LIST_SCROLL_KEY}${pathname}`;
}

function saveCasesListScroll(pathname: string) {
    if (!isCasesIndexPath(pathname)) {
        return;
    }

    sessionStorage.setItem(casesListScrollKey(pathname), String(window.scrollY));
}

function lockInstantScroll() {
    const root = document.documentElement;

    root.classList.remove(SMOOTH_SCROLL_CLASS);
    root.style.scrollBehavior = 'auto';
}

// fallow-ignore-next-line complexity -- scrollTo overload: options object vs x/y args
function readScrollPoint(args: unknown[]): { left: number; top: number } {
    const [first, second] = args;

    if (first && typeof first === 'object') {
        const { left = window.scrollX, top = window.scrollY } = first as ScrollToOptions;

        return { left, top };
    }

    return { left: Number(first ?? 0), top: Number(second ?? 0) };
}

window.scrollTo = ((...args: unknown[]) => {
    if (suppressTransitionScroll) {
        pendingScroll = readScrollPoint(args);

        return;
    }

    Reflect.apply(nativeScrollTo, window, args);
}) as typeof window.scrollTo;

function isSamePageHashLink(link: HTMLAnchorElement) {
    const url = new URL(link.href, window.location.href);

    return url.pathname === window.location.pathname && url.hash.length > 1;
}

function armSmoothScrollForHash() {
    const root = document.documentElement;

    root.classList.add(SMOOTH_SCROLL_CLASS);
    root.style.scrollBehavior = 'smooth';

    const clear = () => {
        lockInstantScroll();
        window.removeEventListener('scrollend', clear);
    };

    if ('onscrollend' in window) {
        window.addEventListener('scrollend', clear, { once: true });
    }

    window.setTimeout(clear, 1000);
}

function scrollToHashTarget() {
    const id = window.location.hash.slice(1);
    const target = id ? document.getElementById(id) : null;

    if (!target) {
        return false;
    }

    target.scrollIntoView({ behavior: 'instant', block: 'start' });

    return true;
}

function scrollInstant(point: { left: number; top: number }) {
    nativeScrollTo({ left: point.left, top: point.top, behavior: 'instant' });
}

function shouldRestoreCasesListScroll(type: string | null, previousPath: string | null) {
    return type === 'traverse' || isCaseDetailPath(previousPath ?? '');
}

// fallow-ignore-next-line complexity -- cases list restore: path + nav type + stored Y
function restoreCasesListScroll(type: string | null, previousPath: string | null) {
    const pathname = window.location.pathname;

    if (!isCasesIndexPath(pathname) || !shouldRestoreCasesListScroll(type, previousPath)) {
        return;
    }

    const top = Number(sessionStorage.getItem(casesListScrollKey(pathname)));

    if (!Number.isFinite(top) || top <= 0) {
        return;
    }

    scrollInstant({ left: 0, top });
}

// fallow-ignore-next-line complexity -- soft-nav restore: traverse → hash → pending
function applyPendingScroll() {
    suppressTransitionScroll = false;

    const next = pendingScroll;
    const type = navigationType;

    pendingScroll = null;
    navigationType = null;

    if (type === 'traverse' && next) {
        scrollInstant(next);

        return;
    }

    if (!scrollToHashTarget() && next) {
        scrollInstant(next);
    }
}

lockInstantScroll();

document.addEventListener(
    'click',
    (event) => {
        const target = event.target;

        if (!(target instanceof Element)) {
            return;
        }

        const link = target.closest('a[href]');

        if (!(link instanceof HTMLAnchorElement) || !isSamePageHashLink(link)) {
            return;
        }

        armSmoothScrollForHash();
    },
    true,
);

document.addEventListener('astro:before-preparation', (event) => {
    saveCasesListScroll(window.location.pathname);
    fromPath = window.location.pathname;
    suppressTransitionScroll = true;
    pendingScroll = null;
    navigationType = 'navigationType' in event ? String(event.navigationType) : null;
    lockInstantScroll();
});

document.addEventListener('astro:before-swap', (event) => {
    suppressTransitionScroll = true;
    lockInstantScroll();
    reveal.prepareIncomingDocument(event.newDocument);
});

document.addEventListener('astro:after-swap', () => {
    lockInstantScroll();
    document.documentElement.classList.remove('no-js');
    document.documentElement.classList.add('js');
    reveal.veil();
    reveal.prepareAll();
});

document.addEventListener('astro:page-load', () => {
    const type = navigationType;
    const previousPath = fromPath;

    lockInstantScroll();
    applyPendingScroll();
    restoreCasesListScroll(type, previousPath);
    fromPath = null;
    void reveal.startAfterTransitions();
});
