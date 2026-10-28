import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Only POST requests are allowed.' }, 405)
  }

  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Sign in as an administrator to invite a therapist.' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const appUrl = Deno.env.get('APP_URL')

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !appUrl) {
    console.error('Therapist invitation is missing server configuration.')
    return jsonResponse({ error: 'Therapist invitations are not configured yet.' }, 500)
  }

  let body: { email?: unknown; display_name?: unknown }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Provide a valid email address and display name.' }, 400)
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : ''
  if (
    email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || displayName.length > 100
  ) {
    return jsonResponse({ error: 'Provide a valid email address and a display name under 100 characters.' }, 400)
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const { data: callerData, error: callerError } = await callerClient.auth.getUser(authorization.slice('Bearer '.length))
  if (callerError || !callerData.user) {
    return jsonResponse({ error: 'Your session is invalid or has expired. Please sign in again.' }, 401)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const { data: adminProfile, error: profileError } = await adminClient
    .from('users')
    .select('role')
    .eq('id', callerData.user.id)
    .single()

  if (profileError || adminProfile?.role !== 'admin') {
    return jsonResponse({ error: 'Only administrators can invite therapists.' }, 403)
  }

  let inviteResult
  try {
    inviteResult = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { display_name: displayName },
      redirectTo: new URL('/reset-password', appUrl).toString()
    })
  } catch (error) {
    console.error('Therapist invitation request failed:', error)
    return jsonResponse({ error: 'The therapist invitation couldn’t be sent. Please try again.' }, 500)
  }

  if (inviteResult.error || !inviteResult.data.user) {
    const message = inviteResult.error?.message.toLowerCase() ?? ''
    if (message.includes('already') || message.includes('registered') || message.includes('exists')) {
      return jsonResponse({ error: 'An account already exists for that email. You can find it in Accounts and assign the therapist role after confirming their identity.' }, 409)
    }

    console.error('Therapist invitation failed:', inviteResult.error?.message ?? 'No user returned.')
    return jsonResponse({ error: 'The therapist invitation couldn’t be sent. Please try again.' }, 500)
  }

  const invitedUser = inviteResult.data.user
  const { error: profileUpsertError } = await adminClient
    .from('users')
    .upsert({
      id: invitedUser.id,
      email,
      display_name: displayName || null,
      role: 'therapist'
    }, { onConflict: 'id' })

  if (profileUpsertError) {
    console.error('Therapist profile creation failed; removing incomplete invite:', profileUpsertError.message)
    const { error: rollbackError } = await adminClient.auth.admin.deleteUser(invitedUser.id)
    if (rollbackError) console.error('Unable to remove incomplete therapist invite:', rollbackError.message)
    return jsonResponse({ error: 'The therapist account couldn’t be completed. Please try again.' }, 500)
  }

  return jsonResponse({
    invited: true,
    email,
    display_name: displayName || email,
    user_id: invitedUser.id
  })
})
