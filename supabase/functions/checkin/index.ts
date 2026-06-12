import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const openAiKey = Deno.env.get('OPENAI_API_KEY')

const supabase = createClient(supabaseUrl ?? '', supabaseKey ?? '')

const safetyMarkers = [
  'suicide',
  'self harm',
  'kill myself',
  'die',
  'hurt myself',
  'end my life',
  'can\'t go on'
]

function scanPrompt(prompt: string) {
  const normalized = prompt.toLowerCase()
  const matches = safetyMarkers.filter((marker) => normalized.includes(marker))
  if (matches.length > 0) {
    return {
      safety_flag: true,
      warning_message:
        'If you are in immediate danger, please reach out to local emergency services or a crisis hotline now.'
    }
  }
  return { safety_flag: false, warning_message: null }
}

async function callAI(prompt: string) {
  if (!openAiKey) {
    return 'OpenAI key is not configured. Please set OPENAI_API_KEY in your environment.'
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a calm, gentle mental wellness companion. Offer supportive reflection and coping suggestions without diagnosing or giving medical advice.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 350
    })
  })

  const data = await response.json()
  return data?.choices?.[0]?.message?.content ?? 'I am here to listen. Thank you for sharing.'
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Only POST requests are allowed.' }), { status: 405 })
  }

  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    return new Response(JSON.stringify({ error: 'Authorization header is required.' }), { status: 401 })
  }

  const { data: userData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Invalid session.' }), { status: 401 })
  }

  const body = await req.json()
  const prompt = String(body.prompt ?? '')
  const mood = String(body.mood ?? 'reflective')

  const safety = scanPrompt(prompt)
  const aiPrompt = `User mood: ${mood}\nUser says: ${prompt}\nRespond with validation, grounding ideas, and encouragement in a calm, non-clinical way. Do not diagnose.`
  const aiResponse = await callAI(aiPrompt)

  const { error } = await supabase.from('ai_checkins').insert([
    {
      user_id: userData.user.id,
      user_prompt: prompt,
      ai_response: aiResponse,
      safety_flag: safety.safety_flag,
      warning_message: safety.warning_message,
      created_at: new Date().toISOString()
    }
  ])

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ ai_response: aiResponse, ...safety }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
