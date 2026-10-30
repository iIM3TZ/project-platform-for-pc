# Dalilak (دليلك)

**Compare PC part prices across Saudi stores, and build your PC in 3D with compatibility checks.**

Dalilak collects offers for PC parts from online stores in Saudi Arabia (Amazon.sa, Noon, AliExpress,
local PC shops...) and shows them side by side in Saudi riyals, with shipping and delivery time. Users
can then put a whole PC together on an interactive 3D case: every part they pick is checked against the
others (socket, RAM type, sizes, power), and the total updates live.

The site sells nothing and takes no payments: each offer links to its store.

> Status: in development. A live link and screenshots will be added after the first deploy.
> The plan and progress are in [TASKS.md](TASKS.md).

## Features

### Compare prices
- Parts in 13 categories: CPU, motherboard, RAM, GPU, storage, power supply, case, CPU cooler,
  monitor, mouse, keyboard, headset and prebuilt PCs.
- Each part page lists its offers by store, with the **cheapest** and the **most trusted** offer
  (official seller first, then store trust score, seller rating and reviews).
- Prices in SAR (offers in USD or other currencies are converted), shipping and delivery days,
  and a customs/VAT note for international stores.
- Search, filters per category (socket, chipset, VRAM, panel type...), sort by price, name or date added.

### Build your PC
- An interactive **3D PC case** made with three.js: drag to turn it, click a part's circle to pick it.
  Parts that are not chosen yet show as outlines of where they go, so beginners see where each part sits.
  Falls back to a flat SVG drawing when WebGL is not available.
- A part picker with search, price filter and a **"compatible only"** switch.
- **14 compatibility rules** on the server: CPU socket, RAM type, RAM slots and capacity, M.2 slots,
  motherboard size vs case, GPU length and thickness, cooler needed / socket / height, power supply
  wattage, and monitor vs GPU (power and ports). See [docs/compatibility.md](docs/compatibility.md).
- A live bar with the total price, build status, compatibility status and estimated power draw.
- **Ready-made PC suggestion**: when the build has a CPU and a GPU, it shows the cheapest prebuilt PC
  with the same GPU and a CPU of the same class or one lower, and the price difference.
- Several builds per user in tabs (rename, duplicate, delete), saved right away.

### Accounts and My list
- Sign up / sign in with username or email; passwords hashed with bcrypt; JWT in an httpOnly cookie.
- Guests keep their builds and list in the browser; they move to the account after sign-in.
- **My list** (قائمتي): single offers or a whole build, grouped by store, with each store's total,
  the grand total and the longest delivery time.

### Admin
- Admin-only page (checked on the server) to add and edit parts, offers and pictures, and to give or
  remove admin access.

### Arabic and English
- Full RTL/LTR support with CSS logical properties, all text from translation files, light and dark themes.

## Tech stack

| Layer    | Tools |
|----------|-------|
| Backend  | Node.js, Express 5, PostgreSQL (`pg`, parameterized queries) |
| Auth     | bcryptjs, jsonwebtoken, cookie-parser |
| Frontend | Vanilla JavaScript (ES modules), HTML, CSS (no framework) |
| 3D       | three.js (served from `node_modules`) |

Only free, open-source libraries; no paid or AI APIs.

## Project structure

```
client/              # the website (static files served by Express)
  pages/             # HTML pages
  css/               # base design tokens + one file per page
  js/
    pages/           # one script per page
    components/      # navbar, part picker, 3D case, builds bar...
    locales/         # ar.json, en.json
server/
  db/
    schema.sql       # tables
    seed.sql         # categories, stores, parts and offers
    migrations/      # changes for databases created before them
  src/
    routes/          # URL -> controller
    controllers/     # request checks and responses
    models/          # SQL queries
    services/        # compatibility rules, pricing, prebuilt match...
    middleware/      # auth, validation, errors
docs/                # categories and spec fields, compatibility rules, pages
```

## Run it locally

Requirements: **Node.js 18+** and **PostgreSQL**.

1. Install the packages:
   ```bash
   npm install
   ```
2. Create a database named `pc_parts`, then run in this order (pgAdmin's Query Tool or `psql`):
   - `server/db/schema.sql`
   - `server/db/seed.sql`

   On a database created earlier, run the files in `server/db/migrations/` (in number order) before the seed.
3. Copy the settings file and fill in your database password and a JWT secret:
   ```bash
   cp .env.example .env
   ```
4. Start the server:
   ```bash
   npm run dev     # development, restarts on changes
   npm start       # production
   ```
5. Open http://localhost:3000

Health check: `GET /api/health` returns `{ "data": { "status": "ok" } }`.

To make yourself admin, sign up on the site, then in the database:
`UPDATE users SET role = 'admin' WHERE username = 'your_name';`

## API overview

Every response is `{ "data": ... }` or `{ "error": { "message", "fields" } }`.

| Area | Endpoints |
|------|-----------|
| Catalog | `GET /api/categories`, `GET /api/stores`, `GET /api/products`, `GET /api/products/:id`, `GET /api/products/:id/offers` |
| Builds | `POST /api/builds/check`, `/compatible`, `/prebuilt-match`, `/refresh` (open to guests); `GET/POST /api/builds`, `PUT/DELETE /api/builds/:id` (signed in) |
| My list | `POST /api/list/details` (guests); `GET/POST/PUT /api/list` (signed in) |
| Accounts | `POST /api/auth/register`, `/login`, `/logout`; `GET /api/auth/me` |
| Admin | `/api/admin/products`, `/offers`, `/product-images`, `/users` (admins only) |

## Docs

- [docs/categories.md](docs/categories.md): categories and the spec fields of each one
- [docs/compatibility.md](docs/compatibility.md): the compatibility rules and what is not checked yet
- [docs/pages.md](docs/pages.md): what each page does

## Credits

- [three.js](https://threejs.org/) (MIT) for the 3D case.
- Product pictures are the makers' official pictures, used with their permission
  (see [client/images/products/README.md](client/images/products/README.md)).

## Disclaimer

Prices and stock can change at any time in the stores; always check the store page. Dalilak is not
affiliated with the stores or brands it lists.
