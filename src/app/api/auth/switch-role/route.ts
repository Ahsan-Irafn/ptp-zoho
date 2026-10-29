import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, createSessionRecord, SESSION_COOKIE_NAME } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  try {
    // Security Guard: Role switching is strictly restricted to authenticated owners
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'owner') {
      return NextResponse.json({ 
        error: 'Forbidden: Role switching requires active owner authentication.' 
      }, { status: 403 });
    }

    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const targetProfile = db.profiles.findByEmail(email);
    if (!targetProfile || !targetProfile.is_active) {
      return NextResponse.json({ error: 'User profile not found or inactive' }, { status: 404 });
    }

    // Create session record for target profile
    const session = createSessionRecord(targetProfile);

    // Audit owner role switch
    db.auditEvents.create({
      organization_id: targetProfile.organization_id,
      actor_name: currentUser.full_name,
      action: 'owner_impersonation',
      target_type: 'user',
      target_id: targetProfile.id,
      details: {
        switched_from: currentUser.email,
        switched_to: targetProfile.email,
      },
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: targetProfile.id,
        email: targetProfile.email,
        fullName: targetProfile.full_name,
        role: targetProfile.role,
      }
    });

    response.cookies.set(SESSION_COOKIE_NAME, session.token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 86400,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
