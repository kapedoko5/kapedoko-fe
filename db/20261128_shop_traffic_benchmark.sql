-- =========================================================
-- KapéDoko — peer benchmarks (issue #67, Phase 3.4)
-- =========================================================
-- Run AFTER 20261122_shop_traffic.sql, 20261118_vibe_tags.sql and
-- 20261128_shop_traffic_poster_share.sql (poster_view).
-- Safe to re-run.
--
-- shop_traffic_benchmark compares one café with three peer groups:
--   network  every approved café
--   vibe     cafés that share at least one vibe tag with it
--   city     cafés within 8 km of it (shops has no city column, so
--            "city" is a distance ring around the café)
--
-- Privacy: a metric is returned for a group only when at least 5 cafés
-- (the asking café included) have enough traffic to produce it. No
-- other café is identified; only the group median and the asking
-- café's own percentile are returned. Owners may ask about their own
-- café only; admins may ask about any.
--
-- A café counts toward CTR with >= 20 impressions and toward action
-- rate with >= 5 visits in the window, so tiny samples do not skew the
-- percentiles. CTR = card clicks / impressions. Action rate = directions,
-- calls, photo and poster opens / cafe page opens. All surfaces count,
-- matching the KPI cards.
-- =========================================================

create or replace function public.shop_traffic_distance_km(
  p_lat1 double precision,
  p_lng1 double precision,
  p_lat2 double precision,
  p_lng2 double precision
)
returns double precision
language sql
immutable
as $$
  select 2 * 6371 * asin(least(1, sqrt(
    power(sin(radians(p_lat2 - p_lat1) / 2), 2)
    + cos(radians(p_lat1)) * cos(radians(p_lat2))
      * power(sin(radians(p_lng2 - p_lng1) / 2), 2)
  )));
$$;

revoke all on function public.shop_traffic_distance_km(double precision, double precision, double precision, double precision) from public, anon, authenticated;

create or replace function public.shop_traffic_benchmark(
  p_shop_id uuid,
  p_from date,
  p_to date
)
returns table (
  scope text,
  label text,
  ctr_cafes integer,
  own_ctr numeric,
  ctr_median numeric,
  ctr_percentile numeric,
  action_cafes integer,
  own_action_rate numeric,
  action_rate_median numeric,
  action_rate_percentile numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  min_group constant integer := 5;
  min_impressions constant integer := 20;
  min_visits constant integer := 5;
  radius_km constant double precision := 8;
begin
  if auth.uid() is null then
    raise exception 'Not allowed';
  end if;
  if p_shop_id is null then
    raise exception 'Cafe is required';
  end if;
  if not (public.is_admin() or public.is_shop_owner(p_shop_id)) then
    raise exception 'Not allowed';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Invalid date range';
  end if;
  if p_to - p_from > 399 then
    raise exception 'Date range is too long';
  end if;

  return query
  with stats as (
    select
      s.id as shop_id,
      s.latitude::double precision as lat,
      s.longitude::double precision as lng,
      count(e.id) filter (where e.kind = 'card_impression') as imp,
      count(e.id) filter (where e.kind = 'card_click') as clk,
      count(e.id) filter (where e.kind = 'detail_view') as vis,
      count(e.id) filter (
        where e.kind in ('navigate', 'call', 'photo_view', 'poster_view')
      ) as act
    from public.shops s
    left join public.shop_traffic_events e
      on e.shop_id = s.id
      and e.created_at >= (p_from::timestamp at time zone 'Asia/Manila')
      and e.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Manila')
    where s.status = 'approved'
    group by s.id, s.latitude, s.longitude
  ),
  metrics as (
    select
      st.shop_id,
      st.lat,
      st.lng,
      case when st.imp >= min_impressions then st.clk::double precision / st.imp end as ctr,
      case when st.vis >= min_visits then st.act::double precision / st.vis end as arate
    from stats st
  ),
  me as (
    select m.shop_id, m.lat, m.lng, m.ctr, m.arate
    from metrics m
    where m.shop_id = p_shop_id
  ),
  members as (
    select 'network'::text as scope, m.shop_id, m.ctr, m.arate
    from metrics m
    union all
    select 'vibe'::text, m.shop_id, m.ctr, m.arate
    from metrics m
    where exists (
      select 1
      from public.shop_vibe_tags mine
      join public.shop_vibe_tags theirs on theirs.tag_id = mine.tag_id
      where mine.shop_id = p_shop_id
        and theirs.shop_id = m.shop_id
    )
    union all
    select 'city'::text, m.shop_id, m.ctr, m.arate
    from metrics m, me
    where public.shop_traffic_distance_km(me.lat, me.lng, m.lat, m.lng) <= radius_km
  ),
  agg as (
    select
      mem.scope,
      count(*) filter (where mem.ctr is not null) as ctr_n,
      (percentile_cont(0.5) within group (order by mem.ctr)) as ctr_med,
      count(*) filter (where mem.ctr is not null and mem.shop_id <> p_shop_id and mem.ctr < me.ctr) as ctr_lower,
      count(*) filter (where mem.ctr is not null and mem.shop_id <> p_shop_id and mem.ctr = me.ctr) as ctr_tied,
      count(*) filter (where mem.arate is not null) as ar_n,
      (percentile_cont(0.5) within group (order by mem.arate)) as ar_med,
      count(*) filter (where mem.arate is not null and mem.shop_id <> p_shop_id and mem.arate < me.arate) as ar_lower,
      count(*) filter (where mem.arate is not null and mem.shop_id <> p_shop_id and mem.arate = me.arate) as ar_tied,
      max(me.ctr) as own_ctr,
      max(me.arate) as own_arate
    from members mem
    cross join me
    group by mem.scope
  )
  select
    a.scope,
    case a.scope
      when 'network' then 'All cafes'
      when 'vibe' then 'Similar vibe'
      else 'Nearby'
    end,
    case when a.ctr_n >= min_group and a.own_ctr is not null then a.ctr_n::integer end,
    case when a.ctr_n >= min_group and a.own_ctr is not null then round(a.own_ctr::numeric, 4) end,
    case when a.ctr_n >= min_group and a.own_ctr is not null then round(a.ctr_med::numeric, 4) end,
    case when a.ctr_n >= min_group and a.own_ctr is not null
      then round(((a.ctr_lower + 0.5 * a.ctr_tied) / (a.ctr_n - 1))::numeric, 4)
    end,
    case when a.ar_n >= min_group and a.own_arate is not null then a.ar_n::integer end,
    case when a.ar_n >= min_group and a.own_arate is not null then round(a.own_arate::numeric, 4) end,
    case when a.ar_n >= min_group and a.own_arate is not null then round(a.ar_med::numeric, 4) end,
    case when a.ar_n >= min_group and a.own_arate is not null
      then round(((a.ar_lower + 0.5 * a.ar_tied) / (a.ar_n - 1))::numeric, 4)
    end
  from agg a
  where (a.ctr_n >= min_group and a.own_ctr is not null)
     or (a.ar_n >= min_group and a.own_arate is not null)
  order by case a.scope when 'network' then 1 when 'vibe' then 2 else 3 end;
end;
$$;

comment on function public.shop_traffic_benchmark(uuid, date, date) is
  'Peer percentiles for card CTR and action rate (network, similar vibe, nearby). Groups under 5 qualifying cafes are never returned. Owner: own cafe only. Admin: any.';

revoke all on function public.shop_traffic_benchmark(uuid, date, date) from public, anon;
grant execute on function public.shop_traffic_benchmark(uuid, date, date) to authenticated;
