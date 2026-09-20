/**
 * Comparaison d'une récitation reconnue par la voix avec le texte coranique.
 *
 * La reconnaissance vocale renvoie de l'arabe « courant » (sans voyelles, orthographe standard) alors que le
 * texte coranique est en graphie uthmanique. On compare donc le squelette consonantique : cela valide les
 * MOTS prononcés, pas les voyelles brèves ni le tajwid (le moteur vocal ne les distingue pas de façon fiable).
 */

export type WordStatus = 'pending' | 'ok' | 'wrong';

/** Voyelles, signes coraniques, tatweel, caractères invisibles. */
const MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ﻿​-‏]/g;

/** Ramène un mot arabe à un squelette comparable. */
export function normalizeArabic(word: string): string {
  return word
    .replace(/ٰ/g, 'ا') // alef en exposant : c'est un vrai « a » long (السَّمَٰوَٰتِ = السماوات), pas une simple voyelle
    .replace(MARKS, '')
    .replace(/[ٱأإآٲٳ]/g, 'ا')
    .replace(/[ىئ]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ة/g, 'ه')
    .replace(/[^ء-ي]/g, '') // ne garde que les lettres arabes de base
    .replace(/ء/g, '');
}

/** Découpe un verset en mots à comparer (ignore les signes de pause coraniques isolés). */
export function tokenizeVerse(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => normalizeArabic(w).length > 0);
}

/** Découpe la transcription vocale en mots normalisés. */
export function tokenizeSpoken(text: string): string[] {
  return text
    .split(/\s+/)
    .map(normalizeArabic)
    .filter((w) => w.length > 0);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Nombre de fautes tolérées selon la longueur du mot attendu (le moteur vocal se trompe parfois d'une lettre). */
export function allowedErrors(targetLen: number): number {
  if (targetLen <= 3) return 0;
  if (targetLen <= 6) return 1;
  return 2;
}

/** L'orthographe coranique et l'orthographe courante ne notent pas les « a » longs pareil : on compare sans alef. */
const noAlef = (w: string) => {
  const s = w.replace(/ا/g, '');
  return s.length > 0 ? s : w;
};

/** Le moteur vocal ajoute ou retire souvent le « و » de liaison (« السماوات » entendu « والسماوات »). */
const withoutLeadingWaw = (w: string) => (w.length > 3 && w[0] === 'و' ? w.slice(1) : w);

export function wordsMatch(target: string, spoken: string): boolean {
  for (const t of new Set([target, withoutLeadingWaw(target)])) {
    for (const s of new Set([spoken, withoutLeadingWaw(spoken)])) {
      const a = noAlef(t);
      if (levenshtein(a, noAlef(s)) <= allowedErrors(a.length)) return true;
    }
  }
  return false;
}

const COST_WRONG = 1.2; // mot prononcé aligné sur un mot attendu mais différent
const COST_SKIP = 1; // mot attendu non prononcé
const COST_EXTRA = 1.5; // mot prononcé en trop (ignoré) ; plus cher qu'une erreur pour qu'un mot faux en fin de verset reste rouge

/**
 * Aligne les mots prononcés sur les mots attendus (programmation dynamique, fin du verset libre).
 * - mot reconnu               : 'ok'    (vert)
 * - mot prononcé mais différent, ou mot sauté avant un mot reconnu : 'wrong' (rouge)
 * - mots après le dernier mot prononcé                             : 'pending' (neutre)
 * `provisionalLast` : pendant la reconnaissance en cours, le dernier mot prononcé est peut-être incomplet ;
 * s'il est le début du mot attendu, il reste neutre au lieu de clignoter en rouge.
 */
export interface Alignment {
  status: WordStatus[];
  /** Pour chaque mot dit : index du mot attendu auquel il est associé, ou -1 s'il est en trop. */
  spokenToTarget: number[];
}

export function alignDetailed(target: string[], spoken: string[], opts: { provisionalLast?: boolean } = {}): Alignment {
  const T = target.map(normalizeArabic);
  const S = spoken;
  const m = T.length;
  const n = S.length;
  const status: WordStatus[] = new Array(m).fill('pending');
  const spokenToTarget: number[] = new Array(n).fill(-1);
  if (n === 0 || m === 0) return { status, spokenToTarget };

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(Infinity));
  const back: string[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(''));
  dp[0][0] = 0;
  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= n; j++) {
      if (i === 0 && j === 0) continue;
      let best = Infinity;
      let move = '';
      if (i > 0 && j > 0 && dp[i - 1][j - 1] < Infinity) {
        const ok = wordsMatch(T[i - 1], S[j - 1]);
        const c = dp[i - 1][j - 1] + (ok ? 0 : COST_WRONG);
        if (c < best) { best = c; move = ok ? 'match' : 'sub'; }
      }
      if (i > 0 && dp[i - 1][j] < Infinity) {
        const c = dp[i - 1][j] + COST_SKIP;
        if (c < best) { best = c; move = 'skip'; }
      }
      if (j > 0 && dp[i][j - 1] < Infinity) {
        const c = dp[i][j - 1] + COST_EXTRA;
        if (c < best) { best = c; move = 'extra'; }
      }
      dp[i][j] = best;
      back[i][j] = move;
    }
  }

  // Fin libre : on s'arrête au mot attendu qui minimise le coût une fois toute la parole consommée.
  let endI = 0;
  for (let i = 0; i <= m; i++) if (dp[i][n] < dp[endI][n] - 1e-9 || (dp[i][n] <= dp[endI][n] + 1e-9 && i > endI)) endI = i;

  let i = endI;
  let j = n;
  while (i > 0 || j > 0) {
    const mv = back[i][j];
    if (mv === 'match') { status[i - 1] = 'ok'; spokenToTarget[j - 1] = i - 1; i--; j--; }
    else if (mv === 'sub') {
      const partial = opts.provisionalLast && j === n && T[i - 1].startsWith(S[j - 1]);
      status[i - 1] = partial ? 'pending' : 'wrong';
      spokenToTarget[j - 1] = i - 1;
      i--; j--;
    }
    else if (mv === 'skip') { status[i - 1] = 'wrong'; i--; }
    else if (mv === 'extra') { j--; }
    else break;
  }
  for (let k = endI; k < m; k++) status[k] = 'pending';
  return { status, spokenToTarget };
}

export function alignRecitation(target: string[], spoken: string[], opts: { provisionalLast?: boolean } = {}): WordStatus[] {
  return alignDetailed(target, spoken, opts).status;
}

/** Découpe l'affichage d'un verset : chaque segment porte l'index du mot à colorier (null pour les signes de pause). */
export function splitVerse(text: string): { text: string; idx: number | null }[] {
  let idx = 0;
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => (normalizeArabic(t).length > 0 ? { text: t, idx: idx++ } : { text: t, idx: null }));
}

/**
 * Comparaison à partir du mot `startAt` : les mots avant gardent le statut qu'ils avaient (`frozen`),
 * seul le reste du verset est comparé à ce qui est dit. Sert à « reprendre à partir de ce mot ».
 */
export function alignFrom(
  target: string[],
  startAt: number,
  frozen: WordStatus[],
  spoken: string[],
  opts: { provisionalLast?: boolean } = {},
): WordStatus[] {
  const head: WordStatus[] = Array.from({ length: Math.min(startAt, target.length) }, (_, i) => frozen[i] ?? 'pending');
  return [...head, ...alignRecitation(target.slice(startAt), spoken, opts)];
}

/** Mots récents que le moteur vocal peut encore réviser : on ne les fige pas. */
const STREAM_MARGIN = 24;
/** Mots attendus examinés au-delà de ce qui a été dit (pour rattraper des mots sautés). */
const STREAM_SLACK = 40;

/**
 * Comparaison « au fil de l'eau » pour une récitation longue (une sourate entière, des milliers de mots).
 *
 * Comparer tout ce qui a été dit à tout le texte à chaque nouveau mot serait bien trop lent sur un téléphone
 * (coût proportionnel au produit des deux longueurs). Ici, tout ce qui est plus ancien que STREAM_MARGIN mots est
 * figé, et seule une petite fenêtre autour de la position actuelle est recalculée : coût quasi constant.
 *
 * Un aligneur correspond à UNE session d'écoute : si la transcription repart de zéro, il faut en créer un nouveau.
 */
export class StreamAligner {
  private tPos: number; // premier mot attendu non figé
  private sPos = 0; // premier mot dit non figé
  private done: WordStatus[]; // statuts figés (longueur = tPos)
  private readonly target: string[];

  constructor(target: string[], startAt = 0, head: WordStatus[] = []) {
    this.target = target;
    this.tPos = Math.min(startAt, target.length);
    this.done = Array.from({ length: this.tPos }, (_, i) => head[i] ?? 'pending');
  }

  update(spoken: string[], opts: { provisionalLast?: boolean } = {}): WordStatus[] {
    const tail = spoken.slice(this.sPos);
    const t0 = this.tPos;
    const win = this.target.slice(t0, t0 + tail.length + STREAM_SLACK);
    const { status, spokenToTarget } = alignDetailed(win, tail, opts);

    // Fige ce qui est assez ancien pour ne plus changer.
    let frozen = 0;
    const cut = tail.length - STREAM_MARGIN;
    if (cut > 0) {
      let last = -1;
      for (let j = 0; j < cut; j++) last = Math.max(last, spokenToTarget[j]);
      if (last >= 0) {
        frozen = last + 1;
        this.done.push(...status.slice(0, frozen));
        this.tPos += frozen;
        this.sPos += cut;
      }
    }
    const pendingAfterWindow = this.target.length - (t0 + win.length);
    return [...this.done, ...status.slice(frozen), ...new Array<WordStatus>(pendingAfterWindow).fill('pending')];
  }
}

/** Résumé pour l'affichage et la progression. */
export function summarize(status: WordStatus[]) {
  const ok = status.filter((s) => s === 'ok').length;
  const wrong = status.filter((s) => s === 'wrong').length;
  const pending = status.length - ok - wrong;
  return { ok, wrong, pending, total: status.length, perfect: status.length > 0 && ok === status.length };
}
