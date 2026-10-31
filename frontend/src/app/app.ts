import { calculateScrollbarWidth, vhMobileFix } from '@/shared/lib/dom';
import reveal from '@/shared/lib/reveal';

document.documentElement.classList.add('js-ready');

calculateScrollbarWidth();
vhMobileFix();
reveal.init();

document.addEventListener('astro:page-load', () => {
    reveal.init();
});
