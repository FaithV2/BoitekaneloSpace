# Boitekanelo Space

A calm mental wellness social platform built with React + Vite and Supabase.

## Project overview

- Frontend: React + Vite
- Backend: Supabase Auth, PostgreSQL, Realtime, Edge Functions
- Features: sign-up/login, thread feed, anonymous posts, comments, mood tracking, AI check-ins, supporter applications, and safety messaging

## Getting started

1. Copy `.env.example` to `.env`.
2. Add your Supabase project values:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   The frontend uses Supabase's public anon key, protected by database RLS. Never put a service-role key, AI provider key, or other secret in a `VITE_` variable; Vite includes those values in the browser bundle.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the app:
   ```bash
   npm run dev
   ```
5. Open the local URL shown in the terminal.

## Supabase setup

Use `supabase/schema.sql` to create the database tables.

For an existing project, apply the migrations in order in the Supabase SQL Editor:

1. `supabase/migrations/20261028000000_notifications.sql` — private, real-time in-app notifications.
2. `supabase/migrations/20261028010000_posts_delete_own.sql` — lets users delete only their own posts.
3. `supabase/migrations/20261028020000_admin_roles_moderation.sql` — enables admin application review, account role management, and post/comment moderation. Therapist roles are manually assigned by admins after direct recruitment; the app does not collect therapist credentials.

Admins can edit/remove any post; other users can edit/remove only their own. Email notifications are not enabled.

## Admin and therapist accounts

The first admin signs in through the regular `/auth` page. Create that account in Supabase Authentication first, then assign its existing profile the admin role once from the Supabase SQL Editor:

```sql
update public.users
set role = 'admin'
where email = 'admin@example.com';
```

Replace the example address with the admin account email, then sign in normally. Admins can invite therapist accounts from **Admin → Accounts**. Set the `APP_URL` Edge Function secret to your application origin and configure Supabase Auth email delivery so invitations can be received. The invitation function checks the caller’s admin role server-side; never expose the service-role key in the browser.

Deploy the invitation function after applying the migrations:

```sh
supabase secrets set APP_URL=https://your-app.example.com --project-ref <your-project-ref>
supabase functions deploy invite-therapist --project-ref <your-project-ref>
```

To allow users to sign up without confirming their email, disable **Confirm email** under **Authentication → Providers → Email** in the Supabase dashboard. The local Supabase configuration in `supabase/config.toml` also disables email confirmations for local development.

Password recovery uses the `/reset-password` route. Add your app's origin (for example, `http://localhost:5173` during development and your deployed site origin in production) to **Authentication → URL Configuration → Redirect URLs** in the Supabase dashboard.

Recommended tables:

- `users`
- `posts`
- `comments`
- `reactions`
- `notifications`
- `mood_logs`
- `ai_checkins`
- `supporter_applications`

## Edge function

The AI check-in function lives in `supabase/functions/checkin/index.ts`.

### Required environment variables for functions

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

## Scripts

- `npm run dev` — start Vite development server
- `npm run build` — build production files
- `npm run preview` — preview the build locally

## Folder structure

- `src/App.jsx` — app and routing
- `src/hooks/useAuth.js` — auth context and Supabase session management
- `src/lib/supabaseClient.js` — Supabase client
- `src/pages/` — main app pages
- `src/styles/global.css` — theme and common UI styles
- `supabase/schema.sql` — database schema
- `supabase/functions/checkin/` — AI check-in Edge Function

## Notes

- The app is intentionally calm, minimal, and supportive.
- The check-in flow is built to avoid medical diagnosis and stay non-clinical.
- Supporter applications and admin review are designed to keep the community safe.
