import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { TAJWEED_CODES } from './tajweedCodes';
import { HEAVY_LETTERS, LETTER_NAME, RULES, RULE_BY_CODE, TRIGGERS } from '../content/tajweedRules';
import { contextOf, decodeSpans, rulesOfPieces, triggerIsExpected, triggerOf, whyHere, wordPieces } from './tajweed';

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const verses = (n: number) => read(`../../public/data/surah/${n}.json`).verses as { n: number; ar: string }[];
const tajweed = (n: number) => read(`../../public/data/tajweed/${n}.json`) as Record<number, number[]>;
const verse = (s: number, v: number) => verses(s).find((x) => x.n === v)!.ar;
const HAMZA = new Set(['ء', 'أ', 'إ', 'ؤ', 'ئ', 'آ']);
const SOLAR = new Set('تثدذرزسشصضطظلن');

/** Parcourt tous les fragments du Coran. */
function everyFragment(fn: (ref: string, ctx: ReturnType<typeof contextOf>) => void) {
  for (let n = 1; n <= 114; n++) {
    const tj = tajweed(n);
    for (const v of verses(n)) for (const f of decodeSpans(tj[v.n])) fn(`${n}:${v.n}`, contextOf(v.ar, f));
  }
}

describe('contenu des fiches', () => {
  it('une fiche pour chacune des 17 règles, sans doublon, dans le même ordre que les données', () => {
    expect(TAJWEED_CODES).toHaveLength(17);
    expect(new Set(RULES.map((r) => r.code)).size).toBe(17);
    for (const c of TAJWEED_CODES) expect(RULE_BY_CODE[c], c).toBeTruthy();
  });

  it('chaque fiche est complète : nom arabe et français, condition, étapes, erreurs à éviter', () => {
    for (const r of RULES) {
      expect(r.ar.length, r.code).toBeGreaterThan(2);
      expect(r.fr.length, r.code).toBeGreaterThan(5);
      expect(r.summary.length, r.code).toBeGreaterThan(20);
      expect(r.when.length, r.code).toBeGreaterThan(30);
      expect(r.how.length, r.code).toBeGreaterThanOrEqual(2);
      expect(r.mistakes.length, r.code).toBeGreaterThanOrEqual(1);
    }
  });

  it('les règles à durée indiquent le nombre de temps', () => {
    for (const c of ['madda_normal', 'madda_permissible', 'madda_obligatory', 'madda_necessary', 'ghunnah']) expect(RULE_BY_CODE[c].timing, c).toBeTruthy();
  });
});

describe('données : toute la coloration du Coran', () => {
  it('les fragments sont valides : dans le verset, triés, sans chevauchement, règle connue', () => {
    let total = 0;
    for (let n = 1; n <= 114; n++) {
      const tj = tajweed(n);
      for (const v of verses(n)) {
        const frags = decodeSpans(tj[v.n]);
        let prev = 0;
        for (const f of frags) {
          total++;
          expect(f.start, `${n}:${v.n}`).toBeGreaterThanOrEqual(prev);
          expect(f.end, `${n}:${v.n}`).toBeGreaterThan(f.start);
          expect(f.end, `${n}:${v.n}`).toBeLessThanOrEqual(v.ar.length);
          expect(f.rule, `${n}:${v.n}`).toBeGreaterThanOrEqual(0);
          expect(f.rule, `${n}:${v.n}`).toBeLessThan(17);
          prev = f.end;
        }
      }
    }
    expect(total).toBeGreaterThan(59000);
  });

  it('chaque fragment produit une explication complète, jamais vide', () => {
    let empty = 0;
    everyFragment((_ref, ctx) => {
      if (whyHere(ctx).filter(Boolean).length < 2) empty++;
    });
    expect(empty).toBe(0);
  });

  // Les hypothèses sur lesquelles reposent les explications « pourquoi ici », vérifiées sur les 59 844 fragments.
  it("lam solaire : toujours un lam suivi d'une lettre solaire", () => {
    const bad: string[] = [];
    everyFragment((ref, c) => c.code === 'laam_shamsiyah' && !(c.letters[0] === 'ل' && SOLAR.has(c.next ?? '#')) && bad.push(ref));
    expect(bad).toEqual([]);
  });

  it("qalqala : toujours l'une des 5 lettres ق ط ب ج د", () => {
    const bad: string[] = [];
    everyFragment((ref, c) => c.code === 'qalaqah' && !'قطبجد'.includes(c.letters[0] ?? '#') && bad.push(ref));
    expect(bad).toEqual([]);
  });

  it('ghunna : toujours un noun ou un mim', () => {
    const bad: string[] = [];
    everyFragment((ref, c) => c.code === 'ghunnah' && !'نم'.includes(c.letters[0] ?? '#') && bad.push(ref));
    expect(bad).toEqual([]);
  });

  it("ikhfā', iqlāb et idghām : la lettre déclencheur est toujours l'une des lettres attendues", () => {
    const bad: string[] = [];
    everyFragment((ref, c) => TRIGGERS[c.code] && !triggerIsExpected(c) && bad.push(`${ref} ${c.code} ${triggerOf(c)}`));
    expect(bad).toEqual([]);
  });

  it("madd nécessaire : suivi d'une shadda, d'un soukoun, ou lettres épelées en début de sourate", () => {
    const bad: string[] = [];
    everyFragment((ref, c) => c.code === 'madda_necessary' && !/[ّْۡ]/.test(c.nextMarks) && !/ٓ/.test(c.word) && bad.push(ref));
    expect(bad).toEqual([]);
  });

  it('madd obligatoire : toujours une hamza (dans le mot ou au début du mot suivant)', () => {
    const bad: string[] = [];
    everyFragment((ref, c) => {
      if (c.code !== 'madda_obligatory') return;
      const inWord = (c.rest.length > 0 && HAMZA.has(c.rest[0])) || c.hamzaMarkNext;
      const nextWord = !!c.next && HAMZA.has(c.next) && !c.nextInWord;
      if (!inWord && !nextWord) bad.push(ref);
    });
    expect(bad).toEqual([]);
  });

  it("madd permis : suivi d'une seule lettre dans le mot (celle qui reçoit le soukoun d'arrêt)", () => {
    let ok = 0;
    let all = 0;
    everyFragment((_r, c) => {
      if (c.code !== 'madda_permissible') return;
      all++;
      if (c.rest.length === 1) ok++;
    });
    expect(ok / all).toBeGreaterThan(0.95);
  });
});

describe('« pourquoi ici » sur de vrais mots', () => {
  const ctxOf = (s: number, v: number, code: string, pick = 0) => {
    const ar = verse(s, v);
    const f = decodeSpans(tajweed(s)[v]).filter((x) => TAJWEED_CODES[x.rule] === code)[pick];
    return contextOf(ar, f);
  };

  it('qalqala : « أَحَدٌ » (112:1), lettre د en fin de verset', () => {
    const c = ctxOf(112, 1, 'qalaqah');
    expect(c.letters).toEqual(['د']);
    expect(c.atVerseEnd).toBe(true);
    const txt = whyHere(c).join(' ');
    expect(txt).toContain('dāl');
    expect(txt).toContain('fin de verset');
    expect(txt).toContain('le rebond est plus marqué');
  });

  it("ikhfā' : « أَنتُمْ » (109:3), le noun est suivi de ت", () => {
    const c = ctxOf(109, 3, 'ikhafa');
    expect(triggerOf(c)).toBe('ت');
    expect(whyHere(c).join(' ')).toContain('tā’');
  });

  it("ikhfā' devant une lettre lourde (ص) : nasalisation plus pleine", () => {
    let found = false;
    everyFragment((_r, c) => {
      if (!found && c.code === 'ikhafa' && HEAVY_LETTERS.has(triggerOf(c) ?? '')) {
        expect(whyHere(c).join(' ')).toContain('plus plein');
        found = true;
      }
    });
    expect(found).toBe(true);
  });

  it('iqlāb : « لَيُنۢبَذَنَّ » (104:4), la lettre ب', () => {
    const c = ctxOf(104, 4, 'iqlab');
    expect(triggerOf(c)).toBe('ب');
    expect(whyHere(c).join(' ')).toContain('mim caché');
  });

  it('idghām sans ghunna : « مِن رَّبِّهِمْ » (2:5), fragment sur deux mots, lettre ر', () => {
    const c = ctxOf(2, 5, 'idgham_wo_ghunnah');
    expect(triggerOf(c)).toBe('ر');
    expect(whyHere(c).join(' ')).toContain('sans nasalisation');
  });

  it("madd permis : « ٱلنَّاسِ » (114:1), la lettre finale reçoit le soukoun d'arrêt", () => {
    const c = ctxOf(114, 1, 'madda_permissible');
    expect(c.rest).toEqual(['س']);
    expect(whyHere(c).join(' ')).toContain('sīn');
  });

  it('madd obligatoire : « جَآءَ » (110:1) est un madd muttaṣil ; « يَدَآ أَبِى » (111:1) un madd munfaṣil', () => {
    expect(whyHere(ctxOf(110, 1, 'madda_obligatory')).join(' ')).toContain('muttaṣil');
    expect(whyHere(ctxOf(111, 1, 'madda_obligatory')).join(' ')).toContain('munfaṣil');
  });

  it("madd nécessaire : « ٱلصَّآخَّةُ » (80:33), suivi d'une shadda", () => {
    expect(whyHere(ctxOf(80, 33, 'madda_necessary')).join(' ')).toContain('shadda');
  });

  it('lam solaire : « ٱلنَّاسِ » (114:1), la lettre noun est doublée', () => {
    const c = ctxOf(114, 1, 'laam_shamsiyah');
    expect(c.next).toBe('ن');
    expect(whyHere(c).join(' ')).toContain('noun');
  });

  it("les noms de lettres couvrent toutes celles qui servent aux explications", () => {
    const needed = new Set<string>();
    for (const list of Object.values(TRIGGERS)) for (const l of list) needed.add(l);
    for (const l of 'قطبجدنم') needed.add(l);
    for (const l of needed) expect(LETTER_NAME[l], l).toBeTruthy();
  });
});

describe("découpage d'un mot en morceaux colorés", () => {
  it("« ٱلنَّاسِ » (114:1) : hamza d'union, lam solaire, ghunna, madd permis, et les lettres sans règle", () => {
    const ar = verse(114, 1);
    const frags = decodeSpans(tajweed(114)[1]);
    const all = [...ar.matchAll(/\S+/g)];
    const w = all[all.length - 1]; // dernier mot du verset 114:1
    const pieces = wordPieces(ar, w.index!, w.index! + w[0].length, frags);
    expect(pieces.map((p) => p.text).join('')).toBe(w[0]); // rien de perdu ni de dupliqué
    const rules = rulesOfPieces(pieces).map((r) => TAJWEED_CODES[r]);
    expect(rules).toEqual(expect.arrayContaining(['ham_wasl', 'laam_shamsiyah', 'ghunnah', 'madda_permissible']));
  });

  it('les morceaux recomposent toujours exactement chaque mot', () => {
    let checked = 0;
    for (const n of [1, 2, 36, 55, 112, 114]) {
      const tj = tajweed(n);
      for (const v of verses(n)) {
        const frags = decodeSpans(tj[v.n]);
        for (const m of v.ar.matchAll(/\S+/g)) {
          const pieces = wordPieces(v.ar, m.index!, m.index! + m[0].length, frags);
          expect(pieces.map((p) => p.text).join(''), `${n}:${v.n}`).toBe(m[0]);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(5000);
  });
});
