import { describe, expect, it } from 'vitest';

import { parsePosterSlug, posterFileName } from './poster-slug';

describe('parsePosterSlug', () => {
  it('returns undefined when no slug is set, so the page is not built', () => {
    expect(parsePosterSlug(undefined)).toBeUndefined();
    expect(parsePosterSlug('  ')).toBeUndefined();
  });

  it('accepts a long slug of letters, digits and dashes', () => {
    expect(parsePosterSlug(' grafika-7Hq2xk9Fz ')).toBe('grafika-7Hq2xk9Fz');
  });

  it.each([
    'short',
    'has space inside 1',
    '../../etc/passwd-x',
    'slug.with.dots-123',
    '-leading-dash-123',
  ])('rejects %j instead of publishing under a guessable or unsafe name', (value) => {
    expect(() => parsePosterSlug(value)).toThrow(/POSTER_SLUG/);
  });

  it('names the published file after the slug', () => {
    expect(posterFileName('grafika-7Hq2xk9Fz')).toBe('grafika-7Hq2xk9Fz.html');
  });
});
