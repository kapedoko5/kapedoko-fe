-- =========================================================
-- KapéDoko — Admin portal RLS checks (manual)
-- =========================================================
-- Run in the SQL editor as the table owner, then repeat
-- selected statements with an anon key and a normal user
-- JWT. Expected outcomes are in comments.
-- =========================================================

-- Anonymous / normal user: admin RPCs must fail.
-- select public.create_admin_shop('Ab', '123 Street', 14.6, 121.0, '{}'::jsonb);
-- Expected: Admin only  OR hours/name validation — never a row for anon.

-- Anonymous insert into shops as approved must fail (trigger + RLS).
-- insert into public.shops (name, address, latitude, longitude, hours, status)
-- values ('Nope', 'Not allowed street', 14.55, 121.02, '{}'::jsonb, 'approved');
-- Expected: New shops must start as pending  and/or RLS.

-- Coverage blocks ordinary inserts outside the Philippines.
-- (Use a pending insert as a signed-in non-admin in Singapore.)
-- Expected: shops_in_coverage.
-- A pending insert in Cebu or Antipolo should succeed.

-- Non-admin cannot read admin_audit_log.
-- select count(*) from public.admin_audit_log;
-- Expected: 0 rows for anon/user; admins see their writes.

-- Non-admin cannot change another profile role.
-- select public.admin_set_profile_role('00000000-0000-0000-0000-000000000000', 'admin');
-- Expected: Admin only.

-- Public ad reads hide inactive campaigns.
-- insert (as admin) a campaign with ends_at in the past, then:
-- select * from public.active_ad_campaigns;
-- Expected: only enabled, in-window, non-cancelled rows.

-- Admin can create a hidden cafe outside coverage via RPC.
-- select public.create_admin_shop(
--   'Admin Cafe',
--   '1 Example Street Cebu',
--   10.3157,
--   123.8854,
--   '{"mon":{"kind":"all_day"},"tue":{"kind":"all_day"},"wed":{"kind":"all_day"},"thu":{"kind":"all_day"},"fri":{"kind":"all_day"},"sat":{"kind":"all_day"},"sun":{"kind":"all_day"}}'::jsonb
-- );
-- Expected: status = hidden.
-- select public.moderate_admin_shop('<shop-id>', 'approved');
-- Expected: status = approved.
-- select public.moderate_admin_shop('<shop-id>', 'hidden');
-- Expected: status = hidden.

-- Direct approved → rejected is still illegal.
-- update public.shops set status = 'rejected' where status = 'approved' limit 1;
-- Expected: Illegal shop status transition.

-- Cafe-owner role is assignable by admin and is not admin.
-- select public.admin_set_profile_role('<user-uuid>', 'cafe-owner');
-- Expected: profiles.role = cafe-owner; is_admin() stays false for that user.

-- Claimant cannot publish a cafe.
-- As a signed-in non-admin with a pending or verified claim:
--   update public.shops set status = 'approved' where id = '<shop-id>';
-- Expected: Only an admin can change listing status  and/or RLS (no owner UPDATE policy).
-- select public.moderate_admin_shop('<shop-id>', 'approved');
-- Expected: Admin only.

-- Claimant cannot self-verify.
-- select public.moderate_shop_claim('<claim-id>', 'verified');
-- Expected: Admin only.

-- Owner RPC cannot change status. After a verified claim:
-- select public.update_owner_shop('<shop-id>', 'New Name', '1 Longer Street Name', 10.3157, 123.8854, '<valid hours>'::jsonb);
-- Expected: name/hours update; shops.status remains approved.
-- A second pending claim by the same user on that shop:
-- Expected: You already manage this cafe.

-- Claimant can withdraw a pending claim, not a verified one.
-- select public.withdraw_shop_claim('<pending-claim-id>');
-- Expected: row gone; claimant can submit again.
-- select public.withdraw_shop_claim('<verified-claim-id>');
-- Expected: This claim is not waiting for review.

-- Non-admin cannot delete a cafe.
-- select public.delete_admin_shop('<shop-id>');
-- Expected: Admin only.
-- Admin delete_admin_shop removes the shop and returns unused object_keys.
-- Direct delete from cafe_audits still fails with append-only unless
-- app.admin_shop_delete is on inside that RPC.

-- OSM identity is unique.
-- insert two pending shops with the same source/osm_type/osm_id.
-- Expected: unique violation on shops_osm_identity_uidx.

-- Amenity source of truth checks: db/verify/amenity_source_of_truth.sql
