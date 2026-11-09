-- KapéDoko — serialize busyness check-ins per user + shop
--
-- Two taps in the same moment could both pass the 30-minute EXISTS check
-- before either row committed. Lock the pair for the rest of the transaction,
-- then keep the existing cooldown.

create or replace function public.shop_busyness_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  shop_status text;
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  if new.user_id is null or new.user_id is distinct from auth.uid() then
    raise exception 'Busyness check-in must belong to the signed-in user';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(new.user_id::text),
    hashtext(new.shop_id::text)
  );

  select status into shop_status from public.shops where id = new.shop_id;
  if shop_status is null or shop_status <> 'approved' then
    raise exception 'Only approved shops can receive busyness check-ins';
  end if;

  if exists (
    select 1
    from public.shop_busyness_reports existing
    where existing.shop_id = new.shop_id
      and existing.user_id = new.user_id
      and existing.created_at > now() - interval '30 minutes'
  ) then
    raise exception 'busyness_cooldown';
  end if;

  new.created_at := now();
  return new;
end;
$$;
