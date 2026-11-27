-- Checks after db/20261127_ad_campaign_events.sql
-- See shop_traffic_rollup.sql for how to run a block as a given role.

-- Catalog (as postgres)
select polname from pg_policy
where polrelid = 'public.ad_campaign_events'::regclass
order by polname;
-- Expected: ad_campaign_events_admin_read, ad_campaign_events_owner_featured_read.

select relrowsecurity from pg_class where oid = 'public.ad_campaign_events'::regclass;
-- Expected: true.

-- Anon / user cannot read or write the table.
-- set local role anon;
-- select * from public.ad_campaign_events;                     -- permission denied
-- insert into public.ad_campaign_events (placement, kind, shop_id) values ('featured', 'click', '<shop-id>'); -- permission denied

-- Anon can record on a live banner and on a featured cafe.
-- select public.record_ad_event('banner', 'impression', '<live-campaign-id>');
-- select public.record_ad_event('featured', 'click', null, '<partner-shop-id>');
-- Expected: void; admins see two rows. The banner row shop_id comes from the campaign,
-- even if a different p_shop_id is passed:
-- select public.record_ad_event('banner', 'click', '<live-campaign-id>', '<other-shop-id>');
-- Expected: row shop_id = the campaign's shop_id (null for internal / external banners).

-- Whitelist and shape rejections (anon).
-- select public.record_ad_event('sidebar', 'click', '<live-campaign-id>');   -- Unknown ad placement
-- select public.record_ad_event('banner', 'view', '<live-campaign-id>');     -- Unknown ad event kind
-- select public.record_ad_event('banner', 'click');                          -- Banner events need a campaign
-- select public.record_ad_event('banner', 'click', '<cancelled-or-expired-campaign-id>'); -- Only live campaigns can receive ad events
-- select public.record_ad_event('featured', 'click');                        -- Featured events need a cafe
-- select public.record_ad_event('featured', 'click', '<campaign-id>', '<partner-shop-id>'); -- Featured events have no campaign
-- select public.record_ad_event('featured', 'click', null, '<standard-shop-id>'); -- Only featured cafes can receive ad events
-- select public.record_ad_event('featured', 'click', null, '<pending-shop-id>');  -- Only featured cafes can receive ad events

-- Owner reads only featured rows of cafes they manage.
-- As owner JWT: select distinct placement, shop_id from public.ad_campaign_events;
-- Expected: placement = featured only, shop ids owned only. No banner rows even for the
-- owner's own cafe-linked banner.
-- select * from public.ad_campaign_stats(current_date - 30, current_date);  -- Admin only

-- User and auditor read nothing.
-- As regular user JWT and auditor JWT: select count(*) from public.ad_campaign_events; -- 0
-- select * from public.ad_campaign_stats(current_date - 30, current_date);             -- Admin only

-- Admin.
-- As admin JWT: select * from public.ad_campaign_stats(current_date - 30, current_date);
-- Expected: one row per banner campaign with events and one per featured cafe;
-- impressions / clicks match: select kind, count(*) from public.ad_campaign_events group by 1;
-- select * from public.ad_campaign_stats(current_date, current_date - 1);   -- Invalid date range

-- Deleting a campaign removes its events (on delete cascade).
