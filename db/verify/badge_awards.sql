-- =========================================================
-- KapéDoko — Badge awards RLS checks (manual)
-- =========================================================
-- Run in the SQL editor as the table owner, then repeat
-- selected statements with an anon key and a normal user
-- JWT. Expected outcomes are in comments.
-- =========================================================

-- Anonymous insert into badge_names must fail.
-- insert into public.badge_names (label) values ('Hidden Gem');
-- Expected: Admin only and/or RLS.

-- Admin creates a name, then an award that already ended.
-- insert (as admin) badge_awards with ends_at in the past, attach a shop,
-- then:
-- select * from public.active_shop_badges;
-- Expected: only enabled, in-window, non-cancelled awards on approved shops
-- with enabled badge names.

-- Disabled badge names leave the public catalog.
-- update public.badge_names set enabled = false where slug = 'hidden-gem';
-- select * from public.badge_names;           -- anon: 0 for that slug
-- select * from public.active_shop_badges;    -- none for that badge_id

-- Unapproving a cafe drops it from currently live awards only.
-- select public.moderate_admin_shop('<shop-id>', 'hidden');
-- Expected: that shop_id is gone from live badge_award_shops; scheduled
-- or already-ended awards keep their cafe set.

-- Overlapping windows for the same cafe + badge are rejected.
-- select public.save_badge_award(null, '<badge-id>', now(), now() + interval '7 days', array['<shop-id>']::uuid[]);
-- select public.save_badge_award(null, '<badge-id>', now() + interval '3 days', now() + interval '10 days', array['<shop-id>']::uuid[]);
-- Expected: This badge already covers <cafe> in that window.

-- Non-admin cannot call the write RPCs.
-- select public.save_badge_award(null, '<badge-id>', now(), now() + interval '7 days', array['<shop-id>']::uuid[]);
-- Expected: Admin only.
