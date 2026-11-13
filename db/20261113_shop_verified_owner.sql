-- =========================================================
-- KapéDoko — Public claimed-owner identity and admin transfer
-- =========================================================
-- Guests may see who manages a listed cafe (name only). Admins may
-- move a verified claim to another account from the cafe page.
-- Apply this in the SQL editor after 20261109_shop_has_verified_owner.sql.
-- =========================================================

-- One verified owner per cafe. Skip when a shop already has two.
do $$
begin
  if exists (
    select 1
    from public.shop_claims
    where status = 'verified'
    group by shop_id
    having count(*) > 1
  ) then
    return;
  end if;
  execute $idx$
    create unique index if not exists shop_claims_one_verified_uidx
      on public.shop_claims (shop_id)
      where status = 'verified'
  $idx$;
end
$$;

create or replace function public.shop_verified_owner(p_shop_id uuid)
returns table (
  claimant_id uuid,
  display_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.claimant_id,
    nullif(btrim(coalesce(p.display_name, '')), '')
  from public.shop_claims c
  left join public.profiles p on p.id = c.claimant_id
  where c.shop_id = p_shop_id
    and c.status = 'verified'
  order by c.reviewed_at desc nulls last, c.created_at desc
  limit 1;
$$;

comment on function public.shop_verified_owner(uuid) is
  'Public: the verified owner of a cafe, or no row when it is unclaimed. Name only.';

create or replace function public.admin_transfer_shop_ownership(
  p_shop_id uuid,
  p_user_id uuid
)
returns public.shop_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_ids uuid[] := '{}';
  previous_id uuid;
  shop_found boolean;
  target_email text;
  existing public.shop_claims;
  updated public.shop_claims;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;
  if p_user_id is null then
    raise exception 'Pick the person who should manage this cafe.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Admins cannot assign a cafe to themselves.';
  end if;

  select exists (select 1 from public.shops where id = p_shop_id) into shop_found;
  if not shop_found then
    raise exception 'Cafe was not found';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'User was not found';
  end if;

  if exists (
    select 1 from public.shop_claims
    where shop_id = p_shop_id
      and claimant_id = p_user_id
      and status = 'verified'
  ) then
    raise exception 'They already manage this cafe.';
  end if;

  select coalesce(array_agg(claimant_id), '{}')
  into previous_ids
  from public.shop_claims
  where shop_id = p_shop_id
    and status = 'verified'
    and claimant_id is distinct from p_user_id;

  update public.shop_claims
  set
    status = 'rejected',
    rejection_reason = 'Ownership transferred to another account.',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  where shop_id = p_shop_id
    and status = 'verified'
    and claimant_id is distinct from p_user_id;

  select *
  into existing
  from public.shop_claims
  where shop_id = p_shop_id
    and claimant_id = p_user_id
  order by
    case status
      when 'pending' then 0
      when 'rejected' then 1
      else 2
    end,
    created_at desc
  limit 1;

  if existing.id is not null then
    update public.shop_claims
    set
      status = 'verified',
      rejection_reason = null,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
    where id = existing.id
    returning * into updated;
  else
    select email into target_email from auth.users where id = p_user_id;
    target_email := nullif(lower(btrim(coalesce(target_email, ''))), '');
    if target_email is null then
      raise exception 'That account needs an email before it can own a cafe.';
    end if;

    insert into public.shop_claims (
      shop_id,
      claimant_id,
      status,
      evidence_note,
      contact_email,
      reviewed_by,
      reviewed_at
    )
    values (
      p_shop_id,
      p_user_id,
      'verified',
      'Ownership transferred by an admin.',
      target_email,
      auth.uid(),
      now()
    )
    returning * into updated;
  end if;

  if updated.id is null then
    raise exception 'Could not transfer this cafe.';
  end if;

  perform public.sync_cafe_owner_role(updated.claimant_id);
  foreach previous_id in array previous_ids
  loop
    perform public.sync_cafe_owner_role(previous_id);
  end loop;

  perform public.admin_write_audit(
    'claim.transfer',
    'shop_claim',
    updated.id::text,
    jsonb_build_object(
      'shop_id', updated.shop_id,
      'claimant_id', updated.claimant_id,
      'previous_claimant_ids', to_jsonb(previous_ids)
    )
  );

  return updated;
end;
$$;

comment on function public.admin_transfer_shop_ownership(uuid, uuid) is
  'Admin only. Moves the verified claim for a cafe to another account.';

revoke all on function public.shop_verified_owner(uuid) from public;
revoke all on function public.admin_transfer_shop_ownership(uuid, uuid) from public, anon;

grant execute on function public.shop_verified_owner(uuid) to anon, authenticated;
grant execute on function public.admin_transfer_shop_ownership(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
