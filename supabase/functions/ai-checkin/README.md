# AI Check-in Edge Function

This authenticated Supabase Edge Function validates the caller's session, checks messages for crisis language, and requests a supportive response from Gemini.

## Configuration

Set these Supabase Edge Function secrets:

- `GEMINI_API_KEY` — Gemini API key; keep it server-side.
- `GEMINI_MODEL` — optional Gemini model ID. Defaults to `gemini-2.5-flash`.

Supabase provides `SUPABASE_URL` and `SUPABASE_ANON_KEY` to Edge Functions.

## Endpoint

Deploy this function as `ai-checkin` so it matches the website's `supabase.functions.invoke('ai-checkin', ...)` call.

Set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) in the project's Edge Function secrets, then deploy with:

```sh
supabase functions deploy ai-checkin --project-ref <your-project-ref>
```

The request requires a valid Supabase bearer token and a JSON body:

```json
{ "message": "I feel anxious and stuck." }
```

Successful responses contain `reply`, `safety_flag`, and `warning_message`. The Gemini request is attempted once with a 45-second timeout. Quota errors (`429`), overload errors (`503`), invalid API-key/configuration errors, and network timeouts (`504`) are returned as distinct safe error codes and user-facing messages. Upstream error bodies, API keys, and check-in messages are not logged or returned.

Gemini uses the documented `models.generateContent` endpoint:
`https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
