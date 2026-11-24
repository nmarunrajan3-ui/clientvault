import type { LicenseStatus } from '../types/models';

/**
 * Returns today's date formatted as YYYY-MM-DD in the Asia/Kolkata timezone.
 */
export function getTodayKolkata(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date()); // Returns YYYY-MM-DD
}

/**
 * Normalizes an ISO string or date string to YYYY-MM-DD in Asia/Kolkata.
 */
export function toKolkataDateString(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return getTodayKolkata();

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Calculates the calendar difference in whole days between today and the target date (in Asia/Kolkata).
 * Positive = future (days remaining)
 * Negative = past (days overdue)
 * 0 = today
 */
export function getDaysRemaining(expirationDateStr: string): number {
  const todayStr = getTodayKolkata();
  const targetStr = toKolkataDateString(expirationDateStr);

  const [tY, tM, tD] = todayStr.split('-').map(Number);
  const [eY, eM, eD] = targetStr.split('-').map(Number);

  const todayUtc = Date.UTC(tY, tM - 1, tD);
  const targetUtc = Date.UTC(eY, eM - 1, eD);

  const diffMs = targetUtc - todayUtc;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Computes license status dynamically based on current date in Asia/Kolkata.
 * - revoked: manually revoked
 * - expired: daysRemaining < 0
 * - urgent: 0 <= daysRemaining <= 7
 * - expiring_soon: 7 < daysRemaining <= 30
 * - active: daysRemaining > 30
 */
export function calculateLicenseStatus(expirationDateStr: string, currentStatus?: LicenseStatus): LicenseStatus {
  if (currentStatus === 'revoked') {
    return 'revoked';
  }

  const daysRemaining = getDaysRemaining(expirationDateStr);

  if (daysRemaining < 0) {
    return 'expired';
  } else if (daysRemaining <= 7) {
    return 'urgent';
  } else if (daysRemaining <= 30) {
    return 'expiring_soon';
  } else {
    return 'active';
  }
}

/**
 * Formats remaining days into an informative label.
 */
export function formatDaysRemaining(expirationDateStr: string): {
  label: string;
  isOverdue: boolean;
  days: number;
} {
  const days = getDaysRemaining(expirationDateStr);

  if (days < 0) {
    const overdue = Math.abs(days);
    return {
      label: `Expired ${overdue} day${overdue === 1 ? '' : 's'} ago`,
      isOverdue: true,
      days,
    };
  } else if (days === 0) {
    return {
      label: 'Expires today',
      isOverdue: false,
      days: 0,
    };
  } else {
    return {
      label: `${days} day${days === 1 ? '' : 's'} remaining`,
      isOverdue: false,
      days,
    };
  }
}

export interface DurationOption {
  label: string;
  days: number;
  months?: number;
  years?: number;
}

export const DURATION_PRESETS: DurationOption[] = [
  { label: '1 Year (365 Days)', days: 365, years: 1 },
  { label: '6 Months (180 Days)', days: 180, months: 6 },
  { label: '3 Months (90 Days)', days: 90, months: 3 },
  { label: '1 Month (30 Days)', days: 30, months: 1 },
  { label: '2 Years (730 Days)', days: 730, years: 2 },
  { label: '3 Years (1095 Days)', days: 1095, years: 3 },
  { label: 'Custom Duration', days: 0 },
];

/**
 * Adds calendar years/months/days to a base date (YYYY-MM-DD).
 * Accurately handles leap years and calendar dates (e.g. 23 Nov 2027 + 1 yr = 23 Nov 2028).
 */
export function addDurationToDate(baseDateStr: string, option: DurationOption): string {
  const dateStr = toKolkataDateString(baseDateStr);
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (option.years) {
    date.setUTCFullYear(date.getUTCFullYear() + option.years);
  } else if (option.months) {
    date.setUTCMonth(date.getUTCMonth() + option.months);
  } else if (option.days > 0) {
    date.setUTCDate(date.getUTCDate() + option.days);
  }

  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculates new expiration date for a renewal according to specification:
 *
 * SPECIFICATION RULE:
 * - If a license expires on 23 November 2027 and customer renews on 20 November 2027
 *   for one year, the new expiry must be 23 November 2028.
 *   (i.e., If renewed before or on expiration, calculate from previous expiration date).
 *
 * - If the license has already expired (e.g. expired on 10 November and renewed on 20 November),
 *   calculate the new expiry from the renewal date by default.
 */
export function calculateRenewalExpiration(
  previousExpirationDate: string,
  renewalDate: string,
  durationOption: DurationOption
): {
  calculatedExpiry: string;
  calculatedFrom: 'previous_expiry' | 'renewal_date';
  isEarlyRenewal: boolean;
} {
  const prevDateStr = toKolkataDateString(previousExpirationDate);
  const renDateStr = toKolkataDateString(renewalDate);

  // Compare calendar dates (YYYY-MM-DD)
  const isEarlyRenewal = renDateStr <= prevDateStr;

  let calculatedExpiry: string;
  let calculatedFrom: 'previous_expiry' | 'renewal_date';

  if (isEarlyRenewal) {
    // License has NOT expired yet: extend from previous expiry
    calculatedExpiry = addDurationToDate(prevDateStr, durationOption);
    calculatedFrom = 'previous_expiry';
  } else {
    // License HAS already expired: calculate from renewal date
    calculatedExpiry = addDurationToDate(renDateStr, durationOption);
    calculatedFrom = 'renewal_date';
  }

  return {
    calculatedExpiry,
    calculatedFrom,
    isEarlyRenewal,
  };
}

/**
 * Masks a license key for display.
 * Reveals only when explicitly set to true.
 * Example: "ABCD-1234-EFGH-5678" -> "ABCD-••••-••••-5678"
 */
export function maskLicenseKey(key: string, isRevealed: boolean): string {
  if (!key) return '';
  if (isRevealed) return key;

  // Trim and handle key format
  const trimmed = key.trim();
  if (trimmed.length <= 8) {
    // Short key
    return '••••••••';
  }

  // Preserve first 4 characters and last 4 characters
  const firstFour = trimmed.substring(0, 4);
  const lastFour = trimmed.substring(trimmed.length - 4);
  const middleLength = trimmed.length - 8;

  // If key contains dashes, format gracefully
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    if (parts.length >= 3) {
      const maskedParts = parts.map((p, idx) => {
        if (idx === 0 || idx === parts.length - 1) return p;
        return '••••';
      });
      return maskedParts.join('-');
    }
  }

  return `${firstFour}-${'•'.repeat(Math.min(middleLength, 8))}-${lastFour}`;
}

export const POPULAR_PRODUCTS = [
  'RetailPRO Desktop POS',
  'Billing Master ERP',
  'QuickGST Invoice Pro',
  'Inventory Hub Ultimate',
  'PharmaCare Billing Suite',
  'Restaurant & Dine-in POS',
  'Barcode Generator & Labeler',
  'Distribution & Wholesale Hub',
];
