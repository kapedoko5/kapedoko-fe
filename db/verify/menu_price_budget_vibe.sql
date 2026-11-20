-- =========================================================
-- KapéDoko — Menu price / Budget-friendly checks (manual)
-- =========================================================
-- Run AFTER db/20261124_menu_price_budget_vibe.sql.
-- Expected outcomes are in comments.
-- =========================================================

-- Catalog has the surprise stamp.
-- select slug, enabled from public.vibe_tag_names where slug = 'budget-friendly';
-- Expected: one enabled row.

-- Owner/admin cafe edit below ₱100 stamps it, even with five user stamps.
-- update public.shops set menu_price_php = 95 where id = '<shop-id>';
-- select public.sync_budget_friendly_vibe('<shop-id>');
-- select n.slug from public.shop_vibe_tags t
--   join public.vibe_tag_names n on n.id = t.tag_id
--  where t.shop_id = '<shop-id>';
-- Expected: budget-friendly plus up to five other stamps.

-- After 20261126, the ₱ cutoff lives in cafe_price_marks.budget_max_php
-- (default 99). 100 pesos removes it with that default.
-- update public.shops set menu_price_php = 100 where id = '<shop-id>';
-- select public.sync_budget_friendly_vibe('<shop-id>');
-- Expected: no budget-friendly row.

-- Null price removes it.
-- update public.shops set menu_price_php = null where id = '<shop-id>';
-- select public.sync_budget_friendly_vibe('<shop-id>');
-- Expected: no budget-friendly row.
