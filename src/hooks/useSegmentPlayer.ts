import { useCallback, useEffect, useRef, useState } from 'react';
import type { Reciter } from '../types';
import { ayahUrl } from './useAudio';
import { applyRate, audioBlobUrl, sharedAudio, unlockAudio } from '../lib/audioCache';
import { estimateStarts, loadTimings } from '../lib/timing';

/** Marge avant et après le mot, pour ne pas couper l'attaque de la première lettre ni la fin de la dernière. */
const LEAD_MS = 120;
const TAIL_MS = 90;

export interface SegmentRequest {
  key: string; // identifie le bouton qui a demandé la lecture (pour afficher « en cours » au bon endroit)
  surah: number;
  verse: number;
  /** Index du mot dans le verset ; null = tout le verset. */
  word: number | null;
  /** Nombre de mots du verset, pour estimer les instants si l'horodatage exact manque. */
  wordCount?: number;
  rate: number;
}

export type SegmentStatus = 'idle' | 'loading' | 'playing' | 'error';

/**
 * Joue UN mot (ou un verset entier) prononcé par un vrai récitateur : on se place sur le début du mot d'après les
 * horodatages exacts, on joue jusqu'au début du mot suivant, puis on s'arrête. Sert aux fiches de Tajwid : entendre
 * la règle telle qu'elle est réellement récitée, à vitesse normale ou au ralenti.
 */
export function useSegmentPlayer(reciter: Reciter | undefined) {
  const run = useRef(0);
  const raf = useRef(0);
  const [state, setState] = useState<{ key: string | null; status: SegmentStatus }>({ key: null, status: 'idle' });

  const stop = useCallback(() => {
    run.current++;
    cancelAnimationFrame(raf.current);
    sharedAudio().pause();
    setState({ key: null, status: 'idle' });
  }, []);

  useEffect(() => stop, [stop]);

  /** À appeler directement depuis un appui : iOS n'autorise le son qu'à cette condition. */
  const play = useCallback(
    async (req: SegmentRequest) => {
      if (!reciter) return;
      unlockAudio(); // débloque le son pendant l'appui, avant les attentes ci-dessous
      const my = ++run.current;
      cancelAnimationFrame(raf.current);
      const alive = () => run.current === my;
      const a = sharedAudio();
      a.pause();
      setState({ key: req.key, status: 'loading' });
      try {
        const url = ayahUrl(reciter.folder, req.surah, req.verse);
        let src = url;
        try {
          src = await audioBlobUrl(url);
        } catch {
          /* lecture directe si le téléchargement échoue */
        }
        if (!alive()) return;
        applyRate(a, req.rate);
        a.src = src;
        applyRate(a, req.rate); // le chargement d'un nouveau fichier remet la vitesse à 1
        await new Promise<void>((resolve, reject) => {
          if (a.readyState >= 1 && Number.isFinite(a.duration)) return resolve();
          a.onloadedmetadata = () => resolve();
          a.onerror = () => reject(new Error('audio'));
        });
        if (!alive()) return;

        const durationMs = a.duration * 1000;
        let startMs = 0;
        let endMs = durationMs;
        if (req.word != null) {
          const timings = reciter.qcId ? (await loadTimings(reciter.id, req.surah))?.[req.verse] : undefined;
          if (!alive()) return;
          const starts = timings ?? (req.wordCount ? estimateStarts(new Array(req.wordCount).fill('xxxxx'), durationMs) : null);
          if (starts && req.word < starts.length) {
            startMs = starts[req.word];
            endMs = req.word + 1 < starts.length ? starts[req.word + 1] : durationMs;
          }
        }
        a.currentTime = Math.max(0, startMs - LEAD_MS) / 1000;
        await a.play();
        if (!alive()) return;
        setState({ key: req.key, status: 'playing' });

        const stopAt = Math.min(durationMs, endMs + TAIL_MS);
        const tick = () => {
          if (!alive()) return;
          if (a.ended || a.currentTime * 1000 >= stopAt) {
            a.pause();
            setState({ key: null, status: 'idle' });
            return;
          }
          raf.current = requestAnimationFrame(tick);
        };
        raf.current = requestAnimationFrame(tick);
      } catch {
        if (alive()) setState({ key: req.key, status: 'error' });
      }
    },
    [reciter],
  );

  return { state, play, stop };
}
