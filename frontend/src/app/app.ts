import { calculateScrollbarWidth, vhMobileFix } from '@/shared/lib/dom';
import reveal from '@/shared/lib/reveal';

document.documentElement.classList.add('js-ready');

calculateScrollbarWidth();
vhMobileFix();
reveal.init();

document.addEventListener('astro:before-swap', (event) => {
    reveal.prepareIncomingDocument(event.newDocument);
});

document.addEventListener('astro:after-swap', () => {
    document.documentElement.classList.remove('no-js');
    document.documentElement.classList.add('js');
    reveal.veil();
    reveal.prepareAll();
});

document.addEventListener('astro:page-load', () => {
    void reveal.startAfterTransitions();
});
