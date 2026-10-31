# Сверстать стили типографики из Figma

Сверстай типографику. Напиши css-классы названий стилей типографики в `frontend/src/app/css/layout/_typography.scss`.

## Как сделать

- Letter-spacing только в em.
- Адаптивный font-size с помощью scss-миксина `responsive-font-size`. Например: `@include responsive-font-size(16px, 20px, 1280px, 1920px);`.
