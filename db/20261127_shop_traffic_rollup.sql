-- =========================================================
-- KapéDoko — traffic rollup RPCs (issue #67, Phase 3.1)
-- =========================================================
-- Run AFTER 20261122_shop_traffic.sql.
-- Safe to re-run.
--
-- shop_traffic_rollup   Manila-bucketed counts for any date range (the
--                       90-day tab and admin scale). Replaces paging the
--                       whole shop_traffic_daily view.
-- shop_traffic_hourly   Hour-of-week grid (Manila time), summed over the
--                       cafes the caller may read.
--
-- Access: admins read every cafe. Verified owners read only cafes they
-- manage. Everyone else (anon, regular users, auditors) is rejected.
-- Both RPCs are security definer so the scan is not slowed by a per-row
-- is_shop_owner() RLS call; the scope check below does the same job once.
-- =========================================================

-- Shared scope helper for analytics RPCs. Returns the cafe ids the caller
-- may read, or NULL when the caller is an admin who asked for every cafe.
-- Internal only: not granted to API roles.
create or replace function public.analytics_shop_scope(p_shop_ids uuid[])
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  owned uuid[];
begin
  if caller is null then
    raise exception 'Not allowed';
  end if;
  if p_shop_ids is not null and cardinality(p_shop_ids) > 1000 then
    raise exception 'Too many cafes';
  end if;

  if public.is_admin() then
    return p_shop_ids;
  end if;

  select coalesce(array_agg(c.shop_id), '{}'::uuid[])
  into owned
  from (
    select distinct sc.shop_id
    from public.shop_claims sc
    where sc.claimant_id = caller
  ) c
  where public.is_shop_owner(c.shop_id);

  if cardinality(owned) = 0 then
    raise exception 'Not allowed';
  end if;
  if p_shop_ids is null then
    return owned;
  end if;
  if exists (
    select 1 from unnest(p_shop_ids) as s(id) where not (s.id = any(owned))
  ) then
    raise exception 'Not allowed';
  end if;
  return p_shop_ids;
end;
$$;

comment on function public.analytics_shop_scope(uuid[]) is
  'Internal. Cafe ids the caller may read analytics for; NULL means every cafe (admin). Raises for anyone else.';

revoke all on function public.analytics_shop_scope(uuid[]) from public, anon, authenticated;

-- Covering index so the rollup can aggregate from the index alone. The
-- RPC filters on a created_at range (Manila midnight bounds), so an
-- expression index on the Manila day would not be used by it.
create index if not exists shop_traffic_events_rollup_idx
  on public.shop_traffic_events (created_at)
  include (shop_id, kind, surface);

create or replace function public.shop_traffic_rollup(
  p_from date,
  p_to date,
  p_shop_ids uuid[] default null,
  p_grain text default 'day'
)
returns table (
  shop_id uuid,
  kind text,
  surface text,
  bucket date,
  hits integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  scope uuid[];
  grain text := lower(coalesce(p_grain, 'day'));
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Invalid date range';
  end if;
  if p_to - p_from > 399 then
    raise exception 'Date range is too long';
  end if;
  if grain not in ('day', 'week', 'month') then
    raise exception 'Unknown grain';
  end if;

  scope := public.analytics_shop_scope(p_shop_ids);

  return query
  select
    e.shop_id,
    e.kind,
    e.surface,
    date_trunc(grain, timezone('Asia/Manila', e.created_at))::date,
    count(*)::integer
  from public.shop_traffic_events e
  where e.created_at >= (p_from::timestamp at time zone 'Asia/Manila')
    and e.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Manila')
    and (scope is null or e.shop_id = any (scope))
  group by 1, 2, 3, 4
  order by 1, 2, 3, 4;
end;
$$;

comment on function public.shop_traffic_rollup(date, date, uuid[], text) is
  'Manila-bucketed café traffic counts (grain day, week, or month; week starts Monday). Admin: any cafe. Owner: cafes they manage.';

revoke all on function public.shop_traffic_rollup(date, date, uuid[], text) from public, anon;
grant execute on function public.shop_traffic_rollup(date, date, uuid[], text) to authenticated;

create or replace function public.shop_traffic_hourly(
  p_from date,
  p_to date,
  p_shop_ids uuid[] default null
)
returns table (
  kind text,
  dow smallint,
  hour smallint,
  hits integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  scope uuid[];
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Invalid date range';
  end if;
  if p_to - p_from > 399 then
    raise exception 'Date range is too long';
  end if;

  scope := public.analytics_shop_scope(p_shop_ids);

  -- dow: 0 = Sunday .. 6 = Saturday (same as JavaScript getDay), Manila time.
  return query
  select
    e.kind,
    extract(dow from timezone('Asia/Manila', e.created_at))::smallint,
    extract(hour from timezone('Asia/Manila', e.created_at))::smallint,
    count(*)::integer
  from public.shop_traffic_events e
  where e.created_at >= (p_from::timestamp at time zone 'Asia/Manila')
    and e.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Manila')
    and (scope is null or e.shop_id = any (scope))
  group by 1, 2, 3
  order by 1, 2, 3;
end;
$$;

comment on function public.shop_traffic_hourly(date, date, uuid[]) is
  'Hour-of-week café traffic (Manila time), summed over the cafes the caller may read.';

revoke all on function public.shop_traffic_hourly(date, date, uuid[]) from public, anon;
grant execute on function public.shop_traffic_hourly(date, date, uuid[]) to authenticated;
