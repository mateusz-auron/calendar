/**
 * The poster page is published under a secret file name (`<slug>.html`), because
 * GitHub Pages cannot protect a page with a login. These helpers validate the
 * slug that comes from the `POSTER_SLUG` build variable.
 */

/** Letters, digits and dashes; long enough that it cannot be guessed. */
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{10,62})[a-z0-9]$/i;
/** File names the build already uses. */
const RESERVED = new Set(['index', 'poster', 'embed-demo']);

/**
 * The validated slug, or `undefined` when none is set (the page is then not
 * built). An unusable value throws, so a typo cannot silently publish the page
 * under a guessable name.
 */
export function parsePosterSlug(value: string | undefined): string | undefined {
  const slug = value?.trim();
  if (!slug) return undefined;
  if (!SLUG_PATTERN.test(slug) || RESERVED.has(slug.toLowerCase())) {
    throw new Error(
      'POSTER_SLUG must be 12–64 letters, digits or dashes (starting and ending with a letter or digit).',
    );
  }
  return slug;
}

/** File name of the published poster page. */
export function posterFileName(slug: string): string {
  return `${slug}.html`;
}
