update public.users
set role = 'admin'
where lower(email) = lower('admin@example.com')
returning id, email, role;# Therapist invitations

This authenticated Edge Function lets administrators invite therapists to join Boitekanelo Space.

## Configuration

Supabase Edge Functions provide `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
Set `APP_URL` to the public application origin. The service-role key must remain server-side.

Configure Supabase Auth email delivery to send invitations. Deploy the function with:

```sh
supabase secrets set APP_URL=https://your-app.example.com --project-ref <your-project-ref>
supabase functions deploy invite-therapist --project-ref <your-project-ref>
```

## Authorization and behavior

The function validates the caller’s Supabase session and checks their current `public.users.role` using the service role. Only admins can invite. It invites the supplied email, creates/updates the matching profile with the `therapist` role, and rolls back the Auth invite if profile creation fails. The invitation link returns to `/reset-password`, where the invitee sets their password.

The request body accepts `email` and an optional `display_name`. Successful invitations require the invite email link to be configured and deliverable by Supabase Auth.
