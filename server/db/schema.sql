-- PC Parts Price Comparison: database schema (PostgreSQL)
-- Run once on an empty database, e.g. in pgAdmin's Query Tool or with:
--   psql -U postgres -d pc_parts -f server/db/schema.sql
-- Field definitions: docs/categories.md, docs/compatibility.md, docs/pages.md


-- ============================================================
-- Catalog: categories, stores, products, offers, price history
-- ============================================================

CREATE TABLE categories (
  id      SERIAL PRIMARY KEY,
  slug    TEXT NOT NULL UNIQUE,                 -- 'cpu', 'gpu', 'monitor'...
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  kind    TEXT NOT NULL CHECK (kind IN ('core', 'peripheral', 'prebuilt'))
);

CREATE TABLE stores (
  id                SERIAL PRIMARY KEY,
  name              TEXT NOT NULL UNIQUE,
  website           TEXT NOT NULL,
  logo_url          TEXT,
  ships_from        CHAR(2) NOT NULL,           -- country code: 'SA' is local, anything else is international
  avg_delivery_days INTEGER CHECK (avg_delivery_days >= 0),
  has_warranty      BOOLEAN NOT NULL DEFAULT false,
  return_policy_ar  TEXT,
  return_policy_en  TEXT,
  trust_score       NUMERIC(3,1) CHECK (trust_score BETWEEN 0 AND 10)
);

CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  brand       TEXT NOT NULL,                    -- the maker: ASUS, MSI, AMD, Samsung...
  name        TEXT NOT NULL,
  model       TEXT,
  image_url   TEXT,
  specs       JSONB NOT NULL DEFAULT '{}',      -- fields depend on the category (docs/categories.md)
  view_count  INTEGER NOT NULL DEFAULT 0,       -- for "most searched parts" on the home page
  is_hidden   BOOLEAN NOT NULL DEFAULT false,   -- hidden parts disappear from the site but stay in builds
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX products_category_idx ON products (category_id);
CREATE INDEX products_specs_idx ON products USING GIN (specs);   -- fast filters on specs fields

CREATE TABLE offers (
  id                SERIAL PRIMARY KEY,
  product_id        INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id          INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  seller_name       TEXT NOT NULL,
  is_official       BOOLEAN NOT NULL DEFAULT false,   -- sold by the store itself ("Sold by Amazon")
  seller_rating     NUMERIC(2,1) CHECK (seller_rating BETWEEN 0 AND 5),
  seller_reviews    INTEGER CHECK (seller_reviews >= 0),
  price             NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  shipping_cost     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  currency          CHAR(3) NOT NULL DEFAULT 'SAR' CHECK (currency IN ('SAR', 'USD')),
  delivery_days_min INTEGER CHECK (delivery_days_min >= 0),
  delivery_days_max INTEGER,
  url               TEXT NOT NULL,
  in_stock          BOOLEAN NOT NULL DEFAULT true,
  is_hidden         BOOLEAN NOT NULL DEFAULT false,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (delivery_days_max >= delivery_days_min),
  -- the same seller is listed once per product and store
  -- (the limit of two sellers per store is checked in the admin API)
  UNIQUE (product_id, store_id, seller_name)
);

CREATE INDEX offers_product_idx ON offers (product_id);

CREATE TABLE price_history (
  id          SERIAL PRIMARY KEY,
  offer_id    INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  price       NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX price_history_offer_idx ON price_history (offer_id, recorded_at);


-- ============================================================
-- Users, builds, shopping list, notifications
-- ============================================================

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL CHECK (username ~ '^[A-Za-z0-9_]{3,20}$'),
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,                  -- bcrypt hash, never the password itself
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- unique without caring about letter case: "Ali" and "ali" are the same user
CREATE UNIQUE INDEX users_username_unique ON users (LOWER(username));
CREATE UNIQUE INDEX users_email_unique ON users (LOWER(email));

CREATE TABLE builds (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  budget     NUMERIC(10,2) CHECK (budget >= 0),   -- in SAR, optional
  purpose    TEXT,                                -- e.g. gaming, work, streaming
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX builds_user_idx ON builds (user_id);

CREATE TABLE build_items (
  id         SERIAL PRIMARY KEY,
  build_id   INTEGER NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  offer_id   INTEGER REFERENCES offers(id) ON DELETE SET NULL,   -- NULL means "use the cheapest offer"
  quantity   INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0)
);

CREATE INDEX build_items_build_idx ON build_items (build_id);

CREATE TABLE shopping_list_items (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  offer_id   INTEGER REFERENCES offers(id) ON DELETE SET NULL,   -- NULL means "use the cheapest offer"
  quantity   INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX shopping_list_items_user_idx ON shopping_list_items (user_id);

CREATE TABLE notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_ar TEXT NOT NULL,
  message_en TEXT NOT NULL,
  link       TEXT,                              -- page to open, e.g. '/build.html?id=4'
  read_at    TIMESTAMPTZ,                       -- NULL until the user closes it
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notifications_unread_idx ON notifications (user_id) WHERE read_at IS NULL;
