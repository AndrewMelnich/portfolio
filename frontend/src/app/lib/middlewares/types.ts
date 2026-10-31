import type { MiddlewareHandler } from 'astro';

export type AstroMiddlewareHandler = MiddlewareHandler;

export type MiddlewareFactory = (next: AstroMiddlewareHandler) => AstroMiddlewareHandler;
