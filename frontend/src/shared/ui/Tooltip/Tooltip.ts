import { computePosition, flip, offset, shift } from '@floating-ui/dom';

export function init(container: Element | Document = document) {
    const badges = Array.from(container.querySelectorAll<HTMLElement>('.js-tooltip'));

    badges.forEach((badge) => {
        const tooltipEl = badge.querySelector<HTMLElement>('.js-tooltip-el');

        function update(el: HTMLElement) {
            if (el) {
                computePosition(badge, el, {
                    placement: 'top',
                    middleware: [offset(15), shift({ padding: 10 }), flip()],
                }).then(({ x, y, middlewareData }) => {
                    Object.assign(el.style, {
                        left: `${x}px`,
                        top: `${y}px`,
                    });
                    el.style.setProperty('--shift-x', `${middlewareData.shift?.x || 0}px`);

                    if (middlewareData.flip?.index === 1) {
                        el.classList.add('is-flipped');
                    } else {
                        el.classList.remove('is-flipped');
                    }
                });
            }
        }

        function showTooltip() {
            if (tooltipEl) {
                tooltipEl.classList.remove('is-out');
                update(tooltipEl);
            }
        }

        function hideTooltip() {
            if (tooltipEl) {
                tooltipEl.classList.add('is-out');
            }
        }

        let mouseLeaveTimeout: any;
        let clickTimeout: any;

        badge.addEventListener('click', () => {
            clearTimeout(clickTimeout);
            clickTimeout = setTimeout(() => {
                clearTimeout(mouseLeaveTimeout);
                showTooltip();
            }, 50);
        });
        badge.addEventListener('mouseenter', () => {
            clearTimeout(mouseLeaveTimeout);
            showTooltip();
        });
        badge.addEventListener('mouseleave', () => {
            mouseLeaveTimeout = setTimeout(() => {
                hideTooltip();
            }, 100);
        });
        badge.addEventListener('focus', showTooltip);
        badge.addEventListener('blur', hideTooltip);
    });
}

export default { init };
