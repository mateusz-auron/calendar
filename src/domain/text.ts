/**
 * Folds text for forgiving comparisons: lower case, no diacritics.
 * `ł` needs explicit mapping because Unicode NFD does not decompose it.
 */
export function foldText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l');
}
