# Spooky Auction Sniper

Mineflayer-бот для SpookyTime AH:

1. Берёт список запросов из `items.txt` (по одному предмету в строку) и/или `AH_SEARCH_QUERIES`.
2. Для каждого запроса делает `/ah search <предмет>` с КД 1 секунда.
3. Парсит лоты, сохраняет уникальную связку `displayName + minecraft type + identityHash` и минимальную цену за штуку.
4. В `data/price-memory.json` пишет цену покупки `минимум - 20%`.
5. После скана открывает общий `/ah`, обновляет каждые 250 мс, ищет подходящие лоты и кликает покупку + подтверждение.
6. Каждые 40 секунд закрывает AH, двигается 1 секунду и открывает `/ah` обратно.

## Запуск

```bash
npm install
BOT_USERNAME=Nick BOT_PASSWORD=secret npm start
```

## Настройки

Основные переменные окружения:

- `AH_SEARCH_QUERIES="Серебро,Алмаз,Зелье"` — дополнительно к `items.txt`.
- `DEAL_DISCOUNT_PERCENT=20` — насколько дешевле минимума покупать.
- `AH_REFRESH_INTERVAL_MS=250` — КД между обновлениями общего AH.
- `AH_AUTO_BUY=1` — включить покупку; `0` только логирует выгодные лоты.
- `ANTI_AFK_INTERVAL_MS=40000` и `ANTI_AFK_WALK_MS=1000` — анти-AFK.
- `BOT_USERNAME`, `BOT_PASSWORD`, `SPOOKY_HOST`, `TARGET_AN` — подключение и авторизация.
