#!/usr/bin/env node
/**
 * Récupère l'instant de début de chaque mot (en ms) pour les récitateurs dont le fichier audio est identique
 * octet pour octet à celui de everyayah.com (vérifié : mêmes tailles de fichier), afin de surligner le texte
 * au rythme de la voix. Source : Quran.com API v4 (segments mot à mot).
 *
 *   public/data/timing/<récitateur>/<sourate>.json  →  { "<verset>": [début du mot 1, début du mot 2, ...] }
 *
 * Un verset dont le nombre de mots diffère du nôtre est écarté : l'app estimera alors ses durées plutôt que
 * d'afficher un surlignage faux.
 *
 * Usage : node scripts/build-timings.mjs [--force] [--only=alafasy,sudais]
 * Nécessite Node ≥ 23.6 (import direct de fichiers .ts). À lancer en local : les fichiers générés sont versionnés.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { RECITERS } from './reciters.mjs';
import { tokenizeVerse } from '../src/lib/arabic.ts';

const OUT = new URL('../public/data/timing/', import.meta.url);
const SURAH = (n) => new URL(`../public/data/surah/${n}.json`, import.meta.url);
const force = process.argv.includes('--force');
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '').replace('--only=', '').split(',').filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 5) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      if (res.status === 429 || res.status >= 500) await sleep(1500 * i);
      else throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      if (i === tries) throw new Error(`${url} : ${e.message}`);
      await sleep(1000 * i);
    }
  }
}

async function chapterSegments(qcId, surah) {
  const out = new Map(); // verset -> segments
  for (let page = 1; ; page++) {
    const j = await getJson(`https://api.quran.com/api/v4/verses/by_chapter/${surah}?audio=${qcId}&per_page=50&page=${page}&fields=verse_key`);
    for (const v of j.verses) out.set(Number(v.verse_key.split(':')[1]), v.audio?.segments ?? []);
    if (!j.pagination.next_page) return out;
    await sleep(120);
  }
}

const targets = RECITERS.filter((r) => r.qcId && (!only.length || only.includes(r.id)));
const report = {};

async function doReciter(r) {
  const dir = new URL(`${r.id}/`, OUT);
  mkdirSync(dir, { recursive: true });
  const stat = { verses: 0, kept: 0, wordMismatch: 0, noSegments: 0, skippedFiles: 0 };
  for (let s = 1; s <= 114; s++) {
    const file = new URL(`${s}.json`, dir);
    if (!force && existsSync(file)) {
      stat.skippedFiles++;
      continue;
    }
    const mine = JSON.parse(readFileSync(SURAH(s), 'utf8')).verses;
    const theirs = await chapterSegments(r.qcId, s);
    const data = {};
    for (const v of mine) {
      stat.verses++;
      const seg = (theirs.get(v.n) ?? []).filter((x) => Array.isArray(x) && x.length === 4);
      if (!seg.length) { stat.noSegments++; continue; }
      seg.sort((a, b) => a[1] - b[1]);
      if (seg.length !== tokenizeVerse(v.ar).length) { stat.wordMismatch++; continue; }
      data[v.n] = seg.map((x) => x[2]);
      stat.kept++;
    }
    writeFileSync(file, JSON.stringify(data));
    await sleep(120);
    if (s % 20 === 0) console.log(`  ${r.id}: sourate ${s}/114`);
  }
  report[r.id] = stat;
  console.log(`✔ ${r.id}`, JSON.stringify(stat));
}

// 2 récitateurs en parallèle : assez rapide sans brusquer l'API.
const queue = [...targets];
await Promise.all(
  Array.from({ length: 2 }, async () => {
    while (queue.length) await doReciter(queue.shift());
  }),
);
console.log('\nRésumé :');
for (const [id, s] of Object.entries(report)) {
  const pct = s.verses ? ((s.kept / s.verses) * 100).toFixed(1) : '—';
  console.log(`  ${id.padEnd(12)} ${pct}% des versets synchronisés (écartés : ${s.wordMismatch} nombre de mots différent, ${s.noSegments} sans données)`);
}
