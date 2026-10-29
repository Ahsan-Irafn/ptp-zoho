import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { Profile, Role, SessionRecord } from '@/types/crm';
import { generateSecureToken } from '@/lib/utils/crypto';

export const SESSION_COOKIE_NAME = 'ptp_session_token';
const SESSION_DURATION_DAYS = 7;

/**
 * Retrieves the currently authenticated user by validating the secure session token.
 * If the session is missing, invalid, expired, or the user is disabled, returns null.
 * Strictly NO unauthenticated fallback.
 */
export async function getCurrentUser(): Promise<Profile | null> {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return null;
  }

  const session = db.sessions.findByToken(sessionToken);
  if (!session) {
    return null;
  }

  // Check if session has expired
  if (new Date(session.expires_at).getTime() < Date.now()) {
    db.sessions.revoke(sessionToken);
    return null;
  }

  const profile = db.profiles.findById(session.user_id);
  if (!profile || !profile.is_active) {
    // Revoke invalid/inactive session
    db.sessions.revoke(sessionToken);
    return null;
  }

  return profile;
}

/**
 * Creates a cryptographically secure session record and returns the token
 */
export function createSessionRecord(user: Profile): SessionRecord {
  const token = generateSecureToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 86400000).toISOString();
  
  return db.sessions.create({
    token,
    user_id: user.id,
    email: user.email,
    role: user.role,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  });
}

/**
 * Revokes the session associated with the current request
 */
export async function revokeCurrentSession(): Promise<void> {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (sessionToken) {
    db.sessions.revoke(sessionToken);
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
