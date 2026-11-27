-- Checks after db/20261128_shop_favorites_placements.sql
-- See shop_traffic_rollup.sql for how to run a block as a given role.

select proname, prosecdef from pg_proc
where proname in ('shop_favorite_counts', 'list_my_shop_placements')
  and pronamespace = 'public'::regnamespace;
-- Expected: both security definer.

select routine_name, grantee from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('shop_favorite_counts', 'list_my_shop_placements');
-- Expected: authenticated only (plus owner role).

-- Anon.
-- set local role anon;
-- select * from public.shop_favorite_counts();        -- permission denied
-- select * from public.list_my_shop_placements();     -- permission denied

-- Regular user and auditor.
-- select * from public.shop_favorite_counts();        -- Not allowed
-- select * from public.list_my_shop_placements();     -- Not allowed

-- Owner.
-- As owner JWT: select * from public.shop_favorite_counts(null, current_date - 30);
-- Expected: rows only for owned cafes; columns are shop_id, total, gained (no user ids).
-- select * from public.shop_favorite_counts(array['<other-shop-id>']::uuid[]);   -- Not allowed
-- select * from public.list_my_shop_placements();
-- Expected: past, current and upcoming placements of owned cafes only; no created_by column.
-- select * from public.list_my_shop_placements(array['<other-shop-id>']::uuid[]); -- Not allowed
-- Totals match as postgres:
-- select shop_id, count(*) from public.favorites where shop_id = '<owned-shop-id>' group by 1;

-- Admin.
-- As admin JWT: select count(*) from public.shop_favorite_counts();   -- every cafe with a favorite
-- select count(*) from public.list_my_shop_placements();              -- every placement
