# Astro Boilerplate

## Требования

- [Node.js](https://nodejs.org/en/) версии 24+ (см. `.nvmrc`). Проверить версию ноды после установки можно командой **node -v**.
- [pnpm](https://pnpm.io/ru/) 12+
- [`glab`](https://gitlab.com/gitlab-org/cli) — CLI GitLab: агент создаёт и читает issues через него

## Как начать работу

Агент: из корня boilerplate — `/project-bootstrap`. Ниже — те же шаги вручную.

1. Создайте [новый проект на гитлабе](https://gitlab.com/projects/new). Если проект уже существует, пропустите шаги 1–6.
2. Склонируйте данный репозиторий на ваше локальное окружение: `git@gitlab.com:chipsadesign/astro-boilerplate.git`, затем перейдите в созданную директорию.
3. Удалите папку .git: **rm -rf .git**.
4. Реинициализируйте git-репозиторий: **git init**.
5. Установите remote url: **git remote add origin [new_url_here]**.
6. Если вы только что создали проект: из корня репозитория выполните `bash ./scripts/setup-gitlab-labels.sh`. Нужны установленный [`glab`](https://gitlab.com/gitlab-org/cli) и `glab auth login`. Скрипт создаст лейблы `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix` — агент ставит ими статус тикетов. Повторный запуск безопасен: уже существующие лейблы пропускаются. Если проект уже есть и лейблы на месте — шаг можно пропустить.
7. Активируйте нужные версии `pnpm` и `node`: `pnpm setup` или `nvm use && corepack enable`.
8. Установите npm-зависимости в корне проекта: `pnpm i`. Установятся git-хуки.
9. Перейдите в папку `frontend`, установите npm-зависимости: `pnpm i`.
10. Если есть бэкенд: сделать файл `.env` из шаблона `.env.example`, наполнить переменные актуальными данными.
11. Запустите команду `pnpm run dev`.
12. Перейдите по адресу [http://localhost:3000](http://localhost:3000) в браузере.

Если произошла ошибка - не пугаемся, смотрим на ошибку, выясняем, в чем проблема, гуглим решение или спрашиваем у коллег.

Список всех npm-пакетов можно посмотреть в файле **package.json**.

## Cursor и агентские скиллы

В репозитории уже настроены скиллы. Они подсказывают агенту, как уточнять задачу, писать тикеты в GitLab и писать код. Команду `/setup-matt-pocock-skills` запускать не нужно — это уже сделано.

Если вы пришли в уже существующий GitLab-проект, пропустите шаги 1–6 в разделе «Как начать работу»: клонируйте командный репозиторий и начинайте с Node/pnpm.

Не знаете, какой скилл выбрать — напишите в чате `/ask-matt` и опишите ситуацию своими словами.

### Первый запуск Cursor и GitLab CLI

1. Откройте в Cursor **корень репозитория**, а не папку `frontend/`. Скиллы лежат в корне (`.cursor/`, `.agents/`); карта фронта — `frontend/AGENTS.md`. Если открыть только frontend, агент не увидит скиллы.
2. Скопируйте `ROLE.md.example` → `ROLE.md` в корне (`frontend` или `backend`). Файл в `.gitignore` — локальная роль, не коммитить.
3. Установите [`glab`](https://gitlab.com/gitlab-org/cli), если его ещё нет, и один раз авторизуйтесь:

```bash
glab auth login
glab issue list
```

Команда `glab issue list` должна показать issues **этого** проекта. `glab` смотрит на `git remote origin`: он должен указывать на командный GitLab, а не на шаблон boilerplate.

Зачем `glab`: скиллы вроде `/to-tickets` и `/implement` создают и читают GitLab Issues через CLI. Без логина агент не сможет опубликовать тикеты.

### Что прочитать в первый день

Не нужно открывать все файлы в `.agents/skills/` и `.cursor/skills/`. Скилл подгружается сам, когда вы его вызываете. Достаточно трёх файлов:

| Файл                           | Зачем он вам                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `frontend/AGENTS.md`           | короткая карта: где тикеты, какие лейблы, где какие скиллы                                                                                 |
| `frontend/CODING_STANDARDS.md` | указатели на правила кода. Сами правила живут в `.cursor/rules/`; этот файл говорит, куда смотреть на ревью                                |
| `frontend/GLOSSARY.md`         | словарь терминов фронта. Если файла нет — ничего не создавайте заранее. Он появится из `/grill-with-docs`, когда появятся реальные термины |

### Как вызвать скилл

В чате агента Cursor наберите `/` и имя скилла, например `/grill-with-docs` или `/implement`. Можно также прикрепить скилл к сообщению (в Cursor это Attach skill).

Две папки — два слоя:

- **`.cursor/skills`** — принципы, проверка, TypeScript, тексты.
- **`.agents/skills`** — fstack (вёрстка, доступность, verify-ui) и процесс «идея → уточнение → тикеты в GitLab → код».

Когда агент задаёт уточняющие вопросы (grilling), отвечайте **на один вопрос за раз** и дождитесь следующего. Факты (что уже есть в коде, какой ответ у API) агент должен найти сам. Ваши — только решения: «делаем так, а не иначе».

### Что запускать в типичной ситуации

**Нужно сделать фичу по идее или макету.** Держите один чат от идеи до тикетов и не очищайте его командой `/clear` посередине: агенту нужна эта история.

1. Начните с `/grill-with-docs`. Агент задаст вопросы и при необходимости запишет термины в `frontend/GLOSSARY.md` или решение в `frontend/docs/adr/`.
2. Если работа небольшая и влезает в один сеанс — сразу `/implement` в том же чате.
3. Если работа большая — `/to-spec` (спека), затем `/to-tickets`. В GitLab появятся issues со связями «это блокирует то». Дальше открывайте **новый чат на каждый тикет**: `/implement #12`. Когда тикет закрыт, очистите чат (`/clear`) и возьмите следующий.

Тикеты, которые только что создал `/to-tickets`, уже готовы к работе. Их не нужно прогонять через `/triage`.

**В GitLab прилетел баг или сырой запрос, который завели не вы.** Запустите `/triage`: агент разберёт формулировку и проставит лейбл `ready-for-agent` (можно отдать агенту) или `ready-for-human` (нужен человек). Потом напишите `/implement #номер`.

**Что-то сломалось, и с первого взгляда непонятно почему.** `/diagnosing-bugs`. Агент сначала ищет команду, которая уже падает на этом баге, и только потом чинит. Если такой команды нет — он поможет её сделать, а не будет гадать.

**Фича слишком большая, чтобы удержать её в голове.** `/wayfinder` разложит работу на «тикеты-решения» в GitLab (это карта, а не сразу код). Когда направление ясно — `/to-spec`, затем тикеты и реализация. Не прыгайте из wayfinder сразу в `/implement`: потеряете собранный контекст решений.

**Нужно ревью чужой ветки или MR.** `/code-review` и скажите, от чего считать дифф: ветка `main`, тег или конкретный коммит.

### Лейблы в GitLab

| Лейбл             | Когда ставить                                       |
| ----------------- | --------------------------------------------------- |
| `needs-triage`    | issue только появился, его ещё не разобрали         |
| `needs-info`      | не хватает данных от автора                         |
| `ready-for-agent` | задача описана достаточно, её можно отдать агенту   |
| `ready-for-human` | без человека не обойтись (продукт, дизайн, доступы) |
| `wontfix`         | делать не будем                                     |

### Частые ошибки

- Повторно запускать `/setup-matt-pocock-skills`. Это нужно только если меняете трекер (например, с GitLab на что-то другое).
- Писать тикеты в папку `.scratch/` или в локальные markdown-файлы. Канон проекта — GitLab Issues.
- Править каталог `backend/`, если в задаче явно не сказано заняться бэкендом. Фронтенд-агент работает в `frontend/`.
- Прогонять `/triage` по тикетам, которые создал `/to-tickets`.
- Реализовывать второй тикет в том же чате, что и первый. Окно засоряется, качество падает — лучше `/clear` и новый `/implement #N`.

## Обзор комманд

- `pnpm dev` (или `pnpm watch`) — watch в development-режиме;
- `pnpm build` — сборка в production-режиме;
- `pnpm test` — запуск unit-тестов;
- `pnpm test:ci` — запуск unit-тестов в CI-окружении;
- `pnpm test:general` — запуск базовых e2e-тестов;
- `pnpm api` — генерация typescript-типов и zod-схем API бэкенда через [OpenAPI](https://www.openapis.org/);
- `pnpm tsc` — запуск typescript проверок на корректность типов;
- `pnpm lint` — запуск линтеров;
- `pnpm pc` — tsc + линтеры + проверка форматирования (перед первым `tsc` локально: `pnpm astro sync`, в CI — отдельный шаг);
- `pnpm format` — форматирование файлов через [oxfmt](https://oxc.rs/docs/guide/usage/formatter) (`pnpm format:check` — только проверка);
- `pnpm icons` — генерация типов UI-иконок (спрайт);
- `pnpm pwa-icons` — генерация PNG-иконок для web app manifest из `public/static/favicon.svg`

## Структура frontend-приложения

Проект следует методологии Feature-Sliced Design ([документация](https://feature-sliced.design/)).

- `src/app`
  Композиционный слой приложения. Здесь находятся провайдеры, роутинг и глобальные стили.
- `src/_pages`
  FSD-слой страниц (`pages`). `src/pages` — только роутинг Astro (тонкие entry points).
- `src/pages`
  File-based routing Astro: импорт и рендер из `@/_pages/*`.
- `src/widgets`
  Самостоятельные и полноценные блоки для страниц (шапка, футер, сайдбар и т.д.).
- `src/features`
  Взаимодействия с пользователем, действия, которые несут бизнес-ценность для пользователя.
- `src/entities`
  Бизнес-сущности приложения (пользователь, товар, заказ и т.д.).
- `src/shared`
  Переиспользуемый код, не имеющий отношения к специфике приложения:
    - `ui` - UI-kit компоненты
    - `api` - API-сервисы
    - `config` - конфигурация
    - `lib` - вспомогательные библиотеки
    - `types` - глобальные типы
    - `utils` - утилиты

## Переключение между SSG и SSR

По дефолту активен режим SSG: при сборке проекта генерируются html-страницы. Обновление контента возможно только при ребилде.

При нужно обновлять контент из внешнего источника (например, админки), активируйте режим SSR (нужен Node.js + Nginx на сервере):

```ts
// astro.config.ts

export const SSR_ENABLED = true;
```

##  Типограф

На проекте настроен типограф: поддерживаются русский и английский языки.
Используется так:

```tsx
import { tp } from '@/shared/lib/formatting';

const typografedText = tp('Эта строка будет типографирована');
```

Второй аргумент функции - `locale`:

```tsx
import { tp } from '@/shared/lib/formatting';

const typografedText = tp(
    'Эта строка будет типографирована, следуя правилам типографики русского языка (дефолтное поведение)',
    'ru',
);
```

```tsx
import { tp } from '@/shared/lib/formatting';

const typografedText = tp('Эта строка будет типографирована, следуя правилам типографики английского языка', 'en');
```

## Website metadata и web app manifest

Единый конфиг бренда: [`src/shared/config/website-metadata.ts`](src/shared/config/website-metadata.ts) (`WEBSITE_METADATA`).

Оттуда берутся:

- `name` / `shortName` / `themeColor` / `backgroundColor` / пути иконок;
- title в `getCommonPageProps`;
- `<meta name="theme-color">` и `<link rel="apple-touch-icon">` в `RootLayout`;
- `/site.webmanifest` — endpoint [`src/pages/site.webmanifest.ts`](src/pages/site.webmanifest.ts) собирает JSON через `buildManifest()` при билде (`Content-Type: application/manifest+json`).

При старте проекта замени плейсхолдеры `[APP_TITLE]`, `[APP_SHORT_NAME]` и цвета на реальные.

### Иконки манифеста

Источник — `public/static/favicon.svg`. Скрипт `pnpm pwa-icons` пишет в `public/static/img/`:

- `icon-192.png`, `icon-512.png` — для installability (Chrome);
- `icon-maskable-512.png` — adaptive icon (safe zone ~80%);
- `apple-touch-icon.png` — iOS home screen;
- копия `favicon.svg` рядом с PNG.

PNG коммитятся в репо. После смены favicon — снова `pnpm pwa-icons`.

## CSP и сторонние скрипты

Политику собирает `buildCspConfig` (`src/shared/lib/utils/csp.ts`), Astro добавляет хеши своих скриптов. По умолчанию сторонние хосты закрыты. Сервисы проекта перечисляются в `src/shared/config/csp`:

```ts
export const CSP_ENABLED_INTEGRATIONS: readonly CspIntegration[] = ['yandexMetrica', 'calltouch'];
```

Доступно: `yandexMetrica`, `gtm`, `googleAnalytics`, `calltouch`, `vkPixel`, `yandexMaps`, `recaptcha`, `yandexSmartCaptcha`, `rollbar` (клиентский), `youtube`, `rutube` (iframe видео, в том числе из WYSIWYG CMS). Список читается при сборке. Нужного хоста нет — добавьте запись в `CSP_INTEGRATIONS` по документации сервиса.

Счётчики подключаются готовыми компонентами из `@/shared/lib/analytics`, в начале `<body>` (там же их `<noscript>`):

```astro
---
import { Calltouch, GoogleAnalytics, GoogleTagManager, Rollbar, VkPixel, YandexMetrika } from '@/shared/lib/analytics';
---

<GoogleTagManager id="GTM-XXXXXXX" />
<YandexMetrika id={YM_ID} ecommerce="dataLayer" />
<GoogleAnalytics id="G-XXXXXXXXXX" />
<VkPixel id="3000000" />
<Calltouch id="mod_id из кабинета Calltouch" />
<Rollbar accessToken="post_client_item токен" />
```

Компоненты счётчиков рендерят официальный сниппет через `InlineScript`. Метрика по умолчанию включает `webvisor`, `clickmap`, `trackLinks`, `accurateTrackBounce`, их можно выключить пропсами. Счётчики стартуют, только когда страницу реально открыли: страницы, которые браузер заранее отрисовал по speculation rules, визит не засчитывают. `Rollbar` — клиент из npm-пакета `rollbar`, собранный Vite в обычный `<script>` (хеш не нужен, CDN не нужен, только `connect-src api.rollbar.com`). Ловит необработанные ошибки и rejection'ы, ошибки ботов (тот же список user agent, что у серверного Rollbar, `shared/lib/rollbar/bots.ts`) отбрасывает через `checkIgnore`, окружение берёт из `PUBLIC_ENV`, в `local` не включается. Стартует сразу, в том числе на пререндеренной странице: ошибка там — настоящая ошибка кода, а отложенный старт пропустил бы ошибки до активации. Бандл ≈82 КБ (≈26 КБ gzip), грузится только на страницах с компонентом. Если сервиса компонента нет в `CSP_ENABLED_INTEGRATIONS`, рендер падает с ошибкой: при сборке статики, в SSR на первом запросе страницы.

Свой инлайн-код вставляйте через `InlineScript`, он кладёт хеш кода в политику. Обычный `<script is:inline>` без хеша политика блокирует:

```astro
import InlineScript from '@/shared/ui/InlineScript';
<InlineScript code={snippet} />
```

GTM: Custom HTML теги с инлайн-скриптами и Custom JavaScript переменные не проходят хеши. Перенесите их в Custom Templates или в код сайта. Если нельзя, `unsafeInlineScripts` включает `'unsafe-inline'` и `'unsafe-eval'`, и защита от инлайн-инъекций пропадает для всего сайта. `yandexMaps` добавляет `'unsafe-eval'` (нужен векторному движку карт), `yandexSmartCaptcha` разрешает инлайн `<style>` (виджет вставляет свои стили).

## Seo

В проекте есть компонент который добавляет микроразметку JSON-LD для поисковиков, можно найти тут `src/shared/lib/seo/JsonLd.astro`. Пример ниже

```astro
---
import { JsonLd } from '@/shared/lib/seo';

type Props = {
    product: {
        name: string;
        image: string[];
        description: string;
        brand: string;
        currency: string;
        price: string;
    };
};

const { product } = Astro.props;

const jsonLdData = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    image: product.image,
    description: product.description,
    brand: {
        '@type': 'Brand',
        name: product.brand,
    },
    offers: {
        '@type': 'Offer',
        priceCurrency: product.currency,
        price: product.price,
        availability: 'https://schema.org/InStock',
        url: Astro.url.href,
    },
};
---

<JsonLd data={jsonLdData} />

<div>
    <h1>{product.name}</h1>
    <img src={product.image[0]} alt={product.name} />
    <p>{product.description}</p>
</div>
```

## Функции vh() в css - Исправление скачков в браузере

### Проблема

если выставлена высота в `svh/dvh/lvh/vh` телеграм долго перерисовывает высоту блока- что приводит к скачкам внутри страницы при скроле

### Решение

- Добавлена новая функция, которая позволяет понять, зашел ли пользователь с телеграмм версии браузера

- использовать вместо стандартных единиц `svh/dvh/lvh/vh` функцию миксина vh(значение) если пользователь зашел с телеграмм версии браузера, будет использована расчитанная еденица vh \* значение

### Пример

```scss
.first-block {
    height: vh(100, 1dvh);
}
```

- `height: vh(100)` - будет означать что при появлении панели управления, строки поиска - в мобильных браузерах блок будет занимать максимальную высоту экрана (без учета панели управления и строки поиска)
- 1dvh будет fallback, если --mobile-vh не будет определена (только в случае, если мы зашли с обычного браузера)

- отсюда появляется проблема - если какой то контент должен быть прижат к низу экрана, его может закрыть строка поиска или панель управления - за это отвеает css переменная `--mobile-difference-minvh-vh` - это разница между максимальной и минимальной высотой экрана - на это расстояние можно сместить контент
