import debounce from 'lodash.debounce';

const RESIZE_DEBOUNCE_MS = 100;
const POINTER_LERP = 0.12;
const LINK_ALPHA_IN = 10;
const LINK_ALPHA_OUT = 3.5;
const LINK_ALPHA_EPS = 0.004;
const LINK_MAX_PER_PARTICLE = 5;
const DRIFT_SPEED = 0.4;
const BREATH_SPEED = 0.42;
const BREATH_AMOUNT = 0.022;
const COVER_BLEED = 1.12;
const SHAPE_BRIGHTNESS_MIN = 22;
const SHAPE_PARTICLE_SHARE = 0.7;
const AMBIENT_KEEP = 0.11;
const AMBIENT_BRIGHTNESS = 52;
const HOVER_QUERY = '(any-hover: hover), (hover: hover) and (pointer: fine)';
const MOBILE_QUERY = '(max-width: 1024px)';
const MAX_PARTICLES_DESKTOP = 3000;
const MAX_PARTICLES_MOBILE = 1000;
const IMAGE_URL = '/static/img/key-visual-hands.jpg';

type Particle = {
    ox: number;
    oy: number;
    x: number;
    y: number;
    phase: number;
    amp: number;
    freq: number;
    size: number;
    brightness: number;
};

type SampledShape = {
    particles: Particle[];
    aspect: number;
};

type FitBox = {
    left: number;
    top: number;
    width: number;
    height: number;
};

type LinkState = {
    i: number;
    j: number;
    alpha: number;
};

function readDpr(isMobile: boolean) {
    return Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.5);
}

function createParticle(ox: number, oy: number, brightness: number, ambient = false): Particle {
    return {
        ox,
        oy,
        x: 0,
        y: 0,
        phase: Math.random() * Math.PI * 2,
        amp: ambient ? 2.2 + Math.random() * 4.8 : 1.4 + Math.random() * 3.6,
        freq: ambient ? 0.45 + Math.random() * 1.2 : 0.65 + Math.random() * 1.55,
        size: ambient ? 0.35 + Math.random() * 0.55 : 0.6 + (brightness / 255) * 1.6 + Math.random() * 0.5,
        brightness,
    };
}

function trimParticles(particles: Particle[], maxParticles: number) {
    if (particles.length <= maxParticles) {
        return particles;
    }

    const stride = particles.length / maxParticles;
    const trimmed: Particle[] = [];

    for (let i = 0; i < maxParticles; i++) {
        trimmed.push(particles[Math.floor(i * stride)]!);
    }

    return trimmed;
}

function edgeDensity(x: number, y: number, width: number, height: number, marginRatio = 0.16, floor = 0) {
    const marginX = Math.max(1, width * marginRatio);
    const marginY = Math.max(1, height * marginRatio);
    const nx = Math.min(x, width - 1 - x) / marginX;
    const ny = Math.min(y, height - 1 - y) / marginY;
    const t = Math.min(1, Math.min(nx, ny));
    const smooth = t * t * (3 - 2 * t);

    return floor + (1 - floor) * smooth;
}

function maybeShapeParticle(x: number, y: number, width: number, height: number, brightness: number) {
    const edge = edgeDensity(x, y, width, height);

    if (edge <= 0.02 || brightness < SHAPE_BRIGHTNESS_MIN) {
        return null;
    }

    const keepChance = (0.28 + (brightness / 255) * 0.72) * edge;

    if (Math.random() > keepChance) {
        return null;
    }

    return createParticle(x / (width - 1), y / (height - 1), brightness * (0.35 + edge * 0.65));
}

function maybeAmbientParticle(x: number, y: number, width: number, height: number, brightness: number) {
    const edge = edgeDensity(x, y, width, height, 0.1, 0.18);

    if (edge <= 0.02 || brightness >= SHAPE_BRIGHTNESS_MIN) {
        return null;
    }

    const keepChance = AMBIENT_KEEP * edge;

    if (Math.random() > keepChance) {
        return null;
    }

    const glow =
        AMBIENT_BRIGHTNESS * (0.55 + (brightness / Math.max(SHAPE_BRIGHTNESS_MIN, 1)) * 0.45) * (0.55 + edge * 0.45);

    return createParticle(x / (width - 1), y / (height - 1), glow, true);
}

// fallow-ignore-next-line complexity
function collectParticles(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    shapeStep: number,
    ambientStep: number,
) {
    const shape: Particle[] = [];
    const ambient: Particle[] = [];

    for (let y = 0; y < height; y += shapeStep) {
        for (let x = 0; x < width; x += shapeStep) {
            const i = (y * width + x) * 4;
            const brightness = (data[i]! + data[i + 1]! + data[i + 2]!) / 3;
            const particle = maybeShapeParticle(x, y, width, height, brightness);

            if (particle) {
                shape.push(particle);
            }
        }
    }

    for (let y = 0; y < height; y += ambientStep) {
        for (let x = 0; x < width; x += ambientStep) {
            const i = (y * width + x) * 4;
            const brightness = (data[i]! + data[i + 1]! + data[i + 2]!) / 3;
            const particle = maybeAmbientParticle(x, y, width, height, brightness);

            if (particle) {
                ambient.push(particle);
            }
        }
    }

    return { shape, ambient };
}

async function loadImage(url: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();

        img.decoding = 'async';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('key-visual image failed'));
        img.src = url;
    });
}

function readSourcePixels(image: HTMLImageElement, isMobile: boolean) {
    const source = document.createElement('canvas');
    const maxSide = isMobile ? 360 : 520;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));

    source.width = Math.max(1, Math.round(image.width * scale));
    source.height = Math.max(1, Math.round(image.height * scale));

    const sourceCtx = source.getContext('2d', { willReadFrequently: true });

    if (!sourceCtx) {
        throw new Error('key-visual 2d unavailable');
    }

    sourceCtx.drawImage(image, 0, 0, source.width, source.height);

    return sourceCtx.getImageData(0, 0, source.width, source.height);
}

async function sampleShape(url: string, isMobile: boolean): Promise<SampledShape> {
    const { data, width, height } = readSourcePixels(await loadImage(url), isMobile);
    const maxParticles = isMobile ? MAX_PARTICLES_MOBILE : MAX_PARTICLES_DESKTOP;
    const maxShape = Math.round(maxParticles * SHAPE_PARTICLE_SHARE);
    const maxAmbient = maxParticles - maxShape;
    const shapeStep = isMobile ? 3 : 2;
    const ambientStep = isMobile ? 5 : 4;
    const { shape, ambient } = collectParticles(data, width, height, shapeStep, ambientStep);

    return {
        particles: [...trimParticles(shape, maxShape), ...trimParticles(ambient, maxAmbient)],
        aspect: width / height,
    };
}

function computeFit(cssWidth: number, cssHeight: number, aspect: number): FitBox {
    const viewAspect = cssWidth / cssHeight;
    let width = cssWidth;
    let height = cssHeight;

    if (viewAspect > aspect) {
        width = cssWidth * COVER_BLEED;
        height = (cssWidth / aspect) * COVER_BLEED;
    } else {
        height = cssHeight * COVER_BLEED;
        width = cssHeight * aspect * COVER_BLEED;
    }

    return {
        left: (cssWidth - width) / 2,
        top: (cssHeight - height) / 2,
        width,
        height,
    };
}

function pushFromPointer(x: number, y: number, pointerX: number, pointerY: number, cursorRadius: number) {
    const dx = x - pointerX;
    const dy = y - pointerY;
    const dist = Math.hypot(dx, dy);

    if (dist >= cursorRadius || dist <= 0.001) {
        return { x, y };
    }

    const force = (1 - dist / cursorRadius) ** 2 * 28;

    return {
        x: x + (dx / dist) * force,
        y: y + (dy / dist) * force,
    };
}

function buildGrid(particles: Particle[], cell: number, cols: number) {
    const grid = new Map<number, number[]>();

    particles.forEach((particle, index) => {
        const key = Math.floor(particle.y / cell) * cols + Math.floor(particle.x / cell);
        const bucket = grid.get(key);

        if (bucket) {
            bucket.push(index);
        } else {
            grid.set(key, [index]);
        }
    });

    return grid;
}

function neighborBuckets(grid: Map<number, number[]>, cols: number, cx: number, cy: number) {
    const buckets: number[][] = [];

    for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
            const bucket = grid.get((cy + oy) * cols + (cx + ox));

            if (bucket) {
                buckets.push(bucket);
            }
        }
    }

    return buckets;
}

function packLinkKey(i: number, j: number) {
    return i < j ? i * 65536 + j : j * 65536 + i;
}

function linkTargetAlpha(a: Particle, b: Particle, linkDistance: number) {
    const dist = Math.hypot(b.x - a.x, b.y - a.y);

    if (dist > linkDistance || dist < 0.5) {
        return 0;
    }

    const t = 1 - dist / linkDistance;
    const falloff = t * t * (3 - 2 * t);

    return (falloff * 0.45 * Math.min(a.brightness, b.brightness)) / 255;
}

// fallow-ignore-next-line complexity
function collectLinkTargets(particles: Particle[], grid: Map<number, number[]>, cols: number, linkDistance: number) {
    const targets = new Map<number, number>();
    const cell = linkDistance;

    for (let i = 0; i < particles.length; i++) {
        const a = particles[i]!;
        const candidates: { key: number; alpha: number }[] = [];

        for (const bucket of neighborBuckets(grid, cols, Math.floor(a.x / cell), Math.floor(a.y / cell))) {
            for (const j of bucket) {
                if (j <= i) {
                    continue;
                }

                const alpha = linkTargetAlpha(a, particles[j]!, linkDistance);

                if (alpha > LINK_ALPHA_EPS) {
                    candidates.push({ key: packLinkKey(i, j), alpha });
                }
            }
        }

        candidates.sort((left, right) => right.alpha - left.alpha);

        for (let n = 0; n < candidates.length && n < LINK_MAX_PER_PARTICLE; n++) {
            const candidate = candidates[n]!;
            const prev = targets.get(candidate.key) ?? 0;

            if (candidate.alpha > prev) {
                targets.set(candidate.key, candidate.alpha);
            }
        }
    }

    return targets;
}

function drawDots(ctx: CanvasRenderingContext2D, particles: Particle[]) {
    for (const particle of particles) {
        const alpha = 0.25 + (particle.brightness / 255) * 0.75;

        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
    }
}

class KeyVisualScene {
    private readonly canvas: HTMLCanvasElement;
    private readonly parent: HTMLElement;
    private readonly ctx: CanvasRenderingContext2D;
    private readonly isHover: boolean;
    private readonly isMobile: boolean;
    private readonly animateAllowed: boolean;
    private readonly linkDistance: number;
    private readonly cursorRadius: number;
    private particles: Particle[] = [];
    private readonly linkStates = new Map<number, LinkState>();
    private aspect = 1;
    private rafId = 0;
    private running = false;
    private destroyed = false;
    private ready = false;
    private startTime = 0;
    private lastTime = 0;
    private lastWidth = 0;
    private cssWidth = 1;
    private cssHeight = 1;
    private pointerTarget = { x: -9999, y: -9999 };
    private pointerCurrent = { x: -9999, y: -9999 };
    private fit: FitBox = { left: 0, top: 0, width: 1, height: 1 };

    private readonly onPointerMove = (event: PointerEvent) => {
        if (!this.isHover || this.destroyed || event.pointerType === 'touch') {
            return;
        }

        const rect = this.parent.getBoundingClientRect();

        this.pointerTarget.x = event.clientX - rect.left;
        this.pointerTarget.y = event.clientY - rect.top;
    };

    private readonly onPointerReset = () => {
        this.pointerTarget.x = -9999;
        this.pointerTarget.y = -9999;
    };

    private readonly onVisibilityChange = () => {
        if (document.hidden) {
            this.pause();
        } else {
            this.resume();
        }
    };

    private readonly onPageShow = (event: PageTransitionEvent) => {
        if (event.persisted) {
            this.resume();
        }
    };

    private redrawStatic() {
        this.layoutParticles(0);
        this.drawFrame(1 / 60, true);
        this.reveal();
    }

    // fallow-ignore-next-line complexity
    private readonly onResize = (force = false) => {
        const width = Math.max(this.parent.clientWidth, 1);
        const blocked = Number(this.destroyed) + Number(!force && width === this.lastWidth);

        if (blocked > 0) {
            return;
        }

        this.applySize(width, Math.max(this.parent.clientHeight, 1));

        if (Number(this.ready) * Number(!this.running)) {
            this.redrawStatic();
        }
    };

    private readonly debouncedResize = debounce(() => this.onResize(), RESIZE_DEBOUNCE_MS);

    constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, animate = true) {
        this.canvas = canvas;
        this.parent = canvas.parentElement ?? document.body;
        this.ctx = ctx;
        this.animateAllowed = animate;
        this.isMobile = matchMedia(MOBILE_QUERY).matches;
        this.isHover = matchMedia(HOVER_QUERY).matches;
        this.linkDistance = this.isMobile ? 32 : 42;
        this.cursorRadius = this.isMobile ? 70 : 110;
        this.onResize(true);
        this.bindEvents();
        void this.boot();
    }

    private applySize(width: number, height: number) {
        const dpr = readDpr(this.isMobile);

        this.lastWidth = width;
        this.cssWidth = width;
        this.cssHeight = height;
        this.canvas.width = Math.round(width * dpr);
        this.canvas.height = Math.round(height * dpr);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.fit = computeFit(width, height, this.aspect);
    }

    private async boot() {
        try {
            const shape = await sampleShape(IMAGE_URL, this.isMobile);

            if (this.destroyed) {
                return;
            }

            this.particles = shape.particles;
            this.aspect = shape.aspect;
            this.ready = true;
            this.fit = computeFit(this.cssWidth, this.cssHeight, this.aspect);
            this.layoutParticles(0);

            if (this.animateAllowed) {
                this.resume();
            } else {
                this.drawFrame(1 / 60, true);
                this.reveal();
            }
        } catch {
            this.parent.hidden = true;
        }
    }

    private layoutParticles(time: number) {
        const { left, top, width, height } = this.fit;
        const pointerActive = this.pointerCurrent.x > -9000;
        const t = time * DRIFT_SPEED;
        const breath = 1 + Math.sin(time * BREATH_SPEED) * BREATH_AMOUNT;
        const anchorX = left + width * 0.5;
        const anchorY = top + height * 0.5;

        for (const particle of this.particles) {
            const homeX = left + particle.ox * width;
            const homeY = top + particle.oy * height;
            const restedX = anchorX + (homeX - anchorX) * breath;
            const restedY = anchorY + (homeY - anchorY) * breath;
            const wave = t * particle.freq;
            const driftX =
                Math.sin(wave + particle.phase) * particle.amp +
                Math.sin(wave * 1.73 + particle.phase * 2.1) * particle.amp * 0.55;
            const driftY =
                Math.cos(wave * 0.92 + particle.phase * 1.3) * particle.amp * 0.9 +
                Math.sin(wave * 1.41 + particle.phase * 0.7) * particle.amp * 0.48;
            const baseX = restedX + driftX;
            const baseY = restedY + driftY;
            const next = pointerActive
                ? pushFromPointer(baseX, baseY, this.pointerCurrent.x, this.pointerCurrent.y, this.cursorRadius)
                : { x: baseX, y: baseY };

            particle.x = next.x;
            particle.y = next.y;
        }
    }

    // fallow-ignore-next-line complexity
    private syncLinkStates(targets: Map<number, number>, delta: number, snap: boolean) {
        for (const [key, target] of targets) {
            const current = this.linkStates.get(key);
            const alpha = current?.alpha ?? 0;
            const rate = target > alpha ? LINK_ALPHA_IN : LINK_ALPHA_OUT;
            const next = snap ? target : alpha + (target - alpha) * (1 - Math.exp(-rate * delta));
            const j = key % 65536;
            const i = (key - j) / 65536;

            this.linkStates.set(key, { i, j, alpha: next });
        }

        for (const [key, state] of this.linkStates) {
            if (targets.has(key)) {
                continue;
            }

            const next = snap ? 0 : state.alpha * Math.exp(-LINK_ALPHA_OUT * delta);

            if (next <= LINK_ALPHA_EPS) {
                this.linkStates.delete(key);
            } else {
                state.alpha = next;
            }
        }
    }

    // fallow-ignore-next-line complexity
    private strokeLinkStates(ctx: CanvasRenderingContext2D) {
        ctx.lineWidth = 0.85;
        ctx.lineCap = 'round';

        for (const { i, j, alpha } of this.linkStates.values()) {
            if (alpha <= LINK_ALPHA_EPS) {
                continue;
            }

            const a = this.particles[i];
            const b = this.particles[j];

            if (!a || !b) {
                continue;
            }

            ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
    }

    private drawFrame(delta = 1 / 60, snap = false) {
        const { ctx, cssWidth, cssHeight, particles, linkDistance } = this;

        ctx.clearRect(0, 0, cssWidth, cssHeight);

        const cols = Math.ceil(cssWidth / linkDistance) + 1;
        const grid = buildGrid(particles, linkDistance, cols);
        const targets = collectLinkTargets(particles, grid, cols, linkDistance);

        this.syncLinkStates(targets, delta, snap);
        this.strokeLinkStates(ctx);
        drawDots(ctx, particles);
    }

    private reveal() {
        this.parent.classList.add('key-visual--ready');
    }

    private bindEvents() {
        window.addEventListener('resize', this.debouncedResize);
        document.addEventListener('visibilitychange', this.onVisibilityChange);
        window.addEventListener('pageshow', this.onPageShow);

        if (this.isHover) {
            document.addEventListener('pointermove', this.onPointerMove, {
                passive: true,
            });
            document.documentElement.addEventListener('pointerleave', this.onPointerReset);
            window.addEventListener('blur', this.onPointerReset);
        }
    }

    private unbindEvents() {
        window.removeEventListener('resize', this.debouncedResize);
        document.removeEventListener('visibilitychange', this.onVisibilityChange);
        window.removeEventListener('pageshow', this.onPageShow);
        document.removeEventListener('pointermove', this.onPointerMove);
        document.documentElement.removeEventListener('pointerleave', this.onPointerReset);
        window.removeEventListener('blur', this.onPointerReset);
        this.debouncedResize.cancel();
    }

    private tick = (now: number) => {
        if (!this.running || this.destroyed) {
            return;
        }

        const delta = Math.min((now - this.lastTime) / 1000, 0.05);

        this.lastTime = now;
        this.pointerCurrent.x +=
            (this.pointerTarget.x - this.pointerCurrent.x) * (1 - Math.exp(-POINTER_LERP * 60 * delta));
        this.pointerCurrent.y +=
            (this.pointerTarget.y - this.pointerCurrent.y) * (1 - Math.exp(-POINTER_LERP * 60 * delta));
        this.layoutParticles((now - this.startTime) / 1000);
        this.drawFrame(delta);
        this.reveal();
        this.rafId = requestAnimationFrame(this.tick);
    };

    pause() {
        if (!this.running) {
            return;
        }

        this.running = false;
        cancelAnimationFrame(this.rafId);
        this.rafId = 0;
    }

    resume() {
        const blocked =
            Number(this.destroyed) +
            Number(this.running) +
            Number(document.hidden) +
            Number(!this.animateAllowed) +
            Number(!this.ready);

        if (blocked > 0) {
            return;
        }

        this.running = true;
        const now = performance.now();

        if (!this.startTime) {
            this.startTime = now;
        }

        this.lastTime = now;
        this.rafId = requestAnimationFrame(this.tick);
    }

    destroy() {
        if (this.destroyed) {
            return;
        }

        this.destroyed = true;
        this.pause();
        this.unbindEvents();
        this.particles = [];
        this.linkStates.clear();
    }
}

export function init(container: Element | Document = document) {
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const roots = container.querySelectorAll<HTMLElement>('.js-key-visual');

    roots.forEach((root) => {
        if (root.dataset.keyVisualReady === 'true') {
            return;
        }

        const canvas = root.querySelector('canvas');

        if (!canvas) {
            return;
        }

        const ctx = canvas.getContext('2d', { alpha: true });

        if (!ctx) {
            root.hidden = true;

            return;
        }

        const scene = new KeyVisualScene(canvas, ctx, !reducedMotion);

        root.dataset.keyVisualReady = 'true';
        root.addEventListener(
            'key-visual:destroy',
            () => {
                scene.destroy();
                delete root.dataset.keyVisualReady;
            },
            { once: true },
        );
    });
}
