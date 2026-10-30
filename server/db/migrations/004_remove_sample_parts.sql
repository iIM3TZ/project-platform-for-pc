-- The first seed had four sample parts with made-up test prices and links to store home pages.
-- They are removed now that the seed has real parts and real offers. Their offers, and the places
-- they were used in builds and My list, go with them (ON DELETE CASCADE).
-- Run once in pgAdmin on a database seeded before this change. Safe to run again.

DELETE FROM products
WHERE (brand, name) IN (
  ('AMD',     'Ryzen 5 7600X'),
  ('ASUS',    'Dual GeForce RTX 4060 OC'),
  ('Corsair', 'Vengeance 32GB (2x16GB) DDR5 6000'),
  ('LG',      'UltraGear 27GP850-B')
);
