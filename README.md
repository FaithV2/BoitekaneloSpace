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



## Admin and therapist accounts




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

- `supabase/functions/checkin/` — AI check-in Edge Function

## Notes

- The app is intentionally calm, minimal, and supportive.
- The check-in flow is built to avoid medical diagnosis and stay non-clinical.
- Supporter applications and admin review are designed to keep the community safe.
