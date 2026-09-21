import { describe, expect, it } from 'vitest';
import { playLabel } from './playLabel';

const info = (o: Partial<Parameters<typeof playLabel>[1] & object>) => ({ verseRep: 1, verseRepeat: 1, group: 1, passages: 1, count: 1, ...o });

describe('texte de la barre de lecture', () => {
  it('lecture simple : juste le verset', () => {
    expect(playLabel(5, info({}))).toBe('Verset 5');
    expect(playLabel(5, null)).toBe('Lecture · verset 5');
  });
  it('un verset en boucle compte les lectures', () => {
    expect(playLabel(2, info({ passages: 0, group: 4 }))).toBe('Verset 2 · lecture 4, en boucle');
  });
  it('un passage en boucle compte les passages', () => {
    expect(playLabel(3, info({ passages: 0, group: 2, count: 2 }))).toBe('Verset 3 · passage 2, en boucle');
  });
  it('Boucle 3× : lecture n/3 du verset', () => {
    expect(playLabel(1, info({ verseRepeat: 3, verseRep: 2 }))).toBe('Verset 1 · lecture 2/3');
  });
  it('plusieurs passages', () => {
    expect(playLabel(1, info({ passages: 3, group: 2, count: 4 }))).toBe('Verset 1 · passage 2/3');
  });
});
