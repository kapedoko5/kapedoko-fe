-- Optional checks after 20261119_owner_amenity_verification.sql
-- Repeat as cafe-owner JWT, auditor JWT, admin JWT, and anon.

-- Owner can submit a subset (WiFi only) for a shop they own.
-- select public.submit_shop_amenity_verification(
--   '<owned-shop-id>',
--   true,
--   'amenity-proofs/<uid>/<file>.jpg',
--   42,
--   false, null, null,
--   false, null,
--   false, null, null, null
-- );
-- Expected: pending row; second call updates the same pending row.

-- Non-owner submit → Only the verified owner can submit amenity proof.

-- Missing section → Choose at least one amenity to verify.

-- WiFi without Mbps → Enter the download Mbps shown on fast.com.

-- Key not under amenity-proofs/{caller}/ → Upload a fast.com screenshot for WiFi speed.

-- Anon / user cannot insert into shop_amenity_verifications.
-- insert into public.shop_amenity_verifications (shop_id, owner_id) values (...);
-- Expected: RLS / permission denied.

-- User cannot moderate.
-- select public.moderate_shop_amenity_verification('<id>', 'approved');
-- Expected: Staff only.

-- Auditor/admin approve pending → status approved, shop_amenity_resolutions_public
-- confidence = owner_verified for wifi/outlets included, shop_payment_public.source = owner
-- when payment included, shop_seating_public.source = owner when seating included.

-- Reject without reason → Add a reason for rejecting this proof.

-- Reject with reason → owner list shows rejection_reason; owner can submit a new pending row.

-- Public views have no owner ids.
-- select * from public.shop_amenity_resolutions_public limit 1;
-- select * from public.shop_payment_public limit 1;
-- select * from public.shop_seating_public limit 1;
-- Expected: no owner_id, no object keys on seating/payment.
-- After a team audit with seating_capacity_estimate, shop_seating_public
-- has that count even if a later audit left seating blank.

-- Direct read of current_approved_owner_wifi as anon → permission denied.
