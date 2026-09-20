import { useCallback, useEffect, useState } from 'react';

const PREFIX = 'coran:';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* stockage indisponible (navigation privée, quota) : l'app reste utilisable */
  }
}

/** État persistant dans localStorage, tolérant aux erreurs de stockage. */
export function usePersisted<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => read(key, initial));
  useEffect(() => write(key, value), [key, value]);
  const set = useCallback((v: T | ((p: T) => T)) => setValue(v), []);
  return [value, set];
}

/** Résultat cumulé des récitations vocales d'un verset. */
export interface VerseStat {
  attempts: number;
  perfect: number; // récitations sans aucune erreur
  bestOk: number; // meilleur nombre de mots corrects
  total: number;
  last: number; // timestamp
}

export const PERSISTED_KEYS = ['learned', 'quarters', 'verseStats', 'theme', 'fontSize', 'surah', 'reciter', 'repeat', 'tempo', 'hifz', 'hifzSel', 'marks', 'tajweed'] as const;

/** Export de la progression : uniquement des numéros et des réglages, aucune donnée personnelle. */
export function exportProgress(): string {
  const data: Record<string, unknown> = { app: 'coran-darija', version: 1 };
  for (const k of PERSISTED_KEYS) data[k] = read(k, null);
  return JSON.stringify(data, null, 2);
}

export function importProgress(json: string): number {
  const data = JSON.parse(json) as Record<string, unknown>;
  if (data.app !== 'coran-darija') throw new Error('Fichier non reconnu');
  let n = 0;
  for (const k of PERSISTED_KEYS) {
    if (data[k] !== undefined && data[k] !== null) {
      write(k, data[k]);
      n++;
    }
  }
  return n;
}
