import { describe, expect, it } from 'vitest';
import { contains, dateRange, daysOfOverlap, overlaps } from './date-range';
import { plainDate } from './plain-date';

const nov = dateRange(plainDate(2026, 11, 1), plainDate(2026, 11, 30));

describe('DateRange', () => {
  it('rejects inverted ranges', () => {
    expect(() => dateRange(plainDate(2026, 2, 2), plainDate(2026, 2, 1))).toThrow(RangeError);
  });

  it('checks containment and overlap at the edges', () => {
    expect(contains(nov, plainDate(2026, 11, 30))).toBe(true);
    expect(contains(nov, plainDate(2026, 12, 1))).toBe(false);
    expect(overlaps(nov, plainDate(2026, 10, 30), plainDate(2026, 11, 1))).toBe(true);
    expect(overlaps(nov, plainDate(2026, 12, 1), plainDate(2026, 12, 3))).toBe(false);
  });

  it('lists the overlapping days, clamped to the range', () => {
    expect(daysOfOverlap(nov, plainDate(2026, 10, 30), plainDate(2026, 11, 2))).toEqual([
      plainDate(2026, 11, 1),
      plainDate(2026, 11, 2),
    ]);
    expect(daysOfOverlap(nov, plainDate(2026, 12, 2), plainDate(2026, 12, 3))).toEqual([]);
  });
});
