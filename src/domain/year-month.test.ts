import { describe, expect, it } from 'vitest';
import { addMonths, daysInMonth, parseYearMonth, toYearMonthString, yearMonth } from './year-month';

describe('YearMonth', () => {
  it('adds months across year boundaries', () => {
    expect(addMonths(yearMonth(2026, 12), 1)).toEqual(yearMonth(2027, 1));
    expect(addMonths(yearMonth(2026, 1), -1)).toEqual(yearMonth(2025, 12));
    expect(addMonths(yearMonth(2026, 6), -18)).toEqual(yearMonth(2024, 12));
  });

  it('knows month lengths including leap years', () => {
    expect(daysInMonth(yearMonth(2024, 2))).toBe(29);
    expect(daysInMonth(yearMonth(2026, 2))).toBe(28);
    expect(daysInMonth(yearMonth(2026, 4))).toBe(30);
  });

  it('parses and formats YYYY-MM', () => {
    expect(parseYearMonth('2026-03')).toEqual(yearMonth(2026, 3));
    expect(parseYearMonth('2026-13')).toBeUndefined();
    expect(parseYearMonth('garbage')).toBeUndefined();
    expect(toYearMonthString(yearMonth(2026, 3))).toBe('2026-03');
  });
});
