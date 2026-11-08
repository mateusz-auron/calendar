import { describe, expect, it } from 'vitest';
import { plainDate } from '../domain';
import { decodeRequest, encodeRequest } from './messages';

describe('details request messages', () => {
  it('round-trips a request', () => {
    const request = {
      date: plainDate(2026, 12, 5),
      eventId: 'abc_20261205T170000Z',
      filter: 'all' as const,
    };
    expect(decodeRequest(encodeRequest(request))).toEqual(request);
    expect(decodeRequest(encodeRequest({ date: plainDate(2026, 12, 5), filter: 'other' }))).toEqual(
      {
        date: plainDate(2026, 12, 5),
        filter: 'other',
      },
    );
  });

  it('rejects bad dates and ids, and falls back to "all" for unknown filters', () => {
    expect(decodeRequest({ date: '2026-02-30' })).toBeUndefined();
    expect(decodeRequest({ date: 20261205 })).toBeUndefined();
    expect(decodeRequest({ date: '2026-12-05', eventId: 5 })).toBeUndefined();
    expect(decodeRequest({ date: '2026-12-05', eventId: 'x'.repeat(2000) })).toBeUndefined();
    expect(decodeRequest({ date: '2026-12-05', filter: 'magic' })?.filter).toBe('all');
  });
});
