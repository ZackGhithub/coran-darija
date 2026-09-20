#!/usr/bin/env node
/**
 * Convertit les annotations de Tajwid de Quran.com (texte « uthmani_tajweed » : fragments <tajweed class=…>) en
 * positions exactes dans le texte de l'application.
 *
 *   public/data/tajweed/<sourate>.json  →  { "<verset>": [début, fin, règle, début, fin, règle, …] }
 *   public/data/tajweed/examples.json   →  { "<règle>": [ { s, v, w, t: [[texte, règle|-1], …] }, … ] }
 *
 * Les deux textes (Quran.com et Tanzil) n'écrivent pas tout à fait pareil (alef en exposant, hamza, petits signes) : on
 * compare donc leurs LETTRES (distance d'édition) et on reporte les positions. Un verset trop différent est écarté
 * plutôt que de risquer une coloration au mauvais endroit.
 *
 * Usage : node scripts/build-tajweed.mjs            (nécessite Node ≥ 23.6 ; les fichiers générés sont versionnés)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { TAJWEED_CODES, ruleIndex } from '../src/lib/tajweedCodes.ts';

const OUT = new URL('../public/data/tajweed/', import.meta.url);
const SURAH = (n) => new URL(`../public/data/surah/${n}.json`, import.meta.url);
const TIMING = (n) => new URL(`../public/data/timing/alafasy/${n}.json`, import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchChapter(n) {
  for (let t = 1; t <= 5; t++) {
    try {
      const r = await fetch(`https://api.quran.com/api/v4/quran/verses/uthmani_tajweed?chapter_number=${n}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()).verses.map((v) => ({ n: Number(v.verse_key.split(':')[1]), html: v.text_uthmani_tajweed }));
    } catch (e) {
      if (t === 5) throw e;
      await sleep(800 * t);
    }
  }
}

/** Texte brut + fragments [début, fin, classe] d'un verset annoté. */
function parseTagged(html) {
  const t = html.replace(/<span class=end>[^<]*<\/span>/g, '');
  let plain = '';
  const spans = [];
  for (const m of t.matchAll(/<tajweed class=([a-z_]+)>([^<]*)<\/tajweed>|([^<]+)/g)) {
    if (m[1]) {
      spans.push([plain.length, plain.length + m[2].length, m[1]]);
      plain += m[2];
    } else plain += m[3];
  }
  return { plain, spans };
}

// Lettres qui portent le son : on ignore les voyelles et signes de pause pour comparer deux graphies.
const isSkel = (c) => /[ء-غف-يٰٱٲۥۦۧ]/.test(c);
const CANON = { 'ٲ': 'ٰ', 'ۧ': 'ۦ', 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ى': 'ي', 'ؤ': 'و', 'ئ': 'ي' };
const skel = (s) => [...s].map((c, i) => (isSkel(c) ? { c: CANON[c] ?? c, i } : null)).filter(Boolean);

/** Associe chaque lettre de A à celle de B (distance d'édition) : map[k] = indice dans B, ou -1. */
function alignSeq(A, B) {
  const n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (A[i - 1].c === B[j - 1].c ? 0 : 1));
  const map = new Array(n).fill(-1);
  let i = n, j = m;
  while (i > 0 && j > 0) {
    const same = A[i - 1].c === B[j - 1].c;
    if (dp[i][j] === dp[i - 1][j - 1] + (same ? 0 : 1)) {
      if (same) map[i - 1] = j - 1;
      i--; j--;
    } else if (dp[i][j] === dp[i - 1][j] + 1) i--;
    else j--;
  }
  return { map, dist: dp[n][m] };
}

const TRAIL = /[ً-ٟۡ-ۤ]/; // voyelles et petits signes qui suivent une lettre (l'alef en exposant a sa propre couleur : exclu)

/** Fragments de Quran.com → positions [début, fin, règle] dans NOTRE texte. */
function toOurSpans(ar, tagged) {
  const A = skel(tagged.plain);
  const B = skel(ar);
  const { map, dist } = alignSeq(A, B);
  if (dist > Math.max(4, Math.round(A.length * 0.03))) return null;
  const out = [];
  for (const [s, e, cls] of tagged.spans) {
    const rule = ruleIndex(cls);
    if (rule < 0) continue;
    const mapped = A.map((x, k) => (x.i >= s && x.i < e ? map[k] : -1)).filter((k) => k >= 0);
    if (!mapped.length) continue;
    let start = B[Math.min(...mapped)].i;
    if (ar[start - 1] === 'ـ') start--; // tatweel qui porte le signe
    let end = B[Math.max(...mapped)].i + 1;
    while (end < ar.length && TRAIL.test(ar[end])) end++;
    out.push([start, end, rule]);
  }
  out.sort((a, b) => a[0] - b[0]);
  // pas de chevauchement (on rogne le suivant)
  for (let k = 1; k < out.length; k++) if (out[k][0] < out[k - 1][1]) out[k][0] = out[k - 1][1];
  return out.filter((x) => x[1] > x[0]);
}

mkdirSync(OUT, { recursive: true });
const stats = { verses: 0, kept: 0, rejected: 0, spans: 0, byRule: Object.fromEntries(TAJWEED_CODES.map((c) => [c, 0])) };
const all = {}; // sourate -> verset -> [ar, spans[]]
for (let n = 1; n <= 114; n++) {
  const mine = JSON.parse(readFileSync(SURAH(n), 'utf8')).verses;
  const theirs = await fetchChapter(n);
  const file = {};
  all[n] = {};
  for (const tv of theirs) {
    const v = mine.find((x) => x.n === tv.n);
    stats.verses++;
    const spans = v ? toOurSpans(v.ar, parseTagged(tv.html)) : null;
    if (!spans) {
      stats.rejected++;
      continue;
    }
    stats.kept++;
    stats.spans += spans.length;
    for (const [, , r] of spans) stats.byRule[TAJWEED_CODES[r]]++;
    if (spans.length) file[tv.n] = spans.flat();
    all[n][tv.n] = [v.ar, spans];
  }
  writeFileSync(new URL(`${n}.json`, OUT), JSON.stringify(file));
  await sleep(80);
  if (n % 20 === 0) console.log(`  sourate ${n}/114`);
}

// ----- Exemples pour chaque règle : mots courts et connus (sourates courtes d'abord), avec horodatage exact (Alafasy) -----
const PREFERRED = [112, 113, 114, 111, 110, 109, 108, 107, 106, 105, 104, 103, 102, 101, 100, 99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89, 88, 87, 86, 85, 84, 83, 82, 81, 80, 79, 78, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const rest = Array.from({ length: 114 }, (_, i) => i + 1).filter((n) => !PREFERRED.includes(n));
const timings = {};
const loadTiming = (n) => (timings[n] ??= (() => { try { return JSON.parse(readFileSync(TIMING(n), 'utf8')); } catch { return {}; } })());
const wordsOf = (ar) => [...ar.matchAll(/\S+/g)].map((m) => ({ text: m[0], start: m.index })).filter((w) => /[ء-يٱ]/.test(w.text));
const examples = Object.fromEntries(TAJWEED_CODES.map((c) => [c, []]));
const WANT = 4;
for (const n of [...PREFERRED, ...rest]) {
  const tm = loadTiming(n);
  for (const [vs, [ar, spans]] of Object.entries(all[n] ?? {})) {
    const words = wordsOf(ar);
    if (words.length > 14) continue; // versets courts : audio léger à charger
    if (!tm[vs] || tm[vs].length !== words.length) continue; // il faut l'horodatage exact du mot
    for (let w = 0; w < words.length; w++) {
      const end = words[w].start + words[w].text.length;
      const inWord = spans.filter(([s, e]) => s < end && e > words[w].start);
      for (const rule of new Set(inWord.map((x) => x[2]))) {
        const list = examples[TAJWEED_CODES[rule]];
        if (list.length >= WANT || list.some((x) => x.t.map((p) => p[0]).join('') === words[w].text)) continue;
        // découpe du mot en morceaux (texte, règle) ; la règle demandée est mise en avant, les autres restent colorées
        const pieces = [];
        let pos = words[w].start;
        for (const [s, e, r] of inWord) {
          const a = Math.max(s, words[w].start), b = Math.min(e, end);
          if (a > pos) pieces.push([ar.slice(pos, a), -1]);
          pieces.push([ar.slice(a, b), r]);
          pos = b;
        }
        if (pos < end) pieces.push([ar.slice(pos, end), -1]);
        list.push({ s: n, v: Number(vs), w, t: pieces });
      }
    }
  }
  if (TAJWEED_CODES.every((c) => examples[c].length >= WANT)) break;
}
writeFileSync(new URL('examples.json', OUT), JSON.stringify(examples));

console.log(`\n✔ ${stats.kept}/${stats.verses} versets alignés (${stats.rejected} écartés), ${stats.spans} fragments colorés`);
for (const [c, k] of Object.entries(stats.byRule)) console.log(`  ${c.padEnd(22)} ${String(k).padStart(6)} fragments | ${examples[c].length} exemples`);
