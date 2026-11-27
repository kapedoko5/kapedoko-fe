-- =========================================================
-- KapéDoko — traffic retention purge (issue #67, Phase 3.6)
-- =========================================================
-- Run AFTER 20261122_shop_traffic.sql (and 20261127_ad_campaign_events.sql
-- if you want those rows purged too; the function skips it when absent).
-- Safe to re-run.
--
-- The privacy page promises café listing traffic is deleted after one
-- year. This migration makes that true: a purge function and, when
-- pg_cron is available, a daily job at 03:17 Manila time (19:17 UTC).
-- If pg_cron cannot be enabled, the function is still created and a
-- notice says so; run it from any scheduler:
--   select public.purge_old_traffic_events();
-- =========================================================

create or replace function public.purge_old_traffic_events(
  p_keep interval default interval '1 year'
)
returns table (
  table_name text,
  deleted bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz;
  batch_size constant integer := 10000;
  max_batches constant integer := 100;
  removed bigint;
  total bigint;
  batches integer;
begin
  if p_keep is null or p_keep < interval '90 days' then
    raise exception 'Retention must be at least 90 days';
  end if;
  cutoff := now() - p_keep;

  total := 0;
  batches := 0;
  loop
    delete from public.shop_traffic_events
    where ctid in (
      select t.ctid from public.shop_traffic_events t
      where t.created_at < cutoff
      limit batch_size
    );
    get diagnostics removed = row_count;
    total := total + removed;
    batches := batches + 1;
    exit when removed < batch_size or batches >= max_batches;
  end loop;
  table_name := 'shop_traffic_events';
  deleted := total;
  return next;

  if to_regclass('public.ad_campaign_events') is not null then
    total := 0;
    batches := 0;
    loop
      execute format(
        'delete from public.ad_campaign_events where ctid in (
           select t.ctid from public.ad_campaign_events t
           where t.created_at < %L limit %s)',
        cutoff, batch_size
      );
      get diagnostics removed = row_count;
      total := total + removed;
      batches := batches + 1;
      exit when removed < batch_size or batches >= max_batches;
    end loop;
    table_name := 'ad_campaign_events';
    deleted := total;
    return next;
  end if;
end;
$$;

comment on function public.purge_old_traffic_events(interval) is
  'Delete café traffic and ad events older than the retention window (default one year). Run by pg_cron; not callable by API roles.';

revoke all on function public.purge_old_traffic_events(interval) from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron is not available. Schedule select public.purge_old_traffic_events() daily elsewhere.';
    return;
  end if;

  create extension if not exists pg_cron;

  if exists (select 1 from cron.job where jobname = 'purge-old-traffic-events') then
    perform cron.unschedule('purge-old-traffic-events');
  end if;
  perform cron.schedule(
    'purge-old-traffic-events',
    '17 19 * * *',
    'select public.purge_old_traffic_events()'
  );
exception when others then
  raise notice 'Could not schedule the purge with pg_cron (%). Run select public.purge_old_traffic_events() daily elsewhere.', sqlerrm;
end;
$$;
