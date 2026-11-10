-- Community events posted from Admin. Public reads only currently displayed rows.
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organizer_name text not null,
  organizer_contact_name text,
  organizer_contact_number text,
  description text,
  address text not null,
  latitude double precision not null,
  longitude double precision not null,
  event_starts_at timestamptz not null,
  event_ends_at timestamptz not null,
  display_starts_at timestamptz not null,
  display_ends_at timestamptz not null,
  poster_object_key text not null,
  gallery_object_keys text[] not null default '{}'::text[],
  enabled boolean not null default true,
  cancelled_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_name_len check (char_length(btrim(name)) between 2 and 80),
  constraint events_organizer_len check (char_length(btrim(organizer_name)) between 2 and 80),
  constraint events_contact_name_len check (
    organizer_contact_name is null or char_length(btrim(organizer_contact_name)) between 1 and 80
  ),
  constraint events_contact_number_len check (
    organizer_contact_number is null or char_length(btrim(organizer_contact_number)) between 7 and 24
  ),
  constraint events_description_len check (
    description is null or char_length(btrim(description)) between 1 and 2000
  ),
  constraint events_address_len check (char_length(btrim(address)) between 8 and 200),
  constraint events_lat check (latitude >= -90 and latitude <= 90),
  constraint events_lng check (longitude >= -180 and longitude <= 180),
  constraint events_event_window check (event_ends_at > event_starts_at),
  constraint events_display_window check (display_ends_at > display_starts_at),
  constraint events_poster_key check (
    poster_object_key ~ '^[a-zA-Z0-9][a-zA-Z0-9/_.:-]*$'
  ),
  constraint events_gallery_len check (cardinality(gallery_object_keys) <= 8)
);

comment on table public.events is
  'Admin-posted community events. Public reads only enabled, in-display-window rows.';

create index if not exists events_display_window_idx
  on public.events (display_starts_at, display_ends_at, enabled)
  where cancelled_at is null;

create index if not exists events_lat_lng_idx
  on public.events (latitude, longitude)
  where enabled and cancelled_at is null;

create or replace function public.events_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  new.name := btrim(new.name);
  new.organizer_name := btrim(new.organizer_name);
  new.address := btrim(new.address);
  new.organizer_contact_name := nullif(btrim(coalesce(new.organizer_contact_name, '')), '');
  new.organizer_contact_number := nullif(btrim(coalesce(new.organizer_contact_number, '')), '');
  new.description := nullif(btrim(coalesce(new.description, '')), '');
  new.gallery_object_keys := coalesce(new.gallery_object_keys, '{}'::text[]);

  if exists (
    select 1
    from unnest(new.gallery_object_keys) as key
    where key !~ '^[a-zA-Z0-9][a-zA-Z0-9/_.:-]*$'
  ) then
    raise exception 'Gallery image key is invalid';
  end if;

  if TG_OP = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    new.created_at := coalesce(new.created_at, now());
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  if new.cancelled_at is not null then
    new.enabled := false;
  end if;
  return new;
end;
$$;

drop trigger if exists events_before_write on public.events;
create trigger events_before_write
  before insert or update on public.events
  for each row execute procedure public.events_before_write();

create or replace function public.events_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    perform public.admin_write_audit(
      'event.delete',
      'event',
      old.id::text,
      jsonb_build_object('name', old.name)
    );
    return old;
  end if;
  perform public.admin_write_audit(
    case when TG_OP = 'INSERT' then 'event.create' else 'event.update' end,
    'event',
    new.id::text,
    jsonb_build_object('name', new.name, 'enabled', new.enabled)
  );
  return new;
end;
$$;

drop trigger if exists events_after_write on public.events;
create trigger events_after_write
  after insert or update or delete on public.events
  for each row execute procedure public.events_after_write();

alter table public.events enable row level security;

drop policy if exists events_public_read on public.events;
create policy events_public_read
  on public.events
  for select
  to anon, authenticated
  using (
    enabled
    and cancelled_at is null
    and display_starts_at <= now()
    and display_ends_at > now()
  );

drop policy if exists events_admin_read on public.events;
create policy events_admin_read
  on public.events
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists events_admin_write on public.events;
create policy events_admin_write
  on public.events
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace view public.active_events
with (security_invoker = true) as
select
  id,
  name,
  organizer_name,
  organizer_contact_name,
  organizer_contact_number,
  description,
  address,
  latitude,
  longitude,
  event_starts_at,
  event_ends_at,
  display_starts_at,
  display_ends_at,
  poster_object_key,
  gallery_object_keys
from public.events
where enabled
  and cancelled_at is null
  and display_starts_at <= now()
  and display_ends_at > now();

grant select on public.active_events to anon, authenticated;
grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;
