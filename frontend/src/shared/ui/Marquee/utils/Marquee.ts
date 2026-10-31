interface MarqueeOptions {
    speed?: number;
    direction?: 'left' | 'right';
    pauseOnHover?: boolean;
    autoFill?: boolean;
    delay?: number;
    draggable?: boolean;
}

export class Marquee {
    private container: HTMLElement;
    private marqueeElement!: HTMLElement;
    private childrenContainer!: HTMLElement;
    private duplicateContainer!: HTMLElement;
    private options: Required<MarqueeOptions>;
    private animationId: number | null = null;
    private isPlaying = true;
    private isPaused = false;
    private currentTranslateX = 0;
    private containerWidth = 0;
    private contentWidth = 0;
    private isDragging = false;
    private dragStartX = 0;
    private dragStartTranslateX = 0;
    private isInViewport = false;
    private intersectionObserver: IntersectionObserver | null = null;

    constructor(container: HTMLElement, options: MarqueeOptions = {}) {
        this.container = container;
        this.options = {
            speed: 50,
            direction: 'left',
            pauseOnHover: false,
            autoFill: true,
            delay: 0,
            draggable: false,
            ...options,
        };

        this.init();
    }

    private init(): void {
        this.setupHTML();
        this.calculateDimensions();
        this.setInitialPosition();
        this.setupEventListeners();
        this.setupIntersectionObserver();

        if (this.options.delay > 0) {
            setTimeout(() => this.start(), this.options.delay * 1000);
        } else {
            this.start();
        }
    }

    private setupHTML(): void {
        const originalChildren = Array.from(this.container.children);

        this.container.innerHTML = '';
        this.container.classList.add('marquee');

        if (this.options.draggable) {
            this.container.classList.add('marquee--draggable');
        }

        this.marqueeElement = document.createElement('div');
        this.marqueeElement.classList.add('marquee__element');

        this.childrenContainer = document.createElement('div');
        this.childrenContainer.classList.add('marquee__container');

        this.duplicateContainer = document.createElement('div');
        this.duplicateContainer.classList.add('marquee__container');

        originalChildren.forEach((child) => {
            this.childrenContainer.appendChild(child);
        });

        this.marqueeElement.appendChild(this.childrenContainer);
        this.marqueeElement.appendChild(this.duplicateContainer);
        this.container.appendChild(this.marqueeElement);
    }

    private calculateDimensions(): void {
        this.containerWidth = this.container.offsetWidth;
        this.contentWidth = this.childrenContainer.scrollWidth;

        if (this.options.autoFill && this.contentWidth < this.containerWidth) {
            this.fillWithDuplicates();
        } else {
            this.createSingleDuplicate();
        }
    }

    private fillWithDuplicates(): void {
        const children = Array.from(this.childrenContainer.children);
        let totalWidth = this.contentWidth;

        while (totalWidth < this.containerWidth * 2) {
            children.forEach((child) => {
                const clone = child.cloneNode(true);

                if (!(clone instanceof HTMLElement)) return;

                this.duplicateContainer.appendChild(clone);
            });
            totalWidth += this.contentWidth;
        }
    }

    private createSingleDuplicate(): void {
        const children = Array.from(this.childrenContainer.children);

        children.forEach((child) => {
            const clone = child.cloneNode(true);

            if (!(clone instanceof HTMLElement)) return;

            this.duplicateContainer.appendChild(clone);
        });
    }

    private setInitialPosition(): void {
        if (this.options.direction === 'right') {
            this.currentTranslateX = -this.contentWidth;
            this.marqueeElement.style.transform = `translateX(${this.currentTranslateX}px)`;
        }
    }

    private handleMouseEnter = (): void => {
        this.pause();
    };

    private handleMouseLeave = (): void => {
        this.resume();
    };

    private handleResize = (): void => {
        const oldContentWidth = this.contentWidth;

        this.calculateDimensions();

        if (oldContentWidth > 0 && this.contentWidth !== oldContentWidth) {
            const relativePosition = this.currentTranslateX / oldContentWidth;

            this.currentTranslateX = relativePosition * this.contentWidth;
            this.normalizePosition();
        }
    };

    private handlePointerDown = (e: PointerEvent): void => {
        if (!this.options.draggable) return;

        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartTranslateX = this.currentTranslateX;

        this.container.setPointerCapture(e.pointerId);
        e.preventDefault();
    };

    private handlePointerMove = (e: PointerEvent): void => {
        if (!this.options.draggable || !this.isDragging) return;

        const deltaX = e.clientX - this.dragStartX;
        let newTranslateX = this.dragStartTranslateX + deltaX;

        // Создаем эффект бесконечной прокрутки во время драга
        if (this.options.direction === 'left') {
            // Если ушли слишком далеко влево, переносим в начало
            if (newTranslateX <= -this.contentWidth) {
                newTranslateX = newTranslateX + this.contentWidth;
                this.dragStartTranslateX += this.contentWidth;
            }
            // Если ушли слишком далеко вправо, переносим в конец
            else if (newTranslateX >= 0) {
                newTranslateX = newTranslateX - this.contentWidth;
                this.dragStartTranslateX -= this.contentWidth;
            }
        } else {
            // Если ушли слишком далеко вправо, переносим в начало
            if (newTranslateX >= 0) {
                newTranslateX = newTranslateX - this.contentWidth;
                this.dragStartTranslateX -= this.contentWidth;
            }
            // Если ушли слишком далеко влево, переносим в конец
            else if (newTranslateX <= -this.contentWidth) {
                newTranslateX = newTranslateX + this.contentWidth;
                this.dragStartTranslateX += this.contentWidth;
            }
        }

        this.currentTranslateX = newTranslateX;
        this.marqueeElement.style.transform = `translateX(${this.currentTranslateX}px)`;
        e.preventDefault();
    };

    private handlePointerUp = (e: PointerEvent): void => {
        if (!this.options.draggable || !this.isDragging) return;

        this.isDragging = false;
        this.container.releasePointerCapture(e.pointerId);

        // Нормализуем позицию после драга
        this.normalizePosition();

        // Возобновляем анимацию если она была активна и элемент в вьюпорте
        if (this.isPlaying && !this.isPaused && this.isInViewport) {
            this.animate();
        }
    };

    private normalizePosition(): void {
        // Приводим позицию к допустимому диапазону
        if (this.options.direction === 'left') {
            if (this.currentTranslateX > 0) {
                this.currentTranslateX = -this.contentWidth + (this.currentTranslateX % this.contentWidth);
            } else if (Math.abs(this.currentTranslateX) > this.contentWidth) {
                this.currentTranslateX = this.currentTranslateX % -this.contentWidth;
            }
        } else {
            if (this.currentTranslateX > 0) {
                this.currentTranslateX = -this.contentWidth + (this.currentTranslateX % this.contentWidth);
            } else if (Math.abs(this.currentTranslateX) > this.contentWidth) {
                this.currentTranslateX = -(Math.abs(this.currentTranslateX) % this.contentWidth);
            }
        }
    }

    private setupEventListeners(): void {
        if (this.options.pauseOnHover) {
            this.container.addEventListener('mouseenter', this.handleMouseEnter);
            this.container.addEventListener('mouseleave', this.handleMouseLeave);
        }

        if (this.options.draggable) {
            this.container.addEventListener('pointerdown', this.handlePointerDown);
            this.container.addEventListener('pointermove', this.handlePointerMove);
            this.container.addEventListener('pointerup', this.handlePointerUp);
            this.container.addEventListener('pointercancel', this.handlePointerUp);
        }

        window.addEventListener('resize', this.handleResize);
    }

    private setupIntersectionObserver(): void {
        this.intersectionObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    this.isInViewport = entry.isIntersecting;

                    if (!this.isInViewport && this.animationId) {
                        // Останавливаем анимацию когда элемент вне вьюпорта
                        cancelAnimationFrame(this.animationId);
                        this.animationId = null;
                    } else if (this.isInViewport && this.isPlaying && !this.isPaused && !this.isDragging) {
                        // Возобновляем анимацию когда элемент в вьюпорте
                        this.animate();
                    }
                });
            },
            {
                rootMargin: '50px', // Начинаем анимацию немного раньше
                threshold: 0.1,
            },
        );

        this.intersectionObserver.observe(this.container);
    }

    private animate = (): void => {
        if (!this.isPlaying || this.isPaused || this.isDragging || !this.isInViewport) return;

        const pixelsPerFrame = this.options.speed / 60;

        if (this.options.direction === 'left') {
            this.currentTranslateX -= pixelsPerFrame;

            if (this.currentTranslateX <= -this.contentWidth) {
                this.currentTranslateX = this.currentTranslateX + this.contentWidth;
            }
        } else {
            this.currentTranslateX += pixelsPerFrame;

            if (this.currentTranslateX >= 0) {
                this.currentTranslateX = this.currentTranslateX - this.contentWidth;
            }
        }

        this.marqueeElement.style.transform = `translateX(${this.currentTranslateX}px)`;
        this.animationId = requestAnimationFrame(this.animate);
    };

    public start(): void {
        this.isPlaying = true;
        this.animate();
    }

    public stop(): void {
        this.isPlaying = false;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    public pause(): void {
        this.isPaused = true;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    public resume(): void {
        this.isPaused = false;

        if (this.isPlaying && !this.animationId) {
            this.animate();
        }
    }

    public destroy(): void {
        this.stop();

        if (this.options.pauseOnHover) {
            this.container.removeEventListener('mouseenter', this.handleMouseEnter);
            this.container.removeEventListener('mouseleave', this.handleMouseLeave);
        }

        if (this.options.draggable) {
            this.container.removeEventListener('pointerdown', this.handlePointerDown);
            this.container.removeEventListener('pointermove', this.handlePointerMove);
            this.container.removeEventListener('pointerup', this.handlePointerUp);
            this.container.removeEventListener('pointercancel', this.handlePointerUp);
        }

        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
            this.intersectionObserver = null;
        }
        window.removeEventListener('resize', this.handleResize);
    }
}
