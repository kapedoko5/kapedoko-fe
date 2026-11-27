-- =========================================================
-- KapéDoko — campaign attribution (issue #67, Phase 3.2)
-- =========================================================
-- Run AFTER 20260929_admin_portal.sql, 20261123_ad_campaign_destinations.sql,
-- 20260909_shop_placements.sql and 20261122_shop_traffic.sql.
-- Safe to re-run.
--
-- Home banners (ad_campaigns) and the "Our featured cafes" row
-- (partner / sponsored placements) both record as the `promotion`
-- surface in shop_traffic_events. This table adds the campaign id and
-- the placement so each can be measured on its own.
--
-- No visitor identity is stored. Consent-gated in the app, like
-- shop_traffic_events. Admins read everything; a verified owner reads
-- only the featured rows of cafes they manage. Banner rows are admin
-- only (a banner is the advertiser's campaign, not the cafe's listing).
-- =========================================================

create table if not exists public.ad_campaign_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.ad_campaigns (id) on delete cascade,
  shop_id uuid references public.shops (id) on delete cascade,
  placement text not null,
  kind text not null,
  created_at timestamptz not null default now(),
  constraint ad_campaign_events_placement_check check (
    placement in ('banner', 'featured')
  ),
  constraint ad_campaign_events_kind_check check (
    kind in ('impression', 'click')
  ),
  -- A banner always belongs to a campaign. A featured row is a cafe
  -- placement: no campaign, always a cafe.
  constraint ad_campaign_events_shape_check check (
    (placement = 'banner' and campaign_id is not null)
    or (placement = 'featured' and campaign_id is null and shop_id is not null)
  )
);

comment on table public.ad_campaign_events is
  'Anonymous banner and featured-cafe impressions and clicks. No visitor identity. Consent-gated in the app.';

create index if not exists ad_campaign_events_campaign_created_idx
  on public.ad_campaign_events (campaign_id, created_at desc)
  where campaign_id is not null;

create index if not exists ad_campaign_events_featured_shop_created_idx
  on public.ad_campaign_events (shop_id, created_at desc)
  where placement = 'featured';

create index if not exists ad_campaign_events_created_idx
  on public.ad_campaign_events (created_at desc);

alter table public.ad_campaign_events enable row level security;

drop policy if exists ad_campaign_events_admin_read on public.ad_campaign_events;
create policy ad_campaign_events_admin_read
  on public.ad_campaign_events
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists ad_campaign_events_owner_featured_read on public.ad_campaign_events;
create policy ad_campaign_events_owner_featured_read
  on public.ad_campaign_events
  for select
  to authenticated
  using (
    placement = 'featured'
    and shop_id is not null
    and public.is_shop_owner(shop_id)
  );

revoke all on public.ad_campaign_events from public, anon, authenticated;
grant select on public.ad_campaign_events to authenticated;

create or replace function public.record_ad_event(
  p_placement text,
  p_kind text,
  p_campaign_id uuid default null,
  p_shop_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign_shop uuid;
  campaign_live boolean;
  campaign_kind text;
  target_shop uuid;
begin
  if p_placement not in ('banner', 'featured') then
    raise exception 'Unknown ad placement';
  end if;
  if p_kind not in ('impression', 'click') then
    raise exception 'Unknown ad event kind';
  end if;

  if p_placement = 'banner' then
    if p_campaign_id is null then
      raise exception 'Banner events need a campaign';
    end if;
    select
      c.shop_id,
      c.destination_kind,
      (
        c.enabled
        and c.cancelled_at is null
        and c.starts_at <= now()
        and c.ends_at > now()
      )
    into campaign_shop, campaign_kind, campaign_live
    from public.ad_campaigns c
    where c.id = p_campaign_id;

    if campaign_live is null or not campaign_live then
      raise exception 'Only live campaigns can receive ad events';
    end if;
    -- The shop always comes from the campaign; a client value is ignored.
    target_shop := campaign_shop;
    if campaign_kind = 'cafe' and not exists (
      select 1 from public.shops s where s.id = target_shop and s.status = 'approved'
    ) then
      raise exception 'Only live campaigns can receive ad events';
    end if;

    insert into public.ad_campaign_events (campaign_id, shop_id, placement, kind)
    values (p_campaign_id, target_shop, 'banner', p_kind);
    return;
  end if;

  -- featured: a partner or sponsored cafe with a placement running now.
  if p_shop_id is null then
    raise exception 'Featured events need a cafe';
  end if;
  if p_campaign_id is not null then
    raise exception 'Featured events have no campaign';
  end if;
  if not exists (
    select 1
    from public.shops s
    join public.shop_placements p on p.shop_id = s.id
    where s.id = p_shop_id
      and s.status = 'approved'
      and p.starts_at <= now()
      and p.ends_at > now()
  ) then
    raise exception 'Only featured cafes can receive ad events';
  end if;

  insert into public.ad_campaign_events (campaign_id, shop_id, placement, kind)
  values (null, p_shop_id, 'featured', p_kind);
end;
$$;

comment on function public.record_ad_event(text, text, uuid, uuid) is
  'Append one banner or featured impression/click. Validates the campaign or placement is live. No identity is stored.';

revoke all on function public.record_ad_event(text, text, uuid, uuid) from public;
grant execute on function public.record_ad_event(text, text, uuid, uuid) to anon, authenticated;

create or replace function public.ad_campaign_stats(
  p_from date,
  p_to date
)
returns table (
  campaign_id uuid,
  shop_id uuid,
  placement text,
  label text,
  impressions integer,
  clicks integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Invalid date range';
  end if;
  if p_to - p_from > 399 then
    raise exception 'Date range is too long';
  end if;

  return query
  select
    e.campaign_id,
    e.shop_id,
    e.placement,
    max(c.label),
    (count(*) filter (where e.kind = 'impression'))::integer,
    (count(*) filter (where e.kind = 'click'))::integer
  from public.ad_campaign_events e
  left join public.ad_campaigns c on c.id = e.campaign_id
  where e.created_at >= (p_from::timestamp at time zone 'Asia/Manila')
    and e.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Manila')
  group by e.campaign_id, e.shop_id, e.placement
  order by e.placement, 5 desc, 6 desc;
end;
$$;

comment on function public.ad_campaign_stats(date, date) is
  'Admin only. Banner impressions and clicks per campaign, featured per cafe, for a Manila date range.';

revoke all on function public.ad_campaign_stats(date, date) from public, anon;
grant execute on function public.ad_campaign_stats(date, date) to authenticated;
