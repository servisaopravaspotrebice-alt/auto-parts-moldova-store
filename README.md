# AutoPiese Moldova

Independent mobile-first multilingual auto parts store for the Moldovan market. Does not share code, data or infrastructure with the owner's other projects.

## Features
- Romanian (default), Russian, Ukrainian and English UI.
- Catalog search, vehicle/OEM search, condition filters, mobile-friendly part request and request list.
- Authorized DED Auto supplier catalog ingestion from public product pages (GoMag storefront). Supplier prices in RON are marked up **exactly once by 20%**. Original supplier prices are never surfaced to customers.
- Four display currencies (MDL, RON, EUR, USD), based on BNM official exchange rates. If BNM cannot be reached, the interface discloses an explicitly dated reference rate, never a fake live rate.
- Privacy-aware form sent via Telegram Bot API from the backend; secrets must be configured only via environment.
- Clear disclosure that online payments, final compatibility and shipping need seller confirmation.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:10000`. The site starts with one verified supplier product and asynchronously attempts to import the other authorized DED Auto product pages. If supplier rate-limits, the existing catalog continues to load and `/api/status` reports the sync problem. All available products refresh daily while the app is running. Run a manual refresh with `POST /api/admin/sync` and `X-Admin-Key` only after setting `ADMIN_KEY`.

## Deploy on Render
- Runtime: Node, Frankfurt, plan `free` if available; build command `npm install`; start command `npm start`.
- Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` privately in Render > Environment before accepting leads. Without them, leads return HTTP 503 and the frontend honestly explains that delivery is not configured (rather than losing customer data or pretending it was delivered).
- `/health` checks application health; `/api/status` shows readiness and import status.
- Optional `ENABLE_SUPPLIER_SYNC=false` pauses importer.

## Important scope
- This is an initial inquiry-based storefront, **not yet a fully integrated online checkout/payment gateway**. No customer order is confirmed as paid.
- Catalog sync is an in-memory import on Render free tier; persistence, proper supplier API/feed, stock management, scheduled background jobs and administration require a persistent database before production scale.
- Seller must confirm final price and compatibility before purchase; refurbished items are not falsely described as used.
- Add verified business legal details, privacy policy, cookies where necessary, shipping/returns terms and payment processor before promoting as a fully operational checkout store.

## Catalog presentation (2026-11-11)
- Product photos are shown without CSS color blending or filters (`mix-blend-mode: normal`, `filter: none`); source photographs are not altered.
- Catalog and parts list show prices rounded to **whole units** of the selected currency, after the single 20% markup and BNM exchange-rate conversion.
- Telegram request line prices use the same whole-unit rounded currency amounts.

## Корзина → Telegram (v7)
- После добавления товаров посетитель открывает корзину и вводит телефон в форме «Оформить заказ».
- Сервер проверяет товары по внутреннему каталогу, рассчитывает цены, сохраняет заказ и отправляет одно или несколько сообщений в Telegram с номером заказа, телефоном, VIN, перечнем SKU, количеством, суммами и итогом.
- Если Telegram не настроен, API явно сообщает об этом и хранит заявку со статусом awaiting_telegram_setup. Ложное подтверждение отправки не показывается.
- В админке доступен просмотр заказов, статусы и повторная отправка уведомления.
- Для долговременного хранения нужно включить DATABASE_URL: без Postgres локальные файлы на Render могут пропасть при перезапуске.
- Настройте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID **только в Render Environment**; никогда не размещайте их в GitHub.

## Cart and footer revision
The footer has an admin-login link to `/admin` but all private endpoints still require cookie-backed server authorization. The mobile cart uses a dark high-contrast layout and one direct checkout form.


## Release 14 (2026-11-12)
- Speed headline updated in RO/RU/UK/EN: less than one minute to complete a request. This is a call-to-action, not a guaranteed turnaround time.
- Supplier scanner shows descriptive diagnoses and recommended actions beside the field.
- Differentiates confirmed restricted access from readable pages without product links.
- No catalog/price/order mutations in this release (server restart on ephemeral store remains a separate limitation).

## Release 15 — staging acceptance test
- Modern centered contact block with a prominent scarlet call button and WhatsApp/Viber brand icons below it. The floating contact rail remains present.
- Independent admin language menu (RU/RO/UA/EN), saved locally in the administrator's browser only. Does not change buyer language or product content. Static admin UI and commonly generated messages have locale dictionaries.
- New admin-only Telegram panel: connection status, test notification, and private bot `getUpdates` discovery for the recipient chat ID. Bot credentials never leave the Render secret manager.
- The cart order endpoint already sends validated SKUs, quantities, rounded prices, totals, customer phone and VIN from the Node server. It returns an error if Telegram notification fails, and retains pending orders for resending when persistent storage is configured.

### Connect Telegram (owner action required)
1. Open official Telegram [@BotFather](https://t.me/BotFather) and use `/newbot`. Keep the generated token private.
2. Open the newly created bot in Telegram and press **Start** (send `/start`).
3. In the Render **Environment** panel for the target service, add `TELEGRAM_BOT_TOKEN` with the token, then redeploy.
4. Sign in to `/admin`, choose **Find chat ID**, and copy your private chat ID (or the group ID after adding the bot to the group and sending a message).
5. Add `TELEGRAM_CHAT_ID` to Render **Environment** and redeploy. Then click **Send test message** in `/admin`.
6. Place a sample order using a non-sensitive test phone number that you control; verify its line items and phone number in Telegram.

**Important:** A private chat must have started the bot before the bot can write to it. Do not send credentials through ChatGPT or commit them to GitHub.

### Own domain (when available)
Render → Web Service → Settings → Custom Domains → Add Custom Domain; configure DNS at the registrar, then verify domain and TLS certificate in Render. Until a custom domain is provided, use the independent `onrender.com` hostname for staging.

### Data safety
The existing AutoPiese production service uses temporary file storage (status `persistent=false`). Never treat it as production-grade order storage. A connected PostgreSQL database and tested backup/restore procedures are required before accepting real customer orders; migrating may require a snapshot of existing admin edits.
