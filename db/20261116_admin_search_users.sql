-- =========================================================
-- KapéDoko — Admin user search by name or email
-- =========================================================
-- Apply after 20261115_admin_cannot_own_shop.sql.
-- Lets admins find an account by display name or email when
-- assigning cafe ownership, without paging through auth users.
-- =========================================================

create or replace function public.admin_search_users(
  p_query text default '',
  p_limit integer default 20,
  p_exclude_ids uuid[] default '{}'
)
returns table (
  id uuid,
  email text,
  display_name text,
  role text,
  banned boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  term text := nullif(btrim(coalesce(p_query, '')), '');
  take integer := greatest(1, least(coalesce(p_limit, 20), 50));
  excluded uuid[] := coalesce(p_exclude_ids, '{}');
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  if term is not null then
    term := regexp_replace(term, '[%_\\]', ' ', 'g');
    term := nullif(btrim(term), '');
  end if;

  return query
  select
    p.id,
    u.email::text,
    p.display_name,
    p.role::text,
    coalesce(u.banned_until is not null and u.banned_until > now(), false),
    coalesce(p.created_at, u.created_at)
  from public.profiles p
  join auth.users u on u.id = p.id
  where (excluded = '{}' or p.id <> all (excluded))
    and (
      term is null
      or p.display_name ilike '%' || term || '%'
      or u.email ilike '%' || term || '%'
    )
  order by
    case
      when term is not null and lower(u.email) = lower(term) then 0
      when term is not null and u.email ilike term || '%' then 1
      else 2
    end,
    p.created_at desc nulls last
  limit take;
end;
$$;

comment on function public.admin_search_users(text, integer, uuid[]) is
  'Admin only. Find accounts by display name or email for ownership assignment.';

revoke all on function public.admin_search_users(text, integer, uuid[]) from public, anon;
grant execute on function public.admin_search_users(text, integer, uuid[]) to authenticated;

notify pgrst, 'reload schema';
