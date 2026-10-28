-- =========================================================
-- EXTENSIONS
-- =========================================================
create extension if not exists "pgcrypto";

-- =========================================================
-- USERS (PROFILE TABLE LINKED TO AUTH)
-- =========================================================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  username text,
  display_name text,
  bio text,
  role text not null default 'user',
  created_at timestamptz not null default now()
);

-- =========================================================
-- POSTS
-- =========================================================
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  content text not null,
  anonymous boolean not null default false,
  supporter_response boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- =========================================================
-- COMMENTS
-- =========================================================
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  parent_comment_id uuid references public.comments(id) on delete set null,
  content text not null,
  anonymous boolean not null default false,
  created_at timestamptz not null default now()
);

-- =========================================================
-- REACTIONS
-- =========================================================
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  type text not null default 'like',
  created_at timestamptz not null default now()
);

-- =========================================================
-- IN-APP NOTIFICATIONS
-- =========================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  actor_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('post_comment', 'comment_reply', 'post_reaction')),
  post_id uuid not null references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_created_at_idx
on public.notifications (user_id, created_at desc);

-- =========================================================
-- MOOD LOGS
-- =========================================================
create table if not exists public.mood_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  mood text not null,
  notes text,
  logged_at date not null,
  created_at timestamptz not null default now()
);

-- =========================================================
-- AI CHECKINS
-- =========================================================
create table if not exists public.ai_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  user_prompt text not null,
  ai_response text not null,
  safety_flag boolean not null default false,
  warning_message text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- SUPPORTER APPLICATIONS
-- =========================================================
create table if not exists public.supporter_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  status text not null default 'pending',
  story text,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================================================
-- AUTO PROFILE CREATION ON SIGNUP
-- =========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, role)
  values (
    new.id,
    coalesce(new.email, ''),
    'user'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.admin_update_user_role(p_target_user_id uuid, p_new_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_role text;
  admin_count integer;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can change account roles' using errcode = '42501';
  end if;

  if p_new_role not in ('user', 'supporter', 'therapist', 'admin') then
    raise exception 'Invalid account role';
  end if;

  perform pg_advisory_xact_lock(701202610);

  select u.role into current_role
  from public.users u
  where u.id = p_target_user_id
  for update;

  if not found then
    raise exception 'Account not found';
  end if;

  if current_role = 'admin' and p_new_role <> 'admin' then
    select count(*) into admin_count
    from public.users u
    where u.role = 'admin';

    if admin_count <= 1 then
      raise exception 'The last administrator cannot be removed';
    end if;
  end if;

  if p_target_user_id = auth.uid() and p_new_role <> current_role then
    raise exception 'Administrators cannot change their own account role';
  end if;

  update public.users
  set role = p_new_role
  where id = p_target_user_id;
end;
$$;

revoke all on function public.admin_update_user_role(uuid, text) from public;
grant execute on function public.admin_update_user_role(uuid, text) to authenticated;

create or replace function public.admin_review_supporter_application(p_application_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  applicant_id uuid;
  application_status text;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can review applications' using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid application decision';
  end if;

  select a.user_id, a.status into applicant_id, application_status
  from public.supporter_applications a
  where a.id = p_application_id
  for update;

  if not found then
    raise exception 'Application not found';
  end if;

  if application_status <> 'pending' then
    raise exception 'This application has already been reviewed';
  end if;

  update public.supporter_applications
  set status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_application_id;

  if p_decision = 'approved' then
    update public.users
    set role = 'supporter'
    where id = applicant_id
      and role = 'user';
  end if;
end;
$$;

revoke all on function public.admin_review_supporter_application(uuid, text) from public;
grant execute on function public.admin_review_supporter_application(uuid, text) to authenticated;

-- =========================================================
-- NOTIFICATION CREATION
-- =========================================================
create or replace function public.notify_comment_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_owner uuid;
  parent_owner uuid;
begin
  if new.post_id is null or new.user_id is null then
    return new;
  end if;

  select p.user_id into post_owner
  from public.posts p
  where p.id = new.post_id;

  if new.parent_comment_id is not null then
    select c.user_id into parent_owner
    from public.comments c
    where c.id = new.parent_comment_id;

    if parent_owner is not null and parent_owner <> new.user_id then
      insert into public.notifications (user_id, actor_id, type, post_id, comment_id)
      values (parent_owner, new.user_id, 'comment_reply', new.post_id, new.id);
    end if;
  end if;

  if post_owner is not null
    and post_owner <> new.user_id
    and post_owner is distinct from parent_owner then
    insert into public.notifications (user_id, actor_id, type, post_id, comment_id)
    values (post_owner, new.user_id, 'post_comment', new.post_id, new.id);
  end if;

  return new;
end;
$$;

create or replace function public.notify_post_reaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_owner uuid;
begin
  if new.post_id is null or new.user_id is null then
    return new;
  end if;

  select p.user_id into post_owner
  from public.posts p
  where p.id = new.post_id;

  if post_owner is not null and post_owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, post_id)
    values (post_owner, new.user_id, 'post_reaction', new.post_id);
  end if;

  return new;
end;
$$;

drop trigger if exists comments_create_notifications on public.comments;
create trigger comments_create_notifications
after insert on public.comments
for each row
execute function public.notify_comment_participants();

drop trigger if exists reactions_create_notifications on public.reactions;
create trigger reactions_create_notifications
after insert on public.reactions
for each row
execute function public.notify_post_reaction();

-- =========================================================
-- RLS: USERS
-- =========================================================
alter table public.users enable row level security;

create policy "users_select"
on public.users
for select
using (true);

create policy "users_insert"
on public.users
for insert
with check (true);

-- =========================================================
-- RLS: POSTS
-- =========================================================
alter table public.posts enable row level security;

create policy "posts_select"
on public.posts
for select
using (true);

create policy "posts_insert"
on public.posts
for insert
with check (auth.uid() = user_id);

create policy "posts_update"
on public.posts
for update
using (auth.uid() = user_id);

drop policy if exists "posts_update_admin" on public.posts;
create policy "posts_update_admin"
on public.posts
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own"
on public.posts
for delete
using (auth.uid() = user_id);

drop policy if exists "posts_delete_admin" on public.posts;
create policy "posts_delete_admin"
on public.posts
for delete
using (public.is_admin());

-- =========================================================
-- RLS: COMMENTS
-- =========================================================
alter table public.comments enable row level security;

create policy "comments_select"
on public.comments
for select
using (true);

create policy "comments_insert"
on public.comments
for insert
with check (auth.uid() = user_id);

drop policy if exists "comments_delete_admin" on public.comments;
create policy "comments_delete_admin"
on public.comments
for delete
using (public.is_admin());

-- =========================================================
-- RLS: REACTIONS
-- =========================================================
alter table public.reactions enable row level security;

create policy "reactions_select"
on public.reactions
for select
using (true);

create policy "reactions_insert"
on public.reactions
for insert
with check (auth.uid() = user_id);

-- =========================================================
-- RLS: NOTIFICATIONS
-- =========================================================
alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications
for select
using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
on public.notifications
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

-- =========================================================
-- RLS: MOOD LOGS
-- =========================================================
alter table public.mood_logs enable row level security;

create policy "mood_all"
on public.mood_logs
for all
using (auth.uid() = user_id);

-- =========================================================
-- RLS: AI CHECKINS
-- =========================================================
alter table public.ai_checkins enable row level security;

create policy "checkins_all"
on public.ai_checkins
for all
using (auth.uid() = user_id);

-- =========================================================
-- RLS: SUPPORTER APPLICATIONS
-- =========================================================
alter table public.supporter_applications enable row level security;

drop policy if exists "applications_all" on public.supporter_applications;
drop policy if exists "applications_select_own" on public.supporter_applications;
create policy "applications_select_own"
on public.supporter_applications
for select
using (auth.uid() = user_id);

drop policy if exists "applications_insert_own" on public.supporter_applications;
create policy "applications_insert_own"
on public.supporter_applications
for insert
with check (auth.uid() = user_id);

drop policy if exists "applications_delete_own" on public.supporter_applications;
create policy "applications_delete_own"
on public.supporter_applications
for delete
using (auth.uid() = user_id);

drop policy if exists "applications_select_admin" on public.supporter_applications;
create policy "applications_select_admin"
on public.supporter_applications
for select
using (public.is_admin());
