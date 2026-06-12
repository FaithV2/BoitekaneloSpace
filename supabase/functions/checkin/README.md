# Boitekanelo Space AI Check-in Edge Function

## Purpose

This Supabase Edge Function receives a user check-in prompt, runs a safety scan, generates a supportive AI response, and stores the result in the `ai_checkins` table.

## Environment Variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

## Request

POST /checkin

Headers:
- Authorization: Bearer <access_token>
- Content-Type: application/json

Body:
```json
{
  "prompt": "I feel anxious and stuck.",
  "mood": "anxious"
}
```

## Response

```json
{
  "ai_response": "...",
  "safety_flag": false,
  "warning_message": null
}
```
