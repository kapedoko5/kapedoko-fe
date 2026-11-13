-- =========================================================
-- KapéDoko — Public flag: this cafe already has a verified owner
-- =========================================================
-- Guests and signed-in users may know a listing is claimed without
-- seeing who owns it. New claims are blocked once someone is verified.
-- =========================================================

create or replace function public.shop_has_verified_owner(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_claims
    where shop_id = p_shop_id
      and status = 'verified'
  );
$$;

revoke all on function public.shop_has_verified_owner(uuid) from public;
grant execute on function public.shop_has_verified_owner(uuid) to anon, authenticated;

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
