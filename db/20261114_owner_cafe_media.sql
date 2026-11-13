-- =========================================================
-- KapéDoko — Owner in-cafe posters and featured photos
-- =========================================================
-- Run AFTER 20261113_shop_verified_owner.sql.
-- Safe to re-run.
--
-- Verified owners may hang one live poster per cafe and keep
-- up to eight featured photos on the listing. Posters show on
-- cafe detail only. Home banners stay admin-only.
-- =========================================================

alter table public.shops
  add column if not exists gallery_object_keys text[] not null default '{}'::text[];

alter table public.shops drop constraint if exists shops_gallery_len;
alter table public.shops
  add constraint shops_gallery_len check (cardinality(gallery_object_keys) <= 8);

comment on column public.shops.gallery_object_keys is
  'Featured cafe photos, at most eight. Shown on cafe detail.';

create table if not exists public.shop_posters (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  poster_object_key text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint shop_posters_key check (
    poster_object_key ~ '^[a-zA-Z0-9][a-zA-Z0-9/_.:-]*$'
  )
);

comment on table public.shop_posters is
  'In-cafe posters hung by verified owners. Public reads only live rows on approved cafes.';

create unique index if not exists shop_posters_one_live_idx
  on public.shop_posters (shop_id)
  where ended_at is null;

create index if not exists shop_posters_shop_live_idx
  on public.shop_posters (shop_id, created_at desc)
  where ended_at is null;

create or replace function public.shop_media_key_ok(p_key text)
returns boolean
language sql
immutable
as $$
  select p_key is not null
    and btrim(p_key) <> ''
    and p_key ~ '^[a-zA-Z0-9][a-zA-Z0-9/_.:-]*$';
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

create or replace function public.end_owner_poster(p_poster_id uuid)
returns public.shop_posters
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.shop_posters;
begin
  if auth.uid() is null then
    raise exception 'Sign in to take down a poster.';
  end if;

  update public.shop_posters
  set ended_at = coalesce(ended_at, now())
  where id = p_poster_id
    and ended_at is null
    and public.is_shop_owner(shop_id)
  returning * into updated;

  if updated.id is null then
    raise exception 'Poster was not found.';
  end if;
  return updated;
end;
$$;

create or replace function public.list_my_shop_posters()
returns table (
  id uuid,
  shop_id uuid,
  poster_object_key text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.shop_id,
    p.poster_object_key,
    p.created_at
  from public.shop_posters p
  where p.ended_at is null
    and public.is_shop_owner(p.shop_id)
  order by p.created_at desc;
$$;

drop function if exists public.update_owner_shop(uuid, text, text, double precision, double precision, jsonb, text, text);

create or replace function public.update_owner_shop(
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
    gallery_object_keys = clean_keys
  where id = p_shop_id
    and status = 'approved'::public.shop_status
  returning * into updated;

  if updated.id is null then
    raise exception 'Cafe was not found';
  end if;

  perform public.admin_write_audit(
    'shop.owner_update',
    'shop',
    updated.id::text,
    jsonb_build_object('name', updated.name)
  );
  return updated;
end;
$$;

create or replace view public.live_shop_posters
with (security_invoker = true) as
select
  p.id,
  p.shop_id,
  p.poster_object_key,
  p.created_at
from public.shop_posters p
join public.shops s on s.id = p.shop_id
where p.ended_at is null
  and s.status = 'approved'::public.shop_status;

alter table public.shop_posters enable row level security;
alter table public.shop_posters force row level security;

drop policy if exists shop_posters_public_read on public.shop_posters;
create policy shop_posters_public_read
  on public.shop_posters
  for select
  to anon, authenticated
  using (
    ended_at is null
    and exists (
      select 1 from public.shops s
      where s.id = shop_id and s.status = 'approved'::public.shop_status
    )
  );

drop policy if exists shop_posters_owner_read on public.shop_posters;
create policy shop_posters_owner_read
  on public.shop_posters
  for select
  to authenticated
  using (public.is_shop_owner(shop_id) or public.is_admin());

revoke all on public.shop_posters from public, anon, authenticated;
grant select on public.shop_posters to anon, authenticated;
grant select on public.live_shop_posters to anon, authenticated;

revoke all on function public.shop_media_key_ok(text) from public, anon;
revoke all on function public.publish_owner_poster(uuid[], text) from public, anon;
revoke all on function public.end_owner_poster(uuid) from public, anon;
revoke all on function public.list_my_shop_posters() from public, anon;
revoke all on function public.update_owner_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[]) from public, anon;

grant execute on function public.shop_media_key_ok(text) to authenticated;
grant execute on function public.publish_owner_poster(uuid[], text) to authenticated;
grant execute on function public.end_owner_poster(uuid) to authenticated;
grant execute on function public.list_my_shop_posters() to authenticated;
grant execute on function public.update_owner_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[]) to authenticated;

create or replace function public.delete_admin_shop(p_shop_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  doomed public.shops;
  keys text[] := '{}';
  extra text[];
  logo_key text;
  doomed_ids uuid[];
  remaining integer;
  guard integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;
  if p_shop_id is null then
    raise exception 'Cafe was not found';
  end if;

  select * into doomed from public.shops where id = p_shop_id;
  if doomed.id is null then
    raise exception 'Cafe was not found';
  end if;

  perform set_config('app.admin_shop_delete', 'on', true);
  perform set_config('app.admin_shop_write', 'on', true);

  logo_key := nullif(btrim(coalesce(doomed.logo_object_key, '')), '');
  if logo_key is not null
     and not exists (
       select 1
       from public.shops other
       where other.id <> p_shop_id
         and nullif(btrim(coalesce(other.logo_object_key, '')), '') = logo_key
     ) then
    keys := keys || logo_key;
  end if;

  extra := array(
    select distinct k
    from unnest(coalesce(doomed.gallery_object_keys, '{}'::text[])) as k
    where public.shop_media_key_ok(k)
      and not exists (
        select 1
        from public.shops other
        where other.id <> p_shop_id
          and k = any (coalesce(other.gallery_object_keys, '{}'::text[]))
      )
  );
  keys := keys || extra;

  if to_regclass('public.ad_campaigns') is not null then
    extra := array(
      select distinct c.banner_object_key
      from public.ad_campaigns c
      where c.shop_id = p_shop_id
        and c.banner_object_key is not null
        and not exists (
          select 1
          from public.ad_campaigns other
          where other.shop_id <> p_shop_id
            and other.banner_object_key = c.banner_object_key
        )
    );
    keys := keys || extra;
  end if;

  if to_regclass('public.shop_posters') is not null then
    extra := array(
      select distinct p.poster_object_key
      from public.shop_posters p
      where p.shop_id = p_shop_id
        and p.poster_object_key is not null
        and not exists (
          select 1
          from public.shop_posters other
          where other.shop_id <> p_shop_id
            and other.poster_object_key = p.poster_object_key
        )
    );
    keys := keys || extra;
  end if;

  if to_regclass('public.cafe_audit_photos') is not null
     and to_regclass('public.cafe_audits') is not null then
    extra := array(
      select distinct p.object_key
      from public.cafe_audit_photos p
      join public.cafe_audits a on a.id = p.audit_id
      where a.shop_id = p_shop_id
        and p.object_key is not null
    );
    keys := keys || extra;
  end if;

  if to_regclass('public.cafe_amenity_reports') is not null then
    if to_regclass('public.cafe_amenity_report_voids') is not null then
      delete from public.cafe_amenity_report_voids
      where report_id in (
        select r.id from public.cafe_amenity_reports r where r.shop_id = p_shop_id
      );
    end if;
    delete from public.cafe_amenity_reports where shop_id = p_shop_id;
  end if;

  if to_regclass('public.cafe_audits') is not null then
    loop
      guard := guard + 1;
      if guard > 80 then
        raise exception 'Could not remove visit records for this cafe.';
      end if;

      doomed_ids := array(
        select a.id
        from public.cafe_audits a
        where a.shop_id = p_shop_id
          and not exists (
            select 1
            from public.cafe_audits child
            where child.corrects_audit_id = a.id
          )
      );
      exit when cardinality(doomed_ids) = 0;

      if to_regclass('public.cafe_audit_amenity_results') is not null then
        delete from public.cafe_audit_amenity_results where audit_id = any (doomed_ids);
      end if;
      if to_regclass('public.cafe_audit_photos') is not null then
        delete from public.cafe_audit_photos where audit_id = any (doomed_ids);
      end if;
      if to_regclass('public.cafe_audit_voids') is not null then
        delete from public.cafe_audit_voids where audit_id = any (doomed_ids);
      end if;
      delete from public.cafe_audits where id = any (doomed_ids);
    end loop;
  end if;

  delete from public.shops where id = p_shop_id;
  get diagnostics remaining = row_count;
  if remaining = 0 then
    raise exception 'Cafe was not found';
  end if;

  select coalesce(array_agg(distinct k), '{}')
    into keys
  from unnest(keys) as k
  where k is not null and btrim(k) <> '';

  perform public.admin_write_audit(
    'shop.delete',
    'shop',
    doomed.id::text,
    jsonb_build_object(
      'name', doomed.name,
      'status', doomed.status::text,
      'object_keys', to_jsonb(keys)
    )
  );

  return jsonb_build_object(
    'id', doomed.id,
    'name', doomed.name,
    'object_keys', to_jsonb(coalesce(keys, '{}'::text[]))
  );
end;
$$;

notify pgrst, 'reload schema';
