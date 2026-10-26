-- =========================================================
-- KapéDoko — Admin cafe deletion
-- =========================================================
-- Run AFTER 20261013_shop_status_hidden.sql (and amenity
-- files if those tables exist). Safe to re-run.
--
-- Admins may delete a cafe through delete_admin_shop.
-- Related rows cascade where FKs allow it. Append-only
-- amenity tables are removed only for this shop, then the
-- listing is deleted. Unused R2 object keys are returned
-- so the client can clean storage.
-- =========================================================

create or replace function public.forbid_amenity_row_mutate()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'DELETE'
     and current_setting('app.admin_shop_delete', true) = 'on'
     and public.is_admin() then
    return old;
  end if;
  raise exception '% are append-only', tg_table_name;
end;
$$;

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

comment on function public.delete_admin_shop(uuid) is
  'Admin-only cafe delete. Cascades listing rows, removes this shop''s amenity records, and returns unused storage keys.';

revoke all on function public.delete_admin_shop(uuid) from public, anon;
grant execute on function public.delete_admin_shop(uuid) to authenticated;

notify pgrst, 'reload schema';
