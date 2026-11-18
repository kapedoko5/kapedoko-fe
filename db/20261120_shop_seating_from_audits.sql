-- =========================================================
-- KapéDoko — seating estimate from team audits on cafe detail
-- =========================================================
-- Run AFTER 20261119_owner_amenity_verification.sql. Safe to re-run.
-- Latest non-voided audit that recorded a count stays public even when
-- a later visit leaves seating blank. Owner proof still wins if newer.
-- =========================================================

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
  'Latest seating count for cafe detail. Newest team visit or owner proof with a number.';

grant select on public.shop_seating_public to anon, authenticated;
revoke all on public.current_valid_cafe_audits from anon, authenticated;
revoke all on public.current_approved_owner_seating from anon, authenticated;

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
