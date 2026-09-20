import { describe, expect, it } from 'vitest';
import { listBy, markKey, memorizedCounts, nextToLearn, parseKey, setFlags, setNote, toggleFlag, totals, type Marks } from './marks';

const surahs = [
  { n: 1, verses: 7 },
  { n: 2, verses: 286 },
  { n: 112, verses: 4 },
];

describe('marques sur les versets', () => {
  it('coche puis décoche ; une entrée vide disparaît du stockage', () => {
    let m: Marks = {};
    m = toggleFlag(m, '1:2', 'm', 1000);
    expect(m['1:2']).toEqual({ m: 1000 });
    m = toggleFlag(m, '1:2', 'f', 2000);
    expect(m['1:2']).toEqual({ m: 1000, f: 2000 });
    m = toggleFlag(m, '1:2', 'm');
    m = toggleFlag(m, '1:2', 'f');
    expect(m).toEqual({});
  });

  it('ne modifie pas l\'objet d\'origine (nécessaire pour React)', () => {
    const a: Marks = { '1:1': { m: 1 } };
    const b = toggleFlag(a, '1:2', 'f');
    expect(a).toEqual({ '1:1': { m: 1 } });
    expect(b).not.toBe(a);
  });

  it('les autres marques du verset sont conservées', () => {
    let m: Marks = setNote({}, '1:2', 'ma note');
    m = toggleFlag(m, '1:2', 'm', 5);
    m = toggleFlag(m, '1:2', 'm');
    expect(m['1:2']).toEqual({ n: 'ma note' });
  });

  it('note : nettoyée, limitée, et une note vide la supprime', () => {
    let m = setNote({}, '1:2', '   rappel : 3 mots   ');
    expect(m['1:2'].n).toBe('rappel : 3 mots');
    expect(setNote({}, '1:2', 'x'.repeat(5000))['1:2'].n).toHaveLength(1000);
    m = setNote(m, '1:2', '   ');
    expect(m).toEqual({});
  });

  it('cocher plusieurs versets d\'un coup, sans toucher à ceux déjà cochés', () => {
    const m = setFlags({ '112:1': { m: 7 } }, ['112:1', '112:2', '112:3'], 'm', true, 99);
    expect(m['112:1'].m).toBe(7); // date d'origine conservée
    expect(m['112:2'].m).toBe(99);
    expect(setFlags(m, ['112:2', '112:3'], 'm', false)['112:2']).toBeUndefined();
  });

  it('clés : aller-retour', () => {
    expect(parseKey(markKey(2, 255))).toEqual({ surah: 2, verse: 255 });
  });
});

describe('progression', () => {
  const marks: Marks = {
    '112:1': { m: 1 }, '112:2': { m: 1 }, '112:3': { m: 1 }, '112:4': { m: 1 }, // sourate complète
    '1:1': { m: 1, f: 2 },
    '1:2': { f: 3, n: 'note' },
    '2:255': { n: 'Ayat al-Kursi' },
  };

  it('compte les versets mémorisés par sourate', () => {
    const c = memorizedCounts(marks);
    expect(c.get(112)).toBe(4);
    expect(c.get(1)).toBe(1);
    expect(c.get(2)).toBeUndefined(); // une note seule n'est pas « mémorisé »
  });

  it('totaux : versets, sourates complètes, favoris, notes', () => {
    expect(totals(marks, surahs)).toEqual({ verses: 5, complete: 1, favorites: 2, notes: 2 });
  });

  it('listes des favoris et des notes, dans l\'ordre du Coran', () => {
    expect(listBy(marks, 'f').map((x) => `${x.surah}:${x.verse}`)).toEqual(['1:1', '1:2']);
    expect(listBy(marks, 'n').map((x) => `${x.surah}:${x.verse}`)).toEqual(['1:2', '2:255']);
  });
});

describe('prochain groupe à apprendre', () => {
  it('propose les 3 premiers versets non mémorisés de la sourate', () => {
    expect(nextToLearn({}, surahs, 1)).toEqual({ surah: 1, from: 1, to: 3 });
    expect(nextToLearn({ '1:1': { m: 1 }, '1:2': { m: 1 } }, surahs, 1)).toEqual({ surah: 1, from: 3, to: 5 });
  });

  it('s\'arrête à la fin de la sourate', () => {
    const m: Marks = { '1:1': { m: 1 }, '1:2': { m: 1 }, '1:3': { m: 1 }, '1:4': { m: 1 }, '1:5': { m: 1 } };
    expect(nextToLearn(m, surahs, 1)).toEqual({ surah: 1, from: 6, to: 7 });
  });

  it('passe à la sourate suivante quand celle-ci est terminée', () => {
    const m: Marks = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`1:${i + 1}`, { m: 1 }]));
    expect(nextToLearn(m, surahs, 1)).toEqual({ surah: 2, from: 1, to: 3 });
  });

  it('un verset non mémorisé au milieu est proposé en premier', () => {
    const m: Marks = { '1:1': { m: 1 }, '1:3': { m: 1 } };
    expect(nextToLearn(m, surahs, 1)).toEqual({ surah: 1, from: 2, to: 4 });
  });

  it('null quand tout est mémorisé', () => {
    const all: Marks = {};
    for (const s of surahs) for (let v = 1; v <= s.verses; v++) all[`${s.n}:${v}`] = { m: 1 };
    expect(nextToLearn(all, surahs, 1)).toBeNull();
  });
});
