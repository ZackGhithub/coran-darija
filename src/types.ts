export interface SurahMeta {
  n: number;
  fr: string;
  ar: string;
  tr: string;
  verses: number;
  type: 'Mecquoise' | 'Médinoise';
}

export interface Quarter {
  q: number; // 1..240
  surah: number;
  ayah: number;
  juz: number;
  page: number;
}

export interface Reciter {
  id: string;
  name: string;
  country: string;
  style: 'murattal' | 'mujawwad' | 'muallim';
  folder: string;
}

export interface Meta {
  source: string;
  surahs: SurahMeta[];
  quarters: Quarter[];
  reciters: Reciter[];
}

export interface Verse {
  n: number;
  ar: string;
  fr: string;
  juz: number;
  q: number; // quart de hizb 1..240 ; hizb = ceil(q / 4)
  page: number;
  sajda: 0 | 1;
}

/** Analyse rédigée à la main (sourates 1, 103, 108, 112, 113, 114). Contenu local de confiance. */
export interface Enriched {
  num: number;
  translit: string;
  darija: string;
  tajwid: string;
  fr: string;
}

export type Tab = 'recitation' | 'index' | 'hizb' | 'guide' | 'quiz';
