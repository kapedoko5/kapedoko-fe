-- =========================================================
-- KapéDoko — restore vibe stamps on shop_card_sidecars
-- =========================================================
-- Run AFTER 20261120_shop_seating_from_audits.sql.
-- Safe to re-run.
--
-- The seating migration rebuilt shop_card_sidecars without
-- vibes, so cafe cards and cafe detail dropped live stamps.
-- =========================================================

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
    ), '[]'::jsonb),
    'vibes', coalesce((
      select jsonb_agg(to_jsonb(v))
      from public.active_shop_vibe_tags v
      where v.shop_id = any(p_shop_ids)
    ), '[]'::jsonb)
  );
$$;

comment on function public.shop_card_sidecars(uuid[]) is
  'Card amenity, payment, seating, stats, pin tier, live badges, and vibe stamps for a shop id list.';

revoke all on function public.shop_card_sidecars(uuid[]) from public;
grant execute on function public.shop_card_sidecars(uuid[]) to anon, authenticated;

notify pgrst, 'reload schema';
