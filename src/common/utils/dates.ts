import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { endOfDay, startOfDay } from 'date-fns';

export const BUSINESS_TZ = 'America/Argentina/Buenos_Aires';

/**
 * Interpret a date-only (YYYY-MM-DD) or ISO string as start of day in AR timezone → UTC.
 */
export function parseFromDate(value?: string): Date | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const local = startOfDay(new Date(`${value}T00:00:00`));
    return fromZonedTime(local, BUSINESS_TZ);
  }
  return new Date(value);
}

/**
 * Interpret a date-only (YYYY-MM-DD) or ISO string as end of day in AR timezone → UTC.
 */
export function parseToDate(value?: string): Date | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const local = endOfDay(new Date(`${value}T00:00:00`));
    return fromZonedTime(local, BUSINESS_TZ);
  }
  return new Date(value);
}

export function todayRangeUtc(): { from: Date; to: Date } {
  const nowInAr = toZonedTime(new Date(), BUSINESS_TZ);
  const fromLocal = startOfDay(nowInAr);
  const toLocal = endOfDay(nowInAr);
  return {
    from: fromZonedTime(fromLocal, BUSINESS_TZ),
    to: fromZonedTime(toLocal, BUSINESS_TZ),
  };
}
