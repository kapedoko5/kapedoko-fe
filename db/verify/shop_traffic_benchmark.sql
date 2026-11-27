-- Checks after db/20261128_shop_traffic_benchmark.sql
-- See shop_traffic_rollup.sql for how to run a block as a given role.

-- Catalog (as postgres)
select proname, prosecdef from pg_proc
where proname in ('shop_traffic_benchmark', 'shop_traffic_distance_km')
  and pronamespace = 'public'::regnamespace;
-- Expected: benchmark is security definer.

select routine_name, grantee from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('shop_traffic_benchmark', 'shop_traffic_distance_km');
-- Expected: benchmark: authenticated only. distance helper: no API role.

-- Anon.
-- set local role anon;
-- select * from public.shop_traffic_benchmark('<shop-id>', current_date - 30, current_date); -- permission denied

-- Regular user and auditor.
-- select * from public.shop_traffic_benchmark('<shop-id>', current_date - 30, current_date); -- Not allowed

-- Owner: own cafe works, another cafe is refused.
-- As owner JWT:
-- select * from public.shop_traffic_benchmark('<owned-shop-id>', current_date - 30, current_date);
-- Expected: 0..3 rows (network, vibe, city) with own_ctr / own_action_rate and percentiles in 0..1.
-- select * from public.shop_traffic_benchmark('<someone-elses-shop-id>', current_date - 30, current_date); -- Not allowed
-- A pending claim does not count as ownership.

-- Admin may ask about any cafe.
-- As admin JWT: select * from public.shop_traffic_benchmark('<shop-id>', current_date - 30, current_date);

-- Minimum group size. As postgres, count qualifying cafes per group to compare:
-- with s as (
--   select shop_id,
--     count(*) filter (where kind = 'card_impression') imp,
--     count(*) filter (where kind = 'detail_view') vis
--   from public.shop_traffic_events
--   where created_at >= (current_date - 30)::timestamp at time zone 'Asia/Manila'
--   group by shop_id)
-- select count(*) filter (where imp >= 20) as ctr_cafes, count(*) filter (where vis >= 5) as action_cafes from s;
-- Expected: the network row's ctr_cafes / action_cafes equal these (approved cafes only).
-- Test a group under 5: with fewer than 5 qualifying cafes in a scope (use a shop with no vibe
-- tags or no neighbours within 8 km), that scope's row is absent entirely, never null-padded
-- with another cafe's numbers. With under 5 qualifying cafes in total, the function
-- returns 0 rows.
-- A cafe with < 20 impressions gets no CTR fields (null) but may still get action rate fields.

-- Bad input (as admin).
-- select * from public.shop_traffic_benchmark(null, current_date - 30, current_date);   -- Cafe is required
-- select * from public.shop_traffic_benchmark('<shop-id>', current_date, current_date - 1); -- Invalid date range
-- select * from public.shop_traffic_benchmark('<shop-id>', current_date - 500, current_date); -- Date range is too long
