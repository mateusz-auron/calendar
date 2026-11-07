import { describe, expect, it } from 'vitest';
import { plainDate } from '../domain';
import { toZonedParts } from './zoned-time';

describe('toZonedParts', () => {
  it('converts an instant to wall-clock parts in the given zone', () => {
    const instant = new Date('2026-11-10T23:30:00Z');
    expect(toZonedParts(instant, 'UTC')).toEqual({
      date: plainDate(2026, 11, 10),
      time: { hour: 23, minute: 30 },
    });
    expect(toZonedParts(instant, 'Europe/Warsaw')).toEqual({
      date: plainDate(2026, 11, 11),
      time: { hour: 0, minute: 30 },
    });
  });
});
