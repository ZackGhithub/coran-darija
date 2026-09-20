/**
 * Plan de répétition du module de mémorisation (Hifz), sans aucune dépendance à l'audio : facile à tester.
 *
 * Le plan est une suite d'« étapes » numérotées 0, 1, 2… Chaque étape lit UN verset une fois. Pour un groupe de
 * `count` versets, `verseRepeat` lectures de chaque verset, et `groupRepeat` passages sur le groupe entier :
 *
 *   groupe 1 : v1 v1 v1  v2 v2 v2  v3 v3 v3   (verseRepeat = 3)
 *   groupe 2 : v1 v1 v1  v2 v2 v2  v3 v3 v3   (si groupRepeat ≥ 2)
 */

export interface PlanOptions {
  count: number; // nombre de versets du groupe
  verseRepeat: number; // lectures de chaque verset (≥ 1)
  groupRepeat: number; // passages sur le groupe ; 0 = en boucle sans fin
}

export interface Step {
  verseIndex: number; // position dans le groupe (0-based)
  verseRep: number; // lecture n° (1-based) de ce verset
  group: number; // passage n° (1-based)
}

export function stepsPerGroup(o: PlanOptions): number {
  return o.count * Math.max(1, o.verseRepeat);
}

/** Étape n° `idx`, ou null si le plan est terminé. */
export function stepAt(o: PlanOptions, idx: number): Step | null {
  const per = stepsPerGroup(o);
  if (o.count <= 0 || idx < 0 || per === 0) return null;
  const group = Math.floor(idx / per);
  if (o.groupRepeat > 0 && group >= o.groupRepeat) return null;
  const within = idx % per;
  const r = Math.max(1, o.verseRepeat);
  return { verseIndex: Math.floor(within / r), verseRep: (within % r) + 1, group: group + 1 };
}

/** Nombre total d'étapes, ou null pour une boucle sans fin. */
export function totalSteps(o: PlanOptions): number | null {
  return o.groupRepeat > 0 ? stepsPerGroup(o) * o.groupRepeat : null;
}

/**
 * Étape à laquelle sauter pour passer au verset suivant (`dir` = 1) ou précédent (`dir` = -1),
 * en repartant à sa première lecture. Retourne null si on dépasse la fin du plan.
 */
export function skipVerse(o: PlanOptions, idx: number, dir: 1 | -1): number | null {
  const cur = stepAt(o, idx);
  if (!cur) return null;
  const per = stepsPerGroup(o);
  const r = Math.max(1, o.verseRepeat);
  const base = (cur.group - 1) * per;
  const target = cur.verseIndex + dir;
  if (target < 0) return base; // avant le premier verset : on revient au début du groupe
  const next = base + target * r;
  return stepAt(o, next) ? next : null;
}

/** Durée de la pause entre deux lectures, en ms. `verse` = durée du verset (le temps de répéter à voix haute). */
export type PauseMode = '0' | '1' | '2' | '3' | 'verse';

export function pauseMs(mode: PauseMode, verseDurationMs: number, rate: number): number {
  if (mode === 'verse') return Math.round(verseDurationMs / Math.max(rate, 0.1));
  return Number(mode) * 1000;
}
