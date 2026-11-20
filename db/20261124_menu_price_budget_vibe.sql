-- =========================================================
-- KapéDoko — Menu price (₱) and Budget-friendly surprise stamp
-- =========================================================
-- Run AFTER 20261118_vibe_tags.sql.
-- Safe to re-run.
--
-- Admins and verified owners set a typical menu price in pesos
-- on cafe edit. Below ₱100 stamps Budget-friendly. That stamp
-- is not a picker option and does not occupy a catalog slot.
-- =========================================================

alter table public.shops
  add column if not exists menu_price_php integer;

alter table public.shops
  drop constraint if exists shops_menu_price_php_range;
alter table public.shops
  add constraint shops_menu_price_php_range check (
    menu_price_php is null or (menu_price_php between 1 and 99999)
  );

comment on column public.shops.menu_price_php is
  'Typical menu price in pesos. Below ₱100 stamps Budget-friendly.';

alter table public.vibe_tag_names disable trigger vibe_tag_names_before_write;
alter table public.vibe_tag_names disable trigger vibe_tag_names_after_write;

insert into public.vibe_tag_names (label, slug, lucide_icon, color, enabled)
values ('Budget-friendly', 'budget-friendly', 'leaf', '#2F6B4F', true)
on conflict (slug) do nothing;

alter table public.vibe_tag_names enable trigger vibe_tag_names_before_write;
alter table public.vibe_tag_names enable trigger vibe_tag_names_after_write;

create or replace function public.shop_vibe_tags_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tagged integer;
  is_budget boolean := false;
begin
  select exists (
    select 1
    from public.vibe_tag_names
    where id = new.tag_id
      and slug = 'budget-friendly'
  ) into is_budget;

  if is_budget then
    return new;
  end if;

  select count(*) into tagged
  from public.shop_vibe_tags t
  join public.vibe_tag_names names on names.id = t.tag_id
  where t.shop_id = new.shop_id
    and names.slug <> 'budget-friendly';

  if tagged >= 5 then
    raise exception 'Keep vibe tags to 5.';
  end if;
  return new;
end;
$$;

create or replace function public.replace_shop_vibe_tags(
  p_shop_id uuid,
  p_vibe_tag_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  keep_disabled uuid[];
  next_enabled uuid[];
  user_disabled integer;
begin
  select coalesce(array_agg(t.tag_id), '{}'::uuid[])
    into keep_disabled
  from public.shop_vibe_tags t
  join public.vibe_tag_names n on n.id = t.tag_id
  where t.shop_id = p_shop_id
    and n.enabled = false;

  select coalesce(array_agg(distinct sid), '{}'::uuid[])
    into next_enabled
  from unnest(coalesce(p_vibe_tag_ids, '{}'::uuid[])) as sid
  join public.vibe_tag_names n on n.id = sid
  where n.enabled
    and n.slug <> 'budget-friendly';

  select count(*) into user_disabled
  from unnest(keep_disabled) as d
  join public.vibe_tag_names n on n.id = d
  where n.slug <> 'budget-friendly';

  if user_disabled + cardinality(next_enabled) > 5 then
    raise exception 'Keep vibe tags to 5.';
  end if;

  delete from public.shop_vibe_tags
  where shop_id = p_shop_id
    and tag_id <> all (keep_disabled);

  insert into public.shop_vibe_tags (shop_id, tag_id)
  select p_shop_id, sid
  from unnest(next_enabled) as sid
  on conflict do nothing;
end;
$$;

create or replace function public.sync_budget_friendly_vibe(p_shop_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tag uuid;
  tag_enabled boolean;
  price integer;
begin
  select menu_price_php into price
  from public.shops
  where id = p_shop_id;

  select id, enabled into tag, tag_enabled
  from public.vibe_tag_names
  where slug = 'budget-friendly'
  limit 1;

  if tag is null then
    return;
  end if;

  if price is not null and price < 100 and tag_enabled then
    insert into public.shop_vibe_tags (shop_id, tag_id)
    values (p_shop_id, tag)
    on conflict do nothing;
  else
    delete from public.shop_vibe_tags
    where shop_id = p_shop_id
      and tag_id = tag;
  end if;
end;
$$;

comment on function public.sync_budget_friendly_vibe(uuid) is
  'Stamps Budget-friendly when menu_price_php is below ₱100. Not a picker option.';

drop function if exists public.update_owner_shop(uuid, text, text, double precision, double precision, jsonb, text, text);
drop function if exists public.update_owner_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[]);
drop function if exists public.update_owner_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[], uuid[]);
drop function if exists public.update_owner_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[], uuid[], integer);

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
  p_vibe_tag_ids uuid[] default null,
  p_menu_price_php integer default null
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
  if p_menu_price_php is not null and (p_menu_price_php < 1 or p_menu_price_php > 99999) then
    raise exception 'Use a peso amount from 1 to 99,999.';
  end if;

  select * into current_row from public.shops where id = p_shop_id;
  if current_row.id is null then
    raise exception 'Cafe was not found';
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

    if cardinality(clean_keys) > 8 then
      raise exception 'Keep featured photos to 8.';
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
    name = clean_name,
    address = clean_address,
    latitude = p_latitude,
    longitude = p_longitude,
    hours = p_hours,
    contact_number = clean_phone,
    logo_object_key = coalesce(nullif(p_logo_object_key, ''), logo_object_key),
    gallery_object_keys = clean_keys,
    menu_price_php = p_menu_price_php
  where id = p_shop_id
    and status = 'approved'::public.shop_status
  returning * into updated;

  if updated.id is null then
    raise exception 'Cafe was not found';
  end if;

  if p_vibe_tag_ids is not null then
    perform public.replace_shop_vibe_tags(p_shop_id, p_vibe_tag_ids);
  end if;

  perform public.sync_budget_friendly_vibe(p_shop_id);

  perform public.admin_write_audit(
    'shop.owner_update',
    'shop',
    updated.id::text,
    jsonb_build_object('name', updated.name, 'menu_price_php', updated.menu_price_php)
  );
  return updated;
end;
$$;

drop function if exists public.update_admin_shop(uuid, text, text, double precision, double precision, jsonb, text, text);
drop function if exists public.update_admin_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[]);
drop function if exists public.update_admin_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[], uuid[]);
drop function if exists public.update_admin_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[], uuid[], integer);

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
  p_vibe_tag_ids uuid[] default null,
  p_menu_price_php integer default null
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
  if p_menu_price_php is not null and (p_menu_price_php < 1 or p_menu_price_php > 99999) then
    raise exception 'Use a peso amount from 1 to 99,999.';
  end if;

  select * into current_row from public.shops where id = p_shop_id;
  if current_row.id is null then
    raise exception 'Cafe was not found';
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
    address = clean_address,
    latitude = p_latitude,
    longitude = p_longitude,
    hours = p_hours,
    contact_number = clean_phone,
    logo_object_key = coalesce(nullif(p_logo_object_key, ''), logo_object_key),
    gallery_object_keys = clean_keys,
    menu_price_php = p_menu_price_php
  where id = p_shop_id
  returning * into updated;

  if updated.id is null then
    raise exception 'Cafe was not found';
  end if;

  if p_vibe_tag_ids is not null then
    perform public.replace_shop_vibe_tags(p_shop_id, p_vibe_tag_ids);
  end if;

  perform public.sync_budget_friendly_vibe(p_shop_id);

  perform public.admin_write_audit(
    'shop.update',
    'shop',
    updated.id::text,
    jsonb_build_object('name', updated.name, 'menu_price_php', updated.menu_price_php)
  );
  return updated;
end;
$$;

drop function if exists public.create_admin_shop(text, text, double precision, double precision, jsonb, text, text);
drop function if exists public.create_admin_shop(text, text, double precision, double precision, jsonb, text, text, integer);

create or replace function public.create_admin_shop(
  p_name text,
  p_address text,
  p_latitude double precision,
  p_longitude double precision,
  p_hours jsonb,
  p_contact_number text default null,
  p_logo_object_key text default null,
  p_menu_price_php integer default null
)
returns public.shops
language plpgsql
security definer
set search_path = public
as $$
declare
  created public.shops;
  clean_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  clean_address text := btrim(regexp_replace(coalesce(p_address, ''), '\s+', ' ', 'g'));
  clean_phone text := nullif(btrim(coalesce(p_contact_number, '')), '');
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
  if p_menu_price_php is not null and (p_menu_price_php < 1 or p_menu_price_php > 99999) then
    raise exception 'Use a peso amount from 1 to 99,999.';
  end if;

  perform set_config('app.admin_shop_write', 'on', true);

  insert into public.shops (
    name,
    address,
    latitude,
    longitude,
    hours,
    contact_number,
    logo_object_key,
    menu_price_php,
    submitted_by,
    status,
    source
  )
  values (
    clean_name,
    clean_address,
    p_latitude,
    p_longitude,
    p_hours,
    clean_phone,
    nullif(p_logo_object_key, ''),
    p_menu_price_php,
    auth.uid(),
    'hidden'::public.shop_status,
    'admin'
  )
  returning * into created;

  perform public.sync_budget_friendly_vibe(created.id);

  perform public.admin_write_audit(
    'shop.create',
    'shop',
    created.id::text,
    jsonb_build_object('name', created.name, 'status', created.status, 'bypass_coverage', true, 'menu_price_php', created.menu_price_php)
  );

  return created;
end;
$$;

revoke all on function public.sync_budget_friendly_vibe(uuid) from public, anon;
revoke all on function public.replace_shop_vibe_tags(uuid, uuid[]) from public, anon;
revoke all on function public.update_owner_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[], uuid[], integer) from public, anon;
revoke all on function public.update_admin_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[], uuid[], integer) from public, anon;
revoke all on function public.create_admin_shop(text, text, double precision, double precision, jsonb, text, text, integer) from public, anon;

grant execute on function public.update_owner_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[], uuid[], integer) to authenticated;
grant execute on function public.update_admin_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[], uuid[], integer) to authenticated;
grant execute on function public.create_admin_shop(text, text, double precision, double precision, jsonb, text, text, integer) to authenticated;

notify pgrst, 'reload schema';
