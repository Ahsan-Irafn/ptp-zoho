/**
 * Contact data normalization utilities:
 * Australian and international phone formatting, email normalization, and CSV formula injection protection.
 */

export function normalizeEmail(email: string): string {
  if (!email) return '';
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex === -1) return trimmed;
  
  const user = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  return `${user}@${domain}`;
}

/**
 * Normalizes phone numbers with Australia (+61) as the default country prefix
 * while fully preserving valid international numbers.
 */
export function normalizePhone(rawPhone: string, defaultCountryCode: string = '+61'): string {
  if (!rawPhone) return '';
  let cleaned = rawPhone.trim().replace(/[^\d+]/g, '');
  
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  
  if (cleaned.startsWith('00')) {
    return '+' + cleaned.slice(2);
  }
  
  // Australia mobile: 0412345678 -> +61412345678
  if (cleaned.startsWith('04') && cleaned.length === 10) {
    return '+61' + cleaned.slice(1);
  }

  // Australia landline: 0861022094, 02..., 03..., 07... (10 digits starting with 0)
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return '+61' + cleaned.slice(1);
  }
  
  // Generic single leading zero
  if (cleaned.startsWith('0')) {
    return defaultCountryCode + cleaned.slice(1);
  }
  
  // Already has 61 country code without leading plus
  if (cleaned.startsWith('61') && (cleaned.length === 11 || cleaned.length === 12)) {
    return '+' + cleaned;
  }

  // Pakistan / International numbers without plus
  if (cleaned.startsWith('92') && cleaned.length === 12) {
    return '+' + cleaned;
  }

  return defaultCountryCode + cleaned;
}

/**
 * Formats Australian numbers into familiar human-readable representations:
 * 04xx xxx xxx for mobile, (08) xxxx xxxx for landlines.
 */
export function formatAustralianPhone(normalizedPhone: string | null | undefined): string {
  if (!normalizedPhone) return '—';
  const cleaned = normalizedPhone.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+614') && cleaned.length === 12) {
    // Mobile: +61 412 345 678 -> 0412 345 678
    return `0${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
  }

  if (cleaned.startsWith('+61') && cleaned.length === 11) {
    // Landline e.g. +61 8 6102 2094 -> (08) 6102 2094
    const areaCode = cleaned.slice(3, 4);
    return `(0${areaCode}) ${cleaned.slice(4, 8)} ${cleaned.slice(8)}`;
  }

  return normalizedPhone;
}

/**
 * Sanitize text to prevent CSV Formula Injection (CWE-1236)
 * If cell starts with '=', '+', '-', '@', '\t', '\r', prefix with single quote.
 */
export function sanitizeCsvField(field: string | number | null | undefined): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  const dangerousPrefixes = ['=', '+', '-', '@', '\t', '\r'];
  
  let sanitized = str;
  if (dangerousPrefixes.some(prefix => str.startsWith(prefix))) {
    sanitized = `'${str}`;
  }
  
  // Escape double quotes
  if (sanitized.includes('"') || sanitized.includes(',') || sanitized.includes('\n')) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

export function generateCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const headerRow = headers.map(h => sanitizeCsvField(h)).join(',');
  const dataRows = rows.map(row => row.map(cell => sanitizeCsvField(cell)).join(','));
  return [headerRow, ...dataRows].join('\r\n');
}
