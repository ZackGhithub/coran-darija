/**
 * Marques personnelles sur chaque verset : mémorisé, favori et note.
 * Logique pure (sans React), stockée telle quelle dans le navigateur de l'utilisateur.
 */

export interface VerseMark {
  m?: number; // mémorisé : date de la coche
  f?: number; // favori : date de la coche
  n?: string; // note personnelle
}

export type Marks = Record<string, VerseMark>;
export type Flag = 'm' | 'f';

export const markKey = (surah: number, verse: number) => `${surah}:${verse}`;

export function parseKey(key: string): { surah: number; verse: number } {
  const [s, v] = key.split(':');
  return { surah: Number(s), verse: Number(v) };
}

/** Retire l'entrée si elle ne porte plus aucune marque (garde le stockage petit). */
function clean(marks: Marks, key: string, mark: VerseMark): Marks {
  const next = { ...marks };
  if (mark.m || mark.f || mark.n) next[key] = mark;
  else delete next[key];
  return next;
}

export function toggleFlag(marks: Marks, key: string, flag: Flag, now = Date.now()): Marks {
  const cur = marks[key] ?? {};
  const mark = { ...cur };
  if (mark[flag]) delete mark[flag];
  else mark[flag] = now;
  return clean(marks, key, mark);
}

/** Coche ou décoche plusieurs versets d'un coup (ex : « marquer cette session comme mémorisée »). */
export function setFlags(marks: Marks, keys: string[], flag: Flag, value: boolean, now = Date.now()): Marks {
  let next: Marks | null = null; // copie faite une seule fois, au premier changement réel
  for (const key of keys) {
    const cur = (next ?? marks)[key] ?? {};
    if (!!cur[flag] === value) continue;
    next ??= { ...marks };
    const mark = { ...cur };
    if (value) mark[flag] = now;
    else delete mark[flag];
    if (mark.m || mark.f || mark.n) next[key] = mark;
    else delete next[key];
  }
  return next ?? marks;
}

/** Enregistre la note ; une note vide la supprime. */
export function setNote(marks: Marks, key: string, text: string): Marks {
  const t = text.trim().slice(0, 1000);
  const mark = { ...(marks[key] ?? {}) };
  if (t) mark.n = t;
  else delete mark.n;
  return clean(marks, key, mark);
}

/** Nombre de versets mémorisés par sourate. */
export function memorizedCounts(marks: Marks): Map<number, number> {
  const out = new Map<number, number>();
  for (const [key, mark] of Object.entries(marks)) {
    if (!mark.m) continue;
    const { surah } = parseKey(key);
    out.set(surah, (out.get(surah) ?? 0) + 1);
  }
  return out;
}

export interface SurahInfo {
  n: number;
  verses: number;
}

export function totals(marks: Marks, surahs: SurahInfo[]) {
  const counts = memorizedCounts(marks);
  let verses = 0;
  let complete = 0;
  for (const s of surahs) {
    const c = counts.get(s.n) ?? 0;
    verses += c;
    if (c >= s.verses && s.verses > 0) complete++;
  }
  let favorites = 0;
  let notes = 0;
  for (const mark of Object.values(marks)) {
    if (mark.f) favorites++;
    if (mark.n) notes++;
  }
  return { verses, complete, favorites, notes };
}

/** Versets portant un favori (`f`) ou une note (`n`), dans l'ordre du Coran. */
export function listBy(marks: Marks, what: 'f' | 'n'): { surah: number; verse: number; mark: VerseMark }[] {
  return Object.entries(marks)
    .filter(([, m]) => !!m[what])
    .map(([key, mark]) => ({ ...parseKey(key), mark }))
    .sort((a, b) => a.surah - b.surah || a.verse - b.verse);
}

/**
 * Prochain groupe à apprendre : à partir de `fromSurah`, le premier verset pas encore mémorisé et les deux suivants
 * (jusqu'à la fin de la sourate). Passe aux sourates suivantes si celle-ci est terminée. Null si tout est mémorisé.
 */
export function nextToLearn(marks: Marks, surahs: SurahInfo[], fromSurah: number, size = 3): { surah: number; from: number; to: number } | null {
  const start = Math.max(0, surahs.findIndex((s) => s.n === fromSurah));
  for (let k = 0; k < surahs.length; k++) {
    const s = surahs[(start + k) % surahs.length];
    for (let v = 1; v <= s.verses; v++) {
      if (!marks[markKey(s.n, v)]?.m) return { surah: s.n, from: v, to: Math.min(v + size - 1, s.verses) };
    }
  }
  return null;
}
