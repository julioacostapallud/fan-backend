import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import {
  addDays,
  eachDayOfInterval,
  format,
  parseISO,
  startOfDay,
  subDays,
} from 'date-fns';

export const BUSINESS_TZ = 'America/Argentina/Buenos_Aires';

/** El día operativo arranca a esta hora (AR) y termina a la misma hora del día siguiente. */
export const BUSINESS_DAY_START_HOUR = 6;

/**
 * Wall-clock components in BUSINESS_TZ → real UTC Date.
 * Avoids relying on the host timezone for ISO strings without offset.
 */
function wallTimeToUtc(
  isoDay: string,
  hour: number,
  minute = 0,
  second = 0,
  ms = 0,
): Date {
  const [y, m, d] = isoDay.split('-').map(Number);
  const wall = new Date(y, m - 1, d, hour, minute, second, ms);
  return fromZonedTime(wall, BUSINESS_TZ);
}

/** Inicio inclusivo del día operativo (yyyy-MM-dd → 06:00 AR). */
export function businessDayStartUtc(isoDay: string): Date {
  return wallTimeToUtc(isoDay, BUSINESS_DAY_START_HOUR);
}

/** Fin inclusivo del día operativo (un ms antes de las 06:00 del día siguiente). */
export function businessDayEndUtc(isoDay: string): Date {
  const next = format(addDays(parseISO(isoDay), 1), 'yyyy-MM-dd');
  return new Date(businessDayStartUtc(next).getTime() - 1);
}

/**
 * Día operativo de un instante (yyyy-MM-dd).
 * Antes de las 06:00 AR cuenta para el día calendario anterior.
 */
export function toBusinessDayIso(date: Date = new Date()): string {
  const zoned = toZonedTime(date, BUSINESS_TZ);
  let day = startOfDay(zoned);
  if (zoned.getHours() < BUSINESS_DAY_START_HOUR) {
    day = subDays(day, 1);
  }
  return format(day, 'yyyy-MM-dd');
}

/**
 * Interpret a date-only (YYYY-MM-DD) or ISO string as start of business day in AR → UTC.
 */
export function parseFromDate(value?: string): Date | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return businessDayStartUtc(value);
  }
  return new Date(value);
}

/**
 * Interpret a date-only (YYYY-MM-DD) or ISO string as end of business day in AR → UTC.
 */
export function parseToDate(value?: string): Date | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return businessDayEndUtc(value);
  }
  return new Date(value);
}

export function todayIsoDate(now: Date = new Date()): string {
  return toBusinessDayIso(now);
}

/** Calendar days from `fromIso` through `toIso` inclusive (yyyy-MM-dd). */
export function eachIsoDay(fromIso: string, toIso: string): string[] {
  if (fromIso > toIso) return [];
  return eachDayOfInterval({
    start: parseISO(fromIso),
    end: parseISO(toIso),
  }).map((d) => format(d, 'yyyy-MM-dd'));
}

/** Yesterday's business day (yyyy-MM-dd). */
export function yesterdayIsoDate(now: Date = new Date()): string {
  return format(subDays(parseISO(todayIsoDate(now)), 1), 'yyyy-MM-dd');
}

export function todayRangeUtc(now: Date = new Date()): { from: Date; to: Date } {
  const day = todayIsoDate(now);
  return {
    from: businessDayStartUtc(day),
    to: businessDayEndUtc(day),
  };
}
