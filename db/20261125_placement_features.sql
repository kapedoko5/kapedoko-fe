-- =========================================================
-- KapéDoko — Per-cafe partnership feature flags
-- =========================================================
-- Run AFTER db/20261124_placement_home_carousel.sql.
-- Safe to re-run.
--
-- Admin picks extras per partner/sponsored cafe. Always-on
-- listing tools are not stored. Home carousel stays in
-- show_on_home, synced from features.home_carousel.
-- =========================================================

alter table public.shop_placements
  add column if not exists features jsonb not null default '{}'::jsonb;

comment on column public.shop_placements.features is
  'Optional extras for this window: featured_photos, ad_poster, analytics, home_carousel.';

update public.shop_placements
set features = jsonb_strip_nulls(jsonb_build_object(
  'home_carousel', show_on_home,
  'featured_photos', true,
  'ad_poster', kind = 'sponsored',
  'analytics', kind = 'sponsored'
))
where features = '{}'::jsonb or features is null;

drop function if exists public.save_shop_placement(uuid, text, timestamptz, timestamptz);
drop function if exists public.save_shop_placement(uuid, text, timestamptz, timestamptz, boolean);

create or replace function public.save_shop_placement(
  p_shop_id uuid,
  p_kind text,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_show_on_home boolean default false,
  p_features jsonb default null
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
  feats jsonb;
  home_flag boolean;
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

  if p_kind = 'sponsored' then
    feats := jsonb_build_object(
      'featured_photos', true,
      'ad_poster', true,
      'analytics', true,
      'home_carousel', false
    );
  else
    feats := jsonb_build_object(
      'featured_photos', true,
      'ad_poster', false,
      'analytics', false,
      'home_carousel', false
    );
  end if;

  if p_features is not null and jsonb_typeof(p_features) = 'object' then
    feats := feats || jsonb_build_object(
      'featured_photos', coalesce((p_features->>'featured_photos')::boolean, (feats->>'featured_photos')::boolean),
      'ad_poster', coalesce((p_features->>'ad_poster')::boolean, (feats->>'ad_poster')::boolean),
      'analytics', coalesce((p_features->>'analytics')::boolean, (feats->>'analytics')::boolean),
      'home_carousel', coalesce((p_features->>'home_carousel')::boolean, coalesce(p_show_on_home, false))
    );
  elsif p_show_on_home then
    feats := feats || jsonb_build_object('home_carousel', true);
  end if;

  home_flag := coalesce((feats->>'home_carousel')::boolean, false);

  insert into public.shop_placements (shop_id, kind, starts_at, ends_at, show_on_home, features, created_by)
  values (
    p_shop_id,
    p_kind::public.shop_placement_kind,
    p_starts_at,
    p_ends_at,
    home_flag,
    feats,
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
      'features', feats
    )
  );

  return created;
end;
$$;

create or replace function public.shop_has_feature(p_shop_id uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_placements p
    where p.shop_id = p_shop_id
      and p.starts_at <= now()
      and p.ends_at > now()
      and coalesce((p.features ->> p_feature)::boolean, false)
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

  if public.shop_has_feature(p_shop_id, 'featured_photos') then
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

create or replace function public.publish_owner_poster(
  p_shop_ids uuid[],
  p_poster_object_key text
)
returns setof public.shop_posters
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_key text := btrim(coalesce(p_poster_object_key, ''));
  shop_ids uuid[];
  expected_prefix text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to post a poster.';
  end if;

  select array(
    select distinct sid
    from unnest(coalesce(p_shop_ids, '{}'::uuid[])) as sid
    where sid is not null
  ) into shop_ids;

  if cardinality(shop_ids) is null or cardinality(shop_ids) = 0 then
    raise exception 'Choose at least one cafe.';
  end if;

  if not public.shop_media_key_ok(clean_key) then
    raise exception 'Poster image key is invalid';
  end if;

  expected_prefix := 'shop-posters/' || auth.uid()::text || '/';
  if clean_key not like expected_prefix || '%' then
    raise exception 'Poster image key is invalid';
  end if;

  if exists (
    select 1
    from unnest(shop_ids) as sid
    where not public.is_shop_owner(sid)
  ) then
    raise exception 'You can only post on cafes you manage.';
  end if;

  if exists (
    select 1
    from unnest(shop_ids) as sid
    left join public.shops s on s.id = sid
    where s.status is distinct from 'approved'::public.shop_status
  ) then
    raise exception 'Only approved cafes can hang a poster.';
  end if;

  if exists (
    select 1
    from unnest(shop_ids) as sid
    where not public.shop_has_feature(sid, 'ad_poster')
  ) then
    raise exception 'Ad Poster is not enabled for this cafe.';
  end if;

  update public.shop_posters
  set ended_at = now()
  where shop_id = any (shop_ids)
    and ended_at is null;

  return query
  insert into public.shop_posters (shop_id, poster_object_key, created_by)
  select sid, clean_key, auth.uid()
  from unnest(shop_ids) as sid
  returning *;
end;
$$;

revoke all on function public.save_shop_placement(uuid, text, timestamptz, timestamptz, boolean, jsonb) from public, anon;
revoke all on function public.shop_has_feature(uuid, text) from public, anon;

grant execute on function public.save_shop_placement(uuid, text, timestamptz, timestamptz, boolean, jsonb) to authenticated;
grant execute on function public.shop_has_feature(uuid, text) to authenticated;
grant execute on function public.publish_owner_poster(uuid[], text) to authenticated;
grant execute on function public.update_owner_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[], uuid[]) to authenticated;

notify pgrst, 'reload schema';
