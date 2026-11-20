-- =========================================================
-- KapéDoko — Budget-friendly stamps below ₱100
-- =========================================================
-- Run AFTER 20261124_menu_price_budget_vibe.sql.
-- Safe to re-run.
--
-- Aligns the surprise stamp with the Philippine value tier
-- (typical cups under ₱100). Replaces the earlier ₱200 cutoff.
-- =========================================================

create or replace function public.sync_budget_friendly_vibe(p_shop_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tag uuid;
  tag_enabled boolean;
  price integer;
begin
  select menu_price_php into price
  from public.shops
  where id = p_shop_id;

  select id, enabled into tag, tag_enabled
  from public.vibe_tag_names
  where slug = 'budget-friendly'
  limit 1;

  if tag is null then
    return;
  end if;

  if price is not null and price < 100 and tag_enabled then
    insert into public.shop_vibe_tags (shop_id, tag_id)
    values (p_shop_id, tag)
    on conflict do nothing;
  else
    delete from public.shop_vibe_tags
    where shop_id = p_shop_id
      and tag_id = tag;
  end if;
end;
$$;

comment on function public.sync_budget_friendly_vibe(uuid) is
  'Stamps Budget-friendly when menu_price_php is below ₱100. Not a picker option.';

comment on column public.shops.menu_price_php is
  'Typical menu price in pesos. Below ₱100 stamps Budget-friendly.';

notify pgrst, 'reload schema';
