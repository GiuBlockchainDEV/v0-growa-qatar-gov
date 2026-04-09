import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * POST /api/auth/accept-invitation
 * 
 * Step 2.5: Validate invitation token and create user account
 * 
 * Request body:
 * {
 *   token: string,
 *   email: string,
 *   password: string,
 *   firstName: string,
 *   firstNameAr: string,
 *   lastName: string,
 *   lastNameAr: string,
 *   phone?: string
 * }
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, email, password, firstName, firstNameAr, lastName, lastNameAr, phone } = body;

    // Validate input
    if (!token || !email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // 1. Fetch the invitation by token
    const { data: invitation, error: invitationError } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (invitationError || !invitation) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation token' },
        { status: 400 }
      );
    }

    // 2. Verify email matches invitation
    if (invitation.email !== email) {
      return NextResponse.json(
        { error: 'Email does not match invitation' },
        { status: 400 }
      );
    }

    // 3. Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Mark as verified since invitation was sent to this email
    });

    if (authError || !authUser.user) {
      console.error('[v0] Auth user creation failed:', authError);
      return NextResponse.json(
        { error: 'Failed to create user account' },
        { status: 500 }
      );
    }

    // 4. Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authUser.user.id,
        email,
        first_name_en: firstName,
        first_name_ar: firstNameAr,
        last_name_en: lastName,
        last_name_ar: lastNameAr,
        phone: phone || null,
        is_active: true,
      });

    if (profileError) {
      console.error('[v0] Profile creation failed:', profileError);
      // Don't fail - profile may already exist
    }

    // 5. Create membership
    const { error: membershipError } = await supabase
      .from('memberships')
      .insert({
        user_id: authUser.user.id,
        organization_id: invitation.organization_id,
        role_template_id: invitation.role_template_id,
        department_id: invitation.department_id,
        region_id: invitation.region_id,
        status: 'active',
        joined_at: new Date().toISOString(),
      });

    if (membershipError) {
      console.error('[v0] Membership creation failed:', membershipError);
      return NextResponse.json(
        { error: 'Failed to set up membership' },
        { status: 500 }
      );
    }

    // 6. Mark invitation as accepted
    const { error: updateError } = await supabase
      .from('invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by_user_id: authUser.user.id,
      })
      .eq('id', invitation.id);

    if (updateError) {
      console.error('[v0] Invitation update failed:', updateError);
    }

    // 7. Log audit event
    await supabase
      .from('audit_logs')
      .insert({
        user_id: authUser.user.id,
        action: 'invitation_accepted',
        entity_type: 'invitation',
        entity_id: invitation.id,
        new_value: `User ${email} accepted invitation`,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      });

    return NextResponse.json(
      {
        success: true,
        message: 'Invitation accepted and account created',
        userId: authUser.user.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] Accept invitation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
