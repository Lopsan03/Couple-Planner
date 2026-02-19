-- Required extension for UUID generation
create extension if not exists pgcrypto;

-- ==============================
-- USERS (app profile)
-- ==============================
create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  google_id text,
  email text not null unique,
  username text not null unique,
  avatar_url text,
  birthday date,
  phone text,
  planner_id uuid,
  created_at timestamptz not null default now()
);

alter table if exists public.app_users
  add column if not exists birthday date;

alter table if exists public.app_users
  add column if not exists phone text;

-- ==============================
-- PLANNERS
-- ==============================
create table if not exists public.planners (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.app_users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.create_planner_for_current_user()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_planner_id uuid;
  uid uuid;
begin
  uid := auth.uid();

  if uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.planners (owner_user_id)
  values (uid)
  returning id into new_planner_id;

  return new_planner_id;
end;
$$;

revoke all on function public.create_planner_for_current_user() from public;
grant execute on function public.create_planner_for_current_user() to authenticated;

create or replace function public.save_planner_state(p_planner_id uuid, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  uid := auth.uid();

  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.planner_members pm
    where pm.planner_id = p_planner_id
      and pm.user_id = uid
  ) then
    raise exception 'Not authorized for this planner';
  end if;

  insert into public.planner_state (planner_id, data)
  values (p_planner_id, p_data)
  on conflict (planner_id)
  do update set
    data = excluded.data,
    updated_at = now();
end;
$$;

revoke all on function public.save_planner_state(uuid, jsonb) from public;
grant execute on function public.save_planner_state(uuid, jsonb) to authenticated;

-- ==============================
-- INVITE CODES (single-use)
-- ==============================
create table if not exists public.invite_codes (
  code text primary key,
  planner_id uuid not null references public.planners(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'used')),
  used_by uuid references public.app_users(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists invite_codes_planner_id_idx on public.invite_codes(planner_id);

-- ==============================
-- MEMBERS (max 2 per planner)
-- ==============================
create table if not exists public.planner_members (
  planner_id uuid not null references public.planners(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  member_slot smallint not null check (member_slot in (1, 2)),
  joined_at timestamptz not null default now(),
  primary key (planner_id, user_id),
  unique (planner_id, member_slot),
  unique (user_id)
);

create index if not exists planner_members_planner_id_idx on public.planner_members(planner_id);

-- Enforce max 2 members per planner at DB level too
create or replace function public.enforce_planner_member_limit()
returns trigger
language plpgsql
as $$
declare
  member_count integer;
begin
  select count(*) into member_count
  from public.planner_members
  where planner_id = new.planner_id;

  if member_count >= 2 then
    raise exception 'Planner already has 2 linked users';
  end if;

  return new;
end;
$$;

drop trigger if exists planner_member_limit_trigger on public.planner_members;
create trigger planner_member_limit_trigger
before insert on public.planner_members
for each row execute function public.enforce_planner_member_limit();

-- ==============================
-- PLANNER STATE (main app data)
-- ==============================
create table if not exists public.planner_state (
  planner_id uuid primary key references public.planners(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backward compatibility: if an older planner_state table exists (using `id`),
-- ensure required columns and constraints for planner-scoped sync are present.
alter table if exists public.planner_state
  add column if not exists planner_id uuid;

alter table if exists public.planner_state
  add column if not exists data jsonb;

alter table if exists public.planner_state
  add column if not exists created_at timestamptz not null default now();

alter table if exists public.planner_state
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists planner_state_planner_id_key
  on public.planner_state(planner_id);

-- If legacy schema had `id` as PK, migrate to planner_id PK so upserts work.
do $$
declare
  has_id_column boolean;
  current_pk text;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'planner_state'
      and column_name = 'id'
  ) into has_id_column;

  if has_id_column then
    select c.conname
    into current_pk
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'planner_state'
      and c.contype = 'p'
    limit 1;

    if current_pk is not null then
      execute format('alter table public.planner_state drop constraint %I', current_pk);
    end if;

    alter table public.planner_state drop column if exists id;
  end if;
end
$$;

-- Remove invalid legacy rows that cannot be linked to a planner
delete from public.planner_state where planner_id is null;

alter table public.planner_state
  alter column planner_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'planner_state_pkey'
      and conrelid = 'public.planner_state'::regclass
  ) then
    alter table public.planner_state add constraint planner_state_pkey primary key (planner_id);
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists planner_state_set_updated_at on public.planner_state;
create trigger planner_state_set_updated_at
before update on public.planner_state
for each row execute function public.set_updated_at();

-- Realtime
alter table public.planner_state replica identity full;
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'planner_state'
  ) then
    alter publication supabase_realtime add table public.planner_state;
  end if;
end
$$;

-- ==============================
-- RELATION CONSISTENCY
-- ==============================
alter table public.app_users
  drop constraint if exists app_users_planner_id_fkey;

alter table public.app_users
  add constraint app_users_planner_id_fkey
  foreign key (planner_id) references public.planners(id) on delete set null;

alter table public.planner_state
  drop constraint if exists planner_state_planner_id_fkey;

alter table public.planner_state
  add constraint planner_state_planner_id_fkey
  foreign key (planner_id) references public.planners(id) on delete cascade;

-- ==============================
-- RLS
-- ==============================
alter table public.app_users enable row level security;
alter table public.planners enable row level security;
alter table public.invite_codes enable row level security;
alter table public.planner_members enable row level security;
alter table public.planner_state enable row level security;

-- Ensure API roles can access tables (RLS still enforces row safety)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- app_users
drop policy if exists "app_users_select_authenticated" on public.app_users;
create policy "app_users_select_authenticated"
on public.app_users
for select
using (auth.uid() is not null);

drop policy if exists "app_users_insert_own" on public.app_users;
create policy "app_users_insert_own"
on public.app_users
for insert
with check (auth.uid() = id);

drop policy if exists "app_users_update_own" on public.app_users;
create policy "app_users_update_own"
on public.app_users
for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- planners
drop policy if exists "planners_select_members" on public.planners;
create policy "planners_select_members"
on public.planners
for select
using (
  exists (
    select 1 from public.planner_members pm
    where pm.planner_id = planners.id and pm.user_id = auth.uid()
  )
);

drop policy if exists "planners_insert_owner" on public.planners;
create policy "planners_insert_owner"
on public.planners
for insert
with check (
  auth.uid() is not null
  and owner_user_id = auth.uid()
);

-- planner_members
drop policy if exists "planner_members_select_authenticated" on public.planner_members;
create policy "planner_members_select_authenticated"
on public.planner_members
for select
using (auth.uid() is not null);

drop policy if exists "planner_members_insert_self" on public.planner_members;
create policy "planner_members_insert_self"
on public.planner_members
for insert
with check (user_id = auth.uid());

-- invite_codes
drop policy if exists "invite_codes_select_authenticated" on public.invite_codes;
create policy "invite_codes_select_authenticated"
on public.invite_codes
for select
using (auth.uid() is not null);

drop policy if exists "invite_codes_insert_members" on public.invite_codes;
create policy "invite_codes_insert_members"
on public.invite_codes
for insert
with check (
  exists (
    select 1
    from public.planner_members pm
    where pm.planner_id = invite_codes.planner_id
      and pm.user_id = auth.uid()
  )
);

drop policy if exists "invite_codes_update_authenticated" on public.invite_codes;
create policy "invite_codes_update_authenticated"
on public.invite_codes
for update
using (auth.uid() is not null)
with check (auth.uid() is not null);

-- planner_state
drop policy if exists "planner_state_select_members" on public.planner_state;
create policy "planner_state_select_members"
on public.planner_state
for select
using (
  exists (
    select 1 from public.planner_members pm
    where pm.planner_id = planner_state.planner_id and pm.user_id = auth.uid()
  )
);

drop policy if exists "planner_state_insert_members" on public.planner_state;
create policy "planner_state_insert_members"
on public.planner_state
for insert
with check (
  exists (
    select 1 from public.planner_members pm
    where pm.planner_id = planner_state.planner_id and pm.user_id = auth.uid()
  )
);

drop policy if exists "planner_state_update_members" on public.planner_state;
create policy "planner_state_update_members"
on public.planner_state
for update
using (
  exists (
    select 1 from public.planner_members pm
    where pm.planner_id = planner_state.planner_id and pm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.planner_members pm
    where pm.planner_id = planner_state.planner_id and pm.user_id = auth.uid()
  )
);
