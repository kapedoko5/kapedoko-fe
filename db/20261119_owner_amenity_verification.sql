-- =========================================================
-- KapéDoko — owner amenity proof (Verify your cafe)
-- =========================================================
-- Run AFTER 20261118_report_shop_owner.sql and amenity views
-- (20261004–20261007). Safe to re-run.
--
-- Cafe owners submit WiFi / seating / outlets / payment proof.
-- Admin or auditor approves. Approved facts become public as
-- owner_verified, and win over a team visit only when newer.
-- =========================================================

create table if not exists public.shop_amenity_verifications (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  owner_id uuid not null references public.profiles (id),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  include_wifi boolean not null default false,
  wifi_screenshot_object_key text,
  wifi_download_mbps numeric,
  include_seating boolean not null default false,
  seating_photo_object_key text,
  seating_capacity integer,
  include_outlets boolean not null default false,
  outlets_photo_object_key text,
  include_payment boolean not null default false,
  accepts_qr text,
  accepts_card text,
  accepts_cash text,
  rejection_reason text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shop_amenity_verifications
  drop constraint if exists shop_amenity_verifications_at_least_one;
alter table public.shop_amenity_verifications
  add constraint shop_amenity_verifications_at_least_one
  check (include_wifi or include_seating or include_outlets or include_payment);

alter table public.shop_amenity_verifications
  drop constraint if exists shop_amenity_verifications_wifi;
alter table public.shop_amenity_verifications
  add constraint shop_amenity_verifications_wifi
  check (
    (not include_wifi and wifi_screenshot_object_key is null and wifi_download_mbps is null)
    or (
      include_wifi
      and wifi_screenshot_object_key is not null
      and wifi_download_mbps is not null
      and wifi_download_mbps > 0
      and wifi_download_mbps <= 10000
    )
  );

alter table public.shop_amenity_verifications
  drop constraint if exists shop_amenity_verifications_seating;
alter table public.shop_amenity_verifications
  add constraint shop_amenity_verifications_seating
  check (
    (not include_seating and seating_photo_object_key is null and seating_capacity is null)
    or (
      include_seating
      and seating_photo_object_key is not null
      and seating_capacity is not null
      and seating_capacity >= 0
      and seating_capacity <= 10000
    )
  );

alter table public.shop_amenity_verifications
  drop constraint if exists shop_amenity_verifications_outlets;
alter table public.shop_amenity_verifications
  add constraint shop_amenity_verifications_outlets
  check (
    (not include_outlets and outlets_photo_object_key is null)
    or (include_outlets and outlets_photo_object_key is not null)
  );

alter table public.shop_amenity_verifications
  drop constraint if exists shop_amenity_verifications_payment;
alter table public.shop_amenity_verifications
  add constraint shop_amenity_verifications_payment
  check (
    (
      not include_payment
      and accepts_qr is null
      and accepts_card is null
      and accepts_cash is null
    )
    or (
      include_payment
      and accepts_qr in ('available', 'unavailable', 'unknown')
      and accepts_card in ('available', 'unavailable', 'unknown')
      and accepts_cash in ('available', 'unavailable', 'unknown')
    )
  );

alter table public.shop_amenity_verifications
  drop constraint if exists shop_amenity_verifications_review;
alter table public.shop_amenity_verifications
  add constraint shop_amenity_verifications_review
  check (
    (
      status = 'pending'
      and reviewed_by is null
      and reviewed_at is null
      and rejection_reason is null
    )
    or (
      status = 'approved'
      and reviewed_by is not null
      and reviewed_at is not null
      and rejection_reason is null
    )
    or (
      status = 'rejected'
      and reviewed_by is not null
      and reviewed_at is not null
      and rejection_reason is not null
      and char_length(rejection_reason) between 1 and 280
    )
  );

create unique index if not exists shop_amenity_verifications_pending_shop_uidx
  on public.shop_amenity_verifications (shop_id)
  where status = 'pending';

create index if not exists shop_amenity_verifications_shop_idx
  on public.shop_amenity_verifications (shop_id, created_at desc);

create index if not exists shop_amenity_verifications_owner_idx
  on public.shop_amenity_verifications (owner_id, created_at desc);

create index if not exists shop_amenity_verifications_status_idx
  on public.shop_amenity_verifications (status, created_at desc);

comment on table public.shop_amenity_verifications is
  'Owner amenity proof tickets. Staff approve or reject; public reads approved facts via views.';

alter table public.shop_amenity_verifications enable row level security;

drop policy if exists shop_amenity_verifications_select_own on public.shop_amenity_verifications;
create policy shop_amenity_verifications_select_own
  on public.shop_amenity_verifications
  for select
  to authenticated
  using (owner_id = auth.uid() or public.is_auditor());

revoke all on public.shop_amenity_verifications from anon, public;
grant select on public.shop_amenity_verifications to authenticated;

create or replace function public.amenity_proof_key_ok(p_key text, p_user_id uuid)
returns boolean
language sql
immutable
as $$
  select p_key is not null
    and p_user_id is not null
    and p_key = btrim(p_key)
    and p_key like ('amenity-proofs/' || p_user_id::text || '/%')
    and p_key !~ '[^A-Za-z0-9/._-]'
    and position('//' in p_key) = 0;
$$;

alter table public.shop_amenity_verifications
  drop constraint if exists shop_amenity_verifications_wifi_key;
alter table public.shop_amenity_verifications
  add constraint shop_amenity_verifications_wifi_key
  check (not include_wifi or public.amenity_proof_key_ok(wifi_screenshot_object_key, owner_id));

alter table public.shop_amenity_verifications
  drop constraint if exists shop_amenity_verifications_seating_key;
alter table public.shop_amenity_verifications
  add constraint shop_amenity_verifications_seating_key
  check (not include_seating or public.amenity_proof_key_ok(seating_photo_object_key, owner_id));

alter table public.shop_amenity_verifications
  drop constraint if exists shop_amenity_verifications_outlets_key;
alter table public.shop_amenity_verifications
  add constraint shop_amenity_verifications_outlets_key
  check (not include_outlets or public.amenity_proof_key_ok(outlets_photo_object_key, owner_id));

create or replace function public.submit_shop_amenity_verification(
  p_shop_id uuid,
  p_include_wifi boolean default false,
  p_wifi_screenshot_object_key text default null,
  p_wifi_download_mbps numeric default null,
  p_include_seating boolean default false,
  p_seating_photo_object_key text default null,
  p_seating_capacity integer default null,
  p_include_outlets boolean default false,
  p_outlets_photo_object_key text default null,
  p_include_payment boolean default false,
  p_accepts_qr text default null,
  p_accepts_card text default null,
  p_accepts_cash text default null
)
returns public.shop_amenity_verifications
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  wifi_key text := nullif(btrim(coalesce(p_wifi_screenshot_object_key, '')), '');
  seating_key text := nullif(btrim(coalesce(p_seating_photo_object_key, '')), '');
  outlets_key text := nullif(btrim(coalesce(p_outlets_photo_object_key, '')), '');
  qr text := nullif(btrim(coalesce(p_accepts_qr, '')), '');
  card text := nullif(btrim(coalesce(p_accepts_card, '')), '');
  cash text := nullif(btrim(coalesce(p_accepts_cash, '')), '');
  saved public.shop_amenity_verifications;
begin
  if uid is null then
    raise exception 'Sign in to verify this cafe.';
  end if;
  if not public.is_shop_owner(p_shop_id) then
    raise exception 'Only the verified owner can submit amenity proof.';
  end if;
  if not (p_include_wifi or p_include_seating or p_include_outlets or p_include_payment) then
    raise exception 'Choose at least one amenity to verify.';
  end if;

  if p_include_wifi then
    if wifi_key is null or not public.amenity_proof_key_ok(wifi_key, uid) then
      raise exception 'Upload a fast.com screenshot for WiFi speed.';
    end if;
    if p_wifi_download_mbps is null or p_wifi_download_mbps <= 0 then
      raise exception 'Enter the download Mbps shown on fast.com.';
    end if;
  else
    wifi_key := null;
    p_wifi_download_mbps := null;
  end if;

  if p_include_seating then
    if seating_key is null or not public.amenity_proof_key_ok(seating_key, uid) then
      raise exception 'Upload a photo of the cafe interior.';
    end if;
    if p_seating_capacity is null or p_seating_capacity < 0 then
      raise exception 'Enter how many seats the cafe has.';
    end if;
  else
    seating_key := null;
    p_seating_capacity := null;
  end if;

  if p_include_outlets then
    if outlets_key is null or not public.amenity_proof_key_ok(outlets_key, uid) then
      raise exception 'Upload a photo of the power outlets.';
    end if;
  else
    outlets_key := null;
  end if;

  if p_include_payment then
    if qr is null or card is null or cash is null
      or qr not in ('available', 'unavailable', 'unknown')
      or card not in ('available', 'unavailable', 'unknown')
      or cash not in ('available', 'unavailable', 'unknown')
    then
      raise exception 'Say whether you accept QR, card, and cash.';
    end if;
  else
    qr := null;
    card := null;
    cash := null;
  end if;

  update public.shop_amenity_verifications
  set
    owner_id = uid,
    include_wifi = p_include_wifi,
    wifi_screenshot_object_key = wifi_key,
    wifi_download_mbps = p_wifi_download_mbps,
    include_seating = p_include_seating,
    seating_photo_object_key = seating_key,
    seating_capacity = p_seating_capacity,
    include_outlets = p_include_outlets,
    outlets_photo_object_key = outlets_key,
    include_payment = p_include_payment,
    accepts_qr = qr,
    accepts_card = card,
    accepts_cash = cash,
    updated_at = now()
  where shop_id = p_shop_id
    and status = 'pending'
  returning * into saved;

  if not found then
    insert into public.shop_amenity_verifications (
      shop_id,
      owner_id,
      status,
      include_wifi,
      wifi_screenshot_object_key,
      wifi_download_mbps,
      include_seating,
      seating_photo_object_key,
      seating_capacity,
      include_outlets,
      outlets_photo_object_key,
      include_payment,
      accepts_qr,
      accepts_card,
      accepts_cash
    )
    values (
      p_shop_id,
      uid,
      'pending',
      p_include_wifi,
      wifi_key,
      p_wifi_download_mbps,
      p_include_seating,
      seating_key,
      p_seating_capacity,
      p_include_outlets,
      outlets_key,
      p_include_payment,
      qr,
      card,
      cash
    )
    returning * into saved;
  end if;

  perform public.admin_write_audit(
    'amenity_proof.submit',
    'shop_amenity_verification',
    saved.id::text,
    jsonb_build_object(
      'shop_id', p_shop_id,
      'include_wifi', p_include_wifi,
      'include_seating', p_include_seating,
      'include_outlets', p_include_outlets,
      'include_payment', p_include_payment
    )
  );

  return saved;
end;
$$;

create or replace function public.moderate_shop_amenity_verification(
  p_verification_id uuid,
  p_status text,
  p_rejection_reason text default null
)
returns public.shop_amenity_verifications
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.shop_amenity_verifications;
  reason text := nullif(btrim(coalesce(p_rejection_reason, '')), '');
begin
  if not public.is_auditor() then
    raise exception 'Staff only';
  end if;
  if p_status not in ('approved', 'rejected') then
    raise exception 'Unknown verification status';
  end if;
  if p_status = 'rejected' then
    if reason is null then
      raise exception 'Add a reason for rejecting this proof.';
    end if;
    if char_length(reason) > 280 then
      raise exception 'Keep the rejection reason to 280 characters.';
    end if;
  else
    reason := null;
  end if;

  update public.shop_amenity_verifications
  set
    status = p_status,
    rejection_reason = reason,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  where id = p_verification_id
    and status = 'pending'
  returning * into updated;

  if not found then
    raise exception 'Proof was not found or is no longer pending.';
  end if;

  perform public.admin_write_audit(
    'amenity_proof.' || p_status,
    'shop_amenity_verification',
    updated.id::text,
    jsonb_build_object(
      'shop_id', updated.shop_id,
      'owner_id', updated.owner_id,
      'rejection_reason', updated.rejection_reason
    )
  );

  return updated;
end;
$$;

create or replace function public.list_my_shop_amenity_verifications()
returns table (
  id uuid,
  shop_id uuid,
  shop_name text,
  owner_id uuid,
  status text,
  include_wifi boolean,
  wifi_screenshot_object_key text,
  wifi_download_mbps numeric,
  include_seating boolean,
  seating_photo_object_key text,
  seating_capacity integer,
  include_outlets boolean,
  outlets_photo_object_key text,
  include_payment boolean,
  accepts_qr text,
  accepts_card text,
  accepts_cash text,
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id,
    v.shop_id,
    coalesce(s.name, 'This cafe') as shop_name,
    v.owner_id,
    v.status,
    v.include_wifi,
    v.wifi_screenshot_object_key,
    v.wifi_download_mbps,
    v.include_seating,
    v.seating_photo_object_key,
    v.seating_capacity,
    v.include_outlets,
    v.outlets_photo_object_key,
    v.include_payment,
    v.accepts_qr,
    v.accepts_card,
    v.accepts_cash,
    v.rejection_reason,
    v.reviewed_by,
    v.reviewed_at,
    v.created_at,
    v.updated_at
  from public.shop_amenity_verifications v
  left join public.shops s on s.id = v.shop_id
  where v.owner_id = auth.uid()
  order by v.created_at desc;
$$;

create or replace function public.list_amenity_verifications()
returns table (
  id uuid,
  shop_id uuid,
  shop_name text,
  owner_id uuid,
  owner_name text,
  status text,
  include_wifi boolean,
  wifi_screenshot_object_key text,
  wifi_download_mbps numeric,
  include_seating boolean,
  seating_photo_object_key text,
  seating_capacity integer,
  include_outlets boolean,
  outlets_photo_object_key text,
  include_payment boolean,
  accepts_qr text,
  accepts_card text,
  accepts_cash text,
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_auditor() then
    raise exception 'Staff only';
  end if;
  return query
  select
    v.id,
    v.shop_id,
    coalesce(s.name, 'This cafe') as shop_name,
    v.owner_id,
    coalesce(nullif(btrim(p.display_name), ''), 'Cafe owner') as owner_name,
    v.status,
    v.include_wifi,
    v.wifi_screenshot_object_key,
    v.wifi_download_mbps,
    v.include_seating,
    v.seating_photo_object_key,
    v.seating_capacity,
    v.include_outlets,
    v.outlets_photo_object_key,
    v.include_payment,
    v.accepts_qr,
    v.accepts_card,
    v.accepts_cash,
    v.rejection_reason,
    v.reviewed_by,
    v.reviewed_at,
    v.created_at,
    v.updated_at
  from public.shop_amenity_verifications v
  left join public.shops s on s.id = v.shop_id
  left join public.profiles p on p.id = v.owner_id
  order by
    case v.status when 'pending' then 0 when 'approved' then 1 else 2 end,
    v.created_at desc;
end;
$$;

create or replace view public.current_approved_owner_wifi
with (security_invoker = false) as
select distinct on (v.shop_id)
  v.shop_id,
  v.id as verification_id,
  v.wifi_download_mbps,
  v.reviewed_at
from public.shop_amenity_verifications v
where v.status = 'approved'
  and v.include_wifi
order by v.shop_id, v.reviewed_at desc, v.created_at desc;

create or replace view public.current_approved_owner_outlets
with (security_invoker = false) as
select distinct on (v.shop_id)
  v.shop_id,
  v.id as verification_id,
  v.reviewed_at
from public.shop_amenity_verifications v
where v.status = 'approved'
  and v.include_outlets
order by v.shop_id, v.reviewed_at desc, v.created_at desc;

create or replace view public.current_approved_owner_payment
with (security_invoker = false) as
select distinct on (v.shop_id)
  v.shop_id,
  v.accepts_qr,
  v.accepts_card,
  v.accepts_cash,
  v.reviewed_at
from public.shop_amenity_verifications v
where v.status = 'approved'
  and v.include_payment
order by v.shop_id, v.reviewed_at desc, v.created_at desc;

create or replace view public.current_approved_owner_seating
with (security_invoker = false) as
select distinct on (v.shop_id)
  v.shop_id,
  v.seating_capacity,
  v.reviewed_at
from public.shop_amenity_verifications v
where v.status = 'approved'
  and v.include_seating
order by v.shop_id, v.reviewed_at desc, v.created_at desc;

create or replace view public.shop_amenity_resolutions
with (security_invoker = false) as
select
  s.id as shop_id,
  cfg.amenity_key,
  case
    when not cfg.enabled then 'unknown'
    when cfg.amenity_key = 'wifi'
      and ovw.shop_id is not null
      and (
        ar.result is null
        or ar.result not in ('available', 'unavailable')
        or ovw.reviewed_at > a.audited_at
      )
      then 'available'
    when cfg.amenity_key = 'outlets'
      and ovo.shop_id is not null
      and (
        ar.result is null
        or ar.result not in ('available', 'unavailable')
        or ovo.reviewed_at > a.audited_at
      )
      then 'available'
    when ar.result in ('available', 'unavailable') then ar.result
    when public.amenity_majority_side(c.yes_count, c.no_count, cfg.community_majority_ratio) is not null
      then public.amenity_majority_side(c.yes_count, c.no_count, cfg.community_majority_ratio)
    when seed.result in ('available', 'unavailable') then seed.result
    else 'unknown'
  end as availability,
  case
    when not cfg.enabled then 'unknown'
    when cfg.amenity_key = 'wifi'
      and ovw.shop_id is not null
      and (
        ar.result is null
        or ar.result not in ('available', 'unavailable')
        or ovw.reviewed_at > a.audited_at
      )
      then 'owner_verified'
    when cfg.amenity_key = 'outlets'
      and ovo.shop_id is not null
      and (
        ar.result is null
        or ar.result not in ('available', 'unavailable')
        or ovo.reviewed_at > a.audited_at
      )
      then 'owner_verified'
    when ar.result in ('available', 'unavailable') then 'team_verified'
    when coalesce(c.decided_count, 0) >= cfg.community_min_decided then 'community_confirmed'
    when coalesce(c.decided_count, 0) >= 1 then 'reported'
    when seed.result is not null then 'reported'
    else 'unknown'
  end as confidence,
  case
    when not cfg.enabled then null
    when cfg.amenity_key = 'wifi'
      and ovw.shop_id is not null
      and (
        ar.result is null
        or ar.result not in ('available', 'unavailable')
        or ovw.reviewed_at > a.audited_at
      )
      then ovw.reviewed_at
    when cfg.amenity_key = 'outlets'
      and ovo.shop_id is not null
      and (
        ar.result is null
        or ar.result not in ('available', 'unavailable')
        or ovo.reviewed_at > a.audited_at
      )
      then ovo.reviewed_at
    when ar.result in ('available', 'unavailable') then a.audited_at
    when coalesce(c.decided_count, 0) >= 1 then c.last_voted_at
    when seed.result is not null then seed.observed_at
    else null
  end as source_at,
  coalesce(c.decided_count, 0)::int as decided_count,
  coalesce(c.yes_count, 0)::int as yes_count,
  coalesce(c.no_count, 0)::int as no_count,
  (
    case
      when cfg.amenity_key = 'wifi'
        and ovw.shop_id is not null
        and (
          ar.result is null
          or ar.result not in ('available', 'unavailable')
          or ovw.reviewed_at > a.audited_at
        )
        then ovw.reviewed_at < now() - make_interval(days => cfg.stale_after_days)
      when cfg.amenity_key = 'outlets'
        and ovo.shop_id is not null
        and (
          ar.result is null
          or ar.result not in ('available', 'unavailable')
          or ovo.reviewed_at > a.audited_at
        )
        then ovo.reviewed_at < now() - make_interval(days => cfg.stale_after_days)
      else (
        ar.result in ('available', 'unavailable')
        and a.audited_at < now() - make_interval(days => cfg.stale_after_days)
      )
    end
  ) as is_stale,
  case
    when cfg.amenity_key in ('wifi', 'outlets')
      and (
        (cfg.amenity_key = 'wifi' and ovw.shop_id is not null and (
          ar.result is null
          or ar.result not in ('available', 'unavailable')
          or ovw.reviewed_at > a.audited_at
        ))
        or
        (cfg.amenity_key = 'outlets' and ovo.shop_id is not null and (
          ar.result is null
          or ar.result not in ('available', 'unavailable')
          or ovo.reviewed_at > a.audited_at
        ))
      )
      then false
    else coalesce(
      public.amenity_needs_recheck(
        s.id,
        cfg.amenity_key,
        ar.result,
        a.audited_at,
        cfg.contradiction_min_decided,
        cfg.community_majority_ratio,
        cfg.contradiction_window_days
      ),
      false
    )
  end as needs_recheck,
  case
    when cfg.amenity_key = 'wifi'
      and ovw.shop_id is not null
      and (
        ar.result is null
        or ar.result not in ('available', 'unavailable')
        or ovw.reviewed_at > a.audited_at
      )
      and ovw.wifi_download_mbps is not null
      then case
        when ovw.wifi_download_mbps >= cfg.fast_download_mbps then 'fast'
        when ovw.wifi_download_mbps >= 10 then 'okay'
        else 'slow'
      end
    when cfg.amenity_key = 'wifi' and ar.result = 'available' and ar.wifi_download_mbps is not null then
      case
        when ar.wifi_download_mbps >= cfg.fast_download_mbps then 'fast'
        when ar.wifi_download_mbps >= 10 then 'okay'
        else 'slow'
      end
    when cfg.amenity_key = 'wifi' and ar.result in ('available', 'unavailable') then null
    when cfg.amenity_key = 'wifi' then stats.wifi_speed_mode
    else null
  end as wifi_speed,
  case
    when cfg.amenity_key = 'wifi'
      and ovw.shop_id is not null
      and (
        ar.result is null
        or ar.result not in ('available', 'unavailable')
        or ovw.reviewed_at > a.audited_at
      )
      then null
    when cfg.amenity_key = 'wifi' and ar.result = 'available' and a.long_stay_stance = 'welcome' then 'unlimited'
    when cfg.amenity_key = 'wifi' and ar.result in ('available', 'unavailable') then null
    when cfg.amenity_key = 'wifi' then stats.wifi_time_limit_mode
    else null
  end as wifi_time_limit,
  case
    when cfg.amenity_key = 'outlets'
      and ovo.shop_id is not null
      and (
        ar.result is null
        or ar.result not in ('available', 'unavailable')
        or ovo.reviewed_at > a.audited_at
      )
      then null
    when cfg.amenity_key = 'outlets' and ar.result = 'available' then ar.outlet_reliability
    when cfg.amenity_key = 'outlets' and ar.result in ('available', 'unavailable') then null
    when cfg.amenity_key = 'outlets' then stats.power_access_mode
    else null
  end as outlet_reliability,
  a.id as audit_id,
  a.auditor_id,
  a.audited_at
from public.shops s
cross join public.amenity_resolution_config cfg
left join public.current_valid_cafe_audits a on a.shop_id = s.id
left join public.cafe_audit_amenity_results ar
  on ar.audit_id = a.id and ar.amenity_key = cfg.amenity_key
left join public.community_amenity_rollups c
  on c.shop_id = s.id and c.amenity_key = cfg.amenity_key
left join public.current_valid_amenity_reports seed
  on seed.shop_id = s.id and seed.amenity_key = cfg.amenity_key
left join public.shop_review_stats stats on stats.shop_id = s.id
left join public.current_approved_owner_wifi ovw on ovw.shop_id = s.id
left join public.current_approved_owner_outlets ovo on ovo.shop_id = s.id
where s.status = 'approved';

comment on view public.shop_amenity_resolutions is
  'Internal amenity resolver including staff ids. Do not grant to anon.';

create or replace view public.shop_amenity_resolutions_public
with (security_invoker = false) as
select
  shop_id,
  amenity_key,
  availability,
  confidence,
  source_at,
  decided_count,
  yes_count,
  no_count,
  is_stale,
  needs_recheck,
  wifi_speed,
  wifi_time_limit,
  outlet_reliability
from public.shop_amenity_resolutions;

comment on view public.shop_amenity_resolutions_public is
  'Safe amenity status for cards, filters, and cafe detail. No auditor ids, SSIDs, or notes.';

create or replace view public.shop_payment_public
with (security_invoker = false) as
select distinct on (picked.shop_id)
  picked.shop_id,
  picked.accepts_qr,
  picked.accepts_card,
  picked.accepts_cash,
  picked.source_at,
  picked.source
from (
  select
    a.shop_id,
    a.accepts_qr,
    a.accepts_card,
    a.accepts_cash,
    a.audited_at as source_at,
    'team'::text as source
  from public.current_valid_cafe_audits a
  join public.shops s on s.id = a.shop_id
  where s.status = 'approved'
  union all
  select
    o.shop_id,
    o.accepts_qr,
    o.accepts_card,
    o.accepts_cash,
    o.reviewed_at as source_at,
    'owner'::text as source
  from public.current_approved_owner_payment o
  join public.shops s on s.id = o.shop_id
  where s.status = 'approved'
) picked
order by picked.shop_id, picked.source_at desc nulls last, picked.source asc;

comment on view public.shop_payment_public is
  'Latest team-visit or owner-declared payment facts for approved cafes.';

create or replace view public.shop_seating_public
with (security_invoker = false) as
select distinct on (picked.shop_id)
  picked.shop_id,
  picked.seating_capacity,
  picked.source,
  picked.source_at
from (
  select
    a.shop_id,
    a.seating_capacity_estimate as seating_capacity,
    'team'::text as source,
    a.audited_at as source_at
  from public.cafe_audits a
  join public.shops s on s.id = a.shop_id
  left join public.cafe_audit_voids v on v.audit_id = a.id
  where s.status = 'approved'
    and v.audit_id is null
    and a.seating_capacity_estimate is not null
  union all
  select
    o.shop_id,
    o.seating_capacity,
    'owner'::text as source,
    o.reviewed_at as source_at
  from public.current_approved_owner_seating o
  join public.shops s on s.id = o.shop_id
  where s.status = 'approved'
    and o.seating_capacity is not null
) picked
order by picked.shop_id, picked.source_at desc nulls last, picked.source asc;

comment on view public.shop_seating_public is
  'Latest staff-approved seating count for cafe detail. Team visit wins ties.';

revoke all on public.current_approved_owner_wifi from anon, authenticated;
revoke all on public.current_approved_owner_outlets from anon, authenticated;
revoke all on public.current_approved_owner_payment from anon, authenticated;
revoke all on public.current_approved_owner_seating from anon, authenticated;
revoke all on public.shop_amenity_resolutions from anon, authenticated;
revoke all on public.current_valid_cafe_audits from anon, authenticated;
revoke all on public.review_amenity_votes from anon, authenticated;
revoke all on public.community_amenity_rollups from anon, authenticated;
revoke all on public.current_valid_amenity_reports from anon, authenticated;

grant select on public.shop_amenity_resolutions_public to anon, authenticated;
grant select on public.shop_payment_public to anon, authenticated;
grant select on public.shop_seating_public to anon, authenticated;

revoke all on function public.amenity_proof_key_ok(text, uuid) from public, anon;
revoke all on function public.submit_shop_amenity_verification(uuid, boolean, text, numeric, boolean, text, integer, boolean, text, boolean, text, text, text) from public, anon;
revoke all on function public.moderate_shop_amenity_verification(uuid, text, text) from public, anon;
revoke all on function public.list_my_shop_amenity_verifications() from public, anon;
revoke all on function public.list_amenity_verifications() from public, anon;

grant execute on function public.amenity_proof_key_ok(text, uuid) to authenticated;
grant execute on function public.submit_shop_amenity_verification(uuid, boolean, text, numeric, boolean, text, integer, boolean, text, boolean, text, text, text) to authenticated;
grant execute on function public.moderate_shop_amenity_verification(uuid, text, text) to authenticated;
grant execute on function public.list_my_shop_amenity_verifications() to authenticated;
grant execute on function public.list_amenity_verifications() to authenticated;

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
    'seating', coalesce((
      select jsonb_agg(to_jsonb(seat))
      from public.shop_seating_public seat
      where seat.shop_id = any(p_shop_ids)
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
  'Card amenity, payment, seating, stats, pin tier, and live badges for a shop id list.';

revoke all on function public.shop_card_sidecars(uuid[]) from public;
grant execute on function public.shop_card_sidecars(uuid[]) to anon, authenticated;

notify pgrst, 'reload schema';
