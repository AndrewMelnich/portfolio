import { Marquee } from './utils/Marquee';

export function init(container: Element | Document = document) {
    const marqueeContainers = container.querySelectorAll<HTMLElement>('.js-marquee');

    marqueeContainers.forEach((container) => {
        new Marquee(container, {
            speed: 30,
            direction: 'left',
        });
    });
}

export default { init };
