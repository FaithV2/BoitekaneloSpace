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

create policy "applications_all"
on public.supporter_applications
for all
using (auth.uid() = user_id);
