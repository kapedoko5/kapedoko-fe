-- =========================================================
-- KapéDoko — Theme as a partnership extra
-- =========================================================
-- Run AFTER db/20261120_cafe_detail_theme.sql and
-- db/20261125_placement_features.sql. Safe to re-run.
--
-- Adds features.theme. Sponsored defaults on; partner off.
-- Owner stamp requires shop_has_feature(..., 'theme').
-- =========================================================

comment on column public.shop_placements.features is
  'Optional extras for this window: featured_photos, ad_poster, analytics, theme, home_carousel.';

update public.shop_placements
set features = features || jsonb_build_object(
  'theme', coalesce((features->>'theme')::boolean, kind = 'sponsored')
)
where features is null
   or features = '{}'::jsonb
   or not (features ? 'theme');

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
      'theme', true,
      'home_carousel', false
    );
  else
    feats := jsonb_build_object(
      'featured_photos', true,
      'ad_poster', false,
      'analytics', false,
      'theme', false,
      'home_carousel', false
    );
  end if;

  if p_features is not null and jsonb_typeof(p_features) = 'object' then
    feats := feats || jsonb_build_object(
      'featured_photos', coalesce((p_features->'featured_photos') = 'true'::jsonb, (feats->'featured_photos') = 'true'::jsonb),
      'ad_poster', coalesce((p_features->'ad_poster') = 'true'::jsonb, (feats->'ad_poster') = 'true'::jsonb),
      'analytics', coalesce((p_features->'analytics') = 'true'::jsonb, (feats->'analytics') = 'true'::jsonb),
      'theme', coalesce((p_features->'theme') = 'true'::jsonb, (feats->'theme') = 'true'::jsonb),
      'home_carousel', coalesce((p_features->'home_carousel') = 'true'::jsonb, coalesce(p_show_on_home, false))
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
      and public.shop_has_feature(sid, 'theme')
  ) into shop_ids;

  if cardinality(shop_ids) is null or cardinality(shop_ids) = 0 then
    raise exception 'Theme is off until a partnership turns it on for a cafe you manage.';
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
      and coalesce((p.features -> p_feature) = 'true'::jsonb, false)
  );
$$;

revoke all on function public.save_shop_placement(uuid, text, timestamptz, timestamptz, boolean, jsonb) from public, anon;
revoke all on function public.apply_owner_shop_theme(uuid[], text, text, text) from public, anon;
revoke all on function public.shop_has_feature(uuid, text) from public, anon;
grant execute on function public.save_shop_placement(uuid, text, timestamptz, timestamptz, boolean, jsonb) to authenticated;
grant execute on function public.apply_owner_shop_theme(uuid[], text, text, text) to authenticated;
grant execute on function public.shop_has_feature(uuid, text) to authenticated;

notify pgrst, 'reload schema';
