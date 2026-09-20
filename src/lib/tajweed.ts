import { TAJWEED_CODES } from './tajweedCodes';
import { HEAVY_LETTERS, LETTER_NAME, QALQALA_MAKHRAJ, TRIGGERS } from '../content/tajweedRules';

const BASE_URL = import.meta.env?.BASE_URL ?? '/';

/** Un fragment coloré : positions dans le texte du verset, et numéro de la règle (index dans TAJWEED_CODES). */
export interface Fragment {
  start: number;
  end: number;
  rule: number;
}

/** Morceau d'un mot : son texte, et la règle qui le colore (-1 = aucune). */
export interface Piece {
  text: string;
  rule: number;
  start: number; // position dans le texte du verset
}

export interface ExampleEntry {
  s: number; // sourate
  v: number; // verset
  w: number; // index du mot dans le verset
  t: [string, number][]; // le mot en morceaux (texte, règle)
}
export type Examples = Record<string, ExampleEntry[]>;

// ---------------------------------------------------------------------------------------------------- données

const cache = new Map<number, Promise<Record<number, number[]>>>();
let examplesPromise: Promise<Examples> | null = null;

/** Fragments colorés de toute une sourate : { verset: [début, fin, règle, début, fin, règle, …] }. */
export function loadTajweed(surah: number): Promise<Record<number, number[]>> {
  let p = cache.get(surah);
  if (!p) {
    p = fetch(`${BASE_URL}data/tajweed/${surah}.json`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<Record<number, number[]>>;
    });
    p.catch(() => cache.delete(surah));
    cache.set(surah, p);
  }
  return p;
}

export function loadExamples(): Promise<Examples> {
  examplesPromise ??= fetch(`${BASE_URL}data/tajweed/examples.json`).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<Examples>;
  });
  examplesPromise.catch(() => (examplesPromise = null));
  return examplesPromise;
}

export function decodeSpans(flat: number[] | undefined): Fragment[] {
  const out: Fragment[] = [];
  if (!flat) return out;
  for (let i = 0; i + 2 < flat.length; i += 3) out.push({ start: flat[i], end: flat[i + 1], rule: flat[i + 2] });
  return out;
}

// ---------------------------------------------------------------------------------------------------- découpage

/** Découpe un mot en morceaux (texte, règle) d'après les fragments qui le recouvrent. */
export function wordPieces(verse: string, wordStart: number, wordEnd: number, frags: Fragment[]): Piece[] {
  const pieces: Piece[] = [];
  let pos = wordStart;
  for (const f of frags) {
    if (f.end <= wordStart || f.start >= wordEnd) continue;
    const a = Math.max(f.start, wordStart);
    const b = Math.min(f.end, wordEnd);
    if (a > pos) pieces.push({ text: verse.slice(pos, a), rule: -1, start: pos });
    if (b > a) pieces.push({ text: verse.slice(a, b), rule: f.rule, start: a });
    pos = Math.max(pos, b);
  }
  if (pos < wordEnd) pieces.push({ text: verse.slice(pos, wordEnd), rule: -1, start: pos });
  return pieces;
}

/** Règles présentes dans un mot, sans doublon, dans l'ordre. */
export const rulesOfPieces = (pieces: Piece[]) => [...new Set(pieces.filter((p) => p.rule >= 0).map((p) => p.rule))];

// ---------------------------------------------------------------------------------------------------- contexte d'un fragment

/** Lettres qui portent le son (ni voyelles, ni signes, ni tatweel, ni alef en exposant). */
const BASE = /[ء-غف-يٱ]/;
export const baseLetters = (s: string) => [...s].filter((c) => BASE.test(c));

const HAMZA = new Set(['ء', 'أ', 'إ', 'ؤ', 'ئ', 'آ']);
const TANWEEN = /[ً-ٍ]/;
const SHADDA = /ّ/;
const SUKUN = /[ْۡ]/;
/** Petit rond au-dessus d'une lettre : elle est écrite mais muette. */
const SILENT_MARK = /[۟۠]/;
const SPACE = /\s/;

export interface Context {
  code: string;
  fragment: string; // texte du fragment coloré
  word: string; // le mot entier
  letters: string[]; // lettres du fragment
  hasTanween: boolean;
  next: string | null; // première lettre prononcée après le fragment (mot suivant compris, lettres muettes ignorées)
  nextInWord: boolean; // cette lettre est dans le même mot
  nextMarks: string; // signes portés par cette lettre (shadda, soukoun…)
  rest: string[]; // lettres qui restent dans le mot après le fragment
  hamzaMarkNext: boolean; // une petite hamza (signe au-dessus d'un tatweel) suit le fragment dans le mot
  atVerseEnd: boolean; // plus aucune lettre après le fragment dans le verset
  wordIsLast: boolean; // le mot est le dernier du verset
}

export function contextOf(verse: string, frag: Fragment): Context {
  const fragment = verse.slice(frag.start, frag.end);
  let ws = frag.start;
  while (ws > 0 && !SPACE.test(verse[ws - 1])) ws--;
  let we = frag.end;
  while (we < verse.length && !SPACE.test(verse[we])) we++;

  const after = [...verse.slice(frag.end)];
  // signes portés par la lettre d'indice k (jusqu'à la lettre suivante)
  const marksOf = (k: number) => {
    let m = '';
    for (let j = k + 1; j < after.length && !BASE.test(after[j]) && !SPACE.test(after[j]); j++) m += after[j];
    return m;
  };
  // Première lettre PRONONCÉE après le fragment : on saute les lettres muettes (petit rond au-dessus)
  let idx = -1;
  for (let k = 0; k < after.length; k++) {
    if (BASE.test(after[k]) && !SILENT_MARK.test(marksOf(k))) {
      idx = k;
      break;
    }
  }
  const restLetters = baseLetters(verse.slice(frag.end, we));
  // La hamza est parfois écrite comme un petit signe posé sur un tatweel (« يَٰٓـَٔادَمُ »), et non comme une lettre.
  const firstBase = after.findIndex((c) => BASE.test(c));
  const gap = (firstBase < 0 ? after : after.slice(0, firstBase)).join('');
  return {
    code: TAJWEED_CODES[frag.rule],
    fragment,
    word: verse.slice(ws, we),
    letters: baseLetters(fragment),
    hasTanween: TANWEEN.test(fragment),
    next: idx >= 0 ? after[idx] : null,
    nextInWord: idx >= 0 && after.slice(0, idx).every((c) => !SPACE.test(c)),
    nextMarks: idx >= 0 ? marksOf(idx) : '',
    rest: restLetters,
    hamzaMarkNext: !SPACE.test(gap) && /[\u0654\u0655]/.test(gap),
    atVerseEnd: idx < 0,
    wordIsLast: baseLetters(verse.slice(we)).length === 0,
  };
}

/**
 * Lettre qui déclenche la règle. Le fragment coloré peut déjà contenir le noun ET la lettre suivante (« نت »,
 * « ن رَّ », même de part et d'autre d'un espace) : c'est alors sa dernière lettre. Sinon c'est la lettre d'après.
 * Et si seule la lettre déclencheur est colorée (le « ب » de l'iqlāb), c'est elle-même.
 */
export function triggerOf(ctx: Context): string | null {
  const expected = TRIGGERS[ctx.code];
  if (!expected) return ctx.next;
  const last = ctx.letters[ctx.letters.length - 1] ?? null;
  const candidates = ctx.letters.length >= 2 ? [last, ctx.next] : [ctx.next, last];
  return candidates.find((c): c is string => !!c && expected.includes(c)) ?? candidates[0] ?? null;
}

const name = (l: string | null) => (l ? `« ${l} » (${LETTER_NAME[l] ?? 'lettre'})` : 'la lettre suivante');
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
/** Ce que le noun est dans ce mot : tanwîn ou noun sans voyelle (si le fragment ne le montre pas, on reste général). */
const noonSource = (ctx: Context) => (ctx.hasTanween ? 'un tanwîn' : ctx.letters[0] === 'ن' ? 'un noun sans voyelle' : 'un noun sans voyelle ou un tanwîn');

// ---------------------------------------------------------------------------------------------------- « pourquoi ici »

/** Explique pourquoi la règle s'applique à CE mot, d'après ses vraies lettres. Retourne des phrases courtes. */
export function whyHere(ctx: Context): string[] {
  const t = triggerOf(ctx);
  switch (ctx.code) {
    case 'ham_wasl': {
      const article = baseLetters(ctx.word).slice(0, 2).join('') === 'ٱل';
      return [
        article ? "Le mot commence par l'article « ال » : son alif est une hamza d'union." : "Le mot commence par une hamza d'union (alif écrit ٱ).",
        'Elle se prononce seulement si vous commencez la récitation sur ce mot ; en enchaînant, elle disparaît.',
      ];
    }
    case 'slnt':
      return ['Cette lettre est écrite dans le texte mais ne se prononce pas.', 'Le mot se termine sur la lettre qui la précède.'];
    case 'laam_shamsiyah':
      return [
        `Le lam de l'article est suivi de ${name(ctx.next)}, une lettre solaire.`,
        `Le lam ne se prononce pas : ${ctx.next ? `« ${ctx.next} »` : 'la lettre suivante'} est doublée (c'est la shadda que vous voyez sur elle).`,
      ];
    case 'madda_normal':
      return ["Une lettre de prolongation n'est suivie ni d'une hamza ni d'un soukoun.", "C'est donc un madd naturel : on tient la voyelle 2 temps, ni plus ni moins."];
    case 'madda_permissible': {
      const last = ctx.rest.length === 1 ? ctx.rest[0] : null;
      const stop = ctx.wordIsLast ? 'Ce mot termine le verset : en vous y arrêtant' : 'En vous arrêtant sur ce mot';
      return [
        `${stop}, sa dernière lettre${last ? ` (${name(last)})` : ''} reçoit un soukoun, seulement pour l'arrêt.`,
        'La lettre de prolongation qui la précède peut alors être tenue 2, 4 ou 6 temps. En continuant sans vous arrêter, cette prolongation disparaît.',
      ];
    }
    case 'madda_obligatory': {
      if ((ctx.rest.length > 0 && HAMZA.has(ctx.rest[0])) || ctx.hamzaMarkNext) return ["La lettre de prolongation est suivie d'une hamza dans le même mot (madd muttaṣil).", 'Prolongation de 4 ou 5 temps, toujours la même.'];
      if (ctx.next && HAMZA.has(ctx.next) && !ctx.nextInWord) return ['La lettre de prolongation termine le mot et le mot suivant commence par une hamza (madd munfaṣil).', 'Dans cette lecture, prolongation de 4 ou 5 temps.'];
      return ["La lettre de prolongation est suivie d'une hamza (dans le mot, ou au début du mot suivant).", 'Prolongation de 4 ou 5 temps.'];
    }
    case 'madda_necessary': {
      if (SHADDA.test(ctx.nextMarks)) return [`La lettre de prolongation est suivie de ${name(ctx.next)}, qui porte une shadda (lettre doublée).`, 'Le madd est nécessaire : 6 temps, toujours.'];
      if (SUKUN.test(ctx.nextMarks)) return [`La lettre de prolongation est suivie de ${name(ctx.next)}, qui porte un soukoun permanent.`, 'Le madd est nécessaire : 6 temps, toujours.'];
      return ['Ce sont des lettres épelées qui ouvrent la sourate : chacune se prononce par son nom, avec une prolongation.', 'Le madd est nécessaire : 6 temps, toujours.'];
    }
    case 'qalaqah': {
      const l = ctx.letters[0] ?? null;
      const out = [`${cap(name(l))} est l'une des cinq lettres de la qalqala (ق ط ب ج د) et elle est sans voyelle${ctx.atVerseEnd ? ' parce que vous vous arrêtez dessus en fin de verset' : ''}.`];
      if (l && QALQALA_MAKHRAJ[l]) out.push(`Son point d'articulation : ${QALQALA_MAKHRAJ[l]}.`);
      out.push(ctx.atVerseEnd ? "Elle termine le verset : le rebond est plus marqué à l'arrêt." : 'Elle est au milieu du verset : le rebond est léger.');
      return out;
    }
    case 'ghunnah':
      return [`${cap(name(ctx.letters[0] ?? null))} porte une shadda : elle est doublée.`, 'La ghunna est obligatoire sur un noun ou un mim doublé : 2 temps de nasalisation.'];
    case 'ikhafa': {
      const heavy = t ? HEAVY_LETTERS.has(t) : false;
      return [
        `${cap(noonSource(ctx))} est suivi de ${name(t)}, l'une des 15 lettres de l'ikhfā'.`,
        `Le noun est donc caché : on nasalise 2 temps sans toucher le palais${t ? `, avec un son ${heavy ? 'plus plein (lettre lourde)' : 'plus léger'}` : ''}.`,
      ];
    }
    case 'ikhafa_shafawi':
      return [`Le mim sans voyelle est suivi de ${name(t ?? 'ب')}.`, 'Les lèvres se rapprochent à peine et on nasalise 2 temps.'];
    case 'iqlab':
      return [`${cap(name(t ?? 'ب'))} suit ${noonSource(ctx)}.`, 'Le noun se change en un mim caché (petit mim écrit au-dessus) : lèvres à peine rapprochées, 2 temps de nasalisation.'];
    case 'idgham_ghunnah':
      return [
        `${cap(noonSource(ctx))} en fin de mot est suivi de ${name(t)} au début du mot suivant.`,
        `${t ? `« ${t} »` : 'Cette lettre'} fait partie de « يَنْمُو » : le noun se fond dedans, qui se double, avec 2 temps de nasalisation.`,
      ];
    case 'idgham_wo_ghunnah':
      return [
        `${cap(noonSource(ctx))} en fin de mot est suivi de ${name(t)} au début du mot suivant.`,
        `${t ? `« ${t} »` : 'Cette lettre'} est ل ou ر : le noun se fond complètement dedans, qui se double, sans nasalisation.`,
      ];
    case 'idgham_shafawi':
      return ["Un mim sans voyelle est suivi d'un autre mim.", 'Les deux se fondent en un seul mim doublé, nasalisé 2 temps.'];
    case 'idgham_mutajanisayn':
      return [`${cap(name(ctx.letters[0] ?? null))}, sans voyelle, est suivie de ${name(t)} : deux lettres qui sortent du même endroit de la bouche.`, 'La première se fond dans la seconde, qui se double.'];
    case 'idgham_mutaqaribayn':
      return [`${cap(name(ctx.letters[0] ?? null))}, sans voyelle, est suivie de ${name(t)} : deux lettres aux articulations proches.`, 'La première se fond dans la seconde, qui se double.'];
    default:
      return [];
  }
}

/** La lettre déclencheur fait-elle partie des lettres attendues pour cette règle ? (contrôle des données) */
export function triggerIsExpected(ctx: Context): boolean {
  const list = TRIGGERS[ctx.code];
  if (!list) return true;
  const t = triggerOf(ctx);
  return !!t && list.includes(t);
}
