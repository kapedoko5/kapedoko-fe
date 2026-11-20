-- =========================================================
-- KapéDoko — Home banner destinations
-- =========================================================
-- Run AFTER 20260929_admin_portal.sql.
-- Safe to re-run.
--
-- Home banners may open an approved cafe, an in-app /app path,
-- or an https link. Cafe-linked rows stay the default.
-- =========================================================

alter table public.ad_campaigns
  alter column shop_id drop not null;

alter table public.ad_campaigns
  add column if not exists destination_kind text not null default 'cafe';

alter table public.ad_campaigns
  add column if not exists destination_url text;

update public.ad_campaigns
set destination_kind = 'cafe'
where destination_kind is null or btrim(destination_kind) = '';

alter table public.ad_campaigns
  drop constraint if exists ad_campaigns_destination_kind;
alter table public.ad_campaigns
  add constraint ad_campaigns_destination_kind check (
    destination_kind in ('cafe', 'internal', 'external')
  );

alter table public.ad_campaigns
  drop constraint if exists ad_campaigns_destination_shape;
alter table public.ad_campaigns
  add constraint ad_campaigns_destination_shape check (
    (
      destination_kind = 'cafe'
      and shop_id is not null
      and destination_url is null
    )
    or (
      destination_kind = 'internal'
      and shop_id is null
      and destination_url ~ '^(/app|/app/map|/app/search|/app/cafes/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|/app/events/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$'
    )
    or (
      destination_kind = 'external'
      and shop_id is null
      and destination_url ~* '^https://'
      and destination_url !~* '[[:space:]]'
      and destination_url !~* 'javascript:'
    )
  );

comment on table public.ad_campaigns is
  'Home banners. Destination is an approved cafe, an in-app /app path, or an https link. Public reads only currently enabled, in-window rows.';

create or replace function public.ad_campaigns_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  shop_status text;
  kind text;
  url text;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  kind := lower(btrim(coalesce(new.destination_kind, 'cafe')));
  if kind not in ('cafe', 'internal', 'external') then
    kind := case when new.shop_id is not null then 'cafe' else '' end;
  end if;
  if kind = '' then
    raise exception 'Choose a destination.';
  end if;
  new.destination_kind := kind;

  url := nullif(btrim(coalesce(new.destination_url, '')), '');

  if kind = 'cafe' then
    new.destination_url := null;
    select status into shop_status from public.shops where id = new.shop_id;
    if shop_status is null then
      raise exception 'Cafe was not found';
    end if;
    if shop_status <> 'approved' then
      raise exception 'Only approved cafes can receive banners';
    end if;
  else
    new.shop_id := null;
    new.destination_url := url;
    if url is null then
      raise exception 'Enter a destination link.';
    end if;
    if kind = 'internal' and url !~ '^(/app|/app/map|/app/search|/app/cafes/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|/app/events/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$' then
      raise exception 'Use an in-app path like /app, /app/map, /app/cafes/…, or /app/events/…';
    end if;
    if kind = 'external' and (
      url !~* '^https://'
      or url ~* '[[:space:]]'
      or url ~* 'javascript:'
    ) then
      raise exception 'Use an https link.';
    end if;
  end if;

  if TG_OP = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    new.created_at := coalesce(new.created_at, now());
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  if new.cancelled_at is not null then
    new.enabled := false;
  end if;
  return new;
end;
$$;

create or replace function public.ad_campaigns_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    perform public.admin_write_audit(
      'ad.delete',
      'ad_campaign',
      old.id::text,
      jsonb_build_object('shop_id', old.shop_id, 'destination_kind', old.destination_kind)
    );
    return old;
  end if;
  perform public.admin_write_audit(
    case when TG_OP = 'INSERT' then 'ad.create' else 'ad.update' end,
    'ad_campaign',
    new.id::text,
    jsonb_build_object(
      'shop_id', new.shop_id,
      'destination_kind', new.destination_kind,
      'enabled', new.enabled
    )
  );
  return new;
end;
$$;

drop policy if exists ad_campaigns_public_read on public.ad_campaigns;
create policy ad_campaigns_public_read
  on public.ad_campaigns
  for select
  to anon, authenticated
  using (
    enabled
    and cancelled_at is null
    and starts_at <= now()
    and ends_at > now()
    and (
      (
        destination_kind = 'cafe'
        and exists (
          select 1 from public.shops s
          where s.id = shop_id and s.status = 'approved'
        )
      )
      or destination_kind in ('internal', 'external')
    )
  );

drop view if exists public.active_ad_campaigns;
create view public.active_ad_campaigns
with (security_invoker = true) as
select
  id,
  shop_id,
  banner_object_key,
  starts_at,
  ends_at,
  priority,
  label,
  destination_kind,
  destination_url
from public.ad_campaigns
where enabled
  and cancelled_at is null
  and starts_at <= now()
  and ends_at > now();

grant select on public.active_ad_campaigns to anon, authenticated;
