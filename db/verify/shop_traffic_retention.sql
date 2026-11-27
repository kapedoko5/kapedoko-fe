-- Checks after db/20261128_shop_traffic_retention.sql
-- Run as postgres. Nothing here deletes data unless noted.

select proname, prosecdef from pg_proc
where proname = 'purge_old_traffic_events' and pronamespace = 'public'::regnamespace;
-- Expected: security definer.

select routine_name, grantee from information_schema.routine_privileges
where routine_schema = 'public' and routine_name = 'purge_old_traffic_events';
-- Expected: no anon / authenticated / PUBLIC.

-- Job (only when pg_cron is available)
select jobname, schedule, command, active from cron.job where jobname = 'purge-old-traffic-events';
-- Expected: 17 19 * * *, select public.purge_old_traffic_events(), active = true.
-- No rows and a notice at migration time means pg_cron is unavailable; schedule it elsewhere.

-- Rows past one year (what the next run will remove)
select count(*) from public.shop_traffic_events where created_at < now() - interval '1 year';

-- Retention floor
-- select * from public.purge_old_traffic_events(interval '1 day');   -- Retention must be at least 90 days

-- API roles cannot run it.
-- set local role authenticated; select * from public.purge_old_traffic_events(); -- permission denied

-- Dry run on a copy: in a transaction, insert a row dated 2 years ago, run the function,
-- confirm it was counted in deleted, then rollback.
-- begin;
--   insert into public.shop_traffic_events (shop_id, kind, surface, created_at)
--   values ('<shop-id>', 'card_click', 'home', now() - interval '2 years');
--   select * from public.purge_old_traffic_events();
-- rollback;
