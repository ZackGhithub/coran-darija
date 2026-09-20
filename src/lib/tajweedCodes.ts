/**
 * Les 17 règles de Tajwid colorées dans le texte (noms de classes de Quran.com, source des annotations).
 * L'ordre est celui des numéros stockés dans public/data/tajweed/*.json : NE PAS le modifier sans regénérer les données.
 */
export const TAJWEED_CODES = [
  'ham_wasl',
  'slnt',
  'laam_shamsiyah',
  'madda_normal',
  'madda_permissible',
  'madda_obligatory',
  'madda_necessary',
  'qalaqah',
  'ghunnah',
  'ikhafa',
  'ikhafa_shafawi',
  'iqlab',
  'idgham_ghunnah',
  'idgham_wo_ghunnah',
  'idgham_shafawi',
  'idgham_mutajanisayn',
  'idgham_mutaqaribayn',
];

export type TajweedCode = (typeof TAJWEED_CODES)[number];

/** Numéro (dans TAJWEED_CODES) d'une règle, ou -1 si inconnue. */
export const ruleIndex = (code: string) => TAJWEED_CODES.indexOf(code);
