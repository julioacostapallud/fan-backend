import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { eachDayOfInterval, endOfDay, format, parseISO, startOfDay, subDays } from 'date-fns';

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

export function todayIsoDate(): string {
  return formatInTimeZone(new Date(), BUSINESS_TZ, 'yyyy-MM-dd');
}

/** Calendar days from `fromIso` through `toIso` inclusive (yyyy-MM-dd). */
export function eachIsoDay(fromIso: string, toIso: string): string[] {
  if (fromIso > toIso) return [];
  return eachDayOfInterval({
    start: parseISO(fromIso),
    end: parseISO(toIso),
  }).map((d) => format(d, 'yyyy-MM-dd'));
}

/** Yesterday's calendar date in business TZ (yyyy-MM-dd). */
export function yesterdayIsoDate(): string {
  const todayLocal = startOfDay(toZonedTime(new Date(), BUSINESS_TZ));
  return format(subDays(todayLocal, 1), 'yyyy-MM-dd');
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
