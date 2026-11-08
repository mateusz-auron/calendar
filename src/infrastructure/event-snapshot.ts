import { EventSourceError } from './event-source-error';
import { compact, isObject, parseRawTime, str, type RawEvent } from './raw-event';

/**
 * Static `events.json` written at build time by `scripts/sync-ical.ts` and
 * read in the browser by `SnapshotEventRepository`. Versioned so the format
 * can evolve without breaking already-deployed pages.
 */
export interface EventSnapshot {
  readonly version: 1;
  readonly source: 'ical';
  /** ISO instant the snapshot was generated. */
  readonly generatedAt: string;
  /** Inclusive `YYYY-MM-DD` window the snapshot covers. */
  readonly range: { readonly start: string; readonly end: string };
  readonly events: readonly RawEvent[];
}

export const SNAPSHOT_VERSION = 1;

/** Validates untrusted JSON into a snapshot; invalid events are dropped. */
export function parseSnapshot(json: unknown): EventSnapshot {
  if (!isObject(json) || json.version !== SNAPSHOT_VERSION || !Array.isArray(json.events)) {
    throw new EventSourceError('Unsupported or corrupt events snapshot.');
  }
  const range = isObject(json.range) ? json.range : {};
  return {
    version: SNAPSHOT_VERSION,
    source: 'ical',
    generatedAt: str(json.generatedAt) ?? '',
    range: { start: str(range.start) ?? '', end: str(range.end) ?? '' },
    events: json.events.map(parseSnapshotEvent).filter((e): e is RawEvent => e !== undefined),
  };
}

function parseSnapshotEvent(v: unknown): RawEvent | undefined {
  if (!isObject(v)) return undefined;
  const id = str(v.id);
  if (!id) return undefined;
  return {
    id,
    ...compact({
      status: str(v.status),
      title: str(v.title),
      description: str(v.description),
      url: str(v.url),
      start: parseRawTime(v.start),
      end: parseRawTime(v.end),
    }),
  };
}
