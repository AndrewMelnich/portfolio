type DragScrollHandlers = {
    mousedown: (event: Event) => void;
    mousemove: (event: Event) => void;
    mouseup: () => void;
};

const dragScrollHandlers = new WeakMap<HTMLElement, DragScrollHandlers>();

function bindDragScroll(element: HTMLElement) {
    let isDragging = false;
    let startX = 0;
    let scrollLeft = 0;

    const handleMouseDown = (event: Event) => {
        if (!(event instanceof MouseEvent)) return;

        isDragging = true;
        startX = event.pageX - element.offsetLeft;
        scrollLeft = element.scrollLeft;
        element.style.cursor = 'grabbing';
        event.preventDefault();
    };

    const handleMouseMove = (event: Event) => {
        if (!isDragging || !(event instanceof MouseEvent)) return;

        const x = event.pageX - element.offsetLeft;
        const walkX = (x - startX) * 1.5;

        element.scrollLeft = scrollLeft - walkX;
    };

    const handleMouseUp = () => {
        isDragging = false;
        element.style.cursor = 'grab';
    };

    element.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    dragScrollHandlers.set(element, {
        mousedown: handleMouseDown,
        mousemove: handleMouseMove,
        mouseup: handleMouseUp,
    });
}

function unbindDragScroll(element: HTMLElement) {
    const handlers = dragScrollHandlers.get(element);

    if (!handlers) return;

    element.removeEventListener('mousedown', handlers.mousedown);
    document.removeEventListener('mousemove', handlers.mousemove);
    document.removeEventListener('mouseup', handlers.mouseup);
    dragScrollHandlers.delete(element);
}

function init(container: Element | Document = document) {
    container.querySelectorAll('.js-drag-scroll').forEach((element) => {
        if (element instanceof HTMLElement) bindDragScroll(element);
    });
}

function destroy() {
    document.querySelectorAll('.js-drag-scroll').forEach((element) => {
        if (element instanceof HTMLElement) unbindDragScroll(element);
    });
}

const _module = { init, destroy };

export default _module;
