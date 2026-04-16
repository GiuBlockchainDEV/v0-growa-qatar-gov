import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function isMissingColumnError(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('column') ||
    normalized.includes('schema cache') ||
    normalized.includes('does not exist') ||
    normalized.includes('could not find')
  )
}

export async function GET(_request: Request) {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get farms for user's organizations
  const firstAttempt = await supabase
    .from('farms')
    .select('*')
    .order('created_at', { ascending: false })

  if (!firstAttempt.error) {
    return NextResponse.json(firstAttempt.data || [])
  }

  if (!isMissingColumnError(firstAttempt.error.message)) {
    return NextResponse.json({ error: firstAttempt.error.message }, { status: 500 })
  }

  const secondAttempt = await supabase
    .from('farms')
    .select('*')
    .order('updated_at', { ascending: false })

  if (!secondAttempt.error) {
    return NextResponse.json(secondAttempt.data || [])
  }

  if (!isMissingColumnError(secondAttempt.error.message)) {
    return NextResponse.json({ error: secondAttempt.error.message }, { status: 500 })
  }

  const thirdAttempt = await supabase
    .from('farms')
    .select('*')

  if (thirdAttempt.error) {
    return NextResponse.json({ error: thirdAttempt.error.message }, { status: 500 })
  }

  return NextResponse.json(thirdAttempt.data || [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { name_en, name_ar, location, type, size_hectares, organization_id } = body

  // Insert new farm with schema-compatible fallback (created_by optional).
  const firstAttempt = await supabase
    .from('farms')
    .insert({
      name_en,
      name_ar,
      location,
      type,
      size_hectares,
      organization_id,
      created_by: user.id,
    })
    .select()
    .single()

  if (!firstAttempt.error) {
    return NextResponse.json(firstAttempt.data, { status: 201 })
  }

  if (!isMissingColumnError(firstAttempt.error.message)) {
    return NextResponse.json({ error: firstAttempt.error.message }, { status: 500 })
  }

  const secondAttempt = await supabase
    .from('farms')
    .insert({
      name_en,
      name_ar,
      location,
      type,
      size_hectares,
      organization_id,
    })
    .select()
    .single()

  if (secondAttempt.error) {
    return NextResponse.json({ error: secondAttempt.error.message }, { status: 500 })
  }

  return NextResponse.json(secondAttempt.data, { status: 201 })
}
