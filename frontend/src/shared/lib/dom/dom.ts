import { NO_SCROLL_CLASS } from '@/shared/config';

export const getOffsetTop = (el: Element, windowScrollY = window.scrollY, heightOffset = 0): number => {
    return el.getBoundingClientRect().top + windowScrollY - heightOffset;
};

export const wrapElement = (toWrap: Element, wrapper?: HTMLElement) => {
    const _wrapper = wrapper || document.createElement('div');

    toWrap.parentNode?.appendChild(_wrapper);
    _wrapper.appendChild(toWrap);

    return _wrapper;
};

export const isElementInViewport = (el: Element) => {
    const rect = el.getBoundingClientRect();

    return rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth;
};

export function lockBodyScroll() {
    document.documentElement.classList.add(NO_SCROLL_CLASS);
}

export function unlockBodyScroll() {
    document.documentElement.classList.remove(NO_SCROLL_CLASS);
}
