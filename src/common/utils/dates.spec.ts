import {
  businessDayEndUtc,
  businessDayStartUtc,
  parseFromDate,
  parseToDate,
  toBusinessDayIso,
  todayIsoDate,
  yesterdayIsoDate,
} from './dates';

describe('business day 06:00→06:00 AR', () => {
  it('maps early morning to previous calendar day', () => {
    // 19/07/2026 00:46 AR = 19/07/2026 03:46 UTC
    const utc = new Date('2026-07-19T03:46:00.000Z');
    expect(toBusinessDayIso(utc)).toBe('2026-07-18');
  });

  it('maps 06:00 AR to the same calendar day', () => {
    // 19/07/2026 06:00 AR = 19/07/2026 09:00 UTC
    const utc = new Date('2026-07-19T09:00:00.000Z');
    expect(toBusinessDayIso(utc)).toBe('2026-07-19');
  });

  it('maps 05:59 AR to previous day', () => {
    // 19/07/2026 05:59 AR = 19/07/2026 08:59 UTC
    const utc = new Date('2026-07-19T08:59:00.000Z');
    expect(toBusinessDayIso(utc)).toBe('2026-07-18');
  });

  it('parseFromDate starts at 06:00 AR', () => {
    const from = parseFromDate('2026-07-18')!;
    expect(from.toISOString()).toBe(businessDayStartUtc('2026-07-18').toISOString());
    expect(from.toISOString()).toBe('2026-07-18T09:00:00.000Z');
  });

  it('parseToDate ends just before next 06:00 AR', () => {
    const to = parseToDate('2026-07-18')!;
    expect(to.toISOString()).toBe(businessDayEndUtc('2026-07-18').toISOString());
    expect(to.toISOString()).toBe('2026-07-19T08:59:59.999Z');
  });

  it('today/yesterday follow the 6am cutoff', () => {
    const before6 = new Date('2026-07-19T08:30:00.000Z'); // 05:30 AR
    expect(todayIsoDate(before6)).toBe('2026-07-18');
    expect(yesterdayIsoDate(before6)).toBe('2026-07-17');

    const after6 = new Date('2026-07-19T09:30:00.000Z'); // 06:30 AR
    expect(todayIsoDate(after6)).toBe('2026-07-19');
    expect(yesterdayIsoDate(after6)).toBe('2026-07-18');
  });
});
