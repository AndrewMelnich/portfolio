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
const FIT_EDGE_PAD = 8;
const SHAPE_BRIGHTNESS_MIN = 22;
const SHAPE_PARTICLE_SHARE = 0.7;
const AMBIENT_KEEP = 0.11;
const AMBIENT_BRIGHTNESS = 128;
const HOVER_QUERY = '(any-hover: hover), (hover: hover) and (pointer: fine)';
const MOBILE_QUERY = '(max-width: 1024px)';
const MAX_PARTICLES_DESKTOP = 4000;
const MAX_PARTICLES_MOBILE = 1000;
const MIN_INK_SHAPE_DESKTOP = 1400;
const MIN_INK_SHAPE_MOBILE = 420;
const IMAGE_URL = '/static/img/key-visual-hands.jpg';
const ANCHOR_SELECTOR = '.js-key-visual-anchor';
const REMOTE_SHAPE_TIMEOUT_MS = 900;

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
    ambient: boolean;
    fade: number;
};

type SampleMode = 'photo' | 'ink';

type SampledShape = {
    shape: Particle[];
    aspect: number;
};

const DEFAULT_SHAPE_KEY = '__default__';
const AMBIENT_SHAPE_KEY = '__ambient__';

type FitBox = {
    left: number;
    top: number;
    width: number;
    height: number;
};

type FitTokens = {
    gapInline: number;
    gapBlock: number;
    bleed: number;
    frameInline: number;
    frameAspect: number;
    morphMs: number;
};

type LinkState = {
    i: number;
    j: number;
    alpha: number;
};

const DEFAULT_FIT_TOKENS: FitTokens = {
    gapInline: 32,
    gapBlock: 28,
    bleed: 1.08,
    frameInline: 0.5,
    frameAspect: 16 / 9,
    morphMs: 520,
};

function readDpr(isMobile: boolean) {
    return Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.5);
}

function readCssNumber(styles: CSSStyleDeclaration, name: string, fallback: number) {
    const value = Number.parseFloat(styles.getPropertyValue(name).trim());

    return Number.isFinite(value) ? value : fallback;
}

function readFitTokens(element: Element): FitTokens {
    const styles = getComputedStyle(element);
    const frameInline = readCssNumber(styles, '--kv-fit-frame-inline', DEFAULT_FIT_TOKENS.frameInline);
    const frameAspect = readCssNumber(styles, '--kv-fit-frame-aspect', DEFAULT_FIT_TOKENS.frameAspect);

    return {
        gapInline: readCssNumber(styles, '--kv-fit-gap-inline', DEFAULT_FIT_TOKENS.gapInline),
        gapBlock: readCssNumber(styles, '--kv-fit-gap-block', DEFAULT_FIT_TOKENS.gapBlock),
        bleed: readCssNumber(styles, '--kv-fit-bleed', DEFAULT_FIT_TOKENS.bleed),
        frameInline: Math.min(1, Math.max(0.15, frameInline)),
        frameAspect: Math.max(frameAspect, 0.25),
        morphMs: readCssNumber(styles, '--kv-morph-ms', DEFAULT_FIT_TOKENS.morphMs),
    };
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
        size: ambient ? 0.5 + Math.random() * 0.7 : 0.6 + (brightness / 255) * 1.6 + Math.random() * 0.5,
        brightness,
        ambient,
        fade: 1,
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

// fallow-ignore-next-line complexity
function maybeShapeParticle(
    x: number,
    y: number,
    width: number,
    height: number,
    brightness: number,
    forceKeep = false,
) {
    const edge = edgeDensity(x, y, width, height);

    if (edge <= 0.02 || brightness < SHAPE_BRIGHTNESS_MIN) {
        return null;
    }

    if (!forceKeep) {
        const keepChance = (0.28 + (brightness / 255) * 0.72) * edge;

        if (Math.random() > keepChance) {
            return null;
        }
    }

    return createParticle(x / (width - 1), y / (height - 1), brightness * (0.35 + edge * 0.65));
}

function inkBrightness(r: number, g: number, b: number, a: number) {
    if (a < 28) {
        return 0;
    }

    const rgb = (r + g + b) / 3;

    return Math.max(48 + (a / 255) * 180, 255 - rgb, rgb);
}

// fallow-ignore-next-line complexity
function collectShapeParticles(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    shapeStep: number,
    mode: SampleMode,
    forceKeep = false,
) {
    const shape: Particle[] = [];

    for (let y = 0; y < height; y += shapeStep) {
        for (let x = 0; x < width; x += shapeStep) {
            const i = (y * width + x) * 4;
            const r = data[i]!;
            const g = data[i + 1]!;
            const b = data[i + 2]!;
            const a = data[i + 3]!;
            const brightness = mode === 'ink' ? inkBrightness(r, g, b, a) : (r + g + b) / 3;
            const particle = maybeShapeParticle(x, y, width, height, brightness, forceKeep);

            if (particle) {
                shape.push(particle);
            }
        }
    }

    return shape;
}

function densifyShapeParticles(particles: Particle[], minParticles: number) {
    if (particles.length === 0 || particles.length >= minParticles) {
        return particles;
    }

    const densified = particles.slice();
    let cursor = 0;

    while (densified.length < minParticles) {
        const base = particles[cursor % particles.length]!;
        const ox = Math.min(1, Math.max(0, base.ox + (Math.random() - 0.5) * 0.014));
        const oy = Math.min(1, Math.max(0, base.oy + (Math.random() - 0.5) * 0.014));

        densified.push(createParticle(ox, oy, base.brightness));
        cursor += 1;
    }

    return densified;
}

function ensureInkShapeDensity(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    shape: Particle[],
    minShape: number,
) {
    if (shape.length >= minShape) {
        return shape;
    }

    let denser = collectShapeParticles(data, width, height, 1, 'ink', true);

    if (denser.length < minShape) {
        denser = densifyShapeParticles(denser.length > 0 ? denser : shape, minShape);
    }

    return denser;
}

// fallow-ignore-next-line complexity
function collectAmbientField(count: number, cols: number, rows: number) {
    const ambient: Particle[] = [];
    const cellW = 1 / cols;
    const cellH = 1 / rows;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const edge = edgeDensity(col + 0.5, row + 0.5, cols, rows, 0.12, 0.22);

            if (edge <= 0.02 || Math.random() > AMBIENT_KEEP * edge * 2.4) {
                continue;
            }

            const ox = (col + 0.15 + Math.random() * 0.7) * cellW;
            const oy = (row + 0.15 + Math.random() * 0.7) * cellH;
            const glow = AMBIENT_BRIGHTNESS * (0.7 + edge * 0.3) * (0.85 + Math.random() * 0.25);

            ambient.push(createParticle(ox, oy, glow, true));
        }
    }

    return trimParticles(ambient, count);
}

async function loadImage(url: string, timeoutMs = 0) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        let settled = false;

        const finish = (action: () => void) => {
            if (settled) {
                return;
            }

            settled = true;

            if (timer) {
                window.clearTimeout(timer);
            }

            action();
        };

        const timer =
            timeoutMs > 0
                ? window.setTimeout(() => finish(() => reject(new Error('key-visual image timeout'))), timeoutMs)
                : 0;

        img.decoding = 'async';
        img.onload = () => finish(() => resolve(img));
        img.onerror = () => finish(() => reject(new Error('key-visual image failed')));
        img.src = url;
    });
}

function isSiteIconProxy(url: string) {
    return url.includes('/nextapi/site-icon/');
}

// fallow-ignore-next-line complexity
async function loadShapeSource(url: string, timeoutMs = 0) {
    const absolute = new URL(url, window.location.origin).href;

    if (!isSiteIconProxy(absolute)) {
        return loadImage(url, timeoutMs);
    }

    const controller = new AbortController();
    const timer = timeoutMs > 0 ? window.setTimeout(() => controller.abort(), timeoutMs) : 0;

    try {
        const response = await fetch(absolute, { signal: controller.signal });

        if (!response.ok) {
            throw new Error('key-visual image failed');
        }

        const objectUrl = URL.createObjectURL(await response.blob());

        try {
            return await loadImage(objectUrl);
        } finally {
            URL.revokeObjectURL(objectUrl);
        }
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('key-visual image timeout');
        }

        throw error;
    } finally {
        if (timer) {
            window.clearTimeout(timer);
        }
    }
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

// fallow-ignore-next-line complexity
function toInkSilhouette(imageData: ImageData) {
    const { data, width, height } = imageData;
    const out = new Uint8ClampedArray(data.length);
    const inkFloor = 48;
    const backgroundLuma = 210;

    for (let i = 0; i < data.length; i += 4) {
        const sourceAlpha = data[i + 3]!;
        let gray = Math.round(0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!);

        if (sourceAlpha < 28) {
            out[i] = 0;
            out[i + 1] = 0;
            out[i + 2] = 0;
            out[i + 3] = 0;
            continue;
        }

        gray = Math.min(255, Math.max(0, Math.round((gray - 128) * 1.7 + 128)));

        if (gray >= backgroundLuma && sourceAlpha > 240) {
            out[i] = 0;
            out[i + 1] = 0;
            out[i + 2] = 0;
            out[i + 3] = 0;
            continue;
        }

        const ink = Math.max(gray, 255 - gray);

        gray = Math.round((ink * sourceAlpha) / 255);

        if (gray < inkFloor) {
            out[i] = 0;
            out[i + 1] = 0;
            out[i + 2] = 0;
            out[i + 3] = 0;
            continue;
        }

        out[i] = gray;
        out[i + 1] = gray;
        out[i + 2] = gray;
        out[i + 3] = 255;
    }

    return new ImageData(out, width, height);
}

// fallow-ignore-next-line complexity
function particleBudget(isMobile: boolean) {
    const maxParticles = isMobile ? MAX_PARTICLES_MOBILE : MAX_PARTICLES_DESKTOP;
    const maxShape = Math.round(maxParticles * SHAPE_PARTICLE_SHARE);
    const minInkShape = Math.min(maxShape, isMobile ? MIN_INK_SHAPE_MOBILE : MIN_INK_SHAPE_DESKTOP);

    return {
        maxShape,
        minInkShape,
        maxAmbient: maxParticles - maxShape,
        shapeStep: isMobile ? 3 : 2,
        ambientCols: isMobile ? 28 : 42,
        ambientRows: isMobile ? 18 : 26,
    };
}

async function sampleShape(url: string, isMobile: boolean, mode: SampleMode, timeoutMs = 0): Promise<SampledShape> {
    let imageData = readSourcePixels(await loadShapeSource(url, timeoutMs), isMobile);

    if (mode === 'ink') {
        imageData = toInkSilhouette(imageData);
    }

    const { data, width, height } = imageData;
    const { maxShape, minInkShape, shapeStep } = particleBudget(isMobile);
    let shape = collectShapeParticles(data, width, height, shapeStep, mode);

    if (mode === 'ink') {
        shape = ensureInkShapeDensity(data, width, height, shape, minInkShape);
    }

    return {
        shape: trimParticles(shape, maxShape),
        aspect: width / Math.max(height, 1),
    };
}

function createAmbientParticles(isMobile: boolean) {
    const { maxAmbient, ambientCols, ambientRows } = particleBudget(isMobile);

    return collectAmbientField(maxAmbient, ambientCols, ambientRows);
}

function shapeSourceKey(url: string | null) {
    if (url === null) {
        return DEFAULT_SHAPE_KEY;
    }

    if (url === '') {
        return AMBIENT_SHAPE_KEY;
    }

    return url;
}

export function resolvePageShapeSource(container: ParentNode = document): string | null {
    const marker = container.querySelector<HTMLElement>('[data-key-visual-shape]');

    if (!marker) {
        return null;
    }

    return marker.getAttribute('data-key-visual-shape') ?? '';
}

function sampleModeForSource(sourceKey: string): SampleMode {
    return sourceKey === DEFAULT_SHAPE_KEY ? 'photo' : 'ink';
}

function clampFit(box: FitBox, viewportW: number, viewportH: number): FitBox {
    const width = Math.min(box.width, Math.max(1, viewportW - FIT_EDGE_PAD * 2));
    const height = Math.min(box.height, Math.max(1, viewportH - FIT_EDGE_PAD * 2));
    const left = Math.min(Math.max(FIT_EDGE_PAD, box.left), viewportW - width - FIT_EDGE_PAD);
    const top = Math.min(Math.max(FIT_EDGE_PAD, box.top), viewportH - height - FIT_EDGE_PAD);

    return { left, top, width, height };
}

function computeFit(cssWidth: number, cssHeight: number, aspect: number, bleed: number): FitBox {
    const viewAspect = cssWidth / cssHeight;
    let width = cssWidth;
    let height = cssHeight;

    if (viewAspect > aspect) {
        width = cssHeight * aspect * bleed;
        height = cssHeight * bleed;
    } else {
        width = cssWidth * bleed;
        height = (cssWidth / aspect) * bleed;
    }

    return {
        left: (cssWidth - width) / 2,
        top: (cssHeight - height) / 2,
        width,
        height,
    };
}

function computeFitInFrame(
    frameLeft: number,
    frameTop: number,
    frameWidth: number,
    frameHeight: number,
    aspect: number,
    bleed: number,
): FitBox {
    const inner = computeFit(frameWidth, frameHeight, aspect, bleed);

    return {
        left: frameLeft + inner.left,
        top: frameTop + inner.top,
        width: inner.width,
        height: inner.height,
    };
}

function resolveFrameBox(viewportW: number, anchor: DOMRect, tokens: FitTokens, isMobile: boolean) {
    const frameWidth = viewportW * tokens.frameInline;
    const frameHeight = frameWidth / tokens.frameAspect;

    if (isMobile) {
        return {
            left: (viewportW - frameWidth) * 0.5,
            top: anchor.bottom + tokens.gapBlock,
            width: frameWidth,
            height: frameHeight,
        };
    }

    return {
        left: viewportW - frameWidth,
        top: anchor.top + anchor.height * 0.5 - frameHeight * 0.5,
        width: frameWidth,
        height: frameHeight,
    };
}

function resolveShapeFit(
    cssWidth: number,
    cssHeight: number,
    aspect: number,
    tokens: FitTokens,
    isMobile: boolean,
): FitBox {
    const anchor = document.querySelector<HTMLElement>(ANCHOR_SELECTOR);

    if (!anchor) {
        return computeFit(cssWidth, cssHeight, aspect, tokens.bleed);
    }

    const frame = resolveFrameBox(cssWidth, anchor.getBoundingClientRect(), tokens, isMobile);

    return clampFit(
        computeFitInFrame(frame.left, frame.top, frame.width, frame.height, aspect, tokens.bleed),
        cssWidth,
        cssHeight,
    );
}

function lerpFit(from: FitBox, to: FitBox, t: number): FitBox {
    return {
        left: from.left + (to.left - from.left) * t,
        top: from.top + (to.top - from.top) * t,
        width: from.width + (to.width - from.width) * t,
        height: from.height + (to.height - from.height) * t,
    };
}

function easeOutCubic(t: number) {
    return 1 - (1 - t) ** 3;
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
    const fade = a.fade * b.fade;

    return ((falloff * 0.45 * Math.min(a.brightness, b.brightness)) / 255) * fade;
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
        if (particle.fade <= LINK_ALPHA_EPS) {
            continue;
        }

        const alpha = (0.25 + (particle.brightness / 255) * 0.75) * particle.fade;

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
    private readonly animateAllowed: boolean;
    private isMobile: boolean;
    private linkDistance: number;
    private cursorRadius: number;
    private particles: Particle[] = [];
    private readonly linkStates = new Map<number, LinkState>();
    private aspect = 1;
    private shapeKey = '';
    private shapeEpoch = 0;
    private rafId = 0;
    private fitRafId = 0;
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
    private fitTokens: FitTokens = { ...DEFAULT_FIT_TOKENS };
    private morphing = false;
    private morphStart = 0;
    private morphOutgoingCount = 0;
    private fitFrom: FitBox = { left: 0, top: 0, width: 1, height: 1 };
    private fitTo: FitBox = { left: 0, top: 0, width: 1, height: 1 };
    private anchorScrollBound = false;

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

    private readonly onScroll = () => {
        if (this.fitRafId || this.destroyed) {
            return;
        }

        this.fitRafId = requestAnimationFrame(() => {
            this.fitRafId = 0;
            this.refreshFitFromAnchor();
        });
    };

    private redrawStatic() {
        this.layoutParticles(0);
        this.drawFrame(1 / 60, true);
        this.reveal();
    }

    private syncMobileFlags() {
        this.isMobile = matchMedia(MOBILE_QUERY).matches;
        this.linkDistance = this.isMobile ? 32 : 42;
        this.cursorRadius = this.isMobile ? 70 : 110;
    }

    private refreshFitTokens() {
        this.fitTokens = readFitTokens(this.parent);
    }

    private resolveCurrentFit(aspect = this.aspect) {
        return resolveShapeFit(this.cssWidth, this.cssHeight, aspect, this.fitTokens, this.isMobile);
    }

    // fallow-ignore-next-line complexity
    private refreshFitFromAnchor() {
        if (this.destroyed || !this.ready) {
            return;
        }

        this.syncMobileFlags();
        this.refreshFitTokens();
        const next = this.resolveCurrentFit();

        if (this.morphing) {
            this.fitTo = next;
        } else {
            this.fit = next;

            if (!this.running) {
                this.redrawStatic();
            }
        }
    }

    private syncAnchorScroll() {
        const hasAnchor = Boolean(document.querySelector(ANCHOR_SELECTOR));

        if (hasAnchor === this.anchorScrollBound) {
            return;
        }

        if (hasAnchor) {
            window.addEventListener('scroll', this.onScroll, { passive: true });
            this.anchorScrollBound = true;
        } else {
            window.removeEventListener('scroll', this.onScroll);
            this.anchorScrollBound = false;
        }
    }

    // fallow-ignore-next-line complexity
    private readonly onResize = (force = false) => {
        const width = Math.max(this.parent.clientWidth, 1);
        const height = Math.max(this.parent.clientHeight, 1);
        const blocked =
            Number(this.destroyed) + Number(!force && width === this.lastWidth && height === this.cssHeight);

        if (blocked > 0) {
            return;
        }

        this.applySize(width, height);

        if (Number(this.ready) * Number(!this.running) * Number(!this.morphing)) {
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
        this.refreshFitTokens();
        this.onResize(true);
        this.bindEvents();
    }

    private applySize(width: number, height: number) {
        const dpr = readDpr(this.isMobile);

        this.syncMobileFlags();
        this.refreshFitTokens();
        this.lastWidth = width;
        this.cssWidth = width;
        this.cssHeight = height;
        this.canvas.width = Math.round(width * dpr);
        this.canvas.height = Math.round(height * dpr);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const next = this.resolveCurrentFit();

        if (this.morphing) {
            this.fitTo = next;
        } else {
            this.fit = next;
        }
    }

    private ensureAmbient() {
        const ambient = this.particles.filter((particle) => particle.ambient);

        if (ambient.length > 0) {
            return ambient;
        }

        return createAmbientParticles(this.isMobile);
    }

    private hasShapeParticles() {
        return this.particles.some((particle) => !particle.ambient);
    }

    private finishMorph() {
        const ambient = this.particles.filter((particle) => particle.ambient);
        const shapes = this.particles.filter((particle) => !particle.ambient);
        const incoming = shapes.slice(this.morphOutgoingCount);

        for (const particle of incoming) {
            particle.fade = 1;
        }

        this.morphing = false;
        this.morphOutgoingCount = 0;
        this.fit = this.fitTo;
        this.particles = [...incoming, ...ambient];
        this.linkStates.clear();
        this.syncAnchorScroll();
    }

    private beginMorph(shape: Particle[], aspect: number) {
        const ambient = this.ensureAmbient();
        const morphBudget = Math.round(particleBudget(this.isMobile).maxShape * 0.55);
        const outgoing = trimParticles(
            this.particles.filter((particle) => !particle.ambient),
            morphBudget,
        );
        const incoming = trimParticles(shape, morphBudget);

        for (const particle of outgoing) {
            particle.fade = 1;
        }

        for (const particle of incoming) {
            particle.fade = 0;
        }

        this.refreshFitTokens();
        this.syncMobileFlags();
        this.fitFrom = { ...this.fit };
        this.aspect = aspect;
        this.fitTo = this.resolveCurrentFit(aspect);
        this.morphOutgoingCount = outgoing.length;
        this.morphStart = performance.now();
        this.morphing = true;
        this.particles = [...outgoing, ...incoming, ...ambient];
        this.linkStates.clear();
        this.ready = true;
        this.parent.hidden = false;
        this.syncAnchorScroll();
        this.resume();
    }

    private commitParticles(shape: Particle[], aspect: number) {
        this.morphing = false;
        this.morphOutgoingCount = 0;
        this.particles = [...shape, ...this.ensureAmbient()];
        this.aspect = aspect;
        this.linkStates.clear();
        this.ready = true;
        this.parent.hidden = false;
        this.refreshFitTokens();
        this.syncMobileFlags();
        this.fit = this.resolveCurrentFit(aspect);
        this.layoutParticles(this.running ? (performance.now() - this.startTime) / 1000 : 0);
        this.syncAnchorScroll();

        if (this.animateAllowed) {
            this.resume();
        } else {
            this.drawFrame(1 / 60, true);
            this.reveal();
        }
    }

    private applyShape(shape: Particle[], aspect: number) {
        if (this.ready && this.animateAllowed && this.hasShapeParticles()) {
            this.beginMorph(shape, aspect);

            return;
        }

        this.commitParticles(shape, aspect);
    }

    // fallow-ignore-next-line complexity
    async setShapeSource(url: string | null) {
        const nextKey = shapeSourceKey(url);

        if (nextKey === this.shapeKey && this.ready) {
            this.syncAnchorScroll();
            this.refreshFitFromAnchor();

            return;
        }

        const epoch = ++this.shapeEpoch;

        this.shapeKey = nextKey;

        if (nextKey === AMBIENT_SHAPE_KEY) {
            if (this.destroyed || epoch !== this.shapeEpoch) {
                return;
            }

            this.applyShape([], 1);

            return;
        }

        const imageUrl = nextKey === DEFAULT_SHAPE_KEY ? IMAGE_URL : nextKey;

        try {
            const sampled = await sampleShape(
                imageUrl,
                this.isMobile,
                sampleModeForSource(nextKey),
                nextKey === DEFAULT_SHAPE_KEY ? 0 : REMOTE_SHAPE_TIMEOUT_MS,
            );

            if (this.destroyed || epoch !== this.shapeEpoch) {
                return;
            }

            this.applyShape(sampled.shape, sampled.aspect);
        } catch {
            if (this.destroyed || epoch !== this.shapeEpoch) {
                return;
            }

            if (nextKey === DEFAULT_SHAPE_KEY) {
                throw new Error('key-visual default shape failed');
            }

            this.shapeKey = AMBIENT_SHAPE_KEY;
            this.applyShape([], 1);
        }
    }

    // fallow-ignore-next-line complexity
    private updateMorph(now: number) {
        if (!this.morphing) {
            return;
        }

        const duration = Math.max(this.fitTokens.morphMs, 1);
        const t = Math.min(1, (now - this.morphStart) / duration);
        const eased = easeOutCubic(t);

        this.fit = lerpFit(this.fitFrom, this.fitTo, eased);

        let shapeIndex = 0;

        for (const particle of this.particles) {
            if (particle.ambient) {
                continue;
            }

            particle.fade = shapeIndex < this.morphOutgoingCount ? 1 - eased : eased;
            shapeIndex += 1;
        }

        if (t >= 1) {
            this.finishMorph();
        }
    }

    // fallow-ignore-next-line complexity
    private layoutParticles(time: number) {
        const { left, top, width, height } = this.fit;
        const pointerActive = this.pointerCurrent.x > -9000;
        const t = time * DRIFT_SPEED;
        const breath = 1 + Math.sin(time * BREATH_SPEED) * BREATH_AMOUNT;
        const shapeAnchorX = left + width * 0.5;
        const shapeAnchorY = top + height * 0.5;
        const viewAnchorX = this.cssWidth * 0.5;
        const viewAnchorY = this.cssHeight * 0.5;

        for (const particle of this.particles) {
            const homeX = particle.ambient ? particle.ox * this.cssWidth : left + particle.ox * width;
            const homeY = particle.ambient ? particle.oy * this.cssHeight : top + particle.oy * height;
            const anchorX = particle.ambient ? viewAnchorX : shapeAnchorX;
            const anchorY = particle.ambient ? viewAnchorY : shapeAnchorY;
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

            const fade = a.fade * b.fade;

            if (fade <= LINK_ALPHA_EPS) {
                continue;
            }

            ctx.strokeStyle = `rgba(255,255,255,${alpha * fade})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
    }

    private drawFrame(delta = 1 / 60, snap = false) {
        const { ctx, cssWidth, cssHeight, particles, linkDistance } = this;

        ctx.clearRect(0, 0, cssWidth, cssHeight);

        if (this.morphing) {
            drawDots(ctx, particles);

            return;
        }

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
        window.removeEventListener('scroll', this.onScroll);
        this.anchorScrollBound = false;
        this.debouncedResize.cancel();

        if (this.fitRafId) {
            cancelAnimationFrame(this.fitRafId);
            this.fitRafId = 0;
        }
    }

    private tick = (now: number) => {
        if (!this.running || this.destroyed) {
            return;
        }

        if (!this.canvas.isConnected) {
            this.destroy();

            return;
        }

        const delta = Math.min((now - this.lastTime) / 1000, 0.05);

        this.lastTime = now;
        this.pointerCurrent.x +=
            (this.pointerTarget.x - this.pointerCurrent.x) * (1 - Math.exp(-POINTER_LERP * 60 * delta));
        this.pointerCurrent.y +=
            (this.pointerTarget.y - this.pointerCurrent.y) * (1 - Math.exp(-POINTER_LERP * 60 * delta));
        this.updateMorph(now);
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

const scenes = new WeakMap<HTMLElement, KeyVisualScene>();

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

        scenes.set(root, scene);
        root.dataset.keyVisualReady = 'true';
        root.addEventListener(
            'key-visual:destroy',
            () => {
                scene.destroy();
                scenes.delete(root);
                delete root.dataset.keyVisualReady;
            },
            { once: true },
        );
    });
}

export async function syncFromPage(container: ParentNode = document) {
    const source = resolvePageShapeSource(container);
    const roots = [...container.querySelectorAll<HTMLElement>('.js-key-visual')];

    await Promise.all(
        roots.map(async (root) => {
            const scene = scenes.get(root);

            if (!scene) {
                return;
            }

            try {
                await scene.setShapeSource(source);
            } catch {
                root.hidden = true;
            }
        }),
    );
}
