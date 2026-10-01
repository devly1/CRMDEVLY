create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  niche text not null check (char_length(trim(niche)) between 1 and 70),
  status text not null default 'pendiente'
    check (status in ('pendiente', 'contactado', 'respondio', 'negociacion', 'cerrado')),
  website text not null default '',
  phone text not null default '',
  notes text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  contacted_at timestamptz,
  responded_at timestamptz
);

alter table public.prospects
  add column if not exists updated_by uuid references auth.users(id);

create index if not exists prospects_team_updated_idx
  on public.prospects (team_id, updated_at desc);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  prospect_id uuid not null,
  prospect_name text not null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text not null,
  action text not null check (action in ('created', 'updated', 'status_changed', 'contacted', 'responded', 'deleted')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_prospect_created_idx
  on public.activity_log (team_id, prospect_id, created_at desc);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'prospects'
    ) then
    alter publication supabase_realtime add table public.prospects;
  end if;
end;
$$;

create or replace function public.is_team_member(team_to_check uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.team_members
    where team_id = team_to_check
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.create_team(team_name_input text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  new_team_id uuid;
  generated_code text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if char_length(trim(coalesce(team_name_input, ''))) not between 2 and 80 then
    raise exception 'Team name must be between 2 and 80 characters';
  end if;

  if exists (select 1 from public.team_members where user_id = current_user_id) then
    raise exception 'This account already belongs to a team';
  end if;

  loop
    generated_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (select 1 from public.teams where invite_code = generated_code);
  end loop;

  insert into public.teams (name, invite_code, created_by)
  values (trim(team_name_input), generated_code, current_user_id)
  returning id into new_team_id;

  insert into public.team_members (team_id, user_id, role)
  values (new_team_id, current_user_id, 'owner');

  return new_team_id;
end;
$$;

create or replace function public.join_team(invite_code_input text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  target_team_id uuid;
  existing_team_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select team_id into existing_team_id
  from public.team_members
  where user_id = current_user_id;

  if existing_team_id is not null then
    raise exception 'This account already belongs to a team';
  end if;

  select id into target_team_id
  from public.teams
  where invite_code = upper(trim(coalesce(invite_code_input, '')));

  if target_team_id is null then
    raise exception 'Invalid team invitation code';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (target_team_id, current_user_id, 'member');

  return target_team_id;
end;
$$;

create or replace function public.set_prospect_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_prospect_actor()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_by := auth.uid();
  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.log_prospect_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  actor_address text;
  has_specific_change boolean := false;
begin
  select email into actor_address from auth.users where id = actor;
  actor_address := coalesce(actor_address, 'Usuario del equipo');

  if tg_op = 'DELETE' then
    insert into public.activity_log (team_id, prospect_id, prospect_name, actor_id, actor_email, action)
    values (old.team_id, old.id, old.name, actor, actor_address, 'deleted');
    return old;
  end if;

  if tg_op = 'INSERT' then
    insert into public.activity_log (team_id, prospect_id, prospect_name, actor_id, actor_email, action)
    values (new.team_id, new.id, new.name, actor, actor_address, 'created');

    if new.status <> 'pendiente' then
      insert into public.activity_log (team_id, prospect_id, prospect_name, actor_id, actor_email, action, details)
      values (new.team_id, new.id, new.name, actor, actor_address, 'status_changed', jsonb_build_object('from', null, 'to', new.status));
    end if;
    if new.contacted_at is not null then
      insert into public.activity_log (team_id, prospect_id, prospect_name, actor_id, actor_email, action, details)
      values (new.team_id, new.id, new.name, actor, actor_address, 'contacted', jsonb_build_object('contacted_at', new.contacted_at));
    end if;
    if new.responded_at is not null then
      insert into public.activity_log (team_id, prospect_id, prospect_name, actor_id, actor_email, action, details)
      values (new.team_id, new.id, new.name, actor, actor_address, 'responded', jsonb_build_object('responded_at', new.responded_at));
    end if;
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into public.activity_log (team_id, prospect_id, prospect_name, actor_id, actor_email, action, details)
    values (new.team_id, new.id, new.name, actor, actor_address, 'status_changed', jsonb_build_object('from', old.status, 'to', new.status));
    has_specific_change := true;
  end if;

  if old.contacted_at is distinct from new.contacted_at and new.contacted_at is not null then
    insert into public.activity_log (team_id, prospect_id, prospect_name, actor_id, actor_email, action, details)
    values (new.team_id, new.id, new.name, actor, actor_address, 'contacted', jsonb_build_object('contacted_at', new.contacted_at));
    has_specific_change := true;
  end if;

  if old.responded_at is distinct from new.responded_at and new.responded_at is not null then
    insert into public.activity_log (team_id, prospect_id, prospect_name, actor_id, actor_email, action, details)
    values (new.team_id, new.id, new.name, actor, actor_address, 'responded', jsonb_build_object('responded_at', new.responded_at));
    has_specific_change := true;
  end if;

  if not has_specific_change then
    insert into public.activity_log (team_id, prospect_id, prospect_name, actor_id, actor_email, action)
    values (new.team_id, new.id, new.name, actor, actor_address, 'updated');
  end if;

  return new;
end;
$$;

drop trigger if exists prospects_updated_at on public.prospects;
create trigger prospects_updated_at
before update on public.prospects
for each row execute function public.set_prospect_updated_at();

drop trigger if exists prospects_set_actor on public.prospects;
create trigger prospects_set_actor
before insert or update on public.prospects
for each row execute function public.set_prospect_actor();

drop trigger if exists prospects_activity_log on public.prospects;
create trigger prospects_activity_log
after insert or update or delete on public.prospects
for each row execute function public.log_prospect_activity();

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.prospects enable row level security;
alter table public.activity_log enable row level security;

drop policy if exists "Team members can read their team" on public.teams;
create policy "Team members can read their team"
  on public.teams for select to authenticated
  using (public.is_team_member(id));

drop policy if exists "Users can read memberships in their team" on public.team_members;
create policy "Users can read memberships in their team"
  on public.team_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_team_member(team_id));

drop policy if exists "Team members can read prospects" on public.prospects;
create policy "Team members can read prospects"
  on public.prospects for select to authenticated
  using (public.is_team_member(team_id));

drop policy if exists "Team members can add prospects" on public.prospects;
create policy "Team members can add prospects"
  on public.prospects for insert to authenticated
  with check (public.is_team_member(team_id) and created_by = (select auth.uid()));

drop policy if exists "Team members can update prospects" on public.prospects;
create policy "Team members can update prospects"
  on public.prospects for update to authenticated
  using (public.is_team_member(team_id))
  with check (public.is_team_member(team_id));

drop policy if exists "Team members can delete prospects" on public.prospects;
create policy "Team members can delete prospects"
  on public.prospects for delete to authenticated
  using (public.is_team_member(team_id));

drop policy if exists "Team members can read activity" on public.activity_log;
create policy "Team members can read activity"
  on public.activity_log for select to authenticated
  using (public.is_team_member(team_id));

grant select on public.teams, public.team_members to authenticated;
grant select, insert, update, delete on public.prospects to authenticated;
grant select on public.activity_log to authenticated;
revoke all on function public.create_team(text) from public, anon;
revoke all on function public.join_team(text) from public, anon;
grant execute on function public.create_team(text) to authenticated;
grant execute on function public.join_team(text) to authenticated;
revoke all on function public.is_team_member(uuid) from public, anon;
grant execute on function public.is_team_member(uuid) to authenticated;
revoke all on function public.set_prospect_actor() from public, anon, authenticated;
revoke all on function public.log_prospect_activity() from public, anon, authenticated;
