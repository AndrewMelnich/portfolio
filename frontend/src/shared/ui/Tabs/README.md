# Tabs

Поведение вкладок (клавиатура, `hidden`, `aria-selected`, roving `tabindex`). **Разметка — в Astro**, см. `TabSwitcher`.

## Разметка (обязательно)

```html
<div class="tabs js-tabs" id="my-tabs">
    <ul role="tablist" aria-label="…">
        <li role="presentation">
            <button
                type="button"
                role="tab"
                id="panel-a-tab"
                data-tabs-toggler="panel-a"
                aria-controls="panel-a"
                aria-selected="true"
                tabindex="0"
            >
                A
            </button>
        </li>
    </ul>
    <div id="panel-a" role="tabpanel" data-tabs-content aria-labelledby="panel-a-tab" tabindex="0">…</div>
    <div id="panel-b" role="tabpanel" data-tabs-content aria-labelledby="panel-b-tab" hidden>…</div>
</div>
```

`tablist` — только переключатели. `tabpanel` — соседи, не внутри `tablist`.

## Клавиатура

←/→ (или ↑/↓ при `aria-orientation="vertical"`), Home/End — смена вкладки; Tab — в панель (roving `tabindex`).
