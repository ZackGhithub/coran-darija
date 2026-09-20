/**
 * Masquage du texte pour la mémorisation : à partir d'une certaine lecture, on cache le verset pour réciter de mémoire.
 * Logique pure (sans React ni audio) pour pouvoir la tester.
 */

export type HideMode = 'none' | 'letters' | 'hidden';

export interface HideOptions {
  mode: HideMode;
  hideFrom: number; // masquer à partir de la lecture n° (1 = dès la première)
  hideListen: boolean; // masquer aussi pendant que le récitateur lit (sinon : seulement pendant votre tour)
  verseRepeat: number;
}

export interface Progress {
  status: 'idle' | 'loading' | 'playing' | 'gap' | 'paused' | 'done' | 'error';
  index: number | null; // position du verset en cours dans le groupe
  rep: number; // lecture n° du verset en cours
  group: number; // passage n° sur le groupe
}

/**
 * Niveau de masquage d'un verset à cet instant.
 *  - avant le début, en pause, à la fin ou en erreur : tout est visible (pause = moment pour vérifier)
 *  - un verset est masqué s'il a déjà été lu au moins `hideFrom` fois (les versets d'avant ; ceux d'un passage précédent)
 *  - verset en cours : masqué si sa lecture n° ≥ hideFrom ; pendant que le récitateur lit, seulement si `hideListen`
 */
export function maskFor(o: HideOptions, verseIndex: number, p: Progress): HideMode {
  if (o.mode === 'none') return 'none';
  if (p.status === 'idle' || p.status === 'done' || p.status === 'paused' || p.status === 'error' || p.index === null) return 'none';

  const from = Math.max(1, Math.min(o.hideFrom, o.verseRepeat)); // ne peut pas dépasser le nombre de lectures
  let readSoFar: number;
  if (verseIndex === p.index) readSoFar = p.rep;
  else if (p.group > 1) readSoFar = o.verseRepeat; // déjà lu lors d'un passage précédent
  else readSoFar = verseIndex < p.index ? o.verseRepeat : 0;

  if (readSoFar < from) return 'none';
  if (verseIndex === p.index && (p.status === 'playing' || p.status === 'loading') && !o.hideListen) return 'none';
  return o.mode;
}

const BASE_LETTER = /[ء-يٱ]/;
const ALIF = /[اٱ]/;
const LAM = /ل/;

/**
 * Indice « premières lettres » d'un mot : sa première lettre avec ses voyelles ; pour les mots précédés de l'article
 * (ٱلْحَمْدُ), l'article et la lettre suivante, sinon presque tous les mots commenceraient par le même indice « ٱل ».
 */
export function firstLetters(word: string): string {
  const chars = [...word];
  const bases: number[] = []; // positions des lettres de base
  chars.forEach((c, i) => {
    if (BASE_LETTER.test(c)) bases.push(i);
  });
  if (!bases.length) return word;
  const startsWithArticle = bases.length >= 3 && ALIF.test(chars[bases[0]]) && LAM.test(chars[bases[1]]);
  const keep = startsWithArticle ? 3 : 1; // nombre de lettres de base à montrer
  const stop = bases.length > keep ? bases[keep] : chars.length; // s'arrête juste avant la lettre suivante
  return chars.slice(0, stop).join('');
}
