const SVG_NS = 'http://www.w3.org/2000/svg';

/** Stroke icons (24×24 viewBox). Paths are static strings, never event data. */
const PATHS = {
  'chevron-left': ['M15 6l-6 6 6 6'],
  'chevron-right': ['M9 6l6 6-6 6'],
  clock: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M12 7v5l3 2'],
  calendar: [
    'M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    'M3 9h18',
    'M8 2v4',
    'M16 2v4',
  ],
  'calendar-plus': [
    'M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    'M3 9h18',
    'M8 2v4',
    'M16 2v4',
    'M12 12v6',
    'M9 15h6',
  ],
  layers: ['M4 7l8-4 8 4-8 4-8-4z', 'M4 12l8 4 8-4', 'M4 17l8 4 8-4'],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8z',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  pin: [
    'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z',
    'M12 7a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z',
  ],
  navigation: ['M3 11l19-9-9 19-2-8-8-2z'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  external: [
    'M14 4h6v6',
    'M20 4L10 14',
    'M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6',
  ],
  ticket: [
    'M3 8a2 2 0 0 0 0 4v0a2 2 0 0 0 0 4v1a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-1a2 2 0 0 1 0-4a2 2 0 0 1 0-4V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z',
    'M15 6v12',
  ],
} as const;

export type IconName = keyof typeof PATHS;

/** A decorative icon (`aria-hidden`); give the surrounding control a label. */
export function icon(name: IconName, size = 18, strokeWidth = 2.2): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  for (const [key, value] of Object.entries({
    width: String(size),
    height: String(size),
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': String(strokeWidth),
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
    class: `icon icon--${name}`,
  })) {
    svg.setAttribute(key, value);
  }
  for (const d of PATHS[name]) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

/** Neutral logo for events without a catalogue game: a fanned stack of cards. */
export function genericLogo(label: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 96 64');
  svg.setAttribute('class', 'generic-logo');
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  const cards: [number, string, string][] = [
    [-14, '#C9CDD4', '#ffffff'],
    [0, '#9AA0AA', '#ffffff'],
    [14, '#3B414C', '#F6F7F9'],
  ];
  for (const [angle, stroke, fill] of cards) {
    const rect = document.createElementNS(SVG_NS, 'rect');
    for (const [k, v] of Object.entries({
      x: '36',
      y: '10',
      width: '26',
      height: '38',
      rx: '4',
      fill,
      stroke,
      'stroke-width': '2.5',
      transform: `rotate(${String(angle)} 49 56)`,
    })) {
      rect.setAttribute(k, v);
    }
    svg.append(rect);
  }
  const star = document.createElementNS(SVG_NS, 'path');
  star.setAttribute('d', 'M58 20l2 5 5 .5-4 3.5 1.2 5-4.2-2.7-4.2 2.7 1.2-5-4-3.5 5-.5z');
  star.setAttribute('fill', '#3B414C');
  star.setAttribute('transform', 'rotate(14 49 56)');
  svg.append(star);
  return svg;
}
