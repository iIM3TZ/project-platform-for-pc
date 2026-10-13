-- The site sells nothing, so "shopping list" is now "My list" (قائمتي).
-- Renames the table on a database created before this change. Run once in pgAdmin.

ALTER TABLE IF EXISTS shopping_list_items RENAME TO list_items;
ALTER INDEX IF EXISTS shopping_list_items_user_idx RENAME TO list_items_user_idx;
