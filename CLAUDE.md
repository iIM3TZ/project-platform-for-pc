# PC Parts Price Comparison Platform

## What this project is
A web platform for the Saudi market that compares prices of PC parts and peripherals across several online stores (Amazon.sa, Noon, AliExpress, Newegg, local PC stores) and lets users build a PC.

Main features:
1. **Compare**: search a part and see offers from every store side by side: price in SAR, shipping cost, total (price + shipping), delivery time, and a store trust score. Each store can have up to two trusted sellers, so the page compares sellers inside the same store and across stores, and shows each store's price range (lowest to highest offer) and its best offer. Every part shows two picks: the **cheapest** offer and the **most trusted** offer (official seller first, then store trust score, then seller rating; rules in `docs/pages.md`). Later, with price history, it also shows the lowest and highest price in the last 30 days.
2. **Build your PC**: pick core parts (CPU, motherboard, RAM, GPU, storage, PSU, case, cooler) with automatic compatibility checks, plus optional peripherals (monitor, mouse, keyboard, headset...). Later: a budget-based build suggestion.
3. **Shopping list** (قائمة الشراء): separate from builds. Users add single parts with the offer they chose, or move a whole build into it. Parts are grouped by store, with total cost, each product link, and the longest delivery time. There is no payment on the site; users buy from the stores through the links.
4. **Accounts**: users sign in to save builds and continue where they left off. Guests can build too (saved in localStorage) and their build moves to their account after sign-up.
5. **Price alerts** (later phase): notify a user in the site and by email when a part's price drops.

This is a portfolio (CV) project. Code must be clean, readable and easy to explain in an interview.

## Tech stack (do not add frameworks)
- **Frontend**: plain HTML, CSS and vanilla JavaScript (ES modules). No React, Vue, Tailwind or Bootstrap.
- **Backend**: Node.js + Express, REST API returning JSON.
- **Database**: PostgreSQL using the `pg` library with raw SQL. No ORM.
- **Auth**: bcrypt for password hashing, JWT stored in an httpOnly cookie.
- **Later phases**: node-cron (scheduled price updates), Cheerio (reading product pages), Chart.js (price history), Nodemailer (emails), Jest + Supertest (tests).

Do not install a new dependency without asking first and explaining why it is needed.

## Folder structure
```
/client                 static frontend, served by Express
  /pages                *.html pages
  /css
    base.css            design tokens + shared components (the only place colors/fonts are defined)
    /pages              page-specific styles
  /js
    api.js              all fetch calls to the backend live here
    i18n.js             current language, translation lookup t(key), switching ar/en
    theme.js            light/dark mode switching
    /locales            ar.json and en.json: every UI text, by key
    /components         reusable UI pieces (part card, offers table, alert banner...)
    /pages              one script per page
/server
  /src
    app.js              Express app (middleware, routes, static files)
    server.js           starts the server
    /config/db.js       pg Pool from environment variables
    /routes             route definitions only
    /controllers        request/response handling
    /models             SQL queries (one file per table/area)
    /middleware         auth, validation, error handler
    /services           business logic (compatibility, pricing, trust score)
    /jobs               scheduled jobs (later)
  /db
    schema.sql          CREATE TABLE statements
    seed.sql            sample data
  /tests
.env.example
```

## Database (PostgreSQL)
Core tables:
- `categories`: id, name_ar, name_en, slug, kind (`core` or `peripheral`)
- `stores`: id, name, website, logo_url, ships_from (country code, `SA` = local), avg_delivery_days, has_warranty, return_policy_ar, return_policy_en, trust_score (0 to 10)
- `products`: id, category_id, brand, name, model, image_url, specs (JSONB, fields depend on category), view_count, is_hidden, created_at
- `offers`: id, product_id, store_id, seller_name, is_official, seller_rating, seller_reviews, price, shipping_cost, currency, delivery_days_min, delivery_days_max, url, in_stock, is_hidden, updated_at
  - One product can have up to two offers in the same store (one per seller): the store's cheapest trusted seller and its most trusted seller.
  - Only trusted sellers are added: the store itself (`is_official = true`, e.g. "Sold by Amazon"), or a seller rated 4.5 or higher with at least 100 reviews. The admin checks this before saving.
- `price_history`: id, offer_id, price, recorded_at
- `users`: id, username (unique, used to sign in and shown on the site), email (unique), password_hash, role (`user` or `admin`, default `user`), created_at
- `builds`: id, user_id, name, budget, purpose, created_at, updated_at
- `build_items`: id, build_id, product_id, offer_id, quantity
- `shopping_list_items`: id, user_id, product_id, offer_id, quantity, added_at

- `notifications`: id, user_id, message_ar, message_en, link, read_at, created_at (first used when an admin deletes a part or offer that is in a user's build or shopping list; price alerts reuse it later)

Later: `price_alerts`.

Examples of `specs` by category:
- CPU: `{ "socket": "AM5", "cores": 6, "tdp_w": 65 }`
- Motherboard: `{ "socket": "AM5", "ram_type": "DDR5", "form_factor": "ATX", "ram_slots": 4 }`
- RAM: `{ "ram_type": "DDR5", "capacity_gb": 32, "speed_mhz": 6000, "modules": 2 }`
- GPU: `{ "chip_brand": "NVIDIA", "chipset": "RTX 4060", "tdp_w": 115, "length_mm": 240, "slots": 2.5, "outputs": ["HDMI 2.1", "DP"] }`
- PSU: `{ "wattage": 650, "rating": "80+ Gold" }`
- Case: `{ "supported_form_factors": ["ATX", "mATX", "ITX"], "max_gpu_length_mm": 330 }`
- Monitor: `{ "size_in": 27, "resolution": "2560x1440", "refresh_hz": 165, "panel": "IPS", "inputs": ["HDMI 2.1", "DP"] }`
- Mouse: `{ "wireless": true, "weight_g": 60, "dpi": 26000 }`
- Keyboard: `{ "layout": "75%", "switch_type": "linear", "arabic_letters": true }`

## Compatibility rules (server/src/services/compatibility.js)
The full list, with the exact checks and the Arabic/English messages, is in `docs/compatibility.md`. Summary:

Core parts (errors: the build is not marked as ready):
- CPU socket matches the motherboard; RAM type, RAM sticks and max RAM fit the motherboard; M.2 drives fit the M.2 slots.
- Motherboard size, GPU length and GPU thickness fit the case.
- A cooler is added when the CPU has none; it supports the CPU socket and an air cooler fits the case height.
- Power: CPU TDP + GPU TDP + 100 W must not exceed the PSU wattage (warning below 20% headroom).

Peripherals (warnings only, do not block):
- High resolution/refresh monitor with a weak GPU.
- Monitor input not available on the GPU outputs.

A rule runs only when its parts are chosen, and is skipped when an optional field is missing.
Each rule returns `{ level: "error" | "warning", message_ar: "...", message_en: "...", parts: [ids] }`.

## Conventions
- Code, file names, variables, DB columns and API routes in **English**.
- **Two languages**: the site is in Arabic (default) and English, with a language switch in the navigation bar. The choice is saved in localStorage.
  - UI text never goes directly in HTML or JS. It lives in `client/js/locales/ar.json` and `en.json` and is read with `t(key)` from `i18n.js`. Both files must have the same keys.
  - Data shown to users has both languages in the database (`name_ar` / `name_en`, `message_ar` / `message_en`). The API returns both and the client picks one.
  - Arabic pages use `<html lang="ar" dir="rtl">`, English pages `lang="en" dir="ltr"`; switching the language updates both attributes. Use CSS logical properties (`margin-inline-start`, `padding-inline`) instead of left/right so the layout works in both directions.
- **SQL**: always parameterized queries (`$1, $2`). Never build SQL by string concatenation.
- **API**: REST under `/api` (e.g. `GET /api/products?category=gpu&q=4060`, `GET /api/products/:id/offers`). Consistent JSON: `{ data }` on success, `{ error: { message } }` on failure, correct HTTP status codes.
- Validate all input on the server. Central error-handling middleware.
- **Roles**: every user is `user` or `admin`. Admin-only actions (adding or editing parts, stores and offers, updating prices, managing users) are protected on the server by a `requireAdmin` middleware that returns 403 for anyone else. Hiding a button in the UI is not protection.
  - The first admin is set with SQL (`UPDATE users SET role = 'admin' WHERE email = ...`). After that, an admin can make another user admin, or remove it, from the admin page. An admin cannot remove their own admin role, so the site never ends up with no admin.
- `async/await` everywhere, no callback chains.
- Secrets only in `.env` (never committed). Keep `.env.example` updated.
- Money: store as `NUMERIC(10,2)`. Offers keep the store's own price and `currency` (most are `SAR`; international stores such as Newegg may be `USD`). The API converts every price to SAR with a fixed rate from config (1 USD = 3.75 SAR) before comparing or adding totals, so users always see SAR. Format in the UI with `Intl.NumberFormat` for the current language.
- International stores (`ships_from` outside Saudi Arabia, e.g. Newegg, AliExpress) show a note that customs fees or VAT may be added on delivery.

## Design rules (frontend)
- `client/css/base.css` defines all design tokens as CSS variables (colors, fonts, spacing, radius) and the shared components (buttons, cards, tables, form fields, badges). Pages never hardcode colors or font families.
- **Search bar** in the navigation bar on every page: searches parts by name, brand or model and opens the parts listing page with the results.
- **Light and dark mode**: colors are defined twice in `base.css`, once for light and once under `[data-theme="dark"]` on `<html>`. The first visit follows the system setting (`prefers-color-scheme`); a toggle in the navigation bar overrides it and the choice is saved in localStorage. Both themes must have readable contrast.
- Mobile-first and responsive. Every page must work at 375px width without horizontal scrolling.
- A font that supports Arabic and English from Google Fonts (e.g. IBM Plex Sans Arabic) with a fallback stack.
- Accessible: real `<button>` and `<label>` elements, visible focus states, alt text on images.
- Show loading, empty and error states for every list fetched from the API.

## How to work on tasks
- Work on **one task at a time**, exactly as described. Do not build ahead into later phases.
- Before writing code, briefly state the plan: which files you will create or change.
- After finishing, explain what you did and how to test it (example requests, or which page to open).
- Keep functions small and named clearly. Add short comments only where the logic is not obvious (e.g. compatibility rules).
- If something in the task is unclear or conflicts with this file, ask instead of guessing.

## Commands
- `npm run dev`: start the server with nodemon
- `npm start`: start the server
- `npm test`: run tests (later phase)
- Create tables: run `server/db/schema.sql` in pgAdmin
- Sample data: run `server/db/seed.sql` in pgAdmin after the schema (safe to run again)

## Database access
- Do not connect to the database or run any database commands (`psql`, `pg_isready`, scripts that query the database). Write the SQL in files (e.g. `server/db/schema.sql`, `server/db/seed.sql`) and the project owner runs them in pgAdmin.
