import { describe, expect, it } from 'vitest';
import { addDays, compareDates, isSameDate, plainDate, toIsoString, weekdayOf } from './plain-date';

describe('plainDate', () => {
  it('creates valid dates', () => {
    expect(plainDate(2024, 2, 29)).toEqual({ year: 2024, month: 2, day: 29 });
  });

  it('rejects invalid dates', () => {
    expect(() => plainDate(2023, 2, 29)).toThrow(RangeError);
    expect(() => plainDate(2026, 13, 1)).toThrow(RangeError);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays(plainDate(2026, 12, 31), 1)).toEqual(plainDate(2027, 1, 1));
    expect(addDays(plainDate(2026, 3, 1), -1)).toEqual(plainDate(2026, 2, 28));
  });

  it('is unaffected by DST transitions', () => {
    expect(addDays(plainDate(2026, 3, 28), 2)).toEqual(plainDate(2026, 3, 30));
  });

  it('computes weekday, comparisons and ISO string', () => {
    expect(weekdayOf(plainDate(2026, 11, 7))).toBe(6); // Saturday
    expect(compareDates(plainDate(2026, 1, 1), plainDate(2026, 1, 2))).toBeLessThan(0);
    expect(isSameDate(plainDate(2026, 5, 5), plainDate(2026, 5, 5))).toBe(true);
    expect(toIsoString(plainDate(2026, 5, 7))).toBe('2026-05-07');
  });
});
