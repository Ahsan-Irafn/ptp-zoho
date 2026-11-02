import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { Profile, Role, SessionRecord } from '@/types/crm';
import { generateSignedSessionToken, verifySignedSessionToken } from '@/lib/utils/crypto';

export const SESSION_COOKIE_NAME = 'ptp_session_token';
const SESSION_DURATION_DAYS = 7;

/**
 * Retrieves the currently authenticated user by validating the secure session token.
 * Supports stateless signed tokens for serverless multi-container execution (e.g. Netlify/Vercel)
 * alongside database session state. Strictly NO unauthenticated fallback.
 */
export async function getCurrentUser(): Promise<Profile | null> {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return null;
  }

  // 1. Validate signed token (resilient across serverless cold starts & multiple instances)
  const payload = verifySignedSessionToken(sessionToken);
  if (payload) {
    if (new Date(payload.expiresAt).getTime() < Date.now()) {
      return null;
    }

    // Check if session was explicitly revoked in DB
    try {
      const revokedSession = db.sessions.findByToken(sessionToken);
      if (revokedSession && new Date(revokedSession.expires_at).getTime() < Date.now()) {
        return null;
      }
    } catch {}

    const profile = db.profiles.findById(payload.userId) || db.profiles.findByEmail(payload.email);
    if (!profile || !profile.is_active) {
      return null;
    }

    return profile;
  }

  // 2. Fallback for legacy random tokens
  try {
    const session = db.sessions.findByToken(sessionToken);
    if (!session) {
      return null;
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      db.sessions.revoke(sessionToken);
      return null;
    }

    const profile = db.profiles.findById(session.user_id);
    if (!profile || !profile.is_active) {
      db.sessions.revoke(sessionToken);
      return null;
    }

    return profile;
  } catch {
    return null;
  }
}

/**
 * Creates a cryptographically secure signed session record and returns the token
 */
export function createSessionRecord(user: Profile): SessionRecord {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 86400000).toISOString();
  
  // Create cryptographically signed token
  const token = generateSignedSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    expiresAt,
  });

  const record: SessionRecord = {
    token,
    user_id: user.id,
    email: user.email,
    role: user.role,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  };

  try {
    db.sessions.create(record);
  } catch (err) {
    // Non-blocking in serverless environments where filesystem writes may be ephemeral
    console.warn('Session write to disk bypassed (stateless token active):', err);
  }

  return record;
}

/**
 * Revokes the session associated with the current request
 */
export async function revokeCurrentSession(): Promise<void> {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (sessionToken) {
    try {
      db.sessions.revoke(sessionToken);
    } catch {}
    cookieStore.delete(SESSION_COOKIE_NAME);
  }
}

/**
 * Enforces authenticated user requirement. Redirects to /login if unauthenticated.
 */
export async function requireUser(): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}

/**
 * Enforces owner role requirement. Redirects to /dashboard if calling agent attempts access.
 */
export async function requireOwner(): Promise<Profile> {
  const user = await requireUser();
  if (user.role !== 'owner') {
    redirect('/dashboard');
  }
  return user;
}
