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
   - `VITE_SUPABASE_EDGE_URL` (optional for AI check-ins)
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

Recommended tables:

- `users`
- `posts`
- `comments`
- `reactions`
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
