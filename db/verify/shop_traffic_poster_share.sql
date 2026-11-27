-- Checks after db/20261128_shop_traffic_poster_share.sql
-- See shop_traffic_rollup.sql for how to run a block as a given role.

-- Catalog (as postgres)
select conname, convalidated, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.shop_traffic_events'::regclass
  and conname in ('shop_traffic_kind_check', 'shop_traffic_surface_check');
-- Expected: both validated; kind check lists poster_view, surface check lists share.

-- Anon can record the new kind and surface on an approved cafe.
-- select public.record_shop_traffic('<approved-shop-id>', 'poster_view', 'direct');
-- select public.record_shop_traffic('<approved-shop-id>', 'detail_view', 'share');
-- Expected: void; admin sees both rows.

-- Whitelist still rejects unknowns.
-- select public.record_shop_traffic('<approved-shop-id>', 'poster', 'direct');       -- Unknown traffic kind
-- select public.record_shop_traffic('<approved-shop-id>', 'detail_view', 'email');   -- Unknown traffic surface
-- select public.record_shop_traffic('<pending-shop-id>', 'poster_view', 'share');    -- Only approved shops can receive traffic

-- Direct inserts stay blocked for anon / user / owner.
-- insert into public.shop_traffic_events (shop_id, kind, surface) values ('<shop-id>', 'poster_view', 'share'); -- permission denied

-- Reads: owner sees own cafe, admin sees all, user and auditor see nothing.
-- As owner JWT: select kind, surface from public.shop_traffic_events where kind = 'poster_view' or surface = 'share';
-- Expected: only owned shop rows. User / auditor JWT: 0 rows. Admin JWT: all.
