function classSelector(element: Element) {
    return element.className
        .split(' ')
        .map((className) => `.${className}`)
        .join();
}

function clickMissesElement(target: HTMLElement, element: Element) {
    const closest = target.closest(classSelector(element));

    return !closest || closest !== element;
}

export function onOutsideClick(
    element: Element | Element[],
    callback: () => void,
    event: 'click' | 'mousedown' | 'mouseup' = 'click',
) {
    const handleOutsideClick = (event: Event) => {
        const target = event.target;

        if (!(target instanceof HTMLElement)) return;

        const elements = Array.isArray(element) ? element : [element];

        if (elements.every((item) => clickMissesElement(target, item))) {
            callback();
        }
    };

    document.documentElement.addEventListener(event, handleOutsideClick);

    return () => document.documentElement.removeEventListener(event, handleOutsideClick);
}
