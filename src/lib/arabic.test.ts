import { describe, expect, it } from 'vitest';
import { alignRecitation, normalizeArabic, summarize, tokenizeSpoken, tokenizeVerse } from './arabic';

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
