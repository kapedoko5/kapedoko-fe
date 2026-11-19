-- =========================================================
-- KapéDoko — first-party café listing traffic
-- =========================================================
-- Run AFTER shops, is_admin(), and is_shop_owner() exist.
-- Safe to re-run.
--
-- Visitors who allow usage analytics record café card views and
-- taps, café page opens, directions, calls, and photo taps.
-- Rows store no account, IP, or device id. Admins read every café;
-- verified owners read only cafés they manage.
-- Retention is documented as one year. A scheduled purge can be
-- added later; this file does not delete old rows.
-- =========================================================

create table if not exists public.shop_traffic_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  kind text not null,
  surface text not null,
  created_at timestamptz not null default now(),
  constraint shop_traffic_kind_check check (
    kind in (
      'card_impression',
      'card_click',
      'detail_view',
      'navigate',
      'call',
      'photo_view'
    )
  ),
  constraint shop_traffic_surface_check check (
    surface in (
      'home',
      'search',
      'map',
      'favorites',
      'promotion',
      'direct'
    )
  )
);

comment on table public.shop_traffic_events is
  'Anonymous café listing traffic. No visitor identity. Consent-gated in the app.';

create index if not exists shop_traffic_events_shop_created_idx
  on public.shop_traffic_events (shop_id, created_at desc);

create index if not exists shop_traffic_events_created_idx
  on public.shop_traffic_events (created_at desc);

alter table public.shop_traffic_events enable row level security;

drop policy if exists shop_traffic_events_staff_owner_read on public.shop_traffic_events;
create policy shop_traffic_events_staff_owner_read
  on public.shop_traffic_events
  for select
  to authenticated
  using (public.is_admin() or public.is_shop_owner(shop_id));

revoke all on public.shop_traffic_events from public, anon, authenticated;
grant select on public.shop_traffic_events to authenticated;

create or replace function public.record_shop_traffic(
  p_shop_id uuid,
  p_kind text,
  p_surface text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  shop_status text;
begin
  if p_kind not in (
    'card_impression',
    'card_click',
    'detail_view',
    'navigate',
    'call',
    'photo_view'
  ) then
    raise exception 'Unknown traffic kind';
  end if;
  if p_surface not in (
    'home',
    'search',
    'map',
    'favorites',
    'promotion',
    'direct'
  ) then
    raise exception 'Unknown traffic surface';
  end if;

  select status::text into shop_status from public.shops where id = p_shop_id;
  if shop_status is null or shop_status <> 'approved' then
    raise exception 'Only approved shops can receive traffic';
  end if;

  insert into public.shop_traffic_events (shop_id, kind, surface)
  values (p_shop_id, p_kind, p_surface);
end;
$$;

comment on function public.record_shop_traffic(uuid, text, text) is
  'Append one café listing traffic event. No identity is stored.';

revoke all on function public.record_shop_traffic(uuid, text, text) from public;
grant execute on function public.record_shop_traffic(uuid, text, text) to anon, authenticated;

create or replace view public.shop_traffic_daily
with (security_invoker = true) as
select
  shop_id,
  kind,
  surface,
  timezone('Asia/Manila', created_at)::date as day,
  count(*)::int as hits
from public.shop_traffic_events
group by shop_id, kind, surface, timezone('Asia/Manila', created_at)::date;

comment on view public.shop_traffic_daily is
  'Manila-day rollups of café listing traffic. RLS follows shop_traffic_events.';

grant select on public.shop_traffic_daily to authenticated;
