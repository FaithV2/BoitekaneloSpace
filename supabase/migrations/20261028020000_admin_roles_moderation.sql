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

drop policy if exists "posts_update_admin" on public.posts;
create policy "posts_update_admin"
on public.posts
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "posts_delete_admin" on public.posts;
create policy "posts_delete_admin"
on public.posts
for delete
using (public.is_admin());

drop policy if exists "comments_delete_admin" on public.comments;
create policy "comments_delete_admin"
on public.comments
for delete
using (public.is_admin());

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
