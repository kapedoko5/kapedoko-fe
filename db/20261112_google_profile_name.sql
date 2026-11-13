-- Google Sign-In stores the public name as full_name / name, not display_name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_name text;
begin
  chosen_name := coalesce(
    nullif(btrim(coalesce(new.raw_user_meta_data->>'display_name', '')), ''),
      nullif(btrim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
      nullif(btrim(coalesce(new.raw_user_meta_data->>'name', '')), ''),
      nullif(btrim(coalesce(new.raw_user_meta_data->>'given_name', '')), '')
  );
  if chosen_name is not null then
    chosen_name := left(chosen_name, 40);
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, chosen_name)
  on conflict (id) do update
    set display_name = coalesce(public.profiles.display_name, excluded.display_name),
        updated_at = now();
  return new;
end;
$$;

update public.profiles as profiles
set
  display_name = left(chosen.display_name, 40),
  updated_at = now()
from (
  select
    users.id,
    coalesce(
      nullif(btrim(coalesce(users.raw_user_meta_data->>'display_name', '')), ''),
      nullif(btrim(coalesce(users.raw_user_meta_data->>'full_name', '')), ''),
      nullif(btrim(coalesce(users.raw_user_meta_data->>'name', '')), ''),
      nullif(btrim(coalesce(users.raw_user_meta_data->>'given_name', '')), '')
    ) as display_name
  from auth.users as users
) as chosen
where profiles.id = chosen.id
  and coalesce(btrim(profiles.display_name), '') = ''
  and chosen.display_name is not null;
