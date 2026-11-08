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
});
