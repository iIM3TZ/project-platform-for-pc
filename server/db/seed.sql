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
  ('headset',     'Headset',      'السماعة',       'peripheral'),
  ('prebuilt',    'Prebuilt PC',  'جهاز جاهز',     'prebuilt')    -- needs migrations/001_prebuilt_category.sql on an older database
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
-- Parts: real products, specs from the makers (docs/categories.md fields).
-- A product is skipped if one with the same brand and name already exists.
-- ============================================================

INSERT INTO products (category_id, brand, name, model, specs)
SELECT c.id, v.brand, v.name, v.model, v.specs::jsonb
FROM (VALUES
  -- CPUs
  ('cpu', 'AMD', 'Ryzen 9 9950X3D', '100-100000719WOF',
   '{"socket": "AM5", "cores": 16, "threads": 32, "base_clock_ghz": 4.3, "boost_clock_ghz": 5.7, "tdp_w": 170, "includes_cooler": false}'),
  ('cpu', 'AMD', 'Ryzen 7 9800X3D', '100-100001084WOF',
   '{"socket": "AM5", "cores": 8, "threads": 16, "base_clock_ghz": 4.7, "boost_clock_ghz": 5.2, "tdp_w": 120, "includes_cooler": false}'),

  -- Graphics cards
  ('gpu', 'ASUS', 'Prime GeForce RTX 5070 OC 12GB', 'PRIME-RTX5070-O12G',
   '{"chip_brand": "NVIDIA", "chipset": "RTX 5070", "vram_gb": 12, "tdp_w": 250, "length_mm": 304, "slots": 2.5, "outputs": ["HDMI 2.1", "DP"], "perf_1080p": "excellent", "perf_1440p": "excellent", "perf_4k": "good", "recommended_psu_w": 750}'),
  ('gpu', 'Gigabyte', 'GeForce RTX 5060 Ti WINDFORCE OC 8G', 'GV-N506TWF2OC-8GD',
   '{"chip_brand": "NVIDIA", "chipset": "RTX 5060 Ti", "vram_gb": 8, "tdp_w": 180, "length_mm": 208, "slots": 2, "outputs": ["HDMI 2.1", "DP"], "perf_1080p": "excellent", "perf_1440p": "good", "perf_4k": "ok", "recommended_psu_w": 650}'),
  ('gpu', 'XFX', 'Mercury Radeon RX 9070 XT OC Gaming Edition RGB 16GB', 'RX-97TRGBBB9',
   '{"chip_brand": "AMD", "chipset": "RX 9070 XT", "vram_gb": 16, "tdp_w": 304, "length_mm": 360, "slots": 3.5, "outputs": ["HDMI 2.1", "DP"], "perf_1080p": "excellent", "perf_1440p": "excellent", "perf_4k": "good", "recommended_psu_w": 800}'),

  -- Motherboards
  ('motherboard', 'Gigabyte', 'B650 EAGLE AX', 'B650 EAGLE AX',
   '{"socket": "AM5", "chipset": "B650", "ram_type": "DDR5", "form_factor": "ATX", "ram_slots": 4, "m2_slots": 3, "wifi": true}'),

  -- RAM
  ('ram', 'Corsair', 'Vengeance 16GB (1x16GB) DDR5 5200 C40', 'CMK16GX5M1B5200C40',
   '{"ram_type": "DDR5", "capacity_gb": 16, "speed_mhz": 5200, "modules": 1, "cas_latency": 40}'),

  -- Cases (max GPU length: the lower figure the makers give, so the check stays safe)
  ('case', 'NZXT', 'H9 Flow (2025) White', NULL,
   '{"supported_form_factors": ["ATX", "mATX", "ITX"], "max_gpu_length_mm": 435, "max_cooler_height_mm": 165, "side_panel": "glass", "color": "white"}'),

  -- Power supplies
  ('psu', 'MAJESTY', '750W Gold Power Supply (Black)', NULL,
   '{"wattage": 750, "rating": "80+ Gold", "modular": "full", "form_factor": "ATX"}'),

  -- CPU coolers
  ('cooler', 'DeepCool', 'AG400 PLUS', NULL,
   '{"type": "air", "supported_sockets": ["AM4", "AM5", "LGA1700"], "height_mm": 150}')
) AS v(category, brand, name, model, specs)
JOIN categories c ON c.slug = v.category
WHERE NOT EXISTS (
  SELECT 1 FROM products p WHERE p.brand = v.brand AND p.name = v.name
);


-- ============================================================
-- Offers: copied from the store pages (price, shipping, delivery, seller) on 2026-10-30.
-- Delivery days are counted from that day. Links use the product's short address in the store.
-- ============================================================

INSERT INTO offers (product_id, store_id, seller_name, is_official, seller_rating, seller_reviews,
                    price, shipping_cost, currency, delivery_days_min, delivery_days_max, url, in_stock)
SELECT p.id, s.id, v.seller, v.official, v.rating, v.reviews,
       v.price, v.shipping, v.currency, v.days_min, v.days_max, v.url, v.in_stock
FROM (VALUES
  -- XFX RX 9070 XT: shipped and sold by Amazon.sa, free overnight delivery
  ('Mercury Radeon RX 9070 XT OC Gaming Edition RGB 16GB', 'Amazon.sa', 'Amazon.sa', true, NULL::numeric, NULL::int,
   4200.00, 0.00, 'SAR', 1, 1, 'https://www.amazon.sa/dp/B0DXW1R1YT', true),
  -- Ryzen 9 9950X3D: fulfilled by Amazon, sold by GamePower SA, free delivery Sunday 1 November
  ('Ryzen 9 9950X3D', 'Amazon.sa', 'GamePower SA', false, NULL, NULL,
   2667.94, 0.00, 'SAR', 2, 2, 'https://www.amazon.sa/dp/B0DVZSG8D5', true),
  -- Gigabyte B650 EAGLE AX: fulfilled by Amazon, sold by INFINIARC, free overnight delivery
  ('B650 EAGLE AX', 'Amazon.sa', 'INFINIARC', false, NULL, NULL,
   629.00, 0.00, 'SAR', 1, 1, 'https://www.amazon.sa/dp/B0CSKH1NJF', true),

  -- The seller's name was not visible on these pages, so it says "Amazon.sa seller" until it is
  -- checked (it can be changed from the admin page)
  -- ASUS Prime RTX 5070: fulfilled by Amazon, sold by "IT Technology" (name cut on the page), free delivery today
  ('Prime GeForce RTX 5070 OC 12GB', 'Amazon.sa', 'IT Technology', false, NULL, NULL,
   3858.95, 0.00, 'SAR', 0, 0, 'https://www.amazon.sa/dp/B0DYPFY7JG', true),
  -- Gigabyte RTX 5060 Ti: free delivery Sunday 1 November, only 4 left
  ('GeForce RTX 5060 Ti WINDFORCE OC 8G', 'Amazon.sa', 'Amazon.sa seller', false, NULL, NULL,
   2599.00, 0.00, 'SAR', 2, 2, 'https://www.amazon.sa/dp/B0F4ZFPVC1', true),
  -- Ryzen 7 9800X3D: free delivery Sunday 1 November
  ('Ryzen 7 9800X3D', 'Amazon.sa', 'Amazon.sa seller', false, NULL, NULL,
   1894.00, 0.00, 'SAR', 2, 2, 'https://www.amazon.sa/dp/B0DKFMSMYK', true),
  -- NZXT H9 Flow (2025) White: fulfilled by Amazon, free delivery Sunday 1 November
  ('H9 Flow (2025) White', 'Amazon.sa', 'Amazon.sa seller', false, NULL, NULL,
   599.00, 0.00, 'SAR', 2, 2, 'https://www.amazon.sa/dp/B0DQPRVD4C', true),
  -- MAJESTY 750W Gold: free delivery Sunday 1 November
  ('750W Gold Power Supply (Black)', 'Amazon.sa', 'Amazon.sa seller', false, NULL, NULL,
   359.00, 0.00, 'SAR', 2, 2, 'https://www.amazon.sa/dp/B0FDQWY9TX', true),

  -- Corsair Vengeance 16GB DDR5 5200 (option "16GB 5200Mhz C40 X1"): shipping 18.98 SAR, delivery
  -- 11 to 19 November; the page says the price does not include VAT
  ('Vengeance 16GB (1x16GB) DDR5 5200 C40', 'AliExpress', 'AliExpress seller', false, NULL, NULL,
   861.91, 18.98, 'SAR', 12, 20, 'https://ar.aliexpress.com/item/1005012670400838.html', true)
) AS v(product, store, seller, official, rating, reviews, price, shipping, currency, days_min, days_max, url, in_stock)
JOIN products p ON p.name = v.product
JOIN stores s ON s.name = v.store
ON CONFLICT (product_id, store_id, seller_name) DO NOTHING;


-- ============================================================
-- Product pictures (files in client/images/products, served at /images/products/...).
-- They come from the makers' official sites, used with their permission (client/images/products/README.md).
-- ============================================================

UPDATE products SET image_url = v.image_url
FROM (VALUES
  ('Corsair',  'Vengeance 16GB (1x16GB) DDR5 5200 C40', '/images/products/corsair-vengeance-ddr5-16gb.webp'),
  ('DeepCool', 'AG400 PLUS',                            '/images/products/deepcool-ag400-plus.webp'),
  ('AMD',      'Ryzen 7 9800X3D',                       '/images/products/amd-ryzen-7-9800x3d.jpg'),
  ('Gigabyte', 'B650 EAGLE AX',                         '/images/products/gigabyte-b650-eagle-ax.jpg'),
  ('MAJESTY',  '750W Gold Power Supply (Black)',        '/images/products/majesty-750w-gold.jpg'),
  ('AMD',      'Ryzen 9 9950X3D',                       '/images/products/amd-ryzen-9-9950x3d.jpg'),
  ('ASUS',     'Prime GeForce RTX 5070 OC 12GB',        '/images/products/asus-prime-rtx-5070-oc.webp'),
  ('NZXT',     'H9 Flow (2025) White',                  '/images/products/nzxt-h9-flow-2025-white.jpg'),
  ('Gigabyte', 'GeForce RTX 5060 Ti WINDFORCE OC 8G',   '/images/products/gigabyte-rtx-5060-ti-windforce-oc.jpg'),
  ('XFX',      'Mercury Radeon RX 9070 XT OC Gaming Edition RGB 16GB', '/images/products/xfx-rx-9070-xt.jpg')
) AS v(brand, name, image_url)
WHERE products.brand = v.brand AND products.name = v.name;
