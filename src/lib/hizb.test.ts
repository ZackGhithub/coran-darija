import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { completeHizb, doneQuarters, hizbOf, hizbRangeOfSurah, indexQuarters, isQuarterDone, markerFor, partOf, quarterProgress, quarterVerses, quartersOfHizb } from './hizb';
import { setFlags, type Marks } from './marks';
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

describe('quarts calculés à partir des versets mémorisés', () => {
  const qv = quarterVerses(meta.quarters, meta.surahs);
  const surahsAll = meta.surahs.reduce((n, s) => n + s.verses, 0);

  it('les 240 quarts couvrent les 6236 versets, une seule fois chacun', () => {
    expect(qv).toHaveLength(240);
    expect(qv.every((k) => k.length > 0)).toBe(true);
    const flat = qv.flat();
    expect(flat).toHaveLength(surahsAll);
    expect(flat).toHaveLength(6236);
    expect(new Set(flat).size).toBe(6236);
  });

  it('bornes connues : le quart 1 va de 1:1 à 2:25, le Hizb 1 (4 quarts) finit en 2:74, le quart 5 commence en 2:75, le dernier finit en 114:6', () => {
    expect(qv[0][0]).toBe('1:1');
    expect(qv[0][qv[0].length - 1]).toBe('2:25');
    expect(qv[0]).toHaveLength(7 + 25);
    expect(qv[1][0]).toBe('2:26');
    expect(qv[3][qv[3].length - 1]).toBe('2:74'); // fin du 4e quart = fin du Hizb 1
    expect(qv[4][0]).toBe('2:75');
    expect(qv[239][qv[239].length - 1]).toBe('114:6');
  });

  it('avancement : partiel, puis complet quand tous les versets du quart sont mémorisés', () => {
    const marks: Marks = { '1:1': { m: 1 } };
    let p = quarterProgress(marks, qv);
    expect(p[0]).toEqual({ done: 1, total: 32 });
    expect(isQuarterDone(p[0])).toBe(false);
    for (const k of qv[0]) marks[k] = { m: 1 };
    p = quarterProgress(marks, qv);
    expect(isQuarterDone(p[0])).toBe(true);
    expect(doneQuarters(p)).toEqual([1]);
  });

  it('un Hizb est complet quand ses 4 quarts le sont', () => {
    const marks: Marks = {};
    for (const q of quartersOfHizb(3)) for (const k of qv[q - 1]) marks[k] = { m: 1 };
    const p = quarterProgress(marks, qv);
    expect(completeHizb(p)).toBe(1);
    expect(doneQuarters(p)).toEqual(quartersOfHizb(3));
    delete marks[qv[quartersOfHizb(3)[1] - 1][0]]; // un seul verset en moins
    expect(completeHizb(quarterProgress(marks, qv))).toBe(0);
  });

  it('cocher / décocher un quart entier avec setFlags, sans toucher aux autres marques', () => {
    let marks: Marks = { '2:255': { f: 5, n: 'Ayat al-Kursi' } };
    marks = setFlags(marks, qv[0], 'm', true);
    expect(quarterProgress(marks, qv)[0].done).toBe(32);
    expect(marks['2:255']).toEqual({ f: 5, n: 'Ayat al-Kursi' }); // hors du quart 1 : intact
    marks = setFlags(marks, qv[0], 'm', false);
    expect(Object.keys(marks)).toEqual(['2:255']);
  });

  it('cocher tout le Coran reste rapide (mise à jour avec une seule copie)', () => {
    const t0 = performance.now();
    const all = setFlags({}, qv.flat(), 'm', true);
    expect(Object.keys(all)).toHaveLength(6236);
    expect(performance.now() - t0).toBeLessThan(200);
  });
});
