import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizeEmail } from '@/lib/utils/normalization';
import { verifyPassword } from '@/lib/utils/crypto';
import { SESSION_COOKIE_NAME, createSessionRecord } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const normEmail = normalizeEmail(email);
    const profile = db.profiles.findByEmail(normEmail);

    if (!profile) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (!profile.is_active) {
      return NextResponse.json({ error: 'Account has been disabled. Please contact an owner.' }, { status: 403 });
    }

    const credential = db.credentials.findByEmail(normEmail);
    if (!credential) {
      return NextResponse.json({ error: 'Password has not been initialized for this account. Please use your setup invitation link.' }, { status: 401 });
    }

    const isValid = verifyPassword(password, credential.password_hash, credential.salt);
    if (!isValid) {
      // Audit failed login attempt
      db.auditEvents.create({
        organization_id: profile.organization_id,
        actor_name: profile.full_name,
        action: 'login_failed',
        target_type: 'user',
        target_id: profile.id,
        details: { email: normEmail, reason: 'incorrect_password' },
      });

      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Create cryptographically secure session
    const session = createSessionRecord(profile);

    // Record successful audit event
    db.auditEvents.create({
      organization_id: profile.organization_id,
      actor_name: profile.full_name,
      action: 'login_success',
      target_type: 'user',
      target_id: profile.id,
      details: { email: normEmail, role: profile.role },
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        role: profile.role,
      }
    });

    // Set secure HttpOnly session cookie
    response.cookies.set(SESSION_COOKIE_NAME, session.token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 86400, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Internal server error during authentication' }, { status: 500 });
  }
}
