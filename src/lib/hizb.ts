import type { Quarter } from '../types';
import type { Marks } from './marks';

/** Le Coran compte 60 hizb (2 par juz) de 4 quarts chacun : 240 quarts au total. */
export const HIZB_COUNT = 60;
export const QUARTER_COUNT = 240;

export const hizbOf = (q: number) => Math.ceil(q / 4);
export const juzOfHizb = (h: number) => Math.ceil(h / 2);
/** 0 = début du hizb, 1 = quart (ربع), 2 = moitié (نصف), 3 = trois quarts (ثلاثة أرباع). */
export const partOf = (q: number) => (q - 1) % 4;

const AR = ['الحزب', 'ربع الحزب', 'نصف الحزب', 'ثلاثة أرباع الحزب'];
const FR = ['Début du Hizb', '¼ du Hizb', '½ du Hizb', '¾ du Hizb'];

export interface HizbMarker {
  hizb: number;
  part: number;
  isHizbStart: boolean;
  symbol: string;
  ar: string;
  fr: string;
}

export function markerFor(q: number): HizbMarker {
  const hizb = hizbOf(q);
  const part = partOf(q);
  return {
    hizb,
    part,
    isHizbStart: part === 0,
    symbol: part === 0 ? '۞' : '', // ۞ : signe du texte coranique ; le repère des autres quarts est une icône dessinée dans l'interface
    ar: part === 0 ? `${AR[0]} ${hizb}` : AR[part],
    fr: part === 0 ? `${FR[0]} ${hizb}` : `${FR[part]} ${hizb}`,
  };
}

export const quarterKey = (surah: number, ayah: number) => `${surah}:${ayah}`;

/** Index « sourate:verset » vers quart, pour marquer instantanément le début de chaque quart dans le texte. */
export function indexQuarters(quarters: Quarter[]): Map<string, Quarter> {
  return new Map(quarters.map((q) => [quarterKey(q.surah, q.ayah), q]));
}

/** Les 4 quarts d'un hizb (numéro 1..60). */
export function quartersOfHizb(hizb: number): number[] {
  const first = (hizb - 1) * 4 + 1;
  return [first, first + 1, first + 2, first + 3];
}

/** Hizb dans lesquels une sourate a des versets (d'après le début des quarts). */
export function hizbRangeOfSurah(quarters: Quarter[], surah: number, verseCount: number): { from: number; to: number } {
  let start = 1;
  let last = 1;
  for (const q of quarters) {
    if (q.surah < surah || (q.surah === surah && q.ayah <= 1)) start = q.q;
    if (q.surah < surah || (q.surah === surah && q.ayah <= verseCount)) last = q.q;
  }
  return { from: hizbOf(start), to: hizbOf(last) };
}

export interface SurahSize {
  n: number;
  verses: number;
}

/**
 * Versets (clés « sourate:verset ») de chacun des 240 quarts, dans l'ordre : l'entrée d'indice q-1 est le quart q.
 * Un quart commence à son premier verset et s'arrête juste avant le début du suivant.
 */
export function quarterVerses(quarters: Quarter[], surahs: SurahSize[]): string[][] {
  const all = surahs.flatMap((s) => Array.from({ length: s.verses }, (_, i) => `${s.n}:${i + 1}`));
  const pos = new Map(all.map((k, i) => [k, i]));
  return quarters.map((q, i) => {
    const start = pos.get(quarterKey(q.surah, q.ayah)) ?? 0;
    const next = quarters[i + 1];
    const end = next ? (pos.get(quarterKey(next.surah, next.ayah)) ?? all.length) : all.length;
    return all.slice(start, end);
  });
}

export interface QuarterProgress {
  done: number; // versets mémorisés
  total: number; // versets du quart
}

/** Avancement de chaque quart (indice q-1), calculé à partir des versets cochés « mémorisé » : source de vérité unique. */
export function quarterProgress(marks: Marks, qv: string[][]): QuarterProgress[] {
  return qv.map((keys) => {
    let done = 0;
    for (const k of keys) if (marks[k]?.m) done++;
    return { done, total: keys.length };
  });
}

/** Un quart est fait quand tous ses versets sont mémorisés. */
export const isQuarterDone = (p: QuarterProgress | undefined) => !!p && p.total > 0 && p.done === p.total;

/** Numéros (1..240) des quarts faits. */
export const doneQuarters = (progress: QuarterProgress[]) => progress.flatMap((p, i) => (isQuarterDone(p) ? [i + 1] : []));

/** Nombre de Hizb dont les 4 quarts sont faits. */
export function completeHizb(progress: QuarterProgress[]): number {
  let n = 0;
  for (let h = 1; h <= HIZB_COUNT; h++) if (quartersOfHizb(h).every((q) => isQuarterDone(progress[q - 1]))) n++;
  return n;
}
