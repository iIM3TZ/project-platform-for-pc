-- Usernames can now be 2 to 20 characters (was 3 to 20), still English letters, numbers and _.
-- Run once in pgAdmin on a database created before this change. Safe to run again.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_check;
ALTER TABLE users ADD CONSTRAINT users_username_check
  CHECK (username ~ '^[A-Za-z0-9_]{2,20}$');
