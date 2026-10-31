/// <reference types="@storybook-astro/framework/shim" />

declare module 'virtual:storybook-astro-renderer' {
    export function applyStyles(): void;
}

declare module '*.scss' {
    const css: string;

    export default css;
}
