# Модуль ЧПУ (Человеко-понятный URL)

Модуль для кодирования и декодирования параметров фильтрации в URL-адресе с поддержкой диапазонов и множественных значений.

## Возможности

- ✅ Кодирование параметров в ЧПУ-формат
- ✅ Декодирование ЧПУ в объект параметров
- ✅ Поддержка диапазонов (from-to, from, to)
- ✅ Поддержка множественных значений
- ✅ Сохранение GET-параметров
- ✅ Игнорирование служебных ключей

## Установка

```typescript
import { chpu, encodeUrl, getPathWithoutFilter, type FilterParamsResult } from '@/shared/lib/chpu';
```

## API

### `chpu.parseUrlToParams(url: string): FilterParamsResult`

Парсит URL и извлекает параметры фильтрации.

```typescript
// Простое значение
chpu.parseUrlToParams('/filter/section-is-electronics/apply/');
// → { section: 'electronics' }

// Множественные значения
chpu.parseUrlToParams('/filter/category-is-laptops-and-phones/apply/');
// → { category: ['laptops', 'phones'] }

// Диапазон from-to
chpu.parseUrlToParams('/filter/price-from-100-to-500/apply/');
// → { price: [100, 500] }

// Диапазон from
chpu.parseUrlToParams('/filter/price-from-100/apply/');
// → { price: [100, Number.MAX_SAFE_INTEGER] }

// Диапазон to
chpu.parseUrlToParams('/filter/price-to-1000/apply/');
// → { price: [Number.MIN_SAFE_INTEGER, 1000] }

// С GET-параметрами
chpu.parseUrlToParams('/filter/section-is-electronics/apply/?page=2&sort=price');
// → { section: 'electronics', page: '2', sort: 'price' }
```

### `chpu.encodeParamsToUrl(params: FilterParamsResult, options?): string`

Кодирует объект параметров в ЧПУ-строку.

```typescript
// Простые параметры
chpu.encodeParamsToUrl({
    section: 'electronics',
    brand: 'apple',
});
// → '/filter/section-is-electronics/brand-is-apple/apply/'

// Множественные значения
chpu.encodeParamsToUrl({
    category: ['laptops', 'phones'],
    brand: 'apple',
});
// → '/filter/category-is-laptops-and-phones/brand-is-apple/apply/'

// С диапазонами
chpu.encodeParamsToUrl(
    {
        price: [100, 500],
        size: [10, 20],
    },
    {
        rangeKeys: ['price', 'size'],
    },
);
// → '/filter/price-from-100-to-500/size-from-10-to-20/apply/'

// Игнорирование ключей
chpu.encodeParamsToUrl(
    {
        section: 'electronics',
        limit: 20,
        page: 1,
    },
    {
        ignoredKeys: ['page'],
    },
);
// → '/filter/section-is-electronics/apply/'
```

### `encodeUrl(path: string, params: FilterParamsResult, options?): string`

Создает полный URL с параметрами фильтрации, сохраняя существующие GET-параметры.

```typescript
// Базовый путь
encodeUrl('/catalog', { section: 'electronics' });
// → '/catalog/filter/section-is-electronics/apply/'

// С существующими фильтрами
encodeUrl('/catalog/filter/section-is-electronics/apply/', { brand: 'apple' });
// → '/catalog/filter/section-is-electronics/brand-is-apple/apply/'

// С GET-параметрами
encodeUrl('/catalog?page=2&sort=price', { section: 'electronics' });
// → '/catalog/filter/section-is-electronics/apply/?page=2&sort=price'

// Обновление существующих фильтров
encodeUrl('/catalog/filter/section-is-electronics/apply/?page=2', { section: 'phones' });
// → '/catalog/filter/section-is-phones/apply/?page=2'
```

### `getPathWithoutFilter(path: string, removeTrailingSlash?: boolean): string`

Удаляет фильтры из пути, возвращая базовый путь.

```typescript
getPathWithoutFilter('/catalog/filter/section-is-electronics/apply/');
// → '/catalog'

getPathWithoutFilter('/catalog/filter/section-is-electronics/apply/?page=2');
// → '/catalog'

getPathWithoutFilter('/catalog/filter/section-is-electronics/apply/', true);
// → '/catalog'
```

## Формат URL

Модуль использует следующий формат для ЧПУ:

```
/path/filter/{filters}/apply/?{queryParams}
```

### Фильтры

- **Простое значение**: `{key}-is-{value}`
- **Множественные значения**: `{key}-is-{value1}-and-{value2}`
- **Диапазон from-to**: `{key}-from-{min}-to-{max}`
- **Диапазон from**: `{key}-from-{min}`
- **Диапазон to**: `{key}-to-{max}`

### Примеры

```
/catalog/filter/section-is-electronics/apply/
/catalog/filter/category-is-laptops-and-phones/apply/
/catalog/filter/price-from-100-to-500/brand-is-apple/apply/
/catalog/filter/price-from-100/section-is-electronics/apply/
/catalog/filter/price-to-1000/apply/
```

## Игнорируемые ключи

По умолчанию игнорируются следующие ключи:

- `limit`

Можно добавить дополнительные ключи через опцию `ignoredKeys`.

## Примеры использования

### Фильтрация каталога

```typescript
// Парсинг текущих фильтров
const currentFilters = chpu.parseUrlToParams(window.location.pathname);

// Добавление нового фильтра
const newUrl = encodeUrl(
    '/catalog',
    {
        ...currentFilters,
        section: 'electronics',
        price: [100, 500],
    },
    {
        rangeKeys: ['price'],
    },
);

// Переход на новую страницу
window.location.href = newUrl;
```

### Очистка фильтров

```typescript
// Получение базового пути без фильтров
const basePath = getPathWithoutFilter(window.location.pathname);
window.location.href = basePath;
```

### Работа с диапазонами

```typescript
// Кодирование диапазона цен
const priceFilter = chpu.encodeParamsToUrl(
    {
        price: [100, 500],
    },
    {
        rangeKeys: ['price'],
    },
);
// → '/filter/price-from-100-to-500/apply/'

// Парсинг диапазона
const filters = chpu.parseUrlToParams('/filter/price-from-100-to-500/apply/');
// → { price: [100, 500] }
```
