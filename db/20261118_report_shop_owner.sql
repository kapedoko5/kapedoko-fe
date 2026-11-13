-- =========================================================
-- KapéDoko — report a mistaken cafe owner
-- =========================================================
-- Run AFTER 20261113_shop_verified_owner.sql.
-- Safe to re-run.
--
-- Visitors can flag a claimed listing when they think the
-- owner is wrong. The report does not name the owner, and
-- it does not hide the cafe. Admins close it from Moderation
-- and transfer from cafe edit if needed.
-- =========================================================

alter table public.content_reports drop constraint if exists content_reports_target_check;
alter table public.content_reports
  add constraint content_reports_target_check
  check (target_type in ('review', 'shop_photo', 'shop_owner'));

create unique index if not exists content_reports_owner_uidx
  on public.content_reports (reporter_id, shop_id)
  where target_type = 'shop_owner' and shop_id is not null;

create or replace function public.report_content(
  p_target_type text,
  p_review_id uuid default null,
  p_shop_id uuid default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_reason text := nullif(left(btrim(coalesce(p_reason, '')), 280), '');
  report_id uuid;
  review_author uuid;
  owned boolean;
begin
  if uid is null then
    raise exception 'Sign in to report this';
  end if;
  if p_target_type not in ('review', 'shop_photo', 'shop_owner') then
    raise exception 'Unknown report target';
  end if;
  if p_target_type = 'review' and p_review_id is null then
    raise exception 'Review was not found';
  end if;
  if p_target_type in ('shop_photo', 'shop_owner') and p_shop_id is null then
    raise exception 'Cafe was not found';
  end if;

  if p_target_type = 'review' then
    select user_id into review_author
    from public.reviews
    where id = p_review_id;
    if review_author is null then
      raise exception 'Review was not found';
    end if;
    if review_author = uid then
      raise exception 'You cannot report your own review';
    end if;
  end if;

  if p_target_type = 'shop_owner' then
    if not exists (
      select 1
      from public.shop_claims
      where shop_id = p_shop_id
        and status = 'verified'
    ) then
      raise exception 'This cafe has no owner';
    end if;
    owned := public.is_shop_owner(p_shop_id);
    if owned then
      raise exception 'You cannot report a listing you manage';
    end if;
  end if;

  if p_target_type = 'review' then
    select id into report_id
    from public.content_reports
    where reporter_id = uid
      and target_type = 'review'
      and review_id = p_review_id
    limit 1;
  elsif p_target_type = 'shop_photo' then
    select id into report_id
    from public.content_reports
    where reporter_id = uid
      and target_type = 'shop_photo'
      and shop_id = p_shop_id
    limit 1;
  else
    select id into report_id
    from public.content_reports
    where reporter_id = uid
      and target_type = 'shop_owner'
      and shop_id = p_shop_id
    limit 1;
  end if;

  if report_id is null then
    insert into public.content_reports (reporter_id, target_type, review_id, shop_id, reason)
    values (uid, p_target_type, p_review_id, p_shop_id, clean_reason)
    returning id into report_id;
  end if;

  if p_target_type = 'review' then
    update public.reviews
    set
      flagged_at = coalesce(flagged_at, now()),
      flagged_by = coalesce(flagged_by, uid),
      flag_reason = coalesce(flag_reason, clean_reason)
    where id = p_review_id;
  end if;

  return report_id;
end;
$$;

comment on function public.report_content(text, uuid, uuid, text) is
  'Visitors report a review, cafe photo, or mistaken cafe owner. Ownership reports do not hide the cafe.';

revoke all on function public.report_content(text, uuid, uuid, text) from public, anon;
grant execute on function public.report_content(text, uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
