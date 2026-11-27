-- =========================================================
-- KapéDoko — favorite counts and placement history (issue #67, Phase 3.5)
-- =========================================================
-- Run AFTER 20261127_shop_traffic_rollup.sql (analytics_shop_scope),
-- 20260928_favorites_profiles_moderation.sql and
-- 20260909_shop_placements.sql.
-- Safe to re-run.
--
-- shop_favorite_counts     Aggregate saves per café. Never returns who
--                          saved a café. Admin: any café. Owner: cafés
--                          they manage.
-- list_my_shop_placements  Partner / sponsored history (past, current
--                          and upcoming) for cafés the caller manages.
--                          The public policy on shop_placements only
--                          shows windows that are running now.
-- =========================================================

create or replace function public.shop_favorite_counts(
  p_shop_ids uuid[] default null,
  p_from date default null
)
returns table (
  shop_id uuid,
  total integer,
  gained integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  scope uuid[];
  since timestamptz;
begin
  scope := public.analytics_shop_scope(p_shop_ids);
  since := case
    when p_from is null then null
    else p_from::timestamp at time zone 'Asia/Manila'
  end;

  -- "gained" counts saves made since p_from that are still saved
  -- (an unsaved café removes the row, so it cannot be counted).
  return query
  select
    f.shop_id,
    count(*)::integer,
    (count(*) filter (where since is not null and f.created_at >= since))::integer
  from public.favorites f
  where scope is null or f.shop_id = any (scope)
  group by f.shop_id
  order by 2 desc;
end;
$$;

comment on function public.shop_favorite_counts(uuid[], date) is
  'Aggregate favorite counts per cafe (total and saved since p_from, Manila). No user ids. Admin: any. Owner: cafes they manage.';

revoke all on function public.shop_favorite_counts(uuid[], date) from public, anon;
grant execute on function public.shop_favorite_counts(uuid[], date) to authenticated;

create or replace function public.list_my_shop_placements(
  p_shop_ids uuid[] default null
)
returns table (
  id uuid,
  shop_id uuid,
  kind text,
  starts_at timestamptz,
  ends_at timestamptz,
  features jsonb,
  created_at timestamptz
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
  scope := public.analytics_shop_scope(p_shop_ids);

  -- created_by is left out on purpose: it is an admin account id.
  return query
  select
    p.id,
    p.shop_id,
    p.kind::text,
    p.starts_at,
    p.ends_at,
    p.features,
    p.created_at
  from public.shop_placements p
  where scope is null or p.shop_id = any (scope)
  order by p.starts_at desc;
end;
$$;

comment on function public.list_my_shop_placements(uuid[]) is
  'Placement history for cafes the caller manages (admin: any). Does not expose created_by.';

revoke all on function public.list_my_shop_placements(uuid[]) from public, anon;
grant execute on function public.list_my_shop_placements(uuid[]) to authenticated;
