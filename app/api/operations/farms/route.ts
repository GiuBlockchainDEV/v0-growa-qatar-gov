import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user's organization
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's membership to find organization
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 403 });
    }

    // Fetch farms for the organization
    const { data: farms, error } = await supabase
      .from('farms')
      .select('*')
      .eq('organization_id', membership.organization_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[v0] Error fetching farms:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(farms);
  } catch (error) {
    console.error('[v0] Unexpected error in GET /api/operations/farms:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's membership
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 403 });
    }

    const body = await request.json();

    // Create farm
    const { data: farm, error } = await supabase
      .from('farms')
      .insert([
        {
          organization_id: membership.organization_id,
          name_en: body.name_en,
          name_ar: body.name_ar,
          location: body.location,
          farm_type: body.farm_type,
          size_hectares: body.size_hectares,
          status: body.status,
        },
      ])
      .select();

    if (error) {
      console.error('[v0] Error creating farm:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(farm[0], { status: 201 });
  } catch (error) {
    console.error('[v0] Unexpected error in POST /api/operations/farms:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
