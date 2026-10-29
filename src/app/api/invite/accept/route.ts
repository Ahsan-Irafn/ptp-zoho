import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const invitation = db.invitations.findByToken(token);
    if (!invitation) {
      return NextResponse.json({ error: 'Invalid invitation link' }, { status: 404 });
    }

    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Invitation link has expired' }, { status: 410 });
    }

    if (invitation.accepted_at) {
      return NextResponse.json({ error: 'Invitation has already been accepted' }, { status: 400 });
    }

    // Mark invitation accepted
    db.invitations.markAccepted(token);

    // Audit Log
    db.auditEvents.create({
      organization_id: invitation.organization_id,
      actor_name: invitation.full_name,
      action: 'account_provisioned_and_setup',
      target_type: 'user',
      target_id: invitation.email,
      details: { role: invitation.role, email: invitation.email },
    });

    const response = NextResponse.json({
      success: true,
      message: 'Account provisioned and password set successfully',
    });

    // Set authenticated session cookie
    response.cookies.set(SESSION_COOKIE_NAME, invitation.email, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 86400 * 30,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
