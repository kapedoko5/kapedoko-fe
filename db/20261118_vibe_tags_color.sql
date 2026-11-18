-- =========================================================
-- KapéDoko — Vibe tag stamp color
-- =========================================================
-- Run AFTER 20261118_vibe_tags.sql.
-- Safe to re-run.
--
-- Adds a hex color on the catalog so each stamp can set its
-- pill fill and border. Existing tags keep #D9793B.
-- =========================================================

alter table public.vibe_tag_names
  add column if not exists color text not null default '#D9793B';

alter table public.vibe_tag_names
  drop constraint if exists vibe_tag_names_color_hex;

alter table public.vibe_tag_names
  add constraint vibe_tag_names_color_hex check (color ~ '^#[0-9A-Fa-f]{6}$');

comment on table public.vibe_tag_names is
  'Admin catalog of cafe vibe stamps. Look is color + Lucide + label; owners pick up to five.';

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
