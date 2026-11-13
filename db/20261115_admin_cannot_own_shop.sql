-- =========================================================
-- KapéDoko — Admins assign owners; they cannot take a cafe
-- =========================================================
-- Apply after 20261113_shop_verified_owner.sql.
-- Blocks submit_shop_claim for admins, and blocks transferring
-- a verified claim onto the signed-in admin account.
-- =========================================================

create or replace function public.submit_shop_claim(
  p_shop_id uuid,
  p_evidence_note text,
  p_contact_email text default null,
  p_contact_phone text default null
)
returns public.shop_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  shop_status text;
  note text := btrim(regexp_replace(coalesce(p_evidence_note, ''), '\s+', ' ', 'g'));
  email text := nullif(lower(btrim(coalesce(p_contact_email, ''))), '');
  phone text := nullif(btrim(coalesce(p_contact_phone, '')), '');
  created public.shop_claims;
begin
  if uid is null then
    raise exception 'Sign in to claim this cafe.';
  end if;
  if public.is_admin() then
    raise exception 'Admins cannot claim a cafe. Assign an owner instead.';
  end if;
  if char_length(note) < 20 or char_length(note) > 500 then
    raise exception 'Tell us how you are connected to this cafe in 20 to 500 characters.';
  end if;
  if email is null and phone is null then
    raise exception 'Add a phone number or email we can reach you on.';
  end if;

  select status into shop_status from public.shops where id = p_shop_id;
  if shop_status is null then
    raise exception 'Cafe was not found';
  end if;
  if shop_status <> 'approved' then
    raise exception 'Only listed cafes can be claimed.';
  end if;

  if exists (
    select 1 from public.shop_claims
    where shop_id = p_shop_id
      and claimant_id = uid
      and status = 'verified'
  ) then
    raise exception 'You already manage this cafe.';
  end if;

  if exists (
    select 1 from public.shop_claims
    where shop_id = p_shop_id
      and status = 'verified'
      and claimant_id is distinct from uid
  ) then
    raise exception 'This cafe already has an owner.';
  end if;

  if exists (
    select 1 from public.shop_claims
    where shop_id = p_shop_id
      and claimant_id = uid
      and status = 'pending'
  ) then
    raise exception 'Your claim is already waiting for review.';
  end if;

  insert into public.shop_claims (
    shop_id,
    claimant_id,
    status,
    evidence_note,
    contact_email,
    contact_phone
  )
  values (p_shop_id, uid, 'pending', note, email, phone)
  returning * into created;

  perform public.admin_write_audit(
    'claim.submit',
    'shop_claim',
    created.id::text,
    jsonb_build_object('shop_id', p_shop_id)
  );

  return created;
end;
$$;

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

comment on function public.submit_shop_claim(uuid, text, text, text) is
  'Signed-in non-admins may request ownership of an approved cafe.';

comment on function public.admin_transfer_shop_ownership(uuid, uuid) is
  'Admin only. Moves the verified claim for a cafe to another account, never the admin.';

notify pgrst, 'reload schema';
