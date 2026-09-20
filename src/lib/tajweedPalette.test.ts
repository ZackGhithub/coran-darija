import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { TAJWEED_CODES } from './tajweedCodes';

// Les couleurs du Tajwid sont lues dans la feuille de style : elles doivent rester lisibles (thème clair et sombre)
// et suffisamment différentes pour ne pas être confondues.
const css = readFileSync('src/tajweed.css', 'utf8');

function block(start: string): string {
  const i = css.indexOf(start);
  expect(i).toBeGreaterThanOrEqual(0);
  return css.slice(i, css.indexOf('}', i));
}
function palette(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of text.matchAll(/--tj-([a-z-]+):\s*(#[0-9a-f]{6})/gi)) out[m[1]] = m[2];
  return out;
}
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function lum(h: string) {
  const [r, g, b] = rgb(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const dist = (a: string, b: string) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));

const light = palette(block(':root {'));
const dark = palette(block(':root[data-theme="dark"]'));
const autoDark = palette(block('@media (prefers-color-scheme: dark)'));
const names = TAJWEED_CODES.map((c) => c.replace(/_/g, '-'));

describe('palette du Tajwid', () => {
  it('définit les 17 règles dans les trois blocs (clair, sombre forcé, sombre automatique)', () => {
    for (const n of names) {
      expect(light[n], `clair ${n}`).toBeDefined();
      expect(dark[n], `sombre ${n}`).toBeDefined();
      expect(autoDark[n], `auto ${n}`).toBeDefined();
    }
    expect(autoDark).toEqual(dark);
  });

  it('reste lisible : contraste au moins 3:1 avec le fond de la carte', () => {
    for (const n of names) {
      expect(contrast(light[n], '#ffffff'), `clair ${n}`).toBeGreaterThanOrEqual(3);
      expect(contrast(dark[n], '#15221f'), `sombre ${n}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('chaque règle a une couleur bien distincte des autres', () => {
    for (const theme of [light, dark]) {
      for (let i = 0; i < names.length; i++)
        for (let j = i + 1; j < names.length; j++) expect(dist(theme[names[i]], theme[names[j]]), `${names[i]} / ${names[j]}`).toBeGreaterThan(40);
    }
  });

  it('a une classe CSS par règle', () => {
    for (const n of names) expect(css).toContain(`.tj-${n} { color: var(--tj-${n}); }`);
  });
});
