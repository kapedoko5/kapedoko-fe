-- =========================================================
-- KapéDoko — Admin ₱ / ₱₱ / ₱₱₱ cutoffs (manual)
-- =========================================================
-- Run AFTER db/20261126_cafe_price_marks.sql.
-- Expected outcomes are in comments.
-- =========================================================

-- Singleton row is readable.
-- select budget_max_php, mid_max_php from public.cafe_price_marks where id = true;
-- Expected: 99 / 184 unless an admin already saved.

-- Raising ₱ to 150 restamps Budget-friendly through that ceiling.
-- select public.update_cafe_price_marks(150, 250);
-- select s.menu_price_php, n.slug
--   from public.shops s
--   left join public.shop_vibe_tags t on t.shop_id = s.id
--   left join public.vibe_tag_names n on n.id = t.tag_id and n.slug = 'budget-friendly'
--  where s.menu_price_php between 100 and 150;
-- Expected: those shops have a budget-friendly row.

-- ₱₱ has to sit above ₱.
-- select public.update_cafe_price_marks(200, 150);
-- Expected: exception '₱₱ has to sit above ₱.'
