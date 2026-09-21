import type { PlayInfo } from '../hooks/useAudio';

/** Texte de la barre de lecture : verset en cours, répétition du verset et passage. */
export function playLabel(verse: number, info: PlayInfo | null): string {
  if (!info) return `Lecture · verset ${verse}`;
  const bits = [`Verset ${verse}`];
  if (info.verseRepeat > 1) bits.push(`lecture ${info.verseRep}/${info.verseRepeat}`);
  if (info.passages === 0) bits.push(info.count === 1 ? `lecture ${info.group}, en boucle` : `passage ${info.group}, en boucle`);
  else if (info.passages > 1) bits.push(`passage ${info.group}/${info.passages}`);
  return bits.join(' · ');
}
