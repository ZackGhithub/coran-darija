import { describe, expect, it } from 'vitest';
import { firstLetters, maskFor, type HideOptions, type Progress } from './mask';

const opts = (o: Partial<HideOptions> = {}): HideOptions => ({ mode: 'hidden', hideFrom: 2, hideListen: true, verseRepeat: 3, ...o });
const prog = (p: Partial<Progress> = {}): Progress => ({ status: 'playing', index: 1, rep: 1, group: 1, ...p });

describe('masquage : quand cacher le texte', () => {
  it('jamais masqué si le mode est désactivé', () => {
    expect(maskFor(opts({ mode: 'none' }), 1, prog({ rep: 3 }))).toBe('none');
  });

  it('avant de commencer, à la fin, en pause ou en erreur : tout est visible', () => {
    for (const status of ['idle', 'done', 'paused', 'error'] as const) expect(maskFor(opts(), 1, prog({ status, rep: 3 }))).toBe('none');
    expect(maskFor(opts(), 1, prog({ index: null }))).toBe('none');
  });

  it('le verset en cours est lisible tant que sa lecture n° est avant « masquer à partir de »', () => {
    expect(maskFor(opts({ hideFrom: 2 }), 1, prog({ rep: 1 }))).toBe('none');
    expect(maskFor(opts({ hideFrom: 2 }), 1, prog({ rep: 2 }))).toBe('hidden');
    expect(maskFor(opts({ hideFrom: 2 }), 1, prog({ rep: 3 }))).toBe('hidden');
  });

  it('hideFrom = 1 : masqué dès la première lecture', () => {
    expect(maskFor(opts({ hideFrom: 1 }), 0, prog({ index: 0, rep: 1 }))).toBe('hidden');
  });

  it('pendant votre tour (pause) le verset est masqué même si le récitateur peut être lu à l\'écran', () => {
    const o = opts({ hideListen: false });
    expect(maskFor(o, 1, prog({ status: 'playing', rep: 2 }))).toBe('none'); // le récitateur lit : texte visible
    expect(maskFor(o, 1, prog({ status: 'gap', rep: 2 }))).toBe('hidden'); // à vous : masqué
  });

  it('les versets déjà lus restent masqués, ceux pas encore lus restent visibles', () => {
    const p = prog({ index: 2, rep: 1 });
    expect(maskFor(opts(), 0, p)).toBe('hidden'); // verset 1, déjà lu 3 fois
    expect(maskFor(opts(), 1, p)).toBe('hidden');
    expect(maskFor(opts(), 3, p)).toBe('none'); // pas encore lu
  });

  it('au 2e passage sur le groupe, tout le groupe a déjà été lu : masqué', () => {
    expect(maskFor(opts(), 3, prog({ index: 0, rep: 1, group: 2 }))).toBe('hidden');
  });

  it('« masquer à partir de » ne peut pas dépasser le nombre de lectures', () => {
    // 3 lectures par verset mais réglé sur 9 : on masque au plus tard à la 3e lecture
    expect(maskFor(opts({ hideFrom: 9, verseRepeat: 3 }), 1, prog({ rep: 3 }))).toBe('hidden');
    expect(maskFor(opts({ hideFrom: 9, verseRepeat: 3 }), 1, prog({ rep: 2 }))).toBe('none');
  });

  it('le mode « premières lettres » est conservé', () => {
    expect(maskFor(opts({ mode: 'letters' }), 1, prog({ rep: 2 }))).toBe('letters');
  });
});

describe('indice « premières lettres »', () => {
  it('première lettre avec ses voyelles', () => {
    expect(firstLetters('قُلْ')).toBe('قُ');
    expect(firstLetters('رَبِّ')).toBe('رَ');
  });

  it("garde l'article et la lettre qui suit (sinon tous les mots commencent par « ٱل »)", () => {
    expect(firstLetters('ٱلْحَمْدُ')).toBe('ٱلْحَ');
    expect(firstLetters('ٱلرَّحِيمِ')).toBe('ٱلرَّ');
    expect(firstLetters('ٱللَّهِ')).toBe('ٱللَّ');
  });

  it('mots courts et cas limites', () => {
    expect(firstLetters('لَا')).toBe('لَ');
    expect(firstLetters('وَ')).toBe('وَ'); // mot d'une seule lettre : inchangé
    expect(firstLetters('')).toBe('');
    expect(firstLetters('۞')).toBe('۞'); // pas de lettre : inchangé
  });
});
