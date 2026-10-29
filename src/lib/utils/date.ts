import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

// Practical Training Pathways Business Timezone
export const ADELAIDE_TZ = 'Australia/Adelaide';
export const BUSINESS_LOCALE = 'en-AU';

/**
 * Format a UTC ISO timestamp into Australia/Adelaide display time with full DST support
 */
export function formatAdelaideDateTime(
  dateInput: string | Date | null | undefined, 
  pattern: string = 'dd MMM yyyy, hh:mm a'
): string {
  if (!dateInput) return '—';
  try {
    const date = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
    if (isNaN(date.getTime())) return '—';
    return formatInTimeZone(date, ADELAIDE_TZ, pattern);
  } catch (err) {
    return '—';
  }
}

export function formatAdelaideDate(dateInput: string | Date | null | undefined): string {
  return formatAdelaideDateTime(dateInput, 'dd MMM yyyy');
}

export function formatAdelaideTime(dateInput: string | Date | null | undefined): string {
  return formatAdelaideDateTime(dateInput, 'hh:mm a');
}

export function formatRelativeTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  try {
    const date = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
    if (isNaN(date.getTime())) return '—';
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (err) {
    return '—';
  }
}

/**
 * Owner-only administrative currency formatter (AUD)
 */
export function formatCurrencyAUD(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0 AUD';
  return new Intl.NumberFormat(BUSINESS_LOCALE, {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(amount);
}

// Deprecated migration aliases (all redirecting to Australia/Adelaide)
export const KARACHI_TZ = ADELAIDE_TZ;
export const formatKarachiDateTime = formatAdelaideDateTime;
export const formatKarachiDate = formatAdelaideDate;
export const formatKarachiTime = formatAdelaideTime;
export const formatCurrencyPKR = formatCurrencyAUD;
