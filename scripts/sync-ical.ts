/**
 * Build-time iCal sync: downloads a public iCalendar feed, expands it into a
 * static `events.json` snapshot and (optionally) reports whether it differs
 * from the currently deployed one, so scheduled runs can skip no-op deploys.
 *
 *   ICAL_URL=<feed> npm run sync:ical
 *
 * Env: ICAL_URL (required), ICAL_OUTPUT (default public/events.json),
 *      ICAL_PAST_MONTHS (12), ICAL_FUTURE_MONTHS (24),
 *      ICAL_COMPARE_URL (deployed events.json), GITHUB_OUTPUT and
 *      GITHUB_STEP_SUMMARY (set by Actions; the summary lists description problems).
 */
import { createHash } from 'node:crypto';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseSnapshot, type EventSnapshot } from '../src/infrastructure/event-snapshot';
import { describeProblems, reportToMarkdown } from './ical/description-report';
import { calendarIdFromIcalUrl, icalToSnapshot } from './ical/ical-to-snapshot';

const env = process.env;

function intEnv(name: string, fallback: number): number {
  const value = Number(env[name]);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

/** Content fingerprint that ignores `generatedAt`/`range`, which change on every run. */
function fingerprint(snapshot: Pick<EventSnapshot, 'events'>): string {
  return createHash('sha256').update(JSON.stringify(snapshot.events)).digest('hex');
}

async function deployedFingerprint(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return undefined;
    const json: unknown = await response.json();
    // Normalise through the same parser so formatting differences don't count.
    return fingerprint({ events: parseSnapshot(json).events });
  } catch {
    return undefined; // nothing deployed yet, or unreadable: treat as changed
  }
}

async function main(): Promise<void> {
  const url = env.ICAL_URL?.trim();
  if (!url) throw new Error('ICAL_URL is not set.');
  const output = env.ICAL_OUTPUT ?? 'public/events.json';

  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok)
    throw new Error(`Downloading the iCal feed failed: HTTP ${String(response.status)}`);

  const snapshot = icalToSnapshot(await response.text(), {
    now: new Date(),
    pastMonths: intEnv('ICAL_PAST_MONTHS', 12),
    futureMonths: intEnv('ICAL_FUTURE_MONTHS', 24),
    calendarId: calendarIdFromIcalUrl(url),
  });
  // Round-trip through the browser's parser so we never publish something it rejects.
  const normalised = { ...snapshot, events: parseSnapshot(snapshot).events };

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(normalised)}\n`);
  console.log(
    `Wrote ${String(normalised.events.length)} events (${normalised.range.start} … ${normalised.range.end}) to ${output}`,
  );

  // Tell organisers about typos in event descriptions (docs/event-description.md).
  const report = describeProblems(normalised.events);
  for (const w of report.warnings) console.warn(`[opis] ${w.date} ${w.title}: ${w.message}`);
  if (report.looksFreeBusyOnly)
    console.warn('Most events have no title: is the calendar free/busy only?');
  if (env.GITHUB_STEP_SUMMARY) await appendFile(env.GITHUB_STEP_SUMMARY, reportToMarkdown(report));

  const compareUrl = env.ICAL_COMPARE_URL?.trim();
  const changed = compareUrl
    ? (await deployedFingerprint(compareUrl)) !== fingerprint(normalised)
    : true;
  console.log(compareUrl ? `Changed since last deploy: ${String(changed)}` : 'No comparison URL.');
  if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, `changed=${String(changed)}\n`);
}

main().catch((error: unknown) => {
  console.error(`iCal sync failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
