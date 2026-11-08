import { parseEventDescription } from '../../src/infrastructure/event-description-parser';
import type { RawEvent } from '../../src/infrastructure/raw-event';

export interface DescriptionWarning {
  /** `YYYY-MM-DD` of the event start. */
  readonly date: string;
  readonly title: string;
  readonly message: string;
}

export interface DescriptionReport {
  readonly warnings: readonly DescriptionWarning[];
  /** True when most events have no title: the calendar is probably shared as free/busy only. */
  readonly looksFreeBusyOnly: boolean;
}

/** Checks every event description, so organisers can fix typos (see docs/event-description.md). */
export function describeProblems(events: readonly RawEvent[]): DescriptionReport {
  const warnings = events.flatMap((event) =>
    parseEventDescription(event.description).warnings.map((message) => ({
      date: (event.start?.date ?? event.start?.dateTime ?? '').slice(0, 10),
      title: event.title?.trim() || '(bez tytułu)',
      message,
    })),
  );
  const untitled = events.filter((e) => !e.title?.trim()).length;
  return { warnings, looksFreeBusyOnly: events.length > 0 && untitled > events.length / 2 };
}

/** Markdown for the GitHub Actions step summary. */
export function reportToMarkdown(report: DescriptionReport): string {
  const lines = ['## Opisy wydarzeń', ''];
  if (report.looksFreeBusyOnly) {
    lines.push(
      '> ⚠️ Większość wydarzeń nie ma tytułu. Czy kalendarz jest udostępniony publicznie z opcją',
      '> „Wyświetlaj wszystkie szczegóły wydarzeń”?',
      '',
    );
  }
  if (report.warnings.length === 0) {
    lines.push('Brak problemów. ✅');
    return `${lines.join('\n')}\n`;
  }
  const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  lines.push('| Data | Wydarzenie | Problem |', '| --- | --- | --- |');
  for (const w of report.warnings) {
    lines.push(`| ${w.date} | ${cell(w.title)} | ${cell(w.message)} |`);
  }
  return `${lines.join('\n')}\n`;
}
