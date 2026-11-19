-- Optional checks after 20261122_shop_traffic.sql
-- Repeat as anon, signed-in user, cafe-owner JWT, and admin JWT.

-- Anon / user cannot select shop_traffic_events.
-- select * from public.shop_traffic_events;
-- Expected: 0 rows (RLS) or permission denied.

-- Anon cannot insert the table directly.
-- insert into public.shop_traffic_events (shop_id, kind, surface)
-- values ('<approved-shop-id>', 'card_click', 'home');
-- Expected: permission denied.

-- Anon can record traffic on an approved cafe.
-- select public.record_shop_traffic('<approved-shop-id>', 'card_click', 'home');
-- Expected: void; a row exists for admins.

-- Pending / unknown shop is rejected.
-- select public.record_shop_traffic('<pending-shop-id>', 'card_click', 'home');
-- Expected: Only approved shops can receive traffic.

-- Bad kind / surface is rejected.
-- select public.record_shop_traffic('<approved-shop-id>', 'pageview', 'home');
-- Expected: Unknown traffic kind.

-- Owner can select only cafes they manage.
-- As verified owner: select shop_id from public.shop_traffic_events;
-- Expected: only owned shop ids.
-- As the same owner: select * from public.shop_traffic_daily;
-- Expected: same shop ids.

-- Admin can select every row.
-- select count(*) from public.shop_traffic_events;
-- Expected: all recorded events.

-- Auditor is not admin; same as a regular user for this table.
-- select * from public.shop_traffic_events;
-- Expected: 0 rows unless they also own the cafe.
