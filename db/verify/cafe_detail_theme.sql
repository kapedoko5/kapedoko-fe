-- =========================================================
-- KapéDoko — Cafe detail theme checks (manual)
-- =========================================================
-- Run AFTER db/20261120_cafe_detail_theme.sql.
-- =========================================================

-- Columns exist.
-- select theme_button_hex, theme_text_hex, theme_background_hex from public.shops limit 1;

-- Owner/admin stamp a palette.
-- select public.apply_admin_shop_theme(array['<shop-id>'::uuid], '#2F6B4F', '#1C1917', '#F3F6F2');
-- Expected: that shop's theme_button_hex is #2F6B4F and theme_background_hex is #F3F6F2.

-- Empty hexes clear back to KapéDoko.
-- select public.apply_admin_shop_theme(array['<shop-id>'::uuid], null, null, null);
-- Expected: all three columns null.

-- Junk hex is rejected.
-- select public.apply_admin_shop_theme(array['<shop-id>'::uuid], 'orange', '#1C1917', '#F2F2F2');
-- Expected: exception 'Use a hex color like #D9793B.'
