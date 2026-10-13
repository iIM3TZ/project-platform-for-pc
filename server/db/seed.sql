-- Sample data. Run after schema.sql, in pgAdmin's Query Tool on the pc_parts database.
-- Safe to run more than once: rows that already exist are skipped (ON CONFLICT DO NOTHING).


-- ============================================================
-- Categories (from docs/categories.md)
-- ============================================================

INSERT INTO categories (slug, name_en, name_ar, kind) VALUES
  ('cpu',         'CPU',          'المعالج',       'core'),
  ('motherboard', 'Motherboard',  'اللوحة الأم',   'core'),
  ('ram',         'RAM',          'الذاكرة',       'core'),
  ('gpu',         'GPU',          'كرت الشاشة',    'core'),
  ('storage',     'Storage',      'التخزين',       'core'),
  ('psu',         'Power Supply', 'مزود الطاقة',   'core'),
  ('case',        'Case',         'الكيس',         'core'),
  ('cooler',      'CPU Cooler',   'مبرد المعالج',  'core'),
  ('monitor',     'Monitor',      'الشاشة',        'peripheral'),
  ('mouse',       'Mouse',        'الماوس',        'peripheral'),
  ('keyboard',    'Keyboard',     'لوحة المفاتيح', 'peripheral'),
  ('headset',     'Headset',      'السماعة',       'peripheral')
ON CONFLICT (slug) DO NOTHING;


-- ============================================================
-- Stores
-- Only name, website and where they ship from for now. Delivery days,
-- warranty, return policy and trust score are filled in later from the
-- admin page, after checking each store.
-- ============================================================

INSERT INTO stores (name, website, ships_from) VALUES
  ('Amazon.sa',  'https://www.amazon.sa',      'SA'),
  ('Noon',       'https://www.noon.com',       'SA'),
  ('AliExpress', 'https://www.aliexpress.com', 'CN'),
  ('Newegg',     'https://www.newegg.com',     'US'),
  ('Raiq',       'https://raiq.com/ar-sa',     'SA'),  -- local PC store
  ('InfiniArc',  'https://www.infiniarc.com',  'SA'),  -- local PC store
  ('TTX',        'https://ttx.sa',             'SA'),  -- local PC store
  ('Buff2u',     'https://buff2u.com/ar',      'SA'),  -- local PC store
  ('Era Gaming', 'https://eragaming-sa.com',   'SA')   -- local PC store
ON CONFLICT (name) DO NOTHING;


-- ============================================================
-- Sample products (a few for testing the API; the full 30 to 50 parts
-- come in the seed data task). Specs follow docs/categories.md.
-- A product is skipped if one with the same brand and name already exists.
-- ============================================================

INSERT INTO products (category_id, brand, name, model, specs)
SELECT c.id, v.brand, v.name, v.model, v.specs::jsonb
FROM (VALUES
  ('cpu', 'AMD', 'Ryzen 5 7600X', '100-100000593WOF',
   '{"socket": "AM5", "cores": 6, "threads": 12, "base_clock_ghz": 4.7, "boost_clock_ghz": 5.3, "tdp_w": 105, "includes_cooler": false}'),
  ('gpu', 'ASUS', 'Dual GeForce RTX 4060 OC', 'DUAL-RTX4060-O8G',
   '{"chip_brand": "NVIDIA", "chipset": "RTX 4060", "vram_gb": 8, "tdp_w": 115, "length_mm": 227, "slots": 2.5, "outputs": ["HDMI 2.1", "DP"], "perf_1080p": "excellent", "perf_1440p": "good", "perf_4k": "weak", "recommended_psu_w": 550}'),
  ('ram', 'Corsair', 'Vengeance 32GB (2x16GB) DDR5 6000', 'CMK32GX5M2B6000C30',
   '{"ram_type": "DDR5", "capacity_gb": 32, "speed_mhz": 6000, "modules": 2, "cas_latency": 30}'),
  ('monitor', 'LG', 'UltraGear 27GP850-B', '27GP850-B',
   '{"size_in": 27, "resolution": "2560x1440", "refresh_hz": 165, "panel": "IPS", "inputs": ["HDMI 2.0", "DP"], "response_ms": 1}')
) AS v(category, brand, name, model, specs)
JOIN categories c ON c.slug = v.category
WHERE NOT EXISTS (
  SELECT 1 FROM products p WHERE p.brand = v.brand AND p.name = v.name
);


-- The GPU performance used to be one number (performance_tier); it is now one level per resolution.
-- This updates a GPU that was added before that change.
UPDATE products
SET specs = (specs - 'performance_tier')
            || '{"perf_1080p": "excellent", "perf_1440p": "good", "perf_4k": "weak"}'::jsonb
WHERE name = 'Dual GeForce RTX 4060 OC' AND specs ? 'performance_tier';


-- Product images (files in client/images/products, served at /images/products/...)
UPDATE products SET image_url = v.image_url
FROM (VALUES
  ('Ryzen 5 7600X',                     '/images/products/amd-ryzen-5-7600x.jpg'),
  ('Dual GeForce RTX 4060 OC',          '/images/products/asus-dual-rtx-4060.jpg'),
  ('Vengeance 32GB (2x16GB) DDR5 6000', '/images/products/corsair-vengeance-ddr5-32gb.jpg'),
  ('UltraGear 27GP850-B',               '/images/products/lg-27gp850-b.jpg')
) AS v(name, image_url)
WHERE products.name = v.name;


-- ============================================================
-- Sample offers. Prices are approximate test values, not real store prices,
-- and the links point to the store home page, not to a product page.
-- The GPU has two Amazon sellers and a Newegg offer in USD, to test the
-- "cheapest" and "most trusted" picks and the conversion to SAR.
-- ============================================================

INSERT INTO offers (product_id, store_id, seller_name, is_official, seller_rating, seller_reviews,
                    price, shipping_cost, currency, delivery_days_min, delivery_days_max, url, in_stock)
SELECT p.id, s.id, v.seller, v.official, v.rating, v.reviews,
       v.price, v.shipping, v.currency, v.days_min, v.days_max, s.website, v.in_stock
FROM (VALUES
  -- Ryzen 5 7600X
  ('Ryzen 5 7600X', 'Amazon.sa', 'Amazon.sa', true,  NULL, NULL,  899.00,  0.00, 'SAR', 1, 3,  true),
  ('Ryzen 5 7600X', 'Noon',      'noon',      true,  NULL, NULL,  879.00,  0.00, 'SAR', 1, 4,  true),
  ('Ryzen 5 7600X', 'Raiq',      'Raiq',      true,  NULL, NULL,  949.00, 25.00, 'SAR', 2, 5,  true),
  -- ASUS Dual RTX 4060
  ('Dual GeForce RTX 4060 OC', 'Amazon.sa', 'Amazon.sa', true,  NULL, NULL, 1249.00,  0.00, 'SAR', 1, 3,  true),
  ('Dual GeForce RTX 4060 OC', 'Amazon.sa', 'TechZone',  false, 4.7,  350,  1199.00,  0.00, 'SAR', 2, 5,  true),
  ('Dual GeForce RTX 4060 OC', 'Noon',      'noon',      true,  NULL, NULL, 1229.00,  0.00, 'SAR', 1, 4,  true),
  ('Dual GeForce RTX 4060 OC', 'Newegg',    'Newegg',    true,  NULL, NULL,  299.99, 35.00, 'USD', 7, 14, true),
  -- Corsair Vengeance 32GB DDR5
  ('Vengeance 32GB (2x16GB) DDR5 6000', 'Amazon.sa',  'Amazon.sa',             true,  NULL, NULL, 549.00,  0.00, 'SAR', 1, 3,  true),
  ('Vengeance 32GB (2x16GB) DDR5 6000', 'AliExpress', 'Corsair Official Store', false, 4.8,  1200, 469.00, 25.00, 'SAR', 10, 20, true),
  -- LG UltraGear 27GP850-B (the Amazon offer is out of stock, to test that it is ignored by the picks)
  ('UltraGear 27GP850-B', 'Noon',      'noon',      true, NULL, NULL, 1099.00, 0.00, 'SAR', 1, 4, true),
  ('UltraGear 27GP850-B', 'Amazon.sa', 'Amazon.sa', true, NULL, NULL, 1049.00, 0.00, 'SAR', 1, 3, false)
) AS v(product, store, seller, official, rating, reviews, price, shipping, currency, days_min, days_max, in_stock)
JOIN products p ON p.name = v.product
JOIN stores s ON s.name = v.store
ON CONFLICT (product_id, store_id, seller_name) DO NOTHING;
