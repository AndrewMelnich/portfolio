class VideoComponent {
    private video: HTMLVideoElement;
    private autoplayObserver: IntersectionObserver | null = null;
    private lazyObserver: IntersectionObserver | null = null;

    constructor(
        private element: HTMLVideoElement,
        private lazy: boolean,
    ) {
        this.video = element;

        this.init();
    }

    private init() {
        this.setupAutoplayObserver();
        this.setupLazyObserver();
    }

    private setupAutoplayObserver() {
        this.autoplayObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const { target } = entry;

                    if (target instanceof HTMLVideoElement) {
                        if (entry.isIntersecting) {
                            if (target.autoplay && (target.loop || (!target.loop && !target.ended))) {
                                target.play().catch((err) => {
                                    if (err.name === 'NotAllowedError') {
                                        this.autoplayObserver?.unobserve(target);

                                        if (target.hasAttribute('data-fallback') && target.poster) {
                                            const img = new Image();

                                            img.src = target.poster;
                                            img.className = target.className;
                                            target.insertAdjacentElement('afterend', img);
                                            target.hidden = true;
                                        }
                                    }
                                });
                            }
                        } else {
                            target.pause();
                        }
                    }
                });
            },
            { rootMargin: '100px' },
        );

        this.autoplayObserver.observe(this.video);
    }

    private setupLazyObserver() {
        if (this.lazy) {
            this.lazyObserver = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            this.lazyObserver?.unobserve(entry.target);
                            this.loadVideo();
                        }
                    });
                },
                { rootMargin: '800px' },
            );

            this.lazyObserver.observe(this.video);
        }
    }

    private loadVideo() {
        const sources = this.video.querySelectorAll('source[data-src]');

        sources.forEach((source) => {
            const dataSrc = source.getAttribute('data-src');

            if (dataSrc) {
                source.setAttribute('src', dataSrc);
                source.removeAttribute('data-src');
            }
        });
        this.video.load();
    }

    destroy() {
        this.autoplayObserver?.disconnect();
        this.lazyObserver?.disconnect();
    }
}

export function initVideo(container: Element | Document = document) {
    const videoElements = Array.from(container.querySelectorAll<HTMLVideoElement>('video[data-lazy]'));

    videoElements.forEach((element) => {
        const isLazy = element.hasAttribute('data-lazy');

        new VideoComponent(element, isLazy);
    });
}

export default { init: initVideo };
