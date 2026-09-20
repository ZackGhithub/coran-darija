import { describe, expect, it } from 'vitest';
import { pauseMs, skipVerse, stepAt, stepsPerGroup, totalSteps, type PlanOptions } from './hifzPlan';
import { estimateStarts, translitToWord, translitTokens, wordAt } from './timing';

const plan = (o: Partial<PlanOptions> = {}): PlanOptions => ({ count: 3, verseRepeat: 3, groupRepeat: 1, ...o });
const list = (o: PlanOptions, max = 100) => {
  const out: string[] = [];
  for (let i = 0; i < max; i++) {
    const s = stepAt(o, i);
    if (!s) break;
    out.push(`g${s.group}v${s.verseIndex + 1}r${s.verseRep}`);
  }
  return out;
};

describe('plan de répétition', () => {
  it('chaque verset est répété avant de passer au suivant', () => {
    expect(list(plan())).toEqual(['g1v1r1', 'g1v1r2', 'g1v1r3', 'g1v2r1', 'g1v2r2', 'g1v2r3', 'g1v3r1', 'g1v3r2', 'g1v3r3']);
    expect(totalSteps(plan())).toBe(9);
  });

  it('le groupe entier peut être répété', () => {
    const o = plan({ verseRepeat: 2, groupRepeat: 2, count: 2 });
    expect(list(o)).toEqual(['g1v1r1', 'g1v1r2', 'g1v2r1', 'g1v2r2', 'g2v1r1', 'g2v1r2', 'g2v2r1', 'g2v2r2']);
    expect(stepsPerGroup(o)).toBe(4);
  });

  it('un seul verset répété 5 fois', () => {
    expect(list(plan({ count: 1, verseRepeat: 5 }))).toHaveLength(5);
  });

  it('boucle sans fin : le plan ne se termine jamais', () => {
    const o = plan({ count: 2, verseRepeat: 1, groupRepeat: 0 });
    expect(totalSteps(o)).toBeNull();
    expect(stepAt(o, 9999)).not.toBeNull();
    expect(stepAt(o, 5)).toEqual({ verseIndex: 1, verseRep: 1, group: 3 });
  });

  it('cas limites : zéro verset, index négatif, répétition invalide', () => {
    expect(stepAt(plan({ count: 0 }), 0)).toBeNull();
    expect(stepAt(plan(), -1)).toBeNull();
    expect(list(plan({ verseRepeat: 0, count: 2 }))).toEqual(['g1v1r1', 'g1v2r1']); // 0 est traité comme 1
  });

  it('passer au verset suivant / précédent repart à la première lecture', () => {
    const o = plan();
    expect(skipVerse(o, 1, 1)).toBe(3); // dans v1 (2e lecture) -> début de v2
    expect(skipVerse(o, 4, -1)).toBe(0); // dans v2 -> début de v1
    expect(skipVerse(o, 0, -1)).toBe(0); // avant le premier : reste au début
    expect(skipVerse(o, 7, 1)).toBeNull(); // après le dernier verset d'un plan fini : terminé
  });

  it("dans une boucle sans fin, « suivant » sur le dernier verset passe au groupe suivant", () => {
    const o = plan({ count: 2, verseRepeat: 2, groupRepeat: 0 });
    expect(skipVerse(o, 2, 1)).toBe(4); // dernier verset du groupe 1 -> premier du groupe 2
  });

  it('pause : durée fixe ou durée du verset (ajustée au tempo)', () => {
    expect(pauseMs('0', 5000, 1)).toBe(0);
    expect(pauseMs('3', 5000, 1)).toBe(3000);
    expect(pauseMs('verse', 5000, 1)).toBe(5000);
    expect(pauseMs('verse', 5000, 0.5)).toBe(10000); // audio ralenti : il faut plus de temps pour répéter
  });
});

describe('synchronisation mot par mot', () => {
  const starts = [60, 620, 1320, 2460];

  it('trouve le mot prononcé à un instant donné', () => {
    expect(wordAt(starts, 0)).toBe(-1); // silence initial
    expect(wordAt(starts, 60)).toBe(0);
    expect(wordAt(starts, 619)).toBe(0);
    expect(wordAt(starts, 620)).toBe(1);
    expect(wordAt(starts, 2459)).toBe(2);
    expect(wordAt(starts, 99999)).toBe(3); // après le dernier début : reste sur le dernier mot
    expect(wordAt([], 500)).toBe(-1);
  });

  it("estimation : croissante, dans la durée, et les mots longs durent plus longtemps", () => {
    const words = ['ٱلْحَمْدُ', 'لِلَّهِ', 'رَبِّ', 'ٱلْعَـٰلَمِينَ'];
    const est = estimateStarts(words, 5000);
    expect(est).toHaveLength(4);
    for (let i = 1; i < est.length; i++) expect(est[i]).toBeGreaterThan(est[i - 1]);
    expect(est[3]).toBeLessThan(5000);
    expect(est[0]).toBeGreaterThan(0); // court silence avant le premier mot
    // « رب » (3 lettres) dure moins que « العالمين » (8 lettres)
    expect(est[3] - est[2]).toBeLessThan(5000 - est[3]);
  });

  it('estimation : entrées dégénérées', () => {
    expect(estimateStarts([], 5000)).toEqual([]);
    expect(estimateStarts(['قل'], 0)).toEqual([0]);
  });

  it('translittération : découpage et correspondance avec les mots arabes', () => {
    const t = translitTokens("Al-<span class='char-code'>7</span>amdou li-Llâhi Rabbi l-<span class='char-code'>3</span>âlamîn");
    expect(t).toEqual(['Al-7amdou', 'li-Llâhi', 'Rabbi', 'l-3âlamîn']);
    expect(translitToWord(2, 4, 4)).toBe(2); // même nombre de mots : correspondance directe
    expect(translitToWord(0, 5, 4)).toBe(0); // 5 mots de translittération pour 4 mots arabes : proportionnel
    expect(translitToWord(4, 5, 4)).toBe(3);
    expect(translitToWord(0, 0, 4)).toBe(-1);
  });
});
