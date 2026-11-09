import { describe, expect, it } from 'vitest';
import { plainDate } from '../domain';
import { SystemClock } from './system-clock';

describe('SystemClock', () => {
  it("returns today's date in the calendar's time zone, not the viewer's", () => {
    const instant = new Date('2026-11-07T23:30:00Z'); // 00:30 on the 8th in Warsaw
    expect(new SystemClock('Europe/Warsaw', () => instant).today()).toEqual(plainDate(2026, 11, 8));
    expect(new SystemClock('America/New_York', () => instant).today()).toEqual(
      plainDate(2026, 11, 7),
    );
  });

  it("returns the current time of day in the calendar's time zone", () => {
    const instant = new Date('2026-11-09T22:05:00Z'); // 23:05 in Warsaw
    expect(new SystemClock('Europe/Warsaw', () => instant).now()).toEqual({
      date: plainDate(2026, 11, 9),
      time: { hour: 23, minute: 5 },
    });
  });
});
