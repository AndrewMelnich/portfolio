# Dropdown

Выпадающее меню с настраиваемым позиционированием и автоматическим закрытием при клике вне области.

## Использование

### Базовое использование

```astro
---
import Dropdown from '@/shared/ui/Dropdown/Dropdown.astro';
---

<Dropdown id="example-dropdown">
    <template slot="trigger">
        <button class="dropdown-toggler js-dropdown-toggler">Открыть меню</button>
    </template>
    <div class="dropdown-menu">
        <a href="#">Пункт 1</a>
        <a href="#">Пункт 2</a>
        <a href="#">Пункт 3</a>
    </div>
</Dropdown>
```

### С настройкой позиции

```astro
<Dropdown id="custom-dropdown" position="top-right">
    <template slot="trigger">
        <button class="dropdown-toggler js-dropdown-toggler">Меню сверху справа</button>
    </template>
    <div class="dropdown-menu">
        <a href="#">Пункт меню</a>
    </div>
</Dropdown>
```

### Атрибуты

- `position` - позиция выпадающего меню (по умолчанию: `bottom-center`)
- Все остальные HTML-атрибуты элемента `<div>`

### Позиции

- `top-left` - сверху слева
- `top-right` - сверху справа
- `top-center` - сверху по центру
- `center-right` - справа по центру
- `bottom-left` - снизу слева
- `bottom-right` - снизу справа
- `bottom-center` - снизу по центру (по умолчанию)

### Слоты

- **trigger** - содержимое кнопки-триггера (обязательный)
- **default** - содержимое выпадающего меню (обязательный)

### События

Компонент автоматически обрабатывает:

- **Открытие/закрытие**: клик по элементу с классом `dropdown-toggler js-dropdown-toggler`
- **Закрытие**: клик вне области выпадающего меню
