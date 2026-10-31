throw new Error(
    '[server-only] imported in the client bundle. ' +
        'Keep SSR fetchers in @/entities/<name>/api; client-safe API stays on @/entities/<name>.',
);
