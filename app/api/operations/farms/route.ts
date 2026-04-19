import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const searchQuery = searchParams.get('q')?.trim() || ''
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const selectAttempts = ['*', 'id, name_en, name_ar, location', 'id, name_en, location']
  const orderAttempts: Array<{ column: string; ascending: boolean } | null> = [
    { column: 'created_at', ascending: false },
    { column: 'updated_at', ascending: false },
    null,
  ]

  for (const select of selectAttempts) {
    for (const orderConfig of orderAttempts) {
      let query = supabase.from('farms').select(select)
      if (searchQuery) {
        const escaped = searchQuery.replace(/[%_]/g, '\\$&')
        query = query.or(
          `name_en.ilike.%${escaped}%,name_ar.ilike.%${escaped}%,location.ilike.%${escaped}%`
        )
      }
      if (orderConfig) {
        query = query.order(orderConfig.column, { ascending: orderConfig.ascending })
      }

      const { data, error } = await query
      if (!error) {
        return NextResponse.json(data || [])
      }

      const message = error.message.toLowerCase()
      const retryable =
        message.includes('column') || message.includes('does not exist') || message.includes('schema cache')
      if (!retryable) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }
  }

  return NextResponse.json([], { status: 200 })
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

  // Insert new farm
  const { data: farm, error } = await supabase
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

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(farm, { status: 201 })
}
