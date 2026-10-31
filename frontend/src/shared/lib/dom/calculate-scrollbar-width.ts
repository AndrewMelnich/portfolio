import debounce from 'lodash.debounce';

const CONTAINER_WIDTH = 100;
const DEBOUNCE_TIME = 50;

export default () => {
    const scrollbarWidthOuter = document.createElement('div');

    scrollbarWidthOuter.id = 'scrollbar-width--outer';
    scrollbarWidthOuter.style.cssText = `
        z-index: -9999;
        position: absolute;
        visibility: hidden;
        width: ${CONTAINER_WIDTH}px;
        margin-left: -${CONTAINER_WIDTH}px;
        overflow: scroll;
    `;

    document.body.appendChild(scrollbarWidthOuter);

    const scrollbarWidthInner = document.createElement('div');

    scrollbarWidthInner.id = 'scrollbar-width--inner';
    scrollbarWidthInner.style.width = `${CONTAINER_WIDTH}%`;

    scrollbarWidthOuter.appendChild(scrollbarWidthInner);

    let scrollbarWidthLast = -1;
    let realScrollbarWidthLast = -1;

    const calculateScrollbarWidth = () => {
        const scrollbarWidth = CONTAINER_WIDTH - scrollbarWidthInner.offsetWidth;
        const realScrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);

        if (scrollbarWidthLast !== scrollbarWidth) {
            document.documentElement.style.setProperty('--scrollbar-width', `${scrollbarWidth}px`);
            scrollbarWidthLast = scrollbarWidth;
        }

        if (realScrollbarWidthLast !== realScrollbarWidth) {
            document.documentElement.style.setProperty('--real-scrollbar-width', `${realScrollbarWidth}px`);
            realScrollbarWidthLast = realScrollbarWidth;
        }
    };

    const scheduleCalculate = () => {
        requestAnimationFrame(calculateScrollbarWidth);
    };

    const debouncedCalculate = debounce(calculateScrollbarWidth, DEBOUNCE_TIME);

    const onResize = () => {
        scheduleCalculate();
        debouncedCalculate();
    };

    window.addEventListener('resize', onResize);

    const resizeObserver = new ResizeObserver(scheduleCalculate);

    resizeObserver.observe(document.documentElement);
    resizeObserver.observe(document.body);
    calculateScrollbarWidth();

    return () => {
        window.removeEventListener('resize', onResize);
        debouncedCalculate.cancel();
        resizeObserver.disconnect();
        document.body.removeChild(scrollbarWidthOuter);
    };
};
