import { defineMiddleware } from 'astro:middleware';

export const staticFilesMiddleware = defineMiddleware((context, next) => {
    const { pathname } = context.url;

    // Пропускаем статические файлы и API маршруты
    if (pathname.startsWith('/api/') || pathname.split('/').pop()?.includes('.')) {
        return next();
    }

    return next();
});
