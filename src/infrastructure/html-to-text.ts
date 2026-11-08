/** One line of a description, plus the target of the first link on it (if any). */
export interface DescriptionLine {
  readonly text: string;
  readonly href?: string;
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
};

/** Decodes HTML entities in a single pass, so `&amp;lt;` becomes `&lt;`, not `<`. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z]+);/gi, (match, body: string) => {
    if (body.startsWith('#')) {
      const hex = body[1] === 'x' || body[1] === 'X';
      const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

const BREAK_TAGS = /<br\s*\/?>|<\/?(?:p|div|li|ul|ol|h[1-6]|tr)\b[^>]*>/gi;
const ANCHOR_HREF = /<a\b[^>]*?\bhref\s*=\s*(["'])(.*?)\1/i;
const ANY_TAG = /<\/?[a-z][^>]*>/gi;

/**
 * Turns a description (HTML from the Google Calendar web editor, or plain text
 * from the mobile apps and iCal) into lines of plain text. Block tags become
 * line breaks; the first link on each line keeps its `href`, so a link inserted
 * with custom text ("Zapisy tutaj") can still be used.
 */
export function htmlToLines(input: string): DescriptionLine[] {
  const normalised = input.replace(/\r\n?/g, '\n').replace(BREAK_TAGS, '\n');
  return normalised.split('\n').map((raw) => {
    const href = ANCHOR_HREF.exec(raw)?.[2];
    const text = decodeEntities(raw.replace(ANY_TAG, '')).replace(/\u00a0/g, ' ');
    return href ? { text, href: decodeEntities(href) } : { text };
  });
}
