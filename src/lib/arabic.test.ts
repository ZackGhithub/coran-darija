import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { StreamAligner, alignFrom, alignRecitation, normalizeArabic, summarize, tokenizeSpoken, tokenizeVerse } from './arabic';

const FATIHA_2 = 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ';
const IKHLAS_1 = 'قُلْ هُوَ ٱللَّهُ أَحَدٌ';

describe('normalizeArabic', () => {
  it('retire voyelles et unifie les alef', () => {
    expect(normalizeArabic('ٱلْحَمْدُ')).toBe('الحمد');
    expect(normalizeArabic('أَحَدٌ')).toBe('احد');
  });
  it('ignore les signes de pause coraniques isolés', () => {
    expect(tokenizeVerse('لَا رَيْبَ ۛ فِيهِ')).toHaveLength(3);
  });
});

describe('alignRecitation', () => {
  const target = tokenizeVerse(IKHLAS_1);

  it('tout est en attente avant toute parole', () => {
    expect(alignRecitation(target, [])).toEqual(['pending', 'pending', 'pending', 'pending']);
  });

  it('récitation parfaite : tout vert', () => {
    const st = alignRecitation(target, tokenizeSpoken('قل هو الله احد'));
    expect(st).toEqual(['ok', 'ok', 'ok', 'ok']);
    expect(summarize(st).perfect).toBe(true);
  });

  it('récitation partielle : les mots non dits restent neutres, pas rouges', () => {
    expect(alignRecitation(target, tokenizeSpoken('قل هو'))).toEqual(['ok', 'ok', 'pending', 'pending']);
  });

  it('mot sauté au milieu : rouge', () => {
    expect(alignRecitation(target, tokenizeSpoken('قل الله احد'))).toEqual(['ok', 'wrong', 'ok', 'ok']);
  });

  it('mot erroné : rouge', () => {
    expect(alignRecitation(target, tokenizeSpoken('قل هو ربي احد'))).toEqual(['ok', 'ok', 'wrong', 'ok']);
  });

  it('tolère une lettre de différence sur un mot long (erreur du moteur vocal)', () => {
    const t = tokenizeVerse(FATIHA_2);
    expect(alignRecitation(t, tokenizeSpoken('الحمد لله رب العلمين'))).toEqual(['ok', 'ok', 'ok', 'ok']);
  });

  it('mots courts : aucune tolérance', () => {
    expect(alignRecitation(target, tokenizeSpoken('قل هي الله احد'))[1]).toBe('wrong');
  });

  it('mots en trop sont ignorés', () => {
    expect(alignRecitation(target, tokenizeSpoken('قل هو هو الله احد'))).toEqual(['ok', 'ok', 'ok', 'ok']);
  });

  it("mot en cours de reconnaissance : neutre tant qu'il peut encore devenir correct", () => {
    const partial = tokenizeSpoken('قل هو ال');
    expect(alignRecitation(target, partial, { provisionalLast: true })).toEqual(['ok', 'ok', 'pending', 'pending']);
    expect(alignRecitation(target, partial)[2]).toBe('wrong'); // résultat final : c'est faux
  });

  it('mot provisoire réellement faux : rouge', () => {
    expect(alignRecitation(target, tokenizeSpoken('قل هو ربي'), { provisionalLast: true })[2]).toBe('wrong');
  });
});

describe('orthographe coranique vs orthographe courante', () => {
  const SAMAWAT = 'ٱلسَّمَـٰوَٰتِ';

  it("l'alef en exposant est un vrai « a » long", () => {
    expect(normalizeArabic(SAMAWAT)).toBe('السماوات');
  });

  it('« السماوات » est reconnu, avec ou sans « و » de liaison ajouté par le moteur', () => {
    expect(alignRecitation(tokenizeVerse(SAMAWAT), tokenizeSpoken('السماوات'))).toEqual(['ok']);
    expect(alignRecitation(tokenizeVerse(SAMAWAT), tokenizeSpoken('والسماوات'))).toEqual(['ok']);
  });

  it('mots courts : la tolérance sur les alef ne rend pas deux mots différents équivalents', () => {
    expect(alignRecitation(tokenizeVerse('ذَا'), tokenizeSpoken('لا'))).toEqual(['wrong']);
    expect(alignRecitation(tokenizeVerse('مَا'), tokenizeSpoken('من'))).toEqual(['wrong']);
    expect(alignRecitation(tokenizeVerse('لَا'), tokenizeSpoken('لا'))).toEqual(['ok']);
  });
});

describe("cas réel : Ayat al-Kursi (2:255) entendu par un iPhone", () => {
  // Texte tel que renvoyé par le moteur vocal Safari : sans voyelles, réécrit vers l'arabe le plus probable.
  const HEARD =
    'الله لا إله إلا هو الحي القيوم لا تأخذه سنة ولا نوم له ما في السماوات وما في الأرض من الذي يشفع عنده إلا باب يعلم ما بين ايديهم وما خلفهم ولا يحيطون بشيء من علمه إلا بما شاء وسع والسماوات والارض قل يؤده حفظهما وهو العلي العظيم';
  const verse = (JSON.parse(readFileSync(new URL('../../public/data/surah/2.json', import.meta.url), 'utf8')).verses as { n: number; ar: string }[]).find((v) => v.n === 255)!;
  const words = tokenizeVerse(verse.ar);
  const status = alignRecitation(words, tokenizeSpoken(HEARD));
  const red = words.filter((_, i) => status[i] === 'wrong').map(normalizeArabic);

  it('« السماوات » (×2) n\'est plus faussement rouge', () => {
    expect(red).not.toContain('السماوات');
  });

  it('les seuls rouges restants sont les mots que le moteur a avalés ou remplacés', () => {
    expect(red).toEqual(['ذا', 'باذنه', 'كرسيه', 'ولا']);
  });
});

describe('alignFrom : reprendre à partir d\'un mot', () => {
  const target = tokenizeVerse(IKHLAS_1); // قل هو الله احد

  it('les mots avant la reprise gardent leur statut, le reste est comparé à la nouvelle parole', () => {
    const st = alignFrom(target, 2, ['ok', 'wrong'], tokenizeSpoken('الله احد'));
    expect(st).toEqual(['ok', 'wrong', 'ok', 'ok']);
  });

  it('avant que la personne parle, la suite est en attente', () => {
    expect(alignFrom(target, 2, ['ok', 'ok'], [])).toEqual(['ok', 'ok', 'pending', 'pending']);
  });

  it('sans statut connu avant la reprise (verset commencé au milieu) : en attente, jamais « parfait »', () => {
    const st = alignFrom(target, 2, [], tokenizeSpoken('الله احد'));
    expect(st).toEqual(['pending', 'pending', 'ok', 'ok']);
    expect(summarize(st).perfect).toBe(false);
  });

  it('reprise au mot 0 = comparaison normale', () => {
    expect(alignFrom(target, 0, [], tokenizeSpoken('قل هو الله احد'))).toEqual(['ok', 'ok', 'ok', 'ok']);
  });

  it('un mot faux à la reprise est rouge, les mots figés ne changent pas', () => {
    expect(alignFrom(target, 1, ['ok'], tokenizeSpoken('هو ربي احد'))).toEqual(['ok', 'ok', 'wrong', 'ok']);
  });
});

describe('StreamAligner : récitation longue au fil de l\'eau', () => {
  const load = (n: number) => (JSON.parse(readFileSync(new URL(`../../public/data/surah/${n}.json`, import.meta.url), 'utf8')).verses as { n: number; ar: string }[]);
  const wordsOf = (n: number, from = 1, to = 9999) => load(n).filter((v) => v.n >= from && v.n <= to).flatMap((v) => tokenizeVerse(v.ar));
  // Génère la parole du moteur : mots normalisés, avec quelques mots sautés / remplacés / ajoutés (déterministe).
  const speak = (target: string[], every = 0) =>
    target.flatMap((w, i) => {
      const t = normalizeArabic(w);
      if (every && i % every === every - 1) return []; // mot avalé
      return [t];
    });
  const feed = (agg: StreamAligner, spoken: string[], step: number) => {
    let last: ReturnType<StreamAligner['update']> = [];
    for (let k = step; k < spoken.length + step; k += step) last = agg.update(spoken.slice(0, Math.min(k, spoken.length)));
    return last;
  };

  it('récitation exacte de la Fatiha : tout est vert', () => {
    const target = wordsOf(1);
    const st = feed(new StreamAligner(target), speak(target), 1);
    expect(st).toHaveLength(target.length);
    expect(st.every((s) => s === 'ok')).toBe(true);
  });

  it('même résultat que la comparaison complète sur une longue récitation', () => {
    const target = wordsOf(2, 1, 40);
    const spoken = speak(target, 17); // un mot avalé toutes les 17 mots
    const full = alignRecitation(target, spoken);
    const stream = feed(new StreamAligner(target), spoken, 3);
    expect(stream).toEqual(full);
    expect(stream.filter((s) => s === 'wrong').length).toBe(Math.floor(target.length / 17));
  });

  it("la récitation n'est pas terminée : la suite reste en attente", () => {
    const target = wordsOf(2, 1, 20);
    const half = speak(target).slice(0, 60);
    const st = new StreamAligner(target).update(half);
    expect(st.slice(0, 60).every((s) => s === 'ok')).toBe(true);
    expect(st.slice(60).every((s) => s === 'pending')).toBe(true);
  });

  it("reprise au milieu d'une longue récitation : le passé est figé, la suite est comparée", () => {
    const target = wordsOf(2, 1, 20);
    const head = target.slice(0, 50).map(() => 'ok' as const);
    const st = feed(new StreamAligner(target, 50, head), speak(target).slice(50, 90), 4);
    expect(st.slice(0, 90).every((s) => s === 'ok')).toBe(true);
    expect(st[90]).toBe('pending');
  });

  it('performance : Al-Baqarah entière (~6000 mots), mise à jour toutes les 2 mots', () => {
    const target = wordsOf(2);
    const spoken = speak(target, 31);
    const agg = new StreamAligner(target);
    const t0 = performance.now();
    let worst = 0;
    let st: ReturnType<StreamAligner['update']> = [];
    for (let k = 2; k <= spoken.length + 2; k += 2) {
      const a = performance.now();
      st = agg.update(spoken.slice(0, Math.min(k, spoken.length)));
      worst = Math.max(worst, performance.now() - a);
    }
    const total = performance.now() - t0;
    expect(st).toHaveLength(target.length);
    expect(st.filter((s) => s === 'ok').length).toBeGreaterThan(target.length * 0.9);
    console.log(`Al-Baqarah : ${target.length} mots, total ${Math.round(total)} ms, pire mise à jour ${worst.toFixed(1)} ms`);
    expect(worst).toBeLessThan(150); // reste fluide sur un téléphone (bien plus lent qu'un PC)
  }, 60000);
});
