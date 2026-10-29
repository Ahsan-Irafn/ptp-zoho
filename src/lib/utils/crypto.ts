import crypto from 'crypto';

/**
 * Verify Meta webhook signature (X-Hub-Signature-256)
 * Format: sha256=<hash>
 */
export function verifyMetaSignature(
  rawBody: string, 
  signatureHeader: string | null | undefined, 
  appSecret: string
): boolean {
  if (!signatureHeader || !appSecret) return false;
  
  const [prefix, signature] = signatureHeader.split('=');
  if (prefix !== 'sha256' || !signature) return false;
  
  const hmac = crypto.createHmac('sha256', appSecret);
  const expectedSignature = hmac.update(rawBody, 'utf8').digest('hex');
  
  // Timing safe comparison to prevent timing attacks
  const signatureBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  
  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

/**
 * Generate cryptographically secure random token for invitations & unsubscribes
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate signed unsubscribe token
 */
export function generateSignedUnsubscribeToken(email: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  const signature = hmac.update(email.toLowerCase().trim()).digest('hex');
  const payload = Buffer.from(JSON.stringify({ email, sig: signature })).toString('base64url');
  return payload;
}

export function verifySignedUnsubscribeToken(token: string, secret: string): string | null {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const { email, sig } = JSON.parse(raw);
    const expectedSig = crypto.createHmac('sha256', secret).update(email.toLowerCase().trim()).digest('hex');
    if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return email;
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Hash password using PBKDF2 (SHA-512, 100,000 iterations) with cryptographic salt
 */
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const chosenSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, chosenSalt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt: chosenSalt };
}

/**
 * Verify password against salt and hash using timing-safe comparison
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const computed = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    const computedBuf = Buffer.from(computed, 'hex');
    const hashBuf = Buffer.from(hash, 'hex');
    if (computedBuf.length !== hashBuf.length) return false;
    return crypto.timingSafeEqual(computedBuf, hashBuf);
  } catch (err) {
    return false;
  }
}

