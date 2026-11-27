-- =========================================================
-- KapéDoko — poster_view kind and share surface (issue #67, Phase 3.3)
-- =========================================================
-- Run AFTER 20261122_shop_traffic.sql.
-- Safe to re-run.
--
-- poster_view: a visitor opened a café's ad poster. Until now poster
--              opens were counted as photo_view.
-- share:       the café page was opened from a shared link
--              (?from=share).
--
-- The privacy page and consent copy list these events; ship the app
-- update with this migration.
-- =========================================================

-- Re-add the checks as NOT VALID then VALIDATE, so the table is not
-- locked for a full scan while traffic is being recorded.
alter table public.shop_traffic_events
  drop constraint if exists shop_traffic_kind_check;
alter table public.shop_traffic_events
  add constraint shop_traffic_kind_check check (
    kind in (
      'card_impression',
      'card_click',
      'detail_view',
      'navigate',
      'call',
      'photo_view',
      'poster_view'
    )
  ) not valid;
alter table public.shop_traffic_events
  validate constraint shop_traffic_kind_check;

alter table public.shop_traffic_events
  drop constraint if exists shop_traffic_surface_check;
alter table public.shop_traffic_events
  add constraint shop_traffic_surface_check check (
    surface in (
      'home',
      'search',
      'map',
      'favorites',
      'promotion',
      'direct',
      'share'
    )
  ) not valid;
alter table public.shop_traffic_events
  validate constraint shop_traffic_surface_check;

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
    'photo_view',
    'poster_view'
  ) then
    raise exception 'Unknown traffic kind';
  end if;
  if p_surface not in (
    'home',
    'search',
    'map',
    'favorites',
    'promotion',
    'direct',
    'share'
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
