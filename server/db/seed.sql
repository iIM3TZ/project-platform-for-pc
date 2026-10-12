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
