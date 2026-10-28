import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const GEMINI_TIMEOUT_MS = 45_000
const DEFAULT_MODEL = 'gemini-2.5-flash'

const safetyMarkers = [
  'suicide',
  'self harm',
  'kill myself',
  'die',
  'hurt myself',
  'end my life',
  "i want to die",
  "can't go on",
  'cant go on',
  'no reason to live',
  'numb',
  'never go on',
  'die alone'
]

class CheckinError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number
  ) {
    super(message)
  }
}

type GeminiPayload = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
  error?: {
    status?: unknown
    message?: unknown
    details?: Array<{ reason?: unknown }>
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

function scanPrompt(message: string) {
  const normalized = message.toLowerCase()
  const flagged = safetyMarkers.some((marker) => normalized.includes(marker))

  return {
    safety_flag: flagged,
    warning_message: flagged
      ? 'If you are in immediate danger, please reach out to local emergency services or a crisis hotline now.'
      : null
  }
}

async function generateReply(message: string, apiKey: string, model: string) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)

  try {
    let response: Response
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: 'You are a calm, gentle mental wellness companion. Offer supportive reflection and coping suggestions without diagnosing or giving medical advice. If someone may be in immediate danger, encourage them to contact local emergency services or a crisis hotline.'
            }]
          },
          contents: [{ role: 'user', parts: [{ text: message }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 350 }
        }),
        signal: controller.signal
      })
    } catch {
      if (controller.signal.aborted) {
        throw new CheckinError(
          'The check-in service timed out. Please try again shortly.',
          'GEMINI_TIMEOUT',
          504
        )
      }

      throw new CheckinError(
        'We could not connect to the check-in service. Please try again.',
        'GEMINI_CONNECTION_FAILED',
        502
      )
    }

    let payload: GeminiPayload | null = null
    try {
      payload = await response.json() as GeminiPayload
    } catch {
      if (controller.signal.aborted) {
        throw new CheckinError(
          'The check-in service timed out. Please try again shortly.',
          'GEMINI_TIMEOUT',
          504
        )
      }
    }

    if (!response.ok) {
      const googleError = payload?.error
      const googleStatus = typeof googleError?.status === 'string'
        ? googleError.status.toUpperCase()
        : ''
      const googleMessage = typeof googleError?.message === 'string'
        ? googleError.message.toLowerCase()
        : ''
      const errorReasons = Array.isArray(googleError?.details)
        ? googleError.details
          .map((detail: { reason?: unknown }) => detail?.reason)
          .filter((reason: unknown): reason is string => typeof reason === 'string')
          .map((reason: string) => reason.toUpperCase())
        : []
      const invalidApiKey = response.status === 401
        || response.status === 403
        || googleStatus === 'UNAUTHENTICATED'
        || errorReasons.includes('API_KEY_INVALID')
        || googleMessage.includes('api key not valid')

      if (response.status === 429) {
        throw new CheckinError(
          'The AI check-in has reached its current usage limit. Please try again later.',
          'GEMINI_QUOTA_EXCEEDED',
          429
        )
      }

      if (response.status === 503) {
        throw new CheckinError(
          'The AI check-in service is temporarily overloaded. Please try again shortly.',
          'GEMINI_OVERLOADED',
          503
        )
      }

      if (invalidApiKey) {
        throw new CheckinError(
          'The AI check-in service is not configured correctly. Please contact support.',
          'GEMINI_CONFIGURATION_ERROR',
          502
        )
      }

      throw new CheckinError(
        'The check-in service could not complete your request. Please try again.',
        'GEMINI_REQUEST_FAILED',
        502
      )
    }

    const reply = payload?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? '')
      .join('')
      .trim()

    if (typeof reply !== 'string' || !reply) {
      throw new CheckinError(
        'The check-in service returned an empty response. Please try again.',
        'GEMINI_EMPTY_RESPONSE',
        502
      )
    }

    return reply
  } finally {
    clearTimeout(timeout)
  }
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Only POST requests are allowed.', code: 'METHOD_NOT_ALLOWED' }, 405)
  }

  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) {
    return jsonResponse({ error: 'Please sign in again before sending a check-in.', code: 'AUTH_REQUIRED' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: 'The check-in service is not configured. Please try again later.', code: 'SERVICE_CONFIGURATION_ERROR' }, 500)
  }

  if (!geminiApiKey) {
    return jsonResponse({ error: 'The check-in service is not configured. Please try again later.', code: 'SERVICE_CONFIGURATION_ERROR' }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const { data: userData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !userData.user) {
    return jsonResponse({ error: 'Your session has expired. Please sign in again.', code: 'AUTH_REQUIRED' }, 401)
  }

  let body: { message?: unknown }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Please enter a check-in message and try again.', code: 'INVALID_REQUEST' }, 400)
  }

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) {
    return jsonResponse({ error: 'Please enter a check-in message and try again.', code: 'MESSAGE_REQUIRED' }, 400)
  }

  if (message.length > 5000) {
    return jsonResponse({ error: 'Your check-in is too long. Please shorten it and try again.', code: 'MESSAGE_TOO_LONG' }, 400)
  }

  const safety = scanPrompt(message)
  if (safety.safety_flag) {
    return jsonResponse({
      reply: safety.warning_message,
      ...safety
    })
  }

  try {
    const reply = await generateReply(
      message,
      geminiApiKey,
      Deno.env.get('GEMINI_MODEL')?.trim() || DEFAULT_MODEL
    )

    return jsonResponse({ reply, ...safety })
  } catch (error) {
    if (error instanceof CheckinError) {
      return jsonResponse({ error: error.message, code: error.code }, error.status)
    }

    return jsonResponse({
      error: 'The check-in service encountered an unexpected problem. Please try again.',
      code: 'CHECKIN_FAILED'
    }, 500)
  }
})
