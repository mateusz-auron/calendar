import { describe, expect, it } from 'vitest';
import { plainDate } from '../domain';
import { toZonedParts, zonedToEpochMs } from './zoned-time';

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

describe('zonedToEpochMs', () => {
  it.each([
    ['winter', plainDate(2026, 11, 7), '2026-11-07T10:00:00.000Z'],
    ['summer', plainDate(2026, 7, 4), '2026-07-04T09:00:00.000Z'],
    ['DST change day', plainDate(2026, 3, 29), '2026-03-29T09:00:00.000Z'],
  ])('%s', (_, date, expected) => {
    const ms = zonedToEpochMs(date, { hour: 11, minute: 0 }, 'Europe/Warsaw');
    expect(new Date(ms).toISOString()).toBe(expected);
  });
});
