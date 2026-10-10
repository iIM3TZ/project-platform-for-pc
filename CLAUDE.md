# PC Parts Price Comparison Platform

## What this project is
A web platform for the Saudi market that compares prices of PC parts and peripherals across several online stores (Amazon.sa, Noon, AliExpress, local PC stores) and lets users build a PC.

Main features:
1. **Compare**: search a part and see every store's offer side by side: price in SAR, shipping cost, delivery time, and a store trust score.
2. **Build your PC**: pick core parts (CPU, motherboard, RAM, GPU, storage, PSU, case, cooler) with automatic compatibility checks, plus optional peripherals (monitor, mouse, keyboard, headset...). Later: a budget-based build suggestion.
3. **Cart**: collects all chosen parts, grouped by store, with total cost, each product link, and the longest delivery time.
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
- `stores`: id, name, website, logo_url, ships_from, avg_delivery_days, has_warranty, return_policy, trust_score
- `products`: id, category_id, brand, name, model, image_url, specs (JSONB, fields depend on category)
- `offers`: id, product_id, store_id, price, shipping_cost, currency, delivery_days_min, delivery_days_max, url, in_stock, updated_at
- `price_history`: id, offer_id, price, recorded_at
- `users`: id, name, email (unique), password_hash, created_at
- `builds`: id, user_id, name, budget, purpose, updated_at
- `build_items`: id, build_id, product_id, offer_id, quantity

Later: `price_alerts`, `notifications`.

Examples of `specs` by category:
- CPU: `{ "socket": "AM5", "cores": 6, "tdp_w": 65, "integrated_gpu": true }`
- Motherboard: `{ "socket": "AM5", "ram_type": "DDR5", "form_factor": "ATX", "ram_slots": 4 }`
- RAM: `{ "ram_type": "DDR5", "capacity_gb": 32, "speed_mhz": 6000, "modules": 2 }`
- GPU: `{ "tdp_w": 115, "length_mm": 240, "outputs": ["HDMI 2.1", "DP 1.4a"] }`
- PSU: `{ "wattage": 650, "rating": "80+ Gold" }`
- Case: `{ "supported_form_factors": ["ATX", "mATX", "ITX"], "max_gpu_length_mm": 330 }`
- Monitor: `{ "size_in": 27, "resolution": "2560x1440", "refresh_hz": 165, "panel": "IPS", "inputs": ["HDMI", "DP"] }`
- Mouse: `{ "wireless": true, "weight_g": 60, "dpi": 26000 }`
- Keyboard: `{ "layout": "75%", "switch_type": "linear", "arabic_letters": true }`

## Compatibility rules (server/src/services/compatibility.js)
Core parts (errors, block the build):
- CPU socket must match motherboard socket.
- RAM type must match motherboard RAM type.
- Motherboard form factor must be supported by the case.
- GPU length must fit the case max GPU length.
- Total estimated power (sum of TDPs + ~100W for the rest) must be below PSU wattage with ~20% headroom.

Peripherals (warnings only, do not block):
- High resolution/refresh monitor with a weak GPU.
- Monitor input not available on the GPU outputs.

Each rule returns `{ level: "error" | "warning", message_ar: "...", parts: [ids] }`.

## Conventions
- Code, file names, variables, DB columns and API routes in **English**. All user-facing text in **Arabic**.
- Pages use `<html lang="ar" dir="rtl">`. Use CSS logical properties (`margin-inline-start`, `padding-inline`) instead of left/right.
- **SQL**: always parameterized queries (`$1, $2`). Never build SQL by string concatenation.
- **API**: REST under `/api` (e.g. `GET /api/products?category=gpu&q=4060`, `GET /api/products/:id/offers`). Consistent JSON: `{ data }` on success, `{ error: { message } }` on failure, correct HTTP status codes.
- Validate all input on the server. Central error-handling middleware.
- `async/await` everywhere, no callback chains.
- Secrets only in `.env` (never committed). Keep `.env.example` updated.
- Money: store as `NUMERIC(10,2)` in SAR. Format in the UI with `Intl.NumberFormat('ar-SA')`.

## Design rules (frontend)
- `client/css/base.css` defines all design tokens as CSS variables (colors, fonts, spacing, radius) and the shared components (buttons, cards, tables, form fields, badges). Pages never hardcode colors or font families.
- Mobile-first and responsive. Every page must work at 375px width without horizontal scrolling.
- Arabic-friendly font from Google Fonts (e.g. IBM Plex Sans Arabic) with a fallback stack.
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
- Create tables: run `server/db/schema.sql` in pgAdmin or with `psql`
