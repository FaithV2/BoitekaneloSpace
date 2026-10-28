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
