import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user owns the farm via organization membership
    const { data: farm } = await supabase
      .from('farms')
      .select('organization_id')
      .eq('id', params.id)
      .single();

    if (!farm) {
      return NextResponse.json({ error: 'Farm not found' }, { status: 404 });
    }

    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('*')
      .eq('user_id', user.id)
      .eq('organization_id', farm.organization_id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the farm
    const { error } = await supabase
      .from('farms')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('[v0] Error deleting farm:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[v0] Unexpected error in DELETE /api/operations/farms/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
