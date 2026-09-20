import type { Quarter } from '../types';

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
    symbol: part === 0 ? '۞' : '◦',
    ar: part === 0 ? `${AR[0]} ${hizb}` : AR[part],
    fr: part === 0 ? `${FR[0]} ${hizb}` : `${FR[part]} ${hizb}`,
  };
}

export const quarterKey = (surah: number, ayah: number) => `${surah}:${ayah}`;

/** Index « sourate:verset → quart » pour marquer instantanément le début de chaque quart dans le texte. */
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
