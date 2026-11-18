-- =========================================================
-- KapéDoko — Vibe tag catalog and cafe stamps
-- =========================================================
-- Run AFTER 20261117_admin_cafe_media.sql.
-- Safe to re-run.
--
-- Admins name vibe tags (label + Lucide icon + stamp color).
-- Verified owners and admins stamp up to five on a cafe. Public
-- cards and cafe detail read live stamps via active_shop_vibe_tags
-- and shop_card_sidecars. Tags are display-only — not a filter.
-- =========================================================

create or replace function public.vibe_tag_slug_from_label(p_label text)
returns text
language plpgsql
immutable
as $$
declare
  slug text;
begin
  slug := lower(btrim(coalesce(p_label, '')));
  slug := regexp_replace(slug, '[^a-z0-9]+', '-', 'g');
  slug := regexp_replace(slug, '(^-+|-+$)', '', 'g');
  if char_length(slug) < 2 then
    raise exception 'Use a vibe tag with letters or numbers.';
  end if;
  return substring(slug from 1 for 40);
end;
$$;

create table if not exists public.vibe_tag_names (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  slug text not null,
  lucide_icon text not null default 'coffee',
  color text not null default '#D9793B',
  enabled boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vibe_tag_names_label_len check (char_length(btrim(label)) between 2 and 40),
  constraint vibe_tag_names_slug_len check (char_length(slug) between 2 and 40),
  constraint vibe_tag_names_color_hex check (color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint vibe_tag_names_lucide_icon check (
    lucide_icon in (
      'coffee',
      'leaf',
      'heart',
      'flame',
      'sparkles',
      'sun',
      'moon',
      'music',
      'headphones',
      'book-open',
      'users',
      'volume-x',
      'volume-2',
      'lamp',
      'camera',
      'wind',
      'cat',
      'sofa',
      'palmtree',
      'landmark'
    )
  )
);

comment on table public.vibe_tag_names is
  'Admin catalog of cafe vibe stamps. Look is color + Lucide + label; owners pick up to five.';

create unique index if not exists vibe_tag_names_slug_uidx on public.vibe_tag_names (slug);
create unique index if not exists vibe_tag_names_label_uidx on public.vibe_tag_names (lower(label));

create table if not exists public.shop_vibe_tags (
  shop_id uuid not null references public.shops(id) on delete cascade,
  tag_id uuid not null references public.vibe_tag_names(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (shop_id, tag_id)
);

comment on table public.shop_vibe_tags is
  'Vibe stamps on a cafe. At most five rows per shop, including disabled tags.';

create index if not exists shop_vibe_tags_tag_idx on public.shop_vibe_tags (tag_id);

create or replace function public.vibe_tag_names_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  if TG_OP = 'DELETE' then
    if exists (select 1 from public.shop_vibe_tags where tag_id = old.id) then
      raise exception 'Unassign this tag from every cafe before deleting it.';
    end if;
    return old;
  end if;

  new.label := btrim(regexp_replace(coalesce(new.label, ''), '\s+', ' ', 'g'));
  new.lucide_icon := lower(btrim(coalesce(new.lucide_icon, 'coffee')));
  new.color := upper(btrim(coalesce(nullif(new.color, ''), '#D9793B')));
  if new.color !~ '^#[0-9A-Fa-f]{6}$' then
    new.color := '#D9793B';
  end if;

  if TG_OP = 'INSERT' then
    new.slug := public.vibe_tag_slug_from_label(new.label);
    new.created_by := coalesce(new.created_by, auth.uid());
    new.created_at := coalesce(new.created_at, now());
  else
    new.slug := old.slug;
  end if;

  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists vibe_tag_names_before_write on public.vibe_tag_names;
create trigger vibe_tag_names_before_write
  before insert or update or delete on public.vibe_tag_names
  for each row execute procedure public.vibe_tag_names_before_write();

create or replace function public.vibe_tag_names_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    perform public.admin_write_audit(
      'vibe_tag.delete',
      'vibe_tag',
      old.id::text,
      jsonb_build_object('label', old.label, 'slug', old.slug)
    );
    return old;
  end if;
  perform public.admin_write_audit(
    case when TG_OP = 'INSERT' then 'vibe_tag.create' else 'vibe_tag.update' end,
    'vibe_tag',
    new.id::text,
    jsonb_build_object('label', new.label, 'enabled', new.enabled, 'color', new.color)
  );
  return new;
end;
$$;

drop trigger if exists vibe_tag_names_after_write on public.vibe_tag_names;
create trigger vibe_tag_names_after_write
  after insert or update or delete on public.vibe_tag_names
  for each row execute procedure public.vibe_tag_names_after_write();

create or replace function public.shop_vibe_tags_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  select count(*) into n
  from public.shop_vibe_tags
  where shop_id = new.shop_id;

  if n >= 5 then
    raise exception 'Keep vibe tags to 5.';
  end if;
  return new;
end;
$$;

drop trigger if exists shop_vibe_tags_before_write on public.shop_vibe_tags;
create trigger shop_vibe_tags_before_write
  before insert on public.shop_vibe_tags
  for each row execute procedure public.shop_vibe_tags_before_write();

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
  where n.enabled;

  if cardinality(keep_disabled) + cardinality(next_enabled) > 5 then
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

create or replace view public.active_shop_vibe_tags
with (security_invoker = true) as
select
  t.shop_id,
  n.id as tag_id,
  n.slug,
  n.label,
  n.lucide_icon,
  n.color
from public.shop_vibe_tags t
join public.vibe_tag_names n on n.id = t.tag_id
join public.shops s on s.id = t.shop_id
where n.enabled
  and s.status = 'approved';

comment on view public.active_shop_vibe_tags is
  'Live cafe vibe stamps for cards and cafe detail. Disabled tags and unapproved shops are omitted.';

create or replace function public.shop_card_sidecars(p_shop_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'amenities', coalesce((
      select jsonb_agg(to_jsonb(a))
      from public.shop_amenity_resolutions_public a
      where a.shop_id = any(p_shop_ids)
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(to_jsonb(p))
      from public.shop_payment_public p
      where p.shop_id = any(p_shop_ids)
    ), '[]'::jsonb),
    'stats', coalesce((
      select jsonb_agg(to_jsonb(s))
      from public.shop_review_stats s
      where s.shop_id = any(p_shop_ids)
    ), '[]'::jsonb),
    'tiers', coalesce((
      select jsonb_agg(to_jsonb(t))
      from public.shop_marker_tiers t
      where t.shop_id = any(p_shop_ids)
    ), '[]'::jsonb),
    'badges', coalesce((
      select jsonb_agg(to_jsonb(b))
      from public.active_shop_badges b
      where b.shop_id = any(p_shop_ids)
    ), '[]'::jsonb),
    'vibes', coalesce((
      select jsonb_agg(to_jsonb(v))
      from public.active_shop_vibe_tags v
      where v.shop_id = any(p_shop_ids)
    ), '[]'::jsonb)
  );
$$;

comment on function public.shop_card_sidecars(uuid[]) is
  'Card amenity, payment, stats, pin tier, live badges, and vibe stamps for a shop id list. POST body, not a GET in() filter.';

drop function if exists public.update_owner_shop(uuid, text, text, double precision, double precision, jsonb, text, text);
drop function if exists public.update_owner_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[]);
drop function if exists public.update_owner_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[], uuid[]);

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

  if p_vibe_tag_ids is not null then
    perform public.replace_shop_vibe_tags(p_shop_id, p_vibe_tag_ids);
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

drop function if exists public.update_admin_shop(uuid, text, text, double precision, double precision, jsonb, text, text);
drop function if exists public.update_admin_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[]);
drop function if exists public.update_admin_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[], uuid[]);

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

  if p_vibe_tag_ids is not null then
    perform public.replace_shop_vibe_tags(p_shop_id, p_vibe_tag_ids);
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

alter table public.vibe_tag_names enable row level security;
alter table public.shop_vibe_tags enable row level security;

drop policy if exists vibe_tag_names_public_read on public.vibe_tag_names;
create policy vibe_tag_names_public_read
  on public.vibe_tag_names
  for select
  to anon, authenticated
  using (enabled);

drop policy if exists vibe_tag_names_admin_read on public.vibe_tag_names;
create policy vibe_tag_names_admin_read
  on public.vibe_tag_names
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists vibe_tag_names_admin_write on public.vibe_tag_names;
create policy vibe_tag_names_admin_write
  on public.vibe_tag_names
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists shop_vibe_tags_public_read on public.shop_vibe_tags;
create policy shop_vibe_tags_public_read
  on public.shop_vibe_tags
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.vibe_tag_names n
      join public.shops s on s.id = shop_id
      where n.id = tag_id
        and n.enabled
        and s.status = 'approved'
    )
  );

drop policy if exists shop_vibe_tags_owner_read on public.shop_vibe_tags;
create policy shop_vibe_tags_owner_read
  on public.shop_vibe_tags
  for select
  to authenticated
  using (public.is_shop_owner(shop_id) or public.is_admin());

revoke all on function public.shop_card_sidecars(uuid[]) from public;
grant execute on function public.shop_card_sidecars(uuid[]) to anon, authenticated;

grant select on public.active_shop_vibe_tags to anon, authenticated;
grant select on public.vibe_tag_names to anon, authenticated;
grant select on public.shop_vibe_tags to anon, authenticated;
grant insert, update, delete on public.vibe_tag_names to authenticated;

revoke all on function public.vibe_tag_slug_from_label(text) from public, anon;
revoke all on function public.replace_shop_vibe_tags(uuid, uuid[]) from public, anon;
revoke all on function public.update_owner_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[], uuid[]) from public, anon;
revoke all on function public.update_admin_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[], uuid[]) from public, anon;

grant execute on function public.update_owner_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[], uuid[]) to authenticated;
grant execute on function public.update_admin_shop(uuid, text, text, double precision, double precision, jsonb, text, text, text[], uuid[]) to authenticated;

notify pgrst, 'reload schema';
