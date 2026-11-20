-- =========================================================
-- KapéDoko — Partnership Home carousel + listing entitlements
-- =========================================================
-- Run AFTER 20261118_vibe_tags.sql (update_owner_shop with vibes)
-- and 20260929_admin_portal.sql (save_shop_placement).
-- Safe to re-run.
--
-- Partner and sponsored pins stay on the map from kind + window.
-- Home carousel is opt-in per placement (show_on_home).
-- Free listings may keep three featured photos; a current
-- partner/sponsored window raises the owner cap to eight.
-- Owner name changes wait in pending_name until an admin reviews.
-- =========================================================

alter table public.shop_placements
  add column if not exists show_on_home boolean not null default false;

comment on column public.shop_placements.show_on_home is
  'When true, an active partner or sponsored pin may appear on the Home fallback rail. Map pins ignore this flag.';

alter table public.shops
  add column if not exists pending_name text;

update public.shops
set pending_name = nullif(btrim(pending_name), '')
where pending_name is not null;

alter table public.shops drop constraint if exists shops_pending_name_len;
alter table public.shops
  add constraint shops_pending_name_len check (
    pending_name is null
    or char_length(btrim(pending_name)) between 2 and 80
  );

comment on column public.shops.pending_name is
  'Owner-proposed cafe name. Live shops.name stays until an admin accepts.';

drop function if exists public.save_shop_placement(uuid, text, timestamptz, timestamptz);

create or replace function public.save_shop_placement(
  p_shop_id uuid,
  p_kind text,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_show_on_home boolean default false
)
returns public.shop_placements
language plpgsql
security definer
set search_path = public
as $$
declare
  shop_status text;
  created public.shop_placements;
  now_ts timestamptz := now();
  home_flag boolean := coalesce(p_show_on_home, false);
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select status into shop_status from public.shops where id = p_shop_id;
  if shop_status is null then
    raise exception 'Cafe was not found';
  end if;
  if shop_status <> 'approved' then
    raise exception 'Approve the cafe before setting a map pin.';
  end if;

  if p_kind is not null and p_kind not in ('partner', 'sponsored', 'standard') then
    raise exception 'Unknown placement kind';
  end if;

  update public.shop_placements
  set ends_at = now_ts
  where shop_id = p_shop_id
    and starts_at < now_ts
    and ends_at > now_ts;

  delete from public.shop_placements
  where shop_id = p_shop_id
    and starts_at >= now_ts;

  if p_kind is null or p_kind = 'standard' then
    perform public.admin_write_audit(
      'placement.clear',
      'shop',
      p_shop_id::text,
      jsonb_build_object('kind', 'standard')
    );
    return null;
  end if;

  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'Choose an end date after the start date.';
  end if;

  insert into public.shop_placements (shop_id, kind, starts_at, ends_at, show_on_home, created_by)
  values (
    p_shop_id,
    p_kind::public.shop_placement_kind,
    p_starts_at,
    p_ends_at,
    home_flag,
    auth.uid()
  )
  returning * into created;

  perform public.admin_write_audit(
    'placement.save',
    'shop_placement',
    created.id::text,
    jsonb_build_object(
      'shop_id', p_shop_id,
      'kind', p_kind,
      'starts_at', p_starts_at,
      'ends_at', p_ends_at,
      'show_on_home', home_flag
    )
  );

  return created;
end;
$$;

create or replace function public.shop_has_paid_placement(p_shop_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_placements p
    where p.shop_id = p_shop_id
      and p.starts_at <= now()
      and p.ends_at > now()
  );
$$;

create or replace function public.update_owner_shop(
  p_shop_id uuid,
  p_name text,
  p_address text,
  p_latitude double precision,
  p_longitude double precision,
  p_hours jsonb,
  p_contact_number text default null,
  p_logo_object_key text default null,
  p_gallery_object_keys text[] default null,
  p_vibe_tag_ids uuid[] default null
)
returns public.shops
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.shops;
  current_row public.shops;
  clean_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  clean_address text := btrim(regexp_replace(coalesce(p_address, ''), '\s+', ' ', 'g'));
  clean_phone text := nullif(btrim(coalesce(p_contact_number, '')), '');
  clean_keys text[];
  expected_prefix text;
  live_name text;
  next_pending text;
  gallery_max integer := 3;
begin
  if auth.uid() is null then
    raise exception 'Sign in to edit this cafe.';
  end if;
  if not public.is_shop_owner(p_shop_id) then
    raise exception 'You can only edit cafes you manage.';
  end if;
  if char_length(clean_name) < 2 or char_length(clean_name) > 80 then
    raise exception 'Check the cafe name and try again.';
  end if;
  if char_length(clean_address) < 8 or char_length(clean_address) > 200 then
    raise exception 'Check the cafe address and try again.';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude < -90 or p_latitude > 90
     or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Pin the cafe on the map.';
  end if;
  if not public.is_valid_shop_hours(p_hours) then
    raise exception 'Check the opening hours and try again.';
  end if;

  select * into current_row from public.shops where id = p_shop_id;
  if current_row.id is null then
    raise exception 'Cafe was not found';
  end if;

  if clean_name is not distinct from current_row.name then
    live_name := current_row.name;
    next_pending := null;
  else
    live_name := current_row.name;
    next_pending := clean_name;
  end if;

  if public.shop_has_paid_placement(p_shop_id) then
    gallery_max := 8;
  end if;

  expected_prefix := 'shop-photos/' || auth.uid()::text || '/';
  if p_gallery_object_keys is null then
    clean_keys := coalesce(current_row.gallery_object_keys, '{}'::text[]);
  else
    select coalesce(array_agg(k), '{}'::text[])
      into clean_keys
    from (
      select distinct btrim(k) as k
      from unnest(p_gallery_object_keys) as k
      where btrim(coalesce(k, '')) <> ''
    ) as keys;

    if cardinality(clean_keys) > gallery_max then
      raise exception 'Keep featured photos to %.', gallery_max;
    end if;

    if exists (
      select 1
      from unnest(clean_keys) as k
      where not public.shop_media_key_ok(k)
         or (
           k not like expected_prefix || '%'
           and not exists (
             select 1
             from unnest(coalesce(current_row.gallery_object_keys, '{}'::text[])) as existing
             where existing = k
           )
         )
    ) then
      raise exception 'Featured photo key is invalid';
    end if;
  end if;

  update public.shops
  set
    name = live_name,
    pending_name = next_pending,
    address = clean_address,
    latitude = p_latitude,
    longitude = p_longitude,
    hours = p_hours,
    contact_number = clean_phone,
    logo_object_key = coalesce(nullif(p_logo_object_key, ''), logo_object_key),
    gallery_object_keys = clean_keys
  where id = p_shop_id
    and status = 'approved'::public.shop_status
  returning * into updated;

  if updated.id is null then
    raise exception 'Cafe was not found';
  end if;

  if p_vibe_tag_ids is not null then
    perform public.replace_shop_vibe_tags(p_shop_id, p_vibe_tag_ids);
  end if;

  perform public.admin_write_audit(
    'shop.owner_update',
    'shop',
    updated.id::text,
    jsonb_build_object(
      'name', updated.name,
      'pending_name', updated.pending_name
    )
  );
  return updated;
end;
$$;

create or replace function public.update_admin_shop(
  p_shop_id uuid,
  p_name text,
  p_address text,
  p_latitude double precision,
  p_longitude double precision,
  p_hours jsonb,
  p_contact_number text default null,
  p_logo_object_key text default null,
  p_gallery_object_keys text[] default null,
  p_vibe_tag_ids uuid[] default null
)
returns public.shops
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.shops;
  current_row public.shops;
  clean_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  clean_address text := btrim(regexp_replace(coalesce(p_address, ''), '\s+', ' ', 'g'));
  clean_phone text := nullif(btrim(coalesce(p_contact_number, '')), '');
  clean_keys text[];
  next_pending text;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;
  if char_length(clean_name) < 2 or char_length(clean_name) > 80 then
    raise exception 'Check the cafe name and try again.';
  end if;
  if char_length(clean_address) < 8 or char_length(clean_address) > 200 then
    raise exception 'Check the cafe address and try again.';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude < -90 or p_latitude > 90
     or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Pin the cafe on the map.';
  end if;
  if not public.is_valid_shop_hours(p_hours) then
    raise exception 'Check the opening hours and try again.';
  end if;

  select * into current_row from public.shops where id = p_shop_id;
  if current_row.id is null then
    raise exception 'Cafe was not found';
  end if;

  if current_row.pending_name is not null
     and clean_name is not distinct from current_row.pending_name then
    next_pending := null;
  elsif clean_name is distinct from current_row.name then
    next_pending := null;
  else
    next_pending := current_row.pending_name;
  end if;

  if p_gallery_object_keys is null then
    clean_keys := coalesce(current_row.gallery_object_keys, '{}'::text[]);
  else
    select coalesce(array_agg(k), '{}'::text[])
      into clean_keys
    from (
      select distinct btrim(k) as k
      from unnest(p_gallery_object_keys) as k
      where btrim(coalesce(k, '')) <> ''
    ) as keys;

    if cardinality(clean_keys) > 8 then
      raise exception 'Keep featured photos to 8.';
    end if;

    if exists (
      select 1
      from unnest(clean_keys) as k
      where not public.shop_media_key_ok(k)
         or (
           k not like 'shop-photos/%'
           and not exists (
             select 1
             from unnest(coalesce(current_row.gallery_object_keys, '{}'::text[])) as existing
             where existing = k
           )
         )
    ) then
      raise exception 'Featured photo key is invalid';
    end if;
  end if;

  perform set_config('app.admin_shop_write', 'on', true);

  update public.shops
  set
    name = clean_name,
    pending_name = next_pending,
    address = clean_address,
    latitude = p_latitude,
    longitude = p_longitude,
    hours = p_hours,
    contact_number = clean_phone,
    logo_object_key = coalesce(nullif(p_logo_object_key, ''), logo_object_key),
    gallery_object_keys = clean_keys
  where id = p_shop_id
  returning * into updated;

  if updated.id is null then
    raise exception 'Cafe was not found';
  end if;

  if p_vibe_tag_ids is not null then
    perform public.replace_shop_vibe_tags(p_shop_id, p_vibe_tag_ids);
  end if;

  perform public.admin_write_audit(
    'shop.update',
    'shop',
    updated.id::text,
    jsonb_build_object('name', updated.name, 'pending_name', updated.pending_name)
  );
  return updated;
end;
$$;

create or replace function public.review_owner_shop_name(
  p_shop_id uuid,
  p_accept boolean
)
returns public.shops
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.shops;
  updated public.shops;
  proposed text;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into current_row from public.shops where id = p_shop_id;
  if current_row.id is null then
    raise exception 'Cafe was not found';
  end if;

  proposed := nullif(btrim(coalesce(current_row.pending_name, '')), '');
  if proposed is null then
    raise exception 'No name change is waiting.';
  end if;
  if char_length(proposed) < 2 or char_length(proposed) > 80 then
    raise exception 'Check the cafe name and try again.';
  end if;

  perform set_config('app.admin_shop_write', 'on', true);

  if coalesce(p_accept, false) then
    update public.shops
    set name = proposed, pending_name = null
    where id = p_shop_id
    returning * into updated;
  else
    update public.shops
    set pending_name = null
    where id = p_shop_id
    returning * into updated;
  end if;

  if updated.id is null then
    raise exception 'Cafe was not found';
  end if;

  perform public.admin_write_audit(
    case when coalesce(p_accept, false) then 'shop.name_accept' else 'shop.name_reject' end,
    'shop',
    updated.id::text,
    jsonb_build_object('name', updated.name, 'proposed', proposed)
  );
  return updated;
end;
$$;

revoke all on function public.save_shop_placement(uuid, text, timestamptz, timestamptz, boolean) from public, anon;
revoke all on function public.shop_has_paid_placement(uuid) from public, anon;
revoke all on function public.review_owner_shop_name(uuid, boolean) from public, anon;
revoke all on function public.update_owner_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[], uuid[]) from public, anon;
revoke all on function public.update_admin_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[], uuid[]) from public, anon;

grant execute on function public.save_shop_placement(uuid, text, timestamptz, timestamptz, boolean) to authenticated;
grant execute on function public.shop_has_paid_placement(uuid) to authenticated;
grant execute on function public.review_owner_shop_name(uuid, boolean) to authenticated;
grant execute on function public.update_owner_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[], uuid[]) to authenticated;
grant execute on function public.update_admin_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[], uuid[]) to authenticated;

notify pgrst, 'reload schema';
