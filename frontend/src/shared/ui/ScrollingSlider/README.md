# ScrollingSlider

Горизонтальный слайдер с поддержкой перетаскивания, кнопок навигации и автоматической адаптации под размер контента.

## Использование

### Базовое использование

```astro
---
import ScrollingSlider from '@/shared/ui/ScrollingSlider';

const slides = [
    {
        title: 'Slide 1',
        description: 'Description 1',
        image: {
            src: 'https://via.placeholder.com/150',
            width: 150,
            height: 150,
        },
    },
    {
        title: 'Slide 2',
        description: 'Description 2',
        image: {
            src: 'https://via.placeholder.com/150',
            width: 150,
            height: 150,
        },
    },
];
---

<ScrollingSlider slides={slides}>
    {(item: (typeof slides)[number]) => (
        <div>
            <div>{item.title}</div>
            <div>{item.description}</div>
            <div>
                <img src={item.image.src} width={item.image.width} height={item.image.height} alt="" />
            </div>
        </div>
    )}
</ScrollingSlider>
```

### С кнопками навигации

```astro
<ScrollingSlider {slides} class="my-slider">
    <button class="js-scrolling-slider-prev">←</button>
    <button class="js-scrolling-slider-next">→</button>

    {(item: (typeof slides)[number]) => (
        <div class="slide-card">
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <img src={item.image.src} width={item.image.width} height={item.image.height} alt="" />
        </div>
    )}
</ScrollingSlider>
```

### Атрибуты

- `slides` (обязательный) - массив данных для слайдов
- Все остальные HTML-атрибуты элемента `<div>`

### Функциональность

- **Перетаскивание мышью** - drag & drop для навигации
- **Кнопки навигации** - элементы с классами `js-scrolling-slider-prev` и `js-scrolling-slider-next`
- **Scroll snap** - автоматическое выравнивание слайдов
- **Адаптивность** - автоматический расчет размеров элементов
- **Плавная прокрутка** - smooth scroll между слайдами

### CSS-классы

- `js-scrolling-slider` - основной контейнер слайдера
- `js-scrolling-list-container` - контейнер списка слайдов
- `js-scrolling-list` - список слайдов
- `js-scrolling-list__item` - отдельный слайд
- `js-scrolling-slider-prev` - кнопка "назад"
- `js-scrolling-slider-next` - кнопка "вперед"

### CSS-переменные

- `--scroll-margin-left` - отступ для scroll-margin-left элементов
