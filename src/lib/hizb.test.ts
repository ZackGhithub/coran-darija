import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { hizbOf, hizbRangeOfSurah, indexQuarters, markerFor, partOf, quartersOfHizb } from './hizb';
import type { Meta } from '../types';

const meta: Meta = JSON.parse(readFileSync(new URL('../../public/data/meta.json', import.meta.url), 'utf8'));

describe('hizb', () => {
  it('60 hizb de 4 quarts', () => {
    expect(hizbOf(1)).toBe(1);
    expect(hizbOf(4)).toBe(1);
    expect(hizbOf(5)).toBe(2);
    expect(hizbOf(240)).toBe(60);
    expect(quartersOfHizb(2)).toEqual([5, 6, 7, 8]);
  });

  it('marqueurs : début, quart, moitié, trois quarts', () => {
    expect([1, 2, 3, 4].map((q) => partOf(q))).toEqual([0, 1, 2, 3]);
    expect(markerFor(5).isHizbStart).toBe(true);
    expect(markerFor(5).ar).toBe('الحزب 2');
    expect(markerFor(7).fr).toBe('½ du Hizb 2');
  });

  it('données réelles : 240 quarts, début du hizb 2 à Al-Baqarah 2:75', () => {
    expect(meta.quarters).toHaveLength(240);
    expect(meta.quarters[4]).toMatchObject({ q: 5, surah: 2, ayah: 75 });
    expect(indexQuarters(meta.quarters).get('2:75')?.q).toBe(5);
  });

  it('quarts strictement croissants dans l\'ordre du Coran', () => {
    const q = meta.quarters;
    for (let i = 1; i < q.length; i++) {
      expect(q[i].q).toBe(q[i - 1].q + 1);
      expect(q[i].surah * 1000 + q[i].ayah).toBeGreaterThan(q[i - 1].surah * 1000 + q[i - 1].ayah);
    }
  });

  it('plage de hizb d\'une sourate', () => {
    expect(hizbRangeOfSurah(meta.quarters, 1, 7)).toEqual({ from: 1, to: 1 });
    const baqarah = hizbRangeOfSurah(meta.quarters, 2, 286);
    expect(baqarah.from).toBe(1);
    expect(baqarah.to).toBeGreaterThanOrEqual(5);
  });
});
