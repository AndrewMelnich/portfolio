class RevealElement extends HTMLElement {
    private revealed = false;
    private animationEnded = false;
    private timeout: any | null = null;
    private observer: IntersectionObserver | null = null;

    connectedCallback() {
        this.init();
    }

    disconnectedCallback() {
        this.cleanup();
    }

    private init() {
        const instant = this.dataset.revealInstant === 'true';
        const allowed = this.dataset.revealAllowed === 'true';
        const delay = parseInt(this.dataset.revealDelay || '0');
        const once = this.dataset.revealOnce === 'true';

        if (instant) {
            if (allowed) {
                this.timeout = setTimeout(() => {
                    this.setRevealed();
                }, delay);
            }
        } else {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        if (this.timeout) {
                            clearTimeout(this.timeout);
                        }

                        if (allowed) {
                            if (once) {
                                this.observer?.unobserve(entry.target);
                            }

                            this.timeout = setTimeout(() => {
                                this.setRevealed();
                            }, delay);
                        }
                    } else {
                        if (!once) {
                            this.setRevealed(false);
                        }
                    }
                });
            });

            this.observer.observe(this);
        }
    }

    private setRevealed(revealed = true) {
        this.revealed = revealed;
        this.classList.toggle('is-revealed', revealed);

        if (revealed) {
            this.waitForAnimationEnd();
        } else {
            this.animationEnded = false;
            this.classList.remove('is-reveal-completed');
        }
    }

    private waitForAnimationEnd() {
        const animations = this.getAnimations({ subtree: true });

        if (animations.length === 0) {
            this.setAnimationCompleted();

            return;
        }

        Promise.all(animations.map((animation) => animation.finished)).then(() => {
            this.setAnimationCompleted();
        });
    }

    private setAnimationCompleted() {
        this.animationEnded = true;
        this.classList.add('is-reveal-completed');
    }

    private cleanup() {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }

        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
}

export function init() {
    if (!customElements.get('reveal-element')) {
        customElements.define('reveal-element', RevealElement);
    }
}

export default { init };
