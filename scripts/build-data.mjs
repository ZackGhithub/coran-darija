#!/usr/bin/env node
/**
 * Génère les données statiques de l'app à partir d'API publiques (aucune donnée personnelle) :
 *   public/data/surah/<n>.json  → versets d'une sourate (arabe, français, juz, hizb, page)
 *   public/data/meta.json       → sourates, 60 hizb / 240 quarts, récitateurs
 *
 * Sources : api.alquran.cloud (texte « quran-uthmani », issu du projet Tanzil ; traduction fr.hamidullah).
 * Tanzil impose de citer la source et de ne pas modifier le texte : on ne fait ici que retirer la
 * Bismillah collée au verset 1 par l'API (elle est affichée à part), sans toucher au texte des versets.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { RECITERS } from './reciters.mjs';

const API = 'https://api.alquran.cloud/v1/quran';
const OUT = new URL('../public/data/', import.meta.url);
const seed = JSON.parse(readFileSync(new URL('../data/surahs.seed.json', import.meta.url), 'utf8'));

async function get(edition) {
  const res = await fetch(`${API}/${edition}`);
  if (!res.ok) throw new Error(`${edition}: HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== 200) throw new Error(`${edition}: ${json.status}`);
  return json.data.surahs;
}

const HARAKAT = /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿ]/g;
const clean = (t) => t.replace(/[﻿​-‏]/g, '');
const bare = (w) => w.replace(HARAKAT, '').replace(/[ـ]/g, '').replace(/[ٱأإآ]/g, 'ا');
const BISMILLAH_WORDS = ['بسم', 'الله', 'الرحمن', 'الرحيم'];

/** Retire la Bismillah en tête du verset 1 (sourates 2 à 114, sauf 9 qui n'en a pas). */
function stripBismillah(surahNum, ayahNum, text) {
  if (surahNum === 1 || ayahNum !== 1) return text;
  const words = text.trim().split(/\s+/);
  const head = words.slice(0, 4).map(bare);
  const isBism = BISMILLAH_WORDS.every((w, i) => head[i] === w || (w === 'الرحمن' && head[i] === 'الرحمن'));
  return isBism ? words.slice(4).join(' ') : text;
}

const [ar, fr] = await Promise.all([get('quran-uthmani'), get('fr.hamidullah')]);
if (ar.length !== 114 || fr.length !== 114) throw new Error('114 sourates attendues');

mkdirSync(new URL('surah/', OUT), { recursive: true });

const quarters = []; // 240 entrées
const issues = [];
let prevQ = 0;

for (const s of ar) {
  const f = fr[s.number - 1];
  const sd = seed[s.number - 1];
  if (s.ayahs.length !== f.ayahs.length) issues.push(`sourate ${s.number}: ${s.ayahs.length} versets ar / ${f.ayahs.length} fr`);
  if (sd.verses !== s.ayahs.length) issues.push(`sourate ${s.number}: seed=${sd.verses} api=${s.ayahs.length}`);
  const seedType = sd.type === 'Mecquoise' ? 'Meccan' : 'Medinan';
  if (seedType !== s.revelationType) issues.push(`sourate ${s.number}: révélation seed=${sd.type} api=${s.revelationType}`);

  const verses = s.ayahs.map((a, i) => {
    if (a.hizbQuarter !== prevQ) {
      if (a.hizbQuarter !== prevQ + 1) issues.push(`quart ${prevQ}→${a.hizbQuarter} non consécutif`);
      quarters.push({ q: a.hizbQuarter, surah: s.number, ayah: a.numberInSurah, juz: a.juz, page: a.page });
      prevQ = a.hizbQuarter;
    }
    return {
      n: a.numberInSurah,
      ar: clean(stripBismillah(s.number, a.numberInSurah, a.text)),
      fr: f.ayahs[i].text,
      juz: a.juz,
      q: a.hizbQuarter, // 1..240 ; hizb = ceil(q/4)
      page: a.page,
      sajda: a.sajda ? 1 : 0,
    };
  });
  writeFileSync(new URL(`surah/${s.number}.json`, OUT), JSON.stringify({ n: s.number, verses }));
}

if (quarters.length !== 240) issues.push(`240 quarts attendus, ${quarters.length} trouvés`);

const meta = {
  source: 'Texte : Tanzil (quran-uthmani) via api.alquran.cloud ; traduction : fr.hamidullah',
  surahs: seed.map((s) => ({ ...s, type: s.type })),
  quarters,
  reciters: RECITERS,
};
writeFileSync(new URL('meta.json', OUT), JSON.stringify(meta));

console.log(`✔ 114 sourates, ${quarters.length} quarts de hizb (${quarters.length / 4} hizb)`);
if (issues.length) {
  console.warn(`⚠ ${issues.length} écart(s) à examiner :`);
  for (const i of issues) console.warn('  - ' + i);
}
