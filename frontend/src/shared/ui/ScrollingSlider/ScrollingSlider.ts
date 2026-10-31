const DRAG_CLICK_THRESHOLD = 5;
const DRAG_SNAP_THRESHOLD = 30;

function getSliderStep(list: HTMLElement): number {
    const first = list.querySelector<HTMLElement>('.js-scrolling-list__item');

    if (!first) return 0;

    const gap = parseFloat(getComputedStyle(list).gap) || 0;

    return first.getBoundingClientRect().width + gap;
}

function scrollListByStep(list: HTMLElement, dir: 1 | -1, behavior: ScrollBehavior) {
    const step = getSliderStep(list);

    if (!step) return;

    const maxLeft = list.scrollWidth - list.clientWidth;
    const target = Math.max(0, Math.min(list.scrollLeft + dir * step, maxLeft));

    list.scrollTo({ left: Math.round(target), behavior });
}

function disableNativeDrag(slider: HTMLElement) {
    slider.querySelectorAll<HTMLElement>('a[href], img').forEach((element) => {
        element.setAttribute('draggable', 'false');
    });
}

function getScrollBehavior(prefersReducedMotion: boolean): ScrollBehavior {
    return prefersReducedMotion ? 'auto' : 'smooth';
}

function canStartSliderDrag(event: MouseEvent) {
    return event.button === 0 && event.target instanceof HTMLElement && !event.target.closest('button');
}

export function init(container: Element | Document = document) {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sliders = container.querySelectorAll<HTMLElement>('.js-scrolling-slider');

    sliders.forEach((slider) => {
        const listEl = slider.querySelector<HTMLElement>('.js-scrolling-list');

        if (!listEl) return;

        const track = listEl;

        if (!track.hasAttribute('tabindex')) {
            track.setAttribute('tabindex', '0');
        }

        const containerEl = slider.querySelector<HTMLElement>('.js-scrolling-list-container');
        const liveRegion = slider.querySelector<HTMLElement>('.js-scrolling-slider-status');

        if (containerEl) {
            containerEl.style.userSelect = 'none';
        }

        disableNativeDrag(slider);

        slider.addEventListener('dragstart', (event) => {
            event.preventDefault();
        });

        const prevBtn = slider.querySelector<HTMLButtonElement>('.js-scrolling-slider-prev');
        const nextBtn = slider.querySelector<HTMLButtonElement>('.js-scrolling-slider-next');
        const items = track.querySelectorAll<HTMLElement>('.js-scrolling-list__item');
        let currentIndex = 0;
        let isDragging = false;
        let suppressClick = false;
        let startX = 0;
        let scrollLeftStart = 0;
        let isInitialized = false;

        function updateLiveRegion() {
            if (!liveRegion || !isInitialized) {
                liveRegion?.replaceChildren();

                return;
            }

            liveRegion.textContent = `Слайд ${currentIndex + 1} из ${items.length}`;
        }

        function updateNavButtons() {
            if (!prevBtn || !nextBtn) return;

            const maxLeft = track.scrollWidth - track.clientWidth;
            const x = track.scrollLeft;
            const disablePrev = !isInitialized || x <= 0;
            const disableNext = !isInitialized || x >= maxLeft - 1;

            prevBtn.disabled = disablePrev;
            nextBtn.disabled = disableNext;
            prevBtn.setAttribute('aria-disabled', String(disablePrev));
            nextBtn.setAttribute('aria-disabled', String(disableNext));
        }

        function syncState() {
            updateNavButtons();
            updateLiveRegion();
        }

        function scrollToSlide(index: number) {
            if (index < 0 || index >= items.length) return;

            const step = getSliderStep(track);

            if (!step) return;

            const maxLeft = track.scrollWidth - track.clientWidth;
            const target = Math.max(0, Math.min(Math.round(index * step), maxLeft));

            track.scrollTo({
                left: target,
                behavior: getScrollBehavior(prefersReducedMotion),
            });
        }

        function handlePrev() {
            scrollListByStep(track, -1, getScrollBehavior(prefersReducedMotion));
        }

        function handleNext() {
            scrollListByStep(track, 1, getScrollBehavior(prefersReducedMotion));
        }

        function handleScroll() {
            const step = getSliderStep(track);

            if (!step) return;

            const newIndex = Math.round(track.scrollLeft / step);

            if (newIndex !== currentIndex && newIndex >= 0 && newIndex < items.length) {
                currentIndex = newIndex;
                updateLiveRegion();
            }

            updateNavButtons();
        }

        function handleKeydown(event: KeyboardEvent) {
            if (!isInitialized) return;

            switch (event.key) {
                case 'ArrowLeft':
                    event.preventDefault();
                    handlePrev();
                    break;

                case 'ArrowRight':
                    event.preventDefault();
                    handleNext();
                    break;

                case 'Home':
                    event.preventDefault();
                    scrollToSlide(0);
                    break;

                case 'End':
                    event.preventDefault();
                    scrollToSlide(items.length - 1);
                    break;

                default:
                    break;
            }
        }

        function handleDragStart(event: MouseEvent) {
            if (!canStartSliderDrag(event) || !containerEl || !isInitialized) return;

            isDragging = true;
            suppressClick = false;
            startX = event.pageX;
            scrollLeftStart = track.scrollLeft;

            containerEl.style.cursor = 'grabbing';
            track.style.scrollSnapType = 'none';
        }

        function handleDragMove(event: MouseEvent) {
            if (!isDragging) return;

            if (Math.abs(event.pageX - startX) > DRAG_CLICK_THRESHOLD) {
                suppressClick = true;
            }

            event.preventDefault();

            const delta = startX - event.pageX;

            track.scrollLeft = scrollLeftStart + delta;
        }

        function handleDragEnd() {
            if (!containerEl || !isDragging) return;

            isDragging = false;

            if (isInitialized) {
                containerEl.style.cursor = 'grab';
            }

            const step = getSliderStep(track);

            if (step > 0) {
                const max = track.scrollWidth - track.clientWidth;
                const maxIndex = Math.round(max / step);
                const delta = track.scrollLeft - scrollLeftStart;
                const base = Math.round(scrollLeftStart / step);
                let index = base;

                if (Math.abs(delta) > DRAG_SNAP_THRESHOLD) {
                    index = base + Math.sign(delta);
                }

                index = Math.max(0, Math.min(index, maxIndex));

                track.scrollTo({
                    left: Math.round(index * step),
                    behavior: getScrollBehavior(prefersReducedMotion),
                });
            }

            track.style.scrollSnapType = '';
        }

        function handleClick(event: MouseEvent) {
            if (!suppressClick) return;

            event.preventDefault();
            event.stopPropagation();
            suppressClick = false;
        }

        const resizeObserver = new ResizeObserver(() => {
            isInitialized = track.scrollWidth > track.clientWidth + 1;

            if (isInitialized && containerEl) {
                containerEl.style.cursor = 'grab';
            } else if (containerEl) {
                containerEl.style.cursor = '';
            }

            syncState();
        });

        resizeObserver.observe(track);

        prevBtn?.addEventListener('click', handlePrev);
        nextBtn?.addEventListener('click', handleNext);
        track.addEventListener('scroll', handleScroll);
        track.addEventListener('keydown', handleKeydown);
        slider.addEventListener('click', handleClick, true);

        if (containerEl) {
            containerEl.addEventListener('mousedown', handleDragStart, true);

            if (isInitialized) {
                containerEl.style.cursor = 'grab';
            }
        }

        document.addEventListener('mousemove', (event) => handleDragMove(event));
        document.addEventListener('mouseup', () => handleDragEnd());

        syncState();
    });
}

export default { init };
