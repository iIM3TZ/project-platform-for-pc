-- Adds the 'prebuilt' category kind (ready-made PCs) to a database created before it existed.
-- Run once in pgAdmin, then run seed.sql to add the category. Safe to run again.

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_kind_check;
ALTER TABLE categories ADD CONSTRAINT categories_kind_check
  CHECK (kind IN ('core', 'peripheral', 'prebuilt'));
