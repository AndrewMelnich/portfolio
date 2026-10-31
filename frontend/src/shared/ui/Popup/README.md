# Popup

Модальное окно на основе HTML `<dialog>` элемента с анимациями.

## Использование

### Базовое использование

```astro
---
import Popup from '@/shared/ui/Popup/Popup.astro';
---

<Popup id="example-popup">
    <h2>Заголовок модального окна</h2>
    <p>Содержимое модального окна</p>
    <button data-dialog-close="example-popup">Закрыть</button>
</Popup>

<!-- Кнопка для открытия -->
<button data-dialog-open="example-popup">Открыть модальное окно</button>
```

### Атрибуты

- `id` (обязательный) - уникальный идентификатор модального окна
- Все остальные HTML-атрибуты элемента `<dialog>`

### События

Компонент автоматически обрабатывает:

- **Открытие**: клик по элементу с атрибутом `data-dialog-open="popup-id"`
- **Закрытие**: клик по элементу с атрибутом `data-dialog-close="popup-id"`
