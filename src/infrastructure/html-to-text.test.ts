import { describe, expect, it } from 'vitest';
import { decodeEntities, htmlToLines } from './html-to-text';

describe('decodeEntities', () => {
  it('decodes named and numeric entities exactly once', () => {
    expect(decodeEntities('a &amp; b &lt;i&gt; &#8211; &#x2013; &nbsp;&quot;')).toBe(
      'a & b <i> – – \u00a0"',
    );
    expect(decodeEntities('&amp;lt;')).toBe('&lt;');
    expect(decodeEntities('&unknown; &#0;')).toBe('&unknown; &#0;');
  });
});

describe('htmlToLines', () => {
  it('splits plain text on any line ending', () => {
    expect(htmlToLines('a\r\nb\rc\nd').map((l) => l.text)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('turns block tags into lines and drops other tags', () => {
    const lines = htmlToLines('<b>game:</b> Pokemon<br>price: 20<p>x</p><ul><li>one</li></ul>');
    expect(lines.map((l) => l.text).filter(Boolean)).toEqual([
      'game: Pokemon',
      'price: 20',
      'x',
      'one',
    ]);
  });

  it('keeps the first href on each line', () => {
    const [line] = htmlToLines(
      'zapisy: <a href="https://www.google.com/url?q=https://x.pl/a&amp;sa=D">Zapisy tutaj</a>',
    );
    expect(line).toEqual({
      text: 'zapisy: Zapisy tutaj',
      href: 'https://www.google.com/url?q=https://x.pl/a&sa=D',
    });
  });

  it('replaces non-breaking spaces', () => {
    expect(htmlToLines('price:&nbsp;20')[0]?.text).toBe('price: 20');
  });
});
