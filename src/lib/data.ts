import enrichedSeed from '../../data/enriched.seed.json';
import type { Enriched, Meta, Verse } from '../types';

const BASE = import.meta.env.BASE_URL;

let metaPromise: Promise<Meta> | null = null;
const surahCache = new Map<number, Promise<Verse[]>>();

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}data/${path}`);
  if (!res.ok) throw new Error(`Chargement impossible (${res.status}) : ${path}`);
  return res.json() as Promise<T>;
}

export function loadMeta(): Promise<Meta> {
  metaPromise ??= getJson<Meta>('meta.json').catch((e) => {
    metaPromise = null;
    throw e;
  });
  return metaPromise;
}

export function loadSurah(n: number): Promise<Verse[]> {
  let p = surahCache.get(n);
  if (!p) {
    p = getJson<{ verses: Verse[] }>(`surah/${n}.json`).then((d) => d.verses);
    p.catch(() => surahCache.delete(n));
    surahCache.set(n, p);
  }
  return p;
}

type Seed = Record<string, { verses: Enriched[] }>;
const seed = enrichedSeed as unknown as Seed;

/** Analyses rédigées à la main : uniquement pour quelques sourates (le contenu s'étendra). */
export function getEnriched(surah: number): Map<number, Enriched> | null {
  const s = seed[String(surah)];
  return s ? new Map(s.verses.map((v) => [v.num, v])) : null;
}

export const ENRICHED_SURAHS = Object.keys(seed).map(Number);
