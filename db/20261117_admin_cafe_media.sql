-- =========================================================
-- KapéDoko — Admin cafe posters and featured photos
-- =========================================================
-- Run AFTER 20261114_owner_cafe_media.sql.
-- Safe to re-run.
--
-- Admins may replace or take down the in-cafe poster and
-- featured photos from cafe edit. Home banners stay on Ads.
-- =========================================================

drop function if exists public.update_admin_shop(uuid, text, text, double precision, double precision, jsonb, text, text);

create or replace function public.update_admin_shop(
  p_shop_id uuid,
  p_name text,
  p_address text,
  p_latitude double precision,
  p_longitude double precision,
  p_hours jsonb,
  p_contact_number text default null,
  p_logo_object_key text default null,
  p_gallery_object_keys text[] default null
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
    gallery_object_keys = clean_keys
  where id = p_shop_id
  returning * into updated;

  if updated.id is null then
    raise exception 'Cafe was not found';
  end if;

  perform public.admin_write_audit(
    'shop.update',
    'shop',
    updated.id::text,
    jsonb_build_object('name', updated.name)
  );
  return updated;
end;
$$;

create or replace function public.publish_admin_poster(
  p_shop_id uuid,
  p_poster_object_key text
)
returns public.shop_posters
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_key text := btrim(coalesce(p_poster_object_key, ''));
  expected_prefix text;
  posted public.shop_posters;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;
  if p_shop_id is null or not exists (select 1 from public.shops where id = p_shop_id) then
    raise exception 'Cafe was not found';
  end if;
  if not public.shop_media_key_ok(clean_key) then
    raise exception 'Poster image key is invalid';
  end if;

  expected_prefix := 'shop-posters/' || auth.uid()::text || '/';
  if clean_key not like expected_prefix || '%' then
    raise exception 'Poster image key is invalid';
  end if;

  update public.shop_posters
  set ended_at = now()
  where shop_id = p_shop_id
    and ended_at is null;

  insert into public.shop_posters (shop_id, poster_object_key, created_by)
  values (p_shop_id, clean_key, auth.uid())
  returning * into posted;

  perform public.admin_write_audit(
    'shop.poster_publish',
    'shop',
    p_shop_id::text,
    jsonb_build_object('poster_id', posted.id)
  );
  return posted;
end;
$$;

create or replace function public.end_admin_poster(p_poster_id uuid)
returns public.shop_posters
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.shop_posters;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  update public.shop_posters
  set ended_at = coalesce(ended_at, now())
  where id = p_poster_id
    and ended_at is null
  returning * into updated;

  if updated.id is null then
    raise exception 'Poster was not found.';
  end if;

  perform public.admin_write_audit(
    'shop.poster_end',
    'shop',
    updated.shop_id::text,
    jsonb_build_object('poster_id', updated.id)
  );
  return updated;
end;
$$;

revoke all on function public.update_admin_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[]) from public, anon;
revoke all on function public.publish_admin_poster(uuid, text) from public, anon;
revoke all on function public.end_admin_poster(uuid) from public, anon;

grant execute on function public.update_admin_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[]) to authenticated;
grant execute on function public.publish_admin_poster(uuid, text) to authenticated;
grant execute on function public.end_admin_poster(uuid) to authenticated;

notify pgrst, 'reload schema';
