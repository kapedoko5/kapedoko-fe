-- =========================================================
-- KapéDoko — Cafe details button, text, and stock
-- =========================================================
-- Run AFTER 20260930_cafe_owners_catalog.sql (is_shop_owner)
-- and 20260929_admin_portal.sql (is_admin, admin_write_audit).
-- Safe to re-run.
--
-- Owners and admins stamp a palette onto one or many cafes.
-- Null hexes clear back to KapéDoko defaults.
-- =========================================================

alter table public.shops
  add column if not exists theme_button_hex text;

alter table public.shops
  add column if not exists theme_text_hex text;

alter table public.shops
  add column if not exists theme_background_hex text;

alter table public.shops
  drop constraint if exists shops_theme_button_hex;

alter table public.shops
  add constraint shops_theme_button_hex
  check (theme_button_hex is null or theme_button_hex ~ '^#[0-9A-Fa-f]{6}$');

alter table public.shops
  drop constraint if exists shops_theme_text_hex;

alter table public.shops
  add constraint shops_theme_text_hex
  check (theme_text_hex is null or theme_text_hex ~ '^#[0-9A-Fa-f]{6}$');

alter table public.shops
  drop constraint if exists shops_theme_background_hex;

alter table public.shops
  add constraint shops_theme_background_hex
  check (theme_background_hex is null or theme_background_hex ~ '^#[0-9A-Fa-f]{6}$');

comment on column public.shops.theme_button_hex is
  'Cafe-details primary CTA fill. Null uses KapéDoko --kd-accent.';
comment on column public.shops.theme_text_hex is
  'Cafe-details heading and body ink. Null uses KapéDoko --kd-ink.';
comment on column public.shops.theme_background_hex is
  'Cafe-details page stock. Null uses the default white / shelf gray.';

create or replace function public.cafe_theme_hex(p_value text)
returns text
language plpgsql
immutable
as $$
declare
  raw text := nullif(btrim(coalesce(p_value, '')), '');
begin
  if raw is null then
    return null;
  end if;
  if left(raw, 1) <> '#' then
    raw := '#' || raw;
  end if;
  if raw !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Use a hex color like #D9793B.';
  end if;
  return upper(raw);
end;
$$;

drop function if exists public.apply_admin_shop_theme(uuid[], text, text);
drop function if exists public.apply_admin_shop_theme(uuid[], text, text, text);
drop function if exists public.apply_owner_shop_theme(uuid[], text, text);
drop function if exists public.apply_owner_shop_theme(uuid[], text, text, text);

create or replace function public.apply_admin_shop_theme(
  p_shop_ids uuid[],
  p_button_hex text default null,
  p_text_hex text default null,
  p_background_hex text default null
)
returns setof public.shops
language plpgsql
security definer
set search_path = public
as $$
declare
  shop_ids uuid[];
  button_hex text;
  text_hex text;
  background_hex text;
  changed integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select array(
    select distinct sid
    from unnest(coalesce(p_shop_ids, '{}'::uuid[])) as sid
    where sid is not null
  ) into shop_ids;

  if cardinality(shop_ids) is null or cardinality(shop_ids) = 0 then
    raise exception 'Tick at least one cafe.';
  end if;
  if cardinality(shop_ids) > 2000 then
    raise exception 'Stamp at most 2000 cafes at a time.';
  end if;

  button_hex := public.cafe_theme_hex(p_button_hex);
  text_hex := public.cafe_theme_hex(p_text_hex);
  background_hex := public.cafe_theme_hex(p_background_hex);

  perform set_config('app.admin_shop_write', 'on', true);

  return query
    update public.shops
    set theme_button_hex = button_hex,
        theme_text_hex = text_hex,
        theme_background_hex = background_hex
    where id = any (shop_ids)
    returning *;

  get diagnostics changed = row_count;
  if changed = 0 then
    raise exception 'Cafe was not found';
  end if;

  perform public.admin_write_audit(
    'shop.theme',
    'shop',
    null,
    jsonb_build_object(
      'count', changed,
      'theme_button_hex', button_hex,
      'theme_text_hex', text_hex,
      'theme_background_hex', background_hex
    )
  );
end;
$$;

create or replace function public.apply_owner_shop_theme(
  p_shop_ids uuid[],
  p_button_hex text default null,
  p_text_hex text default null,
  p_background_hex text default null
)
returns setof public.shops
language plpgsql
security definer
set search_path = public
as $$
declare
  shop_ids uuid[];
  button_hex text;
  text_hex text;
  background_hex text;
  changed integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sign in to stamp a look.';
  end if;

  select array(
    select distinct sid
    from unnest(coalesce(p_shop_ids, '{}'::uuid[])) as sid
    where sid is not null
      and public.is_shop_owner(sid)
  ) into shop_ids;

  if cardinality(shop_ids) is null or cardinality(shop_ids) = 0 then
    raise exception 'Choose at least one cafe you manage.';
  end if;
  if cardinality(shop_ids) > 2000 then
    raise exception 'Stamp at most 2000 cafes at a time.';
  end if;

  button_hex := public.cafe_theme_hex(p_button_hex);
  text_hex := public.cafe_theme_hex(p_text_hex);
  background_hex := public.cafe_theme_hex(p_background_hex);

  return query
    update public.shops
    set theme_button_hex = button_hex,
        theme_text_hex = text_hex,
        theme_background_hex = background_hex
    where id = any (shop_ids)
    returning *;

  get diagnostics changed = row_count;
  if changed = 0 then
    raise exception 'Cafe was not found';
  end if;
end;
$$;

revoke all on function public.cafe_theme_hex(text) from public, anon;
revoke all on function public.apply_admin_shop_theme(uuid[], text, text, text) from public, anon;
revoke all on function public.apply_owner_shop_theme(uuid[], text, text, text) from public, anon;
grant execute on function public.cafe_theme_hex(text) to authenticated;
grant execute on function public.apply_admin_shop_theme(uuid[], text, text, text) to authenticated;
grant execute on function public.apply_owner_shop_theme(uuid[], text, text, text) to authenticated;

notify pgrst, 'reload schema';
