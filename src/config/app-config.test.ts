import { describe, expect, it } from 'vitest';
import { yearMonth } from '../domain';
import { DEFAULT_CONFIG, parseConfig } from './app-config';

describe('parseConfig', () => {
  it('falls back to defaults', () => {
    expect(parseConfig('')).toEqual(DEFAULT_CONFIG);
  });

  it('reads supported query parameters', () => {
    const config = parseConfig(
      '?month=2026-03&lang=pl-PL&weekStart=0&theme=dark&parentOrigin=https://example.com/path',
    );
    expect(config).toMatchObject({
      initialMonth: yearMonth(2026, 3),
      locale: 'pl-PL',
      weekStartsOn: 0,
      theme: 'dark',
      parentOrigin: 'https://example.com',
    });
  });

  it('ignores invalid values', () => {
    const config = parseConfig('?month=nope&lang=!!&weekStart=9&theme=neon&parentOrigin=::');
    expect(config).toEqual(DEFAULT_CONFIG);
  });
});
