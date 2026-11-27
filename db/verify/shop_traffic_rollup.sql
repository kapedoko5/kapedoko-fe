-- Checks after db/20261127_shop_traffic_rollup.sql
-- Nothing here writes data. Role checks are commented: run each block in a
-- transaction with the claims set, then roll back, e.g.
--   begin;
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<user-uuid>","role":"authenticated"}', true);
--   ... statement ...
--   rollback;
-- For anon use: set local role anon; (no claims).

-- Catalog (as postgres)
select proname, prosecdef, proconfig
from pg_proc
where proname in ('shop_traffic_rollup', 'shop_traffic_hourly', 'analytics_shop_scope')
  and pronamespace = 'public'::regnamespace;
-- Expected: 3 rows, prosecdef = true, proconfig contains search_path=public.

select grantee, routine_name
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('shop_traffic_rollup', 'shop_traffic_hourly', 'analytics_shop_scope')
order by routine_name, grantee;
-- Expected: rollup and hourly: authenticated (and postgres). analytics_shop_scope:
-- no anon / authenticated / PUBLIC.

select indexname from pg_indexes
where tablename = 'shop_traffic_events' and indexname = 'shop_traffic_events_rollup_idx';
-- Expected: 1 row.

-- Anon cannot call.
-- set local role anon;
-- select * from public.shop_traffic_rollup(current_date - 7, current_date);
-- Expected: permission denied for function shop_traffic_rollup.

-- Signed-in user who owns nothing, and an auditor (not an admin), are rejected.
-- As regular user JWT and as auditor JWT:
-- select * from public.shop_traffic_rollup(current_date - 7, current_date);
-- Expected: Not allowed.
-- select * from public.shop_traffic_hourly(current_date - 7, current_date);
-- Expected: Not allowed.

-- Verified owner sees only owned cafes.
-- As owner JWT: select distinct shop_id from public.shop_traffic_rollup(current_date - 30, current_date);
-- Expected: only owned shop ids (and nothing for a cafe with a pending claim).
-- select * from public.shop_traffic_rollup(current_date - 30, current_date, array['<other-shop-id>']::uuid[]);
-- Expected: Not allowed.
-- Owner totals match the view:
-- select sum(hits) from public.shop_traffic_rollup(current_date - 30, current_date);
-- select sum(hits) from public.shop_traffic_daily where day >= current_date - 30;
-- Expected: equal when run as the same owner. Compare with Manila "today":
-- (timezone('Asia/Manila', now()))::date, since current_date follows the DB zone.

-- Admin sees every cafe; filter by shop works.
-- As admin JWT: select count(distinct shop_id) from public.shop_traffic_rollup(current_date - 30, current_date);
-- Expected: every cafe with events.
-- select * from public.shop_traffic_rollup(current_date - 30, current_date, array['<shop-id>']::uuid[], 'week');
-- Expected: bucket dates are Mondays.

-- Argument validation (as admin).
-- select * from public.shop_traffic_rollup(current_date, current_date - 1);   -- Invalid date range
-- select * from public.shop_traffic_rollup(current_date - 500, current_date); -- Date range is too long
-- select * from public.shop_traffic_rollup(current_date - 7, current_date, null, 'hour'); -- Unknown grain
-- select * from public.shop_traffic_rollup(null, current_date);               -- Invalid date range

-- Hourly grid: dow 0..6 (Sunday = 0), hour 0..23, Manila time.
-- As admin: select min(dow), max(dow), min(hour), max(hour) from public.shop_traffic_hourly(current_date - 30, current_date);
-- Expected: within 0..6 and 0..23. Sum of hits equals the rollup sum for the same range.
