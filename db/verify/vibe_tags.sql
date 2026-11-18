-- =========================================================
-- KapéDoko — Vibe tags RLS checks (manual)
-- =========================================================
-- Run in the SQL editor as the table owner, then repeat
-- selected statements with an anon key and a normal user
-- JWT. Expected outcomes are in comments.
-- =========================================================

-- Anonymous insert into vibe_tag_names must fail.
-- insert into public.vibe_tag_names (label) values ('Quiet');
-- Expected: Admin only and/or RLS.

-- Anonymous insert into shop_vibe_tags must fail.
-- insert into public.shop_vibe_tags (shop_id, tag_id) values ('<shop-id>', '<tag-id>');
-- Expected: RLS (no client write policy).

-- Admin creates Quiet + Lively, assigns both to an approved cafe.
-- select * from public.active_shop_vibe_tags where shop_id = '<shop-id>';
-- Expected: both rows, each with color.

-- Stamp color is a 6-digit hex.
-- insert into public.vibe_tag_names (label, color) values ('Quiet', 'orange');
-- Expected: check constraint / trigger falls back or rejects.

-- Disabled tags leave public cards but stay assigned.
-- update public.vibe_tag_names set enabled = false where slug = 'quiet';
-- select * from public.vibe_tag_names;            -- anon: 0 for that slug
-- select * from public.active_shop_vibe_tags;     -- none for that tag_id
-- select * from public.shop_vibe_tags;            -- owner/admin still see the row

-- A sixth enabled tag is rejected.
-- select public.replace_shop_vibe_tags('<shop-id>', array[<6 enabled ids>]::uuid[]);
-- Expected: Keep vibe tags to 5.

-- Delete is blocked while any cafe still uses the tag.
-- delete from public.vibe_tag_names where slug = 'quiet';
-- Expected: Unassign this tag from every cafe before deleting it.

-- Non-admin cannot update the catalog.
-- update public.vibe_tag_names set label = 'Nope' where slug = 'lively';
-- Expected: Admin only and/or RLS.
