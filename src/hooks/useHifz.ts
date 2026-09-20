import { useCallback, useEffect, useRef, useState } from 'react';
import type { Reciter } from '../types';
import { ayahUrl } from './useAudio';
import { audioBlobUrl, prefetchAudio } from '../lib/audioCache';
import { pauseMs, skipVerse, stepAt, type PauseMode } from '../lib/hifzPlan';
import { estimateStarts, wordAt, type VerseTimings } from '../lib/timing';

export interface HifzVerse {
  n: number;
  words: string[];
}

export interface HifzConfig {
  verseRepeat: number; // lectures de chaque verset
  groupRepeat: number; // passages sur le groupe ; 0 = sans fin
  pause: PauseMode;
  rate: number; // tempo : 1 = vitesse normale
}

export type HifzStatus = 'idle' | 'loading' | 'playing' | 'gap' | 'paused' | 'done' | 'error';

export interface HifzState {
  status: HifzStatus;
  verse: number | null;
  verseRep: number;
  groupRep: number;
  word: number; // mot en cours (-1 = aucun)
  progress: number; // avancement du verset en cours, 0..1
  gapLeftMs: number;
  gapTotalMs: number;
  synced: boolean; // true = horodatages réels du récitateur, false = estimés
  error: string | null;
}

const INITIAL: HifzState = { status: 'idle', verse: null, verseRep: 0, groupRep: 0, word: -1, progress: 0, gapLeftMs: 0, gapTotalMs: 0, synced: false, error: null };

/** Son muet de 0 s : lu au premier appui pour que iOS autorise la suite (il exige un geste de l'utilisateur). */
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function applyRate(a: HTMLAudioElement, rate: number) {
  a.defaultPlaybackRate = rate;
  a.playbackRate = rate;
  // Garde la hauteur de la voix quand on ralentit (sinon le récitateur devient grave et déformé)
  const x = a as HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean };
  x.preservesPitch = true;
  x.webkitPreservesPitch = true;
}

/**
 * Lecteur du module de mémorisation : répète un verset ou un groupe de versets avec le récitateur choisi,
 * à la vitesse voulue, avec une pause entre les lectures, et suit le mot prononcé pour le surligner.
 */
export function useHifz(reciter: Reciter | undefined, surah: number, verses: HifzVerse[], cfg: HifzConfig, timings: VerseTimings | null) {
  const [state, setState] = useState<HifzState>(INITIAL);
  const el = useRef<HTMLAudioElement | null>(null);
  const run = useRef(0); // invalide les lectures obsolètes
  const paused = useRef(false);
  const pausedFrom = useRef<'playing' | 'gap' | 'loading'>('playing');
  const gate = useRef<(() => void) | null>(null);
  const stepRef = useRef(0);
  const statusRef = useRef<HifzStatus>('idle');
  const estCache = useRef(new Map<string, number[]>());
  const latest = useRef({ reciter, surah, verses, cfg, timings });
  latest.current = { reciter, surah, verses, cfg, timings };

  const set = useCallback((patch: Partial<HifzState> | ((s: HifzState) => HifzState)) => {
    setState((s) => {
      const next = typeof patch === 'function' ? patch(s) : { ...s, ...patch };
      statusRef.current = next.status;
      return next;
    });
  }, []);

  /** Instants de début des mots d'un verset : réels si on les a, sinon estimés d'après la durée de l'audio. */
  const startsFor = useCallback((v: HifzVerse, durationMs: number) => {
    const real = latest.current.timings?.[v.n];
    if (real && real.length === v.words.length) return { starts: real, synced: true };
    const key = `${latest.current.surah}:${v.n}:${Math.round(durationMs)}`;
    let est = estCache.current.get(key);
    if (!est) {
      est = estimateStarts(v.words, durationMs);
      estCache.current.set(key, est);
    }
    return { starts: est, synced: false };
  }, []);

  // Suivi du mot prononcé, à chaque image, tant qu'un verset est en lecture
  const playingVerse = state.status === 'playing' ? state.verse : null;
  useEffect(() => {
    if (playingVerse == null) return;
    let raf = 0;
    const tick = () => {
      const a = el.current;
      const v = latest.current.verses.find((x) => x.n === playingVerse);
      if (a && v && a.duration > 0 && !a.paused) {
        const { starts, synced } = startsFor(v, a.duration * 1000);
        const w = wordAt(starts, a.currentTime * 1000); // temps du média : indépendant du tempo choisi
        const prog = Math.min(1, a.currentTime / a.duration);
        set((s) => (s.word === w && Math.abs(s.progress - prog) < 0.01 && s.synced === synced ? s : { ...s, word: w, progress: prog, synced }));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playingVerse, startsFor, set]);

  // Le tempo change en direct, même pendant la lecture
  useEffect(() => {
    if (el.current) applyRate(el.current, cfg.rate);
  }, [cfg.rate]);

  const waitResume = useCallback(async () => {
    if (!paused.current) return;
    await new Promise<void>((r) => (gate.current = r));
  }, []);

  const runFrom = useCallback(
    async (startIdx: number) => {
      const my = ++run.current;
      const alive = () => run.current === my;
      paused.current = false;
      gate.current?.();
      gate.current = null;

      for (let idx = startIdx; ; idx++) {
        const { verses: vs, cfg: c, reciter: rc, surah: sn } = latest.current;
        if (!rc || !vs.length) return;
        const plan = { count: vs.length, verseRepeat: c.verseRepeat, groupRepeat: c.groupRepeat };
        const step = stepAt(plan, idx);
        if (!step) {
          set({ ...INITIAL, status: 'done' });
          return;
        }
        stepRef.current = idx;
        const verse = vs[step.verseIndex];
        set({ status: 'loading', verse: verse.n, verseRep: step.verseRep, groupRep: step.group, word: -1, progress: 0, error: null });

        const url = ayahUrl(rc.folder, sn, verse.n);
        let src = url;
        try {
          src = await audioBlobUrl(url);
        } catch {
          /* lecture directe si le téléchargement échoue */
        }
        if (!alive()) return;
        const upcoming = stepAt(plan, idx + 1);
        if (upcoming) prefetchAudio(ayahUrl(rc.folder, sn, vs[upcoming.verseIndex].n));

        if (paused.current) {
          pausedFrom.current = 'loading';
          await waitResume();
          if (!alive()) return;
        }
        const a = el.current;
        if (!a) return;
        applyRate(a, latest.current.cfg.rate);
        a.src = src;
        applyRate(a, latest.current.cfg.rate); // le chargement d'un nouveau fichier remet la vitesse à 1

        const ok = await new Promise<boolean>((resolve) => {
          a.onended = () => resolve(true);
          a.onerror = () => resolve(false);
          a.play().then(() => alive() && set((s) => (s.status === 'loading' ? { ...s, status: 'playing' } : s))).catch(() => resolve(false));
        });
        if (!alive()) return;
        if (!ok) {
          set({ ...INITIAL, status: 'error', error: "Impossible de lire l'audio. Vérifiez la connexion, ou appuyez de nouveau sur Lecture." });
          return;
        }

        // Pause entre deux lectures (le temps de répéter à voix haute)
        const gap = upcoming ? pauseMs(latest.current.cfg.pause, (a.duration || 0) * 1000, latest.current.cfg.rate) : 0;
        if (gap > 0) {
          set({ status: 'gap', word: -1, progress: 1, gapTotalMs: gap, gapLeftMs: gap });
          let left = gap;
          let last = performance.now();
          while (left > 0) {
            await sleep(80);
            if (!alive()) return;
            if (paused.current) {
              pausedFrom.current = 'gap';
              await waitResume();
              if (!alive()) return;
              last = performance.now();
              continue;
            }
            const now = performance.now();
            left -= now - last;
            last = now;
            set((s) => ({ ...s, gapLeftMs: Math.max(left, 0) }));
          }
        }
      }
    },
    [set, waitResume],
  );

  /** À appeler directement depuis un appui (iOS n'autorise le son qu'à cette condition). */
  const play = useCallback(() => {
    if (!el.current) {
      el.current = new Audio();
      el.current.preload = 'auto';
    }
    if (statusRef.current === 'paused') return resume();
    const a = el.current;
    a.src = SILENT;
    a.play().catch(() => {});
    runFrom(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runFrom]);

  const pause = useCallback(() => {
    if (statusRef.current !== 'playing' && statusRef.current !== 'gap' && statusRef.current !== 'loading') return;
    pausedFrom.current = statusRef.current === 'gap' ? 'gap' : statusRef.current === 'loading' ? 'loading' : 'playing';
    paused.current = true;
    el.current?.pause();
    set((s) => ({ ...s, status: 'paused' }));
  }, [set]);

  const resume = useCallback(() => {
    if (!paused.current) return;
    paused.current = false;
    const from = pausedFrom.current;
    if (from === 'playing') {
      el.current?.play().catch(() => {});
      set((s) => ({ ...s, status: 'playing' }));
    } else {
      set((s) => ({ ...s, status: from === 'gap' ? 'gap' : 'loading' }));
    }
    gate.current?.();
    gate.current = null;
  }, [set]);

  const stop = useCallback(() => {
    run.current++;
    paused.current = false;
    gate.current?.();
    gate.current = null;
    el.current?.pause();
    set(INITIAL);
  }, [set]);

  const skip = useCallback(
    (dir: 1 | -1) => {
      const { verses: vs, cfg: c } = latest.current;
      const idx = skipVerse({ count: vs.length, verseRepeat: c.verseRepeat, groupRepeat: c.groupRepeat }, stepRef.current, dir);
      if (idx == null) return stop();
      if (!el.current) return;
      runFrom(idx);
    },
    [runFrom, stop],
  );

  useEffect(() => stop, [stop]);

  return { state, play, pause, resume, stop, next: () => skip(1), prev: () => skip(-1) };
}
