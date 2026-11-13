-- =========================================================
-- KapéDoko — Badge names and cafe awards
-- =========================================================
-- Run this in the Supabase SQL editor AFTER 20261113_shop_verified_owner.sql.
-- Catalog of named badges (Hidden Gem, Top 10 of the Month) with
-- color + Lucide icon + optional custom image. Admins award a name
-- to many approved cafes for one shared window. Public reads live
-- chips via active_shop_badges and shop_card_sidecars.
-- Safe to re-run.
-- =========================================================

create or replace function public.badge_slug_from_label(p_label text)
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
    raise exception 'Use a badge name with letters or numbers.';
  end if;
  return substring(slug from 1 for 40);
end;
$$;

create table if not exists public.badge_names (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  slug text not null,
  color text not null default '#1F6F6B',
  lucide_icon text not null default 'gem',
  icon_object_key text,
  enabled boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint badge_names_label_len check (char_length(btrim(label)) between 2 and 40),
  constraint badge_names_slug_len check (char_length(slug) between 2 and 40),
  constraint badge_names_color_hex check (color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint badge_names_lucide_icon check (
    lucide_icon in (
      'gem',
      'award',
      'trophy',
      'star',
      'crown',
      'sparkles',
      'heart',
      'flame',
      'coffee',
      'leaf',
      'map-pin',
      'medal',
      'badge-check',
      'gift'
    )
  ),
  constraint badge_names_icon_key check (
    icon_object_key is null or icon_object_key ~ '^[a-zA-Z0-9][a-zA-Z0-9/_.:-]*$'
  )
);

comment on table public.badge_names is
  'Admin catalog of cafe badges. Look (color, Lucide, optional image) lives on the name.';

create unique index if not exists badge_names_slug_uidx on public.badge_names (slug);
create unique index if not exists badge_names_label_uidx on public.badge_names (lower(label));

create table if not exists public.badge_awards (
  id uuid primary key default gen_random_uuid(),
  badge_id uuid not null references public.badge_names(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  enabled boolean not null default true,
  cancelled_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint badge_awards_window check (ends_at > starts_at)
);

comment on table public.badge_awards is
  'Shared-window award of a badge name to a set of cafes.';

create index if not exists badge_awards_badge_window_idx
  on public.badge_awards (badge_id, starts_at, ends_at)
  where cancelled_at is null;

create table if not exists public.badge_award_shops (
  award_id uuid not null references public.badge_awards(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  primary key (award_id, shop_id)
);

comment on table public.badge_award_shops is
  'Cafes included in a badge award. One shared window on badge_awards.';

create index if not exists badge_award_shops_shop_idx on public.badge_award_shops (shop_id);

create or replace function public.badge_names_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  new.label := btrim(regexp_replace(coalesce(new.label, ''), '\s+', ' ', 'g'));
  new.color := upper(btrim(coalesce(new.color, '')));
  new.lucide_icon := lower(btrim(coalesce(new.lucide_icon, 'gem')));
  new.icon_object_key := nullif(btrim(coalesce(new.icon_object_key, '')), '');

  if TG_OP = 'INSERT' then
    new.slug := public.badge_slug_from_label(new.label);
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

drop trigger if exists badge_names_before_write on public.badge_names;
create trigger badge_names_before_write
  before insert or update on public.badge_names
  for each row execute procedure public.badge_names_before_write();

create or replace function public.badge_names_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    perform public.admin_write_audit(
      'badge_name.delete',
      'badge_name',
      old.id::text,
      jsonb_build_object('label', old.label, 'slug', old.slug)
    );
    return old;
  end if;
  perform public.admin_write_audit(
    case when TG_OP = 'INSERT' then 'badge_name.create' else 'badge_name.update' end,
    'badge_name',
    new.id::text,
    jsonb_build_object('label', new.label, 'enabled', new.enabled)
  );
  return new;
end;
$$;

drop trigger if exists badge_names_after_write on public.badge_names;
create trigger badge_names_after_write
  after insert or update or delete on public.badge_names
  for each row execute procedure public.badge_names_after_write();

create or replace function public.badge_awards_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  if not exists (select 1 from public.badge_names where id = new.badge_id) then
    raise exception 'Badge name was not found';
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

drop trigger if exists badge_awards_before_write on public.badge_awards;
create trigger badge_awards_before_write
  before insert or update on public.badge_awards
  for each row execute procedure public.badge_awards_before_write();

create or replace function public.badge_awards_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    perform public.admin_write_audit(
      'badge_award.delete',
      'badge_award',
      old.id::text,
      jsonb_build_object('badge_id', old.badge_id)
    );
    return old;
  end if;
  perform public.admin_write_audit(
    case when TG_OP = 'INSERT' then 'badge_award.create' else 'badge_award.update' end,
    'badge_award',
    new.id::text,
    jsonb_build_object('badge_id', new.badge_id, 'enabled', new.enabled)
  );
  return new;
end;
$$;

drop trigger if exists badge_awards_after_write on public.badge_awards;
create trigger badge_awards_after_write
  after insert or update or delete on public.badge_awards
  for each row execute procedure public.badge_awards_after_write();

create or replace function public.badge_award_shops_drop_on_unapprove()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'approved' and new.status is distinct from 'approved' then
    delete from public.badge_award_shops s
    using public.badge_awards a
    where s.award_id = a.id
      and s.shop_id = new.id
      and a.enabled
      and a.cancelled_at is null
      and a.starts_at <= now()
      and a.ends_at > now();
  end if;
  return new;
end;
$$;

drop trigger if exists badge_award_shops_drop_on_unapprove on public.shops;
create trigger badge_award_shops_drop_on_unapprove
  after update of status on public.shops
  for each row execute procedure public.badge_award_shops_drop_on_unapprove();

create or replace function public.save_badge_award(
  p_id uuid,
  p_badge_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_shop_ids uuid[]
)
returns public.badge_awards
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.badge_awards;
  shop_ids uuid[];
  overlap_name text;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'Choose an end date after the start date.';
  end if;

  select array_agg(distinct id)
    into shop_ids
  from unnest(coalesce(p_shop_ids, '{}'::uuid[])) as id;

  if shop_ids is null or cardinality(shop_ids) = 0 then
    raise exception 'Choose at least one cafe.';
  end if;

  if exists (
    select 1
    from unnest(shop_ids) as sid
    left join public.shops s on s.id = sid
    where s.id is null or s.status <> 'approved'
  ) then
    raise exception 'Only approved cafes can receive badges.';
  end if;

  select s.name
    into overlap_name
  from public.badge_awards a
  join public.badge_award_shops x on x.award_id = a.id
  join public.shops s on s.id = x.shop_id
  where a.badge_id = p_badge_id
    and a.cancelled_at is null
    and (p_id is null or a.id <> p_id)
    and x.shop_id = any(shop_ids)
    and a.starts_at < p_ends_at
    and a.ends_at > p_starts_at
  limit 1;

  if overlap_name is not null then
    raise exception 'This badge already covers % in that window.', overlap_name;
  end if;

  if p_id is null then
    insert into public.badge_awards (badge_id, starts_at, ends_at, created_by)
    values (p_badge_id, p_starts_at, p_ends_at, auth.uid())
    returning * into saved;
  else
    update public.badge_awards
    set
      badge_id = p_badge_id,
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      enabled = true,
      cancelled_at = null
    where id = p_id
    returning * into saved;
    if saved.id is null then
      raise exception 'Award was not found';
    end if;
  end if;

  delete from public.badge_award_shops
  where award_id = saved.id
    and shop_id <> all(shop_ids);

  insert into public.badge_award_shops (award_id, shop_id)
  select saved.id, sid
  from unnest(shop_ids) as sid
  on conflict do nothing;

  return saved;
end;
$$;

create or replace function public.end_badge_award(p_id uuid)
returns public.badge_awards
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.badge_awards;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  update public.badge_awards
  set
    cancelled_at = coalesce(cancelled_at, now()),
    enabled = false,
    ends_at = least(ends_at, now())
  where id = p_id
  returning * into saved;

  if saved.id is null then
    raise exception 'Award was not found';
  end if;

  return saved;
end;
$$;

alter table public.badge_names enable row level security;
alter table public.badge_awards enable row level security;
alter table public.badge_award_shops enable row level security;

drop policy if exists badge_names_public_read on public.badge_names;
create policy badge_names_public_read
  on public.badge_names
  for select
  to anon, authenticated
  using (enabled);

drop policy if exists badge_names_admin_read on public.badge_names;
create policy badge_names_admin_read
  on public.badge_names
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists badge_names_admin_write on public.badge_names;
create policy badge_names_admin_write
  on public.badge_names
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists badge_awards_public_read on public.badge_awards;
create policy badge_awards_public_read
  on public.badge_awards
  for select
  to anon, authenticated
  using (
    enabled
    and cancelled_at is null
    and starts_at <= now()
    and ends_at > now()
  );

drop policy if exists badge_awards_admin_read on public.badge_awards;
create policy badge_awards_admin_read
  on public.badge_awards
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists badge_awards_admin_write on public.badge_awards;
create policy badge_awards_admin_write
  on public.badge_awards
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists badge_award_shops_public_read on public.badge_award_shops;
create policy badge_award_shops_public_read
  on public.badge_award_shops
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.badge_awards a
      join public.badge_names n on n.id = a.badge_id
      join public.shops s on s.id = shop_id
      where a.id = award_id
        and n.enabled
        and a.enabled
        and a.cancelled_at is null
        and a.starts_at <= now()
        and a.ends_at > now()
        and s.status = 'approved'
    )
  );

drop policy if exists badge_award_shops_admin_read on public.badge_award_shops;
create policy badge_award_shops_admin_read
  on public.badge_award_shops
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists badge_award_shops_admin_write on public.badge_award_shops;
create policy badge_award_shops_admin_write
  on public.badge_award_shops
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace view public.active_shop_badges
with (security_invoker = true) as
select
  s.shop_id,
  n.id as badge_id,
  n.slug,
  n.label,
  n.color,
  n.lucide_icon,
  n.icon_object_key,
  a.starts_at,
  a.ends_at
from public.badge_award_shops s
join public.badge_awards a on a.id = s.award_id
join public.badge_names n on n.id = a.badge_id
join public.shops sh on sh.id = s.shop_id
where n.enabled
  and a.enabled
  and a.cancelled_at is null
  and a.starts_at <= now()
  and a.ends_at > now()
  and sh.status = 'approved';

comment on view public.active_shop_badges is
  'Live cafe badges for cards and cafe detail. Expired, cancelled, or disabled rows are omitted.';

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
    ), '[]'::jsonb)
  );
$$;

comment on function public.shop_card_sidecars(uuid[]) is
  'Card amenity, payment, stats, pin tier, and live badges for a shop id list. POST body, not a GET in() filter.';

revoke all on function public.shop_card_sidecars(uuid[]) from public;
grant execute on function public.shop_card_sidecars(uuid[]) to anon, authenticated;

grant select on public.active_shop_badges to anon, authenticated;
grant select on public.badge_names to anon, authenticated;
grant select on public.badge_awards to anon, authenticated;
grant select on public.badge_award_shops to anon, authenticated;
grant insert, update, delete on public.badge_names to authenticated;
grant insert, update, delete on public.badge_awards to authenticated;
grant insert, update, delete on public.badge_award_shops to authenticated;

revoke all on function public.save_badge_award(uuid, uuid, timestamptz, timestamptz, uuid[]) from public, anon;
revoke all on function public.end_badge_award(uuid) from public, anon;
grant execute on function public.save_badge_award(uuid, uuid, timestamptz, timestamptz, uuid[]) to authenticated;
grant execute on function public.end_badge_award(uuid) to authenticated;

notify pgrst, 'reload schema';
