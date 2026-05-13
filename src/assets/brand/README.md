# integrate.ai — brand assets

## Master SVG (используй эти для всего, где можно)

| Файл | Назначение |
|---|---|
| `logo-full.svg` | Полный логотип на **тёмном** фоне (белый текст). Шапка сайта, презентации, документация в тёмной теме. |
| `logo-full-onlight.svg` | Полный логотип на **светлом** фоне (тёмный текст). Печать, светлая тема, email. |
| `logo-mark.svg` | Только знак (три полоски). Прозрачный фон. Для всего, что меньше ~120px по ширине. |
| `logo-mark-square.svg` | Знак на тёмной плашке со скруглением 22%. Для app icons. |
| `favicon.svg` | Векторный favicon. Современные браузеры рендерят его на любом размере. |

## Растровые версии

### Favicon / web
- `favicon.ico` — multi-resolution (16/32/48), для `<link rel="icon">` и legacy-браузеров
- `favicon-16.png`, `favicon-32.png`, `favicon-48.png` — отдельные PNG
- `icon-24.png` — Material Design размер

### App icons
- `apple-touch-icon.png` — 180×180, для iOS (`<link rel="apple-touch-icon">`)
- `icon-192.png`, `icon-512.png` — PWA / Android Chrome (`manifest.json`)

### Социальные сети
- `og-image.png` — 1200×630, для Open Graph (`<meta property="og:image">`)
- `twitter-card.png` — 1200×630, для Twitter `summary_large_image`
- `social-banner-1500x500.png` — GitHub social preview, Twitter header

### Полный логотип в PNG (если SVG не подходит)
- `logo-full-600w.png` — 600×97
- `logo-full-1200w.png` — 1200×194
- `logo-full-2400w.png` — 2400×387 (retina)

## Подключение в HTML

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.json">

<meta property="og:image" content="https://your-domain/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://your-domain/twitter-card.png">
```

## Палитра

| Цвет | HEX | RGB |
|---|---|---|
| Cyan (верхняя полоса) | `#08B6E6` | 8, 182, 230 |
| Purple (средняя) | `#6B20ED` | 107, 32, 237 |
| Orange (нижняя) | `#F2971C` | 242, 151, 28 |
| Background | `#0A0A0A` | 10, 10, 10 |
| Text on dark | `#FFFFFF` | 255, 255, 255 |
| Text on light | `#0A0A0A` | 10, 10, 10 |
