import { describe, expect, it } from 'vitest';
import { describeProblems, reportToMarkdown } from './description-report';

describe('describeProblems', () => {
  it('lists parser warnings per event', () => {
    const report = describeProblems([
      { id: '1', title: 'Liga', description: 'game: Pokemon', start: { date: '2026-11-07' } },
      {
        id: '2',
        title: 'Cup | finał',
        description: 'seats: dużo\nzapisy: nie wiem',
        start: { dateTime: '2026-11-08T10:00:00.000Z' },
      },
    ]);
    expect(report.looksFreeBusyOnly).toBe(false);
    expect(report.warnings.map((w) => [w.date, w.title])).toEqual([
      ['2026-11-08', 'Cup | finał'],
      ['2026-11-08', 'Cup | finał'],
    ]);
    const markdown = reportToMarkdown(report);
    expect(markdown).toContain('| 2026-11-08 | Cup \\| finał |');
  });

  it('flags calendars that look shared as free/busy only', () => {
    const report = describeProblems([
      { id: '1', start: { date: '2026-11-07' } },
      { id: '2', start: { date: '2026-11-08' } },
      { id: '3', title: 'x', start: { date: '2026-11-09' } },
    ]);
    expect(report.looksFreeBusyOnly).toBe(true);
    expect(reportToMarkdown(report)).toContain('Większość wydarzeń nie ma tytułu');
  });

  it('reports no problems', () => {
    expect(reportToMarkdown(describeProblems([]))).toContain('Brak problemów');
  });
});
