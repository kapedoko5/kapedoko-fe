-- =========================================================
-- KapéDoko — Admin-managed ₱ / ₱₱ / ₱₱₱ cutoffs
-- =========================================================
-- Run AFTER 20261125_budget_friendly_under_100.sql.
-- Safe to re-run.
--
-- One row. Admins set the inclusive ₱ and ₱₱ ceilings.
-- ₱₱₱ is everything above ₱₱. Budget-friendly follows ₱.
-- =========================================================

create table if not exists public.cafe_price_marks (
  id boolean primary key default true check (id),
  budget_max_php integer not null default 99,
  mid_max_php integer not null default 184,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint cafe_price_marks_budget_range check (budget_max_php between 1 and 99998),
  constraint cafe_price_marks_mid_range check (mid_max_php between 2 and 99999),
  constraint cafe_price_marks_order check (budget_max_php < mid_max_php)
);

comment on table public.cafe_price_marks is
  'Singleton ₱ / ₱₱ / ₱₱₱ ceilings. Budget-friendly stamps follow budget_max_php.';

insert into public.cafe_price_marks (id, budget_max_php, mid_max_php)
values (true, 99, 184)
on conflict (id) do nothing;

alter table public.cafe_price_marks enable row level security;

drop policy if exists cafe_price_marks_public_read on public.cafe_price_marks;
create policy cafe_price_marks_public_read
  on public.cafe_price_marks
  for select
  to anon, authenticated
  using (true);

grant select on public.cafe_price_marks to anon, authenticated;

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
  budget_max integer := 99;
begin
  select menu_price_php into price
  from public.shops
  where id = p_shop_id;

  select budget_max_php into budget_max
  from public.cafe_price_marks
  where id = true;
  budget_max := coalesce(budget_max, 99);

  select id, enabled into tag, tag_enabled
  from public.vibe_tag_names
  where slug = 'budget-friendly'
  limit 1;

  if tag is null then
    return;
  end if;

  if price is not null and price <= budget_max and tag_enabled then
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
  'Stamps Budget-friendly when menu_price_php is at or below the ₱ cutoff.';

create or replace function public.resync_budget_friendly_vibes()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tag uuid;
  tag_enabled boolean;
  budget_max integer := 99;
begin
  select budget_max_php into budget_max
  from public.cafe_price_marks
  where id = true;
  budget_max := coalesce(budget_max, 99);

  select id, enabled into tag, tag_enabled
  from public.vibe_tag_names
  where slug = 'budget-friendly'
  limit 1;

  if tag is null then
    return;
  end if;

  delete from public.shop_vibe_tags
  where tag_id = tag
    and shop_id in (
      select s.id
      from public.shops s
      where s.menu_price_php is null
         or s.menu_price_php > budget_max
         or not tag_enabled
    );

  if tag_enabled then
    insert into public.shop_vibe_tags (shop_id, tag_id)
    select s.id, tag
    from public.shops s
    where s.menu_price_php is not null
      and s.menu_price_php <= budget_max
    on conflict do nothing;
  end if;
end;
$$;

create or replace function public.update_cafe_price_marks(
  p_budget_max_php integer,
  p_mid_max_php integer
)
returns public.cafe_price_marks
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.cafe_price_marks;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;
  if p_budget_max_php is null or p_budget_max_php < 1 or p_budget_max_php > 99998 then
    raise exception '₱ has to be a peso amount from 1 to 99,998.';
  end if;
  if p_mid_max_php is null or p_mid_max_php < 2 or p_mid_max_php > 99999 then
    raise exception '₱₱ has to be a peso amount from 2 to 99,999.';
  end if;
  if p_budget_max_php >= p_mid_max_php then
    raise exception '₱₱ has to sit above ₱.';
  end if;

  insert into public.cafe_price_marks (id, budget_max_php, mid_max_php, updated_at, updated_by)
  values (true, p_budget_max_php, p_mid_max_php, now(), auth.uid())
  on conflict (id) do update
    set budget_max_php = excluded.budget_max_php,
        mid_max_php = excluded.mid_max_php,
        updated_at = now(),
        updated_by = auth.uid()
  returning * into saved;

  perform public.resync_budget_friendly_vibes();

  perform public.admin_write_audit(
    'price_marks.update',
    'cafe_price_marks',
    'true',
    jsonb_build_object(
      'budget_max_php', saved.budget_max_php,
      'mid_max_php', saved.mid_max_php
    )
  );

  return saved;
end;
$$;

revoke all on function public.update_cafe_price_marks(integer, integer) from public, anon;
revoke all on function public.resync_budget_friendly_vibes() from public, anon, authenticated;
grant execute on function public.update_cafe_price_marks(integer, integer) to authenticated;

notify pgrst, 'reload schema';
