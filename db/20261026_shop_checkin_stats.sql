-- KapéDoko — public 30-day check-in rollups
--
-- Raw shop_busyness_reports stay insert-only. These views expose counts
-- without reporter identities, matching shop_busyness_now.

create or replace view public.shop_checkin_stats
with (security_invoker = false) as
select
  shop_id,
  count(*)::int as checkins_30d,
  max(created_at) as last_checkin_at
from public.shop_busyness_reports
where created_at > now() - interval '30 days'
group by shop_id;

comment on view public.shop_checkin_stats is
  'Privacy-safe 30-day KapéBean check-in counts. No reporter identities.';

create or replace view public.shop_checkin_totals
with (security_invoker = false) as
select count(*)::int as checkins_30d
from public.shop_busyness_reports
where created_at > now() - interval '30 days';

comment on view public.shop_checkin_totals is
  'Single-row 30-day check-in total for the admin dashboard.';

grant select on public.shop_checkin_stats to anon, authenticated;
grant select on public.shop_checkin_totals to anon, authenticated;
