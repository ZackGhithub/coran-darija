import { normalizeArabic } from './arabic';

const BASE = import.meta.env.BASE_URL;

/** Instant de début (ms) de chaque mot, par numéro de verset. */
export type VerseTimings = Record<number, number[]>;

const cache = new Map<string, Promise<VerseTimings | null>>();

/**
 * Horodatages réels mot à mot (source : Quran.com), disponibles seulement pour certains récitateurs
 * dont le fichier audio est identique à celui joué par l'app. Null si indisponibles.
 */
export function loadTimings(reciterId: string, surah: number): Promise<VerseTimings | null> {
  const key = `${reciterId}/${surah}`;
  let p = cache.get(key);
  if (!p) {
    p = fetch(`${BASE}data/timing/${reciterId}/${surah}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<VerseTimings>) : null))
      .catch(() => null);
    cache.set(key, p);
  }
  return p;
}

/**
 * Estimation quand on n'a pas d'horodatages réels : la durée du verset est répartie entre les mots
 * selon leur nombre de lettres (les mots longs durent plus longtemps), avec un court silence au début et à la fin.
 */
export function estimateStarts(words: string[], durationMs: number): number[] {
  if (!words.length || durationMs <= 0) return words.map(() => 0);
  const weights = words.map((w) => Math.max(2, normalizeArabic(w).length));
  const total = weights.reduce((a, b) => a + b, 0);
  const lead = durationMs * 0.03;
  const span = Math.max(durationMs - lead - durationMs * 0.05, 1);
  let acc = 0;
  return weights.map((w) => {
    const start = lead + (span * acc) / total;
    acc += w;
    return Math.round(start);
  });
}

/** Index du mot prononcé à l'instant `tMs` (le dernier dont le début est passé), ou -1 avant le premier mot. */
export function wordAt(starts: number[], tMs: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= tMs) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** Texte brut d'une translittération (retire les balises HTML) et découpage en mots. */
export function translitTokens(html: string): string[] {
  return html
    .replace(/<[^>]*>/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Le mot arabe correspondant à un mot de translittération. Les deux textes n'ont pas toujours le même nombre de mots
 * (« wa iyyâka » = 2 mots de translittération pour 1 mot arabe) : on répartit proportionnellement.
 */
export function translitToWord(tokenIndex: number, tokenCount: number, wordCount: number): number {
  if (tokenCount <= 0 || wordCount <= 0) return -1;
  if (tokenCount === wordCount) return tokenIndex;
  return Math.min(wordCount - 1, Math.floor((tokenIndex * wordCount) / tokenCount));
}
